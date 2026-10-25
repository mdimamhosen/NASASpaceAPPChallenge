'use client';

import type { ValidationReport } from '@/lib/api';
import { SceneShell } from './sceneKit';

const ROWS: Array<[keyof ValidationReport['slopes'] & ('driven' | 'randomNearDrive' | 'randomAnywhere'), string, string]> = [['driven', 'PERSEVERANCE DRIVE', '#F2F0EA'], ['randomNearDrive', 'RANDOM ≤1 KM', '#3b528b'], ['randomAnywhere', 'RANDOM ANYWHERE', '#C45C26']];
const STATS: Array<['p50Deg' | 'meanDeg' | 'p90Deg' | 'maxDeg' | 'over10', string, number]> = [['p50Deg', 'MEDIAN °', 0.15], ['meanDeg', 'MEAN °', 0.15], ['p90Deg', 'P90 °', 0.15], ['maxDeg', 'MAX °', 0.08], ['over10', '≥10° SHARE', 8]];

/** Slope statistics from /validation/report as 3D towers: the real drive against random lines in the same crater. */
export default function SlopeHistogram3D({ report }: { report: ValidationReport }) {
  return (
    <SceneShell overlay={<div className="scene-legend">{ROWS.map(([key, label, color]) => <span key={key}><i style={{ background: color }} />{label} · ≥10° {(report.slopes[key].over10 * 100).toFixed(1)}%</span>)}<small>TOWERS LEFT → RIGHT: {STATS.map(([, l]) => l).join(' · ')}</small></div>} title="DID THE ROVER AVOID STEEP GROUND?" meta={`${report.slopes.lines} RANDOM LINES · SEED ${report.slopes.seed}`} camera={[3.6, 3.4, 5.2]} target={[0, 0.8, 0]}
      credit={<>SLOPES ON THE ~118 M <a href={report.slopes.demSource} target="_blank" rel="noreferrer">PLACES DEM ↗</a> ALONG THE <a href={report.slopes.trackSource} target="_blank" rel="noreferrer">PLACES DRIVE ↗</a> VS SEEDED RANDOM 1 KM LINES · NON-CERTIFYING</>}>
      {ROWS.map(([key, label, color], r) => STATS.map(([stat, , scale], c) => {
        const h = Math.max(0.02, report.slopes[key][stat] * scale);
        return <mesh key={`${key}-${stat}`} position={[(c - 2) * 0.9, h / 2, (r - 1) * 0.9]}><boxGeometry args={[0.55, h, 0.55]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>;
      }))}
      <gridHelper args={[6, 12, '#2a303c', '#1c2029']} />
    </SceneShell>
  );
}
