import { loadCatalog } from '../core/catalog.js';
import { fetchCollection } from '../core/collection.js';
import { normalize } from '../core/model.js';
import * as storage from '../core/storage.js';
import { initExport, openExport } from '../shared/export.js';
import { initImport, checkIncomingLink } from '../shared/import.js';
import { initDialogs, openDialog, toast, hideLoader } from '../shared/ui.js';
import { initPWA, initInstallBanner } from '../shared/pwa.js';
import { recordSnapshot } from '../core/history.js';
import { formatMoney } from '../core/pricing.js';
import { collectionWorth } from '../core/worth.js';
import { initHeader, showWorth } from '../shared/header.js';
import { plural, formatAgo } from '../shared/format.js';

const search = document.getElementById('set-search');
const continueSection = document.getElementById('continue');
const continueGrid = document.getElementById('continue-grid');
const noMatch = document.getElementById('no-match');
let catalog = { games: [], collections: [] };

const tilesFor = (id) => document.querySelectorAll(`.set-tile[data-id="${CSS.escape(id)}"]`);
const summaryTried = new Set();
const worthById = new Map();
const setValues = new Map();
let worthRun = 0;

function setValueOf(c) {
  if (!setValues.has(c.id)) {
    let value = null;
    try {
      value = JSON.parse(tilesFor(c.id)[0]?.dataset.values || 'null');
    } catch {}
    setValues.set(c.id, value);
  }
  return setValues.get(c.id);
}

function valueText(c) {
  const { currency, tiers } = storage.getPrefs();
  const value = setValueOf(c);
  const total = value && (value.tiers[tiers[c.id]] ?? value.tiers[c.defaultTier]);
  const whole = total == null ? '' : formatMoney(total, { currency, rates: value.rates, short: true, approx: true });
  const worth = worthById.get(c.id);
  if (!worth?.loaded || !worth.unique) return whole;
  const mine = formatMoney(worth.usd, { currency, rates: worth.rates, short: true });
  return whole ? `${mine} of ${whole}` : mine;
}

function paintValues() {
  for (const c of catalog.collections) {
    const text = valueText(c);
    for (const tile of tilesFor(c.id)) {
      const box = tile.querySelector('.set-tile__value');
      if (!box) continue;
      box.textContent = text;
      box.hidden = !text;
    }
  }
}

async function refreshWorth() {
  if (!catalog.collections.length) return;
  const run = ++worthRun;
  const ids = storage.storedCollections().map(({ id }) => id).filter((id) => catalog.collections.some((c) => c.id === id));
  const worth = await collectionWorth(ids);
  if (run !== worthRun) return;
  worthById.clear();
  for (const s of worth.sets) worthById.set(s.id, s);
  paintValues();
  if (worth.loaded) recordSnapshot(worth);
  showWorth(worth);
}

const summaryIsCurrent = (c, summary) => Boolean(summary) && c.tiers.some((t) => t.id === summary.tier && t.count === summary.total);
const collected = ({ record }) => (record.summary?.total ? record.summary.owned / record.summary.total : 0);
const cardsOwned = ({ record }) => record.summary?.owned ?? Object.keys(record.q).length;

async function refreshSummaries(ids) {
  for (const id of ids) summaryTried.add(id);
  const results = await Promise.allSettled(ids.map(async (id) => storage.refreshSummary(id, await fetchCollection(id))));
  if (results.some((r) => r.value)) showProgress();
}

