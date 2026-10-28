export const id = 'lorcana';
export const name = 'Disney Lorcana TCG';
export const shortName = 'Lorcana';
export const tagline = 'Trading Card Game';
export const CARD_ASPECT = 63 / 88;
export const SCAN_SEARCH = 'Card name or number, e.g. Stitch or 21/204';
export const SERIES_NOUN = 'year';
export const VARIANT_NOUN = ['foil', 'foils'];
export const CARD_TYPE_LABEL = 'Ink';
export const OFFLINE_IMAGES = false;

export const familyOf = (setId) => setId;

export const KIND_GROUPS = [
  ['expansion', 'Booster sets'],
  ['quest', 'Illumineer’s Quest'],
  ['promo', 'Promos'],
];

export const RARITIES = [
  { id: 'C', name: 'Common', icon: 'l-common', rank: 10, aliases: ['common'] },
  { id: 'U', name: 'Uncommon', icon: 'l-uncommon', rank: 15, aliases: ['uncommon'] },
  { id: 'R', name: 'Rare', icon: 'l-rare', rank: 20, aliases: ['rare'] },
  { id: 'SR', name: 'Super Rare', icon: 'l-super', rank: 30, aliases: ['super rare', 'super_rare'] },
  { id: 'L', name: 'Legendary', icon: 'l-legendary', rank: 40, aliases: ['legendary'] },
  { id: 'S', name: 'Special', icon: 'l-special', rank: 45, filter: false, aliases: ['special'] },
  { id: 'P', name: 'Promo', icon: 'l-promo', rank: 50, foil: true, filter: false, last: 1, aliases: ['promo'] },
  { id: 'EP', name: 'Epic', icon: 'l-epic', rank: 60, foil: true, aliases: ['epic'] },
  { id: 'EN', name: 'Enchanted', icon: 'l-enchanted', rank: 70, foil: true, aliases: ['enchanted'] },
  { id: 'IC', name: 'Iconic', icon: 'l-iconic', rank: 80, foil: true, aliases: ['iconic'] },
];

export const CARD_TYPES = {
  amber: { name: 'Amber' },
  amethyst: { name: 'Amethyst' },
  emerald: { name: 'Emerald' },
  ruby: { name: 'Ruby' },
  sapphire: { name: 'Sapphire' },
  steel: { name: 'Steel' },
  dual: { name: 'Dual ink' },
};

export const DISPLAY = {
  number: 'No. {printed}',
  label: '{num}',
  list: '{num} {name}',
  chip: '{num} {name}',
  pocket: '{num}',
  search: 'Lorcana {set} {name} {printed}',
};

const RARITY_BY_ALIAS = new Map(RARITIES.flatMap((r) => (r.aliases || []).map((a) => [a, r.id])));

export const rarityFromName = (text) => RARITY_BY_ALIAS.get(String(text || '').trim().toLowerCase()) || null;

export function statsText(card) {
  const s = card.stats;
  if (!s) return '';
  const parts = [s.i, s.t];
  if (s.c != null) parts.push(`Cost ${s.c}${s.k ? ', inkable' : ''}`);
  if (s.s != null) parts.push(`Strength ${s.s}`);
  if (s.w != null) parts.push(`Willpower ${s.w}`);
  if (s.l != null) parts.push(`Lore ${s.l}`);
  if (s.m != null) parts.push(`Move cost ${s.m}`);
  return parts.filter(Boolean).join(' · ');
}

export function priceLinks(card, entry, query) {
  const q = encodeURIComponent(query);
  return [
    { label: 'TCGplayer', href: entry?.tcg ? `https://www.tcgplayer.com/product/${entry.tcg}` : `https://www.tcgplayer.com/search/lorcana-tcg/product?q=${q}` },
    { label: 'eBay UK sold', href: `https://www.ebay.co.uk/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1` },
    { label: 'BR Trading Post', href: `https://brtradingpost.co.uk/shop/lorcana/?q=${encodeURIComponent(card.name)}` },
  ];
}

export const disclaimer = 'Binder Tracker uses trademarks and/or copyrights associated with Disney Lorcana TCG, used under Ravensburger’s Community Code Policy. We are expressly prohibited from charging you to use or access this content. Binder Tracker is not published, endorsed, or specifically approved by Disney or Ravensburger. Disney Lorcana and all card images © Disney. Lorcana card data comes from LorcanaJSON and card images from Lorcast.';
