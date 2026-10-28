import { openDialog, closeDialog, vibrate } from '../shared/ui.js';
import { asset } from '../core/paths.js';
import { loadCatalog, entryById } from '../core/catalog.js';
import { GAMES, fetchCollection, fetchPrices } from '../core/collection.js';
import { formatMoney, formatUsd, ratesOf, shownCurrency } from '../core/pricing.js';
import * as storage from '../core/storage.js';
import { codeKey, findCode, loadMatcher, match, search } from './scan-match.js';
import { el, icon } from '../shared/dom.js';
import { cameraSupported, getCamera, stopTracks, cameraBlocked } from '../shared/camera.js';
import { plural } from '../shared/format.js';

const REGULAR = 'Regular';
const SIDES = [
  { side: 'give', label: 'I give', doing: 'Giving', iconId: 'i-upload' },
  { side: 'get', label: 'I get', doing: 'Getting', iconId: 'i-download' },
];

const dlg = document.getElementById('dlg-scan');
const $ = (name) => dlg.querySelector(`[data-scan="${name}"]`);
const video = $('video');
const guide = $('guide');
const status = $('status');
const shutter = $('shutter');
const panel = $('panel');
const controls = dlg.querySelector('.scanner__controls');
const fileInput = $('file');
const tallyBtn = $('tally');
const flashBox = $('flash');
const live = $('live');
const scopeBox = $('scope');
const heading = dlg.querySelector('.scanner__title');

let options = {};
let game = null;
let stream = null;
let starting = false;
let matcher = null;
let catalog = null;
let busy = false;
let lastVariant = REGULAR;
let view = null;
let flashTimer = 0;
let lastShot = null;
const session = [];

const setInfo = (id) => entryById(catalog, id) || { id, name: id };
const gameRules = () => GAMES[game] || {};
const familyOf = (id) => gameRules().familyOf?.(id) ?? id;
const cardAspect = () => gameRules().CARD_ASPECT || 63 / 88;
const scoped = () => Boolean(options.prefer) && storage.getPrefs().scanScope !== 'all';
const within = () => (scoped() ? (set) => familyOf(set) === familyOf(options.prefer) : null);
const scopeName = () => entryById(catalog, familyOf(options.prefer))?.name || 'This set';

function paintScope() {
  for (const b of dlg.querySelectorAll('[data-scope]')) b.setAttribute('aria-pressed', String((b.dataset.scope === 'set') === scoped()));
}

function scopeToggle(onChange) {
  return el('div', { class: 'seg scan-scope', role: 'group', 'aria-label': 'Where to look' }, ...[['set', scopeName()], ['all', 'All sets']].map(([value, label]) => el('button', {
    type: 'button',
    class: 'seg__btn',
    'data-scope': value,
    onclick() {
      storage.setPref('scanScope', value);
      paintScope();
      onChange?.();
    },
  }, el('span', { class: 'scan-scope__label', text: label }))));
}

function renderScope() {
  scopeBox.hidden = !options.prefer;
  if (options.prefer) scopeBox.replaceChildren(scopeToggle());
  paintScope();
}

function setPanel(open) {
  panel.hidden = !open;
  dlg.classList.toggle('has-panel', open);
  controls.inert = open;
  if (open) {
    hideFlash();
    return;
  }
  panel.replaceChildren();
  view = null;
}

function say(text) {
  status.textContent = text;
  status.hidden = !text;
}

function speak(text) {
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = text; });
}

function hideFlash() {
  clearTimeout(flashTimer);
  flashBox.hidden = true;
}

function flash(message, { iconId, undo } = {}) {
  clearTimeout(flashTimer);
  flashBox.replaceChildren(...[
    iconId && icon(iconId),
    el('span', { class: 'scanner__flash-text', text: message }),
    undo && el('button', {
      type: 'button',
      class: 'scanner__flash-undo',
      onclick() {
        hideFlash();
        undo();
      },
    }, 'Undo'),
  ].filter(Boolean));
  flashBox.hidden = false;
  flashTimer = setTimeout(hideFlash, undo ? 6000 : 4000);
}

