import Phaser from 'phaser';
import { actorDepth, floorDepth, worldToScreen } from '../../utils/iso';
import type { HazardView, RunView } from '../../gameplay/story/RunService';
import type { Footprint, WorldPos } from '../../utils/tile';
import type { ActorView, ActorViewState, FloorTileView } from './WorldRenderer';
import { TERRAIN_COLORS } from './placeholderStyles';

/**
 * Chapter 1 street on a sunny afternoon, drawn in code in the cozy diorama
 * style: flat pastel colours, chocolate outlines, soft shadows. Coordinates
 * and collisions remain owned by the map.
 */
export const INK = 0x5a3825;
const SKY = 0xdff1f7;
/** Camera background beyond the drawn surroundings. */
export const STREET_BACKGROUND = SKY;

export const point = (x: number, y: number, z = 0) => { const p = worldToScreen({ x, y }); return new Phaser.Math.Vector2(p.x, p.y - z); };
export function face(g: Phaser.GameObjects.Graphics, coords: number[][], color: number, alpha = 1, outline = 2): void {
  const pts = coords.map(([x, y, z]) => point(x!, y!, z));
  g.fillStyle(color, alpha).fillPoints(pts, true);
  if (outline > 0) g.lineStyle(outline, INK, 1).strokePoints(pts, true);
}
export const shadeOf = (c: number, f: number) => Phaser.Display.Color.ValueToColor(c)[f < 0 ? 'darken' : 'lighten'](Math.abs(f)).color;
/** Box with its two camera-facing sides and top, each outlined. */
export function block(g: Phaser.GameObjects.Graphics, f: Footprint, z: number, h: number, color: number, outline = 2): void {
  const { x, y, w, h: d } = f;
  face(g, [[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]], color, 1, outline);
  face(g, [[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]], shadeOf(color, -14), 1, outline);
  face(g, [[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]], shadeOf(color, 10), 1, outline);
}
/** Soft contact shadow under an object. */
export const shadow = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) => g.fillStyle(INK, 0.16).fillEllipse(x, y, w, h);

/** Filled + outlined screen-space shapes for the chapter-1 targets. */
export const rr = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, color: number) =>
  g.fillStyle(color).fillRoundedRect(x, y, w, h, r).lineStyle(2.5, INK).strokeRoundedRect(x, y, w, h, r);
export const dot = (g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number) =>
  g.fillStyle(color).fillCircle(x, y, r).lineStyle(2.5, INK).strokeCircle(x, y, r);
export const oval = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number) =>
  g.fillStyle(color).fillEllipse(x, y, w, h).lineStyle(2.5, INK).strokeEllipse(x, y, w, h);
export const tri = (g: Phaser.GameObjects.Graphics, a: number[], color: number) =>
  g.fillStyle(color).fillTriangle(a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!).lineStyle(2.5, INK).strokeTriangle(a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!);
/** Small wheeled street cart with a striped awning: shared by the tea, spicy and coffee stalls. */
function cart(g: Phaser.GameObjects.Graphics, x: number, y: number, body: number, stripe: number): void {
  shadow(g, x, y + 4, 110, 34);
  rr(g, x - 44, y - 50, 88, 46, 8, body);
  dot(g, x - 28, y - 4, 9, 0x6b6b75); dot(g, x + 28, y - 4, 9, 0x6b6b75);
  g.lineStyle(3, INK).lineBetween(x - 38, y - 50, x - 38, y - 108).lineBetween(x + 38, y - 50, x + 38, y - 108);
  for (let i = 0; i < 4; i++) rr(g, x - 52 + i * 26, y - 124, 26, 18, i === 0 ? 6 : i === 3 ? 6 : 0, i % 2 ? 0xffffff : stripe);
}

/** Awning colour and stripe of each chapter-1 stall (its id). */
const STALL_COLORS: Record<string, [number, number]> = {
  tra_da: [0xe2513f, 0xffffff], bao: [0x5ec8f2, 0xffffff], pho: [0xffd25e, 0xe2513f], bun_dau: [0x7cc47f, 0xffffff],
  banh_mi: [0xffa24c, 0xffffff], cat_toc: [0xf6a6d0, 0xffffff], xe_om: [0x6fd3c0, 0xffffff], xoi: [0xb39ddb, 0xffffff],
};

/** Pavement stall: a low counter with its goods under a striped awning (placeholder until the 3D art). */
function stall(g: Phaser.GameObjects.Graphics, f: Footprint, variant: string): void {
  const [col, stripe] = STALL_COLORS[variant] ?? [0xf0c27a, 0xffffff];
  const c = point(f.x + f.w / 2, f.y + f.h / 2);
  shadow(g, c.x, c.y + 4, 150, 46);
  block(g, { x: f.x + .1, y: f.y + .2, w: f.w - .2, h: f.h - .4 }, 0, 30, 0xc98a55, 2);
  for (let i = 0; i < 3; i++) { const q = point(f.x + .45 + i * .55, f.y + .5, 34); dot(g, q.x, q.y - 4, 7, [0xffffff, 0xffd25e, 0xff8a73][i]!); }
  for (const x of [f.x + .15, f.x + f.w - .15]) { const a = point(x, f.y + f.h - .1), b = point(x, f.y + f.h - .1, 92); g.lineStyle(3, INK).lineBetween(a.x, a.y, b.x, b.y); }
  for (let i = 0; i < 4; i++) {
    const x0 = f.x + (i * f.w) / 4, x1 = x0 + f.w / 4;
    face(g, [[x0, f.y - .1, 104], [x1, f.y - .1, 104], [x1, f.y + f.h + .15, 88], [x0, f.y + f.h + .15, 88]], i % 2 ? stripe : col, 1, 2);
  }
}

/** The chapter-1 target, drawn for the situation the fate card dealt (`variant` is its id). */
function drawTarget(g: Phaser.GameObjects.Graphics, variant: string, c: Phaser.Math.Vector2): void {
  const { x, y } = c;
  switch (variant) {
    case 'money': {
      // The banana peel is right next to it: the joke is in plain sight.
      shadow(g, x, y + 2, 60, 16);
      g.fillStyle(0x9ad67c).fillPoints([new Phaser.Math.Vector2(x - 28, y - 6), new Phaser.Math.Vector2(x + 4, y - 22), new Phaser.Math.Vector2(x + 30, y - 10), new Phaser.Math.Vector2(x - 2, y + 6)], true);
      g.lineStyle(2.5, INK).strokePoints([new Phaser.Math.Vector2(x - 28, y - 6), new Phaser.Math.Vector2(x + 4, y - 22), new Phaser.Math.Vector2(x + 30, y - 10), new Phaser.Math.Vector2(x - 2, y + 6)], true);
      oval(g, x + 1, y - 8, 18, 10, 0xc9ecd9);
      g.fillStyle(0xffd25e).lineStyle(2.5, INK);
      for (const [dx, dy] of [[-30, 12], [-20, 18], [-40, 18]] as const) g.fillEllipse(x + dx, y + dy, 22, 9).strokeEllipse(x + dx, y + dy, 22, 9);
      return;
    }
    case 'bubble_tea': {
      cart(g, x, y, 0xf6a6d0, 0xff8a73);
      rr(g, x - 16, y - 96, 32, 44, 6, 0xf3dfc1);
      g.fillStyle(INK); for (const [dx, dy] of [[-8, -60], [0, -64], [8, -59], [-4, -70], [6, -71]]) g.fillCircle(x + dx!, y + dy!, 3.5);
      oval(g, x, y - 96, 32, 9, 0xfff6e5);
      g.lineStyle(4, INK).lineBetween(x + 6, y - 96, x + 12, y - 116);
      return;
    }
    case 'selfie': {
      // Photo frame on a stand, an open manhole right behind it.
      oval(g, x + 18, y - 14, 52, 22, 0x3d3d48);
      g.lineStyle(3, INK).lineBetween(x - 26, y + 2, x - 26, y - 36);
      rr(g, x - 52, y - 98, 52, 64, 6, 0xffd25e);
      rr(g, x - 44, y - 90, 36, 48, 4, 0xbfe6f5);
      dot(g, x - 26, y - 104, 8, 0xff8a73);
      return;
    }
    case 'pigeons': {
      for (const [dx, dy, f] of [[-24, 0, 1], [10, -12, -1], [26, 8, 1], [-4, 16, -1]] as const) {
        shadow(g, x + dx, y + dy + 2, 28, 9);
        oval(g, x + dx, y + dy - 10, 26, 18, 0xc5cad6);
        dot(g, x + dx + f * 12, y + dy - 22, 7, 0xb1b7c6);
        tri(g, [x + dx + f * 18, y + dy - 23, x + dx + f * 25, y + dy - 21, x + dx + f * 18, y + dy - 19], 0xffc94a);
        g.fillStyle(INK).fillCircle(x + dx + f * 13, y + dy - 24, 1.6);
      }
      g.fillStyle(0xe6b27a); for (const [dx, dy] of [[-10, 8], [0, 4], [14, -2], [-16, -6], [4, 14]]) g.fillCircle(x + dx!, y + dy!, 2.5);
      return;
    }
    case 'durian': {
      shadow(g, x, y + 4, 110, 34);
      rr(g, x - 46, y - 40, 92, 36, 6, 0xc08552);
      const durian = (dx: number, dy: number, r: number) => {
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; tri(g, [x + dx + Math.cos(a) * r, y + dy + Math.sin(a) * r, x + dx + Math.cos(a + .3) * r, y + dy + Math.sin(a + .3) * r, x + dx + Math.cos(a + .15) * (r + 7), y + dy + Math.sin(a + .15) * (r + 7)], 0x9ccf5c); }
        dot(g, x + dx, y + dy, r, 0xb4dc74);
      };
      durian(-22, -50, 13); durian(4, -52, 13); durian(26, -48, 12);
      g.lineStyle(3, INK).lineBetween(x - 40, y - 40, x - 40, y - 104).lineBetween(x + 40, y - 40, x + 40, y - 104);
      rr(g, x - 54, y - 118, 108, 16, 6, 0x6fd3c0);
      durian(18, -134, 15); // the one that will fall
      return;
    }
    case 'wifi': {
      shadow(g, x, y + 2, 60, 18);
      g.lineStyle(5, INK).lineBetween(x, y, x, y - 92);
      g.lineStyle(3, 0x7d8fa3).lineBetween(x, y - 2, x, y - 90);
      rr(g, x - 40, y - 140, 80, 52, 10, 0x5ec8f2);
      g.lineStyle(4, 0xffffff);
      for (const r of [8, 16, 24]) g.beginPath().arc(x, y - 98, r, Math.PI * 1.2, Math.PI * 1.8).strokePath();
      g.fillStyle(0xffffff).fillCircle(x, y - 98, 3.5);
      return;
    }
    case 'spicy': {
      cart(g, x, y, 0xff8a73, 0xffd25e);
      oval(g, x, y - 62, 44, 18, 0xffffff);
      g.fillStyle(0xf26b5b).fillEllipse(x, y - 64, 34, 10);
      for (const dx of [-24, 0, 24]) tri(g, [x + dx - 6, y - 30, x + dx + 6, y - 30, x + dx, y - 44], 0xffc94a);
      return;
    }
    case 'lottery': {
      // The ticket lady on a stool, conical hat, a fan of tickets.
      shadow(g, x, y + 2, 64, 20);
      rr(g, x - 14, y - 20, 28, 18, 4, 0x6fd3c0);
      rr(g, x - 17, y - 58, 34, 40, 12, 0xc9ecd9);
      dot(g, x, y - 70, 12, 0xf6d2b0);
      tri(g, [x - 30, y - 76, x + 30, y - 76, x, y - 100], 0xf3dfc1);
      for (let i = 0; i < 4; i++) rr(g, x + 10 + i * 5, y - 56 - i * 4, 18, 12, 2, i % 2 ? 0xfff6e5 : 0xffd25e);
      return;
    }
    case 'coffee': {
      cart(g, x, y, 0xc08552, 0x5a3825);
      rr(g, x - 14, y - 92, 28, 30, 6, 0xffffff);
      g.lineStyle(3, INK).beginPath().arc(x + 16, y - 78, 7, -Math.PI / 2, Math.PI / 2).strokePath();
      g.fillStyle(0x6b4226).fillEllipse(x, y - 90, 22, 6);
      g.lineStyle(2, 0xffffff, .9);
      for (const dx of [-6, 4]) g.beginPath().moveTo(x + dx, y - 98).lineTo(x + dx + 4, y - 106).lineTo(x + dx, y - 114).strokePath();
      return;
    }
    default: drawKitten(g, c);
  }
}

