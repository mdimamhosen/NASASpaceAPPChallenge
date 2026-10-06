import type { Provenance, ProvenanceClaim } from '@mars-explorer/shared';

/**
 * Deterministic provenance gate (no model): every number in an agent answer must match a number that a sourced
 * tool returned, or that the user wrote in the goal. Unmatched numbers are flagged, never silently passed as fact.
 * Pure, so `provenance.check.ts` runs it directly.
 */
export type ToolEvidence = { tool: string; output: unknown; source?: string };

// Names that contain digits but are not quantities.
const NAMES = /\b(Mars ?2020|M2020|Viking ?[12]|Space Apps ?20\d\d|NOAA-?2[01]|Mars Express|3D|2D|A\*|gemini-[\w.-]+|claude-[\w.-]+|COSPAR [\w-]+|DTE\w+|ESP_\w+|PSP_\w+)\b/gi;
const NUMBER = /(?<![\w.\[\/])([-−]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-−]?\d+(?:\.\d+)?)(?![\w\]]|\.\d)(\s*(?:million|billion|thousand))?(\s*%)?(\s*\/\s*100\b)?/gi;
const SCALE: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9 };

const parse = (raw: string) => Number(raw.replace(/,/g, '').replace('−', '-'));
const decimals = (raw: string) => (raw.includes('.') ? raw.split('.')[1].length : 0);

/** Every number appearing anywhere inside a tool output (deep), as plain values. */
export function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) out.push(value);
  else if (typeof value === 'string') for (const m of value.replace(NAMES, ' ').matchAll(NUMBER)) { const v = parse(m[1]); if (Number.isFinite(v)) out.push(v * (m[2] ? SCALE[m[2].trim().toLowerCase()] : 1)); }
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

/** A stated number matches a source number if it equals it after the rounding the answer used (or as a percentage of a fraction). */
export function matches(stated: number, statedDecimals: number, source: number, percent: boolean): boolean {
  const tol = 0.5 * 10 ** -statedDecimals + 1e-9;
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(tol, Math.abs(b) * 0.005);
  return near(stated, source) || (percent && near(stated, source * 100));
}

export function checkProvenance(answer: string, goal: string, evidence: ToolEvidence[]): Provenance {
  const sourced = evidence.map((e) => ({ ...e, numbers: numbersIn(e.output) }));
  const given = numbersIn(goal);
  const claims: ProvenanceClaim[] = [];
  // Bangla answers may use Bengali digits (০–৯); normalise them so they are checked like any other number.
  answer = answer.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const text = answer.replace(NAMES, (m) => ' '.repeat(m.length));
  for (const m of text.matchAll(NUMBER)) {
    if (m[4]) continue; // "43/100": the 100 is the scale of a score, the score itself is matched separately
    const raw = m[1];
    const value = parse(raw) * (m[2] ? SCALE[m[2].trim().toLowerCase()] : 1);
    if (!Number.isFinite(value)) continue;
    const d = m[2] ? 0 : decimals(raw);
    const scaledTol = m[2] ? SCALE[m[2].trim().toLowerCase()] / 10 ** decimals(raw) : 0;
    const label = answer.slice(Math.max(0, m.index! - 24), m.index! + m[0].length + 10).replace(/\s+/g, ' ').trim();
    const hit = (n: number) => (scaledTol ? Math.abs(n - value) <= scaledTol / 2 + 1 : matches(value, d, n, Boolean(m[3])));
    const tool = sourced.find((e) => e.numbers.some(hit));
    if (tool) claims.push({ text: label, value, tool: tool.tool, sourceUrl: tool.source });
    else if (given.some(hit)) claims.push({ text: label, value, tool: 'user goal', sourceUrl: 'stated in the question' });
    else claims.push({ text: label, value, unmatched: true });
  }
  const unmatched = claims.filter((c) => c.unmatched).length;
  return {
    complete: unmatched === 0, claims, unmatched,
    evidence: evidence.map((e) => ({ tool: e.tool, source: e.source, output: JSON.stringify(e.output).slice(0, 1600) })),
  };
}
