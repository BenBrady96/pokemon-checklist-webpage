import { SECTIONS, RARITIES, GROUPS, SET_NAME, getTier } from './cards.js';
import { getQty, getPrefs } from './store.js';
import { rarityIconById } from './render.js';
import { marketUsd, formatGbp, formatUsd, pricesUpdated } from './pricing.js';

const currentTier = () => getTier(getPrefs().tier);

export function compute() {
  const tier = currentTier();
  const blank = (list) => Object.fromEntries(list.map((x) => [x.id, { owned: 0, total: 0 }]));
  const bySection = blank(SECTIONS);
  const byRarity = blank(RARITIES);
  const byGroup = blank(GROUPS);
  let owned = 0;
  let copies = 0;
  let spare = 0;
  let dupeCards = 0;
  let value = 0;
  let toComplete = 0;
  let unpriced = 0;

  for (const card of tier.cards) {
    const q = getQty(card.id);
    const usd = marketUsd(card.id);
    if (usd == null) unpriced++;
    else if (q) value += usd * q;
    else toComplete += usd;
    const tally = (bucket) => {
      bucket.total++;
      if (q) bucket.owned++;
    };
    tally(bySection[card.section]);
    tally(byRarity[card.rarity]);
    for (const g of GROUPS) if (g.test(card)) tally(byGroup[g.id]);
    if (q) {
      owned++;
      copies += q;
      if (q > 1) {
        spare += q - 1;
        dupeCards++;
      }
    }
  }
  return { tier, owned, total: tier.cards.length, copies, spare, dupeCards, value, toComplete, unpriced, bySection, byRarity, byGroup };
}

export const percent = (owned, total) => (total ? Math.floor((owned / total) * 100) : 0);

function row(name, { owned, total }, icon = '') {
  const complete = owned === total;
  return `<div class="stat-row${complete ? ' is-complete' : ''}">
    <span class="stat-row__name">${icon}<span>${name}</span></span>
    <span></span>
    <span class="stat-row__count">${owned}/${total}${complete ? ' ✓' : ''}</span>
    <span class="bar" aria-hidden="true"><i style="--p:${owned / total}"></i></span>
  </div>`;
}

export function renderStats(s) {
  const set = s.byGroup.set;
  const pct = percent(set.owned, set.total);
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - set.owned / set.total);
  const main = s.byGroup.main;
  const headline = set.owned === set.total ? `${s.tier.name} complete!`
    : main.owned === main.total ? 'Main set complete!'
      : `${set.total - set.owned} cards to go`;
  const progress = [['Main set', main], ['Secret rares', s.byGroup.secret], ['Promos', s.byGroup.promo], ['First Partners', s.byGroup.partner]]
    .filter(([, g]) => g.total)
    .map(([name, g]) => `${name} ${g.owned}/${g.total}`);
  const summary = [s.tier.name, ...progress].join(' · ');

  const sectionRows = s.tier.sections.map((sec) => row(sec.name, s.bySection[sec.id])).join('');
  const rarityRows = RARITIES.filter((r) => s.byRarity[r.id].total)
    .map((r) => row(r.name, s.byRarity[r.id], rarityIconById(r.id)))
    .join('');

  return `
    <div class="stats-hero">
      <div class="ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring__track" cx="60" cy="60" r="52"/>
          <circle class="ring__value" cx="60" cy="60" r="52" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/>
        </svg>
        <div class="ring__label"><b>${pct}%</b><small>${set.owned} of ${set.total}</small></div>
      </div>
      <div class="stats-hero__text">
        <h3>${headline}</h3>
        <p>${summary}</p>
      </div>
    </div>
    <div class="stat-tiles">
      <div class="stat-tile"><b>${s.owned}</b><small>Unique cards</small></div>
      <div class="stat-tile"><b>${s.copies}</b><small>Total copies</small></div>
      <div class="stat-tile"><b>${s.spare}</b><small>Spare copies</small></div>
    </div>
    <div class="stat-tiles stat-tiles--value">
      <div class="stat-tile"><b>≈ ${formatGbp(s.value)}</b><small>Collection value · ${formatUsd(s.value)}</small></div>
      <div class="stat-tile"><b>≈ ${formatGbp(s.toComplete)}</b><small>Cost to complete · ${formatUsd(s.toComplete)}</small></div>
    </div>
    <p class="hint hint--small stat-note">TCGplayer market prices from ${pricesUpdated}, counting every copy you own.${s.unpriced ? ` ${s.unpriced} card${s.unpriced === 1 ? ' has' : 's have'} no price yet and ${s.unpriced === 1 ? 'isn’t' : 'aren’t'} included.` : ''}</p>
    <div class="stat-columns">
      <section class="stat-group"><h3>By section</h3>${sectionRows}${row('Pikachu Rares', s.byGroup.pikachu, rarityIconById('PR'))}</section>
      <section class="stat-group"><h3>By rarity</h3>${rarityRows}</section>
    </div>`;
}

function groupedLines(tier, filter, format) {
  const lines = [];
  for (const sec of tier.sections) {
    const items = tier.cards.filter((c) => c.section === sec.id && filter(c)).map(format);
    if (items.length) lines.push(`${sec.name}: ${items.join(', ')}`);
  }
  return lines;
}

const label = (c) => (c.section === 'classic' ? `${c.name} (${c.num})`
  : c.rarity === 'P' || c.base ? `${c.printed} ${c.name}` : `${c.num} ${c.name}`);

export function missingText() {
  const tier = currentTier();
  const missing = tier.cards.filter((c) => !getQty(c.id));
  if (!missing.length) return `Pokémon TCG ${SET_NAME} (${tier.name}): I have every card!`;
  return [`Pokémon TCG ${SET_NAME} (${tier.name}) — missing ${missing.length} of ${tier.cards.length}:`, '',
    ...groupedLines(tier, (c) => !getQty(c.id), label)].join('\n');
}

export function duplicatesText() {
  const tier = currentTier();
  const dupes = tier.cards.filter((c) => getQty(c.id) > 1);
  if (!dupes.length) return '';
  const spare = dupes.reduce((n, c) => n + getQty(c.id) - 1, 0);
  return [`Pokémon TCG ${SET_NAME} — ${spare} spare cop${spare === 1 ? 'y' : 'ies'} for trade:`, '',
    ...groupedLines(tier, (c) => getQty(c.id) > 1, (c) => `${label(c)} ×${getQty(c.id) - 1}`)].join('\n');
}
