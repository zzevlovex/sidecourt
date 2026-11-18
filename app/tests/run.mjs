// Quick checks for the rules. Run with:  node tests/run.mjs
import assert from 'node:assert/strict';
import { newMatch, rally, undo, winner, callText, serviceCourt, isGamePoint, matchScore } from '../src/lib/logic/scoring.js';
import { newSession, addPlayers, fillCourt, endGame, pickNext, setAllowPicks, waitingCount, playingCount, moveUp, removeEntry, upcoming, reshuffle, rankings, finishSession, pairUp, splitPair, playHistory, splitCost, setAway, addCourt, removeCourt, cancelGame, replacePlayer, editResult, deleteResult } from '../src/lib/logic/queue.js';

import { shareCards, overallStats, playerMatches, closestGames, STORY_SAFE } from '../src/lib/logic/shareCard.js';
import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';
import { publicState, codeFrom, fitsCourt, scoreForCourt, linkToken, linkTokens, mergeLobby } from '../src/lib/logic/lobby.js';
import { recordPlayers, rankRoster, forgetPlayer, dropLinks, linkFor, lastTyped, withoutLastTyped, suggestPlayers } from '../src/lib/logic/roster.js';
import { gameRows, sessionRow, validSummary } from '../src/lib/logic/history.js';
import { newKey, newPlayerCode, parseKey, keyEmail, keyLookupId, ALPHABET } from '../src/lib/logic/keys.js';

const play = (match, sides) => [...sides].reduce((m, s) => rally(m, s), match);

// Pickleball doubles: starts 0-0-2, receiving side winning the first rally is a side out.
let m = newMatch({ sport: 'pickleball', doubles: true });
assert.equal(callText(m), '0 – 0 – 2');
m = rally(m, 'b');
assert.deepEqual([m.a, m.b, m.serving, m.server], [0, 0, 'b', 1]);
m = rally(m, 'b');
assert.equal(m.b, 1);
m = rally(m, 'a'); // first server loses, second server
assert.deepEqual([m.serving, m.server, m.a], ['b', 2, 0]);
m = rally(m, 'a'); // side out
assert.deepEqual([m.serving, m.server], ['a', 1]);
assert.equal(undo(m).serving, 'b');

// Pickleball: win at 11 by 2, no scoring after the win.
m = play(newMatch({ sport: 'pickleball', doubles: true }), 'a'.repeat(10));
assert.equal(isGamePoint(m), true);
m = rally(m, 'a');
assert.equal(winner(m), 'a');
assert.equal(rally(m, 'a').a, 11);

// Pickleball singles: every lost serve is a side out.
m = rally(newMatch({ sport: 'pickleball', doubles: false }), 'b');
assert.deepEqual([m.serving, m.server, callText(m)], ['b', 1, '0 – 0']);

// Badminton: rally scoring, winner serves, service court by score.
m = newMatch({ sport: 'badminton' });
m = rally(m, 'b');
assert.deepEqual([m.b, m.serving, serviceCourt(m)], [1, 'b', 'left']);
m = play(newMatch({ sport: 'badminton' }), 'a'.repeat(21));
assert.deepEqual([m.games.a, m.a, m.b, winner(m)], [1, 0, 0, null]);
m = play(m, 'a'.repeat(21));
assert.equal(winner(m), 'a');
assert.deepEqual(m.finished, [{ a: 21, b: 0 }, { a: 21, b: 0 }]);
// Deuce: 20-20 needs 2 clear, cap at 30.
m = play(newMatch({ sport: 'badminton' }), 'ab'.repeat(20));
m = rally(m, 'a');
assert.equal(m.games.a, 0);
m = play(newMatch({ sport: 'badminton' }), 'ab'.repeat(29));
m = rally(m, 'a');
assert.equal(m.games.a, 1);

// Open play: partners stay together, solos are paired.
let s = newSession({ courts: 1 });
s = addPlayers(s, ['Ana']);
s = addPlayers(s, ['Ben', 'Cy'], { asPair: true, addedBy: 'Ben' });
assert.equal(pickNext(s), null);
s = addPlayers(s, ['Dee', 'Eli', 'Fay']);
assert.equal(waitingCount(s), 6);
s = fillCourt(s, 1, () => 0);
assert.equal(playingCount(s), 4);
assert.equal(waitingCount(s), 2);
const pairTeam = s.courts[0].teams.find((t) => t.picked);
assert.deepEqual(pairTeam.p, ['Ben', 'Cy']);
assert.deepEqual(s.lastCall.names.slice().sort(), ['Ana', 'Ben', 'Cy', 'Dee']);

