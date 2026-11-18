<script>
  // How games are played: length and scoring for pickleball, length and number of games for badminton.
  let { sport, value, onchange, idPrefix = 'format' } = $props();

  const set = (field, v) => onchange({ ...value, [field]: v });
  const targets = $derived(sport === 'pickleball' ? [11, 15, 21] : [21, 15, 11]);
</script>

<div class="format-fields">
  <label for="{idPrefix}-target">Play to
    <select id="{idPrefix}-target" value={value.target} onchange={(e) => set('target', Number(e.currentTarget.value))}>
      {#each targets as n (n)}<option value={n}>{n} points</option>{/each}
    </select>
  </label>
  {#if sport === 'pickleball'}
    <label for="{idPrefix}-scoring">Scoring
      <select id="{idPrefix}-scoring" value={value.scoring} onchange={(e) => set('scoring', e.currentTarget.value)}>
        <option value="sideout">Side-out</option>
        <option value="rally">Rally</option>
      </select>
    </label>
  {:else}
    <label for="{idPrefix}-games">Games
      <select id="{idPrefix}-games" value={value.bestOf} onchange={(e) => set('bestOf', Number(e.currentTarget.value))}>
        <option value={1}>One game</option>
        <option value={3}>Best of 3</option>
      </select>
    </label>
  {/if}
</div>
