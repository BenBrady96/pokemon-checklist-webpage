import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { curatedModule, dataDir, imageDir, loadModel, selectEntries } from './lib/collections.mjs';
import { writeCatalog } from './lib/catalog.mjs';
import { ASSETS, loadSet, setLogoUrl } from './lib/tcgdex.mjs';
import { compileTheme } from './lib/theme.mjs';
import { ROOT, args, download, exists, mapLimit, readJson, writeJson } from './lib/util.mjs';

const opts = args();
const FORCE = opts.has('force');
const entries = selectEntries(opts.list('only'));

const SIZES = {
  sm: { width: 330, height: 460, quality: 78 },
  lg: { width: 660, height: 920, quality: 80 },
};
const OFFICIAL = 'https://dz3we2x72f7ol.cloudfront.net/expansions';
const LIMITLESS = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci';
const TCGPLAYER = 'https://tcgplayer-cdn.tcgplayer.com/product';
const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/Outfit%5Bwght%5D.ttf';

function generatedSources(card, entry, raw) {
  const list = [];
  const n = Number(card.num);
  if (entry.images?.[card.id]) list.push(entry.images[card.id]);
  if (entry.gallery && Number.isFinite(n)) {
    const [path, code] = entry.gallery.split('/');
    list.push(`${OFFICIAL}/${path}/en-us/${code}_EN_${n}-2x.png`);
  }
  if (raw.source?.serie) list.push(`${ASSETS}/en/${raw.source.serie}/${raw.source.tcgdex}/${card.num}/high.webp`);
  if (Number.isFinite(n)) list.push(`${LIMITLESS}/${raw.syncKey}/${raw.syncKey}_${card.num}_R_EN_LG.png`);
  if (card.tcg) list.push(`${TCGPLAYER}/${card.tcg}_in_1000x1000.jpg`);
  return list;
}

async function firstAvailable(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      return await download(url, { attempts: 2 });
    } catch (err) {
      errors.push(err.message);
    }
  }
  throw new Error(errors.join(' · ') || 'no image source');
}

