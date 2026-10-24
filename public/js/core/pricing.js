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

const PRICED_SHARE = 0.7;

export function tierValues(model, data) {
  if (!data?.cards || !data.gbpPerUsd) return null;
  const tiers = {};
  for (const def of TIER_DEFS) {
    const { cards } = model.getTier(def.id);
    let usd = 0;
    let priced = 0;
    for (const card of cards) {
      const price = data.cards[card.id]?.usd;
      if (price == null) continue;
      usd += price;
      priced++;
    }
    if (cards.length && priced >= cards.length * PRICED_SHARE) tiers[def.id] = Math.round(usd * 100) / 100;
  }
  return Object.keys(tiers).length ? { rates: ratesOf(data), tiers } : null;
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

export let pricesUpdated = '';

export function setPrices(data) {
  prices = data?.cards ? data : EMPTY;
  pricesUpdated = priceDate(prices.updated);
}

export function setCurrency(next) {
  currency = MONEY[next] ? next : 'gbp';
}

export const hasPrices = () => prices !== EMPTY;
export const priceOf = (id) => prices.cards[id] || null;
export const marketUsd = (id) => prices.cards[id]?.usd ?? null;
export const formatUsd = (dollars) => MONEY.usd[0].format(dollars);
export const priceCurrency = () => shownCurrency(currency, ratesOf(prices));
export const isConverted = () => priceCurrency() !== 'usd';
export const formatPrice = (dollars, options = {}) => formatMoney(dollars, { currency, rates: ratesOf(prices), ...options });
