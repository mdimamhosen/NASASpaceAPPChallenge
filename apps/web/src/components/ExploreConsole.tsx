'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Crosshair, HelpCircle, Layers3, LocateFixed, MapPin, Minus, Plus, Route, Send, Sparkles, Undo2, X, Search, Maximize2, Minimize2, Printer } from 'lucide-react';
import type { AssistantResponse, Citation, LayerId, MapLayer, MissionBriefing, POI, RegionData, RouteAnalysis, RouteWaypoint, PlacesTrack, SuggestedRoute } from '@mars-explorer/shared';
import { analyzeRoute, askAssistant, createBriefing, downloadBriefingPdf, getLayers, getPlaces, getRegion, suggestRoute } from '@/lib/api';
import SolClock from './SolClock';
import DemoTour from './DemoTour';
import { hasGoogleMapsKey } from '@/lib/load-google-maps';
import DetailModal from './ui/DetailModal';

const MarsMap = dynamic(() => import('./MarsMap'), { ssr: false, loading: () => <div className="map-loading">CONNECTING TO MARS TREK WMTS…</div> });
const GoogleMarsMap = dynamic(() => import('./GoogleMarsMap'), { ssr: false, loading: () => <div className="map-loading">CONNECTING GOOGLE SHELL TO NASA TREK…</div> });
const initialLayerIds = new Set<LayerId>(['imagery', 'pois']);

