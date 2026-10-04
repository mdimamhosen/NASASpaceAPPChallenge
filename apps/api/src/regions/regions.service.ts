import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { POI, RegionData } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';

@Injectable()
export class RegionsService {
  constructor(private readonly dataPath: DataPathService) {}

  async getJezero(includeDemo = false): Promise<RegionData> {
    if (!includeDemo) return {
      id: 'jezero', name: 'Jezero Crater', center: { lat: 18.44, lon: 77.45 },
      bounds: [[18.26, 77.24], [18.62, 77.72]], demoOverlay: false,
      pois: [], hazards: [], footprints: [],
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
      pois: places.features.map(({ properties, geometry }) => ({ ...properties, lon: geometry.coordinates[0], lat: geometry.coordinates[1] })),
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
