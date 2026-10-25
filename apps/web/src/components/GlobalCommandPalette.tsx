'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { searchSite } from '@/lib/site-search';
import { onVoiceSync } from '@/lib/voice-sync';

export default function GlobalCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuery('');
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => onVoiceSync((event) => {
    if (event.type === 'search.open') {
      setQuery(event.query || '');
      setOpen(true);
    }
  }), []);

  if (!open) return null;
  const hits = searchSite(query, 14);

  return (
    <div className="modal-backdrop palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Global command palette">
        <div><Search size={15} /><input autoFocus value={query} placeholder="Search pages, NASA products, voice commands" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && hits[0]) { router.push(hits[0].href); setOpen(false); }
        }} /></div>
        {hits.map((hit) => (
          <button key={hit.id} type="button" onClick={() => { router.push(hit.href); setOpen(false); }}>
            <span>{hit.label}<small> · {hit.kind.toUpperCase()} · {hit.blurb}</small></span>
            <ArrowUpRight size={13} />
          </button>
        ))}
        {!hits.length && <p className="palette-empty">NO MATCHES</p>}
      </section>
    </div>
  );
}
