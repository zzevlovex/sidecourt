// A value the database accepts, so one odd score can never hold up an upload.
const cleanScore = (n) => (Number.isInteger(n) && n >= 0 && n <= 9999 ? n : null);
const cleanName = (name) => String(name).trim().slice(0, 100) || 'Open play';

// Sessions are written by the host's device: only show ones with the right shape.
export function validSummary(s) {
  const num = (n) => Number.isFinite(n);
  const names = (team) => Array.isArray(team) && team.every((n) => typeof n === 'string');
  return Boolean(s) && typeof s === 'object'
    && typeof s.name === 'string' && ['pickleball', 'badminton'].includes(s.sport)
    && !Number.isNaN(Date.parse(s.endedAt)) && num(s.games)
    && Array.isArray(s.standings) && s.standings.every((p) => p && typeof p.name === 'string'
      && ['played', 'wins', 'losses', 'pointsFor', 'pointsAgainst', 'diff', 'winRate'].every((k) => num(p[k]))
      && (p.rank === null || num(p.rank)))
    && Array.isArray(s.results) && s.results.every((r) => r && Array.isArray(r.teams) && r.teams.length === 2 && r.teams.every(names));
}

// Turns a finished open play session into rows for the games table.
// accounts: { playerName: accountId } for players checked in by code.
// Only games with at least one linked player are kept: the rest belong to nobody's history.
export function gameRows(summary, accounts = {}) {
  const ids = (names) => names.map((n) => accounts[n]).filter(Boolean);
  return summary.results
    .filter((r) => r.teams.flat().some((n) => accounts[n]))
    .map((r) => ({
      id: r.id,
      played_at: r.at ?? summary.endedAt,
      session_name: cleanName(summary.name),
      sport: summary.sport,
      court: r.court ?? null,
      team_a: r.teams[0],
      team_b: r.teams[1],
      players_a: ids(r.teams[0]),
      players_b: ids(r.teams[1]),
      score_a: cleanScore(r.score?.a),
      score_b: cleanScore(r.score?.b),
      winner: r.winner ?? null,
    }));
}

// One row for the sessions table: the final standings of a finished open play,
// readable later by the players who were checked in and by the host.
// The summary holds names only; player_ids says whose history it belongs in.
export function sessionRow(summary, accounts = {}, id) {
  return {
    id,
    ended_at: summary.endedAt,
    name: cleanName(summary.name),
    sport: summary.sport,
    summary,
    player_ids: [...new Set(Object.values(accounts))],
  };
}
