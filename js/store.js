import { CARDS, CARD_BY_ID } from './cards.js';

const DATA_KEY = 'p30c:v1';
const PREFS_KEY = 'p30c:prefs:v1';
export const MAX_QTY = 99;
const UNDO_LIMIT = 50;

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
};

let storageOk = true;

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    storageOk = false;
    return false;
  }
}

try {
  localStorage.setItem('p30c:probe', '1');
  localStorage.removeItem('p30c:probe');
} catch {
  storageOk = false;
}

export const isStorageOk = () => storageOk;

export const clampQty = (n) => Math.max(0, Math.min(MAX_QTY, Math.floor(Number(n) || 0)));

const qty = new Map();

function loadQty() {
  qty.clear();
  const q = read(DATA_KEY)?.q;
  if (!q || typeof q !== 'object') return;
  for (const [id, n] of Object.entries(q)) {
    const v = clampQty(n);
    if (v > 0 && CARD_BY_ID.has(id)) qty.set(id, v);
  }
}

function persist() {
  const q = {};
  for (const card of CARDS) if (qty.has(card.id)) q[card.id] = qty.get(card.id);
  write(DATA_KEY, { v: 1, q, updated: Date.now() });
}

let preview = null;

const active = () => preview || qty;
export const getQty = (id) => active().get(id) || 0;
export const snapshot = () => Object.fromEntries(active());
export const ownedCount = () => active().size;
export const isPreview = () => preview !== null;

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(ids, meta) {
  for (const fn of listeners) fn(ids, meta);
}

let tx = null;
const undoStack = [];
const redoStack = [];

export function begin() {
  if (tx) commit();
  tx = new Map();
}

export function set(id, value) {
  if (preview) return false;
  const to = clampQty(value);
  const from = getQty(id);
  if (to === from) return false;
  if (to) qty.set(id, to);
  else qty.delete(id);
  if (tx) {
    const prev = tx.get(id);
    tx.set(id, { from: prev ? prev.from : from, to });
  } else {
    record(new Map([[id, { from, to }]]));
    persist();
  }
  emit([id], { source: 'set' });
  return true;
}

export function commit() {
  if (!tx) return null;
  const diffs = tx;
  tx = null;
  for (const [id, d] of diffs) if (d.from === d.to) diffs.delete(id);
  if (!diffs.size) return null;
  const entry = record(diffs);
  persist();
  return entry;
}

function record(diffs) {
  const entry = { diffs };
  undoStack.push(entry);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack.length = 0;
  return entry;
}

function applyEntry(entry, key) {
  for (const [id, d] of entry.diffs) {
    if (d[key]) qty.set(id, d[key]);
    else qty.delete(id);
  }
  persist();
  emit([...entry.diffs.keys()], { source: key === 'from' ? 'undo' : 'redo' });
}

export function undo() {
  if (preview) return null;
  if (tx) commit();
  const entry = undoStack.pop();
  if (!entry) return null;
  applyEntry(entry, 'from');
  redoStack.push(entry);
  return entry;
}

export function redo() {
  if (preview) return null;
  const entry = redoStack.pop();
  if (!entry) return null;
  applyEntry(entry, 'to');
  undoStack.push(entry);
  return entry;
}

export function update(changes) {
  begin();
  for (const [id, value] of changes) set(id, value);
  return commit();
}

export function describe(entry) {
  if (!entry) return '';
  let added = 0;
  let removed = 0;
  let marked = 0;
  let unmarked = 0;
  for (const d of entry.diffs.values()) {
    if (d.to > d.from) added++;
    else removed++;
    if (!d.from && d.to) marked++;
    if (d.from && !d.to) unmarked++;
  }
  const n = entry.diffs.size;
  const cards = (k) => `${k} card${k === 1 ? '' : 's'}`;
  if (marked === n) return `Marked ${cards(n)} as owned`;
  if (unmarked === n) return `Unmarked ${cards(n)}`;
  if (added === n) return `Added a copy to ${cards(n)}`;
  if (removed === n) return `Removed a copy from ${cards(n)}`;
  return `Updated ${cards(n)}`;
}

export function replaceAll(counts) {
  return update(CARDS.map((c) => [c.id, counts[c.id] || 0]));
}

export function mergeAll(counts) {
  return update(CARDS.filter((c) => (counts[c.id] || 0) > getQty(c.id)).map((c) => [c.id, counts[c.id]]));
}

export function enterPreview(counts) {
  if (tx) commit();
  preview = new Map();
  for (const card of CARDS) {
    const v = clampQty(counts[card.id]);
    if (v > 0) preview.set(card.id, v);
  }
  emit(null, { source: 'preview' });
}

export function exitPreview() {
  if (!preview) return;
  preview = null;
  emit(null, { source: 'preview' });
}

let prefs = { ...DEFAULT_PREFS, ...(read(PREFS_KEY) || {}) };
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

let persistRequested = false;

export function requestPersistence() {
  if (persistRequested) return;
  persistRequested = true;
  navigator.storage?.persist?.().catch(() => {});
}

window.addEventListener('storage', (e) => {
  if (e.key !== DATA_KEY) return;
  loadQty();
  undoStack.length = 0;
  redoStack.length = 0;
  emit(null, { source: 'external' });
});

loadQty();
