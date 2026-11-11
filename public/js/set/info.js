import { COLLECTION, fetchSetViews, fetchView } from '../core/collection.js';
import { asset } from '../core/paths.js';
import { getPrefs as getSitePrefs } from '../core/storage.js';
import { TIER_DEFS } from '../core/model.js';
import { progressOf } from '../view/progress.js';
import { getQty } from './store.js';
import { rarityIcon } from './render.js';
import { priceOf, marketUsd, formatPrice, formatUsd, formatEur, pricesUpdated, cardmarketUpdated, hasCardmarket, priceCurrency, SYMBOLS } from '../core/pricing.js';
import { openDialog, escapeHTML } from '../shared/ui.js';
import { plural } from '../shared/format.js';

const INFO = COLLECTION.info;
const PACK_SECTIONS = new Set(INFO.packSections || []);
const PACK_COUNTS = COLLECTION.cards.filter((c) => PACK_SECTIONS.has(c.section))
  .reduce((m, c) => m.set(c.rarity, (m.get(c.rarity) || 0) + 1), new Map());

const roundOdds = (n) => (n < 10 ? Math.round(n) : n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 50) * 50 : Math.round(n / 500) * 500);
const oneIn = (n) => `about 1 in ${roundOdds(n).toLocaleString('en-GB')} packs`;

function whereToGet(card) {
  const parts = [];
  const packs = PACK_SECTIONS.has(card.section);
  if (!packs && card.note) parts.push(`<p><b>${escapeHTML(card.note)}</b></p>`);
  const text = INFO.sectionText?.[card.section];
  if (text) parts.push(...text);
  else if (packs && INFO.packText) parts.push(INFO.packText);
  if (INFO.details?.[card.id]) parts.push(`<p>${escapeHTML(INFO.details[card.id])}</p>`);
  if (packs && INFO.packProducts?.length) parts.push(`<p class="hint hint--small">Booster packs come in: ${INFO.packProducts.join(' · ')}.</p>`);
  return parts.join('');
}

function pullOdds(card) {
  if (!PACK_SECTIONS.has(card.section) || !INFO.pullOdds) return '';
  const rarity = COLLECTION.rarityById.get(card.rarity);
  const odds = INFO.pullOdds[card.rarity];
  const lines = [];
  if (INFO.oddsText?.[card.rarity]) lines.push(INFO.oddsText[card.rarity]);
  else if (odds) lines.push(`${rarity.name}: ${odds === 1 ? 'one in every pack' : oneIn(odds)}.`);
  if (odds) lines.push(`This exact card: ${oneIn(odds * PACK_COUNTS.get(card.rarity))}.`);
  if (!lines.length) return '';
  return `<section class="info__block"><h3 class="field__label">Pull odds</h3>`
    + `${lines.map((l) => `<p>${l}</p>`).join('')}`
    + '<p class="hint hint--small">Approximate, based on community pack openings.</p></section>';
}

function price(card) {
  const entry = priceOf(card.id);
  const shown = priceCurrency();
  const dollars = shown !== 'usd';
  const money = (usd) => (dollars ? formatPrice(usd, { approx: true }) : formatUsd(usd));
  let figure;
  if (entry?.eur != null) {
    const euros = shown !== 'eur';
    figure = `<p class="info__price">${euros ? `${formatPrice(marketUsd(card.id), { approx: true })}<small>${formatEur(entry.eur)}</small>` : formatEur(entry.eur)}</p>`
      + (entry.usd != null ? `<p class="info__also">TCGplayer market price <b>${money(entry.usd)}</b>${dollars ? ` (${formatUsd(entry.usd)})` : ''}</p>` : '')
      + `<p class="hint hint--small">Cardmarket price trend, ${cardmarketUpdated}.${euros ? ` The ${SYMBOLS[shown]} figure is converted from euros, so it’s approximate.` : ''}</p>`;
  } else if (entry?.usd != null) {
    const editions = entry.ed ? (COLLECTION.game.EDITIONS || []).filter((e) => entry.ed[e.id] != null) : [];
    figure = `<p class="info__price">${dollars ? `${formatPrice(entry.usd, { approx: true })}<small>${formatUsd(entry.usd)}</small>` : formatUsd(entry.usd)}</p>`
      + (editions.length ? `<p class="info__editions">${editions.map((e) => `${escapeHTML(e.name)} <b>${money(entry.ed[e.id])}</b>`).join(' · ')}</p>` : '')
      + `<p class="hint hint--small">${editions.length ? 'Lowest TCGplayer market price of its editions' : 'TCGplayer market price'}, ${pricesUpdated}.${hasCardmarket() ? ' Cardmarket has no price for it yet.' : ''}${dollars ? ` The ${SYMBOLS[shown]} figure is converted from US dollars, so it’s approximate.` : ''}</p>`;
  } else if (entry?.from != null) {
    figure = '<p class="info__price">No sales yet</p>'
      + `<p class="hint hint--small">Listed on TCGplayer from ${dollars ? `${formatPrice(entry.from, { approx: true })} (${formatUsd(entry.from)})` : formatUsd(entry.from)}, ${pricesUpdated}.</p>`;
  } else {
    figure = `<p class="info__price">No price yet</p><p class="hint hint--small">${hasCardmarket() ? 'Cardmarket and TCGplayer don’t' : 'TCGplayer doesn’t'} list this card yet.</p>`;
  }
  const links = COLLECTION.game.priceLinks(card, entry, card.searchQuery)
    .map((l) => `<a class="btn btn--ghost btn--sm" href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label}<svg><use href="#i-external"/></svg></a>`);
  return `<section class="info__block"><h3 class="field__label">Market price</h3>${figure}`
    + `<div class="info__links">${links.join('')}</div></section>`;
}

