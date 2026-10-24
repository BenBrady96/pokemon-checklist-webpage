import { loadCatalog, entryById, groupByGame } from '../core/catalog.js';
import { fetchCollection } from '../core/collection.js';
import { asset } from '../core/paths.js';
import { normalize } from '../core/model.js';
import * as storage from '../core/storage.js';
import { readTradeText, UNSUPPORTED } from '../trade/trade-code.js';
import { resolveFriend } from '../trade/trade-data.js';
import { confirmApply, applyReceived, tierCounts } from '../shared/import.js';
import { cardArt } from '../shared/card-art.js';
import { initDialogs, hideLoader, toast } from '../shared/ui.js';
import { initHeader } from '../shared/header.js';
import { initInstallBanner } from '../shared/pwa.js';
import { el, icon } from '../shared/dom.js';
import { count, plural, formatAgo } from '../shared/format.js';

const MESSAGES = {
  none: ['There’s no collection here', 'This page shows cards someone has shared with you. Ask them to send you the full link.'],
  invalid: ['This link isn’t complete', 'It may have been cut off when it was copied or sent. Ask for the link again.'],
  empty: ['There are no cards in this link', 'Ask them to mark their cards, then export again.'],
  browser: ['This link needs a newer browser', 'Update your browser, then open the link again.'],
  unknown: ['These sets aren’t here yet', 'The link is for sets this version of the site doesn’t have. Refresh the page to update it.', true],
  offline: ['Couldn’t load the cards', 'Check your connection and try again.', true],
};
const TESTS = {
  all: () => true,
  have: (i) => i.theirs > 0,
  need: (i) => !i.theirs && !i.unknown,
  both: (i) => i.mine > 0 && i.theirs > 0,
  mine: (i) => i.mine > 0 && !i.theirs,
  theirs: (i) => !i.mine && i.theirs > 0,
  neither: (i) => !i.mine && !i.theirs && !i.unknown,
};

const $ = (name) => document.querySelector(`[data-shc="${name}"]`);

let page = null;
let code = '';
let tab = 'view';
let setId = null;
let filter = 'all';
let query = '';
let view = storage.getPrefs().sharedView === 'grid' ? 'grid' : 'list';
let pushed = false;
const tierChoice = new Map();

const them = () => page.received.name || 'Them';
const entryOf = (id) => entryById(page.catalog, id);

function filtersFor() {
  const name = page.received.name;
  return tab === 'compare'
    ? [['all', 'All'], ['both', 'Both have'], ['mine', 'Only you'], ['theirs', `Only ${name || 'them'}`], ['neither', 'Neither']]
    : [['all', 'All'], ['have', name ? `${name} has` : 'They have'], ['need', name ? `${name} needs` : 'They need']];
}

function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  return { code: params.get('sync') || '', tab: params.get('tab') === 'compare' ? 'compare' : 'view', set: params.get('set') };
}

function hashFor() {
  const params = new URLSearchParams({ sync: code, tab });
  if (setId && page.ids.length > 1) params.set('set', page.models.get(setId).syncKey);
  return `#${params}`;
}

function showMessage(kind) {
  const [title, text, retry] = MESSAGES[kind];
  for (const name of ['hero', 'sets', 'body']) $(name).hidden = true;
  $('message').hidden = false;
  $('message-title').textContent = title;
  $('message-text').textContent = text;
  $('retry').hidden = !retry;
  document.title = `${title} · Binder Tracker`;
}

const tierOf = (id) => page.models.get(id).getTier(tierChoice.get(id) ?? storage.getPrefs().tiers[id]);
const statsOf = (id) => tierCounts(page.models.get(id), storage.readCounts(id), page.received.sets[id].q, tierOf(id));

function bar(label, n, total, who) {
  return el('span', { class: `shc-bar shc-bar--${who}` },
    el('span', { class: 'shc-bar__label', text: label }),
    el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: `--p:${total ? n / total : 0}` })),
    el('b', { class: 'shc-bar__count', text: `${count.format(n)}/${count.format(total)}` }));
}

