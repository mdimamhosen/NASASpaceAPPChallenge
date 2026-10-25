'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { evaBudget, RAD_SOURCE_URL, RAD_SURFACE_MSV_PER_DAY, type DtmGrid, type LatLon } from '@mars-explorer/shared';
import { buildModel, drape, toWorld } from './TerrainView3D';
import { DemMesh, SceneShell } from './sceneKit';

const EX = 3, LOOP_S = 12;

function Walker({ line, start }: { line: [number, number, number][]; start: [number, number, number] }) {
  const walker = useRef<THREE.Group>(null), pillar = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!walker.current) return;
    const f = (clock.elapsedTime % LOOP_S) / LOOP_S, k = f * (line.length - 1), i = Math.floor(k), u = k - i;
    const a = line[i], b = line[Math.min(line.length - 1, i + 1)];
    walker.current.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + 0.06, a[2] + (b[2] - a[2]) * u);
    // Dose pillar grows linearly with time out (constant RAD rate), full height at the end of the loop.
    if (pillar.current) { const h = Math.max(0.01, f * 1.2); pillar.current.scale.y = h; pillar.current.position.y = start[1] + h / 2; }
  });
  return <>
    <group ref={walker}><mesh><capsuleGeometry args={[0.03, 0.06, 4, 8]} /><meshBasicMaterial color="#ffffff" /></mesh></group>
    <mesh ref={pillar} position={[start[0] + 0.15, start[1], start[2]]}><cylinderGeometry args={[0.04, 0.04, 1, 12]} /><meshBasicMaterial color="#F2C94C" transparent opacity={0.85} /></mesh>
  </>;
}

/** A Marswalk on the DEM: ribbon coloured by walking speed, an astronaut marker, and a dose pillar that grows with time out. */
export default function EvaRibbon3D({ grid, waypoints }: { grid: DtmGrid; waypoints: LatLon[] }) {
  const m = useMemo(() => buildModel(grid), [grid]);
  const pts = useMemo(() => waypoints.filter(m.inside), [m, waypoints]);
  const line = useMemo(() => (pts.length > 1 ? drape(m, pts, EX, 0.03) : []), [m, pts]);
  const { colors, budget } = useMemo(() => {
    let km = 0;
    const prof = line.map((p, i) => { if (i) km += Math.hypot(p[0] - line[i - 1][0], p[2] - line[i - 1][2]); return { km, elevationM: m.minElev + (p[1] - 0.03) * (1000 / EX) }; });
    const budget = evaBudget({ profile: prof.length > 1 ? prof : [{ km: 0, elevationM: 0 }, { km: 0.001, elevationM: 0 }] });
    const colors = line.map((_, i) => {
      if (!i) return new THREE.Color('#5ec962');
      const g = Math.abs((prof[i].elevationM - prof[i - 1].elevationM) / Math.max(1, (prof[i].km - prof[i - 1].km) * 1000));
      return new THREE.Color('#5ec962').lerp(new THREE.Color('#C45C26'), Math.min(1, g / 0.15));
    });
    return { colors, budget };
  }, [line, m]);
  if (line.length < 2) return <div className="map-loading">DRAW A ROUTE INSIDE THE JEZERO DEM GRID</div>;
  const start = toWorld(m, pts[0], EX);
  const mid = line[Math.floor(line.length / 2)], span = Math.max(0.6, Math.hypot(line.at(-1)![0] - line[0][0], line.at(-1)![2] - line[0][2]));
  return (
    <SceneShell title={`EVA ${budget.status} · ${budget.totalH.toFixed(2)} H OUT + BACK`} meta={`DOSE ${budget.doseMsv.toFixed(3)} mSv · STEEPEST ${budget.steepestGradePct.toFixed(1)}% · NON-CERTIFYING`} camera={[mid[0] + span * 0.9, mid[1] + span * 0.8, mid[2] + span * 1.1]} target={mid} autoRotate={false}
      credit={<>GREEN = FLAT, ORANGE = STEEP (≥15% GRADE) · 2 KM/H TOBLER MODEL · PILLAR = DOSE AT <a href={RAD_SOURCE_URL} target="_blank" rel="noreferrer">RAD {RAD_SURFACE_MSV_PER_DAY} mSv/DAY ↗</a></>}>
      <DemMesh m={m} exaggeration={EX} opacity={0.95} />
      <Line points={line} vertexColors={colors} lineWidth={5} />
      <Walker line={line} start={start} />
    </SceneShell>
  );
}
