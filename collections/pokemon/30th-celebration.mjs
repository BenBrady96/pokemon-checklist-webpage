const PRINTED_TOTAL = 128;

const MAIN_NAMES = [
  'Exeggcute', 'Alolan Exeggutor', 'Volbeat', 'Illumise', 'Tropius',
  'Cherubi', 'Cherrim', 'Vivillon', 'Vulpix', 'Ninetales',
  'Moltres', 'Ho-Oh', 'Victini', 'Reshiram', 'Fuecoco ex',
  'Slowpoke', 'Lapras', 'Articuno', 'Kyogre', 'Palkia',
  'Greninja ex', 'Wishiwashi',
  ...Array(30).fill('Pikachu'),
  'Pikachu ex', 'Pikachu ex', 'Zapdos', 'Zekrom', 'Zeraora',
  'Toxel', 'Toxtricity', 'Toxtricity', 'Morpeko', 'Miraidon',
  'Mewtwo', 'Mewtwo ex', 'Mew', 'Mew ex', 'Marill',
  'Azumarill', 'Espeon', 'Espeon ex', 'Sylveon ex', 'Unown',
  'Drifloon', 'Cresselia', 'Chandelure', 'Xerneas', 'Comfey',
  'Cosmog', 'Cosmoem', 'Lunala', 'Gimmighoul', 'Groudon',
  'Lucario', 'Seismitoad', 'Lycanroc', 'Koraidon', 'Nidoran♀',
  'Nidorina', 'Alolan Meowth', 'Gengar ex', 'Umbreon', 'Umbreon ex',
  'Murkrow', 'Scraggy', 'Zorua', 'Zoroark', 'Deino',
  'Zweilous', 'Hydreigon', 'Yveltal', 'Galarian Meowth', 'Jirachi ex',
  'Dialga', 'Ferrothorn', 'Solgaleo', 'Zacian', 'Zamazenta',
  'Gholdengo', 'Salamence ex', 'Jangmo-o', 'Hakamo-o', 'Kommo-o',
  'Meowth', 'Kangaskhan', 'Ditto', 'Eevee', 'Eevee',
  'Eevee', 'Snorlax', 'Igglybuff', 'Lugia', 'Hisuian Zorua',
  'Hisuian Zoroark', 'Minior', 'Maushold', 'Poké Pad', 'Switch',
  'Ultra Ball',
  'Alolan Exeggutor', 'Moltres', 'Lapras', 'Articuno', 'Zapdos',
  'Toxtricity', 'Morpeko', 'Drifloon', 'Chandelure', 'Lycanroc',
  'Alolan Meowth', 'Scraggy', 'Galarian Meowth', 'Gholdengo', 'Kommo-o',
  'Meowth', 'Hisuian Zorua', 'Maushold',
  'Fuecoco ex', 'Greninja ex', 'Pikachu ex', 'Pikachu ex', 'Mewtwo ex',
  'Mew ex', 'Sylveon ex', 'Gengar ex', 'Jirachi ex', 'Salamence ex',
  'Mewtwo ex', 'Mew ex',
];

const RARE = new Set([12, 14, 19, 20, 56, 62, 63, 65, 76, 80, 82, 86, 100, 103, 105, 106, 107, 121]);
const DOUBLE_RARE = new Set([15, 21, 53, 54, 64, 66, 70, 71, 90, 92, 102, 109]);

function mainRarity(n) {
  if (n >= 23 && n <= 52) return 'PR';
  if (n >= 157) return 'FR';
  if (n >= 147) return 'SIR';
  if (n >= 129) return 'IR';
  if (DOUBLE_RARE.has(n)) return 'RR';
  if (RARE.has(n)) return 'R';
  return 'C';
}

const CLASSIC = [
  ['58', 'Pikachu'], ['4', 'Charizard'], ['18', 'Misty'], ['69', 'Erika’s Jigglypuff'],
  ['25', 'Sneasel'], ['106', 'Shining Celebi'], ['149', 'Lugia'], ['5', 'Delcatty'],
  ['19', 'Dark Tyranitar'], ['108', 'Scizor ex'], ['11', 'Metagross δ'], ['106', 'Palkia LV.X'],
  ['43', 'Uxie'], ['47', 'Crobat G'], ['94', 'Gengar'], ['99', 'Darkrai & Cresselia LEGEND'],
  ['100', 'Darkrai & Cresselia LEGEND'], ['101', 'N'], ['85', 'Rayquaza-EX'], ['11', 'Genesect-EX'],
  ['106', 'M Gardevoir-EX'], ['41', 'Greninja BREAK'], ['89', 'Solgaleo-GX'], ['57', 'Buzzwole-GX'],
  ['33', 'Pikachu & Zekrom-GX'], ['138', 'Zacian V'], ['50', 'Raikou'], ['114', 'Mew VMAX'],
  ['123', 'Arceus VSTAR'], ['203', 'Magikarp'],
];

