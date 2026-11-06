// Pure selectors over the v3 save. No mutation. Used by the reducer, the scene and the HUD.
import { BUILDINGS, CROPS, CROP_ORDER, DRINKS, DRINK_ORDER, STAFF, STAFF_SLOTS, ROUND_LEVEL_CAP, REBIRTH, CELL, levelForXp, xpForLevel, GRACE, ROUNDS, MAX_ROUND, SHOP } from './config/economy.js';
import { PARCELS, ROADS, RESERVED, AREAS, areaAt, plotsOf, rectsOverlap, inRect } from './config/layout.js';
import { parseRegionId, regionIdOf, REGIONS_PER_COUNTRY, COUNTRY_ORDER, regionCost } from './config/world.js';

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
// Stopped units (worker on the phone / robot out of battery) give no bonus until resumed.
export const unitWorking = u => !u.stopped;
const staffBonus = (s, key) => assignedUnits(s).filter(unitWorking).reduce((sum, u) => sum + (STAFF[u.type]?.effect?.[key] || 0), 0);
const blessing = (s, key) => (s.rebirth.blessings[key] || 0) * (REBIRTH.blessings[key] || 0);

export const capacity = s => effect(s, 'silo', 'capacity') || 0;
export const growMs = (s, cropId) => Math.round(CROPS[cropId].growSeconds * 1000 / (1 + staffBonus(s, 'growSpeed') + blessing(s, 'grow')));
export const yieldOf = (s, cropId) => Math.max(1, Math.round(CROPS[cropId].beans * (1 + effect(s, 'dryer', 'yieldBonus') + staffBonus(s, 'yieldBonus'))));
export const priceMultiplier = s => 1 + effect(s, 'roaster', 'priceBonus') + effect(s, 'pastry', 'priceBonus') + effectSum(s, 'tables', 'tip') + staffBonus(s, 'priceBonus') + blessing(s, 'price');
export const drinkPrice = (s, drinkId) => Math.round(DRINKS[drinkId].price * priceMultiplier(s));
export const brewMs = (s, drinkId) => Math.round(DRINKS[drinkId].brewSeconds * 1000 / ((effect(s, 'brewCounter', 'brewSpeed') || 1) * (1 + staffBonus(s, 'brewSpeed'))));
export const brewSlots = s => effect(s, 'brewCounter', 'slots') || 1;
export const queueCap = s => (effect(s, 'orderCounter', 'queue') || 2) + effectSum(s, 'tables', 'queue');
export const arrivalMs = s => Math.round((effect(s, 'orderCounter', 'arrivalSeconds') || 9) * 1000 / (1 + effect(s, 'kiosk', 'arrivalBonus')));
export const xpMultiplier = s => 1 + blessing(s, 'xp');

export const cropUnlocked = (s, cropId) => !!own(CROPS, cropId) && level(s) >= CROPS[cropId].level && s.player.round >= CROPS[cropId].round;
export const unlockedCrops = s => CROP_ORDER.filter(id => cropUnlocked(s, id));
export const drinkUnlocked = (s, drinkId) => !!own(DRINKS, drinkId) && level(s) >= DRINKS[drinkId].level && buildingLevel(s, 'roaster') >= DRINKS[drinkId].roaster;
export const unlockedDrinks = s => DRINK_ORDER.filter(id => drinkUnlocked(s, id));

export const ownsParcel = (s, parcelId) => !!region(s)?.parcels.includes(parcelId);
export const roadOpen = (s, roadId) => !!(own(ROADS, roadId)?.open || region(s)?.roads.includes(roadId));
export const ownedPlots = s => (region(s)?.parcels || []).flatMap(plotsOf);

export function plotState(s, plotId, now) {
  const r = region(s);
  const p = r ? own(r.plots, plotId) : undefined;
  if (!p) return { stage: 'empty' };
  const total = growMs(s, p.crop), elapsed = Math.max(0, now - p.plantedAt);
  const ratio = Math.min(1, elapsed / total);
  return { stage: ratio >= 1 ? 'ready' : ratio < .08 ? 'planted' : 'growing', crop: p.crop, ratio, remainingMs: Math.max(0, total - elapsed) };
}

// Free robusta when the player is stuck (no coins for seeds, nothing growing, no beans, no café orders in progress).
export function graceActive(s) {
  const r = region(s);
  if (!r) return false;
  const cheapest = CROPS[GRACE.freeCrop].seedCost;
  return s.player.coins < cheapest && Object.keys(r.plots).length === 0 && s.inventory.beans === 0 && r.shop.orders.every(o => o.stage === 'waiting');
}
export const seedCost = (s, cropId) => (cropId === GRACE.freeCrop && graceActive(s) ? 0 : CROPS[cropId].seedCost);

