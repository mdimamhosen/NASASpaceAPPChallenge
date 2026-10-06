import type { AssistantResponse, LayerId, MapLayer, MissionBriefing, POI, RegionData, RouteAnalysis, RouteWaypoint, PlacesTrack, SuggestedRoute, EonetProvenance, DtmGrid, RagStatus, RagDocument, RagSearchResult, RagAnswer, RagEval, RagProjection, RagMode, AgentRun, OpenCatalogResult, MarsFeature, HiriseDtm, MissionLanding, OpenDataProduct, MarsHardware, AnswerLang } from '@mars-explorer/shared';
import type { EarthEventSummary, EarthEventDetail } from './earth-types';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request<T>(path: string, body?: unknown, init: { method?: string; headers?: Record<string, string> } = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method: init.method ?? (body ? 'POST' : 'GET'),
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...init.headers },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) {
    const message = (await response.json().catch(() => null))?.message;
    throw new Error((Array.isArray(message) ? message.join('; ') : message) || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const getRegion = (demo = false) => request<RegionData>(`/regions/jezero${demo ? '?demo=true' : ''}`);
export const getPlaces = (fromSol?: number, toSol?: number) => request<PlacesTrack>(`/places/perseverance${fromSol == null ? '' : `?fromSol=${fromSol}&toSol=${toSol ?? fromSol}`}`);
export const suggestRoute = (waypoints: RouteWaypoint[]) => request<SuggestedRoute>('/routes/suggest', { waypoints });
export const getEonetProvenance = (limit = 60, status: 'open' | 'closed' | 'all' = 'open') => request<EonetProvenance>(`/eonet/provenance?limit=${limit}&status=${status}`);
export const getDtmGrid = () => request<DtmGrid>('/routes/dtm-grid');
export const getLayers = () => request<MapLayer[]>('/layers');
export const analyzeRoute = (waypoints: RouteWaypoint[]) => request<RouteAnalysis>('/routes/analyze', { waypoints });
export const askAssistant = (question: string, waypoints: RouteWaypoint[], useCloudModels = false, compareModels = false) => request<AssistantResponse>('/assistant/ask', { question, waypoints, useCloudModels, compareModels });
export const createBriefing = (waypoints: RouteWaypoint[]) => request<MissionBriefing>('/briefings', { waypoints });
export const getEarthEventSummaries = (limit = 12, status: 'open' | 'closed' | 'all' = 'open') =>
  request<EarthEventSummary[]>(`/eonet/events-summary?limit=${limit}&status=${status}`);
export const getEarthEvent = (id: string) => request<EarthEventDetail>(`/eonet/events/${encodeURIComponent(id)}`);
export const getEonetCategories = () => request<{ categories: Array<{ id: string; title: string }> }>('/eonet/categories');
export const getEonetGeoJson = (limit = 60, status: 'open' | 'closed' | 'all' = 'open') => request<{ type: 'FeatureCollection'; features: Array<{ properties?: { id?: string; categories?: Array<{id:string;title:string}> } }> }>(`/eonet/events/geojson?limit=${limit}&status=${status}`);

export const layerIds: LayerId[] = ['imagery', 'viking', 'hrsc-color', 'hrsc-shade', 'hazards', 'pois', 'hirise', 'names', 'landings'];

// NASA Open Data (data.nasa.gov, tag "mars")
export type MapBox = { south: number; west: number; north: number; east: number };
const boxQuery = (b: MapBox) => `south=${b.south.toFixed(3)}&north=${b.north.toFixed(3)}&west=${b.west.toFixed(3)}&east=${b.east.toFixed(3)}`;
export const getOpenCatalog = (q = '', mission = '', offset = 0, source: 'snapshot' | 'live' = 'snapshot', limit = 24) =>
  request<OpenCatalogResult>(`/opendata/catalog?${new URLSearchParams({ q, ...(mission ? { mission } : {}), offset: String(offset), limit: String(limit), source })}`);
export const getMarsFeatures = (box: MapBox, zoom: number) => request<MarsFeature[]>(`/opendata/features?${boxQuery(box)}&zoom=${zoom}`);
export const getHiriseDtms = (box: MapBox) => request<HiriseDtm[]>(`/opendata/hirise-dtm?${boxQuery(box)}`);
export const getLandings = () => request<MissionLanding[]>('/opendata/landings');
export const getHardware = () => request<MarsHardware[]>('/opendata/hardware');
export const getHealthReady = () => request<{ ok: boolean; offline: boolean }>('/health/ready');
export const getOpenDataProducts = () => request<OpenDataProduct[]>('/opendata/products');
export type { POI, RouteWaypoint, EarthEventSummary };

export const getRecentTraces = () => request<Array<{id:string;createdAt:string;question:string;steps:Array<{step:string;detail:string}>}>>('/assistant/traces/recent');
export const getTrace = () => request<{ step: string; detail: string }[]>('/assistant/traces');

export async function downloadBriefingPdf(waypoints: RouteWaypoint[]): Promise<void> {
  const response = await fetch(`${base}/briefings/pdf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ waypoints }) });
  if (!response.ok) throw new Error(`PDF export failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'jezero-marswalk-briefing.pdf';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// RAG research console + mission agent
const ragHeaders = (token?: string) => (token ? { 'x-rag-token': token } : undefined);
export const getRagStatus = () => request<RagStatus>('/rag/status');
export const getRagDocuments = () => request<RagDocument[]>('/rag/documents');
export const ragSearch = (query: string, mode: RagMode = 'hybrid', k = 6) => request<RagSearchResult>('/rag/search', { query, mode, k });
export const ragAsk = (question: string, useCloudModels: boolean) => request<RagAnswer>('/rag/ask', { question, useCloudModels });
export const ragAddUrl = (url: string, token?: string) => request<RagDocument>('/rag/documents/url', { url }, { headers: ragHeaders(token) });
export const ragAddText = (title: string, body: string, url?: string, token?: string) => request<RagDocument>('/rag/documents/text', { title, body, ...(url ? { url } : {}) }, { headers: ragHeaders(token) });
export const ragDelete = (id: string, token?: string) => request<{ removed: string }>(`/rag/documents/${encodeURIComponent(id)}`, undefined, { method: 'DELETE', headers: ragHeaders(token) });
export const ragReindex = (token?: string) => request<RagStatus>('/rag/reindex', {}, { headers: ragHeaders(token) });
export const getRagEval = () => request<RagEval>('/rag/eval');
export const getRagProjection = (q?: string) => request<RagProjection>(`/rag/projection${q ? `?q=${encodeURIComponent(q)}` : ''}`);
export const agentRun = (goal: string, cloud: boolean) => request<AgentRun>('/agent/run', { goal, cloud });
export const agentStreamUrl = (goal: string, cloud: boolean, mode: 'fast' | 'deep' = 'fast', lang: AnswerLang = 'en') => `${base}/agent/stream?goal=${encodeURIComponent(goal)}&cloud=${cloud}&mode=${mode}&lang=${lang}`;
export const ragStreamUrl = (question: string, cloud: boolean, lang: AnswerLang = 'en') => `${base}/rag/ask/stream?question=${encodeURIComponent(question)}&cloud=${cloud}&lang=${lang}`;
