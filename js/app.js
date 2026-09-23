import { CARDS, CARD_BY_ID, SECTIONS, RARITIES, GROUPS, normalize } from './cards.js';
import * as store from './store.js';
import {
  refs, buildCards, updateCard, mount, applyVisibility, updateSectionCounts, updateImageSources, rarityIconById,
} from './render.js';
import { initGestures } from './gestures.js';
import { initViewer } from './viewer.js';
import { compute, percent, renderStats, missingText, duplicatesText } from './stats.js';
import { initQuickAdd } from './quickadd.js';
import { shareUrl, renderQr, exportFile, parseBackup, decodeCollection, askIncoming } from './sync.js';
import { celebrate } from './confetti.js';
import { initPWA, offlineSupported, countSavedImages, saveImagesOffline } from './pwa.js';
import {
  initDialogs, openDialog, closeDialog, openDialogs, toast, announce, confirmAction, copyText, reducedMotion,
} from './ui.js';

const html = document.documentElement;
const root = document.getElementById('collection');
const topbar = document.getElementById('topbar');
const appbar = document.getElementById('appbar');
const toolbar = document.querySelector('.toolbar');
const mobileSearch = document.getElementById('mobile-search');
const jumpbar = document.getElementById('jumpbar');
const refreshChip = document.getElementById('refresh-chip');
const emptyState = document.getElementById('empty-state');
const previewBanner = document.getElementById('preview-banner');
const bottombar = document.querySelector('.bottombar');

const DIALOGS = {
  filters: 'dlg-filters', view: 'dlg-view', menu: 'dlg-menu', stats: 'dlg-stats',
  quickadd: 'dlg-quickadd', share: 'dlg-share', help: 'dlg-help',
};
const JUMPS = [
  { id: 'main', label: 'Main Set' },
  { id: 'pikachu', label: 'Pikachu Rares', icon: 'r-pikachu' },
  { id: 'secret', label: 'Secret Rares' },
  { id: 'classic', label: 'Classic' },
  { id: 'energy', label: 'Energy' },
];

const desktopQuery = matchMedia('(min-width: 900px)');
const isDesktop = () => desktopQuery.matches;
const isTouch = matchMedia('(pointer: coarse)').matches;

const filters = { status: 'all', rarities: new Set(), sections: new Set(), tokens: [] };
let gestures;
let viewer;
let previewCounts = null;
let completedGroups = null;
let celebrateNext = false;

function matches(card) {
  const q = store.getQty(card.id);
  if (filters.status === 'owned' && !q) return false;
  if (filters.status === 'missing' && q) return false;
  if (filters.status === 'dupes' && q < 2) return false;
  if (filters.rarities.size && !filters.rarities.has(card.rarity)) return false;
  if (filters.sections.size && !filters.sections.has(card.section)) return false;
  return filters.tokens.every((t) => card.search.includes(` ${t}`));
}

function shownIds() {
  return [...refs.values()].filter((r) => !r.li.hidden && !r.li.classList.contains('is-dim')).map((r) => r.card.id);
}

function applyFilters() {
  const binder = store.getPrefs().view === 'binder';
  const shown = applyVisibility(root, matches, { dimOnly: binder });
  emptyState.hidden = binder || shown > 0;
  refreshChip.hidden = true;
  for (const el of document.querySelectorAll('[data-filter-result]')) {
    el.textContent = `Show ${shown} card${shown === 1 ? '' : 's'}`;
  }
  gestures?.resetRoving();
}

const activeFilterCount = () => (filters.status !== 'all' ? 1 : 0) + filters.rarities.size + filters.sections.size;

function filtersChanged() {
  applyFilters();
  syncControls();
  requestAnimationFrame(() => updateImageSources(root, store.getPrefs().images));
}

function clearFilters() {
  filters.status = 'all';
  filters.rarities.clear();
  filters.sections.clear();
  filters.tokens = [];
  for (const input of document.querySelectorAll('[data-search]')) input.value = '';
  filtersChanged();
}

function setQuery(text) {
  filters.tokens = normalize(text).split(/\s+/).filter(Boolean);
  applyFilters();
  syncControls();
  const top = root.getBoundingClientRect().top + window.scrollY - stickyTop() - 8;
  if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top) });
  requestAnimationFrame(() => updateImageSources(root, store.getPrefs().images));
}

