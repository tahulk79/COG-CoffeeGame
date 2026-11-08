import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, playing, T0 } from './helpers.mjs';
import * as D from '../../src/core/derive.js';
import { CROPS, chestPrize, START, xpForLevel, BUILDINGS, BEANS, MAX_LEVEL, TUTORIAL } from '../../src/core/config/economy.js';
import { apply } from '../../src/core/game.js';
import { createSave, normalizeSave, LAYOUT_VERSION } from '../../src/core/state.js';
import { createStore, createMemoryStorage } from '../../src/core/store.js';
import { migrateLegacy } from '../../src/core/migrate.js';
import { countryGames, isRegionId, regionCost, regionGames } from '../../src/core/config/world.js';
import { COUNTRY_MENUS, menuItem, menuItemsOf } from '../../src/core/config/menus.js';
import { currentStep, STEPS } from '../../src/core/tutorial.js';
import { ALL_PLOTS, PARCELS, ROADS, RESERVED, FIXED, BOUNDS, rectsOverlap, rectsTouch } from '../../src/core/config/layout.js';

test('story flow: select → intro → teacher (no rebirth credits) → gate → play', () => {
  const h = harness();
  assert.equal(h.state.story.phase, 'intro');
  h.must('story/introDone');
  assert.equal(h.state.story.phase, 'teacher');
  h.must('story/teacherDone');
  h.must('story/teacherDone');
  assert.equal(h.state.rebirth.credits, 0, 'the Teacher no longer hands out rebirth credits');
  assert.equal(h.state.story.phase, 'gate');
  assert.equal(h.act('farm/plant', { plotId: 'F1-1' }).error, 'notPlaying');
  h.go('vn-1');
  assert.equal(h.state.story.phase, 'play');
  assert.deepEqual(h.region().buildings.map(b => b.type).sort(), ['brewCounter', 'orderCounter', 'silo', 'terrace']);
});

