import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COMING_SOON, CONFIG, GAMES, dataDir, loadCatalog, loadModel, loadRaw } from './collections.mjs';
import { GUIDES } from '../../config/guides/index.mjs';
import { PUBLIC, TEMPLATES, exists, readJson } from './util.mjs';
import { TIER_DEFS } from '../../public/js/core/model.js';
import { formatMoney, priceDate, ratesOf } from '../../public/js/core/pricing.js';

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
  return (await exists(join(PUBLIC, path))) ? path : 'img/og-image.jpg';
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
  items.push([`Is this ${name} checklist free?`, '<p>Yes. Binder Tracker is free, with <b>no ads, no sign-up and no tracking</b>. Your collection is saved on your own device and works offline, and <b>Export or share</b> moves it to another device as a link, code, QR code or file.</p>']);
  return `<h3 class="about__sub">${name} FAQ</h3>${items.map(([q, a]) => `<h4 class="about__q">${q}</h4>${a}`).join('')}`;
}

function setGuideHtml(model, prices) {
  const sections = model.sections.filter((s) => model.cardsBySection.get(s.id).length);
  if (!sections.length) return '';
  return [topCardsHtml(model, prices), cardListHtml(model, sections), faqHtml(model, sections)].join('\n  ');
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const utcDate = (date) => new Date(`${date}T00:00:00Z`);
const DAY_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const retailPrice = (amount, currency) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(amount);
const sealedPrices = (id) => readJson(join(dataDir(id), 'sealed.json'));
const isOut = (guide, today) => today >= guide.released;

const sourceListHtml = (sources) => `<ol class="guide-sources">${sources.map((s) => `<li id="source-${s.id}">${escapeHtml(s.publisher)}: <a href="${escapeHtml(s.url)}" rel="noopener">${escapeHtml(s.title)}</a>${s.date ? `, ${longDate(s.date)}` : ''}</li>`).join('')}</ol>`;

function articleJsonLd({ url, siteUrl, crumb, headline, description, image, published, modified }) {
  const publisher = { '@type': 'Organization', name: 'Binder Tracker', url: siteUrl };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage', '@id': `${url}#page`, url, name: headline, description, inLanguage: 'en-GB',
        isPartOf: { '@id': `${siteUrl}#website` }, breadcrumb: { '@id': `${url}#breadcrumb` }, primaryImageOfPage: image,
        datePublished: published, dateModified: modified,
      },
      {
        '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Binder Tracker', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: crumb, item: url },
        ],
      },
      {
        '@type': 'Article', '@id': `${url}#article`, headline, description, image, inLanguage: 'en-GB',
        datePublished: published, dateModified: modified, mainEntityOfPage: { '@id': `${url}#page` }, author: publisher, publisher,
      },
    ],
  };
}

function citations(guide) {
  const number = new Map(guide.sources.map((s, i) => [s.id, i + 1]));
  const link = (id) => (number.has(id) ? `<sup class="cite"><a href="#source-${id}" aria-label="Source ${number.get(id)}">${number.get(id)}</a></sup>` : '');
  return { link, text: (html) => html.replace(/\s*\[([a-z0-9-]+)\]/g, (match, id) => (number.has(id) ? link(id) : match)) };
}

