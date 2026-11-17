// Open play lobbies: the manager's device publishes the session so players can
// follow it on their phones with a lobby code, and ask to join the line.
// Uses short polling (every few seconds), which is plenty for a club.
import { supabase } from './supabase.js';
import { account } from './account.svelte.js';
import { store } from './state.svelte.js';
import { newPlayerCode } from './logic/keys.js';
import { publicState } from './logic/lobby.js';

export const POLL_MS = 4000;

const canPublish = () => Boolean(supabase && account.user && store.session);

let creating = null;
async function ensureLobby() {
  if (store.session.lobby) return store.session.lobby;
  // One creation at a time; a clash of random codes is rare, so retry a few times.
  creating ??= (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newPlayerCode();
      const { error } = await supabase.from('lobbies').insert({ code, state: publicState(store.session) });
      if (!error) {
        store.setSession({ ...store.session, lobby: code });
        return code;
      }
      if (error.code !== '23505') throw error;
    }
    throw new Error('Could not create a lobby code');
  })().finally(() => (creating = null));
  return creating;
}

async function publish() {
  if (!canPublish()) return;
  const code = await ensureLobby();
  if (!store.session) return;
  await supabase.from('lobbies').update({ state: publicState(store.session), open: true, updated_at: new Date().toISOString() }).eq('code', code);
}

// Called once by the layout: every change to the session is published shortly after.
export function startLobbySync() {
  let timer;
  return $effect.root(() => {
    $effect(() => {
      store.session; // re-run on every session change
      if (!canPublish()) return;
      clearTimeout(timer);
      timer = setTimeout(() => publish().catch(() => {}), 800);
    });
  });
}

export async function closeLobby(code, finalState) {
  if (!supabase || !code) return;
  await supabase.from('lobbies').update({ open: false, state: finalState, updated_at: new Date().toISOString() }).eq('code', code);
}

/* ---------- Players ---------- */

export async function fetchLobby(code) {
  const { data, error } = await supabase.rpc('get_lobby', { p_code: code });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function joinLobby(code) {
  const { data, error } = await supabase.rpc('join_lobby', { p_code: code });
  if (error) throw error;
  return data; // 'ok' or 'closed'
}

/* ---------- Manager: join requests ---------- */

export async function pendingJoins(code) {
  const { data, error } = await supabase.from('lobby_joins').select('player_id, display_name').eq('lobby_code', code);
  if (error) throw error;
  return data;
}

export async function clearJoin(code, playerId) {
  await supabase.from('lobby_joins').delete().eq('lobby_code', code).eq('player_id', playerId);
}
