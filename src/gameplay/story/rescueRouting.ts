import type { NavGrid } from '../../systems/navigation/NavGrid';
import { NavigationService } from '../../systems/navigation/NavigationService';
import { hasClearance } from '../../systems/navigation/smoothing';
import type { Rect } from '../../systems/camera/framing';
import { worldToTile, type WorldPos, type Footprint } from '../../utils/tile';

export interface RescueRoute {
  dir: number;
  lane: number;
  park: WorldPos;
  door: WorldPos;
  approach: WorldPos[];
  exit: WorldPos[];
}

/** The tiles whose centre lies under the parked van's body: the medics walk round them. */
export function vanBody(park: WorldPos, vertical: boolean): { x: number; y: number; w: number; h: number } {
  const rx = vertical ? 0.45 : 1.1, ry = vertical ? 1.1 : 0.45;
  const x = Math.ceil(park.x - rx - 0.5), y = Math.ceil(park.y - ry - 0.5);
  return { x, y, w: Math.max(1, Math.floor(park.x + rx - 0.5) - x + 1), h: Math.max(1, Math.floor(park.y + ry - 0.5) - y + 1) };
}

/** How far the side door stands out from the van's centre line (tiles): the open sliding door is just behind the middle of the van. */
export const DOOR_OUT = 1.6;

/** Roads are authored vehicle access, while the live grid accounts for walls and props. */
export function planRescue(grid: NavGrid, hero: WorldPos, lanes: number[], access: Rect[] = [], canReach?: (door: WorldPos, body: Footprint) => boolean, props: Array<WorldPos & { r: number }> = []): RescueRoute | null {
  const preferredDir = hero.x > grid.width / 2 ? -1 : 1;
  // Lying against something (half on a tree's tile, say): the medics head for the nearest free tile instead.
  const t = worldToTile(hero);
  const reach = [t, ...[[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => ({ x: t.x + dx!, y: t.y + dy! }))]
    .find((c) => grid.isWalkable(c)) ?? t;
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
  // Park on open road, clear of trees, stools and parked bikes; only when none is free, put up with them.
  for (const margin of [2.8, 0]) for (const c of candidates) {
    if (Math.hypot(c.park.x - hero.x, c.park.y - hero.y) < 2) continue;
    if (margin && props.some(o => Math.hypot(o.x - c.park.x, o.y - c.park.y) < margin)) continue;
    const rx = c.axis === 'x' ? 1.1 : 0.55, ry = c.axis === 'x' ? 0.55 : 1.1;
    const x0 = Math.floor(c.park.x - rx), y0 = Math.floor(c.park.y - ry);
    if (!grid.isAreaFree({ x: x0, y: y0, w: Math.floor(c.park.x + rx) - x0 + 1, h: Math.floor(c.park.y + ry) - y0 + 1 })) continue;
    const junction = c.junction ?? c.park, { dir, lane } = c;
    if (!hasClearance(grid, { x: dir > 0 ? 2 : grid.width - 3, y: lane }, junction, 0.55)) continue;
    if (c.junction && !hasClearance(grid, junction, c.park, 0.55)) continue;
    // The sprite's sliding door opens on the side facing the camera whichever way the van points: south (+y) along the
    // road, east (+x) up a side street. The hero is carried to that door; only if there is no way round from there is
    // the other side used (the door then stays shut in the picture).
    for (const sign of [1, -1]) {
      // The side door, a step clear of the van's body (the medics walk round the body, so they must not start inside it).
      const door = c.axis === 'x' ? { x: c.park.x - 0.4, y: c.park.y + sign * DOOR_OUT } : { x: c.park.x + sign * DOOR_OUT, y: c.park.y - 0.3 };
      // Room for a medic to stand at the door, and a way from it to the hero that goes round the parked van.
      if (!hasClearance(grid, door, door, 0.3)) continue;
      const parked = grid.clone();
      parked.addBlocker(vanBody(c.park, c.axis === 'y'));
      if (!new NavigationService(parked, 0.25).planTo(door, [reach])) continue;
      if (canReach && !canReach(door, vanBody(c.park, c.axis === 'y'))) continue;
      // From just out of sight up the road (16 tiles before its spot, at most the end of the land): it gets there quickly.
      const entryX = Math.max(-14, Math.min(grid.width + 14, c.park.x - dir * 16));
      return { dir, lane, park: c.park, door, approach: [{ x: entryX, y: lane }, ...(c.junction ? [junction] : []), c.park], exit: c.junction ? [junction] : [] };
    }
  }
  return null;
}
