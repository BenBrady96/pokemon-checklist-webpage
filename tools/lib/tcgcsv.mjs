import { cachedJson, download } from './util.mjs';

const TCGCSV = 'https://tcgcsv.com/tcgplayer/3';

export async function loadProducts(groupId, { refresh = false } = {}) {
  return (await cachedJson(`${TCGCSV}/${groupId}/products`, { refresh })).results;
}

export async function loadPrices(groupId) {
  return (await download(`${TCGCSV}/${groupId}/prices`, { type: 'json' })).results;
}

export const lastUpdated = async () => (await download('https://tcgcsv.com/last-updated.txt', { type: 'text' })).trim();

export const productNumber = (p) => p.extendedData?.find((e) => e.name === 'Number')?.value || '';
export const productRarity = (p) => p.extendedData?.find((e) => e.name === 'Rarity')?.value || '';
export const isCard = (p) => Boolean(productNumber(p));
