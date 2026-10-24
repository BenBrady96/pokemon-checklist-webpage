export const id = 'yugioh';
export const name = 'Yu-Gi-Oh! TCG';
export const shortName = 'Yu-Gi-Oh!';
export const tagline = 'Trading Card Game';
export const CARD_ASPECT = 59 / 86;
export const SCAN_SEARCH = 'Card name or set code, e.g. Dark Magician or LOB-005';
export const VERSION_BY_RARITY = true;
export const VARIANT_NOUN = ['other rarity', 'other rarities'];
export const SERIES_NOUN = 'era';

export const familyOf = (setId) => setId;

export const KIND_GROUPS = [
  ['expansion', 'Booster sets'],
  ['set', 'Special & reprint sets'],
  ['deck', 'Decks'],
  ['pack', 'Packs'],
  ['tin', 'Tins'],
  ['promo', 'Promos'],
];

export const RARITIES = [
  { id: 'C', name: 'Common', abbr: 'C', tone: 'base', rank: 10, aliases: ['common'] },
  { id: 'SP', name: 'Short Print', abbr: 'SP', tone: 'base', rank: 11, aliases: ['short print'] },
  { id: 'SSP', name: 'Super Short Print', abbr: 'SSP', tone: 'base', rank: 12, aliases: ['super short print'] },
  { id: 'R', name: 'Rare', abbr: 'R', tone: 'silver', rank: 20, aliases: ['rare'] },
  { id: 'SR', name: 'Super Rare', abbr: 'SR', tone: 'blue', rank: 30, foil: true, aliases: ['super rare'] },
  { id: 'SFR', name: 'Starfoil Rare', abbr: 'SFR', tone: 'blue', rank: 31, foil: true, aliases: ['starfoil rare', 'starfoil'] },
  { id: 'SHR', name: 'Shatterfoil Rare', abbr: 'SHR', tone: 'blue', rank: 32, foil: true, aliases: ['shatterfoil rare', 'shatterfoil'] },
  { id: 'MSR', name: 'Mosaic Rare', abbr: 'MSR', tone: 'blue', rank: 33, foil: true, aliases: ['mosaic rare'] },
  { id: 'NPR', name: 'Normal Parallel Rare', abbr: 'NPR', tone: 'blue', rank: 34, foil: true, aliases: ['normal parallel rare', 'parallel rare'] },
  { id: 'DNPR', name: 'Duel Terminal Normal Parallel Rare', abbr: 'DNPR', tone: 'blue', rank: 35, foil: true, aliases: ['duel terminal normal parallel rare'] },
  { id: 'DNRPR', name: 'Duel Terminal Normal Rare Parallel Rare', abbr: 'DNRPR', tone: 'blue', rank: 36, foil: true, aliases: ['duel terminal normal rare parallel rare'] },
  { id: 'DRPR', name: 'Duel Terminal Rare Parallel Rare', abbr: 'DRPR', tone: 'blue', rank: 37, foil: true, aliases: ['duel terminal rare parallel rare'] },
  { id: 'SPR', name: 'Super Parallel Rare', abbr: 'SPR', tone: 'blue', rank: 38, foil: true, aliases: ['super parallel rare'] },
  { id: 'DSPR', name: 'Duel Terminal Super Parallel Rare', abbr: 'DSPR', tone: 'blue', rank: 39, foil: true, aliases: ['duel terminal super parallel rare'] },
  { id: 'UR', name: 'Ultra Rare', abbr: 'UR', tone: 'gold', rank: 40, foil: true, aliases: ['ultra rare'] },
  { id: 'URPR', name: 'Ultra Rare (Pharaoh’s Rare)', abbr: 'URPR', tone: 'gold', rank: 41, foil: true, aliases: ["ultra rare (pharaoh's rare)", 'ultra rare (pharaoh’s rare)', "pharaoh's rare"] },
  { id: 'UPR', name: 'Ultra Parallel Rare', abbr: 'UPR', tone: 'gold', rank: 42, foil: true, aliases: ['ultra parallel rare'] },
  { id: 'DUPR', name: 'Duel Terminal Ultra Parallel Rare', abbr: 'DUPR', tone: 'gold', rank: 43, foil: true, aliases: ['duel terminal ultra parallel rare'] },
  { id: 'GUR', name: 'Gold Rare', abbr: 'GUR', tone: 'gold', rank: 44, foil: true, aliases: ['gold rare', 'gold ultra rare'] },
  { id: 'PG', name: 'Premium Gold Rare', abbr: 'PG', tone: 'gold', rank: 45, foil: true, aliases: ['premium gold rare'] },
  { id: 'PlR', name: 'Platinum Rare', abbr: 'PlR', tone: 'gold', rank: 46, foil: true, aliases: ['platinum rare', 'pir'] },
  { id: 'UtR', name: 'Ultimate Rare', abbr: 'UtR', tone: 'gold', rank: 50, foil: true, aliases: ['ultimate rare'] },
  { id: 'ScR', name: 'Secret Rare', abbr: 'ScR', tone: 'rainbow', rank: 60, foil: true, aliases: ['secret rare'] },
  { id: 'PScR', name: 'Prismatic Secret Rare', abbr: 'PScR', tone: 'rainbow', rank: 61, foil: true, aliases: ['prismatic secret rare'] },
  { id: 'GScR', name: 'Gold Secret Rare', abbr: 'GScR', tone: 'rainbow', rank: 62, foil: true, aliases: ['gold secret rare'] },
  { id: 'PlScR', name: 'Platinum Secret Rare', abbr: 'PlScR', tone: 'rainbow', rank: 63, foil: true, aliases: ['platinum secret rare', 'ps'] },
  { id: 'EScR', name: 'Extra Secret Rare', abbr: 'EScR', tone: 'rainbow', rank: 64, foil: true, aliases: ['extra secret rare', 'extra secret'] },
  { id: 'UScR', name: 'Ultra Secret Rare', abbr: 'UScR', tone: 'rainbow', rank: 65, foil: true, aliases: ['ultra secret rare'] },
  { id: 'QCSR', name: 'Quarter Century Secret Rare', abbr: 'QCSR', tone: 'rainbow', rank: 70, foil: true, aliases: ['quarter century secret rare'] },
  { id: 'CR', name: 'Collector’s Rare', abbr: 'CR', tone: 'rainbow', rank: 72, foil: true, aliases: ["collector's rare", 'collector’s rare', 'collectors rare'] },
  { id: 'StR', name: 'Starlight Rare', abbr: 'StR', tone: 'rainbow', rank: 74, foil: true, aliases: ['starlight rare'] },
  { id: 'GMR', name: 'Grand Master Rare', abbr: 'GMR', tone: 'rainbow', rank: 75, foil: true, aliases: ['grand master rare'] },
  { id: 'GR', name: 'Ghost Rare', abbr: 'GR', tone: 'rainbow', rank: 76, foil: true, aliases: ['ghost rare'] },
  { id: 'GGR', name: 'Ghost/Gold Rare', abbr: 'GGR', tone: 'rainbow', rank: 77, foil: true, aliases: ['ghost/gold rare', 'ghost gold rare'] },
  { id: '10000ScR', name: '10000 Secret Rare', abbr: '10000', tone: 'rainbow', rank: 80, foil: true, aliases: ['10000 secret rare'] },
];

