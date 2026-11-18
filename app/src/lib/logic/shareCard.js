// Shareable standings cards, sized like Strava's story stickers: a small label
// with a very large number, few things per card, so it reads on a phone.
//   1. Overall: the session and its top 3
//   2-4. One per top-3 player: their three headline numbers and recent form
// Hierarchy on every card: (1) title or name, (2) the big numbers or the top 3,
// (3) small labels and details.
// Text sits in a top band and a bottom band; the middle stays empty for a photo.
// Portrait is an Instagram story (1080x1920, text inside its safe area);
// landscape is full HD (1920x1080, the 16:9 shape of a YouTube thumbnail);
// on the dark Sidecourt background, or see-through: text only on a fully
// transparent image, to lay over a picture.
// Each card is an SVG string; the app draws it onto a canvas to save a PNG.
// System fonts only, because an image cannot load web fonts.
import { resultWinner } from './queue.js';

const FONT = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const C = { bg: '#0a0d18', text: '#f1f3fa', soft: '#cfd5e6', muted: '#a2abc6', orange: '#ff8a4c', blue: '#7db4ff', green: '#6ee7a8', red: '#ff9aa8' };
const MEDAL = { 1: '#f2c14e', 2: '#c3cad9', 3: '#d98a4f' };
const PLACE = { 1: '1ST PLACE', 2: '2ND PLACE', 3: '3RD PLACE' };

// One type scale for every card (pixels on the 1080-wide story).
const T = { brand: 28, eyebrow: 26, title: 74, sub: 30, label: 25, value: 92, row: 42, detail: 28, foot: 22 };

// Instagram draws its own controls over the top ~250px and bottom ~340px of a
// story. Half of each is kept clear: text sits closer to the edges, leaving more
// room for the photo, at the cost that Instagram's bars may touch the outer lines.
export const STORY_SAFE = { top: 125, bottom: 170 };
// W, H: the canvas the card is laid out on. outW, outH: the image that is saved.
// scale: how the layout is drawn onto the image. Landscape is laid out on a larger
// canvas and drawn at 80%, so its text is smaller than the story's on a 1920x1080 image.
// top: where the brand line starts. bottom: the lowest baseline text may use.
// rightCol: where the landscape's right-hand list starts.
export const LAYOUTS = {
  portrait: { W: 1080, H: 1920, outW: 1080, outH: 1920, scale: 1, pad: 72, top: 137, bottom: 1662, story: true },
  landscape: { W: 2400, H: 1350, outW: 1920, outH: 1080, scale: 0.8, pad: 90, top: 70, bottom: 1280, rightCol: 1480, story: false },
};

