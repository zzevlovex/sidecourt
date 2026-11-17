<script>
  // The signed-in player's saved games: totals, then each game.
  import { account } from '$lib/account.svelte.js';
  import { myGames } from '$lib/history.svelte.js';

  let games = $state(null);
  let failed = $state(false);

  $effect(() => {
    if (!account.user) return;
    failed = false;
    myGames().then((rows) => (games = rows)).catch(() => (failed = true));
  });

  const me = $derived(account.user?.id);
  const side = (g) => (g.players_a.includes(me) ? 'a' : 'b');
  const result = (g) => (!g.winner ? 'none' : g.winner === side(g) ? 'win' : 'loss');
  const wins = $derived(games ? games.filter((g) => result(g) === 'win').length : 0);
  const losses = $derived(games ? games.filter((g) => result(g) === 'loss').length : 0);
  const day = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
</script>

<section class="card stack">
  <h2 class="section-title">My games</h2>
  {#if failed}
    <p class="form-error">Could not load your games. Check your connection.</p>
  {:else if !games}
    <p class="muted small">Loading…</p>
  {:else if !games.length}
    <p class="muted small">No games yet. Ask the manager to check you in with your player code: your games show up here when the open play ends.</p>
  {:else}
    <div class="chips">
      <span class="stat-chip"><strong>{games.length}</strong> {games.length === 1 ? 'game' : 'games'}</span>
      <span class="stat-chip go"><strong>{wins}</strong> {wins === 1 ? 'win' : 'wins'}</span>
      <span class="stat-chip"><strong>{losses}</strong> {losses === 1 ? 'loss' : 'losses'}</span>
    </div>
    <ul class="results">
      {#each games as g (g.id)}
        {@const mine = side(g)}
        {@const r = result(g)}
        <li class="res-row">
          <span class="res-court">{day(g.played_at)}</span>
          <span class="res-teams">
            <span class="res-team {mine} won">{(mine === 'a' ? g.team_a : g.team_b).join(' & ')}</span>
            <span class="vs-small">vs</span>
            <span class="res-team {mine === 'a' ? 'b' : 'a'} lost">{(mine === 'a' ? g.team_b : g.team_a).join(' & ')}</span>
            <span class="tag">{g.session_name}{g.court ? ` · Court ${g.court}` : ''}</span>
          </span>
          <span class={['res-score', r === 'none' && 'none']}>
            {#if g.score_a !== null}
              <span class={[r === 'win' && 'hi']}>{mine === 'a' ? g.score_a : g.score_b}</span>–{mine === 'a' ? g.score_b : g.score_a}
            {/if}
            <span class="badge {r === 'win' ? 'badge-win' : r === 'loss' ? 'badge-loss' : 'badge-deck'}">{r === 'win' ? 'W' : r === 'loss' ? 'L' : '–'}</span>
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>
