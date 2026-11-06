import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, playing, T0 } from './helpers.mjs';
import * as D from '../../src/core/derive.js';
import { CROPS, ROUNDS, START, xpForLevel, BUILDINGS, BEANS } from '../../src/core/config/economy.js';
import { apply } from '../../src/core/game.js';
import { createSave, normalizeSave } from '../../src/core/state.js';
import { createStore, createMemoryStorage } from '../../src/core/store.js';
import { migrateLegacy } from '../../src/core/migrate.js';
import { currentStep, STEPS } from '../../src/core/tutorial.js';
import { ALL_PLOTS, PARCELS, ROADS, RESERVED, FIXED, rectsOverlap } from '../../src/core/config/layout.js';

test('story flow: select → intro → teacher grants 3 credits once → gate → play', () => {
  const h = harness();
  assert.equal(h.state.story.phase, 'intro');
  h.must('story/introDone');
  assert.equal(h.state.story.phase, 'teacher');
  h.must('story/teacherDone');
  h.must('story/teacherDone');
  assert.equal(h.state.rebirth.credits, START.rebirthCredits);
  assert.equal(h.state.story.phase, 'gate');
  assert.equal(h.act('farm/plant', { plotId: 'F1-1' }).error, 'notPlaying');
  h.go('vn-1');
  assert.equal(h.state.story.phase, 'play');
  assert.deepEqual(h.region().buildings.map(b => b.type).sort(), ['brewCounter', 'orderCounter', 'silo', 'terrace']);
});

test('farm loop: EMPTY → PLANT → GROW → READY → HARVEST → EMPTY, no watering', () => {
  const h = playing();
  const coins = h.state.player.coins;
  h.must('farm/plant', { plotId: 'F1-1', crop: 'robusta' });
  assert.equal(h.state.player.coins, coins - CROPS.robusta.seedCost);
  assert.equal(D.plotState(h.state, 'F1-1', h.now).stage, 'planted');
  assert.equal(h.act('farm/plant', { plotId: 'F1-1' }).error, 'occupied');
  assert.equal(h.act('farm/harvest', { plotId: 'F1-1' }).error, 'notReady');
  h.tick(CROPS.robusta.growSeconds * 500);
  assert.equal(D.plotState(h.state, 'F1-1', h.now).stage, 'growing');
  h.tick(CROPS.robusta.growSeconds * 500);
  assert.equal(D.plotState(h.state, 'F1-1', h.now).stage, 'ready');
  h.must('farm/harvest', { plotId: 'F1-1' });
  assert.equal(D.plotState(h.state, 'F1-1', h.now).stage, 'empty');
  assert.equal(h.state.inventory.beans, CROPS.robusta.beans);
  assert.ok(h.state.player.xp > 0);
});

test('farm: cannot plant unowned plots or locked crops; storage full blocks harvest', () => {
  const h = playing();
  assert.equal(h.act('farm/plant', { plotId: 'F2-1' }).error, 'notOwned');
  assert.equal(h.act('farm/plant', { plotId: 'F1-1', crop: 'liberica' }).error, 'locked');
  h.state.inventory.beans = D.capacity(h.state);
  h.must('farm/plant', { plotId: 'F1-2' });
  h.tick(60_000);
  assert.equal(h.act('farm/harvest', { plotId: 'F1-2' }).error, 'storageFull');
});

test('grace: broke player with nothing in progress plants robusta for free, never gets coins', () => {
  const h = playing();
  h.state.player.coins = 0;
  assert.ok(D.graceActive(h.state));
  h.must('farm/plant', { plotId: 'F1-1' });
  assert.equal(h.state.player.coins, 0);
  assert.equal(D.graceActive(h.state), false);
  assert.equal(h.act('farm/plant', { plotId: 'F1-2' }).error, 'coins');
});

test('café: customer → take order → brew → serve → coins', () => {
  const h = playing();
  h.state.inventory.beans = 5;
  h.must('shop/spawnCustomer', { roll: 0 });
  assert.equal(h.act('shop/brew').error, 'noOrder');
  h.must('shop/takeOrder');
  h.must('shop/brew');
  assert.equal(h.state.inventory.beans, 4);
  assert.equal(h.act('shop/serve').error, 'notReady');
  h.tick(10_000);
  const before = h.state.player.coins;
  h.must('shop/serve');
  assert.ok(h.state.player.coins > before);
  assert.equal(h.region().shop.orders.length, 0);
  assert.equal(h.state.stats.served, 1);
});

