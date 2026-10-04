'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DtmGrid, LatLon, PlacesPoint, POI } from '@mars-explorer/shared';
import { MARS_RADIUS_KM, TREK_BASE_URL } from '@mars-explorer/shared';

/** NASA Mars Trek Jezero landing-site orthomosaics (EPSG:4326 WMTS, 256 px tiles, CORS enabled). */
export const TERRAIN_IMAGERY = [
  { layer: 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0', zoom: 12, label: 'MRO CTX 6 m orthomosaic' },
  { layer: 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd', zoom: 13, label: 'MRO HiRISE 25 cm orthomosaic' },
] as const;
export const TREK_JEZERO_SOURCE = 'https://trek.nasa.gov/mars/';

export type Model = ReturnType<typeof buildModel>;
export type Bounds = { latMin: number; latMax: number; lonMin: number; lonMax: number };

export function buildModel(grid: DtmGrid) {
  const { latMin, lonMin, sampleSpacingDegrees: step, rows } = grid;
  const R = rows.length, C = rows[0].length;
  const latMax = latMin + (R - 1) * step, lonMax = lonMin + (C - 1) * step;
  const kmPerDeg = (Math.PI / 180) * MARS_RADIUS_KM;
  const dx = step * kmPerDeg * Math.cos((((latMin + latMax) / 2) * Math.PI) / 180), dy = step * kmPerDeg;
  const W = (C - 1) * dx, D = (R - 1) * dy;
  const valid = rows.flat().filter((v): v is number => v != null && Number.isFinite(v));
  const minElev = Math.min(...valid), maxElev = Math.max(...valid);
  const cell = (r: number, c: number) => rows[Math.min(R - 1, Math.max(0, r))][Math.min(C - 1, Math.max(0, c))] ?? minElev;
  /** Bilinear DEM elevation in metres (same interpolation as the API sampler, clamped at edges). */
  const elevationAt = (lat: number, lon: number) => {
    const y = Math.min(R - 1.0001, Math.max(0, (lat - latMin) / step)), x = Math.min(C - 1.0001, Math.max(0, (lon - lonMin) / step));
    const r = Math.floor(y), c = Math.floor(x), fy = y - r, fx = x - c;
    return (cell(r, c) * (1 - fx) + cell(r, c + 1) * fx) * (1 - fy) + (cell(r + 1, c) * (1 - fx) + cell(r + 1, c + 1) * fx) * fy;
  };
  const inside = (p: LatLon) => p.lat >= latMin && p.lat <= latMax && p.lon >= lonMin && p.lon <= lonMax;
  return { R, C, latMin, latMax, lonMin, lonMax, step, dx, dy, W, D, minElev, maxElev, cell, elevationAt, inside };
}

export const toWorld = (m: Model, p: LatLon, exaggeration: number, lift = 0): [number, number, number] => [
  ((p.lon - m.lonMin) / m.step) * m.dx - m.W / 2,
  ((m.elevationAt(p.lat, p.lon) - m.minElev) / 1000) * exaggeration + lift,
  m.D / 2 - ((p.lat - m.latMin) / m.step) * m.dy,
];

/** Densify a polyline so it drapes over relief instead of cutting through it. */
export function drape(m: Model, points: LatLon[], exaggeration: number, lift: number) {
  const out: [number, number, number][] = [];
  points.forEach((b, i) => {
    if (!i) { out.push(toWorld(m, b, exaggeration, lift)); return; }
    const a = points[i - 1];
    const n = Math.max(1, Math.ceil(Math.hypot((b.lat - a.lat) / m.step, (b.lon - a.lon) / m.step) * 3));
    for (let k = 1; k <= n; k++) out.push(toWorld(m, { lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((b.lon - a.lon) * k) / n }, exaggeration, lift));
  });
  return out;
}

/** Stitch NASA Trek tiles covering the bounds into one canvas texture; tiles paint in as they arrive. */
export function useTrekTexture({ latMin, latMax, lonMin, lonMax }: Bounds) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    const finest = Math.max(...TERRAIN_IMAGERY.map((l) => l.zoom));
    const ppd = 256 / (180 / 2 ** finest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((lonMax - lonMin) * ppd);
    canvas.height = Math.round((latMax - latMin) * ppd);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    setTexture(tex);
    let cancelled = false;
    // Layers draw in order so HiRISE covers CTX wherever HiRISE has data (transparent PNG elsewhere).
    (async () => {
      for (const { layer, zoom } of TERRAIN_IMAGERY) {
        const span = 180 / 2 ** zoom;
        const jobs: Promise<void>[] = [];
        for (let row = Math.floor((90 - latMax) / span); row <= Math.floor((90 - latMin) / span); row++) {
          for (let col = Math.floor((lonMin + 180) / span); col <= Math.floor((lonMax + 180) / span); col++) {
            jobs.push(new Promise<void>((resolve) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                if (!cancelled) {
                  const x = (col * span - 180 - lonMin) * ppd, y = (latMax - (90 - row * span)) * ppd, size = span * ppd;
                  ctx.drawImage(img, x, y, size, size);
                  tex.needsUpdate = true;
                  setLoaded((n) => n + 1);
                }
                resolve();
              };
              img.onerror = () => resolve();
              img.src = `${TREK_BASE_URL}/${layer}/1.0.0/default/default028mm/${zoom}/${row}/${col}.png`;
            }));
          }
        }
        await Promise.all(jobs);
        if (cancelled) return;
      }
    })();
    return () => { cancelled = true; tex.dispose(); };
  }, [latMin, latMax, lonMin, lonMax]);
  return { texture, loaded };
}

