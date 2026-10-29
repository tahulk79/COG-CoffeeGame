import Phaser from 'phaser';
import { worldToScreen } from '../../utils/iso';
import { SLICE_ASSETS } from './sliceAssets';

/** Bake small, reusable clipped strips; no per-frame masks or large map-sized textures. */
export function asphaltSurface(scene: Phaser.Scene, x0: number, x1: number, y0: number, y1: number, depth: number): Phaser.GameObjects.Image[] | null {
  if (!scene.textures.exists(SLICE_ASSETS.asphalt.key)) return null;
  const materialKey = 'hn:asphalt-material:iso-v1';
  if (!scene.textures.exists(materialKey)) {
    const texture = scene.textures.createCanvas(materialKey, 512, 256);
    if (!texture) return null;
    const ctx = texture.context, source = scene.textures.get(SLICE_ASSETS.asphalt.key).getSourceImage() as HTMLCanvasElement;
    ctx.setTransform(64, 32, -64, 32, 0, 0);
    for (let x = -2; x <= 3; x++) for (let y = -2; y <= 3; y++) ctx.drawImage(source, x * 4, y * 4, 4, 4);
    texture.refresh();
  }
  const source = scene.textures.get(materialKey).getSourceImage() as HTMLCanvasElement;
  const images: Phaser.GameObjects.Image[] = [];
  const phase = (value: number, period: number) => ((value % period) + period) % period;
  for (let start = x0; start < x1; start += 8) {
    const end = Math.min(start + 8, x1);
    const points = [[start, y0], [end, y0], [end, y1], [start, y1]].map(([x, y]) => worldToScreen({ x: x!, y: y! }));
    const left = Math.floor(Math.min(...points.map(p => p.x))), top = Math.floor(Math.min(...points.map(p => p.y)));
    const width = Math.ceil(Math.max(...points.map(p => p.x)) - left), height = Math.ceil(Math.max(...points.map(p => p.y)) - top);
    const key = `hn:asphalt-strip:v2:${phase(left, 512)}:${phase(top, 256)}:${(end - start).toFixed(3)}:${y0}:${y1}`;
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, Math.ceil(width / 2), Math.ceil(height / 2));
      if (!texture) continue;
      const ctx = texture.context;
      ctx.scale(.5, .5);
      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p.x - left, p.y - top) : ctx.moveTo(p.x - left, p.y - top));
      ctx.closePath(); ctx.clip();
      const pattern = ctx.createPattern(source, 'repeat');
      if (pattern) {
        ctx.translate(-left, -top);
        ctx.fillStyle = pattern;
        ctx.fillRect(left, top, width, height);
      }
      texture.refresh();
    }
    images.push(scene.add.image(left, top, key).setOrigin(0).setDisplaySize(Math.ceil(width / 2) * 2, Math.ceil(height / 2) * 2).setDepth(depth));
  }
  return images;
}
