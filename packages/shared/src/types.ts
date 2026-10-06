export type LatLon = { lat: number; lon: number };
export type LayerId = 'imagery' | 'viking' | 'hrsc-color' | 'hrsc-shade' | 'hazards' | 'pois' | 'hirise' | 'names' | 'landings' | 'hardware';
export type MapLayer = { id: LayerId; name: string; description: string; source: string; trekLayerId?: string; enabledByDefault: boolean };
export type POI = { id: string; name: string; lat: number; lon: number; category: 'geology' | 'mission' | 'hazard' | 'other'; summary: string; sourceUrl: string; mission?: string; sourceKind?: 'NASA_PLACES' | 'DEMO' };
export type RouteWaypoint = LatLon & { id: string };
export type TerrainMethod = 'heuristic' | 'dtm-sample' | 'postgis-jezero';
export type PlacesPoint = LatLon & { sol: number; elevationM?: number; sclk?: number };
export type PlacesTrack = { provider: 'PLACES'; label: 'MARS'; quality: 'interpolated_published'; sourceUrl: string; retrievedAt: string; latestSol: number; points: PlacesPoint[] };
export type RiskBreakdown = { total: number; components: Array<{ id: string; label: string; score: number; source: string }>; method: TerrainMethod; certifying: false };
export type TerrainSample = LatLon & { elevationM: number; slopeDeg?: number };
export type DtmGrid = { product: string; sourceUrl: string; labelUrl: string; latMin: number; lonMin: number; sampleSpacingDegrees: number; rows: Array<Array<number | null>>; nonCertifying: true };
export type SuggestedRoute = { waypoints: RouteWaypoint[]; method: 'dtm-grid-astar'; sourceUrl: string; certifying: false; note: string };
export type RouteAnalysis = { distanceKm: number; riskScore: number; riskNotes: string[]; nearbyPois: POI[]; elevationDeltaM?: number; terrainMethod: TerrainMethod; riskIndex: RiskBreakdown; terrainSamples: TerrainSample[]; dtmCoverage: number; suggestedPath?: RouteWaypoint[]; openData?: RouteOpenData };

// NASA Open Data (data.nasa.gov, tag "mars") — snapshotted by scripts/refresh-open-data.py.
export type OpenDataset = { id: string; title: string; notes: string; publisher: string; landingPage: string; identifier: string; modified: string; license: string; url: string; resources: string[]; missions: string[] };
export type OpenDataProvenance = { source: 'live' | 'snapshot'; fetchedAt: string; sourceUrl: string; note?: string };
export type OpenCatalogResult = { total: number; offset: number; items: OpenDataset[]; missions: Array<{ mission: string; count: number }>; provenance: OpenDataProvenance };
export type MarsFeature = { id: string; name: string; type: string; code: string; lat: number; lon: number; diameterKm: number; approved: string; origin: string; quad: string; link: string };
export type HiriseDtm = { id: string; rationale: string; leftObservation: string; rightObservation: string; scaleM: number; projection: string; corners: Array<[number, number]>; pdsUrl: string };
export type MissionLanding = { year: number; name: string; mission: string; place: string; lat: number; lon: number; datasetCount: number; datasets: Array<Pick<OpenDataset, 'id' | 'title' | 'url'>>; catalogUrl: string };
export type OpenDataProduct = { key: string; product: string; datasetUrl: string; sourceUrl: string; retrievedAt: string; count: number; sha256: string; usedFor: string };
// NASA hardware left on (or still working on) Mars — challenge 1 overlap. Position basis is always stated.
export type MarsHardware = { id: string; name: string; mission: string; kind: 'lander' | 'rover' | 'helicopter'; status: 'silent' | 'active'; landed: string; lastContact: string | null; whySilent: string | null; sourceUrl: string; lat: number; lon: number; positionBasis: 'landing-site' | 'places-latest'; positionNote: string };
/** Where a value came from: upstream now, the local cache, a committed demo fixture, or OFFLINE=1 forcing local data. */
export type SourceLabel = 'live' | 'cache' | 'fixture' | 'snapshot' | 'offline';
export type RouteOpenData = { namedFeatures: Array<MarsFeature & { distanceKm: number }>; hiriseDtms: Array<Pick<HiriseDtm, 'id' | 'rationale' | 'scaleM' | 'pdsUrl'> & { coveredShare: number }>; sources: { features: string; dtm: string } };
export type Citation = { title: string; url: string; mission?: string; excerpt: string };
export type AssistantResponse = { answer: string; citations: Citation[]; passages?: RagPassage[]; modelUsed: 'claude' | 'gemini' | 'deepseek' | 'local-evidence'; refused: boolean; traceId?: string; observabilityBackend?: 'langsmith' | 'langfuse'; comparison?: Array<{ model: string; answer: string }>; trace?: Array<{ step: string; detail: string }> };
export type MissionBriefing = { title: string; distanceKm: number; explorationPoints: number; scientificObjectives: string[]; terrainConsiderations: string[]; relevantObservations: string[]; recommendedInvestigationPoints: string[]; citations: Citation[]; markdown: string; riskIndex: RiskBreakdown };
export type RegionData = { id: string; name: string; center: LatLon; bounds: [[number, number], [number, number]]; demoOverlay: boolean; pois: POI[]; hazards: Array<{ id: string; name: string; coordinates: LatLon[]; severity: 'moderate' | 'high' }>; footprints: Array<{ id: string; name: string; instrument: string; coordinates: LatLon[]; sourceUrl: string }> };
export type EonetProvenance = { fetchedAt: string; contentHash: string; servedFromCache: boolean; sourceUrl: string; storage: 'upstream' | 'memory' | 'durable' | 'fixture'; offline?: boolean };
export type EarthEventSummary = {
  id: string; title: string; category: string; categoryId: string;
  date?: string; firstDate?: string; lastDate?: string;
  lat?: number; lon?: number; geometryCount: number;
  magnitudeValue?: number; magnitudeUnit?: string;
  sources: Array<{ id: string; url?: string; title?: string }>;
  closed: boolean; closedAt?: string; label: 'EARTH'; provider: 'EONET';
};
export type EarthEventDetail = {
  id: string; title: string; description?: string | null; link?: string; closed?: string | null;
  categories?: Array<{ id: string | number; title: string }>;
  sources?: Array<{ id: string; url?: string; title?: string }>;
  geometry?: Array<{ date?: string; type: string; coordinates: number[] | number[][] | number[][][]; magnitudeValue?: number; magnitudeUnit?: string }>;
};

