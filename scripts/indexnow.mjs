import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_URL, INDEXNOW_KEY, ROOT } from './lib/util.mjs';

const mode = process.argv[2];
const SITE_URL = (process.env.SITE_URL || DEFAULT_URL).replace(/\/*$/, '/');
const KEY_FILE = `${INDEXNOW_KEY}.txt`;

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

async function fetchLive(path) {
  try {
    return await fetch(`${SITE_URL}${path}`, { signal: AbortSignal.timeout(15000) });
  } catch {
    return null;
  }
}

async function newUrls() {
  const built = locs(await readFile(join(ROOT, 'dist', 'sitemap.xml'), 'utf8'));
  const key = await fetchLive(`${KEY_FILE}?${Date.now()}`);
  if (key?.status === 404) {
    console.log(`IndexNow: ${KEY_FILE} isn't live yet, so this is the first run and every page is sent`);
    return built;
  }
  const sitemap = await fetchLive('sitemap.xml');
  if (!key?.ok || !sitemap?.ok) {
    console.log('IndexNow: couldn’t read the live site, so nothing is sent');
    return [];
  }
  const live = new Set(locs(await sitemap.text()));
  return built.filter((url) => !live.has(url));
}

const KEY_WAIT_MS = 10 * 60 * 1000;
const KEY_POLL_MS = 15 * 1000;

async function keyIsLive() {
  const until = Date.now() + KEY_WAIT_MS;
  while (Date.now() < until) {
    const res = await fetchLive(KEY_FILE);
    if (res?.ok && (await res.text()).trim() === INDEXNOW_KEY) return true;
    console.log(`IndexNow: ${KEY_FILE} isn't being served yet (${res?.status ?? 'no response'}), checking again shortly`);
    await new Promise((resolve) => setTimeout(resolve, KEY_POLL_MS));
  }
  return false;
}

async function submit(urls) {
  const host = new URL(SITE_URL).hostname;
  if (!urls.length) return console.log('IndexNow: no new pages');
  if (host.endsWith('github.io') || host === 'localhost') return console.log(`IndexNow: skipped for ${host}`);
  if (!(await keyIsLive())) {
    console.log(`IndexNow: ${KEY_FILE} still isn't live after ${KEY_WAIT_MS / 60000} minutes, so nothing was sent`);
    process.exitCode = 1;
    return;
  }
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}${KEY_FILE}`, urlList: urls.slice(0, 10000) }),
    signal: AbortSignal.timeout(20000),
  });
  console.log(`IndexNow: submitted ${urls.length} URL(s), response ${res.status}`);
  if (res.status >= 400 && res.status !== 429) process.exitCode = 1;
}

if (mode === 'diff') {
  const urls = await newUrls();
  console.log(`IndexNow: ${urls.length} URL(s) to send`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `urls=${JSON.stringify(urls)}\n`);
  else console.log(urls.join('\n'));
} else if (mode === 'submit') {
  await submit(JSON.parse(process.env.INDEXNOW_URLS || '[]'));
} else {
  console.error('Usage: node scripts/indexnow.mjs diff|submit');
  process.exitCode = 1;
}
