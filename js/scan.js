import { openDialog, vibrate } from './ui.js';
import { loadCatalog } from './catalog.js';
import { fetchCollection } from './collection.js';
import * as storage from './storage.js';
import { loadMatcher, match, search } from './scan-match.js';

const CARD_ASPECT = 63 / 88;
const REGULAR = 'Regular';

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
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

let options = {};
let stream = null;
let starting = false;
let matcher = null;
let catalog = null;
let busy = false;
let lastVariant = REGULAR;
let view = null;
let flashTimer = 0;
const session = [];

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
};

const icon = (id) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
};

const setInfo = (id) => catalog?.collections.find((c) => c.id === id) || { id, name: id };

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
  if (!navigator.mediaDevices?.getUserMedia) {
    say('The camera needs the secure (https) version of this site. You can still use Photo.');
    return;
  }
  starting = true;
  try {
    const got = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    if (!dlg.open || document.hidden) {
      for (const track of got.getTracks()) track.stop();
      return;
    }
    stream = got;
    video.srcObject = stream;
    await video.play().catch(() => {});
    dlg.classList.add('has-camera');
    ready();
  } catch (err) {
    say(err?.name === 'NotAllowedError'
      ? 'Camera access is blocked. Allow it in your browser’s site settings, or use Photo.'
      : 'Couldn’t start the camera. You can still use Photo.');
  } finally {
    starting = false;
  }
}

