import { loadCatalog } from './catalog.js';
import { normalize } from './model.js';
import * as storage from './storage.js';
import { formatAmount, priceDate } from './pricing.js';
import { decodeList, UNSUPPORTED } from './trade-code.js';
import { loadSets, makeValuer, readListPrefs, saveListPrefs } from './trade-data.js';
import { initDialogs, openDialog, hideLoader } from './ui.js';
import { initHeader } from './header.js';
import { initInstallBanner } from './pwa.js';
import { el, icon } from './dom.js';
import { count, plural, DAY_MONTH_YEAR } from './format.js';

const TABS = [
  { id: 'have', label: 'Up for trade', empty: 'Nothing is up for trade in this list.' },
  { id: 'missing', label: 'Looking for', empty: 'Nothing on the wanted list. This set might be complete!' },
];
const CONVERTED = { gbp: 'Pound', eur: 'Euro' };
const MESSAGES = {
  none: ['There’s no trade list here', 'This page shows a trade list someone has shared with you. Ask them to send you the full link.'],
  invalid: ['This link isn’t complete', 'It may have been cut off when it was copied or sent. Ask for the link again.'],
  browser: ['This link needs a newer browser', 'Update your browser, then open the link again.'],
  unknown: ['This set isn’t here yet', 'The list is for a set this version of the site doesn’t have. Refresh the page to update it.', true],
  offline: ['Couldn’t load the cards', 'Check your connection and try again.', true],
};

const $ = (name) => document.querySelector(`[data-lst="${name}"]`);

let page = null;
let valuer = null;
let tab = 'have';
let view = readView();
let query = '';

function readView() {
  return readListPrefs().view === 'list' ? 'list' : 'grid';
}

function saveView() {
  saveListPrefs({ ...readListPrefs(), view });
}

const money = (n) => formatAmount(n, valuer.cur);
const priceOf = (card) => valuer.of(page.id, card.id);
const subText = (card) => [card.printed, card.variant || card.rarityName].filter(Boolean).join(' · ');

function shortPrice(card) {
  const price = priceOf(card);
  if (price.value != null) return money(price.value);
  return price.from != null ? `from ${money(price.from)}` : 'No price';
}

function totalOf(items) {
  let value = 0;
  let unpriced = 0;
  let copies = 0;
  for (const { card, qty } of items) {
    const price = priceOf(card).value;
    copies += qty;
    if (price == null) unpriced += qty;
    else value += price * qty;
  }
  return { value, unpriced, copies };
}

function showMessage(kind) {
  const [title, text, retry] = MESSAGES[kind];
  $('hero').hidden = true;
  $('body').hidden = true;
  $('message').hidden = false;
  $('message-title').textContent = title;
  $('message-text').textContent = text;
  $('retry').hidden = !retry;
  document.title = `${title} · Binder Tracker`;
}

function image(card, size) {
  if (!page.model.hasImage(card)) return null;
  const img = el('img', { src: page.model.imageUrl(card, size), alt: '', width: 330, height: 460, loading: size === 'sm' ? 'lazy' : 'eager', decoding: 'async' });
  img.addEventListener('error', () => {
    if (size === 'lg') img.src = page.model.imageUrl(card, 'sm');
    else img.remove();
  }, { once: true });
  return img;
}

function art(card, qty, className) {
  return el('span', { class: className, style: `--ph:${page.model.imageColor(card)}` },
    el('span', { class: 'lst-card__ph', 'aria-hidden': 'true', text: card.num }),
    image(card, 'sm'),
    qty > 1 ? el('span', { class: 'lst-card__qty', text: `×${qty}` }) : null);
}

function tile({ card, qty }) {
  return el('li', {}, el('button', { type: 'button', class: 'lst-card', 'data-idx': card.idx },
    art(card, qty, 'lst-card__art'),
    el('span', { class: 'lst-card__cap' },
      el('b', { class: 'lst-card__name', text: card.name }),
      el('small', { class: 'lst-card__sub', text: subText(card) }),
      el('b', { class: 'lst-card__price', text: shortPrice(card) }))));
}

function row({ card, qty }) {
  return el('li', {}, el('button', { type: 'button', class: 'pf-row lst-row', 'data-idx': card.idx },
    art(card, 0, 'lst-row__art'),
    el('span', { class: 'pf-row__main' },
      el('b', { text: card.name }),
      el('small', { text: [card.printed, card.rarityName, card.variant].filter(Boolean).join(' · ') })),
    el('span', { class: 'pf-row__side' },
      el('b', { text: shortPrice(card) }),
      qty > 1 ? el('small', { class: 'lst-row__qty', text: `×${qty} available` }) : null)));
}