function guideSectionsHtml(entry, sealed, { today, sub = false, parts }) {
  const { guide } = entry;
  const cite = citations(guide);
  const name = escapeHtml(guide.name);
  const out = isOut(guide, today);
  const heading = (id, text) => (sub ? `<h3 class="about__sub" id="${id}">${text}</h3>` : `<h2 id="${id}">${text}</h2>`);
  const paragraphs = (list) => list.map((p) => `<p>${cite.text(p)}</p>`).join('\n  ');
  const none = (text) => `<span class="guide-products__none">${text}</span>`;
  const rates = ratesOf(sealed);
  const priced = Object.values(sealed?.products || {}).some((p) => p.usd > 0 || p.from > 0);
  const hasRetail = guide.products.some((p) => p.rrp?.length);

  const market = (p) => {
    const price = sealed?.products?.[p.tcg];
    if (price?.usd > 0) return `${formatMoney(price.usd, { currency: 'gbp', rates })}<small>${formatMoney(price.usd, { currency: 'usd' })}</small>`;
    if (price?.from > 0) return `Listed from ${formatMoney(price.from, { currency: 'gbp', rates })}<small>${formatMoney(price.from, { currency: 'usd' })}</small>`;
    return none('No sales yet');
  };
  const retail = (p) => (p.rrp?.length
    ? p.rrp.map((r) => `<span class="guide-products__rrp">${retailPrice(r.price, r.currency)}<small>${escapeHtml(r.store)}${cite.link(r.source)}</small></span>`).join('')
    : none('Not confirmed yet'));
  const productsSource = guide.sources.find((s) => s.id === guide.productsSource);

  const sections = {
    dates: () => guide.dates?.length && heading('guide-dates', `${name} key dates`)
      + `<ol class="guide-dates">${guide.dates.map((d) => `<li${d.date < today ? ' class="is-past"' : ''}><time datetime="${d.date}">${SHORT_DATE.format(utcDate(d.date))}</time><span>${cite.text(d.text)}${cite.link(d.source)}</span></li>`).join('')}</ol>`,
    about: () => guide.about?.length && heading('guide-about', `About ${name}`) + paragraphs(guide.about),
    previews: () => {
      if (!guide.previews?.length) return '';
      const sources = guide.sources.map((s) => s.id).filter((id) => guide.previews.some((c) => c.source === id));
      return heading('guide-cards', `${name} cards revealed so far`)
        + `<p>These are the ${plural(guide.previews.length, 'card')} shown so far, by card number${sources.map(cite.link).join('')}. The full list will be in the checklist.</p>`
        + `<ol class="card-index__list guide-cards">${guide.previews.map((c) => `<li><span>No. ${c.num}</span> ${escapeHtml(c.name)}${c.rarity ? ` <small>${escapeHtml(c.rarity)}</small>` : ''}</li>`).join('')}</ol>`;
    },
    products: () => {
      const notes = [];
      if (productsSource) notes.push(`What’s inside each product comes from ${escapeHtml(productsSource.publisher)}’s product listings${cite.link(productsSource.id)}.`);
      if (hasRetail) notes.push('Shop prices are official retail prices from the store named.');
      if (priced) notes.push(`Market prices are TCGplayer market prices${out ? '' : ' for pre-orders'}, updated ${priceDate(sealed.updated)}. They change daily, and pounds are converted from US dollars.`);
      return heading('guide-products', `${name} products and prices`)
        + '<div class="guide-products"><table>'
        + `<thead><tr><th scope="col">Product</th><th scope="col">What’s inside</th>${hasRetail ? '<th scope="col">Shop price</th>' : ''}${priced ? '<th scope="col">Market price</th>' : ''}</tr></thead>`
        + `<tbody>${guide.products.map((p) => '<tr>'
          + `<th scope="row"><a href="https://www.tcgplayer.com/product/${p.tcg}" rel="noopener">${p.name}</a></th>`
          + `<td data-label="What’s inside">${cite.text(p.contents)}</td>`
          + (hasRetail ? `<td class="guide-products__price" data-label="Shop price"><span class="guide-products__value">${retail(p)}</span></td>` : '')
          + (priced ? `<td class="guide-products__price" data-label="Market price"><span class="guide-products__value">${market(p)}</span></td>` : '')
          + '</tr>').join('')}</tbody></table></div>`
        + (notes.length ? `<p class="about__note">${notes.join(' ')}</p>` : '');
    },
    japanese: () => guide.japanese?.length && heading('guide-japan', `${name} in Japan`) + paragraphs(guide.japanese),
    faq: () => {
      const items = [
        [`When ${out ? 'did' : 'does'} ${name} come out?`, `${name} ${out ? 'came' : 'comes'} out on ${DAY_DATE.format(utcDate(guide.released))}${cite.link(guide.releaseSource)}.`],
        [`Is there a ${name} checklist?`, `Yes. Binder Tracker’s free ${name} checklist opens on this page as soon as the full card list is published. Like every checklist here, it has <b>no ads, no sign-up and no tracking</b>, works offline and keeps your collection on your own device.`],
        ...(guide.faq || []).map(({ q, a }) => [q, cite.text(a)]),
      ];
      return heading('guide-faq', `${name} FAQ`) + items.map(([q, a]) => `<h3 class="guide-q">${q}</h3><p>${a}</p>`).join('\n  ');
    },
    sources: () => heading('guide-sources', 'Sources')
      + `<p class="about__note">Facts checked on ${longDate(guide.updated)}.${out ? '' : ' Details can change before release.'}</p>`
      + sourceListHtml(guide.sources),
  };
  return parts.map((part) => sections[part]()).filter(Boolean).join('\n  ');
}

