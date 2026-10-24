export const SKIP = [
  [/\(POR\)$/, 'Portuguese print, not English TCG'],
];

export const SKIP_REGIONS = new Set(['PT', 'SP', 'FR', 'DE', 'IT']);

export const CODE_FIX = {};

export const FROM_TCGPLAYER = new Set(['New', '2', '3', 'Reprint', 'New artwork', 'European & Oceanian debut', 'European debut', 'Oceanian debut', 'force-SMW']);

export const PROMO = {
  maxCards: 5,
  name: /promo|sneak peek|special edition|super edition|deluxe edition|participation|sweepstakes|prize card|collaboration|shonen jump|jump magazine|video game|movie pack|advent calendar|launch event|tournament prize|championship series|premiere!|forbidden memories|duelist league|mattel|hobby league|weekly shonen/i,
};

export const KIND_RULES = [
  [/structure deck|starter deck|starter set|super starter|\bdecks?\b|deck:|chronicles deck|egyptian god deck/i, 'deck'],
  [/\btins?\b|mega[- ]?pack/i, 'tin'],
  [/anniversary pack|power-up pack|war of the giants/i, 'pack'],
  [/collection|box set|legendary|battles? of legend|maximum gold|rarity|anniversary|hidden arsenal|dragons of legend|duel devastator|duel overload|premium gold|ghosts from the past|brothers of legend|duel power|toon chaos|fusion enforcers|destiny soldiers|spirit warriors|dark saviors|mystic fighters|genesis impact|amazing defenders|dark beginning|dark revelation|dark legends|retro pack|gold series|king'?s court|magnificent|quarter century|wing raiders|duelist saga|duel terminal|world superstars|ghosts|stampede|bonanza|fists of the gadgets|crossover breakers/i, 'set'],
  [/duelist pack|battle pack|tournament pack|\bots\b|champion pack|turbo pack|star pack|astral pack|premium pack|limited pack|thank you pack|winner'?s pack|speed duel|world championship|pack/i, 'pack'],
];

export const FORCE = {};

export const ART = {};
