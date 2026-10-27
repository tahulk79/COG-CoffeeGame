import type Phaser from 'phaser';

/**
 * Draws once into a texture and reuses it. Phaser re-processes a Graphics
 * object's whole command buffer every frame; measured on the café screen, 33 HUD
 * Graphics cost ~13 ms of a 16 ms frame. Baked textures cost one cheap quad each.
 * Textures live in the game-wide texture manager, so they survive scene restarts.
 */
export function bakeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void, originX = 0, originY = 0): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  if (originX || originY) g.translateCanvas(originX, originY);
  draw(g);
  g.generateTexture(key, Math.ceil(w), Math.ceil(h));
  g.destroy();
  return key;
}
