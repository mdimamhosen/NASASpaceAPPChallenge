'use client';

import type { SiteScore, SuitabilityWeights } from '@mars-explorer/shared';

const LABELS: Record<keyof SuitabilityWeights, string> = { slope: 'GENTLE SLOPE', roughness: 'SMOOTH GROUND', elevation: 'LOW ELEVATION', science: 'NEAR SCIENCE TARGET', trafficable: 'NEAR DRIVEN GROUND' };

/** Weight sliders and the top candidate sites for the habitat suitability layer. NON-CERTIFYING. */
export default function SuitabilityPanel({ weights, onWeights, best, onFocus, onUse }: { weights: SuitabilityWeights; onWeights: (w: SuitabilityWeights) => void; best: SiteScore[]; onFocus: (s: SiteScore) => void; onUse: (s: SiteScore) => void }) {
  return (
    <section className="suit-panel" aria-label="Habitat suitability weights and top sites">
      <header><span>HABITAT SUITABILITY</span><span>NON-CERTIFYING</span></header>
      {(Object.keys(LABELS) as Array<keyof SuitabilityWeights>).map((k) => (
        <label key={k}><span>{LABELS[k]}</span><input type="range" min={0} max={1} step={0.05} value={weights[k]} onChange={(e) => onWeights({ ...weights, [k]: Number(e.target.value) })} aria-label={`${LABELS[k]} weight`} /><em>{Math.round(weights[k] * 100)}</em></label>
      ))}
      <div className="suit-scale" aria-hidden><i /><small>LOW</small><small>HIGH</small></div>
      <ol>{best.map((s, i) => (
        <li key={`${s.lat}-${s.lon}`}>
          <button type="button" onClick={() => onFocus(s)}><strong>{String(i + 1).padStart(2, '0')} · {Math.round(s.score)}</strong><small>{s.lat.toFixed(4)}°N {s.lon.toFixed(4)}°E · {s.slopeDeg.toFixed(1)}° · {s.targetKm.toFixed(2)} KM TO TARGET</small></button>
          <button type="button" className="suit-use" onClick={() => onUse(s)} aria-label={`Add site ${i + 1} as a waypoint`}>+ WP</button>
        </li>
      ))}</ol>
      <p>Score 0–100 on the ~118 m NASA PLACES DEM grid. Cells at 15° or steeper score 0. It ranks where to look, not where it is safe.</p>
    </section>
  );
}
