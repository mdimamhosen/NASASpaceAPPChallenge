'use client';

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { heliocentricAu, MARS_SEASON_MARKS, marsTime } from '@mars-explorer/shared';
import { SceneShell } from './sceneKit';

// Ls is measured from the northern spring equinox; true anomaly = Ls − 251° (perihelion), so r follows heliocentricAu(Ls).
const xz = (ls: number, k = 2.2): [number, number, number] => { const a = (ls * Math.PI) / 180, r = heliocentricAu(ls) * k; return [r * Math.cos(a), 0, -r * Math.sin(a)]; };

/** The Martian year as an orbit ring by solar longitude: equinoxes, solstices, perihelion, dust-storm season and Mars now. */
export default function SeasonRing3D() {
  const t = marsTime(new Date());
  const ring = useMemo(() => Array.from({ length: 361 }, (_, i) => xz(i)), []);
  const dust = useMemo(() => Array.from({ length: 151 }, (_, i) => { const p = xz(180 + i); return [p[0], 0.02, p[2]] as [number, number, number]; }), []);
  return (
    <SceneShell title="THE MARTIAN YEAR · SOLAR LONGITUDE" meta={`MARS NOW Ls ${t.ls.toFixed(1)}° · ${t.ls >= 180 && t.ls < 330 ? 'DUST-STORM SEASON' : 'OUTSIDE DUST SEASON'}`} camera={[0, 7.5, 7]}
      credit={<>ORBIT: a = 1.524 AU, e = 0.0934, PERIHELION Ls 251° (ALLISON &amp; MCEWEN 2000) · ORANGE ARC = Ls 180–330 DUST SEASON (CLIMATOLOGY, NOT A FORECAST)</>}>
      <mesh><sphereGeometry args={[0.28, 32, 32]} /><meshBasicMaterial color="#F4C542" /></mesh>
      <Line points={ring} color="#5a6270" lineWidth={1.5} />
      <Line points={dust} color="#C45C26" lineWidth={6} transparent opacity={0.8} />
      {MARS_SEASON_MARKS.map((s) => <mesh key={s.ls} position={xz(s.ls)}><sphereGeometry args={[0.05, 12, 12]} /><meshBasicMaterial color="#e8dcc8" /></mesh>)}
      <mesh position={xz(t.ls)}><sphereGeometry args={[0.15, 32, 32]} /><meshStandardMaterial color="#C45C26" emissive="#4a220f" /></mesh>
    </SceneShell>
  );
}
