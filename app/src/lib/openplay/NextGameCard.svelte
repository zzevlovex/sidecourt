<script>
  import { store } from '$lib/state.svelte.js';
  import { waitingCount } from '$lib/logic/queue.js';
  import { plural, teamNames } from '$lib/format.js';
  import Matchup from './Matchup.svelte';
  import { sendToCourt, shuffle } from './actions.js';
  import { enter } from '$lib/enter.js';

  // games: the next two games from upcoming().
  let { games } = $props();

  const session = $derived(store.session);
  const free = $derived(session.courts.filter((c) => !c.teams.length));
  const waiting = $derived(waitingCount(session));
  const next = $derived(games[0]);
  const after = $derived(games[1]);
  const anyRandom = $derived(next ? next.some((t) => !t.picked) : false);
  const sig = $derived(JSON.stringify(next ?? null));
</script>

{#snippet shuffleButton()}
  {#if anyRandom}
    <button class="btn btn-small btn-ghost" title="Pick new random teammates" onclick={shuffle}>⟳ Shuffle</button>
  {/if}
{/snippet}

{#if !next}
  <!-- Not enough players yet -->
  <section class="card next-card quiet area-next">
    <div class="row between">
      <span class="section-label">Next game</span>
      <div class="slots" aria-hidden="true">
        {#each [0, 1, 2, 3] as i (i)}<span class={['slot', i < waiting && 'on']}></span>{/each}
      </div>
    </div>
    <p class="muted small">
      {waiting === 0 ? 'Nobody is waiting yet.' : `${plural(waiting, 'player')} waiting.`}
      Check in <strong>{plural(4 - waiting, 'more player')}</strong> to make the next game.
    </p>
  </section>
{:else if !free.length}
  <!-- Quiet while every court is busy -->
  <section class="card next-card waiting area-next">
    <div class="row between wrap">
      <span class="section-label">Up next · not on court yet</span>
      <span class="status wait"><span class="wait-dot" aria-hidden="true"></span>Waiting for a free court</span>
    </div>
    {#key sig}
      <div class="next-matchup" use:enter={'swap'}><Matchup teams={next} ghost compact /></div>
    {/key}
    <div class="row wrap between next-foot">
      {#if after}
        <span class="after"><span class="label">After that</span> {teamNames(after[0])} <span class="vs-small">vs</span> {teamNames(after[1])}</span>
      {:else}
        <span></span>
      {/if}
      {@render shuffleButton()}
    </div>
  </section>
{:else}
  <!-- The bright call to action when a court is free -->
  <section class="card next-card ready area-next" use:enter={'pop glow'}>
    <div class="row between wrap">
      <span class="section-label hot">Up next · ready to send</span>
      <span class="status go">{plural(free.length, 'court')} free</span>
    </div>
    {#key sig}
      <div class="next-matchup" use:enter={'swap'}><Matchup teams={next} ghost /></div>
    {/key}
    <div class="row wrap">
      {#each free as court, i (court.id)}
        <button class="btn {i === 0 ? 'btn-primary btn-grow' : 'btn-ghost'}" onclick={() => sendToCourt(court.id)}>Send to Court {court.id}</button>
      {/each}
      {@render shuffleButton()}
    </div>
    {#if after}
      <p class="muted small">After that: {teamNames(after[0])} vs {teamNames(after[1])}</p>
    {/if}
  </section>
{/if}
