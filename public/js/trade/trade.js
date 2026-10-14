import { loadCatalog } from '../core/catalog.js';
import { asset } from '../core/paths.js';
import { normalize } from '../core/model.js';
import * as storage from '../core/storage.js';
import { convert, formatAmount, priceDate } from '../core/pricing.js';
import { renderQr, scanQr } from '../shared/qr.js';
import { initDialogs, openDialog, closeDialog, confirmAction, toast, announce, copyText, hideLoader, reducedMotion } from '../shared/ui.js';
import { initHeader } from '../shared/header.js';
import { initPWA, initInstallBanner } from '../shared/pwa.js';
import { encodeTrade, encodeProposal, readTradeText, cleanName, newId, UNSUPPORTED } from './trade-code.js';
import { initGuide, openGuide } from './trade-guide.js';
import {
  SIDES, readTrade, saveTrade, isTradeKey, loadSets, mySide, resolveFriend, resolveProposal, standing, buildLists,
  makeValuer, totalOf, balance, qtyIn, hasLines, bump, planTrade, applyTrade, adjustFriend, pushHistory, emptyDraft,
} from './trade-data.js';
import { el, icon } from '../shared/dom.js';
import { count, plural, shortDate } from '../shared/format.js';

const PAGE = 60;
const TABS = [
  { id: 'mySpares', side: 'give', whose: 'mine', tone: 'have', label: () => 'Your spares' },
  { id: 'myNeeds', side: 'get', whose: null, tone: 'missing', label: () => 'Your needs' },
  { id: 'youHave', friend: true, side: 'give', whose: 'mine', tone: 'have', label: () => (state.friend?.name ? `You have, ${state.friend.name} needs` : 'You have, they need') },
  { id: 'theyHave', friend: true, side: 'get', whose: 'theirs', tone: 'missing', label: () => (state.friend?.name ? `${state.friend.name} has, you need` : 'They have, you need') },
];
const SIDE_TEXT = {
  give: { title: 'You give', add: 'Give', empty: 'Tap Give on a card, or scan one.' },
  get: { title: 'You get', add: 'Get', empty: 'Tap Get on a card, or scan one.' },
};
const CONVERTED = { gbp: 'Pound', eur: 'Euro' };

const $ = (name) => document.querySelector(`[data-tr="${name}"]`);
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 0 });
const times = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

