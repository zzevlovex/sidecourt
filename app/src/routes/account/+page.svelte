<script>
  import Icon from '$lib/components/Icon.svelte';
  import { resolve } from '$app/paths';
  import { account } from '$lib/account.svelte.js';
  import { toast } from '$lib/toasts.svelte.js';
  import MyGames from '$lib/components/MyGames.svelte';
  import QrCode from '$lib/components/QrCode.svelte';

  let name = $state('');
  let keyInput = $state('');
  let emailInput = $state('');
  let recoveryEmail = $state('');
  let forgot = $state(false);
  let busy = $state(false);
  let error = $state('');
  // A brand-new key, shown once until the person confirms they saved it.
  let shownKey = $state('');
  let saved = $state(false);
  let confirmDelete = $state('');
  let tab = $state('new'); // signed out: 'new' or 'key'

  // Runs an action, shows its error next to the form, blocks double taps.
  async function run(action) {
    busy = true;
    error = '';
    try {
      await action();
    } catch (e) {
      error = e?.message || 'Something went wrong. Check your connection and try again.';
    } finally {
      busy = false;
    }
  }

  const showKey = (key) => {
    shownKey = key;
    saved = false;
  };

  function copyKey() {
    (navigator.clipboard ? navigator.clipboard.writeText(shownKey) : Promise.reject())
      .then(() => toast('Key copied.', { type: 'success' }))
      .catch(() => toast('Could not copy. Write the key down instead.', { type: 'warn' }));
  }
</script>

<svelte:head><title>Account · Sidecourt</title></svelte:head>

