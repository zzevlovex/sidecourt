<script>
  // Two teams side by side. ghost: an upcoming game (outlined, not on a court yet).
  let { teams, ghost = false, compact = false } = $props();
</script>

<div class={['matchup', ghost && 'ghost', compact && 'compact']}>
  {#each teams as team, i (i)}
    {#if i === 1}<span class="vs">VS</span>{/if}
    <div class="team {i === 0 ? 'a' : 'b'}">
      <div class="team-names">
        {#each team.p as name (name)}<strong>{name}</strong>{/each}
      </div>
      <span class="pill {team.picked ? 'pill-pair' : 'pill-random'}">{team.picked ? 'Partners' : 'Random pair'}</span>
    </div>
  {/each}
</div>