// End game: result saved, four go to the back, next four called.
s = addPlayers(s, ['Gus', 'Hal']);
s = endGame(s, 1, { a: 11, b: 7 }, () => 0);
assert.equal(s.results.length, 1);
assert.equal(s.games.Ben, 1);
assert.deepEqual(s.courts[0].teams.flatMap((t) => t.p).sort(), ['Eli', 'Fay', 'Gus', 'Hal']);
assert.deepEqual(s.queue.find((e) => e.p.length === 2).p, ['Ben', 'Cy']);
assert.equal(s.courts[0].game, 2);

// Random only splits pairs; queue controls work.
s = setAllowPicks(s, false);
assert.ok(s.queue.every((e) => e.p.length === 1));
const second = s.queue[1].id;
s = moveUp(s, second);
assert.equal(s.queue[0].id, second);
s = removeEntry(s, second);
assert.ok(!s.queue.some((e) => e.id === second));

// Solo + pair + pair: the second pair is split to fill the fourth spot.
let t = newSession({ courts: 1 });
t = addPlayers(t, ['S1']);
t = addPlayers(t, ['P1', 'P2'], { asPair: true });
t = addPlayers(t, ['Q1', 'Q2'], { asPair: true });
t = fillCourt(t, 1, () => 0);
assert.equal(playingCount(t), 4);
assert.deepEqual(t.queue.map((e) => e.p), [['Q2']]);

