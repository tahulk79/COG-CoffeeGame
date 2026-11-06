// Region map template (meters). Same layout for every region; the scene tints it per country.
// x → east, z → south. Origin at the central crossroads. Nothing may be built on roads (validated in core/systems/build.js).
//
// The farm is ONLY for growing: 12 fields (6 plots each) bought with coins, plus the fixed storehouse. No Rounds, no roads to buy.
//            north
//   F8  F7 | F11 F12
//   ------ north road ------
//   F4  F3 | F9  F10
//   ======= main road =======
//   F2  F1 | F13 F14
//   ------ south road ------
//   F6  F5 | KHO  GATE
//            south
//
// The café is NOT on the farm: it is its own area (CAFE_* below), far south of the farm and hidden by fog.
// The HUD "Café" button switches the realm view; both areas live in the same region save.

export const BOUNDS = { minX: -30, maxX: 30, minZ: -22, maxZ: 26 };
export const PLAYER_SPAWN = { x: 0, z: 18 };
export const GATE = { x: 0, z: 23, radius: 2.5 };

// Roads: rectangles. `open: true` roads exist from the start; others are bought ("Mở đường").
export const ROADS = {
  mainEW: { id: 'mainEW', rect: [-30, -1.5, 30, 1.5], open: true },
  mainNS: { id: 'mainNS', rect: [-1.5, -22, 1.5, 26], open: true },
  southWest: { id: 'southWest', rect: [-28, 9.2, -1.5, 10.8], open: true },
  north: { id: 'north', rect: [-28, -10.8, 28, -9.2], open: true },
};
export const ROAD_ORDER = ['mainEW', 'mainNS', 'southWest', 'north'];

// Parcels: kind 'farm' (contains plots) or 'build' (free cells for buildings) or 'shop' (café block, free cells).
// starter parcels are owned for free in every region. cost in coins. road: road that must be open first.
export const PARCELS = {
  F1: { id: 'F1', kind: 'farm', rect: [-14, 2.5, -4, 8.5], starter: true, cost: 0 },
  F2: { id: 'F2', kind: 'farm', rect: [-26, 2.5, -16, 8.5], cost: 80 },
  F3: { id: 'F3', kind: 'farm', rect: [-14, -8.5, -4, -2.5], cost: 180 },
  F4: { id: 'F4', kind: 'farm', rect: [-26, -8.5, -16, -2.5], cost: 350 },
  F5: { id: 'F5', kind: 'farm', rect: [-14, 11.5, -4, 17.5], cost: 600 },
  F6: { id: 'F6', kind: 'farm', rect: [-26, 11.5, -16, 17.5], cost: 900 },
  F7: { id: 'F7', kind: 'farm', rect: [-14, -17.5, -4, -11.5], cost: 1300 },
  F8: { id: 'F8', kind: 'farm', rect: [-26, -17.5, -16, -11.5], cost: 1800 },
  F9: { id: 'F9', kind: 'farm', rect: [4, -8.5, 14, -2.5], cost: 2400 },
  F10: { id: 'F10', kind: 'farm', rect: [16, -8.5, 26, -2.5], cost: 3200 },
  F11: { id: 'F11', kind: 'farm', rect: [4, -17.5, 14, -11.5], cost: 4200 },
  F12: { id: 'F12', kind: 'farm', rect: [16, -17.5, 26, -11.5], cost: 5500 },
  F13: { id: 'F13', kind: 'farm', rect: [4, 2.5, 14, 8.5], cost: 7000 },
  F14: { id: 'F14', kind: 'farm', rect: [16, 2.5, 26, 8.5], cost: 9000 },
  // Café area (see CAFE_BOUNDS): S = starter café block with the two counters; C2/C3 = café expansions bought with coins.
  // Wider café (16 × 14 m) so there is room to build; expansions on both sides.
  S: { id: 'S', kind: 'shop', rect: [-6, 100, 10, 114], starter: true, cost: 0, area: 'cafe' },
  C2: { id: 'C2', kind: 'shop', rect: [12, 100, 24, 114], cost: 500, area: 'cafe' },
  C3: { id: 'C3', kind: 'shop', rect: [-22, 100, -11, 114], cost: 1400, area: 'cafe' },
};
export const PARCEL_ORDER = ['F1', 'S', 'F2', 'C2', 'F3', 'F4', 'F5', 'C3', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14'];
export const areaOfParcel = id => PARCELS[id]?.area || 'farm';

// 6 plots per farm parcel: 3 columns × 2 rows, 2.4 m soil beds.
export const PLOT_SIZE = 2.4;
export function plotsOf(parcelId) {
  const p = PARCELS[parcelId];
  if (!p || p.kind !== 'farm') return [];
  const [x0, z0, x1, z1] = p.rect;
  const out = [];
  const cols = 3, rows = 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push({ id: `${parcelId}-${r * cols + c + 1}`, parcel: parcelId,
      x: x0 + (x1 - x0) * (c + .5) / cols, z: z0 + (z1 - z0) * (r + .5) / rows });
  }
  return out;
}
export const ALL_PLOTS = Object.keys(PARCELS).flatMap(plotsOf);
export const plotById = id => ALL_PLOTS.find(p => p.id === id) || null;

