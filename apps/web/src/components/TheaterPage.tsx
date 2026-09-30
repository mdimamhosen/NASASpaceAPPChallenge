import Link from 'next/link';
import MissionNav from './MissionNav';
import GalleryGrid from './GalleryGrid';
import EarthAnalogPanel from './EarthAnalogPanel';
import SceneStage from './scenes/SceneStage';
import ArchitectureFlow from './ArchitectureFlow';
import RegionFactsWidget from './RegionFactsWidget';
import LayerCatalogWidget from './LayerCatalogWidget';
import { dossiers, type SourceId } from '@/content/theater';
import { CTANext, QuoteBand, SectionBlock, SourceRegister, StatStrip } from './TheaterPrimitives';

export default function TheaterPage({ page, active }: { page: string; active?: string }) {
  const data = dossiers[page];
  if (!data) return null;
  const sourceIds = [...new Set(data.sections.flatMap((section) => section.sourceIds ?? []))] as SourceId[];
  return <main className="theater-page dossier-page"><MissionNav active={active ?? `/${page}`} />
    <header className={`dossier-hero ${page === 'survival' || page === 'jezero' ? 'dossier-hero-cinematic' : ''}`}><div className="dossier-hero-copy"><p className="eyebrow">{data.eyebrow}</p><h1>{data.title}</h1><p>{data.deck}</p><Link href="#contents" className="hero-scroll">READ THE DOSSIER <span>↓</span></Link></div><SceneStage kind={data.scene} className="dossier-scene" permanent={page === 'survival' || page === 'jezero'} /></header>
    <StatStrip stats={data.stats} />
    {page === 'jezero' && <RegionFactsWidget />}
    {page === 'data' && <LayerCatalogWidget />}
    {page === 'architecture' && <ArchitectureFlow />}
    {page === 'gallery' && <GalleryGrid />}
    <nav id="contents" className="dossier-subnav" aria-label={`${page} sections`}><strong>IN THIS DOSSIER</strong>{data.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>
    <div className="dossier-body">{data.sections.map((section, index) => <SectionBlock key={section.id} section={section} number={index + 1} />)}</div>
    {page === 'analog' && <EarthAnalogPanel />}
    <QuoteBand quote={data.quote} />
    <SourceRegister ids={sourceIds} />
    <CTANext href={data.next} label={data.nextLabel} />
  </main>;
}
