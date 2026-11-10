// Old saves, once per region: the farm buildings grew (founder 2026-11-09), so one that now stands on a tree, on another
// building, over a road it did not touch before or across a terrace wall is moved, free, to the nearest open spot. Nothing is
// removed and its batch (b.job) stays. No open spot anywhere: it stays where it was (the two models overlap, nothing breaks).
import { BUILDINGS, CELL, FIELD } from './config/economy.js';
import { BOUNDS, ROADS, RESERVED, ESTATES, ESTATE_ORDER, SNAP, farmGroundY, tierZoneAt, rectsOverlap } from './config/layout.js';

// Footprints (grid cells) before the change.
const BEFORE = { dryer: [1.5, .5], silo: [1.9, 1.6], wetMill: [2, 1], well: [1, 1], pulper: [1.4, 1.4], dripLine: [3, 1] };
const RINGS = 70; // metres searched around the building

function rectOf(size, x, z, rot) {
  const [w, d] = rot % 2 ? [size[1], size[0]] : size, hw = w * CELL / 2, hd = d * CELL / 2;
  return [x - hw, z - hd, x + hw, z + hd];
}
function points(r) { return [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]], [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]]; }
/** Inside the map, on one flat tier the player owns (same test as derive.placementError). */
function grounded(r, zones) {
  if (r[0] < BOUNDS.minX || r[2] > BOUNDS.maxX || r[1] < BOUNDS.minZ || r[3] > BOUNDS.maxZ) return false;
  const pts = points(r), zone = tierZoneAt(pts[4][0], pts[4][1]), ys = pts.map(([x, z]) => farmGroundY(x, z));
  return zones.has(zone) && Math.max(...ys) - Math.min(...ys) <= .25 && pts.every(([x, z]) => tierZoneAt(x, z) === zone);
}

/** Moves the buildings that no longer fit (in place). Returns 1, the value saved as region.sized. */
export function settleSizes(buildings, fields, parcels) {
  const zones = new Set(ESTATE_ORDER.filter(id => ESTATES[id].lots.every(l => parcels.includes(l))).map(id => ESTATES[id].zone));
  const lanes = [...Object.values(ROADS), ...RESERVED].map(r => r.rect);
  const beds = fields.map(f => rectOf(FIELD.size, f.x, f.z, 0));
  const here = b => rectOf(BUILDINGS[b.type].size, b.x, b.z, b.rot || 0);
  const hitsThings = (b, r) => beds.some(q => rectsOverlap(r, q)) || buildings.some(o => o !== b && rectsOverlap(r, here(o)));
  const area = b => BUILDINGS[b.type].size[0] * BUILDINGS[b.type].size[1];
  const grown = buildings.filter(b => BEFORE[b.type] && BUILDINGS[b.type].zone === 'farm').sort((a, b) => area(b) - area(a)); // the hardest to fit first
  for (const b of grown) {
    const rot = b.rot || 0, size = BUILDINGS[b.type].size, was = rectOf(BEFORE[b.type], b.x, b.z, rot), now = here(b);
    const stuck = hitsThings(b, now) || (grounded(was, zones) && !grounded(now, zones)) || lanes.some(l => rectsOverlap(now, l) && !rectsOverlap(was, l));
    if (!stuck) continue;
    const [hw, hd] = rot % 2 ? [size[1] * CELL / 2, size[0] * CELL / 2] : [size[0] * CELL / 2, size[1] * CELL / 2];
    const snap = (v, half) => Math.round((v - half) / SNAP) * SNAP + half;
    const tier = tierZoneAt(b.x, b.z);
    const find = sameTier => {
      for (let m = 1; m <= RINGS; m++) {
        const n = 8 * m;
        for (let k = 0; k < n; k++) {
          const a = k / n * Math.PI * 2, x = snap(b.x + Math.cos(a) * m, hw), z = snap(b.z + Math.sin(a) * m, hd), r = rectOf(size, x, z, rot);
          if ((!sameTier || tierZoneAt(x, z) === tier) && grounded(r, zones) && !lanes.some(l => rectsOverlap(r, l)) && !hitsThings(b, r)) return { x, z };
        }
      }
      return null;
    };
    const spot = find(true) || find(false);
    if (spot) Object.assign(b, spot);
  }
  return 1;
}
