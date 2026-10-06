'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HiriseDtm, LayerId, MarsFeature, MissionLanding, POI, RegionData, RouteWaypoint, PlacesPoint } from '@mars-explorer/shared';
import { JEZERO_CENTER, TREK_BASE_URL } from '@mars-explorer/shared';
import { getHiriseDtms, getLandings, getMarsFeatures } from '@/lib/api';

export type OpenDataSelection = { kind: 'feature'; feature: MarsFeature } | { kind: 'dtm'; dtm: HiriseDtm } | { kind: 'landing'; landing: MissionLanding };

/** data.nasa.gov overlays: IAU names and HiRISE DTM footprints are fetched for the current view; landings once. */
function OpenDataOverlays({ names, dtm, landings, drawing, onSelect, onStatus }: { names: boolean; dtm: boolean; landings: boolean; drawing: boolean; onSelect: (s: OpenDataSelection) => void; onStatus?: (text: string) => void }) {
  const map = useMap();
  const [features, setFeatures] = useState<MarsFeature[]>([]);
  const [footprints, setFootprints] = useState<HiriseDtm[]>([]);
  const [sites, setSites] = useState<MissionLanding[]>([]);
  const seq = useRef(0);
  const refresh = useCallback(() => {
    const b = map.getBounds(); const zoom = map.getZoom(); const id = ++seq.current;
    const box = { south: Math.max(-90, b.getSouth()), north: Math.min(90, b.getNorth()), west: b.getWest(), east: b.getEast() };
    // Out-of-order responses from an earlier view are dropped.
    if (names) getMarsFeatures(box, zoom).then((f) => { if (id === seq.current) setFeatures(f); }).catch(() => onStatus?.('IAU NAMES UNAVAILABLE · API'));
    if (dtm) getHiriseDtms(box).then((d) => { if (id === seq.current) setFootprints(d); }).catch(() => onStatus?.('HIRISE DTM INDEX UNAVAILABLE · API'));
  }, [map, names, dtm, onStatus]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (landings && !sites.length) getLandings().then(setSites).catch(() => onStatus?.('LANDING SITES UNAVAILABLE · API')); }, [landings, sites.length, onStatus]);
  useMapEvents({ moveend: refresh });
  // While drawing, overlays must not swallow clicks meant for waypoints. Leaflet reads `interactive` only at creation.
  const live = drawing ? 'draw' : 'pick';
  return <>
    {dtm && footprints.map((d) => <Polygon key={`${d.id}-${live}`} positions={d.corners} interactive={!drawing} bubblingMouseEvents={false} pathOptions={{ color: '#E8DCC8', weight: 1, fillColor: '#E8DCC8', fillOpacity: .06, dashArray: '3 3' }} eventHandlers={{ click: () => onSelect({ kind: 'dtm', dtm: d }) }}><Tooltip sticky>HIRISE DTM · {d.scaleM.toFixed(0)} M · {d.rationale}</Tooltip></Polygon>)}
    {names && features.map((f) => <CircleMarker key={`${f.id}-${live}`} center={[f.lat, f.lon]} radius={2} interactive={!drawing} bubblingMouseEvents={false} pathOptions={{ color: '#C9C5BB', weight: 1, fillColor: '#C9C5BB', fillOpacity: 1 }} eventHandlers={{ click: () => onSelect({ kind: 'feature', feature: f }) }}><Tooltip permanent direction="right" offset={[4, 0]} className="iau-label">{f.name}</Tooltip></CircleMarker>)}
    {landings && sites.map((site) => <CircleMarker key={`${site.name}-${live}`} center={[site.lat, site.lon]} radius={7} interactive={!drawing} bubblingMouseEvents={false} pathOptions={{ color: '#C45C26', weight: 2, fillColor: '#0B0E14', fillOpacity: 1 }} eventHandlers={{ click: () => onSelect({ kind: 'landing', landing: site }) }}><Tooltip direction="top" className="landing-label">{site.year} · {site.name} · {site.datasetCount} DATA.NASA.GOV DATASETS</Tooltip></CircleMarker>)}
  </>;
}

function MapMotion({ mode, onAdd, drawing, onViewChange }: { mode: 'global' | 'jezero'; onAdd: (point: RouteWaypoint) => void; drawing: boolean; onViewChange: (view: {lat:number;lon:number;zoom:number}) => void }) {
  const map = useMap();
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    map.flyTo(mode === 'global' ? [20, 0] : [JEZERO_CENTER.lat, JEZERO_CENTER.lon], mode === 'global' ? 2 : 5, { duration: 1.2 });
  }, [map, mode]);
  useEffect(() => {
    const zoom = (event: Event) => { const change = (event as CustomEvent<number>).detail; change > 0 ? map.zoomIn() : map.zoomOut(); };
    window.addEventListener('mars-zoom', zoom); return () => window.removeEventListener('mars-zoom', zoom);
  }, [map]);
  useEffect(() => { const focus = (event: Event) => { const p = (event as CustomEvent<{lat:number;lon:number}>).detail; map.flyTo([p.lat,p.lon], 9); }; window.addEventListener('mars-focus', focus); return () => window.removeEventListener('mars-focus', focus); }, [map]);
  useEffect(() => { const center = map.getCenter(); onViewChange({lat:center.lat,lon:center.lng,zoom:map.getZoom()}); }, [map,onViewChange]);
  useMapEvents({
    click(event) { if (drawing) onAdd({ id: crypto.randomUUID(), lat: Number(event.latlng.lat.toFixed(4)), lon: Number(event.latlng.lng.toFixed(4)) }); },
    moveend(event) { const current = event.target as L.Map; const center = current.getCenter(); onViewChange({lat:center.lat,lon:center.lng,zoom:current.getZoom()}); },
    zoomend(event) { const current = event.target as L.Map; const center = current.getCenter(); onViewChange({lat:center.lat,lon:center.lng,zoom:current.getZoom()}); },
  });
  return null;
}

