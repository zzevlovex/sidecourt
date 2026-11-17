// Scoreboard page. Works on its own, or for a court in an open play session
// when opened as scoreboard.html?court=1
import { newMatch, rally, undo, winner, callText, isGamePoint, serviceCourt } from './scoring.js';
import { endGame, upcoming, waitingCount } from './queue.js';
import { load, save, remove, esc, SESSION_KEY, matchKey, courtMatch } from './storage.js';
import { toast } from './toast.js';

const app = document.getElementById('app');
const courtId = Number(new URLSearchParams(location.search).get('court')) || null;
const key = matchKey(courtId);

let session = null;
let match = null;
let shown = null; // scores on screen last render, so only a changed score animates

// Load the saved match. For a court in open play, the saved score for that
// court's current game is kept; a new game on the court starts at 0–0.
function loadMatch() {
  match = load(key);
  if (!courtId) return;
  session = load(SESSION_KEY);
  const court = session ? session.courts.find((c) => c.id === courtId) : null;
  if (!court || court.teams.length !== 2) {
    match = null;
    return;
  }
  match = courtMatch(court);
  if (!match) {
    const names = { a: court.teams[0].p.join(' / '), b: court.teams[1].p.join(' / ') };
    match = { ...newMatch({ sport: session.sport, doubles: true, names }), game: court.game };
    save(key, match);
  }
}
loadMatch();

function setMatch(next) {
  match = next;
  if (match) save(key, match);
  else remove(key);
  render();
}

const other = (side) => (side === 'a' ? 'b' : 'a');
const isBadminton = () => match.sport === 'badminton';

/* ---------- Keep the screen awake while scoring ---------- */

let wakeLock = null;
async function keepAwake() {
  if (!match || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    // Not allowed (battery saver, old browser): scoring still works.
  }
}
document.addEventListener('visibilitychange', keepAwake);

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

/* ---------- Views ---------- */

function setupView() {
  return `
    <section class="card narrow pop">
      <p class="eyebrow">Scoreboard</p>
      <h1>New match</h1>
      <form id="setup" class="stack">
        <fieldset class="choice">
          <legend>Sport</legend>
          <div class="segmented">
            <label class="seg"><input type="radio" name="sport" value="pickleball" checked><span>Pickleball</span></label>
            <label class="seg"><input type="radio" name="sport" value="badminton"><span>Badminton</span></label>
          </div>
        </fieldset>
        <fieldset class="choice">
          <legend>Format</legend>
          <div class="segmented">
            <label class="seg"><input type="radio" name="format" value="doubles" checked><span>Doubles</span></label>
            <label class="seg"><input type="radio" name="format" value="singles"><span>Singles</span></label>
          </div>
        </fieldset>
        <label class="team-input a">Side A <input name="a" placeholder="e.g. Reyes / Santos" autocomplete="off" required></label>
        <label class="team-input b">Side B <input name="b" placeholder="e.g. Cruz / Lim" autocomplete="off" required></label>
        <fieldset class="choice" id="target-field">
          <legend>Play to</legend>
          <div class="segmented three">
            <label class="seg"><input type="radio" name="target" value="11" checked><span>11</span></label>
            <label class="seg"><input type="radio" name="target" value="15"><span>15</span></label>
            <label class="seg"><input type="radio" name="target" value="21"><span>21</span></label>
          </div>
          <span class="hint">Win by 2. Side A serves first.</span>
        </fieldset>
        <p class="hint" id="badminton-rules" hidden>Rally scoring to 21, win by 2, capped at 30, best of three games. Side A serves first.</p>
        <button class="btn btn-primary btn-big" type="submit">Start match</button>
      </form>
    </section>`;
}

function serveLine() {
  const name = esc(match.names[match.serving]);
  if (isBadminton()) return `<strong>${name}</strong> serving from the ${serviceCourt(match)} court`;
  if (match.doubles) return `<strong>${name}</strong> serving · Server ${match.server}`;
  return `<strong>${name}</strong> serving`;
}

function callBar(won) {
  if (won) return '';
  const point = isGamePoint(match);
  const matchPoint = point && isBadminton() && Math.max(match.games.a, match.games.b) === Math.ceil(match.bestOf / 2) - 1;
  const parts = callText(match).split(' – ');
  const labels = isBadminton() || !match.doubles ? ['Server', 'Receiver'] : ['Server', 'Receiver', 'Server #'];
  return `
    <section class="call-bar ${point ? 'point' : ''}" aria-live="polite">
      <div class="call-top">
        <span class="label">Score call</span>
        ${point ? `<span class="point-pill">${matchPoint ? 'Match point' : 'Game point'}</span>` : ''}
        <button class="icon-btn small" data-action="speak" aria-label="Read the score out loud" title="Read the score out loud">🔊</button>
      </div>
      <div class="call" aria-label="Score call ${parts.join(', ')}">
        ${parts.map((n, i) => `<span class="call-part"><span class="call-num ${i === 0 ? 'srv-' + match.serving : i === 1 ? 'srv-' + other(match.serving) : ''}">${n}</span><span class="call-label">${labels[i]}</span></span>`).join('<span class="call-dash">–</span>')}
      </div>
      <p class="serve-line">${serveLine()}</p>
    </section>`;
}

