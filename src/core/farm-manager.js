// Farm Manager V2 (docs/design/farm-manager-v2.md): the knowledge, economy and four-terrace layer over the existing
// manager (derive.js gmCandidates → game.js gm/think). Pure and deterministic: no three.js, no store, no timers, no
// Math.random, so it keeps working when the 3D scene is delayed or off. It never performs an action itself: every purchase
// still goes through the action handlers (gmRun), which charge the real price and check the real rules.
//
//  OBSERVE   farmKnowledge: every terrace, read from ESTATES / CLIMATE_EFFECT / the save.
//  VALIDATE  legalCrops, gate.
//  FORECAST  econOf: coins per minute, net profit, ROI, payback of one investment.
//  PLAN      thinkContext ranks the investments; refreshPlan stores the objective and bottlenecks (low frequency).
//  RESERVE   thinkContext.budget shrinks as jobs pass; queued crew orders count as committed coins (D.fmCommitted).
//  EXECUTE   game.js gm/think (gmRun, or a crew order).
//  VERIFY    note(): every outcome, with its reason code, in the decision log.
//  ADJUST    calibrate: measured income / modelled income scales every later forecast.
import { FARM_MANAGER as FM, EXPIRY_LEVEL, EXPIRY_ENABLED, CLIMATE_PICK, gmHandsPerMin, TEND, QUALITY, CROPS, GOODS, RECIPES, BUILDINGS, STAFF, ROBOT_TASKS, GM, doesJob, unitSpeed } from './config/economy.js';
import { ESTATES, ESTATE_ORDER, FARM_TIERS, tierIndexAt } from './config/layout.js';
import { level, region, ownedPlots, plotState, buildingsOf, capacity, stored, farmStaffing, farmOverloaded, farmPicksPerMin, sellAllQuote, I10, incomeEarned, incomeRows, loanTotal, playedMs, fmOf, fmReserve, fmCommitted, climateFit, climateEffect, climateOfPlot, harvestUrgency, treeOld, pruneCost, unlockedCrops, cropBeanValue, perBean, yieldOf, seedCost, growMs, dripCovers, wellBonus, assignedUnits, applicants, gmStaffPlan, perJob, contrib, jobsPerMin, runCostPerMin, buildCost, estateOwned, nextEstate, parcelCost, parcelError, recipeOf, storeBuildings } from './derive.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const r2 = v => Math.round(v * 100) / 100;
const modeOf = f => FM.modes[f.mode] || FM.modes.balanced;
const crewOf = s => assignedUnits(s, s.world.currentRegion, 'farm').filter(u => u.active !== false);

// ---------- knowledge: crops and terraces ----------
/** One season of a crop in a growing zone, from the game's own formulas (penalties included). */
// load = { fields, picks } (picks per minute the farm can do): a field then waits for its turn, and a pick that comes after the
// crop's fresh window earns 1★ instead of 3★, Arabica also drops cherries. That is why a slow-to-spoil crop wins on a busy farm.
export function cropEcon(s, crop, zone, pb = perBean(s), load = null) {
  const e = climateEffect(crop, zone) || {}, c = CROPS[crop];
  const season = (growMs(s, crop) + (c.waves ? c.waves.regrowSeconds * 1000 : 0)) * (e.timeMul || 1) / 60000;
  const wait = load ? Math.max(0, load.fields * (c.waves ? 2 : 1) / Math.max(.5, load.picks) - season) : 0, waitSec = wait * 60;
  const fresh = waitSec <= (c.freshSeconds ?? QUALITY.freshSeconds), st = Math.max(1, Math.min(3, (fresh ? 3 : 1) + (e.stars || 0)));
  const dropped = c.drop && waitSec > c.drop.after ? 1 + Math.floor((waitSec - c.drop.after) / c.drop.every) : 0;
  const revenue = Math.max(1, Math.round(yieldOf(s, crop) * (QUALITY.yield[st] || 1)) - dropped) * cropBeanValue(s, crop, pb);
  const cost = seedCost(s, crop) / (c.life || 1), cycle = season + wait;
  return { crop, zone, fit: climateFit(crop, zone), revenue: r2(revenue), cost: r2(cost), profit: r2(revenue - cost), season: r2(cycle), rate: (revenue - cost) / Math.max(.01, cycle) };
}
/** How many fields there are and how many picks a minute the crew and the manager's hands can do. */
export function pickLoad(s) {
  return { fields: Math.max(1, ownedPlots(s).length), picks: farmPicksPerMin(s) };
}
/**
 * Crops the manager may plant in a zone. The game has no hard ban: CLIMATE_EFFECT only makes a wrong zone slower and lower
 * grade. V2 treats 'bad' as forbidden while any other crop is unlocked; `restricted` = nothing else exists, so the penalised
 * crop is the temporary fallback (unresolved rule R1 in the doc).
 */
