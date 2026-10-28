const VERSION = 'dev';
const SHELL_CACHE = `bt-shell-${VERSION}`;
const PAGE_CACHE = 'bt-pages-v1';
const IMAGE_CACHE = 'bt-img-v1';
const SCAN_CACHE = 'bt-scan-v1';
const NETWORK_TIMEOUT_MS = 2500;
const REMOTE_IMAGES = new Set(['https://assets.tcgdex.net', 'https://img.bindertracker.co.uk']);

const SHELL = [
  './',
  'index.html',
  'pokemon/',
  'pokemon/index.html',
  'yugioh/',
  'yugioh/index.html',
  'portfolio/',
  'portfolio/index.html',
  'trade/',
  'trade/index.html',
  'list/',
  'list/index.html',
  'shared/',
  'shared/index.html',
  'privacy.html',
  'terms.html',
  'guides/fake-pokemon-cards/',
  'guides/fake-pokemon-cards/index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'fonts/outfit-latin.woff2',
  'data/catalog.json',
  'js/core/catalog.js',
  'js/core/codec.js',
  'js/core/collection.js',
  'js/core/history.js',
  'js/core/model.js',
  'js/core/paths.js',
  'js/core/pricing.js',
  'js/core/storage.js',
  'js/core/transfer.js',
  'js/core/worth.js',
  'js/shared/analytics.js',
  'js/shared/camera.js',
  'js/shared/card-art.js',
  'js/shared/chart.js',
  'js/shared/confetti.js',
  'js/shared/dom.js',
  'js/shared/export.js',
  'js/shared/format.js',
  'js/shared/header.js',
  'js/shared/import.js',
  'js/shared/pwa.js',
  'js/shared/qr.js',
  'js/shared/rarity.js',
  'js/shared/socials.js',
  'js/shared/theme-init.js',
  'js/shared/tiles.js',
  'js/shared/ui.js',
  'js/set/app.js',
  'js/set/gestures.js',
  'js/set/info.js',
  'js/set/main.js',
  'js/set/quickadd.js',
  'js/set/render.js',
  'js/set/stats.js',
  'js/set/store.js',
  'js/set/viewer.js',
  'js/trade/list-share.js',
  'js/trade/list.js',
  'js/trade/trade-code.js',
  'js/trade/trade-data.js',
  'js/trade/trade-guide.js',
  'js/trade/trade.js',
  'js/scan/scan-features.js',
  'js/scan/scan-match.js',
  'js/scan/scan.js',
  'js/pages/home.js',
  'js/pages/portfolio.js',
  'js/pages/shared-collection.js',
  'js/games/index.js',
  'js/games/pokemon.js',
  'js/games/yugioh.js',
  'js/vendor/qrcode.js',
  'js/vendor/jsqr/jsQR.js',
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
      if (key.startsWith('bt-shell-') && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (REMOTE_IMAGES.has(url.origin)) {
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
