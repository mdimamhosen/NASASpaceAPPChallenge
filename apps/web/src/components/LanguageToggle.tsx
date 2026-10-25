'use client';
import { useUiLanguage } from '@/lib/use-ui-language';

export default function LanguageToggle() {
  const { language, toggle } = useUiLanguage();
  return <button className="mission-lang-toggle" type="button" onClick={toggle} aria-label={language === 'en' ? 'Switch interface to Bangla' : 'Switch interface to English'}>{language === 'en' ? 'EN | বাংলা' : 'বাংলা | EN'}</button>;
}
