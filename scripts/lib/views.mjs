import { CONFIG, GAMES, LIVE_GAMES, dataDir, loadRaw } from './collections.mjs';
import { join } from 'node:path';
import { ROOT, readJson } from './util.mjs';
import { viewDataPath, viewThumb } from '../../public/js/core/view.js';
import { valueUsd, ratesOf } from '../../public/js/core/pricing.js';
import { GROUPS as POKEMON_GROUPS, TRAINERS } from '../../config/views/pokemon.mjs';
import { CHARACTERS as YUGIOH_CHARACTERS } from '../../config/views/yugioh.mjs';

export const INDEX_MIN = 10;
export const MIN_ARTIST_CARDS = 25;
export const MIN_ARCHETYPE_PRINTS = 50;
export const MIN_FRANCHISE_CARDS = 10;
export const VIEW_FOLDERS = ['characters', 'artists', 'groups'];

const OTHER_SECTION = 'other';
const OTHER_NAME = 'Other prints';
const FEATURING_SECTION = 'featuring';
const THUMB_SKIP = new Set(['RGB']);
const CARD_KEEP = ['num', 'printed', 'name', 'rarity', 'type', 'ctype', 'variant', 'print', 'badge', 'foil', 'note', 'keywords', 'stats'];
const PRICE_KEEP = ['tcg', 'usd', 'ed', 'from', 'eur'];

