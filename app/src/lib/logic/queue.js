// Open play session logic: courts, waiting queue, teammate options.
// Pure functions: each one returns a NEW session object.
//
// A queue entry is { id, p: [names], addedBy, away }.
//   away = on a break: keeps its place in the line but is skipped when games are called
//   p with 1 name  = wants a random teammate
//   p with 2 names = picked partners who stay together

const clone = (value) => JSON.parse(JSON.stringify(value));
const randomSeed = (random = Math.random) => Math.floor(random() * 4294967296) >>> 0;

// Random id for a saved game (UUID v4), so an upload that is retried is never stored twice.
// crypto.randomUUID would be shorter, but it only exists on https pages.
export function newId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Small seeded random generator (mulberry32). The session stores the seed, so
// the random teammates for the next game are decided ahead of time and the
// manager can see them before calling the game.
export function makeRng(seed) {
  let state = seed >>> 0;
  const rng = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.state = () => state;
  return rng;
}

export function newSession({ name = 'Open play', sport = 'pickleball', courts = 2, location = '' } = {}) {
  return {
    name,
    sport,
    location: location.trim(), // where the courts are (optional); shown on the share cards
    allowPicks: true, // queue manager can switch to "random only"
    nextId: 1,
    courts: Array.from({ length: courts }, (_, i) => ({ id: i + 1, teams: [], game: 0 })),
    queue: [],
    games: {}, // games played per player name
    results: [],
    lastCall: null, // { court, names } for the "now calling" banner
    seed: randomSeed(), // decides random teammates for upcoming games
  };
}

export function waitingCount(session) {
  return session.queue.reduce((sum, entry) => sum + (entry.away ? 0 : entry.p.length), 0);
}

export function playingCount(session) {
  return session.courts.reduce((sum, court) => sum + court.teams.reduce((n, team) => n + team.p.length, 0), 0);
}

export function hasPlayer(session, name) {
  const key = name.trim().toLowerCase();
  const inQueue = session.queue.some((entry) => entry.p.some((n) => n.toLowerCase() === key));
  const onCourt = session.courts.some((court) => court.teams.some((team) => team.p.some((n) => n.toLowerCase() === key)));
  return inQueue || onCourt;
}

// Check players in. asPair keeps exactly two names together as partners.
export function addPlayers(session, names, { asPair = false, addedBy = null } = {}) {
  const next = clone(session);
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (asPair && clean.length === 2 && next.allowPicks) {
    next.queue.push({ id: next.nextId++, p: clean, addedBy });
  } else {
    clean.forEach((n) => next.queue.push({ id: next.nextId++, p: [n], addedBy }));
  }
  return next;
}

export function moveUp(session, entryId) {
  const next = clone(session);
  const i = next.queue.findIndex((entry) => entry.id === entryId);
  if (i > 0) [next.queue[i - 1], next.queue[i]] = [next.queue[i], next.queue[i - 1]];
  return next;
}

// On a break: the entry stays where it is in the line, but games are called
// without it. Coming back, it is still in its old place (now nearer the top).
export function setAway(session, entryId, away) {
  const next = clone(session);
  const entry = next.queue.find((e) => e.id === entryId);
  if (entry) {
    if (away) entry.away = true;
    else delete entry.away;
  }
  return next;
}

export function removeEntry(session, entryId) {
  const next = clone(session);
  next.queue = next.queue.filter((entry) => entry.id !== entryId);
  return next;
}

// Two solo players in the line become partners. The pair keeps the earlier
// of the two places, so nobody loses their spot.
export function pairUp(session, firstId, secondId) {
  const next = clone(session);
  const i = next.queue.findIndex((entry) => entry.id === firstId);
  const j = next.queue.findIndex((entry) => entry.id === secondId);
  if (!next.allowPicks || i < 0 || j < 0 || i === j) return next;
  if (next.queue[i].p.length !== 1 || next.queue[j].p.length !== 1) return next;
  if (next.queue[i].away || next.queue[j].away) return next;
  const [early, late] = i < j ? [i, j] : [j, i];
  const first = next.queue[i];
  next.queue[early] = { id: next.nextId++, p: [first.p[0], next.queue[j].p[0]], addedBy: first.addedBy };
  next.queue.splice(late, 1);
  return next;
}

