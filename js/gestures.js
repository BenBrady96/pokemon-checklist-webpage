import * as store from './store.js';
import { vibrate } from './ui.js';

const LONG_PRESS_MS = 380;
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 10;
const EDGE_ZONE = 72;
const MAX_SCROLL_STEP = 18;

export function initGestures(root, { getMode, getInsets, onCommit, onOpen, onBlocked }) {
  let pending = null;
  let stroke = null;
  let suppressClickUntil = 0;
  let anchorId = null;
  let scrollStep = 0;
  let scrollRaf = 0;
  let roving = null;

  const usable = (li) => li && root.contains(li) && !li.hidden && !li.classList.contains('is-dim');
  const idOf = (el) => el.closest('.card')?.dataset.id;
  const usableCards = () => [...root.querySelectorAll('.card')].filter(usable);

  function cardAt(x, y, insets) {
    const cy = Math.min(Math.max(y, insets.top + 1), window.innerHeight - insets.bottom - 1);
    for (const el of document.elementsFromPoint(x, cy)) {
      const li = el.closest('.card');
      if (li) return usable(li) ? li : null;
      if (el === root) break;
    }
    return null;
  }

  function flash(id) {
    const li = root.querySelector(`.card[data-id="${id}"]`);
    if (!li) return;
    li.classList.remove('is-flash');
    void li.offsetWidth;
    li.classList.add('is-flash');
    setTimeout(() => li.classList.remove('is-flash'), 460);
  }

  function attach() {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function detachIfIdle() {
    if (pending || stroke) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }

  root.addEventListener('pointerdown', (e) => {
    suppressClickUntil = 0;
    if (stroke || pending || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey)) return;
    const hit = e.target.closest('.card__hit');
    const li = hit?.closest('.card');
    if (!usable(li)) return;
    pending = { id: li.dataset.id, x: e.clientX, y: e.clientY, pointerId: e.pointerId, type: e.pointerType, timer: 0 };
    if (e.pointerType !== 'mouse') {
      pending.timer = setTimeout(() => startStroke(pending.x, pending.y), LONG_PRESS_MS);
    }
    attach();
  });

  function onMove(e) {
    if (stroke) {
      if (e.pointerId !== stroke.pointerId) return;
      stroke.x = e.clientX;
      stroke.y = e.clientY;
      paintTo(e.clientX, e.clientY);
      updateAutoScroll(e.clientY);
      return;
    }
    if (!pending || e.pointerId !== pending.pointerId) return;
    const dist = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
    if (pending.type === 'mouse') {
      if (dist > MOUSE_SLOP) {
        startStroke(pending.x, pending.y);
        if (stroke) {
          stroke.x = e.clientX;
          stroke.y = e.clientY;
          paintTo(e.clientX, e.clientY);
        }
      }
    } else if (dist > TOUCH_SLOP) {
      cancelPending();
    }
  }

  function onUp(e) {
    if (stroke && e.pointerId === stroke.pointerId) endStroke();
    else if (pending && e.pointerId === pending.pointerId) cancelPending();
    detachIfIdle();
  }

  function cancelPending() {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending = null;
    detachIfIdle();
  }

  function startStroke(x, y) {
    const p = pending;
    clearTimeout(p.timer);
    pending = null;
    if (store.isPreview()) {
      onBlocked();
      detachIfIdle();
      return;
    }
    const mode = getMode();
    stroke = {
      pointerId: p.pointerId,
      type: p.type,
      mode,
      markOwned: store.getQty(p.id) === 0,
      touched: new Set(),
      lastX: x,
      lastY: y,
      x,
      y,
    };
    store.begin();
    document.documentElement.classList.add('is-painting');
    if (p.type !== 'mouse') vibrate(12);
    apply(p.id);
  }

  function apply(id) {
    if (stroke.touched.has(id)) return;
    stroke.touched.add(id);
    const q = store.getQty(id);
    let next;
    if (stroke.mode === 'count') next = q + 1;
    else next = stroke.markOwned ? Math.max(q, 1) : 0;
    if (store.set(id, next)) flash(id);
  }

  function paintTo(x, y) {
    const dx = x - stroke.lastX;
    const dy = y - stroke.lastY;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 14));
    const insets = getInsets();
    for (let i = 1; i <= steps; i++) {
      const li = cardAt(stroke.lastX + (dx * i) / steps, stroke.lastY + (dy * i) / steps, insets);
      if (li) apply(li.dataset.id);
    }
    stroke.lastX = x;
    stroke.lastY = y;
  }

  function updateAutoScroll(y) {
    const { top, bottom } = getInsets();
    const upEdge = top + EDGE_ZONE;
    const downEdge = window.innerHeight - bottom - EDGE_ZONE;
    if (y < upEdge) scrollStep = -Math.ceil(Math.min(1, (upEdge - y) / EDGE_ZONE) * MAX_SCROLL_STEP);
    else if (y > downEdge) scrollStep = Math.ceil(Math.min(1, (y - downEdge) / EDGE_ZONE) * MAX_SCROLL_STEP);
    else scrollStep = 0;
    if (scrollStep && !scrollRaf) scrollRaf = requestAnimationFrame(scrollTick);
  }

  function scrollTick() {
    scrollRaf = 0;
    if (!stroke || !scrollStep) return;
    window.scrollBy(0, scrollStep);
    paintTo(stroke.x, stroke.y);
    scrollRaf = requestAnimationFrame(scrollTick);
  }

  function endStroke() {
    const s = stroke;
    stroke = null;
    scrollStep = 0;
    cancelAnimationFrame(scrollRaf);
    scrollRaf = 0;
    document.documentElement.classList.remove('is-painting');
    suppressClickUntil = performance.now() + 450;
    anchorId = [...s.touched].pop() || anchorId;
    onCommit(store.commit(), { kind: 'stroke' });
    detachIfIdle();
  }

  document.addEventListener('touchmove', (e) => {
    if (stroke && stroke.type !== 'mouse' && e.cancelable) e.preventDefault();
  }, { passive: false });

  root.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.card')) e.preventDefault();
  });

  function tap(id) {
    const q = store.getQty(id);
    store.begin();
    store.set(id, getMode() === 'count' ? q + 1 : q > 0 ? 0 : 1);
    onCommit(store.commit(), { kind: 'tap', id });
  }

  function step(id, delta) {
    store.begin();
    store.set(id, store.getQty(id) + delta);
    onCommit(store.commit(), { kind: 'step', id });
  }

  function rangeTo(id) {
    const order = usableCards().map((li) => li.dataset.id);
    let a = order.indexOf(anchorId);
    let b = order.indexOf(id);
    if (a < 0 || b < 0) return tap(id);
    if (a > b) [a, b] = [b, a];
    const mode = getMode();
    const markOwned = store.getQty(id) === 0;
    store.begin();
    for (const cid of order.slice(a, b + 1)) {
      const q = store.getQty(cid);
      if (mode === 'count') {
        if (cid !== anchorId) store.set(cid, q + 1);
      } else {
        store.set(cid, markOwned ? Math.max(q, 1) : 0);
      }
    }
    onCommit(store.commit(), { kind: 'range' });
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !root.contains(btn) || !btn.closest('.card')) return;
    if (performance.now() < suppressClickUntil) {
      suppressClickUntil = 0;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const id = idOf(btn);
    if (btn.classList.contains('card__zoom')) {
      onOpen(id);
      return;
    }
    if (store.isPreview()) {
      onBlocked();
      return;
    }
    if (btn.classList.contains('card__minus')) step(id, -1);
    else if (btn.classList.contains('card__plus')) step(id, 1);
    else if (btn.classList.contains('card__hit')) {
      if (e.shiftKey && anchorId && anchorId !== id) rangeTo(id);
      else tap(id);
      anchorId = id;
    }
  });

  function setRoving(hit) {
    if (roving && roving !== hit) roving.tabIndex = -1;
    roving = hit;
    hit.tabIndex = 0;
  }

  function focusCard(li) {
    if (!li) return;
    const hit = li.querySelector('.card__hit');
    setRoving(hit);
    hit.focus();
  }

  function vertical(li, dir) {
    const from = li.getBoundingClientRect();
    const cx = from.left + from.width / 2;
    let best = null;
    let bestScore = Infinity;
    for (const other of usableCards()) {
      if (other === li) continue;
      const r = other.getBoundingClientRect();
      const gap = dir > 0 ? r.top - from.bottom : from.top - r.bottom;
      if (gap < -4) continue;
      const score = Math.round(gap / 8) * 100000 + Math.abs(r.left + r.width / 2 - cx);
      if (score < bestScore) {
        bestScore = score;
        best = other;
      }
    }
    return best;
  }

  root.addEventListener('focusin', (e) => {
    const hit = e.target.closest('.card__hit');
    if (hit) setRoving(hit);
  });

  root.addEventListener('keydown', (e) => {
    const hit = e.target.closest('.card__hit');
    if (!hit || e.altKey || e.ctrlKey || e.metaKey) return;
    const li = hit.closest('.card');
    const id = li.dataset.id;
    const cards = usableCards();
    const i = cards.indexOf(li);
    switch (e.key) {
      case 'ArrowRight': focusCard(cards[i + 1]); break;
      case 'ArrowLeft': focusCard(cards[i - 1]); break;
      case 'ArrowDown': focusCard(vertical(li, 1)); break;
      case 'ArrowUp': focusCard(vertical(li, -1)); break;
      case 'Home': focusCard(cards[0]); break;
      case 'End': focusCard(cards[cards.length - 1]); break;
      case 'v': case 'V': onOpen(id); break;
      case '+': case '=':
        if (store.isPreview()) onBlocked();
        else step(id, 1);
        break;
      case '-': case '_':
        if (store.isPreview()) onBlocked();
        else step(id, -1);
        break;
      default: return;
    }
    e.preventDefault();
  });

  return {
    isPainting: () => stroke !== null,
    resetRoving() {
      if (roving && usable(roving.closest('.card'))) return;
      const first = usableCards()[0];
      if (first) setRoving(first.querySelector('.card__hit'));
    },
  };
}
