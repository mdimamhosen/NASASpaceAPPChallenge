import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import type { EonetQueryDto } from './dto/eonet-query.dto';
import { EonetDurableStore } from './eonet-durable.store';
import type { EonetProvenance } from '@mars-explorer/shared';
import type { EarthEventSummary, EonetEvent, EonetEventsResponse } from './eonet.types';

type MemoryEntry = { expires: number; body: unknown; durableKey: string; provenance: EonetProvenance };

@Injectable()
export class EonetService implements OnModuleInit {
  private readonly log = new Logger(EonetService.name);
  private readonly cache = new Map<string, MemoryEntry>();
  private warming?: Promise<void>;
  private readonly provenance = new Map<string, EonetProvenance>();

  constructor(
    private readonly config: ConfigService,
    private readonly durable: EonetDurableStore,
  ) {}

  private eonet(): AppConfig['eonet'] {
    return this.config.get<AppConfig['eonet']>('eonet')!;
  }

  private retries(): number {
    return this.config.get<number>('httpRetryCount') ?? 2;
  }

  async onModuleInit() {
    this.warming = this.warmFullCatalog().catch((error) => {
      this.log.warn(`EONET warm failed (will retry on request): ${String(error)}`);
    });
  }

  /** Prefetch full open catalog so mobile / flaky networks can serve last-good immediately. */
  private async warmFullCatalog() {
    const jobs = [
      this.getEvents({ status: 'open', limit: '500', days: '30' }),
      this.getEventsGeoJson({ status: 'open', limit: '500', days: '30' }),
      this.getCategories(),
      this.getSources(),
      this.getLayers(),
      this.getMagnitudes(),
    ];
    const results = await Promise.allSettled(jobs);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    this.log.log(`EONET warm complete: ${ok}/${results.length} snapshots ready`);
  }

  async getProvenance(query: EonetQueryDto = {}): Promise<EonetProvenance> {
    const normalized = this.withDefaults(query);
    await this.getEvents(normalized);
    return this.provenance.get(this.buildUrl('/events', normalized))!;
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
    if (this.warming) await this.warming.catch(() => undefined);
    const payload = (await this.getEvents(this.withDefaults(query))) as EonetEventsResponse;
    const events = payload.events ?? [];
    return events.map((event) => this.toSummary(event));
  }

  private toSummary(event: EonetEvent): EarthEventSummary {
    const geometries = event.geometry ?? [];
    const geom = [...geometries].reverse().find((item) => item.type === 'Point') ?? geometries.at(-1);
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
      categoryId: String(event.categories?.[0]?.id ?? 'unknown'),
      date: geom?.date,
      firstDate: geometries[0]?.date,
      lastDate: geometries.at(-1)?.date,
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
      geometryCount: geometries.length,
      magnitudeValue: geom?.magnitudeValue ?? event.magnitudeValue ?? undefined,
      magnitudeUnit: geom?.magnitudeUnit ?? event.magnitudeUnit ?? undefined,
      sources: (event.sources ?? []).map((source) => ({ id: source.id, url: source.url, title: source.title })),
      closed: Boolean(event.closed),
      closedAt: event.closed ?? undefined,
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

  private durableKey(url: string): string {
    return createSafeKey(url);
  }

  private async fetchJson(path: string, query: EonetQueryDto = {}): Promise<unknown> {
    const url = this.buildUrl(path, query);
    const durableKey = this.durableKey(url);
    const cached = this.cache.get(url);
    const now = Date.now();
    if (cached && cached.expires > now) { this.provenance.set(url, {...cached.provenance, servedFromCache:true, storage:'memory'}); return cached.body; }

    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) this.cache.delete(key);
    }

    const timeoutMs = this.eonet().timeoutMs;
    const retries = this.retries();
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`EONET HTTP ${response.status}`);
        const body = await response.json();
        const persisted = await this.durable.write(durableKey, body, url);
        const provenance: EonetProvenance = { fetchedAt: persisted.fetchedAt, contentHash: persisted.contentHash, sourceUrl: url, servedFromCache: false, storage: 'upstream' };
        this.provenance.set(url, provenance);
        this.cache.set(url, { provenance,
          expires: now + this.eonet().cacheTtlSec * 1000,
          body: persisted.body,
          durableKey,
        });
        while (this.cache.size > 250) this.cache.delete(this.cache.keys().next().value!);
        return persisted.body;
      } catch (error) {
        lastError = error;
      }
    }

    const memoryStale = this.cache.get(url)?.body;
    if (memoryStale !== undefined) {
      this.log.warn(`EONET upstream failed; serving in-memory last-good for ${path}`);
      const entry = this.cache.get(url)!; this.provenance.set(url, {...entry.provenance, servedFromCache:true, storage:'memory'});
      return memoryStale;
    }

    const disk = await this.durable.read(durableKey);
    if (disk) {
      const provenance: EonetProvenance = { fetchedAt: disk.fetchedAt, contentHash: disk.contentHash, sourceUrl: url, servedFromCache:true, storage:'durable' };
      this.provenance.set(url, provenance);
      this.cache.set(url, { provenance,
        expires: now + this.eonet().cacheTtlSec * 1000,
        body: disk.body,
        durableKey,
      });
      this.log.warn(`EONET upstream failed; serving durable snapshot from ${disk.fetchedAt} for ${path}`);
      return disk.body;
    }

    throw new ServiceUnavailableException({
      error: {
        code: 'EONET_UPSTREAM',
        message: `EONET request failed after retries and no durable cache: ${String(lastError)}`,
      },
    });
  }
}

function createSafeKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname.replace(/\//g, '_')}_${[...parsed.searchParams.entries()]
      .map(([k, v]) => `${k}-${v}`)
      .join('_') || 'default'}`;
  } catch {
    return url.slice(0, 120);
  }
}
