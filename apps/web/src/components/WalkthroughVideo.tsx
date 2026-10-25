import Link from 'next/link';
import LocalizedCopy from './LocalizedCopy';

export default function WalkthroughVideo() {
  return <section className="walkthrough-video" aria-labelledby="walkthrough-title">
    <div><span className="eyebrow">LOCAL MISSION WALKTHROUGH / 04:00</span><LocalizedCopy as="h2" id="landingStoryTitle" className="walkthrough-heading" /><LocalizedCopy as="p" id="landingStoryLead" /><Link href="https://www.youtube.com/watch?v=aB2ijaWs3-4" target="_blank" rel="noreferrer">OPEN THE YOUTUBE CUT ↗</Link></div>
    <video controls preload="none" playsInline src="/video/mars-explorer-240s.mp4" aria-label="Mars Explorer four-minute project walkthrough"><track kind="captions" srcLang="en" src="/video/mars-explorer-240s.vtt" label="English captions" /></video>
  </section>;
}