const ENERGY_TYPES = ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal'];

const RGB_MEWS = [['r', 'Red'], ['g', 'Green'], ['b', 'Blue']];

const PROMOS = [
  [94, 'Alolan Exeggutor', 'Tech Sticker Collection'],
  [95, 'Lucario', 'Tech Sticker Collection'],
  [96, 'Moltres', 'Poster Collection'],
  [97, 'Articuno', 'Poster Collection'],
  [98, 'Zapdos', 'Poster Collection'],
  [99, 'Greninja ex', 'Pokémon ex Box · Greninja ex Tin'],
  [100, 'Sylveon ex', 'Pokémon ex Box · Sylveon ex Tin'],
  [101, 'Nidorina', 'Elite Trainer Box'],
  [102, 'Victini', 'Espeon ex Battle Deck · 30 Oct 2026'],
  [103, 'Zeraora', 'Umbreon ex Battle Deck · 30 Oct 2026'],
  [104, 'Mewtwo', 'Mewtwo Figure Collection · 6 Nov 2026'],
  [105, 'Mew', 'Mew Figure Collection · 6 Nov 2026'],
  [106, 'Ditto', 'Ditto Premium Collection · 6 Nov 2026'],
  [107, 'Pikachu ex', 'Ultra-Premium Collection (Day) · 6 Nov 2026'],
  [108, 'Espeon ex', 'Ultra-Premium Collection (Day) · 6 Nov 2026'],
  [109, 'Pikachu ex', 'Ultra-Premium Collection (Night) · 6 Nov 2026'],
  [110, 'Umbreon ex', 'Ultra-Premium Collection (Night) · 6 Nov 2026'],
];

const FIRST_PARTNERS = [
  ['30 Mar 2026', ['Bulbasaur', 'Charmander', 'Squirtle', 'Turtwig', 'Chimchar', 'Piplup', 'Rowlet', 'Litten', 'Popplio']],
  ['19 Jun 2026', ['Chikorita', 'Cyndaquil', 'Totodile', 'Snivy', 'Tepig', 'Oshawott', 'Grookey', 'Scorbunny', 'Sobble']],
  ['7 Aug 2026', ['Treecko', 'Torchic', 'Mudkip', 'Chespin', 'Fennekin', 'Froakie', 'Sprigatito', 'Fuecoco', 'Quaxly']],
];

const VARIANTS = [
  ['m063', 'Mewtwo (Stamped)', 'Stamped', 'What’s Your Favorite? stamp · retailer gift with purchase from 2 Oct 2026'],
  ['m116', 'Eevee (Cosmos Holo)', 'Cosmos Holo', 'Knock Out Collection · 2-Pack Blister'],
  ['p101', 'Nidorina (Pokémon Center)', 'PC Stamp', 'Pokémon Center stamp · Pokémon Center Elite Trainer Box'],
];

const BASE_CARDS = [
  ...MAIN_NAMES.map((name, i) => {
    const n = i + 1;
    const num = String(n).padStart(3, '0');
    return { id: `m${num}`, section: n <= PRINTED_TOTAL ? 'main' : 'secret', num, printed: `${num}/${PRINTED_TOTAL}`, code: String(n), name, rarity: mainRarity(n) };
  }),
  ...CLASSIC.map(([num, name], i) => ({
    id: `c${String(i + 1).padStart(2, '0')}`, section: 'classic', num, printed: num, code: `C${i + 1}`, name, rarity: 'CC',
  })),
  ...ENERGY_TYPES.map((type, i) => {
    const num = String(9 + i).padStart(3, '0');
    return { id: `e${num}`, section: 'energy', num, printed: num, code: `E${9 + i}`, name: `Basic ${type} Energy`, rarity: 'E', type: type.toLowerCase() };
  }),
  ...RGB_MEWS.map(([letter, colour]) => {
    const num = `${letter.toUpperCase()}/RGB`;
    return { id: `rgb-${letter}`, section: 'secret', num, printed: num, code: num, name: 'Mew', rarity: 'RGB', keywords: colour };
  }),
  ...PROMOS.map(([n, name, note]) => {
    const num = String(n).padStart(3, '0');
    return { id: `p${num}`, section: 'promo', num, printed: `MEP ${num}`, code: `P${n}`, name, rarity: 'P', note };
  }),
];