export default function MarsMap({ mode, layers, pois, hazards, waypoints, track, trackPoint, suggestedPath, drawing, onAdd, onSelectPoi, onSelectHazard, onViewChange, onSelectOpenData = () => {}, onOverlayStatus }: {
  mode: 'global' | 'jezero'; layers: Set<LayerId>; pois: POI[]; hazards: Array<{ id: string; name: string; severity: string; coordinates: Array<{ lat: number; lon: number }> }>;
  footprints?: Array<{ id: string; name: string; instrument: string; coordinates: Array<{ lat: number; lon: number }>; sourceUrl: string }>;
  waypoints: RouteWaypoint[]; track: PlacesPoint[]; trackPoint?: PlacesPoint; suggestedPath: RouteWaypoint[]; drawing: boolean; onAdd: (point: RouteWaypoint) => void; onSelectPoi: (poi: POI) => void; onSelectHazard: (hazard: RegionData['hazards'][number]) => void; onViewChange: (view: {lat:number;lon:number;zoom:number}) => void;
  onSelectOpenData?: (selection: OpenDataSelection) => void; onOverlayStatus?: (text: string) => void;
}) {
  return <MapContainer center={[JEZERO_CENTER.lat, JEZERO_CENTER.lon]} zoom={5} minZoom={1} maxZoom={10} crs={L.CRS.EPSG4326} zoomControl={false} attributionControl={false} className={drawing ? 'mars-map is-drawing' : 'mars-map'}>
    {(['viking','hrsc-color','hrsc-shade','imagery'] as const).filter((id)=>layers.has(id)).slice(0,1).map((id) => <TileLayer key={id} url={`${TREK_BASE_URL}/${({viking:'Mars_Viking_MDIM21_ClrMosaic_global_232m','hrsc-color':'Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw','hrsc-shade':'Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw',imagery:'Mars_MGS_MOLA_ClrShade_merge_global_463m'} as const)[id]}/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`} minZoom={0} maxZoom={10} maxNativeZoom={id.startsWith('hrsc') ? 8 : 7} noWrap />)}
    <MapMotion mode={mode} onAdd={onAdd} drawing={drawing} onViewChange={onViewChange} />
    {layers.has('hazards') && hazards.map((hazard) => <Polygon key={hazard.id} positions={hazard.coordinates.map((point) => [point.lat, point.lon])} bubblingMouseEvents={false} pathOptions={{ color: '#B84A3A', weight: 1, fillColor: '#B84A3A', fillOpacity: .18, dashArray: '4 4' }} eventHandlers={{ click: () => onSelectHazard(hazard as RegionData['hazards'][number]) }}><Tooltip>{hazard.name} · illustrative only</Tooltip></Polygon>)}
    <OpenDataOverlays names={layers.has('names')} dtm={layers.has('hirise')} landings={layers.has('landings')} drawing={drawing} onSelect={onSelectOpenData} onStatus={onOverlayStatus} />
    {layers.has('pois') && pois.map((poi) => <CircleMarker key={poi.id} center={[poi.lat, poi.lon]} radius={6} bubblingMouseEvents={false} pathOptions={{ color: '#F2F0EA', weight: 1, fillColor: '#12161F', fillOpacity: 1 }} eventHandlers={{ click: () => onSelectPoi(poi) }}><Tooltip>{poi.name} · {poi.sourceKind === 'DEMO' ? 'DEMO / NOT NASA PRODUCT' : 'NASA PLACES'}</Tooltip></CircleMarker>)}
    {track.length > 1 && <Polyline positions={track.map((p) => [p.lat,p.lon])} pathOptions={{color:'#111',weight:5,opacity:.95}} />}
    {track.length > 1 && <Polyline positions={track.map((p) => [p.lat,p.lon])} pathOptions={{color:'#f2f2ef',weight:2,opacity:1}}><Tooltip>NASA PLACES · published interpolated rover localization</Tooltip></Polyline>}
    {trackPoint && <CircleMarker center={[trackPoint.lat,trackPoint.lon]} radius={8} pathOptions={{color:'#fff',weight:2,fillColor:'#151515',fillOpacity:1}}><Tooltip>PERSEVERANCE · SOL {trackPoint.sol} · NASA PLACES</Tooltip></CircleMarker>}
    {suggestedPath.length > 1 && <Polyline positions={suggestedPath.map((p) => [p.lat,p.lon])} pathOptions={{color:'#f9f9f9',weight:2,dashArray:'5 7'}}><Tooltip>SUGGESTED · NON-CERTIFYING</Tooltip></Polyline>}
    {waypoints.length > 1 && <Polyline positions={waypoints.map((point) => [point.lat, point.lon])} pathOptions={{ color: '#C45C26', weight: 3 }} />}
    {waypoints.map((point, index) => <CircleMarker key={point.id} center={[point.lat, point.lon]} radius={6} pathOptions={{ color: '#0B0E14', weight: 2, fillColor: '#C45C26', fillOpacity: 1 }}><Tooltip>WP {String(index + 1).padStart(2, '0')}</Tooltip></CircleMarker>)}
  </MapContainer>;
}
