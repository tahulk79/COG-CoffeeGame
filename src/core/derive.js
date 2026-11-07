// Pure selectors over the v3 save. No mutation. Used by the reducer, the scene and the HUD.
import { TUTORIAL, BUILDINGS, CROPS, CROP_ORDER, DRINKS, DRINK_ORDER, STAFF, hireLimit, STAFF_CAP, RECRUIT, applicantsFor, traitEffect, MISTAKES, QUALITY, isHardDrink, unitLevel, levelSpeed, statOf, statCap, statCost, STAT_ORDER, SKILL, ROBOT_TASKS, PART_COST, PART_ORDER, partTier, partCost, UPKEEP, VITALS, CARE, ROBOT_WEAR, WORKER_TASKS, taskLimit, energyMax, unitFee, FIRE, BOOKS, CHEST_LEVELS, LOAN, loanOwed, ROUND_LEVEL_CAP, REBIRTH, CELL, levelForXp, xpForLevel, GRACE, SHOP, BEANS, VENUES, VENUE_ORDER, VENUE_ITEMS, RATING, FIELD, fieldExtraCost, fieldExtraCap, GOODS, GOOD_ORDER, ITEM_GOODS, RECIPES } from './config/economy.js';
import { PARCELS, ROADS, RESERVED, BOUNDS, GATE, areaOfParcel, areaAt, rectsOverlap, rectsTouch, inRect, terrainOfLot, lotAllows, TERRAIN_USES, PRE_TILLED, SNAP, lotContaining } from './config/layout.js';
import { parseRegionId, citiesOf, COUNTRY_ORDER, regionCost, regionGames } from './config/world.js';

// Own-property lookup: ids come from payloads, so 'toString' / '__proto__' must not resolve to Object.prototype.
export const own = (table, id) => (table && typeof id === 'string' && Object.hasOwn(table, id) ? table[id] : undefined);

export const level = s => levelForXp(s.player.xp);
export const levelProgress = s => {
  const l = level(s), a = xpForLevel(l), b = xpForLevel(l + 1);
  return { level: l, xp: s.player.xp, from: a, to: b, ratio: b > a ? (s.player.xp - a) / (b - a) : 1 };
};
export const region = s => (s.world.currentRegion ? s.world.regions[s.world.currentRegion] || null : null);
export const buildingsOf = (s, type) => (region(s)?.buildings || []).filter(b => b.type === type);
export const buildingLevel = (s, type) => Math.max(0, ...buildingsOf(s, type).map(b => b.level));
export const levelCap = s => ROUND_LEVEL_CAP[s.player.round] || 3;

const pick = (arr, lvl) => (Array.isArray(arr) && lvl > 0 ? arr[Math.min(arr.length, lvl) - 1] : 0);
const effect = (s, type, key) => pick(BUILDINGS[type]?.effect?.[key], buildingLevel(s, type));
const effectSum = (s, type, key) => buildingsOf(s, type).reduce((sum, b) => sum + pick(BUILDINGS[type].effect[key], b.level), 0);

export const assignedUnits = (s, regionId = s.world.currentRegion, zone) =>
  s.staff.units.filter(u => u.assigned && u.assigned.regionId === regionId && (!zone || u.assigned.zone === zone));
// Working = on shift (`active`, not benched) and not blocked (phone, battery, overheat, jam, lunch, sulking, starving,
// exhausted: see unitState). Without `now` a lunch break counts while `breakUntil` is set (staff/vitals clears it).
// `active !== false`: hand-made units (tests, older code paths) without the field count as on shift.
export const unitWorking = (u, now = null) => u.active !== false && !unitBlocked(u, now);
// A worker's own effect grows with its level (+8% a level); robots keep theirs.
const unitEffect = (u, key) => (STAFF[u.type]?.effect?.[key] || 0) * (STAFF[u.type]?.kind === 'worker' ? levelSpeed(u) : 1);
const staffBonus = (s, key) => assignedUnits(s).filter(unitWorking).reduce((sum, u) => sum + unitEffect(u, key) + traitEffect(u, key), 0);
const blessing = (s, key) => (s.rebirth.blessings[key] || 0) * (REBIRTH.blessings[key] || 0);

// Storage: the storehouse plus every barn (sum: a 2nd barn really adds room).
export const capacity = s => (effect(s, 'silo', 'capacity') || 0) + effectSum(s, 'warehouse', 'capacity');
/** Amount of one good in storage ('beans' | 'dried' | 'roasted' | 'bag'). */
export const goodCount = (s, id) => (id === 'beans' ? s.inventory.beans || 0 : ITEM_GOODS.includes(id) ? s.inventory.items?.[id] || 0 : 0);
/** Storage used by every good (each takes 1 space; a bag holds 3 roasted beans, so packing frees room). */
export const stored = s => GOOD_ORDER.reduce((n, id) => n + Math.floor(goodCount(s, id)), 0);
/** Free storage space (0 when full or over). */
export const storageRoom = s => Math.max(0, capacity(s) - stored(s));
// extra: a field's own speed-up (its best well in reach), added like the staff / blessing bonuses.
export const growMs = (s, cropId, extra = 0) => Math.round(CROPS[cropId].growSeconds * 1000 / (1 + staffBonus(s, 'growSpeed') + blessing(s, 'grow') + extra));
/** Grow time of one planted plot: a tutorial seed (`fast`, planted before the first harvest) ripens in a few seconds. */
// A plot a low-level worker planted crooked (`slow`, staff mistake) grows MISTAKES.crookedSlow slower. A field within
// reach of a well grows faster (wellBonus). `plotId` is optional: it is looked up from the plot object when missing.
export const plotGrowMs = (s, p, plotId = plotIdOf(s, p)) => {
  const base = growMs(s, p.crop, plotId ? wellBonus(s, plotId) : 0);
  return p.fast ? Math.min(TUTORIAL.firstGrowSeconds * 1000, base) : Math.round(base * (p.slow ? MISTAKES.crookedSlow : 1));
};
// Farm World 2.0: the drying yard no longer multiplies beans (it processes them), so the yield is crop + staff only.
export const yieldOf = (s, cropId) => Math.max(1, Math.round(CROPS[cropId].beans * (1 + staffBonus(s, 'yieldBonus'))));
export const priceMultiplier = s => 1 + effect(s, 'roaster', 'priceBonus') + effect(s, 'pastry', 'priceBonus') + effectSum(s, 'tables', 'tip') + staffBonus(s, 'priceBonus') + blessing(s, 'price');
export const drinkPrice = (s, drinkId) => Math.round(DRINKS[drinkId].price * priceMultiplier(s));
export const brewMs = (s, drinkId) => Math.round(DRINKS[drinkId].brewSeconds * 1000 / ((effect(s, 'brewCounter', 'brewSpeed') || 1) * (1 + staffBonus(s, 'brewSpeed'))));
export const brewSlots = s => effect(s, 'brewCounter', 'slots') || 1;
export const queueCap = s => (effect(s, 'orderCounter', 'queue') || 2) + effectSum(s, 'tables', 'queue');
// Café walk-in interval; divided by the café's rating factor (1 at the default 4★, so pacing / the sim are unchanged).
export const arrivalMs = s => Math.round((effect(s, 'orderCounter', 'arrivalSeconds') || 9) * 1000 / (1 + effect(s, 'kiosk', 'arrivalBonus')) / ratingFactor(s, 'cafe'));
export const xpMultiplier = s => 1 + blessing(s, 'xp');

