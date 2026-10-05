import { Injectable, Logger } from '@nestjs/common';
import { normalize } from './ranking';

type Task = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

/** Gemini text embeddings (768-d, re-normalized). No key → callers fall back to BM25-only retrieval. */
@Injectable()
export class EmbedderService {
  private readonly log = new Logger(EmbedderService.name);
  readonly model = process.env.RAG_EMBED_MODEL || 'gemini-embedding-001';
  readonly dims = 768;
  private readonly queryCache = new Map<string, Float32Array>();

  private get key() { return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY; }
  get available() { return Boolean(this.key); }

  async embed(texts: string[], task: Task): Promise<Float32Array[]> {
    if (!this.key) throw new Error('GEMINI_API_KEY is not configured.');
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100);
      const body = JSON.stringify({ requests: batch.map((text) => ({ model: `models/${this.model}`, content: { parts: [{ text: text.slice(0, 8000) }] }, taskType: task, outputDimensionality: this.dims })) });
      let data: { embeddings?: Array<{ values: number[] }> } | undefined;
      for (let attempt = 0; attempt < 3 && !data; attempt++) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key }, body, signal: AbortSignal.timeout(45_000),
        });
        if (res.ok) data = await res.json();
        else if (res.status === 429 || res.status >= 500) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        else throw new Error(`Gemini embeddings HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      if (!data?.embeddings || data.embeddings.length !== batch.length) throw new Error('Gemini embeddings returned an unexpected response.');
      out.push(...data.embeddings.map((e) => normalize(e.values)));
      this.log.log(`embedded ${Math.min(i + 100, texts.length)}/${texts.length}`);
    }
    return out;
  }

  async embedQuery(query: string): Promise<Float32Array> {
    const hit = this.queryCache.get(query);
    if (hit) return hit;
    const [v] = await this.embed([query], 'RETRIEVAL_QUERY');
    if (this.queryCache.size > 300) this.queryCache.delete(this.queryCache.keys().next().value!);
    this.queryCache.set(query, v);
    return v;
  }
}
