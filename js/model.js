export const TIER_DEFS = [
  { id: 'standard', name: 'Standard Set', label: 'Standard' },
  { id: 'complete', name: 'Complete Set', label: 'Complete' },
  { id: 'master', name: 'Master Set', label: 'Master' },
  { id: 'grand', name: 'Grand Master Set', label: 'Grand Master' },
];
const TIER_RANK = new Map(TIER_DEFS.map((t, i) => [t.id, i]));

export const normalize = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[‘’]/g, "'").toLowerCase();

const fill = (template, fields) => template.replace(/\{(\w+)\}/g, (_, key) => fields[key] ?? '');

const capitalise = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;

function matcher(match = {}) {
  const sections = match.section && new Set([].concat(match.section));
  const rarities = match.rarity && new Set([].concat(match.rarity));
  return (card) => (!sections || sections.has(card.section)) && (!rarities || rarities.has(card.rarity));
}

function tierVisibility(tiers) {
  const [standard, complete, master, grand] = tiers;
  const n = (t) => t.cards.length;
  master.visible = true;
  standard.visible = n(standard) > 0 && n(standard) !== n(master);
  complete.visible = n(complete) !== n(standard) && n(complete) !== n(master);
  grand.visible = n(grand) !== n(master);
  for (const t of tiers) t.as = t.visible ? t : tiers.find((v) => v.visible && n(v) === n(t)) || master;
}

export function buildCollection(raw, { game, colors = {}, imageBase = '', logo = null }) {
  const rarityById = new Map(game.RARITIES.map((r) => [r.id, r]));
  for (const r of raw.rarities || []) rarityById.set(r.id, { ...rarityById.get(r.id), ...r });
  const display = { ...game.DISPLAY, ...raw.display };
  const sections = raw.sections.map((s) => ({ ...s, display: { ...display, ...s.display } }));
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const searchAliases = raw.searchAliases || {};

  const rawById = new Map(raw.cards.map((c) => [c.id, c]));
  const cards = raw.cards.map((c) => {
    const section = sectionById.get(c.section);
    const rarity = rarityById.get(c.rarity);
    if (!section) throw new Error(`${raw.id}: card ${c.id} is in unknown section "${c.section}"`);
    if (!rarity) throw new Error(`${raw.id}: card ${c.id} has unknown rarity "${c.rarity}"`);
    const base = c.base ? rawById.get(c.base) : null;
    const fields = {
      num: c.num, printed: c.printed, code: c.code, name: c.name, badge: c.badge || '', set: raw.name,
      baseName: base?.name || '', basePrinted: base?.printed || '',
    };
    const fmt = { ...section.display, ...c.display };
    const typed = rarity.typed && c.type;
    const words = [
      c.num, /^\d+$/.test(c.num) ? String(Number(c.num)) : '', c.code, c.printed, c.name,
      searchAliases[c.name] || '', rarity.name, c.rarity, section.name, c.note || '', c.keywords || '',
    ];
    if (c.variant) words.push(c.variant);
    return {
      ...c,
      imageId: c.img || c.id,
      rarityName: typed ? `${capitalise(c.type)} Energy` : rarity.name,
      rarityShort: `${rarity.short || rarity.name}${c.variant ? ` · ${c.variant}` : ''}`,
      rarityIcon: typed ? `e-${c.type}` : rarity.icon,
      wide: !typed && Boolean(rarity.wide),
      foil: c.foil ?? Boolean(rarity.foil),
      label: `${fill(fmt.label, fields)} ${c.name}, ${rarity.name}${c.variant ? `, ${c.variant}` : ''}`,
      numberText: fill(fmt.number, fields),
      listText: fill(fmt.list, fields),
      chipText: fill(fmt.chip, fields),
      pocketText: fill(fmt.pocket, fields),
      searchQuery: fill(fmt.search, fields),
      search: ` ${normalize(words.join(' ')).replace(/[()]/g, ' ')} `,
    };
  });
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const ids = new Set();
  for (const c of cards) {
    if (ids.has(c.id)) throw new Error(`${raw.id}: duplicate card id ${c.id}`);
    ids.add(c.id);
  }

  const usedRarities = new Set(cards.map((c) => c.rarity));
  const rarities = [...rarityById.values()].filter((r) => usedRarities.has(r.id))
    .sort((a, b) => (a.last || 0) - (b.last || 0) || a.rank - b.rank);

  const tiers = TIER_DEFS.map((def, rank) => {
    const tierSections = sections.filter((s) => TIER_RANK.get(s.tier) <= rank);
    const sectionIds = new Set(tierSections.map((s) => s.id));
    return { ...def, rank, sections: tierSections, sectionIds, cards: cards.filter((c) => sectionIds.has(c.section)) };
  });
  tierVisibility(tiers);
  const visibleTiers = tiers.filter((t) => t.visible);
  const single = visibleTiers.length === 1;
  if (single) Object.assign(visibleTiers[0], { name: 'Set', label: 'All cards' });
  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const defaultTier = (tierById.get(raw.defaultTier) || tierById.get('complete')).as.id;
  const getTier = (id) => (tierById.get(id) || tierById.get(defaultTier)).as;

  const groups = (raw.groups || sections.map((s) => ({ id: s.id, name: s.name, match: { section: s.id } })))
    .filter((g) => g.id !== 'set')
    .concat({ id: 'set', name: 'Set' })
    .map((g) => ({ ...g, test: matcher(g.match) }));
  const jumps = raw.jumps || sections.map((s) => ({ id: s.id, label: s.short || s.name }));

  const codes = new Map();
  for (const c of cards) if (c.code) codes.set(c.code.toUpperCase(), c.id);
  const sparseCodes = new Set(cards.filter((c) => c.variant && c.code).map((c) => c.code.replace(/\d+$/, '').toUpperCase()));

  const tiles = new Map();
  for (const r of rarities) if (r.tile) tiles.set(`[data-rarity="${r.id}"]`, r.tile);
  for (const c of cards) {
    const type = c.type && game.ENERGY_TYPES?.[c.type];
    if (type?.tile) tiles.set(`[data-type="${c.type}"]`, type.tile);
  }

  return {
    ...raw,
    game,
    sections,
    sectionById,
    rarities,
    rarityById,
    cards,
    cardById,
    cardsBySection: new Map(sections.map((s) => [s.id, cards.filter((c) => c.section === s.id)])),
    tiers,
    visibleTiers,
    single,
    defaultTier,
    getTier,
    inTier: (card, tierId) => getTier(tierId).sectionIds.has(card.section),
    lowestTier: (sectionId) => visibleTiers.find((t) => t.sectionIds.has(sectionId)),
    groups,
    jumps,
    codes,
    sparseCodes,
    quickAdd: raw.quickAdd || {},
    info: raw.info || {},
    maxIdx: cards.reduce((m, c) => Math.max(m, c.idx), -1),
    tileRules: [...tiles].map(([selector, tile]) => `.card${selector}{--tile:${tile}}`).join(''),
    logoUrl: logo,
    hasImage: (card) => Object.hasOwn(colors, card.imageId),
    imageColor: (card, fallback = '#6a6f8f') => colors[card.imageId] || fallback,
    imageUrl: (card, size = 'sm') => `${imageBase}/${size}/${card.imageId}.webp`,
  };
}