export const cropUnlocked = (s, cropId) => !!own(CROPS, cropId) && level(s) >= CROPS[cropId].level && s.player.round >= CROPS[cropId].round;
export const unlockedCrops = s => CROP_ORDER.filter(id => cropUnlocked(s, id));
export const drinkUnlocked = (s, drinkId) => !!own(DRINKS, drinkId) && level(s) >= DRINKS[drinkId].level && buildingLevel(s, 'roaster') >= DRINKS[drinkId].roaster;
export const unlockedDrinks = s => DRINK_ORDER.filter(id => drinkUnlocked(s, id));

export const ownsParcel = (s, parcelId) => !!region(s)?.parcels.includes(parcelId);
// A farm road is open from the start, or once an owned lot lists it in `opensRoads` or touches it.
export function roadOpen(s, roadId) {
  const road = own(ROADS, roadId);
  if (!road) return false;
  if (road.open) return true;
  const owned = region(s)?.parcels || [];
  return owned.some(id => { const p = PARCELS[id]; return p && areaOfParcel(id) === 'farm' && (p.opensRoads?.includes(roadId) || rectsTouch(p.rect, road.rect)); });
}
export const openRoads = s => Object.keys(ROADS).filter(id => roadOpen(s, id));
/** Farm lots not owned yet: all for sale (sign + price), any order — no road / neighbour needed. Café lots too. */
export function frontierParcels(s) {
  const r = region(s);
  if (!r) return [];
  return Object.values(PARCELS).filter(p => areaOfParcel(p.id) === 'farm' && !r.parcels.includes(p.id)).map(p => p.id);
}
/** Farm area the camera / player may roam: owned lots + open roads + frontier lots + the gate plaza, padded. */
export function farmViewBounds(s, pad = 6) {
  const r = region(s);
  const owned = (r?.parcels || Object.values(PARCELS).filter(p => p.starter).map(p => p.id)).filter(id => own(PARCELS, id) && areaOfParcel(id) === 'farm');
  const rects = [...owned.map(id => PARCELS[id].rect), ...(r ? openRoads(s) : Object.keys(ROADS).filter(id => ROADS[id].open)).map(id => ROADS[id].rect),
    ...frontierParcels(s).map(id => PARCELS[id].rect), [GATE.x - 5, GATE.z - 6, GATE.x + 5, GATE.z + 5]];
  const b = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const q of rects) { b.minX = Math.min(b.minX, q[0]); b.minZ = Math.min(b.minZ, q[1]); b.maxX = Math.max(b.maxX, q[2]); b.maxZ = Math.max(b.maxZ, q[3]); }
  return { minX: Math.max(BOUNDS.minX, b.minX - pad), minZ: Math.max(BOUNDS.minZ, b.minZ - pad), maxX: Math.min(BOUNDS.maxX, b.maxX + pad), maxZ: Math.min(BOUNDS.maxZ, b.maxZ + pad) };
}
// ---------- Farm World 2.0: fields are placeables (docs/farm-world-2.0/FARM-WORLD-2.0-ARCHITECTURE.md §2.3) ----------
// Per-region memo (the reducer clones the region on every action, so a WeakMap keyed by the region object is exact).
const memo = new WeakMap();
const memoOf = r => { let m = memo.get(r); if (!m) memo.set(r, m = {}); return m; };
const lotIdAt = (x, z) => Object.values(PARCELS).find(p => inRect(x, z, p.rect))?.id || null;
/** The region's crop fields ({ id, x, z }). */
export const fieldsOf = s => region(s)?.fields || [];
/** Fields as plots ({ id, x, z, parcel }) in save order; parcel = the lot the field stands in (sickle badge groups). */
export const ownedPlots = s => {
  const r = region(s);
  if (!r) return [];
  const m = memoOf(r);
  return (m.plots ||= (r.fields || []).map(f => ({ id: f.id, x: f.x, z: f.z, parcel: lotIdAt(f.x, f.z) })));
};
/** One field by id (null when it does not exist in the current region). Replaces the static layout.plotById. */
export const plotOf = (s, id) => {
  const r = region(s);
  if (!r || typeof id !== 'string') return null;
  const m = memoOf(r);
  if (!m.byId) m.byId = new Map(ownedPlots(s).map(p => [p.id, p]));
  return m.byId.get(id) || null;
};
// The plot id of a region.plots entry (reverse lookup by object identity, memoized per region).
function plotIdOf(s, p) {
  const r = region(s);
  if (!r || !p) return null;
  const m = memoOf(r);
  if (!m.plotIds) m.plotIds = new Map(Object.entries(r.plots || {}).map(([id, v]) => [v, id]));
  return m.plotIds.get(p) || null;
}
/** Fields that come with the land (6 per owned field lot). Placing a field is free below this count. */
export const fieldAllowance = s => (region(s)?.parcels || []).reduce((n, id) => n + (PRE_TILLED[own(PARCELS, id)?.kind] || 0), 0);
export const fieldExtras = s => Math.max(0, fieldsOf(s).length - fieldAllowance(s));
/** Price of the next field: free inside the allowance, else the escalating extra price. */
export const fieldCost = s => (fieldsOf(s).length < fieldAllowance(s) ? 0 : fieldExtraCost(fieldExtras(s)));
/** Coins back when one field is cleared: half the last extra's price, nothing inside the allowance. */
export const fieldRefund = s => (fieldExtras(s) > 0 ? Math.floor(FIELD.refund * fieldExtraCost(fieldExtras(s) - 1)) : 0);
/** Well speed-up of one field: the best well whose reach covers the field's centre (coverage, never stacking). */
export function wellBonus(s, plotId) {
  const r = region(s);
  if (!r) return 0;
  const m = memoOf(r);
  if (!m.wells) m.wells = r.buildings.filter(b => b.type === 'well').map(b => ({ x: b.x, z: b.z, grow: pick(BUILDINGS.well.effect.grow, b.level), radius: pick(BUILDINGS.well.effect.radius, b.level) }));
  if (!m.wells.length) return 0;
  const f = plotOf(s, plotId);
  if (!f) return 0;
  let best = 0;
  for (const w of m.wells) if (Math.hypot(w.x - f.x, w.z - f.z) <= w.radius) best = Math.max(best, w.grow);
  return best;
}

export function plotState(s, plotId, now) {
  const r = region(s);
  const p = r ? own(r.plots, plotId) : undefined;
  if (!p) return { stage: 'empty' };
  const total = plotGrowMs(s, p, plotId), elapsed = Math.max(0, now - p.plantedAt);
  const ratio = Math.min(1, elapsed / total);
  return { stage: ratio >= 1 ? 'ready' : ratio < .08 ? 'planted' : 'growing', crop: p.crop, ratio, remainingMs: Math.max(0, total - elapsed) };
}

