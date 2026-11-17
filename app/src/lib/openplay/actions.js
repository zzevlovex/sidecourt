// What the open play buttons do. Each change goes through the store, which
// saves it and updates the screen; most show a toast with Undo.
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { store } from '$lib/state.svelte.js';
import { toast } from '$lib/toasts.svelte.js';
import { save, KEYS } from '$lib/storage.js';
import { plural, speak } from '$lib/format.js';
import {
  newSession, addPlayers, hasPlayer, moveUp as moveUpRule, removeEntry, setAllowPicks, addCourt as addCourtRule,
  fillCourt, endGame, reshuffle, finishSession, pairUp, splitPair, resultWinner,
} from '$lib/logic/queue.js';
import { ui, drafts } from './ui.svelte.js';
import { supabase } from '$lib/supabase.js';
import { account } from '$lib/account.svelte.js';
import { queueGames } from '$lib/history.svelte.js';

const undoTo = (before) => () => store.setSession(before);

export function announce() {
  const call = store.session?.lastCall;
  if (call) speak(`${call.names.join(', ')}. Court ${call.court}.`);
}

/* ---------- Setup and check-in ---------- */

export function createSession({ name, sport, courts }) {
  store.setSummary(null);
  ui.focusCheckin = true;
  store.setSession(newSession({ name: name.trim(), sport, courts: Number(courts) }));
  toast('Session open. Start checking players in.', { type: 'success' });
}

