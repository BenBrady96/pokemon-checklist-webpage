import { loadCatalog, entryById, groupByGame } from '../core/catalog.js';
import { fetchCollection } from '../core/collection.js';
import { asset } from '../core/paths.js';
import * as storage from '../core/storage.js';
import { backupFile } from '../core/transfer.js';
import { readHistory } from '../core/history.js';
import { encodeTrade, cleanName } from '../trade/trade-code.js';
import { readTrade, saveTrade } from '../trade/trade-data.js';
import { renderQr } from './qr.js';
import { openDialog, toast, copyText } from './ui.js';
import { el } from './dom.js';
import { plural } from './format.js';

const dlg = document.getElementById('dlg-export');
const field = (name) => dlg.querySelector(`[data-xp="${name}"]`);
const canShare = () => typeof navigator.share === 'function';

let currentId = null;
let catalog = null;
let started = null;
let scope = 'all';
let how = 'link';
let chosen = new Set();
let result = null;
let buildRun = 0;
let nameTimer = 0;

const nameOf = (id) => entryById(catalog, id)?.name || id;

function selectedIds() {
  if (scope === 'set') return [currentId];
  if (!started) return null;
  if (scope === 'choose') return started.filter((id) => chosen.has(id));
  return started;
}

function emptyText(ids) {
  if (scope === 'set') return Object.keys(storage.readCounts(currentId)).length ? '' : 'You haven’t marked any cards in this set yet.';
  if (!started) return '';
  if (!started.length) return 'You haven’t marked any cards yet.';
  return ids.length ? '' : 'Choose at least one set.';
}

function whatText(ids) {
  if (scope === 'all') return 'your whole collection';
  return ids.length === 1 ? nameOf(ids[0]) : plural(ids.length, 'set', 'sets');
}

function paintControls() {
  for (const b of dlg.querySelectorAll('[data-xp-scope]')) b.setAttribute('aria-pressed', String(b.dataset.xpScope === scope));
  for (const b of dlg.querySelectorAll('[data-xp-how]')) b.setAttribute('aria-pressed', String(b.dataset.xpHow === how));
  for (const panel of dlg.querySelectorAll('[data-xp-panel]')) panel.hidden = !result || panel.dataset.xpPanel !== how;
  const chips = field('sets');
  chips.hidden = scope !== 'choose' || !started?.length;
  const toggle = (ids, on) => {
    for (const id of ids) {
      if (on) chosen.add(id);
      else chosen.delete(id);
    }
    paintControls();
    build();
  };
  const chip = (id) => el('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': String(chosen.has(id)),
    onclick: () => toggle([id], !chosen.has(id)),
  }, nameOf(id));
  const groups = groupByGame(catalog, started || []);
  chips.replaceChildren(...(groups.length > 1
    ? groups.flatMap(({ game, ids }) => [
      el('div', { class: 'xp-game' },
        el('span', { class: 'xp-game__name', text: game.name }),
        el('button', { type: 'button', class: 'link-btn', onclick: () => toggle(ids, true) }, 'All'),
        el('button', { type: 'button', class: 'link-btn', onclick: () => toggle(ids, false) }, 'None')),
      ...ids.map(chip),
    ])
    : (started || []).map(chip)));
}

function paintResult() {
  const ids = selectedIds();
  const empty = emptyText(ids);
  const status = field('status');
  status.hidden = !empty && Boolean(result);
  status.textContent = empty || (result ? '' : 'Getting your cards ready…');
  field('summary').textContent = result
    ? `${scope === 'all' ? 'Whole collection' : result.ids.length === 1 ? nameOf(result.ids[0]) : plural(result.ids.length, 'set', 'sets')} · ${plural(result.cards, 'card', 'cards')}`
    : '';
  for (const b of dlg.querySelectorAll('[data-xp-action^="share"]')) b.hidden = !canShare();
  if (!result) return;
  field('url').value = result.url;
  field('code').value = result.code;
  field('file-hint').textContent = `Saves ${whatText(result.ids)}${result.whole ? ', with your Portfolio value history,' : ''} to a file in your downloads. Restore it with Import on any device.`;
  if (how === 'qr') paintQr();
}

async function paintQr() {
  const box = field('qr');
  const note = field('qr-note');
  const url = result.url;
  const outcome = await renderQr(box, url, { level: 'L', maxModules: 129 });
  if (result?.url !== url) return;
  box.hidden = outcome === 'big';
  note.hidden = outcome !== 'big';
  note.textContent = outcome === 'big' ? 'That’s too much to fit in one QR code. Choose fewer sets, or send the link, code or file instead.' : '';
}

