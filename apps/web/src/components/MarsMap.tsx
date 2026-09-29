'use client';

import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LayerId, POI, RouteWaypoint } from '@mars-explorer/shared';
import { JEZERO_CENTER, TREK_BASE_URL } from '@mars-explorer/shared';

function MapMotion({ mode, onAdd, drawing }: { mode: 'global' | 'jezero'; onAdd: (point: RouteWaypoint) => void; drawing: boolean }) {
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
  useMapEvents({ click(event) { if (drawing) onAdd({ id: crypto.randomUUID(), lat: Number(event.latlng.lat.toFixed(4)), lon: Number(event.latlng.lng.toFixed(4)) }); } });
  return null;
}

export default function MarsMap({ mode, layers, pois, hazards, footprints = [], waypoints, drawing, onAdd, onSelectPoi }: {
  mode: 'global' | 'jezero'; layers: Set<LayerId>; pois: POI[]; hazards: Array<{ id: string; name: string; severity: string; coordinates: Array<{ lat: number; lon: number }> }>;
  footprints?: Array<{ id: string; name: string; instrument: string; coordinates: Array<{ lat: number; lon: number }>; sourceUrl: string }>;
  waypoints: RouteWaypoint[]; drawing: boolean; onAdd: (point: RouteWaypoint) => void; onSelectPoi: (poi: POI) => void;
}) {
  const terrainStyle = useMemo(() => L.divIcon({ className: 'poi-pin', html: '<span></span>', iconSize: [12, 12], iconAnchor: [6, 6] }), []);
  return <MapContainer center={[JEZERO_CENTER.lat, JEZERO_CENTER.lon]} zoom={5} minZoom={1} maxZoom={8} crs={L.CRS.EPSG4326} zoomControl={false} attributionControl={false} className={drawing ? 'mars-map is-drawing' : 'mars-map'}>
    {layers.has('viking')
      ? <TileLayer url={`${TREK_BASE_URL}/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`} minZoom={0} maxZoom={8} noWrap />
      : layers.has('imagery') ? <TileLayer url={`${TREK_BASE_URL}/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`} minZoom={0} maxZoom={8} noWrap /> : null}
    <MapMotion mode={mode} onAdd={onAdd} drawing={drawing} />
    {layers.has('hazards') && hazards.map((hazard) => <Polygon key={hazard.id} positions={hazard.coordinates.map((point) => [point.lat, point.lon])} bubblingMouseEvents={false} pathOptions={{ color: '#B84A3A', weight: 1, fillColor: '#B84A3A', fillOpacity: .18, dashArray: '4 4' }}><Tooltip>{hazard.name} · illustrative only</Tooltip></Polygon>)}
    {layers.has('hirise') && footprints.map((footprint) => <Polygon key={footprint.id} positions={footprint.coordinates.map((point) => [point.lat, point.lon])} bubblingMouseEvents={false} pathOptions={{ color: '#E8DCC8', weight: 1, fillColor: '#E8DCC8', fillOpacity: .08, dashArray: '5 4' }}><Tooltip>{footprint.name} · curated context area · {footprint.instrument}</Tooltip></Polygon>)}
    {layers.has('pois') && pois.map((poi) => <CircleMarker key={poi.id} center={[poi.lat, poi.lon]} radius={6} bubblingMouseEvents={false} pathOptions={{ color: '#F2F0EA', weight: 1, fillColor: '#12161F', fillOpacity: 1 }} eventHandlers={{ click: () => onSelectPoi(poi) }}><Tooltip>{poi.name}</Tooltip></CircleMarker>)}
    {waypoints.length > 1 && <Polyline positions={waypoints.map((point) => [point.lat, point.lon])} pathOptions={{ color: '#C45C26', weight: 3 }} />}
    {waypoints.map((point, index) => <CircleMarker key={point.id} center={[point.lat, point.lon]} radius={6} pathOptions={{ color: '#0B0E14', weight: 2, fillColor: '#C45C26', fillOpacity: 1 }}><Tooltip>WP {String(index + 1).padStart(2, '0')}</Tooltip></CircleMarker>)}
  </MapContainer>;
}
