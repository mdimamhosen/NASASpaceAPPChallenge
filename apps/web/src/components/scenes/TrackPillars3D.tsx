'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { PlacesTrack, POI } from '@mars-explorer/shared';
import { MARS_RADIUS_KM } from '@mars-explorer/shared';
import { LabelLayer, LabelProjector, type ScreenLabel } from './TerrainView3D';

const EXAGGERATION = 6, PILLARS = 64, CYCLE_S = 9;

type Pillar = { sol: number; x: number; z: number; h: number; elev: number; verified: boolean };

/** Pillars rise in sol order on a loop (must render inside the Canvas). */
function Pillars({ pillars, maxSol }: { pillars: Pillar[]; maxSol: number }) {
  const refs = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime % CYCLE_S) / (CYCLE_S * 0.7);
    pillars.forEach((p, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const local = Math.min(1, Math.max(0, (t - (p.sol / maxSol) * 0.7) / 0.3)), e = 1 - (1 - local) ** 3;
      const h = Math.max(0.001, p.h * e);
      mesh.scale.y = h;
      mesh.position.y = h / 2;
    });
  });
  return (
    <>
      {pillars.map((p, i) => (
        <mesh key={p.sol} position={[p.x, p.h / 2, p.z]} ref={(m) => { if (m) refs.current[i] = m; }}>
          <boxGeometry args={[p.verified ? 0.34 : 0.2, 1, p.verified ? 0.34 : 0.2]} />
          <meshStandardMaterial color={p.verified ? '#C45C26' : new THREE.Color().lerpColors(new THREE.Color('#3a404c'), new THREE.Color('#f2f0ea'), p.sol / maxSol)} roughness={0.6} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Perseverance's climb: one pillar per sampled PLACES record, height = the CSV's published elevation.
 * NASA-verified locations stand out in orange.
 */
export default function TrackPillars3D({ track, pois = [] }: { track: PlacesTrack; pois?: POI[] }) {
  const model = useMemo(() => {
    const pts = track.points.filter((p) => p.elevationM != null);
    const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length, lon0 = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
    const kmPerDeg = (Math.PI / 180) * MARS_RADIUS_KM, cos = Math.cos((lat0 * Math.PI) / 180);
    const xz = (lat: number, lon: number) => [(lon - lon0) * kmPerDeg * cos, -(lat - lat0) * kmPerDeg] as const;
    const minE = Math.min(...pts.map((p) => p.elevationM!)), maxE = Math.max(...pts.map((p) => p.elevationM!));
    const step = Math.max(1, Math.floor(pts.length / PILLARS));
    const verified = new Set(pois.filter((p) => p.sourceKind === 'NASA_PLACES').map((p) => pts.reduce((best, q) => (Math.hypot(q.lat - p.lat, q.lon - p.lon) < Math.hypot(best.lat - p.lat, best.lon - p.lon) ? q : best)).sol));
    const pillars = pts.filter((p, i) => i % step === 0 || verified.has(p.sol) || i === pts.length - 1).map((p) => {
      const [x, z] = xz(p.lat, p.lon);
      return { sol: p.sol, x, z, h: ((p.elevationM! - minE) / 1000) * EXAGGERATION + 0.05, elev: p.elevationM!, verified: verified.has(p.sol) };
    });
    const floor = pts.map((p) => { const [x, z] = xz(p.lat, p.lon); return [x, 0.01, z] as [number, number, number]; });
    return { pillars, floor, minE, maxE, maxSol: pts.at(-1)!.sol };
  }, [track, pois]);
  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const labels = useMemo<ScreenLabel[]>(() => model.pillars.filter((p) => p.verified || p === model.pillars.at(-1)).map((p) => ({ key: `s${p.sol}`, text: `SOL ${p.sol} · ${Math.round(p.elev)} M${p.verified ? ' · VERIFIED' : ''}`, tone: p.verified ? '#C45C26' : '#9a9ea6', at: () => [p.x, p.h + 0.15, p.z] })), [model]);
  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} camera={{ position: [3, 5.5, 10], fov: 38 }}>
        <color attach="background" args={['#07090d']} />
        <hemisphereLight args={['#f4efe6', '#0b0e14', 0.7]} />
        <directionalLight position={[-6, 9, 5]} intensity={1.6} />
        <gridHelper args={[24, 24, '#2a303c', '#161a22']} />
        <Line points={model.floor} color="#5a606b" lineWidth={1.4} />
        <Pillars pillars={model.pillars} maxSol={model.maxSol} />
        <LabelProjector labels={labels} nodes={nodes} />
        <OrbitControls makeDefault enableDamping autoRotate autoRotateSpeed={0.3} maxPolarAngle={Math.PI / 2.1} target={[0, 0.8, 0]} />
      </Canvas>
      <LabelLayer labels={labels} nodes={nodes} />
      <div className="terrain-hud terrain-hud-top">
        <span>PERSEVERANCE · ELEVATION CLIMB</span>
        <span>{Math.round(model.minE)} → {Math.round(model.maxE)} M · +{Math.round(model.maxE - model.minE)} M · ×{EXAGGERATION}</span>
      </div>
      <div className="terrain-credit">HEIGHTS: PUBLISHED ELEVATION COLUMN OF <a href={track.sourceUrl} target="_blank" rel="noreferrer">MARS 2020 PLACES BEST_INTERP ↗</a> · ORANGE = NASA-VERIFIED LOCATIONS · NOT LIVE TELEMETRY</div>
    </div>
  );
}
