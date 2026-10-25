import { Injectable, Logger } from '@nestjs/common';
import type { AgentLabel, AgentModel, AgentRun, AnswerLang, AgentStep, LatLon, RagPassage, RouteWaypoint } from '@mars-explorer/shared';
import { conjunctionWindows, daylightLtst, dustSeason, earthMarsGeometry, evaBudget, formatHours, MARS24_URL, marsTime, NASA_MARS_LANDINGS, RAD_SOURCE_URL, routeProfile, suitability, arrayEnergyWh, MARS_FACT_SHEET_URL, lineOfSight, driveEnergy, speedOfSound, marsDelaySeconds, MAURICE_2022_URL, peakDeceleration, densityAt } from '@mars-explorer/shared';
import { EonetService } from '../eonet/eonet.service';
import { PlacesService } from '../places/places.service';
import { AnswerService, langInstruction } from '../rag/answer.service';
import { LlmService, type LlmProvider, type ToolCall, type ToolSpec } from '../rag/llm.service';
import { RetrieverService } from '../rag/retriever.service';
import { RegionsService } from '../regions/regions.service';
import { RoutesService } from '../routes/routes.service';
import { AssistantService } from './assistant.service';
import { JevRouterService } from './jev-router.service';
import { getEarthNaturalEvents } from './tools/earth-events.tool';
import { OpenDataService } from '../opendata/opendata.service';
import { detectMission } from '../opendata/opendata.logic';
import { RawImagesService } from '../raw-images/raw-images.service';
import { isOffline } from '../common/offline';
import { checkProvenance } from './provenance';
import { planTools } from './intents';

type ToolResult = { output: unknown; summary: string; label: AgentLabel };
export type AgentEvent = { type: 'step'; data: AgentStep } | { type: 'token'; data: string } | { type: 'reset' };
type Ctx = { lang: AnswerLang; passages: RagPassage[]; route?: RouteWaypoint[]; steps: AgentStep[]; outputs: Array<{ tool: string; output: unknown }>; emit: (e: AgentEvent) => void; started: number };

