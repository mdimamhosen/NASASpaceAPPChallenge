'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_WEIGHTS, suitability, type DtmGrid, type PlacesPoint, type POI } from '@mars-explorer/shared';
import { buildModel, toWorld } from './TerrainView3D';
import { DemMesh, SceneShell, viridis } from './sceneKit';

const EX = 3;

function Beacon({ position, rank }: { position: [number, number, number]; rank: number }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = 1 + ((clock.elapsedTime * 0.8 + rank * 0.2) % 1) * 2.5;
    ring.current.scale.set(s, s, s);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - (s - 1) / 2.5);
  });
  return <group position={position}>
    <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.012, 0.012, 0.7, 8]} /><meshBasicMaterial color="#fde725" /></mesh>
    <mesh position={[0, 0.72, 0]}><sphereGeometry args={[0.05, 16, 16]} /><meshBasicMaterial color="#fde725" /></mesh>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><ringGeometry args={[0.06, 0.08, 32]} /><meshBasicMaterial color="#fde725" transparent side={THREE.DoubleSide} /></mesh>
  </group>;
}

/** Habitat suitability over the PLACES DEM: terrain tinted by score, beacons on the five best-separated sites. */
export default function SuitabilityTerrain3D({ grid, pois, track }: { grid: DtmGrid; pois: POI[]; track: PlacesPoint[] }) {
  const m = useMemo(() => buildModel(grid), [grid]);
  const result = useMemo(() => suitability({ ...grid, targets: pois.filter((p) => p.sourceKind !== 'DEMO' && (p.category === 'geology' || p.category === 'mission')), track }, DEFAULT_WEIGHTS), [grid, pois, track]);
  const colorAt = useCallback((r: number, c: number) => { const v = result.cells[r]?.[c]; return v == null ? null : viridis(v / 100); }, [result]);
  return (
    <SceneShell title="HABITAT SUITABILITY · PLACES DEM" meta={`TOP SITE ${Math.round(result.best[0]?.score ?? 0)}/100 · ${result.best.length} BEACONS · NON-CERTIFYING`} camera={[m.W * 0.55, m.W * 0.5, m.W * 0.8]}
      credit={<>SCORE: SLOPE · ROUGHNESS · ELEVATION · SCIENCE PROXIMITY · DRIVEN GROUND · <a href={grid.labelUrl} target="_blank" rel="noreferrer">MARS 2020 PLACES DEM ↗</a> · RANKS WHERE TO LOOK, NOT WHERE IT IS SAFE</>}>
      <DemMesh m={m} exaggeration={EX} colorAt={colorAt} />
      {result.best.map((s, i) => <Beacon key={`${s.lat}-${s.lon}`} rank={i} position={toWorld(m, s, EX, 0.02)} />)}
    </SceneShell>
  );
}