async function averageColor(file) {
  const { data } = await sharp(file).flatten({ background: '#808080' }).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  return `#${[...data.subarray(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

async function buildCollection(entry) {
  const model = await loadModel(entry.id);
  const curated = entry.curated ? await curatedModule(entry) : null;
  const dir = imageDir(entry.id);
  for (const key of Object.keys(SIZES)) await mkdir(join(dir, key), { recursive: true });
  const cards = model.cards.filter((c) => !c.img);
  const colors = {};
  const failures = [];
  let done = 0;
  let fetched = 0;
  await mapLimit(cards, 4, async (card) => {
    const out = Object.fromEntries(Object.keys(SIZES).map((k) => [k, join(dir, k, `${card.id}.webp`)]));
    try {
      const have = (await Promise.all(Object.values(out).map(exists))).every(Boolean);
      if (FORCE || !have) {
        const urls = curated ? [curated.imageSource(card, model.cardById)] : generatedSources(card, entry, model);
        const input = await firstAvailable(urls);
        for (const [key, { width, height, quality }] of Object.entries(SIZES)) {
          await sharp(input)
            .resize(width, height, { fit: 'cover', kernel: 'lanczos3' })
            .webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true })
            .toFile(out[key]);
        }
        fetched++;
      }
      colors[card.id] = await averageColor(out.sm);
    } catch (err) {
      failures.push(`${entry.id} ${card.id}: ${err.message}`);
    }
    done++;
    if (done % 25 === 0 || done === cards.length) process.stdout.write(`\r  ${entry.id}: ${done}/${cards.length} images`);
  });
  process.stdout.write(`  (${fetched} downloaded)\n`);

  const ordered = Object.fromEntries(cards.filter((c) => colors[c.id]).map((c) => [c.id, colors[c.id]]));
  const logo = await buildLogo(entry, model);
  await writeJson(join(dataDir(entry.id), 'images.json'), logo ? { logo, colors: ordered } : { colors: ordered }, { lines: ['colors'] });
  return failures;
}

async function buildLogo(entry, model) {
  if (!model.source?.tcgdex) return null;
  const path = `img/sets/${entry.id}/logo.webp`;
  const file = join(ROOT, path);
  if (!FORCE && await exists(file)) return path;
  const set = await loadSet(model.source.tcgdex);
  const url = setLogoUrl(set);
  if (!url) return null;
  let input;
  try {
    input = await firstAvailable([url, url.replace(/\.webp$/, '.png')]);
  } catch {
    return null;
  }
  await mkdir(join(ROOT, 'img/sets', ...entry.id.split('/')), { recursive: true });
  await sharp(input).resize(600, 240, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 95, effort: 6 }).toFile(file);
  return path;
}

const MARK = (grad) => `<rect x="120" y="94" width="290" height="324" rx="40" fill="none" stroke="url(#${grad})" stroke-width="22"/>
    <path d="M92 172h56M92 256h56M92 340h56" stroke="url(#${grad})" stroke-width="22" stroke-linecap="round"/>
    <g fill="url(#${grad})"><rect x="176" y="138" width="60" height="76" rx="10"/><rect x="250" y="138" width="60" height="76" rx="10"/><rect x="324" y="138" width="60" height="76" rx="10"/><rect x="176" y="226" width="60" height="76" rx="10"/><rect x="250" y="226" width="60" height="76" rx="10"/><rect x="176" y="314" width="60" height="76" rx="10"/></g>
    <g fill="none" stroke="url(#${grad})" stroke-width="8" opacity=".55"><rect x="328" y="230" width="52" height="68" rx="8"/><rect x="254" y="318" width="52" height="68" rx="8"/><rect x="328" y="318" width="52" height="68" rx="8"/></g>`;
const SPARKLE = (color) => `<path d="M414 60 l10 26 26 10 -26 10 -10 26 -10 -26 -26 -10 26 -10z" fill="${color}"/>`;

const EMBLEM_30 = (grad, color) => `<circle cx="256" cy="256" r="188" fill="none" stroke="url(#${grad})" stroke-width="14"/>
    <circle cx="256" cy="256" r="164" fill="none" stroke="${color}" stroke-opacity=".28" stroke-width="3"/>
    <g fill="none" stroke="url(#${grad})" stroke-width="42" stroke-linecap="round" stroke-linejoin="round">
      <path d="M138 196 C156 170 186 164 204 168 C234 175 242 205 232 226 C224 243 207 252 188 253 C214 254 240 268 240 296 C240 326 214 344 186 344 C164 344 146 334 136 316"/>
      <rect x="290" y="170" width="92" height="174" rx="46"/>
    </g>
    <path d="M396 128 l9 22 22 9 -22 9 -9 22 -9 -22 -22 -9 22 -9z" fill="#FFE9A3"/>`;

const gradient = (id, t) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t['--theme-pale']}"/><stop offset=".45" stop-color="${t['--theme']}"/><stop offset="1" stop-color="${t['--theme-deep']}"/>
    </linearGradient>`;

function iconSvg({ maskable = false } = {}) {
  const t = compileTheme().light;
  const scale = maskable ? 0.78 : 1;
  const offset = (256 * (1 - scale)).toFixed(1);
  const background = maskable ? '<rect width="512" height="512" fill="url(#bg)"/>' : '<rect width="512" height="512" rx="112" fill="url(#bg)"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#26316B"/><stop offset=".55" stop-color="#141B45"/><stop offset="1" stop-color="#0B1026"/>
    </radialGradient>
    ${gradient('gold', t)}
  </defs>
  ${background}
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    ${MARK('gold')}
    ${SPARKLE(t['--theme-pale'])}
  </g>
</svg>
`;
}

async function buildIcons() {
  const dir = join(ROOT, 'img/icons');
  await mkdir(dir, { recursive: true });
  const regular = Buffer.from(iconSvg());
  const maskable = Buffer.from(iconSvg({ maskable: true }));
  await writeFile(join(dir, 'favicon.svg'), regular);
  const png = (svg, size, name) => sharp(svg, { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(dir, name));
  await Promise.all([
    png(regular, 32, 'favicon-32.png'),
    png(regular, 192, 'icon-192.png'),
    png(regular, 512, 'icon-512.png'),
    png(maskable, 512, 'icon-maskable-512.png'),
    png(maskable, 180, 'apple-touch-icon.png'),
  ]);
}

async function fontFile() {
  const path = join(tmpdir(), 'p30c-outfit-variable.ttf');
  if (!(await exists(path))) await writeFile(path, await download(FONT_URL));
  return path;
}

async function textImage(fontfile, content, { size, weight = 400, color = '#FFFFFF', spacing = 0, wrap }) {
  const attrs = `font_weight="${weight}" foreground="${color}"${spacing ? ` letter_spacing="${spacing}"` : ''}`;
  const { data, info } = await sharp({
    text: { text: `<span ${attrs}>${content}</span>`, font: `Outfit ${size}`, fontfile, dpi: 72, rgba: true, ...(wrap ? { width: wrap } : {}) },
  }).png().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function fittedText(fontfile, content, options, maxWidth) {
  let size = options.size;
  for (;;) {
    const text = await textImage(fontfile, content, { ...options, size });
    if (text.width <= maxWidth || size <= 12) return text;
    size = Math.floor(size * (maxWidth / text.width) * 0.98);
  }
}

async function gradientFill(text, t) {
  const fill = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${text.width}" height="${text.height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t['--theme-pale']}"/><stop offset=".5" stop-color="${t['--theme-bright']}"/><stop offset="1" stop-color="${t['--theme-lo']}"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  return { ...text, data: await sharp(fill).composite([{ input: text.data, blend: 'dest-in' }]).png().toBuffer() };
}

async function fannedCard(file, width, angle) {
  const height = Math.round((width * 920) / 660);
  const radius = Math.round(width * 0.045);
  const pad = 40;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}"/></svg>`);
  const card = await sharp(file).resize(width, height).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width + pad * 2}" height="${height + pad * 2}"><rect x="${pad}" y="${pad + 14}" width="${width}" height="${height}" rx="${radius}" fill="#000" fill-opacity=".6"/></svg>`)).blur(14).png().toBuffer();
  const framed = await sharp(shadow).composite([{ input: card, left: pad, top: pad }]).png().toBuffer();
  return sharp(framed).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
}