const ago = (t) => {
  const days = Math.floor((Date.now() - t) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

let catalog = { collections: [] };
let infoById = new Map();
let orderById = new Map();
let state = readTrade();
let me = { sets: {} };
const sets = new Map();
let lists = buildLists({ me, friend: null, sets, singles: state.singles });
let valuer = makeValuer(sets, storage.getPrefs().currency);
let shown = PAGE;
let query = '';
let ready = false;

const setInfo = (id) => infoById.get(id) || { id, name: id };
const friendName = () => state.friend?.name || 'Your friend';
const partnerName = () => state.friend?.name || state.draft.proposal?.from || '';
const cardOf = (set, cardId) => sets.get(set)?.model.cardById.get(cardId) || null;
const money = (n) => formatAmount(n, valuer.cur);
const qtyOf = (lines) => lines.reduce((n, l) => n + l.qty, 0);
const cardName = (card) => `${card.name}${card.variant ? ` (${card.variant})` : ''}`;
const subText = (set, card) => `${setInfo(set).name} · ${card.printed}${card.variant ? ` · ${card.variant}` : ''}`;
const save = () => saveTrade(state);

const positions = new WeakMap();
function positionOf(model, card) {
  if (!positions.has(model)) positions.set(model, new Map(model.cards.map((c, i) => [c, i])));
  return positions.get(model).get(card) ?? 0;
}

function indexCatalog() {
  infoById = new Map(catalog.collections.map((c) => [c.id, c]));
  orderById = new Map(catalog.collections.map((c, i) => [c.id, i]));
}

function refreshMe() {
  me = mySide((id) => infoById.has(id));
}

function recompute() {
  valuer = makeValuer(sets, storage.getPrefs().currency);
  lists = buildLists({ me, friend: state.friend, sets, singles: state.singles });
}

async function ensureLoaded(extra = []) {
  const ids = [
    ...Object.keys(me.sets),
    ...Object.keys(state.friend?.sets || {}),
    ...SIDES.flatMap((side) => state.draft[side].map((l) => l.set)),
    ...extra,
  ].filter((id) => infoById.has(id) && !sets.has(id));
  if (!ids.length) return;
  const result = await loadSets(ids);
  for (const [id, s] of result.sets) sets.set(id, s);
}

function ensureSet(id) {
  if (sets.has(id)) return;
  ensureLoaded([id]).then(() => {
    recompute();
    renderTrade();
  });
}

const thumb = (set, card) => {
  const model = sets.get(set)?.model;
  return card && model?.hasImage(card)
    ? el('img', { class: 'pf-row__card', src: model.imageUrl(card, 'sm'), alt: '', width: 330, height: 460, loading: 'lazy', decoding: 'async' })
    : el('span', { class: 'pf-row__card pf-row__card--blank', 'aria-hidden': 'true' });
};

const flag = (tone, text) => el('span', { class: `tr-flag tr-flag--${tone}`, text });

const howMuchMore = (more, less) => (more >= less * 2 ? `${times.format(more / less)}× what` : `${percent.format(more / less - 1)} more than`);

function verdictOf(b, give, get) {
  if (!hasLines(state.draft)) return { tone: 'none', text: 'Add cards to both sides to see if it’s fair.', short: 'No trade yet' };
  if (b.dir === 'none') return { tone: 'none', text: 'None of these cards have a price yet.', short: 'No prices yet' };
  if (b.dir === 'even') {
    const gap = Math.abs(b.diff);
    return { tone: 'even', text: 'Fair trade', short: 'Fair trade', detail: gap >= 0.005 ? `Within ${money(gap)}` : 'Exactly even' };
  }
  if (b.dir === 'up') {
    const text = `You’re up ${money(b.diff)}`;
    return { tone: 'up', text, short: text, detail: give.value > 0 ? `You get ${howMuchMore(get.value, give.value)} you give` : 'You’re not giving anything with a price' };
  }
  const text = `You’re down ${money(-b.diff)}`;
  return { tone: 'down', text, short: text, detail: get.value > 0 ? `You give ${howMuchMore(give.value, get.value)} you get` : 'You’re not getting anything with a price' };
}

function currentVerdict() {
  const give = totalOf(state.draft.give, valuer);
  const get = totalOf(state.draft.get, valuer);
  const b = balance(give.value, get.value);
  return { give, get, b, verdict: verdictOf(b, give, get) };
}

function paintMeter(fill, b) {
  const p = 0.5 + 0.5 * b.lean;
  fill.style.left = `${Math.min(50, p * 100)}%`;
  fill.style.width = `${Math.abs(p * 100 - 50)}%`;
}

function renderFriend() {
  const box = $('friend');
  const mine = Object.keys(me.sets).length;
  const f = state.friend;
  if (!f) {
    box.replaceChildren(...[
      mine ? null : el('p', { class: 'tr-friend__text', text: 'Mark the cards you own in any set first.' }),
      el('div', { class: 'tr-friend__actions' },
        el('button', { type: 'button', class: 'btn btn--primary', 'data-tr-action': 'share', disabled: !mine }, icon('i-qr'), 'Show my code'),
        el('button', { type: 'button', class: 'btn btn--ghost', 'data-tr-action': 'add' }, icon('i-camera'), 'Add their code')),
    ].filter(Boolean));
    return;
  }
  const when = f.created ? `code from ${ago(f.created)}` : `added ${ago(f.received)}`;
  const initial = [...(f.name || '?')][0].toUpperCase();
  box.replaceChildren(...[
    el('div', { class: 'tr-friend__who' },
      el('span', { class: 'tr-friend__avatar', 'aria-hidden': 'true', text: initial }),
      el('span', { class: 'tr-friend__name' },
        el('b', { text: f.name ? `Trading with ${f.name}` : 'Trading with a friend' }),
        el('small', { text: when })),
      el('button', { type: 'button', class: 'icon-btn tr-friend__stop', 'data-tr-action': 'clear-friend', title: 'Stop comparing', 'aria-label': `Stop comparing with ${f.name || 'your friend'}` }, icon('i-close'))),
    f.unknown ? el('p', { class: 'hint hint--small', text: `${plural(f.unknown, 'of their sets isn’t', 'of their sets aren’t')} on this version of the site yet. Refresh to update.` }) : null,
    el('div', { class: 'tr-friend__actions' },
      el('button', { type: 'button', class: 'btn btn--ghost', 'data-tr-action': 'share', disabled: !mine }, icon('i-qr'), 'My code'),
      el('button', { type: 'button', class: 'btn btn--ghost', 'data-tr-action': 'add' }, icon('i-camera'), 'Scan a code')),
  ].filter(Boolean));
}

function flagsFor(side, line, card) {
  const model = sets.get(line.set).model;
  const mine = standing(me, line.set, card, model);
  const theirs = state.friend ? standing(state.friend, line.set, card, model) : null;
  const flags = [];
  if (side === 'give') {
    if (mine.have < line.qty) flags.push(flag('bad', mine.have ? `You only have ${mine.have}` : 'Not in your collection'));
    else if (mine.have === line.qty) flags.push(flag('warn', mine.have === 1 ? 'Your only copy' : 'All your copies'));
    if (theirs?.need) flags.push(flag('good', `${friendName()} needs this`));
    else if (theirs?.have) flags.push(flag('info', `${friendName()} has ${theirs.have}`));
  } else {
    if (theirs && theirs.have < line.qty) flags.push(flag('bad', theirs.have ? `${friendName()} only has ${theirs.have}` : `${friendName()} doesn’t have this`));
    else if (theirs && theirs.have === line.qty) flags.push(flag('warn', theirs.have === 1 ? 'Their only copy' : 'All their copies'));
    if (mine.need) flags.push(flag('good', 'You need this'));
    else if (mine.have) flags.push(flag('info', `You already have ${mine.have}`));
  }
  return flags;
}

function stepper(side, line, card) {
  const name = card ? cardName(card) : 'this card';
  const key = `line|${side}|${line.set}|${line.card}`;
  return el('span', { class: 'tr-qty' },
    el('button', {
      type: 'button',
      class: 'tr-qty__btn',
      'data-key': `${key}|minus`,
      'aria-label': line.qty > 1 ? `One fewer ${name}` : `Remove ${name}`,
      onclick: () => change(side, line.set, line.card, -1),
    }, icon(line.qty > 1 ? 'i-minus' : 'i-trash')),
    el('span', { class: 'tr-qty__value', text: String(line.qty) }),
    el('button', {
      type: 'button',
      class: 'tr-qty__btn',
      'data-key': `${key}|plus`,
      'aria-label': `One more ${name}`,
      disabled: line.qty >= storage.MAX_QTY,
      onclick: () => change(side, line.set, line.card, 1),
    }, icon('i-plus')));
}

function lineRow(side, line) {
  const card = cardOf(line.set, line.card);
  const price = valuer.of(line.set, line.card);
  const chip = card ? flagsFor(side, line, card)[0] : null;
  const each = price.value != null
    ? (line.qty > 1 ? el('small', { text: `${money(price.value)} each` }) : null)
    : el('small', { text: price.from != null ? `Listed from ${money(price.from)}` : 'No price yet' });
  return el('li', { class: 'tr-line' },
    thumb(line.set, card),
    el('span', { class: 'pf-row__main' },
      el('b', { text: card ? card.name : 'Card not loaded' }),
      el('small', { text: card ? subText(line.set, card) : `${setInfo(line.set).name}. Connect to the internet to load it.` }),
      chip ? el('span', { class: 'tr-flags' }, chip) : null),
    el('span', { class: 'tr-line__side' },
      el('b', { text: price.value != null ? money(price.value * line.qty) : 'n/a' }),
      each,
      stepper(side, line, card)));
}

function renderSides() {
  for (const side of SIDES) {
    const lines = state.draft[side];
    $(`${side}-total`).textContent = lines.length ? money(totalOf(lines, valuer).value) : '';
    $(side).replaceChildren(...(lines.length
      ? lines.map((line) => lineRow(side, line))
      : [el('li', { class: 'pf-list__empty tr-lines__empty', text: SIDE_TEXT[side].empty })]));
  }
}

function renderSummary() {
  const { give, get, b, verdict } = currentVerdict();
  const any = hasLines(state.draft);

  const meter = $('meter');
  meter.dataset.tone = verdict.tone;
  meter.setAttribute('aria-label', `${verdict.text}${verdict.detail ? `. ${verdict.detail}` : ''}`);
  paintMeter($('meter-fill'), b);
  $('meter-knob').style.left = `${(0.5 + 0.5 * b.lean) * 100}%`;
  const band = $('meter-band');
  band.style.left = `${50 - b.band * 50}%`;
  band.style.width = `${b.band * 100}%`;
  $('meter-them').textContent = state.friend?.name ? `${state.friend.name} ahead` : 'They’re ahead';

  const verdictBox = $('verdict');
  verdictBox.className = `tr-verdict tr-verdict--${verdict.tone}`;
  verdictBox.replaceChildren(...[el('b', { text: verdict.text }), verdict.detail && el('small', { text: verdict.detail })].filter(Boolean));

  const unpriced = give.unpriced + get.unpriced;
  const note = $('summary-note');
  note.hidden = !unpriced;
  note.textContent = unpriced ? `${plural(unpriced, 'card has', 'cards have')} no market price yet and ${unpriced === 1 ? 'isn’t' : 'aren’t'} counted.` : '';

  const proposal = $('proposal');
  proposal.hidden = !state.draft.proposal;
  if (state.draft.proposal) {
    const from = state.draft.proposal.from;
    proposal.textContent = `${from ? `${from}’s` : 'A'} proposed trade. Change anything you like.`;
  }

  for (const button of document.querySelectorAll('[data-tr-action="complete"], [data-tr-action="send"], [data-tr-action="clear"]')) button.disabled = !any;
  document.querySelector('[data-tr-action="complete"]').disabled = !any || !storage.isStorageOk();
  $('send-label').textContent = partnerName() ? `Send to ${partnerName()}` : 'Send trade';

  const dock = $('dock');
  dock.dataset.tone = verdict.tone;
  $('dock-verdict').textContent = verdict.short;
  $('dock-totals').textContent = any ? `Give ${money(give.value)} · Get ${money(get.value)}` : 'Tap Give or Get on a card, or scan';
  paintMeter($('dock-meter'), b);
}

function availableTabs() {
  return TABS.filter((t) => Boolean(t.friend) === Boolean(state.friend));
}

function currentTab() {
  const tabs = availableTabs();
  return tabs.find((t) => t.id === state.tab) || tabs[state.friend ? 1 : 0];
}

function tabTotals(tab) {
  let value = 0;
  let priced = false;
  let copies = 0;
  for (const item of lists[tab.id]) {
    const qty = tab.id === 'mySpares' ? item.avail : 1;
    const price = valuer.of(item.set, item.card.id).value;
    copies += qty;
    if (price != null) {
      value += price * qty;
      priced = true;
    }
  }
  return { value, priced, copies };
}

function tabCard(tab, current) {
  const items = lists[tab.id];
  const { value, priced, copies } = tabTotals(tab);
  return el('button', {
    type: 'button',
    class: `lst-tab lst-tab--${tab.tone}`,
    'aria-pressed': String(tab.id === current.id),
    onclick() {
      if (tab.id === current.id) return;
      state.tab = tab.id;
      shown = PAGE;
      save();
      renderBrowse();
    },
  },
  el('span', { class: 'lst-tab__label', text: tab.label() }),
  el('b', { class: 'lst-tab__count', text: plural(items.length, 'card', 'cards') }),
  copies > items.length ? el('small', { class: 'lst-tab__note', text: plural(copies, 'copy', 'copies') }) : null,
  priced ? el('span', { class: 'lst-tab__value' }, el('b', { text: money(value) }), ' market value') : null);
}

function chipFor(tab, item) {
  const model = sets.get(item.set).model;
  if (tab.whose === 'mine') {
    if (item.have === 1) return flag('warn', 'Your only copy');
    if (tab.id === 'mySpares' && state.friend && standing(state.friend, item.set, item.card, model).need) return flag('good', `${friendName()} needs this`);
    return flag('info', `You have ${item.have} · ${item.have - 1} spare`);
  }
  if (tab.whose === 'theirs') {
    if (item.have === 1) return flag('warn', 'Their only copy');
    return flag('info', `${friendName()} has ${item.have} · ${item.have - 1} spare`);
  }
  if (!state.friend) return null;
  const theirs = standing(state.friend, item.set, item.card, model);
  return theirs.have ? flag('good', `${friendName()} has ${theirs.have}`) : null;
}

function pickRow(tab, item) {
  const { set, card } = item;
  const price = valuer.of(set, card.id);
  const inTrade = qtyIn(state.draft, tab.side, set, card.id);
  const verb = SIDE_TEXT[tab.side].add;
  const chip = chipFor(tab, item);
  return el('li', { class: 'tr-pick' },
    thumb(set, card),
    el('span', { class: 'pf-row__main' },
      el('b', { text: card.name }),
      el('small', { text: subText(set, card) }),
      chip ? el('span', { class: 'tr-flags' }, chip) : null),
    el('span', { class: 'tr-pick__side' },
      el('b', { text: price.value != null ? money(price.value) : 'n/a' }),
      el('button', {
        type: 'button',
        class: `btn btn--sm ${inTrade ? 'btn--primary' : 'btn--ghost'}`,
        'data-key': `pick|${tab.side}|${set}|${card.id}`,
        'aria-label': `${verb} ${cardName(card)}${inTrade ? `, ${inTrade} in the trade` : ''}`,
        onclick: () => change(tab.side, set, card.id, 1, { speak: true }),
      }, icon('i-plus'), inTrade ? `${verb} · ${inTrade}` : verb)));
}

function emptyText(tab) {
  if (query.trim()) return `No cards match “${query.trim()}”.`;
  const name = state.friend?.name || 'Your friend';
  const started = Object.keys(me.sets).length > 0;
  switch (tab.id) {
    case 'theyHave':
      if (!started) return 'You haven’t started any sets yet, so nothing shows as needed.';
      return state.singles.theirs ? `${name} has nothing you’re missing.` : `${name} has no spares of anything you’re missing. Turn on Include their single copies to see cards they only have one of.`;
    case 'youHave':
      return state.singles.mine ? `You have nothing ${name} is missing.` : `You have no spares of anything ${name} is missing. Turn on Include your single copies to offer cards you only have one of.`;
    case 'mySpares':
      if (!started) return 'Mark the cards you own in any set, or scan them, and your spares show here.';
      return state.singles.mine ? 'You haven’t marked any cards yet.' : 'You don’t have any spare copies yet. Spares are copies beyond your first.';
    default:
      return started ? 'You’re not missing anything in the sets you’re collecting.' : 'Start collecting a set and the cards you’re missing show here.';
  }
}

function filtered(tab) {
  const items = lists[tab.id];
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = terms.length
    ? items.filter((item) => {
      const info = setInfo(item.set);
      const hay = `${item.card.search} ${normalize(info.name)} ${normalize(info.code || '')}`;
      return terms.every((t) => hay.includes(t));
    })
    : items.slice();
  if (state.sort === 'set') {
    return matches.sort((a, b) => (orderById.get(a.set) ?? 1e9) - (orderById.get(b.set) ?? 1e9)
      || positionOf(sets.get(a.set).model, a.card) - positionOf(sets.get(b.set).model, b.card));
  }
  const values = new Map(matches.map((item) => [item, valuer.of(item.set, item.card.id).value ?? -1]));
  return matches.sort((a, b) => values.get(b) - values.get(a) || a.card.name.localeCompare(b.card.name));
}

function renderBrowse() {
  const tab = currentTab();
  $('tabs').replaceChildren(...availableTabs().map((t) => tabCard(t, tab)));
  for (const b of $('sort').querySelectorAll('[data-sort]')) b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort));

  const row = $('singles-row');
  row.hidden = !tab.whose;
  if (tab.whose) {
    const theirs = tab.whose === 'theirs';
    $('singles-label').textContent = theirs ? 'Include their single copies' : 'Include your single copies';
    $('singles-hint').textContent = theirs ? `Show cards ${state.friend?.name || 'they'} only ${state.friend?.name ? 'has' : 'have'} one of` : 'Offer cards you only have one of';
    $('singles').setAttribute('aria-checked', String(state.singles[tab.whose]));
  }

  const items = filtered(tab);
  const list = $('browse');
  if (!items.length) {
    list.replaceChildren(el('li', { class: 'pf-list__empty', text: emptyText(tab) }));
  } else {
    const visible = items.slice(0, shown);
    const rows = [];
    if (state.sort === 'set') {
      const perSet = new Map();
      for (const item of items) perSet.set(item.set, (perSet.get(item.set) || 0) + 1);
      let last = null;
      for (const item of visible) {
        if (item.set !== last) {
          const info = setInfo(item.set);
          rows.push(el('li', { class: 'tr-group' },
            info.logo ? el('img', { class: 'tr-group__logo', src: asset(info.logo), alt: '', loading: 'lazy', decoding: 'async' }) : null,
            el('b', { text: info.name }),
            el('small', { text: plural(perSet.get(item.set), 'card', 'cards') })));
          last = item.set;
        }
        rows.push(pickRow(tab, item));
      }
    } else {
      for (const item of visible) rows.push(pickRow(tab, item));
    }
    list.replaceChildren(...rows);
  }
  const more = $('more');
  more.hidden = items.length <= shown;
  more.textContent = `Show ${count.format(Math.min(PAGE, items.length - shown))} more`;
}

