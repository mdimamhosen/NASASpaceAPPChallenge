import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { CallbackHandler as LangfuseCallbackHandler } from '@langfuse/langchain';
import type { AssistantResponse, Citation, MissionBriefing, RagPassage, RouteAnalysis, RouteWaypoint } from '@mars-explorer/shared';
import type { AppConfig } from '../config/configuration';
import { EonetService } from '../eonet/eonet.service';
import { AnswerService, REFUSAL } from '../rag/answer.service';
import { LlmService } from '../rag/llm.service';
import { RetrieverService } from '../rag/retriever.service';
import { RoutesService } from '../routes/routes.service';
import { getEarthNaturalEvents } from './tools/earth-events.tool';
import { TraceStoreService } from './trace-store.service';

const AgentState = Annotation.Root({
  question: Annotation<string>(),
  intent: Annotation<'ask' | 'briefing'>(),
  passages: Annotation<RagPassage[]>({ reducer: (_, next) => next, default: () => [] }),
  strong: Annotation<boolean>({ reducer: (_, next) => next, default: () => false }),
  mode: Annotation<string>({ reducer: (_, next) => next, default: () => 'hybrid' }),
  earthContext: Annotation<string>({ reducer: (_, next) => next, default: () => '' }),
  usedEarthTool: Annotation<boolean>({ reducer: (_, next) => next, default: () => false }),
  answer: Annotation<string>({ reducer: (_, next) => next, default: () => '' }),
  refused: Annotation<boolean>({ reducer: (_, next) => next, default: () => false }),
  modelUsed: Annotation<AssistantResponse['modelUsed']>({ reducer: (_, next) => next, default: () => 'local-evidence' }),
  useCloudModels: Annotation<boolean>({ reducer: (_, next) => next, default: () => false }),
});

@Injectable()
export class AssistantService {
  private graph: any;
  private lastTrace: Array<{ step: string; detail: string }> = [];

  constructor(
    private readonly retriever: RetrieverService,
    private readonly routes: RoutesService,
    private readonly eonet: EonetService,
    private readonly config: ConfigService,
    private readonly traceStore: TraceStoreService,
    private readonly answers: AnswerService,
    private readonly llm: LlmService,
  ) {
    this.graph = new StateGraph(AgentState)
      .addNode('retrieve', async (state) => { const res = await this.retriever.search(state.question, 6); return { passages: res.passages, strong: res.strong, mode: res.mode }; })
      .addNode('earth_tool', async (state) => {
        if (!this.shouldUseEarthTool(state.question)) return { earthContext: '', usedEarthTool: false };
        const result = await getEarthNaturalEvents(this.eonet, { limit: 6, days: 20 });
        const lines = result.events
          .slice(0, 6)
          .map((event) => `- [EARTH/EONET] ${event.title} (${event.category}${event.date ? `, ${event.date}` : ''})`)
          .join('\n');
        return {
          usedEarthTool: true,
          earthContext: `${result.note}\n${lines || '- No open EONET events returned.'}`,
        };
      })
      .addNode('grade', (state) => ({ refused: !state.strong && !state.usedEarthTool }))
      .addNode('synthesize', async (state) => {
        const res = await this.answers.answer(state.question, { query: state.question, mode: state.mode as 'hybrid', semantic: true, strong: state.strong, passages: state.passages, tookMs: 0 }, { useCloud: state.useCloudModels, earthContext: state.earthContext });
        return { answer: res.answer, refused: res.refused, modelUsed: res.modelUsed };
      })
      .addNode('refuse', () => ({ answer: REFUSAL }))
      .addEdge(START, 'retrieve')
      .addEdge('retrieve', 'earth_tool')
      .addEdge('earth_tool', 'grade')
      .addConditionalEdges('grade', (state) => (state.refused ? 'refuse' : 'synthesize'))
      .addEdge('synthesize', END)
      .addEdge('refuse', END)
      .compile();
  }

  private shouldUseEarthTool(question: string): boolean {
    return /\b(earth|eonet|wildfire|storm|volcano|landslide|compare|analog|natural event)\b/i.test(question);
  }

