'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { EarthEventSummary } from '@/lib/earth-types';
import { hasGoogleMapsKey, loadGoogleMaps } from '@/lib/load-google-maps';
import { eonetColor } from '@/lib/eonet-colors';

const EarthMiniMap = dynamic(() => import('./landing/EarthMiniMap'), {
  ssr: false,
  loading: () => <div className="earth-mini-map earth-mini-map-loading">LOADING EARTH MAP…</div>,
});

export default function EonetEarthMap({ events, onSelect }: { events: EarthEventSummary[]; onSelect?: (id: string) => void }) {
  const node = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<'idle' | 'google' | 'leaflet'>('idle');
  const [status, setStatus] = useState(hasGoogleMapsKey ? 'Loading Google Maps…' : 'Using OpenStreetMap fallback. Add NEXT_PUBLIC_GOOGLE_MAP_API_KEY for Google Earth tiles.');

  useEffect(() => {
    if (!hasGoogleMapsKey) {
      setEngine('leaflet');
      setStatus('');
      return;
    }
    if (!node.current) return;

    let active = true;
    const markers: google.maps.Marker[] = [];
    let authTimer: number | undefined;

    loadGoogleMaps()
      .then((maps) => {
        if (!active || !node.current) return;
        const map = new maps.Map(node.current, {
          center: { lat: 12, lng: 0 },
          zoom: 2,
          mapTypeId: 'roadmap',
          gestureHandling: 'cooperative',
          streetViewControl: false,
          fullscreenControl: false,
        });

        events
          .filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lon))
          .forEach((event) => {
            const marker = new maps.Marker({
              map,
              position: { lat: event.lat!, lng: event.lon! },
              title: `EARTH / EONET — ${event.title}`,
              icon: { path: maps.SymbolPath.CIRCLE, scale: 7, fillColor: eonetColor(event.categoryId), fillOpacity: 1, strokeColor: '#111', strokeWeight: 1 },
            });
            marker.addListener('click', () => onSelect?.(event.id));
            markers.push(marker);
          });

        authTimer = window.setTimeout(() => {
          if (!active || !node.current) return;
          if (node.current.querySelector('.gm-err-container')) {
            setEngine('leaflet');
            setStatus('Google Maps unavailable for this key — showing OpenStreetMap fallback.');
          }
        }, 2500);

        setEngine('google');
        setStatus('');
      })
      .catch((reason: Error) => {
        if (!active) return;
        setEngine('leaflet');
        setStatus(`${reason.message} Showing OpenStreetMap fallback.`);
      });

    return () => {
      active = false;
      if (authTimer !== undefined) window.clearTimeout(authTimer);
      markers.forEach((marker) => marker.setMap(null));
    };
  }, [events, onSelect]);

  return (
    <div className="earth-map-frame">
      {engine !== 'leaflet' && <div ref={node} className="earth-google-map" role="img" aria-label="Google Maps Earth map of NASA EONET events" />}
      {engine === 'leaflet' && (
        <div className="earth-leaflet-fallback">
          <EarthMiniMap events={events} onSelect={onSelect} />
          <span className="earth-map-fallback-label">EARTH / OPENSTREETMAP FALLBACK · EONET POINTS</span>
        </div>
      )}
      {status && <p className="earth-map-status">{status}</p>}
    </div>
  );
}
