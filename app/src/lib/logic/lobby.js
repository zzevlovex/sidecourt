// Pure helpers for lobbies (no network), so they can be tested in Node.

// What players may see: everything except which account each name belongs to.
// All results stay in: fair matchmaking reads them, so "Up next" in the lobby
// matches the manager's board exactly.
export function publicState(session) {
  const { accounts, ...rest } = session;
  return rest;
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
