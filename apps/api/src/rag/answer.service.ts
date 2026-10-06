import { Injectable } from '@nestjs/common';
import type { AnswerLang, RagAnswer, RagModel, RagPassage, RagSearchResult } from '@mars-explorer/shared';
import { LlmService } from './llm.service';
import { splitSentences, tokenize } from './text';

export type StreamEvent = { type: 'token'; data: string } | { type: 'reset' };

const INSUFFICIENT = 'INSUFFICIENT_EVIDENCE';
export const REFUSAL = 'The indexed NASA sources do not contain enough evidence to answer that reliably. Try rephrasing, or add a source in the corpus manager.';

/** Bangla is written by a cloud model only; digits, units, names and [n] stay as-is so citation and provenance checks still hold. */
export const langInstruction = (lang: AnswerLang = 'en') => (lang === 'bn' ? '\nWrite the final answer in Bangla (বাংলা). Keep every number, unit, dataset or mission name, and [n] citation exactly as in the evidence.' : '');

const SYSTEM = [
  "You answer questions for Mars Explorer, a research console about NASA's Mars 2020 Perseverance mission, Jezero Crater, and the app's NASA data sources.",
  'Use ONLY the numbered passages provided. Do not use outside knowledge.',
  'End every factual sentence with one or more citation markers like [1] or [2][3] that refer to the passage numbers supporting it.',
  `If the passages do not answer the question, reply with exactly ${INSUFFICIENT} and nothing else.`,
  'Lines marked EARTH / EONET describe Earth only. Label any use of them as Earth context and never present them as Mars surface conditions.',
  'Routes and risk scores in this app are non-certifying research aids; never describe anything as safe or certified.',
  'Write plain prose (no markdown headings), at most about 170 words.',
].join('\n');

@Injectable()
export class AnswerService {
  constructor(private readonly llm: LlmService) {}

  /** Keep only markers that point at real passages; report which were used. */
  validateCitations(text: string, count: number): { text: string; cited: number[] } {
    const cited = new Set<number>();
    const cleaned = text.replace(/\[(\d+)\]/g, (m, n: string) => { const i = Number(n); if (i >= 1 && i <= count) { cited.add(i); return m; } return ''; });
    return { text: cleaned.replace(/[ \t]+([.,;])/g, '$1').trim(), cited: [...cited].sort((a, b) => a - b) };
  }

  /** Deterministic extractive answer: best query-matching sentences from top passages, each cited. */
  extractive(question: string, passages: RagPassage[]): { text: string; cited: number[] } {
    const q = new Set(tokenize(question));
    const scored = passages.slice(0, 5).flatMap((p) =>
      splitSentences(p.text).map((sentence, order) => {
        const t = tokenize(sentence);
        const overlap = t.filter((w) => q.has(w)).length;
        return { sentence, n: p.n, order, score: overlap / Math.sqrt(t.length + 1) + 0.35 / p.n + (p.scores.dense ?? 0) * 0.2 };
      }),
    ).filter((s) => s.sentence.split(' ').length >= 6);
    const chosen = scored.sort((a, b) => b.score - a.score).slice(0, 4).sort((a, b) => a.n - b.n || a.order - b.order);
    const seen = new Set<string>();
    const lines = chosen.filter((c) => !seen.has(c.sentence) && seen.add(c.sentence)).map((c) => `${c.sentence.replace(/\s*\[\d+\]$/, '')} [${c.n}]`);
    return { text: lines.join(' '), cited: [...new Set(chosen.map((c) => c.n))].sort((a, b) => a - b) };
  }

  /** Exact-question cache; callers fold the index signature into the key so corpus changes invalidate it. */
  // ponytail: in-memory LRU of 200 answers per process; move to Redis/Postgres if the API is scaled out.
  private readonly cache = new Map<string, RagAnswer>();
  cached(key: string) { const hit = this.cache.get(key); if (hit) { this.cache.delete(key); this.cache.set(key, hit); } return hit; }
  remember(key: string, value: RagAnswer) { if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!); this.cache.set(key, value); }

  answer(question: string, search: RagSearchResult, opts: { useCloud: boolean; earthContext?: string; lang?: AnswerLang }): Promise<RagAnswer> {
    return this.answerStream(question, search, opts, () => undefined);
  }

  /** Streams tokens via `emit`; resolves with the validated final answer. `reset` tells the client to discard streamed text. */
  async answerStream(question: string, search: RagSearchResult, opts: { useCloud: boolean; earthContext?: string; lang?: AnswerLang }, emit: (e: StreamEvent) => void): Promise<RagAnswer> {
    const { passages } = search;
    if (!search.strong && !opts.earthContext) return { ...search, answer: REFUSAL, modelUsed: 'local-evidence', refused: true, cited: [] };

    if (opts.useCloud && this.llm.providers.length) {
      const context = passages.map((p) => `[${p.n}] ${p.title}${p.heading ? ` — ${p.heading}` : ''}\n${p.text}`).join('\n\n');
      const user = `${context}${opts.earthContext ? `\n\nEARTH / EONET (Earth only, not Mars):\n${opts.earthContext}` : ''}\n\nQuestion: ${question}${langInstruction(opts.lang)}`;
      // Hold the first characters so an INSUFFICIENT_EVIDENCE reply never flashes on screen.
      let held = '', released = false;
      const onDelta = (d: string) => {
        if (released) return emit({ type: 'token', data: d });
        held += d;
        if (held.length >= 24 && !held.trimStart().startsWith('INSUFF')) { released = true; emit({ type: 'token', data: held }); }
      };
      try {
        const result = await this.llm.stream(SYSTEM, user, onDelta);
        if (result) {
          if (result.text.includes(INSUFFICIENT)) { if (released) emit({ type: 'reset' }); return { ...search, answer: REFUSAL, modelUsed: result.provider, refused: true, cited: [] }; }
          if (!released && held) emit({ type: 'token', data: held });
          const checked = this.validateCitations(result.text, passages.length);
          // Uncited model output is not grounded enough to show; fall through to the extractive answer.
          if (checked.cited.length) return { ...search, answer: checked.text, modelUsed: result.provider as RagModel, refused: false, cited: checked.cited };
          emit({ type: 'reset' });
        }
      } catch {
        emit({ type: 'reset' });
      }
    }
    const local = this.extractive(question, passages);
    const earth = opts.earthContext ? `\n\nEARTH / EONET context (Earth only, not Mars):\n${opts.earthContext}` : '';
    if (!local.text && !earth) return { ...search, answer: REFUSAL, modelUsed: 'local-evidence', refused: true, cited: [] };
    const text = `${local.text || 'No Mars passage matched closely.'}${earth}`;
    emit({ type: 'token', data: text });
    return { ...search, answer: text, modelUsed: 'local-evidence', refused: false, cited: local.cited };
  }
}
