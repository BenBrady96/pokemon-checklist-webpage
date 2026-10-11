import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GAMES, dataDir, loadCatalog, loadModel, loadRaw } from './collections.mjs';
import { ROOT, exists, readJson } from './util.mjs';
import { TIER_DEFS } from '../../js/model.js';
import { formatMoney, priceDate, ratesOf } from '../../js/pricing.js';

export const DEFAULT_URL = 'https://bindertracker.co.uk/';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function fill(template, values) {
  return template
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => {
      if (!(key in values)) throw new Error(`Template value missing: ${key}`);
      return values[key] ?? '';
    })
    .replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in values)) throw new Error(`Template value missing: ${key}`);
      return escapeHtml(values[key]);
    });
}

const prefixUrls = (html, prefix) => html.replace(/\b(href|src)="(?![a-z][a-z0-9+.-]*:|#|\/)([^"]*)"/gi, (_, attr, url) => `${attr}="${prefix}${url === './' ? '' : url}"`);

const jsonScript = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

async function ogImageFor(id) {
  const path = `img/og/${id}.jpg`;
  return (await exists(join(ROOT, path))) ? path : 'img/og-image.jpg';
}

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const longDate = (date) => LONG_DATE.format(new Date(`${date}T00:00:00Z`));
const plural = (n, one) => `${n} ${n === 1 ? one : `${one}s`}`;
const list = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const capitalise = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;
const TOP_CARDS = 10;

const tally = (rows) => `<ul class="tally">${rows.map(([label, n]) => `<li>${escapeHtml(label)} <b>${n}</b></li>`).join('')}</ul>`;

function rarityRows(model, cards) {
  const order = (card) => model.rarities.findIndex((r) => r.id === card.rarity);
  const counts = new Map();
  for (const card of [...cards].sort((a, b) => order(a) - order(b))) counts.set(card.rarityName, (counts.get(card.rarityName) || 0) + 1);
  return [...counts];
}

function topCardsHtml(model, prices) {
  const rates = ratesOf(prices);
  const top = model.cards
    .map((card) => ({ card, usd: prices?.cards?.[card.id]?.usd }))
    .filter((p) => p.usd > 0)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, TOP_CARDS);
  if (top.length < 3) return '';
  const rows = top.map(({ card, usd }) => '<li>'
    + `<span class="top-cards__card"><b>${escapeHtml(card.name)}</b><small>${escapeHtml(card.printed || card.num)} · ${escapeHtml(card.rarityShort)}</small></span>`
    + `<span class="top-cards__price">${formatMoney(usd, { currency: 'gbp', rates })}<small>${formatMoney(usd, { currency: 'usd' })}</small></span>`
    + '</li>').join('');
  return `<h3 class="about__sub">Most valuable ${escapeHtml(model.name)} cards</h3>`
    + `<ol class="top-cards">${rows}</ol>`
    + `<p class="about__note">TCGplayer market prices${prices.updated ? `, updated ${priceDate(prices.updated)}` : ''}. Pounds are converted from US dollars.</p>`;
}

function cardListHtml(model, sections) {
  const lists = sections.map((s) => `<h4 class="card-index__title">${escapeHtml(s.name)}${s.range ? ` <small>${escapeHtml(s.range)}</small>` : ''}</h4>`
    + `<ol class="card-index__list">${model.cardsBySection.get(s.id).map((c) => `<li><span>${escapeHtml(c.printed || c.num)}</span> ${escapeHtml(c.name)} <small>${escapeHtml(c.rarityShort)}</small></li>`).join('')}</ol>`);
  return `<details class="card-index"><summary>${escapeHtml(model.name)} card list <small>${plural(model.cards.length, 'card')}</small></summary>${lists.join('')}</details>`;
}

