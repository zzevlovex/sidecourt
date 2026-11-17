<script>
  import Icon from '$lib/components/Icon.svelte';
  // The lobby code and QR players scan to follow open play and join the line.
  import { resolve } from '$app/paths';
  import Modal from '$lib/components/Modal.svelte';
  import QrCode from '$lib/components/QrCode.svelte';
  import { toast } from '$lib/toasts.svelte.js';

  let { code, onclose } = $props();

  const link = $derived(`${location.origin}${resolve('/lobby')}?code=${code}`);

  function share() {
    if (navigator.share) {
      navigator.share({ title: 'Sidecourt open play', text: `Join open play with lobby code ${code}`, url: link }).catch(() => {});
      return;
    }
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
      .then(() => toast('Lobby link copied.', { type: 'success' }))
      .catch(() => toast('Could not copy on this browser.', { type: 'warn' }));
  }
</script>

<Modal {onclose} labelledby="lobby-title">
  <div class="stack center-col">
    <div>
      <p class="eyebrow">Open play lobby</p>
      <h2 id="lobby-title">Players scan to join</h2>
    </div>
    <QrCode text={link} label="Lobby {code}" />
    <div>
      <span class="label">Lobby code</span>
      <p class="big-code">{code}</p>
    </div>
    <p class="hint">Players open the camera and scan, or go to Sidecourt, then <strong>Join open play</strong>, and type the code. They see the courts, who's next and their place in line, and can tap <strong>Join the line</strong>.</p>
    <div class="row wrap end-actions">
      <button class="btn btn-ghost" type="button" onclick={onclose}>Close</button>
      <button class="btn btn-primary grow" type="button" onclick={share}><Icon name={navigator.share ? 'share' : 'copy'} size={18} /> {navigator.share ? 'Share link' : 'Copy link'}</button>
    </div>
  </div>
</Modal>
