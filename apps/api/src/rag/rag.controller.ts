import { Body, Controller, Delete, Get, Headers, MessageEvent, Param, Post, Query, Sse, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Observable } from 'rxjs';
import { readFile } from 'node:fs/promises';
import type { RagEval, RagMode, RagProjection, RagStatus } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';
import { AnswerService } from './answer.service';
import { EmbedderService } from './embedder.service';
import { RagIndexService } from './index.service';
import { IngestService } from './ingest.service';
import { LlmService } from './llm.service';
import { project } from './ranking';
import { RetrieverService } from './retriever.service';

class SearchDto {
  @IsString() @MinLength(2) @MaxLength(500) query!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) k = 6;
  @IsOptional() @IsIn(['hybrid', 'bm25', 'dense']) mode: RagMode = 'hybrid';
}
class AskDto {
  @IsString() @MinLength(3) @MaxLength(500) question!: string;
  @IsOptional() @IsBoolean() useCloudModels = false;
}
class AskStreamDto {
  @IsString() @MinLength(3) @MaxLength(500) question!: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true' || value === '1') @IsBoolean() cloud = true;
}
class UrlDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) url!: string;
  @IsOptional() @IsIn(['curated', 'user']) source: 'curated' | 'user' = 'user';
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
}
class TextDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(200) @MaxLength(200_000) body!: string;
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) url?: string;
}

@Controller('rag')
export class RagController {
  constructor(
    private readonly index: RagIndexService,
    private readonly retriever: RetrieverService,
    private readonly answers: AnswerService,
    private readonly ingest: IngestService,
    private readonly embedder: EmbedderService,
    private readonly llm: LlmService,
    private readonly dataPath: DataPathService,
  ) {}

  /** Writes require RAG_ADMIN_TOKEN when it is set; local development leaves it open. */
  private authorize(token?: string) {
    const required = process.env.RAG_ADMIN_TOKEN;
    if (required && token !== required) throw new UnauthorizedException('A valid x-rag-token header is required to change the corpus.');
  }

  @Get('status')
  async status(): Promise<RagStatus> {
    const st = await this.index.ensure();
    return {
      documents: st.docs.length, chunks: st.chunks.length, embeddedChunks: st.chunks.filter((c) => c.vec).length, embedModel: st.embedModel,
      semantic: st.semantic, builtAt: st.builtAt, generators: this.llm.status, adminTokenRequired: Boolean(process.env.RAG_ADMIN_TOKEN),
    };
  }

  @Get('documents')
  async documents() { return (await this.index.ensure()).documents; }

  @Post('search')
  search(@Body() body: SearchDto) { return this.retriever.search(body.query, body.k, body.mode); }

  private evalCache?: { signature: string; result: RagEval };

