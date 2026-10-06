import { Injectable, Logger } from '@nestjs/common';
import type { RagMode, RagPassage, RagSearchResult } from '@mars-explorer/shared';
import type { CorpusDoc } from './corpus-loader.service';
import { EmbedderService } from './embedder.service';
import { RagIndexService, type IndexedChunk } from './index.service';
import { dot, mmr, rrf } from './ranking';
import { tokenize } from './text';

const CANDIDATES = 30;
// Evidence gate. Measured on gemini-embedding-001: on-topic questions top out at 0.69–0.80, off-topic ones near 0.49.
// One rare keyword can inflate BM25, so BM25 gates only when embeddings are unavailable, and then needs two matched terms.
const MIN_DENSE = 0.6, MIN_BM25 = 2.5, MIN_TERMS = 2;

@Injectable()
export class RetrieverService {
  private readonly log = new Logger(RetrieverService.name);
  constructor(private readonly index: RagIndexService, private readonly embedder: EmbedderService) {}

  async search(query: string, k = 6, mode: RagMode = 'hybrid'): Promise<RagSearchResult> {
    const started = Date.now();
    const st = await this.index.ensure();
    const queryTokens = tokenize(query);
    const bmScores = st.bm25.scores(queryTokens);
    const bmRanked = bmScores.map((s, i) => ({ s, i })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, CANDIDATES);

    let dense: Array<{ s: number; i: number }> = [];
    // Offline or keyless: skip the query embedding instead of waiting on a network timeout.
    if (mode !== 'bm25' && st.semantic && this.embedder.available) {
      try {
        const qv = await this.embedder.embedQuery(query);
        dense = st.chunks.map((c, i) => ({ s: c.vec ? dot(qv, c.vec) : -1, i })).sort((a, b) => b.s - a.s).slice(0, CANDIDATES);
      } catch (error) {
        this.log.warn(`query embedding failed, using BM25: ${(error as Error).message}`);
      }
    }
    const denseOf = new Map(dense.map((d) => [d.i, d.s]));
    const used: RagMode = mode === 'bm25' || !dense.length ? 'bm25' : mode;
    const lists = used === 'dense' ? [dense.map((d) => String(d.i))] : used === 'bm25' ? [bmRanked.map((r) => String(r.i))] : [bmRanked.map((r) => String(r.i)), dense.map((d) => String(d.i))];
    const fused = rrf(lists);
    const candidates = [...fused].map(([i, score]) => ({ id: i, score, vec: st.chunks[Number(i)].vec }));
    const picked = used === 'hybrid' ? mmr(candidates, k, 0.75) : candidates.sort((a, b) => b.score - a.score).slice(0, k);

    const maxBm = Math.max(1e-9, ...bmRanked.map((r) => r.s));
    const top = picked[0]?.score || 1;
    const titleOf = new Map(st.docs.map((d) => [d.id, d]));
    const passages: RagPassage[] = picked.map((p, n) => {
      const c: IndexedChunk = st.chunks[Number(p.id)];
      const doc = titleOf.get(c.docId)!;
      return {
        n: n + 1, chunkId: c.id, docId: c.docId, title: doc.title, url: doc.url, heading: c.heading, text: c.text,
        scores: { bm25: Number((bmScores[Number(p.id)] / maxBm).toFixed(3)), dense: denseOf.has(Number(p.id)) ? Number(denseOf.get(Number(p.id))!.toFixed(3)) : null, fused: Number((p.score / top).toFixed(3)) },
      };
    });
    const bestBm = bmRanked[0]?.s ?? 0, bestDense = dense[0]?.s ?? 0;
    const topTokens = new Set(bmRanked[0] ? st.chunks[bmRanked[0].i].tokens : []);
    const matchedTerms = new Set(queryTokens.filter((t) => topTokens.has(t))).size;
    const strong = passages.length > 0 && (dense.length ? bestDense >= MIN_DENSE : bestBm >= MIN_BM25 && matchedTerms >= MIN_TERMS);
    return { query, mode: used, semantic: st.semantic, strong, passages, tookMs: Date.now() - started };
  }

  /** Back-compat for callers that want whole source documents. */
  async retrieve(question: string, limit = 3): Promise<CorpusDoc[]> {
    const [{ passages }, st] = await Promise.all([this.search(question, limit * 3), this.index.ensure()]);
    const ids = [...new Set(passages.map((p) => p.docId))].slice(0, limit);
    return ids.map((id) => st.docs.find((d) => d.id === id)!).filter(Boolean);
  }
}
