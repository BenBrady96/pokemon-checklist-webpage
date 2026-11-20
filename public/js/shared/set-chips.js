import { groupByGame } from '../core/catalog.js';
import { el } from './dom.js';

export function paintSetChips(box, { catalog, ids, chosen, nameOf, onToggle }) {
  const chip = (id) => el('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': String(chosen.has(id)),
    onclick: () => onToggle([id], !chosen.has(id)),
  }, nameOf(id));
  const groups = groupByGame(catalog, ids);
  box.replaceChildren(...(groups.length > 1
    ? groups.flatMap(({ game, ids: gameIds }) => [
      el('div', { class: 'xp-game' },
        el('span', { class: 'xp-game__name', text: game.name }),
        el('button', { type: 'button', class: 'link-btn', onclick: () => onToggle(gameIds, true) }, 'All'),
        el('button', { type: 'button', class: 'link-btn', onclick: () => onToggle(gameIds, false) }, 'None')),
      ...gameIds.map(chip),
    ])
    : ids.map(chip)));
}