test('café: brew needs beans; queue capped', () => {
  const h = playing();
  for (let i = 0; i < D.queueCap(h.state); i++) h.must('shop/spawnCustomer', { roll: .5 });
  assert.equal(h.act('shop/spawnCustomer', { roll: .5 }).error, 'queueFull');
  h.must('shop/takeOrder');
  assert.equal(h.act('shop/brew').error, 'beans');
});

test('build: valid placement, red/invalid cases, upgrade to max in Round 1', () => {
  const h = playing();
  h.state.player.coins = 100000;
  assert.equal(D.placementError(h.state, 'roaster', 2, 111, 0), null);
  assert.equal(D.placementError(h.state, 'roaster', -3, 108, 0), 'blocked');   // customer lane
  assert.equal(D.placementError(h.state, 'roaster', -9, 5, 0), 'wrongZone');  // café buildings never go on the farm
  assert.equal(D.placementError(h.state, 'tables', 13, 107, 0), 'notOwned');   // café expansion C2 not bought yet
  // Farm buildings go on free grass of the farm: not on fields, roads, the gate plaza or other buildings.
  h.state.player.xp = xpForLevel(3);
  assert.equal(D.placementError(h.state, 'dryer', -9, 5, 0), 'onField');
  assert.equal(D.placementError(h.state, 'dryer', 0, 5, 0), 'blocked');       // main road
  assert.equal(D.placementError(h.state, 'dryer', 9, 14, 0), 'overlap');      // storehouse
  assert.equal(D.placementError(h.state, 'dryer', 20, 14, 0), null);
  assert.equal(D.placementError(h.state, 'dryer', 2, 111, 0), 'wrongZone');   // not in the café
  h.must('build/place', { type: 'dryer', x: 20, z: 14 });
  h.must('build/place', { type: 'flowers', x: 23, z: 17 });                   // decor on the farm grass
  assert.equal(D.placementError(h.state, 'roaster', 0, 0, 0), 'outside');   // road
  h.must('build/place', { type: 'roaster', x: 2, z: 111 });
  assert.equal(D.placementError(h.state, 'tables', 2, 111, 0), 'overlap');
  assert.equal(h.act('build/place', { type: 'roaster', x: 2, z: 111 }).error, 'limit');
  const roaster = h.region().buildings.find(b => b.type === 'roaster');
  // Round 1 already allows every level (no Round cap): upgrade to 8, then maxLevel.
  for (let i = 0; i < 7; i++) h.must('build/upgrade', { uid: roaster.uid });
  assert.equal(D.region(h.state).buildings.find(b => b.uid === roaster.uid).level, 8);
  assert.equal(h.act('build/upgrade', { uid: roaster.uid }).error, 'maxLevel');
  assert.equal(h.state.player.round, 1);
});

test('layout sanity: plots, parcels and fixed buildings never sit on roads or reserved lanes', () => {
  for (const p of Object.values(PARCELS)) for (const r of Object.values(ROADS)) assert.ok(!rectsOverlap(p.rect, r.rect), `${p.id} overlaps road ${r.id}`);
  const h = playing();
  for (const [type, pos] of Object.entries(FIXED)) {
    const fp = D.footprint(type, pos.x, pos.z, pos.rot);
    for (const res of RESERVED) assert.ok(!rectsOverlap(fp, res.rect), `${type} on ${res.id}`);
  }
  assert.equal(ALL_PLOTS.length, 14 * 6);
  // The farm is fields only: every non-café parcel is a farm field.
  for (const p of Object.values(PARCELS)) assert.ok(p.kind === 'farm' || p.area === 'cafe', `${p.id} on the farm must be a field`);
  assert.ok(h.region().buildings.every(b => BUILDINGS[b.type].starter));
});

