// Save schema v3 (Farm & Café V3). Stored under its own localStorage key, so the old v1 save is never overwritten.
import { maxStatOf, maxTierOf, EXPIRY_ENABLED, AUTO } from './config/economy.js';
import { STAFF_CAP, FARM_MANAGER } from './config/economy.js';
import { crewTypeOf, workerJobs } from './config/economy.js';
import { TASKS, PENALTY, HISTORY, CROPS, GM, GEAR, INCOME, LOAN, loanTermMin, stanceMode, CHECKUP, checkupGrade, incomeRef, SOFTWARE, WARRANTY, PROFILE, CAREER, CRAFT, profileOfUid, robotSerial, START, BUILDINGS, STAFF, TRAITS, RECRUIT, ROBOT_TASKS, PLAYTEST, SKILL, STAT_ORDER, VITALS, RARE, WORKER_TASKS, BOOKS, energyMax, levelForXp, startCoins, VENUES, RATING, CELL } from './config/economy.js';
import { COUNTRIES, LEGACY_REGIONS, isRegionId, regionGames } from './config/world.js';
import { countryRecipes, SUPPLY } from './config/research.js';
import { FIXED, PARCELS, LOT_KINDS, areaOfParcel, inRect, rectsOverlap, plotsOf, ESTATES } from './config/layout.js';
import { RECIPES, GOODS, ITEM_GOODS } from './config/economy.js';
import { settleSizes } from './settle-sizes.js';
import { newWallet, normalizeWallet } from './wallet.js';
import { LEGACY_HOMES } from './config/staff-people.js';

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
    player: { coins: startCoins(), xp: 0, round: 1 }, // coins: the Gold of the city being played (core/wallet.js)
    wallet: newWallet(), // USD for the account, Gold per city, day books, money history
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
    // upkeepAt: last bench upkeep charge; ledger: team earned / spent per game minute; mvp: the last MVP
    // (docs/design/staff-manager.md). A rival's offer is an inbox task (s.tasks), the journal is in s.history.
    staff: { units: [], pool: { farm: { seed: 1, at: 0 }, shop: { seed: 2, at: 0 } }, upkeepAt: 0, ledger: [], daily: [], gearStock: [], mvp: null },
    // gm: the general manager (docs/design/general-manager.md) — hired unit, powers, budget window, requests, chaos.
    gm: newGmState(),
    // research: recipes found per country (menu item indices), the last tests per country, the bench's busy time.
    research: { known: {}, tests: {}, busyUntil: 0 },
    // supply: suppliers / buyers found per region and group, contracts, the chosen / locked buyer, the scout, late beans.
    supply: { found: {}, contracts: {}, buyer: {}, scout: null, pending: [] },
    // farmLab: adopted crop methods, trial fields running and their results — per region (research step 3).
    farmLab: { methods: {}, trials: {}, results: {} },
    rewards: { claimed: [], tickets: 0 }, // level gifts opened (levels) + free-hire tickets
    // loans: open loans (≤ LOAN.maxOpen) { id, amount, owed, takenAtPlayed, termMin, late } — oldest first.
    loans: [],
    // debt.wages: wage arrears (management-rules §2.7) — the GM's unpaid salary and the follower's unpaid wage.
    debt: { wages: { gm: 0, follower: 0 } },
    // clock.played: ms of PLAYED time (clock/tick, management-rules §4.1); income.rows: coins per played minute (§2.0).
    clock: { played: 0 },
    income: { rows: [] },
    // tasks: the inbox (management-rules §1.2 / §4): open ≤ TASKS.cap, done ≤ TASKS.doneKeep, key cooldowns, recent
    // fines, today's penalty totals. history: Nhật ký (§1.3 / §5): shared rows, per-day rows, tombstones.
    tasks: newTasks(),
    history: newHistory(),
    // mode: the current region's game (region.mode: 'farm' | 'cafe'; null → the HUD asks, offering only the games the
    // region's country has). Coins / XP / level / beans are shared by both games.
    mode: null,
    tutorial: { step: 0, done: true, farmDone: true, cafeDone: true }, // the opening tutorial is removed
    autoplay: { runs: AUTO.freeRuns, granted: true, bought: 0, saved: 0, active: null, tally: null, last: null, retired: null }, // active = { leftMs } while a run plays; saved = ms kept by Pause, tally = that run's numbers so far; last = the finished run's numbers; retired = the hired farm manager Auto replaced, until the player has been told
    quests: { claimed: [], loop: 0 }, // quests claimed (core/quests.js); loop = how many endless ones are done
    stats: { harvested: 0, planted: 0, served: 0, built: 0, upgraded: 0, parcels: 0, earned: 0, sold: 0, bought: 0, venueSold: 0, reviews: 0, fights: 0 },
    tx: [],
    nextUid: 1,
  };
}

