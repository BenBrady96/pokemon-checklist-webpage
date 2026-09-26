import { loadCollection } from './collection.js';

try {
  await loadCollection(document.documentElement.dataset.collection);
  await import('./app.js');
} catch (err) {
  console.error(err);
  document.getElementById('load-error')?.removeAttribute('hidden');
}
