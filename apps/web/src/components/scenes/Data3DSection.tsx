'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { DtmGrid, LatLon, PlacesTrack, POI } from '@mars-explorer/shared';
import { getDtmGrid, getPlaces, getRegion } from '@/lib/api';

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

export type Data3DVariant = 'terrain' | 'cube' | 'stack' | 'orbit' | 'sites' | 'planets' | 'columns' | 'slope' | 'pillars' | 'curtain' | 'card';
/** Variants that need no data from this wrapper (bundled constants, props, or their own request). */
const STATIC: Data3DVariant[] = ['orbit', 'sites', 'planets', 'curtain', 'card'];
const NEEDS_GRID: Data3DVariant[] = ['terrain', 'stack', 'columns', 'slope'];

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
    Promise.all([NEEDS_GRID.includes(variant) ? getDtmGrid() : null, getPlaces(), showPois || variant === 'stack' || variant === 'pillars' ? getRegion() : null])
      .then(([g, p, r]) => { setGrid(g); setPlaces(p); setPois(r?.pois ?? []); })
      .catch((reason: Error) => setError(reason.message));
  }, [visible, variant, showPois]);

  const latest = places?.points.at(-1);
  const facts: Array<[string, string]> = variant === 'columns'
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
    ? [['TRACK', places ? `PLACES · ${places.points.length} samples · sols 0–${latest?.sol}` : 'PLACES best_interp'], ['GROUND', 'MRO HiRISE 25 cm · CTX 6 m'], ['VERTICAL', 'Sol (mission time)'], ['STATUS', 'Published localization · not live telemetry']]
    : variant === 'stack'
      ? [['LAYER 01', 'PLACES orbital DEM · ~118 m grid'], ['LAYER 02', 'Trek HiRISE 25 cm + CTX 6 m'], ['LAYER 03', 'PLACES localizations + verified locations'], ['STATUS', 'Non-certifying research aid']]
      : [['IMAGERY', 'MRO HiRISE 25 cm · CTX 6 m'], ['ELEVATION', 'PLACES orbital DEM · ~118 m grid'], ['TRACK', latest ? `PLACES sols 0–${latest.sol} · portion inside tile` : 'PLACES best_interp'], ['VERTICAL', '×3 exaggeration · non-certifying']];

  const ready = STATIC.includes(variant) || (places && (!NEEDS_GRID.includes(variant) || grid));
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
