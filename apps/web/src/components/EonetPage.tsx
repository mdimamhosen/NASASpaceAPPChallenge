import LongFormExtras from './LongFormExtras';
import EarthEventsExplorer from './EarthEventsExplorer';
import EonetHeroScene from './scenes/EonetHeroScene';
import MissionNav from './MissionNav';
import LocalizedCopy from './LocalizedCopy';

export default function EonetPage() {
  return <main className="theater-page"><MissionNav active="/eonet" />
    <section className="theater-hero eonet-hero"><div><p className="eyebrow">EARTH / NASA EONET V3</p><LocalizedCopy as="h1" id="eonetTitle" /><LocalizedCopy as="p" id="eonetLead" /></div><EonetHeroScene /></section>
    <EarthEventsExplorer mode="eonet" />
    <LongFormExtras page="eonet" />
  </main>;
}
