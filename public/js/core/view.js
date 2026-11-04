import { buildCollection, cardImageUrl } from './model.js';

export const viewDataPath = (id) => {
  const [game, kind, slug] = id.split('/');
  return `data/${game}/views/${kind}/${slug}.json`;
};

const urlOf = (set, card, size, asset) => cardImageUrl({
  imageBase: asset(`img/cards/${set.id}`), imageId: card.img, remoteBase: set.base, remoteId: card.rid, remoteSizes: set.sizes,
}, size);

export function viewThumb(raw, asset = (path) => path) {
  const card = raw.cards[raw.thumb];
  return card ? urlOf(raw.sets[card.s], card, 'sm', asset) : null;
}

export function buildView(raw, { game, asset = (path) => path }) {
  const cards = raw.cards.map((c, i) => {
    const set = raw.sets[c.s];
    return {
      ...c,
      id: `${set.key}_${c.c}`,
      idx: i,
      setName: set.name,
      display: raw.displays[c.dp],
      keywords: [c.keywords, set.name].filter(Boolean).join(' '),
    };
  });
  const model = buildCollection({ ...raw, cards }, { game });
  for (const card of model.cards) if (card.ri) card.rarityIcon = card.ri;
  const thumb = viewThumb(raw, asset);
  return {
    ...model,
    isView: true,
    viewSets: raw.sets,
    logoUrl: thumb,
    hasImage: (card) => card.col != null,
    imageColor: (card, fallback = '#6a6f8f') => card.col || fallback,
    remoteImageId: (card) => card.rid || null,
    imageUrl: (card, size = 'sm') => urlOf(raw.sets[card.s], card, size, asset),
  };
}

export function viewPrices(raw, model) {
  const cards = {};
  for (const card of model.cards) if (card.p) cards[card.id] = card.p;
  return { ...raw.rates, cards };
}
