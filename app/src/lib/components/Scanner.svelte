<script>
  // Scans a QR code with the camera. Uses the browser's built-in BarcodeDetector
  // (Chrome on Android, and others), so no extra library. Where it is missing,
  // the Scan button is hidden and people type the code instead.
  import Modal from './Modal.svelte';
  import { codeFrom } from '$lib/logic/lobby.js';

  let { onscan, onclose } = $props();
  let video = $state();
  let problem = $state('');

  $effect(() => {
    let stream;
    let stopped = false;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

    async function loop() {
      if (stopped) return;
      try {
        for (const found of await detector.detect(video)) {
          const code = codeFrom(found.rawValue);
          if (code) {
            stopped = true;
            onscan(code);
            return;
          }
        }
      } catch {
        // frame not ready yet: try the next one
      }
      setTimeout(loop, 250);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        video.srcObject = s;
        video.play().then(loop).catch(() => {});
      })
      .catch(() => (problem = 'Camera not available. Allow camera access, or type the code instead.'));

    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  });
</script>

<Modal {onclose} labelledby="scan-title">
  <div class="stack">
    <h2 id="scan-title">Scan player code</h2>
    {#if problem}
      <p class="form-error">{problem}</p>
    {:else}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} class="scan-video" playsinline muted></video>
      <p class="hint">Point the camera at the QR code on the player's Account page.</p>
    {/if}
    <button class="btn btn-ghost" type="button" onclick={onclose}>Cancel</button>
  </div>
</Modal>
