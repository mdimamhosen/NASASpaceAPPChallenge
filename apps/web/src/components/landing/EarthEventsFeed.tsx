'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { getEarthEventSummaries, type EarthEventSummary } from '@/lib/api';

const EarthMiniMap = dynamic(() => import('./EarthMiniMap'), {
  ssr: false,
  loading: () => <div className="earth-mini-map earth-mini-map-loading">LOADING EARTH MAP…</div>,
});

export default function EarthEventsFeed() {
  const [events, setEvents] = useState<EarthEventSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEarthEventSummaries(12)
      .then((rows) => setEvents(rows))
      .catch((reason: Error) => setError(reason.message || 'EONET unavailable'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="earth-ops" aria-label="Earth natural events from NASA EONET">
      <div className="earth-ops-head">
        <span className="eyebrow">EARTH OPERATIONS / EONET V3</span>
        <strong>LIVE NATURAL EVENTS</strong>
        <p>Earth Observatory Natural Event Tracker — wildfires, storms, volcanoes, and more. EARTH only. Not Mars surface data.</p>
      </div>
      <div className="earth-ops-grid">
        <div className="earth-ops-list">
          {loading && <p className="quiet-note">CONTACTING EONET…</p>}
          {error && <p className="quiet-note">EONET: {error}</p>}
          {!loading && !error && events.length === 0 && <p className="quiet-note">NO OPEN EVENTS RETURNED.</p>}
          {events.map((event) => (
            <article key={event.id} className="earth-event-row">
              <span className="earth-label">EARTH · EONET</span>
              <strong>{event.title}</strong>
              <small>
                {event.category}
                {event.date ? ` · ${event.date.slice(0, 10)}` : ''}
              </small>
              {event.sources[0]?.url ? (
                <a href={event.sources[0].url} target="_blank" rel="noreferrer">
                  SOURCE ↗
                </a>
              ) : (
                <a href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noreferrer">
                  EONET ↗
                </a>
              )}
            </article>
          ))}
        </div>
        <div className="earth-ops-map-wrap">
          <EarthMiniMap events={events} />
          <span className="earth-map-caption">EPSG:3857 · EARTH PREVIEW · NOT MARS TREK</span>
        </div>
      </div>
    </section>
  );
}
