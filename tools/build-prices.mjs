import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS, normalize } from '../js/cards.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TCGCSV = 'https://tcgcsv.com/tcgplayer/3';
const GROUPS = { set: 24722, classic: 24837, promos: 24451, energy: 24461 };
const PRODUCT_OVERRIDES = { v03: 713261 };
const FX_SOURCES = [
  ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP', (d) => d.rates?.GBP],
  ['https://open.er-api.com/v6/latest/USD', (d) => d.rates?.GBP],
];
const MIN_PRICED = 200;

async function get(url, type = 'json') {
  const res = await fetch(url, { headers: { 'User-Agent': '30th-celebration-checklist price snapshot' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return type === 'json' ? res.json() : res.text();
}

async function loadGroup(id) {
  const [products, prices] = await Promise.all([get(`${TCGCSV}/${id}/products`), get(`${TCGCSV}/${id}/prices`)]);
  return { products: products.results, prices: prices.results };
}

async function exchangeRate() {
  for (const [url, pick] of FX_SOURCES) {
    try {
      const rate = pick(await get(url));
      if (rate > 0) return rate;
    } catch (err) {
      console.warn(`  ${err.message}`);
    }
  }
  throw new Error('No USD to GBP exchange rate available');
}

const key = (id) => (/^[a-z_$][\w$]*$/i.test(id) ? id : `'${id}'`);
const number = (p) => p.extendedData?.find((e) => e.name === 'Number')?.value || '';
const firstWord = (s) => normalize(s).split(/[^a-z0-9]+/).find(Boolean);
const only = (list) => (list.length === 1 ? list[0].productId : null);

function productFor(card, groups) {
  if (PRODUCT_OVERRIDES[card.id]) return PRODUCT_OVERRIDES[card.id];
  if (card.base) return null;
  if (card.section === 'classic') {
    const sameNumber = groups.classic.products.filter((p) => parseInt(number(p), 10) === Number(card.num));
    return only(sameNumber.length > 1 ? sameNumber.filter((p) => firstWord(p.name) === firstWord(card.name)) : sameNumber);
  }
  if (card.section === 'energy') return only(groups.energy.products.filter((p) => number(p) === card.num));
  if (card.rarity === 'P') {
    return only(groups.promos.products.filter((p) => number(p) === card.num && !/pokemon center|cosmos|stamp|staff|prerelease/i.test(p.name)));
  }
  return only(groups.set.products.filter((p) => number(p) === card.printed));
}

function priceRow(productId, groups) {
  const rows = Object.values(groups).flatMap((g) => g.prices).filter((p) => p.productId === productId);
  return rows.find((p) => p.subTypeName === 'Holofoil') || rows.find((p) => p.marketPrice != null) || rows[0];
}

const groups = Object.fromEntries(await Promise.all(Object.entries(GROUPS).map(async ([key, id]) => [key, await loadGroup(id)])));
const [updated, gbpPerUsd] = await Promise.all([get('https://tcgcsv.com/last-updated.txt', 'text'), exchangeRate()]);

const entries = [];
const unmatched = [];
let priced = 0;
for (const card of CARDS) {
  const tcg = productFor(card, groups);
  if (!tcg) {
    unmatched.push(card.id);
    continue;
  }
  const row = priceRow(tcg, groups);
  const entry = { tcg, usd: row?.marketPrice ?? null };
  if (entry.usd == null && row?.lowPrice != null) entry.from = row.lowPrice;
  if (entry.usd != null) priced++;
  entries.push(`    ${key(card.id)}: { ${Object.entries(entry).map(([k, v]) => `${k}: ${v}`).join(', ')} },`);
}

if (priced < MIN_PRICED) throw new Error(`Only ${priced} cards have a price; not overwriting js/prices.js`);

const body = `export default {
  updated: '${updated.trim().slice(0, 10)}',
  gbpPerUsd: ${Number(gbpPerUsd.toFixed(5))},
  cards: {
${entries.join('\n')}
  },
};
`;
await writeFile(join(ROOT, 'js/prices.js'), body);
console.log(`Prices from ${updated.trim()}: ${priced} of ${CARDS.length} cards priced, $1 = £${gbpPerUsd.toFixed(4)}`);
if (unmatched.length) console.log(`  No TCGplayer listing: ${unmatched.join(', ')}`);
