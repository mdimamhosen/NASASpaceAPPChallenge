'use client';
import { useEffect, useState } from 'react';
import type { MapLayer } from '@mars-explorer/shared';
import { getLayers } from '@/lib/api';
import DetailModal from './ui/DetailModal';
export default function LayerCatalogWidget() {
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [selected, setSelected] = useState<MapLayer | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getLayers().then(setLayers).catch((reason: Error) => setError(reason.message)); }, []);
  return <section className="layer-catalog-widget" aria-label="Mars map layer provenance"><div><span className="eyebrow">API / MAP LAYER REGISTER</span><h2>Layers and provenance.</h2><p>Mars Trek rasters are map context. Seeded overlays are local annotations; they do not constitute measured slope or route certification.</p></div><div className="layer-catalog-list">{layers.map((layer) => <button key={layer.id} onClick={() => setSelected(layer)}><small>{layer.id.toUpperCase()}</small><strong>{layer.name}</strong><span>{layer.source} ↗</span></button>)}{error && <p role="status">Layer API unavailable: {error}</p>}{!layers.length && !error && <p>Loading the layer register…</p>}</div>{selected && <DetailModal title={selected.name} eyebrow="MARS / LAYER PROVENANCE" summary={selected.description} facts={[["SOURCE", selected.source], ["LAYER ID", selected.id.toUpperCase()], ["DEFAULT", selected.enabledByDefault ? 'ON' : 'OFF']]} sources={[{ title: 'NASA MARS TREK', url: 'https://trek.nasa.gov/mars/', note: 'Inspect the original Mars map service and its layer metadata.' }]} onClose={() => setSelected(null)} />}</section>;
}