// Partners go back to being two solo players, side by side in the same place.
export function splitPair(session, entryId) {
  const next = clone(session);
  const i = next.queue.findIndex((entry) => entry.id === entryId);
  if (i < 0 || next.queue[i].p.length !== 2) return next;
  const { p, addedBy, away } = next.queue[i];
  next.queue.splice(i, 1, ...p.map((n) => ({ id: next.nextId++, p: [n], addedBy, ...(away && { away }) })));
  return next;
}

// Turning picks off splits every pair in the queue into solo players.
export function setAllowPicks(session, allow) {
  const next = clone(session);
  next.allowPicks = allow;
  if (!allow) {
    const split = [];
    next.queue.forEach((entry) => entry.p.forEach((n) => split.push({ id: next.nextId++, p: [n], addedBy: entry.addedBy, ...(entry.away && { away: true }) })));
    next.queue = split;
  }
  return next;
}

export function setLocation(session, location) {
  return { ...clone(session), location: location.trim() };
}

export function addCourt(session) {
  const next = clone(session);
  next.courts.push({ id: next.courts.length + 1, teams: [], game: 0 });
  return next;
}

// Which entries go on next? Walks the queue in order and takes whoever fits
// until there are 4 players. Returns null when fewer than 4 are waiting.
export function pickNext(session) {
  if (waitingCount(session) < 4) return null;
  let need = 4;
  let nextId = session.nextId;
  const taken = [];
  const rest = [];
  session.queue.forEach((entry) => {
    if (!entry.away && entry.p.length <= need) {
      taken.push(entry);
      need -= entry.p.length;
    } else {
      rest.push(entry);
    }
  });
  // Still short (e.g. solo + pair + pair): split the next pair to fill the last spot.
  for (let i = 0; i < rest.length && need > 0; i++) {
    if (!rest[i].away && rest[i].p.length === 2) {
      taken.push({ id: nextId++, p: [rest[i].p[0]], addedBy: rest[i].addedBy });
      rest[i] = { ...rest[i], p: [rest[i].p[1]] };
      need -= 1;
    }
  }
  return { taken, rest, nextId };
}

function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Who has played with and against whom tonight, and how well each player is doing.
export function playHistory(results = []) {
  const together = new Map(); // "Ana|Ben" -> games as partners
  const against = new Map(); // "Ana|Cy" -> games as opponents
  const record = new Map(); // name -> { wins, decided }
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const bump = (map, a, b) => map.set(key(a, b), (map.get(key(a, b)) || 0) + 1);
  results.forEach((r) => {
    const [A, B] = r.teams;
    [A, B].forEach((team) => { if (team.length === 2) bump(together, team[0], team[1]); });
    A.forEach((a) => B.forEach((b) => bump(against, a, b)));
    const won = r.winner ?? resultWinner(r.score);
    if (won) {
      [A, B].forEach((team, i) => team.forEach((n) => {
        const rec = record.get(n) || { wins: 0, decided: 0 };
        rec.decided += 1;
        if ((i === 0 ? 'a' : 'b') === won) rec.wins += 1;
        record.set(n, rec);
      }));
    }
  });
  return {
    partners: (a, b) => together.get(key(a, b)) || 0,
    opponents: (a, b) => against.get(key(a, b)) || 0,
    // Win rate pulled toward 50% so one game does not make anyone a "pro" or a "beginner".
    skill: (n) => {
      const rec = record.get(n) || { wins: 0, decided: 0 };
      return (rec.wins + 1) / (rec.decided + 2);
    },
  };
}

