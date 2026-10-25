'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMissionData } from '@/lib/api';

type Hour = { ltstHour: number; AIR_TEMP?: number; GROUND_TEMP?: number; PRESSURE?: number };
type Meda = { sourcePage: string; retrievedAt: string; sols: Array<{ sol: number; hours: Hour[]; sources: Array<{ url: string }> }> };
const W = 560, H = 150;

/** Perseverance MEDA: air and ground temperature and pressure through a sol, for each snapshotted sol. */
export default function WeatherPanel() {
  const [data, setData] = useState<Meda | null>(null);
  const [error, setError] = useState('');
  const [sol, setSol] = useState<number | null>(null);
  useEffect(() => { getMissionData('weather').then((d) => { const m = d as Meda; setData(m); setSol(m.sols.at(-1)?.sol ?? null); }).catch((e: Error) => setError(e.message)); }, []);
  const day = data?.sols.find((s) => s.sol === sol);
  const chart = useMemo(() => {
    if (!day) return null;
    const temps = day.hours.flatMap((h) => [h.AIR_TEMP, h.GROUND_TEMP]).filter((v): v is number => v != null);
    const lo = Math.floor(Math.min(...temps) / 10) * 10, hi = Math.ceil(Math.max(...temps) / 10) * 10;
    const x = (h: number) => (h / 23) * W, y = (k: number) => H - ((k - lo) / Math.max(1, hi - lo)) * H;
    const path = (key: 'AIR_TEMP' | 'GROUND_TEMP') => day.hours.filter((h) => h[key] != null).map((h, i) => `${i ? 'L' : 'M'}${x(h.ltstHour).toFixed(1)},${y(h[key]!).toFixed(1)}`).join('');
    const pick = (key: 'AIR_TEMP' | 'GROUND_TEMP' | 'PRESSURE') => day.hours.map((h) => h[key]).filter((v): v is number => v != null);
    return { lo, hi, air: path('AIR_TEMP'), ground: path('GROUND_TEMP'), airV: pick('AIR_TEMP'), groundV: pick('GROUND_TEMP'), pres: pick('PRESSURE') };
  }, [day]);
  const c = (k: number) => `${(k - 273.15).toFixed(0)} °C`;
  return (
    <section className="theater-section weather-panel" aria-label="Perseverance MEDA weather">
      <div className="theater-section-head"><span>SURVIVAL / WEATHER AT JEZERO</span><span>NASA PDS · MARS 2020 MEDA</span></div>
      {error && <p className="compare-note">MEDA snapshot unavailable ({error}). Run python3 scripts/refresh-meda.py.</p>}
      {data && day && chart && <>
        <div className="wx-sols" role="group" aria-label="Choose a sol">{data.sols.map((s) => <button key={s.sol} className={s.sol === sol ? 'active' : ''} onClick={() => setSol(s.sol)}>SOL {s.sol}</button>)}</div>
        <div className="wx-stats">
          <div><small>AIR TEMPERATURE</small><strong>{c(Math.min(...chart.airV))} → {c(Math.max(...chart.airV))}</strong></div>
          <div><small>GROUND TEMPERATURE</small><strong>{c(Math.min(...chart.groundV))} → {c(Math.max(...chart.groundV))}</strong></div>
          <div><small>PRESSURE</small><strong>{chart.pres.length ? `${Math.min(...chart.pres).toFixed(0)}–${Math.max(...chart.pres).toFixed(0)} Pa` : '—'}</strong><em>EARTH SEA LEVEL ≈ 101,325 Pa</em></div>
          <div><small>DAY–NIGHT SWING</small><strong>{(Math.max(...chart.groundV) - Math.min(...chart.groundV)).toFixed(0)} K GROUND</strong></div>
        </div>
        <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`Sol ${day.sol} hourly air temperature ${c(Math.min(...chart.airV))} to ${c(Math.max(...chart.airV))}, ground ${c(Math.min(...chart.groundV))} to ${c(Math.max(...chart.groundV))}`}>
          {[0, 6, 12, 18, 23].map((h) => <text key={h} x={(h / 23) * W} y={H + 14} className="cc-year" textAnchor={h === 0 ? "start" : h === 23 ? "end" : "middle"}>{String(h).padStart(2, '0')}:00</text>)}
          <path d={chart.ground} className="wx-ground" /><path d={chart.air} className="wx-air" />
        </svg>
        <footer className="vd-note"><span className="wx-key wx-key-air" /> AIR (TIRS) · <span className="wx-key wx-key-ground" /> GROUND (TIRS) · hourly means by local true solar time · <a href={day.sources[0]?.url ?? data.sourcePage} target="_blank" rel="noreferrer">MEDA FILE ↗</a> · snapshot {data.retrievedAt.slice(0, 10)}</footer>
      </>}
    </section>
  );
}
