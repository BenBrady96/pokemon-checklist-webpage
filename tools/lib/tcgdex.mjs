import { cachedJson, mapLimit } from './util.mjs';

const API = 'https://api.tcgdex.net/v2/en';
export const ASSETS = 'https://assets.tcgdex.net';

export const loadSet = (id, { refresh = false } = {}) => cachedJson(`${API}/sets/${encodeURIComponent(id)}`, { refresh });
export const loadCard = (id, { refresh = false } = {}) => cachedJson(`${API}/cards/${encodeURIComponent(id)}`, { refresh });

export async function loadSetCards(setId, { refresh = false, onProgress } = {}) {
  const set = await loadSet(setId, { refresh });
  let done = 0;
  const cards = await mapLimit(set.cards, 6, async (brief) => {
    const card = await loadCard(brief.id, { refresh });
    onProgress?.(++done, set.cards.length);
    return card;
  });
  return { set, cards };
}

export const cardImageUrl = (card, quality = 'high') => (card.image ? `${card.image}/${quality}.webp` : null);
export const setLogoUrl = (set) => (set.logo ? `${set.logo}.webp` : null);
