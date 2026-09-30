export type LatLon = { lat: number; lon: number };
export type LayerId = 'imagery' | 'viking' | 'hazards' | 'pois' | 'hirise';
export type MapLayer = { id: LayerId; name: string; description: string; source: string; trekLayerId?: string; enabledByDefault: boolean };
export type POI = { id: string; name: string; lat: number; lon: number; category: 'geology' | 'mission' | 'hazard' | 'other'; summary: string; sourceUrl: string; mission?: string };
export type RouteWaypoint = LatLon & { id: string };
export type RouteAnalysis = { distanceKm: number; riskScore: number; riskNotes: string[]; nearbyPois: POI[]; elevationDeltaM?: number; terrainMethod?: 'postgis-jezero' | 'heuristic' };
export type Citation = { title: string; url: string; mission?: string; excerpt: string };
export type AssistantResponse = { answer: string; citations: Citation[]; modelUsed: 'claude' | 'gemini' | 'deepseek' | 'local-evidence'; refused: boolean; traceId?: string; observabilityBackend?: 'langsmith' | 'langfuse'; comparison?: Array<{ model: string; answer: string }>; trace?: Array<{ step: string; detail: string }> };
export type MissionBriefing = { title: string; distanceKm: number; explorationPoints: number; scientificObjectives: string[]; terrainConsiderations: string[]; relevantObservations: string[]; recommendedInvestigationPoints: string[]; citations: Citation[]; markdown: string };
export type RegionData = { id: string; name: string; center: LatLon; bounds: [[number, number], [number, number]]; pois: POI[]; hazards: Array<{ id: string; name: string; coordinates: LatLon[]; severity: 'moderate' | 'high' }>; footprints: Array<{ id: string; name: string; instrument: string; coordinates: LatLon[]; sourceUrl: string }> };
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
