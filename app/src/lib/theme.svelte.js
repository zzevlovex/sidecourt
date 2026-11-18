// Dark or light, remembered on this device. static/theme.js applies it before the first paint.
import { load, save, KEYS } from './storage.js';

const COLORS = { dark: '#0a0d18', light: '#f3f5fa' };

export const theme = $state({ current: load(KEYS.theme) === 'light' ? 'light' : 'dark' });

export function setTheme(next) {
  theme.current = next;
  save(KEYS.theme, next);
  if (next === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[next]);
}
