import { loadCatalog, entryById, groupByGame } from '../core/catalog.js';
import { fetchCollection } from '../core/collection.js';
import { asset } from '../core/paths.js';
import * as storage from '../core/storage.js';
import { parseBackup } from '../core/codec.js';
import { applyEntries, findEntry } from '../core/transfer.js';
import { mergeBackupHistory } from '../core/history.js';
import { encodeTrade, readTradeText, UNSUPPORTED } from '../trade/trade-code.js';
import { resolveFriend, resolveBackupFile } from '../trade/trade-data.js';
import { scanQr } from './qr.js';
import { openDialog, closeDialog, confirmAction, toast } from './ui.js';
import { el } from './dom.js';
import { plural, formatAgo } from './format.js';

const SOURCE_TEXT = { link: 'In the link', code: 'In the code', file: 'In the file' };

let hooks = {};
let pending = null;
let checkRun = 0;

const byId = entryById;
const listNames = (names) => (names.length > 2 ? plural(names.length, 'set', 'sets') : names.join(' and '));
const sourceOf = (text) => (/#(sync|t)=|^https?:/i.test(text.trim()) ? 'link' : 'code');

export async function readCode(text) {
  const decoded = await readTradeText(text);
  if (decoded === UNSUPPORTED) return { error: 'This code needs a newer browser. Update your browser and try again.' };
  if (decoded?.kind === 'proposal') return { error: 'That’s a proposed trade. Open it on the Trade page.' };
  if (decoded?.kind !== 'trade') return { error: 'That isn’t a valid link or code.' };
  return { decoded };
}

export function confirmApply(choice, names, source = 'link') {
  const what = listNames(names);
  return confirmAction(choice === 'merge'
    ? {
      title: 'Merge into your collection?',
      text: `This changes your saved cards in ${what} on this device. Cards you don’t have are added and the higher copy count of each card is kept. You can undo straight after.`,
      confirmLabel: 'Merge',
    }
    : {
      title: 'Replace your cards?',
      text: `Your saved cards in ${what} on this device are replaced with the ones in this ${source}. Cards that aren’t in it are unmarked. You can undo straight after.`,
      confirmLabel: 'Replace',
    });
}

export async function applyReceived(received, ids, choice, { names, current, undoCurrent, refresh, fileText } = {}) {
  const entries = await Promise.all(ids.map(async (id) => ({
    id, model: await fetchCollection(id, { images: true }), counts: received.sets[id].q,
  })));
  const result = applyEntries(entries, choice, current);
  refresh?.();
  if (!result.changed) {
    toast('Your collection already matches.');
    return;
  }
  storage.requestPersistence();
  if (fileText) mergeBackupHistory(fileText);
  toast(`${choice === 'merge' ? 'Merged' : 'Replaced'} ${listNames(names)}`, {
    icon: 'i-check',
    action: {
      label: 'Undo',
      onClick() {
        result.undo();
        undoCurrent?.(result);
        refresh?.();
        toast('Import undone', { icon: 'i-undo' });
      },
    },
  });
}

export async function sharedUrl(received, ids, tab) {
  const sets = await Promise.all(ids.map(async (id) => {
    const s = received.sets[id];
    return { model: await fetchCollection(id, { images: true }), counts: s.q, tier: s.tier, n: s.n };
  }));
  const code = await encodeTrade({ name: received.name, created: received.created || Date.now(), sets });
  return `${asset('shared/')}#sync=${code}&tab=${tab}`;
}

export function tierCounts(model, mine, theirs, tier = model.getTier(storage.getPrefs().tiers[model.id])) {
  let you = 0;
  let them = 0;
  for (const card of tier.cards) {
    if (mine[card.id]) you++;
    if (theirs[card.id]) them++;
  }
  return { tier, you, them, total: tier.cards.length };
}

const receivedDlg = () => document.getElementById('dlg-received');
const rcv = (name) => receivedDlg().querySelector(`[data-rcv="${name}"]`);

function ticked() {
  return [...rcv('sets').querySelectorAll('[data-set]')].filter((row) => !row.querySelector('input') || row.querySelector('input').checked).map((row) => row.dataset.set);
}

function paintButtons() {
  const none = !ticked().length;
  for (const b of receivedDlg().querySelectorAll('[data-rcv-action]')) b.disabled = none;
}

async function showReceived(received, source, fileText = null) {
  const catalog = await loadCatalog();
  const ids = Object.keys(received.sets).filter((id) => byId(catalog, id));
  const order = new Map(catalog.collections.map((c, i) => [c.id, i]));
  ids.sort((a, b) => order.get(a) - order.get(b));
  if (!ids.length) {
    toast(received.unknown ? 'Those sets aren’t on this version of the site yet. Refresh the page to update it.' : 'There are no cards in that to import.');
    return false;
  }
  const models = new Map(await Promise.all(ids.map(async (id) => [id, await fetchCollection(id, { images: true })])));
  pending = { received, source, fileText, catalog };
  const label = received.name || SOURCE_TEXT[source];
  document.getElementById('received-title').textContent = received.name ? `${received.name}’s collection` : 'Shared collection';
  const cards = ids.reduce((n, id) => n + Object.keys(received.sets[id].q).length, 0);
  rcv('meta').textContent = [
    SOURCE_TEXT[source].replace('In the', 'From a'),
    plural(ids.length, 'set', 'sets'),
    plural(cards, 'card', 'cards'),
    received.created ? `made ${formatAgo(received.created)}` : '',
  ].filter(Boolean).join(' · ');
  const many = ids.length > 1;
  const row = (id) => {
    const model = models.get(id);
    const c = tierCounts(model, storage.readCounts(id), received.sets[id].q);
    const text = [
      el('b', { text: model.name }),
      el('small', { text: `${label} ${c.them}/${c.total} · On this device ${c.you}/${c.total}` }),
    ];
    return el('li', { 'data-set': id },
      many
        ? el('label', { class: 'rcv-set' }, el('input', { type: 'checkbox', checked: true, onchange: paintButtons }), el('span', { class: 'rcv-set__main' }, ...text))
        : el('div', { class: 'rcv-set' }, el('span', { class: 'rcv-set__main' }, ...text)));
  };
  const groups = groupByGame(catalog, ids);
  rcv('sets').replaceChildren(...(groups.length > 1
    ? groups.flatMap(({ game, ids: inGame }) => [el('li', { class: 'rcv-game', text: game.name }), ...inGame.map(row)])
    : ids.map(row)));
  const unknown = rcv('unknown');
  unknown.hidden = !received.unknown;
  unknown.textContent = received.unknown ? `${plural(received.unknown, 'set isn’t', 'sets aren’t')} on this version of the site yet, so ${received.unknown === 1 ? 'it’s' : 'they’re'} left out. Refresh the page to update it.` : '';
  rcv('hint').textContent = many
    ? 'Merge adds the cards to yours and keeps the higher copy count of each card. Replace makes the ticked sets match exactly. Sets you don’t tick aren’t touched.'
    : 'Merge adds the cards to yours and keeps the higher copy count of each card. Replace makes this set match exactly. Your other sets aren’t touched.';
  paintButtons();
  openDialog(receivedDlg());
  return true;
}

export async function receiveDecoded(decoded, source) {
  try {
    const received = await resolveFriend(decoded, await loadCatalog());
    return await showReceived(received, source);
  } catch {
    toast('Couldn’t load that. Check your connection and try again.');
    return false;
  }
}

async function onReceivedAction(action) {
  const { received, source, fileText, catalog } = pending;
  const ids = ticked();
  if (!ids.length) return;
  const names = ids.map((id) => byId(catalog, id)?.name || id);
  if (action === 'view' || action === 'compare') {
    try {
      location.href = await sharedUrl(received, ids, action);
    } catch {
      toast('Couldn’t open that. Check your connection and try again.');
    }
    return;
  }
  closeDialog(receivedDlg(), { instant: true });
  if (!(await confirmApply(action, names, source))) {
    openDialog(receivedDlg());
    return;
  }
  try {
    await applyReceived(received, ids, action, { names, current: hooks.current, undoCurrent: hooks.undoCurrent, refresh: hooks.refresh, fileText });
  } catch {
    toast('Couldn’t import that. Check your connection and try again.');
  }
}

export async function checkIncomingLink() {
  const m = /^#sync=([A-Za-z0-9_.-]+)$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  const { decoded, error } = await readCode(`#sync=${m[1]}`);
  if (error) toast(error === 'That isn’t a valid link or code.' ? 'That link isn’t valid. Ask for it again.' : error);
  else receiveDecoded(decoded, 'link');
}

export function initImport(options = {}) {
  hooks = options;
  const dlg = document.getElementById('dlg-import');
  const input = document.getElementById('import-code');
  const status = document.getElementById('import-status');
  const submit = document.getElementById('import-submit');
  const fileInput = document.getElementById('import-file');
  let parsed = null;

  async function render() {
    const run = ++checkRun;
    const text = input.value.trim();
    const result = text ? await readCode(text) : null;
    if (run !== checkRun) return;
    parsed = result?.decoded || null;
    let message = result?.error || '';
    if (parsed) {
      const catalog = await loadCatalog().catch(() => null);
      if (run !== checkRun) return;
      const names = catalog ? parsed.sets.map((s) => findEntry(catalog, s.decoded)?.name).filter(Boolean) : [];
      const cards = parsed.sets.reduce((n, s) => n + s.decoded.owned.length, 0);
      message = `✓ ${[parsed.name, names.length ? listNames(names) : plural(parsed.sets.length, 'set', 'sets'), plural(cards, 'card', 'cards')].filter(Boolean).join(' · ')}`;
    }
    status.textContent = message;
    status.classList.toggle('is-ok', Boolean(parsed));
    status.classList.toggle('is-bad', Boolean(text) && !parsed);
    submit.disabled = !parsed;
  }

  async function go() {
    if (!parsed) return;
    const decoded = parsed;
    if (await receiveDecoded(decoded, sourceOf(input.value))) {
      input.value = '';
      render();
    }
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      go();
    }
  });
  submit.addEventListener('click', go);
  dlg.addEventListener('dialog:open', () => {
    render();
    setTimeout(() => input.focus(), 60);
  });
  dlg.querySelector('[data-im-action="file"]').addEventListener('click', () => fileInput.click());
  dlg.querySelector('[data-im-action="scan"]').addEventListener('click', async () => {
    const text = await scanQr({ accept: async (value) => Boolean((await readCode(value)).decoded) });
    if (!text) {
      openDialog(dlg);
      return;
    }
    const { decoded } = await readCode(text);
    if (decoded) receiveDecoded(decoded, 'link');
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const text = await file.text();
    const backup = parseBackup(text);
    if (!backup) {
      toast('That file isn’t a Binder Tracker backup.');
      return;
    }
    try {
      const received = await resolveBackupFile(backup, await loadCatalog());
      await showReceived(received, 'file', text);
    } catch {
      toast('Couldn’t read that file. Check your connection and try again.');
    }
  });
  receivedDlg().addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rcv-action]');
    if (btn && pending) onReceivedAction(btn.dataset.rcvAction);
  });
}
