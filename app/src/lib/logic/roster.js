// Everyone who has played on this device, so a manager can add them again in a
// tap. An entry is { name, sessions, last, accountId, by }.
//   accountId / by: the player's account, and the signed-in manager who checked
//   them in. Only that manager's sessions may link the player again.
// Pure functions: each one returns a NEW list.

const MAX_PLAYERS = 300;
const key = (name) => name.trim().toLowerCase();

// Most regular first, then most recent, then by name.
export function rankRoster(list) {
  return [...list].sort((x, y) => y.sessions - x.sessions || String(y.last).localeCompare(String(x.last)) || x.name.localeCompare(y.name));
}

// Add one finished session. names: who played. accounts: { name: accountId }.
export function recordPlayers(list, names, { accounts = {}, userId = null, at = new Date().toISOString() } = {}) {
  const byName = new Map(list.map((p) => [key(p.name), p]));
  names.forEach((name) => {
    const old = byName.get(key(name));
    const entry = { ...old, name, sessions: (old?.sessions ?? 0) + 1, last: at };
    if (accounts[name] && userId) Object.assign(entry, { accountId: accounts[name], by: userId });
    byName.set(key(name), entry);
  });
  return rankRoster([...byName.values()]).slice(0, MAX_PLAYERS);
}

export const forgetPlayer = (list, name) => list.filter((p) => key(p.name) !== key(name));

// Remove account links: all of one manager's, or only those no longer valid.
export function dropLinks(list, userId, keep = () => false) {
  return list.map((p) => {
    if (!p.accountId || p.by !== userId || keep(p.accountId)) return p;
    const { accountId, by, ...rest } = p;
    return rest;
  });
}

// The account to link for this name, or null. valid: account ids this manager
// may still save games for. A closed account is not in it, and saving a game
// for one would be refused and hold up the manager's other uploads.
export function linkFor(list, name, userId, valid) {
  const entry = list.find((p) => key(p.name) === key(name));
  return entry?.accountId && userId && entry.by === userId && valid?.has(entry.accountId) ? entry.accountId : null;
}

/* ---------- The names box: "Ana, Be" is being typed, "Be" is the part to complete ---------- */

export const lastTyped = (text) => text.slice(text.lastIndexOf(',') + 1).trim();

// The box without the part being typed: "Ana, Be" gives "Ana, ".
export function withoutLastTyped(text) {
  const cut = text.lastIndexOf(',');
  return cut < 0 ? '' : `${text.slice(0, cut + 1)} `;
}

// Past players matching what is being typed (the start of any of their names).
export function suggestPlayers(list, text, isHere = () => false, limit = 5) {
  const typed = key(lastTyped(text));
  if (!typed) return [];
  const taken = new Set(text.split(',').map(key));
  return rankRoster(list)
    .filter((p) => key(p.name).split(/\s+/).some((word) => word.startsWith(typed)) || key(p.name).startsWith(typed))
    .filter((p) => !isHere(p.name) && (!taken.has(key(p.name)) || key(p.name) === typed))
    .slice(0, limit)
    .map((p) => p.name);
}
