'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DtmGrid, PlacesTrack, POI } from '@mars-explorer/shared';
import { buildModel, LabelLayer, LabelProjector, TREK_JEZERO_SOURCE, useTrekTexture, type Model, type ScreenLabel } from './TerrainView3D';

const EXAGGERATION = 1.5;

/**
 * The app's three real inputs for one tile, exploded vertically: PDS DEM (bottom), Trek imagery (middle),
 * PLACES localizations and verified locations (top). Layers breathe apart and re-register on a loop.
 */
export default function DataStack3D({ grid, track, pois = [] }: { grid: DtmGrid; track: PlacesTrack; pois?: POI[] }) {
  const m = useMemo(() => buildModel(grid), [grid]);
  const { texture } = useTrekTexture(m);
  const relief = ((m.maxElev - m.minElev) / 1000) * EXAGGERATION;
  const gap = useRef(relief + 0.8);
  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const corner = (level: number): [number, number, number] => [m.W / 2 + 0.15, level ? level * gap.current + 0.02 : relief * 0.4, m.D / 2];
  const labels = useMemo<ScreenLabel[]>(() => [
    { key: 'dem', text: '01 · PDS PLACES ORBITAL DEM · ELEVATION', tone: '#8b909a', at: () => corner(0) },
    { key: 'img', text: '02 · NASA TREK HIRISE / CTX · IMAGERY', tone: '#c9c7c1', at: () => corner(1) },
    { key: 'trk', text: '03 · PDS PLACES · ROVER LOCALIZATIONS', tone: '#f2f0ea', at: () => corner(2) },
  ], [m]);

  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} camera={{ position: [m.W * 0.85, m.W * 0.65, m.W * 1.1], fov: 36, near: 0.01, far: 200 }}>
        <color attach="background" args={['#07090d']} />
        <hemisphereLight args={['#f2efe8', '#1a1410', 0.7]} />
        <directionalLight position={[-m.W, m.W * 0.5, -m.D]} intensity={1.4} />
        <Stack m={m} texture={texture} track={track} pois={pois} gap={gap} relief={relief} />
        <LabelProjector labels={labels} nodes={nodes} />
        <OrbitControls makeDefault enableDamping autoRotate autoRotateSpeed={0.25} target={[0, relief + 0.9, 0]} maxPolarAngle={Math.PI / 2.05} minDistance={2} maxDistance={m.W * 3} />
      </Canvas>
      <LabelLayer labels={labels} nodes={nodes} />
      <div className="terrain-hud terrain-hud-top">
        <span>SOURCE STACK · ONE JEZERO TILE</span>
        <span>{m.W.toFixed(1)} × {m.D.toFixed(1)} KM · DEM ×{EXAGGERATION}</span>
      </div>
      <div className="terrain-hud terrain-hud-bottom"><span className="terrain-badge">EVERY LAYER IS A PUBLISHED NASA PRODUCT · NON-CERTIFYING</span></div>
      <div className="terrain-credit">
        <a href={grid.labelUrl} target="_blank" rel="noreferrer">PLACES DEM ↗</a> · <a href={TREK_JEZERO_SOURCE} target="_blank" rel="noreferrer">NASA MARS TREK HIRISE + CTX ↗</a> · <a href={track.sourceUrl} target="_blank" rel="noreferrer">PLACES BEST_INTERP ↗</a>
      </div>
    </div>
  );
}

function Stack({ m, texture, track, pois, gap, relief }: { m: Model; texture: THREE.Texture | null; track: PlacesTrack; pois: POI[]; gap: React.MutableRefObject<number>; relief: number }) {
  const imagery = useRef<THREE.Group>(null);
  const places = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const dem = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(m.W, m.D, m.C - 1, m.R - 1);
    const pos = geometry.attributes.position, colors: number[] = [];
    const span = Math.max(1, m.maxElev - m.minElev);
    for (let k = 0; k < pos.count; k++) {
      const elev = m.cell(m.R - 1 - Math.floor(k / m.C), k % m.C);
      pos.setZ(k, ((elev - m.minElev) / 1000) * EXAGGERATION);
      const g = 0.12 + 0.8 * ((elev - m.minElev) / span); // hypsometric grayscale: low = dark, high = light
      colors.push(g, g, g * 0.97);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  }, [m]);
  useEffect(() => () => dem.dispose(), [dem]);
  const flat = (lat: number, lon: number): [number, number, number] => [((lon - m.lonMin) / (m.lonMax - m.lonMin) - 0.5) * m.W, 0.02, (0.5 - (lat - m.latMin) / (m.latMax - m.latMin)) * m.D];
  const trackLine = useMemo(() => track.points.filter(m.inside).map((p) => flat(p.lat, p.lon)), [track, m]);
  const dots = pois.filter((p) => m.inside(p) && p.sourceKind !== 'DEMO');

  useFrame((_, delta) => {
    clock.current += delta;
    // Ease between compact and exploded; the gap always clears the DEM relief so layers never interpenetrate.
    gap.current = relief + 0.12 + 1.3 * (0.5 - 0.5 * Math.cos(clock.current * 0.45));
    imagery.current?.position.setY(gap.current);
    places.current?.position.setY(gap.current * 2);
  });

  return (
    <>
      <mesh geometry={dem}><meshStandardMaterial vertexColors roughness={1} flatShading /></mesh>
      <group ref={imagery}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[m.W, m.D]} /><meshBasicMaterial map={texture} color={texture ? '#ffffff' : '#333'} transparent opacity={0.94} side={THREE.DoubleSide} /></mesh>
      </group>
      <group ref={places}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[m.W, m.D]} /><meshBasicMaterial color="#12161f" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <lineSegments position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}><edgesGeometry args={[new THREE.PlaneGeometry(m.W, m.D)]} /><lineBasicMaterial color="#5a606b" /></lineSegments>
        {trackLine.length > 1 && <Line points={trackLine} color="#f2f0ea" lineWidth={2.4} />}
        {dots.map((p) => <mesh key={p.id} position={flat(p.lat, p.lon)}><sphereGeometry args={[0.06, 14, 14]} /><meshBasicMaterial color="#C45C26" /></mesh>)}
      </group>
    </>
  );
}
