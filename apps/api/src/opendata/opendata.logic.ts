import type { HiriseDtm, LatLon, MarsFeature, OpenDataset, RouteOpenData } from '@mars-explorer/shared';

/** Pure NASA Open Data helpers. No relative imports so `opendata.check.ts` can run them directly in Node. */

export type Box = { south: number; west: number; north: number; east: number };
export type Geo = { segmentKm: (p: LatLon, a: LatLon, b: LatLon) => number; inPolygon: (p: LatLon, polygon: LatLon[]) => boolean };

export function inBox(lat: number, lon: number, box: Box): boolean {
  if (lat < box.south || lat > box.north) return false;
  return box.west <= box.east ? lon >= box.west && lon <= box.east : lon >= box.west || lon <= box.east;
}

/** Smallest feature diameter worth labeling at a Leaflet zoom on the EPSG:4326 Trek basemap. */
export function minDiameterKm(zoom: number): number {
  return zoom <= 1 ? 500 : zoom === 2 ? 220 : zoom === 3 ? 90 : zoom === 4 ? 35 : zoom === 5 ? 12 : zoom === 6 ? 4 : 0;
}

/** Declutters labels: one feature (the largest) per screen cell roughly a label in size at this zoom. */
export function featuresInView(items: MarsFeature[], box: Box, zoom: number, limit = 150): MarsFeature[] {
  const min = minDiameterKm(zoom);
  const pxPerDeg = (512 * 2 ** zoom) / 360; // Leaflet EPSG:4326: 512 px span 360° at zoom 0
  const cellLon = 130 / pxPerDeg, cellLat = 30 / pxPerDeg;
  const taken = new Set<string>();
  const out: MarsFeature[] = [];
  for (const f of items.filter((x) => x.diameterKm >= min && inBox(x.lat, x.lon, box)).sort((a, b) => b.diameterKm - a.diameterKm)) {
    const cell = `${Math.floor(f.lon / cellLon)}:${Math.floor(f.lat / cellLat)}`;
    if (taken.has(cell)) continue;
    taken.add(cell); out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

export function dtmsInView(items: HiriseDtm[], box: Box, limit = 600): HiriseDtm[] {
  return items.filter((d) => d.corners.some(([lat, lon]) => inBox(lat, lon, box))).slice(0, limit);
}

/** Mission tag named in plain language ("InSight", "Curiosity", "Mars 2020"…), matching the catalog's inferred tags. */
const MISSION_ALIASES: Array<[string, RegExp]> = [
  ['PERSEVERANCE', /\b(perseverance|mars 2020|m2020)\b/i], ['CURIOSITY', /\b(curiosity|msl)\b/i], ['INSIGHT', /\binsight\b/i],
  ['PHOENIX', /\bphoenix\b/i], ['OPPORTUNITY', /\bopportunity\b/i], ['SPIRIT', /\bspirit\b/i], ['PATHFINDER', /\b(pathfinder|sojourner)\b/i],
  ['VIKING LANDER', /\bviking (1|2|lander)\b/i], ['VIKING ORBITER', /\bviking orbiter\b/i], ['MRO', /\b(mro|reconnaissance orbiter)\b/i],
  ['MAVEN', /\bmaven\b/i], ['ODYSSEY', /\bodyssey\b/i], ['MARS EXPRESS', /\bmars express\b/i], ['MGS', /\b(mgs|global surveyor)\b/i],
];
export const detectMission = (text: string) => MISSION_ALIASES.find(([, re]) => re.test(text))?.[0];

const STOP = new Set(['the', 'and', 'for', 'what', 'which', 'are', 'there', 'does', 'any', 'data', 'dataset', 'datasets', 'nasa', 'mars', 'find', 'show', 'list', 'about', 'from', 'with', 'exist', 'have', 'has', 'available', 'gov']);
export const searchTerms = (q: string) => q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t)).slice(0, 8);

/** `all` (search box) needs every term; `any` (agent goals in plain language) ranks by matched terms.
 *  Title hits weigh most. Mission facets are counted before the mission filter. */
