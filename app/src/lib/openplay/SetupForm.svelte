<script>
  import { store } from '$lib/state.svelte.js';
  import { createSession, showStandings } from './actions.js';

  let name = $state('');
  let sport = $state('pickleball');
  let courts = $state(2);

  function submit(event) {
    event.preventDefault();
    createSession({ name, sport, courts });
  }
</script>

<section class="card narrow pop">
  <p class="eyebrow">New session</p>
  <h1>Start open play</h1>
  {#if store.summary}
    <button class="btn btn-small btn-ghost" type="button" onclick={() => showStandings(true)}>🏆 See the last standings</button>
  {/if}
  <p class="muted">Check players in, and Sidecourt lines them up, builds fair teams and tells you who plays next.</p>
  <form class="stack" onsubmit={submit}>
    <label>Session name <input bind:value={name} placeholder="e.g. Tuesday Night Open Play" required /></label>
    <label>Sport
      <select bind:value={sport}>
        <option value="pickleball">Pickleball</option>
        <option value="badminton">Badminton</option>
      </select>
    </label>
    <label>Number of courts <input type="number" min="1" max="12" bind:value={courts} required />
      <span class="hint">You can add more courts later.</span>
    </label>
    <button class="btn btn-primary" type="submit">Open session</button>
  </form>
</section>