// The "Next game" preview is exactly what gets called, random pairs included,
// and "After that" becomes the next preview once the first game is on.
let u = newSession({ courts: 2 });
u = addPlayers(u, ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4']);
const [preview, afterThat] = upcoming(u, 2);
assert.deepEqual(upcoming(u, 2)[0], preview); // stable across renders
u = fillCourt(u, 1);
assert.deepEqual(u.courts[0].teams, preview);
assert.deepEqual(upcoming(u, 1)[0], afterThat);
u = fillCourt(u, 2);
assert.deepEqual(u.courts[1].teams, afterThat);
// Shuffle re-rolls the seed; picked partners are never split by it.
let w = addPlayers(newSession({ courts: 1 }), ['X1', 'X2'], { asPair: true });
w = addPlayers(w, ['Y1', 'Y2']);
w = reshuffle(w, () => 0.5);
assert.ok(upcoming(w, 1)[0].some((team) => team.picked && team.p.join() === 'X1,X2'));

// Rankings: a good record beats simply playing more.
{
  const g = (a, b, sa, sb) => ({ teams: [[a], [b]], score: { a: sa, b: sb } });
  const r = [...Array(3).fill(g('Perfect', 'X', 11, 0)), ...Array(4).fill(g('Grinder', 'Y', 11, 9)), ...Array(6).fill(g('Y', 'Grinder', 11, 9))];
  const t = rankings(r);
  assert.ok(t.findIndex((p) => p.name === 'Perfect') < t.findIndex((p) => p.name === 'Grinder'));
  // One lucky win does not beat a long winning record.
  const s = rankings([g('Lucky', 'A', 11, 9), ...Array(6).fill(g('Steady', 'B', 11, 9)), ...Array(2).fill(g('C', 'Steady', 11, 9))]);
  assert.ok(s.findIndex((p) => p.name === 'Steady') < s.findIndex((p) => p.name === 'Lucky'));
  // No scores at all: most games played first.
  const none = rankings([{ teams: [['P'], ['Q']], score: null }, { teams: [['P'], ['R']], score: null }]);
  assert.equal(none[0].name, 'P');
  // Best-of-3: games decide the win, real points fill the points columns.
  const [w] = rankings([{ teams: [['W'], ['L']], score: { a: 2, b: 1, points: { a: 55, b: 50 } } }]);
  assert.deepEqual([w.name, w.wins, w.pointsFor, w.diff], ['W', 1, 55, 5]);
}

// Game formats.
{
  let m = newMatch({ sport: 'pickleball', scoring: 'rally', target: 15 });
  m = rally(m, 'b');
  assert.deepEqual([m.a, m.b, m.serving], [0, 1, 'b']); // the receiving side scores too
  assert.equal(callText(m), '1 – 0'); // no server number
  const won = 'a'.repeat(15).split('').reduce((x, s) => rally(x, s), newMatch({ scoring: 'rally', target: 15 }));
  assert.equal(winner(won), 'a');
  const almost = 'a'.repeat(10).split('').reduce((x, s) => rally(x, s), rally(newMatch({ scoring: 'rally' }), 'b'));
  assert.ok(isGamePoint(rally(almost, 'b')) || isGamePoint(almost));

  const one = 'a'.repeat(15).split('').reduce((x, s) => rally(x, s), newMatch({ sport: 'badminton', target: 15, bestOf: 1 }));
  assert.equal(winner(one), 'a');
  assert.deepEqual(matchScore(one), { a: 15, b: 0 }); // one game: the real points
  assert.equal(newMatch({ sport: 'badminton', target: 15 }).cap, 21);
  const three = 'a'.repeat(42).split('').reduce((x, s) => rally(x, s), newMatch({ sport: 'badminton' }));
  assert.deepEqual(matchScore(three), { a: 2, b: 0, points: { a: 42, b: 0 } });
  assert.deepEqual(matchScore(newMatch({ sport: 'pickleball' })), { a: 0, b: 0 });
}

// Running a session: cancel, swap, courts, corrections.
{
  let s = addPlayers(newSession({ courts: 2 }), ['A', 'B', 'C', 'D', 'E', 'F']);
  s = fillCourt(s, 1, () => 0);
  const on = s.courts[0].teams.flatMap((t) => t.p);
  const cancelled = cancelGame(s, 1);
  assert.deepEqual(cancelled.queue.slice(0, 4).map((e) => e.p[0]), on);
  assert.equal(cancelled.courts[0].teams.length, 0);
  assert.equal(cancelled.results.length, 0);

  const swapped = replacePlayer(s, 1, on[0], s.queue[0].id);
  assert.ok(swapped.courts[0].teams.flatMap((t) => t.p).includes('E') && !swapped.courts[0].teams.flatMap((t) => t.p).includes(on[0]));
  assert.deepEqual([swapped.queue.at(-1).p[0], swapped.queue.at(-1).away], [on[0], true]);
  assert.equal(replacePlayer(setAway(s, s.queue[0].id, true), 1, on[0], s.queue[0].id).queue.length, 2); // nobody on a break

  assert.equal(removeCourt(s, 1).courts.length, 2); // a game is on it
  let c = removeCourt(s, 2);
  assert.deepEqual(c.courts.map((x) => x.id), [1]);
  assert.equal(removeCourt(cancelGame(c, 1), 1).courts.length, 1); // the last court stays
  assert.deepEqual(addCourt(removeCourt(addCourt(s), 2)).courts.map((x) => x.id), [1, 3, 4]); // numbers are never reused while in use

  let e = endGame(s, 1, { a: 11, b: 3 }, () => 0);
  const id = e.results[0].id;
  assert.equal(editResult(e, id, { a: 5, b: 11 }).results[0].winner, 'b');
  assert.deepEqual([editResult(e, id, null, 'a').results[0].score, editResult(e, id, null, 'a').results[0].winner], [null, 'a']);
  const gone = deleteResult(e, id);
  assert.equal(gone.results.length, 0);
  on.forEach((n) => assert.equal(gone.games[n], 0));
}

// Rankings: ties share a rank.
const table = rankings([
  { court: 1, teams: [['Ana', 'Ben'], ['Cy', 'Dee']], score: { a: 11, b: 4 } },
  { court: 1, teams: [['Ana', 'Cy'], ['Ben', 'Dee']], score: { a: 11, b: 9 } },
  { court: 1, teams: [['Ana', 'Dee'], ['Ben', 'Cy']], score: null },
], ['Eve']);
assert.deepEqual(table.map((p) => p.name), ['Ana', 'Ben', 'Cy', 'Dee', 'Eve']);
assert.deepEqual([table[0].wins, table[0].played, table[0].diff], [2, 3, 9]);
assert.deepEqual([table[1].rank, table[2].rank], [2, 3]); // Ben +5 beats Cy -5
const tie = rankings([{ court: 1, teams: [['X', 'Y'], ['Z', 'W']], score: { a: 11, b: 6 } }]);
assert.deepEqual(tie.map((p) => p.rank), [1, 1, 3, 3]); // partners share a rank
assert.deepEqual([table[4].played, table[4].rank], [0, null]);

// Finishing: games in progress count only if a score is given.
let f = addPlayers(newSession({ courts: 2 }), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
f = fillCourt(fillCourt(f, 1), 2);
const summary = finishSession(f, { 1: { a: 5, b: 3 } });
assert.equal(summary.games, 1);
assert.equal(summary.standings.length, 8);
assert.equal(summary.standings.filter((p) => p.wins === 1).length, 2);

// Pair two solos from the line: they keep the earlier spot; split puts them back.
let q = addPlayers(newSession({ courts: 1 }), ['Ana', 'Ben', 'Cy', 'Dee']);
const [qa, , qc] = q.queue.map((e) => e.id);
q = pairUp(q, qc, qa);
assert.deepEqual(q.queue.map((e) => e.p), [['Cy', 'Ana'], ['Ben'], ['Dee']]);
q = splitPair(q, q.queue[0].id);
assert.deepEqual(q.queue.map((e) => e.p), [['Cy'], ['Ana'], ['Ben'], ['Dee']]);
const ro = setAllowPicks(q, false);
assert.equal(pairUp(ro, ro.queue[0].id, ro.queue[1].id).queue.length, 4); // random only: no pairing
assert.equal(pairUp(q, q.queue[0].id, q.queue[1].id).queue.length, 3); // same call works when picks are on

// Finishing without a score: the picked winner is saved and counts as a win.
let v = addPlayers(newSession({ courts: 1 }), ['V1', 'V2', 'V3', 'V4']);
v = fillCourt(v, 1, () => 0);
const winners = v.courts[0].teams[1].p;
v = endGame(v, 1, null, () => 0, 'b');
assert.deepEqual([v.results[0].score, v.results[0].winner], [null, 'b']);
const vt = rankings(v.results);
assert.deepEqual(vt.filter((p) => p.wins === 1).map((p) => p.name).sort(), [...winners].sort());
assert.deepEqual([vt[0].pointsFor, vt[3].losses], [0, 1]);
// A real score beats the picked winner.
v = endGame(fillCourt(v, 1, () => 0), 1, { a: 11, b: 3 }, () => 0, 'b');
assert.equal(v.results[0].winner, 'a');

// Account keys: format, forgiving parsing, key id.
assert.equal(ALPHABET.length, 32);
const k = newKey();
assert.match(k, /^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/);
assert.deepEqual(parseKey(k.toLowerCase().replaceAll('-', ' ')), { key: k, keyId: k.replaceAll('-', '').slice(0, 8) });
assert.equal(parseKey('ABCD-EFGH-JKMN-PQR'), null); // too short
assert.equal(parseKey('ABCD-EFGH-JKMN-PQR0'), null); // 0 is not in the alphabet
assert.equal(newKey(() => new Uint8Array(16)), '2222-2222-2222-2222'); // byte 0 -> first letter
assert.match(newPlayerCode(), /^[2-9A-HJ-NP-Z]{6}$/);
assert.equal(keyEmail('ABCD2345'), 'abcd2345@keys.sidecourt.invalid');

// Saved games get a UUID and a time, so uploads can be retried safely.
assert.match(v.results[0].id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.notEqual(v.results[0].id, v.results[1].id);
assert.ok(!Number.isNaN(Date.parse(v.results[0].at)));

// History rows: only games with a linked player, ids mapped per team.
const rows = gameRows({
  name: 'Tue', sport: 'pickleball', endedAt: '2026-11-17T12:00:00Z',
  results: [
    { id: 'g1', at: '2026-11-17T11:00:00Z', court: 1, teams: [['Ana', 'Ben'], ['Cy', 'Dee']], score: { a: 11, b: 5 }, winner: 'a' },
    { id: 'g2', court: 2, teams: [['Eve', 'Fay'], ['Gus', 'Hal']], score: null, winner: null },
  ],
}, { Ben: 'u-ben', Dee: 'u-dee' });
assert.equal(rows.length, 1);
assert.deepEqual([rows[0].players_a, rows[0].players_b, rows[0].score_a, rows[0].winner], [['u-ben'], ['u-dee'], 11, 'a']);
// Session row: one per finished open play; each linked account listed once.
const srow = sessionRow({ name: 'Tue', sport: 'pickleball', endedAt: '2026-11-17T12:00:00Z', results: [], standings: [] }, { Ben: 'u-ben', 'Ben (ABCD)': 'u-ben', Dee: 'u-dee' }, 'sess-1');
assert.deepEqual([srow.id, srow.name, srow.ended_at, srow.player_ids], ['sess-1', 'Tue', '2026-11-17T12:00:00Z', ['u-ben', 'u-dee']]);
assert.equal(srow.summary.name, 'Tue');

// Lobby: players never see account ids; codes read from links or typed text.
const pub = publicState({ name: 'X', accounts: { Ana: 'secret-id' }, results: Array.from({ length: 15 }, (_, i) => i), queue: [] });
assert.equal(pub.accounts, undefined);
assert.equal(pub.results.length, 15);
assert.equal(codeFrom('https://sidecourt.netlify.app/lobby?code=abc234'), 'ABC234');
assert.equal(codeFrom(' zmz efh '), 'ZMZEFH');
assert.equal(codeFrom('https://example.com/no-code'), null);
assert.equal(codeFrom('ABC10O'), null); // 1, 0 and O are never in codes

// QR round trip: the QR the app draws (qrcode-generator) is readable by the
// iPhone/desktop scanner (jsQR), and the scanned link gives back the code.
{
  const link = 'https://sidecourt.netlify.app/openplay?code=ZMZEFH';
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const cell = 4, margin = 4 * cell, n = qr.getModuleCount(), size = n * cell + 2 * margin;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.floor((y - margin) / cell), c = Math.floor((x - margin) / cell);
      if (r >= 0 && c >= 0 && r < n && c < n && qr.isDark(r, c)) pixels.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 3);
    }
  }
  const read = jsQR(pixels, size, size);
  assert.equal(read?.data, link);
  assert.equal(codeFrom(read.data), 'ZMZEFH');
}

