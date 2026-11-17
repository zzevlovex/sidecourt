<script>
  // Players follow an open play from their own phone: courts, who's next,
  // their place in line, recent results. Signed-in players can join the line.
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { account } from '$lib/account.svelte.js';
  import { supabase } from '$lib/supabase.js';
  import { toast } from '$lib/toasts.svelte.js';
  import { upcoming, waitingCount } from '$lib/logic/queue.js';
  import { codeFrom } from '$lib/logic/lobby.js';
  import { fetchLobby, joinLobby, POLL_MS } from '$lib/lobby.svelte.js';
  import { teamNames } from '$lib/format.js';
  import Matchup from '$lib/openplay/Matchup.svelte';
  import ResultRow from '$lib/openplay/ResultRow.svelte';

  const code = $derived(codeFrom(page.url.searchParams.get('code') ?? ''));
  let typed = $state('');
  let lobby = $state(null); // { state, open, updated_at }
  let missing = $state(false);
  let offline = $state(false);
  let joining = $state(false);
  let asked = $state(false);

  // Refresh every few seconds while the page is open.
  $effect(() => {
    if (!code || !supabase) return;
    let stop = false;
    async function refresh() {
      try {
        const found = await fetchLobby(code);
        if (stop) return;
        lobby = found;
        missing = !found;
        offline = false;
      } catch {
        offline = true;
      }
    }
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  });

  const s = $derived(lobby?.state);
  const games = $derived(s ? upcoming(s, 2) : []);
  const myName = $derived(account.profile?.display_name ?? null);
  // A shared name gets " (XXXX)" added by the manager's app.
  const isMe = (name) => myName && (name === myName || name.startsWith(`${myName} (`));
  const myPlace = $derived(s && myName ? s.queue.findIndex((e) => e.p.some(isMe)) : -1);
  const onCourt = $derived(s && myName ? s.courts.find((c) => c.teams.some((t) => t.p.some(isMe))) : null);

  function open(event) {
    event.preventDefault();
    const c = codeFrom(typed);
    if (!c) return toast('A lobby code has 6 letters and numbers.', { type: 'warn' });
    goto(`${resolve('/lobby')}?code=${c}`);
  }

  async function join() {
    joining = true;
    try {
      const result = await joinLobby(code);
      if (result === 'closed') toast('This open play has ended.', { type: 'warn' });
      else {
        asked = true;
        toast("You're on your way in: the manager's app adds you in a few seconds.", { type: 'success', ms: 6000 });
      }
    } catch {
      toast('Could not join. Check your connection and try again.', { type: 'warn' });
    } finally {
      joining = false;
    }
  }
</script>

<svelte:head><title>{s ? `${s.name} · ` : ''}Lobby · Sidecourt</title></svelte:head>

{#if !supabase}
  <p class="notice">Lobbies need the online setup (app/.env).</p>
{:else if !code}
  <section class="card narrow pop">
    <p class="eyebrow">Open play</p>
    <h1>Join open play</h1>
    <p class="muted">Type the lobby code from the manager's screen, or scan its QR code with your camera.</p>
    <form class="stack" onsubmit={open}>
      <label>Lobby code
        <input bind:value={typed} class="code-input" maxlength="7" placeholder="e.g. K7QM2X" autocapitalize="characters" autocomplete="off" spellcheck="false" required />
      </label>
      <button class="btn btn-primary">Open lobby</button>
    </form>
  </section>
{:else if missing}
  <section class="card narrow">
    <h1>Lobby not found</h1>
    <p class="muted">No open play has the code <strong>{code}</strong>. Check it with the manager.</p>
    <a class="btn btn-ghost" href={resolve('/lobby')}>Try another code</a>
  </section>
{:else if !s}
  <p class="muted center">Loading lobby {code}…</p>
{:else}
  <section class="lobby">
    <header class="session-head">
      <div class="head-title">
        <p class="eyebrow">Lobby {code} · {s.sport}</p>
        <h1>{s.name}</h1>
      </div>
      <div class="chips">
        {#if lobby.open}<span class="stat-chip go"><span class="live-dot" aria-hidden="true"></span> Live</span>{:else}<span class="stat-chip">Ended</span>{/if}
        <span class="stat-chip"><strong>{waitingCount(s)}</strong> waiting</span>
        {#if offline}<span class="stat-chip">Reconnecting…</span>{/if}
      </div>
    </header>

    {#if !lobby.open}
      <p class="notice">This open play has ended. Players with an account can see their games under Account → My games.</p>
    {/if}

    <!-- Where am I? -->
    {#if lobby.open}
      <section class="card stack me-card">
        {#if !account.user}
          <p><strong>Want to play?</strong> <a href={resolve('/account')}>Sign in or create an account</a>, then come back and tap Join the line. Your games will be saved to your history.</p>
        {:else if onCourt}
          <p class="me-status">You're playing on <strong>Court {onCourt.id}</strong>.</p>
        {:else if myPlace >= 0}
          <p class="me-status">You're <strong>#{myPlace + 1}</strong> in line.</p>
          {#if games[0]?.some((t) => t.p.some(isMe))}<p class="hot-text">You're in the next game: get ready!</p>{/if}
        {:else if asked}
          <p class="me-status">Asked to join: you appear in the line in a few seconds.</p>
        {:else}
          <button class="btn btn-primary btn-big" disabled={joining} onclick={join}>Join the line as {myName}</button>
        {/if}
      </section>
    {/if}

    {#if s.lastCall && lobby.open}
      <div class="banner">
        <span class="banner-text"><span class="label">Now calling · Court {s.lastCall.court}</span><strong>{s.lastCall.names.join(', ')}</strong></span>
      </div>
    {/if}

    <section class="stack tight">
      <h2 class="section-title">Courts</h2>
      <div class="courts">
        {#each s.courts as court (court.id)}
          <article class={['card court', court.teams.length ? 'playing' : 'free']}>
            <div class="row between">
              <h3 class="court-name">Court {court.id}</h3>
              {#if court.teams.length}
                <span class="status live"><span class="live-dot" aria-hidden="true"></span>Game {court.game}</span>
              {:else}
                <span class="status go">Free</span>
              {/if}
            </div>
            {#if court.teams.length}<Matchup teams={court.teams} />{/if}
          </article>
        {/each}
      </div>
    </section>

    {#if games[0]}
      <section class="card next-card waiting">
        <span class="section-label">Up next</span>
        <Matchup teams={games[0]} ghost compact />
        {#if games[1]}<p class="muted small">After that: {teamNames(games[1][0])} vs {teamNames(games[1][1])}</p>{/if}
      </section>
    {/if}

    <section class="card stack">
      <div class="row between"><h2 class="section-title">Waiting line</h2><span class="count">{waitingCount(s)}</span></div>
      <ol class="queue">
        {#each s.queue as entry, i (entry.id)}
          <li class={['queue-item', entry.p.some(isMe) && 'picking']}>
            <span class="pos">{i + 1}</span>
            <span class="grow"><strong>{entry.p.join(' & ')}</strong>{#if entry.p.some(isMe)}<span class="badge badge-next">You</span>{/if}</span>
          </li>
        {:else}
          <li class="empty-line muted">Nobody is waiting.</li>
        {/each}
      </ol>
    </section>

    {#if s.results.length}
      <section class="card stack">
        <h2 class="section-title">Recent results</h2>
        <ul class="results">{#each s.results as result, i (i)}<ResultRow {result} />{/each}</ul>
      </section>
    {/if}
  </section>
{/if}
