import { drawChapter1Backdrop } from './chapter1Scenery';
import { roadDashes, streetPaver, streetKerb } from './streetPaving';
import { streetHouses } from './streetLayout';
import { SLICE_ASSETS, SLICE_STALL_FRAMES, sliceAnimalFrame, sliceCargoBikeFrame, sliceHeroFrame, sliceHeroReactionFrame, appearanceSeed, treeAppearance, sliceMotorbikeFrame } from './sliceAssets';
import { facingFrom, type Facing } from '../../entities/Actor';
import Phaser from 'phaser';
import { actorDepth, floorDepth, worldToScreen } from '../../utils/iso';
import type { HazardView, RunView } from '../../gameplay/story/RunService';
import type { Footprint, WorldPos } from '../../utils/tile';
import type { ActorView, ActorViewState, FloorTileView } from './WorldRenderer';
import { TERRAIN_COLORS } from './placeholderStyles';
import { SpeechBubble } from './speechBubble';

/**
 * Chapter 1 street: shared 2.5D atlases over a baked, grid-aligned ground.
 * Coordinates and collisions remain owned by the map.
 */
export const INK = 0x5a3825;
export const STREET_BACKGROUND = 0xe7e0d0;
const STREET_SURFACES = {
  road: 0x8c989c,
  sidewalk: [0xeee3ce, 0xe9ddc7, 0xf1e7d5],
  grass: [0xaec28c, 0xa8bd83, 0xb5c995],
};

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
  // Street furniture that blocks the way: street trees, iced-tea stools, parked motorbikes.
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

/** A street tree's pit, flat on the pavement: a stone kerb round a square of soil with a few tufts. */
function treePit(scene: Phaser.Scene, id: string, f: Footprint): void {
  const { x, y } = f, sq = (a: number, b: number) => [[x + a, y + a], [x + b, y + a], [x + b, y + b], [x + a, y + b]];
  bakeImage(scene, `hn:treepit:${id}`, screenBox([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], 8, 4), floorDepth + .5, (g) => {
    face(g, sq(.06, .94), 0xa79f8c, 1, 0);
    face(g, sq(.1, .9), 0xd9d0bd, 1, 1);
    face(g, sq(.22, .78), 0x7b5b40, 1, 1);
    for (const [tx, ty] of [[.32, .4], [.62, .33], [.45, .66], [.7, .62]] as const) {
      const p = point(x + tx, y + ty);
      g.fillStyle(0x7fb35f).fillCircle(p.x, p.y - 1, 3);
    }
  });
}

/** A chapter-1 map object (street prop, parked car, barrier) as one baked image; null for types drawn elsewhere. */
export function bakeIncidentObject(scene: Phaser.Scene, id: string, type: string, f: Footprint, variant: string, depth: number): Phaser.GameObjects.Image | null {
  if (!['street_prop', 'stall', 'sau_tree', 'stools', 'parked_bike', 'kitten', 'car', 'barrier'].includes(type)) return null;
  const centre = point(f.x + f.w / 2, f.y + f.h / 2);
  const variantIndex = appearanceSeed(id);
  if (type === 'stall' && SLICE_STALL_FRAMES[variant] !== undefined) {
    const image = sliceProp(scene, SLICE_ASSETS.stalls.key, SLICE_STALL_FRAMES[variant]!, depth);
    if (image) {
      const front = point(f.x + f.w, f.y + f.h);
      // Mirror the atlas's long facade onto the map's x axis; anchor its front ground corner.
      return image.setPosition(front.x, front.y).setOrigin(.65, .97).setFlipX(true)
        .setDisplaySize((f.w + f.h) * 64, 104 + (f.w + f.h) * 32);
    }
  }
  if (type === 'sau_tree') {
    treePit(scene, id, f);
    const image = sliceProp(scene, SLICE_ASSETS.treesVaried.key, treeAppearance(id), depth) ?? sliceProp(scene, SLICE_ASSETS.trees.key, variantIndex % 3, depth);
    if (image) return image.setPosition(centre.x, centre.y).setOrigin(.5, .98).setScale((126 + variantIndex % 33) / image.height);
  }
  if (type === 'parked_bike') {
    const image = sliceProp(scene, SLICE_ASSETS.parkedBikes.key, variantIndex % 4, depth);
    if (image) return image.setPosition(centre.x, centre.y).setOrigin(.5, .86).setScale(54 / image.height);
  }
  if (type === 'car') {
    const image = sliceProp(scene, SLICE_ASSETS.parkedCars.key, Math.floor(variantIndex / 2) % 2, depth);
    if (image) return image.setPosition(centre.x, centre.y).setOrigin(.5, .84).setDisplaySize((f.w + f.h) * 64, 104 + (f.w + f.h) * 32);
  }
  const b = screenBox([[f.x, f.y], [f.x + f.w, f.y], [f.x, f.y + f.h], [f.x + f.w, f.y + f.h]], 170, 70);
  return bakeImage(scene, `hn:obj:${id}:${variant}`, b, depth, (g) => drawIncidentObject(g, type, f, variant));
}

function sliceProp(scene: Phaser.Scene, key: string, frame: number, depth: number): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key) || !scene.textures.get(key).has(String(frame))) return null;
  return scene.add.image(0, 0, key, String(frame)).setDepth(depth).setData('sliceProp', true);
}