function moreSetsHtml(entry, catalog) {
  const sets = (catalog?.collections || [])
    .filter((c) => c.game === entry.game && c.series === entry.series && c.kind === 'expansion')
    .sort((a, b) => b.released.localeCompare(a.released))
    .slice(0, 6);
  if (!sets.length) return '';
  const series = escapeHtml(entry.series);
  return `<h2 id="guide-more">More ${series} checklists</h2>`
    + `<p>These ${series} sets already have free checklists:</p>`
    + `<ul class="guide-more">${sets.map((c) => `<li><a href="${c.id}/">${escapeHtml(c.name)}</a> <small>${releaseText(c.released)} · ${c.total} cards</small></li>`).join('')}</ul>`;
}

export async function comingSoonPage(entry, { siteUrl = DEFAULT_URL, today = isoToday() } = {}) {
  const { guide } = entry;
  const [template, sealed, catalog] = await Promise.all([readFile(join(TEMPLATES, 'guide.html'), 'utf8'), sealedPrices(entry.id), loadCatalog()]);
  const game = GAMES[entry.game];
  const url = `${siteUrl}${entry.id}/`;
  const ogImage = `${siteUrl}${await ogImageFor(entry.id)}`;
  const out = isOut(guide, today);
  const cite = citations(guide);
  const name = escapeHtml(guide.name);
  const seo = guide.seo || {};
  const headline = `${game.name} ${guide.name}: release date, products and prices`;
  const title = seo.title || `${game.name} ${guide.name} Release Date, Products & Prices · Checklist Coming Soon`;
  const description = seo.description || `${game.name} ${guide.name} ${out ? 'came' : 'comes'} out on ${longDate(guide.released)}. Every product, what’s inside and today’s prices, plus a free checklist at launch with no ads, no sign-up and no tracking.`;
  const modified = [guide.updated, sealed?.updated].filter(Boolean).sort().at(-1);
  const jsonLd = articleJsonLd({ url, siteUrl, crumb: `${game.name} ${guide.name}`, headline, description, image: ogImage, published: guide.published, modified });
  const body = [
    `<p class="guide-kicker"><span class="soon-pill">${out ? 'Out now · checklist coming soon' : 'Checklist coming soon'}</span></p>`,
    `<h1>${name}: release date, products and prices</h1>`,
    `<p class="doc__updated">${escapeHtml(game.name)} · ${escapeHtml(entry.series)} series · Facts checked ${longDate(guide.updated)}</p>`,
    `<p class="doc__lead"><b>${name} ${out ? 'came' : 'comes'} out on ${DAY_DATE.format(utcDate(guide.released))}.</b>${cite.link(guide.releaseSource)} The free ${name} checklist opens on this page as soon as the full card list is published, with no ads, no sign-up and no tracking.</p>`,
    guideSectionsHtml(entry, sealed, { today, parts: ['dates', 'about', 'previews', 'products', 'japanese', 'faq'] }),
    moreSetsHtml(entry, catalog),
    guideSectionsHtml(entry, sealed, { today, parts: ['sources'] }),
    '<p class="doc__back"><a class="btn btn--ghost" href="./">← Back to Binder Tracker</a></p>',
  ].filter(Boolean).join('\n  ');
  const html = fill(template, {
    title: `${title} | Binder Tracker`,
    description,
    url,
    ogTitle: headline,
    ogDescription: description,
    twitterDescription: description,
    ogImage,
    imageAlt: `${guide.name} release date, products and prices`,
    jsonLd: jsonScript(jsonLd),
    body,
    disclaimer: game.disclaimer,
  });
  return prefixUrls(html, '../'.repeat(entry.id.split('/').length));
}

