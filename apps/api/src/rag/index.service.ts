import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RagDocument } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';
import { CorpusLoaderService, type CorpusDoc } from './corpus-loader.service';
import { EmbedderService } from './embedder.service';
import { Bm25, pca3 } from './ranking';
import { chunkMarkdown, tokenize } from './text';

export type IndexedChunk = { id: string; docId: string; ord: number; heading: string; text: string; hash: string; tokens: string[]; vec?: Float32Array };
export type IndexState = {
  signature: string; builtAt: string; embedModel: string | null; docs: CorpusDoc[]; documents: RagDocument[]; chunks: IndexedChunk[]; bm25: Bm25;
  semantic: boolean; pca?: ReturnType<typeof pca3>;
};
type StoredIndex = { version: 2; signature: string; builtAt: string; embedModel: string | null; chunks: Array<{ id: string; hash: string; embedding?: string }> };

const encode = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');
const decode = (s: string) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };

/** Chunk → embed → persist. Unchanged chunks reuse stored embeddings by content hash, so ingesting one document embeds only its chunks. */
@Injectable()
export class RagIndexService implements OnModuleInit {
  private readonly log = new Logger(RagIndexService.name);
  private state: IndexState | null = null;
  private building: Promise<IndexState> | null = null;
  private lastBuild = 0;
  private readonly file: string;

  constructor(dataPath: DataPathService, private readonly corpus: CorpusLoaderService, private readonly embedder: EmbedderService) {
    this.file = dataPath.resolve('rag/index.json');
  }

  onModuleInit() { void this.ensure().catch((e: Error) => this.log.error(`initial index build failed: ${e.message}`)); }

  async ensure(): Promise<IndexState> {
    if (this.building) return this.building;
    const signature = await this.corpus.signature();
    // Retry embeddings for a BM25-only index at most every 5 minutes.
    if (this.state?.signature === signature && (this.state.semantic || !this.embedder.available || Date.now() - this.lastBuild < 300_000)) return this.state;
    return this.rebuild(signature);
  }

  rebuild(signature?: string): Promise<IndexState> {
    this.building ??= this.build(signature).finally(() => { this.building = null; });
    return this.building;
  }

  private async build(knownSignature?: string): Promise<IndexState> {
    const started = Date.now();
    this.lastBuild = started;
    const signature = knownSignature ?? (await this.corpus.signature());
    const docs = await this.corpus.loadAll();
    const chunks: IndexedChunk[] = docs.flatMap((doc) =>
      chunkMarkdown(doc.body).map((c, ord) => {
        const text = c.text;
        return { id: `${doc.id}#${ord}`, docId: doc.id, ord, heading: c.heading, text, hash: createHash('sha1').update(`${doc.title}\n${c.heading}\n${text}`).digest('hex'), tokens: tokenize(`${doc.title} ${c.heading} ${text}`) };
      }),
    );
    const stored = await readFile(this.file, 'utf8').then((s) => JSON.parse(s) as StoredIndex).catch(() => null);
    const reuse = new Map<string, Float32Array>();
    if (stored?.version === 2 && stored.embedModel === this.embedder.model) for (const c of stored.chunks) if (c.embedding) reuse.set(c.hash, decode(c.embedding));
    for (const c of chunks) c.vec = reuse.get(c.hash);

    let embedModel: string | null = reuse.size ? this.embedder.model : null;
    const missing = chunks.filter((c) => !c.vec);
    if (missing.length && this.embedder.available) {
      try {
        const titleOf = new Map(docs.map((d) => [d.id, d.title]));
        const vectors = await this.embedder.embed(missing.map((c) => `${titleOf.get(c.docId)}\n${c.heading}\n${c.text}`), 'RETRIEVAL_DOCUMENT');
        missing.forEach((c, i) => { c.vec = vectors[i]; });
        embedModel = this.embedder.model;
      } catch (error) {
        this.log.warn(`embedding failed, serving BM25 for un-embedded chunks: ${(error as Error).message}`);
      }
    }
    const embedded = chunks.filter((c) => c.vec);
    const semantic = embedded.length > 0 && embedded.length === chunks.length;
    const documents: RagDocument[] = docs.map((d) => ({
      id: d.id, title: d.title, url: d.url, source: d.source, retrievedDate: d.retrievedDate,
      chunks: chunks.filter((c) => c.docId === d.id).length, words: d.body.split(/\s+/).length,
    }));
    const builtAt = new Date().toISOString();
    await mkdir(dirname(this.file), { recursive: true });
    const out: StoredIndex = { version: 2, signature, builtAt, embedModel, chunks: chunks.map((c) => ({ id: c.id, hash: c.hash, ...(c.vec ? { embedding: encode(c.vec) } : {}) })) };
    await writeFile(this.file, JSON.stringify(out));
    this.state = {
      signature, builtAt, embedModel, docs, documents, chunks, semantic, bm25: new Bm25(chunks.map((c) => c.tokens)),
      pca: embedded.length >= 3 ? pca3(embedded.map((c) => c.vec!)) : undefined,
    };
    this.log.log(`indexed ${docs.length} docs / ${chunks.length} chunks (${embedded.length} embedded) in ${Date.now() - started} ms`);
    return this.state;
  }
}
