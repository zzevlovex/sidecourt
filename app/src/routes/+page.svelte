<script>
  // Home. One clear main action (players joining open play), then the
  // manager actions, then small extras.
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { store } from '$lib/state.svelte.js';
  import { toast } from '$lib/toasts.svelte.js';
  import { codeFrom } from '$lib/logic/lobby.js';

  let code = $state('');

  function join(event) {
    event.preventDefault();
    const c = codeFrom(code);
    if (!c) return toast('A lobby code has 6 letters and numbers, like K7QM2X.', { type: 'warn' });
    goto(`${resolve('/lobby')}?code=${c}`);
  }
</script>

<svelte:head><title>Sidecourt</title></svelte:head>

<div class="home">
  <section class="hero">
    <p class="eyebrow">Pickleball + Badminton</p>
    <h1>Keep score.<br /><span>Run the courts.</span></h1>
    <p class="muted hero-sub">Join an open play from your phone, or run one: courts, a fair waiting line and name call-outs.</p>
  </section>

  <div class="home-actions">
    <!-- 1. Main action: players joining -->
    <form class="card join-card" onsubmit={join}>
      <div>
        <h2>Join open play</h2>
        <p class="muted small">Enter the lobby code from the courts, or scan its QR with your camera.</p>
      </div>
      <div class="join-row">
        <input
          bind:value={code}
          class="code-input"
          maxlength="7"
          placeholder="LOBBY CODE"
          aria-label="Lobby code"
          autocapitalize="characters"
          autocomplete="off"
          spellcheck="false"
        />
        <button class="btn btn-primary btn-big">Join</button>
      </div>
    </form>

    <!-- 2. Manager actions -->
    <div class="secondary-actions">
      <a class={['card action-card', store.session && 'active']} href={resolve('/openplay')}>
        <span class="label">{store.session ? 'Session running' : 'Managers'}</span>
        <strong>{store.session ? `Continue ${store.session.name}` : 'Host open play'}</strong>
        <span class="arrow" aria-hidden="true">→</span>
      </a>
      <a class="card action-card" href={resolve('/scoreboard')}>
        <span class="label">One game</span>
        <strong>Score a match</strong>
        <span class="arrow" aria-hidden="true">→</span>
      </a>
    </div>

    <!-- 3. Extras -->
    {#if store.summary}
      <a class="text-link" href="{resolve('/openplay')}?view=standings">🏆 Last standings: {store.summary.name}</a>
    {/if}
  </div>
</div>