// How unfair a split of 4 players into [x, y] vs [z, w] is (lower is better):
// repeat partners count most, then repeat opponents, then a skill gap between teams.
export function splitCost([x, y], [z, w], h) {
  return 3 * (h.partners(x, y) + h.partners(z, w))
    + h.opponents(x, z) + h.opponents(x, w) + h.opponents(y, z) + h.opponents(y, w)
    + 4 * Math.abs(h.skill(x) + h.skill(y) - h.skill(z) - h.skill(w));
}

// Picked partners stay together. Four solo players get the fairest of the 3
// possible splits; near-equal options are chosen at random, so Shuffle can vary.
function buildTeams(taken, random, results) {
  const teams = [];
  const solos = [];
  taken.forEach((entry) => {
    if (entry.p.length === 2) teams.push({ p: entry.p, picked: true });
    else solos.push(entry.p[0]);
  });
  if (solos.length === 4) {
    const h = playHistory(results);
    const [a, b, c, d] = solos;
    const splits = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]].map((split) => ({ split, cost: splitCost(...split, h) }));
    const best = Math.min(...splits.map((o) => o.cost));
    const fair = splits.filter((o) => o.cost <= best + 0.5);
    const [first, second] = fair[Math.floor(random() * fair.length)].split;
    const [p1, p2] = random() < 0.5 ? [first, second] : [second, first]; // which side is A
    teams.push({ p: p1, picked: false }, { p: p2, picked: false });
    return teams;
  }
  const mixed = shuffle(solos, random);
  for (let i = 0; i < mixed.length; i += 2) teams.push({ p: mixed.slice(i, i + 2), picked: false });
  return teams;
}

// The next game as it will be called: who plays and who is paired with whom.
export function planNext(session, random = makeRng(session.seed ?? 1)) {
  const picked = pickNext(session);
  if (!picked) return null;
  return { ...picked, teams: buildTeams(picked.taken, random, session.results) };
}

// The next few games in order, without changing the session.
// Entry 0 is exactly what "call next game" will put on a court.
export function upcoming(session, count = 2) {
  const rng = makeRng(session.seed ?? 1);
  const games = [];
  let sim = session;
  for (let i = 0; i < count; i++) {
    const plan = planNext(sim, rng);
    if (!plan) break;
    games.push(plan.teams);
    sim = { ...sim, queue: plan.rest, nextId: plan.nextId };
  }
  return games;
}

// Re-roll the random teammates for upcoming games.
export function reshuffle(session, random = Math.random) {
  const next = clone(session);
  next.seed = randomSeed(random);
  return next;
}

// Put the next four players on an empty court.
// Picked partners stay a team; solo players are paired at random
// (using the session seed unless a random function is passed in).
export function fillCourt(session, courtId, random) {
  const next = clone(session);
  const court = next.courts.find((c) => c.id === courtId);
  if (!court || court.teams.length) return next;
  const rng = random || makeRng(next.seed ?? 1);
  const plan = planNext(next, rng);
  if (!plan) return next;

  court.teams = plan.teams;
  court.game += 1;
  next.queue = plan.rest;
  next.nextId = plan.nextId;
  if (!random) next.seed = rng.state();
  next.lastCall = { court: court.id, names: plan.teams.flatMap((team) => team.p) };
  return next;
}

// Finish the game on a court: save the result, send all four players to the
// back of the queue, then call the next four.
// winner ('a' or 'b') is for when the manager did not keep score but knows who
// won. A score with a clear winner always decides it instead.
export function resultWinner(score, winner = null) {
  if (score && score.a !== score.b) return score.a > score.b ? 'a' : 'b';
  return winner === 'a' || winner === 'b' ? winner : null;
}