// Fair matchmaking: no repeat partners, balanced skill, and Shuffle still varies.
{
  const past = [
    { teams: [['A', 'B'], ['C', 'D']], score: { a: 11, b: 2 } }, // A & B partnered (and won big)
  ];
  const h = playHistory(past);
  assert.equal(h.partners('B', 'A'), 1);
  assert.equal(h.opponents('A', 'C'), 1);
  assert.ok(h.skill('A') > 0.5 && h.skill('C') < 0.5);
  assert.ok(splitCost(['A', 'B'], ['C', 'D'], h) > splitCost(['A', 'C'], ['B', 'D'], h));

  // Every random draw: A and B (last game's partners and both winners) are split up.
  let f = addPlayers(newSession({ courts: 1 }), ['A', 'B', 'C', 'D']);
  f = { ...f, results: past };
  for (const r of [0, 0.3, 0.6, 0.99]) {
    const teams = fillCourt(f, 1, () => r).courts[0].teams.map((t) => t.p.slice().sort().join());
    assert.ok(!teams.includes('A,B') && !teams.includes('C,D'), `random ${r}: ${teams}`);
  }
  // No history: all 3 splits are equally fair, so different seeds give different teams.
  const fresh = addPlayers(newSession({ courts: 1 }), ['A', 'B', 'C', 'D']);
  const seen = new Set([0, 0.4, 0.8].map((r) => fillCourt(fresh, 1, () => r).courts[0].teams.map((t) => t.p.slice().sort().join()).sort().join(' vs ')));
  assert.equal(seen.size, 3);
}

