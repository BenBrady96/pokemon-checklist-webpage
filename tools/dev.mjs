import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { CONFIG } from './lib/collections.mjs';
import { collectionPage, homePage, sitemap } from './lib/pages.mjs';
import { ROOT } from './lib/util.mjs';

const PORT = Number(process.env.PORT || 8080);
const SITE = `http://localhost:${PORT}/`;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.ico': 'image/x-icon',
};
const PRIVATE = ['tools', 'collections', 'node_modules', '.git', '.cache', 'dist', 'collection.html', 'package.json', 'package-lock.json'];

async function route(pathname) {
  if (pathname === '/' || pathname === '/index.html') return ['.html', await homePage({ siteUrl: SITE })];
  if (pathname === '/sitemap.xml') return ['.xml', await sitemap({ siteUrl: SITE })];
  const page = CONFIG.find((e) => pathname === `/${e.id}/` || pathname === `/${e.id}/index.html`);
  if (page) return ['.html', await collectionPage(page.id, { siteUrl: SITE })];
  const file = normalize(join(ROOT, decodeURIComponent(pathname)));
  const rel = file.slice(ROOT.length + 1);
  if (!file.startsWith(ROOT + sep) || PRIVATE.some((p) => rel === p || rel.startsWith(p + sep))) return null;
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return null;
  return [extname(file), await readFile(file)];
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, SITE);
  try {
    const found = await route(pathname);
    if (!found) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      res.end(await readFile(join(ROOT, '404.html')));
      return;
    }
    const [ext, body] = found;
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(String(err.stack || err));
  }
}).listen(PORT, () => console.log(`Binder Tracker preview: ${SITE}`));
