// Pure selectors over the v3 save. No mutation. Used by the reducer, the scene and the HUD.
import { statCostOf, PLANT_ROW } from './config/economy.js';
import { tierIndexAt } from './config/layout.js';
import { maxStatOf, maxTierOf, FUNNY, gmThinkOf, gmActionsOf, gmMoneyMul, gmHaggleMul, gmCalmMul, gmStatOf } from './config/economy.js';
import { doesJob, haulLoadOf, bucketOf } from './config/economy.js';
import { CREW, workerJobs, FARM_MANAGER, gmHandsPerMin } from './config/economy.js';
import { STORAGE_BASE, GARDEN, gardenStyleOf, FOLLOW, GM, gmCandidatesFor, gmSalary, SHIFT, TEND, PROFILE, CAREER, GEAR, gearTier, WARRANTY, SOFTWARE, softwarePrice, hasSoftware, TUTORIAL, BUILDINGS, CROPS, CROP_ORDER, DRINKS, DRINK_ORDER, STAFF, hireLimit, STAFF_CAP, RECRUIT, applicantsFor, traitEffect, MISTAKES, QUALITY, isHardDrink, unitLevel, levelSpeed, statOf, statCap, statCost, STAT_ORDER, SKILL, ROBOT_TASKS, PART_COST, PART_ORDER, partTier, partCost, UPKEEP, VITALS, CARE, ROBOT_WEAR, WORKER_TASKS, taskLimit, energyMax, unitFee, staffFee, unitSpeed, batteryMinutes, heatPerMin, jamChance, slackMul, ROBOT_PARTS, STAFF_BREAKS, STAFF_ORDER, GM_RULES, UPGRADE_GATE, LAND, FIRE, BOOKS, CHEST_LEVELS, tradeCostMul, LOAN, loanOwed, ROUND_LEVEL_CAP, REBIRTH, CELL, levelForXp, xpForLevel, GRACE, SHOP, BEANS, VENUES, VENUE_ORDER, VENUE_ITEMS, RATING, FIELD, fieldExtraCost, fieldExtraCap, GOODS, GOOD_ORDER, ITEM_GOODS, RECIPES, CLIMATE_EFFECT, CLIMATE_PICK, PERENNIAL, INCOME, INCOME_FLOOR, incomeRef, loanTermMin, robotCap, DEBT, TASKS, PENALTY, HISTORY } from './config/economy.js';
import { TIER_EDGES, tierZoneAt, farmGroundY, PARCELS, ROADS, RESERVED, BOUNDS, GATE, areaOfParcel, areaAt, rectsOverlap, rectsTouch, inRect, terrainOfLot, lotAllows, climateOfLot, TERRAIN_USES, PRE_TILLED, SNAP, lotContaining, ESTATES, ESTATE_ORDER, ESTATE_FIELDS, estateOfLot, farmLotsOf, plotsOf } from './config/layout.js';
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
const computeStaffBonus = (s, key) => assignedUnits(s).filter(unitWorking).reduce((sum, u) => sum + unitEffect(u, key) + traitEffect(u, key), 0);
let readingState = null; // see readOnlyPass
const staffBonus = (s, key) => (readingState?.s === s ? (readingState.bonus[key] ??= computeStaffBonus(s, key)) : computeStaffBonus(s, key));
/** Runs fn while `s` is known not to change (a committed state, never the reducer's draft): every plot of a sync then shares one staff bonus. */
export function readOnlyPass(s, fn) {
  const outer = readingState;
  readingState = { s, bonus: {} };
  try { return fn(); } finally { readingState = outer; }
}
const blessing = (s, key) => (s.rebirth.blessings[key] || 0) * (REBIRTH.blessings[key] || 0);

// Storage: the storehouse plus every barn (sum: a 2nd barn really adds room).
export const capacity = s => STORAGE_BASE + effectSum(s, 'silo', 'capacity') + effectSum(s, 'warehouse', 'capacity');
/** Amount of one good in storage ('beans' | 'dried' | 'roasted' | 'bag'). */
export const goodCount = (s, id) => (id === 'beans' ? s.inventory.beans || 0 : ITEM_GOODS.includes(id) ? s.inventory.items?.[id] || 0 : 0);
/** Storage used by every good (each takes 1 space; a bag holds 3 roasted beans, so packing frees room). */
export const stored = s => GOOD_ORDER.reduce((n, id) => n + Math.floor(goodCount(s, id)), 0);
/** Free storage space (0 when full or over). */
export const storageRoom = s => Math.max(0, capacity(s) - stored(s));
// extra: a field's own speed-up (its best well in reach), added like the staff / blessing bonuses.
// growMs: one season of a grown tree (the time between harvests); establishMs: a new sapling's first crop.
const speedOf = (s, extra) => 1 + staffBonus(s, 'growSpeed') + blessing(s, 'grow') + extra;
export const growMs = (s, cropId, extra = 0) => Math.round((CROPS[cropId].cycleSeconds ?? CROPS[cropId].growSeconds) * 1000 / speedOf(s, extra));
export const establishMs = (s, cropId, extra = 0) => Math.round(CROPS[cropId].growSeconds * 1000 / speedOf(s, extra));
/** Harvests a tree has given (its age in seasons) and whether it is old (fewer beans, PERENNIAL.oldYield). */
export const treeAge = p => (p?.n | 0);
/** What a planted field asks of the player: 'ready' (pick it) | 'prune' (old tree) | 'thirst' (half grown, not watered) | null. */
export function plotNeeds(s, plotId, now) {
  const p = region(s)?.plots?.[plotId];
  if (!p) return null;
  const st = plotState(s, plotId, now);
  if (st.stage === 'ready') return 'ready';
  if (treeOld(p)) return 'prune';
  return st.stage === 'growing' && !p.watered && st.ratio >= .5 ? 'thirst' : null;
}
// The farm's work in numbers (the same counters as the HUD chips), and what arrives per minute. Memo: asked several times per round.
const workMemo = new WeakMap();
export function farmWorkload(s, now = Date.now()) {
  const hit = workMemo.get(s);
  if (hit && Math.abs(now - hit.now) < 1000) return hit;
  const r = region(s), w = { now, plots: 0, planted: 0, empty: 0, ripe: 0, thirst: 0, prune: 0, ripenPerMin: 0, waterPerMin: 0, prunePerMin: 0, beansPerMin: 0 };
  for (const p of r ? ownedPlots(s) : []) {
    const pl = r.plots[p.id];
    w.plots++;
    if (!pl) { w.empty++; continue; }
    w.planted++;
    const need = plotNeeds(s, p.id, now), season = Math.max(.1, plotGrowMs(s, pl, p.id) / 60000);
    if (need === 'ready') w.ripe++; else if (need === 'thirst') w.thirst++; else if (need === 'prune') w.prune++;
    w.ripenPerMin += 1 / season; w.prunePerMin += 1 / (season * (CROPS[pl.crop]?.life || 10)); w.beansPerMin += yieldOf(s, pl.crop) / season;
    if (!dripCovers(s, p.id)) w.waterPerMin += 1 / season;
  }
  workMemo.set(s, w);
  return w;
}
/** Picks per minute the crew and the manager's own hands can do. */
export function farmPicksPerMin(s) {
  const gm = gmOf(s), own = gm && fmOf(s).auto ? gmHandsPerMin(gm) * FARM_MANAGER.hands.harvestShare : 0;
  return own + assignedUnits(s, s.world.currentRegion, 'farm').filter(u => u.active !== false && doesJob(u, 'harvest')).reduce((n, u) => n + jobsPerMin(u), 0);
}
/** More is ripening, or already waiting, than can be picked: more fields would only rot. */
export function farmOverloaded(s, now = Date.now()) {
  const w = farmWorkload(s, now), picks = farmPicksPerMin(s);
  return w.plots >= 6 && (w.ripe > picks * FARM_MANAGER.staffing.stopBacklogMin || w.ripenPerMin > picks);
}
/**
 * How many people each job needs, from the counters: units = (backlog / clearMin + arriving per minute − the manager's own hands) / jobs a unit does per minute,
 * capped at the trade's share of the crew. Plus storehouses for what the farm picks before it is sold.
 */
export function farmStaffing(s, now = Date.now()) {
  const w = farmWorkload(s, now), S = FARM_MANAGER.staffing, H = FARM_MANAGER.hands, V = GM.value.jobsPerMin, cap = hireCap(s, 'farm'), gm = gmOf(s);
  const own = gm && fmOf(s).auto ? gmHandsPerMin(gm) * H.harvestShare : 0;
  const units = (backlog, arriving, hands, rate, share) => Math.min(Math.ceil(cap * share), Math.ceil(Math.max(0, backlog / S.clearMin + arriving - hands) / rate));
  const open = new Set(ownedPlots(s).map(p => tierIndexAt(p.x, p.z))).size;
  const harvest = w.planted ? Math.max(open > 1 ? open : 0, units(w.ripe, w.ripenPerMin, own, V.picker, S.share.harvest)) : 0;
  const water = w.planted ? units(w.thirst, w.waterPerMin, 0, V.waterer, S.share.water) : 0, prune = w.planted ? units(w.prune, w.prunePerMin, 0, V.pruner, S.share.prune) : 0;
  const crew = assignedUnits(s, s.world.currentRegion, 'farm').filter(u => u.active !== false), have = job => crew.filter(u => doesJob(u, job)).length;
  const room = capacity(s), silos = countOf(s, 'silo'), perSilo = BUILDINGS.silo.effect.capacity[0], beansPerPick = w.ripenPerMin > 0 ? w.beansPerMin / w.ripenPerMin : 0;
  const flow = Math.min(w.beansPerMin, farmPicksPerMin(s) * beansPerPick), hold = fmOf(s).autoSell ? S.holdAutoMin : S.holdManualMin;
  return { harvest, water, prune, haul: Math.min(Math.ceil(cap * S.share.haul), Math.ceil(harvest / 2)), work: w,
    rows: [{ job: 'harvest', backlog: w.ripe, want: harvest, have: have('harvest') }, { job: 'water', backlog: w.thirst, want: water, have: have('water') }, { job: 'prune', backlog: w.prune, want: prune, have: have('prune') }],
    storage: { stored: stored(s), capacity: room, silos, want: silos + Math.ceil(Math.max(0, flow * hold - room) / perSilo), short: room < flow * hold } };
}
/**
 * The clock behind a problem (display): { kind, left 0–1 (what is left of the patience bar), msLeft, warn }. warn = the bar ran
 * out (fruit dropping / tree stressed). Prune has no clock: just the lost yield.
 */
export function plotAlert(s, plotId, now) {
  const kind = plotNeeds(s, plotId, now), p = region(s)?.plots?.[plotId];
  if (!kind || !p) return null;
  const crop = CROPS[p.crop];
  if (kind === 'prune') return { kind, left: null, msLeft: null, warn: false };
  const total = plotGrowMs(s, p, plotId), elapsed = Math.max(0, now - p.plantedAt);
  if (kind === 'ready') {
    const window = (crop.drop?.after ?? 600) * 1000, late = Math.max(0, elapsed - total);
    return { kind, left: Math.max(0, 1 - late / window), msLeft: Math.max(0, window - late), warn: late >= window };
  }
  const span = total * .4, into = Math.max(0, elapsed - total * .5); // thirst: patience until 90 % of the growth
  return { kind, left: Math.max(0, 1 - into / span), msLeft: Math.max(0, span - into), warn: into >= span };
}
/** Tree health for the detail card (display only): share of the tree still alive/thriving 0–100, and beans one harvest gives. */
export function treeHealth(s, plotId) {
  const r = region(s), pl = r?.plots?.[plotId], crop = pl && CROPS[pl.crop];
  if (!crop) return null;
  const zone = climateOfPlot(s, plotId), fit = climateFit(pl.crop, zone), age = treeAge(pl), life = crop.life || 10;
  const climate = fit === 'bad' ? 20 : fit === 'ok' ? 6 : 0;
  const ageLoss = Math.min(45, Math.max(0, age / life - .6) * 110);
  const survival = Math.max(15, Math.round(100 - climate - ageLoss + (pl.pruned ? 5 : 0)));
  const base = yieldOf(s, pl.crop) * (treeOld(pl) ? PERENNIAL.oldYield : 1);
  // beans: a 1★ pick … a fresh 3★ pick (the player's own pick is 3★ when fresh: QUALITY.yield), so the card matches a real harvest
  const beans = Math.max(1, Math.round(base * Math.min(100, survival) / 100)), beansMax = Math.max(beans, Math.round(base * QUALITY.yield[3]));
  return { survival: Math.min(100, survival), beans, beansMax, fit };
}
export const treeOld = p => !!p && !!CROPS[p.crop]?.life && treeAge(p) >= CROPS[p.crop].life;
export const pruneCost = crop => Math.round(CROPS[crop].seedCost * PERENNIAL.pruneCost);
/** Grow time of one planted plot: a tutorial seed (`fast`, planted before the first harvest) ripens in a few seconds. */
// A plot a low-level worker planted crooked (`slow`, staff mistake) grows MISTAKES.crookedSlow slower. A field within
// reach of a well grows faster (wellBonus). `plotId` is optional: it is looked up from the plot object when missing.
/** Garden layers of the current region: { style, timeMul, yieldMul, freshMul, quality } (config GARDEN). */
export const gardenOf = s => { const style = gardenStyleOf(String(s.world?.currentRegion || '').slice(0, 2)); return { style, ...GARDEN[style] }; };
export const plotGrowMs = (s, p, plotId = plotIdOf(s, p)) => {
  const c = CROPS[p.crop], extra = plotId ? wellBonus(s, plotId) : 0;
  // a sapling (n = 0) needs its first-crop time, a cut-back tree pruneGrow of it, a grown tree one season; Liberica's
  // second pick of a season only the rest of its cherries
  let base = p.wave && c?.waves ? Math.round(c.waves.regrowSeconds * 1000 / speedOf(s, extra))
    : treeAge(p) > 0 ? growMs(s, p.crop, extra) : Math.round(establishMs(s, p.crop, extra) * (p.pruned ? PERENNIAL.pruneGrow : 1));
  const way = Array.isArray(p.method) && s.world?.currentRegion ? methodEffect(s.world.currentRegion, p.crop, p.method).timeMul : 1; // research step 3
  const zone = plotId ? climateEffect(p.crop, climateOfPlot(s, plotId))?.timeMul || 1 : 1; // the wrong growing zone
  const garden = s.world?.currentRegion ? gardenOf(s).timeMul : 1; // shade-grown cherries ripen slower
  const drip = plotId && !p.watered && dripCovers(s, plotId) ? 1 - TEND.speedup : 1; // a drip line waters the field every season
  return p.fast ? Math.min(TUTORIAL.firstGrowSeconds * 1000, base) : Math.round(base * way * zone * garden * drip * (p.slow ? MISTAKES.crookedSlow : 1));
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

export const cropUnlocked = (s, cropId) => !!own(CROPS, cropId); // no level / round gate: any seed with coins (founder 2026-11-08)
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
  const next = nextEstate(s); // estates: only the next estate is for sale; the land beyond stays wild forest
  return next ? next.lots.filter(id => !r.parcels.includes(id)) : [];
}
/** Estates (land-ui-simplify §2A): owned when all its lots are owned (state.withEstates completes partial old saves). */
export const estateOwned = (s, id) => { const r = region(s), e = ESTATES[id]; return !!r && !!e && e.lots.every(x => r.parcels.includes(x)); };
/** The next estate to buy (in order), or null when every estate is owned. */
export const nextEstate = s => { const id = ESTATE_ORDER.find(e => !estateOwned(s, e)); return id ? ESTATES[id] : null; };
/** Price of a farm lot = the price of its estate (lots are bought as a whole estate). */
export const parcelCost = id => estateOfLot(id)?.cost ?? own(PARCELS, id)?.cost ?? 0;
/** Farm area the camera / player may roam: owned lots + open roads + frontier lots + the gate plaza, padded. */
export function farmViewBounds(s, pad = 6) {
  const r = region(s);
  const owned = (r?.parcels || Object.values(PARCELS).filter(p => p.starter).map(p => p.id)).filter(id => own(PARCELS, id) && areaOfParcel(id) === 'farm');
  const rects = [...owned.map(id => PARCELS[id].rect), ...(r ? openRoads(s) : Object.keys(ROADS).filter(id => ROADS[id].open)).map(id => ROADS[id].rect),
    ...frontierParcels(s).map(id => PARCELS[id].rect), [GATE.x - 5, GATE.z - 6, GATE.x + 5, GATE.z + 5]];
  const b = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const q of rects) { b.minX = Math.min(b.minX, q[0]); b.minZ = Math.min(b.minZ, q[1]); b.maxX = Math.max(b.maxX, q[2]); b.maxZ = Math.max(b.maxZ, q[3]); }
  // The first tier not bought yet is closed off by a fence + shut gates (realm/map-fence.js): you cannot walk past its wall.
  const closed = ESTATE_ORDER.findIndex((id, k) => k > 0 && !estateOwned(s, id));
  const wall = closed > 0 ? TIER_EDGES[closed - 1] : null, cap = wall ? Math.max(wall.z, wall.zE ?? wall.z) + .5 : -Infinity;
  return { minX: Math.max(BOUNDS.minX, b.minX - pad), minZ: Math.max(BOUNDS.minZ, b.minZ - pad, cap), maxX: Math.min(BOUNDS.maxX, b.maxX + pad), maxZ: Math.min(BOUNDS.maxZ, b.maxZ + pad) };
}
// ---------- Farm World 2.0: fields are placeables (docs/farm-world-2.0/FARM-WORLD-2.0-ARCHITECTURE.md §2.3) ----------
// Per-region memo (the reducer clones the region on every action, so a WeakMap keyed by the region object is exact).
const memo = new WeakMap();
const memoOf = r => { let m = memo.get(r); if (!m) memo.set(r, m = {}); return m; };
/** One action that changes the land several times (a whole row of trees) must drop the memo between the steps. */
export const forgetRegionMemo = r => { memo.delete(r); };
const lotIdAt = (x, z) => Object.values(PARCELS).find(p => inRect(x, z, p.rect))?.id || null;
/** The region's crop fields ({ id, x, z }). */
export const fieldsOf = s => region(s)?.fields || [];
/** Fields as plots ({ id, x, z, parcel }) in save order; parcel = the lot the field stands in (sickle badge groups). */
export const ownedPlots = s => {
  const r = region(s);
  if (!r) return [];
  const m = memoOf(r);
  return (m.plots ||= (r.fields || []).map(f => ({ id: f.id, x: f.x, z: f.z, parcel: lotIdAt(f.x, f.z), row: f.row })));
};
/** One field by id (null when it does not exist in the current region). Replaces the static layout.plotById. */
export const plotOf = (s, id) => {
  const r = region(s);
  if (!r || typeof id !== 'string') return null;
  const m = memoOf(r);
  if (!m.byId) m.byId = new Map(ownedPlots(s).map(p => [p.id, p]));
  return m.byId.get(id) || null;
};
// ---- coffee varieties (docs/design/coffee-varieties.md) ----
/** Growing zone of a field: its lot's ('lowland' | 'upland' | 'slope' | 'highland'). */
export const climateOfPlot = (s, plotId) => { const p = plotOf(s, plotId); return p ? tierZoneAt(p.x, p.z) : 'lowland'; };
/** { timeMul?, stars? } of `crop` in `zone`, or null when the zone is neutral for it. */
export const climateEffect = (crop, zone) => CLIMATE_EFFECT[crop]?.[zone] || null;
/** 'good' (bonus) | 'ok' | 'bad' (penalty) — the hint shown while holding a seed. */
export const climateFit = (crop, zone) => { const e = climateEffect(crop, zone); return !e ? 'ok' : (e.stars || 0) < 0 || (e.timeMul || 1) > 1 ? 'bad' : 'good'; };
/** Raw price of one bean of `crop` at the storehouse. */
export const beanPrice = crop => CROPS[crop]?.price ?? GOODS.beans.price;
/** Varieties cheapest first (what the café and the dryer use up first) and dearest first (what a partial sale sells). */
export const BEAN_TAKE_ORDER = Object.keys(CROPS).sort((a, b) => beanPrice(a) - beanPrice(b));
export const BEAN_SELL_ORDER = [...BEAN_TAKE_ORDER].reverse();
/** Beans per variety; always sums to inventory.beans (a gap, e.g. an old save, counts as Robusta). */
export function beanMix(s) {
  const total = Math.max(0, Math.floor(s.inventory.beans || 0)), m = {};
  let sum = 0;
  for (const c of Object.keys(CROPS)) { m[c] = Math.max(0, Math.floor(s.inventory.beanMix?.[c] || 0)); sum += m[c]; }
  if (sum < total) m.robusta += total - sum;
  else for (const c of BEAN_TAKE_ORDER) { if (sum <= total) break; const t = Math.min(sum - total, m[c]); m[c] -= t; sum -= t; }
  return m;
}
/** Robusta is self-sterile: it needs pollen from other Robusta. False only when every field around it (within
 *  `pollinate.radius`) grows another variety; an empty or lone bed is fine (wild pollen, no softlock at the start). */