const BASE_BY_ID = new Map(BASE_CARDS.map((c) => [c.id, c]));

const CARDS = [
  ...BASE_CARDS,
  ...VARIANTS.map(([baseId, name, badge, note], i) => {
    const base = BASE_BY_ID.get(baseId);
    const card = {
      id: `v${String(i + 1).padStart(2, '0')}`, section: 'variant', num: base.num, printed: base.printed, code: `V${i + 1}`,
      name, rarity: base.rarity, base: baseId, badge, note,
    };
    if (base.rarity === 'P') card.display = { number: '{printed}' };
    return card;
  }),
  ...FIRST_PARTNERS.flatMap(([released, names], s) => names.map((name, i) => {
    const n = 37 + s * 9 + i;
    const num = String(n).padStart(3, '0');
    return {
      id: `p${num}`, section: 'partner', num, printed: `MEP ${num}`, code: `P${n}`, name, rarity: 'P',
      note: `First Partner Illustration Collection · Series ${s + 1} · ${released}`,
    };
  })),
].map((card, idx) => ({ ...card, idx }));

const PROMO_DISPLAY = { number: '{printed}', label: '{printed}', list: '{printed} {name}', chip: '{code} {name}', search: 'Pokemon {name} {printed} promo' };

export default {
  id: 'pokemon/30th-celebration',
  game: 'pokemon',
  slug: '30th-celebration',
  name: '30th Celebration',
  series: 'Mega Evolution',
  kind: 'expansion',
  code: '30C',
  syncKey: '30C',
  released: '2026-09-16',
  printedTotal: PRINTED_TOTAL,
  defaultTier: 'master',
  cover: { symbol: 'emblem-30' },
  sections: [
    { id: 'main', name: 'Main Set', range: '001–128', tier: 'standard' },
    { id: 'secret', name: 'Secret Rares', range: '129–158 + RGB', tier: 'complete' },
    {
      id: 'classic', name: 'Classic Collection', range: '30 reprints', tier: 'complete',
      display: { number: 'Classic Collection · No. {num}', label: 'Classic Collection {num}', list: '{name} ({num})', chip: '{code} {name}', pocket: '{code}', search: 'Pokemon 30th Celebration Classic Collection {name}' },
    },
    { id: 'energy', name: 'Basic Energy', range: '009–016', tier: 'complete', display: { number: 'No. {num}' } },
    { id: 'promo', name: 'Black Star Promos', range: 'MEP 094–110', tier: 'grand', display: PROMO_DISPLAY },
    {
      id: 'variant', name: 'Variants', range: 'stamped & alternate prints', tier: 'grand',
      display: { label: '{printed}', list: '{printed} {name}', chip: '{code} {name}', pocket: '{code}', search: 'Pokemon {baseName} {basePrinted} {badge}' },
    },
    { id: 'partner', name: 'First Partner Promos', range: 'MEP 037–063', tier: 'grand', display: PROMO_DISPLAY },
  ],
  groups: [
    { id: 'main', name: 'Main Set', match: { section: 'main' } },
    { id: 'pikachu', name: 'Pikachu Rares', match: { rarity: 'PR' }, stat: true },
    { id: 'secret', name: 'Secret Rares', match: { section: 'secret' } },
    { id: 'classic', name: 'Classic Collection', match: { section: 'classic' } },
    { id: 'energy', name: 'Basic Energy', match: { section: 'energy' } },
    { id: 'promo', name: 'Black Star Promos', match: { section: 'promo' } },
    { id: 'variant', name: 'Variants', match: { section: 'variant' } },
    { id: 'partner', name: 'First Partner Promos', match: { section: 'partner' } },
  ],
  jumps: [
    { id: 'main', label: 'Main Set' },
    { id: 'pikachu', label: 'Pikachu Rares', icon: 'r-pikachu', section: 'main', from: 'm023', to: 'm052' },
    { id: 'secret', label: 'Secret Rares' },
    { id: 'classic', label: 'Classic' },
    { id: 'energy', label: 'Energy' },
    { id: 'promo', label: 'Promos' },
    { id: 'variant', label: 'Variants' },
    { id: 'partner', label: 'First Partners' },
  ],
  summary: [['main', 'Main set'], ['secret', 'Secret rares'], ['promo', 'Promos'], ['partner', 'First Partners']],
  searchAliases: {
    'Nidoran♀': 'female',
    'Metagross δ': 'delta',
    'Palkia LV.X': 'lvx level',
    'Crobat G': 'galactic',
  },
  quickAdd: {
    placeholder: 'e.g. 1-22, 55, 129x2, C1-C5, E9, RGB, P94',
    example: '1-22, 55x2, C3, E9, RGB, P94',
    hint: 'Separate with commas or spaces. <b>1-22</b> is a range, <b>55x2</b> is two copies, <b>C1–C30</b> are Classic Collection cards in checklist order, and <b>E9–E16</b> are the Basic Energy cards. <b>RGB</b> adds all three RGB Mews (or one with <b>R/RGB</b>, <b>G/RGB</b>, <b>B/RGB</b>), <b>P37–P63</b> and <b>P94–P110</b> are the Black Star promos and <b>V1–V3</b> the variants.',
    empty: 'Main set cards are 1–158 (secret rares start at 129).',
    aliases: {
      RGB: ['rgb-r', 'rgb-g', 'rgb-b'],
      '/RGB': ['rgb-r', 'rgb-g', 'rgb-b'],
      RRGB: ['rgb-r'],
      'R/RGB': ['rgb-r'],
      GRGB: ['rgb-g'],
      'G/RGB': ['rgb-g'],
      BRGB: ['rgb-b'],
      'B/RGB': ['rgb-b'],
    },
  },
  help: {
    tiers: '<b>Standard, Master or Grand Master:</b> pick what you’re collecting above the cards. Standard is the 128 main set cards, Master is all 199 cards, and Grand Master adds the Black Star promos, the First Partner promos and stamped or alternate prints. Cards you’ve marked are kept when you switch.',
  },
  info: {
    packSections: ['main', 'secret', 'classic', 'energy'],
    packText: '<p><b>30th Celebration booster packs.</b> Every pack has 6 foil cards: a Pikachu Rare, four more cards from the set and a Basic Energy.</p>',
    sectionText: {
      classic: [
        '<p><b>Classic Collection Packs</b>, which have 3 of the 30 cards each. There’s one in each Ultra-Premium Collection (Day and Night, 6 Nov 2026).</p>',
        '<p>They also turn up in about 1 in 10 regular 30th Celebration booster packs.</p>',
      ],
      partner: ['<p>Each collection has a promo pack with 3 of the series’ 9 cards at random, plus 2 booster packs.</p>'],
    },
    packProducts: [
      'Elite Trainer Box (9 packs)', 'Pokémon Center Elite Trainer Box (11)', 'Booster Bundle (6)',
      'Ultra-Premium Collections (29)', 'Ditto Premium Collection (8)', 'Figure Collections (5)', 'Pokémon ex Boxes (4)',
      'Tech Sticker Collections (3)', 'Poster Collection (3)', 'Mini Tins (2)', 'Knock Out Collection (2)', '2-Pack Blister (2)',
      'ex Tins', 'Binder Collection', 'single booster packs',
    ],
    pullOdds: { PR: 1, E: 1, R: 2.3, RR: 4.5, IR: 5.5, CC: 10, SIR: 19, FR: 90, RGB: 4000 },
    oddsText: {
      C: 'Commons make up most of each pack.',
      RGB: 'RGB Rares are extremely rare: roughly 1 in 4,000 packs, from the few found so far.',
    },
    details: {
      p099: 'The box also has an oversize Jumbo version of this card.',
      p100: 'The box also has an oversize Jumbo version of this card.',
      p101: 'The Pokémon Center Elite Trainer Box has this card as well as a Pokémon Center-stamped version.',
      p104: 'The collection also has an oversize Jumbo version of this card and a Mewtwo figure.',
      p105: 'The collection also has an oversize Jumbo version of this card and a Mew figure.',
      v01: 'Given away with Pokémon TCG purchases of $15 or more at participating shops in the US, Canada, Australia and New Zealand, while stocks last.',
      v02: 'The Cosmos Holo version only comes in these two products. The regular Eevee 116 is found in booster packs.',
      v03: 'Only in the Pokémon Center Elite Trainer Box, which also has the regular Nidorina promo.',
    },
  },
  seo: {
    title: 'Pokémon TCG 30th Celebration Checklist · All 199 Cards',
    description: 'Free checklist for the Pokémon TCG 30th Celebration set. Track all 199 cards, or go for the Grand Master set with every promo, with images, copy counts, binder pages and offline use. No sign-up needed.',
    ogTitle: 'Pokémon TCG 30th Celebration Checklist',
    ogDescription: 'Track all 199 cards in the Pokémon TCG 30th Celebration set, including secret rares, the RGB Mews, the Classic Collection and Basic Energy, plus every promo for a Grand Master set. Free, no sign-up, works offline.',
    twitterDescription: 'Track all 199 cards in the Pokémon TCG 30th Celebration set, plus every promo. Free, no sign-up, works offline.',
    imageAlt: '30th Celebration Card Checklist with Pikachu ex, Mew ex, Mewtwo ex and Charizard cards',
    appDescription: 'Track all 199 cards in the Pokémon TCG 30th Celebration set: the main set, secret rares, Classic Collection and Basic Energy, plus the promos for a Grand Master set.',
  },
  about: {
    title: 'About the 30th Celebration set',
    paragraphs: [
      'Pokémon TCG: 30th Celebration marks 30 years of Pokémon. The set has 199 cards: 128 main set cards, including 30 special Pikachu Rares; 33 secret rares (18 Illustration Rares, 10 Special Illustration Rares, 2 Futuristic Rares and the 3 ultra-rare RGB Mews); 30 Classic Collection reprints of iconic cards from the game’s history; and 8 Basic Energy cards.',
      'Choose what you’re collecting: the <b>Standard set</b> (the 128 main set cards), the <b>Master set</b> (all 199 cards) or the <b>Grand Master set</b> (246 cards: every card plus the 17 Black Star promos from 30th Celebration products, the 27 First Partner Illustration promos and 3 stamped or alternate prints).',
      'This free checklist lets you tick off the cards you own, count spare copies for trading, see your progress by rarity and plan your binder pages. It works on phones and computers, even offline, and your collection stays on your device.',
    ],
  },
  cards: CARDS,
};