function drawKitten(g: Phaser.GameObjects.Graphics, c: Phaser.Math.Vector2): void {
    shadow(g, c.x, c.y, 46, 18);
    g.lineStyle(7, INK).beginPath().moveTo(c.x + 8, c.y - 10).lineTo(c.x + 25, c.y - 18).lineTo(c.x + 24, c.y - 31).strokePath();
    g.lineStyle(4, 0xf2a65a).beginPath().moveTo(c.x + 8, c.y - 10).lineTo(c.x + 25, c.y - 18).lineTo(c.x + 24, c.y - 31).strokePath();
    g.fillStyle(0xffd6a0).lineStyle(2.5, INK);
    g.fillEllipse(c.x, c.y - 15, 28, 30).strokeEllipse(c.x, c.y - 15, 28, 30);
    g.fillTriangle(c.x-19,c.y-44,c.x-16,c.y-63,c.x-4,c.y-48).strokeTriangle(c.x-19,c.y-44,c.x-16,c.y-63,c.x-4,c.y-48);
    g.fillTriangle(c.x+4,c.y-48,c.x+16,c.y-61,c.x+14,c.y-42).strokeTriangle(c.x+4,c.y-48,c.x+16,c.y-61,c.x+14,c.y-42);
    g.fillCircle(c.x - 3, c.y - 35, 18).strokeCircle(c.x - 3, c.y - 35, 18);
    g.fillStyle(0xff9e8a).fillTriangle(c.x-16,c.y-46,c.x-14,c.y-56,c.x-9,c.y-48).fillTriangle(c.x+6,c.y-48,c.x+13,c.y-55,c.x+12,c.y-45);
    g.fillStyle(0xf2a65a).fillEllipse(c.x - 3, c.y - 50, 12, 6);
    g.fillStyle(INK).fillCircle(c.x-10,c.y-36,2.8).fillCircle(c.x+4,c.y-36,2.8);
    g.fillStyle(0xff9e8a, .7).fillCircle(c.x-14,c.y-29,3.5).fillCircle(c.x+8,c.y-29,3.5);
    g.lineStyle(1.5, INK).lineBetween(c.x-12,c.y-28,c.x-27,c.y-31).lineBetween(c.x+7,c.y-28,c.x+23,c.y-30);
}

/**
 * Code-drawn street props. Returns false for types this file does not draw.
 * Chapter-1 street props (`street_prop`) are drawn by `variant`, their situation id; `rescued` hides the kitten once it is held.
 */
export function drawIncidentObject(g: Phaser.GameObjects.Graphics, type: string, f: Footprint, variant: string): boolean {
  const c = point(f.x + f.w / 2, f.y + f.h / 2);
  if (type === 'street_prop' || type === 'kitten') {
    if (variant !== 'rescued') drawTarget(g, variant, c);
    return true;
  }
  if (type === 'stall') {
    stall(g, f, variant);
    return true;
  }
  // Street furniture that blocks the way: sấu trees by the lake, iced-tea stools, parked motorbikes.
  if (type === 'sau_tree') {
    tree(g, f.x + .5, f.y + .5, 1.1);
    return true;
  }
  if (type === 'stools') {
    for (const [dx, dy, col] of [[.15, .2, 0xe2513f], [.55, .3, 0x5ec8f2], [.3, .6, 0xe2513f]] as const) block(g, { x: f.x + dx, y: f.y + dy, w: .22, h: .22 }, 0, 16, col, 1.5);
    const q = point(f.x + .5, f.y + .5, 22);
    g.fillStyle(0xf6d77a, .85).fillRect(q.x - 4, q.y - 8, 8, 10).lineStyle(1.5, INK).strokeRect(q.x - 4, q.y - 8, 8, 10);
    return true;
  }
  if (type === 'parked_bike') {
    motorbike(g, c.x, c.y + 6, 1, [0xff8a73, 0x5ec8f2, 0xf6a6d0][Math.floor(f.x) % 3]!, 0xffffff);
    return true;
  }
  if (type === 'car') {
    shadow(g, c.x, c.y + 4, 150, 50);
    block(g,{...f,x:f.x+.08,y:f.y+.08,w:f.w-.16,h:f.h-.16},12,26,0xff8a73);
    block(g,{x:f.x+.5,y:f.y+.14,w:f.w*.48,h:f.h-.28},38,24,0xfff1e0);
    face(g,[[f.x+.56,f.y+f.h-.14,42],[f.x+1.42,f.y+f.h-.14,42],[f.x+1.42,f.y+f.h-.14,58],[f.x+.56,f.y+f.h-.14,58]],0xa8dcf0);
    face(g,[[f.x+.5+f.w*.48,f.y+.24,42],[f.x+.5+f.w*.48,f.y+f.h-.24,42],[f.x+.5+f.w*.48,f.y+f.h-.24,58],[f.x+.5+f.w*.48,f.y+.24,58]],0x8fd0ea);
    for (const x of [f.x+.38,f.x+f.w-.38]) { const p=point(x,f.y+f.h-.06,13); g.fillStyle(0x4a4a55).fillEllipse(p.x,p.y,20,24).lineStyle(2,INK).strokeEllipse(p.x,p.y,20,24); g.fillStyle(0xe8e8ee).fillCircle(p.x,p.y,5); }
    const light=point(f.x+f.w-.06,f.y+.3,26); g.fillStyle(0xfff3b0).fillEllipse(light.x,light.y,9,11).lineStyle(1.5,INK).strokeEllipse(light.x,light.y,9,11);
    return true;
  }
  if (type === 'barrier') {
    shadow(g, c.x, c.y + 6, 120, 34);
    for (const x of [f.x+.18,f.x+f.w-.25]) block(g,{x,y:f.y+.3,w:.12,h:.4},0,34,0xfff6e5);
    block(g,{...f,y:f.y+.35,h:.22},18,22,0xffa24c);
    for (let i=0;i<4;i++) {
      const x=f.x+.12+i*.45;
      face(g,[[x,f.y+.57,21],[x+.2,f.y+.57,21],[x+.36,f.y+.57,37],[x+.16,f.y+.57,37]],0xffffff,1,0);
    }
    return true;
  }
  return false;
}