/** Shared house art also covers the street extensions and the blocks inside traffic loops. */
function houseSprite(scene: Phaser.Scene, f: Footprint, height: number, variant: number): boolean {
  const varied = scene.textures.exists(SLICE_ASSETS.housesVaried.key) && scene.textures.get(SLICE_ASSETS.housesVaried.key).has('5');
  const pick = ((variant % 9) + 9) % 9;
  const key = varied && pick < 6 ? SLICE_ASSETS.housesVaried.key : SLICE_ASSETS.houses.key, frame = String(varied && pick < 6 ? [0, 3, 1, 4, 2, 5][pick] : pick % 3);
  if (!scene.textures.exists(key) || !scene.textures.get(key).has(frame)) return false;
  const front = point(f.x + f.w, f.y + f.h);
  scene.add.image(front.x, front.y, key, frame).setOrigin(.54, .97)
    .setDisplaySize((f.w + f.h) * 64, height + (f.w + f.h) * 32)
    .setDepth(f.x + f.w + f.y + f.h - 1);
  return true;
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

/** Chapter-1 map layout (see incident.json): the main road, a sidewalk either side, the alley going north, a planted promenade to the south. */
const ROAD_ROWS = [8, 10];
/** The land ends a few tiles past the map, with a loop road round a block of houses at each end of the street. */
const LAND_W = -18, LAND_E = 69;
/** The loop road at each end of the street: the road goes round a block of houses and comes back (rings of asphalt around a plot). Keep in step with the path in StreetService (`LOOP`). */
const LOOP = { y0: 6.6, y1: 12.4, plotY0: 8, plotY1: 11, w: { x0: -18, x1: -12.3, px0: -16.7, px1: -14 }, e: { x0: 62.3, x1: 69, px0: 64, px1: 66.7 } } as const;
const ROUNDABOUT = { w: -2.8, e: 52.2, r: 2.5, island: .5 };
/** The gap in the north row of houses: the alley (x 21–23) and the courtyard at its end (x 19–25). */
const ALLEY_X0 = 19, ALLEY_X1 = 26;
const MAP_W = 48, MAP_H = 18;
/** Past these (the edge of the land) a vehicle that has driven off is not drawn. */
export const STREET_ENDS = { w: LAND_W + .2, e: LAND_E - .2 };
const inRange = (v: number, [lo, hi]: number[]) => v >= lo! && v <= hi!;

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
  for (let tx = x + .16; tx < x + w; tx += .24) {
    const a = point(tx, y, h + 10), b = point(tx, y + d, h + 10);
    g.lineStyle(1, 0x9f5545, .32).lineBetween(a.x, a.y, b.x, b.y);
  }
  face(g, [[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, 7], [x, y + d, 7]], 0xc6b99f, 1, 0);
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

/** O Quan Chuong: the old city gate, arching over the road where it leaves the map. */
function cityGate(g: Phaser.GameObjects.Graphics, x: number, y0: number, y1: number): void {
  const start = y0, end = y1 + 1, spring = 120, rise = 50, top = 190, width = 1.4;
  const archZ = (y: number) => spring + rise * Math.sqrt(Math.max(0, 1 - ((y - (start + end) / 2) / ((end - start) / 2)) ** 2));
  // Supports stay on the two sidewalks. The road below the arch is never filled.
  for (const y of [start - 1, end]) {
    block(g, { x, y, w: width, h: 1 }, 0, top, 0xb98163, 1.5);
    block(g, { x, y, w: width, h: 1 }, 0, 12, 0xc8b99e, 1);
    for (let row = 0; row < 8; row++) for (let brick = 0; brick < 3; brick++) {
      const ya = y + .06 + brick * .3, z = 18 + row * 20;
      face(g, [[x + width, ya, z], [x + width, ya + .25, z], [x + width, ya + .25, z + 16], [x + width, ya, z + 16]], (row + brick) % 2 ? 0xba876b : 0xc99474, 1, .6);
    }
  }
  const arch: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 24; i++) {
    const a = start + (end - start) * i / 24, b = start + (end - start) * (i + 1) / 24;
    const za = archZ(a), zb = archZ(b);
    face(g, [[x, a, za], [x + width, a, za], [x + width, b, zb], [x, b, zb]], 0x8c725b, 1, 0);
    face(g, [[x + width, a, za], [x + width, b, zb], [x + width, b, top], [x + width, a, top]], 0xb98163, 1, 0);
    arch.push(point(x + width, a, za));
  }
  arch.push(point(x + width, end, archZ(end)));
  g.lineStyle(7, 0xd7c3a0).strokePoints(arch, false);
  block(g, { x, y: start - 1, w: width, h: end - start + 2 }, top, 8, 0xd5c4a7, 1.5);
  block(g, { x: x + .08, y: start - .9, w: width - .16, h: end - start + 1.8 }, top + 8, 20, 0xc69a7c, 1);
  for (let y = start - .85; y < end + .7; y += .7) block(g, { x: x + 1.06, y, w: .28, h: .38 }, top + 28, 10, 0xd7c7ac, 1);
  const pavilion = { x: x + .12, y: (start + end) / 2 - .85, w: 1.16, h: 1.7 };
  block(g, pavilion, top + 28, 44, 0xe1cba4, 1.5);
  for (const y of [pavilion.y + .2, pavilion.y + 1]) face(g, [[pavilion.x + pavilion.w, y, top + 35], [pavilion.x + pavilion.w, y + .4, top + 35], [pavilion.x + pavilion.w, y + .4, top + 60], [pavilion.x + pavilion.w, y, top + 60]], 0x665647, 1, 1);
  const roofX = x - .08, roofY = pavilion.y - .18, roofW = 1.56, roofD = 2.06, eave = top + 74, ridge = eave + 20;
  face(g, [[roofX, roofY, eave], [roofX + roofW / 2, roofY + .18, ridge], [roofX + roofW / 2, roofY + roofD - .18, ridge], [roofX, roofY + roofD, eave]], 0xb96e4d, 1, 1.5);
  face(g, [[roofX + roofW, roofY, eave], [roofX + roofW, roofY + roofD, eave], [roofX + roofW / 2, roofY + roofD - .18, ridge], [roofX + roofW / 2, roofY + .18, ridge]], 0x99563f, 1, 1.5);
  face(g, [[roofX, roofY + roofD, eave], [roofX + roofW / 2, roofY + roofD - .18, ridge], [roofX + roofW, roofY + roofD, eave]], 0x8b523d, 1, 1.5);
}

/** Over the rooftops, the sky: one flat shape (no texture), pale towards the horizon. */
function drawSky(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(floorDepth - 3.5);
  const band = (y0: number, y1: number, color: number) => g.fillStyle(color).fillPoints([[LAND_W - 80, y0], [LAND_E + 80, y0], [LAND_E + 80, y1], [LAND_W - 80, y1]].map(([x, y]) => point(x!, y!)), true);
  band(-140, SKY_FROM - 6, 0xa9d8f0);
  band(SKY_FROM - 6, SKY_FROM - 2, 0xc4e5f4);
  band(SKY_FROM - 2, SKY_FROM + .2, SKY_HORIZON);
}

export function drawIncidentEnvironment(scene: Phaser.Scene, floor: FloorTileView[]): void {
  drawChapter1Backdrop(scene);
  drawSky(scene);
  // Everything flat (ground around the map, the map's own floor, markings, beds) is one baked layer.
  bakeLayer(scene, 'hn:ground:street-v2', screenBox([[LAND_W - 1, ROOFS_FROM - 1], [LAND_E + 1, ROOFS_FROM - 1], [LAND_W - 1, MAP_H + 8], [LAND_E + 1, MAP_H + 8]], 0, 0), floorDepth - .8, (g) => drawGround(g, floor), .6);
  drawStanding(scene);
}

/** Roof colour under the house rows from this row on; north of it, the sky (see `drawSky`). */
const SKY_FROM = -3;
const SKY_HORIZON = 0xe2f2f8;
const ROOFS_FROM = SKY_FROM;

/** Under and between the rows of houses: the horizon's colour, so only sky ever shows past the rooftops. */
function roofTile(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  face(g, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], SKY_HORIZON, 1, 0);
}

/** The flat street: around the map, the map floor itself, road markings, the zebra crossing and flower beds. */
function drawGround(surround: Phaser.GameObjects.Graphics, floor: FloorTileView[]): void {
  // Beyond the map: the road and both sidewalks run on east and west, the decorative city continues outside the playable district.
  for (let y = ROOFS_FROM; y < MAP_H + 8; y++) for (let x = LAND_W; x < LAND_E; x++) {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) continue;
    // Under the house rows: roof colour (it only shows between the houses); further back the sky shows through.
    if (y < 5) { if (y >= SKY_FROM) roofTile(surround, x, y); continue; }
    if (y >= MAP_H) continue;
    const n = ((x * 17 + y * 31) % 7 + 7) % 7;
    // Past the map's ends the sidewalks carry on, laid exactly like the ones on the map.
    if (inRange(y, ROAD_ROWS)) face(surround, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], STREET_SURFACES.road, 1, 0);
    else streetPaver(surround, x, y);
  }
  // The map's own floor, tile by tile.
  for (const t of floor) {
    const { x, y } = t.tile;
    const n = Math.abs(x * 17 + y * 31) % 3;
    const top = t.kind === 'street' ? STREET_SURFACES.road : t.kind === 'sidewalk' ? STREET_SURFACES.sidewalk[n]! : t.kind === 'grass' ? STREET_SURFACES.grass[n]! : t.kind === 'city_edge' ? STREET_SURFACES.sidewalk[n]! : (TERRAIN_COLORS[t.kind] ?? TERRAIN_COLORS.floor!).top;
    // Every bit of ground on the map is laid with the same pavers (the courtyard and the alley included).
    if (t.kind === 'sidewalk' || t.kind === 'city_edge') streetPaver(surround, x, y);
    else face(surround, [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], top, 1, 0);
    if (t.kind === 'street') {
      const q = point(x + .24 + n * .12, y + .35);
      surround.fillStyle(0xe1e0d6, .13).fillCircle(q.x, q.y, 1.5);
    }
  }
  // Road markings: centre dashes, kerbs, and a zebra crossing in front of the alley.
  const road = surround;
  // Asphalt is one surface, not a checkerboard of individually outlined ground tiles.
  face(road, [[LAND_W, 8], [LAND_E, 8], [LAND_E, 11], [LAND_W, 11]], STREET_SURFACES.road, 1, 0);
  const mid = (ROAD_ROWS[0]! + ROAD_ROWS[1]!) / 2;
  roadDashes(road, LAND_W, LAND_E, mid + .5, (x) => inRange(x, [ALLEY_X0, ALLEY_X1]));
  // The same kerb the whole length of the street, on both sides (the far one shows its face, the near one only its top).
  streetKerb(road, LAND_W, LAND_E, ROAD_ROWS[0]!, 1);
  streetKerb(road, LAND_W, LAND_E, ROAD_ROWS[1]! + 1, -1);
  for (let x = ALLEY_X0 + 1.1; x < ALLEY_X1 - 1; x += .45) face(road, [[x, ROAD_ROWS[0]! + .15], [x + .22, ROAD_ROWS[0]! + .15], [x + .22, ROAD_ROWS[1]! + .85], [x, ROAD_ROWS[1]! + .85]], 0xffffff, .9, 0);

  // A loop road at each end of the street: it goes round a block of houses, and the bikes ride round it and come back the other way.
  const rect = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (const l of [LOOP.w, LOOP.e]) {
    face(road, rect(l.x0, LOOP.y0, l.x1, LOOP.y1), STREET_SURFACES.road, 1, 0);
    road.lineStyle(2.5, 0xffffff, .95).strokePoints(rect(l.x0, LOOP.y0, l.x1, LOOP.y1).map(([x, y]) => point(x!, y!)), true);
    // The plot in the middle: pavement with a kerb, the houses stand on it.
    face(road, rect(l.px0 - .18, LOOP.plotY0 - .18, l.px1 + .18, LOOP.plotY1 + .18), 0xe9dfc9, 1, 2);
    face(road, rect(l.px0, LOOP.plotY0, l.px1, LOOP.plotY1), 0xf3e7d3, 1, 0);
  }

}

