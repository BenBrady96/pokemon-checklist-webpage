import { COLLECTION, CARD_BY_ID } from './collection.js';
import { escapeHTML } from './ui.js';

const TOKEN = /^#?([A-Z]*)(\d{1,4})(?:-([A-Z]*)(\d{1,4}))?(?:X(\d{1,2}))?$/;
const ALIAS = /^(.+?)(?:X(\d{1,2}))?$/;
export function parseQuickAdd(text, collection = COLLECTION) {
  const aliases = collection.quickAdd.aliases || {};
  const counts = new Map();
  const invalid = [];
  const cleaned = text
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*[x×*]\s*(?=\d)/gi, 'x')
    .replace(/\/\s*\d+/g, '');
  for (const token of cleaned.split(/[\s,;]+/).filter(Boolean)) {
    const upper = token.toUpperCase();
    const alias = ALIAS.exec(upper);
    if (aliases[alias[1]]) {
      const copies = alias[2] ? Number(alias[2]) : 1;
      if (copies < 1) {
        invalid.push(token);
        continue;
      }
      for (const id of aliases[alias[1]]) counts.set(id, (counts.get(id) || 0) + copies);
      continue;
    }
    const m = TOKEN.exec(upper);
    if (!m) {
      invalid.push(token);
      continue;
    }
    const prefix = m[1];
    const endPrefix = m[3] || m[1];
    if (endPrefix !== prefix) {
      invalid.push(token);
      continue;
    }
    let a = Number(m[2]);
    let b = m[4] ? Number(m[4]) : a;
    if (a > b) [a, b] = [b, a];
    const copies = m[5] ? Number(m[5]) : 1;
    const sparse = collection.sparseCodes?.has(prefix);
    const ids = [];
    let complete = true;
    for (let n = a; n <= b; n++) {
      const id = collection.codes.get(`${prefix}${n}`);
      if (id) ids.push(id);
      else if (!(sparse && collection.codes.has(String(n)))) complete = false;
    }
    if (!complete || !ids.length || copies < 1) {
      invalid.push(token);
      continue;
    }
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + copies);
  }
  return { counts, invalid };
}

export function initQuickAdd({ onApply }) {
  const dlg = document.getElementById('dlg-quickadd');
  const input = document.getElementById('quickadd-input');
  const preview = document.getElementById('quickadd-preview');
  const buttons = dlg.querySelectorAll('[data-qa]');
  const { placeholder, hint, empty } = COLLECTION.quickAdd;
  if (placeholder) input.placeholder = placeholder;
  if (hint) document.getElementById('quickadd-hint').innerHTML = hint;

  function render() {
    const { counts, invalid } = parseQuickAdd(input.value);
    const copies = [...counts.values()].reduce((a, b) => a + b, 0);
    const parts = [];
    if (counts.size) {
      parts.push(`<p class="qa-summary">${counts.size} card${counts.size === 1 ? '' : 's'}${copies !== counts.size ? ` · ${copies} copies` : ''}</p>`);
      const shown = [...counts].slice(0, 40);
      for (const [id, n] of shown) {
        parts.push(`<span class="qa-chip"><b>${escapeHTML(CARD_BY_ID.get(id).chipText)}</b>${n > 1 ? ` ×${n}` : ''}</span>`);
      }
      if (counts.size > shown.length) parts.push(`<span class="qa-chip">+${counts.size - shown.length} more</span>`);
    }
    for (const bad of invalid) parts.push(`<span class="qa-chip qa-chip--bad" title="Not recognised">${escapeHTML(bad)}</span>`);
    if (!counts.size && !invalid.length && input.value.trim() === '' && empty) {
      parts.push(`<p class="hint hint--small">${escapeHTML(empty)}</p>`);
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