export const CARD_TYPES = {
  monster: { name: 'Monsters' },
  spell: { name: 'Spells' },
  trap: { name: 'Traps' },
  skill: { name: 'Skills' },
  token: { name: 'Tokens' },
};

export const EDITIONS = [
  { id: '1st', name: '1st Edition', sub: '1st Edition' },
  { id: 'unl', name: 'Unlimited', sub: 'Unlimited' },
  { id: 'lim', name: 'Limited', sub: 'Limited' },
];

export const DISPLAY = {
  number: '{printed}',
  label: '{printed}',
  list: '{printed} {name}',
  chip: '{printed} {name}',
  pocket: '{num}',
  search: 'Yu-Gi-Oh {name} {printed}',
};

const RARITY_BY_ALIAS = new Map(RARITIES.flatMap((r) => [r.id.toLowerCase(), r.abbr.toLowerCase(), ...(r.aliases || [])].map((a) => [a, r.id])));

export const rarityFromName = (text) => RARITY_BY_ALIAS.get(String(text || '').trim().toLowerCase().replace(/^\((.*)\)$/, '$1')) || null;

const atkText = (n) => (n < 0 ? '?' : String(n));

export function statsText(card) {
  const s = card.stats;
  if (!s) return '';
  const parts = [s.a, s.l, s.t];
  if (s.atk != null) parts.push(s.def != null ? `ATK ${atkText(s.atk)} / DEF ${atkText(s.def)}` : `ATK ${atkText(s.atk)}`);
  return parts.filter(Boolean).join(' · ');
}

export function priceLinks(card, entry, query) {
  const q = encodeURIComponent(query);
  return [
    { label: 'TCGplayer', href: entry?.tcg ? `https://www.tcgplayer.com/product/${entry.tcg}` : `https://www.tcgplayer.com/search/yugioh/product?q=${q}` },
    { label: 'eBay UK sold', href: `https://www.ebay.co.uk/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1` },
    { label: 'BR Trading Post', href: `https://brtradingpost.co.uk/shop/yu-gi-oh/?q=${encodeURIComponent(card.name)}` },
  ];
}

export const disclaimer = 'Not affiliated with, endorsed, sponsored, or approved by Konami Digital Entertainment, Studio Dice or Shueisha. Yu-Gi-Oh! and all card images © Studio Dice/SHUEISHA, TV TOKYO, KONAMI. Yu-Gi-Oh! card data and images come from YGOPRODeck.';