function gamesDots(side) {
  if (!isBadminton()) return '';
  const needed = Math.ceil(match.bestOf / 2);
  return `<span class="games" aria-label="${match.games[side]} games won">${Array.from({ length: needed }, (_, i) => `<span class="dot ${i < match.games[side] ? 'on' : ''}"></span>`).join('')}<span class="small">Games</span></span>`;
}

function sideButton(side, won) {
  const serving = match.serving === side && !won;
  const changed = shown && shown[side] !== match[side];
  const status = won
    ? (won === side ? '🏆 Winner' : '')
    : serving ? (isBadminton() ? `Serving · ${serviceCourt(match)}` : match.doubles ? `Serving · Server ${match.server}` : 'Serving') : 'Receiving';
  return `
    <button class="side ${side} ${serving ? 'serving' : ''} ${won === side ? 'won' : ''}" data-side="${side}" ${won ? 'disabled' : ''}
      aria-label="${esc(match.names[side])}: ${match[side]}. Tap if they won the rally.">
      <span class="side-info">
        <span class="side-name">${esc(match.names[side])}</span>
        <span class="side-status">${serving ? '<span class="ball" aria-hidden="true"></span>' : ''}${status}</span>
        ${gamesDots(side)}
      </span>
      <span class="score ${changed ? 'bump' : ''}">${match[side]}</span>
      ${won ? '' : '<span class="tap-hint">Tap if they won the rally</span>'}
    </button>`;
}

// Who goes on next, from the open play line. Kept small at the bottom so it
// never competes with the score. Only for a court in a session.
function nextUp() {
  if (!courtId || !session) return '';
  const [teams] = upcoming(session, 1);
  if (!teams) {
    const need = 4 - waitingCount(session);
    return `<p class="next-up"><span class="label">Next game</span> <span>${need >= 4 ? 'Nobody waiting' : `Needs ${need} more player${need === 1 ? '' : 's'}`}</span></p>`;
  }
  const team = (t) => `<span class="nu-team">${esc(t.p.join(' & '))}</span>`;
  return `<p class="next-up"><span class="label">Next game</span> <span>${team(teams[0])} <span class="vs-small">vs</span> ${team(teams[1])}</span></p>`;
}

function boardView() {
  const won = winner(match);
  const title = courtId ? `Court ${courtId}` : isBadminton() ? 'Badminton' : 'Pickleball';
  const rules = isBadminton() ? 'Best of 3 · To 21 · Cap 30' : `${match.doubles ? 'Doubles' : 'Singles'} · To ${match.target} · Win by 2`;
  const previous = isBadminton() && match.finished.length
    ? `<p class="muted center small">Finished games: ${match.finished.map((g, i) => `<strong>G${i + 1}</strong> ${g.a}–${g.b}`).join(' · ')}</p>` : '';
  const finalScore = isBadminton() ? `${match.games.a}–${match.games.b} in games` : `${match.a}–${match.b}`;
  const winCard = won ? `
    <section class="win-card pop">
      <span class="trophy" aria-hidden="true">🏆</span>
      <div class="grow">
        <span class="label">${isBadminton() ? 'Match' : 'Game'} over · ${finalScore}</span>
        <h2>${esc(match.names[won])} win!</h2>
      </div>
      ${courtId
        ? '<button class="btn btn-dark btn-big" data-action="finish">Save result &amp; call next</button>'
        : '<button class="btn btn-dark btn-big" data-action="new">New match</button>'}
    </section>` : '';

  return `
    <section class="board">
      <header class="board-head">
        <a class="btn btn-ghost btn-small" data-action="back" href="${courtId ? `openplay.html?scored=${courtId}` : 'index.html'}">← ${courtId ? 'Board' : 'Home'}</a>
        <div class="center"><h1>${title}</h1><p class="muted small">${rules}</p></div>
        <span class="head-spacer"></span>
      </header>
      ${winCard}
      ${callBar(won)}
      <div class="sides">${sideButton('a', won)}${sideButton('b', won)}</div>
      ${previous}
      <p class="muted center small keys">Keyboard: <kbd>A</kbd> or <kbd>←</kbd> side A · <kbd>B</kbd> or <kbd>→</kbd> side B · <kbd>U</kbd> undo</p>
      <div class="controls">
        <button class="btn btn-light btn-big" data-action="undo" ${match.history.length ? '' : 'disabled'}>↶ Undo</button>
        <button class="btn btn-ghost" data-action="restart" ${match.history.length ? '' : 'disabled'}>Restart</button>
        ${courtId ? '' : '<button class="btn btn-ghost" data-action="new">New match</button>'}
      </div>
      ${nextUp()}
    </section>`;
}

