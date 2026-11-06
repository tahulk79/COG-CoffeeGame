// Edge cases of the V3 reducer, save normalization and migration (complements tests/core/core.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, playing, T0 } from './helpers.mjs';
import * as D from '../../src/core/derive.js';
import { apply, ACTIONS } from '../../src/core/game.js';
import { normalizeSave, createSave, SCHEMA } from '../../src/core/state.js';
import { migrateLegacy } from '../../src/core/migrate.js';
import { createStore, createMemoryStorage } from '../../src/core/store.js';
import { BUILDINGS, ROUNDS, START, EXPIRY_LEVEL, CROPS, xpForLevel, levelForXp } from '../../src/core/config/economy.js';

// A rich mid-game state: round 3, lots of coins, credits, Level 12 (Level-10 event already done).
function rich(opts) {
  const h = playing(opts);
  Object.assign(h.state.player, { coins: 1e6, xp: xpForLevel(12), round: 3 });
  h.state.story.level10Done = true;
  return h;
}
function toLevel10(h) {
  h.state.player.xp = xpForLevel(EXPIRY_LEVEL) - 1;
  h.state.inventory.beans += 3;
  h.must('shop/spawnCustomer', { roll: 0 });
  h.must('shop/takeOrder'); h.must('shop/brew'); h.tick(20_000); h.must('shop/serve');
  assert.equal(h.state.story.phase, 'expiry');
}

// ---------- robustness ----------
const JUNK = [undefined, null, 0, 7, 'x', true, [], {}, { uid: {} }, { uid: 'b9999' }, { plotId: 'Z9-9' }, { plotId: 42 }, { crop: 'mocha' },
  { type: 'castle', x: 0, z: 0 }, { type: 'roaster', x: NaN, z: Infinity, rot: -3 }, { type: 'roaster', x: '12', z: '11', rot: 'r' },
  { parcelId: 'ZZ' }, { roadId: 'nowhere' }, { countryId: 'xx' }, { regionId: {} }, { regionId: 'vn-9' }, { round: 'two' }, { round: -1 },
  { blessing: 'luck' }, { orderId: {} }, { step: 1e99 }, { step: 'a' }, { gender: 'robot' }, { gender: 'male', name: { a: 1 } }, { key: 5 },
  { coins: 'lots' }, { amount: 'many', source: 'dev' }];

test('edge: every action with junk payloads returns a result, never throws, never corrupts coins', () => {
  for (const dev of [false, true]) {
    const h = rich({ dev });
    h.state.rebirth.credits = 3;
    h.must('farm/plant', { plotId: 'F1-1' });
    for (const type of ACTIONS) for (const payload of JUNK) {
      let r;
      assert.doesNotThrow(() => { r = apply(h.state, { type, payload }, { now: h.now + 1e7, dev }); }, `${type} ${JSON.stringify(payload)}`);
      assert.equal(typeof r.ok, 'boolean');
      if (r.ok) {
        // Every action, dev/grant included, must keep coins and xp finite and non-negative.
        assert.ok(Number.isFinite(r.state.player.xp) && r.state.player.xp >= 0, `${type} ${JSON.stringify(payload)} → xp ${r.state.player.xp}`);
        assert.ok(Number.isFinite(r.state.player.coins) && r.state.player.coins >= 0, `${type} ${JSON.stringify(payload)} → coins ${r.state.player.coins}`);
      }
    }
  }
  assert.equal(apply(createSave(T0), { type: 'nope' }).error, 'unknownAction');
  assert.equal(apply(createSave(T0), null).error, 'unknownAction');
});

// Regression: ids are looked up with own-property checks (D.own), so Object.prototype names never pass validation.
test('edge: Object.prototype names as ids are rejected (prototype-key lookups)', () => {
  const h = rich({ dev: false });
  h.state.rebirth.credits = 3;
  const cases = [
    ['farm/harvest', { plotId: '__proto__' }], ['farm/harvest', { plotId: 'constructor' }],
    ['build/place', { type: 'toString', x: 12, z: 11 }], ['build/place', { type: '__proto__', x: 12, z: 11 }],
    ['land/buyParcel', { parcelId: 'toString' }], ['land/openRoad', { roadId: 'toString' }],
    ['staff/hire', { type: 'toString' }], ['staff/hire', { type: '__proto__' }],
    ['country/unlock', { countryId: 'toString' }], ['rebirth/perform', { blessing: 'toString' }],
  ];
  for (const [type, payload] of cases) {
    let r;
    assert.doesNotThrow(() => { r = apply(h.state, { type, payload }, { now: h.now, dev: false }); }, `${type} ${JSON.stringify(payload)} threw`);
    assert.equal(r.ok, false, `${type} ${JSON.stringify(payload)} accepted`);
  }
});

