import { loadCatalog, collectionUrl } from './catalog.js';
import { fetchCollection, fetchPrices } from './collection.js';
import { asset } from './paths.js';
import * as storage from './storage.js';
import { collectionWorth } from './worth.js';
import { readHistory, recordSnapshot, today, addDays, parseDay } from './history.js';
import { convert, formatAmount, formatMoney, priceDate, ratesOf, shownCurrency } from './pricing.js';
import { lineChart } from './chart.js';
import { hideLoader } from './ui.js';

const RANGES = [
  { id: '7d', label: '7D', days: 7, phrase: 'in the past week' },
  { id: '1m', label: '1M', days: 30, phrase: 'in the past month' },
  { id: '3m', label: '3M', days: 91, phrase: 'in the past 3 months' },
  { id: '6m', label: '6M', days: 182, phrase: 'in the past 6 months' },
  { id: '1y', label: '1Y', days: 365, phrase: 'in the past year' },
  { id: 'all', label: 'All', days: 0, phrase: 'since your first visit' },
];
const TOP = 10;
const LONG_RANGE_DAYS = 120;

const $ = (name) => document.querySelector(`[data-pf="${name}"]`);
const plural = (n, one, many) => `${count.format(n)} ${n === 1 ? one : many}`;
const count = new Intl.NumberFormat('en-GB');
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

const shortDate = (t) => {
  const date = new Date(t);
  return (date.getFullYear() === new Date().getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR).format(date);
};

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
};

const icon = (id) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
};

let catalog = { collections: [] };
let worth = null;
let points = [];
let top = null;
let range = '1m';

const CONVERTED = { gbp: 'Pound', eur: 'Euro' };
const chosen = () => storage.getPrefs().currency;
const pointRates = (p) => ({ gbp: p?.r || worth?.rates.gbp || 0, eur: p?.e || worth?.rates.eur || 0 });
const currency = () => shownCurrency(chosen(), worth?.loaded ? worth.rates : pointRates(points.at(-1)));
const setRates = (s) => (s.rates[currency()] > 0 ? s.rates : worth.rates);
const money = (usd, rates, options = {}) => formatMoney(usd, { currency: currency(), rates, ...options });
const amount = (n, options = {}) => formatAmount(n, currency(), options);
const local = (usd, rates) => convert(usd, currency(), rates) ?? usd;
const setInfo = (id) => catalog.collections.find((c) => c.id === id) || { id, name: id };
const direction = (diff, threshold) => (Math.abs(diff) < threshold ? 'flat' : diff > 0 ? 'up' : 'down');
const signed = (diff, format) => `${diff > 0 ? '+' : '−'}${format(Math.abs(diff))}`;

const rowsOf = (list) => list.map((p) => ({ d: p.d, t: parseDay(p.d).getTime(), value: local(p.v, pointRates(p)), u: p.u, c: p.c }));

function windowed() {
  const def = RANGES.find((r) => r.id === range);
  const all = rowsOf(points);
  const end = parseDay(today()).getTime();
  if (!all.length) return { def, rows: [], partial: false };
  if (!def.days) return { def, rows: all, partial: false, domain: [all[0].t, Math.max(end, all.at(-1).t)] };
  const startDay = addDays(today(), -def.days);
  const start = parseDay(startDay).getTime();
  const inside = all.filter((r) => r.t >= start);
  const before = all.filter((r) => r.t < start).at(-1);
  if (!inside.length) return { def, rows: [], partial: false };
  const domainEnd = Math.max(end, inside.at(-1).t);
  if (!before) return { def, rows: inside, partial: true, domain: [inside[0].t, domainEnd] };
  if (inside[0].t === start) return { def, rows: inside, partial: false, domain: [start, domainEnd] };
  const first = inside[0];
  const f = (start - before.t) / (first.t - before.t);
  const lerp = (a, b) => a + (b - a) * f;
  const edge = { d: startDay, t: start, value: lerp(before.value, first.value), u: Math.round(lerp(before.u, first.u)), c: Math.round(lerp(before.c, first.c)), estimated: true };
  return { def, rows: [edge, ...inside], partial: false, domain: [start, domainEnd] };
}

const whenText = (win) => (win.partial ? `since ${shortDate(win.rows[0].t)}` : win.def.phrase);

function currentValue() {
  if (worth?.loaded) return local(worth.usd, worth.rates);
  const last = points.at(-1);
  return last ? local(last.v, pointRates(last)) : 0;
}

function renderHero(win) {
  $('value').textContent = amount(currentValue());
  const box = $('delta');
  if (win.rows.length < 2) {
    box.className = 'pf-delta';
    box.replaceChildren(points.length > 1 ? 'No history in this range yet.' : 'Your history starts today. Come back tomorrow to see how it changes.');
    return;
  }
  const diff = win.rows.at(-1).value - win.rows[0].value;
  const dir = direction(diff, 0.005);
  box.className = `pf-delta pf-delta--${dir}`;
  if (dir === 'flat') {
    box.replaceChildren(`No change ${whenText(win)}`);
    return;
  }
  const base = win.rows[0].value;
  const pct = base > 0 ? ` (${signed(diff / base, (n) => percent.format(n))})` : '';
  box.replaceChildren(icon(dir === 'up' ? 'i-trend-up' : 'i-trend-down'), el('b', { text: `${signed(diff, amount)}${pct}` }), ` ${whenText(win)}`);
}