function render() {
  if (courtId && !match) {
    app.innerHTML = `<section class="card narrow pop"><h1>Court ${courtId} is open</h1>
      <p class="muted">No game is running on this court yet.</p>
      <a class="btn btn-primary" href="openplay.html">Back to the board</a></section>`;
    return;
  }
  app.innerHTML = match ? boardView() : setupView();
  shown = match ? { a: match.a, b: match.b } : null;
  if (match) keepAwake();
}

/* ---------- Actions ---------- */

// Point, side out, second server, game won: say what happened so nobody has to work it out.
function scoreRally(side) {
  const before = match;
  const next = rally(match, side);
  if (next === before) return;
  navigator.vibrate?.(12);
  setMatch(next);

  const won = winner(next);
  if (won) {
    toast(`${next.names[won]} win${isBadminton() ? ' the match' : ''}!`, { type: 'success', key: 'rally' });
    return;
  }
  if (isBadminton()) {
    if (next.finished.length > before.finished.length) {
      const g = next.finished[next.finished.length - 1];
      toast(`Game ${next.finished.length} to ${next.names[side]} (${g.a}–${g.b}). Next game starts at 0–0.`, { type: 'success', key: 'rally', ms: 5000 });
    } else if (next.serving !== before.serving) {
      toast(`Service over. ${next.names[next.serving]} serve.`, { key: 'rally', ms: 2200 });
    }
    return;
  }
  if (next.serving !== before.serving) toast(`Side out. ${next.names[next.serving]} serve.`, { key: 'rally', ms: 2200 });
  else if (next.server !== before.server) toast('Second server.', { key: 'rally', ms: 2000 });
}

function doUndo() {
  if (!match.history.length) return;
  setMatch(undo(match));
  toast('Last rally undone.', { key: 'rally', ms: 1600 });
}

app.addEventListener('click', (event) => {
  const sideEl = event.target.closest('[data-side]');
  if (sideEl) return scoreRally(sideEl.dataset.side);

  const actionEl = event.target.closest('[data-action]');
  if (!actionEl || actionEl.disabled) return;
  const action = actionEl.dataset.action;
  const before = match;
  if (action === 'back') {
    if (match) save(key, match);
    return; // the link does the navigation
  }
  if (action === 'undo') doUndo();
  if (action === 'speak') speak(isBadminton() ? `${match[match.serving]}, ${match[other(match.serving)]}` : callText(match).replaceAll('–', ','));
  if (action === 'restart') {
    setMatch({ ...newMatch(match), game: match.game });
    toast('Score reset to 0–0.', { onUndo: () => setMatch(before) });
  }
  if (action === 'new') {
    setMatch(null);
    if (!winner(before)) toast('Match cleared.', { onUndo: () => setMatch(before) });
  }
  if (action === 'finish') {
    // Send the result to the open play board and call the next four players.
    const score = isBadminton() ? { a: match.games.a, b: match.games.b } : { a: match.a, b: match.b };
    session = endGame(load(SESSION_KEY), courtId, score);
    save(SESSION_KEY, session);
    remove(key);
    location.href = `openplay.html?finished=${courtId}`;
  }
});

document.addEventListener('keydown', (event) => {
  if (!match || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest('input, select, textarea')) return;
  const k = event.key.toLowerCase();
  if (k === 'a' || k === 'arrowleft') scoreRally('a');
  else if (k === 'b' || k === 'arrowright') scoreRally('b');
  else if (k === 'u' || k === 'backspace') doUndo();
  else return;
  event.preventDefault();
});

// Setup: "Play to" only applies to pickleball.
app.addEventListener('change', (event) => {
  if (event.target.name !== 'sport') return;
  const badminton = event.target.value === 'badminton';
  document.getElementById('target-field').hidden = badminton;
  document.getElementById('badminton-rules').hidden = !badminton;
});

app.addEventListener('submit', (event) => {
  if (event.target.id !== 'setup') return;
  event.preventDefault();
  const form = new FormData(event.target);
  setMatch(newMatch({
    sport: form.get('sport'),
    doubles: form.get('format') === 'doubles',
    target: form.get('sport') === 'pickleball' ? Number(form.get('target')) : undefined,
    names: { a: form.get('a').trim(), b: form.get('b').trim() },
  }));
  toast('Match started. Tap a side each time it wins a rally.', { type: 'success' });
});

render();

// The browser's back/forward buttons can restore an old copy of this page.
// Reload from storage so it shows the latest score and line.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  loadMatch();
  render();
});
// Another tab changed the line or this court's score: show the latest.
window.addEventListener('storage', (event) => {
  if (event.key !== SESSION_KEY && event.key !== key) return;
  loadMatch();
  render();
});
// Keep the latest score even if the page is closed or the phone switches apps.
window.addEventListener('pagehide', () => { if (match) save(key, match); });
