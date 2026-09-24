import { CARD_BY_ID, PRINTED_TOTAL } from './cards.js';
import { escapeHTML } from './ui.js';

const MAIN_MAX = 158;
const TOKEN = /^#?([cepv])?(\d{1,3})(?:-([cepv])?(\d{1,3}))?(?:x(\d{1,2}))?$/i;
const RGB_TOKEN = /^([rgb]?)\/?rgb(?:x(\d{1,2}))?$/i;

const ID_FORMATS = {
  '': (n) => `m${String(n).padStart(3, '0')}`,
  c: (n) => `c${String(n).padStart(2, '0')}`,
  e: (n) => `e${String(n).padStart(3, '0')}`,
  p: (n) => `p${String(n).padStart(3, '0')}`,
  v: (n) => `v${String(n).padStart(2, '0')}`,
};

function idFor(prefix, n) {
  const id = ID_FORMATS[prefix](n);
  return CARD_BY_ID.has(id) ? id : null;
}

export function parseQuickAdd(text) {
  const counts = new Map();
  const invalid = [];
  const cleaned = text
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*[x×*]\s*(?=\d)/gi, 'x')
    .replace(/\/\s*\d+/g, '');
  for (const token of cleaned.split(/[\s,;]+/).filter(Boolean)) {
    const rgb = RGB_TOKEN.exec(token);
    if (rgb) {
      const copies = rgb[2] ? Number(rgb[2]) : 1;
      if (copies < 1) {
        invalid.push(token);
        continue;
      }
      for (const letter of rgb[1] ? [rgb[1].toLowerCase()] : ['r', 'g', 'b']) {
        counts.set(`rgb-${letter}`, (counts.get(`rgb-${letter}`) || 0) + copies);
      }
      continue;
    }
    const m = TOKEN.exec(token);
    if (!m) {
      invalid.push(token);
      continue;
    }
    const prefix = (m[1] || '').toLowerCase();
    const endPrefix = (m[3] || m[1] || '').toLowerCase();
    if (endPrefix !== prefix) {
      invalid.push(token);
      continue;
    }
    let a = Number(m[2]);
    let b = m[4] ? Number(m[4]) : a;
    if (a > b) [a, b] = [b, a];
    const copies = m[5] ? Number(m[5]) : 1;
    const ids = [];
    for (let n = a; n <= b; n++) {
      const id = idFor(prefix, n);
      if (!id) break;
      ids.push(id);
    }
    if (ids.length !== b - a + 1 || copies < 1) {
      invalid.push(token);
      continue;
    }
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + copies);
  }
  return { counts, invalid };
}

const chipLabel = (card) => (['classic', 'promo', 'variant', 'partner'].includes(card.section) ? `${card.code} ${card.name}` : `${card.num} ${card.name}`);

export function initQuickAdd({ onApply }) {
  const dlg = document.getElementById('dlg-quickadd');
  const input = document.getElementById('quickadd-input');
  const preview = document.getElementById('quickadd-preview');
  const buttons = dlg.querySelectorAll('[data-qa]');

  function render() {
    const { counts, invalid } = parseQuickAdd(input.value);
    const copies = [...counts.values()].reduce((a, b) => a + b, 0);
    const parts = [];
    if (counts.size) {
      parts.push(`<p class="qa-summary">${counts.size} card${counts.size === 1 ? '' : 's'}${copies !== counts.size ? ` · ${copies} copies` : ''}</p>`);
      const shown = [...counts].slice(0, 40);
      for (const [id, n] of shown) {
        parts.push(`<span class="qa-chip"><b>${escapeHTML(chipLabel(CARD_BY_ID.get(id)))}</b>${n > 1 ? ` ×${n}` : ''}</span>`);
      }
      if (counts.size > shown.length) parts.push(`<span class="qa-chip">+${counts.size - shown.length} more</span>`);
    }
    for (const bad of invalid) parts.push(`<span class="qa-chip qa-chip--bad" title="Not recognised">${escapeHTML(bad)}</span>`);
    if (!counts.size && !invalid.length && input.value.trim() === '') {
      parts.push(`<p class="hint hint--small">Main set cards are 1–${MAIN_MAX} (secret rares start at ${PRINTED_TOTAL + 1}).</p>`);
    }
    preview.innerHTML = parts.join('');
    for (const b of buttons) b.disabled = !counts.size;
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      dlg.querySelector('[data-qa="owned"]').click();
    }
  });

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const { counts } = parseQuickAdd(input.value);
      if (!counts.size) return;
      if (onApply(btn.dataset.qa, counts)) {
        input.value = '';
        render();
      }
    });
  }

  dlg.addEventListener('dialog:open', () => {
    render();
    setTimeout(() => input.focus(), 60);
  });

  render();
}
