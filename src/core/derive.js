// Pure selectors over the v3 save. No mutation. Used by the reducer, the scene and the HUD.
import { FOLLOW, GM, gmCandidatesFor, gmSalary, SHIFT, TEND, PROFILE, CAREER, rankOf, GEAR, gearTier, WARRANTY, SOFTWARE, softwarePrice, hasSoftware, TUTORIAL, BUILDINGS, CROPS, CROP_ORDER, DRINKS, DRINK_ORDER, STAFF, hireLimit, STAFF_CAP, RECRUIT, applicantsFor, traitEffect, MISTAKES, QUALITY, isHardDrink, unitLevel, levelSpeed, statOf, statCap, statCost, STAT_ORDER, SKILL, ROBOT_TASKS, PART_COST, PART_ORDER, partTier, partCost, UPKEEP, VITALS, CARE, ROBOT_WEAR, WORKER_TASKS, taskLimit, energyMax, unitFee, FIRE, BOOKS, CHEST_LEVELS, LOAN, loanOwed, ROUND_LEVEL_CAP, REBIRTH, CELL, levelForXp, xpForLevel, GRACE, SHOP, BEANS, VENUES, VENUE_ORDER, VENUE_ITEMS, RATING, FIELD, fieldExtraCost, fieldExtraCap, GOODS, GOOD_ORDER, ITEM_GOODS, RECIPES } from './config/economy.js';
import { PARCELS, ROADS, RESERVED, BOUNDS, GATE, areaOfParcel, areaAt, rectsOverlap, rectsTouch, inRect, terrainOfLot, lotAllows, TERRAIN_USES, PRE_TILLED, SNAP, lotContaining } from './config/layout.js';
import { countryRecipes, INGREDIENTS, INGREDIENT_ORDER, RESEARCH, SUPPLY, supplierOf, buyerOf, FARMLAB, methodEffect, methodKey } from './config/research.js';
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
  const way = Array.isArray(p.method) && s.world?.currentRegion ? methodEffect(s.world.currentRegion, p.crop, p.method).timeMul : 1; // research step 3
  return p.fast ? Math.min(TUTORIAL.firstGrowSeconds * 1000, base) : Math.round(base * way * (p.slow ? MISTAKES.crookedSlow : 1));
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
  return { good, amount: n, coins: Math.round(n * GOODS[good].price * (buyerNow(s).mul[good] ?? 1) * 100) / 100 }; // the chosen buyer's price
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
  const unit = Math.round(BEANS.buyPrice * supplyOf(s, 'beans').priceMul * 100) / 100; // the beans supplier's price
  const n = Math.min(want, Math.floor(s.player.coins / unit));
  if (n > 0) return { amount: n, cost: Math.round(n * unit * 100) / 100, free: false, error: null, unit };
  const brewing = (r?.shop.orders || []).some(o => o.stage === 'brewing');
  if (s.inventory.beans < 1 && !brewing) return { amount: Math.min(room, BEANS.grace), cost: 0, free: true, error: null };
  return { amount: 0, cost: want * unit, free: false, error: 'coins', missing: unit - s.player.coins };
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
    case 'repair': return warrantyLeft(u) > 0 ? 0 : CARE.repair; // free while under warranty
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
// Bench worker: upkeep; a lead / manager on shift: its allowance (CAREER.allowance), both per UPKEEP.perMinutes.
export const upkeepOf = u => (u?.follower ? followerWage(u) : !isWorkerUnit(u) ? 0 : !u.active ? UPKEEP.benchRatio * STAFF[u.type].cost : CAREER.allowance[rankOf(u)] || 0);
/** Wage of a unit that followed you through the Level-10 restart (FOLLOW), per UPKEEP.perMinutes, on or off shift. */
export const followerWage = u => (isRobot(u) ? FOLLOW.robotWage : Math.max(FOLLOW.minWage, Math.round(FOLLOW.wageRatio * (STAFF[u.type]?.cost || 0))));
/** Who asks to follow you at the Level-10 restart (roll < FOLLOW.robotChance and robots owned → the busiest robot,
 *  else the worker with the highest morale, then level); null with no staff. */
export function followerCandidate(s, roll = 1) {
  const units = s.staff.units, robots = units.filter(isRobot), workers = units.filter(isWorkerUnit);
  if (robots.length && (roll < FOLLOW.robotChance || !workers.length)) return [...robots].sort((a, b) => (b.book?.jobs || 0) - (a.book?.jobs || 0))[0];
  return [...workers].sort((a, b) => (b.morale ?? 0) - (a.morale ?? 0) || unitLevel(b) - unitLevel(a))[0] || null;
}
/** Upkeep of a zone's bench here per UPKEEP.perMinutes (no zone = the whole team). */
export const upkeepPer = (s, zone) => (zone ? assignedUnits(s, s.world.currentRegion, zone) : s.staff.units).reduce((n, u) => n + upkeepOf(u), 0);
/** Coins back when firing a worker / selling a robot. */
// Robots: (price + parts + software shares) × wear / 100 (a worn robot sells for less). Workers: hire share + half the gear.
export const fireRefund = u => Math.round(isRobot(u)
  ? (FIRE.robot * (u.paid || 0) + FIRE.robotParts * (u.partsSpent || 0) + SOFTWARE.refund * (u.softwareSpent || 0)) * Math.max(0, Math.min(100, u.wear ?? 100)) / 100
  : FIRE.worker * (u?.paid || 0)); // a fired worker's gear stays in the store (gearStock) for the next hire
