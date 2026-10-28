import INTO_THE_INKDARK from './coming-soon/into-the-inkdark.mjs';
import COSMIC_QUEST from './coming-soon/cosmic-quest.mjs';

export const LIVE = true;

export const LOGO = 'https://ravensburger.cloud/cms/gallery/lorcana-web/d23/digital-game/dlc-logo.png';
export const LOGO_OUTLINE = '#1B1433';
const EDGE = LOGO_OUTLINE;

export const SERIES = ['2027', '2026', '2025', '2024', '2023'];

const PROMO_GROUPS = [23234, 17690, 23305];
const CMS = 'https://ravensburger.cloud/cms/gallery/lorcana-web';
const HEADER = {
  1: `${CMS}/products/en_products_header_now_1920.png`,
  2: `${CMS}/product-s2/en_wgfytdu8ii.png`,
  3: `${CMS}/product-s3/en_z6ojsofqq1_1920.png`,
  4: `${CMS}/products/s4/z9qog5qlpa_en_1920w.png`,
};

const booster = (slug, code, released, group, logo, extra = {}) => ({
  slug, source: 'lorcana', code, syncKey: `I${code}`, kind: 'expansion', series: released.slice(0, 4), tcgplayer: [group], logo, ...extra,
});
const quest = (slug, code, released, group, logo, extra = {}) => ({
  slug, source: 'lorcana', code, syncKey: `I${code}`, kind: 'quest', series: released.slice(0, 4), tcgplayer: [group], logo, ...extra,
});
const promo = (slug, code, name, released) => ({
  slug, source: 'lorcana', code, syncKey: `I${code}`, kind: 'promo', name, released, series: released.slice(0, 4), tcgplayer: PROMO_GROUPS,
});

const SETS = [
  booster('the-first-chapter', '1', '2023-09-01', 22937, HEADER[1], { logoCrop: [580, 619, 781, 407], logoOutline: EDGE }),
  booster('rise-of-the-floodborn', '2', '2023-12-01', 23303, HEADER[2], { logoCrop: [601, 733, 717, 291] }),
  booster('into-the-inklands', '3', '2024-03-08', 23367, HEADER[3], { logoCrop: [610, 722, 701, 326] }),
  booster('ursulas-return', '4', '2024-05-31', 23474, HEADER[4], { logoCrop: [606, 703, 692, 329] }),
  booster('shimmering-skies', '5', '2024-08-23', 23536, `${CMS}/products/s5/lorcana-s5-logo_en.png`),
  booster('azurite-sea', '6', '2024-11-25', 23746, `${CMS}/products/s6/dlc_s6_logo_en.png`),
  booster('archazias-island', '7', '2025-03-21', 24011, `${CMS}/products/arch/logos/s7_en_j4blelafze-1.png`),
  booster('reign-of-jafar', '8', '2025-06-06', 24258, `${CMS}/products/jafar/logos/dlc_roj_en.png`),
  booster('fabled', '9', '2025-09-05', 24348, `${CMS}/products/fabled/logos/en_xdceeumyxu_v2.png`),
  booster('whispers-in-the-well', '10', '2025-11-14', 24414, `${CMS}/products/s10/logos/dlc_s10_logos_en.png`),
  booster('winterspell', '11', '2026-02-20', 24500, `${CMS}/products/s11-winterspell/en/dlc_s11_logo_en.png`, { logoOutline: EDGE }),
  booster('wilds-unknown', '12', '2026-05-15', 24617, `${CMS}/products/s12-wild-unknown/en/dlc_s12_logo_en.png`, { logoOutline: EDGE }),
  booster('attack-of-the-vine', '13', '2026-07-24', 24666, `${CMS}/products/s13-attack-of-the-vine/heroes-logos-and-backgrounds/dlc_s13_logo_en.png`),
  booster('hyperia-city', '14', '2026-10-23', 24740, `${CMS}/products/s14-hyperia-city/en/whtzuxaqg5_en.png`),
  quest('deep-trouble', 'Q1', '2024-05-31', 23528, `${CMS}/products/dt/en_9qtnfq4muo.png`, { logoCrop: [330, 0, 760, 560] }),
  quest('palace-heist', 'Q2', '2025-06-06', 24257, `${CMS}/products/jafar/logos/iq2/dlc_iq2-logo_en_large.png`, { logoOutline: EDGE }),
  quest('the-great-hunny-rescue', 'Q3', '2026-10-02', 24734, `${CMS}/products/iq3-great-hunny-rescue/logo/en_gosdhfht9u.png`, { logoOutline: EDGE }),
  promo('promo-set-1', 'P1', 'Promo Set 1', '2023-08-18'),
  promo('challenge-promos', 'C1', 'Lorcana Challenge Promos', '2024-05-17'),
  promo('d23-collection', 'D23', 'D23 Collection', '2024-08-09'),
  promo('promo-set-2', 'P2', 'Promo Set 2', '2024-08-09'),
  promo('promo-set-3', 'P3', 'Promo Set 3', '2025-08-18'),
  promo('challenge-promos-year-3', 'C2', 'Lorcana Challenge Year 3 Promos', '2026-01-16'),
  promo('disney-parks-promos', 'DIS', 'Disney Parks Promos', '2026-01-16'),
  promo('curators-collection-heroines', 'CC1', 'Curator’s Collection: Heroines Edition', '2026-07-17'),
  promo('promo-set-4', 'P4', 'Promo Set 4', '2026-07-17'),
  promo('pd1-promos', 'PD1', 'PD1 Promos', '2026-07-28'),
  promo('c3-promos', 'C3', 'C3 Promos', '2026-10-01'),
  { ...promo('curators-collection-beauty-and-the-beast', 'CC2', 'Curator’s Collection: Beauty and the Beast Edition', '2026-10-01'), seoName: 'Curator’s Collection: Beauty and the Beast' },
  promo('rph-promos', 'RPH', 'RPH Promos', '2026-10-16'),
];

export const UPCOMING = [
  { slug: 'into-the-inkdark', source: 'lorcana', code: '15', syncKey: 'I15', kind: 'expansion', series: '2027', tcgplayer: [24890], logo: `${CMS}/products/s15-into-the-inkdark/s15-logo/en_jbs83nhsz6.png`, guide: INTO_THE_INKDARK },
  { slug: 'cosmic-quest', source: 'lorcana', code: '16', syncKey: 'I16', kind: 'expansion', series: '2027', tcgplayer: [], logo: `${CMS}/products/s16-cosmic-quest/announce/en_s16.png`, guide: COSMIC_QUEST },
];

export default SETS;
