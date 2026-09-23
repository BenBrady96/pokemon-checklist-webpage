import { CARD_BY_ID, RARITY_BY_ID } from './cards.js';
import colors from './card-colors.js';
import * as store from './store.js';
import { openDialog, closeDialog, reducedMotion } from './ui.js';

const FOIL_RARITIES = new Set(['RR', 'PR', 'IR', 'SIR', 'FR', 'CC']);
const WIDE_RARITIES = new Set(['RR', 'SIR', 'CC']);
const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 0.45;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function initViewer({ getOrder, onCommit, onBlocked }) {
  const dlg = document.getElementById('dlg-viewer');
  const $ = (name) => dlg.querySelector(`[data-viewer="${name}"]`);
  const el = {
    pos: $('pos'), stage: $('stage'), card: $('card'), low: $('low'), high: $('high'),
    num: $('num'), rarity: $('rarity'), rarityIcon: $('rarity-icon'), name: $('name'),
    owned: $('owned'), ownedLabel: $('owned-label'), minus: $('minus'), plus: $('plus'), qty: $('qty'),
    prev: $('prev'), next: $('next'), motion: $('motion'),
  };

  let order = [];
  let index = 0;
  let currentId = null;
  let animating = false;

  el.high.addEventListener('load', () => el.high.classList.add('is-loaded'));

  function preload(id) {
    if (id) new Image().src = `img/cards/lg/${id}.webp`;
  }

  function show(id) {
    currentId = id;
    index = order.indexOf(id);
    const card = CARD_BY_ID.get(id);
    const rarity = RARITY_BY_ID.get(card.rarity);

    el.card.style.setProperty('--ph', colors[id] || '#222a55');
    el.low.src = `img/cards/sm/${id}.webp`;
    const hi = `img/cards/lg/${id}.webp`;
    if (el.high.getAttribute('src') !== hi) {
      el.high.classList.remove('is-loaded');
      el.high.src = hi;
    }
    el.high.alt = `${card.name} card`;
    el.card.toggleAttribute('data-foil', FOIL_RARITIES.has(card.rarity));

    if (card.section === 'classic') el.num.textContent = `Classic Collection · No. ${card.num}`;
    else if (card.section === 'energy') el.num.textContent = `No. ${card.num}`;
    else el.num.textContent = `No. ${card.printed}`;
    el.rarity.textContent = card.rarity === 'E' ? `${card.type[0].toUpperCase()}${card.type.slice(1)} Energy` : rarity.name;
    el.rarityIcon.querySelector('use').setAttribute('href', card.rarity === 'E' ? `#e-${card.type}` : `#${rarity.icon}`);
    el.rarityIcon.classList.toggle('rar--wide', WIDE_RARITIES.has(card.rarity));
    el.name.textContent = card.name;
    el.pos.textContent = `${index + 1} / ${order.length}`;
    el.prev.disabled = index <= 0;
    el.next.disabled = index >= order.length - 1;
    updateState();
    motionBase = null;
    preload(order[index + 1]);
    preload(order[index - 1]);
  }

  function updateState() {
    const q = store.getQty(currentId);
    el.owned.setAttribute('aria-checked', q > 0 ? 'true' : 'false');
    el.ownedLabel.textContent = q > 0 ? 'Owned' : 'Mark owned';
    el.qty.textContent = q;
    el.minus.disabled = q === 0;
    el.plus.disabled = q >= store.MAX_QTY;
  }

  store.subscribe((ids) => {
    if (dlg.open && currentId && (!ids || ids.includes(currentId))) updateState();
  });

  function go(delta, fromX = 0) {
    const next = index + delta;
    if (animating) return;
    if (next < 0 || next >= order.length) {
      snapBack();
      return;
    }
    if (reducedMotion()) {
      show(order[next]);
      return;
    }
    animating = true;
    const w = el.card.offsetWidth;
    const out = el.card.animate(
      [{ translate: `${fromX}px 0`, opacity: 1 }, { translate: `${-delta * w * 0.55}px 0`, opacity: 0 }],
      { duration: 130, easing: 'ease-in' },
    );
    out.onfinish = () => {
      el.card.style.translate = '';
      el.card.style.rotate = '';
      show(order[next]);
      const inn = el.card.animate(
        [{ translate: `${delta * w * 0.55}px 0`, opacity: 0 }, { translate: '0 0', opacity: 1 }],
        { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
      inn.onfinish = () => { animating = false; };
    };
  }

  function snapBack() {
    const from = el.card.style.translate || '0px 0';
    el.card.style.translate = '';
    el.card.style.rotate = '';
    if (!reducedMotion()) el.card.animate([{ translate: from }, { translate: '0 0' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  el.prev.addEventListener('click', () => go(-1));
  el.next.addEventListener('click', () => go(1));

  function change(next) {
    if (store.isPreview()) {
      onBlocked();
      return;
    }
    store.begin();
    store.set(currentId, next);
    onCommit(store.commit(), { kind: 'viewer', id: currentId });
  }

  el.owned.addEventListener('click', () => change(store.getQty(currentId) > 0 ? 0 : 1));
  el.minus.addEventListener('click', () => change(store.getQty(currentId) - 1));
  el.plus.addEventListener('click', () => change(store.getQty(currentId) + 1));

  dlg.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const onButton = e.target.closest('button');
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if ((e.key === ' ' || e.key === 'Enter') && !onButton) change(store.getQty(currentId) > 0 ? 0 : 1);
    else if (e.key === '+' || e.key === '=') change(store.getQty(currentId) + 1);
    else if (e.key === '-' || e.key === '_') change(store.getQty(currentId) - 1);
    else return;
    e.preventDefault();
  });

  let drag = null;
  let suppressClickUntil = 0;
  let tiltRaf = 0;
  let tiltTarget = null;

  function setTilt(px, py, glare = 1) {
    const s = el.card.style;
    s.setProperty('--ry', `${((px - 0.5) * 24).toFixed(2)}deg`);
    s.setProperty('--rx', `${((0.5 - py) * 20).toFixed(2)}deg`);
    s.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    s.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    s.setProperty('--glare', glare);
  }

  function resetTilt() {
    const s = el.card.style;
    s.setProperty('--rx', '0deg');
    s.setProperty('--ry', '0deg');
    s.setProperty('--glare', '0');
  }

  function queueTilt(px, py) {
    tiltTarget = [px, py];
    if (!tiltRaf) {
      tiltRaf = requestAnimationFrame(() => {
        tiltRaf = 0;
        if (tiltTarget) setTilt(...tiltTarget);
      });
    }
  }

  el.stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      if (reducedMotion()) return;
      const r = el.card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      if (px < -0.15 || px > 1.15 || py < -0.15 || py > 1.15) {
        tiltTarget = null;
        resetTilt();
      } else {
        queueTilt(clamp(px, 0, 1), clamp(py, 0, 1));
      }
      return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.active && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      drag.active = true;
      el.card.classList.add('is-dragging');
    }
    if (drag.active) {
      drag.dx = dx;
      el.card.style.translate = `${dx}px 0`;
      el.card.style.rotate = `${(dx / 28).toFixed(2)}deg`;
    }
  });

  el.stage.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') {
      tiltTarget = null;
      resetTilt();
    }
  });

  el.stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || e.target.closest('button') || animating) return;
    drag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, active: false };
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    if (!d.active) return;
    el.card.classList.remove('is-dragging');
    suppressClickUntil = performance.now() + 400;
    const velocity = Math.abs(d.dx) / Math.max(1, performance.now() - d.t);
    if (Math.abs(d.dx) > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) go(d.dx < 0 ? 1 : -1, d.dx);
    else snapBack();
  };
  el.stage.addEventListener('pointerup', endDrag);
  el.stage.addEventListener('pointercancel', (e) => {
    if (drag?.active) snapBack();
    endDrag(e);
  });

  el.stage.addEventListener('click', (e) => {
    if (performance.now() < suppressClickUntil) return;
    if (e.target === el.stage) closeDialog(dlg);
  });

  const motionCapable = 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches;
  const canRequestPermission = motionCapable && typeof DeviceOrientationEvent.requestPermission === 'function';
  let motionOn = false;
  let motionSeen = false;
  let motionBase = null;
  let motionTimer = 0;

  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    motionSeen = true;
    el.motion.hidden = true;
    if (drag?.active) return;
    if (!motionBase) motionBase = { beta: e.beta, gamma: e.gamma };
    const tx = clamp((e.gamma - motionBase.gamma) / 28, -1, 1);
    const ty = clamp((e.beta - motionBase.beta) / 28, -1, 1);
    queueTilt(0.5 + tx / 2, 0.5 + ty / 2);
  }

  function startMotion() {
    el.motion.hidden = true;
    if (!motionCapable || reducedMotion() || motionOn) return;
    motionOn = true;
    motionBase = null;
    window.addEventListener('deviceorientation', onOrientation);
    clearTimeout(motionTimer);
    motionTimer = setTimeout(() => {
      if (!motionSeen && canRequestPermission && dlg.open) el.motion.hidden = false;
    }, 700);
  }

  function stopMotion() {
    motionOn = false;
    clearTimeout(motionTimer);
    window.removeEventListener('deviceorientation', onOrientation);
  }

  el.motion.addEventListener('click', async () => {
    el.motion.hidden = true;
    try {
      await DeviceOrientationEvent.requestPermission();
    } catch {}
  });

  dlg.addEventListener('close', () => {
    stopMotion();
    tiltTarget = null;
    resetTilt();
    currentId = null;
  });

  return {
    open(id) {
      order = getOrder();
      if (!order.includes(id)) order = [id];
      animating = false;
      el.card.style.translate = '';
      el.card.style.rotate = '';
      resetTilt();
      show(id);
      openDialog(dlg);
      el.owned.focus({ preventScroll: true });
      startMotion();
    },
  };
}