export function footprint(type, x, z, rot = 0) {
  const def = BUILDINGS[type];
  let [w, d] = def.size;
  if (rot % 2) [w, d] = [d, w];
  const hw = w * CELL / 2, hd = d * CELL / 2;
  return [x - hw, z - hd, x + hw, z + hd];
}
// Snap so the footprint corners land on the 1 m grid.
export function snapPosition(type, x, z, rot = 0) {
  const def = BUILDINGS[type];
  let [w, d] = def.size;
  if (rot % 2) [w, d] = [d, w];
  const sx = (w * CELL / 2) % 1, sz = (d * CELL / 2) % 1;
  return { x: Math.round(x - sx) + sx, z: Math.round(z - sz) + sz };
}

const PARCEL_FOR_ZONE = { farm: ['build'], shop: ['shop'], any: ['build', 'shop'] };
// The farm has no build lots: farm buildings (and decorations placed on the farm) go on FREE GRASS inside the farm
// bounds — never on a field, a road, the gate plaza or another building.
// Returns null when placement is valid, else an error code.
export function placementError(s, type, x, z, rot = 0, ignoreUid = null) {
  const def = own(BUILDINGS, type);
  const r = region(s);
  if (!def || !r) return 'unknown';
  const fp = footprint(type, x, z, rot);
  const onFarm = areaAt(x, z) === 'farm';
  if (onFarm && (def.zone === 'farm' || def.zone === 'any')) {
    const B = AREAS.farm.bounds;
    if (fp[0] < B.minX + 1 || fp[2] > B.maxX - 1 || fp[1] < B.minZ + 1 || fp[3] > B.maxZ - 1) return 'outside';
    if (Object.values(PARCELS).some(p => rectsOverlap(fp, p.rect))) return 'onField';
    if (Object.values(ROADS).some(rd => rectsOverlap(fp, rd.rect))) return 'blocked';
    if (RESERVED.some(res => rectsOverlap(fp, res.rect))) return 'blocked';
    for (const b of r.buildings) {
      if (b.uid === ignoreUid) continue;
      if (rectsOverlap(fp, footprint(b.type, b.x, b.z, b.rot))) return 'overlap';
    }
    return null;
  }
  if (def.zone === 'farm') return 'wrongZone';
  const parcel = Object.values(PARCELS).find(p => inRect(fp[0], fp[1], p.rect) && inRect(fp[2], fp[3], p.rect));
  if (!parcel) return 'outside';
  if (!PARCEL_FOR_ZONE[def.zone].includes(parcel.kind)) return 'wrongZone';
  if (!r.parcels.includes(parcel.id)) return 'notOwned';
  if (RESERVED.some(res => rectsOverlap(fp, res.rect))) return 'blocked';
  for (const b of r.buildings) {
    if (b.uid === ignoreUid) continue;
    if (rectsOverlap(fp, footprint(b.type, b.x, b.z, b.rot))) return 'overlap';
  }
  return null;
}

export const MAX_INSTANCES = { tables: 4, flowers: 12, plant: 12, lamp: 12 };
export function buildError(s, type) {
  const def = own(BUILDINGS, type);
  if (!def || def.starter || def.retired) return 'unknown';
  if (s.player.round < def.round) return 'round';
  if (level(s) < def.level) return 'level';
  const count = buildingsOf(s, type).length;
  if (count >= (MAX_INSTANCES[type] || 1)) return 'limit';
  if (s.player.coins < def.cost) return 'coins';
  return null;
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
  // No Round gating on land: any field / café lot can be bought with coins.
  if (p.road && !roadOpen(s, p.road)) return 'road';
  if (s.player.coins < p.cost) return 'coins';
  return null;
}
export function roadError(s, roadId) {
  const road = own(ROADS, roadId);
  if (!road || !region(s)) return 'unknown';
  if (roadOpen(s, roadId)) return 'owned';
  if (s.player.round < road.round) return 'round';
  if (s.player.coins < road.cost) return 'coins';
  return null;
}

export function staffError(s, type) {
  const def = own(STAFF, type);
  if (!def) return 'unknown';
  if (s.player.round < def.round) return 'round';
  if (level(s) < def.level) return 'level';
  if (s.player.coins < def.cost) return 'coins';
  return null;
}
export const freeSlots = (s, zone) => STAFF_SLOTS[zone] - assignedUnits(s, s.world.currentRegion, zone).length;

export function roundStatus(s) {
  const next = s.player.round + 1;
  if (next > MAX_ROUND) return { next: null };
  const def = ROUNDS[next];
  const lvl = level(s);
  return { next, cost: def.cost, minLevel: def.minLevel, levelOk: lvl >= def.minLevel, missing: Math.max(0, def.cost - s.player.coins), canUnlock: lvl >= def.minLevel && s.player.coins >= def.cost };
}

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
export const regionsOfCountry = countryId => Array.from({ length: REGIONS_PER_COUNTRY }, (_, i) => regionIdOf(countryId, i + 1));
export const allCountries = () => COUNTRY_ORDER;

export function rebirthError(s, blessingKey) {
  if (own(REBIRTH.blessings, blessingKey) === undefined) return 'unknown';
  if (s.rebirth.credits <= 0) return 'noCredits';
  if (level(s) < REBIRTH.minLevel) return 'level';
  if ((s.rebirth.blessings[blessingKey] || 0) >= REBIRTH.maxStacks) return 'maxStacks';
  return null;
}
