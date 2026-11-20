import { download } from './util.mjs';

export const GAME = { pokemon: 6, lorcana: 19 };

const FIGURES = ['trend', 'avg7', 'avg30'];
const FOIL_SUFFIXES = ['-holo', '-foil'];

const MAX_BAD_SHARE = 0.02;

const valid = (v) => v == null || (Number.isFinite(v) && v >= 0);
const validRow = (row) => Number.isInteger(row?.idProduct) && row.idProduct > 0
  && Object.entries(row).every(([k, v]) => k === 'idProduct' || k === 'idCategory' || valid(v));

function checkGuide(data, game) {
  const all = data?.priceGuides;
  if (!Array.isArray(all) || !all.length) throw new Error(`Cardmarket price guide ${game} has no prices`);
  const rows = all.filter(validRow);
  if (rows.length < all.length * (1 - MAX_BAD_SHARE)) throw new Error(`Cardmarket price guide ${game} has ${all.length - rows.length} malformed rows out of ${all.length}`);
  const updated = /^\d{4}-\d{2}-\d{2}/.exec(String(data.createdAt || ''))?.[0];
  if (!updated) throw new Error(`Cardmarket price guide ${game} has no date`);
  return { updated, rows: new Map(rows.map((r) => [r.idProduct, r])) };
}

const guides = new Map();
export function loadPriceGuide(game) {
  const id = GAME[game];
  if (!id) return null;
  if (!guides.has(id)) {
    const url = `https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_${id}.json`;
    guides.set(id, download(url, { type: 'json' }).then((data) => checkGuide(data, id)));
  }
  return guides.get(id);
}

export const CATALOG_GAME = { pokemon: 6, lorcana: 19, yugioh: 3 };

const validProduct = (p) => Number.isInteger(p?.idProduct) && p.idProduct > 0 && typeof p.name === 'string' && p.name && Number.isInteger(p.idExpansion);

function checkList(data, label) {
  const all = data?.products;
  if (!Array.isArray(all) || !all.length) throw new Error(`Cardmarket product list ${label} has no products`);
  const products = all.filter(validProduct);
  if (products.length < all.length * (1 - MAX_BAD_SHARE)) throw new Error(`Cardmarket product list ${label} has ${all.length - products.length} malformed rows out of ${all.length}`);
  const updated = /^\d{4}-\d{2}-\d{2}/.exec(String(data.createdAt || ''))?.[0];
  if (!updated) throw new Error(`Cardmarket product list ${label} has no date`);
  return { updated, products };
}

const lists = new Map();
export function loadProductList(game, kind = 'singles') {
  const id = CATALOG_GAME[game];
  if (!id) return null;
  const label = `${kind}_${id}`;
  if (!lists.has(label)) {
    const url = `https://downloads.s3.cardmarket.com/productCatalog/productList/products_${label}.json`;
    lists.set(label, download(url, { type: 'json' }).then((data) => checkList(data, label)));
  }
  return lists.get(label);
}

const figure = (row, suffix) => FIGURES.map((f) => row[`${f}${suffix}`]).find((v) => v > 0) ?? null;

export function priceFrom(row, { foil = false } = {}) {
  if (!row) return null;
  const foilFigure = () => FOIL_SUFFIXES.map((s) => figure(row, s)).find((v) => v != null) ?? null;
  return foil ? foilFigure() : figure(row, '') ?? foilFigure();
}
