import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { PlacesPoint, PlacesTrack, POI, RegionData } from '@mars-explorer/shared';
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
    const swim = await this.readJson<{ layers: Record<string, { latTop: number; lonLeft: number; stepDeg: number; rows: Array<Array<number | null>> }> }>('resources/swim-ice-jezero.json').catch(() => null);
    if (!includeDemo) return {
      id: 'jezero', name: 'Jezero Crater', center: { lat: 18.44, lon: 77.45 },
      bounds: [[18.26, 77.24], [18.62, 77.72]], demoOverlay: false,
      pois: verified, hazards: [], footprints: [], resources: swim ? { swimIce: { url: 'https://swim.psi.edu/', layers: swim.layers } } : undefined,
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
      resources: swim ? { swimIce: { url: 'https://swim.psi.edu/', layers: swim.layers } } : undefined,
      pois: [...verified, ...places.features.map((f) => ({ ...f.properties, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], sourceKind: 'DEMO' as const }))],
      hazards: hazardData.features.map((f) => ({ id: f.properties.id, name: f.properties.name, severity: f.properties.severity, coordinates: f.geometry.coordinates[0].map(([lon, lat]) => ({ lat, lon })) })),
      footprints: [],
    };
  }

  async getGale(): Promise<RegionData> {
    const track = (await this.places.curiosity().catch(() => ({ points: [] as PlacesPoint[], sourceUrl: '', retrievedAt: '', latestSol: 0, label: 'MARS', provider: 'PLACES', quality: 'interpolated_published' }))) as PlacesTrack;
    const verified = [0, 1000, 2000, 3000].filter((s) => track.points.some((p) => p.sol >= s)).map((sol) => {
      const point = track.points.reduce((c, current) => Math.abs(current.sol - sol) < Math.abs(c.sol - sol) ? current : c);
      return { id: `places-sol-${point.sol}`, name: point.sol === 0 ? 'Curiosity landing localization' : `Curiosity · Sol ${point.sol} localization`, lat: point.lat, lon: point.lon, category: 'mission' as const, summary: `Curiosity drive-end localization at sol ${point.sol} from NASA's MSL location map waypoints. An archive position, not live telemetry.`, sourceUrl: track.sourceUrl, mission: 'NASA MSL / LOCATION MAP', sourceKind: 'NASA_PLACES' as const };
    });
    return {
      id: 'gale', name: 'Gale Crater', center: { lat: -4.59, lon: 137.44 },
      bounds: [[-4.9, 137.3], [-4.5, 137.5]], demoOverlay: false,
      pois: verified, hazards: [], footprints: [],
    };
  }


  private async readJson<T>(relative: string): Promise<T> {
    return JSON.parse(await readFile(this.dataPath.resolve(relative), 'utf8')) as T;
  }
}
