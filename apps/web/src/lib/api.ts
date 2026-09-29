import type { AssistantResponse, LayerId, MapLayer, MissionBriefing, POI, RegionData, RouteAnalysis, RouteWaypoint } from '@mars-explorer/shared';
import type { EarthEventSummary } from './earth-types';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error((await response.json().catch(() => null))?.message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const getRegion = () => request<RegionData>('/regions/jezero');
export const getLayers = () => request<MapLayer[]>('/layers');
export const analyzeRoute = (waypoints: RouteWaypoint[]) => request<RouteAnalysis>('/routes/analyze', { waypoints });
export const askAssistant = (question: string, waypoints: RouteWaypoint[], useCloudModels = false, compareModels = false) => request<AssistantResponse>('/assistant/ask', { question, waypoints, useCloudModels, compareModels });
export const createBriefing = (waypoints: RouteWaypoint[]) => request<MissionBriefing>('/briefings', { waypoints });
export const getEarthEventSummaries = (limit = 12) =>
  request<EarthEventSummary[]>(`/eonet/events-summary?limit=${limit}&status=open`);

export const layerIds: LayerId[] = ['imagery', 'viking', 'hazards', 'pois', 'hirise'];
export type { POI, RouteWaypoint, EarthEventSummary };

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
