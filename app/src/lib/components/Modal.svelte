<script>
  // A real <dialog>: focus stays inside, Esc closes it, the page behind is dimmed.
  let { onclose, labelledby, children } = $props();
  let dialog;

  $effect(() => {
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  });
</script>

<dialog
  bind:this={dialog}
  class="end-dialog"
  aria-labelledby={labelledby}
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
>
  {@render children()}
</dialog>
