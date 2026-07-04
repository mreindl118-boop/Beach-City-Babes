// Service worker: offline play + versioned cache for auto-update.
// VERSION is kept in sync with js/version.js + version.json by tools/bump_version.py.
const VERSION = '0.3.0-alpha';
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
  const url = new URL(e.request.url);
  // version.json is the update beacon — always hit the network for it
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // shell: stale-while-revalidate — fast offline play, fresh next launch
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET' && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
