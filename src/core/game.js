// Pure reducer for Farm & Café V3. `apply(state, action, ctx)` → { ok, state, events, error }.
// The input state is never mutated: a successful action returns a new state object. All timing comes from ctx.now,
// randomness from action payloads, so every transition is deterministic and testable (tests/core/*.test.mjs).
import { BUILDINGS, CROPS, DRINKS, STAFF, XP, ROUNDS, MAX_ROUND, REBIRTH, START, EXPIRY_LEVEL, levelForXp } from './config/economy.js';
import { PARCELS, ROADS, FIXED, plotById } from './config/layout.js';
import { COUNTRIES, parseRegionId } from './config/world.js';
import { clone, normalizeRegion } from './state.js';
import * as D from './derive.js';

const TX_KEEP = 64;
// While the Level-10 expiration is pending, nothing that changes the economy may run.
const PAUSABLE = /^(farm|shop|build|land|staff|round|country|rebirth)\//;

function fail(error, data) { return { ok: false, error, data }; }

function grantXp(s, amount, events) {
  const before = levelForXp(s.player.xp);
  s.player.xp += Math.round(amount * D.xpMultiplier(s));
  const after = levelForXp(s.player.xp);
  if (after > before) events.push({ type: 'levelUp', from: before, to: after });
  if (after >= EXPIRY_LEVEL && !s.story.level10Done && !s.story.expiry && s.world.currentRegion && s.story.phase === 'play') {
    s.story.expiry = { status: 'pending', regionId: s.world.currentRegion, at: 0 };
    s.story.phase = 'expiry';
    events.push({ type: 'expiryTriggered', regionId: s.world.currentRegion });
  }
}
function spend(s, amount) { s.player.coins = Math.max(0, Math.round((s.player.coins - amount) * 100) / 100); }
function earn(s, amount) { s.player.coins = Math.round((s.player.coins + amount) * 100) / 100; s.stats.earned += amount; }
const uid = (s, prefix) => `${prefix}${s.nextUid++}`;

export function freshRegion(s, now) {
  const r = normalizeRegion({ status: 'active', enteredAt: now });
  r.parcels = Object.values(PARCELS).filter(p => p.starter).map(p => p.id);
  r.roads = Object.values(ROADS).filter(x => x.open).map(x => x.id);
  r.buildings = starterBuildings(s);
  return r;
}
function starterBuildings(s) {
  return Object.values(BUILDINGS).filter(b => b.starter).map(b => ({ uid: uid(s, 'b'), type: b.id, x: FIXED[b.id].x, z: FIXED[b.id].z, rot: FIXED[b.id].rot, level: 1 }));
}
// Re-add any missing starter building (safety net after a reset or a damaged save).
function ensureStarters(s, r) {
  for (const def of Object.values(BUILDINGS)) {
    if (!def.starter || r.buildings.some(b => b.type === def.id)) continue;
    r.buildings.push({ uid: uid(s, 'b'), type: def.id, x: FIXED[def.id].x, z: FIXED[def.id].z, rot: FIXED[def.id].rot, level: 1 });
  }
  for (const p of Object.values(PARCELS)) if (p.starter && !r.parcels.includes(p.id)) r.parcels.push(p.id);
  for (const road of Object.values(ROADS)) if (road.open && !r.roads.includes(road.id)) r.roads.push(road.id);
}

