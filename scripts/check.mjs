import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { COMING_SOON, CONFIG, GAMES, LIVE_GAMES, loadModel, loadRaw, dataDir } from './lib/collections.mjs';
import { GUIDES } from '../config/guides/index.mjs';
import { IMAGES_REPO, PUBLIC, ROOT, TEMPLATES, exists, readJson } from './lib/util.mjs';
import { join, relative, sep } from 'node:path';

const element = () => ({ addEventListener() {}, append() {}, querySelector: element, querySelectorAll: () => [], setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} }, dataset: {} });
globalThis.window ??= { addEventListener() {} };
globalThis.document ??= { getElementById: element, querySelector: element, querySelectorAll: () => [], createElement: element, documentElement: element(), head: element() };
globalThis.matchMedia ??= () => ({ matches: false });

const stored = new Map();
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

const { encodeCollection, decodeCode, resolveCode, parseSyncText, parseBackup, collectionBytes, toBase64Url } = await import('../public/js/core/codec.js');
const { backupFile } = await import('../public/js/core/transfer.js');
const { parseQuickAdd } = await import('../public/js/set/quickadd.js');

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
  check(raw, `${entry.id}: has public/data/…/cards.json (run npm run sets)`);
  if (!raw) continue;
  check(raw.cards.length, `${entry.id}: has at least one card, or its page is noindexed and Google reports it`);
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
  check(tierCards('master').every((c) => c.variant) && tierCards('standard').every((c) => !c.variant), `${model.id}: Master adds only variants (reverse holos, patterns and 1st Editions, or other rarities)`);
  if (model.game.id !== 'pokemon') continue;
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

const shareCode = thirty ? encodeCollection(thirty, { m001: 1, m005: 3, c08: 2 }) : '';
check(parseSyncText(`https://example.com/pokemon/30th-celebration/#sync=${shareCode}`)?.source === 'link', 'a pasted link is read');
check(parseSyncText('not a code at all') === null, 'text without a code is rejected');
const oldFile = parseBackup(JSON.stringify({ app: 'binder-tracker', version: 2, collections: { 'pokemon/151': { cards: { '001': 2, '004': 0 } } } }));
check(oldFile?.entries.length === 1 && oldFile.entries[0].id === 'pokemon/151' && oldFile.entries[0].tier === null && oldFile.name === '' && sameCounts(oldFile.entries[0].counts, { '001': 2 }), 'older backup files load');
const exportedAt = new Date(Date.UTC(2026, 9, 12, 9, 0));
const newFile = parseBackup(JSON.stringify(backupFile([{ id: 'pokemon/151', counts: { '001': 2, '004': 1 }, tier: 'master' }], { name: 'Sam', history: [], exported: exportedAt })));
check(newFile?.name === 'Sam' && newFile.created === exportedAt.getTime() && newFile.entries.length === 1 && newFile.entries[0].tier === 'master' && sameCounts(newFile.entries[0].counts, { '001': 2, '004': 1 }), 'export files round trip with name and tier');
check(parseBackup(JSON.stringify({ cards: { m001: 2 } })) === null, 'a file without collections isn’t read as a backup');

