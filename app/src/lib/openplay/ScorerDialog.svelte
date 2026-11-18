<script>
  // The link and QR that let another phone keep score for one court.
  import Icon from '$lib/components/Icon.svelte';
  import { resolve } from '$app/paths';
  import Modal from '$lib/components/Modal.svelte';
  import QrCode from '$lib/components/QrCode.svelte';
  import { toast } from '$lib/toasts.svelte.js';

  let { code, court, key, onclose } = $props();

  const link = $derived(`${location.origin}${resolve('/scoreboard')}?lobby=${code}&court=${court}&key=${key}`);

  function share() {
    if (navigator.share) {
      navigator.share({ title: `Sidecourt: score Court ${court}`, text: `Keep score for Court ${court}`, url: link }).catch(() => {});
      return;
    }
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
      .then(() => toast('Scoring link copied.', { type: 'success' }))
      .catch(() => toast('Could not copy on this browser.', { type: 'warn' }));
  }
</script>

<Modal {onclose} labelledby="scorer-title">
  <div class="stack center-col">
    <div>
      <p class="eyebrow">Court {court}</p>
      <h2 id="scorer-title">Scan to keep score</h2>
    </div>
    <QrCode text={link} label="Scoring link for Court {court}" />
    <p class="hint">Someone at Court {court} scans this with their phone camera. They get this court's scoreboard only, with no account needed, and every tap shows on your board. The link works for every game on this court until open play ends. You still tap <strong>Finish game</strong>.</p>
    <div class="row wrap end-actions">
      <button class="btn btn-ghost" type="button" onclick={onclose}>Close</button>
      <button class="btn btn-primary grow" type="button" onclick={share}><Icon name={navigator.share ? 'share' : 'copy'} size={18} /> {navigator.share ? 'Share link' : 'Copy link'}</button>
    </div>
  </div>
</Modal>
