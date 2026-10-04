import type { LatLon, PlacesPoint } from '@mars-explorer/shared';
import { MARS_RADIUS_KM } from '@mars-explorer/shared';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance on the Mars mean sphere. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lon - a.lon) / 2) ** 2;
  return 2 * MARS_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Running distance along a polyline; first entry is 0. */
export function cumulativeKm(points: LatLon[]): number[] {
  const out: number[] = [];
  points.forEach((point, i) => out.push(i ? out[i - 1] + haversineKm(points[i - 1], point) : 0));
  return out;
}

export type TrackComparison = { meanOffsetKm: number; withinShare: number; nearestSol: number; nearestKm: number };

/** Compare route vertices with the published PLACES rover track. */
// ponytail: O(route × track) nearest-point scan; add a grid index if the track grows past a few thousand points.
export function compareWithTrack(route: LatLon[], track: PlacesPoint[], withinKm = 0.2): TrackComparison | null {
  if (!route.length || !track.length) return null;
  let total = 0, within = 0, nearestKm = Infinity, nearestSol = track[0].sol;
  for (const vertex of route) {
    let best = Infinity, bestSol = track[0].sol;
    for (const point of track) {
      const d = haversineKm(vertex, point);
      if (d < best) { best = d; bestSol = point.sol; }
    }
    total += best;
    if (best <= withinKm) within++;
    if (best < nearestKm) { nearestKm = best; nearestSol = bestSol; }
  }
  return { meanOffsetKm: total / route.length, withinShare: within / route.length, nearestSol, nearestKm };
}
