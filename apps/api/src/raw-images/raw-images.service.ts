import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RoverImage, RoverImagesResult, SourceLabel } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';
import { isOffline } from '../common/offline';

const SOURCE_URL = 'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020,ingenuity&ver=1.2&feedtype=json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type UpstreamImage = {
  imageid?: string;
  sol?: number;
  title?: string;
  date_taken_utc?: string;
  link?: string;
  camera?: { instrument?: string };
  image_files?: { small?: string; medium?: string; large?: string; full_res?: string };
};

type UpstreamBody = { images?: UpstreamImage[] };
type CacheEntry = { expires: number; result: RoverImagesResult };

@Injectable()
export class RawImagesService {
  private readonly log = new Logger(RawImagesService.name);
  private readonly memory = new Map<number, CacheEntry>();

  constructor(private readonly dataPath: DataPathService) {}

  async forSol(sol: number, limit = 12): Promise<RoverImagesResult> {
    if (!Number.isFinite(sol) || sol < 0 || sol > 20_000) throw new BadRequestException('sol must be 0–20000');
    const capped = Math.min(24, Math.max(1, Math.round(limit)));
    const rounded = Math.round(sol);

    const mem = this.memory.get(rounded);
    if (mem && mem.expires > Date.now() && !isOffline()) {
      return { ...mem.result, images: mem.result.images.slice(0, capped), source: 'cache' };
    }

    if (!isOffline()) {
      try {
        const live = await this.fetchLive(rounded, capped);
        this.memory.set(rounded, { expires: Date.now() + CACHE_TTL_MS, result: live });
        await this.writeCache(rounded, live).catch(() => undefined);
        return live;
      } catch (error) {
        this.log.warn(`raw-images live failed sol=${rounded}: ${String(error)}`);
      }
    }

    const disk = await this.readCache(rounded);
    if (disk) return { ...disk, images: disk.images.slice(0, capped), source: isOffline() ? 'offline' : 'cache' };

    const fixture = await this.readFixture(rounded);
    if (fixture) return { ...fixture, images: fixture.images.slice(0, capped), source: 'fixture', note: fixture.note ?? 'Committed demo fixture for offline / failed upstream.' };

    // Nearest fixture sol so Classroom Mode still shows photos.
    for (const fallback of [420, 400, 700, 0]) {
      const near = await this.readFixture(fallback);
      if (near) {
        return {
          ...near,
          sol: rounded,
          images: near.images.slice(0, capped),
          source: 'fixture',
          note: `No images for sol ${rounded}; showing fixture sol ${fallback}.`,
        };
      }
    }

    return {
      sol: rounded,
      images: [],
      source: 'fixture',
      sourceUrl: SOURCE_URL,
      fetchedAt: new Date().toISOString(),
      note: 'No Mars 2020 raw images available for this sol.',
    };
  }

  private async fetchLive(sol: number, limit: number): Promise<RoverImagesResult> {
    const url = `${SOURCE_URL}&num=${limit}&page=0&order=sol%20desc&condition_2=${sol}:sol:gte&condition_3=${sol}:sol:lte`;
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as UpstreamBody;
    const images = (body.images ?? []).map((img) => this.mapImage(img)).filter((img): img is RoverImage => !!img);
    return {
      sol,
      images,
      source: 'live' as SourceLabel,
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      note: 'Public Mars 2020 / Ingenuity raw images from mars.nasa.gov. Not live telemetry.',
    };
  }

  private mapImage(img: UpstreamImage): RoverImage | null {
    const id = img.imageid?.trim();
    const sol = Number(img.sol);
    const thumb = img.image_files?.small || img.image_files?.medium;
    const full = img.image_files?.medium || img.image_files?.large || img.image_files?.full_res || thumb;
    if (!id || !Number.isFinite(sol) || !full || !thumb) return null;
    const instrument = (img.camera?.instrument || 'UNKNOWN').toUpperCase();
    const category: RoverImage['category'] = /HELI|INGENUITY|LCAM|RCAM|NAV/i.test(id) && /INGENUITY|HELI/i.test(img.title || '')
      ? 'ingenuity'
      : /INGENUITY/i.test(img.title || '')
        ? 'ingenuity'
        : 'mars2020';
    return {
      id,
      sol,
      camera: instrument,
      title: (img.title || `${instrument} sol ${sol}`).trim(),
      earthDate: img.date_taken_utc?.slice(0, 10),
      imageUrl: full,
      thumbnailUrl: thumb,
      pageUrl: img.link || `https://mars.nasa.gov/mars2020/multimedia/raw-images/${id}`,
      category,
    };
  }

  private cachePath(sol: number) {
    return this.dataPath.resolve('cache', 'raw-images', `sol-${sol}.json`);
  }

  private fixturePath(sol: number) {
    return this.dataPath.resolve('fixtures', 'raw-images', `sol-${sol}.json`);
  }

  private async writeCache(sol: number, result: RoverImagesResult) {
    const path = this.cachePath(sol);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(result), 'utf8');
  }

  private async readCache(sol: number): Promise<RoverImagesResult | null> {
    try {
      const raw = JSON.parse(await readFile(this.cachePath(sol), 'utf8')) as RoverImagesResult;
      return Array.isArray(raw.images) ? raw : null;
    } catch {
      return null;
    }
  }

  private async readFixture(sol: number): Promise<RoverImagesResult | null> {
    try {
      const body = JSON.parse(await readFile(this.fixturePath(sol), 'utf8')) as UpstreamBody | RoverImagesResult;
      if ('images' in body && Array.isArray(body.images) && body.images[0] && 'imageUrl' in (body.images[0] as RoverImage)) {
        return body as RoverImagesResult;
      }
      const images = ((body as UpstreamBody).images ?? []).map((img) => this.mapImage(img)).filter((img): img is RoverImage => !!img);
      return {
        sol,
        images,
        source: 'fixture',
        sourceUrl: SOURCE_URL,
        fetchedAt: new Date().toISOString(),
        note: 'Committed demo fixture (mars.nasa.gov raw images snapshot).',
      };
    } catch {
      return null;
    }
  }
}
