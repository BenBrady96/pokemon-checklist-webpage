import { formatMoney } from '../core/pricing.js';

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const releaseText = (date) => MONTH.format(new Date(`${date}T00:00:00Z`));

export function tileHtml(c, value, { base = '' } = {}) {
  const total = value?.tiers[c.defaultTier];
  const art = c.logo
    ? `<img class="set-tile__logo" src="${base}${c.logo}" alt="" loading="lazy" decoding="async">`
    : `<span class="set-tile__wordmark">${escape(c.name)}</span>`;
  return `<a class="set-tile" href="${base}${c.id}/" data-id="${escape(c.id)}"${value ? ` data-values="${escape(JSON.stringify(value))}"` : ''}>`
    + `<span class="set-tile__art">${art}</span>`
    + '<span class="set-tile__body">'
    + `<span class="set-tile__name">${escape(c.name)}</span>`
    + `<span class="set-tile__meta">${releaseText(c.released)} · ${c.total} cards</span>`
    + '<span class="set-tile__progress"><span class="bar" aria-hidden="true"><i></i></span><span class="set-tile__count"></span><span class="set-tile__none">No cards collected</span></span>'
    + `<span class="set-tile__value value-pill"${total == null ? ' hidden>' : `>${formatMoney(total, { currency: 'gbp', rates: value.rates, short: true, approx: true })}`}</span>`
    + '</span></a>';
}