let staleQueued = false;
function queueStaleCheck() {
  if (staleQueued) return;
  staleQueued = true;
  requestAnimationFrame(() => {
    staleQueued = false;
    if (gestures.isPainting()) return;
    if (store.getPrefs().view === 'binder') {
      applyFilters();
      return;
    }
    if (filters.status === 'all') return;
    let stale = 0;
    for (const r of refs.values()) if (!r.li.hidden && !matches(r.card)) stale++;
    refreshChip.hidden = !stale;
    refreshChip.querySelector('span').textContent = `${stale} card${stale === 1 ? '' : 's'} changed · Update list`;
  });
}

function applyPrefs() {
  const p = store.getPrefs();
  html.dataset.view = p.view;
  html.dataset.size = p.size;
  html.dataset.mode = p.mode;
  html.dataset.images = p.images ? 'on' : 'off';
  html.dataset.dim = p.dim ? 'on' : 'off';
  if (p.theme === 'light' || p.theme === 'dark') html.dataset.theme = p.theme;
  else delete html.dataset.theme;
  syncControls();
}

function syncControls() {
  const p = store.getPrefs();
  for (const b of document.querySelectorAll('[data-pref][data-value]')) {
    b.setAttribute('aria-pressed', String(String(p[b.dataset.pref]) === b.dataset.value));
  }
  for (const b of document.querySelectorAll('[data-pref-toggle]')) {
    b.setAttribute(b.getAttribute('role') === 'switch' ? 'aria-checked' : 'aria-pressed', String(Boolean(p[b.dataset.prefToggle])));
  }
  for (const s of document.querySelectorAll('[data-pref-select]')) s.value = p[s.dataset.prefSelect];
  for (const b of document.querySelectorAll('[data-filter="status"]')) {
    b.setAttribute('aria-pressed', String(b.dataset.value === filters.status));
  }
  for (const b of document.querySelectorAll('[data-filter-toggle]')) {
    const set = b.dataset.filterToggle === 'rarity' ? filters.rarities : filters.sections;
    b.setAttribute('aria-pressed', String(set.has(b.dataset.value)));
  }
  const modeBtn = document.querySelector('.bottombar__mode');
  modeBtn.dataset.mode = p.mode;
  modeBtn.querySelector('use').setAttribute('href', p.mode === 'count' ? '#i-mode-count' : '#i-mode-check');
  modeBtn.querySelector('[data-mode-label]').textContent = p.mode === 'count' ? 'Count' : 'Check';
  modeBtn.setAttribute('aria-label', `Tap mode: ${p.mode === 'count' ? 'count copies' : 'check off'}. Switch mode`);
  document.querySelector('[data-view-icon] use').setAttribute('href', `#i-${p.view}`);
  const n = activeFilterCount();
  for (const el of document.querySelectorAll('[data-filter-count]')) {
    el.hidden = !n;
    el.textContent = n;
  }
}

store.onPrefChange((key) => {
  applyPrefs();
  if (key === 'view' || key === 'sort' || key === 'pockets') remount(true);
  else if (key === 'size' || key === 'images') requestAnimationFrame(() => updateImageSources(root, store.getPrefs().images));
  if (key === 'mode') {
    const count = store.getPrefs().mode === 'count';
    toast(count ? 'Count mode: each tap adds a copy. Use − to remove one.' : 'Check mode: tap to mark cards owned.', {
      icon: count ? 'i-mode-count' : 'i-mode-check',
      timeout: 3200,
    });
  }
});

let collapsed = false;
let lastScrollY = window.scrollY;
let programmaticScrollUntil = 0;

const stickyTop = () => topbar.offsetHeight - (collapsed ? collapseDistance() : 0);
const sectionHeadHeight = () => root.querySelector('.sec__head')?.offsetHeight || 0;

function collapseDistance() {
  return appbar.offsetHeight + (isDesktop() ? toolbar.offsetHeight : 0);
}

function updateStickyTop() {
  html.style.setProperty('--topbar-shift', collapsed ? `${-collapseDistance()}px` : '0px');
  html.style.setProperty('--sticky-top', `${stickyTop()}px`);
}

function setCollapsed(value) {
  if (value && !isDesktop() && !mobileSearch.hidden) value = false;
  if (value === collapsed) return;
  collapsed = value;
  updateStickyTop();
}

