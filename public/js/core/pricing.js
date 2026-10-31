import { TIER_DEFS } from './model.js';

const WHOLE = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
const formats = (locale, code) => [
  new Intl.NumberFormat(locale, { style: 'currency', currency: code }),
  new Intl.NumberFormat(locale, { style: 'currency', currency: code, ...WHOLE }),
];
const MONEY = {
  gbp: formats('en-GB', 'GBP'),
  usd: formats('en-US', 'USD'),
  eur: formats('en-IE', 'EUR'),
};
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const CURRENCIES = Object.keys(MONEY);
export const SYMBOLS = { gbp: '£', usd: '$', eur: '€' };
export const ratesOf = (data) => ({ gbp: data?.gbpPerUsd || 0, eur: data?.eurPerUsd || 0 });
export const priceDate = (updated) => (updated ? date.format(new Date(`${updated}T00:00:00Z`)) : '');

const fromCardmarket = (entry, rates) => entry?.eur != null && rates?.eur > 0;
export const valueUsd = (entry, rates) => (fromCardmarket(entry, rates) ? entry.eur / rates.eur : entry?.usd ?? null);
export const sourceOf = (entry, rates) => (fromCardmarket(entry, rates) ? 'cardmarket' : entry?.usd != null ? 'tcgplayer' : null);
export const sourceCurrency = (data) => (Object.values(data?.cards || {}).some((p) => p.eur != null) ? 'eur' : 'usd');

const PRICED_SHARE = 0.7;
const CURRENCY_NAMES = { gbp: 'Pound', eur: 'Euro', usd: 'Dollar' };
const CURRENCY_PLURALS = { eur: 'euros', usd: 'US dollars' };

export function priceNotes({ updated, cmUpdated, cardmarket }, shown) {
  const notes = [];
  if (cardmarket) notes.push(`Cardmarket prices${cmUpdated ? ` from ${priceDate(cmUpdated)}` : ''}, or TCGplayer’s where Cardmarket has none.`);
  else if (updated) notes.push(`Market prices from TCGplayer, updated ${priceDate(updated)}.`);
  const sources = cardmarket ? ['eur', 'usd'] : ['usd'];
  const from = sources.filter((s) => s !== shown);
  if (from.length) {
    const what = from.length === sources.length ? CURRENCY_NAMES[shown] : from[0] === 'usd' ? 'TCGplayer' : 'Cardmarket';
    notes.push(`${what} values are converted from ${from.map((s) => CURRENCY_PLURALS[s]).join(' and ')}, so they’re approximate.`);
  }
  return notes;
}

export function tierValues(model, data) {
  if (!data?.cards || !data.gbpPerUsd) return null;
  const rates = ratesOf(data);
  const tiers = {};
  for (const def of TIER_DEFS) {
    const { cards } = model.getTier(def.id);
    let usd = 0;
    let priced = 0;
    for (const card of cards) {
      const price = valueUsd(data.cards[card.id], rates);
      if (price == null) continue;
      usd += price;
      priced++;
    }
    if (cards.length && priced >= cards.length * PRICED_SHARE) tiers[def.id] = Math.round(usd * 100) / 100;
  }
  return Object.keys(tiers).length ? { rates, tiers } : null;
}

export function convert(usd, currency, rates) {
  if (currency === 'usd') return usd;
  const rate = rates?.[currency];
  return rate > 0 ? usd * rate : null;
}

export const shownCurrency = (currency, rates) => (MONEY[currency] && convert(1, currency, rates) != null ? currency : 'usd');

export function formatAmount(value, currency, { short = false } = {}) {
  const [exact, whole] = MONEY[currency] || MONEY.usd;
  return (short && Math.abs(value) >= 100 ? whole : exact).format(value);
}

export function formatMoney(usd, { currency = 'gbp', rates, short = false, approx = false } = {}) {
  const shown = shownCurrency(currency, rates);
  const text = formatAmount(convert(usd, shown, rates), shown, { short });
  return approx && shown !== 'usd' ? `≈ ${text}` : text;
}

const EMPTY = { updated: null, gbpPerUsd: 0, cards: {} };
let prices = EMPTY;
let currency = 'gbp';
let base = 'usd';

export let pricesUpdated = '';
export let cardmarketUpdated = '';

export function setPrices(data) {
  prices = data?.cards ? data : EMPTY;
  pricesUpdated = priceDate(prices.updated);
  cardmarketUpdated = priceDate(prices.cmUpdated);
  base = sourceCurrency(prices);
}

export function setCurrency(next) {
  currency = MONEY[next] ? next : 'gbp';
}

export const hasPrices = () => prices !== EMPTY;
export const priceOf = (id) => prices.cards[id] || null;
export const marketUsd = (id) => valueUsd(prices.cards[id], ratesOf(prices));
export const formatUsd = (dollars) => MONEY.usd[0].format(dollars);
export const formatEur = (euros) => MONEY.eur[0].format(euros);
export const formatBase = (dollars) => formatMoney(dollars, { currency: base, rates: ratesOf(prices) });
export const hasCardmarket = () => base === 'eur';
export const priceCurrency = () => shownCurrency(currency, ratesOf(prices));
export const isConverted = () => priceCurrency() !== base;
export const formatPrice = (dollars, options = {}) => formatMoney(dollars, { currency, rates: ratesOf(prices), ...options });
