const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function rarityMark({ icon, abbr, tone, name, wide }, cls = 'rar') {
  if (icon) return `<svg class="${cls}${wide ? ' rar--wide' : ''}" aria-hidden="true"><use href="#${icon}"/></svg>`;
  return `<span class="${cls} rar--pill" data-tone="${escape(tone || 'base')}" title="${escape(name)}" aria-hidden="true">${escape(abbr || name)}</span>`;
}
