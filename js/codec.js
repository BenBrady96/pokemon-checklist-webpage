import { clampQty, MAX_QTY } from './storage.js';

const V1 = 1;
const V2 = 2;
const V1_COLLECTION = 'pokemon/30th-celebration';

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function pushVarint(out, n) {
  while (n > 127) {
    out.push((n & 127) | 128);
    n >>>= 7;
  }
  out.push(n);
}

function readVarint(bytes, pos) {
  let value = 0;
  for (let shift = 0; shift < 28; shift += 7) {
    if (pos >= bytes.length) return null;
    const b = bytes[pos++];
    value |= (b & 127) << shift;
    if (!(b & 128)) return [value, pos];
  }
  return null;
}

export function encodeCollection(model, counts) {
  const n = model.maxIdx + 1;
  const bits = new Uint8Array(Math.ceil(n / 8));
  const extras = [];
  for (const card of model.cards) {
    const q = clampQty(counts[card.id]);
    if (q > 0) bits[card.idx >> 3] |= 1 << (card.idx & 7);
    if (q > 1) {
      pushVarint(extras, card.idx);
      extras.push(Math.min(q, 255));
    }
  }
  const head = [V2, model.syncKey.length, ...[...model.syncKey].map((ch) => ch.charCodeAt(0))];
  pushVarint(head, n);
  const bytes = new Uint8Array(head.length + bits.length + extras.length);
  bytes.set(head);
  bytes.set(bits, head.length);
  bytes.set(extras, head.length + bits.length);
  return toBase64Url(bytes);
}

export function decodeCode(code) {
  const bytes = fromBase64Url(code);
  if (!bytes || bytes.length < 2) return null;
  const owned = [];
  const extra = new Map();
  const readBits = (from, n) => {
    for (let i = 0; i < n; i++) if (bytes[from + (i >> 3)] & (1 << (i & 7))) owned.push(i);
  };
  if (bytes[0] === V1) {
    const n = bytes[1];
    const bitLength = Math.ceil(n / 8);
    if (bytes.length < 2 + bitLength || (bytes.length - 2 - bitLength) % 2) return null;
    readBits(2, n);
    for (let j = 2 + bitLength; j < bytes.length; j += 2) extra.set(bytes[j], bytes[j + 1]);
    return { collection: V1_COLLECTION, owned, extra };
  }
  if (bytes[0] !== V2) return null;
  const keyLength = bytes[1];
  if (keyLength < 1 || keyLength > 16 || bytes.length < 2 + keyLength) return null;
  const key = String.fromCharCode(...bytes.subarray(2, 2 + keyLength));
  if (!/^[A-Za-z0-9]+$/.test(key)) return null;
  const header = readVarint(bytes, 2 + keyLength);
  if (!header || header[0] > 65536) return null;
  const [n, start] = header;
  const bitLength = Math.ceil(n / 8);
  if (bytes.length < start + bitLength) return null;
  readBits(start, n);
  for (let pos = start + bitLength; pos < bytes.length;) {
    const entry = readVarint(bytes, pos);
    if (!entry || entry[1] >= bytes.length) return null;
    extra.set(entry[0], bytes[entry[1]]);
    pos = entry[1] + 1;
  }
  return { key, owned, extra };
}

export function resolveCode(decoded, model) {
  const byIdx = new Map(model.cards.map((c) => [c.idx, c]));
  const counts = {};
  for (const i of decoded.owned) {
    const card = byIdx.get(i);
    if (card) counts[card.id] = 1;
  }
  for (const [i, q] of decoded.extra) {
    const card = byIdx.get(i);
    if (card && counts[card.id]) counts[card.id] = Math.min(Math.max(q, 1), MAX_QTY);
  }
  return counts;
}

export function codeSize(decoded) {
  const owned = new Set(decoded.owned);
  let copies = owned.size;
  for (const [i, q] of decoded.extra) if (owned.has(i)) copies += Math.min(Math.max(q, 1), MAX_QTY) - 1;
  return { cards: owned.size, copies };
}

export function parseSyncText(text) {
  const link = /#sync=([A-Za-z0-9_.-]+)/.exec(text);
  const candidates = link ? [link[1]] : (text.match(/[A-Za-z0-9_.-]+/g) || []).sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    const codes = candidate.split('.').filter(Boolean);
    const decoded = codes.map(decodeCode);
    if (decoded.length && decoded.every(Boolean)) return { decoded, codes, source: link ? 'link' : 'code' };
  }
  return null;
}

const cleanCounts = (cards) => {
  if (!cards || typeof cards !== 'object' || Array.isArray(cards)) return null;
  const counts = {};
  for (const [id, n] of Object.entries(cards)) {
    const q = clampQty(n);
    if (q > 0) counts[id] = q;
  }
  return counts;
};

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data?.collections && typeof data.collections === 'object') {
    const entries = Object.entries(data.collections)
      .map(([id, value]) => ({ id, counts: cleanCounts(value?.cards) }))
      .filter((e) => e.counts);
    return entries.length ? entries : null;
  }
  const counts = cleanCounts(data?.cards ?? data?.q);
  return counts ? [{ id: V1_COLLECTION, counts }] : null;
}

export const copiesOf = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
