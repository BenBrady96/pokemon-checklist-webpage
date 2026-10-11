import { collectionUrl } from './catalog.js';
import * as storage from './storage.js';
import { parseSyncText, parseBackup, askIncoming, exportFile } from './sync.js';
import { allCounts, applyEntries, catalogEntryFor, findEntry } from './transfer.js';
import { mergeBackupHistory } from './history.js';
import { closeDialog, toast, copyText } from './ui.js';
import { plural } from './format.js';

export async function importMany(entries, source, { before, current, refresh, undo } = {}) {
  if (!entries.length) {
    toast('None of those cards are from sets on this site.');
    return false;
  }
  before?.();
  const choice = await askIncoming({
    source,
    multi: { entries: entries.map((e) => ({ name: e.name, incoming: e.counts, current: storage.readCounts(e.id) })) },
  });
  if (!choice) return false;
  const result = applyEntries(entries, choice, current);
  refresh?.();
  if (!result.changed) {
    toast('Your collections already match.');
    return true;
  }
  storage.requestPersistence();
  toast(`${choice === 'merge' ? 'Merged' : 'Replaced'} ${plural(result.changed, 'set', 'sets')}`, {
    icon: 'i-check',
    action: {
      label: 'Undo',
      onClick() {
        result.undo();
        undo?.(result);
        refresh?.();
        toast('Import undone', { icon: 'i-undo' });
      },
    },
  });
  return true;
}

export async function openInSet(decoded, code) {
  const entry = await catalogEntryFor(decoded);
  if (!entry) {
    toast('That code is for a set this site doesn’t have.');
    return false;
  }
  location.href = `${collectionUrl(entry.id)}#sync=${code}`;
  return true;
}

export async function checkIncomingLink(handleIncoming) {
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

export function describeCodes(catalog, decoded) {
  const names = decoded.map((d) => findEntry(catalog, d)?.name || 'an unknown set');
  return names.length > 2 ? `${names.length} sets` : names.join(' and ');
}

export function watchBackupFile({ allowed = () => true, onEntries }) {
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !allowed()) return;
    const text = await file.text();
    const entries = parseBackup(text);
    if (!entries) {
      toast('That file isn’t a checklist backup.');
      return;
    }
    try {
      if (await onEntries(entries)) mergeBackupHistory(text);
    } catch {
      toast('Couldn’t read that backup. Check your connection and try again.');
    }
  });
}

export const backupActions = {
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
