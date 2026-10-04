'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

const MARS = '#C45C26', EARTH = '#3D9EBD', NEUTRAL = '#d9d7d0';

type Node = { id: string; label: string; sub: string; tier: 0 | 1 | 2; row: number; tone?: string };
/** The real system: NASA sources → Nest modules (apps/api/src/*) → web surfaces. */
const NODES: Node[] = [
  { id: 'trek', label: 'NASA MARS TREK', sub: 'WMTS · HIRISE / CTX', tier: 0, row: 0, tone: MARS },
  { id: 'places', label: 'PDS PLACES', sub: 'best_interp.csv', tier: 0, row: 1, tone: MARS },
  { id: 'dem', label: 'PDS ORBITAL DEM', sub: 'm20_orbital_dem', tier: 0, row: 2, tone: MARS },
  { id: 'corpus', label: 'MISSION CORPUS', sub: 'cited NASA notes', tier: 0, row: 3 },
  { id: 'eonet', label: 'NASA EONET V3', sub: 'EARTH ONLY', tier: 0, row: 4, tone: EARTH },
  { id: 'm-layers', label: 'layers', sub: 'nest module', tier: 1, row: 0 },
  { id: 'm-places', label: 'places', sub: 'nest module', tier: 1, row: 1 },
  { id: 'm-routes', label: 'routes · dtm', sub: 'risk index · A*', tier: 1, row: 2 },
  { id: 'm-rag', label: 'rag · agent', sub: 'retrieve · cite', tier: 1, row: 3 },
  { id: 'm-eonet', label: 'eonet', sub: 'cache · provenance', tier: 1, row: 4, tone: EARTH },
  { id: 'm-brief', label: 'briefings', sub: 'markdown · pdf', tier: 1, row: 5 },
  { id: 'w-explore', label: 'EXPLORE CONSOLE', sub: 'map · 3D · profile', tier: 2, row: 1 },
  { id: 'w-brief', label: 'BRIEFING PDF', sub: 'server render', tier: 2, row: 3 },
  { id: 'w-earth', label: 'EARTH FEED', sub: 'separate map', tier: 2, row: 4, tone: EARTH },
];
const EDGES: Array<[string, string]> = [
  ['trek', 'm-layers'], ['places', 'm-places'], ['dem', 'm-routes'], ['corpus', 'm-rag'], ['eonet', 'm-eonet'],
  ['m-layers', 'w-explore'], ['m-places', 'w-explore'], ['m-routes', 'w-explore'], ['m-rag', 'w-explore'],
  ['m-routes', 'm-brief'], ['m-rag', 'm-brief'], ['m-brief', 'w-brief'],
  ['m-eonet', 'w-earth'], ['m-eonet', 'm-rag'],
];
const W = 0.92, H = 0.26, COL = 1.55, ROW = 0.36;
const pos = (n: Node) => new THREE.Vector3((n.tier - 1) * COL, (2.5 - n.row) * ROW, 0);

function labelTexture(title: string, sub: string, tone: string) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 144;
  const g = c.getContext('2d')!;
  g.fillStyle = '#10141c'; g.fillRect(0, 0, 512, 144);
  g.fillStyle = tone; g.fillRect(0, 0, 8, 144);
  g.fillStyle = '#f2f0ea'; g.font = '500 44px "DM Mono", ui-monospace, monospace'; g.fillText(title, 30, 64);
  g.fillStyle = '#8b909a'; g.font = '400 30px "DM Mono", ui-monospace, monospace'; g.fillText(sub.toUpperCase(), 30, 112);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Block({ node }: { node: Node }) {
  const tone = node.tone ?? NEUTRAL;
  const texture = useMemo(() => labelTexture(node.label, node.sub, tone), [node, tone]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={pos(node)}>
      <mesh><boxGeometry args={[W, H, 0.06]} /><meshStandardMaterial color="#141922" roughness={0.6} metalness={0.3} /></mesh>
      <mesh position={[0, 0, 0.031]}><planeGeometry args={[W, H]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
      <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(W, H, 0.06)]} /><lineBasicMaterial color={tone} transparent opacity={0.55} /></lineSegments>
    </group>
  );
}

/** Animated architecture: packets travel each real dependency edge, Earth traffic in blue on its own lane. */
export default function PipelineScene() {
  const group = useRef<THREE.Group>(null);
  const packets = useRef<THREE.Mesh[]>([]);
  const curves = useMemo(() => EDGES.map(([a, b]) => {
    const A = NODES.find((n) => n.id === a)!, B = NODES.find((n) => n.id === b)!;
    const start = pos(A).add(new THREE.Vector3(A.tier === B.tier ? 0 : W / 2, A.tier === B.tier ? -H / 2 : 0, 0));
    const end = pos(B).add(new THREE.Vector3(A.tier === B.tier ? 0 : -W / 2, A.tier === B.tier ? H / 2 : 0, 0));
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0, 0.35));
    const tone = A.tone === EARTH || B.tone === EARTH ? EARTH : A.tone === MARS ? MARS : NEUTRAL;
    return { curve: new THREE.QuadraticBezierCurve3(start, mid, end), tone };
  }), []);
  const lines = useMemo(() => curves.map((c) => c.curve.getPoints(32)), [curves]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (group.current) { group.current.rotation.y = Math.sin(t * 0.18) * 0.32; group.current.rotation.x = -0.08 + Math.sin(t * 0.13) * 0.05; }
    packets.current.forEach((p, i) => { if (p) p.position.copy(curves[i % curves.length].curve.getPointAt(((t * 0.28) + i * 0.137) % 1)); });
  });
  return (
    <>
      <color attach="background" args={['#0B0E14']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 4]} intensity={1.6} />
      <group ref={group} scale={1.08} position={[0, -0.05, 0]}>
        {NODES.map((n) => <Block key={n.id} node={n} />)}
        {lines.map((points, i) => <Line key={i} points={points} color={curves[i].tone} lineWidth={1.1} transparent opacity={0.45} />)}
        {[...curves, ...curves].map((c, i) => (
          <mesh key={i} ref={(m) => { if (m) packets.current[i] = m; }}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshBasicMaterial color={c.tone} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}
