import * as storage from './storage.js';

export const findEntry = (catalog, decoded) => catalog.collections.find((c) => c.syncKey === decoded.key);

export function backupFile(sets, { name = '', history = null, exported = new Date() } = {}) {
  const data = { app: 'binder-tracker', version: 2, exported: exported.toISOString() };
  if (name) data.name = name;
  data.collections = Object.fromEntries(sets.map(({ id, counts, tier }) => [id, tier ? { cards: counts, tier } : { cards: counts }]));
  if (history) data.history = history;
  return data;
}

const sameCounts = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
  return true;
};

export function applyEntries(entries, choice, { currentId = null, applyCurrent } = {}) {
  const snapshot = [];
  let changed = 0;
  let currentEntry = null;
  for (const e of entries) {
    if (e.id === currentId) {
      currentEntry = applyCurrent(e.counts, choice);
      if (currentEntry) changed++;
      continue;
    }
    const before = storage.readCounts(e.id);
    const after = choice === 'merge' ? { ...before } : {};
    for (const [id, n] of Object.entries(e.counts)) after[id] = choice === 'merge' ? Math.max(after[id] || 0, n) : n;
    if (sameCounts(before, after)) continue;
    snapshot.push({ id: e.id, model: e.model, before });
    storage.writeCounts(e.id, after, e.model);
    changed++;
  }
  return {
    changed,
    currentEntry,
    undo() {
      for (const s of snapshot) storage.writeCounts(s.id, s.before, s.model);
    },
  };
}