export function legalCrops(s, zone, pb = perBean(s), load = null) {
  const all = unlockedCrops(s).map(c => cropEcon(s, c, zone, pb, load)).sort((a, b) => b.rate - a.rate);
  const good = all.filter(x => x.fit !== 'bad');
  return { list: good.length ? good : all, restricted: !good.length && all.length > 0 };
}
// One answer per terrace per game state: this is asked for every empty field by every planter.
let legalMemo = { s: null, m: new Map() };
function legalNow(s, zone) {
  if (legalMemo.s !== s) legalMemo = { s, m: new Map() };
  let v = legalMemo.m.get(zone);
  if (!v) { v = legalCrops(s, zone, perBean(s), pickLoad(s)); legalMemo.m.set(zone, v); }
  return v;
}
/** The crop the manager puts on this field: the most coins per minute that suits its terrace and that he can pay for (XP does not count). */
export function managerCropFor(s, plotId, coins = s.player.coins) {
  return legalNow(s, climateOfPlot(s, plotId)).list.find(c => seedCost(s, c.crop) <= coins)?.crop || null;
}
/**
 * His own round of field jobs, like a player tapping: ripe fields first (most urgent first), then the empty ones, then old
 * trees cut back, then watering what is still dry. `plots` leaves out what the crew is already on; never touches the player's minimum reserve.
 */
export function handsJobs(s, now, plots, n) {
  const r = region(s), H = FM.hands, ripe = [], empty = [], old = [], dry = [], wrong = [], pb = perBean(s), load = pickLoad(s);
  // A tree worth replacing: planted where it is penalised while a suited crop exists, or worn out with a clearly better crop for this field now.
  const replaceable = (p, pl) => { const zone = climateOfPlot(s, p.id), bad = climateFit(pl.crop, zone) === 'bad', aged = treeOld(pl); if (!bad && !aged) return false; const L = legalNow(s, zone), top = L.list[0]; if (!top || top.crop === pl.crop) return false; return (bad && !L.restricted) || (aged && top.rate >= CLIMATE_PICK.switchMul * cropEcon(s, pl.crop, zone, pb, load).rate); };
  let coins = s.player.coins - fmOf(s).minReserve;
  for (const p of plots) {
    const pl = r.plots[p.id];
    if (!pl) { empty.push(p); continue; }
    if (plotState(s, p.id, now).stage === 'ready') ripe.push(p);
    else if (replaceable(p, pl)) wrong.push(p);
    else if (treeOld(pl)) old.push(p);
    else if (!pl.watered && !dripCovers(s, p.id)) dry.push(p);
  }
  // Tiers with nobody of that trade are his first: the crew stays on its own tier, so nobody else will come.
  const covered = job => new Set(crewOf(s).filter(u => doesJob(u, job)).map(u => s.gm?.tiers?.[u.uid]));
  const firstUncovered = (list, job, then = null) => { const c = covered(job), gap = p => Number(c.has(tierIndexAt(p.x, p.z))); return list.sort((a, b) => gap(a) - gap(b) || (then ? then(a, b) : 0)); };
  firstUncovered(empty, 'plant'); firstUncovered(dry, 'water');
  const jobs = [], hasRoom = stored(s) < capacity(s);
  const picks = hasRoom ? firstUncovered(ripe, 'harvest', (a, b) => harvestUrgency(s, b.id, now) - harvestUrgency(s, a.id, now)) : [];
  const pick = () => { const p = picks.shift(); if (p) jobs.push({ act: 'farm/harvest', payload: { plotId: p.id }, plotId: p.id }); return !!p; };
  const sow = () => { const p = empty.shift(), crop = p && managerCropFor(s, p.id, coins); if (!crop) return false; coins -= seedCost(s, crop); jobs.push({ act: 'farm/plant', payload: { plotId: p.id, crop }, plotId: p.id }); return true; };
  const cut = () => { const p = old.find(q => pruneCost(r.plots[q.id].crop) <= coins); if (!p) return false; old.splice(old.indexOf(p), 1); coins -= pruneCost(r.plots[p.id].crop); jobs.push({ act: 'farm/prune', payload: { plotId: p.id }, plotId: p.id }); return true; };
  const pour = () => { const p = dry.shift(); if (p) jobs.push({ act: 'farm/water', payload: { plotId: p.id }, plotId: p.id }); return !!p; };
  for (let i = Math.ceil(n * H.harvestShare); i > 0 && pick(); i--);
  while (jobs.length < n && sow());
  const swap = () => { const p = wrong.shift(); if (p) jobs.push({ act: 'farm/uproot', payload: { plotId: p.id }, plotId: p.id }); return !!p; };
  while (jobs.length < n && (pick() || swap() || cut() || pour()));
  return jobs;
}
/** Everything the planner knows about the four terraces now. [{ t, id, zone, elevation, owned, … }] */
export function farmKnowledge(s, now) {
  const r = region(s);
  if (!r) return null;
  const pb = perBean(s), tiers = s.gm?.tiers || {}, crew = crewOf(s), load = pickLoad(s);
  const rows = ESTATE_ORDER.map((id, t) => {
    const e = ESTATES[id], crops = legalCrops(s, e.zone, pb), now_ = legalCrops(s, e.zone, pb, load).list[0] || null;
    return { t, id, zone: e.zone, elevation: FARM_TIERS[e.zone], owned: estateOwned(s, id), unlockCost: e.cost, unlockLevel: e.level, seed: e.seed, unlockError: estateOwned(s, id) ? null : parcelError(s, e.seed),
      crops: crops.list.map(c => c.crop), restricted: crops.restricted, flow: crops.list[0]?.rate || 0, best: now_?.crop || null, bestRate: r2(now_?.rate || 0),
      buildings: 0, plots: 0, planted: 0, ripe: 0, empty: 0, dry: 0, wellFields: 0, badCrops: 0, wells: 0, drips: 0, stations: 0, crew: 0 };
  });
  for (const p of ownedPlots(s)) {
    const row = rows[tierIndexAt(p.x, p.z)], pl = r.plots[p.id];
    row.plots++;
    if (wellBonus(s, p.id) > 0) row.wellFields++;
    if (!pl) { row.empty++; continue; }
    row.planted++;
    if (climateFit(pl.crop, row.zone) === 'bad') row.badCrops++;
    const stage = plotState(s, p.id, now).stage;
    if (stage === 'ready') row.ripe++;
    else if (!pl.watered && !dripCovers(s, p.id)) row.dry++;
  }
  for (const b of r.buildings || []) {
    const row = rows[tierIndexAt(b.x, b.z)];
    row.buildings++;
    if (b.type === 'well') row.wells++; else if (b.type === 'dripLine') row.drips++; else if (recipeOf(b)) row.stations++;
  }
  for (const u of crew) { const t = tiers[u.uid]; if (t != null && rows[t]) rows[t].crew++; }
  for (const row of rows) { row.use = row.plots ? row.planted / row.plots : 0; row.earnPerMin = r2(row.planted * row.flow); }
  return rows;
}

