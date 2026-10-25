'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Line } from '@react-three/drei';
import type { HiriseDtm } from '@mars-explorer/shared';
import { getHiriseDtms } from '@/lib/api';
import { LabelLayer, LabelProjector, type ScreenLabel } from './TerrainView3D';
import { SceneShell } from './sceneKit';

const BOX = { south: 17.4, north: 19.4, west: 76.4, east: 78.5 }, K = 2.4, CX = (BOX.west + BOX.east) / 2, CY = (BOX.south + BOX.north) / 2;
const xz = (lat: number, lon: number): [number, number] => [(lon - CX) * K, -(lat - CY) * K];

/** HiRISE DTMs around Jezero (PDS DTM index on data.nasa.gov) as translucent slabs, finer post spacing stacked higher. */
export default function HiriseSlabs3D() {
  const [dtms, setDtms] = useState<HiriseDtm[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getHiriseDtms(BOX).then(setDtms).catch((e: Error) => setError(e.message)); }, []);
  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const labels = useMemo<ScreenLabel[]>(() => [{ key: 'jez', text: 'PERSEVERANCE LANDING', tone: '#C45C26', at: () => { const [x, z] = xz(18.4447, 77.4508); return [x, 0.05, z]; } }], []);
  if (error) return <div className="map-loading">HIRISE DTM INDEX UNAVAILABLE · {error}</div>;
  if (!dtms) return <div className="map-loading">LOADING HIRISE DTM INDEX…</div>;
  return (
    <SceneShell title="HIRISE DTMs AROUND JEZERO" meta={`${dtms.length} FOOTPRINTS · ${dtms.filter((d) => d.scaleM <= 1).length} AT ≤1 M POSTS`} camera={[0, 3.6, 4.2]}
      credit={<>FOOTPRINTS: <a href="https://data.nasa.gov/dataset/mro-mars-high-resolution-imaging-science-experiment-dtm-v1-0" target="_blank" rel="noreferrer">MRO HIRISE DTM INDEX (DATA.NASA.GOV) ↗</a> · HEIGHT = FINER POST SPACING · THE APP DOES NOT SAMPLE THESE ELEVATIONS</>}
      overlay={<LabelLayer labels={labels} nodes={nodes} />}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[(BOX.east - BOX.west) * K, (BOX.north - BOX.south) * K]} /><meshStandardMaterial color="#2b2420" /></mesh>
      <gridHelper args={[5, 10, '#3a3f49', '#22262e']} position={[0, 0.001, 0]} />
      {dtms.map((d, i) => {
        const h = 0.15 + Math.max(0, 2 - d.scaleM) * 0.35 + (i % 4) * 0.04;
        const ring = [...d.corners, d.corners[0]].map(([lat, lon]) => { const [x, z] = xz(lat, lon); return [x, h, z] as [number, number, number]; });
        return <group key={d.id}><Line points={ring} color={d.scaleM <= 1 ? '#fde725' : '#5ec962'} lineWidth={1.6} /><Line points={ring.map(([x, , z]) => [x, 0.002, z] as [number, number, number])} color="#5a6270" lineWidth={0.8} /></group>;
      })}
      <mesh position={[xz(18.4447, 77.4508)[0], 0.05, xz(18.4447, 77.4508)[1]]}><sphereGeometry args={[0.04, 16, 16]} /><meshBasicMaterial color="#C45C26" /></mesh>
      <LabelProjector labels={labels} nodes={nodes} />
    </SceneShell>
  );
}
