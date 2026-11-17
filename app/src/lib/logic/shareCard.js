// Shareable standings cards (like Strava activity overlays):
//   1. Overall: session stats, the rankings and the matches
//   2-4. One per top-3 player: their stats and their own matches
// Text sits in two thin bands near the top and bottom, small and quiet, so
// the middle stays empty for a photo. Only highlights are shown (top 5,
// closest games, a player's last games), not every match.
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
const ROW = 36; // height of one ranking or match row

// Sizes match where the cards get posted:
//   portrait  = Instagram story (1080x1920). Instagram draws its own controls
//               over the top ~250px and bottom ~340px, so all text stays between.
//   landscape = full HD (1920x1080), the 16:9 shape of a YouTube thumbnail.
// top: how far down the top band starts. foot: where the footer line sits.
// bandTop: where the bottom band starts. rows: rows per column in that band.
export const STORY_SAFE = { top: 250, bottom: 340 };
export const LAYOUTS = {
  portrait: { W: 1080, H: 1920, pad: 72, top: 220, foot: 1568, bandTop: 1340, rows: 5, statsBelow: true, rankCols: [72], rankW: 380, matchCols: [560], matchW: 448, playerCols: [72], playerW: 936 },
  landscape: { W: 1920, H: 1080, pad: 72, top: 0, foot: 1040, bandTop: 858, rows: 3, statsBelow: false, rankCols: [72, 500], rankW: 360, matchCols: [1400], matchW: 448, playerCols: [72], playerW: 848 },
};

// Names are typed by people: escape them so they cannot break the image.
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]);
// SVG text does not wrap or shrink: cut long text and add "…".
const fit = (t, max) => (String(t).length > max ? `${String(t).slice(0, max - 1).trimEnd()}…` : String(t));
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const pct = (p) => (p.wins + p.losses ? `${Math.round(p.winRate * 100)}%` : '–');
const diffColor = (n) => (n > 0 ? C.green : n < 0 ? C.red : C.soft);
const cap = (word) => `${word[0].toUpperCase()}${word.slice(1)}`;
const dateText = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

function text(x, y, value, { size, weight = 600, fill = C.text, anchor = 'start', spacing = 0 }) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ''}>${esc(value)}</text>`;
}

const heading = (x, y, value) => text(x, y, value, { size: 15, weight: 700, fill: C.muted, spacing: 4 });

// A small number with a tiny label under it.
const pair = (x, y, value, label, fill = C.soft) => text(x, y, value, { size: 30, weight: 700, fill }) + text(x, y + 22, label, { size: 14, weight: 600, fill: C.muted, spacing: 3 });

// A row of pairs: under the title in portrait, at the top right in landscape.
function statsRow(L, pairs) {
  const step = 150;
  const x0 = L.statsBelow ? L.pad : L.W - L.pad - pairs.length * step + 40;
  const y = (L.statsBelow ? 286 : 176) + L.top;
  return pairs.map(([value, label, fill], i) => pair(x0 + i * step, y, value, label, fill)).join('');
}

// Lays items out in columns of L.rows; when there are too many, the last slot says "+ N more".
function columns(items, cols, L, what, draw) {
  const room = cols.length * L.rows;
  const shown = items.length > room ? items.slice(0, room - 1) : items;
  let out = shown.map((item, i) => draw(item, cols[Math.floor(i / L.rows)], L.bandTop + 14 + (i % L.rows) * ROW, i)).join('');
  if (items.length > shown.length) {
    const i = shown.length;
    out += text(cols[Math.floor(i / L.rows)], L.bandTop + 14 + (i % L.rows) * ROW + 25, `+ ${items.length - shown.length} more ${what}`, { size: 18, fill: C.muted });
  }
  return out;
}

// The logo: two orange halves with a real gap between them (the net), so it
// works on any background.
function logo(x, y) {
  const half = (d) => `<path d="${d}" fill="${C.orange}"/>`;
  return half(`M${x + 9} ${y}H${x + 14}V${y + 32}H${x + 9}A9 9 0 0 1 ${x} ${y + 23}V${y + 9}A9 9 0 0 1 ${x + 9} ${y}Z`)
    + half(`M${x + 18} ${y}H${x + 23}A9 9 0 0 1 ${x + 32} ${y + 9}V${y + 23}A9 9 0 0 1 ${x + 23} ${y + 32}H${x + 18}Z`);
}

// Background, brand and footer shared by every card.
function frame(body, L, { site, background }) {
  const { W, H, pad } = L;
  const dark = background !== 'transparent';
  const content = `${logo(pad, 52 + L.top)}
  ${text(pad + 42, 76 + L.top, 'Sidecourt', { size: 22, weight: 700, fill: C.soft })}
  ${body}
  ${text(W / 2, L.foot, site ? `Scored with Sidecourt · ${site}` : 'Scored with Sidecourt', { size: 16, weight: 500, fill: C.muted, anchor: 'middle' })}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1226"/><stop offset="1" stop-color="${C.bg}"/></linearGradient>
    <radialGradient id="warm" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.orange}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
    <radialGradient id="cool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.blue}" stop-opacity="0.14"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
  </defs>
  ${dark
    ? `<rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W - 80}" cy="80" r="${Math.round(H * 0.34)}" fill="url(#warm)"/>
  <circle cx="40" cy="${H - 200}" r="${Math.round(H * 0.36)}" fill="url(#cool)"/>`
    : ''}
  ${dark ? content : seeThrough(content)}
