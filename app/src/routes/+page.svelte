<script>
  import { resolve } from '$app/paths';
  import { store } from '$lib/state.svelte.js';
</script>

<svelte:head><title>Sidecourt</title></svelte:head>

<div class="home">
<section class="hero">
  <p class="eyebrow">Pickleball + Badminton</p>
  <h1>Keep score.<br /><span>Run the courts.</span></h1>
  <p class="muted">Score a match with one tap per rally, or run a whole open play session with courts, a waiting queue and name call-outs.</p>
</section>

<section class="choices">
  <a class="card feature" href={resolve('/openplay')}>
    <h2>Open play session</h2>
    <p class="muted">Check players in, manage the queue, and call the next four onto each court.</p>
    <strong>{store.session ? `Back to ${store.session.name}` : 'Host a session'}</strong>
  </a>
  <a class="card" href={resolve('/scoreboard')}>
    <h2>Single match</h2>
    <p class="muted">Pickleball side-out scoring or badminton rally scoring, with undo.</p>
    <strong>Start a match</strong>
  </a>
  {#if store.summary}
    <a class="card" href="{resolve('/openplay')}?view=standings">
      <h2>🏆 Last standings</h2>
      <p class="muted">{store.summary.name}: final rankings and every game played.</p>
      <strong>See the rankings</strong>
    </a>
  {/if}
</section>
</div>