function historyValue(lines, rates) {
  return lines.reduce((sum, l) => (l.usd == null ? sum : sum + (convert(l.usd, valuer.cur, rates) ?? convert(l.usd, valuer.cur, valuer.rates) ?? l.usd) * l.qty), 0);
}

function historyLines(title, lines) {
  return el('div', { class: 'tr-past__group' },
    el('h3', { class: 'tr-past__title', text: title }),
    lines.length
      ? el('ul', { class: 'tr-past__lines' }, ...lines.map((l) => el('li', {}, `${l.name || l.card}${l.variant ? ` (${l.variant})` : ''}${l.qty > 1 ? ` ×${l.qty}` : ''}`, el('small', { text: ` ${l.setName}${l.printed ? ` · ${l.printed}` : ''}` }))))
      : el('p', { class: 'hint hint--small', text: 'Nothing' }));
}

function removeHistory(entry) {
  const before = state.history.slice();
  state.history = state.history.filter((h) => h !== entry);
  save();
  renderHistory();
  toast('Removed from your past trades.', {
    icon: 'i-trash',
    action: {
      label: 'Undo',
      onClick() {
        state.history = before;
        save();
        renderHistory();
      },
    },
  });
}

function renderHistory() {
  const box = $('history-box');
  box.hidden = !state.history.length;
  $('history-title').textContent = `Past trades (${count.format(state.history.length)})`;
  $('history').replaceChildren(...state.history.map((h) => el('li', { class: 'tr-past' },
    el('details', {},
      el('summary', { class: 'tr-past__head' },
        el('b', { text: `${shortDate(h.at)}${h.with ? ` · with ${h.with}` : ''}` }),
        el('small', { text: `Gave ${plural(qtyOf(h.give), 'card', 'cards')} · ${money(historyValue(h.give, h.rates))} → Got ${plural(qtyOf(h.get), 'card', 'cards')} · ${money(historyValue(h.get, h.rates))}` })),
      el('div', { class: 'tr-past__body' },
        historyLines('You gave', h.give),
        historyLines('You got', h.get),
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => removeHistory(h) }, icon('i-trash'), 'Remove from history'))))));
}

