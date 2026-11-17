<script>
  import { store } from '$lib/state.svelte.js';
  import { plural } from '$lib/format.js';
  import { ui } from './ui.svelte.js';
  import { allowPicks, addCourt } from './actions.js';

  const session = $derived(store.session);
</script>

<details class="card fold area-settings" bind:open={ui.settingsOpen}>
  <summary>
    <span class="section-label">Session settings</span>
    <span class="muted small">{session.allowPicks ? 'Partners allowed' : 'Random only'} · {plural(session.courts.length, 'court')}</span>
  </summary>
  <div class="stack fold-body">
    <div class="stack tight">
      <span class="label">Teammates</span>
      <div class="segmented" role="group" aria-label="Teammates">
        <button class={[session.allowPicks && 'on']} aria-pressed={session.allowPicks} onclick={() => allowPicks(true)}>Players can pick partners</button>
        <button class={[!session.allowPicks && 'on']} aria-pressed={!session.allowPicks} onclick={() => allowPicks(false)}>Random only</button>
      </div>
      <p class="hint">
        {session.allowPicks
          ? 'Partners checked in together stay together. Everyone else gets a random teammate.'
          : 'Everyone gets a random teammate, including people who checked in as partners.'}
      </p>
    </div>
    <div class="row between">
      <span><span class="label">Courts</span> {session.courts.length}</span>
      <button class="btn btn-small btn-ghost" onclick={addCourt}>+ Add a court</button>
    </div>
    <button class="btn btn-small btn-danger" onclick={() => (ui.ending = true)}>End open play &amp; see rankings</button>
  </div>
</details>