// RAG: hybrid retrieval (BM25 + Gemini embeddings, RRF + MMR) over the cited NASA corpus.
export type RagScores = { bm25: number; dense: number | null; fused: number };
export type RagPassage = { n: number; chunkId: string; docId: string; title: string; url: string; heading: string; text: string; scores: RagScores };
export type RagDocument = { id: string; title: string; url: string; source: 'curated' | 'user'; retrievedDate?: string; chunks: number; words: number };
export type RagStatus = { documents: number; chunks: number; embeddedChunks: number; embedModel: string | null; semantic: boolean; builtAt: string | null; generators: { gemini: boolean; claude: boolean }; adminTokenRequired: boolean };
export type RagMode = 'hybrid' | 'bm25' | 'dense';
export type RagSearchResult = { query: string; mode: RagMode; semantic: boolean; strong: boolean; passages: RagPassage[]; tookMs: number };
export type RagModel = 'gemini' | 'claude' | 'local-evidence';
export type RagAnswer = RagSearchResult & { answer: string; modelUsed: RagModel; refused: boolean; cited: number[] };
export type RagEvalRow = { mode: RagMode; recallAt3: number; recallAt5: number; mrr: number };
export type RagEval = { questions: number; semantic: boolean; rows: RagEvalRow[]; misses: Array<{ question: string; expected: string[]; got: string[] }> };
export type RagProjection = { points: Array<{ chunkId: string; docId: string; title: string; x: number; y: number; z: number }>; query?: { x: number; y: number; z: number }; hits: string[] };

// Agent: tool-calling mission agent (Gemini → Claude → deterministic planner).
export type AgentLabel = 'RAG' | 'MARS' | 'EARTH / EONET' | 'ORBIT' | 'BRIEFING' | 'OPEN DATA';
export type AgentStep = { i: number; kind: 'plan' | 'tool' | 'answer' | 'error'; tool?: string; args?: Record<string, unknown>; summary: string; label?: AgentLabel; ms?: number };
export type AgentModel = 'gemini' | 'claude' | 'local-planner';
// Provenance gate: every number in an agent answer is matched to a sourced tool output, or flagged.
export type ProvenanceClaim = { text: string; value: number; tool?: string; sourceUrl?: string; unmatched?: boolean };
export type Provenance = { complete: boolean; claims: ProvenanceClaim[]; unmatched: number; evidence: Array<{ tool: string; source?: string; output: string }> };
export type AnswerLang = 'en' | 'bn';
export type AgentRun = { goal: string; steps: AgentStep[]; answer: string; modelUsed: AgentModel; passages: RagPassage[]; route?: RouteWaypoint[]; tookMs: number; mode: 'fast' | 'deep'; router?: 'jev' | 'rules'; provenance?: Provenance; lang?: AnswerLang; offline?: boolean };