// ---------- money over time ----------
/** Income, running costs and net profit over the last `min` played minutes. Investments are not running costs. */
export function cashFlow(s, now, min = FM.recovery.minutes) {
  const earned = incomeEarned(s, min), from = Math.floor(now / 60000) - min;
  let spent = 0;
  for (const e of s.staff.ledger || []) if (e.min > from) spent += (e.spent || 0) - (e.hire || 0) - (e.upgrade || 0);
  return { earned: r2(earned), spent: r2(spent), net: r2(earned - spent), perMin: r2((earned - spent) / min) };
}
/** Recovery Mode: losing money and short of cash, even counting the goods waiting in the storehouse. */
export function inRecovery(s, now, reserve = fmReserve(s)) {
  if (playedMs(s) < FM.recovery.minutes * 60000) return false; // too early to tell
  const stock = sellAllQuote(s).coins || 0;
  return cashFlow(s, now).net < 0 && s.player.coins + stock < reserve * FM.recovery.coinsMul;
}
/** Modelled farm income per minute: planted fields × their terrace's best crop × the labour that can harvest them. */
function modelFlow(k, labour) { return k.reduce((n, t) => n + t.planted * t.flow, 0) * labour; }
/** 0.25..1: how much of the fields' harvest the crew can actually pick (the player's own tapping is not assumed). */
function labourShare(s, k) {
  // + the manager's own hands (gm/hands picks first, harvestShare of his jobs): without them a fresh manager with a small farm
  // read "Ruộng chín nhanh hơn sức hái: 25 %" while he picked every ripe tree himself (QA 2026-11-09).
  const own = s.gm?.unit && fmOf(s).auto ? gmHandsPerMin(s.gm.unit) * FM.hands.harvestShare : 0;
  const pickers = own + crewOf(s).filter(u => doesJob(u, 'harvest')).reduce((n, u) => n + jobsPerMin(u), 0);
  const need = k.reduce((n, t) => { const best = t.best ? cropEcon(s, t.best, t.zone) : null; return n + (best ? (t.planted + 1) / Math.max(.2, best.season) : 0); }, 0);
  return need > 0 ? Math.max(.25, Math.min(1, pickers / need)) : 1;
}

