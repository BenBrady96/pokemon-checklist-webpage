import * as pokemon from '../../js/games/pokemon.js';
import { loadSetCards } from './tcgdex.mjs';
import { isCard, loadPrices, loadProducts, productNumber, productRarity } from './tcgcsv.mjs';
import { cachedJson } from './util.mjs';

const VARIANTS = [
  { key: 'rh', section: 'reverse', name: 'Reverse Holos', label: 'Reverse Holo', code: 'R', suffixes: ['Reverse Holofoil'], text: 'Reverse holo', lower: 'reverse holos' },
  { key: 'pb', section: 'pokeball', name: 'Poké Ball Holos', label: 'Poké Ball', code: 'PB', suffixes: ['Poke Ball Pattern', 'Poke Ball'], text: 'Poké Ball pattern holo', lower: 'Poké Ball holos' },
  { key: 'mb', section: 'masterball', name: 'Master Ball Holos', label: 'Master Ball', code: 'MB', suffixes: ['Master Ball Pattern'], text: 'Master Ball pattern holo', lower: 'Master Ball holos', extra: 'These are much rarer than the other versions of the card.' },
  { key: 'fb', section: 'friendball', name: 'Friend Ball Holos', label: 'Friend Ball', code: 'FB', suffixes: ['Friend Ball'], text: 'Friend Ball pattern holo', lower: 'Friend Ball holos' },
  { key: 'lb', section: 'loveball', name: 'Love Ball Holos', label: 'Love Ball', code: 'LB', suffixes: ['Love Ball'], text: 'Love Ball pattern holo', lower: 'Love Ball holos' },
  { key: 'qb', section: 'quickball', name: 'Quick Ball Holos', label: 'Quick Ball', code: 'QB', suffixes: ['Quick Ball'], text: 'Quick Ball pattern holo', lower: 'Quick Ball holos' },
  { key: 'db', section: 'duskball', name: 'Dusk Ball Holos', label: 'Dusk Ball', code: 'DB', suffixes: ['Dusk Ball'], text: 'Dusk Ball pattern holo', lower: 'Dusk Ball holos' },
  { key: 'tr', section: 'rocket', name: 'Team Rocket Holos', label: 'Team Rocket', code: 'TR', suffixes: ['Team Rocket'], text: 'Team Rocket pattern holo', lower: 'Team Rocket holos' },
  { key: 'en', section: 'energy', name: 'Energy Symbol Holos', label: 'Energy Symbol', code: 'EN', suffixes: ['Energy Symbol Pattern'], text: 'Energy symbol pattern holo', lower: 'Energy Symbol holos' },
];
const VARIANT_BY_SUFFIX = new Map(VARIANTS.flatMap((v) => v.suffixes.map((s) => [s.toLowerCase(), v])));

