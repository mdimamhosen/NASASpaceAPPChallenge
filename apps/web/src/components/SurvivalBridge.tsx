'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { earthMarsGeometry } from '@mars-explorer/shared';

type Props = { lang?: 'en' | 'bn' };

export default function SurvivalBridge({ lang = 'en' }: Props) {
  const [light, setLight] = useState<{ min: number; au: number } | null>(null);
  useEffect(() => {
    const g = earthMarsGeometry(new Date());
    setLight({ min: Number(g.lightMinutes.toFixed(1)), au: Number(g.au.toFixed(4)) });
  }, []);

  const en = {
    title: 'SURVIVAL BRIDGE · EARTH ↔ MARS',
    earth: 'Earth hazard awareness (NASA EONET) stays on the Earth lane — wildfires, storms, ice.',
    mars: 'Mars traverse evidence uses PLACES localizations, Trek imagery, and the orbital DEM — never EONET geometry.',
    delay: light ? `One-way light time now ≈ ${light.min} min (${light.au} AU). Plan as if Earth cannot answer in real time.` : 'Light time from JPL approximate elements.',
    analog: 'Analogy ≠ transfer',
  };
  const bn = {
    title: 'সারভাইভাল ব্রিজ · পৃথিবী ↔ মঙ্গল',
    earth: 'পৃথিবীর ঝুঁকি সচে্যতনতা (NASA EONET) শুধু Earth লেনে — দাবানল, ঝড়, বরফ।',
    mars: 'মঙ্গল মার্সওয়াক প্রমাণ PLACES, Trek ও DEM ব্যবহার করে — EONET জ্যামিতি কখনো নয়।',
    delay: light ? `একমুখী আলোর সময় ≈ ${light.min} মিনিট (${light.au} AU)। পৃথিবী রিয়েল-টাইমে উত্তর দিতে পারে না ধরে পরিকল্পনা করুন।` : 'JPL আনুমানিক উপাদান থেকে আলোর সময়।',
    analog: 'সাদৃশ্য ≠ স্থানান্তর',
  };
  const t = lang === 'bn' ? bn : en;

  return (
    <section className="survival-bridge" aria-label={t.title}>
      <strong>{t.title}</strong>
      <div className="survival-bridge-grid">
        <article>
          <span>EARTH / EONET</span>
          <p>{t.earth}</p>
          <Link href="/eonet">OPEN EARTH LANE ↗</Link>
        </article>
        <article>
          <span>MARS / PLACES · DEM</span>
          <p>{t.mars}</p>
          <Link href="/explore">OPEN MARSWALK ↗</Link>
        </article>
      </div>
      <p className="survival-bridge-delay">{t.delay}</p>
      <Link className="survival-bridge-analog" href="/analog">{t.analog} · /analog ↗</Link>
    </section>
  );
}
