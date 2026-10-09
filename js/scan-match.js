import * as ort from './vendor/ort/ort.wasm.min.mjs';
import { asset } from './paths.js';
import { cardImageUrl, normalize } from './model.js';
import { pixelTensor, embed } from './scan-features.js';

const SAME_ART = 0.04;
const HOME_BONUS = 0.015;

let loading = null;

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

async function load(onProgress) {
  const res = await fetch(asset('data/scan/index.json'));
  if (!res.ok) throw new Error(`scan index: HTTP ${res.status}`);
  const index = await res.json();
  const total = index.model.bytes + index.runtime.bytes;
  let received = 0;
  const tick = (n) => {
    received += n;
    onProgress?.(Math.min(1, received / total));
  };
  const [packed, model, runtime] = await Promise.all([
    download('data/scan/index.bin'),
    download(`${index.model.file}?v=${index.model.sha256.slice(0, 12)}`, tick),
    download(`${index.runtime.file}?v=${index.runtime.version}`, tick),
  ]);
  if (await sha256(model) !== index.model.sha256) throw new Error('model checksum mismatch');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmBinary = runtime;
  ort.env.wasm.wasmPaths = { mjs: asset('js/vendor/ort/ort-wasm-simd-threaded.mjs') };
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  const rows = index.cards.map(([set, imageId, name, printed, remoteId], i) => ({
    i,
    set: index.sets[set],
    imageId,
    name,
    printed,
    image: cardImageUrl({ imageBase: asset(`img/cards/${index.sets[set]}`), imageId, remoteBase: index.remote?.[set], remoteId }),
    search: ` ${normalize(`${name} ${printed}`)} `,
  }));
  return { index, session, rows, vectors: new Int8Array(packed.buffer, packed.byteOffset, packed.byteLength) };
}

export function loadMatcher(onProgress) {
  loading ||= load(onProgress);
  loading.catch(() => { loading = null; });
  return loading;
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
    if (within && !within(row.set)) continue;
    const base = row.i * dims;
    let dot = 0;
    for (let d = 0; d < dims; d++) dot += query[d] * vectors[base + d];
    const score = dot * index.scale;
    scored.push({ row, score, rank: score + (row.set === prefer ? HOME_BONUS : 0) });
  }
  scored.sort((a, b) => b.rank - a.rank);
  const best = scored[0];
  const candidates = scored.slice(0, top).map(({ row, score }) => ({ ...row, score }));
  const sameArt = candidates.filter((c) => c.name === best.row.name && best.score - c.score <= SAME_ART);
  return { candidates, sameArt, confident: best.score >= index.threshold };
}

export function search(matcher, text, { within = null, limit = 40 } = {}) {
  const tokens = normalize(text).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const out = [];
  for (const row of matcher.rows) {
    if (within && !within(row.set)) continue;
    if (tokens.every((t) => row.search.includes(t))) out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}
