import * as storage from '../core/storage.js';

export function progressOf(raw) {
  const tier = storage.getPrefs().tiers[raw.id];
  const counts = new Map();
  const countsFor = (s) => {
    if (!counts.has(s)) counts.set(s, storage.readCounts(raw.sets[s].id));
    return counts.get(s);
  };
  let owned = 0;
  let total = 0;
  for (const card of raw.cards) {
    if (card.feat && (tier === 'standard' || tier === 'master')) continue;
    if (card.variant && tier === 'standard') continue;
    total++;
    if (countsFor(card.s)[card.c] > 0) owned++;
  }
  return { owned, total };
}
