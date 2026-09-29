'use client';
import LongFormExtras from './LongFormExtras';
import { useEffect, useState } from 'react';
import type { EarthEventSummary } from '@/lib/earth-types';
import { getEarthEventSummaries } from '@/lib/api';
import EonetEarthMap from './EonetEarthMap';
import MissionNav from './MissionNav';
import Link from 'next/link';

export default function EonetPage() {
  const [events, setEvents] = useState<EarthEventSummary[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { getEarthEventSummaries(18).then(setEvents).catch((reason: Error) => setError(reason.message)); }, []);
  return <main className="theater-page"><MissionNav active="/eonet" /><section className="theater-hero"><div><p className="eyebrow">EARTH / NASA EONET V3</p><h1>Another planet. A separate map.</h1><p>Recent Earth natural events can inspire comparison questions. These locations are Earth only; none appear on the Mars Trek map.</p></div><aside><span>PLANETARY BOUNDARY</span><strong>EARTH<br />ONLY</strong><small>NASA EONET / GOOGLE MAPS</small></aside></section><section className="theater-section"><div className="theater-section-head"><span>01 / EARTH EVENT MAP</span><span>{events.length} EVENTS</span></div><EonetEarthMap events={events} />{error && <p className="theater-error">{error}</p>}<div className="theater-records">{events.map((event, i) => <article key={event.id}><span className="record-index">{String(i+1).padStart(2,'0')}</span><div><small>EARTH / EONET · {event.category.toUpperCase()} · {event.date || 'DATE UNAVAILABLE'}</small><h2>{event.title}</h2><p>{event.lat == null ? 'No point geometry provided.' : `${event.lat.toFixed(2)}°, ${event.lon?.toFixed(2)}° · Earth coordinates`}</p></div><a href={`https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(event.id)}`} target="_blank" rel="noreferrer" aria-label={`Open EONET event ${event.title}`}>↗</a></article>)}</div></section><footer className="theater-footer"><span>EARTH EVENT GEOMETRIES NEVER APPEAR ON MARS</span><Link href="/explore">OPEN MARS CONSOLE ↗</Link></footer><LongFormExtras page="eonet" /></main>;
}
