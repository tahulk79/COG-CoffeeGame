// Region map template (meters). Same layout for every region; the scene tints it per country.
// x → east, z → south (north = −z). Nothing may be built on roads.
//
// FARM (docs/design/farm-map.md, "Old core + north spine"). The 14 old fields F1–F14 keep their rects and form the
// core around the gate; a dirt spine climbs north with side lanes every row. Land is bought with coins only (no level
// gate) and only when it touches an OPEN road (the frontier). Buying a lot opens the roads it lists in `opensRoads`
// (plus every road it touches), so the paths and the farm grow outward together.
// Lot kinds: farm (6 plots), build (production buildings + decor), decor (decor only), pasture (future animals +
// decor), pond / orchard (scenery + decor). Buildings stand only inside OWNED lots of a matching kind.
//
//      H1 (windmill hill)         ← far north
//   G1  O2 | spine | W4 W5
//   PD1 O1 | spine | P3 P4
//   F18 F17 | spine | W2 W3
//   F16 F15 | spine | P1 P2
//   F8  F7 | spine | F11 F12
//   F4  F3 | spine | F9  F10
//   ======= main road =======
//   F2  F1 | gate  | F13 F14
//   ------ lanes ------
//   F6  F5 | D1 KHO Y0 W1
//            GATE              ← south
//
// The café is NOT on the farm: it is its own area (CAFE_* below), far south of the farm and hidden by fog.
// The HUD "Café" button switches the realm view; both areas live in the same region save.

export const BOUNDS = { minX: -32, maxX: 32, minZ: -76, maxZ: 28 };
export const PLAYER_SPAWN = { x: 0, z: 18 };
export const GATE = { x: 0, z: 23, radius: 2.5 };
// The manager's desk (bàn điều hành, management-rules §6) by each zone's gate: farm = east side of the gate plaza,
// café = east edge of the café block. He stands on the north side (stand.dz) facing the camera (south, +z).
export const GM_DESK = { farm: { x: 3.8, z: 21.6, dz: -.75 }, shop: { x: 9.2, z: 110.8, dz: -.75 } };
// The farm well (giếng nước): south-west edge of the gate plaza (the manager's desk is on the east side). Tending workers fill their
// bucket here (draw = where they stand, on the plaza side facing the well) before watering (realm/staff.js).
export const FARM_WELL = { x: -3.5, z: 25.3, draw: { x: -2.4, z: 24.8 } }; // south-west edge of the plaza, clear of the gate lantern (x −4.4, z 20.8)

// Roads: rectangles, flush against the lots. `open: true` roads exist from the start; the others open when a lot that
// lists them in `opensRoads` (or touches them) is bought (derive.roadOpen).
export const ROADS = {
  mainEW: { id: 'mainEW', rect: [-16, -2.5, 16, 2.5], open: true },
  gateRoad: { id: 'gateRoad', rect: [-1.5, 2.5, 1.5, 20], open: true },
  swLane: { id: 'swLane', rect: [-28, 8.5, -1.5, 11.5], open: true },
  seLane: { id: 'seLane', rect: [1.5, 8.5, 28, 11.5], open: true },
  mainEW_W: { id: 'mainEW_W', rect: [-28, -2.5, -16, 2.5], open: false },
  mainEW_E: { id: 'mainEW_E', rect: [16, -2.5, 28, 2.5], open: false },
  spine0: { id: 'spine0', rect: [-1.5, -11.5, 1.5, -2.5], open: false },
  nLane_W: { id: 'nLane_W', rect: [-28, -11.5, -1.5, -8.5], open: false },
  nLane_E: { id: 'nLane_E', rect: [1.5, -11.5, 28, -8.5], open: false },
  spine1: { id: 'spine1', rect: [-1.5, -20.5, 1.5, -11.5], open: false },
  nRing_W: { id: 'nRing_W', rect: [-28, -20.5, -1.5, -17.5], open: false },
  nRing_E: { id: 'nRing_E', rect: [1.5, -20.5, 28, -17.5], open: false },
  spine2: { id: 'spine2', rect: [-1.5, -33.5, 1.5, -20.5], open: false },
  wLane2: { id: 'wLane2', rect: [-28, -29.5, -1.5, -26.5], open: false },
  eLane2: { id: 'eLane2', rect: [1.5, -33.5, 28, -30.5], open: false },
  spine3: { id: 'spine3', rect: [-1.5, -46.5, 1.5, -33.5], open: false },
  wLane3: { id: 'wLane3', rect: [-28, -38.5, -1.5, -35.5], open: false },
  eLane3: { id: 'eLane3', rect: [1.5, -46.5, 28, -43.5], open: false },
  spine4: { id: 'spine4', rect: [-1.5, -59.5, 1.5, -46.5], open: false },
  wLane4: { id: 'wLane4', rect: [-28, -51.5, -1.5, -48.5], open: false },
  eLane4: { id: 'eLane4', rect: [1.5, -59.5, 28, -56.5], open: false },
  spine5: { id: 'spine5', rect: [-1.5, -63.5, 1.5, -59.5], open: false },
};
export const ROAD_ORDER = Object.keys(ROADS);

