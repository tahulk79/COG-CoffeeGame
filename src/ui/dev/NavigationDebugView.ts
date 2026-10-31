import Phaser from 'phaser';
import type { GameSimulation, SimulationSnapshot } from '../../gameplay/GameSimulation';
import { RUN_BODY_RADIUS } from '../../gameplay/story/RunService';
import { CROSSWALK } from '../../gameplay/story/StreetService';
import { STREET_CAMERA_AREA, STREET_SCENE } from '../../data/streetSceneLayout';
import { screenToWorld, worldToScreen } from '../../utils/iso';
import { worldToTile, type WorldPos } from '../../utils/tile';
import { PIXEL_RATIO } from '../layout/pixelRatio';

const project = (p: WorldPos): Phaser.Math.Vector2 => { const s = worldToScreen(p); return new Phaser.Math.Vector2(s.x, s.y); };

/** F2 / ?debugMap=1: draw the live algorithm's geometry, without changing navigation or intercepting input. */
export class NavigationDebugView {
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly live: Phaser.GameObjects.Graphics;
  private readonly legend: Phaser.GameObjects.Text;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private enabled = new URLSearchParams(window.location.search).has('debugMap');
  private readonly toggle = () => { this.enabled = !this.enabled; };

  constructor(private readonly scene: Phaser.Scene, private readonly sim: GameSimulation) {
    this.grid = scene.add.graphics().setDepth(1e6 + 20);
    this.live = scene.add.graphics().setDepth(1e6 + 21);
    this.legend = scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', backgroundColor: '#101922e8', padding: { x: 8, y: 6 } }).setDepth(1e6 + 22).setOrigin(0, 1);
    const grid = sim.world.grid;
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
      const points = [{ x, y }, { x: x + 1, y }, { x: x + 1, y: y + 1 }, { x, y: y + 1 }].map(project);
      const open = grid.isWalkable({ x, y });
      this.grid.fillStyle(open ? 0x42e6a4 : 0xff4b67, open ? .07 : .35).fillPoints(points, true);
      this.grid.lineStyle(2, open ? 0x42ffb0 : 0xff4b67, .85).strokePoints(points, true);
      // Tile numbers every 4 tiles: read a coordinate straight off the screen to place a collider or the zebra.
      if (x % 4 === 0 && y % 4 === 0) {
        const c = project({ x: x + .5, y: y + .5 });
        this.labels.push(scene.add.text(c.x, c.y, `${x},${y}`, { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(.5).setDepth(1e6 + 20));
      }
    }
    for (const o of sim.collisionProps) this.ring(this.grid, o, o.r, 0xffbd45);
    // What is hand-tuned to the painted art: its box, the camera's safe area, and the zebra crossing.
    const outline = (corners: WorldPos[], color: number) => this.grid.lineStyle(3, color, 1).strokePoints(corners.map(project), true);
    this.grid.lineStyle(3, 0xffffff, .8).strokeRect(STREET_SCENE.x, STREET_SCENE.y, STREET_SCENE.width, STREET_SCENE.height);
    const a = STREET_CAMERA_AREA;
    outline([{ x: a.left, y: a.top }, { x: a.right, y: a.top }, { x: a.right, y: a.bottom }, { x: a.left, y: a.bottom }], 0xff3df2);
    const lanes = sim.content.story.chapters.S03?.street?.bikeLanes;
    if (lanes) {
      const top = lanes[0]! - 1.5, bottom = lanes[lanes.length - 1]! + 1.5;
      outline([{ x: CROSSWALK.x - CROSSWALK.half, y: top }, { x: CROSSWALK.x + CROSSWALK.half, y: top }, { x: CROSSWALK.x + CROSSWALK.half, y: bottom }, { x: CROSSWALK.x - CROSSWALK.half, y: bottom }], 0x3dffea);
    }
    scene.input.keyboard?.on('keydown-F2', this.toggle);
  }

  private ring(g: Phaser.GameObjects.Graphics, p: WorldPos, r: number, color: number): void {
    const points = Array.from({ length: 25 }, (_, i) => project({ x: p.x + Math.cos(i * Math.PI / 12) * r, y: p.y + Math.sin(i * Math.PI / 12) * r }));
    g.lineStyle(2, color, 1).strokePoints(points, true);
  }

  private path(points: WorldPos[], color: number): void {
    if (points.length < 2) return;
    this.live.lineStyle(3, color, 1).strokePoints(points.map(project), false);
  }

  update(s: SimulationSnapshot): void {
    for (const o of [this.grid, this.live, this.legend, ...this.labels]) o.setVisible(this.enabled);
    if (!this.enabled) return;
    this.live.clear();
    const p = s.player.pos;
    this.ring(this.live, p, RUN_BODY_RADIUS, 0xffffff);
    this.path([p, ...s.player.waypoints], 0x38caff);
    const street = s.story.street;
    for (const n of street?.npcs ?? []) if (n.bike && n.scale > .01) this.ring(this.live, n, .06, 0xff7b42);
    // Walkers at their real body radius (what the hero collides with), not one size for everybody.
    for (const n of this.sim.street?.people() ?? []) this.ring(this.live, n, n.r ?? .25, 0xffe96b);
    const config = this.sim.content.story.chapters.S03?.street;
    if (this.sim.street && config) for (const y of config.bikeLanes) this.path([{ x: 0, y }, { x: this.sim.world.width, y }], 0xff9b52);
    const route = this.sim.street?.rescueRoute;
    if (route) {
      this.path(route.approach, 0xdd72ff); this.path([route.park, ...route.exit], 0xdd72ff);
      this.ring(this.live, route.park, .45, 0xdd72ff); this.ring(this.live, route.door, .26, 0xffffff);
    }
    const cam = this.scene.cameras.main, z = cam.zoom / PIXEL_RATIO;
    const pointer = this.scene.input.activePointer;
    const hovered = worldToTile(screenToWorld(cam.getWorldPoint(pointer.x, pointer.y)));
    this.ring(this.live, { x: hovered.x + .5, y: hovered.y + .5 }, .4, 0x38caff);
    const view = cam.worldView;
    this.live.lineStyle(2 / z, 0xffffff, .65).strokeRect(view.x + 3 / z, view.y + 3 / z, view.width - 6 / z, view.height - 6 / z);
    const at = cam.getWorldPoint(8 * PIXEL_RATIO, cam.height - 8 * PIXEL_RATIO);
    this.legend.setPosition(at.x, at.y).setScale(1 / z).setText([
      'F2: GRID / COLLISION',
      'Green: walkable | Red: blocked',
      'Gold: prop | White: hero body',
      'Blue: path / pointer | Orange: lanes',
      'Purple: ambulance route | Yellow: walkers (real radius)',
      'White box: art | Magenta: camera area | Cyan: zebra',
      `Pointer ${hovered.x},${hovered.y} | Hero tile ${s.player.tile.x},${s.player.tile.y} | ${p.x.toFixed(2)},${p.y.toFixed(2)}`,
      `Run: ${s.story.run?.phase ?? '-'} | rescue: ${street?.carried ? 'carried' : street?.heroHidden ? 'in van' : street?.heroDown ? 'down' : '-'}`,
    ]);
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-F2', this.toggle);
    this.grid.destroy(); this.live.destroy(); this.legend.destroy(); for (const l of this.labels) l.destroy();
  }
}
