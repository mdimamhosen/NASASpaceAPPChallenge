'use client';

import { useEffect, useMemo, useState } from 'react';
import { arrayEnergyWh, conjunctionWindows, daylightLtst, driveEnergy, MARS_FACT_SHEET_URL, dustSeason, earthMarsGeometry, evaBudget, formatHours, MARS24_URL, marsTime, RAD_SOURCE_URL, type LatLon, type TerrainSample } from '@mars-explorer/shared';
import { cumulativeKm } from '@/lib/geo';

/** "Can we walk now?": Mars24 local time and daylight, EVA suit-time verdict, radiation dose and the next comm blackout. NON-CERTIFYING. */
export default function SurvivalCard({ start, samples, distanceKm, dtm }: { start: LatLon; samples: TerrainSample[]; distanceKm: number; dtm: boolean }) {
  const [now, setNow] = useState(() => new Date());
  const [suitHours, setSuitHours] = useState(8);
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(id); }, []);

  const t = marsTime(now, start.lon);
  const day = daylightLtst(start.lat, t.declination);
  const budget = useMemo(() => {
    const km = cumulativeKm(samples);
    const profile = dtm && samples.length > 1 ? samples.map((s, i) => ({ km: km[i], elevationM: s.elevationM })) : [{ km: 0, elevationM: 0 }, { km: distanceKm, elevationM: 0 }];
    return evaBudget({ profile, suitHours, daylightHours: day?.hours });
  }, [samples, distanceKm, dtm, suitHours, day?.hours]);
  const power = arrayEnergyWh({ latDeg: start.lat, ls: t.ls, tau: dustSeason(t.ls) ? 1 : 0.5, areaM2: 10 });
  const drive = useMemo(() => { const km = cumulativeKm(samples); return driveEnergy(dtm && samples.length > 1 ? samples.map((s, i) => ({ km: km[i], elevationM: s.elevationM })) : [{ km: 0, elevationM: 0 }, { km: distanceKm, elevationM: 0 }]); }, [samples, distanceKm, dtm]);
  const blackout = useMemo(() => conjunctionWindows(now, new Date(now.getTime() + 3 * 365.25 * 864e5))[0], [now.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps
  const light = earthMarsGeometry(now).lightMinutes;
  // Walking now fits if the round trip ends before sunset (both in local true solar time).
  const left = day ? day.sunset - t.ltst : null;
  const sunNow = day ? t.ltst >= day.sunrise && t.ltst < day.sunset : false;

  return (
    <section className="survival-card" aria-label="Survival budget for this route, non-certifying">
      <header><span>SURVIVAL / CAN WE WALK NOW?</span><span className={`sv-status sv-${budget.status.toLowerCase()}`}>EVA {budget.status}</span></header>
      <div className="sv-grid">
        <div><small>LOCAL TRUE SOLAR TIME</small><strong>{formatHours(t.ltst)}</strong><em>Ls {t.ls.toFixed(1)}°{dustSeason(t.ls) ? ' · DUST SEASON' : ''}</em></div>
        <div><small>DAYLIGHT (LTST)</small><strong>{day ? `${formatHours(day.sunrise)}–${formatHours(day.sunset)}` : '—'}</strong><em>{!day ? 'NO SUNRISE/SUNSET' : sunNow ? `${left!.toFixed(1)} H OF SUN LEFT` : 'NIGHT NOW'}</em></div>
        <div><small>WALK OUT + BACK</small><strong>{budget.totalH.toFixed(2)} H</strong><em>{budget.outboundH.toFixed(2)} OUT · {budget.returnH.toFixed(2)} BACK · {dtm ? 'DEM SLOPES' : 'FLAT (LOW DEM COVER)'}</em></div>
        <div><small>SUIT TIME</small><strong>{budget.usableH.toFixed(1)} H USABLE</strong><em><label>SUIT <select value={suitHours} onChange={(e) => setSuitHours(Number(e.target.value))} aria-label="Suit consumables hours">{[4, 6, 8, 10].map((h) => <option key={h} value={h}>{h} H</option>)}</select></label> · 25% RESERVE</em></div>
        <div><small>RADIATION DOSE</small><strong>{budget.doseMsv.toFixed(3)} mSv</strong><em><a href={RAD_SOURCE_URL} target="_blank" rel="noreferrer">RAD 0.67 mSv/DAY ↗</a></em></div>
        <div><small>EARTH LINK</small><strong>{light.toFixed(1)} MIN</strong><em>{blackout ? `NEXT BLACKOUT ${blackout.start} → ${blackout.end}` : 'NO CONJUNCTION IN 3 Y'}</em></div>
        <div><small>SOLAR, 10 m² ARRAY</small><strong>{(power.energyWh / 1000).toFixed(1)} kWh/SOL</strong><em>{Math.round(power.insolationWhM2)} Wh/m² · τ {dustSeason(t.ls) ? 1 : 0.5} · <a href={MARS_FACT_SHEET_URL} target="_blank" rel="noreferrer">FACT SHEET ↗</a></em></div>
        <div><small>ROVER DRIVE ENERGY</small><strong>{Math.round(drive.electricWh)} Wh</strong><em>{(drive.fractionOfSol * 100).toFixed(0)}% OF A SOL OF MMRTG · SLIP {drive.slipRisk}</em></div>
      </div>
      <footer>{sunNow && left != null && budget.totalH > left ? 'Round trip would end after sunset. ' : ''}{budget.fitsDaylight === false ? 'Round trip is longer than today\'s daylight. ' : ''}2 km/h suited speed with Tobler slope penalty, steepest grade {budget.steepestGradePct.toFixed(1)}%. NON-CERTIFYING · <a href={MARS24_URL} target="_blank" rel="noreferrer">NASA MARS24 ↗</a></footer>
    </section>
  );
}