// Fixed starter building positions (center, meters). Counters face the customers walking up from the gate road.
export const FIXED = {
  silo: { x: 9, z: 14, rot: 0 },        // storehouse beside the farm road, south-east
  orderCounter: { x: -3, z: 105, rot: 0 },
  brewCounter: { x: 2, z: 105, rot: 0 },
  terrace: { x: 2, z: 116.2, rot: 0 },   // outdoor seating, upgradable (more seats); walkable
};
// ---- Café area (separate from the farm) ----
export const CAFE_BOUNDS = { minX: -26, maxX: 28, minZ: 92, maxZ: 130 };
export const CAFE_SPAWN = { x: -1, z: 113.5 };          // where the player stands when entering the café
// Outdoor terrace (the upgradable 'terrace' building, FIXED below): 2 rows × 9 stools in front of the café.
// The terrace level decides how many of these seats are in use (economy BUILDINGS.terrace.effect.seats), in this order.
// Customers sit here after ordering until served. Each 'tables' building adds 2 more seats around it.
export const CAFE_SEATS = [0, 1].flatMap(row => Array.from({ length: 9 }, (_, i) => ({ x: -4.4 + i * 1.6, z: row ? 117.2 : 115.2 })))
  .sort((a, b) => Math.abs(a.x - 1.6) - Math.abs(b.x - 1.6) || a.z - b.z); // fill from the middle outwards
// Customers walk in from the street (south-west), up the street, then east to the order counter.
export const CUSTOMER = {
  spawn: { x: -8, z: 127 },
  queue: { x: -3, z: 107.3, dx: 0, dz: 1.2 },   // queue head + spacing (south of the order counter)
  pickup: { x: 2, z: 107.3 },
  exit: { x: -8, z: 127 },
};
// Café street (always open, cannot be built on).
export const CAFE_ROADS = {
  cafeStreet: { id: 'cafeStreet', rect: [-9.5, 94, -6.5, 130], open: true },
  cafeFront: { id: 'cafeFront', rect: [-26, 118.5, 28, 121.5], open: true },
};
export const AREAS = {
  farm: { bounds: BOUNDS, spawn: PLAYER_SPAWN },
  cafe: { bounds: CAFE_BOUNDS, spawn: CAFE_SPAWN },
};
export const areaAt = (x, z) => (z >= CAFE_BOUNDS.minZ - 10 ? 'cafe' : 'farm');
// Suggested tutorial build spot for the roaster (inside the café block).
export const TUTORIAL_BUILD = { roaster: { x: 2, z: 111 } }; // roaster is 4×4 m: z 109–113 clears the counter lane (≤ 108.6)

export const inRect = (x, z, [x0, z0, x1, z1], pad = 0) => x >= x0 - pad && x <= x1 + pad && z >= z0 - pad && z <= z1 + pad;
export const rectsOverlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
export const parcelAt = (x, z) => Object.values(PARCELS).find(p => inRect(x, z, p.rect)) || null;
export const rectCenter = r => ({ x: (r[0] + r[2]) / 2, z: (r[1] + r[3]) / 2 });
// No-build areas inside parcels (customer lanes in front of the counters, the gate plaza).
export const RESERVED = [
  { id: 'counterLane', rect: [-6, 106, 4.5, 108.6] },
  { id: 'queueLane', rect: [-6, 106, -1.8, 114] },
  { id: 'gatePlaza', rect: [-4, 20, 4, 26] },
];
