// Café seats (founder: "after ordering, customers go sit on chairs"). Same count and order as the core
// (derive.seatCount = SHOP.baseSeats terrace seats from layout CAFE_SEATS + SHOP.seatsPerTable per 'tables' building):
//  · terrace: CAFE_SEATS, two plastic stools per low sidewalk table (pairs → table at their midpoint)
//  · each Tables building: its two chairs, left / right of the table in the building's own frame (rotates with it)
// Each spot: { x, z, yaw (facing the table), cup: {x, y, z} (where the served cup is put), key }.
import { CAFE_SEATS } from '../../core/config/layout.js';
import { region as regionOf } from '../../core/derive.js';

export const TERRACE_TABLE_TOP = .52;   // low plastic sidewalk table (city.js draws it)
export const TERRACE_TABLES = [];
for (let i = 0; i + 1 < CAFE_SEATS.length; i += 2) {
  const a = CAFE_SEATS[i], b = CAFE_SEATS[i + 1];
  TERRACE_TABLES.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
}

// Chair offset / table height of the Tables prefab (table.glb: chairs_pair at ±0.85, table 0.8 high, scaled by
// normalizeModel to fit its 2 m footprint). buildings.js measures the real values and calls setTableInfo.
const tableInfo = { dx: .71, top: .67 };
export function setTableInfo(info) { if (info) Object.assign(tableInfo, info); }

const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, tz - sz);
function cupAt(sx, sz, tx, tz, y, k) {
  const dx = sx - tx, dz = sz - tz, d = Math.hypot(dx, dz) || 1;
  return { x: tx + dx / d * k, y, z: tz + dz / d * k };
}

/** All seat spots of the current region, in core seat order. */
export function seatSpots(state) {
  const out = [];
  CAFE_SEATS.forEach((s, i) => {
    const t = TERRACE_TABLES[Math.floor(i / 2)] || s;
    out.push({ key: `t${i}`, x: s.x, z: s.z, yaw: yawTo(s.x, s.z, t.x, t.z), cup: cupAt(s.x, s.z, t.x, t.z, TERRACE_TABLE_TOP + .02, .2) });
  });
  for (const b of regionOf(state)?.buildings || []) {
    if (b.type !== 'tables') continue;
    const a = -(b.rot % 4) * Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
    for (const side of [-1, 1]) {
      const lx = side * tableInfo.dx;
      const x = b.x + lx * c, z = b.z - lx * sn; // rotation about Y (same as the building root)
      out.push({ key: `${b.uid}:${side}`, x, z, yaw: yawTo(x, z, b.x, b.z), cup: cupAt(x, z, b.x, b.z, tableInfo.top + .02, .28) });
    }
  }
  return out;
}
