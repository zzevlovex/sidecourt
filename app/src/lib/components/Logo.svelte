<script>
  // The SC mark. Decorative: it always sits beside the name "Sidecourt".
  import { LOGO_SHAPES, LOGO_SIZE, logoPath } from '#lib/logic/logo.js';

  let { size = 28 } = $props();
</script>

<svg class="logo" width={size} height={size} viewBox="0 0 {LOGO_SIZE} {LOGO_SIZE}" aria-hidden="true">
  {#each LOGO_SHAPES as shape, i (i)}
    <path d={logoPath(shape)} fill="var(--orange)" />
  {/each}
</svg>