export const slugify = (name) => name
  .replace(/♀/g, ' f').replace(/♂/g, ' m')
  .normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/['’".]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const plainName = (name) => name.replace(/’/g, "'");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const trainerMatcher = ({ name, match }) => match || new RegExp(`^${escapeRe(name)}(?:'s\\b|$| \\(| -| \\[)|(?:Orders|Research) \\[${escapeRe(name)}\\]`);

async function loadGameSets(game) {
  const sets = [];
  for (const entry of CONFIG.filter((e) => e.game === game)) {
    const raw = await loadRaw(entry.id);
    if (!raw?.cards?.length) continue;
    const [images, prices] = await Promise.all([
      readJson(join(dataDir(entry.id), 'images.json'), {}),
      readJson(join(dataDir(entry.id), 'prices.json'), null),
    ]);
    sets.push({ id: entry.id, slug: entry.slug, raw, images: images || {}, prices });
  }
  return sets;
}

const tagFile = (name) => readJson(join(ROOT, 'config', 'views', name), {});

class Roster {
  constructor(game) {
    this.game = game;
    this.views = new Map();
  }

  add(kind, name, set, card, role = null, featuring = false) {
    const slug = slugify(name);
    const id = `${this.game}/${kind}/${slug}`;
    let view = this.views.get(id);
    if (!view) {
      view = { id, game: this.game, kind, slug, name, role, members: new Map() };
      this.views.set(id, view);
    }
    if (view.role !== role) throw new Error(`${id}: used for both ${view.role || 'a character'} and ${role || 'a character'}`);
    const key = `${set.id}|${card.id}`;
    if (!featuring || !view.members.has(key)) view.members.set(key, { set, card, featuring });
  }

  drop(kind, min) {
    for (const [id, view] of this.views) if (view.kind === kind && view.members.size < min) this.views.delete(id);
  }
}

async function pokemonRoster(sets) {
  const roster = new Roster('pokemon');
  const tags = await tagFile('tags-pokemon.json');
  const species = await tagFile('species-pokemon.json');
  const trainers = TRAINERS.map((t) => ({ name: t.name, test: trainerMatcher(t) }));
  const groups = POKEMON_GROUPS.map((g) => ({ name: g.name, dex: g.dex ? new Set(g.dex) : null, test: g.match || null }));
  const artistNames = new Map();
  for (const setTags of Object.values(tags)) {
    for (const [, artist] of Object.values(setTags)) {
      if (!artist) continue;
      const key = artist.toLowerCase();
      const seen = artistNames.get(key) || new Map();
      seen.set(artist, (seen.get(artist) || 0) + 1);
      artistNames.set(key, seen);
    }
  }
  const artistName = (artist) => [...artistNames.get(artist.toLowerCase())].sort((a, b) => b[1] - a[1])[0][0];
  for (const set of sets) {
    const setTags = tags[set.slug] || {};
    for (const card of set.raw.cards) {
      const [dex, artist] = setTags[card.img || card.id] || [0, 0];
      const dexIds = dex || [];
      for (const d of dexIds) if (species[d]) roster.add('characters', species[d], set, card);
      const name = plainName(card.name);
      for (const t of trainers) if (t.test.test(name)) roster.add('characters', t.name, set, card, 'trainer');
      for (const g of groups) {
        if ((g.dex && dexIds.some((d) => g.dex.has(d))) || (g.test && g.test.test(name))) roster.add('groups', g.name, set, card);
      }
      if (artist) roster.add('artists', artistName(artist), set, card);
    }
  }
  roster.drop('artists', MIN_ARTIST_CARDS);
  return roster;
}

async function lorcanaRoster(sets) {
  const roster = new Roster('lorcana');
  const tags = await tagFile('tags-lorcana.json');
  for (const set of sets) {
    const setTags = tags[set.slug] || {};
    for (const card of set.raw.cards) {
      const [story, artists] = setTags[card.img || card.id] || [0, []];
      if (/\bCharacter\b/.test(card.stats?.t || '')) {
        for (const who of card.name.split(' - ')[0].split(' & ')) roster.add('characters', who.trim(), set, card);
      }
      if (story) roster.add('groups', story === 'Lorcana' ? 'Lorcana originals' : story, set, card);
      for (const artist of artists) roster.add('artists', artist, set, card);
    }
  }
  roster.drop('groups', MIN_FRANCHISE_CARDS);
  roster.drop('artists', MIN_ARTIST_CARDS);
  return roster;
}

async function yugiohRoster(sets) {
  const roster = new Roster('yugioh');
  const tags = await tagFile('tags-yugioh.json');
  const featured = new Map();
  for (const [who, { text, art }] of Object.entries(await tagFile('featuring-yugioh.json'))) {
    for (const name of [...text, ...art]) featured.set(name, [...(featured.get(name) || []), who]);
  }
  for (const set of sets) {
    for (const card of set.raw.cards) {
      if (card.ctype === 'monster') {
        for (const c of YUGIOH_CHARACTERS) if (c.match.test(card.name)) roster.add('characters', c.name, set, card);
      }
      for (const who of featured.get(card.name) || []) roster.add('characters', who, set, card, null, true);
      const archetype = tags[String(card.img)];
      if (archetype) roster.add('groups', archetype, set, card);
    }
  }
  roster.drop('groups', MIN_ARCHETYPE_PRINTS);
  return roster;
}

const ROSTERS = { pokemon: pokemonRoster, yugioh: yugiohRoster, lorcana: lorcanaRoster };

const pick = (card, keep = CARD_KEEP) => Object.fromEntries(keep.filter((k) => card[k] != null).map((k) => [k, card[k]]));

function viewData(view) {
  const game = GAMES[view.game];
  const members = [...view.members.values()].sort((a, b) => String(a.set.raw.released || '').localeCompare(String(b.set.raw.released || ''))
    || a.set.id.localeCompare(b.set.id) || a.card.idx - b.card.idx);

  const setIndex = new Map();
  const setRows = [];
  const displays = [];
  const displayIndex = new Map();
  const eras = new Map();
  let rates = null;
  const cards = [];
  for (const { set, card, featuring } of members) {
    let s = setIndex.get(set.id);
    if (s == null) {
      s = setRows.length;
      setIndex.set(set.id, s);
      const row = { id: set.id, name: set.raw.name, key: set.raw.syncKey, released: set.raw.released || null };
      if (set.images.remote?.base) row.base = set.images.remote.base;
      if (set.images.remote?.sizes) row.sizes = set.images.remote.sizes;
      setRows.push(row);
    }
    if (set.prices && (!rates || String(set.prices.updated || '') > String(rates.updated || ''))) {
      rates = { updated: set.prices.updated || null, cmUpdated: set.prices.cmUpdated || null, gbpPerUsd: set.prices.gbpPerUsd || 0, eurPerUsd: set.prices.eurPerUsd || 0 };
    }
    const section = set.raw.sections.find((x) => x.id === card.section);
    const fmt = { ...game.DISPLAY, ...set.raw.display, ...section?.display, ...card.display };
    const shown = { ...fmt, number: `{set} · ${fmt.number}`, label: `{set} ${fmt.label}`, list: `{set}: ${fmt.list}` };
    const key = JSON.stringify(shown);
    let dp = displayIndex.get(key);
    if (dp == null) {
      dp = displays.length;
      displays.push(shown);
      displayIndex.set(key, dp);
    }
    const imageId = card.img || card.id;
    const row = { s, c: card.id, x: card.idx, ...pick(card), img: imageId, dp };
    if (card.code && Object.values(fmt).some((text) => text.includes('{code}'))) row.code = card.code;
    if (section?.tier && section.tier !== 'standard') row.st = section.tier;
    const custom = set.raw.rarities?.find((r) => r.id === card.rarity);
    if (custom?.icon) row.ri = custom.icon;
    const color = set.images.colors?.[imageId];
    if (color) row.col = color;
    const remote = set.images.remote?.ids?.[imageId];
    if (remote) row.rid = remote;
    const price = set.prices?.cards?.[card.id];
    if (price) row.p = pick(price, PRICE_KEEP);
    if (featuring) {
      row.section = FEATURING_SECTION;
      row.feat = 1;
    } else if (card.variant) row.section = OTHER_SECTION;
    else {
      const eraName = set.raw.series || 'Other';
      if (!eras.has(eraName)) eras.set(eraName, `e${eras.size}`);
      row.section = eras.get(eraName);
    }
    cards.push(row);
  }

  const sections = [...eras].map(([name, id]) => ({ id, name, tier: 'standard' }));
  if (cards.some((c) => c.section === OTHER_SECTION)) sections.push({ id: OTHER_SECTION, name: OTHER_NAME, tier: 'master' });
  if (cards.some((c) => c.feat)) sections.push({ id: FEATURING_SECTION, name: `Featuring ${view.name}`, tier: 'grand' });
  const ordered = sections.flatMap((s) => cards.filter((c) => c.section === s.id));

  let thumb = -1;
  let best = -1;
  const thumbRates = ratesOf(rates);
  ordered.forEach((c, i) => {
    if (!c.col || c.variant || c.feat || THUMB_SKIP.has(c.rarity)) return;
    const usd = valueUsd(c.p, thumbRates) ?? 0;
    if (usd > best) {
      best = usd;
      thumb = i;
    }
  });
  if (thumb < 0) thumb = ordered.findIndex((c) => c.col);

  return {
    id: view.id, game: view.game, kind: view.kind, slug: view.slug, name: view.name,
    defaultTier: 'grand', sets: setRows, displays,
    sections, rates, thumb, cards: ordered,
  };
}

let loaded = null;

async function build() {
  const views = [];
  const setCards = new Map();
  const reservedClash = [];
  for (const game of LIVE_GAMES) {
    const sets = await loadGameSets(game);
    for (const set of sets) if (VIEW_FOLDERS.includes(set.slug)) reservedClash.push(set.id);
    const roster = await ROSTERS[game](sets);
    for (const view of roster.views.values()) {
      const data = viewData(view);
      const entry = {
        id: view.id, game, kind: view.kind, role: view.role, slug: view.slug, name: view.name, total: data.cards.length,
        standard: data.cards.filter((c) => !c.variant && !c.feat).length, featuring: data.cards.filter((c) => c.feat).length, indexed: data.cards.length >= INDEX_MIN, thumb: viewThumb(data), data,
      };
      views.push(entry);
      for (const member of view.members.values()) {
        if (!setCards.has(member.set.id)) setCards.set(member.set.id, new Map());
        const perCard = setCards.get(member.set.id);
        if (!perCard.has(member.card.id)) perCard.set(member.card.id, []);
        perCard.get(member.card.id).push(entry);
      }
    }
  }
  const byId = new Map(views.map((v) => [v.id, v]));
  const setIndex = new Map();
  for (const [setId, perCard] of setCards) {
    const used = new Map();
    const row = {};
    for (const [cardId, entries] of perCard) {
      row[cardId] = entries.map((e) => {
        if (!used.has(e.id)) used.set(e.id, used.size);
        return used.get(e.id);
      });
    }
    const list = [...used.keys()].map((id) => byId.get(id));
    setIndex.set(setId, { views: list.map((v) => ({ id: v.id, name: v.name, kind: v.kind, total: v.total, indexed: v.indexed })), cards: row });
  }
  return { views, byId, setIndex, reservedClash };
}

export function loadViews() {
  loaded ||= build();
  return loaded;
}

export { viewDataPath };