// Untrusted data: odd scores never reach the database; broken sessions are not shown.
{
  const sum = { name: 'x'.repeat(150), sport: 'pickleball', endedAt: '2026-11-20T10:00:00Z', games: 1,
    results: [{ id: 'g', court: 1, teams: [['Ana'], ['Ben']], score: { a: -5, b: 1.5 }, winner: 'a' }], standings: rankings([]) };
  const [row] = gameRows(sum, { Ana: 'id' });
  assert.ok(row.score_a === null && row.score_b === null && row.session_name.length === 100);
  assert.equal(sessionRow(sum, {}, 'i').name.length, 100);
  assert.ok(validSummary(finishSession(newSession({ name: 'Real' }))));
  const played = rankings([{ teams: [['Ana'], ['Ben']], score: { a: 11, b: 5 } }]);
  assert.ok(validSummary({ ...sum, standings: played }));
  for (const bad of [null, {}, { broken: true }, { ...sum, standings: [{ name: 'A' }] }, { ...sum, results: [{ teams: 'x' }] }, { ...sum, sport: 'chess' }, { ...sum, endedAt: 'soon' }]) assert.ok(!validSummary(bad));
}

// Lobby identity and changed-only polling.
{
  const tokens = await linkTokens({ Ana: 'id-1', 'Ana (ABCD)': 'id-2' }, 'CODE22');
  assert.equal(tokens[await linkToken('id-2', 'CODE22')], 'Ana (ABCD)');
  assert.ok(!JSON.stringify(tokens).includes('id-1'));
  assert.notEqual(await linkToken('id-1', 'CODE22'), await linkToken('id-1', 'OTHER2')); // differs per lobby
  const old = { state: { x: 1 }, open: true, updated_at: 't1' };
  assert.deepEqual(mergeLobby(old, { state: null, open: false, updated_at: 't1' }), { state: { x: 1 }, open: false, updated_at: 't1' });
  assert.deepEqual(mergeLobby(old, { state: { x: 2 }, open: true, updated_at: 't2' }).state, { x: 2 });
  assert.equal(mergeLobby(old, null), null);
  const key = 'ABCD-EFGH-JKMN-PQRS';
  const id = await keyLookupId(key);
  assert.ok(/^[2-9A-HJ-NP-Z]{8}$/.test(id) && id !== 'ABCDEFGH' && id === await keyLookupId(key) && id !== await keyLookupId('ABCD-EFGH-JKMN-PQRT'));
}