/** Team earned / spent over the last `minutes` game minutes (ledger). */
export const ledgerWindow = (s, now, minutes = BOOKS.mvpMinutes) => {
  const from = Math.floor(now / 60000) - minutes + 1;
  return (s.staff.ledger || []).filter(e => e.min >= from).reduce((a, e) => ({ earned: a.earned + e.earned, spent: a.spent + e.spent }), { earned: 0, spent: 0 });
};
/** A unit's profit so far (book). */
export const unitProfit = u => (u?.book?.earned || 0) - (u?.book?.spent || 0);
// ---------- personnel file (docs/design/staff-profile.md) ----------
/** Local calendar day of a timestamp as a number 20261107 (the key of a unit's day rows). */
export const dayKey = now => { const d = new Date(now); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
/** The `n` calendar days ending today, oldest first (day keys). */
export const lastDays = (now, n = PROFILE.daysKeep) => Array.from({ length: n }, (_, i) => {
  const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i));
  return dayKey(d.getTime());
});
/** A unit's numbers of one day (null when it has none). */
export const dayRow = (u, key) => (u?.days || []).find(r => r.d === key) || null;
const ROW_KEYS = ['jobs', 'earned', 'spent', 'capex', 'upkeep', 'mistakes', 'shift', 'work', 'down'];
/** A unit's numbers summed over several days (a day key or a list of them); null when it has none of them. */
export const rowsOf = (u, keys) => {
  const list = (Array.isArray(keys) ? keys : [keys]).map(k => dayRow(u, k)).filter(Boolean);
  if (!list.length) return null;
  return Object.fromEntries(ROW_KEYS.map(k => [k, list.reduce((a, r) => a + (r[k] || 0), 0)]));
};
/** Whole calendar days since `from` (0 = the same day). */
export const daysSince = (from, now) => {
  const a = new Date(from), b = new Date(now);
  a.setHours(12, 0, 0, 0); b.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((b - a) / 86400000));
};
/** Running costs of a day row (what it spent minus upgrades / parts, which are investments). */
export const runCost = r => Math.max(0, (r?.spent || 0) - (r?.capex || 0));
/** KPIs of a day row: jobs per shift hour, error-free share, attendance (time on shift not lost to a blocking state),
 *  running profit (earned − running costs), running cost per hour. Null without a row. */
export function dayKpis(row) {
  if (!row) return null;
  const h = (row.shift || 0) / 3600;
  return {
    jobs: row.jobs || 0, mistakes: row.mistakes || 0, earned: row.earned || 0, spent: row.spent || 0, shift: row.shift || 0,
    perHour: h > 0 ? (row.jobs || 0) / h : 0,
    quality: row.jobs ? Math.max(0, 1 - (row.mistakes || 0) / row.jobs) : 1,
    att: row.shift > 0 ? Math.max(0, Math.min(1, 1 - (row.down || 0) / row.shift)) : 0,
    profit: (row.earned || 0) - runCost(row),
    costPerHour: h > 0 ? runCost(row) / h : 0,
  };
}
/**
 * Grade of a unit for one day: score 0..100 against the average of its zone's units that worked that day (PROFILE.grade).
 * Workers: productivity, quality, attendance, profit; robots: productivity, uptime, profit. Null below minShiftSeconds.
 * → { letter, score, parts: { prod, qual?, att, profit } }
 */
export function unitGrade(s, u, key) {
  const G = PROFILE.grade, row = rowsOf(u, key);
  if (!u || !row || (row.shift || 0) < G.minShiftSeconds) return null;
  const zone = STAFF[u.type]?.zone, robot = isRobot(u);
  const team = s.staff.units.filter(x => STAFF[x.type]?.zone === zone && isRobot(x) === robot).map(x => dayKpis(rowsOf(x, key))).filter(k => k && k.shift >= G.minShiftSeconds);
  const me = dayKpis(row);
  const avg = f => team.reduce((a, k) => a + f(k), 0) / Math.max(1, team.length);
  const clamp = v => Math.max(0, Math.min(100, v));
  const rel = (v, a) => (a > 0 ? clamp(G.par * v / a) : v > 0 ? 100 : v < 0 ? G.par / 2 : G.par);
  const profitRate = k => k.profit / (k.shift / 3600);
  const parts = { prod: rel(me.perHour, avg(k => k.perHour)), att: clamp(100 * me.att), profit: rel(profitRate(me), avg(profitRate)) };
  if (!robot) parts.qual = clamp(100 - (me.jobs ? me.mistakes / me.jobs : 0) * G.mistakeScale);
  const w = G.weights[robot ? 'robot' : 'worker'];
  const score = Math.round(Object.entries(w).reduce((a, [k, x]) => a + x * parts[k], 0));
  const letter = G.cuts.find(([, min]) => score >= min)[0];
  return { letter, score, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v)])) };
}
/** The team average of a KPI for one day (zone, same kind), for the "vs team" arrows. */
export function teamKpi(s, u, key, field) {
  const zone = STAFF[u?.type]?.zone, robot = isRobot(u);
  const list = s.staff.units.filter(x => STAFF[x.type]?.zone === zone && isRobot(x) === robot).map(x => dayKpis(rowsOf(x, key))).filter(k => k && k.shift >= PROFILE.grade.minShiftSeconds);
  return list.length ? list.reduce((a, k) => a + k[field], 0) / list.length : null;
}
/**
 * Robot payback: cost = price paid + parts; net = everything it earned − its running costs (recharges, cooling, repairs,
 * service). pct = net / cost (null when it cost nothing); etaMinutes = play minutes left at today's running profit rate.
 */