export function pollinated(s, plotId) {
  const r = region(s), me = plotOf(s, plotId), crop = r?.plots[plotId]?.crop, rule = CROPS[crop]?.pollinate;
  if (!rule || !me) return true;
  let others = 0;
  for (const f of ownedPlots(s)) {
    if (f.id === plotId || Math.hypot(f.x - me.x, f.z - me.z) > rule.radius) continue;
    const c = r.plots[f.id]?.crop;
    if (!c || c === crop) return true;
    others++;
  }
  return others === 0;
}
/** Beans the processing chain may take (Arabica is sold raw only). */
export const processableBeans = s => { const m = beanMix(s); return Object.keys(m).reduce((n, c) => n + (CROPS[c].rawOnly ? 0 : m[c]), 0); };
/** Coins a bean of `crop` is worth at best: its raw price, or the processing chain's value (pb) + its specialty premium. */
export function cropBeanValue(s, crop, pb = perBean(s)) {
  const raw = beanPrice(crop) * (buyerNow(s).mul.beans ?? 1);
  if (CROPS[crop].rawOnly) return raw;
  // through the chain: its value + the specialty premium (paid on the dry batch) when a dryer runs
  const prem = buildingsOf(s, RECIPES.dry.building).length ? Math.max(0, beanPrice(crop) - GOODS.beans.price) * (RECIPES.dry.premium || 0) : 0;
  return Math.max(raw, pb + prem);
}
// The plot id of a region.plots entry (reverse lookup by object identity, memoized per region).
function plotIdOf(s, p) {
  const r = region(s);
  if (!r || !p) return null;
  const m = memoOf(r);
  if (!m.plotIds) m.plotIds = new Map(Object.entries(r.plots || {}).map(([id, v]) => [v, id]));
  return m.plotIds.get(p) || null;
}
/** Fields that come with the land (6 per owned field lot). Placing a field is free below this count. */
// Free fields = the tilled rows (game.js autoTill: one per estate bought + one per level), so a cleared field can be put back free.
export const fieldAllowance = s => {
  const r = region(s), t = r?.tilled;
  if (t) return ESTATE_FIELDS * Math.max(1, Object.values(t).reduce((a, b) => a + b, 0));
  const ids = new Set((r?.fields || []).map(f => f.id)); // old save: the rows it already has (game.js tilledOf does the same)
  return ESTATE_FIELDS * Math.max(1, ESTATE_ORDER.flatMap(id => farmLotsOf(ESTATES[id])).filter(id => plotsOf(id).some(p => ids.has(p.id))).length);
};
export const fieldExtras = s => Math.max(0, fieldsOf(s).length - fieldAllowance(s));
/** Price of the next field: free inside the allowance, else the escalating extra price. */
// Balance 2026-11-09 (QA: free beds had no cap, the land filled with beds and nothing else got built): the tilled rows
// (fieldAllowance) stay free; a bed beyond them is new ground to clear (khai hoang, làm đất) and costs the escalating
// FIELD.extra price (no count cap: the price is the brake; every level-up tills 6 more free rows).
export const fieldCost = s => (fieldsOf(s).length < fieldAllowance(s) ? 0 : fieldExtraCost(fieldExtras(s)));
/** Coins back when one field is cleared: half the last extra's price, nothing inside the allowance. */
/** Coins back for removing field `f`: FIELD.refund × what clearing it cost (a free tilled row: 0). */
export const fieldRefund = (s, f) => Math.floor((FIELD.refund || 0) * (f?.spent || 0));
/** A drip line reaches this field (farm-crew.md §3): it is watered without anyone. */
export function dripCovers(s, plotId) {
  const r = region(s);
  if (!r) return false;
  const m = memoOf(r);
  if (!m.drips) m.drips = r.buildings.filter(b => b.type === 'dripLine').map(b => ({ x: b.x, z: b.z, radius: pick(BUILDINGS.dripLine.effect.radius, b.level) }));
  if (!m.drips.length) return false;
  const f = plotOf(s, plotId);
  return !!f && m.drips.some(d => Math.hypot(d.x - f.x, d.z - f.z) <= d.radius);
}
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

/** Shade-tree quality bonus (★) of one field: +stars when its crop is shade-loving and a shade tree stands within reach. */
export function shadeStars(s, plotId, crop) {
  const base = BUILDINGS.shadeTree; const r = region(s);
  if (!r || !base || !base.effect.crops.includes(crop)) return 0;
  const m = memoOf(r);
  // every shade-giving tree counts: the Albizia shade tree and the Cordia, each with its own reach
  if (!m.shade) m.shade = r.buildings.filter(b => b.type === 'shadeTree' || b.type === 'cordia').map(b => ({ x: b.x, z: b.z, r: BUILDINGS[b.type].effect.radius }));
  const f = plotOf(s, plotId);
  return f && m.shade.some(t => Math.hypot(t.x - f.x, t.z - f.z) <= t.r) ? base.effect.stars : 0;
}

