import { collectionBytes, decodeBytes, fromBase64Url, parseSyncText, pushVarint, readVarint, toBase64Url } from '../core/codec.js';
import { MAX_QTY } from '../core/storage.js';

const TRADE = 0x54;
const PROPOSAL = 0x50;
const LIST = 0x4C;
const VERSION = 1;
const DEFLATED = 0x80;
const TIERS = ['standard', 'master', 'grand'];
const MAX_SETS = 512;
const MAX_CARDS = 65536;
const LIST_HAVE = 1;
const LIST_MISSING = 2;
const LIST_NO_COUNTS = 4;
const MAX_LINES = 500;
const MAX_NAME_BYTES = 96;
const MAX_NAME_CHARS = 24;
const MAX_INFLATED = 512 * 1024;
const ID_BYTES = 4;
const MINUTE = 60000;

export const UNSUPPORTED = Symbol('unsupported');

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export const cleanName = (text) => [...String(text ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim()]
  .slice(0, MAX_NAME_CHARS).join('').trim();

export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_BYTES));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const streamOf = (bytes) => new Blob([bytes]).stream();

async function deflate(bytes) {
  if (typeof CompressionStream !== 'function') return null;
  try {
    return new Uint8Array(await new Response(streamOf(bytes).pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  } catch {
    return null;
  }
}

export async function inflate(bytes, limit = MAX_INFLATED) {
  const reader = streamOf(bytes).pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      reader.cancel().catch(() => {});
      throw new Error('Too big');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

async function pack(kind, body, compress) {
  const raw = Uint8Array.from(body);
  const packed = compress ? await deflate(raw) : null;
  const useDeflate = Boolean(packed) && packed.length < raw.length;
  const payload = useDeflate ? packed : raw;
  const out = new Uint8Array(payload.length + 2);
  out[0] = kind;
  out[1] = VERSION | (useDeflate ? DEFLATED : 0);
  out.set(payload, 2);
  return toBase64Url(out);
}

async function unpack(bytes, kind) {
  if (!bytes || bytes.length < 2 || bytes[0] !== kind || (bytes[1] & ~DEFLATED) !== VERSION) return null;
  const body = bytes.subarray(2);
  if (!(bytes[1] & DEFLATED)) return body;
  if (typeof DecompressionStream !== 'function') return UNSUPPORTED;
  try {
    return await inflate(body);
  } catch {
    return null;
  }
}

const BAD = new Error('Bad code');

function reader(bytes) {
  let pos = 0;
  return {
    varint() {
      const r = readVarint(bytes, pos);
      if (!r) throw BAD;
      pos = r[1];
      return r[0];
    },
    byte() {
      if (pos >= bytes.length) throw BAD;
      return bytes[pos++];
    },
    take(n) {
      if (n < 0 || pos + n > bytes.length) throw BAD;
      const out = bytes.subarray(pos, pos + n);
      pos += n;
      return out;
    },
    done: () => pos === bytes.length,
  };
}

function pushBytes(out, bytes) {
  for (const b of bytes) out.push(b);
}

function pushName(out, name) {
  const bytes = encoder.encode(cleanName(name)).subarray(0, MAX_NAME_BYTES);
  pushVarint(out, bytes.length);
  pushBytes(out, bytes);
}

function readName(r) {
  const length = r.varint();
  if (length > MAX_NAME_BYTES) throw BAD;
  try {
    return cleanName(decoder.decode(r.take(length)));
  } catch {
    throw BAD;
  }
}

function pushKey(out, key) {
  out.push(key.length);
  pushBytes(out, [...key].map((ch) => ch.charCodeAt(0)));
}

function readKey(r) {
  const length = r.byte();
  if (length < 1 || length > 16) throw BAD;
  const key = String.fromCharCode(...r.take(length));
  if (!/^[A-Za-z0-9]+$/.test(key)) throw BAD;
  return key;
}

const minutes = (time) => Math.max(0, Math.floor((Number(time) || Date.now()) / MINUTE));

export function encodeTrade({ name = '', created = Date.now(), sets }, { compress = true } = {}) {
  const out = [];
  pushVarint(out, minutes(created));
  pushName(out, name);
  pushVarint(out, sets.length);
  for (const { model, counts, tier, n } of sets) {
    const block = collectionBytes(model, counts, n ?? undefined);
    out.push(Math.max(0, TIERS.indexOf(tier)));
    pushVarint(out, block.length);
    pushBytes(out, block);
  }
  return pack(TRADE, out, compress);
}

function readTrade(body) {
  const r = reader(body);
  const created = r.varint() * MINUTE;
  const name = readName(r);
  const count = r.varint();
  if (count > MAX_SETS) throw BAD;
  const sets = [];
  for (let i = 0; i < count; i++) {
    const tier = TIERS[r.byte()];
    const decoded = decodeBytes(r.take(r.varint()));
    if (!tier || !decoded?.key) throw BAD;
    sets.push({ tier, decoded });
  }
  if (!r.done()) throw BAD;
  return { kind: 'trade', created, name, sets };
}

export function encodeProposal({ id, name = '', created = Date.now(), sets }, { compress = true } = {}) {
  const out = [];
  const idBytes = /^[0-9a-f]{8}$/.test(id) ? id.match(/../g).map((h) => parseInt(h, 16)) : [0, 0, 0, 0];
  pushBytes(out, idBytes);
  pushVarint(out, minutes(created));
  pushName(out, name);
  pushVarint(out, sets.length);
  for (const { key, give, get } of sets) {
    pushKey(out, key);
    for (const lines of [give, get]) {
      pushVarint(out, lines.length);
      for (const [idx, q] of lines) {
        pushVarint(out, idx);
        out.push(Math.max(1, Math.min(MAX_QTY, q)));
      }
    }
  }
  return pack(PROPOSAL, out, compress);
}

function readProposal(body) {
  const r = reader(body);
  const id = [...r.take(ID_BYTES)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const created = r.varint() * MINUTE;
  const name = readName(r);
  const count = r.varint();
  if (count > MAX_SETS) throw BAD;
  const sets = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const key = readKey(r);
    const [give, get] = [0, 1].map(() => {
      const lines = [];
      const n = r.varint();
      total += n;
      if (total > MAX_LINES) throw BAD;
      for (let j = 0; j < n; j++) {
        const idx = r.varint();
        const q = r.byte();
        if (q < 1 || q > MAX_QTY) throw BAD;
        lines.push([idx, q]);
      }
      return lines;
    });
    sets.push({ key, give, get });
  }
  if (!r.done()) throw BAD;
  return { kind: 'proposal', id, created, name, sets };
}

function bitsOf(n, indexes) {
  const bits = new Uint8Array(Math.ceil(n / 8));
  for (const i of indexes) if (i >= 0 && i < n) bits[i >> 3] |= 1 << (i & 7);
  return bits;
}

function readBits(bytes, n) {
  const out = [];
  for (let i = 0; i < n; i++) if (bytes[i >> 3] & (1 << (i & 7))) out.push(i);
  return out;
}

export function encodeList({ name = '', created = Date.now(), key, n, tier, have = null, missing = null, counts = true }, { compress = true } = {}) {
  const out = [];
  pushVarint(out, minutes(created));
  pushName(out, name);
  pushKey(out, key);
  pushVarint(out, n);
  out.push(Math.max(0, TIERS.indexOf(tier)));
  out.push((have ? LIST_HAVE : 0) | (missing ? LIST_MISSING : 0) | (counts ? 0 : LIST_NO_COUNTS));
  if (have) pushBytes(out, bitsOf(n, have.map(([idx]) => idx)));
  if (missing) pushBytes(out, bitsOf(n, missing));
  for (const [idx, q] of counts ? have || [] : []) {
    if (q < 2 || idx >= n) continue;
    pushVarint(out, idx);
    out.push(Math.min(MAX_QTY, q));
  }
  return pack(LIST, out, compress);
}

function readList(body) {
  const r = reader(body);
  const created = r.varint() * MINUTE;
  const name = readName(r);
  const key = readKey(r);
  const n = r.varint();
  if (n > MAX_CARDS) throw BAD;
  const tier = TIERS[r.byte()];
  const flags = r.byte();
  if (!tier || flags & ~(LIST_HAVE | LIST_MISSING | LIST_NO_COUNTS)) throw BAD;
  const counts = !(flags & LIST_NO_COUNTS);
  const size = Math.ceil(n / 8);
  const have = flags & LIST_HAVE ? new Map(readBits(r.take(size), n).map((i) => [i, 1])) : null;
  const missing = flags & LIST_MISSING ? readBits(r.take(size), n) : null;
  while (!r.done()) {
    const idx = r.varint();
    const q = r.byte();
    if (!counts || !have?.has(idx) || q < 2 || q > MAX_QTY) throw BAD;
    have.set(idx, q);
  }
  return { kind: 'list', created, name, key, n, tier, have, missing, counts };
}

const READERS = { [TRADE]: readTrade, [PROPOSAL]: readProposal, [LIST]: readList };

async function decodeAs(kind, code) {
  const body = await unpack(fromBase64Url(code), kind);
  if (!body || body === UNSUPPORTED) return body;
  try {
    return READERS[kind](body);
  } catch {
    return null;
  }
}

export const decodeTrade = (code) => decodeAs(TRADE, code);
export const decodeProposal = (code) => decodeAs(PROPOSAL, code);
export const decodeList = (code) => decodeAs(LIST, code);

const KIND_OF = { t: TRADE, p: PROPOSAL };

export async function readTradeText(text) {
  const value = String(text ?? '');
  const link = /#([tp])=([A-Za-z0-9_-]+)/.exec(value);
  if (link) return decodeAs(KIND_OF[link[1]], link[2]);
  const candidates = (value.match(/[A-Za-z0-9_-]{6,}/g) || []).sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    const first = fromBase64Url(candidate)?.[0];
    if (first !== TRADE && first !== PROPOSAL) continue;
    const decoded = await decodeAs(first, candidate);
    if (decoded) return decoded;
  }
  const sync = parseSyncText(value);
  if (sync) return { kind: 'trade', created: 0, name: '', source: 'sync', sets: sync.decoded.map((decoded) => ({ tier: null, decoded })) };
  return null;
}
