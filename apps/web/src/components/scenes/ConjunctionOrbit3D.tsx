'use client';

import { useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { conjunctionWindows, earthMarsGeometry, JPL_APPROX_POS_URL, planetPosition, solarElongationDeg } from '@mars-explorer/shared';
import { SceneControls, SceneShell } from './sceneKit';

const FROM = Date.UTC(2020, 6, 30), TO = Date.UTC(2031, 11, 31), DAY = 864e5, K = 1.6;
const v = (p: [number, number, number]): [number, number, number] => [p[0] * K, p[2] * K, -p[1] * K];

function Bodies({ t, playing, setT }: { t: number; playing: boolean; setT: (n: number) => void }) {
  useFrame((_, dt) => { if (playing) setT(t + dt * 40 * DAY > TO ? FROM : t + dt * 40 * DAY); });
  const d = new Date(t), e = v(planetPosition('earth', d)), m = v(planetPosition('mars', d));
  const blocked = solarElongationDeg(d) < 3;
  return <>
    <mesh position={e}><sphereGeometry args={[0.09, 24, 24]} /><meshStandardMaterial color="#3D9EBD" /></mesh>
    <mesh position={m}><sphereGeometry args={[0.07, 24, 24]} /><meshStandardMaterial color="#C45C26" /></mesh>
    <Line points={[e, m]} color={blocked ? '#ff4d4d' : '#6FCF97'} lineWidth={blocked ? 4 : 1.5} dashed={blocked} dashSize={0.1} gapSize={0.08} />
  </>;
}

/** Earth and Mars on JPL elements; the radio line turns red when the Sun sits within 3° of Mars (conjunction blackout). */
export default function ConjunctionOrbit3D() {
  const [t, setT] = useState(() => Date.now());
  const [playing, setPlaying] = useState(true);
  const orbits = useMemo(() => (['earth', 'mars'] as const).map((p) => Array.from({ length: 181 }, (_, i) => v(planetPosition(p, new Date(Date.UTC(2026, 0, 1) + i * (p === 'earth' ? 365.25 : 687) / 180 * DAY))))), []);
  const windows = useMemo(() => conjunctionWindows(new Date(FROM), new Date(TO)), []);
  const d = new Date(t), g = earthMarsGeometry(d), active = windows.find((w) => w.start <= d.toISOString().slice(0, 10) && w.end >= d.toISOString().slice(0, 10));
  return (
    <SceneShell title={`${d.toISOString().slice(0, 10)} · ${(g.km / 1e6).toFixed(0)} M KM · ${g.lightMinutes.toFixed(1)} MIN LIGHT`} meta={active ? `BLACKOUT ${active.start} → ${active.end}` : `SUN–EARTH–MARS ${solarElongationDeg(d).toFixed(1)}°`} camera={[0, 4.2, 4.2]} autoRotate={false}
      credit={<>POSITIONS: <a href={JPL_APPROX_POS_URL} target="_blank" rel="noreferrer">JPL APPROXIMATE KEPLERIAN ELEMENTS ↗</a> · {windows.length} BLACKOUT WINDOWS 2020–2031 · 3° THRESHOLD IS A HEURISTIC, NON-CERTIFYING</>}
      overlay={<SceneControls><label>DATE<input type="range" min={FROM} max={TO} step={DAY} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} /></label><button onClick={() => setPlaying((p) => !p)}>{playing ? 'PAUSE' : 'PLAY'}</button>{windows.slice(0, 6).map((w) => <button key={w.start} onClick={() => { setPlaying(false); setT(Date.parse(w.minDate)); }}>{w.minDate.slice(0, 7)}</button>)}</SceneControls>}>
      <mesh><sphereGeometry args={[0.22, 32, 32]} /><meshBasicMaterial color="#F4C542" /></mesh>
      {orbits.map((o, i) => <Line key={i} points={o} color={i ? '#7a4a33' : '#2d5d6e'} lineWidth={1} />)}
      <Bodies t={t} playing={playing} setT={setT} />
    </SceneShell>
  );
}