export function plotState(s, plotId, now) {
  const r = region(s);
  const p = r ? own(r.plots, plotId) : undefined;
  if (!p) return { stage: 'empty' };
  const total = plotGrowMs(s, p, plotId), elapsed = Math.max(0, now - p.plantedAt);
  const ratio = Math.min(1, elapsed / total);
  return { stage: ratio >= 1 ? 'ready' : ratio < .08 ? 'planted' : 'growing', crop: p.crop, ratio, remainingMs: Math.max(0, total - elapsed),
    age: treeAge(p), old: treeOld(p), young: treeAge(p) === 0 };
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
  if (good === 'beans') { // per variety, dearest first
    const m = beanMix(s), kinds = {};
    let left = n, raw = 0;
    for (const c of BEAN_SELL_ORDER) { const k = Math.min(left, m[c]); if (k > 0) { kinds[c] = k; raw += k * beanPrice(c); left -= k; } }
    return { good, amount: n, kinds, coins: Math.round(raw * (buyerNow(s).mul.beans ?? 1) * 100) / 100 };
  }
  return { good, amount: n, coins: Math.round(n * GOODS[good].price * (buyerNow(s).mul[good] ?? 1) * 100) / 100 }; // the chosen buyer's price
}
/** Units this hauler carries in one trip (its stats). */
export const haulCapacity = u => haulLoadOf(u);
const sumOf = o => Object.values(o || {}).reduce((n, v) => n + v, 0);
export const pileCount = pl => sumOf(pl?.pile);
export const cargoCount = u => sumOf(u?.cargo);
/** Placed storehouses: where haulers bring the harvest. */
export const storeBuildings = s => (region(s)?.buildings || []).filter(b => BUILDINGS[b.type]?.zone === 'farm' && BUILDINGS[b.type].effect?.capacity);
/** Picked cherries wait on the field only when somebody will carry them to a storehouse. */
export const haulActive = s => storeBuildings(s).length > 0 && assignedUnits(s, s.world.currentRegion, 'farm').some(u => u.active !== false && doesJob(u, 'haul'));
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
  if (type === 'field') return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }; // plants go anywhere: a 10 cm grid, so the ghost glides instead of stepping
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
/** Soft warning for a valid spot (built anyway if the player wants): standing in the way of a lane / the gate plaza. */
export function placementWarning(s, type, x, z, rot = 0) {
  const def = defOf(type);
  if (!def || def.zone === 'shop') return null;
  const fp = footprint(type, x, z, rot);
  return RESERVED.some(res => rectsOverlap(fp, res.rect)) ? 'blocked' : null;
}
export function placementError(s, type, x, z, rot = 0, ignoreId = null) {
  const def = defOf(type);
  const r = region(s);
  if (!def || !r || !Number.isFinite(x) || !Number.isFinite(z)) return 'unknown';
  const fp = footprint(type, x, z, rot);
  if (type === 'field' || def.zone === 'farm' || (def.zone === 'any' && areaAt(x, z) === 'farm')) {
    // Free building (founder 2026-11-08): fields, farm buildings and decor go anywhere on a bought tier — roads and lot
    // edges included. Only the map's outside, the gate plaza, the mountain walls / ramps (the ground must be flat under
    // the whole footprint) and other things stop you.
    if (fp[0] < BOUNDS.minX || fp[2] > BOUNDS.maxX || fp[1] < BOUNDS.minZ || fp[3] > BOUNDS.maxZ) return 'outside';
    const cx = (fp[0] + fp[2]) / 2, cz = (fp[1] + fp[3]) / 2;
    const pts = [[fp[0], fp[1]], [fp[2], fp[1]], [fp[0], fp[3]], [fp[2], fp[3]], [cx, cz]];
    const zone = tierZoneAt(cx, cz), eid = ESTATE_ORDER.find(e => ESTATES[e].zone === zone);
    if (type !== 'tierSign' && (!eid || !estateOwned(s, eid))) return 'notOwned'; // a signboard may stand on any tier
    const ys = pts.map(([px, pz]) => farmGroundY(px, pz));
    if (Math.max(...ys) - Math.min(...ys) > .25 || pts.some(([px, pz]) => tierZoneAt(px, pz) !== zone)) return 'mountain';
    // (the gate plaza / lanes are only a warning now: placementWarning)
    for (const f of r.fields || []) if (f.id !== ignoreId && rectsOverlap(fp, fpField(f))) return 'onField';
    for (const b of r.buildings) if (b.uid !== ignoreId && rectsOverlap(fp, fpBuilding(b))) return 'overlap';
    return null;
  }
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
/**
 * The row a stroke from (x0, z0) to (x1, z1) would plant: the line snaps to the nearest 45°, one spot every PLANT_ROW.spacing m.
 * spots: [{ x, z, error }] (error = why this spot is left out: taken, wall, not owned, another terrace, or out of coins).
 * n / cost: the trees it will really plant and what they cost (seeds + clearing past the free rows, the same prices as one by one).
 */
export function rowPlan(s, crop, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, step = Math.PI / 4, a = Math.round(Math.atan2(dz, dx) / step) * step, ux = Math.cos(a), uz = Math.sin(a);
  const count = Math.min(PLANT_ROW.maxTrees, 1 + Math.floor(Math.max(0, dx * ux + dz * uz) / PLANT_ROW.spacing + 1e-6));
  const axis = u => Math.sign(Math.round(u * 1e6)) * Math.ceil(Math.abs(u) * PLANT_ROW.spacing * 10 - 1e-6) / 10, sx = axis(ux), sz = axis(uz); // whole 10 cm steps: neighbours on a diagonal never touch
  const zone = tierZoneAt(x0, z0), allow = fieldAllowance(s), spots = [];
  let coins = s.player.coins, beds = fieldsOf(s).length, seed = seedCost(s, crop), cost = 0, n = 0, error = null, broke = false;
  for (let i = 0; i < count; i++) {
    const p = snapPosition('field', x0 + sx * i, z0 + sz * i, 0);
    let err = broke ? 'coins' : tierZoneAt(p.x, p.z) !== zone ? 'mountain' : placementError(s, 'field', p.x, p.z, 0);
    if (!err) {
      const price = seed + (beds < allow ? 0 : fieldExtraCost(beds - allow));
      if (coins < price) { err = 'coins'; broke = true; }
      else { coins -= price; cost += price; beds++; n++; seed = CROPS[crop].seedCost; } // the free grace seed is only ever the first
    }
    if (err) error ||= err;
    spots.push({ x: p.x, z: p.z, error: err });
  }
  return { spots, n, cost: Math.round(cost * 100) / 100, error, broke, dir: ((Math.round(a / step) % 4) + 4) % 4 };
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
  if (type === 'field') return 9999; // no cap on beds (founder: no count gates) — the extras' escalating price is the brake
  return 9999;
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
  // No level / round / count gates: with the coins you may build and plant anything, as many as you like.
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
  const fd = (r.fields || []).find(f => f.id === id);
  if (fd) return fieldRefund(s, fd);
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
/** recipeIO with the machines around it: a pulper in reach shortens the batch and adds its fee. */
export function recipeIOFor(s, b) {
  const io = recipeIO(b), e = BUILDINGS.pulper.effect;
  if (!io) return io;
  const cut = Math.max(0, ...(region(s)?.buildings || []).filter(m => m.type === 'pulper' && Math.hypot(m.x - b.x, m.z - b.z) <= pick(e.radius, m.level)).map(m => pick(e.timeCut, m.level)));
  return cut > 0 ? { ...io, ms: Math.round(io.ms * (1 - cut)), fee: io.fee + e.fee } : io;
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
  for (const [good, need] of Object.entries(io.in)) { const have = Math.floor(good === 'beans' ? processableBeans(s) : goodCount(s, good)); if (have < need) return { good, need, have }; }
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
  if (s.player.coins < recipeIOFor(s, b).fee) return 'coins';
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
  // (no per-round level cap any more: with the coins, upgrade — founder 2026-11-08)
  if (s.player.coins < cost) return 'coins';
  return null;
}

export function parcelError(s, parcelId) {
  const p = own(PARCELS, parcelId);
  const r = region(s);
  if (!p || !r) return 'unknown';
  if (r.parcels.includes(parcelId)) return 'owned';
  // Estates: a farm lot is bought with its whole estate — in order, from its level, for the estate's price.
  const e = estateOfLot(parcelId);
  if (e) {
    if (nextEstate(s)?.id !== e.id) return 'order';
    if (s.player.coins < e.cost) return 'coins';
    return null;
  }
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
/** The level that lets this zone hire one more; null at the ceiling STAFF_CAP.perZone, where no level helps. */
export function nextHireLevel(s, zone) {
  const n = Math.max(hireCap(s, zone), zoneUnits(s, zone).length);
  return n >= STAFF_CAP.perZone ? null : n + 1;
}
/** Robots of a zone on the whole team; at most robotCap(hireCap) of them (management-rules §2.1). */
export const zoneRobots = (s, zone) => zoneUnits(s, zone).filter(isRobot).length;
/** Robots a zone may still take now (robot share ceil(slots / 2)). */
export const robotRoom = (s, zone) => Math.max(0, robotCap(hireCap(s, zone)) - zoneRobots(s, zone));
export function staffError(s, type) {
  const def = own(STAFF, type);
  if (!def) return 'unknown';
  if (s.player.round < def.round) return 'round';
  if (level(s) < def.level) return 'level';
  if (zoneUnits(s, def.zone).length >= STAFF_CAP.perZone) return 'teamFull';
  if (hireCapReached(s, def.zone)) return 'hireLimit';
  if (def.kind === 'robot' && zoneRobots(s, def.zone) >= robotCap(hireCap(s, def.zone))) return 'robotShare';
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
/** Trades that can apply now: unlocked at this level, the ones the team has fewest of first. */
export function tradesFor(s, zone) {
  const all = RECRUIT.trades[zone] || [], team = t => zoneUnits(s, zone).filter(u => u.type === t).length;
  const gap = zone === 'farm' ? gmCrewGap(s) : [], rank = t => { const i = gap.findIndex(j => STAFF[t].jobs?.includes(j)); return i < 0 ? 99 : i; };
  const open = all.filter(t => STAFF[t].level <= level(s));
  return (open.length ? open : all.slice(0, 1)).map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || team(a.t) - team(b.t) || a.i - b.i).map(x => x.t);
}
export const applicants = (s, zone) => applicantsFor(zone, poolOf(s, zone).seed, tradesFor(s, zone));
/** ms until the board refreshes for free (0 = due now). */
export const poolRefreshIn = (s, zone, now) => Math.max(0, poolOf(s, zone).at + RECRUIT.refreshMinutes * 60000 - now);
export const recruitCost = (s, a) => (freeHire(s) ? 0 : a.cost);
export function recruitError(s, zone, index) {
  const a = RECRUIT.worker[zone] && applicants(s, zone)[index];
  if (!a) return 'unknown';
  const def = STAFF[a.type];
  if (s.player.round < def.round) return 'round';
  if (level(s) < def.level) return 'level';
  if (zoneUnits(s, zone).length >= STAFF_CAP.perZone) return 'teamFull';
  if (hireCapReached(s, zone)) return 'hireLimit';
  if (!freeHire(s) && s.player.coins < a.cost) return 'coins';
  return null;
}
// ---------- quality ★ ----------
/** Stars a staff unit's work gets (robot 1; worker 2 from accuracy QUALITY.workerTwoStar or with goldHands, else 1). */
export const unitStars = u => (isWorkerUnit(u) ? (u.perk === 'goldHands' || statOf(u, 'accuracy') >= QUALITY.workerTwoStar ? 2 : 1)
  : isRobot(u) && hasSoftware(u, 'precision') ? SOFTWARE.packs.precision.stars : 1); // robots: 2★ with the precision pack
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
  if (n >= maxStatOf(u)) return 'maxLevel';
  if (n >= statCap(u, stat)) return 'cap';
  const c = statCostOf(u, n, stat);
  if ((u.points || 0) < c.points) return 'points';
  if (s.player.coins < c.coins) return 'coins';
  return null;
}
/** Price of the next step of `stat`: { points, coins } (null at the top). */
export const statPrice = (u, stat) => (statOf(u, stat) >= maxStatOf(u) ? null : statCostOf(u, statOf(u, stat), stat));
/** Stats of `u` that can be raised right now. */
export const upgradableStats = (s, u) => STAT_ORDER.filter(k => !statError(s, u, k));
// Compatibility with the old single-level training (HUD sheet / toolbar dot): "trainable" = some stat can be raised.
/** XP per skill point (null for robots). */
export const trainNeed = u => (isWorkerUnit(u) ? SKILL.xpPerPoint : null);
export const trainLevel = () => 0;
/** Coins of the cheapest stat step still open (0 when none). */
export const trainFee = u => { const c = STAT_ORDER.filter(k => statOf(u, k) < Math.min(maxStatOf(u), statCap(u, k))).map(k => statCost(statOf(u, k)).coins); return c.length ? Math.min(...c) : 0; };
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
  if (tier >= maxTierOf(u)) return 'maxLevel';
  if (s.player.coins < partCost(u.type, tier, part)) return 'coins';
  return null;
}
export const partPrice = (u, part) => partCost(u.type, partTier(u, part), part);
export const taskError = (u, task) => (!u || !ROBOT_TASKS[u.type] ? 'unknown' : task === 'auto' || ROBOT_TASKS[u.type].includes(task) ? null : 'unknown');
/** Worker tasks (staff/setTasks): null = valid; 'unknown' | 'tooMany'. `tasks` must already be deduped. */
export function tasksError(u, tasks) {
  if (!isWorkerUnit(u) || !Array.isArray(tasks)) return 'unknown';
  const allowed = workerJobs(u);
  if (STAFF[u.type].jobs && tasks.length) return 'unknown'; // a trade has its one job
  if (!tasks.every(t => typeof t === 'string' && allowed.includes(t))) return 'unknown';
  if (tasks.length > taskLimit(u)) return 'tooMany';
  return null;
}
/** Job types a unit takes: a worker's tasks ([] = any), a robot's one task (null = auto). */
export const unitTasks = u => (isWorkerUnit(u) ? (Array.isArray(u.tasks) ? u.tasks : []) : u?.task && u.task !== 'auto' ? [u.task] : []);

// ---------- vitals / states (§3, §4) ----------
// Priority order of the shown state; BLOCKING ones stop all work (hungry / tired only slow it down, unless at 0).
export const UNIT_STATES = ['funny', 'phone', 'battery', 'overheat', 'jam', 'lunch', 'sulking', 'hungry', 'tired', 'ok'];
const BLOCKING = new Set(['funny', 'phone', 'battery', 'overheat', 'jam', 'lunch', 'sulking']);
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
export const CARE_KINDS = ['settle', 'nag', 'bonusSmall', 'coffee', 'food', 'lunch', 'bonus', 'rest', 'recharge', 'cool', 'knock', 'repair', 'service'];
/** Coin price of a care action for `u` (0 = free). */
export function careCost(u, kind) {
  switch (kind) {
    case 'settle': case 'bonusSmall': case 'recharge': return u?.stopped?.fee ?? unitFee(u);
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
    settle: st === 'funny', nag: worker && st === 'phone', bonusSmall: worker && st === 'phone',
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
  const kind = { funny: 'settle', phone: 'bonusSmall', battery: 'recharge', overheat: 'cool', jam: 'repair', sulking: 'bonus', hungry: 'food', tired: 'coffee' }[st];
  return kind ? { kind, cost: careCost(u, kind) } : null;
}

// ---------- upkeep, fire, books (§2, §8) ----------
/** Coins a benched worker costs per UPKEEP.perMinutes (robots and working staff: 0). */
// Bench worker: upkeep; per UPKEEP.perMinutes.
// A robot parked off any zone (unassigned, so off shift) costs its standby (UPKEEP.robotStandbyRatio × price,
// management-rules §2.2 "standby only while unassigned"); benched but still assigned to a zone: free.
export const upkeepOf = u => (u?.follower ? followerWage(u) : isRobot(u) ? (u.active || u.assigned ? 0 : Math.round(UPKEEP.robotStandbyRatio * STAFF[u.type].cost))
  : !isWorkerUnit(u) ? 0 : !u.active ? UPKEEP.benchRatio * STAFF[u.type].cost : 0);
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
export const gearPrice = (u, item) => { const t = gearTier(u, item); return t >= GEAR.maxTier ? null : Math.max(5, Math.round(GEAR.cost[t] * tradeCostMul(u) / 5) * 5); };
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
  if (level(s) < (SOFTWARE.packs[pack].level || 0)) return 'level';
  return s.player.coins < softwarePrice(u, pack) ? 'coins' : null;
}
/** Gear in the store for a zone: [{ i (index in s.staff.gearStock), item, tier }]. */
export const gearStockOf = (s, zone) => (s.staff.gearStock || []).map((g, i) => ({ ...g, i })).filter(g => g.zone === zone);
/** Plants a waterer waters per trip to the well (+ its watering can). */
export const bucketPlots = u => bucketOf(u);
// ---------- general manager (docs/design/general-manager.md) ----------
export const gmUnlocked = s => level(s) >= GM.unlockLevel;
/** The hired GM (or null). */
export const gmOf = s => s.gm?.unit || null;
/** Auto is running the farm: the manager in s.gm.unit is its stand-in, not somebody you hired (AUTO in economy.js). */
export const autoManaged = s => !!s.gm?.unit?.isAuto;
/** A hired manager standing on a farm: the farm only has Auto now, so he is let go with his fee back (auto/retireHired). */
export const hiredOnFarm = s => !!s.gm?.unit && !s.gm.unit.isAuto && regionGame(s) === 'farm';
export const gmBoard = s => gmCandidatesFor(s.gm?.board?.seed ?? 1);
export const gmBoardRefreshIn = (s, now) => Math.max(0, (s.gm?.board?.at || 0) + GM.board.refreshMinutes * 60000 - now);
// Backlog ≥ PENALTY.backlog.waitAt (ignored tasks): he thinks GM.plan.thinkSlowMul × slower (§3.3).
export const gmThinkSeconds = gm => gmThinkOf(gm) * ((gm?.backlog || 0) >= PENALTY.backlog.waitAt ? GM.plan.thinkSlowMul : 1);
/** Base salary per GM.payMinutes in the current mode. */
export const gmPay = s => (gmOf(s) ? gmSalary(gmOf(s), s.gm.mode) : 0);
/** The growth budget per 10 minutes (style: careful uses half; full mode ×3), and what is still left in the window. */
export const gmBudgetCap = s => (s.gm?.unit ? Math.round(Math.max(GM.growth.budgetMin, I10(s) * GM.growth.budgetIncome + (loanTotal(s) > 0 ? 0 : s.player.coins * GM.growth.budgetBank))) : 0); // follows what the farm earns
export function gmBudgetLeft(s, now) {
  const g = s.gm;
  if (!g?.unit) return 0;
  const cap = gmBudgetCap(s);
  const open = g.window && now - g.window.start < GM.windowMinutes * 60000;
  return Math.max(0, cap - (open ? g.window.spent : 0));
}
/** The game zone the GM works in now: the game on screen. */
export const gmZone = s => (regionGame(s) === 'cafe' ? 'shop' : regionGame(s) === 'farm' ? 'farm' : null);
/** Team chaos after a GM left (null when calm). */
export const chaosOf = s => s.gm?.chaos || null;
/** Slack chance factor for a zone: higher while the team has no manager after a poach. */
export function chaosSlackMul(s, zone) {
  if (!chaosOf(s) && !gmStrike(s)) return 1; // a striking manager (Đình công) = chaos rules too (management-rules §4.3)
  return GM.chaos.slackMul;
}
/** Cost of the team meeting that ends the chaos. */
export const calmCost = s => GM.chaos.calmBase + GM.chaos.calmPerUnit * s.staff.units.length;
export const gmAdvisorOf = s => gmOf(s);

// ---------- planner v2 (management-rules §3.3–§3.7) ----------
// The manager's rules are DATA rows (economy.js GM_RULES) over a fixed metric vocabulary (GM_SNAPSHOT_METRICS). One
// snapshot per zone (gmSnapshot), one generic evaluator (gmCandidates), one permission order (gmPermission). The
// builders a row may name (args / cost / valueOf / sale) are the fixed vocabularies RULE_ARGS / RULE_COST / RULE_VALUE.
const PLAN_ZONES = ['farm', 'shop'];
const zoneOfUnit = u => STAFF[u?.type]?.zone || null;
const okOrCoins = e => !e || e === 'coins'; // the planner decides about coins itself (permission: suggest / loan)
/** Licences (Giấy phép, §2.5): the player's; a free group (price 0) is always held; topUp / advice need none. */
export const licencePrice = group => GM.licences.prices[group] ?? 0;
export const gmLicensed = () => true; // the manager holds every power; kept so old callers read the same
/** Why licence `group` cannot be bought now: unknown | owned | level | coins | null. */
export function licenceError(s, group) {
  if (!GM.licences.groups.includes(group)) return 'unknown';
  if (gmLicensed(s, group)) return 'owned';
  if (level(s) < GM.licences.unlockLevel) return 'level';
  if (s.player.coins < licencePrice(group)) return 'coins';
  return null;
}
/** Training (Đào tạo): price of the next skill step, and why it cannot start (unknown | maxLevel | busy | coins). */
export const gmTrainCost = gm => (gm ? GM.training.basePerSkill * ((gm.skill || 1) + 1) : 0);
export function gmTrainError(s) {
  const gm = gmOf(s);
  if (!gm) return 'unknown';
  if ((gm.skill || 1) >= GM.thinkSeconds.length) return 'maxLevel';
  if (gm.training) return 'busy';
  if (s.player.coins < gmTrainCost(gm)) return 'coins';
  return null;
}
/** The zones the manager works: the game on screen, and (off screen) the other zone when units are assigned there. */
export function gmScope(s) {
  const on = gmZone(s);
  return { on, off: PLAN_ZONES.filter(z => z !== on && assignedUnits(s, s.world.currentRegion, z).length > 0) };
}
// ---- values (coins per played minute, management-rules §2.5 / §3.5) ----
/** Best sale value per harvested bean with the processing buildings owned (recipes chained from raw beans). */
export function perBean(s) {
  const rate = { beans: 1 };
  for (const rc of Object.values(RECIPES)) {
    if (!buildingsOf(s, rc.building).length) continue;
    const [inG, inN] = Object.entries(rc.in)[0] || [];
    const [outG, outN] = Object.entries(rc.out)[0] || [];
    if (rate[inG] != null && outG) rate[outG] = Math.max(rate[outG] || 0, rate[inG] * outN / inN);
  }
  return Math.max(...Object.entries(rate).map(([g, r]) => (GOODS[g]?.price || 0) * r));
}
/** Coins one harvest of `crop` brings (yield × per-bean value − seed). */
export const perJobFarm = (s, crop, pb = perBean(s)) => yieldOf(s, crop) * cropBeanValue(s, crop, pb) - seedCost(s, crop) / (CROPS[crop].life || 1); // the sapling is paid once per life
/** Value of one job in a zone: farm = one harvest of the planned / best crop, café = an average cup ÷ jobs per cup. */
export function perJob(s, zone) {
  if (zone === 'shop') {
    const d = unlockedDrinks(s), avg = d.length ? d.reduce((n, id) => n + drinkPrice(s, id), 0) / d.length : DRINKS[DRINK_ORDER[0]].price;
    return avg / GM.value.jobsPerDrink;
  }
  const crop = chooseCrop(s);
  return crop ? Math.max(0, perJobFarm(s, crop)) : 0;
}
/** Jobs per played minute of a unit (reference rate × its speed). */
export const jobsPerMin = u => (GM.value.jobsPerMin[u?.type] || 0) * unitSpeed(u);
/** contrib(u) = jobsPerMin(u) × perJob(zone) (§2.0). */
export const contrib = (s, u, pj = perJob(s, zoneOfUnit(u))) => jobsPerMin(u) * pj;
/** Mandatory running cost per played minute: a worker's slack fees, a robot's recharge + cooling + jams + service. */
export function runCostPerMin(u) {
  if (isRobot(u)) {
    const j = jobsPerMin(u);
    return unitFee(u) / batteryMinutes(u) + CARE.cool * heatPerMin(u) / 100 + jamChance(u) * j * CARE.repair
      + (STAFF[u.type].cost * CARE.serviceRatio) * j * ROBOT_WEAR.wearPerJob * ROBOT_PARTS.frame.wearMul[partTier(u, 'frame')] / 100;
  }
  return STAFF_BREAKS.worker.slackChancePerMinute * slackMul(u) * unitFee(u);
}
/** Every upgrade a unit could get with its value per minute (§2.5 value table): [{ act, cost, value, payback, quality, late }]. */
/** Work the zone can absorb per played minute (its demand in jobs): café = walk-ins per minute × jobsPerDrink, farm =
 *  harvests the owned fields ripen per minute (fields ÷ grow time of the planned / best crop). Infinity without a region. */
/** Jobs a free worker could start RIGHT NOW in a zone (the manager's load sample, GM.load): café = ready cups + taken
 *  orders that fit a free brew slot + waiting customers that fit a free seat; farm = ripe plots (storage room) + empty
 *  plots. Orders stuck behind full brew slots / seats are a building bottleneck: a faster worker does not clear them. */
export function actionableJobs(s, zone, now) {
  const q = taskQueue(s, zone, now);
  if (zone !== 'shop') return (q.harvest || 0) + (q.plant || 0) + (q.water || 0);
  const os = region(s)?.shop.orders || [], brewing = os.filter(o => o.stage === 'brewing' && now < (o.brewStart || 0) + (o.brewMs || 0)).length;
  return (q.deliver || 0) + Math.min(q.brew || 0, Math.max(0, brewSlots(s) - brewing)) + Math.min(q.order || 0, Math.max(0, seatCount(s) - seatsUsed(s)));
}
export function zoneDemandJobs(s, zone) {
  if (!region(s)) return Infinity;
  if (zone === 'shop') return 60000 / Math.max(1, arrivalMs(s)) * GM.value.jobsPerDrink;
  const crop = chooseCrop(s);
  return crop ? ownedPlots(s).length / Math.max(0.01, growMs(s, crop) / 60000) : Infinity;
}
/** Share 0..1 of a throughput step that turns into extra jobs: 1 while the zone's demand is ≥ 10 % above the team's
 *  capacity (Σ jobsPerMin of its working units, `u` included), falling to 0 when the team already covers the demand —
 *  a faster barista in a café that waits for walk-ins, or a faster farmhand on fields that are not ripe, adds nothing. */
export function throughputShare(s, u) {
  const zone = zoneOfUnit(u), load = s.gm?.unit ? s.gm.load?.[zone] : null;
  // with a manager: his measured waiting-jobs EMA (GM.load); without one, the demand model below
  if (Number.isFinite(load)) {
    const n = Math.max(1, assignedUnits(s, s.world.currentRegion, zone).filter(x => x.active).length);
    return Math.min(1, Math.max(0, (load / n - GM.load.free) / GM.load.span));
  }
  const demand = zoneDemandJobs(s, zone);
  if (!Number.isFinite(demand)) return 1;
  const team = assignedUnits(s, s.world.currentRegion, zone).filter(x => x.active && x.uid !== u.uid);
  const cap = team.reduce((n, x) => n + jobsPerMin(x), 0) + jobsPerMin(u);
  return cap > 0 ? Math.min(1, Math.max(0, (demand - cap) / (0.1 * cap))) : 1;
}
export function upgradeOptions(s, u, pj = perJob(s, zoneOfUnit(u)), mistakes = 0) {
  // c: the unit's contribution as far as a throughput step can raise it (× throughputShare: no value past the demand)
  const V = GM.value, Q = UPGRADE_GATE.quality, out = [], c = contrib(s, u, pj) * throughputShare(s, u), R = V.reactionMin, id = u.uid;
  const qualityValue = mistakes / 60 * pj; // mistakes today, as coins per minute (shown, outside the gate)
  const push = (type, payload, cost, value, quality, late, what) => { if (cost > 0 && value > 0) out.push({ act: { type, payload }, cost, value, payback: cost / value, quality, late, what }); };
  if (isWorkerUnit(u)) {
    for (const stat of STAT_ORDER) {
      if (!okOrCoins(statError(s, u, stat))) continue;
      const p = statPrice(u, stat), quality = Q.includes(stat);
      const value = quality ? qualityValue : stat === 'speed' ? V.speedStep * c : stat === 'stamina' ? V.slackStep * runCostPerMin(u) + V.staminaDowntime * c : 0;
      // late: tier ≥ 3, and every stamina step (reliability, like a robot's cooler: management-rules §2.5 table)
      push('staff/upgradeStat', { uid: id, stat }, p.coins, value, quality, statOf(u, stat) >= 3 || stat === 'stamina', { stat });
    }
    for (const item of GEAR.zone[zoneOfUnit(u)] || []) {
      const price = gearPrice(u, item), def = GEAR.items[item];
      if (price == null || !okOrCoins(gearError(s, u, item))) continue;
      const quality = Q.includes(item), throughput = !!(def.walk || def.brew);
      if (!quality && !throughput) continue;
      push('staff/buyGear', { uid: id, item }, price, quality ? qualityValue : V.gearThroughput * c, quality, gearTier(u, item) >= 1, { item });
    }
    return out;
  }
  const P = ROBOT_PARTS, auto = hasSoftware(u, 'autoCharge');
  for (const part of PART_ORDER) {
    if (!okOrCoins(partError(s, u, part))) continue;
    // late = the ≤ 90-min gate: every tier ≥ 2, and the cooler (a reliability part, management-rules §2.5 table).
    const t = partTier(u, part), cost = partPrice(u, part), late = t + 1 >= 2 || part === 'cooler';
    let value = 0;
    if (part === 'battery') {
      if (late && auto) continue; // with Tự sạc the ladder is pure fee: never past tier 1 (§3.7)
      const m0 = P.battery.minutes[t], m1 = P.battery.minutes[t + 1], f = staffFee(u.type);
      value = f * P.battery.feeMul[t] / m0 - f * P.battery.feeMul[t + 1] / m1 + (auto ? 0 : c * (R / (R + m0) - R / (R + m1)));
    } else if (part === 'motor') {
      value = V.motorStep * c - CARE.cool * heatPerMin(u) * (P.motor.heatMul[t + 1] / P.motor.heatMul[t] - 1) / 100;
    } else if (part === 'cooler') {
      value = heatPerMin(u) * (1 - P.cooler.heatMul[t + 1] / P.cooler.heatMul[t]) / 100 * (CARE.cool + c * ROBOT_WEAR.overheatSeconds / 60);
    } else value = jamChance(u) * (1 - P.frame.jamMul[t + 1] / P.frame.jamMul[t]) * jobsPerMin(u) * (CARE.repair + c * R);
    push('staff/upgradePart', { uid: id, part }, cost, value, Q.includes(part), late, { part });
  }
  if (okOrCoins(softwareError(s, u, 'precision'))) push('staff/buySoftware', { uid: id, pack: 'precision' }, softwarePrice(u, 'precision'), V.precision * c, false, false, { pack: 'precision' });
  return out;
}
/** The best throughput upgrade inside the payback gate (or, quality, the best quality one): one option or null. */
export function bestUpgrade(s, u, pj, mistakes = 0, quality = false) {
  const G = UPGRADE_GATE;
  return upgradeOptions(s, u, pj, mistakes).filter(o => (quality ? o.quality : !o.quality && o.payback <= (o.late ? G.latePaybackMin : G.paybackMin)))
    .sort((a, b) => b.value / b.cost - a.value / a.cost)[0] || null;
}
// ---- crops (§3.5) and the day plan's jobs (§3.4) ----
/** min(plotCap, labourCap) of a crop: what the fields and the team can turn into coins per minute. */
export function cropRate(s, crop, pb = perBean(s)) {
  const pj = perJobFarm(s, crop, pb), growMin = growMs(s, crop) / 60000;
  const plotCap = ownedPlots(s).length * pj / Math.max(0.01, growMin);
  const team = assignedUnits(s, s.world.currentRegion, 'farm').filter(u => u.active);
  if (!team.length) return plotCap; // you farm alone: the fields are the limit
  return Math.min(plotCap, team.reduce((n, u) => n + jobsPerMin(u), 0) * pj);
}
/** The crop the manager plants: argmax cropRate over unlocked crops (tie → more XP); null when none. */
export function chooseCrop(s) {
  const pb = perBean(s);
  return unlockedCrops(s).map(id => ({ id, r: cropRate(s, id, pb) })).sort((a, b) => b.r - a.r || CROPS[b.id].xp - CROPS[a.id].xp)[0]?.id || null;
}
/** Best unlocked crop for one field's growing zone. Value of one harvest = coins (yield × bean value − seed) + XP ×
 *  CLIMATE_PICK.xpCoins (levels matter as much as coins); rate = min(fields × value / grow time, labour × value / 2)
 *  where labour = the farm team's jobs per minute + CLIMATE_PICK.soloJobsPerMin (you), a season = 1 job (the pick;
 *  Liberica 2) and the sapling is spread over the tree's life. Wrong-zone penalties (time, ★) included. */
export function bestCropFor(s, plotId, pb = perBean(s)) {
  return unlockedCrops(s).map(id => ({ id, r: cropRateFor(s, plotId, id, pb) })).sort((a, b) => b.r - a.r || CROPS[b.id].xp - CROPS[a.id].xp)[0]?.id || null;
}
/** Value per minute of `crop` on one field (see bestCropFor). */
export function cropRateFor(s, plotId, id, pb = perBean(s)) {
  const zone = climateOfPlot(s, plotId), fields = Math.max(1, ownedPlots(s).length);
  const team = assignedUnits(s, s.world.currentRegion, 'farm').filter(u => u.active);
  const labour = (team.length ? team.reduce((n, u) => n + jobsPerMin(u), 0) : 0) + CLIMATE_PICK.soloJobsPerMin;
  const e = climateEffect(id, zone) || {}, st = Math.max(1, Math.min(3, 3 + (e.stars || 0)));
  const v = Math.max(1, Math.round(yieldOf(s, id) * (QUALITY.yield[st] || 1))) * cropBeanValue(s, id, pb) - seedCost(s, id) / (CROPS[id].life || 1) + CROPS[id].xp * CLIMATE_PICK.xpCoins;
  const w = CROPS[id].waves, jobs = w ? 2 : 1; // one season of a grown tree = 1 pick (Liberica 2); the sapling is paid once per life
  const min = (growMs(s, id) + (w ? w.regrowSeconds * 1000 : 0)) * (e.timeMul || 1) / 60000;
  return Math.min(fields * v / Math.max(.01, min), labour * v / jobs);
}
/** A tree worth replacing: a better variety for this field's zone is unlocked and earns ≥ CLIMATE_PICK.switchMul × the
 *  tree's own (an old tree counts at PERENNIAL.oldYield). */
export function betterCropFor(s, plotId) {
  const p = region(s)?.plots[plotId];
  if (!p) return null;
  const pb = perBean(s), best = bestCropFor(s, plotId, pb);
  if (!best || best === p.crop) return null;
  return cropRateFor(s, plotId, best, pb) >= CLIMATE_PICK.switchMul * cropRateFor(s, plotId, p.crop, pb) * (treeOld(p) ? PERENNIAL.oldYield : 1) ? best : null;
}
/** Crop to plant on a field now: `preferred` when unlocked and affordable, else the best for the field's growing zone,
 *  else the cheapest affordable one (null when none). */
export function pickCropFor(s, plotId = null, preferred = null) {
  const ok = c => !!c && cropUnlocked(s, c) && seedCost(s, c) <= s.player.coins;
  if (ok(preferred)) return preferred;
  // With a manager running the farm, a crop the zone penalises is planted only when nothing else can be (Farm Manager V2, R1).
  const zone = plotId && s.gm?.unit ? climateOfPlot(s, plotId) : null, fits = c => !zone || climateFit(c, zone) !== 'bad';
  const best = plotId ? bestCropFor(s, plotId) : chooseCrop(s);
  if (ok(best) && fits(best)) return best;
  const open = unlockedCrops(s).filter(ok);
  const suited = open.filter(fits);
  if (suited.length) return plotId ? suited.sort((a, b) => cropRateFor(s, plotId, b) - cropRateFor(s, plotId, a))[0] : suited[0];
  if (ok(best)) return best;
  return open.sort((a, b) => seedCost(s, a) - seedCost(s, b))[0] || null;
}
/** A crop an unskilled worker can plant on this field now: the easy varieties, suited ones first (null when none). */
export function easyCropFor(s, plotId, isHard) {
  const open = unlockedCrops(s).filter(c => !isHard(c) && seedCost(s, c) <= s.player.coins);
  if (!plotId) return open[0] || null;
  const zone = climateOfPlot(s, plotId);
  return open.find(c => climateFit(c, zone) !== 'bad') || open[0] || null;
}
/** Harvest urgency of a ripe field: Arabica (its cherries fall) > Liberica (first pick) > the rest; older first within. */
export function harvestUrgency(s, plotId, now) {
  const p = region(s)?.plots[plotId];
  if (!p) return -Infinity;
  const over = (now - p.plantedAt - plotGrowMs(s, p, plotId)) / 60000, c = CROPS[p.crop];
  return (c?.drop ? 20 : c?.waves && !p.wave ? 10 : 0) + over;
}
/** The planned crop for a field (its parcel's), when a manager runs the plan; else null (the worker brain picks). */
export function planCropFor(s, plotId) {
  const g = s.gm;
  if (!g?.unit || g.mode === 'advisor' || gmStrike(s) || !g.plan?.crops) return null;
  const parcel = plotOf(s, plotId)?.parcel, crop = parcel ? g.plan.crops[parcel] : null;
  return crop && cropUnlocked(s, crop) ? crop : null;
}
/** Work waiting per job type of a zone (need = queued / (1 + units on it)). */
export function taskQueue(s, zone, now) {
  const r = region(s);
  if (!r) return {};
  if (zone === 'farm') {
    const plots = ownedPlots(s), st = plots.map(p => (r.plots[p.id] ? plotState(s, p.id, now).stage : 'empty'));
    const tending = assignedUnits(s, s.world.currentRegion, 'farm').some(u => (u.water || 0) > 0);
    return { harvest: storageRoom(s) > 0 ? st.filter(x => x === 'ready').length : 0, plant: st.filter(x => x === 'empty').length,
      water: tending ? plots.filter((p, i) => st[i] !== 'empty' && st[i] !== 'ready' && !r.plots[p.id]?.watered).length : 0 };
  }
  const os = r.shop.orders || [];
  return { order: os.filter(o => o.stage === 'waiting').length, brew: os.filter(o => o.stage === 'taken').length,
    deliver: os.filter(o => o.stage === 'brewing' && now >= (o.brewStart || 0) + (o.brewMs || 0)).length };
}
/**
 * The day plan's assignments for a zone: { workers: { uid: tasks[] }, robots: { uid: task } }. Robots take the job with
 * the most need (or 'auto'); workers the top taskLimit jobs by need × fit (fit = fitBase + fitPerStat × the job's stat),
 * every job family keeping at least one unit. A team smaller than the job families keeps "everything" ([]).
 */
export function planTasks(s, zone, now) {
  const P = GM.plan, q = taskQueue(s, zone, now), here = assignedUnits(s, s.world.currentRegion, zone);
  const on = {}, out = { workers: {}, robots: {} };
  const need = t => ((q[t] || 0) + 0.01) / (1 + (on[t] || 0)); // + a hair: an empty queue still ranks by fit
  for (const r of here.filter(isRobot).sort((a, b) => a.uid.localeCompare(b.uid))) {
    const list = ROBOT_TASKS[r.type] || [];
    const best = list.filter(t => (q[t] || 0) > 0).sort((a, b) => need(b) - need(a))[0];
    out.robots[r.uid] = best || 'auto';
    for (const t of best ? [best] : list) on[t] = (on[t] || 0) + 1;
  }
  const workers = here.filter(isWorkerUnit).sort((a, b) => a.uid.localeCompare(b.uid));
  if (workers.every(w => STAFF[w.type].jobs)) { for (const w of workers) out.workers[w.uid] = []; return out; } // trades have one job each: nothing to plan
  const core = (WORKER_TASKS[zone] || []).filter(t => t !== 'water' || (q.water || 0) > 0);
  const fit = (w, t) => P.fitBase + P.fitPerStat * statOf(w, P.statOf[t] || 'speed');
  // café workers keep 'everything' (their posts already re-split order / brew / deliver every second): the sim measured
  // a 20-min fixed list costing the café 9–14 coins/min of net worth (balance pass 2026-11-08, GM.plan.lockWorkers)
  if (!GM.plan.lockWorkers[zone] || workers.length < core.filter(t => !(on[t] > 0)).length) { for (const w of workers) out.workers[w.uid] = []; return out; }
  for (const w of workers) {
    const mine = [];
    for (let k = 0; k < taskLimit(w); k++) {
      const t = core.filter(x => !mine.includes(x)).sort((a, b) => need(b) * fit(w, b) - need(a) * fit(w, a))[0];
      if (!t) break;
      mine.push(t); on[t] = (on[t] || 0) + 1;
    }
    out.workers[w.uid] = mine;
  }
  // every family keeps ≥ 1 unit: take it from a family that has two or more
  for (const t of core.filter(x => !(on[x] > 0))) {
    const w = workers.map(x => ({ x, fit: fit(x, t) })).sort((a, b) => b.fit - a.fit).find(({ x }) => out.workers[x.uid].length < taskLimit(x) || out.workers[x.uid].some(y => on[y] > 1));
    if (!w) continue;
    const list = out.workers[w.x.uid];
    if (list.length >= taskLimit(w.x)) { const drop = list.find(y => on[y] > 1); list.splice(list.indexOf(drop), 1); on[drop]--; }
    list.push(t); on[t] = 1;
  }
  return out;
}
// ---- land utilisation (§3.6), sampled once per played minute into s.gm.util ----
/** One utilisation sample of the region now: { z: { zone: busy share }, p: { parcelId: busy share }, q: { building type: 1 when its queue is full } }. */
export function utilSample(s) {
  const r = region(s), out = { z: {}, p: {}, q: {} };
  if (!r) return out;
  const plots = ownedPlots(s), per = {};
  for (const p of plots) { const k = p.parcel || '?'; (per[k] ||= [0, 0])[1]++; if (r.plots[p.id]) per[k][0]++; }
  for (const [k, [b, n]] of Object.entries(per)) if (k !== '?') out.p[k] = Math.round(b / n * 1000) / 1000;
  if (plots.length) out.z.farm = Math.round(plots.filter(p => r.plots[p.id]).length / plots.length * 1000) / 1000;
  for (const type of [...new Set((r.buildings || []).filter(b => recipeOf(b)).map(b => b.type))]) {
    const list = buildingsOf(s, type);
    if (list.every(b => b.job) && list.some(b => !missingInput(s, b))) out.q[type] = 1;
  }
  return out;
}
const utilRows = s => s.gm?.util?.rows || [];
/** Mean busy share of a zone / a parcel over the sampled window (null without samples). */
export function utilisation(s, { zone = null, parcel = null } = {}) {
  const v = utilRows(s).map(r => (parcel ? r.p?.[parcel] : r.z?.[zone])).filter(x => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
/** How many of the sampled minutes include parcel `id` (a lot bought lately has few). */
const utilSamples = (s, id) => utilRows(s).filter(r => Number.isFinite(r.p?.[id])).length;
/** Played minutes a building type's production queue has been full without a break (newest samples first). */
export function prodFullMin(s, type) {
  const rows = utilRows(s);
  let n = 0;
  for (let i = rows.length - 1; i >= 0 && rows[i].q?.[type]; i--) n++;
  return n;
}
/** Why parcel `id` cannot be sold: unknown | notOwned | starter | last | buildings | null. Refund = LAND.sellRefund × price. */
export function landSellError(s, id) {
  const p = own(PARCELS, id), r = region(s);
  if (!p || !r || areaOfParcel(id) !== 'farm') return 'unknown';
  if (!r.parcels.includes(id)) return 'notOwned';
  if (p.starter) return 'starter';
  if (estateOfLot(id)) return 'estate'; // estates are never sold lot by lot
  if (r.parcels.filter(x => x !== id && own(PARCELS, x) && areaOfParcel(x) === 'farm' && PARCELS[x].kind === p.kind).length === 0) return 'last';
  if ((r.buildings || []).some(b => !BUILDINGS[b.type]?.walkable && inRect(b.x, b.z, p.rect))) return 'buildings';
  return null;
}
export const landSellRefund = id => Math.floor(LAND.sellRefund * (own(PARCELS, id)?.cost || 0));
/** A loan pack that pays for a capital job the coins cannot (§3.7), or null: the smallest allowed pack covering the gap whose term > payback / share. */
export function gmLoanFor(s, c) {
  if (autoManaged(s) || c.group !== 'capital' || !gmLicensed(s, 'credit') || c.act?.type?.startsWith('loan/')) return null; // Auto never borrows: the debt would outlive the run
  const gap = c.cost - s.player.coins;
  const pack = LOAN.packs.filter(a => a >= gap && !loanError(s, a))[0];
  if (!pack) return null;
  const term = loanTerm(s, pack), payback = c.cost / Math.max(0.01, c.value || 0);
  return payback < term * GM.loanRule.paybackTermShare ? { amount: pack, termMin: term, payback } : null;
}
// ---- the snapshot (fixed vocabulary, GM_SNAPSHOT_METRICS) ----
const statSum = st => STAT_ORDER.reduce((n, k) => n + (st?.[k] || 1), 0);
let boardMemo = { s: null, b: [] };
const farmBoard = s => { if (boardMemo.s !== s) boardMemo = { s, b: applicants(s, 'farm') }; return boardMemo.b; };
/** Worth replacing: someone on the board for the same trade is clearly better, or at least as good and this one keeps causing trouble or is lazy. */
function isWeak(s, u, log) {
  const me = STAT_ORDER.reduce((n, k) => n + statOf(u, k), 0), trouble = log.filter(e => e.type === 'funny').length, avail = gmSpendable(s);
  return farmBoard(s).some(a => a.type === u.type && a.cost <= avail && (statSum(a.stats) >= me + 2 || (statSum(a.stats) >= me && (trouble >= 2 || (u.trait === 'lazy' && a.trait !== 'lazy')))));
}
/** The next upgrade of a unit when money is waiting: what stops it doing work first, its lowest number first. */
function richUpOf(s, u, pj = perJob(s, 'farm')) {
  if (zoneOfUnit(u) !== 'farm') return null;
  const avail = gmSpendable(s), worth = c => c <= contrib(s, u, pj) * GM.growth.upgradePaybackMin; // it must earn itself back
  if (isRobot(u)) {
    const part = ['frame', 'motor', 'battery', 'cooler'].filter(k => !partError(s, u, k)).sort((a, b) => partTier(u, a) - partTier(u, b))[0];
    if (!part) return null;
    const cost = partPrice(u, part);
    return avail >= cost * 5 && worth(cost) ? { cost, act: { type: 'staff/upgradePart', payload: { uid: u.uid, part } } } : null;
  }
  const stat = ['smart', 'stamina', 'accuracy', 'speed'].filter(k => !statError(s, u, k)).sort((a, b) => statOf(u, a) - statOf(u, b))[0];
  if (!stat) return null;
  const cost = statCostOf(u, statOf(u, stat), stat).coins;
  return avail >= cost * 3 && worth(cost) ? { cost, act: { type: 'staff/upgradeStat', payload: { uid: u.uid, stat } } } : null;
}
function unitSnap(s, u, now, pj, today) {
  const st = unitState(u, now), n = needs(u), robot = isRobot(u), log = unitLog(u).filter(e => dayKey(e.at) === today);
  const mistakes = dayRow(u, today)?.mistakes || 0;
  const up = bestUpgrade(s, u, pj, mistakes), ql = bestUpgrade(s, u, pj, mistakes, true);
  const g = !robot && unitGrade(s, u, today), y = !robot && unitGrade(s, u, lastDays(now, 2)[0]);
  const morale = u.morale ?? VITALS.start.morale;
  return { id: u.uid, u, kind: robot ? 'robot' : 'worker', zone: zoneOfUnit(u), state: st, onShift: !!u.active && !u.stopped && !Number.isFinite(u.breakUntil),
    hungry: !robot && (n.hungry || (u.fullness ?? 100) <= 0), tired: !robot && (n.tired || (u.energy ?? 100) <= 0), sulking: !robot && !!n.sulking, morale,
    phoneSoft: !robot && (morale < GM.planRules.phoneMoraleBelow || log.some(e => e.type === 'nagged' && now - e.at < GM.planRules.nagEverySeconds * 1000)),
    wear: robot ? (u.wear ?? 100) : 100,
    recharges: log.filter(e => (e.type === 'cared' || e.type === 'autoCare') && e.extra === 'recharge').length,
    jams: log.filter(e => e.type === 'jam').length, overheats: log.filter(e => e.type === 'overheat').length, mistakes: robot ? log.filter(e => e.type === 'jam').length : mistakes,
    gradeD2: g?.letter === 'D' && y?.letter === 'D',
    weak: !robot && zoneOfUnit(u) === 'farm' && isWeak(s, u, log), richUp: richUpOf(s, u, pj)?.cost || 0,
    funnyWorth: u.stopped?.kind === 'funny' && ((u.stopped.fee || 0) <= contrib(s, u, pj) * FUNNY.paybackMin || log.filter(e => e.type === 'funny').length < FUNNY.fireAfterToday),
    upgrade: up, upgradeBest: up ? up.value / up.cost : 0, quality: ql, qualityBest: ql ? ql.value / ql.cost : 0,
    canCharge: robot && okOrCoins(softwareError(s, u, 'autoCharge')), canUnjam: robot && okOrCoins(softwareError(s, u, 'autoUnjam')),
    contrib: contrib(s, u, pj) };
}
/** The manager's view of one zone now (the metric vocabulary of GM_RULES). */
export function gmSnapshot(s, now, zone, offscreen = false) {
  const r = region(s), cur = s.world.currentRegion, here = assignedUnits(s, cur, zone), g = s.gm, today = dayKey(now);
  const pj = perJob(s, zone), units = here.map(u => unitSnap(s, u, now, pj, today));
  const workersHere = here.filter(isWorkerUnit), wallet = gmCareWalletLeft(s);
  const snap = { zone, offscreen, units, buildings: [], coins: s.player.coins, owed: loanTotal(s), I10: I10(s), I30: I30(s), perJob: pj,
    workers: workersHere.length, robots: here.length - workersHere.length,
    blockedUnits: here.filter(u => unitBlocked(u, now)).length, idleUnits: here.filter(u => u.active && !unitBlocked(u, now) && !unitTasks(u).length).length,
    moraleMin: Math.min(100, ...workersHere.map(u => u.morale ?? VITALS.start.morale)),
    careNeed: units.filter(x => ['funny', 'battery', 'overheat', 'phone', 'sulking'].includes(x.state) || x.hungry || x.tired).length,
    tiredOn: workersHere.some(u => u.active && (u.energy ?? 100) < SHIFT.tiredBelow),
    restedOff: workersHere.some(u => !u.active && (u.energy ?? 100) >= SHIFT.restedFrom && !unitBlocked(u, now)),
    freeSlots: freeSlots(s, zone), hireRoom: Math.max(0, Math.min(hireCap(s, zone), STAFF_CAP.perZone) - zoneUnits(s, zone).length), robotRoom: robotRoom(s, zone),
    storagePct: 0, storageValue: 0, saleBlocked: false, ripeWaiting: 0, emptyPlots: 0, busyPct: 0, waitingOrders: 0, takenOrders: 0, readyCups: 0,
    beans: s.inventory.beans || 0, beanNeed: 0, beansLow: false, landBuyOk: false, landSellOk: false, buildUpOk: false, repayRoom: 0, topUpDue: false, trainDue: false,
    poachHere: false, piling: 0, robotWorth: -1 };
  snap.careShort = snap.careNeed > 0 && s.player.coins < wallet;
  const q = taskQueue(s, zone, now);
  if (zone === 'farm' && r) {
    const cap = capacity(s), plots = ownedPlots(s);
    snap.storagePct = cap > 0 ? stored(s) / cap : 0;
    snap.storageValue = sellAllQuote(s).coins || 0;
    snap.saleBlocked = ['sellFull', 'sellCare'].some(k => taskPending(s, k) || taskCooling(s, k)); // one «Bán hết» at a time
    snap.ripeWaiting = plots.filter(p => r.plots[p.id] && plotState(s, p.id, now).stage === 'ready').length;
    snap.emptyPlots = plots.filter(p => !r.plots[p.id]).length;
    snap.busyPct = plots.length ? plots.filter(p => r.plots[p.id]).length / plots.length : 0;
    snap.piling = snap.ripeWaiting;
    // land-bound farm (founder 2026-11-08: "many staff, 2 lots"): no more hands than plots can feed — one farm unit per
    // GM.planRules.plotsPerWorker plots; past that, land is the bottleneck and the manager asks for land, not people
    snap.hireRoom = Math.min(snap.hireRoom, Math.max(0, Math.ceil(plots.length / GM.planRules.plotsPerWorker) - zoneUnits(s, zone).length));
    snap.buildings = (r.buildings || []).filter(b => recipeOf(b)).map(b => ({ id: b.uid, b, prodReady: !!b.job && !collectError(s, b, now), prodIdle: !b.job && okOrCoins(prodError(s, b)) && !missingInput(s, b) }));
    if (!offscreen) Object.assign(snap, landSnap(s, snap), buildSnap(s));
  } else if (zone === 'shop' && r) {
    const os = r.shop.orders || [];
    snap.waitingOrders = q.order || 0; snap.takenOrders = q.brew || 0; snap.readyCups = q.deliver || 0;
    snap.beanNeed = os.filter(o => o.stage === 'taken' || o.stage === 'waiting').reduce((n, o) => n + (DRINKS[o.drink]?.beans || 1), 0);
    const bq = beanBuyQuote(s);
    snap.beansLow = snap.beanNeed > 0 && snap.beans < 2 * snap.beanNeed && !(bq.error && bq.error !== 'coins') && bq.amount > 0;
    snap.piling = snap.waitingOrders;
  }
  // hiring: a robot only when it beats a worker after its running cost (§3.7)
  const rType = STAFF_ORDER.find(t => STAFF[t].kind === 'robot' && STAFF[t].zone === zone), wType = RECRUIT.worker[zone];
  if (rType && wType && level(s) >= STAFF[rType].level) { const rb = { type: rType }, wk = { type: wType }; snap.robotWorth = contrib(s, rb, pj) - runCostPerMin(rb) - contrib(s, wk, pj); }
  const p = workerPoach(s), pu = p && unitOf(s, p.uid);
  snap.poachHere = !!pu && zoneOfUnit(pu) === zone;
  if (!offscreen) {
    // repay alone from surplus (§3.7): coins ≥ owed + care wallet + autoLimit → up to autoLimit
    const owed = loanTotal(s);
    if (owed > 0 && g?.unit && s.player.coins >= owed + gmCareWallet(s) + g.budget) snap.repayRoom = Math.min(Math.floor(owed), g.budget);
    snap.topUpDue = topUpDue(s, now);
    snap.trainDue = !!gmTrainDue(s);
    snap.buildItems = zone === 'farm' ? gmBuildNeeds(s) : [];
    snap.crewGap = zone === 'farm' && gmCrewGap(s, now).length > 0 && zoneUnits(s, 'farm').length < hireCap(s, 'farm');
    snap.fieldSpots = zone === 'farm' ? gmFieldSpots(s, now) : [];
  }
  return snap;
}
/** Farm with more hands than land (units × plotsPerWorker > plots): the manager proposes land more often. */
export const landBound = s => zoneUnits(s, 'farm').length * GM.planRules.plotsPerWorker > ownedPlots(s).length;
export const landEveryMin = s => (landBound(s) ? GM.land.boundEveryMin : GM.land.everyMin);
function landSnap(s, snap) {
  const L = GM.land, out = { landBuyOk: false, landSellOk: false, landBuy: null, landSell: null };
  const crop = chooseCrop(s);
  if (!crop) return out;
  const perPlot = Math.max(0, perJobFarm(s, crop)) / Math.max(0.01, growMs(s, crop) / 60000);
  const zoneUse = utilisation(s, { zone: 'farm' }) ?? snap.busyPct;
  // BUY: the cheapest field lot for sale
  const est = nextEstate(s), lot = est && !parcelError(s, est.seed) ? est.seed : null; // estates: the next estate, once its level is reached
  if (lot) {
    const price = parcelCost(lot), fields = ESTATE_FIELDS;
    const earn = fields * perPlot * Math.max(0.05, zoneUse), payback = price / Math.max(0.01, earn);
    const pay = s.player.coins >= L.coinsMul * price || !!gmLoanFor(s, { group: 'capital', cost: price, value: earn, act: { type: 'land/buyParcel' } });
    out.landBuy = { parcelId: lot, price, payback, value: earn };
    // land is needed when every field is planted or the crew outgrew it, whatever the payback estimate says
    const plotsN = ownedPlots(s).length, tight = plotsN > 0 && (snap.emptyPlots === 0 || plotsN <= zoneUnits(s, 'farm').length * GM.planRules.plotsPerWorker);
    const rich = plotsN >= 6 && s.player.coins >= price * 2; // money sitting idle: open the next tier now
    const earns = price / Math.max(0.01, GM.growth.landFields * perPlot) <= GM.growth.landPaybackMin; // a tier full of fields must pay it back
    out.landBuyOk = pay && earns && (tight || rich || (payback <= L.buyPaybackMin && snap.busyPct >= L.busyPct));
  }
  // SELL: a lot used < sellUtil over the whole window whose refund beats LAND.sellPaybackMin of its income
  if (utilRows(s).length >= L.windowMin) {
    const r = region(s);
    // a lot is judged on its own GM.land.windowMin samples: one bought minutes ago (fields not planted yet) never qualifies
    const lot2 = r.parcels.filter(id => !landSellError(s, id) && utilSamples(s, id) >= L.windowMin).map(id => ({ id, u: utilisation(s, { parcel: id }) ?? 1 })).filter(x => x.u < L.sellUtil).sort((a, b) => a.u - b.u || a.id.localeCompare(b.id))[0];
    if (lot2) {
      const refund = landSellRefund(lot2.id), fields = ownedPlots(s).filter(p => p.parcel === lot2.id).length;
      const keepValue = LAND.sellPaybackMin * fields * perPlot * lot2.u;
      out.landSell = { parcelId: lot2.id, refund, value: refund / LAND.sellPaybackMin };
      out.landSellOk = s.player.coins < gmCareWallet(s) || refund >= keepValue;
    }
  }
  return out;
}
function buildSnap(s) {
  const B = GM.building;
  let best = null;
  for (const type of [...new Set((region(s)?.buildings || []).filter(b => recipeOf(b)).map(b => b.type))]) {
    if (prodFullMin(s, type) < B.fullMin) continue;
    const b = buildingsOf(s, type).filter(x => okOrCoins(upgradeError(s, x))).sort((a, c) => a.level - c.level)[0];
    if (!b) continue;
    const rc = recipeOf(b), def = BUILDINGS[type];
    const margin = Object.entries(rc.out).reduce((n, [g, k]) => n + (GOODS[g]?.price || 0) * k, 0) - Object.entries(rc.in).reduce((n, [g, k]) => n + (GOODS[g]?.price || 0) * k, 0) - rc.fee;
    const rate = lv => pick(def.effect.batch, lv) * pick(def.effect.speed, lv) * 60 / rc.seconds * margin;
    const value = rate(b.level + 1) - rate(b.level), cost = upgradeCost(type, b.level);
    if (!(value > 0) || cost / value > B.paybackMin) continue;
    if (!best || value / cost > best.value / best.cost) best = { uid: b.uid, type, cost, value };
  }
  return { buildUpOk: !!best, buildUp: best };
}
/** Real-money top-up proposal due (§3.7): ≥ afterDenied denied loan tasks today, I10 < incomeShare × plan.target, ≤ perDay. */
export function topUpDue(s, now) {
  const T = GM.topUp, t = s.gm?.topUp;
  if (!t || t.d !== dayKey(now) || (t.denied || 0) < T.afterDenied || (t.filed || 0) >= T.perDay) return false;
  return !!s.gm?.plan?.target && I10(s) < T.incomeShare * s.gm.plan.target && !tasksOpen(s).some(x => x.kind === 'topUp');
}
/** Training pays (§3.7): more candidates than actions for trainThinks thinks in a row, and the extra actions repay the fee in time. */
// What the crew is missing, most basic first: he buys it and finds it a spot next to the fields (any tier).
// Layout that leaves room to grow: each tier keeps a service strip along one edge for buildings that reach nothing (storage,
// processing); fields fill the rest. Things with a radius go where they newly cover the most fields.
const SERVICE_DEPTH = 3.4, SERVICE_XS = [3, -3, 6, -6, 9, -9, 12, -12, 15, -15, 18, -18, 21, -21, 24, -24];
const onRoad = (x, z, pad = .8) => ROAD_LIST.some(d => x >= d.rect[0] - pad && x <= d.rect[2] + pad && z >= d.rect[1] - pad && z <= d.rect[3] + pad);
function serviceSpot(s, type, tier) {
  const z0 = TIER_ROWS[tier][0];
  for (const z of [z0 + .9, z0 + 2.5]) for (const x of SERVICE_XS) {
    const pos = snapPosition(type, x, z, 0);
    if (tierIndexAt(pos.x, pos.z) === tier && !onRoad(pos.x, pos.z) && !placementError(s, type, pos.x, pos.z, 0)) return pos;
  }
  return null;
}
function coverSpot(s, type, tier, plots, covered) {
  const raw = BUILDINGS[type].effect?.radius, radius = Array.isArray(raw) ? raw[0] : raw, open = plots.filter(p => !covered(p));
  let best = null, bn = 0;
  for (const p of open.slice(0, 8)) for (const r of [2.4, 4.8, 7.2]) for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, pos = snapPosition(type, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 0);
    if (tierIndexAt(pos.x, pos.z) !== tier || placementError(s, type, pos.x, pos.z, 0)) continue;
    const n = open.filter(q => Math.hypot(q.x - pos.x, q.z - pos.z) <= radius).length;
    if (n > bn) { bn = n; best = pos; }
  }
  return best;
}
function gmBuildSpot(s, type, rings = [3.5, 5.5, 7.5], anchors = ownedPlots(s).slice(-16).reverse(), tier = null) {
  const here = pos => tier == null || tierIndexAt(pos.x, pos.z) === tier; // a tier's building stands on that tier
  for (const p of anchors) for (const r of rings) for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, pos = snapPosition(type, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 0);
    if (here(pos) && !placementError(s, type, pos.x, pos.z, 0)) return pos;
  }
  for (const z of [10, 6, 14, 2, 18, -8, -14, -28, -38, -58, -66]) for (const x of [-8, 8, -12, 12, -16, 16, -20, 20, -24, 24, -4, 4]) {
    const pos = snapPosition(type, x, z, 0);
    if (here(pos) && !placementError(s, type, pos.x, pos.z, 0)) return pos;
  }
  return null;
}
// Everything the farm can use, most basic first, several at once: storage, a water tank and later a drip line and shade on
// every tier with fields, enough processing for the harvest, the machines, then upgrades of what stands.
const UPGRADE_FIRST = ['silo', 'well', 'dryer', 'wetMill', 'dripLine', 'pulper'];
function gmBuildNeeds(s) {
  const r = region(s), crew = assignedUnits(s, s.world.currentRegion, 'farm').filter(u => u.active !== false), out = [];
  if (!r) return out;
  const plots = ownedPlots(s), planted = plots.filter(p => r.plots[p.id]).length, has = job => crew.some(u => doesJob(u, job)), avail = gmSpendable(s);
  const add = (type, key, anchors, basic = true, tier = null) => {
    const cost = buildCost(s, type);
    if (out.length >= 6 || buildError(s, type) || (!basic && (avail < cost * 4 || cost > I10(s) * 2))) return; // extras are paid out of earnings
    const def = BUILDINGS[type], here = tier == null ? [] : tierPlots(tier);
    const planned = tier == null ? null : def.effect?.radius != null ? coverSpot(s, type, tier, here, p => (type === 'well' ? wellBonus(s, p.id) > 0 : type === 'dripLine' ? dripCovers(s, p.id) : false)) : serviceSpot(s, type, tier);
    const spot = planned || gmBuildSpot(s, type, undefined, anchors, tier);
    if (spot) out.push({ ok: true, basic, type, key, x: spot.x, z: spot.z, cost, value: basic ? Math.max(5, cost) : cost / 4 });
  };
  const tierPlots = t => plots.filter(p => tierIndexAt(p.x, p.z) === t);
  const onTier = (type, t) => buildingsOf(s, type).some(b => tierIndexAt(b.x, b.z) === t);
  // More storage only for a harvest that keeps moving: beans waiting for your signature are sold, not housed in new sheds.
  const saleWaiting = tasksOpen(s).some(t => /^farm\/sell/.test(t.act?.type || ''));
  // Every tier gets its share: the next building of a kind goes to the tier that has the fewest of it.
  const open = [0, 1, 2, 3].filter(t => tierPlots(t).length), count = (types, t) => types.reduce((n, y) => n + buildingsOf(s, y).filter(b => tierIndexAt(b.x, b.z) === t).length, 0);
  const thinnest = types => [...open].sort((a, b) => count(types, a) - count(types, b) || tierPlots(b).length - tierPlots(a).length)[0] ?? null;
  const addOn = (type, key, t, basic = true) => add(type, key, t == null ? undefined : tierPlots(t).slice(0, 12), basic, t);
  const full = capacity(s) > 0 && stored(s) / capacity(s) >= 0.8, short = farmStaffing(s).storage.short; // the second: what is picked before it sells does not fit
  if (!countOf(s, 'silo') || ((full || short) && !saleWaiting)) { const t = thinnest(['silo']); addOn('silo', `silo:${t}:${countOf(s, 'silo')}`, t, !countOf(s, 'silo') || full); }
  for (const t of open) if (tierPlots(t).length >= 6 && countOf(s, 'silo') && !onTier('silo', t)) addOn('silo', `siloTier:${t}`, t, false);
  for (let t = 0; t < 4; t++) if (tierPlots(t).length && !onTier('well', t)) add('well', `well:${t}`, tierPlots(t).slice(0, 12), true, t);
  // A second tank on a tier only where water is the real limit: waterers on the team and most fields out of reach of a tank.
  for (let t = 0; t < 4; t++) {
    const here = tierPlots(t), far = here.filter(p => wellBonus(s, p.id) <= 0), W = FARM_MANAGER.water;
    if (has('water') && onTier('well', t) && here.length >= W.extraMinFields && far.length / here.length >= W.extraUncovered) add('well', `wellMore:${t}:${buildingsOf(s, 'well').length}`, far.slice(0, 12), false, t);
  }
  const stations = countOf(s, 'dryer') + countOf(s, 'wetMill');
  if (planted >= 6 && stations < Math.ceil(planted / 15)) addOn(planted >= 12 && !countOf(s, 'wetMill') ? 'wetMill' : 'dryer', `station:${stations}`, thinnest(['dryer', 'wetMill']), stations === 0); // the first is a basic, the rest must pay
  if (!countOf(s, 'pulper') && has('process')) addOn('pulper', 'pulper', thinnest(['pulper']), false);
  for (let t = 0; t < 4; t++) { const here = tierPlots(t); if (here.length < 6) continue;
    if (!onTier('dripLine', t)) add('dripLine', `drip:${t}`, here.slice(0, 12), false, t);
    if (!onTier('shadeTree', t) && here.some(p => BUILDINGS.shadeTree.effect.crops.includes(r.plots[p.id]?.crop))) add('shadeTree', `shade:${t}`, here.slice(0, 12), false, t); } // shade only helps the crops it lists
  const ups = (r.buildings || []).filter(b => UPGRADE_FIRST.includes(b.type) && !upgradeError(s, b)).map(b => ({ b, cost: upgradeCost(b.type, b.level) })).filter(x => x.cost != null && avail >= x.cost * 5 && x.cost <= I10(s)).sort((a, b) => a.cost - b.cost);
  for (const { b, cost } of ups.slice(0, 2)) out.push({ ok: true, upgrade: true, uid: b.uid, type: b.type, key: `up:${b.uid}`, x: b.x, z: b.z, cost, value: cost / 10 });
  return out;
}
// ---- Farm Manager V2 settings and the operating reserve (docs/design/farm-manager-v2.md) ----
const FM_DEFAULTS = Object.freeze({ auto: true, mode: 'balanced', minReserve: 0, spendLimit: 0, build: true, land: true, hire: true, autoSell: true, pins: Object.freeze({}) });
/** The player's manager settings (defaults when the save has none). */
export const fmOf = s => s.gm?.fm || FM_DEFAULTS;
/** Coins already promised to crew orders that have not been carried out yet. */
export const fmCommitted = s => (s.gm?.orders || []).reduce((n, o) => n + (o.cost || 0), 0);
/** Operating reserve: two salaries, the care wallet, the next upkeep and seeds for the open fields, × the mode; never under the player's minimum. */
export function fmReserve(s) {
  const f = fmOf(s), mode = FARM_MANAGER.modes[f.mode] || FARM_MANAGER.modes.balanced, crop = region(s) ? chooseCrop(s) : null;
  const r = region(s), empty = r ? ownedPlots(s).filter(p => !r.plots[p.id]).length : 0;
  const seeds = crop ? Math.min(FARM_MANAGER.seedFields, empty) * seedCost(s, crop) : 0;
  const salary = gmOf(s) ? gmSalary(gmOf(s), s.gm.mode) * 2 : 0;
  return Math.round(Math.max(f.minReserve, (gmCareWallet(s) + salary + upkeepPer(s) + seeds) * mode.reserveMul));
}
/** Coins the manager may invest: what is left after the operating reserve and the crew orders already promised. */
export const gmSpendable = s => Math.max(0, s.player.coins - fmReserve(s) - fmCommitted(s));
// How much land the owned tiers hold, roughly; the exact spots come from gmFieldSpots.
const FIELDS_PER_TIER = 60, GROW_PER_PLAN = 30;
/**
 * The staffing plan: how many people each job needs for the fields there are and the fields the money can open, against
 * what the crew can do (a slow worker counts for less). Most short-handed job first. [{ job, want, have, short }]
 */
export function gmStaffPlan(s, now = Date.now()) {
  const r = region(s);
  if (!r) return [];
  const crew = assignedUnits(s, s.world.currentRegion, 'farm').filter(u => u.active !== false);
  const have = job => crew.filter(u => doesJob(u, job)).reduce((n, u) => n + unitSpeed(u), 0);
  const plots = ownedPlots(s), planted = plots.filter(p => r.plots[p.id]), empty = plots.length - planted.length;
  const avail = gmSpendable(s), crop = chooseCrop(s), seed = crop ? seedCost(s, crop) : 10;
  const owned = ESTATE_ORDER.filter(e => estateOwned(s, e)).length, room = owned * FIELDS_PER_TIER - plots.length + (nextEstate(s) ? GROW_PER_PLAN : 0);
  const growth = Math.max(0, Math.min(GROW_PER_PLAN, room, Math.floor(avail / (seed + 20))));
  const stations = (r.buildings || []).filter(b => recipeOf(b)).length, N = farmStaffing(s, now);
  // What he picks and plants himself nobody has to be paid for: only the work beyond his own hands needs a hire.
  const H = FARM_MANAGER.hands, own = fmOf(s).auto && gmOf(s) ? gmHandsPerMin(gmOf(s)) / H.jobsPerPicker : 0;
  const want = { plant: Math.min(8, Math.max(own ? 0 : 1, Math.ceil((empty + growth) / 6) - Math.floor(own * (1 - H.harvestShare)))), harvest: N.harvest, water: N.water, process: Math.ceil(stations / 2),
    haul: planted.length >= 6 && storeBuildings(s).length ? N.haul : 0, prune: N.prune,
    build: crew.length >= 2 && avail >= 400 ? 1 : 0, expand: crew.length >= 3 && avail >= 600 && nextEstate(s) ? 1 : 0 };
  const order = Object.keys(want);
  return order.map((job, i) => { const h = have(job); return { job, want: want[job], have: h, short: want[job] - h, i }; })
    .filter(x => x.want > 0 && (x.have === 0 || x.short >= 0.5)).sort((a, b) => b.short / b.want - a.short / a.want || a.i - b.i);
}
/** Jobs that need more hands, most short-handed first. */
export const gmCrewGap = (s, now = Date.now()) => gmStaffPlan(s, now).map(x => x.job);
// Field grid: rows 2.4 m apart filling each owned tier, never on a road or the plaza.
const FIELD_STEP = 2.4, TIER_ROWS = [[2, 19], [-19, -5], [-45, -23], [-74, -54]];
/** Where to open new fields now: as many as the money and the planters can keep up with, packed next to the farm. */
function gmFieldSpots(s, now) {
  const r = region(s);
  if (!r || buildError(s, 'field')) return [];
  const crew = assignedUnits(s, s.world.currentRegion, 'farm').filter(u => u.active !== false);
  const plots = ownedPlots(s), empty = plots.filter(p => !r.plots[p.id]).length, planters = crew.filter(u => doesJob(u, 'plant')).length;
  const pending = (s.gm?.orders || []).filter(o => o.job === 'openField').map(o => o.act.payload);
  const crop = chooseCrop(s), seed = crop ? seedCost(s, crop) : 10;
  const hands = fmOf(s).auto && !!gmOf(s); // he opens and sows fields himself, so land fills at his pace, not the planters'
  if (hands && farmOverloaded(s, now)) return []; // what is already planted cannot be picked in time: more fields would only rot
  const room = (hands ? planters * 3 + 6 : planters ? planters * 3 : 6 - plots.length) - empty - pending.length;
  const n = Math.min(6, room, plots.length < 6 ? 6 - plots.length : Math.floor((hands ? gmSpendable(s) : Math.min(gmSpendable(s), gmBudgetLeft(s, now))) / (seed + 5))); // the first six always
  if (n <= 0) return [];
  const worth = tierWorth(s), count = [0, 0, 0, 0];
  for (const p of [...plots, ...pending]) count[tierIndexAt(p.x, p.z)]++;
  const lists = TIER_ROWS.map(([z0, z1], t) => {
    if (!estateOwned(s, ESTATE_ORDER[t])) return [];
    const here = plots.filter(p => tierIndexAt(p.x, p.z) === t), c = here.length ? { x: here.reduce((a, p) => a + p.x, 0) / here.length, z: here.reduce((a, p) => a + p.z, 0) / here.length } : { x: 0, z: (z0 + z1) / 2 }, list = [];
    for (let z = z0 + SERVICE_DEPTH; z <= z1; z += FIELD_STEP) for (let x = BOUNDS.minX + 2; x <= BOUNDS.maxX - 2; x += FIELD_STEP) {
      if (ROAD_LIST.some(d => x >= d.rect[0] - .8 && x <= d.rect[2] + .8 && z >= d.rect[1] - .8 && z <= d.rect[3] + .8)) continue;
      if (RESERVED.some(d => x >= d.rect[0] && x <= d.rect[2] && z >= d.rect[1] && z <= d.rect[3])) continue;
      list.push({ x, z, d: Math.hypot(x - c.x, z - c.z) });
    }
    return list.sort((a, b) => a.d - b.d);
  });
  const at = [0, 0, 0, 0], out = [], close = p => [...out, ...pending].some(o => Math.hypot(o.x - p.x, o.z - p.z) < FIELD_STEP - .2);
  // each new field goes to the tier with the best earnings per field already there
  while (out.length < n) {
    let placed = false;
    // the tier with the fewest fields first, so all four fill up together (a tier no unlocked crop suits comes last)
    for (const t of [0, 1, 2, 3].sort((a, b) => Number(worth[a] <= 1e-5) - Number(worth[b] <= 1e-5) || count[a] - count[b] || worth[b] - worth[a])) {
      while (at[t] < lists[t].length) {
        const k = lists[t][at[t]++], pos = snapPosition('field', k.x, k.z, 0);
        if (close(pos) || placementError(s, 'field', pos.x, pos.z, 0)) continue;
        out.push({ ok: true, x: pos.x, z: pos.z, cost: buildCost(s, 'field'), value: Math.max(3, seed / 2) });
        count[t]++; placed = true; break;
      }
      if (placed) break;
    }
    if (!placed) break;
  }
  return out;
}
/** What one field earns per minute on each tier: the best crop that suits that altitude. */
function tierWorth(s) {
  return ESTATE_ORDER.map(id => {
    const zone = ESTATES[id].zone, rates = unlockedCrops(s).filter(c => climateFit(c, zone) !== 'bad').map(c => beanPrice(c) * CROPS[c].beans / (Math.max(1, growMs(s, c)) * (climateEffect(c, zone)?.timeMul || 1)));
    return Math.max(1e-6, ...rates, 0);
  });
}
/** The specialist job behind one of the manager's decisions (null = nobody but him does it). */
export function orderJob(act) {
  if (act?.type === 'land/buyParcel') return 'expand';
  if (act?.type === 'build/upgrade') return 'build';
  if (act?.type !== 'build/place') return null;
  const t = act.payload?.type;
  return t === 'field' ? 'openField' : 'build';
}
/** Someone on shift can carry out this job. */
export const crewFor = (s, job) => assignedUnits(s, s.world.currentRegion, 'farm').some(u => u.active !== false && doesJob(u, job));
/** Where an order is carried out. */
export function orderSpot(o) {
  const p = o.act.payload || {};
  if (o.act.type === 'land/buyParcel') { const r = PARCELS[p.parcelId]?.rect; return r ? { x: (r[0] + r[2]) / 2, z: (r[1] + r[3]) / 2 } : null; }
  return Number.isFinite(p.x) && Number.isFinite(p.z) ? { x: p.x, z: p.z } : null;
}
/**
 * The tier each farm unit is responsible for (founder 2026-11-09). Only tiers with fields count. The headcount of the tiers
 * comes out equal (at most one apart), and within that each trade is spread as evenly as it can be. Pins are kept and counted.
 * On a tie a unit keeps the tier it has, so nobody walks for nothing.
 */
export const openTiers = s => [...new Set(ownedPlots(s).map(p => tierIndexAt(p.x, p.z)))].sort((a, b) => a - b);
export function planTiers(s) {
  const open = openTiers(s), out = {}, on = {};
  const tiers = open.length ? open : [0], pins = fmOf(s).pins, prev = s.gm?.tiers || {}, total = [0, 0, 0, 0];
  const crew = assignedUnits(s, s.world.currentRegion, 'farm').sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
  const sizes = {}, put = (u, t) => { out[u.uid] = t; (on[u.type] ||= [0, 0, 0, 0])[t]++; total[t]++; };
  for (const u of crew) sizes[u.type] = (sizes[u.type] || 0) + 1;
  for (const u of crew) if (Number.isInteger(pins[u.uid])) put(u, pins[u.uid]);
  for (const u of [...crew].sort((a, b) => sizes[b.type] - sizes[a.type] || a.type.localeCompare(b.type))) { // biggest trades first: they need the spreading most
    if (out[u.uid] != null) continue;
    const mine = on[u.type] || [0, 0, 0, 0], leastOwn = Math.min(...tiers.map(t => mine[t]));
    const even = tiers.filter(t => mine[t] === leastOwn), leastAll = Math.min(...even.map(t => total[t])), thin = even.filter(t => total[t] === leastAll);
    put(u, thin.includes(prev[u.uid]) ? prev[u.uid] : thin[0]);
  }
  // Greedy per trade can still leave a tier heavy: move someone from the fullest to the emptiest until at most one apart.
  for (let i = 0; i < crew.length; i++) {
    const hi = tiers.reduce((a, b) => (total[b] > total[a] ? b : a)), lo = tiers.reduce((a, b) => (total[b] < total[a] ? b : a));
    if (total[hi] - total[lo] <= 1) break;
    const who = crew.filter(u => out[u.uid] === hi && !Number.isInteger(pins[u.uid])).sort((a, b) => (on[b.type][hi] - on[b.type][lo]) - (on[a.type][hi] - on[a.type][lo]))[0];
    if (!who) break;
    on[who.type][hi]--; total[hi]--; put(who, lo);
  }
  return out;
}
export function gmTrainDue(s) {
  const gm = gmOf(s), b = s.gm?.busy, U = GM.selfUpgrade;
  if (!gm || !b || (b.n || 0) < U.trainThinks || !okOrCoins(gmTrainError(s))) return null;
  const k = Math.max(0, Math.min(GM.thinkSeconds.length - 1, gm.skill - 1));
  const perMin = (i, n) => GM.actionsPerThink[i] * 60 / GM.thinkSeconds[i] * n;
  const extra = Math.max(0, perMin(k + 1, 1) - perMin(k, 1)) * Math.min(1, (b.excess || 0) / Math.max(1, GM.actionsPerThink[k]));
  const gain = extra * (b.avg || 0) * U.actionValueMin, cost = gmTrainCost(gm);
  return gain > 0 && cost / gain <= U.trainPaybackMin ? { cost, value: gain } : null;
}
// ---- builders a GM_RULES row may name ----
const nameOf = u => u?.name || null;
const RULE_ARGS = {
  none: () => ({}),
  zone: (s, snap) => ({ payload: { zone: snap.zone } }),
  storage: (s, snap) => ({ params: { pct: Math.round(snap.storagePct * 100), coins: Math.round(snap.storageValue) } }),
  // a sale just under highValue: the most valuable good, as many as stay under the line (§4.4 "sells 420 of 600 alone")
  sellUnderHigh: (s, snap) => {
    const hv = gmHighValue(s);
    const best = GOOD_ORDER.map(gd => ({ gd, n: Math.floor(goodCount(s, gd)), each: (sellQuote(s, gd, 1).coins || 0) })).filter(x => x.n > 0 && x.each > 0).sort((a, b) => b.each - a.each)[0];
    if (!best) return null;
    const n = Math.min(best.n, Math.floor((hv - 1) / best.each));
    if (n <= 0) return null;
    const q = sellQuote(s, best.gd, n);
    return { payload: { good: best.gd, amount: n }, sale: q.coins, key: best.gd, params: { n, good: best.gd, coins: Math.round(q.coins) } };
  },
  beanPack: s => { const q = beanBuyQuote(s); return q.amount > 0 ? { payload: {}, cost: q.free ? 0 : q.cost, params: { n: q.amount } } : null; },
  care: (s, snap, x, rule, now) => (okOrCoins(careError(s, x.u, rule.care, now)) ? { payload: { uid: x.id, kind: rule.care }, key: x.id, subject: x.id, params: { name: nameOf(x.u), serial: x.u.serial, wear: Math.round(x.wear) } } : null),
  restedBench: (s, snap) => {
    const u = assignedUnits(s, s.world.currentRegion, snap.zone).find(w => isWorkerUnit(w) && !w.active && (w.energy ?? 100) >= SHIFT.restedFrom);
    return u ? { payload: { uid: u.uid, active: true }, key: u.uid, subject: u.uid, value: contrib(s, u, snap.perJob), params: { name: nameOf(u) } } : null;
  },
  building: (s, snap, x) => ({ payload: { uid: x.id }, key: x.id, params: { building: x.b.type } }),
  poached: (s, snap) => { const p = workerPoach(s), u = p && unitOf(s, p.uid); return u ? { payload: { uid: u.uid }, key: u.uid, subject: u.uid, cost: p.fee, value: contrib(s, u, snap.perJob), params: { name: nameOf(u) } } : null; },
  weakUnit: (s, snap, x) => (taskCooling(s, 'replace') ? null : { payload: { uid: x.id }, key: x.id, subject: x.id, params: { name: nameOf(x.u) } }),
  richUp: (s, snap, x) => { const n = richUpOf(s, x.u); return n ? { act: n.act, key: x.id, subject: x.id, cost: n.cost, value: Math.max(1, (x.contrib || 0) * 0.1), params: { name: nameOf(x.u) } } : null; },
  crewHire: (s, snap, x, rule, now) => {
    const board = applicants(s, 'farm'), avail = gmSpendable(s);
    for (const { job, have } of gmStaffPlan(s, now)) {
      // rich: a robot of that job works faster than a new hire
      const bot = Object.keys(ROBOT_TASKS).find(t => STAFF[t].zone === 'farm' && ROBOT_TASKS[t][0] === job);
      if (bot && avail >= STAFF[bot].cost * 6 && STAFF[bot].cost <= I10(s) * 3 && !staffError(s, bot)) return { act: { type: 'staff/hire', payload: { type: bot } }, key: `farm:${bot}`, cost: hireCost(s, bot), value: 5, params: { staffType: bot } };
      const i = board.map((a, k) => ({ a, k })).filter(({ a, k }) => doesJob({ type: a.type }, job) && (a.cost <= avail || have === 0) && okOrCoins(recruitError(s, 'farm', k))).sort((p, q) => statSum(q.a.stats) - statSum(p.a.stats))[0]?.k ?? -1;
      if (i >= 0) { const a = board[i]; return { payload: { zone: 'farm', index: i, name: a.name }, key: `farm:${a.name}`, cost: freeHire(s) ? 0 : a.cost, value: contrib(s, { type: a.type, stats: a.stats }, snap.perJob) + 1, essential: have === 0, params: { name: a.name } }; }
    }
    return null;
  },
  fieldNeed: (s, snap, x) => ({ payload: { type: 'field', x: x.x, z: x.z }, key: `${x.x},${x.z}`, cost: x.cost, value: x.value, params: {} }),
  buildNeed: (s, snap, x) => ({ ...(x.upgrade ? { act: { type: 'build/upgrade', payload: { uid: x.uid, x: x.x, z: x.z } } } : { payload: { type: x.type, x: x.x, z: x.z } }), key: x.key, cost: x.cost, value: x.value, essential: !!x.basic, params: { building: x.type } }),
  bestApplicant: (s, snap) => {
    const board = applicants(s, snap.zone);
    const i = board.map((a, k) => ({ k, v: STAT_ORDER.reduce((n, st) => n + (a.stats?.[st] || 1), 0) + (a.trait === 'diligent' ? 1 : a.trait === 'lazy' ? -1 : 0) + (STAFF[a.type].jobs && !zoneUnits(s, snap.zone).some(u => u.type === a.type) ? 3 : 0) }))
      .filter(x => okOrCoins(recruitError(s, snap.zone, x.k))).sort((a, b) => b.v - a.v)[0]?.k;
    if (i == null) return null;
    const a = board[i];
    return { payload: { zone: snap.zone, index: i, name: a.name }, key: `${snap.zone}:${a.name}`, cost: freeHire(s) ? 0 : a.cost, value: contrib(s, { type: a.type, stats: a.stats }, snap.perJob), params: { name: a.name, n: snap.piling } };
  },
  robotType: (s, snap) => {
    const open = STAFF_ORDER.filter(t => STAFF[t].kind === 'robot' && STAFF[t].zone === snap.zone && okOrCoins(staffError(s, t))), have = t => zoneUnits(s, snap.zone).filter(u => u.type === t).length;
    const type = open.sort((a, b) => have(a) - have(b))[0]; // the function the team lacks
    return type && okOrCoins(staffError(s, type)) ? { payload: { type }, key: `${snap.zone}:${type}`, cost: hireCost(s, type), value: Math.max(0, snap.robotWorth) + contrib(s, { type: RECRUIT.worker[snap.zone] }, snap.perJob), params: { n: snap.piling } } : null;
  },
  bestUpgrade: (s, snap, x) => upArgs(x, x.upgrade),
  bestQuality: (s, snap, x) => upArgs(x, x.quality),
  software: (s, snap, x, rule) => ({ payload: { uid: x.id, pack: rule.pack }, key: x.id, subject: x.id, cost: softwarePrice(x.u, rule.pack),
    value: rule.pack === 'autoCharge' ? x.contrib * GM.value.reactionMin / (GM.value.reactionMin + batteryMinutes(x.u)) : jamChance(x.u) * jobsPerMin(x.u) * (CARE.repair + x.contrib * GM.value.reactionMin),
    params: { serial: x.u.serial, n: rule.pack === 'autoCharge' ? x.recharges : x.jams } }),
  unit: (s, snap, x) => ({ payload: { uid: x.id }, key: x.id, subject: x.id, params: { name: nameOf(x.u) } }),
  train: s => { const t = gmTrainDue(s), gm = gmOf(s); return t ? { payload: {}, cost: t.cost, value: t.value, params: { skill: (gm.skill || 1) + 1 } } : null; },
  landBuy: (s, snap) => (snap.landBuy ? { payload: { parcelId: snap.landBuy.parcelId }, key: snap.landBuy.parcelId, subject: snap.landBuy.parcelId, cost: snap.landBuy.price, value: snap.landBuy.value,
    params: { lot: snap.landBuy.parcelId, coins: snap.landBuy.price, min: Math.round(snap.landBuy.payback) } } : null),
  landSell: (s, snap) => (snap.landSell ? { payload: { parcelId: snap.landSell.parcelId }, key: snap.landSell.parcelId, subject: snap.landSell.parcelId, value: snap.landSell.value,
    params: { lot: snap.landSell.parcelId, coins: snap.landSell.refund } } : null),
  buildUp: (s, snap) => (snap.buildUp ? { payload: { uid: snap.buildUp.uid }, key: snap.buildUp.uid, cost: snap.buildUp.cost, value: snap.buildUp.value, params: { building: snap.buildUp.type, coins: snap.buildUp.cost } } : null),
  repay: (s, snap) => (snap.repayRoom > 0 ? { payload: { amount: snap.repayRoom }, cost: snap.repayRoom, params: { coins: snap.repayRoom } } : null),
};
function upArgs(x, o) {
  if (!o) return null;
  const w = o.what || {};
  return { act: o.act, key: `${x.id}:${w.stat || w.part || w.item || w.pack}`, subject: x.id, cost: o.cost, value: o.value,
    params: { name: nameOf(x.u), serial: x.u.serial, stat: w.stat, part: w.part, item: w.item, pack: w.pack, min: Math.round(o.payback) } };
}
const RULE_COST = {
  none: () => 0, arg: (s, snap, x, a) => a.cost || 0,
  care: (s, snap, x, a, rule) => careCost(x.u, rule.care),
  prodFee: (s, snap, x) => recipeIO(x.b)?.fee || 0,
};
const RULE_VALUE = {
  none: () => 0, arg: (s, snap, x, a) => a.value || 0,
  contrib: (s, snap, x) => (x?.contrib != null ? x.contrib : 0),
  sale: (s, snap, x, a, rule) => (rule.sale === 'arg' ? a.sale || 0 : snap.storageValue) / Math.max(1, snap.I10 / 10), // minutes of income the sale brings
  orders: snap => snap.waitingOrders * snap.perJob * GM.value.jobsPerDrink,
  prod: (s, snap, x) => { const io = recipeIO(x.b); if (!io) return 0; const v = o => Object.entries(o).reduce((n, [g, k]) => n + (GOODS[g]?.price || 0) * k, 0); return Math.max(0, (v(io.out) - v(io.in) - io.fee) * 60000 / Math.max(1, io.ms)); },
};
// value 'orders' gets (snap) only: keep the signature uniform
const valueOf = (name, s, snap, x, a, rule) => (name === 'orders' ? RULE_VALUE.orders(snap) : (RULE_VALUE[name] || RULE_VALUE.none)(s, snap, x, a, rule));
const RULE_OPS = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b, '==': (a, b) => a === b, '!=': (a, b) => a !== b };
const metricOf = (x, snap, m) => (x && m in x ? x[m] : snap[m]);
/** Does one GM_RULES row hold for a subject (a unit / building row of the snapshot, or the zone itself)? */
export function gmRuleHolds(rule, x, snap) {
  for (const [m, op, v] of [[rule.metric, rule.op, rule.value], ...(rule.and || [])]) {
    const a = metricOf(x, snap, m);
    if (a === undefined || a === null || !RULE_OPS[op]?.(a, v)) return false;
  }
  return true;
}
/** Task tier for the HUD labels: advice (your job) | safe (free) | big (always asks) | budget (small cost). */
const tierOf = (s, c) => (c.group === 'advice' ? 'advice' : c.always || c.cost >= (s.gm?.bigLimit ?? GM.defaults.bigLimit) || (c.sale || 0) >= gmHighValue(s) ? 'big' : c.cost > 0 ? 'budget' : 'safe');
/**
 * Every candidate the manager sees now (management-rules §3.3), best score first, and `hits` (rule:zone → condition
 * held this think, for the `ticks` rows). offscreen: also think about the zone not on screen (care + trade rows).
 * score = urgency × (value + 1) / (cost / I10 + costFloor) × styleMul[style][group].
 */
