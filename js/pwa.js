import { ROOT, asset } from './paths.js';

const IMAGE_CACHE = 'bt-img-v1';

export const offlineSupported = () => 'serviceWorker' in navigator && 'caches' in window && location.protocol !== 'file:';

export function initPWA() {
  if (!offlineSupported()) return;
  navigator.serviceWorker.register(asset('sw.js'), { scope: ROOT }).catch(() => {});
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