const CDN = 'https://dz3we2x72f7ol.cloudfront.net/expansions/30th-celebration/en-us';
const SQUARESPACE = 'https://images.squarespace-cdn.com/content/682a3307f6bd950e4b98cbb9';
const ENERGY_SOURCES = {
  e009: `${SQUARESPACE}/fa7d420d-8558-496a-ab9e-a1d808973fe8/basic+grass+30+celebration.webp`,
  e010: `${SQUARESPACE}/7fdf551c-80bf-4aed-8bb0-9097b574b552/30th+celebration+fire.webp`,
  e011: `${SQUARESPACE}/e22378b6-1ec5-4d6c-8937-d3718a41ebae/water+30th+celebration.webp`,
  e012: `${SQUARESPACE}/632cd61c-3bf8-4fac-8802-8235fe6ab4c0/30th+electricty.webp`,
  e013: `${SQUARESPACE}/f95b4540-acce-436e-8fea-53faa731ae07/30th+psychic.webp`,
  e014: `${SQUARESPACE}/70ac9a79-6487-4466-914d-c4bf62de9a9f/30th+fighting.webp`,
  e015: `${SQUARESPACE}/63306109-6abd-43fe-8b3b-24445a8e324b/darkness+30th.webp`,
  e016: `${SQUARESPACE}/193aae09-4545-4671-86a4-9be37604e72c/30th+celebration.webp`,
};
const PROMO_CDN = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/MEP';
const POKECOTTAGE = 'https://pokecottagecdn.com/card-library/images/en/mep';
const POKECOTTAGE_SOURCES = {
  p102: `${POKECOTTAGE}/0d485cfb-2843-4aeb-9c13-b2092ae98b67.jpg`,
  p103: `${POKECOTTAGE}/42c63f17-8164-4151-b726-920265bab5a8.jpg`,
  p104: `${POKECOTTAGE}/e37a3264-a849-4e6e-a42f-632057aee303.jpg`,
  p105: `${POKECOTTAGE}/8bea4ddd-2b15-4668-aa9b-9dc3cc47a236.jpg`,
  p106: `${POKECOTTAGE}/5b98e2a6-9680-488a-9695-2e2a372a1b54.jpg`,
  p107: `${POKECOTTAGE}/d5448264-e17c-4140-83ad-72d4d7177e43.jpg`,
  p108: `${POKECOTTAGE}/d5e3ca26-ee9c-4f12-b3af-b639dab9d397.jpg`,
  p109: `${POKECOTTAGE}/cc7a7bff-cf7d-4983-b55c-557ca3b9bbee.jpg`,
  p110: `${POKECOTTAGE}/7dfd91df-e64e-482f-a62b-e401853a0ecd.jpg`,
  v03: `${POKECOTTAGE}/8d58bfd7-f450-4be8-a731-d8007e193d7c.jpg`,
};
const RGB_GALLERY = 'https://miketendo64.com/wp-content/uploads/2026/09/30th-Celebration_';
const RGB_SOURCES = {
  'rgb-r': `${RGB_GALLERY}Red-Mew.jpg`,
  'rgb-g': `${RGB_GALLERY}Green-Mew.jpg`,
  'rgb-b': `${RGB_GALLERY}Blue-Mew.jpg`,
};
const CLASSIC_IMAGE = {
  c01: 14, c02: 1, c03: 5, c04: 15, c05: 7, c06: 24, c07: 29, c08: 2, c09: 6, c10: 25,
  c11: 3, c12: 22, c13: 10, c14: 11, c15: 18, c16: 19, c17: 20, c18: 21, c19: 16, c20: 4,
  c21: 23, c22: 9, c23: 17, c24: 13, c25: 8, c26: 28, c27: 12, c28: 26, c29: 27, c30: 30,
};

