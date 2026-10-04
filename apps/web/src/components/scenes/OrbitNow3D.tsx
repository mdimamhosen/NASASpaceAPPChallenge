'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { earthMarsGeometry, JPL_APPROX_POS_URL, planetPosition } from '@/lib/orbits';
import { LabelLayer, LabelProjector, type ScreenLabel } from './TerrainView3D';

const S = 3; // scene units per AU
const LAUNCH = new Date('2020-07-30T11:50:00Z'); // Mars 2020 launch (NASA)
const LANDING = new Date('2021-02-18T20:55:00Z'); // Perseverance landing (NASA)
const DAY = 86_400_000;
/** Ecliptic (x, y, z) in AU → scene (x, up, -y). */
const scene = (p: [number, number, number]): [number, number, number] => [p[0] * S, p[2] * S, -p[1] * S];

function orbitPath(planet: 'earth' | 'mars', date: Date) {
  return Array.from({ length: 181 }, (_, i) => scene(planetPosition(planet, date, -180 + i * 2)));
}

function Planet({ texture, position, radius }: { texture: string; position: [number, number, number]; radius: number }) {
  const map = useTexture(texture);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (mesh.current) mesh.current.rotation.y += d * 0.6; });
  return <mesh ref={mesh} position={position}><sphereGeometry args={[radius, 48, 48]} /><meshStandardMaterial map={map} roughness={1} /></mesh>;
}

/**
 * Earth and Mars where JPL's approximate elements put them on the chosen date, with distance and
 * one-way light time. Ghost markers show Earth at Mars 2020 launch and Mars at Perseverance landing.
 */
export default function OrbitNow3D() {
  const [today] = useState(() => new Date());
  const [offsetDays, setOffsetDays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const minDays = Math.floor((LAUNCH.getTime() - today.getTime()) / DAY), maxDays = 2 * 365;
  const date = useMemo(() => new Date(today.getTime() + offsetDays * DAY), [today, offsetDays]);
  const geo = useMemo(() => earthMarsGeometry(date), [date]);
  const orbits = useMemo(() => ({ earth: orbitPath('earth', date), mars: orbitPath('mars', date) }), [date]);
  const ghosts = useMemo(() => ({ earth: scene(planetPosition('earth', LAUNCH)), mars: scene(planetPosition('mars', LANDING)) }), []);
  const e = scene(geo.earth), m = scene(geo.mars);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setOffsetDays((d) => (d >= maxDays ? minDays : d + 2)), 50);
    return () => window.clearInterval(id);
  }, [playing, minDays, maxDays]);

  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const pos = useRef({ e, m });
  pos.current = { e, m };
  const labels = useMemo<ScreenLabel[]>(() => [
    { key: 'earth', text: 'EARTH', tone: '#3D9EBD', at: () => [pos.current.e[0], pos.current.e[1] + 0.22, pos.current.e[2]] },
    { key: 'mars', text: 'MARS', tone: '#C45C26', at: () => [pos.current.m[0], pos.current.m[1] + 0.2, pos.current.m[2]] },
    { key: 'launch', text: 'EARTH AT LAUNCH · 2020-07-30', tone: '#5a606b', at: () => [ghosts.earth[0], ghosts.earth[1] + 0.12, ghosts.earth[2]] },
    { key: 'landing', text: 'MARS AT LANDING · 2021-02-18', tone: '#5a606b', at: () => [ghosts.mars[0], ghosts.mars[1] + 0.12, ghosts.mars[2]] },
  ], [ghosts]);

  const jump = (d: Date) => { setPlaying(false); setOffsetDays(Math.round((d.getTime() - today.getTime()) / DAY)); };

  return (
    <div className="terrain-3d is-showcase orbit-3d">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 8.2, 7.4], fov: 40 }}>
        <color attach="background" args={['#05070a']} />
        <Stars radius={60} depth={30} count={2500} factor={2.2} saturation={0} fade speed={0.3} />
        <ambientLight intensity={0.18} />
        <pointLight position={[0, 0, 0]} intensity={60} decay={1.6} color="#fff4e0" />
        <mesh><sphereGeometry args={[0.28, 48, 48]} /><meshBasicMaterial color="#ffd27a" /></mesh>
        <mesh scale={1.6}><sphereGeometry args={[0.28, 32, 32]} /><meshBasicMaterial color="#ffb347" transparent opacity={0.12} depthWrite={false} /></mesh>
        <Line points={orbits.earth} color="#3D9EBD" lineWidth={1.2} transparent opacity={0.6} />
        <Line points={orbits.mars} color="#C45C26" lineWidth={1.2} transparent opacity={0.6} />
        <Planet texture="/textures/earth-nasa-blue-marble.jpg" position={e} radius={0.13} />
        <Planet texture="/textures/mars-nasa.jpg" position={m} radius={0.1} />
        <Line points={[e, m]} color="#f2f0ea" lineWidth={1.4} dashed dashSize={0.12} gapSize={0.08} />
        <mesh position={ghosts.earth}><sphereGeometry args={[0.05, 16, 16]} /><meshBasicMaterial color="#3D9EBD" transparent opacity={0.45} /></mesh>
        <mesh position={ghosts.mars}><sphereGeometry args={[0.045, 16, 16]} /><meshBasicMaterial color="#C45C26" transparent opacity={0.45} /></mesh>
        <LabelProjector labels={labels} nodes={nodes} />
        <OrbitControls makeDefault enableDamping autoRotate={!playing} autoRotateSpeed={0.2} minDistance={3} maxDistance={18} />
      </Canvas>
      <LabelLayer labels={labels} nodes={nodes} />
      <div className="terrain-hud terrain-hud-top">
        <span>EARTH ↔ MARS · {date.toISOString().slice(0, 10)}</span>
        <span>{(geo.km / 1e6).toFixed(1)} M KM · {geo.au.toFixed(3)} AU · LIGHT {geo.lightMinutes.toFixed(1)} MIN ONE-WAY</span>
      </div>
      <div className="terrain-controls orbit-controls">
        <label>DATE {offsetDays === 0 ? '· TODAY' : `· ${offsetDays > 0 ? '+' : ''}${offsetDays} D`}<input type="range" min={minDays} max={maxDays} value={offsetDays} onChange={(ev) => { setPlaying(false); setOffsetDays(Number(ev.target.value)); }} /></label>
        <div className="orbit-buttons">
          <button onClick={() => jump(LAUNCH)}>LAUNCH</button>
          <button onClick={() => jump(LANDING)}>LANDING</button>
          <button onClick={() => jump(today)}>TODAY</button>
          <button onClick={() => setPlaying((p) => !p)}>{playing ? 'PAUSE' : 'PLAY'}</button>
        </div>
      </div>
      <div className="terrain-hud terrain-hud-bottom"><span className="terrain-badge">POSITIONS: JPL APPROXIMATE ELEMENTS · PLANET SIZES NOT TO SCALE · NOT A TRAJECTORY</span></div>
      <div className="terrain-credit">
        <a href={JPL_APPROX_POS_URL} target="_blank" rel="noreferrer">NASA JPL SSD · KEPLERIAN ELEMENTS ↗</a> · TEXTURES: NASA BLUE MARBLE · NASA/JPL-CALTECH VIKING · LAUNCH/LANDING DATES: <a href="https://science.nasa.gov/mission/mars-2020-perseverance/" target="_blank" rel="noreferrer">NASA MARS 2020 ↗</a>
      </div>
    </div>
  );
}
