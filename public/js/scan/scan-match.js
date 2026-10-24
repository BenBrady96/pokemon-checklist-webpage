import * as ort from '../vendor/ort/ort.wasm.min.mjs';
import { asset } from '../core/paths.js';
import { cardImageUrl, normalize } from '../core/model.js';
import { pixelTensor, embed } from './scan-features.js';

const SAME_ART = 0.04;
const HOME_BONUS = 0.015;

const runtimes = new Map();
const matchers = new Map();

async function download(path, onBytes) {
  const res = await fetch(asset(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  if (!res.body || !onBytes) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    onBytes(value.byteLength);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createSession(index, onProgress) {
  const total = index.model.bytes + index.runtime.bytes;
  let received = 0;
  const tick = (n) => {
    received += n;
    onProgress?.(Math.min(1, received / total));
  };
  const [model, runtime] = await Promise.all([
    download(`${index.model.file}?v=${index.model.sha256.slice(0, 12)}`, tick),
    download(`${index.runtime.file}?v=${index.runtime.version}`, tick),
  ]);
  if (await sha256(model) !== index.model.sha256) throw new Error('model checksum mismatch');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmBinary = runtime;
  ort.env.wasm.wasmPaths = { mjs: asset('js/vendor/ort/ort-wasm-simd-threaded.mjs') };
  return ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
}

function sessionFor(index, onProgress) {
  const key = `${index.model.sha256}|${index.runtime.version}`;
  if (!runtimes.has(key)) {
    const promise = createSession(index, onProgress);
    runtimes.set(key, promise);
    promise.catch(() => runtimes.delete(key));
  }
  return runtimes.get(key);
}

async function load(game, onProgress) {
  const dir = `data/scan/${game}`;
  const res = await fetch(asset(`${dir}/index.json`));
  if (!res.ok) throw new Error(`scan index: HTTP ${res.status}`);
  const index = await res.json();
  const [packed, session] = await Promise.all([download(`${dir}/index.bin`), sessionFor(index, onProgress)]);
  const rows = index.layout === 'printings' ? printingRows(index) : index.cards.map(([set, imageId, name, printed, remoteId], i) => ({
    i,
    set: index.sets[set],
    imageId,
    name,
    printed,
    image: cardImageUrl({ imageBase: asset(`img/cards/${index.sets[set]}`), imageId, remoteBase: index.remote?.[set], remoteId }),
    search: ` ${normalize(`${name} ${printed}`)} `,
  }));
  const byCode = new Map();
  for (const row of rows) for (const p of row.printings || []) for (const code of p.codes) if (!byCode.has(code)) byCode.set(code, { row, printing: p });
  return { game, index, session, rows, byCode, vectors: new Int8Array(packed.buffer, packed.byteOffset, packed.byteLength) };
}

function printingRows(index) {
  return index.cards.map(([imageId, name, list], i) => {
    const printings = list.map(([set, cardId, ...codes]) => ({ set: index.sets[set], cardId, printed: codes[0], codes }));
    return {
      i,
      imageId,
      name,
      printings,
      set: printings[0].set,
      printed: printings[0].printed,
      image: cardImageUrl({ remoteBase: index.remote, remoteId: imageId }),
      search: ` ${normalize(`${name} ${printings.flatMap((p) => p.codes).join(' ')}`)} `,
    };
  });
}

const inRow = (row, test) => (row.printings ? row.printings.some((p) => test(p.set)) : test(row.set));

export const codeKey = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');

export const findCode = (matcher, text) => matcher.byCode.get(codeKey(text)) || null;

export function loadMatcher(game, onProgress) {
  if (!matchers.has(game)) {
    const promise = load(game, onProgress);
    matchers.set(game, promise);
    promise.catch(() => matchers.delete(game));
  }
  return matchers.get(game);
}

export async function match(matcher, canvas, { prefer = null, within = null, top = 12 } = {}) {
  const { index, session, rows, vectors } = matcher;
  const { width, height, pool, dims } = index.model;
  const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  const input = new ort.Tensor('float32', pixelTensor(pixels, width, height, 4), [1, 3, height, width]);
  const result = await session.run({ [session.inputNames[0]]: input });
  const out = result[session.outputNames[0]];
  const query = embed(out.data, out.dims.at(-1), out.dims.length === 3 ? out.dims[1] : 1, pool);

  const scored = [];
  for (const row of rows) {
    if (within && !inRow(row, within)) continue;
    const base = row.i * dims;
    let dot = 0;
    for (let d = 0; d < dims; d++) dot += query[d] * vectors[base + d];
    const score = dot * index.scale;
    scored.push({ row, score, rank: score + (prefer && inRow(row, (s) => s === prefer) ? HOME_BONUS : 0) });
  }
  scored.sort((a, b) => b.rank - a.rank);
  const best = scored[0];
  if (!best) return { candidates: [], sameArt: [], confident: false };
  const candidates = scored.slice(0, top).map(({ row, score }) => ({ ...row, score }));
  const sameArt = index.layout === 'printings' ? [] : candidates.filter((c) => c.name === best.row.name && best.score - c.score <= SAME_ART);
  return { candidates, sameArt, confident: best.score >= index.threshold };
}

export function search(matcher, text, { within = null, limit = 40 } = {}) {
  const tokens = normalize(text).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const out = [];
  for (const row of matcher.rows) {
    if (within && !inRow(row, within)) continue;
    if (tokens.every((t) => row.search.includes(t))) out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}
