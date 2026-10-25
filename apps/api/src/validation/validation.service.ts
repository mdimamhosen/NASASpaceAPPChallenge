import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { LatLon } from '@mars-explorer/shared';
import { conjunctionWindows, marsTime } from '@mars-explorer/shared';
import { DataPathService } from '../common/data-path';
import { PlacesService } from '../places/places.service';
import { DtmService } from '../routes/dtm.service';
import { haversineKm, pointSegmentDistanceKm } from '../routes/geo/haversine';
import { detectIntents, planTools } from '../agent/intents';
import { mulberry32, offsetStats, slopeStats, toolScore } from './validation.logic';

const LEGS: Array<[number, number]> = [[0, 400], [400, 700], [700, 1000]];
const RANDOM_LINES = 400, LINE_KM = 1, NEAR_KM = 1;
const MOLA_KM_PER_DEG = (Math.PI * 3389.5) / 180;

/** Validity evidence from data the app already holds: the real drive vs random lines, A* vs the real drive, tool choice, and science references. */
@Injectable()
export class ValidationService {
  private cache?: { at: number; report: unknown };
  constructor(private readonly places: PlacesService, private readonly dtm: DtmService, private readonly dataPath: DataPathService) {}

  async report() {
    if (this.cache && Date.now() - this.cache.at < 10 * 60_000) return this.cache.report;
    const track = (await this.places.perseverance()).points;
    const grid = this.dtm.publicGrid();
    const slopes = (pts: LatLon[]) => this.dtm.sampleRoute(pts.map((p, i) => ({ id: `${i}`, lat: p.lat, lon: p.lon }))).samples.map((s) => s.slopeDeg ?? 0);
    const toTrack = (p: LatLon, pts: LatLon[]) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, pointSegmentDistanceKm(p, pts[i - 1], pts[i])); return d; };

    // 1. Slopes along the real drive vs seeded random 1 km lines (anywhere in the DEM, and within 1 km of the drive).
    const driven = slopeStats(slopes(track));
    const rand = mulberry32(2021);
    const latSpan = grid.rows.length * grid.sampleSpacingDegrees, lonSpan = grid.rows[0].length * grid.sampleSpacingDegrees;
    const line = (start: LatLon) => { const h = rand() * 2 * Math.PI, d = LINE_KM / MOLA_KM_PER_DEG; return [start, { lat: start.lat + d * Math.cos(h), lon: start.lon + (d * Math.sin(h)) / Math.cos((start.lat * Math.PI) / 180) }]; };
    const anywhere: number[] = [], nearby: number[] = [];
    for (let i = 0; i < RANDOM_LINES; i++) anywhere.push(...slopes(line({ lat: grid.latMin + rand() * latSpan, lon: grid.lonMin + rand() * lonSpan })));
    for (let i = 0; i < RANDOM_LINES; i++) {
      const p = track[Math.floor(rand() * track.length)], off = (rand() * NEAR_KM) / MOLA_KM_PER_DEG, h = rand() * 2 * Math.PI;
      nearby.push(...slopes(line({ lat: p.lat + off * Math.cos(h), lon: p.lon + off * Math.sin(h) })));
    }

    // 2. A* corridor vs the real drive between verified sols.
    const corridors = LEGS.map(([a, b]) => {
      const leg = track.filter((p) => p.sol >= a && p.sol <= b);
      const path = leg.length > 1 ? this.dtm.suggest(leg[0], leg.at(-1)!) : null;
      const drivenKm = leg.slice(1).reduce((s, p, i) => s + haversineKm(leg[i], p), 0);
      if (!path) return { fromSol: a, toSol: b, drivenKm: Number(drivenKm.toFixed(2)), corridor: null };
      const o = offsetStats(path.map((p) => toTrack(p, leg)));
      const corridorKm = path.slice(1).reduce((s, p, i) => s + haversineKm(path[i], p), 0);
      return { fromSol: a, toSol: b, drivenKm: Number(drivenKm.toFixed(2)), corridorKm: Number(corridorKm.toFixed(2)), corridor: { waypoints: o.n, meanOffsetM: Math.round(o.meanKm * 1000), maxOffsetM: Math.round(o.maxKm * 1000), within200m: Number(o.withinShare.toFixed(3)) } };
    });

    // 3. Agent tool choice on a labelled set (deterministic router, the path used offline).
    const items = JSON.parse(await readFile(this.dataPath.resolve('agent/eval.json'), 'utf8')) as Array<{ goal: string; expected: string[] }>;
    const agent = items.map(({ goal, expected }) => { const planned = planTools(detectIntents(goal), goal); return { goal, expected, planned, ...toolScore(expected, planned) }; });

    // 4. Science references: our pure modules vs published NASA values.
    const m1 = marsTime(new Date('2000-01-06T00:00:00Z'), 0), m2 = marsTime(new Date('2004-01-03T13:46:31Z'), 360 - 184.702);
    const w = conjunctionWindows(new Date('2021-01-01T00:00:00Z'), new Date('2024-06-01T00:00:00Z'));
    const science = [
      { check: 'Mars24 example A · solar longitude Ls', ours: m1.ls, reference: 277.18758, unit: '°', tolerance: 1e-4, source: 'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html' },
      { check: 'Mars24 example A · equation of time', ours: m1.eot, reference: -5.18774, unit: '°', tolerance: 1e-4, source: 'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html' },
      { check: 'Mars24 example A · Coordinated Mars Time', ours: m1.mst, reference: 23.99425, unit: 'h', tolerance: 1e-4, source: 'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html' },
      { check: 'Mars24 example B (Spirit landing) · Ls', ours: m2.ls, reference: 327.32416, unit: '°', tolerance: 1e-3, source: 'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html' },
      { check: 'Mars24 example B (Spirit landing) · local mean solar time', ours: m2.lmst, reference: 0.8519, unit: 'h', tolerance: 1e-3, source: 'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html' },
    ].map((r) => ({ ...r, ours: Number(r.ours.toFixed(5)), pass: Math.abs(r.ours - r.reference) <= r.tolerance }));
    const moratoria = [
      { check: '2021 conjunction · NASA command moratorium Oct 2–16', start: '2021-10-02', end: '2021-10-16', source: 'https://www.jpl.nasa.gov/news/nasas-mars-fleet-lies-low-with-sun-between-earth-and-red-planet' },
      { check: '2023 conjunction · NASA command moratorium Nov 11–25', start: '2023-11-11', end: '2023-11-25', source: 'https://phys.org/news/2023-11-nasa-mars-fleet-science.html' },
    ].map((m) => { const hit = w.find((x) => x.start <= m.end && x.end >= m.start); return { ...m, ours: hit ? `${hit.start} → ${hit.end} (min ${hit.minDate}, ${hit.minDeg.toFixed(2)}°)` : 'none', pass: Boolean(hit && hit.start <= m.start && hit.end >= m.end) }; });

    const r2 = (x: ReturnType<typeof slopeStats>) => ({ n: x.n, meanDeg: Number(x.mean.toFixed(2)), p50Deg: Number(x.p50.toFixed(2)), p90Deg: Number(x.p90.toFixed(2)), maxDeg: Number(x.max.toFixed(1)), over10: Number(x.over10.toFixed(3)), over15: Number(x.over15.toFixed(3)) });
    const report = {
      generatedAt: new Date().toISOString(),
      slopes: { driven: r2(driven), randomAnywhere: r2(slopeStats(anywhere)), randomNearDrive: r2(slopeStats(nearby)), lines: RANDOM_LINES, lineKm: LINE_KM, seed: 2021, demSource: grid.sourceUrl, trackSource: 'https://pds-geosciences.wustl.edu/missions/mars2020/places.htm', note: 'Slopes from the ~118 m PLACES orbital DEM grid; cannot resolve rover-scale hazards. NON-CERTIFYING.' },
      corridors: { legs: corridors, note: 'Coarse slope-weighted A* on the DEM grid vs the published PLACES drive. The rover also routed around science targets and rover-scale hazards the grid cannot see.' },
      agent: { items: agent, passed: agent.filter((a) => a.pass).length, total: agent.length, meanPrecision: Number((agent.reduce((s, a) => s + a.precision, 0) / agent.length).toFixed(3)), router: 'deterministic rules (offline path)' },
      science: { mars24: science, conjunctions: moratoria },
    };
    this.cache = { at: Date.now(), report };
    return report;
  }
}
