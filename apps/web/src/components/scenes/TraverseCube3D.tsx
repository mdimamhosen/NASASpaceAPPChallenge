'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { PlacesTrack } from '@mars-explorer/shared';
import { MARS_RADIUS_KM } from '@mars-explorer/shared';
import { LabelLayer, LabelProjector, TREK_JEZERO_SOURCE, useTrekTexture, type ScreenLabel } from './TerrainView3D';

const DRAW_S = 14, HOLD_S = 3;

/**
 * Space-time cube: published PLACES localizations on NASA Trek ground imagery, with sol on the vertical axis.
 * Position and sol are both from the PDS CSV; only the vertical scale is a display choice.
 */
export default function TraverseCube3D({ track }: { track: PlacesTrack }) {
  const model = useMemo(() => {
    const pts = track.points;
    const pad = 0.006;
    const b = { latMin: Math.min(...pts.map((p) => p.lat)) - pad, latMax: Math.max(...pts.map((p) => p.lat)) + pad, lonMin: Math.min(...pts.map((p) => p.lon)) - pad, lonMax: Math.max(...pts.map((p) => p.lon)) + pad };
    const kmPerDeg = (Math.PI / 180) * MARS_RADIUS_KM;
    const W = (b.lonMax - b.lonMin) * kmPerDeg * Math.cos((((b.latMin + b.latMax) / 2) * Math.PI) / 180), D = (b.latMax - b.latMin) * kmPerDeg;
    const H = Math.max(W, D) * 0.55, maxSol = Math.max(1, pts.at(-1)!.sol);
    const xz = (lat: number, lon: number) => [((lon - b.lonMin) / (b.lonMax - b.lonMin) - 0.5) * W, (0.5 - (lat - b.latMin) / (b.latMax - b.latMin)) * D] as const;
    const path = pts.map((p) => { const [x, z] = xz(p.lat, p.lon); return [x, (p.sol / maxSol) * H, z] as [number, number, number]; });
    const shadow = path.map(([x, , z]) => [x, 0.01, z] as [number, number, number]);
    const colors = pts.map((p) => new THREE.Color().lerpColors(new THREE.Color('#5a606b'), new THREE.Color('#f2f0ea'), p.sol / maxSol));
    const step = maxSol > 1200 ? 500 : 250;
    const ticks = Array.from({ length: Math.floor(maxSol / step) }, (_, i) => (i + 1) * step);
    const tickAt = (sol: number) => path[Math.max(0, pts.findIndex((p) => p.sol >= sol))];
    return { b, W, D, H, maxSol, path, shadow, colors, ticks, tickAt, sols: pts.map((p) => p.sol) };
  }, [track]);
  const { texture } = useTrekTexture(model.b);
  const counter = useRef<HTMLSpanElement>(null);
  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const labels = useMemo<ScreenLabel[]>(() => [
    { key: 'start', text: 'SOL 0 · OCTAVIA E. BUTLER LANDING', tone: '#9a9ea6', at: () => model.path[0] },
    ...model.ticks.map((sol) => ({ key: `t${sol}`, text: `SOL ${sol}`, tone: '#5a606b', at: () => { const p = model.tickAt(sol); return [p[0], p[1] + 0.05, p[2]] as [number, number, number]; } })),
  ], [model]);

  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} camera={{ position: [model.W * 0.75, model.H * 1.5, model.W * 1.05], fov: 36, near: 0.01, far: 400 }}>
        <color attach="background" args={['#07090d']} />
        <ambientLight intensity={1} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[model.W, model.D]} />
          <meshBasicMaterial map={texture} color={texture ? '#cfcfcf' : '#333'} />
        </mesh>
        <lineSegments position={[0, model.H / 2, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(model.W, model.H, model.D)]} />
          <lineBasicMaterial color="#2a303c" />
        </lineSegments>
        <Line points={model.shadow} color="#0b0e14" lineWidth={2.5} transparent opacity={0.85} />
        <Traverse model={model} counter={counter} />
        {model.ticks.map((sol) => { const p = model.tickAt(sol); return <Line key={sol} points={[[p[0], 0.01, p[2]], p]} color="#3a404c" lineWidth={1} dashed dashSize={0.1} gapSize={0.08} />; })}
        <LabelProjector labels={labels} nodes={nodes} />
        <OrbitControls makeDefault enableDamping autoRotate autoRotateSpeed={0.3} target={[0, model.H * 0.4, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={2} maxDistance={model.W * 4} />
      </Canvas>
      <LabelLayer labels={labels} nodes={nodes} />
      <div className="terrain-hud terrain-hud-top">
        <span>PERSEVERANCE · SPACE-TIME CUBE</span>
        <span ref={counter}>SOL 0</span>
      </div>
      <div className="terrain-hud terrain-hud-bottom">
        <span className="terrain-badge">X/Z = PLACES LOCALIZATION · Y = SOL · {track.points.length} PUBLISHED SAMPLES</span>
      </div>
      <div className="terrain-credit">
        TRACK: <a href={track.sourceUrl} target="_blank" rel="noreferrer">MARS 2020 PLACES BEST_INTERP ↗</a> · GROUND: NASA/JPL-CALTECH/UARIZONA/MSSS HIRISE + CTX VIA <a href={TREK_JEZERO_SOURCE} target="_blank" rel="noreferrer">NASA MARS TREK ↗</a>
      </div>
    </div>
  );
}

/** Draws the traverse on over time by advancing Line2's instance count; loops after a short hold. */
function Traverse({ model, counter }: { model: { path: [number, number, number][]; colors: THREE.Color[]; maxSol: number; sols: number[] }; counter: React.RefObject<HTMLSpanElement | null> }) {
  const line = useRef<{ geometry: THREE.InstancedBufferGeometry } | null>(null);
  const head = useRef<THREE.Mesh>(null);
  const clock = useRef(0);
  const segments = model.path.length - 1;
  useFrame((_, delta) => {
    clock.current = (clock.current + delta) % (DRAW_S + HOLD_S);
    const f = Math.min(1, clock.current / DRAW_S);
    const n = Math.max(1, Math.round(f * segments));
    if (line.current) line.current.geometry.instanceCount = n;
    const p = model.path[n];
    head.current?.position.set(p[0], p[1], p[2]);
    if (counter.current) counter.current.textContent = `SOL ${model.sols[n]} / ${model.maxSol}`;
  });
  return (
    <>
      <Line ref={line as never} points={model.path} vertexColors={model.colors} lineWidth={2.6} />
      <mesh ref={head}><sphereGeometry args={[0.06, 16, 16]} /><meshBasicMaterial color="#C45C26" /></mesh>
    </>
  );
}