test('farm tutorial: seeds planted before the first harvest ripen in a few seconds, later ones take the real time', () => {
  const h = playing();
  h.must('farm/plant', { plotId: 'F1-1' });
  h.must('farm/plant', { plotId: 'F1-2' });
  assert.equal(D.plotState(h.state, 'F1-1', h.now + TUTORIAL.firstGrowSeconds * 1000).stage, 'ready');
  h.tick(TUTORIAL.firstGrowSeconds * 1000);
  h.must('farm/harvest', { plotId: 'F1-1' });
  assert.equal(D.plotState(h.state, 'F1-2', h.now).stage, 'ready', 'seeds planted during the tutorial stay fast');
  h.must('farm/plant', { plotId: 'F1-1' });
  assert.equal(D.plotState(h.state, 'F1-1', h.now + TUTORIAL.firstGrowSeconds * 1000).stage, 'growing');
});
test('farm loop: EMPTY → PLANT → GROW → READY → HARVEST → EMPTY, no watering', () => {
  const h = playing();
  h.state.tutorial.farmDone = true; // real grow times (tutorial seeds ripen fast: own test below)
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
  assert.equal(h.state.inventory.beans, D.starYield(h.state, 'robusta', 3), 'picked right when ripe: 3★');
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

test('café: customers order the local drinks of the country (config/menus.js), served as the base drink', () => {
  const h = playing(); // vn-1 (Hà Nội)
  for (let i = 0; i < D.queueCap(h.state); i++) h.must('shop/spawnCustomer', { roll: i / 5 });
  for (const o of h.region().shop.orders) {
    const item = menuItem('vn', o.item, o.drink);
    assert.ok(item, `order ${o.id}: item ${o.item} is a Vietnamese ${o.drink}`);
  }
  assert.ok(menuItemsOf('vn', 'espresso').includes(h.region().shop.orders[0].item));
  for (const cc of Object.keys(COUNTRY_MENUS)) for (const base of ['espresso', 'milk', 'latte']) assert.ok(menuItemsOf(cc, base).length > 0, `${cc} ${base}`);
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
  // Farm World 2.0: farm buildings stand on any owned farm land whose terrain allows them — never over a field.
  h.state.player.xp = xpForLevel(3);
  assert.equal(D.placementError(h.state, 'dryer', -9, 5, 0), 'onField');      // F1's fields: move or clear one first
  assert.equal(D.placementError(h.state, 'dryer', 0, 5, 0), 'onRoad');        // road: never built on
  assert.equal(D.placementError(h.state, 'dryer', 9, 14, 0), 'outside');      // storehouse grass: not a lot
  assert.equal(D.placementError(h.state, 'dryer', 24, 15.5, 0), 'notOwned');  // W1 not bought yet
  assert.equal(D.placementError(h.state, 'dryer', 4, 14.5, 0), 'notOwned');   // D1 garden (any use) not bought yet
  assert.equal(D.placementError(h.state, 'dryer', 14, 13.5, 0), null);
  assert.equal(D.placementError(h.state, 'dryer', 2, 111, 0), 'wrongZone');   // not in the café
  h.must('build/place', { type: 'dryer', x: 14, z: 13.5 });
  assert.equal(D.placementError(h.state, 'flowers', 15, 14.5, 0), 'overlap');
  h.must('build/place', { type: 'flowers', x: 18, z: 17.5 });                 // decor in the yard
  assert.equal(D.placementError(h.state, 'roaster', 0, 0, 0), 'onRoad');    // road
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
  const farmLots = Object.values(PARCELS).filter(p => p.area !== 'cafe');
  assert.equal(ALL_PLOTS.length, farmLots.filter(p => p.kind === 'farm').length * 6);
  for (const p of farmLots) {
    assert.ok(['farm', 'build', 'decor', 'pasture', 'pond', 'orchard'].includes(p.kind), `${p.id} kind`);
    const [x0, z0, x1, z1] = p.rect;
    assert.ok(x0 >= BOUNDS.minX && x1 <= BOUNDS.maxX && z0 >= BOUNDS.minZ && z1 <= BOUNDS.maxZ, `${p.id} inside the farm`);
    if (p.kind === 'farm') assert.deepEqual([x1 - x0, z1 - z0], [10, 6], `${p.id} is a 10×6 field`);
    assert.ok(Object.values(ROADS).some(r => rectsTouch(p.rect, r.rect)), `${p.id} touches a road`);
    for (const q of farmLots) if (q !== p) assert.ok(!rectsOverlap(p.rect, q.rect), `${p.id} overlaps ${q.id}`);
    for (const [type, pos] of Object.entries(FIXED)) if (pos.z < 82) assert.ok(!rectsOverlap(p.rect, D.footprint(type, pos.x, pos.z, pos.rot)), `${type} on ${p.id}`);
  }
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
  // Any lot can be bought in any order (no road / neighbour needed): far lots first.
  h.must('land/buyParcel', { parcelId: 'F14' });
  h.must('land/buyParcel', { parcelId: 'H1' });
  for (const id of ['F5', 'F3', 'F8', 'F13', 'C2', 'C3']) h.must('land/buyParcel', { parcelId: id });
  assert.equal(h.state.player.round, 1, 'still Round 1');
  h.must('farm/plant', { plotId: 'F14-1' });
  h.must('build/place', { type: 'tables', x: 13, z: 107 });
});

// Hiring cap (user rule 2026-11-07): a zone's team (workers + robots) is at most the player level, so every hire has a
// working slot (slots = level per zone) and nobody waits on the bench for being one hire too many.
test('staff: team per zone = player level (hireLimit), every hire works, robots from Lv4, free-hire tickets', () => {
  const h = playing();
  h.state.player.coins = 100000;
  const base = D.growMs(h.state, 'robusta');
  // Lv1: 1 hire per zone; the café counts its own team
  h.must('staff/hire', { type: 'farmhand' });
  const r = h.act('staff/hire', { type: 'farmhand' });
  assert.equal(r.error, 'hireLimit');
  assert.equal(r.data.level, 2);
  assert.equal(D.benchUnits(h.state, 'farm').length, 0);
  h.must('staff/hire', { type: 'barista' });
  assert.equal(h.state.staff.units[1].active, true, 'counted per game zone');
  assert.equal(h.act('staff/hire', { type: 'sproutBot' }).error, 'level', 'robots open at Lv4');
  // Lv5: 5 farm units, all on shift; a 6th waits for Lv6
  h.state.player.xp = xpForLevel(5);
  for (let i = 0; i < 3; i++) h.must('staff/hire', { type: 'farmhand' });
  h.must('staff/hire', { type: 'sproutBot' });
  assert.equal(D.activeCount(h.state, 'farm'), 5);
  assert.equal(h.act('staff/hire', { type: 'farmhand' }).error, 'hireLimit');
  assert.ok(D.growMs(h.state, 'robusta') < base);
  // A free-hire ticket makes the next hire cost nothing
  h.state.player.xp = xpForLevel(6);
  h.state.rewards.tickets = 1;
  const coins = h.state.player.coins;
  h.must('staff/hire', { type: 'sproutBot' });
  assert.equal(h.state.player.coins, coins);
  assert.equal(h.state.rewards.tickets, 0);
  // Moving people around still works
  const units = h.state.staff.units;
  h.must('staff/unassign', { uid: units[0].uid });
  h.must('staff/assign', { uid: units[0].uid });
});

test('level gifts: one per level, fixed gifts, surprise chest at Lv5, reset by the incident', () => {
  const h = playing();
  assert.deepEqual(D.pendingGifts(h.state), []);
  h.state.player.xp = xpForLevel(5);
  assert.deepEqual(D.pendingGifts(h.state), [2, 3, 4, 5]);
  const coins = h.state.player.coins;
  const r2 = h.must('level/claim', { level: 2 });
  assert.equal(h.state.player.coins, coins + 80);
  assert.equal(h.state.rewards.tickets, 1, 'Lv2 gives a free hire');
  assert.equal(r2.events.find(e => e.type === 'giftOpened').chest, false);
  assert.equal(h.act('level/claim', { level: 2 }).noop, true, 'once per level');
  h.must('level/claim', { level: 3 });
  const runs = h.state.autoplay.runs;
  h.must('level/claim', { level: 4 });
  assert.equal(h.state.autoplay.runs, runs + 1, 'Lv4 gives an auto run');
  // Lv5 chest: the roll picks the prize (deterministic)
  const before = h.state.player.coins;
  const r5 = h.must('level/claim', { level: 5, roll: 0 });
  const ev = r5.events.find(e => e.type === 'giftOpened');
  assert.equal(ev.chest, true);
  assert.equal(ev.prize, 'jackpot');
  assert.equal(h.state.player.coins, before + 750);
  assert.deepEqual(D.pendingGifts(h.state), []);
  assert.equal(chestPrize(0.99).id, 'auto');
  // The incident: gifts and tickets start over from level 1
  toLevel10(h);
  h.must('expiry/execute');
  assert.deepEqual(h.state.rewards, { claimed: [], tickets: 0 });
});

// Updated for docs/design/management-rules.md §2.7 / §4.5 (P1/P2): s.loans[] (one entry per pack, ≤ 2 open), packs
// open by level (1 000 Lv4, 2 000 Lv6, 5 000 Lv8), creditLimit 1.5 × I10 × (1 + 0.1 × level), a term fixed at take
// time, +5 % once when late then no new loan; autoRepay 20 % of every income to the oldest loan; the debt survives.
test('loan: borrow a pack, part of every income repays it, pay the rest, loans stack, the debt survives the incident', () => {
  const h = playing();
  h.state.player.coins = 0;
  assert.equal(h.act('loan/take', { amount: 1234 }).error, 'unknown');
  // §2.7 pack levels: nothing to borrow at Lv1
  const lv1 = h.act('loan/take', { amount: 1000 });
  assert.equal(lv1.error, 'level'); assert.deepEqual(lv1.data, { minLevel: 4 });
  h.state.player.xp = xpForLevel(6);
  assert.equal(D.creditLimit(h.state), 6000, 'farm Lv6: 1.5 × 2 500 × 1.6');
  h.must('loan/take', { amount: 1000 });
  assert.equal(h.state.player.coins, 1000);
  assert.equal(h.state.loans.length, 1);
  assert.equal(h.state.loans[0].owed, 1100);
  assert.equal(h.state.loans[0].termMin, 50, '§2.7 farm Lv6: 1 000 → 50 min (term mul 2)');
  // Borrowing again opens a second loan (two entries, not one stacked object); the HUD view adds them up
  h.must('loan/take', { amount: 2000 });
  assert.equal(h.state.player.coins, 3000);
  assert.deepEqual(h.state.loans.map(ln => [ln.amount, ln.owed]), [[1000, 1100], [2000, 2200]]);
  assert.equal(h.state.loans[1].termMin, 90, '§2.7 farm Lv6: 2 000 → 90 min (term mul 2)');
  assert.equal(D.loanOf(h.state).amount, 3000);
  assert.equal(D.loanOf(h.state).owed, 3300);
  assert.equal(h.act('loan/take', { amount: 1000 }).error, 'loanMax', '§2.7 max 2 open');
  // Income: 20% goes to the oldest debt first
  h.state.player.coins = 1000;
  h.state.inventory.beans = 10;
  const c0 = h.state.player.coins;
  h.must('farm/sellBeans', { amount: 10 });
  const gain = h.events.filter(e => e.type === 'beansSold').at(-1).coins;
  assert.ok(gain > 0);
  assert.equal(h.state.loans[0].owed, 1100 - 0.2 * gain);
  assert.equal(h.state.loans[1].owed, 2200);
  assert.equal(h.state.player.coins, c0 + 0.8 * gain);
  // Pay part: the oldest loan first
  h.state.player.coins = 2000;
  h.must('loan/repay', { amount: 1100 - 0.2 * gain });
  assert.deepEqual(h.state.loans.map(ln => ln.owed), [2200]);
  // Pay what you have (all of it here)
  h.state.player.coins = 3000;
  const r = h.must('loan/repay');
  assert.ok(r.events.some(e => e.type === 'loanRepaid'));
  assert.deepEqual(h.state.loans, []);
  assert.equal(D.loanOf(h.state), null);
  assert.equal(h.state.player.coins, 800);
  assert.equal(h.act('loan/repay').noop, true);
  // Late (§4.5): past its term the loan owes +5 % once, and no new loan until it is paid
  h.must('loan/take', { amount: 1000 });
  h.state.clock.played = (h.state.clock.played || 0) + h.state.loans[0].termMin * 60000;
  h.must('loan/tick');
  assert.equal(h.state.loans[0].owed, Math.round(1100 * 1.05));
  assert.equal(h.state.loans[0].late, true);
  assert.equal(h.act('loan/tick').noop, true, 'the late fee is charged once');
  assert.equal(h.act('loan/take', { amount: 1000 }).error, 'loanBlocked');
  h.state.player.coins = 5000; h.must('loan/repay');
  // Credit limit (§2.7): farm Lv8 7 560 → one 5 000 pack (5 500), not 5 000 + 2 000
  h.state.player.xp = xpForLevel(8);
  assert.equal(D.creditLimit(h.state), 7560);
  h.must('loan/take', { amount: 5000 });
  assert.equal(h.state.loans[0].termMin, 150, '§2.7 farm Lv8 5 000 → 150 (cap)');
  assert.equal(h.act('loan/take', { amount: 2000 }).error, 'credit');
  // The incident does not wipe an open loan: a debt is a debt
  toLevel10(h);
  const owed = D.loanTotal(h.state); // the Lv10 sale already repaid a little
  h.must('expiry/execute');
  assert.ok(owed > 5000);
  assert.equal(D.loanTotal(h.state), owed);
  assert.equal(h.state.loans.length, 1);
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
  store.dispatch('world/unlockRegion', { regionId: 'br-1' }); store.dispatch('world/enterRegion', { regionId: 'br-1' });
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
  assert.equal(again.state.world.regions['br-1'].status, 'expired');
});

test('rebirth: confirmable spend of 1 credit, permanent blessing, no coin loss; independent from rounds', () => {
  const h = playing();
  h.state.rebirth.credits = 3; // no free credits any more; the core action itself still works
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

test('world: one region per city, opened with coins (first free); free unlock after expiry', () => {
  assert.deepEqual(D.regionsOfCountry('vn'), ['vn-1', 'vn-2', 'vn-3', 'vn-4']);
  assert.equal(D.regionsOfCountry('us').length, 5);
  assert.equal(D.regionsOfCountry('tr').length, 3);
  assert.equal(isRegionId('vn-2'), true);
  assert.equal(isRegionId('vn-5'), false);
  assert.equal(isRegionId('it-1'), false, 'Italy is not on the city map');
  assert.equal(regionCost('vn-1'), 300);
  assert.ok(regionCost('vn-2') > regionCost('vn-1'), 'later cities of a country cost more');
  const h = harness();
  h.must('story/introDone'); h.must('story/teacherDone');
  assert.equal(D.regionAccess(h.state, 'us-1').reason, 'locked');
  assert.equal(D.regionUnlockCost(h.state, 'us-1'), 0, 'first region is free, wherever it is');
  h.go('jp-1');
  const cost = D.regionUnlockCost(h.state, 'fr-1');
  assert.ok(cost > 0);
  h.state.player.coins = cost - 1;
  const r = h.act('world/unlockRegion', { regionId: 'fr-1' });
  assert.equal(r.error, 'coins'); assert.equal(r.data.missing, 1);
  h.state.player.coins = cost + 10;
  h.must('world/unlockRegion', { regionId: 'fr-1' });
  assert.equal(h.state.player.coins, 10);
  assert.equal(h.act('world/unlockRegion', { regionId: 'fr-1' }).noop, true);
  h.go('fr-1');
  assert.equal(h.state.world.regions['jp-1'].status, 'idle');
  h.go('jp-1');                       // owned regions can be revisited for free
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
  assert.equal(s3.state.rebirth.credits, 0);
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

test('region game: picked once per region, only the games its country offers', () => {
  const h = playing(); // vn-1: farm and café
  assert.deepEqual(D.currentGames(h.state), ['farm', 'cafe']);
  assert.equal(D.regionGame(h.state), null);
  assert.equal(h.act('play/setMode', { mode: 'farm' }).error, 'gameLocked'); // nothing picked yet
  h.must('play/chooseGame', { game: 'cafe' });
  assert.equal(h.region().mode, 'cafe');
  assert.equal(h.state.mode, 'cafe');
  assert.equal(h.act('play/chooseGame', { game: 'farm' }).noop, true); // once per region
  assert.equal(h.act('play/chooseGame', { game: 'moon' }).ok, false);
  // Round 1: one game per region, the other one stays closed
  assert.equal(h.act('play/setMode', { mode: 'farm' }).error, 'gameLocked');
  assert.equal(D.bothGames(h.state), false);
  // Café-only countries (France); growing countries have both; a city may differ from its country (Kunming farms)
  assert.deepEqual(countryGames('fr'), ['cafe']);
  assert.deepEqual(countryGames('br'), ['farm', 'cafe']);
  assert.deepEqual(regionGames('cn-1'), ['cafe']);
  assert.deepEqual(regionGames('cn-5'), ['farm', 'cafe']);
  assert.deepEqual(countryGames('cn'), ['farm', 'cafe']);
  h.state.player.coins = 1e6;
  h.go('fr-1');
  assert.equal(h.state.mode, null);
  assert.equal(h.act('play/chooseGame', { game: 'farm' }).error, 'gameLocked');
  h.must('play/chooseGame', { game: 'cafe' });
  // Back to vn-1: it keeps its own game
  h.go('vn-1');
  assert.equal(h.state.mode, 'cafe');
  // Saves from before the per-region game: regions keep the game played, when their country offers it
  const old = normalizeSave({ ...createSave(T0), mode: 'farm', firstGame: 'farm', world: { ...createSave(T0).world, currentRegion: 'fr-1', regions: { 'vn-1': {}, 'fr-1': {} } } }, T0);
  assert.equal(old.world.regions['vn-1'].mode, 'farm');
  assert.equal(old.world.regions['fr-1'].mode, null);
  assert.equal(old.mode, null);
  assert.equal('firstGame' in old, false);
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
  assert.equal(r.layout, LAYOUT_VERSION);
  assert.ok(r.parcels.includes('Y0'), 'every region gets the starter yard');
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
  assert.equal(D.regionUnlockCost(h.state, 'us-1'), 0);
  h.go('br-1');
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

test('dev/set (QA URL params): exact coins / beans / level, test profile only', () => {
  const h = playing();
  h.must('dev/set', { coins: '9999999', beans: '40', round: '2', level: '9' });
  assert.equal(h.state.player.coins, 9999999);
  assert.equal(h.state.inventory.beans, 40);
  assert.equal(h.state.player.round, 1, 'only Round 1 exists for now');
  assert.equal(D.level(h.state), 9);
  h.must('dev/set', { level: '15' });
  assert.equal(D.level(h.state), 9); // never jumps past the Level-10 incident
  h.must('dev/set', { coins: 'abc' });
  assert.equal(h.state.player.coins, 9999999); // junk ignored
  const prod = harness({ dev: false });
  assert.equal(prod.act('dev/set', { coins: 1 }).error, 'forbidden');
});

test('rounds: only Round 1 is playable; no unlock action; old saves go back to Round 1', () => {
  const h = playing();
  assert.equal(h.state.player.round, 1);
  assert.equal(h.act('round/unlock', { round: 2 }).ok, false);
  assert.equal(normalizeSave({ ...createSave(T0), player: { ...createSave(T0).player, round: 3 } }, T0).player.round, 1);
  assert.equal(CROPS.liberica && !D.unlockedCrops(h.state).includes('liberica'), true, 'the Round 2 crop is not offered');
});

test('old saves: regions of removed countries move to a city of a kept country', () => {
  const raw = createSave(T0, { gender: 'male', name: 'A' });
  raw.story.phase = 'play';
  raw.world.startCountry = 'it';
  raw.world.currentRegion = 'it-1';
  raw.world.regions = { 'vn-1': {}, 'it-1': { mode: 'cafe' }, 'co-1': {}, 'ke-1': {}, 'in-3': {} };
  raw.world.ownedRegions = ['vn-1', 'it-1', 'co-1', 'ke-1', 'in-3'];
  const s = normalizeSave(raw, T0);
  // it-1 → Paris, co-1 → Belo Horizonte; Kenya is back on the map, so ke-1 stays (Nairobi).
  assert.deepEqual(Object.keys(s.world.regions).sort(), ['br-3', 'fr-1', 'in-3', 'ke-1', 'vn-1']);
  assert.deepEqual([...s.world.ownedRegions].sort(), ['br-3', 'fr-1', 'in-3', 'ke-1', 'vn-1']);
  assert.equal(s.world.currentRegion, 'fr-1');
  assert.equal(s.world.regions['fr-1'].mode, 'cafe');
  assert.equal(s.world.startCountry, 'fr');
  assert.equal(s.story.phase, 'play');
});

test('old saves: regions that no longer exist (vn-9, xx-1…) are dropped; standing in one goes back to the map', () => {
  const raw = createSave(T0, { gender: 'male', name: 'A' });
  raw.story.phase = 'play';
  raw.world.currentRegion = 'vn-9';
  raw.world.regions = { 'vn-1': {}, 'vn-9': {}, 'xx-1': {} };
  raw.world.ownedRegions = ['vn-1', 'vn-9', 'xx-1'];
  const s = normalizeSave(raw, T0);
  assert.deepEqual(Object.keys(s.world.regions), ['vn-1']);
  assert.deepEqual(s.world.ownedRegions, ['vn-1']);
  assert.equal(s.world.currentRegion, null);
  assert.equal(s.story.phase, 'gate');
});

test('farm map: every lot is for sale from the start; roads open with the land; the whole map is open', () => {
  const h = playing();
  h.state.player.coins = 1e9;
  const before = D.farmViewBounds(h.state);
  assert.ok(D.frontierParcels(h.state).includes('F2') && D.frontierParcels(h.state).includes('H1'));
  const r3 = h.must('land/buyParcel', { parcelId: 'F3' });
  assert.deepEqual(r3.events.find(e => e.type === 'roadsOpened').roads.sort(), ['nLane_W', 'spine0'].sort());
  // Greedy: keep buying any frontier lot until nothing is left.
  for (let guard = 0; guard < 100; guard++) {
    const next = D.frontierParcels(h.state)[0];
    if (!next) break;
    h.must('land/buyParcel', { parcelId: next });
  }
  const farmLots = Object.keys(PARCELS).filter(id => PARCELS[id].area !== 'cafe');
  assert.deepEqual(farmLots.filter(id => !h.region().parcels.includes(id)), [], 'every farm lot reachable');
  assert.deepEqual(Object.keys(ROADS).filter(id => !D.roadOpen(h.state, id)), [], 'every road opened');
  const after = D.farmViewBounds(h.state);
  assert.deepEqual(after, before, 'the whole farm map is open from the start');
  assert.ok(MAX_LEVEL >= 100);
});

test('layout v4 migration: free-grass farm buildings move into lots, else refunded; Y0 granted', async () => {
  const { normalizeRegion } = await import('../../src/core/state.js');
  const old = { layout: 3, status: 'active', parcels: ['F1', 'S'], buildings: [
    { uid: 'b1', type: 'silo', x: 9, z: 14, rot: 0, level: 1 },
    { uid: 'b2', type: 'dryer', x: 20, z: 14, rot: 0, level: 2 },     // free grass (now Y0 / W1 edge)
    { uid: 'b3', type: 'flowers', x: -28, z: 20, rot: 0, level: 1 },  // free grass far west
    ...Array.from({ length: 12 }, (_, i) => ({ uid: `l${i}`, type: 'lamp', x: 25, z: -20 + i, rot: 0, level: 1 })),
  ] };
  const r = normalizeRegion(old);
  assert.equal(r.layout, LAYOUT_VERSION);
  assert.ok(r.parcels.includes('Y0') && r.parcels.includes('W1'));
  const lotOf = b => Object.values(PARCELS).find(p => { const fp = D.footprint(b.type, b.x, b.z, b.rot); return fp[0] >= p.rect[0] && fp[1] >= p.rect[1] && fp[2] <= p.rect[2] && fp[3] <= p.rect[3]; });
  for (const b of r.buildings.filter(b => !BUILDINGS[b.type].starter)) assert.ok(r.parcels.includes(lotOf(b)?.id), `${b.uid} inside an owned lot`);
  for (let i = 0; i < r.buildings.length; i++) for (let j = i + 1; j < r.buildings.length; j++) {
    const a = r.buildings[i], b = r.buildings[j];
    assert.ok(!rectsOverlap(D.footprint(a.type, a.x, a.z, a.rot), D.footprint(b.type, b.x, b.z, b.rot)), `${a.uid} overlaps ${b.uid}`);
  }
  const placed = r.buildings.length - 1, refunded = 14 - placed;
  assert.ok(placed >= 10, `most buildings fit (${placed})`);
  assert.equal(r.refund || 0, refunded ? r.refund : 0);
  // Idempotent.
  const again = normalizeRegion({ ...r, refund: undefined });
  assert.deepEqual(again.buildings, r.buildings);
  assert.equal(again.refund, undefined);
});

test('layout v4 migration: production buildings keep their spot even with lots of decor; junk ids never crash', async () => {
  const { normalizeRegion } = await import('../../src/core/state.js');
  const decor = Array.from({ length: 36 }, (_, i) => ({ uid: `d${i}`, type: ['flowers', 'plant', 'lamp'][i % 3], x: -28 + (i % 6) * 2, z: 19 + Math.floor(i / 6), rot: 0, level: 1 }));
  const r = normalizeRegion({ layout: 3, status: 'active', parcels: ['F1', 'S'], buildings: [...decor, { uid: 'dry', type: 'dryer', x: 20, z: 14, rot: 0, level: 3 }] });
  assert.ok(r.buildings.some(b => b.uid === 'dry'), 'the dryer is kept (moved into a build lot), never refunded for decor');
  assert.ok(r.parcels.includes('D1'), 'decor gets the flower bed');
  assert.doesNotThrow(() => normalizeRegion({ layout: 3, parcels: ['F1', 'S'], buildings: [{ type: 'toString', x: 1, z: 1 }] }));
  assert.deepEqual(normalizeRegion({ layout: 4, parcels: ['Y0', 'ZZZ', 'toString'] }).parcels, ['Y0']);
});

test('recruitment: each game has its own board of 3 applicants with traits; hire, refresh, trait effects', async () => {
  const { RECRUIT, TRAITS, STAFF, applicantsFor } = await import('../../src/core/config/economy.js');
  const h = playing();
  h.state.player.coins = 100000;
  for (const zone of ['farm', 'shop']) {
    const list = D.applicants(h.state, zone);
    assert.equal(list.length, RECRUIT.size);
    assert.ok(list.every(a => a.type === RECRUIT.worker[zone] && TRAITS[a.trait] && a.name));
    assert.equal(new Set(list.map(a => a.trait)).size, 3, 'three different traits');
    assert.deepEqual(applicantsFor(zone, 42), applicantsFor(zone, 42), 'board is deterministic');
  }
  // Lazy is cheaper than diligent
  const byTrait = Object.fromEntries(D.applicants(h.state, 'farm').map(a => [a.trait, a]));
  assert.ok(byTrait.lazy.cost < STAFF.farmhand.cost && byTrait.diligent.cost > STAFF.farmhand.cost);
  // Hire the funny farm applicant: name + trait kept, coins spent, board redrawn
  const idx = D.applicants(h.state, 'farm').findIndex(a => a.trait === 'funny');
  const pick = D.applicants(h.state, 'farm')[idx];
  const seed = h.state.staff.pool.farm.seed, coins = h.state.player.coins;
  const yieldBefore = D.yieldOf(h.state, 'robusta');
  h.must('staff/recruit', { zone: 'farm', index: idx });
  const u = h.state.staff.units[0];
  assert.equal(u.name, pick.name); assert.equal(u.trait, 'funny'); assert.equal(u.type, 'farmhand');
  assert.equal(h.state.player.coins, coins - pick.cost);
  assert.notEqual(h.state.staff.pool.farm.seed, seed);
  assert.ok(D.yieldOf(h.state, 'robusta') >= yieldBefore);
  // Team per zone = player level: a 2nd farm recruit at Lv1 fails with hireLimit (no bench overflow).
  assert.equal(h.act('staff/recruit', { zone: 'farm', index: 0 }).error, 'hireLimit');
  // Refresh: free only after the timer, otherwise paid (a board never drawn is due at once)
  h.must('staff/refreshPool', { zone: 'shop', roll: .1 });
  assert.equal(h.act('staff/refreshPool', { zone: 'shop', roll: .3 }).error, 'tooSoon');
  const c2 = h.state.player.coins;
  h.must('staff/refreshPool', { zone: 'shop', roll: .3, paid: true });
  assert.equal(h.state.player.coins, c2 - RECRUIT.refreshCost);
  h.tick(RECRUIT.refreshMinutes * 60000);
  h.must('staff/refreshPool', { zone: 'shop', roll: .7 });
  assert.equal(h.state.player.coins, c2 - RECRUIT.refreshCost);
  // Saves keep trait/name and the boards
  const n = normalizeSave(JSON.parse(JSON.stringify(h.state)), h.now);
  assert.equal(n.staff.units[0].trait, 'funny');
  assert.equal(n.staff.pool.shop.seed, h.state.staff.pool.shop.seed);
});

// Updated for docs/design/staff-manager.md §5: the single level + staff/train is replaced by per-stat upgrades
// (skill points from XP + coins); robots get 4 parts (charger merged into battery).
test('staff stats: XP → skill points, per-stat upgrades with points + coins; robot task and hardware', async () => {
  const E = await import('../../src/core/config/economy.js');
  const h = playing();
  h.state.player.coins = 100000;
  h.state.player.xp = xpForLevel(5);
  h.must('staff/recruit', { zone: 'farm', index: D.applicants(h.state, 'farm').findIndex(a => a.trait === 'funny') });
  const id = h.state.staff.units[0].uid;
  const u = () => D.unitOf(h.state, id);
  assert.deepEqual(u().stats, { speed: 1, smart: 1, accuracy: 1, stamina: 1 });
  assert.equal(E.unitLevel(u()), 1);
  const grow1 = D.growMs(h.state, 'robusta');
  assert.equal(h.act('staff/upgradeStat', { uid: id, stat: 'speed' }).error, 'points', 'needs skill points first');
  for (let i = 0; i < 10; i++) h.must('staff/workDone', { uid: id, n: 3 }); // 30 XP (funny ×1)
  assert.equal(u().points, 1); assert.equal(u().xp, 10, 'XP left over toward the next point');
  assert.ok(h.events.some(e => e.type === 'staffReady'));
  assert.equal(u().book.jobs, 30);
  const coins = h.state.player.coins;
  h.must('staff/upgradeStat', { uid: id, stat: 'speed' });
  assert.equal(u().stats.speed, 2); assert.equal(u().points, 0);
  assert.equal(h.state.player.coins, coins - E.SKILL.coinPerLevel);
  assert.equal(u().book.spent, E.SKILL.coinPerLevel);
  assert.ok(D.growMs(h.state, 'robusta') < grow1, 'speed raises the worker effect');
  assert.equal(E.unitLevel(u()), 2);
  // stat 2 → 3 costs 2 points + 200 coins; smart drives the smart rules
  h.must('staff/workDone', { uid: id, n: 20 }); h.must('staff/workDone', { uid: id, n: 20 });
  assert.equal(u().points, 2);
  h.must('staff/upgradeStat', { uid: id, stat: 'smart' });
  assert.equal(h.act('staff/upgradeStat', { uid: id, stat: 'smart' }).error, 'points');
  assert.ok(E.hasRule(u(), 'ripeFirst') && !E.hasRule(u(), 'playerCrop'));
  u().points = 99; h.state.player.coins = 250;
  h.must('staff/upgradeStat', { uid: id, stat: 'smart' }); // 2 → 3: 200 coins
  assert.equal(h.act('staff/upgradeStat', { uid: id, stat: 'smart' }).error, 'coins');
  h.state.player.coins = 100000;
  h.must('staff/upgradeStat', { uid: id, stat: 'smart' }); h.must('staff/upgradeStat', { uid: id, stat: 'smart' });
  assert.equal(h.act('staff/upgradeStat', { uid: id, stat: 'smart' }).error, 'maxLevel');
  assert.equal(h.act('staff/upgradeStat', { uid: id, stat: 'charm' }).error, 'unknown');
  // the old staff/train still raises the lowest stat (compat)
  h.must('staff/train', { uid: id });
  assert.equal(u().stats.accuracy, 2);
  // Robots: tasks + parts
  h.must('staff/hire', { type: 'sproutBot' });
  const bot = h.state.staff.units[1].uid;
  assert.equal(D.unitOf(h.state, bot).task, 'auto');
  assert.equal(h.act('staff/setTask', { uid: bot, task: 'brew' }).error, 'unknown', 'farm robot cannot brew');
  h.must('staff/setTask', { uid: bot, task: 'harvest' });
  assert.equal(E.robotTask(D.unitOf(h.state, bot)), 'harvest');
  h.must('staff/workDone', { uid: bot, n: 2 });
  assert.equal(D.unitOf(h.state, bot).points, undefined, 'robots never learn');
  assert.equal(D.unitOf(h.state, bot).book.jobs, 2, '…but their jobs count in the book');
  assert.equal(h.act('staff/upgradeStat', { uid: bot, stat: 'speed' }).error, 'unknown');
  const fee0 = E.unitFee(D.unitOf(h.state, bot));
  assert.equal(h.act('staff/upgradePart', { uid: bot, part: 'charger' }).error, 'unknown', 'the charger is merged into the battery');
  h.must('staff/upgradePart', { uid: bot, part: 'battery' });
  h.must('staff/upgradePart', { uid: bot, part: 'battery' });
  h.must('staff/upgradePart', { uid: bot, part: 'cooler' });
  assert.equal(h.act('staff/upgradePart', { uid: bot, part: 'battery' }).error, 'level', 'tier 3 needs Lv8');
  assert.ok(E.unitFee(D.unitOf(h.state, bot)) < fee0, 'a better battery recharges cheaper');
  assert.equal(E.batteryMinutes(D.unitOf(h.state, bot)), 13, 'management-rules §2.3: battery minutes [6, 9, 13, 18], tier 2 = 13');
  assert.equal(D.unitOf(h.state, bot).partsSpent, E.partCost('sproutBot', 0, 'battery') + E.partCost('sproutBot', 1, 'battery') + E.partCost('sproutBot', 0, 'cooler'), 'battery t0 + t1 + cooler t0 (cooler ×0.6)');
  // Saves keep it all
  const n = normalizeSave(JSON.parse(JSON.stringify(h.state)), h.now);
  assert.deepEqual(n.staff.units[0].stats, u().stats);
  assert.deepEqual(n.staff.units[1].parts, { battery: 2, motor: 0, cooler: 1, frame: 0 });
  assert.equal(n.staff.units[1].task, 'harvest');
});

test('staff mistakes: rates fall with level, robots never; unripe / crooked / spill effects', async () => {
  const E = await import('../../src/core/config/economy.js');
  const w = lvl => ({ type: 'farmhand', level: lvl, trait: 'funny' });
  assert.ok(E.mistakeChance(w(1), 'spill') > E.mistakeChance(w(3), 'spill'));
  assert.equal(E.mistakeChance(w(5), 'wrongTable'), 0);
  assert.ok(E.mistakeChance({ ...w(1), trait: 'lazy' }, 'unripe') > E.mistakeChance({ ...w(1), trait: 'diligent' }, 'unripe'));
  assert.equal(E.mistakeChance({ type: 'sproutBot' }, 'crooked'), 0, 'robots never make mistakes');
  const h = playing();
  h.state.player.coins = 1000;
  const plot = D.ownedPlots(h.state)[0].id;
  h.must('farm/plant', { plotId: plot, crooked: true });
  const p = h.region().plots[plot];
  assert.ok(p.slow);
  h.tick(D.plotGrowMs(h.state, p));
  const full = D.starYield(h.state, p.crop, 3);
  const r = h.must('farm/harvest', { plotId: plot, unripe: true });
  assert.equal(r.events.find(e => e.type === 'harvested').beans, Math.max(1, full - 1));
  // Spill: a brewing cup goes back to "taken"
  h.state.inventory.beans = 20;
  h.region().shop.orders.push({ id: 99, drink: 'espresso', stage: 'brewing', brewStart: h.now, brewMs: 1000 });
  h.must('shop/spill', { orderId: 99 });
  assert.equal(h.region().shop.orders.find(o => o.id === 99).stage, 'taken');
});

test('quality stars: player 3★ (fresh harvest), workers 1–2★ by level, robots 1★; hard drinks need a Lv5 worker', () => {
  const h = playing();
  h.state.player.coins = 100000;
  h.state.player.xp = xpForLevel(5);
  h.must('staff/recruit', { zone: 'shop', index: 0 });
  h.must('staff/hire', { type: 'brewBot' });
  const [w, bot] = h.state.staff.units;
  assert.equal(D.unitStars(w), 1); assert.equal(D.unitStars(bot), 1);
  // Updated (staff-manager §5): stars and hard drinks follow the ACCURACY stat (was: the single level).
  const acc = n => ({ ...w, stats: { ...w.stats, accuracy: n } });
  assert.equal(D.unitStars(acc(3)), 2);
  assert.equal(D.unitStars({ ...w, stats: { ...w.stats, speed: 5, smart: 5 } }), 1, 'other stats do not give stars');
  assert.ok(!D.canBrew(bot, 'latte') && !D.canBrew(w, 'latte') && !D.canBrew(acc(4), 'latte') && D.canBrew(acc(5), 'latte') && D.canBrew(null, 'latte'));
  h.state.inventory.beans = 50;
  const orders = h.region().shop.orders;
  orders.push({ id: 501, drink: 'latte', stage: 'taken' }, { id: 502, drink: 'espresso', stage: 'taken' });
  assert.equal(h.act('shop/brew', { orderId: 501, uid: bot.uid }).error, 'hard', 'a robot never brews a hard drink');
  h.must('shop/brew', { orderId: 502, uid: bot.uid });
  assert.equal(h.region().shop.orders.find(o => o.id === 502).stars, 1);
  h.tick(60000);
  const r1 = h.must('shop/serve', { orderId: 502 });
  assert.equal(r1.events.find(e => e.type === 'served').coins, D.starPrice(h.state, 'espresso', 1));
  h.must('shop/brew', { orderId: 501 }); // the player: 3★
  h.tick(60000);
  const r3 = h.must('shop/serve', { orderId: 501 });
  assert.equal(r3.events.find(e => e.type === 'served').stars, 3);
  assert.ok(r3.events.find(e => e.type === 'served').coins > D.drinkPrice(h.state, 'latte'));
  // A late harvest by the player is 1★
  h.state.tutorial.farmDone = true;
  h.state.inventory.beans = 0;
  const plot = D.ownedPlots(h.state)[0].id;
  h.must('farm/plant', { plotId: plot });
  h.tick(D.plotGrowMs(h.state, h.region().plots[plot]) + 60000);
  assert.equal(h.must('farm/harvest', { plotId: plot }).events.find(e => e.type === 'harvested').stars, 1);
});

test('tending: pay a farm worker to water growing plots — each ripens sooner, once per planting', async () => {
  const { TEND } = await import('../../src/core/config/economy.js');
  const h = playing();
  h.state.player.coins = 1000;
  h.state.tutorial.farmDone = true;
  h.must('staff/recruit', { zone: 'farm', index: 0 });
  const id = h.state.staff.units[0].uid;
  const plot = D.ownedPlots(h.state)[0].id;
  h.must('farm/plant', { plotId: plot, crop: 'robusta' });
  assert.equal(h.act('farm/water', { plotId: plot, uid: id }).error, 'unknown', 'needs a paid tend first');
  const coins = h.state.player.coins;
  h.must('staff/tend', { uid: id });
  assert.equal(h.state.player.coins, coins - TEND.fee);
  assert.equal(D.unitOf(h.state, id).water, TEND.plots);
  const before = D.plotState(h.state, plot, h.now).remainingMs;
  h.must('farm/water', { plotId: plot, uid: id });
  const after = D.plotState(h.state, plot, h.now).remainingMs;
  assert.ok(before - after >= Math.round(D.plotGrowMs(h.state, h.region().plots[plot]) * TEND.speedup) - 1);
  assert.equal(h.act('farm/water', { plotId: plot, uid: id }).noop, true, 'once per planting');
  assert.equal(D.unitOf(h.state, id).water, TEND.plots - 1);
});
