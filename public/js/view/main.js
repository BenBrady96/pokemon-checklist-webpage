import { fetchView, useView } from '../core/collection.js';
import { GAMES } from '../games/index.js';
import { asset } from '../core/paths.js';
import { buildView, viewPrices } from '../core/view.js';
import { decodeViewShare } from '../trade/trade-code.js';
import { sharedBackend, viewBackend } from './backend.js';

const root = document.documentElement;

async function injectShell(game) {
  const res = await fetch(asset(`data/${game}/views/shell.txt`));
  if (!res.ok) throw new Error(`shell: HTTP ${res.status}`);
  const tpl = document.createElement('template');
  tpl.innerHTML = await res.text();
  const shell = tpl.content;
  const page = document.querySelector('[data-view-hero]');
  shell.querySelector('.set-hero__id').replaceWith(page.querySelector('.set-hero__id'));
  shell.querySelector('.about').replaceWith(document.querySelector('[data-view-about]'));
  page.remove();
  document.body.append(shell);
}

const sharedCode = () => /^#v=([A-Za-z0-9_-]+)$/.exec(location.hash)?.[1] || null;

async function readShared() {
  const code = sharedCode();
  if (!code) return null;
  const decoded = await decodeViewShare(code);
  return decoded && typeof decoded === 'object' && decoded.kind === 'view' ? decoded : { invalid: true };
}

try {
  const [raw, shared] = await Promise.all([fetchView(root.dataset.viewId), readShared(), injectShell(root.dataset.game)]);
  const { hideLoader } = await import('../shared/ui.js');
  const model = buildView(raw, { game: GAMES[raw.game], asset });
  const usable = shared && !shared.invalid ? shared : null;
  model.shared = usable;
  model.invalidShare = Boolean(shared?.invalid);
  model.backend = usable ? sharedBackend(model, usable, () => model.onBlocked?.()) : viewBackend(model);
  useView(model, viewPrices(raw, model));
  await import('../set/app.js');
  requestAnimationFrame(() => hideLoader());
  window.addEventListener('hashchange', () => {
    if (sharedCode() || model.shared) location.reload();
  });
} catch (err) {
  console.error(err);
  document.getElementById('page-loader')?.remove();
  const banner = document.getElementById('load-error');
  if (banner) banner.removeAttribute('hidden');
  else document.getElementById('view-load-error')?.removeAttribute('hidden');
}
