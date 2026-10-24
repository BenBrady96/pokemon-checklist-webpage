import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import pokemonSets, { LOGO as POKEMON_LOGO, SERIES as POKEMON_SERIES, UPCOMING as POKEMON_UPCOMING } from '../../config/pokemon/sets.mjs';
import pokemonPage from '../../config/pokemon/page.mjs';
import yugiohSets, { LIVE as YUGIOH_LIVE, LOGO as YUGIOH_LOGO, SERIES as YUGIOH_SERIES } from '../../config/yugioh/sets.mjs';
import yugiohPage from '../../config/yugioh/page.mjs';
import { GAMES as ALL_GAMES } from '../../public/js/games/index.js';
import { buildCollection } from '../../public/js/core/model.js';
import { CACHE, IMAGE_HOST, IMAGES_REPO, PUBLIC, download, exists, readJson } from './util.mjs';

const GAME_CONFIG = {
  pokemon: { sets: pokemonSets, series: POKEMON_SERIES, logo: POKEMON_LOGO, upcoming: POKEMON_UPCOMING, page: pokemonPage, live: true },
  yugioh: { sets: yugiohSets, series: YUGIOH_SERIES, logo: YUGIOH_LOGO, upcoming: [], page: yugiohPage, live: YUGIOH_LIVE },
};

export const LIVE_GAMES = Object.keys(GAME_CONFIG).filter((g) => GAME_CONFIG[g].live || process.env.BT_PREVIEW);
const perGame = (key) => Object.fromEntries(LIVE_GAMES.map((g) => [g, GAME_CONFIG[g][key]]));

export const GAMES = Object.fromEntries(LIVE_GAMES.map((g) => [g, ALL_GAMES[g]]));
export const SERIES = perGame('series');
export const GAME_LOGOS = perGame('logo');
export const GAME_PAGES = perGame('page');
export const gameLogoPath = (game) => `img/games/${game}/logo.webp`;

const withId = (game) => (entry) => ({ ...entry, game, id: `${game}/${entry.slug}` });

export const CONFIG = LIVE_GAMES.flatMap((g) => GAME_CONFIG[g].sets.map(withId(g)));
export const COMING_SOON = LIVE_GAMES.flatMap((g) => GAME_CONFIG[g].upcoming
  .filter((e) => !CONFIG.some((c) => c.game === g && c.slug === e.slug))
  .map(withId(g)));

export const dataDir = (id) => join(PUBLIC, 'data', ...id.split('/'));
export const imageDir = (id) => join(PUBLIC, 'img', 'cards', ...id.split('/'));
export const cachedImageDir = (id) => join(CACHE, 'images', ...id.split('/'));

const ownHost = (model) => model.remoteBase?.startsWith(`${IMAGE_HOST}/`);

export function cardImageFile(model, card, size = 'sm') {
  const remoteId = model.remoteImageId(card);
  if (remoteId && ownHost(model)) return join(IMAGES_REPO, model.remoteBase.slice(IMAGE_HOST.length + 1), remoteId, size === 'lg' ? 'high.webp' : 'low.webp');
  return join(remoteId ? cachedImageDir(model.id) : imageDir(model.id), size, `${card.imageId}.webp`);
}

export async function ensureCardImage(model, card, size = 'sm') {
  const file = cardImageFile(model, card, size);
  if (model.remoteImageId(card) && !ownHost(model) && !(await exists(file))) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await download(model.imageUrl(card, size), { attempts: 6 }));
  }
  return file;
}

export function selectEntries(only = [], game = null) {
  if (game && !LIVE_GAMES.includes(game)) throw new Error(`Unknown or hidden game: ${game}. Live games: ${LIVE_GAMES.join(', ')}`);
  const pool = game ? CONFIG.filter((e) => e.game === game) : CONFIG;
  if (!only.length) return pool;
  const matching = (s) => pool.filter((e) => e.slug === s || e.id === s);
  const unknown = only.filter((s) => !matching(s).length);
  if (unknown.length) throw new Error(`Unknown collection: ${unknown.join(', ')}`);
  const ambiguous = only.filter((s) => matching(s).length > 1);
  if (ambiguous.length) throw new Error(`More than one game has ${ambiguous.join(', ')}. Use the full id (game/slug) or --game.`);
  return pool.filter((e) => only.includes(e.slug) || only.includes(e.id));
}

export const loadRaw = (id) => readJson(join(dataDir(id), 'cards.json'));

export async function loadModel(id, { raw } = {}) {
  const data = raw || await loadRaw(id);
  if (!data) throw new Error(`${id}: no data yet. Run npm run sets first.`);
  const images = (await readJson(join(dataDir(id), 'images.json'))) || {};
  return buildCollection(data, { game: ALL_GAMES[data.game], colors: images.colors || {}, remote: images.remote || null, imageBase: join(imageDir(id)) });
}

export const loadCatalog = () => readJson(join(PUBLIC, 'data', 'catalog.json'));
