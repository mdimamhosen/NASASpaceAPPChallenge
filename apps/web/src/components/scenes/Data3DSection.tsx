'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { DtmGrid, LatLon, MarsHardware, PlacesTrack, POI, RegionData } from '@mars-explorer/shared';
import { getDtmGrid, getHardware, getMissionData, getPlaces, getRegion, getValidation, type ValidationReport } from '@/lib/api';

const loading = () => <div className="map-loading">BUILDING 3D SCENE FROM NASA DATA…</div>;
const TerrainView3D = dynamic(() => import('./TerrainView3D'), { ssr: false, loading });
const TraverseCube3D = dynamic(() => import('./TraverseCube3D'), { ssr: false, loading });
const DataStack3D = dynamic(() => import('./DataStack3D'), { ssr: false, loading });
const OrbitNow3D = dynamic(() => import('./OrbitNow3D'), { ssr: false, loading });
const MarsSites3D = dynamic(() => import('./MarsSites3D'), { ssr: false, loading });
const PlanetPair3D = dynamic(() => import('./PlanetPair3D'), { ssr: false, loading });
const DemColumns3D = dynamic(() => import('./DemColumns3D'), { ssr: false, loading });
const SlopeField3D = dynamic(() => import('./SlopeField3D'), { ssr: false, loading });
const TrackPillars3D = dynamic(() => import('./TrackPillars3D'), { ssr: false, loading });
const RouteCurtain3D = dynamic(() => import('./RouteCurtain3D'), { ssr: false, loading });
const CardFlip3D = dynamic(() => import('./CardFlip3D'), { ssr: false, loading });
const SuitabilityTerrain3D = dynamic(() => import('./SuitabilityTerrain3D'), { ssr: false, loading });
const SwimIce3D = dynamic(() => import('./SwimIce3D'), { ssr: false, loading });
const SunDome3D = dynamic(() => import('./SunDome3D'), { ssr: false, loading });
const SeasonRing3D = dynamic(() => import('./SeasonRing3D'), { ssr: false, loading });
const EvaRibbon3D = dynamic(() => import('./EvaRibbon3D'), { ssr: false, loading });
const ConjunctionOrbit3D = dynamic(() => import('./ConjunctionOrbit3D'), { ssr: false, loading });
const SlopeHistogram3D = dynamic(() => import('./SlopeHistogram3D'), { ssr: false, loading });
const CorridorCompare3D = dynamic(() => import('./CorridorCompare3D'), { ssr: false, loading });
const HardwareGlobe3D = dynamic(() => import('./HardwareGlobe3D'), { ssr: false, loading });
const HiriseSlabs3D = dynamic(() => import('./HiriseSlabs3D'), { ssr: false, loading });
const IauLabels3D = dynamic(() => import('./IauLabels3D'), { ssr: false, loading });
const AgentGraph3D = dynamic(() => import('./AgentGraph3D'), { ssr: false, loading });
const IngenuityFlights3D = dynamic(() => import('./IngenuityFlights3D'), { ssr: false, loading });
const SampleDepot3D = dynamic(() => import('./SampleDepot3D'), { ssr: false, loading });
const EdlDescent3D = dynamic(() => import('./EdlDescent3D'), { ssr: false, loading });
const LosRay3D = dynamic(() => import('./LosRay3D'), { ssr: false, loading });

export type Data3DVariant = 'terrain' | 'cube' | 'stack' | 'orbit' | 'sites' | 'planets' | 'columns' | 'slope' | 'pillars' | 'curtain' | 'card'
  | 'suitability' | 'swim' | 'sun' | 'season' | 'eva' | 'conjunction' | 'slopehist' | 'corridor' | 'hardware' | 'hirise' | 'iau' | 'agent' | 'ingenuity' | 'samples' | 'edl' | 'los';
/** Variants that need no data from this wrapper (bundled constants, props, or their own request). */
const STATIC: Data3DVariant[] = ['orbit', 'sites', 'planets', 'curtain', 'card', 'sun', 'season', 'conjunction', 'hirise', 'iau', 'agent', 'edl'];
const NEEDS_GRID: Data3DVariant[] = ['terrain', 'stack', 'columns', 'slope', 'suitability', 'eva', 'corridor', 'ingenuity', 'los'];
/** Variants whose extra data (beyond grid/track) is loaded by this wrapper. */
const EXTRA: Partial<Record<Data3DVariant, () => Promise<unknown>>> = {
  suitability: () => getRegion(), swim: () => getRegion(), slopehist: () => getValidation(), hardware: () => getHardware(),
  ingenuity: () => getMissionData('ingenuity'), samples: () => getMissionData('samples'),
};
const NO_TRACK: Data3DVariant[] = ['swim', 'slopehist', 'hardware', 'samples', 'ingenuity'];

