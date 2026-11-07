// Pure reducer for Farm & Café V3. `apply(state, action, ctx)` → { ok, state, events, error }.
// The input state is never mutated: a successful action returns a new state object. All timing comes from ctx.now,
// randomness from action payloads, so every transition is deterministic and testable (tests/core/*.test.mjs).
import { AUTO, autoPrice, BEANS, startCoins, xpForLevel, STAFF_BREAKS, staffFee, unitFee, RECRUIT, TRAITS, PART_COST, QUALITY, TEND, UPKEEP, SHIFT, VITALS, CARE, RARE, ROBOT_WEAR, ROBOT_PARTS, SKILL, STAT_ORDER, statOf, statCost, startStats, unitLevel, energyMax, heatPerMin, partTier, taskLimit, MISTAKES, RIVAL, BOOKS, BUILDINGS, CROPS, DRINKS, STAFF, XP, REBIRTH, START, EXPIRY_LEVEL, levelForXp, MAX_LEVEL, levelGift, chestPrize, LOAN, loanOwed, VENUES, VENUE_ITEMS, RATING, REVIEW_REASONS, LEAVE_REASONS, FIELD, GOODS, ITEM_GOODS } from './config/economy.js';
import { PARCELS, ROADS, FIXED, PRE_TILLED, plotById, plotsOf } from './config/layout.js';
import { parseRegionId } from './config/world.js';
import { menuItemsOf } from './config/menus.js';
import { clone, normalizeRegion, normalizeStreet } from './state.js';
import * as D from './derive.js';

const TX_KEEP = 64;
// While the Level-10 expiration is pending, nothing that changes the economy may run.
const PAUSABLE = /^(farm|shop|build|land|prod|staff|rival|round|country|rebirth|level|loan)\//;

function fail(error, data) { return { ok: false, error, data }; }
// One game per region (founder rule, now core-enforced): a region already played as the other game refuses this game's
// actions. A region whose game is not picked yet (null) accepts both (tests, the combined economy sim).
const otherGame = (r, game) => !!r?.mode && r.mode !== game;
function sellGood(s, good, amount, ev) {
  if (otherGame(D.region(s), 'farm')) return fail('gameLocked');
  if (!own(GOODS, good)) return fail('unknown');
  const q = D.sellQuote(s, good, amount ?? Infinity);
  if (q.amount <= 0) return fail('noBeans');
  addGood(s, good, -q.amount);
  earn(s, q.coins, ev);
  s.stats.sold = (s.stats.sold || 0) + q.amount;
  if (good === 'beans') ev.push({ type: 'beansSold', amount: q.amount, coins: q.coins });
  ev.push({ type: 'goodsSold', parts: [q], amount: q.amount, coins: q.coins });
}

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
// Coin income. While a loan is open, LOAN.autoRepay of it goes to the debt first.
function earn(s, amount, ev) {
  let cut = 0;
  if (s.loan && s.loan.owed > 0 && amount > 0) {
    cut = Math.min(s.loan.owed, Math.round(amount * LOAN.autoRepay * 100) / 100);
    s.loan.owed = Math.round((s.loan.owed - cut) * 100) / 100;
    if (s.loan.owed <= 0) { s.loan = null; ev?.push({ type: 'loanRepaid' }); }
  }
  s.player.coins = Math.round((s.player.coins + amount - cut) * 100) / 100;
  s.stats.earned += amount;
}
// A gift's items into the save (coins / beans / free-hire tickets / auto runs).
function grantItems(s, items) {
  for (const it of items) {
    if (it.kind === 'coins') s.player.coins = Math.round((s.player.coins + it.amount) * 100) / 100;
    else if (it.kind === 'beans') s.inventory.beans += it.amount;
    else if (ITEM_GOODS.includes(it.kind)) addGood(s, it.kind, it.amount);
    else if (it.kind === 'hireTicket') s.rewards.tickets += it.amount;
    else if (it.kind === 'autoRun') s.autoplay.runs += it.amount;
  }
}
const uid = (s, prefix) => `${prefix}${s.nextUid++}`;
const own = D.own;
// Goods in storage: beans stay in inventory.beans (the café brews from them), the farm's processed goods in items.
function addGood(s, good, n) {
  if (good === 'beans') { s.inventory.beans = Math.max(0, (s.inventory.beans || 0) + n); return; }
  s.inventory.items ||= {};
  s.inventory.items[good] = Math.max(0, (s.inventory.items[good] || 0) + n);
}
// Pre-tilled fields of a lot (6 per field lot, the classic plot spots and ids) that are not on the land yet.
// ---------- staff helpers (docs/design/staff-manager.md §8 books / ledger / journal) ----------
const r2 = n => Math.round(n * 100) / 100;
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const uidNum = u => parseInt(String(u.uid).replace(/\D+/g, ''), 10) || 0;
// Journal: newest first, BOOKS.journalKeep entries.
function journal(s, now, type, u, extra) {
  const e = { at: now, type, uid: u?.uid ?? null, name: u?.name ?? null };
  if (extra !== undefined) e.extra = extra;
  s.staff.journal = [e, ...(s.staff.journal || [])].slice(0, BOOKS.journalKeep);
}
// Team ledger: one row per game minute (floor(now / 60000)), the last BOOKS.ledgerKeep kept.
function ledger(s, now, key, amount) {
  if (!(amount > 0)) return;
  const min = Math.floor(now / 60000);
  const rows = (s.staff.ledger ||= []);
  let row = rows[rows.length - 1];
  if (!row || row.min !== min) { row = { min, earned: 0, spent: 0 }; rows.push(row); }
  row[key] = r2(row[key] + amount);
  if (rows.length > BOOKS.ledgerKeep) s.staff.ledger = rows.slice(-BOOKS.ledgerKeep);
}
const bookOf = (u, now) => (u.book ||= { jobs: 0, earned: 0, spent: 0, mistakes: 0, since: now });
function unitSpent(s, u, amount, now) { if (!(amount > 0)) return; const b = bookOf(u, now); b.spent = r2(b.spent + amount); ledger(s, now, 'spent', amount); }
function unitEarned(s, u, amount, now) { if (!(amount > 0)) return; const b = bookOf(u, now); b.earned = r2(b.earned + amount); ledger(s, now, 'earned', amount); }
// A new unit joins the current region's zone: on shift when a working slot is free, else benched.
function makeUnit(s, { type, trait, name, gender, perk, paid = 0 }, now) {
  const def = STAFF[type];
  const unit = { uid: uid(s, 'u'), type, assigned: null, active: false, paid, book: { jobs: 0, earned: 0, spent: 0, mistakes: 0, since: now } };
  if (def.kind === 'robot') Object.assign(unit, { task: 'auto', parts: { battery: 0, motor: 0, cooler: 0, frame: 0 }, partsSpent: 0, heat: 0, wear: 100 });
  else {
    if (trait) Object.assign(unit, { trait, name, gender });
    if (perk) unit.perk = perk;
    Object.assign(unit, { stats: startStats(trait, perk), points: 0, xp: 0, tasks: [], water: 0, ...VITALS.start });
  }
  s.staff.units.push(unit);
  if (D.region(s)) { unit.assigned = { regionId: s.world.currentRegion, zone: def.zone }; unit.active = D.freeSlots(s, def.zone) > 0; }
  return unit;
}
// A unit leaves the team (unpaid, poached, let go, fired / sold): poach cleared, journal + staffLeft event.
function removeUnit(s, u, now, reason, ev, extra = {}) {
  s.staff.units = s.staff.units.filter(x => x.uid !== u.uid);
  if (s.staff.poach?.uid === u.uid) s.staff.poach = null;
  journal(s, now, 'left', u, reason);
  ev.push({ type: 'staffLeft', uid: u.uid, name: u.name || null, staff: u.type, reason, ...extra });
}
function addPreTilled(r, lotId) {
  if (!PRE_TILLED[PARCELS[lotId]?.kind]) return 0;
  r.fields ||= [];
  let n = 0;
  for (const p of plotsOf(lotId)) if (!r.fields.some(f => f.id === p.id)) { r.fields.push({ id: p.id, x: p.x, z: p.z }); n++; }
  return n;
}
// Build XP is earned once per copy slot (region.peak = most copies ever built of a type), so build → remove → build
// never farms XP.
function firstBuildXp(r, type) {
  r.peak ||= {};
  const n = type === 'field' ? r.fields.length : r.buildings.filter(b => b.type === type).length;
  if (n <= (r.peak[type] || 0)) return false;
  r.peak[type] = n;
  return true;
}
const rot4 = rot => ((Math.round(Number(rot) || 0) % 4) + 4) % 4;
// The region's street state; regions built before the café street (not yet re-normalized) get the default.
function streetOf(r) {
  if (!r.street || !Array.isArray(r.street.open) || !r.street.rating) r.street = normalizeStreet(r.street);
  return r.street;
}