/**
 * Bakes static drawing into images once. Phaser replays a Graphics object's
 * whole command list every frame, so a street drawn as thousands of shapes
 * stutters; an image costs one quad. `b` is the screen-space area to keep,
 * split into chunks of at most 2048 texture pixels; `scale` < 1 trades a
 * little sharpness for memory on big flat layers. Textures are cached by key.
 */
export function bakeLayer(scene: Phaser.Scene, key: string, b: { x: number; y: number; w: number; h: number }, depth: number, draw: (g: Phaser.GameObjects.Graphics) => void, scale = 1): void {
  const MAX = 2048;
  const cols = Math.ceil((b.w * scale) / MAX), rows = Math.ceil((b.h * scale) / MAX);
  const cw = b.w / cols, ch = b.h / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = `${key}:${c},${r}`, x0 = b.x + c * cw, y0 = b.y + r * ch;
    if (!scene.textures.exists(k)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.scaleCanvas(scale, scale);
      g.translateCanvas(-x0, -y0);
      draw(g);
      // One extra pixel so neighbouring chunks overlap instead of showing a seam.
      g.generateTexture(k, Math.ceil(cw * scale) + 1, Math.ceil(ch * scale) + 1);
      g.destroy();
    }
    scene.add.image(x0, y0, k).setOrigin(0).setDisplaySize(cw + 1 / scale, ch + 1 / scale).setDepth(depth);
  }
}

/** Bakes one small drawing into one image and returns it (map objects that never move). */
export function bakeImage(scene: Phaser.Scene, key: string, b: { x: number; y: number; w: number; h: number }, depth: number, draw: (g: Phaser.GameObjects.Graphics) => void): Phaser.GameObjects.Image {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(-b.x, -b.y);
    draw(g);
    g.generateTexture(key, Math.ceil(b.w), Math.ceil(b.h));
    g.destroy();
  }
  return scene.add.image(b.x, b.y, key).setOrigin(0).setDepth(depth);
}

/** A chapter-1 map object (street prop, parked car, barrier) as one baked image; null for types drawn elsewhere. */
export function bakeIncidentObject(scene: Phaser.Scene, id: string, type: string, f: Footprint, variant: string, depth: number): Phaser.GameObjects.Image | null {
  if (!['street_prop', 'stall', 'sau_tree', 'stools', 'parked_bike', 'kitten', 'car', 'barrier'].includes(type)) return null;
  const b = screenBox([[f.x, f.y], [f.x + f.w, f.y], [f.x, f.y + f.h], [f.x + f.w, f.y + f.h]], 170, 70);
  return bakeImage(scene, `hn:obj:${id}:${variant}`, b, depth, (g) => drawIncidentObject(g, type, f, variant));
}

/** Screen-space box around some tile points, raised by `z` px for what stands on them. */
export function screenBox(pts: Array<[number, number]>, z: number, pad = 40): { x: number; y: number; w: number; h: number } {
  const ps = pts.map(([x, y]) => point(x, y));
  const x0 = Math.min(...ps.map((p) => p.x)) - pad, x1 = Math.max(...ps.map((p) => p.x)) + pad;
  const y0 = Math.min(...ps.map((p) => p.y)) - z - pad, y1 = Math.max(...ps.map((p) => p.y)) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A small depth-sorted prop (tree, pole, stools…) baked into one image. */
function bakeProp(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, depth: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  bakeLayer(scene, key, screenBox([[x, y], [x + w, y], [x, y + h], [x + w, y + h]], 170, 60), depth, draw);
}

/** Round, outlined tree on a short trunk. */
function tree(g: Phaser.GameObjects.Graphics, x: number, y: number, size = 1): void {
  const p = point(x, y);
  shadow(g, p.x, p.y, 70 * size, 24 * size);
  g.fillStyle(0xb07a4f).fillRoundedRect(p.x - 5 * size, p.y - 34 * size, 10 * size, 34 * size, 3).lineStyle(2, INK).strokeRoundedRect(p.x - 5 * size, p.y - 34 * size, 10 * size, 34 * size, 3);
  for (const [dx, dy, r, col] of [[-16, -48, 22, 0x86c86b], [16, -50, 22, 0x86c86b], [0, -68, 26, 0x9ad67c]] as const) {
    g.fillStyle(col).fillCircle(p.x + dx * size, p.y + dy * size, r * size).lineStyle(2.5, INK).strokeCircle(p.x + dx * size, p.y + dy * size, r * size);
  }
  g.fillStyle(0xffffff, .35).fillCircle(p.x - 8 * size, p.y - 76 * size, 7 * size);
}

/** Chapter-1 map layout (see incident.json): the main road, a sidewalk either side, the alley going north, the lake to the south. */
const ROAD_ROWS = [8, 10];
const NORTH_WALK = [5, 7], SOUTH_WALK = [11, 13];
/** The gap in the north row of houses: the alley (x 21–23) and the courtyard at its end (x 19–25). */
const ALLEY_X0 = 19, ALLEY_X1 = 26;
const MAP_W = 48, MAP_H = 18;
const inRange = (v: number, [lo, hi]: number[]) => v >= lo! && v <= hi!;

/** Hoan Kiem lake along the south of the map (outside it), with a gently wavy shore. */
const inLake = (x: number, y: number) => y > MAP_H + .3 + Math.sin(x * .6) * .35;

/** Floating name plate over a landmark. */
function plate(scene: Phaser.Scene, x: number, y: number, z: number, name: string): void {
  const p = point(x, y, z);
  const t = scene.add.text(p.x, p.y, name, { fontFamily: "'Baloo 2', sans-serif", fontSize: '22px', fontStyle: '800', color: '#5a3825', backgroundColor: '#fffaf0', padding: { x: 12, y: 4 }, resolution: 2 }).setOrigin(.5, 1).setDepth(1e6 - 6);
  const g = scene.add.graphics().setDepth(1e6 - 6.1);
  g.lineStyle(3, INK).strokeRoundedRect(t.x - t.width / 2, t.y - t.height, t.width, t.height, 8);
}

/** Hanoi tube house: narrow and tall, shutters, a balcony with plants and a shop sign at street level. */
function tubeHouse(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, d: number, h: number, color: number, sign: number): void {
  block(g, { x, y, w, h: d }, 0, h, color, 2.5);
  // Red tiled roof edge.
  block(g, { x: x - .05, y: y - .05, w: w + .1, h: d + .1 }, h, 10, 0xd9674f, 2);
  for (let z = 70; z < h - 20; z += 46) {
    // Green shutters on the street face, a balcony every floor.
    for (let wx = x + .18; wx < x + w - .3; wx += .55) face(g, [[wx, y + d, z], [wx + .32, y + d, z], [wx + .32, y + d, z + 26], [wx, y + d, z + 26]], 0x6fae8a, 1, 1.5);
    face(g, [[x + .08, y + d + .12, z - 4], [x + w - .08, y + d + .12, z - 4], [x + w - .08, y + d + .12, z + 4], [x + .08, y + d + .12, z + 4]], 0xfff6e5, 1, 1.5);
    const pl = point(x + w * .7, y + d + .12, z + 8);
    g.fillStyle(0x86c86b).fillCircle(pl.x, pl.y, 7).lineStyle(1.5, INK).strokeCircle(pl.x, pl.y, 7);
  }
  // Shop sign and an open shopfront.
  face(g, [[x + .1, y + d, 40], [x + w - .1, y + d, 40], [x + w - .1, y + d, 60], [x + .1, y + d, 60]], sign, 1, 2);
  face(g, [[x + .2, y + d, 0], [x + w - .2, y + d, 0], [x + w - .2, y + d, 34], [x + .2, y + d, 34]], 0x8a5a3a, 1, 2);
  for (let wy = y + .3; wy < y + d - .3; wy += .7) face(g, [[x + w, wy, 80], [x + w, wy + .35, 80], [x + w, wy + .35, 104], [x + w, wy, 104]], 0x6fae8a, 1, 1.5);
}

/** Thap Rua: the little three-tier tower on its islet in the lake. */
function turtleTower(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  const c = point(x + .5, y + .5);
  g.fillStyle(0x86c86b).fillEllipse(c.x, c.y + 6, 150, 62).lineStyle(2.5, INK).strokeEllipse(c.x, c.y + 6, 150, 62);
  block(g, { x, y, w: 1, h: 1 }, 0, 44, 0xf3e7d3);
  block(g, { x: x + .15, y: y + .15, w: .7, h: .7 }, 44, 32, 0xefe1ca);
  block(g, { x: x + .28, y: y + .28, w: .44, h: .44 }, 76, 26, 0xf6ecdb);
  const top = point(x + .5, y + .5, 102);
  tri(g, [top.x - 22, top.y + 6, top.x + 22, top.y + 6, top.x, top.y - 16], 0x8a5a3a);
  for (const z of [16, 56, 86]) { const q = point(x + .5, y + 1, z); g.fillStyle(INK).fillEllipse(q.x, q.y, 10, 14); }
}

/** The Huc bridge: red, arched, from the shore to Ngoc Son temple. */
function redBridge(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number): void {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, arc = (u: number) => Math.sin(u * Math.PI) * 26;
    const p0 = { x: x0 + (x1 - x0) * a, y: y0 + (y1 - y0) * a }, p1 = { x: x0 + (x1 - x0) * b, y: y0 + (y1 - y0) * b };
    face(g, [[p0.x - .2, p0.y, arc(a) + 8], [p1.x - .2, p1.y, arc(b) + 8], [p1.x + .2, p1.y, arc(b) + 8], [p0.x + .2, p0.y, arc(a) + 8]], 0xe2513f, 1, 2);
    const q = point(p0.x + .2, p0.y, arc(a) + 8);
    g.lineStyle(3, INK).lineBetween(q.x, q.y, q.x, q.y - 14);
  }
  // Ngoc Son temple roof at the far end.
  const t = { x: x1 - .6, y: y1 - .6 };
  block(g, { x: t.x, y: t.y, w: 1.4, h: 1.2 }, 0, 36, 0xffd25e);
  block(g, { x: t.x - .1, y: t.y - .1, w: 1.6, h: 1.4 }, 36, 12, 0x6b4a3a);
}

