import { Injectable, Logger } from '@nestjs/common';
import { readFile, stat } from 'node:fs/promises';
import type { HiriseDtm, LatLon, MarsFeature, MissionLanding, OpenCatalogResult, OpenDataProduct, OpenDataset, RouteOpenData } from '@mars-explorer/shared';
import { DATA_NASA_MARS_URL, NASA_MARS_LANDINGS } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';
import { haversineKm, pointInPolygon, pointSegmentDistanceKm } from '../routes/geo/haversine';
import { type Box, detectMission, dtmsInView, featuresInView, routeContext, searchCatalog } from './opendata.logic';

type Snapshot<T> = { fetchedAt: string; source: string; dataset?: string; items: T[] };
type SourceFile = Record<string, Omit<OpenDataProduct, 'key' | 'usedFor' | 'datasetUrl'> & { datasetUrl?: string }>;

const CKAN = 'https://data.nasa.gov/api/3/action/package_search';
const LIVE_TTL_MS = 10 * 60_000;
const USED_FOR: Record<string, string> = {
  catalog: 'Open Data catalog page, mission data shelves on landing-site markers, agent tool nasa_open_data',
  hiriseDtm: 'HiRISE DTM footprint layer on the Mars map; DTM coverage of drawn routes',
  iauFeatures: 'IAU feature-name layer on the Mars map; named features along routes and in briefings; agent tool named_features',
};

@Injectable()
export class OpenDataService {
  private readonly log = new Logger(OpenDataService.name);
  private readonly files = new Map<string, { mtimeMs: number; value: unknown }>();
  private readonly live = new Map<string, { at: number; value: OpenCatalogResult }>();

  constructor(private readonly dataPath: DataPathService) {}

  /** Reads a snapshot and re-reads it only when the file changes (refresh script rewrites them in place). */
  private async load<T>(relative: string): Promise<T> {
    const path = this.dataPath.resolve('opendata', relative);
    const { mtimeMs } = await stat(path);
    const cached = this.files.get(path);
    if (cached && cached.mtimeMs === mtimeMs) return cached.value as T;
    const value = JSON.parse(await readFile(path, 'utf8')) as T;
    this.files.set(path, { mtimeMs, value });
    return value;
  }

  private catalogSnapshot() { return this.load<Snapshot<OpenDataset> & { total: number }>('catalog.json'); }
  private featureSnapshot() { return this.load<Snapshot<MarsFeature>>('iau-features.json'); }
  private dtmSnapshot() { return this.load<Snapshot<HiriseDtm>>('hirise-dtm.json'); }

  async catalog(q = '', mission?: string, limit = 24, offset = 0, source: 'snapshot' | 'live' = 'snapshot'): Promise<OpenCatalogResult> {
    const snap = await this.catalogSnapshot();
    // Mission tags are inferred locally, so a mission filter always uses the snapshot.
    if (source === 'live' && !mission) {
      try { return await this.liveCatalog(q, limit, offset, snap); }
      catch (error) {
        this.log.warn(`data.nasa.gov live search failed, serving snapshot: ${String(error)}`);
        const fallback = this.fromSnapshot(snap, q, mission, limit, offset);
        return { ...fallback, provenance: { ...fallback.provenance, note: 'data.nasa.gov did not respond; showing the last snapshot.' } };
      }
    }
    return this.fromSnapshot(snap, q, mission, limit, offset);
  }

  private fromSnapshot(snap: Snapshot<OpenDataset>, q: string, mission: string | undefined, limit: number, offset: number): OpenCatalogResult {
    const { hits, missions } = searchCatalog(snap.items, q, mission);
    return { total: hits.length, offset, items: hits.slice(offset, offset + limit), missions, provenance: { source: 'snapshot', fetchedAt: snap.fetchedAt, sourceUrl: DATA_NASA_MARS_URL } };
  }

