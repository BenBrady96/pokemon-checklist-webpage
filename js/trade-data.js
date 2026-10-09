import { fetchCollection, fetchPrices } from './collection.js';
import { resolveCode } from './codec.js';
import { applyEntries } from './transfer.js';
import * as storage from './storage.js';
import { convert, ratesOf, shownCurrency } from './pricing.js';

const KEY = 'bt:v1:trade';
const MAX_HISTORY = 50;
const TABS = ['theyHave', 'youHave', 'mySpares', 'myNeeds', 'theirSpares'];
export const SIDES = ['give', 'get'];

export const emptyDraft = () => ({ give: [], get: [], id: null, proposal: null, updated: 0 });

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanCounts(q) {
  const out = {};
  if (!isObject(q)) return out;
  for (const [id, n] of Object.entries(q)) {
    const v = storage.clampQty(n);
    if (v > 0) out[id] = v;
  }
  return out;
}

function cleanLines(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((l) => isObject(l) && typeof l.set === 'string' && typeof l.card === 'string')
    .map((l) => ({ set: l.set, card: l.card, qty: storage.clampQty(l.qty) }))
    .filter((l) => l.qty > 0);
}

function cleanFriend(f) {
  if (!isObject(f) || !isObject(f.sets)) return null;
  const sets = {};
  for (const [id, s] of Object.entries(f.sets)) {
    if (!isObject(s)) continue;
    sets[id] = { tier: typeof s.tier === 'string' ? s.tier : null, n: Number.isFinite(s.n) ? s.n : null, q: cleanCounts(s.q) };
  }
  return { name: text(f.name, 40), created: Number(f.created) || 0, received: Number(f.received) || 0, unknown: Number(f.unknown) || 0, sets };
}

function cleanHistoryLines(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(isObject).map((l) => ({
    set: text(l.set, 120), card: text(l.card, 40), qty: storage.clampQty(l.qty) || 1,
    name: text(l.name), printed: text(l.printed, 40), variant: text(l.variant, 40), setName: text(l.setName),
    usd: Number.isFinite(l.usd) ? l.usd : null,
  }));
}

function cleanHistory(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(isObject).slice(0, MAX_HISTORY).map((h) => ({
    id: text(h.id, 16), at: Number(h.at) || 0, with: text(h.with, 40),
    give: cleanHistoryLines(h.give), get: cleanHistoryLines(h.get),
    rates: { gbp: Number(h.rates?.gbp) || 0, eur: Number(h.rates?.eur) || 0 },
  }));
}

export function readTrade() {
  const saved = storage.read(KEY);
  const s = isObject(saved) ? saved : {};
  const draft = isObject(s.draft) ? s.draft : {};
  return {
    v: 1,
    name: text(s.name, 40),
    singles: { mine: Boolean(s.singles?.mine), theirs: Boolean(s.singles?.theirs) },
    tab: TABS.includes(s.tab) ? s.tab : 'mySpares',
    sort: s.sort === 'set' ? 'set' : 'value',
    shareExclude: Array.isArray(s.shareExclude) ? s.shareExclude.filter((id) => typeof id === 'string') : [],
    friend: cleanFriend(s.friend),
    draft: {
      give: cleanLines(draft.give),
      get: cleanLines(draft.get),
      id: /^[0-9a-f]{8}$/.test(draft.id) ? draft.id : null,
      proposal: isObject(draft.proposal) ? { id: text(draft.proposal.id, 16), from: text(draft.proposal.from, 40) } : null,
      updated: Number(draft.updated) || 0,
    },
    history: cleanHistory(s.history),
  };
}

export const saveTrade = (state) => storage.write(KEY, state);
export const isTradeKey = (key) => key === KEY;

export async function loadSets(ids) {
  const sets = new Map();
  const failed = [];
  await Promise.all([...new Set(ids)].map(async (id) => {
    try {
      const [model, prices] = await Promise.all([fetchCollection(id, { images: true }), fetchPrices(id)]);
      sets.set(id, { id, model, prices, rates: ratesOf(prices) });
    } catch {
      failed.push(id);
    }
  }));
  return { sets, failed };
}