/** O Quan Chuong: the old city gate, arching over the road where it leaves the map. */
function cityGate(g: Phaser.GameObjects.Graphics, x: number, y0: number, y1: number): void {
  block(g, { x, y: y0 - 1, w: 1.4, h: 1 }, 0, 120, 0xe6dcc6, 2.5);
  block(g, { x, y: y1, w: 1.4, h: 1 }, 0, 120, 0xe6dcc6, 2.5);
  block(g, { x, y: y0 - 1, w: 1.4, h: y1 - y0 + 2 }, 90, 34, 0xd9cfb7, 2.5);
  block(g, { x: x + .2, y: y0 - .4, w: 1, h: y1 - y0 + .8 }, 124, 30, 0xf3e7d3, 2);
  block(g, { x: x - .1, y: y0 - .6, w: 1.6, h: y1 - y0 + 1.2 }, 154, 12, 0x6b4a3a, 2);
}

export function drawIncidentEnvironment(scene: Phaser.Scene, floor: FloorTileView[]): void {
  // Everything flat (ground around the map, the map's own floor, markings, beds) is one baked layer.
  bakeLayer(scene, 'hn:ground', screenBox([[-8, -4], [MAP_W + 8, -4], [-8, MAP_H + 8], [MAP_W + 8, MAP_H + 8]], 0, 0), floorDepth - .8, (g) => drawGround(g, floor), .6);
  drawStanding(scene);
}

/** The flat street: around the map, the map floor itself, road markings, the zebra crossing and flower beds. */
function drawGround(surround: Phaser.GameObjects.Graphics, floor: FloorTileView[]): void {
  // Beyond the map: the road and both sidewalks run on east and west, the lake lies south, pavement behind the houses.
  for (let y = -4; y < MAP_H + 8; y++) for (let x = -8; x < MAP_W + 8; x++) {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) continue;
    const n = ((x * 17 + y * 31) % 7 + 7) % 7;
    const color = inLake(x + .5, y + .5) ? [0x8fd0ea, 0x86cbe6, 0x97d4ed][n % 3]!
      : inRange(y, ROAD_ROWS) ? 0x9aa7b5
      : inRange(y, NORTH_WALK) || inRange(y, SOUTH_WALK) || y < NORTH_WALK[0]! ? [0xf3e7d3, 0xefe1ca, 0xf6ecdb][n % 3]!
      : [0xbfe3a0, 0xb6dc96, 0xc5e7a8][n % 3]!;
    face(surround, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], color, 1, 0);
  }
  // The map's own floor, tile by tile.
  for (const t of floor) {
    const { x, y } = t.tile;
    const top = (TERRAIN_COLORS[t.kind] ?? TERRAIN_COLORS.floor!).top;
    face(surround, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], (x + y) % 2 ? shadeOf(top, -2) : top, 1, 0);
    if (t.kind === 'sidewalk') surround.lineStyle(1, 0xc9b392, .7).strokePoints([point(x, y), point(x + 1, y), point(x + 1, y + 1), point(x, y + 1)], true);
  }
  // Lake ripples.
  for (let i = 0; i < 40; i++) { const x = -6 + (i * 7.3) % (MAP_W + 12), y = MAP_H + 1.5 + (i * 3.7) % 5; if (!inLake(x, y)) continue; const q = point(x, y); surround.lineStyle(2, 0xffffff, .55).lineBetween(q.x - 14, q.y, q.x + 14, q.y); }

  // Road markings: centre dashes, kerbs, and a zebra crossing in front of the alley.
  const road = surround;
  const mid = (ROAD_ROWS[0]! + ROAD_ROWS[1]!) / 2;
  for (let x = -8; x < MAP_W + 8; x++) if (x % 3 === 1 && !inRange(x, [ALLEY_X0, ALLEY_X1])) face(road, [[x + .15, mid + .46], [x + .95, mid + .46], [x + .95, mid + .54], [x + .15, mid + .54]], 0xffffff, .95, 0);
  for (const y of [ROAD_ROWS[0]!, ROAD_ROWS[1]! + 1]) face(road, [[-8, y], [MAP_W + 8, y], [MAP_W + 8, y + .08], [-8, y + .08]], 0xffffff, 1, 0);
  for (let x = ALLEY_X0 + 1.1; x < ALLEY_X1 - 1; x += .45) face(road, [[x, ROAD_ROWS[0]! + .15], [x + .22, ROAD_ROWS[0]! + .15], [x + .22, ROAD_ROWS[1]! + .85], [x, ROAD_ROWS[1]! + .85]], 0xffffff, .9, 0);

  // Lakeside flower beds on the grass (flat, never in the way).
  for (const [x, y] of [[4, 15.3], [16, 15.4], [23, 15.2], [37, 15.3], [44, 15.4]] as const) {
    const p = point(x, y);
    surround.fillStyle(0x9ad67c).fillEllipse(p.x, p.y, 90, 40).lineStyle(2, INK).strokeEllipse(p.x, p.y, 90, 40);
    for (let i = 0; i < 6; i++) surround.fillStyle([0xff8a73, 0xffd25e, 0xf6a6d0][i % 3]!).fillCircle(p.x - 28 + i * 11, p.y - 4 + (i % 2) * 8, 4);
  }
}

