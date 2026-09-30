import Link from 'next/link';

const stops = [
  ['LANDING', '/', '0:00 · Mars globe and mission introduction'], ['SURVIVAL', '/survival', '0:25 · The field challenge'],
  ['JEZERO', '/jezero', '0:38 · The science setting'], ['EONET', '/eonet', '0:50 · Live Earth events'],
  ['EXPLORE', '/explore', '1:15 · NASA Trek and Marswalk'], ['TRACES', '/traces', '2:25 · Local evidence'],
  ['OPS', '/ops', '2:40 · Simulated activity'], ['BRIEF', '/briefing/preview', '2:55 · Server PDF'],
  ['TARGETS', '/targets', '3:15 · Seeded science points'], ['HAZARDS', '/hazards', '3:27 · Non-certifying zones'],
  ['ARCH', '/architecture', '3:40 · Source boundaries'], ['STORY', '/story', '3:53 · Mission close'],
] as const;

export default function DemoTour({ active = '/' }: { active?: string }) {
  const index = Math.max(0, stops.findIndex(([, href]) => href === active));
  return <nav className="demo-tour" aria-label="Twelve-stop demo tour">{stops.map(([label, href, cue], i) => <Link key={href} className={i === index ? 'active' : i < index ? 'complete' : ''} href={href} title={cue} aria-label={`${label}: ${cue}`}><span>{String(i + 1).padStart(2, '0')}</span>{label}</Link>)}</nav>;
}
