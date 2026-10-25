'use client';
import { useEffect, useState } from 'react';
import type { UiLanguage } from './ui-copy';

export function useUiLanguage() {
  const [language, setLanguage] = useState<UiLanguage>('en');
  useEffect(() => {
    const sync = () => {
      const stored = localStorage.getItem('me_lang');
      const next = stored === 'bn' ? 'bn' : 'en';
      setLanguage(next);
      document.documentElement.lang = next;
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('me-language-change', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('me-language-change', sync); };
  }, []);
  const toggle = () => {
    const next = language === 'en' ? 'bn' : 'en';
    localStorage.setItem('me_lang', next);
    setLanguage(next);
    document.documentElement.lang = next;
    window.dispatchEvent(new Event('me-language-change'));
  };
  return { language, toggle };
}
