// Economy simulation: drives the REAL reducer (src/core/game.js) with a scripted player.
// Usage: node scripts/economy-sim.mjs [minutes=60] [game=both|farm|cafe] [process=1|0] [persona=tapper|delegate|neglect]
//   prints the timeline (level ups, Level-10 reset, land, builds), per-5-minute income and a summary.
//        node scripts/economy-sim.mjs --gates [--runs N] [--gm-seeds N]   (exit code 1 when a gate FAILs)
//   runs the management-rules §7.4 sim gates (both games, every persona) and prints the GATES table.
// Importable: runSim(minutes, { game, process, tap, persona, seed, … }) → timeline + per-minute stats
// (tests/core/economy.test.mjs); runGates({ runs }) → { rows, results } (the GATES table).
//
// Player model (FARM-ECONOMY-BALANCE.md §5): one action every `tap` ms (walk + tap, 1.2 s default).
//  · game 'both' (default, the historical guard): the region's game is never picked, farm and café run together.
//  · game 'farm' / 'cafe': the approved one-game-per-region play (play/chooseGame), the other game's actions are refused.
// Every 15 s of play it first tries one investment (players shop between taps). Then each beat: café (serve > brew >
// take order) · collect a finished batch · harvest · plant · start the most
// downstream batch whose inputs are in stock · sell (finished goods; raw beans only when nothing can process them or the
// storehouse is ≥ 85 % full) · invest (land in order, then buildings, upgrades, hires) keeping a small reserve.
// Buildings are placed with the same placementError the ghost uses, scanning owned lots (never hard-coded spots).
// process: false = the same player but never builds processing (to measure what production adds).
// Every persona sends clock/tick (the played clock, CLOCK.tickSeconds) so s.income, I10 / I30, loans and tasks run.
//
// Personas (management-rules §7.4):
//  · 'tapper' (default, the historical guard above): staff are hired but the realm's team loop is not simulated.
//  · 'delegate': taps × 0.5 (tap 2.4 s), and the realm's team loop runs here: every unit on shift works
//    (GM.value.jobsPerMin × speed × state; farm harvest / plant, café serve / brew / take order, with uid), slacks /
//    runs flat (STAFF_BREAKS) / jams (jamChance) / overheats (staff/vitals), and the player reacts to a blocked or
//    tired / hungry unit after R = reactMin (1 min) with its quick fix (staff/care). Timers like the realm's:
//    staff/upkeep, staff/vitals, staff/workDone, rival/visit, staff/mvp, loan/tick, gm/think (its own cadence),
//    gm/payroll, gm/rivalVisit, gm/seen. Hires by the §3.7 rule (ready plots / waiting orders ≥ 3 for 2 checks, a
//    free slot, a robot only when contrib − running cost ≥ a worker's contrib), the GM at Lv6 (skill closest to 2,
//    operator), then the Hạt and Đất & xây licences (as the §4.4 worked session), and answers every inbox task after
//    answerMin × (0.5..1.5) played minutes (manager tasks: approve when affordable, a hire past maxUnits denied;
//    a rival: keep when affordable).
//  · 'neglect': the delegate who never answers a task for neglectMin (45) played minutes from the GM's hire in the
//    neglectRegion-th region (2 = after the Level-10 reset, so the 45 minutes are not cut by the wipe).
//  · gm: false → no manager; gm: 'sink' → the same coins as the GM fee + licences leave at the same moments but no
//    manager is hired (the control of the GM-value gate). loan: pack → that pack is borrowed the first time its
//    LOAN.packLevel is reached (the loan gate); stopAfterLoan ends the run once it is repaid or late.
import { pathToFileURL } from 'node:url';
import { apply } from '../src/core/game.js';
import { createSave } from '../src/core/state.js';
import * as D from '../src/core/derive.js';
import { BUILDINGS, STAFF, PLAYTEST, RECIPES, GM, LOAN, CLOCK, RIVAL, BOOKS, STAFF_BREAKS, STAFF_SIM, DRINKS, EXPIRY_LEVEL, UPGRADE_GATE, GEAR,
  slackMul, batteryMinutes, jamChance, incomeRef, unitSpeed, hasRule } from '../src/core/config/economy.js';
import { PARCEL_ORDER, PARCELS, areaOfParcel } from '../src/core/config/layout.js';

PLAYTEST.coins = 0; // the sim measures the balanced economy, not the founder's playtest coins

// Net worth (balance pass 2026-11-08): coins + what they were turned into, at cost — buildings (price + upgrades paid),
// owned lots, every unit's hire price + parts / software / gear + stat steps (100·n each). Licences and the manager's
// fee are not assets (the 'sink' control loses the same coins), so neither side gets credit for them.
// A player who reinvests everything keeps few coins; the manager's value is the worth he adds, not the cash left.
const builtValue = b => { const def = BUILDINGS[b.type]; if (!def) return 0; return def.cost + (def.upgrade || []).slice(0, Math.max(0, (b.level | 0) - 1)).reduce((a, c) => a + c, 0); };
const statValue = u => Object.values(u.stats || {}).reduce((n, v) => n + 50 * Math.max(0, (v | 0) - 1) * (v | 0), 0); // Σ 100·n for n = 1..v−1
export function netWorth(s) {
  let w = s.player.coins - D.loanTotal(s);
  for (const r of Object.values(s.world.regions || {})) {
    for (const b of r.buildings || []) w += builtValue(b);
    for (const id of r.parcels || []) w += PARCELS[id]?.cost || 0;
  }
  for (const u of s.staff.units) w += (u.paid || 0) + (u.partsSpent || 0) + (u.softwareSpent || 0) + (u.gearSpent || 0) + statValue(u);
  return w;
}

const LOGGED = ['levelUp', 'expiryTriggered', 'parcelBought', 'built', 'regionExpired', 'regionEntered', 'fieldPlaced', 'gmHired', 'licenceBought', 'loanTaken', 'loanLate', 'loanRepaid', 'gmLeft', 'gmQuit'];
const CAFE_BUILD = ['roaster', 'tables', 'kiosk', 'pastry'];
const STAGES = ['pack', 'roast', 'dry']; // most downstream first: finish goods before starting new ones
// Care kinds that are mandatory running costs (management-rules §2.0): slack fees, recharges, cooling, repairs, service.
// Coffee / food / bonus are the optional care column.
const MANDATORY_CARE = new Set(['bonusSmall', 'nag', 'recharge', 'cool', 'knock', 'repair', 'service']);
const LICENCES = ['beans', 'land']; // the §4.4 worked session: Hạt + Đất & xây
const HIRE_ACTS = new Set(['staff/recruit', 'staff/hire']);
const r2 = n => Math.round(n * 100) / 100;
// Seconds one job takes in the realm loop (realm/staff.js): the job search (THINK .35 s) + the walk (WALK_M metres at
// STAFF_SIM.speed) + STAFF_SIM.work / unitSpeed (deliver: STAFF_SIM.deliverSeconds); a worker without the 'quick'
// smart rule stands 1.2 s after planting. jobRate 'ref' uses the planner's GM.value.jobsPerMin instead.
const WALK_M = { harvest: 3, plant: 1, water: 3, order: 1.5, brew: 1.5, deliver: 8 };
const realmJobSec = (u, task) => {
  const robot = STAFF[u.type]?.kind === 'robot';
  const walk = (WALK_M[task] ?? 3) / (STAFF_SIM.speed[robot ? 'robot' : 'worker'] * (u.type === 'brewBot' ? STAFF_SIM.brewBotWalkMul : 1));
  const work = (task === 'deliver' ? STAFF_SIM.deliverSeconds : STAFF_SIM.work[u.type] || 1) / unitSpeed(u);
  return 0.35 + walk + work + (!robot && task === 'plant' && !hasRule(u, 'quick') ? 1.2 : 0);
};
const mkRng = seed => { let x = (Math.abs(seed | 0) % 2147483646) + 1; return () => (x = (x * 16807) % 2147483647) / 2147483647; };