const FAN = [
  { width: 196, angle: -16, x: 752, y: 352 },
  { width: 196, angle: 16, x: 1082, y: 352 },
  { width: 218, angle: -8, x: 830, y: 330 },
  { width: 218, angle: 8, x: 1004, y: 330 },
  { width: 244, angle: 0, x: 917, y: 318 },
];

async function socialImage({ out, theme, emblem, kicker, title, subtitle, blurb, cards }) {
  const W = 1200;
  const H = 630;
  const t = theme.light;
  const sparkle = (x, y, s, o) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4Z" fill="${t['--theme-bright']}" opacity="${o}"/>`;
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t['--chrome-0']}"/><stop offset=".55" stop-color="${t['--chrome-2']}"/><stop offset="1" stop-color="${t['--chrome-3']}"/></linearGradient>
    <radialGradient id="glow" cx="18%" cy="0%" r="70%"><stop offset="0" stop-color="${t['--theme']}" stop-opacity=".28"/><stop offset="1" stop-color="${t['--theme']}" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow2" cx="76%" cy="52%" r="46%"><stop offset="0" stop-color="${t['--theme-deep']}" stop-opacity=".3"/><stop offset="1" stop-color="${t['--theme-deep']}" stop-opacity="0"/></radialGradient>
    ${gradient('gold', t)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  ${sparkle(640, 70, 1.1, 0.5)}${sparkle(1150, 90, 0.8, 0.45)}${sparkle(600, 560, 0.7, 0.35)}${sparkle(1120, 575, 1, 0.4)}${sparkle(470, 120, 0.6, 0.3)}${sparkle(700, 600, 0.5, 0.3)}
  <rect y="${H - 8}" width="${W}" height="8" fill="url(#gold)"/>
</svg>`);
  const emblemSvg = emblem === 'emblem-30' ? EMBLEM_30('gold', t['--theme']) : `${MARK('gold')}${SPARKLE(t['--theme-pale'])}`;
  const emblemImage = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 512 512"><defs>${gradient('gold', t)}</defs>${emblemSvg}</svg>`);

  const font = await fontFile();
  const left = 72;
  const textWidth = 560;
  const kickerImage = await textImage(font, kicker, { size: 24, weight: 600, color: t['--theme-bright'], spacing: 5120 });
  const titleImage = await gradientFill(await fittedText(font, title, { size: 80, weight: 800 }, textWidth), t);
  const subtitleImage = await fittedText(font, subtitle, { size: 66, weight: 700 }, textWidth);
  const blurbImage = await textImage(font, blurb, { size: 27, color: '#C4CAE6', wrap: 520 });
  const perks = await textImage(font, 'Free  ·  No sign-up  ·  Works offline', { size: 25, weight: 600, color: t['--theme-bright'] });

  const layers = [{ input: emblemImage, left, top: 60 }];
  let y = 196;
  layers.push({ input: kickerImage.data, left: left + 2, top: y });
  y += kickerImage.height + 6;
  layers.push({ input: titleImage.data, left, top: y });
  y += titleImage.height - 4;
  layers.push({ input: subtitleImage.data, left: left + 1, top: y });
  y += subtitleImage.height + 20;
  layers.push({ input: blurbImage.data, left: left + 2, top: y });
  layers.push({ input: perks.data, left: left + 2, top: H - 72 - perks.height });
  for (const [i, file] of cards.slice(0, FAN.length).entries()) {
    const spot = FAN[i];
    const { data, info } = await fannedCard(file, spot.width, spot.angle);
    layers.push({ input: data, left: Math.round(spot.x - info.width / 2), top: Math.round(spot.y - info.height / 2) });
  }
  await mkdir(join(out, '..'), { recursive: true });
  await sharp(background).composite(layers).jpeg({ quality: 86, progressive: true, mozjpeg: true }).toFile(out);
}

