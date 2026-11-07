// Save schema v3 (Farm & Café V3). Stored under its own localStorage key, so the old v1 save is never overwritten.
import { START, BUILDINGS, STAFF, TRAITS, RECRUIT, ROBOT_TASKS, PLAYTEST, SKILL, STAT_ORDER, VITALS, RARE, WORKER_TASKS, BOOKS, energyMax, levelForXp, startCoins, VENUES, RATING, CELL } from './config/economy.js';
import { COUNTRIES, LEGACY_REGIONS, isRegionId, regionGames } from './config/world.js';
import { FIXED, PARCELS, LOT_KINDS, areaOfParcel, inRect, rectsOverlap, plotsOf } from './config/layout.js';
import { RECIPES, GOODS, ITEM_GOODS } from './config/economy.js';

export const SCHEMA = 3;
export const PHASES = ['select', 'intro', 'teacher', 'gate', 'play', 'expiry', 'chooseRegion'];

export function createSave(now = Date.now(), character = null) {
  return {
    schema: SCHEMA,
    createdAt: now,
    updatedAt: now,
    rev: 0,
    character: character ? { gender: character.gender === 'male' ? 'male' : 'female', name: String(character.name || '').slice(0, 20) } : null,
    story: { phase: character ? 'intro' : 'select', teacherMet: false, level10Done: false, expiry: null, seen: {} },
    player: { coins: startCoins(), xp: 0, round: 1 },
    rebirth: { credits: 0, granted: false, used: 0, purchased: 0, blessings: { grow: 0, price: 0, xp: 0 }, history: [] },
    inventory: { beans: 0, items: { dried: 0, roasted: 0, bag: 0 } }, // beans: harvested (café brews them); items: farm goods
    world: {
      startCountry: null,
      currentRegion: null,
      regions: {},
      ownedRegions: [],   // regions bought on the world map (first one free)
      freeUnlocks: 0,     // free region unlocks granted by the Level-10 expiration
    },
    // pool: each game's applicant board (RECRUIT): seed draws the 3 applicants (applicantsFor), at = when it was drawn.
    // upkeepAt: last bench upkeep charge; ledger: team earned / spent per game minute; journal: newest first;
    // poach: a rival's offer in progress { uid, zone, until, fee }; mvp: the last MVP (docs/design/staff-manager.md).
    staff: { units: [], pool: { farm: { seed: 1, at: 0 }, shop: { seed: 2, at: 0 } }, upkeepAt: 0, ledger: [], journal: [], poach: null, mvp: null },
    rewards: { claimed: [], tickets: 0 }, // level gifts opened (levels) + free-hire tickets
    loan: null,                           // { amount, owed, takenAt } while a loan is open
    // mode: the current region's game (region.mode: 'farm' | 'cafe'; null → the HUD asks, offering only the games the
    // region's country has). Coins / XP / level / beans are shared by both games.
    mode: null,
    tutorial: { step: 0, done: false, farmDone: false, cafeDone: false },
    autoplay: { runs: 0, granted: false, active: null },   // active = { startedAt, endsAt } while a run plays
    stats: { harvested: 0, planted: 0, served: 0, built: 0, upgraded: 0, parcels: 0, earned: 0, sold: 0, bought: 0, venueSold: 0, reviews: 0, fights: 0 },
    tx: [],
    nextUid: 1,
  };
}

const num = (v, d = 0, min = -Infinity, max = Infinity) => Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;

