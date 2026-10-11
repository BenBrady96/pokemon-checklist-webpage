import { COLLECTION, getTier } from './collection.js';
import * as store from './store.js';
import * as storage from './storage.js';
import { asset } from './paths.js';
import { renderQr } from './sync.js';
import { encodeList, cleanName } from './trade-code.js';
import { readTrade, saveTrade, spareOf } from './trade-data.js';
import { toast, copyText } from './ui.js';

const KEY = 'bt:v1:lists';
const GROUPS = ['have', 'missing'];

const dlg = document.getElementById('dlg-list');
const $ = (name) => dlg.querySelector(`[data-ls="${name}"]`);
const count = new Intl.NumberFormat('en-GB');
const plural = (n, one, many) => `${count.format(n)} ${n === 1 ? one : many}`;
const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const idList = (v) => (Array.isArray(v) ? v.filter((id) => typeof id === 'string') : []);
const variantMark = (variant) => variant.split(/\s+/).map((w) => w[0]).join('').toUpperCase();

let opts = null;
let picks = { have: [], missing: [] };
let url = '';
let linkRun = 0;
let linkTimer = 0;

function readAll() {
  const saved = storage.read(KEY);
  return isObject(saved) ? saved : {};
}

function readOptions() {
  const s = readAll().sets?.[COLLECTION.id];
  return {
    spares: s?.spares !== false,
    missing: s?.missing !== false,
    singles: s?.singles === true,
    counts: s?.counts !== false,
    hide: { have: new Set(idList(s?.hide?.have)), missing: new Set(idList(s?.hide?.missing)) },
  };
}

function saveOptions() {
  const all = readAll();
  const sets = isObject(all.sets) ? all.sets : {};
  sets[COLLECTION.id] = {
    spares: opts.spares,
    missing: opts.missing,
    singles: opts.singles,
    counts: opts.counts,
    hide: {
      have: [...opts.hide.have].filter((id) => store.getQty(id) > 0),
      missing: [...opts.hide.missing].filter((id) => !store.getQty(id)),
    },
  };
  storage.write(KEY, { ...all, sets });
}

const currentTier = () => getTier(store.getPrefs().tier);

function candidates() {
  const tier = currentTier();
  const have = [];
  const missing = [];
  for (const section of COLLECTION.sections) {
    for (const card of COLLECTION.cardsBySection.get(section.id)) {
      const owned = store.getQty(card.id);
      const qty = spareOf(owned, opts.singles);
      if (qty > 0) have.push({ card, qty });
      else if (!owned && tier.sectionIds.has(card.section)) missing.push({ card, qty: 0 });
    }
  }
  return { have, missing };
}

const shown = (group) => picks[group].filter((p) => !opts.hide[group].has(p.card.id));
const isOn = (group) => (group === 'have' ? opts.spares : opts.missing);

function thumb(group, { card, qty }) {
  const many = opts.counts && qty > 1;
  const hidden = opts.hide[group].has(card.id);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ls-thumb';
  button.dataset.group = group;
  button.dataset.id = card.id;
  button.setAttribute('aria-pressed', String(!hidden));
  button.setAttribute('aria-label', `${card.name}, ${card.printed}${card.variant ? `, ${card.variant}` : ''}${many ? `, ${qty} copies` : ''}`);
  button.title = `${card.listText}${card.variant ? ` (${card.variant})` : ''}`;
  const art = document.createElement('span');
  art.className = 'ls-thumb__art';
  art.style.setProperty('--ph', COLLECTION.imageColor(card));
  if (COLLECTION.hasImage(card)) {
    const img = document.createElement('img');
    img.src = COLLECTION.imageUrl(card, 'sm');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 330;
    img.height = 460;
    art.append(img);
  } else {
    art.textContent = card.num;
  }
  if (many) {
    const badge = document.createElement('span');
    badge.className = 'ls-thumb__qty';
    badge.textContent = `×${qty}`;
    art.append(badge);
  }
  const off = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  off.setAttribute('class', 'ls-thumb__off');
  off.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-eye-off');
  off.append(use);
  art.append(off);
  const label = document.createElement('span');
  label.className = 'ls-thumb__num';
  label.textContent = card.variant ? `${card.num} ${variantMark(card.variant)}` : card.num;
  button.append(art, label);
  return button;
}

function groupTitle(group) {
  const all = picks[group];
  const visible = shown(group);
  const copies = visible.reduce((n, p) => n + p.qty, 0);
  if (group === 'have') {
    $('have-count').textContent = all.length
      ? `${visible.length < all.length ? `${count.format(visible.length)} of ${count.format(all.length)} cards` : plural(all.length, 'card', 'cards')}${opts.counts && copies > visible.length ? ` · ${plural(copies, 'copy', 'copies')}` : ''}`
      : '';
  } else {
    $('missing-count').textContent = all.length
      ? (visible.length < all.length ? `${count.format(visible.length)} of ${count.format(all.length)} cards` : plural(all.length, 'card', 'cards'))
      : '';
  }
  $(`${group}-reset`).hidden = visible.length === all.length;
}

function emptyText(group) {
  if (group === 'have') {
    return store.ownedCount()
      ? (opts.singles ? 'You haven’t marked any cards in this set.' : 'You don’t have any spare copies yet. Switch to Count mode to track extra copies, or include your single copies.')
      : 'Mark the cards you own and your spares show here.';
  }
  return 'You’re not missing anything from this set. Nice!';
}