function renderHero() {
  const { list, model } = page;
  $('title').textContent = list.name ? `${list.name}’s trade list` : 'Trade list';
  document.title = `${list.name ? `${list.name}’s ` : ''}${model.name} trade list · Binder Tracker`;
  const logo = $('logo');
  if (model.logoUrl) {
    logo.src = model.logoUrl;
    logo.alt = model.name;
    logo.hidden = false;
  }
  $('meta').replaceChildren(...[
    el('b', { text: model.name }),
    model.game?.name ? ` · ${model.game.name}` : null,
    list.created ? ` · made ${DAY_MONTH_YEAR.format(list.created)}` : null,
  ].filter(Boolean));
}

function tabNote(t, items, total) {
  const parts = [];
  if (t.id === 'have' && total.copies > items.length) parts.push(plural(total.copies, 'copy', 'copies'));
  if (t.id === 'missing' && !page.model.single) parts.push(`from the ${page.model.getTier(page.list.tier).name}`);
  return parts.join(' · ');
}

function renderTabs() {
  const single = page.tabs.length === 1;
  $('tabs').replaceChildren(...page.tabs.map((t) => {
    const items = page.items[t.id];
    const total = totalOf(items);
    const note = tabNote(t, items, total);
    const priced = items.some(({ card }) => priceOf(card).value != null);
    const children = [
      el('span', { class: 'lst-tab__label', text: t.label }),
      el('b', { class: 'lst-tab__count', text: plural(items.length, 'card', 'cards') }),
      note ? el('small', { class: 'lst-tab__note', text: note }) : null,
      priced ? el('span', { class: 'lst-tab__value' }, el('b', { text: money(total.value) }), ' market value') : null,
    ];
    return single
      ? el('div', { class: `lst-tab lst-tab--${t.id} is-only` }, ...children)
      : el('button', {
        type: 'button',
        class: `lst-tab lst-tab--${t.id}`,
        'aria-pressed': String(t.id === tab),
        onclick() {
          if (tab === t.id) return;
          tab = t.id;
          renderTabs();
          renderCards();
        },
      }, ...children);
  }));
}

function filtered() {
  const items = page.items[tab];
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return terms.length ? items.filter(({ card }) => terms.every((t) => card.search.includes(` ${t}`))) : items;
}

