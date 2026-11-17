// Saves finished games and finished open play sessions to players' online history.
// Everything waits in an outbox on this device until the upload succeeds, so a
// bad connection at the gym never loses it. Ids make retries safe (no doubles).
import { supabase } from './supabase.js';
import { account } from './account.svelte.js';
import { load, save } from './storage.js';
import { gameRows, sessionRow } from './logic/history.js';
import { newId } from './logic/queue.js';

const OUTBOX = 'sidecourt.outbox';
const TABLES = ['games', 'sessions'];

// Outbox items are { table, row }. Older versions stored bare game rows.
const readOutbox = () => load(OUTBOX, []).map((item) => (item.table ? item : { table: 'games', row: item }));

export const history = $state({ pending: readOutbox().length });

function enqueue(items) {
  if (!items.length) return;
  const outbox = [...readOutbox(), ...items];
  save(OUTBOX, outbox);
  history.pending = outbox.length;
  flush();
}

// Called when open play ends. The session itself is saved whenever the host is
// signed in; games are saved for players who were checked in with an account.
// Returns the saved session's id (null when nothing was saved).
export function queueSession(summary, accounts = {}) {
  // Nothing to save online when nobody involved has an account.
  if (!supabase || (!account.user && !Object.keys(accounts).length)) return null;
  const id = newId();
  enqueue([
    { table: 'sessions', row: sessionRow(summary, accounts, id) },
    ...gameRows(summary, accounts).map((row) => ({ table: 'games', row })),
  ]);
  return id;
}

// "Undo" after ending open play: the session is not over, so take it back out
// of everyone's history (whether it was already uploaded or still waiting).
export async function discardSession(id) {
  if (!id) return;
  const left = readOutbox().filter((item) => !(item.table === 'sessions' && item.row.id === id));
  save(OUTBOX, left);
  history.pending = left.length;
  if (supabase && account.user) await supabase.from('sessions').delete().eq('id', id);
}

let flushing = false;
export async function flush() {
  if (flushing || !supabase || !account.user || !readOutbox().length) return;
  flushing = true;
  try {
    // Each table uploads on its own: one failing never blocks the other.
    for (const table of TABLES) {
      const rows = readOutbox().filter((item) => item.table === table).map((item) => item.row);
      if (!rows.length) continue;
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) continue;
      // Keep anything added while this upload was running.
      const sent = new Set(rows.map((row) => row.id));
      const left = readOutbox().filter((item) => !(item.table === table && sent.has(item.row.id)));
      save(OUTBOX, left);
      history.pending = left.length;
    }
  } finally {
    flushing = false;
  }
}

// The signed-in player's games, newest first.
export async function myGames(limit = 200) {
  const id = account.user.id;
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .or(`players_a.cs.{${id}},players_b.cs.{${id}}`)
    .order('played_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Open play sessions the signed-in person played in or hosted, newest first.
export async function mySessions(limit = 100) {
  const id = account.user.id;
  const { data, error } = await supabase
    .from('sessions')
    .select('id, ended_at, name, sport, summary, manager_id, player_ids')
    .or(`player_ids.cs.{${id}},manager_id.eq.${id}`)
    .order('ended_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', flush);
  // Try again whenever someone signs in or the app starts signed in.
  $effect.root(() => {
    $effect(() => {
      if (account.user) flush();
    });
  });
}
