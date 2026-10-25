'use client';
import Link from 'next/link';
import { UI_COPY, type UiCopyKey } from '@/lib/ui-copy';
import { useUiLanguage } from '@/lib/use-ui-language';

const links: Array<[UiCopyKey, string]> = [
  ['survival','/survival'],['jezero','/jezero'],['eonet','/eonet'],['explore','/explore'],['game','/game'],['classroom','/classroom'],['targets','/targets'],['hazards','/hazards'],['ops','/ops'],['traces','/traces'],['research','/research'],['briefing','/briefing/preview'],['pipeline','/pipeline'],['architecture','/architecture'],['story','/story'],['openData','/opendata'],['science','/science'],['validation','/validation'],
];
export default function MissionLinks({ active }: { active?: string }) {
  const { language, toggle } = useUiLanguage();
  return <><nav aria-label="Mission pages">{links.map(([key, href]) => <Link key={href} className={active === href ? 'active' : ''} href={href}>{UI_COPY[key][language]}</Link>)}</nav><button className="mission-lang-toggle" type="button" onClick={toggle} aria-label={language === 'en' ? 'Switch interface to Bangla' : 'Switch interface to English'}>{language === 'en' ? 'EN | বাংলা' : 'বাংলা | EN'}</button></>;
}
