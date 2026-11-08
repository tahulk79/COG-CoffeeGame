// Edge cases of the V3 reducer, save normalization and migration (complements tests/core/core.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, playing, T0 } from './helpers.mjs';
import * as D from '../../src/core/derive.js';
import { apply, ACTIONS } from '../../src/core/game.js';
import { normalizeSave, createSave, SCHEMA } from '../../src/core/state.js';
import { migrateLegacy } from '../../src/core/migrate.js';
import { createStore, createMemoryStorage } from '../../src/core/store.js';
import { BUILDINGS, START, EXPIRY_LEVEL, CROPS, xpForLevel, levelForXp, SHOP } from '../../src/core/config/economy.js';

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
    ['shop/openVenue', { venue: '__proto__' }], ['shop/openVenue', { venue: 'toString' }],
    ['shop/venueSale', { venue: 'toString', item: 'beer' }], ['shop/venueSale', { venue: 'bar', item: '__proto__' }],
    ['shop/review', { venue: '__proto__', stars: 5 }], ['shop/review', { venue: 'constructor', stars: 5 }],
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

test('edge: every building upgrades to level 8 already in Round 1, then maxLevel', () => {
  const h = rich();
  h.state.player.round = 1;
  const silo = () => h.region().buildings.find(b => b.type === 'silo');
  const coins = h.state.player.coins;
  while (silo().level < 8) h.must('build/upgrade', { uid: silo().uid });
  assert.equal(silo().level, 8);
  assert.equal(coins - h.state.player.coins, BUILDINGS.silo.upgrade.reduce((a, b) => a + b, 0));
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
  const base = Math.round(CROPS.robusta.cycleSeconds * 1000); // one season of a grown tree
  h.must('staff/hire', { type: 'farmhand' });
  const unit = h.state.staff.units[0];
  assert.deepEqual(unit.assigned, { regionId: 'vn-1', zone: 'farm' });
  const inA = D.growMs(h.state, 'robusta');
  assert.ok(inA < base);
  h.go('br-1');
  assert.deepEqual(h.state.staff.units[0].assigned, { regionId: 'vn-1', zone: 'farm' }, 'travelling does not move staff');
  assert.equal(D.growMs(h.state, 'robusta'), base, 'no bonus in region B');
  assert.equal(D.assignedUnits(h.state).length, 0);
  assert.equal(D.freeSlots(h.state, 'farm'), 12, 'no per-zone cap: everyone hired may work (Lv12 → 12)');
  // A plant in B grows at base speed.
  h.state.tutorial.farmDone = true; // no fast tutorial seed
  h.must('farm/plant', { plotId: 'F1-1' });
  assert.equal(D.plotState(h.state, 'F1-1', h.now + inA).stage, 'growing');
  // Re-assigning in B moves it (and removes the bonus from A).
  h.must('staff/assign', { uid: unit.uid });
  assert.equal(D.growMs(h.state, 'robusta'), inA);
  h.go('vn-1');
  assert.equal(D.growMs(h.state, 'robusta'), base);
  assert.equal(D.assignedUnits(h.state, 'br-1').length, 1);
});

// ---------- Level-10 expiry ----------
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
  assert.equal(s.player.round, 1); // only Round 1 for now
  assert.equal(s.rebirth.credits, 0);
  assert.equal(s.inventory.beans, 0);
  assert.equal(s.nextUid, 1);
  assert.equal(s.tx.length, 64);
  assert.equal(s.story.phase, 'intro');
  const r = s.world.regions['vn-1'];
  assert.equal(r.status, 'idle');
  assert.deepEqual(r.parcels, ['F1', 'Y0']); // layout v4: every region gets the starter yard
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

test('layout: the tutorial roaster spot is a valid placement in a fresh region (and the build succeeds)', async () => {
  const { TUTORIAL_BUILD } = await import('../../src/core/config/layout.js');
  const { placementError } = await import('../../src/core/derive.js');
  const h = playing();
  const { x, z } = TUTORIAL_BUILD.roaster;
  assert.equal(placementError(h.state, 'roaster', x, z, 0), null);
  h.must('build/place', { type: 'roaster', x, z, rot: 0 });
  assert.equal(h.region().buildings.filter(b => b.type === 'roaster').length, 1);
});

