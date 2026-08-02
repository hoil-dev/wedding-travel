const CACHE = 'honeymoon-v5';
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
  BASE + '/docs/tips/tip-001.png',
  BASE + '/docs/tips/tip-002.png',
  BASE + '/docs/tips/tip-003.png',
  BASE + '/docs/tips/tip-004.png',
  BASE + '/docs/tips/tip-005.png',
  BASE + '/docs/tips/tip-006.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      // 파일 하나 실패해도 전체가 죽지 않도록 개별 처리
      await Promise.allSettled(ASSETS.map(url =>
        c.add(url).catch(err => console.warn('SW cache skip:', url, err.message))
      ));
      return self.skipWaiting();
    })
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