if (thirty) {
  const qa = (text) => parseQuickAdd(text, thirty);
  check(qa('1-22').counts.size === 22 && qa('C1-C5').counts.size === 5, '30th quick add ranges');
  check(qa('RGB').counts.size === 3 && qa('R/RGB').counts.get('rgb-r') === 1 && qa('g/rgb x3').counts.get('rgb-g') === 3, '30th quick add RGB Mews');
  check(qa('V1').invalid.length === 1 && qa('E9').invalid.length === 1 && qa('P94').invalid.length === 1, '30th quick add has no variant, Basic Energy or promo codes');
  check(qa('159').invalid.length === 1 && qa('12/158').counts.has('m012') && qa('55x2').counts.get('m055') === 2, '30th quick add edge cases');
  check(qa('1\u201422').counts.size === 22 && qa('3 \u2013 5').counts.size === 3, '30th quick add reads en and em dashes from phone keyboards as ranges');
}
if (meg) {
  const r = parseQuickAdd('1-3, R1-R3, 188x2', meg);
  check(r.counts.size === 6 && r.counts.get('001-rh') === 1 && !r.counts.has('003-rh') && r.counts.get('188') === 2 && !r.invalid.length, 'Mega Evolution quick add with reverse holos');
  check(parseQuickAdd('R3', meg).invalid.length === 1 && parseQuickAdd('R180-R200', meg).invalid.length === 1, 'Mega Evolution quick add rejects missing reverse holos and numbers past the set');
}
const today = new Date().toISOString().slice(0, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s));
const textsOf = (value) => (typeof value === 'string' ? [value]
  : Array.isArray(value) ? value.flatMap(textsOf)
    : value && typeof value === 'object' ? Object.values(value).flatMap(textsOf) : []);