// Names are typed by people: escape them so they cannot break the image.
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
// SVG text does not wrap or shrink: cut long text and add "…".
const fit = (t, max) => (String(t).length > max ? `${String(t).slice(0, max - 1).trimEnd()}…` : String(t));
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const pct = (p) => (p.wins + p.losses ? `${Math.round(p.winRate * 100)}%` : '–');
const diffColor = (n) => (n > 0 ? C.green : n < 0 ? C.red : C.text);
const cap = (word) => `${word[0].toUpperCase()}${word.slice(1)}`;
const dateText = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function text(x, y, value, { size, weight = 600, fill = C.text, anchor = 'start', spacing = 0 }) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ''}>${esc(value)}</text>`;
}

const label = (x, y, value, fill = C.muted) => text(x, y, value, { size: T.label, weight: 700, fill, spacing: 4 });

// Strava-style stat: a small label, then a very large number under it.
const stat = (x, y, name, value, fill = C.text) => label(x, y, name) + text(x, y + T.value + 2, value, { size: T.value, weight: 800, fill });

// Splits a long title over two lines at a space.
function titleLines(name, max) {
  if (name.length <= max) return [name];
  const cut = name.lastIndexOf(' ', max);
  const first = cut > 6 ? name.slice(0, cut) : name.slice(0, max);
  return [first, fit(name.slice(first.length).trim(), max)];
}

// The logo: two orange halves with a real gap between them (the net), so it
// works on any background. size is its height in pixels.
function logo(x, y, size) {
  const half = (d) => `<path d="${d}" fill="${C.orange}"/>`;
  return `<g transform="translate(${x} ${y}) scale(${size / 32})">`
    + half('M9 0H14V32H9A9 9 0 0 1 0 23V9A9 9 0 0 1 9 0Z')
    + half('M18 0H23A9 9 0 0 1 32 9V23A9 9 0 0 1 23 32H18Z')
    + '</g>';
}

// See-through cards are text only: nothing is drawn behind it. A soft, faint
// dark haze behind the letters helps them stand out on a photo without looking
// like a shadow (plus a barely visible outline where a browser cannot draw the
// haze), and the grey text is lightened a step. It is deliberately subtle, so
// on a very bright photo the text has little contrast.
function seeThrough(content) {
  return `<defs><filter id="glow" x="-5%" y="-5%" width="110%" height="110%">
    <feDropShadow dx="0" dy="1" stdDeviation="3.5" flood-color="#05070e" flood-opacity="0.3"/>
    <feDropShadow dx="0" dy="3" stdDeviation="10" flood-color="#05070e" flood-opacity="0.2"/>
  </filter></defs>
  <g filter="url(#glow)" stroke="#05070e" stroke-opacity="0.1" stroke-width="1" stroke-linejoin="round" paint-order="stroke">
  ${content.replaceAll(`fill="${C.muted}"`, `fill="${C.soft}"`).replaceAll(`fill="${C.soft}"`, 'fill="#eef1f8"')}
  </g>`;
}

// Background, brand and footer shared by every card.
function frame(body, L, { site, background }) {
  const { W, H, pad, outW, outH, scale } = L;
  const dark = background !== 'transparent';
  const credit = site ? `Scored with Sidecourt · ${site}` : 'Scored with Sidecourt';
  const content = `${logo(pad, L.top, 38)}
  ${text(pad + 52, L.top + 29, 'Sidecourt', { size: T.brand, weight: 700, fill: C.soft })}
  ${body}
  ${L.story
    ? text(W / 2, H - STORY_SAFE.bottom - 14, credit, { size: T.foot, weight: 500, fill: C.muted, anchor: 'middle' })
    : text(W - pad, L.top + 30, credit, { size: T.foot, weight: 500, fill: C.muted, anchor: 'end' })}`;
  const drawn = dark ? content : seeThrough(content);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}" font-family="${FONT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1226"/><stop offset="1" stop-color="${C.bg}"/></linearGradient>
    <radialGradient id="warm" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.orange}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
    <radialGradient id="cool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.blue}" stop-opacity="0.14"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
  </defs>
  ${dark
    ? `<rect width="${outW}" height="${outH}" fill="url(#bg)"/>
  <circle cx="${outW - 80}" cy="80" r="${Math.round(outH * 0.34)}" fill="url(#warm)"/>
  <circle cx="40" cy="${outH - 200}" r="${Math.round(outH * 0.36)}" fill="url(#cool)"/>`
    : ''}
  ${scale === 1 ? drawn : `<g transform="scale(${scale})">${drawn}</g>`}
</svg>`;
}

// Level 1, top band: a small coloured line, the big title or name, a quiet line under it.
function header(L, { eyebrow, eyebrowFill = C.blue, badge = null, lines, subs }) {
  let y = L.top + 104;
  let out = badge
    ? `<circle cx="${L.pad + 20}" cy="${y - 10}" r="20" fill="${badge.fill}"/>` + text(L.pad + 20, y - 1, badge.text, { size: 26, weight: 800, fill: C.bg, anchor: 'middle' }) + label(L.pad + 54, y, eyebrow, eyebrowFill)
    : label(L.pad, y, eyebrow, eyebrowFill);
  lines.forEach((line) => { y += T.title + 8; out += text(L.pad, y, line, { size: T.title, weight: 800 }); });
  y += 20;
  subs.forEach((sub) => { y += T.sub + 10; out += text(L.pad, y, sub, { size: T.sub, weight: 500, fill: C.muted }); });
  return out;
}

export function overallStats(summary) {
  const scored = summary.results.filter((r) => r.score);
  return {
    games: summary.games,
    players: summary.standings.filter((p) => p.played).length,
    points: scored.reduce((sum, r) => sum + r.score.a + r.score.b, 0),
  };
}