// Free robusta when the player is stuck (no coins for seeds, nothing growing, nothing stored or being processed, no café
// orders in progress).
export function graceActive(s) {
  const r = region(s);
  if (!r) return false;
  const cheapest = CROPS[GRACE.freeCrop].seedCost;
  return s.player.coins < cheapest && Object.keys(r.plots).length === 0 && stored(s) === 0 && !r.buildings.some(b => b.job) && r.shop.orders.every(o => o.stage === 'waiting');
}
// ---------- goods trade (farm sells, café buys beans) ----------
/** Selling a good at the storehouse: all of it by default. */
export function sellQuote(s, good = 'beans', amount = Infinity) {
  if (!own(GOODS, good)) return { good, amount: 0, coins: 0 };
  const n = Math.max(0, Math.min(Math.floor(goodCount(s, good)), Math.floor(Number.isFinite(amount) ? amount : Infinity)));
  return { good, amount: n, coins: n * GOODS[good].price };
}
/** Selling everything stored: per good + total coins. */
export function sellAllQuote(s) {
  const parts = GOOD_ORDER.map(id => sellQuote(s, id)).filter(q => q.amount > 0);
  return { parts, amount: parts.reduce((n, q) => n + q.amount, 0), coins: parts.reduce((n, q) => n + q.coins, 0) };
}
/** Selling beans at the storehouse: all of them by default. */
export const beanSellQuote = (s, amount = Infinity) => { const q = sellQuote(s, 'beans', amount); return { amount: q.amount, coins: q.coins }; };
/**
 * Buying beans in the café: up to `amount` (default one pack), limited by the storehouse room and the coins.
 * error: 'storageFull' | 'coins' | null. free: the grace beans (broke, no beans, nothing being brewed).
 */
export function beanBuyQuote(s, amount = BEANS.buyPack) {
  const r = region(s);
  const room = storageRoom(s);
  if (room <= 0) return { amount: 0, cost: 0, free: false, error: 'storageFull' };
  const want = Math.max(1, Math.min(room, Math.floor(amount) || BEANS.buyPack));
  const n = Math.min(want, Math.floor(s.player.coins / BEANS.buyPrice));
  if (n > 0) return { amount: n, cost: n * BEANS.buyPrice, free: false, error: null };
  const brewing = (r?.shop.orders || []).some(o => o.stage === 'brewing');
  if (s.inventory.beans < 1 && !brewing) return { amount: Math.min(room, BEANS.grace), cost: 0, free: true, error: null };
  return { amount: 0, cost: want * BEANS.buyPrice, free: false, error: 'coins', missing: BEANS.buyPrice - s.player.coins };
}
export const shopPaused = s => !!region(s)?.shop.pausedAt;
/** The game the current region is played as ('farm' | 'cafe'), null until picked. */
export const regionGame = s => region(s)?.mode || null;
/** Games the current region offers (by country): one or both. */
export const currentGames = s => (s.world.currentRegion ? regionGames(s.world.currentRegion) : []);
/** Can `game` ('farm' | 'cafe') be played now? Only the current region's game. */
export const canPlay = (s, game) => !!game && regionGame(s) === game;
/** Both games open at once (the Farm ⇄ Café switch). Only Round 1 exists for now: one game per region. */
export const bothGames = () => false;
// Café staff / robots assigned here and working (not on a break): the café keeps running without the player.
export const cafeStaffed = s => assignedUnits(s, s.world.currentRegion, 'shop').some(unitWorking);

export const seedCost = (s, cropId) => (cropId === GRACE.freeCrop && graceActive(s) ? 0 : CROPS[cropId].seedCost);

// ---------- placeables (buildings + fields): footprint, snapping, validity ----------
/** Definition of a placeable type: a building, or 'field' (the crop bed). */
export const defOf = type => (type === 'field' ? FIELD : own(BUILDINGS, type));
/** What the land must allow for this type: 'field' | 'building' | 'decor'. */
export const useOf = type => { const d = defOf(type); return d ? d.use || (d.decor ? 'decor' : 'building') : null; };
export function footprint(type, x, z, rot = 0) {
  const def = defOf(type);
  let [w, d] = def ? def.size : [0, 0];
  if (rot % 2) [w, d] = [d, w];
  const hw = w * CELL / 2, hd = d * CELL / 2;
  return [x - hw, z - hd, x + hw, z + hd];
}
// Snap so the footprint corners land on the SNAP (0.5 m) lattice that every lot and road edge sits on.
export function snapPosition(type, x, z, rot = 0) {
  const def = defOf(type);
  let [w, d] = def ? def.size : [0, 0];
  if (rot % 2) [w, d] = [d, w];
  const hw = w * CELL / 2, hd = d * CELL / 2;
  const q = v => Math.round(v / SNAP) * SNAP;
  return { x: q(x - hw) + hw, z: q(z - hd) + hd };
}
/** Footprint of a saved field / building (fields have no rotation). */
const fpField = f => footprint('field', f.x, f.z, 0);
const fpBuilding = b => footprint(b.type, b.x, b.z, b.rot);
const solidType = type => !!own(BUILDINGS, type) && !BUILDINGS[type].walkable;

