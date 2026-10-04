'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const stops = [
  ['LANDING', '/', '0:00 · Mars globe and mission introduction'],
  ['SURVIVAL', '/survival', '0:25 · The field challenge'],
  ['JEZERO', '/jezero', '0:38 · Jezero science setting'],
  ['EONET', '/eonet', '0:50 · Live NASA Earth events'],
  ['EXPLORE', '/explore', '1:15 · PLACES track and NASA Trek Marswalk'],
  ['TRACES', '/traces', '2:25 · Durable evidence traces'],
  ['BRIEF', '/briefing/preview', '2:55 · Server PDF'],
  ['TARGETS', '/targets', '3:15 · Demo seed science points'],
  ['HAZARDS', '/hazards', '3:27 · Non-certifying demo zones'],
  ['ARCH', '/architecture', '3:40 · Source boundaries'],
  ['STORY', '/story', '3:53 · Mission close'],
] as const;

export default function DemoTour({ active = '/' }: { active?: string }) {
  const router = useRouter();
  const [playing,setPlaying] = useState(false);
  const [step,setStep] = useState(0);
  const index = Math.max(0, stops.findIndex(([, href]) => href.split('?')[0] === active));
  useEffect(() => {
    const saved = sessionStorage.getItem('mars-tour-step');
    if (saved != null) { setStep(Number(saved)); setPlaying(true); }
  }, []);
  useEffect(() => {
    if (!playing) return;
    if (step >= stops.length - 1) { sessionStorage.removeItem('mars-tour-step'); setPlaying(false); return; }
    const timer = window.setTimeout(() => {
      const next = step + 1;
      sessionStorage.setItem('mars-tour-step',String(next));
      setStep(next);
      router.push(stops[next][1]);
    }, step === 4 ? 30000 : 16000);
    return () => window.clearTimeout(timer);
  }, [playing,step,router]);
  const toggle = () => {
    if (playing) { setPlaying(false); sessionStorage.removeItem('mars-tour-step'); }
    else { setStep(index); sessionStorage.setItem('mars-tour-step',String(index)); setPlaying(true); }
  };
  return <><nav className="demo-tour" aria-label="Eleven-stop demo tour">{stops.map(([label,href,cue],i) => <Link key={`${href}-${i}`} className={i === index ? 'active' : i < index ? 'complete' : ''} href={href} title={cue} aria-label={`${label}: ${cue}`} onClick={() => { if (playing) { setPlaying(false); sessionStorage.removeItem('mars-tour-step'); } }}><span>{String(i+1).padStart(2,'0')}</span>{label}</Link>)}<button className="tour-play" onClick={toggle} aria-label={playing?'Pause story mode':'Autoplay story mode'}>{playing?'PAUSE STORY':'PLAY STORY ▶'}</button></nav>{playing && <div className="story-caption" role="status"><strong>STORY MODE / {String(step+1).padStart(2,'0')}</strong><span>{stops[step][2]}</span></div>}</>;
}
