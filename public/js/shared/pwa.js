import { ROOT, asset } from '../core/paths.js';
import * as storage from '../core/storage.js';

const IMAGE_CACHE = 'bt-img-v1';
const REMIND_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CLOSES = 2;

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const inAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Snapchat|LinkedInApp|Pinterest/i.test(ua) || (isIOS && !/Safari\//.test(ua));

const SHARE_GLYPH = '<svg class="install-banner__glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M8 10H6v11h12V10h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let installEvent = null;
let banner = null;
let bannerReady = false;

export const offlineSupported = () => 'serviceWorker' in navigator && 'caches' in window && location.protocol !== 'file:';

const isInstalled = () => navigator.standalone === true
  || matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches;

export function initPWA() {
  if (!offlineSupported()) return;
  navigator.serviceWorker.register(asset('sw.js'), { scope: ROOT }).catch(() => {});
}

addEventListener('beforeinstallprompt', (e) => {
  if (!isAndroid) return;
  e.preventDefault();
  installEvent = e;
  showInstallBanner();
});

addEventListener('appinstalled', () => {
  installEvent = null;
  hideInstallBanner();
});

export function initInstallBanner() {
  bannerReady = true;
  showInstallBanner();
}

function dueToShow() {
  if (!bannerReady || banner || isInstalled() || inAppBrowser || !storage.isStorageOk()) return false;
  if (!isIOS && !(isAndroid && installEvent)) return false;
  const seen = storage.getPrefs().installBanner;
  if (!seen) return true;
  return seen.closes < MAX_CLOSES && Date.now() - seen.at > REMIND_AFTER_MS;
}

function recordClose() {
  const closes = (storage.getPrefs().installBanner?.closes || 0) + 1;
  storage.setPref('installBanner', { closes, at: Date.now() });
}

function hideInstallBanner() {
  banner?.remove();
  banner = null;
}

async function install() {
  const e = installEvent;
  installEvent = null;
  hideInstallBanner();
  if (!e) return;
  e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome !== 'accepted') recordClose();
}

function bannerText() {
  if (!isIOS) return 'Install it on your phone. It works offline and opens like any other app.';
  const steps = `Tap Share ${SHARE_GLYPH} (or ••• then Share), then <b>Add to Home Screen</b>. It works offline and Safari won’t clear your cards.`;
  if (!storage.storedCollections().length) return steps;
  return `${steps} The app starts empty: use <b>Export</b> here, then <b>Import</b> there.`;
}

function showInstallBanner() {
  if (!dueToShow()) return;
  banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Get the app');
  banner.innerHTML = `<div class="wrap install-banner__inner">
    <svg class="install-banner__mark" aria-hidden="true"><use href="#logo-mark"/></svg>
    <p class="install-banner__text"><b>Get the app: free, no ads, no sign-up.</b> <span>${bannerText()}</span></p>
    <span class="install-banner__actions">
      ${isIOS ? '' : '<button type="button" class="btn btn--primary btn--sm" data-install>Install</button>'}
      <button type="button" class="icon-btn icon-btn--dark" data-install-close aria-label="Close"><svg><use href="#i-close"/></svg></button>
    </span>
  </div>`;
  banner.querySelector('[data-install]')?.addEventListener('click', install);
  banner.querySelector('[data-install-close]').addEventListener('click', () => {
    recordClose();
    hideInstallBanner();
  });
  (document.getElementById('storage-banner') ?? document.querySelector('.appbar')).after(banner);
}

export async function countSavedImages(urls) {
  if (!offlineSupported()) return 0;
  const cache = await caches.open(IMAGE_CACHE);
  const keys = new Set((await cache.keys()).map((r) => r.url));
  return urls.filter((url) => keys.has(url)).length;
}

export async function saveImagesOffline(urls, onProgress) {
  const cache = await caches.open(IMAGE_CACHE);
  const queue = [...urls];
  const total = queue.length;
  let done = 0;
  let failed = 0;
  async function worker() {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
          else failed++;
        }
      } catch {
        failed++;
      }
      onProgress(++done, total);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return { total, failed };
}
