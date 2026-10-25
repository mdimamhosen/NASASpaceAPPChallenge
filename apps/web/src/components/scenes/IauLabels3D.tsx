'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MarsFeature } from '@mars-explorer/shared';
import { getMarsFeatures } from '@/lib/api';
import { LabelLayer, LabelProjector, type ScreenLabel } from './TerrainView3D';
import { SceneShell } from './sceneKit';

const BOX = { south: 15.5, north: 21.5, west: 74.5, east: 80.5 }, K = 0.8, CX = 77.5, CY = 18.5;
const xz = (lat: number, lon: number): [number, number] => [(lon - CX) * K, -(lat - CY) * K];

/** IAU-adopted names around Jezero (USGS Gazetteer on data.nasa.gov): stem height and disc size follow feature diameter. */
export default function IauLabels3D() {
  const [features, setFeatures] = useState<MarsFeature[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getMarsFeatures(BOX, 7).then((f) => setFeatures(f.slice(0, 40))).catch((e: Error) => setError(e.message)); }, []);
  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const items = useMemo(() => (features ?? []).map((f) => { const [x, z] = xz(f.lat, f.lon); return { f, x, z, h: 0.15 + Math.min(1.6, Math.log10(1 + f.diameterKm) * 0.6) }; }), [features]);
  const labels = useMemo<ScreenLabel[]>(() => items.map(({ f, x, z, h }) => ({ key: f.id, text: `${f.name.toUpperCase()} · ${f.diameterKm.toFixed(0)} KM`, tone: f.name === 'Jezero' ? '#C45C26' : '#c9c7c1', at: () => [x, h + 0.05, z] })), [items]);
  if (error) return <div className="map-loading">IAU GAZETTEER UNAVAILABLE · {error}</div>;
  if (!features) return <div className="map-loading">LOADING IAU NAMES…</div>;
  return (
    <SceneShell title="NAMED FEATURES AROUND JEZERO" meta={`${features.length} IAU NAMES · ±3°`} camera={[0, 3.2, 4.4]}
      credit={<>NAMES: <a href="https://data.nasa.gov/dataset/gazetteer-of-planetary-nomenclature-mars-mola-global-images" target="_blank" rel="noreferrer">IAU/USGS GAZETTEER OF PLANETARY NOMENCLATURE ↗</a> · CENTRE POINTS, NOT BOUNDARIES</>}
      overlay={<LabelLayer labels={labels} nodes={nodes} />}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[(BOX.east - BOX.west) * K, (BOX.north - BOX.south) * K]} /><meshStandardMaterial color="#2e241e" /></mesh>
      <gridHelper args={[5, 10, '#3a3f49', '#22262e']} position={[0, 0.001, 0]} />
      {items.map(({ f, x, z, h }) => <group key={f.id} position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.006, 0.006, h, 6]} /><meshBasicMaterial color={f.name === 'Jezero' ? '#C45C26' : '#8a8f99'} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}><ringGeometry args={[Math.max(0.01, (f.diameterKm / 59.2) * K * 0.5 - 0.006), Math.max(0.016, (f.diameterKm / 59.2) * K * 0.5), 48]} /><meshBasicMaterial color={f.name === 'Jezero' ? '#C45C26' : '#e8dcc8'} transparent opacity={0.6} /></mesh>
      </group>)}
      <LabelProjector labels={labels} nodes={nodes} />
    </SceneShell>
  );
}
