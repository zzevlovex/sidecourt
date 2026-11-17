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
      session_name: summary.name,
      sport: summary.sport,
      court: r.court ?? null,
      team_a: r.teams[0],
      team_b: r.teams[1],
      players_a: ids(r.teams[0]),
      players_b: ids(r.teams[1]),
      score_a: r.score?.a ?? null,
      score_b: r.score?.b ?? null,
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
    name: summary.name,
    sport: summary.sport,
    summary,
    player_ids: [...new Set(Object.values(accounts))],
  };
}
