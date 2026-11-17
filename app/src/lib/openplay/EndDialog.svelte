<script>
  // "End open play": what to do with games still on court, and a preview of the top 3.
  import Modal from '$lib/components/Modal.svelte';
  import { store } from '$lib/state.svelte.js';
  import { finishSession } from '$lib/logic/queue.js';
  import { plural, medal } from '$lib/format.js';
  import { ui } from './ui.svelte.js';
  import { scoreInProgress, liveScoresToCount, confirmEnd } from './actions.js';

  const session = $derived(store.session);
  const inPlay = $derived(session.courts.filter((c) => c.teams.length));
  // Recomputed by itself whenever the "count them" choice or a score changes.
  const preview = $derived(finishSession(session, liveScoresToCount()));
  const top = $derived(preview.standings.filter((p) => p.rank && p.rank <= 3).slice(0, 3));
  const close = () => (ui.ending = false);
</script>

<Modal onclose={close} labelledby="end-title">
  <div class="stack">
    <div>
      <p class="eyebrow">End open play</p>
      <h2 id="end-title">Wrap up {session.name}?</h2>
    </div>

    {#if inPlay.length}
      <fieldset class="choice">
        <legend>{plural(inPlay.length, 'game is', 'games are')} still being played</legend>
        <label class="option">
          <input type="radio" name="live" value={true} bind:group={ui.countLive} />
          <span>
            <strong>Count them with the current score</strong>
            <ul class="hint plain-list">
              {#each inPlay as court (court.id)}
                {@const sc = scoreInProgress(court)}
                <li>Court {court.id}: {#if sc}<strong>{sc.a}–{sc.b}</strong>{:else}no score yet, will not count{/if}</li>
              {/each}
            </ul>
          </span>
        </label>
        <label class="option">
          <input type="radio" name="live" value={false} bind:group={ui.countLive} />
          <span><strong>Do not count them</strong><span class="hint">Only finished games go into the rankings.</span></span>
        </label>
      </fieldset>
    {/if}

    <div class="end-preview">
      <div class="chips">
        <span class="stat-chip"><strong>{preview.games}</strong> games</span>
        <span class="stat-chip"><strong>{preview.standings.filter((p) => p.played).length}</strong> players ranked</span>
      </div>
      <span class="label">Top of the rankings</span>
      {#if top.length}
        <ol class="mini-podium">
          {#each top as p (p.name)}
            <li><span aria-hidden="true">{medal(p.rank)}</span><strong>{p.name}</strong><span class="muted small">{p.wins}W {p.losses}L</span></li>
          {/each}
        </ol>
      {:else}
        <p class="muted small">No games played yet, so there is nothing to rank.</p>
      {/if}
    </div>

    <p class="hint">The waiting line and courts are cleared. The final standings stay on this device until you start a new session.</p>
    <div class="row wrap end-actions">
      <button class="btn btn-ghost" type="button" onclick={close}>Keep playing</button>
      <button class="btn btn-primary grow" type="button" onclick={confirmEnd}>End &amp; show rankings</button>
    </div>
  </div>
</Modal>