const axisDate = (domain) => (t) => (domain[1] - domain[0] > LONG_RANGE_DAYS * 86400000 ? MONTH_YEAR : DAY_MONTH).format(new Date(t));

function renderValueChart(win) {
  const figure = $('value-chart');
  if (!win.rows.length) {
    figure.replaceChildren();
    return;
  }
  const first = win.rows[0].value;
  const last = win.rows.at(-1).value;
  lineChart(figure, {
    rows: win.rows,
    series: [{ key: 'value', name: 'Value' }],
    domain: win.domain,
    formatValue: (n) => amount(n),
    formatTick: (n) => amount(n, { short: true }),
    formatDate: (t) => DAY_MONTH_YEAR.format(new Date(t)),
    formatAxisDate: axisDate(win.domain),
    label: win.rows.length > 1
      ? `Collection value ${whenText(win)}, from ${amount(first)} to ${amount(last)}. Use the arrow keys to read each point.`
      : `Collection value today, ${amount(last)}.`,
    height: 220,
  });
}

function stat(label, value, base) {
  const diff = base == null ? 0 : value - base;
  const dir = direction(diff, 1);
  return el('div', { class: 'pf-stat' },
    el('b', { class: 'pf-stat__value', text: count.format(value) }),
    el('span', { class: 'pf-stat__label', text: label }),
    base == null ? null : el('small', { class: `pf-stat__delta pf-delta--${dir}`, text: dir === 'flat' ? 'No change' : signed(diff, (n) => count.format(n)) }));
}

function renderCards(win) {
  const last = points.at(-1);
  const unique = worth?.loaded ? worth.unique : last?.u || 0;
  const copies = worth?.loaded ? worth.copies : last?.c || 0;
  const sets = worth?.loaded ? worth.sets.filter((s) => s.unique).length : Object.keys(last?.s || {}).length;
  const base = win.rows.length > 1 ? win.rows[0] : null;
  $('stats').replaceChildren(
    stat('Unique cards', unique, base?.u),
    stat('Total copies', copies, base?.c),
    stat('Sets', sets, null),
  );
  const series = [{ key: 'u', name: 'unique' }, { key: 'c', name: 'copies' }];
  $('legend').replaceChildren(...[['Unique cards', 1], ['Total copies (with duplicates)', 2]].map(([name, slot]) => el('span', { class: 'pf-legend__item' }, el('i', { class: `chart__key chart__series--${slot}` }), name)));
  const figure = $('cards-chart');
  if (!win.rows.length) {
    figure.replaceChildren();
    return;
  }
  lineChart(figure, {
    rows: win.rows,
    series,
    domain: win.domain,
    formatValue: (n) => count.format(n),
    formatDate: (t) => DAY_MONTH_YEAR.format(new Date(t)),
    formatAxisDate: axisDate(win.domain),
    label: `Unique cards and total copies ${whenText(win)}: now ${plural(win.rows.at(-1).u, 'unique card', 'unique cards')} and ${plural(win.rows.at(-1).c, 'copy', 'copies')}.`,
    height: 170,
    endLabels: true,
    integer: true,
  });
}

function renderTable(win) {
  const rows = win.rows.filter((r) => !r.estimated).reverse();
  $('table').replaceChildren(el('table', {},
    el('thead', {}, el('tr', {}, ...['Date', 'Value', 'Unique cards', 'Total copies'].map((h) => el('th', { scope: 'col', text: h })))),
    el('tbody', {}, ...rows.map((r) => el('tr', {},
      el('td', { text: DAY_MONTH_YEAR.format(new Date(r.t)) }),
      el('td', { text: amount(r.value) }),
      el('td', { text: count.format(r.u) }),
      el('td', { text: count.format(r.c) }))))));
}

function renderRange() {
  const win = windowed();
  for (const b of $('ranges').children) b.setAttribute('aria-pressed', String(b.dataset.range === range));
  renderHero(win);
  renderValueChart(win);
  renderCards(win);
  renderTable(win);
}

async function loadTop(ids) {
  const items = [];
  await Promise.all(ids.map(async (id) => {
    const [model, prices] = await Promise.all([fetchCollection(id, { images: true }).catch(() => null), fetchPrices(id)]);
    if (!model || !prices?.cards) return;
    for (const [cardId, n] of Object.entries(storage.readCounts(id))) {
      const card = model.cardById.get(cardId);
      const usd = prices.cards[cardId]?.usd;
      if (card && usd != null) items.push({ id, model, card, n, usd, rates: ratesOf(prices) });
    }
  }));
  return items.sort((a, b) => b.usd - a.usd || b.n - a.n).slice(0, TOP);
}

