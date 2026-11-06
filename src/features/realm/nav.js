// Grid navigator (one per area: farm, café). 0.5 m cells over the area bounds; blocked cells = obstacle rects
// (building footprints except walkable ones, city houses, solid props) inflated by the agent radius. A* with
// 8-neighbour moves (no corner cutting), capped iterations (a frame never stalls), then line-of-sight smoothing.
// A blocked target snaps to the nearest free cell; no path → the path goes to the closest reachable cell (never
// freezes). Typed arrays are allocated once per area; searches reuse them (stamp trick, no clearing).
// Shared by the player's tap-to-walk / cup delivery (avatar.js), staff (staff.js) and customers (cafe.js).

import { BUILDINGS } from '../../core/config/economy.js';
import { RESERVED, CAFE_ROADS, ROADS, areaAt } from '../../core/config/layout.js';
import { footprint } from '../../core/derive.js';

const SQRT2 = Math.SQRT2;
// Always walkable, whatever stands next to them: customer lanes in front of the counters (queue + counter lane) and
// every street / road. Clearing them after the inflation keeps the queue slots reachable (they sit right in front of
// the order counter, inside RESERVED.queueLane).
export const NAV_CLEAR = [...RESERVED.filter(r => r.id !== 'gatePlaza').map(r => r.rect), ...Object.values(CAFE_ROADS).map(r => r.rect), ...Object.values(ROADS).map(r => r.rect)];

/**
 * Obstacle rects for an area: static decor rects (city houses, props) + footprints of non-walkable buildings
 * (shrunk 0.15 m like the player's colliders). Same list for the player's colliders and the nav grid.
 */
export function navObstacles(staticRects, buildings) {
  const out = [...staticRects];
  for (const b of buildings || []) {
    const def = BUILDINGS[b.type];
    if (!def || def.walkable) continue;
    const r = footprint(b.type, b.x, b.z, b.rot);
    out.push([r[0] + .15, r[1] + .15, r[2] - .15, r[3] - .15]);
  }
  return out;
}
export const rectArea = r => areaAt((r[0] + r[2]) / 2, (r[1] + r[3]) / 2);
const MAX_ITER = 40000;

/**
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number}} bounds
 */
