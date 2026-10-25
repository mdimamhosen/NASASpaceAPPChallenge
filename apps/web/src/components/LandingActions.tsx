'use client';
import Link from 'next/link';
import { useUiLanguage } from '@/lib/use-ui-language';
import { uiText } from '@/lib/ui-copy';

export default function LandingActions() {
  const { language } = useUiLanguage();
  return <div className="landing-actions">
    <Link href="/explore" className="enter-button">{uiText('landingConsole', language)} <span>↗</span></Link>
    <Link href="/survival" className="tour-button">{uiText('landingTour', language)} <span>↗</span></Link>
    <Link href="/game" className="tour-button landing-game-link">{uiText('landingGame', language)} <span>↗</span></Link>
  </div>;
}
