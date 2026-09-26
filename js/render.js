import { COLLECTION, CARDS, SECTIONS, RARITY_BY_ID, CARD_BY_ID, getTier } from './collection.js';
import { getQty } from './store.js';
import { escapeHTML } from './ui.js';
import { marketUsd, formatGbp } from './pricing.js';

export const refs = new Map();

const SECTION_CARDS = COLLECTION.cardsBySection;
let mountedCards = CARDS;

export const hasImage = (id) => COLLECTION.hasImage(CARD_BY_ID.get(id));
export const imageUrl = (id, size) => COLLECTION.imageUrl(CARD_BY_ID.get(id), size);
export const imageColor = (id, fallback) => COLLECTION.imageColor(CARD_BY_ID.get(id), fallback);

export function rarityIcon(card, cls = 'rar') {
  return `<svg class="${cls}${card.wide ? ' rar--wide' : ''}" aria-hidden="true"><use href="#${card.rarityIcon}"/></svg>`;
}

export function rarityIconById(rarityId) {
  const rarity = RARITY_BY_ID.get(rarityId);
  return `<svg class="rar${rarity.wide ? ' rar--wide' : ''}" aria-hidden="true"><use href="#${rarity.icon}"/></svg>`;
}

function cardMarkup(card) {
  const label = escapeHTML(card.label);
  const name = escapeHTML(card.name);
  const type = card.type ? ` data-type="${card.type}"` : '';
  const usd = marketUsd(card.id);
  return `<li class="card${COLLECTION.hasImage(card) ? '' : ' no-img'}" data-id="${card.id}" data-rarity="${card.rarity}"${type} style="--ph:${COLLECTION.imageColor(card)}">`
    + `<button class="card__hit" type="button" role="checkbox" aria-checked="false" tabindex="-1" aria-label="${label}">`
    + `<span class="card__art"><span class="card__ph">${card.num}<small>${name}</small></span>`
    + '<img alt="" width="330" height="460" loading="lazy" decoding="async" draggable="false">'
    + `${card.badge ? `<span class="card__badge">${escapeHTML(card.badge)}</span>` : ''}</span>`
    + `<span class="card__cap"><span class="card__num">${card.num}</span><span class="card__name">${name}</span>`
    + `<span class="card__rarname">${escapeHTML(card.rarityShort)}</span>${rarityIcon(card)}`
    + `${usd == null ? '' : `<span class="card__price">${formatGbp(usd)}</span>`}</span>`
    + '</button>'
    + '<span class="card__ui">'
    + '<span class="card__check" aria-hidden="true"><svg><use href="#i-check"/></svg></span>'
    + '<span class="card__stepper">'
    + `<button class="card__minus" type="button" tabindex="-1" aria-label="Remove a copy of ${label}"><svg><use href="#i-minus"/></svg></button>`
    + '<span class="card__qty" aria-hidden="true"></span>'
    + `<button class="card__plus" type="button" tabindex="-1" aria-label="Add a copy of ${label}"><svg><use href="#i-plus"/></svg></button>`
    + '</span>'
    + `<button class="card__zoom" type="button" tabindex="-1" aria-label="View ${label}"><svg><use href="#i-expand"/></svg></button>`
    + `<button class="card__info" type="button" tabindex="-1" aria-label="About ${label}"><svg><use href="#i-info"/></svg></button>`
    + '</span></li>';
}

export function buildCards() {
  if (COLLECTION.tileRules) {
    const style = document.createElement('style');
    style.textContent = COLLECTION.tileRules;
    document.head.append(style);
  }
  const tpl = document.createElement('template');
  tpl.innerHTML = CARDS.map(cardMarkup).join('');
  for (const li of tpl.content.querySelectorAll('.card')) {
    const card = CARD_BY_ID.get(li.dataset.id);
    refs.set(card.id, {
      card,
      li,
      hit: li.querySelector('.card__hit'),
      art: li.querySelector('.card__art'),
      img: li.querySelector('img'),
      qty: li.querySelector('.card__qty'),
      minus: li.querySelector('.card__minus'),
      plus: li.querySelector('.card__plus'),
      label: card.label,
    });
  }
  for (const id of refs.keys()) updateCard(id);
}

export function updateCard(id) {
  const r = refs.get(id);
  const q = getQty(id);
  r.li.classList.toggle('is-owned', q > 0);
  if (q > 1) r.li.dataset.qty = q;
  else delete r.li.dataset.qty;
  r.qty.textContent = q;
  r.hit.setAttribute('aria-checked', q > 0 ? 'true' : 'false');
  r.hit.setAttribute('aria-label', q > 1 ? `${r.label}, ${q} copies` : r.label);
  r.minus.disabled = q === 0;
}

function sectionShell(id, title, range, total) {
  const sec = document.createElement('section');
  sec.className = 'sec';
  sec.id = `sec-${id}`;
  sec.dataset.section = id;
  sec.setAttribute('aria-labelledby', `sec-${id}-title`);
  sec.innerHTML = '<div class="sec__head">'
    + `<h2 class="sec__title" id="sec-${id}-title"><span class="sec__title-text">${escapeHTML(title)}</span>`
    + `${range ? `<span class="sec__range">${escapeHTML(range)}</span>` : ''}</h2>`
    + `<div class="sec__progress"><span class="sec__count"><b>0</b>/${total}</span><span class="bar" aria-hidden="true"><i></i></span></div>`
    + `<button type="button" class="icon-btn sec__menu" data-section-menu="${id}" aria-label="${escapeHTML(title)} actions"><svg><use href="#i-dots"/></svg></button>`
    + '</div>';
  return sec;
}

