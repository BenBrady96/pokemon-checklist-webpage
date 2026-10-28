import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COMING_SOON, CONFIG, GAMES, GAME_PAGES, LIVE_GAMES, dataDir, loadCatalog, loadModel, loadRaw } from './collections.mjs';
import { GUIDES } from '../../config/guides/index.mjs';
import { ANALYTICS_TOKEN, DEFAULT_URL, PUBLIC, TEMPLATES, exists, readJson } from './util.mjs';
import { formatMoney, priceDate, ratesOf, tierValues } from '../../public/js/core/pricing.js';
import { releaseText, tileHtml } from '../../public/js/shared/tiles.js';
import { SOCIALS, socialButtons, socialMenuItems } from '../../public/js/shared/socials.js';

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

export const analyticsOn = (siteUrl) => Boolean(ANALYTICS_TOKEN) && siteUrl.startsWith('https:');

export function withAnalytics(html, siteUrl) {
  if (!analyticsOn(siteUrl)) return html;
  const out = html
    .replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*?script-src [^;"]*)/, '$1 https://static.cloudflareinsights.com')
    .replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*?connect-src [^;"]*)/, '$1 https://cloudflareinsights.com')
    .replace('</head>', `  <script src="${siteUrl}js/shared/analytics.js" data-token="${ANALYTICS_TOKEN}" defer></script>\n</head>`);
  if (!out.includes('https://static.cloudflareinsights.com') || !out.includes(' https://cloudflareinsights.com') || !out.includes('js/shared/analytics.js')) {
    throw new Error('withAnalytics: page needs a Content-Security-Policy with script-src and connect-src, and a </head>');
  }
  return out;
}

const prefixUrls = (html, prefix) => html.replace(/\b(href|src)="(?![a-z][a-z0-9+.-]*:|#|\/)([^"]*)"/gi, (_, attr, url) => `${attr}="${prefix}${url === './' ? '' : url}"`);

const jsonScript = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

async function ogImageFor(id) {
  const path = `img/og/${id}.jpg`;
  return (await exists(join(PUBLIC, path))) ? path : 'img/og-image.jpg';
}

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const longDate = (date) => LONG_DATE.format(new Date(`${date}T00:00:00Z`));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
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
  const [variantOne, variantMany] = model.game.VARIANT_NOUN || ['variant', 'variants'];
  const items = [[
    `How many cards are in ${name}?`,
    `<p>${name} has ${plural(model.cardCount, 'card')}${variants ? `, plus ${plural(variants, variantOne, variantMany)}, so there are ${model.cards.length} to collect in all` : ''}.</p>`
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
  if (rarities.length > 1) items.push([`What rarities are in ${name}?`, `<p>Counting each card once, without ${variantMany}:</p>${tally(rarities)}`]);
  if (model.released && !['promo', 'energy'].includes(model.kind)) {
    const series = model.kind === 'expansion' && model.series && model.series !== 'Other' && model.game.SERIES_NOUN !== 'year' ? `, as part of the ${escapeHtml(model.series)} ${model.game.SERIES_NOUN || 'series'}` : '';
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
const whenText = (guide, out, format = DAY_DATE) => (guide.releaseWindow && !out ? `comes out ${guide.releaseWindow.long}` : `${out ? 'came' : 'comes'} out on ${format.format(utcDate(guide.released))}`);
const whenShort = (guide) => guide.releaseWindow?.short || SHORT_DATE.format(utcDate(guide.released));
const guideTopic = (guide) => (guide.products.length ? 'release date, products and prices' : 'release date and what we know so far');

const sourceListHtml = (sources) => `<ol class="guide-sources">${sources.map((s) => `<li id="source-${s.id}">${escapeHtml(s.publisher)}: <a href="${escapeHtml(s.url)}" rel="noopener">${escapeHtml(s.title)}</a>${s.date ? `, ${longDate(s.date)}` : ''}</li>`).join('')}</ol>`;

function articleJsonLd({ url, siteUrl, crumb, parent, headline, description, image, published, modified }) {
  const publisher = { '@type': 'Organization', name: 'Binder Tracker', url: siteUrl };
  const crumbs = [{ name: 'Binder Tracker', item: siteUrl }, ...(parent ? [parent] : []), { name: crumb, item: url }];
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
        itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })),
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
      if (!guide.products.length) {
        return heading('guide-products', `${name} products`)
          + `<p>No ${name} products have been announced yet. They’ll be listed here, with what’s inside each one and its price, as soon as they are.</p>`;
      }
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
        [`When ${out ? 'did' : 'does'} ${name} come out?`, `${name} ${whenText(guide, out)}${cite.link(guide.releaseSource)}.${guide.releaseWindow && !out ? ' The exact date hasn’t been announced yet.' : ''}`],
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

const linkMeta = (c, today) => {
  if (!c.soon) return `${releaseText(c.released)} · ${c.total} cards`;
  return `${today >= c.released ? 'Out now' : `Out ${c.when || SHORT_DATE.format(utcDate(c.released))}`} · checklist coming soon`;
};
const setLinkHtml = (c, today) => `<li><a href="${c.id}/">${escapeHtml(c.name)}</a> <small>${linkMeta(c, today)}</small></li>`;

function moreSetsHtml(entry, catalog) {
  const expansions = (catalog?.collections || []).filter((c) => c.game === entry.game && c.kind === 'expansion');
  const inSeries = expansions.filter((c) => c.series === entry.series);
  const sets = (inSeries.length ? inSeries : expansions)
    .sort((a, b) => b.released.localeCompare(a.released))
    .slice(0, 6);
  if (!sets.length) return '';
  const series = escapeHtml(inSeries.length ? entry.series : GAMES[entry.game].name);
  return `<h2 id="guide-more">More ${series} checklists</h2>`
    + `<p>These ${inSeries.length ? `${series} ` : ''}sets already have free checklists:</p>`
    + `<ul class="guide-more">${sets.map((c) => setLinkHtml(c)).join('')}</ul>`;
}

const RELATED_SETS = 8;
const byRelease = (a, b) => a.released.localeCompare(b.released) || a.name.localeCompare(b.name);

function relatedSetsHtml(id, catalog, today) {
  const current = catalog?.collections.find((c) => c.id === id);
  if (!current) return '';
  const soon = COMING_SOON.map((e) => ({ id: e.id, game: e.game, name: e.guide.name, series: e.series, kind: 'expansion', released: e.guide.released, when: e.guide.releaseWindow?.short, soon: true }));
  const pool = [...catalog.collections.filter((c) => c.total > 0), ...soon].filter((c) => c.game === current.game && c.id !== id);
  const inSeries = pool.filter((c) => c.series === current.series);
  const others = inSeries.length ? inSeries : pool.filter((c) => c.kind === current.kind);
  const line = [current, ...pool.filter((c) => c.kind === current.kind && (c.kind === 'expansion' || c.series === current.series))].sort(byRelease);
  const at = line.indexOf(current);
  const prev = line[at - 1];
  const next = line[at + 1];
  const gap = (c) => Math.abs(utcDate(c.released) - utcDate(current.released));
  const listed = others
    .filter((c) => c !== prev && c !== next)
    .sort((a, b) => gap(a) - gap(b))
    .slice(0, RELATED_SETS)
    .sort((a, b) => byRelease(b, a));
  if (!prev && !next && !listed.length) return '';
  const group = inSeries.length && current.series !== 'Other' ? current.series : GAMES[current.game].name;
  const pager = prev || next
    ? '<nav class="set-more__pager" aria-label="Previous and next set">'
      + (prev ? `<a class="set-more__prev" href="${prev.id}/">← Previous: ${escapeHtml(prev.name)}</a>` : '')
      + (next ? `<a class="set-more__next" href="${next.id}/">Next: ${escapeHtml(next.name)} →</a>` : '')
      + '</nav>'
    : '';
  return `<h3 class="about__sub">More ${escapeHtml(group)} checklists</h3>`
    + pager
    + (listed.length ? `<ul class="set-more">${listed.map((c) => setLinkHtml(c, today)).join('')}</ul>` : '');
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
  const topic = guideTopic(guide);
  const headline = `${game.name} ${guide.name}: ${topic}`;
  const title = seo.title || (guide.products.length
    ? `${game.name} ${guide.name} Release Date, Products & Prices · Checklist Coming Soon`
    : `${game.name} ${guide.name} Release Date & What We Know · Checklist Coming Soon`);
  const description = seo.description || (guide.products.length
    ? `${game.name} ${guide.name} ${whenText(guide, out, LONG_DATE)}. Every product, what’s inside and today’s prices, plus a free checklist at launch with no ads, no sign-up and no tracking.`
    : `${game.name} ${guide.name} ${whenText(guide, out, LONG_DATE)}. Everything revealed so far, plus a free checklist at launch with no ads, no sign-up and no tracking.`);
  const modified = [guide.updated, sealed?.updated].filter(Boolean).sort().at(-1);
  const jsonLd = articleJsonLd({ url, siteUrl, crumb: guide.name, parent: { name: game.name, item: `${siteUrl}${entry.game}/` }, headline, description, image: ogImage, published: guide.published, modified });
  const body = [
    `<p class="guide-kicker"><span class="soon-pill">${out ? 'Out now · checklist coming soon' : 'Checklist coming soon'}</span></p>`,
    `<h1>${name}: ${topic}</h1>`,
    `<p class="doc__updated">${escapeHtml(game.name)} · ${game.SERIES_NOUN === 'year' ? '' : `${escapeHtml(entry.series)} ${game.SERIES_NOUN || 'series'} · `}Facts checked ${longDate(guide.updated)}</p>`,
    `<p class="doc__lead"><b>${name} ${whenText(guide, out)}.</b>${cite.link(guide.releaseSource)} The free ${name} checklist opens on this page as soon as the full card list is published, with no ads, no sign-up and no tracking.</p>`,
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
    imageAlt: `${guide.name} ${topic}`,
    jsonLd: jsonScript(jsonLd),
    body,
    disclaimer: game.disclaimer,
    footerGuides: footerGuides([entry.game]),
    footerSocials,
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
    footerGuides: footerGuides([guide.game]),
    footerSocials,
  }).replace(`<a href="${guide.id}/">`, `<a href="${guide.id}/" aria-current="page">`);
  return prefixUrls(html, '../'.repeat(guide.id.split('/').length));
}

export async function collectionPage(id, { siteUrl = DEFAULT_URL, today = isoToday() } = {}) {
  const [template, raw, prices, catalog] = await Promise.all([readFile(join(TEMPLATES, 'collection.html'), 'utf8'), loadRaw(id), readJson(join(dataDir(id), 'prices.json')), loadCatalog()]);
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
          { '@type': 'ListItem', position: 2, name: game.name, item: `${siteUrl}${raw.game}/` },
          { '@type': 'ListItem', position: 3, name: `${game.name} ${raw.name}`, item: url },
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
    setGuide: [setGuideHtml(model, prices), launchGuide, relatedSetsHtml(id, catalog, today)].filter(Boolean).join('\n  '),
    robots: model.cards.length ? 'index, follow, max-image-preview:large' : 'noindex',
    disclaimer: game.disclaimer,
    game: raw.game,
    gameHome: `${raw.game}/`,
    footerGuides: footerGuides([raw.game]),
    footerSocials,
    menuGuides: menuGuides([raw.game]),
    menuSocials,
    helpGuides: helpGuides([raw.game]),
    gameSymbols: await readFile(join(TEMPLATES, 'symbols', `${raw.game}.svg`), 'utf8').catch(() => ''),
    setArt: (await exists(join(PUBLIC, `img/sets/${id}/logo.webp`))) ? `<img class="set-hero__logo" src="img/sets/${id}/logo.webp" alt="" decoding="async">` : '',
    setMeta: [`<a href="${raw.game}/">${escapeHtml(game.name)}</a>`, model.released ? releaseText(model.released) : '', `${complete} cards`].filter(Boolean).join(' · '),
  });
  return prefixUrls(html, '../'.repeat(id.split('/').length));
}

