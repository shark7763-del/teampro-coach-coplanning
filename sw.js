const APP_VERSION = '1.1.0-internal';
const CACHE_NAME = 'teampro-coplanning-v2';
const STATIC_ASSETS = [
  './manifest.webmanifest',
  './共同備課logo.png',
  './學員名單範本.csv'
];
const OPTIONAL_ASSETS = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(STATIC_ASSETS.map(url => cache.add(url).catch(() => null)));
    await Promise.all(OPTIONAL_ASSETS.map(url => fetch(url).then(res => {
      if (res && res.ok) return cache.put(url, res.clone());
      return null;
    }).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';
  const isIndex = url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isNavigation || isIndex) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});