function renderNote() {
  const parts = [];
  if (valuer.updated) parts.push(`Market prices from TCGplayer, updated ${priceDate(valuer.updated)}.`);
  if (CONVERTED[valuer.cur]) parts.push(`${CONVERTED[valuer.cur]} values are converted from US dollars, so they’re approximate.`);
  parts.push('Condition isn’t counted, so agree the final values together.');
  $('note').textContent = parts.join(' ');
}

function renderTrade() {
  renderSides();
  renderSummary();
  renderBrowse();
}

function render() {
  renderFriend();
  renderTrade();
  renderHistory();
  renderNote();
}

function change(side, set, cardId, delta, { speak = false } = {}) {
  const key = document.activeElement?.dataset?.key;
  const qty = bump(state.draft, side, set, cardId, delta);
  if (!hasLines(state.draft)) state.draft = emptyDraft();
  save();
  renderTrade();
  if (key) document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  const card = cardOf(set, cardId);
  if (card && (speak || !qty)) announce(qty ? `${cardName(card)}: ${qty} in ${SIDE_TEXT[side].title}` : `Removed ${cardName(card)} from ${SIDE_TEXT[side].title}`);
  return qty;
}

const shareDlg = document.getElementById('dlg-trade-share');
const shareField = (name) => shareDlg.querySelector(`[data-share="${name}"]`);
const shareAction = (name) => shareDlg.querySelector(`[data-share-action="${name}"]`);
let shareRun = 0;
let picked = new Set();