// ---------- building ----------
test('edge: rotation changes the footprint — a rotated building may not overlap another building', () => {
  const h = rich();
  // 1×1 tables at (1,113) → [0,112,2,114]. Pastry case is 2×1 cells (4×2 m).
  h.must('build/place', { type: 'tables', x: 1, z: 113 });
  assert.deepEqual(D.footprint('pastry', 1, 111, 0), [-1, 110, 3, 112]);
  assert.deepEqual(D.footprint('pastry', 1, 111, 1), [0, 109, 2, 113]);
  assert.equal(D.placementError(h.state, 'pastry', 1, 111, 0), null);
  assert.equal(D.placementError(h.state, 'pastry', 1, 111, 2), null);
  assert.equal(D.placementError(h.state, 'pastry', 1, 111, 1), 'overlap');
  assert.equal(D.placementError(h.state, 'pastry', 1, 111, 3), 'overlap');
  const coins = h.state.player.coins;
  assert.equal(h.act('build/place', { type: 'pastry', x: 1, z: 111, rot: 1 }).error, 'overlap');
  assert.equal(h.act('build/place', { type: 'pastry', x: 1, z: 111, rot: 5 }).error, 'overlap', 'rot is taken modulo 4');
  assert.equal(h.state.player.coins, coins, 'nothing charged for a refused placement');
  h.must('build/place', { type: 'pastry', x: 1, z: 111, rot: 0 });
  const pastry = h.region().buildings.find(b => b.type === 'pastry');
  // Rotating it in place (move with rot 1) would now hit the tables.
  assert.equal(h.act('build/move', { uid: pastry.uid, x: 1, z: 111, rot: 1 }).error, 'overlap');
  assert.equal(h.region().buildings.find(b => b.uid === pastry.uid).rot, 0);
  // Moving the tables onto the pastry's footprint is refused too, moving onto itself is fine.
  const tables = h.region().buildings.find(b => b.type === 'tables');
  assert.equal(h.act('build/move', { uid: tables.uid, x: 1, z: 111 }).error, 'overlap');
  h.must('build/move', { uid: tables.uid, x: 1, z: 113, rot: 1 });
  // Starter counters are fixed and their footprint also blocks rotated placements.
  const counter = h.region().buildings.find(b => b.type === 'orderCounter');
  assert.equal(D.placementError(h.state, 'pastry', -3, 104, 1), 'overlap');
  assert.equal(h.act('build/move', { uid: counter.uid, x: 12, z: 12 }).error, 'fixed');
});

test('edge: upgrades stop at the Round cap, reach level 8 in Round 3, then maxLevel', () => {
  const h = rich();
  h.state.player.round = 1;
  const silo = () => h.region().buildings.find(b => b.type === 'silo');
  h.must('build/upgrade', { uid: silo().uid }); h.must('build/upgrade', { uid: silo().uid });
  assert.equal(silo().level, 3);
  assert.equal(h.act('build/upgrade', { uid: silo().uid }).error, 'roundCap');
  h.state.player.round = 2;
  while (silo().level < 5) h.must('build/upgrade', { uid: silo().uid });
  assert.equal(h.act('build/upgrade', { uid: silo().uid }).error, 'roundCap');
  h.state.player.round = 3;
  const coins = h.state.player.coins;
  while (silo().level < 8) h.must('build/upgrade', { uid: silo().uid });
  assert.equal(silo().level, 8);
  assert.equal(coins - h.state.player.coins, BUILDINGS.silo.upgrade.slice(4).reduce((a, b) => a + b, 0));
  assert.equal(D.upgradeCost('silo', 8), null);
  const before = h.state.player.coins;
  assert.equal(h.act('build/upgrade', { uid: silo().uid }).error, 'maxLevel');
  assert.equal(h.state.player.coins, before);
  assert.equal(D.capacity(h.state), BUILDINGS.silo.effect.capacity[7]);
  // Decorations never upgrade.
  h.must('build/place', { type: 'flowers', x: -1, z: 103 });
  assert.equal(h.act('build/upgrade', { uid: h.region().buildings.find(b => b.type === 'flowers').uid }).error, 'maxLevel');
});

