'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, X } from 'lucide-react';

export type DetailSource = { title: string; url: string; note?: string };
export default function DetailModal({ title, eyebrow, summary, facts = [], sources = [], children, onClose }: {
  title: string; eyebrow: string; summary?: string; facts?: Array<[string, string]>;
  sources?: DetailSource[]; children?: ReactNode; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => {
    const current = dialog.current;
    if (!current) return;
    current.showModal();
    return () => current.close();
  }, []);
  const source = sources[sourceIndex];
  return <dialog ref={dialog} className="detail-modal" aria-labelledby="detail-title" onClose={onClose} onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}>
    <div className="detail-modal-frame">
      <header><span className="eyebrow">{eyebrow}</span><button aria-label="Close detail" onClick={() => dialog.current?.close()}><X size={18} /></button></header>
      <div className="detail-modal-scroll">
        <h2 id="detail-title">{title}</h2>
        {summary && <p className="detail-summary">{summary}</p>}
        {facts.length > 0 && <dl className="detail-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        {children}
        {sources.length > 0 && <section className="detail-sources" aria-label="Source register"><h3>SOURCE REGISTER</h3><div className="detail-source-layout"><div className="detail-source-list">{sources.map((item, index) => <button key={`${item.url}-${index}`} className={sourceIndex === index ? 'active' : ''} onClick={() => setSourceIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span>{item.title}</button>)}</div>{source && <article className="detail-source-card"><small>SELECTED SOURCE / EXTERNAL RECORD</small><strong>{source.title}</strong><p>{source.note || 'Open the publisher record to inspect its full caption, date, and provenance.'}</p><span>{source.url}</span><a href={source.url} target="_blank" rel="noreferrer">OPEN SOURCE <ArrowUpRight size={14} /></a></article>}</div></section>}
      </div>
    </div>
  </dialog>;
}
