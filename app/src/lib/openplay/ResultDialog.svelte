<script>
  // Correct or delete a finished game during the session.
  import Modal from '#lib/components/Modal.svelte';
  import { store } from '#lib/state.svelte.js';
  import { ui } from './ui.svelte.js';
  import { saveResult, removeResult } from './actions.js';

  const close = () => (ui.editingResult = null);
  const original = store.session.results.find((r) => r.id === ui.editingResult);

  let a = $state(original?.score?.a ?? '');
  let b = $state(original?.score?.b ?? '');
  let winner = $state(original?.winner ?? '');

  const filled = (v) => v !== '' && v !== null && Number.isInteger(Number(v)) && Number(v) >= 0;
  const hasScore = $derived(filled(a) && filled(b));
  const halfTyped = $derived(hasScore ? false : a !== '' || b !== '');
  const clearScore = $derived(hasScore && Number(a) !== Number(b));
  const team = (i) => original.teams[i].join(' & ');

  function save(event) {
    event.preventDefault();
    let score = hasScore ? { a: Number(a), b: Number(b) } : null;
    // Unchanged games-won score: keep its real points.
    if (score && original.score?.points && score.a === original.score.a && score.b === original.score.b) score = original.score;
    saveResult(original.id, score, clearScore ? null : winner || null);
    close();
  }
</script>

{#if original}
  <Modal onclose={close} labelledby="result-title">
    <form class="stack" onsubmit={save}>
      <div>
        <p class="eyebrow">Court {original.court}{original.game ? ` · Game ${original.game}` : ''}</p>
        <h2 id="result-title">Correct this game</h2>
      </div>
      <div class="row score-row">
        <label class="grow small" for="result-a">{team(0)}
          <input id="result-a" type="number" min="0" inputmode="numeric" placeholder="Score" bind:value={a} />
        </label>
        <label class="grow small" for="result-b">{team(1)}
          <input id="result-b" type="number" min="0" inputmode="numeric" placeholder="Score" bind:value={b} />
        </label>
      </div>
      {#if !clearScore}
        <fieldset class="choice">
          <legend>Who won?</legend>
          {#each ['a', 'b'] as side, i (side)}
            <label class="option"><input type="radio" name="result-winner" value={side} bind:group={winner} /><span>{team(i)}</span></label>
          {/each}
          <label class="option"><input type="radio" name="result-winner" value="" bind:group={winner} /><span>No winner</span></label>
        </fieldset>
      {/if}
      {#if halfTyped}<p class="form-error">Enter both scores, or clear both.</p>{/if}
      <div class="row wrap end-actions">
        <button class="btn btn-ghost" type="button" onclick={close}>Close</button>
        <button class="btn btn-primary grow" disabled={halfTyped}>Save</button>
      </div>
      <button class="btn btn-danger" type="button" onclick={() => { removeResult(original.id); close(); }}>Delete this game</button>
    </form>
  </Modal>
{/if}
