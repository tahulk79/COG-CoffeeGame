import Phaser from 'phaser';
import { floorDepth, worldToScreen } from '../../utils/iso';
import { roadDashes, STREET_PAVING, streetPaver, streetKerb, streetAsphalt } from './streetPaving';
import { asphaltSurface } from './streetMaterial';

export const CITY_BACK_STREET = { near: 20.5, far: 23.5, shops: 24.7 } as const;

/** Quiet ground continues on the same isometric plane. Architecture is never mirrored or tiled as wallpaper. */
export function drawChapter1Backdrop(scene: Phaser.Scene): void {
  const key = 'hn:continuous-paving:reference-v2';
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(STREET_PAVING.stone).fillRect(0, 0, 512, 256);
    // Periods are (4,-4) and (4,4) in world space, so the paving joins the map's tile grid exactly.
    for (let y = -8; y < 12; y++) for (let x = -8; x < 12; x++) streetPaver(g, x, y);
    g.generateTexture(key, 512, 256);
    g.destroy();
  }
  const ground = scene.add.tileSprite(0, 0, 512, 256, key).setOrigin(0).setDepth(floorDepth - 4);
  const topLeft = new Phaser.Math.Vector2(), bottomRight = new Phaser.Math.Vector2();
  const place = () => {
    const camera = scene.cameras.main;
    camera.getWorldPoint(-32, -32, topLeft);
    camera.getWorldPoint(camera.width + 32, camera.height + 32, bottomRight);
    const x = Math.floor(topLeft.x), y = Math.floor(topLeft.y);
    ground.setPosition(x, y).setSize(Math.ceil(bottomRight.x - x), Math.ceil(bottomRight.y - y)).setTilePosition(x, y);
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, place);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.PRE_RENDER, place));
  // One neighborhood street separates the two south-side blocks, on the same plane as the playable street.
  const road = scene.add.graphics().setDepth(floorDepth - 2.8);
  if (!asphaltSurface(scene, -32, 88, CITY_BACK_STREET.near, CITY_BACK_STREET.far, floorDepth - 2.9)) streetAsphalt(road, -32, 88, CITY_BACK_STREET.near, CITY_BACK_STREET.far, 6);
  roadDashes(road, -32, 88, (CITY_BACK_STREET.near + CITY_BACK_STREET.far) / 2);
  streetKerb(road, -32, 88, CITY_BACK_STREET.near, 1);
  streetKerb(road, -32, 88, CITY_BACK_STREET.far, -1);
}
