import type { NavGrid } from '../../systems/navigation/NavGrid';
import { NavigationService } from '../../systems/navigation/NavigationService';
import { hasClearance } from '../../systems/navigation/smoothing';
import type { Rect } from '../../systems/camera/framing';
import { worldToTile, type WorldPos } from '../../utils/tile';

export interface RescueRoute {
  dir: number;
  lane: number;
  park: WorldPos;
  door: WorldPos;
  approach: WorldPos[];
  exit: WorldPos[];
}

/** Roads are authored vehicle access, while the live grid accounts for walls and props. */
export function planRescue(grid: NavGrid, hero: WorldPos, lanes: number[], access: Rect[] = []): RescueRoute | null {
  const preferredDir = hero.x > grid.width / 2 ? -1 : 1;
  const nav = new NavigationService(grid, 0.25);
  const candidates: Array<{ park: WorldPos; axis: 'x' | 'y'; dir: number; lane: number; junction?: WorldPos }> = [];
  for (const dir of [preferredDir, -preferredDir]) {
    const lane = lanes[dir > 0 ? lanes.length - 1 : 0]! + (dir > 0 ? -0.3 : 0.3);
    candidates.push({ park: { x: Math.max(2, Math.min(grid.width - 3, hero.x - dir * 2.8)), y: lane }, axis: 'x', dir, lane });
    for (let x = 2.5; x < grid.width - 2; x++) candidates.push({ park: { x, y: lane }, axis: 'x', dir, lane });
    for (const road of access) {
      const x = road.x + road.w / 2;
      for (let y = road.y + 1.5; y < Math.min(road.y + road.h - 1, lane - 1); y++) candidates.push({ park: { x, y }, axis: 'y', dir, lane, junction: { x, y: lane } });
    }
  }
  // Choose nearby parking across all roads before considering a distant alley or driving past the hero.
  const score = (c: typeof candidates[number]) => Math.hypot(c.park.x - hero.x, c.park.y - hero.y)
    + (c.dir === preferredDir ? 0 : 0.75) + (c.axis === 'x' && (hero.x - c.park.x) * c.dir < 0 ? 4 : 0);
  candidates.sort((a, b) => score(a) - score(b));
  for (const c of candidates) {
    if (Math.hypot(c.park.x - hero.x, c.park.y - hero.y) < 2) continue;
    const rx = c.axis === 'x' ? 1.1 : 0.55, ry = c.axis === 'x' ? 0.55 : 1.1;
    const x0 = Math.floor(c.park.x - rx), y0 = Math.floor(c.park.y - ry);
    if (!grid.isAreaFree({ x: x0, y: y0, w: Math.floor(c.park.x + rx) - x0 + 1, h: Math.floor(c.park.y + ry) - y0 + 1 })) continue;
    const junction = c.junction ?? c.park, { dir, lane } = c;
    if (!hasClearance(grid, { x: dir > 0 ? 2 : grid.width - 3, y: lane }, junction, 0.55)) continue;
    if (c.junction && !hasClearance(grid, junction, c.park, 0.55)) continue;
    const side = c.axis === 'x' ? (hero.y >= c.park.y ? 1 : -1) : (hero.x >= c.park.x ? 1 : -1);
    for (const sign of [side, -side]) {
      const door = c.axis === 'x' ? { x: c.park.x + dir * 0.3, y: c.park.y + sign * 0.95 } : { x: c.park.x + sign * 0.95, y: c.park.y - 0.3 };
      if (!grid.isWalkable(worldToTile(door)) || !nav.planTo(door, [worldToTile(hero)])) continue;
      const entryX = Math.max(2, Math.min(grid.width - 3, junction.x - dir * 10));
      return { dir, lane, park: c.park, door, approach: [{ x: entryX, y: lane }, ...(c.junction ? [junction] : []), c.park], exit: c.junction ? [junction] : [] };
    }
  }
  return null;
}