const BOOSTER_FOILS = new Set(['pokeball', 'masterball', 'energy', 'friendball', 'loveball', 'quickball', 'duskball', 'team-rocket']);
const AWARD_STAMPS = new Set(['staff', 'judge', 'champion', 'finalist', 'semi-finalist', 'top-eight', 'top-sixteen', 'top-thirty-two', 'winner']);
const PRINT_TYPES = {
  metal: ['Metal', 'A metal card, from a premium collection.'],
};
const FOILS = {
  cosmos: ['Cosmos Holo', 'A Cosmos Holo print, from blister packs, collection boxes and other special products.'],
  'cracked-ice': ['Cracked Ice Holo', 'A Cracked Ice Holo print, from special products.'],
  tinsel: ['Tinsel Holo', 'A Tinsel Holo print, from special products.'],
  galaxy: ['Galaxy Holo', 'A Galaxy Holo print, from special products.'],
  gold: ['Gold', 'A gold-foil print, from a special product.'],
  league: ['League Holo', 'A Play! Pokémon league promo.'],
  'player-reward': ['Player Reward', 'A Play! Pokémon Player Rewards promo.'],
  pokeball: ['Poké Ball Holo', ''],
  masterball: ['Master Ball Holo', ''],
  energy: ['Energy Symbol Holo', ''],
  friendball: ['Friend Ball Holo', ''],
  loveball: ['Love Ball Holo', ''],
  quickball: ['Quick Ball Holo', ''],
  duskball: ['Dusk Ball Holo', ''],
  'team-rocket': ['Team Rocket Holo', ''],
};
const STAMPS = {
  'set-logo': ['Set Stamp', 'Stamped with the set logo: a prerelease and Build & Battle Box promo.'],
  'pre-release': ['Prerelease', 'A prerelease event promo.'],
  'player-rewards-program': ['Play! Pokémon', 'From Play! Pokémon Prize Packs, given out at league events.'],
  'pokemon-center': ['Pokémon Center', 'A Pokémon Center exclusive.'],
  'professor-program': ['Professor Program', 'Given to Pokémon Professors through the Professor Program.'],
  'gym-challenge': ['Gym Challenge', 'A Gym Challenge event promo.'],
  snowflake: ['Holiday', 'From a Holiday Calendar, stamped with a snowflake.'],
  gamestop: ['GameStop', 'A GameStop exclusive.'],
  'eb-games': ['EB Games', 'An EB Games exclusive.'],
  'trick-or-trade': ['Trick or Trade', 'From a Trick or Trade BOOster Bundle.'],
  'regional-championships': ['Regionals', 'Given to players at Regional Championships.'],
  'international-championship-europe': ['EUIC', 'Given to players at the Europe International Championships.'],
  'international-championship-north-america': ['NAIC', 'Given to players at the North America International Championships.'],
  'international-championship-latin-america': ['LAIC', 'Given to players at the Latin America International Championships.'],
  'worlds-2023': ['Worlds 2023', 'Given to players at the 2023 World Championships.'],
  'worlds-2024': ['Worlds 2024', 'Given to players at the 2024 World Championships.'],
  'worlds-2025': ['Worlds 2025', 'Given to players at the 2025 World Championships.'],
  'great-ball-league': ['Great Ball League', 'A Play! Pokémon league event promo.'],
  'ultra-ball-league': ['Ultra Ball League', 'A Play! Pokémon league event promo.'],
  'master-ball-league': ['Master Ball League', 'A Play! Pokémon league event promo.'],
  'ace-trainer': ['Ace Trainer', 'A Play! Pokémon event promo.'],
  horizons: ['Horizons', 'From a Pokémon Horizons product.'],
  'pokemon-day': ['Pokémon Day', 'A Pokémon Day promo.'],
  '30th-pokeday': ['Pokémon Day', 'A Pokémon Day promo from the 30th anniversary.'],
  '30th-anniversary': ['30th Anniversary', 'Stamped for the Pokémon 30th anniversary.'],
  'pokemon-together': ['Pokémon Together', 'A Pokémon Together event promo.'],
  'illustration-contest-2024': ['Illustration Contest', 'From the Pokémon TCG Illustration Contest 2024.'],
  'asia-promo': ['Asia Promo', 'A Southeast Asia exclusive.'],
  'asia-2023-24': ['Asia 2023–24', 'From the 2023–24 Asia Championship Series.'],
  'fossil-museum': ['Fossil Museum', 'From the Pokémon Fossil Museum exhibition.'],
};
const PROMO_GROUP_NAMES = /promo|prize pack|blister|miscellaneous|exclusive|professor|trick or trade/i;
const AWARD_SUFFIX = /staff|winner|judge|finalist|top \d|champion(?!ship)/i;
const LEFT_OUT_SUFFIX = /jumbo|oversize/i;
const SUFFIX_KINDS = [
  [/cosmos? holo/i, () => ['cosmos', ...FOILS.cosmos]],
  [/cracked ice/i, () => ['cracked-ice', ...FOILS['cracked-ice']]],
  [/pok[eé]mon center/i, () => ['pokemon-center', ...STAMPS['pokemon-center']]],
  [/prerelease/i, () => ['prerelease', 'Prerelease', 'A prerelease event promo.']],
  [/world championships? (\d{4})/i, (m) => [`worlds-${m[1]}`, `Worlds ${m[1]}`, `Given to players at the ${m[1]} World Championships.`]],
  [/asia championship series (\d\d)-(\d\d)/i, (m) => [`asia-20${m[1]}-${m[2]}`, `Asia 20${m[1]}–${m[2]}`, `From the 20${m[1]}–${m[2]} Asia Championship Series.`]],
  [/illustration contest/i, () => ['illustration-contest-2024', ...STAMPS['illustration-contest-2024']]],
  [/horizons/i, () => ['horizons', ...STAMPS.horizons]],
  [/metal/i, () => ['metal', ...PRINT_TYPES.metal]],
  [/^(.+) stamped$/i, (m) => ['set-logo', `${m[1]} Stamp`, `Stamped with the ${m[1]} logo.`]],
];