export function mySide(known) {
  const { tiers } = storage.getPrefs();
  const sets = {};
  for (const { id } of storage.storedCollections()) {
    if (known(id)) sets[id] = { tier: tiers[id] || null, n: null, q: storage.readCounts(id) };
  }
  return { sets };
}

const findEntry = (catalog, decoded) => catalog.collections.find((c) => (decoded.collection ? c.id === decoded.collection : c.syncKey === decoded.key));

export async function resolveFriend(decoded, catalog) {
  const sets = {};
  let unknown = 0;
  await Promise.all(decoded.sets.map(async ({ tier, decoded: d }) => {
    const entry = findEntry(catalog, d);
    if (!entry) {
      unknown++;
      return;
    }
    const model = await fetchCollection(entry.id, { images: true });
    const q = resolveCode(d, model);
    if (!Object.keys(q).length) return;
    sets[entry.id] = { tier, n: d.n ?? null, q };
  }));
  return { name: decoded.name, created: decoded.created, received: Date.now(), unknown, sets };
}

export async function resolveProposal(decoded, catalog) {
  const give = [];
  const get = [];
  let unknown = 0;
  await Promise.all(decoded.sets.map(async ({ key, give: theirGive, get: theirGet }) => {
    const entry = catalog.collections.find((c) => c.syncKey === key);
    if (!entry) {
      unknown += theirGive.length + theirGet.length;
      return;
    }
    const model = await fetchCollection(entry.id, { images: true });
    const byIdx = new Map(model.cards.map((c) => [c.idx, c]));
    for (const [lines, into] of [[theirGive, get], [theirGet, give]]) {
      for (const [idx, qty] of lines) {
        const card = byIdx.get(idx);
        if (card) into.push({ set: entry.id, card: card.id, qty });
        else unknown++;
      }
    }
  }));
  return { id: decoded.id, from: decoded.name, give, get, unknown };
}

export const countOf = (side, setId, cardId) => side?.sets[setId]?.q[cardId] || 0;

export function standing(side, setId, card, model) {
  const s = side?.sets[setId];
  const have = s?.q[card.id] || 0;
  const unknown = Boolean(s) && s.n != null && card.idx >= s.n;
  const need = Boolean(s) && !have && !unknown && model.inTier(card, s.tier);
  return { started: Boolean(s), have, need, unknown };
}

export const spareOf = (have, singles) => Math.max(0, have - (singles ? 0 : 1));

function sparesOf(side, sets, singles) {
  const out = [];
  if (!side) return out;
  for (const [setId, s] of Object.entries(side.sets)) {
    const loaded = sets.get(setId);
    if (!loaded) continue;
    for (const [cardId, have] of Object.entries(s.q)) {
      const card = loaded.model.cardById.get(cardId);
      const avail = spareOf(have, singles);
      if (card && avail > 0) out.push({ set: setId, card, have, avail });
    }
  }
  return out;
}

function needsOf(side, sets) {
  const out = [];
  if (!side) return out;
  for (const [setId, s] of Object.entries(side.sets)) {
    const loaded = sets.get(setId);
    if (!loaded) continue;
    for (const card of loaded.model.getTier(s.tier).cards) {
      if (!s.q[card.id] && (s.n == null || card.idx < s.n)) out.push({ set: setId, card, have: 0, avail: 0 });
    }
  }
  return out;
}

const needs = (side, item, sets) => standing(side, item.set, item.card, sets.get(item.set).model).need;

export function buildLists({ me, friend, sets, singles }) {
  const mySpares = sparesOf(me, sets, singles.mine);
  const theirSpares = sparesOf(friend, sets, singles.theirs);
  return {
    mySpares,
    myNeeds: needsOf(me, sets),
    theirSpares,
    theyHave: friend ? theirSpares.filter((item) => needs(me, item, sets)) : [],
    youHave: friend ? mySpares.filter((item) => needs(friend, item, sets)) : [],
  };
}

