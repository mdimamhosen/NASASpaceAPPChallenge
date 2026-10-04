'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DtmGrid } from '@mars-explorer/shared';
import { buildModel, type Model } from './TerrainView3D';

const EXAGGERATION = 4, GROW_S = 2.8;
const RAMP = ['#1d2430', '#3b3f45', '#6e5a48', '#b07a52', '#e2c9a6', '#f5f1e8'].map((c) => new THREE.Color(c));
const ramp = (f: number) => { const x = Math.min(0.999, Math.max(0, f)) * (RAMP.length - 1), i = Math.floor(x); return RAMP[i].clone().lerp(RAMP[i + 1], x - i); };

function Columns({ m }: { m: Model }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const t = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = m.R * m.C;
  const heights = useMemo(() => Array.from({ length: count }, (_, k) => ((m.cell(Math.floor(k / m.C), k % m.C) - m.minElev) / 1000) * EXAGGERATION + 0.03), [m, count]);
  useLayoutEffect(() => {
    const span = Math.max(1, m.maxElev - m.minElev);
    for (let k = 0; k < count; k++) mesh.current!.setColorAt(k, ramp((m.cell(Math.floor(k / m.C), k % m.C) - m.minElev) / span));
    mesh.current!.instanceColor!.needsUpdate = true;
  }, [m, count]);
  useFrame((_, delta) => {
    if (t.current > GROW_S + 0.1) return;
    t.current += delta;
    for (let k = 0; k < count; k++) {
      const r = Math.floor(k / m.C), c = k % m.C;
      // Columns rise in a wave from the crater floor (south-east) outward.
      const local = Math.min(1, Math.max(0, (t.current - (r / m.R + (m.C - c) / m.C) * 0.6) / 1.2));
      const e = 1 - (1 - local) ** 3, h = Math.max(0.001, heights[k] * e);
      dummy.position.set(c * m.dx - m.W / 2, h / 2, m.D / 2 - r * m.dy);
      dummy.scale.set(m.dx * 0.86, h, m.dy * 0.86);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(k, dummy.matrix);
    }
    mesh.current!.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, count]}><boxGeometry /><meshStandardMaterial roughness={0.75} metalness={0.05} /></instancedMesh>;
}

/** The PLACES orbital DEM as 4,512 measured columns, one per sampled grid cell. */
export default function DemColumns3D({ grid }: { grid: DtmGrid }) {
  const m = useMemo(() => buildModel(grid), [grid]);
  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} camera={{ position: [m.W * 0.62, m.W * 0.56, m.W * 0.86], fov: 38 }}>
        <color attach="background" args={['#07090d']} />
        <hemisphereLight args={['#f4efe6', '#0b0e14', 0.6]} />
        <directionalLight position={[-m.W, m.W, m.D * 0.5]} intensity={1.8} />
        <Columns m={m} />
        <OrbitControls makeDefault enableDamping autoRotate autoRotateSpeed={0.35} maxPolarAngle={Math.PI / 2.2} target={[0, 0.4, 0]} />
      </Canvas>
      <div className="terrain-hud terrain-hud-top">
        <span>JEZERO · DEM COLUMNS</span>
        <span>{m.R * m.C} SAMPLES · {Math.round(m.minElev)} → {Math.round(m.maxElev)} M · ×{EXAGGERATION}</span>
      </div>
      <div className="column-ramp" aria-hidden><span>{Math.round(m.minElev)} M</span><i /><span>{Math.round(m.maxElev)} M</span></div>
      <div className="terrain-credit">ELEVATION: <a href={grid.labelUrl} target="_blank" rel="noreferrer">MARS 2020 PLACES ORBITAL DEM ↗</a> · 0.002° (~118 M) SAMPLE SPACING · NON-CERTIFYING</div>
    </div>
  );
}
