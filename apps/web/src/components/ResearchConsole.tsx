'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowUpRight, Bot, Database, FileText, Globe2, Link2, MapPin, MessageSquarePlus, Orbit, RefreshCw, Route, Search, ShieldCheck, Trash2, Upload, Zap } from 'lucide-react';
import type { AgentRun, AgentStep, AnswerLang, Provenance, RagAnswer, RagDocument, RagEval, RagMode, RagPassage, RagProjection, RagSearchResult, RagStatus } from '@mars-explorer/shared';
import { agentStreamUrl, getHealthReady, getRagDocuments, getRagEval, getRagProjection, getRagStatus, ragAddText, ragAddUrl, ragDelete, ragReindex, ragSearch, ragStreamUrl } from '@/lib/api';
import MissionNav from './MissionNav';
import SourceBadge from './ui/SourceBadge';

const EmbeddingSpace3D = dynamic(() => import('./scenes/EmbeddingSpace3D'), { ssr: false, loading: () => <div className="map-loading">LOADING EMBEDDING SPACE…</div> });

const SUGGESTIONS = {
  agent: [
    'Plan a route from the landing site to where Perseverance was on sol 400 and assess its risk.',
    'Where was Perseverance on sol 1000, and what does the SHERLOC instrument do?',
    'How long does a command from Earth take to reach Mars today, and on 2027-02-19?',
    'What wildfires is NASA EONET tracking right now? Keep Earth separate from Mars.',
  ],
  rag: [
    'Why was Jezero Crater chosen as the landing site?',
    'Which instrument uses a laser to look for organic molecules?',
    'How is the traverse risk score in this app calculated?',
    'What happens to the rock samples Perseverance collects?',
  ],
};
const TOOL_ICON: Record<string, typeof Search> = { search_knowledge: Search, verified_locations: MapPin, rover_position: MapPin, suggest_corridor: Route, analyze_route: Activity, earth_events: Globe2, orbit_geometry: Orbit, create_briefing: FileText, nasa_open_data: Database, named_features: MapPin, mars_hardware: Bot };
const STOP = new Set(['what', 'which', 'where', 'when', 'does', 'from', 'this', 'that', 'with', 'about', 'there', 'their', 'have', 'into']);

/** Splits text on query terms and wraps them in <mark>, as React nodes (never HTML strings). */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>))}</>;
}

