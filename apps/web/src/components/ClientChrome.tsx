'use client';

import dynamic from 'next/dynamic';
import GlobalCommandPalette from './GlobalCommandPalette';
import ServiceWorker from './ServiceWorker';

const VoiceGlobe = dynamic(() => import('./voice/VoiceGlobe'), { ssr: false });

/** Site-wide chrome: Siri-style voice orb + global ⌘K search. */
export default function ClientChrome() {
  return (
    <>
      <GlobalCommandPalette />
      <VoiceGlobe />
      <ServiceWorker />
    </>
  );
}
