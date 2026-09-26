import { join } from 'node:path';
import { CONFIG, GAMES, SERIES, loadModel, loadRaw } from './collections.mjs';
import { compileTheme, tileVars } from './theme.mjs';
import { ROOT, exists, writeJson } from './util.mjs';

const KIND_ORDER = { expansion: 0, promo: 1, energy: 2 };

export async function writeCatalog() {
  const collections = [];
  const syncKeys = new Map();
  for (const entry of CONFIG) {
    if (!(await loadRaw(entry.id))) {
      console.warn(`  ${entry.id}: no data yet, left out of the catalog (run npm run sets -- --only ${entry.slug})`);
      continue;
    }
    const model = await loadModel(entry.id);
    if (syncKeys.has(model.syncKey)) throw new Error(`Sync key ${model.syncKey} is used by ${syncKeys.get(model.syncKey)} and ${entry.id}`);
    syncKeys.set(model.syncKey, entry.id);
    const theme = compileTheme(entry.theme);
    const logo = `img/sets/${entry.id}/logo.webp`;
    collections.push({
      id: entry.id,
      game: entry.game,
      slug: entry.slug,
      name: model.name,
      series: model.series,
      kind: model.kind || 'expansion',
      code: model.code,
      syncKey: model.syncKey,
      released: model.released,
      total: model.getTier('complete').cards.length,
      tiers: model.visibleTiers.map((t) => ({ id: t.id, label: t.label, count: t.cards.length })),
      defaultTier: model.defaultTier,
      logo: (await exists(join(ROOT, logo))) ? logo : null,
      cover: model.cover || null,
      tile: tileVars(theme),
      themeColor: theme.themeColor,
    });
  }
  const seriesOrder = (c) => {
    const i = SERIES[c.game].indexOf(c.series);
    return i < 0 ? 99 : i;
  };
  collections.sort((a, b) => seriesOrder(a) - seriesOrder(b)
    || (KIND_ORDER[a.kind] ?? 3) - (KIND_ORDER[b.kind] ?? 3)
    || b.released.localeCompare(a.released)
    || a.name.localeCompare(b.name));
  await writeJson(join(ROOT, 'data', 'catalog.json'), {
    games: Object.values(GAMES).map((g) => ({ id: g.id, name: g.name, series: SERIES[g.id] })),
    collections,
  });
  console.log(`data/catalog.json: ${collections.length} collection(s)`);
  return collections;
}
