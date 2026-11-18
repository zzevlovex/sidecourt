<script>
  // Terms of use and privacy, in plain language. Keep this in step with what the app really does.
  import { resolve } from '$app/paths';
</script>

<svelte:head><title>Terms and privacy · Sidecourt</title></svelte:head>

<article class="legal">
  <header>
    <p class="eyebrow">Last updated November 18, 2026</p>
    <h1>Terms and privacy</h1>
    <p class="muted">By using Sidecourt, you agree to these terms. They explain the rules for using the app and what happens to your information.</p>
  </header>

  <section>
    <h2>Using Sidecourt</h2>
    <p>Sidecourt is a free tool for keeping score and running open play for pickleball and badminton. You can use much of it without an account.</p>
    <p>If you are a minor, ask a parent or guardian before creating an account.</p>
  </section>

  <section>
    <h2>Your account key</h2>
    <p>Your key is your login. Anyone who has it can open your account, so keep it private. If you lose it and have not added a recovery email, we cannot get your account back.</p>
    <p>Your player code is different. It is meant to be shown to managers, and it lets them check you in and save games to your history. If a game or session is not yours, tap <strong>Not me</strong> in your history. This removes everything from that host and stops them adding you by code.</p>
  </section>

  <section>
    <h2>Fair use</h2>
    <p>Please do not:</p>
    <ul>
      <li>try to break into the app, its database, or anyone's account;</li>
      <li>add false games or results to other people's history;</li>
      <li>flood the app with automated requests or data;</li>
      <li>use names or session titles that harass, threaten or impersonate someone.</li>
    </ul>
    <p>Accounts or content that break these rules may be removed.</p>
  </section>

  <section>
    <h2>Other people's names</h2>
    <p>Managers type players' names to run a session. Only add people who are taking part, and use a name they are comfortable having shown to the group. Names can appear in the lobby, in standings and on share photos.</p>
  </section>

  <section>
    <h2>What we store</h2>
    <ul>
      <li><strong>With an account:</strong> your display name, player code, the games and open play sessions linked to you, and your recovery email if you add one. Your key is stored only in scrambled (hashed) form, along with a short lookup code made from it so you can sign in. Accounts created before November 18, 2026 are updated to this the next time they sign in.</li>
      <li><strong>During open play:</strong> the session name, location, courts, player names, waiting line and scores, so the lobby and scorer links work. If the manager is signed in, a private copy is kept so they can resume the session on another device.</li>
      <li><strong>On your device only:</strong> the current session, past player names, saved groups and any account links a manager has made. Clearing your browser data removes them.</li>
    </ul>
    <p>We do not sell your information or show ads.</p>
  </section>

  <section>
    <h2>Who can see it</h2>
    <ul>
      <li>Anyone with a lobby code can see that lobby, including player names and scores, until two days after its last change.</li>
      <li>Your history is visible to you. The host who saved a game or session can also see it, and so can the other players linked to it.</li>
      <li>Share photos are only made when someone chooses to, and include names, results and any location. What happens after they are shared is up to the person sharing them.</li>
    </ul>
  </section>

  <section>
    <h2>Services we rely on</h2>
    <p>Accounts and online data are handled by Supabase. The website is hosted by Cloudflare. These services receive technical information such as your IP address when your device connects to them.</p>
    <p>If the app crashes, it records the error message and the page it happened on, for up to 30 days, so we can fix it. This does not include your key or scorer links.</p>
  </section>

  <section>
    <h2>Deleting your account</h2>
    <p>You can delete your account at any time on the <a href={resolve('/account')}>Account page</a>. This removes your profile, key, email, check-ins and the lobbies you ran, and unlinks you from saved games and sessions. Your name can remain as plain text in results other people keep, because it was part of their game.</p>
  </section>

  <section>
    <h2>No guarantees</h2>
    <p>Sidecourt is provided as it is, without warranties. We work to keep it safe and available, but it may have errors or interruptions, and data could be lost. Scores and rankings are for fun and club organization. To the extent the law allows, we are not liable for losses from using the app. Rights you have under the law where you live are not affected.</p>
  </section>

  <section>
    <h2>Changes</h2>
    <p>We may update the app and these terms. When we do, the date at the top changes. Continuing to use Sidecourt means you accept the updated terms.</p>
  </section>
</article>