test('land: every field and café lot is bought with coins only (no Rounds, no roads), idempotent', () => {
  const h = playing();
  h.state.player.coins = 3;
  const r = h.act('land/buyParcel', { parcelId: 'F2' });
  assert.equal(r.error, 'coins');
  assert.equal(r.data.missing, PARCELS.F2.cost - 3);
  h.state.player.coins = 100000;
  h.must('land/buyParcel', { parcelId: 'F2' });
  const coins = h.state.player.coins;
  assert.equal(h.act('land/buyParcel', { parcelId: 'F2' }).noop, true);
  assert.equal(h.state.player.coins, coins);
  for (const id of ['F5', 'F8', 'F14', 'C2', 'C3']) h.must('land/buyParcel', { parcelId: id });
  assert.equal(h.state.player.round, 1, 'still Round 1');
  h.must('farm/plant', { plotId: 'F14-1' });
  h.must('build/place', { type: 'tables', x: 13, z: 107 });
});

test('staff: 2 worker + 2 robot types, max 3 active per farm, effects apply', () => {
  const h = playing();
  h.state.player.coins = 100000;
  h.state.player.xp = xpForLevel(9);
  const base = D.growMs(h.state, 'robusta');
  for (let i = 0; i < 4; i++) h.must('staff/hire', { type: 'farmhand' });
  const units = h.state.staff.units;
  assert.equal(units.length, 4);
  assert.equal(units.filter(u => u.assigned).length, 3);
  assert.equal(h.act('staff/assign', { uid: units[3].uid }).error, 'slotsFull');
  assert.ok(D.growMs(h.state, 'robusta') < base);
  // Robots can be hired in Round 1 too (founder: everything available in Round 1).
  h.must('staff/hire', { type: 'sproutBot' });
  assert.equal(h.state.staff.units.filter(u => u.assigned).length, 3, 'still max 3 active on the farm');
  h.must('staff/unassign', { uid: units[0].uid });
  h.must('staff/assign', { uid: units[3].uid });
});

test('round 2: charges exactly once (tx idempotent), shows missing coins, level gate', () => {
  const h = playing();
  h.state.player.coins = 100;
  assert.equal(h.act('round/unlock', { round: 2 }, 'tx-a').error, 'level');
  h.state.player.xp = xpForLevel(10);
  const r = h.act('round/unlock', { round: 2 }, 'tx-a');
  assert.equal(r.error, 'coins');
  assert.equal(r.data.missing, ROUNDS[2].cost - 100);
  h.state.player.coins = ROUNDS[2].cost + 50;
  h.must('round/unlock', { round: 2 }, 'tx-b');
  assert.equal(h.state.player.coins, 50);
  const dup = h.act('round/unlock', { round: 2 }, 'tx-b');
  assert.equal(dup.duplicate, true);
  assert.equal(h.act('round/unlock', { round: 2 }, 'tx-c').noop, true);
  assert.equal(h.state.player.coins, 50);
  assert.equal(h.state.player.round, 2);
  assert.equal(h.act('round/unlock', { round: 4 }).error, 'unknown');
  assert.equal(h.state.rebirth.credits, 3, 'round change does not spend rebirth credits');
});

test('round 3 then no round 4', () => {
  const h = playing();
  h.state.player.round = 2; h.state.player.xp = xpForLevel(20); h.state.story.level10Done = true;
  h.state.player.coins = ROUNDS[3].cost;
  h.must('round/unlock', { round: 3 }, 'r3');
  assert.equal(h.state.player.round, 3);
  assert.equal(h.state.player.coins, 0);
  assert.equal(D.roundStatus(h.state).next, null);
});

function toLevel10(h) {
  h.state.player.xp = xpForLevel(10) - 1;
  h.state.inventory.beans = 3;
  h.must('shop/spawnCustomer', { roll: 0 });
  h.must('shop/takeOrder'); h.must('shop/brew'); h.tick(20_000); h.must('shop/serve');
}

