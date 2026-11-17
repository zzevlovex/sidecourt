<script>
  // A real <dialog>: focus stays inside, Esc closes it, the page behind is dimmed.
  let { onclose, labelledby, children } = $props();
  let dialog;

  $effect(() => {
    dialog.showModal();
    // Focus the dialog itself, not its first button (often at the bottom), so
    // it opens at the top and a stray Enter does not press anything.
    dialog.focus();
    dialog.scrollTop = 0;
    return () => {
      if (dialog.open) dialog.close();
    };
  });
</script>

<dialog
  bind:this={dialog}
  class="end-dialog"
  tabindex="-1"
  aria-labelledby={labelledby}
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
>
  {@render children()}
</dialog>
