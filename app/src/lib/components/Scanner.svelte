<script>
  // Scans a QR code with the camera. Uses the browser's built-in BarcodeDetector
  // where it exists (Chrome on Android). Elsewhere (iPhone, desktop) it loads the
  // small jsQR decoder, only when scanning starts, and reads camera frames itself.
  import Modal from './Modal.svelte';
  import { codeFrom } from '$lib/logic/lobby.js';

  let { onscan, onclose } = $props();
  let video = $state();
  let problem = $state('');

  $effect(() => {
    let stream;
    let stopped = false;
    let read; // () => Promise<string[]>: QR texts seen in the current frame

    async function makeReader() {
      if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async () => (await detector.detect(video)).map((found) => found.rawValue);
      }
      const { default: jsQR } = await import('jsqr');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      return async () => {
        if (!video.videoWidth) return [];
        // Smaller frames decode much faster on phones and are still sharp enough.
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        return found ? [found.data] : [];
      };
    }

    async function loop() {
      if (stopped) return;
      try {
        for (const text of await read()) {
          const code = codeFrom(text);
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
        return Promise.all([video.play(), makeReader()]).then(([, reader]) => {
          read = reader;
          loop();
        });
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