test('level 10 recovery: reload while pending still resets exactly once', () => {
  const storage = createMemoryStorage();
  let clock = T0;
  const store = createStore({ storage, key: 'k', dev: true, now: () => clock });
  store.dispatch('story/introDone'); store.dispatch('story/teacherDone');
  store.dispatch('world/unlockRegion', { regionId: 'co-1' }); store.dispatch('world/enterRegion', { regionId: 'co-1' });
  store.dispatch('dev/grant', { coins: 1000, beans: 10, xp: xpForLevel(10) });
  assert.equal(store.state.story.phase, 'expiry');
  const reloaded = createStore({ storage, key: 'k', dev: true, now: () => clock });
  assert.equal(reloaded.state.story.expiry.status, 'pending');
  assert.equal(reloaded.state.player.coins, store.state.player.coins);
  reloaded.dispatch('expiry/execute');
  assert.ok(storage.getItem('k-pre-expiry'));
  const again = createStore({ storage, key: 'k', dev: true, now: () => clock });
  assert.equal(again.state.story.phase, 'chooseRegion');
  assert.equal(again.dispatch('expiry/execute').noop, true);
  assert.equal(again.state.world.regions['co-1'].status, 'expired');
});

test('rebirth: confirmable spend of 1 credit, permanent blessing, no coin loss; independent from rounds', () => {
  const h = playing();
  assert.equal(h.act('rebirth/perform', { blessing: 'grow' }).error, 'level');
  h.state.player.xp = xpForLevel(5);
  const coins = h.state.player.coins;
  const base = D.growMs(h.state, 'robusta');
  h.must('rebirth/perform', { blessing: 'grow' });
  assert.equal(h.state.rebirth.credits, 2);
  assert.equal(h.state.player.coins, coins);
  assert.ok(D.growMs(h.state, 'robusta') < base);
  h.must('rebirth/perform', { blessing: 'price' });
  h.must('rebirth/perform', { blessing: 'xp' });
  assert.equal(h.act('rebirth/perform', { blessing: 'xp' }).error, 'noCredits');
  assert.equal(h.act('rebirth/addCredits', { amount: 1, source: 'receipt' }).error, 'unverified');
});

test('rebirth credits cannot be added outside dev', () => {
  const h = playing({ dev: false });
  assert.equal(h.act('rebirth/addCredits', { amount: 5, source: 'dev' }).error, 'forbidden');
  assert.equal(h.act('dev/grant', { coins: 5 }).error, 'forbidden');
});

test('world: any region can be opened with coins (first free), no Rounds; free unlock after expiry', () => {
  const h = harness();
  h.must('story/introDone'); h.must('story/teacherDone');
  assert.equal(D.regionAccess(h.state, 'us-3').reason, 'locked');
  assert.equal(D.regionUnlockCost(h.state, 'us-3'), 0, 'first region is free, wherever it is');
  h.go('jp-2');
  const cost = D.regionUnlockCost(h.state, 'it-1');
  assert.ok(cost > 0);
  h.state.player.coins = cost - 1;
  const r = h.act('world/unlockRegion', { regionId: 'it-1' });
  assert.equal(r.error, 'coins'); assert.equal(r.data.missing, 1);
  h.state.player.coins = cost + 10;
  h.must('world/unlockRegion', { regionId: 'it-1' });
  assert.equal(h.state.player.coins, 10);
  assert.equal(h.act('world/unlockRegion', { regionId: 'it-1' }).noop, true);
  h.go('it-1');
  assert.equal(h.state.world.regions['jp-2'].status, 'idle');
  h.go('jp-2');                       // owned regions can be revisited for free
  assert.equal(h.state.player.coins, 10);
  assert.equal(h.state.player.round, 1);
});

test('store: persists, keeps -prev, recovers from corrupt save, reload keeps data', () => {
  const storage = createMemoryStorage();
  const store = createStore({ storage, key: 'k', now: () => T0 });
  store.dispatch('character/set', { gender: 'male', name: 'A' });
  store.dispatch('story/introDone');
  store.dispatch('story/teacherDone');
  const good = storage.getItem('k');
  storage.setItem('k', '{broken');
  const s2 = createStore({ storage, key: 'k', now: () => T0 });
  assert.equal(storage.getItem('k-corrupt'), '{broken');
  assert.ok(['teacher', 'gate'].includes(s2.state.story.phase));
  storage.setItem('k', good);
  const s3 = createStore({ storage, key: 'k', now: () => T0 });
  assert.equal(s3.state.story.phase, 'gate');
  assert.equal(s3.state.rebirth.credits, 3);
});

