// Saves finished games to players' online history.
// Games wait in an outbox on this device until the upload succeeds, so a bad
// connection at the gym never loses them. Ids make retries safe (no doubles).
import { supabase } from './supabase.js';
import { account } from './account.svelte.js';
import { load, save } from './storage.js';
import { gameRows } from './logic/history.js';

const OUTBOX = 'sidecourt.outbox';

export const history = $state({ pending: load(OUTBOX, []).length });

export function queueGames(summary, accounts) {
  const rows = gameRows(summary, accounts);
  if (!rows.length) return;
  const outbox = [...load(OUTBOX, []), ...rows];
  save(OUTBOX, outbox);
  history.pending = outbox.length;
  flush();
}

let flushing = false;
export async function flush() {
  const outbox = load(OUTBOX, []);
  if (flushing || !outbox.length || !supabase || !account.user) return;
  flushing = true;
  try {
    const { error } = await supabase.from('games').upsert(outbox, { onConflict: 'id', ignoreDuplicates: true });
    if (!error) {
      // Keep anything added while this upload was running.
      const sent = new Set(outbox.map((row) => row.id));
      const left = load(OUTBOX, []).filter((row) => !sent.has(row.id));
      save(OUTBOX, left);
      history.pending = left.length;
    }
  } finally {
    flushing = false;
  }
}

// The signed-in player's games, newest first.
export async function myGames(limit = 50) {
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

if (typeof window !== 'undefined') {
  window.addEventListener('online', flush);
  // Try again whenever someone signs in or the app starts signed in.
  $effect.root(() => {
    $effect(() => {
      if (account.user) flush();
    });
  });
}
