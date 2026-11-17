// Saves data in this browser (localStorage) so a refresh does not lose anything.
// Only state.svelte.js uses this file: swap it for an online database later.

export const KEYS = {
  session: 'sidecourt.session',
  summary: 'sidecourt.summary', // final standings of the last session
  help: 'sidecourt.help.hidden',
};

export const matchKey = (courtId) => (courtId ? `sidecourt.match.court${courtId}` : 'sidecourt.match');

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the app keeps working, it just will not survive a refresh.
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
