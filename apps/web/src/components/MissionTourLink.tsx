'use client';
import Link from 'next/link';
import { uiText } from '@/lib/ui-copy';
import { useUiLanguage } from '@/lib/use-ui-language';
export default function MissionTourLink() {
  const { language } = useUiLanguage();
  return <Link className="mission-nav-tour" href="/survival">{uiText('demoTour', language)} <span>↗</span></Link>;
}