export function endGame(session, courtId, score = null, random, winner = null) {
  let next = clone(session);
  const court = next.courts.find((c) => c.id === courtId);
  if (!court || !court.teams.length) return next;

  next.results.unshift({
    id: newId(), at: new Date().toISOString(),
    court: court.id, game: court.game, teams: court.teams.map((team) => team.p), score, winner: resultWinner(score, winner),
  });
  court.teams.forEach((team) => {
    team.p.forEach((n) => {
      next.games[n] = (next.games[n] || 0) + 1;
    });
    if (team.picked && next.allowPicks) next.queue.push({ id: next.nextId++, p: team.p, addedBy: null });
    else team.p.forEach((n) => next.queue.push({ id: next.nextId++, p: [n], addedBy: null }));
  });
  court.teams = [];
  return fillCourt(next, courtId, random);
}

// ---------- End of session ----------

// Every name checked in this session: played, waiting or on court.
export function allPlayers(session) {
  const names = new Set(Object.keys(session.games));
  session.queue.forEach((entry) => entry.p.forEach((n) => names.add(n)));
  session.courts.forEach((court) => court.teams.forEach((team) => team.p.forEach((n) => names.add(n))));
  return [...names];
}

// Player standings from the results. A score, or a winner the manager picked,
// decides wins and losses; games with neither still count as played.
// Order: wins, then win rate, then point difference, then points scored.
// Players who never played come last with rank null.
export function rankings(results, players = []) {
  const table = new Map();
  const row = (name) => {
    if (!table.has(name)) table.set(name, { name, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
    return table.get(name);
  };
  players.forEach(row);
  results.forEach((r) => {
    r.teams.forEach((team, i) => team.forEach((name) => {
      const p = row(name);
      p.played += 1;
      const won = r.winner ?? resultWinner(r.score);
      if (!r.score) {
        // Winner picked without a score: counts as a win or loss, no points.
        if (won) p[won === (i === 0 ? 'a' : 'b') ? 'wins' : 'losses'] += 1;
        return;
      }
      const mine = i === 0 ? r.score.a : r.score.b;
      const theirs = i === 0 ? r.score.b : r.score.a;
      p.pointsFor += mine;
      p.pointsAgainst += theirs;
      if (mine > theirs) p.wins += 1;
      if (mine < theirs) p.losses += 1;
    }));
  });
  const list = [...table.values()].map((p) => {
    const decided = p.wins + p.losses;
    return { ...p, diff: p.pointsFor - p.pointsAgainst, winRate: decided ? p.wins / decided : 0 };
  });
  // Anyone who played ranks above anyone who did not.
  const key = (p) => [p.played > 0 ? 1 : 0, p.wins, p.winRate, p.diff, p.pointsFor];
  list.sort((x, y) => {
    const kx = key(x);
    const ky = key(y);
    for (let i = 0; i < kx.length; i++) if (kx[i] !== ky[i]) return ky[i] - kx[i];
    return x.name.localeCompare(y.name);
  });
  // Players with identical numbers share a rank (1, 2, 2, 4). No games, no rank.
  list.forEach((p, i) => {
    const prev = list[i - 1];
    if (!p.played) p.rank = null;
    else p.rank = prev && key(prev).every((v, j) => v === key(p)[j]) ? prev.rank : i + 1;
  });
  return list;
}

// Close the session. liveScores maps courtId -> { a, b } for games in progress
// that should still count; any other game in progress is dropped.
export function finishSession(session, liveScores = {}, endedAt = new Date().toISOString()) {
  const results = [...session.results];
  session.courts.forEach((court) => {
    const score = liveScores[court.id];
    if (court.teams.length && score) {
      results.unshift({
        id: newId(), at: endedAt,
        court: court.id, game: court.game, teams: court.teams.map((t) => t.p), score, winner: resultWinner(score), unfinished: true,
      });
    }
  });
  return {
    name: session.name,
    sport: session.sport,
    endedAt,
    ...(session.location?.trim() ? { location: session.location.trim() } : {}),
    games: results.length,
    results,
    standings: rankings(results, allPlayers(session)),
  };
}
