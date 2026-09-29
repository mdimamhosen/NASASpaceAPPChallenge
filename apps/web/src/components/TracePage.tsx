'use client';
import LongFormExtras from './LongFormExtras';
import { useEffect, useState } from 'react';
import { getTrace } from '@/lib/api';
import MissionNav from './MissionNav';
import Link from 'next/link';

type Step = { step: string; detail: string };
export default function TracePage() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { getTrace().then(setSteps).catch((reason: Error) => setError(reason.message)); }, []);
  return <main className="theater-page"><MissionNav active="/traces" /><section className="theater-hero"><div><p className="eyebrow">LOCAL EVIDENCE / PROCESS TRACE</p><h1>From question to cited answer.</h1><p>Each step shows the most recent assistant request handled by this API process. The default path uses local retrieval and template synthesis without a cloud model.</p></div><aside><span>PIPELINE MODE</span><strong>LOCAL<br />EVIDENCE</strong><small>PROCESS MEMORY / DEMO</small></aside></section><section className="theater-section"><div className="theater-section-head"><span>01 / DETERMINISTIC STEPS</span><span>{steps.length} STEPS</span></div><div className="theater-records">{steps.map((item, i) => <article key={item.step}><span className="record-index">{String(i+1).padStart(2,'0')}</span><div><small>PIPELINE / {item.step.toUpperCase()}</small><h2>{item.detail}</h2></div></article>)}{!steps.length && <p className="theater-error">{error || 'Ask a question in the Mars console to populate this process trace.'}</p>}</div></section><footer className="theater-footer"><span>LAST REQUEST IN THIS SERVER PROCESS</span><Link href="/explore">ASK A QUESTION ↗</Link></footer><LongFormExtras page="traces" /></main>;
}
