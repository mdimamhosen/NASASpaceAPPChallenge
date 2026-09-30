'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EarthEventDetail, EarthEventSummary } from '@/lib/earth-types';
import { getEarthEvent, getEarthEventSummaries, getEonetCategories, getEonetGeoJson } from '@/lib/api';
import { eonetColor } from '@/lib/eonet-colors';
import DetailModal, { type DetailSource } from './ui/DetailModal';

const EarthMiniMap = dynamic(() => import('./landing/EarthMiniMap'), { ssr: false, loading: () => <div className="earth-mini-map earth-mini-map-loading">LOADING EARTH MAP…</div> });
const EonetEarthMap = dynamic(() => import('./EonetEarthMap'), { ssr: false, loading: () => <div className="earth-mini-map earth-mini-map-loading">LOADING EARTH MAP…</div> });
const DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
function date(value?: string) { return value ? DATE.format(new Date(value)) : 'NOT PROVIDED'; }
function earthPoint(lat: number, lon: number) { return `${Math.abs(lat).toFixed(3)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(3)}° ${lon < 0 ? 'W' : 'E'}`; }

export default function EarthEventsExplorer({ mode = 'home' }: { mode?: 'home' | 'eonet' | 'analog' }) {
  const [events, setEvents] = useState<EarthEventSummary[]>([]);
  const [categoryCatalog, setCategoryCatalog] = useState<Array<[string, string]>>([]);
  const [geometrySamples, setGeometrySamples] = useState<number | null>(null);
  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [updated, setUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<EarthEventDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const selectEvent = useCallback((id: string) => setSelected(id), []);

  useEffect(() => {
    let active = true;
    getEonetCategories().then((payload) => { if (active) setCategoryCatalog(payload.categories.map((item) => [item.id, item.title])); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (mode === 'eonet') getEonetGeoJson(60, status).then((payload) => { if (active) setGeometrySamples(payload.features.length); }).catch(() => { if (active) setGeometrySamples(null); });
      try {
        const rows = await getEarthEventSummaries(mode === 'home' ? 24 : 60, status);
        if (active) { const receivedAt = Date.now(); setEvents(rows); setUpdated(receivedAt); setNow(receivedAt); setError(''); }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'EONET unavailable'); }
      finally { if (active) setLoading(false); }
    };
    setLoading(true); void refresh();
    const poll = window.setInterval(() => void refresh(), 75_000);
    const clock = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => { active = false; window.clearInterval(poll); window.clearInterval(clock); };
  }, [mode, status]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setDetail(null); setDetailError('');
    getEarthEvent(selected).then((row) => { if (active) setDetail(row); }).catch((reason: Error) => { if (active) setDetailError(reason.message); });
    return () => { active = false; };
  }, [selected]);

  const categories = useMemo(() => [...new Map(events.map((event) => [event.categoryId, event.category])).entries()], [events]);
  const filterCategories = categoryCatalog.length ? categoryCatalog : categories;
  const filtered = useMemo(() => events.filter((event) => (category === 'all' || event.categoryId === category) && event.title.toLowerCase().includes(search.trim().toLowerCase())), [events, category, search]);
  const current = events.find((event) => event.id === selected);
  const sources: DetailSource[] = [...(detail?.sources ?? current?.sources ?? []).filter((source) => source.url?.startsWith('https://')).map((source) => ({ title: source.title || source.id, url: source.url!, note: 'Source linked by NASA EONET for this Earth event.' }))];
  if (detail?.link?.startsWith('https://')) sources.unshift({ title: 'NASA EONET EVENT RECORD', url: detail.link, note: 'The EONET event record contains the published geometry, category, and source links.' });
  const detailGeometry = detail?.geometry ?? [];

  return <section className={`earth-explorer earth-explorer-${mode}`} aria-label="NASA EONET Earth event explorer">
    <div className="earth-explorer-head"><div><span className="eyebrow">EARTH / NASA EONET V3 · LIVE PUBLIC FEED</span><h2>{mode === 'analog' ? 'Earth analogs, kept on Earth.' : 'Natural events, on their own planet.'}</h2><p>Open a record to inspect its timeline and original sources. Earth event geometry never appears on the Mars Trek map.</p></div><span className="live-chip" role="status"><i />{loading ? 'CONTACTING EONET' : updated ? `UPDATED · ${Math.max(0, Math.floor((now - updated) / 1000))}s AGO` : 'EARTH FEED UNAVAILABLE'}</span></div>
    <div className="earth-filters"><label>SEARCH TITLE / PLACE<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events…" /></label><label>CATEGORY<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">ALL CATEGORIES</option>{filterCategories.map(([id, title]) => <option key={id} value={id}>{title.toUpperCase()}</option>)}</select></label><label>STATUS<select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setCategory('all'); }}><option value="open">OPEN</option><option value="closed">CLOSED</option><option value="all">ALL</option></select></label></div>
    <div className="earth-legend" aria-label="EONET category legend">{categories.map(([id, title]) => <span key={id}><i style={{ backgroundColor: eonetColor(id) }} />{title}</span>)}</div>
    <div className="earth-explorer-grid"><div className="earth-explorer-list" aria-label="Earth event records">{error && <p className="earth-list-message" role="status">EONET unavailable: {error}. Last received records remain visible.</p>}{loading && !events.length && <p className="earth-list-message">CONTACTING NASA EONET…</p>}{!loading && !error && !filtered.length && <p className="earth-list-message">No Earth events match these filters.</p>}{filtered.map((event, index) => <button className="earth-explorer-row" key={event.id} onClick={() => selectEvent(event.id)}><span className="earth-event-index">{String(index + 1).padStart(2, '0')}</span><span className="earth-event-dot" style={{ backgroundColor: eonetColor(event.categoryId) }} /><span><small>EARTH / {event.category.toUpperCase()} · {event.closed ? 'CLOSED' : 'OPEN'}</small><strong>{event.title}</strong><em>{date(event.date)} · {event.geometryCount} GEOMETR{event.geometryCount === 1 ? 'Y' : 'IES'}</em></span><b>↗</b></button>)}</div><div className="earth-explorer-map"><div className="earth-map-inner">{mode === 'eonet' ? <EonetEarthMap events={filtered} onSelect={selectEvent} /> : <EarthMiniMap events={filtered} onSelect={selectEvent} />}</div><span>EARTH COORDINATES / EONET · {filtered.length} VISIBLE EVENTS{geometrySamples == null ? '' : ` · ${geometrySamples} GEOJSON GEOMETRIES`}</span></div></div>
    {selected && <DetailModal title={current?.title ?? detail?.title ?? 'Earth event'} eyebrow="EARTH / NASA EONET V3 · LIVE RECORD" summary={detail?.description || 'Earth natural event reported through NASA EONET. Inspect source records before drawing conclusions.'} facts={current ? [['CATEGORY', current.category], ['STATUS', current.closed ? `CLOSED · ${date(current.closedAt)}` : 'OPEN'], ['FIRST GEOMETRY', date(current.firstDate)], ['LATEST GEOMETRY', date(current.lastDate)], ['GEOMETRIES', String(current.geometryCount)], ['MAGNITUDE', current.magnitudeValue == null ? 'NOT PROVIDED' : `${current.magnitudeValue} ${current.magnitudeUnit ?? ''}`], ['EARTH POINT', current.lat == null || current.lon == null ? 'NO POINT GEOMETRY' : earthPoint(current.lat, current.lon)]] : []} sources={sources} onClose={() => setSelected(null)}>
      {detailError && <p className="theater-error">Event detail unavailable: {detailError}</p>}
      {!detail && !detailError && <p className="earth-list-message">LOADING EVENT DETAIL…</p>}
      {current?.lat != null && <div className="detail-earth-map"><EarthMiniMap events={[current]} /><span>EARTH / EONET POINT · NOT MARS TREK</span></div>}
      {detailGeometry.length > 0 && <section className="detail-timeline"><h3>GEOMETRY TIMELINE</h3>{detailGeometry.slice(-8).reverse().map((geometry, index) => <div key={`${geometry.date}-${index}`}><time>{date(geometry.date)}</time><span>{geometry.type.toUpperCase()}{geometry.magnitudeValue == null ? '' : ` · ${geometry.magnitudeValue} ${geometry.magnitudeUnit ?? ''}`}</span></div>)}</section>}
    </DetailModal>}
  </section>;
}
