import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import pokemonSets, { LOGO as POKEMON_LOGO, SERIES as POKEMON_SERIES } from '../../collections/pokemon/sets.mjs';
import * as pokemon from '../../js/games/pokemon.js';
import { buildCollection } from '../../js/model.js';
import { CACHE, ROOT, download, exists, readJson } from './util.mjs';

export const GAMES = { pokemon };
export const SERIES = { pokemon: POKEMON_SERIES };
export const GAME_LOGOS = { pokemon: POKEMON_LOGO };
export const gameLogoPath = (game) => `img/games/${game}/logo.webp`;

export const CONFIG = pokemonSets.map((entry) => ({ ...entry, game: 'pokemon', id: `pokemon/${entry.slug}` }));

export const dataDir = (id) => join(ROOT, 'data', ...id.split('/'));
export const imageDir = (id) => join(ROOT, 'img', 'cards', ...id.split('/'));
export const cachedImageDir = (id) => join(CACHE, 'images', ...id.split('/'));

export const cardImageFile = (model, card, size = 'sm') =>
  join(model.remoteImageId(card) ? cachedImageDir(model.id) : imageDir(model.id), size, `${card.imageId}.webp`);

export async function ensureCardImage(model, card, size = 'sm') {
  const file = cardImageFile(model, card, size);
  if (model.remoteImageId(card) && !(await exists(file))) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await download(model.imageUrl(card, size), { attempts: 6 }));
  }
  return file;
}

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
  const images = (await readJson(join(dataDir(id), 'images.json'))) || {};
  return buildCollection(data, { game: GAMES[data.game], colors: images.colors || {}, remote: images.remote || null, imageBase: join(imageDir(id)) });
}

export const loadCatalog = () => readJson(join(ROOT, 'data', 'catalog.json'));