export async function guidePage(guide, { siteUrl = DEFAULT_URL } = {}) {
  const template = await readFile(join(TEMPLATES, 'guide.html'), 'utf8');
  const game = GAMES[guide.game];
  const url = `${siteUrl}${guide.id}/`;
  const ogImage = `${siteUrl}${await ogImageFor(guide.id)}`;
  const cite = citations(guide);
  const sections = guide.sections.map((s) => [
    `<h2 id="${s.id}">${s.heading}</h2>`,
    ...(s.paragraphs || []).map((p) => `<p>${cite.text(p)}</p>`),
    s.list ? `<ul>${s.list.map((item) => `<li>${cite.text(item)}</li>`).join('')}</ul>` : '',
  ].filter(Boolean).join('\n  '));
  const contents = [...guide.sections.map((s) => [s.id, s.heading]), ['guide-faq', 'FAQ'], ['guide-sources', 'Sources']];
  const body = [
    `<h1>${guide.headline}</h1>`,
    `<p class="doc__updated">${escapeHtml(game.name)} · Facts checked ${longDate(guide.updated)}</p>`,
    `<p class="doc__lead">${cite.text(guide.lead)}</p>`,
    `<nav class="guide-toc" aria-labelledby="guide-toc-title"><h2 id="guide-toc-title">On this page</h2><ol>${contents.map(([id, text]) => `<li><a href="#${id}">${text}</a></li>`).join('')}</ol></nav>`,
    ...sections,
    '<h2 id="guide-faq">FAQ</h2>',
    ...guide.faq.map(({ q, a }) => `<h3 class="guide-q">${q}</h3><p>${cite.text(a)}</p>`),
    '<h2 id="guide-sources">Sources</h2>',
    `<p class="about__note">Facts checked on ${longDate(guide.updated)}.</p>`,
    sourceListHtml(guide.sources),
    '<p class="doc__back"><a class="btn btn--ghost" href="./">← Back to Binder Tracker</a></p>',
  ].join('\n  ');
  const html = fill(template, {
    title: `${guide.title} | Binder Tracker`,
    description: guide.description,
    url,
    ogTitle: guide.title,
    ogDescription: guide.description,
    twitterDescription: guide.description,
    ogImage,
    imageAlt: guide.title,
    jsonLd: jsonScript(articleJsonLd({ url, siteUrl, crumb: guide.label, headline: guide.title, description: guide.description, image: ogImage, published: guide.published, modified: guide.updated })),
    body,
    disclaimer: game.disclaimer,
  }).replace(`<a href="${guide.id}/">`, `<a href="${guide.id}/" aria-current="page">`);
  return prefixUrls(html, '../'.repeat(guide.id.split('/').length));
}

