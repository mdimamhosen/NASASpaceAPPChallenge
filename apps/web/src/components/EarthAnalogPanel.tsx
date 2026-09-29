'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { EarthEventSummary } from '@/lib/earth-types';
import { getEarthEventSummaries } from '@/lib/api';

const EarthMiniMap = dynamic(() => import('./landing/EarthMiniMap'), { ssr: false, loading: () => <div className="analog-map-placeholder">LOADING EARTH MAP…</div> });

export default function EarthAnalogPanel() {
  const [events, setEvents] = useState<EarthEventSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { getEarthEventSummaries(8).then((rows) => { setEvents(rows); setSelected(rows[0]?.id ?? ''); }).catch((reason: Error) => setError(reason.message)); }, []);
  const event = events.find((row) => row.id === selected);
  return <section className="analog-panel"><div className="theater-section-head"><span>02 / EARTH EVENT PICK</span><span className="earth-label">EARTH · EONET V3</span></div><p className="analog-intro">Select a current Earth event as a storytelling prompt. Process analogies can inspire questions about observation; they do not imply matching Martian hazards or environments.</p><div className="analog-grid"><div className="analog-event-list">{error && <p className="compare-note">EONET unavailable: {error}</p>}{!error && events.length === 0 && <p className="compare-note">Retrieving open EONET events…</p>}{events.map((row) => <button className={selected === row.id ? 'selected' : ''} key={row.id} onClick={() => setSelected(row.id)}><small>EARTH / {row.category.toUpperCase()}</small><strong>{row.title}</strong><span>{row.date?.slice(0, 10) ?? 'OPEN EVENT'}</span></button>)}</div><div className="analog-map"><EarthMiniMap events={events} /><span>EARTH EVENT LOCATIONS · NOT ON MARS MAP</span></div></div>{event && <article className="analog-selection"><small>SELECTED EARTH EVENT / EONET</small><strong>{event.title}</strong><p>Analog question: what observations would help distinguish an Earth surface process from a superficially similar Martian landform? The selected event is Earth context only; it is not a Jezero hazard or route input.</p></article>}</section>;
}
