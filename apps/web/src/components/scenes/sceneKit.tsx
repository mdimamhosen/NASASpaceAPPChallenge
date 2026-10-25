'use client';

import { useMemo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Model } from './TerrainView3D';

/** Viridis: perceptually uniform and colour-blind safe, shared by every data-tinted scene. */
const VIRIDIS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'].map((c) => new THREE.Color(c));
export const viridis = (t: number) => {
  const f = Math.min(0.999, Math.max(0, t)) * (VIRIDIS.length - 1), i = Math.floor(f);
  return VIRIDIS[i].clone().lerp(VIRIDIS[i + 1], f - i);
};

/** The PLACES DEM as a mesh, vertex-coloured per cell (null colour = neutral grey for gaps). */
export function DemMesh({ m, exaggeration, colorAt, opacity = 1 }: { m: Model; exaggeration: number; colorAt?: (row: number, col: number) => THREE.Color | null; opacity?: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(m.W, m.D, m.C - 1, m.R - 1);
    const pos = g.attributes.position, colors: number[] = [];
    const base = new THREE.Color('#5b5248');
    for (let k = 0; k < pos.count; k++) {
      const i = Math.floor(k / m.C), j = k % m.C, row = m.R - 1 - i;
      pos.setZ(k, ((m.cell(row, j) - m.minElev) / 1000) * exaggeration);
      const c = colorAt?.(row, j) ?? base;
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [m, exaggeration, colorAt]);
  return <mesh geometry={geometry}><meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} transparent={opacity < 1} opacity={opacity} side={THREE.DoubleSide} /></mesh>;
}

/** Common frame for showcase scenes: canvas, lights, orbit controls, HUD lines and a source credit. */
export function SceneShell({ title, meta, credit, camera, children, autoRotate = true, target = [0, 0, 0], frameloop = 'always', overlay }: {
  title: string; meta?: ReactNode; credit: ReactNode; camera: [number, number, number]; children: ReactNode; autoRotate?: boolean;
  target?: [number, number, number]; frameloop?: 'always' | 'demand'; overlay?: ReactNode;
}) {
  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} frameloop={frameloop} camera={{ position: camera, fov: 38, near: 0.01, far: 500 }} gl={{ antialias: true }}>
        <color attach="background" args={['#07090d']} />
        <hemisphereLight args={['#f4efe6', '#0b0e14', 0.65]} />
        <directionalLight position={[-6, 8, 4]} intensity={1.7} color="#fff6ea" />
        {children}
        <OrbitControls makeDefault enableDamping autoRotate={autoRotate} autoRotateSpeed={0.35} target={target} />
      </Canvas>
      <div className="terrain-hud terrain-hud-top"><span>{title}</span>{meta && <span>{meta}</span>}</div>
      {overlay}
      <div className="terrain-credit">{credit}</div>
    </div>
  );
}

/** Small DOM control strip layered over a scene (sliders, buttons). */
export const SceneControls = ({ children }: { children: ReactNode }) => <div className="terrain-controls scene-controls">{children}</div>;
