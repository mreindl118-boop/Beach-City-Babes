// Service worker: offline play + versioned cache for auto-update.
// VERSION is kept in sync with js/version.js + version.json by tools/bump_version.py.
const VERSION = '0.12.1-alpha';
const CACHE = `bcb-v${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/rng.js',
  './js/data.js',
  './js/characters.js',
  './js/art.js',
  './js/dialogue.js',
  './js/game.js',
  './js/version.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // version.json is the update beacon — always hit the network for it
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Network-first for our own code/assets: an online player always runs the
  // newest build; the cache is only a fallback when offline. (Stale-while-
  // revalidate served old JS for a whole extra launch — that broke updates.)
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // cross-origin: cache-first
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
