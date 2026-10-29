import Phaser from 'phaser';
import { worldToScreen } from '../../utils/iso';

export const STREET_PAVING = { stone: 0xd8c7ac, joint: 0x9b8c75, asphalt: 0x70716b, kerb: 0xc9b89b } as const;
const grain = (x: number, y: number, salt: number) => {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
const point = (x: number, y: number, lift = 0) => {
  const p = worldToScreen({ x, y });
  return new Phaser.Math.Vector2(p.x, p.y - lift);
};

/** Two staggered rectangular pavers share the actual map plane, without a raised tile border. */
export function streetPaver(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  const corners = [point(x, y), point(x + 1, y), point(x + 1, y + 1), point(x, y + 1)];
  const stones = [0xd8c7ac, 0xd2c0a4, 0xdfceb4, 0xcebea5, 0xd9cbb5];
  g.fillStyle(stones[Math.floor(grain(x, y, 1) * stones.length) % stones.length]!).fillPoints(corners, true);
  g.lineStyle(1.1, STREET_PAVING.joint, .62).strokePoints(corners, true);
  const a = point(x, y + .5), b = point(x + 1, y + .5);
  g.lineBetween(a.x, a.y, b.x, b.y);
  for (const [u, v] of [[.3, 0], [.7, .5]]) {
    const c = point(x + u!, y + v!), d = point(x + u!, y + v! + .5);
    g.lineBetween(c.x, c.y, d.x, d.y);
  }
  const a0 = point(x + .08, y + .08), a1 = point(x + .88, y + .08);
  g.lineStyle(1, 0xfffaf0, .5).lineBetween(a0.x, a0.y, a1.x, a1.y);
  for (let i = 0; i < 12; i++) {
    const p = point(x + grain(x, y, i * 3 + 20), y + grain(x, y, i * 3 + 21));
    g.fillStyle(i % 3 ? 0x96836a : 0xf5e7cc, .2).fillEllipse(p.x, p.y, .7 + grain(x, y, i + 60) * 1.5, .6);
  }
}

/** Stable world-space grain and wear, without painting a checkerboard of road tiles. */
export function streetAsphalt(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y0: number, y1: number, density = 28): void {
  g.fillStyle(STREET_PAVING.asphalt).fillPoints([point(x0, y0), point(x1, y0), point(x1, y1), point(x0, y1)], true);
  if (density === 0) return; // Bitmap material already covers this base fill.
  for (let x = Math.floor(x0); x < x1; x++) for (let y = Math.floor(y0); y < y1; y++) {
    for (let i = 0; i < density; i++) {
      const u = x + grain(x, y, i * 3 + 1), v = y + grain(x, y, i * 3 + 2);
      if (u < x0 || u > x1 || v < y0 || v > y1) continue;
      const p = point(u, v), light = i % 4 === 0;
      g.fillStyle(light ? 0xc5b89c : 0x393e3b, light ? .24 : .18).fillEllipse(p.x, p.y, .8 + grain(x, y, i * 3 + 3) * 1.7, .6);
    }
    if (x >= x0 && x + 1 <= x1 && y >= y0 && y + 1 <= y1 && grain(x, y, 111) < .1) {
      const a = point(x + .18, y + .2), b = point(x + .45, y + .39), c = point(x + .37, y + .73);
      g.lineStyle(.8, 0x393d36, .4).beginPath().moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).strokePath();
    }
  }
}

/** Flat infrastructure; visual detail never blocks a walking route. */
export function streetDrain(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  const rect = (a: number, b: number, c: number, d: number) => [point(x + a, y + b), point(x + c, y + b), point(x + c, y + d), point(x + a, y + d)];
  g.fillStyle(0xb7a98e).fillPoints(rect(-.06, -.04, .68, .28), true);
  g.fillStyle(0x454941).fillPoints(rect(0, 0, .62, .24), true);
  for (let i = 1; i < 8; i++) {
    const a = point(x + i * .075, y + .02), b = point(x + i * .075, y + .22);
    g.lineStyle(1.2, 0x9a9888).lineBetween(a.x, a.y, b.x, b.y);
  }
}

export function streetManhole(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  const p = point(x, y);
  g.fillStyle(0xa69880).fillEllipse(p.x, p.y, 43, 22);
  g.fillStyle(0x77796b).fillEllipse(p.x, p.y, 35, 17).lineStyle(1.3, 0x484e43).strokeEllipse(p.x, p.y, 35, 17);
  for (let i = -2; i <= 2; i++) g.lineStyle(.8, 0x484e43, .65).lineBetween(p.x - 10, p.y + i * 2, p.x + 10, p.y + i * 2);
}

/**
 * The kerb along a sidewalk edge at row `y`, a narrow stone strip. `road` is which way the road lies (+1: south of
 * the kerb, -1: north). Facing south, its raised face shows to the camera; facing north it is hidden behind the top,
 * and only a thin shadow line on the asphalt marks the step down.
 */
export function streetKerb(g: Phaser.GameObjects.Graphics, from: number, to: number, y: number, road: 1 | -1 = 1): void {
  const top = [point(from, y - .08, 3), point(to, y - .08, 3), point(to, y + .08, 3), point(from, y + .08, 3)];
  g.fillStyle(STREET_PAVING.kerb).fillPoints(top, true);
  if (road > 0) g.fillStyle(0xb7ac95).fillPoints([point(from, y + .08, 3), point(to, y + .08, 3), point(to, y + .08), point(from, y + .08)], true);
  else g.fillStyle(0x6f7a7d, .55).fillPoints([point(from, y - .08), point(to, y - .08), point(to, y - .16), point(from, y - .16)], true);
  for (let x = Math.ceil(from); x < to; x += .75) {
    const a = point(x, y - .08, 3), b = point(x, y + .08, 3);
    g.lineStyle(.8, 0xa79a82, .6).lineBetween(a.x, a.y, b.x, b.y);
  }
}

/** Centre-line dashes along row `y`, every 3 tiles, the same on every road; `skip` leaves gaps (a zebra crossing). */
export function roadDashes(g: Phaser.GameObjects.Graphics, from: number, to: number, y: number, skip: (x: number) => boolean = () => false): void {
  g.fillStyle(0xe5dbc2, .76);
  for (let x = Math.ceil(from); x < to; x++) {
    if (((x % 3) + 3) % 3 !== 1 || skip(x)) continue;
    g.fillPoints([point(x + .15, y - .04), point(x + .95, y - .04), point(x + .95, y + .04), point(x + .15, y + .04)], true);
  }
}
