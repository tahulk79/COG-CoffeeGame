// Region map template (meters). Same layout for every region; the scene tints it per country.
// x → east, z → south. Origin at the central crossroads. Nothing may be built on roads (validated in core/systems/build.js).
//
//            north
//   F8  F7 | B4  B5          (Round 3, behind the north road)
//   ------ north road ------ (road 'north')
//   F4  F3 | B1  B2
//   ======= main road =======
//   F2  F1 | B3
//   ------ south-west road (road 'southWest')
//   F6  F5 |   GATE
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
  southWest: { id: 'southWest', rect: [-28, 9.2, -1.5, 10.8], open: false, cost: 300, round: 2 },
  north: { id: 'north', rect: [-28, -10.8, 28, -9.2], open: false, cost: 900, round: 3 },
};
export const ROAD_ORDER = ['mainEW', 'mainNS', 'southWest', 'north'];

// Parcels: kind 'farm' (contains plots) or 'build' (free cells for buildings) or 'shop' (café block, free cells).
// starter parcels are owned for free in every region. cost in coins. road: road that must be open first.
export const PARCELS = {
  F1: { id: 'F1', kind: 'farm', rect: [-14, 2.5, -4, 8.5], starter: true, cost: 0, round: 1 },
  F2: { id: 'F2', kind: 'farm', rect: [-26, 2.5, -16, 8.5], cost: 80, round: 1 },
  F3: { id: 'F3', kind: 'farm', rect: [-14, -8.5, -4, -2.5], cost: 220, round: 1 },
  F4: { id: 'F4', kind: 'farm', rect: [-26, -8.5, -16, -2.5], cost: 500, round: 1 },
  F5: { id: 'F5', kind: 'farm', rect: [-14, 11.5, -4, 17.5], cost: 1200, round: 2, road: 'southWest' },
  F6: { id: 'F6', kind: 'farm', rect: [-26, 11.5, -16, 17.5], cost: 2000, round: 2, road: 'southWest' },
  F7: { id: 'F7', kind: 'farm', rect: [-14, -17.5, -4, -11.5], cost: 4000, round: 3, road: 'north' },
  F8: { id: 'F8', kind: 'farm', rect: [-26, -17.5, -16, -11.5], cost: 6000, round: 3, road: 'north' },
  B1: { id: 'B1', kind: 'build', rect: [4, -8, 14, -2], starter: true, cost: 0, round: 1 },
  B2: { id: 'B2', kind: 'build', rect: [16, -8, 26, -2], cost: 150, round: 1 },
  B3: { id: 'B3', kind: 'build', rect: [5, 2.5, 15, 8.5], cost: 800, round: 2 },
  // Café area (see CAFE_BOUNDS): S = starter café block with the two counters, C2 = Round 2 café expansion.
  S: { id: 'S', kind: 'shop', rect: [-6, 102, 6, 114], starter: true, cost: 0, round: 1, area: 'cafe' },
  C2: { id: 'C2', kind: 'shop', rect: [8, 102, 18, 112], cost: 1500, round: 2, area: 'cafe' },
  B4: { id: 'B4', kind: 'build', rect: [4, -18, 14, -12], cost: 3000, round: 3, road: 'north' },
  B5: { id: 'B5', kind: 'build', rect: [16, -18, 26, -12], cost: 4500, round: 3, road: 'north' },
};
export const PARCEL_ORDER = ['F1', 'S', 'B1', 'F2', 'B2', 'F3', 'F4', 'B3', 'F5', 'F6', 'C2', 'F7', 'F8', 'B4', 'B5'];
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
  silo: { x: 9, z: -5, rot: 0 },
  orderCounter: { x: -3, z: 105, rot: 0 },
  brewCounter: { x: 2, z: 105, rot: 0 },
};
// ---- Café area (separate from the farm) ----
export const CAFE_BOUNDS = { minX: -22, maxX: 24, minZ: 94, maxZ: 128 };
export const CAFE_SPAWN = { x: -1, z: 113.5 };          // where the player stands when entering the café
// Customers walk in from the street (south-west), up the street, then east to the order counter.
export const CUSTOMER = {
  spawn: { x: -8, z: 127 },
  queue: { x: -3, z: 107.3, dx: 0, dz: 1.2 },   // queue head + spacing (south of the order counter)
  pickup: { x: 2, z: 107.3 },
  exit: { x: -8, z: 127 },
};
// Café street (always open, cannot be built on).
export const CAFE_ROADS = {
  cafeStreet: { id: 'cafeStreet', rect: [-9.5, 96, -6.5, 128], open: true },
  cafeFront: { id: 'cafeFront', rect: [-22, 116, 24, 119], open: true },
};
export const AREAS = {
  farm: { bounds: BOUNDS, spawn: PLAYER_SPAWN },
  cafe: { bounds: CAFE_BOUNDS, spawn: CAFE_SPAWN },
};
export const areaAt = (x, z) => (z >= CAFE_BOUNDS.minZ - 10 ? 'cafe' : 'farm');
// Suggested tutorial build spot for the roaster (inside the café block).
export const TUTORIAL_BUILD = { roaster: { x: 2, z: 111 } };

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
