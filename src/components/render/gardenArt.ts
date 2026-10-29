import Phaser from 'phaser';
import { floorDepth } from '../../utils/iso';
import type { Footprint } from '../../utils/tile';
import type { FloorTileView } from './WorldRenderer';
import { bakeImage, bakeLayer, block, dot, face, INK, oval, point, rr, screenBox, shadow, tri } from './incidentArt';

/**
 * The cloud ground of the other world (chapter 2, the road of rebirth), drawn in
 * code in the same cozy style as the street: cream cloud ground, a rainbow
 * stream with golden bridges, blossom trees, marble columns and the heaven door.
 * Static parts are baked; the road's people and walls are in `trialArt.ts`.
 */
export const GARDEN_BACKGROUND = 0xe6efff;

/** Each sense stone's colour (also its sparks and its HUD gem). */
export const STONE_COLOR: Record<string, number> = { stone_sight: 0xf6a6d0, stone_hearing: 0xffd25e, stone_touch: 0x6fd3c0 };
const RAINBOW = [0xffb3b3, 0xffd8a8, 0xfff1a8, 0xc8f0b0, 0xb3e0ff, 0xd5c4ff];

export function cloud(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, alpha = 1): void {
  g.fillStyle(0xffffff, alpha);
  for (const [dx, dy, r] of [[-1, 0, .7], [0, -.35, .85], [1, 0, .7], [0, .2, .8]] as const) g.fillCircle(x + dx * s, y + dy * s, r * s);
}

export function drawGardenEnvironment(scene: Phaser.Scene, floor: FloorTileView[]): void {
  const w = Math.max(...floor.map((t) => t.tile.x)) + 1, h = Math.max(...floor.map((t) => t.tile.y)) + 1;
  bakeLayer(scene, 'garden:ground', screenBox([[-5, -5], [w + 5, -5], [-5, h + 5], [w + 5, h + 5]], 0, 0), floorDepth - .8, (g) => {
    // Clouds all around the island.
    for (let i = 0; i < 70; i++) {
      const x = -4 + ((i * 7.31) % (w + 8)), y = -4 + ((i * 3.77) % (h + 8));
      if (x > 0 && x < w && y > 0 && y < h) continue;
      const p = point(x, y);
      cloud(g, p.x, p.y, 40 + (i % 4) * 14, .85);
    }
    for (const t of floor) {
      const { x, y } = t.tile;
      const n = ((x * 17 + y * 31) % 7 + 7) % 7;
      if (t.kind === 'forest_edge') {
        // The island's rim: soft cloud banks.
        face(g, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], [0xffffff, 0xf7f9ff, 0xf1f5ff][n % 3]!, 1, 0);
        const p = point(x + .5, y + .5);
        cloud(g, p.x, p.y - 6, 22 + (n % 3) * 4);
      } else if (t.kind === 'stream') {
        // A rainbow stream: the colour shifts along it.
        face(g, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], RAINBOW[x % RAINBOW.length]!, 1, 0);
        const p = point(x + .5, y + .5);
        g.lineStyle(2, 0xffffff, .8).lineBetween(p.x - 16, p.y, p.x + 10, p.y - 4);
      } else if (t.kind === 'bridge') {
        face(g, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], 0xf2c45a, 1, 2);
        for (let k = .2; k < 1; k += .2) face(g, [[x + k, y + .05], [x + k + .04, y + .05], [x + k + .04, y + .95], [x + k, y + .95]], 0xd9a441, 1, 0);
      } else {
        // Cream cloud ground with a soft checker and a few flowers.
        face(g, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], (x + y) % 2 ? 0xfffaf0 : 0xfdf2df, 1, 0);
        g.lineStyle(1, 0xead9bd, .8).strokePoints([point(x, y), point(x + 1, y), point(x + 1, y + 1), point(x, y + 1)], true);
        if (n === 0 || n === 4) {
          const p = point(x + .3 + (n % 3) * .2, y + .6);
          for (let i = 0; i < 3; i++) g.fillStyle([0xf6a6d0, 0xffd25e, 0xb3e0ff][(i + n) % 3]!).fillCircle(p.x + i * 9 - 9, p.y + (i % 2) * 4, 3.5);
        }
      }
    }
    // Stream banks.
    for (const t of floor) {
      if (t.kind !== 'stream' && t.kind !== 'bridge') continue;
      const { x, y } = t.tile;
      g.lineStyle(3, INK, .7).lineBetween(point(x, y).x, point(x, y).y, point(x + 1, y).x, point(x + 1, y).y);
      g.lineStyle(3, INK, .7).lineBetween(point(x, y + 1).x, point(x, y + 1).y, point(x + 1, y + 1).x, point(x + 1, y + 1).y);
    }
  }, .7);
}

/** A sense stone as a tall faceted crystal on a little plinth; bright once woken. */
function crystal(g: Phaser.GameObjects.Graphics, f: Footprint, color: number, lit: boolean): void {
  const c = point(f.x + .5, f.y + .5);
  if (lit) g.fillStyle(color, .35).fillEllipse(c.x, c.y, 120, 52);
  shadow(g, c.x, c.y + 2, 70, 26);
  block(g, { x: f.x + .2, y: f.y + .2, w: .6, h: .6 }, 0, 14, 0xf3e7d3);
  const body = lit ? color : Phaser.Display.Color.ValueToColor(color).desaturate(30).lighten(12).color;
  tri(g, [c.x - 22, c.y - 14, c.x, c.y - 14, c.x - 4, c.y - 96], body);
  tri(g, [c.x, c.y - 14, c.x + 22, c.y - 14, c.x - 4, c.y - 96], Phaser.Display.Color.ValueToColor(body).darken(10).color);
  tri(g, [c.x - 22, c.y - 14, c.x + 22, c.y - 14, c.x, c.y], Phaser.Display.Color.ValueToColor(body).darken(18).color);
  g.lineStyle(3, 0xffffff, lit ? .9 : .5).lineBetween(c.x - 12, c.y - 26, c.x - 6, c.y - 70);
}

