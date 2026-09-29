'use client';
import LongFormExtras from './LongFormExtras';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, RotateCw } from 'lucide-react';
import type { AssistantResponse } from '@mars-explorer/shared';
import { askAssistant } from '@/lib/api';
import MissionNav from './MissionNav';

export default function CompareTheater() {
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setBusy(true); setError('');
    try { setResult(await askAssistant('Why is Jezero Crater a compelling place to investigate past habitability?', [], true, true)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Comparison request failed.'); }
    finally { setBusy(false); }
  }
  const answers = result?.comparison ?? [];
  return <main className="theater-page"><MissionNav active="/compare" /><section className="theater-hero"><div><p className="eyebrow">OPTIONAL EXPERIMENT / OFF VIDEO PATH</p><h1>Compare the synthesis.</h1><p>Run one shared evidence question through the configured Claude and Gemini providers. Both receive the same retrieved mission notes; citations are shown below.</p></div><aside><span>PIPELINE / LOCAL</span><strong>RETRIEVE<br />→ COMPARE</strong><small>NO KEYS REQUIRED FOR LOCAL EVIDENCE</small></aside></section>
    <section className="compare-stage"><div className="theater-section-head"><span>01 / QUESTION</span><span>{busy ? 'RETRIEVING…' : 'READY'}</span></div><div className="compare-question"><p>Why is Jezero Crater a compelling place to investigate past habitability?</p><button onClick={run} disabled={busy}><RotateCw size={14} /> {busy ? 'RUNNING' : 'RUN COMPARISON'}</button></div>{error && <p className="theater-error">{error}</p>}
    <div className="compare-columns">{['Claude', 'Gemini'].map((name, index) => <article key={name}><div><span>MODEL / {name.toUpperCase()}</span><b>{answers[index] ? 'RESPONSE RECEIVED' : 'AWAITING RUN'}</b></div><p>{answers[index]?.answer ?? (result ? `${name} is not configured or is currently unavailable. Local evidence remains available below.` : 'Provider responses appear here when valid API credentials are configured. The interface never fabricates provider output.')}</p></article>)}</div>
    {result && <><div className="compare-citations"><h2>Shared evidence register</h2>{result.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer"><span><strong>{citation.title}</strong><small>{citation.excerpt}</small></span><ArrowUpRight size={14} /></a>)}</div><div className="compare-local"><span>LOCAL EVIDENCE / {result.modelUsed.toUpperCase()}</span><p>{result.answer}</p></div></>}
    <p className="compare-note">Retrieval, Earth-event lookup (when relevant), and synthesis are request activity states, not a custom observability product. EONET content is Earth-only.</p><Link className="stage-link" href="/explore">OPEN CONSOLE <ArrowUpRight size={14} /></Link></section><LongFormExtras page="compare" /></main>;
}
