// Small pop-up messages. Call toast() from anywhere; <Toasts /> in the layout shows them.

export const toasts = $state([]);
let nextId = 1;

// key: a toast with the same key replaces the previous one (no pile-up on fast taps).
// onUndo: shows an Undo button that calls it.
export function toast(text, { type = 'info', onUndo = null, ms = 4000, key = null } = {}) {
  if (key) {
    const i = toasts.findIndex((t) => t.key === key);
    if (i >= 0) toasts.splice(i, 1);
  }
  const item = { id: nextId++, text, type, onUndo, key };
  toasts.unshift(item);
  while (toasts.length > 4) toasts.pop();
  setTimeout(() => dismiss(item.id), onUndo ? ms + 2000 : ms);
}

export function dismiss(id) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}