function onScroll() {
  const y = window.scrollY;
  const dy = y - lastScrollY;
  if (y < 80) setCollapsed(false);
  else if (performance.now() > programmaticScrollUntil && !gestures.isPainting()) {
    if (dy > 10) setCollapsed(true);
    else if (dy < -10) setCollapsed(false);
  }
  if (Math.abs(dy) > 10 || y < 80) lastScrollY = y;
  updateScrollSpy();
}

function buildJumpbar() {
  jumpbar.innerHTML = JUMPS.map((j) => `<button type="button" class="jump" data-jump="${j.id}" aria-current="false">`
    + `${j.icon ? `<svg class="rar" aria-hidden="true"><use href="#${j.icon}"/></svg>` : ''}`
    + `<span>${j.label}</span><span class="jump__count" data-jump-count="${j.id}"></span></button>`).join('');
}

function updateJumpbarVisibility() {
  const p = store.getPrefs();
  jumpbar.closest('.jumpbar').hidden = p.view !== 'binder' && p.sort !== 'set';
}

let spyQueued = false;
function updateScrollSpy() {
  if (spyQueued) return;
  spyQueued = true;
  requestAnimationFrame(() => {
    spyQueued = false;
    if (jumpbar.closest('.jumpbar').hidden) return;
    const line = stickyTop() + 72;
    let active = null;
    for (const sec of root.querySelectorAll('.sec:not([hidden])')) {
      if (sec.getBoundingClientRect().top <= line) active = sec.dataset.section;
    }
    active ||= root.querySelector('.sec:not([hidden])')?.dataset.section;
    if (active === 'main') {
      const first = refs.get('m023').li;
      const last = refs.get('m052').li;
      if (!first.hidden && first.getBoundingClientRect().top <= line && last.getBoundingClientRect().bottom >= line) active = 'pikachu';
    }
    for (const btn of jumpbar.children) {
      const on = btn.dataset.jump === active;
      if ((btn.getAttribute('aria-current') === 'true') === on) continue;
      btn.setAttribute('aria-current', String(on));
      if (on) {
        const left = btn.offsetLeft - 16;
        if (left < jumpbar.scrollLeft || btn.offsetLeft + btn.offsetWidth > jumpbar.scrollLeft + jumpbar.clientWidth) {
          jumpbar.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
        }
      }
    }
  });
}