// ---------- forecast: one investment ----------
function storageFlow(s, x) {
  const cap = capacity(s), pct = cap > 0 ? stored(s) / cap : 1;
  return x.farmFlow * clamp01((pct - .5) / .5);
}
function stationFlow(s, x, recipe, speed = 1, batch = 1) {
  const rc = RECIPES[recipe];
  if (!rc) return 0;
  const [gIn, nIn] = Object.entries(rc.in)[0], [gOut, nOut] = Object.entries(rc.out)[0];
  const margin = (GOODS[gOut].price * nOut - GOODS[gIn].price * nIn - rc.fee) / nIn + (rc.premium || 0);
  const cap = nIn * batch * speed * 60 / rc.seconds;
  const have = (region(s).buildings || []).filter(b => recipeOf(b)?.id === recipe).length * nIn * 60 / rc.seconds;
  const beans = x.k.reduce((n, t) => { const c = t.best ? cropEcon(s, t.best, t.zone) : null; return n + (c ? t.planted * yieldOf(s, t.best) / Math.max(.2, c.season) : 0); }, 0);
  return Math.max(0, Math.min(cap, beans - have)) * margin;
}
/** Fields a new tank at (px, pz) would newly reach, and the walking one more water point saves. */
function wellFlow(s, x, px, pz) {
  const def = BUILDINGS.well, radius = def.effect.radius[0], grow = def.effect.grow[0], W = FM.water, wells = buildingsOf(s, 'well');
  let gain = 0;
  for (const p of ownedPlots(s)) if (Math.hypot(p.x - px, p.z - pz) <= radius && wellBonus(s, p.id) <= 0 && region(s).plots[p.id]) gain += x.k[tierIndexAt(p.x, p.z)].flow * grow;
  const waterers = crewOf(s).filter(u => doesJob(u, 'water'));
  if (!waterers.length || !wells.length) return gain;
  const dOld = Math.min(...wells.map(w => Math.hypot(w.x - px, w.z - pz)));
  const saved = dOld / (dOld + W.tripWorkM); // share of a trip's walking this tank removes around this spot
  return gain + waterers.reduce((n, u) => n + contrib(s, u, x.pj) * FM.jobValue.water, 0) * saved * .5;
}
function hireFlow(s, x, type) {
  const job = STAFF[type]?.jobs?.[0] || ROBOT_TASKS[type]?.[0], plan = gmStaffPlan(s, x.now).find(g => g.job === job);
  if (!job) return { job, flow: 0 };
  const unit = { type }, unmet = plan ? clamp01(plan.short / Math.max(unitSpeed(unit), .5)) : 0;
  return { job, flow: contrib(s, unit, x.pj) * (FM.jobValue[job] ?? .1) * unmet - runCostPerMin(unit) };
}
/** Category, coins per minute, and whether that figure comes from a real formula (known) or the old scoring value. */
function flowOf(s, c, x) {
  const a = c.act || {}, p = a.payload || {};
  if (a.type === 'land/buyParcel') {
    const t = x.k.find(row => ESTATES[row.id].lots.includes(p.parcelId));
    if (!t) return { cat: 'land', flow: 0, known: false };
    return { cat: 'land', flow: GM.growth.landFields * t.flow, known: true, tier: t.t, raw: true }; // the full-terrace test of farm-crew.md §15: today's crew and sales do not count against land
  }
  if (a.type === 'build/place') {
    const type = p.type, def = BUILDINGS[type] || {}, t = Number.isFinite(p.x) ? tierIndexAt(p.x, p.z) : null;
    if (type === 'field') { const row = x.k[t]; return { cat: 'crop', flow: row.flow * x.labour, known: true, invest: c.cost + (row.best ? seedCost(s, row.best) : 0), tier: t }; }
    if (type === 'well') return { cat: 'water', flow: wellFlow(s, x, p.x, p.z), known: true, tier: t };
    if (type === 'dripLine') { const n = ownedPlots(s).filter(q => Math.hypot(q.x - p.x, q.z - p.z) <= def.effect.radius[0] && region(s).plots[q.id] && !dripCovers(s, q.id)).length; return { cat: 'water', flow: n * (x.k[t]?.flow || 0) * TEND.speedup * .5, known: true, tier: t }; }
    if (def.effect?.capacity) return { cat: 'storage', flow: storageFlow(s, x), known: true, tier: t };
    if (def.recipe) return { cat: 'process', flow: stationFlow(s, x, def.recipe, 1, 1), known: true, tier: t };
    return { cat: 'building', flow: c.value, known: false, tier: t };
  }
  if (a.type === 'build/upgrade') {
    const b = (region(s)?.buildings || []).find(q => q.uid === p.uid), def = b && BUILDINGS[b.type];
    if (!def) return { cat: 'upgrade', flow: 0, known: false };
    if (def.effect?.capacity) return { cat: 'upgrade', flow: storageFlow(s, x), known: true };
    if (def.recipe && c.rule === 'buildUp') return { cat: 'upgrade', flow: c.value, known: true };
    if (def.recipe) return { cat: 'upgrade', flow: stationFlow(s, x, def.recipe, 1.25, 1), known: true };
    return { cat: 'upgrade', flow: c.value, known: false };
  }
  if (a.type === 'staff/recruit') { const type = applicants(s, 'farm').find(q => q.name === p.name)?.type; if (!type) return { cat: 'hire', flow: 0, known: false }; return { cat: 'hire', flow: hireFlow(s, x, type).flow, known: true }; }
  if (a.type === 'staff/hire') return { cat: STAFF[p.type]?.kind === 'robot' ? 'robot' : 'hire', flow: hireFlow(s, x, p.type).flow, known: true };
  if (['staff/upgradeStat', 'staff/upgradePart', 'staff/buyGear', 'staff/buySoftware'].includes(a.type)) return { cat: 'train', flow: c.value, known: c.rule !== 'richUp' };
  return { cat: 'other', flow: c.value, known: false };
}
/**
 * One capital candidate as an investment: Expected Net Profit = flow × horizon − investment; ROI = net / investment;
 * Payback = investment / flow. A figure that is only the old scoring value keeps known: false and is never used to
 * pass or fail the payback test.
 */
