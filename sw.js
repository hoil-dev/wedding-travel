const CACHE = 'honeymoon-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/docs/mbs-confirm.png',
  '/docs/pullman-confirm.png',
  '/docs/flight-out.png',
  '/docs/flight-ret.png',
  '/docs/maldives-v.png',
  '/docs/tips/tip-001.jpg',
  '/docs/tips/tip-002.jpg',
  '/docs/tips/tip-003.jpg',
  '/docs/tips/tip-004.jpg',
  '/docs/tips/tip-005.jpg',
  '/docs/tips/tip-006.jpg',
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
