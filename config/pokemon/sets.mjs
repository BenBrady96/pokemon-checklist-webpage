import generated from './generated-sets.json' with { type: 'json' };
import DELTA_REIGN from './coming-soon/delta-reign.mjs';

export const SERIES = [
  'Mega Evolution', 'Scarlet & Violet', 'Sword & Shield', 'Sun & Moon', 'XY', 'Black & White', 'Call of Legends',
  'HeartGold & SoulSilver', 'Platinum', 'Diamond & Pearl', 'EX', 'e-Card', 'Legendary Collection', 'Neo', 'Original',
  'Trainer & Deck Kits', 'Play! Pokémon', 'World Championships Decks', "McDonald's", 'Other',
];

export const LOGO = 'https://upload.wikimedia.org/wikipedia/commons/9/98/International_Pok%C3%A9mon_logo.svg';

const MEGA = 'Mega Evolution';
const SV = 'Scarlet & Violet';

const pad = (n) => String(n).padStart(3, '0');

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

const promoNotes = Object.fromEntries([
  ...PROMOS.map(([n, , product]) => [pad(n), `30th Celebration ${product}`]),
  ...FIRST_PARTNERS.flatMap(([released, names], s) => names.map((_, i) => [pad(37 + s * 9 + i), `First Partner Illustration Collection · Series ${s + 1} · ${released}`])),
]);

const promoDetails = {
  ...Object.fromEntries(FIRST_PARTNERS.flatMap((_, s) => Array.from({ length: 9 }, (__, i) => [
    pad(37 + s * 9 + i), 'Each collection has a promo pack with 3 of the series’ 9 cards at random, plus 2 booster packs.',
  ]))),
  '099': 'The box also has an oversize Jumbo version of this card.',
  '100': 'The box also has an oversize Jumbo version of this card.',
  '101': 'The Pokémon Center Elite Trainer Box has this card as well as a Pokémon Center-stamped version.',
  '104': 'The collection also has an oversize Jumbo version of this card and a Mewtwo figure.',
  '105': 'The collection also has an oversize Jumbo version of this card and a Mew figure.',
};

const energyNotes = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [pad(9 + i), '30th Celebration booster packs (one in every pack)']));

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

const THIRTIETH_CELEBRATION = {
  data: {
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
      description: 'Free Pokémon TCG 30th Celebration checklist with no ads, no sign-up and no tracking. Track all 191 cards, including the Classic Collection and the RGB Mews, with images, copy counts, binder pages and offline use.',
      ogTitle: 'Pokémon TCG 30th Celebration Checklist',
      ogDescription: 'Track all 191 cards in the Pokémon TCG 30th Celebration set, including secret rares, the RGB Mews and the Classic Collection. Free, with no ads, no sign-up and no tracking.',
      twitterDescription: 'Track all 191 cards in the Pokémon TCG 30th Celebration set. Free, with no ads, no sign-up and no tracking.',
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
  },
  imageSource(card) {
    if (card.section === 'classic') return `${CDN}/2M6P_Classic_EN_${CLASSIC_IMAGE[card.id]}-2x.png`;
    if (card.rarity === 'RGB') return RGB_SOURCES[card.id];
    return `${CDN}/2M6P_EN_${Number(card.id.slice(1))}-2x.png`;
  },
  tcgplayerGroups: { set: 24722, classic: 24837 },
  productFor(card, groups, { number, firstWord, only }) {
    if (card.section === 'classic') {
      const sameNumber = groups.classic.products.filter((p) => parseInt(number(p), 10) === Number(card.num));
      return only(sameNumber.length > 1 ? sameNumber.filter((p) => firstWord(p.name) === firstWord(card.name)) : sameNumber);
    }
    return only(groups.set.products.filter((p) => number(p) === card.printed));
  },
  og: {
    emblem: 'emblem-30',
    blurb: 'Track all 191 cards: main set, secret rares, RGB Mews &amp; the Classic Collection.',
    showcase: [
      { id: 'c02', width: 196, angle: -16, x: 752, y: 352 },
      { id: 'c01', width: 196, angle: 16, x: 1082, y: 352 },
      { id: 'm152', width: 218, angle: -8, x: 830, y: 330 },
      { id: 'm157', width: 218, angle: 8, x: 1004, y: 330 },
      { id: 'm149', width: 244, angle: 0, x: 917, y: 318 },
    ],
  },
};

