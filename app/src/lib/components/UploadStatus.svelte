<script>
  // Shows when results have not reached the online history yet. Silent when all is saved.
  import { account } from '#lib/account.svelte.js';
  import { plural } from '#lib/format.js';
  import { history, flush, dismissFailed } from '#lib/history.svelte.js';

  const signedIn = $derived(Boolean(account.user));
</script>

{#if history.failed}
  <div class="notice upload-status" role="status">
    <span>{plural(history.failed, 'result')} could not be saved to online history. They are still in this device's standings.</span>
    <button class="link-btn" type="button" onclick={dismissFailed}>Dismiss</button>
  </div>
{/if}
{#if history.pending}
  <div class="notice upload-status" role="status">
    <span>{plural(history.pending, 'result')} waiting to upload{signedIn ? '' : '. Sign in to the account that hosted them'}.</span>
    {#if signedIn}<button class="link-btn" type="button" disabled={history.syncing} onclick={flush}>{history.syncing ? 'Uploading…' : 'Try now'}</button>{/if}
  </div>
{/if}