function renderTop() {
  const list = $('top');
  if (!top) {
    list.replaceChildren(el('li', { class: 'pf-list__empty', text: 'Loading…' }));
    return;
  }
  if (!top.length) {
    list.replaceChildren(el('li', { class: 'pf-list__empty', text: 'None of your cards have a price yet.' }));
    return;
  }
  list.replaceChildren(...top.map((item) => el('li', {},
    el('a', { class: 'pf-row', href: collectionUrl(item.id) },
      item.model.hasImage(item.card)
        ? el('img', { class: 'pf-row__card', src: item.model.imageUrl(item.card, 'sm'), alt: '', width: 330, height: 460, loading: 'lazy', decoding: 'async' })
        : el('span', { class: 'pf-row__card pf-row__card--blank', 'aria-hidden': 'true' }),
      el('span', { class: 'pf-row__main' },
        el('b', { text: item.card.name }),
        el('small', { text: `${setInfo(item.id).name} · ${item.card.printed}${item.card.variant ? ` · ${item.card.variant}` : ''}` })),
      el('span', { class: 'pf-row__side' },
        el('b', { text: money(item.usd, item.rates) }),
        item.n > 1 ? el('small', { text: `×${item.n} · ${money(item.usd * item.n, item.rates)}` }) : null)))));
}

function renderSets() {
  const prev = points.filter((p) => p.d < today()).at(-1);
  const hint = $('sets-hint');
  hint.hidden = !prev;
  if (prev) hint.textContent = `Change since your last visit, ${shortDate(parseDay(prev.d).getTime())}.`;
  const sets = (worth?.sets || []).filter((s) => s.unique).sort((a, b) => b.usd - a.usd);
  $('sets').replaceChildren(...sets.map((s) => {
    const info = setInfo(s.id);
    const summary = storage.readRecord(s.id)?.summary;
    const progress = summary?.total ? `${summary.owned}/${summary.total} · ${percent.format(Math.floor((summary.owned / summary.total) * 100) / 100)}` : plural(s.unique, 'card', 'cards');
    const extra = s.copies > s.unique ? ` · ${plural(s.copies, 'copy', 'copies')}` : '';
    let change = null;
    if (prev && s.loaded) {
      const before = prev.s[s.id];
      const diff = before ? local(s.usd, setRates(s)) - local(before[0], pointRates(prev)) : 0;
      const dir = before ? direction(diff, 0.005) : 'up';
      change = el('small', { class: `pf-delta--${dir}`, text: !before ? 'New' : dir === 'flat' ? 'No change' : signed(diff, amount) });
    }
    return el('li', {},
      el('a', { class: 'pf-row', href: collectionUrl(s.id) },
        el('span', { class: 'pf-row__logo' }, info.logo ? el('img', { src: asset(info.logo), alt: '', loading: 'lazy', decoding: 'async' }) : null),
        el('span', { class: 'pf-row__main' }, el('b', { text: info.name }), el('small', { text: `${progress}${extra}` })),
        el('span', { class: 'pf-row__side' }, el('b', { text: s.loaded ? money(s.usd, setRates(s)) : '—' }), change)));
  }));
}

function renderNote() {
  const parts = [];
  if (worth?.updated) parts.push(`Market prices from TCGplayer, updated ${priceDate(worth.updated)}.`);
  if (CONVERTED[currency()]) parts.push(`${CONVERTED[currency()]} values are converted from US dollars, so they’re approximate.`);
  if (worth?.unpriced) parts.push(`${plural(worth.unpriced, 'card has', 'cards have')} no price yet and ${worth.unpriced === 1 ? 'isn’t' : 'aren’t'} counted.`);
  parts.push('Your history is saved on this device whenever you open the site: daily for the past week, weekly for the past month, then monthly. It’s included when you export a backup file.');
  $('note').textContent = parts.join(' ');
}

function render() {
  for (const b of document.querySelectorAll('[data-currency]')) b.setAttribute('aria-pressed', String(b.dataset.currency === chosen()));
  renderRange();
  renderTop();
  renderSets();
  renderNote();
}

function wire() {
  $('ranges').replaceChildren(...RANGES.map((r) => el('button', {
    type: 'button',
    class: 'seg__btn',
    'data-range': r.id,
    'aria-pressed': String(r.id === range),
    onclick() {
      range = r.id;
      renderRange();
    },
  }, r.label)));
  for (const b of document.querySelectorAll('[data-currency]')) {
    b.addEventListener('click', () => {
      storage.setPref('currency', b.dataset.currency);
      render();
    });
  }
}

async function init() {
  if (!storage.isStorageOk()) document.getElementById('storage-banner').hidden = false;
  wire();
  catalog = await loadCatalog().catch(() => catalog);
  const ids = storage.storedCollections().map(({ id }) => id).filter((id) => catalog.collections.some((c) => c.id === id));
  worth = await collectionWorth(ids);
  points = worth.loaded && catalog.collections.length ? recordSnapshot(worth) : readHistory();
  const empty = !ids.length && !points.length;
  $('empty').hidden = !empty;
  $('body').hidden = empty;
  $('value').hidden = empty;
  $('delta').hidden = empty;
  if (!empty) render();
  hideLoader();
  if (empty) return;
  top = await loadTop(ids);
  renderTop();
}

init();