// Scorer links: secrets never reach players; a remote score only counts for the game now on court.
{
  assert.ok(!('scoreKeys' in publicState({ name: 'X', scoreKeys: { 1: 'SECRETSECRET' }, queue: [] })));
  const court = { id: 1, game: 2, teams: [{ p: ['Ana', 'Ben'] }, { p: ['Cy', 'Dee'] }] };
  const m = { game: 2, names: { a: 'Ana / Ben', b: 'Cy / Dee' }, sport: 'pickleball', a: 3, b: 1, serving: 'a', history: [] };
  assert.ok(fitsCourt(m, court));
  assert.ok(!fitsCourt({ ...m, game: 1 }, court)); // earlier game on the same court
  assert.ok(!fitsCourt({ ...m, names: { a: 'Ana / Cy', b: 'Ben / Dee' } }, court)); // other players
  for (const bad of [{ a: -1 }, { b: 'x' }, { a: 1.5 }, { history: 'no' }, { serving: 'z' }, { sport: 'badminton' }]) assert.ok(!fitsCourt({ ...m, ...bad }, court)); // not a real score
  assert.deepEqual(scoreForCourt({ ...m, names: { a: 'Old / Ben', b: 'Cy / Dee' } }, court).names.a, 'Ana / Ben'); // a swapped player keeps the score
  assert.equal(scoreForCourt({ ...m, game: 1 }, court), null);
  assert.ok(!fitsCourt(m, { ...court, teams: [] }) && !fitsCourt(null, court) && !fitsCourt({ game: 2 }, court));
}

// Past players: most regular first; suggestions; account links stay with the manager who made them.
{
  let r = recordPlayers([], ['Ana Reyes', 'Ben'], { at: '2026-01-01', accounts: { Ben: 'id-ben' }, userId: 'm1' });
  r = recordPlayers(r, ['ana reyes', 'Cy'], { at: '2026-01-02' });
  assert.deepEqual(r.map((p) => [p.name, p.sessions]), [['ana reyes', 2], ['Cy', 1], ['Ben', 1]]);
  assert.equal(r.find((p) => p.name === 'Ben').accountId, 'id-ben'); // kept when not re-recorded
  assert.deepEqual(rankRoster(forgetPlayer(r, 'CY')).map((p) => p.name), ['ana reyes', 'Ben']);

  assert.equal(lastTyped('Ana, Be '), 'Be');
  assert.equal(withoutLastTyped('Ana, Be'), 'Ana, ');
  assert.equal(withoutLastTyped('Be'), '');
  assert.deepEqual(suggestPlayers(r, 'Ana, b'), ['Ben']);
  assert.deepEqual(suggestPlayers(r, 're'), ['ana reyes']); // any word of the name
  assert.deepEqual(suggestPlayers(r, 'b', (n) => n === 'Ben'), []); // already here
  assert.deepEqual(suggestPlayers(r, 'Ben, '), []); // nothing typed yet
  assert.deepEqual(suggestPlayers(r, 'Ben, b'), []); // already in the box

  const valid = new Set(['id-ben']);
  assert.equal(linkFor(r, 'BEN', 'm1', valid), 'id-ben');
  assert.equal(linkFor(r, 'Ben', 'm2', valid), null); // another manager on this device
  assert.equal(linkFor(r, 'Ben', null, valid), null); // signed out
  assert.equal(linkFor(r, 'Ben', 'm1', null), null); // not confirmed by the server
  assert.equal(linkFor(r, 'Ben', 'm1', new Set()), null); // account closed
  assert.equal(linkFor(dropLinks(r, 'm1', (id) => valid.has(id)), 'Ben', 'm1', valid), 'id-ben');
  assert.ok(!('accountId' in dropLinks(r, 'm1').find((p) => p.name === 'Ben')));
  assert.equal(dropLinks(r, 'm2').find((p) => p.name === 'Ben').accountId, 'id-ben');
}

