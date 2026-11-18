<script>
  // Tick who is here tonight from everyone who has played on this device.
  import Icon from '#lib/components/Icon.svelte';
  import Modal from '#lib/components/Modal.svelte';
  import { store } from '#lib/state.svelte.js';
  import { account } from '#lib/account.svelte.js';
  import { hasPlayer } from '#lib/logic/queue.js';
  import { rankRoster, linkFor } from '#lib/logic/roster.js';
  import { roster, forgetFromRoster } from '#lib/roster.svelte.js';
  import { plural } from '#lib/format.js';
  import { addRegulars } from './actions.js';

  let { onclose } = $props();

  let picked = $state([]);
  let search = $state('');

  const people = $derived(rankRoster(roster.list).filter((p) => !hasPlayer(store.session, p.name)));
  const shown = $derived(people.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())));
  const allShown = $derived(shown.length > 0 && shown.every((p) => picked.includes(p.name)));
  const linked = (name) => Boolean(linkFor(roster.list, name, account.user?.id, roster.valid));

  function toggleAll() {
    const names = shown.map((p) => p.name);
    picked = allShown ? picked.filter((n) => !names.includes(n)) : [...new Set([...picked, ...names])];
  }

  function forget(name) {
    picked = picked.filter((n) => n !== name);
    forgetFromRoster(name);
  }

  function add() {
    addRegulars(picked);
    onclose();
  }
</script>

<Modal {onclose} labelledby="regulars-title">
  <div class="stack">
    <div>
      <p class="eyebrow">Check in players</p>
      <h2 id="regulars-title">Who's here?</h2>
    </div>

    {#if people.length}
      {#if people.length > 8}
        <label>Find a player <input id="regulars-search" bind:value={search} placeholder="Type a name" autocomplete="off" /></label>
      {/if}
      <div class="row between">
        <span class="muted small">{plural(people.length, 'past player')}</span>
        {#if shown.length}<button class="link-btn" type="button" onclick={toggleAll}>{allShown ? 'Clear' : 'Select all'}</button>{/if}
      </div>
      <ul class="regular-list">
        {#each shown as p (p.name)}
          <li class="regular">
            <label class="option">
              <input type="checkbox" value={p.name} bind:group={picked} />
              <span class="grow"><strong>{p.name}</strong>
                <span class="tag">{plural(p.sessions, 'session')}{linked(p.name) ? ' · Account' : ''}</span></span>
            </label>
            <button class="icon-btn" type="button" aria-label="Forget {p.name}" title="Remove from this list" onclick={() => forget(p.name)}><Icon name="x" size={18} /></button>
          </li>
        {:else}
          <li class="empty-line muted">Nobody matches that name.</li>
        {/each}
      </ul>
    {:else}
      <p class="muted">Everyone you have played with is already checked in.</p>
    {/if}

    <div class="row wrap end-actions">
      <button class="btn btn-ghost" type="button" onclick={onclose}>Close</button>
      <button class="btn btn-primary grow" type="button" disabled={!picked.length} onclick={add}>{picked.length ? `Add ${plural(picked.length, 'player')}` : 'Add players'}</button>
    </div>
  </div>
</Modal>