async function startCamera() {
  if (stream || starting || !dlg.open || !panel.hidden || document.hidden) return;
  if (!cameraSupported()) {
    say('The camera needs the secure (https) version of this site. You can still use Photo.');
    return;
  }
  starting = true;
  try {
    const got = await getCamera();
    if (!dlg.open || document.hidden) {
      stopTracks(got);
      return;
    }
    stream = got;
    video.srcObject = stream;
    await video.play().catch(() => {});
    dlg.classList.add('has-camera');
    ready();
  } catch (err) {
    say(cameraBlocked(err)
      ? 'Camera access is blocked. Allow it in your browser’s site settings, or use Photo.'
      : 'Couldn’t start the camera. You can still use Photo.');
  } finally {
    starting = false;
  }
}

function stopCamera() {
  stopTracks(stream);
  stream = null;
  video.srcObject = null;
  dlg.classList.remove('has-camera');
}

function ready() {
  if (!matcher) return;
  shutter.disabled = !stream;
  if (panel.hidden) say(stream ? 'Fill the frame with the card, then tap the button.' : '');
}

function prepareMatcher() {
  const wanted = game;
  say('Getting the card recogniser ready…');
  shutter.disabled = true;
  loadMatcher(wanted, (p) => {
    if (!matcher && panel.hidden && game === wanted) say(`Downloading the card recogniser (one time only)… ${Math.round(p * 100)}%`);
  }).then((m) => {
    if (game !== wanted) return;
    matcher = m;
    ready();
  }, () => {
    if (game === wanted) say('Couldn’t load the card recogniser. Check your connection, then close and reopen the scanner.');
  });
}

function canvasFor() {
  const canvas = document.createElement('canvas');
  canvas.width = matcher.index.model.width;
  canvas.height = matcher.index.model.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function frameCrop() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const box = video.getBoundingClientRect();
  const g = guide.getBoundingClientRect();
  const scale = Math.max(box.width / vw, box.height / vh);
  const left = box.left + (box.width - vw * scale) / 2;
  const top = box.top + (box.height - vh * scale) / 2;
  const sx = Math.max(0, (g.left - left) / scale);
  const sy = Math.max(0, (g.top - top) / scale);
  return [sx, sy, Math.min(vw - sx, g.width / scale), Math.min(vh - sy, g.height / scale)];
}

function centreCrop(w, h) {
  const aspect = cardAspect();
  const cw = Math.min(w, h * aspect);
  const ch = cw / aspect;
  return [(w - cw) / 2, (h - ch) / 2, cw, ch];
}

async function recognise(source, crop, scope) {
  if (busy || !matcher) return;
  busy = true;
  shutter.disabled = true;
  say('Looking…');
  try {
    const { canvas, ctx } = canvasFor();
    ctx.drawImage(source, ...crop, 0, 0, canvas.width, canvas.height);
    lastShot = canvas;
    const result = await match(matcher, canvas, { prefer: options.prefer, within: scope });
    if (dlg.open) await showMatches(result, Boolean(scope));
  } catch {
    resume();
    flash('Something went wrong. Try again.');
  } finally {
    busy = false;
  }
}

function capture() {
  if (!stream || !video.videoWidth) return;
  video.pause();
  vibrate(8);
  recognise(video, frameCrop(), within());
}

async function fromFile(file) {
  if (!file) return;
  if (!matcher) {
    flash('The card recogniser is still loading. Try again in a moment.');
    return;
  }
  try {
    const bitmap = await createImageBitmap(file);
    await recognise(bitmap, centreCrop(bitmap.width, bitmap.height), within());
    bitmap.close();
  } catch {
    resume();
    flash('Couldn’t read that picture.');
  }
}

