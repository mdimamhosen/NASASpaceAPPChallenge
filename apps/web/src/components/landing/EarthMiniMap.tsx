'use client';

import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import type { EarthEventSummary } from '@/lib/earth-types';
import 'leaflet/dist/leaflet.css';

export default function EarthMiniMap({ events }: { events: EarthEventSummary[] }) {
  const points = events.filter((event) => typeof event.lat === 'number' && typeof event.lon === 'number');
  return (
    <MapContainer center={[20, 0]} zoom={1} minZoom={1} maxZoom={6} scrollWheelZoom={false} className="earth-mini-map" attributionControl={false}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map((event) => (
        <CircleMarker
          key={event.id}
          center={[event.lat!, event.lon!]}
          radius={4}
          pathOptions={{ color: '#fff', weight: 1, fillColor: '#0a0a0a', fillOpacity: 1 }}
        >
          <Tooltip>{event.title}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
