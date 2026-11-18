// Pure helpers for lobbies (no network), so they can be tested in Node.

// What players may see: everything except which account each name belongs to
// and the secrets inside the scorer links.
// All results stay in: fair matchmaking reads them, so "Up next" in the lobby
// matches the manager's board exactly.
export function publicState(session) {
  const { accounts, scoreKeys, ...rest } = session;
  return rest;
}

// A score sent from another phone is not trusted: it must look like a real match.
const count = (n) => Number.isInteger(n) && n >= 0 && n <= 999;
function validMatch(m) {
  if (!m || typeof m !== 'object' || !count(m.a) || !count(m.b) || !Array.isArray(m.history)) return false;
  if (m.serving !== 'a' && m.serving !== 'b') return false;
  if (m.sport === 'badminton') return count(m.games?.a) && count(m.games?.b) && Array.isArray(m.finished);
  return m.sport === 'pickleball';
}

// Is this scoreboard match the game now on this court? A match left over from
// an earlier game, or for other players, does not count.
export function fitsCourt(match, court) {
  if (!validMatch(match) || !court || court.teams.length !== 2 || match.game !== court.game) return false;
  return match.names?.a === court.teams[0].p.join(' / ') && match.names?.b === court.teams[1].p.join(' / ');
}

// The same check for a score from another phone, when a player may have been
// swapped: the game must match, and the names on the court are the ones that count.
export function scoreForCourt(match, court) {
  if (!validMatch(match) || !court || court.teams.length !== 2 || match.game !== court.game) return null;
  return { ...match, names: { a: court.teams[0].p.join(' / '), b: court.teams[1].p.join(' / ') } };
}

// A private marker for "this linked player is me". The lobby is public and must
// not contain account ids, so it holds a one-way code made from id and lobby.
export async function linkToken(accountId, code) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${code}:${accountId}`));
  return [...new Uint8Array(bytes).slice(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// { token: player name } for everyone linked to an account in this session.
export async function linkTokens(accounts = {}, code) {
  const pairs = await Promise.all(Object.entries(accounts).map(async ([name, id]) => [await linkToken(id, code), name]));
  return Object.fromEntries(pairs);
}

// A poll answers with no state when nothing has changed: keep the copy we have.
export const mergeLobby = (previous, row) => (row && row.state == null && previous ? { ...previous, open: row.open, updated_at: row.updated_at } : row);

// Reads a scanned QR or typed text: a full Sidecourt link or a bare 6-letter code.
export function codeFrom(text) {
  let value = String(text).trim();
  try {
    value = new URL(value).searchParams.get('code') ?? value;
  } catch {
    // not a link: use as typed
  }
  value = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return /^[2-9A-HJ-NP-Z]{6}$/.test(value) ? value : null;
}
