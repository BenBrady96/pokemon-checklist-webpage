const VERSION = 'dev';
const SHELL_CACHE = `p30c-shell-${VERSION}`;
const IMAGE_CACHE = 'p30c-img-v1';
const NETWORK_TIMEOUT_MS = 2500;

const SHELL = [
  './',
  'index.html',
  'privacy.html',
  'terms.html',
  'manifest.webmanifest',
  'css/styles.css',
  'fonts/outfit-latin.woff2',
  'js/app.js',
  'js/cards.js',
  'js/card-colors.js',
  'js/confetti.js',
  'js/gestures.js',
  'js/info.js',
  'js/prices.js',
  'js/pricing.js',
  'js/pwa.js',
  'js/quickadd.js',
  'js/render.js',
  'js/stats.js',
  'js/store.js',
  'js/sync.js',
  'js/ui.js',
  'js/viewer.js',
  'js/vendor/qrcode.js',
  'img/icons/favicon.svg',
  'img/icons/favicon-32.png',
  'img/icons/icon-192.png',
  'img/icons/icon-512.png',
  'img/icons/icon-maskable-512.png',
  'img/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('p30c-shell-') && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/img/cards/')) event.respondWith(cacheFirst(request));
  else event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const network = fetch(request, { cache: 'no-cache' }).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
  const fresh = await Promise.race([network.catch(() => null), timeout]);
  if (fresh) return fresh;
  const cached = (await cache.match(request, { ignoreSearch: true }))
    || (request.mode === 'navigate' ? (await cache.match('index.html')) || (await cache.match('./')) : undefined);
  return cached || network;
}