function barsFor(s) {
  return tab === 'compare' ? [bar('You', s.you, s.total, 'you'), bar(them(), s.them, s.total, 'them')] : [bar(them(), s.them, s.total, 'them')];
}

function renderHero() {
  const { received, ids } = page;
  const title = received.name ? `${received.name}’s collection` : 'Shared collection';
  $('title').textContent = title;
  document.title = `${title} · Binder Tracker`;
  const cards = ids.reduce((n, id) => n + Object.keys(received.sets[id].q).length, 0);
  $('meta').textContent = [
    plural(ids.length, 'set', 'sets'),
    plural(cards, 'card', 'cards'),
    received.created ? `made ${formatAgo(received.created)}` : '',
  ].filter(Boolean).join(' · ');
  const unknown = $('unknown');
  unknown.hidden = !received.unknown;
  unknown.textContent = received.unknown ? `${plural(received.unknown, 'set in the link isn’t', 'sets in the link aren’t')} on this version of the site yet. Refresh the page to update it.` : '';
  for (const b of document.querySelectorAll('[data-shc-tab]')) {
    b.setAttribute('aria-pressed', String(b.dataset.shcTab === tab));
    if (b.dataset.shcTab === 'view') b.textContent = received.name ? `${received.name}’s cards` : 'Their cards';
  }
  const scope = setId ? page.models.get(setId).name : plural(ids.length, 'set', 'sets');
  const which = ids.length < 2 ? '' : setId ? ' this set' : ' all';
  for (const b of document.querySelectorAll('[data-shc-action]')) {
    const verb = b.dataset.shcAction === 'merge' ? 'Merge' : 'Replace';
    b.textContent = `${verb}${which}`;
    b.setAttribute('aria-label', `${verb} ${scope} into your collection`);
  }
}

function renderSets() {
  const row = (id) => {
    const model = page.models.get(id);
    const info = entryOf(id);
    const s = statsOf(id);
    return el('li', {}, el('button', { type: 'button', class: 'pf-row shc-set-row', 'data-set': id },
      el('span', { class: 'pf-row__logo' }, info?.logo ? el('img', { src: asset(info.logo), alt: '', loading: 'lazy', decoding: 'async' }) : null),
      el('span', { class: 'pf-row__main' }, el('b', { text: model.name }), el('small', { text: model.single ? plural(s.total, 'card', 'cards') : s.tier.name })),
      el('span', { class: 'shc-bars' }, ...barsFor(s))));
  };
  const groups = groupByGame(page.catalog, page.ids);
  $('set-list').replaceChildren(...(groups.length > 1
    ? groups.flatMap(({ game, ids }) => [el('li', { class: 'list-game' }, el('h3', { class: 'list-game__title', text: game.name })), ...ids.map(row)])
    : page.ids.map(row)));
}

function itemsOf(id) {
  const mine = storage.readCounts(id);
  const s = page.received.sets[id];
  return tierOf(id).cards.map((card) => ({
    card, mine: mine[card.id] || 0, theirs: s.q[card.id] || 0, unknown: s.n != null && card.idx >= s.n,
  }));
}

function cell(who, q, unknown, labelled) {
  const state = unknown ? 'not in the link' : q > 1 ? `${q} copies` : q ? 'has it' : 'doesn’t have it';
  return el('span', { class: `shc-cell${q ? ' is-on' : ''}${unknown ? ' is-unknown' : ''}`, 'aria-label': `${who}: ${state}`, title: `${who}: ${state}` },
    labelled ? el('span', { class: 'shc-cell__who', text: who }) : null,
    unknown ? '?' : q ? icon('i-check') : '–',
    q > 1 ? el('span', { class: 'shc-cell__qty', text: `×${q}` }) : null);
}

function cellsFor(item, labelled) {
  return tab === 'compare'
    ? [cell('You', item.mine, false, labelled), cell(them(), item.theirs, item.unknown, labelled)]
    : [cell(them(), item.theirs, item.unknown, labelled)];
}

