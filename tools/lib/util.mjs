import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE = join(ROOT, '.cache');

export const exists = (path) => access(path).then(() => true, () => false);

export const readJson = async (path, fallback = null) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw new Error(`${path}: ${err.message}`);
  }
};

export async function writeText(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

export function formatJson(value, { lines = [] } = {}) {
  const entries = Object.entries(value).map(([key, v]) => {
    let body;
    if (lines.includes(key) && Array.isArray(v)) {
      body = v.length ? `[\n    ${v.map((x) => JSON.stringify(x)).join(',\n    ')}\n  ]` : '[]';
    } else if (lines.includes(key) && v && typeof v === 'object') {
      const rows = Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`);
      body = rows.length ? `{\n    ${rows.join(',\n    ')}\n  }` : '{}';
    } else {
      body = JSON.stringify(v, null, 2).replace(/\n/g, '\n  ');
    }
    return `  ${JSON.stringify(key)}: ${body}`;
  });
  return `{\n${entries.join(',\n')}\n}\n`;
}

export const writeJson = (path, value, options) => writeText(path, formatJson(value, options));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USER_AGENT = 'Mozilla/5.0 (Binder Tracker build; +https://github.com/BenBrady96/pokemon-checklist-webpage)';

export async function download(url, { attempts = 3, type = 'buffer' } = {}) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      if (type === 'json') return await res.json();
      if (type === 'text') return await res.text();
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (err.status === 404 || i >= attempts) throw Object.assign(new Error(`${url}: ${err.message}`), { status: err.status });
      await sleep(1000 * i);
    }
  }
}

export async function cachedJson(url, { refresh = false } = {}) {
  const file = join(CACHE, 'http', `${createHash('sha1').update(url).digest('hex')}.json`);
  if (!refresh) {
    const hit = await readJson(file);
    if (hit) return hit;
  }
  const data = await download(url, { type: 'json' });
  await writeText(file, JSON.stringify(data));
  return data;
}

export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (let i = next++; i < items.length; i = next++) results[i] = await fn(items[i], i);
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function args() {
  const argv = process.argv.slice(2);
  const get = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    has: (name) => argv.includes(`--${name}`),
    list: (name) => (get(name) || '').split(',').map((s) => s.trim()).filter(Boolean),
    get,
  };
}