const EATERY_WALLS = [0xf2e2a0, 0xf6c7b4, 0xc9ecd9, 0xfff0c9, 0xe8d6ad, 0xd6ddd8] as const;
const EATERY_STRIPES = [0xd45a45, 0x3c8f86, 0xd99a3e, 0x4a7fae, 0xb5556f] as const;
const SHOP_ROOFS = [0x9aa7a0, 0xb06a52, 0x88a08f, 0xa98e6c] as const;
const SOUTH_SHOPS = ['Phở gà', 'Lẩu', 'Cơm rang', 'Bánh cuốn', 'Trà chanh', 'Bún ốc', 'Ốc luộc', 'Miến lươn', 'Tạp hóa', 'Bánh tôm'] as const;
/** The south shop row: from the street's kerb side of the shops (y) to their back, one-storey high. */
const SOUTH_ROW = { y: 17.05, d: 1.6, w: 2.3, gap: .3, height: 44 } as const;

/**
 * A one-storey shop on the south side, seen from behind (the camera looks over it at the street): a plastered
 * back wall with a window and an air-conditioner, a ribbed tin roof sloping down towards the street, and a
 * short striped canvas awning with a scalloped edge hanging over the sidewalk.
 */
function backShop(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, d: number, h: number, wall: number, stripe: number, roof: number, k: number): void {
  block(g, { x, y, w, h: d }, 0, h, wall, 1.2);
  face(g, [[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, 7], [x, y + d, 7]], shadeOf(wall, -18), 1, 0);
  // Back wall: a shuttered window, an air-conditioner (the right-hand ones), a stain of damp.
  const wx = x + (k % 2 ? .35 : 1.25);
  face(g, [[wx, y + d, h - 30], [wx + .55, y + d, h - 30], [wx + .55, y + d, h - 12], [wx, y + d, h - 12]], 0x6f8f86, 1, 1);
  face(g, [[wx + .27, y + d, h - 30], [wx + .28, y + d, h - 30], [wx + .28, y + d, h - 12], [wx + .27, y + d, h - 12]], 0x4f6a63, 1, 0);
  if (k % 3 !== 1) block(g, { x: x + (k % 2 ? 1.5 : .3), y: y + d, w: .42, h: .14 }, h - 26, 13, 0xe9e9e4, 1);
  face(g, [[x + .2, y + d, 7], [x + .9, y + d, 7], [x + .75, y + d, 15], [x + .3, y + d, 13]], shadeOf(wall, -9), .6, 0);
  // Tin roof, ribbed, a little past the walls.
  const hi = h + 12, lo = h - 1, back = y + d + .08, front = y - .12;
  face(g, [[x - .06, back, hi], [x + w + .06, back, hi], [x + w + .06, front, lo], [x - .06, front, lo]], roof, 1, 1.2);
  for (let i = 1; i < 10; i++) {
    const rx = x - .06 + ((w + .12) * i) / 10, a = point(rx, back, hi), b2 = point(rx, front, lo);
    g.lineStyle(1, shadeOf(roof, -16), .7).lineBetween(a.x, a.y, b2.x, b2.y);
  }
  // The awning over the sidewalk, striped, its edge scalloped.
  const out = y - .72, drop = lo - 15;
  for (let i = 0; i < 8; i++) {
    const a = x + (w * i) / 8, b2 = x + (w * (i + 1)) / 8;
    face(g, [[a, front, lo], [b2, front, lo], [b2, out, drop], [a, out, drop]], i % 2 ? 0xfaf3e3 : stripe, 1, 0);
    const c = point((a + b2) / 2, out, drop);
    g.fillStyle(i % 2 ? 0xfaf3e3 : stripe).fillCircle(c.x, c.y, 5.5);
  }
  const l0 = point(x, out, drop), l1 = point(x + w, out, drop);
  g.lineStyle(1.2, INK, .8).lineBetween(l0.x, l0.y, l1.x, l1.y);
  // Something on the roof: a water tank or a row of potted plants.
  if (k % 2) {
    block(g, { x: x + w - .75, y: y + d - .7, w: .45, h: .45 }, hi - 6, 16, 0xdfe6ea, 1);
  } else for (let i = 0; i < 3; i++) {
    const q = point(x + .45 + i * .5, y + d - .25, hi - 4);
    g.fillStyle(0xb9684f).fillRect(q.x - 5, q.y - 6, 10, 7);
    g.fillStyle(0x86c86b).fillCircle(q.x, q.y - 10, 7).lineStyle(1, INK, .6).strokeCircle(q.x, q.y - 10, 7);
  }
}

/** The shop's name on a small board, readable over any background. */
function shopSign(scene: Phaser.Scene, at: Phaser.Math.Vector2, name: string, color: number, depth: number): Phaser.GameObjects.Text {
  return scene.add.text(at.x, at.y, name, { fontFamily: "'Baloo 2', sans-serif", fontSize: '17px', fontStyle: '800', color: '#fffaf0', backgroundColor: `#${color.toString(16).padStart(6, '0')}`, padding: { x: 6, y: 0 }, stroke: '#5a3825', strokeThickness: 2, resolution: 2 })
    .setOrigin(.5, 1).setDepth(depth);
}

/** South shops, per scene: their images and signs fade while the hero is behind them. */
const southShops = new WeakMap<Phaser.Scene, Array<{ parts: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text>; depth: number; x0: number; x1: number; y0: number; y1: number }>>();

