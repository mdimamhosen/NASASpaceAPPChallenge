'use client';

import { useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import type { DtmGrid } from '@mars-explorer/shared';
import { buildModel, toWorld } from './TerrainView3D';
import { DemMesh, SceneControls, SceneShell, viridis } from './sceneKit';

export type IngenuityFlight = { flight: number; sol: number; lengthM: number; durationS: number; track: Array<[number, number]> };
const EX = 3, HOP = 0.25;

/** Ingenuity's 72 flights from NASA's Mars 2020 map, arched over the DEM (arch height is display only: the layer has no altitude). */
export default function IngenuityFlights3D({ grid, flights, source }: { grid: DtmGrid; flights: IngenuityFlight[]; source: string }) {
  const m = useMemo(() => buildModel(grid), [grid]);
  const [upTo, setUpTo] = useState(flights.length);
  const arcs = useMemo(() => flights.map((f) => {
    const pts = f.track.map(([lat, lon]) => ({ lat, lon })).filter(m.inside);
    if (pts.length < 2) return null;
    return { f, line: pts.map((p, i) => { const w = toWorld(m, p, EX); return [w[0], w[1] + HOP * Math.sin((Math.PI * i) / (pts.length - 1)) + 0.02, w[2]] as [number, number, number]; }) };
  }), [flights, m]);
  const shown = flights.filter((f) => f.flight <= upTo);
  const km = shown.reduce((s, f) => s + f.lengthM, 0) / 1000;
  return (
    <SceneShell title={`INGENUITY · FLIGHTS 1–${upTo}`} meta={`${km.toFixed(2)} KM GROUND TRACK · ${(shown.reduce((s, f) => s + f.durationS, 0) / 60).toFixed(0)} MIN AIRBORNE`} camera={[m.W * 0.5, m.W * 0.45, m.W * 0.7]}
      credit={<>TRACKS: <a href={source} target="_blank" rel="noreferrer">NASA MARS 2020 MMGIS HELICOPTER LAYER ↗</a> · ARCH HEIGHT IS DISPLAY ONLY (NO ALTITUDE IN THE LAYER) · {arcs.filter(Boolean).length} FLIGHTS INSIDE THE DEM TILE</>}
      overlay={<SceneControls><label>FLIGHTS 1–{upTo}<input type="range" min={1} max={flights.length} value={upTo} onChange={(e) => setUpTo(Number(e.target.value))} /></label></SceneControls>}>
      <DemMesh m={m} exaggeration={EX} />
      {arcs.map((a) => a && a.f.flight <= upTo ? <Line key={a.f.flight} points={a.line} color={viridis(a.f.flight / flights.length)} lineWidth={2} /> : null)}
    </SceneShell>
  );
}
