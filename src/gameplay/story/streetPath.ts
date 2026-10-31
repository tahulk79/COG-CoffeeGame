import { NavGrid } from '../../systems/navigation/NavGrid';
import { findPath } from '../../systems/navigation/astar';
import { hasClearance } from '../../systems/navigation/smoothing';
import type { Footprint, WorldPos } from '../../utils/tile';

/** Quarter-tile routing uses the same body and round obstacles as street movement. */
export class StreetPath {
  private base?: NavGrid;
  private revision = -1;
  constructor(private grid: NavGrid, private props: Array<WorldPos & { r: number }>) {}

  plan(from: WorldPos, to: WorldPos, van?: Footprint, people: Array<WorldPos & { r?: number }> = []): WorldPos[] | null {
    const circles = [...this.props.map(p => ({ ...p, r: p.r + .26 })), ...people.map(p => ({ ...p, r: p.r ?? .85 }))];
    const vanDistance = (p: WorldPos) => !van ? Infinity : Math.hypot(Math.max(van.x - p.x, 0, p.x - van.x - van.w), Math.max(van.y - p.y, 0, p.y - van.y - van.h));
    const free = (p: WorldPos) => hasClearance(this.grid, p, p, .25)
      && vanDistance(p) >= Math.min(.25, vanDistance(from)) - 1e-6
      && circles.every(c => Math.hypot(p.x - c.x, p.y - c.y) >= Math.min(c.r, Math.hypot(from.x - c.x, from.y - c.y)) - 1e-6);
    const clear = (a: WorldPos, b: WorldPos) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / .05));
      for (let i = 1; i <= steps; i++) if (!free({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps })) return false;
      return true;
    };
    if (clear(from, to)) return [{ ...to }];
    const scale = 4;
    if (!this.base || this.revision !== this.grid.revision) {
      this.base = new NavGrid(this.grid.width * scale, this.grid.height * scale);
      for (let y = 0; y < this.base.height; y++) for (let x = 0; x < this.base.width; x++) {
        if (!hasClearance(this.grid, { x: (x + .5) / scale, y: (y + .5) / scale }, { x: (x + .5) / scale, y: (y + .5) / scale }, .25)) this.base.setTerrainBlocked({ x, y }, true);
      }
      this.revision = this.grid.revision;
    }
    // The shared grid gets this call's temporary blocks and gives them back, instead of a full copy per route.
    const nav = this.base, marked: WorldPos[] = [];
    const block = (x0: number, y0: number, x1: number, y1: number, blocked: (p: WorldPos) => boolean) => {
      for (let y = Math.max(0, Math.floor(y0 * scale)); y <= Math.min(nav.height - 1, Math.floor(y1 * scale)); y++) for (let x = Math.max(0, Math.floor(x0 * scale)); x <= Math.min(nav.width - 1, Math.floor(x1 * scale)); x++) {
        if (!nav.isWalkable({ x, y }) || !blocked({ x: (x + .5) / scale, y: (y + .5) / scale })) continue;
        nav.setTerrainBlocked({ x, y }, true);
        marked.push({ x, y });
      }
    };
    for (const c of circles) {
      const radius = Math.min(c.r, Math.hypot(from.x - c.x, from.y - c.y));
      block(c.x - radius, c.y - radius, c.x + radius, c.y + radius, p => Math.hypot(p.x - c.x, p.y - c.y) < radius - 1e-6);
    }
    if (van) block(van.x - .25, van.y - .25, van.x + van.w + .25, van.y + van.h + .25, p => vanDistance(p) < Math.min(.25, vanDistance(from)) - 1e-6);
    const tile = (p: WorldPos) => ({ x: Math.floor(p.x * scale), y: Math.floor(p.y * scale) });
    const goal = tile(to), goals = [];
    for (let y = goal.y - 1; y <= goal.y + 1; y++) for (let x = goal.x - 1; x <= goal.x + 1; x++) if (nav.isWalkable({ x, y }) && clear({ x: (x + .5) / scale, y: (y + .5) / scale }, to)) goals.push({ x, y });
    let route: ReturnType<typeof findPath>;
    try { route = findPath(nav, tile(from), goals); } finally { for (const m of marked) nav.setTerrainBlocked(m, false); }
    if (!route) return null;
    const points = route.tiles.map(t => ({ x: (t.x + .5) / scale, y: (t.y + .5) / scale }));
    points.push({ ...to });
    const out: WorldPos[] = [];
    let anchor = from, i = 0;
    while (i < points.length) {
      let next = points.length - 1;
      while (next >= i && !clear(anchor, points[next]!)) next--;
      if (next < i) return null;
      anchor = points[next]!; out.push(anchor); i = next + 1;
    }
    return out;
  }
}