// Games in the order they were played (results are stored newest first).
const inOrder = (summary) => [...summary.results].reverse();
const winnerOf = (r) => r.winner ?? resultWinner(r.score);

// The tightest scored games (smallest gap first; later games first among equals).
export function closestGames(summary, count = 3) {
  return summary.results
    .filter((r) => r.score)
    .map((r, i) => ({ r, gap: Math.abs(r.score.a - r.score.b), i }))
    .sort((x, y) => x.gap - y.gap || x.i - y.i)
    .slice(0, count)
    .map((o) => o.r);
}

/* ---------- Card 1: overall ---------- */

// Level 2 on the overall card: one of the top 3. Medal, name, then their record.
function podiumRow(p, x, y, w) {
  const m = MEDAL[Math.min(p.rank, 3)];
  return `<circle cx="${x + 22}" cy="${y - 15}" r="22" fill="${m}"/>`
    + text(x + 22, y - 6, p.rank, { size: 26, weight: 800, fill: C.bg, anchor: 'middle' })
    + text(x + 62, y, fit(p.name, Math.max(6, Math.floor((w - 360) / 23))), { size: T.row, weight: 700 })
    + text(x + w - 140, y, `${p.wins}–${p.losses}`, { size: T.row, weight: 800, anchor: 'end' })
    + text(x + w, y, signed(p.diff), { size: 31, weight: 600, fill: diffColor(p.diff), anchor: 'end' });
}

function closeRow(r, x, y, w) {
  const won = winnerOf(r);
  const mid = x + w / 2;
  const max = Math.floor((w / 2 - 60) / 14.5);
  const team = (i) => ({ size: T.detail, weight: won === (i ? 'b' : 'a') ? 700 : 500, fill: won === (i ? 'b' : 'a') ? C.text : C.muted });
  return text(mid - 60, y, fit(r.teams[0].join(' & '), max), { ...team(0), anchor: 'end' })
    + text(mid, y, `${r.score.a}–${r.score.b}`, { size: T.detail, weight: 800, anchor: 'middle' })
    + text(mid + 60, y, fit(r.teams[1].join(' & '), max), team(1));
}

function overallCard(summary, L, opts) {
  const o = overallStats(summary);
  const ranked = summary.standings.filter((p) => p.played);
  const name = summary.name.trim() || 'Open play';
  let body = header(L, {
    eyebrow: 'FINAL STANDINGS',
    lines: L.story ? titleLines(name, 20) : [fit(name, 36)],
    subs: [`${cap(summary.sport)} · ${dateText(summary.endedAt)}`, `${plural(o.games, 'game')} · ${plural(o.players, 'player')} · ${plural(o.points, 'point')}`],
  });
  if (!ranked.length) return frame(body + text(L.pad, L.bottom, 'No games were played.', { size: T.sub, fill: C.muted }), L, opts);

  const top = ranked.slice(0, 3);
  const step = 70;
  const first = L.bottom - (top.length - 1) * step;
  const w = L.story ? L.W - 2 * L.pad : 860;
  body += label(L.pad, first - 62, top.length > 1 ? `TOP ${top.length}` : 'WINNER')
    + top.map((p, i) => podiumRow(p, L.pad, first + i * step, w)).join('');

  // Landscape has room on the right for the closest games.
  if (!L.story) {
    const close = closestGames(summary, 3);
    const cx = L.rightCol;
    const cFirst = L.bottom - (close.length - 1) * step;
    if (close.length) {
      body += label(cx, cFirst - 62, close.length === 1 ? 'CLOSEST GAME' : 'CLOSEST GAMES')
        + close.map((r, i) => closeRow(r, cx, cFirst + i * step, L.W - L.pad - cx)).join('');
    }
  }
  return frame(body, L, opts);
}

/* ---------- Cards 2-4: one player ---------- */

// The player's own games, from their point of view.
export function playerMatches(summary, name) {
  return inOrder(summary)
    .filter((r) => r.teams.flat().includes(name))
    .map((r) => {
      const mine = r.teams[0].includes(name) ? 0 : 1;
      const won = winnerOf(r);
      return {
        partner: r.teams[mine].filter((n) => n !== name).join(' & '),
        opponents: r.teams[1 - mine].join(' & '),
        court: r.court,
        result: !won ? 'none' : won === (mine ? 'b' : 'a') ? 'win' : 'loss',
        score: r.score ? `${mine ? r.score.b : r.score.a}–${mine ? r.score.a : r.score.b}` : null,
      };
    });
}

