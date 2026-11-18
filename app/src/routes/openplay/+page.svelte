<script>
  import Icon from '#lib/components/Icon.svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { store } from '#lib/state.svelte.js';
  import { toast } from '#lib/toasts.svelte.js';
  import { plural } from '#lib/format.js';
  import { upcoming, waitingCount, playingCount } from '#lib/logic/queue.js';
  import { ui } from '#lib/openplay/ui.svelte.js';
  import { announce, setHelp, pullJoins, checkInByCode } from '#lib/openplay/actions.js';
  import LobbyDialog from '#lib/openplay/LobbyDialog.svelte';
  import ScorerDialog from '#lib/openplay/ScorerDialog.svelte';
  import { account } from '#lib/account.svelte.js';
  import { POLL_MS } from '#lib/lobby.svelte.js';
  import { poll } from '#lib/poll.js';
  import CourtDialog from '#lib/openplay/CourtDialog.svelte';
  import ResultDialog from '#lib/openplay/ResultDialog.svelte';
  import { codeFrom } from '#lib/logic/lobby.js';
  import SetupForm from '#lib/openplay/SetupForm.svelte';
  import Standings from '#lib/openplay/Standings.svelte';
  import CourtCard from '#lib/openplay/CourtCard.svelte';
  import NextGameCard from '#lib/openplay/NextGameCard.svelte';
  import CheckinCard from '#lib/openplay/CheckinCard.svelte';
  import QueueCard from '#lib/openplay/QueueCard.svelte';
  import SettingsCard from '#lib/openplay/SettingsCard.svelte';
  import ResultRow from '#lib/openplay/ResultRow.svelte';
  import EndDialog from '#lib/openplay/EndDialog.svelte';
  import FinishDialog from '#lib/openplay/FinishDialog.svelte';
  import { enter, settleSoon } from '#lib/enter.js';

  const session = $derived(store.session);
  const viewingStandings = $derived(page.url.searchParams.get('view') === 'standings');
  const games = $derived(session ? upcoming(session, 2) : []);
  const free = $derived(session ? session.courts.filter((c) => !c.teams.length).length : 0);
  // Playing courts first, free ones after: the games in progress are what the manager watches.
  const courts = $derived(
    session ? [...session.courts].sort((x, y) => (x.teams.length ? 0 : 1) - (y.teams.length ? 0 : 1) || x.id - y.id) : [],
  );

  // Animations only for changes after the page has appeared, not on first load.
  settleSoon();

  let lobbyOpen = $state(false);
  let resultsShown = $state(8);
  // A player QR scanned with the phone camera: checked in once sign-in has loaded.
  let scannedCode = $state(null);
  $effect(() => {
    if (scannedCode && account.ready && store.session) {
      checkInByCode(scannedCode);
      scannedCode = null;
    }
  });

  onMount(() => {
    // Players who tapped "Join the line" in the lobby are added every few seconds.
    const stopJoins = poll(pullJoins, POLL_MS);
    // Coming back from the scoreboard: confirm what happened there.
    const params = page.url.searchParams;
    const scored = Number(params.get('scored'));
    const finished = Number(params.get('finished'));
    if (scored && session) {
      const live = store.liveScore(session.courts.find((c) => c.id === scored));
      if (live) toast(`Court ${scored} score saved: ${live.match.a}–${live.match.b}. Open the scoreboard again to keep going.`, { type: 'success', ms: 5000 });
    }
    if (finished && session) {
      const court = session.courts.find((c) => c.id === finished);
      toast(court?.teams.length
        ? `Court ${finished} result saved. Next game is on: ${court.teams.flatMap((t) => t.p).join(', ')}.`
        : `Court ${finished} result saved. Not enough players for the next game yet.`, { type: 'success', ms: 6000 });
    }
    // A player's QR scanned with the phone camera opens /openplay?code=XXXXXX.
    scannedCode = codeFrom(params.get('code') ?? '');
    if (scored || finished || scannedCode) goto(resolve('/openplay'), { replaceState: true, noScroll: true, keepFocus: true });
    return stopJoins;
  });
</script>

<svelte:head><title>Open play · Sidecourt</title></svelte:head>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape' && ui.pairing !== null) ui.pairing = null;
  }}
/>

