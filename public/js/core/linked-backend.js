import * as storage from './storage.js';

export function linkedBackend(model) {
  const own = model.cards.filter((card) => !card.link);
  const linked = model.cards.filter((card) => card.link);
  return {
    keys: new Set([model.id, ...model.linkedSets].map(storage.collectionKey)),
    load() {
      const out = storage.readCounts(model.id);
      const homes = new Map(model.linkedSets.map((id) => [id, storage.readCounts(id)]));
      for (const card of linked) {
        const n = homes.get(card.link.set)[card.link.id];
        if (n) out[card.id] = n;
      }
      return out;
    },
    save(qty, changed = []) {
      const bySet = new Map();
      for (const id of changed) {
        const card = model.cardById.get(id);
        if (!card?.link) continue;
        if (!bySet.has(card.link.set)) bySet.set(card.link.set, []);
        bySet.get(card.link.set).push(card);
      }
      for (const [setId, cards] of bySet) {
        const counts = storage.readCounts(setId);
        for (const card of cards) {
          const n = qty.get(card.id) || 0;
          if (n) counts[card.link.id] = n;
          else delete counts[card.link.id];
        }
        storage.writeCounts(setId, counts, model.linkHomes.get(setId));
      }
      const counts = {};
      for (const card of own) if (qty.has(card.id)) counts[card.id] = qty.get(card.id);
      storage.writeCounts(model.id, counts, model);
    },
  };
}
