import { loadCatalog } from './catalog.js';
import { fetchCollection } from './collection.js';
import * as storage from './storage.js';
import { encodeCollection, resolveCode } from './codec.js';

const findEntry = (catalog, decoded) => catalog.collections.find((c) => (decoded.collection ? c.id === decoded.collection : c.syncKey === decoded.key));

export async function catalogEntryFor(decoded) {
  return findEntry(await loadCatalog(), decoded) || null;
}

function add(map, entry, model, counts) {
  const prev = map.get(entry.id);
  if (!prev) map.set(entry.id, { id: entry.id, name: entry.name, model, counts });
  else for (const [id, n] of Object.entries(counts)) prev.counts[id] = Math.max(prev.counts[id] || 0, n);
}

export async function resolveCodes(decodedList) {
  const catalog = await loadCatalog();
  const out = new Map();
  for (const decoded of decodedList) {
    const entry = findEntry(catalog, decoded);
    if (!entry) continue;
    const model = await fetchCollection(entry.id);
    add(out, entry, model, resolveCode(decoded, model));
  }
  return [...out.values()];
}

export async function resolveBackup(entries) {
  const catalog = await loadCatalog();
  const out = new Map();
  for (const e of entries) {
    const entry = catalog.collections.find((c) => c.id === e.id);
    if (!entry) continue;
    const model = await fetchCollection(entry.id);
    const counts = {};
    for (const [id, n] of Object.entries(e.counts)) if (model.cardById.has(id)) counts[id] = n;
    add(out, entry, model, counts);
  }
  return [...out.values()];
}

export function allCounts() {
  const out = {};
  for (const { id } of storage.storedCollections()) out[id] = storage.readCounts(id);
  return out;
}

export async function backupCode() {
  const catalog = await loadCatalog();
  const codes = [];
  for (const [id, counts] of Object.entries(allCounts())) {
    if (!catalog.collections.some((c) => c.id === id)) continue;
    codes.push(encodeCollection(await fetchCollection(id), counts));
  }
  return codes.join('.');
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
