'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { MissionLanding, OpenCatalogResult, OpenDataProduct } from '@mars-explorer/shared';
import { DATA_NASA_MARS_URL } from '@mars-explorer/shared';
import { getLandings, getOpenCatalog, getOpenDataProducts } from '@/lib/api';
import MissionNav from './MissionNav';

const PAGE = 24;
const fmtDate = (iso: string) => (iso ? new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—');

export default function OpenDataPage() {
  const [q, setQ] = useState('');
  const [mission, setMission] = useState('');
  const [source, setSource] = useState<'snapshot' | 'live'>('snapshot');
  const [result, setResult] = useState<OpenCatalogResult | null>(null);
  const [items, setItems] = useState<OpenCatalogResult['items']>([]);
  const [products, setProducts] = useState<OpenDataProduct[]>([]);
  const [landings, setLandings] = useState<MissionLanding[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQ(params.get('q') ?? ''); setMission(params.get('mission') ?? '');
    getOpenDataProducts().then(setProducts).catch(() => undefined);
    getLandings().then(setLandings).catch(() => undefined);
  }, []);

  // Debounced search; a newer query discards older responses.
  useEffect(() => {
    const id = ++seq.current;
    const timer = window.setTimeout(() => {
      setBusy(true); setError('');
      getOpenCatalog(q, mission, 0, source, PAGE)
        .then((res) => { if (id === seq.current) { setResult(res); setItems(res.items); } })
        .catch((reason: Error) => { if (id === seq.current) setError(`${reason.message}. Start the API with pnpm dev.`); })
        .finally(() => { if (id === seq.current) setBusy(false); });
      const url = new URL(window.location.href);
      for (const [key, value] of [['q', q], ['mission', mission]] as const) value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
      window.history.replaceState(null, '', url);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q, mission, source]);

  async function more() {
    if (!result) return;
    setBusy(true);
    try { const next = await getOpenCatalog(q, mission, items.length, source, PAGE); setItems((current) => [...current, ...next.items]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load more datasets.'); }
    finally { setBusy(false); }
  }

  const used = new Set(['mro-mars-high-resolution-imaging-science-experiment-dtm-v1-0', 'gazetteer-of-planetary-nomenclature-mars-mola-global-images']);
  const catalogTotal = products.find((p) => p.key === 'catalog')?.count;

  return <main className="theater-page open-data-page">
    <MissionNav active="/opendata" />
    <section className="theater-hero">
      <div><p className="eyebrow">NASA OPEN DATA / DATA.NASA.GOV · TAG “MARS”</p><h1>Every Mars dataset NASA lists, one search away.</h1><p>Mars Explorer snapshots the data.nasa.gov Mars catalog, puts three of its products on the Mars map, and lets the mission agent search the rest. Most records describe NASA Planetary Data System archives and link to them.</p></div>
      <aside><span>CATALOG RECORDS</span><strong>{catalogTotal ?? '—'}<br />DATASETS</strong><small><a href={DATA_NASA_MARS_URL} target="_blank" rel="noreferrer">DATA.NASA.GOV ↗</a></small></aside>
    </section>

    <section className="theater-section">
      <div className="theater-section-head"><span>01 / USED IN MARS EXPLORER</span><span>{products.length} PRODUCTS · SNAPSHOT + SHA-256</span></div>
      <div className="open-products">{products.map((p) => <article key={p.key}>
        <small>{p.key === 'catalog' ? 'CATALOG' : p.key === 'hiriseDtm' ? 'MAP LAYER · ROUTE CONTEXT' : 'MAP LAYER · ROUTE CONTEXT · AGENT'}</small>
        <h2>{p.product}</h2><strong>{p.count.toLocaleString()} RECORDS</strong><p>{p.usedFor}</p>
        <dl><div><dt>RETRIEVED</dt><dd>{fmtDate(p.retrievedAt)}</dd></div><div><dt>SHA-256</dt><dd title={p.sha256}>{p.sha256.slice(0, 16)}…</dd></div></dl>
        <div className="open-links"><a href={p.datasetUrl} target="_blank" rel="noreferrer">DATA.NASA.GOV ↗</a><a href={p.sourceUrl} target="_blank" rel="noreferrer">SOURCE FILE ↗</a>{p.key !== 'catalog' && <Link href="/explore">SEE ON MAP ↗</Link>}</div>
      </article>)}{!products.length && <p className="theater-error">Run pnpm refresh:opendata, then start the API.</p>}</div>
    </section>

    <section className="theater-section" id="catalog">
      <div className="theater-section-head"><span>02 / SEARCH THE CATALOG</span><span>{busy ? 'SEARCHING…' : result ? `${result.total.toLocaleString()} MATCHES` : '—'}</span></div>
      <div className="open-search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: HiRISE DTM, APXS, weather, seismometer, SPICE…" aria-label="Search data.nasa.gov Mars datasets" />
        <div role="group" aria-label="Catalog source"><button className={source === 'snapshot' ? 'active' : ''} onClick={() => setSource('snapshot')}>SNAPSHOT</button><button className={source === 'live' ? 'active' : ''} onClick={() => setSource('live')} disabled={Boolean(mission)} title={mission ? 'Mission tags exist only in the snapshot' : 'Query data.nasa.gov directly'}>LIVE DATA.NASA.GOV</button></div>
      </div>
      <div className="open-facets" role="group" aria-label="Filter by mission">
        <button className={!mission ? 'active' : ''} onClick={() => setMission('')}>ALL</button>
        {result?.missions.slice(0, 16).map((m) => <button key={m.mission} className={mission === m.mission ? 'active' : ''} onClick={() => { setSource('snapshot'); setMission(mission === m.mission ? '' : m.mission); }}>{m.mission} <small>{m.count}</small></button>)}
      </div>
      {result && <p className="open-provenance">{result.provenance.source === 'live' ? 'LIVE · DATA.NASA.GOV CKAN API' : 'SNAPSHOT'} · {fmtDate(result.provenance.fetchedAt)}{result.provenance.note ? ` · ${result.provenance.note}` : ''}{mission ? ' · MISSION TAGS ARE INFERRED FROM TITLES AND DESCRIPTIONS' : ''}</p>}
      <div className="theater-records">{items.map((d, i) => <article key={d.id}>
        <span className="record-index">{String(i + 1).padStart(3, '0')}</span>
        <div><small>{d.missions.join(' · ') || 'UNTAGGED'}{d.publisher ? ` · ${d.publisher.toUpperCase()}` : ''}{d.modified ? ` · ${d.modified}` : ''}{used.has(d.id) ? ' · USED ON THE MARS MAP' : ''}</small>
          <h2>{d.title}</h2>{d.notes && <p>{d.notes}</p>}
          <div className="open-links"><a href={d.url} target="_blank" rel="noreferrer">DATA.NASA.GOV ↗</a>{d.landingPage && d.landingPage !== d.url && <a href={d.landingPage} target="_blank" rel="noreferrer">LANDING PAGE ↗</a>}{d.resources.slice(0, 2).map((r) => <a key={r} href={r} target="_blank" rel="noreferrer">RESOURCE ↗</a>)}</div>
        </div>
      </article>)}{!items.length && !busy && <p className="theater-error">{error || 'No dataset matches every term. Try fewer words.'}</p>}</div>
      {result && items.length < result.total && <button className="open-more" onClick={() => void more()} disabled={busy}>LOAD {Math.min(PAGE, result.total - items.length)} MORE</button>}
    </section>

    <section className="theater-section">
      <div className="theater-section-head"><span>03 / MISSION DATA SHELVES</span><span>NASA LANDINGS · NSSDCA COORDINATES</span></div>
      <div className="open-landings">{landings.map((l) => <button key={l.name} onClick={() => { setSource('snapshot'); setQ(''); setMission(l.mission); document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); }} disabled={!l.datasetCount}>
        <small>{l.year} · {l.place.toUpperCase()}</small><strong>{l.name}</strong><span>{l.datasetCount ? `${l.datasetCount} DATASETS` : 'PDS PLACES ONLY'}</span>
      </button>)}</div>
    </section>
    <footer className="theater-footer"><span>REFRESH: pnpm refresh:opendata · RECORDS DESCRIBE ARCHIVES; THEY DO NOT VALIDATE A ROUTE</span><Link href="/explore">OPEN THE MARS MAP ↗</Link></footer>
  </main>;
}