export function imageSource(card, cardById) {
  if (POKECOTTAGE_SOURCES[card.id]) return POKECOTTAGE_SOURCES[card.id];
  if (card.base) return imageSource(cardById.get(card.base), cardById);
  if (card.section === 'energy') return ENERGY_SOURCES[card.id];
  if (card.section === 'classic') return `${CDN}/2M6P_Classic_EN_${CLASSIC_IMAGE[card.id]}-2x.png`;
  if (card.rarity === 'P') return `${PROMO_CDN}/MEP_${card.num}_R_EN_LG.png`;
  if (card.rarity === 'RGB') return RGB_SOURCES[card.id];
  return `${CDN}/2M6P_EN_${Number(card.id.slice(1))}-2x.png`;
}

export const tcgplayerGroups = { set: 24722, classic: 24837, promos: 24451, energy: 24461 };
const PRODUCT_OVERRIDES = { v03: 713261 };

export function productFor(card, groups, { number, firstWord, only }) {
  if (PRODUCT_OVERRIDES[card.id]) return PRODUCT_OVERRIDES[card.id];
  if (card.base) return null;
  if (card.section === 'classic') {
    const sameNumber = groups.classic.products.filter((p) => parseInt(number(p), 10) === Number(card.num));
    return only(sameNumber.length > 1 ? sameNumber.filter((p) => firstWord(p.name) === firstWord(card.name)) : sameNumber);
  }
  if (card.section === 'energy') return only(groups.energy.products.filter((p) => number(p) === card.num));
  if (card.rarity === 'P') {
    return only(groups.promos.products.filter((p) => number(p) === card.num && !/pokemon center|cosmos|stamp|staff|prerelease/i.test(p.name)));
  }
  return only(groups.set.products.filter((p) => number(p) === card.printed));
}

export const og = {
  emblem: 'emblem-30',
  blurb: 'Track all 199 cards: main set, secret rares, RGB Mews, Classic Collection &amp; promos.',
  showcase: [
    { id: 'c02', width: 196, angle: -16, x: 752, y: 352 },
    { id: 'c01', width: 196, angle: 16, x: 1082, y: 352 },
    { id: 'm152', width: 218, angle: -8, x: 830, y: 330 },
    { id: 'm157', width: 218, angle: 8, x: 1004, y: 330 },
    { id: 'm149', width: 244, angle: 0, x: 917, y: 318 },
  ],
};