function scrollToElement(el, { smooth = true } = {}) {
  const docTop = el.getBoundingClientRect().top + window.scrollY;
  const goingDown = docTop > window.scrollY + 10;
  const headerSpace = topbar.offsetHeight - (goingDown ? collapseDistance() : 0);
  const extra = el.classList.contains('card') ? sectionHeadHeight() + 8 : 0;
  const y = Math.max(0, docTop - headerSpace - extra);
  setCollapsed(goingDown && y > 80);
  programmaticScrollUntil = performance.now() + 900;
  window.scrollTo({ top: y, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
}

function jumpTo(id) {
  const target = id === 'pikachu' ? refs.get('m023').li : document.getElementById(`sec-${id}`);
  if (!target || target.hidden || target.closest('[hidden]')) {
    toast('That part of the set is hidden by your filters.', {
      action: { label: 'Clear filters', onClick: () => { clearFilters(); jumpTo(id); } },
    });
    return;
  }
  scrollToElement(target);
}

function firstCardInView() {
  if (window.scrollY < 120) return null;
  const line = stickyTop() + sectionHeadHeight();
  for (const li of root.querySelectorAll('.card:not([hidden])')) {
    if (li.getBoundingClientRect().bottom > line) return li;
  }
  return null;
}

function remount(keepPosition = false) {
  const anchor = keepPosition ? firstCardInView() : null;
  const p = store.getPrefs();
  mount(root, { view: p.view, sort: p.sort, pockets: p.pockets });
  updateJumpbarVisibility();
  applyFilters();
  updateSectionCounts(root);
  requestAnimationFrame(() => {
    updateStickyTop();
    updateImageSources(root, p.images);
    if (anchor && !anchor.hidden) scrollToElement(anchor, { smooth: false });
    updateScrollSpy();
  });
}

let statsQueued = false;
function queueStats() {
  if (statsQueued) return;
  statsQueued = true;
  requestAnimationFrame(() => {
    statsQueued = false;
    refreshStats();
  });
}

function refreshStats() {
  const s = compute();
  const master = s.byGroup.master;
  html.toggleAttribute('data-has-owned', master.owned > 0);
  document.querySelector('[data-stat="owned"]').textContent = master.owned;
  document.querySelector('[data-stat="total"]').textContent = master.total;
  document.querySelector('[data-stat="pct"]').textContent = `${percent(master.owned, master.total)}%`;
  document.querySelector('[data-stat="bar"]').style.setProperty('--p', master.owned / master.total);
  for (const el of jumpbar.querySelectorAll('[data-jump-count]')) {
    const g = s.byGroup[el.dataset.jumpCount];
    el.textContent = `${g.owned}/${g.total}`;
    el.parentElement.classList.toggle('is-complete', g.owned === g.total);
  }
  for (const el of document.querySelectorAll('[data-rarity-count]')) {
    const g = s.byRarity[el.dataset.rarityCount];
    el.textContent = `${g.owned}/${g.total}`;
  }
  for (const el of document.querySelectorAll('[data-section-count]')) {
    const g = s.bySection[el.dataset.sectionCount];
    el.textContent = `${g.owned}/${g.total}`;
  }
  updateSectionCounts(root);
  if (document.getElementById('dlg-stats').open) document.getElementById('stats-body').innerHTML = renderStats(s);
  if (store.isPreview()) previewBanner.querySelector('[data-preview-count]').textContent = `· ${s.owned} of ${s.total} cards`;
  checkMilestones(s);
}

function checkMilestones(s) {
  const done = new Set(GROUPS.filter((g) => s.byGroup[g.id].owned === s.byGroup[g.id].total).map((g) => g.id));
  if (completedGroups && celebrateNext) {
    const fresh = GROUPS.filter((g) => done.has(g.id) && !completedGroups.has(g.id));
    if (fresh.length) {
      const best = fresh[fresh.length - 1];
      toast(`${best.name} complete! Congratulations!`, { icon: 'i-sparkle', timeout: 6000 });
      announce(`${best.name} complete`);
      if (!reducedMotion()) celebrate();
    }
  }
  completedGroups = done;
  celebrateNext = false;
}

const undoAction = () => ({ label: 'Undo', onClick: doUndo });

function doUndo() {
  if (store.isPreview()) return blocked();
  const entry = store.undo();
  if (!entry) {
    toast('Nothing to undo');
    return;
  }
  toast(`Undone: ${store.describe(entry).toLowerCase()}`, { icon: 'i-undo', action: { label: 'Redo', onClick: doRedo } });
}

function doRedo() {
  if (store.isPreview()) return blocked();
  const entry = store.redo();
  toast(entry ? `Redone: ${store.describe(entry).toLowerCase()}` : 'Nothing to redo', entry ? { action: undoAction() } : {});
}

function blocked() {
  toast('You’re viewing a shared collection. Exit to edit your own.', {
    action: { label: 'Exit', onClick: exitPreview },
  });
}

function onCommit(entry, info) {
  if (!entry) return;
  store.requestPersistence();
  const summary = store.describe(entry);
  announce(summary);
  if (entry.diffs.size === 1 && info.kind !== 'quickadd' && info.kind !== 'bulk') {
    const [[id, d]] = entry.diffs;
    if (d.from > 1 && d.to === 0) {
      toast(`Unmarked ${CARD_BY_ID.get(id).name} (had ${d.from} copies)`, { action: undoAction() });
    }
  } else {
    toast(summary, { icon: 'i-check', action: undoAction() });
  }
  queueStaleCheck();
}

function bulk(ids, kind) {
  if (store.isPreview()) return blocked();
  const entry = store.update(ids.map((id) => [id, kind === 'mark' ? Math.max(store.getQty(id), 1) : 0]));
  if (!entry) {
    toast(kind === 'mark' ? 'Those cards are already marked.' : 'None of those cards are marked.');
    return;
  }
  onCommit(entry, { kind: 'bulk' });
}

store.subscribe((ids, meta) => {
  if (ids) for (const id of ids) updateCard(id);
  else for (const id of refs.keys()) updateCard(id);
  if (meta.source !== 'external' && meta.source !== 'preview') celebrateNext = true;
  queueStats();
  if (!ids) applyFilters();
  else if (!gestures.isPainting()) queueStaleCheck();
});

function enterPreview(counts) {
  previewCounts = counts;
  store.enterPreview(counts);
  previewBanner.hidden = false;
  updateStickyTop();
  window.scrollTo({ top: 0 });
}

function exitPreview({ quiet = false } = {}) {
  if (!store.isPreview()) return;
  store.exitPreview();
  previewCounts = null;
  previewBanner.hidden = true;
  updateStickyTop();
  if (!quiet) toast('Back to your collection');
}

function applyIncoming(choice, counts) {
  if (!choice) return;
  if (choice === 'view') {
    enterPreview(counts);
    return;
  }
  const entry = choice === 'merge' ? store.mergeAll(counts) : store.replaceAll(counts);
  if (!entry) {
    toast('Your collection already matches.');
    return;
  }
  store.requestPersistence();
  toast(choice === 'merge' ? `Merged: ${store.describe(entry).toLowerCase()}` : 'Collection replaced', { icon: 'i-check', action: undoAction() });
}

async function checkIncomingLink() {
  const m = /^#sync=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  const counts = decodeCollection(m[1]);
  if (!counts) {
    toast('That sync link isn’t valid.');
    return;
  }
  exitPreview({ quiet: true });
  applyIncoming(await askIncoming(counts, { source: 'link' }), counts);
}

function prepareShare() {
  const url = shareUrl(store.snapshot());
  document.getElementById('share-url').value = url;
  renderQr(document.getElementById('share-qr'), url);
  document.querySelector('[data-action="native-share"]').hidden = typeof navigator.share !== 'function';
}

const formatAgo = (ts) => {
  const days = Math.floor((Date.now() - ts) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

async function prepareMenu() {
  const shown = shownIds().length;
  document.querySelector('[data-shown-count]').textContent = `Applies to the ${shown} card${shown === 1 ? '' : 's'} currently shown`;
  const last = store.getPrefs().lastBackup;
  document.querySelector('[data-last-backup]').textContent = last ? `Last backup ${formatAgo(last)}` : 'Save your collection as a file';
  const item = document.querySelector('[data-offline-item]');
  item.hidden = !offlineSupported();
  if (!item.hidden) {
    const saved = await countSavedImages(CARDS.map((c) => c.id));
    document.querySelector('[data-offline-status]').textContent = saved >= CARDS.length
      ? 'All card images saved ✓'
      : saved ? `${saved} of ${CARDS.length} saved — tap to save the rest` : 'Use the checklist with no signal (about 6 MB)';
  }
}

async function saveOffline() {
  closeDialog(document.getElementById('dlg-menu'));
  const t = toast('Saving card images…', { icon: 'i-offline', timeout: 120000 });
  const msg = t.querySelector('.toast__msg');
  const { failed } = await saveImagesOffline(CARDS.map((c) => c.id), (done, total) => {
    msg.textContent = `Saving card images… ${done}/${total}`;
  });
  toast(failed ? `Saved, but ${failed} images failed. Try again on a better connection.` : 'All card images are saved for offline use.', { icon: 'i-check' });
}

async function doReset() {
  if (store.isPreview()) return blocked();
  const owned = store.ownedCount();
  if (!owned) {
    toast('Your collection is already empty.');
    return;
  }
  const ok = await confirmAction({
    title: 'Reset collection?',
    text: `This unmarks all ${owned} cards on this device. You can undo it straight away.`,
    confirmLabel: 'Reset',
  });
  if (!ok) return;
  store.replaceAll({});
  toast('Collection reset', { action: undoAction() });
}

const actions = {
  'open-search'() {
    mobileSearch.hidden = false;
    setCollapsed(false);
    updateStickyTop();
    mobileSearch.querySelector('input').focus();
  },
  'close-search'() {
    const input = mobileSearch.querySelector('input');
    input.blur();
    if (!input.value) {
      mobileSearch.hidden = true;
      updateStickyTop();
    }
  },
  'toggle-mode'() {
    store.setPref('mode', store.getPrefs().mode === 'check' ? 'count' : 'check');
  },
  'clear-filters': clearFilters,
  'refresh-filter': applyFilters,
  'mark-shown'() {
    closeDialog(document.getElementById('dlg-menu'));
    bulk(shownIds(), 'mark');
  },
  'clear-shown'() {
    closeDialog(document.getElementById('dlg-menu'));
    bulk(shownIds(), 'clear');
  },
  export() {
    exportFile(store.snapshot());
    store.setPref('lastBackup', Date.now());
    closeDialog(document.getElementById('dlg-menu'));
    toast('Backup saved to your downloads.', { icon: 'i-download' });
  },
  import() {
    document.getElementById('import-file').click();
  },
  'save-offline': saveOffline,
  reset: doReset,
  async 'copy-missing'() {
    toast((await copyText(missingText())) ? 'Missing list copied.' : 'Couldn’t copy to the clipboard.', { icon: 'i-copy' });
  },
  async 'copy-dupes'() {
    const text = duplicatesText();
    if (!text) {
      toast('No duplicates yet. Switch to Count mode to track extra copies.');
      return;
    }
    toast((await copyText(text)) ? 'Duplicates list copied.' : 'Couldn’t copy to the clipboard.', { icon: 'i-copy' });
  },
  async 'copy-link'() {
    const input = document.getElementById('share-url');
    const ok = await copyText(input.value);
    if (!ok) input.select();
    toast(ok ? 'Link copied.' : 'Select the link and copy it manually.', { icon: 'i-link' });
  },
  'native-share'() {
    navigator.share({
      title: '30th Celebration checklist',
      text: 'My Pokémon TCG 30th Celebration collection',
      url: document.getElementById('share-url').value,
    }).catch(() => {});
  },
  'preview-exit'() {
    exitPreview();
  },
  'preview-merge'() {
    const counts = previewCounts;
    exitPreview({ quiet: true });
    applyIncoming('merge', counts);
  },
};

function openNamed(name) {
  const dlg = document.getElementById(DIALOGS[name]);
  if (!dlg) return;
  if (name === 'stats') document.getElementById('stats-body').innerHTML = renderStats(compute());
  if (name === 'share') prepareShare();
  if (name === 'menu') prepareMenu();
  openDialog(dlg);
}

let sectionTarget = null;
function openSectionMenu(id) {
  sectionTarget = id;
  document.getElementById('section-title').textContent = id === 'all' ? 'All shown cards' : SECTIONS.find((s) => s.id === id).name;
  openDialog(document.getElementById('dlg-section'));
}

function wireControls() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pref][data-value], [data-pref-toggle], [data-filter], [data-filter-toggle], [data-open], [data-action], [data-section-menu], [data-jump]');
    if (!t) return;
    if (t.matches('[data-pref][data-value]')) {
      const key = t.dataset.pref;
      store.setPref(key, key === 'pockets' ? Number(t.dataset.value) : t.dataset.value);
    } else if (t.matches('[data-pref-toggle]')) {
      const key = t.dataset.prefToggle;
      store.setPref(key, !store.getPrefs()[key]);
    } else if (t.matches('[data-filter]')) {
      filters.status = t.dataset.value;
      filtersChanged();
    } else if (t.matches('[data-filter-toggle]')) {
      const set = t.dataset.filterToggle === 'rarity' ? filters.rarities : filters.sections;
      if (set.has(t.dataset.value)) set.delete(t.dataset.value);
      else set.add(t.dataset.value);
      filtersChanged();
    } else if (t.matches('[data-open]')) {
      openNamed(t.dataset.open);
    } else if (t.matches('[data-action]')) {
      actions[t.dataset.action]?.();
    } else if (t.matches('[data-section-menu]')) {
      openSectionMenu(t.dataset.sectionMenu);
    } else if (t.matches('[data-jump]')) {
      jumpTo(t.dataset.jump);
    }
  });

  for (const select of document.querySelectorAll('[data-pref-select]')) {
    select.addEventListener('change', () => store.setPref(select.dataset.prefSelect, select.value));
  }

  document.getElementById('dlg-section').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-section-action]');
    if (!btn) return;
    const ids = shownIds().filter((id) => sectionTarget === 'all' || CARD_BY_ID.get(id).section === sectionTarget);
    closeDialog(document.getElementById('dlg-section'));
    bulk(ids, btn.dataset.sectionAction);
  });

  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (store.isPreview()) return blocked();
    const counts = parseBackup(await file.text());
    if (!counts) {
      toast('That file isn’t a checklist backup.');
      return;
    }
    applyIncoming(await askIncoming(counts, { source: 'file' }), counts);
  });

  let searchTimer = 0;
  for (const input of document.querySelectorAll('[data-search]')) {
    input.addEventListener('input', () => {
      for (const other of document.querySelectorAll('[data-search]')) if (other !== input) other.value = input.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => setQuery(input.value), 120);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        setQuery('');
        input.blur();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isDesktop()) root.querySelector('.card:not([hidden]) .card__hit')?.focus();
        else input.blur();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable]');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && !typing && !openDialogs().length) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if (key === 'y') {
        e.preventDefault();
        doRedo();
      }
      return;
    }
    if (typing || mod || e.altKey || openDialogs().length) return;
    if (e.key === '/') {
      e.preventDefault();
      if (isDesktop()) document.querySelector('.search--desktop input').focus();
      else actions['open-search']();
    } else if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      openNamed('quickadd');
    } else if (e.key === 'm' || e.key === 'M') {
      actions['toggle-mode']();
    } else if (e.key === '?') {
      openNamed('help');
    }
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateStickyTop();
      updateImageSources(root, store.getPrefs().images);
    }, 150);
  });
  new ResizeObserver(updateStickyTop).observe(topbar);
  window.addEventListener('hashchange', checkIncomingLink);

  root.addEventListener('load', (e) => {
    if (e.target.tagName === 'IMG') e.target.parentElement.classList.add('is-loaded');
  }, true);
  root.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.getAttribute('src')) return;
    if (img.src.includes('/lg/')) img.src = img.src.replace('/lg/', '/sm/');
    else img.closest('.card')?.classList.add('no-img');
  }, true);
}

