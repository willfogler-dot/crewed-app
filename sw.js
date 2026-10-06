/* RRR100 — offline shell.
   Bump SHELL version to force clients to pick up an update. */
const SHELL = 'rrr-shell-v93';
const DOCS  = 'rrr-docs-v1';
const TILES = 'rrr-tiles-v1';
const FILES = [
  './', './index.html',
  // data and app are inlined into index.html
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== DOCS && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Map tiles: serve from cache first so a saved map works with no signal.
  if (/arcgisonline\.com|nationalmap\.gov|opentopomap\.org/.test(url.host)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).catch(() => new Response('', { status: 504 })))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Network-first for the shell so updates land, cache fallback when there is no signal.
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || caches.match('./index.html')))
  );
});