export function econOf(s, c, x) {
  const f = flowOf(s, c, x), flow = Math.max(0, f.flow) * (f.raw ? 1 : x.calib), invest = Math.max(1, f.invest ?? c.cost);
  const net = flow * x.m.horizon - invest;
  return { cat: f.cat, tier: f.tier ?? null, known: f.known, invest: r2(invest), flow: r2(flow), revenue: r2(flow * x.m.horizon), net: r2(net), roi: r2(net / invest), payback: flow > 0 ? r2(invest / flow) : Infinity };
}

// ---------- plan: ranking, bottlenecks, objective ----------
/** The next terrace to buy as an option, whether or not the coins are there yet (for "save up" decisions). */
function landOption(s, x) {
  const e = x.k.length ? nextEstate(s) : null;
  if (!e || parcelError(s, e.seed) && parcelError(s, e.seed) !== 'coins') return null;
  const c = { act: { type: 'land/buyParcel', payload: { parcelId: e.seed } }, cost: parcelCost(e.seed), group: 'capital', key: `land:${e.id}`, value: 0 };
  return { ...c, econ: econOf(s, c, x), estate: e.id };
}
const paybackLimit = (x, e) => (e.cat === 'land' ? x.m.landPayback : x.m.maxPayback);
/** What this think may spend, the ranked investments, and the modes' switches. Built once per think. */
export function thinkContext(s, now, list) {
  const f = fmOf(s), m = modeOf(f), reserve = fmReserve(s), committed = fmCommitted(s);
  const x = { s, now, f, m, reserve, committed, off: !f.auto, ask: !!f.ask, budget: Math.max(0, s.player.coins - reserve - committed), recovery: inRecovery(s, now, reserve), calib: f.calib ?? 1, pj: perJob(s, 'farm'), k: farmKnowledge(s, now) || [], saving: null, rank: new Map(), net: cashFlow(s, now).net, owed: loanTotal(s) };
  x.labour = x.k.length ? labourShare(s, x.k) : 1;
  x.farmFlow = modelFlow(x.k, x.labour);
  const cap = list.filter(c => c.group === 'capital' && c.cost > 0 && c.zone === 'farm');
  for (const c of cap) c.econ = econOf(s, c, x);
  const worth = c => (c.econ.known ? c.econ.flow / c.econ.invest : -1);
  x.ranked = [...cap].sort((a, b) => Number(!!b.essential) - Number(!!a.essential) || worth(b) - worth(a) || a.key.localeCompare(b.key));
  x.ranked.forEach((c, i) => x.rank.set(c.key, i));
  // Saving up: the best option the budget cannot pay yet, if it is close enough in income, holds back everything worth less.
  const income = I10(s) / 10, land = landOption(s, x), fieldsFull = x.k.every(t => !t.owned || t.empty === 0);
  const opts = [...x.ranked.filter(c => !c.essential && c.econ.known), ...(land && land.econ.known && fieldsFull ? [land] : [])].sort((a, b) => worth(b) - worth(a));
  const top = opts[0];
  if (top && top.cost > x.budget && top.cost - x.budget <= income * FM.savingMin && top.econ.payback <= paybackLimit(x, top.econ)) x.saving = top;
  x.land = land;
  return x;
}
const buildAct = c => c.act?.type === 'build/place' || c.act?.type === 'build/upgrade';
const hireAct = c => c.act?.type === 'staff/recruit' || c.act?.type === 'staff/hire';
const landAct = c => c.act?.type === 'land/buyParcel';
/** Why a land purchase must wait, in the brief's order; null = may go ahead. */
function landBlock(x, c) {
  const row = x.k.find(t => ESTATES[t.id].lots.includes(c.act.payload.parcelId)), owned = x.k.filter(t => t.owned);
  if (row?.unlockError && row.unlockError !== 'coins') return 'locked';
  if (row && !row.crops.length) return 'noCrop';
  const plots = owned.reduce((n, t) => n + t.plots, 0), planted = owned.reduce((n, t) => n + t.planted, 0);
  const rich = x.s.player.coins >= c.cost * 2 && planted >= 6; // farm-crew.md §14: idle money opens the next tier
  if (plots > 0 && planted / plots < x.m.landUse && !rich) return 'underused';
  if (!crewOf(x.s).some(u => doesJob(u, 'plant') || doesJob(u, 'harvest'))) return 'noCrew';
  return null;
}
/** The Lv10 incident is close (FM.incidentLoanLevels or fewer levels left, first region only): the loans survive the
 *  incident but the land and buildings they would buy do not, so the manager never borrows then (QA 2026-11-09: the
 *  delegate's manager took 1000 at Lv6 and reached Lv10 17 % faster than main, then carried the debt into a 60-coin restart). */