export async function setValues(catalog) {
  const values = new Map();
  await Promise.all(catalog.collections.map(async (c) => {
    const [model, prices] = await Promise.all([loadModel(c.id), readJson(join(dataDir(c.id), 'prices.json'))]);
    const value = tierValues(model, prices);
    if (value) values.set(c.id, value);
  }));
  return values;
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
    + `<span class="set-tile__meta">${out ? 'Out now' : `Out ${whenShort(guide)}`}</span>`
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
    const tagline = GAMES[game.id]?.tagline;
    const title = game.logo
      ? `<img class="home-game__logo" src="${game.logo}" alt="${escapeHtml(game.name)}">${tagline ? `<span class="home-game__tagline" aria-hidden="true">${escapeHtml(tagline)}</span>` : ''}`
      : escapeHtml(game.name);
    parts.push(`<section class="home-game" aria-labelledby="game-${game.id}"><h2 class="home-game__title" id="game-${game.id}">${title}</h2>`);
    let shown = 0;
    for (const series of game.series) {
      const inSeries = sets.filter((c) => c.series === series);
      const soonTiles = upcoming.filter((s) => s.entry.series === series).map((s) => soonTileHtml(s, today));
      if (!inSeries.length && !soonTiles.length) continue;
      const open = shown++ < OPEN_SERIES;
      const count = inSeries.length + soonTiles.length;
      const tiles = (list) => list.map((c) => tileHtml(c, values.get(c.id))).join('');
      let body;
      const kindGroups = GAMES[game.id]?.KIND_GROUPS;
      if (kindGroups) {
        const blocks = kindGroups.map(([kind, heading]) => [heading, inSeries.filter((c) => c.kind === kind), kind === 'expansion']).filter(([, list]) => list.length);
        body = blocks.length <= 1
          ? `<div class="set-grid">${soonTiles.join('')}${tiles(blocks[0]?.[1] || [])}</div>`
          : blocks.map(([heading, list, main]) => `<h4 class="home-series__sub">${escapeHtml(heading)}</h4><div class="set-grid${main ? '' : ' set-grid--small'}">${main ? soonTiles.join('') : ''}${tiles(list)}</div>`).join('');
      } else {
        const expansions = inSeries.filter((c) => c.kind === 'expansion');
        const main = expansions.length ? expansions : inSeries;
        const extras = expansions.length ? inSeries.filter((c) => c.kind !== 'expansion') : [];
        body = `<div class="set-grid">${soonTiles.join('')}${tiles(main)}</div>`
          + (extras.length ? `<h4 class="home-series__sub">${[...new Set(extras.map((c) => KIND_HEADINGS[c.kind] || 'More'))].join(' &amp; ')}</h4><div class="set-grid set-grid--small">${tiles(extras)}</div>` : '');
      }
      parts.push(`<details class="home-series" data-series${open ? ' open data-open' : ''}>`
        + `<summary class="home-series__head"><h3 class="home-series__title">${escapeHtml(series)}</h3><span class="home-series__count">${count === 1 ? '1 set' : `${count} sets`}</span></summary>`
        + body
        + '</details>');
    }
    parts.push('</section>');
  }
  return parts.join('\n');
}

