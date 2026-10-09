import { loadCatalog, collectionUrl } from './catalog.js';
import { fetchCollection } from './collection.js';
import { normalize } from './model.js';
import * as storage from './storage.js';
import { parseSyncText, parseBackup, askIncoming, initImport, exportFile } from './sync.js';
import { resolveCodes, resolveBackup, allCounts, backupCode, applyEntries, catalogEntryFor } from './transfer.js';
import { initDialogs, openDialog, closeDialog, toast, copyText, hideLoader } from './ui.js';
import { initPWA } from './pwa.js';
import { mergeBackupHistory, recordSnapshot } from './history.js';
import { formatMoney } from './pricing.js';
import { collectionWorth } from './worth.js';
import { initHeader, showWorth } from './header.js';

const search = document.getElementById('set-search');
const continueSection = document.getElementById('continue');
const continueGrid = document.getElementById('continue-grid');
const noMatch = document.getElementById('no-match');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
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
    const text = ` ${normalize(`${c?.name || ''} ${c?.code || ''} ${c?.series || ''} ${c?.slug.replace(/-/g, ' ') || ''}`)} `;
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

async function importMany(entries, source) {
  if (!entries.length) {
    toast('None of those cards are from sets on this site.');
    return false;
  }
  const choice = await askIncoming({
    source,
    multi: { entries: entries.map((e) => ({ name: e.name, incoming: e.counts, current: storage.readCounts(e.id) })) },
  });
  if (!choice) return false;
  const result = applyEntries(entries, choice);
  showProgress();
  if (!result.changed) {
    toast('Your collections already match.');
    return true;
  }
  navigator.storage?.persist?.().catch(() => {});
  toast(`${choice === 'merge' ? 'Merged' : 'Replaced'} ${plural(result.changed, 'set', 'sets')}`, {
    icon: 'i-check',
    action: {
      label: 'Undo',
      onClick() {
        result.undo();
        showProgress();
        toast('Import undone', { icon: 'i-undo' });
      },
    },
  });
  return true;
}

async function handleIncoming({ decoded, codes }, source) {
  if (decoded.length === 1) {
    const entry = await catalogEntryFor(decoded[0]);
    if (!entry) {
      toast('That code is for a set this site doesn’t have.');
      return false;
    }
    location.href = `${collectionUrl(entry.id)}#sync=${codes[0]}`;
    return true;
  }
  return importMany(await resolveCodes(decoded), source);
}

async function checkIncomingLink() {
  const m = /^#sync=([A-Za-z0-9_.-]+)$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  const incoming = parseSyncText(`#sync=${m[1]}`);
  if (!incoming) {
    toast('That sync link isn’t valid.');
    return;
  }
  try {
    await handleIncoming(incoming, 'link');
  } catch {
    toast('Couldn’t load that link. Check your connection and try again.');
  }
}

const formatAgo = (ts) => {
  const days = Math.floor((Date.now() - ts) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

function openScanner() {
  import('./scan.js').then(
    (m) => m.openScanner({ onSaved: showProgress }),
    () => toast('Couldn’t load the scanner. Check your connection and try again.'),
  );
}

function paintLastBackup() {
  const last = storage.getPrefs().lastBackup;
  for (const el of document.querySelectorAll('[data-last-backup]')) {
    el.textContent = last ? `Last backup ${formatAgo(last)}` : 'Every set you’re collecting, as a code or a file';
  }
}

async function openNamed(name) {
  if (name === 'scan') return openScanner();
  const dlg = document.getElementById(`dlg-${name}`);
  if (!dlg) return;
  if (name === 'menu') paintLastBackup();
  if (name === 'export') {
    const box = document.getElementById('export-code');
    box.value = '';
    dlg.querySelector('[data-action="share-code"]').hidden = typeof navigator.share !== 'function';
    openDialog(dlg);
    try {
      box.value = await backupCode();
    } catch {
      toast('Couldn’t make the code. Check your connection, or save a file instead.');
    }
    return;
  }
  openDialog(dlg);
}

const actions = {
  async 'copy-code'() {
    const box = document.getElementById('export-code');
    if (!box.value) {
      toast('You haven’t marked any cards yet.');
      return;
    }
    const ok = await copyText(box.value);
    if (ok) storage.setPref('lastBackup', Date.now());
    else box.select();
    toast(ok ? 'Code copied. Paste it into Import backup on your other device.' : 'Select the code and copy it manually.', { icon: 'i-copy' });
  },
  'share-code'() {
    navigator.share({ text: document.getElementById('export-code').value })
      .then(() => storage.setPref('lastBackup', Date.now()), () => {});
  },
  'save-file'() {
    exportFile(allCounts());
    storage.setPref('lastBackup', Date.now());
    closeDialog(document.getElementById('dlg-export'));
    toast('Backup saved to your downloads.', { icon: 'i-download' });
  },
  'choose-file'() {
    document.getElementById('import-file').click();
  },
};

function wire() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open], [data-action]');
    if (!t) return;
    if (t.dataset.open) openNamed(t.dataset.open);
    else actions[t.dataset.action]?.();
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
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const entries = parseBackup(text);
    if (!entries) {
      toast('That file isn’t a checklist backup.');
      return;
    }
    try {
      if (await importMany(await resolveBackup(entries), 'file')) mergeBackupHistory(text);
    } catch {
      toast('Couldn’t read that backup. Check your connection and try again.');
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
  initImport({
    async onImport(incoming) {
      try {
        return await handleIncoming(incoming, incoming.source);
      } catch {
        toast('Couldn’t read that code. Check your connection and try again.');
        return false;
      }
    },
    describe(decoded) {
      const names = decoded.map((d) => catalog.collections.find((c) => (d.collection ? c.id === d.collection : c.syncKey === d.key))?.name || 'an unknown set');
      return names.length > 2 ? `${names.length} sets` : names.join(' and ');
    },
  });
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
