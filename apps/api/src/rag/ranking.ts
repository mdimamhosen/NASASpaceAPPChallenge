/** Pure ranking primitives: BM25, cosine, Reciprocal Rank Fusion, MMR, PCA. */

export class Bm25 {
  private readonly df = new Map<string, number>();
  private readonly tf: Array<Map<string, number>> = [];
  private readonly len: number[] = [];
  private readonly avg: number;
  private readonly k1: number;
  private readonly b: number;

  constructor(docs: string[][], k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    for (const tokens of docs) {
      const counts = new Map<string, number>();
      for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
      for (const t of counts.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.tf.push(counts);
      this.len.push(tokens.length);
    }
    this.avg = this.len.reduce((a, n) => a + n, 0) / Math.max(1, this.len.length);
  }

  scores(query: string[]): number[] {
    const N = this.tf.length, terms = [...new Set(query)];
    return this.tf.map((counts, i) => {
      let s = 0;
      for (const t of terms) {
        const f = counts.get(t);
        if (!f) continue;
        const n = this.df.get(t)!;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        s += idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * this.len[i]) / this.avg)));
      }
      return s;
    });
  }
}

export const dot = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

export function normalize(v: number[] | Float32Array): Float32Array {
  const out = Float32Array.from(v);
  const n = Math.hypot(...out) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= n;
  return out;
}

/** Reciprocal Rank Fusion over ranked id lists. */
export function rrf(lists: string[][], k = 60): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)));
  return scores;
}

/** Maximal Marginal Relevance: trade relevance against similarity to already-picked items. */
export function mmr<T extends { id: string; score: number; vec?: Float32Array }>(candidates: T[], k: number, lambda = 0.7): T[] {
  const pool = [...candidates].sort((a, b) => b.score - a.score);
  const top = pool[0]?.score || 1;
  const picked: T[] = [];
  while (picked.length < k && pool.length) {
    let bestI = 0, best = -Infinity;
    pool.forEach((c, i) => {
      const redundancy = c.vec ? Math.max(0, ...picked.map((p) => (p.vec ? dot(c.vec!, p.vec) : 0))) : 0;
      const value = lambda * (c.score / top) - (1 - lambda) * redundancy;
      if (value > best) { best = value; bestI = i; }
    });
    picked.push(pool.splice(bestI, 1)[0]);
  }
  return picked;
}

/** Top-3 principal components by power iteration with deflation. */
// ponytail: O(iters·n·d) power iteration; fine for a few thousand chunks, swap for randomized SVD beyond that.
export function pca3(vectors: Float32Array[]): { mean: Float32Array; axes: Float32Array[] } {
  const d = vectors[0]?.length ?? 0, mean = new Float32Array(d);
  for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i] / vectors.length;
  const X = vectors.map((v) => v.map((x, i) => x - mean[i]));
  const axes: Float32Array[] = [];
  for (let c = 0; c < 3 && d; c++) {
    let a = normalize(Array.from({ length: d }, (_, i) => Math.sin(i * (c + 1) + 1)));
    for (let it = 0; it < 40; it++) {
      const next = new Float32Array(d);
      for (const x of X) { const p = dot(x, a); for (let i = 0; i < d; i++) next[i] += p * x[i]; }
      for (const prev of axes) { const p = dot(next, prev); for (let i = 0; i < d; i++) next[i] -= p * prev[i]; }
      a = normalize(next);
    }
    axes.push(a);
  }
  return { mean, axes };
}

export const project = (v: Float32Array, p: { mean: Float32Array; axes: Float32Array[] }) => p.axes.map((a) => dot(v.map((x, i) => x - p.mean[i]), a));