const citedIn = (value) => textsOf(value).flatMap((s) => [...s.matchAll(/\[([a-z0-9-]+)\]/g)].map((m) => m[1]));
function checkSources(id, guide, cited) {
  const ids = new Set(guide.sources.map((s) => s.id));
  check(ids.size === guide.sources.length && guide.sources.every((s) => s.publisher && s.title && /^https:\/\//.test(s.url) && (!s.date || isDate(s.date))), `${id}: guide sources have unique ids, a publisher, a title and an https link`);
  const unknown = [...new Set(cited.filter((s) => !ids.has(s)))];
  check(!unknown.length, `${id}: guide cites sources it doesn't list: ${unknown.join(', ')}`);
  const unused = [...ids].filter((s) => !cited.includes(s));
  check(!unused.length, `${id}: guide lists sources nothing cites: ${unused.join(', ')}`);
  const dashed = textsOf(guide).filter((s) => s.includes('—'));
  check(!dashed.length, `${id}: guide text has em dashes: ${dashed.map((s) => s.slice(0, 50)).join(' | ')}`);
}
const syncKeys = new Map([...models.values()].map((m) => [m.syncKey, m.id]));
for (const entry of [...COMING_SOON, ...CONFIG.filter((e) => e.guide)]) {
  const { guide, id } = entry;
  const live = CONFIG.includes(entry);
  check(guide.name && isDate(guide.released) && isDate(guide.updated) && isDate(guide.published), `${id}: guide has a name and release, published and checked dates`);
  checkSources(id, guide, [
    ...citedIn(guide),
    guide.releaseSource, guide.productsSource,
    ...[...(guide.dates || []), ...(guide.previews || [])].map((x) => x.source),
    ...guide.products.flatMap((p) => (p.rrp || []).map((r) => r.source)),
  ].filter(Boolean));
  check(guide.releaseSource && (guide.dates || []).every((d) => isDate(d.date) && d.source), `${id}: the release date and every key date have a source`);
  check(Array.isArray(guide.products) && guide.products.every((p) => Number.isInteger(p.tcg) && p.name && p.contents && (p.rrp || []).every((r) => r.price > 0 && /^(gbp|usd|eur)$/.test(r.currency) && r.store && r.source)), `${id}: every guide product has a TCGplayer id, a name and contents, and shop prices name a store and a source`);
  check(!guide.products.length || guide.productsSource, `${id}: a guide with products names the source of their contents (productsSource)`);
  check(!guide.releaseWindow || (guide.releaseWindow.short && guide.releaseWindow.long), `${id}: a release window has a short and a long form`);
  check(new Set(guide.products.map((p) => p.tcg)).size === guide.products.length, `${id}: guide products aren't listed twice`);
  if (!live) {
    check(/^[A-Za-z0-9]{1,16}$/.test(entry.syncKey) && !syncKeys.has(entry.syncKey), `${id}: sync key ${entry.syncKey} is valid and not used by ${syncKeys.get(entry.syncKey)}`);
    if (today >= guide.released) {
      console.warn(entry.game === 'lorcana'
        ? `⚠ ${id} came out on ${guide.released}. When LorcanaJSON lists its cards, move it from UPCOMING into the set list in config/lorcana/sets.mjs and run npm run sets -- --only ${id}`
        : `⚠ ${id} came out on ${guide.released}. When TCGdex has ${entry.tcgdex}, move it from UPCOMING to HAND in config/pokemon/sets.mjs and run npm run sets -- --only ${entry.slug}`);
    }
  }
}
for (const guide of GUIDES) {
  const { id } = guide;
  check(guide.slug && guide.label && guide.title && guide.headline && guide.description && guide.lead && GAMES[guide.game] && isDate(guide.published) && isDate(guide.updated), `${id}: guide has a slug, label, title, headline, description, lead, game and published and checked dates`);
  check(new Set(guide.sections.map((s) => s.id)).size === guide.sections.length && guide.sections.every((s) => s.id && s.heading && (s.paragraphs?.length || s.list?.length)), `${id}: every guide section has a unique id, a heading and some text`);
  check(guide.faq.every((f) => f.q && f.a), `${id}: every FAQ has a question and an answer`);
  checkSources(id, guide, citedIn(guide));
}

for (const dir of [PUBLIC, TEMPLATES]) {
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.html'))) {
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(await readFile(join(dir, name), 'utf8'))?.[1] || '';
    const directives = new Map(csp.split(';').map((d) => d.trim().split(/\s+/)).filter(([key]) => key).map(([key, ...sources]) => [key, sources]));
    const sources = ['default-src', 'script-src', 'style-src'].flatMap((key) => directives.get(key) || []);
    check(directives.has('default-src') && sources.every((s) => s.startsWith("'")), `${relative(ROOT, join(dir, name)).split(sep).join('/')}: has a Content-Security-Policy that only loads scripts and styles from the site itself`);
  }
}

const readPublic = (path) => readFile(join(PUBLIC, path)).catch(() => null);
for (const game of LIVE_GAMES) {
  const dir = `data/scan/${game}`;
  const scan = await readJson(join(PUBLIC, dir, 'index.json'));
  check(scan, `public/${dir}/index.json exists (run npm run scan-index)`);
  if (!scan) continue;
  const key = (set, imageId, name, printed) => `${set} ${imageId} ${name} ${printed}`;
  const gameModels = [...models].filter(([, model]) => model.game.id === game);
  const printings = scan.layout === 'printings';
  const expected = [];
  for (const [id, model] of gameModels) {
    for (const card of model.cards) {
      if (!model.hasImage(card)) continue;
      if (printings) expected.push(card.imageId);
      else if (!card.variant) expected.push(key(id, card.imageId, card.name, card.printed));
    }
  }
  const indexed = printings ? scan.cards.map(([imageId]) => imageId) : scan.cards.map(([set, imageId, name, printed]) => key(scan.sets[set], imageId, name, printed));
  if (printings) {
    const broken = scan.cards.flatMap(([imageId, , list]) => list.filter(([s, cardId]) => !models.get(scan.sets[s])?.cardById.has(cardId)).map(([s, cardId]) => `${imageId} ${scan.sets[s]} ${cardId}`));
    check(!broken.length, `${game} scan index printings all point at real cards (run npm run scan-index): ${broken.slice(0, 4).join(', ')}`);
  }
  const have = new Set(indexed);
  const want = new Set(expected);
  const missing = [...want].filter((k) => !have.has(k));
  const stale = indexed.filter((k) => !want.has(k));
  check(!missing.length && !stale.length, `${game} scan index matches the card lists (run npm run scan-index): ${missing.length} missing, ${stale.length} stale ${[...missing, ...stale].slice(0, 4).join(', ')}`);
  const vectors = await readPublic(`${dir}/index.bin`);
  check(vectors?.length === scan.cards.length * scan.model.dims, `${game} scan index.bin has one vector per card`);
  const modelFile = await readPublic(scan.model.file);
  check(modelFile && modelFile.length === scan.model.bytes && createHash('sha256').update(modelFile).digest('hex') === scan.model.sha256, `public/${scan.model.file} matches the size and SHA-256 in ${dir}/index.json`);
  const wasm = await readPublic(scan.runtime.file);
  check(wasm?.length === scan.runtime.bytes, `public/${scan.runtime.file} is vendored (ONNX Runtime Web ${scan.runtime.version})`);
}
for (const path of ['js/vendor/ort/ort.wasm.min.mjs', 'js/vendor/ort/ort-wasm-simd-threaded.mjs']) check(await readPublic(path), `public/${path} is vendored`);

const big = models.get('pokemon/ascended-heroes');
check(big && big.cards.length > 255, 'a set with more than 255 entries exists and round-trips (Ascended Heroes)');

const { encodeTrade, decodeTrade, encodeProposal, decodeProposal, encodeList, decodeList, readTradeText, cleanName, inflate } = await import('../public/js/trade/trade-code.js');
const { balance, standing, spareOf, buildLists, bump, emptyDraft } = await import('../public/js/trade/trade-data.js');
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
const fromSync = await readTradeText(`https://example.com/pokemon/30th-celebration/#sync=${shareCode}`);
check(fromSync?.kind === 'trade' && fromSync.source === 'sync' && fromSync.sets[0].decoded.key === thirty?.syncKey, 'a set share link is read as a one-set trade code');
check(cleanName(`a\u0000b ${'x'.repeat(40)}`) === `ab ${'x'.repeat(21)}`, 'trade names lose control characters and are capped at 24 characters');
const bomb = new Uint8Array(await new Response(new Blob([new Uint8Array(2 * 1024 * 1024)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
check(await inflate(bomb).then(() => false, () => true), 'a code that inflates past the limit is rejected');

const exportCode = await encodeTrade({ name: 'Sam', created, sets: tradeSets });
const exported = await readTradeText(`https://example.com/#sync=${exportCode}`);
check(exported?.kind === 'trade' && exported.name === 'Sam' && exported.sets.length === tradeSets.length
  && exported.sets.every((s, i) => s.tier === tradeSets[i].tier && sameCounts(resolveCode(s.decoded, tradeSets[i].model), capped(tradeSets[i].counts))), 'an Export link with several sets is read with its name, tiers and cards');
const oneSet = tradeSets[0];
const oneCode = await encodeTrade({ name: '', created, sets: [oneSet] });
const oneLink = await readTradeText(`https://example.com/${oneSet.model.id}/#sync=${oneCode}`);
check(oneLink?.kind === 'trade' && oneLink.sets.length === 1 && oneLink.sets[0].decoded.key === oneSet.model.syncKey, 'a one-set Export link is read');
if (tradeSets.length >= 2) {
  const dotted = tradeSets.slice(0, 2).map((s) => encodeCollection(s.model, s.counts)).join('.');
  const oldBackup = await readTradeText(dotted);
  check(oldBackup?.kind === 'trade' && oldBackup.source === 'sync' && oldBackup.sets.length === 2 && oldBackup.sets.every((s) => s.tier === null), 'an older backup code with several sets is still read');
}
if (meg) {
  const early = decodeCode(toBase64Url(collectionBytes(meg, Object.fromEntries(meg.cards.map((c) => [c.id, 1])), 10)));
  check(early?.n === 10 && early.owned.length === meg.cards.filter((c) => c.idx < 10).length && early.owned.every((i) => i < 10), 'a code can be re-made for an older card count');
}

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

const allModels = [...models.values()];
const keys = allModels.map((m) => m.syncKey.toUpperCase());
check(new Set(keys).size === keys.length, 'sync keys are unique across games, ignoring case');
const KEY_PREFIX = { yugioh: 'Y', lorcana: 'I' };
for (const [game, prefix] of Object.entries(KEY_PREFIX)) {
  if (!allModels.some((m) => m.game.id === game)) continue;
  check(allModels.every((m) => (m.game.id === game) === m.syncKey.toUpperCase().startsWith(prefix)), `${GAMES[game].shortName} sync keys start with ${prefix} and no other game's do`);
}

const mixedSet = (model) => {
  const counts = {};
  for (const card of model.cards) if (random() < 0.3) counts[card.id] = 1 + Math.floor(random() * 3);
  return { model, counts, tier: 'master' };
};

const ygo = allModels.filter((m) => m.game.id === 'yugioh');
const lor = allModels.filter((m) => m.game.id === 'lorcana');
if (ygo.length) {
  const repo = await exists(IMAGES_REPO);
  const missingArt = new Set();
  for (const m of ygo) {
    check(m.sections.every((s) => s.id === 'main' || s.id === 'rarities'), `${m.id}: only main set and other rarities sections`);
    const mains = new Set(m.cards.filter((c) => !c.variant).map((c) => c.printed));
    check(m.cards.filter((c) => c.variant).every((c) => mains.has(c.printed)), `${m.id}: every other rarity has its main card`);
    if (repo) for (const c of m.cards) if (m.hasImage(c) && !(await exists(join(IMAGES_REPO, 'yugioh', c.imageId, 'low.webp')))) missingArt.add(c.imageId);
  }
  if (repo) check(!missingArt.size, `every Yu-Gi-Oh! artwork with a colour has its images in ${IMAGES_REPO} (run npm run images -- --game yugioh): ${[...missingArt].slice(0, 6).join(', ')}`);
  const rich = ygo.find((m) => m.cards.some((c) => c.variant && c.code?.startsWith('SCR')) && m.codes.has('1'));
  if (rich) {
    const scr = rich.cards.find((c) => c.variant && c.code?.startsWith('SCR'));
    const r = parseQuickAdd(`1x2, ${scr.code}`, rich);
    check(!r.invalid.length && r.counts.get(rich.codes.get('1')) === 2 && r.counts.get(scr.id) === 1, `${rich.id}: Yu-Gi-Oh! quick add reads numbers and rarity codes`);
    check(parseQuickAdd('QCSR9999', rich).invalid.length === 1, `${rich.id}: Yu-Gi-Oh! quick add rejects codes that aren't in the set`);
  }
  const ygoList = ygo[0];
  const listBack = await decodeList(await encodeList({ key: ygoList.syncKey, n: ygoList.maxIdx + 1, tier: 'master', have: [[ygoList.cards[0].idx, 2]], missing: [ygoList.cards.at(-1).idx] }));
  check(listBack?.key === ygoList.syncKey && listBack.have.get(ygoList.cards[0].idx) === 2, `${ygoList.id}: Yu-Gi-Oh! trade list round trip`);
}

const LORCANA_SECTIONS = new Set(['main', 'foil', 'epic', 'enchanted', 'iconic', 'quest', 'errata']);
if (lor.length) {
  for (const m of lor) {
    check(m.sections.every((s) => LORCANA_SECTIONS.has(s.id)), `${m.id}: only main set, foil, Epic, Enchanted, Iconic, Illumineer's Quest and errata sections`);
    const mains = new Set(m.cards.filter((c) => !c.variant).map((c) => c.printed));
    check(m.cards.filter((c) => c.variant).every((c) => mains.has(c.printed)), `${m.id}: every foil and errata print has its main card`);
    if (m.kind === 'expansion') check(m.cardsBySection.get('main').every((c) => ['C', 'U', 'R', 'SR', 'L'].includes(c.rarity)), `${m.id}: the main set is Common to Legendary`);
    check(m.remoteSizes?.sm && m.remoteSizes?.lg, `${m.id}: card images link to Lorcast's size folders`);
  }
  const lorCards = lor.flatMap((m) => m.cards.filter((c) => !c.img).map((c) => Boolean(m.remoteImageId(c))));
  check(lorCards.filter(Boolean).length > lorCards.length * 0.9, `most Lorcana card images are linked from Lorcast rather than stored: ${lorCards.filter(Boolean).length} of ${lorCards.length}`);
  const sizes = (id) => models.get(id)?.visibleTiers.map((t) => t.cards.length).join();
  check(sizes('lorcana/the-first-chapter') === '204,408,420', `The First Chapter tiers are 204, 408 and 420: ${sizes('lorcana/the-first-chapter')}`);
  check(sizes('lorcana/fabled') === '205,410,448', `Fabled tiers are 205, 410 and 448: ${sizes('lorcana/fabled')}`);
  const fabled = models.get('lorcana/fabled');
  const foil = fabled?.cards.find((c) => c.code === 'F12');
  if (foil) {
    const r = parseQuickAdd('1-3, 12x2, F12', fabled);
    check(!r.invalid.length && r.counts.get(fabled.codes.get('12')) === 2 && r.counts.get(foil.id) === 1, 'Lorcana quick add reads numbers and foil codes');
    check(parseQuickAdd('F999', fabled).invalid.length === 1, 'Lorcana quick add rejects codes that aren\'t in the set');
  }
  const lorList = lor[0];
  const lorBack = await decodeList(await encodeList({ key: lorList.syncKey, n: lorList.maxIdx + 1, tier: 'grand', have: [[lorList.cards[0].idx, 3]], missing: [lorList.cards.at(-1).idx] }));
  check(lorBack?.key === lorList.syncKey && lorBack.have.get(lorList.cards[0].idx) === 3, `${lorList.id}: Lorcana trade list round trip`);
}

if (ygo.length || lor.length) {
  const mixed = [tradeSets[0], ...[...ygo.slice(0, 2), ...lor.slice(0, 2)].map(mixedSet)].filter(Boolean);
  const mixedCode = await encodeTrade({ name: 'Mixed', created, sets: mixed });
  const mixedBack = await readTradeText(`https://example.com/#sync=${mixedCode}`);
  check(mixedBack?.sets.length === mixed.length && mixedBack.sets.every((s, i) => s.decoded.key === mixed[i].model.syncKey && sameCounts(resolveCode(s.decoded, mixed[i].model), capped(mixed[i].counts))), 'an Export link with sets from every game round-trips');
  const mixedFile = parseBackup(JSON.stringify(backupFile(mixed.map((s) => ({ id: s.model.id, counts: s.counts, tier: s.tier })), { exported: new Date(created) })));
  check(mixed.every((s) => sameCounts(mixedFile?.entries.find((e) => e.id === s.model.id)?.counts || {}, capped(s.counts))), 'a backup file with every game round-trips');
}

const byIdx = (a, b) => a[0] - b[0];
for (const model of [meg, big].filter(Boolean)) {
  const have = [];
  const missing = [];
  for (const card of model.cards) {
    const r = random();
    if (r < 0.2) have.push([card.idx, r < 0.05 ? 2 + Math.floor(random() * 120) : 1]);
    else if (r < 0.5) missing.push(card.idx);
  }
  const n = model.maxIdx + 1;
  const wantHave = JSON.stringify(have.map(([i, q]) => [i, Math.min(99, q)]).sort(byIdx));
  const wantMissing = JSON.stringify(missing.slice().sort((a, b) => a - b));
  for (const compress of [true, false]) {
    const back = await decodeList(await encodeList({ name: ' Ben ', created, key: model.syncKey, n, tier: 'master', have, missing }, { compress }));
    check(back?.kind === 'list' && back.name === 'Ben' && back.created === created && back.key === model.syncKey && back.n === n && back.tier === 'master'
      && JSON.stringify([...back.have].sort(byIdx)) === wantHave && JSON.stringify(back.missing) === wantMissing, `${model.id}: trade list round trip (${compress ? 'compressed' : 'uncompressed'})`);
  }
}
const listCode = await encodeList({ key: 'MEG', n: 20, tier: 'standard', have: [[3, 2], [7, 1]], missing: null }, { compress: false });
const onlyHave = await decodeList(listCode);
check(onlyHave?.missing === null && onlyHave.counts === true && onlyHave.have.size === 2 && onlyHave.have.get(3) === 2 && onlyHave.have.get(7) === 1, 'a trade list without its missing section reads it as left out');
const noCounts = await decodeList(await encodeList({ key: 'MEG', n: 20, tier: 'standard', have: [[3, 5], [7, 1]], missing: [9], counts: false }, { compress: false }));
check(noCounts?.counts === false && noCounts.have.size === 2 && [...noCounts.have.values()].every((q) => q === 1) && noCounts.missing.join() === '9', 'a trade list with copy counts hidden carries no counts');
const emptyMissing = await decodeList(await encodeList({ key: 'MEG', n: 20, tier: 'standard', have: null, missing: [] }));
check(emptyMissing?.have === null && Array.isArray(emptyMissing.missing) && !emptyMissing.missing.length, 'an empty missing section is kept apart from a left-out one');
check(await decodeList(listCode.slice(0, Math.floor(listCode.length / 2))) === null, 'a cut-off trade list is rejected');
check(await decodeTrade(listCode) === null && await readTradeText(`https://example.com/list/#l=${listCode}`) === null, 'a trade list isn’t read as a trade code');

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

{
  const { withAnalytics } = await import('./lib/pages.mjs');
  for (const file of [join(TEMPLATES, 'collection.html'), join(PUBLIC, 'privacy.html')]) {
    const page = await readFile(file, 'utf8');
    const live = withAnalytics(page, 'https://bindertracker.co.uk/');
    const name = relative(ROOT, file).split(sep).join('/');
    check(withAnalytics(page, 'http://localhost:8080/') === page, `${name}: analytics is left out of local previews`);
    check(/script-src [^;]*https:\/\/static\.cloudflareinsights\.com;/.test(live) && /connect-src [^;]*https:\/\/cloudflareinsights\.com;/.test(live), `${name}: the live CSP allows Cloudflare Web Analytics`);
    check(/<script src="https:\/\/bindertracker\.co\.uk\/js\/shared\/analytics\.js" data-token="/.test(live) && !live.includes('beacon.min.js'), `${name}: the live page loads the analytics loader, never the beacon directly`);
  }
  const loader = await readFile(join(PUBLIC, 'js', 'shared', 'analytics.js'), 'utf8');
  check(loader.includes("location.hash.includes('=')") && loader.includes('spa: false'), 'the analytics loader skips links that carry a code, and doesn’t follow URL changes');
}

{
  const { footerSocials, rootPage } = await import('./lib/pages.mjs');
  const { SOCIALS } = await import('../public/js/shared/socials.js');
  for (const name of ['index', 'game', 'collection', 'list', 'portfolio', 'shared', 'trade', 'guide']) {
    const page = await readFile(join(TEMPLATES, `${name}.html`), 'utf8');
    check(/<footer class="site-footer[\s\S]*\{\{\{footerSocials\}\}\}[\s\S]*<\/footer>/.test(page), `templates/${name}.html: the footer has the social links`);
    if (page.includes('id="dlg-menu"')) check(page.includes('{{{menuSocials}}}'), `templates/${name}.html: the menu has a Follow us group`);
  }
  for (const name of ['privacy.html', 'terms.html']) {
    check((await readFile(join(PUBLIC, name), 'utf8')).includes(footerSocials), `public/${name}: the footer social links match socials.js`);
  }
  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(await rootPage())[1]);
  const org = ld['@graph'].find((n) => n['@type'] === 'Organization');
  check(JSON.stringify(org.sameAs) === JSON.stringify(SOCIALS.map((s) => s.url)), 'the home page JSON-LD lists the social profiles in sameAs');
}

console.log(failures ? `\n${failures} of ${checks} checks failed` : `All ${checks} checks passed (${models.size} collections)`);
process.exitCode = failures ? 1 : 0;
