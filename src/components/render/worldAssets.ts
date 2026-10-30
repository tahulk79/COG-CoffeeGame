import type Phaser from 'phaser';
import { ART_READY, H5_ASSETS } from './h5Assets';
import { CHAPTER2_SLICE_ASSETS, SLICE_ASSETS } from './sliceAssets';
import { STORY_ASSETS } from './storyAssets';

/**
 * Queues every image the world needs that is not in the texture cache yet; returns how many were queued.
 * The loading screen starts these at page load (alongside the font), so the world's own preload finds them ready.
 */
export function queueWorldAssets(load: Phaser.Loader.LoaderPlugin, textures: Phaser.Textures.TextureManager, mapId?: string): number {
  let queued = 0;
  for (const a of [...Object.values(H5_ASSETS), ...Object.values(STORY_ASSETS)]) if (ART_READY.has(a.key) && !textures.exists(a.key)) { load.image(a.key, a.url); queued++; }
  const slice = [...Object.values(SLICE_ASSETS), ...(mapId === 'afterlife' ? Object.values(CHAPTER2_SLICE_ASSETS) : [])];
  for (const a of slice) if (!textures.exists(a.key)) { load.image(a.key, a.url); queued++; }
  return queued;
}
