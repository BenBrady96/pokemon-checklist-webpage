import { CARDS, CARD_BY_ID, RARITY_BY_ID, SECTIONS, TIERS } from './cards.js';
import colors from './card-colors.js';
import { getQty } from './store.js';
import { hasImage, rarityIconById } from './render.js';
import { priceOf, formatGbp, formatUsd, pricesUpdated } from './pricing.js';
import { openDialog, escapeHTML } from './ui.js';

const PACK_SECTIONS = new Set(['main', 'secret', 'classic', 'energy']);

const PACK_PRODUCTS = [
  'Elite Trainer Box (9 packs)', 'Pokémon Center Elite Trainer Box (11)', 'Booster Bundle (6)',
  'Ultra-Premium Collections (29)', 'Ditto Premium Collection (8)', 'Figure Collections (5)', 'Pokémon ex Boxes (4)',
  'Tech Sticker Collections (3)', 'Poster Collection (3)', 'Mini Tins (2)', 'Knock Out Collection (2)', '2-Pack Blister (2)',
  'ex Tins', 'Binder Collection', 'single booster packs',
];

const PULL_ODDS = { PR: 1, E: 1, R: 2.3, RR: 4.5, IR: 5.5, CC: 10, SIR: 19, FR: 90, RGB: 4000 };

const DETAILS = {
  p099: 'The box also has an oversize Jumbo version of this card.',
  p100: 'The box also has an oversize Jumbo version of this card.',
  p101: 'The Pokémon Center Elite Trainer Box has this card as well as a Pokémon Center-stamped version.',
  p104: 'The collection also has an oversize Jumbo version of this card and a Mewtwo figure.',
  p105: 'The collection also has an oversize Jumbo version of this card and a Mew figure.',
  v01: 'Given away with Pokémon TCG purchases of $15 or more at participating shops in the US, Canada, Australia and New Zealand, while stocks last.',
  v02: 'The Cosmos Holo version only comes in these two products. The regular Eevee 116 is found in booster packs.',
  v03: 'Only in the Pokémon Center Elite Trainer Box, which also has the regular Nidorina promo.',
};

const SECTION_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));
const PACK_COUNTS = CARDS.filter((c) => PACK_SECTIONS.has(c.section))
  .reduce((m, c) => m.set(c.rarity, (m.get(c.rarity) || 0) + 1), new Map());

const roundOdds = (n) => (n < 10 ? Math.round(n) : n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 50) * 50 : Math.round(n / 500) * 500);
const oneIn = (n) => `about 1 in ${roundOdds(n).toLocaleString('en-GB')} packs`;

function numberText(card) {
  if (card.section === 'classic') return `Classic Collection · No. ${card.num}`;
  if (card.section === 'energy') return `No. ${card.num}`;
  return card.rarity === 'P' ? card.printed : `No. ${card.printed}`;
}

function searchQuery(card) {
  if (card.base) {
    const base = CARD_BY_ID.get(card.base);
    return `Pokemon ${base.name} ${base.printed} ${card.badge}`;
  }
  if (card.section === 'classic') return `Pokemon 30th Celebration Classic Collection ${card.name}`;
  if (card.rarity === 'P') return `Pokemon ${card.name} ${card.printed} promo`;
  return `Pokemon 30th Celebration ${card.name} ${card.printed}`;
}

function whereToGet(card) {
  const parts = [];
  if (card.section === 'classic') {
    parts.push('<p><b>Classic Collection Packs</b>, which have 3 of the 30 cards each. There’s one in each Ultra-Premium Collection (Day and Night, 6 Nov 2026).</p>');
    parts.push('<p>They also turn up in about 1 in 10 regular 30th Celebration booster packs.</p>');
  } else if (PACK_SECTIONS.has(card.section)) {
    parts.push('<p><b>30th Celebration booster packs.</b> Every pack has 6 foil cards: a Pikachu Rare, four more cards from the set and a Basic Energy.</p>');
  } else {
    parts.push(`<p><b>${escapeHTML(card.note)}</b></p>`);
    if (card.section === 'partner') parts.push('<p>Each collection has a promo pack with 3 of the series’ 9 cards at random, plus 2 booster packs.</p>');
  }
  if (DETAILS[card.id]) parts.push(`<p>${escapeHTML(DETAILS[card.id])}</p>`);
  if (PACK_SECTIONS.has(card.section)) parts.push(`<p class="hint hint--small">Booster packs come in: ${PACK_PRODUCTS.join(' · ')}.</p>`);
  return parts.join('');
}

