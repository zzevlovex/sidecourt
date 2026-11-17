// Open play board for the queue manager.
import {
  newSession, addPlayers, hasPlayer, moveUp, removeEntry, setAllowPicks, addCourt,
  fillCourt, endGame, waitingCount, playingCount, upcoming, reshuffle, finishSession, pairUp, splitPair, resultWinner,
} from './queue.js';
import { load, save, remove, esc, SESSION_KEY, matchKey, courtMatch } from './storage.js';
import { winner, callText } from './scoring.js';
import { toast as showToast } from './toast.js';

// Undo puts the earlier session back.
const toast = (text, { undo, ...opts } = {}) => showToast(text, { ...opts, onUndo: undo ? () => setSession(undo) : null });

const HELP_KEY = 'sidecourt.help.hidden';
const SUMMARY_KEY = 'sidecourt.summary'; // final standings of the last session
const showingStandings = () => location.hash === '#standings';
function setStandings(show) {
  history.replaceState(null, '', show ? 'openplay.html#standings' : 'openplay.html');
}
const app = document.getElementById('app');
let session = load(SESSION_KEY);
let summary = load(SUMMARY_KEY);

// Things typed into the page survive a re-render.
const drafts = { scores: {}, names: '', addedBy: '', mode: 'solo' };
// Which optional panels are open. The guide shows until the manager closes it once.
const ui = { help: !load(HELP_KEY), settings: false, results: false, ending: false, countLive: true, pairing: null, finishing: null };
// What was on screen last time, so only the parts that changed animate.
let seen = null;
let flashId = null;
let focusCheckin = false;

function setSession(next) {
  session = next;
  if (session) save(SESSION_KEY, session);
  else remove(SESSION_KEY);
  render();
}

// Reads the names out loud so players do not need to look at a phone.
function announce() {
  if (!session.lastCall || !('speechSynthesis' in window)) return;
  const { court, names } = session.lastCall;
  const speech = new SpeechSynthesisUtterance(`${names.join(', ')}. Court ${court}.`);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
}

/* ---------- Small pieces ---------- */

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const teamNames = (team) => team.p.join(' & ');
const freeCourts = () => session.courts.filter((c) => !c.teams.length);

function teamBox(team, side) {
  return `
    <div class="team ${side}">
      <div class="team-names">${team.p.map((n) => `<strong>${esc(n)}</strong>`).join('')}</div>
      <span class="pill ${team.picked ? 'pill-pair' : 'pill-random'}">${team.picked ? 'Partners' : 'Random pair'}</span>
    </div>`;
}

// ghost: an upcoming game (outlined, not on a court yet) instead of a live one.
function matchup(teams, ghost = false) {
  return `<div class="matchup ${ghost ? 'ghost' : ''}">${teamBox(teams[0], 'a')}<span class="vs">VS</span>${teamBox(teams[1], 'b')}</div>`;
}

