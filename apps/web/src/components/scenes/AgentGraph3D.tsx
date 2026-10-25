'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { agentStreamUrl } from '@/lib/api';
import { LabelLayer, LabelProjector, type ScreenLabel } from './TerrainView3D';
import { SceneControls, SceneShell } from './sceneKit';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SAMPLES = ['When is sunset at Jezero and is it dust season?', 'Can astronauts walk from landing to sol 400?', 'How many Ingenuity flights were there?', 'Which sample tubes are in the depot?'];

function Node({ position, lit }: { position: [number, number, number]; lit: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) { const s = 1 + Math.max(0, lit) * 0.8; ref.current.scale.lerp(new THREE.Vector3(s, s, s), 0.15); } });
  return <mesh ref={ref} position={position}><sphereGeometry args={[0.07, 20, 20]} /><meshStandardMaterial color={lit > 0 ? '#fde725' : '#5a6270'} emissive={lit > 0 ? '#6b5a00' : '#000000'} /></mesh>;
}

/** The mission agent's tools on a sphere around the planner; a live run lights each tool as the agent calls it. */
export default function AgentGraph3D() {
  const [tools, setTools] = useState<Array<{ name: string }>>([]);
  const [lit, setLit] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('Pick a question to watch the agent route it.');
  useEffect(() => { fetch(`${API}/agent/tools`).then((r) => r.json()).then((d: { tools: Array<{ name: string }> }) => setTools(d.tools)).catch(() => setStatus('Agent API unreachable.')); }, []);
  const layout = useMemo(() => tools.map((t, i) => {
    const y = 1 - (2 * (i + 0.5)) / tools.length, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    return { name: t.name, p: [Math.cos(a) * r * 1.8, y * 1.8, Math.sin(a) * r * 1.8] as [number, number, number] };
  }), [tools]);
  const nodes = useRef(new Map<string, HTMLSpanElement>());
  const labels = useMemo<ScreenLabel[]>(() => layout.map(({ name, p }) => ({ key: name, text: name, tone: (lit[name] ?? 0) > 0 ? '#fde725' : '#7d828c', at: () => [p[0], p[1] + 0.12, p[2]] })), [layout, lit]);
  const run = (goal: string) => {
    setLit({}); setStatus(`Running: ${goal}`);
    const es = new EventSource(agentStreamUrl(goal, false, 'fast'));
    const t0 = performance.now();
    es.addEventListener('step', (e) => { const s = JSON.parse((e as MessageEvent).data) as { tool?: string; kind: string }; if (s.tool) setLit((l) => ({ ...l, [s.tool!]: (l[s.tool!] ?? 0) + 1 })); });
    es.addEventListener('done', () => { es.close(); setStatus(`Done in ${Math.round(performance.now() - t0)} ms · lit tools ran for this goal`); });
    es.onerror = () => { es.close(); setStatus('Run failed: agent unreachable.'); };
  };
  return (
    <SceneShell title="MISSION AGENT · TOOL GRAPH" meta={`${tools.length} TOOLS · ${Object.keys(lit).length} USED`} camera={[0, 0.8, 5]}
      credit={<>NODES FROM /AGENT/TOOLS · LINES = PLANNER → TOOL CALLS IN THIS RUN · NUMBERS IN ANSWERS ARE CHECKED AGAINST THESE TOOL OUTPUTS</>}
      overlay={<><LabelLayer labels={labels} nodes={nodes} /><SceneControls>{SAMPLES.map((q) => <button key={q} onClick={() => run(q)}>{q.toUpperCase()}</button>)}<small role="status">{status}</small></SceneControls></>}>
      <mesh><icosahedronGeometry args={[0.28, 1]} /><meshStandardMaterial color="#C45C26" wireframe /></mesh>
      {layout.map(({ name, p }) => <group key={name}>
        <Node position={p} lit={lit[name] ?? 0} />
        {(lit[name] ?? 0) > 0 && <Line points={[[0, 0, 0], p]} color="#fde725" lineWidth={2} />}
      </group>)}
      <LabelProjector labels={labels} nodes={nodes} />
    </SceneShell>
  );
}
