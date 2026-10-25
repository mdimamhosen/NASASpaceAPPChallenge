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
import SurvivalBridge from './SurvivalBridge';
import CommBlackoutCalendar from './CommBlackoutCalendar';
import WeatherPanel from './WeatherPanel';
import LandingMatrix from './LandingMatrix';
import LocalizedCopy from './LocalizedCopy';
import WalkthroughVideo from './WalkthroughVideo';

/** Data-driven 3D section per dossier; every scene is built from published NASA products. */
type Scene3D = { variant: Data3DVariant; eyebrow: string; title: string; body: string; showPois?: boolean };
const scenes3d: Record<string, Scene3D[]> = {
  survival: [
    { variant: 'planets', eyebrow: 'THE CHALLENGE / ANOTHER PLANET', title: 'Half the size. A slightly longer day.', body: 'Earth and Mars at true relative scale, tilt, and spin. A Marswalk happens under 38% of Earth’s gravity on a world about half as wide.' },
    { variant: 'suitability', eyebrow: 'SURVIVAL / WHERE TO SETTLE', title: 'Where would you put the habitat?', body: 'Every DEM cell scored on slope, roughness, elevation, distance to science targets and to ground Perseverance already drove. Beacons mark the five best, at least 500 m apart.' },
    { variant: 'eva', eyebrow: 'SURVIVAL / CAN WE WALK IT?', title: 'A Marswalk, metre by metre.', body: 'The landing-to-sol-400 route walked at suited speed: steep segments glow orange, and the pillar grows with radiation dose at the rate Curiosity measured.' },
    { variant: 'los', eyebrow: 'SURVIVAL / CAN WE TALK?', title: 'Can two crews hear each other?', body: 'A radio ray between two 2 m masts, checked against every DEM cell and the curve of Mars. Green is clear; red is blocked by terrain.' },
    { variant: 'swim', eyebrow: 'SURVIVAL / WATER', title: 'Is there ice under Jezero?', body: 'NASA-funded SWIM mapping combines neutron, thermal, radar and landform data into one consistency score. Around Jezero every cell reads inconsistent with shallow ice.' },
    { variant: 'season', eyebrow: 'SURVIVAL / SEASONS', title: 'Plan around the dust.', body: 'The Martian year by solar longitude. Mars swings closer to the Sun near Ls 251°, and global dust storms cluster in the orange arc.' },
  ],
  mission: [
    { variant: 'cube', eyebrow: 'MISSION / SPACE-TIME CUBE', title: 'Every sol, stacked.', body: 'Each point is a published PLACES localization. Ground position is where the rover was; height is when. Steep climbs mean long stays, flat runs mean long drives.' },
    { variant: 'edl', eyebrow: 'MISSION / ARRIVAL', title: 'Seven minutes through thin air.', body: 'A capsule falls through Mars’ exponential atmosphere. Density shells thicken toward the ground, and the red ring marks where deceleration peaks.' },
    { variant: 'ingenuity', eyebrow: 'MISSION / FIRST FLIGHT ON ANOTHER WORLD', title: '72 flights over Jezero.', body: 'Every Ingenuity flight track from NASA’s Mars 2020 map, arched over the crater floor. Scrub the slider to replay the campaign.' },
    { variant: 'samples', eyebrow: 'MISSION / SAMPLE RETURN', title: 'The tubes waiting for Earth.', body: 'Every Perseverance sample: the Three Forks depot row, and the tubes still riding on the rover. Click a tube to read its record.' },
  ],
  timeline: [
    { variant: 'orbit', eyebrow: 'TIMELINE / ORBITAL GEOMETRY', title: 'Where Earth and Mars are, any day.', body: 'Scrub from the Mars 2020 launch to two years ahead. Distance and light delay come from NASA JPL orbital elements, so the gap a command must cross is real.' },
    { variant: 'conjunction', eyebrow: 'TIMELINE / RADIO SILENCE', title: 'When the Sun gets in the way.', body: 'The Earth–Mars radio line turns red whenever the Sun sits within 3° of Mars. Jump to any blackout from 2021 to 2030.' },
    { variant: 'sun', eyebrow: 'TIMELINE / TODAY ON MARS', title: 'The sun over Jezero, right now.', body: 'Today’s sun path across the Jezero sky from the NASA Mars24 algorithm, with sunrise, sunset and the sun’s position this minute.' },
  ],
  jezero: [
    { variant: 'columns', eyebrow: 'JEZERO / MEASURED RELIEF', title: 'The crater, cell by cell.', body: 'Every column is one sampled cell of the Mars 2020 PLACES orbital DEM: the low crater floor in dark, the delta front and western rim rising in sand and white.' },
    { variant: 'iau', eyebrow: 'JEZERO / OFFICIAL NAMES', title: 'Every name on the map is official.', body: 'IAU-approved craters and valleys within 3° of Jezero, sized by diameter, from the USGS Gazetteer of Planetary Nomenclature.' },
  ],
  data: [
    { variant: 'sites', eyebrow: 'DATA / LANDING RECORD', title: 'Nine NASA landings, one globe.', body: 'Every successful NASA Mars landing on the Viking global mosaic, from Chryse Planitia in 1976 to Jezero in 2021, in chronological order.' },
    { variant: 'hirise', eyebrow: 'DATA / FINER ELEVATION', title: 'Where 1-metre terrain exists.', body: 'Footprints of HiRISE digital terrain models around Jezero from the PDS index on data.nasa.gov. Finer post spacing floats higher.' },
  ],
  architecture: [
    { variant: 'agent', eyebrow: 'ARCHITECTURE / AGENT', title: 'Watch the agent think.', body: 'Every mission-agent tool as a node. Pick a question: the agent runs for real, and each tool it calls lights up.' },
  ],
};