const faded = (item) => (tab === 'compare' ? !item.mine && !item.theirs : !item.theirs);

function tile(model, item) {
  const { card } = item;
  return el('li', {}, el('div', { class: `lst-card shc-card${faded(item) ? ' is-faded' : ''}` },
    cardArt(model, card, tab === 'view' ? item.theirs : 0, 'lst-card__art'),
    el('span', { class: 'lst-card__cap' },
      el('b', { class: 'lst-card__name', text: card.name }),
      el('small', { class: 'lst-card__sub', text: [card.printed, card.variant || card.rarityName].filter(Boolean).join(' · ') })),
    el('span', { class: 'shc-marks' }, ...cellsFor(item, true))));
}

function row(model, item) {
  const { card } = item;
  return el('li', {}, el('div', { class: `pf-row lst-row shc-row${faded(item) ? ' is-faded' : ''}` },
    cardArt(model, card, 0, 'lst-row__art'),
    el('span', { class: 'pf-row__main' },
      el('b', { text: card.name }),
      el('small', { text: [card.printed, card.rarityName, card.variant].filter(Boolean).join(' · ') })),
    el('span', { class: 'shc-cols' }, ...cellsFor(item, false))));
}

function renderSet() {
  const model = page.models.get(setId);
  const info = entryOf(setId);
  $('back').hidden = page.ids.length < 2;
  const logo = $('logo');
  logo.hidden = !info?.logo;
  if (info?.logo) {
    logo.src = asset(info.logo);
    logo.alt = '';
  }
  $('set-title').textContent = model.name;
  const s = statsOf(setId);
  $('summary').replaceChildren(...barsFor(s));
  $('tier-bar').hidden = model.single;
  $('tiers').replaceChildren(...model.visibleTiers.map((t) => el('button', {
    type: 'button', class: 'seg__btn', 'data-tier': t.id, 'aria-pressed': String(t.id === s.tier.id),
  }, el('b', { text: t.label }), el('small', { text: plural(t.cards.length, 'card', 'cards') }))));
  const items = itemsOf(setId);
  const options = filtersFor();
  if (!options.some(([id]) => id === filter)) filter = 'all';
  $('filters').replaceChildren(...options.map(([id, label]) => el('button', {
    type: 'button', class: 'chip', 'data-filter': id, 'aria-pressed': String(id === filter),
  }, el('span', { text: label }), el('span', { class: 'chip__count', text: count.format(items.filter(TESTS[id]).length) }))));
  for (const b of $('view').querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
  renderCards(model, items);
}

function renderCards(model, items) {
  const box = $('cards');
  box.dataset.view = view;
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const shown = items.filter(TESTS[filter]).filter(({ card }) => terms.every((t) => card.search.includes(` ${t}`)));
  if (!shown.length) {
    box.replaceChildren(el('p', { class: 'lst-empty', text: terms.length ? `No cards match “${query.trim()}”.` : 'No cards here.' }));
    return;
  }
  const bySection = new Map();
  for (const item of shown) {
    if (!bySection.has(item.card.section)) bySection.set(item.card.section, []);
    bySection.get(item.card.section).push(item);
  }
  const heads = tab === 'compare' ? ['You', them()] : [them()];
  box.replaceChildren(...model.sections.filter((s) => bySection.has(s.id)).map((s) => {
    const group = bySection.get(s.id);
    return el('section', { class: 'lst-sec' },
      el('h2', { class: 'lst-sec__title shc-sec' }, s.name, el('small', { text: count.format(group.length) }),
        view === 'list' ? el('span', { class: 'shc-cols shc-cols--head', 'aria-hidden': 'true' }, ...heads.map((h) => el('span', { class: 'shc-cell', text: h }))) : null),
      el('ul', { class: view === 'grid' ? 'lst-grid' : 'pf-list lst-rows' }, ...group.map((item) => (view === 'grid' ? tile(model, item) : row(model, item)))));
  }));
}

function render() {
  if (!page) return;
  renderHero();
  $('sets').hidden = Boolean(setId);
  $('body').hidden = !setId;
  if (setId) renderSet();
  else renderSets();
}

async function apply(choice) {
  const ids = setId ? [setId] : page.ids;
  const names = ids.map((id) => page.models.get(id).name);
  if (!(await confirmApply(choice, names, 'link'))) return;
  try {
    await applyReceived(page.received, ids, choice, { names, refresh: render });
  } catch {
    toast('Couldn’t import that. Check your connection and try again.');
  }
}

function openSet(id) {
  setId = id;
  filter = 'all';
  query = '';
  $('search').value = '';
  history.pushState(null, '', hashFor());
  pushed = true;
  render();
  window.scrollTo({ top: 0 });
}

function fromHash() {
  const h = readHash();
  if (h.code !== code) {
    location.reload();
    return;
  }
  tab = h.tab;
  setId = page.ids.length === 1 ? page.ids[0] : page.ids.find((id) => page.models.get(id).syncKey === h.set) || null;
  if (!setId) pushed = false;
  render();
}

async function load() {
  const h = readHash();
  if (!h.code) return showMessage('none');
  code = h.code;
  const decoded = await readTradeText(`#sync=${code}`);
  if (decoded === UNSUPPORTED) return showMessage('browser');
  if (decoded?.kind !== 'trade') return showMessage('invalid');
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch {
    return showMessage('offline');
  }
  const received = await resolveFriend(decoded, catalog);
  const order = new Map(catalog.collections.map((c, i) => [c.id, i]));
  const ids = Object.keys(received.sets).filter((id) => order.has(id)).sort((a, b) => order.get(a) - order.get(b));
  if (!ids.length) return showMessage(received.unknown ? 'unknown' : 'empty');
  const models = new Map(await Promise.all(ids.map(async (id) => [id, await fetchCollection(id, { images: true })])));
  page = { received, ids, models, catalog };
  tab = h.tab;
  setId = ids.length === 1 ? ids[0] : ids.find((id) => models.get(id).syncKey === h.set) || null;
  $('message').hidden = true;
  $('hero').hidden = false;
  render();
}

function wire() {
  document.addEventListener('click', (e) => {
    if (!page) return;
    const tabBtn = e.target.closest('[data-shc-tab]');
    const action = e.target.closest('[data-shc-action]');
    const setRow = e.target.closest('[data-set]');
    const tierBtn = e.target.closest('[data-tier]');
    const filterBtn = e.target.closest('[data-filter]');
    const viewBtn = e.target.closest('[data-view]');
    if (tabBtn && tabBtn.dataset.shcTab !== tab) {
      tab = tabBtn.dataset.shcTab;
      history.replaceState(history.state, '', hashFor());
      render();
    } else if (action) {
      apply(action.dataset.shcAction);
    } else if (setRow) {
      openSet(setRow.dataset.set);
    } else if (tierBtn) {
      tierChoice.set(setId, tierBtn.dataset.tier);
      render();
    } else if (filterBtn) {
      filter = filterBtn.dataset.filter;
      render();
    } else if (viewBtn && viewBtn.dataset.view !== view) {
      view = viewBtn.dataset.view;
      storage.setPref('sharedView', view);
      render();
    }
  });
  $('back').addEventListener('click', () => {
    if (pushed) {
      history.back();
      return;
    }
    setId = null;
    history.replaceState(null, '', hashFor());
    render();
  });
  $('search').addEventListener('input', (e) => {
    query = e.target.value;
    if (page && setId) renderCards(page.models.get(setId), itemsOf(setId));
  });
  $('retry').addEventListener('click', () => location.reload());
  window.addEventListener('popstate', () => {
    if (page) fromHash();
  });
  window.addEventListener('hashchange', () => {
    if (readHash().code !== code) location.reload();
  });
  window.addEventListener('storage', (e) => {
    if (storage.isCollectionKey(e.key)) render();
  });
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
