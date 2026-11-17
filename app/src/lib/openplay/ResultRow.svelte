<script>
  import { resultWinner } from '$lib/logic/queue.js';

  let { result: r } = $props();

  const w = $derived(r.winner ?? resultWinner(r.score));
  const win = $derived(w ? (w === 'a' ? 0 : 1) : null);
</script>

<li class="res-row">
  <span class="res-court">Ct {r.court}{#if r.game}<span>G{r.game}</span>{/if}</span>
  <span class="res-teams">
    {#each [0, 1] as i (i)}
      {#if i === 1}<span class="vs-small">vs</span>{/if}
      <span class={['res-team', i === 0 ? 'a' : 'b', win === i && 'won', win !== null && win !== i && 'lost']}>
        {#if win === i}<span class="crown" aria-label="Winner">🏆</span>{/if}{r.teams[i].join(' & ')}
      </span>
    {/each}
  </span>
  {#if r.score}
    <span class="res-score"><span class={[win === 0 && 'hi']}>{r.score.a}</span>–<span class={[win === 1 && 'hi']}>{r.score.b}</span></span>
  {:else}
    <span class="res-score none">{#if win !== null}Winner picked<br />no score{:else}No score{/if}</span>
  {/if}
  {#if r.unfinished}<span class="res-note">Unfinished, counted at this score</span>{/if}
</li>
