import { mkdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CARDS, CARD_BY_ID } from '../js/cards.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORCE = process.argv.includes('--force');
const CONCURRENCY = 4;

const CDN = 'https://dz3we2x72f7ol.cloudfront.net/expansions/30th-celebration/en-us';

const SQUARESPACE = 'https://images.squarespace-cdn.com/content/682a3307f6bd950e4b98cbb9';
const ENERGY_SOURCES = {
  e009: `${SQUARESPACE}/fa7d420d-8558-496a-ab9e-a1d808973fe8/basic+grass+30+celebration.webp`,
  e010: `${SQUARESPACE}/7fdf551c-80bf-4aed-8bb0-9097b574b552/30th+celebration+fire.webp`,
  e011: `${SQUARESPACE}/e22378b6-1ec5-4d6c-8937-d3718a41ebae/water+30th+celebration.webp`,
  e012: `${SQUARESPACE}/632cd61c-3bf8-4fac-8802-8235fe6ab4c0/30th+electricty.webp`,
  e013: `${SQUARESPACE}/f95b4540-acce-436e-8fea-53faa731ae07/30th+psychic.webp`,
  e014: `${SQUARESPACE}/70ac9a79-6487-4466-914d-c4bf62de9a9f/30th+fighting.webp`,
  e015: `${SQUARESPACE}/63306109-6abd-43fe-8b3b-24445a8e324b/darkness+30th.webp`,
  e016: `${SQUARESPACE}/193aae09-4545-4671-86a4-9be37604e72c/30th+celebration.webp`,
};

const PROMO_CDN = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEP';

const POKECOTTAGE = 'https://pokecottagecdn.com/card-library/images/en/mep';
const POKECOTTAGE_SOURCES = {
  p102: `${POKECOTTAGE}/0d485cfb-2843-4aeb-9c13-b2092ae98b67.jpg`,
  p103: `${POKECOTTAGE}/42c63f17-8164-4151-b726-920265bab5a8.jpg`,
  p104: `${POKECOTTAGE}/e37a3264-a849-4e6e-a42f-632057aee303.jpg`,
  p105: `${POKECOTTAGE}/8bea4ddd-2b15-4668-aa9b-9dc3cc47a236.jpg`,
  p106: `${POKECOTTAGE}/5b98e2a6-9680-488a-9695-2e2a372a1b54.jpg`,
  p107: `${POKECOTTAGE}/d5448264-e17c-4140-83ad-72d4d7177e43.jpg`,
  p108: `${POKECOTTAGE}/d5e3ca26-ee9c-4f12-b3af-b639dab9d397.jpg`,
  p109: `${POKECOTTAGE}/cc7a7bff-cf7d-4983-b55c-557ca3b9bbee.jpg`,
  p110: `${POKECOTTAGE}/7dfd91df-e64e-482f-a62b-e401853a0ecd.jpg`,
  v03: `${POKECOTTAGE}/8d58bfd7-f450-4be8-a731-d8007e193d7c.jpg`,
};

const RGB_GALLERY = 'https://miketendo64.com/wp-content/uploads/2026/09/30th-Celebration_';
const RGB_SOURCES = {
  'rgb-r': `${RGB_GALLERY}Red-Mew.jpg`,
  'rgb-g': `${RGB_GALLERY}Green-Mew.jpg`,
  'rgb-b': `${RGB_GALLERY}Blue-Mew.jpg`,
};

const CLASSIC_IMAGE = {
  c01: 14, c02: 1, c03: 5, c04: 15, c05: 7, c06: 24, c07: 29, c08: 2, c09: 6, c10: 25,
  c11: 3, c12: 22, c13: 10, c14: 11, c15: 18, c16: 19, c17: 20, c18: 21, c19: 16, c20: 4,
  c21: 23, c22: 9, c23: 17, c24: 13, c25: 8, c26: 28, c27: 12, c28: 26, c29: 27, c30: 30,
};

const SIZES = {
  sm: { width: 330, height: 460, quality: 78 },
  lg: { width: 660, height: 920, quality: 80 },
};

const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/Outfit%5Bwght%5D.ttf';

const GOLD_GRADIENT = `<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFE9A3"/><stop offset=".45" stop-color="#F2C14E"/><stop offset="1" stop-color="#C98E1E"/>
    </linearGradient>`;

