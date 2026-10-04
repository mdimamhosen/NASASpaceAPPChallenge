import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { POI, RegionData } from '@mars-explorer/shared';
import { PlacesService } from '../places/places.service';
import { DataPathService } from '../common/data-path';

@Injectable()
export class RegionsService {
  constructor(private readonly dataPath: DataPathService, private readonly places: PlacesService) {}

  async getJezero(includeDemo = false): Promise<RegionData> {
    const track = await this.places.perseverance();
    const verified: POI[] = [0,400,700,1000].map((sol) => {
      const point = track.points.reduce((closest,current)=>Math.abs(current.sol-sol)<Math.abs(closest.sol-sol)?current:closest);
      return { id:`places-sol-${point.sol}`, name:point.sol===0?'Perseverance landing localization':`Perseverance · Sol ${point.sol} localization`, lat:point.lat, lon:point.lon, category:'mission' as const, summary:`Published interpolated ROVER localization from NASA PDS PLACES at sol ${point.sol}. This is an archive position, not live telemetry or a certified walking target.`, sourceUrl:track.sourceUrl, mission:'NASA MARS 2020 / PLACES', sourceKind:'NASA_PLACES' as const };
    });
    if (!includeDemo) return {
      id: 'jezero', name: 'Jezero Crater', center: { lat: 18.44, lon: 77.45 },
      bounds: [[18.26, 77.24], [18.62, 77.72]], demoOverlay: false,
      pois: verified, hazards: [], footprints: [],
    };
    const [places, hazardData] = await Promise.all([
      this.readJson<{ features: Array<{ properties: POI; geometry: { coordinates: [number, number] } }> }>('jezero/pois.geojson'),
      this.readJson<{ features: Array<{ properties: { id: string; name: string; severity: 'moderate' | 'high' }; geometry: { coordinates: [number, number][][] } }> }>('jezero/hazards.geojson'),
    ]);
    return {
      id: 'jezero',
      name: 'Jezero Crater',
      center: { lat: 18.44, lon: 77.45 },
      bounds: [[18.26, 77.24], [18.62, 77.72]],
      demoOverlay: true,
      pois: [...verified, ...places.features.map(({ properties, geometry }) => ({ ...properties, lon: geometry.coordinates[0], lat: geometry.coordinates[1], sourceKind: 'DEMO' as const }))],
      hazards: hazardData.features.map(({ properties, geometry }) => ({
        ...properties,
        coordinates: geometry.coordinates[0].map(([lon, lat]) => ({ lon, lat })),
      })),
      // These boxes are schematic rather than published product footprints.
      // Do not expose them as image coverage polygons on NASA Trek.
      footprints: [],
    };
  }

  private async readJson<T>(relative: string): Promise<T> {
    return JSON.parse(await readFile(this.dataPath.resolve(relative), 'utf8')) as T;
  }
}
