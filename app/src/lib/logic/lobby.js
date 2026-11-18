// Pure helpers for lobbies (no network), so they can be tested in Node.

// What players may see: everything except which account each name belongs to
// and the secrets inside the scorer links.
// All results stay in: fair matchmaking reads them, so "Up next" in the lobby
// matches the manager's board exactly.
export function publicState(session) {
  const { accounts, scoreKeys, ...rest } = session;
  return rest;
}

// Is this scoreboard match the game now on this court? A match left over from
// an earlier game, or for other players, does not count.
export function fitsCourt(match, court) {
  if (!match || !court || court.teams.length !== 2 || match.game !== court.game) return false;
  return match.names?.a === court.teams[0].p.join(' / ') && match.names?.b === court.teams[1].p.join(' / ');
}

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