// Unified land (ARCHITECTURE §2.4). Fields, buildings and decor stand fully inside ONE owned lot whose terrain allows
// their use (TERRAIN_USES); café things only on café lots, farm things only on farm land. Never on roads, the gate plaza
// or reserved lanes; a building never covers a field (move or clear the field first) and never cuts a field or a
// workshop off from the road. Returns null when placement is valid, else an error code (err.* strings).
export function placementError(s, type, x, z, rot = 0, ignoreId = null) {
  const def = defOf(type);
  const r = region(s);
  if (!def || !r || !Number.isFinite(x) || !Number.isFinite(z)) return 'unknown';
  const fp = footprint(type, x, z, rot);
  const lot = lotContaining(fp);
  if (!lot) {
    if (Object.values(ROADS).some(rd => rectsOverlap(fp, rd.rect))) return 'onRoad';
    if (RESERVED.some(res => rectsOverlap(fp, res.rect))) return 'blocked';
    if (Object.values(PARCELS).some(p => rectsOverlap(fp, p.rect))) return 'edge';
    return 'outside';
  }
  const cafeLot = areaOfParcel(lot.id) === 'cafe';
  if ((def.zone === 'shop' && !cafeLot) || (def.zone === 'farm' && cafeLot)) return 'wrongZone';
  if (!r.parcels.includes(lot.id)) return 'notOwned';
  const use = useOf(type);
  if (!lotAllows(lot.id, use)) return `terrain_${terrainOfLot(lot.id)}`;
  if (RESERVED.some(res => rectsOverlap(fp, res.rect))) return 'blocked';
  for (const f of r.fields || []) if (f.id !== ignoreId && rectsOverlap(fp, fpField(f))) return 'onField';
  for (const b of r.buildings) if (b.uid !== ignoreId && rectsOverlap(fp, fpBuilding(b))) return 'overlap';
  if (!cafeLot && use !== 'field' && cutsAccess(r, lot, fp, use, ignoreId)) return 'noAccess';
  return null;
}
// Would a solid footprint `fp` leave a field or a non-decor building in this lot with no walkable neighbour reaching
// the lot's surroundings (roads / open land)? Local flood fill on the SNAP lattice over the lot + 1 m (cheap: ≤ ~800 cells).
function cutsAccess(r, lot, fp, use, ignoreId) {
  const S = SNAP, pad = 1;
  const [lx0, lz0, lx1, lz1] = lot.rect;
  const ox = lx0 - pad, oz = lz0 - pad;
  const W = Math.round((lx1 - lx0 + 2 * pad) / S), H = Math.round((lz1 - lz0 + 2 * pad) / S);
  const win = [ox, oz, ox + W * S, oz + H * S];
  const solid = new Uint8Array(W * H);
  const span = rect => [Math.max(0, Math.floor((rect[0] - ox) / S + 1e-6)), Math.max(0, Math.floor((rect[1] - oz) / S + 1e-6)),
    Math.min(W, Math.ceil((rect[2] - ox) / S - 1e-6)), Math.min(H, Math.ceil((rect[3] - oz) / S - 1e-6))];
  const paint = rect => { const [a, b, c, d] = span(rect); for (let j = b; j < d; j++) for (let i = a; i < c; i++) solid[j * W + i] = 1; };
  const others = r.buildings.filter(b => b.uid !== ignoreId && solidType(b.type) && rectsOverlap(fpBuilding(b), win));
  paint(fp);
  for (const b of others) paint(fpBuilding(b));
  // Flood from every free border cell (the border ring is outside the lot: road or open land).
  const seen = new Uint8Array(W * H), queue = [];
  const push = i => { if (!solid[i] && !seen[i]) { seen[i] = 1; queue.push(i); } };
  for (let i = 0; i < W; i++) { push(i); push((H - 1) * W + i); }
  for (let j = 0; j < H; j++) { push(j * W); push(j * W + W - 1); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % W, z = (i - x) / W;
    if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (z > 0) push(i - W); if (z < H - 1) push(i + W);
  }
  // A target is reachable when one cell just outside its footprint (4 sides) was reached.
  const reachable = rect => {
    const [a, b, c, d] = span(rect);
    for (let i = a; i < c; i++) { if (b > 0 && seen[(b - 1) * W + i]) return true; if (d < H && seen[d * W + i]) return true; }
    for (let j = b; j < d; j++) { if (a > 0 && seen[j * W + a - 1]) return true; if (c < W && seen[j * W + c]) return true; }
    return false;
  };
  const targets = [...(r.fields || []).filter(f => f.id !== ignoreId && rectsOverlap(fpField(f), lot.rect)).map(fpField),
    ...others.filter(b => !BUILDINGS[b.type].decor && rectsOverlap(fpBuilding(b), lot.rect)).map(fpBuilding)];
  if (use === 'building') targets.push(fp);
  return targets.some(t => !reachable(t));
}

// ---------- counts, limits, prices (BUILDING-SYSTEM-2.0.md) ----------
/** How many of `type` stand in the current region (fields included). */
export const countOf = (s, type) => (type === 'field' ? fieldsOf(s).length : buildingsOf(s, type).length);
const limitAt = (limit, lvl) => {
  if (typeof limit === 'number') return limit;
  let n = 0;
  for (const [l, c] of Array.isArray(limit) ? limit : []) if (lvl >= l) n = Math.max(n, c);
  return n;
};
/** Max count of a type at the player's level: data-driven (BUILDINGS[].limit), fields = allowance + extra cap. */
export function maxCount(s, type) {
  const def = defOf(type);
  if (!def) return 0;
  if (type === 'field') return fieldAllowance(s) + fieldExtraCap(level(s));
  return limitAt(def.limit ?? 1, level(s));
}
/** The next player level that raises the max count of `type` (null when it never grows again). */
export function nextLimitLevel(s, type) {
  const def = defOf(type), lvl = level(s);
  if (!def) return null;
  if (type === 'field') return fieldExtraCap(lvl + 1) > fieldExtraCap(lvl) ? lvl + 1 : null;
  if (!Array.isArray(def.limit)) return null;
  const now = limitAt(def.limit, lvl);
  const row = def.limit.find(([l, c]) => l > lvl && c > now);
  return row ? row[0] : null;
}
/** Price of the next copy: cost × costGrowth^(copies already built), rounded to 5. Fields: fieldCost. */
export function buildCost(s, type) {
  const def = defOf(type);
  if (!def) return 0;
  if (type === 'field') return fieldCost(s);
  return Math.round(def.cost * (def.costGrowth || 1) ** countOf(s, type) / 5) * 5;
}
export function buildError(s, type) {
  const def = defOf(type);
  if (!def || def.starter || def.retired) return 'unknown';
  // One game per region (core-enforced): farm things only in a farm region, café things only in a café region.
  const mode = region(s)?.mode;
  if ((mode === 'cafe' && def.zone === 'farm') || (mode === 'farm' && def.zone === 'shop')) return 'gameLocked';
  if (s.player.round < def.round) return 'round';
  if (level(s) < def.level) return 'level';
  if (countOf(s, type) >= maxCount(s, type)) return 'limit';
  if (s.player.coins < buildCost(s, type)) return 'coins';
  return null;
}
/** Coins spent on a building so far (price paid + upgrades); old buildings without `spent` use the price table. */
export const spentOn = b => {
  if (Number.isFinite(b?.spent)) return b.spent;
  const def = own(BUILDINGS, b?.type);
  return def ? def.cost + (def.upgrade || []).slice(0, Math.max(0, (b.level | 0) - 1)).reduce((a, c) => a + c, 0) : 0;
};
/** Why a field / building cannot be removed: null = ok | 'unknown' | 'fixed' | 'fieldBusy' | 'jobBusy' | 'storageFull'. */
export function removeError(s, id) {
  const r = region(s);
  if (!r || typeof id !== 'string') return 'unknown';
  if ((r.fields || []).some(f => f.id === id)) return own(r.plots, id) ? 'fieldBusy' : null;
  const b = r.buildings.find(x => x.uid === id);
  const def = b && own(BUILDINGS, b.type);
  if (!def) return 'unknown';
  if (def.starter || def.fixed || !(def.refund > 0)) return 'fixed';
  if (b.job) return 'jobBusy';
  const cap = pick(def.effect?.capacity, b.level);
  if (cap && stored(s) > capacity(s) - cap) return 'storageFull'; // removing a barn must not leave goods over capacity
  return null;
}
/** Coins back for removing `id`: def.refund × coins spent (fields: fieldRefund). Never more than was paid. */
export function removeRefund(s, id) {
  const r = region(s);
  if (!r) return 0;
  if ((r.fields || []).some(f => f.id === id)) return fieldRefund(s);
  const b = r.buildings.find(x => x.uid === id);
  const def = b && own(BUILDINGS, b.type);
  return def ? Math.floor((def.refund || 0) * spentOn(b)) : 0;
}

