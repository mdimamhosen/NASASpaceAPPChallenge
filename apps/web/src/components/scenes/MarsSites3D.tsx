'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { LabelLayer, LabelProjector, type ScreenLabel } from './TerrainView3D';

/** Approximate published landing coordinates (planetocentric, east longitude) from NASA NSSDCA mission records. */
export const NASA_MARS_LANDINGS = [
  { year: 1976, name: 'VIKING 1', place: 'Chryse Planitia', lat: 22.27, lon: -47.95 },
  { year: 1976, name: 'VIKING 2', place: 'Utopia Planitia', lat: 47.64, lon: 134.29 },
  { year: 1997, name: 'MARS PATHFINDER', place: 'Ares Vallis', lat: 19.13, lon: -33.22 },
  { year: 2004, name: 'SPIRIT', place: 'Gusev Crater', lat: -14.57, lon: 175.47 },
  { year: 2004, name: 'OPPORTUNITY', place: 'Meridiani Planum', lat: -1.95, lon: -5.53 },
  { year: 2008, name: 'PHOENIX', place: 'Vastitas Borealis', lat: 68.22, lon: -125.75 },
  { year: 2012, name: 'CURIOSITY', place: 'Gale Crater', lat: -4.59, lon: 137.44 },
  { year: 2018, name: 'INSIGHT', place: 'Elysium Planitia', lat: 4.5, lon: 135.62 },
  { year: 2021, name: 'PERSEVERANCE', place: 'Jezero Crater', lat: 18.4446, lon: 77.4509 }, // PLACES sol 0
] as const;
const NSSDCA = 'https://nssdc.gsfc.nasa.gov/planetary/planets/marspage.html';
const R = 1.5, DWELL_S = 3.6;

/** Same mapping as three.js SphereGeometry UVs for an equirectangular map spanning −180°…180° E. */
function onSphere(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = ((lon + 180) / 360) * Math.PI * 2, theta = ((90 - lat) * Math.PI) / 180;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}

function Globe({ active, setActive, anchor }: { active: number; setActive: (i: number) => void; anchor: React.MutableRefObject<THREE.Vector3> }) {
  const map = useTexture('/textures/mars-nasa.jpg');
  const spin = useRef<THREE.Group>(null);
  const pins = useRef<THREE.Group[]>([]);
  const clock = useRef(0);
  const sites = useMemo(() => NASA_MARS_LANDINGS.map((s) => ({ ...s, at: onSphere(s.lat, s.lon), normal: onSphere(s.lat, s.lon, 1) })), []);
  useFrame((_, delta) => {
    clock.current += delta;
    if (clock.current > DWELL_S) { clock.current = 0; setActive((active + 1) % sites.length); }
    const g = spin.current;
    if (!g) return;
    // Turn the active site toward the camera (+z); shortest-path ease on the yaw angle.
    const p = sites[active].at;
    const target = Math.atan2(-p.x, p.z);
    let diff = target - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, delta * 2.2);
    g.rotation.x += ((sites[active].lat * Math.PI) / 360 - g.rotation.x) * Math.min(1, delta * 2.2);
    pins.current[active]?.getWorldPosition(anchor.current);
    pins.current.forEach((pin, i) => { const s = i === active ? 1.6 + 0.25 * Math.sin(clock.current * 6) : 1; pin?.scale.setScalar(s); });
  });
  return (
    <group ref={spin}>
      <mesh><sphereGeometry args={[R, 96, 96]} /><meshStandardMaterial map={map} roughness={1} /></mesh>
      <mesh scale={1.035}><sphereGeometry args={[R, 64, 64]} /><meshBasicMaterial color="#d98b5f" transparent opacity={0.07} side={THREE.BackSide} depthWrite={false} /></mesh>
      {sites.map((s, i) => (
        <group key={s.name} position={s.at} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.normal)} ref={(g) => { if (g) pins.current[i] = g; }}>
          <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.006, 0.006, 0.12, 6]} /><meshBasicMaterial color={i === active ? '#C45C26' : '#f2f0ea'} /></mesh>
          <mesh position={[0, 0.13, 0]}><sphereGeometry args={[0.022, 12, 12]} /><meshBasicMaterial color={i === active ? '#C45C26' : '#f2f0ea'} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** Mars globe on the NASA Viking texture, touring every successful NASA landing in chronological order. */
export default function MarsSites3D() {
  const [active, setActive] = useState(NASA_MARS_LANDINGS.length - 1);
  const anchor = useRef(new THREE.Vector3());
  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const site = NASA_MARS_LANDINGS[active];
  const labels = useMemo<ScreenLabel[]>(() => [{ key: 'site', text: `${site.year} · ${site.name}`, tone: '#C45C26', at: () => [anchor.current.x, anchor.current.y + 0.2, anchor.current.z] }], [site]);
  const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.4, 4.6], fov: 38 }}>
        <color attach="background" args={['#05070a']} />
        <Stars radius={60} depth={30} count={2500} factor={2.2} saturation={0} fade speed={0.3} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[-4, 2, 3]} intensity={2.2} color="#fff4e6" />
        <Globe active={active} setActive={setActive} anchor={anchor} />
        <LabelProjector labels={labels} nodes={nodes} />
        <OrbitControls makeDefault enableDamping enablePan={false} minDistance={2.6} maxDistance={8} />
      </Canvas>
      <LabelLayer labels={labels} nodes={nodes} />
      <div className="terrain-hud terrain-hud-top">
        <span>NASA MARS LANDINGS · {active + 1} / {NASA_MARS_LANDINGS.length}</span>
        <span>{site.place.toUpperCase()} · {fmt(site.lat, 'N', 'S')} {fmt(site.lon, 'E', 'W')}</span>
      </div>
      <div className="sites-strip" role="tablist" aria-label="NASA Mars landing sites">
        {NASA_MARS_LANDINGS.map((s, i) => <button key={s.name} role="tab" aria-selected={i === active} className={i === active ? 'active' : ''} onClick={() => setActive(i)}><small>{s.year}</small>{s.name}</button>)}
      </div>
      <div className="terrain-credit">
        COORDINATES: APPROXIMATE PUBLISHED LANDING SITES · <a href={NSSDCA} target="_blank" rel="noreferrer">NASA NSSDCA ↗</a> · PERSEVERANCE FROM PLACES SOL 0 · TEXTURE: <a href="https://science.nasa.gov/3d-resources/mars/" target="_blank" rel="noreferrer">NASA/JPL-CALTECH VIKING ↗</a>
      </div>
    </div>
  );
}
