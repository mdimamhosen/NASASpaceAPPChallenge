import { Injectable, Logger } from '@nestjs/common';
import type { AgentLabel, AgentModel, AgentRun, AgentStep, LatLon, RagPassage, RouteWaypoint } from '@mars-explorer/shared';
import { earthMarsGeometry } from '@mars-explorer/shared';
import { EonetService } from '../eonet/eonet.service';
import { PlacesService } from '../places/places.service';
import { AnswerService } from '../rag/answer.service';
import { LlmService, type LlmProvider, type ToolCall, type ToolSpec } from '../rag/llm.service';
import { RetrieverService } from '../rag/retriever.service';
import { RegionsService } from '../regions/regions.service';
import { RoutesService } from '../routes/routes.service';
import { AssistantService } from './assistant.service';
import { JevRouterService } from './jev-router.service';
import { getEarthNaturalEvents } from './tools/earth-events.tool';

type ToolResult = { output: unknown; summary: string; label: AgentLabel };
export type AgentEvent = { type: 'step'; data: AgentStep } | { type: 'token'; data: string } | { type: 'reset' };
type Ctx = { passages: RagPassage[]; route?: RouteWaypoint[]; steps: AgentStep[]; outputs: Array<{ tool: string; output: unknown }>; emit: (e: AgentEvent) => void; started: number };