function byCatalog(a, b) {
  return (orderById.get(a) ?? 1e9) - (orderById.get(b) ?? 1e9);
}

const cardsIn = (id) => Object.keys(me.sets[id].q).length;
const shareable = () => Object.keys(me.sets).filter((id) => sets.has(id) && cardsIn(id)).sort(byCatalog);
const pickedIds = () => shareable().filter((id) => picked.has(id));

function showSharePanel(name) {
  for (const panel of shareDlg.querySelectorAll('[data-share-panel]')) panel.hidden = panel.dataset.sharePanel !== name;
}

function renderPicker() {
  const ids = shareable();
  shareField('sets').replaceChildren(...ids.map((id) => {
    const info = setInfo(id);
    return el('li', {}, el('label', { class: 'rcv-set tr-picker__set' },
      el('input', {
        type: 'checkbox',
        checked: picked.has(id),
        onchange(e) {
          if (e.target.checked) picked.add(id);
          else picked.delete(id);
          paintPicker();
        },
      }),
      info.logo
        ? el('img', { class: 'tr-picker__logo', src: asset(info.logo), alt: '', loading: 'lazy', decoding: 'async' })
        : el('span', { class: 'tr-picker__logo', 'aria-hidden': 'true' }),
      el('span', { class: 'rcv-set__main' },
        el('b', { text: info.name }),
        el('small', { text: plural(cardsIn(id), 'card', 'cards') }))));
  }));
  const empty = shareField('sets-empty');
  empty.hidden = ids.length > 0;
  empty.textContent = ids.length ? '' : 'Couldn’t load your sets. Check your connection and try again.';
  shareDlg.querySelector('.tr-picker__head').hidden = !ids.length;
  paintPicker();
}

function paintPicker() {
  shareAction('show').disabled = !pickedIds().length;
}

async function renderShare() {
  const run = ++shareRun;
  const ids = pickedIds();
  if (!ids.length) {
    showSharePanel('pick');
    renderPicker();
    return;
  }
  const cards = ids.reduce((n, id) => n + cardsIn(id), 0);
  shareField('summary').textContent = `${ids.length === 1 ? setInfo(ids[0]).name : plural(ids.length, 'set', 'sets')} · ${plural(cards, 'card', 'cards')}`;
  const qr = shareField('qr');
  const note = shareField('qr-note');
  const url = shareField('url');
  const code = await encodeTrade({
    name: state.name,
    sets: ids.map((id) => ({ model: sets.get(id).model, counts: me.sets[id].q, tier: sets.get(id).model.getTier(me.sets[id].tier).id })),
  });
  if (run !== shareRun) return;
  url.value = `${asset('trade/')}#t=${code}`;
  const result = await renderQr(qr, url.value, { level: 'L', maxModules: 129 });
  if (run !== shareRun) return;
  qr.hidden = result === 'big';
  note.hidden = result !== 'big';
  note.textContent = result === 'big' ? 'Too much for one QR code. Copy the link instead, or choose fewer sets.' : '';
}

function showCode() {
  if (!pickedIds().length) return;
  shareField('qr').replaceChildren();
  shareField('qr').hidden = false;
  shareField('qr-note').hidden = true;
  shareField('url').value = '';
  showSharePanel('code');
  shareAction('copy').focus({ preventScroll: true });
  renderShare();
}

function backToPicker() {
  shareRun++;
  showSharePanel('pick');
  renderPicker();
  shareAction('show').focus({ preventScroll: true });
}

function pickAll(on) {
  picked = new Set(on ? shareable() : []);
  renderPicker();
}

function openShare() {
  if (!Object.keys(me.sets).length) return;
  picked = new Set();
  shareRun++;
  shareField('name').value = state.name;
  shareAction('share').hidden = typeof navigator.share !== 'function';
  showSharePanel('pick');
  renderPicker();
  openDialog(shareDlg);
}

const addDlg = document.getElementById('dlg-trade-add');
const addField = (name) => addDlg.querySelector(`[data-add="${name}"]`);
let addRun = 0;
let addDecoded = null;

