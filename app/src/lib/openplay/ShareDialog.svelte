<script>
  // Share cards for the final standings: pick a card, a shape and a background,
  // see it, then download the PNG or send it to the phone's share sheet.
  import Modal from '$lib/components/Modal.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { toast } from '$lib/toasts.svelte.js';
  import { shareCards } from '$lib/logic/shareCard.js';
  import { svgUrl, cardToPng, saveFiles, canShareFiles } from '$lib/sharePng.js';

  let { summary, onclose } = $props();

  let orientation = $state('portrait');
  let background = $state('dark');
  let picked = $state('overall');
  let busy = $state(false);

  const cards = $derived(shareCards(summary, { site: location.host, orientation, background }));
  const card = $derived(cards.find((c) => c.id === picked) ?? cards[0]);
  const shareable = canShareFiles();

  async function run(action) {
    busy = true;
    try {
      await action();
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (error?.name !== 'AbortError') toast('Could not make the image. Try again.', { type: 'warn' });
    } finally {
      busy = false;
    }
  }

  const save = () => run(async () => {
    if ((await saveFiles([await cardToPng(card)])) === 'saved') toast(`Saved ${card.file}`, { type: 'success' });
  });

  const saveAll = () => run(async () => {
    const files = [];
    for (const c of cards) files.push(await cardToPng(c));
    if ((await saveFiles(files)) === 'saved') toast(`Saved ${cards.length} images.`, { type: 'success' });
  });

  const share = () => run(async () => {
    await navigator.share({ files: [await cardToPng(card)], title: summary.name });
  });
</script>

<Modal {onclose} labelledby="share-title">
  <div class="stack share">
    <div>
      <p class="eyebrow">Share</p>
      <h2 id="share-title">Standings cards</h2>
    </div>

    <!-- Which card -->
    <div class="segmented share-cards" role="tablist" aria-label="Card">
      {#each cards as c, i (c.id)}
        <button role="tab" aria-selected={c.id === card.id} class={[c.id === card.id && 'on']} onclick={() => (picked = c.id)}>
          {i === 0 ? 'Overall' : `Top ${i}`}
        </button>
      {/each}
    </div>

    <!-- The real image, scaled down. The checker pattern means "see-through". -->
    <div class={['share-preview', orientation, background === 'transparent' && 'checker']}>
      <img src={svgUrl(card.svg)} alt="Preview of the {card.title} card" width={card.width} height={card.height} />
    </div>

    <div class="share-options">
      <div class="stack tight">
        <span class="label">Shape</span>
        <div class="segmented" role="group" aria-label="Shape">
          <button class={[orientation === 'portrait' && 'on']} aria-pressed={orientation === 'portrait'} onclick={() => (orientation = 'portrait')}>Story</button>
          <button class={[orientation === 'landscape' && 'on']} aria-pressed={orientation === 'landscape'} onclick={() => (orientation = 'landscape')}>Landscape</button>
        </div>
      </div>
      <div class="stack tight">
        <span class="label">Background</span>
        <div class="segmented" role="group" aria-label="Background">
          <button class={[background === 'dark' && 'on']} aria-pressed={background === 'dark'} onclick={() => (background = 'dark')}>Dark</button>
          <button class={[background === 'transparent' && 'on']} aria-pressed={background === 'transparent'} onclick={() => (background = 'transparent')}>See-through</button>
        </div>
      </div>
    </div>
    <p class="hint">
      {orientation === 'portrait' ? 'Instagram story size' : 'Landscape, 16:9'} · {card.width} × {card.height} px.
      {background === 'transparent'
        ? 'See-through: text only on a transparent image. Lay it over your own photo in your editor or story.'
        : 'The middle is left empty so you can add a photo on top.'}
    </p>

    <div class="row wrap end-actions">
      <button class="btn btn-primary grow" type="button" disabled={busy} onclick={save}><Icon name="download" size={18} /> Download PNG</button>
      {#if shareable}
        <button class="btn btn-light" type="button" disabled={busy} onclick={share}><Icon name="share" size={18} /> Share</button>
      {/if}
    </div>
    <div class="row between wrap">
      <button class="link-btn" type="button" disabled={busy} onclick={saveAll}>Download all {cards.length}</button>
      <button class="btn btn-small btn-ghost" type="button" onclick={onclose}>Close</button>
    </div>
  </div>
</Modal>
