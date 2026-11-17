// Draws the app icons (the Sidecourt mark: an orange court split by a net)
// as PNG files in static/. No extra packages: run with  npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x0a, 0x0d, 0x18];
const ORANGE = [0xff, 0x8a, 0x4c];

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

// mark: size of the orange square as a share of the icon (smaller for maskable).
function icon(size, { mark, roundedBg }) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const m = size * mark;
  const x0 = (size - m) / 2;
  const net = m * 0.08;
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const inBg = roundedBg ? inRounded(px, py, 0, 0, size, size, size * 0.22) : true;
      const inMark = inRounded(px, py, x0, x0, m, m, m * 0.25);
      const inNet = Math.abs(px - size / 2) < net / 2;
      const color = inMark && !inNet ? ORANGE : BG;
      raw[o++] = color[0];
      raw[o++] = color[1];
      raw[o++] = color[2];
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
console.log('Icons written to static/');