export async function collectionPage(id, { siteUrl = DEFAULT_URL, today = isoToday() } = {}) {
  const [template, raw, prices] = await Promise.all([readFile(join(TEMPLATES, 'collection.html'), 'utf8'), loadRaw(id), readJson(join(dataDir(id), 'prices.json'))]);
  const entry = CONFIG.find((e) => e.id === id);
  const launchGuide = entry?.guide ? guideSectionsHtml(entry, await sealedPrices(id), { today, sub: true, parts: ['dates', 'products', 'sources'] }) : '';
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
    'Export and import by link, code, QR code or file',
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
    setGuide: [setGuideHtml(model, prices), launchGuide].filter(Boolean).join('\n  '),
    robots: model.cards.length ? 'index, follow, max-image-preview:large' : 'noindex',
    disclaimer: game.disclaimer,
    setArt: (await exists(join(PUBLIC, `img/sets/${id}/logo.webp`))) ? `<img class="set-hero__logo" src="img/sets/${id}/logo.webp" alt="" decoding="async">` : '',
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

function soonTileHtml({ entry, logo }, today) {
  const { guide } = entry;
  const name = escapeHtml(guide.name);
  const out = isOut(guide, today);
  const search = [guide.name, entry.syncKey, entry.series, entry.slug.replace(/-/g, ' '), 'coming soon'].join(' ');
  const art = logo
    ? `<img class="set-tile__logo" src="${logo}" alt="" loading="lazy" decoding="async">`
    : `<span class="set-tile__wordmark">${name}</span>`;
  return `<a class="set-tile set-tile--soon" href="${entry.id}/" data-search="${escapeHtml(search)}">`
    + `<span class="set-tile__art">${art}</span>`
    + '<span class="set-tile__body">'
    + `<span class="set-tile__name">${name}</span>`
    + `<span class="set-tile__meta">${out ? 'Out now' : `Out ${SHORT_DATE.format(utcDate(guide.released))}`}</span>`
    + `<span class="set-tile__soon"><span class="soon-pill">${out ? 'Checklist coming soon' : 'Coming soon'}</span></span>`
    + '</span></a>';
}

const KIND_HEADINGS = { promo: 'Promos', energy: 'Energy' };
const OPEN_SERIES = 2;

function collectionsHtml(catalog, values = new Map(), soon = [], today = isoToday()) {
  const parts = [];
  for (const game of catalog.games) {
    const sets = catalog.collections.filter((c) => c.game === game.id);
    const upcoming = soon.filter((s) => s.entry.game === game.id);
    if (!sets.length && !upcoming.length) continue;
    const title = game.logo
      ? `<img class="home-game__logo" src="${game.logo}" alt="${escapeHtml(game.name)}"><span class="home-game__tagline" aria-hidden="true">Trading Card Game</span>`
      : escapeHtml(game.name);
    parts.push(`<section class="home-game" aria-labelledby="game-${game.id}"><h2 class="home-game__title" id="game-${game.id}">${title}</h2>`);
    let shown = 0;
    for (const series of game.series) {
      const inSeries = sets.filter((c) => c.series === series);
      const soonTiles = upcoming.filter((s) => s.entry.series === series).map((s) => soonTileHtml(s, today));
      if (!inSeries.length && !soonTiles.length) continue;
      const expansions = inSeries.filter((c) => c.kind === 'expansion');
      const main = expansions.length ? expansions : inSeries;
      const extras = expansions.length ? inSeries.filter((c) => c.kind !== 'expansion') : [];
      const open = shown++ < OPEN_SERIES;
      const count = inSeries.length + soonTiles.length;
      parts.push(`<details class="home-series" data-series${open ? ' open data-open' : ''}>`
        + `<summary class="home-series__head"><h3 class="home-series__title">${escapeHtml(series)}</h3><span class="home-series__count">${count === 1 ? '1 set' : `${count} sets`}</span></summary>`
        + `<div class="set-grid">${soonTiles.join('')}${main.map((c) => tileHtml(c, values.get(c.id))).join('')}</div>`
        + (extras.length ? `<h4 class="home-series__sub">${[...new Set(extras.map((c) => KIND_HEADINGS[c.kind] || 'More'))].join(' &amp; ')}</h4><div class="set-grid set-grid--small">${extras.map((c) => tileHtml(c, values.get(c.id))).join('')}</div>` : '')
        + '</details>');
    }
    parts.push('</section>');
  }
  return parts.join('\n');
}

export async function homePage({ siteUrl = DEFAULT_URL, today = isoToday() } = {}) {
  const [template, catalog] = await Promise.all([readFile(join(TEMPLATES, 'index.html'), 'utf8'), loadCatalog()]);
  const setCount = catalog.collections.filter((c) => c.kind === 'expansion').length;
  const soon = await Promise.all(COMING_SOON.map(async (entry) => {
    const logo = `img/sets/${entry.id}/logo.webp`;
    return { entry, logo: (await exists(join(PUBLIC, logo))) ? logo : null };
  }));
  return fill(template, { collections: collectionsHtml(catalog, await setValues(catalog), soon, today), setCount }).split(DEFAULT_URL).join(siteUrl);
}

export async function portfolioPage({ siteUrl = DEFAULT_URL } = {}) {
  const template = await readFile(join(TEMPLATES, 'portfolio.html'), 'utf8');
  return prefixUrls(template.split(DEFAULT_URL).join(siteUrl), '../');
}

export async function tradePage({ siteUrl = DEFAULT_URL } = {}) {
  const template = await readFile(join(TEMPLATES, 'trade.html'), 'utf8');
  return prefixUrls(template.split(DEFAULT_URL).join(siteUrl), '../');
}

export async function listPage({ siteUrl = DEFAULT_URL } = {}) {
  const template = await readFile(join(TEMPLATES, 'list.html'), 'utf8');
  return prefixUrls(template.split(DEFAULT_URL).join(siteUrl), '../');
}

export async function sharedPage({ siteUrl = DEFAULT_URL } = {}) {
  const template = await readFile(join(TEMPLATES, 'shared.html'), 'utf8');
  return prefixUrls(template.split(DEFAULT_URL).join(siteUrl), '../');
}

async function docUpdated(file) {
  const m = /Last updated: (\d{1,2}) (\w+) (\d{4})/.exec(await readFile(join(PUBLIC, file), 'utf8'));
  if (!m) throw new Error(`${file}: "Last updated" date not found`);
  const month = new Date(`${m[2]} 1, 2000`).getMonth();
  if (Number.isNaN(month)) throw new Error(`${file}: unknown month ${m[2]}`);
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1]))).toISOString().slice(0, 10);
}

export async function sitemap({ siteUrl = DEFAULT_URL, today = new Date().toISOString().slice(0, 10) } = {}) {
  const catalog = await loadCatalog();
  const soon = await Promise.all(COMING_SOON.map(async (entry) => {
    const sealed = await sealedPrices(entry.id);
    return [`${entry.id}/`, 'weekly', '0.9', [entry.guide.updated, sealed?.updated].filter(Boolean).sort().at(-1)];
  }));
  const urls = [
    ['', 'weekly', '1.0', today],
    ...soon,
    ...GUIDES.map((g) => [`${g.id}/`, 'monthly', '0.8', g.updated]),
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
