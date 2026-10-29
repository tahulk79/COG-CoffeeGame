import type Phaser from 'phaser';

/**
 * Presentation asset registry. Gameplay code only knows logical keys (`coin`,
 * `star`, `cup`…). There is no icon art right now: `createIcon` returns an
 * empty container until a texture named `ui/<key>` (see `textureKey`) is loaded.
 */

/** Texture a production build provides for a logical key. */
export const textureKey = (key: string): string => `ui/${key}`;

/** The visual for a logical key, centred on its origin: the `ui/<key>` texture if loaded, otherwise empty. */
export function createIcon(scene: Phaser.Scene, key: string, size = 24): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  if (scene.textures.exists(textureKey(key))) c.add(scene.add.image(0, 0, textureKey(key)).setDisplaySize(size, size));
  return c;
}
