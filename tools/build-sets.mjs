import { join } from 'node:path';
import { curatedModule, dataDir, loadModel, loadRaw, selectEntries } from './lib/collections.mjs';
import { writeCatalog } from './lib/catalog.mjs';
import { args, writeJson } from './lib/util.mjs';

const opts = args();
const entries = selectEntries(opts.list('only'));

async function generate(entry) {
  const { generateCollection } = await import('./lib/tcgdex-source.mjs');
  return generateCollection(entry, { refresh: opts.has('refresh') });
}

async function keepPositions(raw) {
  const previous = await loadRaw(raw.id);
  const known = new Map((previous?.cards || []).map((c) => [c.id, c.idx]));
  let next = Math.max(-1, ...known.values()) + 1;
  for (const card of raw.cards) card.idx = known.has(card.id) ? known.get(card.id) : next++;
  const removed = [...known.keys()].filter((id) => !raw.cards.some((c) => c.id === id));
  if (removed.length) console.warn(`  ${raw.id}: ${removed.length} card(s) no longer listed: ${removed.join(', ')}`);
}

for (const entry of entries) {
  const raw = entry.curated ? structuredClone((await curatedModule(entry)).default) : await generate(entry);
  if (raw.id !== entry.id) throw new Error(`${entry.slug}: data says id ${raw.id}`);
  if (!entry.curated) await keepPositions(raw);
  const model = await loadModel(entry.id, { raw });
  await writeJson(join(dataDir(entry.id), 'cards.json'), raw, { lines: ['cards'] });
  const tiers = model.visibleTiers.map((t) => `${t.label} ${t.cards.length}`).join(' · ');
  console.log(`${entry.id}: ${model.cards.length} cards (${tiers})`);
}

await writeCatalog();