const MAX_TURNS = 8;
const point = { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number', description: 'East-positive longitude' } }, required: ['lat', 'lon'] };

const TOOLS: ToolSpec[] = [
  { name: 'search_knowledge', description: 'Hybrid search of the cited NASA corpus (Perseverance, Jezero, instruments, samples, PLACES, Mars Trek, EONET docs, other NASA landers). Returns numbered passages to cite as [n].', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'verified_locations', description: 'NASA-verified Perseverance locations in Jezero from published PLACES records (landing/sol 0, sol 400, 700, 1000) with coordinates.', parameters: { type: 'object', properties: {} } },
  { name: 'rover_position', description: "Perseverance's published PLACES localization closest to a given sol, with coordinates and elevation.", parameters: { type: 'object', properties: { sol: { type: 'integer' } }, required: ['sol'] } },
  { name: 'suggest_corridor', description: 'Coarse slope-weighted A* corridor between two points on the PLACES orbital DEM grid. Non-certifying.', parameters: { type: 'object', properties: { start: point, end: point }, required: ['start', 'end'] } },
  { name: 'analyze_route', description: 'Distance, DEM coverage, elevation change, and non-certifying Traverse Risk Index for a route of 2–24 waypoints.', parameters: { type: 'object', properties: { waypoints: { type: 'array', items: point } }, required: ['waypoints'] } },
  { name: 'earth_events', description: 'Open NASA EONET natural events on EARTH (wildfires, storms, ice). Earth only; never Mars conditions.', parameters: { type: 'object', properties: { category: { type: 'string', description: 'Optional EONET category id, e.g. wildfires, severeStorms, seaLakeIce' }, limit: { type: 'integer' } } } },
  { name: 'orbit_geometry', description: 'Earth–Mars distance and one-way light time on a date, from NASA JPL approximate Keplerian elements.', parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD; defaults to today' } } } },
  { name: 'create_briefing', description: 'Deterministic mission briefing for a route (objectives, terrain considerations, Risk Index components, sources).', parameters: { type: 'object', properties: { waypoints: { type: 'array', items: point } }, required: ['waypoints'] } },
];

const SYSTEM = [
  "You are the Mars Explorer mission agent for NASA's Perseverance site in Jezero Crater. Plan briefly, then use tools to gather evidence before answering.",
  'Rules:',
  '- For mission, science, instrument, or data-source facts, call search_knowledge and cite the passages you rely on as [n] using the numbers it returns.',
  '- Never invent coordinates. Get them from verified_locations or rover_position.',
  '- To plan a route: get endpoints, call suggest_corridor, then analyze_route on the corridor it returns.',
  '- earth_events returns EARTH data only. Label it EARTH / EONET and never present it as Mars conditions.',
  '- Routes, corridors, and the Risk Index are non-certifying research aids; never call anything safe.',
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
    this.step(ctx, { kind: 'answer', summary: `Final answer via ${modelUsed} · ${Date.now() - ctx.started} ms total`, ms: Date.now() - ctx.started });
    return { goal, steps: ctx.steps, answer: checked.text, modelUsed, passages: ctx.passages, route: ctx.route, tookMs: Date.now() - ctx.started, ...extra };
  }

  /** Deep mode: the LLM chooses tools turn by turn until it answers or hits the turn cap. */
  private async llmLoop(goal: string, provider: LlmProvider, ctx: Ctx): Promise<AgentRun> {
    const conv = this.llm.startConversation(provider, SYSTEM, goal);
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
        const done = await this.llm.stream(SYSTEM, `Tool results:\n${evidence || '(none)'}\n\nPassages:\n${passages || '(none)'}\n\nGoal: ${goal}\nWrite the final answer now from this evidence only.`, (d) => ctx.emit({ type: 'token', data: d }));
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
    const needsStart = r.route && (/landing/i.test(goal) || r.sols.length < 2);
    const plan = [...(r.knowledge ? ['search_knowledge'] : []), ...(r.sols.length || needsStart ? ['rover_position'] : []), ...(r.route ? ['suggest_corridor', 'analyze_route'] : []), ...(r.briefing ? ['create_briefing'] : []), ...(r.earth ? ['earth_events'] : []), ...(r.orbit ? ['orbit_geometry'] : [])];
    const conf = r.confidence ? ` · p(route)=${r.confidence.route} p(earth)=${r.confidence.earth} p(orbit)=${r.confidence.orbit}` : '';
    this.step(ctx, { kind: 'plan', summary: `System One router · ${r.engine === 'jev' ? `Jev (${this.router.model})` : 'deterministic rules'} · ${r.ms} ms → ${plan.join(' + ') || 'search_knowledge'}${conf}`, ms: r.ms });

    const call = async (name: string, args: Record<string, unknown>) => {
      const res = await this.runTool({ id: `f${ctx.steps.length}-${name}`, name, args }, ctx);
      return res.isError ? undefined : (res.output as Record<string, unknown>);
    };
    // Phase 1: independent tools in parallel.
    const sols = [...new Set([...(needsStart ? [0] : []), ...r.sols])];
    const [, ...positions] = await Promise.all([
      r.knowledge || !plan.length ? call('search_knowledge', { query: goal }) : Promise.resolve(undefined),
      ...sols.map((sol) => call('rover_position', { sol })),
      ...(r.earth ? [call('earth_events', { limit: 5 })] : []),
      ...(r.orbit ? [call('orbit_geometry', r.date ? { date: r.date } : {})] : []),
    ]);
    // Phase 2: route tools depend on the positions.
    if (r.route || r.briefing) {
      const pts = positions.slice(0, sols.length).filter(Boolean).map((p) => ({ lat: Number(p!.lat), lon: Number(p!.lon) }));
      const [start, end] = [pts[0], pts.at(-1)];
      if (start && end && (start.lat !== end.lat || start.lon !== end.lon)) {
        const corridor = await call('suggest_corridor', { start, end });
        const waypoints = (corridor?.waypoints as LatLon[]) ?? [start, end];
        await Promise.all([call('analyze_route', { waypoints }), ...(r.briefing ? [call('create_briefing', { waypoints })] : [])]);
      }
    }
    const final = await this.compose(goal, ctx, cloud);
    return this.finish(goal, ctx, final.text, final.model, { mode: 'fast', router: r.engine });
  }

  toolCatalog() {
    return {
      tools: TOOLS.map(({ name, description }) => ({ name, description })), providers: this.llm.status,
      models: { gemini: this.llm.geminiModel, claude: this.llm.claudeModel, router: this.router.available ? this.router.model : 'deterministic rules' }, maxTurns: MAX_TURNS,
    };
  }

  async run(goal: string, opts: { cloud: boolean; mode: 'fast' | 'deep' }, emit: (e: AgentEvent) => void = () => {}): Promise<AgentRun> {
    const ctx: Ctx = { passages: [], steps: [], outputs: [], emit, started: Date.now() };
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
