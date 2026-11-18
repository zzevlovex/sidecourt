<script>
  // New single match (not part of open play).
  import { defaultFormat } from '#lib/logic/scoring.js';
  import FormatFields from '#lib/openplay/FormatFields.svelte';

  let { onstart } = $props();

  let sport = $state('pickleball');
  let format = $state('doubles');
  let formats = $state({ pickleball: defaultFormat('pickleball'), badminton: { target: 21, bestOf: 3 } });
  let a = $state('');
  let b = $state('');

  function submit(event) {
    event.preventDefault();
    onstart({
      sport,
      doubles: format === 'doubles',
      ...$state.snapshot(formats[sport]),
      names: { a: a.trim(), b: b.trim() },
    });
  }
</script>

<section class="card narrow pop">
  <p class="eyebrow">Scoreboard</p>
  <h1>New match</h1>
  <form class="stack" onsubmit={submit}>
    <fieldset class="choice">
      <legend>Sport</legend>
      <div class="segmented">
        <label class="seg"><input type="radio" value="pickleball" bind:group={sport} /><span>Pickleball</span></label>
        <label class="seg"><input type="radio" value="badminton" bind:group={sport} /><span>Badminton</span></label>
      </div>
    </fieldset>
    <fieldset class="choice">
      <legend>Format</legend>
      <div class="segmented">
        <label class="seg"><input type="radio" value="doubles" bind:group={format} /><span>Doubles</span></label>
        <label class="seg"><input type="radio" value="singles" bind:group={format} /><span>Singles</span></label>
      </div>
    </fieldset>
    <label class="team-input a">Side A <input bind:value={a} placeholder="e.g. Reyes / Santos" autocomplete="off" required /></label>
    <label class="team-input b">Side B <input bind:value={b} placeholder="e.g. Cruz / Lim" autocomplete="off" required /></label>
    <FormatFields {sport} value={formats[sport]} onchange={(v) => (formats[sport] = v)} idPrefix="match" />
    <p class="hint">Win by 2. Side A serves first.</p>
    <button class="btn btn-primary btn-big" type="submit">Start match</button>
  </form>
</section>
