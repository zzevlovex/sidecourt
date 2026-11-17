<script>
  // Scoreboard. Works on its own, or for a court in open play (/scoreboard?court=1).
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { store } from '$lib/state.svelte.js';
  import { toast } from '$lib/toasts.svelte.js';
  import { speak } from '$lib/format.js';
  import { newMatch, rally, undo, winner, callText, isGamePoint, serviceCourt } from '$lib/logic/scoring.js';
  import { endGame, upcoming, waitingCount } from '$lib/logic/queue.js';
  import ScoreSetup from '$lib/scoreboard/ScoreSetup.svelte';

  const courtId = $derived(Number(page.url.searchParams.get('court')) || null);
  const session = $derived(courtId ? store.session : null);
  const court = $derived(session?.courts.find((c) => c.id === courtId) ?? null);
  // For a court, only the saved score of the game now on it counts.
  const match = $derived(courtId ? store.courtMatch(court) : store.match(null));

  // A court with a game on but no score yet starts at 0–0.
  $effect(() => {
    if (courtId && court?.teams.length === 2 && !store.courtMatch(court)) {
      const names = { a: court.teams[0].p.join(' / '), b: court.teams[1].p.join(' / ') };
      store.setMatch(courtId, { ...newMatch({ sport: session.sport, doubles: true, names }), game: court.game });
    }
  });

  const other = (side) => (side === 'a' ? 'b' : 'a');
  const won = $derived(match ? winner(match) : null);
  const badminton = $derived(match?.sport === 'badminton');
  const setMatch = (next) => store.setMatch(courtId, next);

  const title = $derived(courtId ? `Court ${courtId}` : badminton ? 'Badminton' : 'Pickleball');
  const rules = $derived(
    !match ? '' : badminton ? 'Best of 3 · To 21 · Cap 30' : `${match.doubles ? 'Doubles' : 'Singles'} · To ${match.target} · Win by 2`,
  );
  const point = $derived(match && !won ? isGamePoint(match) : false);
  const matchPoint = $derived(point && badminton && Math.max(match.games.a, match.games.b) === Math.ceil(match.bestOf / 2) - 1);
  const callParts = $derived(match ? callText(match).split(' – ') : []);
  const callLabels = $derived(badminton || !match?.doubles ? ['Server', 'Receiver'] : ['Server', 'Receiver', 'Server #']);
  const nextGame = $derived(courtId && session ? upcoming(session, 1)[0] ?? null : null);

  function status(side) {
    if (won) return won === side ? '🏆 Winner' : '';
    if (match.serving !== side) return 'Receiving';
    if (badminton) return `Serving · ${serviceCourt(match)}`;
    return match.doubles ? `Serving · Server ${match.server}` : 'Serving';
  }

  /* ---------- Keep the screen awake while scoring ---------- */

  let wakeLock = null;
  async function keepAwake() {
    if (!match || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } catch {
      // Not allowed (battery saver, old browser): scoring still works.
    }
  }
  $effect(() => {
    if (match) keepAwake();
  });

  /* ---------- Actions ---------- */

  // Point, side out, second server, game won: say what happened so nobody has to work it out.
  function scoreRally(side) {
    const before = match;
    const next = rally(before, side);
    if (next === before) return;
    navigator.vibrate?.(12);
    setMatch(next);

    const w = winner(next);
    if (w) {
      toast(`${next.names[w]} win${badminton ? ' the match' : ''}!`, { type: 'success', key: 'rally' });
    } else if (badminton) {
      if (next.finished.length > before.finished.length) {
        const g = next.finished[next.finished.length - 1];
        toast(`Game ${next.finished.length} to ${next.names[side]} (${g.a}–${g.b}). Next game starts at 0–0.`, { type: 'success', key: 'rally', ms: 5000 });
      } else if (next.serving !== before.serving) {
        toast(`Service over. ${next.names[next.serving]} serve.`, { key: 'rally', ms: 2200 });
      }
    } else if (next.serving !== before.serving) {
      toast(`Side out. ${next.names[next.serving]} serve.`, { key: 'rally', ms: 2200 });
    } else if (next.server !== before.server) {
      toast('Second server.', { key: 'rally', ms: 2000 });
    }
  }

  function doUndo() {
    if (!match?.history.length) return;
    setMatch(undo(match));
    toast('Last rally undone.', { key: 'rally', ms: 1600 });
  }

  function restart() {
    const before = match;
    setMatch({ ...newMatch(before), game: before.game });
    toast('Score reset to 0–0.', { onUndo: () => setMatch(before) });
  }

  function clearMatch() {
    const before = match;
    setMatch(null);
    if (!winner(before)) toast('Match cleared.', { onUndo: () => setMatch(before) });
  }

  function startMatch(options) {
    setMatch(newMatch(options));
    toast('Match started. Tap a side each time it wins a rally.', { type: 'success' });
  }

  // Send the result to the open play board and call the next four players.
  function saveAndCallNext() {
    const score = badminton ? { a: match.games.a, b: match.games.b } : { a: match.a, b: match.b };
    store.setSession(endGame(store.session, courtId, score));
    store.setMatch(courtId, null);
    goto(`${resolve('/openplay')}?finished=${courtId}`);
  }

  function onkeydown(event) {
    if (!match || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest?.('input, select, textarea')) return;
    const k = event.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') scoreRally('a');
    else if (k === 'b' || k === 'arrowright') scoreRally('b');
    else if (k === 'u' || k === 'backspace') doUndo();
    else return;
    event.preventDefault();
  }