export const newTasks = () => ({ open: [], done: [], cool: {}, fines: [], pen: { d: 0, loyalty: 0, morale: {} } });
export const newHistory = () => ({ rows: [], days: [], tombstones: [], seq: 0 });
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
  if (!EXPIRY_ENABLED && out.story.phase === 'expiry') { out.story.phase = 'play'; out.story.expiry = null; } // the Level-10 limit is off: a save waiting on it just plays on
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
  // Beans per variety (docs/design/coffee-varieties.md). Old saves have none: every bean they hold becomes Robusta.
  const mix = obj(out.inventory.beanMix) || {};
  out.inventory.beanMix = Object.fromEntries(Object.keys(CROPS).map(c => [c, num(mix[c], 0, 0, 1e9) | 0]));
  const mixSum = Object.values(out.inventory.beanMix).reduce((a, b) => a + b, 0);
  if (mixSum !== out.inventory.beans) out.inventory.beanMix = { ...Object.fromEntries(Object.keys(CROPS).map(c => [c, 0])), robusta: out.inventory.beans };
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
  // Farm crew (docs/design/farm-crew.md §4): a farmhand / SproutBot from an older save becomes a trade; its stats stay.
  let oldHands = 0;
  const toCrew = u => {
    if (!obj(u) || (u.type !== 'farmhand' && u.type !== 'sproutBot')) return u;
    const type = crewTypeOf(u, u.type === 'farmhand' ? oldHands++ : 0);
    return { ...u, type, task: 'auto', tasks: [] };
  };
  const savedUnits = Array.isArray(s.staff?.units) ? s.staff.units : [];
  // Herders left the game with the livestock (founder 2026-11-09): a saved one goes and the coins paid for the hire come back.
  const herders = savedUnits.filter(u => obj(u) && u.type === 'herder');
  for (const u of herders) out.player.coins += num(u.paid, 0, 0, 1e9);
  out.staff = { units: savedUnits.map(toCrew).filter(u => obj(u) && typeof u.type === 'string' && Object.hasOwn(STAFF, u.type)).map(u => ({ ...u })) };
  for (const u of out.staff.units) {
    if (obj(u.assigned) && typeof u.assigned.regionId === 'string') u.assigned = { ...u.assigned, regionId: remap(u.assigned.regionId) };
    if (u.trait != null && !Object.hasOwn(TRAITS, u.trait)) delete u.trait;
    if (u.name != null) u.name = String(u.name).slice(0, 20);
    if (STAFF[u.type].kind === 'robot') {
      if (!ROBOT_TASKS[u.type]?.includes(u.task)) u.task = 'auto';
      // The old charger part is merged into the battery (battery = the better of the two).
      const p = obj(u.parts) || {}, t = v => num(v, 0, 0, maxTierOf(u)) | 0;
      u.parts = { battery: Math.max(t(p.battery), t(p.charger)), motor: t(p.motor), cooler: t(p.cooler), frame: t(p.frame) };
      u.heat = num(u.heat, 0, 0, 100); u.wear = num(u.wear, 100, 0, 100); u.partsSpent = num(u.partsSpent, 0, 0, 1e9);
      delete u.level; delete u.xp; delete u.tasks; delete u.breakUntil;
    } else normalizeWorker(u);
    u.paid = num(u.paid, 0, 0, 1e9);
    if (u.perk != null && !RARE.perks.includes(u.perk)) delete u.perk;
    u.book = normalizeBook(u.book, now);
    normalizeProfile(u, now);
    // Career tenure in played minutes (management-rules §2.5): a save from before it counts its real time on the team,
    // at most one shift-day (nobody jumps a rank on the migration).
    u.tenurePlayedMin = num(u.tenurePlayedMin, Math.min(CAREER.shiftDayMin, Math.max(0, (now - u.hiredAt) / 60000)), 0, 1e9);
    if (u.stopped != null && !(obj(u.stopped) && typeof u.stopped.kind === 'string')) delete u.stopped;
    if (!obj(u.assigned) || typeof u.assigned.regionId !== 'string') u.assigned = null;
  }
  normalizeActive(out.staff.units, STAFF_CAP.perZone); // no limit by level: every unit keeps its shift
  const st = obj(s.staff) || {};
  out.staff.upkeepAt = num(st.upkeepAt, 0, 0);
  // Ledger rows (per minute) and team day rows (per local day): earned, spent and the spending categories.
  const nums = row => Object.fromEntries(['earned', 'spent', 'robot', 'upgrade', 'upkeep', 'wage', 'hire', 'gm', 'research'].filter(k => num(row?.[k], 0, 0) > 0).map(k => [k, num(row[k], 0, 0)]));
  const cats = row => ({ ...nums(row), ...Object.fromEntries(['farm', 'shop'].filter(z => obj(row[z])).map(z => [z, nums(row[z])])) });
  out.staff.ledger = (Array.isArray(st.ledger) ? st.ledger : []).filter(e => obj(e) && Number.isFinite(e.min))
    .map(e => ({ min: e.min, earned: num(e.earned, 0, 0), spent: num(e.spent, 0, 0), ...cats(e) })).slice(-BOOKS.ledgerKeep);
  out.staff.daily = (Array.isArray(st.daily) ? st.daily : backfillDaily(out.staff.units)).filter(e => obj(e) && Number.isInteger(e.d))
    .map(e => ({ d: e.d, earned: num(e.earned, 0, 0), spent: num(e.spent, 0, 0), ...cats(e) })).sort((a, b) => a.d - b.d).slice(-PROFILE.teamDaysKeep);
  out.staff.mvp = obj(st.mvp) ? st.mvp : null;
  out.gm = normalizeGm(s.gm);
  out.research = normalizeResearch(s.research);
  out.supply = normalizeSupply(s.supply);
  out.farmLab = normalizeFarmLab(s.farmLab);
  out.staff.gearStock = (Array.isArray(st.gearStock) ? st.gearStock : []).filter(g => obj(g) && (g.zone === 'farm' || g.zone === 'shop') && GEAR.items[g.item] && (GEAR.zone[g.zone] || []).includes(g.item))
    .map(g => ({ zone: g.zone, item: g.item, tier: num(g.tier, 1, 1, GEAR.maxTier) | 0 })).slice(-GEAR.stockKeep);
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
  normalizeMoney(out, s, levelForXp(out.player.xp));
  normalizeHistory(out, s, now);
  out.history.tombstones = [...out.history.tombstones, ...herders.filter(u => typeof u.uid === 'string').map(u => ({ uid: u.uid.slice(0, 16), name: typeof u.name === 'string' ? u.name.slice(0, 20) : null, kind: 'worker', leftAt: now }))].slice(-HISTORY.tombstones);
  const gone = removedUids(s);
  if (out.gm.orders) out.gm.orders = out.gm.orders.filter(o => !staleAct(o, gone));
  normalizeTasks(out, s, now, gone);
  out.tutorial = { ...base.tutorial, ...obj(s.tutorial) };
  if (out.tutorial.done) { out.tutorial.farmDone = true; out.tutorial.cafeDone = true; } // skipped before the split
  out.autoplay = { ...base.autoplay, ...obj(s.autoplay) };
  out.autoplay.runs = num(out.autoplay.runs, 0, 0, 99) | 0;
  out.autoplay.bought = num(out.autoplay.bought, 0, 0, 999) | 0;
  out.autoplay.saved = num(out.autoplay.saved, 0, 0, AUTO.runSeconds * 1000);
  // A run counts played time down (leftMs); the old wall-clock runs ({ startedAt, endsAt }) are over.
  const act = obj(out.autoplay.active);
  const runBook = v => (obj(v) ? { jobs: num(v.jobs, 0, 0) | 0, earned: num(v.earned, 0, 0), spent: num(v.spent, 0, 0), ...(Number.isFinite(v.at) ? { at: v.at } : {}) } : null);
  out.autoplay.active = act && Number.isFinite(act.leftMs) && act.leftMs > 0 ? { leftMs: Math.min(act.leftMs, AUTO.runSeconds * 1000), ...(obj(act.book) ? { book: runBook(act.book) } : {}) } : null;
  out.autoplay.tally = runBook(out.autoplay.tally);
  out.autoplay.last = runBook(out.autoplay.last);
  const retired = obj(out.autoplay.retired);
  out.autoplay.retired = retired ? { name: typeof retired.name === 'string' ? retired.name.slice(0, 20) : '', coins: num(retired.coins, 0, 0, 1e9) } : null;
  if (out.gm.unit?.isAuto && !out.autoplay.active) { out.gm.unit = null; out.gm.orders = []; } // Auto's stand-in lives only as long as its run
  // Every save gets its free run(s) once.
  if (!out.autoplay.granted) { out.autoplay.runs += AUTO.freeRuns; out.autoplay.granted = true; }
  { const q = obj(s.quests) || {}; out.quests = { claimed: Array.isArray(q.claimed) ? q.claimed.filter(id => typeof id === 'string') : [], loop: num(q.loop, 0, 0, 1e6) | 0 }; }
  out.stats = { ...base.stats, ...obj(s.stats) };
  out.tx = Array.isArray(s.tx) ? s.tx.slice(-64) : [];
  out.nextUid = num(s.nextUid, 1, 1) | 0;
  normalizeWallet(out, s.wallet, now);
  return out;
}

