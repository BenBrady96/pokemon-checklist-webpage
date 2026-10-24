import { asset } from './paths.js';

let catalog = null;

export function loadCatalog() {
  catalog ||= fetch(asset('data/catalog.json')).then((res) => {
    if (!res.ok) throw new Error(`catalog: HTTP ${res.status}`);
    return res.json();
  });
  catalog.catch(() => { catalog = null; });
  return catalog;
}

export const collectionUrl = (id) => asset(`${id}/`);

const indexes = new WeakMap();

function indexOf(data) {
  let index = indexes.get(data);
  if (!index) {
    index = { byId: new Map(), byKey: new Map() };
    for (const c of data.collections) {
      if (!index.byId.has(c.id)) index.byId.set(c.id, c);
      if (!index.byKey.has(c.syncKey)) index.byKey.set(c.syncKey, c);
    }
    indexes.set(data, index);
  }
  return index;
}

export const entryById = (data, id) => (data ? indexOf(data).byId.get(id) || null : null);
export const entryBySyncKey = (data, key) => (data ? indexOf(data).byKey.get(key) || null : null);

export function groupByGame(data, ids) {
  const wanted = new Set(ids);
  return (data?.games || [])
    .map((game) => ({ game, ids: data.collections.filter((c) => c.game === game.id && wanted.has(c.id)).map((c) => c.id) }))
    .filter((g) => g.ids.length);
}