{#if !session}
  {#if store.summary && viewingStandings}
    <Standings summary={store.summary} />
  {:else}
    <SetupForm />
  {/if}
{:else}
  <section class="session-head">
    <div class="head-title">
      <p class="eyebrow">Open play · {session.sport}{session.location ? ` · ${session.location}` : ''}</p>
      <h1>{session.name}</h1>
    </div>
    <div class="head-actions">
      {#if session.lobby}
        <button class="btn btn-small btn-ghost" onclick={() => (lobbyOpen = true)}><Icon name="qr" size={16} /> Lobby {session.lobby}</button>
      {:else if account.user}
        <span class="stat-chip">Creating lobby…</span>
      {/if}
      <button class="btn btn-small btn-ghost end-btn" onclick={() => (ui.ending = true)}>End</button>
      <button class="help-btn" aria-expanded={ui.help} aria-label="How open play works" title="How open play works" onclick={() => setHelp(!ui.help)}><Icon name="help" size={18} /></button>
    </div>
  </section>

  <div class="chips stat-row">
    <span class="stat-chip"><strong>{playingCount(session)}</strong> playing</span>
    <span class="stat-chip"><strong>{waitingCount(session)}</strong> waiting</span>
    <span class={['stat-chip', free && 'go']}><strong>{free}/{session.courts.length}</strong> courts free</span>
  </div>

  <section class="layout">
    <div class="main-col">
      {#if ui.help}
        <section class="help card area-help">
          <div class="row between">
            <h3>How open play works</h3>
            <button class="btn btn-small btn-ghost" onclick={() => setHelp(false)}>Got it</button>
          </div>
          <ol class="steps">
            <li><span class="step-n">1</span><span><strong>Check players in.</strong> They join the end of the waiting line.</span></li>
            <li><span class="step-n">2</span><span><strong>Send the next game to a free court.</strong> The top 4 in line play, and you can see the teams first.</span></li>
            <li><span class="step-n">3</span><span><strong>Finish the game.</strong> Those 4 go to the back of the line and the next game is called on that court.</span></li>
          </ol>
        </section>
      {/if}

      {#if session.lastCall}
        {#key session.lastCall}
          <div class="banner area-call" use:enter={'ring'}>
            <span class="banner-text">
              <span class="label">Now calling · Court {session.lastCall.court}</span>
              <strong>{session.lastCall.names.join(', ')}</strong>
            </span>
            <button class="btn btn-dark btn-small" onclick={announce}><Icon name="volume" size={16} /> Announce</button>
          </div>
        {/key}
      {/if}

      <section class="area-courts stack tight">
        <h2 class="section-title"><span class="title-icon"><Icon name="grid" size={18} /></span>Courts</h2>
        <div class="courts">
          {#each courts as court (court.id)}
            <!-- A new game on a court re-creates its card, which plays the "started" animation -->
            {#key court.teams.length ? court.game : -1}
              <CourtCard {court} ready={games.length > 0} />
            {/key}
          {/each}
        </div>
      </section>

      <NextGameCard {games} />

      {#if session.results.length}
        <details class="card fold area-results" bind:open={ui.resultsOpen}>
          <summary><span class="section-label">Recent results</span><span class="muted small">{plural(session.results.length, 'game')}</span></summary>
          <ul class="results fold-body">
            {#each session.results.slice(0, resultsShown) as result, i (result.id ?? i)}<ResultRow {result} onedit={(id) => (ui.editingResult = id)} />{/each}
          </ul>
          {#if session.results.length > resultsShown}
            <button class="btn btn-small btn-ghost see-more" onclick={() => (resultsShown += 20)}>See more ({session.results.length - resultsShown} left)</button>
          {/if}
        </details>
      {/if}
    </div>

    <aside class="side-col">
      <CheckinCard />
      <QueueCard {games} />
      <SettingsCard />
    </aside>
  </section>

  {#if ui.ending}<EndDialog />{/if}
  {#if lobbyOpen && session.lobby}<LobbyDialog code={session.lobby} onclose={() => (lobbyOpen = false)} />{/if}
  {#if ui.finishing !== null}<FinishDialog />{/if}
  {#if ui.managing !== null}<CourtDialog />{/if}
  {#if ui.editingResult !== null}<ResultDialog />{/if}
  {#if ui.scoring !== null && session.lobby && session.scoreKeys?.[ui.scoring]}
    <ScorerDialog code={session.lobby} court={ui.scoring} key={session.scoreKeys[ui.scoring]} onclose={() => (ui.scoring = null)} />
  {/if}
{/if}
