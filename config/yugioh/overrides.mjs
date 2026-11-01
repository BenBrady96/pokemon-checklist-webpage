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

export const FORCE = {
  "Pharaoh's Servant (25th Anniversary Edition)": { promo: false, kind: 'set', slug: 'pharaohs-servant-25th-anniversary-edition', syncKey: 'YPSV2', tcgplayer: [23054] },
  'Dark Crisis (25th Anniversary Edition)': { promo: false, kind: 'set', slug: 'dark-crisis-25th-anniversary-edition', syncKey: 'YDCR2', tcgplayer: [23055] },
};

export const EXTRA_SETS = [
  { name: 'Invasion of Chaos (25th Anniversary Edition)', code: 'IOC', kind: 'set', released: '2023-04-20', tcgplayer: [23056], packArt: 'IOC' },
];

export const TCGPLAYER_LIST = new Set([
  'Legend of Blue Eyes White Dragon (25th Anniversary Edition)',
  'Metal Raiders (25th Anniversary Edition)',
  'Spell Ruler (25th Anniversary Edition)',
  "Pharaoh's Servant (25th Anniversary Edition)",
  'Dark Crisis (25th Anniversary Edition)',
  'Invasion of Chaos (25th Anniversary Edition)',
]);

export const PRINT_TAGS = [
  { match: /^original artwork$/i, id: 'orig', name: 'Original Artwork', abbr: 'OA' },
  { match: /^1st edition artwork$/i, id: 'first-art', name: '1st Edition Artwork', abbr: 'FA' },
  { match: /^teal original art$/i, id: 'teal', name: 'Teal Original Art', abbr: 'TL' },
  { match: /^version (\d+)$/i, id: 'v$1', name: 'Version $1', abbr: 'V$1' },
  { match: /^([a-e])$/i, id: 'art-$1', name: 'Artwork $1', abbr: '$1', letter: true },
  { match: /^(\d+)(st|nd|rd|th) art$/i, id: 'art-$1', name: '$1$2 Art', abbr: 'A$1' },
  { match: /^hero art$/i, id: 'hero', name: 'HERO Art', abbr: 'HA' },
  { match: /^arkana$/i, id: 'arkana', name: 'Arkana Art', abbr: 'AK' },
  { match: /^japanese artwork$/i, id: 'jp-art', name: 'Japanese Artwork', abbr: 'JA' },
  { match: /^new art(work)?$/i, id: 'new-art', name: 'New Artwork', abbr: 'NA' },
  { match: /^reprint artwork$/i, id: 'reprint-art', name: 'Reprint Artwork', abbr: 'RA' },
  { match: /^purple alternate art$/i, id: 'purple-alt', name: 'Purple Alternate Art', abbr: 'PAA' },
  { match: /^red alternate art$/i, id: 'red-alt', name: 'Red Alternate Art', abbr: 'RAA' },
  { match: /^alternate art$/i, id: 'alt', name: 'Alternate Art', abbr: 'AA' },
  { match: /^extended art$/i, id: 'ea', name: 'Extended Art', abbr: 'EA' },
  { match: /^emblazoned$/i, id: 'emb', name: 'Emblazoned', abbr: 'EM' },
  { match: /^blue( - dl\d+)?$/i, id: 'blue', name: 'Blue', abbr: 'BL' },
  { match: /^green( - dl\d+)?$/i, id: 'green', name: 'Green', abbr: 'GN' },
  { match: /^purple( - dl\d+)?$/i, id: 'purple', name: 'Purple', abbr: 'PU' },
  { match: /^red( - dl\d+)?$/i, id: 'red', name: 'Red', abbr: 'RD' },
  { match: /^yellow$/i, id: 'yellow', name: 'Yellow', abbr: 'YL' },
  { match: /^silver$/i, id: 'silver', name: 'Silver', abbr: 'SV' },
  { match: /^bronze$/i, id: 'bronze', name: 'Bronze', abbr: 'BZ' },
  { match: /^black$/i, id: 'black', name: 'Black', abbr: 'BK' },
  { match: /^white$/i, id: 'white', name: 'White', abbr: 'WH' },
];

export const SKIP_TAGS = [/stamp$/i, /misprint$/i, /^oversized$/i, /^sample promo$/i];

export const RARITY_FIX = {
  'The Lost Art Promotion (series)': { Common: 'UR' },
};

export const TCG_IGNORE = new Set([
  '5DS1-EN041|C',
  '5DS1-EN042|C',
  '5DS1-EN043|C',
]);

export const TCG_CARD = {
  'DUAD-EN068': 'Layer 19: "Preventing the Invasion! The Pitch-Black Super Quantum!!"',
};

export const ART = {};
