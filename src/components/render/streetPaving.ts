import Phaser from 'phaser';
import { worldToScreen } from '../../utils/iso';

export const STREET_PAVING = { stone: 0xeee3ce, joint: 0xbfae91, asphalt: 0x8c989c, kerb: 0xe0d3b7 } as const;
const point = (x: number, y: number, lift = 0) => {
  const p = worldToScreen({ x, y });
  return new Phaser.Math.Vector2(p.x, p.y - lift);
};

/** Two staggered rectangular pavers share the actual map plane, without a raised tile border. */
export function streetPaver(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  const corners = [point(x, y), point(x + 1, y), point(x + 1, y + 1), point(x, y + 1)];
  g.fillStyle(STREET_PAVING.stone).fillPoints(corners, true);
  g.lineStyle(.9, STREET_PAVING.joint, .46).strokePoints(corners, true);
  const a = point(x, y + .5), b = point(x + 1, y + .5);
  g.lineBetween(a.x, a.y, b.x, b.y);
  for (const [u, v] of [[.3, 0], [.7, .5]]) {
    const c = point(x + u!, y + v!), d = point(x + u!, y + v! + .5);
    g.lineBetween(c.x, c.y, d.x, d.y);
  }
  const a0 = point(x + .08, y + .08), a1 = point(x + .88, y + .08);
  g.lineStyle(1, 0xfffaf0, .5).lineBetween(a0.x, a0.y, a1.x, a1.y);
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
  g.fillStyle(0xffffff, .95);
  for (let x = Math.ceil(from); x < to; x++) {
    if (((x % 3) + 3) % 3 !== 1 || skip(x)) continue;
    g.fillPoints([point(x + .15, y - .04), point(x + .95, y - .04), point(x + .95, y + .04), point(x + .15, y + .04)], true);
  }
}
