import { COLLECTION } from '../core/collection.js';
import * as store from './store.js';
import { escapeHTML, announce } from '../shared/ui.js';
import { plural } from '../shared/format.js';

const sameOrder = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);
const EDGE = 48;
const STEP = 8;

export function initOrder() {
  const dlg = document.getElementById('dlg-order');
  const list = document.getElementById('order-list');
  const scroller = dlg.querySelector('.sheet__body');
  const reset = dlg.querySelector('[data-order-reset]');
  const defaults = COLLECTION.sections.map((s) => s.id);
  let full = defaults;
  let shown = [];
  let drag = null;

  function rowMarkup(id, i) {
    const section = COLLECTION.sectionById.get(id);
    const name = escapeHTML(section.name);
    return `<li class="order-row" data-id="${id}">`
      + '<span class="order-row__grip" aria-hidden="true"><svg><use href="#i-grip"/></svg></span>'
      + `<span class="order-row__text"><b>${name}</b><small>${plural(COLLECTION.cardsBySection.get(id).length, 'card', 'cards')}</small></span>`
      + `<button type="button" class="icon-btn order-row__btn" data-move="-1" aria-label="Move ${name} up"${i === 0 ? ' disabled' : ''}><svg><use href="#i-chevron-up"/></svg></button>`
      + `<button type="button" class="icon-btn order-row__btn" data-move="1" aria-label="Move ${name} down"${i === shown.length - 1 ? ' disabled' : ''}><svg><use href="#i-chevron-down"/></svg></button>`
      + '</li>';
  }

  function render(focus) {
    const inTier = COLLECTION.getTier(store.getPrefs().tier).sectionIds;
    shown = full.filter((id) => inTier.has(id));
    list.innerHTML = shown.map(rowMarkup).join('');
    reset.disabled = sameOrder(full, defaults);
    if (!focus) return;
    const row = list.querySelector(`[data-id="${focus.id}"]`);
    const btn = row.querySelector(`[data-move="${focus.dir}"]`);
    (btn.disabled ? row.querySelector(`[data-move="${-focus.dir}"]`) : btn).focus();
  }

  function place(next) {
    const moving = new Set(shown);
    let i = 0;
    full = full.map((id) => (moving.has(id) ? next[i++] : id));
  }

  function announceMove(id) {
    const at = shown.indexOf(id);
    announce(`${COLLECTION.sectionById.get(id).name} moved to ${at + 1} of ${shown.length}`);
  }

  function move(id, dir) {
    const from = shown.indexOf(id);
    const to = from + dir;
    if (to < 0 || to >= shown.length) return;
    const next = [...shown];
    [next[from], next[to]] = [next[to], next[from]];
    place(next);
    render({ id, dir });
    announceMove(id);
  }

  function follow() {
    const { row } = drag;
    const top = drag.y - list.getBoundingClientRect().top - drag.grab;
    const centre = top + row.offsetHeight / 2;
    let prev = row.previousElementSibling;
    while (prev && centre < prev.offsetTop + prev.offsetHeight / 2) {
      prev.before(row);
      prev = row.previousElementSibling;
    }
    let next = row.nextElementSibling;
    while (next && centre > next.offsetTop + next.offsetHeight / 2) {
      next.after(row);
      next = row.nextElementSibling;
    }
    const max = list.offsetHeight - row.offsetHeight;
    row.style.translate = `0 ${Math.max(0, Math.min(max, top)) - row.offsetTop}px`;
  }

  function tick() {
    if (!drag) return;
    drag.frame = 0;
    if (!drag.speed) return;
    scroller.scrollTop += drag.speed * STEP;
    follow();
    drag.frame = requestAnimationFrame(tick);
  }

  function endDrag() {
    if (!drag) return;
    const { row, frame, pointerId } = drag;
    drag = null;
    cancelAnimationFrame(frame);
    if (list.hasPointerCapture(pointerId)) list.releasePointerCapture(pointerId);
    row.style.translate = '';
    row.classList.remove('is-dragging');
    list.classList.remove('is-sorting');
    const next = [...list.children].map((li) => li.dataset.id);
    if (sameOrder(next, shown)) return;
    place(next);
    render();
    announceMove(row.dataset.id);
  }

  list.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.order-row__grip');
    if (!grip || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const row = grip.closest('.order-row');
    list.setPointerCapture(e.pointerId);
    drag = { row, pointerId: e.pointerId, y: e.clientY, grab: e.clientY - list.getBoundingClientRect().top - row.offsetTop, speed: 0, frame: 0 };
    row.classList.add('is-dragging');
    list.classList.add('is-sorting');
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.y = e.clientY;
    const box = scroller.getBoundingClientRect();
    drag.speed = e.clientY < box.top + EDGE ? -1 : e.clientY > box.bottom - EDGE ? 1 : 0;
    follow();
    if (drag.speed && !drag.frame) drag.frame = requestAnimationFrame(tick);
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    list.addEventListener(type, (e) => {
      if (drag && e.pointerId === drag.pointerId) endDrag();
    });
  }

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-move]');
    if (btn) move(btn.closest('.order-row').dataset.id, Number(btn.dataset.move));
  });

  reset.addEventListener('click', () => {
    full = defaults;
    render();
    announce('Sections back in set order');
    dlg.querySelector('[data-order-done]').focus();
  });

  dlg.addEventListener('close', () => {
    endDrag();
    if (sameOrder(full, COLLECTION.sectionOrder(store.getSectionOrder()))) return;
    store.setSectionOrder(sameOrder(full, defaults) ? null : full);
  });

  return {
    prepare() {
      full = COLLECTION.sectionOrder(store.getSectionOrder());
      render();
    },
  };
}