function slots(filled) {
  return `<div class="slots" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<span class="slot ${i < filled ? 'on' : ''}"></span>`).join('')}</div>`;
}

/* ---------- Views ---------- */

function setupView() {
  return `
    <section class="card narrow pop">
      <p class="eyebrow">New session</p>
      <h1>Start open play</h1>
      ${summary ? '<button class="btn btn-small btn-ghost" type="button" data-action="show-summary">🏆 See the last standings</button>' : ''}
      <p class="muted">Check players in, and Sidecourt lines them up, builds fair teams and tells you who plays next.</p>
      <form id="create" class="stack">
        <label>Session name <input name="name" placeholder="e.g. Tuesday Night Open Play" required></label>
        <label>Sport
          <select name="sport"><option value="pickleball">Pickleball</option><option value="badminton">Badminton</option></select>
        </label>
        <label>Number of courts <input name="courts" type="number" min="1" max="12" value="2" required>
          <span class="hint">You can add more courts later.</span>
        </label>
        <button class="btn btn-primary" type="submit">Open session</button>
      </form>
    </section>`;
}

function helpStrip() {
  if (!ui.help) return '';
  return `
    <section class="help card area-help">
      <div class="row between"><h3>How open play works</h3><button class="btn btn-small btn-ghost" data-action="hide-help">Got it</button></div>
      <ol class="steps">
        <li><span class="step-n">1</span><span><strong>Check players in.</strong> They join the end of the waiting line.</span></li>
        <li><span class="step-n">2</span><span><strong>Send the next game to a free court.</strong> The top 4 in line play, and you can see the teams first.</span></li>
        <li><span class="step-n">3</span><span><strong>Finish the game.</strong> Those 4 go to the back of the line and the next game is called on that court.</span></li>
      </ol>
    </section>`;
}

// Quiet while every court is busy; becomes the bright call to action when a court is free.
function nextGameCard(games) {
  const free = freeCourts();
  const waiting = waitingCount(session);
  const [next, after] = games;

  if (!next) {
    const need = 4 - waiting;
    return `
      <section class="card next-card quiet area-next" id="next-game">
        <div class="row between"><span class="section-label">Next game</span>${slots(waiting)}</div>
        <p class="muted small">${waiting === 0 ? 'Nobody is waiting yet.' : `${plural(waiting, 'player')} waiting.`}
          Check in <strong>${plural(need, 'more player')}</strong> to make the next game.</p>
      </section>`;
  }

  const anyRandom = next.some((t) => !t.picked);
  const shuffle = anyRandom ? '<button class="btn btn-small btn-ghost" data-action="shuffle" title="Pick new random teammates">⟳ Shuffle</button>' : '';
  const sig = esc(JSON.stringify(next));

  if (!free.length) {
    return `
      <section class="card next-card waiting area-next" id="next-game">
        <div class="row between wrap">
          <span class="section-label">Up next · not on court yet</span>
          <span class="status wait"><span class="wait-dot" aria-hidden="true"></span>Waiting for a free court</span>
        </div>
        <div class="next-matchup compact" data-sig="${sig}">${matchup(next, true)}</div>
        <div class="row wrap between next-foot">
          ${after ? `<span class="after"><span class="label">After that</span> ${esc(teamNames(after[0]))} <span class="vs-small">vs</span> ${esc(teamNames(after[1]))}</span>` : '<span></span>'}
          ${shuffle}
        </div>
      </section>`;
  }

  return `
    <section class="card next-card ready area-next" id="next-game">
      <div class="row between wrap">
        <span class="section-label hot">Up next · ready to send</span>
        <span class="status go">${plural(free.length, 'court')} free</span>
      </div>
      <div class="next-matchup" data-sig="${sig}">${matchup(next, true)}</div>
      <div class="row wrap">
        ${free.map((c, i) => `<button class="btn ${i === 0 ? 'btn-primary btn-grow' : 'btn-ghost'}" data-action="fill" data-court="${c.id}">Send to Court ${c.id}</button>`).join('')}
        ${shuffle}
      </div>
      ${after ? `<p class="muted small">After that: ${esc(teamNames(after[0]))} vs ${esc(teamNames(after[1]))}</p>` : ''}
    </section>`;
}

// Score kept on the scoreboard for the game on this court (null if none yet).
// final is what gets saved: points for pickleball, games won for badminton.
function liveScore(court) {
  const match = courtMatch(court);
  if (!match || !match.history.length) return null;
  const final = match.sport === 'badminton' ? { a: match.games.a, b: match.games.b } : { a: match.a, b: match.b };
  return { match, final };
}

function courtCard(court, ready) {
  if (!court.teams.length) {
    return `
      <article class="card court free ${ready ? 'ready' : ''}" data-court-card="${court.id}">
        <div class="row between"><h3 class="court-name">Court ${court.id}</h3><span class="status go">Free</span></div>
        <p class="muted small">${ready ? 'The next game is ready to go on.' : 'Waiting for 4 players in the line.'}</p>
        <button class="btn ${ready ? 'btn-primary' : 'btn-ghost'}" data-action="fill" data-court="${court.id}" ${ready ? '' : 'disabled'}>Send next game here</button>
      </article>`;
  }
  const d = drafts.scores[court.id] || {};
  const live = liveScore(court);
  const [a, b] = court.teams;
  const done = live && winner(live.match);
  const liveLine = live ? `
      <div class="live-score ${done ? 'done' : ''}">
        <span class="label">${done ? 'Final from scoreboard' : 'Live from scoreboard'}</span>
        <span class="live-nums"><span class="srv-a">${live.match.a}</span><span class="muted">–</span><span class="srv-b">${live.match.b}</span></span>
        <span class="muted small">${done
          ? `${esc(live.match.names[done])} won. Tap Finish game to save it.`
          : live.match.sport === 'badminton'
            ? `Games ${live.match.games.a}–${live.match.games.b} · ${esc(live.match.names[live.match.serving])} serving`
            : `Call ${callText(live.match)} · ${esc(live.match.names[live.match.serving])} serving`}</span>
      </div>` : '';
  const val = (side) => esc(d[side] ?? (live ? live.final[side] : ''));
  return `
    <article class="card court playing" data-court-card="${court.id}">
      <div class="row between"><h3 class="court-name">Court ${court.id}</h3><span class="status live"><span class="live-dot" aria-hidden="true"></span>Live · Game ${court.game}</span></div>
      ${matchup(court.teams)}
      ${liveLine}
      <div class="row score-row">
        <label class="grow small">${esc(teamNames(a))}<input type="number" min="0" inputmode="numeric" data-score="${court.id}" data-side="a" value="${val('a')}" placeholder="Score"></label>
        <label class="grow small">${esc(teamNames(b))}<input type="number" min="0" inputmode="numeric" data-score="${court.id}" data-side="b" value="${val('b')}" placeholder="Score"></label>
      </div>
      <div class="row">
        <a class="btn btn-ghost grow" href="scoreboard.html?court=${court.id}">${live ? 'Open scoreboard' : 'Keep score'}</a>
        <button class="btn btn-light grow" data-action="end" data-court="${court.id}">Finish game</button>
      </div>
      <p class="hint">No score? You can just pick who won. Finishing sends these 4 to the back of the line.</p>
    </article>`;
}

function queueItem(entry, index, nextNames, deckNames) {
  const inNext = entry.p.some((n) => nextNames.has(n));
  const inDeck = !inNext && entry.p.some((n) => deckNames.has(n));
  const games = Math.min(...entry.p.map((n) => session.games[n] || 0));
  const details = [
    entry.p.length === 2 ? '🤝 Partners' : 'Random teammate',
    `${plural(games, 'game')} played`,
    entry.addedBy ? `by ${esc(entry.addedBy)}` : '',
  ].filter(Boolean).join(' · ');
  const who = esc(entry.p.join(' and '));
  const solo = entry.p.length === 1;
  const picking = ui.pairing !== null ? session.queue.find((e) => e.id === ui.pairing) : null;
  const solos = session.queue.filter((e) => e.p.length === 1).length;

  // Buttons on the right. While choosing a partner, only the choices are shown.
  let buttons;
  if (picking) {
    if (entry.id === picking.id) buttons = '<button class="pair-btn" data-action="pair-cancel">Cancel</button>';
    else if (solo) buttons = `<button class="pair-btn pick" data-action="pair-with" data-id="${entry.id}">🤝 Pair with ${esc(picking.p[0])}</button>`;
    else buttons = '';
  } else {
    const pairBtn = !session.allowPicks ? ''
      : solo
        ? `<button class="pair-btn" data-action="pair-start" data-id="${entry.id}" ${solos < 2 ? 'disabled title="Nobody else in the line to pair with"' : ''} aria-label="Pair ${who} with someone">🤝 Pair</button>`
        : `<button class="pair-btn" data-action="split" data-id="${entry.id}" aria-label="Split ${who} into random teammates">Split</button>`;
    buttons = `${pairBtn}
      <button class="icon-btn" data-action="up" data-id="${entry.id}" aria-label="Move ${who} up" ${index === 0 ? 'disabled' : ''}>&uarr;</button>
      <button class="icon-btn" data-action="remove" data-id="${entry.id}" aria-label="Remove ${who}">&times;</button>`;
  }

  const classes = ['queue-item', inNext && 'next', inDeck && 'deck', !solo && 'paired',
    seen && !seen.ids.has(entry.id) && 'enter', flashId === entry.id && 'flash',
    picking && entry.id === picking.id && 'picking', picking && entry.id !== picking.id && (solo ? 'pick-target' : 'dim')];
  return `
    <li class="${classes.filter(Boolean).join(' ')}">
      <span class="pos">${index + 1}</span>
      <span class="grow">
        <strong>${esc(entry.p.join(' & '))}</strong>
        ${inNext ? '<span class="badge badge-next">Next game</span>' : ''}${inDeck ? '<span class="badge badge-deck">After that</span>' : ''}
        <span class="tag">${details}</span>
      </span>
      <span class="item-actions">${buttons}</span>
    </li>`;
}

function checkinCard() {
  const pairOk = session.allowPicks;
  const mode = pairOk ? drafts.mode : 'solo';
  return `
    <section class="card stack area-checkin" id="checkin-card">
      <h2 class="section-title">Check in players</h2>
      <form id="checkin" class="stack">
        <label>Names
          <input name="names" value="${esc(drafts.names)}" placeholder="${mode === 'pair' ? 'Two names, e.g. Ana, Ben' : 'One name, or several: Ana, Ben, Cy'}" autocomplete="off" required>
        </label>
        <fieldset class="choice">
          <legend>How do they want to play?</legend>
          <label class="option"><input type="radio" name="mode" value="solo" ${mode === 'solo' ? 'checked' : ''}>
            <span><strong>Random teammate</strong><span class="hint">Each person is paired with someone when their game is called.</span></span></label>
          <label class="option ${pairOk ? '' : 'disabled'}"><input type="radio" name="mode" value="pair" ${mode === 'pair' ? 'checked' : ''} ${pairOk ? '' : 'disabled'}>
            <span><strong>As partners</strong><span class="hint">${pairOk ? 'Exactly 2 names who always play on the same team.' : 'Off: this session is set to random teammates only.'}</span></span></label>
        </fieldset>
        <label>Checked in by (optional)<input name="addedBy" value="${esc(drafts.addedBy)}" placeholder="e.g. a group leader"></label>
        <button class="btn btn-primary" type="submit">Add to line</button>
      </form>
    </section>`;
}

function queueCard(games) {
  const nextNames = new Set((games[0] || []).flatMap((t) => t.p));
  const deckNames = new Set((games[1] || []).flatMap((t) => t.p));
  const items = session.queue.map((entry, i) => queueItem(entry, i, nextNames, deckNames)).join('');
  return `
    <section class="card stack area-line">
      <div class="row between"><h2 class="section-title">Waiting line</h2><span class="count">${waitingCount(session)}</span></div>
      ${ui.pairing !== null && session.queue.some((e) => e.id === ui.pairing)
        ? `<div class="pair-banner"><span>Choose a partner for <strong>${esc(session.queue.find((e) => e.id === ui.pairing).p[0])}</strong></span><button class="btn btn-small btn-ghost" data-action="pair-cancel">Cancel</button></div>`
        : `<p class="muted small">Top of the line plays first. Use &uarr; to move someone up${session.allowPicks ? ', 🤝 Pair to team two players up' : ''}.</p>`}
      <ol class="queue">${items || '<li class="empty-line muted">Nobody is waiting. Check players in above.</li>'}</ol>
    </section>`;
}

function settingsCard() {
  return `
    <details class="card fold area-settings" data-fold="settings" ${ui.settings ? 'open' : ''}>
      <summary><span class="section-label">Session settings</span><span class="muted small">${session.allowPicks ? 'Partners allowed' : 'Random only'} · ${plural(session.courts.length, 'court')}</span></summary>
      <div class="stack fold-body">
        <div class="stack tight">
          <span class="label">Teammates</span>
          <div class="segmented" role="group" aria-label="Teammates">
            <button class="${session.allowPicks ? 'on' : ''}" data-action="allow" aria-pressed="${session.allowPicks}">Players can pick partners</button>
            <button class="${session.allowPicks ? '' : 'on'}" data-action="random" aria-pressed="${!session.allowPicks}">Random only</button>
          </div>
          <p class="hint">${session.allowPicks ? 'Partners checked in together stay together. Everyone else gets a random teammate.' : 'Everyone gets a random teammate, including people who checked in as partners.'}</p>
        </div>
        <div class="row between"><span><span class="label">Courts</span> ${session.courts.length}</span><button class="btn btn-small btn-ghost" data-action="add-court">+ Add a court</button></div>
        <button class="btn btn-small btn-danger" data-action="close">End open play &amp; see rankings</button>
      </div>
    </details>`;
}

function resultRow(r) {
  const w = r.winner ?? resultWinner(r.score);
  const win = w ? (w === 'a' ? 0 : 1) : null;
  const side = (i) => `
    <span class="res-team ${i === 0 ? 'a' : 'b'} ${win === i ? 'won' : ''} ${win !== null && win !== i ? 'lost' : ''}">
      ${win === i ? '<span class="crown" aria-label="Winner">🏆</span>' : ''}${esc(r.teams[i].join(' & '))}
    </span>`;
  return `
    <li class="res-row">
      <span class="res-court">Ct ${r.court}${r.game ? `<span>G${r.game}</span>` : ''}</span>
      <span class="res-teams">${side(0)}<span class="vs-small">vs</span>${side(1)}</span>
      ${r.score
        ? `<span class="res-score"><span class="${win === 0 ? 'hi' : ''}">${r.score.a}</span>–<span class="${win === 1 ? 'hi' : ''}">${r.score.b}</span></span>`
        : `<span class="res-score none">${win !== null ? 'Winner picked<br>no score' : 'No score'}</span>`}
      ${r.unfinished ? '<span class="res-note">Unfinished, counted at this score</span>' : ''}
    </li>`;
}

function resultsCard() {
  if (!session.results.length) return '';
  return `
    <details class="card fold area-results" data-fold="results" ${ui.results ? 'open' : ''}>
      <summary><span class="section-label">Recent results</span><span class="muted small">${plural(session.results.length, 'game')}</span></summary>
      <ul class="results fold-body">${session.results.slice(0, 8).map(resultRow).join('')}</ul>
    </details>`;
}

function boardView() {
  const games = upcoming(session, 2);
  const free = freeCourts().length;
  const call = session.lastCall ? `
    <div class="banner area-call ${seen && seen.call !== JSON.stringify(session.lastCall) ? 'ring' : ''}">
      <span class="banner-text"><span class="label">Now calling · Court ${session.lastCall.court}</span><strong>${esc(session.lastCall.names.join(', '))}</strong></span>
      <button class="btn btn-dark btn-small" data-action="announce">🔊 Announce</button>
    </div>` : '';
  // Playing courts first, free ones after: the games in progress are what the manager watches.
  const courts = [...session.courts].sort((x, y) => (x.teams.length ? 0 : 1) - (y.teams.length ? 0 : 1) || x.id - y.id);

  return `
    <section class="session-head">
      <div class="head-title">
        <p class="eyebrow">Open play · ${esc(session.sport)}</p>
        <h1>${esc(session.name)}</h1>
      </div>
      <div class="chips">
        <span class="stat-chip"><strong>${playingCount(session)}</strong> playing</span>
        <span class="stat-chip"><strong>${waitingCount(session)}</strong> waiting</span>
        <span class="stat-chip ${free ? 'go' : ''}"><strong>${free}/${session.courts.length}</strong> courts free</span>
        <button class="btn btn-small btn-ghost end-btn" data-action="close">End open play</button>
        <button class="help-btn" data-action="toggle-help" aria-expanded="${ui.help}" aria-label="How open play works" title="How open play works">?</button>
      </div>
    </section>
    <section class="layout">
      <div class="main-col">
        ${helpStrip()}
        ${call}
        <section class="area-courts stack tight">
          <div class="row between"><h2 class="section-title">Courts</h2></div>
          <div class="courts">${courts.map((c) => courtCard(c, games.length > 0)).join('')}</div>
        </section>
        ${nextGameCard(games)}
        ${resultsCard()}
      </div>
      <aside class="side-col">
        ${checkinCard()}
        ${queueCard(games)}
        ${settingsCard()}
      </aside>
    </section>`;
}

/* ---------- Finishing a game without a score ---------- */

function finishDialog() {
  const court = ui.finishing !== null ? session.courts.find((c) => c.id === ui.finishing) : null;
  if (!court || !court.teams.length) return '';
  const [a, b] = court.teams;
  const tie = ui.finishScore && ui.finishScore.a === ui.finishScore.b;
  const pick = (team, side) => `
    <button class="win-pick ${side}" type="button" data-action="finish-pick" data-side="${side}">
      <span class="win-pick-names">${team.p.map((n) => `<strong>${esc(n)}</strong>`).join('')}</span>
      <span class="win-pick-cta">🏆 They won</span>
    </button>`;
  return `
    <dialog class="end-dialog" id="finish-dialog" aria-labelledby="finish-title">
      <div class="stack">
        <div>
          <p class="eyebrow">Finish Court ${court.id} · Game ${court.game}</p>
          <h2 id="finish-title">Who won?</h2>
          <p class="muted small">${tie
            ? `The score is tied at ${ui.finishScore.a}–${ui.finishScore.b}. Pick the winner so it counts in the rankings.`
            : 'No score was kept for this game. Pick the winner so it counts in the rankings.'}</p>
        </div>
        <div class="win-picks">${pick(a, 'a')}<span class="vs">VS</span>${pick(b, 'b')}</div>
        <div class="row wrap end-actions">
          <button class="btn btn-ghost" type="button" data-action="finish-cancel">Keep playing</button>
          <button class="btn btn-ghost grow" type="button" data-action="finish-pick" data-side="none">Finish without a winner</button>
        </div>
        <p class="hint">Without a winner the game still counts as played, but not as a win or loss.</p>
      </div>
    </dialog>`;
}

// Save the game, send the 4 players to the back of the line and call the next game.
function finishCourt(courtId, score, winnerSide, before) {
  delete drafts.scores[courtId];
  remove(matchKey(courtId));
  const court = session.courts.find((c) => c.id === courtId);
  const names = (side) => court.teams[side === 'a' ? 0 : 1].p.join(' & ');
  const won = resultWinner(score, winnerSide);
  const callBefore = JSON.stringify(session.lastCall);
  setSession(endGame(session, courtId, score, undefined, winnerSide));
  const called = JSON.stringify(session.lastCall) !== callBefore && session.courts.find((c) => c.id === courtId).teams.length;
  const what = won ? `${names(won)} won${score && score.a !== score.b ? ` ${score.a}–${score.b}` : ''}` : 'no winner';
  toast(called
    ? `Court ${courtId} finished (${what}). Next game is on.`
    : `Court ${courtId} finished (${what}). Not enough players for the next game yet.`, { type: called ? 'success' : 'info', undo: before });
  if (called) announce();
}

/* ---------- Ending open play and the final standings ---------- */

// Score to save for a game still on court: what was typed on the card, else the scoreboard.
function scoreInProgress(court) {
  const live = liveScore(court);
  const d = { ...(live ? live.final : {}), ...drafts.scores[court.id] };
  return d.a !== undefined && d.a !== '' && d.b !== undefined && d.b !== '' ? { a: Number(d.a), b: Number(d.b) } : null;
}

const medal = (rank) => ({ 1: '🥇', 2: '🥈', 3: '🥉' }[rank] || '');
const pct = (p) => (p.wins + p.losses ? `${Math.round(p.winRate * 100)}%` : '–');
const signed = (n) => (n > 0 ? `+${n}` : String(n));

function liveScoresToCount() {
  if (!ui.countLive) return {};
  return Object.fromEntries(session.courts.filter((c) => c.teams.length).map((c) => [c.id, scoreInProgress(c)]));
}

function endPreview() {
  const preview = finishSession(session, liveScoresToCount());
  const top = preview.standings.filter((p) => p.rank && p.rank <= 3).slice(0, 3);
  return `
    <div class="end-preview">
      <div class="chips">
        <span class="stat-chip"><strong>${preview.games}</strong> games</span>
        <span class="stat-chip"><strong>${preview.standings.filter((p) => p.played).length}</strong> players ranked</span>
      </div>
      <span class="label">Top of the rankings</span>
      ${top.length
        ? `<ol class="mini-podium">${top.map((p) => `<li><span aria-hidden="true">${medal(p.rank)}</span><strong>${esc(p.name)}</strong><span class="muted small">${p.wins}W ${p.losses}L</span></li>`).join('')}</ol>`
        : '<p class="muted small">No games played yet, so there is nothing to rank.</p>'}
    </div>`;
}

function endDialog() {
  if (!ui.ending) return '';
  const inPlay = session.courts.filter((c) => c.teams.length);
  const liveList = inPlay.map((c) => {
    const sc = scoreInProgress(c);
    return `<li>Court ${c.id}: ${sc ? `<strong>${sc.a}–${sc.b}</strong>` : 'no score yet, will not count'}</li>`;
  }).join('');

  return `
    <dialog class="end-dialog" id="end-dialog" aria-labelledby="end-title">
      <div class="stack">
        <div>
          <p class="eyebrow">End open play</p>
          <h2 id="end-title">Wrap up ${esc(session.name)}?</h2>
        </div>
        ${inPlay.length ? `
          <fieldset class="choice">
            <legend>${plural(inPlay.length, 'game is', 'games are')} still being played</legend>
            <label class="option"><input type="radio" name="live" value="count" ${ui.countLive ? 'checked' : ''}>
              <span><strong>Count them with the current score</strong><ul class="hint plain-list">${liveList}</ul></span></label>
            <label class="option"><input type="radio" name="live" value="drop" ${ui.countLive ? '' : 'checked'}>
              <span><strong>Do not count them</strong><span class="hint">Only finished games go into the rankings.</span></span></label>
          </fieldset>` : ''}
        ${endPreview()}
        <p class="hint">The waiting line and courts are cleared. The final standings stay on this device until you start a new session.</p>
        <div class="row wrap end-actions">
          <button class="btn btn-ghost" type="button" data-action="cancel-end">Keep playing</button>
          <button class="btn btn-primary grow" type="button" data-action="confirm-end">End &amp; show rankings</button>
        </div>
      </div>
    </dialog>`;
}

function standingsText(s) {
  const lines = s.standings.filter((p) => p.played).map((p) => `${p.rank}. ${p.name}: ${p.wins}W-${p.losses}L, ${signed(p.diff)} (${plural(p.played, 'game')})`);
  return `${s.name}: final standings\n${lines.join('\n')}`;
}

function rankingView() {
  const s = summary;
  const ranked = s.standings.filter((p) => p.played);
  const unplayed = s.standings.filter((p) => !p.played);
  const scored = s.results.some((r) => r.score || r.winner);
  const podium = ranked.slice(0, 3);
  const date = new Date(s.endedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  // Podium order on screen: 2nd, 1st, 3rd.
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  return `
    <section class="final">
      <a class="btn btn-ghost btn-small final-home" href="index.html">← Home</a>
      <header class="final-head">
        <p class="eyebrow">Final standings · ${esc(s.sport)} · ${esc(date)}</p>
        <h1>${esc(s.name)}</h1>
        <div class="chips">
          <span class="stat-chip"><strong>${s.games}</strong> games</span>
          <span class="stat-chip"><strong>${ranked.length}</strong> players</span>
        </div>
      </header>

      ${podium.length ? `
        <ol class="podium" aria-label="Top three">
          ${podiumOrder.map((p) => `
            <li class="podium-spot place-${Math.min(p.rank, 3)}">
              <span class="podium-medal" aria-hidden="true">${medal(Math.min(p.rank, 3))}</span>
              <strong class="podium-name">${esc(p.name)}</strong>
              <span class="podium-stats">${p.wins}W · ${p.losses}L${scored ? ` · ${signed(p.diff)} pts` : ''}</span>
              <span class="podium-block">${p.rank}</span>
            </li>`).join('')}
        </ol>` : '<p class="card muted">No games were played in this session.</p>'}

      ${!scored && ranked.length ? '<p class="notice">No scores were entered, so players are ranked by games played only.</p>' : ''}

      ${ranked.length ? `
        <section class="card stack">
          <h2 class="section-title">Rankings</h2>
          <div class="rank-row rank-head" aria-hidden="true">
            <span>#</span><span>Player</span><span>W–L</span><span class="rank-pct">Win %</span><span class="rank-diff">Pts +/−</span>
          </div>
          <ol class="rank-list">
            ${ranked.map((p, i) => `
              <li class="rank-row ${p.rank <= 3 ? 'top' : ''}" style="--i:${Math.min(i, 12)}">
                <span class="rank-num">${medal(p.rank) || p.rank}</span>
                <span class="grow"><strong>${esc(p.name)}</strong><span class="tag">${plural(p.played, 'game')} · ${p.pointsFor} pts scored</span></span>
                <span class="rank-wl">${p.wins}–${p.losses}</span>
                <span class="rank-pct">${pct(p)}</span>
                <span class="rank-diff ${p.diff > 0 ? 'pos' : p.diff < 0 ? 'neg' : ''}" title="Scored ${p.pointsFor}, gave up ${p.pointsAgainst}">${signed(p.diff)}</span>
              </li>`).join('')}
          </ol>
          ${unplayed.length ? `<p class="muted small">Checked in but did not play: ${unplayed.map((p) => esc(p.name)).join(', ')}</p>` : ''}
          <div class="legend">
            <p><strong>W–L</strong> wins and losses.</p>
            <p><strong>Pts +/−</strong> points scored minus points given up, across all scored games. <span class="pos">+6</span> means they scored 6 more than their opponents; <span class="neg">−4</span> means 4 fewer.</p>
            <p><strong>Order</strong> most wins first. Ties go to the higher win %, then the better Pts +/−.</p>
            <p class="muted">Games won by picking a winner (no score) count as a win but add no points. Games with no score and no winner count as played only.</p>
          </div>
        </section>` : ''}

      ${s.results.length ? `
        <details class="card fold">
          <summary><span class="section-label">All games</span><span class="muted small">${plural(s.results.length, 'game')}</span></summary>
          <ul class="results fold-body">${s.results.map(resultRow).join('')}</ul>
        </details>` : ''}

      <div class="row wrap final-actions">
        ${ranked.length ? '<button class="btn btn-ghost" data-action="copy-standings">Copy standings</button>' : ''}
        <button class="btn btn-primary grow" data-action="new-session">Start new open play</button>
      </div>
    </section>`;
}

/* ---------- Render with animations for what changed ---------- */

function render() {
  if (!session) {
    seen = null;
    app.innerHTML = summary && showingStandings() ? rankingView() : setupView();
    return;
  }
  const prev = seen;
  app.innerHTML = boardView() + endDialog() + finishDialog();
  const dialog = app.querySelector('#end-dialog, #finish-dialog');
  if (dialog) {
    dialog.showModal();
    // Esc closes the dialog: keep playing.
    dialog.addEventListener('cancel', () => { ui.ending = false; ui.finishing = null; });
  }

  if (prev) {
    session.courts.forEach((court) => {
      if (prev.courts[court.id] !== court.game && court.teams.length) {
        app.querySelector(`[data-court-card="${court.id}"]`)?.classList.add('pop', 'glow');
      }
    });
    const sig = app.querySelector('.next-matchup')?.dataset.sig;
    if (sig && sig !== prev.next) app.querySelector('.next-matchup').classList.add('swap');
    const ready = app.querySelector('.next-card.ready');
    if (ready && !prev.ready) ready.classList.add('pop', 'glow');
  }
  seen = {
    ids: new Set(session.queue.map((e) => e.id)),
    courts: Object.fromEntries(session.courts.map((c) => [c.id, c.teams.length ? c.game : -1])),
    next: app.querySelector('.next-matchup')?.dataset.sig || '',
    ready: Boolean(app.querySelector('.next-card.ready')),
    call: JSON.stringify(session.lastCall),
  };
  flashId = null;
  if (focusCheckin) {
    focusCheckin = false;
    app.querySelector('#checkin input[name="names"]')?.focus();
  }
}

/* ---------- Events ---------- */

app.addEventListener('input', (event) => {
  const el = event.target;
  if (el.dataset.score) {
    const id = el.dataset.score;
    drafts.scores[id] = { ...drafts.scores[id], [el.dataset.side]: el.value };
  }
  if (el.form?.id === 'checkin' && el.name === 'names') drafts.names = el.value;
  if (el.form?.id === 'checkin' && el.name === 'addedBy') drafts.addedBy = el.value;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && ui.pairing !== null) {
    ui.pairing = null;
    render();
  }
});

app.addEventListener('toggle', (event) => {
  const fold = event.target.dataset?.fold;
  if (fold) ui[fold] = event.target.open;
}, true);

app.addEventListener('change', (event) => {
  const el = event.target;
  if (el.name === 'live') {
    // Refresh the preview inside the open dialog without closing it.
    ui.countLive = el.value === 'count';
    const holder = document.createElement('div');
    holder.innerHTML = endPreview();
    app.querySelector('#end-dialog .end-preview').replaceWith(holder.firstElementChild);
    return;
  }
  if (el.name === 'mode') {
    drafts.mode = el.value;
    const input = app.querySelector('#checkin input[name="names"]');
    input.placeholder = el.value === 'pair' ? 'Two names, e.g. Ana, Ben' : 'One name, or several: Ana, Ben, Cy';
  }
});

app.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  const courtId = Number(el.dataset.court);
  const entryId = Number(el.dataset.id);
  const before = session;

  if (action === 'fill') {
    setSession(fillCourt(session, courtId));
    if (session.lastCall) {
      toast(`Court ${courtId}: ${session.lastCall.names.join(', ')}`, { type: 'success', undo: before });
      announce();
    }
  }
  if (action === 'end') {
    const score = scoreInProgress(session.courts.find((c) => c.id === courtId));
    // A score with a clear winner finishes right away; otherwise ask who won.
    if (resultWinner(score)) finishCourt(courtId, score, null, before);
    else {
      ui.finishing = courtId;
      ui.finishScore = score;
      render();
    }
  }
  if (action === 'finish-pick') {
    const courtNow = ui.finishing;
    const score = ui.finishScore;
    ui.finishing = null;
    ui.finishScore = null;
    finishCourt(courtNow, score, el.dataset.side === 'none' ? null : el.dataset.side, before);
  }
  if (action === 'finish-cancel') {
    ui.finishing = null;
    render();
  }
  if (action === 'shuffle') {
    setSession(reshuffle(session));
    toast('New random teammates picked.', { ms: 2200 });
  }
  if (action === 'announce') announce();
  if (action === 'up') {
    flashId = entryId;
    setSession(moveUp(session, entryId));
  }
  if (action === 'remove') {
    const entry = session.queue.find((e) => e.id === entryId);
    const li = el.closest('li');
    if (!entry || li?.classList.contains('leave')) return;
    let done = false;
    const doRemove = () => {
      if (done) return;
      done = true;
      setSession(removeEntry(session, entryId));
      toast(`${entry.p.join(' & ')} left the line.`, { undo: before });
    };
    if (li && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      li.classList.add('leave');
      li.addEventListener('animationend', doRemove, { once: true });
      setTimeout(doRemove, 400);
    } else doRemove();
  }
  if (action === 'allow' && !session.allowPicks) {
    setSession(setAllowPicks(session, true));
    toast('Players can now check in as partners.', { type: 'success' });
  }
  if (action === 'random' && session.allowPicks) {
    ui.pairing = null;
    setSession(setAllowPicks(session, false));
    toast('Random only: partners in the line were split up.', { undo: before });
  }
  if (action === 'add-court') {
    setSession(addCourt(session));
    toast(`Court ${session.courts.length} added.`, { type: 'success' });
  }
  if (action === 'hide-help' || action === 'toggle-help') {
    ui.help = action === 'toggle-help' ? !ui.help : false;
    if (!ui.help) save(HELP_KEY, true);
    render();
  }
  if (action === 'pair-start') {
    ui.pairing = entryId;
    render();
  }
  if (action === 'pair-cancel') {
    ui.pairing = null;
    render();
  }
  if (action === 'pair-with') {
    const first = session.queue.find((e) => e.id === ui.pairing);
    const second = session.queue.find((e) => e.id === entryId);
    ui.pairing = null;
    if (first && second) {
      setSession(pairUp(session, first.id, second.id));
      flashId = session.queue.find((e) => e.p.includes(first.p[0]))?.id ?? null;
      render();
      toast(`${first.p[0]} & ${second.p[0]} are now partners.`, { type: 'success', undo: before });
    } else render();
  }
  if (action === 'split') {
    const entry = session.queue.find((e) => e.id === entryId);
    setSession(splitPair(session, entryId));
    toast(`${entry.p.join(' & ')} will get random teammates.`, { undo: before });
  }
  if (action === 'close') {
    ui.ending = true;
    render();
  }
  if (action === 'cancel-end') {
    ui.ending = false;
    render();
  }
  if (action === 'confirm-end') {
    summary = finishSession(session, liveScoresToCount());
    save(SUMMARY_KEY, summary);
    ui.ending = false;
    drafts.scores = {};
    setStandings(true);
    session.courts.forEach((court) => remove(matchKey(court.id)));
    setSession(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Open play ended. Here are the final standings.', {
      type: 'success',
      onUndo: () => {
        summary = null;
        remove(SUMMARY_KEY);
        setStandings(false);
        setSession(before);
      },
    });
  }
  if (action === 'copy-standings') {
    const text = standingsText(summary);
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast('Standings copied. Paste them in your group chat.', { type: 'success' }))
      .catch(() => toast('Could not copy on this browser.', { type: 'warn' }));
  }
  if (action === 'new-session') {
    setStandings(false);
    render();
  }
  if (action === 'show-summary') {
    setStandings(true);
    render();
    window.scrollTo({ top: 0 });
  }
});

app.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.target);

  if (event.target.id === 'create') {
    focusCheckin = true;
    summary = null;
    remove(SUMMARY_KEY);
    setStandings(false);
    setSession(newSession({ name: form.get('name').trim(), sport: form.get('sport'), courts: Number(form.get('courts')) }));
    toast('Session open. Start checking players in.', { type: 'success' });
  }

  if (event.target.id === 'checkin') {
    const names = form.get('names').split(',').map((n) => n.trim()).filter(Boolean);
    const unique = names.filter((n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i);
    const fresh = unique.filter((n) => !hasPlayer(session, n));
    const skipped = names.length - fresh.length;
    const wantsPair = form.get('mode') === 'pair';
    if (!fresh.length) return toast('Those players are already checked in.', { type: 'warn' });
    if (wantsPair && fresh.length !== 2) return toast('Partners need exactly 2 new names, like "Ana, Ben".', { type: 'warn' });
    if (wantsPair && !session.allowPicks) return toast('Partner picks are off. Everyone gets a random teammate.', { type: 'warn' });

    drafts.names = '';
    focusCheckin = true;
    setSession(addPlayers(session, fresh, { asPair: wantsPair, addedBy: form.get('addedBy').trim() || null }));
    const who = wantsPair ? `${fresh[0]} & ${fresh[1]} added as partners.` : `${fresh.length === 1 ? fresh[0] : plural(fresh.length, 'player')} added to the line.`;
    toast(skipped ? `${who} ${plural(skipped, 'name')} skipped (already checked in).` : who, { type: skipped ? 'info' : 'success' });
  }
});

render();

// The browser's back button can restore an old copy of this page, and the
// scoreboard may be open in another tab: always show what is saved.
function reload() {
  session = load(SESSION_KEY);
  summary = load(SUMMARY_KEY);
  drafts.scores = {};
  render();
}
window.addEventListener('pageshow', (event) => { if (event.persisted) reload(); });
window.addEventListener('storage', (event) => {
  if (event.key === SESSION_KEY || event.key === SUMMARY_KEY || event.key?.startsWith('sidecourt.match.')) reload();
});

// Coming back from the scoreboard with Back: confirm the score was kept.
const scored = Number(new URLSearchParams(location.search).get('scored'));
if (scored && session) {
  const live = liveScore(session.courts.find((c) => c.id === scored) || { teams: [] });
  if (live) toast(`Court ${scored} score saved: ${live.match.a}–${live.match.b}. Open the scoreboard again to keep going.`, { type: 'success', ms: 5000 });
  history.replaceState(null, '', 'openplay.html');
}

// Coming back from the scoreboard after "Save result and call next".
const finished = Number(new URLSearchParams(location.search).get('finished'));
if (finished && session) {
  const court = session.courts.find((c) => c.id === finished);
  toast(court?.teams.length
    ? `Court ${finished} result saved. Next game is on: ${court.teams.flatMap((t) => t.p).join(', ')}.`
    : `Court ${finished} result saved. Not enough players for the next game yet.`, { type: 'success', ms: 6000 });
  history.replaceState(null, '', 'openplay.html');
}