  async ask(question: string, waypoints: RouteWaypoint[] = [], useCloudModels = false, compareModels = false): Promise<AssistantResponse> {
    const observabilityBackend = this.config.get<AppConfig['observabilityBackend']>('observabilityBackend');
    if (observabilityBackend === 'langsmith' && process.env.LANGCHAIN_API_KEY) {
      process.env.LANGCHAIN_TRACING_V2 = 'true';
      process.env.LANGCHAIN_PROJECT ||= 'mars-explorer';
    }
    const useLangfuse = observabilityBackend === 'langfuse' && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY;
    const result = await this.graph.invoke(
      { question, intent: 'ask', useCloudModels },
      useLangfuse ? { callbacks: [new LangfuseCallbackHandler({ tags: ['mars-explorer', 'agentic-rag'] })] } : undefined,
    );
    const analysis = waypoints.length > 1 ? await this.routes.analyze(waypoints) : undefined;
    const passages = result.passages as RagPassage[];
    const seen = new Set<string>();
    const citations: Citation[] = passages.filter((p) => !seen.has(p.docId) && seen.add(p.docId)).map((p) => ({ title: p.title, url: p.url, excerpt: p.text.slice(0, 300) }));
    if (analysis) citations.push(...analysis.nearbyPois.filter((poi)=>poi.sourceKind==='NASA_PLACES').map((poi)=>({title:poi.name,url:poi.sourceUrl,mission:'PLACES',excerpt:poi.summary})));
    if (result.usedEarthTool) {
      citations.push({
        title: 'NASA EONET v3 — Earth natural events',
        url: 'https://eonet.gsfc.nasa.gov/docs/v3',
        mission: 'EONET',
        excerpt: 'Earth Observatory Natural Event Tracker. EARTH-only; not Mars surface data.',
      });
    }
    const answer =
      analysis && !result.refused
        ? `${result.answer}\n\nCurrent sketch: ${analysis.distanceKm.toFixed(2)} km; non-certifying ${analysis.terrainMethod} Risk Index ${analysis.riskScore}/100. ${analysis.riskNotes.join(' ')}`
        : result.answer;
    const comparison: NonNullable<AssistantResponse['comparison']> = [];
    if (useCloudModels && compareModels && !result.refused) {
      const models = [
        { name: 'Claude', provider: 'anthropic' as const },
        { name: 'Gemini', provider: 'gemini' as const },
      ];
      const context = passages.map((p) => `[${p.n}] ${p.title}: ${p.text}`).join('\n\n');
      const prompt = `${context}${result.earthContext ? `\n\nEARTH / EONET (Earth only):\n${result.earthContext}` : ''}\n\nQuestion: ${question}`;
      const system = 'Answer only from the numbered passages and cite them as [n]. Label any Earth/EONET content as Earth-only. Under 150 words.';
      for (const model of models) {
        const text = await this.llm.completeWith(model.provider === 'anthropic' ? 'claude' : 'gemini', system, prompt);
        comparison.push({ model: model.name, answer: text ?? `${model.name} is not configured or is currently unavailable.` });
      }
    }
    this.lastTrace = [
      { step: 'retrieve', detail: `${passages.length} passages via ${result.mode} retrieval (BM25 + Gemini embeddings, RRF/MMR); evidence ${result.strong ? 'strong' : 'weak'}` },
      { step: 'earth_tool', detail: result.usedEarthTool ? 'EARTH / EONET events consulted' : 'Skipped; no Earth context requested' },
      { step: 'grade', detail: result.refused ? 'Insufficient evidence' : 'Evidence available' },
      { step: 'synthesize', detail: result.modelUsed === 'local-evidence' ? 'Extractive cited answer; no model call' : `Grounded generation via ${result.modelUsed} with validated [n] citations` },
    ];
    const traceId = await this.traceStore.save(question, this.lastTrace);
    return {
      answer,
      citations,
      passages,
      traceId,
      trace: this.lastTrace,
      modelUsed: result.modelUsed,
      refused: result.refused,
      ...(comparison.length ? { comparison } : {}),
      ...(process.env.LANGCHAIN_TRACING_V2 === 'true' || observabilityBackend
        ? { observabilityBackend: observabilityBackend ?? 'langsmith' }
        : {}),
    };
  }

  getTrace() { return this.lastTrace; }
  getRecentTraces() { return this.traceStore.recent(); }

  async briefing(waypoints: RouteWaypoint[]): Promise<MissionBriefing> {
    const analysis: RouteAnalysis = await this.routes.analyze(waypoints);
    const docs = await this.retriever.retrieve('Perseverance mission objectives Jezero Crater geology habitability samples', 3);
    const citations: Citation[] = docs.map(({ title, url, mission, excerpt }) => ({ title, url, mission, excerpt }));
    const objectives = [
      'Study Jezero Crater geology and past habitability.',
      'Search for signs of ancient microbial life.',
      'Collect and cache samples for possible future return.',
    ];
    citations.push(...analysis.nearbyPois.filter((poi)=>poi.sourceKind==='NASA_PLACES').map((poi)=>({title:poi.name,url:poi.sourceUrl,mission:'PLACES',excerpt:poi.summary})));
    const observations = citations.map((citation) => `${citation.title}: ${citation.excerpt}`);
    const markdown = [
      '# Jezero Marswalk Mission Briefing',
      '',
      `**Route length:** ${analysis.distanceKm.toFixed(2)} km`,
      `**Exploration points:** ${waypoints.length}`,
      `**Traverse Risk Index (NON-CERTIFYING):** ${analysis.riskScore}/100 · ${analysis.terrainMethod}`,
      ...analysis.riskIndex.components.map((item) => `- ${item.label}: ${item.score} / ${item.source}`),
      '',
      '## Scientific objectives',
      ...objectives.map((item) => `- ${item}`),
      '',
      '## Terrain considerations',
      ...analysis.riskNotes.map((item) => `- ${item}`),
      '',
      '## Nearby science context',
      ...(analysis.nearbyPois.length
        ? analysis.nearbyPois.map((poi) => `- ${poi.name}: ${poi.summary}`)
        : ['- No verified science points are associated with this route.']),
      '',
      '## Sources',
      ...citations.map((citation) => `- [${citation.title}](${citation.url}) — ${citation.excerpt}`),
      '',
      '*Planning context only. DTM samples and application risk weights are non-certifying and not operational or safety guidance.*',
    ].join('\n');
    return {
      title: 'Jezero Marswalk Mission Briefing',
      distanceKm: analysis.distanceKm,
      explorationPoints: waypoints.length,
      scientificObjectives: objectives,
      terrainConsiderations: analysis.riskNotes,
      relevantObservations: observations,
      recommendedInvestigationPoints: analysis.nearbyPois.map((poi) => poi.name),
      citations,
      markdown,
      riskIndex: analysis.riskIndex,
    };
  }
}
