import { buildCollection } from './model.js';
import * as pokemon from './games/pokemon.js';
import { asset } from './paths.js';
import { setPrices } from './pricing.js';

export const GAMES = { pokemon };

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

export function fetchCollection(id, { images = false } = {}) {
  const key = `${id}|${images}`;
  if (!cache.has(key)) {
    const promise = (async () => {
      const [raw, imageData] = await Promise.all([
        getJson(`data/${id}/cards.json`),
        images ? getJson(`data/${id}/images.json`, {}) : {},
      ]);
      return buildCollection(raw, {
        game: GAMES[raw.game],
        colors: imageData.colors || {},
        imageBase: asset(`img/cards/${id}`),
        logo: imageData.logo ? asset(imageData.logo) : null,
      });
    })();
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return cache.get(key);
}

export let COLLECTION = null;
export let GAME = null;
export let CARDS = [];
export let CARD_BY_ID = new Map();
export let SECTIONS = [];
export let RARITIES = [];
export let RARITY_BY_ID = new Map();
export let GROUPS = [];
export let JUMPS = [];
export let getTier = () => null;
export let inTier = () => false;

export async function loadCollection(id) {
  const [model, prices] = await Promise.all([
    fetchCollection(id, { images: true }),
    getJson(`data/${id}/prices.json`, null),
  ]);
  setPrices(prices);
  COLLECTION = model;
  GAME = model.game;
  CARDS = model.cards;
  CARD_BY_ID = model.cardById;
  SECTIONS = model.sections;
  RARITIES = model.rarities;
  RARITY_BY_ID = model.rarityById;
  GROUPS = model.groups;
  JUMPS = model.jumps;
  getTier = model.getTier;
  inTier = model.inTier;
  return model;
}