function suffixKind(suffix) {
  for (const [pattern, describe] of SUFFIX_KINDS) {
    const m = pattern.exec(suffix);
    if (m) return describe(m);
  }
  return [suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), suffix, ''];
}

const numberKey = (s) => {
  const n = String(s).split('/')[0].trim();
  return /^\d+$/.test(n) ? String(Number(n)) : n.toUpperCase();
};
const suffixOf = (name) => /\(([^)]*)\)\s*$/.exec(name)?.[1] || null;
const pad = (n, width = 3) => String(n).padStart(width, '0');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const titleCase = (slug) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function packProducts(products, setName) {
  const names = new Set();
  const wanted = /(elite trainer box|booster bundle|booster box|booster display|blister|collection|tin|build & battle)/i;
  const unwanted = /(case|code card|sleeve|deck box|playmat|binder|portfolio|dice|coin|jumbo|oversize|bundle of|display)/i;
  for (const p of products) {
    if (isCard(p)) continue;
    let name = p.name.replace(/\[[^\]]*\]?|\([^)]*\)?/g, '').replace(new RegExp(setName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').replace(/pokemon/gi, 'Pokémon').replace(/\s+/g, ' ').trim();
    name = name.replace(/^[-:–\s]+/, '');
    if (!name || !wanted.test(name) || unwanted.test(name)) continue;
    names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b)).slice(0, 14);
}

function energyType(card) {
  const m = /(\w+) Energy$/.exec(card.name);
  const type = m?.[1].toLowerCase();
  return type && pokemon.ENERGY_TYPES[type] ? type : null;
}

const groupIndexes = new Map();

function productGroups(released, refresh) {
  const since = `${Number(released.slice(0, 4)) - 2}${released.slice(4)}`;
  if (!groupIndexes.has(since)) {
    groupIndexes.set(since, (async () => {
      const groups = (await cachedJson('https://tcgcsv.com/tcgplayer/3/groups', { refresh })).results
        .filter((g) => (g.publishedOn || '') >= since || PROMO_GROUP_NAMES.test(g.name));
      const index = new Map();
      for (const g of groups) {
        for (const p of await loadProducts(g.groupId, { refresh })) if (!index.has(p.productId)) index.set(p.productId, g.groupId);
      }
      return index;
    })());
  }
  return groupIndexes.get(since);
}

const isPlain = (v) => (v.type === 'normal' || v.type === 'holo') && !v.foil && !v.stamp?.length;

function specialPrints(card) {
  const prints = (card.variants_detailed || []).filter((v) => (v.size || 'standard') === 'standard');
  const base = prints.find(isPlain) || prints.find((v) => v.type !== 'reverse');
  const seen = new Set();
  const out = [];
  for (const v of prints) {
    if (v === base || isPlain(v)) continue;
    if (v.type === 'reverse' && !v.stamp?.length && (!v.foil || BOOSTER_FOILS.has(v.foil))) continue;
    if (v.type === 'holo' && v.foil === 'gold' && !v.stamp?.length) continue;
    if (v.stamp?.some((s) => AWARD_STAMPS.has(s))) continue;
    const key = [v.type === 'holo' ? null : v.type, v.foil, ...(v.stamp || [])].filter(Boolean).join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, print: v });
  }
  return out;
}

