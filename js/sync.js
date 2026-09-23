import { CARDS, CARD_BY_ID } from './cards.js';
import { clampQty, getQty, ownedCount, MAX_QTY } from './store.js';
import { openDialog, closeDialog } from './ui.js';

const VERSION = 1;

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeCollection(counts) {
  const n = CARDS.length;
  const bits = new Uint8Array(Math.ceil(n / 8));
  const extras = [];
  CARDS.forEach((card, i) => {
    const q = clampQty(counts[card.id]);
    if (q > 0) bits[i >> 3] |= 1 << (i & 7);
    if (q > 1) extras.push(i, Math.min(q, 255));
  });
  const bytes = new Uint8Array(2 + bits.length + extras.length);
  bytes[0] = VERSION;
  bytes[1] = n;
  bytes.set(bits, 2);
  bytes.set(extras, 2 + bits.length);
  return toBase64Url(bytes);
}

export function decodeCollection(code) {
  const bytes = fromBase64Url(code);
  if (!bytes || bytes.length < 2 || bytes[0] !== VERSION) return null;
  const n = bytes[1];
  const bitLength = Math.ceil(n / 8);
  if (bytes.length < 2 + bitLength || (bytes.length - 2 - bitLength) % 2) return null;
  const counts = {};
  for (let i = 0; i < n && i < CARDS.length; i++) {
    if (bytes[2 + (i >> 3)] & (1 << (i & 7))) counts[CARDS[i].id] = 1;
  }
  for (let j = 2 + bitLength; j < bytes.length; j += 2) {
    const card = CARDS[bytes[j]];
    if (card && counts[card.id]) counts[card.id] = Math.min(Math.max(bytes[j + 1], 1), MAX_QTY);
  }
  return counts;
}

export function shareUrl(counts) {
  return `${location.origin}${location.pathname}#sync=${encodeCollection(counts)}`;
}

let qrLoader = null;

function loadQrLibrary() {
  qrLoader ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'js/vendor/qrcode.js';
    script.onload = () => resolve(window.qrcode);
    script.onerror = () => {
      qrLoader = null;
      reject(new Error('QR library failed to load'));
    };
    document.head.append(script);
  });
  return qrLoader;
}

export async function renderQr(container, text) {
  try {
    const qrcode = await loadQrLibrary();
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const size = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
    container.innerHTML = `<svg viewBox="-2 -2 ${size + 4} ${size + 4}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="#0E1433"/></svg>`;
  } catch {
    container.innerHTML = '<p class="hint hint--small">QR code unavailable offline — copy the link instead.</p>';
  }
}

export function exportFile(counts) {
  const data = {
    app: '30th-celebration-checklist',
    version: 1,
    exported: new Date().toISOString(),
    cards: counts,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `30th-celebration-collection-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const cards = data?.cards ?? data?.q;
  if (!cards || typeof cards !== 'object' || Array.isArray(cards)) return null;
  const counts = {};
  for (const [id, n] of Object.entries(cards)) {
    const q = clampQty(n);
    if (q > 0 && CARD_BY_ID.has(id)) counts[id] = q;
  }
  return counts;
}

const sum = (values) => values.reduce((a, b) => a + b, 0);

export function askIncoming(counts, { source }) {
  const dlg = document.getElementById('dlg-sync');
  const field = (name) => dlg.querySelector(`[data-sync="${name}"]`);
  const incomingCards = Object.keys(counts).length;
  const incomingCopies = sum(Object.values(counts));
  const currentCopies = sum(CARDS.map((c) => getQty(c.id)));
  field('source-label').textContent = source === 'file' ? 'In the file' : 'In the link';
  field('incoming').textContent = `${incomingCards} / ${CARDS.length}`;
  field('incoming-copies').textContent = `${incomingCopies} cop${incomingCopies === 1 ? 'y' : 'ies'}`;
  field('current').textContent = `${ownedCount()} / ${CARDS.length}`;
  field('current-copies').textContent = `${currentCopies} cop${currentCopies === 1 ? 'y' : 'ies'}`;
  dlg.querySelector('[data-sync-choice="view"]').hidden = source === 'file';

  return new Promise((resolve) => {
    let choice = null;
    const onClick = (e) => {
      const btn = e.target.closest('[data-sync-choice]');
      if (!btn) return;
      choice = btn.dataset.syncChoice;
      closeDialog(dlg);
    };
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('close', () => {
      dlg.removeEventListener('click', onClick);
      resolve(choice);
    }, { once: true });
    openDialog(dlg);
  });
}