export function searchCatalog(items: OpenDataset[], q = '', mission?: string, match: 'all' | 'any' = 'all') {
  const pool = mission ? items.filter((item) => item.missions.includes(mission)) : items;
  // In `any` mode, words common to many records ("landing", "site") only add noise.
  const terms = match === 'any'
    ? searchTerms(q).filter((t) => pool.filter((item) => `${item.title} ${item.notes}`.toLowerCase().includes(t)).length <= Math.max(3, pool.length * 0.15))
    : searchTerms(q);
  const scored = terms.length
    ? items.map((item) => {
      const title = item.title.toLowerCase(); const id = item.id; const notes = item.notes.toLowerCase(); const tags = item.missions.join(' ').toLowerCase();
      let score = 0;
      for (const t of terms) {
        const s = (title.includes(t) ? 3 : 0) + (id.includes(t) ? 2 : 0) + (tags.includes(t) ? 2 : 0) + (notes.includes(t) ? 1 : 0);
        if (!s && match === 'all') return { item, score: 0 };
        score += s ? s + 4 : 0; // each matched term outranks partial field weight
      }
      return { item, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title)).map((x) => x.item)
    : [...items].sort((a, b) => a.title.localeCompare(b.title));
  const counts = new Map<string, number>();
  for (const item of scored) for (const m of item.missions) counts.set(m, (counts.get(m) ?? 0) + 1);
  return {
    hits: mission ? scored.filter((item) => item.missions.includes(mission)) : scored,
    missions: [...counts].map(([name, count]) => ({ mission: name, count })).sort((a, b) => b.count - a.count),
  };
}

/** Points every ~stepKm along the route so DTM coverage is a share of route length, not of waypoints. */
export function densify(route: LatLon[], stepDeg = 0.002): LatLon[] {
  const out: LatLon[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]; const b = route[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.lat - a.lat, b.lon - a.lon) / stepDeg));
    for (let k = 0; k < n; k++) out.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((b.lon - a.lon) * k) / n });
  }
  if (route.length) out.push(route.at(-1)!);
  return out;
}

export function routeContext(route: LatLon[], features: MarsFeature[], dtms: HiriseDtm[], geo: Geo, sources: RouteOpenData['sources']): RouteOpenData {
  if (route.length < 2) return { namedFeatures: [], hiriseDtms: [], sources };
  const pad = 1;
  const box: Box = { south: Math.min(...route.map((p) => p.lat)) - pad, north: Math.max(...route.map((p) => p.lat)) + pad, west: Math.min(...route.map((p) => p.lon)) - pad, east: Math.max(...route.map((p) => p.lon)) + pad };
  const namedFeatures = features
    .filter((f) => inBox(f.lat, f.lon, box))
    .map((f) => ({ ...f, distanceKm: Math.min(...route.slice(1).map((p, i) => geo.segmentKm(f, route[i], p))) }))
    // "On route": within the feature's radius, or within 2 km of a small feature's center.
    .filter((f) => f.distanceKm <= Math.max(2, f.diameterKm / 2))
    .sort((a, b) => a.distanceKm - b.distanceKm || b.diameterKm - a.diameterKm)
    .slice(0, 8)
    .map((f) => ({ ...f, distanceKm: Number(f.distanceKm.toFixed(2)) }));
  const samples = densify(route);
  const hiriseDtms = dtms
    .filter((d) => d.corners.some(([lat, lon]) => inBox(lat, lon, box)))
    .map((d) => {
      const polygon = d.corners.map(([lat, lon]) => ({ lat, lon }));
      return { id: d.id, rationale: d.rationale, scaleM: d.scaleM, pdsUrl: d.pdsUrl, coveredShare: Number((samples.filter((p) => geo.inPolygon(p, polygon)).length / samples.length).toFixed(3)) };
    })
    .filter((d) => d.coveredShare > 0)
    .sort((a, b) => b.coveredShare - a.coveredShare || a.scaleM - b.scaleM)
    .slice(0, 6);
  return { namedFeatures, hiriseDtms, sources };
}