const EMBLEM = `<circle cx="256" cy="256" r="188" fill="none" stroke="url(#gold)" stroke-width="14"/>
    <circle cx="256" cy="256" r="164" fill="none" stroke="#F2C14E" stroke-opacity=".28" stroke-width="3"/>
    <g fill="none" stroke="url(#gold)" stroke-width="42" stroke-linecap="round" stroke-linejoin="round">
      <path d="M138 196 C156 170 186 164 204 168 C234 175 242 205 232 226 C224 243 207 252 188 253 C214 254 240 268 240 296 C240 326 214 344 186 344 C164 344 146 334 136 316"/>
      <rect x="290" y="170" width="92" height="174" rx="46"/>
    </g>
    <path d="M396 128 l9 22 22 9 -22 9 -9 22 -9 -22 -22 -9 22 -9z" fill="#FFE9A3"/>
    <path d="M114 362 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6z" fill="#F2C14E" opacity=".8"/>`;

function sourceFor(card) {
  if (POKECOTTAGE_SOURCES[card.id]) return POKECOTTAGE_SOURCES[card.id];
  if (card.base) return sourceFor(CARD_BY_ID.get(card.base));
  if (card.section === 'energy') return ENERGY_SOURCES[card.id];
  if (card.section === 'classic') return `${CDN}/2M6P_Classic_EN_${CLASSIC_IMAGE[card.id]}-2x.png`;
  if (card.rarity === 'P') return `${PROMO_CDN}/MEP_${card.num}_R_EN_LG.png`;
  if (card.rarity === 'RGB') return RGB_SOURCES[card.id];
  return `${CDN}/2M6P_EN_${Number(card.id.slice(1))}-2x.png`;
}

const exists = (path) => access(path).then(() => true, () => false);

async function download(url, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (card checklist image build)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i >= attempts) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