function Terrain({ m, exaggeration, texture, onHover }: { m: Model; exaggeration: number; texture: THREE.Texture | null; onHover: (p: { lat: number; lon: number; elevationM: number } | null) => void }) {
  const { surface, skirt } = useMemo(() => {
    const surface = new THREE.PlaneGeometry(m.W, m.D, m.C - 1, m.R - 1);
    const pos = surface.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const i = Math.floor(k / m.C), j = k % m.C; // i = 0 is the northern edge
      pos.setZ(k, ((m.cell(m.R - 1 - i, j) - m.minElev) / 1000) * exaggeration);
    }
    surface.rotateX(-Math.PI / 2);
    surface.computeVertexNormals();
    // Side walls down to a base give the tile a physical "terrain model" read.
    const base = -0.25;
    const ring: number[] = [];
    for (let j = 0; j < m.C; j++) ring.push(j);
    for (let i = 1; i < m.R; i++) ring.push(i * m.C + m.C - 1);
    for (let j = m.C - 2; j >= 0; j--) ring.push((m.R - 1) * m.C + j);
    for (let i = m.R - 2; i >= 0; i--) ring.push(i * m.C);
    const verts: number[] = [];
    const top = (k: number) => [surface.attributes.position.getX(k), surface.attributes.position.getY(k), surface.attributes.position.getZ(k)];
    for (let n = 0; n < ring.length - 1; n++) {
      const [ax, ay, az] = top(ring[n]), [bx, by, bz] = top(ring[n + 1]);
      verts.push(ax, ay, az, bx, by, bz, ax, base, az, bx, by, bz, bx, base, bz, ax, base, az);
    }
    const skirt = new THREE.BufferGeometry();
    skirt.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    skirt.computeVertexNormals();
    return { surface, skirt };
  }, [m, exaggeration]);
  useEffect(() => () => { surface.dispose(); skirt.dispose(); }, [surface, skirt]);
  return (
    <group>
      <mesh
        geometry={surface}
        receiveShadow
        onPointerMove={(e) => {
          const lon = m.lonMin + ((e.point.x + m.W / 2) / m.dx) * m.step, lat = m.latMin + ((m.D / 2 - e.point.z) / m.dy) * m.step;
          onHover({ lat, lon, elevationM: m.elevationAt(lat, lon) });
        }}
        onPointerOut={() => onHover(null)}
      >
        <meshStandardMaterial map={texture} color={texture ? '#ffffff' : '#555'} roughness={0.95} metalness={0} />
      </mesh>
      <mesh geometry={skirt}><meshStandardMaterial color="#1b1e25" roughness={1} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[m.W, m.D]} /><meshBasicMaterial color="#0d0f14" side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

type Label = { key: string; position: [number, number, number]; text: string; tone: string; height: number };

function Pin({ label }: { label: Label }) {
  return (
    <group position={label.position}>
      <mesh position={[0, label.height / 2, 0]}><cylinderGeometry args={[0.008, 0.008, label.height, 6]} /><meshBasicMaterial color={label.tone} /></mesh>
      <mesh position={[0, label.height, 0]}><sphereGeometry args={[0.035, 12, 12]} /><meshBasicMaterial color={label.tone} /></mesh>
    </group>
  );
}

export type ScreenLabel = { key: string; text: string; tone: string; at: () => [number, number, number] };