// ---------- production (FARM-ECONOMY-BALANCE.md) ----------
/** The recipe a building runs (null for non-producers). */
export const recipeOf = b => own(RECIPES, own(BUILDINGS, b?.type)?.recipe) || null;
export const prodSpeed = b => pick(own(BUILDINGS, b?.type)?.effect?.speed, b?.level) || 1;
export const batchOf = b => pick(own(BUILDINGS, b?.type)?.effect?.batch, b?.level) || 1;
/** One batch at the building's level: inputs, outputs, fee, duration (ms) and XP, all × batch. */
export function recipeIO(b) {
  const rc = recipeOf(b);
  if (!rc) return null;
  const n = batchOf(b);
  const scale = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v * n]));
  return { recipe: rc.id, n, in: scale(rc.in), out: scale(rc.out), fee: rc.fee * n, ms: Math.round(rc.seconds * 1000 / prodSpeed(b)), xp: rc.xp * n };
}
/** 'idle' | 'working' | 'ready' + progress of a building's batch (durations are fixed when the batch starts). */
export function jobState(b, now) {
  const j = b?.job;
  if (!j) return { stage: 'idle', ratio: 0, remainingMs: 0, out: null };
  const left = Math.max(0, j.at + j.ms - now);
  return { stage: left <= 0 ? 'ready' : 'working', ratio: j.ms > 0 ? Math.min(1, Math.max(0, (now - j.at) / j.ms)) : 1, remainingMs: left, out: j.out };
}
/** The first input the building lacks for one batch ({ good, need, have }) or null. */
export function missingInput(s, b) {
  const io = recipeIO(b);
  if (!io) return null;
  for (const [good, need] of Object.entries(io.in)) { const have = Math.floor(goodCount(s, good)); if (have < need) return { good, need, have }; }
  return null;
}
/** Why a batch cannot start: null | 'unknown' | 'noRecipe' | 'gameLocked' | 'jobBusy' | 'noInput' | 'coins'. */
export function prodError(s, b) {
  if (!b) return 'unknown';
  const io = recipeIO(b);
  if (!io) return 'noRecipe';
  if (region(s)?.mode === 'cafe') return 'gameLocked';
  if (b.job) return 'jobBusy';
  if (missingInput(s, b)) return 'noInput';
  if (s.player.coins < io.fee) return 'coins';
  return null;
}
/** Why a batch cannot be collected now: null | 'unknown' | 'notDone' | 'storageFull' (soft cap: one batch may overflow). */
export function collectError(s, b, now) {
  if (!b?.job) return 'unknown';
  if (now < b.job.at + b.job.ms) return 'notDone';
  if (stored(s) >= capacity(s)) return 'storageFull';
  return null;
}

// ---------- tiles: derived per-tile metadata of the farm (ARCHITECTURE §2.2) ----------
// SNAP-sized tiles over the farm BOUNDS, rasterised once per region object from lots, roads and placed objects.
const FARM_LOTS = Object.values(PARCELS).filter(p => areaOfParcel(p.id) === 'farm');
const ROAD_LIST = Object.values(ROADS);
export function farmTiles(s) {
  const r = region(s);
  const m = r ? memoOf(r) : null;
  if (m?.tiles) return m.tiles;
  const S = SNAP, minX = BOUNDS.minX, minZ = BOUNDS.minZ;
  const w = Math.round((BOUNDS.maxX - minX) / S), h = Math.round((BOUNDS.maxZ - minZ) / S);
  const lot = new Int16Array(w * h).fill(-1), ground = new Uint8Array(w * h), occ = new Int32Array(w * h).fill(-1);
  const occupants = [];
  const span = rect => [Math.max(0, Math.floor((rect[0] - minX) / S + 1e-6)), Math.max(0, Math.floor((rect[1] - minZ) / S + 1e-6)),
    Math.min(w, Math.ceil((rect[2] - minX) / S - 1e-6)), Math.min(h, Math.ceil((rect[3] - minZ) / S - 1e-6))];
  const fill = (rect, arr, v) => { const [a, b, c, d] = span(rect); for (let j = b; j < d; j++) for (let i = a; i < c; i++) arr[j * w + i] = v; };
  FARM_LOTS.forEach((p, i) => fill(p.rect, lot, i));
  for (const rd of ROAD_LIST) fill(rd.rect, ground, 1);
  for (const res of RESERVED) if (areaAt(res.rect[0], res.rect[1]) === 'farm') fill(res.rect, ground, 2);
  if (r) {
    for (const f of r.fields || []) { occupants.push({ kind: 'field', id: f.id, type: 'field' }); fill(fpField(f), occ, occupants.length - 1); }
    for (const b of r.buildings) if (own(BUILDINGS, b.type) && areaAt(b.x, b.z) === 'farm') { occupants.push({ kind: 'building', id: b.uid, type: b.type }); fill(fpBuilding(b), occ, occupants.length - 1); }
  }
  const out = { size: S, minX, minZ, w, h, lot, ground, occ, occupants, lots: FARM_LOTS };
  if (m) m.tiles = out;
  return out;
}
/**
 * Metadata of the farm tile under (x, z): { id, gx, gz, x, z, elevation, terrain, lot, owned, unlock, occupant, uses,
 * restriction, walkable } — terrain road | plaza | meadow | garden | pasture | orchard | pond | hill | wild; unlock
 * owned | forSale | none; uses = what may be placed on this free owned tile; restriction = why nothing can (err code).
 */
export function tileAt(s, x, z) {
  const t = farmTiles(s);
  const gx = Math.floor((x - t.minX) / t.size), gz = Math.floor((z - t.minZ) / t.size);
  if (gx < 0 || gz < 0 || gx >= t.w || gz >= t.h) return null;
  const i = gz * t.w + gx;
  const lotDef = t.lot[i] >= 0 ? t.lots[t.lot[i]] : null;
  const owned = !!lotDef && !!region(s)?.parcels.includes(lotDef.id);
  const occupant = t.occ[i] >= 0 ? t.occupants[t.occ[i]] : null;
  const terrain = t.ground[i] === 1 ? 'road' : t.ground[i] === 2 ? 'plaza' : lotDef ? terrainOfLot(lotDef.id) : 'wild';
  const restriction = terrain === 'road' ? 'onRoad' : terrain === 'plaza' ? 'blocked' : !lotDef ? 'outside' : !owned ? 'notOwned'
    : occupant ? (occupant.kind === 'field' ? 'onField' : 'overlap') : null;
  return {
    id: `${gx},${gz}`, gx, gz, x: t.minX + (gx + .5) * t.size, z: t.minZ + (gz + .5) * t.size,
    elevation: terrain === 'hill' ? .6 : 0, terrain, lot: lotDef?.id || null, owned,
    unlock: owned ? 'owned' : lotDef ? 'forSale' : 'none', occupant,
    uses: restriction ? [] : [...(TERRAIN_USES[terrain] || [])], restriction,
    walkable: !(occupant?.kind === 'building' && solidType(occupant.type)),
  };
}

export function upgradeCost(type, currentLevel) {
  const list = BUILDINGS[type]?.upgrade || [];
  return currentLevel >= 1 && currentLevel <= list.length ? list[currentLevel - 1] : null;
}
export function upgradeError(s, b) {
  if (!b) return 'unknown';
  const def = BUILDINGS[b.type];
  if (def.decor) return 'maxLevel';
  const cost = upgradeCost(b.type, b.level);
  if (cost === null) return 'maxLevel';
  if (b.level >= levelCap(s)) return 'roundCap';
  if (s.player.coins < cost) return 'coins';
  return null;
}

