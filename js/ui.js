export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let historyArmed = false;
let skipNextPop = false;

function armHistory() {
  if (historyArmed) return;
  history.pushState({ p30cDialog: true }, '');
  historyArmed = true;
}

function disarmHistory() {
  if (!historyArmed) return;
  historyArmed = false;
  skipNextPop = true;
  history.back();
}

window.addEventListener('popstate', () => {
  if (skipNextPop) {
    skipNextPop = false;
    return;
  }
  if (!historyArmed) return;
  historyArmed = false;
  const top = [...document.querySelectorAll('dialog[open]')].pop();
  if (top) {
    top.dataset.viaHistory = '1';
    closeDialog(top);
  }
});

export const openDialogs = () => [...document.querySelectorAll('dialog[open]')];

export function openDialog(dlg) {
  if (dlg.open && !dlg.classList.contains('is-closing')) return;
  for (const other of openDialogs()) if (other !== dlg) closeDialog(other, { instant: true });
  if (dlg.open) finishClose(dlg);
  dlg.showModal();
  armHistory();
  dlg.dispatchEvent(new CustomEvent('dialog:open'));
}

function finishClose(dlg) {
  clearTimeout(dlg._closeTimer);
  dlg.classList.remove('is-closing');
  if (dlg.open) dlg.close();
}

export function closeDialog(dlg, { instant = false } = {}) {
  if (!dlg.open || dlg.classList.contains('is-closing')) return;
  if (instant || reducedMotion()) {
    finishClose(dlg);
    return;
  }
  dlg.classList.add('is-closing');
  dlg.addEventListener('animationend', () => finishClose(dlg), { once: true });
  dlg._closeTimer = setTimeout(() => finishClose(dlg), 320);
}

export function initDialogs() {
  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDialog(dlg);
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) closeDialog(dlg);
      else if (e.target.closest('[data-close]')) closeDialog(dlg);
    });
    dlg.addEventListener('close', () => {
      const viaHistory = dlg.dataset.viaHistory === '1';
      delete dlg.dataset.viaHistory;
      queueMicrotask(() => {
        if (!viaHistory && !openDialogs().length) disarmHistory();
      });
    });
  }
}

export function confirmAction({ title, text, confirmLabel = 'Confirm' }) {
  const dlg = document.getElementById('dlg-confirm');
  dlg.querySelector('#confirm-title').textContent = title;
  dlg.querySelector('#confirm-text').textContent = text;
  const yes = dlg.querySelector('[data-confirm="yes"]');
  const no = dlg.querySelector('[data-confirm="no"]');
  yes.textContent = confirmLabel;
  return new Promise((resolve) => {
    let answer = false;
    const onClick = (e) => {
      const btn = e.target.closest('[data-confirm]');
      if (!btn) return;
      answer = btn.dataset.confirm === 'yes';
      closeDialog(dlg);
    };
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('close', () => {
      dlg.removeEventListener('click', onClick);
      resolve(answer);
    }, { once: true });
    openDialog(dlg);
    no.focus();
  });
}

const region = document.getElementById('toasts');
const popoverSupported = typeof region.showPopover === 'function';
if (popoverSupported) region.popover = 'manual';

function removeToast(el) {
  clearTimeout(el._timer);
  el.remove();
  if (popoverSupported && !region.children.length && region.matches(':popover-open')) region.hidePopover();
}

function dismissToast(el) {
  if (el.classList.contains('is-leaving')) return;
  clearTimeout(el._timer);
  el.classList.add('is-leaving');
  el.addEventListener('animationend', () => removeToast(el), { once: true });
  setTimeout(() => removeToast(el), 400);
}

export function toast(message, { action, icon, timeout = 4500 } = {}) {
  for (const old of [...region.children]) removeToast(old);
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  if (icon) el.insertAdjacentHTML('beforeend', `<svg class="toast__icon" aria-hidden="true"><use href="#${icon}"/></svg>`);
  const msg = document.createElement('span');
  msg.className = 'toast__msg';
  msg.textContent = message;
  el.append(msg);
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast__action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      dismissToast(el);
      action.onClick();
    });
    el.append(btn);
  }
  region.append(el);
  if (popoverSupported) {
    if (region.matches(':popover-open')) region.hidePopover();
    region.showPopover();
  }
  const arm = (ms) => {
    clearTimeout(el._timer);
    el._timer = setTimeout(() => dismissToast(el), ms);
  };
  arm(timeout);
  el.addEventListener('pointerenter', () => clearTimeout(el._timer));
  el.addEventListener('pointerleave', () => arm(2000));
  return el;
}

const announcer = document.getElementById('announcer');

export function announce(text) {
  announcer.textContent = '';
  requestAnimationFrame(() => {
    announcer.textContent = text;
  });
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    (openDialogs().pop() || document.body).append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function vibrate(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