function widen() {
  if (lastShot) recognise(lastShot, [0, 0, lastShot.width, lastShot.height], null);
}

function resume() {
  setPanel(false);
  if (stream) video.play().catch(() => {});
  else startCamera();
  ready();
}

function orderCandidates({ candidates, sameArt }) {
  const prefer = options.prefer;
  const twins = [...sameArt].sort((a, b) => (b.set === prefer) - (a.set === prefer));
  return [...twins, ...candidates.filter((c) => !sameArt.includes(c))];
}

async function showMatches(result, narrowed) {
  catalog ||= await loadCatalog().catch(() => null);
  if (!result.candidates.length) {
    resume();
    flash(narrowed ? 'Nothing to compare with in this set. Try all sets, or search.' : 'Couldn’t match that card. Try again, or search.');
    return;
  }
  const list = orderCandidates(result);
  const twins = result.sameArt.length > 1;
  const title = !result.confident
    ? 'Not sure. Is it one of these?'
    : twins
      ? `Same artwork in ${result.sameArt.length} sets`
      : 'Is it this card?';
  const hint = twins && result.confident
    ? 'Check the set code and number at the bottom of your card, then pick the matching set.'
    : result.confident ? ''
      : result.blurry ? 'Looks blurry. Hold the phone a little further back so it can focus, then scan again.'
        : narrowed ? `Only ${scopeName()} cards were checked. Try all sets if it’s from somewhere else, or scan again with less glare.`
          : 'Try again with the card filling the frame and less glare, or search by name.';
  openPanel({ title, hint, list, selected: 0, widen: narrowed && !result.confident });
}

function openPanel(state) {
  view = state;
  setPanel(true);
  say('');
  renderPanel();
}

const versionLabel = (card) => card.variant || (gameRules().VERSION_BY_RARITY ? card.rarityName : REGULAR);
const cardTitle = (card) => (card.variant || gameRules().VERSION_BY_RARITY ? `${card.name} (${versionLabel(card)})` : card.name);

function orderPrintings(candidate) {
  if (!candidate.printings || candidate.order) return candidate;
  const started = new Set(storage.storedCollections().map(({ id }) => id));
  const released = (set) => entryById(catalog, set)?.released || '';
  candidate.order = [...candidate.printings].sort((a, b) => (b.set === options.prefer) - (a.set === options.prefer)
    || started.has(b.set) - started.has(a.set)
    || released(b.set).localeCompare(released(a.set)));
  candidate.pick ??= 0;
  return candidate;
}

const printingOf = (candidate) => (candidate.printings ? orderPrintings(candidate).order[candidate.pick] : null);
const setOf = (candidate) => printingOf(candidate)?.set ?? candidate.set;
const printedOf = (candidate) => printingOf(candidate)?.printed ?? candidate.printed;

function withCode(row, text) {
  const candidate = orderPrintings({ ...row });
  const key = codeKey(text);
  const at = candidate.order ? candidate.order.findIndex((p) => p.codes.includes(key)) : -1;
  if (at >= 0) candidate.pick = at;
  return candidate;
}

async function variantsFor(candidate) {
  const model = await fetchCollection(setOf(candidate));
  const printing = printingOf(candidate);
  if (printing) {
    const base = model.cardById.get(printing.cardId);
    return { model, cards: base ? model.cards.filter((c) => c.printed === base.printed) : [] };
  }
  return { model, cards: model.cards.filter((c) => c.imageId === candidate.imageId) };
}

