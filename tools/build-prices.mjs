import { join } from 'node:path';
import { CONFIG, curatedModule, dataDir, loadModel, loadRaw } from './lib/collections.mjs';
import { normalize } from '../js/model.js';
import { lastUpdated, loadPrices, loadProducts, productNumber } from './lib/tcgcsv.mjs';
import { download, readJson, writeJson } from './lib/util.mjs';

const FX_SOURCES = [
  ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP', (d) => d.rates?.GBP],
  ['https://open.er-api.com/v6/latest/USD', (d) => d.rates?.GBP],
];
const MIN_SHARE = 0.7;

async function exchangeRate() {
  for (const [url, pick] of FX_SOURCES) {
    try {
      const rate = pick(await download(url, { type: 'json' }));
      if (rate > 0) return rate;
    } catch (err) {
      console.warn(`  ${err.message}`);
    }
  }
  throw new Error('No USD to GBP exchange rate available');
}

const groupCache = new Map();
function loadGroup(id) {
  if (!groupCache.has(id)) {
    groupCache.set(id, Promise.all([loadProducts(id, { refresh: true }), loadPrices(id)]).then(([products, prices]) => ({ products, prices })));
  }
  return groupCache.get(id);
}

const firstWord = (s) => normalize(s).split(/[^a-z0-9]+/).find(Boolean);
const only = (list) => (list.length === 1 ? list[0].productId : null);
const helpers = { number: productNumber, firstWord, only };

function priceRow(rows, productId, sub) {
  const mine = rows.filter((p) => p.productId === productId);
  if (sub) return mine.find((p) => p.subTypeName === sub);
  return mine.find((p) => p.subTypeName === 'Holofoil')
    || mine.find((p) => p.subTypeName === 'Normal')
    || mine.find((p) => p.subTypeName !== 'Reverse Holofoil' && p.marketPrice != null)
    || mine[0];
}

async function priceCollection(entry, { updated, gbpPerUsd }) {
  const raw = await loadRaw(entry.id);
  if (!raw) return;
  const model = await loadModel(entry.id, { raw });
  const curated = entry.curated ? await curatedModule(entry) : null;
  const groupIds = curated
    ? curated.tcgplayerGroups
    : Object.fromEntries([...new Set([...entry.tcgplayer, ...model.cards.map((c) => c.grp).filter(Boolean)])].map((id) => [id, id]));
  const groups = Object.fromEntries(await Promise.all(Object.entries(groupIds).map(async ([key, id]) => [key, await loadGroup(id)])));
  const rows = Object.values(groups).flatMap((g) => g.prices);

  const cards = {};
  const unmatched = [];
  let priced = 0;
  for (const card of model.cards) {
    const tcg = curated ? curated.productFor(card, groups, helpers) : card.tcg;
    if (!tcg) {
      unmatched.push(card.id);
      continue;
    }
    const row = priceRow(rows, tcg, card.sub);
    const price = { tcg, usd: row?.marketPrice ?? null };
    if (price.usd == null && row?.lowPrice != null) price.from = row.lowPrice;
    if (price.usd != null) priced++;
    cards[card.id] = price;
  }

  const file = join(dataDir(entry.id), 'prices.json');
  const previous = await readJson(file);
  const previousPriced = previous ? Object.values(previous.cards).filter((p) => p.usd != null).length : 0;
  if (priced < model.cards.length * MIN_SHARE && previousPriced > priced) {
    console.warn(`${entry.id}: only ${priced} of ${model.cards.length} cards priced; keeping the previous file (${previousPriced} priced)`);
    return;
  }
  await writeJson(file, { updated, gbpPerUsd: Number(gbpPerUsd.toFixed(5)), cards }, { lines: ['cards'] });
  console.log(`${entry.id}: ${priced} of ${model.cards.length} priced${unmatched.length ? `, ${unmatched.length} not on TCGplayer` : ''}`);
}

const [updated, gbpPerUsd] = await Promise.all([lastUpdated(), exchangeRate()]);
const day = updated.slice(0, 10);
console.log(`Prices from ${updated}, $1 = £${gbpPerUsd.toFixed(4)}`);
let failed = 0;
for (const entry of CONFIG) {
  try {
    await priceCollection(entry, { updated: day, gbpPerUsd });
  } catch (err) {
    failed++;
    console.error(`${entry.id}: ${err.message}`);
  }
}
if (failed === CONFIG.length) throw new Error('No prices could be downloaded');
if (failed) process.exitCode = 1;