function tierText(card) {
  if (COLLECTION.single) return '';
  const tier = COLLECTION.lowestTier(card.section);
  const last = COLLECTION.visibleTiers[COLLECTION.visibleTiers.length - 1];
  return ` · ${escapeHTML(tier.name)}${tier === last ? '' : ' and up'}`;
}

const TIER_RANK = new Map(TIER_DEFS.map((t, i) => [t.id, i]));

function setLine(card, section) {
  if (card.link) return `<p>${escapeHTML(section.name)}${tierText(card)}</p><p>Also in <a href="${asset(`${card.link.set}/`)}#card-${encodeURIComponent(card.link.id)}">${escapeHTML(card.setName)}</a></p>`;
  if (!COLLECTION.isView) return `<p>${escapeHTML(section.name)}${tierText(card)}</p>`;
  const set = COLLECTION.viewSets[card.s];
  const chosen = getSitePrefs().tiers[set.id];
  const hidden = chosen && TIER_RANK.get(card.st || 'standard') > TIER_RANK.get(chosen);
  return `<p><a href="${asset(`${set.id}/`)}#card-${encodeURIComponent(card.c)}">${escapeHTML(set.name)}</a> · ${escapeHTML(section.name)}${tierText(card)}</p>`
    + (hidden ? `<p class="hint hint--small">This card is saved, but it’s hidden on the ${escapeHTML(set.name)} page because you’re collecting a smaller tier there.</p>` : '');
}

const VIEW_LABEL = {
  characters: (name) => `All ${name} cards`,
  artists: (name) => `Cards by ${name}`,
  groups: (name) => `${name} cards`,
};
const VIEW_ORDER = ['characters', 'groups', 'artists'];
const MAX_VIEW_LINKS = 4;
let viewRun = 0;

function viewRow(view, text) {
  return `<li><a href="${asset(`${view.id}/`)}">${escapeHTML(VIEW_LABEL[view.kind](view.name))}</a> <small>${escapeHTML(text)}</small></li>`;
}

async function showViews(card, body) {
  const run = ++viewRun;
  if (COLLECTION.isView) return;
  const index = await fetchSetViews(card.link ? card.link.set : COLLECTION.id);
  const slots = index?.cards?.[card.link ? card.link.id : card.id];
  if (!slots?.length || run !== viewRun) return;
  const views = slots.map((i) => index.views[i])
    .sort((a, b) => VIEW_ORDER.indexOf(a.kind) - VIEW_ORDER.indexOf(b.kind) || a.total - b.total)
    .slice(0, MAX_VIEW_LINKS);
  const rows = await Promise.all(views.map(async (view) => {
    if (view.kind !== 'characters') return viewRow(view, plural(view.total, 'card', 'cards'));
    try {
      const { owned, total } = progressOf(await fetchView(view.id));
      return viewRow(view, `you have ${owned} of ${total}`);
    } catch {
      return viewRow(view, plural(view.total, 'card', 'cards'));
    }
  }));
  if (run !== viewRun) return;
  const block = document.createElement('section');
  block.className = 'info__block info__views';
  block.innerHTML = `<h3 class="field__label">Collect by character</h3><ul class="info__view-list">${rows.join('')}</ul>`;
  body.append(block);
}

function render(card) {
  const section = COLLECTION.sectionById.get(card.section);
  const q = getQty(card.id);
  const thumb = COLLECTION.hasImage(card) ? `<img src="${COLLECTION.imageUrl(card, 'sm')}" alt="" width="330" height="460">` : '';
  const where = whereToGet(card);
  const stats = COLLECTION.game.statsText?.(card);
  return `<div class="info__card">`
    + `<span class="info__thumb" style="--ph:${COLLECTION.imageColor(card)}">${thumb}</span>`
    + '<div class="info__facts">'
    + `<p class="info__meta"><span>${escapeHTML(card.numberText)}</span><span class="info__rarity">${rarityIcon(card)}${escapeHTML(card.rarityName)}</span></p>`
    + (stats ? `<p class="info__stats">${escapeHTML(stats)}</p>` : '')
    + setLine(card, section)
    + `<p class="info__owned${q ? ' is-owned' : ''}">${q ? `In your collection${q > 1 ? ` · ${q} copies` : ''}` : 'Not in your collection yet'}</p>`
    + '</div></div>'
    + (where ? `<section class="info__block"><h3 class="field__label">Where to get it</h3>${where}</section>` : '')
    + pullOdds(card)
    + price(card);
}

export function initInfo() {
  const dlg = document.getElementById('dlg-info');
  const title = document.getElementById('info-title');
  const body = document.getElementById('info-body');
  return {
    open(id) {
      const card = COLLECTION.cardById.get(id);
      title.textContent = card.name;
      body.innerHTML = render(card);
      openDialog(dlg);
      showViews(card, body);
    },
  };
}
