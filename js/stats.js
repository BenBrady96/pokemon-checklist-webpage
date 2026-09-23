import { CARDS, SECTIONS, RARITIES, GROUPS, SET_NAME } from './cards.js';
import { getQty } from './store.js';
import { rarityIconById } from './render.js';

export function compute() {
  const blank = (list) => Object.fromEntries(list.map((x) => [x.id, { owned: 0, total: 0 }]));
  const bySection = blank(SECTIONS);
  const byRarity = blank(RARITIES);
  const byGroup = blank(GROUPS);
  let owned = 0;
  let copies = 0;
  let spare = 0;
  let dupeCards = 0;

  for (const card of CARDS) {
    const q = getQty(card.id);
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
  return { owned, total: CARDS.length, copies, spare, dupeCards, bySection, byRarity, byGroup };
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
  const master = s.byGroup.master;
  const pct = percent(master.owned, master.total);
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - master.owned / master.total);
  const main = s.byGroup.main;
  const headline = master.owned === master.total ? 'Master set complete!'
    : main.owned === main.total ? 'Main set complete!'
      : `${master.total - master.owned} cards to go`;

  const sectionRows = SECTIONS.map((sec) => row(sec.name, s.bySection[sec.id])).join('');
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
        <div class="ring__label"><b>${pct}%</b><small>${master.owned} of ${master.total}</small></div>
      </div>
      <div class="stats-hero__text">
        <h3>${headline}</h3>
        <p>Main set ${main.owned}/${main.total} · Secret rares ${s.byGroup.secret.owned}/${s.byGroup.secret.total}</p>
      </div>
    </div>
    <div class="stat-tiles">
      <div class="stat-tile"><b>${s.owned}</b><small>Unique cards</small></div>
      <div class="stat-tile"><b>${s.copies}</b><small>Total copies</small></div>
      <div class="stat-tile"><b>${s.spare}</b><small>Spare copies</small></div>
    </div>
    <div class="stat-columns">
      <section class="stat-group"><h3>By section</h3>${sectionRows}${row('Pikachu Rares', s.byGroup.pikachu, rarityIconById('PR'))}</section>
      <section class="stat-group"><h3>By rarity</h3>${rarityRows}</section>
    </div>`;
}

function groupedLines(filter, format) {
  const lines = [];
  for (const sec of SECTIONS) {
    const items = CARDS.filter((c) => c.section === sec.id && filter(c)).map(format);
    if (items.length) lines.push(`${sec.name}: ${items.join(', ')}`);
  }
  return lines;
}

const label = (c) => (c.section === 'classic' ? `${c.name} (${c.num})` : `${c.num} ${c.name}`);

export function missingText() {
  const missing = CARDS.filter((c) => !getQty(c.id));
  if (!missing.length) return `Pokémon TCG ${SET_NAME}: I have every card!`;
  return [`Pokémon TCG ${SET_NAME} — missing ${missing.length} of ${CARDS.length}:`, '',
    ...groupedLines((c) => !getQty(c.id), label)].join('\n');
}

export function duplicatesText() {
  const dupes = CARDS.filter((c) => getQty(c.id) > 1);
  if (!dupes.length) return '';
  const spare = dupes.reduce((n, c) => n + getQty(c.id) - 1, 0);
  return [`Pokémon TCG ${SET_NAME} — ${spare} spare cop${spare === 1 ? 'y' : 'ies'} for trade:`, '',
    ...groupedLines((c) => getQty(c.id) > 1, (c) => `${label(c)} ×${getQty(c.id) - 1}`)].join('\n');
}
