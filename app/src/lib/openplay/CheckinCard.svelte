<script>
  import { store } from '$lib/state.svelte.js';
  import { ui, drafts } from './ui.svelte.js';
  import { checkIn } from './actions.js';

  let input;
  const pairOk = $derived(store.session.allowPicks);
  const mode = $derived(pairOk ? drafts.mode : 'solo');

  // Right after a session opens, put the cursor in the names box.
  $effect(() => {
    if (ui.focusCheckin && input) {
      input.focus();
      ui.focusCheckin = false;
    }
  });

  function submit(event) {
    event.preventDefault();
    if (checkIn()) input.focus();
  }
</script>

<section class="card stack area-checkin">
  <h2 class="section-title">Check in players</h2>
  <form class="stack" onsubmit={submit}>
    <label>Names
      <input
        bind:this={input}
        bind:value={drafts.names}
        placeholder={mode === 'pair' ? 'Two names, e.g. Ana, Ben' : 'One name, or several: Ana, Ben, Cy'}
        autocomplete="off"
        required
      />
    </label>
    <fieldset class="choice">
      <legend>How do they want to play?</legend>
      <label class="option">
        <input type="radio" name="mode" value="solo" bind:group={drafts.mode} />
        <span><strong>Random teammate</strong><span class="hint">Each person is paired with someone when their game is called.</span></span>
      </label>
      <label class={['option', !pairOk && 'disabled']}>
        <input type="radio" name="mode" value="pair" bind:group={drafts.mode} disabled={!pairOk} />
        <span>
          <strong>As partners</strong>
          <span class="hint">{pairOk ? 'Exactly 2 names who always play on the same team.' : 'Off: this session is set to random teammates only.'}</span>
        </span>
      </label>
    </fieldset>
    <label>Checked in by (optional)<input bind:value={drafts.addedBy} placeholder="e.g. a group leader" /></label>
    <button class="btn btn-primary" type="submit">Add to line</button>
  </form>
</section>
