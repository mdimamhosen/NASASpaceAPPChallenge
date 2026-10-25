/**
 * Line of sight between two surface points over a DEM (radio or visual). Samples the great circle, adds Mars
 * curvature drop (d²/2R), and reports the tightest clearance. NON-CERTIFYING: ignores Fresnel zones and diffraction.
 */
export type ElevationFn = (lat: number, lon: number) => number | null;
const R = 3_389_500;

export function lineOfSight(elevation: ElevationFn, a: { lat: number; lon: number }, b: { lat: number; lon: number }, { heightA = 2, heightB = 2, steps = 200 } = {}) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  const total = 2 * R * Math.asin(Math.sqrt(h));
  const za = elevation(a.lat, a.lon), zb = elevation(b.lat, b.lon);
  if (za == null || zb == null) return null;
  const ya = za + heightA, yb = zb + heightB;
  let minClearance = Infinity, blockedAtM: number | null = null;
  const profile: Array<{ m: number; ground: number; ray: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, d = t * total;
    const g = elevation(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t);
    if (g == null) continue;
    // Curvature bulge relative to the chord, largest mid-path.
    const ground = g + (d * (total - d)) / (2 * R);
    const ray = ya + (yb - ya) * t;
    profile.push({ m: d, ground, ray });
    if (i === 0 || i === steps) continue;
    const c = ray - ground;
    if (c < minClearance) minClearance = c;
    if (c < 0 && blockedAtM == null) blockedAtM = d;
  }
  return { clear: blockedAtM == null, distanceM: total, minClearanceM: minClearance, blockedAtM, profile };
}