  private async cacheKey(question: string, cloud: boolean) {
    const st = await this.index.ensure();
    return `${st.signature.length}:${st.builtAt}|${cloud ? 'cloud' : 'local'}|${question.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()}`;
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('ask')
  async ask(@Body() body: AskDto) {
    const key = await this.cacheKey(body.question, body.useCloudModels);
    const hit = this.answers.cached(key);
    if (hit) return { ...hit, tookMs: 0 };
    const started = Date.now();
    const search = await this.retriever.search(body.question, 6);
    const result = await this.answers.answer(body.question, search, { useCloud: body.useCloudModels });
    const final = { ...result, tookMs: Date.now() - started };
    if (!final.refused) this.answers.remember(key, final);
    return final;
  }

  /** SSE: `passages` as soon as retrieval finishes, `token` deltas while the answer streams, then `done`. Repeat questions replay from cache. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Sse('ask/stream')
  askStream(@Query() query: AskStreamDto): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const started = Date.now();
      (async () => {
        const key = await this.cacheKey(query.question, query.cloud);
        const hit = this.answers.cached(key);
        if (hit) {
          subscriber.next({ type: 'passages', data: { ...hit, cached: true } });
          subscriber.next({ type: 'token', data: hit.answer });
          subscriber.next({ type: 'done', data: { ...hit, tookMs: Date.now() - started, cached: true } });
          return;
        }
        const search = await this.retriever.search(query.question, 6);
        subscriber.next({ type: 'passages', data: search });
        const result = await this.answers.answerStream(query.question, search, { useCloud: query.cloud }, (e) => subscriber.next(e.type === 'token' ? { type: 'token', data: e.data } : { type: 'reset', data: '' }));
        const final = { ...result, tookMs: Date.now() - started };
        if (!final.refused) this.answers.remember(key, final);
        subscriber.next({ type: 'done', data: final });
      })()
        .catch((error: Error) => subscriber.next({ type: 'failed', data: { message: error.message } }))
        .finally(() => subscriber.complete());
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('documents/url')
  addUrl(@Body() body: UrlDto, @Headers('x-rag-token') token?: string) { this.authorize(token); return this.ingest.addUrl(body.url, body.source, body.title); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('documents/text')
  addText(@Body() body: TextDto, @Headers('x-rag-token') token?: string) { this.authorize(token); return this.ingest.addText(body.title, body.body, body.url); }

  @Delete('documents/:id')
  remove(@Param('id') id: string, @Headers('x-rag-token') token?: string) { this.authorize(token); return this.ingest.remove(id); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reindex')
  async reindex(@Headers('x-rag-token') token?: string) { this.authorize(token); await this.index.rebuild(); return this.status(); }

  /** Doc-level recall@k and MRR for each retrieval mode over data/rag/eval.json. */
  @Get('eval')
  async evaluate(): Promise<RagEval> {
    const signature = (await this.index.ensure()).builtAt;
    if (this.evalCache?.signature === signature) return this.evalCache.result;
    const items = JSON.parse(await readFile(this.dataPath.resolve('rag/eval.json'), 'utf8')) as Array<{ question: string; expected: string[] }>;
    const st = await this.index.ensure();
    const modes: RagMode[] = st.semantic ? ['bm25', 'dense', 'hybrid'] : ['bm25'];
    const misses: RagEval['misses'] = [];
    const rows: RagEval['rows'] = [];
    for (const mode of modes) {
      let r3 = 0, r5 = 0, rr = 0;
      for (const item of items) {
        const docs = [...new Set((await this.retriever.search(item.question, 10, mode)).passages.map((p) => p.docId))];
        const rank = docs.findIndex((d) => item.expected.includes(d));
        if (rank >= 0 && rank < 3) r3++;
        if (rank >= 0 && rank < 5) r5++;
        if (rank >= 0) rr += 1 / (rank + 1);
        if (mode === 'hybrid' && (rank < 0 || rank >= 3)) misses.push({ question: item.question, expected: item.expected, got: docs.slice(0, 3) });
      }
      rows.push({ mode, recallAt3: r3 / items.length, recallAt5: r5 / items.length, mrr: rr / items.length });
    }
    const result = { questions: items.length, semantic: st.semantic, rows, misses };
    this.evalCache = { signature, result };
    return result;
  }

  /** 3D PCA of chunk embeddings, with the query projected into the same space. */
  @Get('projection')
  async projection(@Query('q') q?: string): Promise<RagProjection> {
    const st = await this.index.ensure();
    if (!st.pca) return { points: [], hits: [] };
    const titleOf = new Map(st.docs.map((d) => [d.id, d.title]));
    const points = st.chunks.filter((c) => c.vec).map((c) => { const [x, y, z] = project(c.vec!, st.pca!); return { chunkId: c.id, docId: c.docId, title: titleOf.get(c.docId) ?? c.docId, x, y, z }; });
    if (!q?.trim() || !this.embedder.available) return { points, hits: [] };
    const [search, qv] = await Promise.all([this.retriever.search(q.slice(0, 500), 6), this.embedder.embedQuery(q.slice(0, 500))]);
    const [x, y, z] = project(qv, st.pca);
    return { points, query: { x, y, z }, hits: search.passages.map((p) => p.chunkId) };
  }
}