export function parcelError(s, parcelId) {
  const p = own(PARCELS, parcelId);
  const r = region(s);
  if (!p || !r) return 'unknown';
  if (r.parcels.includes(parcelId)) return 'owned';
  // No level gate, no road needed: any lot, coins only.
  if (s.player.coins < p.cost) return 'coins';
  return null;
}
export function roadError(s, roadId) {
  const road = own(ROADS, roadId);
  if (!road || !region(s)) return 'unknown';
  if (roadOpen(s, roadId)) return 'owned';
  return 'road'; // roads are never bought: they open with the lots beside them
}

// ---------- staff: hiring, slots, bench (docs/design/staff-manager.md §1) ----------
const isRobot = u => STAFF[u?.type]?.kind === 'robot';
const isWorkerUnit = u => STAFF[u?.type]?.kind === 'worker';
/** Units of a game zone ('farm' | 'shop') on the whole team (for the soft cap). */
export const zoneUnits = (s, zone) => s.staff.units.filter(u => STAFF[u.type]?.zone === zone);
/** Working slots of a zone here: the player level (counted per game). */
export const slots = (s, _zone) => hireLimit(level(s));
/** Units on shift (active) in the current region's zone. */
export const activeCount = (s, zone) => assignedUnits(s, s.world.currentRegion, zone).filter(u => u.active).length;
export const freeSlots = (s, zone) => Math.max(0, slots(s, zone) - activeCount(s, zone));
/** Bench of the current region's zone (assigned here, not on shift). */
export const benchUnits = (s, zone) => assignedUnits(s, s.world.currentRegion, zone).filter(u => !u.active);
/** Units that really work now (on shift and not blocked). */
export const workingUnits = (s, zone, now = null) => assignedUnits(s, s.world.currentRegion, zone).filter(u => unitWorking(u, now));

// Hiring cap (user rule, 2026-11-07): a zone's team (workers + robots, all regions) is at most the player level, so the
// team never outgrows the working slots and nobody waits on the bench just for being one hire too many. Saves that
// already have more keep them (nobody is fired); they just cannot hire until the level catches up.
export const hireCap = (s, _zone) => hireLimit(level(s));
export const hireCapReached = (s, zone) => zoneUnits(s, zone).length >= hireCap(s, zone);
export function staffError(s, type) {
  const def = own(STAFF, type);
  if (!def) return 'unknown';
  if (s.player.round < def.round) return 'round';
  if (level(s) < def.level) return 'level';
  if (hireCapReached(s, def.zone)) return 'hireLimit';
  if (zoneUnits(s, def.zone).length >= STAFF_CAP.perZone) return 'teamFull';
  if (!freeHire(s) && s.player.coins < def.cost) return 'coins';
  return null;
}
/** Hires left in the zone with more room (cap = player level per zone, see hireCap). */
export const hiresLeft = s => Math.max(0, ...['farm', 'shop'].map(z => Math.min(hireCap(s, z), STAFF_CAP.perZone) - zoneUnits(s, z).length));
/** A free-hire ticket (level gift / chest) is used on the next hire. */
export const freeHire = s => (s.rewards?.tickets || 0) > 0;
export const hireCost = (s, type) => (freeHire(s) ? 0 : STAFF[type]?.cost ?? 0);
// ---------- recruitment ----------
/** The applicant board of a game zone ('farm' | 'shop'): RECRUIT.size applicants drawn from the saved seed. */
export const poolOf = (s, zone) => s.staff.pool?.[zone] || { seed: zone === 'shop' ? 2 : 1, at: 0 };
export const applicants = (s, zone) => applicantsFor(zone, poolOf(s, zone).seed);
/** ms until the board refreshes for free (0 = due now). */
export const poolRefreshIn = (s, zone, now) => Math.max(0, poolOf(s, zone).at + RECRUIT.refreshMinutes * 60000 - now);
export const recruitCost = (s, a) => (freeHire(s) ? 0 : a.cost);
export function recruitError(s, zone, index) {
  const a = RECRUIT.worker[zone] && applicants(s, zone)[index];
  if (!a) return 'unknown';
  const def = STAFF[a.type];
  if (s.player.round < def.round) return 'round';
  if (level(s) < def.level) return 'level';
  if (hireCapReached(s, zone)) return 'hireLimit';
  if (zoneUnits(s, zone).length >= STAFF_CAP.perZone) return 'teamFull';
  if (!freeHire(s) && s.player.coins < a.cost) return 'coins';
  return null;
}
// ---------- quality ★ ----------
/** Stars a staff unit's work gets (robot 1; worker 2 from accuracy QUALITY.workerTwoStar or with goldHands, else 1). */
export const unitStars = u => (isWorkerUnit(u) && (u.perk === 'goldHands' || statOf(u, 'accuracy') >= QUALITY.workerTwoStar) ? 2 : 1);
/** May this unit brew `drink`? Hard drinks: workers with accuracy QUALITY.hardLevel only, never robots. No unit = the player. */
export const canBrew = (u, drink) => !u || !isHardDrink(drink) || (isWorkerUnit(u) && statOf(u, 'accuracy') >= QUALITY.hardLevel);
export const starPrice = (s, drink, stars) => Math.round(drinkPrice(s, drink) * (QUALITY.price[stars] || 1));
export const starYield = (s, crop, stars) => Math.max(1, Math.round(yieldOf(s, crop) * (QUALITY.yield[stars] || 1)));