/**
 * @param {number} minutes simulated minutes
 * @param {{game?: 'both'|'farm'|'cafe', process?: boolean, tap?: number, persona?: 'tapper'|'delegate'|'neglect', jobRate?: 'realm'|'ref',
 *   seed?: number, maxUnits?: number, gm?: boolean|'sink', loan?: number|null, stopAfterLoan?: boolean, reactMin?: number,
 *   answerMin?: number, neglectMin?: number, neglectRegion?: number, teamSize?: number, teamRobots?: boolean, manualRepay?: boolean}} [opts]
 */
export function runSim(minutes = 60, { game = 'both', process = true, tap, persona = 'tapper', seed: seed0 = 1, maxUnits = Infinity,
  gm: useGm, loan = null, stopAfterLoan = false, reactMin = 1, answerMin = 2, neglectMin = 45, neglectRegion = 2, jobRate = 'realm', teamSize = 0, teamRobots = false, manualRepay = true } = {}) {
  const managed = persona !== 'tapper';
  tap ??= managed ? 2400 : 1200; // the delegate taps half as often
  useGm ??= managed;
  let now = 1_800_000_000_000;
  let s = createSave(now, { gender: 'female', name: 'Sim' });
  const log = [];
  const failures = {};
  const coinDelta = {};   // action type → net coin change from successful actions
  const income = {};      // income source → coins (served, beansSold, goodsSold by good)
  const counts = {};      // action type → successful count
  const bugs = [];        // NaN coins, a reducer that threw, …
  const spans = {};       // `${regionNo}:${level}` → { ms, earned, mandatory, optional, gm, fines, poach, units, gmMs } (time at that level)
  const care = {};        // care kind → coins
  const gmStats = { acts: 0, filed: 0, approvedOk: 0, approvedFailedEvent: 0, hires: [], fines: [] };
  const fines = [];       // [playedMs, coins]
  const answers = { approved: 0, denied: 0, failed: 0 };
  let minCoins = s.player.coins;
  let lastEvents = [];
  const start = now;
  const P = () => D.playedMs(s);
  const span = (L = D.level(s)) => (spans[`${regionNo}:${L}`] ||= { ms: 0, earned: 0, mandatory: 0, optional: 0, gm: 0, fines: 0, poach: 0, units: 0, gmMs: 0 });
  const runCost = () => Object.values(spans).reduce((n, x) => n + x.mandatory + x.optional + x.gm + x.fines + x.poach, 0);
  const act = (type, payload = {}) => {
    let r;
    const sp = span(), earned0 = s.stats.earned;
    try { r = apply(s, { type, payload }, { now, dev: false }); } catch (err) { bugs.push({ type, error: String(err?.stack || err).split('\n').slice(0, 3).join(' | '), at: (now - start) / 60000 }); return false; }
    if (r.ok && !r.noop) {
      coinDelta[type] = Math.round(((coinDelta[type] || 0) + r.state.player.coins - s.player.coins) * 100) / 100;
      counts[type] = (counts[type] || 0) + 1;
      s = r.state;
      lastEvents = r.events;
      if (!Number.isFinite(s.player.coins)) bugs.push({ type, error: `coins ${s.player.coins}`, at: (now - start) / 60000 });
      minCoins = Math.min(minCoins, s.player.coins);
      if (s.stats.earned > earned0) sp.earned += s.stats.earned - earned0;
      for (const e of r.events) {
        if (LOGGED.includes(e.type)) log.push([now, e, D.playedMs(r.state)]); // [wall ms, event, played ms]
        if (e.type === 'served') income.served = (income.served || 0) + e.coins;
        if (e.type === 'goodsSold') for (const p of e.parts) income[p.good] = (income[p.good] || 0) + p.coins;
        if (e.type === 'staffCared' && e.cost > 0) { (MANDATORY_CARE.has(e.kind) ? (sp.mandatory += e.cost) : (sp.optional += e.cost)); care[e.kind] = r2((care[e.kind] || 0) + e.cost); }
        if (e.type === 'staffResumed' && type === 'staff/resume') sp.mandatory += e.fee || 0;
        if (e.type === 'upkeepPaid') sp.mandatory += e.coins || 0;
        if (e.type === 'gmPaid') sp.gm += e.coins || 0;
        if (e.type === 'arrearsPaid') { if (e.who === 'gm') sp.gm += e.coins || 0; else sp.mandatory += e.coins || 0; }
        if (e.type === 'poachKept') sp.poach += e.fee || 0;
        if (e.type === 'taskExpired' && e.fine > 0) { sp.fines += e.fine; fines.push([P(), e.fine]); }
        if (e.type === 'gmActed') { gmStats.acts++; gmStats.byKey ||= {}; const k = String(e.key).split(':')[0]; gmStats.byKey[k] = (gmStats.byKey[k] || 0) + 1; }
        if (e.type === 'taskFiled' && e.by === 'g1') gmStats.filed++;
        if (e.type === 'gmHired') gmStats.hires.push({ played: P(), region: regionNo, level: D.level(s) });
      }
    } else if (!r.ok) failures[`${type}:${r.error}`] = (failures[`${type}:${r.error}`] || 0) + 1;
    return r.ok && !r.noop && !r.duplicate;
  };
  // Coins leave the save without an action (the gm: 'sink' control): same moment, same amount as the real purchase.
  const sink = coins => { s = { ...s, player: { ...s.player, coins: r2(s.player.coins - coins) } }; minCoins = Math.min(minCoins, s.player.coins); };
  let regionNo = 0;
  const enter = regionId => {
    act('world/unlockRegion', { regionId });
    act('world/enterRegion', { regionId });
    if (game !== 'both') act('play/chooseGame', { game });
    regionNo++;
  };
  act('story/introDone'); act('story/teacherDone');
  enter(game === 'cafe' ? 'fr-1' : 'vn-1');
  const playsFarm = game !== 'cafe', playsCafe = game !== 'farm';
  let nextCustomer = now, nextInvest = now + 15000, lastMinute = 0, earnedAtLastMinute = s.stats.earned;
  const perMinute = [];
  let seed = seed0; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // customers (seed 1 = the historical run)
  const roll = mkRng(seed0 * 7919 + 13); // the team's own dice (slack, jams, rivals, the manager's think)

  // First free spot for `type` in the owned lots of its area (same validity as the placement ghost).
  function spot(type) {
    const def = D.defOf(type);
    const area = def.zone === 'shop' ? 'cafe' : 'farm';
    for (const id of D.region(s).parcels) {
      if (areaOfParcel(id) !== area && def.zone !== 'any') continue;
      const [x0, z0, x1, z1] = PARCELS[id].rect;
      for (let z = z0; z <= z1; z += .5) for (let x = x0; x <= x1; x += .5) {
        const q = D.snapPosition(type, x, z, 0);
        if (D.placementError(s, type, q.x, q.z, 0) === null) return q;
      }
    }
    return null;
  }
  const build = type => { if (D.buildError(s, type)) return false; const q = spot(type); return !!q && act('build/place', { type, ...q }); };
  const reserve = () => 10 + 3 * D.ownedPlots(s).length; // enough to replant every field
  // The next workshop of the chain the player saves for (unlocked, not built yet), or null.
  // Land first while it is the cheaper way to grow; once the next field lot costs more than the workshop, save for it.
  const nextLand = () => PARCEL_ORDER.map(id => PARCELS[id]).find(p => areaOfParcel(p.id) === 'farm' && p.kind === 'farm' && !D.region(s).parcels.includes(p.id)) || null;
  const goal = () => {
    if (!playsFarm || !process) return null;
    const t = ['dryer', 'roastery', 'packer'].find(x => D.countOf(s, x) === 0 && !['level', 'round', 'unknown', 'gameLocked'].includes(D.buildError(s, x)));
    return t && (!nextLand() || nextLand().cost >= D.buildCost(s, t)) ? t : null;
  };

  // ---------- the manager purchases (delegate): GM at Lv6, then the licences ----------
  const sunk = { gm: new Set(), lic: new Set() };
  const region0 = () => !!D.region(s) && s.story.phase === 'play';
  const hasGm = () => (useGm === 'sink' ? sunk.gm.has(regionNo) : !!D.gmOf(s));
  const hasLicence = g => (useGm === 'sink' ? sunk.lic.has(g) : D.gmLicensed(s, g));
  const boardPick = () => {
    const b = D.gmBoard(s).map((c, index) => ({ ...c, index }));
    return b.sort((a, c) => Math.abs(a.skill - 2) - Math.abs(c.skill - 2) || a.fee - c.fee)[0] || null;
  };
  // The next manager purchase the player saves for (coins), or 0.
  const gmGoal = () => {
    if (!useGm || !D.region(s) || D.level(s) < GM.unlockLevel) return 0;
    if (!hasGm()) return boardPick()?.fee || 0;
    if (goal()) return 0; // a workshop of the chain comes before the licences (a real player builds the dryer first)
    const g = LICENCES.find(x => !hasLicence(x));
    return g ? D.licencePrice(g) : 0;
  };
  function buyManager() {
    if (!useGm || D.level(s) < GM.unlockLevel) return false;
    if (!hasGm()) {
      const c = boardPick();
      if (!c || s.player.coins - c.fee < reserve()) return false;
      if (useGm === 'sink') { sink(c.fee); sunk.gm.add(regionNo); gmStats.hires.push({ played: P(), region: regionNo, level: D.level(s), sink: true }); return true; }
      return act('gm/hire', { index: c.index });
    }
    if (goal()) return false; // the processing chain first: the licences wait for the next workshop
    const g = LICENCES.find(x => !hasLicence(x));
    if (!g || s.player.coins - D.licencePrice(g) < reserve()) return false;
    if (useGm === 'sink') { sink(D.licencePrice(g)); sunk.lic.add(g); return true; }
    return act('gm/buyLicence', { group: g });
  }
  // land: the delegate's manager savings never hold back a field lot (land is the farm's limit), only upgrades / storage
  const canSpend = (cost, land = false) => s.player.coins - cost >= reserve() + (goal() ? D.buildCost(s, goal()) : 0) + (managed && !land ? gmGoal() : 0);
  // From Lv6 the delegate saves for the manager first (§7.4: "hires the GM at Lv6"): nothing else is bought meanwhile.
  // Measured 2026-11-08: the farm delegate earns ≈ 130/min at Lv5–6 and Lv6 lasts ≈ 2–3 played minutes, so the
  // 🪙800 skill-2 fee is only saved by Lv8–9 even with nothing else bought; starting the saving at Lv5 got the hire
  // to Lv7 but pushed Lv10 to 26.6 min (past the gate). The café delegate hires at Lv6. See management-rules §7.4.
  const savingForGm = () => managed && !!useGm && !hasGm() && region0() && D.level(s) >= GM.unlockLevel;
  function invest() {
    const r = D.region(s);
    // From Lv6 the manager comes first (§7.4: "hires the GM at Lv6"): while saving for his fee nothing else is bought,
    // not even land or the next workshop (before, the farm delegate kept buying lots / workshops and only hired the
    // GM at Lv11 of region 2). Below Lv6 the next workshop of the chain (dryer 🪙120 → roastery → packer) and the
    // land come first, the manager savings never hold them back.
    if (managed && buyManager()) return true;
    if (savingForGm()) return false;
    if (managed && playsFarm && process) {
      const g = goal();
      if (g && s.player.coins - D.buildCost(s, g) >= reserve() && build(g)) return true;
      const p = !g && nextLand();
      if (p && canSpend(p.cost, true) && act('land/buyParcel', { parcelId: p.id })) return true;
    }
    // Processing first once unlocked (one of each, then a 2nd drying yard when beans pile up), storage when it is tight.
    if (playsFarm && process) {
      const g = goal();
      if (g && s.player.coins - D.buildCost(s, g) >= reserve() && build(g)) return true;
      if (D.countOf(s, 'well') === 0 && s.player.coins - D.buildCost(s, 'well') >= 2 * reserve() && build('well')) return true;
      if (D.stored(s) >= D.capacity(s) * .8 && canSpend(D.buildCost(s, 'warehouse')) && build('warehouse')) return true;
      const idleBeans = s.inventory.beans >= RECIPES.dry.in.beans && D.buildingsOf(s, 'dryer').every(b => b.job);
      if (idleBeans && canSpend(D.buildCost(s, 'dryer')) && build('dryer')) return true;
      const idleDried = D.goodCount(s, 'dried') >= 2 * RECIPES.roast.in.dried && D.buildingsOf(s, 'roastery').every(b => b.job);
      if (idleDried && canSpend(D.buildCost(s, 'roastery')) && build('roastery')) return true;
    }
    if (playsCafe) for (const type of CAFE_BUILD) if (D.countOf(s, type) === 0 && s.player.coins - D.buildCost(s, type) >= 30 && build(type)) return true;
    if (playsFarm) for (const id of PARCEL_ORDER) {
      const p = PARCELS[id];
      if (areaOfParcel(id) !== 'farm' || r.parcels.includes(id) || p.kind !== 'farm') continue;
      if (canSpend(p.cost, true) && act('land/buyParcel', { parcelId: id })) return true;
      break; // land in order: wait for the next one
    }
    if (playsCafe) for (const id of ['C2', 'C3']) if (!r.parcels.includes(id) && s.player.coins - PARCELS[id].cost >= 30 && act('land/buyParcel', { parcelId: id })) return true;
    // Upgrades: workshops first (a bigger batch halves the taps per bean), then the cheapest.
    const list = [...r.buildings].filter(b => (playsFarm || BUILDINGS[b.type].zone !== 'farm') && (playsCafe || BUILDINGS[b.type].zone !== 'shop'))
      .sort((a, b) => (!!BUILDINGS[b.type].recipe - !!BUILDINGS[a.type].recipe) || (D.upgradeCost(a.type, a.level) ?? 1e12) - (D.upgradeCost(b.type, b.level) ?? 1e12));
    for (const b of list) { const c = D.upgradeCost(b.type, b.level); if (c != null && canSpend(c) && act('build/upgrade', { uid: b.uid })) return true; }
    if (managed) return false; // the delegate hires by the §3.7 rule (hireCheck), not "whenever coins allow"
    for (const t of ['farmhand', 'barista', 'sproutBot', 'brewBot']) {
      const zone = STAFF[t].zone;
      if ((zone === 'farm' && !playsFarm) || (zone === 'shop' && !playsCafe)) continue;
      if (D.freeSlots(s, zone) > 0 && canSpend(STAFF[t].cost) && act('staff/hire', { type: t })) return true;
    }
    return false;
  }
  function sell() {
    if (!playsFarm) return false;
    const has = type => D.countOf(s, type) > 0;
    const goods = { bag: true, roasted: !has('packer'), dried: !has('roastery') };
    for (const [good, ok] of Object.entries(goods)) if (ok && D.goodCount(s, good) > 0 && act('farm/sell', { good })) return true;
    const full = D.stored(s) >= D.capacity(s) * .85;
    // With a team harvesting all the time the store refills before a finished batch can be collected: a full store
    // with a batch waiting is cleared at once (the tapper below never gets there, its own taps leave room).
    if (managed && full && D.region(s).buildings.some(b => b.job && D.jobState(b, now).stage === 'ready') && act('farm/sellAll')) return true;
    // Raw beans: sold when nothing processes them, when storage is tight, or what the yards cannot take soon.
    const keep = has('dryer') && process ? RECIPES.dry.in.beans * Math.max(1, D.countOf(s, 'dryer')) : 0;
    if (s.inventory.beans > keep && (full || !has('dryer') || !process) && act('farm/sell', { good: 'beans', amount: s.inventory.beans - keep })) return true;
    if (full && act('farm/sellAll')) return true;
    return false;
  }

  // ---------- the team loop (managed personas): what realm/staff.js does in the browser ----------
  const zones = [...(playsFarm ? ['farm'] : []), ...(playsCafe ? ['shop'] : [])];
  const team = new Map(); // uid → { credit, work, rest, jobs, workT, vT, xpN, xpTask, probAt }
  const rates = {};       // unit type → { jobs, shiftSec } (jobs per minute on shift, measured)
  const here = () => (s.world.currentRegion ? D.assignedUnits(s, s.world.currentRegion) : []);
  const isRobot = u => STAFF[u.type]?.kind === 'robot';
  const may = (u, task) => { const t = D.unitTasks(u); return !t.length || t.includes(task); };
  function findJob(u) {
    const r = D.region(s);
    if (!r) return null;
    if (STAFF[u.type].zone === 'farm') {
      if (may(u, 'harvest') && D.stored(s) < D.capacity(s)) for (const p of D.ownedPlots(s)) if (r.plots[p.id] && D.plotState(s, p.id, now).stage === 'ready') return { type: 'farm/harvest', payload: { plotId: p.id, uid: u.uid }, task: 'harvest' };
      if (may(u, 'plant')) for (const p of D.ownedPlots(s)) {
        if (r.plots[p.id]) continue;
        const crop = D.planCropFor(s, p.id) || D.unlockedCrops(s).filter(c => D.seedCost(s, c) <= s.player.coins).pop();
        if (crop && D.seedCost(s, crop) <= s.player.coins) return { type: 'farm/plant', payload: { plotId: p.id, crop, uid: u.uid }, task: 'plant' };
        break;
      }
      return null;
    }
    const os = r.shop.orders;
    if (may(u, 'deliver')) { const o = os.find(x => x.stage === 'brewing' && now - x.brewStart >= x.brewMs); if (o) return { type: 'shop/serve', payload: { orderId: o.id, uid: u.uid }, task: 'deliver' }; }
    if (may(u, 'brew') && os.filter(x => x.stage === 'brewing').length < D.brewSlots(s)) {
      const o = os.find(x => x.stage === 'taken' && D.canBrew(u, x.drink) && s.inventory.beans >= DRINKS[x.drink].beans);
      if (o) return { type: 'shop/brew', payload: { orderId: o.id, uid: u.uid }, task: 'brew' };
    }
    if (may(u, 'order') && D.seatsUsed(s) < D.seatCount(s)) { const o = os.find(x => x.stage === 'waiting'); if (o) return { type: 'shop/takeOrder', payload: { orderId: o.id, uid: u.uid }, task: 'order' }; }
    return null;
  }
  const flushXp = e => { if (e.xpN) { const n = e.xpN; e.xpN = 0; act('staff/workDone', { uid: e.uid, n, task: e.xpTask }); } };
  function teamStep(dt) {
    for (const u0 of here()) {
      const e = team.get(u0.uid) || { uid: u0.uid, credit: 0, work: 0, rest: 0, jobs: 0, workT: 0, vT: roll() * 10, xpN: 0, xpTask: null, probAt: null };
      team.set(u0.uid, e);
      let u = D.unitOf(s, u0.uid);
      if (!u) continue;
      const job = u.active && D.unitWorking(u, now) ? findJob(u) : null;
      const rt = (rates[u.type] ||= { jobs: 0, shiftSec: 0, workSec: 0 });
      if (u.active) rt.shiftSec += dt;
      if (job) {
        e.work += dt;
        rt.workSec += dt; // seconds with a job in hand: the gate's rate (idle on-shift time is demand, already in throughputShare)
        if (isRobot(u)) {
          if ((e.workT += dt) >= batteryMinutes(u) * 60) { e.workT = 0; act('staff/stop', { uid: u.uid }); continue; }
        } else if (roll() < STAFF_BREAKS.worker.slackChancePerMinute * slackMul(u) * D.chaosSlackMul(s, STAFF[u.type].zone) * dt / 60) { act('staff/stop', { uid: u.uid }); continue; }
        e.credit += dt * D.stateSpeedMul(u, now) * (jobRate === 'ref' ? D.jobsPerMin(u) / 60 : 1 / realmJobSec(u, job.task));
        if (e.credit >= 1) {
          e.credit -= 1;
          if (act(job.type, job.payload)) {
            if (e.xpTask && e.xpTask !== job.task) flushXp(e);
            e.xpTask = job.task; e.xpN++; e.jobs++;
            if (STAFF[u.type].zone !== 'farm' || job.task === 'harvest') rt.jobs++; // in the planner's job unit: farm perJob = one harvest (plant / water are part of it), café = a third of a cup
            if (e.xpN >= 3) flushXp(e);
            u = D.unitOf(s, u0.uid);
            if (u && isRobot(u) && roll() < jamChance(u)) act('staff/jam', { uid: u.uid });
          }
        }
      } else { e.rest += dt; e.credit = Math.min(e.credit, .5); }
      if ((e.vT += dt) >= 10) {
        const rnd1 = n => Math.round(n * 10) / 10;
        act('staff/vitals', { uid: u0.uid, work: rnd1(e.work), rest: rnd1(e.rest), jobs: isRobot(u0) ? e.jobs : 0 });
        e.vT = 0; e.work = 0; e.rest = 0; e.jobs = 0;
      }
    }
  }
  // The player's own reaction (R = reactMin): a blocked, tired or hungry unit gets its quick fix once it waited R.
  function react() {
    for (const u of here()) {
      const e = team.get(u.uid);
      if (!e) continue;
      const n = D.needs(u);
      const fix = u.active && (D.unitBlocked(u, now) || n.tired || n.hungry) ? D.quickFix(u, now) : null;
      if (!fix) { e.probAt = null; continue; }
      e.probAt ??= now;
      if (now - e.probAt < reactMin * 60000) continue;
      if (!D.careError(s, u, fix.kind, now) && act('staff/care', { uid: u.uid, kind: fix.kind, roll: roll() })) e.probAt = null;
    }
  }
  // §3.7 hire rule (checked every 15 s): ready plots / waiting orders ≥ 3 on two checks in a row and a free slot.
  const streak = { farm: 0, shop: 0 };
  const fakeUnit = type => ({ uid: `sim-${type}`, type, stats: {}, parts: {}, software: [], active: true });
  function hireCheck() {
    const r = D.region(s);
    if (!r) return;
    for (const zone of zones) {
      // ripe plots count only while the storehouse has room (a full store is a selling problem, not a labour one)
      const backlog = zone === 'farm' ? (D.stored(s) < D.capacity(s) ? D.ownedPlots(s).filter(p => r.plots[p.id] && D.plotState(s, p.id, now).stage === 'ready').length : 0)
        : r.shop.orders.filter(o => o.stage === 'waiting').length;
      streak[zone] = backlog >= 3 ? streak[zone] + 1 : 0;
      // teamSize: the GM-value experiment keeps the team at exactly N workers (hired first, before any saving)
      if (teamSize > 0) {
        const wT = teamRobots && !D.staffError(s, zone === 'farm' ? 'sproutBot' : 'brewBot') ? (zone === 'farm' ? 'sproutBot' : 'brewBot') : zone === 'farm' ? 'farmhand' : 'barista';
        if (D.zoneUnits(s, zone).length < teamSize && D.freeSlots(s, zone) > 0 && !D.staffError(s, wT) && s.player.coins - D.hireCost(s, wT) >= reserve()) act('staff/hire', { type: wT });
        continue;
      }
      if (streak[zone] < 2 || savingForGm() || D.freeSlots(s, zone) <= 0 || D.zoneUnits(s, zone).length >= maxUnits) continue;
      const [wT, rT] = zone === 'farm' ? ['farmhand', 'sproutBot'] : ['barista', 'brewBot'];
      const rb = fakeUnit(rT), wk = fakeUnit(wT);
      const robotPays = D.contrib(s, rb) - D.runCostPerMin(rb) >= D.contrib(s, wk);
      // a labour backlog comes before the savings goals (workshop, manager): only the replant reserve is kept
      const affords = t => s.player.coins - D.hireCost(s, t) >= reserve();
      const type = robotPays && !D.staffError(s, rT) && affords(rT) ? rT : wT;
      if (!D.staffError(s, type) && affords(type) && act('staff/hire', { type })) streak[zone] = 0;
    }
  }
  // The inbox (§4.2): every open task is answered answerMin × (0.5..1.5) played minutes after it appears.
  const due = new Map();
  let neglectFrom = null;
  const neglecting = () => persona === 'neglect' && neglectFrom != null && P() < neglectFrom + neglectMin * 60000;
  function answer() {
    if (neglecting()) return;
    for (const t of [...D.tasksOpen(s)]) {
      if (!due.has(t.id)) { due.set(t.id, P() + answerMin * (0.5 + roll()) * 60000); continue; }
      if (P() < due.get(t.id)) continue;
      let type = 'task/approve', payload = { id: t.id, roll: roll() };
      if (t.kind === 'poach') { if (s.player.coins < t.cost + reserve()) type = 'task/deny'; }
      else if (t.kind === 'gmPoach') { if (s.player.coins < t.cost) payload.how = 'raise'; }
      else if (t.by === 'g1') {
        const zone = t.act?.payload?.zone || (t.act?.payload?.type && STAFF[t.act.payload.type]?.zone);
        if (HIRE_ACTS.has(t.act?.type) && zone && D.zoneUnits(s, zone).length >= Math.min(maxUnits, teamSize || Infinity)) type = 'task/deny';
        else if ((t.cost || 0) > s.player.coins) type = 'task/deny';
      }
      if (act(type, payload)) {
        const ans = lastEvents.find(e => e.type === 'taskAnswered');
        if (type === 'task/deny') answers.denied++;
        else if (ans && ans.ok === false) answers.failed++;
        else answers.approved++;
        if (ans?.ok && t.by === 'g1') {
          gmStats.approvedOk++;
          if (lastEvents.some(e => e.type === 'gmFailed')) { gmStats.approvedFailedEvent++; (gmStats.failedKinds ||= {})[t.act?.type] = ((gmStats.failedKinds ||= {})[t.act?.type] || 0) + 1; }
        }
      }
      due.delete(t.id);
    }
  }
  // Realm timers (seconds of play), only while playing.
  const T = { clock: 0, loan: 0, upkeep: 0, rival: { farm: 0, shop: 0 }, mvp: 0, gmThink: 0, gmPay: 0, gmRival: 0, seen: 0, hire: 0, react: 0 };
  function timers(ms) {
    if (s.story.phase !== 'play' || !s.world.currentRegion) return;
    if ((T.clock += ms) >= CLOCK.tickSeconds * 1000) { const d = T.clock; T.clock = 0; act('clock/tick', { ms: d }); }
    if (!managed) return;
    const dt = ms / 1000;
    if ((T.loan += dt) >= CLOCK.loanTickSeconds) {
      T.loan = 0;
      if (D.loansOf(s).length) {
        // the player watches the loan countdown: in its last 10 played minutes he pays what he can above the replant
        // reserve (a real player does not let a 🪙50 remainder go late for +5 %)
        const ln = D.loansOf(s).find(x => !x.late && x.owed > 0 && P() >= x.takenAtPlayed + (x.termMin - 10) * 60000);
        const room = Math.floor(s.player.coins - reserve());
        if (manualRepay && ln && room > 0) { if (loanRec && !loanRec.manual) loanRec.manual = true; act('loan/repay', { amount: Math.min(room, Math.ceil(D.loanTotal(s))) }); }
        act('loan/tick');
      }
    }
    teamStep(dt);
    if ((T.react += dt) >= 1) { T.react = 0; react(); }
    if ((T.hire += dt) >= 15) { T.hire = 0; hireCheck(); }
    if (s.staff.units.length && ((T.upkeep += dt) >= 60 || !s.staff.upkeepAt)) { T.upkeep = 0; act('staff/upkeep'); }
    for (const zone of zones) {
      if (!here().some(u => STAFF[u.type].zone === zone && !isRobot(u))) { T.rival[zone] = 0; continue; }
      if ((T.rival[zone] += dt) < RIVAL.everyMinutes * 60) continue;
      T.rival[zone] = 0;
      if (!D.workerPoach(s)) act('rival/visit', { zone, roll: roll() });
    }
    if ((T.mvp += dt) >= BOOKS.mvpMinutes * 60) { T.mvp = 0; act('staff/mvp'); }
    const g = D.gmOf(s);
    if (g) {
      if ((T.gmThink += dt) >= D.gmThinkSeconds(g)) { T.gmThink = 0; act('gm/think', { roll: roll() }); }
      if ((T.gmPay += dt) >= 60 || !s.gm.payAt) { T.gmPay = 0; act('gm/payroll'); }
      if ((T.gmRival += dt) >= GM.poach.everyMinutes * 60) { T.gmRival = 0; act('gm/rivalVisit', { roll: roll() }); }
      if ((T.seen += dt) >= 60) { T.seen = 0; act('gm/seen'); }
      if (persona === 'neglect' && neglectFrom == null && regionNo >= neglectRegion) neglectFrom = P();
    } else T.gmThink = T.gmPay = T.gmRival = 0;
    answer();
  }

  // ---------- gates bookkeeping ----------
  const paybacks = {}; // `${unitType}:${what}` → { level, cost, value, payback, late }
  const seenLevels = new Set();
  const pjByLevel = {}; // `${region}:${level}:${zone}` → perJob when that level was first reached
  // At every level first reached: the planner's own upgrade values (D.upgradeOptions, §2.5) on the delegate's real
  // state (its processing chain, its perJob). A step is priced the first time it is available to THIS player: the
  // delegate owns a unit of that type and (step 1) or one of its units already stands at that step / tier (so step 3
  // and tier 2→3 are priced late, not at Lv1). A type the delegate never owned has no rows (reported as unmeasured).
  // points: 99 (the coin gate, not the skill points, is measured here).
  function samplePaybacks() {
    const L = D.level(s);
    const key0 = `${regionNo}:${L}`;
    if (seenLevels.has(key0)) return;
    seenLevels.add(key0);
    for (const zone of zones) pjByLevel[`${key0}:${zone}`] = r2(D.perJob(s, zone));
    for (const zone of zones) for (const type of Object.keys(STAFF)) {
      if (STAFF[type].zone !== zone || STAFF[type].level > L) continue;
      const owned = D.zoneUnits(s, zone).filter(x => x.type === type);
      if (!owned.length) continue;
      for (const step of [1, 2, 3]) {
        const robot = STAFF[type].kind === 'robot', t = step - 1;
        const u = { ...fakeUnit(type), points: 99, level: step, stats: { speed: step, smart: step, accuracy: step, stamina: step },
          parts: robot ? { battery: t, motor: t, cooler: t, frame: t } : {}, gear: robot ? {} : Object.fromEntries(GEAR.zone[zone].map(g => [g, t])) };
        let opts = [];
        try { opts = D.upgradeOptions(s, u); } catch (err) { bugs.push({ type: 'upgradeOptions', error: String(err).slice(0, 200) }); }
        for (const o of opts) {
          if (o.quality) continue;
          const what = o.what?.stat ? `stat ${o.what.stat} ${step}→${step + 1}` : o.what?.part ? `part ${o.what.part} t${t}→${t + 1}` : o.what?.item ? `gear ${o.what.item} t${t}→${t + 1}` : o.what?.pack ? `soft ${o.what.pack}` : o.act.type;
          const key = `${type}:${what}`;
          const w = o.what || {};
          const at = step === 1 || owned.some(x => (w.stat ? (x.stats?.[w.stat] || 1) >= step : w.part ? (x.parts?.[w.part] || 0) >= t : w.item ? (x.gear?.[w.item] || 0) >= t : false));
          if (at && !paybacks[key]) paybacks[key] = { type, level: L, region: regionNo, cost: o.cost, value: r2(o.value), payback: r2(o.payback), late: !!o.late };
        }
      }
    }
  }
  let loanRec = null; // { pack, takenP, termMin, repaidP, late }
  const i30 = []; // [playedMs, I30, I10] per played minute

  while (now - start < minutes * 60000) {
    if (s.story.phase === 'expiry') act('expiry/execute');
    if (s.story.phase === 'chooseRegion') enter(game === 'cafe' ? 'jp-1' : 'br-1');
    // customers
    if (playsCafe) while (now >= nextCustomer) { act('shop/spawnCustomer', { roll: rnd() }); nextCustomer += D.region(s) ? D.arrivalMs(s) : 9000; }
    if (loan && !loanRec && regionNo === 1 && D.level(s) >= (LOAN.packLevel[loan] || 1) && s.story.phase === 'play') {
      if (act('loan/take', { amount: loan })) { const ln = D.loansOf(s).at(-1); loanRec = { pack: loan, id: ln.id, takenP: P(), termMin: ln.termMin, level: D.level(s), repaidP: null, late: false }; }
      else loanRec = { pack: loan, error: Object.keys(failures).filter(k => k.startsWith('loan/take')).join(',') || 'refused', level: D.level(s) };
    }
    let did = false;
    // 0. a real player opens the build / land menus now and then even while busy (every 15 s of play)
    if (now >= nextInvest) { nextInvest = now + 15000; did = invest(); }
    // 1. café: serve ready cups, brew, take orders
    // A café-only region has no farm: it imports beans from the supplier before a cup runs short (latte = 3 beans).
    if (!did && game === 'cafe' && s.inventory.beans < 3) did = act('shop/buyBeans');
    // The delegate leaves the counter to a working café team (≥ 2 baristas / brewBots on shift and working) and only
    // steps in when orders pile up (≥ 3 waiting): a player who taps every cup himself is not delegating, and the
    // café is demand-bound (one walk-in / 9 s), so his 3★ cups would only take the team's orders away.
    const cafeTeam = managed && playsCafe && here().filter(u => STAFF[u.type].zone === 'shop' && D.unitWorking(u, now)).length >= 2;
    const pile = playsCafe && (D.region(s)?.shop.orders || []).filter(o => o.stage === 'waiting').length >= 3;
    if (!did && playsCafe && (!cafeTeam || pile)) did = act('shop/serve') || act('shop/brew') || act('shop/takeOrder');
    // 2. production: collect finished batches
    if (!did && playsFarm) for (const b of D.region(s).buildings) if (b.job && D.jobState(b, now).stage === 'ready' && act('prod/collect', { uid: b.uid })) { did = true; break; }
    // 3. harvest / plant. The delegate sells a full storehouse first (with a team harvesting, harvesting into it only
    // failed, 5 895 storageFull a run, and ripe plots never counted as the §3.7 hire backlog); the tapper keeps the
    // historical order (tests/core/economy.test.mjs).
    const roomy = D.stored(s) < D.capacity(s);
    if (!did && managed && playsFarm && !roomy) did = sell();
    if (!did && playsFarm) for (const p of D.ownedPlots(s)) {
      const st = D.plotState(s, p.id, now);
      if (st.stage === 'ready' && (!managed || D.stored(s) < D.capacity(s)) && act('farm/harvest', { plotId: p.id })) { did = true; break; }
      if (st.stage === 'empty') {
        const crop = D.unlockedCrops(s).filter(c => D.seedCost(s, c) <= s.player.coins).pop();
        if (crop && act('farm/plant', { plotId: p.id, crop })) { did = true; break; }
      }
    }
    // 4. start batches (downstream first)
    if (!did && playsFarm && process) {
      outer: for (const stage of STAGES) for (const b of D.region(s).buildings) {
        if (BUILDINGS[b.type]?.recipe !== stage || b.job) continue;
        if (!D.prodError(s, b) && act('prod/start', { uid: b.uid })) { did = true; break outer; }
      }
    }
    // 5. sell, 6. invest
    if (!did) did = sell();
    if (!did) did = invest();
    const step = did ? tap : 500;
    const playing = s.story.phase === 'play' && !!s.world.currentRegion;
    if (playing) { const sp = span(); sp.ms += step; sp.units = Math.max(sp.units, s.staff.units.length); if (D.gmOf(s)) sp.gmMs += step; }
    now += step;
    timers(step);
    if (managed && playing) samplePaybacks();
    if (loanRec && loanRec.id && loanRec.repaidP == null && !loanRec.late) {
      const ln = (s.loans || []).find(x => x.id === loanRec.id && x.owed > 0);
      if (!ln) loanRec.repaidP = P();
      else if (ln.late) { loanRec.late = true; loanRec.lateP = P(); }
    }
    const minute = Math.floor((now - start) / 60000);
    if (minute > lastMinute) {
      perMinute.push({ minute, coins: Math.round(s.player.coins), earned: Math.round(s.stats.earned), earnedThisMinute: Math.round(s.stats.earned - earnedAtLastMinute),
        level: D.level(s), round: s.player.round, beans: s.inventory.beans, stored: D.stored(s), capacity: D.capacity(s), served: s.stats.served,
        batches: s.stats.produced || 0, region: s.world.currentRegion, phase: s.story.phase, worth: Math.round(netWorth(s)),
        ...(managed ? { played: P(), cost: Math.round(runCost()), units: s.staff.units.length, gm: !!D.gmOf(s), regionNo, i10: Math.round(D.I10(s)), i30: Math.round(D.I30(s)), loanOwed: D.loanTotal(s) } : {}) });
      if (managed) i30.push([P(), D.I30(s), D.I10(s)]);
      earnedAtLastMinute = s.stats.earned;
      lastMinute = minute;
    }
    if (stopAfterLoan && loanRec && (loanRec.repaidP != null || loanRec.late || loanRec.error)) break;
  }
  return { start, end: now, state: s, log, perMinute, minCoins, failures, coinDelta, income, counts, game, process, persona,
    spans, care, gmStats, fines, answers, bugs, paybacks, pjByLevel, rates, loan: loanRec, i30, neglectFrom, useGm, maxUnits, teamSize };
}

