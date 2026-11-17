// Saves data in this browser (localStorage) so a refresh does not lose the score.
// Later this file is the one place to swap in an online database for live sharing.

export const APP_NAME = 'Sidecourt'; // working title: change it here and in the HTML <title> tags

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

// Player names are typed by users, so always escape them before putting them in HTML.
export function esc(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export const SESSION_KEY = 'sidecourt.session';
export const matchKey = (courtId) => (courtId ? `sidecourt.match.court${courtId}` : 'sidecourt.match');

// The saved scoreboard match for the game now on this court, or null.
// A match left over from an earlier game on the same court does not count.
export function courtMatch(court) {
  if (!court || court.teams.length !== 2) return null;
  const match = load(matchKey(court.id));
  if (!match || match.game !== court.game) return null;
  const same = (side, i) => match.names[side] === court.teams[i].p.join(' / ');
  return same('a', 0) && same('b', 1) ? match : null;
}
