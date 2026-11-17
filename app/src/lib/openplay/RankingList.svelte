<script>
  // The ranking table: used on the final standings page and in the account's open play history.
  import { plural, pct, signed } from '$lib/format.js';

  // ranked: standings rows for players who played. highlight: (name) => true for the row to mark as "You".
  let { ranked, highlight = null } = $props();
</script>

<div class="rank-row rank-head" aria-hidden="true">
  <span>#</span><span>Player</span><span>W–L</span><span class="rank-pct">Win %</span><span class="rank-diff">Pts +/−</span>
</div>
<ol class="rank-list">
  {#each ranked as p, i (p.name)}
    <li class={['rank-row', p.rank <= 3 && 'top', highlight && highlight(p.name) && 'me']} style="--i: {Math.min(i, 12)}">
      <span class="rank-num">{#if p.rank <= 3}<span class="rank-badge place-{p.rank}">{p.rank}</span>{:else}{p.rank}{/if}</span>
      <span class="grow">
        <strong>{p.name}</strong>{#if highlight && highlight(p.name)}<span class="badge badge-next">You</span>{/if}
        <span class="tag">{plural(p.played, 'game')} · {p.pointsFor} pts scored</span>
      </span>
      <span class="rank-wl">{p.wins}–{p.losses}</span>
      <span class="rank-pct">{pct(p)}</span>
      <span class={['rank-diff', p.diff > 0 && 'pos', p.diff < 0 && 'neg']} title="Scored {p.pointsFor}, gave up {p.pointsAgainst}">{signed(p.diff)}</span>
    </li>
  {/each}
</ol>
