'use client';

import { useState } from 'react';
import * as THREE from 'three';
import { SceneShell } from './sceneKit';

export type SampleTube = { number: number; name: string; type: string; sol: number | null; rockType: string | null; height: string | null; location: string; feature: string | null; date: string | null };
const TONE: Array<[RegExp, string]> = [[/igneous/i, '#C45C26'], [/sediment/i, '#e2c9a6'], [/carbonate|serpent|silica/i, '#5ec962'], [/regolith|grains/i, '#9a7b5f']];
const tone = (t: SampleTube) => (t.type === 'Atmospheric' ? '#7fd3ff' : t.type === 'Witness' ? '#888' : TONE.find(([r]) => r.test(t.rockType ?? ''))?.[1] ?? '#c9c7c1');
const cm = (h: string | null) => { const m = /([\d.]+)\s*(?:-\s*[\d.]+)?\s*cm/.exec(h ?? ''); return m ? Number(m[1]) : null; };

/** Perseverance's sample tubes: Three Forks depot row vs tubes still on the rover; tube fill height = core length. */
export default function SampleDepot3D({ tubes, source }: { tubes: SampleTube[]; source: string }) {
  const [pick, setPick] = useState<SampleTube | null>(null);
  const depot = tubes.filter((t) => /depot/i.test(t.location)), rover = tubes.filter((t) => !/depot/i.test(t.location));
  const place = (list: SampleTube[], z: number) => list.map((t, i) => ({ t, x: (i - (list.length - 1) / 2) * 0.32, z }));
  const all = [...place(depot, 0.8), ...place(rover, -0.8)];
  return (
    <SceneShell title="SAMPLE TUBES · THREE FORKS DEPOT vs ROVER" meta={`${depot.length} IN DEPOT · ${rover.length} ON ROVER · CLICK A TUBE`} camera={[0, 2.6, 4.6]} autoRotate={!pick}
      credit={<>RECORDS: <a href={source} target="_blank" rel="noreferrer">NASA MARS 2020 ROCK SAMPLES ↗</a> · FILL = CORE HEIGHT WHERE PUBLISHED · COLOUR = ROCK TYPE</>}
      overlay={pick && <div className="scene-legend scene-pick"><strong>#{pick.number} {pick.name}</strong><span>{pick.type} · {pick.rockType ?? 'rock type not published'}</span><span>SOL {pick.sol ?? 'TBD'} · {pick.date ?? ''}</span><span>{pick.height ?? 'height not published'} · {pick.location}</span></div>}>
      <mesh position={[0, -0.02, 0.8]}><boxGeometry args={[Math.max(1, depot.length * 0.32 + 0.3), 0.04, 0.5]} /><meshStandardMaterial color="#3a2f28" /></mesh>
      <mesh position={[0, -0.02, -0.8]}><boxGeometry args={[Math.max(1, rover.length * 0.32 + 0.3), 0.04, 0.5]} /><meshStandardMaterial color="#2a303c" /></mesh>
      {all.map(({ t, x, z }) => {
        const h = cm(t.height), fill = h == null ? 0.05 : Math.min(1, h / 8);
        return <group key={t.number} position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); setPick(t); }}>
          <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.07, 0.07, 1, 20, 1, true]} /><meshStandardMaterial color="#d8d6d0" transparent opacity={pick?.number === t.number ? 0.55 : 0.25} side={THREE.DoubleSide} metalness={0.6} /></mesh>
          <mesh position={[0, fill / 2, 0]}><cylinderGeometry args={[0.055, 0.055, fill, 20]} /><meshStandardMaterial color={tone(t)} /></mesh>
        </group>;
      })}
    </SceneShell>
  );
}
