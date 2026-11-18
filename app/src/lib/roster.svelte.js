// The saved list of past players on this device (rules in logic/roster.js).
import { load, save, KEYS } from './storage.js';
import { store } from './state.svelte.js';
import { supabase } from './supabase.js';
import { recordPlayers, forgetPlayer, dropLinks } from './logic/roster.js';

// First run: start from the last finished session, if there is one.
const played = (summary) => summary?.standings.filter((p) => p.played).map((p) => p.name) ?? [];
const first = () => recordPlayers([], played(store.summary), { at: store.summary?.endedAt });

export const roster = $state({
  list: load(KEYS.roster) ?? first(),
  valid: null, // account ids the signed-in manager may save games for (null: not known)
});

function setList(list) {
  roster.list = list;
  save(KEYS.roster, list);
}

// Remember who played a finished session. Returns the old list, for Undo.
export function rememberSession(summary, accounts, userId) {
  const before = $state.snapshot(roster.list);
  setList(recordPlayers(before, played(summary), { accounts, userId, at: summary.endedAt }));
  return before;
}

export const restoreRoster = (list) => setList(list);
export const forgetFromRoster = (name) => setList(forgetPlayer($state.snapshot(roster.list), name));
export const forgetLinks = (userId) => setList(dropLinks($state.snapshot(roster.list), userId));

// Ask the server which players this manager has checked in. Until it answers
// (or when offline) players are added by name only.
export async function refreshLinks(userId) {
  roster.valid = null;
  if (!supabase || !userId) return;
  const { data, error } = await supabase.from('checkins').select('player_id').eq('manager_id', userId);
  if (error) return;
  const valid = new Set(data.map((row) => row.player_id));
  roster.valid = valid;
  setList(dropLinks($state.snapshot(roster.list), userId, (id) => valid.has(id)));
}
