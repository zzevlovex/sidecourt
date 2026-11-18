<script>
  // The signed-in player's saved games: totals, then each game.
  import Icon from '#lib/components/Icon.svelte';
  import { account } from '#lib/account.svelte.js';
  import { myGames, removeFromHistory } from '#lib/history.svelte.js';
  import { toast } from '#lib/toasts.svelte.js';

  const STEP = 5; // shown at first, and added by each "See more"

  let { sport } = $props(); // only this sport's games are shown

  let all = $state(null);
  const games = $derived(all ? all.filter((g) => g.sport === sport) : null);
  $effect(() => { sport; shown = STEP; }); // a new tab starts short again
  let failed = $state(false);
  let shown = $state(STEP);

  $effect(() => {
    if (!account.user) return;
    failed = false;
    myGames().then((rows) => (all = rows)).catch(() => (failed = true));
  });

  // Removes the game, and everything else from the same host.
  async function notMe(g) {
    if (!confirm('Remove this from your history? Anything else from the same host is removed too, and they can\'t add you by code until you join one of their lobbies.')) return;
    try {
      await removeFromHistory('games', g.id);
      all = await myGames();
      toast('Removed from your history.', { type: 'success' });
    } catch {
      toast('Could not remove it. Check your connection and try again.', { type: 'warn' });
    }
  }

  const me = $derived(account.user?.id);
  const side = (g) => (g.players_a.includes(me) ? 'a' : 'b');
  const result = (g) => (!g.winner ? 'none' : g.winner === side(g) ? 'win' : 'loss');
  const wins = $derived(games ? games.filter((g) => result(g) === 'win').length : 0);
  const losses = $derived(games ? games.filter((g) => result(g) === 'loss').length : 0);
  const day = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
</script>

<section class="card stack">
  <h2 class="section-title"><span class="title-icon"><Icon name="score" size={18} /></span>My games</h2>
  {#if failed}
    <p class="form-error">Could not load your games. Check your connection.</p>
  {:else if !games}
    <p class="muted small">Loading…</p>
  {:else if !games.length}
    <p class="muted small">No {sport} games yet. Ask the manager to check you in with your player code: your games show up here when the open play ends.</p>
  {:else}
    <div class="chips">
      <span class="stat-chip"><strong>{games.length}</strong> {games.length === 1 ? 'game' : 'games'}</span>
      <span class="stat-chip go"><strong>{wins}</strong> {wins === 1 ? 'win' : 'wins'}</span>
      <span class="stat-chip"><strong>{losses}</strong> {losses === 1 ? 'loss' : 'losses'}</span>
    </div>
    <ul class="results">
      {#each games.slice(0, shown) as g (g.id)}
        {@const mine = side(g)}
        {@const r = result(g)}
        <li class="res-row">
          <span class="res-court">{day(g.played_at)}</span>
          <span class="res-teams">
            <span class="res-team {mine} won">{(mine === 'a' ? g.team_a : g.team_b).join(' & ')}</span>
            <span class="vs-small">vs</span>
            <span class="res-team {mine === 'a' ? 'b' : 'a'} lost">{(mine === 'a' ? g.team_b : g.team_a).join(' & ')}</span>
            <span class="tag">{g.session_name}{g.court ? ` · Court ${g.court}` : ''}</span>
            {#if g.recorded_by !== me}<button class="not-me" type="button" onclick={() => notMe(g)}>Not me</button>{/if}
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
    {#if games.length > shown}
      <button class="btn btn-small btn-ghost see-more" onclick={() => (shown += STEP * 2)}>See more ({games.length - shown} left)</button>
    {:else if all.length >= 200}
      <p class="hint">Showing your latest 200 games.</p>
    {/if}
  {/if}
</section>