function describePrint(v) {
  const type = PRINT_TYPES[v.type];
  const foil = v.foil ? FOILS[v.foil] || [titleCase(v.foil), ''] : null;
  const stamps = (v.stamp || []).map((s) => STAMPS[s] || [titleCase(s), '']);
  const finish = foil
    ? (v.type === 'reverse' && !BOOSTER_FOILS.has(v.foil) ? `Reverse ${foil[0]}` : foil[0])
    : v.type === 'reverse' ? 'Reverse Holo' : null;
  const label = [type?.[0], finish, ...stamps.map((s) => s[0])].filter(Boolean).join(' · ') || titleCase(v.type);
  const note = stamps.map((s) => s[1]).find(Boolean) || foil?.[1] || type?.[1] || '';
  return { label, note };
}

export async function generateCollection(entry, { refresh = false } = {}) {
  process.stdout.write(`${entry.id}: TCGdex ${entry.tcgdex}`);
  const { set, cards: dex } = await loadSetCards(entry.tcgdex, {
    refresh,
    onProgress: (done, total) => {
      if (done % 50 === 0 || done === total) process.stdout.write(` ${done}/${total}`);
    },
  });
  process.stdout.write('\n');
  const kind = entry.kind || 'expansion';
  const name = entry.name || set.name;
  const printedTotal = kind === 'expansion' ? set.cardCount.official : null;
  const code = entry.syncKey;
  const released = set.releaseDate;

  const products = (await Promise.all(entry.tcgplayer.map((g) => loadProducts(g, { refresh })))).flat();
  const prices = (await Promise.all(entry.tcgplayer.map((g) => loadPrices(g)))).flat();
  const reverseProducts = new Set(prices.filter((p) => p.subTypeName === 'Reverse Holofoil').map((p) => p.productId));
  const groupOf = await productGroups(released, refresh);
  const base = new Map();
  const patterns = new Map();
  const others = new Map();
  for (const p of products.filter(isCard)) {
    const key = numberKey(productNumber(p));
    const suffix = suffixOf(p.name);
    const variant = suffix && VARIANT_BY_SUFFIX.get(suffix.toLowerCase());
    if (!suffix || /^\d+\/\d+$/.test(suffix)) {
      if (!base.has(key)) base.set(key, p);
    } else if (variant) {
      if (!patterns.has(key)) patterns.set(key, []);
      patterns.get(key).push({ variant, product: p });
    } else {
      if (!others.has(key)) others.set(key, []);
      others.get(key).push({ suffix, product: p });
    }
  }
  for (const [key, list] of others) if (!base.has(key)) base.set(key, list[0].product);

  const cards = [];
  const unknownRarities = new Set();
  const usedVariants = new Set();
  const unmatched = [];
  for (const d of dex.sort((a, b) => Number(a.localId) - Number(b.localId) || String(a.localId).localeCompare(String(b.localId)))) {
    const localId = /^\d+$/.test(d.localId) ? pad(d.localId) : d.localId;
    const key = numberKey(d.localId);
    const product = base.get(key);
    if (!product) unmatched.push(localId);
    let rarity;
    let type = null;
    if (kind === 'promo') rarity = 'P';
    else if (kind === 'energy' || (d.category === 'Energy' && d.energyType === 'Normal')) {
      type = energyType(d);
      rarity = type ? 'E' : pokemon.rarityFromName(d.rarity);
    } else {
      rarity = pokemon.rarityFromName(d.rarity) || pokemon.rarityFromName(product && productRarity(product));
    }
    if (!rarity) {
      unknownRarities.add(`${d.rarity} / ${product ? productRarity(product) : '-'}`);
      continue;
    }
    const cardName = type && d.energyType === 'Normal' && !d.name.startsWith('Basic ') ? `Basic ${d.name}` : d.name;
    const n = Number(d.localId);
    const printed = kind === 'expansion' ? `${localId}/${pad(printedTotal)}` : kind === 'promo' ? `${code} ${localId}` : localId;
    const section = kind === 'expansion' ? (n <= printedTotal ? 'main' : 'secret') : 'main';
    const card = { id: localId, section, num: localId, printed, code: String(Number.isFinite(n) ? n : localId), name: cardName, rarity };
    if (type) card.type = type;
    if (product) card.tcg = product.productId;
    cards.push(card);

    const versions = [];
    if (kind !== 'promo' && product && reverseProducts.has(product.productId)) versions.push({ variant: VARIANTS[0], product, sub: 'Reverse Holofoil' });
    for (const { variant, product: p } of kind === 'promo' ? [] : patterns.get(key) || []) {
      if (!versions.some((v) => v.variant === variant)) versions.push({ variant, product: p });
    }
    for (const { variant, product: p, sub } of versions) {
      usedVariants.add(variant);
      const v = {
        id: `${localId}-${variant.key}`, section: variant.section, num: localId, printed, code: `${variant.code}${card.code}`,
        name: cardName, rarity, img: localId, badge: variant.label, variant: variant.label, foil: true, tcg: p.productId,
      };
      if (sub) v.sub = sub;
      if (type) v.type = type;
      cards.push(v);
    }

    const specials = [];
    for (const { key: printKey, print } of specialPrints(d)) {
      const { label, note } = describePrint(print);
      const special = {
        id: `${localId}-${printKey}`, section: 'special', num: localId, printed, code: '', name: cardName, rarity, img: localId,
        badge: label, variant: label, foil: print.type !== 'normal' || Boolean(print.foil),
      };
      if (note) special.note = note;
      if (type) special.type = type;
      special.kinds = [print.type, print.foil, ...(print.stamp || [])].filter(Boolean);
      const tcg = print.thirdParty?.tcgplayer;
      if (tcg && tcg !== product?.productId) {
        special.tcg = tcg;
        const group = groupOf.get(tcg);
        if (group && !entry.tcgplayer.includes(group)) special.grp = group;
      }
      specials.push(special);
    }
    for (const { suffix, product: p } of others.get(key) || []) {
      if (p === product || specials.some((s) => s.tcg === p.productId) || AWARD_SUFFIX.test(suffix) || LEFT_OUT_SUFFIX.test(suffix)) continue;
      const [kind, label, note] = suffixKind(suffix);
      const listed = specials.find((s) => s.kinds.includes(kind) || (kind === 'prerelease' && s.kinds.includes('set-logo')));
      if (listed) {
        if (!listed.tcg) listed.tcg = p.productId;
        continue;
      }
      const special = {
        id: `${localId}-${kind}`, section: 'special', num: localId, printed, code: '', name: cardName, rarity, img: localId,
        badge: label, variant: label, foil: true, tcg: p.productId, kinds: [kind],
      };
      if (note) special.note = note;
      if (type) special.type = type;
      specials.push(special);
    }
    for (const special of specials) {
      delete special.kinds;
      cards.push(special);
    }
  }
  if (unknownRarities.size) throw new Error(`${entry.id}: unknown rarities ${[...unknownRarities].join(', ')}. Add them to js/games/pokemon.js.`);
  if (unmatched.length) console.warn(`  no TCGplayer product for ${unmatched.length} card(s): ${unmatched.slice(0, 12).join(', ')}${unmatched.length > 12 ? '…' : ''}`);

  const count = (section) => cards.filter((c) => c.section === section).length;
  const variants = VARIANTS.filter((v) => usedVariants.has(v));
  const sections = [];
  if (kind === 'expansion') {
    sections.push({ id: 'main', name: 'Main Set', range: `001–${pad(printedTotal)}`, tier: 'standard' });
    if (count('secret')) sections.push({ id: 'secret', name: 'Secret Rares', range: `${pad(printedTotal + 1)}–${pad(set.cardCount.total)}`, tier: 'complete' });
  } else if (kind === 'promo') {
    const numbered = cards.filter((c) => c.section === 'main' && /^\d+$/.test(c.num));
    let end = 0;
    while (end + 1 < numbered.length && Number(numbered[end + 1].num) - Number(numbered[end].num) <= 50) end++;
    const extras = count('main') - (end + 1);
    sections.push({
      id: 'main', name: 'Black Star Promos', range: `${code} ${numbered[0]?.num}–${numbered[end]?.num}${extras ? ` + ${extras} more` : ''}`, tier: 'standard',
      display: { number: '{printed}', label: '{printed}', list: '{printed} {name}', chip: '{printed} {name}', search: 'Pokemon {name} {printed} promo' },
    });
  } else {
    sections.push({ id: 'main', name: 'Basic Energy', range: `${plural(count('main'), 'card')}`, tier: 'standard', display: { number: 'No. {num}' } });
  }
  for (const v of variants) {
    sections.push({ id: v.section, name: v.name, short: v.label === 'Reverse Holo' ? 'Reverse Holos' : v.label, range: plural(count(v.section), 'card'), tier: 'master' });
  }
  const specialCount = count('special');
  if (specialCount) {
    const display = kind === 'promo' ? { number: '{printed}', label: '{printed}', list: '{printed} {name}', chip: '{printed} {name}', search: 'Pokemon {name} {printed} {badge}' } : { search: 'Pokemon {set} {name} {printed} {badge}' };
    sections.push({ id: 'special', name: 'Special Prints', short: 'Special Prints', range: 'stamps, Cosmos Holos & more', tier: 'grand', display });
  }

  const mainCount = count('main');
  const secretCount = count('secret');
  const all = mainCount + secretCount;
  const variantCount = cards.length - all - specialCount;
  const variantNames = variants.map((v) => v.lower);
  const specialText = `${plural(specialCount, 'special print')} (stamped, Cosmos Holo and other product-exclusive cards)`;

  const info = { packSections: [], sectionText: {} };
  if (kind === 'expansion') {
    info.packSections = sections.map((s) => s.id).filter((id) => id !== 'special');
    info.packText = `<p><b>${name} booster packs.</b></p>`;
    info.packProducts = packProducts(products, name);
    for (const v of variants) {
      info.sectionText[v.section] = [`<p><b>${v.text}</b>, from ${name} booster packs.${v.extra ? ` ${v.extra}` : ''}</p>`];
    }
  } else if (kind === 'promo') {
    info.sectionText.main = ['<p><b>Black Star Promo.</b> Promos come in special products such as collection boxes, tins, blisters and Elite Trainer Boxes, and some are given out at events.</p>'];
  } else {
    info.sectionText.main = ['<p><b>Basic Energy.</b> These come in Elite Trainer Boxes, theme decks and other products.</p>'];
    for (const v of variants) info.sectionText[v.section] = [`<p><b>${v.text}</b> Basic Energy.</p>`];
  }

  const tierParts = kind === 'expansion'
    ? [['Standard', `is the ${mainCount} main set cards`], ['Complete', `is all ${all} cards`]]
    : [[variantCount ? 'Standard' : 'Master', `is the ${mainCount} ${kind === 'promo' ? 'promos' : 'cards'}`]];
  if (variantCount) tierParts.push(['Master', `adds the ${variantCount} ${list(variantNames)}`]);
  if (specialCount) tierParts.push(['Grand Master', `adds the ${specialText}`]);
  const tierHelp = tierParts.length > 1
    ? `<b>${tierParts.slice(0, -1).map(([label]) => label).join(', ')} or ${tierParts.at(-1)[0]}:</b> pick what you’re collecting above the cards. ${list(tierParts.map(([label, text]) => `${label} ${text}`))}. Cards you’ve marked are kept when you switch.`
    : null;
  const variantCodes = variants.map((v) => `<b>${v.code}12</b> is card 12’s ${v.label === 'Reverse Holo' ? 'reverse holo' : `${v.label} version`}`);
  const quickAdd = {
    placeholder: `e.g. 1-22, 55, ${variants.length ? `${variants[0].code}12, ` : ''}60x2`,
    example: `1-22, 55x2${variants.length ? `, ${variants[0].code}12` : ''}`,
    hint: `Separate with commas or spaces. <b>1-22</b> is a range and <b>55x2</b> is two copies.${variantCodes.length ? ` ${list(variantCodes)}, and ranges work too (<b>${variants[0].code}1-${variants[0].code}20</b>).` : ''}${specialCount ? ' Special prints are marked by tapping them.' : ''}`,
    empty: kind === 'expansion'
      ? `Main set cards are 1–${printedTotal}${secretCount ? ` (secret rares start at ${printedTotal + 1})` : ''}.`
      : `Cards are numbered 1–${Math.max(...cards.map((c) => Number(c.num) || 0))}.`,
  };
  const summary = [
    ...(kind === 'expansion' ? [['main', 'Main set'], ['secret', 'Secret rares']] : [['main', kind === 'promo' ? 'Promos' : 'Energy']]),
    ...variants.map((v) => [v.section, v.lower.charAt(0).toUpperCase() + v.lower.slice(1)]),
    ...(specialCount ? [['special', 'Special prints']] : []),
  ];

  const game = pokemon.name;
  const releasedText = DATE.format(new Date(`${released}T00:00:00Z`));
  const extraSentence = [variantCount && `every ${list(variantNames)}`, specialCount && 'every special print'].filter(Boolean);
  const seo = kind === 'expansion' ? {
    title: `${game} ${name} Checklist · All ${all} Cards`,
    description: `Free checklist for the ${game} ${name} set. Track all ${all} cards${extraSentence.length ? `, or go further with ${list(extraSentence)}` : ''}, with images, copy counts, binder pages and prices. No sign-up needed.`,
    ogTitle: `${game} ${name} Checklist`,
    ogDescription: `Track all ${all} cards in ${game} ${name}: the ${mainCount}-card main set and ${plural(secretCount, 'secret rare')}${variantCount ? `, plus ${variantCount} ${list(variantNames)} for a master set` : ''}${specialCount ? ` and ${plural(specialCount, 'special print')} for a grand master set` : ''}. Free, no sign-up, works offline.`,
    twitterDescription: `Track all ${all} cards in ${game} ${name}. Free, no sign-up, works offline.`,
  } : {
    title: `${game} ${name} Checklist · All ${all} Cards`,
    description: `Free checklist for the ${all} ${game} ${name}${specialCount ? ` and their ${plural(specialCount, 'special print')}` : ''}, with images, copy counts, binder pages and prices. No sign-up needed.`,
    ogTitle: `${game} ${name} Checklist`,
    ogDescription: `Track all ${all} ${game} ${name}. Free, no sign-up, works offline.`,
  };
  const choices = [`the <b>Standard set</b> (the ${mainCount} main set cards)`, `the <b>Complete set</b> (all ${all} cards)`];
  if (variantCount) choices.push(`the <b>Master set</b> (${all + variantCount} cards, adding every ${list(variantNames)})`);
  if (specialCount) choices.push(`the <b>Grand Master set</b> (${all + variantCount + specialCount} cards, adding the ${specialText})`);
  const about = kind === 'expansion' ? {
    title: `About the ${name} set`,
    paragraphs: [
      `${game}: ${name} is a ${entry.series} expansion released on ${releasedText}. It has ${all} cards: ${mainCount} in the main set and ${plural(secretCount, 'secret rare')}${variantCount ? `. For a master set there are also ${variantCount} ${list(variantNames)}` : ''}${specialCount ? `, and ${plural(specialCount, 'special print')} from other products and events` : ''}.`,
      `Choose what you’re collecting: ${choices.slice(0, -1).join(', ')} or ${choices.at(-1)}.`,
      'This free checklist lets you tick off the cards you own, count spare copies for trading, see your progress by rarity and plan your binder pages. It works on phones and computers, even offline, and your collection stays on your device.',
    ],
  } : {
    title: `About the ${name}`,
    paragraphs: [
      kind === 'promo'
        ? `The ${name} are the ${all} numbered promo cards of the ${entry.series} era, from collection boxes, tins, blisters, Elite Trainer Boxes and events.${specialCount ? ` For a grand master set there are also ${specialText}.` : ''}`
        : `The ${name} are the ${all} Basic Energy cards printed for the ${entry.series} era.${specialCount ? ` For a grand master set there are also ${specialText}.` : ''}`,
      'This free checklist lets you tick off the cards you own, count spare copies for trading and plan your binder pages. It works on phones and computers, even offline, and your collection stays on your device.',
    ],
  };

  return {
    id: entry.id,
    game: 'pokemon',
    slug: entry.slug,
    name,
    series: entry.series,
    kind,
    code,
    syncKey: entry.syncKey,
    released,
    printedTotal,
    defaultTier: 'complete',
    sections,
    summary,
    quickAdd,
    ...(tierHelp ? { help: { tiers: tierHelp } } : {}),
    info,
    seo,
    about,
    source: { tcgdex: entry.tcgdex, tcgplayer: entry.tcgplayer, serie: set.serie?.id || null },
    cards,
  };
}
