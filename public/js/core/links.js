import { buildCollection } from './model.js';

export const linkedSets = (raw) => [...new Set((raw.links || []).map((link) => link.set))];

export function withLinks(raw, options, homes) {
  const linked = [];
  const homeCard = new Map();
  const byHome = new Map();
  const details = { ...raw.info?.details };
  for (const link of raw.links) {
    const home = homes.get(link.set);
    if (!home) throw new Error(`${raw.id}: linked list ${link.set} isn’t loaded`);
    for (const cardId of link.ids) {
      const card = home.cardById.get(cardId);
      if (!card) throw new Error(`${raw.id}: ${link.set} has no card ${cardId}`);
      const id = `${home.syncKey}_${cardId}`;
      linked.push({
        id, section: link.section, num: card.num, printed: card.printed, name: card.name, rarity: card.rarity,
        ...(card.type && { type: card.type }), ...(card.tcg && { tcg: card.tcg }), ...(card.cm && { cm: card.cm }),
        ...(card.note && { note: card.note }), setName: home.name, keywords: [card.keywords, home.name].filter(Boolean).join(' '),
        link: { set: link.set, id: cardId },
      });
      homeCard.set(id, { home, card });
      byHome.set(`${link.set}|${cardId}`, id);
      if (home.info?.details?.[cardId]) details[id] = home.info.details[cardId];
    }
  }
  const model = buildCollection({ ...raw, cards: [...raw.cards, ...linked], info: { ...raw.info, details } }, options);
  const own = { hasImage: model.hasImage, imageColor: model.imageColor, remoteImageId: model.remoteImageId, imageUrl: model.imageUrl };
  const via = (card) => homeCard.get(card.id);
  return {
    ...model,
    linkedSets: [...homes.keys()],
    linkHomes: homes,
    linkedId: (set, cardId) => byHome.get(`${set}|${cardId}`) || null,
    hasImage: (card) => (via(card) ? via(card).home.hasImage(via(card).card) : own.hasImage(card)),
    imageColor: (card, fallback) => (via(card) ? via(card).home.imageColor(via(card).card, fallback) : own.imageColor(card, fallback)),
    remoteImageId: (card) => (via(card) ? via(card).home.remoteImageId(via(card).card) : own.remoteImageId(card)),
    imageUrl: (card, size = 'sm') => (via(card) ? via(card).home.imageUrl(via(card).card, size) : own.imageUrl(card, size)),
  };
}
