'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { MarsHardware } from '@mars-explorer/shared';
import { SceneControls, SceneShell } from './sceneKit';

const R = 1.4;
// Same UV convention as the landing-site globe: u = 0.5 at 0° E on the Viking mosaic.
const pos = (lat: number, lon: number, r = R): [number, number, number] => { const a = (lat * Math.PI) / 180, p = (lon * Math.PI) / 180 + Math.PI; return [-r * Math.cos(a) * Math.cos(p), r * Math.sin(a), r * Math.cos(a) * Math.sin(p)]; };

function Marker({ h, year }: { h: MarsHardware; year: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const landed = Number(h.landed.slice(0, 4)), silentYear = h.lastContact ? Number(h.lastContact.slice(0, 4)) : Infinity;
  const state = year < landed ? 'future' : year > silentYear ? 'silent' : 'active';
  useFrame(({ clock }) => { if (ref.current && state === 'active') ref.current.scale.setScalar(1 + 0.4 * Math.sin(clock.elapsedTime * 3)); });
  if (state === 'future') return null;
  return <group position={pos(h.lat, h.lon)}>
    <mesh ref={ref}><sphereGeometry args={[state === 'active' ? 0.045 : 0.03, 16, 16]} /><meshBasicMaterial color={state === 'active' ? '#6FCF97' : '#8a8f99'} /></mesh>
  </group>;
}

function Globe({ items, year }: { items: MarsHardware[]; year: number }) {
  const tex = useTexture('/textures/mars-nasa.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  return <group rotation={[0.2, -1.2, 0]}>
    <mesh><sphereGeometry args={[R, 64, 64]} /><meshStandardMaterial map={tex} roughness={0.95} /></mesh>
    {items.map((h) => <Marker key={h.id} h={h} year={year} />)}
  </group>;
}

/** Every NASA spacecraft on Mars on the Viking mosaic; scrub the year to watch landers arrive and fall silent. */
export default function HardwareGlobe3D({ items }: { items: MarsHardware[] }) {
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const active = useMemo(() => items.filter((h) => Number(h.landed.slice(0, 4)) <= year && (!h.lastContact || Number(h.lastContact.slice(0, 4)) >= year)), [items, year]);
  return (
    <SceneShell title={`LEFT ON MARS · ${year}`} meta={`${active.length} ACTIVE · ${items.filter((h) => Number(h.landed.slice(0, 4)) <= year).length - active.length} SILENT`} camera={[0, 0.6, 4.4]}
      credit={<>POSITIONS: NSSDCA LANDING SITES (ROVERS SHOWN AT LANDING) · PERSEVERANCE FROM PDS PLACES · TEXTURE NASA/JPL VIKING MOSAIC · <a href="https://science.nasa.gov/mars/" target="_blank" rel="noreferrer">NASA MISSION PAGES ↗</a></>}
      overlay={<SceneControls><label>YEAR {year}<input type="range" min={1976} max={new Date().getUTCFullYear()} value={year} onChange={(e) => setYear(Number(e.target.value))} /></label></SceneControls>}>
      <Globe items={items} year={year} />
    </SceneShell>
  );
}
