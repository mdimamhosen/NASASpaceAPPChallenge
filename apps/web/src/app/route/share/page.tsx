'use client';
import LongFormExtras from '@/components/LongFormExtras';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import MissionNav from '@/components/MissionNav';

export default function SharedRoutePage() {
  const [points, setPoints] = useState<Array<{ lat: number; lon: number }> | null>(null);
  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('wp');
      const decoded = raw ? JSON.parse(raw) as Array<{ lat: number; lon: number }> : [];
      if (decoded.length >= 2 && decoded.length <= 24 && decoded.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))) setPoints(decoded);
      else setPoints([]);
    } catch { setPoints([]); }
  }, []);
  const query = points?.length ? `?wp=${encodeURIComponent(JSON.stringify(points))}` : '';
  return <main className="theater-page"><MissionNav active="/route/share" /><section className="theater-hero"><div><p className="eyebrow">ROUTE HANDOFF / LOCAL GEOMETRY</p><h1>Shared Marswalk route</h1><p>Route links contain waypoint coordinates only. They do not certify terrain, validate safety, or represent a rover position.</p></div><aside><span>DECODE STATUS</span><strong>{points === null ? 'READING…' : points.length ? `${points.length} POINTS` : 'NO VALID ROUTE'}</strong><small>LOCAL URL PAYLOAD</small></aside></section>{points?.length ? <section className="theater-section"><div className="theater-section-head"><span>WAYPOINT REGISTER</span><span>{String(points.length).padStart(2, '0')} POINTS</span></div><div className="theater-records">{points.map((point, index) => <article key={`${point.lat}:${point.lon}`}><span className="record-index">{String(index + 1).padStart(2, '0')}</span><div><small>APPROXIMATE SURFACE COORDINATE</small><h2>{point.lat.toFixed(4)}°, {point.lon.toFixed(4)}°</h2><p>Shared route vertex. Not a validated rover stop or certified navigation waypoint.</p></div></article>)}</div><Link className="stage-link" href={`/explore${query}`}>OPEN ROUTE IN CONSOLE <ArrowUpRight size={14} /></Link></section> : points !== null && <section className="theater-section"><p className="compare-note">This URL does not contain a valid route. Open Explore, load or draw a route, then copy its share link.</p><Link className="stage-link" href="/explore">OPEN CONSOLE <ArrowUpRight size={14} /></Link></section>}<LongFormExtras page="share" /></main>;
}
