/* Offline cache for Inkboard. Bump CACHE when you change app files. */
const CACHE = 'inkboard-v10';
// pdf.js fonts/cmaps aren't listed; they're cached on first use by the fetch handler.
const ASSETS = [
  './vendor/pdfjs/pdf.min.mjs',
  './vendor/pdfjs/pdf.worker.min.mjs',
  './',
  './index.html',
  './styles.css',
  './app.js',
  './api.js',
  './library.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache so a new CACHE version never stores stale files.
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first (so updates on your server show up), falling back to cache when offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // API calls and server files are private and always live: never cache them.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  event.respondWith(
    // cache: 'no-cache' revalidates with the server instead of trusting the HTTP cache.
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => {
        if (hit) return hit;
        // Only page loads fall back to the app shell; other misses stay real errors.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })),
  );
});