function pullOdds(card) {
  if (!PACK_SECTIONS.has(card.section)) return '';
  const rarity = RARITY_BY_ID.get(card.rarity);
  const odds = PULL_ODDS[card.rarity];
  const lines = [];
  if (card.rarity === 'C') lines.push('Commons make up most of each pack.');
  else if (card.rarity === 'RGB') lines.push('RGB Rares are extremely rare: roughly 1 in 4,000 packs, from the few found so far.');
  else lines.push(`${rarity.name}: ${odds === 1 ? 'one in every pack' : oneIn(odds)}.`);
  if (odds) lines.push(`This exact card: ${oneIn(odds * PACK_COUNTS.get(card.rarity))}.`);
  return `<section class="info__block"><h3 class="field__label">Pull odds</h3>`
    + `${lines.map((l) => `<p>${l}</p>`).join('')}`
    + '<p class="hint hint--small">Approximate, based on community pack openings.</p></section>';
}

function price(card) {
  const entry = priceOf(card.id);
  const q = encodeURIComponent(searchQuery(card));
  const tcgplayer = entry ? `https://www.tcgplayer.com/product/${entry.tcg}` : `https://www.tcgplayer.com/search/pokemon/product?q=${q}`;
  const ebay = `https://www.ebay.co.uk/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`;
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
  const link = (href, text) => `<a class="btn btn--ghost btn--sm" href="${href}" target="_blank" rel="noopener noreferrer">${text}<svg><use href="#i-external"/></svg></a>`;
  return `<section class="info__block"><h3 class="field__label">Market price</h3>${figure}`
    + `<div class="info__links">${link(tcgplayer, 'TCGplayer')}${link(ebay, 'eBay UK sold')}</div></section>`;
}

function render(card) {
  const rarity = RARITY_BY_ID.get(card.rarity);
  const section = SECTION_BY_ID.get(card.section);
  const tier = TIERS.find((t) => t.sectionIds.has(card.section));
  const q = getQty(card.id);
  const rarityName = card.rarity === 'E' ? `${card.type[0].toUpperCase()}${card.type.slice(1)} Energy` : rarity.name;
  const icon = card.rarity === 'E' ? `<svg class="rar" aria-hidden="true"><use href="#e-${card.type}"/></svg>` : rarityIconById(card.rarity);
  const thumb = hasImage(card.id) ? `<img src="img/cards/sm/${card.id}.webp" alt="" width="330" height="460">` : '';
  return `<div class="info__card">`
    + `<span class="info__thumb" style="--ph:${colors[card.id] || '#6a6f8f'}">${thumb}</span>`
    + '<div class="info__facts">'
    + `<p class="info__meta"><span>${escapeHTML(numberText(card))}</span><span class="info__rarity">${icon}${escapeHTML(rarityName)}</span></p>`
    + `<p>${escapeHTML(section.name)} · ${escapeHTML(tier.name)}${tier === TIERS[TIERS.length - 1] ? '' : ' and up'}</p>`
    + `<p class="info__owned${q ? ' is-owned' : ''}">${q ? `In your collection${q > 1 ? ` · ${q} copies` : ''}` : 'Not in your collection yet'}</p>`
    + '</div></div>'
    + `<section class="info__block"><h3 class="field__label">Where to get it</h3>${whereToGet(card)}</section>`
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