/** Everything that stands up: houses, landmarks, poles and wires, street life, trees (all baked). */
function drawStanding(scene: Phaser.Scene): void {
  // Old-quarter tube houses along the north side, with a gap for the alley; behind its courtyard, a few more houses.
  bakeLayer(scene, 'hn:houses', screenBox([[-10, -3], [MAP_W + 8, -3], [-10, NORTH_WALK[0]!], [MAP_W + 8, NORTH_WALK[0]!]], 300), -2, (city) => {
    const walls = [0xf6d77a, 0xfff0c9, 0xc9ecd9, 0xf6c7b4, 0xf2e2a0] as const;
    const signs = [0xe2513f, 0x5ec8f2, 0xffd25e, 0x7cc47f, 0xf6a6d0] as const;
    let i = 0;
    const house = (x: number, y: number, d: number) => { tubeHouse(city, x, y, 1.6, d, 170 + ((i * 37) % 4) * 30, walls[i % 5]!, signs[(i * 3) % 5]!); i++; };
    for (let x = ALLEY_X0 + .05; x + 1.6 <= ALLEY_X1; x += 1.75) house(x, -2.6, 3.5);
    for (let x = ALLEY_X0 - 1.6; x > -10; x -= 1.75) house(x, 1, 3.9);
    for (let x = ALLEY_X1; x < MAP_W + 8; x += 1.75) house(x, 1, 3.9);
  }, .75);
  // Low garden walls along both sides of the alley, with a potted plant (tall houses there would hide the alley).
  for (const x of [ALLEY_X0 + 1.8, ALLEY_X1 - 2]) bakeProp(scene, `hn:alleywall:${x}`, x, 3, .2, 2, x + 5, (g) => {
    block(g, { x, y: 3, w: .2, h: 1.9 }, 0, 40, 0xe6dcc6, 2);
    block(g, { x: x - .02, y: 2.98, w: .24, h: 1.94 }, 40, 6, 0xd9674f, 1.5);
    const pot = point(x + .1, 4.6, 46);
    dot(g, pot.x, pot.y - 8, 9, 0x86c86b);
  });

  // Landmarks across the lake.
  bakeLayer(scene, 'hn:lake', screenBox([[18, MAP_H + 3], [22, MAP_H + 7], [36, MAP_H - 1], [41, MAP_H + 4]], 130), 0, (lm) => {
    turtleTower(lm, 20, MAP_H + 4.5);
    redBridge(lm, 37.5, MAP_H - .2, 39, MAP_H + 3.6);
  });
  plate(scene, 20.5, MAP_H + 5, 150, 'Tháp Rùa');
  plate(scene, 12, MAP_H + 4, 30, 'Hồ Gươm');
  plate(scene, 38.5, MAP_H + 1.5, 70, 'Cầu Thê Húc');
  bakeLayer(scene, 'hn:gate', screenBox([[MAP_W + .4, ROAD_ROWS[0]! - 2], [MAP_W + 2.6, ROAD_ROWS[0]! - 2], [MAP_W + .4, ROAD_ROWS[1]! + 3], [MAP_W + 2.6, ROAD_ROWS[1]! + 3]], 190), MAP_W + 12, (gate) => cityGate(gate, MAP_W + .8, ROAD_ROWS[0]!, ROAD_ROWS[1]!));
  plate(scene, MAP_W + 1.5, (ROAD_ROWS[0]! + ROAD_ROWS[1]! + 1) / 2, 200, 'Ô Quan Chưởng');

  // Electric poles with the famous tangle of wires, in front of the houses (none across the alley mouth).
  const poles: Array<[number, number]> = [];
  for (let x = 2; x < MAP_W; x += 5) if (!inRange(x, [ALLEY_X0, ALLEY_X1])) poles.push([x, 4.85]);
  for (const [x, y] of poles) bakeProp(scene, `hn:pole:${x}`, x, y, 0, 0, x + y, (pole) => {
    const p = point(x, y);
    shadow(pole, p.x, p.y, 24, 10);
    pole.fillStyle(0x9aa1ad).fillRoundedRect(p.x - 4, p.y - 150, 8, 150, 3).lineStyle(2, INK).strokeRoundedRect(p.x - 4, p.y - 150, 8, 150, 3);
    pole.fillStyle(0x6b6b75).fillRect(p.x - 16, p.y - 140, 32, 6).fillCircle(p.x + 10, p.y - 120, 7);
  });
  bakeLayer(scene, 'hn:wires', screenBox([[poles[0]![0], 4.85], [poles[poles.length - 1]![0], 4.85]], 160, 80), 1e6 - 7, (wires) => {
    for (let i = 0; i + 1 < poles.length; i++) {
      const a = point(poles[i]![0], poles[i]![1], 140), b = point(poles[i + 1]![0], poles[i + 1]![1], 140);
      for (let k = 0; k < 4; k++) {
        const sag = 18 + k * 9, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + sag;
        wires.lineStyle(1.5, 0x3a3340, .85).beginPath().moveTo(a.x, a.y + k * 3);
        for (let u = 0.1; u <= 1.001; u += .1) { const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x, y = (1 - u) * (1 - u) * (a.y + k * 3) + 2 * (1 - u) * u * my + u * u * (b.y + k * 2); wires.lineTo(x, y); }
        wires.strokePath();
      }
    }
  });

  // Plastic stools, parked motorbikes and the sấu trees are map objects (they block the way): see `drawIncidentObject`.

  // The low iron railing along the lake shore: the edge of the walkable grass, so nobody wonders why they cannot go on.
  for (let x = 1; x < MAP_W - 1; x += 4) bakeProp(scene, `hn:rail:${x}`, x, MAP_H - 1, 4, 0, x + 2 + MAP_H - .9, (g) => {
    const x1 = Math.min(MAP_W - 1, x + 4);
    for (let px = x; px <= x1 + .01; px += .5) { const a = point(px, MAP_H - 1), b = point(px, MAP_H - 1, 26); g.lineStyle(3, INK).lineBetween(a.x, a.y, b.x, b.y); }
    for (const z of [14, 26]) { const a = point(x, MAP_H - 1, z), b = point(x1, MAP_H - 1, z); g.lineStyle(5, INK).lineBetween(a.x, a.y, b.x, b.y); g.lineStyle(2.5, 0x6b8e3a).lineBetween(a.x, a.y, b.x, b.y); }
  });

}


/** The player in chapter 1: a small outlined figure in a coral jacket. */
export class IncidentActorView implements ActorView {
  depth=0;
  private readonly g: Phaser.GameObjects.Graphics;
  constructor(private readonly scene: Phaser.Scene) { this.g=scene.add.graphics(); }
  update(s: ActorViewState): void {
    const p=worldToScreen(s.pos); this.depth=actorDepth(s.pos);
    const bob=s.state==='MOVING'?Math.sin(this.scene.time.now/85)*2:0;
    const g=this.g.clear().setPosition(p.x,p.y+this.pose.dy).setScale(this.pose.sx,this.pose.sy).setRotation(this.pose.angle).setDepth(this.pose.dy<0?1e6-3:this.depth);
    shadow(g,0,0,34,14);
    g.lineStyle(2.5,INK);
    g.fillStyle(0x4f6d8f).fillRoundedRect(-11,-18,8,19,3).strokeRoundedRect(-11,-18,8,19,3).fillRoundedRect(3,-18,8,19,3).strokeRoundedRect(3,-18,8,19,3);
    g.fillStyle(0xff8a73).fillRoundedRect(-16,-44+bob,32,31,10).strokeRoundedRect(-16,-44+bob,32,31,10);
    g.fillStyle(0xf6d2b0).fillCircle(-19,-28+bob,5).strokeCircle(-19,-28+bob,5).fillCircle(19,-28+bob,5).strokeCircle(19,-28+bob,5);
    g.fillCircle(0,-52+bob,13).strokeCircle(0,-52+bob,13);
    g.fillStyle(INK).fillEllipse(0,-61+bob,27,12).fillRoundedRect(-13,-61+bob,5,15,2);
    g.fillCircle(5,-51+bob,2);
    g.fillStyle(0xff9e8a,.7).fillCircle(8,-46+bob,3);
    if (s.progress!==null) g.fillStyle(0xfff6e5).fillRoundedRect(-25,-82,50,9,4).lineStyle(2,INK).strokeRoundedRect(-25,-82,50,9,4).fillStyle(0x6fd3c0).fillRoundedRect(-23,-80,46*s.progress,5,2);
  }
  hitTest(x:number,y:number):boolean { const p=this.g; return x>=p.x-22&&x<=p.x+22&&y>=p.y-70&&y<=p.y+5; }
  setAlpha(a:number):void { this.g.setAlpha(a); }
  private pose = { sx: 1, sy: 1, dy: 0, angle: 0 };
  /** Death animation pose (scale, lift, spin); identity when alive. */
  setPose(sx:number,sy:number,dy:number,angle:number):void { this.pose = { sx, sy, dy, angle }; }
  destroy():void { this.g.destroy(); }
}


/** Small outlined pigeon facing `f` (1 right, -1 left). */
function pigeon(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number, flap: number): void {
  oval(g, x, y, 26, 18, 0xc5cad6);
  tri(g, [x - 4, y - 4, x - 18 * f, y - 16 - flap, x + 6 * f, y - 8], 0xb1b7c6);
  dot(g, x + f * 12, y - 10, 7, 0xb1b7c6);
  tri(g, [x + f * 18, y - 11, x + f * 25, y - 9, x + f * 18, y - 7], 0xffc94a);
  g.fillStyle(INK).fillCircle(x + f * 13, y - 12, 1.6);
}

/** A neighbour's dog mid-run, facing `f` (1 right, -1 left), `k` times the usual size (the big one). */
function dog(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number, run: number, k = 1): void {
  const F = f * k;
  shadow(g, x, y, 56 * k, 18 * k);
  for (const [lx, ph] of [[-12, 0], [-4, Math.PI], [8, Math.PI / 2], [15, Math.PI * 1.5]] as const) rr(g, x + lx * F - 3 * k, y - (16 - Math.sin(run + ph) * 3) * k, 6 * k, 16 * k, 3, 0xa8683c);
  oval(g, x, y - 22 * k, 44 * k, 24 * k, 0xc98a55);
  g.lineStyle(5, INK).lineBetween(x - 20 * F, y - 26 * k, x - 30 * F, y - (38 + Math.sin(run * 2) * 4) * k);
  g.lineStyle(3, 0xc98a55).lineBetween(x - 20 * F, y - 26 * k, x - 30 * F, y - (38 + Math.sin(run * 2) * 4) * k);
  dot(g, x + 22 * F, y - 34 * k, 13 * k, 0xd89a63);
  oval(g, x + 32 * F, y - 30 * k, 14 * k, 10 * k, 0xd89a63);
  g.fillStyle(INK).fillCircle(x + 37 * F, y - 32 * k, 2.6 * k).fillCircle(x + 24 * F, y - 38 * k, 2.4 * k);
  tri(g, [x + 14 * F, y - 44 * k, x + 20 * F, y - 52 * k, x + 24 * F, y - 42 * k], 0x8a5a3a);
  g.fillStyle(0xff8a8a).fillEllipse(x + 33 * F, y - 22 * k, 6 * k, 8 * k);
}

/** One rider on a motorbike, facing `f`. */
export function motorbike(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number, color: number, helmet: number): void {
  shadow(g, x, y + 2, 70, 20);
  dot(g, x - 20 * f, y - 8, 9, 0x4a4a55);
  dot(g, x + 20 * f, y - 8, 9, 0x4a4a55);
  rr(g, x - 24, y - 30, 48, 18, 8, color);
  rr(g, x - 8 - 4 * f, y - 56, 18, 28, 7, 0x6fd3c0);
  dot(g, x - 2 * f, y - 64, 10, helmet);
  g.lineStyle(3, INK).lineBetween(x + 10 * f, y - 40, x + 22 * f, y - 44);
  g.fillStyle(0xfff3b0).fillCircle(x + 25 * f, y - 22, 4);
}

/**
 * Chapter-1 run: draws each gag every frame from the simulation's view.
 * Telegraphs (cracks, shadows, lane strips, "!") sit on the ground so the
 * player always sees what is coming; the gags themselves sort with the
 * actors. A knock-out (the gag that got the hero, or the fate) plays its
 * little slapstick scene on top, then the hero lies there seeing stars.
 */
