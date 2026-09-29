import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import type { RouteWaypoint } from '@mars-explorer/shared';

@Injectable()
export class JezeroSpatialService implements OnModuleDestroy {
  private pool?: Pool;
  private unavailable = false;

  async inspect(waypoints: RouteWaypoint[]): Promise<{ hazardIds: string[]; poiIds: string[] } | null> {
    if (process.env.POSTGIS_ENABLED !== 'true' || !process.env.DATABASE_URL || this.unavailable) return null;
    try {
      this.pool ??= new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1800, max: 2 });
      const line = JSON.stringify({ type: 'LineString', coordinates: waypoints.map(({ lon, lat }) => [lon, lat]) });
      // Mars-local equirectangular scale in km/degree near 18.44 N; illustrative only.
      const sql = `WITH route AS (SELECT ST_Scale(ST_SetSRID(ST_GeomFromGeoJSON($1), 0), 56.2, 59.15) AS geom)
        SELECT 'hazard' AS kind, h.id FROM jezero_hazards h, route r
        WHERE ST_Intersects(ST_Scale(h.geom, 56.2, 59.15), r.geom)
        UNION ALL
        SELECT 'poi' AS kind, p.id FROM jezero_pois p, route r
        WHERE ST_DWithin(ST_Scale(p.geom, 56.2, 59.15), r.geom, 2)`;
      const result = await this.pool.query<{ kind: string; id: string }>(sql, [line]);
      return { hazardIds: result.rows.filter((row) => row.kind === 'hazard').map((row) => row.id), poiIds: result.rows.filter((row) => row.kind === 'poi').map((row) => row.id) };
    } catch {
      this.unavailable = true;
      return null;
    }
  }

  async onModuleDestroy() { await this.pool?.end(); }
}