/**
 * A lazily mounted, data-driven 3D section. WebGL and NASA tile requests start only when the section
 * nears the viewport, so pages can carry one without slowing first paint.
 */
export default function Data3DSection({ variant, eyebrow, title, body, cta, waypoints, showPois = false, showRover = true, card }: {
  variant: Data3DVariant;
  eyebrow: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
  waypoints?: LatLon[];
  showPois?: boolean;
  showRover?: boolean;
  card?: { svg: string; km: number; count: number };
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [grid, setGrid] = useState<DtmGrid | null>(null);
  const [places, setPlaces] = useState<PlacesTrack | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [extra, setExtra] = useState<unknown>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: '250px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || STATIC.includes(variant)) return;
    Promise.all([NEEDS_GRID.includes(variant) ? getDtmGrid() : null, NO_TRACK.includes(variant) ? null : getPlaces(), showPois || variant === 'stack' || variant === 'pillars' ? getRegion() : null, EXTRA[variant]?.() ?? null])
      .then(([g, p, r, x]) => { setGrid(g); setPlaces(p); setPois(r?.pois ?? (x as RegionData | null)?.pois ?? []); setExtra(x); })
      .catch((reason: Error) => setError(reason.message));
  }, [visible, variant, showPois]);

  const latest = places?.points?.at(-1);
  // Default route for EVA / line-of-sight scenes: the published landing and sol-400 localizations.
  const at = (sol: number) => places?.points?.reduce((b, p) => (Math.abs(p.sol - sol) < Math.abs(b.sol - sol) ? p : b));
  const route = waypoints && waypoints.length > 1 ? waypoints : places?.points?.length ? [at(0)!, at(400)!] : [];
  const NEW_FACTS: Partial<Record<Data3DVariant, Array<[string, string]>>> = {
    suitability: [['SCORE', 'Slope · roughness · elevation · science · driven ground'], ['GRID', 'PLACES DEM · ~118 m'], ['BEACONS', 'Five best sites ≥500 m apart'], ['STATUS', 'Non-certifying research aid']],
    swim: [['SOURCE', 'SWIM 2.0 composite C_i, 0–1 m'], ['PIXEL', '3 km · ±3° around Jezero'], ['COLOUR', 'Blue consistent with ice · brown not'], ['STATUS', 'Non-certifying']],
    sun: [['ALGORITHM', 'NASA GISS Mars24'], ['SITE', 'Perseverance landing, Jezero'], ['PATH', 'Sun altitude/azimuth over today’s sol'], ['UPDATES', 'Every 30 s']],
    season: [['ORBIT', 'a 1.524 AU · e 0.0934'], ['PERIHELION', 'Ls 251°'], ['DUST SEASON', 'Ls 180–330 (climatology)'], ['NOW', 'Mars24 solar longitude']],
    eva: [['ROUTE', 'Your waypoints on the PLACES DEM'], ['SPEED', '2 km/h Tobler slope model'], ['DOSE', 'Curiosity RAD 0.67 mSv/day'], ['STATUS', 'Non-certifying']],
    conjunction: [['POSITIONS', 'JPL approximate elements'], ['BLACKOUT', 'Sun within 3° of Mars from Earth'], ['RANGE', '2020–2031'], ['CHECKED', 'Against NASA 2021 and 2023 moratoria']],
    slopehist: [['SOURCE', '/validation/report'], ['COMPARE', 'Real drive vs seeded random lines'], ['DEM', 'PLACES ~118 m grid'], ['STATUS', 'Non-certifying']],
    corridor: [['WHITE', 'Published PLACES drive'], ['ORANGE', 'Slope-weighted A* corridor'], ['LEGS', 'Sols 0–400, 400–700, 700–1000'], ['STATUS', 'Non-certifying']],
    hardware: [['SPACECRAFT', 'Every NASA lander, rover, helicopter'], ['POSITIONS', 'NSSDCA + PDS PLACES'], ['SCRUB', 'Year slider: arrival and last contact'], ['TEXTURE', 'NASA Viking mosaic']],
    hirise: [['INDEX', 'MRO HiRISE DTM (data.nasa.gov)'], ['AREA', '±1° around Jezero'], ['HEIGHT', 'Finer post spacing stacks higher'], ['NOTE', 'Footprints only; not sampled']],
    iau: [['NAMES', 'IAU/USGS Gazetteer'], ['AREA', '±3° around Jezero'], ['SIZE', 'Ring = feature diameter'], ['NOTE', 'Centre points, not boundaries']],
    agent: [['NODES', 'Live /agent/tools catalogue'], ['RUN', 'Streams a real agent run'], ['LIGHTS', 'Each tool the planner called'], ['CHECK', 'Numbers gated by provenance']],
    ingenuity: [['FLIGHTS', '72 (NASA Mars 2020 map layer)'], ['TRACK', 'Ground tracks on the PLACES DEM'], ['ARCH', 'Display only — no altitude in layer'], ['SCRUB', 'Flight slider']],
    samples: [['TUBES', 'NASA Mars 2020 rock samples page'], ['ROWS', 'Three Forks depot vs on rover'], ['FILL', 'Published core height'], ['CLICK', 'Any tube for its record']],
    edl: [['ATMOSPHERE', 'ρ0 0.020 kg/m³ · H 11.1 km'], ['MODEL', 'Allen–Eggers ballistic entry'], ['ENTRY', '5.4 km/s at 15.5°'], ['STATUS', 'Non-certifying']],
    los: [['FROM', 'Perseverance landing (PLACES sol 0)'], ['TO', 'Sol 400 localization'], ['MASTS', '2 m each end'], ['STATUS', 'Non-certifying, no Fresnel zone']],
  };
  const facts: Array<[string, string]> = NEW_FACTS[variant] ? NEW_FACTS[variant]! : variant === 'columns'
    ? [['SAMPLES', '4,512 DEM cells · one column each'], ['SPACING', '0.002° · ~118 m'], ['HEIGHT', 'Measured elevation · ×4'], ['STATUS', 'Non-certifying research aid']]
    : variant === 'slope'
      ? [['SOURCE', 'PLACES orbital DEM'], ['DERIVED', 'Grid slope · central differences'], ['ORANGE', '≥15° · Risk Index slope term saturates'], ['LIMIT', 'Cannot resolve rocks or local hazards']]
    : variant === 'pillars'
      ? [['HEIGHT', 'Published PLACES elevation column'], ['PILLARS', 'Sampled records along the traverse'], ['ORANGE', 'NASA-verified PLACES locations'], ['STATUS', 'Published localization · not live']]
    : variant === 'curtain'
      ? [['SAMPLES', 'DEM points from /routes/analyze'], ['COLOR', 'Sampled slope bands'], ['VERTICAL', '×8 relative to distance'], ['STATUS', 'Non-certifying research aid']]
    : variant === 'card'
      ? [['OBJECT', 'This page’s 1200 × 630 SVG card'], ['FRONT', 'Route plotted from the shared link'], ['BACK', 'Distance and waypoint count'], ['STATUS', 'Research sketch · non-certifying']]
    : variant === 'orbit'
    ? [['POSITIONS', 'NASA JPL approximate Keplerian elements'], ['MARKERS', 'Earth at launch · Mars at landing'], ['READOUT', 'Distance · one-way light time'], ['STATUS', 'Geometry only · not a trajectory']]
    : variant === 'sites'
      ? [['SITES', 'Nine NASA landings, 1976–2021'], ['COORDINATES', 'NSSDCA · Perseverance from PLACES sol 0'], ['TEXTURE', 'NASA/JPL-Caltech Viking mosaic'], ['TOUR', 'Chronological · click any site']]
      : variant === 'planets'
        ? [['SCALE', 'True relative radius'], ['TILT', 'Earth 23.44° · Mars 25.19°'], ['SPIN', 'True sidereal day ratio'], ['VALUES', 'NASA Planetary Fact Sheet']]
        : variant === 'cube'
    ? [['TRACK', places?.points ? `PLACES · ${places.points.length} samples · sols 0–${latest?.sol}` : 'PLACES best_interp'], ['GROUND', 'MRO HiRISE 25 cm · CTX 6 m'], ['VERTICAL', 'Sol (mission time)'], ['STATUS', 'Published localization · not live telemetry']]
    : variant === 'stack'
      ? [['LAYER 01', 'PLACES orbital DEM · ~118 m grid'], ['LAYER 02', 'Trek HiRISE 25 cm + CTX 6 m'], ['LAYER 03', 'PLACES localizations + verified locations'], ['STATUS', 'Non-certifying research aid']]
      : [['IMAGERY', 'MRO HiRISE 25 cm · CTX 6 m'], ['ELEVATION', 'PLACES orbital DEM · ~118 m grid'], ['TRACK', latest ? `PLACES sols 0–${latest.sol} · portion inside tile` : 'PLACES best_interp'], ['VERTICAL', '×3 exaggeration · non-certifying']];

  const ready = STATIC.includes(variant) || ((NO_TRACK.includes(variant) || places?.points?.length) && (!NEEDS_GRID.includes(variant) || grid) && (!EXTRA[variant] || extra));
  return (
    <section className="data3d" aria-label={title}>
      <div className="data3d-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{body}</p>
        <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {cta && <Link href={cta.href} className="enter-button">{cta.label} <span>↗</span></Link>}
      </div>
      <div className="data3d-stage" ref={stage}>
        {error ? <div className="map-loading">3D SCENE UNAVAILABLE · API OFFLINE</div>
          : !ready ? <div className="map-loading">{visible ? 'LOADING NASA DATA…' : 'JEZERO · 3D'}</div>
          : variant === 'sun' ? <SunDome3D />
          : variant === 'season' ? <SeasonRing3D />
          : variant === 'conjunction' ? <ConjunctionOrbit3D />
          : variant === 'hirise' ? <HiriseSlabs3D />
          : variant === 'iau' ? <IauLabels3D />
          : variant === 'agent' ? <AgentGraph3D />
          : variant === 'edl' ? <EdlDescent3D />
          : variant === 'swim' ? ((extra as RegionData).resources?.swimIce ? <SwimIce3D layer={(extra as RegionData).resources!.swimIce!.layers['0-1m']} label="0–1 M" /> : <div className="map-loading">SWIM SNAPSHOT MISSING · RUN scripts/refresh-swim-ice.py</div>)
          : variant === 'slopehist' ? <SlopeHistogram3D report={extra as ValidationReport} />
          : variant === 'hardware' ? <HardwareGlobe3D items={extra as MarsHardware[]} />
          : variant === 'samples' ? <SampleDepot3D {...(extra as { tubes: never[]; source: string })} />
          : variant === 'ingenuity' ? <IngenuityFlights3D grid={grid!} {...(extra as { flights: never[]; source: string })} />
          : variant === 'eva' ? <EvaRibbon3D grid={grid!} waypoints={route} />
          : variant === 'los' ? (route.length > 1 ? <LosRay3D grid={grid!} a={route[0]} b={route.at(-1)!} /> : null)
          : variant === 'suitability' ? <SuitabilityTerrain3D grid={grid!} pois={pois} track={places?.points ?? []} />
          : variant === 'corridor' ? <CorridorCompare3D grid={grid!} track={places?.points ?? []} />
          : variant === 'orbit' ? <OrbitNow3D />
          : variant === 'sites' ? <MarsSites3D />
          : variant === 'planets' ? <PlanetPair3D />
          : variant === 'curtain' ? (waypoints && waypoints.length > 1 ? <RouteCurtain3D waypoints={waypoints} /> : null)
          : variant === 'card' ? (card ? <CardFlip3D {...card} /> : null)
          : variant === 'columns' ? <DemColumns3D grid={grid!} />
          : variant === 'slope' ? <SlopeField3D grid={grid!} />
          : !places ? null
          : variant === 'cube' ? <TraverseCube3D track={places} />
          : variant === 'pillars' ? <TrackPillars3D track={places} pois={pois} />
          : variant === 'stack' ? <DataStack3D grid={grid!} track={places} pois={pois} />
          : <TerrainView3D grid={grid!} track={places.points} trackPoint={showRover ? latest : undefined} pois={pois} waypoints={waypoints} showcase />}
      </div>
    </section>
  );
}
