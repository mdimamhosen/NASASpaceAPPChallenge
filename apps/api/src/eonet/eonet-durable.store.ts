import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { DataPathService } from '../common/data-path';

export type DurableEntry = {
  body: unknown;
  contentHash: string;
  fetchedAt: string;
  sourceUrl: string;
  /** Served from data/fixtures rather than a cache this machine wrote. */
  fixture?: boolean;
};

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS eonet_cache (
  cache_key TEXT PRIMARY KEY,
  body JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_url TEXT
);
`;

@Injectable()
export class EonetDurableStore implements OnModuleDestroy {
  private readonly log = new Logger(EonetDurableStore.name);
  private pool?: Pool;
  private dbReady = false;
  private dbUnavailable = false;

  constructor(private readonly dataPath: DataPathService) {}

  hash(body: unknown): string {
    return createHash('sha256').update(JSON.stringify(body)).digest('hex');
  }

  async read(cacheKey: string): Promise<DurableEntry | null> {
    const fromDb = await this.readDb(cacheKey);
    if (fromDb) return fromDb;
    return (await this.readFile(cacheKey)) ?? this.readFixture(cacheKey);
  }

  async write(cacheKey: string, body: unknown, sourceUrl: string): Promise<DurableEntry> {
    const contentHash = this.hash(body);
    const existing = await this.read(cacheKey);
    if (existing && existing.contentHash === contentHash) {
      return existing;
    }
    const entry: DurableEntry = {
      body,
      contentHash,
      fetchedAt: new Date().toISOString(),
      sourceUrl,
    };
    await Promise.all([this.writeFile(cacheKey, entry), this.writeDb(cacheKey, entry)]);
    return entry;
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  /** Last tier: committed demo fixtures (data/fixtures/eonet), so a fresh clone still answers offline. */
  private async readFixture(cacheKey: string): Promise<DurableEntry | null> {
    const safe = cacheKey.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
    try {
      const entry = JSON.parse(await readFile(this.dataPath.resolve('fixtures', 'eonet', `${safe || 'snapshot'}.json`), 'utf8')) as DurableEntry;
      return entry?.body === undefined ? null : { ...entry, fixture: true };
    } catch { return null; }
  }

  private filePath(cacheKey: string): string {
    const safe = cacheKey.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
    return this.dataPath.resolve('eonet', `${safe || 'snapshot'}.json`);
  }

  private async readFile(cacheKey: string): Promise<DurableEntry | null> {
    try {
      const raw = await readFile(this.filePath(cacheKey), 'utf8');
      const parsed = JSON.parse(raw) as DurableEntry;
      if (!parsed?.body || !parsed.contentHash) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private async writeFile(cacheKey: string, entry: DurableEntry): Promise<void> {
    try {
      const dir = this.dataPath.resolve('eonet');
      await mkdir(dir, { recursive: true });
      await writeFile(this.filePath(cacheKey), JSON.stringify(entry), 'utf8');
    } catch (error) {
      this.log.warn(`EONET file cache write failed: ${String(error)}`);
    }
  }

  private async ensureDb(): Promise<boolean> {
    if (this.dbUnavailable) return false;
    if (this.dbReady) return true;
    const url = process.env.DATABASE_URL;
    if (!url) {
      this.dbUnavailable = true;
      return false;
    }
    try {
      this.pool ??= new Pool({ connectionString: url, connectionTimeoutMillis: 2500, max: 2 });
      await this.pool.query(BOOTSTRAP_SQL);
      this.dbReady = true;
      this.log.log('EONET Postgres cache ready');
      return true;
    } catch (error) {
      this.dbUnavailable = true;
      this.log.warn(`EONET Postgres cache unavailable: ${String(error)}`);
      return false;
    }
  }

  private async readDb(cacheKey: string): Promise<DurableEntry | null> {
    if (!(await this.ensureDb()) || !this.pool) return null;
    try {
      const result = await this.pool.query<{
        body: unknown;
        content_hash: string;
        fetched_at: Date;
        source_url: string | null;
      }>('SELECT body, content_hash, fetched_at, source_url FROM eonet_cache WHERE cache_key = $1', [cacheKey]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        body: row.body,
        contentHash: row.content_hash,
        fetchedAt: new Date(row.fetched_at).toISOString(),
        sourceUrl: row.source_url ?? '',
      };
    } catch (error) {
      this.log.warn(`EONET Postgres read failed: ${String(error)}`);
      return null;
    }
  }

  private async writeDb(cacheKey: string, entry: DurableEntry): Promise<void> {
    if (!(await this.ensureDb()) || !this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO eonet_cache (cache_key, body, content_hash, fetched_at, source_url)
         VALUES ($1, $2::jsonb, $3, $4::timestamptz, $5)
         ON CONFLICT (cache_key) DO UPDATE SET
           body = EXCLUDED.body,
           content_hash = EXCLUDED.content_hash,
           fetched_at = EXCLUDED.fetched_at,
           source_url = EXCLUDED.source_url
         WHERE eonet_cache.content_hash IS DISTINCT FROM EXCLUDED.content_hash`,
        [cacheKey, JSON.stringify(entry.body), entry.contentHash, entry.fetchedAt, entry.sourceUrl],
      );
    } catch (error) {
      this.log.warn(`EONET Postgres write failed: ${String(error)}`);
    }
  }
}
