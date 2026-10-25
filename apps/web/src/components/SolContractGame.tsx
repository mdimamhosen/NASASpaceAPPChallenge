'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { PlacesTrack, RouteWaypoint } from '@mars-explorer/shared';
import { contractCommBlackout, contractWaypoints, JPL_COMM_SOURCE, marsDistanceKm, PLACES_SOURCE, routeProfile, scoreSolContract, SOL_CONTRACTS } from '@mars-explorer/shared';
import { analyzeRoute, getPlaces } from '@/lib/api';
import MissionNav from './MissionNav';
import { useUiLanguage } from '@/lib/use-ui-language';
import { uiText } from '@/lib/ui-copy';

type Run = { contractId: string; score: number; complete: boolean; failures: string[]; distanceKm: number; risk: number; evaMinutes: number; commBlackout: boolean };
type BoardEntry = { name: string; score: number; date: string };
const RUN_KEY = 'me_sol_contract_run_v1';
const BOARD_KEY = 'me_sol_contract_board_v1';
const sourceName = (contractId: string, lang: 'en' | 'bn') => {
  const names: Record<string, [string, string]> = {
    'first-light': ['First light · Sol 400 → 409', 'প্রথম আলো · সোল ৪০০ → ৪০৯'],
    'delta-edge': ['Delta edge · Sol 700 → 709', 'ডেল্টা প্রান্ত · সোল ৭০০ → ৭০৯'],
    'sample-approach': ['Sample approach · Sol 1000 → 1007', 'নমুনা পথ · সোল ১০০০ → ১০০৭'],
    'western-margin': ['Western margin · Sol 1400 → 1408', 'পশ্চিম প্রান্ত · সোল ১৪০০ → ১৪০৮'],
    'long-watch': ['Long watch · Sol 1805 → 1815', 'দীর্ঘ প্রহর · সোল ১৮০৫ → ১৮১৫'],
  };
  return names[contractId]?.[lang === 'bn' ? 1 : 0] ?? contractId;
};

