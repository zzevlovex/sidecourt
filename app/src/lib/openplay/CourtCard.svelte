<script>
  import { resolve } from '$app/paths';
  import { store } from '$lib/state.svelte.js';
  import { winner, callText } from '$lib/logic/scoring.js';
  import { teamNames } from '$lib/format.js';
  import Matchup from './Matchup.svelte';
  import { drafts } from './ui.svelte.js';
  import { sendToCourt, finishGame } from './actions.js';
  import { enter } from '$lib/enter.js';

  // ready: a game is waiting to go on.
  let { court, ready } = $props();

  const live = $derived(store.liveScore(court));
  const done = $derived(live ? winner(live.match) : null);
  const value = (side) => drafts.scores[court.id]?.[side] ?? live?.final[side] ?? '';
  function setScore(side, v) {
    drafts.scores[court.id] = { ...drafts.scores[court.id], [side]: v };
  }
</script>

{#if !court.teams.length}
  <article class={['card court free', ready && 'ready']}>
    <div class="row between"><h3 class="court-name">Court {court.id}</h3><span class="status go">Free</span></div>
    <p class="muted small">{ready ? 'The next game is ready to go on.' : 'Waiting for 4 players in the line.'}</p>
    <button class="btn {ready ? 'btn-light' : 'btn-ghost'}" disabled={!ready} onclick={() => sendToCourt(court.id)}>Send next game here</button>
  </article>
{:else}
  {@const [a, b] = court.teams}
  <article class="card court playing" use:enter={'pop glow'}>
    <div class="row between">
      <h3 class="court-name">Court {court.id}</h3>
      <span class="status live"><span class="live-dot" aria-hidden="true"></span>Live · Game {court.game}</span>
    </div>
    <Matchup teams={court.teams} />

    {#if live}
      {@const m = live.match}
      <div class={['live-score', done && 'done']}>
        <span class="label">{done ? 'Final from scoreboard' : 'Live from scoreboard'}</span>
        <span class="live-nums"><span class="srv-a">{m.a}</span><span class="muted">–</span><span class="srv-b">{m.b}</span></span>
        <span class="muted small">
          {#if done}
            {m.names[done]} won. Tap Finish game to save it.
          {:else if m.sport === 'badminton'}
            Games {m.games.a}–{m.games.b} · {m.names[m.serving]} serving
          {:else}
            Call {callText(m)} · {m.names[m.serving]} serving
          {/if}
        </span>
      </div>
    {/if}

    <div class="row score-row">
      <label class="grow small">{teamNames(a)}
        <input type="number" min="0" inputmode="numeric" placeholder="Score" value={value('a')} oninput={(e) => setScore('a', e.currentTarget.value)} />
      </label>
      <label class="grow small">{teamNames(b)}
        <input type="number" min="0" inputmode="numeric" placeholder="Score" value={value('b')} oninput={(e) => setScore('b', e.currentTarget.value)} />
      </label>
    </div>
    <div class="row">
      <a class="btn btn-ghost grow" href="{resolve('/scoreboard')}?court={court.id}">{live ? 'Open scoreboard' : 'Keep score'}</a>
      <button class="btn btn-light grow" onclick={() => finishGame(court.id)}>Finish game</button>
    </div>
    <p class="hint">No score? You can just pick who won. Finishing sends these 4 to the back of the line.</p>
  </article>
{/if}