</svg>`;
}

// See-through cards are text only: nothing is drawn behind it. A light dark
// glow hugging each letter keeps it readable on bright and dark photos alike
// (a thin outline does the same job where a browser cannot draw the glow),
// and the grey text is lightened a step.
function seeThrough(content) {
  return `<defs><filter id="glow" x="-5%" y="-5%" width="110%" height="110%">
    <feDropShadow dx="0" dy="0" stdDeviation="1.2" flood-color="#05070e" flood-opacity="0.7"/>
    <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="#05070e" flood-opacity="0.28"/>
  </filter></defs>
  <g filter="url(#glow)" stroke="#05070e" stroke-opacity="0.3" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke">
  ${content.replaceAll(`fill="${C.muted}"`, `fill="${C.soft}"`).replaceAll(`fill="${C.soft}"`, 'fill="#eef1f8"')}
  </g>`;
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

function rankingRow(p, x, y, w) {
  const m = MEDAL[p.rank];
  return text(x + 10, y + 25, p.rank, { size: 19, weight: 700, fill: m ?? C.muted, anchor: 'middle' })
    + text(x + 34, y + 25, fit(p.name, Math.max(6, Math.floor((w - 190) / 11))), { size: 21, weight: m ? 600 : 500, fill: C.soft })
    + text(x + w - 78, y + 25, `${p.wins}–${p.losses}`, { size: 21, weight: 600, fill: C.soft, anchor: 'end' })
    + text(x + w, y + 25, signed(p.diff), { size: 19, weight: 500, fill: diffColor(p.diff), anchor: 'end' });
}

function matchRow(r, x, y, w) {
  const won = winnerOf(r);
  const mid = x + w / 2;
  const max = Math.floor((w / 2 - 40) / 10.6);
  const team = (i) => ({ size: 19, weight: won === (i ? 'b' : 'a') ? 600 : 500, fill: won === (i ? 'b' : 'a') ? C.soft : C.muted });
  const score = r.score ? `${r.score.a}–${r.score.b}` : won ? (won === 'a' ? 'W–L' : 'L–W') : '–';
  return text(mid - 40, y + 25, fit(r.teams[0].join(' & '), max), { ...team(0), anchor: 'end' })
    + text(mid, y + 25, score, { size: 19, weight: 700, fill: C.soft, anchor: 'middle' })
    + text(mid + 40, y + 25, fit(r.teams[1].join(' & '), max), team(1));
}

function overallCard(summary, L, opts) {
  const o = overallStats(summary);
  const ranked = summary.standings.filter((p) => p.played);
  let body = text(L.pad, 142 + L.top, 'FINAL STANDINGS', { size: 15, weight: 700, fill: C.blue, spacing: 4 })
    + text(L.pad, 188 + L.top, fit(summary.name.trim() || 'Open play', 34), { size: 40, weight: 700 })
    + text(L.pad, 220 + L.top, `${cap(summary.sport)} · ${dateText(summary.endedAt)}`, { size: 19, weight: 500, fill: C.muted })
    + statsRow(L, [[o.games, o.games === 1 ? 'GAME' : 'GAMES'], [o.players, o.players === 1 ? 'PLAYER' : 'PLAYERS'], [o.points, 'POINTS']]);

  if (!ranked.length) return frame(body + text(L.pad, L.bandTop + 40, 'No games were played.', { size: 22, fill: C.muted }), L, opts);

  const close = closestGames(summary, 3);
  body += heading(L.rankCols[0], L.bandTop, ranked.length > 5 ? 'TOP 5' : 'RANKINGS')
    + columns(ranked.slice(0, 5), L.rankCols, L, 'players', (p, x, y) => rankingRow(p, x, y, L.rankW))
    + (close.length
      ? heading(L.matchCols[0], L.bandTop, close.length === 1 ? 'CLOSEST GAME' : 'CLOSEST GAMES')
        + columns(close, L.matchCols, L, 'games', (r, x, y) => matchRow(r, x, y, L.matchW))
      : '');
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

function playerMatchRow(m, x, y) {
  const color = { win: C.green, loss: C.red, none: C.muted }[m.result];
  const score = m.score ?? { win: 'Won', loss: 'Lost', none: '–' }[m.result];
  return text(x + 10, y + 25, { win: 'W', loss: 'L', none: '–' }[m.result], { size: 19, weight: 700, fill: color, anchor: 'middle' })
    + text(x + 38, y + 25, score, { size: 20, weight: 700, fill: C.soft })
    + text(x + 124, y + 25, m.partner ? `with ${fit(m.partner, 14)}` : 'Singles', { size: 20, weight: 500, fill: C.soft })
    + text(x + 330, y + 25, `vs ${fit(m.opponents, 26)}`, { size: 20, weight: 500, fill: C.muted });
}

function playerCard(summary, p, L, opts) {
  const place = Math.min(p.rank, 3);
  const m = MEDAL[place];
  const games = playerMatches(summary, p.name);
  const last = games.slice(L.statsBelow ? -4 : -3); // portrait: 4 rows, landscape: 3 (one column)
  const body = `<circle cx="${L.pad + 13}" cy="${137 + L.top}" r="13" fill="${m}"/>`
    + text(L.pad + 13, 143 + L.top, p.rank, { size: 17, weight: 800, fill: C.bg, anchor: 'middle' })
    + text(L.pad + 36, 142 + L.top, PLACE[place], { size: 15, weight: 700, fill: m, spacing: 4 })
    + text(L.pad, 190 + L.top, fit(p.name, 28), { size: 44, weight: 700 })
    + text(L.pad, 222 + L.top, fit(`${summary.name.trim() || 'Open play'} · ${dateText(summary.endedAt)}`, 60), { size: 19, weight: 500, fill: C.muted })
    + statsRow(L, [[`${p.wins}–${p.losses}`, 'W – L'], [pct(p), 'WIN RATE'], [signed(p.diff), 'PTS +/−', diffColor(p.diff)], [p.played, p.played === 1 ? 'GAME' : 'GAMES']])
    + heading(L.playerCols[0], L.bandTop, games.length > last.length ? `LAST ${last.length} OF ${games.length} GAMES` : 'GAMES')
    + columns(last, L.playerCols, L, 'games', (match, x, y) => playerMatchRow(match, x, y));
  return frame(body, L, opts);
}

/* ---------- All cards ---------- */

// Returns [{ id, title, file, width, height, svg }]: the overall card, then one per top-3 player.
//   orientation: 'portrait' | 'landscape'    background: 'dark' | 'transparent'
//   site: shown in the footer, e.g. "sidecourt.netlify.app"
export function shareCards(summary, { site = '', orientation = 'portrait', background = 'dark' } = {}) {
  const L = LAYOUTS[orientation] ?? LAYOUTS.portrait;
  const opts = { site, background };
  const slug = (summary.name.trim() || 'open-play').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'open-play';
  const top = summary.standings.filter((p) => p.played).slice(0, 3);
  const card = (id, title, svg) => ({ id, title, file: `${slug}-${id}.png`, width: L.W, height: L.H, svg });
  return [
    card('overall', 'Overall', overallCard(summary, L, opts)),
    ...top.map((p, i) => card(`top-${i + 1}`, `Top ${i + 1}: ${p.name}`, playerCard(summary, p, L, opts))),
  ];
}
