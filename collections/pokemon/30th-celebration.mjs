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

// 216 and 217 belonged to the stamped Mewtwo and Cosmos Holo Eevee, which are no longer listed. Old share links still use them, so don't reuse them.
const IDX = { main: 0, classic: 158, rgb: 196 };

const CARDS = [
  ...MAIN_NAMES.map((name, i) => {
    const n = i + 1;
    const num = String(n).padStart(3, '0');
    return { id: `m${num}`, section: n <= PRINTED_TOTAL ? 'main' : 'secret', num, printed: `${num}/${PRINTED_TOTAL}`, code: String(n), name, rarity: mainRarity(n), idx: IDX.main + i };
  }),
  ...CLASSIC.map(([num, name], i) => ({
    id: `c${String(i + 1).padStart(2, '0')}`, section: 'classic', num, printed: num, code: `C${i + 1}`, name, rarity: 'CC', idx: IDX.classic + i,
  })),
  ...RGB_MEWS.map(([letter, colour], i) => {
    const num = `${letter.toUpperCase()}/RGB`;
    return { id: `rgb-${letter}`, section: 'secret', num, printed: num, code: num, name: 'Mew', rarity: 'RGB', keywords: colour, idx: IDX.rgb + i };
  }),
];

const pad = (n) => String(n).padStart(3, '0');

export const promoNotes = Object.fromEntries([
  ...PROMOS.map(([n, , product]) => [pad(n), `30th Celebration ${product}`]),
  ...FIRST_PARTNERS.flatMap(([released, names], s) => names.map((_, i) => [pad(37 + s * 9 + i), `First Partner Illustration Collection · Series ${s + 1} · ${released}`])),
]);
export const promoDetails = {
  ...Object.fromEntries(FIRST_PARTNERS.flatMap((_, s) => Array.from({ length: 9 }, (__, i) => [
    pad(37 + s * 9 + i), 'Each collection has a promo pack with 3 of the series’ 9 cards at random, plus 2 booster packs.',
  ]))),
  '099': 'The box also has an oversize Jumbo version of this card.',
  '100': 'The box also has an oversize Jumbo version of this card.',
  '101': 'The Pokémon Center Elite Trainer Box has this card as well as a Pokémon Center-stamped version.',
  '104': 'The collection also has an oversize Jumbo version of this card and a Mewtwo figure.',
  '105': 'The collection also has an oversize Jumbo version of this card and a Mew figure.',
};
export const energyNotes = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [pad(9 + i), '30th Celebration booster packs (one in every pack)']));

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
  defaultTier: 'grand',
  sections: [
    { id: 'main', name: 'Main Set', range: '001–128', tier: 'standard' },
    { id: 'secret', name: 'Secret Rares', range: '129–158 + RGB', tier: 'grand' },
    {
      id: 'classic', name: 'Classic Collection', range: '30 reprints', tier: 'grand',
      display: { number: 'Classic Collection · No. {num}', label: 'Classic Collection {num}', list: '{name} ({num})', chip: '{code} {name}', pocket: '{code}', search: 'Pokemon 30th Celebration Classic Collection {name}' },
    },
  ],
  groups: [
    { id: 'main', name: 'Main Set', match: { section: 'main' } },
    { id: 'pikachu', name: 'Pikachu Rares', match: { rarity: 'PR' }, stat: true },
    { id: 'secret', name: 'Secret Rares', match: { section: 'secret' } },
    { id: 'classic', name: 'Classic Collection', match: { section: 'classic' } },
  ],
  jumps: [
    { id: 'main', label: 'Main Set' },
    { id: 'pikachu', label: 'Pikachu Rares', icon: 'r-pikachu', section: 'main', from: 'm023', to: 'm052' },
    { id: 'secret', label: 'Secret Rares' },
    { id: 'classic', label: 'Classic' },
  ],
  summary: [['main', 'Main set'], ['secret', 'Secret rares'], ['classic', 'Classic Collection']],
  searchAliases: {
    'Nidoran♀': 'female',
    'Metagross δ': 'delta',
    'Palkia LV.X': 'lvx level',
    'Crobat G': 'galactic',
  },
  quickAdd: {
    placeholder: 'e.g. 1-22, 55, 129x2, C1-C5, RGB',
    example: '1-22, 55x2, C3, RGB',
    hint: 'Separate with commas or spaces. <b>1-22</b> is a range, <b>55x2</b> is two copies and <b>C1–C30</b> are Classic Collection cards in checklist order. <b>RGB</b> adds all three RGB Mews (or one with <b>R/RGB</b>, <b>G/RGB</b>, <b>B/RGB</b>).',
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
    tiers: '<b>Standard or Grand Master:</b> pick what you’re collecting above the cards. Standard is the 128 main set cards and Grand Master is all 191 cards. Cards you’ve marked are kept when you switch.',
  },
  info: {
    packSections: ['main', 'secret', 'classic'],
    packText: '<p><b>30th Celebration booster packs.</b> Every pack has 6 foil cards: a Pikachu Rare, four more cards from the set and a Basic Energy (listed in ME Energy).</p>',
    sectionText: {
      classic: [
        '<p><b>Classic Collection Packs</b>, which have 3 of the 30 cards each. There’s one in each Ultra-Premium Collection (Day and Night, 6 Nov 2026).</p>',
        '<p>They also turn up in about 1 in 10 regular 30th Celebration booster packs.</p>',
      ],
    },
    packProducts: [
      'Elite Trainer Box (9 packs)', 'Pokémon Center Elite Trainer Box (11)', 'Booster Bundle (6)',
      'Ultra-Premium Collections (29)', 'Ditto Premium Collection (8)', 'Figure Collections (5)', 'Pokémon ex Boxes (4)',
      'Tech Sticker Collections (3)', 'Poster Collection (3)', 'Mini Tins (2)', 'Knock Out Collection (2)', '2-Pack Blister (2)',
      'ex Tins', 'Binder Collection', 'single booster packs',
    ],
    pullOdds: { PR: 1, R: 2.3, RR: 4.5, IR: 5.5, CC: 10, SIR: 19, FR: 90, RGB: 4000 },
    oddsText: {
      C: 'Commons make up most of each pack.',
      RGB: 'RGB Rares are extremely rare: roughly 1 in 4,000 packs, from the few found so far.',
    },
  },
  seo: {
    title: 'Pokémon TCG 30th Celebration Checklist · All 191 Cards',
    description: 'Free checklist for the Pokémon TCG 30th Celebration set. Track all 191 cards, including the Classic Collection and the RGB Mews, with images, copy counts, binder pages and offline use. No sign-up needed.',
    ogTitle: 'Pokémon TCG 30th Celebration Checklist',
    ogDescription: 'Track all 191 cards in the Pokémon TCG 30th Celebration set, including secret rares, the RGB Mews and the Classic Collection. Free, no sign-up, works offline.',
    twitterDescription: 'Track all 191 cards in the Pokémon TCG 30th Celebration set. Free, no sign-up, works offline.',
    imageAlt: '30th Celebration Card Checklist with Pikachu ex, Mew ex, Mewtwo ex and Charizard cards',
    appDescription: 'Track all 191 cards in the Pokémon TCG 30th Celebration set: the main set, secret rares and Classic Collection.',
  },
  about: {
    title: 'About the 30th Celebration set',
    paragraphs: [
      'Pokémon TCG: 30th Celebration marks 30 years of Pokémon. The set has 191 cards: 128 main set cards, including 30 special Pikachu Rares; 33 secret rares (18 Illustration Rares, 10 Special Illustration Rares, 2 Futuristic Rares and the 3 ultra-rare RGB Mews); and 30 Classic Collection reprints of iconic cards from the game’s history. Its 8 Basic Energy cards are listed in <a href="pokemon/me-energy/">ME Energy</a>, and the promos from 30th Celebration products in <a href="pokemon/me-black-star-promos/">ME Black Star Promos</a>.',
      'Choose what you’re collecting: the <b>Standard set</b> (the 128 main set cards) or the <b>Grand Master set</b> (all 191 cards).',
      'This free checklist lets you tick off the cards you own, count spare copies for trading, see your progress by rarity and plan your binder pages. It works on phones and computers, even offline, and your collection stays on your device.',
    ],
  },
  cards: CARDS,
};

