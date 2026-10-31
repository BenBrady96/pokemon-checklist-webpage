import { fetchPrices } from './collection.js';
import * as storage from './storage.js';
import { CURRENCIES, ratesOf, sourceCurrency, valueUsd } from './pricing.js';

async function setWorth(id) {
  const prices = await fetchPrices(id);
  const worth = {
    id, usd: 0, rates: ratesOf(prices), unique: 0, copies: 0, unpriced: 0, loaded: Boolean(prices?.cards),
    updated: prices?.updated || null, cmUpdated: prices?.cmUpdated || null, cardmarket: sourceCurrency(prices) === 'eur',
  };
  for (const [cardId, n] of Object.entries(storage.readCounts(id))) {
    worth.unique++;
    worth.copies += n;
    const usd = valueUsd(prices?.cards?.[cardId], worth.rates);
    if (usd == null) worth.unpriced++;
    else worth.usd += usd * n;
  }
  return worth;
}

export async function collectionWorth(ids) {
  const sets = await Promise.all(ids.map(setWorth));
  const total = { sets, usd: 0, rates: {}, unique: 0, copies: 0, unpriced: 0, loaded: sets.every((s) => s.loaded), updated: null, cmUpdated: null, cardmarket: false };
  for (const s of sets) {
    total.usd += s.usd;
    total.unique += s.unique;
    total.copies += s.copies;
    total.unpriced += s.unpriced;
    if (s.updated && (!total.updated || s.updated > total.updated)) total.updated = s.updated;
    if (s.cmUpdated && (!total.cmUpdated || s.cmUpdated > total.cmUpdated)) total.cmUpdated = s.cmUpdated;
    if (s.unique && s.cardmarket) total.cardmarket = true;
  }
  for (const currency of CURRENCIES.filter((c) => c !== 'usd')) {
    const rated = sets.filter((s) => s.rates[currency] > 0);
    const usd = rated.reduce((n, s) => n + s.usd, 0);
    total.rates[currency] = usd ? rated.reduce((n, s) => n + s.usd * s.rates[currency], 0) / usd : rated[0]?.rates[currency] || 0;
  }
  return total;
}