function cardList(cards, className = 'cards') {
  const ol = document.createElement('ol');
  ol.className = className;
  for (const card of cards) ol.append(refs.get(card.id).li);
  return ol;
}

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.idx - b.idx;
const byRarity = (a, b) => RARITY_BY_ID.get(b.rarity).rank - RARITY_BY_ID.get(a.rarity).rank || a.idx - b.idx;

function binderPage(cards, number, pockets) {
  const page = document.createElement('div');
  page.className = 'page';
  const first = cards[0].pocketText;
  const last = cards[cards.length - 1].pocketText;
  page.innerHTML = `<div class="page__label"><span>Page ${number}</span><span>${first}–${last}</span></div>`;
  const ol = cardList(cards, 'pockets');
  for (let i = cards.length; i < pockets; i++) {
    const empty = document.createElement('li');
    empty.className = 'pocket-empty';
    empty.setAttribute('aria-hidden', 'true');
    ol.append(empty);
  }
  page.append(ol);
  return page;
}

function blankPage(cover, hint) {
  const page = document.createElement('div');
  page.className = cover ? 'page page--blank page--cover' : 'page page--blank';
  page.setAttribute('aria-hidden', 'true');
  page.innerHTML = cover ? coverMarkup() : `<span class="page__hint">${hint}</span>`;
  return page;
}

function coverMarkup() {
  const title = `<span class="page__cover-title brand__gold">${escapeHTML(COLLECTION.name)}</span>`;
  if (COLLECTION.cover?.symbol) return `<svg class="page__mark"><use href="#${COLLECTION.cover.symbol}"/></svg>${title}`;
  if (COLLECTION.logoUrl) return `<img class="page__logo" src="${COLLECTION.logoUrl}" alt="" loading="lazy">${title}`;
  return `<svg class="page__mark"><use href="#logo-mark"/></svg>${title}`;
}

function binderSection(section, pockets, firstPage, lastSection) {
  const cards = SECTION_CARDS.get(section.id);
  const sec = sectionShell(section.id, section.name, section.range, cards.length);
  const binder = document.createElement('div');
  binder.className = 'binder';
  binder.style.setProperty('--pcols', pockets === 4 ? 2 : pockets === 12 ? 4 : 3);
  let spread = null;
  let number = firstPage;
  for (let i = 0; i < cards.length; i += pockets, number++) {
    const right = number % 2 === 1;
    if (!spread || !right) {
      spread = document.createElement('div');
      spread.className = 'spread';
      binder.append(spread);
      if (right) spread.append(blankPage(number === 1, `↑ Page ${number - 1}`));
    }
    spread.append(binderPage(cards.slice(i, i + pockets), number, pockets));
  }
  if (number % 2 === 1) spread.append(blankPage(lastSection, `Page ${number} ↓`));
  sec.append(binder);
  return { sec, pages: number - firstPage };
}

export function mount(root, { view, sort, pockets, tier }) {
  const { sections, cards } = getTier(tier);
  mountedCards = cards;
  const frag = document.createDocumentFragment();
  if (view === 'binder') {
    let page = 1;
    for (const [i, section] of sections.entries()) {
      const { sec, pages } = binderSection(section, pockets, page, i === sections.length - 1);
      page += pages;
      frag.append(sec);
    }
  } else if (sort !== 'set') {
    const sorted = [...cards].sort(sort === 'name' ? byName : byRarity);
    const sec = sectionShell('all', 'All cards', sort === 'name' ? 'A–Z' : 'rarest first', cards.length);
    sec.append(cardList(sorted));
    frag.append(sec);
  } else {
    for (const section of sections) {
      const sec = sectionShell(section.id, section.name, section.range, SECTION_CARDS.get(section.id).length);
      sec.append(cardList(SECTION_CARDS.get(section.id)));
      frag.append(sec);
    }
  }
  root.replaceChildren(frag);
}

export function updateSectionCounts(root) {
  for (const sec of root.querySelectorAll('.sec')) {
    const id = sec.dataset.section;
    const cards = id === 'all' ? mountedCards : SECTION_CARDS.get(id);
    let owned = 0;
    for (const card of cards) if (getQty(card.id) > 0) owned++;
    sec.querySelector('.sec__count b').textContent = owned;
    sec.querySelector('.bar i').style.setProperty('--p', owned / cards.length);
    sec.classList.toggle('is-complete', owned === cards.length);
  }
}

export function applyVisibility(root, matches, { dimOnly }) {
  let shown = 0;
  for (const r of refs.values()) {
    const ok = matches(r.card);
    if (ok) shown++;
    if (dimOnly) {
      r.li.hidden = false;
      r.li.classList.toggle('is-dim', !ok);
    } else {
      r.li.hidden = !ok;
      r.li.classList.remove('is-dim');
    }
  }
  for (const sec of root.querySelectorAll('.sec')) {
    sec.hidden = !dimOnly && !sec.querySelector('.card:not([hidden])');
  }
  return shown;
}

let eagerDone = false;

export function updateImageSources(root, imagesOn) {
  if (!imagesOn) return;
  const probe = root.querySelector('.card:not([hidden]) .card__art');
  const width = probe ? probe.getBoundingClientRect().width : 0;
  const large = width * Math.min(window.devicePixelRatio || 1, 2) > 380;
  if (!eagerDone && probe) {
    const first = [...root.querySelectorAll('.card:not([hidden]) img')].slice(0, 12);
    first.forEach((img, i) => {
      img.loading = 'eager';
      if (i < 4) img.fetchPriority = 'high';
    });
    eagerDone = true;
  }
  for (const r of refs.values()) {
    if (!r.li.isConnected || !COLLECTION.hasImage(r.card)) continue;
    const src = COLLECTION.imageUrl(r.card, large ? 'lg' : 'sm');
    if (r.img.getAttribute('src') !== src) r.img.setAttribute('src', src);
  }
}
