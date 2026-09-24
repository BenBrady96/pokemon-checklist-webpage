import prices from './prices.js';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const priceOf = (id) => prices.cards[id] || null;
export const marketUsd = (id) => prices.cards[id]?.usd ?? null;
export const formatGbp = (dollars) => gbp.format(dollars * prices.gbpPerUsd);
export const formatUsd = (dollars) => usd.format(dollars);
export const pricesUpdated = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${prices.updated}T00:00:00Z`));
