// Small toast messages shared by the pages. Needs <div id="toasts" class="toasts"> in the HTML.
import { esc } from './storage.js';

const ICONS = { success: '✓', warn: '!', info: 'i' };

// key: a toast with the same key replaces the previous one (no pile-up on fast taps).
// onUndo: shows an Undo button that calls it.
export function toast(text, { type = 'info', onUndo = null, ms = 4000, key = null } = {}) {
  const box = document.getElementById('toasts');
  if (!box) return;
  if (key) box.querySelector(`[data-key="${key}"]`)?.remove();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  if (key) el.dataset.key = key;
  el.setAttribute('role', type === 'warn' ? 'alert' : 'status');
  el.innerHTML = `<span class="toast-icon" aria-hidden="true">${ICONS[type]}</span>
    <span class="grow">${esc(text)}</span>
    ${onUndo ? '<button class="toast-undo" type="button">Undo</button>' : ''}
    <button class="toast-close" type="button" aria-label="Dismiss">&times;</button>`;
  const close = () => {
    if (el.classList.contains('leaving')) return;
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  el.querySelector('.toast-close').addEventListener('click', close);
  if (onUndo) {
    el.querySelector('.toast-undo').addEventListener('click', () => {
      onUndo();
      close();
      toast('Undone.', { ms: 1800 });
    });
  }
  box.prepend(el);
  while (box.children.length > 4) box.lastElementChild.remove();
  setTimeout(close, onUndo ? ms + 2000 : ms);
}