// Workers (docs/design/staff-manager.md §3, §5): an old single `level` L becomes all four stats = L (XP kept modulo
// SKILL.xpPerPoint); vitals default to a fresh hire's; tasks only from the zone's list.
function normalizeWorker(u) {
  const st = obj(u.stats);
  const old = num(u.level, 1, 1, maxStatOf(u)) | 0;
  u.stats = Object.fromEntries(STAT_ORDER.map(k => [k, num(st ? st[k] : old, st ? 1 : old, 1, maxStatOf(u)) | 0]));
  u.points = num(u.points, 0, 0, 1e6) | 0;
  u.xp = st ? num(u.xp, 0, 0, SKILL.xpPerPoint) : num(u.xp, 0, 0, 1e6) % SKILL.xpPerPoint;
  delete u.level;
  u.water = num(u.water, 0, 0, 9) | 0;
  u.energy = num(u.energy, VITALS.start.energy, 0, energyMax(u));
  u.fullness = num(u.fullness, VITALS.start.fullness, 0, 100);
  u.morale = num(u.morale, VITALS.start.morale, 0, 100);
  const allowed = STAFF[u.type].jobs ? [] : workerJobs(u); // a trade has one job: nothing to choose
  u.tasks = Array.isArray(u.tasks) ? [...new Set(u.tasks.filter(t => allowed.includes(t)))].slice(0, 2) : [];
  if (u.breakUntil != null && !Number.isFinite(u.breakUntil)) delete u.breakUntil;
  delete u.task; delete u.parts; delete u.heat; delete u.wear;
}
// Crop methods block: [s, d, f] each 0..2, trials with a plot id, results keyed by method.
function normalizeFarmLab(raw) {
  const r = obj(raw) || {}, out = { methods: {}, trials: {}, results: {} };
  const ok = m => Array.isArray(m) && m.length === 3 && m.every(v => Number.isInteger(v) && v >= 0 && v <= 2);
  for (const [rid, c] of Object.entries(obj(r.methods) || {})) { const o = {}; for (const [crop, m] of Object.entries(obj(c) || {})) if (CROPS[crop] && ok(m)) o[crop] = [...m]; if (Object.keys(o).length) out.methods[rid] = o; }
  for (const [rid, list] of Object.entries(obj(r.trials) || {})) { const l = (Array.isArray(list) ? list : []).filter(t => obj(t) && typeof t.plotId === 'string' && CROPS[t.crop] && ok(t.method)); if (l.length) out.trials[rid] = l.map(t => ({ plotId: t.plotId, crop: t.crop, method: [...t.method], at: num(t.at, 0, 0) })); }
  for (const [rid, c] of Object.entries(obj(r.results) || {})) {
    const o = {};
    for (const [crop, byKey] of Object.entries(obj(c) || {})) { if (!CROPS[crop]) continue; const k = {}; for (const [key, x] of Object.entries(obj(byKey) || {})) if (obj(x) && ok(x.method)) k[key] = { method: [...x.method], beans: num(x.beans, 0, 0), ms: num(x.ms, 0, 0), up: !!x.up, at: num(x.at, 0, 0) }; if (Object.keys(k).length) o[crop] = k; }
    if (Object.keys(o).length) out.results[rid] = o;
  }
  return out;
}
// Supply block: counts, contracts and buyers keyed by region id; unknown shapes dropped.
function normalizeSupply(raw) {
  const r = obj(raw) || {}, out = { found: {}, contracts: {}, buyer: {}, scout: null, pending: [] };
  const groups = [...SUPPLY.groupOrder, 'buyers'];
  for (const [rid, f] of Object.entries(obj(r.found) || {})) {
    const o = {}; for (const g of groups) { const n = num(obj(f)?.[g], 0, 0, g === 'buyers' ? SUPPLY.buyers.count : SUPPLY.perGroup) | 0; if (n) o[g] = n; }
    if (Object.keys(o).length) out.found[rid] = o;
  }
  for (const [rid, c] of Object.entries(obj(r.contracts) || {})) {
    const o = {}; for (const g of SUPPLY.groupOrder) { const x = obj(obj(c)?.[g]); if (x && Number.isInteger(x.i) && Number.isFinite(x.until)) o[g] = { i: x.i, until: x.until, days: num(x.days, 1, 1, 7) | 0 }; }
    if (Object.keys(o).length) out.contracts[rid] = o;
  }
  for (const [rid, b] of Object.entries(obj(r.buyer) || {})) {
    const x = obj(b); if (!x || !Number.isInteger(x.i)) continue;
    out.buyer[rid] = x.lockedUntil > 0 && obj(x.mul) ? { i: x.i, lockedUntil: x.lockedUntil, mul: { ...x.mul } } : { i: x.i };
  }
  const sc = obj(r.scout);
  if (sc && typeof sc.regionId === 'string' && Number.isFinite(sc.until) && typeof sc.group === 'string') out.scout = { regionId: sc.regionId, group: sc.group, until: sc.until };
  out.pending = (Array.isArray(r.pending) ? r.pending : []).filter(p => obj(p) && Number.isFinite(p.at) && p.amount > 0).map(p => ({ amount: p.amount | 0, at: p.at }));
  return out;
}
// Research block: known recipe indices per country (valid indices only), last tests, bench time.
function normalizeResearch(raw) {
  const r = obj(raw) || {}, out = { known: {}, tests: {}, busyUntil: num(r.busyUntil, 0, 0) };
  for (const [cc, list] of Object.entries(obj(r.known) || {})) {
    const max = countryRecipes(cc).length;
    const ok = (Array.isArray(list) ? list : []).filter(i => Number.isInteger(i) && i >= 0 && i < max);
    if (ok.length) out.known[cc] = [...new Set(ok)].sort((a, b) => a - b);
  }
  for (const [cc, list] of Object.entries(obj(r.tests) || {})) {
    const ok = (Array.isArray(list) ? list : []).filter(t => obj(t) && Number.isFinite(t.at) && typeof t.result === 'string').slice(0, 8);
    if (ok.length) out.tests[cc] = ok;
  }
  return out;
}
/** A fresh general-manager block (no GM hired). */
export function newGmState() {
  // careWin: the care wallet's played window; licences: the player's (kept by the Level-10 incident). Requests and a
  // rival's offer are inbox tasks (s.tasks), the log is history rows (s.history).
  return { unit: null, mode: GM.defaults.mode, budget: GM.defaults.budget, bigLimit: GM.defaults.bigLimit, window: null, careWin: null, days: [],
    board: { seed: 7, at: 0 }, payAt: 0, lastJobAt: 0, seenAt: 0, chaos: null, shareFrom: 0, licences: [],
    // planner v2 (management-rules §3.3–§3.7): plan = the day plan { atPlayed, crops { lotId: crop }, target }; util =
    // land-use samples { rows [{ m, z, p, q }] }; ticks = rules held n thinks in a row; wish = licences missed today
    // { d, n, m }; busy = thinks in a row with more candidates than actions { n, excess, avg }; topUp = { d, denied, filed }.
    plan: null, util: null, ticks: {}, wish: null, busy: null, topUp: null,
    fm: newFmState() };
}
// Farm Manager V2 settings (docs/design/farm-manager-v2.md). auto: he runs the farm at all; minReserve / spendLimit: 0 = none
// beyond the automatic reserve / income budget; pins: the tier the player fixed for a unit; plan / log / calib / away: his own notes.
export function newFmState() { return { auto: true, stance: FARM_MANAGER.stance.start, mode: 'balanced', ask: false, minReserve: 0, spendLimit: 0, build: true, land: true, hire: true, autoSell: true, pins: {}, plan: null, log: [], calib: 1, away: null }; }
function normalizeFm(raw) {
  const f = obj(raw), out = newFmState();
  if (!f) return out;
  for (const k of ['auto', 'build', 'land', 'hire']) if (typeof f[k] === 'boolean') out[k] = f[k];
  // On by default (founder 2026-11-09), older saves too: only a choice the player made himself (sellChosen) is kept.
  if (f.sellChosen === true && typeof f.autoSell === 'boolean') { out.autoSell = f.autoSell; out.sellChosen = true; }
  // Saves from before the slider chose a mode: each one starts on its mark, and "ask me" (manual) becomes the switch.
  const stance = Number.isInteger(f.stance) && f.stance >= 0 && f.stance <= 100 ? f.stance : FARM_MANAGER.stance.marks.find(m => m[1] === f.mode)?.[0] ?? FARM_MANAGER.stance.start;
  out.stance = stance; out.mode = stanceMode(stance); out.ask = f.ask === true || f.mode === 'manual';
  out.minReserve = FARM_MANAGER.reservePicks.includes(f.minReserve) ? f.minReserve : 0;
  out.spendLimit = FARM_MANAGER.limitPicks.includes(f.spendLimit) ? f.spendLimit : 0;
  const pins = obj(f.pins) || {};
  out.pins = Object.fromEntries(Object.entries(pins).filter(([, t]) => Number.isInteger(t) && t >= 0 && t <= 3));
  if (obj(f.plan) && Number.isFinite(f.plan.at)) out.plan = f.plan;
  out.log = (Array.isArray(f.log) ? f.log : []).filter(e => obj(e) && typeof e.k === 'string' && Number.isFinite(e.p) && !namesRemoved(e)).slice(-FARM_MANAGER.logKeep);
  out.calib = num(f.calib, 1, FARM_MANAGER.calib.min, FARM_MANAGER.calib.max);
  if (obj(f.away) && Number.isFinite(f.away.at)) out.away = f.away;
  return out;
}
// General manager block of a save: known values only; a broken one starts fresh (nothing else depends on it).
function normalizeGm(raw) {
  const g = obj(raw), out = newGmState();
  if (!g) return out;
  const u = obj(g.unit);
  if (u && typeof u.name === 'string') {
    // The shared Unit interface (management-rules §1.1): uid 'g1', kind 'manager', book / days / recent, backlog and
    // its states (waiting = Chờ lệnh, strike = Đình công). The GM stays in s.gm, never in s.staff.units.
    const b = obj(u.book) || {};
    out.unit = { uid: 'g1', kind: 'manager', ...(u.isAuto === true ? { isAuto: true } : {}), name: u.name.slice(0, 20), gender: u.gender === 'male' ? 'male' : 'female', skill: num(u.skill, 1, 1, 5) | 0, worked: num(u.worked, 0, 0, 1e7) | 0, ...(obj(u.stats) ? { stats: Object.fromEntries(GM.stats.map(k => [k, num(u.stats[k], 1, 1, GM.maxStat) | 0])) } : {}),
      style: GM.styles[u.style] ? u.style : 'balanced', loyalty: num(u.loyalty, GM.loyalty.start, 0, 100), raises: num(u.raises, 0, 0, 20) | 0, hiredAt: num(u.hiredAt, 0, 0), paid: num(u.paid, 0, 0, 1e9),
      tenurePlayedMin: num(u.tenurePlayedMin, 0, 0, 1e9), backlog: num(u.backlog, 0, 0, 99) | 0, decayMs: num(u.decayMs, 0, 0, 36e5),
      book: { jobs: num(b.jobs, 0, 0) | 0, earned: num(b.earned, 0, 0), spent: num(b.spent, 0, 0), mistakes: num(b.mistakes, 0, 0) | 0, since: num(b.since, num(u.hiredAt, 0, 0), 0) },
      days: (Array.isArray(u.days) ? u.days : []).filter(r => obj(r) && Number.isInteger(r.d)).map(r => ({ d: r.d, jobs: num(r.jobs, 0, 0) | 0, earned: num(r.earned, 0, 0), spent: num(r.spent, 0, 0), mistakes: num(r.mistakes, 0, 0) | 0 }))
        .sort((a, c) => a.d - c.d).slice(-PROFILE.daysKeep),
      recent: (Array.isArray(u.recent) ? u.recent : []).filter(histRowOk).map(histRowOf).slice(-HISTORY.perUnit) };
    out.unit.backlog = 0; // old saves: a manager left on strike or waiting goes back to work
    const tr = obj(u.training);
    if (tr && Number.isFinite(tr.untilPlayed)) out.unit.training = { untilPlayed: tr.untilPlayed, to: num(tr.to, out.unit.skill + 1, 1, 5) | 0 };
  }
  if (GM.modes[g.mode]) out.mode = g.mode;
  if (GM.budgets.includes(g.budget)) out.budget = g.budget;
  if (GM.bigLimits.includes(g.bigLimit)) out.bigLimit = g.bigLimit;
  const w = obj(g.window);
  if (w && Number.isFinite(w.start)) out.window = { start: w.start, spent: num(w.spent, 0, 0) };
  const cw = obj(g.careWin);
  if (cw && Number.isFinite(cw.startPlayed)) out.careWin = { startPlayed: cw.startPlayed, spent: num(cw.spent, 0, 0) };
  out.licences = [...new Set((Array.isArray(g.licences) ? g.licences : []).filter(x => GM.licences.groups.includes(x)))];
  const rc = obj(g.returnCap);
  if (out.unit && rc && Number.isFinite(rc.untilPlayed)) out.returnCap = { untilPlayed: rc.untilPlayed, lost: num(rc.lost, 0, 0, 100) };
  if (Number.isFinite(g.laterAt) && g.laterAt >= 0) out.laterAt = g.laterAt; // the last «Để sau» (played ms)
  out.days = (Array.isArray(g.days) ? g.days : []).filter(e => obj(e) && Number.isInteger(e.d)).map(e => ({ d: e.d, actions: num(e.actions, 0, 0) | 0, salary: num(e.salary, 0, 0), spent: num(e.spent, 0, 0) })).slice(-GM.daysKeep);
  const b = obj(g.board);
  if (b) out.board = { seed: Number.isInteger(b.seed) ? b.seed : out.board.seed, at: num(b.at, 0, 0) };
  out.payAt = num(g.payAt, 0, 0);
  out.lastJobAt = num(g.lastJobAt, 0, 0);
  out.seenAt = num(g.seenAt, 0, 0);
  out.shareFrom = num(g.shareFrom, 0, 0, 1e9) | 0; // played minute from which the GM's profit share is still unpaid
  if (g.moodNote === 'idle' || g.moodNote === 'absent') out.moodNote = g.moodNote;
  out.chaos = null; // no team chaos any more
  if (Number.isInteger(g.reserve)) out.reserve = g.reserve;
  if (obj(g.tiers)) out.tiers = g.tiers;
  if (obj(g.handed)) out.handed = { farm: g.handed.farm === true, shop: g.handed.shop === true }; // team handed to him per game (staff board)
  if (Array.isArray(g.orders)) out.orders = g.orders.filter(o => obj(o) && typeof o.id === 'string' && obj(o.act));
  normalizePlanner(out, g);
  out.fm = normalizeFm(g.fm);
  return out;
}
// Planner v2 bookkeeping (normalizeGm): known shapes only, anything broken starts empty. Idempotent.
function normalizePlanner(out, g) {
  const pl = obj(g.plan), isNum = v => Number.isFinite(v);
  if (pl && isNum(pl.atPlayed)) {
    const crops = Object.fromEntries(Object.entries(obj(pl.crops) || {}).filter(([k, v]) => Object.hasOwn(PARCELS, k) && typeof v === 'string' && Object.hasOwn(CROPS, v)));
    out.plan = { atPlayed: num(pl.atPlayed, 0, 0, 1e13), crops, target: num(pl.target, 0, 0, 1e12) };
  }
  const ut = obj(g.util);
  if (ut && Array.isArray(ut.rows)) {
    const share = o => Object.fromEntries(Object.entries(obj(o) || {}).filter(([, v]) => isNum(v)).map(([k, v]) => [k, Math.min(1, Math.max(0, v))]));
    const rows = ut.rows.filter(r => obj(r) && Number.isInteger(r.m) && r.m >= 0).map(r => ({ m: r.m, z: share(r.z), p: share(r.p), q: Object.fromEntries(Object.entries(obj(r.q) || {}).filter(([, v]) => v === 1)) }))
      .sort((a, b) => a.m - b.m).filter((r, i, a) => i === a.length - 1 || a[i + 1].m !== r.m).slice(-GM.land.windowMin);
    out.util = { rows };
  }
  const ld = obj(g.load);
  if (ld) out.load = Object.fromEntries(Object.entries(ld).filter(([k, v]) => (k === 'farm' || k === 'shop') && isNum(v) && v >= 0).map(([k, v]) => [k, Math.min(1e4, v)]));
  out.ticks = Object.fromEntries(Object.entries(obj(g.ticks) || {}).filter(([k, v]) => typeof k === 'string' && Number.isInteger(v) && v > 0 && v < 1e6));
  const w = obj(g.wish);
  if (w && Number.isInteger(w.d)) {
    const ints = o => Object.fromEntries(Object.entries(obj(o) || {}).filter(([k, v]) => GM.licences.groups.includes(k) && Number.isInteger(v) && v >= 0));
    out.wish = { d: w.d, n: ints(w.n), m: ints(w.m) };
  }
  const b = obj(g.busy);
  if (b && Number.isInteger(b.n) && b.n > 0) out.busy = { n: b.n, excess: num(b.excess, 0, 0, 1e6) | 0, avg: num(b.avg, 0, 0, 1e9) };
  const t = obj(g.topUp);
  if (t && Number.isInteger(t.d)) out.topUp = { d: t.d, denied: num(t.denied, 0, 0, 1e6) | 0, filed: num(t.filed, 0, 0, 1e6) | 0 };
}
// Money blocks (management-rules §7.3): played clock, the income series, loans (s.loans[]) and wage arrears.
// Old saves: the single stacked s.loan becomes one entry (takenAtPlayed 0, term at today's level); its follower-wage part
// (an s.loan with amount 0 was only follower pay) moves to s.debt.wages.follower. Idempotent: s.loan is gone afterwards.
function normalizeMoney(out, s, level) {
  // at: the real time of the last tick (a gap ≥ TASKS.returnAwayMin = a return, §4.1); old saves: none (no return)
  out.clock = { played: num(obj(s.clock)?.played, 0, 0, 1e13), ...(Number.isFinite(obj(s.clock)?.at) && s.clock.at > 0 ? { at: s.clock.at } : {}) };
  const by = b => Object.fromEntries(INCOME.actors.filter(k => Number.isFinite(obj(b)?.[k]) && b[k] !== 0).map(k => [k, Math.round(b[k] * 100) / 100]));
  out.income = { rows: (Array.isArray(obj(s.income)?.rows) ? s.income.rows : []).filter(r => obj(r) && Number.isInteger(r.m) && r.m >= 0)
    .map(r => ({ m: r.m, earned: num(r.earned, 0, 0, 1e12), spent: num(r.spent, 0, 0, 1e12), by: by(r.by) }))
    .sort((a, b) => a.m - b.m).filter((r, i, a) => i === a.length - 1 || a[i + 1].m !== r.m).slice(-INCOME.keepMinutes) };
  const w = obj(obj(s.debt)?.wages) || {};
  const wages = { gm: num(w.gm, 0, 0, 1e9), follower: num(w.follower, 0, 0, 1e9) };
  let loans = (Array.isArray(s.loans) ? s.loans : []).filter(ln => obj(ln) && Number.isFinite(ln.owed) && ln.owed > 0)
    .map((ln, i) => ({ id: typeof ln.id === 'string' && ln.id ? ln.id.slice(0, 16) : `L0-${i}`, amount: num(ln.amount, 0, 0, 1e9), owed: num(ln.owed, 0, 0, 1e9),
      takenAtPlayed: num(ln.takenAtPlayed, 0, 0, 1e13), termMin: num(ln.termMin, LOAN.term.maxMin, LOAN.term.minMin, LOAN.term.maxMin), late: ln.late === true, regionId: typeof ln.regionId === 'string' ? ln.regionId : null }));
  const old = obj(s.loan);
  if (!Array.isArray(s.loans) && old && Number.isFinite(old.owed) && old.owed > 0) {
    const amount = num(old.amount, 0, 0, 1e9), owed = num(old.owed, 0, 0, 1e9);
    const pay = Math.min(owed, Math.max(0, owed - Math.round(amount * 1.1))); // what is above the packs' own debt (10 % fee in those saves) = follower pay
    if (amount <= 0) wages.follower += owed;
    else {
      if (pay > 0) wages.follower += pay;
      const game = out.world.regions[out.world.currentRegion]?.mode || out.mode;
      const left = Math.round((owed - pay) * 100) / 100;
      loans = [{ id: 'L0', amount, owed: left, takenAtPlayed: 0, termMin: loanTermMin(left, incomeRef(game, level)), late: false }];
    }
  }
  out.loans = loans; // no cap on open loans
  delete out.loan;
  // Arrears belong to someone: none without a GM / a follower on the team (they left, the debt left with them).
  if (!out.gm?.unit) wages.gm = 0;
  if (!out.staff.units.some(u => u.follower)) wages.follower = 0;
  out.debt = { wages: { gm: Math.round(wages.gm * 100) / 100, follower: Math.round(wages.follower * 100) / 100 } };
}
// ---------- history & inbox (management-rules §7.3) ----------
const HIST_ACTORS = new Set(['player', 'g1', 'system']);
const histRowOk = r => obj(r) && typeof r.type === 'string' && Number.isFinite(r.at);
// One history row, known fields only.
function histRowOf(r, i = 0) {
  const o = { id: typeof r.id === 'string' && r.id ? r.id.slice(0, 16) : `hm${i}`, atPlayed: num(r.atPlayed, 0, 0, 1e13), at: r.at,
    actor: typeof r.actor === 'string' && r.actor ? r.actor.slice(0, 16) : 'system', group: HISTORY.groupOrder.includes(r.group) ? r.group : HISTORY.groups[r.type] || 'event',
    type: r.type.slice(0, 24), zone: r.zone === 'farm' || r.zone === 'shop' ? r.zone : null, regionId: typeof r.regionId === 'string' ? r.regionId : null };
  if (typeof r.subject === 'string' && r.subject) o.subject = r.subject.slice(0, 16);
  for (const k of ['cost', 'gain']) if (Number.isFinite(r[k])) o[k] = r[k];
  if (typeof r.taskId === 'string') o.taskId = r.taskId;
  if (typeof r.name === 'string') o.name = r.name.slice(0, 20);
  if (r.gm === 1) o.gm = 1;
  if (r.extra !== undefined) o.extra = r.extra;
  return o;
}
// s.history. Saves from before it: the team journal, every unit's timeline (u.log) and the manager's log become rows
// (oldest first; unit rows by the unit or about it, manager rows by 'g1'), u.recent = the unit's last HISTORY.perUnit.
// Idempotent: once s.history exists the old arrays are only dropped.
function normalizeHistory(out, s, now) {
  const h = obj(s.history);
  const rawUnits = new Map((Array.isArray(s.staff?.units) ? s.staff.units : []).filter(obj).map(u => [u.uid, u]));
  if (h) {
    const rows = (Array.isArray(h.rows) ? h.rows : []).filter(histRowOk).filter(r => !namesRemoved(r.extra)).map(histRowOf).slice(-HISTORY.rows);
    const days = (Array.isArray(h.days) ? h.days : []).filter(r => obj(r) && Number.isInteger(r.d) && typeof r.actor === 'string')
      .map(r => ({ d: r.d, actor: r.actor.slice(0, 16), ...Object.fromEntries(['jobs', 'earned', 'spent', 'mistakes', 'tasksDone', 'tasksExpired'].map(k => [k, num(r[k], 0, 0)])) }))
      .sort((a, b) => a.d - b.d);
    const keepD = [...new Set(days.map(r => r.d))].slice(-HISTORY.days);
    const tomb = (Array.isArray(h.tombstones) ? h.tombstones : []).filter(t => obj(t) && typeof t.uid === 'string')
      .map(t => ({ uid: t.uid.slice(0, 16), name: typeof t.name === 'string' ? t.name.slice(0, 20) : null, kind: ['worker', 'robot', 'manager'].includes(t.kind) ? t.kind : 'worker', leftAt: num(t.leftAt, 0, 0) }))
      .slice(-HISTORY.tombstones);
    const maxSeq = rows.reduce((n, r) => Math.max(n, parseInt(r.id.replace(/\D+/g, ''), 10) || 0), 0);
    out.history = { rows, days: days.filter(r => keepD.includes(r.d)), tombstones: tomb, seq: Math.max(num(h.seq, 0, 0, 1e12) | 0, maxSeq) };
    for (const u of out.staff.units) delete u.log;
    return;
  }
  const rows = [], seen = new Set();
  const push = (e, actor, subject, name, gm) => {
    const k = `${e.at}|${e.type}|${subject || actor}`;
    if (seen.has(k)) return;
    seen.add(k);
    const u = subject && subject !== 'g1' ? out.staff.units.find(x => x.uid === subject) : null;
    const r = { id: '', atPlayed: 0, at: e.at, actor, group: HISTORY.groups[e.type] || 'event', type: String(e.type).slice(0, 24), zone: u ? STAFF[u.type].zone : null, regionId: null };
    if (subject) r.subject = subject;
    if (name) r.name = String(name).slice(0, 20);
    if (gm) r.gm = 1;
    if (e.extra !== undefined) r.extra = e.extra;
    rows.push(r);
  };
  const ok = e => obj(e) && typeof e.type === 'string' && Number.isFinite(e.at);
  for (const e of (Array.isArray(s.staff?.journal) ? s.staff.journal : []).filter(ok)) push(e, typeof e.uid === 'string' ? e.uid : 'player', typeof e.uid === 'string' ? e.uid : null, e.name, false);
  for (const u of out.staff.units) for (const e of (Array.isArray(rawUnits.get(u.uid)?.log) ? rawUnits.get(u.uid).log : []).filter(ok)) push(e, u.uid, u.uid, u.name, false);
  if (out.gm.unit) for (const e of (Array.isArray(s.gm?.log) ? s.gm.log : []).filter(ok)) push(e, HIST_ACTORS.has(e.actor) ? e.actor : 'g1', null, null, true);
  rows.sort((a, b) => a.at - b.at);
  rows.forEach((r, i) => { r.id = `h${i + 1}`; });
  out.history = { rows: rows.slice(-HISTORY.rows), days: [], tombstones: [], seq: rows.length };
  for (const u of out.staff.units) {
    u.recent = rows.filter(r => r.subject === u.uid).slice(-HISTORY.perUnit).map(r => ({ ...r }));
    delete u.log;
  }
  if (out.gm.unit) out.gm.unit.recent = rows.filter(r => r.gm).slice(-HISTORY.perUnit).map(r => ({ ...r }));
  void now;
}
// One open task, known fields only (null when broken).
function taskOf(t, units, hasGm, open = true) {
  if (!obj(t) || typeof t.id !== 'string' || !Object.hasOwn(TASKS.life, t.kind) || !obj(t.act) || typeof t.act.type !== 'string' || !Number.isFinite(t.untilPlayed)) return null;
  if (open && t.kind === 'poach' && !units.some(u => u.uid === t.act.payload?.uid)) return null; // an open offer needs its worker
  if (open && (t.by === 'g1' || t.kind === 'gmPoach') && !hasGm) return null;
  return { id: t.id.slice(0, 16), kind: t.kind, key: typeof t.key === 'string' ? t.key.slice(0, 64) : t.id, group: typeof t.group === 'string' ? t.group : TASKS.groupOf[t.kind] || 'hr',
    by: t.by === 'system' ? 'system' : 'g1', act: { type: t.act.type, payload: obj(t.act.payload) ? { ...t.act.payload } : {} }, cost: num(t.cost, 0, 0, 1e9), value: num(t.value, 0, -1e9, 1e9),
    reason: Array.isArray(t.reason) ? t.reason : [String(t.reason || 'unknown')], zone: t.zone === 'farm' || t.zone === 'shop' ? t.zone : null,
    atPlayed: num(t.atPlayed, 0, 0, 1e13), untilPlayed: num(t.untilPlayed, 0, 0, 1e13), remindedAt: (Array.isArray(t.remindedAt) ? t.remindedAt : []).filter(Number.isFinite).slice(0, 4),
    status: typeof t.status === 'string' ? t.status : 'open', ...(Number.isFinite(t.answeredAtPlayed) ? { answeredAtPlayed: t.answeredAtPlayed } : {}), ...(Number.isFinite(t.fine) ? { fine: t.fine } : {}),
    ...(typeof t.regionId === 'string' ? { regionId: t.regionId.slice(0, 32) } : {}), ...(t.lateOff === true ? { lateOff: true } : {}) };
}
// s.tasks. Saves from before the inbox: the manager's requests, the rival's offer on a worker and on the manager become
// open tasks; their real-time deadlines turn into played time (time left kept). Idempotent: the old fields are dropped.
function normalizeTasks(out, s, now, gone) {
  const t = obj(s.tasks), units = out.staff.units, hasGm = !!out.gm.unit, P = out.clock.played;
  const res = newTasks();
  if (t) {
    res.open = (Array.isArray(t.open) ? t.open : []).filter(x => !staleAct(x, gone)).map(x => taskOf(x, units, hasGm)).filter(Boolean).map(x => ({ ...x, status: 'open' })).slice(0, TASKS.cap);
    res.done = (Array.isArray(t.done) ? t.done : []).filter(x => !staleAct(x, gone)).map(x => taskOf(obj(x) ? { ...x, untilPlayed: Number.isFinite(x.untilPlayed) ? x.untilPlayed : 0 } : null, units, true, false)).filter(Boolean).slice(0, TASKS.doneKeep);
    res.cool = Object.fromEntries(Object.entries(obj(t.cool) || {}).filter(([, v]) => Number.isFinite(v) && v > P).slice(0, 100));
    res.fines = (Array.isArray(t.fines) ? t.fines : []).filter(f => obj(f) && Number.isFinite(f.p) && Number.isFinite(f.c) && f.p > P - PENALTY.windowMin * 60000).map(f => ({ p: f.p, c: f.c }));
    const pen = obj(t.pen);
    if (pen && Number.isInteger(pen.d)) res.pen = { d: pen.d, loyalty: num(pen.loyalty, 0, 0, 100), morale: Object.fromEntries(['farm', 'shop'].filter(z => Number.isFinite(obj(pen.morale)?.[z])).map(z => [z, pen.morale[z]])) };
  } else {
    const left = until => Math.max(0, num(until, now, 0) - now);
    const file = (kind, key, by, act, cost, reason, zone, until, lifeMs) => {
      if (res.open.length >= TASKS.cap) return;
      const l = Math.min(left(until), lifeMs);
      res.open.push({ id: `t0-${res.open.length}`, kind, key, group: TASKS.groupOf[kind] || 'hr', by, act, cost, value: 0, reason, zone, atPlayed: Math.max(0, P + l - lifeMs), untilPlayed: P + l, remindedAt: [P], status: 'open' });
    };
    const po = obj(s.staff?.poach), pu = po && units.find(u => u.uid === po.uid);
    if (pu && Number.isFinite(po.until)) file('poach', `keep:${pu.uid}`, 'system', { type: 'staff/keep', payload: { uid: pu.uid } }, num(po.fee, 0, 0, 1e6), ['keepWorker', { name: pu.name || null }], po.zone === 'shop' ? 'shop' : 'farm', po.until, TASKS.life.poach * 60000);
    const gp = obj(s.gm?.poach);
    if (hasGm && gp && Number.isFinite(gp.until)) file('gmPoach', 'keep:g1', 'system', { type: 'gm/keep', payload: {} }, num(gp.fee, 0, 0, 1e9), ['gmPoach', { name: out.gm.unit.name, rival: GM.poach.rival }], null, gp.until, TASKS.life.gmPoach * 60000);
    if (hasGm) for (const q of (Array.isArray(s.gm?.requests) ? s.gm.requests : [])) {
      if (!obj(q) || typeof q.id !== 'string' || !obj(q.act) || typeof q.act.type !== 'string' || !Number.isFinite(q.until)) continue;
      const kind = TASKS.kindOf[q.act.type] || 'staffGrowth';
      file(kind, typeof q.key === 'string' ? q.key : q.id, 'g1', { type: q.act.type, payload: obj(q.act.payload) ? { ...q.act.payload } : {} }, num(q.cost, 0, 0, 1e9), Array.isArray(q.reason) ? q.reason : [String(q.reason || 'unknown')], null, q.until, TASKS.life[kind] * 60000);
    }
  }
  out.tasks = res;
}
// Saves from before the team day rows: rebuild them from the units' own day rows (units that already left are lost).
function backfillDaily(units) {
  const days = new Map();
  for (const u of units) {
    const zone = STAFF[u.type].zone, robot = STAFF[u.type].kind === 'robot';
    for (const r of u.days || []) {
      const day = days.get(r.d) || { d: r.d, earned: 0, spent: 0 };
      const z = (day[zone] ||= { earned: 0, spent: 0 });
      const runCost = Math.max(0, (r.spent || 0) - (r.capex || 0) - (r.upkeep || 0));
      for (const o of [day, z]) {
        o.earned += r.earned || 0; o.spent += r.spent || 0;
        if (r.capex) o.upgrade = (o.upgrade || 0) + r.capex;
        if (r.upkeep) o.upkeep = (o.upkeep || 0) + r.upkeep;
        if (robot && runCost) o.robot = (o.robot || 0) + runCost;
      }
      days.set(r.d, day);
    }
  }
  return [...days.values()];
}
// Personnel file (docs/design/staff-profile.md): units hired before it get a stable age / hometown / serial from their
// uid and their hire date from their book; day rows and the timeline are validated and trimmed.
function normalizeProfile(u, now) {
  u.hiredAt = num(u.hiredAt, u.book.since, 0);
  if (STAFF[u.type].kind === 'robot') {
    if (typeof u.serial !== 'string' || !u.serial) u.serial = robotSerial(u.type, u.uid);
    delete u.age; delete u.home; delete u.rank; delete u.craft; delete u.eligibleAt;
    u.software = Array.isArray(u.software) ? [...new Set(u.software.filter(p => SOFTWARE.packs[p]))] : [];
    u.softwareSpent = num(u.softwareSpent, 0, 0, 1e9);
    u.warrantyUsed = num(u.warrantyUsed, 0, 0, WARRANTY.repairs) | 0;
    delete u.gear; delete u.gearSpent;
  } else {
    // Hometowns used to be Vietnamese for everybody: anyone working abroad with one of those gets one of their own country.
    const country = String(u.assigned?.regionId || '').split('-')[0] || 'vn', p = profileOfUid(u.uid, country);
    if (country !== 'vn' && LEGACY_HOMES.has(u.home)) u.home = p.home;
    // No certificate yet (hired before they existed): examined today.
    const exam = obj(u.checkup);
    u.checkup = exam && Number.isFinite(exam.at) && Number.isFinite(exam.atTenure) && CHECKUP.grades.some(g => g[1] === exam.grade) ? { at: exam.at, atTenure: exam.atTenure, grade: exam.grade } : { at: now, atTenure: num(u.tenurePlayedMin, 0, 0), grade: checkupGrade(u) };
    u.hobbies = Array.isArray(u.hobbies) && u.hobbies.every(k => typeof k === 'string') ? u.hobbies.slice(0, 3) : p.hobbies;
    u.age = num(u.age, p.age, PROFILE.age[0], 99) | 0;
    u.home = typeof u.home === 'string' && u.home ? u.home.slice(0, 32) : p.home;
    delete u.rank; // no ranks any more: stats are what counts
    const c = obj(u.craft) || {};
    u.craft = Object.fromEntries((CRAFT.tasks[STAFF[u.type].zone] || []).filter(t => num(c[t], 0, 0) > 0).map(t => [t, num(c[t], 0, 0, 1e7) | 0]));
    delete u.eligibleAt;
    // Gear: tiers 0..maxTier of the zone's items.
    const g = obj(u.gear) || {};
    u.gear = Object.fromEntries((GEAR.zone[STAFF[u.type].zone] || []).filter(k => num(g[k], 0, 0) > 0).map(k => [k, num(g[k], 0, 0, GEAR.maxTier) | 0]));
    u.gearSpent = num(u.gearSpent, 0, 0, 1e9);
    delete u.software; delete u.softwareSpent; delete u.warrantyUsed;
  }
  const keys = ['jobs', 'earned', 'spent', 'capex', 'upkeep', 'mistakes', 'shift', 'work', 'down'];
  u.days = (Array.isArray(u.days) ? u.days : []).filter(r => obj(r) && Number.isInteger(r.d))
    .map(r => ({ d: r.d, ...Object.fromEntries(keys.map(k => [k, num(r[k], 0, 0)])) })).sort((a, b) => a.d - b.d).slice(-PROFILE.daysKeep);
  // u.log (the old timeline) is migrated into s.history / u.recent by normalizeHistory, then dropped.
  u.recent = (Array.isArray(u.recent) ? u.recent : []).filter(histRowOk).map(histRowOf).slice(-HISTORY.perUnit);
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
// Livestock, barns and the buyable vehicles were cut from the game (founder 2026-11-09). These ids are all that remains of them:
// saved buildings of these types drop out in normalizeRegion like any unknown id (no refund); here a manager request or a
// log line that names one goes too, because its text and action no longer exist.
const REMOVED_IDS = ['barn', 'chickenCoop', 'rooster', 'cow', 'goat', 'farmDog', 'motorbike', 'tillerCart', 'farmTruck', 'herder'];
const REMOVED_NAME = new RegExp(`"(?:${[...REMOVED_IDS, 'herdBuy'].join('|')})"`);
const namesRemoved = x => REMOVED_NAME.test(JSON.stringify(x) ?? '');
const staleAct = (x, gone) => gone.has(x?.act?.payload?.uid) || namesRemoved([x?.act?.payload?.type, x?.key, x?.reason]);
const removedUids = s => new Set([...Object.values(obj(s.world?.regions) || {}).flatMap(r => (Array.isArray(r?.buildings) ? r.buildings : [])), ...(Array.isArray(s.staff?.units) ? s.staff.units : [])]
  .filter(x => obj(x) && REMOVED_IDS.includes(x.type)).map(x => x.uid));
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

// Estates (land-ui-simplify §2A): owning any lot of an estate = owning the whole estate (old saves bought lot by lot);
// the home estate is always owned. Café lots pass through.
export function withEstates(parcels) {
  const set = new Set(parcels);
  for (const e of Object.values(ESTATES)) if (e.id === 'home' || e.lots.some(id => set.has(id))) for (const id of e.lots) set.add(id);
  return [...set];
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
    parcels: withEstates(Array.isArray(v.parcels) ? [...new Set(v.parcels.filter(id => typeof id === 'string' && Object.hasOwn(PARCELS, id)))] : []), // unknown lot ids dropped; estates completed
    roads: Array.isArray(v.roads) ? [...new Set(v.roads)] : [],
    buildings,
    fields,
    sized: v.sized ? 1 : settleSizes(buildings, fields, withEstates(Array.isArray(v.parcels) ? v.parcels : [])), // old saves: once, after the buildings grew
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
    && !seen.has(f.id) && seen.add(f.id)).map(f => ({ id: f.id, x: f.x, z: f.z, ...(Number.isFinite(f.spent) && f.spent > 0 ? { spent: Math.min(1e6, f.spent) } : {}), ...(Number.isInteger(f.row) && f.row >= 0 && f.row < 4 ? { row: f.row } : {}) }));
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

// The save is plain JSON data (it round-trips through localStorage), so a plain copy gives the same result about 5x faster than
// structuredClone, and every action goes through here.
export function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const copy = new Array(value.length);
    for (let i = 0; i < value.length; i++) copy[i] = clone(value[i]);
    return copy;
  }
  const copy = {};
  for (const key in value) copy[key] = clone(value[key]);
  return copy;
}
