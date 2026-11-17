<script>
  import '../app.css';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import Toasts from '$lib/components/Toasts.svelte';

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
    <nav>
      {#if path !== resolve('/openplay')}
        <a class="btn btn-ghost" href={resolve('/openplay')}>Open play</a>
      {/if}
      {#if path !== resolve('/scoreboard')}
        <a class="btn {home ? 'btn-primary' : 'btn-ghost'}" href={resolve('/scoreboard')}>Score a match</a>
      {/if}
      {#if path !== resolve('/account')}
        <a class="btn btn-ghost" href={resolve('/account')}>Account</a>
      {/if}
    </nav>
  </div>
</header>
<main class="page-wrap">
  {@render children()}
</main>

<Toasts />