export function gmCandidates(s, now, { offscreen = true } = {}) {
  const { on, off } = gmScope(s), list = [], hits = {};
  if (!on || !region(s) || s.story.phase !== 'play') return { list, hits };
  const style = s.gm?.unit?.style || 'balanced', bigLimit = s.gm?.bigLimit ?? GM.defaults.bigLimit;
  for (const zone of [on, ...(offscreen ? off : [])]) {
    const isOff = zone !== on, snap = gmSnapshot(s, now, zone, isOff);
    for (const rule of GM_RULES) {
      if ((rule.zone !== 'any' && rule.zone !== zone) || (isOff && !rule.offscreen) || (rule.style && !rule.style.includes(style))) continue;
      const subjects = rule.each === 'fieldSpot' ? snap.fieldSpots || [] : rule.each === 'buildItem' ? snap.buildItems || [] : rule.each === 'building' ? snap.buildings : rule.each === 'unit' ? snap.units : rule.each ? snap.units.filter(x => x.kind === rule.each) : [null];
      const held = subjects.filter(x => gmRuleHolds(rule, x, snap));
      if (rule.ticks) { const hk = `${rule.key}:${zone}`; hits[hk] = held.length > 0; if ((s.gm?.ticks?.[hk] || 0) + 1 < rule.ticks) continue; }
      for (const x of held) {
        const a = (RULE_ARGS[rule.args] || RULE_ARGS.none)(s, snap, x, rule, now);
        if (!a) continue;
        const act = a.act || { type: rule.act, payload: a.payload || {} };
        const cost = Math.max(0, Math.round((RULE_COST[rule.cost] || RULE_COST.none)(s, snap, x, a, rule) || 0));
        const value = Math.max(0, valueOf(rule.valueOf, s, snap, x, a, rule) || 0);
        const sale = rule.sale === 'arg' ? a.sale || 0 : rule.sale === 'storageValue' ? snap.storageValue : 0;
        const sg = GM.styleGroupOf[rule.group];
        const score = (GM.urgency[rule.urgency] || 1) * (value + 1) / (cost / Math.max(1, snap.I10) + GM.costFloor) * (sg ? GM.styleMul[style]?.[sg] ?? 1 : 1);
        const c = { key: `${rule.key}${rule.zone === 'any' && !a.key ? `:${zone}` : ''}${a.key ? `:${a.key}` : ''}`, rule: rule.key, zone, group: rule.group, licence: rule.licence,
          kind: rule.kind || null, act, cost, value: Math.round(value * 100) / 100, sale: Math.round(sale), urgency: rule.urgency, score: Math.round(score * 100) / 100,
          reason: [rule.reason, a.params || {}], subject: a.subject || null, always: GM.alwaysApprove.includes(act.type), noFile: !!rule.noFile, offscreen: isOff, essential: !!a.essential };
        c.tier = tierOf(s, c);
        c.bigLimit = bigLimit;
        list.push(c);
      }
    }
  }
  // A job held back ONLY by a missing licence (land, beans, credit — founder 2026-11-08: "rich, many staff, 2 lots,
  // the manager does nothing"): he asks for that licence now, as an inbox task the player approves (and pays), instead
  // of a quiet suggestion in his tab. One per licence; the blocked job's value carries over so it ranks honestly.
  const need = {};
  if (s.gm?.unit && s.gm.mode !== 'advisor') for (const c of list) if (c.licence && c.group !== 'advice' && !gmLicensed(s, c.licence) && licencePrice(c.licence) > 0 && !need[c.licence]) need[c.licence] = c;
  for (const [grp, c] of Object.entries(need)) list.push({ key: `licence:${grp}`, rule: 'licence', zone: c.zone, group: 'capital', licence: null, kind: 'staffGrowth',
    act: { type: 'gm/buyLicence', payload: { group: grp } }, cost: licencePrice(grp), value: c.value, sale: 0, urgency: 'growth', score: c.score,
    reason: ['licenceFor', { lic: grp, for: c.reason }], subject: null, always: true, noFile: false, offscreen: false, tier: 'big', bigLimit });
  for (const c of playerAdvice(s, now, on)) if (!need[c.act?.payload?.group] || c.act?.type !== 'gm/buyLicence') list.push(c);
  return { list: list.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)), hits };
}
/**
 * What a manager would do now, best first (the HUD's «Việc nên làm» and gm/delegate): every rule candidate plus the
 * player's own jobs (suppliers, crop trials, recipes — the manager never does those) and licence suggestions.
 * Each item: { key, act, cost, value, sale, tier, group, licence, kind, score, reason, zone }.
 */
