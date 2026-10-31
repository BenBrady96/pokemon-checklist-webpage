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

const figure = (row, suffix) => FIGURES.map((f) => row[`${f}${suffix}`]).find((v) => v > 0) ?? null;

export function priceFrom(row, { foil = false } = {}) {
  if (!row) return null;
  const foilFigure = () => FOIL_SUFFIXES.map((s) => figure(row, s)).find((v) => v != null) ?? null;
  return foil ? foilFigure() : figure(row, '') ?? foilFigure();
}
