import type Phaser from 'phaser';
import { STREET_HD_TILES } from '../../data/streetSceneLayout';
import { floorDepth } from '../../utils/iso';

export const featherKey = (key: string): string => `${key}:feather`;

type Tile = (typeof STREET_HD_TILES)[number];

/** The tile's overlap faded into its neighbours (the centre keeps the new image's full detail), on a canvas texture. */
function feather(scene: Phaser.Scene, tile: Tile, source: ImageBitmap): string | null {
  const key = featherKey(tile.key);
  const texture = scene.textures.createCanvas(key, source.width, source.height);
  if (!texture) return null;
  const ctx = texture.context;
  ctx.drawImage(source, 0, 0);
  // Erase only the four edge strips (full alpha at the edge, none inside): the centre is never touched, so this stays cheap per tile.
  ctx.globalCompositeOperation = 'destination-out';
  const fw = source.width * 48 / 649, fh = source.height * 48 / 412, w = source.width, h = source.height;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, fw, 0, 0, 0, fw, h], [w, 0, w - fw, 0, w - fw, 0, fw, h], [0, 0, 0, fh, 0, 0, w, fh], [0, h, 0, h - fh, 0, h - fh, w, fh]] as const) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, '#fff'); gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.globalCompositeOperation = 'source-over';
  texture.refresh();
  return key;
}

/**
 * Overlapping detail tiles retain the registered world layout without a giant GPU texture.
 * They are ~18 MB in all, so they stream in after the street is playable, one at a time: each fades in over the base painting.
 * Decoding happens off the main thread (`createImageBitmap`) and straight into the canvas texture, so a tile costs one GPU upload;
 * going through the loader decoded all seven on the main thread in one frame and froze the game for over a second.
 */
export function drawStreetDetails(scene: Phaser.Scene): void {
  const place = (tile: Tile, key: string, fade: boolean) => {
    const image = scene.add.image(tile.x, tile.y, key).setOrigin(0).setDisplaySize(tile.width, tile.height).setDepth(floorDepth - .95);
    if (fade) scene.tweens.add({ targets: image.setAlpha(0), alpha: 1, duration: 500 });
  };
  const todo: Tile[] = [];
  for (const tile of STREET_HD_TILES) {
    if (scene.textures.exists(featherKey(tile.key))) place(tile, featherKey(tile.key), false);
    else todo.push(tile);
  }
  const next = async (): Promise<void> => {
    const tile = todo.shift();
    if (!tile || !scene.sys.isActive()) return;
    try {
      if (scene.textures.exists(featherKey(tile.key))) { place(tile, featherKey(tile.key), false); return void scene.time.delayedCall(0, () => void next()); }
      const source = await createImageBitmap(await (await fetch(tile.url)).blob());
      const key = scene.sys.isActive() ? feather(scene, tile, source) : null;
      source.close();
      if (key) place(tile, key, true);
    } catch { /* a tile that fails to load leaves the base painting there */ }
    scene.time.delayedCall(250, () => void next());
  };
  scene.time.delayedCall(1500, () => void next());
}
