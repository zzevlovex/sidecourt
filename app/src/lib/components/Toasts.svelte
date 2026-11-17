<script>
  import Icon from '$lib/components/Icon.svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { toasts, dismiss, toast } from '$lib/toasts.svelte.js';
  import { motion } from '$lib/motion.js';

  const ICONS = { success: 'check', warn: 'alert', info: 'info' };

  function undo(item) {
    dismiss(item.id);
    item.onUndo();
    toast('Undone.', { ms: 1800 });
  }
</script>

<div class="toasts" aria-live="polite">
  {#each toasts as item (item.id)}
    <div
      class="toast {item.type}"
      role={item.type === 'warn' ? 'alert' : 'status'}
      animate:flip={motion({ duration: 200 })}
      in:fly={motion({ y: 16, duration: 250 })}
      out:fly={motion({ x: 24, duration: 200 })}
    >
      <span class="toast-icon"><Icon name={ICONS[item.type]} size={16} /></span>
      <span class="grow">{item.text}</span>
      {#if item.onUndo}
        <button class="toast-undo" type="button" onclick={() => undo(item)}>Undo</button>
      {/if}
      <button class="toast-close" type="button" aria-label="Dismiss" onclick={() => dismiss(item.id)}><Icon name="x" size={18} /></button>
    </div>
  {/each}
</div>
