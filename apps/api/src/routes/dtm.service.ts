import { Injectable } from '@nestjs/common';
import { readFileSync, statSync } from 'node:fs';
import type { DtmGrid, LatLon, RouteWaypoint, TerrainSample } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';
import { haversineKm } from './geo/haversine';

type Grid = {
  product: string;
  sourceUrl: string;
  labelUrl: string;
  latMin: number;
  lonMin: number;
  sampleSpacingDegrees: number;
  rows: Array<Array<number | null>>;
};

@Injectable()
export class DtmService {
  private grid!: Grid;
  private loadedMtimeMs = -1;
  private readonly gridPath: string;

  constructor(dataPath: DataPathService) {
    this.gridPath = dataPath.resolve('jezero/pds-orbital-dem-grid.json');
    this.reloadIfNeeded();
  }

  get sourceUrl() {
    this.reloadIfNeeded();
    return this.grid.labelUrl;
  }

  publicGrid(): DtmGrid {
    this.reloadIfNeeded();
    const { product, sourceUrl, labelUrl, latMin, lonMin, sampleSpacingDegrees, rows } = this.grid;
    return { product, sourceUrl, labelUrl, latMin, lonMin, sampleSpacingDegrees, rows, nonCertifying: true };
  }

  private reloadIfNeeded() {
    const stamp = statSync(this.gridPath).mtimeMs;
    if (stamp === this.loadedMtimeMs && this.grid) return;
    this.grid = JSON.parse(readFileSync(this.gridPath, 'utf8')) as Grid;
    this.loadedMtimeMs = stamp;
  }

  sample(point: LatLon): TerrainSample | null {
    this.reloadIfNeeded();
    const { latMin, lonMin, sampleSpacingDegrees: step, rows } = this.grid;
    const y = (point.lat - latMin) / step,
      x = (point.lon - lonMin) / step;
    const row = Math.floor(y),
      col = Math.floor(x);
    if (row < 0 || col < 0 || row + 1 >= rows.length || col + 1 >= rows[0].length) return null;
    const a = rows[row][col],
      b = rows[row][col + 1],
      c = rows[row + 1][col],
      d = rows[row + 1][col + 1];
    if ([a, b, c, d].some((v) => v == null || !Number.isFinite(v))) return null;
    const fx = x - col,
      fy = y - row;
    const elevationM = (a! * (1 - fx) + b! * fx) * (1 - fy) + (c! * (1 - fx) + d! * fx) * fy;
    const dx = haversineKm({ lat: point.lat, lon: lonMin + col * step }, { lat: point.lat, lon: lonMin + (col + 1) * step }) * 1000;
    const dy = haversineKm({ lat: latMin + row * step, lon: point.lon }, { lat: latMin + (row + 1) * step, lon: point.lon }) * 1000;
    const slopeDeg =
      (Math.atan(
        Math.hypot(((b! - a!) * (1 - fy) + (d! - c!) * fy) / dx, ((c! - a!) * (1 - fx) + (d! - b!) * fx) / dy),
      ) *
        180) /
      Math.PI;
    return { ...point, elevationM: Number(elevationM.toFixed(2)), slopeDeg: Number(slopeDeg.toFixed(2)) };
  }

  sampleRoute(waypoints: RouteWaypoint[]): { samples: TerrainSample[]; coverage: number } {
    const samples: TerrainSample[] = [];
    let attempted = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const a = waypoints[i - 1],
        b = waypoints[i];
      const count = Math.max(1, Math.ceil(haversineKm(a, b) / 0.12));
      for (let j = i === 1 ? 0 : 1; j <= count; j++) {
        attempted++;
        const t = j / count;
        const sample = this.sample({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
        if (sample) samples.push(sample);
      }
    }
    return { samples, coverage: attempted ? samples.length / attempted : 0 };
  }

  suggest(start: LatLon, end: LatLon): RouteWaypoint[] | null {
    this.reloadIfNeeded();
    const grid = this.grid,
      step = grid.sampleSpacingDegrees;
    const cell = (p: LatLon) => [Math.round((p.lat - grid.latMin) / step), Math.round((p.lon - grid.lonMin) / step)] as const;
    const [sy, sx] = cell(start),
      [ey, ex] = cell(end);
    const valid = (y: number, x: number) =>
      y >= 0 && x >= 0 && y < grid.rows.length && x < grid.rows[0].length && this.sample({ lat: grid.latMin + y * step, lon: grid.lonMin + x * step }) !== null;
    if (!valid(sy, sx) || !valid(ey, ex)) return null;
    const key = (y: number, x: number) => `${y}:${x}`,
      target = key(ey, ex);
    const open = [{ y: sy, x: sx, f: 0 }],
      cost = new Map([[key(sy, sx), 0]]),
      parent = new Map<string, string>();
    let loops = 0;
    while (open.length && loops++ < 15000) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!,
        currentKey = key(current.y, current.x);
      if (currentKey === target) {
        const cells = [target];
        while (parent.has(cells[0])) cells.unshift(parent.get(cells[0])!);
        const reduced = cells.filter((_, i) => i === 0 || i === cells.length - 1 || i % 4 === 0);
        return [
          start,
          ...reduced.slice(1, -1).map((entry, i) => {
            const [y, x] = entry.split(':').map(Number);
            return { id: `suggest-${i}`, lat: grid.latMin + y * step, lon: grid.lonMin + x * step };
          }),
          end,
        ].map((p, i) => ({ id: `suggest-${i}`, lat: p.lat, lon: p.lon }));
      }
      for (const [dy, dx] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const y = current.y + dy,
          x = current.x + dx,
          k = key(y, x);
        if (!valid(y, x)) continue;
        const slope = this.sample({ lat: grid.latMin + y * step, lon: grid.lonMin + x * step })!.slopeDeg ?? 0;
        const next = cost.get(currentKey)! + Math.hypot(dx, dy) * (1 + Math.min(12, slope) / 8);
        if (next >= (cost.get(k) ?? Infinity)) continue;
        cost.set(k, next);
        parent.set(k, currentKey);
        open.push({ y, x, f: next + Math.hypot(ex - x, ey - y) });
      }
    }
    return null;
  }
}