test('migration from v1 keeps coins/level/character, never touches old keys', () => {
  const storage = createMemoryStorage();
  const old = { version: 1, introCompleted: true, heaven: { completed: true }, startingRegion: 'br', farm: { coins: 777, xp: 400 } };
  storage.setItem('old-progress', JSON.stringify(old));
  storage.setItem('old-player', JSON.stringify({ gender: 'male', name: 'Bao' }));
  const store = createStore({ storage, key: 'v3', legacyKeys: { progress: 'old-progress', player: 'old-player' }, now: () => T0 });
  assert.equal(store.state.character.name, 'Bao');
  assert.equal(store.state.player.coins, 777);
  assert.ok(D.level(store.state) >= 2 && D.level(store.state) < 10);
  assert.equal(store.state.story.phase, 'gate');
  assert.equal(store.state.world.startCountry, 'br');
  assert.equal(storage.getItem('old-progress'), JSON.stringify(old));
  assert.equal(migrateLegacy(null, null), null);
});

test('tutorial: farm and café are separate tracks, one step at a time, survive reload', () => {
  const h = playing();
  // Farm game
  assert.equal(currentStep(h.state, 'farm').step.id, 'plant');
  h.must('farm/plant', { plotId: 'F1-1' });
  assert.equal(currentStep(h.state, 'farm').step.id, 'harvest');
  h.tick(60_000); h.must('farm/harvest', { plotId: 'F1-1' });
  assert.equal(currentStep(h.state, 'farm').step.id, 'sell');
  h.must('farm/sellBeans');
  assert.equal(currentStep(h.state, 'farm').step.id, 'upgrade');
  h.state.player.coins = 1000;
  h.must('build/upgrade', { uid: h.region().buildings.find(b => b.type === 'silo').uid });
  assert.equal(currentStep(h.state, 'farm').step.id, 'buyLand');
  h.must('land/buyParcel', { parcelId: 'F2' });
  assert.equal(currentStep(h.state, 'farm'), null);
  // Café game: its own track, untouched by the farm one
  assert.equal(currentStep(h.state, 'cafe').step.id, 'takeOrder');
  h.must('shop/spawnCustomer', { roll: 0 }); h.must('shop/takeOrder');
  assert.equal(currentStep(h.state, 'cafe').step.id, 'brew');
  h.must('shop/buyBeans');
  h.must('shop/brew');
  assert.equal(currentStep(h.state, 'cafe').step.id, 'serve');
  h.tick(10_000); h.must('shop/serve');
  assert.equal(currentStep(h.state, 'cafe').step.id, 'build');
  h.must('build/place', { type: 'roaster', x: 2, z: 111 });
  assert.equal(currentStep(h.state, 'cafe'), null);
  assert.equal(STEPS.length, 9);
});

test('tutorial: skipping one game keeps the other; an old full skip covers both', () => {
  const h = playing();
  h.must('tutorial/set', { done: true, track: 'cafe' });
  assert.equal(currentStep(h.state, 'cafe'), null);
  assert.equal(currentStep(h.state, 'farm').step.id, 'plant');
  assert.equal(h.state.tutorial.done, false);
  h.must('tutorial/set', { done: true, track: 'farm' });
  assert.equal(h.state.tutorial.done, true);
  const old = normalizeSave({ ...createSave(T0), tutorial: { step: 0, done: true } }, T0);
  assert.equal(old.tutorial.farmDone && old.tutorial.cafeDone, true);
});

test('game choice: play/setMode stores farm | café, rejects anything else', () => {
  const h = playing();
  assert.equal(h.state.mode, null);
  h.must('play/setMode', { mode: 'cafe' });
  assert.equal(h.state.mode, 'cafe');
  assert.equal(h.act('play/setMode', { mode: 'moon' }).ok, false);
  assert.equal(normalizeSave({ ...h.state, mode: 'moon' }, T0).mode, null);
});

