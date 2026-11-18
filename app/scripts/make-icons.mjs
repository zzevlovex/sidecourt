// Draws the app icons (the Sidecourt mark: an orange square whose two halves
// are an S and a C) as PNG files in static/, plus static/icon.svg.
// No extra packages: run with  npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { LOGO_SHAPES, LOGO_SIZE, logoPath, logoPolygon } from '../src/lib/logic/logo.js';

const BG = [0x0a, 0x0d, 0x18];
const ORANGE = [0xff, 0x8a, 0x4c];
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Inside a rounded rectangle? (x, y, w, h, r in pixels)
function inRounded(px, py, x, y, w, h, r) {
  if (px < x || py < y || px >= x + w || py >= y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

// Inside a polygon? (even-odd rule)
function inPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const LETTERS = LOGO_SHAPES.map((shape) => logoPolygon(shape));
const SUB = 4; // 4x4 samples per pixel, for smooth edges

// mark: size of the orange square as a share of the icon (smaller for maskable).
function icon(size, { mark, roundedBg }) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const m = size * mark;
  const x0 = (size - m) / 2;
  const toLogo = LOGO_SIZE / m;
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inBg = roundedBg ? inRounded(x + 0.5, y + 0.5, 0, 0, size, size, size * 0.22) : true;
      // How much of this pixel the letters cover (0 to 1).
      let hits = 0;
      if (x + 1 > x0 && x < x0 + m && y + 1 > x0 && y < x0 + m) {
        for (let sy = 0; sy < SUB; sy++) {
          for (let sx = 0; sx < SUB; sx++) {
            const lx = (x + (sx + 0.5) / SUB - x0) * toLogo;
            const ly = (y + (sy + 0.5) / SUB - x0) * toLogo;
            if (LETTERS.some((points) => inPolygon(lx, ly, points))) hits++;
          }
        }
      }
      const cover = hits / (SUB * SUB);
      for (let c = 0; c < 3; c++) raw[o++] = Math.round(BG[c] + (ORANGE[c] - BG[c]) * cover);
      raw[o++] = inBg ? 255 : 0;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../static/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), icon(192, { mark: 0.62, roundedBg: true }));
writeFileSync(new URL('icon-512.png', out), icon(512, { mark: 0.62, roundedBg: true }));
// Maskable: full-bleed background, mark inside the safe zone (Android crops the edges).
writeFileSync(new URL('icon-maskable-512.png', out), icon(512, { mark: 0.5, roundedBg: false }));

// Browser tab icon: the same mark as a small SVG.
const pad = (512 - LOGO_SIZE) / 2;
writeFileSync(new URL('icon.svg', out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${hex(BG)}"/>
  <g transform="translate(${pad} ${pad})" fill="${hex(ORANGE)}">
${LOGO_SHAPES.map((shape) => `    <path d="${logoPath(shape)}"/>`).join('\n')}
  </g>
</svg>
`);
console.log('Icons written to static/');