export function incidentNear(s) {
  return EXPIRY_ENABLED && !s.story?.level10Done && EXPIRY_LEVEL - level(s) <= FM.incidentLoanLevels;
}
/**
 * Why this candidate may not run now (a reason code), or null. Only capital spending is gated: care, operations and sales
 * keep their own rules. `perm` is D.gmPermission's answer ('loan' = paid with a loan, so the cash check does not apply).
 */
export function gate(s, c, x, perm) {
  if (c.zone !== 'farm') return null; // the café is a separate game with its own rules
  if (c.act?.type === 'land/sell') return perm === 'do' ? 'sellAsk' : null; // valuable assets are never sold without you
  if (c.group !== 'capital' || !(c.cost > 0) || c.act?.type === 'loan/repay') return null;
  const { f } = x, e = c.econ || econOf(s, c, x);
  if (buildAct(c) && !f.build) return 'buildOff';
  if (landAct(c) && !f.land) return 'landOff';
  if (hireAct(c) && !f.hire) return 'hireOff';
  if (x.recovery && !c.essential) return 'recovery';
  if (perm === 'loan' && (!x.m.loan || x.recovery)) return 'noLoan';
  if (perm === 'loan' && incidentNear(s)) return 'incidentLoan';
  if (perm !== 'loan') {
    if (c.essential ? s.player.coins - c.cost < f.minReserve : c.cost > x.budget) return 'reserve';
  }
  const win = s.gm.window, spent = win && x.now - win.start < GM.windowMinutes * 60000 ? win.spent : 0;
  if (f.spendLimit > 0 && spent + x.committed + c.cost > f.spendLimit) return 'limit';
  if (!c.essential && e.known && (e.payback > paybackLimit(x, e) || e.net <= 0)) return 'payback';
  // No formula for what it earns (shade, extra team upgrades): only with real profit and no debt.
  if (!c.essential && !e.known && e.cat !== 'other' && (x.net <= 0 || x.owed > 0)) return 'noProfit';
  if (landAct(c)) { const why = landBlock(x, c); if (why) return why; }
  if (!c.essential && x.saving && x.saving.key !== c.key && (!e.known || e.flow / e.invest < x.saving.econ.flow / x.saving.econ.invest)) return 'saving';
  return null;
}
/** A job passed the gate and is going ahead: its coins are no longer available to the jobs after it. */
export function reserveBudget(x, c) { x.budget = Math.max(0, x.budget - (c.cost || 0)); x.committed += c.cost || 0; }

