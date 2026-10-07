const VERSION = 'dev';
const SHELL_CACHE = `bt-shell-${VERSION}`;
const PAGE_CACHE = 'bt-pages-v1';
const IMAGE_CACHE = 'bt-img-v1';
const SCAN_CACHE = 'bt-scan-v1';
const NETWORK_TIMEOUT_MS = 2500;
const REMOTE_IMAGES = 'https://assets.tcgdex.net';

const SHELL = [
  './',
  'index.html',
  'privacy.html',
  'terms.html',
  'manifest.webmanifest',
  'css/styles.css',
  'fonts/outfit-latin.woff2',
  'data/catalog.json',
  'js/app.js',
  'js/catalog.js',
  'js/codec.js',
  'js/collection.js',
  'js/confetti.js',
  'js/gestures.js',
  'js/home.js',
  'js/info.js',
  'js/main.js',
  'js/model.js',
  'js/paths.js',
  'js/pricing.js',
  'js/pwa.js',
  'js/quickadd.js',
  'js/render.js',
  'js/scan.js',
  'js/scan-features.js',
  'js/scan-match.js',
  'js/stats.js',
  'js/storage.js',
  'js/store.js',
  'js/sync.js',
  'js/theme-init.js',
  'js/transfer.js',
  'js/ui.js',
  'js/viewer.js',
  'js/games/pokemon.js',
  'js/vendor/qrcode.js',
  'img/icons/favicon.svg',
  'img/icons/favicon-32.png',
  'img/icons/icon-192.png',
  'img/icons/icon-512.png',
  'img/icons/icon-maskable-512.png',
  'img/icons/apple-touch-icon.png',
];

const SHELL_PATHS = new Set(SHELL.map((path) => new URL(path, self.registration.scope).pathname));

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
      if (key.startsWith('p30c-') || (key.startsWith('bt-shell-') && key !== SHELL_CACHE)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === REMOTE_IMAGES) {
    event.respondWith(cacheFirst(request, fetchRemoteImage));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/img/cards/') || url.pathname.includes('/img/sets/')) event.respondWith(cacheFirst(request));
  else if (/\.(onnx|wasm)$/.test(url.pathname)) event.respondWith(versionedFirst(request));
  else event.respondWith(networkFirst(request, SHELL_PATHS.has(url.pathname) ? SHELL_CACHE : PAGE_CACHE));
});

const fetchRemoteImage = (request) => fetch(request.url, { mode: 'cors', credentials: 'omit' }).catch(() => fetch(request));

async function cacheFirst(request, load = fetch) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await load(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function versionedFirst(request) {
  const cache = await caches.open(SCAN_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const path = new URL(request.url).pathname;
    for (const old of await cache.keys()) if (new URL(old.url).pathname === path) await cache.delete(old);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const network = fetch(request, { cache: 'no-cache' }).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
  const fresh = await Promise.race([network.catch(() => null), timeout]);
  if (fresh) return fresh;
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const home = new URL('./', self.registration.scope);
  if (request.mode === 'navigate' && new URL(request.url).pathname !== home.pathname && await caches.match(home.href)) {
    return Response.redirect(`${home.href}?offline`, 302);
  }
  return network;
}