// Break: an entry on a break keeps its place but is skipped; back, it plays from its old place.
{
  let s = addPlayers(newSession({ courts: 1 }), ['A', 'B', 'C', 'D', 'E']);
  s = setAway(s, s.queue[0].id, true);
  assert.equal(waitingCount(s), 4);
  assert.deepEqual(pickNext(s).taken.map((e) => e.p[0]), ['B', 'C', 'D', 'E']);
  assert.equal(pickNext(setAway(s, s.queue[1].id, true)), null); // only 3 left: no game
  const on = fillCourt(s, 1);
  assert.deepEqual(on.queue.map((e) => e.p[0]), ['A']); // still first in line
  assert.ok(!on.courts[0].teams.flatMap((t) => t.p).includes('A'));
  const back = setAway(s, s.queue[0].id, false);
  assert.deepEqual(pickNext(back).taken.map((e) => e.p[0]), ['A', 'B', 'C', 'D']);
  assert.equal(pairUp(s, s.queue[0].id, s.queue[1].id).queue.length, 5); // no pairing with someone on a break
  // A pair on a break is not split to fill a last spot, and stays on a break when split by hand.
  let p = addPlayers(addPlayers(newSession({ courts: 1 }), ['A', 'B', 'C']), ['X', 'Y'], { asPair: true });
  p = setAway(p, p.queue[3].id, true);
  assert.equal(pickNext(p), null);
  assert.ok(splitPair(p, p.queue[3].id).queue.slice(3).every((e) => e.away));
  assert.ok(setAllowPicks(p, false).queue.slice(3).every((e) => e.away));
}