// ---------- staff ----------
test('edge: staff assigned in region A stays assigned there when travelling to B; bonus only applies in A', () => {
  const h = rich();
  const base = Math.round(CROPS.robusta.growSeconds * 1000);
  h.must('staff/hire', { type: 'farmhand' });
  const unit = h.state.staff.units[0];
  assert.deepEqual(unit.assigned, { regionId: 'vn-1', zone: 'farm' });
  const inA = D.growMs(h.state, 'robusta');
  assert.ok(inA < base);
  h.go('vn-2');
  assert.deepEqual(h.state.staff.units[0].assigned, { regionId: 'vn-1', zone: 'farm' }, 'travelling does not move staff');
  assert.equal(D.growMs(h.state, 'robusta'), base, 'no bonus in region B');
  assert.equal(D.assignedUnits(h.state).length, 0);
  assert.equal(D.freeSlots(h.state, 'farm'), 3);
  // A plant in B grows at base speed.
  h.must('farm/plant', { plotId: 'F1-1' });
  assert.equal(D.plotState(h.state, 'F1-1', h.now + inA).stage, 'growing');
  // Re-assigning in B moves it (and removes the bonus from A).
  h.must('staff/assign', { uid: unit.uid });
  assert.equal(D.growMs(h.state, 'robusta'), inA);
  h.go('vn-1');
  assert.equal(D.growMs(h.state, 'robusta'), base);
  assert.equal(D.assignedUnits(h.state, 'vn-2').length, 1);
});

// ---------- Level-10 expiry ----------
test('edge: expired region can be revisited later (no Round needed) with starters back at Lv 1 and owned parcels kept', () => {
  const h = playing();
  h.state.player.coins = 1e6;
  h.state.player.xp = xpForLevel(8);
  h.must('land/buyParcel', { parcelId: 'F2' });
  h.must('land/buyParcel', { parcelId: 'C2' });
  h.must('build/place', { type: 'roaster', x: 2, z: 111 });
  const silo = h.region().buildings.find(b => b.type === 'silo');
  h.must('build/upgrade', { uid: silo.uid });
  h.must('farm/plant', { plotId: 'F2-1' });
  toLevel10(h);
  h.must('expiry/execute');
  assert.equal(h.act('world/enterRegion', { regionId: 'vn-1' }).error, 'expired');
  const coins = h.state.player.coins;
  h.go('vn-2');
  assert.equal(h.state.player.coins, coins, 'the first new region after the expiry is free');
  assert.equal(D.regionAccess(h.state, 'vn-1').ok, true);
  h.go('vn-1');
  const r = h.region();
  assert.equal(h.state.world.currentRegion, 'vn-1');
  assert.equal(r.status, 'active');
  assert.deepEqual(r.buildings.map(b => [b.type, b.level]).sort(), [['brewCounter', 1], ['orderCounter', 1], ['silo', 1]]);
  for (const id of ['F1', 'S', 'F2', 'C2']) assert.ok(r.parcels.includes(id), `parcel ${id} kept`);
  assert.deepEqual(r.plots, {});
  assert.equal(new Set(r.buildings.map(b => b.uid)).size, r.buildings.length, 'unique uids');
  // Playable immediately: plant on the kept F2 parcel, rebuild the roaster.
  h.must('farm/plant', { plotId: 'F2-1' });
  h.must('build/place', { type: 'roaster', x: 2, z: 111 });
  // Expiry never fires again.
  h.state.player.xp = xpForLevel(14);
  h.state.inventory.beans = 3;
  h.must('shop/spawnCustomer', { roll: 0 }); h.must('shop/takeOrder'); h.must('shop/brew'); h.tick(20_000); h.must('shop/serve');
  assert.equal(h.state.story.phase, 'play');
});