function printingPicker(state, candidate) {
  const order = candidate.printings ? orderPrintings(candidate).order : [];
  if (order.length < 2) return {};
  const started = new Set(storage.storedCollections().map(({ id }) => id));
  const chosen = order[candidate.pick];
  const shown = state.allPrintings ? [...order] : order.slice(0, 6);
  if (!shown.includes(chosen)) shown.push(chosen);
  const input = el('input', {
    type: 'text', class: 'input scan-printings__code', placeholder: 'Set code on your card, e.g. LOB-EN005', autocomplete: 'off',
    autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'search', 'aria-label': 'Set code on your card',
  });
  input.value = state.code || '';
  input.addEventListener('input', () => {
    state.code = input.value;
    const key = codeKey(input.value);
    if (key.length < 5 || !key.includes('-')) return;
    const at = order.findIndex((p) => p.codes.includes(key));
    if (at >= 0) {
      if (at === candidate.pick) return;
      candidate.pick = at;
    } else {
      const hit = findCode(matcher, key);
      if (!hit) return;
      const other = withCode(hit.row, key);
      state.list = [other, ...state.list.filter((c) => c.imageId !== other.imageId)];
      state.selected = 0;
    }
    state.variant = null;
    state.focusCode = true;
    renderPanel();
  });
  const rows = shown.map((p) => el('button', {
    type: 'button',
    class: 'scan-printing',
    'aria-pressed': String(p === chosen),
    onclick() {
      candidate.pick = order.indexOf(p);
      state.variant = null;
      renderPanel();
    },
  }, el('b', { class: 'scan-printing__code', text: p.printed }),
  el('span', { class: 'scan-printing__set', text: setInfo(p.set).name }),
  p.set === options.prefer ? el('small', { text: 'This set' }) : started.has(p.set) ? el('small', { text: 'You collect it' }) : null));
  const more = shown.length < order.length ? el('button', {
    type: 'button',
    class: 'btn btn--ghost btn--sm',
    onclick() {
      state.allPrintings = true;
      renderPanel();
    },
  }, `Show all ${order.length}`) : null;
  return {
    input,
    node: el('section', { class: 'scan-printings' },
      el('h4', { class: 'scan-printings__title', text: `Which printing? This artwork is in ${order.length} sets` }),
      input,
      el('div', { class: 'scan-printings__list', role: 'group', 'aria-label': 'Printings' }, ...rows),
      more),
  };
}