function faqHtml(model, sections) {
  const name = escapeHtml(model.name);
  const count = (s) => model.cardsBySection.get(s.id).length;
  const variants = model.cards.length - model.cardCount;
  const items = [[
    `How many cards are in ${name}?`,
    `<p>${name} has ${plural(model.cardCount, 'card')}${variants ? `, plus ${plural(variants, 'variant')}, so there are ${model.cards.length} to collect in all` : ''}.</p>`
      + (sections.length > 1 ? tally(sections.map((s) => [s.name, count(s)])) : ''),
  ]];
  if (model.visibleTiers.length > 1) {
    const tiers = model.visibleTiers.map((t) => `the ${t.name} has ${plural(t.cards.length, 'card')}`);
    items.push([`How many cards are in the ${name} master set?`, `<p>${capitalise(list(tiers))}. Pick the one you’re collecting at the top of the checklist and your progress counts towards it.</p>`]);
  }
  const secret = sections.find((s) => s.id === 'secret');
  if (secret) {
    const cards = model.cardsBySection.get('secret');
    const numbered = /^(\d+)–(\d+)$/.exec(secret.range || '');
    items.push([
      `What are the secret rares in ${name}?`,
      `<p>${name} has ${plural(cards.length, 'secret rare')}${numbered && numbered[1] !== numbered[2] ? `, numbered ${numbered[1]} to ${numbered[2]}` : ''}. By rarity:</p>${tally(rarityRows(model, cards))}`,
    ]);
  }
  const rarities = rarityRows(model, model.cards.filter((c) => !c.variant));
  if (rarities.length > 1) items.push([`What rarities are in ${name}?`, `<p>Counting each card once, without variants:</p>${tally(rarities)}`]);
  if (model.released && (model.kind === 'expansion' || model.kind === 'collection')) {
    const series = model.kind === 'expansion' && model.series && model.series !== 'Other' ? `, as part of the ${escapeHtml(model.series)} series` : '';
    items.push([`When did ${name} come out?`, `<p>${name} was released on ${longDate(model.released)}${series}.</p>`]);
  }
  items.push([`Is this ${name} checklist free?`, '<p>Yes. Binder Tracker is free, with <b>no ads, no sign-up and no tracking</b>. Your collection is saved on your own device and works offline, and a sync link or backup moves it to another device.</p>']);
  return `<h3 class="about__sub">${name} FAQ</h3>${items.map(([q, a]) => `<h4 class="about__q">${q}</h4>${a}`).join('')}`;
}

function setGuideHtml(model, prices) {
  const sections = model.sections.filter((s) => model.cardsBySection.get(s.id).length);
  if (!sections.length) return '';
  return [topCardsHtml(model, prices), cardListHtml(model, sections), faqHtml(model, sections)].join('\n  ');
}

