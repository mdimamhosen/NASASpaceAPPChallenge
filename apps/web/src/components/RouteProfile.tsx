'use client';

import { useMemo, useState } from 'react';
import type { TerrainSample } from '@mars-explorer/shared';
import { cumulativeKm } from '@/lib/geo';

const DEM_LABEL = 'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_dem.xml';
const W = 600, H = 96, SLOPE_CAP = 15;
// Samples are ≤0.12 km apart along the route; a larger jump means the route left DTM coverage.
const GAP_KM = 0.25;

const slopeTone = (slope = 0) => (slope >= SLOPE_CAP ? 'var(--mars)' : slope >= 10 ? '#F2F0EA' : slope >= 5 ? '#A9ABAF' : '#4A505C');

export default function RouteProfile({ samples }: { samples: TerrainSample[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const model = useMemo(() => {
    if (samples.length < 2) return null;
    const dist = cumulativeKm(samples);
    const total = dist.at(-1) || 1;
    const elev = samples.map((s) => s.elevationM);
    const min = Math.min(...elev), max = Math.max(...elev), span = Math.max(1, max - min);
    const x = (i: number) => (dist[i] / total) * W;
    const y = (i: number) => 8 + (1 - (elev[i] - min) / span) * (H - 16);
    let line = '', area = '', runStart = 0;
    const closeRun = (end: number) => { area += `L${x(end).toFixed(1)},${H}L${x(runStart).toFixed(1)},${H}Z`; };
    samples.forEach((_, i) => {
      const gap = i > 0 && dist[i] - dist[i - 1] > GAP_KM;
      if (gap) closeRun(i - 1);
      if (i === 0 || gap) runStart = i;
      const cmd = `${i === 0 || gap ? 'M' : 'L'}${x(i).toFixed(1)},${y(i).toFixed(1)}`;
      line += cmd;
      area += cmd;
    });
    closeRun(samples.length - 1);
    const peakSlope = Math.max(...samples.map((s) => s.slopeDeg ?? 0));
    return { dist, total, min, max, x, y, line, area, peakSlope };
  }, [samples]);

  if (!model) return null;
  const point = hover == null ? null : samples[hover];

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const km = ((event.clientX - box.left) / box.width) * model.total;
    let best = 0;
    model.dist.forEach((d, i) => { if (Math.abs(d - km) < Math.abs(model.dist[best] - km)) best = i; });
    setHover(best);
  };

  return (
    <section className="terrain-profile" aria-label="Elevation and slope profile from the NASA PLACES orbital DEM">
      <header>
        <span>ELEVATION / SLOPE PROFILE</span>
        <span>{point ? `${model.dist[hover!].toFixed(2)} KM · ${point.elevationM.toFixed(0)} M · ${(point.slopeDeg ?? 0).toFixed(1)}°` : `MIN ${model.min.toFixed(0)} · MAX ${model.max.toFixed(0)} M · PEAK ${model.peakSlope.toFixed(1)}°`}</span>
      </header>
      <svg viewBox={`0 0 ${W} ${H + 10}`} preserveAspectRatio="none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`Elevation from ${model.min.toFixed(0)} to ${model.max.toFixed(0)} metres over ${model.total.toFixed(2)} km`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} className="tp-grid" />)}
        <path d={model.area} className="tp-area" />
        <path d={model.line} className="tp-line" vectorEffect="non-scaling-stroke" />
        {samples.map((s, i) => <rect key={i} x={model.x(i)} y={H + 3} width={Math.max(1, W / samples.length)} height={6} fill={slopeTone(s.slopeDeg)} />)}
        {hover != null && <line x1={model.x(hover)} x2={model.x(hover)} y1={0} y2={H + 10} className="tp-cursor" vectorEffect="non-scaling-stroke" />}
      </svg>
      <footer>
        <span><i style={{ background: '#4A505C' }} />&lt;5°</span><span><i style={{ background: '#A9ABAF' }} />5–10°</span><span><i style={{ background: '#F2F0EA' }} />10–15°</span><span><i style={{ background: 'var(--mars)' }} />≥{SLOPE_CAP}° · RISK SLOPE TERM SATURATES</span>
        <a href={DEM_LABEL} target="_blank" rel="noreferrer">PLACES ORBITAL DEM · ~118 M GRID · NON-CERTIFYING ↗</a>
      </footer>
    </section>
  );
}