export default function SolContractGame() {
  const { language: lang } = useUiLanguage();
  const bn = lang === 'bn';
  const [places, setPlaces] = useState<PlacesTrack | null>(null);
  const [loadError, setLoadError] = useState('');
  const [stage, setStage] = useState<'briefing' | 'route' | 'debrief' | 'campaign'>('briefing');
  const [contractIndex, setContractIndex] = useState(0);
  const [campaignIndex, setCampaignIndex] = useState(0);
  const [runs, setRuns] = useState<Run[]>([]);
  const [route, setRoute] = useState<RouteWaypoint[]>([]);
  const [stressTest, setStressTest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Run | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [name, setName] = useState('');
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const contract = SOL_CONTRACTS[contractIndex];
  const orderedPoints = places?.points ?? [];
  const baseRoute = useMemo(() => contract ? contractWaypoints(contract.id, orderedPoints) : [], [contract, orderedPoints]);
  const commBlackout = contract ? contractCommBlackout(contract.commDate) : false;
  const detour = useMemo(() => {
    if (!contract || !orderedPoints.length || !baseRoute.length) return null;
    return orderedPoints.reduce((farthest, point) => marsDistanceKm(baseRoute[0], point) > marsDistanceKm(baseRoute[0], farthest) ? point : farthest, orderedPoints[0]);
  }, [contract, orderedPoints, baseRoute]);
  const plannedRoute = useMemo(() => {
    if (!stressTest || !detour || baseRoute.length < 2) return baseRoute;
    const start = baseRoute[0], goal = baseRoute[baseRoute.length - 1];
    return [start, { id: `detour-sol-${detour.sol}`, lat: detour.lat, lon: detour.lon }, goal];
  }, [stressTest, detour, baseRoute]);
  const routePlot = useMemo(() => {
    if (plannedRoute.length < 2) return [];
    const lats = plannedRoute.map((point) => point.lat), lons = plannedRoute.map((point) => point.lon);
    const minLat = Math.min(...lats), latSpan = Math.max(...lats) - minLat || 0.00001;
    const minLon = Math.min(...lons), lonSpan = Math.max(...lons) - minLon || 0.00001;
    return plannedRoute.map((point) => ({ x: 28 + ((point.lon - minLon) / lonSpan) * 444, y: 24 + ((Math.max(...lats) - point.lat) / latSpan) * 112 }));
  }, [plannedRoute]);
  const campaignScore = runs.reduce((sum, run) => sum + run.score, 0);

  useEffect(() => {
    getPlaces().then(setPlaces).catch((e: Error) => setLoadError(e.message));
    try {
      const existing = localStorage.getItem(RUN_KEY);
      if (existing) {
        const parsed = JSON.parse(existing) as { contractIndex?: number; runs?: Run[] };
        if (Array.isArray(parsed.runs)) setRuns(parsed.runs);
        if (Number.isInteger(parsed.contractIndex)) { const index = Math.min(SOL_CONTRACTS.length - 1, Math.max(0, parsed.contractIndex!)); setContractIndex(index); setCampaignIndex(index); }
      }
      const savedBoard = JSON.parse(localStorage.getItem(BOARD_KEY) || '[]') as BoardEntry[];
      if (Array.isArray(savedBoard)) setBoard(savedBoard.slice(0, 10));
    } catch { /* corrupted browser save is treated as an empty save */ }
  }, []);

  const beginContract = (index = campaignIndex) => {
    setContractIndex(index);
    setStressTest(false);
    setError('');
    setDetail(null);
    setStage('route');
    setRoute([]);
  };
  const confirmRoute = async () => {
    if (plannedRoute.length < 2) { setError(bn ? 'এই চুক্তির প্রকাশিত পথের তথ্য এখনও পাওয়া যায়নি।' : 'Published route points for this contract are not available yet.'); return; }
    setBusy(true); setError('');
    try {
      const analysis = await analyzeRoute(plannedRoute);
      const scored = scoreSolContract({ route: plannedRoute, goal: plannedRoute[plannedRoute.length - 1], risk: analysis.riskIndex.total, contract, distanceKm: analysis.distanceKm, evaProfile: routeProfile(analysis.terrainSamples) });
      const nextRun: Run = { contractId: contract.id, score: scored.score, complete: scored.complete, failures: scored.failures, distanceKm: analysis.distanceKm, risk: analysis.riskIndex.total, evaMinutes: scored.evaMinutes, commBlackout: scored.commBlackout };
      setDetail(nextRun); setRoute(plannedRoute); setStage('debrief');
    } catch (e) { setError(e instanceof Error ? e.message : (bn ? 'রুট বিশ্লেষণ ব্যর্থ হয়েছে।' : 'Route analysis failed.')); }
    finally { setBusy(false); }
  };
  const advance = () => {
    if (!detail) return;
    const nextRuns = [...runs.filter((r) => r.contractId !== contract.id), detail].sort((a, b) => SOL_CONTRACTS.findIndex((c) => c.id === a.contractId) - SOL_CONTRACTS.findIndex((c) => c.id === b.contractId));
    const nextIndex = SOL_CONTRACTS.findIndex((item) => !nextRuns.some((run) => run.contractId === item.id));
    const finished = nextIndex < 0;
    const nextContractIndex = finished ? SOL_CONTRACTS.length - 1 : nextIndex;
    setCampaignIndex(nextContractIndex);
    setRuns(nextRuns); setContractIndex(nextContractIndex); setDetail(null);
    localStorage.setItem(RUN_KEY, JSON.stringify({ contractIndex: nextContractIndex, runs: nextRuns }));
    setStage(finished ? 'campaign' : 'briefing');
  };
  const replay = () => { setRuns([]); setContractIndex(0); setCampaignIndex(0); setStage('briefing'); setDetail(null); setSaved(false); localStorage.removeItem(RUN_KEY); };
  const saveScore = (event: React.FormEvent) => {
    event.preventDefault();
    const entry = { name: name.trim().slice(0, 24) || (bn ? 'নামহীন নভোচারী' : 'Anonymous explorer'), score: campaignScore, date: new Date().toISOString().slice(0, 10) };
    const next = [...board, entry].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date)).slice(0, 10);
    setBoard(next); localStorage.setItem(BOARD_KEY, JSON.stringify(next)); setSaved(true);
  };
  const txt = (key: Parameters<typeof uiText>[0]) => uiText(key, lang);

  return <><MissionNav active="/game" /><main className="sol-game">
    <header className="sol-game-top"><div><span className="eyebrow">MARS 2020 / JEZERO FIELD SIMULATOR</span><h1>{txt('campaign')}</h1><p>{bn ? 'পাঁচটি EVA চুক্তি পরিকল্পনা করুন। নাসার প্রকাশিত রোভার অবস্থান ব্যবহার করুন, তথ্য দিয়ে সিদ্ধান্ত নিন, এবং প্রতিটি মিশনের ফলাফল দেখুন।' : 'Plan five EVA contracts from published rover positions. Make evidence-led choices, then read a clear mission debrief.'}</p></div><div className="sol-game-actions"><button onClick={() => setRulesOpen(!rulesOpen)}>{rulesOpen ? txt('hideRules') : txt('rules')}</button><Link href="/explore">{bn ? 'এক্সপ্লোর কনসোল' : 'EXPLORE CONSOLE'} ↗</Link></div></header>
    <div className="sol-noncert" role="note">{txt('nonCertifying')} · <a href={PLACES_SOURCE} target="_blank" rel="noreferrer">NASA PDS PLACES ↗</a></div>
    {rulesOpen && <section className="sol-rules"><h2>{bn ? 'চুক্তি কীভাবে কাজ করে' : 'How the contracts work'}</h2><ol><li>{bn ? 'প্রতিটি পথ Perseverance-এর প্রকাশিত PLACES অবস্থান থেকে তৈরি।' : 'Each course is made from Perseverance positions published in PDS PLACES.'}</li><li>{bn ? 'পথ বিশ্লেষণ একই Mars Trek route service ও shared EVA model ব্যবহার করে।' : 'Route analysis uses the same Mars Explorer route service and shared EVA model.'}</li><li>{bn ? 'ঝুঁকি সীমা, EVA সময় এবং লক্ষ্য ব্যাসার্ধ অতিক্রম করলে চুক্তি ব্যর্থ হবে।' : 'A contract fails when risk, EVA time or the goal radius exceeds its limit.'}</li><li>{bn ? 'যোগাযোগ ব্ল্যাকআউট JPL-এর আনুমানিক গ্রহ অবস্থান থেকে হিসাব করা। সব স্কোর গবেষণামূলক।' : 'Comms blackout is derived from JPL approximate planet positions. All scores are research aids.'}</li></ol></section>}
    {loadError && <div className="sol-empty" role="status"><strong>{bn ? 'প্রকাশিত PLACES ট্র্যাক লোড হয়নি' : 'Published PLACES track did not load'}</strong><p>{loadError}</p><button onClick={() => { setLoadError(''); getPlaces().then(setPlaces).catch((e: Error) => setLoadError(e.message)); }}>{bn ? 'আবার চেষ্টা করুন' : 'RETRY'}</button></div>}
    {!loadError && !places && <div className="sol-loading" role="status"><span className="sol-loader" />{bn ? 'প্রকাশিত রোভার ট্র্যাক লোড হচ্ছে…' : 'LOADING PUBLISHED ROVER TRACK…'}</div>}
    {stage === 'briefing' && <>
      <section className="sol-campaign-status"><span>{bn ? 'অভিযানের অগ্রগতি' : 'CAMPAIGN PROGRESS'}</span><strong>{runs.length} / {SOL_CONTRACTS.length}</strong><div className="sol-progress"><i style={{ width: `${runs.length / SOL_CONTRACTS.length * 100}%` }} /></div><p>{bn ? 'প্রতিটি সোল কন্ট্রাক্ট একটি স্বতন্ত্র মিশন। যেকোনোটি পুনরায় খেলা যাবে।' : 'Each Sol Contract is a self-contained mission. Replay any contract from its card.'}</p></section>
      <section className="sol-contract-grid" aria-label={bn ? 'সোল কন্ট্রাক্ট তালিকা' : 'Sol contract list'}>{SOL_CONTRACTS.map((item, index) => { const prior = runs.find((r) => r.contractId === item.id); const available = Boolean(places && contractWaypoints(item.id, orderedPoints).length >= 2); const locked = !prior && index > campaignIndex; return <article key={item.id} className={`sol-contract-card ${prior?.complete ? 'is-complete' : prior ? 'is-failed' : ''}`}><small>CONTRACT {String(index + 1).padStart(2, '0')} / 05</small><h2>{sourceName(item.id, lang)}</h2><p>{bn ? 'প্রকাশিত ট্র্যাকের ছোট পথ · লক্ষ্য ব্যাসার্ধ' : 'Published track segment · goal radius'} <strong>{item.goalRadiusKm.toFixed(2)} km</strong></p><div className="sol-card-limits"><span>{txt('eva')}<b>{item.evaBudgetMinutes} min</b></span><span>{txt('risk')}<b>≤ {item.riskCap}</b></span><span>{txt('comm')}<b>{contractCommBlackout(item.commDate) ? (bn ? 'ব্ল্যাকআউট' : 'BLACKOUT') : (bn ? 'খোলা' : 'OPEN')}</b></span></div>{prior && <div className={`sol-card-result ${prior.complete ? 'success' : 'failure'}`}>{prior.complete ? txt('complete') : txt('failed')} · {prior.score} PTS</div>}<button disabled={!available || locked} onClick={() => beginContract(index)}>{prior ? (bn ? 'আবার খেলুন' : 'REPLAY') : locked ? (bn ? 'আগের চুক্তি শেষ করুন' : 'COMPLETE PRIOR CONTRACTS') : (available ? (bn ? 'চুক্তি শুরু করুন' : 'START CONTRACT') : (bn ? 'ট্র্যাক পয়েন্ট অনুপস্থিত' : 'TRACK POINTS UNAVAILABLE'))} ↗</button></article>; })}</section>
      <section className="sol-score-panel"><div><span className="eyebrow">{txt('score')}</span><strong>{campaignScore.toLocaleString()}</strong><small>{bn ? 'বর্তমান অভিযানের পয়েন্ট' : 'CURRENT CAMPAIGN POINTS'}</small></div><div><span className="eyebrow">{bn ? 'প্রকাশিত রুটের উৎস' : 'PUBLISHED ROUTE SOURCE'}</span><a href={PLACES_SOURCE} target="_blank" rel="noreferrer">NASA PDS PLACES · best_interp.csv ↗</a><small>{bn ? 'লোকালাইজেশন প্রকাশিত রোভার অবস্থান; অনুমোদিত EVA ট্রাভার্স নয়।' : 'Archive localizations are published rover positions, not an approved EVA traverse.'}</small></div></section>
    </>}
    {stage === 'route' && contract && <section className="sol-play-layout"><aside className="sol-play-sidebar"><button className="sol-back" onClick={() => setStage('briefing')}>← {bn ? 'সব চুক্তি' : 'ALL CONTRACTS'}</button><span className="eyebrow">CONTRACT {String(contractIndex + 1).padStart(2, '0')} / 05</span><h2>{sourceName(contract.id, lang)}</h2><p>{bn ? 'নির্বাচিত পথটি যাচাই করুন। একটি দূরবর্তী প্রকাশিত অবস্থান যোগ করে EVA বাজেটকে চ্যালেঞ্জ করতে পারেন।' : 'Review the course. Add one distant published localization to challenge your EVA budget.'}</p><label className="sol-detour"><input type="checkbox" checked={stressTest} onChange={(e) => setStressTest(e.target.checked)} disabled={!detour} /><span><strong>{bn ? 'দূরবর্তী চেকপয়েন্ট যোগ করুন' : 'ADD A LONG-RANGE CHECKPOINT'}</strong><small>{detour ? (bn ? `NASA PLACES · সোল ${detour.sol} অবস্থান` : `NASA PLACES · Sol ${detour.sol} localization`) : (bn ? 'কোনো উপযুক্ত পয়েন্ট নেই' : 'No suitable published checkpoint')}</small></span></label><div className="sol-limit-list"><div><span>GOAL RADIUS</span><strong>{contract.goalRadiusKm.toFixed(2)} KM</strong></div><div><span>EVA BUDGET</span><strong>{contract.evaBudgetMinutes} MIN</strong></div><div><span>RISK CAP</span><strong>{contract.riskCap} / 100</strong></div><div><span>COMMS WINDOW</span><strong>{commBlackout ? (bn ? 'BLACKOUT' : 'BLACKOUT') : (bn ? 'OPEN' : 'OPEN')}</strong></div></div><button className="sol-primary" disabled={busy || baseRoute.length < 2 || !places} onClick={confirmRoute}>{busy ? (bn ? 'বিশ্লেষণ চলছে…' : 'ANALYZING ROUTE…') : txt('confirmRoute')} <span>↗</span></button>{error && <p className="sol-error" role="alert">{error}</p>}</aside><div className="sol-route-card"><div className="sol-route-head"><div><span className="eyebrow">NASA PDS PLACES / ARCHIVE LOCATIONS</span><h3>{bn ? 'মিশন পথ' : 'MISSION COURSE'}</h3></div><strong>{baseRoute.length} {bn ? 'টি প্রকাশিত পয়েন্ট' : 'PUBLISHED POINTS'}</strong></div><svg className="sol-route-plot" viewBox="0 0 500 160" role="img" aria-label={bn ? 'প্রকাশিত PLACES স্থানাঙ্কের আপেক্ষিক পথচিত্র, মানচিত্র নয়' : 'Relative sketch of published PLACES coordinates; not a basemap'}><path d="M 0 20 H 500 M 0 80 H 500 M 0 140 H 500 M 25 0 V 160 M 250 0 V 160 M 475 0 V 160" /><polyline points={routePlot.map((point) => `${point.x},${point.y}`).join(' ')} />{routePlot.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r={index === 0 || index === routePlot.length - 1 ? 5 : 3} />)}</svg><p className="sol-plot-caption">{bn ? 'স্থানাঙ্ক স্কেচ · গেম পরিকল্পনা, ভূখণ্ড-নিরাপত্তা মূল্যায়ন নয়' : 'COORDINATE SKETCH · GAME PLAN, NOT A TERRAIN OR SAFETY ASSESSMENT'}</p><div className="sol-route-line">{plannedRoute.map((point, index) => <div key={point.id} className="sol-route-stop"><span className="sol-stop-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{stressTest && index === 1 ? (bn ? `বিকল্প · সোল ${detour?.sol}` : `DETOUR · SOL ${detour?.sol}`) : (index === 0 ? (bn ? `শুরু · সোল ${contract.startSol}` : `START · SOL ${contract.startSol}`) : index === plannedRoute.length - 1 ? (bn ? `লক্ষ্য · সোল ${contract.goalSol}` : `GOAL · SOL ${contract.goalSol}`) : (bn ? `সোল ${contract.startSol + index}` : `SOL ${contract.startSol + index}`))}</strong><small>{point.lat.toFixed(5)}°N · {point.lon.toFixed(5)}°E</small></div><a href={PLACES_SOURCE} target="_blank" rel="noreferrer">SOURCE ↗</a></div>)}</div><div className="sol-route-note">{bn ? 'সব স্থানাঙ্ক NASA PDS PLACES best_interp.csv থেকে। সংযোগকারী রেখা গেমের পরিকল্পিত পথ, রোভারের চালানো পথের দাবি নয়।' : 'All coordinates come from NASA PDS PLACES best_interp.csv. Connecting legs are game plans, not claims about the rover’s driven path.'}</div><Link className="sol-map-link" href="/explore">{bn ? 'Mars Explorer-এ স্থানটি দেখুন' : 'VIEW JEZERO IN MARS EXPLORER'} ↗</Link></div></section>}
    {stage === 'debrief' && detail && contract && <section className="sol-debrief"><header className={detail.complete ? 'debrief-pass' : 'debrief-fail'}><div><span className="eyebrow">CONTRACT {String(contractIndex + 1).padStart(2, '0')} / MISSION DEBRIEF</span><h2>{detail.complete ? txt('complete') : txt('failed')}</h2><p>{detail.complete ? (bn ? 'পরিকল্পনা নির্ধারিত সীমার মধ্যে লক্ষ্য অর্জন করেছে।' : 'The route reached its goal within the mission limits.') : (bn ? 'এক বা একাধিক সীমা অতিক্রম হয়েছে। ব্যর্থতার কারণগুলো নিচে দেখুন।' : 'One or more mission limits were exceeded. Review the failed terms below.')}</p></div><div className="sol-award"><small>{txt('score')}</small><strong>{detail.score}</strong><span>PTS</span></div></header><div className="sol-metric-grid">{[[txt('distance'), `${detail.distanceKm.toFixed(2)} km`, 'MARS EXPLORER ROUTE'],[txt('risk'), `${detail.risk} / 100`, detail.risk <= contract.riskCap ? 'WITHIN CONTRACT CAP' : 'OVER CONTRACT CAP'],[txt('eva'), `${detail.evaMinutes.toFixed(0)} min`, detail.evaMinutes <= contract.evaBudgetMinutes ? 'WITHIN EVA BUDGET' : 'OVER EVA BUDGET'],[txt('comm'), detail.commBlackout ? (bn ? 'BLACKOUT' : 'BLACKOUT') : (bn ? 'OPEN' : 'OPEN'), detail.commBlackout ? 'PLAN AHEAD' : 'WINDOW OPEN']].map(([label, value, status]) => <div key={String(label)}><small>{label}</small><strong>{value}</strong><em>{status}</em></div>)}</div>{detail.failures.length > 0 && <section className="sol-failure-list"><h3>{bn ? 'যে শর্তগুলো পূরণ হয়নি' : 'Terms to revise'}</h3>{detail.failures.map((failure) => <p key={failure}><span>×</span>{failure === 'risk' ? `${txt('risk')} ${bn ? 'সীমা অতিক্রম করেছে' : 'exceeded the limit'}` : failure === 'eva' ? `${txt('eva')} ${bn ? 'বাজেট অতিক্রম করেছে' : 'exceeded the budget'}` : failure === 'goal' ? (bn ? 'লক্ষ্য ব্যাসার্ধের বাইরে' : 'Goal lies outside the allowed radius') : (bn ? 'দূরত্ব হিসাব করা যায়নি' : 'Distance could not be computed')}</p>)}</section>}<section className="sol-citation-list"><span>{bn ? 'গণনার উৎস' : 'CALCULATION SOURCES'}</span><a href={PLACES_SOURCE} target="_blank" rel="noreferrer">NASA PDS PLACES · published rover localizations ↗</a><a href="https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_dem.xml" target="_blank" rel="noreferrer">NASA PLACES orbital DEM · terrain samples for EVA ↗</a><a href={JPL_COMM_SOURCE} target="_blank" rel="noreferrer">JPL approximate planet positions · comm blackout ↗</a><Link href="/science#reproduce">Mars Explorer route risk method ↗</Link></section><p className="sol-score-formula">{bn ? 'গেমের স্কোর সূত্র' : 'GAME SCORE RULE'}: max(0, round(1000 − 35 × km − 4 × Risk Index − EVA minutes ÷ 4 − 120 during comm blackout)). This is a game-design score, not a NASA metric.</p><button className="sol-primary" onClick={advance}>{contractIndex === SOL_CONTRACTS.length - 1 ? (bn ? 'চূড়ান্ত ফলাফল' : 'VIEW CAMPAIGN RESULTS') : txt('nextContract')} <span>→</span></button></section>}
    {stage === 'campaign' && <section className="sol-campaign-results"><header><span className="eyebrow">CAMPAIGN COMPLETE / MISSION DEBRIEF</span><h2>{bn ? 'জেজেরো অভিযান সম্পন্ন' : 'Jezero campaign complete'}</h2><p>{bn ? 'পাঁচটি সোল কন্ট্রাক্টের ফলাফল এবং প্রতিটি মিশনের উৎস পর্যালোচনা করুন।' : 'Review all five Sol Contract results with their source trail.'}</p><div className="sol-total-score"><small>{txt('score')}</small><strong>{campaignScore.toLocaleString()}</strong></div></header><div className="sol-run-list">{SOL_CONTRACTS.map((item, i) => { const run = runs.find((r) => r.contractId === item.id); return <article key={item.id}><span>0{i + 1}</span><div><strong>{sourceName(item.id, lang)}</strong><small>{run ? `${run.distanceKm.toFixed(2)} km · risk ${run.risk}/100 · EVA ${run.evaMinutes.toFixed(0)} min` : (bn ? 'চেষ্টা করা হয়নি' : 'Not attempted')}</small></div><b className={run?.complete ? 'success' : run ? 'failure' : ''}>{run ? `${run.score} PTS · ${run.complete ? 'PASS' : 'REVISE'}` : '—'}</b></article>; })}</div><section className="sol-leaderboard"><div><span className="eyebrow">LOCAL SCOREBOARD</span><h3>{bn ? 'এই ব্রাউজারের স্কোর' : 'Scores on this browser'}</h3><p>{bn ? 'নাম, তারিখ ও স্কোর শুধু এই ব্রাউজারের localStorage-এ থাকবে।' : 'Names, dates and scores stay in this browser’s localStorage.'}</p></div>{!saved ? <form onSubmit={saveScore}><label htmlFor="sol-player-name">{bn ? 'অভিযাত্রীর নাম' : 'EXPLORER NAME'}</label><input id="sol-player-name" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder={bn ? 'নাম লিখুন' : 'Name for the board'} /><button type="submit">{bn ? 'স্কোর সংরক্ষণ' : 'SAVE SCORE'}</button></form> : <p className="sol-saved" role="status">✓ {bn ? 'স্কোর সংরক্ষিত' : 'SCORE SAVED'}</p>}<ol>{board.map((entry, i) => <li key={`${entry.date}-${entry.name}-${i}`}><span>{String(i + 1).padStart(2, '0')}</span><strong>{entry.name}</strong><b>{entry.score.toLocaleString()}</b><time>{entry.date}</time></li>)}</ol></section><button className="sol-primary" onClick={replay}>{txt('replay')} ↻</button></section>}
    <footer className="sol-game-footer"><span>MARS EXPLORER / SOL CONTRACT</span><span>NASA PDS PLACES · JPL APPROXIMATE ORBITS</span><span>{txt('nonCertifying')}</span></footer>
  </main></>;
}
