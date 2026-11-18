<script>
  // A QR code for any text (usually a link). Drawn as SVG, so it stays sharp at any size.
  import qrcode from 'qrcode-generator';

  let { text, label } = $props();

  const svg = $derived.by(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true, alt: label });
  });
</script>

<!-- Safe: the SVG is generated from our own text, never from raw user HTML. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<div class="qr">{@html svg}</div>