function printReport({ start, state: s, log, perMinute, income, counts, game, process, persona, spans, care, gmStats, bugs }) {
  const fmt = ms => `${Math.floor((ms - start) / 60000)}m${String(Math.floor((ms - start) / 1000) % 60).padStart(2, '0')}s`;
  console.log(`GAME ${game}  process=${process}  persona=${persona}\nTIMELINE`);
  for (const [t, e] of log) console.log(fmt(t), e.type, JSON.stringify({ ...e, type: undefined }));
  console.log('\nPER 5 MIN');
  let prev = 0;
  for (const row of perMinute.filter(r => r.minute % 5 === 0)) { console.log(`${String(row.minute).padStart(3)}m  L${row.level}  coins ${row.coins}  earned/min ${Math.round((row.earned - prev) / 5)}  stored ${row.stored}/${row.capacity}  batches ${row.batches}  served ${row.served}`); prev = row.earned; }
  console.log('\nINCOME', JSON.stringify(income), '\nACTIONS', JSON.stringify(counts));
  if (persona !== 'tapper') {
    console.log('CARE', JSON.stringify(care), '\nGM', JSON.stringify(gmStats));
    console.log('RUNNING COST by level', JSON.stringify(Object.fromEntries(Object.entries(spans).map(([L, x]) => [L, { min: r2(x.ms / 60000), earned: Math.round(x.earned), mandatory: Math.round(x.mandatory), gm: Math.round(x.gm), optional: Math.round(x.optional), fines: Math.round(x.fines) }]))));
    if (bugs.length) console.log('BUGS', JSON.stringify(bugs.slice(0, 10)));
  }
  console.log('SUMMARY', JSON.stringify({ level: D.level(s), coins: Math.round(s.player.coins), served: s.stats.served, harvested: s.stats.harvested, batches: s.stats.produced || 0, parcels: s.stats.parcels, region: s.world.currentRegion }));
}

