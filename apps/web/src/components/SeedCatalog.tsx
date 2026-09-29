'use client';
import LongFormExtras from './LongFormExtras';
import { useEffect, useState } from 'react';
import type { RegionData } from '@mars-explorer/shared';
import { getRegion } from '@/lib/api';
import MissionNav from './MissionNav';
import Link from 'next/link';

export default function SeedCatalog({ kind }: { kind: 'targets' | 'hazards' }) {
  const [region, setRegion] = useState<RegionData | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => { getRegion().then(setRegion).catch((reason: Error) => setError(reason.message)); }, []);
  const targets = kind === 'targets';
  const visiblePois = region?.pois.filter((poi) => filter === 'all' || poi.category === filter) ?? [];
  return <main className="theater-page"><MissionNav active={`/${kind}`} /><section className="theater-hero"><div><p className="eyebrow">JEZERO / SEEDED FIELD REGISTER</p><h1>{targets ? 'Targets worth a closer look.' : 'Watch zones, with limits.'}</h1><p>{targets ? 'Approximate points of scientific interest. Open each source before treating the annotation as mission evidence.' : 'Illustrative terrain zones used for route scoring. These polygons are not certified hazards or an EVA safety assessment.'}</p></div><aside><span>DATA STATUS</span><strong>CURATED<br />APPROXIMATE</strong><small>NON-CERTIFYING</small></aside></section><section className="theater-section"><div className="theater-section-head"><span>01 / {targets ? 'SCIENCE TARGETS' : 'TERRAIN WATCH ZONES'}</span><span>{region ? (targets ? region.pois.length : region.hazards.length) : '—'} RECORDS</span></div>{targets && <div className="target-filters" role="group" aria-label="Filter science targets">{['all','geology','mission','hazard','other'].map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value.toUpperCase()}</button>)}</div>}<div className="theater-records">{error && <p className="theater-error">{error}</p>}{!region && !error && <p>Loading Jezero seed data…</p>}{region && (targets ? visiblePois.map((item, i) => <article key={item.id}><span className="record-index">{String(i+1).padStart(2,'0')}</span><div><small>{item.category.toUpperCase()} / APPROX. {item.lat.toFixed(3)}°N, {item.lon.toFixed(3)}°E</small><h2>{item.name}</h2><p>{item.summary}</p><span className="record-source">SOURCE / {item.mission || 'NASA'}</span></div><div className="target-links"><Link href={`/explore?poi=${encodeURIComponent(item.id)}`}>OPEN IN EXPLORE ↗</Link><a href={item.sourceUrl} target="_blank" rel="noreferrer">NASA SOURCE ↗</a></div></article>) : region.hazards.map((item, i) => <article key={item.id}><span className="record-index">{String(i+1).padStart(2,'0')}</span><div><small>{item.severity.toUpperCase()} / SEEDED ILLUSTRATION</small><h2>{item.name}</h2><p>Approximate polygon with {item.coordinates.length} vertices. The route score checks intersection only; it does not measure slope, bearing capacity, or traversability.</p></div></article>))}</div></section><footer className="theater-footer"><span>PLANNING CONTEXT ONLY · NOT OPERATIONAL NAVIGATION</span><Link href={targets ? '/hazards' : '/architecture'}>{targets ? 'VIEW WATCH ZONES' : 'VIEW ARCHITECTURE'} ↗</Link></footer><LongFormExtras page={kind} /></main>;
}
