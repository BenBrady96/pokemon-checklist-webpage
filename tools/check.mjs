import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { CONFIG, loadModel, loadRaw, dataDir } from './lib/collections.mjs';
import { ROOT, readJson } from './lib/util.mjs';
import { join, relative, sep } from 'node:path';

const element = () => ({ addEventListener() {}, append() {}, querySelector: element, querySelectorAll: () => [], setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} }, dataset: {} });
globalThis.window ??= { addEventListener() {} };
globalThis.document ??= { getElementById: element, querySelector: element, querySelectorAll: () => [], createElement: element, documentElement: element(), head: element() };
globalThis.matchMedia ??= () => ({ matches: false });

const stored = new Map([
  ['bt:v1:prefs', JSON.stringify({ view: 'list', tiers: { 'pokemon/151': 'complete', 'pokemon/mega-evolution': 'master', 'pokemon/surging-sparks': 'standard' } })],
  ['bt:v1:c:pokemon/30th-celebration', JSON.stringify({ v: 1, q: { m001: 1, p094: 2, p044: 1, e009: 3 }, updated: 1, summary: { tier: 'grand', owned: 4, total: 246 } })],
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
check(sameCounts(saved('pokemon/me-black-star-promos').q, { '001': 1, '094': 5, '044': 1 }), 'saved 30th Celebration promos move to ME Black Star Promos, keeping the higher count');
check(sameCounts(saved('pokemon/me-energy').q, { '009': 3 }), 'saved 30th Celebration Basic Energy moves to ME Energy');
const prefs = JSON.parse(stored.get('bt:v1:prefs'));
check(prefs.tierScheme === 2 && prefs.view === 'list' && sameCounts(prefs.tiers, { 'pokemon/151': 'grand', 'pokemon/mega-evolution': 'grand', 'pokemon/surging-sparks': 'standard' }), 'saved Complete and old Master (every card) tier choices become Grand Master');

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
check(tiersOf('pokemon/30th-celebration') === 'standard grand', `30th Celebration tiers: ${tiersOf('pokemon/30th-celebration')}`);
check(tiersOf('pokemon/mega-evolution') === 'standard master grand', `Mega Evolution tiers: ${tiersOf('pokemon/mega-evolution')}`);
check(tiersOf('pokemon/sv-black-star-promos') === 'standard' && tiersOf('pokemon/me-black-star-promos') === 'standard', `Promo lists have no tiers: ${tiersOf('pokemon/sv-black-star-promos')} and ${tiersOf('pokemon/me-black-star-promos')}`);
check(tiersOf('pokemon/me-energy') === 'standard' && tiersOf('pokemon/sv-energy') === 'standard', `Energy tiers: ${tiersOf('pokemon/me-energy')} and ${tiersOf('pokemon/sv-energy')}`);
check(models.get('pokemon/me-energy')?.cards.length === 16 && models.get('pokemon/sv-energy')?.cards.length === 24, 'Energy lists are the 16 ME and 24 SV Basic Energy cards');
for (const model of models.values()) {
  const ids = model.sections.map((s) => s.id);
  check(!ids.includes('special') && !ids.includes('variant') && !model.cards.some((c) => c.base), `${model.id}: no stamped or other special prints`);
  const tierCards = (tier) => model.sections.filter((s) => s.tier === tier).flatMap((s) => model.cardsBySection.get(s.id));
  check(tierCards('master').every((c) => c.variant) && tierCards('standard').every((c) => !c.variant), `${model.id}: Master adds only reverse holos, patterns and 1st Editions`);
  if (ids.includes('secret')) {
    check(model.getTier('master').sections.every((s) => ids.indexOf(s.id) < ids.indexOf('secret')) && model.lowestTier('secret')?.id === 'grand', `${model.id}: secret rares come after the reverse holos and patterns, in Grand Master`);
  }
  if (model.kind === 'expansion' || model.kind === 'energy') check(!model.cards.some((c) => c.rarity === 'P'), `${model.id}: promos are only in the promo lists and special collections`);
  if (model.kind === 'energy') check(model.sections.every((s) => s.id === 'main'), `${model.id}: energy lists have only their numbered cards`);
}
check(models.get('pokemon/me-black-star-promos')?.cardById.get('094')?.note === '30th Celebration Tech Sticker Collection', 'ME Black Star Promos have the 30th Celebration product notes');
const meg = models.get('pokemon/mega-evolution');
check(meg?.visibleTiers.map((t) => t.cards.length).join() === `${meg?.cardsBySection.get('main').length},${meg?.cards.length - meg?.cardsBySection.get('secret').length},${meg?.cards.length}`, 'Mega Evolution tiers are main set, then reverse holos, then secret rares');
const thirty = models.get('pokemon/30th-celebration');
check(thirty?.visibleTiers.map((t) => t.cards.length).join() === '128,191', '30th Celebration tier sizes are 128 and 191');
check(thirty?.sections.map((s) => s.id).join() === 'main,secret,classic', '30th Celebration order is main set, secret rares, Classic Collection');

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
  check(qa('V1').invalid.length === 1 && qa('E9').invalid.length === 1 && qa('P94').invalid.length === 1, '30th quick add has no variant, Basic Energy or promo codes');
  check(qa('159').invalid.length === 1 && qa('12/158').counts.has('m012') && qa('55x2').counts.get('m055') === 2, '30th quick add edge cases');
}
if (meg) {
  const r = parseQuickAdd('1-3, R1-R3, 188x2', meg);
  check(r.counts.size === 6 && r.counts.get('001-rh') === 1 && !r.counts.has('003-rh') && r.counts.get('188') === 2 && !r.invalid.length, 'Mega Evolution quick add with reverse holos');
  check(parseQuickAdd('R3', meg).invalid.length === 1 && parseQuickAdd('R180-R200', meg).invalid.length === 1, 'Mega Evolution quick add rejects missing reverse holos and numbers past the set');
}
const scan = await readJson(join(ROOT, 'data', 'scan', 'index.json'));
check(scan, 'data/scan/index.json exists (run npm run scan-index)');
if (scan) {
  const key = (set, imageId, name, printed) => `${set} ${imageId} ${name} ${printed}`;
  const expected = [];
  for (const [id, model] of models) {
    for (const card of model.cards) if (!card.variant && model.hasImage(card)) expected.push(key(id, card.imageId, card.name, card.printed));
  }
  const indexed = scan.cards.map(([set, imageId, name, printed]) => key(scan.sets[set], imageId, name, printed));
  const have = new Set(indexed);
  const want = new Set(expected);
  const missing = expected.filter((k) => !have.has(k));
  const stale = indexed.filter((k) => !want.has(k));
  check(!missing.length && !stale.length, `scan index matches the card lists (run npm run scan-index): ${missing.length} missing, ${stale.length} stale ${[...missing, ...stale].slice(0, 4).join(', ')}`);
  const read = (path) => readFile(join(ROOT, path)).catch(() => null);
  const vectors = await read('data/scan/index.bin');
  check(vectors?.length === scan.cards.length * scan.model.dims, 'scan index.bin has one vector per card');
  const modelFile = await read(scan.model.file);
  check(modelFile && modelFile.length === scan.model.bytes && createHash('sha256').update(modelFile).digest('hex') === scan.model.sha256, `${scan.model.file} matches the size and SHA-256 in index.json`);
  const wasm = await read(scan.runtime.file);
  check(wasm?.length === scan.runtime.bytes, `${scan.runtime.file} is vendored (ONNX Runtime Web ${scan.runtime.version})`);
  for (const path of ['js/vendor/ort/ort.wasm.min.mjs', 'js/vendor/ort/ort-wasm-simd-threaded.mjs']) check(await read(path), `${path} is vendored`);
}

const big = models.get('pokemon/ascended-heroes');
check(big && big.cards.length > 255, 'a set with more than 255 entries exists and round-trips (Ascended Heroes)');

const { encodeTrade, decodeTrade, encodeProposal, decodeProposal, readTradeText, cleanName, inflate } = await import('../js/trade-code.js');
const { balance, standing, spareOf, buildLists, bump, emptyDraft } = await import('../js/trade-data.js');
const tradeSets = ['pokemon/151', 'pokemon/mega-evolution', 'pokemon/30th-celebration'].map((id, i) => {
  const model = models.get(id);
  const counts = {};
  for (const card of model?.cards || []) {
    const r = random();
    if (r < 0.35) counts[card.id] = r < 0.06 ? 2 + Math.floor(random() * 120) : 1;
  }
  return { model, counts, tier: ['standard', 'master', 'grand'][i] };
}).filter((s) => s.model);
const capped = (counts) => Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, Math.min(99, n)]));
const created = Date.UTC(2026, 9, 9, 12, 30);
let plainTrade = '';
for (const compress of [true, false]) {
  const code = await encodeTrade({ name: '  Zoë \n Smith ', created, sets: tradeSets }, { compress });
  if (!compress) plainTrade = code;
  const back = await decodeTrade(code);
  check(back?.kind === 'trade' && back.name === 'Zoë Smith' && back.created === created && back.sets.length === tradeSets.length
    && back.sets.every((s, i) => s.tier === tradeSets[i].tier && s.decoded.key === tradeSets[i].model.syncKey && s.decoded.n === tradeSets[i].model.maxIdx + 1
      && sameCounts(resolveCode(s.decoded, tradeSets[i].model), capped(tradeSets[i].counts))), `trade code round trip (${compress ? 'compressed' : 'uncompressed'})`);
  check((await readTradeText(`Here you go https://example.com/trade/#t=${code}`))?.sets?.length === tradeSets.length, `a pasted trade link is read (${compress ? 'compressed' : 'uncompressed'})`);
}
check((await readTradeText(plainTrade))?.kind === 'trade', 'a bare trade code is read');
check(await decodeTrade(plainTrade.slice(0, Math.floor(plainTrade.length / 2))) === null, 'a cut-off trade code is rejected');
check(await decodeProposal(plainTrade) === null, 'a trade code isn’t read as a proposed trade');
check(await readTradeText('hello there, no code here') === null, 'text without a trade code is rejected');
const fromSync = await readTradeText(`https://example.com/#sync=${V1}`);
check(fromSync?.kind === 'trade' && fromSync.source === 'sync' && fromSync.sets[0].decoded.collection === 'pokemon/30th-celebration', 'a set share link is read as a one-set trade code');
check(cleanName(`a\u0000b ${'x'.repeat(40)}`) === `ab ${'x'.repeat(21)}`, 'trade names lose control characters and are capped at 24 characters');
const bomb = new Uint8Array(await new Response(new Blob([new Uint8Array(2 * 1024 * 1024)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
check(await inflate(bomb).then(() => false, () => true), 'a code that inflates past the limit is rejected');

if (tradeSets.length >= 2) {
  const [a, b] = tradeSets.map((s) => s.model);
  const proposal = {
    id: 'a1b2c3d4', name: 'Sam', created,
    sets: [
      { key: a.syncKey, give: [[a.cards[0].idx, 1], [a.cards[5].idx, 3]], get: [] },
      { key: b.syncKey, give: [], get: [[b.cards[2].idx, 2]] },
    ],
  };
  const code = await encodeProposal(proposal);
  const back = await decodeProposal(code);
  check(back?.kind === 'proposal' && back.id === proposal.id && back.name === 'Sam' && back.created === created && JSON.stringify(back.sets) === JSON.stringify(proposal.sets), 'proposed trade round trip');
  check((await readTradeText(`#p=${code}`))?.kind === 'proposal' && await decodeTrade(code) === null, 'a proposed trade link is read, and isn’t a trade code');
}

check(balance(0.99, 0).dir === 'even' && balance(100, 104.99).dir === 'even' && balance(100, 106).dir === 'up' && balance(106, 100).dir === 'down' && balance(0, 0).dir === 'none', 'trade fairness: even within 5% or 1 unit');
check(balance(10, 30).lean === 2 / 3 && balance(30, 10).lean === -2 / 3, 'the fairness meter leans toward whoever is ahead');
check(spareOf(3, false) === 2 && spareOf(1, false) === 0 && spareOf(1, true) === 1 && spareOf(0, true) === 0, 'spares are copies beyond the first, or every copy with single copies on');
if (meg) {
  const main = meg.cardsBySection.get('main');
  const reverse = meg.cards.find((c) => c.variant);
  const me = { sets: { [meg.id]: { tier: 'standard', n: null, q: { [main[0].id]: 3, [main[1].id]: 1 } } } };
  const friend = { sets: { [meg.id]: { tier: 'master', n: null, q: { [main[2].id]: 2, [main[3].id]: 1 } } } };
  check(standing(me, meg.id, main[2], meg).need && !standing(me, meg.id, reverse, meg).need && standing(friend, meg.id, reverse, meg).need, 'needs follow each person’s tier');
  check(!standing(me, 'pokemon/151', main[2], meg).started && !standing(me, 'pokemon/151', main[2], meg).need, 'cards in sets you haven’t started aren’t needed');
  const older = { sets: { [meg.id]: { tier: 'grand', n: main[4].idx, q: {} } } };
  check(standing(older, meg.id, main[0], meg).need && standing(older, meg.id, main[4], meg).unknown && !standing(older, meg.id, main[4], meg).need, 'cards newer than a friend’s code aren’t counted as needed');
  const sets = new Map([[meg.id, { id: meg.id, model: meg }]]);
  const ids = (list) => list.map((i) => i.card.id).sort().join();
  const plain = buildLists({ me, friend, sets, singles: { mine: false, theirs: false } });
  check(ids(plain.mySpares) === main[0].id && plain.mySpares[0].avail === 2 && ids(plain.theirSpares) === main[2].id, 'spare lists');
  check(ids(plain.theyHave) === main[2].id && ids(plain.youHave) === main[0].id, 'they have what you need, and you have what they need');
  const singles = buildLists({ me, friend, sets, singles: { mine: true, theirs: true } });
  check(ids(singles.youHave) === [main[0].id, main[1].id].sort().join() && ids(singles.theyHave) === [main[2].id, main[3].id].sort().join(), 'single copies are offered when turned on');
  check(plain.myNeeds.length === main.length - 2 && plain.myNeeds.every((i) => !i.card.variant), 'your needs are the missing cards in your tier');
  const draft = emptyDraft();
  bump(draft, 'give', meg.id, main[0].id, 1);
  bump(draft, 'give', meg.id, main[0].id, 2);
  bump(draft, 'get', meg.id, main[2].id, 1);
  const peak = draft.give[0].qty;
  bump(draft, 'give', meg.id, main[0].id, -3);
  check(peak === 3 && !draft.give.length && draft.get[0].qty === 1 && bump(draft, 'get', meg.id, main[2].id, 500) === 99, 'trade lines add up, drop at zero and stop at 99');
}

console.log(failures ? `\n${failures} of ${checks} checks failed` : `All ${checks} checks passed (${models.size} collections)`);
process.exitCode = failures ? 1 : 0;