// ---------- worker stats / robot hardware ----------
export const unitOf = (s, uid) => s.staff.units.find(u => u.uid === uid) || null;
/** Why `stat` of worker `u` cannot be raised now (null = it can): unknown | maxLevel | cap | points | coins. */
export function statError(s, u, stat) {
  if (!isWorkerUnit(u) || !STAT_ORDER.includes(stat)) return 'unknown';
  const n = statOf(u, stat);
  if (n >= SKILL.maxStat) return 'maxLevel';
  if (n >= statCap(u, stat)) return 'cap';
  const c = statCost(n);
  if ((u.points || 0) < c.points) return 'points';
  if (s.player.coins < c.coins) return 'coins';
  return null;
}
/** Price of the next step of `stat`: { points, coins } (null at the top). */
export const statPrice = (u, stat) => (statOf(u, stat) >= SKILL.maxStat ? null : statCost(statOf(u, stat)));
/** Stats of `u` that can be raised right now. */
export const upgradableStats = (s, u) => STAT_ORDER.filter(k => !statError(s, u, k));
// Compatibility with the old single-level training (HUD sheet / toolbar dot): "trainable" = some stat can be raised.
/** XP per skill point (null for robots). */
export const trainNeed = u => (isWorkerUnit(u) ? SKILL.xpPerPoint : null);
export const trainLevel = () => 0;
/** Coins of the cheapest stat step still open (0 when none). */
export const trainFee = u => { const c = STAT_ORDER.filter(k => statOf(u, k) < Math.min(SKILL.maxStat, statCap(u, k))).map(k => statCost(statOf(u, k)).coins); return c.length ? Math.min(...c) : 0; };
/** null when some stat can be raised now; else the error of the cheapest step (maxLevel when every stat is full). */
export function trainError(s, u) {
  if (!isWorkerUnit(u)) return 'unknown';
  const errs = STAT_ORDER.map(k => statError(s, u, k));
  if (errs.includes(null)) return null;
  const open = STAT_ORDER.filter((k, i) => errs[i] !== 'maxLevel' && errs[i] !== 'cap').sort((a, b) => statOf(u, a) - statOf(u, b));
  return open.length ? statError(s, u, open[0]) : 'maxLevel';
}
/** Workers that can raise a stat right now (for the toolbar dot). */
export const trainable = s => s.staff.units.filter(u => !trainError(s, u));
export function partError(s, u, part) {
  if (!u || !isRobot(u) || !PART_ORDER.includes(part)) return 'unknown';
  const tier = partTier(u, part);
  if (tier >= PART_COST.maxTier) return 'maxLevel';
  if (tier + 1 >= PART_COST.maxTier && level(s) < PART_COST.tier3Level) return 'level';
  if (s.player.coins < partCost(u.type, tier)) return 'coins';
  return null;
}
export const partPrice = (u, part) => partCost(u.type, partTier(u, part));
export const taskError = (u, task) => (!u || !ROBOT_TASKS[u.type] ? 'unknown' : task === 'auto' || ROBOT_TASKS[u.type].includes(task) ? null : 'unknown');
/** Worker tasks (staff/setTasks): null = valid; 'unknown' | 'tooMany'. `tasks` must already be deduped. */
export function tasksError(u, tasks) {
  if (!isWorkerUnit(u) || !Array.isArray(tasks)) return 'unknown';
  const allowed = WORKER_TASKS[STAFF[u.type].zone] || [];
  if (!tasks.every(t => typeof t === 'string' && allowed.includes(t))) return 'unknown';
  if (tasks.length > taskLimit(u)) return 'tooMany';
  return null;
}
/** Job types a unit takes: a worker's tasks ([] = any), a robot's one task (null = auto). */
export const unitTasks = u => (isWorkerUnit(u) ? (Array.isArray(u.tasks) ? u.tasks : []) : u?.task && u.task !== 'auto' ? [u.task] : []);

// ---------- vitals / states (§3, §4) ----------
// Priority order of the shown state; BLOCKING ones stop all work (hungry / tired only slow it down, unless at 0).
export const UNIT_STATES = ['phone', 'battery', 'overheat', 'jam', 'lunch', 'sulking', 'hungry', 'tired', 'ok'];
const BLOCKING = new Set(['phone', 'battery', 'overheat', 'jam', 'lunch', 'sulking']);
/** An overheat stop whose cool-down is over counts as cleared (the next vitals / care removes it from the save). */
const stopKind = (u, now) => (!u?.stopped ? null : u.stopped.kind === 'overheat' && now != null && Number.isFinite(u.stopped.until) && now >= u.stopped.until ? null : u.stopped.kind || 'phone');
const onLunch = (u, now) => Number.isFinite(u?.breakUntil) && (now == null || now < u.breakUntil);
/** The state shown for a unit: phone | battery | overheat | jam | lunch | sulking | hungry | tired | ok. */
export function unitState(u, now = null) {
  const k = stopKind(u, now);
  if (k) return UNIT_STATES.includes(k) ? k : 'phone';
  if (onLunch(u, now)) return 'lunch';
  if (!isWorkerUnit(u)) return 'ok';
  if ((u.morale ?? VITALS.start.morale) < VITALS.sulkBelow) return 'sulking';
  if ((u.fullness ?? 100) < VITALS.hungryBelow) return 'hungry';
  if ((u.energy ?? 100) < VITALS.tiredBelow) return 'tired';
  return 'ok';
}
/** No work at all: a blocking state, or starving / exhausted (fullness or energy at 0). */
export const unitBlocked = (u, now = null) => {
  const st = unitState(u, now);
  return BLOCKING.has(st) || (isWorkerUnit(u) && ((u.fullness ?? 100) <= 0 || (u.energy ?? 100) <= 0));
};
/** Speed factor of the state (realm): hungry ×0.7, tired ×0.6, blocked 0. */
export const stateSpeedMul = (u, now = null) => (unitBlocked(u, now) ? 0 : unitState(u, now) === 'hungry' ? VITALS.hungryMul : unitState(u, now) === 'tired' ? VITALS.tiredMul : 1);
/** Flags behind the state (a hungry worker can also be tired: care buttons look at these, not the top state). */
export const needs = u => ({
  tired: isWorkerUnit(u) && (u.energy ?? 100) < VITALS.tiredBelow,
  hungry: isWorkerUnit(u) && (u.fullness ?? 100) < VITALS.hungryBelow,
  sulking: isWorkerUnit(u) && (u.morale ?? VITALS.start.morale) < VITALS.sulkBelow,
});
export { energyMax };

// ---------- care (§3) ----------
export const CARE_KINDS = ['nag', 'bonusSmall', 'coffee', 'food', 'lunch', 'bonus', 'rest', 'recharge', 'cool', 'knock', 'repair', 'service'];
/** Coin price of a care action for `u` (0 = free). */
export function careCost(u, kind) {
  switch (kind) {
    case 'bonusSmall': case 'recharge': return u?.stopped?.fee ?? unitFee(u);
    case 'coffee': return CARE.coffee;
    case 'food': return CARE.food;
    case 'bonus': return CARE.bonus;
    case 'cool': return CARE.cool;
    case 'repair': return CARE.repair;
    case 'service': return Math.round((STAFF[u?.type]?.cost || 0) * CARE.serviceRatio);
    default: return 0;
  }
}
/** Why care `kind` does not apply to `u` now (null = it does): unknown | notNeeded | coins. */
export function careError(s, u, kind, now = null) {
  if (!u || !CARE_KINDS.includes(kind)) return 'unknown';
  const st = unitState(u, now), n = needs(u), worker = isWorkerUnit(u);
  const ok = {
    nag: worker && st === 'phone', bonusSmall: worker && st === 'phone',
    coffee: worker && n.tired, food: worker && n.hungry, lunch: worker && n.hungry && st !== 'lunch',
    bonus: worker && (u.morale ?? VITALS.start.morale) < 100, rest: worker && !!u.active && (n.tired || n.sulking),
    recharge: !worker && st === 'battery', cool: !worker && st === 'overheat',
    knock: !worker && st === 'jam', repair: !worker && st === 'jam', service: !worker && (u.wear ?? 100) < 100,
  }[kind];
  if (!ok) return 'notNeeded';
  if (s.player.coins < careCost(u, kind)) return 'coins';
  return null;
}
/** The paid fix of a unit's current problem (HUD "Xử lý tất cả" / fee bubble): { kind, cost } or null. */
export function quickFix(u, now = null) {
  const st = unitState(u, now);
  const kind = { phone: 'bonusSmall', battery: 'recharge', overheat: 'cool', jam: 'repair', sulking: 'bonus', hungry: 'food', tired: 'coffee' }[st];
  return kind ? { kind, cost: careCost(u, kind) } : null;
}

