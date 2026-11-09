#!/usr/bin/env node
// Farm manager harness: drives the REAL reducer (apply in src/core/game.js) headless and deterministically, to compare
// who runs the farm: a tapping player, a small rule-based farmer, a fixed build order, or the manager.
//
//   node scripts/manager-sim.mjs --policy v2 --profile all --minutes 60 --seeds 3 --json out.json
//   node scripts/manager-sim.mjs --policy all --profile overloaded --minutes 15 --seeds 1
//   node scripts/manager-sim.mjs --policy v3 ...            (once fm.planner exists; refused with a clear message before that)
//   node scripts/manager-sim.mjs --fm workSplit=value ...   (any gm/fmSet key, sent right after the manager is hired)
//   node scripts/manager-sim.mjs --determinism              (runs a short set twice and compares the final-state digests)
//   node scripts/manager-sim.mjs --check-tests              (npm test against docs/ai-manager/stale-tests-baseline.txt)
//
// Every state change goes through apply(). The script holds only what the game itself keeps outside the save:
// the realm layer (src/features/realm/staff.js), which cannot be imported here because it builds three.js meshes.
// SimUnit below is a line-for-line port of staff.js farmJob / maybeGoof / startJob / finish / update / tickUnit / teamTimers
// / gmTimers. If staff.js job selection changes, change it here too (each block names its staff.js function).
// Known approximations (docs/ai-manager/BASELINE.md): walking uses farmRouteDist, not the nav grid (no obstacles, steering
// or stuck detection); wander ignores canStand / farmFree; cafe units are not simulated (no farm profile has any).
import { isMainThread, parentPort, workerData, Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { apply } from '../src/core/game.js';
import { createSave, normalizeSave } from '../src/core/state.js';
import * as D from '../src/core/derive.js';
import { managerCropFor } from '../src/core/farm-manager.js';
import { BUILDINGS, STAFF, CROPS, GOODS, CREW, GM, CLOCK, RIVAL, BOOKS, STAFF_SIM, FARM_MANAGER, SOFTWARE, ROBOT_TASKS,
  unitSpeed, craftSpeed, gearWalk, gearJob, batteryMinutes, hasRule, knows, mistakeChance, isHardCrop, funnyRoll, goofRoll, goofHold, gmCalmMul, jamChance, hasSoftware, robotTask, partTier, doesJob, energyMax } from '../src/core/config/economy.js';
import { ESTATES, ESTATE_ORDER, PARCELS, farmRouteDist, tierIndexAt } from '../src/core/config/layout.js';
import { allows, TICKS, vitalsInterval, vitalsNoop, timerDue, poseOf } from '../src/features/realm/staff-brain.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const T0 = 1_800_000_000_000; // simulated wall clock at the start of every run
const THINK = 0.35, SKIP_FLUSH = 30, CROWD_R = 3, CROWD_COST = 5, TIER_AWAY = 40, TAP_SECONDS = 1.2, ACTIVE_CROP = 'robusta';
const WALK_MUL = 1; // nav paths are at least farmRouteDist; 1 = the estimate the realm itself uses to choose jobs

// ---------- determinism ----------
// The reducer and derive read Date.now() through default arguments (buyerNow, supply): they get the simulated clock.
// Math.random must never run in core logic: it is replaced so a stray call stays reproducible, and every call is counted.
let simNow = T0, coreRandomCalls = 0, coreRandomRng = () => 0.5;
Date.now = () => simNow;
Math.random = () => { coreRandomCalls++; return coreRandomRng(); };
const hashStr = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const num = v => (Number.isFinite(v) ? v : 0);
const r2 = v => Math.round(v * 100) / 100;
const r0 = v => Math.round(v);

// ---------- placement lattice shared by profiles and scripted policies ----------
// Bands of the four terraces (layout.js TIER_EDGES), kept away from the walls: placementError is the judge of every spot.
const TIER_BAND = [[27, -1.7], [-3.4, -19.6], [-21.4, -45.5], [-53, -75]];
const fieldSpots = t => { const [top, bottom] = TIER_BAND[t], out = []; for (let z = top; z >= bottom; z = r2(z - 1.6)) for (let x = -30; x <= 30; x = r2(x + 1.6)) out.push({ x, z }); return out; };
const FIELD_LATTICE = [0, 1, 2, 3].map(fieldSpots);
function nextFieldSpot(s, tier, cursor) {
  const list = FIELD_LATTICE[tier];
  for (; cursor[tier] < list.length; cursor[tier]++) { const q = list[cursor[tier]], sn = D.snapPosition('field', q.x, q.z, 0); if (!D.placementError(s, 'field', sn.x, sn.z, 0)) return sn; }
  return null;
}
function nextBuildSpot(s, type, tier) {
  const [top, bottom] = TIER_BAND[tier];
  for (let z = top - 1; z >= bottom; z -= 1) for (let x = 28; x >= -28; x -= 1.5) { const sn = D.snapPosition(type, x, z, 0); if (!D.placementError(s, type, sn.x, sn.z, 0)) return sn; }
  return null;
}

// ---------- profiles: built through apply(), identical for every policy and seed ----------
class Builder {
  constructor() {
    this.now = T0 - 3600_000; this.state = createSave(this.now, { gender: 'female', name: 'Bot' }); this.cursor = [0, 0, 0, 0];
    this.act('story/introDone'); this.act('story/teacherDone'); this.act('world/unlockRegion', { regionId: 'vn-1' }); this.act('world/enterRegion', { regionId: 'vn-1', game: 'farm' });
  }
  act(type, payload = {}) { simNow = this.now; const r = apply(this.state, { type, payload }, { now: this.now, dev: true }); if (!r.ok) throw new Error(`profile: ${type} ${JSON.stringify(payload)} failed: ${r.error} ${JSON.stringify(r.data ?? '')}`); if (r.state) this.state = r.state; return r; }
  level(level) { this.act('dev/set', { coins: 1e7, level }); return this; }
  estates(n) { this.act('dev/set', { coins: 1e7, level: D.level(this.state) }); for (let i = 1; i < n; i++) this.act('land/buyParcel', { parcelId: ESTATES[ESTATE_ORDER[i]].seed }); return this; }
  build(type, tier = 0) { const q = nextBuildSpot(this.state, type, tier); if (!q) throw new Error(`profile: no spot for ${type} on tier ${tier}`); this.act('build/place', { type, x: q.x, z: q.z, rot: 0 }); return this; }
  // n fields on a tier, planted with `crop(i)`, ages (ms before the start) from `age(i)`; crop(i) null = left empty.
  fields(tier, n, crop = () => 'robusta', age = i => 5000 * (i % 8)) {
    for (let i = 0; i < n; i++) {
      const q = nextFieldSpot(this.state, tier, this.cursor); if (!q) throw new Error(`profile: tier ${tier} is out of field spots at ${i}`);
      this.act('build/place', { type: 'field', x: q.x, z: q.z });
      const c = crop(i); if (!c) continue;
      const id = D.region(this.state).fields.at(-1).id, was = this.now;
      this.now = T0 - age(i); this.act('farm/plant', { plotId: id, crop: c }); this.now = was;
    }
    return this;
  }
  hire(type, n = 1) { for (let i = 0; i < n; i++) this.act('staff/hire', { type }); return this; }
  // Gifts for the set level are opened now so no policy gets a windfall; coins and beans are then set to the profile's values.
  finish({ coins, beans = 0, loans = [] }) {
    for (let guard = 0; guard < 200 && D.pendingGifts(this.state).length; guard++) this.act('level/claim', { roll: 0.5 });
    for (const amount of loans) this.act('loan/take', { amount });
    this.act('dev/set', { coins, beans, level: D.level(this.state) });
    this.now = T0; this.act('clock/tick', { ms: 5000 });
    const out = normalizeSave(JSON.parse(JSON.stringify(this.state)), T0); // proves the profile survives a real save / load
    if (!out) throw new Error('profile: normalizeSave refused it');
    return out;
  }
}
const wave = (ripe, of) => i => (i % of < ripe ? 400_000 : 3000 * (i % 7)); // ripe of every `of` fields, the rest recently started
const PROFILES = {
  newPlayer: () => new Builder().finish({ coins: 60 }),
  midTwoTerraces: () => new Builder().estates(2).level(6)
    .build('silo', 0).build('well', 0).build('well', 1).build('dryer', 0)
    .fields(0, 12).fields(1, 12).hire('picker', 2).hire('planter').hire('waterer').finish({ coins: 1200 }),
  fourTerraces: () => new Builder().estates(4).level(10)
    .build('silo', 0).build('silo', 0).build('well', 0).build('well', 1).build('well', 2).build('well', 3).build('dryer', 0).build('wetMill', 1)
    .fields(0, 16).fields(1, 16).fields(2, 16, () => 'robusta').fields(3, 16, () => 'arabica').hire('picker', 4).hire('planter', 2).hire('waterer', 2).finish({ coins: 4000 }),
  waterShortage: () => new Builder().estates(2).level(5).build('silo', 0).fields(0, 15).fields(1, 15).hire('waterer', 4).hire('picker', 2).hire('planter').finish({ coins: 150 }),
  workerShortage: () => new Builder().estates(2).level(6).build('silo', 0).build('well', 0).build('well', 1).fields(0, 30, () => 'robusta', wave(1, 2)).fields(1, 30, () => 'robusta', wave(1, 2)).hire('picker').finish({ coins: 800 }),
  financialCrisis: () => new Builder().level(5).build('silo', 0).fields(0, 18).hire('picker').hire('planter').finish({ coins: 40, loans: [5000, 2000] }),
  largeCash: () => new Builder().level(8).build('silo', 0).fields(0, 18).hire('picker', 2).hire('planter').finish({ coins: 100000 }),
  unprofitableCrops: () => new Builder().estates(2).level(6).build('silo', 0).build('well', 0).fields(0, 15, () => 'arabica').fields(1, 15, () => 'arabica').hire('picker', 2).hire('planter').finish({ coins: 500 }),
  heavyConstruction: () => new Builder().estates(3).level(7).fields(0, 12).hire('builder').hire('surveyor').hire('picker').hire('planter').finish({ coins: 30000 }),
  overloaded: () => new Builder().estates(4).level(20)
    .build('silo', 0).build('silo', 0).build('well', 0).build('well', 2)
    .fields(0, 170, () => 'liberica', wave(3, 5)).fields(1, 170, () => 'robusta', wave(3, 5)).fields(2, 140, () => 'robusta', wave(3, 5)).fields(3, 140, () => 'arabica', wave(3, 5))
    .hire('picker', 3).hire('planter').hire('waterer').finish({ coins: 3000 }),
};
const profileCache = new Map();
function profileState(name) {
  if (!PROFILES[name]) throw new Error(`unknown profile ${name}; known: ${Object.keys(PROFILES).join(', ')}`);
  if (!profileCache.has(name)) profileCache.set(name, PROFILES[name]());
  return structuredClone(profileCache.get(name));
}

// ---------- what a farm is worth ----------
const statValue = u => Object.values(u.stats || {}).reduce((n, v) => n + 50 * Math.max(0, (v | 0) - 1) * (v | 0), 0);
function capitalOf(s) {
  let v = 0;
  for (const r of Object.values(s.world.regions || {})) for (const b of r.buildings || []) { const def = BUILDINGS[b.type]; if (def && !def.starter) v += D.spentOn(b); }
  const r = D.region(s);
  if (r) for (const id of ESTATE_ORDER) if (D.estateOwned(s, id)) v += ESTATES[id].cost; // what the estate cost, not the sum of lot prices (rulebook, sim drift 12)
  for (const u of s.staff.units) v += (u.paid || 0) + (u.partsSpent || 0) + (u.softwareSpent || 0) + (u.gearSpent || 0) + statValue(u);
  return v;
}
function stockOf(s) {
  let v = D.sellAllQuote(s).coins || 0;
  const r = D.region(s);
  if (r) {
    for (const pl of Object.values(r.plots || {})) for (const [c, n] of Object.entries(pl?.pile || {})) v += n * D.beanPrice(c);
    for (const b of r.buildings || []) if (b.job) { for (const [g, n] of Object.entries(b.job.out || {})) v += n * (GOODS[g]?.price || 0); v += b.job.premium || 0; }
  }
  for (const u of s.staff.units) for (const [c, n] of Object.entries(u.cargo || {})) v += n * D.beanPrice(c);
  return v;
}
const debtOf = s => D.loanTotal(s) + (s.debt?.wages?.gm || 0) + (s.debt?.wages?.follower || 0);
const worthOf = s => { const cash = s.player.coins, stock = stockOf(s), capital = capitalOf(s), debt = debtOf(s); return { cash, stock, capital, debt, assets: cash + stock + capital, netWorth: cash + stock + capital - debt }; };

// ---------- invariants: what apply() must never do ----------
function forbids(s, type, p, now) { // the derive.js error function for this action, read BEFORE apply
  const r = D.region(s), bld = uid => r?.buildings?.find(b => b.uid === uid), unit = uid => D.unitOf(s, uid);
  switch (type) {
    case 'build/place': { const e = D.buildError(s, p.type); if (e) return e; const q = D.snapPosition(p.type, p.x, p.z, p.rot || 0); return D.placementError(s, p.type, q.x, q.z, p.rot || 0); }
    case 'build/upgrade': return bld(p.uid) ? D.upgradeError(s, bld(p.uid)) : 'unknown';
    case 'land/buyParcel': return D.parcelError(s, p.parcelId);
    case 'staff/hire': return D.staffError(s, p.type);
    case 'staff/recruit': return D.recruitError(s, p.zone, p.index);
    case 'staff/care': return unit(p.uid) ? D.careError(s, unit(p.uid), p.kind, now) : 'unknown';
    case 'prod/start': return bld(p.uid) ? D.prodError(s, bld(p.uid)) : 'unknown';
    case 'prod/collect': return bld(p.uid) ? D.collectError(s, bld(p.uid), now) : 'unknown';
    case 'loan/take': return D.loanError(s, p.amount);
    case 'farm/plant': return r?.plots[p.plotId] ? 'occupied' : D.seedCost(s, p.crop) > s.player.coins ? 'coins' : null;
    case 'farm/harvest': return !r?.plots[p.plotId] ? 'empty' : D.plotState(s, p.plotId, now).stage !== 'ready' ? 'notReady' : D.stored(s) >= D.capacity(s) ? 'storageFull' : null;
    default: return null;
  }
}
const OVERFILL_OK = new Set(['clock/tick', 'level/claim', 'farm/uproot']); // these add goods without a storage check, by design
function stateViolations(prev, s, type, res, sim) {
  const out = [], coins = s.player.coins;
  if (!Number.isFinite(coins) || coins < 0) out.push(`coins=${coins}`);
  if (!Number.isFinite(s.player.xp)) out.push('xp not finite');
  const inv = s.inventory;
  if (!Number.isFinite(inv.beans) || inv.beans < 0) out.push(`beans=${inv.beans}`);
  for (const [g, n] of Object.entries(inv.items || {})) if (!Number.isFinite(n) || n < 0) out.push(`${g}=${n}`);
  const mix = Object.values(inv.beanMix || {}).reduce((a, b) => a + b, 0);
  if (Math.abs(mix - inv.beans) > 1e-6) out.push(`beanMix ${mix} != beans ${inv.beans}`);
  const before = D.stored(prev), after = D.stored(s), cap = D.capacity(prev);
  if (after > before && before >= cap && !OVERFILL_OK.has(type) && !(type === 'gm/hands' && res.events?.some(e => e.type === 'uprooted'))) out.push(`goods added over capacity ${before}->${after}/${cap}`);
  const zone = D.zoneUnits(s, 'farm');
  if (zone.length > 30) out.push(`crew ${zone.length} > 30`);
  if (zone.filter(u => STAFF[u.type]?.kind === 'robot').length > 15) out.push('robots > 15');
  if (Number(D.loanTotal(s)) < 0) out.push('negative debt');
  // Purchases made inside gm/think and gm/execute never pass through the checks above: read them back from the result.
  if (type === 'gm/think' || type === 'gm/execute' || type === 'gm/hands') {
    const a = D.region(prev), b = D.region(s);
    if (a && b) {
      const had = new Set((a.fields || []).map(f => f.id));
      for (const f of b.fields || []) if (!had.has(f.id)) { const e = D.placementError(s, 'field', f.x, f.z, 0, f.id); if (e) out.push(`field ${f.id} placed illegally: ${e}`); }
      const hadB = new Set((a.buildings || []).map(x => x.uid));
      for (const x of b.buildings || []) if (!hadB.has(x.uid)) { const e = D.placementError(s, x.type, x.x, x.z, x.rot || 0, x.uid); if (e) out.push(`${x.type} ${x.uid} placed illegally: ${e}`); }
      const seq = ESTATE_ORDER.map(id => D.estateOwned(s, id)); if (seq.some((v, i) => v && i > 0 && !seq[i - 1])) out.push('estates bought out of order');
    }
  }
  // One job per unit is structural (e.job is a single slot); this checks the claims the jobs hold.
  const held = new Map();
  for (const e of sim.units.values()) {
    for (const k of e.claims) { if (held.has(k) && held.get(k) !== e.uid) out.push(`claim ${k} held by ${held.get(k)} and ${e.uid}`); held.set(k, e.uid); if (sim.claims.get(k) !== e.uid) out.push(`claim ${k} of ${e.uid} is not in the claims map`); }
    if (e.job?.plotId && sim.claims.get(`plot:${e.job.plotId}`) !== e.uid) out.push(`job of ${e.uid} on ${e.job.plotId} has no claim`);
  }
  return out;
}

// ---------- the simulation ----------
class Sim {
  constructor({ profile, policy, seed, minutes, dt, fm }) {
    Object.assign(this, { profileName: profile, policyName: policy, seed, minutes, dt, fmSettings: fm || {} });
    this.rngs = new Map();
    this.now = T0; simNow = T0;
    coreRandomCalls = 0; coreRandomRng = this.rng('core');
    this.state = profileState(profile);
    this.claims = new Map(); this.units = new Map(); this.dirty = true;
    this.plotMemo = { at: 0, m: new Map() };
    this.timers = { upkeep: 0, rival: 0, mvp: 0, boss: 0, clock: 0, loan: 0, gmThink: 0, gmPay: 0, gmRival: 0, gmHands: 0, seen: 0, started: false };
    this.tapT = 0; this.investT = 0; this.careT = 0; this.giftT = 0; this.pol = {};
    this.m = { applyN: 0, applyMs: 0, applyMax: 0, applyByType: {}, fails: {}, invalid: 0, invalidBy: {}, violations: 0, samples: [], throws: 0, events: {}, gmGate: {}, gmSeen: new Set(), gifts: 0,
      time: { work: 0, walk: 0, goof: 0, idle: 0, blocked: 0, bench: 0 }, idleReasons: {}, jobs: {}, water: { trips: 0, pours: 0, wasted: 0, bucketSum: 0, fetchWalk: 0, pourWalk: 0, noWellSec: 0 }, milestones: {}, series: [], walked: 0, coinFlow: {} };
    this.startWorth = worthOf(this.state);
    this.start = { harvested: this.state.stats?.harvested || 0, planted: this.state.stats?.planted || 0, earned: this.state.stats?.earned || 0, sold: this.state.stats?.sold || 0 };
    this.policy = POLICIES[policy]; if (!this.policy) throw new Error(`unknown policy ${policy}; known: ${Object.keys(POLICIES).join(', ')}`);
  }
  rng(name) { if (!this.rngs.has(name)) this.rngs.set(name, mulberry(hashStr(`${this.seed}:${this.profileName}:${name}`))); return this.rngs.get(name); }
  rand(name) { return this.rng(name)(); }

  act(type, payload = {}, meta = {}) {
    simNow = this.now;
    const m = this.m, before = this.state;
    const pre = forbids(before, type, payload, this.now);
    const t0 = performance.now();
    let res;
    try { res = apply(before, { type, payload }, { now: this.now, dev: false }); } catch (err) { m.throws++; if (m.samples.length < 30) m.samples.push(`${type} threw: ${err.message}`); return { ok: false, error: 'throw' }; }
    const ms = performance.now() - t0;
    m.applyN++; m.applyMs += ms; m.applyMax = Math.max(m.applyMax, ms);
    const row = (m.applyByType[type] ||= { n: 0, ms: 0, max: 0 }); row.n++; row.ms += ms; row.max = Math.max(row.max, ms);
    if (!res.ok) {
      const code = `${type}:${res.error}`; m.fails[code] = (m.fails[code] || 0) + 1;
      if (meta.policy) { m.invalid++; m.invalidBy[code] = (m.invalidBy[code] || 0) + 1; }
      return res;
    }
    if (type === 'gm/execute' && res.noop) { m.invalid++; m.invalidBy['gm/execute:noop'] = (m.invalidBy['gm/execute:noop'] || 0) + 1; }
    if (res.noop || res.duplicate || res.state === before) return res;
    this.state = res.state; this.dirty = true;
    { const dc = res.state.player.coins - before.player.coins; if (dc) m.coinFlow[type] = (m.coinFlow[type] || 0) + dc; }
    if (pre && pre !== 'owned') this.violation(`${type} succeeded but ${pre} forbids it: ${JSON.stringify(payload)}`);
    for (const v of stateViolations(before, res.state, type, res, this)) this.violation(`${type}: ${v}`);
    for (const e of res.events || []) m.events[e.type] = (m.events[e.type] || 0) + 1;
    if (type === 'level/claim') m.gifts += res.state.player.coins - before.player.coins;
    if (type === 'gm/think') this.readGateLog();
    return res;
  }
  violation(text) { this.m.violations++; if (this.m.samples.length < 30) this.m.samples.push(`t=${r0((this.now - T0) / 1000)}s ${text}`); }
  // Why the manager did or did not act: gm/think's own decision log (bounded and de-duplicated in the save) added up over the run.
  readGateLog() {
    const log = this.state.gm?.fm?.log; if (!log) return;
    for (const e of log) {
      const id = `${e.k}|${e.p}`; if (this.m.gmSeen.has(id)) continue;
      this.m.gmSeen.add(id);
      this.m.gmGate[e.code] = (this.m.gmGate[e.code] || 0) + 1;
      if (e.outcome === 'failed') { this.m.invalid++; this.m.invalidBy[`gm:${e.act}`] = (this.m.invalidBy[`gm:${e.act}`] || 0) + 1; }
    }
  }

  // --- staff.js sync / applyState ---
  sync() {
    const s = this.state, seen = new Set();
    D.assignedUnits(s, s.world.currentRegion, 'farm').forEach((u, i) => {
      seen.add(u.uid);
      let e = this.units.get(u.uid);
      if (!e) {
        const idle = idleSpot(i);
        e = { uid: u.uid, type: u.type, kind: STAFF[u.type].kind, slot: i, x: idle.x, z: idle.z, home: idle, job: null, think: this.rand('think') * THINK, water: 0, claims: [],
          st: 'ok', pose: 'work', bench: false, blocked: false, working: undefined, stateK: 1, stopped: null, stT: 0, vT: this.rand('vitals') * TICKS.vitalsSeconds, vWork: 0, vRest: 0, vJobs: 0, heldS: 0, dueKey: null,
          workT: 0, xpN: 0, xpT: 0, xpTask: null, wander: null, leg: null, speedK: 1, reason: null };
        this.units.set(u.uid, e);
      }
      e.u = u; e.slot = i;
      this.applyState(e);
    });
    for (const [uid, e] of this.units) if (!seen.has(uid)) { this.release(e); this.units.delete(uid); }
    this.dirty = false;
  }
  applyState(e) {
    const u = e.u, now = this.now, wasStopped = e.stopped, wasWorking = e.working;
    e.st = D.unitState(u, now); e.blocked = D.unitBlocked(u, now); e.bench = u.active === false; e.working = !e.bench && !e.blocked;
    e.stateK = e.blocked ? 1 : D.stateSpeedMul(u, now);
    e.pose = poseOf(e.st, e.bench, e.blocked, u.energy ?? 100);
    e.stopped = e.pose === 'stop' ? u.stopped || { kind: e.st } : null;
    if (e.stopped && !wasStopped) this.endJob(e);
    if (!e.stopped && wasStopped) e.workT = 0; // resumed(): any stop ending refills the battery timer
    if (wasWorking && !e.working) this.endJob(e);
  }
  claim(e, key) { if (this.claims.has(key) && this.claims.get(key) !== e.uid) this.violation(`claim ${key} taken by ${e.uid} while held by ${this.claims.get(key)}`); this.claims.set(key, e.uid); e.claims.push(key); }
  release(e) { for (const k of e.claims) if (this.claims.get(k) === e.uid) this.claims.delete(k); e.claims = []; }
  endJob(e) {
    if (e.leg) { const L = e.leg, f = L.total > 0 ? 1 - L.left / L.total : 1; e.x = L.fx + (L.x - L.fx) * f; e.z = L.fz + (L.z - L.fz) * f; e.leg = null; }
    this.release(e); e.job = null;
  }
  claimed(key) { return this.claims.has(key); }
  plotState(s, id, now) { // staff.js plotState: one read per plot per quarter second
    if (now - this.plotMemo.at > 250) this.plotMemo = { at: now, m: new Map() };
    let v = this.plotMemo.m.get(id);
    if (!v) { v = D.plotState(s, id, now); this.plotMemo.m.set(id, v); }
    return v;
  }

  // --- staff.js job selection ---
  taskOf(e) { if (e.kind !== 'robot') return null; const t = robotTask(e.u); return t === 'auto' ? (ROBOT_TASKS[e.type]?.[0] || null) : t; }
  rule(e, name) { return e.kind === 'worker' && hasRule(e.u, name); }
  takes(e, type) { return e.kind === 'robot' ? (this.taskOf(e) || type) === type : STAFF[e.type]?.jobs ? STAFF[e.type].jobs.includes(type) : allows(e.u?.tasks, type); }
  cropFor(state, e = null, plotId = null) {
    const planned = plotId ? (state.gm?.unit && D.fmOf(state).auto ? managerCropFor(state, plotId) : D.planCropFor(state, plotId)) : null;
    const active = e && e.kind === 'worker' && !this.rule(e, 'playerCrop') ? null : ACTIVE_CROP;
    const crop = planned && D.seedCost(state, planned) <= state.player.coins ? planned : D.pickCropFor(state, plotId, active);
    if (!crop || !e || !isHardCrop(crop) || knows(e.u, 'hardCrop')) return crop;
    return D.easyCropFor(state, plotId, isHardCrop) || crop;
  }
  homeFirst(e, list) { const t = this.state.gm?.tiers?.[e.uid]; if (t == null) return list; const mine = list.filter(q => tierIndexAt(q.x, q.z) === t); return mine.length ? mine : list; }
  homeOnly(e, list) { const t = this.state.gm?.tiers?.[e.uid]; if (t == null || !D.ownedPlots(this.state).some(q => tierIndexAt(q.x, q.z) === t)) return list; return list.filter(q => tierIndexAt(q.x, q.z) === t); }
  near(e, list, ageOf = null) {
    const homeTier = this.state.gm?.tiers?.[e.uid], busy = [...this.units.values()].filter(o => o.job);
    let best = null, bd = Infinity;
    for (const it of list) {
      let d = farmRouteDist(e.x, e.z, it.x, it.z);
      for (const o of busy) if (o !== e && Math.hypot(o.job.x - it.x, o.job.z - it.z) < CROWD_R) d += CROWD_COST;
      if (homeTier != null && tierIndexAt(it.x, it.z) !== homeTier) d += TIER_AWAY;
      if (ageOf) d -= Math.min(FARM_MANAGER.ageCapM, Math.max(0, ageOf(it)));
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  mostUrgent(state, list, now) { let best = null, bu = -Infinity; for (const p of list) { const u = D.harvestUrgency(state, p.id, now); if (u > bu) { bu = u; best = p; } } return best; }
  machineSpot(b) { return { x: b.x, z: b.z + Math.max(...BUILDINGS[b.type].size) / 2 + 0.8 }; }
  waterSource(e, state, plot) {
    let best = null, bd = Infinity;
    for (const b of D.buildingsOf(state, 'well')) { const d = farmRouteDist(e.x, e.z, b.x, b.z) + farmRouteDist(b.x, b.z, plot.x, plot.z); if (d < bd) { bd = d; best = b; } }
    return best ? this.machineSpot(best) : null;
  }
  processJob(e, state, r, now) {
    const free = (r.buildings || []).filter(b => D.recipeOf(b) && !this.claimed(`station:${b.uid}`) && (b.type !== 'wetMill' || knows(e.u, 'wetMill')));
    const done = free.filter(b => b.job && !D.collectError(state, b, now));
    const b = this.near(e, done.length ? done : free.filter(x => !x.job && !D.prodError(state, x)));
    if (!b) return null;
    const spot = this.machineSpot(b);
    return { type: 'process', step: b.job ? 'collect' : 'start', building: b.uid, station: b.uid, x: spot.x, z: spot.z };
  }
  haulJob(e, state, r, plots) {
    const stores = D.storeBuildings(state);
    if (!stores.length) { e.reason = 'noStore'; return null; }
    const me = e.u, load = D.cargoCount(me);
    let piles = plots.filter(p => !this.claimed(`plot:${p.id}`) && D.pileCount(r.plots[p.id]) > 0);
    const chains = e.kind === 'robot' ? partTier(e.u, 'battery') >= 1 : this.rule(e, 'chainPiles');
    if (load > 0) {
      if (chains && load < D.haulCapacity(state, me)) piles = piles.filter(p => Math.hypot(p.x - e.x, p.z - e.z) <= CREW.haulChainM); else piles = [];
      if (!piles.length) {
        if (D.stored(state) >= D.capacity(state)) { e.reason = 'storageFull'; return null; }
        const spot = this.machineSpot(this.near(e, stores));
        return { type: 'haul', step: 'drop', x: spot.x, z: spot.z };
      }
    }
    if (!piles.length) { e.reason = 'noPile'; return null; }
    piles = this.homeFirst(e, piles);
    const p = this.rule(e, 'biggestFirst') ? piles.reduce((a, b) => (D.pileCount(r.plots[b.id]) > D.pileCount(r.plots[a.id]) ? b : a)) : this.near(e, piles);
    return { type: 'haul', step: 'load', plotId: p.id, x: p.x, z: p.z + 1.25 };
  }
  farmJob(e, state, now) {
    const plots = D.ownedPlots(state), r = D.region(state);
    const roomForBeans = D.stored(state) < D.capacity(state), canHarvest = this.takes(e, 'harvest'), canPlant = this.takes(e, 'plant');
    let cantDo = false;
    const canCrop = crop => { const ok = !isHardCrop(crop) || knows(e.u, 'hardCrop'); if (!ok) cantDo = true; return ok; };
    const spot = p => ({ x: p.x, z: p.z + 1.25 });
    e.reason = null;
    const toPlant = plots.filter(p => !r.plots[p.id]).length;
    const orders = (state.gm?.orders || []).filter(o => this.takes(e, o.job) && !this.claimed(`station:${o.id}`) && !(o.job === 'openField' && toPlant >= 4)).map(o => ({ o, ...D.orderSpot(o) })).filter(x => Number.isFinite(x.x));
    const next = orders.length ? this.near(e, orders) : null;
    if (next) return { type: 'execute', oid: next.o.id, station: next.o.id, hold: 2.5, x: next.x, z: next.z + 1.4 };
    if (this.takes(e, 'process')) { const job = this.processJob(e, state, r, now); if (!job) e.reason = 'noBatch'; return job; }
    if (this.takes(e, 'haul')) return this.haulJob(e, state, r, plots);
    if (!plots.length) { e.reason = 'noPlots'; return null; }
    if (roomForBeans && canHarvest) {
      const ready = this.homeOnly(e, plots.filter(p => !this.claimed(`plot:${p.id}`) && r.plots[p.id] && this.plotState(state, p.id, now).stage === 'ready' && canCrop(r.plots[p.id].crop)));
      const arabica = ready.filter(p => CROPS[r.plots[p.id].crop]?.drop);
      const p = this.rule(e, 'ripeFirst') ? this.mostUrgent(state, ready, now) : this.near(e, arabica.length ? arabica : ready, q => D.harvestUrgency(state, q.id, now));
      if (p) return { type: 'harvest', plotId: p.id, ...spot(p) };
    }
    if (canPlant && this.cropFor(state, e)) {
      const empty = this.homeOnly(e, plots.filter(p => !this.claimed(`plot:${p.id}`) && !r.plots[p.id]));
      const p = this.near(e, empty.filter(q => canCrop(this.cropFor(state, e, q.id))));
      if (p) return { type: 'plant', plotId: p.id, ...spot(p) };
    }
    if (this.takes(e, 'water')) {
      const growing = this.homeOnly(e, plots.filter(p => !this.claimed(`plot:${p.id}`) && r.plots[p.id] && !r.plots[p.id].watered && !D.dripCovers(state, p.id) && this.plotState(state, p.id, now).stage !== 'ready'));
      const p = this.rule(e, 'driestFirst') ? growing.reduce((best, q) => (!best || this.plotState(state, q.id, now).remainingMs > this.plotState(state, best.id, now).remainingMs ? q : best), null) : this.near(e, growing, q => (now - r.plots[q.id].plantedAt) / 60000);
      if (p) {
        if (e.water > 0) return { type: 'water', plotId: p.id, ...spot(p) };
        const src = this.waterSource(e, state, p);
        if (!src) { e.reason = 'noWell'; return null; }
        return { type: 'water', step: 'fetch', plotId: p.id, x: src.x, z: src.z };
      }
    }
    if (this.takes(e, 'prune')) {
      const growing = this.homeOnly(e, plots.filter(p => !this.claimed(`plot:${p.id}`) && r.plots[p.id] && this.plotState(state, p.id, now).stage !== 'ready'));
      const old = growing.filter(p => D.treeOld(r.plots[p.id]) && D.pruneCost(r.plots[p.id].crop) <= state.player.coins && (knows(e.u, 'oldTree') || !(cantDo = true)));
      const p = this.near(e, old.length ? old : growing.filter(q => !r.plots[q.id].trimmed && !D.treeOld(r.plots[q.id])));
      if (p) return { type: 'prune', old: old.length > 0, plotId: p.id, ...spot(p) };
    }
    if (this.takes(e, 'spray') && state.player.coins >= CREW.sprayFee) {
      const p = this.near(e, this.homeOnly(e, plots.filter(q => !this.claimed(`plot:${q.id}`) && r.plots[q.id] && !r.plots[q.id].sprayed && this.plotState(state, q.id, now).stage !== 'ready')));
      if (p) return { type: 'spray', plotId: p.id, ...spot(p) };
    }
    if (cantDo) { e.reason = 'cantDo'; return null; }
    let ready = 0, empty = 0;
    for (const p of plots) { const pl = r.plots[p.id]; if (!pl) { empty++; continue; } if (this.plotState(state, p.id, now).stage === 'ready') ready++; }
    e.reason = ready && !roomForBeans && canHarvest ? 'storageFull' : empty && canPlant && !this.cropFor(state, e) ? 'noSeeds' : canPlant && !canHarvest && !empty ? 'fieldsFull' : 'growing';
    return null;
  }
  maybeGoof(e, state, job) {
    const incident = funnyRoll(e.u, this.rand('funny'), this.rand('funny'), gmCalmMul(state.gm?.unit));
    if (incident) { this.act('staff/funny', { uid: e.uid, incident: incident.id }); return null; }
    const kind = goofRoll(e.u, this.rand('goof'));
    if (!kind) return job;
    let spot = kind === 'dock' ? e.home : null;
    if (!spot) {
      const far = kind === 'play' ? [10, 60] : [4, 14];
      const list = [...D.ownedPlots(state).map(q => ({ x: q.x, z: q.z + 1.25 })), ...D.buildingsOf(state, 'well'), ...D.storeBuildings(state)].filter(q => { const d = farmRouteDist(e.x, e.z, q.x, q.z); return d >= far[0] && d <= far[1]; });
      if (!list.length) return job;
      const q = list[Math.floor(this.rand('goof') * list.length)];
      spot = { x: q.x + (this.rand('goof') - 0.5) * 2, z: q.z + 1.5 };
    }
    this.m.jobs[`goof:${kind}`] = (this.m.jobs[`goof:${kind}`] || 0) + 1;
    return { type: 'goof', hold: goofHold(e.u, kind), x: spot.x, z: spot.z };
  }
  startJob(e, job) {
    e.speedK = 1; e.wander = null;
    e.job = { ...job, work: 0, arrived: false };
    if (job.plotId) this.claim(e, `plot:${job.plotId}`);
    if (job.station) this.claim(e, `station:${job.station}`);
  }
  oops(e, kind) { return this.rand('oops') < mistakeChance(e.u, kind); }
  workDone(e) {
    if (e.job?.type && e.xpN && e.xpTask && e.xpTask !== e.job.type) this.flushXp(e);
    e.xpTask = e.job?.type || e.xpTask || null;
    e.xpN = (e.xpN || 0) + 1; e.xpT = 0;
    if (e.kind === 'robot') { e.vJobs++; if (this.rand('jam') < jamChance(e.u)) this.act('staff/jam', { uid: e.uid }); }
    if (e.xpN >= 3) this.flushXp(e);
  }
  flushXp(e) { if (!e.xpN) return; const n = e.xpN; e.xpN = 0; this.act('staff/workDone', { uid: e.uid, n, task: e.xpTask || null }); }
  secondPlot(e, firstId) {
    const s = this.state, r = D.region(s), first = D.plotOf(s, firstId), now = this.now;
    if (!r || !first || D.stored(s) >= D.capacity(s)) return;
    let best = null, bd = 3.5;
    for (const p of D.ownedPlots(s)) {
      if (p.id === firstId || this.claimed(`plot:${p.id}`) || !r.plots[p.id] || this.plotState(s, p.id, now).stage !== 'ready') continue;
      const d = Math.hypot(p.x - first.x, p.z - first.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) this.act('farm/harvest', { plotId: best.id, uid: e.uid, unripe: this.oops(e, 'unripe') });
  }
  countJob(type) { this.m.jobs[type] = (this.m.jobs[type] || 0) + 1; }
  finish(e) {
    const j = e.job, state = this.state, now = this.now, r = D.region(state);
    if (j.type === 'harvest') {
      if (r?.plots[j.plotId] && this.plotState(state, j.plotId, now).stage === 'ready' && D.stored(state) < D.capacity(state)) {
        const unripe = this.oops(e, 'unripe');
        if (this.act('farm/harvest', { plotId: j.plotId, unripe, uid: e.uid }).ok) { this.countJob('harvest'); if (this.rule(e, 'twoPlots')) this.secondPlot(e, j.plotId); this.workDone(e); }
      }
    } else if (j.type === 'plant') {
      const crop = this.cropFor(state, e, j.plotId);
      if (crop && r && !r.plots[j.plotId] && D.plotOf(state, j.plotId) && this.act('farm/plant', { plotId: j.plotId, crop, uid: e.uid, crooked: this.oops(e, 'crooked') }).ok) { this.countJob('plant'); this.workDone(e); }
      e.think = e.kind === 'robot' || this.rule(e, 'quick') ? 0 : 1.2;
    } else if (j.type === 'water' && j.step === 'fetch') {
      e.water = D.bucketPlots(e.u);
      this.m.water.trips++; this.m.water.bucketSum += e.water;
      const plot = D.plotOf(state, j.plotId);
      if (plot && D.region(state)?.plots[j.plotId]) { Object.assign(j, { step: 'pour', x: plot.x, z: plot.z + 1.25, work: 0, arrived: false }); e.leg = null; return; }
    } else if (j.type === 'water') {
      const res = this.act('farm/water', { plotId: j.plotId, uid: e.uid });
      if (res.ok) { if (res.noop) this.m.water.wasted++; else { this.m.water.pours++; this.countJob('water'); } this.workDone(e); e.water = Math.max(0, (e.water || 0) - 1); }
      e.think = 0;
    } else if (j.type === 'prune') {
      if (this.act(j.old ? 'farm/prune' : 'farm/trim', { plotId: j.plotId, uid: e.uid }).ok) { this.countJob(j.old ? 'prune' : 'trim'); this.workDone(e); }
      e.think = 0;
    } else if (j.type === 'spray') {
      if (this.act('farm/spray', { plotId: j.plotId, uid: e.uid }).ok) { this.countJob('spray'); this.workDone(e); }
      e.think = 0;
    } else if (j.type === 'process') {
      if (this.act(j.step === 'collect' ? 'prod/collect' : 'prod/start', { uid: j.building, by: e.uid }).ok) { this.countJob(`process:${j.step}`); this.workDone(e); }
      e.think = 0;
    } else if (j.type === 'execute') {
      const res = this.act('gm/execute', { id: j.oid, uid: e.uid });
      if (res.ok && !res.noop) { this.countJob('execute'); this.workDone(e); }
      e.think = 0;
    } else if (j.type === 'haul') {
      if (j.step === 'load') { if (this.act('farm/pickUp', { plotId: j.plotId, uid: e.uid }).ok) this.countJob('haul:load'); }
      else if (D.stored(state) < D.capacity(state) && this.act('farm/deposit', { uid: e.uid, drop: this.oops(e, 'drop') }).ok) { this.countJob('haul:drop'); this.workDone(e); }
      e.think = 0;
    }
    this.endJob(e);
  }
  walk(e, x, z, dt) {
    let L = e.leg;
    if (!L || L.x !== x || L.z !== z) { const d = farmRouteDist(e.x, e.z, x, z) * WALK_MUL; L = e.leg = { x, z, total: d, left: d, fx: e.x, fz: e.z }; }
    const v = STAFF_SIM.speed[e.kind] * unitSpeed(e.u) * gearWalk(e.u) * (e.speedK || 1) * (e.stateK || 1), step = Math.min(L.left, v * dt);
    L.left -= step;
    this.m.walked += step;
    if (e.job?.type === 'water') { if (e.job.step === 'fetch') this.m.water.fetchWalk += step; else this.m.water.pourWalk += step; }
    if (L.left > 1e-9) return false;
    e.x = x; e.z = z; e.leg = null;
    return true;
  }
  wander(e, dt) { // staff.js wander, without canStand / farmFree
    const w = e.wander;
    if (w && !w.reached) { e.speedK = w.go ? 1 : 0.55; if (this.walk(e, w.x, w.z, dt)) { w.reached = true; w.pause = 0.6 + this.rand('wander') * 1.2; } return; }
    if (w && (w.pause -= dt) > 0) return;
    const myTier = this.state.gm?.tiers?.[e.uid];
    if (myTier != null && tierIndexAt(e.x, e.z) !== myTier) {
      const list = D.ownedPlots(this.state).filter(q => tierIndexAt(q.x, q.z) === myTier);
      if (list.length) { const q = list[(e.slot | 0) % list.length]; e.wander = { x: q.x + (this.rand('wander') - 0.5) * 2, z: q.z + 1.6, reached: false, go: true }; return; }
    }
    for (let k = 0; k < 10; k++) {
      const a = this.rand('wander') * Math.PI * 2, rr = 2 + this.rand('wander') * 4, x = e.x + Math.cos(a) * rr, z = e.z + Math.sin(a) * rr;
      if (myTier != null && tierIndexAt(x, z) !== myTier) continue;
      if (x < -30 || x > 30 || z < -74 || z > 26) continue;
      e.wander = { x, z, reached: false };
      return;
    }
  }
  flushVitals(e, force) {
    let w = e.vWork, r = e.vRest; const n = e.vJobs, u = e.u;
    e.vT = 0; e.vWork = 0; e.vRest = 0; e.vJobs = 0;
    if (!u) return;
    const view = { robot: e.kind === 'robot', energy: u.energy ?? 100, max: energyMax(u), morale: u.morale ?? 0, funny: u.trait === 'funny', heat: u.heat || 0 };
    if (!force && vitalsNoop(view, w, n) && (e.heldS || 0) + w + r < SKIP_FLUSH) { e.heldS = (e.heldS || 0) + w + r; return; }
    r += e.heldS || 0; e.heldS = 0;
    this.act('staff/vitals', { uid: e.uid, work: Math.round(w * 10) / 10, rest: Math.round(r * 10) / 10, jobs: n });
  }
  tickUnit(e, dt, interval) {
    if (e.job && e.working) e.vWork += dt; else e.vRest += dt;
    if ((e.stT -= dt) <= 0) {
      e.stT = TICKS.stateSeconds;
      if (timerDue(e.u, this.now)) { const key = e.u.breakUntil ?? e.u.stopped?.until; if (e.dueKey !== key) { e.dueKey = key; this.flushVitals(e, true); if (this.dirty) this.sync(); } }
      this.applyState(e);
    }
    if ((e.vT += dt) >= interval) { this.flushVitals(e, false); if (this.dirty) this.sync(); }
  }
  // staff.js update(), one unit
  updateUnit(e, dt, interval) {
    const t = this.m.time;
    this.tickUnit(e, dt, interval);
    if (!this.units.has(e.uid)) return;
    if (e.bench) { t.bench += dt; return; }
    if (e.stopped || !e.working) { t.blocked += dt; return; }
    if (e.job && e.kind === 'robot' && (e.workT += dt) >= batteryMinutes(e.u) * 60) { e.workT = 0; this.act('staff/stop', { uid: e.uid }); this.sync(); t.blocked += dt; return; }
    if (e.xpN && (e.xpT = (e.xpT || 0) + dt) > 15) { this.flushXp(e); if (this.dirty) this.sync(); }
    const state = this.state;
    if (!e.job) {
      e.think -= dt;
      if (e.think <= 0) {
        e.think = THINK;
        const found = this.farmJob(e, state, this.now), job = found ? this.maybeGoof(e, state, found) : null;
        if (this.dirty) this.sync();
        if (job && e.working && !e.stopped) this.startJob(e, job);
        else if (!job) e.think = FARM_MANAGER.idleThink + this.rand('think') * 0.5;
      }
      if (!e.job) {
        t.idle += dt;
        const why = e.reason || 'thinking'; this.m.idleReasons[why] = (this.m.idleReasons[why] || 0) + dt;
        if (why === 'noWell') this.m.water.noWellSec += dt;
        if (!e.stopped) this.wander(e, dt);
        return;
      }
    }
    const j = e.job;
    if (j.type === 'goof') t.goof += dt; else if (!j.arrived) t.walk += dt; else t.work += dt;
    if (!j.arrived) { if (this.walk(e, j.x, j.z, dt)) j.arrived = true; return; }
    j.work += dt;
    const need = j.hold ? j.hold : (STAFF_SIM.work[e.type] || 1) / (unitSpeed(e.u) * craftSpeed(e.u, j.type) * gearJob(e.u, j.type) * (e.stateK || 1));
    if (j.work >= need) { this.finish(e); if (this.dirty) this.sync(); }
  }
  // staff.js teamTimers / gmTimers
  timersStep(dt) {
    const T = this.timers, state = this.state;
    if ((T.clock += dt) >= CLOCK.tickSeconds) { const ms = Math.round(T.clock * 1000); T.clock = 0; this.act('clock/tick', { ms }); }
    if ((T.loan += dt) >= CLOCK.loanTickSeconds) { T.loan = 0; if (state.loans?.length) this.act('loan/tick', {}); }
    const gm = D.gmOf(this.state);
    if (!gm) { T.gmThink = T.gmPay = T.gmRival = 0; }
    else {
      if ((T.gmThink += dt) >= D.gmThinkSeconds(gm)) { T.gmThink = 0; this.act('gm/think', { roll: this.rand('gmThink') }); }
      if ((T.gmHands += dt) >= FARM_MANAGER.hands.everySec) { T.gmHands = 0; if (D.fmOf(this.state).auto) this.act('gm/hands', { skip: [...this.claims.keys()].filter(k => k.startsWith('plot:')).map(k => k.slice(5)) }); }
      if ((T.gmPay += dt) >= 60 || !this.state.gm.payAt) { T.gmPay = 0; this.act('gm/payroll', {}); }
      if ((T.gmRival += dt) >= GM.poach.everyMinutes * 60) { T.gmRival = 0; this.act('gm/rivalVisit', { roll: this.rand('rival') }); }
      if ((T.seen += dt) >= GM.mood.seenEverySeconds) { T.seen = 0; this.act('gm/seen', {}); }
    }
    if (this.dirty) this.sync();
    if (!this.units.size) return;
    if ((T.upkeep += dt) >= TICKS.upkeepSeconds || (!this.state.staff.upkeepAt && !T.started)) { T.upkeep = 0; T.started = true; this.act('staff/upkeep', {}); }
    if ([...this.units.values()].some(e => e.kind === 'worker')) { if ((T.rival += dt) >= RIVAL.everyMinutes * 60) { T.rival = 0; if (!D.workerPoach(this.state)) this.act('rival/visit', { zone: 'farm', roll: this.rand('rival') }); } } else T.rival = 0;
    if ((T.mvp += dt) >= BOOKS.mvpMinutes * 60) { T.mvp = 0; this.act('staff/mvp', {}); }
    if ((T.boss += dt) >= 5) {
      T.boss = 0;
      if (this.dirty) this.sync();
      for (const e of this.units.values()) {
        const u = e.u;
        if (!u || e.kind !== 'robot' || !u.stopped) continue;
        if (u.stopped.kind === 'battery' && hasSoftware(u, 'autoCharge') && !D.careError(this.state, u, 'recharge', this.now)) this.act('staff/care', { uid: u.uid, kind: 'recharge', by: u.uid });
        else if (u.stopped.kind === 'jam' && hasSoftware(u, 'autoUnjam') && this.now - (u.stopped.at || this.now) >= SOFTWARE.packs.autoUnjam.seconds * 1000) this.act('staff/care', { uid: u.uid, kind: 'knock', by: u.uid });
      }
    }
    if (this.dirty) this.sync();
  }
  milestone(name) { if (this.m.milestones[name] == null) this.m.milestones[name] = r2((this.now - T0) / 60000); }
  checkMilestones() {
    const s = this.state, lv = D.level(s), fields = D.ownedPlots(s).length;
    for (const L of [2, 5, 10, 15, 20]) if (lv >= L) this.milestone(`L${L}`);
    for (const id of ESTATE_ORDER.slice(1)) if (D.estateOwned(s, id)) this.milestone(id);
    for (const n of [6, 24, 100]) if (fields >= n) this.milestone(`fields${n}`);
    if ((s.stats?.harvested || 0) > this.start.harvested) this.milestone('firstHarvest');
  }
  snapshot() { const s = this.state, w = worthOf(s); this.m.series.push({ min: r2((this.now - T0) / 60000), cash: r2(w.cash), stock: r2(w.stock), netWorth: r2(w.netWorth), fields: D.ownedPlots(s).length, crew: this.units.size, harvested: (s.stats?.harvested || 0) - this.start.harvested, level: D.level(s) }); }
  run() {
    this.sync();
    this.policy.setup?.(this);
    const steps = Math.round(this.minutes * 60 / this.dt), dt = this.dt;
    const snapEvery = Math.round(300 / dt), mileEvery = Math.round(1 / dt);
    const started = performance.now();
    for (let i = 0; i < steps; i++) {
      this.now = T0 + Math.round(i * dt * 1000); simNow = this.now;
      if (this.dirty) this.sync();
      const interval = vitalsInterval(this.units.size);
      for (const e of [...this.units.values()]) { if (this.units.has(e.uid)) this.updateUnit(e, dt, interval); }
      this.timersStep(dt);
      this.policy.step?.(this, dt);
      if (this.giftT-- <= 0) { this.giftT = Math.round(5 / dt); if (D.pendingGifts(this.state).length) this.act('level/claim', { roll: this.rand('gift') }, { policy: true }); }
      if (i % mileEvery === 0) this.checkMilestones();
      if (i % snapEvery === 0) this.snapshot();
    }
    this.now = T0 + Math.round(steps * dt * 1000); simNow = this.now;
    this.snapshot(); this.checkMilestones();
    return this.result(performance.now() - started);
  }
  result(wallMs) {
    const s = this.state, m = this.m, w = worthOf(s), a = this.startWorth, sh = m.applyByType;
    const shift = m.time.work + m.time.walk + m.time.goof + m.time.idle + m.time.blocked;
    const earned = num((s.stats?.earned || 0) - this.start.earned), dCash = w.cash - a.cash, dCap = w.capital - a.capital, dDebt = w.debt - a.debt, dStock = w.stock - a.stock;
    const netProfit = w.netWorth - a.netWorth - m.gifts, operating = dCash + dCap - m.gifts - dDebt, opex = earned - operating;
    const avg = t => (sh[t] ? { n: sh[t].n, meanMs: r2(sh[t].ms / sh[t].n), maxMs: r2(sh[t].max), totalMs: r0(sh[t].ms) } : { n: 0, meanMs: 0, maxMs: 0, totalMs: 0 });
    const W = m.water, plots = D.ownedPlots(s);
    return { policy: this.policyName, profile: this.profileName, seed: this.seed, minutes: this.minutes, dt: this.dt,
      netProfit: r2(netProfit), operatingProfit: r2(operating), earned: r2(earned), opex: r2(opex), capex: r2(dCap), gifts: r2(m.gifts), stockChange: r2(dStock),
      cash: r2(w.cash), stock: r2(w.stock), capital: r2(w.capital), assets: r2(w.assets), debt: r2(w.debt), netWorth: r2(w.netWorth), startWorth: r2(a.netWorth), startCash: r2(a.cash),
      estates: ESTATE_ORDER.filter(id => D.estateOwned(s, id)).length, fields: plots.length, planted: plots.filter(p => D.region(s).plots[p.id]).length, ripeAtEnd: plots.filter(p => D.region(s).plots[p.id] && D.plotState(s, p.id, this.now).stage === 'ready').length,
      crew: this.units.size, harvested: (s.stats?.harvested || 0) - this.start.harvested, sold: (s.stats?.sold || 0) - this.start.sold, level: D.level(s), xp: s.player.xp, hasManager: !!D.gmOf(s), milestones: m.milestones,
      unitSeconds: r0(shift), idleShare: shift ? r2(m.time.idle / shift) : 0, walkShare: shift ? r2(m.time.walk / shift) : 0, workShare: shift ? r2(m.time.work / shift) : 0, goofShare: shift ? r2(m.time.goof / shift) : 0, blockedShare: shift ? r2(m.time.blocked / shift) : 0, idleReasons: Object.fromEntries(Object.entries(m.idleReasons).map(([k, v]) => [k, r0(v)])),
      jobs: m.jobs, water: { trips: W.trips, pours: W.pours, wastedPours: W.wasted, poursPerTrip: W.trips ? r2(W.pours / W.trips) : 0, bucketUse: W.bucketSum ? r2(W.pours / W.bucketSum) : 0, fetchWalkM: r0(W.fetchWalk), pourWalkM: r0(W.pourWalk), walkPerPourM: W.pours ? r2((W.fetchWalk + W.pourWalk) / W.pours) : 0, noWellSec: r0(W.noWellSec) },
      coinFlow: Object.fromEntries(Object.entries(m.coinFlow).map(([k, v]) => [k, r0(v)])), failed: m.fails, failedTotal: Object.values(m.fails).reduce((x, y) => x + y, 0), invalidDecisions: m.invalid, invalidBy: m.invalidBy, gmGate: m.gmGate, events: m.events,
      perf: { applyCalls: m.applyN, applyMeanMs: r2(m.applyMs / Math.max(1, m.applyN)), applyMaxMs: r2(m.applyMax), applyTotalMs: r0(m.applyMs), think: avg('gm/think'), hands: avg('gm/hands'), wallMs: r0(wallMs) },
      violations: m.violations, violationSamples: m.samples, throws: m.throws, coreRandomCalls,
      series: m.series, digest: createHash('sha1').update(JSON.stringify(s)).digest('hex').slice(0, 16) };
  }
}
const idleSpot = i => ({ x: PARCELS.F1.rect[2] + 0.9 + Math.floor(i / 3) * 1.3, z: PARCELS.F1.rect[1] + 1.2 + (i % 3) * 1.7 }); // staff.js IDLE.farm

// ---------- policies ----------
const crewCount = (sim, job) => [...sim.units.values()].filter(e => doesJob(e.u, job)).length;
const tiersWithFields = s => [...new Set(D.ownedPlots(s).map(p => tierIndexAt(p.x, p.z)))].sort((a, b) => a - b);
const ownedTiers = s => ESTATE_ORDER.map((id, t) => (D.estateOwned(s, id) ? t : -1)).filter(t => t >= 0);
const playerCrop = (s, plotId) => { const want = D.bestCropFor(s, plotId); return want && D.seedCost(s, want) <= s.player.coins ? want : D.seedCost(s, 'robusta') <= s.player.coins ? 'robusta' : null; };
function spotOf(sim, tier) { sim.pol.cursor ||= [0, 0, 0, 0]; return nextFieldSpot(sim.state, tier, sim.pol.cursor); }
function placeField(sim, tier = null) {
  const s = sim.state, tiers = ownedTiers(s);
  const counts = t => D.ownedPlots(s).filter(p => tierIndexAt(p.x, p.z) === t).length;
  const t = tier ?? tiers.slice().sort((a, b) => counts(a) - counts(b) || a - b)[0];
  const q = spotOf(sim, t);
  return q ? sim.act('build/place', { type: 'field', x: q.x, z: q.z }, { policy: true }).ok : false;
}
function tryBuild(sim, type, tier = 0, reserve = 40) {
  const s = sim.state;
  if (D.buildCost(s, type) + reserve > s.player.coins || D.buildError(s, type)) return false;
  const q = nextBuildSpot(s, type, tier);
  return q ? sim.act('build/place', { type, x: q.x, z: q.z, rot: 0 }, { policy: true }).ok : false;
}
function tryHire(sim, type, reserve = 40) { const s = sim.state; return !D.staffError(s, type) && STAFF[type].cost + reserve <= s.player.coins ? sim.act('staff/hire', { type }, { policy: true }).ok : false; }
function tryLand(sim, mul = 1) { const s = sim.state, e = D.nextEstate(s); if (!e || D.parcelError(s, e.seed) || s.player.coins < e.cost * mul) return false; return sim.act('land/buyParcel', { parcelId: e.seed }, { policy: true }).ok; }
// One player, one action every TAP_SECONDS: what economy-sim's tapper does, on the placeable-field game.
function tap(sim, dt, cfg) {
  if ((sim.tapT -= dt) > 0) return;
  sim.tapT = TAP_SECONDS;
  const s = sim.state, r = D.region(s), now = sim.now, plots = D.ownedPlots(s), cap = D.capacity(s), stored = D.stored(s);
  const ripe = [], empty = []; let oldTree = null, thirst = null;
  for (const p of plots) {
    if (sim.claimed(`plot:${p.id}`)) continue;
    const pl = r.plots[p.id];
    if (!pl) { empty.push(p); continue; }
    const need = D.plotNeeds(s, p.id, now);
    if (need === 'ready') ripe.push(p); else if (need === 'prune') oldTree ||= p; else if (need === 'thirst' && !D.dripCovers(s, p.id)) thirst ||= p;
  }
  if ((stored / Math.max(1, cap) >= cfg.sellAt || (s.player.coins < 15 && stored > 0)) && stored > 0) { sim.act('farm/sellAll', {}, { policy: true }); return; }
  if (ripe.length && stored < cap) { const p = sim.mostUrgent(s, ripe, now); sim.act('farm/harvest', { plotId: p.id }, { policy: true }); return; }
  if (empty.length) { const crop = playerCrop(s, empty[0].id); if (crop) { sim.act('farm/plant', { plotId: empty[0].id, crop }, { policy: true }); return; } }
  if (oldTree && D.pruneCost(r.plots[oldTree.id].crop) <= s.player.coins) { sim.act('farm/prune', { plotId: oldTree.id }, { policy: true }); return; }
  if (thirst) { sim.act('farm/water', { plotId: thirst.id }, { policy: true }); return; }
  if (!empty.length && ripe.length <= 2 && plots.length < cfg.maxFields && s.player.coins >= 20) { if (placeField(sim)) return; }
  sim.tapT = 0.5;
}
// Player's quick fix for a unit in trouble after a minute (the delegate's reaction time in economy-sim).
function playerCare(sim, dt) {
  if ((sim.careT -= dt) > 0) return;
  sim.careT = 5;
  const now = sim.now;
  for (const e of sim.units.values()) {
    const s = sim.state, u = e.u, fix = D.quickFix(u, now);
    if (!fix) { e.troubleAt = null; continue; }
    e.troubleAt ??= now;
    if (now - e.troubleAt < 60000) continue;
    const kind = fix.kind === 'repair' && !D.careError(s, u, 'knock', now) ? 'knock' : fix.kind, cost = kind === 'knock' ? 0 : fix.cost;
    if (kind === 'coffee' && s.player.coins < 300) continue;
    if (s.player.coins < cost + 20 || D.careError(s, u, kind, now)) continue;
    sim.act('staff/care', { uid: u.uid, kind, roll: sim.rand('care') }, { policy: true });
  }
}
const tapPolicy = (cfg, invest = null) => ({
  setup() {},
  step(sim, dt) {
    if (invest && (sim.investT -= dt) <= 0) { sim.investT = 15; invest(sim); }
    tap(sim, dt, cfg); playerCare(sim, dt);
  },
});
// A small farmer: one purchase per 15 s, in this order of need.
function simpleInvest(sim) {
  const s = sim.state, r = D.region(s), plots = D.ownedPlots(s), now = sim.now, n = plots.length;
  let ripe = 0, empty = 0;
  for (const p of plots) { if (!r.plots[p.id]) empty++; else if (D.plotState(s, p.id, now).stage === 'ready') ripe++; }
  const tiers = tiersWithFields(s), wells = D.buildingsOf(s, 'well'), wellOn = t => wells.some(b => tierIndexAt(b.x, b.z) === t);
  if (n < 6) { placeField(sim); return; }
  if (!D.buildingsOf(s, 'silo').length && tryBuild(sim, 'silo')) return;
  if (ripe >= 6 && crewCount(sim, 'harvest') < Math.ceil(n / 12) && tryHire(sim, 'picker')) return;
  if (empty >= 4 && crewCount(sim, 'plant') < Math.ceil(n / 24) && tryHire(sim, 'planter')) return;
  if (n >= 12) { const t = tiers.find(q => !wellOn(q)); if (t != null && tryBuild(sim, 'well', t)) return; }
  if (wells.length && n >= 12 && crewCount(sim, 'water') < Math.ceil(n / 30) && tryHire(sim, 'waterer')) return;
  if (D.stored(s) / D.capacity(s) >= 0.8 && D.buildCost(s, 'silo') * 3 <= s.player.coins && tryBuild(sim, 'silo')) return;
  if (n >= 12 && tryLand(sim, 2)) return;
  if (!empty && ripe < 4 && n < (crewCount(sim, 'harvest') + 1) * 18 && s.player.coins >= 40) placeField(sim);
}
// A fixed build order: the next step is bought as soon as it is affordable, whatever the farm looks like.
const FIXED_ORDER = ['fields:6', 'silo', 'picker', 'fields:12', 'planter', 'well', 'waterer', 'fields:18', 'dryer', 'processor', 'picker', 'silo', 'land', 'fields:30', 'well@1', 'picker', 'waterer', 'fields:42', 'wetMill', 'land', 'fields:60', 'well@2', 'picker', 'planter', 'land', 'fields:90', 'well@3', 'picker', 'picker', 'waterer'];
function fixedInvest(sim) {
  const s = sim.state, pol = sim.pol; pol.i ||= 0;
  for (let guard = 0; guard < 6 && pol.i < FIXED_ORDER.length; guard++) {
    const [step, arg] = FIXED_ORDER[pol.i].split(/[:@]/);
    if (step === 'fields') { if (D.ownedPlots(sim.state).length >= Number(arg)) { pol.i++; continue; } if (s.player.coins >= 30) placeField(sim); return; }
    if (step === 'land') { const e = D.nextEstate(s); if (!e) { pol.i++; continue; } if (tryLand(sim)) pol.i++; return; }
    if (STAFF[step]) { if (tryHire(sim, step, 30)) pol.i++; return; }
    if (BUILDINGS[step]) { if (tryBuild(sim, step, Number(arg) || 0, 30)) pol.i++; return; }
    throw new Error(`fixed order: unknown step ${step}`);
  }
}
// The manager: until his fee can be paid the player taps as in 'none'; after the hire he is on his own. Inbox tasks are left unanswered.
const managerPolicy = ({ planner }) => ({
  setup(sim) { this.tryHire(sim); },
  tryHire(sim) {
    if (D.gmOf(sim.state)) return true;
    const board = D.gmBoard(sim.state); let best = -1;
    board.forEach((c, i) => { if (best < 0 || c.fee < board[best].fee) best = i; });
    if (best < 0 || sim.state.player.coins < board[best].fee + 100) return false;
    if (!sim.act('gm/hire', { index: best }, { policy: true }).ok) return false;
    sim.milestone('managerHired');
    if ('planner' in (sim.state.gm.fm || {}) || planner) {
      const r = sim.act('gm/fmSet', { key: 'planner', value: !!planner });
      if (!r.ok && planner) throw new Error('policy v3 needs fm.planner: gm/fmSet refused key "planner" (the planner is not built yet)');
    }
    for (const [key, value] of Object.entries(sim.fmSettings)) { const r = sim.act('gm/fmSet', { key, value }); if (!r.ok) throw new Error(`gm/fmSet ${key}=${value} refused: ${r.error}`); }
    sim.sync();
    return true;
  },
  step(sim, dt) {
    if (D.gmOf(sim.state)) return;
    if (!this.tryHire(sim)) { tap(sim, dt, TAP_NONE); playerCare(sim, dt); }
  },
});
const TAP_NONE = { sellAt: 0.85, maxFields: 18 };
const POLICIES = {
  none: tapPolicy(TAP_NONE),
  simple: tapPolicy({ sellAt: 0.6, maxFields: 200 }, simpleInvest),
  fixed: tapPolicy({ sellAt: 0.6, maxFields: 200 }, fixedInvest),
  v2: managerPolicy({ planner: false }),
  v3: managerPolicy({ planner: true }),
};
const BASELINE_POLICIES = ['none', 'simple', 'fixed', 'v2'];

// ---------- CLI ----------
function parseArgs(argv) {
  const o = { policy: 'all', profile: 'all', minutes: 60, seeds: 3, json: null, md: null, jobs: Math.max(1, Math.min(8, cpus().length - 1)), dt: 0.1, fm: {}, determinism: false, checkTests: false, quiet: false };
  const conv = v => (v === 'true' ? true : v === 'false' ? false : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--policy') o.policy = next(); else if (a === '--profile') o.profile = next(); else if (a === '--minutes') o.minutes = Number(next()); else if (a === '--seeds') o.seeds = Number(next());
    else if (a === '--json') o.json = next(); else if (a === '--md') o.md = next(); else if (a === '--jobs') o.jobs = Number(next()); else if (a === '--dt') o.dt = Number(next());
    else if (a === '--fm') { for (const kv of next().split(',')) { const [k, v] = kv.split('='); o.fm[k] = conv(v); } }
    else if (a === '--determinism') o.determinism = true; else if (a === '--check-tests') o.checkTests = true; else if (a === '--quiet') o.quiet = true;
    else if (a === '--help' || a === '-h') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')); process.exit(0); }
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}
function runJobs(jobs, n, onDone) {
  return new Promise((done, bad) => {
    const out = new Array(jobs.length); let next = 0, finished = 0, live = 0;
    const startWorker = () => {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { harness: true } });
      live++;
      const feed = () => { if (next < jobs.length) { w.postMessage({ i: next, job: jobs[next] }); next++; } else { w.postMessage({ stop: true }); } };
      w.on('message', msg => { if (msg.error) { bad(new Error(`${JSON.stringify(msg.job)}: ${msg.error}`)); return; } out[msg.i] = msg.result; finished++; onDone?.(msg.result, finished, jobs.length); feed(); });
      w.on('error', bad);
      w.on('exit', () => { if (--live === 0) done(out); });
      feed();
    };
    for (let i = 0; i < Math.min(n, jobs.length); i++) startWorker();
  });
}
function mean(list) { return list.reduce((a, b) => a + b, 0) / Math.max(1, list.length); }
function groupRows(results) {
  const by = new Map();
  for (const r of results) { const k = `${r.profile}|${r.policy}`; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  return [...by.values()].map(list => {
    const f = fn => mean(list.map(fn)), a = list[0];
    return { profile: a.profile, policy: a.policy, seeds: list.length, net: f(r => r.netProfit), netMin: Math.min(...list.map(r => r.netProfit)), netMax: Math.max(...list.map(r => r.netProfit)), oper: f(r => r.operatingProfit), earned: f(r => r.earned), cash: f(r => r.cash), assets: f(r => r.assets), worth: f(r => r.netWorth), estates: f(r => r.estates), fields: f(r => r.fields), planted: f(r => r.planted), harvested: f(r => r.harvested), idle: f(r => r.idleShare), blocked: f(r => r.blockedShare), trips: f(r => r.water.trips), perTrip: f(r => r.water.poursPerTrip), fails: f(r => r.failedTotal), invalid: f(r => r.invalidDecisions), level: f(r => r.level), applyMs: f(r => r.perf.applyMeanMs), thinkMs: f(r => r.perf.think.meanMs), viol: f(r => r.violations + r.throws) };
  });
}
function compareTable(results) {
  const rows = groupRows(results).sort((a, b) => a.profile.localeCompare(b.profile) || BASELINE_POLICIES.indexOf(a.policy) - BASELINE_POLICIES.indexOf(b.policy));
  const n = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '-');
  const head = ['profile', 'policy', 'net profit', 'min..max', 'operating', 'earned', 'cash', 'net worth', 'estates', 'fields', 'harvested', 'idle %', 'blocked %', 'water trips', 'pours/trip', 'fails', 'invalid', 'level', 'apply ms', 'think ms', 'violations'];
  const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const r of rows) lines.push(`| ${[r.profile, r.policy, n(r.net), `${n(r.netMin)}..${n(r.netMax)}`, n(r.oper), n(r.earned), n(r.cash), n(r.worth), n(r.estates, 1), n(r.fields), n(r.harvested), n(r.idle * 100), n(r.blocked * 100), n(r.trips), n(r.perTrip, 1), n(r.fails), n(r.invalid), n(r.level, 1), n(r.applyMs, 2), n(r.thinkMs, 2), n(r.viol)].join(' | ')} |`);
  return lines.join('\n');
}
function checkTests() {
  const file = join(ROOT, 'docs/ai-manager/stale-tests-baseline.txt');
  const base = new Set(readFileSync(file, 'utf8').split('\n').filter(l => l && !l.startsWith('#')));
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/**/*.test.mjs'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const now = new Set(run.stdout.split('\n').filter(l => /^not ok \d+ - /.test(l)).map(l => l.replace(/^not ok \d+ - /, '')));
  const total = (run.stdout.match(/^# tests (\d+)/m) || [])[1];
  const fresh = [...now].filter(x => !base.has(x)).sort(), fixed = [...base].filter(x => !now.has(x)).sort();
  console.log(`tests: ${total}, failing now: ${now.size}, failing in baseline: ${base.size}`);
  console.log(`newly failing (${fresh.length}):`); for (const x of fresh) console.log(`  ${x}`);
  console.log(`no longer failing (${fixed.length}):`); for (const x of fixed) console.log(`  ${x}`);
  return fresh.length ? 1 : 0;
}
async function main() {
  const o = parseArgs(process.argv);
  if (o.checkTests) process.exit(checkTests());
  const policies = o.policy === 'all' ? BASELINE_POLICIES : o.policy.split(',');
  const profiles = o.profile === 'all' ? Object.keys(PROFILES) : o.profile.split(',');
  for (const p of policies) if (!POLICIES[p]) throw new Error(`unknown policy ${p}`);
  for (const p of profiles) if (!PROFILES[p]) throw new Error(`unknown profile ${p}`);
  const jobs = [];
  for (const profile of profiles) for (const policy of policies) for (let seed = 1; seed <= o.seeds; seed++) jobs.push({ profile, policy, seed, minutes: o.minutes, dt: o.dt, fm: o.fm });
  const t0 = performance.now();
  const results = await runJobs(jobs, o.jobs, (r, done, all) => { if (!o.quiet) console.error(`[${done}/${all}] ${r.profile} ${r.policy} seed ${r.seed}: net ${r.netProfit.toFixed(0)}, ${r.perf.wallMs} ms`); });
  if (o.determinism) {
    const again = await runJobs(jobs, o.jobs);
    const bad = results.filter((r, i) => r.digest !== again[i].digest);
    console.log(bad.length ? `NOT deterministic: ${bad.map(r => `${r.profile}/${r.policy}/${r.seed}`).join(', ')}` : `deterministic: ${results.length} runs gave identical final-state digests`);
    if (bad.length) process.exitCode = 1;
  }
  const table = compareTable(results);
  console.log(table);
  console.log(`\n${results.length} runs in ${((performance.now() - t0) / 1000).toFixed(1)} s. Violations: ${results.reduce((n, r) => n + r.violations + r.throws, 0)}. Math.random calls in core: ${results.reduce((n, r) => n + r.coreRandomCalls, 0)}.`);
  if (o.json) writeFileSync(o.json, JSON.stringify({ args: { policies, profiles, minutes: o.minutes, seeds: o.seeds, dt: o.dt, fm: o.fm }, runs: results, table: groupRows(results) }, null, 1));
  if (o.md) writeFileSync(o.md, `${table}\n`);
}
if (!isMainThread && workerData?.harness) {
  parentPort.on('message', msg => {
    if (msg.stop) { process.exit(0); }
    try { const result = new Sim(msg.job).run(); parentPort.postMessage({ i: msg.i, result }); } catch (err) { parentPort.postMessage({ i: msg.i, job: msg.job, error: err.stack || err.message }); }
  });
} else if (isMainThread) {
  main().catch(err => { console.error(err.stack || err.message); process.exit(1); });
}
export { Sim, POLICIES, PROFILES, BASELINE_POLICIES, profileState, worthOf };