const guidesFor = (games) => GUIDES.filter((g) => games.includes(g.game));
const footerGuides = (games, full = false) => guidesFor(games).map((g) => `    <a href="${g.id}/">${escapeHtml(full ? g.labelFull || g.label : g.label)}</a>\n`).join('');
const menuGuides = (games) => guidesFor(games)
  .map((g) => `        <a class="menu__item" href="${g.id}/"><svg><use href="#i-shield"/></svg><span><b>${escapeHtml(g.label)}</b><small>${escapeHtml(g.menu)}</small></span></a>\n`)
  .join('');
export const footerSocials = `  <div class="footer-social"><span class="footer-social__label">Follow Binder Tracker</span>${socialButtons()}</div>`;
const menuSocials = `      <div class="menu__group">\n        <h3 class="menu__label">Follow us</h3>\n${socialMenuItems().map((a) => `        ${a}\n`).join('')}      </div>`;
function helpGuides(games) {
  const items = guidesFor(games).map((g) => `        <li>Not sure a card is real? Read <a href="${g.id}/">${escapeHtml(g.help)}</a> before you buy or trade.</li>\n`).join('');
  return items ? `      <h3>Buying and trading cards</h3>\n      <ul>\n${items}      </ul>\n` : '';
}
const disclaimers = (games) => games.map((g) => GAMES[g].disclaimer).join(' ');