// ---------- upkeep, fire, books (§2, §8) ----------
/** Coins a benched worker costs per UPKEEP.perMinutes (robots and working staff: 0). */
export const upkeepOf = u => (isWorkerUnit(u) && !u.active ? UPKEEP.benchRatio * STAFF[u.type].cost : 0);
/** Upkeep of a zone's bench here per UPKEEP.perMinutes (no zone = the whole team). */
export const upkeepPer = (s, zone) => (zone ? assignedUnits(s, s.world.currentRegion, zone) : s.staff.units).reduce((n, u) => n + upkeepOf(u), 0);
/** Coins back when firing a worker / selling a robot. */
export const fireRefund = u => Math.round(isRobot(u) ? FIRE.robot * (u.paid || 0) + FIRE.robotParts * (u.partsSpent || 0) : FIRE.worker * (u?.paid || 0));
/** Team earned / spent over the last `minutes` game minutes (ledger). */
export const ledgerWindow = (s, now, minutes = BOOKS.mvpMinutes) => {
  const from = Math.floor(now / 60000) - minutes + 1;
  return (s.staff.ledger || []).filter(e => e.min >= from).reduce((a, e) => ({ earned: a.earned + e.earned, spent: a.spent + e.spent }), { earned: 0, spent: 0 });
};
/** A unit's profit so far (book). */
export const unitProfit = u => (u?.book?.earned || 0) - (u?.book?.spent || 0);
/** The rival's poach in progress (null when none). */
export const poachOf = s => s.staff.poach || null;

// ---------- level gifts ----------
/** Levels reached whose gift box has not been opened yet (lowest first). */
export const pendingGifts = s => {
  const done = new Set(s.rewards?.claimed || []);
  const out = [];
  for (let l = 2; l <= level(s); l++) if (!done.has(l)) out.push(l);
  return out;
};
export const isChestLevel = lvl => CHEST_LEVELS.includes(lvl);

// ---------- loan ----------
export const loanOf = s => (s.loan && s.loan.owed > 0 ? s.loan : null);
export function loanError(s, amount) {
  if (!LOAN.packs.includes(amount)) return 'unknown';
  return null;
}
export const loanQuote = amount => ({ amount, owed: loanOwed(amount) });

// Region availability on the world map. Every region can be opened with coins (no Rounds).
// Free: the very first region of the game, and one new region right after the Level-10 expiration (no softlock).
export const ownsRegion = (s, regionId) => (s.world.ownedRegions || []).includes(regionId);
export function regionUnlockCost(s, regionId) {
  const cost = regionCost(regionId);
  if (cost === null) return null;
  if ((s.world.ownedRegions || []).length === 0 || (s.world.freeUnlocks || 0) > 0) return 0;
  return cost;
}
export function regionAccess(s, regionId) {
  if (!parseRegionId(regionId)) return { ok: false, reason: 'unknown' };
  const r = s.world.regions[regionId];
  const expired = r?.status === 'expired';
  // Right after the Level-10 incident the player must start somewhere else.
  if (expired && s.story.phase === 'chooseRegion') return { ok: false, reason: 'expired', owned: false };
  if (!ownsRegion(s, regionId)) {
    const cost = regionUnlockCost(s, regionId);
    return { ok: false, reason: 'locked', cost, free: cost === 0, affordable: s.player.coins >= cost, missing: Math.max(0, cost - s.player.coins) };
  }
  // Right after the Level-10 expiration the player must move on to a different region.
  if (expired && s.story.phase === 'chooseRegion') return { ok: false, reason: 'expired', owned: true };
  if (s.world.currentRegion === regionId) return { ok: true, owned: true, current: true };
  return { ok: true, owned: true, visited: !!r, expired };
}
// Café seats: terrace seats + 2 per Tables building. Orders being prepared (taken/brewing) occupy a seat.
export const seatCount = s => (effect(s, 'terrace', 'seats') || SHOP.baseSeats) + buildingsOf(s, 'tables').length * SHOP.seatsPerTable;
// Seated-customer patience (0 → 1 as time runs out). Orders saved before takenAt existed start counting at brewStart/at.
export const seatPatienceRatio = (o, now) => {
  if (o.stage !== 'taken' && o.stage !== 'brewing') return 0;
  const since = o.takenAt ?? o.brewStart ?? o.at ?? now;
  return Math.max(0, Math.min(1, (now - since) / (SHOP.seatPatienceSeconds * 1000)));
};
export const seatPatienceOver = (o, now) => seatPatienceRatio(o, now) >= 1;
export const seatsUsed = s => (region(s)?.shop.orders || []).filter(o => o.stage === 'taken' || o.stage === 'brewing').length;
export const regionsOfCountry = citiesOf; // one region per city
export const allCountries = () => COUNTRY_ORDER;

export function rebirthError(s, blessingKey) {
  if (own(REBIRTH.blessings, blessingKey) === undefined) return 'unknown';
  if (s.rebirth.credits <= 0) return 'noCredits';
  if (level(s) < REBIRTH.minLevel) return 'level';
  if ((s.rebirth.blessings[blessingKey] || 0) >= REBIRTH.maxStacks) return 'maxStacks';
  return null;
}

// ---------- café street: 4 shops (docs/design/cafe-street.md) ----------
// 'cafe' is always open; lemon / tea / bar are unlocked per region by shop/openVenue (region.street.open).
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const venueOpen = (s, id) => id === 'cafe' || (!!own(VENUES, id) && !!region(s)?.street?.open?.includes(id));
/** Why venue `id` cannot be opened now: null = can open | 'unknown' | 'owned' (already open) | 'level' | 'coins'. */
export function venueError(s, id) {
  const def = own(VENUES, id);
  if (!def || id === 'cafe' || !region(s)) return 'unknown';
  if (venueOpen(s, id)) return 'owned';
  if (level(s) < def.level) return 'level';
  if (s.player.coins < def.cost) return 'coins';
  return null;
}
/** A shop's rating (1..5★ moving average); RATING.start until reviewed. */
export const venueRating = (s, id) => {
  const v = own(region(s)?.street?.rating, id)?.avg;
  return Number.isFinite(v) ? v : RATING.start;
};
export const venueReviews = (s, id) => own(region(s)?.street?.rating, id)?.n || 0;
/** Walk-in rate multiplier from the rating: 1 at RATING.start, more customers above, fewer below (clamped). */
export const ratingFactor = (s, id = 'cafe') => clamp(1 + (venueRating(s, id) - RATING.start) * RATING.arrivalPerStar, RATING.minFactor, RATING.maxFactor);
/** Item ids a venue sells ([] for the café / unknown ids). */
export const venueItems = id => own(VENUES, id)?.items || [];
export const venueItem = id => own(VENUE_ITEMS, id);
/** Walk-in interval (ms) of a non-café venue, rating included. Unknown / café → 0. */
export const venueArrivalMs = (s, id) => {
  const def = own(VENUES, id);
  return def?.arrivalSeconds ? Math.round(def.arrivalSeconds * 1000 / ratingFactor(s, id)) : 0;
};
/** Open shops in unlock order, café first. */
export const openVenues = s => ['cafe', ...VENUE_ORDER.filter(id => venueOpen(s, id))];
