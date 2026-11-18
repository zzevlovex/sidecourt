// Scoring rules for pickleball and badminton.
// Pure functions: each one takes a match and returns a NEW match, so undo is easy.

const other = (side) => (side === 'a' ? 'b' : 'a');

// Copy of the match without its history (used for undo snapshots).
function snapshot(match) {
  const { history, ...rest } = match;
  return JSON.parse(JSON.stringify(rest));
}

// Badminton's cap for each game length: the score where the next point always wins.
const CAPS = { 11: 15, 15: 21, 21: 30 };

// The usual way to play in open play.
export const defaultFormat = (sport) => (sport === 'badminton' ? { target: 21, bestOf: 1 } : { target: 11, scoring: 'sideout' });

export function newMatch({ sport = 'pickleball', doubles = true, target, names, scoring = 'sideout', bestOf = 3 } = {}) {
  const base = {
    sport,
    doubles,
    names: names || { a: 'Side A', b: 'Side B' },
    a: 0,
    b: 0,
    serving: 'a',
    history: [],
  };
  if (sport === 'badminton') {
    // Rally scoring, win by 2 up to the cap. Default: to 21, cap 30, best of 3 games.
    const to = target || 21;
    return { ...base, target: to, cap: CAPS[to] ?? to + 9, bestOf, games: { a: 0, b: 0 }, finished: [] };
  }
  // Rally scoring: every rally scores a point.
  if (scoring === 'rally') return { ...base, target: target || 11, scoring, server: 1 };
  // Side-out scoring. Doubles starts on server 2 ("0-0-2").
  return { ...base, target: target || 11, scoring: 'sideout', server: doubles ? 2 : 1 };
}

// Returns 'a', 'b' or null.
export function winner(match) {
  if (match.sport === 'badminton') {
    const needed = Math.ceil(match.bestOf / 2);
    if (match.games.a >= needed) return 'a';
    if (match.games.b >= needed) return 'b';
    return null;
  }
  if (match.a >= match.target && match.a - match.b >= 2) return 'a';
  if (match.b >= match.target && match.b - match.a >= 2) return 'b';
  return null;
}

// Record that `side` won the rally.
export function rally(match, side) {
  if (winner(match)) return match;
  const next = snapshot(match);
  next.history = [...match.history, snapshot(match)];

  if (match.sport === 'badminton') {
    next[side] += 1;
    next.serving = side; // rally winner always serves next
    const mine = next[side];
    const theirs = next[other(side)];
    const gameWon = (mine >= next.target && mine - theirs >= 2) || mine === next.cap;
    if (gameWon) {
      next.finished.push({ a: next.a, b: next.b });
      next.games[side] += 1;
      if (!winner(next)) {
        next.a = 0;
        next.b = 0;
      }
    }
    return next;
  }

  if (match.scoring === 'rally') {
    next[side] += 1;
    next.serving = side;
    return next;
  }

  // Side-out pickleball: only the serving side can score.
  if (side === match.serving) {
    next[side] += 1;
  } else if (match.doubles && match.server === 1) {
    next.server = 2; // first server lost the rally, partner serves
  } else {
    next.serving = side; // side out
    next.server = 1;
  }
  return next;
}

export function undo(match) {
  if (!match.history.length) return match;
  const previous = match.history[match.history.length - 1];
  return { ...previous, history: match.history.slice(0, -1) };
}

// Side-out doubles calls a third number: which partner is serving.
export const usesServerNumber = (match) => match.sport === 'pickleball' && match.doubles && match.scoring !== 'rally';

// What a finished or running match saves as its score. With several badminton
// games the score is games won, and the real points are kept alongside it.
export function matchScore(match) {
  if (match.sport !== 'badminton' || match.bestOf === 1) return { a: match.a, b: match.b };
  const games = winner(match) ? match.finished : [...match.finished, { a: match.a, b: match.b }];
  const total = (side) => games.reduce((sum, g) => sum + g[side], 0);
  return { a: match.games.a, b: match.games.b, points: { a: total('a'), b: total('b') } };
}

// Score call, e.g. "8 – 6 – 2" (serving, receiving, server number).
export function callText(match) {
  const serving = match[match.serving];
  const receiving = match[other(match.serving)];
  if (usesServerNumber(match)) return `${serving} – ${receiving} – ${match.server}`;
  return `${serving} – ${receiving}`;
}

// Badminton: serve from the right court on an even score, left on odd.
export function serviceCourt(match) {
  return match[match.serving] % 2 === 0 ? 'right' : 'left';
}

// True when the next point could end the game.
export function isGamePoint(match) {
  if (winner(match)) return false;
  const check = (side) => {
    const mine = match[side] + 1;
    const theirs = match[other(side)];
    if (match.sport === 'badminton') return (mine >= match.target && mine - theirs >= 2) || mine === match.cap;
    const canScore = match.scoring === 'rally' || side === match.serving;
    return canScore && mine >= match.target && mine - theirs >= 2;
  };
  return check('a') || check('b');
}

export function statusText(match, side) {
  if (match.serving !== side) return 'Receiving';
  if (match.sport === 'badminton') return `Serving · ${serviceCourt(match)} court`;
  return usesServerNumber(match) ? `Serving · Server ${match.server}` : 'Serving';
}
