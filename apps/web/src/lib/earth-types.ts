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