function renderCards() {
  const box = $('cards');
  box.dataset.view = view;
  for (const b of $('view').querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
  const all = page.items[tab];
  const items = filtered();
  if (!all.length || !items.length) {
    const t = TABS.find((x) => x.id === tab);
    box.replaceChildren(el('p', { class: 'lst-empty', text: all.length ? `No cards match “${query.trim()}”.` : t.empty }));
    return;
  }
  const bySection = new Map();
  for (const item of items) {
    if (!bySection.has(item.card.section)) bySection.set(item.card.section, []);
    bySection.get(item.card.section).push(item);
  }
  box.replaceChildren(...page.model.sections.filter((s) => bySection.has(s.id)).map((s) => {
    const group = bySection.get(s.id);
    return el('section', { class: 'lst-sec' },
      el('h2', { class: 'lst-sec__title' }, s.name, el('small', { text: count.format(group.length) })),
      el('ul', { class: view === 'grid' ? 'lst-grid' : 'pf-list lst-rows' }, ...group.map(view === 'grid' ? tile : row)));
  }));
}

function renderNote() {
  const parts = [];
  if (valuer.updated) parts.push(`Market prices from TCGplayer, updated ${priceDate(valuer.updated)}.`);
  if (CONVERTED[valuer.cur]) parts.push(`${CONVERTED[valuer.cur]} values are converted from US dollars, so they’re approximate.`);
  parts.push('Prices don’t account for condition, so agree the final values with the person you’re trading with.');
  $('note').textContent = parts.join(' ');
}

function render() {
  renderHero();
  renderTabs();
  renderCards();
  renderNote();
}

function priceBlock(card) {
  const price = priceOf(card);
  const entry = page.sets.get(page.id).prices?.cards?.[card.id] || null;
  const updated = priceDate(page.sets.get(page.id).prices?.updated);
  const converted = CONVERTED[valuer.cur] ? ' Converted from US dollars, so it’s approximate.' : '';
  let figure;
  let hint;
  if (price.value != null) {
    figure = money(price.value);
    hint = `TCGplayer market price${updated ? `, ${updated}` : ''}.${converted}`;
  } else if (price.from != null) {
    figure = 'No sales yet';
    hint = `Listed on TCGplayer from ${money(price.from)}${updated ? `, ${updated}` : ''}.${converted}`;
  } else {
    figure = 'No price yet';
    hint = 'TCGplayer doesn’t list this card yet.';
  }
  const links = page.model.game?.priceLinks?.(card, entry, card.searchQuery) || [];
  return el('section', { class: 'info__block' },
    el('h3', { class: 'field__label', text: 'Market price' }),
    el('p', { class: 'info__price', text: figure }),
    el('p', { class: 'hint hint--small', text: hint }),
    links.length ? el('div', { class: 'info__links' }, ...links.map((l) => el('a', { class: 'btn btn--ghost btn--sm', href: l.href, target: '_blank', rel: 'noopener noreferrer' }, l.label, icon('i-external')))) : null);
}

function openCard(idx) {
  const item = page.items[tab].find(({ card }) => card.idx === idx);
  if (!item) return;
  const { card, qty } = item;
  const section = page.model.sectionById.get(card.section);
  const status = tab === 'have'
    ? (qty > 1 ? `${qty} copies up for trade` : 'Up for trade')
    : 'Looking for this card';
  document.getElementById('card-title').textContent = card.name;
  $('detail').replaceChildren(
    el('div', { class: 'lst-detail__card' },
      el('span', { class: 'lst-detail__art', style: `--ph:${page.model.imageColor(card)}` },
        el('span', { class: 'lst-card__ph', 'aria-hidden': 'true', text: card.num }),
        image(card, 'lg')),
      el('div', { class: 'lst-detail__facts' },
        el('p', { class: `lst-detail__status lst-detail__status--${tab}`, text: status }),
        el('p', { class: 'info__meta' }, el('span', { text: card.numberText }), el('span', { text: card.rarityName })),
        el('p', { text: [section?.name, card.variant].filter(Boolean).join(' · ') }))),
    priceBlock(card));
  openDialog(document.getElementById('dlg-card'));
}

function buildPage(list, id, model, sets) {
  const byIdx = new Map(model.cards.map((c) => [c.idx, c]));
  const order = new Map();
  for (const s of model.sections) for (const c of model.cardsBySection.get(s.id)) order.set(c, order.size);
  const sorted = (items) => items.filter((i) => i.card).sort((a, b) => order.get(a.card) - order.get(b.card));
  const items = {
    have: list.have ? sorted([...list.have].map(([idx, qty]) => ({ card: byIdx.get(idx), qty }))) : [],
    missing: list.missing ? sorted(list.missing.map((idx) => ({ card: byIdx.get(idx), qty: 1 }))) : [],
  };
  const tabs = TABS.filter((t) => list[t.id]);
  return { list, id, model, sets, items, tabs };
}

async function load() {
  const m = /#l=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!m) return showMessage('none');
  const list = await decodeList(m[1]);
  if (list === UNSUPPORTED) return showMessage('browser');
  if (!list || (!list.have && !list.missing)) return showMessage('invalid');
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch {
    return showMessage('offline');
  }
  const entry = catalog.collections.find((c) => c.syncKey === list.key);
  if (!entry) return showMessage('unknown');
  const { sets } = await loadSets([entry.id]);
  const loaded = sets.get(entry.id);
  if (!loaded) return showMessage('offline');
  page = buildPage(list, entry.id, loaded.model, sets);
  valuer = makeValuer(sets, storage.getPrefs().currency);
  tab = page.tabs.find((t) => page.items[t.id].length)?.id || page.tabs[0].id;
  $('message').hidden = true;
  $('hero').hidden = false;
  $('body').hidden = false;
  render();
}

function wire() {
  $('search').addEventListener('input', (e) => {
    query = e.target.value;
    if (page) renderCards();
  });
  $('view').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b || b.dataset.view === view) return;
    view = b.dataset.view;
    saveView();
    if (page) renderCards();
  });
  $('cards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-idx]');
    if (b) openCard(Number(b.dataset.idx));
  });
  $('retry').addEventListener('click', () => location.reload());
  storage.onPrefChange((key) => {
    if (key !== 'currency' || !page) return;
    valuer = makeValuer(page.sets, storage.getPrefs().currency);
    render();
  });
  window.addEventListener('hashchange', () => location.reload());
}

async function init() {
  initDialogs();
  initHeader();
  initInstallBanner();
  wire();
  try {
    await load();
  } catch {
    showMessage('offline');
  }
  hideLoader();
}

init();