const liveGames = (catalog) => LIVE_GAMES.map((id) => catalog.games.find((g) => g.id === id)).filter(Boolean);
const gameNames = (catalog) => list(liveGames(catalog).map((g) => GAMES[g.id].shortName));

const FEATURES = [
  'No ads, no sign-up and no tracking',
  'Copy counts for duplicates and trades',
  'Grid, list and binder page views',
  'Card scanner that runs on your device',
  'Collection value from TCGplayer market prices',
  'Trade codes to compare collections with friends',
  'Works offline',
  'Export and import by link, code, QR code or file',
];

function gameButtonsHtml(catalog) {
  return liveGames(catalog).map((g) => {
    const count = catalog.collections.filter((c) => c.game === g.id).length;
    const logo = g.logo ? `<img class="game-btn__logo" src="${g.logo}" alt="" decoding="async">` : '';
    return `      <a class="game-btn" href="${g.id}/" data-game="${g.id}">`
      + `<span class="game-btn__art">${logo}</span>`
      + `<span class="game-btn__name">${escapeHtml(g.name)}</span>`
      + `<span class="game-btn__meta">${count} checklists · ${escapeHtml(GAME_PAGES[g.id].span)}</span>`
      + '<span class="game-btn__mine" hidden></span>'
      + '</a>';
  }).join('\n');
}

