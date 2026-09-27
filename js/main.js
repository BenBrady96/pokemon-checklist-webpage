import { loadCollection } from './collection.js';
import { hideLoader } from './ui.js';

try {
  await loadCollection(document.documentElement.dataset.collection);
  await import('./app.js');
  requestAnimationFrame(() => hideLoader());
} catch (err) {
  console.error(err);
  hideLoader({ wait: false });
  document.getElementById('load-error')?.removeAttribute('hidden');
}
