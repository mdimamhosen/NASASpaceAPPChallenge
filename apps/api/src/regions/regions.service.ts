import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { POI, RegionData } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';

@Injectable()
export class RegionsService {
  constructor(private readonly dataPath: DataPathService) {}

  async getJezero(): Promise<RegionData> {
    const [places, hazardData, footprintData] = await Promise.all([
      this.readJson<{ features: Array<{ properties: POI; geometry: { coordinates: [number, number] } }> }>('jezero/pois.geojson'),
      this.readJson<{ features: Array<{ properties: { id: string; name: string; severity: 'moderate' | 'high' }; geometry: { coordinates: [number, number][][] } }> }>('jezero/hazards.geojson'),
      this.readJson<{ features: Array<{ properties: { id: string; name: string; instrument: string; sourceUrl: string }; geometry: { coordinates: [number, number][][] } }> }>('jezero/hirise-footprints.geojson'),
    ]);
    return {
      id: 'jezero',
      name: 'Jezero Crater',
      center: { lat: 18.44, lon: 77.45 },
      bounds: [[18.26, 77.24], [18.62, 77.72]],
      pois: places.features.map(({ properties, geometry }) => ({ ...properties, lon: geometry.coordinates[0], lat: geometry.coordinates[1] })),
      hazards: hazardData.features.map(({ properties, geometry }) => ({
        ...properties,
        coordinates: geometry.coordinates[0].map(([lon, lat]) => ({ lon, lat })),
      })),
      footprints: footprintData.features.map(({ properties, geometry }) => ({
        ...properties,
        coordinates: geometry.coordinates[0].map(([lon, lat]) => ({ lon, lat })),
      })),
    };
  }

  private async readJson<T>(relative: string): Promise<T> {
    return JSON.parse(await readFile(this.dataPath.resolve(relative), 'utf8')) as T;
  }
}