function stopCamera() {
  for (const track of stream?.getTracks() || []) track.stop();
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
  say('Getting the card recogniser ready…');
  shutter.disabled = true;
  loadMatcher((p) => {
    if (!matcher && panel.hidden) say(`Downloading the card recogniser (one time only)… ${Math.round(p * 100)}%`);
  }).then((m) => {
    matcher = m;
    ready();
  }, () => {
    say('Couldn’t load the card recogniser. Check your connection, then close and reopen the scanner.');
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
  const cw = Math.min(w, h * CARD_ASPECT);
  const ch = cw / CARD_ASPECT;
  return [(w - cw) / 2, (h - ch) / 2, cw, ch];
}

async function recognise(source, crop) {
  if (busy || !matcher) return;
  busy = true;
  shutter.disabled = true;
  say('Looking…');
  try {
    const { canvas, ctx } = canvasFor();
    ctx.drawImage(source, ...crop, 0, 0, canvas.width, canvas.height);
    const result = await match(matcher, canvas, { prefer: options.prefer });
    if (dlg.open) await showMatches(result);
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
  recognise(video, frameCrop());
}

async function fromFile(file) {
  if (!file) return;
  if (!matcher) {
    flash('The card recogniser is still loading. Try again in a moment.');
    return;
  }
  try {
    const bitmap = await createImageBitmap(file);
    await recognise(bitmap, centreCrop(bitmap.width, bitmap.height));
    bitmap.close();
  } catch {
    resume();
    flash('Couldn’t read that picture.');
  }
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

async function showMatches(result) {
  catalog ||= await loadCatalog().catch(() => null);
  const list = orderCandidates(result);
  const twins = result.sameArt.length > 1;
  const title = !result.confident
    ? 'Not sure. Is it one of these?'
    : twins
      ? `Same artwork in ${result.sameArt.length} sets`
      : 'Is it this card?';
  const hint = twins && result.confident
    ? 'Check the set code and number at the bottom of your card, then pick the matching set.'
    : !result.confident ? 'Try again with the card filling the frame and less glare, or search by name.' : '';
  openPanel({ title, hint, list, selected: 0 });
}

function openPanel(state) {
  view = state;
  setPanel(true);
  say('');
  renderPanel();
}

async function variantsFor(candidate) {
  const model = await fetchCollection(candidate.set);
  return { model, cards: model.cards.filter((c) => c.imageId === candidate.imageId) };
}

async function renderPanel() {
  const state = view;
  const candidate = state.list[state.selected];
  const picks = state.list.length > 1
    ? el('div', { class: 'scan-picks', role: 'group', 'aria-label': 'Possible matches' }, ...state.list.map((c, i) => el('button', {
      type: 'button',
      class: 'scan-pick',
      'aria-pressed': String(i === state.selected),
      onclick() {
        state.selected = i;
        state.variant = null;
        renderPanel();
      },
    }, el('img', { src: c.image, alt: '', loading: 'lazy', decoding: 'async' }),
    el('span', { class: 'scan-pick__name', text: c.name }),
    el('span', { class: 'scan-pick__set', text: `${setInfo(c.set).code || setInfo(c.set).name} · ${c.printed}` }))))
    : null;

  const detail = el('div', { class: 'scan-detail' },
    el('img', { class: 'scan-detail__img', src: candidate.image, alt: '' }),
    el('div', { class: 'scan-detail__text' },
      el('p', { class: 'scan-detail__name', text: candidate.name }),
      el('p', { class: 'scan-detail__set', text: `${setInfo(candidate.set).name} · ${candidate.printed}` }),
      el('div', { class: 'scan-detail__variants', 'data-scan': 'variants' }, el('span', { class: 'hint hint--small', text: 'Loading…' })),
      el('p', { class: 'scan-detail__owned', 'data-scan': 'owned' })));

  const add = el('button', { type: 'button', class: 'btn btn--primary', disabled: true, onclick: () => addSelected(add) }, icon('i-plus'), 'Add to collection');
  panel.replaceChildren(el('div', { class: 'scan-panel' },
    el('header', { class: 'scan-panel__head' },
      el('h3', { class: 'scan-panel__title', text: state.title }),
      state.hint ? el('p', { class: 'hint hint--small', text: state.hint }) : null),
    picks,
    detail,
    el('div', { class: 'scan-panel__foot' },
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => openSearch() }, icon('i-search'), 'Search'),
      el('button', { type: 'button', class: 'btn btn--ghost', onclick: resume }, 'Scan again'),
      add)));
  speak(`${state.title}. ${candidate.name}, ${setInfo(candidate.set).name}, ${candidate.printed}`);

  let found;
  try {
    found = await variantsFor(candidate);
  } catch {
    if (view !== state) return;
    panel.querySelector('[data-scan="variants"]').replaceChildren(el('span', { class: 'hint hint--small', text: 'Connect to the internet to add cards from this set for the first time.' }));
    return;
  }
  if (view !== state || state.list[state.selected] !== candidate) return;
  const counts = storage.readCounts(candidate.set);
  const labelOf = (card) => card.variant || REGULAR;
  if (!state.variant || !found.cards.some((c) => c.id === state.variant)) {
    state.variant = (found.cards.find((c) => labelOf(c) === lastVariant) || found.cards.find((c) => !c.variant) || found.cards[0]).id;
  }
  const box = panel.querySelector('[data-scan="variants"]');
  const owned = panel.querySelector('[data-scan="owned"]');
  const paint = () => {
    const card = found.model.cardById.get(state.variant);
    const n = counts[card.id] || 0;
    const which = found.cards.length > 1 ? `the ${labelOf(card)} version` : 'this card';
    owned.textContent = n ? `You have ${plural(n, 'copy', 'copies')} of ${which}.` : `You don’t have ${which} yet.`;
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
  add.disabled = false;
  state.found = found;
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
  const candidate = state.list[state.selected];
  button.disabled = true;
  const result = await writeOne(candidate.set, card.id, 1);
  if (!result) {
    button.disabled = false;
    flash(candidate.set === options.prefer && options.current
      ? 'You’re viewing a shared collection. Close the scanner and exit it to add cards to your own.'
      : 'Couldn’t save. Your browser may be blocking storage.');
    return;
  }
  const label = card.variant || REGULAR;
  lastVariant = label;
  const what = `${card.name}${card.variant ? ` (${card.variant})` : ''}`;
  if (result.to === result.from) {
    flash(`You already have ${result.from} copies of ${what}, the most this site counts.`);
    resume();
    return;
  }
  const entry = { set: candidate.set, cardId: card.id, name: what, setName: setInfo(candidate.set).name, from: result.from, to: result.to };
  session.unshift(entry);
  updateTally();
  options.onSaved?.();
  navigator.storage?.persist?.().catch(() => {});
  vibrate(result.from ? 12 : [12, 60, 12]);
  const counts = storage.readCounts(candidate.set);
  const other = state.found.cards.find((c) => c.id !== card.id && counts[c.id]);
  const message = result.from
    ? `Duplicate: ${what}. You now have ${result.to}.`
    : `New card! ${what}, ${entry.setName}${other ? `. You already have the ${other.variant || REGULAR} version` : ''}.`;
  flash(message, { iconId: result.from ? 'i-stack' : 'i-sparkle', undo: () => undoEntry(entry) });
  resume();
}

function openSearch(initial = '') {
  const input = el('input', { type: 'search', class: 'input', placeholder: 'Card name or number, e.g. Pikachu or 025/165', 'aria-label': 'Search every set', autocomplete: 'off', enterkeyhint: 'search' });
  const results = el('div', { class: 'scan-search__results', role: 'list' });
  const run = () => {
    const rows = search(matcher, input.value);
    results.replaceChildren(...rows.map((row) => el('button', {
      type: 'button',
      class: 'scan-search__row',
      role: 'listitem',
      onclick: () => openPanel({ title: 'Is it this card?', hint: '', list: [row], selected: 0 }),
    }, el('img', { src: row.image, alt: '', loading: 'lazy', decoding: 'async' }),
    el('span', {}, el('b', { text: row.name }), el('small', { text: `${setInfo(row.set).name} · ${row.printed}` })))));
    if (input.value.trim() && !rows.length) results.append(el('p', { class: 'hint', text: 'No cards match. Try another spelling, or the number printed on the card.' }));
  };
  input.addEventListener('input', run);
  view = { search: true };
  setPanel(true);
  say('');
  panel.replaceChildren(el('div', { class: 'scan-panel' },
    el('header', { class: 'scan-panel__head' }, el('h3', { class: 'scan-panel__title', text: 'Search every set' })),
    input,
    results,
    el('div', { class: 'scan-panel__foot' }, el('button', { type: 'button', class: 'btn btn--ghost', onclick: resume }, 'Back to camera'))));
  input.value = initial;
  if (initial) run();
  input.focus();
}

function renderSession() {
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

export function openScanner(opts = {}) {
  options = opts;
  if (!wired) {
    wire();
    wired = true;
  }
  openDialog(dlg);
  setPanel(false);
  updateTally();
  loadCatalog().then((c) => { catalog = c; }, () => {});
  if (matcher) ready();
  else prepareMatcher();
  startCamera();
}
