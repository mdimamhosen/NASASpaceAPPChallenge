'use client';

import { useEffect, useState } from 'react';
import type { RoverImagesResult } from '@mars-explorer/shared';
import { getRoverImages, ragSearch } from '@/lib/api';
import SourceBadge from './ui/SourceBadge';

type Props = { sol: number; lang?: 'en' | 'bn' };

export default function SolContextStrip({ sol, lang = 'en' }: Props) {
  const [images, setImages] = useState<RoverImagesResult | null>(null);
  const [snippet, setSnippet] = useState<{ title: string; text: string; url: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sol == null || Number.isNaN(sol) || sol < 0) {
      setLoading(false);
      setImages(null);
      return;
    }
    let active = true;
    setError('');
    setLoading(true);
    setImages(null);
    getRoverImages(sol, 10)
      .then((res) => { if (active) setImages(res); })
      .catch((reason: Error) => { if (active) { setImages(null); setError(reason.message); } })
      .finally(() => { if (active) setLoading(false); });
    ragSearch(`Perseverance sol ${sol} Jezero`, 'hybrid', 2)
      .then((res) => {
        if (!active || !res.passages[0]) { if (active) setSnippet(null); return; }
        const p = res.passages[0];
        setSnippet({ title: p.title, text: p.text.slice(0, 180), url: p.url });
      })
      .catch(() => { if (active) setSnippet(null); });
    return () => { active = false; };
  }, [sol]);

  const label = lang === 'bn' ? 'SOL প্রসঙ্গ · ছবি' : 'SOL CONTEXT · RAW IMAGES';
  const ingenuity = images?.images.filter((i) => i.category === 'ingenuity') ?? [];
  const rover = images?.images.filter((i) => i.category === 'mars2020') ?? [];

  return (
    <section className="sol-context-strip" aria-label={label}>
      <div className="sol-context-head">
        <strong>{label}</strong>
        <span>SOL {sol}</span>
        {images && <SourceBadge source={images.source} />}
        <a href="https://mars.nasa.gov/mars2020/multimedia/raw-images/" target="_blank" rel="noreferrer">NASA RAW IMAGES ↗</a>
      </div>
      {error && <small className="sol-context-error">{error}</small>}
      {images?.note && <small>{images.note}</small>}
      <div className="sol-photo-row" role="list">
        {loading && Array.from({ length: 6 }, (_, i) => (
          <div key={`sk-${i}`} className="sol-photo-skeleton" role="listitem" aria-hidden />
        ))}
        {!loading && (rover.length ? rover : images?.images ?? []).slice(0, 8).map((img) => (
          <a key={img.id} href={img.pageUrl} target="_blank" rel="noreferrer" role="listitem" title={img.title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.thumbnailUrl} alt={`${img.camera} · sol ${img.sol}`} loading="lazy" width={96} height={72} />
            <span>{img.camera}</span>
          </a>
        ))}
        {!loading && images && !images.images.length && !error && <small>NO PUBLIC RAW IMAGES FOR THIS SOL</small>}
      </div>
      {ingenuity.length > 0 && (
        <div className="sol-ingenuity">
          <span>INGENUITY · SAME SOL</span>
          {ingenuity.slice(0, 4).map((img) => (
            <a key={img.id} href={img.pageUrl} target="_blank" rel="noreferrer">{img.camera}</a>
          ))}
        </div>
      )}
      {snippet && (
        <p className="sol-corpus-snip">
          <a href={snippet.url || undefined} target="_blank" rel="noreferrer">{snippet.title}</a>
          {' — '}{snippet.text}…
        </p>
      )}
    </section>
  );
}
