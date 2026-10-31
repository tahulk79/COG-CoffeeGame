import { STREET_HD_TILES, STREET_SCENE } from '../../data/streetSceneLayout';
import { featherKey } from './streetBackground';
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
  // The street's sprite sheets and painting are chapter 1 only (~90 MiB of video memory): other maps drop them instead of carrying them along.
  const street = !mapId || mapId === 'incident';
  if (!street) releaseStreetTextures(textures);
  if (street && !textures.exists(STREET_SCENE.key)) { load.image(STREET_SCENE.key, STREET_SCENE.url); queued++; }
  for (const a of [...Object.values(H5_ASSETS), ...Object.values(STORY_ASSETS)]) if (ART_READY.has(a.key) && !textures.exists(a.key)) { load.image(a.key, a.url); queued++; }
  const sharedUi = ['speakerNameplate', 'cloudOrnament', 'questPanel', 'karmaPanel', 'actionButton', 'settingsIcon', 'heroAvatar', 'ui'] as const;
  const slice = [...Object.entries(SLICE_ASSETS).filter(([name]) => street || SHARED_SLICE.has(name)).map(([, a]) => a), ...(mapId === 'afterlife' ? Object.values(CHAPTER2_SLICE_ASSETS) : sharedUi.map(key => CHAPTER2_SLICE_ASSETS[key]))];
  for (const a of slice) if (!textures.exists(a.key)) { load.image(a.key, a.url); queued++; }
  return queued;
}

/** Chapter 1 sheets the hero needs wherever it walks. */
const SHARED_SLICE = new Set<string>(['hero', 'heroReactions']);

function releaseStreetTextures(textures: Phaser.Textures.TextureManager): void {
  const keys = [STREET_SCENE.key, ...STREET_HD_TILES.flatMap(t => [t.key, featherKey(t.key)]),
    ...Object.entries(SLICE_ASSETS).filter(([name]) => !SHARED_SLICE.has(name)).map(([, a]) => a.key)];
  for (const key of keys) if (textures.exists(key)) textures.remove(key);
}
