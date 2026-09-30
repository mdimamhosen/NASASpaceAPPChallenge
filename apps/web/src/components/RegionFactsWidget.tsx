'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RegionData } from '@mars-explorer/shared';
import { getRegion } from '@/lib/api';
export default function RegionFactsWidget() {
  const [region, setRegion] = useState<RegionData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getRegion().then(setRegion).catch((reason: Error) => setError(reason.message)); }, []);
  return <section className="region-facts" aria-label="Jezero demo region inventory"><div><span className="eyebrow">API / JEZERO SEED INVENTORY</span><h2>What the console can inspect.</h2><p>These numbers describe the local demonstration seed, not a NASA operational traverse catalog.</p></div><div className="region-facts-grid">{[['SCIENCE POINTS', region?.pois.length], ['WATCH ZONES', region?.hazards.length], ['IMAGE FOOTPRINTS', region?.footprints.length]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value ?? '—'}</strong></div>)}</div>{error && <p role="status">Region API unavailable: {error}</p>}<Link href="/explore">INSPECT ON NASA TREK ↗</Link></section>;
}