async function build() {
  const run = ++buildRun;
  result = null;
  paintControls();
  paintResult();
  const ids = selectedIds();
  if (!ids || emptyText(ids)) return;
  const { tiers } = storage.getPrefs();
  let sets;
  try {
    sets = await Promise.all(ids.map(async (id) => {
      const model = await fetchCollection(id);
      return { id, model, counts: storage.readCounts(id), tier: model.getTier(tiers[id]).id };
    }));
  } catch {
    if (run !== buildRun) return;
    field('status').hidden = false;
    field('status').textContent = 'Couldn’t get your cards ready. Check your connection and try again.';
    return;
  }
  const name = readTrade().name;
  const code = await encodeTrade({ name, sets });
  if (run !== buildRun) return;
  result = {
    ids,
    sets,
    name,
    code,
    whole: scope === 'all',
    cards: sets.reduce((n, s) => n + Object.keys(s.counts).length, 0),
    url: `${asset(ids.length === 1 ? `${ids[0]}/` : '')}#sync=${code}`,
  };
  paintControls();
  paintResult();
}

function markBackup() {
  if (result?.whole) storage.setPref('lastBackup', Date.now());
}

function shareTitle() {
  return result.ids.length === 1 ? `My ${nameOf(result.ids[0])} cards` : `My cards from ${plural(result.ids.length, 'set', 'sets')}`;
}

function download(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function fileName() {
  const day = new Date().toISOString().slice(0, 10);
  if (result.whole) return `binder-tracker-backup-${day}.json`;
  if (result.ids.length === 1) return `binder-tracker-${result.ids[0].split('/').pop()}-${day}.json`;
  return `binder-tracker-${result.ids.length}-sets-${day}.json`;
}

const actions = {
  async 'copy-link'() {
    const ok = await copyText(result.url);
    if (ok) markBackup();
    else field('url').select();
    toast(ok ? 'Link copied.' : 'Select the link and copy it manually.', { icon: 'i-link' });
  },
  'share-link'() {
    navigator.share({ title: shareTitle(), url: result.url }).then(markBackup, () => {});
  },
  async 'copy-code'() {
    const ok = await copyText(result.code);
    if (ok) markBackup();
    else field('code').select();
    toast(ok ? 'Code copied. Paste it into Import on the other device.' : 'Select the code and copy it manually.', { icon: 'i-copy' });
  },
  'share-code'() {
    navigator.share({ text: result.code }).then(markBackup, () => {});
  },
  'save-file'() {
    const data = backupFile(result.sets.map(({ id, counts, tier }) => ({ id, counts, tier })), {
      name: result.name,
      history: result.whole ? readHistory() : null,
    });
    download(data, fileName());
    markBackup();
    toast('Saved to your downloads.', { icon: 'i-download' });
  },
};

export function openExport() {
  scope = currentId ? 'set' : 'all';
  field('name').value = readTrade().name;
  for (const b of dlg.querySelectorAll('[data-xp-scope="set"]')) b.hidden = !currentId;
  openDialog(dlg);
  loadCatalog().then((c) => {
    catalog = c;
    const order = new Map(c.collections.map((x, i) => [x.id, i]));
    started = storage.storedCollections().map(({ id }) => id).filter((id) => order.has(id)).sort((a, b) => order.get(a) - order.get(b));
    chosen = new Set(started);
    build();
  }, () => {
    field('status').hidden = false;
    field('status').textContent = 'Couldn’t load the list of sets. Check your connection and try again.';
  });
  build();
}

export function initExport({ currentId: id = null } = {}) {
  currentId = id;
  dlg.addEventListener('click', (e) => {
    const scopeBtn = e.target.closest('[data-xp-scope]');
    const howBtn = e.target.closest('[data-xp-how]');
    const action = e.target.closest('[data-xp-action]');
    if (scopeBtn && scopeBtn.dataset.xpScope !== scope) {
      scope = scopeBtn.dataset.xpScope;
      build();
    } else if (howBtn && howBtn.dataset.xpHow !== how) {
      how = howBtn.dataset.xpHow;
      paintControls();
      paintResult();
    } else if (action && result) {
      actions[action.dataset.xpAction]?.();
    }
  });
  field('name').addEventListener('input', () => {
    const state = readTrade();
    state.name = cleanName(field('name').value);
    saveTrade(state);
    clearTimeout(nameTimer);
    nameTimer = setTimeout(build, 300);
  });
  for (const name of ['url', 'code']) field(name).addEventListener('focus', () => field(name).select());
}
