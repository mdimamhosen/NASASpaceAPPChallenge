'use client';

import { useEffect, useState } from 'react';

type Note = { id: string; lat: number; lon: number; text: string; tag: string; at: string };
const KEY = 'me_field_notes';
const TAGS = ['ROCK', 'SAMPLE', 'HAZARD', 'VIEWPOINT', 'CAMP'];

const save = (blob: string, name: string, type: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([blob], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };

/** Field notebook: pin notes at the map centre, kept in this browser, exported as Markdown or GeoJSON. */
export default function FieldNotebook({ center }: { center: { lat: number; lon: number } | null }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [tag, setTag] = useState(TAGS[0]);
  useEffect(() => { try { setNotes(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { setNotes([]); } }, []);
  const persist = (next: Note[]) => { setNotes(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: notes stay for this session */ } };
  const add = () => { if (!center || !text.trim()) return; persist([{ id: crypto.randomUUID(), lat: Number(center.lat.toFixed(5)), lon: Number(center.lon.toFixed(5)), text: text.trim().slice(0, 500), tag, at: new Date().toISOString() }, ...notes]); setText(''); };
  const md = () => `# Mars Explorer field notes\n\n${notes.map((n) => `- **${n.tag}** ${n.lat}°N ${n.lon}°E (${n.at.slice(0, 16)} UTC): ${n.text}`).join('\n')}\n`;
  const geo = () => JSON.stringify({ type: 'FeatureCollection', features: notes.map((n) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [n.lon, n.lat] }, properties: { tag: n.tag, text: n.text, at: n.at } })) }, null, 1);
  return (
    <section className="field-notebook" aria-label="Field notebook">
      <header><span>FIELD NOTEBOOK</span><span>{notes.length} NOTES · THIS BROWSER</span></header>
      <form onSubmit={(e) => { e.preventDefault(); add(); }}>
        <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Note tag">{TAGS.map((t) => <option key={t}>{t}</option>)}</select>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={center ? `Note at ${center.lat.toFixed(4)}°N ${center.lon.toFixed(4)}°E` : 'Move the map to place a note'} aria-label="Note text" maxLength={500} />
        <button type="submit" disabled={!center || !text.trim()}>PIN AT MAP CENTRE</button>
      </form>
      <ol>{notes.slice(0, 8).map((n) => <li key={n.id}><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('mars-focus', { detail: { lat: n.lat, lon: n.lon } }))}><strong>{n.tag}</strong> {n.text}<small>{n.lat}°N {n.lon}°E</small></button><button type="button" aria-label="Delete note" onClick={() => persist(notes.filter((x) => x.id !== n.id))}>×</button></li>)}</ol>
      {notes.length > 0 && <div className="fn-actions"><button type="button" onClick={() => save(md(), 'field-notes.md', 'text/markdown')}>EXPORT MARKDOWN</button><button type="button" onClick={() => save(geo(), 'field-notes.geojson', 'application/geo+json')}>EXPORT GEOJSON</button></div>}
    </section>
  );
}
