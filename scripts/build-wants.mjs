import { join } from 'node:path';
import { CONFIG, dataDir, loadModel, loadRaw, selectEntries } from './lib/collections.mjs';
import { loadProductList } from './lib/cardmarket.mjs';
import { args, mapLimit, readJson, writeJson } from './lib/util.mjs';
import { indexProducts, lineForCard, nameCandidates, nameIndex, nameLines, overlapExpansions, plainText, primaryExpansion, productFor, resolveExpansions, sharedProducts } from './lib/wants.mjs';
import { EXPANSION_NAMES } from '../config/cardmarket.mjs';

const opts = args();
const entries = selectEntries(opts.list('only'), opts.get('game'));
const verbose = opts.has('verbose');
const count = new Intl.NumberFormat('en-GB');

async function save(id, lines, updated) {
  const file = join(dataDir(id), 'cardmarket.json');
  const previous = await readJson(file);
  if (!previous && !Object.keys(lines).length) return false;
  if (previous && JSON.stringify(previous.lines) === JSON.stringify(lines)) return false;
  await writeJson(file, { updated, lines }, { lines: ['lines'] });
  return true;
}

async function buildGame(game) {
  const [singles, sealedList] = await Promise.all([loadProductList(game, 'singles'), loadProductList(game, 'nonsingles')]);
  const sealed = new Map();
  for (const p of sealedList.products) {
    if (!sealed.has(p.idExpansion)) sealed.set(p.idExpansion, []);
    sealed.get(p.idExpansion).push(p.name);
  }
  const byCm = game !== 'yugioh';
  const index = byCm ? indexProducts(singles.products) : null;
  const byName = byCm ? null : nameIndex(singles.products);

  const all = CONFIG.filter((e) => e.game === game);
  const raws = new Map((await mapLimit(all, 8, async (e) => [e.id, await loadRaw(e.id)])).filter(([, raw]) => raw));
  const sets = [...raws].map(([id, raw]) => {
    let expansions;
    if (byCm) {
      expansions = new Map();
      for (const c of raw.cards) {
        const p = productFor(c, index);
        if (p) expansions.set(p.idExpansion, (expansions.get(p.idExpansion) || 0) + 1);
      }
    } else {
      expansions = overlapExpansions(raw.cards.map((c) => c.name), byName);
    }
    return { id, name: raw.name, expansions };
  });
  const setById = new Map(sets.map((s) => [s.id, s]));
  const resolved = resolveExpansions({ sets, sealed, overrides: EXPANSION_NAMES });

  let cards = 0;
  let pasted = 0;
  let changed = 0;
  const unverified = [];
  const renamed = [];
  for (const entry of entries.filter((e) => e.game === game && raws.has(e.id))) {
    const set = setById.get(entry.id);
    let lines = {};
    let verified;
    if (byCm) {
      const model = await loadModel(entry.id, { raw: raws.get(entry.id), links: true });
      const shared = sharedProducts(model.cards);
      for (const card of model.cards) {
        const line = shared.has(card.cm) ? null : lineForCard(card, index, resolved);
        if (line) lines[card.id] = line;
      }
      cards += model.cards.length;
      const primary = primaryExpansion(set);
      verified = primary == null ? null : resolved.has(primary) ? primary : false;
    } else {
      const exp = [...set.expansions.keys()].find((x) => resolved.get(x)?.set === entry.id);
      if (exp != null) lines = nameLines(raws.get(entry.id).cards, byName, { id: exp, name: resolved.get(exp).name });
      cards += raws.get(entry.id).cards.length;
      verified = exp ?? (set.expansions.size ? false : null);
    }
    pasted += Object.keys(lines).length;
    if (await save(entry.id, lines, singles.updated)) changed++;
    if (verified === false) {
      const primary = primaryExpansion(set);
      unverified.push(`  ${entry.id}  “${set.name}”  Cardmarket sells: ${(sealed.get(primary) || []).slice(0, 3).map((n) => `“${n}”`).join(', ') || 'no sealed products'}`);
    } else if (verified != null) {
      const { name, override } = resolved.get(verified);
      if (!override && !nameCandidates(set.name).includes(name)) renamed.push(`  ${entry.id}  “${plainText(set.name)}” is “${name}” on Cardmarket`);
    }
  }
  console.log(`Cardmarket ${game} products from ${singles.updated}: ${count.format(pasted)} of ${count.format(cards)} cards can be pasted into a wants list, ${changed} file${changed === 1 ? '' : 's'} updated`);
  if (unverified.length) {
    console.log(`${unverified.length} ${game} set${unverified.length === 1 ? ' has' : 's have'} no verified Cardmarket expansion name. Add the right name to config/cardmarket.mjs to paste them:`);
    console.log(unverified.join('\n'));
  }
  if (verbose && renamed.length) console.log(`${game} names taken from Cardmarket:\n${renamed.join('\n')}`);
}

let failed = 0;
const games = [...new Set(entries.map((e) => e.game))];
for (const game of games) {
  try {
    await buildGame(game);
  } catch (err) {
    failed++;
    console.error(`Cardmarket ${game}: ${err.message}; keeping the previous wants data`);
  }
}
if (failed) process.exitCode = 1;
