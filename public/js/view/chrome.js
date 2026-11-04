import { COLLECTION } from '../core/collection.js';
import * as storage from '../core/storage.js';
import { el } from '../shared/dom.js';
import { plural } from '../shared/format.js';
import { toast } from '../shared/ui.js';
import { getQty, getPrefs, onPrefChange, subscribe } from '../set/store.js';
import { initViewShare, prepareViewShare } from './share.js';

export { prepareViewShare };

const pinButton = () => document.querySelector('[data-view-pin]');
const isPinned = () => storage.getPrefs().pinned.includes(COLLECTION.id);

function paintPin() {
  const button = pinButton();
  if (!button) return;
  const pinned = isPinned();
  button.setAttribute('aria-pressed', String(pinned));
  button.querySelector('span').textContent = pinned ? 'Pinned' : 'Pin to home';
}

function togglePin() {
  const { pinned } = storage.getPrefs();
  const on = isPinned();
  storage.setPref('pinned', on ? pinned.filter((id) => id !== COLLECTION.id) : [...pinned, COLLECTION.id]);
  paintPin();
  toast(on ? `Unpinned ${COLLECTION.name}.` : `Pinned ${COLLECTION.name} to your home page.`, { icon: 'i-check' });
}

function relabelShare() {
  for (const item of document.querySelectorAll('.menu__item[data-open="list"]')) {
    item.querySelector('b').textContent = 'Share this page';
    item.querySelector('small').textContent = 'Show anyone which of these cards you have and need';
  }
  for (const button of document.querySelectorAll('#dlg-stats [data-open="list"]')) {
    button.lastChild.textContent = 'Share this page';
  }
}

function sharedBanner() {
  const { shared } = COLLECTION;
  const who = shared.name || 'They';
  const banner = el('div', { class: 'banner view-banner', role: 'status' });
  const paint = () => {
    const tier = COLLECTION.getTier(getPrefs().tier);
    const owned = tier.cards.filter((card) => getQty(card.id) > 0).length;
    banner.replaceChildren(el('div', { class: 'wrap' },
      el('b', { text: `${who} ${shared.name ? 'has' : 'have'} ${owned} of ${plural(tier.cards.length, `${COLLECTION.name} card`, `${COLLECTION.name} cards`)}.` }),
      ' Use the Missing filter to see what’s still needed. ',
      el('a', { href: location.pathname, text: 'See your own' })));
  };
  paint();
  onPrefChange((key) => { if (key === 'tier') paint(); });
  subscribe(paint);
  document.querySelector('.set-hero').before(banner);
}

function readOnlyChrome() {
  const who = COLLECTION.shared.name ? `${COLLECTION.shared.name}’s` : 'someone else’s';
  document.documentElement.toggleAttribute('data-readonly', true);
  for (const item of document.querySelectorAll('[data-open="scan"], [data-open="list"], [data-action="toggle-mode"]')) item.hidden = true;
  pinButton()?.remove();
  sharedBanner();
  let last = 0;
  COLLECTION.onBlocked = () => {
    if (Date.now() - last < 4000) return;
    last = Date.now();
    toast(`This is ${who} collection, so it can’t be changed here.`, { action: { label: 'See your own', onClick() { location.href = location.pathname; } } });
  };
}

const LARGE_VIEW = 400;

export function initViewChrome() {
  document.documentElement.toggleAttribute('data-large', COLLECTION.cards.length >= LARGE_VIEW);
  for (const item of document.querySelectorAll('[data-open="quickadd"], [data-action="reset"], [data-help="quickadd"], #dlg-quickadd')) item.remove();
  relabelShare();
  initViewShare();
  paintPin();
  pinButton()?.addEventListener('click', togglePin);
  if (COLLECTION.shared) readOnlyChrome();
  if (COLLECTION.invalidShare) toast('That link isn’t complete. Ask for it again.');
}
