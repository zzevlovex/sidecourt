<script>
  import { store } from '#lib/state.svelte.js';
  import { plural } from '#lib/format.js';
  import { ui } from './ui.svelte.js';
  import { allowPicks, addCourt, saveLocation, setFormat } from './actions.js';
  import { defaultFormat } from '#lib/logic/scoring.js';
  import FormatFields from './FormatFields.svelte';

  const session = $derived(store.session);
  // Sessions from before formats existed played badminton as best of 3.
  const format = $derived({ ...defaultFormat(session.sport), ...(session.sport === 'badminton' && !session.format?.bestOf ? { bestOf: 3 } : {}), ...session.format });
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
    <div class="stack tight">
      <span class="label">Game format</span>
      <FormatFields sport={session.sport} value={format} onchange={setFormat} idPrefix="settings" />
      <p class="hint">Changes apply from the next game.</p>
    </div>
    <label>Location (optional)
      <input value={session.location ?? ''} placeholder="e.g. Riverside Sports Center" maxlength="40" autocomplete="off" onchange={(e) => saveLocation(e.currentTarget.value)} />
      <span class="hint">Where the courts are. It is shown on the share photos.</span>
    </label>
    <div class="row between">
      <span><span class="label">Courts</span> {session.courts.length}</span>
      <button class="btn btn-small btn-ghost" onclick={addCourt}>+ Add a court</button>
    </div>
    <button class="btn btn-small btn-danger" onclick={() => (ui.ending = true)}>End open play &amp; see rankings</button>
  </div>
</details>