export const gmPlan = (s, now) => gmCandidates(s, now).list;
// The player's own jobs the manager only points at (research is never his, founder rule), and licences worth buying.
function playerAdvice(s, now, zone) {
  const out = [], r = region(s);
  if (!r) return out;
  const add = (key, type, payload, cost, score, reason, params = {}) => out.push({ key, rule: key, zone, group: 'advice', licence: 'advice', kind: null, act: { type, payload }, cost, value: 0, sale: 0,
    urgency: 'cosmetic', score, reason: [reason, params], subject: null, always: false, noFile: true, tier: 'advice' });
  // a licence the manager kept missing today (§3.7 self-upgrade): you buy it
  const w = s.gm?.wish;
  if (s.gm?.unit && w?.d === dayKey(now)) for (const grp of GM.licences.groups) {
    if (!gmLicensed(s, grp) && (w.n?.[grp] || 0) >= GM.selfUpgrade.licenceFires) add(`licence:${grp}`, 'gm/buyLicence', { group: grp }, licencePrice(grp), 50, 'licenceWish', { lic: grp, n: w.n[grp] });
  }
  if (zone === 'shop') for (const g of SUPPLY.groupOrder) {
    const c = contractOf(s, g, now), found = suppliersFound(s, g, now);
    if (c && c.until - now < GM.planRules.contractWarnHours * 3600000) add(`contract:${g}`, 'supply/open', {}, 0, 4, 'contractEnd', { group: g, h: Math.max(1, Math.round((c.until - now) / 3600000)) });
    else if (!c && found) add(`contract:${g}`, 'supply/open', {}, 0, 3, 'contractNone', { group: g });
  }
  if (zone === 'farm') for (const crop of CROP_ORDER.filter(c => cropUnlocked(s, c))) {
    const res = Object.values(trialResults(s, crop)), rid = regionKey(s);
    if (!res.length && !trialsHere(s).some(t => t.crop === crop)) { add(`trial:${crop}`, 'farmlab/open', {}, 0, 2, 'trialNone', { crop }); continue; }
    const curY = methodKey(methodOf(s, crop)) === methodKey(FARMLAB.defaultMethod) ? 1 : methodEffect(rid, crop, methodOf(s, crop)).yieldMul;
    const best = res.map(x => methodEffect(rid, crop, x.method).yieldMul).sort((a, b) => b - a)[0] || 0;
    if (best >= curY * GM.planRules.betterMul) add(`trial:${crop}`, 'farmlab/open', {}, 0, 3, 'trialBetter', { crop, pct: Math.round((best / curY - 1) * 100) });
  }
  if (zone === 'farm') {
    const cur = buyerNow(s, now), found = suppliersFound(s, 'buyers', now);
    if (!cur.locked) for (let i = 1; i <= found; i++) {
      const b = buyerOf(regionKey(s), i, dayKey(now));
      if (i !== cur.i && b.mul.beans >= (cur.mul.beans || 1) * GM.planRules.betterMul) { add('buyer', 'supply/open', {}, 0, 4, 'betterBuyer', { name: b.name, pct: Math.round((b.mul.beans / (cur.mul.beans || 1) - 1) * 100) }); break; }
    }
  }
  if (zone === 'shop') {
    const cc = countryNow(s);
    const open = countryRecipes(cc).filter(rc => rc.ings.length && drinkUnlocked(s, rc.base) && !recipeKnown(s, cc, rc.index)).length;
    if (open) add('research', 'research/open', {}, 0, 3, 'research', { n: open });
  }
  return out;
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
/**
 * What the manager may do with a candidate now (management-rules §3.3 permission order): 'suggest' (advisor, no
 * licence, your own job) → 'file' (alwaysApprove, cost ≥ bigLimit, sale ≥ highValue: no mode bypasses it; coins short:
 * 'loan' when a loan pack pays it back in time, else 'suggest' — a task you cannot pay is never filed) → 'do'
 * (care / ops inside the care wallet) → coins short: 'loan' (a capital job a loan pack pays back in time, with the
 * credit licence) or 'suggest' → 'do' inside the growth budget → 'file'.
 */
export function gmPermission(s, c) {
  if (!s.gm?.unit || c.group === 'advice') return 'suggest';
  if (c.always) return 'file'; // a top-up or a bean sale: your signature
  if (s.player.coins < c.cost) return gmLoanFor(s, c) ? 'loan' : 'suggest';
  return 'do'; // everything else is his call
}
/** The player handed this zone's team to the manager (staff board button), and he is able to act on it. */
export const gmHanded = (s, zone) => !!(gmOf(s) && s.gm.handed?.[zone] && s.gm.mode !== 'advisor' && (zone !== 'farm' || fmOf(s).auto));
const STAFF_JOB_CAT = { 'staff/upgradeStat': 'upgrade', 'staff/upgradePart': 'upgrade', 'staff/buyGear': 'upgrade', 'staff/buySoftware': 'upgrade', 'staff/fire': 'fire', 'staff/swapShift': 'shift', 'staff/setActive': 'shift', 'staff/care': 'care', 'staff/resume': 'care', 'staff/keep': 'care', 'staff/recruit': 'hire', 'staff/hire': 'hire' };
/** What the manager did to this zone's team today: counts per kind of job, coins spent, and the jobs themselves (newest first). */
export function gmStaffReport(s, now, zone) {
  const n = { upgrade: 0, fire: 0, shift: 0, care: 0, hire: 0 }, rows = [];
  let spent = 0;
  for (const r of histRows(s, { zone, day: dayKey(now) })) {
    const cat = r.gm === 1 && r.type === 'did' ? STAFF_JOB_CAT[r.extra?.act] : null;
    if (!cat) continue;
    n[cat]++; spent += r.extra.cost || 0; rows.push({ at: r.at, cat, reason: r.extra.reason, cost: r.extra.cost || 0 });
  }
  return { n, spent: Math.round(spent), rows };
}
/** A plan item paid from the care wallet (care of a unit). */
export const isCareItem = item => item?.act?.type === 'staff/care';
/** Care wallet per GM.careWallet.windowMin played minutes: max(min, rosterMul × Σ per unit of this region). */
export function gmCareWallet(s) {
  const W = GM.careWallet;
  const per = assignedUnits(s).reduce((n, u) => n + (isRobot(u) ? unitFee(u) + W.robotExtra : W.workerPer10), 0);
  return Math.round(Math.max(W.min, W.rosterMul * per));
}
/** What is left of the care wallet in its current played window. */
export function gmCareWalletLeft(s) {
  const w = s.gm?.careWin, open = w && playedMs(s) - w.startPlayed < GM.careWallet.windowMin * 60000;
  return Math.max(0, gmCareWallet(s) - (open ? w.spent : 0));
}
// ---------- inbox — Việc cần duyệt (management-rules §1.2 / §4) ----------
/** Open tasks (oldest first) and answered ones (newest first). */
export const tasksOpen = s => s.tasks?.open || [];
export const tasksDone = s => s.tasks?.done || [];
export const taskById = (s, id) => tasksOpen(s).find(t => t.id === id) || tasksDone(s).find(t => t.id === id) || null;
/** Played ms left on a task (≤ 0: due). */
export const taskLeftMs = (s, t) => (t ? t.untilPlayed - playedMs(s) : 0);
/** Task kind for an action the manager files. */
export const taskKindOf = actType => TASKS.kindOf[actType] || 'staffGrowth';
/** The manager's open requests (tasks filed by 'g1'). */
export const gmRequests = s => tasksOpen(s).filter(t => t.by === 'g1');
/** The rival's lure on a worker in progress: { id, uid, zone, fee, leftMs } or null. */
export function workerPoach(s) {
  const t = tasksOpen(s).find(x => x.kind === 'poach');
  return t ? { id: t.id, uid: t.act.payload.uid, zone: t.zone, fee: t.cost, leftMs: taskLeftMs(s, t) } : null;
}
/** The rival's lure on the manager in progress: { id, fee, leftMs } or null. */
export function gmPoachOf(s) {
  const t = tasksOpen(s).find(x => x.kind === 'gmPoach');
  return t ? { id: t.id, fee: t.cost, leftMs: taskLeftMs(s, t) } : null;
}
/** A key the manager must leave alone for now (denied / expired / done lately), or already waiting in the inbox. */
export const taskCooling = (s, key) => (s.tasks?.cool?.[key] || 0) > playedMs(s);
export const taskPending = (s, key) => tasksOpen(s).some(t => t.key === key);
/** An expired manager task can still be approved late (within TASKS.lateMin played minutes): only while the manager who
 * filed it is still here (gmLeave / the Level-10 wipe mark his old tasks lateOff), in the region it was filed in, and
 * never a kind that is not penalised (a top-up). */
export const taskLateOk = (s, t) => !!t && t.status === 'expired' && t.by === 'g1' && !t.lateOff && !!s.gm?.unit && !TASKS.noPenaltyKinds.includes(t.kind)
  && (t.regionId == null || t.regionId === s.world.currentRegion) && playedMs(s) - (t.answeredAtPlayed || 0) <= TASKS.lateMin * 60000;
/** Fines of the last PENALTY.windowMin played minutes. */
export const finesRecent = s => (s.tasks?.fines || []).filter(f => f.p > playedMs(s) - PENALTY.windowMin * 60000).reduce((n, f) => n + f.c, 0);
/** The coin fine an expiring manager task would cost now (§4.3): min(perTask × I30, cap30OfI10 × I10 − recent fines, coins). */
export const taskFine = s => Math.max(0, Math.floor(Math.min(PENALTY.perTask * I30(s), PENALTY.cap30OfI10 * I10(s) - finesRecent(s), s.player.coins)));
/** The manager's backlog of ignored tasks, and the states it causes (Chờ lệnh / dễ bị dụ / Đình công). */
export const gmBacklog = s => s.gm?.unit?.backlog || 0;
export const gmWaiting = () => false; // he never stops to wait for orders
export const gmPoachable = s => gmBacklog(s) >= PENALTY.backlog.poachAt;
export const gmStrike = () => null; // he never goes on strike
/** What gm/apologise costs: PENALTY.apologiseSalaries × the salary. */
export const apologiseCost = s => Math.round(PENALTY.apologiseSalaries * gmPay(s));
// ---------- history — Nhật ký (management-rules §1.3 / §5) ----------
/** A history row's group. */
export const histGroupOf = type => HISTORY.groups[type] || 'event';
/** Every unit in one place: the team + the manager (uid 'g1'). */
export const allUnits = s => (s.gm?.unit ? [...s.staff.units, s.gm.unit] : [...s.staff.units]);
/** A uid's name (team, manager or a unit that left). */
export function histName(s, uid) {
  if (uid === 'g1') return s.gm?.unit?.name || [...(s.history?.tombstones || [])].reverse().find(x => x.uid === 'g1')?.name || null;
  const u = unitOf(s, uid);
  if (u) return u.name || null;
  return (s.history?.tombstones || []).find(x => x.uid === uid)?.name || null;
}
/** The kind of an actor / subject: 'player' | 'manager' | 'worker' | 'robot' | 'system'. */
export function histKind(s, uid) {
  if (uid === 'player') return 'player';
  if (uid === 'g1') return 'manager';
  if (uid === 'system' || !uid) return 'system';
  const u = unitOf(s, uid);
  if (u) return isRobot(u) ? 'robot' : 'worker';
  return (s.history?.tombstones || []).find(x => x.uid === uid)?.kind || 'worker';
}
/** Days present in the shared rows (newest first). */
export const historyDays = s => [...new Set((s.history?.rows || []).map(r => dayKey(r.at)))].sort((a, b) => b - a);
/**
 * Shared rows, newest first, filtered: actor 'all' | 'player' | 'manager' | 'worker' | 'robot' (who did it or whom it
 * was about), group, zone, day (dayKey).
 */
export function histRows(s, { actor = 'all', group = 'all', zone = 'all', day = null, uid = null } = {}) {
  const rows = s.history?.rows || [];
  const out = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (uid && r.actor !== uid && r.subject !== uid) continue;
    if (group !== 'all' && r.group !== group) continue;
    if (zone !== 'all' && r.zone && r.zone !== zone) continue;
    if (day != null && dayKey(r.at) !== day) continue;
    if (actor !== 'all') {
      const a = histKind(s, r.actor), b = r.subject ? histKind(s, r.subject) : null;
      if (a !== actor && !(actor !== 'player' && b === actor)) continue;
    }
    out.push(r);
  }
  return out;
}
// Old shapes, derived (the HUD of before the unified history keeps working): newest first.
/** A unit's own timeline { at, type, extra } (was u.log). */
export const unitLog = u => [...(u?.recent || [])].reverse().map(r => (r.extra === undefined ? { at: r.at, type: r.type } : { at: r.at, type: r.type, extra: r.extra }));
const JOURNAL_TYPES = new Set(['hired', 'left', 'activated', 'benched', 'overheat', 'jam', 'managerCare', 'autoCare', 'nagged', 'cared', 'upgraded', 'promoted', 'steppedDown', 'nudged', 'slacked', 'poachRefused', 'poachStarted', 'kept']);
/** The team journal { at, type, uid, name, extra } (was s.staff.journal): the team's rows. */
export const teamJournal = (s, keep = BOOKS.journalKeep) => histRows(s).filter(r => r.subject && r.subject !== 'g1' && JOURNAL_TYPES.has(r.type)).slice(0, keep)
  .map(r => ({ at: r.at, type: r.type, uid: r.subject, name: r.name ?? histName(s, r.subject), ...(r.extra === undefined ? {} : { extra: r.extra }) }));
