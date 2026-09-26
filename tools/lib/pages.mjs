import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONFIG, GAMES, loadCatalog, loadModel, loadRaw } from './collections.mjs';
import { compileTheme, themeCss } from './theme.mjs';
import { ROOT, exists } from './util.mjs';

export const DEFAULT_URL = 'https://benbrady96.github.io/pokemon-checklist-webpage/';

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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

export const prefixUrls = (html, prefix) => html.replace(/\b(href|src)="(?![a-z][a-z0-9+.-]*:|#|\/)([^"]*)"/gi, (_, attr, url) => `${attr}="${prefix}${url === './' ? '' : url}"`);

const jsonScript = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

export async function ogImageFor(id) {
  const path = `img/og/${id}.jpg`;
  return (await exists(join(ROOT, path))) ? path : 'img/og-image.jpg';
}

export async function collectionPage(id, { siteUrl = DEFAULT_URL } = {}) {
  const [template, raw] = await Promise.all([readFile(join(ROOT, 'collection.html'), 'utf8'), loadRaw(id)]);
  const model = await loadModel(id, { raw });
  const entry = CONFIG.find((e) => e.id === id);
  const game = GAMES[raw.game];
  const theme = compileTheme(entry.theme);
  const url = `${siteUrl}${id}/`;
  const ogImage = `${siteUrl}${await ogImageFor(id)}`;
  const seo = raw.seo || {};
  const complete = model.getTier('complete').cards.length;
  const title = seo.title || `${game.name} ${raw.name} Checklist · All ${complete} Cards`;
  const description = seo.description || `Free checklist for the ${game.name} ${raw.name} set.`;
  const ogTitle = seo.ogTitle || `${game.name} ${raw.name} Checklist`;
  const features = [
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
  const css = themeCss(theme);
  const html = fill(template, {
    id,
    title: `${title} | Binder Tracker`,
    description,
    url,
    themeColor: theme.themeColor,
    ogTitle,
    ogDescription: seo.ogDescription || description,
    twitterDescription: seo.twitterDescription || seo.ogDescription || description,
    ogImage,
    imageAlt: seo.imageAlt || `${raw.name} card checklist`,
    themeStyle: css ? `<style>${css}</style>` : '',
    jsonLd: jsonScript(jsonLd),
    gameName: game.name,
    name: raw.name,
    aboutTitle: raw.about?.title || `About the ${raw.name} set`,
    aboutHtml: (raw.about?.paragraphs || []).map((p) => `<p>${p}</p>`).join('\n  '),
    disclaimer: game.disclaimer,
  });
  return prefixUrls(html, '../'.repeat(id.split('/').length));
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const releaseText = (date) => MONTH.format(new Date(`${date}T00:00:00Z`));

const tileStyle = (c) => Object.entries(c.tile).map(([k, v]) => `${k}:${v}`).join(';');

export function tileHtml(c) {
  const art = c.logo
    ? `<img class="set-tile__logo" src="${c.logo}" alt="" loading="lazy" decoding="async">`
    : c.cover?.symbol
      ? `<svg class="set-tile__mark" aria-hidden="true"><use href="#${c.cover.symbol}"/></svg>`
      : `<span class="set-tile__wordmark">${escapeHtml(c.name)}</span>`;
  return `<a class="set-tile" href="${c.id}/" data-id="${escapeHtml(c.id)}" style="${tileStyle(c)}">`
    + `<span class="set-tile__art">${art}</span>`
    + '<span class="set-tile__body">'
    + `<span class="set-tile__name">${escapeHtml(c.name)}</span>`
    + `<span class="set-tile__meta">${releaseText(c.released)} · ${c.total} cards</span>`
    + '<span class="set-tile__progress" hidden><span class="bar" aria-hidden="true"><i></i></span><span class="set-tile__count"></span></span>'
    + '</span></a>';
}

const KIND_HEADINGS = { promo: 'Promos', energy: 'Energy' };

export function collectionsHtml(catalog) {
  const parts = [];
  for (const game of catalog.games) {
    const sets = catalog.collections.filter((c) => c.game === game.id);
    if (!sets.length) continue;
    parts.push(`<section class="home-game" aria-labelledby="game-${game.id}"><h2 class="home__heading" id="game-${game.id}">${escapeHtml(game.name)}</h2>`);
    for (const series of game.series) {
      const inSeries = sets.filter((c) => c.series === series);
      if (!inSeries.length) continue;
      const main = inSeries.filter((c) => c.kind === 'expansion');
      const extras = inSeries.filter((c) => c.kind !== 'expansion');
      parts.push(`<section class="home-series" data-series><h3 class="home-series__title">${escapeHtml(series)}</h3>`
        + `<div class="set-grid">${main.map(tileHtml).join('')}</div>`
        + (extras.length ? `<h4 class="home-series__sub">${[...new Set(extras.map((c) => KIND_HEADINGS[c.kind] || 'More'))].join(' &amp; ')}</h4><div class="set-grid set-grid--small">${extras.map(tileHtml).join('')}</div>` : '')
        + '</section>');
    }
    parts.push('</section>');
  }
  return parts.join('\n');
}

export async function homePage({ siteUrl = DEFAULT_URL } = {}) {
  const [template, catalog] = await Promise.all([readFile(join(ROOT, 'index.html'), 'utf8'), loadCatalog()]);
  const setCount = catalog.collections.filter((c) => c.kind === 'expansion').length;
  return fill(template, { collections: collectionsHtml(catalog), setCount }).split(DEFAULT_URL).join(siteUrl);
}

export async function sitemap({ siteUrl = DEFAULT_URL, today = new Date().toISOString().slice(0, 10) } = {}) {
  const catalog = await loadCatalog();
  const urls = [
    ['', 'weekly', '1.0'],
    ...catalog.collections.map((c) => [`${c.id}/`, 'weekly', '0.9']),
    ['privacy.html', 'yearly', '0.3'],
    ['terms.html', 'yearly', '0.3'],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([path, freq, priority]) => `  <url>
    <loc>${siteUrl}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}