// Share cards: 1 overall + 1 per top-3 player; names cut and made safe; matches from the player's side.
{
  const res = [ // stored newest first, like a real session
    { court: 2, teams: [['Ana <b>&', 'Cy'], ['A very long player name indeed', 'Dee']], score: null, winner: 'a' },
    { court: 1, teams: [['Ana <b>&', 'A very long player name indeed'], ['Cy', 'Dee']], score: { a: 11, b: 5 } },
  ];
  const sum = { name: 'Friday Night!', sport: 'badminton', endedAt: '2026-11-20T10:00:00Z', games: 2, results: res, standings: rankings(res) };
  assert.deepEqual(overallStats(sum), { games: 2, players: 4, points: 16 });
  const cards = shareCards(sum, { site: 'example.app' });
  assert.deepEqual(cards.map((c) => c.id), ['overall', 'top-1', 'top-2', 'top-3']);
  assert.deepEqual(cards.map((c) => c.file), ['friday-night-overall.png', 'friday-night-top-1.png', 'friday-night-top-2.png', 'friday-night-top-3.png']);
  for (const c of cards) assert.ok(c.svg.startsWith('<svg') && !c.svg.includes('<b>') && !c.svg.includes('undefined') && !c.svg.includes('NaN'), c.id);
  assert.ok(cards[0].svg.includes('FINAL STANDINGS') && cards[0].svg.includes('TOP 3') && cards[0].svg.includes('Ana &lt;b&gt;&amp;'));
  assert.ok(cards[1].svg.includes('1ST PLACE') && cards[2].svg.includes('2ND PLACE') && cards[3].svg.includes('3RD PLACE'));
  assert.ok(cards[0].svg.includes('…') && !cards[0].svg.includes('A very long player name indeed'));
  // Ana's matches in playing order, seen from her side.
  assert.deepEqual(playerMatches(sum, 'Ana <b>&'), [
    { partner: 'A very long player name indeed', opponents: 'Cy & Dee', court: 1, result: 'win', score: '11–5' },
    { partner: 'Cy', opponents: 'A very long player name indeed & Dee', court: 2, result: 'win', score: null },
  ]);
  assert.equal(playerMatches(sum, 'Dee')[0].score, '5–11'); // loser sees their own score first

  // Sizes: story 1080x1920; landscape 1920x1080, laid out larger and drawn at 80% so its text is smaller.
  const wide = shareCards(sum, { orientation: 'landscape', background: 'transparent' });
  assert.deepEqual([wide[0].width, wide[0].height, cards[0].width, cards[0].height], [1920, 1080, 1080, 1920]);
  assert.ok(wide.every((c) => c.svg.includes('width="1920" height="1080"') && c.svg.includes('transform="scale(0.8)"')));
  assert.ok(cards.every((c) => !c.svg.includes('transform="scale(')));
  // Dark has a background and no shadow. See-through is text only: no background shape, letters carry the soft glow.
  assert.ok(cards.every((c) => c.svg.includes('fill="url(#bg)"') && !c.svg.includes('url(#glow)')));
  assert.ok(wide.every((c) => c.svg.includes('filter="url(#glow)"') && !/<rect|fill="url\(#(bg|warm|cool)\)"/.test(c.svg)));

  // Every text line as [baseline y, font size].
  const lines = (svg) => [...svg.matchAll(/<text x="[^"]+" y="([\d.]+)" font-size="([\d.]+)"/g)].map((mm) => [Number(mm[1]), Number(mm[2])]);
  // Type is big enough to read on a phone: headline numbers at least 3x the smallest text.
  for (const c of cards.slice(1)) {
    const sizes = lines(c.svg).map(([, size]) => size);
    assert.ok(Math.max(...sizes) >= 90 && Math.min(...sizes) >= 22, `${c.id}: ${Math.min(...sizes)}–${Math.max(...sizes)}px`);
  }
  // Story: text stays inside the area kept clear of Instagram's bars (half of their full reach).
  assert.deepEqual(STORY_SAFE, { top: 125, bottom: 170 });
  for (const c of [...cards, ...shareCards(sum, { background: 'transparent' })]) {
    assert.ok(lines(c.svg).length > 5 && lines(c.svg).every(([y, size]) => y - size >= STORY_SAFE.top && y <= 1920 - STORY_SAFE.bottom), `${c.id}: text outside the kept-clear area`);
  }
  // The middle stays empty for a photo: no text between the top band and the bottom band.
  // (Landscape positions are on its 2400x1350 layout canvas.)
  for (const [cardsOf, from, to] of [[cards, 520, 1440], [wide, 370, 1060]]) {
    for (const c of cardsOf) assert.ok(lines(c.svg).every(([y]) => y < from || y > to), `${c.id}: text in the photo area`);
  }

  // Few things per card: top 3; closest games only where there is room (landscape); form letters on the story.
  const g = (a, b, sa, sb) => ({ court: 1, teams: [a, b], score: { a: sa, b: sb } });
  const night = [ // newest first
    g(['P1', 'P2'], ['P3', 'P4'], 11, 10), // gap 1
    g(['P1', 'P3'], ['P5', 'P6'], 11, 3), // gap 8
    g(['P1', 'P4'], ['P2', 'P5'], 11, 9), // gap 2
    g(['P1', 'P5'], ['P3', 'P6'], 11, 9), // gap 2
    g(['P1', 'P6'], ['P2', 'P4'], 11, 5), // gap 6
    { court: 2, teams: [['P2', 'P3'], ['P4', 'P5']], score: null, winner: 'a' }, // no score: never "closest"
  ];
  const big = { name: 'Big night', sport: 'pickleball', endedAt: '2026-11-20T10:00:00Z', games: 6, results: night, standings: rankings(night) };
  assert.deepEqual(closestGames(big, 3), [night[0], night[2], night[3]]);
  const [storyOverall, storyTop1] = shareCards(big);
  const [wideOverall, wideTop1] = shareCards(big, { orientation: 'landscape' });
  assert.ok(storyOverall.svg.includes('TOP 3') && !storyOverall.svg.includes('CLOSEST'));
  assert.ok(wideOverall.svg.includes('CLOSEST GAMES') && wideOverall.svg.includes('11–10') && !wideOverall.svg.includes('11–3'));
  assert.equal((storyTop1.svg.match(/>W<\/text>/g) || []).length, 5); // P1 won all 5: five W letters
  assert.ok(storyTop1.svg.includes('WIN RATE') && storyTop1.svg.includes('100%'));
  assert.ok(wideTop1.svg.includes('LAST 3 OF 5 GAMES'));

  // Location: on every card when set, made safe, and nowhere when not set.
  const placed = { ...big, location: 'Riverside <Courts> & Gym' };
  for (const o of ['portrait', 'landscape']) {
    const withPlace = shareCards(placed, { orientation: o });
    assert.ok(withPlace.every((c) => c.svg.includes('Riverside &lt;Courts&gt; &amp; Gym')), o);
    assert.ok(withPlace[0].svg.includes('Pickleball · 6 games'));
    const [from, to] = o === 'portrait' ? [520, 1440] : [370, 1060];
    for (const c of withPlace) assert.ok(lines(c.svg).every(([y]) => y < from || y > to), `${c.id}: location pushed text into the photo area`);
  }
  assert.ok(shareCards({ ...placed, name: 'A much longer session name here' }).every((c) => lines(c.svg).every(([y]) => y < 520 || y > 1440)));
  assert.ok(!shareCards(big)[0].svg.includes('Riverside'));
  assert.equal(finishSession({ ...newSession({ location: '  Riverside  ' }) }).location, 'Riverside');
  assert.ok(!('location' in finishSession(newSession())));
  // The logo is drawn as two letters, each one closed path.
  assert.equal((storyOverall.svg.match(/<path d="M[^"]+Z" fill="#ff8a4c"\/>/g) || []).length, 2);

  // Empty session: only the overall card, saying so.
  const empty = shareCards({ ...sum, games: 0, results: [], standings: [] });
  assert.ok(empty.length === 1 && empty[0].svg.includes('No games were played.'));
}

console.log('All checks passed.');