const handlers = {
  // ---------- story ----------
  'character/set'(s, { gender, name }) {
    if (gender !== 'male' && gender !== 'female') return fail('invalid');
    s.character = { gender, name: String(name || '').slice(0, 20) };
    if (s.story.phase === 'select') s.story.phase = 'intro';
  },
  'story/introDone'(s) {
    if (s.story.phase !== 'intro') return;
    s.story.phase = 'teacher';
  },
  // Teacher explains rebirth and grants the 3 free credits exactly once.
  'story/teacherDone'(s, _p, ev) {
    if (!s.rebirth.granted) { s.rebirth.credits += START.rebirthCredits; s.rebirth.granted = true; ev.push({ type: 'creditsGranted', amount: START.rebirthCredits }); }
    s.story.teacherMet = true;
    if (s.story.phase === 'teacher' || s.story.phase === 'intro' || s.story.phase === 'select') s.story.phase = 'gate';
  },
  'story/seen'(s, { key }) { if (typeof key === 'string') s.story.seen[key] = true; },

  // ---------- world ----------
  'world/enterRegion'(s, { regionId }, ev, ctx) {
    if (!['gate', 'chooseRegion', 'play'].includes(s.story.phase)) return fail('phase');
    const access = D.regionAccess(s, regionId);
    if (!access.ok) return fail(access.reason, access);
    if (access.current) { s.story.phase = 'play'; return; }
    const prev = s.world.currentRegion && s.world.regions[s.world.currentRegion];
    if (prev && prev.status === 'active') prev.status = 'idle';
    let r = s.world.regions[regionId];
    if (!r) { r = freshRegion(s, ctx.now); s.world.regions[regionId] = r; ev.push({ type: 'regionFirstVisit', regionId }); }
    else { ensureStarters(s, r); r.status = 'active'; r.enteredAt = ctx.now; }
    s.world.currentRegion = regionId;
    if (!s.world.startCountry) s.world.startCountry = parseRegionId(regionId).countryId;
    s.story.phase = 'play';
    ev.push({ type: 'regionEntered', regionId });
  },
  'country/unlock'(s, { countryId }, ev) {
    const c = COUNTRIES[countryId];
    if (!c) return fail('unknown');
    if (s.world.countries[countryId]?.unlocked) return { noop: true };
    if (s.player.round < c.round) return fail('round');
    if (s.player.coins < c.unlockCost) return fail('coins', { missing: c.unlockCost - s.player.coins });
    spend(s, c.unlockCost);
    s.world.countries[countryId] = { unlocked: true };
    ev.push({ type: 'countryUnlocked', countryId, cost: c.unlockCost });
  },

  // ---------- farm ----------
  'farm/plant'(s, { plotId, crop = 'robusta' }, ev, ctx) {
    const r = D.region(s);
    const plot = plotById(plotId);
    if (!r || !plot) return fail('unknown');
    if (!r.parcels.includes(plot.parcel)) return fail('notOwned');
    if (r.plots[plotId]) return fail('occupied');
    if (!D.cropUnlocked(s, crop)) return fail('locked');
    const cost = D.seedCost(s, crop);
    if (s.player.coins < cost) return fail('coins', { missing: cost - s.player.coins });
    spend(s, cost);
    r.plots[plotId] = { crop, plantedAt: ctx.now };
    s.stats.planted++;
    ev.push({ type: 'planted', plotId, crop, cost, free: cost === 0 });
  },
  'farm/harvest'(s, { plotId }, ev, ctx) {
    const r = D.region(s);
    if (!r || !r.plots[plotId]) return fail('empty');
    const st = D.plotState(s, plotId, ctx.now);
    if (st.stage !== 'ready') return fail('notReady', { remainingMs: st.remainingMs });
    const cap = D.capacity(s);
    if (s.inventory.beans >= cap) return fail('storageFull', { capacity: cap });
    const beans = D.yieldOf(s, st.crop);
    s.inventory.beans += beans; // soft cap: one harvest may overflow; next one is refused
    delete r.plots[plotId];
    s.stats.harvested++;
    grantXp(s, CROPS[st.crop].xp, ev);
    ev.push({ type: 'harvested', plotId, crop: st.crop, beans, xp: CROPS[st.crop].xp });
  },

  // ---------- café ----------
  'shop/spawnCustomer'(s, { roll = 0, look = 0 }, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('noRegion');
    if (r.shop.orders.filter(o => o.stage === 'waiting').length >= D.queueCap(s)) return fail('queueFull');
    const drinks = D.unlockedDrinks(s);
    // Weighted towards the newest drink a little: [1, 2, 3] weights.
    const weights = drinks.map((_, i) => i + 1), total = weights.reduce((a, b) => a + b, 0);
    let x = Math.min(.999999, Math.max(0, roll)) * total, drink = drinks[0];
    for (let i = 0; i < drinks.length; i++) { if (x < weights[i]) { drink = drinks[i]; break; } x -= weights[i]; }
    const order = { id: r.shop.nextOrder++, drink, stage: 'waiting', at: ctx.now, look: look | 0 };
    r.shop.orders.push(order);
    ev.push({ type: 'customerArrived', orderId: order.id, drink });
  },
  'shop/customerLeft'(s, { orderId }, ev) {
    const r = D.region(s);
    const i = r ? r.shop.orders.findIndex(o => o.id === orderId && o.stage === 'waiting') : -1;
    if (i < 0) return fail('unknown');
    r.shop.orders.splice(i, 1);
    ev.push({ type: 'customerLeft', orderId });
  },
  'shop/takeOrder'(s, { orderId } = {}, ev) {
    const r = D.region(s);
    const o = r?.shop.orders.find(x => x.stage === 'waiting' && (orderId == null || x.id === orderId));
    if (!o) return fail('noCustomer');
    o.stage = 'taken';
    ev.push({ type: 'orderTaken', orderId: o.id, drink: o.drink });
  },
  'shop/brew'(s, { orderId } = {}, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('noRegion');
    const brewing = r.shop.orders.filter(x => x.stage === 'brewing').length;
    const o = r.shop.orders.find(x => x.stage === 'taken' && (orderId == null || x.id === orderId));
    if (!o) return fail('noOrder');
    if (brewing >= D.brewSlots(s)) return fail('busy');
    const need = DRINKS[o.drink].beans;
    if (s.inventory.beans < need) return fail('beans', { need, have: s.inventory.beans });
    s.inventory.beans -= need;
    o.stage = 'brewing'; o.brewStart = ctx.now; o.brewMs = D.brewMs(s, o.drink);
    ev.push({ type: 'brewStarted', orderId: o.id, drink: o.drink, ms: o.brewMs });
  },
  'shop/serve'(s, { orderId } = {}, ev, ctx) {
    const r = D.region(s);
    const o = r?.shop.orders.find(x => x.stage === 'brewing' && ctx.now - x.brewStart >= x.brewMs && (orderId == null || x.id === orderId));
    if (!o) return fail('notReady');
    const price = D.drinkPrice(s, o.drink);
    earn(s, price);
    r.shop.orders.splice(r.shop.orders.indexOf(o), 1);
    s.stats.served++;
    grantXp(s, DRINKS[o.drink].xp, ev);
    ev.push({ type: 'served', orderId: o.id, drink: o.drink, coins: price, xp: DRINKS[o.drink].xp });
  },

  // ---------- building ----------
  'build/place'(s, { type, x, z, rot = 0 }, ev) {
    const err = D.buildError(s, type);
    if (err) return fail(err, err === 'coins' ? { missing: BUILDINGS[type].cost - s.player.coins } : undefined);
    const pos = D.snapPosition(type, x, z, rot);
    const perr = D.placementError(s, type, pos.x, pos.z, rot);
    if (perr) return fail(perr);
    const def = BUILDINGS[type];
    spend(s, def.cost);
    const b = { uid: uid(s, 'b'), type, x: pos.x, z: pos.z, rot: rot % 4, level: 1 };
    D.region(s).buildings.push(b);
    s.stats.built++;
    grantXp(s, def.xp ?? XP.build, ev);
    ev.push({ type: 'built', uid: b.uid, building: type, cost: def.cost });
  },
  'build/move'(s, { uid: id, x, z, rot = 0 }, ev) {
    const b = D.region(s)?.buildings.find(v => v.uid === id);
    if (!b) return fail('unknown');
    if (BUILDINGS[b.type].fixed) return fail('fixed');
    const pos = D.snapPosition(b.type, x, z, rot);
    const perr = D.placementError(s, b.type, pos.x, pos.z, rot, b.uid);
    if (perr) return fail(perr);
    Object.assign(b, { x: pos.x, z: pos.z, rot: rot % 4 });
    ev.push({ type: 'moved', uid: b.uid });
  },
  'build/upgrade'(s, { uid: id }, ev) {
    const b = D.region(s)?.buildings.find(v => v.uid === id);
    const err = D.upgradeError(s, b);
    if (err) return fail(err, err === 'coins' ? { missing: D.upgradeCost(b.type, b.level) - s.player.coins } : undefined);
    const cost = D.upgradeCost(b.type, b.level);
    spend(s, cost);
    b.level++;
    s.stats.upgraded++;
    grantXp(s, XP.upgrade, ev);
    ev.push({ type: 'upgraded', uid: b.uid, building: b.type, level: b.level, cost });
  },

  // ---------- land ----------
  'land/buyParcel'(s, { parcelId }, ev) {
    const err = D.parcelError(s, parcelId);
    if (err === 'owned') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: PARCELS[parcelId].cost - s.player.coins } : { road: PARCELS[parcelId]?.road });
    spend(s, PARCELS[parcelId].cost);
    D.region(s).parcels.push(parcelId);
    s.stats.parcels++;
    grantXp(s, XP.buyLand, ev);
    ev.push({ type: 'parcelBought', parcelId, cost: PARCELS[parcelId].cost });
  },
  'land/openRoad'(s, { roadId }, ev) {
    const err = D.roadError(s, roadId);
    if (err === 'owned') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: ROADS[roadId].cost - s.player.coins } : undefined);
    spend(s, ROADS[roadId].cost);
    D.region(s).roads.push(roadId);
    grantXp(s, XP.openRoad, ev);
    ev.push({ type: 'roadOpened', roadId, cost: ROADS[roadId].cost });
  },

  // ---------- staff ----------
  'staff/hire'(s, { type }, ev) {
    const err = D.staffError(s, type);
    if (err) return fail(err, err === 'coins' ? { missing: STAFF[type].cost - s.player.coins } : undefined);
    spend(s, STAFF[type].cost);
    const unit = { uid: uid(s, 'u'), type, assigned: null };
    s.staff.units.push(unit);
    const zone = STAFF[type].zone;
    if (D.region(s) && D.freeSlots(s, zone) > 0) unit.assigned = { regionId: s.world.currentRegion, zone };
    grantXp(s, XP.hire, ev);
    ev.push({ type: 'hired', uid: unit.uid, staff: type, assigned: !!unit.assigned });
  },
  'staff/assign'(s, { uid: id }, ev) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit || !D.region(s)) return fail('unknown');
    const zone = STAFF[unit.type].zone;
    if (unit.assigned?.regionId === s.world.currentRegion) return { noop: true };
    if (D.freeSlots(s, zone) <= 0) return fail('slotsFull');
    unit.assigned = { regionId: s.world.currentRegion, zone };
    ev.push({ type: 'assigned', uid: id, zone });
  },
  'staff/unassign'(s, { uid: id }, ev) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit) return fail('unknown');
    if (!unit.assigned) return { noop: true };
    unit.assigned = null;
    ev.push({ type: 'unassigned', uid: id });
  },

  // ---------- rounds (paid, exactly once) ----------
  'round/unlock'(s, { round }, ev) {
    if (!ROUNDS[round] || round > MAX_ROUND) return fail('unknown');
    if (s.player.round >= round) return { noop: true };
    if (round !== s.player.round + 1) return fail('order');
    const st = D.roundStatus(s);
    if (!st.levelOk) return fail('level', { minLevel: st.minLevel });
    if (s.player.coins < st.cost) return fail('coins', { missing: st.missing });
    spend(s, st.cost);
    s.player.round = round;
    // Round 2 reopens expired regions (they were "resting"); nothing else is reset.
    ev.push({ type: 'roundUnlocked', round, cost: st.cost });
  },

  // ---------- Level 10 region expiration ----------
  // Two-phase and idempotent: 'pending' (cinematic playing, gameplay paused) → execute → 'reset' (choose a new region).
  'expiry/execute'(s, _p, ev, ctx) {
    const ex = s.story.expiry;
    if (!ex) return fail('none');
    if (ex.status === 'reset') { s.story.phase = s.world.currentRegion ? 'play' : 'chooseRegion'; return { noop: true }; }
    const r = s.world.regions[ex.regionId];
    if (r) {
      ex.snapshot = { buildings: clone(r.buildings), plots: clone(r.plots), orders: clone(r.shop.orders), units: s.staff.units.filter(u => u.assigned?.regionId === ex.regionId).map(u => u.uid) };
      r.buildings = [];
      ensureStarters(s, r); // basic free buildings come back at level 1 when the region is revisited
      r.plots = {};
      r.shop = { orders: [], nextOrder: r.shop.nextOrder };
      r.status = 'expired';
      r.expiredAt = ctx.now;
      // Land ownership (parcels, roads) is kept on purpose.
    }
    for (const u of s.staff.units) if (u.assigned?.regionId === ex.regionId) u.assigned = null;
    ex.status = 'reset';
    ex.at = ctx.now;
    s.story.level10Done = true;
    s.world.currentRegion = null;
    s.story.phase = 'chooseRegion';
    ev.push({ type: 'regionExpired', regionId: ex.regionId });
  },

  // ---------- rebirth (credits independent from Rounds) ----------
  'rebirth/perform'(s, { blessing }, ev) {
    const err = D.rebirthError(s, blessing);
    if (err) return fail(err);
    s.rebirth.credits--;
    s.rebirth.used++;
    s.rebirth.blessings[blessing] = (s.rebirth.blessings[blessing] || 0) + 1;
    s.rebirth.history.push({ blessing, level: D.level(s), round: s.player.round });
    ev.push({ type: 'reborn', blessing, credits: s.rebirth.credits });
  },
  // Credits from a verified purchase. No real store is wired: only the dev/test profile may call this (ctx.dev).
  'rebirth/addCredits'(s, { amount, source }, ev, ctx) {
    if (!ctx.dev && source !== 'receipt') return fail('forbidden');
    if (source === 'receipt' && !ctx.verifiedReceipt) return fail('unverified');
    const n = Math.max(0, Math.min(99, amount | 0));
    s.rebirth.credits += n; s.rebirth.purchased += n;
    ev.push({ type: 'creditsAdded', amount: n, source });
  },

  // ---------- tutorial ----------
  'tutorial/set'(s, { step, done }) {
    if (Number.isFinite(step)) s.tutorial.step = Math.max(s.tutorial.step, step | 0);
    if (done === true) s.tutorial.done = true;
  },

  // ---------- dev / QA (test profile only) ----------
  'dev/grant'(s, { coins = 0, xp = 0, beans = 0 }, ev, ctx) {
    if (!ctx.dev) return fail('forbidden');
    if (coins) earn(s, coins);
    if (beans) s.inventory.beans += beans | 0;
    if (xp) grantXp(s, xp / D.xpMultiplier(s), ev);
  },
  'dev/ripen'(s, _p, ev, ctx) {
    if (!ctx.dev) return fail('forbidden');
    const r = D.region(s);
    if (!r) return;
    for (const p of Object.values(r.plots)) p.plantedAt = ctx.now - 1e9;
  },
};

