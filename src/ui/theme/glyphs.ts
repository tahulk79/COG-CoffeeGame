import Phaser from 'phaser';

/**
 * Small vector icons drawn with Graphics, centred on (0, 0): crisp at any size and in the game's own colours,
 * so a button needs no image. (Replace with generated art later by changing only this file.)
 */

/** A gear: eight teeth round a ring with a hole (`hole` is the colour behind the icon). */
export function drawGear(g: Phaser.GameObjects.Graphics, color: number, hole: number, radius = 11): void {
  const R = radius, root = R * 0.78;
  const polar = (r: number, a: number) => new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    pts.push(polar(root, a - 0.33), polar(R, a - 0.19), polar(R, a + 0.19), polar(root, a + 0.33));
  }
  g.fillStyle(color, 1).fillPoints(pts, true);
  g.fillStyle(hole, 1).fillCircle(0, 0, R * 0.38);
}
