'use client';

import { useEffect, useMemo, useState } from 'react';
import { conjunctionWindows, daylightLtst, dustSeason, earthMarsGeometry, formatHours, MARS24_URL, marsTime, NASA_MARS_LANDINGS, solarElongationDeg } from '@mars-explorer/shared';

const FROM = new Date('2020-07-30T00:00:00Z'); // Mars 2020 launch
const TO = new Date('2032-01-01T00:00:00Z');
const W = 1000, H = 90;
const JEZERO = NASA_MARS_LANDINGS.find((s) => s.mission === 'PERSEVERANCE')!;

/** Mars clock at Jezero (Mars24) and solar-conjunction comm blackouts 2020–2031 from JPL approximate elements. NON-CERTIFYING. */
export default function CommBlackoutCalendar() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const id = window.setInterval(() => setNow(new Date()), 10_000); return () => window.clearInterval(id); }, []);
  const model = useMemo(() => {
    const windows = conjunctionWindows(FROM, TO);
    const span = TO.getTime() - FROM.getTime();
    const x = (d: Date | string) => ((new Date(d).getTime() - FROM.getTime()) / span) * W;
    let line = '';
    for (let t = FROM.getTime(); t <= TO.getTime(); t += 5 * 864e5) line += `${line ? 'L' : 'M'}${x(new Date(t)).toFixed(1)},${(H - (solarElongationDeg(new Date(t)) / 180) * (H - 10)).toFixed(1)}`;
    return { windows, x, line, years: Array.from({ length: 11 }, (_, i) => 2021 + i) };
  }, []);
  if (!now) return null;
  const t = marsTime(now, JEZERO.lon);
  const day = daylightLtst(JEZERO.lat, t.declination);
  const next = model.windows.find((w) => w.end >= now.toISOString().slice(0, 10));
  const g = earthMarsGeometry(now);

  return (
    <section className="comm-calendar" aria-label="Mars clock at Jezero and Earth–Mars communication blackout calendar">
      <div className="cc-clock">
        <div><small>JEZERO LOCAL TRUE SOLAR TIME</small><strong>{formatHours(t.ltst)}</strong></div>
        <div><small>MARS SOL DATE</small><strong>{t.msd.toFixed(2)}</strong></div>
        <div><small>SEASON (Ls)</small><strong>{t.ls.toFixed(1)}°</strong><em>{dustSeason(t.ls) ? 'DUST-STORM SEASON' : 'OUTSIDE DUST SEASON'}</em></div>
        <div><small>SUNRISE / SUNSET</small><strong>{day ? `${formatHours(day.sunrise)} / ${formatHours(day.sunset)}` : '—'}</strong></div>
        <div><small>ONE-WAY LIGHT TIME</small><strong>{g.lightMinutes.toFixed(1)} MIN</strong></div>
        <div><small>NEXT BLACKOUT</small><strong>{next ? `${next.start} → ${next.end}` : '—'}</strong></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`Sun–Earth–Mars angle 2020 to 2031; blackouts ${model.windows.map((w) => `${w.start} to ${w.end}`).join(', ')}`}>
        {model.windows.map((w) => <g key={w.start}><rect x={model.x(w.start) - 3} y={0} width={Math.max(6, model.x(w.end) - model.x(w.start) + 6)} height={H} className="cc-blackout" /><text x={model.x(w.minDate)} y={12} textAnchor="middle" className="cc-label">{w.minDate}</text></g>)}
        <path d={model.line} className="cc-line" />
        <line x1={model.x(now)} x2={model.x(now)} y1={0} y2={H} className="cc-now" />
        {model.years.map((y) => <text key={y} x={model.x(`${y}-01-01`)} y={H + 14} textAnchor="middle" className="cc-year">{y}</text>)}
      </svg>
      <footer>Curve: Sun–Earth–Mars angle (180° = opposition, 0° = conjunction). Shaded: Sun within 3° of Mars as seen from Earth (heuristic threshold; each mission sets its own moratorium). NON-CERTIFYING · <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noreferrer">JPL ELEMENTS ↗</a> · <a href={MARS24_URL} target="_blank" rel="noreferrer">NASA MARS24 ↗</a></footer>
    </section>
  );
}
