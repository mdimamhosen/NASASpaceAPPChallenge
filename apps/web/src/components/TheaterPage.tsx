import Link from 'next/link';
import MissionNav from './MissionNav';
import GalleryGrid from './GalleryGrid';
import EarthAnalogPanel from './EarthAnalogPanel';
import SceneStage from './scenes/SceneStage';
import ArchitectureFlow from './ArchitectureFlow';
import Data3DSection, { type Data3DVariant } from './scenes/Data3DSection';
import RegionFactsWidget from './RegionFactsWidget';
import LayerCatalogWidget from './LayerCatalogWidget';
import { dossiers, type SourceId } from '@/content/theater';
import { CTANext, QuoteBand, SectionBlock, SourceRegister, StatStrip } from './TheaterPrimitives';

/** Data-driven 3D section per dossier; every scene is built from published NASA products. */
const scenes3d: Record<string, { variant: Data3DVariant; eyebrow: string; title: string; body: string; showPois?: boolean }> = {
  survival: { variant: 'planets', eyebrow: 'THE CHALLENGE / ANOTHER PLANET', title: 'Half the size. A slightly longer day.', body: 'Earth and Mars at true relative scale, tilt, and spin. A Marswalk happens under 38% of Earth’s gravity on a world about half as wide.' },
  mission: { variant: 'cube', eyebrow: 'MISSION / SPACE-TIME CUBE', title: 'Every sol, stacked.', body: 'Each point is a published PLACES localization. Ground position is where the rover was; height is when. Steep climbs mean long stays, flat runs mean long drives.' },
  timeline: { variant: 'orbit', eyebrow: 'TIMELINE / ORBITAL GEOMETRY', title: 'Where Earth and Mars are, any day.', body: 'Scrub from the Mars 2020 launch to two years ahead. Distance and light delay come from NASA JPL orbital elements, so the gap a command must cross is real.' },
  jezero: { variant: 'columns', eyebrow: 'JEZERO / MEASURED RELIEF', title: 'The crater, cell by cell.', body: 'Every column is one sampled cell of the Mars 2020 PLACES orbital DEM: the low crater floor in dark, the delta front and western rim rising in sand and white.' },
  data: { variant: 'sites', eyebrow: 'DATA / LANDING RECORD', title: 'Nine NASA landings, one globe.', body: 'Every successful NASA Mars landing on the Viking global mosaic, from Chryse Planitia in 1976 to Jezero in 2021, in chronological order.' },
};

export default function TheaterPage({ page, active }: { page: string; active?: string }) {
  const data = dossiers[page];
  if (!data) return null;
  const cinematic = page === 'survival' || page === 'jezero' || page === 'story';
  const sourceIds = [...new Set(data.sections.flatMap((section) => section.sourceIds ?? []))] as SourceId[];
  return <main className="theater-page dossier-page"><MissionNav active={active ?? `/${page}`} />
    <header className={`dossier-hero ${cinematic ? 'dossier-hero-cinematic' : ''} ${page === 'story' ? 'dossier-hero-story' : ''}`}><div className="dossier-hero-copy"><p className="eyebrow">{data.eyebrow}</p><h1>{data.title}</h1><p>{data.deck}</p><Link href="#contents" className="hero-scroll">READ THE DOSSIER <span>↓</span></Link></div><SceneStage kind={data.scene} className="dossier-scene" permanent={cinematic} /></header>
    <StatStrip stats={data.stats} />
    {page === 'jezero' && <RegionFactsWidget />}
    {page === 'data' && <LayerCatalogWidget />}
    {page === 'architecture' && <ArchitectureFlow />}
    {page === 'gallery' && <GalleryGrid />}
    {scenes3d[page] && <Data3DSection {...scenes3d[page]} cta={{ href: '/explore?view=3d', label: 'OPEN IN 3D CONSOLE' }} />}
    <nav id="contents" className="dossier-subnav" aria-label={`${page} sections`}><strong>IN THIS DOSSIER</strong>{data.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>
    <div className="dossier-body">{data.sections.map((section, index) => <SectionBlock key={section.id} section={section} number={index + 1} />)}</div>
    {page === 'analog' && <EarthAnalogPanel />}
    <QuoteBand quote={data.quote} />
    <SourceRegister ids={sourceIds} />
    <CTANext href={data.next} label={data.nextLabel} />
  </main>;
}