// ---------- management-rules §7.4 gates ----------
// Played minutes to Level 10 (§7.4 measures on the played clock, D.playedMs; log rows are [wall, event, played]).
export const lvl10Minutes = r => { const e = r.log.find(([, ev]) => ev.type === 'levelUp' && ev.to >= EXPIRY_LEVEL); return e ? (e[2] ?? e[0] - r.start) / 60000 : Infinity; };
const pct = x => `${(x * 100).toFixed(1)} %`;
const mean = a => (a.length ? a.reduce((n, x) => n + x, 0) / a.length : NaN);
// 95 % confidence half-width of the mean (normal approximation; NaN below 2 samples).
const ci95 = a => { if (a.length < 2) return NaN; const m = mean(a); return 1.96 * Math.sqrt(a.reduce((n, x) => n + (x - m) ** 2, 0) / (a.length - 1) / a.length); };
// Net coins per played minute over the played window [from, from + W): the change of the coin balance, so EVERY coin
// out counts — running costs (care, upkeep, the manager, fines, rival fees) and the capital the manager triggers or
// gets approved (upgrades, hires, seeds / beans, licences, land). Read from perMinute (the income series is a 60-row ring).
function netRate(r, fromP, W) {
  const rows = r.perMinute.filter(x => x.played != null && x.played >= fromP && x.played < fromP + W * 60000);
  if (rows.length < 2) return NaN;
  const a = rows[0], b = rows.at(-1);
  return (b.coins - a.coins) / ((b.played - a.played) / 60000);
}

