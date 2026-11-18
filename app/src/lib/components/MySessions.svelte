<script>
  // Open play history: sessions the signed-in person played in or hosted.
  // Each one can show its ranking again and make share cards.
  import { account } from '#lib/account.svelte.js';
  import { mySessions, removeFromHistory } from '#lib/history.svelte.js';
  import { toast } from '#lib/toasts.svelte.js';
  import { plural } from '#lib/format.js';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import RankingList from '#lib/openplay/RankingList.svelte';
  import ShareDialog from '#lib/openplay/ShareDialog.svelte';

  const STEP = 3; // shown at first, and added by each "See more"

  let { sport } = $props(); // only this sport's sessions are shown

  let all = $state(null);
  const sessions = $derived(all ? all.filter((s) => s.sport === sport) : null);
  $effect(() => { sport; shown = STEP; }); // a new tab starts short again
  let failed = $state(false);
  let shown = $state(STEP);
  let ranking = $state(null); // session whose ranking is open
  let sharing = $state(null); // session whose share cards are open

  $effect(() => {
    if (!account.user) return;
    failed = false;
    mySessions().then((rows) => (all = rows)).catch(() => (failed = true));
  });

  // Removes the session, and everything else from the same host.
  async function notMe(s) {
    if (!confirm('Remove this from your history? Anything else from the same host is removed too, and they can\'t add you by code until you join one of their lobbies.')) return;
    try {
      await removeFromHistory('sessions', s.id);
      all = await mySessions();
      toast('Removed from your history.', { type: 'success' });
    } catch {
      toast('Could not remove it. Check your connection and try again.', { type: 'warn' });
    }
  }

  const myName = $derived(account.profile?.display_name ?? null);
  // A shared name gets " (XXXX)" added by the host's app.
  const isMeIn = (s, name) => {
    // Sessions list which name is which account; older ones can only go by the name.
    if (s.summary.players) return s.summary.players[name] === account.user?.id;
    return Boolean(myName) && (name === myName || name.startsWith(`${myName} (`));
  };
  const mine = (s) => s.summary.standings.find((p) => p.played && isMeIn(s, p.name)) ?? null;
  const ranked = (s) => s.summary.standings.filter((p) => p.played);
  const day = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
</script>

<section class="card stack">
  <div class="row between">
    <h2 class="section-title"><span class="title-icon"><Icon name="history" size={18} /></span>Open play history</h2>
    {#if sessions?.length}<span class="muted small">{plural(sessions.length, 'session')}</span>{/if}
  </div>

  {#if failed}
    <p class="form-error">Could not load your open play history. Check your connection.</p>
  {:else if !sessions}
    <p class="muted small">Loading…</p>
  {:else if !sessions.length}
    <p class="muted small">No {sport} sessions yet. A session appears here when an open play you joined or hosted ends.</p>
  {:else}
    <ul class="session-list">
      {#each sessions.slice(0, shown) as s (s.id)}
        {@const me = mine(s)}
        <li class="session-row">
          <div class="session-main">
            <strong>{s.name}</strong>
            {#if s.manager_id !== account.user.id}<button class="not-me" type="button" onclick={() => notMe(s)}>Not me</button>{/if}
            <span class="tag">{day(s.ended_at)} · {plural(s.summary.games, 'game')}{s.manager_id === account.user.id ? ' · hosted' : ''}</span>
            {#if me}
              <span class="session-me">
                <span class="rank-badge place-{Math.min(me.rank, 4)}">{me.rank}</span>
                <span>{me.wins}W – {me.losses}L of {plural(ranked(s).length, 'player')}</span>
              </span>
            {/if}
          </div>
          <div class="session-actions">
            <button class="btn btn-small btn-ghost" disabled={!ranked(s).length} onclick={() => (ranking = s)}><Icon name="trophy" size={16} /> Ranking</button>
            <button class="btn btn-small btn-ghost" disabled={!ranked(s).length} onclick={() => (sharing = s)}><Icon name="share" size={16} /> Share</button>
          </div>
        </li>
      {/each}
    </ul>
    {#if sessions.length > shown}
      <button class="btn btn-small btn-ghost see-more" onclick={() => (shown += STEP)}>See more ({sessions.length - shown} left)</button>
    {/if}
  {/if}
</section>

{#if ranking}
  <Modal onclose={() => (ranking = null)} labelledby="ranking-title">
    <div class="stack">
      <div>
        <p class="eyebrow">Final standings · {day(ranking.ended_at)}</p>
        <h2 id="ranking-title">{ranking.name}</h2>
      </div>
      <RankingList ranked={ranked(ranking)} highlight={(name) => isMeIn(ranking, name)} />
      <div class="row wrap end-actions">
        <button class="btn btn-ghost" type="button" onclick={() => (ranking = null)}>Close</button>
        <button class="btn btn-light grow" type="button" onclick={() => { sharing = ranking; ranking = null; }}><Icon name="share" size={18} /> Share cards</button>
      </div>
    </div>
  </Modal>
{/if}

{#if sharing}
  <ShareDialog summary={sharing.summary} onclose={() => (sharing = null)} />
{/if}
