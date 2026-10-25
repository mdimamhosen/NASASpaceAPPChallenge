'use client';

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { lineOfSight, type DtmGrid, type LatLon } from '@mars-explorer/shared';
import { buildModel, toWorld } from './TerrainView3D';
import { DemMesh, SceneShell } from './sceneKit';

const EX = 3, MAST = 2;

/** Radio line of sight between two surface points over the PLACES DEM: green where clear, red where terrain blocks it. */
export default function LosRay3D({ grid, a, b }: { grid: DtmGrid; a: LatLon; b: LatLon }) {
  const m = useMemo(() => buildModel(grid), [grid]);
  const r = useMemo(() => lineOfSight((lat, lon) => (m.inside({ lat, lon }) ? m.elevationAt(lat, lon) : null), a, b, { heightA: MAST, heightB: MAST }), [m, a, b]);
  if (!r) return <div className="map-loading">BOTH ENDS MUST BE INSIDE THE JEZERO DEM GRID</div>;
  const pa = toWorld(m, a, EX, (MAST / 1000) * EX), pb = toWorld(m, b, EX, (MAST / 1000) * EX);
  // Red where the ray dips under the ground (curvature included), green elsewhere.
  const ray = r.profile.map((p) => ({ t: p.m / r.distanceM, under: p.ray < p.ground }));
  const mid: [number, number, number] = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2], span = Math.max(0.6, Math.hypot(pb[0] - pa[0], pb[2] - pa[2]));
  const at = (t: number): [number, number, number] => [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t + 0.01, pa[2] + (pb[2] - pa[2]) * t];
  return (
    <SceneShell title={`LINE OF SIGHT · ${r.clear ? 'CLEAR' : 'BLOCKED'}`} meta={`${(r.distanceM / 1000).toFixed(2)} KM · ${MAST} M MASTS · TIGHTEST ${r.minClearanceM.toFixed(1)} M`} camera={[mid[0] + span * 0.6, mid[1] + span * 0.55, mid[2] + span * 0.95]} target={mid} autoRotate={false}
      credit={<>RAY-MARCH OVER THE <a href={grid.labelUrl} target="_blank" rel="noreferrer">PLACES ORBITAL DEM ↗</a> WITH MARS CURVATURE · IGNORES FRESNEL ZONES AND DIFFRACTION · NON-CERTIFYING</>}>
      <DemMesh m={m} exaggeration={EX} />
      <Line points={ray.map((p) => at(p.t))} vertexColors={ray.map((p) => (p.under ? [1, 0.3, 0.3] : [0.43, 0.81, 0.59]) as [number, number, number])} lineWidth={4} />
      {[pa, pb].map((p, i) => <mesh key={i} position={p}><sphereGeometry args={[0.05, 16, 16]} /><meshBasicMaterial color="#F2F0EA" /></mesh>)}
    </SceneShell>
  );
}