// Returns true when players were added (so the form can clear).
export function checkIn() {
  const session = store.session;
  const names = drafts.names.split(',').map((n) => n.trim()).filter(Boolean);
  const unique = names.filter((n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i);
  const fresh = unique.filter((n) => !hasPlayer(session, n));
  const skipped = names.length - fresh.length;
  const wantsPair = drafts.mode === 'pair' && session.allowPicks;
  if (!fresh.length) {
    toast('Those players are already checked in.', { type: 'warn' });
    return false;
  }
  if (wantsPair && fresh.length !== 2) {
    toast('Partners need exactly 2 new names, like "Ana, Ben".', { type: 'warn' });
    return false;
  }

  store.setSession(addPlayers(session, fresh, { asPair: wantsPair, addedBy: drafts.addedBy.trim() || null }));
  drafts.names = '';
  const who = wantsPair
    ? `${fresh[0]} & ${fresh[1]} added as partners.`
    : `${fresh.length === 1 ? fresh[0] : plural(fresh.length, 'player')} added to the line.`;
  toast(skipped ? `${who} ${plural(skipped, 'name')} skipped (already checked in).` : who, { type: skipped ? 'info' : 'success' });
  return true;
}

// Check in a player by their public code: adds them to the line, linked to
// their account so their games go into their history. Returns true when added.
export async function checkInByCode(code) {
  if (!supabase || !account.user) {
    toast('Sign in on the Account page to check players in by code.', { type: 'warn' });
    return false;
  }
  const { data, error } = await supabase.rpc('check_in', { p_code: code.trim() });
  if (error) {
    toast('Could not check in. Check your connection and try again.', { type: 'warn' });
    return false;
  }
  const player = data?.[0];
  if (!player) {
    toast(`No player has the code ${code.trim().toUpperCase()}.`, { type: 'warn' });
    return false;
  }
  const session = store.session;
  const accounts = session.accounts ?? {};
  if (Object.values(accounts).includes(player.player_id)) {
    toast(`${player.display_name} is already checked in.`, { type: 'warn' });
    return false;
  }
  // Two different people can share a name: add part of the code to tell them apart.
  const name = hasPlayer(session, player.display_name) ? `${player.display_name} (${code.trim().toUpperCase().slice(0, 3)})` : player.display_name;
  const next = addPlayers(session, [name], { addedBy: drafts.addedBy.trim() || null });
  store.setSession({ ...next, accounts: { ...accounts, [name]: player.player_id } });
  toast(`${name} added to the line.`, { type: 'success' });
  return true;
}

/* ---------- Courts ---------- */

export function sendToCourt(courtId) {
  const before = store.session;
  store.setSession(fillCourt(before, courtId));
  if (store.session.lastCall && store.session.lastCall !== before.lastCall) {
    toast(`Court ${courtId}: ${store.session.lastCall.names.join(', ')}`, { type: 'success', onUndo: undoTo(before) });
    announce();
  }
}

// Score to save for a game on court: what was typed on the card, else the scoreboard.
export function scoreInProgress(court) {
  const live = store.liveScore(court);
  const d = { ...(live ? live.final : {}), ...drafts.scores[court.id] };
  const filled = (v) => v !== undefined && v !== null && v !== '';
  return filled(d.a) && filled(d.b) ? { a: Number(d.a), b: Number(d.b) } : null;
}

// A score with a clear winner finishes right away; otherwise ask who won.
export function finishGame(courtId) {
  const score = scoreInProgress(store.session.courts.find((c) => c.id === courtId));
  if (resultWinner(score)) finishCourt(courtId, score, null);
  else {
    ui.finishScore = score;
    ui.finishing = courtId;
  }
}

export function pickWinner(side) {
  const courtId = ui.finishing;
  const score = ui.finishScore;
  ui.finishing = null;
  ui.finishScore = null;
  finishCourt(courtId, score, side);
}

// Save the game, send the 4 players to the back of the line and call the next game.
function finishCourt(courtId, score, winnerSide) {
  const before = store.session;
  const court = before.courts.find((c) => c.id === courtId);
  const names = (side) => court.teams[side === 'a' ? 0 : 1].p.join(' & ');
  const won = resultWinner(score, winnerSide);
  delete drafts.scores[courtId];
  store.setMatch(courtId, null);
  store.setSession(endGame(before, courtId, score, undefined, winnerSide));
  const called = store.session.lastCall !== before.lastCall && store.session.courts.find((c) => c.id === courtId).teams.length;
  const what = won ? `${names(won)} won${score && score.a !== score.b ? ` ${score.a}–${score.b}` : ''}` : 'no winner';
  toast(called
    ? `Court ${courtId} finished (${what}). Next game is on.`
    : `Court ${courtId} finished (${what}). Not enough players for the next game yet.`, { type: called ? 'success' : 'info', onUndo: undoTo(before) });
  if (called) announce();
}

export function shuffle() {
  store.setSession(reshuffle(store.session));
  toast('New random teammates picked.', { ms: 2200 });
}

/* ---------- Waiting line ---------- */

export function moveUp(entryId) {
  store.setSession(moveUpRule(store.session, entryId));
}

export function removePlayer(entry) {
  const before = store.session;
  store.setSession(removeEntry(before, entry.id));
  toast(`${entry.p.join(' & ')} left the line.`, { onUndo: undoTo(before) });
}

export function pairWith(entryId) {
  const before = store.session;
  const first = before.queue.find((e) => e.id === ui.pairing);
  const second = before.queue.find((e) => e.id === entryId);
  ui.pairing = null;
  if (!first || !second) return;
  store.setSession(pairUp(before, first.id, second.id));
  toast(`${first.p[0]} & ${second.p[0]} are now partners.`, { type: 'success', onUndo: undoTo(before) });
}

export function split(entry) {
  const before = store.session;
  store.setSession(splitPair(before, entry.id));
  toast(`${entry.p.join(' & ')} will get random teammates.`, { onUndo: undoTo(before) });
}

/* ---------- Settings ---------- */

export function allowPicks(allow) {
  const before = store.session;
  if (before.allowPicks === allow) return;
  ui.pairing = null;
  if (!allow) drafts.mode = 'solo';
  store.setSession(setAllowPicks(before, allow));
  if (allow) toast('Players can now check in as partners.', { type: 'success' });
  else toast('Random only: partners in the line were split up.', { onUndo: undoTo(before) });
}

export function addCourt() {
  store.setSession(addCourtRule(store.session));
  toast(`Court ${store.session.courts.length} added.`, { type: 'success' });
}

export function setHelp(show) {
  ui.help = show;
  if (!show) save(KEYS.help, true);
}

/* ---------- Ending open play ---------- */

export function liveScoresToCount() {
  if (!ui.countLive) return {};
  return Object.fromEntries(store.session.courts.filter((c) => c.teams.length).map((c) => [c.id, scoreInProgress(c)]));
}

// The standings show only when the address says ?view=standings: right after
// ending, or from "See the last standings". Otherwise Open play shows the setup form.
export function showStandings(show) {
  goto(resolve('/openplay') + (show ? '?view=standings' : ''), { replaceState: true, noScroll: true, keepFocus: true });
}

export function confirmEnd() {
  const before = store.session;
  const summary = finishSession(before, liveScoresToCount());
  store.setSummary(summary);
  queueGames(summary, before.accounts); // players checked in by code get these games in their history
  ui.ending = false;
  ui.pairing = null;
  drafts.scores = {};
  before.courts.forEach((court) => store.setMatch(court.id, null));
  store.setSession(null);
  showStandings(true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('Open play ended. Here are the final standings.', {
    type: 'success',
    onUndo: () => {
      store.setSummary(null);
      showStandings(false);
      store.setSession(before);
    },
  });
}