const escapeMarkup = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const SHOWPIECE = { SIR: 0, IR: 1 };
function showcase(model) {
  const seen = new Set();
  const picks = [];
  const byRarity = [...model.cards].filter((c) => !c.img && model.hasImage(c))
    .sort((a, b) => (SHOWPIECE[a.rarity] ?? 2) - (SHOWPIECE[b.rarity] ?? 2)
      || model.rarityById.get(b.rarity).rank - model.rarityById.get(a.rarity).rank || a.idx - b.idx);
  for (const card of byRarity) {
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    picks.push(card);
    if (picks.length === 5) break;
  }
  return [picks[4], picks[3], picks[2], picks[1], picks[0]].filter(Boolean);
}

const cardFile = (model, card) => join(imageDir(model.id), 'lg', `${card.imageId}.webp`);
const shareImagePath = (id) => `${join(ROOT, 'img/og', ...id.split('/'))}.jpg`;

async function buildSetShareImage(entry) {
  const keep = entry.curated ? !FORCE : !FORCE && !opts.has('force-og');
  if (keep && await exists(shareImagePath(entry.id))) return;
  const model = await loadModel(entry.id);
  const curated = entry.curated ? await curatedModule(entry) : null;
  const theme = compileTheme(entry.theme);
  const cards = curated?.og?.showcase
    ? curated.og.showcase.map((s) => cardFile(model, model.cardById.get(s.id)))
    : showcase(model).map((c) => cardFile(model, c));
  if (cards.length < 3) return;
  const complete = model.getTier('complete').cards.length;
  await socialImage({
    out: shareImagePath(entry.id),
    theme,
    emblem: curated?.og?.emblem || 'logo-mark',
    kicker: model.game.name.toUpperCase(),
    title: escapeMarkup(model.name),
    subtitle: 'Card Checklist',
    blurb: curated?.og?.blurb || escapeMarkup(model.kind === 'expansion'
      ? `Track all ${complete} cards${model.visibleTiers.some((t) => t.id === 'master') && model.getTier('master').cards.length > complete ? ', plus every reverse holo for a master set' : ''}.`
      : `Track all ${complete} cards.`),
    cards,
  });
}

const HOME_SETS = ['pokemon/151', 'pokemon/prismatic-evolutions', 'pokemon/mega-evolution', 'pokemon/surging-sparks', 'pokemon/destined-rivals'];
async function buildHomeShareImage(catalogEntries) {
  const cards = [];
  for (const id of HOME_SETS.filter((x) => catalogEntries.some((c) => c.id === x))) {
    const model = await loadModel(id);
    const pick = showcase(model).at(-1);
    if (pick) cards.push(cardFile(model, pick));
  }
  await socialImage({
    out: join(ROOT, 'img/og-image.jpg'),
    theme: compileTheme(),
    emblem: 'logo-mark',
    kicker: 'POKÉMON TCG',
    title: 'Binder Tracker',
    subtitle: 'Set Checklists',
    blurb: 'Every Scarlet &amp; Violet and Mega Evolution set, with reverse holos, promos &amp; prices.',
    cards: [cards[3], cards[4], cards[1], cards[2], cards[0]].filter(Boolean),
  });
}

const failures = [];
for (const entry of entries) failures.push(...await buildCollection(entry));
const catalog = await writeCatalog();
if (!opts.has('skip-icons')) {
  console.log('Building icons…');
  await buildIcons();
}
if (!opts.has('skip-og')) {
  console.log('Building share images…');
  for (const entry of entries) {
    try {
      await buildSetShareImage(entry);
    } catch (err) {
      failures.push(`${entry.id} share image: ${err.message}`);
    }
  }
  await buildHomeShareImage(catalog);
}
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n  ${failures.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('Done.');
}
