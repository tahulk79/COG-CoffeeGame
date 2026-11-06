// Café seats (founder: "after ordering, customers go sit on chairs"). Same count and order as the core
// (derive.seatCount = terrace seats + SHOP.seatsPerTable per 'tables' building):
//  · terrace (the upgradable 'terrace' building): the first N of layout CAFE_SEATS, N = BUILDINGS.terrace.effect.seats
//    at its level. Two rows of plastic stools (z 115.2 / 117.2); each column shares one low table between the rows.
//  · each Tables building: its two chairs, left / right of the table in the building's own frame (rotates with it)
// Each spot: { x, z, yaw (facing the table), cup: {x, y, z} (where the served cup is put), row, key }.
import { CAFE_SEATS } from '../../core/config/layout.js';
import { BUILDINGS, SHOP } from '../../core/config/economy.js';
import { region as regionOf } from '../../core/derive.js';

export const TERRACE_TABLE_TOP = .52;   // low plastic sidewalk table (buildings.js draws the terrace)
export const TERRACE_TABLE_Z = (Math.min(...CAFE_SEATS.map(s => s.z)) + Math.max(...CAFE_SEATS.map(s => s.z))) / 2;
/** Terrace seats in use at a terrace level. */
export function terraceSeats(level) {
  const list = BUILDINGS.terrace?.effect?.seats;
  if (!list || level < 1) return SHOP.baseSeats;
  return list[Math.min(list.length, level) - 1];
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
  const buildings = regionOf(state)?.buildings || [];
  const terrace = buildings.find(b => b.type === 'terrace');
  const n = terrace ? terraceSeats(terrace.level) : SHOP.baseSeats;
  CAFE_SEATS.slice(0, n).forEach((s, i) => {
    const tz = TERRACE_TABLE_Z;
    out.push({ key: `t${i}`, x: s.x, z: s.z, row: s.z < tz ? 0 : 1, terrace: true, yaw: yawTo(s.x, s.z, s.x, tz), cup: cupAt(s.x, s.z, s.x, tz, TERRACE_TABLE_TOP + .02, .2) });
  });
  for (const b of buildings) {
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

/** Where someone stands to hand a cup to the customer on `seat` (behind a terrace stool, or the free side of a chair). */
export function standSpot(seat) {
  if (seat.terrace) return { x: seat.x, z: seat.row === 0 ? TERRACE_TABLE_Z - 1.8 : TERRACE_TABLE_Z + 1.8 };
  return { x: seat.x - Math.sin(seat.yaw) * .8, z: seat.z - Math.cos(seat.yaw) * .8 };
}
