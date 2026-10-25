'use client';

import { useState } from 'react';
import type { AnswerLang } from '@mars-explorer/shared';
import { askAssistant, runAgent } from '@/lib/api';

/** Embedded agentic quiz: evaluates student answers against NASA sources using the Jev-routed agent. */
export default function ClassroomQuiz({ lang }: { lang: AnswerLang }) {
  const [q, setQ] = useState(0);
  const [answer, setAnswer] = useState('');
  const [verdict, setVerdict] = useState<{ result: string; claim: string; note?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const questions = [
    { text: 'Which NASA algorithm calculates the local true solar time at Jezero Crater?', en: 'Expected: Mars24 (Allison & McEwen 2000).', bn: 'প্রত্যাশিত: Mars24 (Allison & McEwen 2000)।' },
    { text: 'Why is a 100-meter corridor safe from boulders?', en: 'Expected: The orbital DEM grid spacing is ~118 m and cannot resolve rover-scale hazards. Corridors are non-certifying.', bn: 'প্রত্যাশিত: অরবিটাল DEM গ্রিড স্পেসিং ~118 মি এবং এটি রোভার-স্কেলের বিপদগুলি দেখতে পায় না। এটি সার্টিফাইং নয়।' },
    { text: 'How long did the November 2023 solar conjunction moratorium last?', en: 'Expected: About two weeks (Nov 11–25).', bn: 'প্রত্যাশিত: প্রায় দুই সপ্তাহ (১১–২৫ নভেম্বর)।' },
    { text: 'What is the surface radiation dose rate measured by Curiosity RAD?', en: 'Expected: ~0.67 mSv/day (Hassler et al. 2014).', bn: 'প্রত্যাশিত: ~0.67 mSv/day (Hassler et al. 2014)।' },
  ];

  async function check() {
    if (!answer.trim() || busy) return;
    setBusy(true); setVerdict(null);
    try {
      const prompt = `Student answered: "${answer}". Is this correct for the question: "${questions[q].text}"? Say PASS or FAIL exactly as the first word of your answer, then explain briefly.`;
      const res = await runAgent(prompt, true, 'fast', lang);
      const pass = /\b(PASS|correct|yes)\b/.test(res.answer.toUpperCase()) && !/\b(FAIL|incorrect|no)\b/.test(res.answer.toUpperCase());
      setVerdict({ result: pass ? 'PASS' : 'REVIEW', claim: res.answer });
    } catch (e) {
      setVerdict({ result: 'ERROR', claim: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="classroom-quiz">
      <div className="cq-header"><span>EVIDENCE QUIZ / {q + 1} OF {questions.length}</span><button type="button" onClick={() => { setQ((q + 1) % questions.length); setVerdict(null); setAnswer(''); }}>NEXT QUESTION ↗</button></div>
      <h3>{questions[q].text}</h3>
      <p className="cq-expected">{lang === 'bn' ? questions[q].bn : questions[q].en}</p>
      <form onSubmit={(e) => { e.preventDefault(); void check(); }}>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer based on Explore evidence..." disabled={busy} rows={3} required />
        <button type="submit" disabled={busy || !answer.trim()}>{busy ? 'CHECKING NASA SOURCES…' : 'CHECK ANSWER'}</button>
      </form>
      {verdict && <div className={`cq-verdict cq-${verdict.result.toLowerCase()}`} role="alert"><strong>{verdict.result}</strong><p>{verdict.claim}</p></div>}
    </section>
  );
}
