<script>
  import Icon from '#lib/components/Icon.svelte';
  import { store } from '#lib/state.svelte.js';
  import { createSession, showStandings } from './actions.js';
  import { account } from '#lib/account.svelte.js';
  import { toast } from '#lib/toasts.svelte.js';
  import { findResumable, resumeSession, discardResumable } from '#lib/lobby.svelte.js';
  import { defaultFormat } from '#lib/logic/scoring.js';
  import FormatFields from './FormatFields.svelte';

  let name = $state('');
  let sport = $state('pickleball');
  let courts = $state(2);
  let location = $state('');
  let formats = $state({ pickleball: defaultFormat('pickleball'), badminton: defaultFormat('badminton') });

  // An open play on this account that was never ended (other device, lost phone).
  let resumable = $state(null);
  $effect(() => {
    if (account.user) findResumable().then((row) => (resumable = row));
    else resumable = null;
  });

  function resume() {
    resumeSession(resumable);
    toast('Open play resumed.', { type: 'success' });
  }

  function discard() {
    discardResumable(resumable.code).catch(() => {});
    resumable = null;
  }

  function submit(event) {
    event.preventDefault();
    if (resumable) discard(); // starting fresh replaces the unfinished one
    createSession({ name, sport, courts, location, format: $state.snapshot(formats[sport]) });
  }
</script>

{#if resumable}
  <section class="card narrow stack resume-card">
    <div>
      <p class="eyebrow">Not finished</p>
      <h2>{resumable.private_state.session.name}</h2>
      <p class="muted small">This open play is still running on your account. Continue it on this device. If another phone is still using it, stop using that one.</p>
    </div>
    <div class="row wrap end-actions">
      <button class="btn btn-ghost" type="button" onclick={discard}>Discard</button>
      <button class="btn btn-primary grow" type="button" onclick={resume}>Resume open play</button>
    </div>
  </section>
{/if}

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
    <FormatFields {sport} value={formats[sport]} onchange={(v) => (formats[sport] = v)} />
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