<section class="account">
  <header>
    <p class="eyebrow">Account</p>
    <h1>Your Sidecourt key</h1>
    <p class="muted">No password, no sign-up form. Your key is your login, on any phone or computer.</p>
  </header>

  {#if !account.enabled}
    <p class="notice">Accounts are not set up yet: fill in app/.env (see app/supabase/SETUP.md).</p>
  {:else if !account.ready}
    <p class="muted">Loading…</p>
  {:else if shownKey}
    <!-- New key: shown once -->
    <section class="card stack key-card">
      <span class="label">Your key</span>
      <code class="the-key">{shownKey}</code>
      <p class="warn-text">Save it now: a password manager, a photo, or written down. It is shown only once, and it is the only way into your account unless you add an email.</p>
      <div class="row wrap">
        <button class="btn btn-ghost" onclick={copyKey}><Icon name="copy" size={18} /> Copy key</button>
      </div>
      <label class="option"><input type="checkbox" bind:checked={saved} /><span><strong>I saved my key</strong></span></label>
      <button class="btn btn-primary" disabled={!saved} onclick={() => (shownKey = '')}>Continue</button>
    </section>
  {:else if account.user && account.recovering}
    <!-- Opened from the "forgot key" email -->
    <section class="card stack">
      <h2 class="section-title">Get a new key</h2>
      <p class="muted">You're signed in from your recovery email. Get a new key to use from now on.</p>
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <button class="btn btn-primary" disabled={busy} onclick={() => run(async () => showKey(await account.replaceKey()))}>Get my new key</button>
    </section>
  {:else if account.user && account.profile}
    <!-- Signed in -->
    <section class="card stack">
      <div class="row between wrap">
        <div>
          <span class="label">Signed in as</span>
          <h2>{account.profile.display_name}</h2>
        </div>
        <button class="btn btn-small btn-ghost" disabled={busy} onclick={() => run(() => account.signOut())}>Sign out</button>
      </div>
      <div class="player-code">
        <!-- The QR is a link: the manager's Scan button or phone camera checks you in -->
        <QrCode text="{location.origin}{resolve('/openplay')}?code={account.profile.player_code}" label="Player code {account.profile.player_code}" />
        <div class="stack tight">
          <span class="label">Player code</span>
          <strong>{account.profile.player_code}</strong>
          <span class="hint">Show this to the manager at check-in: they scan the QR or type the code. It is safe to share: it cannot open your account. Or join yourself from the lobby.</span>
        </div>
      </div>
    </section>

    <MyGames />

    <section class="card stack quiet">
      <h2 class="section-title">Recovery email</h2>
      {#if account.email}
        <p>Recovery email: <strong>{account.email}</strong></p>
      {:else}
        <p class="muted small">Optional. If you lose your key, we email you a link to get a new one. Without it, a lost key means a lost account.</p>
        {#if account.pendingEmail}
          <p class="notice">Check <strong>{account.pendingEmail}</strong> and click the link to confirm it.</p>
        {/if}
        <form class="row wrap" onsubmit={(e) => { e.preventDefault(); run(async () => { await account.addEmail(emailInput); toast('Check your inbox to confirm the email.', { type: 'success' }); emailInput = ''; }); }}>
          <input class="grow" type="email" bind:value={emailInput} placeholder="you@example.com" autocomplete="email" required aria-label="Email" />
          <button class="btn btn-light" disabled={busy}>Add email</button>
        </form>
      {/if}
    </section>

    <section class="card stack quiet">
      <h2 class="section-title">Key</h2>
      <p class="muted small">Think someone saw your key? Get a new one. The old key stops working right away.</p>
      <button class="btn btn-ghost" disabled={busy} onclick={() => run(async () => showKey(await account.replaceKey()))}>Get a new key</button>
    </section>

    <details class="card fold danger-zone">
      <summary><span class="section-label">Delete my account</span></summary>
      <div class="stack fold-body">
        <p class="muted small">This permanently deletes your account, your key, your player code and your link to every game. Other players keep their own past games, with your name as it was written on the day. This cannot be undone.</p>
        <label>Type <strong>DELETE</strong> to confirm
          <input bind:value={confirmDelete} autocomplete="off" autocapitalize="characters" spellcheck="false" />
        </label>
        <button
          class="btn btn-danger"
          disabled={busy || confirmDelete.trim().toUpperCase() !== 'DELETE'}
          onclick={() => run(async () => { await account.deleteAccount(); confirmDelete = ''; toast('Your account was deleted.', { type: 'success' }); })}
        >Delete my account forever</button>
      </div>
    </details>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  {:else if account.user}
    <p class="muted">Loading your profile…</p>
  {:else}
    <!-- Signed out -->
    <section class="card stack account-entry">
      <div class="segmented" role="tablist" aria-label="Account">
        <button role="tab" aria-selected={tab === 'new'} class={[tab === 'new' && 'on']} onclick={() => { tab = 'new'; error = ''; }}>New here</button>
        <button role="tab" aria-selected={tab === 'key'} class={[tab === 'key' && 'on']} onclick={() => { tab = 'key'; error = ''; }}>I have a key</button>
      </div>
      {#if tab === 'new'}
        <form class="stack" onsubmit={(e) => { e.preventDefault(); run(async () => showKey(await account.create(name))); }}>
          <label>Your name <input bind:value={name} maxlength="40" placeholder="As players know you" autocomplete="nickname" required /></label>
          <button class="btn btn-primary btn-big" disabled={busy}>Create my account</button>
          <span class="hint">You get a key to save. No email or password needed.</span>
        </form>
      {:else if !forgot}
          <form class="stack" onsubmit={(e) => { e.preventDefault(); run(async () => { await account.signIn(keyInput); keyInput = ''; toast('Signed in.', { type: 'success' }); }); }}>
            <label>Your key <input bind:value={keyInput} placeholder="ABCD-EFGH-JKMN-PQRS" autocomplete="current-password" autocapitalize="characters" spellcheck="false" required /></label>
            <button class="btn btn-primary btn-big" disabled={busy}>Sign in</button>
          </form>
          <button class="link-btn" onclick={() => (forgot = true)}>Forgot your key?</button>
        {:else}
          <form class="stack" onsubmit={(e) => { e.preventDefault(); run(async () => { await account.sendRecovery(recoveryEmail, location.origin + resolve('/account')); toast('If that email is on an account, a link is on its way.', { type: 'success', ms: 6000 }); forgot = false; }); }}>
            <label>Recovery email <input type="email" bind:value={recoveryEmail} autocomplete="email" required /></label>
            <span class="hint">Works only if you added an email to your account.</span>
            <button class="btn btn-primary" disabled={busy}>Email me a link</button>
          </form>
          <button class="link-btn" onclick={() => (forgot = false)}>Back to sign in</button>
      {/if}
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    </section>
  {/if}
</section>