export const HAND = [
  { slug: '30th-celebration', curated: THIRTIETH_CELEBRATION, theme: { preset: 'default' } },
  { slug: 'pitch-black', tcgdex: 'me05', series: MEGA, syncKey: 'PBL', tcgplayer: [24688], theme: { accent: '#C465E8', chrome: '#150C1F' } },
  { slug: 'chaos-rising', tcgdex: 'me04', series: MEGA, syncKey: 'CRI', tcgplayer: [24655], theme: { accent: '#4FB6E0', chrome: '#1A1250' } },
  { slug: 'perfect-order', tcgdex: 'me03', series: MEGA, syncKey: 'POR', tcgplayer: [24587], theme: { accent: '#8DBA3F', chrome: '#172412' } },
  { slug: 'ascended-heroes', tcgdex: 'me02.5', series: MEGA, syncKey: 'ASC', tcgplayer: [24541], theme: { accent: '#E7BD45', chrome: '#0F2E2B' } },
  { slug: 'phantasmal-flames', tcgdex: 'me02', series: MEGA, syncKey: 'PFL', tcgplayer: [24448], theme: { accent: '#7A8CF2', chrome: '#1B1238' } },
  { slug: 'mega-evolution', tcgdex: 'me01', series: MEGA, syncKey: 'MEG', tcgplayer: [24380], theme: { accent: '#F0A43A', chrome: '#17181F' } },
  {
    slug: 'me-black-star-promos', tcgdex: 'mep', series: MEGA, kind: 'promo', name: 'ME Black Star Promos', syncKey: 'MEP', tcgplayer: [24451], logoOutline: true, theme: { accent: '#E0B45C', chrome: '#1D1720' },
    notes: promoNotes,
    details: promoDetails,
  },
  { slug: 'me-energy', tcgdex: 'mee', series: MEGA, kind: 'energy', name: 'ME Energy', syncKey: 'MEE', tcgplayer: [24461], notes: energyNotes, theme: { accent: '#F3C433', chrome: '#1C1F2A' } },

  { slug: 'white-flare', tcgdex: 'sv10.5w', series: SV, syncKey: 'WHT', tcgplayer: [24326], theme: { accent: '#E0356E', chrome: '#3A3542' } },
  { slug: 'black-bolt', tcgdex: 'sv10.5b', series: SV, syncKey: 'BLK', tcgplayer: [24325], theme: { accent: '#1BA3D6', chrome: '#0C0E13' } },
  { slug: 'destined-rivals', tcgdex: 'sv10', series: SV, syncKey: 'DRI', tcgplayer: [24269], gallery: 'destined-rivals/SV10', theme: { accent: '#E0643A', chrome: '#241022' } },
  { slug: 'journey-together', tcgdex: 'sv09', series: SV, syncKey: 'JTG', tcgplayer: [24073], gallery: 'journey-together/SV09', theme: { accent: '#3EB8B3', chrome: '#122A3A' } },
  { slug: 'prismatic-evolutions', tcgdex: 'sv08.5', series: SV, syncKey: 'PRE', tcgplayer: [23821], gallery: 'prismatic-evolutions/SV8pt5', theme: { accent: '#E36BA6', chrome: '#13123F' } },
  { slug: 'surging-sparks', tcgdex: 'sv08', series: SV, syncKey: 'SSP', tcgplayer: [23651], gallery: 'surging-sparks/SV08', theme: { accent: '#F5C518', chrome: '#3D0B06' } },
  { slug: 'stellar-crown', tcgdex: 'sv07', series: SV, syncKey: 'SCR', tcgplayer: [23537], gallery: 'stellar-crown/SV07', theme: { accent: '#55C7E8', chrome: '#14163D' } },
  { slug: 'shrouded-fable', tcgdex: 'sv06.5', series: SV, syncKey: 'SFA', tcgplayer: [23529], gallery: 'shrouded-fable/SV6pt5', theme: { accent: '#C565C9', chrome: '#1D0F2E' } },
  { slug: 'twilight-masquerade', tcgdex: 'sv06', series: SV, syncKey: 'TWM', tcgplayer: [23473], gallery: 'twilight-masquerade/SV06', theme: { accent: '#E9C24F', chrome: '#2B1450' } },
  { slug: 'temporal-forces', tcgdex: 'sv05', series: SV, syncKey: 'TEF', tcgplayer: [23381], gallery: 'temporal-forces/SV05', theme: { accent: '#37C2A5', chrome: '#0F2A33' } },
  { slug: 'paldean-fates', tcgdex: 'sv04.5', series: SV, syncKey: 'PAF', tcgplayer: [23353], gallery: 'paldean-fates/SV4pt5', theme: { accent: '#E2BD5A', chrome: '#0F2F38' } },
  { slug: 'paradox-rift', tcgdex: 'sv04', series: SV, syncKey: 'PAR', tcgplayer: [23286], gallery: 'paradox-rift/SV04', theme: { accent: '#54A9E8', chrome: '#111A3A' } },
  { slug: '151', tcgdex: 'sv03.5', series: SV, syncKey: 'MEW', tcgplayer: [23237], gallery: '151/SV3pt5', theme: { accent: '#E13A43', chrome: '#2A0C12' } },
  { slug: 'obsidian-flames', tcgdex: 'sv03', series: SV, syncKey: 'OBF', tcgplayer: [23228], gallery: 'obsidian-flames/SV03', theme: { accent: '#F08A3C', chrome: '#1E0E12' } },
  { slug: 'paldea-evolved', tcgdex: 'sv02', series: SV, syncKey: 'PAL', tcgplayer: [23120], gallery: 'paldea-evolved/SV02', theme: { accent: '#E8874A', chrome: '#3A1712' } },
  { slug: 'scarlet-violet', tcgdex: 'sv01', series: SV, syncKey: 'SVI', tcgplayer: [22873], gallery: 'scarlet-violet/SV01', theme: { accent: '#E24A6A', chrome: '#2C1344' } },
  { slug: 'sv-black-star-promos', tcgdex: 'svp', series: SV, kind: 'promo', name: 'SV Black Star Promos', syncKey: 'SVP', tcgplayer: [22872], logoOutline: true, theme: { accent: '#D2D7E0', chrome: '#181B24' } },
  { slug: 'sv-energy', tcgdex: 'sve', series: SV, kind: 'energy', name: 'SV Energy', syncKey: 'SVE', tcgplayer: [24382], theme: { accent: '#6CC24A', chrome: '#13261A' } },
];

export const UPCOMING = [
  { slug: 'delta-reign', tcgdex: 'me06', series: MEGA, syncKey: 'DLR', tcgplayer: [24831], theme: { accent: '#2FB57E', chrome: '#0D2620' }, guide: DELTA_REIGN },
];

export default [...HAND, ...generated.filter((g) => !HAND.some((h) => h.slug === g.slug))];
