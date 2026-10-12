import { loadCollection } from '../core/collection.js';
import { hideLoader } from '../shared/ui.js';

try {
  await loadCollection(document.documentElement.dataset.collection);
  await import('./app.js');
  requestAnimationFrame(() => hideLoader());
} catch (err) {
  console.error(err);
  hideLoader({ wait: false });
  document.getElementById('load-error')?.removeAttribute('hidden');
}
