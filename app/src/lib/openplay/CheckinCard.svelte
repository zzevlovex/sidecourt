<script>
  import { store } from '$lib/state.svelte.js';
  import { ui, drafts } from './ui.svelte.js';
  import { checkIn, checkInByCode } from './actions.js';
  import { resolve } from '$app/paths';
  import { account } from '$lib/account.svelte.js';
  import Scanner from '$lib/components/Scanner.svelte';

  // The built-in QR reader exists in Chrome on Android and some other browsers.
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  let scanning = $state(false);
  async function scanned(found) {
    scanning = false;
    code = found;
    checking = true;
    if (await checkInByCode(found)) code = '';
    checking = false;
  }

  let code = $state('');
  let checking = $state(false);
  async function submitCode(event) {
    event.preventDefault();
    checking = true;
    if (await checkInByCode(code)) code = '';
    checking = false;
  }

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
  {#if account.enabled}
    <!-- Players with an account: their games go into their history -->
    {#if account.user}
      <form class="code-checkin" onsubmit={submitCode}>
        <label class="grow">Player code
          <input
            bind:value={code}
            placeholder="e.g. ZMZEFH"
            maxlength="6"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            required
          />
        </label>
        <button class="btn btn-primary" disabled={checking}>Add</button>
        {#if canScan}
          <button class="btn btn-ghost" type="button" aria-label="Scan a player QR code" onclick={() => (scanning = true)}>Scan</button>
        {/if}
      </form>
      {#if scanning}<Scanner onscan={scanned} onclose={() => (scanning = false)} />{/if}
      <p class="hint">Players with a Sidecourt account: their games are saved to their history. No account? Type their name below.</p>
    {:else}
      <p class="hint"><a href={resolve('/account')}>Sign in</a> to check players in by their player code and save their games to their history.</p>
    {/if}
    <div class="or-line"><span>or by name</span></div>
  {/if}
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