async function validateAdd() {
  const run = ++addRun;
  const text = addField('code').value.trim();
  const decoded = text ? await readTradeText(text) : null;
  if (run !== addRun) return;
  addDecoded = decoded && decoded !== UNSUPPORTED ? decoded : null;
  const status = addField('status');
  let message = '';
  if (decoded === UNSUPPORTED) {
    message = 'This code needs a newer browser. Update your browser and try again.';
  } else if (decoded?.kind === 'proposal') {
    const lines = decoded.sets.reduce((n, s) => n + s.give.length + s.get.length, 0);
    message = `✓ Proposed trade${decoded.name ? ` from ${decoded.name}` : ''} · ${plural(lines, 'card', 'cards')}`;
  } else if (decoded) {
    const cards = decoded.sets.reduce((n, s) => n + s.decoded.owned.length, 0);
    const who = decoded.name || (decoded.source === 'sync' ? 'Shared collection' : 'Trade code');
    message = `✓ ${who} · ${plural(decoded.sets.length, 'set', 'sets')} · ${plural(cards, 'card', 'cards')}`;
  } else if (text) {
    message = 'That isn’t a trade code or link.';
  }
  status.textContent = message;
  status.classList.toggle('is-ok', Boolean(addDecoded));
  status.classList.toggle('is-bad', Boolean(text) && !addDecoded);
  const submit = addField('submit');
  submit.disabled = !addDecoded;
  submit.textContent = addDecoded?.kind === 'proposal' ? 'Open trade' : 'Compare';
}

async function scanCode() {
  const text = await scanQr({ accept: async (value) => Boolean(await readTradeText(value)) });
  if (!text) {
    openDialog(addDlg);
    return;
  }
  addField('code').value = '';
  openIncoming(await readTradeText(text));
}

const sendDlg = document.getElementById('dlg-trade-send');
const sendField = (name) => sendDlg.querySelector(`[data-send="${name}"]`);
let sendRun = 0;

async function renderSend() {
  const run = ++sendRun;
  const groups = new Map();
  for (const side of SIDES) {
    for (const line of state.draft[side]) {
      const model = sets.get(line.set)?.model;
      const card = model?.cardById.get(line.card);
      if (!card) continue;
      if (!groups.has(line.set)) groups.set(line.set, { key: model.syncKey, give: [], get: [] });
      groups.get(line.set)[side].push([card.idx, line.qty]);
    }
  }
  const code = await encodeProposal({ id: state.draft.id, name: state.name, sets: [...groups.values()] });
  if (run !== sendRun) return;
  sendField('url').value = `${asset('trade/')}#p=${code}`;
  await renderQr(sendField('qr'), sendField('url').value, { level: 'M' });
}

function openSend() {
  if (!hasLines(state.draft)) return;
  state.draft.id ||= newId();
  save();
  sendField('hint').replaceChildren(`${partnerName() || 'Your friend'} scans this to open the same trade on their phone, then taps `, el('b', { text: 'Update my collection' }), ' there.');
  sendField('name').value = state.name;
  sendDlg.querySelector('[data-send-action="share"]').hidden = typeof navigator.share !== 'function';
  sendField('qr').replaceChildren();
  sendField('url').value = '';
  openDialog(sendDlg);
  renderSend();
}

function statusLines(set, card, model) {
  const lines = [];
  const mine = standing(me, set, card, model);
  if (mine.have > 1) lines.push(`You have ${mine.have} · ${mine.have - 1} spare`);
  else if (mine.have === 1) lines.push('You have 1, your only copy');
  else if (mine.need) lines.push('You need this');
  else lines.push(mine.started ? 'You don’t have this, and it isn’t in your goal for this set' : 'You don’t have this');
  if (state.friend) {
    const name = friendName();
    const theirs = standing(state.friend, set, card, model);
    if (theirs.have > 1) lines.push(`${name} has ${theirs.have} · ${theirs.have - 1} spare`);
    else if (theirs.have === 1) lines.push(`${name} has 1, their only copy`);
    else if (theirs.unknown) lines.push(`${state.friend.name ? `${state.friend.name}’s` : 'Their'} code is older than this card`);
    else lines.push(theirs.need ? `${name} needs this` : `${name} doesn’t have this`);
  }
  const give = qtyIn(state.draft, 'give', set, card.id);
  const get = qtyIn(state.draft, 'get', set, card.id);
  if (give || get) lines.push(`In this trade: ${[give && `you give ${give}`, get && `you get ${get}`].filter(Boolean).join(', ')}`);
  return lines;
}

function suggestSide(set, card, model) {
  const mine = standing(me, set, card, model);
  if (state.friend) {
    const theirs = standing(state.friend, set, card, model);
    if (theirs.need && mine.have) return 'give';
    if (mine.need && theirs.have) return 'get';
  }
  if (!mine.have) return 'get';
  return mine.have > 1 ? 'give' : null;
}

function scanHooks() {
  return {
    status: ({ set, card, model }) => statusLines(set, card, model),
    suggest: ({ set, card, model }) => suggestSide(set, card, model),
    add({ set, card, side }) {
      const qty = change(side, set, card.id, 1);
      ensureSet(set);
      return qty;
    },
    remove({ set, card, side }) {
      change(side, set, card.id, -1);
    },
    tally() {
      const give = qtyOf(state.draft.give);
      const get = qtyOf(state.draft.get);
      return give + get ? `Give ${give} · Get ${get}` : '';
    },
    items: () => SIDES.map((side) => ({
      title: SIDE_TEXT[side].title,
      total: money(totalOf(state.draft[side], valuer).value),
      lines: state.draft[side].map((line) => {
        const card = cardOf(line.set, line.card);
        return {
          name: card ? cardName(card) : 'Loading…',
          sub: `${setInfo(line.set).name}${card ? ` · ${card.printed}` : ''}`,
          qty: line.qty,
          remove: () => change(side, line.set, line.card, -1),
        };
      }),
    })),
    summary: () => {
      const { verdict } = currentVerdict();
      return verdict.detail ? `${verdict.text}. ${verdict.detail}.` : verdict.text;
    },
  };
}

