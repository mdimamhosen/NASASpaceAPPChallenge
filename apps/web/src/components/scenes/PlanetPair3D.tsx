'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';

/** NASA Planetary Fact Sheet values. https://nssdc.gsfc.nasa.gov/planetary/factsheet/ */
const FACTSHEET = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/';
const PLANETS = {
  earth: { name: 'EARTH', radiusKm: 6371, tiltDeg: 23.44, dayH: 23.934, gravity: 9.81, texture: '/textures/earth-nasa-blue-marble.jpg', tone: '#3D9EBD' },
  mars: { name: 'MARS', radiusKm: 3389.5, tiltDeg: 25.19, dayH: 24.623, gravity: 3.71, texture: '/textures/mars-nasa.jpg', tone: '#C45C26' },
} as const;
const UNITS_PER_KM = 1.35 / 6371;
/** Display clock: one real second = one planetary hour, so the ~41-minute day-length gap is visible. */
const HOURS_PER_SECOND = 1;

function Body({ planet, x }: { planet: (typeof PLANETS)[keyof typeof PLANETS]; x: number }) {
  const map = useTexture(planet.texture);
  const spin = useRef<THREE.Mesh>(null);
  const r = planet.radiusKm * UNITS_PER_KM;
  useFrame((_, d) => { if (spin.current) spin.current.rotation.y += ((Math.PI * 2) / planet.dayH) * HOURS_PER_SECOND * d; });
  return (
    <group position={[x, 0, 0]} rotation={[0, 0, (-planet.tiltDeg * Math.PI) / 180]}>
      <mesh ref={spin}><sphereGeometry args={[r, 96, 96]} /><meshStandardMaterial map={map} roughness={1} /></mesh>
      <mesh><cylinderGeometry args={[0.004, 0.004, r * 2.7, 6]} /><meshBasicMaterial color={planet.tone} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r * 1.04, 0.003, 6, 128]} /><meshBasicMaterial color={planet.tone} transparent opacity={0.5} /></mesh>
    </group>
  );
}

/** Earth and Mars at true relative size, true axial tilt, and true sidereal rotation ratio. */
export default function PlanetPair3D() {
  const { earth, mars } = PLANETS;
  const rows: Array<[string, string, string]> = [
    ['MEAN RADIUS', `${earth.radiusKm.toLocaleString()} KM`, `${mars.radiusKm.toLocaleString()} KM`],
    ['AXIAL TILT', `${earth.tiltDeg}°`, `${mars.tiltDeg}°`],
    ['SIDEREAL DAY', '23 H 56 M', '24 H 37 M'],
    ['SURFACE GRAVITY', `${earth.gravity} M/S²`, `${mars.gravity} M/S²`],
  ];
  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.4, 6.4], fov: 36 }}>
        <color attach="background" args={['#05070a']} />
        <Stars radius={60} depth={30} count={2500} factor={2.2} saturation={0} fade speed={0.3} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[-6, 1.5, 3]} intensity={2.4} color="#fff4e6" />
        <Body planet={earth} x={-1.05} />
        <Body planet={mars} x={1.45} />
        <OrbitControls makeDefault enableDamping enablePan={false} autoRotate autoRotateSpeed={0.15} minDistance={3} maxDistance={10} />
      </Canvas>
      <div className="terrain-hud terrain-hud-top">
        <span>EARTH · MARS · TRUE RELATIVE SCALE</span>
        <span>1 S = 1 PLANETARY HOUR · TILT AXES SHOWN</span>
      </div>
      <table className="planet-facts">
        <thead><tr><th /><th style={{ color: earth.tone }}>EARTH</th><th style={{ color: mars.tone }}>MARS</th></tr></thead>
        <tbody>{rows.map(([k, a, b]) => <tr key={k}><th>{k}</th><td>{a}</td><td>{b}</td></tr>)}</tbody>
      </table>
      <div className="terrain-credit">
        VALUES: <a href={FACTSHEET} target="_blank" rel="noreferrer">NASA PLANETARY FACT SHEET ↗</a> · TEXTURES: NASA BLUE MARBLE · NASA/JPL-CALTECH VIKING · DISTANCE BETWEEN PLANETS NOT TO SCALE
      </div>
    </div>
  );
}
