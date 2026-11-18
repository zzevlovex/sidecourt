// Open play lobbies: the manager's device publishes the session so players can
// follow it on their phones with a lobby code, and ask to join the line.
// Phones ask every few seconds, and only receive the lobby when it has changed.
import { supabase } from './supabase.js';
import { account } from './account.svelte.js';
import { store } from './state.svelte.js';
import { newPlayerCode } from './logic/keys.js';
import { publicState, scoreForCourt, linkTokens } from './logic/lobby.js';
import { poll } from './poll.js';

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

// Sends a lobby update. extras need 08_reliability.sql: if the database does not
// have them yet, the update goes out without them.
let extrasSupported = true;
async function updateLobby(code, values, extras = {}) {
  if (!Object.keys(values).length && !extrasSupported) return;
  let { error } = await supabase.from('lobbies').update({ ...values, ...(extrasSupported ? extras : {}) }).eq('code', code);
  if (error?.code === 'PGRST204' && extrasSupported) {
    extrasSupported = false;
    if (Object.keys(values).length) ({ error } = await supabase.from('lobbies').update(values).eq('code', code));
    else error = null;
  }
  if (error) throw error;
}

// The manager's full session and the scores being kept, for resuming on another device.
function privateState() {
  const matches = Object.fromEntries(store.session.courts.map((c) => [c.id, store.match(c.id)]).filter(([, m]) => m));
  return { session: store.session, matches };
}

async function publish() {
  if (!canPublish()) return;
  const code = await ensureLobby();
  if (!store.session) return;
  const keys = store.session.scoreKeys;
  const links = await linkTokens(store.session.accounts, code);
  if (!store.session) return;
  await updateLobby(code, {
    state: { ...publicState(store.session), links }, open: true, updated_at: new Date().toISOString(),
    // Only sent once a scorer link exists, so lobbies keep working before 06_court_scores.sql is run.
    ...(keys && Object.keys(keys).length ? { score_keys: keys } : {}),
  }, { private_state: privateState() });
}

// Scores change on every rally: saved for resuming only, without touching the
// lobby's "last changed" time, so players' phones do not download it again.
async function saveScores() {
  if (canPublish() && store.session.lobby) await updateLobby(store.session.lobby, {}, { private_state: privateState() });
}

// Called once by the layout: every change to the session is published shortly after.
export function startLobbySync() {
  let timer;
  let scoreTimer;
  const stopScores = poll(pullScores, POLL_MS);
  const stop = $effect.root(() => {
    $effect(() => {
      store.session; // re-run on every session change
      if (!canPublish()) return;
      clearTimeout(timer);
      timer = setTimeout(() => publish().catch(() => {}), 800);
    });
    $effect(() => {
      store.matches; // re-run on every score
      if (!canPublish()) return;
      clearTimeout(scoreTimer);
      scoreTimer = setTimeout(() => saveScores().catch(() => {}), 5000);
    });
  });
  return () => {
    stop();
    stopScores();
    clearTimeout(timer);
    clearTimeout(scoreTimer);
  };
}

/* ---------- Scorer links: another phone keeps score for one court ---------- */

export async function fetchScores(code) {
  const { data, error } = await supabase.rpc('get_court_scores', { p_code: code });
  if (error) throw error;
  return data ?? [];
}

// Returns false when the link is wrong or the open play has ended.
export async function pushScore(code, court, key, match) {
  const { data, error } = await supabase.rpc('set_court_score', { p_code: code, p_court: court, p_key: key, p_match: match });
  if (error) throw error;
  return data === true;
}

const functionMissing = (error) => error?.code === 'PGRST202'; // 08_reliability.sql not run yet

// Only the scores that changed since `since`.
async function fetchScoreChanges(code, since) {
  const { data, error } = await supabase.rpc('get_court_score_changes', { p_code: code, p_since: since });
  if (functionMissing(error)) return fetchScores(code);
  if (error) throw error;
  return data ?? [];
}

// Manager's device: bring in scores kept on other phones. A score is taken once
// per change, so what the manager types or taps afterwards is not overwritten.
const applied = {}; // court id -> updated_at already taken
let seen = { code: null, at: null };
async function pullScores() {
  const session = store.session;
  if (!supabase || !session?.lobby || !Object.keys(session.scoreKeys ?? {}).length) return;
  if (seen.code !== session.lobby) seen = { code: session.lobby, at: null };
  const rows = await fetchScoreChanges(session.lobby, seen.at);
  for (const row of rows) {
    seen.at = row.updated_at;
    const court = store.session?.courts.find((c) => c.id === row.court);
    if (!court || !session.scoreKeys[row.court] || applied[row.court] === row.updated_at) continue;
    applied[row.court] = row.updated_at;
    const match = scoreForCourt(row.match, court);
    if (match) store.setMatch(court.id, match);
  }
}

/* ---------- Resume a session on another device ---------- */

// The signed-in manager's most recent open play that was never ended.
export async function findResumable() {
  if (!supabase || !account.user) return null;
  const { data, error } = await supabase.from('lobbies')
    .select('code, updated_at, private_state')
    .eq('manager_id', account.user.id).eq('open', true).not('private_state', 'is', null)
    .gt('updated_at', new Date(Date.now() - 2 * 864e5).toISOString())
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !Array.isArray(data?.private_state?.session?.courts) || !Array.isArray(data.private_state.session.queue)) return null;
  return data;
}

export function resumeSession(row) {
  store.setSession({ ...row.private_state.session, lobby: row.code });
  Object.entries(row.private_state.matches ?? {}).forEach(([court, match]) => store.setMatch(Number(court), match));
}

export const discardResumable = (code) => updateLobby(code, { open: false }, { private_state: null });

export async function closeLobby(code, finalState) {
  if (!supabase || !code) return;
  await updateLobby(code, { open: false, state: finalState, updated_at: new Date().toISOString() }, { private_state: null });
}

/* ---------- Players ---------- */

// since: the updated_at already held. If unchanged, the answer has no state (see mergeLobby).
export async function fetchLobby(code, since = null) {
  let { data, error } = await supabase.rpc('get_lobby_changes', { p_code: code, p_since: since });
  if (functionMissing(error)) ({ data, error } = await supabase.rpc('get_lobby', { p_code: code }));
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
