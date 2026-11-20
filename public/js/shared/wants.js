import { loadCatalog, entryById } from '../core/catalog.js';
import { fetchCollection, fetchWants } from '../core/collection.js';
import { linkedBackend } from '../core/linked-backend.js';
import * as storage from '../core/storage.js';
import { WANTS_LIMIT, cardsIn, chunkLines, wantsBlocks } from '../core/wants.js';
import { openDialog, toast, copyText } from './ui.js';
import { el, icon } from './dom.js';
import { plural } from './format.js';
import { paintSetChips } from './set-chips.js';

const dlg = document.getElementById('dlg-wants');
const field = (name) => dlg.querySelector(`[data-wl="${name}"]`);

let currentId = null;
let page = null;
let catalog = null;
let started = null;
let scope = 'all';
let chosen = new Set();
let result = null;
let failed = false;
let buildRun = 0;

const nameOf = (id) => entryById(catalog, id)?.name || id;

function selectedIds() {
  if (scope === 'set') return page ? [] : [currentId];
  if (!started) return null;
  if (scope === 'choose') return started.filter((id) => chosen.has(id));
  return started;
}

function emptyText(ids) {
  if (scope === 'set' || !started) return '';
  if (!started.length) return 'You haven’t marked any cards yet. Open a set to make a wants list for it.';
  return ids.length ? '' : 'Choose at least one set.';
}

function toggle(ids, on) {
  for (const id of ids) {
    if (on) chosen.add(id);
    else chosen.delete(id);
  }
  build();
}

function whatText() {
  if (scope === 'all') return 'your collection';
  return result.names.length === 1 ? result.names[0] : plural(result.names.length, 'set', 'sets');
}

async function copyLines(lines, box, label) {
  const ok = await copyText(lines.join('\n'));
  if (!ok) box.select();
  toast(ok ? `${label} copied. Paste them into Add Deck List on Cardmarket.` : 'Select the list and copy it manually.', { icon: 'i-copy' });
}

function copyArea(lines, { label, copied }) {
  const box = el('textarea', { class: 'textarea wl-list', rows: String(Math.min(8, Math.max(3, lines.length))), readonly: true, wrap: 'off', spellcheck: 'false', 'aria-label': label });
  box.value = lines.join('\n');
  box.addEventListener('focus', () => box.select());
  return [
    box,
    el('div', { class: 'xp-actions' },
      el('button', { type: 'button', class: 'btn btn--primary', onclick: () => copyLines(lines, box, copied) }, icon('i-copy'), 'Copy')),
  ];
}

function listBlock({ title, hint, lines }) {
  const parts = chunkLines(lines);
  const count = plural(cardsIn(lines), 'card', 'cards');
  const split = parts.length > 1
    ? ` A wants list holds up to ${WANTS_LIMIT} cards, so this is in ${parts.length} parts: paste each part into its own wants list.`
    : '';
  return el('section', { class: 'wl-block' },
    el('div', { class: 'wl-block__head' },
      el('h4', { class: 'wl-block__title', text: title }),
      el('span', { class: 'wl-block__count', text: count })),
    el('p', { class: 'hint hint--small', text: hint + split }),
    ...(parts.length === 1
      ? copyArea(lines, { label: title, copied: count })
      : parts.flatMap((part, i) => {
        const name = `Part ${i + 1} of ${parts.length}`;
        const partCount = plural(cardsIn(part), 'card', 'cards');
        return [
          el('div', { class: 'wl-part' },
            el('span', { class: 'wl-part__title', text: name }),
            el('span', { class: 'wl-block__count', text: partCount })),
          ...copyArea(part, { label: `${title}, ${name}`, copied: `${name}, ${partCount},` }),
        ];
      })));
}

function handBlock(hand, { manySets }) {
  const links = hand.map(({ card, setName, href }) => el('li', {},
    el('a', { href, target: '_blank', rel: 'noopener' },
      el('span', { class: 'wl-links__name', text: card.name }),
      el('small', { text: [card.printed || card.num, card.variant, manySets && setName].filter(Boolean).join(' · ') }))));
  return el('details', { class: 'wl-hand' },
    el('summary', {},
      el('span', { class: 'wl-block__title', text: 'Add these by hand' }),
      el('span', { class: 'wl-block__count', text: plural(hand.length, 'card', 'cards') })),
    el('p', { class: 'hint hint--small', text: 'Cardmarket can’t pick these from a pasted list. Most are special versions of a card, like Illustration Rares, or come from a set Cardmarket names differently. Open each one and add it to your wants list from its page.' }),
    el('ul', { class: 'wl-links' }, ...links));
}