function renderGroup(group) {
  const box = $(`${group}-box`);
  box.hidden = !isOn(group);
  if (!isOn(group)) return;
  const list = $(`${group}-list`);
  const items = picks[group];
  $(`${group}-tip`).hidden = !items.length;
  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'ls-thumbs__empty';
    empty.textContent = emptyText(group);
    list.replaceChildren(empty);
  } else {
    list.replaceChildren(...items.map((p) => {
      const li = document.createElement('li');
      li.append(thumb(group, p));
      return li;
    }));
  }
  groupTitle(group);
}

function renderSwitches() {
  const tier = currentTier();
  $('spares').setAttribute('aria-checked', String(opts.spares));
  $('missing').setAttribute('aria-checked', String(opts.missing));
  $('singles').setAttribute('aria-checked', String(opts.singles));
  $('counts').setAttribute('aria-checked', String(opts.counts));
  $('singles-row').hidden = !opts.spares;
  $('counts-row').hidden = !opts.spares;
  $('spares-hint').textContent = opts.singles ? 'Every card you have, including your only copies' : 'Your spare copies, beyond the first of each card';
  $('missing-hint').textContent = COLLECTION.single ? 'Every card in this set you don’t have yet' : `Cards you don’t have from your ${tier.name}`;
}

function render() {
  picks = candidates();
  renderSwitches();
  for (const group of GROUPS) renderGroup(group);
  queueLink(0);
}

function sendable() {
  return GROUPS.some((group) => isOn(group) && shown(group).length);
}

function paintLink() {
  const ready = Boolean(url);
  $('url').value = url;
  $('copy').disabled = !ready;
  $('share').disabled = !ready;
  const open = $('open');
  if (ready) open.href = url;
  else open.removeAttribute('href');
  open.setAttribute('aria-disabled', String(!ready));
  open.tabIndex = ready ? 0 : -1;
  const box = $('link-box');
  box.hidden = !ready;
  const empty = $('empty');
  empty.hidden = ready || sendable();
  empty.textContent = !opts.spares && !opts.missing
    ? 'Turn on at least one list to make a link.'
    : 'There are no cards to show yet. Mark the cards you own, or show the ones you’ve left out.';
}

function queueLink(delay = 120) {
  clearTimeout(linkTimer);
  linkTimer = setTimeout(renderLink, delay);
}

async function renderLink() {
  const run = ++linkRun;
  if (!sendable()) {
    url = '';
    paintLink();
    return;
  }
  const code = await encodeList({
    name: readTrade().name,
    key: COLLECTION.syncKey,
    n: COLLECTION.maxIdx + 1,
    tier: currentTier().id,
    have: opts.spares ? shown('have').map(({ card, qty }) => [card.idx, qty]) : null,
    missing: opts.missing ? shown('missing').map(({ card }) => card.idx) : null,
    counts: opts.counts,
  });
  if (run !== linkRun) return;
  url = `${asset('list/')}#l=${code}`;
  paintLink();
  if ($('qr-box').open) renderQr($('qr'), url, { level: 'L', maxModules: 129 });
}

function toggleThumb(button) {
  const { group, id } = button.dataset;
  const hide = opts.hide[group];
  if (hide.has(id)) hide.delete(id);
  else hide.add(id);
  button.setAttribute('aria-pressed', String(!hide.has(id)));
  groupTitle(group);
  saveOptions();
  queueLink();
}

function showAll(group) {
  for (const p of picks[group]) opts.hide[group].delete(p.card.id);
  saveOptions();
  renderGroup(group);
  queueLink(0);
}

function flip(key) {
  opts[key] = !opts[key];
  saveOptions();
  render();
}

export function prepareListShare() {
  opts = readOptions();
  url = '';
  $('name').value = readTrade().name;
  $('share').hidden = typeof navigator.share !== 'function';
  $('qr-box').open = false;
  $('qr').replaceChildren();
  render();
  paintLink();
}

export function initListShare() {
  for (const key of ['spares', 'missing', 'singles', 'counts']) $(key).addEventListener('click', () => flip(key));
  for (const group of GROUPS) {
    $(`${group}-list`).addEventListener('click', (e) => {
      const button = e.target.closest('.ls-thumb');
      if (button) toggleThumb(button);
    });
    $(`${group}-reset`).addEventListener('click', () => showAll(group));
  }
  $('name').addEventListener('input', () => {
    const state = readTrade();
    state.name = cleanName($('name').value);
    saveTrade(state);
    queueLink(300);
  });
  $('qr-box').addEventListener('toggle', () => {
    if ($('qr-box').open && url) renderQr($('qr'), url, { level: 'L', maxModules: 129 });
  });
  $('copy').addEventListener('click', async () => {
    if (!url) return;
    const ok = await copyText(url);
    if (!ok) $('url').select();
    toast(ok ? 'Link copied. Send it to anyone.' : 'Select the link and copy it manually.', { icon: 'i-copy' });
  });
  $('share').addEventListener('click', () => {
    if (!url) return;
    navigator.share({
      title: `${COLLECTION.name} trade list`,
      text: `My ${COLLECTION.game.name} ${COLLECTION.name} trade list`,
      url,
    }).catch(() => {});
  });
  $('url').addEventListener('focus', () => $('url').select());
}
