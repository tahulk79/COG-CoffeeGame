const STEP = .35;
// Route around expanded colliders; sample every segment so diagonals cannot cut corners.
export function* findRoute(start, destination, canStand, bounds = { minX: -12, maxX: 12, minZ: -12.5, maxZ: 11 }, interaction = null) {
  destination = { x: Math.max(bounds.minX, Math.min(destination.x, bounds.maxX)), z: Math.max(bounds.minZ, Math.min(destination.z, bounds.maxZ)) };
  const MIN_X = bounds.minX, MIN_Z = bounds.minZ;
  const WIDTH = Math.floor((bounds.maxX - MIN_X) / STEP) + 1;
  const HEIGHT = Math.floor((bounds.maxZ - MIN_Z) / STEP) + 1;
  const cache = new Map();
  const goalDistance = p => interaction?.points?.length
    ? Math.min(...interaction.points.map(goal => Math.hypot(p.x-goal.x,p.z-goal.z)))
    : interaction ? Math.hypot(p.x-interaction.x,p.z-interaction.z) : 0;
  const inRange = p => !interaction || goalDistance(p) <= interaction.radius;
  const key = (x, z) => x * HEIGHT + z;
  const point = id => ({ x: MIN_X + Math.floor(id / HEIGHT) * STEP, z: MIN_Z + (id % HEIGHT) * STEP });
  const free = id => {
    if (!cache.has(id)) { const p = point(id); cache.set(id, canStand(p.x, p.z)); }
    return cache.get(id);
  };
  function clear(a, b) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .1));
    for (let i = 1; i <= steps; i++) if (!canStand(a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps)) return false;
    return true;
  }
  if (inRange(destination) && canStand(destination.x, destination.z) && clear(start, destination)) return [{ ...destination }];
  function* closest(target, connect, maxDistance, requireInteraction = false) {
    let best = null, distance = maxDistance;
    for (let x = 0; x < WIDTH; x++) {
      yield;
      for (let z = 0; z < HEIGHT; z++) {
        if (z % 16 === 0) yield;
        const id = key(x, z), p = point(id);
        const d = Math.hypot(p.x - target.x, p.z - target.z);
        if (d <= distance && (!requireInteraction || inRange(p)) && free(id) && (!connect || clear(target, p))) { best = id; distance = d; }
      }
    }
    return best;
  }
  const first = yield* closest(start, true, 1.5);
  const last = yield* closest(destination, false, Infinity, Boolean(interaction));
  if (first === null || last === null) return [];
  const goal = point(last);
  const open = new Set([first]), closed = new Set(), previous = new Map();
  const cost = new Map([[first, 0]]);
  const heuristic = id => {
    const p = point(id);
    return interaction ? Math.max(0, goalDistance(p) - interaction.radius) : Math.hypot(p.x - goal.x, p.z - goal.z);
  };
  let closestReached = first;
  function* buildRoute(current, appendDestination) {
    const route = [];
    for (let id = current; id !== undefined; id = previous.get(id)) route.unshift(point(id));
    if (appendDestination && canStand(destination.x, destination.z) && clear(route.at(-1), destination)) route.push(destination);
    const result = []; let anchor = start, index = 0;
    while (index < route.length) {
      let next = route.length - 1;
      while (next > index && !clear(anchor, route[next])) { next--; yield; }
      result.push(route[next]); anchor = route[next]; index = next + 1;
    }
    return result;
  }
  while (open.size) {
    yield;
    let current = null, best = Infinity;
    let scanned=0;
    for (const id of open) {
      if (++scanned % 32 === 0) yield;
      const estimate = cost.get(id) + heuristic(id);
      if (estimate < best) { best = estimate; current = id; }
    }
    if (heuristic(current) < heuristic(closestReached)) closestReached = current;
    if (current === last || (interaction && inRange(point(current)))) return yield* buildRoute(current, !interaction);
    open.delete(current); closed.add(current);
    const x = Math.floor(current / HEIGHT), z = current % HEIGHT;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if ((!dx && !dz) || x + dx < 0 || x + dx >= WIDTH || z + dz < 0 || z + dz >= HEIGHT) continue;
      const next = key(x + dx, z + dz);
      if (closed.has(next) || !free(next) || !clear(point(current), point(next))) continue;
      const nextCost = cost.get(current) + Math.hypot(dx, dz) * STEP;
      if (nextCost < (cost.get(next) ?? Infinity)) { previous.set(next, current); cost.set(next, nextCost); open.add(next); }
    }
  }
  if (interaction) return [];
  return yield* buildRoute(closestReached, false);
}
