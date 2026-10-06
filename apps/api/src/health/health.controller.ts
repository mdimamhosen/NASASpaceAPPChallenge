import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { stat } from 'node:fs/promises';
import { DataPathService } from '../common/data-path';

/** Data products the API serves from disk. `required` ones make /health/ready fail when missing. */
const PRODUCTS = [
  { key: 'places', path: 'perseverance/best_interp.csv', required: true, refresh: 'pnpm refresh:nasa' },
  { key: 'dem-grid', path: 'jezero/pds-orbital-dem-grid.json', required: true, refresh: 'pnpm refresh:nasa' },
  { key: 'layers', path: 'layers.json', required: true, refresh: 'checked in' },
  { key: 'opendata-catalog', path: 'opendata/catalog.json', required: false, refresh: 'pnpm refresh:opendata' },
  { key: 'opendata-hirise-dtm', path: 'opendata/hirise-dtm.json', required: false, refresh: 'pnpm refresh:opendata' },
  { key: 'opendata-iau-features', path: 'opendata/iau-features.json', required: false, refresh: 'pnpm refresh:opendata' },
  { key: 'rag-index', path: 'rag/index.json', required: false, refresh: 'rebuilt on API start' },
] as const;

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly dataPath: DataPathService) {}

  @Get()
  status() {
    return { ok: true, service: 'mars-explorer-api' };
  }

  /** Readiness: every data product with size and age, so a deploy can tell "up" from "serving real data". */
  @Get('ready')
  async ready() {
    const products = await Promise.all(PRODUCTS.map(async (p) => {
      const info = await stat(this.dataPath.resolve(p.path)).catch(() => null);
      return { key: p.key, path: `data/${p.path}`, required: p.required, present: Boolean(info), bytes: info?.size ?? 0, modifiedAt: info?.mtime.toISOString() ?? null, refresh: p.refresh };
    }));
    const missing = products.filter((p) => p.required && !p.present).map((p) => p.key);
    const body = { ok: !missing.length, service: 'mars-explorer-api', uptimeSec: Math.round(process.uptime()), missing, degraded: products.filter((p) => !p.required && !p.present).map((p) => p.key), products };
    if (missing.length) throw new ServiceUnavailableException(body);
    return body;
  }
}
