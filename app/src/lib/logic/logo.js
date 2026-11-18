// The Sidecourt mark: one rounded square split down the middle, with the left
// half cut into an S and the right half into a C. Drawn once here and used by
// the header, the share cards and the app icons (npm run icons).

export const LOGO_SIZE = 320;

const R = 80; // the square's outer corners
const r = 9; // every other corner: a slight curve

// Each letter is a list of corners [x, y, radius], clockwise.
export const LOGO_SHAPES = [
  // S: a cut from the right near the top, a cut from the left near the bottom
  [[0, 0, R], [147, 0, r], [147, 80, r], [80, 80, r], [80, 120, r], [147, 120, r], [147, 320, r], [0, 320, R], [0, 240, r], [67, 240, r], [67, 200, r], [0, 200, r]],
  // C: a hollow middle with a mouth on the right; the two ends turn inward
  [[173, 0, r], [320, 0, R], [320, 104, r], [288, 104, r], [288, 80, r], [245, 80, r], [245, 240, r], [288, 240, r], [288, 216, r], [320, 216, r], [320, 320, R], [173, 320, r]],
];

// For each corner: where its curve starts (a) and ends (b), and which way it turns.
function corners(shape) {
  return shape.map(([x, y, rad], i) => {
    const [px, py] = shape[(i + shape.length - 1) % shape.length];
    const [nx, ny] = shape[(i + 1) % shape.length];
    const toward = (tx, ty) => {
      const len = Math.hypot(tx - x, ty - y);
      return [x + ((tx - x) / len) * rad, y + ((ty - y) / len) * rad];
    };
    const turn = (x - px) * (ny - y) - (y - py) * (nx - x);
    return { v: [x, y], a: toward(px, py), b: toward(nx, ny), rad, sweep: turn > 0 ? 1 : 0 };
  });
}

const n = (value) => Number(value.toFixed(2));

// SVG path data for one letter.
export function logoPath(shape) {
  return `${corners(shape).map((c, i) => `${i ? 'L' : 'M'}${n(c.a[0])} ${n(c.a[1])}A${c.rad} ${c.rad} 0 0 ${c.sweep} ${n(c.b[0])} ${n(c.b[1])}`).join('')}Z`;
}

// The same outline as straight segments (curves sampled), for drawing pixels.
export function logoPolygon(shape, steps = 8) {
  const points = [];
  corners(shape).forEach(({ v, a, b }) => {
    const c = [a[0] + b[0] - v[0], a[1] + b[1] - v[1]]; // centre of the corner's circle
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * (Math.PI / 2);
      points.push([c[0] + (a[0] - c[0]) * Math.cos(t) + (b[0] - c[0]) * Math.sin(t), c[1] + (a[1] - c[1]) * Math.cos(t) + (b[1] - c[1]) * Math.sin(t)]);
    }
  });
  return points;
}
