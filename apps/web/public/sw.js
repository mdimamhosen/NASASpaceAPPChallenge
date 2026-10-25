/* Mars Explorer offline service worker. Plain JS, no build step.
 * Pages: network first, cached copy offline. Next static assets: cache first (content-hashed).
 * NASA Trek tiles: cache first, capped. API GET snapshots: network first, cached copy offline. Nothing else is cached. */
const VERSION = 'me-v1';
const SHELL = ['/', '/explore', '/survival', '/timeline', '/validation', '/research', '/classroom', '/science', '/offline.html'];
const TILE_CAP = 1500;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(`${VERSION}-pages`).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request, { ignoreSearch: false })) || (fallbackUrl && (await caches.match(fallbackUrl))) || Response.error();
  }
}

async function cacheFirst(request, cacheName, cap) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') { cache.put(request, res.clone()); if (cap) trim(cacheName, cap); }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/_next/webpack-hmr') || url.pathname.includes('/socket.io/')) return;
  if (request.mode === 'navigate') { event.respondWith(networkFirst(request, `${VERSION}-pages`, '/offline.html')); return; }
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) { event.respondWith(cacheFirst(request, `${VERSION}-static`)); return; }
  if (url.hostname === 'trek.nasa.gov') { event.respondWith(cacheFirst(request, `${VERSION}-tiles`, TILE_CAP)); return; }
  // API snapshots (any origin serving the Mars Explorer API paths); streaming endpoints are never cached.
  if (/^\/(places|routes|regions|layers|opendata|raw-images|eonet|validation|health|rag\/(status|eval|documents))/.test(url.pathname) && !url.pathname.includes('stream')) {
    event.respondWith(networkFirst(request, `${VERSION}-api`));
  }
});