async function renderPanel() {
  const state = view;
  const candidate = state.list[state.selected];
  const set = setOf(candidate);
  const pickAt = candidate.pick;
  const picks = state.list.length > 1
    ? el('div', { class: 'scan-picks', role: 'group', 'aria-label': 'Possible matches' }, ...state.list.map((c, i) => el('button', {
      type: 'button',
      class: 'scan-pick',
      'aria-pressed': String(i === state.selected),
      onclick() {
        state.selected = i;
        state.variant = null;
        state.allPrintings = false;
        renderPanel();
      },
    }, el('img', { src: c.image, alt: '', loading: 'lazy', decoding: 'async' }),
    el('span', { class: 'scan-pick__name', text: c.name }),
    el('span', { class: 'scan-pick__set', text: `${setInfo(setOf(c)).code || setInfo(setOf(c)).name} · ${printedOf(c)}` }))))
    : null;

  const printings = printingPicker(state, candidate);
  const detail = el('div', { class: 'scan-detail' },
    el('img', { class: 'scan-detail__img', src: candidate.image, alt: '' }),
    el('div', { class: 'scan-detail__text' },
      el('p', { class: 'scan-detail__name', text: candidate.name }),
      el('p', { class: 'scan-detail__set', text: `${setInfo(set).name} · ${printedOf(candidate)}` }),
      el('div', { class: 'scan-detail__variants', 'data-scan': 'variants' }, el('span', { class: 'hint hint--small', text: 'Loading…' })),
      el('p', { class: 'scan-detail__owned', 'data-scan': 'owned' }),
      el('p', { class: 'scan-detail__price', 'data-scan': 'price', hidden: true })));

  const trade = options.trade;
  const add = trade ? null : el('button', { type: 'button', class: 'btn btn--primary', disabled: true, onclick: () => addSelected(add) }, icon('i-plus'), 'Add to collection');
  const sides = trade ? SIDES.map(({ side, label, iconId }) => el('button', { type: 'button', class: 'btn btn--ghost', 'data-side': side, disabled: true, onclick: () => pickSelected(side) }, icon(iconId), label)) : [];
  const wider = state.widen ? el('button', {
    type: 'button',
    class: 'btn btn--ghost',
    onclick() {
      wider.disabled = true;
      widen();
    },
  }, 'Try all sets') : null;
  panel.replaceChildren(el('div', { class: 'scan-panel' },
    el('header', { class: 'scan-panel__head' },
      el('h3', { class: 'scan-panel__title', text: state.title }),
      state.hint ? el('p', { class: 'hint hint--small', text: state.hint }) : null),
    picks,
    detail,
    printings.node || null,
    el('div', { class: 'scan-panel__foot' },
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => openSearch() }, icon('i-search'), 'Search'),
      wider,
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: resume }, 'Scan again'),
      add,
      trade ? el('div', { class: 'scan-trade' }, ...sides) : null)));
  if (state.focusCode && printings.input) {
    state.focusCode = false;
    printings.input.focus();
    printings.input.setSelectionRange(printings.input.value.length, printings.input.value.length);
  }
  speak(`${state.title}. ${candidate.name}, ${setInfo(set).name}, ${printedOf(candidate)}`);

  let found;
  let prices;
  try {
    [found, prices] = await Promise.all([variantsFor(candidate), fetchPrices(set)]);
  } catch {
    if (view !== state) return;
    panel.querySelector('[data-scan="variants"]').replaceChildren(el('span', { class: 'hint hint--small', text: 'Connect to the internet to add cards from this set for the first time.' }));
    return;
  }
  if (view !== state || state.list[state.selected] !== candidate || candidate.pick !== pickAt) return;
  if (!found.cards.length) {
    panel.querySelector('[data-scan="variants"]').replaceChildren(el('span', { class: 'hint hint--small', text: 'This printing isn’t in the checklist any more. Pick another one, or search.' }));
    return;
  }
  const counts = storage.readCounts(set);
  const labelOf = versionLabel;
  if (!state.variant || !found.cards.some((c) => c.id === state.variant)) {
    state.variant = (found.cards.find((c) => labelOf(c) === lastVariant) || found.cards.find((c) => !c.variant) || found.cards[0]).id;
  }
  const box = panel.querySelector('[data-scan="variants"]');
  const owned = panel.querySelector('[data-scan="owned"]');
  const price = panel.querySelector('[data-scan="price"]');
  const paint = () => {
    const card = found.model.cardById.get(state.variant);
    const n = counts[card.id] || 0;
    const which = found.cards.length > 1 ? `the ${labelOf(card)} version` : 'this card';
    if (trade) {
      const ctx = { set, card, model: found.model };
      owned.replaceChildren(...trade.status(ctx).map((line) => el('span', { class: 'scan-status', text: line })));
      const suggest = trade.suggest(ctx);
      for (const b of sides) b.className = `btn ${b.dataset.side === suggest ? 'btn--primary' : 'btn--ghost'}`;
    } else {
      owned.textContent = n ? `You have ${plural(n, 'copy', 'copies')} of ${which}.` : `You don’t have ${which} yet.`;
    }
    const line = priceLine(prices, card.id);
    price.replaceChildren(...line);
    price.hidden = !line.length;
    for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.id === state.variant));
  };
  box.replaceChildren(found.cards.length > 1
    ? el('div', { class: 'seg seg--wrap', role: 'group', 'aria-label': 'Version' }, ...found.cards.map((card) => el('button', {
      type: 'button',
      class: 'seg__btn',
      'data-id': card.id,
      onclick() {
        state.variant = card.id;
        paint();
      },
    }, labelOf(card), counts[card.id] ? el('span', { class: 'scan-count', text: `×${counts[card.id]}` }) : null)))
    : el('span', { class: 'hint hint--small', text: labelOf(found.cards[0]) === REGULAR ? '' : labelOf(found.cards[0]) }));
  paint();
  for (const b of [add, ...sides]) if (b) b.disabled = false;
  state.found = found;
}

