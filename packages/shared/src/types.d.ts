export type LatLon = {
    lat: number;
    lon: number;
};
export type LayerId = 'imagery' | 'elevation' | 'hazards' | 'pois';
export type MapLayer = {
    id: LayerId;
    name: string;
    description: string;
    source: string;
    trekLayerId?: string;
    enabledByDefault: boolean;
};
export type POI = {
    id: string;
    name: string;
    lat: number;
    lon: number;
    category: 'geology' | 'mission' | 'hazard' | 'other';
    summary: string;
    sourceUrl: string;
    mission?: string;
};
export type RouteWaypoint = LatLon & {
    id: string;
};
export type RouteAnalysis = {
    distanceKm: number;
    riskScore: number;
    riskNotes: string[];
    nearbyPois: POI[];
    elevationDeltaM?: number;
};
export type Citation = {
    title: string;
    url: string;
    mission?: string;
    excerpt: string;
};
export type AssistantResponse = {
    answer: string;
    citations: Citation[];
    modelUsed: 'claude' | 'gemini' | 'deepseek' | 'local-evidence';
    refused: boolean;
    traceId?: string;
    observabilityBackend?: 'langsmith' | 'langfuse';
};
export type MissionBriefing = {
    title: string;
    distanceKm: number;
    explorationPoints: number;
    scientificObjectives: string[];
    terrainConsiderations: string[];
    relevantObservations: string[];
    recommendedInvestigationPoints: string[];
    citations: Citation[];
    markdown: string;
};
export type RegionData = {
    id: string;
    name: string;
    center: LatLon;
    bounds: [[number, number], [number, number]];
    pois: POI[];
    hazards: Array<{
        id: string;
        name: string;
        coordinates: LatLon[];
        severity: 'moderate' | 'high';
    }>;
};