const CDN = 'https://dz3we2x72f7ol.cloudfront.net/expansions/30th-celebration/en-us';
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

export function imageSource(card) {
  if (card.section === 'classic') return `${CDN}/2M6P_Classic_EN_${CLASSIC_IMAGE[card.id]}-2x.png`;
  if (card.rarity === 'RGB') return RGB_SOURCES[card.id];
  return `${CDN}/2M6P_EN_${Number(card.id.slice(1))}-2x.png`;
}

export const tcgplayerGroups = { set: 24722, classic: 24837 };

export function productFor(card, groups, { number, firstWord, only }) {
  if (card.section === 'classic') {
    const sameNumber = groups.classic.products.filter((p) => parseInt(number(p), 10) === Number(card.num));
    return only(sameNumber.length > 1 ? sameNumber.filter((p) => firstWord(p.name) === firstWord(card.name)) : sameNumber);
  }
  return only(groups.set.products.filter((p) => number(p) === card.printed));
}

export const og = {
  emblem: 'emblem-30',
  blurb: 'Track all 191 cards: main set, secret rares, RGB Mews &amp; the Classic Collection.',
  showcase: [
    { id: 'c02', width: 196, angle: -16, x: 752, y: 352 },
    { id: 'c01', width: 196, angle: 16, x: 1082, y: 352 },
    { id: 'm152', width: 218, angle: -8, x: 830, y: 330 },
    { id: 'm157', width: 218, angle: 8, x: 1004, y: 330 },
    { id: 'm149', width: 244, angle: 0, x: 917, y: 318 },
  ],
};
