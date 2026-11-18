<script>
  // Change a game in progress: swap a player, or cancel the game.
  import Modal from '#lib/components/Modal.svelte';
  import { store } from '#lib/state.svelte.js';
  import { ui } from './ui.svelte.js';
  import { swapPlayer, cancelCourtGame } from './actions.js';

  const close = () => (ui.managing = null);
  const court = $derived(store.session.courts.find((c) => c.id === ui.managing));
  const onCourt = $derived(court?.teams.flatMap((t) => t.p) ?? []);
  // Only single players can step in; partners stay together.
  const waiting = $derived(store.session.queue.filter((e) => e.p.length === 1 && !e.away));

  let out = $state('');
  let incoming = $state('');

  function swap(event) {
    event.preventDefault();
    swapPlayer(court.id, out, Number(incoming));
    close();
  }
</script>

{#if court?.teams.length}
  <Modal onclose={close} labelledby="court-title">
    <div class="stack">
      <div>
        <p class="eyebrow">Court {court.id} · Game {court.game}</p>
        <h2 id="court-title">Change this game</h2>
      </div>

      <form class="stack" onsubmit={swap}>
        <h3>Replace a player</h3>
        <label for="swap-out">Going off
          <select id="swap-out" bind:value={out} required>
            <option value="" disabled>Choose a player</option>
            {#each onCourt as name (name)}<option value={name}>{name}</option>{/each}
          </select>
        </label>
        <label for="swap-in">Coming on
          <select id="swap-in" bind:value={incoming} required disabled={!waiting.length}>
            <option value="" disabled>{waiting.length ? 'Choose from the line' : 'Nobody is free in the line'}</option>
            {#each waiting as entry (entry.id)}<option value={String(entry.id)}>{entry.p[0]}</option>{/each}
          </select>
        </label>
        <p class="hint">The score stays. The player going off is put on a break at the back of the line.</p>
        <button class="btn btn-light" disabled={!out || !incoming}>Replace player</button>
      </form>

      <div class="stack tight court-cancel">
        <h3>Cancel the game</h3>
        <p class="hint">No result is saved. All four go back to the top of the line.</p>
        <button class="btn btn-danger" type="button" onclick={() => { cancelCourtGame(court.id); close(); }}>Cancel this game</button>
      </div>

      <button class="btn btn-ghost" type="button" onclick={close}>Close</button>
    </div>
  </Modal>
{/if}
