import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mars Explorer — Survival Field Guide',
    short_name: 'Mars Explorer',
    description: 'Plan an evidence-led Marswalk at Jezero Crater with NASA surface data. Works offline once visited.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0E14',
    theme_color: '#0B0E14',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