export function createNav(bounds, { cell = .5, radius = .35, margin = 2 } = {}) {
  const x0 = bounds.minX - margin, z0 = bounds.minZ - margin;
  const W = Math.ceil((bounds.maxX - bounds.minX + margin * 2) / cell), H = Math.ceil((bounds.maxZ - bounds.minZ + margin * 2) / cell);
  const N = W * H;
  const blocked = new Uint8Array(N);
  const g = new Float32Array(N), f = new Float32Array(N);
  const came = new Int32Array(N);
  const stamp = new Uint32Array(N), closedStamp = new Uint32Array(N);
  const heap = new Int32Array(N + 1);
  let search = 0, heapSize = 0;

  const ix = x => Math.max(0, Math.min(W - 1, Math.floor((x - x0) / cell)));
  const iz = z => Math.max(0, Math.min(H - 1, Math.floor((z - z0) / cell)));
  const cx = i => x0 + (i % W + .5) * cell, cz = i => z0 + (Math.floor(i / W) + .5) * cell;
  const free = i => !blocked[i];

  const inside = (r, pad) => r[2] + pad >= x0 && r[0] - pad <= x0 + W * cell && r[3] + pad >= z0 && r[1] - pad <= z0 + H * cell;
  /** rects: [x0, z0, x1, z1] obstacles (world meters), inflated by the agent radius; clear: rects forced walkable. */
  function rebuild(rects, clear = NAV_CLEAR) {
    blocked.fill(0);
    for (const r of rects) {
      if (!inside(r, radius)) continue; // another area's rect must not paint this grid's edge
      const a = ix(r[0] - radius), b = ix(r[2] + radius - 1e-3), c = iz(r[1] - radius), d = iz(r[3] + radius - 1e-3);
      for (let z = c; z <= d; z++) for (let x = a; x <= b; x++) blocked[z * W + x] = 1;
    }
    for (const r of clear) {
      if (!inside(r, 0)) continue;
      // Cells whose centre lies inside the lane / street.
      const a = ix(r[0] + cell / 2), b = ix(r[2] - cell / 2), c = iz(r[1] + cell / 2), d = iz(r[3] - cell / 2);
      for (let z = c; z <= d; z++) for (let x = a; x <= b; x++) blocked[z * W + x] = 0;
    }
  }

  // Binary min-heap on f.
  function push(i) {
    let k = ++heapSize; heap[k] = i;
    while (k > 1 && f[heap[k >> 1]] > f[i]) { heap[k] = heap[k >> 1]; k >>= 1; }
    heap[k] = i;
  }
  function pop() {
    const top = heap[1], last = heap[heapSize--];
    let k = 1;
    for (;;) {
      let c = k * 2;
      if (c > heapSize) break;
      if (c + 1 <= heapSize && f[heap[c + 1]] < f[heap[c]]) c++;
      if (f[heap[c]] >= f[last]) break;
      heap[k] = heap[c]; k = c;
    }
    heap[k] = last;
    return top;
  }

  /** Nearest free cell to (x, z) (ring search), or -1. */
  function nearestFree(x, z, maxRing = 24) {
    const sx = ix(x), sz = iz(z);
    if (free(sz * W + sx)) return sz * W + sx;
    let best = -1, bd = Infinity;
    for (let r = 1; r <= maxRing; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const gx = sx + dx, gz = sz + dz;
        if (gx < 0 || gz < 0 || gx >= W || gz >= H || !free(gz * W + gx)) continue;
        const d = (cx(gz * W + gx) - x) ** 2 + (cz(gz * W + gx) - z) ** 2;
        if (d < bd) { bd = d; best = gz * W + gx; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // Straight segment clear of blocked cells (sampled every half cell).
  function lineFree(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / (cell * .5));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (blocked[iz(az + (bz - az) * t) * W + ix(ax + (bx - ax) * t)]) return false;
    }
    return true;
  }
  const blockedAt = (x, z) => !!blocked[iz(z) * W + ix(x)];

  /**
   * Path from (sx, sz) to (tx, tz): array of {x, z} waypoints (start excluded). exact: append the exact target even
   * when it lies inside an obstacle (a customer sitting down on a chair). Returns [] when already there.
   */
  function path(sx, sz, tx, tz, { exact = false } = {}) {
    let start = iz(sz) * W + ix(sx);
    if (blocked[start]) { const s = nearestFree(sx, sz); if (s >= 0) start = s; }
    let goal = iz(tz) * W + ix(tx);
    const goalBlocked = !!blocked[goal];
    if (goalBlocked) { const gfree = nearestFree(tx, tz); if (gfree < 0) return [{ x: tx, z: tz }]; goal = gfree; }
    const out = [];
    const finish = () => { if (exact && goalBlocked) out.push({ x: tx, z: tz }); return out; };
    // Clear straight line: no search needed.
    if (!blocked[iz(sz) * W + ix(sx)] && lineFree(sx, sz, goalBlocked ? cx(goal) : tx, goalBlocked ? cz(goal) : tz)) {
      out.push(goalBlocked ? { x: cx(goal), z: cz(goal) } : { x: tx, z: tz });
      return finish();
    }
    search++;
    if (search >= 0xfffffff0) { stamp.fill(0); closedStamp.fill(0); search = 1; }
    heapSize = 0;
    const gx = goal % W, gz = Math.floor(goal / W);
    const h = i => { const dx = Math.abs(i % W - gx), dz = Math.abs(Math.floor(i / W) - gz); return (dx + dz) + (SQRT2 - 2) * Math.min(dx, dz); };
    stamp[start] = search; g[start] = 0; f[start] = h(start); came[start] = -1; push(start);
    let bestNode = start, bestH = f[start], found = false, iter = 0;
    while (heapSize && iter++ < MAX_ITER) {
      const cur = pop();
      if (closedStamp[cur] === search) continue;
      closedStamp[cur] = search;
      if (cur === goal) { found = true; break; }
      const hc = f[cur] - g[cur];
      if (hc < bestH) { bestH = hc; bestNode = cur; }
      const x = cur % W, z = Math.floor(cur / W);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        const n = nz * W + nx;
        if (blocked[n] || closedStamp[n] === search) continue;
        if (dx && dz && (blocked[z * W + nx] || blocked[nz * W + x])) continue; // no corner cutting
        const ng = g[cur] + (dx && dz ? SQRT2 : 1);
        if (stamp[n] === search && ng >= g[n]) continue;
        stamp[n] = search; g[n] = ng; came[n] = cur; f[n] = ng + h(n);
        push(n);
      }
    }
    const end = found ? goal : bestNode; // no path: go as close as possible
    const cells = [];
    for (let i = end; i !== -1 && cells.length < 4000; i = came[i]) cells.push(i);
    cells.reverse();
    // String-pull: from the current anchor keep the farthest cell still in line of sight.
    let ax = sx, az = sz, k = 1;
    while (k < cells.length) {
      let far = k;
      for (let j = cells.length - 1; j > k; j--) if (lineFree(ax, az, cx(cells[j]), cz(cells[j]))) { far = j; break; }
      ax = cx(cells[far]); az = cz(cells[far]);
      out.push({ x: ax, z: az });
      k = far + 1;
    }
    if (found && !goalBlocked && out.length) { out[out.length - 1] = { x: tx, z: tz }; } // land exactly on the target
    else if (found && !goalBlocked) out.push({ x: tx, z: tz });
    return finish();
  }

  return { rebuild, path, nearestFree: (x, z) => { const i = nearestFree(x, z); return i < 0 ? null : { x: cx(i), z: cz(i) }; }, blockedAt, lineFree };
}