export function freshRegion(s, now) {
  const r = normalizeRegion({ status: 'active', enteredAt: now });
  r.parcels = Object.values(PARCELS).filter(p => p.starter).map(p => p.id);
  r.roads = Object.values(ROADS).filter(x => x.open).map(x => x.id);
  r.buildings = starterBuildings(s);
  r.fields = [];
  for (const id of r.parcels) addPreTilled(r, id); // the starter field F1 comes with its 6 fields
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
  // A farm with no field at all gets its starter fields back where they are free (never softlocked).
  r.fields ||= [];
  if (!r.fields.length) for (const p of Object.values(PARCELS)) if (p.starter && PRE_TILLED[p.kind]) {
    for (const pl of plotsOf(p.id)) if (!r.buildings.some(b => !BUILDINGS[b.type]?.walkable && D.footprint(b.type, b.x, b.z, b.rot)[0] < pl.x + 1.5 && D.footprint(b.type, b.x, b.z, b.rot)[2] > pl.x - 1.5
      && D.footprint(b.type, b.x, b.z, b.rot)[1] < pl.z + 1.5 && D.footprint(b.type, b.x, b.z, b.rot)[3] > pl.z - 1.5)) r.fields.push({ id: pl.id, x: pl.x, z: pl.z });
  }
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
  // Teacher talk done (or skipped): the World Gate opens. Grants the free auto runs once (no rebirth credits any more).
  'story/teacherDone'(s) {
    if (!s.autoplay.granted) { s.autoplay.runs += AUTO.freeRuns; s.autoplay.granted = true; }
    s.story.teacherMet = true;
    if (s.story.phase === 'teacher' || s.story.phase === 'intro' || s.story.phase === 'select') s.story.phase = 'gate';
  },
  'story/seen'(s, { key }) { if (typeof key === 'string') s.story.seen[key] = true; },

  // ---------- world ----------
  // Buy access to a region with coins (free for the first region, and once after the Level-10 expiration).
  'world/unlockRegion'(s, { regionId }, ev) {
    const cost = D.regionUnlockCost(s, regionId);
    if (cost === null) return fail('unknown');
    if (D.ownsRegion(s, regionId)) return { noop: true };
    if (s.player.coins < cost) return fail('coins', { missing: cost - s.player.coins });
    spend(s, cost);
    if (cost === 0 && s.world.ownedRegions.length > 0) s.world.freeUnlocks = Math.max(0, (s.world.freeUnlocks || 0) - 1);
    s.world.ownedRegions.push(regionId);
    ev.push({ type: 'regionUnlocked', regionId, cost });
  },
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
    s.mode = r.mode || null; // the region's game; null → the HUD asks (only the games this country offers)
    if (!s.world.startCountry) s.world.startCountry = parseRegionId(regionId).countryId;
    s.story.phase = 'play';
    ev.push({ type: 'regionEntered', regionId });
  },

  // ---------- farm ----------
  // crooked: a staff mistake (realm roll, mistakeChance) — the plot grows MISTAKES.crookedSlow slower.
  'farm/plant'(s, { plotId, crop = 'robusta', crooked = false, uid: by = null }, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('unknown');
    if (otherGame(r, 'farm')) return fail('gameLocked');
    // Fields are placeables now: a plot id exists only as a field of this region (classic ids F1-1… stay valid).
    if (!D.plotOf(s, plotId)) return fail(plotById(plotId) ? 'notOwned' : 'unknown');
    if (r.plots[plotId]) return fail('occupied');
    if (!D.cropUnlocked(s, crop)) return fail('locked');
    const cost = D.seedCost(s, crop);
    if (s.player.coins < cost) return fail('coins', { missing: cost - s.player.coins });
    spend(s, cost);
    r.plots[plotId] = { crop, plantedAt: ctx.now };
    if (crooked === true) { r.plots[plotId].slow = true; const u = by != null && D.unitOf(s, by); if (u) bookOf(u, ctx.now).mistakes++; }
    // Farm tutorial: seeds planted before the first harvest ripen fast (no long idle wait for a new player).
    if (!s.stats.harvested && !s.tutorial.done && !s.tutorial.farmDone) r.plots[plotId].fast = true;
    s.stats.planted++;
    ev.push({ type: 'planted', plotId, crop, cost, free: cost === 0, crooked: crooked === true });
  },
  // unripe: a staff mistake (picked a bit early) — one bean less (never below 1).
  // uid: a staff unit harvested it (its stars, unitStars); none = the player: 3★ when fresh (QUALITY.freshSeconds).
  'farm/harvest'(s, { plotId, unripe = false, uid: by = null }, ev, ctx) {
    const r = D.region(s);
    if (!r || !D.own(r.plots, plotId)) return fail('empty');
    const st = D.plotState(s, plotId, ctx.now);
    if (st.stage !== 'ready') return fail('notReady', { remainingMs: st.remainingMs });
    const cap = D.capacity(s);
    if (D.stored(s) >= cap) return fail('storageFull', { capacity: cap }); // every good shares the storehouse
    const unit = by != null ? D.unitOf(s, by) : null;
    const pl = r.plots[plotId];
    const fresh = ctx.now - pl.plantedAt - D.plotGrowMs(s, pl, plotId) <= QUALITY.freshSeconds * 1000;
    const stars = unit ? D.unitStars(unit) : fresh ? 3 : 1;
    const beans = Math.max(1, D.starYield(s, st.crop, stars) - (unripe === true ? 1 : 0));
    s.inventory.beans += beans; // soft cap: one harvest may overflow; next one is refused
    if (unit) { unitEarned(s, unit, beans * BEANS.sellPrice, ctx.now); if (unripe === true) bookOf(unit, ctx.now).mistakes++; } // book: beans valued at the sell price
    delete r.plots[plotId];
    s.stats.harvested++;
    grantXp(s, CROPS[st.crop].xp, ev);
    ev.push({ type: 'harvested', plotId, crop: st.crop, beans, stars, xp: CROPS[st.crop].xp, unripe: unripe === true });
  },

  // Farm game: sell a good at the storehouse (all of it by default) → coins. farm/sellBeans = beans (older HUD).
  'farm/sell'(s, { good = 'beans', item, amount } = {}, ev) { return sellGood(s, item ?? good, amount, ev); },
  'farm/sellBeans'(s, { amount } = {}, ev) { return sellGood(s, 'beans', amount, ev); },
  // One tap: sell everything stored (each good at its price).
  'farm/sellAll'(s, _p, ev) {
    if (otherGame(D.region(s), 'farm')) return fail('gameLocked');
    const q = D.sellAllQuote(s);
    if (q.amount <= 0) return fail('noBeans');
    for (const part of q.parts) { addGood(s, part.good, -part.amount); if (part.good === 'beans') ev.push({ type: 'beansSold', amount: part.amount, coins: part.coins }); }
    earn(s, q.coins, ev);
    s.stats.sold = (s.stats.sold || 0) + q.amount;
    ev.push({ type: 'goodsSold', parts: q.parts, amount: q.amount, coins: q.coins });
  },

  // ---------- café ----------
  // Café game: buy beans from the supplier (one pack by default; the grace beans are free when the café is stuck).
  'shop/buyBeans'(s, { amount = BEANS.buyPack } = {}, ev) {
    if (otherGame(D.region(s), 'cafe')) return fail('gameLocked'); // a farm region cannot import beans (no buy → sell loop)
    const q = D.beanBuyQuote(s, amount);
    if (q.error) return fail(q.error, q.error === 'coins' ? { missing: q.missing } : undefined);
    spend(s, q.cost);
    s.inventory.beans += q.amount;
    s.stats.bought = (s.stats.bought || 0) + q.amount;
    ev.push({ type: 'beansBought', amount: q.amount, cost: q.cost, free: q.free });
  },
  // The café stands still while the player is on the farm: pause stores the moment, resume shifts every order's
  // timestamps by the paused time (patience, seat patience and brewing continue where they were).
  'shop/pause'(s, _p, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('noRegion');
    if (r.shop.pausedAt) return { noop: true };
    r.shop.pausedAt = ctx.now;
  },
  'shop/resume'(s, _p, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('noRegion');
    if (!r.shop.pausedAt) return { noop: true };
    const d = Math.max(0, ctx.now - r.shop.pausedAt);
    for (const o of r.shop.orders) for (const k of ['at', 'takenAt', 'brewStart']) if (Number.isFinite(o[k])) o[k] += d;
    r.shop.pausedAt = 0;
  },
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
    // Local menu (config/menus.js): the customer asks for one of this country's drinks of that base.
    const items = menuItemsOf(parseRegionId(s.world.currentRegion)?.countryId, drink);
    if (items.length) order.item = items[Math.floor(((Math.min(.999999, Math.max(0, roll)) * 7919) % 1) * items.length)];
    r.shop.orders.push(order);
    ev.push({ type: 'customerArrived', orderId: order.id, drink, item: order.item ?? null });
  },
  // A customer gives up: queue customers after SHOP.patienceSeconds, seated customers (order taken, no drink yet)
  // after SHOP.seatPatienceSeconds from takenAt — those leave ANGRY. A ready cup still counts as waiting (no refund).
  // reason (café street incidents, realm/incidents.js): patience (default) | crowd | fight | switch | closed | bar —
  // copied to the event for the HUD toasts; 'fight' counts in stats.fights (an order leaves only once).
  'shop/customerLeft'(s, { orderId, reason } = {}, ev, ctx) {
    const r = D.region(s);
    const o = r?.shop.orders.find(x => x.id === orderId);
    if (!o) return fail('unknown');
    if (o.stage !== 'waiting' && !D.seatPatienceOver(o, ctx.now)) return fail('notYet');
    const why = LEAVE_REASONS.includes(reason) ? reason : 'patience';
    r.shop.orders.splice(r.shop.orders.indexOf(o), 1);
    if (why === 'fight') s.stats.fights = (s.stats.fights || 0) + 1;
    ev.push({ type: 'customerLeft', orderId, drink: o.drink, angry: o.stage !== 'waiting', reason: why });
  },
  'shop/takeOrder'(s, { orderId } = {}, ev, ctx) {
    const r = D.region(s);
    const o = r?.shop.orders.find(x => x.stage === 'waiting' && (orderId == null || x.id === orderId));
    if (!o) return fail('noCustomer');
    if (D.seatsUsed(s) >= D.seatCount(s)) return fail('noSeat', { seats: D.seatCount(s) });
    o.stage = 'taken';
    o.takenAt = ctx.now;
    ev.push({ type: 'orderTaken', orderId: o.id, drink: o.drink });
  },
  // uid: the staff unit brewing (its stars; hard drinks need a level-QUALITY.hardLevel worker); none = the player, 3★.
  'shop/brew'(s, { orderId, uid: by = null } = {}, ev, ctx) {
    const r = D.region(s);
    if (!r) return fail('noRegion');
    const brewing = r.shop.orders.filter(x => x.stage === 'brewing').length;
    const o = r.shop.orders.find(x => x.stage === 'taken' && (orderId == null || x.id === orderId));
    if (!o) return fail('noOrder');
    if (brewing >= D.brewSlots(s)) return fail('busy');
    const unit = by != null ? D.unitOf(s, by) : null;
    if (by != null && !unit) return fail('unknown');
    if (!D.canBrew(unit, o.drink)) return fail('hard');
    const need = DRINKS[o.drink].beans;
    if (s.inventory.beans < need) return fail('beans', { need, have: s.inventory.beans });
    s.inventory.beans -= need;
    o.stage = 'brewing'; o.brewStart = ctx.now; o.brewMs = D.brewMs(s, o.drink); o.stars = unit ? D.unitStars(unit) : 3;
    ev.push({ type: 'brewStarted', orderId: o.id, drink: o.drink, ms: o.brewMs, stars: o.stars });
  },
  // A worker dropped a ready cup (staff mistake): the order goes back to "taken" and must be brewed again.
  'shop/spill'(s, { orderId, uid: by = null } = {}, ev, ctx) {
    const o = D.region(s)?.shop.orders.find(x => x.id === orderId && x.stage === 'brewing');
    if (!o) return fail('notReady');
    const u = by != null && D.unitOf(s, by);
    if (u) bookOf(u, ctx.now).mistakes++;
    o.stage = 'taken'; delete o.brewStart; delete o.brewMs; delete o.stars;
    ev.push({ type: 'spilled', orderId, drink: o.drink });
  },
  // uid (optional): the staff unit serving the cup — its book earns the price (a charming one adds RARE.charmingBonus).
  'shop/serve'(s, { orderId, uid: by = null } = {}, ev, ctx) {
    const r = D.region(s);
    const o = r?.shop.orders.find(x => x.stage === 'brewing' && ctx.now - x.brewStart >= x.brewMs && (orderId == null || x.id === orderId));
    if (!o) return fail('notReady');
    const stars = o.stars || 1;
    const unit = by != null ? D.unitOf(s, by) : null;
    const price = Math.round(D.starPrice(s, o.drink, stars) * (unit?.perk === 'charming' ? 1 + RARE.charmingBonus : 1));
    earn(s, price, ev);
    if (unit) unitEarned(s, unit, price, ctx.now);
    r.shop.orders.splice(r.shop.orders.indexOf(o), 1);
    s.stats.served++;
    grantXp(s, DRINKS[o.drink].xp, ev);
    ev.push({ type: 'served', orderId: o.id, drink: o.drink, coins: price, stars, xp: DRINKS[o.drink].xp });
  },

  // ---------- café street: 4 shops (docs/design/cafe-street.md) ----------
  // Unlock a street shop (lemon / tea / bar) with coins; level gates stay below the Level-10 incident.
  'shop/openVenue'(s, { venue } = {}, ev) {
    const err = D.venueError(s, venue);
    if (err === 'owned') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: VENUES[venue].cost - s.player.coins } : err === 'level' ? { level: VENUES[venue].level } : undefined);
    const st = streetOf(D.region(s));
    spend(s, VENUES[venue].cost);
    st.open.push(venue);
    grantXp(s, XP.build, ev);
    ev.push({ type: 'venueOpened', venue, cost: VENUES[venue].cost });
  },
  // A venue vendor served one walk-in (customers are simulated by the realm; `item` is rolled there). No beans.
  'shop/venueSale'(s, { venue, item } = {}, ev) {
    if (venue === 'cafe' || !own(VENUES, venue)) return fail('unknown');
    if (!D.venueOpen(s, venue)) return fail('locked');
    if (typeof item !== 'string' || !VENUES[venue].items.includes(item)) return fail('unknown');
    const it = VENUE_ITEMS[item];
    earn(s, it.price, ev);
    s.stats.venueSold = (s.stats.venueSold || 0) + 1;
    grantXp(s, it.xp, ev);
    ev.push({ type: 'venueSale', venue, item, coins: it.price, xp: it.xp });
  },
  // A customer's 1–5★ review of an open shop: moving average, weight max(RATING.minWeight, 1/(n+1)).
  'shop/review'(s, { venue, stars, reason } = {}, ev) {
    if (!own(VENUES, venue)) return fail('unknown');
    if (!D.venueOpen(s, venue)) return fail('locked');
    const n0 = Number(stars);
    if (typeof stars !== 'number' || !Number.isFinite(n0)) return fail('unknown');
    const st = Math.min(5, Math.max(1, Math.round(n0)));
    const rt = streetOf(D.region(s)).rating[venue];
    const w = Math.max(RATING.minWeight, 1 / (rt.n + 1));
    rt.avg = Math.round(Math.min(5, Math.max(1, rt.avg + (st - rt.avg) * w)) * 100) / 100;
    rt.n++;
    s.stats.reviews = (s.stats.reviews || 0) + 1;
    const why = REVIEW_REASONS.includes(reason) ? reason : 'venue';
    ev.push({ type: 'reviewed', venue, stars: st, avg: rt.avg, reason: why });
  },

  // ---------- building ----------
  // Places a building, a decoration or a crop field (type 'field', Farm World 2.0). The k-th copy costs more
  // (D.buildCost); fields are free inside the allowance of the field lots you own.
  'build/place'(s, { type, x, z, rot = 0 }, ev) {
    const err = D.buildError(s, type);
    if (err) return fail(err, err === 'coins' ? { missing: D.buildCost(s, type) - s.player.coins } : err === 'limit' ? { level: D.nextLimitLevel(s, type) } : undefined);
    const r4 = type === 'field' ? 0 : rot4(rot);
    const pos = D.snapPosition(type, Number(x), Number(z), r4);
    const perr = D.placementError(s, type, pos.x, pos.z, r4);
    if (perr) return fail(perr);
    const def = D.defOf(type), cost = D.buildCost(s, type), r = D.region(s);
    spend(s, cost);
    if (type === 'field') {
      const f = { id: uid(s, 'fd'), x: pos.x, z: pos.z };
      r.fields.push(f);
      if (firstBuildXp(r, 'field')) grantXp(s, FIELD.xp, ev);
      ev.push({ type: 'fieldPlaced', plotId: f.id, cost });
      return;
    }
    const b = { uid: uid(s, 'b'), type, x: pos.x, z: pos.z, rot: r4, level: 1, spent: cost };
    r.buildings.push(b);
    s.stats.built++;
    if (firstBuildXp(r, type)) grantXp(s, def.xp ?? XP.build, ev);
    ev.push({ type: 'built', uid: b.uid, building: type, cost });
  },
  // Moves a building or a field (a growing field keeps its crop: the crop is keyed by the field id).
  'build/move'(s, { uid: id, x, z, rot = 0 }, ev) {
    const r = D.region(s);
    const f = r?.fields?.find(v => v.id === id);
    if (f) {
      const pos = D.snapPosition('field', Number(x), Number(z), 0);
      const perr = D.placementError(s, 'field', pos.x, pos.z, 0, f.id);
      if (perr) return fail(perr);
      if (pos.x === f.x && pos.z === f.z) return { noop: true };
      Object.assign(f, { x: pos.x, z: pos.z });
      ev.push({ type: 'moved', uid: f.id, field: true });
      return;
    }
    const b = r?.buildings.find(v => v.uid === id);
    if (!b) return fail('unknown');
    if (BUILDINGS[b.type].fixed) return fail('fixed');
    const r4 = rot4(rot);
    const pos = D.snapPosition(b.type, Number(x), Number(z), r4);
    const perr = D.placementError(s, b.type, pos.x, pos.z, r4, b.uid);
    if (perr) return fail(perr);
    Object.assign(b, { x: pos.x, z: pos.z, rot: r4 });
    ev.push({ type: 'moved', uid: b.uid });
  },
  // Removes a building (refund = def.refund × coins spent on it) or an empty field (refund = D.fieldRefund).
  // Never starters / fixed, never while a batch runs or waits, never a barn whose room is in use.
  'build/remove'(s, { uid: id } = {}, ev) {
    const err = D.removeError(s, id);
    if (err) return fail(err);
    const r = D.region(s), refund = D.removeRefund(s, id);
    const fi = r.fields.findIndex(f => f.id === id);
    if (fi >= 0) { r.fields.splice(fi, 1); delete r.plots[id]; }
    else { const bi = r.buildings.findIndex(b => b.uid === id); ev.push({ type: 'removedBuilding', building: r.buildings[bi].type }); r.buildings.splice(bi, 1); }
    if (refund > 0) s.player.coins = Math.round((s.player.coins + refund) * 100) / 100; // a refund is not income (no XP, no loan cut)
    ev.push({ type: 'removed', uid: id, field: fi >= 0, refund });
  },
  'build/upgrade'(s, { uid: id }, ev) {
    const b = D.region(s)?.buildings.find(v => v.uid === id);
    const err = D.upgradeError(s, b);
    if (err) return fail(err, err === 'coins' ? { missing: D.upgradeCost(b.type, b.level) - s.player.coins } : undefined);
    const cost = D.upgradeCost(b.type, b.level);
    b.spent = D.spentOn(b) + cost;
    spend(s, cost);
    b.level++;
    s.stats.upgraded++;
    grantXp(s, XP.upgrade, ev);
    ev.push({ type: 'upgraded', uid: b.uid, building: b.type, level: b.level, cost });
  },

  // ---------- production (Farm World 2.0, docs/farm-world-2.0/FARM-ECONOMY-BALANCE.md) ----------
  // Starts one batch: takes the inputs and the fuel fee now; the duration, outputs and XP are fixed at the start
  // (an upgrade later never changes a running batch). One batch per building; duplicates run in parallel.
  'prod/start'(s, { uid: id } = {}, ev, ctx) {
    const b = D.region(s)?.buildings.find(v => v.uid === id);
    const err = D.prodError(s, b);
    if (err) {
      const miss = err === 'noInput' ? D.missingInput(s, b) : null;
      return fail(err, miss ? { need: miss.good, amount: miss.need, have: miss.have } : err === 'coins' ? { missing: D.recipeIO(b).fee - s.player.coins } : undefined);
    }
    const io = D.recipeIO(b);
    for (const [good, n] of Object.entries(io.in)) addGood(s, good, -n);
    if (io.fee > 0) spend(s, io.fee);
    b.job = { recipe: io.recipe, at: ctx.now, ms: io.ms, out: io.out, xp: io.xp };
    s.stats.batches = (s.stats.batches || 0) + 1;
    ev.push({ type: 'prodStarted', uid: b.uid, building: b.type, recipe: io.recipe, in: io.in, fee: io.fee, ms: io.ms });
  },
  // Collects a finished batch into the storehouse (soft cap like harvest: refused only when storage is already full).
  'prod/collect'(s, { uid: id } = {}, ev, ctx) {
    const b = D.region(s)?.buildings.find(v => v.uid === id);
    const err = D.collectError(s, b, ctx.now);
    if (err) return fail(err, err === 'notDone' ? { remainingMs: b.job.at + b.job.ms - ctx.now } : err === 'storageFull' ? { capacity: D.capacity(s) } : undefined);
    const { out, xp, recipe } = b.job;
    for (const [good, n] of Object.entries(out || {})) if (own(GOODS, good)) addGood(s, good, n);
    delete b.job;
    s.stats.produced = (s.stats.produced || 0) + 1;
    grantXp(s, xp || 0, ev);
    ev.push({ type: 'prodCollected', uid: b.uid, building: b.type, recipe, out, xp: xp || 0 });
  },

  // ---------- land ----------
  'land/buyParcel'(s, { parcelId }, ev) {
    const err = D.parcelError(s, parcelId);
    if (err === 'owned') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: PARCELS[parcelId].cost - s.player.coins } : { road: PARCELS[parcelId]?.road });
    const before = new Set(D.openRoads(s));
    spend(s, PARCELS[parcelId].cost);
    D.region(s).parcels.push(parcelId);
    const fields = addPreTilled(D.region(s), parcelId); // a field lot arrives ready-tilled with its 6 fields
    s.stats.parcels++;
    grantXp(s, XP.buyLand, ev);
    ev.push({ type: 'parcelBought', parcelId, cost: PARCELS[parcelId].cost, fields });
    const opened = D.openRoads(s).filter(id => !before.has(id));
    if (opened.length) ev.push({ type: 'roadsOpened', parcelId, roads: opened }); // the farm paths grow with the land
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

  // ---------- staff (docs/design/staff-manager.md) ----------
  // Hiring cap: a zone's team is at most the player level (D.hireCap; err hireLimit { level: the level that allows one more }).
  // A new unit joins the current region's zone, on shift when a working slot is free (slots = player level per zone),
  // else on the bench (bench workers cost upkeep).
  'staff/hire'(s, { type }, ev, ctx) {
    const err = D.staffError(s, type);
    if (err) return fail(err, err === 'coins' ? { missing: STAFF[type].cost - s.player.coins } : err === 'hireLimit' ? { level: D.zoneUnits(s, STAFF[type].zone).length + 1 } : undefined);
    const ticket = D.freeHire(s);
    if (ticket) s.rewards.tickets--; else spend(s, STAFF[type].cost);
    const unit = makeUnit(s, { type, paid: ticket ? 0 : STAFF[type].cost }, ctx.now);
    grantXp(s, XP.hire, ev);
    journal(s, ctx.now, 'hired', unit);
    ev.push({ type: 'hired', uid: unit.uid, staff: type, assigned: !!unit.assigned, active: unit.active, free: ticket });
  },
  // Hires applicant `index` from the zone's board (trait + name + rare perk kept on the unit), then draws a new board.
  'staff/recruit'(s, { zone, index }, ev, ctx) {
    const err = D.recruitError(s, zone, index);
    const a = D.applicants(s, zone)[index];
    if (err) return fail(err, err === 'coins' ? { missing: a.cost - s.player.coins } : err === 'hireLimit' ? { level: D.zoneUnits(s, zone).length + 1 } : undefined);
    const ticket = D.freeHire(s);
    if (ticket) s.rewards.tickets--; else spend(s, a.cost);
    const unit = makeUnit(s, { type: a.type, trait: a.trait, name: a.name, gender: a.gender, perk: a.perk, paid: ticket ? 0 : a.cost }, ctx.now);
    const pool = D.poolOf(s, zone);
    s.staff.pool ||= {};
    s.staff.pool[zone] = { seed: (Math.imul(pool.seed ^ s.nextUid, 0x9e3779b1) >>> 1) | 0, at: ctx.now };
    grantXp(s, XP.hire, ev);
    journal(s, ctx.now, 'hired', unit);
    ev.push({ type: 'hired', uid: unit.uid, staff: a.type, name: a.name, trait: a.trait, perk: a.perk || null, assigned: !!unit.assigned, active: unit.active, free: ticket });
  },
  // New applicants: free once RECRUIT.refreshMinutes have passed, otherwise for RECRUIT.refreshCost coins (`paid`).
  'staff/refreshPool'(s, { zone, roll = 0, paid = false }, ev, ctx) {
    if (!RECRUIT.worker[zone]) return fail('unknown');
    const due = D.poolRefreshIn(s, zone, ctx.now) <= 0;
    if (!due && !paid) return fail('tooSoon');
    if (!due) { if (s.player.coins < RECRUIT.refreshCost) return fail('coins', { missing: RECRUIT.refreshCost - s.player.coins }); spend(s, RECRUIT.refreshCost); }
    s.staff.pool ||= {};
    s.staff.pool[zone] = { seed: Math.floor(Math.min(.999999, Math.max(0, Number(roll) || 0)) * 2147483647), at: ctx.now };
    ev.push({ type: 'poolRefreshed', zone, paid: !due });
  },
  // On shift / bench (§1). Going on shift needs a free working slot in the unit's zone here.
  'staff/setActive'(s, { uid: id, active }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit || unit.assigned?.regionId !== s.world.currentRegion) return fail('unknown');
    const on = active === true;
    if (!!unit.active === on) return { noop: true };
    if (on && D.freeSlots(s, unit.assigned.zone) <= 0) return fail('slotsFull', { slots: D.slots(s, unit.assigned.zone) });
    unit.active = on;
    journal(s, ctx.now, on ? 'activated' : 'benched', unit);
    ev.push({ type: 'staffActive', uid: id, active: on });
  },
  // "Đổi ca": tired / hungry / sulking (or low-energy) workers go to the bench, the best rested bench workers (highest
  // level first) take the free slots. Robots are never touched.
  'staff/swapShift'(s, { zone }, ev, ctx) {
    if (!RECRUIT.worker[zone]) return fail('unknown');
    const here = D.assignedUnits(s, s.world.currentRegion, zone).filter(u => STAFF[u.type].kind === 'worker');
    const worn = u => (u.energy ?? 100) < SHIFT.tiredBelow || D.unitBlocked(u, ctx.now) || ['tired', 'hungry', 'sulking'].includes(D.unitState(u, ctx.now));
    const out = here.filter(u => u.active && worn(u));
    for (const u of out) { u.active = false; journal(s, ctx.now, 'benched', u); }
    const rested = here.filter(u => !u.active && !out.includes(u) && (u.energy ?? 100) >= SHIFT.restedFrom && !worn(u))
      .sort((a, b) => unitLevel(b) - unitLevel(a) || uidNum(a) - uidNum(b));
    const inn = rested.slice(0, D.freeSlots(s, zone));
    for (const u of inn) { u.active = true; journal(s, ctx.now, 'activated', u); }
    if (!out.length && !inn.length) return { noop: true };
    ev.push({ type: 'shiftSwapped', zone, out: out.map(u => u.uid), in: inn.map(u => u.uid) });
  },
  // Bench upkeep (§2), dispatched by the realm about every minute while playing. The first call only starts the clock;
  // a long gap (offline) is charged for at most UPKEEP.maxCatchUpMinutes. A worker the player cannot pay loses morale
  // instead (no debt) and leaves when it reaches 0.
  'staff/upkeep'(s, _p, ev, ctx) {
    if (!s.staff.upkeepAt) { s.staff.upkeepAt = ctx.now; return; }
    const mins = Math.min(UPKEEP.maxCatchUpMinutes, Math.max(0, (ctx.now - s.staff.upkeepAt) / 60000));
    if (mins <= 0) return { noop: true };
    s.staff.upkeepAt = ctx.now;
    const k = mins / UPKEEP.perMinutes;
    let paid = 0;
    const unpaid = [];
    for (const u of [...s.staff.units].sort((a, b) => uidNum(a) - uidNum(b))) {
      const share = r2(D.upkeepOf(u) * k);
      if (!(share > 0)) continue;
      if (s.player.coins >= share) { spend(s, share); unitSpent(s, u, share, ctx.now); paid += share; continue; }
      u.morale = r2(clampN((u.morale ?? VITALS.start.morale) - UPKEEP.unpaidMorale * k, 0, 100));
      unpaid.push(u.uid);
      if (u.morale <= 0) removeUnit(s, u, ctx.now, 'unpaid', ev);
    }
    ev.push({ type: 'upkeepPaid', coins: r2(paid), unpaid, minutes: r2(mins) });
  },
  // Vitals (§3 workers, §4 robots), batched by the realm every few seconds per unit: `work` / `rest` seconds (each
  // clamped to VITALS.maxBatchSeconds), robots also `jobs` finished. A stopped / benched / lunching unit cannot work,
  // so its work time counts as rest. Expired timers (lunch, overheat cool-down) are cleared here.
  'staff/vitals'(s, { uid: id, work = 0, rest = 0, jobs = 0 }, ev, ctx) {
    const u = D.unitOf(s, id);
    if (!u) return fail('unknown');
    const sec = v => clampN(Number(v) || 0, 0, VITALS.maxBatchSeconds);
    let w = sec(work), r = sec(rest);
    const n = clampN(Math.floor(Number(jobs) || 0), 0, 20);
    const before = D.unitState(u, ctx.now);
    let cleared = false;
    if (Number.isFinite(u.breakUntil) && ctx.now >= u.breakUntil) { delete u.breakUntil; cleared = true; }
    if (u.stopped?.kind === 'overheat' && Number.isFinite(u.stopped.until) && ctx.now >= u.stopped.until) {
      delete u.stopped; cleared = true;
      ev.push({ type: 'staffResumed', uid: id, kind: 'overheat', fee: 0 });
    }
    if (!w && !r && !n && !cleared) return { noop: true };
    if (u.stopped || Number.isFinite(u.breakUntil) || !u.active) { r += w; w = 0; }
    if (STAFF[u.type].kind === 'worker') {
      const drain = u.perk === 'tireless' ? RARE.tirelessDrain : 1;
      const restMul = u.active ? 1 : VITALS.benchRestMul;
      u.energy = r2(clampN((u.energy ?? 100) - w / 60 * VITALS.energyDrainPerMin * drain + r / 60 * VITALS.energyRestPerMin * restMul, 0, energyMax(u)));
      const hunger = statOf(u, 'stamina') >= VITALS.staminaHungerFrom ? VITALS.staminaHungerMul : 1;
      u.fullness = r2(clampN((u.fullness ?? 100) - w / 60 * VITALS.hungerPerMin * hunger, 0, 100));
      let morale = u.morale ?? VITALS.start.morale;
      if (u.energy <= 0) morale -= w / 60 * VITALS.moraleOverworkPerMin; // working while exhausted sours the mood
      if (u.trait === 'funny') morale += (w + r) / 60 * VITALS.funnyMoraleRegenPerMin;
      u.morale = r2(clampN(morale, 0, 100));
    } else {
      u.heat = r2(clampN((u.heat || 0) + w / 60 * heatPerMin(u) - r / 60 * ROBOT_WEAR.coolPerMin, 0, 100));
      u.wear = r2(clampN((u.wear ?? 100) - n * ROBOT_WEAR.wearPerJob * ROBOT_PARTS.frame.wearMul[partTier(u, 'frame')], 0, 100));
      if (u.heat >= 100 && !u.stopped) {
        u.stopped = { kind: 'overheat', at: ctx.now, until: ctx.now + ROBOT_WEAR.overheatSeconds * 1000, fee: CARE.cool };
        journal(s, ctx.now, 'overheat', u);
        ev.push({ type: 'staffStopped', uid: id, kind: 'overheat', fee: CARE.cool });
      }
    }
    const after = D.unitState(u, ctx.now);
    if (after !== before) ev.push({ type: 'staffState', uid: id, from: before, to: after });
  },
  // A robot jammed on a finished job (the realm rolls D.jamChance per job): stopped until knocked (free) or repaired.
  'staff/jam'(s, { uid: id }, ev, ctx) {
    const u = D.unitOf(s, id);
    if (!u || STAFF[u.type].kind !== 'robot') return fail('unknown');
    if (u.stopped) return { noop: true };
    u.stopped = { kind: 'jam', at: ctx.now, fee: CARE.repair };
    journal(s, ctx.now, 'jam', u);
    ev.push({ type: 'staffStopped', uid: id, kind: 'jam', fee: CARE.repair });
  },
  // Care (§3): one fix per problem, free or paid (CARE). `roll` decides whether nagging works.
  'staff/care'(s, { uid: id, kind, roll = 0 }, ev, ctx) {
    const u = D.unitOf(s, id);
    const err = D.careError(s, u, kind, ctx.now);
    if (err) return fail(err, err === 'coins' ? { missing: D.careCost(u, kind) - s.player.coins } : undefined);
    const cost = D.careCost(u, kind);
    if (cost > 0) { spend(s, cost); unitSpent(s, u, cost, ctx.now); }
    const stopKind = u.stopped?.kind || null;
    const unstop = () => { delete u.stopped; ev.push({ type: 'staffResumed', uid: id, kind: stopKind, fee: cost }); };
    let ok = true;
    switch (kind) {
      case 'nag':
        ok = (Number(roll) || 0) < CARE.nagChance;
        if (ok) unstop();
        u.morale = r2(clampN((u.morale ?? VITALS.start.morale) - CARE.nagMorale, 0, 100)); // nagging always stings
        break;
      case 'bonusSmall': case 'recharge': case 'knock': case 'repair': unstop(); break;
      case 'coffee': u.energy = r2(Math.min(energyMax(u), (u.energy ?? 0) + CARE.coffeeEnergy)); break;
      case 'food': u.fullness = 100; break;
      case 'lunch': u.breakUntil = ctx.now + CARE.lunchSeconds * 1000; u.fullness = 100; break;
      case 'bonus': u.morale = r2(Math.min(100, (u.morale ?? VITALS.start.morale) + CARE.bonusMorale)); break;
      case 'rest': u.active = false; journal(s, ctx.now, 'benched', u); break;
      case 'cool': u.heat = 0; unstop(); break;
      case 'service': u.wear = 100; break;
    }
    journal(s, ctx.now, kind === 'nag' ? 'nagged' : 'cared', u, kind === 'nag' ? { ok } : kind);
    ev.push({ type: 'staffCared', uid: id, kind, cost, ok });
  },
  // Finished jobs (batched by the realm): the unit's book counts them; a worker also gets XP (× trait) and every
  // SKILL.xpPerPoint XP turns into a skill point (banked without a cap). Robots never learn.
  'staff/workDone'(s, { uid: id, n = 1 }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit) return fail('unknown');
    const k = Math.max(1, Math.min(20, n | 0));
    bookOf(unit, ctx.now).jobs += k;
    if (STAFF[unit.type].kind !== 'worker') return;
    let xp = r2((unit.xp || 0) + k * (TRAITS[unit.trait]?.xpMul ?? 1)), gained = 0;
    while (xp >= SKILL.xpPerPoint) { xp = r2(xp - SKILL.xpPerPoint); gained++; }
    unit.xp = xp;
    unit.points = (unit.points || 0) + gained;
    if (gained) ev.push({ type: 'staffReady', uid: id, name: unit.name || null, staff: unit.type, points: unit.points });
  },
  // Per-stat upgrade (§5): stat n → n+1 costs n points + SKILL.coinPerLevel × n coins.
  'staff/upgradeStat'(s, { uid: id, stat }, ev, ctx) {
    const unit = D.unitOf(s, id);
    const err = D.statError(s, unit, stat);
    if (err) {
      const c = unit && STAT_ORDER.includes(stat) ? statCost(statOf(unit, stat)) : null;
      return fail(err, err === 'coins' ? { missing: c.coins - s.player.coins } : err === 'points' ? { need: c.points, have: unit.points || 0 } : undefined);
    }
    const n = statOf(unit, stat), c = statCost(n);
    spend(s, c.coins);
    unit.points -= c.points;
    unit.stats = { ...Object.fromEntries(STAT_ORDER.map(k => [k, statOf(unit, k)])), [stat]: n + 1 };
    delete unit.level;
    unitSpent(s, unit, c.coins, ctx.now);
    journal(s, ctx.now, 'upgraded', unit, { stat, to: n + 1 });
    ev.push({ type: 'statUpgraded', uid: id, stat, to: n + 1, coins: c.coins, points: c.points, name: unit.name || null, staff: unit.type });
  },
  // Old single-level training, kept for older callers: raises `stat` (default: the lowest stat that can go up now).
  'staff/train'(s, { uid: id, stat }, ev, ctx) {
    const unit = D.unitOf(s, id);
    const err = D.trainError(s, unit);
    if (err === 'maxLevel') return { noop: true };
    if (stat == null && err) return fail(err);
    const pick = stat ?? [...STAT_ORDER].sort((a, b) => statOf(unit, a) - statOf(unit, b)).find(k => !D.statError(s, unit, k));
    return handlers['staff/upgradeStat'](s, { uid: id, stat: pick }, ev, ctx);
  },
  // Tending: pay TEND.fee, a farm worker (working, not on a break) then waters up to TEND.plots growing plots.
  'staff/tend'(s, { uid: id }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit || STAFF[unit.type]?.kind !== 'worker' || STAFF[unit.type].zone !== 'farm' || unit.stopped) return fail('unknown');
    if ((unit.water || 0) > 0) return { noop: true };
    if (s.player.coins < TEND.fee) return fail('coins', { missing: TEND.fee - s.player.coins });
    spend(s, TEND.fee);
    unitSpent(s, unit, TEND.fee, ctx.now);
    unit.water = TEND.plots;
    ev.push({ type: 'tendStarted', uid: id, fee: TEND.fee, plots: TEND.plots });
  },
  // One watered plot (by a tending worker): it ripens TEND.speedup × its grow time sooner; once per planting.
  'farm/water'(s, { plotId, uid: id }, ev, ctx) {
    const unit = D.unitOf(s, id), r = D.region(s);
    const pl = r && D.own(r.plots, plotId);
    if (!unit || !(unit.water > 0) || !pl) return fail('unknown');
    if (pl.watered || D.plotState(s, plotId, ctx.now).stage === 'ready') return { noop: true };
    pl.plantedAt -= Math.round(D.plotGrowMs(s, pl) * TEND.speedup);
    pl.watered = true;
    unit.water--;
    ev.push({ type: 'watered', plotId, uid: id, left: unit.water });
  },
  // A robot's one task: 'auto' or one of ROBOT_TASKS[type]. Free, any time. A worker given one task here = setTasks.
  'staff/setTask'(s, { uid: id, task }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (unit && STAFF[unit.type]?.kind === 'worker') return handlers['staff/setTasks'](s, { uid: id, tasks: task === 'auto' ? [] : [task] }, ev, ctx);
    if (D.taskError(unit, task)) return fail('unknown');
    if ((unit.task || 'auto') === task) return { noop: true };
    unit.task = task;
    ev.push({ type: 'taskSet', uid: id, task });
  },
  // A worker's job types (§6): [] = auto; at most taskLimit (1, 2 from smart 3).
  'staff/setTasks'(s, { uid: id, tasks }, ev) {
    const unit = D.unitOf(s, id);
    const list = Array.isArray(tasks) ? [...new Set(tasks)] : null;
    const err = D.tasksError(unit, list);
    if (err) return fail(err, err === 'tooMany' ? { max: taskLimit(unit) } : undefined);
    const now = unit.tasks || [];
    if (now.length === list.length && now.every((t, i) => t === list[i])) return { noop: true };
    unit.tasks = list;
    ev.push({ type: 'tasksSet', uid: id, tasks: list });
  },
  // Robot hardware: battery (longer work, cheaper recharge), motor (faster, hotter), cooler (less heat), frame (fewer
  // jams, slower wear). What was spent is remembered for the sell refund.
  'staff/upgradePart'(s, { uid: id, part }, ev, ctx) {
    const unit = D.unitOf(s, id);
    const err = D.partError(s, unit, part);
    if (err === 'maxLevel') return { noop: true };
    if (err) return fail(err, err === 'coins' ? { missing: D.partPrice(unit, part) - s.player.coins } : err === 'level' ? { level: PART_COST.tier3Level } : undefined);
    const price = D.partPrice(unit, part);
    spend(s, price);
    unit.parts = { battery: 0, motor: 0, cooler: 0, frame: 0, ...unit.parts, [part]: (unit.parts?.[part] | 0) + 1 };
    unit.partsSpent = (unit.partsSpent || 0) + price;
    unitSpent(s, unit, price, ctx.now);
    ev.push({ type: 'partUpgraded', uid: id, part, tier: unit.parts[part] });
  },
  // Moves a unit to the current region (on shift when a slot is free, else benched).
  'staff/assign'(s, { uid: id }, ev) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit || !D.region(s)) return fail('unknown');
    const zone = STAFF[unit.type].zone;
    if (unit.assigned?.regionId === s.world.currentRegion) return { noop: true };
    unit.assigned = { regionId: s.world.currentRegion, zone };
    unit.active = false;
    unit.active = D.freeSlots(s, zone) > 0;
    ev.push({ type: 'assigned', uid: id, zone, active: unit.active });
  },
  // A unit stops working: worker slacks on the phone (kind 'phone'), robot runs out of battery (kind 'battery').
  // Triggered by the realm's staff simulation; persisted so a reload keeps it stopped.
  'staff/stop'(s, { uid: id }, ev, ctx) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit || !STAFF[unit.type]) return fail('unknown');
    if (unit.stopped) return { noop: true };
    const kind = STAFF_BREAKS[STAFF[unit.type].kind].kind;
    unit.stopped = { kind, at: ctx.now, fee: unitFee(unit) };
    if (kind === 'phone') journal(s, ctx.now, 'slacked', unit);
    ev.push({ type: 'staffStopped', uid: id, kind, fee: unit.stopped.fee });
  },
  // Player taps the coin bubble: pay the fee, the unit works again (robot recharged / worker back to work).
  'staff/resume'(s, { uid: id }, ev, ctx) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit) return fail('unknown');
    if (!unit.stopped) return { noop: true };
    const fee = unit.stopped.fee ?? unitFee(unit);
    if (s.player.coins < fee) return fail('coins', { missing: fee - s.player.coins });
    spend(s, fee);
    unitSpent(s, unit, fee, ctx.now);
    const kind = unit.stopped.kind;
    if (kind === 'overheat') unit.heat = 0;
    delete unit.stopped;
    ev.push({ type: 'staffResumed', uid: id, kind, fee });
  },
  'staff/unassign'(s, { uid: id }, ev) {
    const unit = s.staff.units.find(u => u.uid === id);
    if (!unit) return fail('unknown');
    if (!unit.assigned) return { noop: true };
    unit.assigned = null;
    unit.active = false;
    ev.push({ type: 'unassigned', uid: id });
  },
  // A realm-only mistake (wrong table) counted in the unit's book. Spill / unripe / crooked count in their own actions.
  'staff/mistake'(s, { uid: id, kind }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit || !Object.hasOwn(MISTAKES.rates, kind)) return fail('unknown');
    bookOf(unit, ctx.now).mistakes++;
    ev.push({ type: 'staffMistake', uid: id, kind });
  },
  // Fire a worker (FIRE.worker × hire price back) or sell a robot (FIRE.robot × price + FIRE.robotParts × hardware).
  'staff/fire'(s, { uid: id }, ev, ctx) {
    const unit = D.unitOf(s, id);
    if (!unit) return fail('unknown');
    const refund = D.fireRefund(unit);
    if (refund > 0) s.player.coins = r2(s.player.coins + refund); // a refund is not income (no XP, no loan cut)
    removeUnit(s, unit, ctx.now, STAFF[unit.type].kind === 'robot' ? 'sold' : 'fired', ev, { refund });
  },
  // MVP (§8, realm timer every BOOKS.mvpMinutes): the worker who earned the most since the last call; everyone cheers.
  'staff/mvp'(s, _p, ev, ctx) {
    let best = null, gain = 0;
    for (const u of s.staff.units) {
      const g = (u.book?.earned || 0) - (u.book?.mvpBase || 0);
      if (STAFF[u.type].kind === 'worker' && g > gain) { best = u; gain = g; }
    }
    if (!best) return { noop: true };
    for (const u of s.staff.units) if (u.book) u.book.mvpBase = u.book.earned;
    for (const u of s.staff.units) if (STAFF[u.type].kind === 'worker') u.morale = r2(Math.min(100, (u.morale ?? VITALS.start.morale) + BOOKS.mvpMorale));
    s.staff.mvp = { uid: best.uid, name: best.name || null, earned: r2(gain), at: ctx.now };
    ev.push({ type: 'mvp', uid: best.uid, name: best.name || null, earned: r2(gain) });
  },

  // ---------- rivals (§7) ----------
  // A rival owner visits (realm timer every RIVAL.everyMinutes): with roll < chance they try to poach the
  // highest-level low-morale worker of the zone (else the best rare one). A happy worker (morale ≥ refuseMorale)
  // refuses; otherwise the player has keepSeconds to keep them (staff/keep) or let them go.
  'rival/visit'(s, { zone, roll = 1 }, ev, ctx) {
    if (!RECRUIT.worker[zone]) return fail('unknown');
    if (s.staff.poach || !((Number(roll) || 0) < RIVAL.chance)) return { noop: true };
    const pool = D.assignedUnits(s, s.world.currentRegion, zone).filter(u => STAFF[u.type].kind === 'worker');
    const best = list => [...list].sort((a, b) => unitLevel(b) - unitLevel(a) || uidNum(a) - uidNum(b))[0];
    const target = best(pool.filter(u => (u.morale ?? VITALS.start.morale) < RIVAL.targetMorale)) || best(pool.filter(u => u.perk));
    if (!target) return { noop: true };
    const rival = RIVAL.names[zone];
    if ((target.morale ?? VITALS.start.morale) >= RIVAL.refuseMorale) {
      journal(s, ctx.now, 'poachRefused', target, rival);
      ev.push({ type: 'poachRefused', uid: target.uid, name: target.name || null, rival });
      return;
    }
    s.staff.poach = { uid: target.uid, zone, until: ctx.now + RIVAL.keepSeconds * 1000, fee: RIVAL.keepFeePerLevel * unitLevel(target) };
    journal(s, ctx.now, 'poachStarted', target, rival);
    ev.push({ type: 'poachStarted', uid: target.uid, name: target.name || null, rival, fee: s.staff.poach.fee, until: s.staff.poach.until });
  },
  'staff/keep'(s, { uid: id }, ev, ctx) {
    const p = s.staff.poach, unit = D.unitOf(s, id);
    if (!p || p.uid !== id || !unit) return fail('unknown');
    if (s.player.coins < p.fee) return fail('coins', { missing: p.fee - s.player.coins });
    spend(s, p.fee);
    unitSpent(s, unit, p.fee, ctx.now);
    unit.morale = r2(Math.min(100, (unit.morale ?? VITALS.start.morale) + RIVAL.keepMorale));
    s.staff.poach = null;
    journal(s, ctx.now, 'kept', unit);
    ev.push({ type: 'poachKept', uid: id, fee: p.fee });
  },
  'staff/letGo'(s, { uid: id }, ev, ctx) {
    const p = s.staff.poach, unit = D.unitOf(s, id);
    if (!p || p.uid !== id || !unit) return fail('unknown');
    const refund = Math.round(RIVAL.letGoRefund * (unit.paid || 0));
    if (refund > 0) s.player.coins = r2(s.player.coins + refund);
    removeUnit(s, unit, ctx.now, 'letGo', ev, { refund });
  },
  // Time is up (realm, once now > until): the worker leaves for the rival, nothing back.
  'rival/resolve'(s, _p, ev, ctx) {
    const p = s.staff.poach;
    if (!p || ctx.now <= p.until) return { noop: true };
    const unit = D.unitOf(s, p.uid);
    s.staff.poach = null;
    if (unit) removeUnit(s, unit, ctx.now, 'poached', ev);
  },

  // ---------- level gifts ----------
  // Opens the gift box of a level reached (lowest pending first). Chest levels draw one surprise prize with `roll`.
  'level/claim'(s, { level, roll = 0 }, ev) {
    const pending = D.pendingGifts(s);
    if (!pending.length) return { noop: true };
    const lvl = level ?? pending[0];
    if (!pending.includes(lvl)) return pending.length && (s.rewards.claimed || []).includes(lvl) ? { noop: true } : fail('level');
    const chest = D.isChestLevel(lvl);
    const prize = chest ? chestPrize(roll) : null;
    const items = chest ? prize.items(lvl) : levelGift(lvl);
    grantItems(s, items);
    s.rewards.claimed.push(lvl);
    ev.push({ type: 'giftOpened', level: lvl, chest, prize: prize?.id || null, items });
  },

  // ---------- loans ----------
  'loan/take'(s, { amount }, ev, ctx) {
    const err = D.loanError(s, amount);
    if (err) return fail(err);
    const open = D.loanOf(s); // loans stack: the new pack adds to the open debt
    s.loan = open
      ? { amount: open.amount + amount, owed: Math.round((open.owed + loanOwed(amount)) * 100) / 100, takenAt: open.takenAt }
      : { amount, owed: loanOwed(amount), takenAt: ctx.now };
    s.player.coins = Math.round((s.player.coins + amount) * 100) / 100;
    ev.push({ type: 'loanTaken', amount, owed: s.loan.owed });
  },
  // Pays the debt with the coins at hand (all of it when possible).
  'loan/repay'(s, _p, ev) {
    const loan = D.loanOf(s);
    if (!loan) return { noop: true };
    const pay = Math.min(loan.owed, Math.floor(s.player.coins));
    if (pay <= 0) return fail('coins', { missing: Math.ceil(loan.owed) });
    spend(s, pay);
    loan.owed = Math.round((loan.owed - pay) * 100) / 100;
    if (loan.owed <= 0) { s.loan = null; ev.push({ type: 'loanRepaid' }); } else ev.push({ type: 'loanPaid', amount: pay, owed: loan.owed });
  },

  // ---------- Level 10 region expiration ----------
  // Two-phase and idempotent: 'pending' (cinematic playing, gameplay paused) → execute → 'reset' (choose a new region).
  'expiry/execute'(s, _p, ev, ctx) {
    const ex = s.story.expiry;
    if (!ex) return fail('none');
    if (ex.status === 'reset') { s.story.phase = s.world.currentRegion ? 'play' : 'chooseRegion'; return { noop: true }; }
    // Founder rule: the incident is a FULL restart. Nothing is kept except who you are (character, story, rebirth
    // credits/blessings, auto runs, tutorial done). The new region starts with exactly 1 empty field and an empty café.
    // A full copy of the save is written to `<key>-pre-expiry` by the store just before this runs.
    ex.snapshot = { coins: s.player.coins, xp: s.player.xp, round: s.player.round, beans: s.inventory.beans, items: { ...s.inventory.items },
      regions: Object.keys(s.world.regions), units: s.staff.units.length };
    s.player.coins = startCoins();
    s.player.xp = 0;
    s.player.round = 1;
    s.inventory.beans = 0;
    s.inventory.items = Object.fromEntries(ITEM_GOODS.map(g => [g, 0])); // processed goods go too (full restart)
    s.staff.units = [];
    Object.assign(s.staff, { poach: null, ledger: [], journal: [], upkeepAt: 0, mvp: null });
    s.rewards = { claimed: [], tickets: 0 }; // gifts are earned again from level 1
    // The loan is NOT wiped: a debt is a debt, it carries over to the new region (and is never announced in advance).
    s.world.regions = { [ex.regionId]: { ...normalizeRegion({ status: 'expired' }), expiredAt: ctx.now } };
    s.world.ownedRegions = [];   // the next region is free again (first-region rule)
    s.world.freeUnlocks = 0;
    ex.status = 'reset';
    ex.at = ctx.now;
    s.story.level10Done = true;
    s.world.currentRegion = null;
    s.mode = null; // the next region picks its game again
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

  // ---------- auto play ----------
  'auto/start'(s, _p, ev, ctx) {
    if (s.autoplay.active && ctx.now < s.autoplay.active.endsAt) return { noop: true };
    if (s.autoplay.runs <= 0) return fail('noRuns');
    if (s.story.phase !== 'play' || !s.world.currentRegion) return fail('notPlaying');
    s.autoplay.runs--;
    s.autoplay.active = { startedAt: ctx.now, endsAt: ctx.now + AUTO.runSeconds * 1000 };
    ev.push({ type: 'autoStarted', runs: s.autoplay.runs, endsAt: s.autoplay.active.endsAt });
  },
  // Buy one more auto run with coins (in-game currency only).
  'auto/buy'(s, _p, ev) {
    const price = autoPrice(s.autoplay.bought || 0);
    if (s.player.coins < price) return fail('coins', { missing: price - s.player.coins });
    spend(s, price);
    s.autoplay.runs++;
    s.autoplay.bought = (s.autoplay.bought || 0) + 1;
    ev.push({ type: 'autoBought', price, runs: s.autoplay.runs });
  },
  'auto/stop'(s, { reason = 'user' } = {}, ev) {
    if (!s.autoplay.active) return { noop: true };
    s.autoplay.active = null;
    ev.push({ type: 'autoStopped', reason });
  },

  // ---------- tutorial ----------
  // done + track ('farm' | 'cafe'): skip that game's tutorial; done alone: skip both.
  'tutorial/set'(s, { step, done, track }) {
    if (Number.isFinite(step)) s.tutorial.step = Math.max(s.tutorial.step, step | 0);
    if (done === true) {
      if (track === 'farm' || track === 'cafe') s.tutorial[`${track}Done`] = true;
      else { s.tutorial.farmDone = true; s.tutorial.cafeDone = true; }
      if (s.tutorial.farmDone && s.tutorial.cafeDone) s.tutorial.done = true;
    }
  },

  // ---------- game choice (farm | café) ----------
  // The game the current region is played as, picked on its first entry: one of the games its country offers
  // (some countries offer only one). Once per region.
  'play/chooseGame'(s, { game }) {
    if (game !== 'farm' && game !== 'cafe') return fail('invalid');
    const r = D.region(s);
    if (!r) return fail('phase');
    if (r.mode) return { noop: true };
    if (!D.currentGames(s).includes(game)) return fail('gameLocked');
    r.mode = game;
    s.mode = game;
  },
  // The game on screen (follows the view): only the current region's game.
  'play/setMode'(s, { mode }) {
    if (mode !== 'farm' && mode !== 'cafe') return fail('invalid');
    if (!D.canPlay(s, mode)) return fail('gameLocked');
    if (s.mode === mode) return { noop: true };
    s.mode = mode;
  },

  // ---------- dev / QA (test profile only) ----------
  'dev/grant'(s, { coins = 0, xp = 0, beans = 0 }, ev, ctx) {
    if (!ctx.dev) return fail('forbidden');
    const fin = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
    coins = fin(coins); xp = fin(xp);
    if (coins > 0) earn(s, coins, ev);
    if (beans) s.inventory.beans += beans | 0;
    if (xp > 0) grantXp(s, xp / D.xpMultiplier(s), ev);
  },
  // QA URL params (?profile=test&coins=…&beans=…&level=…): set exact values (test profile only).
  'dev/set'(s, { coins, beans, level }, ev, ctx) {
    if (!ctx.dev) return fail('forbidden');
    const n = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    if (n(coins) != null) s.player.coins = Math.max(0, Math.min(1e15, n(coins)));
    if (n(beans) != null) s.inventory.beans = Math.max(0, Math.min(1e9, Math.floor(n(beans))));
    if (n(level) != null) {
      // Below the Level-10 incident unless it already happened (setting XP never triggers it here).
      const cap = s.story.level10Done ? MAX_LEVEL : EXPIRY_LEVEL - 1;
      s.player.xp = xpForLevel(Math.max(1, Math.min(cap, Math.floor(n(level)))));
    }
  },
  'dev/ripen'(s, _p, ev, ctx) {
    if (!ctx.dev) return fail('forbidden');
    const r = D.region(s);
    if (!r) return;
    for (const p of Object.values(r.plots)) p.plantedAt = ctx.now - 1e9;
  },
};

export const ACTIONS = Object.keys(handlers);
// The café loop is frozen while the café is paused (player on the farm): no customers, no orders moving.
// The whole street pauses with it (venue sales and reviews); unlocking a venue (shop/openVenue) still works.
const CAFE_LOOP = new Set(['shop/spawnCustomer', 'shop/customerLeft', 'shop/takeOrder', 'shop/brew', 'shop/serve', 'shop/spill', 'shop/venueSale', 'shop/review']);

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
  if (/^(farm|shop|build|land|prod|staff|rival)\//.test(action.type) && (state.story.phase !== 'play' || !state.world.currentRegion)) {
    return { ok: false, state, events: [], error: 'notPlaying' };
  }
  if (CAFE_LOOP.has(action.type) && D.shopPaused(state)) return { ok: false, state, events: [], error: 'cafeClosed' };
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
