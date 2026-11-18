<script>
  import Icon from '$lib/components/Icon.svelte';
  import { store } from '$lib/state.svelte.js';
  import { ui, drafts } from './ui.svelte.js';
  import { checkIn, checkInByCode, checkInGroup, saveCurrentAsGroup } from './actions.js';
  import { groups, removeGroup } from '$lib/groups.svelte.js';
  import { resolve } from '$app/paths';
  import { account } from '$lib/account.svelte.js';
  import Scanner from '$lib/components/Scanner.svelte';

  // Any device with a camera can scan (built-in reader, or jsQR on iPhone and desktop).
  const canScan = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
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

  let groupName = $state('');
  function submitGroup(event) {
    event.preventDefault();
    if (saveCurrentAsGroup(groupName)) groupName = '';
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
  <h2 class="section-title"><span class="title-icon warm"><Icon name="user-plus" size={18} /></span>Check in players</h2>

  <!-- 1. By name: the everyday way, so it gets the one orange button -->
  <form class="stack tight" onsubmit={submit}>
    <label>Names
      <input
        bind:this={input}
        bind:value={drafts.names}
        placeholder={mode === 'pair' ? 'Two names, e.g. Ana, Ben' : 'One name, or several: Ana, Ben, Cy'}
        autocomplete="off"
        required
      />
    </label>
    {#if pairOk}
      <div class="segmented" role="radiogroup" aria-label="How do they want to play?">
        <label class="seg"><input type="radio" name="mode" value="solo" bind:group={drafts.mode} /><span>Random teammate</span></label>
        <label class="seg"><input type="radio" name="mode" value="pair" bind:group={drafts.mode} /><span>As partners</span></label>
      </div>
    {/if}
    <p class="hint">
      {#if mode === 'pair'}Exactly 2 names. They always play on the same team.
      {:else if pairOk}Each person is paired with someone when their game is called.
      {:else}This session is set to random teammates only.{/if}
    </p>
    <button class="btn btn-primary" type="submit">Add to line</button>
  </form>

  <!-- Saved groups: one tap checks in all the regulars -->
  {#if groups.list.length}
    <div class="group-row">
      <span class="hint">Saved groups</span>
      {#each groups.list as g (g.name)}
        <button class="group-chip" type="button" onclick={() => checkInGroup(g)}><Icon name="users" size={16} /> {g.name} <span class="muted">{g.names.length}</span></button>
      {/each}
    </div>
  {/if}

  <!-- 2. By player code: for players with an account -->
  {#if account.enabled}
    <div class="or-line"><span>or with a player code</span></div>
    {#if account.user}
      <form class="code-checkin" onsubmit={submitCode}>
        <input
          bind:value={code}
          aria-label="Player code"
          placeholder="PLAYER CODE"
          maxlength="6"
          autocapitalize="characters"
          autocomplete="off"
          spellcheck="false"
          required
        />
        <button class="btn btn-light" disabled={checking}>Add</button>
        {#if canScan}
          <button class="btn btn-ghost" type="button" aria-label="Scan a player QR code" onclick={() => (scanning = true)}><Icon name="scan" size={18} /> Scan</button>
        {/if}
      </form>
      <p class="hint">Their games are saved to their history.</p>
      {#if scanning}<Scanner onscan={scanned} onclose={() => (scanning = false)} />{/if}
    {:else}
      <p class="hint"><a href={resolve('/account')}>Sign in</a> to check players in by code and save their games to their history.</p>
    {/if}
  {/if}

  <!-- 3. Rarely needed -->
  <details class="more">
    <summary>More options</summary>
    <label>Checked in by (optional)<input bind:value={drafts.addedBy} placeholder="e.g. a group leader" /></label>
    <form class="group-save" onsubmit={submitGroup}>
      <label class="grow">Save everyone here as a group
        <input bind:value={groupName} placeholder="e.g. Friday regulars" maxlength="30" autocomplete="off" required />
      </label>
      <button class="btn btn-ghost">Save group</button>
    </form>
    <p class="hint">Kept on this device. Next time, one tap checks them all in. Saving the same name again updates it.</p>
    {#each groups.list as g (g.name)}
      <div class="row between group-line">
        <span><strong>{g.name}</strong> <span class="muted small">{g.names.length} players</span></span>
        <button class="link-btn" type="button" onclick={() => removeGroup(g.name)}>Delete</button>
      </div>
    {/each}
  </details>
</section>