test('beans trade: farm sells beans for coins, café buys within coins and storage', () => {
  const h = playing();
  h.state.inventory.beans = 10;
  const coins = h.state.player.coins;
  h.must('farm/sellBeans');
  assert.equal(h.state.inventory.beans, 0);
  assert.equal(h.state.player.coins, coins + 10 * BEANS.sellPrice);
  assert.equal(h.act('farm/sellBeans').error, 'noBeans');
  // Buy one pack
  h.state.player.coins = 100;
  h.must('shop/buyBeans');
  assert.equal(h.state.inventory.beans, BEANS.buyPack);
  assert.equal(h.state.player.coins, 100 - BEANS.buyPack * BEANS.buyPrice);
  // Limited by the coins
  h.state.player.coins = BEANS.buyPrice * 3;
  h.must('shop/buyBeans');
  assert.equal(h.state.inventory.beans, BEANS.buyPack + 3);
  // Storehouse full
  h.state.inventory.beans = D.capacity(h.state);
  assert.equal(h.act('shop/buyBeans').error, 'storageFull');
  // Broke with beans left: no grace
  h.state.inventory.beans = 2; h.state.player.coins = 0;
  assert.equal(h.act('shop/buyBeans').error, 'coins');
  // Broke and empty: the supplier's grace beans
  h.state.inventory.beans = 0;
  h.must('shop/buyBeans');
  assert.equal(h.state.inventory.beans, BEANS.grace);
  assert.equal(h.state.player.coins, 0);
});

test('café pause: frozen while paused, timestamps shift on resume', () => {
  const h = playing();
  h.state.inventory.beans = 10;
  h.must('shop/spawnCustomer', { roll: 0 });
  const at = h.region().shop.orders[0].at;
  h.must('shop/pause');
  for (const type of ['shop/spawnCustomer', 'shop/takeOrder', 'shop/brew', 'shop/serve']) assert.equal(h.act(type, { roll: 0 }).error, 'cafeClosed');
  assert.equal(h.act('shop/customerLeft', { orderId: 1 }).error, 'cafeClosed');
  h.tick(10 * 60_000);
  h.must('shop/resume');
  assert.equal(h.region().shop.pausedAt, 0);
  assert.equal(h.region().shop.orders[0].at, at + 10 * 60_000);
  // Seated patience does not count the paused time either.
  h.must('shop/takeOrder');
  h.must('shop/pause'); h.tick(10 * 60_000); h.must('shop/resume');
  assert.ok(!D.seatPatienceOver(h.region().shop.orders[0], h.now));
});

test('café staff keep the café running: cafeStaffed', () => {
  const h = playing();
  assert.equal(D.cafeStaffed(h.state), false);
  h.state.player.coins = 10_000;
  h.must('staff/hire', { type: 'barista' });
  assert.equal(D.cafeStaffed(h.state), true);
  h.state.staff.units[0].stopped = { kind: 'phone', at: h.now, fee: 10 };
  assert.equal(D.cafeStaffed(h.state), false);
});

test('reducer never mutates input state', () => {
  const h = playing();
  const frozen = JSON.stringify(h.state);
  apply(h.state, { type: 'farm/plant', payload: { plotId: 'F1-1' } }, { now: T0 });
  assert.equal(JSON.stringify(h.state), frozen);
});

