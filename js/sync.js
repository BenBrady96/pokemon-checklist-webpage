import { asset } from './paths.js';
import { codeSize, copiesOf, parseSyncText } from './codec.js';
import { openDialog, closeDialog } from './ui.js';

export {
  encodeCollection, decodeCode, resolveCode, codeSize, parseSyncText, parseBackup, copiesOf,
} from './codec.js';

export const shareUrl = (collectionId, code) => `${asset(`${collectionId}/`)}#sync=${code}`;

let qrLoader = null;

function loadQrLibrary() {
  qrLoader ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = asset('js/vendor/qrcode.js');
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

export function exportFile(collections) {
  const data = {
    app: 'binder-tracker',
    version: 2,
    exported: new Date().toISOString(),
    collections: Object.fromEntries(Object.entries(collections).map(([id, cards]) => [id, { cards }])),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `binder-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const sum = (values) => values.reduce((a, b) => a + b, 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const SOURCE_LABELS = { file: 'In the file', link: 'In the link', code: 'In the code' };

export function askIncoming({ source, single, multi }) {
  const dlg = document.getElementById('dlg-sync');
  const field = (name) => dlg.querySelector(`[data-sync="${name}"]`);
  field('source-label').textContent = SOURCE_LABELS[source];
  const names = field('names');
  if (single) {
    const incoming = Object.keys(single.incoming).length;
    const current = Object.keys(single.current).length;
    field('incoming').textContent = `${incoming} / ${single.total}`;
    field('incoming-copies').textContent = plural(copiesOf(single.incoming), 'copy', 'copies');
    field('current').textContent = `${current} / ${single.total}`;
    field('current-copies').textContent = plural(copiesOf(single.current), 'copy', 'copies');
    names.hidden = true;
  } else {
    const count = (key) => sum(multi.entries.map((e) => Object.keys(e[key]).length));
    const copies = (key) => sum(multi.entries.map((e) => copiesOf(e[key])));
    field('incoming').textContent = plural(count('incoming'), 'card', 'cards');
    field('incoming-copies').textContent = `${plural(copies('incoming'), 'copy', 'copies')} · ${plural(multi.entries.length, 'set', 'sets')}`;
    field('current').textContent = plural(count('current'), 'card', 'cards');
    field('current-copies').textContent = plural(copies('current'), 'copy', 'copies');
    names.textContent = multi.entries.map((e) => e.name).join(' · ');
    names.hidden = false;
  }
  dlg.querySelector('[data-sync-choice="view"]').hidden = !single || source === 'file';
  field('hint-single').hidden = !single;
  field('hint-multi').hidden = Boolean(single);

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

export function initImport({ onImport, describe }) {
  const dlg = document.getElementById('dlg-import');
  const input = document.getElementById('import-code');
  const status = document.getElementById('import-status');
  const submit = document.getElementById('import-submit');

  function render() {
    const text = input.value.trim();
    const incoming = parseSyncText(text);
    let message = '';
    if (incoming) {
      const sizes = incoming.decoded.map(codeSize);
      const cards = sum(sizes.map((s) => s.cards));
      const copies = sum(sizes.map((s) => s.copies));
      const what = describe(incoming.decoded);
      message = `✓ ${what ? `${what} · ` : ''}${plural(cards, 'card', 'cards')} · ${plural(copies, 'copy', 'copies')}`;
    } else if (text) {
      message = 'That isn’t a valid sync code or link.';
    }
    status.textContent = message;
    status.classList.toggle('is-ok', Boolean(incoming));
    status.classList.toggle('is-bad', Boolean(text) && !incoming);
    submit.disabled = !incoming;
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit.click();
    }
  });
  submit.addEventListener('click', async () => {
    const incoming = parseSyncText(input.value);
    if (incoming && await onImport(incoming)) input.value = '';
  });
  dlg.addEventListener('dialog:open', () => {
    render();
    setTimeout(() => input.focus(), 60);
  });
  return { render };
}
