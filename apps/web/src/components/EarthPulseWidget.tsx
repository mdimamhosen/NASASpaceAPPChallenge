'use client';
import { useEffect, useState } from 'react';
import type { EarthEventSummary } from '@/lib/earth-types';
import { getEarthEventSummaries } from '@/lib/api';
import DetailModal from './ui/DetailModal';
export default function EarthPulseWidget() {
  const [events, setEvents] = useState<EarthEventSummary[]>([]);
  const [updated, setUpdated] = useState('');
  const [selected, setSelected] = useState<EarthEventSummary | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => getEarthEventSummaries(3).then((rows) => { if (active) { setEvents(rows); setUpdated(new Date().toLocaleTimeString()); } }).catch(() => { if (active) setUpdated('UNAVAILABLE'); });
    void refresh(); const interval = window.setInterval(refresh, 75_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  return <section className="earth-pulse"><div><span className="eyebrow">SEPARATE REAL FEED / EARTH ONLY</span><h2>NASA EONET refresh</h2><p>The nearby operations vignette is simulated. These event headlines are fetched from NASA&apos;s public Earth feed.</p><small>EARTH / EONET · UPDATED {updated || 'WAITING'}</small></div><div>{events.map((event) => <button key={event.id} onClick={() => setSelected(event)}><span>{event.category.toUpperCase()}</span><strong>{event.title}</strong><b>↗</b></button>)}</div>{selected && <DetailModal title={selected.title} eyebrow="EARTH / NASA EONET V3" facts={[["CATEGORY", selected.category], ["STATUS", selected.closed ? 'CLOSED' : 'OPEN'], ["LATEST", selected.lastDate || 'NOT PROVIDED']]} summary="This is an Earth natural event. Its geometry is never plotted in the Mars console." sources={[{ title: 'NASA EONET EVENT', url: `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(selected.id)}` }, ...selected.sources.filter((source) => source.url?.startsWith('https://')).map((source) => ({ title: source.title || source.id, url: source.url! }))]} onClose={() => setSelected(null)} />}</section>;
}