// Defensive normalization: fills missing fields from a fresh save, clamps numbers. Never throws.
export function normalizeSave(raw, now = Date.now()) {
  const base = createSave(now);
  const s = obj(raw);
  if (!s || s.schema !== SCHEMA) return null;
  const out = { ...base, ...s };
  out.character = obj(s.character) && (s.character.gender === 'male' || s.character.gender === 'female')
    ? { gender: s.character.gender, name: String(s.character.name || '').slice(0, 20) } : null;
  out.story = { ...base.story, ...obj(s.story) };
  if (!PHASES.includes(out.story.phase)) out.story.phase = out.character ? 'intro' : 'select';
  out.story.seen = obj(out.story.seen) || {};
  out.player = { ...base.player, ...obj(s.player) };
  out.player.coins = num(out.player.coins, base.player.coins, 0, 1e15);
  out.player.xp = num(out.player.xp, 0, 0, 1e12);
  out.player.round = 1; // only Round 1 is playable for now (saves from the old paid Rounds go back to 1)
  // Playtest coins: an existing save is raised to PLAYTEST.coins once per amount (never lowered).
  if (PLAYTEST.coins > 0 && out.story.seen.playtestCoins !== PLAYTEST.coins) {
    out.story.seen = { ...out.story.seen, playtestCoins: PLAYTEST.coins }; // a new playtest amount tops up once more
    out.player.coins = Math.max(out.player.coins, PLAYTEST.coins);
  }
  out.rebirth = { ...base.rebirth, ...obj(s.rebirth) };
  out.rebirth.credits = num(out.rebirth.credits, 0, 0, 999) | 0;
  out.rebirth.blessings = { ...base.rebirth.blessings, ...obj(out.rebirth.blessings) };
  if (!Array.isArray(out.rebirth.history)) out.rebirth.history = [];
  out.inventory = { ...base.inventory, ...obj(s.inventory) };
  out.inventory.beans = num(out.inventory.beans, 0, 0, 1e9) | 0;
  const items = obj(out.inventory.items) || {};
  out.inventory.items = Object.fromEntries(ITEM_GOODS.map(g => [g, num(items[g], 0, 0, 1e9) | 0]));
  out.world = { ...base.world, ...obj(s.world) };
  out.world.regions = obj(out.world.regions) || {};
  // City map (docs/design/world-cities.md): regions of removed countries (Colombia, Kenya, Italy) move to a kept city,
  // unless that city already has its own record (then the old one is dropped below).
  const moved = id => (Object.hasOwn(LEGACY_REGIONS, id) && !Object.hasOwn(out.world.regions, LEGACY_REGIONS[id]) ? LEGACY_REGIONS[id] : id);
  const remap = id => (Object.hasOwn(LEGACY_REGIONS, id) ? LEGACY_REGIONS[id] : id);
  out.world.regions = Object.fromEntries(Object.entries(out.world.regions).map(([id, r]) => [moved(id), r]));
  if (out.world.currentRegion) out.world.currentRegion = remap(out.world.currentRegion);
  const legacyOwned = Array.isArray(s.world?.ownedRegions) ? s.world.ownedRegions.map(remap) : [];
  if (out.world.startCountry && !Object.hasOwn(COUNTRIES, out.world.startCountry)) {
    const to = LEGACY_REGIONS[`${out.world.startCountry}-1`];
    out.world.startCountry = to ? to.slice(0, 2) : null;
  }
  // Regions that no longer exist (unknown country or city number) are dropped; standing in one → back to the map.
  out.world.regions = Object.fromEntries(Object.entries(out.world.regions).filter(([id]) => isRegionId(id)));
  if (out.world.currentRegion && !isRegionId(out.world.currentRegion)) {
    out.world.currentRegion = null;
    if (out.story.phase === 'play') out.story.phase = 'gate';
  }
  for (const [id, r] of Object.entries(out.world.regions)) {
    const nr = normalizeRegion(r);
    if (nr.refund) { out.player.coins += nr.refund; delete nr.refund; }
    // Starter buildings added after a region was created (e.g. the terrace) appear at level 1 on load.
    if (nr.buildings.some(b => b.type === 'orderCounter')) for (const [type, def] of Object.entries(BUILDINGS)) {
      if (def.starter && FIXED[type] && !nr.buildings.some(b => b.type === type)) nr.buildings.push({ uid: `s-${type}-${id}`, type, x: FIXED[type].x, z: FIXED[type].z, rot: FIXED[type].rot, level: 1 });
    }
    out.world.regions[id] = nr;
  }
  // Paid regions: before this change every visited region was reachable, so visited regions count as owned.
  // An EXPIRED region is not owned again on reload: the Level-10 incident clears ownedRegions so the next region is free,
  // and counting the expired record here made that free region cost coins after a reload (softlock: 60 coins left).
  out.world.ownedRegions = [...new Set([...legacyOwned,
    ...Object.entries(out.world.regions).filter(([, r]) => r.status !== 'expired').map(([id]) => id)].filter(isRegionId))];
  out.world.freeUnlocks = num(out.world.freeUnlocks, 0, 0, 9) | 0;
  out.staff = { units: Array.isArray(s.staff?.units) ? s.staff.units.filter(u => obj(u) && typeof u.type === 'string' && Object.hasOwn(STAFF, u.type)).map(u => ({ ...u })) : [] };
  for (const u of out.staff.units) {
    if (obj(u.assigned) && typeof u.assigned.regionId === 'string') u.assigned = { ...u.assigned, regionId: remap(u.assigned.regionId) };
    if (u.trait != null && !Object.hasOwn(TRAITS, u.trait)) delete u.trait;
    if (u.name != null) u.name = String(u.name).slice(0, 20);
    if (STAFF[u.type].kind === 'robot') {
      if (!ROBOT_TASKS[u.type]?.includes(u.task)) u.task = 'auto';
      // The old charger part is merged into the battery (battery = the better of the two).
      const p = obj(u.parts) || {}, t = v => num(v, 0, 0, 3) | 0;
      u.parts = { battery: Math.max(t(p.battery), t(p.charger)), motor: t(p.motor), cooler: t(p.cooler), frame: t(p.frame) };
      u.heat = num(u.heat, 0, 0, 100); u.wear = num(u.wear, 100, 0, 100); u.partsSpent = num(u.partsSpent, 0, 0, 1e9);
      delete u.level; delete u.xp; delete u.tasks; delete u.breakUntil;
    } else normalizeWorker(u);
    u.paid = num(u.paid, 0, 0, 1e9);
    if (u.perk != null && !RARE.perks.includes(u.perk)) delete u.perk;
    u.book = normalizeBook(u.book, now);
    if (u.stopped != null && !(obj(u.stopped) && typeof u.stopped.kind === 'string')) delete u.stopped;
    if (!obj(u.assigned) || typeof u.assigned.regionId !== 'string') u.assigned = null;
  }
  normalizeActive(out.staff.units, levelForXp(out.player.xp));
  const st = obj(s.staff) || {};
  out.staff.upkeepAt = num(st.upkeepAt, 0, 0);
  out.staff.ledger = (Array.isArray(st.ledger) ? st.ledger : []).filter(e => obj(e) && Number.isFinite(e.min))
    .map(e => ({ min: e.min, earned: num(e.earned, 0, 0), spent: num(e.spent, 0, 0) })).slice(-BOOKS.ledgerKeep);
  out.staff.journal = (Array.isArray(st.journal) ? st.journal : []).filter(e => obj(e) && typeof e.type === 'string' && Number.isFinite(e.at)).slice(0, BOOKS.journalKeep);
  const po = obj(st.poach);
  out.staff.poach = po && out.staff.units.some(u => u.uid === po.uid) && Number.isFinite(po.until)
    ? { uid: po.uid, zone: po.zone === 'shop' ? 'shop' : 'farm', until: po.until, fee: num(po.fee, 0, 0, 1e6) } : null;
  out.staff.mvp = obj(st.mvp) ? st.mvp : null;
  const pool = obj(s.staff?.pool) || {};
  out.staff.pool = {};
  for (const [zone, d] of Object.entries(base.staff.pool)) {
    const z = obj(pool[zone]);
    out.staff.pool[zone] = { seed: Number.isInteger(z?.seed) ? z.seed : d.seed, at: num(z?.at, 0, 0) };
  }
  // Saves from before the per-region game: regions keep the game the player picked / played, when their country offers it.
  const game = v => (v === 'farm' || v === 'cafe' ? v : null);
  const legacy = game(s.firstGame) || game(s.mode);
  for (const [id, r] of Object.entries(out.world.regions)) {
    if (r.mode && !regionGames(id).includes(r.mode)) r.mode = null;
    if (!r.mode && legacy && r.status !== 'expired' && regionGames(id).includes(legacy)) r.mode = legacy;
  }
  out.mode = out.world.regions[out.world.currentRegion]?.mode || null;
  delete out.firstGame;
  const rw = obj(s.rewards) || {};
  out.rewards = { claimed: Array.isArray(rw.claimed) ? [...new Set(rw.claimed.filter(n => Number.isInteger(n) && n >= 2 && n <= 100))] : [], tickets: num(rw.tickets, 0, 0, 99) | 0 };
  const ln = obj(s.loan);
  out.loan = ln && Number.isFinite(ln.owed) && ln.owed > 0 ? { amount: num(ln.amount, 0, 0, 1e9), owed: num(ln.owed, 0, 0, 1e9), takenAt: num(ln.takenAt, 0) } : null;
  out.tutorial = { ...base.tutorial, ...obj(s.tutorial) };
  if (out.tutorial.done) { out.tutorial.farmDone = true; out.tutorial.cafeDone = true; } // skipped before the split
  out.autoplay = { ...base.autoplay, ...obj(s.autoplay) };
  out.autoplay.runs = num(out.autoplay.runs, 0, 0, 99) | 0;
  if (!obj(out.autoplay.active)) out.autoplay.active = null;
  // Saves from before auto play existed get their free run once.
  if (!obj(s.autoplay) && s.story?.teacherMet) { out.autoplay.runs = 1; out.autoplay.granted = true; }
  out.stats = { ...base.stats, ...obj(s.stats) };
  out.tx = Array.isArray(s.tx) ? s.tx.slice(-64) : [];
  out.nextUid = num(s.nextUid, 1, 1) | 0;
  return out;
}