function openScan() {
  import('../scan/scan.js').then(
    (m) => m.openScanner({ title: 'Scan for this trade', trade: scanHooks() }),
    () => toast('Couldn’t load the scanner. Check your connection and try again.'),
  );
}

function historyEntry() {
  const lines = (side) => state.draft[side].map((l) => {
    const card = cardOf(l.set, l.card);
    return {
      set: l.set, card: l.card, qty: l.qty,
      name: card?.name || '', printed: card?.printed || '', variant: card?.variant || '', setName: setInfo(l.set).name,
      usd: valuer.of(l.set, l.card).usd,
    };
  });
  return { id: state.draft.id || newId(), at: Date.now(), with: state.friend?.name || state.draft.proposal?.from || '', give: lines('give'), get: lines('get'), rates: valuer.rates };
}

const snapshot = () => JSON.parse(JSON.stringify({ draft: state.draft, friend: state.friend, history: state.history }));

function refreshAll() {
  refreshMe();
  return ensureLoaded().then(() => {
    recompute();
    render();
  });
}

const doneDlg = document.getElementById('dlg-trade-complete');
const doneField = (name) => doneDlg.querySelector(`[data-done="${name}"]`);

function confirmComplete(notes) {
  const who = partnerName();
  doneField('text').replaceChildren(
    'This changes your cards on ',
    el('b', { text: 'this device only' }),
    `. If ${who || 'the person you’re trading with'} uses Binder Tracker, they need to update theirs on their own phone too, so send them the trade.`,
  );
  const list = doneField('notes');
  list.hidden = !notes.length;
  list.replaceChildren(...notes.map((text) => el('li', { text })));
  doneField('send-label').textContent = who ? `Send to ${who}` : 'Send trade';
  return new Promise((resolve) => {
    let answer = null;
    const onClick = (e) => {
      const btn = e.target.closest('[data-done="yes"], [data-done="send"]');
      if (!btn) return;
      answer = btn.dataset.done;
      closeDialog(doneDlg);
    };
    doneDlg.addEventListener('click', onClick);
    doneDlg.addEventListener('close', () => {
      doneDlg.removeEventListener('click', onClick);
      resolve(answer);
    }, { once: true });
    openDialog(doneDlg);
    doneField('yes').focus({ preventScroll: true });
  });
}

async function complete() {
  if (!hasLines(state.draft) || !storage.isStorageOk()) return;
  await ensureLoaded();
  const plan = planTrade(state.draft, sets);
  const notes = [];
  if (plan.missing.length) notes.push(`${plural(qtyOf(plan.missing), 'card', 'cards')} you’re giving ${qtyOf(plan.missing) === 1 ? 'isn’t' : 'aren’t'} in your collection, so ${qtyOf(plan.missing) === 1 ? 'its count stays' : 'their counts stay'} at 0.`);
  if (plan.capped.length) notes.push(`Some cards you’re getting would go past ${storage.MAX_QTY} copies, the most this site counts.`);
  const done = state.draft.id && state.history.find((h) => h.id === state.draft.id);
  if (done) notes.push(`You already updated your collection with this trade on ${shortDate(done.at)}.`);
  const answer = await confirmComplete(notes);
  if (answer === 'send') {
    openSend();
    return;
  }
  if (answer !== 'yes' || !hasLines(state.draft)) return;
  const before = snapshot();
  const result = applyTrade(planTrade(state.draft, sets));
  if (!storage.isStorageOk()) {
    result.undo();
    toast('Couldn’t save. Your browser may be blocking storage.');
    return;
  }
  const gave = qtyOf(state.draft.give);
  const got = qtyOf(state.draft.get);
  pushHistory(state, historyEntry());
  if (state.friend) adjustFriend(state.friend, state.draft);
  state.draft = emptyDraft();
  save();
  storage.requestPersistence();
  await refreshAll();
  toast(`Collection updated. You gave ${plural(gave, 'card', 'cards')} and got ${plural(got, 'card', 'cards')}.`, {
    icon: 'i-check',
    timeout: 10000,
    action: {
      label: 'Undo',
      onClick() {
        result.undo();
        Object.assign(state, before);
        save();
        refreshAll().then(() => toast('Trade undone. Your collection is back as it was.', { icon: 'i-undo' }));
      },
    },
  });
}

function clearDraft() {
  if (!hasLines(state.draft)) return;
  const before = state.draft;
  state.draft = emptyDraft();
  save();
  renderTrade();
  toast('Trade cleared.', {
    icon: 'i-trash',
    action: {
      label: 'Undo',
      onClick() {
        state.draft = before;
        save();
        renderTrade();
      },
    },
  });
}

function setFriend(friend) {
  state.friend = friend;
  shown = PAGE;
  save();
  return ensureLoaded().then(() => {
    recompute();
    render();
  });
}

