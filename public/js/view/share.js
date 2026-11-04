import { COLLECTION } from '../core/collection.js';
import * as store from '../set/store.js';
import { renderQr } from '../shared/qr.js';
import { plural } from '../shared/format.js';
import { copyText, toast } from '../shared/ui.js';
import { cleanName, encodeViewShare } from '../trade/trade-code.js';
import { readTrade, saveTrade } from '../trade/trade-data.js';

const $ = (name) => document.querySelector(`#dlg-view-share [data-vs="${name}"]`);
const QR = { level: 'L', maxModules: 129 };

let url = '';
let run = 0;
let timer = 0;

function linesBySet() {
  const sets = new Map();
  for (const card of COLLECTION.cards) {
    const q = store.getQty(card.id);
    if (!q) continue;
    const { key } = COLLECTION.viewSets[card.s];
    if (!sets.has(key)) sets.set(key, []);
    sets.get(key).push([card.x, q]);
  }
  return [...sets].map(([key, lines]) => ({ key, lines }));
}

function paint() {
  const ready = Boolean(url);
  $('url').value = url;
  $('link-box').hidden = !ready;
  $('empty').hidden = ready;
  $('copy').disabled = !ready;
  $('share').disabled = !ready;
  const open = $('open');
  if (ready) open.href = url;
  else open.removeAttribute('href');
  open.setAttribute('aria-disabled', String(!ready));
  open.tabIndex = ready ? 0 : -1;
}

async function build() {
  const current = ++run;
  const sets = linesBySet();
  if (!sets.length) {
    url = '';
    paint();
    return;
  }
  const code = await encodeViewShare({ name: readTrade().name, tier: store.getPrefs().tier, sets });
  if (current !== run) return;
  url = `${location.origin}${location.pathname}#v=${code}`;
  paint();
  if ($('qr-box').open) renderQr($('qr'), url, QR);
}

function queue(delay = 300) {
  clearTimeout(timer);
  timer = setTimeout(build, delay);
}

export function prepareViewShare() {
  const owned = COLLECTION.cards.filter((card) => store.getQty(card.id) > 0).length;
  $('intro').textContent = `A link anyone can open, showing the ${plural(owned, `${COLLECTION.name} card`, `${COLLECTION.name} cards`)} you have and the ones you still need.`;
  $('name').value = readTrade().name;
  $('share').hidden = typeof navigator.share !== 'function';
  $('qr-box').open = false;
  $('qr').replaceChildren();
  url = '';
  paint();
  build();
}

export function initViewShare() {
  $('name').addEventListener('input', () => {
    const state = readTrade();
    state.name = cleanName($('name').value);
    saveTrade(state);
    queue();
  });
  $('qr-box').addEventListener('toggle', () => {
    if ($('qr-box').open && url) renderQr($('qr'), url, QR);
  });
  $('copy').addEventListener('click', async () => {
    if (!url) return;
    const ok = await copyText(url);
    if (!ok) $('url').select();
    toast(ok ? 'Link copied. Send it to anyone.' : 'Select the link and copy it manually.', { icon: 'i-copy' });
  });
  $('share').addEventListener('click', () => {
    if (!url) return;
    navigator.share({ title: `${COLLECTION.name} cards`, text: `My ${COLLECTION.name} cards on Binder Tracker`, url }).catch(() => {});
  });
  $('url').addEventListener('focus', () => $('url').select());
}