function bottlenecks(s, x) {
  const out = [], plots = x.k.reduce((n, t) => n + t.plots, 0), planted = x.k.reduce((n, t) => n + t.planted, 0), crew = crewOf(s), has = j => crew.some(u => doesJob(u, j));
  const cap = capacity(s), pct = cap > 0 ? stored(s) / cap : 0, wells = buildingsOf(s, 'well').length, ripe = x.k.reduce((n, t) => n + t.ripe, 0), empty = x.k.reduce((n, t) => n + t.empty, 0), dry = x.k.reduce((n, t) => n + t.dry, 0);
  if (!plots) out.push({ code: 'noFields' });
  if (!storeBuildings(s).length && planted) out.push({ code: 'noStore' });
  if (!wells && (has('water') || dry > 0)) out.push({ code: 'noWater' });
  if (pct >= .9) out.push({ code: 'storageFull', pct: Math.round(pct * 100) });
  if (farmOverloaded(s, x.now)) out.push({ code: 'tooManyFields', n: ripe, picks: Math.round(farmPicksPerMin(s)) });
  if (ripe >= 6) out.push({ code: 'ripeWaiting', n: ripe, tier: x.k.slice().sort((a, b) => b.ripe - a.ripe)[0].t + 1 });
  if (empty >= 6) out.push({ code: 'emptyFields', n: empty });
  if (has('water') && wells) for (const t of x.k) if (t.planted >= FM.water.extraMinFields && t.wellFields / Math.max(1, t.plots) < FM.water.extraUncovered) out.push({ code: 'waterFar', tier: t.t + 1 });
  for (const t of x.k) if (t.badCrops >= 3) out.push({ code: 'wrongCrop', tier: t.t + 1, n: t.badCrops });
  return out.slice(0, 6);
}
function objectiveOf(s, x, blocks) {
  if (x.off) return ['off', {}];
  if (x.recovery) return ['recovery', { coins: Math.round(x.reserve) }];
  const b = blocks[0];
  if (b) return [`fix.${b.code}`, b];
  if (x.saving) return ['saving', { cat: x.saving.econ.cat, coins: Math.round(x.saving.cost - x.budget) }];
  const land = x.land;
  if (land && land.cost > x.budget && land.econ.payback <= paybackLimit(x, land.econ)) return ['landWait', { tier: ESTATE_ORDER.indexOf(land.estate) + 1, coins: Math.round(land.cost - x.budget) }];
  return [x.ranked[0] ? 'invest' : 'run', {}];
}
function calibrate(s, x) {
  const earned = incomeEarned(s, 10), f = s.gm.fm, C = FM.calib, stock = sellAllQuote(s).coins || 0;
  if (playedMs(s) < 600000 || !(x.farmFlow > 1)) return false;
  // Sales wait for your signature, so unsold goods say nothing about the forecast: drift back to neutral instead of learning "the farm earns little".
  const seen = stock >= earned ? 1 : earned / 10 / x.farmFlow;
  if (stock < earned && !(earned > 0)) return false;
  const next = Math.max(C.min, Math.min(C.max, (f.calib ?? 1) * (1 - C.ema) + seen * C.ema));
  if (Math.abs(next - (f.calib ?? 1)) < .01) return false;
  f.calib = r2(next);
  return true;
}
/** The strategic layer: at most every FM.planEverySec played seconds, stores the objective and the bottlenecks. True when it changed. */
export function refreshPlan(s, now, x) {
  const f = s.gm.fm, P = playedMs(s);
  if (f.plan && P - f.plan.at < FM.planEverySec * 1000) return false;
  const cal = calibrate(s, x), blocks = bottlenecks(s, x), [objective, params] = objectiveOf(s, x, blocks), first = x.ranked[0] || x.land || null;
  const top = first ? { cat: first.econ.cat, cost: Math.round(first.cost), flow: first.econ.flow, payback: Number.isFinite(first.econ.payback) ? first.econ.payback : null, net: first.econ.net, roi: first.econ.roi, known: first.econ.known, reason: first.reason || null, estate: first.estate || null } : null;
  const next = { objective, params, blocks, top, recovery: x.recovery };
  const was = f.plan ? { objective: f.plan.objective, params: f.plan.params, blocks: f.plan.blocks, top: f.plan.top, recovery: f.plan.recovery } : null;
  f.plan = { at: P, ...next };
  return cal || JSON.stringify(next) !== JSON.stringify(was);
}
/** One decision record (bounded; the same job with the same outcome is written once per FM.logRepeatMin). True when written. */
export function note(s, now, c, code, x, outcome = 'blocked') {
  const f = s.gm.fm, log = (f.log ||= []), P = playedMs(s);
  const key = `${c.key}|${code}`;
  if (log.some(e => e.k === key && P - e.p < FM.logRepeatMin * 60000)) return false;
  const e = c.econ;
  log.push({ k: key, p: P, at: now, code, outcome, act: c.act?.type || '', type: c.act?.payload?.type || null, cost: Math.round(c.cost || 0), reason: c.reason || null,
    ...(e ? { cat: e.cat, flow: e.flow, payback: Number.isFinite(e.payback) ? e.payback : null, net: e.net, roi: e.roi, known: e.known, tier: e.tier } : {}) });
  if (log.length > FM.logKeep) f.log = log.slice(-FM.logKeep);
  return true;
}
/** Still allowed when a crew member arrives to carry out a queued order (the settings may have changed on the way). */
export function orderAllowed(s, o) {
  const f = fmOf(s);
  if (!f.auto || s.player.coins - (o.cost || 0) < f.minReserve) return false;
  if (o.act?.type === 'land/buyParcel') return f.land;
  if (o.act?.type?.startsWith('build/')) return f.build;
  return true;
}