// Parcels (lots). Farm lots are listed first, café lots (area 'cafe') after. starter lots are owned for free.
export const PARCELS = {
  F1: { id: 'F1', kind: 'farm', rect: [-14, 2.5, -4, 8.5], starter: true, cost: 0 },
  Y0: { id: 'Y0', kind: 'build', rect: [12, 11.5, 20, 19.5], starter: true, cost: 0 },
  F2: { id: 'F2', kind: 'farm', rect: [-26, 2.5, -16, 8.5], cost: 80, opensRoads: ['mainEW_W'] },
  F3: { id: 'F3', kind: 'farm', rect: [-14, -8.5, -4, -2.5], cost: 180, opensRoads: ['spine0', 'nLane_W'] },
  W1: { id: 'W1', kind: 'build', rect: [20, 11.5, 28, 19.5], cost: 300 },
  F4: { id: 'F4', kind: 'farm', rect: [-26, -8.5, -16, -2.5], cost: 350, opensRoads: ['nLane_W', 'spine0'] },
  F5: { id: 'F5', kind: 'farm', rect: [-14, 11.5, -4, 17.5], cost: 600 },
  D1: { id: 'D1', kind: 'decor', rect: [2, 11.5, 6, 17.5], cost: 450 },
  F6: { id: 'F6', kind: 'farm', rect: [-26, 11.5, -16, 17.5], cost: 900 },
  F7: { id: 'F7', kind: 'farm', rect: [-14, -17.5, -4, -11.5], cost: 1300, opensRoads: ['spine1', 'nRing_W'] },
  F8: { id: 'F8', kind: 'farm', rect: [-26, -17.5, -16, -11.5], cost: 1800, opensRoads: ['nRing_W', 'spine1'] },
  F9: { id: 'F9', kind: 'farm', rect: [4, -8.5, 14, -2.5], cost: 2400, opensRoads: ['spine0', 'nLane_E'] },
  F10: { id: 'F10', kind: 'farm', rect: [16, -8.5, 26, -2.5], cost: 3200, opensRoads: ['mainEW_E'] },
  F11: { id: 'F11', kind: 'farm', rect: [4, -17.5, 14, -11.5], cost: 4200, opensRoads: ['spine1', 'nRing_E'] },
  P1: { id: 'P1', kind: 'pasture', rect: [2, -30.5, 14, -20.5], cost: 4800, opensRoads: ['spine2', 'eLane2'] },
  F12: { id: 'F12', kind: 'farm', rect: [16, -17.5, 26, -11.5], cost: 5500, opensRoads: ['nRing_E'] },
  F15: { id: 'F15', kind: 'farm', rect: [-14, -26.5, -4, -20.5], cost: 6200, opensRoads: ['spine2', 'wLane2'] },
  F13: { id: 'F13', kind: 'farm', rect: [4, 2.5, 14, 8.5], cost: 7000, opensRoads: ['mainEW_E'] },
  W2: { id: 'W2', kind: 'build', rect: [2, -43.5, 14, -33.5], cost: 8000, opensRoads: ['spine3', 'eLane3'] },
  F14: { id: 'F14', kind: 'farm', rect: [16, 2.5, 26, 8.5], cost: 9000, opensRoads: ['mainEW_E'] },
  F16: { id: 'F16', kind: 'farm', rect: [-26, -26.5, -16, -20.5], cost: 10500, opensRoads: ['wLane2', 'spine2'] },
  P2: { id: 'P2', kind: 'pasture', rect: [16, -30.5, 28, -20.5], cost: 12000, opensRoads: ['eLane2', 'spine2'] },
  F17: { id: 'F17', kind: 'farm', rect: [-14, -35.5, -4, -29.5], cost: 14000, opensRoads: ['spine3', 'wLane3'] },
  W3: { id: 'W3', kind: 'build', rect: [16, -43.5, 28, -33.5], cost: 16000, opensRoads: ['eLane3', 'spine3'] },
  F18: { id: 'F18', kind: 'farm', rect: [-26, -35.5, -16, -29.5], cost: 18500, opensRoads: ['wLane3', 'spine3'] },
  PD1: { id: 'PD1', kind: 'pond', rect: [-28, -48.5, -16, -38.5], cost: 21000, opensRoads: ['wLane4', 'spine4'] },
  O1: { id: 'O1', kind: 'orchard', rect: [-14, -48.5, -2, -38.5], cost: 24000, opensRoads: ['wLane4', 'spine4'] },
  P3: { id: 'P3', kind: 'pasture', rect: [2, -56.5, 14, -46.5], cost: 28000, opensRoads: ['eLane4', 'spine4'] },
  G1: { id: 'G1', kind: 'decor', rect: [-28, -61.5, -16, -51.5], cost: 32000 },
  P4: { id: 'P4', kind: 'pasture', rect: [16, -56.5, 28, -46.5], cost: 37000, opensRoads: ['eLane4', 'spine4'] },
  O2: { id: 'O2', kind: 'orchard', rect: [-14, -61.5, -2, -51.5], cost: 42000, opensRoads: ['spine5'] },
  W4: { id: 'W4', kind: 'build', rect: [10, -69.5, 20, -59.5], cost: 48000, opensRoads: ['spine5'] },
  W5: { id: 'W5', kind: 'build', rect: [20, -69.5, 30, -59.5], cost: 55000 },
  H1: { id: 'H1', kind: 'decor', rect: [-8, -73.5, 8, -63.5], cost: 70000 },
  // Café area (see CAFE_BOUNDS): S = starter café block with the two counters; C2/C3 = café expansions bought with coins.
  // Wider café (16 × 14 m) so there is room to build; expansions on both sides.
  S: { id: 'S', kind: 'shop', rect: [-6, 100, 10, 114], starter: true, cost: 0, area: 'cafe' },
  C2: { id: 'C2', kind: 'shop', rect: [12, 100, 24, 114], cost: 500, area: 'cafe' },
  C3: { id: 'C3', kind: 'shop', rect: [-22, 100, -11, 114], cost: 1400, area: 'cafe' },
};
export const PARCEL_ORDER = ['F1', 'Y0', 'S', 'F2', 'C2', 'F3', 'W1', 'F4', 'D1', 'F5', 'C3', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'P1', 'F12', 'F15', 'F13', 'W2', 'F14', 'F16', 'P2', 'F17', 'W3', 'F18', 'PD1', 'O1', 'P3', 'G1', 'P4', 'O2', 'W4', 'W5', 'H1'];
export const areaOfParcel = id => PARCELS[id]?.area || 'farm';
/** Lot kinds a building zone may stand on (BUILDINGS[].zone → PARCELS[].kind). */
// Legacy (layout ≤ 4): zone → lot kinds. Only the v4 save migration still reads it; placement uses TERRAIN_USES below.
export const LOT_KINDS = { farm: ['build'], shop: ['shop'], any: ['build', 'decor', 'pasture', 'orchard', 'pond', 'shop'] };
// ---- Farm World 2.0: one unified farm (docs/farm-world-2.0/FARM-WORLD-2.0-ARCHITECTURE.md §2) ----
// A lot's kind only sets its terrain now; the terrain lists what may stand on it. Owned meadow takes fields, buildings
// and decor side by side (no more "field lots" vs "yard lots"). Special land keeps a meaning the player can read.
export const LOT_TERRAIN = { farm: 'meadow', build: 'meadow', decor: 'garden', pasture: 'pasture', orchard: 'orchard', pond: 'pond', shop: 'shop' };
export const TERRAIN_OVERRIDE = { H1: 'hill' };
export const TERRAIN_USES = {
  meadow: ['field', 'building', 'decor'],
  garden: ['field', 'building', 'decor'],
  pasture: ['building', 'decor'], // kept for animals (docs/design/produce-system.md)
  orchard: ['field', 'decor'],     // orchard trees stay
  pond: ['decor'],
  hill: ['decor'],
  shop: ['building', 'decor'],     // café lots (café rules unchanged)
};
export const terrainOfLot = id => (Object.hasOwn(TERRAIN_OVERRIDE, id) ? TERRAIN_OVERRIDE[id] : (Object.hasOwn(PARCELS, id) && LOT_TERRAIN[PARCELS[id].kind]) || 'wild');
// Growing zone of a lot (docs/design/coffee-varieties.md): south of the main road = lowland, the first two rows north =
// upland (trung du), the far north = highland (cao nguyên), the pond and its orchard = wetland. Café lots have none.
const ZONE_LOTS = {
  lowland: ['F1', 'F2', 'F5', 'F6', 'F13', 'F14', 'Y0', 'W1', 'D1'],
  upland: ['F3', 'F4', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F15', 'F16', 'P1', 'P2'],
  highland: ['F17', 'F18', 'W2', 'W3', 'P3', 'P4', 'G1', 'O2', 'W4', 'W5', 'H1'],
  wetland: ['PD1', 'O1'],
};
export const CLIMATE_OF = Object.fromEntries(Object.entries(ZONE_LOTS).flatMap(([z, ids]) => ids.map(id => [id, z])));
export const climateOfLot = id => (Object.hasOwn(CLIMATE_OF, id) ? CLIMATE_OF[id] : 'lowland');
export const lotAllows = (id, use) => (TERRAIN_USES[terrainOfLot(id)] || []).includes(use);
// Fields a lot comes with when bought ("pre-tilled"): the 6 classic plot spots of every field lot (plotsOf below).
export const PRE_TILLED = { farm: 6 };
// Footprint corners snap to this lattice: every lot and road edge sits on a 0.5 m line (lot z-edges are at .5).
export const SNAP = 0.5;
/** The lot that fully contains footprint rect `fp`, else null. */
export const lotContaining = fp => Object.values(PARCELS).find(p => inRect(fp[0], fp[1], p.rect) && inRect(fp[2], fp[3], p.rect)) || null;
/** True when two rects share an edge or overlap (a lot "touches" a road). */
export const rectsTouch = (a, b, eps = .01) => a[0] <= b[2] + eps && a[2] >= b[0] - eps && a[1] <= b[3] + eps && a[3] >= b[1] - eps;

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
// Widened café area: the street now holds 4 shops in one row (docs/design/cafe-street.md):
//   x: -40 … -27 | -22 … -11 | alley | -6 … 10 | 12 … 24 | 29 … 41 | 44 … 57
//        TEA (1)     C3          ↕      S café     C2        LEMON (3)  BAR (4)
// The café parcels (S / C2 / C3), FIXED counters, CUSTOMER spawn/exit and RESERVED lanes are unchanged.
export const CAFE_BOUNDS = { minX: -46, maxX: 62, minZ: 92, maxZ: 130 };
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
// Café queue: head at the order counter, then 2 lines behind it (founder: "nếu chỗ trống thì xếp 2 hàng").
// cafeQueueSlot(i): i = index among waiting orders (0 = at the counter); 1, 2 → first row (left, right), 3, 4 → …
// (CUSTOMER.queue stays for back-compat; realm/cafe.js uses cafeQueueSlot.) Returns a NEW object each call.
export const CAFE_QUEUE = { head: { x: -3, z: 107.3 }, cols: [-3.75, -2.25], z0: 108.45, dz: 1.05 };
const queueSlot = (q, i) => {
  if (!(i > 0)) return { x: q.head.x, z: q.head.z };
  const k = Math.floor(i) - 1;
  return { x: q.cols[k % 2], z: q.z0 + Math.floor(k / 2) * q.dz };
};
export const cafeQueueSlot = i => queueSlot(CAFE_QUEUE, i);
// Café street (always open, cannot be built on). The street follows the widened bounds; the alley is unchanged.
export const CAFE_ROADS = {
  cafeStreet: { id: 'cafeStreet', rect: [-9.5, 94, -6.5, 130], open: true },
  cafeFront: { id: 'cafeFront', rect: [-46, 118.5, 62, 121.5], open: true },
};
// Street entry points for walk-in customers: the alley (CUSTOMER.spawn) plus both street ends.
export const STREET_ENDS = { west: { x: -45, z: 120 }, east: { x: 61, z: 120 } };

// Venue lots: the 3 new street shops (tea house, lemon tea, bar). NOT parcels: unlocked by `shop/openVenue`, never
// bought as land, never buildable (placementError only looks at PARCELS). Per lot:
//  · rect: the lot (same z band as the café parcels), cx: centre x
//  · counter: shop counter centre (2.6 × 1 m, faces south); vendor: stands behind it
//  · queue: head in front of the counter, then 2 lines (cols) every dz; max = slots drawn (head + 8)
//  · seats: low stools on the sidewalk in front of the shop, 2 rows of 4 (like the café terrace)
//  · sign: shop sign anchor on the house front
const venueLot = (id, x0, x1) => {
  const cx = (x0 + x1) / 2;
  return {
    id, rect: [x0, 100, x1, 114], cx,
    counter: { x: cx, z: 106 }, vendor: { x: cx, z: 104.7 },
    queue: { head: { x: cx, z: 107.4 }, cols: [cx - .75, cx + .75], z0: 108.5, dz: 1.05, max: 9 },
    seats: [0, 1].flatMap(row => [-2.4, -.8, .8, 2.4].map(dx => ({ x: cx + dx, z: row ? 117.2 : 115.2, row }))),
    sign: { x: cx, y: 4.2, z: 100.2 },
  };
};
export const VENUE_LOTS = { tea: venueLot('tea', -40, -27), lemon: venueLot('lemon', 29, 41), bar: venueLot('bar', 44, 57) };
// Queue slot i (0 = head at the counter) of venue `id`; same shape as cafeQueueSlot. Unknown venue → null.
export const venueQueueSlot = (id, i) => {
  const lot = typeof id === 'string' && Object.hasOwn(VENUE_LOTS, id) ? VENUE_LOTS[id] : null;
  return lot ? queueSlot(lot.queue, i) : null;
};
// Rect of each founder shop for camera framing / taps. 'cafe' = the C3 … C2 block incl. the terrace.
export const SHOP_FRAMES = {
  tea: [-41, 99, -26, 118],
  cafe: [-23, 99, 25, 118],
  lemon: [28, 99, 42, 118],
  bar: [43, 99, 58, 118],
};
export const STREET_FRAME = [-44, 96, 60, 124];            // overview of the whole street
export const SHOP_ORDER = ['tea', 'cafe', 'lemon', 'bar'];  // founder numbering 1..4 (left → right)
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
// Founder shop ('tea' | 'cafe' | 'lemon' | 'bar') whose frame contains the point, else null.
export const shopAt = (x, z) => SHOP_ORDER.find(id => inRect(x, z, SHOP_FRAMES[id])) || null;
export const rectCenter = r => ({ x: (r[0] + r[2]) / 2, z: (r[1] + r[3]) / 2 });
// No-build areas inside parcels (customer lanes in front of the counters, the gate plaza).
export const RESERVED = [
  { id: 'counterLane', rect: [-6, 106, 4.5, 108.6] },
  { id: 'queueLane', rect: [-6, 106, -1.8, 114] },
  { id: 'gatePlaza', rect: [-4, 20, 4, 26] },
];