export async function collectionPage(id, { siteUrl = DEFAULT_URL } = {}) {
  const [template, raw, prices] = await Promise.all([readFile(join(ROOT, 'collection.html'), 'utf8'), loadRaw(id), readJson(join(dataDir(id), 'prices.json'))]);
  const model = await loadModel(id, { raw });
  const game = GAMES[raw.game];
  const url = `${siteUrl}${id}/`;
  const ogImage = `${siteUrl}${await ogImageFor(id)}`;
  const seo = raw.seo || {};
  const complete = model.cardCount;
  const title = seo.title || `${game.name} ${raw.name} Checklist · All ${complete} Cards`;
  const description = seo.description || `Free checklist for the ${game.name} ${raw.name} set.`;
  const ogTitle = seo.ogTitle || `${game.name} ${raw.name} Checklist`;
  const features = [
    'No ads, no sign-up and no tracking',
    `Checklist for all ${complete} cards`,
    `${model.visibleTiers.map((t) => t.label).join(', ')} set tracking`,
    'Copy counts for duplicates and trades',
    'Grid, list and binder page views',
    'Works offline',
    'Share and sync links',
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${url}#page`, url, name: ogTitle, description, inLanguage: 'en-GB',
        isPartOf: { '@id': `${siteUrl}#website` }, breadcrumb: { '@id': `${url}#breadcrumb` }, primaryImageOfPage: ogImage,
      },
      {
        '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Binder Tracker', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: `${game.name} ${raw.name}`, item: url },
        ],
      },
      {
        '@type': 'WebApplication', '@id': `${url}#app`, name: `${raw.name} Checklist`, url,
        description: seo.appDescription || description, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, inLanguage: 'en-GB', image: ogImage,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' }, featureList: features,
      },
    ],
  };
  const html = fill(template, {
    id,
    title: `${title} | Binder Tracker`,
    description,
    url,
    ogTitle,
    ogDescription: seo.ogDescription || description,
    twitterDescription: seo.twitterDescription || seo.ogDescription || description,
    ogImage,
    imageAlt: seo.imageAlt || `${raw.name} card checklist`,
    jsonLd: jsonScript(jsonLd),
    gameName: game.name,
    name: raw.name,
    aboutTitle: raw.about?.title || `About the ${raw.name} set`,
    aboutHtml: (raw.about?.paragraphs || []).map((p) => `<p>${p}</p>`).join('\n  '),
    setGuide: setGuideHtml(model, prices),
    robots: model.cards.length ? 'index, follow, max-image-preview:large' : 'noindex',
    disclaimer: game.disclaimer,
    setArt: (await exists(join(ROOT, `img/sets/${id}/logo.webp`))) ? `<img class="set-hero__logo" src="img/sets/${id}/logo.webp" alt="" decoding="async">` : '',
    setMeta: [game.name, model.released ? releaseText(model.released) : '', `${complete} cards`].filter(Boolean).join(' · '),
  });
  return prefixUrls(html, '../'.repeat(id.split('/').length));
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const releaseText = (date) => MONTH.format(new Date(`${date}T00:00:00Z`));

const PRICED_SHARE = 0.7;

export async function setValues(catalog) {
  const values = new Map();
  await Promise.all(catalog.collections.map(async (c) => {
    const [model, prices] = await Promise.all([loadModel(c.id), readJson(join(dataDir(c.id), 'prices.json'))]);
    if (!prices?.cards || !prices.gbpPerUsd) return;
    const tiers = {};
    for (const def of TIER_DEFS) {
      const { cards } = model.getTier(def.id);
      let usd = 0;
      let priced = 0;
      for (const card of cards) {
        const price = prices.cards[card.id]?.usd;
        if (price == null) continue;
        usd += price;
        priced++;
      }
      if (cards.length && priced >= cards.length * PRICED_SHARE) tiers[def.id] = Math.round(usd * 100) / 100;
    }
    if (Object.keys(tiers).length) values.set(c.id, { rates: ratesOf(prices), tiers });
  }));
  return values;
}

function tileHtml(c, value) {
  const total = value?.tiers[c.defaultTier];
  const art = c.logo
    ? `<img class="set-tile__logo" src="${c.logo}" alt="" loading="lazy" decoding="async">`
    : `<span class="set-tile__wordmark">${escapeHtml(c.name)}</span>`;
  return `<a class="set-tile" href="${c.id}/" data-id="${escapeHtml(c.id)}"${value ? ` data-values="${escapeHtml(JSON.stringify(value))}"` : ''}>`
    + `<span class="set-tile__art">${art}</span>`
    + '<span class="set-tile__body">'
    + `<span class="set-tile__name">${escapeHtml(c.name)}</span>`
    + `<span class="set-tile__meta">${releaseText(c.released)} · ${c.total} cards</span>`
    + '<span class="set-tile__progress"><span class="bar" aria-hidden="true"><i></i></span><span class="set-tile__count"></span><span class="set-tile__none">No cards collected</span></span>'
    + `<span class="set-tile__value value-pill"${total == null ? ' hidden>' : `>${formatMoney(total, { rates: value.rates, short: true, approx: true })}`}</span>`
    + '</span></a>';
}

const KIND_HEADINGS = { promo: 'Promos', energy: 'Energy' };
const OPEN_SERIES = 2;