test('layout migration 1→3: café buildings move to the café area, farm build lots/buildings refunded, nothing lost', async () => {
  const { normalizeRegion, normalizeSave, createSave } = await import('../../src/core/state.js');
  const old = { status: 'active', parcels: ['F1', 'S', 'B1', 'B2', 'B3'], buildings: [
    { uid: 'b1', type: 'silo', x: 9, z: -5, rot: 0, level: 2 },
    { uid: 'b2', type: 'orderCounter', x: 7, z: 5, rot: 0, level: 1 },
    { uid: 'b3', type: 'roaster', x: 12, z: 11, rot: 0, level: 2 },
    { uid: 'b4', type: 'flowers', x: 15, z: 13, rot: 0, level: 1 },
    { uid: 'b5', type: 'dryer', x: 21, z: -5, rot: 0, level: 2 },
  ] };
  const r = normalizeRegion(old);
  const by = id => r.buildings.find(b => b.uid === id);
  assert.deepEqual([by('b1').x, by('b1').z, by('b1').level], [FIXED.silo.x, FIXED.silo.z, 2], 'storehouse keeps its level, moves to its new spot');
  assert.deepEqual([by('b2').x, by('b2').z], [FIXED.orderCounter.x, FIXED.orderCounter.z]);
  assert.deepEqual([by('b3').x, by('b3').z], [2, 111]);
  assert.deepEqual([by('b4').x, by('b4').z], [5, 113]);
  assert.equal(by('b5'), undefined, 'farm dryer removed…');
  assert.equal(r.refund, 150 + 120 + BUILDINGS.dryer.upgrade[0], '…and refunded with the bought lot B2');
  assert.ok(r.parcels.includes('C2') && !r.parcels.includes('B1') && !r.parcels.includes('B2'));
  assert.equal(r.layout, 3);
  // Idempotent.
  const again = normalizeRegion({ ...r, refund: undefined });
  assert.equal(again.refund, undefined);
  assert.deepEqual(again.buildings, r.buildings);
  // The refund lands in the player's coins when a whole save is normalized.
  const save = createSave(1, { gender: 'male', name: 'x' });
  save.player.coins = 10; save.world.regions['vn-1'] = old;
  const n = normalizeSave(save);
  assert.equal(n.player.coins, 10 + 150 + 120 + BUILDINGS.dryer.upgrade[0]);
  assert.deepEqual(n.world.ownedRegions, ['vn-1']);
});

test('level 10 incident: pauses, then a FULL restart — only 1 empty field and an empty café in the new region', () => {
  const h = playing();
  h.state.player.coins = 50000;
  h.state.player.xp = xpForLevel(8);
  h.must('land/buyParcel', { parcelId: 'F2' });
  h.must('land/buyParcel', { parcelId: 'C2' });
  h.must('build/place', { type: 'roaster', x: 2, z: 111 });
  h.must('staff/hire', { type: 'farmhand' });
  h.must('farm/plant', { plotId: 'F1-1' });
  h.must('world/unlockRegion', { regionId: 'br-1' });
  const credits = h.state.rebirth.credits;
  toLevel10(h);
  assert.equal(h.state.story.phase, 'expiry');
  assert.equal(h.act('farm/plant', { plotId: 'F1-2' }).error, 'paused');
  h.must('expiry/execute');
  // Nothing kept…
  assert.equal(h.state.player.coins, START.coins);
  assert.equal(h.state.player.xp, 0);
  assert.equal(h.state.player.round, 1);
  assert.equal(h.state.inventory.beans, 0);
  assert.equal(h.state.staff.units.length, 0);
  assert.deepEqual(h.state.world.ownedRegions, []);
  assert.deepEqual(Object.keys(h.state.world.regions), ['vn-1']);
  assert.equal(h.state.world.regions['vn-1'].status, 'expired');
  // …except who you are.
  assert.equal(h.state.rebirth.credits, credits);
  assert.equal(h.state.character.name, 'Test');
  assert.equal(h.state.story.phase, 'chooseRegion');
  // Idempotent.
  assert.equal(h.act('expiry/execute').noop, true);
  // Must move on: the expired region can't be picked now; the next region is free.
  assert.equal(h.act('world/enterRegion', { regionId: 'vn-1' }).error, 'expired');
  assert.equal(D.regionUnlockCost(h.state, 'us-3'), 0);
  h.go('br-2');
  const r = h.region();
  assert.deepEqual(r.parcels.filter(id => id.startsWith('F')), ['F1'], 'exactly 1 field');
  assert.deepEqual(r.plots, {}, 'empty field');
  assert.ok(r.buildings.every(b => BUILDINGS[b.type].starter && b.level === 1), 'empty café: only the free starters at Lv 1');
  h.must('farm/plant', { plotId: 'F1-1' });
  // The incident happens only once.
  h.state.player.xp = xpForLevel(12); h.state.inventory.beans = 3;
  h.must('shop/spawnCustomer', { roll: 0 }); h.must('shop/takeOrder'); h.must('shop/brew'); h.tick(20_000); h.must('shop/serve');
  assert.equal(h.state.story.phase, 'play');
});
