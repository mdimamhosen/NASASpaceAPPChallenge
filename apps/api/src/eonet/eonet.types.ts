export type EonetCategoryRef = { id: string | number; title: string };
export type EonetSourceRef = { id: string; url?: string; title?: string };
export type EonetGeometry = {
  date?: string;
  type: string;
  coordinates: number[] | number[][] | number[][][];
  magnitudeValue?: number;
  magnitudeUnit?: string;
};

export type EonetEvent = {
  id: string;
  title: string;
  description?: string | null;
  link?: string;
  closed?: string | null;
  categories?: EonetCategoryRef[];
  sources?: EonetSourceRef[];
  geometry?: EonetGeometry[];
  magnitudeValue?: number | null;
  magnitudeUnit?: string | null;
};

export type EonetEventsResponse = { title?: string; description?: string; link?: string; events: EonetEvent[] };

export type EarthEventSummary = {
  id: string;
  title: string;
  category: string;
  date?: string;
  lat?: number;
  lon?: number;
  sources: Array<{ id: string; url?: string }>;
  closed: boolean;
  label: 'EARTH';
  provider: 'EONET';
};