function showProgress() {
  const stored = storage.storedCollections()
    .filter(({ id }) => catalog.collections.some((c) => c.id === id))
    .sort((a, b) => cardsOwned(b) - cardsOwned(a) || collected(b) - collected(a));
  const stale = [];
  for (const c of catalog.collections) {
    const summary = storage.readRecord(c.id)?.summary;
    const owned = Object.keys(storage.readCounts(c.id)).length;
    if (owned && !summaryTried.has(c.id) && !summaryIsCurrent(c, summary)) stale.push(c.id);
    for (const tile of tilesFor(c.id)) {
      const progress = tile.querySelector('.set-tile__progress');
      progress.classList.toggle('has-cards', Boolean(owned));
      if (!owned) continue;
      const total = summary?.total;
      const count = summary ? summary.owned : owned;
      tile.querySelector('.set-tile__count').textContent = total ? `${count}/${total}` : `${plural(owned, 'card', 'cards')}`;
      const bar = tile.querySelector('.bar');
      bar.hidden = !total;
      bar.firstElementChild.style.setProperty('--p', total ? count / total : 0);
      tile.classList.toggle('is-complete', Boolean(total) && count === total);
    }
  }
  continueGrid.replaceChildren(...stored.map(({ id }) => {
    const tile = document.querySelector(`#catalog .set-tile[data-id="${CSS.escape(id)}"]`);
    return tile ? tile.cloneNode(true) : null;
  }).filter(Boolean));
  continueSection.hidden = !continueGrid.children.length;
  paintValues();
  refreshWorth();
  if (stale.length) refreshSummaries(stale);
}

function filterSets() {
  const tokens = normalize(search.value).split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const tile of document.querySelectorAll('#catalog .set-tile')) {
    const c = catalog.collections.find((x) => x.id === tile.dataset.id);
    const words = c ? `${c.name} ${c.code || ''} ${c.series || ''} ${c.slug.replace(/-/g, ' ')}` : tile.dataset.search || '';
    const text = ` ${normalize(words)} `;
    const ok = tokens.every((t) => text.includes(` ${t}`) || text.includes(t));
    tile.hidden = !ok;
    if (ok) shown++;
  }
  for (const group of document.querySelectorAll('#catalog [data-series], #catalog .home-game')) {
    group.hidden = !group.querySelector('.set-tile:not([hidden])');
  }
  for (const series of document.querySelectorAll('#catalog details[data-series]')) {
    series.open = tokens.length ? !series.hidden : series.hasAttribute('data-open');
  }
  for (const sub of document.querySelectorAll('#catalog .home-series__sub')) {
    sub.hidden = !sub.nextElementSibling?.querySelector('.set-tile:not([hidden])');
  }
  continueSection.hidden = Boolean(tokens.length) || !continueGrid.children.length;
  noMatch.hidden = shown > 0;
  noMatch.querySelector('span').textContent = search.value.trim();
}

function openScanner() {
  import('../scan/scan.js').then(
    (m) => m.openScanner({ onSaved: showProgress }),
    () => toast('Couldn’t load the scanner. Check your connection and try again.'),
  );
}

function paintLastBackup() {
  const last = storage.getPrefs().lastBackup;
  for (const el of document.querySelectorAll('[data-last-backup]')) {
    el.textContent = last ? `Last backup ${formatAgo(last)}` : 'A set or your whole collection, as a link, code, QR code or file';
  }
}

function openNamed(name) {
  if (name === 'scan') return openScanner();
  if (name === 'export') return openExport();
  const dlg = document.getElementById(`dlg-${name}`);
  if (!dlg) return;
  if (name === 'menu') paintLastBackup();
  openDialog(dlg);
}

function wire() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open]');
    if (t) openNamed(t.dataset.open);
  });
  storage.onPrefChange((key) => {
    if (key === 'currency') paintValues();
    if (key === 'lastBackup') paintLastBackup();
  });
  search.addEventListener('input', filterSets);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      search.value = '';
      filterSets();
    } else if (e.key === 'Enter') {
      document.querySelector('#catalog .set-tile:not([hidden])')?.focus();
    }
  });
  window.addEventListener('hashchange', checkIncomingLink);
  window.addEventListener('storage', (e) => {
    if (storage.isCollectionKey(e.key)) showProgress();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) showProgress();
  });
}

async function init() {
  initDialogs();
  initHeader();
  paintLastBackup();
  wire();
  if (!storage.isStorageOk()) document.getElementById('storage-banner').hidden = false;
  initInstallBanner();
  initExport();
  initImport({ refresh: showProgress });
  try {
    catalog = await loadCatalog();
  } catch {
  }
  showProgress();
  hideLoader();
  if (search.value) filterSets();
  if (new URLSearchParams(location.search).has('offline')) {
    history.replaceState(null, '', location.pathname + location.hash);
    toast('You’re offline, and that set isn’t saved on this device yet. Sets you’ve opened before still work.', { timeout: 8000 });
  }
  checkIncomingLink();
  initPWA();
}

init();
