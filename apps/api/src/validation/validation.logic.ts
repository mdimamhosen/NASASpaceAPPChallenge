/** Pure statistics for the validation report. No imports so the check runs under plain node. */

/** Seeded PRNG (mulberry32) so random baselines are reproducible run to run. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export type SlopeStats = { n: number; mean: number; p50: number; p90: number; max: number; over10: number; over15: number };

export function slopeStats(values: number[]): SlopeStats {
  const s = [...values].sort((a, b) => a - b);
  const share = (t: number) => (s.length ? s.filter((v) => v >= t).length / s.length : 0);
  return { n: s.length, mean: s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0, p50: quantile(s, 0.5), p90: quantile(s, 0.9), max: s.at(-1) ?? 0, over10: share(10), over15: share(15) };
}

export function offsetStats(distancesKm: number[], withinKm = 0.2) {
  const n = distancesKm.length;
  return { n, meanKm: n ? distancesKm.reduce((a, b) => a + b, 0) / n : 0, maxKm: n ? Math.max(...distancesKm) : 0, withinShare: n ? distancesKm.filter((d) => d <= withinKm).length / n : 0 };
}

/** Tool-choice scoring: a goal passes when every expected tool is planned. Precision counts extra tools. */
export function toolScore(expected: string[], planned: string[]) {
  const hit = expected.filter((t) => planned.includes(t)).length;
  return { pass: hit === expected.length, recall: expected.length ? hit / expected.length : 1, precision: planned.length ? planned.filter((t) => expected.includes(t) || t === 'search_knowledge').length / planned.length : 1 };
}