export class IncidentRunView {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly bodies = new Map<number, Phaser.GameObjects.Graphics>();
  /** Bubbles over the gags ("Gâu gâu!", "Nắp cống!"). */
  private readonly bubbles = new Map<number, Phaser.GameObjects.Text>();
  /** The fate's sound word ("CỐC!", "BOONG!"). */
  private readonly sound: Phaser.GameObjects.Text;
  constructor(private readonly scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(floorDepth + .7);
    this.fx = scene.add.graphics().setDepth(1e6 - 4);
    this.sound = scene.add.text(0, 0, '', { fontFamily: "'Baloo 2', sans-serif", fontSize: '40px', fontStyle: '800', color: '#e2513f', stroke: '#ffffff', strokeThickness: 8, resolution: 2 }).setOrigin(.5, 1).setDepth(1e6 - 1).setVisible(false);
  }

  /** `heroHidden`: the hero is inside the ambulance (no stars over an empty street). */
  sync(run: RunView | null, hero: WorldPos, heroHidden = false): void {
    this.ground.clear();
    this.fx.clear();
    const seen = new Set<number>();
    for (const h of run?.hazards ?? []) {
      seen.add(h.id);
      let g = this.bodies.get(h.id);
      if (!g) this.bodies.set(h.id, (g = this.scene.add.graphics()));
      g.clear().setAlpha(h.phase === 'gone' ? 1 - h.t : 1);
      this.draw(h, g);
    }
    for (const [id, g] of this.bodies) if (!seen.has(id)) { g.destroy(); this.bodies.delete(id); }
    this.syncBubbles(run);
    if (run?.hit) this.drawHit(run.hit);
    this.drawFinale(run?.finale ?? null);
    if (run?.down && !heroHidden) this.drawDown(run.down);
    if (run?.dazed) this.drawDaze(run.dazed, hero);
  }

  /** Each gag with words says them in a bubble that follows it (the twist's in a darker red). */
  private syncBubbles(run: RunView | null): void {
    const want = new Set<number>();
    const z = this.scene.cameras.main.zoom;
    for (const h of run?.hazards ?? []) {
      if (!h.label || h.phase === 'gone' || run?.hit || run?.finale) continue;
      want.add(h.id);
      let b = this.bubbles.get(h.id);
      if (!b) {
        b = this.scene.add.text(0, 0, '', { fontFamily: "'Baloo 2', sans-serif", fontSize: '20px', fontStyle: '800', color: '#ffffff', backgroundColor: '#ff7f6b', padding: { x: 10, y: 2 }, resolution: 2 }).setOrigin(.5, 1).setDepth(1e6 - 3);
        this.bubbles.set(h.id, b);
      }
      if (b.text !== h.label) b.setText(h.label).setBackgroundColor(h.twist || (h.kind === 'dog' && h.phase === 'active') ? '#c8463d' : '#ff7f6b');
      const p = point(h.x, h.y);
      const lift = h.kind === 'pigeons' || h.kind === 'shuttlecock' || h.kind === 'slipper' ? 96 : h.kind === 'dog' && h.phase === 'active' ? 78 : 64;
      // World text shrinks with the camera; keep the bubble readable on a zoomed-out PC view.
      b.setScale(Math.max(1, Math.min(2.4, 1 / z))).setPosition(p.x, p.y - lift - Math.abs(Math.sin(this.scene.time.now / 120)) * 4);
    }
    for (const [id, b] of this.bubbles) if (!want.has(id)) { b.destroy(); this.bubbles.delete(id); }
  }

  /** "!" bubble over a hazard about to move. */
  private alert(x: number, y: number, t: number): void {
    const s = .6 + Math.min(1, t * 2) * .4;
    rr(this.fx, x - 12 * s, y - 30 * s, 24 * s, 30 * s, 8, 0xff7f6b);
    this.fx.fillStyle(0xffffff).fillRect(x - 2.5 * s, y - 26 * s, 5 * s, 14 * s).fillCircle(x, y - 7 * s, 3 * s);
  }

  /** A falling thing's shadow growing on the ground where it will land. */
  private landing(p: Phaser.Math.Vector2, t: number): void {
    this.ground.fillStyle(INK, .15 + t * .25).fillEllipse(p.x, p.y, 40 + t * 70, 18 + t * 32);
    this.ground.lineStyle(2, 0xff7f6b, .4 + t * .6).strokeEllipse(p.x, p.y, 40 + t * 70, 18 + t * 32);
  }

  /** A lane-wide warning strip from one side of the map to the other, along the hazard's direction. */
  private lane(h: HazardView, width: number, alpha: number): { a: Phaser.Math.Vector2; b: Phaser.Math.Vector2 } {
    const a = h.dx ? point(-3, h.y) : point(h.x, -3), b = h.dx ? point(MAP_W + 3, h.y) : point(h.x, MAP_H + 3);
    this.ground.lineStyle(width, 0xff7f6b, alpha).lineBetween(a.x, a.y, b.x, b.y);
    return { a, b };
  }