function southShopRow(scene: Phaser.Scene): void {
  const list: NonNullable<ReturnType<typeof southShops.get>> = [];
  const { y, d, w, gap, height } = SOUTH_ROW;
  for (let x = LAND_W, k = 0; x + w <= LAND_E; x += w + gap, k++) {
    const wall = EATERY_WALLS[k % EATERY_WALLS.length]!, stripe = EATERY_STRIPES[(k * 2) % EATERY_STRIPES.length]!, depth = x + w + y + d - 1;
    const box = screenBox([[x, y - .6], [x + w, y - .6], [x, y + d], [x + w, y + d]], height + 30, 12);
    const img = bakeImage(scene, `hn:shop:s2:${k}`, box, depth, (g) => backShop(g, x, y, w, d, height, wall, stripe, SHOP_ROOFS[k % SHOP_ROOFS.length]!, k));
    const sign = shopSign(scene, point(x + w / 2, y + d * .5, height + 14), SOUTH_SHOPS[k % SOUTH_SHOPS.length]!, stripe, depth + .001);
    list.push({ parts: [img, sign], depth, x0: box.x, x1: box.x + box.w, y0: box.y, y1: box.y + box.h });
  }
  southShops.set(scene, list);
}

/** The hero behind a south shop (it is drawn in front of them): the shop goes see-through so they stay visible. */
export function fadeSouthShops(scene: Phaser.Scene, hero: WorldPos): void {
  const list = southShops.get(scene);
  if (!list) return;
  const p = worldToScreen(hero), depth = hero.x + hero.y;
  for (const s of list) {
    const behind = depth < s.depth && p.x > s.x0 + 20 && p.x < s.x1 - 20 && p.y - 40 > s.y0 && p.y - 40 < s.y1;
    const a = behind ? .45 : 1;
    if (s.parts[0]!.alpha !== a) for (const part of s.parts) part.setAlpha(a);
  }
}

/** Everything that stands up: houses, landmarks, poles and wires, street life, trees (all baked). */
function drawStanding(scene: Phaser.Scene): void {
  // Each facade sorts by its real footprint, so people behind it cannot appear on its roof.
  const walls = [0xe8d6ad, 0xf0e4ca, 0xc5d6c6, 0xe4c5b1, 0xd6ddd8];
  const signs = [0xb9684f, 0x5d9692, 0xd0aa5c, 0x809c72, 0xb78a7f];
  for (const h of streetHouses()) {
    if (houseSprite(scene, { x: h.x, y: h.y, w: h.w, h: h.d }, h.height, h.variant)) continue;
    const corners: Array<[number, number]> = [[h.x, h.y], [h.x + h.w, h.y], [h.x, h.y + h.d], [h.x + h.w, h.y + h.d]];
    bakeLayer(scene, `hn:houses:${h.variant}`, screenBox(corners, h.height + 16, 12), h.x + h.w + h.y + h.d - 1, city => {
      tubeHouse(city, h.x, h.y, h.w, h.d, h.height, walls[h.variant % walls.length]!, signs[h.variant % signs.length]!);
    }, .85);
  }
  // The south side of the street: one-storey eateries and shops all along (low, so they never wall off the street).
  southShopRow(scene);
  // The block of houses in the middle of each loop.
  for (const [key, l, wall, sign] of [['w', LOOP.w, 0xf6d77a, 0xe2513f], ['e', LOOP.e, 0xc9ecd9, 0x5ec8f2]] as const) {
    if (houseSprite(scene, { x: l.px0 + .2, y: LOOP.plotY0 + .2, w: l.px1 - l.px0 - .4, h: LOOP.plotY1 - LOOP.plotY0 - .4 }, 156, key === 'w' ? 0 : 2)) continue;
    bakeLayer(scene, `hn:loophouse:${key}`, screenBox([[l.px0, LOOP.plotY0], [l.px1, LOOP.plotY0], [l.px0, LOOP.plotY1], [l.px1, LOOP.plotY1]], 230), l.px1 + LOOP.plotY1 - 1, (g) => {
      tubeHouse(g, l.px0 + .2, LOOP.plotY0 + .2, l.px1 - l.px0 - .4, LOOP.plotY1 - LOOP.plotY0 - .4, 170, wall, sign);
    }, .75);
  }

  bakeLayer(scene, 'hn:gate:v2', screenBox([[MAP_W + .4, ROAD_ROWS[0]! - 2], [MAP_W + 2.6, ROAD_ROWS[0]! - 2], [MAP_W + .4, ROAD_ROWS[1]! + 3], [MAP_W + 2.6, ROAD_ROWS[1]! + 3]], 315), MAP_W + 12, (gate) => cityGate(gate, MAP_W + .8, ROAD_ROWS[0]!, ROAD_ROWS[1]!));
  plate(scene, MAP_W + 1.5, (ROAD_ROWS[0]! + ROAD_ROWS[1]! + 1) / 2, 310, 'Ô Quan Chưởng');

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
      // No wires slung across the alley mouth (with no houses behind, they read as lines on the ground).
      if (poles[i + 1]![0] - poles[i]![0] > 6) continue;
      const a = point(poles[i]![0], poles[i]![1], 140), b = point(poles[i + 1]![0], poles[i + 1]![1], 140);
      for (let k = 0; k < 3; k++) {
        const sag = 18 + k * 9, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + sag;
        wires.lineStyle(1.2, 0x555047, .55).beginPath().moveTo(a.x, a.y + k * 3);
        for (let u = 0.1; u <= 1.001; u += .1) { const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x, y = (1 - u) * (1 - u) * (a.y + k * 3) + 2 * (1 - u) * u * my + u * u * (b.y + k * 2); wires.lineTo(x, y); }
        wires.strokePath();
      }
    }
  });

  // Plastic stools, parked motorbikes and the sấu trees are map objects (they block the way): see `drawIncidentObject`.


}


/** The player in chapter 1: a small outlined figure in a coral jacket. */
/** Screen box (relative to the hero's feet) the baked hero frames cover. */
const HERO_BOX = { x: -30, y: -76, w: 60, h: 90 };
/** Baked at double size so the figure stays sharp when the camera zooms in. */
const HERO_SS = 2;

/** The chapter-1 hero, `bob` pixels up or down on the torso and head (walking). */
function drawHero(g: Phaser.GameObjects.Graphics, bob: number): void {
  shadow(g, 0, 0, 34, 14);
  g.lineStyle(2.5, INK);
  g.fillStyle(0x4f6d8f).fillRoundedRect(-11, -18, 8, 19, 3).strokeRoundedRect(-11, -18, 8, 19, 3).fillRoundedRect(3, -18, 8, 19, 3).strokeRoundedRect(3, -18, 8, 19, 3);
  g.fillStyle(0xff8a73).fillRoundedRect(-16, -44 + bob, 32, 31, 10).strokeRoundedRect(-16, -44 + bob, 32, 31, 10);
  g.fillStyle(0xf6d2b0).fillCircle(-19, -28 + bob, 5).strokeCircle(-19, -28 + bob, 5).fillCircle(19, -28 + bob, 5).strokeCircle(19, -28 + bob, 5);
  g.fillCircle(0, -52 + bob, 13).strokeCircle(0, -52 + bob, 13);
  g.fillStyle(INK).fillEllipse(0, -61 + bob, 27, 12).fillRoundedRect(-13, -61 + bob, 5, 15, 2);
  g.fillCircle(5, -51 + bob, 2);
  g.fillStyle(0xff9e8a, .7).fillCircle(8, -46 + bob, 3);
}

