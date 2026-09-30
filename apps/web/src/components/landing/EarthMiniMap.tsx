'use client';

import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import type { EarthEventSummary } from '@/lib/earth-types';
import { eonetColor } from '@/lib/eonet-colors';
import 'leaflet/dist/leaflet.css';

export default function EarthMiniMap({ events, onSelect }: { events: EarthEventSummary[]; onSelect?: (id: string) => void }) {
  const points = events.filter((event) => typeof event.lat === 'number' && typeof event.lon === 'number');
  return (
    <MapContainer center={[20, 0]} zoom={1} minZoom={1} maxZoom={6} scrollWheelZoom={false} className="earth-mini-map" attributionControl>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      {points.map((event) => (
        <CircleMarker
          key={event.id}
          center={[event.lat!, event.lon!]}
          radius={7}
          pathOptions={{ color: '#0a0a0a', weight: 1, fillColor: eonetColor(event.categoryId), fillOpacity: 1 }}
          eventHandlers={onSelect ? { click: () => onSelect(event.id) } : undefined}
        >
          <Tooltip>{event.title}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
