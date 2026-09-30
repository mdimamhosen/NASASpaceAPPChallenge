import LongFormExtras from './LongFormExtras';
import EarthEventsExplorer from './EarthEventsExplorer';
import EonetHeroScene from './scenes/EonetHeroScene';
import MissionNav from './MissionNav';

export default function EonetPage() {
  return <main className="theater-page"><MissionNav active="/eonet" />
    <section className="theater-hero eonet-hero"><div><p className="eyebrow">EARTH / NASA EONET V3</p><h1>Another planet. A separate map.</h1><p>Current Earth events offer comparison questions. Their coordinates belong to Earth and never enter the Mars Trek route analysis.</p></div><EonetHeroScene /></section>
    <EarthEventsExplorer mode="eonet" />
    <LongFormExtras page="eonet" />
  </main>;
}