const RESULT = { win: { letter: 'W', fill: C.green }, loss: { letter: 'L', fill: C.red }, none: { letter: '–', fill: C.muted } };

// Recent form as letters: W W L W. Compact, and readable at a glance.
function formLine(games, x, y) {
  const recent = games.slice(-8);
  return label(x, y, games.length > recent.length ? `LAST ${recent.length}` : 'GAMES')
    + recent.map((g, i) => text(x + 174 + i * 48, y + 2, RESULT[g.result].letter, { size: 34, weight: 800, fill: RESULT[g.result].fill, anchor: 'middle' })).join('');
}

function gameRow(g, x, y) {
  return text(x + 14, y, RESULT[g.result].letter, { size: T.detail, weight: 800, fill: RESULT[g.result].fill, anchor: 'middle' })
    + text(x + 50, y, g.score ?? { win: 'Won', loss: 'Lost', none: '–' }[g.result], { size: T.detail, weight: 800 })
    + text(x + 170, y, g.partner ? `with ${fit(g.partner, 12)}` : 'Singles', { size: T.detail, weight: 600, fill: C.soft })
    + text(x + 420, y, `vs ${fit(g.opponents, 18)}`, { size: T.detail, weight: 500, fill: C.muted });
}

function playerCard(summary, p, L, opts) {
  const place = Math.min(p.rank, 3);
  const games = playerMatches(summary, p.name);
  let body = header(L, {
    eyebrow: PLACE[place],
    eyebrowFill: MEDAL[place],
    badge: { fill: MEDAL[place], text: p.rank },
    lines: [fit(p.name, L.story ? 20 : 30)],
    subs: [fit(`${summary.name.trim() || 'Open play'} · ${dateText(summary.endedAt)}`, L.story ? 52 : 70)],
  });

  // Level 2: three headline numbers, each a small label over a very large value.
  const stats = [['WINS – LOSSES', `${p.wins}–${p.losses}`], ['WIN RATE', pct(p)], ['POINTS +/−', signed(p.diff), diffColor(p.diff)]];
  const col = L.story ? 316 : 330;
  const statsY = L.story ? L.bottom - 164 : L.bottom - (T.value + 2);
  body += stats.map(([name, value, fill], i) => stat(L.pad + i * col, statsY, name, value, fill)).join('');

  // Level 3: recent form (story), or the last three games in full (landscape has the width).
  if (L.story) {
    body += formLine(games, L.pad, L.bottom);
  } else {
    const last = games.slice(-3);
    const gx = L.rightCol;
    const step = 60;
    const first = L.bottom - (last.length - 1) * step;
    body += label(gx, first - 60, games.length > last.length ? `LAST ${last.length} OF ${games.length} GAMES` : 'GAMES')
      + last.map((g, i) => gameRow(g, gx, first + i * step)).join('');
  }
  return frame(body, L, opts);
}

/* ---------- All cards ---------- */

// Returns [{ id, title, file, width, height, svg }]: the overall card, then one per top-3 player.
//   orientation: 'portrait' | 'landscape'    background: 'dark' | 'transparent'
//   site: shown in the footer, e.g. "sidecourt.pages.dev"
export function shareCards(summary, { site = '', orientation = 'portrait', background = 'dark' } = {}) {
  const L = LAYOUTS[orientation] ?? LAYOUTS.portrait;
  const opts = { site, background };
  const slug = (summary.name.trim() || 'open-play').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'open-play';
  const top = summary.standings.filter((p) => p.played).slice(0, 3);
  const card = (id, title, svg) => ({ id, title, file: `${slug}-${id}.png`, width: L.outW, height: L.outH, svg });
  return [
    card('overall', 'Overall', overallCard(summary, L, opts)),
    ...top.map((p, i) => card(`top-${i + 1}`, `Top ${i + 1}: ${p.name}`, playerCard(summary, p, L, opts))),
  ];
}