// Workers (docs/design/staff-manager.md §3, §5): an old single `level` L becomes all four stats = L (XP kept modulo
// SKILL.xpPerPoint); vitals default to a fresh hire's; tasks only from the zone's list.
function normalizeWorker(u) {
  const st = obj(u.stats);
  const old = num(u.level, 1, 1, SKILL.maxStat) | 0;
  u.stats = Object.fromEntries(STAT_ORDER.map(k => [k, num(st ? st[k] : old, st ? 1 : old, 1, SKILL.maxStat) | 0]));
  u.points = num(u.points, 0, 0, 1e6) | 0;
  u.xp = st ? num(u.xp, 0, 0, SKILL.xpPerPoint) : num(u.xp, 0, 0, 1e6) % SKILL.xpPerPoint;
  delete u.level;
  u.water = num(u.water, 0, 0, 9) | 0;
  u.energy = num(u.energy, VITALS.start.energy, 0, energyMax(u));
  u.fullness = num(u.fullness, VITALS.start.fullness, 0, 100);
  u.morale = num(u.morale, VITALS.start.morale, 0, 100);
  const allowed = WORKER_TASKS[STAFF[u.type].zone] || [];
  u.tasks = Array.isArray(u.tasks) ? [...new Set(u.tasks.filter(t => allowed.includes(t)))].slice(0, 2) : [];
  if (u.breakUntil != null && !Number.isFinite(u.breakUntil)) delete u.breakUntil;
  delete u.task; delete u.parts; delete u.heat; delete u.wear;
}
function normalizeBook(b, now) {
  const o = obj(b) || {};
  const out = { jobs: num(o.jobs, 0, 0) | 0, earned: num(o.earned, 0, 0), spent: num(o.spent, 0, 0), mistakes: num(o.mistakes, 0, 0) | 0, since: num(o.since, now, 0) };
  if (Number.isFinite(o.mvpBase)) out.mvpBase = Math.max(0, o.mvpBase);
  return out;
}
// On shift / bench (§1). Saves from before the bench: per region + zone, the first `level` units (uid order) work.
// Unassigned units are never on shift; a zone above the soft cap keeps its units (nothing is deleted).
function normalizeActive(units, level) {
  const n = u => parseInt(String(u.uid).replace(/\D+/g, ''), 10) || 0;
  const groups = new Map();
  for (const u of [...units].sort((a, b) => n(a) - n(b))) {
    if (!u.assigned) { u.active = false; continue; }
    const key = `${u.assigned.regionId}|${u.assigned.zone}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }
  for (const list of groups.values()) {
    const legacy = list.some(u => typeof u.active !== 'boolean');
    let on = 0;
    for (const u of list) {
      const want = legacy ? on < level : u.active === true && on < level; // never more on shift than slots
      u.active = want;
      if (want) on++;
    }
  }
}

// Layout 2 (café split out of the farm into its own area): saves made with layout 1 had the café block on the farm at
// S [4,2,16,14] and a Round-2 café lot B3 [18,2,28,12]. Shift those buildings into the café area and rename B3 → C2.
// Layout migrations (per region). Old buildings are never silently lost: anything that no longer fits is refunded in coins.
//  1 → 2: café split out of the farm into its own area: shift café buildings, rename the old café lot B3 → C2.
//  2 → 3: the farm is fields only: build lots B1–B5 are gone (bought lots refunded), buildings on them refunded,
//         starter buildings snap to their FIXED spots (the storehouse moved).
export const LAYOUT_VERSION = 5;
const OLD_CAFE_RECTS = [[4, 2, 16, 14], [18, 2, 28, 12]];
const CAFE_SHIFT = { x: -10, z: 100 };
const OLD_BUILD_LOT_COST = { B1: 0, B2: 150, B3: 800, B4: 3000, B5: 4500 };
const builtValue = b => { const def = BUILDINGS[b.type]; if (!def) return 0; return def.cost + (def.upgrade || []).slice(0, Math.max(0, (b.level | 0) - 1)).reduce((a, c) => a + c, 0); };
function migrateLayout(v) {
  let out = v, refund = 0;
  if (!out.layout || out.layout < 2) {
    const inOld = b => OLD_CAFE_RECTS.some(([x0, z0, x1, z1]) => b.x >= x0 && b.x <= x1 && b.z >= z0 && b.z <= z1);
    const buildings = Array.isArray(out.buildings) ? out.buildings.map(b => (obj(b) && Number.isFinite(b.x) && Number.isFinite(b.z) && (BUILDINGS[b.type]?.zone === 'shop' || inOld(b)) && b.z < 50
      ? { ...b, x: b.x + CAFE_SHIFT.x, z: b.z + CAFE_SHIFT.z } : b)) : out.buildings;
    const parcels = Array.isArray(out.parcels) ? out.parcels.map(id => (id === 'B3' ? 'C2' : id)) : out.parcels;
    out = { ...out, buildings, parcels, layout: 2 };
  }
  if (out.layout < 3) {
    const parcels = Array.isArray(out.parcels) ? out.parcels.filter(id => { if (id in OLD_BUILD_LOT_COST) { refund += OLD_BUILD_LOT_COST[id]; return false; } return true; }) : out.parcels;
    const buildings = Array.isArray(out.buildings) ? out.buildings.flatMap(b => {
      if (!obj(b)) return [];
      if (BUILDINGS[b.type]?.starter && FIXED[b.type]) return [{ ...b, x: FIXED[b.type].x, z: FIXED[b.type].z, rot: FIXED[b.type].rot }];
      if (Number.isFinite(b.z) && b.z < 50) { refund += builtValue(b); return []; } // farm-side building: refunded
      return [b];
    }) : out.buildings;
    out = { ...out, parcels, buildings, layout: 3 };
  }
  if (out.layout < 4) {
    const v4 = migrateFarmLots(out);
    refund += v4.refund;
    out = { ...out, parcels: v4.parcels, buildings: v4.buildings, layout: 4 };
  }
  if (out.layout < 5) {
    // 4 → 5 (Farm World 2.0, docs/farm-world-2.0/SAVE-MIGRATION-PLAN.md): fields become placeables. Every owned field lot
    // keeps its 6 classic plots as fields with the SAME ids and positions, so every growing crop (region.plots), staff
    // job and tutorial target stays valid. Nothing moves, nothing is refunded. Dryers keep their spot and level (they
    // process beans now instead of multiplying them).
    const owned = Array.isArray(out.parcels) ? out.parcels.filter(id => typeof id === 'string' && Object.hasOwn(PARCELS, id)) : [];
    const fields = Array.isArray(out.fields) && out.fields.length ? out.fields
      : [...new Set(owned)].filter(id => PARCELS[id].kind === 'farm').flatMap(id => plotsOf(id).map(p => ({ id: p.id, x: p.x, z: p.z })));
    out = { ...out, fields, layout: 5 };
  }
  return refund ? { ...out, refund } : out;
}

// Layout v4 (farm map with lots, docs/design/farm-map.md): farm buildings used to stand on free grass; now they must
// stand inside an owned lot of a matching kind. Every region gets the free starter yard Y0; a farm with buildings
// outside the lots also gets the W1 workshop lot (and the D1 flower bed if decor still does not fit). Each misplaced
// building moves to the first free spot in those lots (scan on the 1 m grid); no room → refunded (builtValue).
const fpOf = (type, x, z, rot = 0) => {
  let [w, d] = BUILDINGS[type].size;
  if (rot % 2) [w, d] = [d, w];
  return [x - w * CELL / 2, z - d * CELL / 2, x + w * CELL / 2, z + d * CELL / 2];
};
function migrateFarmLots(v) {
  const parcels = Array.isArray(v.parcels) ? [...new Set(v.parcels.filter(id => Object.hasOwn(PARCELS, id)))] : [];
  if (!parcels.includes('Y0') && parcels.length) parcels.push('Y0'); // not for an empty region (fresh / expired record)
  const all = Array.isArray(v.buildings) ? v.buildings.filter(b => obj(b) && typeof b.type === 'string' && Object.hasOwn(BUILDINGS, b.type) && Number.isFinite(b.x) && Number.isFinite(b.z)) : [];
  const onFarm = b => b.z < 82;
  const lotOf = fp => Object.values(PARCELS).find(p => inRect(fp[0], fp[1], p.rect) && inRect(fp[2], fp[3], p.rect));
  const fits = (b, placed) => {
    const def = BUILDINGS[b.type];
    if (def.starter && FIXED[b.type]) return true;
    const fp = fpOf(b.type, b.x, b.z, b.rot);
    const lot = lotOf(fp);
    return !!lot && parcels.includes(lot.id) && (LOT_KINDS[def.zone] || []).includes(lot.kind) && !placed.some(o => rectsOverlap(fp, fpOf(o.type, o.x, o.z, o.rot)));
  };
  const kept = [], misplaced = [];
  for (const b of all) (onFarm(b) && !fits(b, kept) ? misplaced : kept).push(b);
  let refund = 0;
  if (misplaced.length && !parcels.includes('W1')) parcels.push('W1');
  const isDecor = b => BUILDINGS[b.type].zone !== 'farm';
  if (misplaced.some(isDecor) && !parcels.includes('D1')) parcels.push('D1'); // decor gets its own flower bed first
  // Farm buildings (dryer…) first: build lots are their only home. Decor then prefers decor / pasture / orchard / pond
  // lots and uses build lots last, so it never pushes a production building out.
  misplaced.sort((a, b) => isDecor(a) - isDecor(b));
  const LOT_PREF = { decor: 0, pasture: 1, orchard: 2, pond: 3, build: 4 };
  const spot = b => {
    const def = BUILDINGS[b.type];
    const [w, d] = def.size.map(n => n * CELL);
    const lots = parcels.map(id => PARCELS[id]).filter(p => p && areaOfParcel(p.id) === 'farm' && (LOT_KINDS[def.zone] || []).includes(p.kind))
      .sort((a, b2) => (isDecor(b) ? (LOT_PREF[a.kind] ?? 9) - (LOT_PREF[b2.kind] ?? 9) : 0));
    for (const lot of lots) {
      const [x0, z0, x1, z1] = lot.rect;
      for (let z = z0 + d / 2; z <= z1 - d / 2 + 1e-6; z += 1) for (let x = x0 + w / 2; x <= x1 - w / 2 + 1e-6; x += 1) {
        const c = { ...b, x, z, rot: 0 };
        if (fits(c, kept)) return c;
      }
    }
    return null;
  };
  for (const b of misplaced) {
    const c = spot(b);
    if (c) kept.push(c); else refund += builtValue(b);
  }
  return { parcels, buildings: kept, refund };
}

export function normalizeRegion(r) {
  const v = migrateLayout(obj(r) || {});
  const buildings = Array.isArray(v.buildings) ? v.buildings.filter(b => obj(b) && typeof b.type === 'string' && Object.hasOwn(BUILDINGS, b.type)).map(normalizeBuilding) : [];
  const fields = normalizeFields(v.fields);
  const fieldIds = new Set(fields.map(f => f.id));
  return {
    layout: LAYOUT_VERSION,
    mode: v.mode === 'farm' || v.mode === 'cafe' ? v.mode : null, // the game this region is played as
    ...(v.refund ? { refund: v.refund } : {}),
    status: ['active', 'idle', 'expired'].includes(v.status) ? v.status : 'idle',
    enteredAt: num(v.enteredAt, 0), expiredAt: num(v.expiredAt, 0),
    parcels: Array.isArray(v.parcels) ? [...new Set(v.parcels.filter(id => typeof id === 'string' && Object.hasOwn(PARCELS, id)))] : [], // unknown lot ids dropped
    roads: Array.isArray(v.roads) ? [...new Set(v.roads)] : [],
    buildings,
    fields,
    // peak: most copies ever built per type here (build XP is earned once per copy slot — no build/remove XP loop).
    peak: Object.fromEntries([...Object.entries(obj(v.peak) || {}).filter(([k, n]) => (k === 'field' || Object.hasOwn(BUILDINGS, k)) && Number.isFinite(n)).map(([k, n]) => [k, Math.max(0, n | 0)]),
      ...Object.keys(BUILDINGS).map(k => [k, buildings.filter(b => b.type === k).length]).filter(([, n]) => n > 0), ['field', fields.length]]
      .reduce((m, [k, n]) => (m.set(k, Math.max(m.get(k) || 0, n)), m), new Map())),
    // Crops only on fields that exist (orphans from damaged saves are dropped).
    plots: Object.fromEntries(Object.entries(obj(v.plots) || {}).filter(([id, p]) => fieldIds.has(id) && obj(p))),
    // pausedAt: the café stands still while the player is on the farm (no customers, patience / brewing frozen).
    shop: { orders: Array.isArray(v.shop?.orders) ? v.shop.orders : [], nextOrder: num(v.shop?.nextOrder, 1), pausedAt: num(v.shop?.pausedAt, 0, 0) },
    street: normalizeStreet(v.street),
  };
}

// Fields (crop beds): unique string ids, finite positions. Old ids (F1-1 …) and new ones (fd12) alike.
function normalizeFields(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).filter(f => obj(f) && typeof f.id === 'string' && f.id.length <= 40 && Number.isFinite(f.x) && Number.isFinite(f.z)
    && !seen.has(f.id) && seen.add(f.id)).map(f => ({ id: f.id, x: f.x, z: f.z }));
}
// A building: integer level within its upgrade list, rotation 0..3, a valid production batch or none.
function normalizeBuilding(b) {
  const def = BUILDINGS[b.type];
  const out = { ...b, level: num(b.level, 1, 1, (def.upgrade?.length || 0) + 1) | 0, rot: ((Math.round(num(b.rot, 0)) % 4) + 4) % 4 };
  if (!Number.isFinite(out.x) || !Number.isFinite(out.z)) { out.x = FIXED[b.type]?.x ?? 0; out.z = FIXED[b.type]?.z ?? 0; }
  if (out.spent != null && !(Number.isFinite(out.spent) && out.spent >= 0)) delete out.spent;
  const j = obj(b.job);
  if (j && Object.hasOwn(RECIPES, j.recipe) && Number.isFinite(j.at) && Number.isFinite(j.ms) && j.ms >= 0) {
    const goods = o => Object.fromEntries(Object.entries(obj(o) || {}).filter(([g, n]) => Object.hasOwn(GOODS, g) && Number.isFinite(n) && n > 0).map(([g, n]) => [g, n | 0]));
    out.job = { recipe: j.recipe, at: j.at, ms: j.ms, out: goods(j.out), xp: num(j.xp, 0, 0, 1e4) };
  } else delete out.job;
  return out;
}

// Café street (docs/design/cafe-street.md): open = unlocked venues ('cafe' is always open, so never listed; unknown
// ids dropped), rating = per shop {avg 1..5★, n reviews}, default RATING.start (neutral) with no reviews.
export function normalizeStreet(raw) {
  const st = obj(raw) || {};
  const open = Array.isArray(st.open) ? st.open : [];
  const rating = obj(st.rating) || {};
  return {
    open: [...new Set(open.filter(id => typeof id === 'string' && id !== 'cafe' && Object.hasOwn(VENUES, id)))],
    rating: Object.fromEntries(Object.keys(VENUES).map(id => {
      const r = Object.hasOwn(rating, id) ? obj(rating[id]) : null;
      return [id, { avg: num(r?.avg, RATING.start, 1, 5), n: Math.floor(num(r?.n, 0, 0, 1e9)) }];
    })),
  };
}

export const clone = value => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
