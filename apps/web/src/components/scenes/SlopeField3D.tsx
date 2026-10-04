'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DtmGrid } from '@mars-explorer/shared';
import { buildModel, type Model } from './TerrainView3D';

const EXAGGERATION = 3, SLOPE_CAP = 15;
const TONES: Array<[number, THREE.Color]> = [[0, new THREE.Color('#1e232c')], [5, new THREE.Color('#5d636d')], [10, new THREE.Color('#c9c7c1')], [SLOPE_CAP, new THREE.Color('#C45C26')], [25, new THREE.Color('#ff7a3d')]];
function slopeColor(s: number) {
  for (let i = 1; i < TONES.length; i++) if (s <= TONES[i][0]) return TONES[i - 1][1].clone().lerp(TONES[i][1], (s - TONES[i - 1][0]) / (TONES[i][0] - TONES[i - 1][0]));
  return TONES.at(-1)![1].clone();
}

/** Grid slope (deg) by central differences, matching the API's ~118 m sampling scale. */
function slopes(m: Model) {
  const out: number[] = [];
  for (let r = 0; r < m.R; r++) for (let c = 0; c < m.C; c++) {
    const gx = (m.cell(r, c + 1) - m.cell(r, c - 1)) / ((c > 0 && c < m.C - 1 ? 2 : 1) * m.dx * 1000);
    const gy = (m.cell(r + 1, c) - m.cell(r - 1, c)) / ((r > 0 && r < m.R - 1 ? 2 : 1) * m.dy * 1000);
    out.push((Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI);
  }
  return out;
}

function Field({ m, slope }: { m: Model; slope: number[] }) {
  const scan = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(m.W, m.D, m.C - 1, m.R - 1);
    const pos = g.attributes.position, colors: number[] = [];
    for (let k = 0; k < pos.count; k++) {
      const r = m.R - 1 - Math.floor(k / m.C), c = k % m.C;
      pos.setZ(k, ((m.cell(r, c) - m.minElev) / 1000) * EXAGGERATION);
      const col = slopeColor(slope[r * m.C + c]);
      colors.push(col.r, col.g, col.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [m, slope]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => { if (scan.current) scan.current.position.x = Math.sin(clock.elapsedTime * 0.5) * (m.W / 2); });
  const relief = ((m.maxElev - m.minElev) / 1000) * EXAGGERATION;
  return (
    <>
      <mesh geometry={geometry}><meshStandardMaterial vertexColors roughness={0.9} /></mesh>
      <mesh geometry={geometry} position={[0, 0.004, 0]}><meshBasicMaterial color="#0b0e14" wireframe transparent opacity={0.22} /></mesh>
      <mesh ref={scan} position={[0, relief / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[m.D * 1.04, relief + 0.4]} />
        <meshBasicMaterial color="#C45C26" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  );
}

/** Measured slope heat-field from the PLACES DEM, with the Risk Index saturation angle in orange. */
export default function SlopeField3D({ grid }: { grid: DtmGrid }) {
  const m = useMemo(() => buildModel(grid), [grid]);
  const slope = useMemo(() => slopes(m), [m]);
  const steep = slope.filter((s) => s >= SLOPE_CAP).length / slope.length;
  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} camera={{ position: [-m.W * 0.45, m.W * 0.55, m.W * 0.7], fov: 38 }}>
        <color attach="background" args={['#07090d']} />
        <hemisphereLight args={['#f4efe6', '#0b0e14', 0.75]} />
        <directionalLight position={[m.W, m.W, m.D]} intensity={1.2} />
        <Field m={m} slope={slope} />
        <OrbitControls makeDefault enableDamping autoRotate autoRotateSpeed={-0.3} maxPolarAngle={Math.PI / 2.2} />
      </Canvas>
      <div className="terrain-hud terrain-hud-top">
        <span>SLOPE FIELD · PLACES DEM</span>
        <span>PEAK {Math.max(...slope).toFixed(1)}° · {(steep * 100).toFixed(1)}% OF CELLS ≥{SLOPE_CAP}°</span>
      </div>
      <div className="slope-legend" aria-hidden>
        <span><i style={{ background: '#1e232c' }} />0°</span><span><i style={{ background: '#5d636d' }} />5°</span><span><i style={{ background: '#c9c7c1' }} />10°</span><span><i style={{ background: '#C45C26' }} />≥{SLOPE_CAP}° RISK TERM SATURATES</span>
      </div>
      <div className="terrain-credit">SLOPE DERIVED FROM <a href={grid.labelUrl} target="_blank" rel="noreferrer">MARS 2020 PLACES ORBITAL DEM ↗</a> AT ~118 M · CANNOT RESOLVE ROCKS OR LOCAL HAZARDS · NON-CERTIFYING</div>
    </div>
  );
}