/** The manager's log { at, type, extra } (was s.gm.log). */
export const gmLog = (s, keep = GM.logKeep) => histRows(s).filter(r => r.gm === 1).slice(0, keep).map(r => (r.extra === undefined ? { at: r.at, type: r.type } : { at: r.at, type: r.type, extra: r.extra }));
// ---------- career (docs/design/staff-profile.md, step 3) ----------
/** Whole (calendar) days on the team — shown on the cards; careers count shift-days (tenureShiftDays). */
export const tenureDays = (u, now) => daysSince(Number.isFinite(u?.hiredAt) ? u.hiredAt : u?.book?.since ?? now, now);
/** Played minutes on the team (clock/tick). */
export const tenureMin = u => Math.max(0, Number(u?.tenurePlayedMin) || 0);
/** Whole shift-days on the team (1 sd = CAREER.shiftDayMin played minutes, management-rules §2.5). */
export const tenureShiftDays = u => Math.floor(tenureMin(u) / CAREER.shiftDayMin + 1e-9);
/** Played minutes still missing to `sd` shift-days. */
export const tenureMinLeft = (u, sd) => Math.max(0, Math.ceil(sd * CAREER.shiftDayMin - tenureMin(u)));
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
export const poachOf = s => workerPoach(s);

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
// Loans (management-rules §2.7 / §4.5): s.loans[] (oldest first, ≤ LOAN.maxOpen).
/** Open loans, oldest first. */
export const allLoans = s => (Array.isArray(s.loans) ? s.loans : []).filter(ln => ln && ln.owed > 0);
/** A loan belongs to the city it was taken in: only that city's Gold repays it (null: carried over the Level-10 reset, not settled yet). */
export const loanHere = (s, ln) => ln.regionId == null || ln.regionId === s.world?.currentRegion;
export const loansOf = s => allLoans(s).filter(ln => loanHere(s, ln));
/** Total still owed on every open loan. */
export const loanTotal = s => Math.round(loansOf(s).reduce((n, ln) => n + ln.owed, 0) * 100) / 100;
/** A loan ran past its term: no new loan until every late loan is paid ("không thể vay"). */
export const loanBlocked = s => false; // no loan term any more, so nothing is ever overdue
/** Credit limit on the total owed: LOAN.creditMul × I10ref × (1 + creditLevelStep × level), I10ref = 10 × I(L). */
export const creditLimit = s => Math.round(LOAN.creditMul * incomePerMin(s) * INCOME.shortMin * (1 + LOAN.creditLevelStep * level(s)));
/** Played minutes a new loan of `amount` gets to be repaid (fixed when taken). */
export const loanTerm = (s, amount) => loanTermMin(loanOwed(amount), incomePerMin(s));
/** Played minutes left on a loan (≤ 0: due). */
export const loanMinLeft = (s, ln) => (ln ? (ln.takenAtPlayed + ln.termMin * 60000 - playedMs(s)) / 60000 : 0);
/**
 * One view of the debt for the HUD (the Borrow / Repay sheet, the top-bar dot): every open loan added up — amount,
 * owed, the oldest one's takenAtPlayed / term, late / blocked flags, and the loans themselves. null when debt-free.
 */