</script>

<svelte:head><title>{courtId ? `Court ${courtId} · ` : ''}Scoreboard · Sidecourt</title></svelte:head>
<svelte:window {onkeydown} />
<svelte:document onvisibilitychange={keepAwake} />

{#if courtId && !court?.teams.length}
  <section class="card narrow pop">
    <h1>Court {courtId} is open</h1>
    <p class="muted">No game is running on this court yet.</p>
    <a class="btn btn-primary" href={resolve('/openplay')}>Back to the board</a>
  </section>
{:else if !match}
  {#if !courtId}<ScoreSetup onstart={startMatch} />{/if}
{:else}
  <section class="board">
    <header class="board-head">
      <h1>{title}</h1>
      <p class="muted small">{rules}</p>
    </header>

    {#if won}
      <section class="win-card pop">
        <span class="trophy" aria-hidden="true">🏆</span>
        <div class="grow">
          <span class="label">{badminton ? 'Match' : 'Game'} over · {badminton ? `${match.games.a}–${match.games.b} in games` : `${match.a}–${match.b}`}</span>
          <h2>{match.names[won]} win!</h2>
        </div>
        {#if courtId}
          <button class="btn btn-dark btn-big" onclick={saveAndCallNext}>Save result &amp; call next</button>
        {:else}
          <button class="btn btn-dark btn-big" onclick={clearMatch}>New match</button>
        {/if}
      </section>
    {:else}
      <!-- The score call, kept small -->
      <section class={['call-bar', point && 'point']} aria-live="polite">
        <div class="call-top">
          <span class="label">Score call</span>
          {#if point}<span class="point-pill">{matchPoint ? 'Match point' : 'Game point'}</span>{/if}
          <button
            class="icon-btn small"
            aria-label="Read the score out loud"
            title="Read the score out loud"
            onclick={() => speak(badminton ? `${match[match.serving]}, ${match[other(match.serving)]}` : callText(match).replaceAll('–', ','))}>🔊</button>
        </div>
        <div class="call" aria-label="Score call {callParts.join(', ')}">
          {#each callParts as n, i (i)}
            {#if i > 0}<span class="call-dash">–</span>{/if}
            <span class="call-part">
              <span class={['call-num', i === 0 && `srv-${match.serving}`, i === 1 && `srv-${other(match.serving)}`]}>{n}</span>
              <span class="call-label">{callLabels[i]}</span>
            </span>
          {/each}
        </div>
        <p class="serve-line">
          <strong>{match.names[match.serving]}</strong>
          {#if badminton}serving from the {serviceCourt(match)} court{:else if match.doubles}serving · Server {match.server}{:else}serving{/if}
        </p>
      </section>
    {/if}

    <!-- The two big tap areas -->
    <div class="sides">
      {#each ['a', 'b'] as side (side)}
        {@const serving = match.serving === side && !won}
        <button
          class={['side', side, serving && 'serving', won === side && 'won']}
          disabled={!!won}
          aria-label="{match.names[side]}: {match[side]}. Tap if they won the rally."
          onclick={() => scoreRally(side)}
        >
          <span class="side-info">
            <span class="side-name">{match.names[side]}</span>
            <span class="side-status">{#if serving}<span class="ball" aria-hidden="true"></span>{/if}{status(side)}</span>
            {#if badminton}
              <span class="games" aria-label="{match.games[side]} games won">
                {#each Array.from({ length: Math.ceil(match.bestOf / 2) }) as _, i (i)}
                  <span class={['dot', i < match.games[side] && 'on']}></span>
                {/each}
                <span class="small">Games</span>
              </span>
            {/if}
          </span>
          <!-- A new score re-creates this, which plays the "bump" -->
          {#key match[side]}<span class="score bump">{match[side]}</span>{/key}
          {#if !won}<span class="tap-hint">Tap if they won the rally</span>{/if}
        </button>
      {/each}
    </div>

    {#if badminton && match.finished.length}
      <p class="muted center small">
        Finished games:
        {#each match.finished as g, i (i)}{i ? ' · ' : ''}<strong>G{i + 1}</strong> {g.a}–{g.b}{/each}
      </p>
    {/if}

    <p class="muted center small keys">Keyboard: <kbd>A</kbd> or <kbd>←</kbd> side A · <kbd>B</kbd> or <kbd>→</kbd> side B · <kbd>U</kbd> undo</p>
    <div class="controls">
      <button class="btn btn-light btn-big" disabled={!match.history.length} onclick={doUndo}>↶ Undo</button>
      <button class="btn btn-ghost" disabled={!match.history.length} onclick={restart}>Restart</button>
      {#if !courtId}<button class="btn btn-ghost" onclick={clearMatch}>New match</button>{/if}
    </div>

    <!-- Who goes on next, from the open play line: quiet, at the very bottom -->
    {#if courtId && session}
      <p class="next-up">
        <span class="label">Next game</span>
        {#if nextGame}
          <span><span class="nu-team">{nextGame[0].p.join(' & ')}</span> <span class="vs-small">vs</span> <span class="nu-team">{nextGame[1].p.join(' & ')}</span></span>
        {:else}
          {@const need = 4 - waitingCount(session)}
          <span>{need >= 4 ? 'Nobody waiting' : `Needs ${need} more player${need === 1 ? '' : 's'}`}</span>
        {/if}
      </p>
    {/if}
  </section>
{/if}