function priceLine(prices, id) {
  const entry = prices?.cards?.[id];
  const { currency } = storage.getPrefs();
  const rates = ratesOf(prices);
  const shown = (usd) => formatMoney(usd, { currency, rates, approx: true });
  const dollars = (usd) => (shownCurrency(currency, rates) === 'usd' ? '' : ` (${formatUsd(usd)})`);
  if (entry?.usd != null) return ['Market price ', el('b', { text: shown(entry.usd) }), dollars(entry.usd)];
  if (entry?.from != null) return [`No sales yet. Listed from ${shown(entry.from)}${dollars(entry.from)}.`];
  return prices ? ['No price yet.'] : [];
}

async function writeOne(set, cardId, delta) {
  if (set === options.prefer && options.current) return options.current(cardId, delta);
  const model = await fetchCollection(set).catch(() => null);
  const counts = storage.readCounts(set);
  const from = counts[cardId] || 0;
  const to = storage.clampQty(from + delta);
  if (to === from) return { from, to };
  if (to) counts[cardId] = to;
  else delete counts[cardId];
  if (!storage.writeCounts(set, counts, model)) return null;
  return { from, to };
}

function updateTally() {
  if (options.trade) {
    const text = options.trade.tally();
    tallyBtn.hidden = !text;
    tallyBtn.textContent = text || '';
    return;
  }
  const live = session.filter((s) => !s.undone);
  const fresh = live.filter((s) => s.from === 0).length;
  const dupes = live.length - fresh;
  tallyBtn.hidden = !session.length;
  tallyBtn.textContent = `${fresh} new · ${plural(dupes, 'duplicate', 'duplicates')}`;
}

async function undoEntry(entry) {
  if (entry.undone) return;
  const result = await writeOne(entry.set, entry.cardId, -1);
  if (!result) {
    flash('Couldn’t undo that.');
    return;
  }
  entry.undone = true;
  updateTally();
  options.onSaved?.();
  flash(`Removed one copy of ${entry.name}`, { iconId: 'i-undo' });
  if (view?.session) renderSession();
}

async function addSelected(button) {
  const state = view;
  const card = state.found.model.cardById.get(state.variant);
  const set = setOf(state.list[state.selected]);
  button.disabled = true;
  const result = await writeOne(set, card.id, 1);
  if (!result) {
    button.disabled = false;
    flash(set === options.prefer && options.current
      ? 'You’re viewing a shared collection. Close the scanner and exit it to add cards to your own.'
      : 'Couldn’t save. Your browser may be blocking storage.');
    return;
  }
  lastVariant = versionLabel(card);
  const what = cardTitle(card);
  if (result.to === result.from) {
    flash(`You already have ${result.from} copies of ${what}, the most this site counts.`);
    resume();
    return;
  }
  const entry = { set, cardId: card.id, name: what, setName: setInfo(set).name, from: result.from, to: result.to };
  session.unshift(entry);
  updateTally();
  options.onSaved?.();
  storage.requestPersistence();
  vibrate(result.from ? 12 : [12, 60, 12]);
  const counts = storage.readCounts(set);
  const other = state.found.cards.find((c) => c.id !== card.id && counts[c.id]);
  const message = result.from
    ? `Duplicate: ${what}. You now have ${result.to}.`
    : `New card! ${what}, ${entry.setName}${other ? `. You already have the ${versionLabel(other)} version` : ''}.`;
  flash(message, { iconId: result.from ? 'i-stack' : 'i-sparkle', undo: () => undoEntry(entry) });
  resume();
}