export function loanOf(s) {
  const list = loansOf(s);
  if (!list.length) return null;
  const amount = list.reduce((n, ln) => n + ln.amount, 0);
  return { amount, owed: loanTotal(s), takenAtPlayed: list[0].takenAtPlayed, termMin: list[0].termMin, late: false, count: list.length, loans: list,
    minLeft: Math.min(...list.map(ln => loanMinLeft(s, ln))) };
}
/** Why pack `amount` cannot be borrowed now: unknown | blocked (a late loan) | loanMax | level | credit | null. */
export function loanError(s, amount) {
  if (!LOAN.packs.includes(amount)) return 'unknown';
  if (loanBlocked(s)) return 'loanBlocked';
  // Founder 2026-11-08: borrowing is unlimited — no level, credit-limit or open-count lock (only an overdue loan blocks).
  return null;
}
/** Error data for the HUD / fail(): the level a pack needs, the credit left. */
export const loanErrorData = (s, amount, err = loanError(s, amount)) => (err === 'level' ? { minLevel: LOAN.packLevel[amount] }
  : err === 'credit' ? { limit: creditLimit(s), left: Math.max(0, Math.floor(creditLimit(s) - loanTotal(s))) } : err === 'loanMax' ? { max: LOAN.maxOpen } : undefined);
