<script>
  import Icon from '#lib/components/Icon.svelte';
  // "Who won?" when a game is finished without a clear score.
  import Modal from '#lib/components/Modal.svelte';
  import { store } from '#lib/state.svelte.js';
  import { ui } from './ui.svelte.js';
  import { pickWinner } from './actions.js';

  const court = $derived(store.session.courts.find((c) => c.id === ui.finishing));
  const tie = $derived(ui.finishScore && ui.finishScore.a === ui.finishScore.b);
  const close = () => (ui.finishing = null);
</script>

{#if court?.teams.length}
  <Modal onclose={close} labelledby="finish-title">
    <div class="stack">
      <div>
        <p class="eyebrow">Finish Court {court.id} · Game {court.game}</p>
        <h2 id="finish-title">Who won?</h2>
        <p class="muted small">
          {tie
            ? `The score is tied at ${ui.finishScore.a}–${ui.finishScore.b}. Pick the winner so it counts in the rankings.`
            : 'No score was kept for this game. Pick the winner so it counts in the rankings.'}
        </p>
      </div>
      <div class="win-picks">
        {#each court.teams as team, i (i)}
          {@const side = i === 0 ? 'a' : 'b'}
          {#if i === 1}<span class="vs">VS</span>{/if}
          <button class="win-pick {side}" type="button" onclick={() => pickWinner(side)}>
            <span class="win-pick-names">{#each team.p as name (name)}<strong>{name}</strong>{/each}</span>
            <span class="win-pick-cta"><Icon name="trophy" size={16} /> They won</span>
          </button>
        {/each}
      </div>
      <div class="row wrap end-actions">
        <button class="btn btn-ghost" type="button" onclick={close}>Keep playing</button>
        <button class="btn btn-ghost grow" type="button" onclick={() => pickWinner(null)}>Finish without a winner</button>
      </div>
      <p class="hint">Without a winner the game still counts as played, but not as a win or loss.</p>
    </div>
  </Modal>
{/if}
