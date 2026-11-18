<script>
  import Icon from '$lib/components/Icon.svelte';
  import { store } from '$lib/state.svelte.js';
  import { createSession, showStandings } from './actions.js';

  let name = $state('');
  let sport = $state('pickleball');
  let courts = $state(2);
  let location = $state('');

  function submit(event) {
    event.preventDefault();
    createSession({ name, sport, courts, location });
  }
</script>

<section class="card narrow pop">
  <p class="eyebrow">New session</p>
  <h1>Start open play</h1>
  <p class="muted">Check players in, and Sidecourt lines them up, builds fair teams and tells you who plays next.</p>
  <form class="stack" onsubmit={submit}>
    <label>Session name <input bind:value={name} placeholder="e.g. Tuesday Night Open Play" required /></label>
    <label>Sport
      <select bind:value={sport}>
        <option value="pickleball">Pickleball</option>
        <option value="badminton">Badminton</option>
      </select>
    </label>
    <label>Location (optional) <input bind:value={location} placeholder="e.g. Riverside Sports Center" maxlength="40" autocomplete="off" />
      <span class="hint">Where the courts are. It is shown on the share photos.</span>
    </label>
    <label>Number of courts <input type="number" min="1" max="12" bind:value={courts} required />
      <span class="hint">You can add more courts later.</span>
    </label>
    <button class="btn btn-primary btn-big" type="submit">Open session</button>
  </form>
  {#if store.summary}
    <button class="link-btn" type="button" onclick={() => showStandings(true)}><Icon name="trophy" size={16} /> See the last standings</button>
  {/if}
</section>
