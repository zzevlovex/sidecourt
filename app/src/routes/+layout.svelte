<script>
  import '../app.css';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import Toasts from '$lib/components/Toasts.svelte';
  import { onMount } from 'svelte';
  import { startLobbySync } from '$lib/lobby.svelte.js';
  import { account } from '$lib/account.svelte.js';

  // Keeps the online lobby in step with the open play session on this device.
  onMount(() => startLobbySync());

  let { children } = $props();

  const path = $derived(page.url.pathname);
  const home = $derived(path === resolve('/'));
  // Back goes to the parent page (works even when the page was opened directly):
  // a court's scoreboard goes back to the board, everything else to Home.
  const court = $derived(page.url.searchParams.get('court'));
  const back = $derived(
    path === resolve('/scoreboard') && court
      ? { href: `${resolve('/openplay')}?scored=${court}`, label: 'Board' }
      : { href: resolve('/'), label: 'Home' },
  );
</script>

<!-- Header spans the full width; its content lines up with the page below -->
<header class="top">
  <div class="top-inner">
    <div class="row">
      {#if !home}
        <a class="btn btn-ghost btn-small back-btn" href={back.href} aria-label="Back to {back.label}">← {back.label}</a>
      {/if}
      <a class="brand" href={resolve('/')}>Sidecourt</a>
    </div>
    <!-- Home is one tap away (logo / Back), so the header only needs the account -->
    {#if path !== resolve('/account')}
      <a class="account-chip" href={resolve('/account')}>
        <span class="avatar" aria-hidden="true">{account.profile ? account.profile.display_name[0].toUpperCase() : '?'}</span>
        <span>{account.profile ? account.profile.display_name : account.user ? 'Account' : 'Sign in'}</span>
      </a>
    {/if}
  </div>
</header>
<main class="page-wrap">
  {@render children()}
</main>

<Toasts />