export const loanQuote = (amount, s = null) => ({ amount, owed: loanOwed(amount), termMin: s ? loanTerm(s, amount) : null });
/** Wage arrears (s.debt.wages): the GM's unpaid salary, the follower's unpaid wage. */
export const wageArrears = s => ({ gm: s.debt?.wages?.gm || 0, follower: s.debt?.wages?.follower || 0 });
/** Arrears that make the GM quit: GM.quitArrearsSalaries × its salary. */
export const gmQuitArrears = s => (gmOf(s) ? GM.quitArrearsSalaries * gmPay(s) : Infinity);
/** Arrears that make the follower leave: DEBT.wageCapMul × its wage. */
export const followerQuitArrears = u => DEBT.wageCapMul * followerWage(u);

// ---------- reference income & income series (management-rules §2.0) ----------
/** The game the reference income is read for: the region's game (else the one on screen, else the farm). */
export const incomeGame = s => regionGame(s) || s.mode || 'farm';
/** I(L): reference coins per played minute of this game at `lvl` (default: the player level). */
export const incomePerMin = (s, lvl = level(s)) => incomeRef(incomeGame(s), lvl);
/** Played time (ms) and the played minute index. */
export const playedMs = s => s.clock?.played || 0;
export const playedMinute = s => Math.floor(playedMs(s) / 60000);
/** Income rows of the last `minutes` played minutes (the current one included). */
export const incomeRows = (s, minutes) => { const from = playedMinute(s) - minutes; return (s.income?.rows || []).filter(r => r.m > from); };
/** Coins earned over the last `minutes` played minutes (no floor). */
export const incomeEarned = (s, minutes) => incomeRows(s, minutes).reduce((n, r) => n + (r.earned || 0), 0);
/** Net coins of one actor ('player' | 'g1' | 'staff') over the last `minutes` played minutes. */
export const incomeNetBy = (s, actor, minutes) => incomeRows(s, minutes).reduce((n, r) => n + (r.by?.[actor] || 0), 0);
/** Floored income sum over `minutes` played minutes: max(INCOME_FLOOR × I(L) × minutes, earned). */
export const incomeSum = (s, minutes) => Math.max(INCOME_FLOOR * incomePerMin(s) * minutes, incomeEarned(s, minutes));
/** I10 / I30: the 10- / 30-minute income sums (floored). */
export const I10 = s => incomeSum(s, INCOME.shortMin);
export const I30 = s => incomeSum(s, INCOME.longMin);
/** Net coins of the GM's own jobs in played minutes [fromMin, toMin) (its profit share is paid on this). */
export const gmProfitBetween = (s, fromMin, toMin) => (s.income?.rows || []).filter(r => r.m >= fromMin && r.m < toMin).reduce((n, r) => n + (r.by?.g1 || 0), 0);
// Nearest listed option, ties to the smaller one.
const snapTo = (v, list) => [...list].sort((a, b) => Math.abs(a - v) - Math.abs(b - v) || a - b)[0];
/** The GM's starting limits from I(L) (GM.limitDefaults), snapped to the listed options: { budget, bigLimit }. */
export function gmDefaultLimits(s) {
  const I = incomePerMin(s), d = GM.limitDefaults;
  return { budget: snapTo(Math.round(d.autoMul * I / d.autoStep) * d.autoStep, GM.budgets), bigLimit: snapTo(Math.round(d.bigMul * I / d.bigStep) * d.bigStep, GM.bigLimits) };
}
/** A sale at or above this needs the player's approval (GM.limitDefaults.highValueMul × I(L)); used by the P3 planner. */
export const gmHighValue = s => Math.round(GM.limitDefaults.highValueMul * incomePerMin(s));

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