/** Renders [n] markers as buttons that focus the cited passage. */
function CitedText({ text, onCite, count }: { text: string; onCite: (n: number) => void; count: number }) {
  return (
    <>
      {text.split(/(\[\d+\])/).map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (m && Number(m[1]) <= count) return <button key={i} className="cite-marker" onClick={() => onCite(Number(m[1]))}>{m[1]}</button>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export default function ResearchConsole({ variant = 'page' }: { variant?: 'page' | 'embedded' }) {
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [docs, setDocs] = useState<RagDocument[]>([]);
  const [evalData, setEvalData] = useState<RagEval | null>(null);
  const [projection, setProjection] = useState<RagProjection | null>(null);
  const [mode, setMode] = useState<'agent' | 'rag'>('agent');
  const [agentMode, setAgentMode] = useState<'fast' | 'deep'>('fast');
  const [cloud, setCloud] = useState(true);
  const [lang, setLangState] = useState<AnswerLang>('en');
  const [offline, setOffline] = useState<boolean | null>(null);
  const [query, setQuery] = useState(SUGGESTIONS.agent[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [streamed, setStreamed] = useState('');
  const [rag, setRag] = useState<RagAnswer | null>(null);
  const [ragPassages, setRagPassages] = useState<RagPassage[]>([]);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [activeN, setActiveN] = useState<number | null>(null);
  const [panel, setPanel] = useState<'live' | 'answer'>('live');
  const [preview, setPreview] = useState<RagSearchResult | null>(null);
  const [previewMode, setPreviewMode] = useState<RagMode>('hybrid');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [token, setToken] = useState('');
  const [url, setUrl] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textBody, setTextBody] = useState('');
  const [notice, setNotice] = useState('');
  const source = useRef<EventSource | null>(null);
  const passageRefs = useRef(new Map<string, HTMLElement>());

  const refresh = useCallback(async () => {
    const [s, d] = await Promise.all([getRagStatus(), getRagDocuments()]);
    setStatus(s);
    setDocs(d);
  }, []);

  useEffect(() => {
    try { setToken(localStorage.getItem('rag_token') ?? ''); setLangState(localStorage.getItem('answer_lang') === 'bn' ? 'bn' : 'en'); } catch { /* storage unavailable */ }
    getHealthReady().then((h) => setOffline(h.offline)).catch(() => setOffline(null));
    refresh().catch((e: Error) => setError(e.message));
    getRagProjection().then(setProjection).catch(() => setProjection({ points: [], hits: [] }));
    getRagEval().then(setEvalData).catch(() => setEvalData(null));
    return () => source.current?.close();
  }, [refresh]);

  // Live retrieval preview: the passage panel retrieves for whatever is in the question box, debounced.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    const timer = window.setTimeout(() => {
      setPreviewBusy(true);
      ragSearch(q, previewMode, 6).then(setPreview).catch(() => undefined).finally(() => setPreviewBusy(false));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [query, previewMode]);

  const answerPassages: RagPassage[] = mode === 'rag' ? rag?.passages ?? ragPassages : run?.passages ?? [];
  const showingAnswer = panel === 'answer' && answerPassages.length > 0;
  const passages = showingAnswer ? answerPassages : preview?.passages ?? [];
  const terms = useMemo(() => [...new Set(query.toLowerCase().match(/[a-z]{4,}/g) ?? [])].filter((t) => !STOP.has(t)).slice(0, 8), [query]);
  const cite = (n: number) => {
    setPanel('answer'); setActiveN(n);
    const p = answerPassages.find((x) => x.n === n);
    if (p) window.setTimeout(() => passageRefs.current.get(p.chunkId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };

  /** One EventSource per request; it auto-reconnects by default, which would re-run the work, so every terminal event closes it. */
  function stream(url: string, handlers: Record<string, (data: string) => void>) {
    source.current?.close();
    const es = new EventSource(url);
    source.current = es;
    let finished = false;
    for (const [name, fn] of Object.entries(handlers)) es.addEventListener(name, (e) => fn((e as MessageEvent).data));
    es.addEventListener('done', () => { finished = true; es.close(); setBusy(false); });
    es.addEventListener('failed', (e) => { finished = true; es.close(); setBusy(false); setError(JSON.parse((e as MessageEvent).data).message); });
    es.onerror = () => { es.close(); if (!finished) { setBusy(false); setError('The stream was interrupted. Check that the API is running.'); } };
  }

  function submit(text = query, as: 'agent' | 'rag' = mode) {
    const q = text.trim();
    if (q.length < 3 || busy) return;
    setQuery(q); setBusy(true); setError(''); setActiveN(null); setStreamed('');
    const onToken = (d: string) => setStreamed((s) => s + d);
    const onReset = () => setStreamed('');
    if (as === 'rag') {
      setRag(null); setRagPassages([]);
      stream(ragStreamUrl(q, cloud, lang), {
        passages: (d) => { setRagPassages((JSON.parse(d) as RagSearchResult).passages); setPanel('answer'); getRagProjection(q).then(setProjection).catch(() => undefined); },
        token: onToken, reset: onReset,
        done: (d) => { const r = JSON.parse(d) as RagAnswer; setRag(r); setStreamed(r.answer); },
      });
      return;
    }
    setSteps([]); setRun(null);
    stream(agentStreamUrl(q, cloud, agentMode, lang), {
      step: (d) => setSteps((s) => [...s, JSON.parse(d) as AgentStep]),
      token: onToken, reset: onReset,
      done: (d) => {
        const r = JSON.parse(d) as AgentRun;
        setRun(r); setStreamed(r.answer);
        if (r.passages.length) { setPanel('answer'); getRagProjection(q).then(setProjection).catch(() => undefined); }
      },
    });
  }

  const corpusAction = async (label: string, action: () => Promise<unknown>) => {
    setNotice(`${label}…`); setError('');
    try {
      await action();
      await refresh();
      getRagProjection().then(setProjection).catch(() => undefined);
      setNotice(`${label} · done`);
    } catch (e) { setNotice(''); setError((e as Error).message); }
  };
  const setLang = (v: AnswerLang) => { setLangState(v); try { localStorage.setItem('answer_lang', v); } catch { /* ignore */ } };
  const saveToken = (v: string) => { setToken(v); try { localStorage.setItem('rag_token', v); } catch { /* ignore */ } };
  const onFile = (file?: File) => {
    if (!file) return;
    if (file.size > 200_000) { setError('Files must be under 200 KB.'); return; }
    file.text().then((t) => { setTextBody(t); setTextTitle((v) => v || file.name.replace(/\.(md|txt)$/i, '')); });
  };

  const final = mode === 'rag' ? rag : run;
  const model = mode === 'rag' ? rag?.modelUsed : run?.modelUsed;
  const hasAnswer = Boolean(streamed || final);
  const embedded = variant === 'embedded';

  return (
    <main className={`theater-page research-page ${embedded ? 'is-embedded' : ''}`}>
      {!embedded && <MissionNav active="/research" />}
      <header className="research-head">
        <div>
          <p className="eyebrow">{embedded ? 'ASK THE MISSION / AGENTIC RAG' : 'RESEARCH CONSOLE / AGENTIC RAG'}</p>
          {embedded ? <h2>Ask the mission. Watch it work.</h2> : <h1>Ask the mission. Watch it work.</h1>}
          <p>A tool-using mission agent and a retrieval-augmented assistant over {status?.documents ?? '—'} NASA documents. A System One router picks tools in one pass, tools run in parallel, and the answer streams in with citations.</p>
        </div>
        <div className="research-status">
          <span><Database size={12} /> {status ? `${status.documents} DOCS · ${status.chunks} CHUNKS` : 'CONNECTING…'}</span>
          <span className={status?.semantic ? 'ok' : ''}>{status?.semantic ? `SEMANTIC · ${status.embedModel}` : 'BM25 ONLY'}</span>
          <span className={status?.generators.gemini ? 'ok' : ''}>GEMINI {status?.generators.gemini ? 'READY' : 'OFF'}</span>
          <span className={status?.generators.claude ? 'ok' : ''}>CLAUDE {status?.generators.claude ? 'FALLBACK READY' : 'OFF'}</span>
          {offline !== null && <span><SourceBadge source={offline ? 'offline' : 'live'} /> {offline ? 'WIFI OFF · LOCAL EVIDENCE' : 'NETWORK'}</span>}
          {embedded && <Link href="/research">FULL CONSOLE ↗</Link>}
        </div>
      </header>

      <section className="research-grid">
        <aside className="research-corpus" aria-label="Corpus manager">
          <div className="rc-title"><span>CORPUS</span><button title="Rebuild index" onClick={() => corpusAction('Reindexing', () => ragReindex(token))}><RefreshCw size={12} /></button></div>
          <ul className="rc-docs">
            {[...docs].sort((a, b) => a.source.localeCompare(b.source) || a.title.localeCompare(b.title)).map((d) => (
              <li key={d.id}>
                <a href={d.url || undefined} target="_blank" rel="noreferrer">{d.title}</a>
                <small><b className={`src-${d.source}`}>{d.source.toUpperCase()}</b> {d.chunks} CHUNKS · {d.words.toLocaleString()} W</small>
                {d.source === 'user' && <button className="rc-del" title="Delete document" onClick={() => corpusAction(`Deleting ${d.title}`, () => ragDelete(d.id, token))}><Trash2 size={11} /></button>}
              </li>
            ))}
          </ul>
          <form className="rc-form" onSubmit={(e) => { e.preventDefault(); if (url) void corpusAction('Fetching and indexing', () => ragAddUrl(url, token)).then(() => setUrl('')); }}>
            <label><Link2 size={11} /> ADD A PUBLIC URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://science.nasa.gov/…" type="url" />
            <button type="submit" disabled={!url}>FETCH + INDEX</button>
          </form>
          <form className="rc-form" onSubmit={(e) => { e.preventDefault(); void corpusAction('Indexing text', () => ragAddText(textTitle, textBody, undefined, token)).then(() => { setTextTitle(''); setTextBody(''); }); }}>
            <label><Upload size={11} /> ADD TEXT OR A .MD/.TXT FILE</label>
            <input value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="Title" />
            <textarea value={textBody} onChange={(e) => setTextBody(e.target.value)} placeholder="Paste at least 200 characters…" rows={4} />
            <input type="file" accept=".md,.txt,text/plain,text/markdown" onChange={(e) => onFile(e.target.files?.[0])} />
            <button type="submit" disabled={textTitle.length < 3 || textBody.length < 200}>INDEX TEXT</button>
          </form>
          {status?.adminTokenRequired && <input className="rc-token" value={token} onChange={(e) => saveToken(e.target.value)} placeholder="Admin token (x-rag-token)" type="password" />}
          {notice && <p className="rc-notice" role="status">{notice}</p>}
        </aside>

        <section className="research-main" aria-label="Ask">
          <div className="rm-modes" role="tablist">
            <button role="tab" aria-selected={mode === 'agent'} className={mode === 'agent' ? 'active' : ''} onClick={() => { setMode('agent'); setQuery(SUGGESTIONS.agent[0]); setStreamed(''); }}><Bot size={13} /> MISSION AGENT</button>
            <button role="tab" aria-selected={mode === 'rag'} className={mode === 'rag' ? 'active' : ''} onClick={() => { setMode('rag'); setQuery(SUGGESTIONS.rag[0]); setStreamed(''); }}><Search size={13} /> ASK THE CORPUS</button>
            {mode === 'agent' && (
              <span className="rm-speed" role="group" aria-label="Agent mode">
                <button className={agentMode === 'fast' ? 'active' : ''} onClick={() => setAgentMode('fast')} title="System One router picks tools in one pass; tools run in parallel; answer streams"><Zap size={11} /> FAST</button>
                <button className={agentMode === 'deep' ? 'active' : ''} onClick={() => setAgentMode('deep')} title="The LLM plans tool calls turn by turn">DEEP</button>
              </span>
            )}
            <span className="rm-lang" role="group" aria-label="Answer language"><button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button><button className={lang === 'bn' ? 'active' : ''} onClick={() => setLang('bn')} title="Bangla answers need a cloud model; numbers and citations stay unchanged">বাংলা</button></span>
            <label className="rm-cloud"><input type="checkbox" checked={cloud} onChange={(e) => setCloud(e.target.checked)} /> GEMINI → CLAUDE {cloud ? '' : '(OFF · LOCAL ONLY)'}</label>
          </div>
          <form className="rm-ask" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={2} maxLength={500} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
            <button type="submit" disabled={busy || query.trim().length < 3}>{busy ? (mode === 'agent' ? 'AGENT WORKING…' : 'STREAMING…') : mode === 'agent' ? 'RUN AGENT' : 'ASK'} <ArrowUpRight size={13} /></button>
          </form>
          <div className="rm-suggest">{SUGGESTIONS[mode].map((s) => <button key={s} onClick={() => submit(s)} disabled={busy}>{s}</button>)}</div>
          {error && <p className="rm-error" role="alert">{error}</p>}

          {mode === 'agent' && (steps.length > 0 || busy) && (
            <ol className="agent-steps" aria-label="Agent steps">
              {steps.map((s) => {
                const Icon = s.tool ? TOOL_ICON[s.tool] ?? Activity : s.kind === 'answer' ? FileText : Bot;
                return (
                  <li key={s.i} className={`step-${s.kind}`}>
                    <i><Icon size={12} /></i>
                    <div>
                      <strong>{s.tool ?? s.kind.toUpperCase()}{s.label && <em className={`lbl-${s.label.replace(/[^A-Z]/g, '')}`}>{s.label}</em>}{s.ms != null && <small>{s.ms} MS</small>}</strong>
                      <span>{s.summary}</span>
                      {s.args && Object.keys(s.args).length > 0 && <code>{JSON.stringify(s.args).slice(0, 160)}</code>}
                    </div>
                  </li>
                );
              })}
              {busy && !streamed && <li className="step-pending"><i><RefreshCw size={12} className="spin" /></i><div><span>Working…</span></div></li>}
            </ol>
          )}

          {hasAnswer && (
            <article className={`rm-answer ${busy ? 'is-streaming' : ''}`}>
              <div className="rm-answer-head">
                <span>{busy ? 'STREAMING' : model === 'local-evidence' ? 'LOCAL EXTRACTIVE' : model === 'local-planner' ? 'DETERMINISTIC' : model?.toUpperCase()}</span>
                {mode === 'agent' && run && <span>{run.mode === 'fast' ? `FAST · ${run.router === 'jev' ? 'JEV ROUTER' : 'RULES ROUTER'}` : 'DEEP · LLM PLANNER'}</span>}
                {mode === 'rag' && rag && <span>{rag.strong ? 'EVIDENCE STRONG' : 'EVIDENCE WEAK'}</span>}
                {final && <span>{final.tookMs} MS</span>}
                {mode === 'rag' && rag && <span>{rag.mode.toUpperCase()} RETRIEVAL</span>}
              </div>
              <p><CitedText text={streamed || (final && 'answer' in final ? final.answer : '')} onCite={cite} count={answerPassages.length} />{busy && <i className="caret" />}</p>
              {mode === 'agent' && run?.route && run.route.length > 1 && (
                <Link className="rm-route" href={`/explore?wp=${encodeURIComponent(JSON.stringify(run.route.map(({ lat, lon }) => ({ lat, lon }))))}`}>OPEN THIS ROUTE IN EXPLORE <ArrowUpRight size={12} /></Link>
              )}
              {lang === 'bn' && final && (model === 'local-evidence' || model === 'local-planner') && <p className="rm-lang-note">BANGLA NEEDS A CLOUD MODEL · THIS ANSWER IS THE LOCAL ENGLISH EVIDENCE</p>}
              {mode === 'agent' && run?.provenance && <ProvenanceDrawer provenance={run.provenance} />}
              <small>Answers come only from the indexed sources and tools shown. Routes and risk scores are non-certifying research aids.</small>
            </article>
          )}
        </section>

        <aside className="research-passages" aria-label="Retrieved passages">
          <div className="rc-title rp-head">
            <span role="tablist">
              <button role="tab" aria-selected={!showingAnswer} className={!showingAnswer ? 'active' : ''} onClick={() => setPanel('live')}>LIVE RETRIEVAL</button>
              <button role="tab" aria-selected={showingAnswer} className={showingAnswer ? 'active' : ''} onClick={() => setPanel('answer')} disabled={!answerPassages.length}>CITED · {answerPassages.length}</button>
            </span>
            {!showingAnswer && (
              <select value={previewMode} onChange={(e) => setPreviewMode(e.target.value as RagMode)} aria-label="Retrieval mode">
                <option value="hybrid">HYBRID</option><option value="bm25">BM25</option><option value="dense">SEMANTIC</option>
              </select>
            )}
          </div>
          {!showingAnswer && (
            <p className="rp-live">
              {previewBusy ? <><RefreshCw size={10} className="spin" /> RETRIEVING…</> : preview ? <>{preview.passages.length} PASSAGES · {preview.mode.toUpperCase()} · {preview.tookMs} MS · {preview.strong ? 'EVIDENCE STRONG' : 'WEAK — WOULD REFUSE'}</> : 'TYPE A QUESTION TO PREVIEW RETRIEVAL'}
            </p>
          )}
          {passages.map((p) => (
            <article key={p.chunkId} ref={(el) => { if (el) passageRefs.current.set(p.chunkId, el); }} className={showingAnswer && activeN === p.n ? 'active' : ''} onClick={() => showingAnswer && setActiveN(p.n)}>
              <header><b>{p.n}</b><a href={p.url || undefined} target="_blank" rel="noreferrer">{p.title}</a></header>
              {p.heading && <small>{p.heading}</small>}
              <div className="rp-scores">
                <span><i style={{ width: `${p.scores.bm25 * 100}%` }} />BM25 {p.scores.bm25.toFixed(2)}</span>
                <span><i style={{ width: `${(p.scores.dense ?? 0) * 100}%` }} />SEM {p.scores.dense?.toFixed(2) ?? '—'}</span>
                <span><i style={{ width: `${p.scores.fused * 100}%` }} />FUSED {p.scores.fused.toFixed(2)}</span>
              </div>
              <p><Highlight text={p.text} terms={terms} /></p>
              <button className="rp-ask" onClick={(e) => { e.stopPropagation(); setMode('rag'); submit(`Tell me more about ${p.heading ? p.heading.split(' › ').at(-1) : p.title}.`, 'rag'); }}><MessageSquarePlus size={10} /> ASK ABOUT THIS</button>
            </article>
          ))}
        </aside>
      </section>

      <section className="research-bottom">
        <div className="research-space"><EmbeddingSpace3D projection={projection} /></div>
        <div className="research-eval">
          <div className="rc-title"><span>RETRIEVAL QUALITY</span><span>{evalData ? `${evalData.questions} LABELLED QUESTIONS` : '—'}</span></div>
          {evalData ? (
            <table>
              <thead><tr><th>MODE</th><th>RECALL@3</th><th>RECALL@5</th><th>MRR</th></tr></thead>
              <tbody>{evalData.rows.map((r) => <tr key={r.mode} className={r.mode === 'hybrid' ? 'best' : ''}><td>{r.mode.toUpperCase()}</td><td>{r.recallAt3.toFixed(2)}</td><td>{r.recallAt5.toFixed(2)}</td><td>{r.mrr.toFixed(2)}</td></tr>)}</tbody>
            </table>
          ) : <p className="rp-empty">Evaluation unavailable.</p>}
          <ul className="research-how">
            <li><b>01</b> Chunk NASA pages by heading into ~180-word passages with overlap.</li>
            <li><b>02</b> Embed with {status?.embedModel ?? 'Gemini'}; index BM25 alongside; fuse with RRF, diversify with MMR.</li>
            <li><b>03</b> System One router (TypeSafe Jev when configured, else rules) picks agent tools in one pass; tools run in parallel.</li>
            <li><b>04</b> Stream the answer from Gemini, fall back to Claude, else answer extractively; keep only valid [n] citations.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

/** Every number in the agent answer, the tool that produced it, its source, and the raw tool JSON behind it. */
function ProvenanceDrawer({ provenance }: { provenance: Provenance }) {
  const sourced = provenance.claims.length - provenance.unmatched;
  return <details className={`provenance-drawer ${provenance.complete ? 'ok' : 'warn'}`}>
    <summary><ShieldCheck size={12} /> {provenance.complete ? `PROVENANCE · ${sourced}/${provenance.claims.length} NUMBERS SOURCED` : `PROVENANCE INCOMPLETE · ${provenance.unmatched} UNMATCHED`} <span>OPEN DRAWER</span></summary>
    <ol className="pv-claims">{provenance.claims.map((c, i) => <li key={i} className={c.unmatched ? 'unmatched' : ''}><b>{c.value}</b><span>“…{c.text}…”</span><em>{c.unmatched ? 'NOT FOUND IN ANY TOOL RESULT' : `${c.tool} · ${c.sourceUrl ?? ''}`}</em></li>)}{!provenance.claims.length && <li><span>No numeric claims in this answer.</span></li>}</ol>
    <div className="pv-raw">{provenance.evidence.map((e, i) => <section key={i}><strong>{e.tool}</strong><small>{e.source}</small><pre>{e.output}</pre></section>)}</div>
  </details>;
}
