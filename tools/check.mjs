import { execFileSync } from 'node:child_process';
import { CONFIG, loadModel, loadRaw, dataDir } from './lib/collections.mjs';
import { ROOT, readJson } from './lib/util.mjs';
import { join, relative, sep } from 'node:path';

const element = () => ({ addEventListener() {}, append() {}, querySelector: element, querySelectorAll: () => [], setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} }, dataset: {} });
globalThis.window ??= { addEventListener() {} };
globalThis.document ??= { getElementById: element, querySelector: element, querySelectorAll: () => [], createElement: element, documentElement: element(), head: element() };
globalThis.matchMedia ??= () => ({ matches: false });

const stored = new Map([
  ['bt:v1:c:pokemon/30th-celebration', JSON.stringify({ v: 1, q: { m001: 1, p094: 2, p044: 1, v03: 1, e009: 3 }, updated: 1, summary: { tier: 'grand', owned: 5, total: 246 } })],
  ['bt:v1:c:pokemon/me-black-star-promos', JSON.stringify({ v: 1, q: { '001': 1, '094': 5 }, updated: 2 })],
]);
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: (key) => stored.delete(key),
    key: (i) => [...stored.keys()][i] ?? null,
    get length() { return stored.size; },
  },
});

const { encodeCollection, decodeCode, resolveCode, parseSyncText, parseBackup } = await import('../js/codec.js');
const { parseQuickAdd } = await import('../js/quickadd.js');

let failures = 0;
let checks = 0;
function check(ok, message) {
  checks++;
  if (!ok) {
    failures++;
    console.error(`✗ ${message}`);
  }
}
const sameCounts = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

const saved = (id) => JSON.parse(stored.get(`bt:v1:c:${id}`) || '{}');
check(sameCounts(saved('pokemon/30th-celebration').q, { m001: 1 }) && !saved('pokemon/30th-celebration').summary, 'saved 30th Celebration promos and Basic Energy move out of 30th Celebration');
check(sameCounts(saved('pokemon/me-black-star-promos').q, { '001': 1, '094': 5, '044': 1, '101-pokemon-center': 1 }), 'saved 30th Celebration promos move to ME Black Star Promos, keeping the higher count');
check(sameCounts(saved('pokemon/me-energy').q, { '009': 3 }), 'saved 30th Celebration Basic Energy moves to ME Energy');

let seed = 42;
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

function committedCards(id) {
  const path = relative(ROOT, join(dataDir(id), 'cards.json')).split(sep).join('/');
  try {
    return JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })).cards;
  } catch {
    return null;
  }
}

const models = new Map();
for (const entry of CONFIG) {
  const raw = await loadRaw(entry.id);
  check(raw, `${entry.id}: has data/…/cards.json (run npm run sets)`);
  if (!raw) continue;
  let model;
  try {
    model = await loadModel(entry.id, { raw });
  } catch (err) {
    check(false, `${entry.id}: ${err.message}`);
    continue;
  }
  models.set(entry.id, model);

  const idx = model.cards.map((c) => c.idx);
  check(idx.every((i) => Number.isInteger(i) && i >= 0) && new Set(idx).size === idx.length, `${entry.id}: card positions (idx) are unique whole numbers`);
  const before = committedCards(entry.id);
  if (before) {
    const now = new Map(model.cards.map((c) => [c.id, c.idx]));
    const moved = before.filter((c) => now.has(c.id) && now.get(c.id) !== c.idx).map((c) => c.id);
    check(!moved.length, `${entry.id}: cards changed position since the last commit, which breaks existing share links: ${moved.slice(0, 8).join(', ')}`);
  }

  for (let i = 1; i < model.visibleTiers.length; i++) {
    const [a, b] = [model.visibleTiers[i - 1], model.visibleTiers[i]];
    check(a.cards.length < b.cards.length && a.cards.every((c) => b.cards.includes(c)), `${entry.id}: ${a.label} is inside ${b.label}`);
  }
  const codes = model.cards.map((c) => c.code).filter(Boolean);
  check(new Set(codes.map((c) => c.toUpperCase())).size === codes.length, `${entry.id}: quick-add codes are unique`);
  check(model.syncKey && /^[A-Za-z0-9]{1,16}$/.test(model.syncKey), `${entry.id}: sync key`);

  const images = await readJson(join(dataDir(entry.id), 'images.json'));
  if (images) {
    const missing = model.cards.filter((c) => !model.hasImage(c)).map((c) => c.id);
    if (missing.length) console.warn(`⚠ ${entry.id}: ${missing.length} card(s) without an image: ${missing.slice(0, 8).join(', ')}`);
  }

  for (let round = 0; round < 3; round++) {
    const counts = {};
    for (const card of model.cards) {
      const r = random();
      if (r < 0.4) counts[card.id] = r < 0.05 ? 2 + Math.floor(random() * 120) : 1;
    }
    const expected = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, Math.min(99, n)]));
    const decoded = decodeCode(encodeCollection(model, counts));
    check(decoded?.key === model.syncKey && sameCounts(resolveCode(decoded, model), expected), `${entry.id}: sync code round trip ${round + 1}`);
  }
}