test('edge: expiry with brewing/taken/waiting café orders refunds nothing and removes them', () => {
  const h = playing();
  h.state.player.coins = 5000;
  h.state.player.xp = xpForLevel(EXPIRY_LEVEL) - 1;
  // Upgrade the brew counter to Lv 3 for 2 brew slots.
  const brew = h.region().buildings.find(b => b.type === 'brewCounter');
  h.state.player.xp -= 16; // two upgrades grant 8 XP each without reaching Level 10
  h.must('build/upgrade', { uid: brew.uid }); h.must('build/upgrade', { uid: brew.uid });
  assert.equal(D.brewSlots(h.state), 2);
  h.state.inventory.beans = 10;
  // Queue holds 2 waiting customers at order counter Lv 1.
  h.must('shop/spawnCustomer', { roll: 0 });
  h.must('shop/takeOrder'); h.must('shop/brew');   // brewing, will be served → Level 10
  h.tick(1000);
  h.must('shop/spawnCustomer', { roll: 0 });
  h.must('shop/takeOrder'); h.must('shop/brew');   // brewing (slot 2)
  h.must('shop/spawnCustomer', { roll: 0 });
  h.must('shop/takeOrder');                        // taken
  h.must('shop/spawnCustomer', { roll: 0 });       // waiting
  h.tick(10_000);
  h.must('shop/serve');
  assert.equal(h.state.story.phase, 'expiry');
  const orders = h.region().shop.orders;
  assert.deepEqual(orders.map(o => o.stage).sort(), ['brewing', 'taken', 'waiting']);
  assert.equal(h.act('shop/serve').error, 'paused', 'a ready cup cannot be cashed in during the pause');
  const keep = { coins: h.state.player.coins, beans: h.state.inventory.beans, earned: h.state.stats.earned, served: h.state.stats.served };
  h.must('expiry/execute');
  const r = h.state.world.regions['vn-1'];
  assert.deepEqual(r.shop.orders, []);
  assert.equal(h.state.player.coins, keep.coins, 'no coin refund');
  assert.equal(h.state.inventory.beans, keep.beans, 'no bean refund for cups in progress');
  assert.equal(h.state.stats.earned, keep.earned);
  assert.equal(h.state.stats.served, keep.served);
  assert.equal(h.state.story.expiry.snapshot.orders.length, 3, 'orders kept only in the snapshot');
  assert.ok(r.shop.nextOrder > orders.at(-1).id, 'order ids keep increasing');
});

// ---------- dev / tx / save ----------
test('edge: dev actions are forbidden without dev and allowed with it', () => {
  const h = playing({ dev: false });
  h.must('farm/plant', { plotId: 'F1-1' });
  const before = JSON.stringify(h.state);
  assert.equal(h.act('dev/grant', { coins: 1e6, xp: 1e6, beans: 99 }).error, 'forbidden');
  assert.equal(h.act('dev/ripen').error, 'forbidden');
  assert.equal(h.act('rebirth/addCredits', { amount: 5 }).error, 'forbidden');
  assert.equal(h.act('rebirth/addCredits', { amount: 5, source: 'receipt' }).error, 'unverified');
  assert.equal(JSON.stringify(h.state), before);
  const d = playing({ dev: true });
  d.must('farm/plant', { plotId: 'F1-1' });
  d.must('dev/ripen');
  assert.equal(D.plotState(d.state, 'F1-1', d.now).stage, 'ready');
  d.must('dev/grant', { coins: 100, beans: 5 });
  assert.equal(d.state.inventory.beans, 5);
  d.must('rebirth/addCredits', { amount: 500, source: 'dev' });
  assert.equal(d.state.rebirth.purchased, 99, 'capped at 99 per call');
});

test('edge: tx log keeps only the last 64 ids; evicted ids are no longer deduplicated', () => {
  const h = playing();
  for (let i = 0; i < 70; i++) h.must('tutorial/set', { step: i }, `tx-${i}`);
  assert.equal(h.state.tx.length, 64);
  assert.equal(h.state.tx[0], 'tx-6');
  assert.equal(h.state.tx.at(-1), 'tx-69');
  assert.equal(h.act('tutorial/set', { step: 1 }, 'tx-69').duplicate, true);
  assert.equal(h.act('tutorial/set', { step: 1 }, 'tx-6').duplicate, true);
  const evicted = h.act('tutorial/set', { step: 1 }, 'tx-5');
  assert.equal(evicted.duplicate, undefined);
  assert.equal(h.state.tx.length, 64);
  // Failed and noop actions do not record their tx id.
  assert.equal(h.act('farm/plant', { plotId: 'F8-1' }, 'tx-fail').ok, false);
  assert.ok(!h.state.tx.includes('tx-fail'));
  // Even with an evicted id, a Round can never be charged twice (state guard).
  h.state.player.xp = xpForLevel(10); h.state.story.level10Done = true; h.state.player.coins = ROUNDS[2].cost * 2;
  h.must('round/unlock', { round: 2 }, 'round-2');
  for (let i = 0; i < 70; i++) h.must('tutorial/set', { step: 1 }, `pad-${i}`);
  assert.ok(!h.state.tx.includes('round-2'));
  assert.equal(h.act('round/unlock', { round: 2 }, 'round-2').noop, true);
  assert.equal(h.state.player.coins, ROUNDS[2].cost);
});

