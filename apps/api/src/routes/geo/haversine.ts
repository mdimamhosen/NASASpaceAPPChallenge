import type { LatLon } from '@mars-explorer/shared';
import { MARS_RADIUS_KM } from '@mars-explorer/shared';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Haversine distance on Mars (mean radius 3390 km). */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function pointSegmentDistanceKm(point: LatLon, a: LatLon, b: LatLon): number {
  const scale = Math.cos(radians(point.lat));
  const px = point.lon * scale;
  const ax = a.lon * scale;
  const bx = b.lon * scale;
  const py = point.lat;
  const ay = a.lat;
  const by = b.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return haversineKm(point, { lat: ay + t * dy, lon: (ax + t * dx) / (scale || 1) });
}

export function pointInPolygon(point: LatLon, polygon: LatLon[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.lat > point.lat !== b.lat > point.lat && point.lon < ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon) hit = !hit;
  }
  return hit;
}