const tiersOf = (id) => models.get(id)?.visibleTiers.map((t) => t.id).join(' ');
check(tiersOf('pokemon/30th-celebration') === 'standard master grand', `30th Celebration tiers: ${tiersOf('pokemon/30th-celebration')}`);
check(tiersOf('pokemon/mega-evolution') === 'standard complete master grand', `Mega Evolution tiers: ${tiersOf('pokemon/mega-evolution')}`);
check(tiersOf('pokemon/sv-black-star-promos') === 'master grand', `SV promos tiers: ${tiersOf('pokemon/sv-black-star-promos')}`);
check(tiersOf('pokemon/me-energy') === 'master' && tiersOf('pokemon/sv-energy') === 'master', `Energy tiers: ${tiersOf('pokemon/me-energy')} and ${tiersOf('pokemon/sv-energy')}`);
check(models.get('pokemon/me-energy')?.cards.length === 16 && models.get('pokemon/sv-energy')?.cards.length === 24, 'Energy lists are the 16 ME and 24 SV Basic Energy cards');
for (const model of models.values()) {
  const specials = model.cards.filter((c) => c.section === 'special');
  check(specials.every((c) => !c.code && c.img && model.cardById.has(c.img) && c.badge), `${model.id}: special prints have a label and a base card, and no quick-add code`);
  check(specials.every((c) => model.getTier('grand').sectionIds.has('special') && !model.getTier('master').sectionIds.has('special')), `${model.id}: special prints are only in Grand Master`);
  if (model.kind !== 'promo') check(!model.cards.some((c) => c.rarity === 'P'), `${model.id}: Black Star promos are only in the promo lists`);
  if (model.kind === 'energy') check(model.sections.every((s) => s.id === 'main'), `${model.id}: energy lists have only their numbered cards`);
}
check(models.get('pokemon/me-black-star-promos')?.cardById.get('094')?.note === '30th Celebration Tech Sticker Collection', 'ME Black Star Promos have the 30th Celebration product notes');
const megaSpecials = models.get('pokemon/mega-evolution')?.cards.filter((c) => c.section === 'special') || [];
check(megaSpecials.some((c) => c.badge === 'Cosmos Holo') && megaSpecials.some((c) => c.badge.includes('Play! Pokémon')), 'Mega Evolution lists Cosmos Holo and Play! Pokémon prints');
const promoSpecials = models.get('pokemon/sv-black-star-promos')?.cards.filter((c) => c.section === 'special') || [];
check(promoSpecials.filter((c) => c.badge === 'Prerelease').length >= 20, 'SV promos list the prerelease-stamped promos');
check(!promoSpecials.some((c) => /staff|top|finalist|champion\b|winner|judge/i.test(c.id)), 'award cards (staff, placement, winner) are left out');
const thirty = models.get('pokemon/30th-celebration');
check(thirty?.visibleTiers.map((t) => t.cards.length).join() === '128,191,193', '30th Celebration tier sizes are 128, 191 and 193');

const V1 = 'AfZSpHmUctAoCjgRdTaI4AAPVlCAAigQoCAwzX3Ad8QgBDMGYxw8H1kzHkUzUF1WKG0YjAOlY6wL4mM';
const v1 = decodeCode(V1);
check(v1?.collection === 'pokemon/30th-celebration', 'old v1 code is recognised as 30th Celebration');
if (v1 && thirty) {
  const counts = resolveCode(v1, thirty);
  const copies = Object.values(counts).reduce((a, b) => a + b, 0);
  check(Object.keys(counts).length === 63 && copies === 701, `old v1 code: 63 cards, 701 copies without the moved promos and Basic Energy (got ${Object.keys(counts).length}, ${copies})`);
  check(counts.m005 === 51 && counts.m007 === 99 && counts.c08 === 99 && !('p044' in counts) && counts.m141 === 3 && counts.m002 === 1, 'old v1 code: copy counts');
}
check(parseSyncText(`https://example.com/#sync=${V1}`)?.source === 'link', 'a pasted link is read');
check(parseSyncText('not a code at all') === null, 'text without a code is rejected');
const oldFile = parseBackup(JSON.stringify({ app: '30th-celebration-checklist', version: 1, cards: { m001: 2 } }));
check(oldFile?.[0].id === 'pokemon/30th-celebration' && oldFile[0].counts.m001 === 2, 'old backup files load into 30th Celebration');

if (thirty) {
  const qa = (text) => parseQuickAdd(text, thirty);
  check(qa('1-22').counts.size === 22 && qa('C1-C5').counts.size === 5, '30th quick add ranges');
  check(qa('RGB').counts.size === 3 && qa('R/RGB').counts.get('rgb-r') === 1 && qa('g/rgb x3').counts.get('rgb-g') === 3, '30th quick add RGB Mews');
  check(qa('V1-V2').counts.size === 2 && qa('V3').invalid.length === 1 && qa('E9').invalid.length === 1 && qa('P94').invalid.length === 1, '30th quick add variants, and no Basic Energy or promo codes');
  check(qa('159').invalid.length === 1 && qa('12/158').counts.has('m012') && qa('55x2').counts.get('m055') === 2, '30th quick add edge cases');
}
const meg = models.get('pokemon/mega-evolution');
if (meg) {
  const r = parseQuickAdd('1-3, R1-R3, 188x2', meg);
  check(r.counts.size === 6 && r.counts.get('001-rh') === 1 && !r.counts.has('003-rh') && r.counts.get('188') === 2 && !r.invalid.length, 'Mega Evolution quick add with reverse holos');
  check(parseQuickAdd('R3', meg).invalid.length === 1 && parseQuickAdd('R180-R200', meg).invalid.length === 1, 'Mega Evolution quick add rejects missing reverse holos and numbers past the set');
}
const big = models.get('pokemon/ascended-heroes');
check(big && big.cards.length > 255, 'a set with more than 255 entries exists and round-trips (Ascended Heroes)');

console.log(failures ? `\n${failures} of ${checks} checks failed` : `All ${checks} checks passed (${models.size} collections)`);
process.exitCode = failures ? 1 : 0;