export const ACTIONS = Object.keys(handlers);

/**
 * @param {object} state  current save (not mutated)
 * @param {{type:string, payload?:object, txId?:string}} action
 * @param {{now:number, dev?:boolean}} ctx
 */
export function apply(state, action, ctx = { now: Date.now() }) {
  const handler = handlers[action?.type];
  if (!handler) return { ok: false, state, events: [], error: 'unknownAction' };
  if (action.txId && state.tx.includes(action.txId)) return { ok: true, state, events: [], duplicate: true };
  if (PAUSABLE.test(action.type) && state.story.phase === 'expiry') return { ok: false, state, events: [], error: 'paused' };
  if (/^(farm|shop|build|land|staff)\//.test(action.type) && (state.story.phase !== 'play' || !state.world.currentRegion)) {
    return { ok: false, state, events: [], error: 'notPlaying' };
  }
  const draft = clone(state);
  const events = [];
  const result = handler(draft, action.payload || {}, events, ctx) || {};
  if (result.ok === false) return { ok: false, state, events: [], error: result.error, data: result.data };
  if (result.noop) return { ok: true, state, events: [], noop: true };
  if (action.txId) draft.tx = [...draft.tx, action.txId].slice(-TX_KEEP);
  draft.rev = (state.rev || 0) + 1;
  draft.updatedAt = ctx.now;
  return { ok: true, state: draft, events };
}
