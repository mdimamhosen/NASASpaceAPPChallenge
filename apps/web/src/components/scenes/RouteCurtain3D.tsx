'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { LatLon, RouteAnalysis } from '@mars-explorer/shared';
import { MARS_RADIUS_KM } from '@mars-explorer/shared';
import { analyzeRoute } from '@/lib/api';

const EXAGGERATION = 8, BASE = -0.15, REVEAL_S = 6, HOLD_S = 2.5;
const tone = (s = 0) => new THREE.Color(s >= 15 ? '#C45C26' : s >= 10 ? '#F2F0EA' : s >= 5 ? '#A9ABAF' : '#4A505C');

function Curtain({ samples }: { samples: RouteAnalysis['terrainSamples'] }) {
  const model = useMemo(() => {
    const lat0 = samples.reduce((s, p) => s + p.lat, 0) / samples.length, lon0 = samples.reduce((s, p) => s + p.lon, 0) / samples.length;
    const k = (Math.PI / 180) * MARS_RADIUS_KM, cos = Math.cos((lat0 * Math.PI) / 180);
    const minE = Math.min(...samples.map((s) => s.elevationM));
    const raw = samples.map((s) => [(s.lon - lon0) * k * cos, ((s.elevationM - minE) / 1000) * EXAGGERATION, -(s.lat - lat0) * k] as [number, number, number]);
    // Uniform scale to fit the view; vertical exaggeration stays relative to horizontal distance.
    const extent = Math.max(0.05, ...raw.map(([x, , z]) => Math.max(Math.abs(x), Math.abs(z))));
    const fit = 4 / extent;
    const top = raw.map(([x, y, z]) => [x * fit, y * fit, z * fit] as [number, number, number]);
    const positions: number[] = [], colors: number[] = [], index: number[] = [];
    top.forEach(([x, y, z], i) => {
      positions.push(x, y, z, x, BASE, z);
      const c = tone(samples[i].slopeDeg), dim = c.clone().multiplyScalar(0.25);
      colors.push(c.r, c.g, c.b, dim.r, dim.g, dim.b);
      if (i) { const a = (i - 1) * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(index);
    return { g, top, floor: top.map(([x, , z]) => [x, BASE, z] as [number, number, number]) };
  }, [samples]);
  useEffect(() => () => model.g.dispose(), [model]);
  const clock = useRef(0);
  const total = model.g.index!.count;
  useFrame((_, d) => {
    clock.current = (clock.current + d) % (REVEAL_S + HOLD_S);
    // Reveal the curtain along the route, then hold the full profile.
    model.g.setDrawRange(0, Math.max(6, Math.floor((Math.min(1, clock.current / REVEAL_S) * total) / 6) * 6));
  });
  return (
    <>
      <mesh geometry={model.g}><meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.88} /></mesh>
      <Line points={model.top} color="#f2f0ea" lineWidth={2} />
      <Line points={model.floor} color="#3a404c" lineWidth={1} />
    </>
  );
}

/** The briefing route's DEM samples raised into a 3D elevation curtain, colored by sampled slope. */
export default function RouteCurtain3D({ waypoints }: { waypoints: LatLon[] }) {
  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { analyzeRoute(waypoints.map((w, i) => ({ id: `c${i}`, ...w }))).then(setAnalysis).catch((e: Error) => setError(e.message)); }, [waypoints]);
  const samples = analysis?.terrainSamples ?? [];
  if (error) return <div className="map-loading">ROUTE ANALYSIS UNAVAILABLE</div>;
  if (samples.length < 2) return <div className="map-loading">{analysis ? 'ROUTE OUTSIDE DEM COVERAGE' : 'SAMPLING NASA PLACES DEM…'}</div>;
  const elev = samples.map((s) => s.elevationM);
  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 3.2, 7.5], fov: 38 }}>
        <color attach="background" args={['#07090d']} />
        <gridHelper args={[16, 32, '#2a303c', '#151920']} position={[0, BASE - 0.001, 0]} />
        <Curtain samples={samples} />
        <OrbitControls makeDefault enableDamping autoRotate autoRotateSpeed={0.4} maxPolarAngle={Math.PI / 2.1} target={[0, 0.6, 0]} />
      </Canvas>
      <div className="terrain-hud terrain-hud-top">
        <span>BRIEFING ROUTE · ELEVATION CURTAIN</span>
        <span>{analysis!.distanceKm.toFixed(2)} KM · {Math.round(Math.min(...elev))} → {Math.round(Math.max(...elev))} M · ×{EXAGGERATION}</span>
      </div>
      <div className="slope-legend" aria-hidden>
        <span><i style={{ background: '#4A505C' }} />&lt;5°</span><span><i style={{ background: '#A9ABAF' }} />5–10°</span><span><i style={{ background: '#F2F0EA' }} />10–15°</span><span><i style={{ background: '#C45C26' }} />≥15°</span>
      </div>
      <div className="terrain-credit">{samples.length} DEM SAMPLES FROM /routes/analyze · MARS 2020 PLACES ORBITAL DEM · RISK INDEX {analysis!.riskIndex.total}/100 · NON-CERTIFYING</div>
    </div>
  );
}
