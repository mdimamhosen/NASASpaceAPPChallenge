'use client';
import { useEffect, useRef, useState } from 'react';
import { JEZERO_CENTER, TREK_BASE_URL } from '@mars-explorer/shared';
import type { LayerId, POI, RouteWaypoint } from '@mars-explorer/shared';
import { loadGoogleMaps } from '@/lib/load-google-maps';

type Props = {
  mode: 'global' | 'jezero'; layers: Set<LayerId>; pois: POI[];
  hazards: Array<{ id: string; name: string; severity: string; coordinates: Array<{ lat: number; lon: number }> }>;
  footprints: Array<{ id: string; name: string; instrument: string; coordinates: Array<{ lat: number; lon: number }> }>;
  waypoints: RouteWaypoint[]; drawing: boolean;
  onAdd: (point: RouteWaypoint) => void; onSelectPoi: (poi: POI) => void;
};

function trekType(maps: typeof google.maps, layer: 'viking' | 'imagery' | 'none') {
  const layerName = layer === 'viking' ? 'Mars_Viking_MDIM21_ClrMosaic_global_232m' : 'Mars_MGS_MOLA_ClrShade_merge_global_463m';
  const mapType = new maps.ImageMapType({
    tileSize: new maps.Size(256, 256), minZoom: 1, maxZoom: 8, name: 'NASA Trek Mars',
    getTileUrl(coord, zoom) {
      if (layer === 'none' || coord.x < 0 || coord.x >= 2 ** (zoom + 1) || coord.y < 0 || coord.y >= 2 ** zoom) return '';
      return `${TREK_BASE_URL}/${layerName}/1.0.0/default/default028mm/${zoom}/${coord.y}/${coord.x}.jpg`;
    },
  });
  // NASA Trek EQ tiles use the same equirectangular grid as Leaflet EPSG:4326:
  // two horizontal tiles and one vertical tile at zoom 0.
  mapType.projection = {
    fromLatLngToPoint(latLng) { const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng; const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat; return new maps.Point((lng + 180) * 256 / 180, (90 - lat) * 256 / 180); },
    fromPointToLatLng(point) { return new maps.LatLng(90 - point.y * 180 / 256, point.x * 180 / 256 - 180, true); },
  };
  return mapType;
}

export default function GoogleMarsMap({ mode, layers, pois, hazards, footprints, waypoints, drawing, onAdd, onSelectPoi }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const callbacks = useRef({ drawing, onAdd, onSelectPoi });
  callbacks.current = { drawing, onAdd, onSelectPoi };
  const [status, setStatus] = useState('Loading Google Maps shell and NASA Trek tiles…');
  useEffect(() => {
    let active = true;
    let click: google.maps.MapsEventListener | undefined;
    loadGoogleMaps().then((maps) => {
      if (!active || !node.current) return;
      const instance = new maps.Map(node.current, { center: { lat: JEZERO_CENTER.lat, lng: JEZERO_CENTER.lon }, zoom: 5, minZoom: 1, maxZoom: 8, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'cooperative', backgroundColor: '#111' });
      map.current = instance;
      instance.mapTypes.set('mars-trek', trekType(maps, 'imagery'));
      instance.setMapTypeId('mars-trek');
      click = instance.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (!callbacks.current.drawing || !event.latLng) return;
        callbacks.current.onAdd({ id: crypto.randomUUID(), lat: Number(event.latLng.lat().toFixed(4)), lon: Number(event.latLng.lng().toFixed(4)) });
      });
      setStatus('');
    }).catch((reason: Error) => { if (active) setStatus(`${reason.message} Use LEAFLET / TREK in the map toolbar.`); });
    return () => { active = false; click?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    instance.panTo(mode === 'jezero' ? { lat: JEZERO_CENTER.lat, lng: JEZERO_CENTER.lon } : { lat: 20, lng: 0 });
    instance.setZoom(mode === 'jezero' ? 5 : 2);
  }, [mode, status]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || status) return;
    const layer = layers.has('viking') ? 'viking' : layers.has('imagery') ? 'imagery' : 'none';
    instance.mapTypes.set('mars-trek', trekType(window.google.maps, layer));
    instance.setMapTypeId('mars-trek');
  }, [layers, status]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || status) return;
    const maps = window.google.maps;
    const shapes: Array<google.maps.Marker | google.maps.Polyline | google.maps.Polygon> = [];
    if (layers.has('pois')) pois.forEach((poi) => {
      const marker = new maps.Marker({ map: instance, position: { lat: poi.lat, lng: poi.lon }, title: `${poi.name} / approximate`, icon: { path: maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#eee', fillOpacity: 1, strokeColor: '#111', strokeWeight: 2 } });
      marker.addListener('click', () => callbacks.current.onSelectPoi(poi)); shapes.push(marker);
    });
    if (layers.has('hazards')) hazards.forEach((hazard) => shapes.push(new maps.Polygon({ map: instance, paths: hazard.coordinates.map((point) => ({ lat: point.lat, lng: point.lon })), strokeColor: '#ddd', strokeOpacity: .9, strokeWeight: 1, fillColor: '#aaa', fillOpacity: .2 })));
    if (layers.has('hirise')) footprints.forEach((footprint) => shapes.push(new maps.Polygon({ map: instance, paths: footprint.coordinates.map((point) => ({ lat: point.lat, lng: point.lon })), strokeColor: '#fff', strokeOpacity: .7, strokeWeight: 1, fillOpacity: 0 })));
    if (waypoints.length > 1) shapes.push(new maps.Polyline({ map: instance, path: waypoints.map((point) => ({ lat: point.lat, lng: point.lon })), strokeColor: '#eee', strokeWeight: 3 }));
    waypoints.forEach((point, i) => shapes.push(new maps.Marker({ map: instance, position: { lat: point.lat, lng: point.lon }, title: `WP ${i + 1}`, icon: { path: maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#fff', fillOpacity: 1, strokeColor: '#111', strokeWeight: 2 } })));
    return () => shapes.forEach((shape) => shape.setMap(null));
  }, [layers, pois, hazards, footprints, waypoints, status]);
  return <div className="google-mars-wrap"><div ref={node} className="mars-map" role="img" aria-label="Google Maps shell displaying NASA Mars Trek tiles and Mars-only route annotations" />{status && <div className="map-loading">{status}</div>}<div className="google-mars-credit">MARS IMAGERY / NASA TREK · GOOGLE MAPS SHELL · NO EONET</div></div>;
}
