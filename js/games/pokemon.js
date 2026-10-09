export const id = 'pokemon';
export const name = 'Pokémon TCG';

export const RARITIES = [
  { id: 'E', name: 'Basic Energy', short: 'Energy', icon: 'e-lightning', rank: 0, typed: true, filter: false, last: 2 },
  { id: 'NR', name: 'No Rarity', short: 'None', icon: 'r-common', rank: 5, aliases: ['none', 'unconfirmed'] },
  { id: 'C', name: 'Common', icon: 'r-common', rank: 10, aliases: ['common'] },
  { id: 'U', name: 'Uncommon', icon: 'r-uncommon', rank: 15, aliases: ['uncommon'] },
  { id: 'R', name: 'Rare', icon: 'r-rare', rank: 20, aliases: ['rare'] },
  { id: 'RH', name: 'Rare Holo', icon: 'r-rare', rank: 22, foil: true, aliases: ['rare holo', 'holo rare'] },
  { id: 'RR', name: 'Double Rare', icon: 'r-double', rank: 30, wide: true, foil: true, aliases: ['double rare'] },
  { id: 'V', name: 'Rare Holo V', short: 'V', icon: 'r-double', rank: 31, wide: true, foil: true, aliases: ['holo rare v', 'rare holo v'] },
  { id: 'VMAX', name: 'Rare Holo VMAX', short: 'VMAX', icon: 'r-double', rank: 32, wide: true, foil: true, aliases: ['holo rare vmax', 'rare holo vmax'] },
  { id: 'VSTAR', name: 'Rare Holo VSTAR', short: 'VSTAR', icon: 'r-double', rank: 33, wide: true, foil: true, aliases: ['holo rare vstar', 'rare holo vstar'] },
  { id: 'ACE', name: 'ACE SPEC Rare', icon: 'r-ace', rank: 35, foil: true, aliases: ['ace spec rare', 'rare ace'] },
  { id: 'PR', name: 'Pikachu Rare', icon: 'r-pikachu', rank: 40, foil: true, aliases: ['pikachu rare'] },
  { id: 'AMR', name: 'Amazing Rare', icon: 'r-ir', rank: 42, foil: true, aliases: ['amazing rare'] },
  { id: 'RAD', name: 'Radiant Rare', icon: 'r-shiny', rank: 43, foil: true, aliases: ['radiant rare'] },
  { id: 'UR', name: 'Ultra Rare', icon: 'r-ultra', rank: 45, wide: true, foil: true, aliases: ['ultra rare'] },
  { id: 'LVX', name: 'Rare Holo LV.X', short: 'LV.X', icon: 'r-ultra', rank: 46, wide: true, foil: true, aliases: ['rare holo lv.x'] },
  { id: 'PRIME', name: 'Rare Prime', short: 'Prime', icon: 'r-ultra', rank: 47, wide: true, foil: true, aliases: ['rare prime'] },
  { id: 'LEGEND', name: 'LEGEND', icon: 'r-ultra', rank: 48, wide: true, foil: true, aliases: ['legend', 'rare holo legend'] },
  { id: 'FAT', name: 'Full Art Trainer', icon: 'r-ultra', rank: 49, foil: true, aliases: ['full art trainer'] },
  { id: 'BREAK', name: 'BREAK Rare', short: 'BREAK', icon: 'r-ultra', rank: 49.5, wide: true, foil: true, aliases: ['rare break'] },
  { id: 'PRISM', name: 'Prism Star Rare', short: 'Prism Star', icon: 'r-ultra', rank: 49.7, foil: true, aliases: ['prism rare', 'rare prism star'] },
  { id: 'P', name: 'Promo', icon: 'r-promo', rank: 50, foil: true, filter: false, last: 1, aliases: ['promo'] },
  { id: 'CC', name: 'Classic Collection', icon: 'r-classic', rank: 60, wide: true, foil: true, filter: false, aliases: ['classic collection'] },
  { id: 'IR', name: 'Illustration Rare', icon: 'r-ir', rank: 70, foil: true, aliases: ['illustration rare'] },
  { id: 'SR', name: 'Shiny Rare', icon: 'r-shiny', rank: 72, foil: true, aliases: ['shiny rare', 'shiny holo rare'] },
  { id: 'SUR', name: 'Shiny Ultra Rare', icon: 'r-shiny-ultra', rank: 74, wide: true, foil: true, aliases: ['shiny ultra rare'] },
  { id: 'SRV', name: 'Shiny Rare V', icon: 'r-shiny-ultra', rank: 75, wide: true, foil: true, aliases: ['shiny rare v'] },
  { id: 'SRVM', name: 'Shiny Rare VMAX', icon: 'r-shiny-ultra', rank: 75.5, wide: true, foil: true, aliases: ['shiny rare vmax'] },
  { id: 'MAR', name: 'Mega Attack Rare', icon: 'r-mar', rank: 76, foil: true, aliases: ['mega attack rare'] },
  { id: 'SIR', name: 'Special Illustration Rare', icon: 'r-sir', rank: 80, wide: true, foil: true, aliases: ['special illustration rare'] },
  { id: 'FR', name: 'Futuristic Rare', icon: 'r-fr', rank: 86, foil: true, aliases: ['futuristic rare'] },
  { id: 'SEC', name: 'Secret Rare', icon: 'r-hyper', rank: 88, wide: true, foil: true, aliases: ['secret rare', 'rare secret', 'rainbow rare'] },
  { id: 'HR', name: 'Hyper Rare', icon: 'r-hyper', rank: 90, wide: true, foil: true, aliases: ['hyper rare'] },
  { id: 'BWR', name: 'Black White Rare', icon: 'r-bwr', rank: 92, wide: true, foil: true, aliases: ['black white rare'] },
  { id: 'MHR', name: 'Mega Hyper Rare', icon: 'r-mhr', rank: 96, wide: true, foil: true, aliases: ['mega hyper rare'] },
  { id: 'RGB', name: 'RGB Rare', icon: 'r-rgb', rank: 100, wide: true, foil: true, aliases: ['rgb rare'] },
];

export const ENERGY_TYPES = {
  grass: { name: 'Grass' },
  fire: { name: 'Fire' },
  water: { name: 'Water' },
  lightning: { name: 'Lightning' },
  psychic: { name: 'Psychic' },
  fighting: { name: 'Fighting' },
  darkness: { name: 'Darkness' },
  metal: { name: 'Metal' },
};

export const DISPLAY = {
  number: 'No. {printed}',
  label: '{num}',
  list: '{num} {name}',
  chip: '{num} {name}',
  pocket: '{num}',
  search: 'Pokemon {set} {name} {printed}',
};

const RARITY_BY_ALIAS = new Map(RARITIES.flatMap((r) => (r.aliases || []).map((a) => [a, r.id])));

export const rarityFromName = (text) => RARITY_BY_ALIAS.get(String(text || '').trim().toLowerCase()) || null;

export function priceLinks(card, entry, query) {
  const q = encodeURIComponent(query);
  return [
    { label: 'TCGplayer', href: entry ? `https://www.tcgplayer.com/product/${entry.tcg}` : `https://www.tcgplayer.com/search/pokemon/product?q=${q}` },
    { label: 'eBay UK sold', href: `https://www.ebay.co.uk/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1` },
  ];
}

export const disclaimer = 'Not affiliated with, endorsed, sponsored, or approved by Nintendo, Creatures Inc., GAME FREAK inc., or The Pokémon Company. Pokémon and all card images © Pokémon / Nintendo / Creatures Inc. / GAME FREAK inc.';
