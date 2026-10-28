import { cachedJson, download } from './util.mjs';

export const CATEGORY = { pokemon: 3, yugioh: 2, lorcana: 71 };

const base = (category) => `https://tcgcsv.com/tcgplayer/${category}`;

export async function loadGroups(category, { refresh = false } = {}) {
  return (await cachedJson(`${base(category)}/groups`, { refresh })).results;
}

export async function loadProducts(groupId, { refresh = false, category = CATEGORY.pokemon } = {}) {
  return (await cachedJson(`${base(category)}/${groupId}/products`, { refresh })).results;
}

export async function loadPrices(groupId, { category = CATEGORY.pokemon } = {}) {
  try {
    return (await download(`${base(category)}/${groupId}/prices`, { type: 'json' })).results;
  } catch (err) {
    if ([401, 403, 404].includes(err.status)) return [];
    throw err;
  }
}

export const lastUpdated = async () => (await download('https://tcgcsv.com/last-updated.txt', { type: 'text' })).trim();

export const productNumber = (p) => p.extendedData?.find((e) => e.name === 'Number')?.value || '';
export const productRarity = (p) => p.extendedData?.find((e) => e.name === 'Rarity')?.value || '';
export const isCard = (p) => Boolean(productNumber(p));
