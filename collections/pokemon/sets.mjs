export const SERIES = ['Mega Evolution', 'Scarlet & Violet'];

const MEGA = 'Mega Evolution';
const SV = 'Scarlet & Violet';

export default [
  { slug: '30th-celebration', curated: '30th-celebration.mjs', theme: { preset: 'default' } },
  { slug: 'pitch-black', tcgdex: 'me05', series: MEGA, syncKey: 'PBL', tcgplayer: [24688], theme: { accent: '#C465E8', chrome: '#150C1F' } },
  { slug: 'chaos-rising', tcgdex: 'me04', series: MEGA, syncKey: 'CRI', tcgplayer: [24655], theme: { accent: '#4FB6E0', chrome: '#1A1250' } },
  { slug: 'perfect-order', tcgdex: 'me03', series: MEGA, syncKey: 'POR', tcgplayer: [24587], theme: { accent: '#8DBA3F', chrome: '#172412' } },
  { slug: 'ascended-heroes', tcgdex: 'me02.5', series: MEGA, syncKey: 'ASC', tcgplayer: [24541], theme: { accent: '#E7BD45', chrome: '#0F2E2B' } },
  { slug: 'phantasmal-flames', tcgdex: 'me02', series: MEGA, syncKey: 'PFL', tcgplayer: [24448], theme: { accent: '#7A8CF2', chrome: '#1B1238' } },
  { slug: 'mega-evolution', tcgdex: 'me01', series: MEGA, syncKey: 'MEG', tcgplayer: [24380], theme: { accent: '#F0A43A', chrome: '#17181F' } },
  {
    slug: 'me-black-star-promos', tcgdex: 'mep', series: MEGA, kind: 'promo', name: 'ME Black Star Promos', syncKey: 'MEP', tcgplayer: [24451], theme: { accent: '#E0B45C', chrome: '#1D1720' },
    images: {
      120: 'https://static.tcgcollector.com/content/images/31/88/01/3188013b2de0360e59a5519b9010873415a0d919c32b7460c013a6a041ceeb3b.webp',
      Museum: 'https://static.tcgcollector.com/content/images/b2/a5/39/b2a53937123cf52cad8c973c84e78763e18a236efb1dbf09ef17300ac4570e10.webp',
    },
  },
  { slug: 'me-energy', tcgdex: 'mee', series: MEGA, kind: 'energy', name: 'Mega Evolution Energy', syncKey: 'MEE', tcgplayer: [24461], theme: { accent: '#F3C433', chrome: '#1C1F2A' } },

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
  { slug: 'sv-black-star-promos', tcgdex: 'svp', series: SV, kind: 'promo', name: 'SV Black Star Promos', syncKey: 'SVP', tcgplayer: [22872], theme: { accent: '#D2D7E0', chrome: '#181B24' } },
  { slug: 'sv-energy', tcgdex: 'sve', series: SV, kind: 'energy', name: 'Scarlet & Violet Energy', syncKey: 'SVE', tcgplayer: [24382], theme: { accent: '#6CC24A', chrome: '#13261A' } },
];
