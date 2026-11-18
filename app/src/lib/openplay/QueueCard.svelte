<script>
  import Icon from '$lib/components/Icon.svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { store } from '$lib/state.svelte.js';
  import { waitingCount } from '$lib/logic/queue.js';
  import { plural } from '$lib/format.js';
  import { motion } from '$lib/motion.js';
  import { ui } from './ui.svelte.js';
  import { moveUp, removePlayer, pairWith, split, setBreak } from './actions.js';

  // games: the next two games, to mark who plays next.
  let { games } = $props();

  const session = $derived(store.session);
  const nextNames = $derived(new Set((games[0] || []).flatMap((t) => t.p)));
  const deckNames = $derived(new Set((games[1] || []).flatMap((t) => t.p)));
  const picking = $derived(ui.pairing !== null ? session.queue.find((e) => e.id === ui.pairing) ?? null : null);
  const solos = $derived(session.queue.filter((e) => e.p.length === 1 && !e.away).length);

  function details(entry) {
    const games = Math.min(...entry.p.map((n) => session.games[n] || 0));
    return [
      entry.p.length === 2 ? 'Partners' : 'Random',
      plural(games, 'game'),
      entry.addedBy ? `by ${entry.addedBy}` : '',
      entry.p.some((n) => session.accounts?.[n]) ? 'Linked' : '',
    ].filter(Boolean).join(' · ');
  }
</script>

<section class="card stack area-line">
  <div class="row between">
    <h2 class="section-title"><span class="title-icon"><Icon name="list" size={18} /></span>Waiting line</h2>
    <span class="count">{waitingCount(session)}</span>
  </div>

  {#if picking}
    <div class="pair-banner">
      <span>Choose a partner for <strong>{picking.p[0]}</strong></span>
      <button class="btn btn-small btn-ghost" onclick={() => (ui.pairing = null)}>Cancel</button>
    </div>
  {:else}
    <p class="muted small">
      Top of the line plays first.{session.allowPicks ? ' Pair teams two players up.' : ''} Pause keeps a player's place while they rest.
    </p>
  {/if}

  <ol class="queue">
    {#each session.queue as entry, index (entry.id)}
      {@const solo = entry.p.length === 1 && !entry.away}
      {@const inNext = entry.p.some((n) => nextNames.has(n))}
      {@const inDeck = !inNext && entry.p.some((n) => deckNames.has(n))}
      {@const who = entry.p.join(' and ')}
      <li
        class={[
          'queue-item',
          inNext && 'next',
          inDeck && 'deck',
          entry.p.length === 2 && 'paired',
          entry.away && 'away',
          picking && entry.id === picking.id && 'picking',
          picking && entry.id !== picking.id && (solo ? 'pick-target' : 'dim'),
        ]}
        animate:flip={motion({ duration: 250 })}
        in:fly={motion({ x: 16, duration: 300 })}
        out:fly={motion({ x: 24, duration: 200 })}
      >
        <span class="pos">{#if entry.away}<Icon name="pause" size={14} />{:else}{index + 1}{/if}</span>
        <span class="grow">
          <strong>{entry.p.join(' & ')}</strong>
          {#if inNext}<span class="badge badge-next">Next game</span>{/if}
          {#if inDeck}<span class="badge badge-deck">After that</span>{/if}
          {#if entry.away}<span class="badge badge-deck">On break</span>{/if}
          <span class="tag">{details(entry)}</span>
        </span>
        <span class="item-actions">
          {#if picking}
            <!-- Choosing a partner: only the choices are shown -->
            {#if entry.id === picking.id}
              <button class="pair-btn" onclick={() => (ui.pairing = null)}>Cancel</button>
            {:else if solo}
              <button class="pair-btn pick" onclick={() => pairWith(entry.id)}><Icon name="users" size={16} /> Pair with {picking.p[0]}</button>
            {/if}
          {:else if entry.away}
            <button class="pair-btn back" aria-label="{who} back from break" onclick={() => setBreak(entry, false)}><Icon name="play" size={16} /> Back</button>
            <button class="icon-btn" aria-label="Remove {who}" onclick={() => removePlayer(entry)}><Icon name="x" size={18} /></button>
          {:else}
            {#if session.allowPicks}
              {#if entry.p.length === 1}
                <button
                  class="pair-btn"
                  disabled={solos < 2}
                  title={solos < 2 ? 'Nobody else in the line to pair with' : undefined}
                  aria-label="Pair {who} with someone"
                  onclick={() => (ui.pairing = entry.id)}><Icon name="users" size={16} /> Pair</button>
              {:else}
                <button class="pair-btn" aria-label="Split {who} into random teammates" onclick={() => split(entry)}>Split</button>
              {/if}
            {/if}
            <button class="icon-btn" aria-label="{who} take a break" title="Take a break" onclick={() => setBreak(entry, true)}><Icon name="pause" size={18} /></button>
            <button class="icon-btn" aria-label="Move {who} up" disabled={index === 0} onclick={() => moveUp(entry.id)}><Icon name="arrow-up" size={18} /></button>
            <button class="icon-btn" aria-label="Remove {who}" onclick={() => removePlayer(entry)}><Icon name="x" size={18} /></button>
          {/if}
        </span>
      </li>
    {:else}
      <li class="empty-line muted">Nobody is waiting. Check players in above.</li>
    {/each}
  </ol>
</section>