  private async liveCatalog(q: string, limit: number, offset: number, snap: Snapshot<OpenDataset>): Promise<OpenCatalogResult> {
    const key = `${q}|${limit}|${offset}`;
    const hit = this.live.get(key);
    if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.value;
    const url = `${CKAN}?${new URLSearchParams({ fq: 'tags:mars', q, rows: String(limit), start: String(offset) })}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'mars-explorer/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { result: { count: number; results: Array<{ name: string; title: string; notes?: string; license_title?: string; metadata_modified?: string; extras?: Array<{ key: string; value: string }>; resources?: Array<{ url?: string }> }> } };
    const known = new Map(snap.items.map((item) => [item.id, item]));
    const items = body.result.results.map((pkg): OpenDataset => {
      const extras = Object.fromEntries((pkg.extras ?? []).map((e) => [e.key, e.value]));
      return {
        id: pkg.name, title: pkg.title.replace(/\s+/g, ' ').trim(), notes: (pkg.notes ?? '').replace(/\s+/g, ' ').trim().slice(0, 320),
        publisher: extras.publisher ?? '', landingPage: extras.landingPage ?? '', identifier: extras.identifier ?? '',
        modified: extras.modified ?? pkg.metadata_modified?.slice(0, 10) ?? '', license: pkg.license_title ?? '',
        url: `https://data.nasa.gov/dataset/${pkg.name}`, resources: (pkg.resources ?? []).map((r) => r.url).filter((u): u is string => Boolean(u)).slice(0, 4),
        missions: known.get(pkg.name)?.missions ?? [],
      };
    });
    const missions = new Map<string, number>();
    for (const item of items) for (const m of item.missions) missions.set(m, (missions.get(m) ?? 0) + 1);
    const value: OpenCatalogResult = { total: body.result.count, offset, items, missions: [...missions].map(([mission, count]) => ({ mission, count })), provenance: { source: 'live', fetchedAt: new Date().toISOString(), sourceUrl: url } };
    if (this.live.size > 200) this.live.delete(this.live.keys().next().value!);
    this.live.set(key, { at: Date.now(), value });
    return value;
  }

  /** For plain-language agent goals: strict match first, then rank by how many terms each dataset matches. */
  async searchForAgent(query: string, mission = detectMission(query), limit = 6) {
    const snap = await this.catalogSnapshot();
    const strict = searchCatalog(snap.items, query, mission);
    const loose = strict.hits.length ? strict : searchCatalog(snap.items, query, mission, 'any');
    // A named mission with no term match still answers "what exists for X": list that mission's records.
    const { hits, missions } = loose.hits.length || !mission ? loose : searchCatalog(snap.items, '', mission);
    return { total: hits.length, items: hits.slice(0, limit), missions, mission, fetchedAt: snap.fetchedAt };
  }

  async dataset(id: string): Promise<OpenDataset | undefined> {
    return (await this.catalogSnapshot()).items.find((item) => item.id === id);
  }

  async features(box: Box, zoom: number) { return featuresInView((await this.featureSnapshot()).items, box, zoom); }
  async dtms(box: Box) { return dtmsInView((await this.dtmSnapshot()).items, box); }

  async nearestFeatures(point: LatLon, limit = 8, type?: string) {
    const items = (await this.featureSnapshot()).items.filter((f) => !type || f.type.toLowerCase() === type.toLowerCase());
    return items.map((f) => ({ ...f, distanceKm: Number(haversineKm(point, f).toFixed(1)) })).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit);
  }

  async findFeature(name: string) {
    const needle = name.trim().toLowerCase();
    return (await this.featureSnapshot()).items.find((f) => f.name.toLowerCase() === needle);
  }

  async landings(): Promise<MissionLanding[]> {
    const snap = await this.catalogSnapshot();
    return NASA_MARS_LANDINGS.map((site) => {
      const datasets = snap.items.filter((item) => item.missions.includes(site.mission));
      return { ...site, datasetCount: datasets.length, datasets: datasets.slice(0, 6).map(({ id, title, url }) => ({ id, title, url })), catalogUrl: `/opendata?mission=${encodeURIComponent(site.mission)}` };
    });
  }

  async routeContext(route: LatLon[]): Promise<RouteOpenData> {
    const [features, dtms, products] = await Promise.all([this.featureSnapshot(), this.dtmSnapshot(), this.products()]);
    const source = (key: string) => products.find((p) => p.key === key)?.datasetUrl ?? DATA_NASA_MARS_URL;
    return routeContext(route, features.items, dtms.items, { segmentKm: pointSegmentDistanceKm, inPolygon: pointInPolygon }, { features: source('iauFeatures'), dtm: source('hiriseDtm') });
  }

  async products(): Promise<OpenDataProduct[]> {
    const source = await this.load<SourceFile>('SOURCE.json');
    return Object.entries(source).map(([key, value]) => ({ key, ...value, datasetUrl: value.datasetUrl ?? value.sourceUrl, usedFor: USED_FOR[key] ?? '' }));
  }
}
