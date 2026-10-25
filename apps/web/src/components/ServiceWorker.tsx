'use client';

import { useEffect } from 'react';

/** Registers the offline service worker in production builds (dev keeps hot reload clean). */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_SW !== '1') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