export async function rootPage({ siteUrl = DEFAULT_URL } = {}) {
  const [template, catalog] = await Promise.all([readFile(join(TEMPLATES, 'index.html'), 'utf8'), loadCatalog()]);
  const games = liveGames(catalog).map((g) => g.id);
  const names = gameNames(catalog);
  const description = `Free ${names} card checklists for every English set. Track master sets, duplicates and your collection’s value. No ads, no sign-up.`;
  const ogDescription = `Free ${names} card checklists for every English set, with no ads, no sign-up and no tracking. Tick off your cards, chase master sets, count duplicates, scan cards with your camera and see what your collection is worth.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${siteUrl}#organization`, name: 'Binder Tracker', url: siteUrl, logo: `${siteUrl}img/icons/icon-512.png`, sameAs: SOCIALS.map((s) => s.url) },
      {
        '@type': 'WebSite', '@id': `${siteUrl}#website`, url: siteUrl, name: 'Binder Tracker', alternateName: `Binder Tracker ${names} Checklists`,
        description: `Free ${names} card checklists and collection tracker, with no ads, no sign-up and no tracking.`, inLanguage: 'en-GB', publisher: { '@id': `${siteUrl}#organization` },
      },
      {
        '@type': 'WebApplication', '@id': `${siteUrl}#app`, name: 'Binder Tracker', url: siteUrl,
        description: `Checklists for every English ${names} set, with copy counts, binder pages, a card scanner and collection values.`,
        applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, inLanguage: 'en-GB',
        image: `${siteUrl}img/og-image.jpg`, offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
        featureList: [FEATURES[0], ...liveGames(catalog).map((g) => `${g.name} checklists, ${GAME_PAGES[g.id].span}`), ...FEATURES.slice(1)],
      },
    ],
  };
  const about = [
    `Binder Tracker is a free card checklist and collection tracker for ${escapeHtml(names)}. Every set has its own checklist, with card images, rarities and TCGplayer prices.`,
    ...liveGames(catalog).map((g) => `<a href="${g.id}/"><b>${escapeHtml(g.name)} checklists</b></a>: ${GAME_PAGES[g.id].rootText}`),
    'Scan a card with your camera to add it, count your duplicates, see what your collection is worth in pounds, dollars or euros, and swap trade codes with friends to check a trade is fair.',
    'There are <b>no ads, no sign-up and no tracking</b>. Your collection stays on your device, it works on phones and computers even offline, and <b>Export or share</b> moves it to another device as a link, code, QR code or file.',
  ];
  return fill(template, {
    title: `Free ${names} Card Checklists & Collection Tracker | Binder Tracker`,
    description,
    ogTitle: `Binder Tracker · Free ${names} Card Checklists & Collection Tracker`,
    ogDescription,
    twitterDescription: `Free checklists for every English ${names} set. No ads, no sign-up, no tracking.`,
    imageAlt: `Binder Tracker: card checklists for ${names}`,
    jsonLd: jsonScript(jsonLd),
    heroText: `Free checklists for every English ${names} set. Tick off what you own, track spare copies and see what your collection is worth. No ads, no sign-up, no tracking.`,
    games: gameButtonsHtml(catalog),
    aboutTitle: 'About Binder Tracker',
    aboutHtml: about.map((p) => `  <p>${p}</p>`).join('\n'),
    footerGuides: footerGuides(games, games.length > 1),
    footerSocials,
    menuGuides: menuGuides(games),
    menuSocials,
    disclaimer: disclaimers(games),
  }).split(DEFAULT_URL).join(siteUrl);
}

