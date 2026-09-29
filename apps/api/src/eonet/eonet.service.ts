import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import type { EonetQueryDto } from './dto/eonet-query.dto';
import type { EarthEventSummary, EonetEvent, EonetEventsResponse } from './eonet.types';

type CacheEntry = { expires: number; body: unknown };

@Injectable()
export class EonetService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfigService) {}

  private eonet(): AppConfig['eonet'] {
    return this.config.get<AppConfig['eonet']>('eonet')!;
  }

  private retries(): number {
    return this.config.get<number>('httpRetryCount') ?? 2;
  }

  async getEvents(query: EonetQueryDto = {}): Promise<unknown> {
    return this.fetchJson('/events', this.withDefaults(query));
  }

  async getEventsGeoJson(query: EonetQueryDto = {}): Promise<unknown> {
    return this.fetchJson('/events/geojson', this.withDefaults(query));
  }

  async getEventById(id: string): Promise<unknown> {
    return this.fetchJson(`/events/${encodeURIComponent(id)}`);
  }

  async getCategories(): Promise<unknown> {
    return this.fetchJson('/categories');
  }

  async getCategory(id: string, query: EonetQueryDto = {}): Promise<unknown> {
    return this.fetchJson(`/categories/${encodeURIComponent(id)}`, this.withDefaults(query));
  }

  async getSources(): Promise<unknown> {
    return this.fetchJson('/sources');
  }

  async getLayers(): Promise<unknown> {
    return this.fetchJson('/layers');
  }

  async getLayersByCategory(categoryId: string): Promise<unknown> {
    return this.fetchJson(`/layers/${encodeURIComponent(categoryId)}`);
  }

  async getMagnitudes(): Promise<unknown> {
    return this.fetchJson('/magnitudes');
  }

  /** Compact EARTH-labeled summaries for landing UI and agent tool. */
  async listEarthEventSummaries(query: EonetQueryDto = {}): Promise<EarthEventSummary[]> {
    const payload = (await this.getEvents(this.withDefaults(query))) as EonetEventsResponse;
    const events = payload.events ?? [];
    return events.map((event) => this.toSummary(event));
  }

  private toSummary(event: EonetEvent): EarthEventSummary {
    const geom = event.geometry?.[0];
    let lat: number | undefined;
    let lon: number | undefined;
    if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
      lon = Number(geom.coordinates[0]);
      lat = Number(geom.coordinates[1]);
    }
    return {
      id: event.id,
      title: event.title,
      category: event.categories?.[0]?.title ?? 'Unknown',
      date: geom?.date,
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
      sources: (event.sources ?? []).map((source) => ({ id: source.id, url: source.url })),
      closed: Boolean(event.closed),
      label: 'EARTH',
      provider: 'EONET',
    };
  }

  private withDefaults(query: EonetQueryDto): EonetQueryDto {
    const defaults = this.eonet();
    return {
      ...query,
      status: query.status ?? defaults.defaultStatus,
      limit: query.limit ?? String(defaults.defaultLimit),
      days: query.days ?? String(defaults.defaultDays),
    };
  }

  private buildUrl(path: string, query: EonetQueryDto = {}): string {
    const base = this.eonet().baseUrl.replace(/\/$/, '');
    const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async fetchJson(path: string, query: EonetQueryDto = {}): Promise<unknown> {
    const url = this.buildUrl(path, query);
    const cached = this.cache.get(url);
    const now = Date.now();
    if (cached && cached.expires > now) return cached.body;
    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) this.cache.delete(key);
    }

    const timeoutMs = this.eonet().timeoutMs;
    const retries = this.retries();
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error(`EONET HTTP ${response.status}`);
        const body = await response.json();
        this.cache.set(url, { expires: now + this.eonet().cacheTtlSec * 1000, body });
        while (this.cache.size > 250) this.cache.delete(this.cache.keys().next().value!);
        return body;
      } catch (error) {
        lastError = error;
      }
    }
    throw new ServiceUnavailableException({
      error: { code: 'EONET_UPSTREAM', message: `EONET request failed after retries: ${String(lastError)}` },
    });
  }
}