function pickSelected(side) {
  const state = view;
  const card = state.found.model.cardById.get(state.variant);
  const ctx = { set: setOf(state.list[state.selected]), card, model: state.found.model, side };
  const qty = options.trade.add(ctx);
  const { doing, iconId } = SIDES.find((s) => s.side === side);
  lastVariant = versionLabel(card);
  const what = cardTitle(card);
  updateTally();
  vibrate(12);
  flash(`${doing} ${what}${qty > 1 ? ` ×${qty}` : ''}`, {
    iconId,
    undo() {
      options.trade.remove(ctx);
      updateTally();
    },
  });
  resume();
}

function searchWhere(row, text) {
  const printing = printingOf(row);
  if (row.order?.length > 1 && !printing.codes.includes(codeKey(text))) return `${row.order.length} sets · ${printing.printed}`;
  return `${setInfo(setOf(row)).name} · ${printedOf(row)}`;
}

function openSearch(initial = '') {
  const input = el('input', { type: 'search', class: 'input', placeholder: gameRules().SCAN_SEARCH || 'Card name or number', autocomplete: 'off', enterkeyhint: 'search' });
  const results = el('div', { class: 'scan-search__results', role: 'list' });
  const heading = el('h3', { class: 'scan-panel__title' });
  const run = () => {
    const name = scoped() ? scopeName() : null;
    heading.textContent = name ? `Search ${name}` : 'Search every set';
    input.setAttribute('aria-label', heading.textContent);
    const rows = search(matcher, input.value, { within: within() }).map((row) => withCode(row, input.value));
    results.replaceChildren(...rows.map((row) => el('button', {
      type: 'button',
      class: 'scan-search__row',
      role: 'listitem',
      onclick: () => openPanel({ title: 'Is it this card?', hint: '', list: [row], selected: 0 }),
    }, el('img', { src: row.image, alt: '', loading: 'lazy', decoding: 'async' }),
    el('span', {}, el('b', { text: row.name }), el('small', { text: searchWhere(row, input.value) })))));
    if (input.value.trim() && !rows.length) {
      results.append(el('p', { class: 'hint', text: name
        ? `No ${name} cards match. Try All sets, another spelling, or the number printed on the card.`
        : 'No cards match. Try another spelling, or the number printed on the card.' }));
    }
  };
  input.addEventListener('input', run);
  view = { search: true };
  setPanel(true);
  say('');
  panel.replaceChildren(el('div', { class: 'scan-panel' },
    el('header', { class: 'scan-panel__head' }, heading),
    options.prefer ? scopeToggle(run) : null,
    input,
    results,
    el('div', { class: 'scan-panel__foot' }, el('button', { type: 'button', class: 'btn btn--ghost', onclick: resume }, 'Back to camera'))));
  input.value = initial;
  run();
  paintScope();
  input.focus();
}

function renderTradeSession() {
  view = { session: true };
  setPanel(true);
  say('');
  const groups = options.trade.items();
  panel.replaceChildren(el('div', { class: 'scan-panel' },
    el('header', { class: 'scan-panel__head' },
      el('h3', { class: 'scan-panel__title', text: 'This trade' }),
      el('p', { class: 'hint hint--small', text: options.trade.summary() })),
    ...groups.map((group) => el('section', { class: 'scan-trade-group' },
      el('h4', { class: 'scan-trade-group__title', text: `${group.title} · ${group.total}` }),
      group.lines.length
        ? el('div', { class: 'scan-session', role: 'list' }, ...group.lines.map((line) => el('div', { class: 'scan-session__row', role: 'listitem' },
          el('span', {}, el('b', { text: `${line.name}${line.qty > 1 ? ` ×${line.qty}` : ''}` }), el('small', { text: line.sub })),
          el('button', {
            type: 'button',
            class: 'btn btn--ghost btn--sm',
            onclick() {
              line.remove();
              updateTally();
              renderTradeSession();
            },
          }, 'Remove one'))))
        : el('p', { class: 'hint hint--small', text: 'Nothing yet.' }))),
    el('div', { class: 'scan-panel__foot' }, el('button', { type: 'button', class: 'btn btn--primary', onclick: resume }, 'Back to camera'))));
}

