'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import type { DtmGrid, PlacesPoint } from '@mars-explorer/shared';
import { suggestRoute } from '@/lib/api';
import { buildModel, drape } from './TerrainView3D';
import { DemMesh, SceneShell } from './sceneKit';

const EX = 3, LEGS: Array<[number, number]> = [[0, 400], [400, 700], [700, 1000]];

/** For each verified sol leg: Perseverance's published drive (white) and our A* corridor (orange) on the same DEM. */
export default function CorridorCompare3D({ grid, track }: { grid: DtmGrid; track: PlacesPoint[] }) {
  const m = useMemo(() => buildModel(grid), [grid]);
  const [corridors, setCorridors] = useState<Array<Array<{ lat: number; lon: number }>>>([]);
  const legs = useMemo(() => LEGS.map(([a, b]) => track.filter((p) => p.sol >= a && p.sol <= b)).filter((l) => l.length > 1), [track]);
  useEffect(() => {
    let live = true;
    Promise.all(legs.map((l) => suggestRoute([{ id: 'a', lat: l[0].lat, lon: l[0].lon }, { id: 'b', lat: l.at(-1)!.lat, lon: l.at(-1)!.lon }]).then((r) => r.waypoints).catch(() => [])))
      .then((c) => { if (live) setCorridors(c); });
    return () => { live = false; };
  }, [legs]);
  return (
    <SceneShell title="A* CORRIDOR VS PERSEVERANCE" meta={`${legs.length} VERIFIED SOL LEGS · ${corridors.filter((c) => c.length > 1).length} CORRIDORS`} camera={[m.W * 0.5, m.W * 0.5, m.W * 0.75]}
      credit={<>WHITE = PUBLISHED <a href="https://pds-geosciences.wustl.edu/missions/mars2020/places.htm" target="_blank" rel="noreferrer">PLACES DRIVE ↗</a> · ORANGE DASHED = SLOPE-WEIGHTED A* ON THE ~118 M DEM · THE ROVER ALSO AVOIDED HAZARDS THE GRID CANNOT SEE</>}>
      <DemMesh m={m} exaggeration={EX} />
      {legs.map((l, i) => { const inside = l.filter(m.inside); return inside.length > 1 ? <Line key={`d${i}`} points={drape(m, inside, EX, 0.03)} color="#F2F0EA" lineWidth={2.5} /> : null; })}
      {corridors.map((c, i) => c.length > 1 ? <Line key={`c${i}`} points={drape(m, c.filter(m.inside), EX, 0.05)} color="#C45C26" lineWidth={3} dashed dashSize={0.08} gapSize={0.05} /> : null)}
    </SceneShell>
  );
}
