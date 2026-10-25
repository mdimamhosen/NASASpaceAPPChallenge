'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SceneShell } from './sceneKit';

type Layer = { latTop: number; lonLeft: number; stepDeg: number; rows: Array<Array<number | null>> };
const ICE = new THREE.Color('#7fd3ff'), DRY = new THREE.Color('#5a3a2a'), MID = new THREE.Color('#d8cfc0');

function Columns({ cells, cell, size, lo, hi }: { cells: Array<{ r: number; c: number; v: number }>; cell: number; size: number; lo: number; hi: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    cells.forEach(({ r, c, v }, k) => {
      // Height spans the observed range so local contrast shows; colour keeps the absolute sign (ice vs not).
      const h = 0.05 + ((v - lo) / Math.max(1e-6, hi - lo)) * 1.2;
      d.position.set(c * cell - size / 2, h / 2, r * cell - size / 2);
      d.scale.set(cell * 0.92, h, cell * 0.92);
      d.updateMatrix();
      mesh.current!.setMatrixAt(k, d.matrix);
      mesh.current!.setColorAt(k, v >= 0 ? MID.clone().lerp(ICE, Math.min(1, v * 2)) : MID.clone().lerp(DRY, Math.min(1, -v * 2)));
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true;
  }, [cells, cell, size, lo, hi]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, cells.length]}><boxGeometry /><meshStandardMaterial roughness={0.7} /></instancedMesh>;
}

/** SWIM 2.0 ice consistency around Jezero as columns: height and colour follow C_i (−1 dry … +1 ice-consistent). */
export default function SwimIce3D({ layer, label }: { layer: Layer; label: string }) {
  const R = layer.rows.length, C = layer.rows[0]?.length ?? 0, size = 6, cell = size / Math.max(R, C);
  const cells = useMemo(() => layer.rows.flatMap((row, r) => row.map((v, c) => ({ r, c, v }))).filter((x) => x.v != null) as Array<{ r: number; c: number; v: number }>, [layer]);
  const stats = useMemo(() => { const v = cells.map((x) => x.v); return { min: Math.min(...v), max: Math.max(...v) }; }, [cells]);
  // Jezero landing site sits at the centre of the snapshot window.
  return (
    <SceneShell title={`SWIM 2.0 SUBSURFACE ICE · ${label}`} meta={`${cells.length} CELLS · 3 KM PIXELS · C_i ${stats.min.toFixed(2)} → ${stats.max.toFixed(2)}`} camera={[5.5, 5, 6.5]}
      credit={<>±3° AROUND JEZERO · HEIGHT = RELATIVE C_i ACROSS THIS WINDOW · BLUE = DATA CONSISTENT WITH ICE · BROWN = INCONSISTENT · <a href="https://swim.psi.edu/" target="_blank" rel="noreferrer">SWIM / PSI (NASA-FUNDED) ↗</a> · NON-CERTIFYING</>}>
      <Columns cells={cells} cell={cell} size={size} lo={stats.min} hi={stats.max} />
      <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.02, 0.02, 3.2, 8]} /><meshBasicMaterial color="#C45C26" /></mesh>
      <mesh position={[0, 3.25, 0]}><sphereGeometry args={[0.08, 16, 16]} /><meshBasicMaterial color="#C45C26" /></mesh>
    </SceneShell>
  );
}