export default function TheaterPage({ page, active }: { page: string; active?: string }) {
  const data = dossiers[page];
  if (!data) return null;
  const cinematic = page === 'survival' || page === 'jezero' || page === 'story';
  const sourceIds = [...new Set(data.sections.flatMap((section) => section.sourceIds ?? []))] as SourceId[];
  return <main className="theater-page dossier-page"><MissionNav active={active ?? `/${page}`} />
    <header className={`dossier-hero ${cinematic ? 'dossier-hero-cinematic' : ''} ${page === 'story' ? 'dossier-hero-story' : ''}`}><div className="dossier-hero-copy"><p className="eyebrow">{data.eyebrow}</p>{page === 'survival' ? <LocalizedCopy as="h1" id="survivalTitle" /> : <h1>{data.title}</h1>}<p>{data.deck}</p><Link href="#contents" className="hero-scroll">READ THE DOSSIER <span>↓</span></Link></div><SceneStage kind={data.scene} className="dossier-scene" permanent={cinematic} /></header>
    <StatStrip stats={data.stats} />
    {page === 'jezero' && <RegionFactsWidget />}
    {page === 'data' && <LayerCatalogWidget />}
    {page === 'architecture' && <ArchitectureFlow />}
    {page === 'gallery' && <GalleryGrid />}
    {(page === 'timeline' || page === 'survival') && <CommBlackoutCalendar />}
    {page === 'survival' && <WeatherPanel />}
    {page === 'data' && <LandingMatrix />}
    {page === 'story' && <WalkthroughVideo />}
    {(scenes3d[page] ?? []).map((scene) => <Data3DSection key={scene.variant} {...scene} cta={{ href: '/explore?view=3d', label: 'OPEN IN 3D CONSOLE' }} />)}
    <nav id="contents" className="dossier-subnav" aria-label={`${page} sections`}><strong>IN THIS DOSSIER</strong>{data.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>
    <div className="dossier-body">{data.sections.map((section, index) => <SectionBlock key={section.id} section={section} number={index + 1} />)}</div>
    {page === 'analog' && <EarthAnalogPanel />}
    {(page === 'survival' || page === 'analog') && <div className="theater-survival-bridge"><SurvivalBridge /></div>}
    <QuoteBand quote={data.quote} />
    <SourceRegister ids={sourceIds} />
    <CTANext href={data.next} label={data.nextLabel} />
  </main>;
}
