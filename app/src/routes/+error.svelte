<script>
  import { page } from '$app/state';
  import { resolve } from '$app/paths';

  const missing = $derived(page.status === 404);
</script>

<svelte:head><title>{missing ? 'Page not found' : 'Something went wrong'} · Sidecourt</title></svelte:head>

<section class="card narrow pop stack">
  <h1>{missing ? 'Page not found' : 'Something went wrong'}</h1>
  <p class="muted">{missing ? 'That address is not part of Sidecourt.' : 'Your session is still saved on this device. Try again from Home.'}</p>
  <a class="btn btn-primary" href={resolve('/')}>Go to Home</a>
</section>
