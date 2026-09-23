export const SET_NAME = '30th Celebration';
export const PRINTED_TOTAL = 128;

export const SECTIONS = [
  { id: 'main', name: 'Main Set', range: '001–128' },
  { id: 'secret', name: 'Secret Rares', range: '129–158' },
  { id: 'classic', name: 'Classic Collection', range: '30 reprints' },
  { id: 'energy', name: 'Basic Energy', range: '009–016' },
];

export const RARITIES = [
  { id: 'C', name: 'Common', icon: 'r-common', rank: 1 },
  { id: 'R', name: 'Rare', icon: 'r-rare', rank: 2 },
  { id: 'RR', name: 'Double Rare', icon: 'r-double', rank: 3 },
  { id: 'PR', name: 'Pikachu Rare', icon: 'r-pikachu', rank: 4 },
  { id: 'CC', name: 'Classic Collection', icon: 'r-classic', rank: 5 },
  { id: 'IR', name: 'Illustration Rare', icon: 'r-ir', rank: 6 },
  { id: 'SIR', name: 'Special Illustration Rare', icon: 'r-sir', rank: 7 },
  { id: 'FR', name: 'Futuristic Rare', icon: 'r-fr', rank: 8 },
  { id: 'E', name: 'Basic Energy', icon: 'e-lightning', rank: 0 },
];

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

const ALIASES = {
  'Nidoran♀': 'female',
  'Metagross δ': 'delta',
  'Palkia LV.X': 'lvx level',
  'Crobat G': 'galactic',
};

export const RARITY_BY_ID = new Map(RARITIES.map((r) => [r.id, r]));
const SECTION_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));

export const normalize = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[‘’]/g, "'").toLowerCase();

function makeCard(fields) {
  const rarity = RARITY_BY_ID.get(fields.rarity);
  const section = SECTION_BY_ID.get(fields.section);
  const words = [
    fields.num, String(Number(fields.num)), fields.code, fields.name,
    ALIASES[fields.name] || '', rarity.name, fields.rarity, section.name,
  ];
  return { ...fields, search: ` ${normalize(words.join(' '))} ` };
}

export const CARDS = [
  ...MAIN_NAMES.map((name, i) => {
    const n = i + 1;
    const num = String(n).padStart(3, '0');
    return makeCard({
      id: `m${num}`,
      section: n <= PRINTED_TOTAL ? 'main' : 'secret',
      num,
      printed: `${num}/${PRINTED_TOTAL}`,
      code: String(n),
      name,
      rarity: mainRarity(n),
    });
  }),
  ...CLASSIC.map(([num, name], i) => makeCard({
    id: `c${String(i + 1).padStart(2, '0')}`,
    section: 'classic',
    num,
    printed: num,
    code: `C${i + 1}`,
    name,
    rarity: 'CC',
  })),
  ...ENERGY_TYPES.map((type, i) => {
    const num = String(9 + i).padStart(3, '0');
    return makeCard({
      id: `e${num}`,
      section: 'energy',
      num,
      printed: num,
      code: `E${9 + i}`,
      name: `Basic ${type} Energy`,
      rarity: 'E',
      type: type.toLowerCase(),
    });
  }),
].map((card, idx) => ({ ...card, idx }));

export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

export const GROUPS = [
  { id: 'main', name: 'Main Set', test: (c) => c.section === 'main' },
  { id: 'pikachu', name: 'Pikachu Rares', test: (c) => c.rarity === 'PR' },
  { id: 'secret', name: 'Secret Rares', test: (c) => c.section === 'secret' },
  { id: 'classic', name: 'Classic Collection', test: (c) => c.section === 'classic' },
  { id: 'energy', name: 'Basic Energy', test: (c) => c.section === 'energy' },
  { id: 'master', name: 'Master Set', test: () => true },
];
