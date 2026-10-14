import * as storage from '../core/storage.js';
import { openDialog, closeDialog } from '../shared/ui.js';
import { el } from '../shared/dom.js';

const dlg = document.getElementById('dlg-trade-guide');
const slides = [...dlg.querySelectorAll('[data-slide]')];
const back = dlg.querySelector('[data-guide="back"]');
const next = dlg.querySelector('[data-guide="next"]');
const dots = dlg.querySelector('[data-guide="dots"]');
const last = slides.length - 1;

let index = 0;
let waiting = [];

function show(i) {
  index = Math.max(0, Math.min(last, i));
  slides.forEach((slide, n) => {
    slide.hidden = n !== index;
  });
  [...dots.children].forEach((dot, n) => dot.setAttribute('aria-current', n === index ? 'step' : 'false'));
  back.textContent = index ? 'Back' : 'Skip';
  next.textContent = index === last ? 'Got it' : 'Next';
}

export function openGuide() {
  show(0);
  openDialog(dlg);
  next.focus();
  return new Promise((resolve) => waiting.push(resolve));
}

export function initGuide() {
  dots.replaceChildren(...slides.map((_, n) => el('button', {
    type: 'button',
    class: 'tr-guide__dot',
    'aria-label': `Step ${n + 1} of ${slides.length}`,
    onclick: () => show(n),
  })));
  back.addEventListener('click', () => (index ? show(index - 1) : closeDialog(dlg)));
  next.addEventListener('click', () => (index < last ? show(index + 1) : closeDialog(dlg)));
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'ArrowLeft') show(index - 1);
    else return;
    e.preventDefault();
  });
  dlg.addEventListener('close', () => {
    storage.setPref('tradeGuideSeen', true);
    const done = waiting;
    waiting = [];
    for (const resolve of done) resolve();
  });
}