function clearFriend() {
  const before = state.friend;
  if (!before) return;
  setFriend(null);
  toast(`Stopped comparing with ${before.name || 'your friend'}.`, { action: { label: 'Undo', onClick: () => setFriend(before) } });
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

async function openFriend(decoded) {
  const before = state.friend;
  const friend = await resolveFriend(decoded, catalog);
  if (!TABS.find((t) => t.id === state.tab)?.friend) state.tab = 'theyHave';
  await setFriend(friend);
  const name = friend.name || 'your friend';
  const message = Object.keys(friend.sets).length
    ? `Now comparing with ${name}.`
    : 'That code has no cards from sets this version of the site knows.';
  toast(message, { icon: 'i-swap', action: before ? { label: 'Undo', onClick: () => setFriend(before) } : undefined });
  scrollToId('tr-browse-title');
}

async function openProposal(decoded) {
  const proposal = await resolveProposal(decoded, catalog);
  const whose = proposal.from ? `${proposal.from}’s` : 'this';
  if (!proposal.give.length && !proposal.get.length) {
    toast('That trade only has cards from sets this version of the site doesn’t know yet. Refresh to update.', { timeout: 8000 });
    return;
  }
  if (hasLines(state.draft) && state.draft.id !== proposal.id
    && !(await confirmAction({ title: `Open ${whose} trade?`, text: 'It replaces the trade you’re putting together. You can undo straight after.', confirmLabel: 'Open trade' }))) return;
  const before = state.draft;
  state.draft = { give: proposal.give, get: proposal.get, id: proposal.id, proposal: { id: proposal.id, from: proposal.from }, updated: Date.now() };
  save();
  await ensureLoaded();
  recompute();
  render();
  const extra = proposal.unknown ? ` ${plural(proposal.unknown, 'card is', 'cards are')} from sets this version doesn’t know yet, so ${proposal.unknown === 1 ? 'it’s' : 'they’re'} left out. Refresh to update.` : '';
  toast(`Opened ${proposal.from ? `${proposal.from}’s` : 'a'} proposed trade.${extra}`, {
    icon: 'i-swap',
    timeout: extra ? 9000 : 4500,
    action: hasLines(before) ? {
      label: 'Undo',
      onClick() {
        state.draft = before;
        save();
        refreshAll();
      },
    } : undefined,
  });
  scrollToId('tr-summary-title');
}

async function openIncoming(decoded) {
  if (decoded === UNSUPPORTED) {
    toast('This link needs a newer browser. Update your browser, then open it again.', { timeout: 8000 });
    return;
  }
  if (!decoded) {
    toast('That trade link isn’t valid.');
    return;
  }
  try {
    if (decoded.kind === 'proposal') await openProposal(decoded);
    else await openFriend(decoded);
  } catch {
    toast('Couldn’t load that code. Check your connection and try again.');
  }
}

async function checkHash() {
  const m = /#([tp])=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  await openIncoming(await readTradeText(m[0]));
}

async function share(url, title) {
  try {
    await navigator.share({ title, url });
  } catch {}
}

async function copyLink(input, message) {
  if (!input.value) return;
  const ok = await copyText(input.value);
  if (!ok) input.select();
  toast(ok ? message : 'Select the link and copy it manually.', { icon: 'i-copy' });
}

const debounce = (fn, ms) => {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

const actions = {
  share: openShare,
  add: () => openDialog(addDlg),
  'clear-friend': clearFriend,
  scan: openScan,
  complete,
  send: openSend,
  clear: clearDraft,
  guide: openGuide,
  'to-summary': () => scrollToId('tr-summary-title'),
};

function wire() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tr-action]');
    if (t && !t.disabled) actions[t.dataset.trAction]?.();
  });
  $('sort').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    state.sort = b.dataset.sort;
    shown = PAGE;
    save();
    renderBrowse();
  });
  $('singles').addEventListener('click', () => {
    const tab = currentTab();
    if (!tab.whose) return;
    state.singles[tab.whose] = !state.singles[tab.whose];
    shown = PAGE;
    save();
    recompute();
    renderFriend();
    renderTrade();
  });
  $('search').addEventListener('input', (e) => {
    query = e.target.value;
    shown = PAGE;
    renderBrowse();
  });
  $('more').addEventListener('click', () => {
    shown += PAGE;
    renderBrowse();
  });

  const renameShare = debounce(() => {
    state.name = cleanName(shareField('name').value);
    save();
    renderShare();
  }, 300);
  shareField('name').addEventListener('input', renameShare);
  shareAction('all').addEventListener('click', () => pickAll(true));
  shareAction('none').addEventListener('click', () => pickAll(false));
  shareAction('show').addEventListener('click', showCode);
  shareAction('back').addEventListener('click', backToPicker);
  shareAction('copy').addEventListener('click', () => copyLink(shareField('url'), 'Link copied. Send it to your friend.'));
  shareAction('share').addEventListener('click', () => share(shareField('url').value, 'My trade code'));

  const renameSend = debounce(() => {
    state.name = cleanName(sendField('name').value);
    save();
    renderSend();
  }, 300);
  sendField('name').addEventListener('input', renameSend);
  sendDlg.querySelector('[data-send-action="copy"]').addEventListener('click', () => copyLink(sendField('url'), 'Link copied. Send it to your friend.'));
  sendDlg.querySelector('[data-send-action="share"]').addEventListener('click', () => share(sendField('url').value, 'Our trade'));

  addField('code').addEventListener('input', validateAdd);
  addField('code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addField('submit').click();
    }
  });
  addField('submit').addEventListener('click', () => {
    const decoded = addDecoded;
    if (!decoded) return;
    addField('code').value = '';
    closeDialog(addDlg);
    openIncoming(decoded);
  });
  addField('scan').addEventListener('click', scanCode);
  addDlg.addEventListener('dialog:open', () => {
    validateAdd();
    setTimeout(() => addField('scan').focus({ preventScroll: true }), 60);
  });

  storage.onPrefChange((key) => {
    if (key !== 'currency' || !ready) return;
    recompute();
    render();
  });
  window.addEventListener('storage', (e) => {
    if (!ready) return;
    if (isTradeKey(e.key)) {
      state = readTrade();
      refreshAll();
    } else if (storage.isCollectionKey(e.key)) {
      refreshAll();
    }
  });
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted || !ready) return;
    state = readTrade();
    refreshAll();
  });
  window.addEventListener('hashchange', checkHash);
}

async function init() {
  initDialogs();
  initHeader();
  if (!storage.isStorageOk()) document.getElementById('storage-banner').hidden = false;
  initInstallBanner();
  wire();
  initGuide();
  try {
    catalog = await loadCatalog();
  } catch {
  }
  indexCatalog();
  refreshMe();
  await ensureLoaded();
  recompute();
  ready = true;
  render();
  hideLoader();
  initPWA();
  if (!storage.getPrefs().tradeGuideSeen) await openGuide();
  await checkHash();
}

init();