// Net worth gained per played minute over [from, from + W) (see netWorth).
function worthRate(r, fromP, W) {
  const rows = r.perMinute.filter(x => x.played != null && x.worth != null && x.played >= fromP && x.played < fromP + W * 60000);
  if (rows.length < 2) return NaN;
  const a = rows[0], b = rows.at(-1);
  return (b.worth - a.worth) / ((b.played - a.played) / 60000);
}

export function runGates({ runs = 10, gmSeeds = 10, quiet = false } = {}) {
  const say = (...a) => { if (!quiet) console.error(...a); };
  const rows = [];
  // pass: true | false | null (null = SKIP: not measurable in this run, e.g. a unit type the delegate never owned)
  const add = (gate, subject, value, target, pass, note = '') => rows.push({ gate, subject, value, target, pass, note });
  const games = ['farm', 'cafe'];
  const long = {};
  // 1. Level 10 per persona, 2. running cost, 3. payback — long runs.
  for (const game of games) for (const persona of ['tapper', 'delegate']) {
    say(`run ${persona} ${game}…`);
    long[`${persona}:${game}`] = runSim(persona === 'tapper' ? 45 : 110, { game, persona });
  }
  for (const game of games) {
    say(`run neglect ${game}…`);
    long[`neglect:${game}`] = runSim(game === 'farm' ? 130 : 110, { game, persona: 'neglect' }); // farm: the region-2 manager comes at ≈ 66 played min, so 130 covers the whole 45-min window
  }
  const LO = 12 * 0.75, HI = 20 * 1.25;
  // the neglect persona is the delegate (same seed) until its region-2 manager: its Lv10 rows would only repeat the
  // delegate's, so Lv10 is read on the tapper and the delegate only, in played minutes
  for (const key of Object.keys(long).filter(k => !k.startsWith('neglect:'))) {
    const r = long[key], m = lvl10Minutes(r);
    add('Lv10 played minutes (12–20 ±25 %)', key, m.toFixed(1), `${LO}–${HI}`, m >= LO && m <= HI);
  }
  for (const game of games) {
    const r = long[`delegate:${game}`];
    for (const L of [3, 6, 10, 15]) {
      // one region per row (spans are keyed region:level): the first region that spends time at that level (Lv10 of
      // region 1 lasts 0 min — the Level-10 incident — so Lv10 / Lv15 are read in region 2)
      const rk = Object.keys(r.spans).filter(k => k.endsWith(`:${L}`) && r.spans[k].ms > 0).sort()[0];
      const sp = rk && r.spans[rk];
      if (!sp || !(sp.earned > 0)) { add('mandatory cost % earned (≤ 25 %)', `delegate:${game} Lv${L}`, 'n/a', '≤ 25 %', false, 'level not reached'); continue; }
      const m = (sp.mandatory + sp.gm) / sp.earned, o = sp.optional / sp.earned;
      // vacuous: nothing to pay for (no unit on the roster, or no manager from his unlock level) is not a pass
      const vac = !sp.units ? 'no unit on the roster' : L >= GM.unlockLevel && !sp.gmMs ? 'no manager at this level' : '';
      add('mandatory cost % earned (≤ 25 %)', `delegate:${game} R${rk.split(':')[0]} Lv${L}`, vac ? `vacuous ${pct(m)}` : pct(m), '≤ 25 %', !vac && m <= 0.25,
        `${vac ? `VACUOUS (${vac}); ` : ''}roster ≤ ${sp.units}, GM ${(sp.gmMs / 60000).toFixed(1)} min; mand ${Math.round(sp.mandatory)} + gm ${Math.round(sp.gm)} / earned ${Math.round(sp.earned)} over ${(sp.ms / 60000).toFixed(1)} min; +care ${pct(o)}; I(L) ref ${incomeRef(game, L)}/min, measured ${Math.round(sp.earned / (sp.ms / 60000))}/min`);
    }
    // The planner prices contrib(u) with GM.value.jobsPerMin; the realm loop's measured jobs per minute on shift
    // (this run) rescales the value (contrib-proportional approximation). The gate is read on the measured rate when
    // that unit type worked in the run, else on the planner's model.
    // The rate is measured over the seconds a unit had a job in hand (workSec), not all on-shift seconds: idle time
    // on shift is demand (the café's walk-ins), which D.upgradeOptions already prices through throughputShare.
    const pb = r.paybacks, gateName = `upgrade payback (≤ ${UPGRADE_GATE.paybackMin} / late ≤ ${UPGRADE_GATE.latePaybackMin})`;
    for (const [k, o] of Object.entries(pb).sort()) {
      const lim = o.late ? UPGRADE_GATE.latePaybackMin : UPGRADE_GATE.paybackMin;
      const rt = r.rates[o.type], ref = GM.value.jobsPerMin[o.type];
      const meas = rt && rt.workSec > 120 ? rt.jobs / (rt.workSec / 60) : null;
      if (meas == null) { add(gateName, `${game} ${k} @R${o.region} Lv${o.level}`, 'unmeasured', `≤ ${lim}`, null, `no unit of this type worked ≥ 2 min; planner model ${o.payback.toFixed(1)} min`); continue; }
      const v = o.payback * ref / meas;
      add(gateName, `${game} ${k} @R${o.region} Lv${o.level}`, `${v.toFixed(1)} min`, `≤ ${lim}`, v <= lim,
        `measured ${meas.toFixed(1)} jobs/min working vs ref ${ref}; planner model ${o.payback.toFixed(1)} min (cost ${o.cost} / value ${o.value}/min)${o.late ? ' late' : ''}`);
    }
    for (const type of Object.keys(STAFF).filter(t => STAFF[t].zone === (game === 'farm' ? 'farm' : 'shop')))
      if (!Object.values(pb).some(o => o.type === type)) add(gateName, `${game} ${type} (all steps)`, 'unmeasured', '—', null, 'the delegate never owned this unit type in the run');
  }
  // 4. loans: each pack at its level, `runs` seeds per game, delegate.
  for (const game of games) for (const pack of LOAN.packs) {
    // autoRepay only (manualRepay: false): the 20 % of every income must clear the loan inside its term on its own;
    // a deadline top-up by hand would hide a term that is too short.
    let ok = 0, n = 0;
    const pay = [], errs = {};
    for (let i = 0; i < runs; i++) {
      const r = runSim(220, { game, persona: 'delegate', seed: 101 + i, loan: pack, stopAfterLoan: true, manualRepay: false });
      const L = r.loan;
      n++;
      if (!L || L.error) { errs[L?.error || 'none'] = (errs[L?.error || 'none'] || 0) + 1; continue; }
      if (L.repaidP != null && !L.late) { ok++; pay.push((L.repaidP - L.takenP) / 60000); }
      else errs[L.late ? 'late' : 'open'] = (errs[L.late ? 'late' : 'open'] || 0) + 1;
      if (i === 0) errs.term = L.termMin;
    }
    say(`loan ${game} ${pack}: ${ok}/${n}`);
    add('loan payback < term, autoRepay only (≥ 90 %)', `${game} ${pack} @Lv${LOAN.packLevel[pack]}`, `${ok}/${n}`, '≥ 90 %', ok / n >= 0.9,
      `payback mean ${mean(pay).toFixed(1)} / max ${pay.length ? Math.max(...pay).toFixed(1) : 'n/a'} min; term ${errs.term ?? '?'} min; ${JSON.stringify({ ...errs, term: undefined })}`);
  }
  // 5. neglect: 45 played minutes of unanswered tasks from the manager's hire (region 2). The window is only read when
  // that hire came at GM.unlockLevel (§7.4: "hires GM at Lv6"); a later hire is flagged (wrong level and roster).
  for (const game of games) {
    const r = long[`neglect:${game}`];
    if (r.neglectFrom == null) { add('neglect 45 min fines % I30 (8–12 %)', `neglect:${game}`, 'n/a', '8–12 %', false, 'no manager hired in region 2'); continue; }
    const to = r.neglectFrom + 45 * 60000;
    const f = r.fines.filter(([p]) => p >= r.neglectFrom && p < to).reduce((n, [, c]) => n + c, 0);
    const iw = r.i30.filter(([p]) => p >= r.neglectFrom && p < to).map(x => x[1]);
    const I30m = mean(iw), I30end = iw.at(-1);
    const hire = r.gmStats.hires.find(h => h.region >= 2);
    const ref = 30 * incomeRef(game, hire?.level || 6);
    const share = f / I30m, atUnlock = hire?.level === GM.unlockLevel;
    add('neglect 45 min fines % I30 (8–12 %)', `neglect:${game} from Lv${hire?.level}`, pct(share), '8–12 %', atUnlock && share >= 0.08 && share <= 0.12,
      `${atUnlock ? '' : `WRONG WINDOW: the region-2 manager came at Lv${hire?.level}, not Lv${GM.unlockLevel}; `}fines ${Math.round(f)} (${r.fines.filter(([p]) => p >= r.neglectFrom && p < to).length} expiries); I30 mean ${Math.round(I30m)}, end ${Math.round(I30end)}; vs ref I30(Lv${hire?.level}) ${ref}: ${pct(f / ref)}; window ${((Math.min(to, r.i30.at(-1)?.[0] ?? to) - r.neglectFrom) / 60000).toFixed(0)} min`);
    add('neglect: coins never < 0', `neglect:${game}`, String(Math.round(r.minCoins * 100) / 100), '≥ 0', r.minCoins >= 0);
  }
  for (const key of Object.keys(long)) add('coins never < 0, no NaN, no throw', key, String(Math.round(long[key].minCoins * 100) / 100), '≥ 0, 0 bugs', long[key].minCoins >= 0 && !long[key].bugs.length, long[key].bugs.length ? JSON.stringify(long[key].bugs[0]) : '');
  for (const game of games) {
    const g = long[`delegate:${game}`].gmStats;
    add('manager acts (delegate)', game, `${g.acts} acts, ${g.filed} filed`, '> 0', g.acts > 0, JSON.stringify(g.byKey || {}));
  }
  // 6. GM net value: manager vs the same coins sunk without one, team capped at N units, region 2 (no wipe), 20 min
  // from the hire; net = Δ net worth (netWorth: coins + assets at cost; fees, care, salary, fines lost). The sign is read on the 95 % interval of
  // the mean over gmSeeds seeds: PASS only when the whole interval is on the right side of 0.
  const W = 40; // balance pass 2026-11-08: 40 played min (the throughput payback gate) and net WORTH, not cash: the
  // delegate reinvests every coin, so cash only showed the manager's proposals as spending, never as what they bought
  for (const game of games) for (const N of [2, 4, 6]) {
    const diffs = [], levels = [];
    for (let i = 0; i < gmSeeds; i++) {
      const a = runSim(110, { game, persona: 'delegate', seed: 201 + i, teamSize: N, gm: true });
      const b = runSim(110, { game, persona: 'delegate', seed: 201 + i, teamSize: N, gm: 'sink' });
      const ha = a.gmStats.hires.find(h => h.region >= 2), hb = b.gmStats.hires.find(h => h.region >= 2);
      if (!ha || !hb) continue;
      const from = Math.max(ha.played, hb.played);
      const d = worthRate(a, from, W) - worthRate(b, from, W);
      if (Number.isFinite(d)) { diffs.push(d); levels.push(ha.level); }
    }
    say(`gm value ${game} N=${N}: ${diffs.map(d => d.toFixed(1)).join(', ')}`);
    const v = mean(diffs), h = ci95(diffs), lo = v - h, hi = v + h;
    const want = N <= 2 ? hi < 0 : N >= 4 ? lo > 0 : true;
    add('GM net value (< 0 at ≤ 2 units, > 0 at ≥ 4, R = 1)', `${game} N=${N}`, `${Number.isFinite(v) ? v.toFixed(1) : 'n/a'} ± ${Number.isFinite(h) ? h.toFixed(1) : '?'}`, N <= 2 ? '< 0' : '> 0', Number.isFinite(lo) && want,
      `${diffs.length} seeds, 95 % CI [${lo.toFixed(1)}, ${hi.toFixed(1)}] coins/min (Δ net worth); hire Lv ${[...new Set(levels)].join('/')}; window ${W} played min from the region-2 hire`);
  }
  return { rows, long };
}

