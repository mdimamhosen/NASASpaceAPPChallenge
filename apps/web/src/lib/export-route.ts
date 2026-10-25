import type { RouteAnalysis, RouteWaypoint } from '@mars-explorer/shared';

/** Download active Marswalk as GeoJSON (classroom / GIS). */
export function exportRouteGeoJson(waypoints: RouteWaypoint[], analysis: RouteAnalysis | null) {
  const feature = {
    type: 'Feature' as const,
    properties: {
      name: 'Jezero Marswalk',
      distanceKm: analysis?.distanceKm ?? null,
      riskIndex: analysis?.riskIndex.total ?? null,
      terrainMethod: analysis?.terrainMethod ?? null,
      dtmCoverage: analysis?.dtmCoverage ?? null,
      certifying: false,
      note: 'NON-CERTIFYING research sketch. Mars mean sphere coordinates.',
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: waypoints.map((p) => [p.lon, p.lat]),
    },
  };
  const collection = { type: 'FeatureCollection' as const, features: [feature] };
  downloadBlob(JSON.stringify(collection, null, 2), 'jezero-marswalk.geojson', 'application/geo+json');
}

/** Download waypoints + DEM samples + risk components as CSV. */
export function exportRouteCsv(waypoints: RouteWaypoint[], analysis: RouteAnalysis | null) {
  const lines = ['section,id,lat,lon,elevation_m,slope_deg,score,label,source,formula'];
  waypoints.forEach((p, i) => lines.push(`waypoint,${i + 1},${p.lat},${p.lon},,,,,`));
  analysis?.terrainSamples.forEach((s, i) => lines.push(`dtm_sample,${i + 1},${s.lat},${s.lon},${s.elevationM},${s.slopeDeg ?? ''},,,`));
  analysis?.riskIndex.components.forEach((c) => lines.push(`risk,${c.id},,,,${c.score},${csv(c.label)},${csv(c.source)},${csv(c.formula)}`));
  downloadBlob(lines.join('\n'), 'jezero-marswalk.csv', 'text/csv');
}

function csv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadBlob(body: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
