// Quick checks for the rules. Run with:  node tests/run.mjs
import assert from 'node:assert/strict';
import { newMatch, rally, undo, winner, callText, serviceCourt, isGamePoint } from '../src/lib/logic/scoring.js';
import { newSession, addPlayers, fillCourt, endGame, pickNext, setAllowPicks, waitingCount, playingCount, moveUp, removeEntry, upcoming, reshuffle, rankings, finishSession, pairUp, splitPair, playHistory, splitCost } from '../src/lib/logic/queue.js';

import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';
import { publicState, codeFrom } from '../src/lib/logic/lobby.js';
import { gameRows } from '../src/lib/logic/history.js';
import { newKey, newPlayerCode, parseKey, keyEmail, ALPHABET } from '../src/lib/logic/keys.js';

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

// Rankings: wins first, then win rate, point difference, points scored; ties share a rank.
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

console.log('All checks passed.');
