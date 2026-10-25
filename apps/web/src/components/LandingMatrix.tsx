'use client';

import { useEffect, useState } from 'react';
import { daylightLtst, marsTime, NASA_MARS_LANDINGS, type MarsHardware } from '@mars-explorer/shared';
import { getHardware } from '@/lib/api';

/** Nine NASA landing sites side by side: place, latitude, today's daylight there, and how long the spacecraft worked. */
export default function LandingMatrix() {
  const [hw, setHw] = useState<MarsHardware[]>([]);
  useEffect(() => { getHardware().then(setHw).catch(() => setHw([])); }, []);
  const now = new Date();
  const days = (a: string, b?: string | null) => Math.round(((b ? Date.parse(b) : now.getTime()) - Date.parse(a)) / 864e5);
  return (
    <section className="theater-section" aria-label="NASA landing site comparison">
      <div className="theater-section-head"><span>DATA / LANDING SITES COMPARED</span><span>NSSDCA · NASA MISSION PAGES · MARS24</span></div>
      <div className="vd-scroll"><table className="vd-table">
        <thead><tr><th>LANDED</th><th>SPACECRAFT</th><th>PLACE</th><th>LAT</th><th>DAYLIGHT TODAY</th><th>STATUS</th><th>EARTH DAYS WORKING</th></tr></thead>
        <tbody>{NASA_MARS_LANDINGS.map((s) => {
          const t = marsTime(now, s.lon), d = daylightLtst(s.lat, t.declination);
          // Spacecraft are drawn at their landing site (Perseverance at its latest PLACES fix, within ~0.5° of landing).
          const main = hw.filter((x) => x.kind !== 'helicopter' && Math.abs(x.lat - s.lat) < 0.6 && Math.abs(x.lon - s.lon) < 0.6).sort((a, b) => (a.kind === 'rover' ? -1 : 1) - (b.kind === 'rover' ? -1 : 1))[0];
          return <tr key={s.name}><td>{s.year}</td><td>{s.name}</td><td>{s.place}</td><td>{s.lat.toFixed(2)}°</td><td>{d ? `${d.hours.toFixed(1)} H` : 'NO SUNRISE / SUNSET'}</td><td>{main ? (main.status === 'active' ? 'ACTIVE' : `SILENT SINCE ${main.lastContact}`) : '—'}</td><td>{main ? days(main.landed, main.lastContact).toLocaleString() : '—'}</td></tr>;
        })}</tbody>
      </table></div>
      <p className="vd-note">Daylight from the NASA GISS Mars24 algorithm at each site for today's season: high-latitude Phoenix swings between endless day and polar night. Status and dates from NASA mission pages (data/mars-hardware.json).</p>
    </section>
  );
}
