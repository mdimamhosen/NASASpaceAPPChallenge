import Link from 'next/link';
import DemoTour from './DemoTour';
import MissionLinks from './MissionLinks';
import MissionTourLink from './MissionTourLink';

export default function MissionNav({ active }: { active?: string }) {
  return <><header className="mission-nav">
    <Link className="mission-nav-brand" href="/"><span className="brand-mark">M / E</span><span><strong>MARS EXPLORER</strong><small>FIELD SYSTEMS / JEZERO</small></span></Link>
    <MissionLinks active={active} />
    <MissionTourLink />
  </header><DemoTour active={active} /></>;
}
