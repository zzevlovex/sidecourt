<script>
  import { theme, setTheme } from '#lib/theme.svelte.js';
</script>

<div class="theme-switch" role="group" aria-label="Appearance">
  {#each [['dark', 'Dark'], ['light', 'Light']] as [value, label] (value)}
    <button type="button" class={[theme.current === value && 'on']} aria-pressed={theme.current === value} onclick={() => setTheme(value)}>{label}</button>
  {/each}
</div>