function printGates({ rows }) {
  const cols = ['gate', 'subject', 'value', 'target', 'pass', 'note'];
  const w = { gate: 44, subject: 34, value: 18, target: 10, pass: 4 };
  console.log('\nGATES (management-rules §7.4)');
  console.log(cols.map(c => (w[c] ? c.toUpperCase().padEnd(w[c]) : c.toUpperCase())).join(' '));
  const tag = r => (r.pass == null ? 'SKIP' : r.pass ? 'PASS' : 'FAIL');
  for (const r of rows) console.log([r.gate.padEnd(w.gate), r.subject.padEnd(w.subject), String(r.value).padEnd(w.value), String(r.target).padEnd(w.target), tag(r).padEnd(w.pass), r.note].join(' '));
  const fail = rows.filter(r => r.pass === false).length, skip = rows.filter(r => r.pass == null).length;
  console.log(`\n${rows.length - fail - skip} PASS, ${fail} FAIL, ${skip} SKIP`);
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  if (argv.includes('--gates')) {
    const i = argv.indexOf('--runs'), j = argv.indexOf('--gm-seeds');
    const fail = printGates(runGates({ runs: i >= 0 ? Number(argv[i + 1]) : 10, gmSeeds: j >= 0 ? Number(argv[j + 1]) : 10 }));
    process.exitCode = fail ? 1 : 0; // a wrapper / CI reads a failing gate as red
  } else {
    const [m = 60, g = 'both', p = '1', persona = 'tapper'] = argv;
    printReport(runSim(Number(m), { game: g, process: p !== '0', persona }));
  }
}
