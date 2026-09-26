import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import pokemonSets, { SERIES as POKEMON_SERIES } from '../../collections/pokemon/sets.mjs';
import * as pokemon from '../../js/games/pokemon.js';
import { buildCollection } from '../../js/model.js';
import { ROOT, readJson } from './util.mjs';

export const GAMES = { pokemon };
export const SERIES = { pokemon: POKEMON_SERIES };

export const CONFIG = pokemonSets.map((entry) => ({ ...entry, game: 'pokemon', id: `pokemon/${entry.slug}` }));

export const dataDir = (id) => join(ROOT, 'data', ...id.split('/'));
export const imageDir = (id) => join(ROOT, 'img', 'cards', ...id.split('/'));

export function selectEntries(only = []) {
  if (!only.length) return CONFIG;
  const picked = CONFIG.filter((e) => only.includes(e.slug) || only.includes(e.id));
  const unknown = only.filter((s) => !CONFIG.some((e) => e.slug === s || e.id === s));
  if (unknown.length) throw new Error(`Unknown collection: ${unknown.join(', ')}`);
  return picked;
}

export const curatedModule = (entry) => import(pathToFileURL(join(ROOT, 'collections', entry.game, entry.curated)).href);

export const loadRaw = (id) => readJson(join(dataDir(id), 'cards.json'));

export async function loadModel(id, { raw } = {}) {
  const data = raw || await loadRaw(id);
  if (!data) throw new Error(`${id}: no data yet. Run npm run sets first.`);
  const colors = (await readJson(join(dataDir(id), 'images.json')))?.colors || {};
  return buildCollection(data, { game: GAMES[data.game], colors, imageBase: join(imageDir(id)) });
}

export const loadCatalog = () => readJson(join(ROOT, 'data', 'catalog.json'));
