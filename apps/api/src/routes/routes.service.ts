import { BadRequestException, Injectable } from '@nestjs/common';
import type { RouteAnalysis, RouteWaypoint } from '@mars-explorer/shared';
import { JezeroSpatialService } from './jezero-spatial.service';
import { RegionsService } from '../regions/regions.service';
import { haversineKm, pointInPolygon, pointSegmentDistanceKm } from './geo/haversine';

@Injectable()
export class RoutesService {
  constructor(private readonly regions: RegionsService, private readonly spatial: JezeroSpatialService) {}

  async analyze(waypoints: RouteWaypoint[]): Promise<RouteAnalysis> {
    if (waypoints.length < 2) throw new BadRequestException('Add at least two route waypoints.');
    if (waypoints.length > 100) throw new BadRequestException('A route can contain at most 100 waypoints.');
    const total = waypoints.slice(1).reduce((sum, point, index) => sum + haversineKm(waypoints[index], point), 0);
    const region = await this.regions.getJezero();
    const segments = waypoints.slice(1).map((point, index) => [waypoints[index], point] as const);
    const spatial = await this.spatial.inspect(waypoints);
    const nearbyPois = region.pois.filter((poi) => spatial ? spatial.poiIds.includes(poi.id) : segments.some(([a, b]) => pointSegmentDistanceKm(poi, a, b) <= 2));
    let crossed = 0;
    for (const hazard of region.hazards) {
      const hits = spatial ? spatial.hazardIds.includes(hazard.id) : segments.some(([a, b]) =>
        Array.from({ length: 9 }, (_, i) => ({
          lat: a.lat + ((b.lat - a.lat) * i) / 8,
          lon: a.lon + ((b.lon - a.lon) * i) / 8,
        })).some((sample) => pointInPolygon(sample, hazard.coordinates)),
      );
      if (hits) crossed += hazard.severity === 'high' ? 2 : 1;
    }
    const riskScore = Math.min(100, 8 + crossed * 24 + Math.max(0, segments.length - 3) * 2);
    const riskNotes = crossed
      ? [`Route intersects ${crossed} illustrative terrain watch zone(s).`, 'Terrain zones are not derived from a validated slope model.']
      : ['No seeded terrain watch zones intersect the sampled route.', 'This heuristic is not an EVA safety assessment.'];
    return { distanceKm: Number(total.toFixed(2)), riskScore, riskNotes, nearbyPois, terrainMethod: spatial ? 'postgis-jezero' : 'heuristic' };
  }
}