function collectionsHtml(catalog, values = new Map()) {
  const parts = [];
  for (const game of catalog.games) {
    const sets = catalog.collections.filter((c) => c.game === game.id);
    if (!sets.length) continue;
    const title = game.logo
      ? `<img class="home-game__logo" src="${game.logo}" alt="${escapeHtml(game.name)}"><span class="home-game__tagline" aria-hidden="true">Trading Card Game</span>`
      : escapeHtml(game.name);
    parts.push(`<section class="home-game" aria-labelledby="game-${game.id}"><h2 class="home-game__title" id="game-${game.id}">${title}</h2>`);
    let shown = 0;
    for (const series of game.series) {
      const inSeries = sets.filter((c) => c.series === series);
      if (!inSeries.length) continue;
      const expansions = inSeries.filter((c) => c.kind === 'expansion');
      const main = expansions.length ? expansions : inSeries;
      const extras = expansions.length ? inSeries.filter((c) => c.kind !== 'expansion') : [];
      const open = shown++ < OPEN_SERIES;
      parts.push(`<details class="home-series" data-series${open ? ' open data-open' : ''}>`
        + `<summary class="home-series__head"><h3 class="home-series__title">${escapeHtml(series)}</h3><span class="home-series__count">${inSeries.length === 1 ? '1 set' : `${inSeries.length} sets`}</span></summary>`
        + `<div class="set-grid">${main.map((c) => tileHtml(c, values.get(c.id))).join('')}</div>`
        + (extras.length ? `<h4 class="home-series__sub">${[...new Set(extras.map((c) => KIND_HEADINGS[c.kind] || 'More'))].join(' &amp; ')}</h4><div class="set-grid set-grid--small">${extras.map((c) => tileHtml(c, values.get(c.id))).join('')}</div>` : '')
        + '</details>');
    }
    parts.push('</section>');
  }
  return parts.join('\n');
}

export async function homePage({ siteUrl = DEFAULT_URL } = {}) {
  const [template, catalog] = await Promise.all([readFile(join(ROOT, 'index.html'), 'utf8'), loadCatalog()]);
  const setCount = catalog.collections.filter((c) => c.kind === 'expansion').length;
  return fill(template, { collections: collectionsHtml(catalog, await setValues(catalog)), setCount }).split(DEFAULT_URL).join(siteUrl);
}

export async function portfolioPage({ siteUrl = DEFAULT_URL } = {}) {
  const template = await readFile(join(ROOT, 'portfolio.html'), 'utf8');
  return prefixUrls(template.split(DEFAULT_URL).join(siteUrl), '../');
}

export async function tradePage({ siteUrl = DEFAULT_URL } = {}) {
  const template = await readFile(join(ROOT, 'trade.html'), 'utf8');
  return prefixUrls(template.split(DEFAULT_URL).join(siteUrl), '../');
}

export async function listPage({ siteUrl = DEFAULT_URL } = {}) {
  const template = await readFile(join(ROOT, 'list.html'), 'utf8');
  return prefixUrls(template.split(DEFAULT_URL).join(siteUrl), '../');
}

async function docUpdated(file) {
  const m = /Last updated: (\d{1,2}) (\w+) (\d{4})/.exec(await readFile(join(ROOT, file), 'utf8'));
  if (!m) throw new Error(`${file}: "Last updated" date not found`);
  const month = new Date(`${m[2]} 1, 2000`).getMonth();
  if (Number.isNaN(month)) throw new Error(`${file}: unknown month ${m[2]}`);
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1]))).toISOString().slice(0, 10);
}

export async function sitemap({ siteUrl = DEFAULT_URL, today = new Date().toISOString().slice(0, 10) } = {}) {
  const catalog = await loadCatalog();
  const urls = [
    ['', 'weekly', '1.0', today],
    ...catalog.collections.filter((c) => c.total > 0).map((c) => [`${c.id}/`, 'weekly', '0.9', today]),
    ['privacy.html', 'yearly', '0.3', await docUpdated('privacy.html')],
    ['terms.html', 'yearly', '0.3', await docUpdated('terms.html')],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([path, freq, priority, lastmod]) => `  <url>
    <loc>${siteUrl}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}