export function makeValuer(sets, currency) {
  const loaded = [...sets.values()].filter((s) => s.prices?.cards);
  const latest = loaded
    .filter((s) => convert(1, currency, s.rates) != null)
    .sort((a, b) => String(b.prices.updated || '').localeCompare(String(a.prices.updated || '')))[0];
  const fallback = latest?.rates || { gbp: 0, eur: 0 };
  const cur = shownCurrency(currency, fallback);
  const updated = loaded.map((s) => s.prices.updated || '').sort().at(-1) || '';
  return {
    cur,
    rates: fallback,
    updated,
    of(setId, cardId) {
      const s = sets.get(setId);
      const entry = s?.prices?.cards?.[cardId];
      if (!entry) return { value: null, from: null, usd: null };
      const rates = convert(1, cur, s.rates) != null ? s.rates : fallback;
      return {
        value: entry.usd != null ? convert(entry.usd, cur, rates) : null,
        from: entry.from != null ? convert(entry.from, cur, rates) : null,
        usd: entry.usd ?? null,
      };
    },
  };
}

export function totalOf(lines, valuer) {
  let value = 0;
  let unpriced = 0;
  let cards = 0;
  for (const line of lines) {
    const price = valuer.of(line.set, line.card).value;
    cards += line.qty;
    if (price == null) unpriced += line.qty;
    else value += price * line.qty;
  }
  return { value, unpriced, cards };
}

export function balance(give, get) {
  const diff = get - give;
  const big = Math.max(give, get);
  if (big <= 0) return { diff: 0, dir: 'none', lean: 0, band: 0 };
  const threshold = Math.max(1, big * 0.05);
  return {
    diff,
    dir: Math.abs(diff) <= threshold ? 'even' : diff > 0 ? 'up' : 'down',
    lean: Math.max(-1, Math.min(1, diff / big)),
    band: Math.min(1, threshold / big),
  };
}

export const lineOf = (draft, side, set, card) => draft[side].find((l) => l.set === set && l.card === card) || null;
export const qtyIn = (draft, side, set, card) => lineOf(draft, side, set, card)?.qty || 0;
export const hasLines = (draft) => draft.give.length + draft.get.length > 0;

export function bump(draft, side, set, card, delta) {
  const list = draft[side];
  const i = list.findIndex((l) => l.set === set && l.card === card);
  const qty = storage.clampQty((i < 0 ? 0 : list[i].qty) + delta);
  if (i < 0 && qty) list.unshift({ set, card, qty });
  else if (i >= 0 && qty) list[i].qty = qty;
  else if (i >= 0) list.splice(i, 1);
  draft.updated = Date.now();
  return qty;
}

export function planTrade(draft, sets) {
  const ids = new Set([...draft.give, ...draft.get].map((l) => l.set));
  const entries = [];
  const missing = [];
  const capped = [];
  for (const id of ids) {
    const before = storage.readCounts(id);
    const after = { ...before };
    for (const line of draft.give) {
      if (line.set !== id) continue;
      const have = after[line.card] || 0;
      if (have < line.qty) missing.push(line);
      after[line.card] = storage.clampQty(have - line.qty);
    }
    for (const line of draft.get) {
      if (line.set !== id) continue;
      const next = (after[line.card] || 0) + line.qty;
      if (next > storage.MAX_QTY) capped.push(line);
      after[line.card] = storage.clampQty(next);
    }
    entries.push({ id, model: sets.get(id)?.model, counts: after });
  }
  return { entries, missing, capped };
}

export const applyTrade = (plan) => applyEntries(plan.entries, 'replace');

export function adjustFriend(friend, draft) {
  const move = (line, delta) => {
    const s = (friend.sets[line.set] ||= { tier: null, n: null, q: {} });
    const next = storage.clampQty((s.q[line.card] || 0) + delta);
    if (next) s.q[line.card] = next;
    else delete s.q[line.card];
  };
  for (const line of draft.give) move(line, line.qty);
  for (const line of draft.get) move(line, -line.qty);
}

export function pushHistory(state, entry) {
  state.history.unshift(entry);
  state.history.length = Math.min(state.history.length, MAX_HISTORY);
}
