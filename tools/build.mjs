import { access, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
const DEFAULT_URL = 'https://benbrady96.github.io/pokemon-checklist-webpage/';
const SITE_URL = (process.env.SITE_URL || DEFAULT_URL).replace(/\/*$/, '/');
const VERSION = `${(process.env.GITHUB_SHA || 'local').slice(0, 7)}-${Date.now().toString(36)}`;
const TODAY = new Date().toISOString().slice(0, 10);

const ENTRIES = [
  'index.html', 'privacy.html', 'terms.html', '404.html',
  'manifest.webmanifest', 'sw.js', 'robots.txt', 'sitemap.xml',
  'css', 'js', 'fonts', 'img',
];
const URL_FILES = ['index.html', 'privacy.html', 'terms.html', '404.html', 'robots.txt', 'sitemap.xml'];

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

await mkdir(OUT, { recursive: true });
for (const entry of await readdir(OUT)) await rm(join(OUT, entry), { recursive: true, force: true });
for (const entry of ENTRIES) await cp(join(ROOT, entry), join(OUT, entry), { recursive: true });

for (const file of URL_FILES) {
  const path = join(OUT, file);
  let text = (await readFile(path, 'utf8')).split(DEFAULT_URL).join(SITE_URL);
  if (file === 'sitemap.xml') text = text.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${TODAY}</lastmod>`);
  await writeFile(path, text);
}

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

const files = await listFiles(OUT);
const unlisted = files
  .map((file) => relative(OUT, file).split(sep).join('/'))
  .filter((path) => /\.(js|css|html)$/.test(path) && path !== 'sw.js' && path !== '404.html' && !shell.includes(path));
if (unlisted.length) throw new Error(`Add these to the SHELL list in sw.js so they work offline: ${unlisted.join(', ')}`);

let bytes = 0;
for (const file of files) bytes += (await stat(file)).size;
console.log(`Built dist/ — ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
console.log(`Site URL: ${SITE_URL}`);
console.log(`Service worker version: ${VERSION}`);