export function robotPayback(u, now) {
  const cost = (u?.paid || 0) + (u?.partsSpent || 0) + (u?.softwareSpent || 0);
  const net = (u?.book?.earned || 0) - Math.max(0, (u?.book?.spent || 0) - (u?.partsSpent || 0) - (u?.softwareSpent || 0));
  const k = dayKpis(dayRow(u, dayKey(now)));
  const rate = k && k.shift >= PROFILE.grade.minShiftSeconds ? k.profit / (k.shift / 3600) : 0; // coins per hour
  return { cost, net, pct: cost > 0 ? net / cost : null, etaMinutes: cost > 0 && net < cost && rate > 0 ? Math.ceil((cost - net) / rate * 60) : null };
}
// ---------- gear + robot extras (docs/design/staff-profile.md, step 4) ----------
/** Free jam repairs left under warranty (robots; 0 otherwise). */
export const warrantyLeft = u => (isRobot(u) ? Math.max(0, WARRANTY.repairs - (u.warrantyUsed | 0)) : 0);
/** Price of the next gear tier, or null at the top. */
export const gearPrice = (u, item) => { const t = gearTier(u, item); return t >= GEAR.maxTier ? null : GEAR.cost[t]; };
/** Why a worker cannot get the next tier of `item`: 'unknown' | 'maxLevel' | 'coins' | null. */
export function gearError(s, u, item) {
  if (!u || !isWorkerUnit(u) || !(GEAR.zone[STAFF[u.type].zone] || []).includes(item)) return 'unknown';
  const price = gearPrice(u, item);
  if (price == null) return 'maxLevel';
  return s.player.coins < price ? 'coins' : null;
}
/** Why a robot cannot get a software pack: 'unknown' | 'owned' | 'coins' | null. */
export function softwareError(s, u, pack) {
  if (!u || !isRobot(u) || !SOFTWARE.packs[pack]) return 'unknown';
  if (hasSoftware(u, pack)) return 'owned';
  return s.player.coins < softwarePrice(u, pack) ? 'coins' : null;
}
/** Gear in the store for a zone: [{ i (index in s.staff.gearStock), item, tier }]. */
export const gearStockOf = (s, zone) => (s.staff.gearStock || []).map((g, i) => ({ ...g, i })).filter(g => g.zone === zone);
/** Plots a tending worker waters (TEND.plots + its watering can). */
export const tendPlots = u => TEND.plots + GEAR.items.can.plots[gearTier(u, 'can')];
// ---------- general manager (docs/design/general-manager.md) ----------
export const gmUnlocked = s => level(s) >= GM.unlockLevel;
/** The hired GM (or null). */
export const gmOf = s => s.gm?.unit || null;
export const gmBoard = s => gmCandidatesFor(s.gm?.board?.seed ?? 1);
export const gmBoardRefreshIn = (s, now) => Math.max(0, (s.gm?.board?.at || 0) + GM.board.refreshMinutes * 60000 - now);
export const gmThinkSeconds = gm => GM.thinkSeconds[Math.max(0, Math.min(4, (gm?.skill || 1) - 1))];
/** Base salary per GM.payMinutes in the current mode. */
export const gmPay = s => (gmOf(s) ? gmSalary(gmOf(s), s.gm.mode) : 0);
/** Coins the GM may still spend on its own in the current 10-minute window (style: careful uses half). */
export function gmBudgetLeft(s, now) {
  const g = s.gm;
  if (!g?.unit) return 0;
  const cap = Math.round(g.budget * (GM.styles[g.unit.style]?.budgetMul ?? 1));
  const open = g.window && now - g.window.start < GM.windowMinutes * 60000;
  return Math.max(0, cap - (open ? g.window.spent : 0));
}
/** The game zone the GM works in now: the game on screen. */
export const gmZone = s => (regionGame(s) === 'cafe' ? 'shop' : regionGame(s) === 'farm' ? 'farm' : null);
/** Team chaos after a GM left (null when calm). */
export const chaosOf = s => s.gm?.chaos || null;
/** Slack chance factor for a zone: ×2 in chaos, ×1.5 when a Manager-rank worker holds the team together. */
export function chaosSlackMul(s, zone) {
  if (!chaosOf(s)) return 1;
  const manager = s.staff.units.some(u => STAFF[u.type]?.zone === zone && rankOf(u) === 'manager');
  return manager ? 1 + (GM.chaos.slackMul - 1) * GM.chaos.managerHalves : GM.chaos.slackMul;
}
/** Cost of the team meeting that ends the chaos. */
export const calmCost = s => GM.chaos.calmBase + GM.chaos.calmPerUnit * s.staff.units.length;
/** Someone can give advice now: a GM, or (during chaos) a Manager-rank worker standing in as advisor. */
export const gmAdvisorOf = s => gmOf(s) || (chaosOf(s) ? s.staff.units.find(u => rankOf(u) === 'manager') || null : null);

