// Saves finished games and finished open play sessions to players' online history.
// Everything waits in an outbox on this device until the upload succeeds, so a
// bad connection at the gym never loses it. Ids make retries safe (no doubles).
import { supabase } from './supabase.js';
import { account } from './account.svelte.js';
import { load, save, KEYS } from './storage.js';
import { gameRows, sessionRow, validSummary } from './logic/history.js';
import { newId } from './logic/queue.js';

const OUTBOX = 'sidecourt.outbox';
const TABLES = ['games', 'sessions'];

// Outbox items are { table, row, by }: by is the account allowed to upload them,
// so results never end up under whoever signs in next on a shared device.
// Older versions stored bare game rows, or items without by.
const readOutbox = () => load(OUTBOX, []).map((item) => (item.table ? item : { table: 'games', row: item }));
const isMine = (item) => !item.by || item.by === account.user?.id;

export const history = $state({ pending: 0, failed: load(KEYS.uploadFailed, 0), syncing: false });

function setOutbox(items) {
  save(OUTBOX, items);
  history.pending = items.length;
}
history.pending = readOutbox().length;

function enqueue(items) {
  if (!items.length) return;
  setOutbox([...readOutbox(), ...items]);
  flush();
}

// Called when open play ends. The session is saved for the host; games are saved
// for players who were checked in with an account. hostId: who checked them in.
// Returns the saved session's id (null when nothing was saved).
export function queueSession(summary, accounts = {}, hostId = null) {
  const linked = Object.keys(accounts).length > 0;
  const by = (linked && hostId) || account.user?.id;
  if (!supabase || !by) return null; // nobody with an account was involved
  const id = newId();
  enqueue([
    { table: 'sessions', by, row: { ...sessionRow(summary, accounts, id), manager_id: by } },
    ...gameRows(summary, accounts).map((row) => ({ table: 'games', by, row: { ...row, recorded_by: by } })),
  ]);
  return id;
}

// "Undo" after ending open play: the session is not over, so take it back out
// of everyone's history (whether it was already uploaded or still waiting).
export async function discardSession(id) {
  if (!id) return;
  setOutbox(readOutbox().filter((item) => !(item.table === 'sessions' && item.row.id === id)));
  if (supabase && account.user) await supabase.from('sessions').delete().eq('id', id);
}

export function dismissFailed() {
  history.failed = 0;
  save(KEYS.uploadFailed, 0);
}

// The database refused this row, so sending it again would never work.
// (Anything else, such as no connection, is worth another try.)
const refused = (error) => /^(22|23|42)/.test(error?.code ?? '');

const upload = (table, rows) => supabase.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

function settle(sentIds, table, gaveUp = 0) {
  setOutbox(readOutbox().filter((item) => !(item.table === table && sentIds.has(item.row.id))));
  if (gaveUp) {
    history.failed += gaveUp;
    save(KEYS.uploadFailed, history.failed);
  }
}

let flushing = false;
export async function flush() {
  if (flushing || !supabase || !account.user || !readOutbox().length) return;
  flushing = true;
  history.syncing = true;
  try {
    // Each table uploads on its own: one failing never blocks the other.
    for (const table of TABLES) {
      const rows = readOutbox().filter((item) => item.table === table && isMine(item)).map((item) => item.row);
      if (!rows.length) continue;
      const { error } = await upload(table, rows);
      if (!error) {
        settle(new Set(rows.map((row) => row.id)), table);
      } else if (refused(error)) {
        // One bad row must not hold back the rest: send them one at a time.
        for (const row of rows) {
          const { error: rowError } = await upload(table, [row]);
          if (!rowError) settle(new Set([row.id]), table);
          else if (refused(rowError)) settle(new Set([row.id]), table, 1);
        }
      }
    }
  } finally {
    flushing = false;
    history.syncing = false;
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
  return data.filter((row) => validSummary(row.summary));
}

// "Not me": take the player out of a game or session. If another host saved it,
// everything from that host goes too and the host is blocked (see 07_security.sql).
export async function removeFromHistory(table, id) {
  const { error } = await supabase.rpc('remove_from_history', { p_table: table, p_id: id });
  if (error) throw error;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', flush);
  setInterval(flush, 60000); // keeps trying while anything is waiting
  // Try again whenever someone signs in or the app starts signed in.
  $effect.root(() => {
    $effect(() => {
      if (account.user) flush();
    });
  });
}