/** The heaven door on a cloud: a golden arch, two cream leaves (open: light pours out). */
function heavenDoor(g: Phaser.GameObjects.Graphics, f: Footprint, open: boolean): void {
  const c = point(f.x + f.w / 2, f.y + f.h / 2);
  cloud(g, c.x, c.y + 6, 60);
  const W = 120, H = 200, x = c.x - W / 2, y = c.y - H - 6;
  if (open) {
    g.fillStyle(0xfff6d8).fillRoundedRect(x, y, W, H, { tl: W / 2, tr: W / 2, bl: 6, br: 6 });
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .28; g.fillStyle(0xffd25e, .35).fillTriangle(c.x, y + H * .55, c.x + Math.cos(a) * 180, y + H * .55 + Math.sin(a) * 180, c.x + Math.cos(a + .12) * 180, y + H * .55 + Math.sin(a + .12) * 180); }
    // Leaves swung out to the sides.
    rr(g, x - 30, y + 30, 26, H - 34, 8, 0xfff3d6);
    rr(g, x + W + 4, y + 30, 26, H - 34, 8, 0xfff3d6);
  } else {
    g.fillStyle(0xfff3d6).fillRoundedRect(x, y, W, H, { tl: W / 2, tr: W / 2, bl: 6, br: 6 });
    g.lineStyle(3, INK).lineBetween(c.x, y + 8, c.x, y + H);
    for (const s of [-1, 1]) { dot(g, c.x + s * 12, y + H * .58, 7, 0xf2c45a); }
    for (const [dx, dy] of [[-28, 60], [26, 70], [0, 40]] as const) dot(g, c.x + dx, y + dy, 4, 0xffd25e);
  }
  g.lineStyle(10, 0xf2c45a).strokeRoundedRect(x, y, W, H, { tl: W / 2, tr: W / 2, bl: 6, br: 6 });
  g.lineStyle(3, INK).strokeRoundedRect(x - 5, y - 5, W + 10, H + 10, { tl: W / 2 + 5, tr: W / 2 + 5, bl: 8, br: 8 });
  dot(g, c.x, y - 8, 12, 0xffd25e);
}

/** Pastel blossom tree. */
function blossom(g: Phaser.GameObjects.Graphics, f: Footprint): void {
  const p = point(f.x + .5, f.y + .5);
  shadow(g, p.x, p.y, 76, 26);
  rr(g, p.x - 6, p.y - 40, 12, 40, 4, 0xc08552);
  for (const [dx, dy, r, col] of [[-20, -54, 24, 0xf8c8dc], [20, -56, 24, 0xf8c8dc], [0, -76, 28, 0xfbd9e6]] as const) dot(g, p.x + dx, p.y + dy, r, col);
  for (let i = 0; i < 6; i++) g.fillStyle(0xffffff).fillCircle(p.x - 24 + i * 10, p.y - 60 - (i % 2) * 14, 3);
}

/** White marble column with a gold cap. */
function column(g: Phaser.GameObjects.Graphics, f: Footprint): void {
  block(g, { x: f.x + .2, y: f.y + .2, w: .6, h: .6 }, 0, 10, 0xf3e7d3);
  block(g, { x: f.x + .3, y: f.y + .3, w: .4, h: .4 }, 10, 80, 0xffffff);
  block(g, { x: f.x + .22, y: f.y + .22, w: .56, h: .56 }, 90, 10, 0xf2c45a);
}

/** The memory cherry: a big shiny coffee cherry on a leaf. */
function cherry(g: Phaser.GameObjects.Graphics, f: Footprint): void {
  const p = point(f.x + .5, f.y + .5);
  g.fillStyle(0xffd25e, .3).fillEllipse(p.x, p.y, 70, 30);
  oval(g, p.x + 10, p.y - 8, 34, 14, 0x7cc47f);
  dot(g, p.x - 4, p.y - 22, 14, 0xe2513f);
  g.fillStyle(0xffffff, .8).fillCircle(p.x - 9, p.y - 27, 4);
}

/** A chapter-2 map object baked into one image (the variant picks lit / open / taken); null for others. */
export function bakeGardenObject(scene: Phaser.Scene, id: string, type: string, f: Footprint, variant: string, depth: number): Phaser.GameObjects.Image | null {
  const draw: ((g: Phaser.GameObjects.Graphics) => void) | null =
    type === 'sense_stone' ? (g) => crystal(g, f, STONE_COLOR[id] ?? 0xb3e0ff, variant === 'ACTIVATED')
    : type === 'portal' ? (g) => heavenDoor(g, f, variant === 'open')
    : type === 'tree' ? (g) => blossom(g, f)
    : type === 'ancient_pillar' ? (g) => column(g, f)
    : type === 'hidden_cherry' ? (g) => { if (variant !== 'taken') cherry(g, f); }
    : null;
  if (!draw) return null;
  const b = screenBox([[f.x, f.y], [f.x + f.w, f.y], [f.x, f.y + f.h], [f.x + f.w, f.y + f.h]], 260, 200);
  return bakeImage(scene, `garden:obj:${id}:${variant}`, b, depth, draw);
}
