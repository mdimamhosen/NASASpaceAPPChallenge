import Link from 'next/link';

const stops = [
  ['LANDING', '/'], ['SURVIVAL', '/survival'], ['JEZERO', '/jezero'], ['EONET', '/eonet'],
  ['EXPLORE', '/explore'], ['TRACES', '/traces'], ['OPS', '/ops'], ['BRIEF', '/briefing/preview'],
  ['TARGETS', '/targets'], ['HAZARDS', '/hazards'], ['ARCH', '/architecture'], ['STORY', '/story'],
] as const;

export default function DemoTour({ active = '/' }: { active?: string }) {
  const index = Math.max(0, stops.findIndex(([, href]) => href === active));
  return <nav className="demo-tour" aria-label="Twelve-stop demo tour">{stops.map(([label, href], i) => <Link key={href} className={i === index ? 'active' : i < index ? 'complete' : ''} href={href}><span>{String(i + 1).padStart(2, '0')}</span>{label}</Link>)}</nav>;
}