  private draw(h: HazardView, g: Phaser.GameObjects.Graphics): void {
    const p = point(h.x, h.y);
    const now = this.scene.time.now;
    const face = h.dx || h.dy ? (point(h.x + h.dx, h.y + h.dy).x - p.x >= 0 ? 1 : -1) : 1;
    g.setDepth(h.x + h.y + .05);
    switch (h.kind) {
      case 'cat': {
        const c = new Phaser.Math.Vector2(p.x, p.y + (h.phase === 'active' ? -Math.abs(Math.sin(now / 70)) * 5 : 0));
        drawKitten(g, c);
        if (h.phase === 'warn') this.alert(c.x, c.y - 70, h.t);
        return;
      }
      case 'dog':
        // The warning is a tiny yapping chihuahua; then the big one comes out of the gate.
        if (h.phase === 'warn') chihuahua(g, p.x, p.y - Math.abs(Math.sin(now / 60)) * 4, face);
        else dog(g, p.x, p.y, face, now / 55, 1.35);
        return;
      case 'chickens':
        for (const [ox, oy, k] of [[0, 0, 0], [-.35, .3, 1], [.3, .35, 2]] as const) {
          const q = point(h.x + ox, h.y + oy);
          chicken(g, q.x, q.y - (h.phase === 'active' ? Math.abs(Math.sin(now / 50 + k)) * 6 : 0), face);
        }
        if (h.phase === 'warn') this.alert(p.x, p.y - 56, h.t);
        return;
      case 'sinkhole': {
        // Cracks spread while the road sags, then the hole opens wide. The twist is a manhole cover flipping over.
        const k = h.phase === 'warn' ? h.t : 1;
        const size = h.twist ? 120 : 190;
        const w = size * (h.phase === 'warn' ? .25 + k * .55 : 1), hh = w / 2;
        g.setDepth(floorDepth + .8);
        if (h.phase === 'warn' && h.twist) {
          const flip = Math.abs(Math.sin(now / 70));
          g.fillStyle(0x6b6b75).fillEllipse(p.x, p.y - flip * 10, size, size / 2 * (.3 + flip * .7)).lineStyle(3, INK).strokeEllipse(p.x, p.y - flip * 10, size, size / 2 * (.3 + flip * .7));
        } else if (h.phase === 'warn') {
          g.fillStyle(0x7a6a5a, .25 + k * .4).fillEllipse(p.x, p.y, w, hh);
          g.lineStyle(3, INK, .8);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + .3; const r = w * .5 * (.7 + k * .6); g.lineBetween(p.x + Math.cos(a) * 10, p.y + Math.sin(a) * 5, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .5); }
          if (Math.floor(now / 120) % 2) g.lineStyle(3, 0xff7f6b, .9).strokeEllipse(p.x, p.y, 190, 95);
        } else {
          g.fillStyle(0x8a6a4e).fillEllipse(p.x, p.y + 4, w + 16, hh + 10).lineStyle(3, INK).strokeEllipse(p.x, p.y + 4, w + 16, hh + 10);
          g.fillStyle(0x1c1712).fillEllipse(p.x, p.y, w, hh).lineStyle(3, INK).strokeEllipse(p.x, p.y, w, hh);
          g.fillStyle(0x3a2e24).fillEllipse(p.x, p.y - hh * .25, w * .8, hh * .35);
        }
        return;
      }
      case 'durian':
        if (h.phase === 'warn') {
          this.landing(p, h.t);
          drawDurian(g, p.x, p.y - 20 - (1 - h.t) * (1 - h.t) * 420, 16);
          g.setDepth(1e6 - 5);
        } else {
          g.fillStyle(0xf3dc8a).fillEllipse(p.x, p.y, 80, 30).lineStyle(2, INK).strokeEllipse(p.x, p.y, 80, 30);
          drawDurian(g, p.x + 10, p.y - 10, 12);
        }
        return;
      case 'water':
        if (h.phase === 'warn') {
          // A basin tips over at a first-floor window; water pours once it lands.
          this.landing(p, h.t);
          const q = point(h.x, h.y, 190 - h.t * 20);
          rr(g, q.x - 18, q.y - 10, 36, 14, 6, 0x5ec8f2);
          g.setDepth(1e6 - 5);
        } else {
          g.fillStyle(0x8fd0ea, .8).fillEllipse(p.x, p.y, 110, 40).lineStyle(2, INK).strokeEllipse(p.x, p.y, 110, 40);
          for (let i = 0; i < 6; i++) dot(g, p.x - 40 + i * 16, p.y - 20 - (i % 2) * 14, 5, 0x8fd0ea);
        }
        return;
      case 'laundry': {
        if (h.phase === 'warn') {
          this.landing(p, h.t);
          const fall = (1 - h.t) * (1 - h.t) * 320;
          shorts(g, p.x + Math.sin(now / 160) * 18, p.y - 30 - fall);
          g.setDepth(1e6 - 5);
        } else shorts(g, p.x, p.y - 6);
        return;
      }
      case 'motorbike': {
        if (h.phase === 'warn') {
          // The whole lane flashes; a "!" where the bikes will come in.
          this.lane(h, 56, .1 + (Math.sin(now / 90) * .5 + .5) * .18);
          const side = h.dx ? point(h.dx > 0 ? 0.6 : MAP_W - .6, h.y) : point(h.x, h.dy > 0 ? 0.6 : MAP_H - .6);
          this.alert(side.x, side.y - 40, h.t);
          return;
        }
        const colors = [[0xff8a73, 0xffd25e], [0x5ec8f2, 0xffffff], [0xf6a6d0, 0xff7f6b]] as const;
        colors.forEach(([body, helmet], i) => {
          const wob = i % 2 ? .18 : -.12;
          const q = point(h.x - i * 1.3 * h.dx + (h.dx ? 0 : wob), h.y - i * 1.3 * h.dy + (h.dx ? wob : 0));
          motorbike(g, q.x, q.y - Math.abs(Math.sin(now / 60 + i)) * 2, face, body, helmet);
          // The last bike carries a fridge and a crate of chickens.
          if (i === 2) { rr(g, q.x - 30 * face - 14, q.y - 92, 28, 44, 4, 0xfff6e5); rr(g, q.x - 30 * face - 16, q.y - 50, 32, 18, 3, 0xd9a35c); }
        });
        g.setDepth(h.x + h.y + .6);
        return;
      }
      case 'pigeons': {
        if (h.phase === 'warn') {
          const { a, b } = this.lane(h, 26, .12 + h.t * .2);
          for (let i = 0; i < 12; i++) {
            const u = (i / 12 + now / 1600) % 1;
            const q = new Phaser.Math.Vector2(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u);
            this.ground.fillStyle(0xffffff, .8).fillCircle(q.x, q.y, 3);
          }
          return;
        }
        for (const [ox, oy] of [[0, 0], [-.4, -.3], [.3, -.45], [-.2, .35], [.45, .2]] as const) {
          const q = point(h.x + ox, h.y + oy);
          pigeon(g, q.x, q.y - 40, face, Math.sin(now / 50 + ox * 9) * 8);
        }
        g.setDepth(1e6 - 5);
        return;
      }
      case 'shuttlecock':
        if (h.phase === 'warn') {
          this.lane(h, 18, .1 + h.t * .2);
          this.alert(p.x, p.y - 50, h.t);
          return;
        }
        shuttlecock(g, p.x, p.y - 46, face);
        g.setDepth(1e6 - 5);
        return;
      case 'slipper': {
        if (h.phase === 'warn') {
          this.alert(p.x, p.y - 60, h.t);
          return;
        }
        // Spinning: the sole shows, then the edge, then the sole again.
        const spin = Math.abs(Math.sin(now / 60));
        g.fillStyle(0xffd25e).fillEllipse(p.x, p.y - 40, 34 * (.25 + spin * .75), 16).lineStyle(2.5, INK).strokeEllipse(p.x, p.y - 40, 34 * (.25 + spin * .75), 16);
        for (let i = -1; i <= 1; i++) g.fillStyle(0xe0b440).fillCircle(p.x + i * 8 * spin, p.y - 40, 2.5);
        g.setDepth(1e6 - 5);
        return;
      }
      case 'banana':
        g.fillStyle(0xffd25e).lineStyle(2.5, INK);
        for (const [dx, dy, w] of [[-8, 0, 24], [6, -3, 22], [0, 6, 20]] as const) g.fillEllipse(p.x + dx, p.y + dy, w, 9).strokeEllipse(p.x + dx, p.y + dy, w, 9);
        g.fillStyle(0x8a5a3a).fillCircle(p.x, p.y, 3);
        g.setDepth(floorDepth + .8);
        return;
    }
  }

  private stars(x: number, y: number): void {
    const now = this.scene.time.now;
    for (let i = 0; i < 3; i++) { const a = now / 160 + (i * Math.PI * 2) / 3; dot(this.fx, x + Math.cos(a) * 22, y + Math.sin(a) * 7, 5, 0xffd25e); }
  }

  /** The slapstick on top of the hit pose (the pose itself is on the player, see `runPose`). */
  private drawHit(d: NonNullable<RunView['hit']>): void {
    const p = point(d.x, d.y), t = d.t, now = this.scene.time.now, g = this.fx;
    switch (d.kind) {
      case 'cat':
      case 'dog':
      case 'chickens': {
        // A cartoon scuffle cloud around the hero and the animal itself (the hazard, moved onto the hero).
        for (let i = 0; i < 7; i++) { const a = now / 90 + i; dot(g, p.x + Math.cos(a) * 26, p.y - 34 + Math.sin(a * 1.3) * 18, 15 + (i % 3) * 4, 0xffffff); }
        if (d.kind === 'cat') {
          const swipe = (now / 260) % 1;
          for (let i = 0; i < 3; i++) g.lineStyle(5, 0xe2513f, 1 - swipe * .6).lineBetween(p.x - 26 + i * 12, p.y - 70 + swipe * 10, p.x - 6 + i * 12, p.y - 28 + swipe * 10);
        } else if (d.kind === 'chickens') {
          for (let i = 0; i < 8; i++) { const a = i * .8 + now / 200; oval(g, p.x + Math.cos(a) * (20 + t * 40), p.y - 40 - Math.sin(a) * 30 - t * 30, 10, 5, 0xffffff); }
        } else {
          const open = Math.abs(Math.sin(now / 90)) * 12;
          for (const s of [-1, 1]) {
            const y = p.y - 16 + s * (6 + open);
            g.fillStyle(0xffffff).lineStyle(2.5, INK);
            for (let i = 0; i < 4; i++) { const x = p.x - 18 + i * 12; g.fillTriangle(x, y, x + 10, y, x + 5, y - s * 10).strokeTriangle(x, y, x + 10, y, x + 5, y - s * 10); }
          }
        }
        return;
      }
      case 'durian':
        drawDurian(g, p.x, p.y - 70, 16);
        this.stars(p.x, p.y - 100);
        return;
      case 'water':
        for (let i = 0; i < 10; i++) dot(g, p.x - 36 + (i * 8) % 72, p.y - 90 + ((now / 4 + i * 37) % 80), 4, 0x8fd0ea);
        return;
      case 'shuttlecock':
        shuttlecock(g, p.x + t * 60, p.y - 70 - Math.sin(t * Math.PI) * 60, 1);
        if (t > .3) this.stars(p.x, p.y - 80);
        return;
      case 'slipper':
        g.fillStyle(0xffd25e).fillEllipse(p.x - 10 - t * 50, p.y - 60 + t * 50, 30, 14).lineStyle(2.5, INK).strokeEllipse(p.x - 10 - t * 50, p.y - 60 + t * 50, 30, 14);
        if (t > .3) this.stars(p.x, p.y - 80);
        return;
      case 'sinkhole':
        for (let i = 0; i < 6; i++) { const a = i * 1.1 + t * 3; dot(g, p.x + Math.cos(a) * (40 + t * 50), p.y - 10 - t * 40 - (i % 2) * 10, 6 + (1 - t) * 6, 0xd8c3a5); }
        return;
      case 'pigeons':
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + now / 300; pigeon(g, p.x + Math.cos(a) * 34, p.y - 60 - Math.sin(t * Math.PI) * 260 + Math.sin(a) * 12, Math.cos(a) > 0 ? 1 : -1, Math.sin(now / 40 + i) * 8); }
        return;
      default:
        if (t > .6) this.stars(p.x, p.y - 80 - (1 - t) * 100);
    }
  }

  /** Knocked out: stars over the head of the hero lying on the street. */
  private drawDown(d: NonNullable<RunView['down']>): void {
    const p = point(d.x, d.y);
    if (d.t > .1) this.stars(p.x - 44, p.y - 24);
  }

  /** The fate: relief, then the silly event and its sound word, then the fall. */
  private drawFinale(f: RunView['finale']): void {
    if (!f) return void this.sound.setVisible(false);
    const p = point(f.x, f.y), t = f.t, g = this.fx, now = this.scene.time.now;
    const ev = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    switch (f.kind) {
      case 'sau': {
        // A tiny green fruit drops on the head and bounces off.
        const fall = ev(.36, .48), off = ev(.48, .62);
        if (t > .3 && t < .62) oval(g, p.x + off * 50, p.y - 64 - (1 - fall) * 320 - Math.sin(off * Math.PI) * 50, 12, 15, 0x9ccf5c);
        break;
      }
      case 'coin':
        if (t < .5) rr(g, p.x + 18, p.y - 6, 22, 11, 2, 0x8fd08a);
        if (t > .44) { const q = p.x + 24; g.fillStyle(0x9aa1ad).fillRoundedRect(q - 5, p.y - 170, 10, 170, 3).lineStyle(2, INK).strokeRoundedRect(q - 5, p.y - 170, 10, 170, 3); }
        break;
      case 'chair':
        if (t > .28) {
          const broke = t > .55;
          g.lineStyle(4, 0xc8463d);
          for (const s of [-1, 1]) g.lineBetween(p.x + s * 12, p.y - 18, p.x + s * (broke ? 26 : 14), p.y);
          rr(g, p.x - 18, p.y - (broke ? 10 : 24), 36, 8, 3, 0xe2513f);
        }
        break;
      case 'sneeze':
        if (t > .3 && t < .5) for (let i = 0; i < 5; i++) dot(g, p.x + 14 + (i * 7) % 20, p.y - 56 + Math.sin(now / 80 + i) * 4, 2, 0x3a3340);
        if (t > .48 && t < .62) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI - Math.PI / 2; g.lineStyle(3, 0xffffff).lineBetween(p.x + 20 + Math.cos(a) * 10, p.y - 52 + Math.sin(a) * 10, p.x + 20 + Math.cos(a) * 34, p.y - 52 + Math.sin(a) * 34); }
        break;
      case 'lick':
        if (t > .2) dog(g, p.x + 70 - ev(.2, .4) * 20, p.y + 4, -1, t < .4 ? now / 55 : 0, 1.35);
        if (t > .44 && t < .64) oval(g, p.x + 16, p.y - 52 + Math.sin(now / 50) * 6, 16, 26, 0xff8a8a);
        break;
      case 'news':
        if (t > .3 && t < .66) {
          rr(g, p.x + 16, p.y - 92, 60, 44, 3, 0xfffaf0);
          g.fillStyle(0xe2513f).fillRect(p.x + 22, p.y - 86, 48, 6);
          g.fillStyle(INK).fillRect(p.x + 34, p.y - 66, 26, 5).fillCircle(p.x + 30, p.y - 64, 4);
        }
        break;
    }
    // The sound word pops at the event and fades as the hero falls.
    const s = ev(.46, .52);
    this.sound.setVisible(t > .46 && t < .8);
    if (this.sound.visible) this.sound.setText(f.sound).setPosition(p.x, p.y - 130).setScale((.6 + s * .6) * Math.max(1, 1 / this.scene.cameras.main.zoom)).setAlpha(t > .7 ? (.8 - t) / .1 : 1);
    if (t > .7) this.stars(p.x - 44, p.y - 24);
  }

  /** A harmless gag on the hero: flowered shorts over the head, or the durian smell around it. */
  private drawDaze(kind: 'smell' | 'shorts', hero: WorldPos): void {
    const p = point(hero.x, hero.y), now = this.scene.time.now;
    if (kind === 'shorts') shorts(this.fx, p.x, p.y - 58);
    else for (let i = 0; i < 3; i++) {
      const y = p.y - 70 - ((now / 12 + i * 20) % 50);
      this.fx.lineStyle(3, 0x9ccf5c, .8).beginPath().moveTo(p.x - 20 + i * 20, y);
      for (let k = 1; k <= 4; k++) this.fx.lineTo(p.x - 20 + i * 20 + Math.sin(k * 1.6 + now / 150) * 6, y - k * 6);
      this.fx.strokePath();
    }
  }

  destroy(): void {
    this.ground.destroy();
    this.fx.destroy();
    this.sound.destroy();
    for (const g of this.bodies.values()) g.destroy();
    this.bodies.clear();
    for (const b of this.bubbles.values()) b.destroy();
    this.bubbles.clear();
  }
}