function renderSession() {
  if (options.trade) {
    renderTradeSession();
    return;
  }
  view = { session: true };
  setPanel(true);
  say('');
  panel.replaceChildren(el('div', { class: 'scan-panel' },
    el('header', { class: 'scan-panel__head' }, el('h3', { class: 'scan-panel__title', text: 'Added this session' })),
    el('div', { class: 'scan-session', role: 'list' }, ...session.map((entry) => el('div', { class: `scan-session__row${entry.undone ? ' is-undone' : ''}`, role: 'listitem' },
      el('span', {}, el('b', { text: entry.name }), el('small', { text: `${entry.setName} · ${entry.undone ? 'undone' : entry.from ? `duplicate, now ${entry.to}` : 'new'}` })),
      entry.undone ? null : el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => undoEntry(entry) }, 'Undo')))),
    el('div', { class: 'scan-panel__foot' }, el('button', { type: 'button', class: 'btn btn--primary', onclick: resume }, 'Back to camera'))));
}

function wire() {
  shutter.addEventListener('click', capture);
  $('photo').addEventListener('click', () => fileInput.click());
  $('search').addEventListener('click', () => {
    if (matcher) openSearch();
    else flash('The card recogniser is still loading. Try again in a moment.');
  });
  tallyBtn.addEventListener('click', renderSession);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    fromFile(file);
  });
  dlg.addEventListener('close', () => {
    stopCamera();
    setPanel(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
    else if (dlg.open && panel.hidden) startCamera();
  });
}

let wired = false;

function useGame(next) {
  if (game !== next) {
    game = next;
    matcher = null;
  }
  dlg.dataset.game = game;
  if (matcher) ready();
  else prepareMatcher();
}

export function openScanner(opts = {}) {
  options = opts;
  heading.textContent = opts.title || 'Scan a card';
  if (!wired) {
    wire();
    wired = true;
  }
  openDialog(dlg);
  setPanel(false);
  updateTally();
  renderScope();
  const fixed = opts.game || opts.prefer?.split('/')[0];
  if (fixed) {
    loadCatalog().then((c) => {
      catalog = c;
      renderScope();
    }, () => {});
    useGame(fixed);
    startCamera();
    return;
  }
  shutter.disabled = true;
  loadCatalog().then((c) => {
    catalog = c;
    const games = (c.games || []).filter((g) => GAMES[g.id]);
    if (games.length > 1) chooseGame(games);
    else {
      useGame(games[0]?.id || Object.keys(GAMES)[0]);
      startCamera();
    }
  }, () => {
    useGame(Object.keys(GAMES)[0]);
    startCamera();
  });
}

function chooseGame(games) {
  view = { chooser: true };
  setPanel(true);
  say('');
  panel.replaceChildren(el('div', { class: 'scan-panel scan-games' },
    el('header', { class: 'scan-panel__head' },
      el('h3', { class: 'scan-panel__title', text: 'Which game is the card from?' }),
      el('p', { class: 'hint hint--small', text: 'Each game has its own card recogniser, so choosing first keeps the matches accurate.' })),
    el('div', { class: 'scan-games__list' }, ...games.map((g) => el('button', {
      type: 'button',
      class: 'scan-game',
      onclick() {
        heading.textContent = options.title || `Scan a ${GAMES[g.id].shortName} card`;
        setPanel(false);
        useGame(g.id);
        startCamera();
      },
    }, g.logo ? el('img', { class: 'scan-game__logo', src: asset(g.logo), alt: '' }) : null, el('span', { class: 'scan-game__name', text: g.name })))),
    el('div', { class: 'scan-panel__foot' }, el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => closeDialog(dlg) }, 'Cancel'))));
}