/** One baked hero frame (a Graphics would redraw its ~700 shapes on every frame of the game). */
function heroFrame(scene: Phaser.Scene, bob: number): string {
  const key = `hn:hero:${bob}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.scaleCanvas(HERO_SS, HERO_SS);
    g.translateCanvas(-HERO_BOX.x, -HERO_BOX.y);
    drawHero(g, bob);
    g.generateTexture(key, HERO_BOX.w * HERO_SS, HERO_BOX.h * HERO_SS);
    g.destroy();
  }
  return key;
}

/** The player in chapter 1: a small outlined figure in a coral jacket, drawn from three baked walking frames. */
export class IncidentActorView implements ActorView {
  depth = 0;
  private readonly img: Phaser.GameObjects.Image;
  private readonly illustrated: boolean;
  private readonly spriteScale: number;
  private readonly contactShadow: Phaser.GameObjects.Ellipse | null;
  /** The little progress bar over the head (only while the hero is working; chapter 1 has no such work). */
  private bar: Phaser.GameObjects.Graphics | null = null;
  private pose = { sx: 1, sy: 1, dy: 0, angle: 0 };
  private reaction = false;
  constructor(private readonly scene: Phaser.Scene, useSliceArt = false) {
    this.illustrated = useSliceArt && scene.textures.exists(SLICE_ASSETS.hero.key)
      && scene.textures.get(SLICE_ASSETS.hero.key).has('15');
    if (this.illustrated) {
      const texture = scene.textures.get(SLICE_ASSETS.hero.key);
      this.spriteScale = 70 / Math.max(...Array.from({ length: 16 }, (_, i) => texture.get(String(i)).height));
      this.img = scene.add.image(0, 0, SLICE_ASSETS.hero.key, '0').setOrigin(.5, 1);
      this.contactShadow = scene.add.ellipse(0, 0, 30, 11, INK, .16);
    } else {
      for (const bob of [-2, 0, 2]) heroFrame(scene, bob);
      this.spriteScale = 1 / HERO_SS;
      this.img = scene.add.image(0, 0, heroFrame(scene, 0)).setOrigin(-HERO_BOX.x / HERO_BOX.w, -HERO_BOX.y / HERO_BOX.h);
      this.contactShadow = null;
    }
  }
  update(s: ActorViewState): void {
    const p = worldToScreen(s.pos);
    this.depth = actorDepth(s.pos);
    // Walking bobs the torso: the nearest of three baked frames (-2, 0, +2 px).
    const bob = s.state === 'MOVING' ? Math.round(Math.sin(this.scene.time.now / 85)) * 2 : 0;
    const depth = this.depth;
    const reactions = SLICE_ASSETS.heroReactions.key;
    this.reaction = this.illustrated && !!s.reaction && this.scene.textures.exists(reactions) && this.scene.textures.get(reactions).has('7');
    let scale = this.spriteScale;
    if (this.reaction) {
      const frame = sliceHeroReactionFrame(s.facing, s.reaction!);
      scale = 70 / this.scene.textures.get(reactions).get('0').height;
      this.img.setTexture(reactions, frame).setFlipX((s.reaction === 'stumble' || s.reaction === 'fall') && ['S', 'SW', 'W', 'NW'].includes(s.facing)).setOrigin(s.reaction === 'down' || s.reaction === 'carry' ? .78 : .5, .9);
    } else if (this.illustrated) this.img.setTexture(SLICE_ASSETS.hero.key, sliceHeroFrame(s.facing, s.state === 'MOVING' && this.pose.angle === 0, this.scene.time.now)).setFlipX(false).setOrigin(.5, 1);
    else this.img.setTexture(heroFrame(this.scene, bob));
    this.img.setPosition(p.x, p.y + this.pose.dy).setScale(this.pose.sx * scale, this.pose.sy * scale).setRotation(this.reaction ? 0 : this.pose.angle).setDepth(depth);
    this.contactShadow?.setPosition(p.x - (s.reaction === 'down' || s.reaction === 'carry' ? 28 : 0), p.y).setDisplaySize(s.reaction === 'down' || s.reaction === 'carry' ? 74 : 30, 11).setDepth(depth - .01);
    if (s.progress !== null) {
      const g = (this.bar ??= this.scene.add.graphics()).clear().setPosition(p.x, p.y + this.pose.dy).setScale(this.pose.sx, this.pose.sy).setRotation(this.pose.angle).setDepth(depth).setAlpha(this.img.alpha);
      g.fillStyle(0xfff6e5).fillRoundedRect(-25, -82, 50, 9, 4).lineStyle(2, INK).strokeRoundedRect(-25, -82, 50, 9, 4).fillStyle(0x6fd3c0).fillRoundedRect(-23, -80, 46 * s.progress, 5, 2);
    } else this.bar?.clear();
  }
  hitTest(x: number, y: number): boolean { const p = this.img; return x >= p.x - 22 && x <= p.x + 22 && y >= p.y - 70 && y <= p.y + 5; }
  setAlpha(a: number): void { this.img.setAlpha(a); this.bar?.setAlpha(a); this.contactShadow?.setAlpha(a); }
  /** Death animation pose (scale, lift, spin); identity when alive. */
  setPose(sx: number, sy: number, dy: number, angle: number): void { this.pose = { sx, sy, dy, angle }; }
  destroy(): void { this.img.destroy(); this.bar?.destroy(); this.contactShadow?.destroy(); }
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
 * actors. A knock-out (the gag that got the hero) plays its
 * little slapstick scene on top, then the hero lies there seeing stars.
 */
export class IncidentRunView {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly bodies = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly usedSprites = new Set<string>();
  private readonly atlasHeights = new Map<keyof typeof SLICE_ASSETS, number>();
  private hit: RunView['hit'] = null;
  /** Bubbles over the gags ("Gâu gâu!", "Nắp cống!"). */
  private readonly bubbles = new Map<number, SpeechBubble>();
  constructor(private readonly scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(floorDepth + .7);
    this.fx = scene.add.graphics().setDepth(1e6 - 4);
  }

  /** `heroHidden`: the hero is inside the ambulance (no stars over an empty street). */
  sync(run: RunView | null, hero: WorldPos, heroHidden = false): void {
    fadeSouthShops(this.scene, hero);
    this.ground.clear();
    this.fx.clear();
    this.usedSprites.clear();
    this.hit = run?.hit ?? null;
    const seen = new Set<number>();
    for (const h of run?.hazards ?? []) {
      // The head/impact sprite takes over; do not leave a second copy fading on the road.
      if (h.phase === 'gone' && ((h.kind === 'laundry' && run?.dazed === 'shorts') || ((h.kind === 'slipper' || h.kind === 'pigeons') && run?.hit?.kind === h.kind))) continue;
      seen.add(h.id);
      let g = this.bodies.get(h.id);
      if (!g) this.bodies.set(h.id, (g = this.scene.add.graphics()));
      g.clear().setAlpha(h.phase === 'gone' ? 1 - h.t : 1);
      this.draw(h, g);
    }
    for (const [id, g] of this.bodies) if (!seen.has(id)) { g.destroy(); this.bodies.delete(id); }
    this.syncBubbles(run);
    if (run?.hit) this.drawHit(run.hit);
    if (run?.down && !heroHidden) this.drawDown(run.down);
    if (run?.dazed) this.drawDaze(run.dazed, hero);
    for (const [id, image] of this.sprites) if (!this.usedSprites.has(id)) {
      image.destroy(); this.sprites.delete(id);
    }
  }

  /** Reuse each hazard/impact quad; missing art keeps the code-drawn fallback. */
  private sprite(id: string, asset: keyof typeof SLICE_ASSETS, frame: number): Phaser.GameObjects.Image | null {
    const key = SLICE_ASSETS[asset].key;
    if (!this.scene.textures.exists(key) || !this.scene.textures.get(key).has(String(frame))) return null;
    let image = this.sprites.get(id);
    if (!image) {
      image = this.scene.add.image(0, 0, key, String(frame));
      this.sprites.set(id, image);
    }
    this.usedSprites.add(id);
    return image.setTexture(key, String(frame)).setOrigin(.5).setAlpha(1).setRotation(0).setFlipX(false);
  }

  private atlasReady(asset: keyof typeof SLICE_ASSETS): boolean {
    const spec = SLICE_ASSETS[asset];
    if (!this.scene.textures.exists(spec.key)) return false;
    const texture = this.scene.textures.get(spec.key);
    for (let frame = 0; frame < spec.columns * spec.rows; frame++) if (!texture.has(String(frame))) return false;
    return true;
  }

  private atlasHeight(asset: keyof typeof SLICE_ASSETS): number {
    const cached = this.atlasHeights.get(asset);
    if (cached !== undefined) return cached;
    const spec = SLICE_ASSETS[asset], texture = this.scene.textures.get(spec.key);
    let height = 1;
    for (let frame = 0; frame < spec.columns * spec.rows; frame++) height = Math.max(height, texture.get(String(frame)).height);
    this.atlasHeights.set(asset, height);
    return height;
  }

  private animalSprite(id: string, asset: 'hazardCat' | 'hazardDogs' | 'hazardChickens' | 'hazardPigeons', facing: Facing, phase: number, height: number, rowOffset = 0): Phaser.GameObjects.Image | null {
    const pose = sliceAnimalFrame(facing, phase, rowOffset), image = this.sprite(id, asset, pose.frame);
    if (!image) return null;
    image.setOrigin(.5, 1).setFlipX(pose.flipX).setScale(height / this.atlasHeight(asset));
    if (asset === 'hazardPigeons') {
      // Wing crops vary; anchor the body at the same source-cell point throughout a flap.
      const spec = SLICE_ASSETS[asset], frame = image.frame;
      const source = this.scene.textures.get(spec.key).getSourceImage() as HTMLImageElement;
      const column = pose.frame % spec.columns, row = Math.floor(pose.frame / spec.columns);
      const x0 = Math.floor(column * source.width / spec.columns), x1 = Math.floor((column + 1) * source.width / spec.columns);
      const y0 = Math.floor(row * source.height / spec.rows), y1 = Math.floor((row + 1) * source.height / spec.rows);
      const ox = (x0 + (x1 - x0) * .5 - frame.cutX) / image.width;
      const oy = (y0 + (y1 - y0) * .55 - frame.cutY) / image.height;
      image.setOrigin(pose.flipX ? 1 - ox : ox, oy);
    }
    return image;
  }

  private drawSliceHazard(h: HazardView): boolean {
    const p = point(h.x, h.y), alpha = h.phase === 'gone' ? 1 - h.t : 1;
    const id = `hazard:${h.id}`;
    if (h.kind === 'banana') {
      const image = this.sprite(id, 'hazardBanana', h.twist ? 1 : 0);
      if (!image) return false;
      image.setPosition(p.x, p.y).setDisplaySize(42, 24).setAlpha(alpha).setDepth(floorDepth + .8);
      if (h.phase === 'warn') this.ground.lineStyle(2, 0xc97a49, .3 + h.t * .4).strokeEllipse(p.x, p.y, 56, 28);
      return true;
    }
    if (h.kind === 'durian') {
      const image = this.sprite(id, 'hazardDurian', h.phase === 'warn' ? 0 : 1);
      if (!image) return false;
      if (h.phase === 'warn') {
        this.landing(p, h.t);
        image.setPosition(p.x, p.y - 20 - (1 - h.t) ** 2 * 420).setScale(44 / image.width).setRotation(h.t * .6).setDepth(1e6 - 5);
      } else image.setPosition(p.x, p.y - 8).setScale(66 / image.width).setDepth(floorDepth + .8);
      image.setAlpha(alpha);
      return true;
    }
    if (h.kind === 'water') {
      const image = this.sprite(id, 'hazardWater', h.phase === 'warn' ? 0 : h.phase === 'active' ? 2 : 3);
      if (!image) return false;
      if (h.phase === 'warn') {
        this.landing(p, h.t);
        image.setPosition(p.x, p.y - 190 + h.t * 20).setDisplaySize(44, 28).setRotation(h.t * .6).setDepth(1e6 - 5);
        const pour = Math.max(0, (h.t - .72) / .28);
        if (pour > 0) {
          const stream = this.sprite(`${id}:stream`, 'hazardWater', 1);
          const top = p.y - 177 + h.t * 20;
          stream?.setOrigin(.5, 0).setPosition(p.x + 16, top).setDisplaySize(18, (p.y - top) * pour).setDepth(1e6 - 5).setAlpha(alpha);
        }
      } else {
        image.setPosition(p.x, p.y + (h.phase === 'active' ? 8 : 0)).setOrigin(.5, h.phase === 'active' ? 1 : .5)
          .setDisplaySize(110, h.phase === 'active' ? 65 : 40).setDepth(h.phase === 'active' ? h.x + h.y + .05 : floorDepth + .8);
      }
      image.setAlpha(alpha);
      return true;
    }
    if (h.kind === 'shuttlecock') {
      const key = SLICE_ASSETS.hazardShuttlecock.key;
      if (!this.scene.textures.exists(key) || !this.scene.textures.get(key).has('0')) return false;
      if (h.phase === 'warn') {
        this.lane(h, 18, .1 + h.t * .2);
        this.alert(p.x, p.y - 50, h.t);
        return true;
      }
      const image = this.sprite(id, 'hazardShuttlecock', Math.floor(h.t * 24) % 4);
      if (!image) return false;
      const next = point(h.x + h.dx, h.y + h.dy);
      image.setPosition(p.x, p.y - 46).setScale(36 / image.width).setFlipX(next.x < p.x).setAlpha(alpha).setDepth(1e6 - 5);
      return true;
    }
    if (h.kind === 'sinkhole') {
      const frame = h.twist ? h.phase === 'warn' ? 2 : 3 : h.phase === 'warn' ? 0 : 1;
      const image = this.sprite(id, 'hazardHoles', frame);
      if (!image) return false;
      const size = h.twist ? 120 : 190;
      const growth = h.phase === 'warn' && !h.twist ? .25 + h.t * .55 : 1;
      const flip = h.phase === 'warn' && h.twist ? .3 + Math.abs(Math.sin(h.t * Math.PI * 6)) * .7 : 1;
      image.setPosition(p.x, p.y).setDisplaySize(size * growth, size * growth * (frame === 3 ? .72 : .5) * flip)
        .setOrigin(.5, frame === 3 ? .7 : .5).setDepth(floorDepth + .8).setAlpha(alpha);
      if (h.phase === 'warn') this.ground.lineStyle(2, 0xd98153, .45 + h.t * .4).strokeEllipse(p.x, p.y, size, size / 2);
      return true;
    }
    if (h.kind === 'laundry') {
      const image = this.sprite(id, 'hazardLaundry', h.phase === 'warn' ? Math.floor(h.t * 12) % 3 : 0);
      if (!image) return false;
      if (h.phase === 'warn') {
        this.landing(p, h.t);
        image.setPosition(p.x + Math.sin(h.t * Math.PI * 6) * 18, p.y - 30 - (1 - h.t) ** 2 * 320)
          .setDisplaySize(42, 30).setRotation(Math.sin(h.t * Math.PI * 6) * .15).setDepth(1e6 - 5);
      } else image.setPosition(p.x, p.y - 6).setDisplaySize(42, 24).setDepth(h.x + h.y + .05);
      image.setAlpha(alpha);
      return true;
    }
    if (h.kind === 'slipper') {
      if (!this.atlasReady('hazardSlipper')) return false;
      if (h.phase === 'warn') {
        this.alert(p.x, p.y - 60, h.t);
        return true;
      }
      const image = this.sprite(id, 'hazardSlipper', Math.floor(h.t * 32) % 4)!;
      const next = point(h.x + h.dx, h.y + h.dy);
      image.setPosition(p.x, p.y - 40).setScale(34 / image.width).setFlipX(next.x < p.x).setAlpha(alpha).setDepth(1e6 - 5);
      return true;
    }
    if (h.kind === 'motorbike') {
      if (h.phase === 'warn') {
        this.lane(h, 56, .1 + (Math.sin(h.t * Math.PI * 12) * .5 + .5) * .18);
        const side = h.dx ? point(h.dx > 0 ? .6 : MAP_W - .6, h.y) : point(h.x, h.dy > 0 ? .6 : MAP_H - .6);
        this.alert(side.x, side.y - 40, h.t);
        return true;
      }
      if (!this.atlasReady('motorbikes') || !this.atlasReady('hazardCargoBike')) return false;
      const direction = h.dx ? h.dx > 0 ? 'E' : 'W' : h.dy > 0 ? 'S' : 'N';
      const cargoTexture = this.scene.textures.get(SLICE_ASSETS.hazardCargoBike.key);
      const bikeHeight = this.atlasHeight('motorbikes'), cargoHeight = this.atlasHeight('hazardCargoBike');
      for (let i = 0; i < 3; i++) {
        const wob = i % 2 ? .18 : -.12;
        const x = h.x - i * 1.3 * h.dx + (h.dx ? 0 : wob), y = h.y - i * 1.3 * h.dy + (h.dx ? wob : 0);
        if (h.dx && (x < STREET_ENDS.w || x > STREET_ENDS.e)) continue;
        const q = point(x, y), cargo = i === 2;
        const image = this.sprite(`${id}:bike:${i}`, cargo ? 'hazardCargoBike' : 'motorbikes', Number(cargo ? sliceCargoBikeFrame(direction, !!h.cargoOpen) : sliceMotorbikeFrame(direction, i)))!;
        image.setPosition(q.x, q.y).setOrigin(.5, .88).setScale(cargo ? 100 / cargoHeight : 84 / bikeHeight).setAlpha(alpha).setDepth(x + y + .05);
        if (cargo && h.cargoOpen) {
          // An opened lid/feather can enlarge the crop without moving the bike itself.
          const closed = cargoTexture.get(sliceCargoBikeFrame(direction, false));
          const cellWidth = Math.floor((cargoTexture.getSourceImage() as HTMLImageElement).width / 2);
          image.setOrigin((closed.cutX + closed.width * .5 + cellWidth - image.frame.cutX) / image.width,
            (closed.cutY + closed.height * .88 - image.frame.cutY) / image.height);
        }
        this.ground.fillStyle(INK, .14 * alpha).fillEllipse(q.x, q.y + 2, cargo ? 64 : 54, 16);
      }
      return true;
    }
    if (h.kind === 'cat') {
      if (!this.atlasReady('hazardCat')) return false;
      const impact = this.hit?.kind === 'cat' && h.phase !== 'gone';
      const moving = h.phase === 'active' && h.moving !== false;
      const phase = impact ? 3 : moving ? 1 + Math.floor(h.t * 48) % 2 : 0;
      const lift = impact ? -18 - Math.abs(Math.sin(this.hit!.t * Math.PI * 4)) * 8 : moving ? -Math.abs(Math.sin(h.t * Math.PI * 24)) * 3 : 0;
      const image = this.animalSprite(id, 'hazardCat', facingFrom(h.dx, h.dy) ?? 'E', phase, 42)!;
      image.setPosition(p.x, p.y + lift).setAlpha(alpha).setDepth(h.x + h.y + .05);
      this.ground.fillStyle(INK, .14 * alpha).fillEllipse(p.x, p.y, 32, 11);
      if (h.phase === 'warn') this.alert(p.x, p.y - 54, h.t);
      return true;
    }
    if (h.kind === 'dog') {
      if (!this.atlasReady('hazardDogs')) return false;
      // A cancelled warning must not suddenly grow into a mastiff during its fade.
      const large = h.phase === 'active' || (h.phase === 'gone' && this.sprites.get(id)?.getData('largeDog') === true);
      const impact = this.hit?.kind === 'dog' && h.phase !== 'gone';
      const moving = h.phase === 'active' && h.moving !== false;
      const phase = impact || !large && h.phase === 'warn' ? 3 : moving ? 1 + Math.floor(h.t * 48) % 2 : 0;
      const image = this.animalSprite(id, 'hazardDogs', facingFrom(h.dx, h.dy) ?? 'E', phase, large ? 66 : 32, large ? 2 : 0)!;
      image.setPosition(p.x, p.y).setAlpha(alpha).setDepth(h.x + h.y + .05).setData('largeDog', large);
      this.ground.fillStyle(INK, .14 * alpha).fillEllipse(p.x, p.y, large ? 62 : 26, large ? 20 : 9);
      return true;
    }
    if (h.kind === 'chickens') {
      if (!this.atlasReady('hazardChickens')) return false;
      const impact = this.hit?.kind === 'chickens' && h.phase !== 'gone';
      const moving = h.phase === 'active' && h.moving !== false;
      for (const [ox, oy, k] of [[0, 0, 0], [-.35, .3, 1], [.3, .35, 2]] as const) {
        const q = point(h.x + ox, h.y + oy);
        const phase = impact ? 3 : moving ? 1 + Math.floor(h.t * 48 + k) % 2 : 0;
        const hop = impact ? Math.abs(Math.sin(this.hit!.t * Math.PI * 8 + k)) * 8 : moving ? Math.abs(Math.sin(h.t * Math.PI * 36 + k)) * 4 : 0;
        const image = this.animalSprite(`${id}:chicken:${k}`, 'hazardChickens', facingFrom(h.dx, h.dy) ?? 'E', phase, 34)!;
        image.setPosition(q.x, q.y - hop).setAlpha(alpha).setDepth(h.x + ox + h.y + oy + .05);
        this.ground.fillStyle(INK, .13 * alpha).fillEllipse(q.x, q.y, 24, 8);
      }
      if (h.phase === 'warn') this.alert(p.x, p.y - 44, h.t);
      return true;
    }
    if (h.kind === 'pigeons') {
      if (!this.atlasReady('hazardPigeons')) return false;
      if (h.phase === 'warn') {
        const { a, b } = this.lane(h, 26, .12 + h.t * .2);
        for (let i = 0; i < 12; i++) {
          const u = (i / 12 + h.t * 2) % 1;
          this.ground.fillStyle(0xffffff, .8).fillCircle(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 3);
        }
        return true;
      }
      const offsets = [[0, 0], [-.4, -.3], [.3, -.45], [-.2, .35], [.45, .2]] as const;
      offsets.forEach(([ox, oy], i) => {
        const q = point(h.x + ox, h.y + oy);
        const phase = 1 + Math.floor(h.t * 60 + i) % 3;
        const image = this.animalSprite(`${id}:bird:${i}`, 'hazardPigeons', facingFrom(h.dx, h.dy) ?? 'E', phase, 42)!;
        image.setPosition(q.x, q.y - 58).setAlpha(alpha).setDepth(1e6 - 5);
        this.ground.fillStyle(INK, .08 * alpha).fillEllipse(q.x, q.y, 22, 8);
      });
      return true;
    }
    return false;
  }

  /** Each gag with words says them in a bubble that follows it (the twist's in a darker red). */
  private syncBubbles(run: RunView | null): void {
    const want = new Set<number>();
    const z = this.scene.cameras.main.zoom;
    for (const h of run?.hazards ?? []) {
      if (!h.label || h.phase === 'gone' || run?.hit) continue;
      want.add(h.id);
      let b = this.bubbles.get(h.id);
      if (!b) {
        b = new SpeechBubble(this.scene, 19).setDepth(1e6 - 3);
        this.bubbles.set(h.id, b);
      }
      b.set(h.label, h.twist || (h.kind === 'dog' && h.phase === 'active') ? 'twist' : 'alert');
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
    if (this.drawSliceHazard(h)) return;
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
          const bx = h.x - i * 1.3 * h.dx;
          if (h.dx && (bx < STREET_ENDS.w || bx > STREET_ENDS.e)) return;
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
      case 'banana': {
        const image = this.sprite('impact:banana', 'hazardBanana', 1);
        image?.setPosition(p.x - t * 18, p.y + 4).setDisplaySize(42, 24).setAlpha(1 - t * .8).setDepth(floorDepth + .8);
        if (t > .6) this.stars(p.x, p.y - 80 - (1 - t) * 100);
        return;
      }
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
        } else if (!this.atlasReady('hazardDogs')) {
          const open = Math.abs(Math.sin(now / 90)) * 12;
          for (const s of [-1, 1]) {
            const y = p.y - 16 + s * (6 + open);
            g.fillStyle(0xffffff).lineStyle(2.5, INK);
            for (let i = 0; i < 4; i++) { const x = p.x - 18 + i * 12; g.fillTriangle(x, y, x + 10, y, x + 5, y - s * 10).strokeTriangle(x, y, x + 10, y, x + 5, y - s * 10); }
          }
        }
        return;
      }
      case 'durian': {
        const image = this.sprite('impact:durian', 'hazardDurian', 0);
        if (image) image.setPosition(p.x, p.y - 70 - Math.sin(t * Math.PI) * 12).setScale(44 / image.width).setRotation(t * .8).setDepth(1e6 - 3);
        else drawDurian(g, p.x, p.y - 70, 16);
        this.stars(p.x, p.y - 100);
        return;
      }
      case 'water': {
        const image = this.sprite('impact:water', 'hazardWater', 2);
        image?.setPosition(p.x, p.y - 34).setOrigin(.5, .7).setDisplaySize(88, 60).setAlpha(1 - t * .65).setDepth(1e6 - 3);
        for (let i = 0; i < 10; i++) dot(g, p.x - 36 + (i * 8) % 72, p.y - 90 + ((now / 4 + i * 37) % 80), 4, 0x8fd0ea);
        return;
      }
      case 'shuttlecock': {
        const image = this.sprite('impact:shuttlecock', 'hazardShuttlecock', Math.floor(t * 12) % 4);
        if (image) image.setPosition(p.x + t * 60, p.y - 70 - Math.sin(t * Math.PI) * 60).setScale(36 / image.width).setRotation(t * .25).setDepth(1e6 - 3);
        else shuttlecock(g, p.x + t * 60, p.y - 70 - Math.sin(t * Math.PI) * 60, 1);
        if (t > .3) this.stars(p.x, p.y - 80);
        return;
      }
      case 'slipper': {
        const image = this.sprite('impact:slipper', 'hazardSlipper', Math.floor(t * 16) % 4);
        if (image) image.setPosition(p.x - 10 - t * 50, p.y - 60 + t * 50).setScale(34 / image.width).setRotation(t * Math.PI * 2).setDepth(1e6 - 3);
        else g.fillStyle(0xffd25e).fillEllipse(p.x - 10 - t * 50, p.y - 60 + t * 50, 30, 14).lineStyle(2.5, INK).strokeEllipse(p.x - 10 - t * 50, p.y - 60 + t * 50, 30, 14);
        if (t > .3) this.stars(p.x, p.y - 80);
        return;
      }
      case 'sinkhole':
        for (let i = 0; i < 6; i++) { const a = i * 1.1 + t * 3; dot(g, p.x + Math.cos(a) * (40 + t * 50), p.y - 10 - t * 40 - (i % 2) * 10, 6 + (1 - t) * 6, 0xd8c3a5); }
        return;
      case 'pigeons': {
        const ready = this.atlasReady('hazardPigeons');
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + t * Math.PI * 8;
          const x = p.x + Math.cos(a) * 34, y = p.y - 78 - Math.sin(t * Math.PI) * 260 + Math.sin(a) * 12;
          if (ready) {
            const image = this.animalSprite(`impact:pigeon:${i}`, 'hazardPigeons', Math.cos(a) > 0 ? 'E' : 'S', 1 + Math.floor(t * 60 + i) % 3, 42)!;
            image.setPosition(x, y).setDepth(1e6 - 3);
          } else pigeon(g, x, y + 18, Math.cos(a) > 0 ? 1 : -1, Math.sin(now / 40 + i) * 8);
        }
        return;
      }
      default:
        if (t > .6) this.stars(p.x, p.y - 80 - (1 - t) * 100);
    }
  }

  /** Knocked out: stars over the head of the hero lying on the street. */
  private drawDown(d: NonNullable<RunView['down']>): void {
    const p = point(d.x, d.y);
    if (d.t > .1) this.stars(p.x - 44, p.y - 24);
  }

  /** A harmless gag on the hero: flowered shorts over the head, or the durian smell around it. */
  private drawDaze(kind: 'smell' | 'shorts', hero: WorldPos): void {
    const p = point(hero.x, hero.y), now = this.scene.time.now;
    if (kind === 'shorts') {
      const image = this.sprite('daze:shorts', 'hazardLaundry', 3);
      if (image) image.setPosition(p.x, p.y - 58).setDisplaySize(42, 30).setDepth(1e6 - 3);
      else shorts(this.fx, p.x, p.y - 58);
    }
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
    for (const g of this.bodies.values()) g.destroy();
    this.bodies.clear();
    for (const b of this.bubbles.values()) b.destroy();
    this.bubbles.clear();
    for (const image of this.sprites.values()) image.destroy();
    this.sprites.clear();
    this.usedSprites.clear();
    this.atlasHeights.clear();
    this.hit = null;
  }
}

type Pose = { sx: number; sy: number; dy: number; angle: number; alpha: number };
const STAND: Pose = { sx: 1, sy: 1, dy: 0, angle: 0, alpha: 1 };
/** Lying flat on the street (the figure turns about its feet). */
const LYING = -Math.PI / 2;

/** How the hero's figure moves in the run: the gag that got them, then lying knocked out. */
export function runPose(run: RunView | null): Pose {
  if (!run) return STAND;
  if (run.hit) return hitPose(run.hit);
  // Down: drops flat with a little bounce, then lies still.
  if (run.down) { const k = Math.min(1, run.down.t / .12); return { sx: 1, sy: 1, dy: -Math.sin(k * Math.PI) * 10, angle: LYING * k, alpha: 1 }; }
  return STAND;
}

/** The gag that got the hero: sinks, flies off, spins or gets squashed (and comes back into view to lie down). */
function hitPose(d: NonNullable<RunView['hit']>): Pose {
  const t = d.t, e = 1 - (1 - t) * (1 - t);
  switch (d.kind) {
    // Loses footing and pitches into the hole: a stumble, never shrinking or fading (the fall to the ground is the `down` pose).
    case 'sinkhole': return { sx: 1, sy: 1, dy: Math.sin(t * Math.PI) * 12, angle: Math.sin(t * Math.PI * 3) * .4 * (1 - t * .4), alpha: 1 };
    case 'motorbike': return { sx: 1, sy: 1, dy: -Math.sin(t * Math.PI) * 220, angle: t * Math.PI * 4, alpha: 1 };
    case 'pigeons': return { sx: 1, sy: 1, dy: -Math.sin(t * Math.PI) * 260, angle: Math.sin(t * 20) * .3, alpha: 1 };
    case 'banana': return { sx: 1, sy: 1, dy: -Math.sin(t * Math.PI) * 140, angle: e * Math.PI * 3, alpha: 1 };
    // Knocked silly: a bonk and a wobble, same size throughout.
    case 'durian':
    case 'water': return { sx: 1, sy: 1, dy: Math.sin(t * Math.PI) * 6, angle: Math.sin(t * 18) * .2 * (1 - t), alpha: 1 };
    default: return { sx: 1, sy: 1, dy: 0, angle: Math.sin(t * 40) * .15 * (1 - t), alpha: 1 };
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