const MAX_TURNS = 8;
// Source shown for each tool's numbers when its output does not name one itself.
const TOOL_SOURCE: Record<string, string> = {
  search_knowledge: 'NASA corpus passages (cited [n])', verified_locations: 'NASA PDS PLACES best_interp.csv', rover_position: 'NASA PDS PLACES best_interp.csv',
  suggest_corridor: 'NASA PDS PLACES orbital DEM (A* corridor, non-certifying)', analyze_route: 'NASA PDS PLACES orbital DEM (Risk Index, non-certifying)',
  earth_events: 'NASA EONET v3 (EARTH)', orbit_geometry: 'NASA JPL approximate Keplerian elements', create_briefing: 'Mars Explorer briefing (PLACES DEM + NASA corpus)',
  nasa_open_data: 'data.nasa.gov catalog snapshot', mars_hardware: 'NASA mission pages (science.nasa.gov)', named_features: 'IAU/USGS Gazetteer of Planetary Nomenclature (data.nasa.gov)',
  rover_images: 'NASA mars.nasa.gov Mars 2020 / Ingenuity raw images', solar_power: 'Orbital geometry + NASA Mars Fact Sheet; dust model non-certifying', line_of_sight: 'NASA PDS PLACES orbital DEM (ray-march, non-certifying)', drive_energy: 'PLACES DEM + Perseverance mass/MMRTG (NASA), non-certifying', sound_on_mars: 'Maurice et al. 2022 (SuperCam microphone)', entry_physics: 'NASA Mars Fact Sheet atmosphere; Allen–Eggers ballistic model', mars_samples: 'NASA Mars 2020 rock samples page', ingenuity_flights: 'NASA Mars 2020 MMGIS helicopter flight paths', weather_on_sol: 'NASA PDS Atmospheres MEDA', mars_time: 'NASA GISS Mars24 algorithm (Allison & McEwen 2000)',
  comm_window: 'NASA JPL approximate Keplerian elements (solar elongation, non-certifying)', site_suitability: 'NASA PDS PLACES orbital DEM (multi-criteria, non-certifying)', eva_budget: 'PLACES DEM + Curiosity RAD 0.67 mSv/day (Hassler et al. 2014), non-certifying',
};
const JEZERO_LANDING = NASA_MARS_LANDINGS.find((s) => s.mission === 'PERSEVERANCE')!;
const point = { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number', description: 'East-positive longitude' } }, required: ['lat', 'lon'] };

const TOOLS: ToolSpec[] = [
  { name: 'search_knowledge', description: 'Hybrid search of the cited NASA corpus (Perseverance, Jezero, instruments, samples, PLACES, Mars Trek, EONET docs, other NASA landers). Returns numbered passages to cite as [n].', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'verified_locations', description: 'NASA-verified Perseverance locations in Jezero from published PLACES records (landing/sol 0, sol 400, 700, 1000) with coordinates.', parameters: { type: 'object', properties: {} } },
  { name: 'rover_position', description: "Perseverance's published PLACES localization closest to a given sol, with coordinates and elevation.", parameters: { type: 'object', properties: { sol: { type: 'integer' } }, required: ['sol'] } },
  { name: 'rover_images', description: 'Public Mars 2020 / Ingenuity raw images for a sol from mars.nasa.gov (camera, thumbnails, page URLs). Not live telemetry.', parameters: { type: 'object', properties: { sol: { type: 'integer' }, limit: { type: 'integer' } }, required: ['sol'] } },
  { name: 'suggest_corridor', description: 'Coarse slope-weighted A* corridor between two points on the PLACES orbital DEM grid. Non-certifying.', parameters: { type: 'object', properties: { start: point, end: point }, required: ['start', 'end'] } },
  { name: 'analyze_route', description: 'Distance, DEM coverage, elevation change, and non-certifying Traverse Risk Index for a route of 2–24 waypoints.', parameters: { type: 'object', properties: { waypoints: { type: 'array', items: point } }, required: ['waypoints'] } },
  { name: 'earth_events', description: 'Open NASA EONET natural events on EARTH (wildfires, storms, ice). Earth only; never Mars conditions.', parameters: { type: 'object', properties: { category: { type: 'string', description: 'Optional EONET category id, e.g. wildfires, severeStorms, seaLakeIce' }, limit: { type: 'integer' } } } },
  { name: 'orbit_geometry', description: 'Earth–Mars distance and one-way light time on a date, from NASA JPL approximate Keplerian elements.', parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD; defaults to today' } } } },
  { name: 'nasa_open_data', description: 'Search the NASA Open Data portal (data.nasa.gov, tag mars; 1,300+ catalog records, mostly PDS archives) for datasets about a Mars mission, instrument, or topic. Returns titles and data.nasa.gov links.', parameters: { type: 'object', properties: { query: { type: 'string' }, mission: { type: 'string', description: 'Optional mission tag, e.g. CURIOSITY, INSIGHT, PHOENIX, OPPORTUNITY, SPIRIT, MRO, MAVEN, MARS EXPRESS' } }, required: ['query'] } },
  { name: 'named_features', description: 'IAU-approved Mars feature names (craters, valles, montes…) nearest a point, or the record for one named feature, from the IAU/USGS Gazetteer of Planetary Nomenclature listed on data.nasa.gov.', parameters: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number', description: 'East-positive longitude' }, name: { type: 'string', description: 'Exact feature name, e.g. Jezero, Neretva Vallis' } } } },
  { name: 'mars_hardware', description: 'NASA landers, rovers and the Ingenuity helicopter on Mars: status (active or silent), landing and last-contact dates, why each went silent, position basis, and the NASA mission page for each.', parameters: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'silent', 'all'] } } } },
  { name: 'mars_time', description: 'Local Mars solar time, season (Ls), sunrise/sunset and dust-season flag at a point and UTC instant, from the NASA GISS Mars24 algorithm. Defaults to Jezero now.', parameters: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number', description: 'East-positive longitude' }, date: { type: 'string', description: 'ISO date or date-time (UTC); defaults to now' } } } },
  { name: 'comm_window', description: 'Earth–Mars solar-conjunction communication blackout windows (Sun within 3° of Mars as seen from Earth) over a range of years, plus current light time. Non-certifying.', parameters: { type: 'object', properties: { from: { type: 'string', description: 'YYYY-MM-DD; defaults to today' }, years: { type: 'integer', description: '1–6, default 3' } } } },
  { name: 'eva_budget', description: 'Marswalk budget for a route: walking time out and back from the DEM slope profile, suit-time reserve verdict (GO/MARGINAL/NO-GO), daylight fit at Jezero today, and radiation dose from Curiosity RAD. Non-certifying.', parameters: { type: 'object', properties: { waypoints: { type: 'array', items: point }, suitHours: { type: 'number', description: 'Default 8' } }, required: ['waypoints'] } },
  { name: 'site_suitability', description: 'Top habitat / landing-site candidates in the Jezero DEM grid from a weighted score of slope, roughness, elevation, distance to science targets and to ground Perseverance already drove. Non-certifying.', parameters: { type: 'object', properties: {} } },
  { name: 'solar_power', description: 'Daily solar energy on the Martian surface (Wh/m²) and from a solar array, by latitude, season Ls and dust optical depth tau, with panel dust loss over sols. Orbital geometry is exact; dust attenuation is a heuristic.', parameters: { type: 'object', properties: { lat: { type: 'number' }, ls: { type: 'number', description: 'Solar longitude 0–360; defaults to now' }, tau: { type: 'number', description: 'Dust optical depth, default 0.5' }, areaM2: { type: 'number' }, sols: { type: 'integer' } } } },
  { name: 'line_of_sight', description: 'Whether two surface points in Jezero can see each other (radio/visual) over the orbital DEM, with the tightest clearance. Non-certifying.', parameters: { type: 'object', properties: { start: point, end: point, mastHeightM: { type: 'number' } }, required: ['start', 'end'] } },
  { name: 'drive_energy', description: 'Electrical energy for Perseverance to drive a route (climb + rolling resistance) as a share of one sol of MMRTG output, plus slip risk from the steepest DEM slope. Non-certifying.', parameters: { type: 'object', properties: { waypoints: { type: 'array', items: point } }, required: ['waypoints'] } },
  { name: 'sound_on_mars', description: 'Speed of sound in Mars CO₂ at a temperature, and the delay of a sound over a distance using the two speeds SuperCam measured.', parameters: { type: 'object', properties: { temperatureK: { type: 'number' }, distanceM: { type: 'number' }, frequencyHz: { type: 'number' } } } },
  { name: 'entry_physics', description: 'Mars atmospheric density at an altitude and the ballistic peak deceleration for an entry (default Perseverance-like: 5.4 km/s, 15.5°). Non-certifying.', parameters: { type: 'object', properties: { altitudeKm: { type: 'number' }, entrySpeedMs: { type: 'number' }, flightPathDeg: { type: 'number' } } } },
  { name: 'mars_samples', description: 'Perseverance sample tubes: name, sol sealed, rock type, height and whether each is in the Three Forks depot or on the rover.', parameters: { type: 'object', properties: { location: { type: 'string', enum: ['depot', 'rover', 'all'] } } } },
  { name: 'ingenuity_flights', description: 'Ingenuity helicopter flight records: flight number, sol, ground-track length and duration; totals across all 72 flights.', parameters: { type: 'object', properties: { flight: { type: 'integer' } } } },
  { name: 'weather_on_sol', description: 'Perseverance MEDA air and ground temperature and pressure by local hour for the snapshotted sol nearest the one asked.', parameters: { type: 'object', properties: { sol: { type: 'integer' } }, required: ['sol'] } },
  { name: 'create_briefing', description: 'Deterministic mission briefing for a route (objectives, terrain considerations, Risk Index components, sources).', parameters: { type: 'object', properties: { waypoints: { type: 'array', items: point } }, required: ['waypoints'] } },
];

const SYSTEM = [
  "You are the Mars Explorer mission agent for NASA's Perseverance site in Jezero Crater. Plan briefly, then use tools to gather evidence before answering.",
  'Rules:',
  '- For mission, science, instrument, or data-source facts, call search_knowledge and cite the passages you rely on as [n] using the numbers it returns.',
  '- Never invent coordinates. Get them from verified_locations or rover_position.',
  '- To plan a route: get endpoints, call suggest_corridor, then analyze_route on the corridor it returns.',
  '- For which datasets or archives exist, call nasa_open_data and give the data.nasa.gov links. For official place names, call named_features.',
  '- earth_events returns EARTH data only. Label it EARTH / EONET and never present it as Mars conditions.',
  '- Routes, corridors, and the Risk Index are non-certifying research aids; never call anything safe.',
  '- For local Mars time, daylight and season call mars_time; for communication blackouts call comm_window; for whether astronauts can walk a route, suit time or radiation dose call eva_budget (non-certifying).',
  '- Round coordinates to 4 decimals and other values to at most 2 decimals; never print more digits than that.',
  '- For quiz evaluation, strictly follow the requested PASS/FAIL format.',
  '- Stop calling tools once you have enough evidence. Then give the final answer in plain prose (no markdown headings), under 220 words, with [n] citations for knowledge claims.',
].join('\n');

