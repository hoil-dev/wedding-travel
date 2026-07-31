const CACHE = 'honeymoon-v4';
const BASE  = '/wedding-travel';
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/styles.css',
  BASE + '/app.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
  BASE + '/docs/mbs-confirm.png',
  BASE + '/docs/pullman-confirm.png',
  BASE + '/docs/flight-out.png',
  BASE + '/docs/flight-ret.png',
  BASE + '/docs/maldives-v.png',
  BASE + '/docs/tips/tip-001.jpg',
  BASE + '/docs/tips/tip-002.jpg',
  BASE + '/docs/tips/tip-003.jpg',
  BASE + '/docs/tips/tip-004.jpg',
  BASE + '/docs/tips/tip-005.jpg',
  BASE + '/docs/tips/tip-006.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});
