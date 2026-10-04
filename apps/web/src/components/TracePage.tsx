'use client';
import LongFormExtras from './LongFormExtras';
import { useEffect, useState } from 'react';
import { getRecentTraces } from '@/lib/api';
import MissionNav from './MissionNav';
import Link from 'next/link';

type Step = { step: string; detail: string };
export default function TracePage() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [recent, setRecent] = useState<Array<{id:string;createdAt:string;question:string;steps:Step[]}>>([]);
  const [error, setError] = useState('');
  useEffect(() => { getRecentTraces().then((rows) => { setRecent(rows); setSteps(rows[0]?.steps ?? []); }).catch((reason: Error) => setError(reason.message)); }, []);
  return <main className="theater-page"><MissionNav active="/traces" /><section className="theater-hero"><div><p className="eyebrow">LOCAL EVIDENCE / PROCESS TRACE</p><h1>From question to cited answer.</h1><p>Each step comes from the last durable assistant request. The default path uses local retrieval and template synthesis without a cloud model.</p></div><aside><span>PIPELINE MODE</span><strong>LOCAL<br />EVIDENCE</strong><small>DURABLE LAST 100</small></aside></section><section className="theater-section"><div className="theater-section-head"><span>01 / DETERMINISTIC STEPS</span><span>{steps.length} STEPS</span></div><div className="theater-records">{steps.map((item, i) => <article key={item.step}><span className="record-index">{String(i+1).padStart(2,'0')}</span><div><small>PIPELINE / {item.step.toUpperCase()}</small><h2>{item.detail}</h2></div></article>)}{!steps.length && <p className="theater-error">{error || 'Ask a question in the Mars console to populate this process trace.'}</p>}</div></section><section className="theater-section"><div className="theater-section-head"><span>RECENT QUESTIONS / DURABLE TRACE</span><span>{recent.length} RECORDS</span></div><div className="theater-records">{recent.slice(0,10).map((trace)=><article key={trace.id}><span className="record-index">{new Date(trace.createdAt).toLocaleDateString("en-GB")}</span><div><small>TRACE {trace.id.slice(0,8)}</small><h2>{trace.question}</h2><p>{trace.steps.length} pipeline steps</p></div></article>)}</div></section><footer className="theater-footer"><span>LAST 100 REQUESTS IN FILE OR POSTGRES</span><Link href="/explore">ASK A QUESTION ↗</Link></footer><LongFormExtras page="traces" /></main>;
}
