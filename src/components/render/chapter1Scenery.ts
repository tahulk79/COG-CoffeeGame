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

/** A low garden boundary explains the existing y=17 navigation edge; the city continues behind it. */
export function drawStreetBoundary(scene: Phaser.Scene): void {
  const key = 'hn:promenade-boundary:v1';
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    // A 4-tile section aligned to the same (2,1) ground axis as the street.
    const p = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
    g.fillStyle(0x9d997f).fillPoints([p(8, 32), p(264, 160), p(264, 171), p(8, 43)], true);
    g.fillStyle(0xe0d3b7).fillPoints([p(8, 25), p(264, 153), p(264, 160), p(8, 32)], true);
    for (let x = 8; x <= 264; x += 32) {
      const y = 32 + (x - 8) / 2;
      g.lineStyle(2, 0x637963).lineBetween(x, y, x, y - 17);
    }
    for (const z of [9, 17]) g.lineStyle(2, 0x637963).lineBetween(8, 32 - z, 264, 160 - z);
    g.generateTexture(key, 274, 180);
    g.destroy();
  }
  for (let x = -18; x < 69; x += 4) {
    const at = worldToScreen({ x, y: 17 });
    scene.add.image(at.x - 8, at.y - 32, key).setOrigin(0).setDepth(x + 19.1);
  }
}