function gameSection(g, { titled, manySets }) {
  const label = g.foilLabel || 'Foil';
  return el('section', { class: 'wl-game' },
    titled && el('h3', { class: 'wl-game__title', text: g.game.name }),
    g.paste.length > 0 && listBlock({
      title: 'Paste into a wants list',
      hint: 'Each line lands on the exact card, in the right set.',
      lines: g.paste,
    }),
    g.foil.length > 0 && listBlock({
      title: `${label}s`,
      hint: `Paste these into a separate wants list, then tick them all, choose Modify Selected and set ${label}.`,
      lines: g.foil,
    }),
    g.hand.length > 0 && handBlock(g.hand, { manySets }));
}

function paint() {
  for (const b of dlg.querySelectorAll('[data-wl-scope]')) b.setAttribute('aria-pressed', String(b.dataset.wlScope === scope));
  const chips = field('sets');
  chips.hidden = scope !== 'choose' || !started?.length;
  if (!chips.hidden) paintSetChips(chips, { catalog, ids: started, chosen, nameOf, onToggle: toggle });

  const ids = selectedIds();
  const empty = ids ? emptyText(ids) : '';
  const missing = result ? result.games.reduce((n, g) => n + g.missing, 0) : 0;
  let status = '';
  if (empty) status = empty;
  else if (failed) status = 'Couldn’t get your cards ready. Check your connection and try again.';
  else if (!result) status = 'Getting your missing cards ready…';
  else if (!missing) status = `You have every card in ${whatText()}. Nothing to add.`;
  field('status').textContent = status;
  field('summary').textContent = result && missing && !empty ? `${scope === 'all' ? 'Whole collection' : whatText()} · ${plural(missing, 'missing card', 'missing cards')}` : '';
  const games = result && !empty ? result.games.filter((g) => g.missing) : [];
  field('games').replaceChildren(...games.map((g) => gameSection(g, { titled: games.length > 1, manySets: result.manySets })));
}

async function pageSet() {
  const { model } = page;
  const counts = page.counts();
  const tier = page.tier();
  const homes = [...new Set(tier.cards.filter((c) => !counts[c.id]).map((c) => c.s))];
  const found = await Promise.all(homes.map((s) => fetchWants(model.viewSets[s].id)));
  const bySet = new Map(homes.map((s, i) => [s, found[i]?.lines || {}]));
  const lines = {};
  for (const card of tier.cards) {
    const line = bySet.get(card.s)?.[card.c];
    if (line) lines[card.id] = line;
  }
  return { model, counts, tier, lines };
}

async function build() {
  const run = ++buildRun;
  result = null;
  failed = false;
  paint();
  const ids = selectedIds();
  if (!ids || emptyText(ids)) return;
  const { tiers = {} } = storage.getPrefs();
  let sets;
  try {
    sets = scope === 'set' && page ? [await pageSet()] : await Promise.all(ids.map(async (id) => {
      const [model, wants] = await Promise.all([fetchCollection(id, { links: true }), fetchWants(id)]);
      const counts = model.linkedSets?.length ? linkedBackend(model).load() : storage.readCounts(id);
      return { model, counts, tier: model.getTier(tiers[id]), lines: wants?.lines || null };
    }));
  } catch {
    if (run !== buildRun) return;
    failed = true;
    paint();
    return;
  }
  if (run !== buildRun) return;
  result = { names: sets.map((s) => s.model.name), manySets: sets.length > 1 || Boolean(page && scope === 'set'), games: wantsBlocks(sets) };
  paint();
}

export function openWants() {
  const here = Boolean(currentId || page);
  scope = here ? 'set' : 'all';
  for (const b of dlg.querySelectorAll('[data-wl-scope="set"]')) b.hidden = !here;
  openDialog(dlg);
  loadCatalog().then((c) => {
    catalog = c;
    const order = new Map(c.collections.map((x, i) => [x.id, i]));
    const ids = new Set(storage.storedCollections().map(({ id }) => id));
    if (currentId) ids.add(currentId);
    started = [...ids].filter((id) => order.has(id)).sort((a, b) => order.get(a) - order.get(b));
    chosen = new Set(currentId ? [currentId] : started);
    if (scope === 'set') paint();
    else build();
  }, () => {
    field('status').textContent = 'Couldn’t load the list of sets. Check your connection and try again.';
  });
  build();
}

export function initWants({ currentId: id = null, page: source = null } = {}) {
  currentId = id;
  page = source;
  if (page) for (const b of dlg.querySelectorAll('[data-wl-scope="set"]')) b.textContent = 'This page';
  dlg.addEventListener('click', (e) => {
    const scopeBtn = e.target.closest('[data-wl-scope]');
    if (scopeBtn && scopeBtn.dataset.wlScope !== scope) {
      scope = scopeBtn.dataset.wlScope;
      build();
    }
  });
}
