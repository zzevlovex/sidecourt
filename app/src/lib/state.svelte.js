// The one shared, reactive copy of everything the app saves: the open play
// session, the last final standings, and the scoreboard matches.
// Every page reads and writes through `store`, and the UI updates by itself.
//
// To go online later (players on their own phones, a shared board), this is
// the only file that needs to talk to the database: keep the same methods and
// have them read/write Supabase or Firebase instead of localStorage.
import { load, save, remove, KEYS, matchKey } from './storage.js';
import { matchScore } from './logic/scoring.js';

class Store {
  // $state.raw: these objects are always replaced, never edited in place,
  // because the rules in logic/ return new copies.
  session = $state.raw(null);
  summary = $state.raw(null);
  matches = $state.raw({}); // court id (or 'solo' for a single match) -> match

  constructor() {
    this.reload();
  }

  reload() {
    this.session = load(KEYS.session);
    this.summary = load(KEYS.summary);
    const matches = { solo: load(matchKey(null)) };
    this.session?.courts.forEach((court) => {
      matches[court.id] = load(matchKey(court.id));
    });
    this.matches = matches;
  }

  setSession(next) {
    this.session = next;
    if (next) save(KEYS.session, next);
    else remove(KEYS.session);
  }

  setSummary(next) {
    this.summary = next;
    if (next) save(KEYS.summary, next);
    else remove(KEYS.summary);
  }

  match(courtId) {
    return this.matches[courtId ?? 'solo'] ?? null;
  }

  setMatch(courtId, next) {
    this.matches = { ...this.matches, [courtId ?? 'solo']: next };
    if (next) save(matchKey(courtId), next);
    else remove(matchKey(courtId));
  }

  // The scoreboard match for the game now on this court, or null.
  // A match left over from an earlier game on the same court does not count.
  courtMatch(court) {
    if (!court || court.teams.length !== 2) return null;
    const match = this.match(court.id);
    if (!match || match.game !== court.game) return null;
    const same = (side, i) => match.names[side] === court.teams[i].p.join(' / ');
    return same('a', 0) && same('b', 1) ? match : null;
  }

  // Score kept on the scoreboard for this court's game (null if none yet).
  // final is what gets saved (see matchScore).
  liveScore(court) {
    const match = this.courtMatch(court);
    if (!match || !match.history.length) return null;
    return { match, final: matchScore(match) };
  }
}

export const store = new Store();

if (typeof window !== 'undefined') {
  // Another tab changed something (e.g. the scoreboard open on a second screen).
  window.addEventListener('storage', (event) => {
    if (event.key?.startsWith('sidecourt.')) store.reload();
  });
  // The back button can restore an old copy of the page: show what is saved.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) store.reload();
  });
}
