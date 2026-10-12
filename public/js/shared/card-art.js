import { el } from './dom.js';

export function cardImage(model, card, size) {
  if (!model.hasImage(card)) return null;
  const img = el('img', { src: model.imageUrl(card, size), alt: '', width: 330, height: 460, loading: size === 'sm' ? 'lazy' : 'eager', decoding: 'async' });
  img.addEventListener('error', () => {
    if (size === 'lg') img.src = model.imageUrl(card, 'sm');
    else img.remove();
  }, { once: true });
  return img;
}

export function cardArt(model, card, qty, className) {
  return el('span', { class: className, style: `--ph:${model.imageColor(card)}` },
    el('span', { class: 'lst-card__ph', 'aria-hidden': 'true', text: card.num }),
    cardImage(model, card, 'sm'),
    qty > 1 ? el('span', { class: 'lst-card__qty', text: `×${qty}` }) : null);
}