function buildFilterChips() {
  document.getElementById('rarity-chips').innerHTML = RARITIES.filter((r) => r.id !== 'CC' && r.id !== 'E')
    .map((r) => `<button type="button" class="chip" data-filter-toggle="rarity" data-value="${r.id}">${rarityIconById(r.id)}`
      + `<span>${r.name}</span><span class="chip__count" data-rarity-count="${r.id}"></span></button>`)
    .join('');
  document.getElementById('section-chips').innerHTML = SECTIONS
    .map((s) => `<button type="button" class="chip" data-filter-toggle="section" data-value="${s.id}">`
      + `<span>${s.name}</span><span class="chip__count" data-section-count="${s.id}"></span></button>`)
    .join('');
}

function init() {
  initDialogs();
  buildCards();
  buildFilterChips();
  buildJumpbar();
  applyPrefs();

  gestures = initGestures(root, {
    getMode: () => store.getPrefs().mode,
    getInsets: () => ({
      top: stickyTop() + sectionHeadHeight(),
      bottom: isDesktop() ? 0 : bottombar.offsetHeight,
    }),
    onCommit,
    onOpen: (id) => viewer.open(id),
    onBlocked: blocked,
  });
  viewer = initViewer({
    getOrder: () => shownIds(),
    onCommit,
    onBlocked: blocked,
  });
  initQuickAdd({
    onApply(action, counts) {
      if (store.isPreview()) {
        blocked();
        return false;
      }
      const entry = store.update([...counts].map(([id, n]) => {
        const q = store.getQty(id);
        return [id, action === 'add' ? q + n : action === 'owned' ? Math.max(q, 1) : 0];
      }));
      closeDialog(document.getElementById('dlg-quickadd'));
      if (entry) onCommit(entry, { kind: 'quickadd' });
      else toast('No changes — those cards were already marked that way.');
      return true;
    },
  });

  const p = store.getPrefs();
  mount(root, { view: p.view, sort: p.sort, pockets: p.pockets });
  updateJumpbarVisibility();
  applyFilters();
  refreshStats();
  wireControls();
  updateStickyTop();
  requestAnimationFrame(() => {
    updateStickyTop();
    updateImageSources(root, p.images);
    updateScrollSpy();
  });

  if (!store.isStorageOk()) document.getElementById('storage-banner').hidden = false;
  checkIncomingLink();
  initPWA();

  if (!p.tipSeen) {
    setTimeout(() => {
      if (openDialogs().length) return;
      toast(isTouch
        ? 'Tip: tap a card to mark it. Press and hold, then drag, to mark lots at once.'
        : 'Tip: click a card to mark it. Click and drag, or Shift-click, to mark lots at once.', {
        icon: 'i-sparkle',
        timeout: 9000,
        action: { label: 'Got it', onClick() {} },
      });
      store.setPref('tipSeen', true);
    }, 1000);
  }
}

init();
