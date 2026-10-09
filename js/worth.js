import { fetchPrices } from './collection.js';
import * as storage from './storage.js';
import { CURRENCIES, ratesOf } from './pricing.js';

export async function setWorth(id) {
  const prices = await fetchPrices(id);
  const worth = { id, usd: 0, rates: ratesOf(prices), unique: 0, copies: 0, unpriced: 0, loaded: Boolean(prices?.cards), updated: prices?.updated || null };
  for (const [cardId, n] of Object.entries(storage.readCounts(id))) {
    worth.unique++;
    worth.copies += n;
    const usd = prices?.cards?.[cardId]?.usd;
    if (usd == null) worth.unpriced++;
    else worth.usd += usd * n;
  }
  return worth;
}

export async function collectionWorth(ids) {
  const sets = await Promise.all(ids.map(setWorth));
  const total = { sets, usd: 0, rates: {}, unique: 0, copies: 0, unpriced: 0, loaded: sets.every((s) => s.loaded), updated: null };
  for (const s of sets) {
    total.usd += s.usd;
    total.unique += s.unique;
    total.copies += s.copies;
    total.unpriced += s.unpriced;
    if (s.updated && (!total.updated || s.updated > total.updated)) total.updated = s.updated;
  }
  for (const currency of CURRENCIES.filter((c) => c !== 'usd')) {
    const rated = sets.filter((s) => s.rates[currency] > 0);
    const usd = rated.reduce((n, s) => n + s.usd, 0);
    total.rates[currency] = usd ? rated.reduce((n, s) => n + s.usd * s.rates[currency], 0) / usd : rated[0]?.rates[currency] || 0;
  }
  return total;
}