/**
 * What a manager would do now in the game on screen, best first. A manager only KEEPS things running (founder
 * feedback 2026-11-07): care, robot upkeep, shifts, selling / buying beans, keeping a lured worker. Growth — hiring,
 * firing, promoting, stats, machines, software (and later recipes, crops, suppliers) — is the player's own job: those
 * items come back as 'advice' (shown with "you do it", never run by the manager). Each item:
 *   { key, act: { type, payload }, cost, tier: 'safe' | 'budget' | 'big' | 'advice', score, reason: [i18n key, params] }
 * tier: safe = free and harmless; budget = small spending (big when cost ≥ the big-job limit); big = always big;
 * advice = only ever suggested (firing). `score` ≈ how much it matters (coins / minute saved or earned, rough).
 */
export function gmPlan(s, now) {
  const zone = gmZone(s);
  const r = region(s);
  if (!zone || !r || s.story.phase !== 'play') return [];
  const out = [];
  const bigLimit = s.gm?.bigLimit ?? GM.defaults.bigLimit;
  const add = (key, type, payload, cost, tier, score, reason, params = {}) => {
    const t = tier === 'budget' && cost >= bigLimit ? 'big' : tier;
    out.push({ key, act: { type, payload }, cost: Math.max(0, Math.round(cost || 0)), tier: t, score, reason: [reason, params] });
  };
  const name = u => u.name || null;
  // goods
  if (zone === 'farm') {
    const cap = capacity(s), st = stored(s);
    if (cap > 0 && st / cap >= 0.9) add('sell', 'farm/sellAll', {}, 0, 'safe', 60, 'storageFull', { pct: Math.round(st / cap * 100) });
  } else {
    const waiting = (r.shop.orders || []).filter(o => o.stage === 'taken' || o.stage === 'waiting');
    const need = waiting.reduce((n, o) => n + (DRINKS[o.drink]?.beans || 1), 0);
    const q = beanBuyQuote(s);
    if (need > 0 && s.inventory.beans < need && !q.error && q.amount > 0) add('beans', 'shop/buyBeans', {}, q.cost, 'budget', 55, 'beansLow', { n: q.amount });
  }
  // units of this game here
  const here = assignedUnits(s, s.world.currentRegion, zone);
  for (const u of here) {
    const st = unitState(u, now), robot = !isWorkerUnit(u), id = u.uid, nm = name(u);
    if (robot) {
      if (st === 'battery') add(`care:${id}:recharge`, 'staff/care', { uid: id, kind: 'recharge' }, careCost(u, 'recharge'), 'budget', 35, 'robotBattery', { serial: u.serial });
      else if (st === 'jam') add(`care:${id}:knock`, 'staff/care', { uid: id, kind: 'knock' }, 0, 'safe', 30, 'robotJam', { serial: u.serial });
      else if (st === 'overheat') add(`care:${id}:cool`, 'staff/care', { uid: id, kind: 'cool' }, careCost(u, 'cool'), 'budget', 8, 'robotHot', { serial: u.serial });
      if ((u.wear ?? 100) < ROBOT_WEAR.lowWear) add(`care:${id}:service`, 'staff/care', { uid: id, kind: 'service' }, careCost(u, 'service'), 'budget', 15, 'robotWorn', { serial: u.serial, wear: Math.round(u.wear) });
      // repeated trouble today → hardware / software
      const today = dayKey(now), log = (u.log || []).filter(e => dayKey(e.at) === today);
      const recharges = log.filter(e => (e.type === 'cared' || e.type === 'autoCare') && e.extra === 'recharge').length;
      const jams = log.filter(e => e.type === 'jam').length, hot = log.filter(e => e.type === 'overheat').length;
      if (recharges >= 2 && !softwareError(s, u, 'autoCharge')) add(`sw:${id}:autoCharge`, 'staff/buySoftware', { uid: id, pack: 'autoCharge' }, softwarePrice(u, 'autoCharge'), 'advice', 6, 'robotSoftCharge', { serial: u.serial, n: recharges });
      if (jams >= 2 && !softwareError(s, u, 'autoUnjam')) add(`sw:${id}:autoUnjam`, 'staff/buySoftware', { uid: id, pack: 'autoUnjam' }, softwarePrice(u, 'autoUnjam'), 'advice', 5, 'robotSoftJam', { serial: u.serial, n: jams });
      if (hot >= 1 && !partError(s, u, 'cooler')) add(`part:${id}:cooler`, 'staff/upgradePart', { uid: id, part: 'cooler' }, partPrice(u, 'cooler'), 'advice', 5, 'robotCooler', { serial: u.serial, n: hot });
      if (jams >= 2 && !partError(s, u, 'frame')) add(`part:${id}:frame`, 'staff/upgradePart', { uid: id, part: 'frame' }, partPrice(u, 'frame'), 'advice', 5, 'robotFrame', { serial: u.serial, n: jams });
      continue;
    }
    if (st === 'phone') {
      // Nagging always costs morale: at most once a minute per worker, then a small bonus instead.
      const naggedLately = (u.log || []).some(e => e.type === 'nagged' && now - e.at < 60000);
      if ((u.morale ?? VITALS.start.morale) < 40 || naggedLately) add(`care:${id}:bonusSmall`, 'staff/care', { uid: id, kind: 'bonusSmall' }, careCost(u, 'bonusSmall'), 'budget', 30, 'phoneLowMorale', { name: nm });
      else add(`care:${id}:nag`, 'staff/care', { uid: id, kind: 'nag' }, 0, 'safe', 30, 'phone', { name: nm });
    }
    const need = needs(u);
    if (u.active && !u.stopped && !Number.isFinite(u.breakUntil)) {
      if (need.hungry || (u.fullness ?? 100) <= 0) {
        if (s.gm?.unit?.style === 'careful') add(`care:${id}:lunch`, 'staff/care', { uid: id, kind: 'lunch' }, 0, 'safe', 20, 'hungryLunch', { name: nm });
        else add(`care:${id}:food`, 'staff/care', { uid: id, kind: 'food' }, careCost(u, 'food'), 'budget', 20, 'hungry', { name: nm });
      }
      if (need.tired || (u.energy ?? 100) <= 0) add(`care:${id}:coffee`, 'staff/care', { uid: id, kind: 'coffee' }, careCost(u, 'coffee'), 'budget', 20, 'tired', { name: nm });
      if (need.sulking) add(`care:${id}:bonus`, 'staff/care', { uid: id, kind: 'bonus' }, careCost(u, 'bonus'), 'budget', 15, 'sulking', { name: nm });
    }
    // growth
    const stat = STAT_ORDER.filter(k => !statError(s, u, k)).sort((a, b) => statOf(u, a) - statOf(u, b))[0];
    if (stat) add(`stat:${id}:${stat}`, 'staff/upgradeStat', { uid: id, stat }, statPrice(u, stat).coins, 'advice', 8, 'statReady', { name: nm, stat });
    const next = nextRank(u);
    if (canPromote(s, u, now)) add(`promote:${id}`, 'staff/promote', { uid: id }, 0, 'advice', 12, 'promote', { name: nm, rank: next });
    const g = unitGrade(s, u, dayKey(now)), y = unitGrade(s, u, lastDays(now, 2)[0]);
    if (g?.letter === 'D' && y?.letter === 'D') add(`fire:${id}`, 'staff/fire', { uid: id }, 0, 'advice', 2, 'fireD', { name: nm });
  }
  // supply is yours too (research step 2): contracts running out / missing, a buyer paying more today
  if (zone === 'shop') for (const g of SUPPLY.groupOrder) {
    const c = contractOf(s, g, now), found = suppliersFound(s, g, now);
    if (c && c.until - now < 2 * 3600000) add(`contract:${g}`, 'supply/open', {}, 0, 'advice', 4, 'contractEnd', { group: g, h: Math.max(1, Math.round((c.until - now) / 3600000)) });
    else if (!c && found) add(`contract:${g}`, 'supply/open', {}, 0, 'advice', 3, 'contractNone', { group: g });
  }
  if (zone === 'farm') for (const crop of CROP_ORDER.filter(c => cropUnlocked(s, c))) {
    // crop methods are yours too (research step 3): nothing tried yet / a tried way beats the one in use
    const res = Object.values(trialResults(s, crop)), rid = regionKey(s);
    if (!res.length && !trialsHere(s).some(t => t.crop === crop)) { add(`trial:${crop}`, 'farmlab/open', {}, 0, 'advice', 2, 'trialNone', { crop }); continue; }
    const curY = methodKey(methodOf(s, crop)) === methodKey(FARMLAB.defaultMethod) ? 1 : methodEffect(rid, crop, methodOf(s, crop)).yieldMul;
    const best = res.map(x => methodEffect(rid, crop, x.method).yieldMul).sort((a, b) => b - a)[0] || 0;
    if (best >= curY * 1.1) add(`trial:${crop}`, 'farmlab/open', {}, 0, 'advice', 3, 'trialBetter', { crop, pct: Math.round((best / curY - 1) * 100) });
  }
  if (zone === 'farm') {
    const cur = buyerNow(s, now), found = suppliersFound(s, 'buyers', now);
    if (!cur.locked) for (let i = 1; i <= found; i++) {
      const b = buyerOf(regionKey(s), i, dayKey(now));
      if (i !== cur.i && b.mul.beans >= (cur.mul.beans || 1) * 1.1) { add('buyer', 'supply/open', {}, 0, 'advice', 4, 'betterBuyer', { name: b.name, pct: Math.round((b.mul.beans / (cur.mul.beans || 1) - 1) * 100) }); break; }
    }
  }
  // research is yours: unknown local recipes in this country (café only)
  if (zone === 'shop') {
    const cc = countryNow(s);
    const open = countryRecipes(cc).filter(rc => rc.ings.length && drinkUnlocked(s, rc.base) && !recipeKnown(s, cc, rc.index)).length;
    if (open) add('research', 'research/open', {}, 0, 'advice', 3, 'research', { n: open });
  }
  // shifts
  const tiredOn = here.some(u => isWorkerUnit(u) && u.active && (u.energy ?? 100) < SHIFT.tiredBelow);
  const restedOff = here.some(u => isWorkerUnit(u) && !u.active && (u.energy ?? 100) >= SHIFT.restedFrom && !unitBlocked(u, now));
  if (tiredOn && restedOff) add('shift', 'staff/swapShift', { zone }, 0, 'safe', 25, 'swapShift');
  else if (restedOff && freeSlots(s, zone) > 0) {
    const u = here.find(x => isWorkerUnit(x) && !x.active && (x.energy ?? 100) >= SHIFT.restedFrom);
    if (u) add(`active:${u.uid}`, 'staff/setActive', { uid: u.uid, active: true }, 0, 'safe', 25, 'toShift', { name: name(u) });
  }
  // the rival is poaching a worker
  const p = s.staff.poach, pu = p && unitOf(s, p.uid);
  if (pu && STAFF[pu.type].zone === zone) add(`keep:${pu.uid}`, 'staff/keep', { uid: pu.uid }, p.fee, 'big', 40, 'keepWorker', { name: name(pu) });
  // hire: a free place and work piling up (farm: ripe plots waiting, café: customers waiting)
  if (zoneUnits(s, zone).length < hireCap(s, zone)) {
    const piling = zone === 'farm' ? ownedPlots(s).filter(pl => plotState(s, pl.id, now).stage === 'ready').length
      : (r.shop.orders || []).filter(o => o.stage === 'waiting').length;
    if (piling >= 3) {
      const board = applicants(s, zone);
      const i = board.map((a, k) => ({ k, v: STAT_ORDER.reduce((n, st) => n + (a.stats?.[st] || 1), 0) + (a.trait === 'diligent' ? 1 : a.trait === 'lazy' ? -1 : 0) }))
        .filter(x => !recruitError(s, zone, x.k)).sort((a, b) => b.v - a.v)[0]?.k;
      if (i != null) add(`hire:${zone}:${board[i].name}`, 'staff/recruit', { zone, index: i, name: board[i].name }, freeHire(s) ? 0 : board[i].cost, 'advice', 10, 'hire', { name: board[i].name, n: piling });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
/**
 * The manager's mood drivers now (founder feedback): idleMin = minutes without a job (you play everything yourself),
 * absentMin = minutes since you last touched the game; each beyond its grace drains loyalty in gm/payroll.
 */
export function gmMood(s, now) {
  const g = s.gm;
  if (!g?.unit) return null;
  const M = GM.mood;
  const idleMin = Math.max(0, (now - (g.lastJobAt || g.unit.hiredAt || now)) / 60000);
  const absentMin = Math.max(0, (now - (g.seenAt || now)) / 60000);
  return { idleMin, absentMin, idle: idleMin > M.idleGraceMin, absent: absentMin > M.absentGraceMin };
}
/** What the GM may do with a plan item now: 'do' | 'request' | 'suggest'. */
export function gmPermission(s, item, now) {
  const g = s.gm, mode = g?.unit ? g.mode : 'advisor';
  if (item.tier === 'advice' || mode === 'advisor') return 'suggest';
  if (s.player.coins < item.cost) return 'suggest';
  if (mode === 'full') return 'do';
  if (item.tier === 'safe') return 'do';
  if (item.tier === 'budget') return item.cost <= gmBudgetLeft(s, now) ? 'do' : 'request';
  return 'request';
}
// ---------- career (docs/design/staff-profile.md, step 3) ----------
/** The rank above a worker's (null at the top or for robots). */
export const nextRank = u => { const r = rankOf(u); const i = CAREER.ranks.indexOf(r); return r && i < CAREER.ranks.length - 1 ? CAREER.ranks[i + 1] : null; };
/** Whole days on the team. */
export const tenureDays = (u, now) => daysSince(Number.isFinite(u?.hiredAt) ? u.hiredAt : u?.book?.since ?? now, now);
/** The unit holding a one-per-zone rank in a zone (any region), or null. */
export const rankHolder = (s, zone, rank) => s.staff.units.find(x => STAFF[x.type]?.zone === zone && rankOf(x) === rank) || null;
/**
 * Why a worker cannot be promoted now: 'unknown' | 'maxRank' | 'level' | 'days' | 'taken' (lead / manager seat filled) |
 * null (can). The automatic step (staff) is never offered as a promotion.
 */
export function promoteError(s, u, now) {
  if (!u || !isWorkerUnit(u)) return 'unknown';
  const next = nextRank(u);
  if (!next) return 'maxRank';
  const need = CAREER.need[next];
  if (unitLevel(u) < need.level) return 'level';
  if (tenureDays(u, now) < need.days) return 'days';
  if (CAREER.onePerZone.includes(next) && rankHolder(s, STAFF[u.type].zone, next)) return 'taken';
  return null;
}
/** Promotable now by the player (not the automatic staff step). */
export const canPromote = (s, u, now) => !promoteError(s, u, now) && !CAREER.auto.includes(nextRank(u));
/** Lead / manager of a zone working here now (on shift, not blocked): they give the team their effects. */
export const zoneLeaders = (s, zone, now) => assignedUnits(s, s.world.currentRegion, zone)
  .filter(u => isWorkerUnit(u) && u.active && ['lead', 'manager'].includes(rankOf(u)) && !unitBlocked(u, now));
/** A phone slacker a working lead / manager sends back to work (free) once it slacked CAREER.lead.nudgeSeconds. */
export const nudgeDue = (s, u, now) => !!u && u.stopped?.kind === 'phone' && u.assigned?.regionId === s.world.currentRegion
  && now - (u.stopped.at || now) >= CAREER.lead.nudgeSeconds * 1000 && zoneLeaders(s, STAFF[u.type].zone, now).some(x => x.uid !== u.uid);
// ---------- team report (docs/design/staff-profile.md, step 2) ----------
export const REPORT_PERIODS = ['10m', 'today', '7d'];
export const SPEND_CATS = ['care', 'upgrade', 'robot', 'upkeep', 'wage', 'hire', 'research'];
/** Day keys of a report period (null for '10m', which reads the minute ledger). */
export const periodKeys = (now, period) => (period === 'today' ? [dayKey(now)] : period === '7d' ? lastDays(now, 7) : null);
const moneyOf = rows => {
  const t = { earned: 0, spent: 0, robot: 0, upgrade: 0, upkeep: 0, wage: 0, hire: 0, research: 0 };
  for (const r of rows) for (const k of Object.keys(t)) t[k] += r?.[k] || 0;
  const cats = { care: Math.max(0, t.spent - t.robot - t.upgrade - t.upkeep - t.wage - t.hire - t.research), upgrade: t.upgrade, robot: t.robot, upkeep: t.upkeep, wage: t.wage, hire: t.hire, research: t.research };
  return { earned: t.earned, spent: t.spent, profit: t.earned - t.spent, cats, rows: rows.length };
};
/**
 * The team's money in a game zone over a report period: earned, spent, profit and spending by category, plus `prev`
 * (the 10 minutes before / yesterday; none for 7 days). '10m' = the minute ledger, 'today' / '7d' = the team day rows.
 */
export function teamMoney(s, now, period, zone) {
  const pick = r => r?.[zone] || null;
  if (period === '10m') {
    const n = BOOKS.mvpMinutes, cur = Math.floor(now / 60000);
    const win = (from, to) => (s.staff.ledger || []).filter(e => e.min > from && e.min <= to).map(pick);
    return { ...moneyOf(win(cur - n, cur)), prev: moneyOf(win(cur - 2 * n, cur - n)) };
  }
  const days = s.staff.daily || [], keys = periodKeys(now, period);
  const cur = moneyOf(days.filter(e => keys.includes(e.d)).map(pick));
  if (period !== 'today') return { ...cur, prev: null };
  const y = lastDays(now, 2)[0];
  return { ...cur, prev: moneyOf(days.filter(e => e.d === y).map(pick)) };
}
/** Units of a zone ranked for a report period (day keys): grade, running profit, KPIs; best profit first. */
export function teamRanking(s, keys, zone) {
  return zoneUnits(s, zone).map(u => {
    const k = dayKpis(rowsOf(u, keys));
    return { u, k, grade: unitGrade(s, u, keys), profit: k ? k.profit : 0 };
  }).sort((a, b) => b.profit - a.profit || (b.grade?.score ?? -1) - (a.grade?.score ?? -1));
}
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


// ---------- research lab, step 1: drink recipes (docs/design/research.md) ----------
/** Country id of the region on screen (null off the map). */
export const countryNow = s => parseRegionId(s.world?.currentRegion)?.countryId || null;
/** Is menu item `index` of country `cc` known (a plain item, or found at the test bench)? */
export const recipeKnown = (s, cc, index) => { const r = countryRecipes(cc)[index]; return !!r && (!r.ings.length || (s.research?.known?.[cc] || []).includes(index)); };
/** A found (not plain) recipe: sells for RESEARCH.priceMul × the base price. */
export const recipeFound = (s, cc, index) => { const r = countryRecipes(cc)[index]; return !!r && r.ings.length > 0 && (s.research?.known?.[cc] || []).includes(index); };
export const ingredientUnlocked = (s, id) => !!INGREDIENTS[id] && level(s) >= INGREDIENTS[id].level;
/** Coins one test costs (its ingredients; the base drink's beans are used too). */
export const testCost = (ings, s = null) => Math.round((ings || []).reduce((n, id) => n + (INGREDIENTS[id]?.cost || 0) * (s ? supplyOf(s, ingGroup(id)).priceMul : 1), 0) * 100) / 100;
/** The supply group of an ingredient (milk / pantry). */
export const ingGroup = id => (SUPPLY.groups.milk.ings.includes(id) ? 'milk' : 'pantry');
/** Seconds left before the bench is free again. */
export const benchBusyIn = (s, now) => Math.max(0, (s.research?.busyUntil || 0) - now);
/** Why a test cannot run: 'noRegion' | 'notCafe' | 'locked' (base drink) | 'ingredient' | 'tooMany' | 'empty' | 'busy' | 'beans' | 'coins' | null. */
export function testError(s, base, ings, now) {
  const r = region(s);
  if (!r || !countryNow(s)) return 'noRegion';
  if (regionGame(s) !== 'cafe') return 'notCafe';
  if (!DRINKS[base] || !drinkUnlocked(s, base)) return 'locked';
  if (!Array.isArray(ings) || new Set(ings).size !== ings.length || ings.some(id => !ingredientUnlocked(s, id))) return 'ingredient';
  if (benchBusyIn(s, now) > 0) return 'busy'; // first: the countdown is what the bench shows while it brews
  if (ings.length > RESEARCH.maxIngredients) return 'tooMany';
  if (!ings.length) return 'empty';
  if (s.inventory.beans < DRINKS[base].beans) return 'beans';
  if (s.player.coins < testCost(ings, s)) return 'coins';
  return null;
}
/**
 * The bench's verdict on base + ingredients for country cc (pure): found (index) / known (already in the book) / or
 * hints against the closest unknown recipe of that base: right (ingredients in it), other (in another unknown recipe of
 * this country), wrong, missing count and the taste tag of one missing ingredient.
 */
export function judgeTest(s, cc, base, ings) {
  const set = [...ings].sort(), key = set.join(',');
  const all = countryRecipes(cc).filter(r => r.base === base);
  const hit = all.find(r => r.ings.join(',') === key);
  if (hit) return recipeKnown(s, cc, hit.index) ? { result: 'known', index: hit.index } : { result: 'found', index: hit.index };
  const open = all.filter(r => r.ings.length && !recipeKnown(s, cc, r.index));
  if (!open.length) return { result: 'allKnown' };
  const score = r => r.ings.filter(x => set.includes(x)).length * 10 - Math.abs(r.ings.length - set.length);
  const best = [...open].sort((a, b) => score(b) - score(a) || a.index - b.index)[0];
  const right = set.filter(x => best.ings.includes(x));
  const others = new Set(countryRecipes(cc).filter(r => r.ings.length && !recipeKnown(s, cc, r.index) && r !== best).flatMap(r => r.ings));
  const other = set.filter(x => !best.ings.includes(x) && others.has(x));
  const missingIds = best.ings.filter(x => !set.includes(x));
  return { result: 'miss', right: right.length, other: other.length, wrong: set.length - right.length - other.length, missing: missingIds.length,
    tag: missingIds.length ? INGREDIENTS[missingIds[0]].tag : null, extra: set.length > best.ings.length };
}


// ---------- research step 2: suppliers and buyers (docs/design/research.md) ----------
const regionKey = s => s.world?.currentRegion || null;
/** Suppliers found in a group here (a finished scout counts at once). */
export function suppliersFound(s, group, now = Date.now()) {
  const rid = regionKey(s), sc = s.supply?.scout;
  const base = s.supply?.found?.[rid]?.[group] || 0;
  return Math.min(group === 'buyers' ? SUPPLY.buyers.count : SUPPLY.perGroup, base + (sc && sc.regionId === rid && sc.group === group && now >= sc.until ? 1 : 0));
}
/** The scout in progress (any region) or null. */
export const scoutOf = s => s.supply?.scout || null;
/** The active contract of a group here: { i, until, sup } or null (expired = null). */
export function contractOf(s, group, now = Date.now()) {
  const c = s.supply?.contracts?.[regionKey(s)]?.[group];
  return c && now < c.until ? { ...c, sup: supplierOf(regionKey(s), group, c.i) } : null;
}
/** What a group costs and how good it is here now: the contract's supplier, else the market. */
export function supplyOf(s, group, now = Date.now()) {
  const c = contractOf(s, group, now);
  return c ? { ...c.sup, contract: c } : { ...SUPPLY.market, name: null, contract: null };
}
export const contractFee = days => SUPPLY.contractFee * (SUPPLY.contractDays[days] || 0);
/** Farm buyer here: { i, name, mul, locked } — a locked price while the lock lasts, else today's price of the chosen one. */
export function buyerNow(s, now = Date.now()) {
  const rid = regionKey(s), b = s.supply?.buyer?.[rid];
  if (b?.lockedUntil > now && b.mul) return { i: b.i, name: buyerOf(rid, b.i, dayKey(now)).name, mul: b.mul, locked: b.lockedUntil };
  const i = b?.i && b.i <= suppliersFound(s, 'buyers', now) ? b.i : 0;
  return { i, ...buyerOf(rid, i, dayKey(now)), locked: 0 };
}


// ---------- research step 3: crop methods (docs/design/research.md) ----------
/** The way `crop` is grown here (adopted, else FARMLAB.defaultMethod). */
export const methodOf = (s, crop) => s.farmLab?.methods?.[s.world?.currentRegion]?.[crop] || FARMLAB.defaultMethod;
/** Trial fields allowed at once (1, 2 from level 8). */
export const trialSlots = s => FARMLAB.trialSlots.filter(([lv]) => level(s) >= lv).at(-1)?.[1] || 1;
export const trialsHere = s => s.farmLab?.trials?.[s.world?.currentRegion] || [];
/** Results of trials here for a crop: { methodKey: { method, beans, ms, up, at } }. */
export const trialResults = (s, crop) => s.farmLab?.results?.[s.world?.currentRegion]?.[crop] || {};
/** Why a trial cannot start: 'notFarm' | 'locked' (crop) | 'method' | 'slots' | 'noField' | 'coins' | null. */
export function trialError(s, crop, method) {
  if (!region(s) || regionGame(s) !== 'farm') return 'notFarm';
  if (!CROPS[crop] || !cropUnlocked(s, crop)) return 'locked';
  if (!Array.isArray(method) || method.length !== 3 || method.some(v => !(v >= 0 && v <= 2 && Number.isInteger(v))) || methodKey(method) === methodKey(FARMLAB.defaultMethod)) return 'method'; // the default way is what you already grow
  if (trialsHere(s).length >= trialSlots(s)) return 'slots';
  if (!trialField(s)) return 'noField';
  if (s.player.coins < FARMLAB.trialFee + seedCost(s, crop)) return 'coins';
  return null;
}
/** The empty field a trial goes to (the first one), or null. */
export const trialField = s => ownedPlots(s).find(p => !region(s).plots[p.id]) || null;