async function sitePage(file, siteUrl) {
  const [template, catalog] = await Promise.all([readFile(join(TEMPLATES, file), 'utf8'), loadCatalog()]);
  const games = liveGames(catalog).map((g) => g.id);
  const html = fill(template, {
    names: gameNames(catalog),
    tcg: games.length > 1 ? gameNames(catalog) : `${GAMES[games[0]].shortName} TCG`,
    disclaimer: disclaimers(games),
    footerGuides: footerGuides(games, games.length > 1),
    footerSocials,
  });
  return prefixUrls(html.split(DEFAULT_URL).join(siteUrl), '../');
}

export async function gamePage(gameId, { siteUrl = DEFAULT_URL, today = isoToday() } = {}) {
  const [template, full] = await Promise.all([readFile(join(TEMPLATES, 'game.html'), 'utf8'), loadCatalog()]);
  const game = GAMES[gameId];
  const page = GAME_PAGES[gameId];
  const catalog = { games: full.games.filter((g) => g.id === gameId), collections: full.collections.filter((c) => c.game === gameId) };
  const counts = { expansions: catalog.collections.filter((c) => c.kind === 'expansion').length, total: catalog.collections.length };
  const soon = await Promise.all(COMING_SOON.filter((e) => e.game === gameId).map(async (entry) => {
    const logo = `img/sets/${entry.id}/logo.webp`;
    return { entry, logo: (await exists(join(PUBLIC, logo))) ? logo : null };
  }));
  const url = `${siteUrl}${gameId}/`;
  const ogImage = `${siteUrl}${await ogImageFor(gameId)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': `${url}#page`, url, name: page.pageName, description: page.description, inLanguage: 'en-GB',
        isPartOf: { '@id': `${siteUrl}#website` }, breadcrumb: { '@id': `${url}#breadcrumb` }, primaryImageOfPage: ogImage,
      },
      {
        '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Binder Tracker', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: game.name, item: url },
        ],
      },
    ],
  };
  const html = fill(template, {
    title: `${page.title} | Binder Tracker`,
    description: page.description,
    url,
    ogTitle: page.ogTitle,
    ogDescription: page.ogDescription,
    twitterDescription: page.twitterDescription,
    ogImage,
    imageAlt: page.imageAlt,
    jsonLd: jsonScript(jsonLd),
    game: gameId,
    heroTitle: page.heroTitle,
    heroText: page.heroText(counts),
    searchPlaceholder: page.search,
    collections: collectionsHtml(catalog, await setValues(catalog), soon, today),
    aboutTitle: page.aboutTitle,
    aboutHtml: page.about.map((p) => `  <p>${p}</p>`).join('\n'),
    footerGuides: footerGuides([gameId]),
    footerSocials,
    menuGuides: menuGuides([gameId]),
    menuSocials,
    disclaimer: game.disclaimer,
  });
  return prefixUrls(html, '../');
}

export const portfolioPage = ({ siteUrl = DEFAULT_URL } = {}) => sitePage('portfolio.html', siteUrl);
export const tradePage = ({ siteUrl = DEFAULT_URL } = {}) => sitePage('trade.html', siteUrl);
export const listPage = ({ siteUrl = DEFAULT_URL } = {}) => sitePage('list.html', siteUrl);
export const sharedPage = ({ siteUrl = DEFAULT_URL } = {}) => sitePage('shared.html', siteUrl);

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
    ...liveGames(catalog).map((g) => [`${g.id}/`, 'weekly', '0.9', today]),
    ...soon,
    ...GUIDES.map((g) => [`${g.id}/`, 'monthly', '0.8', g.updated]),
    ['trade/', 'monthly', '0.7', today],
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
