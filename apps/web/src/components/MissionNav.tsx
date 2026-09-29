import Link from 'next/link';
import DemoTour from './DemoTour';

const links = [
  ['SURVIVAL', '/survival'], ['JEZERO', '/jezero'], ['EONET', '/eonet'], ['EXPLORE', '/explore'],
  ['TARGETS', '/targets'], ['HAZARDS', '/hazards'], ['OPS', '/ops'], ['TRACES', '/traces'],
  ['BRIEFING', '/briefing/preview'], ['PIPELINE', '/pipeline'], ['ARCHITECTURE', '/architecture'],
  ['STORY', '/story'], ['SCIENCE', '/science'],
] as const;

export default function MissionNav({ active }: { active?: string }) {
  return <><header className="mission-nav">
    <Link className="mission-nav-brand" href="/"><span className="brand-mark">M / E</span><span><strong>MARS EXPLORER</strong><small>FIELD SYSTEMS / JEZERO</small></span></Link>
    <nav aria-label="Mission pages">{links.map(([label, href]) => <Link key={href} className={active === href ? 'active' : ''} href={href}>{label}</Link>)}</nav>
    <Link className="mission-nav-tour" href="/survival">DEMO TOUR <span>↗</span></Link>
  </header><DemoTour active={active} /></>;
}
