const CARDMARKET = 'https://www.cardmarket.com/en';

export const cardmarketLink = (game, card) => (card.cm
  ? `${CARDMARKET}/${game.CARDMARKET}/Products?idProduct=${card.cm}`
  : `${CARDMARKET}/${game.CARDMARKET}/Products/Search?searchString=${encodeURIComponent(card.name)}`);

const cardKey = (setId, card) => (card.link ? `${card.link.set}|${card.link.id}` : `${setId}|${card.id}`);

const tally = (lines) => [...lines].map(([line, n]) => `${n} ${line}`);

export function wantsBlocks(sets) {
  const games = new Map();
  const seen = new Set();
  for (const { model, counts, tier, lines } of sets) {
    const { game } = model;
    if (!games.has(game.id)) games.set(game.id, { game, paste: new Map(), foil: new Map(), foilLabel: null, hand: [], missing: 0 });
    const out = games.get(game.id);
    for (const card of tier.cards) {
      if (counts[card.id]) continue;
      const key = cardKey(model.id, card);
      if (seen.has(key)) continue;
      seen.add(key);
      out.missing++;
      const line = lines?.[card.id];
      if (!line) {
        out.hand.push({ card, setName: card.setName || model.name, href: cardmarketLink(game, card) });
        continue;
      }
      const bucket = card.cmFoil ? out.foil : out.paste;
      if (card.cmFoil) out.foilLabel ||= card.variant || 'Foil';
      bucket.set(line, (bucket.get(line) || 0) + 1);
    }
  }
  return [...games.values()].map((g) => ({
    game: g.game,
    missing: g.missing,
    paste: tally(g.paste),
    foil: tally(g.foil),
    foilLabel: g.foilLabel,
    hand: g.hand,
  }));
}

export const cardsIn = (lines) => lines.reduce((n, line) => n + Number.parseInt(line, 10), 0);

export const WANTS_LIMIT = 150;

export function chunkLines(lines, limit = WANTS_LIMIT) {
  const parts = [];
  let part = [];
  let size = 0;
  for (const line of lines) {
    const n = Number.parseInt(line, 10);
    if (part.length && size + n > limit) {
      parts.push(part);
      part = [];
      size = 0;
    }
    part.push(line);
    size += n;
  }
  if (part.length) parts.push(part);
  return parts;
}