async function averageColor(file) {
  const { data } = await sharp(file).flatten({ background: '#808080' }).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  return `#${[...data.subarray(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

async function processCard(card) {
  const out = Object.fromEntries(Object.keys(SIZES).map((k) => [k, join(ROOT, 'img/cards', k, `${card.id}.webp`)]));
  const have = (await Promise.all(Object.values(out).map(exists))).every(Boolean);
  let fetched = false;
  if (FORCE || !have) {
    const input = await download(sourceFor(card));
    for (const [key, { width, height, quality }] of Object.entries(SIZES)) {
      await sharp(input)
        .resize(width, height, { fit: 'cover', kernel: 'lanczos3' })
        .webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true })
        .toFile(out[key]);
    }
    fetched = true;
  }
  return { color: await averageColor(out.sm), fetched };
}

async function buildCards() {
  for (const key of Object.keys(SIZES)) await mkdir(join(ROOT, 'img/cards', key), { recursive: true });
  const colors = {};
  const failures = [];
  let done = 0;
  let fetched = 0;
  const queue = [...CARDS];
  async function worker() {
    for (let card = queue.shift(); card; card = queue.shift()) {
      try {
        const result = await processCard(card);
        colors[card.id] = result.color;
        if (result.fetched) fetched++;
      } catch (err) {
        failures.push(`${card.id}: ${err.message}`);
      }
      done++;
      process.stdout.write(`\r  cards ${done}/${CARDS.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write(`  (${fetched} downloaded)\n`);

  const key = (id) => (/^[a-z_$][\w$]*$/i.test(id) ? id : `'${id}'`);
  const body = CARDS.filter((c) => colors[c.id]).map((c) => `  ${key(c.id)}: '${colors[c.id]}',`).join('\n');
  await writeFile(join(ROOT, 'js/card-colors.js'), `export default {\n${body}\n};\n`);
  return failures;
}

function iconSvg({ maskable = false } = {}) {
  const scale = maskable ? 0.78 : 1;
  const offset = (256 * (1 - scale)).toFixed(1);
  const background = maskable
    ? '<rect width="512" height="512" fill="url(#bg)"/>'
    : '<rect width="512" height="512" rx="112" fill="url(#bg)"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#26316B"/><stop offset=".55" stop-color="#141B45"/><stop offset="1" stop-color="#0B1026"/>
    </radialGradient>
    ${GOLD_GRADIENT}
  </defs>
  ${background}
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    ${EMBLEM}
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

async function goldFill(text) {
  const gradient = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${text.width}" height="${text.height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFEDB0"/><stop offset=".5" stop-color="#F7D068"/><stop offset="1" stop-color="#DDA13A"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  return { ...text, data: await sharp(gradient).composite([{ input: text.data, blend: 'dest-in' }]).png().toBuffer() };
}

async function fannedCard(id, width, angle) {
  const height = Math.round((width * 920) / 660);
  const radius = Math.round(width * 0.045);
  const pad = 40;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}"/></svg>`);
  const card = await sharp(join(ROOT, 'img/cards/lg', `${id}.webp`)).resize(width, height).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width + pad * 2}" height="${height + pad * 2}"><rect x="${pad}" y="${pad + 14}" width="${width}" height="${height}" rx="${radius}" fill="#000" fill-opacity=".6"/></svg>`)).blur(14).png().toBuffer();
  const framed = await sharp(shadow).composite([{ input: card, left: pad, top: pad }]).png().toBuffer();
  return sharp(framed).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
}

async function buildSocialImage() {
  const W = 1200;
  const H = 630;
  const sparkle = (x, y, s, o) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4Z" fill="#F7D774" opacity="${o}"/>`;
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B2459"/><stop offset=".55" stop-color="#0E1433"/><stop offset="1" stop-color="#070B1E"/></linearGradient>
    <radialGradient id="glow" cx="18%" cy="0%" r="70%"><stop offset="0" stop-color="#F2C14E" stop-opacity=".28"/><stop offset="1" stop-color="#F2C14E" stop-opacity="0"/></radialGradient>
    <radialGradient id="blue" cx="76%" cy="52%" r="46%"><stop offset="0" stop-color="#3B4CCA" stop-opacity=".38"/><stop offset="1" stop-color="#3B4CCA" stop-opacity="0"/></radialGradient>
    ${GOLD_GRADIENT}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#blue)"/>
  ${sparkle(640, 70, 1.1, 0.5)}${sparkle(1150, 90, 0.8, 0.45)}${sparkle(600, 560, 0.7, 0.35)}${sparkle(1120, 575, 1, 0.4)}${sparkle(470, 120, 0.6, 0.3)}${sparkle(700, 600, 0.5, 0.3)}
  <rect y="${H - 8}" width="${W}" height="8" fill="url(#gold)"/>
</svg>`);
  const emblem = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 512 512"><defs>${GOLD_GRADIENT}</defs>${EMBLEM}</svg>`);

  const font = await fontFile();
  const left = 72;
  const textWidth = 560;
  const kicker = await textImage(font, 'POKÉMON TCG', { size: 24, weight: 600, color: '#F7D774', spacing: 5120 });
  const title = await goldFill(await fittedText(font, '30th Celebration', { size: 80, weight: 800 }, textWidth));
  const subtitle = await fittedText(font, 'Card Checklist', { size: 66, weight: 700 }, textWidth);
  const blurb = await textImage(font, 'Track all 199 cards: main set, secret rares, RGB Mews, Classic Collection &amp; promos.', { size: 27, color: '#C4CAE6', wrap: 520 });
  const perks = await textImage(font, 'Free  ·  No sign-up  ·  Works offline', { size: 25, weight: 600, color: '#F2C14E' });

  const layers = [{ input: emblem, left, top: 60 }];
  let y = 196;
  layers.push({ input: kicker.data, left: left + 2, top: y });
  y += kicker.height + 6;
  layers.push({ input: title.data, left, top: y });
  y += title.height - 4;
  layers.push({ input: subtitle.data, left: left + 1, top: y });
  y += subtitle.height + 20;
  layers.push({ input: blurb.data, left: left + 2, top: y });
  layers.push({ input: perks.data, left: left + 2, top: H - 72 - perks.height });

  const fan = [
    { id: 'c02', width: 196, angle: -16, x: 752, y: 352 },
    { id: 'c01', width: 196, angle: 16, x: 1082, y: 352 },
    { id: 'm152', width: 218, angle: -8, x: 830, y: 330 },
    { id: 'm157', width: 218, angle: 8, x: 1004, y: 330 },
    { id: 'm149', width: 244, angle: 0, x: 917, y: 318 },
  ];
  for (const card of fan) {
    const { data, info } = await fannedCard(card.id, card.width, card.angle);
    layers.push({ input: data, left: Math.round(card.x - info.width / 2), top: Math.round(card.y - info.height / 2) });
  }

  await sharp(background)
    .composite(layers)
    .jpeg({ quality: 86, progressive: true, mozjpeg: true })
    .toFile(join(ROOT, 'img/og-image.jpg'));
}

console.log('Building card images…');
const failures = await buildCards();
console.log('Building icons…');
await buildIcons();
console.log('Building social share image…');
await buildSocialImage();
if (failures.length) {
  console.error(`\n${failures.length} card(s) failed:\n  ${failures.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('Done.');
}
