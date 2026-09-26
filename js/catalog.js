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