@Injectable()
export class MissionAgentService {
  private readonly log = new Logger(MissionAgentService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly retriever: RetrieverService,
    private readonly answers: AnswerService,
    private readonly routes: RoutesService,
    private readonly regions: RegionsService,
    private readonly places: PlacesService,
    private readonly eonet: EonetService,
    private readonly assistant: AssistantService,
    private readonly router: JevRouterService,
    private readonly openData: OpenDataService,
    private readonly rawImages: RawImagesService,
  ) {}

  private step(ctx: Ctx, s: Omit<AgentStep, 'i'>) {
    const full = { i: ctx.steps.length + 1, ...s };
    ctx.steps.push(full);
    ctx.emit({ type: 'step', data: full });
  }

  private toPoints(raw: unknown, max = 24): LatLon[] {
    const list = Array.isArray(raw) ? raw : [];
    const pts = list.map((p) => ({ lat: Number((p as LatLon)?.lat), lon: Number((p as LatLon)?.lon) })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
    return pts.slice(0, max);
  }

  /** Every tool validates its own arguments: model output is untrusted input. */
  private async execute(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
    switch (name) {
      case 'search_knowledge': {
        const query = String(args.query ?? '').slice(0, 300).trim();
        if (query.length < 2) throw new Error('query is required');
        const res = await this.retriever.search(query, 5);
        // Number passages globally across calls so [n] citations stay unique for the final answer.
        for (const p of res.passages) if (!ctx.passages.some((q) => q.chunkId === p.chunkId)) ctx.passages.push({ ...p, n: ctx.passages.length + 1 });
        const all = res.passages.map((p) => ctx.passages.find((q) => q.chunkId === p.chunkId)!);
        return {
          label: 'RAG', summary: `${res.passages.length} passages (${res.mode}${res.strong ? '' : ', weak match'}): ${[...new Set(all.map((p) => p.title))].slice(0, 3).join('; ')}`,
          output: { evidenceStrong: res.strong, passages: all.map((p) => ({ n: p.n, title: p.title, section: p.heading, text: p.text.slice(0, 700) })) },
        };
      }
      case 'verified_locations': {
        const region = await this.regions.getJezero(false);
        const pois = region.pois.filter((p) => p.sourceKind === 'NASA_PLACES').map((p) => ({ name: p.name, lat: Number(p.lat.toFixed(5)), lon: Number(p.lon.toFixed(5)) }));
        return { label: 'MARS', summary: `${pois.length} PLACES-verified locations`, output: { source: 'NASA PDS PLACES best_interp.csv', locations: pois } };
      }
      case 'rover_position': {
        const sol = Math.round(Number(args.sol));
        if (!Number.isFinite(sol) || sol < 0) throw new Error('sol must be a non-negative integer');
        const track = await this.places.perseverance();
        const p = track.points.reduce((best, q) => (Math.abs(q.sol - sol) < Math.abs(best.sol - sol) ? q : best));
        return { label: 'MARS', summary: `Sol ${p.sol}: ${p.lat.toFixed(4)}°N ${p.lon.toFixed(4)}°E${p.elevationM != null ? `, ${Math.round(p.elevationM)} m` : ''}`, output: { requestedSol: sol, publishedSol: p.sol, lat: p.lat, lon: p.lon, elevationM: p.elevationM, latestSol: track.latestSol, source: 'NASA PDS PLACES best_interp.csv (not live telemetry)' } };
      }
      case 'rover_images': {
        const sol = Math.round(Number(args.sol));
        if (!Number.isFinite(sol) || sol < 0) throw new Error('sol must be a non-negative integer');
        const limit = Math.min(12, Math.max(1, Math.round(Number(args.limit) || 6)));
        const res = await this.rawImages.forSol(sol, limit);
        return {
          label: 'MARS',
          summary: `${res.images.length} raw images for sol ${res.sol} (${res.source})`,
          output: {
            sol: res.sol,
            source: res.sourceUrl,
            sourceLabel: res.source,
            note: res.note,
            images: res.images.map(({ id, camera, title, earthDate, pageUrl, category }) => ({ id, camera, title, earthDate, pageUrl, category })),
          },
        };
      }
      case 'suggest_corridor': {
        const [start, end] = this.toPoints([args.start, args.end], 2);
        if (!start || !end) throw new Error('start and end {lat, lon} are required');
        const res = this.routes.suggest([{ id: 's', ...start }, { id: 'e', ...end }]);
        ctx.route = res.waypoints;
        return { label: 'MARS', summary: `A* corridor with ${res.waypoints.length} waypoints (non-certifying)`, output: { waypoints: res.waypoints.map(({ lat, lon }) => ({ lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) })), note: res.note } };
      }
      case 'analyze_route': {
        const pts = this.toPoints(args.waypoints);
        if (pts.length < 2) throw new Error('at least two waypoints are required');
        const a = await this.routes.analyze(pts.map((p, i) => ({ id: `w${i}`, ...p })));
        ctx.route ??= pts.map((p, i) => ({ id: `w${i}`, ...p }));
        return { label: 'MARS', summary: `${a.distanceKm.toFixed(2)} km · Risk Index ${a.riskIndex.total}/100 (${a.terrainMethod}) · DTM coverage ${Math.round(a.dtmCoverage * 100)}%`, output: { distanceKm: Number(a.distanceKm.toFixed(3)), elevationDeltaM: a.elevationDeltaM, riskIndex: a.riskIndex.total, method: a.terrainMethod, dtmCoverage: a.dtmCoverage, components: a.riskIndex.components.map((c) => ({ label: c.label, score: c.score })), notes: a.riskNotes, certifying: false } };
      }
      case 'earth_events': {
        const limit = Math.min(10, Math.max(1, Math.round(Number(args.limit) || 6)));
        const category = typeof args.category === 'string' && /^[a-zA-Z]{3,30}$/.test(args.category) ? args.category : undefined;
        const res = await getEarthNaturalEvents(this.eonet, { limit, days: 30, category });
        return { label: 'EARTH / EONET', summary: `${res.events.length} open Earth events (EARTH / EONET)`, output: { label: 'EARTH / EONET', note: res.note, events: res.events.slice(0, limit).map((e) => ({ title: e.title, category: e.category, date: e.date })) } };
      }
      case 'orbit_geometry': {
        const raw = typeof args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : new Date().toISOString().slice(0, 10);
        const date = new Date(`${raw}T00:00:00Z`);
        if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1800 || date.getUTCFullYear() > 2050) throw new Error('date must be YYYY-MM-DD between 1800 and 2050');
        const g = earthMarsGeometry(date);
        return { label: 'ORBIT', summary: `${raw}: ${(g.km / 1e6).toFixed(1)} million km, ${g.lightMinutes.toFixed(1)} min one-way light time`, output: { date: raw, distanceAu: Number(g.au.toFixed(4)), distanceKm: Math.round(g.km), lightMinutesOneWay: Number(g.lightMinutes.toFixed(2)), source: 'NASA JPL approximate Keplerian elements' } };
      }
      case 'nasa_open_data': {
        const query = String(args.query ?? '').slice(0, 200).trim();
        if (query.length < 2) throw new Error('query is required');
        const mission = typeof args.mission === 'string' && /^[A-Za-z ]{3,20}$/.test(args.mission) ? args.mission.toUpperCase() : undefined;
        const res = await this.openData.searchForAgent(query, mission);
        return { label: 'OPEN DATA', summary: `${res.total} data.nasa.gov Mars datasets${mission ? ` for ${mission}` : ''}: ${res.items.slice(0, 2).map((d) => d.title).join('; ') || 'none'}`, output: { source: 'data.nasa.gov catalog snapshot (tag: mars)', snapshotAt: res.fetchedAt, total: res.total, datasets: res.items.map((d) => ({ title: d.title, url: d.url, missions: d.missions, publisher: d.publisher, landingPage: d.landingPage })) } };
      }
      case 'named_features': {
        if (typeof args.name === 'string' && args.name.trim()) {
          const f = await this.openData.findFeature(args.name.slice(0, 80));
          if (!f) throw new Error(`no IAU-adopted Mars feature named ${args.name}`);
          return { label: 'MARS', summary: `${f.name}: ${f.type}, ${f.diameterKm} km at ${f.lat}°N ${f.lon}°E`, output: { source: 'IAU/USGS Gazetteer of Planetary Nomenclature (data.nasa.gov)', feature: f } };
        }
        const [p] = this.toPoints([{ lat: args.lat, lon: args.lon }], 1);
        if (!p) throw new Error('lat/lon or name is required');
        const near = await this.openData.nearestFeatures(p, 8);
        return { label: 'MARS', summary: `Nearest IAU names: ${near.slice(0, 4).map((f) => `${f.name} (${f.distanceKm} km)`).join(', ')}`, output: { source: 'IAU/USGS Gazetteer of Planetary Nomenclature (data.nasa.gov)', point: p, features: near.map(({ name, type, diameterKm, distanceKm, lat, lon, link }) => ({ name, type, diameterKm, distanceKm, lat, lon, link })) } };
      }
      case 'mars_hardware': {
        const status = args.status === 'active' || args.status === 'silent' ? args.status : undefined;
        const items = (await this.openData.hardware()).filter((h) => !status || h.status === status);
        return { label: 'MARS', summary: `${items.length} NASA spacecraft on Mars: ${items.filter((h) => h.status === 'active').map((h) => h.name).join(', ') || 'none'} active`, output: { source: 'NASA mission pages (science.nasa.gov); NSSDCA landing coordinates', hardware: items.map(({ name, status: st, landed, lastContact, whySilent, positionNote, sourceUrl }) => ({ name, status: st, landed, lastContact, whySilent, positionNote, sourceUrl })) } };
      }
      case 'mars_time': {
        const [p] = args.lat == null ? [{ lat: JEZERO_LANDING.lat, lon: JEZERO_LANDING.lon }] : this.toPoints([{ lat: args.lat, lon: args.lon }], 1);
        if (!p) throw new Error('lat/lon must be valid');
        const date = typeof args.date === 'string' ? new Date(args.date) : new Date();
        if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1996 || date.getUTCFullYear() > 2050) throw new Error('date must be ISO between 1996 and 2050');
        const t = marsTime(date, p.lon);
        const day = daylightLtst(p.lat, t.declination);
        return { label: 'SURVIVAL', summary: `${formatHours(t.ltst)} local true solar time at ${p.lat.toFixed(2)}°N ${p.lon.toFixed(2)}°E · Ls ${t.ls.toFixed(1)}° · ${day ? `sunrise ${formatHours(day.sunrise)}, sunset ${formatHours(day.sunset)}` : 'no sunrise/sunset today'}${dustSeason(t.ls) ? ' · dust-storm season' : ''}`, output: { utc: date.toISOString(), point: p, msd: Number(t.msd.toFixed(4)), ltst: formatHours(t.ltst), lmst: formatHours(t.lmst), lsDeg: Number(t.ls.toFixed(2)), declinationDeg: Number(t.declination.toFixed(2)), sunriseLtst: day && formatHours(day.sunrise), sunsetLtst: day && formatHours(day.sunset), daylightHours: day && Number(day.hours.toFixed(2)), dustSeason: dustSeason(t.ls), dustSeasonNote: 'Climatology flag (Ls 180–330), not a forecast. NON-CERTIFYING.', source: MARS24_URL } };
      }
      case 'comm_window': {
        const raw = typeof args.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.from) ? args.from : new Date().toISOString().slice(0, 10);
        const from = new Date(`${raw}T00:00:00Z`);
        if (Number.isNaN(from.getTime()) || from.getUTCFullYear() < 1900 || from.getUTCFullYear() > 2045) throw new Error('from must be YYYY-MM-DD between 1900 and 2045');
        const years = Math.min(6, Math.max(1, Math.round(Number(args.years) || 3)));
        const windows = conjunctionWindows(from, new Date(from.getTime() + years * 365.25 * 864e5));
        const g = earthMarsGeometry(from);
        return { label: 'ORBIT', summary: `${windows.length} conjunction blackout window(s) in ${years} y from ${raw}: ${windows.map((w) => `${w.start}→${w.end}`).join(', ') || 'none'} · light time ${g.lightMinutes.toFixed(1)} min`, output: { from: raw, years, thresholdDeg: 3, windows, lightMinutesOneWay: Number(g.lightMinutes.toFixed(2)), note: 'Sun–Earth–Mars elongation from approximate Keplerian elements; real mission moratoria are set by each project. NON-CERTIFYING.', source: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html' } };
      }
      case 'eva_budget': {
        const pts = this.toPoints(args.waypoints);
        if (pts.length < 2) throw new Error('at least two waypoints are required');
        const suitHours = Math.min(12, Math.max(1, Number(args.suitHours) || 8));
        const wps = pts.map((p, i) => ({ id: `e${i}`, ...p }));
        const a = await this.routes.analyze(wps);
        ctx.route ??= wps;
        const s = a.terrainSamples;
        // Below 80% DEM coverage the slope profile is unreliable, so fall back to flat ground over the route length.
        const profile = a.terrainMethod === 'dtm-sample' ? routeProfile(s) : [];
        const t = marsTime(new Date(), pts[0].lon);
        const day = daylightLtst(pts[0].lat, t.declination);
        const b = evaBudget({ profile: profile.length > 1 ? profile : [{ km: 0, elevationM: 0 }, { km: a.distanceKm, elevationM: 0 }], suitHours, daylightHours: day?.hours });
        const h = (x: number) => Number(x.toFixed(2));
        return { label: 'SURVIVAL', summary: `EVA ${b.status}: ${h(b.totalH)} h walking out and back of ${h(b.usableH)} h usable suit time · dose ${b.doseMsv.toFixed(3)} mSv · steepest grade ${b.steepestGradePct.toFixed(1)}% (non-certifying)`, output: { status: b.status, distanceKm: a.distanceKm, outboundHours: h(b.outboundH), returnHours: h(b.returnH), totalHours: h(b.totalH), usableSuitHours: h(b.usableH), suitHours, doseMsv: Number(b.doseMsv.toFixed(4)), steepestGradePct: Number(b.steepestGradePct.toFixed(1)), daylightHoursToday: day && h(day.hours), fitsDaylight: b.fitsDaylight, profileMethod: profile.length > 1 ? 'PLACES DEM samples' : 'flat (DEM coverage too low)', assumptions: '2 km/h suited flat speed, Tobler slope penalty, 25% suit reserve', radiationSource: RAD_SOURCE_URL, certifying: false } };
      }
      case 'site_suitability': {
        const [grid, region, track] = [this.routes.dtmGrid(), await this.regions.getJezero(), await this.places.perseverance()];
        const targets = region.pois.filter((p) => p.category === 'geology' || p.category === 'mission');
        const r = suitability({ ...grid, targets, track: track.points });
        const best = r.best.map((b) => ({ lat: Number(b.lat.toFixed(4)), lon: Number(b.lon.toFixed(4)), score: Math.round(b.score), slopeDeg: Number(b.slopeDeg.toFixed(1)), elevationM: Math.round(b.elevationM), targetKm: Number(b.targetKm.toFixed(2)), trackKm: Number(b.trackKm.toFixed(2)) }));
        return { label: 'SURVIVAL', summary: `Top site ${best[0]?.lat}°N ${best[0]?.lon}°E scores ${best[0]?.score}/100 (slope ${best[0]?.slopeDeg}°, ${best[0]?.targetKm} km from a science target) · non-certifying`, output: { sites: best, weights: r.weights, gridCellM: 118, source: grid.sourceUrl, note: 'Ranks where to look on a ~118 m grid; cannot see boulders or scarps. NON-CERTIFYING.' } };
      }
      case 'solar_power': {
        const lat = Number.isFinite(Number(args.lat)) ? Math.max(-90, Math.min(90, Number(args.lat))) : JEZERO_LANDING.lat;
        const ls = Number.isFinite(Number(args.ls)) ? ((Number(args.ls) % 360) + 360) % 360 : marsTime(new Date()).ls;
        const tau = Math.min(10, Math.max(0, Number.isFinite(Number(args.tau)) ? Number(args.tau) : 0.5));
        const areaM2 = Math.min(1000, Math.max(0.1, Number(args.areaM2) || 10));
        const sols = Math.min(5000, Math.max(0, Math.round(Number(args.sols) || 0)));
        const r = arrayEnergyWh({ latDeg: lat, ls, tau, areaM2, sols });
        return { label: 'SURVIVAL', summary: `${Math.round(r.insolationWhM2)} Wh/m² per sol at ${lat.toFixed(2)}°, Ls ${ls.toFixed(0)}°, tau ${tau} · ${areaM2} m² array → ${Math.round(r.energyWh)} Wh/sol after ${sols} sols of dust (non-certifying)`, output: { lat, ls: Number(ls.toFixed(1)), tau, insolationWhM2: Math.round(r.insolationWhM2), areaM2, efficiency: 0.28, dustFactor: Number(r.dustFactor.toFixed(3)), energyWh: Math.round(r.energyWh), source: MARS_FACT_SHEET_URL, certifying: false } };
      }
      case 'line_of_sight': {
        const [start, end] = this.toPoints([args.start, args.end], 2);
        if (!start || !end) throw new Error('start and end points are required');
        const mast = Math.min(100, Math.max(0, Number(args.mastHeightM) || 2));
        const r = lineOfSight((lat, lon) => this.routes.elevationAt(lat, lon), start, end, { heightA: mast, heightB: mast });
        if (!r) throw new Error('both points must be inside the Jezero DEM grid');
        return { label: 'MARS', summary: `${r.clear ? 'Clear' : 'Blocked'} line of sight over ${(r.distanceM / 1000).toFixed(2)} km with ${mast} m masts · tightest clearance ${r.minClearanceM.toFixed(1)} m (non-certifying)`, output: { clear: r.clear, distanceKm: Number((r.distanceM / 1000).toFixed(3)), mastHeightM: mast, minClearanceM: Number(r.minClearanceM.toFixed(1)), blockedAtKm: r.blockedAtM == null ? null : Number((r.blockedAtM / 1000).toFixed(3)), source: TOOL_SOURCE.line_of_sight, certifying: false } };
      }
      case 'drive_energy': {
        const pts = this.toPoints(args.waypoints);
        if (pts.length < 2) throw new Error('at least two waypoints are required');
        const a = await this.routes.analyze(pts.map((p, i) => ({ id: `d${i}`, ...p })));
        const prof = a.terrainMethod === 'dtm-sample' ? routeProfile(a.terrainSamples) : [{ km: 0, elevationM: 0 }, { km: a.distanceKm, elevationM: 0 }];
        const e = driveEnergy(prof);
        return { label: 'MARS', summary: `${Math.round(e.electricWh)} Wh to drive ${a.distanceKm} km (${(e.fractionOfSol * 100).toFixed(0)}% of one sol of MMRTG output) · slip risk ${e.slipRisk} (non-certifying)`, output: { distanceKm: a.distanceKm, climbWh: Math.round(e.climbWh), rollingWh: Math.round(e.rollingWh), electricWh: Math.round(e.electricWh), shareOfSolMmrtg: Number(e.fractionOfSol.toFixed(3)), maxSlopeDeg: Number(e.maxSlopeDeg.toFixed(1)), slipRisk: e.slipRisk, assumptions: 'mass 1025 kg, Crr 0.15, drivetrain efficiency 50%, MMRTG 110 W', certifying: false } };
      }
      case 'sound_on_mars': {
        const t = Math.min(320, Math.max(140, Number(args.temperatureK) || 240));
        const d = Math.min(1e5, Math.max(0, Number(args.distanceM) || 100));
        const f = Math.min(2e4, Math.max(1, Number(args.frequencyHz) || 100));
        return { label: 'MARS', summary: `Ideal-gas sound speed ${speedOfSound(t).toFixed(0)} m/s at ${t} K; SuperCam measured ~240 m/s below 240 Hz and ~250 m/s above · ${d} m takes ${marsDelaySeconds(d, f).toFixed(2)} s at ${f} Hz`, output: { temperatureK: t, idealSpeedMs: Number(speedOfSound(t).toFixed(1)), measuredLowMs: 240, measuredHighMs: 250, distanceM: d, frequencyHz: f, delaySeconds: Number(marsDelaySeconds(d, f).toFixed(3)), source: MAURICE_2022_URL } };
      }
      case 'entry_physics': {
        const z = Math.min(200, Math.max(0, Number(args.altitudeKm) || 0)) * 1000;
        const input = { entrySpeedMs: Math.min(8000, Math.max(3000, Number(args.entrySpeedMs) || 5400)), flightPathDeg: Math.min(45, Math.max(5, Number(args.flightPathDeg) || 15.5)), ballisticKgM2: 120 };
        const p = peakDeceleration(input);
        return { label: 'MARS', summary: `Density ${densityAt(z).toExponential(2)} kg/m³ at ${z / 1000} km · ballistic peak ${p.earthG.toFixed(1)} g near ${(p.altitudeM / 1000).toFixed(0)} km (non-certifying)`, output: { altitudeKm: z / 1000, densityKgM3: densityAt(z), ...input, peakDecelEarthG: Number(p.earthG.toFixed(2)), peakAltitudeKm: Number((p.altitudeM / 1000).toFixed(1)), peakSpeedMs: Math.round(p.speedMs), source: MARS_FACT_SHEET_URL, certifying: false } };
      }
      case 'mars_samples': {
        const data = (await this.openData.snapshot('samples')) as { source: string; tubes: Array<{ number: number; name: string; sol: number | null; rockType: string | null; type: string; location: string; height: string | null }> } | null;
        if (!data) throw new Error('sample snapshot missing');
        const where = args.location === 'depot' ? /depot/i : args.location === 'rover' ? /rover/i : /./;
        const tubes = data.tubes.filter((t) => where.test(t.location ?? ''));
        return { label: 'MARS', summary: `${tubes.length} sample tubes${args.location === 'depot' ? ' in the Three Forks depot' : args.location === 'rover' ? ' on the rover' : ''}; latest sealed sol ${Math.max(...tubes.map((t) => t.sol ?? 0))}`, output: { source: data.source, tubes } };
      }
      case 'ingenuity_flights': {
        const data = (await this.openData.snapshot('ingenuity')) as { source: string; flights: Array<{ flight: number; sol: number; lengthM: number; durationS: number }> } | null;
        if (!data) throw new Error('Ingenuity snapshot missing');
        const one = Number.isInteger(Number(args.flight)) ? data.flights.find((f) => f.flight === Number(args.flight)) : undefined;
        const totalKm = data.flights.reduce((s, f) => s + f.lengthM, 0) / 1000, totalMin = data.flights.reduce((s, f) => s + f.durationS, 0) / 60;
        if (one) return { label: 'MARS', summary: `Ingenuity flight ${one.flight} on sol ${one.sol}: ${one.lengthM} m ground track, ${one.durationS} s`, output: { source: data.source, flight: one } };
        return { label: 'MARS', summary: `${data.flights.length} Ingenuity flights, ${totalKm.toFixed(2)} km of ground track, ${totalMin.toFixed(0)} min in the air`, output: { source: data.source, flights: data.flights.length, totalKm: Number(totalKm.toFixed(2)), totalMinutes: Number(totalMin.toFixed(1)), longest: data.flights.reduce((m, f) => (f.lengthM > m.lengthM ? f : m)) } };
      }
      case 'weather_on_sol': {
        const data = (await this.openData.snapshot('weather')) as { sourcePage: string; sols: Array<{ sol: number; hours: Array<{ ltstHour: number; AIR_TEMP?: number; GROUND_TEMP?: number; PRESSURE?: number }> }> } | null;
        if (!data?.sols.length) throw new Error('MEDA snapshot missing');
        const want = Math.round(Number(args.sol) || 0);
        const s = data.sols.reduce((m, x) => (Math.abs(x.sol - want) < Math.abs(m.sol - want) ? x : m));
        const vals = (k: 'AIR_TEMP' | 'GROUND_TEMP' | 'PRESSURE') => s.hours.map((h) => h[k]).filter((v): v is number => v != null);
        const air = vals('AIR_TEMP'), ground = vals('GROUND_TEMP'), pres = vals('PRESSURE');
        const range = (v: number[]) => (v.length ? `${Math.min(...v).toFixed(0)}–${Math.max(...v).toFixed(0)}` : 'n/a');
        return { label: 'MARS', summary: `MEDA sol ${s.sol}${s.sol !== want ? ` (nearest snapshot to ${want})` : ''}: air ${range(air)} K, ground ${range(ground)} K, pressure ${range(pres)} Pa`, output: { source: data.sourcePage, sol: s.sol, requestedSol: want, hours: s.hours } };
      }
      case 'create_briefing': {
        const pts = this.toPoints(args.waypoints);
        if (pts.length < 2) throw new Error('at least two waypoints are required');
        const b = await this.assistant.briefing(pts.map((p, i) => ({ id: `b${i}`, ...p })));
        return { label: 'BRIEFING', summary: `Briefing: ${b.distanceKm.toFixed(2)} km, Risk Index ${b.riskIndex.total}/100`, output: { title: b.title, objectives: b.scientificObjectives, terrain: b.terrainConsiderations, riskIndex: b.riskIndex.total, sources: b.citations.slice(0, 5).map((c) => c.title) } };
      }
      default:
        throw new Error(`unknown tool ${name}`);
    }
  }

  private async runTool(call: ToolCall, ctx: Ctx): Promise<{ call: ToolCall; output: unknown; isError?: boolean }> {
    const t = Date.now();
    try {
      const r = await this.execute(call.name, call.args, ctx);
      this.step(ctx, { kind: 'tool', tool: call.name, args: call.args, summary: r.summary, label: r.label, ms: Date.now() - t });
      ctx.outputs.push({ tool: call.name, output: r.output });
      return { call, output: r.output };
    } catch (error) {
      const message = (error as Error).message;
      this.step(ctx, { kind: 'error', tool: call.name, args: call.args, summary: `${call.name} failed: ${message}`, ms: Date.now() - t });
      return { call, output: { error: message }, isError: true };
    }
  }

  private finish(goal: string, ctx: Ctx, answer: string, modelUsed: AgentModel, extra: Pick<AgentRun, 'mode' | 'router'>): AgentRun {
    const checked = this.answers.validateCitations(answer, ctx.passages.length);
    // Deterministic gate: every number must trace to a sourced tool output (or the user's own goal), or it is flagged.
    const provenance = checkProvenance(checked.text, goal, ctx.outputs.map((o) => ({ tool: o.tool, output: o.output, source: (o.output as { source?: string })?.source ?? TOOL_SOURCE[o.tool] })));
    if (!provenance.complete) this.step(ctx, { kind: 'error', summary: `Provenance incomplete: ${provenance.unmatched} number(s) not found in any tool result` });
    this.step(ctx, { kind: 'answer', summary: `Final answer via ${modelUsed} · ${Date.now() - ctx.started} ms total`, ms: Date.now() - ctx.started });
    return { goal, steps: ctx.steps, answer: checked.text, modelUsed, passages: ctx.passages, route: ctx.route, tookMs: Date.now() - ctx.started, provenance, lang: modelUsed === 'local-planner' ? 'en' : ctx.lang, offline: isOffline(), ...extra };
  }

  /** Deep mode: the LLM chooses tools turn by turn until it answers or hits the turn cap. */
  private async llmLoop(goal: string, provider: LlmProvider, ctx: Ctx): Promise<AgentRun> {
    const conv = this.llm.startConversation(provider, SYSTEM + langInstruction(ctx.lang), goal);
    this.step(ctx, { kind: 'plan', summary: `Deep mode · ${provider === 'gemini' ? `Gemini (${this.llm.geminiModel})` : `Claude (${this.llm.claudeModel})`} plans turn by turn with ${TOOLS.length} tools` });
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const t = await this.llm.turn(conv, TOOLS);
      if (!t.calls.length) {
        if (!t.text) throw new Error('model returned neither text nor tool calls');
        ctx.emit({ type: 'token', data: t.text });
        return this.finish(goal, ctx, t.text, provider, { mode: 'deep' });
      }
      if (t.text) this.step(ctx, { kind: 'plan', summary: t.text.slice(0, 300) });
      const results = await Promise.all(t.calls.slice(0, 6).map((call) => this.runTool(call, ctx)));
      this.llm.addToolResults(conv, results);
    }
    const final = await this.compose(goal, ctx, true);
    return this.finish(goal, ctx, final.text, final.model, { mode: 'deep' });
  }

  /** "System Two" writer: one streamed generation over the gathered evidence, or an extractive summary without a model. */
  private async compose(goal: string, ctx: Ctx, cloud: boolean): Promise<{ text: string; model: AgentModel }> {
    if (cloud && this.llm.providers.length) {
      const evidence = ctx.outputs.map((o) => `${o.tool}: ${JSON.stringify(o.output).slice(0, 1500)}`).join('\n');
      const passages = ctx.passages.map((p) => `[${p.n}] ${p.title}${p.heading ? ` — ${p.heading}` : ''}: ${p.text.slice(0, 700)}`).join('\n');
      try {
        const done = await this.llm.stream(SYSTEM, `Tool results:\n${evidence || '(none)'}\n\nPassages:\n${passages || '(none)'}\n\nGoal: ${goal}\nWrite the final answer now from this evidence only.${langInstruction(ctx.lang)}`, (d) => ctx.emit({ type: 'token', data: d }));
        if (done) return { text: done.text, model: done.provider };
      } catch (error) {
        this.log.warn(`compose stream failed: ${(error as Error).message}`);
        ctx.emit({ type: 'reset' });
      }
    }
    const strong = ctx.outputs.some((o) => o.tool === 'search_knowledge' && (o.output as { evidenceStrong?: boolean }).evidenceStrong);
    const rag = strong ? this.answers.extractive(goal, ctx.passages).text : '';
    const toolLines = ctx.steps.filter((s) => s.kind === 'tool' && s.tool !== 'search_knowledge').map((s) => `${s.summary}.`);
    const text = [toolLines.join(' '), rag].filter(Boolean).join('\n\n') || 'The indexed NASA sources and tools did not return enough evidence for this goal.';
    const full = `${text}${ctx.route ? '\n\nRoutes and the Risk Index are non-certifying research aids.' : ''}`;
    ctx.emit({ type: 'token', data: full });
    return { text: full, model: 'local-planner' };
  }

  /**
   * Fast mode: System One router (Jev, else rules) picks every tool in one pass, independent tools run in parallel,
   * then one streamed generation writes the answer. No multi-turn planning round-trips.
   */
  private async fastPlan(goal: string, ctx: Ctx, cloud: boolean): Promise<AgentRun> {
    const r = await this.router.route(goal);
    const needsStart = (r.route || r.eva || r.los || r.energy) && (/landing/i.test(goal) || r.sols.length < 2);
    const plan = planTools(r, goal);
    const conf = r.confidence ? ` · p(route)=${r.confidence.route} p(earth)=${r.confidence.earth} p(orbit)=${r.confidence.orbit}` : '';
    this.step(ctx, { kind: 'plan', summary: `System One router · ${r.engine === 'jev' ? `Jev (${this.router.model})` : 'deterministic rules'} · ${r.ms} ms → ${plan.join(' + ')}${conf}`, ms: r.ms });

    const call = async (name: string, args: Record<string, unknown>) => {
      const res = await this.runTool({ id: `f${ctx.steps.length}-${name}`, name, args }, ctx);
      return res.isError ? undefined : (res.output as Record<string, unknown>);
    };
    // Phase 1: independent tools in parallel.
    const sols = [...new Set([...(needsStart ? [0] : []), ...r.sols])];
    const positionResults = await Promise.all(sols.map((sol) => call('rover_position', { sol })));
    await Promise.all([
      plan.includes('search_knowledge') ? call('search_knowledge', { query: goal }) : Promise.resolve(undefined),
      ...(r.sols.length ? sols.slice(0, 2).map((sol) => call('rover_images', { sol, limit: 4 })) : []),
      ...(r.earth ? [call('earth_events', { limit: 5 })] : []),
      ...(r.orbit ? [call('orbit_geometry', r.date ? { date: r.date } : {})] : []),
      ...(r.opendata ? [call('nasa_open_data', { query: goal })] : []),
      ...(r.hardware ? [call('mars_hardware', {})] : []),
      ...(r.time ? [call('mars_time', {})] : []),
      ...(r.comms ? [call('comm_window', r.date ? { from: r.date } : {})] : []),
      ...(r.sites ? [call('site_suitability', {})] : []),
      ...(r.power ? [call('solar_power', {})] : []),
      ...(r.sound ? [call('sound_on_mars', {})] : []),
      ...(r.entry ? [call('entry_physics', {})] : []),
      ...(r.samples ? [call('mars_samples', { location: /depot|three forks/i.test(goal) ? 'depot' : /rover|onboard|carr/i.test(goal) ? 'rover' : 'all' })] : []),
      ...(r.ingenuity ? [call('ingenuity_flights', /flight\s*(\d{1,2})/i.test(goal) ? { flight: Number(/flight\s*(\d{1,2})/i.exec(goal)![1]) } : {})] : []),
      ...(r.weather ? [call('weather_on_sol', { sol: r.sols[0] ?? 0 })] : []),
    ]);
    // Named features need a point: a rover position asked for, else the landing site of a mission the goal names, else Perseverance's.
    if (r.names) {
      const at = positionResults.find(Boolean);
      const site = NASA_MARS_LANDINGS.find((s) => s.mission === detectMission(goal)) ?? JEZERO_LANDING;
      await call('named_features', at ? { lat: Number(at.lat), lon: Number(at.lon) } : { lat: site.lat, lon: site.lon });
    }
    // Phase 2: route tools depend on the positions.
    if (r.route || r.briefing || r.eva || r.los || r.energy) {
      const pts = positionResults.filter(Boolean).map((p) => ({ lat: Number(p!.lat), lon: Number(p!.lon) }));
      const [start, end] = [pts[0], pts.at(-1)];
      if (start && end && (start.lat !== end.lat || start.lon !== end.lon)) {
        const corridor = await call('suggest_corridor', { start, end });
        const waypoints = (corridor?.waypoints as LatLon[]) ?? [start, end];
        await Promise.all([call('analyze_route', { waypoints }), ...(r.briefing ? [call('create_briefing', { waypoints })] : []), ...(r.eva ? [call('eva_budget', { waypoints })] : []), ...(r.energy ? [call('drive_energy', { waypoints })] : []), ...(r.los ? [call('line_of_sight', { start, end })] : [])]);
      }
    }
    const final = await this.compose(goal, ctx, cloud);
    return this.finish(goal, ctx, final.text, final.model, { mode: 'fast', router: r.engine });
  }

  /** Voice Live relay: one context per voice session; tools keep the agent's validation, steps and provenance gate. */
  voiceSession(lang: AnswerLang, emit: (e: AgentEvent) => void) {
    const ctx: Ctx = { lang, passages: [], steps: [], outputs: [], emit, started: Date.now() };
    return {
      tools: TOOLS,
      run: async (name: string, args: Record<string, unknown>) => (await this.runTool({ id: `v${ctx.steps.length}-${name}`, name, args }, ctx)).output,
      route: () => ctx.route,
      provenance: (answer: string, goal: string) => checkProvenance(answer, goal, ctx.outputs.map((o) => ({ tool: o.tool, output: o.output, source: (o.output as { source?: string })?.source ?? TOOL_SOURCE[o.tool] }))),
    };
  }

  toolCatalog() {
    return {
      tools: TOOLS.map(({ name, description }) => ({ name, description })), providers: this.llm.status,
      models: { gemini: this.llm.geminiModel, claude: this.llm.claudeModel, router: this.router.available ? this.router.model : 'deterministic rules' }, maxTurns: MAX_TURNS,
    };
  }

  async run(goal: string, opts: { cloud: boolean; mode: 'fast' | 'deep'; lang?: AnswerLang }, emit: (e: AgentEvent) => void = () => {}): Promise<AgentRun> {
    const ctx: Ctx = { lang: opts.lang ?? 'en', passages: [], steps: [], outputs: [], emit, started: Date.now() };
    if (opts.mode === 'deep' && opts.cloud) {
      for (const provider of this.llm.providers) {
        try {
          return await this.llmLoop(goal, provider, ctx);
        } catch (error) {
          this.log.warn(`${provider} agent loop failed: ${(error as Error).message}`);
          this.step(ctx, { kind: 'error', summary: `${provider} unavailable (${(error as Error).message.slice(0, 120)}); falling back` });
          ctx.emit({ type: 'reset' });
          ctx.passages = []; ctx.outputs = []; ctx.route = undefined;
        }
      }
    }
    return this.fastPlan(goal, ctx, opts.cloud);
  }
}
