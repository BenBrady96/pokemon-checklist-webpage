const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const EMPTY = { updated: null, gbpPerUsd: 0, cards: {} };
let prices = EMPTY;

export let pricesUpdated = '';

export function setPrices(data) {
  prices = data?.cards ? data : EMPTY;
  pricesUpdated = prices.updated ? date.format(new Date(`${prices.updated}T00:00:00Z`)) : '';
}

export const hasPrices = () => prices !== EMPTY;
export const priceOf = (id) => prices.cards[id] || null;
export const marketUsd = (id) => prices.cards[id]?.usd ?? null;
export const formatGbp = (dollars) => gbp.format(dollars * prices.gbpPerUsd);
export const formatUsd = (dollars) => usd.format(dollars);
