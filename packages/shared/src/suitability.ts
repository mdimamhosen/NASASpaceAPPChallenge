/**
 * Habitat / landing-site suitability over the PLACES orbital DEM grid. Multi-criteria, weights are adjustable heuristics.
 * NON-CERTIFYING: ~118 m cells cannot see boulders, scarps or dust; this ranks where to look, not where it is safe.
 */
export type SuitabilityWeights = { slope: number; roughness: number; elevation: number; science: number; trafficable: number };
export const DEFAULT_WEIGHTS: SuitabilityWeights = { slope: 0.35, roughness: 0.2, elevation: 0.1, science: 0.2, trafficable: 0.15 };

export type SuitabilityInput = {
  latMin: number; lonMin: number; sampleSpacingDegrees: number; rows: Array<Array<number | null>>;
  /** Science targets (e.g. delta, crater-floor POIs). */
  targets: Array<{ lat: number; lon: number }>;
  /** Ground a rover has already driven (PLACES track) as a trafficability proxy. */
  track: Array<{ lat: number; lon: number }>;
};
export type SiteScore = { lat: number; lon: number; score: number; slopeDeg: number; roughnessDeg: number; elevationM: number; targetKm: number; trackKm: number };

const R = 3389.5; // Mars mean radius, km
const clamp = (x: number) => Math.max(0, Math.min(1, x));
// Equirectangular distance is exact enough over a ~10 km grid.
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const k = (Math.PI / 180) * R, x = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180)) * k, y = (b.lat - a.lat) * k;
  return Math.hypot(x, y);
};

/** Per-cell slope (deg) from central differences; null where the cell or all neighbours are missing. */
export function slopeGrid({ rows, sampleSpacingDegrees, latMin }: Pick<SuitabilityInput, 'rows' | 'sampleSpacingDegrees' | 'latMin'>): Array<Array<number | null>> {
  const dy = sampleSpacingDegrees * (Math.PI / 180) * R * 1000;
  return rows.map((row, y) => row.map((z, x) => {
    if (z == null) return null;
    const dx = dy * Math.cos((latMin + y * sampleSpacingDegrees) * (Math.PI / 180));
    const e = row[x + 1] ?? null, w = row[x - 1] ?? null, n = rows[y + 1]?.[x] ?? null, s = rows[y - 1]?.[x] ?? null;
    const gx = e != null && w != null ? (e - w) / (2 * dx) : e != null ? (e - z) / dx : w != null ? (z - w) / dx : null;
    const gy = n != null && s != null ? (n - s) / (2 * dy) : n != null ? (n - z) / dy : s != null ? (z - s) / dy : null;
    if (gx == null && gy == null) return null;
    return (Math.atan(Math.hypot(gx ?? 0, gy ?? 0)) * 180) / Math.PI;
  }));
}

export function suitability(input: SuitabilityInput, weights: SuitabilityWeights = DEFAULT_WEIGHTS) {
  const slopes = slopeGrid(input);
  const elev = input.rows.flat().filter((v): v is number => v != null);
  const [minE, maxE] = [Math.min(...elev), Math.max(...elev)];
  const total = Object.values(weights).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  // Thin the track so distance search stays cheap; 1 in 4 PLACES points is still < 50 m apart.
  const track = input.track.filter((_, i) => i % 4 === 0);
  const sites: SiteScore[] = [];
  const cells = input.rows.map((row, y) => row.map((z, x) => {
    const slope = slopes[y][x];
    if (z == null || slope == null) return null;
    const around = [-1, 0, 1].flatMap((j) => [-1, 0, 1].map((i) => slopes[y + j]?.[x + i])).filter((v): v is number => v != null);
    const mean = around.reduce((a, b) => a + b, 0) / around.length;
    const roughness = Math.sqrt(around.reduce((a, b) => a + (b - mean) ** 2, 0) / around.length);
    const p = { lat: input.latMin + y * input.sampleSpacingDegrees, lon: input.lonMin + x * input.sampleSpacingDegrees };
    const targetKm = input.targets.length ? Math.min(...input.targets.map((t) => km(p, t))) : Infinity;
    const trackKm = track.length ? Math.min(...track.map((t) => km(p, t))) : Infinity;
    const parts = {
      slope: clamp(1 - slope / 15), roughness: clamp(1 - roughness / 5), elevation: maxE > minE ? (maxE - z) / (maxE - minE) : 1,
      science: clamp(1 - targetKm / 3), trafficable: clamp(1 - trackKm / 2),
    };
    // Cells at or above 15° get no credit at all: too steep to land or set up a habitat on this grid's evidence.
    const score = slope >= 15 ? 0 : (Object.keys(parts) as Array<keyof SuitabilityWeights>).reduce((s, k) => s + Math.max(0, weights[k]) * parts[k], 0) / total * 100;
    sites.push({ ...p, score, slopeDeg: slope, roughnessDeg: roughness, elevationM: z, targetKm, trackKm });
    return score;
  }));
  // Top sites at least 500 m apart so the list is not one cluster.
  const best: SiteScore[] = [];
  for (const s of sites.sort((a, b) => b.score - a.score)) { if (best.every((b) => km(b, s) >= 0.5)) best.push(s); if (best.length === 5) break; }
  return { cells, best, weights };
}
