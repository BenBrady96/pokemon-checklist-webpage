import { access, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { CONFIG } from './lib/collections.mjs';
import { DEFAULT_URL, collectionPage, homePage, sitemap } from './lib/pages.mjs';
import { ROOT } from './lib/util.mjs';

const OUT = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || DEFAULT_URL).replace(/\/*$/, '/');
const VERSION = `${(process.env.GITHUB_SHA || 'local').slice(0, 7)}-${Date.now().toString(36)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const WARN_BYTES = 800 * 1024 ** 2;
const MAX_BYTES = 950 * 1024 ** 2;

const ENTRIES = [
  'privacy.html', 'terms.html', '404.html', 'manifest.webmanifest', 'sw.js', 'robots.txt',
  'css', 'js', 'fonts', 'img', 'data',
];
const URL_FILES = ['privacy.html', 'terms.html', '404.html', 'robots.txt'];

const exists = (path) => access(path).then(() => true, () => false);

async function listFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else files.push(path);
  }
  return files;
}

async function emit(path, text) {
  await mkdir(dirname(join(OUT, path)), { recursive: true });
  await writeFile(join(OUT, path), text);
}

await mkdir(OUT, { recursive: true });
for (const entry of await readdir(OUT)) await rm(join(OUT, entry), { recursive: true, force: true });
for (const entry of ENTRIES) await cp(join(ROOT, entry), join(OUT, entry), { recursive: true });

for (const file of URL_FILES) {
  const path = join(OUT, file);
  await writeFile(path, (await readFile(path, 'utf8')).split(DEFAULT_URL).join(SITE_URL));
}

await emit('index.html', await homePage({ siteUrl: SITE_URL }));
for (const entry of CONFIG) await emit(`${entry.id}/index.html`, await collectionPage(entry.id, { siteUrl: SITE_URL }));
await emit('sitemap.xml', await sitemap({ siteUrl: SITE_URL, today: TODAY }));

const swPath = join(OUT, 'sw.js');
const sw = await readFile(swPath, 'utf8');
const versionPattern = /const VERSION = '[^']*';/;
if (!versionPattern.test(sw)) throw new Error('sw.js: VERSION constant not found');
await writeFile(swPath, sw.replace(versionPattern, `const VERSION = '${VERSION}';`));

const shellBlock = /const SHELL = \[([\s\S]*?)\];/.exec(sw);
if (!shellBlock) throw new Error('sw.js: SHELL list not found');
const shell = [...shellBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((path) => path !== './');
const missing = [];
for (const path of shell) if (!(await exists(join(OUT, path)))) missing.push(path);
if (missing.length) throw new Error(`sw.js SHELL lists files that don't exist: ${missing.join(', ')}`);

const setPages = new Set(CONFIG.map((e) => `${e.id}/index.html`));
const files = await listFiles(OUT);
const unlisted = files
  .map((file) => relative(OUT, file).split(sep).join('/'))
  .filter((path) => /\.(js|css|html)$/.test(path) && path !== 'sw.js' && path !== '404.html' && !setPages.has(path) && !shell.includes(path));
if (unlisted.length) throw new Error(`Add these to the SHELL list in sw.js so they work offline: ${unlisted.join(', ')}`);

let bytes = 0;
const byFolder = new Map();
for (const file of files) {
  const size = (await stat(file)).size;
  bytes += size;
  const folder = relative(OUT, file).split(sep).slice(0, 4).join('/').replace(/\/[^/]*\.[a-z0-9]+$/i, '');
  if (folder.startsWith('img/cards/')) byFolder.set(folder, (byFolder.get(folder) || 0) + size);
}
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
console.log(`Built dist/ — ${files.length} files, ${mb(bytes)} (${CONFIG.length} collections)`);
console.log(`Site URL: ${SITE_URL}`);
console.log(`Service worker version: ${VERSION}`);
if (process.argv.includes('--sizes')) {
  for (const [folder, size] of [...byFolder].sort((a, b) => b[1] - a[1])) console.log(`  ${mb(size).padStart(9)}  ${folder}`);
}
if (bytes > MAX_BYTES) throw new Error(`dist/ is ${mb(bytes)}, over the ${mb(MAX_BYTES)} budget (GitHub Pages' limit is 1 GB). Move card images to another host before adding more sets.`);
if (bytes > WARN_BYTES) console.warn(`Warning: dist/ is ${mb(bytes)}. GitHub Pages' limit is 1 GB, so plan another image host before it grows much more.`);
