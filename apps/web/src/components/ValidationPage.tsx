'use client';

import { useEffect, useState } from 'react';
import MissionNav from './MissionNav';
import RagEvalCard from './RagEvalCard';
import Data3DSection from './scenes/Data3DSection';
import { getValidation, type ValidationReport } from '@/lib/api';
import { uiText } from '@/lib/ui-copy';
import { useUiLanguage } from '@/lib/use-ui-language';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const Mark = ({ ok }: { ok: boolean }) => <strong className={ok ? 'vd-pass' : 'vd-fail'}>{ok ? 'PASS' : 'MISS'}</strong>;

/** Validity evidence judges can check: every number is computed live from NASA data the app already holds. */
export default function ValidationPage() {
  const { language: uiLang } = useUiLanguage();
  const [r, setR] = useState<ValidationReport | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getValidation().then(setR).catch((e: Error) => setError(e.message)); }, []);
  const rows = r ? ([['PERSEVERANCE DRIVE', r.slopes.driven], ['RANDOM 1 KM LINES · ≤1 KM OF DRIVE', r.slopes.randomNearDrive], ['RANDOM 1 KM LINES · ANYWHERE IN DEM', r.slopes.randomAnywhere]] as const) : [];
  const maxOver = Math.max(0.01, ...rows.map(([, s]) => s.over10));

  return (
    <main className="theater-page validation-page">
      <MissionNav active="/validation" />
      <section className="theater-hero"><div><p className="eyebrow">VALIDATION / CHECK OUR WORK</p><h1>{uiText('validationTitle', uiLang)}</h1><p>{uiText('validationLead', uiLang)} PLACES, Mars24 and conjunction references.</p></div><aside><span>STATUS</span><strong>{r ? `${r.science.mars24.filter((s) => s.pass).length + r.science.conjunctions.filter((s) => s.pass).length}/${r.science.mars24.length + r.science.conjunctions.length}` : '—'}</strong><small>SCIENCE REFERENCES MATCHED</small></aside></section>
      {error && <p className="compare-note">Validation report unavailable: {error}. Start the API with pnpm dev.</p>}
      {!r && !error && <p className="compare-note" role="status">Computing the report from the PLACES drive and DEM…</p>}
      {r && <>
        <section className="theater-section" aria-label="Slopes on the real drive vs random lines">
          <div className="theater-section-head"><span>01 / DID THE ROVER AVOID STEEP GROUND?</span><span>{r.slopes.lines} RANDOM LINES · SEED {r.slopes.seed}</span></div>
          <div className="vd-bars">{rows.map(([label, s]) => <div key={label}><span>{label}</span><i style={{ width: `${(s.over10 / maxOver) * 100}%` }} /><strong>{pct(s.over10)} ≥10° · {pct(s.over15)} ≥15°</strong><small>MEAN {s.meanDeg}° · P90 {s.p90Deg}° · MAX {s.maxDeg}° · {s.n} SAMPLES</small></div>)}</div>
          <p className="vd-note">The published drive crosses less steep DEM ground than random lines through the same crater, including lines near the drive. That agrees with the slope term in our Risk Index. {r.slopes.note} <a href={r.slopes.trackSource} target="_blank" rel="noreferrer">PLACES ↗</a> · <a href={r.slopes.demSource} target="_blank" rel="noreferrer">DEM ↗</a></p>
        </section>
        <section className="theater-section" aria-label="A* corridor vs the real drive">
          <div className="theater-section-head"><span>02 / A* CORRIDOR VS PERSEVERANCE</span><span>VERIFIED SOL LEGS</span></div>
          <table className="vd-table"><thead><tr><th>LEG</th><th>DRIVEN</th><th>CORRIDOR</th><th>MEAN OFFSET</th><th>MAX OFFSET</th><th>WAYPOINTS ≤200 M</th></tr></thead>
            <tbody>{r.corridors.legs.map((l) => <tr key={l.fromSol}><td>SOL {l.fromSol} → {l.toSol}</td><td>{l.drivenKm} KM</td><td>{l.corridorKm ?? '—'} KM</td><td>{l.corridor ? `${l.corridor.meanOffsetM} M` : 'NO CORRIDOR'}</td><td>{l.corridor ? `${l.corridor.maxOffsetM} M` : '—'}</td><td>{l.corridor ? pct(l.corridor.within200m) : '—'}</td></tr>)}</tbody></table>
          <p className="vd-note">{r.corridors.note} NON-CERTIFYING.</p>
        </section>
        <section className="theater-section" aria-label="Science references">
          <div className="theater-section-head"><span>03 / {uiText('scienceReferences', uiLang).toUpperCase()}</span><span>MARS24 · CONJUNCTION</span></div>
          <table className="vd-table"><thead><tr><th>CHECK</th><th>OURS</th><th>NASA</th><th>RESULT</th></tr></thead>
            <tbody>
              {r.science.mars24.map((s) => <tr key={s.check}><td><a href={s.source} target="_blank" rel="noreferrer">{s.check} ↗</a></td><td>{s.ours}{s.unit}</td><td>{s.reference}{s.unit} ± {s.tolerance}</td><td><Mark ok={s.pass} /></td></tr>)}
              {r.science.conjunctions.map((s) => <tr key={s.check}><td><a href={s.source} target="_blank" rel="noreferrer">{s.check} ↗</a></td><td>{s.ours}</td><td>{s.start} → {s.end}</td><td><Mark ok={s.pass} /></td></tr>)}
            </tbody></table>
          <p className="vd-note">A conjunction passes when our computed blackout (Sun within 3° of Mars from Earth) covers NASA&apos;s command moratorium.</p>
        </section>
        <section className="theater-section" aria-label="Agent tool choice eval">
          <div className="theater-section-head"><span>04 / {uiText('agentToolChoice', uiLang).toUpperCase()}</span><span>{r.agent.passed}/{r.agent.total} PASS · PRECISION {pct(r.agent.meanPrecision)}</span></div>
          <table className="vd-table"><thead><tr><th>GOAL</th><th>EXPECTED</th><th>PLANNED</th><th>RESULT</th></tr></thead>
            <tbody>{r.agent.items.map((a) => <tr key={a.goal}><td>{a.goal}</td><td>{a.expected.join(', ')}</td><td>{a.planned.join(', ')}</td><td><Mark ok={a.pass} /></td></tr>)}</tbody></table>
          <p className="vd-note">Router: {r.agent.router}. Labelled set in data/agent/eval.json. Search_knowledge is always allowed alongside other tools.</p>
        </section>
      </>}
      <Data3DSection variant="slopehist" eyebrow="VALIDATION / IN 3D" title="Gentler ground, measured." body="The same slope statistics as towers: Perseverance’s real drive against random lines through the same crater." />
      <Data3DSection variant="corridor" eyebrow="VALIDATION / IN 3D" title="Our corridor beside the real drive." body="For each verified sol leg, Perseverance’s published PLACES drive and our A* corridor on the same DEM." />
      <RagEvalCard />
    </main>
  );
}
