/* TITAN PWA — caché de shell + offline básico. Bump CACHE_NAME al cambiar assets críticos. */
const CACHE_NAME = 'titan-pwa-v1';
const CORE_ASSETS = [
  './index.html',
  './styles.css',
  './app.js',
  './public/manifest.json',
  './public/icons/icon-180.png',
  './public/icons/icon-192.png',
  './public/icons/icon-512.png',
  './public/icons/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of CORE_ASSETS) {
        try {
          await cache.add(url);
        } catch {
          /* Un 404 en un asset no debe bloquear el registro del SW */
        }
      }
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok && res.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => {
          if (event.request.mode === 'navigate' || event.request.destination === 'document') {
            return caches.match('./index.html');
          }
          return Promise.reject(new Error('offline'));
        });
    })
  );
});
