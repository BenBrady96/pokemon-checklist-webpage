const PREFIX = 'bt:v1:';
const PREFS_KEY = `${PREFIX}prefs`;
const COLLECTION_PREFIX = `${PREFIX}c:`;

export const collectionKey = (id) => `${COLLECTION_PREFIX}${id}`;
export const isCollectionKey = (key) => key?.startsWith(COLLECTION_PREFIX);
export const MAX_QTY = 99;
export const clampQty = (n) => Math.max(0, Math.min(MAX_QTY, Math.floor(Number(n) || 0)));
export const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

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

let persistRequested = false;

export function requestPersistence() {
  if (persistRequested) return;
  persistRequested = true;
  navigator.storage?.persist?.().catch(() => {});
}

const DEFAULT_PREFS = {
  view: 'grid',
  size: 'm',
  mode: 'check',
  sort: 'set',
  pockets: 9,
  fillGaps: false,
  dim: true,
  theme: 'system',
  tipSeen: false,
  tradeGuideSeen: false,
  lastBackup: 0,
  lastCollection: null,
  tiers: {},
  sectionOrders: {},
  scanScope: 'set',
  sharedView: 'list',
  currency: 'gbp',
  installBanner: null,
  motionTilt: false,
  pinned: [],
};

let prefs = { ...DEFAULT_PREFS, ...(read(PREFS_KEY) || {}) };
if (!prefs.tiers || typeof prefs.tiers !== 'object') prefs.tiers = {};
if (!isObject(prefs.sectionOrders)) prefs.sectionOrders = {};
if (!Array.isArray(prefs.pinned)) prefs.pinned = [];
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

function summarise(model, q) {
  const tier = model.getTier(prefs.tiers[model.id]);
  const homes = new Map();
  const has = (card) => {
    if (!card.link) return q[card.id] > 0;
    if (!homes.has(card.link.set)) homes.set(card.link.set, readCounts(card.link.set));
    return homes.get(card.link.set)[card.link.id] > 0;
  };
  let owned = 0;
  for (const card of tier.cards) if (has(card)) owned++;
  return { tier: tier.id, owned, total: tier.cards.length };
}

export function refreshSummary(id, model) {
  const record = read(collectionKey(id));
  if (!record?.q || typeof record.q !== 'object') return false;
  const summary = summarise(model, record.q);
  const old = record.summary;
  if (old && old.tier === summary.tier && old.owned === summary.owned && old.total === summary.total) return false;
  return write(collectionKey(id), { ...record, summary });
}
