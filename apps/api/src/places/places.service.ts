import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { PlacesPoint, PlacesTrack } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';

type ProductMeta = { sourceUrl: string; retrievedAt: string };

@Injectable()
export class PlacesService {
  private loaded?: Promise<PlacesTrack>;

  constructor(private readonly dataPath: DataPathService) {}

  async perseverance(fromSol = 0, toSol = Number.MAX_SAFE_INTEGER): Promise<PlacesTrack> {
    this.loaded ??= this.load();
    const track = await this.loaded;
    return { ...track, points: track.points.filter((point) => point.sol >= fromSol && point.sol <= toSol) };
  }

  private async load(): Promise<PlacesTrack> {
    const [csv, metadata] = await Promise.all([
      readFile(this.dataPath.resolve('perseverance/best_interp.csv'), 'utf8'),
      readFile(this.dataPath.resolve('perseverance/SOURCE.json'), 'utf8').then((raw) => JSON.parse(raw) as ProductMeta),
    ]);
    const lines = csv.trim().split(/\r?\n/);
    const header = lines.shift()!.split(',');
    const field = (name: string) => {
      const index = header.indexOf(name);
      if (index < 0) throw new Error(`PLACES CSV lacks ${name}`);
      return index;
    };
    const frame = field('frame');
    const sol = field('sol');
    const latitude = field('planetocentric_latitude');
    const longitude = field('longitude');
    const elevation = field('elevation');
    const clock = field('sclk');
    const bySol = new Map<number, PlacesPoint>();
    for (const line of lines) {
      const columns = line.split(',');
      if (columns[frame] !== 'ROVER') continue;
      const point: PlacesPoint = {
        sol: Number(columns[sol]),
        lat: Number(columns[latitude]),
        lon: Number(columns[longitude]),
        elevationM: Number(columns[elevation]),
        sclk: Number(columns[clock]),
      };
      if (!Number.isInteger(point.sol) || point.sol < 0 || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      bySol.set(point.sol, point); // Last published localization for each populated sol.
    }
    const points = [...bySol.values()].sort((a, b) => a.sol - b.sol);
    return {
      provider: 'PLACES', label: 'MARS', quality: 'interpolated_published',
      sourceUrl: metadata.sourceUrl, retrievedAt: metadata.retrievedAt,
      latestSol: points.at(-1)?.sol ?? 0, points,
    };
  }
}
