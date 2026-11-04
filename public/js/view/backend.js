import { fetchCollection } from '../core/collection.js';
import * as storage from '../core/storage.js';

export function viewBackend(model) {
  const byId = new Map(model.cards.map((card) => [card.id, card]));
  const models = new Map();

  async function refreshSummary(setId) {
    try {
      const setModel = await fetchCollection(setId);
      models.set(setId, setModel);
      storage.refreshSummary(setId, setModel);
    } catch {}
  }

  return {
    keys: new Set(model.viewSets.map((set) => storage.collectionKey(set.id))),
    load() {
      const counts = model.viewSets.map((set) => storage.readCounts(set.id));
      const out = {};
      for (const card of model.cards) {
        const n = counts[card.s][card.c];
        if (n) out[card.id] = n;
      }
      return out;
    },
    save(qty, changed) {
      const bySet = new Map();
      for (const id of changed) {
        const card = byId.get(id);
        if (!bySet.has(card.s)) bySet.set(card.s, []);
        bySet.get(card.s).push(card);
      }
      for (const [s, cards] of bySet) {
        const setId = model.viewSets[s].id;
        const counts = storage.readCounts(setId);
        for (const card of cards) {
          const n = qty.get(card.id) || 0;
          if (n) counts[card.c] = n;
          else delete counts[card.c];
        }
        storage.writeCounts(setId, counts, models.get(setId) || null);
        if (!models.has(setId)) refreshSummary(setId);
      }
    },
  };
}

export function sharedBackend(model, shared, onBlocked) {
  const out = {};
  const bySlot = new Map(model.cards.map((card) => [`${model.viewSets[card.s].key}|${card.x}`, card]));
  for (const { key, lines } of shared.sets) {
    for (const [idx, q] of lines) {
      const card = bySlot.get(`${key}|${idx}`);
      if (card) out[card.id] = q;
    }
  }
  return {
    readOnly: true,
    tier: shared.tier,
    onBlocked,
    keys: new Set(),
    load: () => out,
    save() {},
  };
}
