'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import MissionNav from '@/components/MissionNav';
import { classroomWorksheetUrl } from '@/lib/api';
import type { AnswerLang } from '@mars-explorer/shared';
import ClassroomQuiz from '@/components/ClassroomQuiz';

export default function ClassroomPage() {
  const [lang, setLang] = useState<AnswerLang>('en');
  useEffect(() => {
    const syncLanguage = () => setLang(localStorage.getItem('me_lang') === 'bn' ? 'bn' : 'en');
    syncLanguage();
    window.addEventListener('me-language-change', syncLanguage);
    window.addEventListener('storage', syncLanguage);
    return () => { window.removeEventListener('me-language-change', syncLanguage); window.removeEventListener('storage', syncLanguage); };
  }, []);
  const selectLanguage = (value: AnswerLang) => {
    setLang(value); localStorage.setItem('me_lang', value); document.documentElement.lang = value;
    window.dispatchEvent(new Event('me-language-change'));
  };
  const en = {
    title: 'Classroom Survival Pack',
    lead: 'A 45-minute Jezero Marswalk lesson on real NASA products — with honest limits.',
    objectives: ['Follow Perseverance on published PLACES sols', 'Read a non-certifying Risk Index with source links', 'Inspect Mars 2020 raw images for the same sol', 'Export GeoJSON and a briefing with Methods'],
    steps: [
      'Open Explore → Classroom Mode (loads PLACES sols 400 / 420 / 430).',
      'In the Evidence Cockpit, expand each Risk Index component and open the NASA source.',
      'Scrub the sol slider; read the Sol Context strip (raw images + corpus note).',
      'Compare track fidelity (mean / max offset) with Perseverance’s path.',
      'Export GeoJSON/CSV, generate a briefing PDF, and discuss light-time delay.',
      'Quiz: PLACES vs DEM spacing vs EONET Earth-only boundary.',
    ],
    offline: 'Run with OFFLINE=1 / pnpm demo:offline so LIVE → CACHE → FIXTURE badges stay visible without wifi.',
  };
  const bn = {
    title: 'শ্রেণিকক্ষ সারভাইভাল প্যাক',
    lead: '৪৫ মিনিটের জেজারো মার্সওয়াক পাঠ — সত্যিকারের NASA পণ্য ও সৎ সীমা সহ।',
    objectives: ['প্রকাশিত PLACES sol-এ Perseverance অনুসরণ', 'সোর্সসহ NON-CERTIFYING Risk Index পড়া', 'একই sol-এর Mars 2020 raw ছবি দেখা', 'GeoJSON ও Methodsসহ briefing এক্সপোর্ট'],
    steps: [
      'Explore → Classroom Mode (PLACES sol 400 / 420 / 430)।',
      'Evidence Cockpit-এ প্রতিটি Risk উপাদান খুলে NASA সোর্স খুলুন।',
      'Sol স্লাইডার সরিয়ে Sol Context (ছবি + কর্পাস নোট) পড়ুন।',
      'ট্র্যাক ফিডেলিটি (গড় / সর্বোচ্চ অফসেট) তুলনা করুন।',
      'GeoJSON/CSV এক্সপোর্ট ও briefing PDF; আলোর বিলম্ব আলোচনা করুন।',
      'কুইজ: PLACES vs DEM স্পেসিং vs EONET Earth-only।',
    ],
    offline: 'OFFLINE=1 / pnpm demo:offline দিয়ে wifi ছাড়াই LIVE → CACHE → FIXTURE দেখান।',
  };
  const t = lang === 'bn' ? bn : en;

  return (
    <main className="theater-page classroom-page">
      <MissionNav active="/classroom" />
      <section className="theater-hero">
        <div>
          <p className="eyebrow">CHALLENGE 11 · SURVIVAL MAP · STEM</p>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
          <div className="classroom-actions">
            <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => selectLanguage('en')}>EN</button>
            <button type="button" className={lang === 'bn' ? 'active' : ''} onClick={() => selectLanguage('bn')}>বাংলা</button>
            <a className="stage-link" href={classroomWorksheetUrl(lang)}>DOWNLOAD WORKSHEET PDF <ArrowUpRight size={14} /></a>
            <Link className="stage-link" href="/explore">OPEN EXPLORE <ArrowUpRight size={14} /></Link>
          </div>
        </div>
      </section>
      <section className="theater-section">
        <div className="theater-section-head"><span>OBJECTIVES</span><span>45 MIN</span></div>
        <ul className="classroom-list">{t.objectives.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="theater-section">
        <div className="theater-section-head"><span>LESSON STEPS</span><span>HONEST LIMITS</span></div>
        <ol className="classroom-list numbered">{t.steps.map((item) => <li key={item}>{item}</li>)}</ol>
        <p className="compare-note">{t.offline}</p>
      </section>
      <section className="theater-section">
        <ClassroomQuiz lang={lang} />
      </section>
    </main>
  );
}