/** Projects 3D anchors to screen space each frame and moves plain DOM labels (avoids drei Html's nested React roots). */
export function LabelProjector({ labels, nodes }: { labels: ScreenLabel[]; nodes: React.MutableRefObject<Map<string, HTMLSpanElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const label of labels) {
      const node = nodes.current.get(label.key);
      if (!node) continue;
      v.set(...label.at()).project(camera);
      node.style.display = v.z > 1 ? 'none' : 'block';
      node.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -100%)`;
    }
  });
  return null;
}

/** DOM side of LabelProjector; render outside the Canvas. */
export function LabelLayer({ labels, nodes }: { labels: ScreenLabel[]; nodes: React.MutableRefObject<Map<string, HTMLSpanElement>> }) {
  return (
    <div className="terrain-labels" aria-hidden>
      {labels.map((label) => <span key={label.key} className="terrain-label" style={{ borderColor: label.tone }} ref={(node) => { if (node) nodes.current.set(label.key, node); else nodes.current.delete(label.key); }}>{label.text}</span>)}
    </div>
  );
}

function FlyCamera({ path, active, onDone }: { path: [number, number, number][]; active: boolean; onDone: () => void }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const t = useRef(0);
  const curve = useMemo(() => (path.length > 1 ? new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p))) : null), [path]);
  useEffect(() => { if (active) t.current = 0; }, [active]);
  useFrame((_, delta) => {
    if (!active || !curve) return;
    t.current = Math.min(1, t.current + delta / Math.max(8, curve.getLength() * 1.6));
    const here = curve.getPointAt(t.current), ahead = curve.getPointAt(Math.min(1, t.current + 0.04));
    const back = here.clone().sub(ahead).setY(0).normalize().multiplyScalar(0.9);
    camera.position.lerp(here.clone().add(back).add(new THREE.Vector3(0, 0.55, 0)), 0.08);
    camera.lookAt(ahead);
    if (t.current >= 1) {
      controls?.target.copy(ahead);
      controls?.update();
      onDone();
    }
  });
  return null;
}

export type TerrainView3DProps = {
  grid: DtmGrid;
  waypoints?: LatLon[];
  suggestedPath?: LatLon[];
  track?: PlacesPoint[];
  trackPoint?: PlacesPoint;
  pois?: POI[];
  showcase?: boolean;
};

export default function TerrainView3D({ grid, waypoints = [], suggestedPath = [], track = [], trackPoint, pois = [], showcase = false }: TerrainView3DProps) {
  const m = useMemo(() => buildModel(grid), [grid]);
  const [exaggeration, setExaggeration] = useState(3);
  const [flying, setFlying] = useState(false);
  const { texture, loaded } = useTrekTexture(m);

  const readout = useRef<HTMLSpanElement>(null);
  const routeLine = useMemo(() => (waypoints.length > 1 ? drape(m, waypoints, exaggeration, 0.03) : []), [m, waypoints, exaggeration]);
  const suggestionLine = useMemo(() => (suggestedPath.length > 1 ? drape(m, suggestedPath, exaggeration, 0.035) : []), [m, suggestedPath, exaggeration]);
  const trackLine = useMemo(() => {
    const inside = track.filter(m.inside);
    return inside.length > 1 ? drape(m, inside, exaggeration, 0.02) : [];
  }, [m, track, exaggeration]);
  const flyPath = routeLine.length > 1 ? routeLine : trackLine;
  const visiblePois = useMemo(() => pois.filter((p) => m.inside(p) && p.sourceKind !== 'DEMO'), [m, pois]);
  const labelNodes = useRef(new Map<string, HTMLSpanElement>());
  const labels = useMemo<Label[]>(() => [
    ...(trackPoint && m.inside(trackPoint) ? [{ key: 'rover', position: toWorld(m, trackPoint, exaggeration), text: `PERSEVERANCE · SOL ${trackPoint.sol} · PLACES`, tone: '#ffffff', height: 0.6 }] : []),
    ...(visiblePois.map((p) => ({ key: p.id, position: toWorld(m, p, exaggeration), text: p.name.toUpperCase(), tone: '#9a9ea6', height: 0.35 }))),
  ], [m, trackPoint, exaggeration, visiblePois]);
  const screenLabels = useMemo<ScreenLabel[]>(() => labels.map((l) => ({ key: l.key, text: l.text, tone: l.tone, at: () => [l.position[0], l.position[1] + l.height + 0.06, l.position[2]] })), [labels]);

  const onHover = (p: { lat: number; lon: number; elevationM: number } | null) => {
    if (readout.current) readout.current.textContent = p ? `${p.lat.toFixed(4)}°N  ${p.lon.toFixed(4)}°E  ·  ${p.elevationM.toFixed(0)} M` : 'HOVER TERRAIN FOR DEM ELEVATION';
  };

  return (
    <div className={`terrain-3d ${showcase ? 'is-showcase' : ''}`}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, m.W * 0.62, m.W * 0.92], fov: 38, near: 0.01, far: 200 }} gl={{ antialias: true }}>
        <color attach="background" args={['#07090d']} />
        <fog attach="fog" args={['#07090d', m.W * 1.1, m.W * 3]} />
        <hemisphereLight args={['#f2efe8', '#1a1410', 0.55]} />
        {/* Low western sun is illustrative lighting to read relief; it is not a modelled solar position. */}
        <directionalLight position={[-m.W, m.D * 0.6, -m.D * 0.3]} intensity={1.6} color="#fff6ea" />
        <Terrain m={m} exaggeration={exaggeration} texture={texture} onHover={onHover} />
        {trackLine.length > 1 && <Line points={trackLine} color="#f2f0ea" lineWidth={2.2} />}
        {suggestionLine.length > 1 && <Line points={suggestionLine} color="#ffffff" lineWidth={1.6} dashed dashSize={0.08} gapSize={0.06} />}
        {routeLine.length > 1 && <Line points={routeLine} color="#C45C26" lineWidth={3.2} />}
        {waypoints.filter(m.inside).map((w, i) => (
          <mesh key={`${w.lat}-${w.lon}-${i}`} position={toWorld(m, w, exaggeration, 0.04)}><sphereGeometry args={[0.04, 14, 14]} /><meshBasicMaterial color="#C45C26" /></mesh>
        ))}
        {labels.map((label) => <Pin key={label.key} label={label} />)}
        <LabelProjector labels={screenLabels} nodes={labelNodes} />
        <Grid position={[0, -0.26, 0]} args={[m.W * 4, m.W * 4]} cellSize={0.5} cellThickness={0.5} cellColor="#1c2029" sectionSize={2.5} sectionThickness={1} sectionColor="#2a303c" fadeDistance={m.W * 2.5} infiniteGrid />
        <OrbitControls makeDefault enabled={!flying} enableDamping autoRotate={showcase && !flying} autoRotateSpeed={0.35} maxPolarAngle={Math.PI / 2.15} minDistance={1} maxDistance={m.W * 2.2} />
        <FlyCamera path={flyPath} active={flying} onDone={() => setFlying(false)} />
      </Canvas>
      <LabelLayer labels={screenLabels} nodes={labelNodes} />
      <div className="terrain-hud terrain-hud-top">
        <span>JEZERO · 3D DEM VIEW</span>
        <span>{m.W.toFixed(1)} × {m.D.toFixed(1)} KM · ×{exaggeration} VERTICAL</span>
      </div>
      <div className="terrain-hud terrain-hud-bottom">
        {!showcase && <span ref={readout}>HOVER TERRAIN FOR DEM ELEVATION</span>}
        <span className="terrain-badge">SAMPLED DEM · ILLUSTRATIVE LIGHTING · NON-CERTIFYING</span>
      </div>
      {!showcase && (
        <div className="terrain-controls">
          <label>EXAGGERATION ×{exaggeration}<input type="range" min={1} max={6} step={1} value={exaggeration} onChange={(e) => setExaggeration(Number(e.target.value))} /></label>
          <button onClick={() => setFlying((f) => !f)} disabled={flyPath.length < 2}>{flying ? 'STOP' : routeLine.length > 1 ? 'FLY ROUTE' : 'FLY PERSEVERANCE TRACK'}</button>
        </div>
      )}
      <div className="terrain-credit">
        IMAGERY: NASA/JPL-CALTECH/UARIZONA/MSSS · MRO HIRISE 25 CM + CTX 6 M ORTHOMOSAICS VIA <a href={TREK_JEZERO_SOURCE} target="_blank" rel="noreferrer">NASA MARS TREK ↗</a> · ELEVATION: <a href={grid.labelUrl} target="_blank" rel="noreferrer">MARS 2020 PLACES ORBITAL DEM ↗</a>{loaded === 0 ? ' · LOADING TILES…' : ''}
      </div>
    </div>
  );
}
