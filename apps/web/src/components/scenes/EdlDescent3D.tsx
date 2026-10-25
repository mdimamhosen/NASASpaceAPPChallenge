'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { entryProfile, MARS_FACT_SHEET_URL, peakDeceleration } from '@mars-explorer/shared';
import { SceneShell, viridis } from './sceneKit';

const INPUT = { entrySpeedMs: 5400, flightPathDeg: 15.5, ballisticKgM2: 120 }, TOP = 125_000, H = 4, LOOP = 14;
const yOf = (z: number) => (z / TOP) * H;

function Capsule({ profile, onStep }: { profile: ReturnType<typeof entryProfile>; onStep: (p: ReturnType<typeof entryProfile>[number]) => void }) {
  const capsule = useRef<THREE.Group>(null), last = useRef(-1);
  useFrame(({ clock }) => {
    const i = Math.min(profile.length - 1, Math.floor(((clock.elapsedTime % LOOP) / LOOP) * profile.length));
    if (capsule.current) capsule.current.position.y = yOf(profile[i].altitudeM);
    if (i !== last.current) { last.current = i; onStep(profile[i]); }
  });
  return <group ref={capsule}><mesh rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.16, 0.18, 24]} /><meshStandardMaterial color="#e8dcc8" metalness={0.3} /></mesh></group>;
}

/** Ballistic entry through Mars' exponential atmosphere: density shells, the capsule falling, and the analytic peak-g altitude. */
export default function EdlDescent3D() {
  const profile = useMemo(() => entryProfile(INPUT, 120), []);
  const peak = peakDeceleration(INPUT);
  const [readout, setReadout] = useState(profile[0]);
  const maxRho = profile.at(-1)!.densityKgM3;
  return (
    <SceneShell title={`ALT ${(readout.altitudeM / 1000).toFixed(0)} KM · ${Math.round(readout.speedMs)} M/S · ${(readout.decelMs2 / 9.80665).toFixed(1)} g`} meta={`BALLISTIC PEAK ${peak.earthG.toFixed(1)} g NEAR ${(peak.altitudeM / 1000).toFixed(0)} KM`} camera={[3.2, 2.4, 4]} target={[0, H / 2, 0]}
      credit={<>ρ(z) = 0.020·e^(−z/11.1 KM) · <a href={MARS_FACT_SHEET_URL} target="_blank" rel="noreferrer">NASA MARS FACT SHEET ↗</a> · ALLEN–EGGERS BALLISTIC MODEL, 5.4 KM/S AT 15.5° · REAL ENTRIES FLY LIFTING, GUIDED PATHS · NON-CERTIFYING</>}>
      {profile.filter((_, i) => i % 6 === 0).map((p) => <mesh key={p.altitudeM} position={[0, yOf(p.altitudeM), 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.6, 1.4, 48]} /><meshBasicMaterial color={viridis(Math.log10(p.densityKgM3 / 1e-7) / Math.log10(maxRho / 1e-7))} transparent opacity={0.22} side={THREE.DoubleSide} /></mesh>)}
      <mesh position={[0, yOf(peak.altitudeM), 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.42, 1.5, 64]} /><meshBasicMaterial color="#ff4d4d" side={THREE.DoubleSide} /></mesh>
      <Capsule profile={profile} onStep={setReadout} />
      <mesh position={[0, -0.02, 0]}><cylinderGeometry args={[1.6, 1.6, 0.04, 48]} /><meshStandardMaterial color="#5a3a2a" /></mesh>
    </SceneShell>
  );
}
