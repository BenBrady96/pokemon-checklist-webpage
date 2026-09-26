import { COLLECTION, GAME, CARDS, CARD_BY_ID, RARITY_BY_ID } from './collection.js';
import { getQty } from './store.js';
import { rarityIcon } from './render.js';
import { priceOf, formatGbp, formatUsd, pricesUpdated } from './pricing.js';
import { openDialog, escapeHTML } from './ui.js';

const INFO = COLLECTION.info;
const PACK_SECTIONS = new Set(INFO.packSections || []);
const PACK_COUNTS = CARDS.filter((c) => PACK_SECTIONS.has(c.section))
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
  const rarity = RARITY_BY_ID.get(card.rarity);
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
  let figure;
  if (entry?.usd != null) {
    figure = `<p class="info__price">≈ ${formatGbp(entry.usd)}<small>${formatUsd(entry.usd)}</small></p>`
      + `<p class="hint hint--small">TCGplayer market price, ${pricesUpdated}. The £ figure is converted, so it’s approximate.</p>`;
  } else if (entry?.from != null) {
    figure = '<p class="info__price">No sales yet</p>'
      + `<p class="hint hint--small">Listed on TCGplayer from ≈ ${formatGbp(entry.from)} (${formatUsd(entry.from)}), ${pricesUpdated}.</p>`;
  } else {
    figure = '<p class="info__price">No price yet</p><p class="hint hint--small">TCGplayer doesn’t list this card yet.</p>';
  }
  const links = GAME.priceLinks(card, entry, card.searchQuery)
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

function render(card) {
  const section = COLLECTION.sectionById.get(card.section);
  const q = getQty(card.id);
  const thumb = COLLECTION.hasImage(card) ? `<img src="${COLLECTION.imageUrl(card, 'sm')}" alt="" width="330" height="460">` : '';
  const where = whereToGet(card);
  return `<div class="info__card">`
    + `<span class="info__thumb" style="--ph:${COLLECTION.imageColor(card)}">${thumb}</span>`
    + '<div class="info__facts">'
    + `<p class="info__meta"><span>${escapeHTML(card.numberText)}</span><span class="info__rarity">${rarityIcon(card)}${escapeHTML(card.rarityName)}</span></p>`
    + `<p>${escapeHTML(section.name)}${tierText(card)}</p>`
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
      const card = CARD_BY_ID.get(id);
      title.textContent = card.name;
      body.innerHTML = render(card);
      openDialog(dlg);
    },
  };
}
