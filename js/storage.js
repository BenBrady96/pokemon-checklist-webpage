const PREFIX = 'bt:v1:';
const PREFS_KEY = `${PREFIX}prefs`;
const COLLECTION_PREFIX = `${PREFIX}c:`;

export const collectionKey = (id) => `${COLLECTION_PREFIX}${id}`;
export const isCollectionKey = (key) => key?.startsWith(COLLECTION_PREFIX);
export const MAX_QTY = 99;
export const clampQty = (n) => Math.max(0, Math.min(MAX_QTY, Math.floor(Number(n) || 0)));

let storageOk = true;

export function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    storageOk = false;
    return false;
  }
}

try {
  localStorage.setItem(`${PREFIX}probe`, '1');
  localStorage.removeItem(`${PREFIX}probe`);
} catch {
  storageOk = false;
}

export const isStorageOk = () => storageOk;

const LEGACY_COLLECTION = 'pokemon/30th-celebration';

function migrate() {
  try {
    if (localStorage.getItem(PREFS_KEY) === null) {
      const old = read('p30c:prefs:v1');
      if (old && typeof old === 'object') {
        const { tier, ...rest } = old;
        write(PREFS_KEY, { ...rest, tiers: tier ? { [LEGACY_COLLECTION]: tier } : {} });
      }
    }
    const key = collectionKey(LEGACY_COLLECTION);
    if (localStorage.getItem(key) === null) {
      const old = read('p30c:v1');
      if (old?.q && typeof old.q === 'object') write(key, { v: 1, q: old.q, updated: old.updated || Date.now() });
    }
  } catch {}
}

migrate();

const DEFAULT_PREFS = {
  view: 'grid',
  images: true,
  size: 'm',
  mode: 'check',
  sort: 'set',
  pockets: 9,
  dim: true,
  theme: 'system',
  tipSeen: false,
  lastBackup: 0,
  lastCollection: null,
  tiers: {},
};

let prefs = { ...DEFAULT_PREFS, ...(read(PREFS_KEY) || {}) };
if (!prefs.tiers || typeof prefs.tiers !== 'object') prefs.tiers = {};
const prefListeners = new Set();

export const getPrefs = () => prefs;

export function setPref(key, value) {
  if (prefs[key] === value) return;
  prefs = { ...prefs, [key]: value };
  write(PREFS_KEY, prefs);
  for (const fn of prefListeners) fn(key, value);
}

export function onPrefChange(fn) {
  prefListeners.add(fn);
  return () => prefListeners.delete(fn);
}

export function readCounts(id) {
  const q = read(collectionKey(id))?.q;
  const counts = {};
  if (!q || typeof q !== 'object') return counts;
  for (const [cardId, n] of Object.entries(q)) {
    const v = clampQty(n);
    if (v > 0) counts[cardId] = v;
  }
  return counts;
}

export const readRecord = (id) => read(collectionKey(id));

export function storedCollections() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!isCollectionKey(key)) continue;
      const record = read(key);
      if (record?.q && Object.keys(record.q).length) out.push({ id: key.slice(COLLECTION_PREFIX.length), record });
    }
  } catch {}
  return out.sort((a, b) => (b.record.updated || 0) - (a.record.updated || 0));
}

export function writeCounts(id, counts, model) {
  const q = {};
  for (const [cardId, n] of Object.entries(counts)) if (n > 0) q[cardId] = n;
  const record = { v: 1, q, updated: Date.now() };
  if (model) record.summary = summarise(model, q);
  return write(collectionKey(id), record);
}

export function summarise(model, q) {
  const tier = model.getTier(prefs.tiers[model.id]);
  let owned = 0;
  for (const card of tier.cards) if (q[card.id] > 0) owned++;
  return { tier: tier.id, owned, total: tier.cards.length };
}
