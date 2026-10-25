'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import { daylightLtst, formatHours, MARS24_URL, marsTime, sunPosition } from '@mars-explorer/shared';
import { SceneShell } from './sceneKit';

const R = 3;
const toXYZ = (alt: number, az: number): [number, number, number] => {
  const a = (alt * Math.PI) / 180, z = (az * Math.PI) / 180;
  return [R * Math.cos(a) * Math.sin(z), R * Math.sin(a), -R * Math.cos(a) * Math.cos(z)];
};

/** Today's sun over Jezero from the Mars24 algorithm: path across the sky dome, sunrise, sunset and the sun now. */
export default function SunDome3D({ lat = 18.4447, lon = 77.4508 }: { lat?: number; lon?: number }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(id); }, []);
  const t = marsTime(now, lon);
  const day = daylightLtst(lat, t.declination);
  const path = useMemo(() => Array.from({ length: 97 }, (_, i) => sunPosition(lat, t.declination, (i / 96) * 24)).filter((p) => p.altitude > -2).map((p) => toXYZ(Math.max(0, p.altitude), p.azimuth)), [lat, t.declination]);
  const sun = sunPosition(lat, t.declination, t.ltst);
  const up = sun.altitude > 0;
  return (
    <SceneShell title="SKY OVER JEZERO · TODAY" meta={`LTST ${formatHours(t.ltst)} · SUN ALT ${sun.altitude.toFixed(1)}° AZ ${sun.azimuth.toFixed(0)}° · ${day ? `${formatHours(day.sunrise)}–${formatHours(day.sunset)}` : 'NO SUNRISE'}`} camera={[5.5, 3.2, 5.5]} target={[0, 0.8, 0]}
      credit={<>SUN PATH FROM <a href={MARS24_URL} target="_blank" rel="noreferrer">NASA GISS MARS24 ↗</a> · Ls {t.ls.toFixed(1)}° · DECLINATION {t.declination.toFixed(2)}° · N MARKED</>}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[R, 64]} /><meshStandardMaterial color="#3a2a22" roughness={1} /></mesh>
      <mesh><sphereGeometry args={[R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshBasicMaterial color={up ? '#c99a74' : '#1a2233'} transparent opacity={0.08} side={2} /></mesh>
      {path.length > 1 && <Line points={path} color="#F4C542" lineWidth={2} />}
      <mesh position={toXYZ(Math.max(sun.altitude, -10), sun.azimuth)}><sphereGeometry args={[0.16, 24, 24]} /><meshBasicMaterial color={up ? '#ffd27a' : '#55607a'} /></mesh>
      <mesh position={[0, 0.02, -R - 0.15]}><coneGeometry args={[0.1, 0.25, 12]} /><meshBasicMaterial color="#C45C26" /></mesh>
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[0.3, 0.3, 0.3]} /><meshStandardMaterial color="#d8d6d0" /></mesh>
    </SceneShell>
  );
}