test('edge: normalizeSave rejects schema ≠ 3 and repairs bad numbers', () => {
  for (const bad of [null, undefined, 42, 'save', [], {}, { schema: 2 }, { schema: '3' }, { schema: 4 }, { ...createSave(T0), schema: 1 }]) {
    assert.equal(normalizeSave(bad, T0), null, JSON.stringify(bad));
  }
  assert.equal(SCHEMA, 3);
  const raw = createSave(T0, { gender: 'male', name: 'X' });
  Object.assign(raw.player, { coins: NaN, xp: Infinity, round: 9.7 });
  raw.rebirth.credits = -4;
  raw.inventory.beans = 'many';
  raw.nextUid = 'x';
  raw.tx = Array.from({ length: 100 }, (_, i) => `t${i}`);
  raw.story.phase = 'party';
  raw.world.regions = { 'vn-1': { status: 'weird', parcels: ['F1', 'F1'], buildings: [null, { type: 'silo', x: 9, z: -5, level: 1 }], shop: { orders: 'no', nextOrder: NaN } } };
  raw.staff = { units: [null, { type: 'farmhand' }, 5] };
  const s = normalizeSave(JSON.parse(JSON.stringify(raw)), T0); // JSON turns NaN/Infinity into null, like a real save
  assert.equal(s.player.coins, START.coins);
  assert.equal(s.player.xp, 0);
  assert.equal(s.player.round, 3);
  assert.equal(s.rebirth.credits, 0);
  assert.equal(s.inventory.beans, 0);
  assert.equal(s.nextUid, 1);
  assert.equal(s.tx.length, 64);
  assert.equal(s.story.phase, 'intro');
  const r = s.world.regions['vn-1'];
  assert.equal(r.status, 'idle');
  assert.deepEqual(r.parcels, ['F1']);
  assert.equal(r.buildings.length, 1);
  assert.deepEqual(r.shop.orders, []);
  assert.equal(r.shop.nextOrder, 1);
  assert.equal(s.staff.units.length, 1);
  // Live (non-JSON) bad numbers too.
  const live = createSave(T0);
  Object.assign(live.player, { coins: -50, xp: -1, round: 0 });
  live.inventory.beans = 3.9;
  const n = normalizeSave(live, T0);
  assert.equal(n.player.coins, 0);
  assert.equal(n.player.xp, 0);
  assert.equal(n.player.round, 1);
  assert.equal(n.inventory.beans, 3);
  // A normalized save is playable.
  const ok = apply(normalizeSave(createSave(T0, { gender: 'female', name: 'Y' }), T0), { type: 'story/introDone' }, { now: T0 });
  assert.equal(ok.ok, true);
});

test('edge: migration of a v1 dev save with 1e13 coins caps to 50,000 and never sets level ≥ 10', () => {
  const old = { version: 1, introCompleted: true, heaven: { completed: true }, startingRegion: 'vn', farm: { coins: 1e13, xp: 1e13 } };
  const s = migrateLegacy(old, { gender: 'female', name: 'Dev' }, T0);
  assert.equal(s.player.coins, 50_000);
  assert.ok(levelForXp(s.player.xp) < EXPIRY_LEVEL, `level ${levelForXp(s.player.xp)}`);
  assert.equal(levelForXp(s.player.xp), EXPIRY_LEVEL - 1);
  assert.equal(s.story.level10Done, false);
  assert.equal(s.story.expiry, null);
  assert.equal(s.player.round, 1);
  // Junk numbers in the old save fall back to the defaults.
  for (const farm of [{ coins: 'NaN', xp: 'abc' }, { coins: -5, xp: -100 }, { coins: Infinity, xp: Infinity }]) {
    const m = migrateLegacy({ version: 1, farm }, null, T0);
    assert.ok(m.player.coins >= START.coins && m.player.coins <= 50_000, JSON.stringify(farm));
    assert.ok(levelForXp(m.player.xp) < EXPIRY_LEVEL);
  }
  // Through the store: the migrated save enters the gate, and the first region does not expire immediately.
  const storage = createMemoryStorage();
  storage.setItem('old-progress', JSON.stringify(old));
  storage.setItem('old-player', JSON.stringify({ gender: 'male', name: 'Bao' }));
  const store = createStore({ storage, key: 'v3', legacyKeys: { progress: 'old-progress', player: 'old-player' }, now: () => T0 });
  assert.equal(store.state.player.coins, 50_000);
  assert.ok(D.level(store.state) < EXPIRY_LEVEL);
  assert.equal(store.state.story.phase, 'gate');
  store.dispatch('world/unlockRegion', { regionId: 'vn-1' }); store.dispatch('world/enterRegion', { regionId: 'vn-1' });
  assert.equal(store.state.story.phase, 'play');
});