type Pose = { sx: number; sy: number; dy: number; angle: number; alpha: number };
const STAND: Pose = { sx: 1, sy: 1, dy: 0, angle: 0, alpha: 1 };
/** Lying flat on the street (the figure turns about its feet). */
const LYING = -Math.PI / 2;

/** How the hero's figure moves in the run: the gag that got them, the fate, then lying knocked out. */
export function runPose(run: RunView | null): Pose {
  if (!run) return STAND;
  if (run.hit) return hitPose(run.hit);
  if (run.finale) return finalePose(run.finale);
  // Down: drops flat with a little bounce, then lies still.
  if (run.down) { const k = Math.min(1, run.down.t / .12); return { sx: 1, sy: 1, dy: -Math.sin(k * Math.PI) * 10, angle: LYING * k, alpha: 1 }; }
  return STAND;
}

/** The gag that got the hero: sinks, flies off, spins or gets squashed (and comes back into view to lie down). */
function hitPose(d: NonNullable<RunView['hit']>): Pose {
  const t = d.t, e = 1 - (1 - t) * (1 - t);
  switch (d.kind) {
    case 'sinkhole': { const s = Math.sin(t * Math.PI); return { sx: 1 - s * .7, sy: 1 - s * .7, dy: s * 40, angle: e * Math.PI * 2, alpha: 1 - s * .9 }; }
    case 'motorbike': return { sx: 1, sy: 1, dy: -Math.sin(t * Math.PI) * 220, angle: t * Math.PI * 4, alpha: 1 };
    case 'pigeons': return { sx: 1, sy: 1, dy: -Math.sin(t * Math.PI) * 260, angle: Math.sin(t * 20) * .3, alpha: 1 };
    case 'banana': return { sx: 1, sy: 1, dy: -Math.sin(t * Math.PI) * 140, angle: e * Math.PI * 3, alpha: 1 };
    case 'durian':
    case 'water': return { sx: 1 + e * .25, sy: 1 - e * .45, dy: 0, angle: 0, alpha: 1 };
    default: return { sx: 1, sy: 1, dy: 0, angle: Math.sin(t * 40) * .15 * (1 - t), alpha: 1 };
  }
}

function finalePose(f: NonNullable<RunView['finale']>): Pose {
  const t = f.t;
  const ev = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const fall = ev(.62, .72);
  const lie = { angle: LYING * fall, dy: -Math.sin(fall * Math.PI) * 12 };
  if (t >= .62) return { sx: 1, sy: 1, alpha: 1, ...lie };
  switch (f.kind) {
    case 'sau': return { sx: 1, sy: t > .48 && t < .56 ? .85 : 1, dy: 0, angle: 0, alpha: 1 };
    case 'coin': return { sx: 1, sy: t > .36 && t < .5 ? .78 : 1, dy: 0, angle: t > .5 ? Math.sin(t * 90) * .12 : 0, alpha: 1 };
    case 'chair': return { sx: 1, sy: t > .3 ? .8 : 1, dy: t > .55 ? 16 : t > .3 ? 6 : 0, angle: 0, alpha: 1 };
    case 'sneeze': return { sx: 1, sy: 1, dy: -Math.sin(ev(.48, .62) * Math.PI) * 60, angle: t < .48 ? -ev(.36, .48) * .25 : -.25 - ev(.48, .62) * .5, alpha: 1 };
    case 'lick': return { sx: 1, sy: 1, dy: 0, angle: t > .44 ? Math.sin(t * 80) * .1 : 0, alpha: 1 };
    default: return STAND;
  }
}

/** A tiny chihuahua with huge ears, yapping (the warning before the big dog). */
function chihuahua(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number): void {
  shadow(g, x, y, 30, 10);
  oval(g, x, y - 12, 24, 14, 0xe8c08a);
  dot(g, x + 12 * f, y - 22, 8, 0xe8c08a);
  tri(g, [x + 6 * f, y - 26, x + 4 * f, y - 42, x + 14 * f, y - 28], 0xe8c08a);
  tri(g, [x + 14 * f, y - 28, x + 22 * f, y - 40, x + 20 * f, y - 24], 0xe8c08a);
  g.fillStyle(INK).fillCircle(x + 15 * f, y - 23, 2);
}

/** A white hen with a red comb, facing `f`. */
function chicken(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number): void {
  shadow(g, x, y, 26, 9);
  oval(g, x, y - 14, 24, 18, 0xffffff);
  dot(g, x + 9 * f, y - 26, 7, 0xffffff);
  tri(g, [x + 6 * f, y - 32, x + 10 * f, y - 38, x + 13 * f, y - 32], 0xe2513f);
  tri(g, [x + 15 * f, y - 27, x + 22 * f, y - 25, x + 15 * f, y - 23], 0xffc94a);
  g.fillStyle(INK).fillCircle(x + 11 * f, y - 27, 1.6);
}

/** Flowered boxer shorts. */
function shorts(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  rr(g, x - 20, y - 14, 40, 16, 4, 0xff8a73);
  rr(g, x - 20, y, 18, 12, 3, 0xff8a73);
  rr(g, x + 2, y, 18, 12, 3, 0xff8a73);
  for (const [dx, dy] of [[-12, -7], [4, -9], [12, 4], [-10, 6]] as const) g.fillStyle(0xffd25e).fillCircle(x + dx, y + dy, 2.5);
}

/** A kicked shuttlecock: feathers up, weighted end towards where it flies. */
function shuttlecock(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number): void {
  tri(g, [x - 10 * f, y - 10, x - 10 * f, y + 10, x + 6 * f, y], 0xffffff);
  dot(g, x + 8 * f, y, 5, 0xe2513f);
}

function drawDurian(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; tri(g, [x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a + .3) * r, y + Math.sin(a + .3) * r, x + Math.cos(a + .15) * (r + 7), y + Math.sin(a + .15) * (r + 7)], 0x9ccf5c); }
  dot(g, x, y, r, 0xb4dc74);
}
