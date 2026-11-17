<script>
  import Icon from '$lib/components/Icon.svelte';
  // Final standings after open play ends: podium, full ranking, every game.
  import { toast } from '$lib/toasts.svelte.js';
  import { plural, pct, signed } from '$lib/format.js';
  import ResultRow from './ResultRow.svelte';
  import { showStandings } from './actions.js';

  let { summary: s } = $props();

  const ranked = $derived(s.standings.filter((p) => p.played));
  const unplayed = $derived(s.standings.filter((p) => !p.played));
  const scored = $derived(s.results.some((r) => r.score || r.winner));
  const podium = $derived(ranked.slice(0, 3));
  // Podium order on screen: 2nd, 1st, 3rd.
  const podiumOrder = $derived(podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium);
  const date = $derived(new Date(s.endedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));

  function copyStandings() {
    const lines = ranked.map((p) => `${p.rank}. ${p.name}: ${p.wins}W-${p.losses}L, ${signed(p.diff)} (${plural(p.played, 'game')})`);
    const text = `${s.name}: final standings\n${lines.join('\n')}`;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast('Standings copied. Paste them in your group chat.', { type: 'success' }))
      .catch(() => toast('Could not copy on this browser.', { type: 'warn' }));
  }
</script>

<section class="final">
  <header class="final-head">
    <p class="eyebrow">Final standings · {s.sport} · {date}</p>
    <h1>{s.name}</h1>
    <div class="chips">
      <span class="stat-chip"><strong>{s.games}</strong> games</span>
      <span class="stat-chip"><strong>{ranked.length}</strong> players</span>
    </div>
  </header>

  {#if podium.length}
    <ol class="podium" aria-label="Top three">
      {#each podiumOrder as p (p.name)}
        {@const place = Math.min(p.rank, 3)}
        <li class="podium-spot place-{place}">
          <span class="podium-medal"><Icon name="trophy" size={place === 1 ? 36 : 28} /></span>
          <strong class="podium-name">{p.name}</strong>
          <span class="podium-stats">{p.wins}W · {p.losses}L{scored ? ` · ${signed(p.diff)} pts` : ''}</span>
          <span class="podium-block">{p.rank}</span>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="card muted">No games were played in this session.</p>
  {/if}

  {#if !scored && ranked.length}
    <p class="notice">No scores were entered, so players are ranked by games played only.</p>
  {/if}

  {#if ranked.length}
    <section class="card stack">
      <h2 class="section-title">Rankings</h2>
      <div class="rank-row rank-head" aria-hidden="true">
        <span>#</span><span>Player</span><span>W–L</span><span class="rank-pct">Win %</span><span class="rank-diff">Pts +/−</span>
      </div>
      <ol class="rank-list">
        {#each ranked as p, i (p.name)}
          <li class={['rank-row', p.rank <= 3 && 'top']} style="--i: {Math.min(i, 12)}">
            <span class="rank-num">{#if p.rank <= 3}<span class="rank-badge place-{p.rank}">{p.rank}</span>{:else}{p.rank}{/if}</span>
            <span class="grow"><strong>{p.name}</strong><span class="tag">{plural(p.played, 'game')} · {p.pointsFor} pts scored</span></span>
            <span class="rank-wl">{p.wins}–{p.losses}</span>
            <span class="rank-pct">{pct(p)}</span>
            <span class={['rank-diff', p.diff > 0 && 'pos', p.diff < 0 && 'neg']} title="Scored {p.pointsFor}, gave up {p.pointsAgainst}">{signed(p.diff)}</span>
          </li>
        {/each}
      </ol>
      {#if unplayed.length}
        <p class="muted small">Checked in but did not play: {unplayed.map((p) => p.name).join(', ')}</p>
      {/if}
      <details class="more">
        <summary>How the ranking works</summary>
        <div class="legend">
        <p><strong>W–L</strong> wins and losses.</p>
        <p><strong>Pts +/−</strong> points scored minus points given up, across all scored games. <span class="pos">+6</span> means they scored 6 more than their opponents; <span class="neg">−4</span> means 4 fewer.</p>
        <p><strong>Order</strong> most wins first. Ties go to the higher win %, then the better Pts +/−.</p>
        <p class="muted">Games won by picking a winner (no score) count as a win but add no points. Games with no score and no winner count as played only.</p>
        </div>
      </details>
    </section>
  {/if}

  {#if s.results.length}
    <details class="card fold">
      <summary><span class="section-label">All games</span><span class="muted small">{plural(s.results.length, 'game')}</span></summary>
      <ul class="results fold-body">
        {#each s.results as result, i (i)}<ResultRow {result} />{/each}
      </ul>
    </details>
  {/if}

  <div class="row wrap final-actions">
    {#if ranked.length}<button class="btn btn-ghost" onclick={copyStandings}><Icon name="copy" size={18} /> Copy standings</button>{/if}
    <button class="btn btn-primary grow" onclick={() => showStandings(false)}>Start new open play</button>
  </div>
</section>