test('edge: seated customers leave angry when not served in time; never earlier', () => {
  const h = playing();
  h.state.inventory.beans = 5;
  h.must('shop/spawnCustomer', { roll: 0 });
  const id = h.region().shop.orders[0].id;
  h.must('shop/takeOrder');
  assert.equal(h.act('shop/customerLeft', { orderId: id }).error, 'notYet');
  h.must('shop/brew');
  h.tick(SHOP.seatPatienceSeconds * 1000);
  const coins = h.state.player.coins;
  const r = h.must('shop/customerLeft', { orderId: id });
  assert.equal(r.events[0].angry, true);
  assert.equal(h.region().shop.orders.length, 0);
  assert.equal(h.state.player.coins, coins, 'no coins for an unserved customer');
  // A queue customer still leaves (not angry).
  h.must('shop/spawnCustomer', { roll: 0 });
  const q = h.must('shop/customerLeft', { orderId: h.region().shop.orders[0].id });
  assert.equal(q.events[0].angry, false);
});

test('edge: staff breaks — worker on the phone / robot out of battery stop the bonus until the fee is paid', async () => {
  const { staffFee } = await import('../../src/core/config/economy.js');
  const h = rich();
  h.must('staff/hire', { type: 'farmhand' });
  const u = h.state.staff.units[0];
  const fast = D.growMs(h.state, 'robusta');
  h.must('staff/stop', { uid: u.uid });
  assert.equal(h.state.staff.units[0].stopped.kind, 'phone');
  assert.ok(D.growMs(h.state, 'robusta') > fast, 'no bonus while slacking');
  assert.equal(h.act('staff/stop', { uid: u.uid }).noop, true);
  h.state.player.coins = 1;
  assert.equal(h.act('staff/resume', { uid: u.uid }).error, 'coins');
  h.state.player.coins = 1000;
  h.must('staff/resume', { uid: u.uid });
  assert.equal(h.state.player.coins, 1000 - staffFee('farmhand'));
  assert.equal(D.growMs(h.state, 'robusta'), fast);
  h.state.player.coins = 1e6;
  h.must('staff/hire', { type: 'brewBot' });
  const bot = h.state.staff.units[1];
  h.must('staff/stop', { uid: bot.uid });
  assert.equal(h.state.staff.units[1].stopped.kind, 'battery');
});

test('edge: auto play — 1 free run from the Teacher, start consumes it, stop ends it', () => {
  const h = playing();
  assert.equal(h.state.autoplay.runs, 1);
  h.must('auto/start');
  assert.equal(h.state.autoplay.runs, 0);
  assert.ok(h.state.autoplay.active.endsAt > h.now);
  assert.equal(h.act('auto/start').noop, true);
  h.must('auto/stop');
  assert.equal(h.state.autoplay.active, null);
  assert.equal(h.act('auto/start').error, 'noRuns');
  h.must('story/teacherDone');
  assert.equal(h.state.autoplay.runs, 0, 'granted only once');
});

test('edge: auto runs can be bought with coins, price grows, never charged twice for one tx', async () => {
  const { autoPrice } = await import('../../src/core/config/economy.js');
  const h = playing();
  h.state.player.coins = autoPrice(0) - 1;
  assert.equal(h.act('auto/buy').error, 'coins');
  h.state.player.coins = 10000;
  const runs = h.state.autoplay.runs;
  h.must('auto/buy', {}, 'buy-1');
  assert.equal(h.act('auto/buy', {}, 'buy-1').duplicate, true);
  assert.equal(h.state.autoplay.runs, runs + 1);
  assert.equal(h.state.player.coins, 10000 - autoPrice(0));
  h.must('auto/buy', {}, 'buy-2');
  assert.equal(h.state.player.coins, 10000 - autoPrice(0) - autoPrice(1));
  assert.ok(autoPrice(1) > autoPrice(0));
});
