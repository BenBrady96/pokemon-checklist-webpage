import { buildCollection } from './model.js';
import { GAMES } from '../games/index.js';
import { asset } from './paths.js';
import { setPrices } from './pricing.js';
import { viewDataPath } from './view.js';
import { linkedSets, withLinks } from './links.js';
import { linkedBackend } from './linked-backend.js';

export { GAMES };

async function getJson(path, fallback) {
  try {
    const res = await fetch(asset(path));
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

const cache = new Map();

export function fetchCollection(id, { images = false, links = false } = {}) {
  const key = `${id}|${images}|${links}`;
  if (!cache.has(key)) {
    const promise = (async () => {
      const [raw, imageData] = await Promise.all([
        getJson(`data/${id}/cards.json`),
        images ? getJson(`data/${id}/images.json`, {}) : {},
      ]);
      const options = {
        game: GAMES[raw.game],
        colors: imageData.colors || {},
        imageBase: asset(`img/cards/${id}`),
        remote: imageData.remote || null,
        logo: imageData.logo ? asset(imageData.logo) : null,
      };
      if (!links || !raw.links?.length) return buildCollection(raw, options);
      const homes = await Promise.all(linkedSets(raw).map(async (home) => [home, await fetchCollection(home, { images })]));
      return withLinks(raw, options, new Map(homes));
    })();
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return cache.get(key);
}

const priceCache = new Map();

export function fetchPrices(id) {
  if (!priceCache.has(id)) {
    const promise = getJson(`data/${id}/prices.json`, null);
    priceCache.set(id, promise);
    promise.then((data) => { if (!data) priceCache.delete(id); });
  }
  return priceCache.get(id);
}

const viewCache = new Map();

export function fetchView(id) {
  if (!viewCache.has(id)) {
    const promise = getJson(viewDataPath(id));
    viewCache.set(id, promise);
    promise.catch(() => viewCache.delete(id));
  }
  return viewCache.get(id);
}

const setViewCache = new Map();

export function fetchSetViews(id) {
  if (!setViewCache.has(id)) setViewCache.set(id, getJson(`data/${id}/views.json`, null));
  return setViewCache.get(id);
}

export let COLLECTION = null;

export function useView(model, prices) {
  setPrices(prices);
  COLLECTION = model;
}

export async function loadCollection(id) {
  const [model, prices] = await Promise.all([
    fetchCollection(id, { images: true, links: true }),
    fetchPrices(id),
  ]);
  setPrices(prices);
  COLLECTION = model.linkedSets ? { ...model, backend: linkedBackend(model) } : model;
  return COLLECTION;
}