export default function ExploreConsole() {
  const [region, setRegion] = useState<RegionData | null>(null);
  const [catalog, setCatalog] = useState<MapLayer[]>([]);
  const [layers, setLayers] = useState<Set<LayerId>>(initialLayerIds);
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [mapMode, setMapMode] = useState<'global' | 'jezero'>('jezero');
  const [mapEngine, setMapEngine] = useState<'leaflet' | 'google'>('leaflet');
  const [mapView, setMapView] = useState<{lat:number;lon:number;zoom:number} | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [tab, setTab] = useState<'assistant' | 'briefing' | 'point'>('assistant');
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<RegionData['hazards'][number] | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [question, setQuestion] = useState('Why is this route scientifically interesting?');
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [briefing, setBriefing] = useState<MissionBriefing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [palette, setPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [useCloudModels, setUseCloudModels] = useState(false);
  const [coachStep, setCoachStep] = useState<number | null>(null);
  const [riskHelp, setRiskHelp] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'layers' | 'science' | 'assistant' | null>(null);
  const [routeNotice, setRouteNotice] = useState('');
  const [savedRoute, setSavedRoute] = useState<RouteWaypoint[] | null>(null);
  const [solLighting, setSolLighting] = useState(false);
  const [demoSeeds, setDemoSeeds] = useState(false);
  const [places, setPlaces] = useState<PlacesTrack | null>(null);
  const [selectedSol, setSelectedSol] = useState(0);
  const [showTrack, setShowTrack] = useState(true);
  const [suggestion, setSuggestion] = useState<SuggestedRoute | null>(null);

  useEffect(() => {
    Promise.all([getRegion(), getLayers(), getPlaces()]).then(([data, layerData, track]) => { setRegion(data); setCatalog(layerData); setPlaces(track); setSelectedSol(track.latestSol); const poiId = new URLSearchParams(window.location.search).get('poi'); const poi = data.pois.find((item) => item.id === poiId); if (poi) { setSelectedPoi(poi); setTab('point'); } }).catch((reason: Error) => setError(`${reason.message}. Start the API with pnpm dev.`));
    if (new URLSearchParams(window.location.search).get('demo') === 'true') setDemoSeeds(true);
    if (!localStorage.getItem('me_onboarded')) setCoachStep(0);
    try { const cached = JSON.parse(localStorage.getItem('me_saved_routes') || '[]') as Array<{ waypoints?: RouteWaypoint[] }>; setSavedRoute(cached[0]?.waypoints ?? null); } catch { setSavedRoute(null); }
    const shared = new URLSearchParams(window.location.search).get('wp');
    if (shared) {
      try {
        const points = JSON.parse(shared) as Array<{ lat: number; lon: number }>;
        if (points.length >= 2 && points.length <= 24 && points.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))) {
          setWaypoints(points.map((point) => ({ ...point, id: crypto.randomUUID() })));
        }
      } catch { setRouteNotice('SHARED ROUTE LINK IS INVALID'); }
    }
  }, []);

  useEffect(() => {
    if (waypoints.length < 2) { setAnalysis(null); return; }
    const timer = window.setTimeout(() => analyzeRoute(waypoints).then(setAnalysis).catch((reason: Error) => setError(reason.message)), 160);
    return () => window.clearTimeout(timer);
  }, [waypoints]);

  useEffect(() => { getRegion(demoSeeds).then((data)=>{setRegion(data); const poiId=new URLSearchParams(window.location.search).get('poi'); const poi=data.pois.find((item)=>item.id===poiId); if(poi){setSelectedPoi(poi);setTab('point');}}).catch((reason: Error) => setError(reason.message)); }, [demoSeeds]);
  const selectedTrackPoint = useMemo(() => places?.points.filter((p) => p.sol <= selectedSol).at(-1), [places, selectedSol]);
  const visibleTrack = useMemo(() => showTrack ? places?.points.filter((p) => p.sol <= selectedSol) ?? [] : [], [places, selectedSol, showTrack]);
  const addWaypoint = useCallback((point: RouteWaypoint) => setWaypoints((current) => [...current, point]), []);
  const toggleLayer = (id: LayerId) => setLayers((current) => { const next = new Set(current); if (['imagery','viking','hrsc-color','hrsc-shade'].includes(id)) { for (const base of ['imagery','viking','hrsc-color','hrsc-shade'] as LayerId[]) next.delete(base); next.add(id); } else next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectPoi = (poi: POI) => { setSelectedPoi(poi); setTab('point'); };
  const seedRoute = () => presetRoute('delta');
  const undo = () => setWaypoints((current) => current.slice(0, -1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteQuery(''); setPalette(true); return; }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === '?') setHelp((value) => !value);
      if (event.key.toLowerCase() === 'r') setDrawing((value) => !value);
      if (event.key.toLowerCase() === 'f') setFocusMode((value) => !value);
      if (event.key === 'Escape') { setHelp(false); setRiskHelp(false); setPalette(false); setMobilePanel(null); setDrawing(false); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') undo();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => { setSuggestion(null); }, [waypoints]);
  const metrics = useMemo(() => ({ distance: analysis?.distanceKm ?? 0, risk: analysis?.riskScore ?? 0, points: analysis?.nearbyPois.length ?? 0 }), [analysis]);
  async function submitQuestion(text = question) {
    if (!text.trim()) return;
    setBusy(true); setError('');
    try { setResponse(await askAssistant(text, waypoints, useCloudModels)); setTab('assistant'); setMobilePanel('assistant'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Assistant request failed.'); }
    finally { setBusy(false); }
  }
  async function makeBriefing() {
    if (waypoints.length < 2) { setError('Add at least two waypoints to create a mission briefing.'); return; }
    setBusy(true); setError('');
    try { setBriefing(await createBriefing(waypoints)); setTab('briefing'); setMobilePanel('assistant'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Briefing request failed.'); }
    finally { setBusy(false); }
  }
  function exportBriefing() {
    if (!briefing) return;
    const url = URL.createObjectURL(new Blob([briefing.markdown], { type: 'text/markdown' }));
    const link = document.createElement('a'); link.href = url; link.download = 'jezero-marswalk-briefing.md'; link.click(); URL.revokeObjectURL(url);
  }
  function presetRoute(preset: 'delta' | 'rim' | 'short') {
    if (!places?.points.length) { setError('NASA PLACES track is still loading.'); return; }
    const sols = preset === 'delta' ? [400, 420, 430] : preset === 'rim' ? [700, 750, 800] : [420, 430];
    const points = sols.map((sol) => places.points.reduce((closest, point) => Math.abs(point.sol - sol) < Math.abs(closest.sol - sol) ? point : closest));
    setMapMode('jezero'); setDrawing(false); setWaypoints(points.map((p) => ({ id: crypto.randomUUID(), lat: p.lat, lon: p.lon })));
    setRouteNotice(`NASA PLACES PUBLISHED LOCALIZATIONS · SOLS ${points.map((p) => p.sol).join(' / ')}`);
  }
  function finishCoach() { localStorage.setItem('me_onboarded', '1'); setCoachStep(null); }
  function saveRoute() {
    if (waypoints.length < 2) return;
    const saved = JSON.parse(localStorage.getItem('me_saved_routes') || '[]') as Array<{ savedAt: string; waypoints: RouteWaypoint[] }>;
    localStorage.setItem('me_saved_routes', JSON.stringify([{ savedAt: new Date().toISOString(), waypoints }, ...saved].slice(0, 5)));
    setSavedRoute(waypoints);
    setRouteNotice('ROUTE SAVED ON THIS DEVICE');
  }
  async function shareRoute() {
    if (waypoints.length < 2) return;
    const points = encodeURIComponent(JSON.stringify(waypoints.map(({ lat, lon }) => ({ lat, lon }))));
    const url = `${window.location.origin}/route/share?wp=${points}`;
    try { await navigator.clipboard.writeText(url); setRouteNotice('SHARE LINK COPIED'); }
    catch { window.prompt('Copy this route link', url); }
  }
  async function demoMarswalk() {
    if (!places?.points.length) { setError('NASA PLACES track is still loading.'); return; }
    const sols = [400, 420, 430];
    const route = sols.map((sol, index) => {
      const p = places.points.reduce((closest, point) => Math.abs(point.sol - sol) < Math.abs(closest.sol - sol) ? point : closest);
      return { id: `published-${index}`, lat: p.lat, lon: p.lon };
    });
    setUseCloudModels(false); setMapMode('jezero'); setDrawing(false); setWaypoints(route); setBusy(true); setError('');
    try {
      const [answer, note] = await Promise.all([askAssistant('Why is Jezero Crater scientifically interesting for this traverse?', route, false), createBriefing(route)]);
      setResponse(answer); setBriefing(note); setTab('briefing'); setRouteNotice('CLASSROOM MODE · NASA PLACES TRACK · LOCAL EVIDENCE');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Classroom Marswalk could not be prepared.'); }
    finally { setBusy(false); }
  }
  async function makeSuggestion() {
    if (waypoints.length !== 2) { setError('Place exactly two endpoints to suggest a corridor.'); return; }
    try { setSuggestion(await suggestRoute(waypoints)); setRouteNotice('SUGGESTED · NON-CERTIFYING · NASA DTM GRID'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No DTM corridor available.'); }
  }
  const currentStep = briefing ? 3 : response ? 2 : waypoints.length > 1 ? 1 : 0;
  const riskLabel = metrics.risk < 35 ? 'LOW' : metrics.risk < 70 ? 'WATCH' : 'HIGH';
  const closeToRoute = useMemo(() => new Set(analysis?.nearbyPois.map((poi) => poi.id) ?? []), [analysis]);
  const commandActions = [
    { label: 'Jump to Jezero', run: () => { setMapMode('jezero'); setFocusMode(false); } },
    { label: 'Load Delta traverse', run: () => presetRoute('delta') },
    { label: 'Load Crater rim route', run: () => presetRoute('rim') },
    { label: 'Load Short EVA', run: () => presetRoute('short') },
    { label: drawing ? 'Stop drawing route' : 'Draw route', run: () => setDrawing(!drawing) },
    { label: 'Ask mission assistant', run: () => { setTab('assistant'); setMobilePanel('assistant'); document.querySelector<HTMLTextAreaElement>('.ask-form textarea')?.focus(); } },
    { label: 'Open briefing', run: () => { setTab('briefing'); setMobilePanel('assistant'); } },
    { label: 'Open science verification', run: () => { window.location.href = '/science'; } },
  ];

  return <main className={`console-shell ${focusMode ? 'focus-mode' : ''}`}>
    <header className="console-header">
      <Link href="/" className="console-brand"><span className="brand-mark">M / E</span><span><strong>MARS EXPLORER</strong><small>FIELD SYSTEMS / 01</small></span></Link>
      <div className="header-location"><span className="status-dot" /> SURFACE OPERATIONS <b>/</b> JEZERO CRATER <SolClock /></div>
      <div className="header-actions"><Link className="console-tour-link" href="/mission">DEMO TOUR ↗</Link><span className="connection-label">NASA TREK <i>·</i> CONNECTED</span><button title="Search commands (Ctrl/Cmd+K)" aria-label="Open command palette" onClick={() => { setPaletteQuery(''); setPalette(true); }}><Search size={16} /></button><button title="Toggle focus mode (F)" aria-label="Toggle focus mode" onClick={() => setFocusMode(!focusMode)}>{focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button><button title="Keyboard shortcuts" aria-label="Keyboard shortcuts" onClick={() => setHelp(true)}><HelpCircle size={16} /></button></div>
    </header>

    <nav className="mission-stepper" aria-label="Mission workflow">{['Explore', 'Route', 'Analyze', 'Brief'].map((label, index) => <button key={label} className={currentStep === index ? 'active' : currentStep > index ? 'complete' : ''} onClick={() => { if (index === 0) { setMapMode('jezero'); setTab('assistant'); setMobilePanel(null); } if (index === 1) setDrawing(true); if (index === 2) { setTab('assistant'); setMobilePanel('assistant'); document.querySelector<HTMLTextAreaElement>('.ask-form textarea')?.focus(); } if (index === 3) { setTab('briefing'); setMobilePanel('assistant'); } }}><span>{index + 1}</span>{label}</button>)}</nav>
    <DemoTour active="/explore" />

    <div className="console-layout">
      <aside className={`left-rail ${mobilePanel ? `mobile-sheet-${mobilePanel}` : ''} ${mobilePanel === 'layers' || mobilePanel === 'science' ? 'mobile-sheet-open' : ''}`}>
        <div className="panel-heading"><span>01 / MISSION AREA</span><MapPin size={14} /></div>
        <div className="location-title"><span className="eyebrow">TARGET REGION</span><h1>Jezero<br />Crater</h1><p>18.44° N&nbsp;&nbsp; 77.45° E</p></div>
        <div className="mode-switch" aria-label="Map extent"><button className={mapMode === 'global' ? 'active' : ''} onClick={() => setMapMode('global')}>GLOBAL</button><button className={mapMode === 'jezero' ? 'active' : ''} onClick={() => setMapMode('jezero')}>JEZERO</button></div>

        <section className="rail-section"><div className="section-title"><span>DATA LAYERS</span><Layers3 size={13} /></div>
          <div className="layer-list">{catalog.map((layer) => <button key={layer.id} className="layer-row" onClick={() => toggleLayer(layer.id as LayerId)} aria-pressed={layers.has(layer.id as LayerId)}>
            <span className={`checkbox ${layers.has(layer.id as LayerId) ? 'checked' : ''}`} />
            <span className={`layer-swatch swatch-${layer.id}`} /><span className="layer-copy"><strong>{layer.id === 'pois' ? 'Science points' : layer.id === 'hazards' ? 'Terrain watch zones' : layer.name}</strong><small>{layer.id === 'imagery' ? 'MGS MOLA / GLOBAL' : layer.id === 'viking' ? 'VIKING / GLOBAL COLOR' : layer.id === 'hazards' ? 'ILLUSTRATIVE ONLY' : layer.id === 'hirise' ? 'NASA / USGS REFERENCES' : 'MARS 2020 / JEZERO'}</small><small className="layer-why">{layer.description}</small>{layer.id === 'hirise' && <small className="layer-source">NASA / USGS LINKS IN SCIENCE REGISTER</small>}</span>
          </button>)}</div>
          {!catalog.length && <p className="quiet-note">LOADING DATA CATALOG…</p>}
        </section>
        <section className="rail-section places-controls"><div className="section-title"><span>NASA PLACES · ROVER TRACK</span></div><label><input type="checkbox" checked={showTrack} onChange={(e) => setShowTrack(e.target.checked)} /> SHOW PUBLISHED TRACK</label><input type="range" aria-label="Perseverance sol" min={0} max={places?.latestSol ?? 1} value={selectedSol} onChange={(e) => setSelectedSol(Number(e.target.value))} /><p>SOL {selectedTrackPoint?.sol ?? '—'} · {selectedTrackPoint ? `${selectedTrackPoint.lat.toFixed(5)}° N, ${selectedTrackPoint.lon.toFixed(5)}° E` : 'NO LOCALIZATION'}</p><small>PLACES CSV provides sol and spacecraft clock, not UTC observation date.</small><a href={places?.sourceUrl ?? 'https://pds-geosciences.wustl.edu/missions/mars2020/places.htm'} target="_blank" rel="noreferrer">NASA PLACES SOURCE ↗</a>{selectedTrackPoint && <button onClick={() => window.dispatchEvent(new CustomEvent("mars-focus",{detail:selectedTrackPoint}))}>FOCUS SELECTED SOL ON MAP</button>}</section>
        <section className="rail-section"><div className="section-title"><span>TRAVERSE PRESETS</span><Route size={13} /></div><div className="preset-list"><button onClick={() => presetRoute('delta')}>Delta traverse</button><button onClick={() => presetRoute('rim')}>Crater rim</button><button onClick={() => presetRoute('short')}>Short EVA</button></div></section>
        <section className="rail-section"><label className="demo-toggle"><input type="checkbox" checked={demoSeeds} onChange={(e) => setDemoSeeds(e.target.checked)} /> SHOW DEMO SEEDS</label>{demoSeeds && <strong>DEMO · NOT NASA PRODUCT</strong>}</section>
        <section className="mission-stack"><strong>MISSION STACK</strong><p>NASA TREK · orbital base mosaic</p><p>PERSEVERANCE · mission context</p><p>HIRISE · curated orbital context</p><p>LOCAL CORPUS · cited science notes</p><p className="earth-label">EARTH / EONET · landing feed only</p></section>

        <section className="rail-section point-section"><div className="section-title"><span>SCIENCE CONTEXT</span><span className="row-count">{region?.pois.length ?? '—'} POINTS</span></div>
          <div className="poi-list">{region?.pois.map((poi, index) => <button className={`poi-row ${closeToRoute.has(poi.id) ? 'near-route' : ''}`} key={poi.id} onClick={() => selectPoi(poi)}><span className="poi-index">0{index + 1}</span><span><strong>{poi.name}</strong><small>{closeToRoute.has(poi.id) ? 'NEAR CURRENT ROUTE · ' : ''}{poi.sourceKind === 'DEMO' ? 'DEMO · NOT NASA PRODUCT' : 'NASA PLACES / VERIFIED LOCALIZATION'}</small></span><ArrowUpRight size={12} /></button>)}</div>
          <a className="source-link" href="https://science.nasa.gov/mission/mars-2020-perseverance/" target="_blank" rel="noreferrer">NASA MISSION SOURCE <ArrowUpRight size={12} /></a>
        </section>
        <section className="rail-section field-notes"><div className="section-title"><span>FIELD NOTES / METHOD</span><span className="row-count">04 NOTES</span></div>
          <details><summary>01 / Read the layer source</summary><p>MOLA shading and Viking color are NASA Trek raster context. Screen color is not a sampled route elevation or slope.</p></details>
          <details><summary>02 / Interpret a nearby point</summary><p>“Nearby” means within the route corridor. It does not mean reachable, validated, or the most valuable science stop.</p></details>
          <details><summary>03 / Read the risk badge</summary><p>NASA PLACES orbital DTM samples support a coarse slope estimate when the route is covered. Application weights and gaps remain non-certifying.</p></details>
          <details><summary>04 / Carry a source</summary><p>Ask a focused local corpus question, open the NASA source, and keep its caveat in the exported briefing.</p></details>
        </section>
        <div className="rail-footnote">DEMO POINTS ARE APPROXIMATE AND OFF BY DEFAULT.<br />NASA PLACES TRACK IS PUBLISHED LOCALIZATION.</div>
      </aside>

      <section className="map-workspace" aria-label="Interactive Mars map">
        <div className="map-topbar"><div className="map-breadcrumb"><span>PLANETARY SURFACE</span><span>/</span><strong>{mapMode === 'jezero' ? 'JEZERO QUADRANGLE' : 'MARS / GLOBAL'}</strong></div><div className="map-tools">
          <div className="map-engine-toggle" role="group" aria-label="Mars map viewer"><button className={mapEngine === 'leaflet' ? 'active' : ''} onClick={() => setMapEngine('leaflet')}>LEAFLET / TREK</button><button className={mapEngine === 'google' ? 'active' : ''} onClick={() => setMapEngine('google')} disabled={!hasGoogleMapsKey} title={hasGoogleMapsKey ? 'Google Maps shell with NASA Trek Mars imagery' : 'Configure the Google Maps browser key first'}>GOOGLE / TREK</button></div>
          <button className={drawing ? 'tool-button active' : 'tool-button'} onClick={() => setDrawing((value) => !value)} title="Toggle route drawing"><Route size={15} /><span>{drawing ? 'DRAWING' : 'DRAW ROUTE'}</span></button>
          <button className="icon-tool" onClick={undo} disabled={!waypoints.length} title="Undo last waypoint"><Undo2 size={15} /></button>
          <button className="icon-tool" onClick={() => { setWaypoints([]); setResponse(null); setBriefing(null); }} disabled={!waypoints.length} title="Clear route"><X size={15} /></button>
          <span className="tool-divider" />
          <button className="icon-tool" onClick={() => setMapMode('jezero')} title="Center on Jezero"><LocateFixed size={15} /></button>
          <button className={solLighting ? 'tool-button active' : 'tool-button'} onClick={() => setSolLighting(!solLighting)} title="Toggle illustrative Sol lighting">SOL</button>
        </div></div>
        <div className={`map-frame ${solLighting ? 'sol-lit' : ''}`}>
          {mapEngine === 'leaflet' ? <MarsMap mode={mapMode} layers={layers} pois={region?.pois ?? []} hazards={region?.hazards ?? []} footprints={region?.footprints ?? []} waypoints={waypoints} track={visibleTrack} trackPoint={showTrack ? selectedTrackPoint : undefined} suggestedPath={suggestion?.waypoints ?? []} drawing={drawing} onAdd={addWaypoint} onSelectPoi={selectPoi} onSelectHazard={setSelectedHazard} onViewChange={setMapView} /> : <GoogleMarsMap mode={mapMode} layers={layers} pois={region?.pois ?? []} hazards={region?.hazards ?? []} footprints={region?.footprints ?? []} waypoints={waypoints} track={visibleTrack} trackPoint={showTrack ? selectedTrackPoint : undefined} suggestedPath={suggestion?.waypoints ?? []} drawing={drawing} onAdd={addWaypoint} onSelectPoi={selectPoi} onSelectHazard={setSelectedHazard} onViewChange={setMapView} />}
          {visibleTrack.length > 2 && mapMode === 'jezero' && <TrackInset points={visibleTrack} selected={selectedTrackPoint} />}
          {mapMode === 'global' && <div className="global-callout"><span>REGIONAL FOCUS</span><strong>Jezero Crater</strong><button onClick={() => setMapMode('jezero')}>FLY TO SITE <ArrowUpRight size={13} /></button></div>}
          {drawing && <div className="drawing-hint"><Crosshair size={13} /> SELECT SURFACE TO PLACE WAYPOINT <span>ESC TO EXIT</span></div>}
          {!waypoints.length && !drawing && <div className="map-empty"><Crosshair size={13} /><span>NO ACTIVE TRAVERSE</span><button onClick={seedRoute}>LOAD PUBLISHED ROUTE <ArrowUpRight size={12} /></button><button onClick={() => void demoMarswalk()}>CLASSROOM MODE <ArrowUpRight size={12} /></button></div>}
          {mapEngine === 'leaflet' && <div className="map-controls"><button title="Zoom in" onClick={() => window.dispatchEvent(new CustomEvent('mars-zoom', { detail: 1 }))}><Plus size={15} /></button><button title="Zoom out" onClick={() => window.dispatchEvent(new CustomEvent('mars-zoom', { detail: -1 }))}><Minus size={15} /></button></div>}
          <div className="map-scale">MAP PROJECTION / EQUIRECTANGULAR</div>
        </div>
        <div className="map-coordinates" aria-label="Current Mars map center and zoom"><span>CENTER LAT&nbsp; {mapView ? `${Math.abs(mapView.lat).toFixed(5)}° ${mapView.lat < 0 ? 'S' : 'N'}` : '—'}</span><span>CENTER LON&nbsp; {mapView ? `${Math.abs(mapView.lon).toFixed(5)}° ${mapView.lon < 0 ? 'W' : 'E'}` : '—'}</span><span>ZOOM&nbsp; {mapView?.zoom ?? '—'}</span><span className="map-coord-right">LEFT CLICK TO ADD WAYPOINT WHEN ROUTE MODE IS ACTIVE</span></div>
        <section className="bottom-hud"><div className="hud-title"><span>ACTIVE TRAVERSE</span><small>{waypoints.length ? `${String(waypoints.length).padStart(2, '0')} WAYPOINTS` : 'AWAITING ROUTE'}</small></div>
          <div className="hud-metric"><span>DIST · DTM ELEV Δ</span><strong>{metrics.distance.toFixed(2)} <small>KM · {analysis?.elevationDeltaM == null ? "—" : `${analysis.elevationDeltaM.toFixed(0)} M`}</small></strong></div>
          <button className="hud-metric risk-metric" onClick={() => setRiskHelp(true)}><span>RISK INDEX</span><strong className={`risk-${riskLabel.toLowerCase()}`}>{waypoints.length > 1 ? `${String(metrics.risk).padStart(2, '0')}/100` : '—'} <small>{waypoints.length > 1 ? riskLabel : 'SCORE'}</small></strong></button>
          <div className="hud-metric"><span>POIS NEAR ROUTE</span><strong>{String(metrics.points).padStart(2, '0')} <small>POINTS</small></strong></div>
          <button className="brief-cta" onClick={makeBriefing} disabled={busy || waypoints.length < 2}><Sparkles size={14} /> GENERATE BRIEFING <ArrowUpRight size={13} /></button>
        </section>
        {waypoints.length > 1 && <div className="route-profile" aria-label="Route segment profile">{waypoints.slice(1).map((point, index) => {
          const previous = waypoints[index];
          const latScale = 59.17; const lonScale = latScale * Math.cos(previous.lat * Math.PI / 180);
          const segment = Math.hypot((point.lat - previous.lat) * latScale, (point.lon - previous.lon) * lonScale);
          return <span key={point.id}><small>SEG {String(index + 1).padStart(2, '0')}</small><strong>{segment.toFixed(2)} KM</strong><i style={{ width: `${Math.max(12, Math.min(100, segment * 11))}%` }} /></span>;
        })}</div>}
        <div className="route-actions"><button onClick={() => void makeSuggestion()} disabled={waypoints.length !== 2}>SUGGEST DTM CORRIDOR</button>{suggestion && <button onClick={() => setWaypoints(suggestion.waypoints)}>USE SUGGESTION · NON-CERTIFYING</button>}<button onClick={saveRoute} disabled={waypoints.length < 2}>SAVE ROUTE</button><button onClick={() => setWaypoints(savedRoute ?? [])} disabled={!savedRoute?.length}>RESTORE LAST SAVE</button><button onClick={() => void shareRoute()} disabled={waypoints.length < 2}>COPY SHARE LINK</button>{routeNotice && <span role="status">{routeNotice}</span>}</div>
        <div className="route-tip">{waypoints.length > 1 ? `${analysis?.terrainMethod?.toUpperCase() ?? 'HEURISTIC'} · NON-CERTIFYING. Check each source before interpreting this research sketch.` : 'Choose a published traverse or draw a route to compare distance and DTM coverage.'}</div>
      </section>

      <aside className={`right-rail ${mobilePanel === 'assistant' ? 'mobile-sheet-open mobile-sheet-assistant' : ''}`}>
        <div className="right-tabs"><button className={tab === 'assistant' ? 'selected' : ''} onClick={() => setTab('assistant')}>MISSION ASSISTANT</button><button className={tab === 'briefing' ? 'selected' : ''} onClick={() => setTab('briefing')}>BRIEFING</button></div>
        {tab === 'assistant' && <div className="assistant-pane">
          <div className="assistant-status"><span className="status-square" /> {busy ? 'RETRIEVING CORPUS…' : 'EVIDENCE MODE'} <span>LANGGRAPH / LOCAL CORPUS</span></div>
          <div className="evidence-cockpit"><strong>EVIDENCE COCKPIT</strong><div><span>ROUTE {analysis?.distanceKm.toFixed(2) ?? "—"} KM</span><span>RISK {analysis?.riskIndex.total ?? "—"}/100</span><span>DTM COVERAGE {analysis ? Math.round(analysis.dtmCoverage * 100) : "—"}%</span><span>{analysis?.terrainMethod?.toUpperCase() ?? "METHOD —"} · NON-CERTIFYING</span></div><small><a href={places?.sourceUrl ?? "https://pds-geosciences.wustl.edu/missions/mars2020/places.htm"} target="_blank" rel="noreferrer">NASA PLACES ↗</a> · <a href="https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars" target="_blank" rel="noreferrer">NASA TREK ↗</a> · <a href="https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_dem.xml" target="_blank" rel="noreferrer">NASA DTM ↗</a> · <a href="https://eonet.gsfc.nasa.gov/docs/v3" target="_blank" rel="noreferrer">EARTH / NASA EONET ↗</a></small>{analysis?.riskIndex.components.map((item) => <section className="risk-component" key={item.id}><div><span>{item.label}</span><strong>+{item.score}</strong></div><RiskSource source={item.source} /></section>)}{response?.citations.slice(0, 2).map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a>)}</div><div className="assistant-intro"><span className="eyebrow">MISSION SUPPORT / 01</span><h2>Field intelligence</h2><p>Ask about mission context, Jezero geology, or the active route. Responses use the cited local source notes.</p></div>
          <div className="prompt-label">SUGGESTED INQUIRY</div>
          <button className="suggestion" onClick={() => { setQuestion('Why is this route scientifically interesting?'); void submitQuestion('Why is this route scientifically interesting?'); }}>“Why is this route scientifically interesting?” <ArrowUpRight size={13} /></button>
          <button className="suggestion" onClick={() => { setQuestion('What are Perseverance’s mission objectives?'); void submitQuestion('What are Perseverance’s mission objectives?'); }}>“What are Perseverance’s mission objectives?” <ArrowUpRight size={13} /></button>
          <button className="suggestion" onClick={() => { setQuestion('Compare Earth natural-event monitoring (EONET) with Marswalk planning needs.'); void submitQuestion('Compare Earth natural-event monitoring (EONET) with Marswalk planning needs.'); }}>“Compare Earth EONET monitoring with Marswalk planning” <ArrowUpRight size={13} /></button>
          <label className="compare-toggle"><input type="checkbox" checked={useCloudModels} onChange={(event) => setUseCloudModels(event.target.checked)} /> Use cloud model (optional)</label>
          <div className="response-area">
            {busy && <div className="thinking-line"><span className="status-dot" /> {/earth|eonet|wildfire|storm|volcano|landslide|compare|analog|natural event/i.test(question) ? 'RETRIEVING CORPUS… CHECKING EARTH / EONET…' : 'RETRIEVING NASA SOURCE NOTES…'}</div>}
            {response && <article className="assistant-response"><div className="response-tag">{response.modelUsed.toUpperCase()} / {response.refused ? 'EVIDENCE INSUFFICIENT' : 'SOURCE GROUNDED'}{response.citations.some((citation) => citation.mission === 'EONET' || /eonet/i.test(citation.title)) && <span className="earth-source-tag"> · EARTH / EONET</span>}</div><p>{response.answer}</p>{response.comparison?.length ? <div className="model-compare">{response.comparison.map((item) => <section key={item.model}><strong>{item.model}</strong><p>{item.answer}</p></section>)}</div> : null}{response.citations.map((citation) => <button className="citation-row" key={`${citation.url}-${citation.title}`} onClick={() => { setSelectedCitation(citation); const linked = region?.pois.find((poi) => poi.sourceKind === 'NASA_PLACES' && poi.name === citation.title); if (linked) { setMapMode('jezero'); window.dispatchEvent(new CustomEvent('mars-focus', {detail: {lat: linked.lat, lon: linked.lon}})); } }}><span><strong>{citation.title}</strong><small>{citation.excerpt}</small></span><ArrowUpRight size={13} /></button>)}</article>}
            {!response && !busy && <div className="assistant-placeholder"><span>—</span><p>Responses are assembled from the local mission corpus and returned with source links.</p></div>}
          </div>
          <form className="ask-form" onSubmit={(event) => { event.preventDefault(); void submitQuestion(); }}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Ask the mission assistant" rows={2} placeholder="Ask a mission question…" /><button aria-label="Send question" disabled={busy || question.trim().length < 3}><Send size={15} /></button></form>
          <p className="assistant-disclaimer">LOCAL EVIDENCE IS RESEARCH CONTEXT, NOT FLIGHT OR SAFETY GUIDANCE.</p>
        </div>}
        {tab === 'briefing' && <div className="briefing-pane">
          {briefing ? <><div className="briefing-title"><span className="eyebrow">MISSION NOTE / JEZERO</span><h2>{briefing.title}</h2><div className="briefing-summary"><span>DISTANCE<strong>{briefing.distanceKm.toFixed(2)} KM</strong></span><span>WAYPOINTS<strong>{briefing.explorationPoints}</strong></span></div></div>
            <div className="briefing-section"><span>SCIENTIFIC OBJECTIVES</span>{briefing.scientificObjectives.map((item) => <p key={item}>{item}</p>)}</div>
            <div className="briefing-section"><span>TRAVERSE RISK INDEX · NON-CERTIFYING</span><p>{briefing.riskIndex.total}/100 · {briefing.riskIndex.method}</p>{briefing.riskIndex.components.map((item) => <p key={item.id}>{item.label}: +{item.score} · <RiskSource source={item.source} /></p>)}</div>
            <div className="briefing-section"><span>TERRAIN CONSIDERATIONS</span>{briefing.terrainConsiderations.map((item) => <p key={item}>{item}</p>)}</div>
            <div className="briefing-section"><span>NEARBY CONTEXT</span>{briefing.recommendedInvestigationPoints.length ? briefing.recommendedInvestigationPoints.map((item) => <p key={item}>{item}</p>) : <p>No verified science points are attached to this route.</p>}</div>
            <div className="briefing-section"><span>SOURCES</span>{briefing.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer">{citation.title} <ArrowUpRight size={12} /></a>)}</div>
            <div className="brief-export-actions"><button className="export-button" onClick={exportBriefing}><ArrowDownToLine size={14} /> EXPORT MARKDOWN</button><button className="export-button" onClick={() => void downloadBriefingPdf(waypoints).catch((reason: Error) => setError(reason.message))}><Printer size={14} /> SERVER PDF</button></div>
          </> : <div className="empty-briefing"><span className="eyebrow">MISSION NOTE / 01</span><h2>No briefing generated</h2><p>Sketch at least two waypoints, then generate a briefing from the traverse metrics.</p><button onClick={makeBriefing} disabled={busy || waypoints.length < 2}><Sparkles size={14} /> GENERATE BRIEFING</button></div>}
        </div>}
        {tab === 'point' && <div className="point-detail-pane">{selectedPoi ? <><div className="point-detail-head"><span className="eyebrow">SCIENCE REFERENCE / {selectedPoi.category.toUpperCase()}</span><button onClick={() => setTab('assistant')} aria-label="Close selected point"><X size={15} /></button></div><h2>{selectedPoi.name}</h2><p>{selectedPoi.summary}</p><dl><div><dt>APPROX. LAT</dt><dd>{selectedPoi.lat.toFixed(4)}° N</dd></div><div><dt>APPROX. LON</dt><dd>{selectedPoi.lon.toFixed(4)}° E</dd></div><div><dt>MISSION</dt><dd>{selectedPoi.mission}</dd></div></dl><a className="point-source" href={selectedPoi.sourceUrl} target="_blank" rel="noreferrer">OPEN NASA SOURCE <ArrowUpRight size={13} /></a><p className="approx-note">{selectedPoi.sourceKind === 'DEMO' ? 'DEMO · NOT NASA PRODUCT' : 'NASA PLACES INTERPOLATED LOCALIZATION. NOT LIVE.'}</p></> : <p>Select a science marker to inspect its source context.</p>}</div>}
      </aside>
    </div>
    <nav className="mobile-sheet-nav" aria-label="Mission panels"><button onClick={() => setMobilePanel(mobilePanel === 'layers' ? null : 'layers')}>LAYERS</button><button onClick={() => setMobilePanel(mobilePanel === 'science' ? null : 'science')}>SCIENCE DATA</button><button onClick={() => setMobilePanel(mobilePanel === 'assistant' ? null : 'assistant')}>ASSISTANT</button><button onClick={() => setMobilePanel(null)} aria-label="Close panel"><X size={15} /></button></nav>
    <footer className="console-footer"><span>DATA: NASA MARS TREK WMTS · MGS MOLA</span><span>ROUTE MODEL: SPHERICAL HAVERSINE / MARS R = 3,390 KM</span><span>NOT FOR OPERATIONAL NAVIGATION · <Link href="/science">SCIENCE & METHODS ↗</Link></span></footer>
    {error && <div className="toast" role="status">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button></div>}
    {help && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelp(false); }}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="help-close" onClick={() => setHelp(false)} aria-label="Close shortcuts"><X size={16} /></button><span className="eyebrow">FIELD SYSTEMS / CONTROLS</span><h2 id="help-title">Keyboard reference</h2><div><span>R</span><p>Toggle route drawing</p></div><div><span>F</span><p>Toggle map focus mode</p></div><div><span>⌘ / CTRL + K</span><p>Open command palette</p></div><div><span>⌘ / CTRL + Z</span><p>Undo last waypoint</p></div><div><span>?</span><p>Open this reference</p></div><div><span>ESC</span><p>Close reference</p></div></section></div>}
    {riskHelp && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRiskHelp(false); }}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="risk-title"><button className="help-close" onClick={() => setRiskHelp(false)} aria-label="Close risk explanation"><X size={16} /></button><span className="eyebrow">ROUTE ANALYSIS / NON-CERTIFYING</span><h2 id="risk-title">What the score means</h2><p>The score combines coarse DTM grid slope, route length, complexity, and missing coverage. Every weight is an application heuristic. Grid spacing is about 118 m and local hazards are unresolved. This is not a safety assessment.</p><div className="risk-legend"><span className="risk-low">0–34 / LOW</span><span className="risk-mid">35–69 / WATCH</span><span className="risk-high">70–100 / HIGH</span></div><Link href="/science" onClick={() => setRiskHelp(false)}>Open data and methods <ArrowUpRight size={13} /></Link></section></div>}
    {palette && <div className="modal-backdrop palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPalette(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette"><div><Search size={15} /><input autoFocus value={paletteQuery} placeholder="Search mission actions" onChange={(event) => setPaletteQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setPalette(false); if (event.key === 'Enter') event.currentTarget.closest('.command-palette')?.querySelector<HTMLButtonElement>('button')?.click(); }} /></div>{commandActions.filter((action) => action.label.toLowerCase().includes(paletteQuery.toLowerCase())).map((action) => <button key={action.label} onClick={() => { action.run(); setPalette(false); }}><span>{action.label}</span><ArrowUpRight size={13} /></button>)}{!commandActions.some((action) => action.label.toLowerCase().includes(paletteQuery.toLowerCase())) && <p className="palette-empty">NO ACTIONS FOUND</p>}</section></div>}
    {selectedPoi && <DetailModal title={selectedPoi.name} eyebrow="MARS / JEZERO · PUBLISHED OR DEMO POINT" summary={selectedPoi.summary} facts={[["CATEGORY", selectedPoi.category.toUpperCase()], ["APPROX. POINT", `${selectedPoi.lat.toFixed(4)}° N, ${selectedPoi.lon.toFixed(4)}° E`], ["STATUS", selectedPoi.sourceKind === 'DEMO' ? 'DEMO · NOT NASA PRODUCT' : 'NASA PLACES / PUBLISHED LOCALIZATION']]} sources={[{ title: selectedPoi.mission || 'NASA SOURCE', url: selectedPoi.sourceUrl }]} onClose={() => setSelectedPoi(null)} />}
    {selectedHazard && <DetailModal title={selectedHazard.name} eyebrow="MARS / JEZERO · ILLUSTRATIVE WATCH ZONE" summary="This seeded polygon is used by a non-certifying route heuristic. It is not an assessed EVA hazard." facts={[["SEVERITY", selectedHazard.severity.toUpperCase()], ["VERTICES", String(selectedHazard.coordinates.length)], ["STATUS", "LOCAL / NON-CERTIFYING"]]} sources={[{ title: 'NASA MARS TREK BASEMAP', url: 'https://trek.nasa.gov/mars/', note: 'NASA Trek supplies map imagery. The polygon itself is authored locally.' }]} onClose={() => setSelectedHazard(null)} />}
    {selectedCitation && <DetailModal title={selectedCitation.title} eyebrow={selectedCitation.mission === 'EONET' ? 'EARTH / EONET · ASSISTANT SOURCE' : 'MARS / ASSISTANT SOURCE'} summary={selectedCitation.excerpt} facts={[["SOURCE", selectedCitation.mission || 'NASA'], ["ROLE", "CITED EVIDENCE"]]} sources={[{ title: selectedCitation.title, url: selectedCitation.url }]} onClose={() => setSelectedCitation(null)} />}
    {coachStep !== null && <div className="coach-shade"><section className="coach-dialog" role="dialog" aria-modal="true"><span className="eyebrow">FIELD GUIDE / {coachStep + 1} OF 4</span><h2>{['Explore the site', 'Sketch a Marswalk', 'Ask with evidence', 'Issue a briefing'][coachStep]}</h2><p>{['Start with NASA Mars Trek imagery and the Jezero science context. Earth EONET events stay on the landing page.', 'Load a published PLACES route or draw a sketch. DTM coverage and the non-certifying Risk Index update with the waypoints.', 'Ask a mission question to retrieve local source notes. Cloud models require explicit opt-in and provider keys.', 'Generate the briefing from a route, review citations, then export Markdown or download a server PDF.'][coachStep]}</p><div><button onClick={finishCoach}>SKIP GUIDE</button><button onClick={() => coachStep === 3 ? finishCoach() : setCoachStep(coachStep + 1)}>{coachStep === 3 ? 'FINISH' : 'NEXT'}</button></div></section></div>}
  </main>;
}

function TrackInset({points,selected}:{points:PlacesTrack['points'];selected?:PlacesTrack['points'][number]}) {
  const minLat=Math.min(...points.map(p=>p.lat)), maxLat=Math.max(...points.map(p=>p.lat));
  const minLon=Math.min(...points.map(p=>p.lon)), maxLon=Math.max(...points.map(p=>p.lon));
  const sx=(lon:number)=>12+(lon-minLon)/(maxLon-minLon||1)*176;
  const sy=(lat:number)=>104-(lat-minLat)/(maxLat-minLat||1)*88;
  const line=points.map((p,i)=>`${i?'L':'M'}${sx(p.lon).toFixed(1)} ${sy(p.lat).toFixed(1)}`).join(' ');
  return <div className="track-inset" aria-label={`Published Perseverance track through sol ${selected?.sol ?? 'unknown'}`}><span>NASA PLACES / ROVER TRACK</span><svg viewBox="0 0 200 116" role="img" aria-label="Published interpolated rover localization path"><path d={line} fill="none" stroke="#fff" strokeWidth="2"/>{selected && <circle cx={sx(selected.lon)} cy={sy(selected.lat)} r="5" fill="#fff" stroke="#111" strokeWidth="2"/>}</svg><small>SOL {selected?.sol ?? '—'} · PUBLISHED INTERPOLATED</small></div>;
}

function RiskSource({source}:{source:string}) {
  return source.startsWith('https://')
    ? <a href={source} target="_blank" rel="noreferrer" title={source}>NASA PDS ORBITAL DEM ↗</a>
    : <span>{source}</span>;
}