// ---------- read models for the dashboard ----------
/** Everything the manager panel shows. Pure; the panel memoises it (it calls farmKnowledge once). */
export function dashboardOf(s, now, list) {
  const x = thinkContext(s, now, list), flow = cashFlow(s, now, 10), f = fmOf(s), stock = Math.round(sellAllQuote(s).coins || 0);
  const planted = x.k.reduce((n, t) => n + t.planted, 0), spentAll = incomeRows(s, 10).reduce((n, r) => n + (r.spent || 0), 0), opex = flow.spent / 10;
  const potential = x.farmFlow, measured = flow.earned / 10 - opex, base = measured > 0 ? measured : potential - opex;
  const whyLoss = measured > 0 ? 'ok' : !planted ? 'noPlanted' : !f.autoSell && stock > 0 && flow.earned < stock ? 'unsold' : x.labour < .6 ? 'labour' : potential <= opex ? 'tooFew' : 'starting';
  let landWhy = null;
  if (x.land) { const c = { ...x.land, zone: 'farm', group: 'capital', essential: false }; landWhy = s.player.coins < c.cost ? 'cash' : gate(s, c, x, 'do') || (list.some(q => q.rule === 'landBuy') ? 'ready' : 'waitFields'); }
  const money = { owed: Math.round(x.owed), stock, worth: Math.round(s.player.coins + stock - x.owed), earned: r2(flow.earned / 10), opex: r2(opex), invest: r2(Math.max(0, spentAll / 10 - opex)), net: r2(measured), potential: r2(potential), whyLoss, payoffMin: x.owed > 0 && base > 0 ? Math.ceil(x.owed / base) : null, payoffMeasured: measured > 0, labour: Math.round(x.labour * 100) };
  return { settings: f, reserve: Math.round(x.reserve), committed: Math.round(x.committed), budget: Math.round(x.budget), coins: Math.round(s.player.coins), flow, recovery: x.recovery, tiers: x.k, plan: f.plan, need: farmStaffing(s, now), handsPerMin: s.gm?.unit && f.auto ? Math.round(gmHandsPerMin(s.gm.unit)) : 0, money, landWhy, nextTier: x.land ? ESTATE_ORDER.indexOf(x.land.estate) : -1,
    wells: buildingsOf(s, 'well').length, dry: x.k.reduce((n, t) => n + t.dry, 0), orders: (s.gm?.orders || []).length, log: [...(f.log || [])].reverse().slice(0, 14), mode: f.mode, away: f.away || null,
    queue: taskBoard(s, now).reduce((n, q) => { n[q.type] = (n[q.type] || 0) + 1; return n; }, {}) };
}
/** The global task list as a bounded read model: { id, type, tier, plotId, job, secs, value, age, needs }. */
export function taskBoard(s, now, max = 200) {
  const r = region(s);
  if (!r) return [];
  const out = [], pj = perJob(s, 'farm'), wells = buildingsOf(s, 'well').length;
  const add = (type, job, p, ageMin, needs = []) => out.push({ id: `${type}:${p.id}`, type, job, tier: tierIndexAt(p.x, p.z), plotId: p.id, value: r2(pj * (FM.jobValue[job] ?? .1)), age: r2(ageMin), needs, score: (FM.jobValue[job] ?? .1) * 10 + Math.min(10, ageMin) });
  for (const p of ownedPlots(s)) {
    const pl = r.plots[p.id];
    if (!pl) { add('plant', 'plant', p, 0); continue; }
    const st = plotState(s, p.id, now);
    if (st.stage === 'ready') add('harvest', 'harvest', p, 1);
    else if (!pl.watered && !dripCovers(s, p.id)) add('water', 'water', p, (now - pl.plantedAt) / 60000, wells ? [] : ['well']);
  }
  for (const o of s.gm?.orders || []) out.push({ id: o.id, type: o.job, job: o.job, tier: Number.isFinite(o.act.payload?.x) ? tierIndexAt(o.act.payload.x, o.act.payload.z) : null, plotId: null, value: 0, age: 0, needs: [], score: 5 });
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, max);
}
