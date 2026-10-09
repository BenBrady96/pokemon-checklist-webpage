import * as storage from './storage.js';
import { loadCatalog } from './catalog.js';
import { readHistory, recordSnapshot } from './history.js';
import { formatMoney } from './pricing.js';
import { collectionWorth } from './worth.js';

const html = document.documentElement;
const THEME_ICONS = { system: 'i-monitor', light: 'i-sun', dark: 'i-moon' };
const CURRENCY_LABELS = { gbp: '£ GBP', usd: '$ USD', eur: '€ EUR' };
let latest = null;
let worthRun = 0;

function applyTheme() {
  const { theme } = storage.getPrefs();
  if (theme === 'light' || theme === 'dark') html.dataset.theme = theme;
  else delete html.dataset.theme;
  for (const b of document.querySelectorAll('[data-theme-choice]')) b.setAttribute('aria-pressed', String(b.dataset.themeChoice === theme));
  for (const use of document.querySelectorAll('[data-theme-icon] use')) use.setAttribute('href', `#${THEME_ICONS[theme] || THEME_ICONS.system}`);
}

function applyCurrency() {
  const { currency } = storage.getPrefs();
  for (const b of document.querySelectorAll('[data-currency-choice]')) b.setAttribute('aria-pressed', String(b.dataset.currencyChoice === currency));
  for (const el of document.querySelectorAll('[data-currency-label]')) el.textContent = CURRENCY_LABELS[currency] || CURRENCY_LABELS.gbp;
  paintPill();
}

function pillText() {
  const { currency } = storage.getPrefs();
  if (latest) return latest.unique ? formatMoney(latest.usd, { currency, rates: latest.rates, short: true }) : '';
  const last = readHistory().at(-1);
  return last?.u ? formatMoney(last.v, { currency, rates: { gbp: last.r, eur: last.e }, short: true }) : '';
}

function paintPill() {
  const box = document.querySelector('[data-portfolio-value]');
  if (!box) return;
  const text = pillText();
  box.textContent = text || 'Portfolio';
  box.closest('[data-portfolio-pill]').setAttribute('aria-label', text ? `Portfolio: ${text}` : 'Portfolio');
}

export function showWorth(worth) {
  if (!worth.loaded) return;
  latest = worth;
  paintPill();
}

export async function refreshWorth() {
  if (!document.querySelector('[data-portfolio-value]')) return;
  const run = ++worthRun;
  const catalog = await loadCatalog().catch(() => null);
  if (!catalog || run !== worthRun) return;
  const ids = storage.storedCollections().map(({ id }) => id).filter((id) => catalog.collections.some((c) => c.id === id));
  const worth = await collectionWorth(ids);
  if (run !== worthRun || !worth.loaded) return;
  recordSnapshot(worth);
  showWorth(worth);
}

function invokerOf(pop) {
  return [...document.querySelectorAll(`[popovertarget="${pop.id}"]`)].find((b) => b.getClientRects().length);
}

function place(pop) {
  const invoker = invokerOf(pop);
  if (!invoker) return;
  const r = invoker.getBoundingClientRect();
  pop.style.top = `${Math.round(r.bottom + 8)}px`;
  pop.style.right = `${Math.max(8, Math.round(document.documentElement.clientWidth - r.right))}px`;
}

const closePopovers = () => {
  for (const pop of document.querySelectorAll('.pop:popover-open')) pop.hidePopover();
};

export function initHeader() {
  applyTheme();
  applyCurrency();
  for (const pop of document.querySelectorAll('.pop[popover]')) {
    pop.addEventListener('beforetoggle', (e) => {
      if (e.newState === 'open') place(pop);
    });
  }
  window.addEventListener('scroll', closePopovers, { passive: true });
  window.addEventListener('resize', closePopovers);
  document.addEventListener('click', (e) => {
    const theme = e.target.closest('[data-theme-choice]');
    const currency = e.target.closest('[data-currency-choice]');
    if (theme) storage.setPref('theme', theme.dataset.themeChoice);
    if (currency) storage.setPref('currency', currency.dataset.currencyChoice);
    const item = e.target.closest('.pop button, .pop a');
    if (item) item.closest('.pop').hidePopover();
  });
  storage.onPrefChange((key) => {
    if (key === 'theme') applyTheme();
    if (key === 'currency') applyCurrency();
  });
  const back = document.querySelector('[data-back]');
  back?.addEventListener('click', (e) => {
    let sameSite = false;
    try {
      sameSite = new URL(document.referrer).origin === location.origin;
    } catch {}
    if (sameSite && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}
