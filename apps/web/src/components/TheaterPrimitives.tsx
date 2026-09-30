import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { DossierSection, SourceId } from '@/content/theater';
import { sources } from '@/content/theater';
import SourceModalLink from './ui/SourceModalLink';

export function StatStrip({ stats }: { stats: [string, string][] }) {
  return <div className="stat-strip">{stats.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>;
}
export function SectionBlock({ section, number }: { section: DossierSection; number: number }) {
  return <section className="dossier-section" id={section.id} aria-labelledby={`${section.id}-title`}>
    <div className="section-side"><span>{String(number).padStart(2, '0')}</span><small>{section.kicker}</small></div>
    <div className="section-main"><h2 id={`${section.id}-title`}>{section.title}</h2><p className="section-lead">{section.lead}</p>
      <ContentGrid points={section.points} />
      {section.sourceIds?.length && <div className="section-sources">{section.sourceIds.map((id) => <SourceModalLink key={id} title={sources[id].title} url={sources[id].url} context="DOSSIER / SOURCE RECORD" />)}</div>}
    </div>
  </section>;
}
export function ContentGrid({ points }: { points: string[] }) {
  return <div className="content-grid">{points.map((point, i) => <div key={point}><span>{String(i + 1).padStart(2, '0')}</span><p>{point}</p></div>)}</div>;
}
export function QuoteBand({ quote }: { quote: string }) { return <blockquote className="quote-band"><span>FIELD PRINCIPLE</span><p>{quote}</p></blockquote>; }
export function SourceRegister({ ids }: { ids: SourceId[] }) {
  return <section className="source-register"><div><span className="eyebrow">SOURCE REGISTER</span><h2>Open the record.</h2><p>Source links support factual claims; local annotations and planning scores remain labeled as demonstrations.</p></div><ul>{ids.map((id) => <li key={id}><SourceModalLink title={sources[id].title} url={sources[id].url} context="MISSION DOSSIER / SOURCE REGISTER" /></li>)}</ul></section>;
}
export function CTANext({ href, label }: { href: string; label: string }) {
  return <footer className="cta-next"><small>NEXT STOP / MARS EXPLORER</small><Link href={href}>{label} <ArrowUpRight size={22} /></Link></footer>;
}
