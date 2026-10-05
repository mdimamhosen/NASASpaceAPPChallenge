'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { RagProjection } from '@mars-explorer/shared';

const SIZE = 2.6;

/** Stable per-document colour from a muted palette, with Mars orange reserved for hits and the query. */
export function docColor(docId: string) {
  let h = 0;
  for (const c of docId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return new THREE.Color().setHSL((h % 360) / 360, 0.28, 0.62);
}

function Cloud({ projection }: { projection: RagProjection }) {
  const group = useRef<THREE.Group>(null);
  const { positions, colors, hitPoints, query, scale } = useMemo(() => {
    const pts = projection.points;
    const all = [...pts, ...(projection.query ? [projection.query] : [])];
    const span = Math.max(1e-6, ...all.flatMap((p) => [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)]));
    const scale = SIZE / span;
    const hits = new Set(projection.hits);
    const positions = new Float32Array(pts.length * 3), colors = new Float32Array(pts.length * 3);
    const hitPoints: [number, number, number][] = [];
    pts.forEach((p, i) => {
      positions.set([p.x * scale, p.y * scale, p.z * scale], i * 3);
      const c = hits.has(p.chunkId) ? new THREE.Color('#C45C26') : docColor(p.docId);
      colors.set([c.r, c.g, c.b], i * 3);
      if (hits.has(p.chunkId)) hitPoints.push([p.x * scale, p.y * scale, p.z * scale]);
    });
    const query = projection.query ? ([projection.query.x * scale, projection.query.y * scale, projection.query.z * scale] as [number, number, number]) : null;
    return { positions, colors, hitPoints, query, scale };
  }, [projection]);
  useFrame((_, d) => { if (group.current) group.current.rotation.y += d * 0.08; });
  return (
    <group ref={group}>
      <points key={`${positions.length}-${scale}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.07} vertexColors sizeAttenuation transparent opacity={0.92} />
      </points>
      {hitPoints.map((p, i) => <mesh key={i} position={p}><sphereGeometry args={[0.06, 14, 14]} /><meshBasicMaterial color="#C45C26" /></mesh>)}
      {query && (
        <>
          <mesh position={query}><octahedronGeometry args={[0.13, 0]} /><meshBasicMaterial color="#f2f0ea" wireframe /></mesh>
          {hitPoints.map((p, i) => <Line key={i} points={[query, p]} color="#C45C26" lineWidth={1.2} transparent opacity={0.7} />)}
        </>
      )}
      <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(SIZE * 2, SIZE * 2, SIZE * 2)]} /><lineBasicMaterial color="#1c2029" /></lineSegments>
    </group>
  );
}

/** PCA projection of the corpus embeddings: similarity space, not geography. */
export default function EmbeddingSpace3D({ projection }: { projection: RagProjection | null }) {
  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of projection?.points ?? []) if (!seen.has(p.docId)) seen.set(p.docId, p.title);
    return [...seen].slice(0, 12);
  }, [projection]);
  return (
    <div className="terrain-3d is-showcase embedding-3d">
      {projection?.points.length ? (
        <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 7.2], fov: 42 }}>
          <color attach="background" args={['#07090d']} />
          <Cloud projection={projection} />
          <OrbitControls makeDefault enableDamping enablePan={false} minDistance={3} maxDistance={14} />
        </Canvas>
      ) : <div className="map-loading">{projection ? 'EMBEDDINGS UNAVAILABLE · BM25 MODE' : 'LOADING EMBEDDING SPACE…'}</div>}
      <div className="terrain-hud terrain-hud-top">
        <span>EMBEDDING SPACE · {projection?.points.length ?? 0} CHUNKS</span>
        <span>{projection?.query ? `◇ QUERY → ${projection.hits.length} NEAREST PASSAGES` : 'ASK A QUESTION TO PROJECT IT'}</span>
      </div>
      <div className="embedding-legend" aria-hidden>
        {legend.map(([id, title]) => <span key={id}><i style={{ background: `#${docColor(id).getHexString()}` }} />{title}</span>)}
      </div>
      <div className="terrain-credit">PCA OF GEMINI EMBEDDINGS (768-D → 3-D) · DISTANCE = TEXT SIMILARITY, NOT GEOGRAPHY · ORANGE = RETRIEVED</div>
    </div>
  );
}
