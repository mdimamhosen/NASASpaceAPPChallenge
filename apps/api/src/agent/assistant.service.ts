import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { CallbackHandler as LangfuseCallbackHandler } from '@langfuse/langchain';
import type { AssistantResponse, Citation, MissionBriefing, RouteAnalysis, RouteWaypoint } from '@mars-explorer/shared';
import type { AppConfig } from '../config/configuration';
import { EonetService } from '../eonet/eonet.service';
import { RetrieverService } from '../rag/retriever.service';
import { RoutesService } from '../routes/routes.service';
import { getEarthNaturalEvents } from './tools/earth-events.tool';
import type { CorpusDoc } from '../rag/corpus-loader.service';

const AgentState = Annotation.Root({
  question: Annotation<string>(),
  intent: Annotation<'ask' | 'briefing'>(),
  docs: Annotation<CorpusDoc[]>({ reducer: (_, next) => next, default: () => [] }),
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
  ) {
    this.graph = new StateGraph(AgentState)
      .addNode('retrieve', async (state) => ({ docs: await this.retriever.retrieve(state.question) }))
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
      .addNode('grade', (state) => ({ refused: state.docs.length === 0 && !state.usedEarthTool }))
      .addNode('synthesize', async (state) => this.synthesize(state.question, state.docs, state.earthContext, state.useCloudModels))
      .addNode('refuse', () => ({
        answer: 'The local NASA notes do not contain enough evidence to answer that question reliably.',
      }))
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

  private async synthesize(
    question: string,
    docs: CorpusDoc[],
    earthContext: string,
    useCloudModels: boolean,
  ): Promise<{ answer: string; modelUsed: AssistantResponse['modelUsed'] }> {
    const evidence = docs
      .map((doc) => `- ${doc.title}: ${doc.excerpt || doc.body.slice(0, 260)}`)
      .join('\n');
    const localAnswer = [
      `The available mission notes provide this context for your question:`,
      evidence,
      earthContext ? `EARTH CONTEXT (EONET — Earth only):\n${earthContext}` : '',
      'Planning context only. This is not a route safety determination.',
    ]
      .filter(Boolean)
      .join('\n\n');
    const provider = useCloudModels ? await this.tryProvider(question, docs, earthContext) : undefined;
    return provider ?? { answer: localAnswer, modelUsed: 'local-evidence' };
  }

  private async tryProvider(
    question: string,
    docs: CorpusDoc[],
    earthContext: string,
    selectedProvider?: 'anthropic' | 'gemini' | 'deepseek',
  ): Promise<{ answer: string; modelUsed: AssistantResponse['modelUsed'] } | undefined> {
    const context = docs.map((doc) => `${doc.title}: ${doc.body}`).join('\n\n');
    const prompt = `Answer only from this evidence. If evidence is insufficient, say so. Do not invent locations or safety findings. Cite source titles. If EARTH/EONET context appears, label it clearly as Earth-only comparative context — never as Mars hazards.\n\nEVIDENCE:\n${context}\n\n${earthContext ? `EARTH_EONET:\n${earthContext}\n\n` : ''}QUESTION: ${question}`;
    const providers: Array<{ key?: string; model: string; endpoint: string; kind: string }> = [
      { key: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY, model: 'claude-3-5-haiku-latest', endpoint: 'https://api.anthropic.com/v1/messages', kind: 'anthropic' },
      { key: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY, model: 'gemini-2.0-flash', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models', kind: 'gemini' },
      { key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat', endpoint: 'https://api.deepseek.com/chat/completions', kind: 'deepseek' },
    ];
    const orderedProviders = selectedProvider ? providers.filter((provider) => provider.kind === selectedProvider) : providers;
    for (const provider of orderedProviders) {
      if (!provider.key) continue;
      try {
        const response =
          provider.kind === 'anthropic'
            ? await fetch(provider.endpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-api-key': provider.key, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: provider.model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
                signal: AbortSignal.timeout(12000),
              })
            : provider.kind === 'gemini'
              ? await fetch(`${provider.endpoint}/${provider.model}:generateContent?key=${provider.key}`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                  signal: AbortSignal.timeout(12000),
                })
              : await fetch(provider.endpoint, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.key}` },
                  body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], max_tokens: 500 }),
                  signal: AbortSignal.timeout(12000),
                });
        if (!response.ok) continue;
        const data = (await response.json()) as any;
        const text =
          provider.kind === 'anthropic'
            ? data.content?.[0]?.text
            : provider.kind === 'gemini'
              ? data.candidates?.[0]?.content?.parts?.[0]?.text
              : data.choices?.[0]?.message?.content;
        if (typeof text === 'string' && text.trim()) {
          return {
            answer: text.trim(),
            modelUsed: provider.kind === 'anthropic' ? 'claude' : provider.kind === 'gemini' ? 'gemini' : 'deepseek',
          };
        }
      } catch {
        /* Provider failures fall through. */
      }
    }
    return undefined;
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
    const cited = result.docs as CorpusDoc[];
    const citations: Citation[] = cited.map(({ title, url, mission, excerpt }) => ({ title, url, mission, excerpt }));
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
      for (const model of models) {
        const response = await this.tryProvider(question, cited, result.earthContext ?? '', model.provider);
        comparison.push({ model: model.name, answer: response?.answer ?? `${model.name} is not configured or is currently unavailable.` });
      }
    }
    this.lastTrace = [
      { step: 'retrieve', detail: `${cited.length} local source note(s) matched` },
      { step: 'earth_tool', detail: result.usedEarthTool ? 'EARTH / EONET events consulted' : 'Skipped; no Earth context requested' },
      { step: 'grade', detail: result.refused ? 'Insufficient evidence' : 'Evidence available' },
      { step: 'synthesize', detail: result.modelUsed === 'local-evidence' ? 'Local template; no model call' : `Explicit cloud model: ${result.modelUsed}` },
    ];
    return {
      answer,
      citations,
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

  async briefing(waypoints: RouteWaypoint[]): Promise<MissionBriefing> {
    const analysis: RouteAnalysis = await this.routes.analyze(waypoints);
    const docs = await this.retriever.retrieve('Perseverance mission objectives Jezero Crater geology habitability samples', 3);
    const citations: Citation[] = docs.map(({ title, url, mission, excerpt }) => ({ title, url, mission, excerpt }));
    const objectives = [
      'Study Jezero Crater geology and past habitability.',
      'Search for signs of ancient microbial life.',
      'Collect and cache samples for possible future return.',
    ];
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
