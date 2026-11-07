// Staff manager core (docs/design/staff-manager.md §1–8): slots + bench, upkeep, vitals + states, care, robot heat /
// jam / wear / parts, per-stat upgrades, tasks, rivals, rare applicants, fire / sell, books, ledger, journal, MVP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playing } from './helpers.mjs';
import * as D from '../../src/core/derive.js';
import * as E from '../../src/core/config/economy.js';
import { normalizeSave, createSave } from '../../src/core/state.js';

const { xpForLevel, STAFF, UPKEEP, VITALS, CARE, ROBOT_WEAR, RIVAL, RARE, SKILL, FIRE, BEANS, applicantsFor, WARRANTY } = E;

// A playing harness at `level` with plenty of coins (Lv10 incident disabled).
function team(level = 5, coins = 1e6) {
  const h = playing();
  Object.assign(h.state.player, { coins, xp: xpForLevel(level) });
  h.state.story.level10Done = true;
  h.state.tutorial.farmDone = true;
  return h;
}
const hire = (h, type) => h.must('staff/hire', { type }).events.find(e => e.type === 'hired').uid;
const unit = (h, uid) => D.unitOf(h.state, uid);

test('slots: per zone = level; setActive needs a free slot; unassigned units are never active', () => {
  const h = team(3);
  const [a, b, c] = [hire(h, 'farmhand'), hire(h, 'farmhand'), hire(h, 'farmhand')];
  assert.deepEqual([a, b, c].map(id => unit(h, id).active), [true, true, true], 'team ≤ level: every hire works');
  assert.equal(h.act('staff/hire', { type: 'farmhand' }).error, 'hireLimit');
  // A team bigger than the slots (old save, or the level went down): the extra one waits on the bench
  h.must('staff/setActive', { uid: c, active: false });
  h.state.player.xp = xpForLevel(2);
  assert.equal(D.slots(h.state, 'farm'), 2);
  assert.equal(D.freeSlots(h.state, 'farm'), 0);
  assert.equal(D.freeSlots(h.state, 'shop'), 2, 'the café counts its own slots');
  assert.equal(h.act('staff/setActive', { uid: c, active: true }).error, 'slotsFull');
  h.must('staff/setActive', { uid: a, active: false });
  assert.equal(h.act('staff/setActive', { uid: a, active: false }).noop, true);
  h.must('staff/setActive', { uid: c, active: true });
  assert.equal(D.activeCount(h.state, 'farm'), 2);
  assert.ok(h.state.staff.journal.some(e => e.type === 'benched' && e.uid === a) && h.state.staff.journal[0].type === 'activated');
  h.must('staff/unassign', { uid: c });
  assert.equal(unit(h, c).active, false);
  assert.equal(h.act('staff/setActive', { uid: c, active: true }).error, 'unknown', 'not assigned here');
  h.must('staff/assign', { uid: c });
  assert.equal(unit(h, c).active, true, 'back here with a free slot: on shift');
  // A benched worker gives no bonus
  const grow = D.growMs(h.state, 'robusta');
  h.must('staff/setActive', { uid: c, active: false });
  assert.ok(D.growMs(h.state, 'robusta') > grow);
  // Soft cap per zone (behind the level cap)
  h.state.staff.units.push(...Array.from({ length: E.STAFF_CAP.perZone }, (_, i) => ({ uid: `x${i}`, type: 'farmhand', assigned: null, active: false })));
  h.state.player.xp = xpForLevel(E.MAX_LEVEL);
  assert.equal(h.act('staff/hire', { type: 'farmhand' }).error, D.hireCapReached(h.state, 'farm') ? 'hireLimit' : 'teamFull');
  h.must('staff/hire', { type: 'barista' });
});

test('swapShift: tired / hungry / sulking workers go to the bench, the best rested bench workers come in; robots stay', () => {
  const h = team(6);
  const ids = ['farmhand', 'farmhand', 'farmhand', 'sproutBot', 'farmhand', 'farmhand'].map(t => hire(h, t));
  const [w1, w2, w3, bot, b1, b2] = ids;
  h.must('staff/setActive', { uid: b1, active: false }); h.must('staff/setActive', { uid: b2, active: false });
  h.state.player.xp = xpForLevel(4); // 4 slots, 4 on shift, 2 resting on the bench
  unit(h, w1).energy = 30;            // < 40
  unit(h, w2).fullness = 10;          // hungry
  unit(h, b1).stats = { speed: 3, smart: 3, accuracy: 1, stamina: 1 }; // higher level → first in
  unit(h, b2).energy = 60;            // not rested enough
  h.must('staff/swapShift', { zone: 'farm' });
  assert.equal(unit(h, w1).active, false); assert.equal(unit(h, w2).active, false);
  assert.equal(unit(h, w3).active, true); assert.equal(unit(h, bot).active, true, 'robots are not touched');
  assert.equal(unit(h, b1).active, true); assert.equal(unit(h, b2).active, false);
  assert.equal(h.events.at(-1).type, 'shiftSwapped');
  assert.equal(h.act('staff/swapShift', { zone: 'farm' }).noop, true, 'nothing left to swap');
  assert.equal(h.act('staff/swapShift', { zone: 'moon' }).error, 'unknown');
});

test('upkeep: only bench workers cost coins, prorated, capped catch-up; unpaid → morale drops, then the worker leaves', () => {
  const h = team(4);
  hire(h, 'farmhand'); const bench = hire(h, 'farmhand');
  h.must('staff/setActive', { uid: bench, active: false }); // resting on the bench
  const bot = hire(h, 'sproutBot');
  h.must('staff/setActive', { uid: bot, active: false }); // a bench robot is free
  h.must('staff/upkeep');
  assert.equal(h.state.staff.upkeepAt, h.now, 'the first call only starts the clock');
  assert.equal(h.act('staff/upkeep').noop, true);
  const coins = h.state.player.coins;
  h.tick(5 * 60000);
  h.must('staff/upkeep');
  const share = UPKEEP.benchRatio * STAFF.farmhand.cost * 5 / UPKEEP.perMinutes;
  assert.equal(h.state.player.coins, coins - share);
  assert.equal(unit(h, bench).book.spent, share);
  assert.equal(D.upkeepPer(h.state, 'farm'), UPKEEP.benchRatio * STAFF.farmhand.cost);
  // A long gap (offline) is billed for maxCatchUpMinutes only
  h.tick(3 * 3600000);
  const c2 = h.state.player.coins;
  h.must('staff/upkeep');
  assert.equal(h.state.player.coins, c2 - UPKEEP.benchRatio * STAFF.farmhand.cost * UPKEEP.maxCatchUpMinutes / UPKEEP.perMinutes);
  // Broke: morale −unpaidMorale per perMinutes instead, no debt
  h.state.player.coins = 0;
  unit(h, bench).morale = 15;
  h.tick(5 * 60000);
  h.must('staff/upkeep');
  assert.equal(unit(h, bench).morale, 10);
  assert.equal(h.state.player.coins, 0);
  h.tick(10 * 60000);
  const r = h.must('staff/upkeep');
  assert.equal(unit(h, bench), null, 'morale 0 on the unpaid bench: leaves');
  assert.equal(r.events.find(e => e.type === 'staffLeft').reason, 'unpaid');
  assert.equal(h.state.staff.journal[0].type, 'left');
});

test('vitals: energy / hunger / morale per minute, bench rests ×2, stamina + perks, states and their priority', () => {
  const h = team(5);
  const id = hire(h, 'farmhand');
  const u = () => unit(h, id);
  assert.deepEqual([u().energy, u().fullness, u().morale], [100, 100, 80]);
  h.must('staff/vitals', { uid: id, work: 60 });
  assert.equal(u().energy, 100 - VITALS.energyDrainPerMin);
  assert.equal(u().fullness, 100 - VITALS.hungerPerMin);
  h.must('staff/vitals', { uid: id, work: 120, rest: 999 }); // each clamped to 120 s
  assert.equal(u().energy, 100, '90 − 20 + 40, capped at the energy max');
  assert.equal(D.unitState(u(), h.now), 'ok');
  // tired, hungry, sulking (priority sulking > hungry > tired)
  u().energy = 20;
  assert.equal(D.unitState(u(), h.now), 'tired'); assert.equal(D.stateSpeedMul(u(), h.now), VITALS.tiredMul);
  u().fullness = 10;
  assert.equal(D.unitState(u(), h.now), 'hungry'); assert.equal(D.stateSpeedMul(u(), h.now), VITALS.hungryMul);
  assert.equal(D.unitBlocked(u(), h.now), false, 'hungry / tired only slow down');
  u().morale = 10;
  assert.equal(D.unitState(u(), h.now), 'sulking'); assert.equal(D.unitBlocked(u(), h.now), true);
  u().stopped = { kind: 'phone', at: h.now, fee: 10 };
  assert.equal(D.unitState(u(), h.now), 'phone');
  delete u().stopped; u().morale = 50;
  // Exhausted: blocks, and working on sours the mood
  u().energy = 0;
  assert.equal(D.unitBlocked(u(), h.now), true);
  h.must('staff/vitals', { uid: id, work: 60 });
  assert.equal(u().morale, 50 - VITALS.moraleOverworkPerMin);
  // Bench rests twice as fast; work time while benched counts as rest
  h.must('staff/setActive', { uid: id, active: false });
  h.must('staff/vitals', { uid: id, rest: 60 });
  assert.equal(u().energy, VITALS.energyRestPerMin * VITALS.benchRestMul);
  // Stamina: energy max +20 per step, hunger ×0.5 from 4
  u().stats.stamina = 4; u().energy = 0; u().fullness = 100;
  assert.equal(E.energyMax(u()), 160);
  h.must('staff/setActive', { uid: id, active: true });
  h.must('staff/vitals', { uid: id, work: 60 });
  assert.equal(u().fullness, 100 - VITALS.hungerPerMin * 0.5);
  // tireless perk drains ×0.5; funny trait regains morale
  u().perk = 'tireless'; u().energy = 100;
  h.must('staff/vitals', { uid: id, work: 60 });
  assert.equal(u().energy, 100 - VITALS.energyDrainPerMin * RARE.tirelessDrain);
  u().trait = 'funny'; u().morale = 50; u().energy = 100;
  h.must('staff/vitals', { uid: id, rest: 60 });
  assert.equal(u().morale, 50 + VITALS.funnyMoraleRegenPerMin);
  assert.equal(h.act('staff/vitals', { uid: id }).noop, true);
  assert.equal(h.act('staff/vitals', { uid: 'nope', work: 5 }).error, 'unknown');
});

test('care: nag / bonusSmall / coffee / food / lunch / bonus / rest for workers', () => {
  const h = team(5, 1000);
  const id = hire(h, 'farmhand');
  const u = () => unit(h, id);
  assert.equal(h.act('staff/care', { uid: id, kind: 'coffee' }).error, 'notNeeded');
  assert.equal(h.act('staff/care', { uid: id, kind: 'teleport' }).error, 'unknown');
  // nag: works with roll < 0.6, always −5 morale, free
  h.must('staff/stop', { uid: id });
  assert.equal(h.state.staff.journal[0].type, 'slacked');
  let c = h.state.player.coins;
  const fail = h.must('staff/care', { uid: id, kind: 'nag', roll: 0.9 });
  assert.equal(fail.events.find(e => e.type === 'staffCared').ok, false);
  assert.ok(u().stopped); assert.equal(u().morale, 75);
  h.must('staff/care', { uid: id, kind: 'nag', roll: 0.1 });
  assert.ok(!u().stopped); assert.equal(u().morale, 70); assert.equal(h.state.player.coins, c);
  assert.equal(h.state.staff.journal[0].type, 'nagged');
  // bonusSmall = the old resume fee
  h.must('staff/stop', { uid: id });
  c = h.state.player.coins;
  h.must('staff/care', { uid: id, kind: 'bonusSmall' });
  assert.ok(!u().stopped); assert.equal(h.state.player.coins, c - E.unitFee(u()));
  // coffee (tired), food (hungry), lunch (hungry, free 60 s break)
  u().energy = 10; c = h.state.player.coins;
  h.must('staff/care', { uid: id, kind: 'coffee' });
  assert.equal(u().energy, 10 + CARE.coffeeEnergy); assert.equal(h.state.player.coins, c - CARE.coffee);
  u().fullness = 5;
  h.must('staff/care', { uid: id, kind: 'food' });
  assert.equal(u().fullness, 100);
  u().fullness = 5;
  h.must('staff/care', { uid: id, kind: 'lunch' });
  assert.equal(u().fullness, 100); assert.equal(u().breakUntil, h.now + CARE.lunchSeconds * 1000);
  assert.equal(D.unitState(u(), h.now), 'lunch'); assert.equal(D.unitWorking(u(), h.now), false);
  h.tick(CARE.lunchSeconds * 1000);
  assert.equal(D.unitState(u(), h.now), 'ok');
  h.must('staff/vitals', { uid: id, work: 5 });
  assert.equal(u().breakUntil, undefined, 'the next vitals clears the break');
  // bonus (any time), rest (tired / sulking → bench)
  u().morale = 10;
  h.must('staff/care', { uid: id, kind: 'bonus' });
  assert.equal(u().morale, 50);
  u().energy = 5;
  h.must('staff/care', { uid: id, kind: 'rest' });
  assert.equal(u().active, false);
  assert.equal(h.act('staff/care', { uid: id, kind: 'rest' }).error, 'notNeeded', 'already benched');
  // coins
  h.state.player.coins = 0;
  assert.equal(h.act('staff/care', { uid: id, kind: 'bonus' }).error, 'coins');
  // every paid care is in the book + ledger
  assert.equal(u().book.spent, E.unitFee(u()) + CARE.coffee + CARE.food + CARE.bonus);
  assert.ok(D.ledgerWindow(h.state, h.now).spent >= u().book.spent);
});

test('robots: heat → overheat (auto-clears / cool), jam (knock / repair), wear (service), recharge', () => {
  const h = team(5);
  const id = hire(h, 'sproutBot');
  const u = () => unit(h, id);
  assert.deepEqual([u().heat, u().wear], [0, 100]);
  h.must('staff/vitals', { uid: id, work: 120 });
  assert.equal(u().heat, 2 * ROBOT_WEAR.heatPerMin);
  h.must('staff/vitals', { uid: id, rest: 60 });
  assert.equal(u().heat, 2 * ROBOT_WEAR.heatPerMin - ROBOT_WEAR.coolPerMin);
  u().heat = 95;
  const r = h.must('staff/vitals', { uid: id, work: 60 });
  assert.equal(u().stopped.kind, 'overheat');
  assert.equal(D.unitState(u(), h.now), 'overheat');
  assert.ok(r.events.some(e => e.type === 'staffStopped' && e.kind === 'overheat'));
  assert.equal(h.state.staff.journal[0].type, 'overheat');
  h.tick(ROBOT_WEAR.overheatSeconds * 1000);
  assert.equal(D.unitState(u(), h.now), 'ok', 'cool-down over');
  h.must('staff/vitals', { uid: id, rest: 30 });
  assert.equal(u().stopped, undefined);
  // cool: pay CARE.cool, heat 0 at once
  u().heat = 99;
  h.must('staff/vitals', { uid: id, work: 30 });
  let c = h.state.player.coins;
  h.must('staff/care', { uid: id, kind: 'cool' });
  assert.equal(u().heat, 0); assert.ok(!u().stopped); assert.equal(h.state.player.coins, c - CARE.cool);
  // Upgraded cooler: tier 3 never heats
  u().parts.cooler = 3;
  h.must('staff/vitals', { uid: id, work: 120 });
  assert.equal(u().heat, 0);
  // jam: knock (free) or repair (paid)
  h.must('staff/jam', { uid: id });
  assert.equal(D.unitState(u(), h.now), 'jam');
  assert.equal(h.act('staff/jam', { uid: id }).noop, true);
  h.must('staff/care', { uid: id, kind: 'knock' });
  assert.ok(!u().stopped);
  // repairs: the first WARRANTY.repairs are free (staff-profile step 4), then CARE.repair each
  for (let i = 0; i < WARRANTY.repairs; i++) {
    h.must('staff/jam', { uid: id });
    c = h.state.player.coins;
    h.must('staff/care', { uid: id, kind: 'repair' });
    assert.equal(h.state.player.coins, c, 'under warranty');
  }
  h.must('staff/jam', { uid: id });
  c = h.state.player.coins;
  h.must('staff/care', { uid: id, kind: 'repair' });
  assert.equal(h.state.player.coins, c - CARE.repair);
  // wear: jobs wear the robot down (frame slows it), low wear doubles the jam chance; service restores it
  h.must('staff/vitals', { uid: id, jobs: 10 });
  assert.equal(u().wear, 100 - 10 * ROBOT_WEAR.wearPerJob);
  assert.equal(E.jamChance(u()), ROBOT_WEAR.jamChance);
  u().wear = 10;
  assert.equal(E.jamChance(u()), ROBOT_WEAR.jamChance * ROBOT_WEAR.lowWearJamMul);
  c = h.state.player.coins;
  h.must('staff/care', { uid: id, kind: 'service' });
  assert.equal(u().wear, 100); assert.equal(h.state.player.coins, c - Math.round(STAFF.sproutBot.cost * CARE.serviceRatio));
  u().parts.frame = 3;
  assert.equal(E.jamChance(u()), ROBOT_WEAR.jamChance * 0.3);
  // battery: recharge (= resume)
  h.must('staff/stop', { uid: id });
  assert.equal(D.unitState(u(), h.now), 'battery');
  h.must('staff/care', { uid: id, kind: 'recharge' });
  assert.ok(!u().stopped);
  // workers cannot be jammed, robots cannot get coffee
  assert.equal(h.act('staff/jam', { uid: hire(h, 'farmhand') }).error, 'unknown');
  assert.equal(h.act('staff/care', { uid: id, kind: 'coffee' }).error, 'notNeeded');
});

test('migration: old level → 4 stats, charger → battery, active by slot, vitals filled; normalizeSave round-trip', () => {
  const raw = createSave(1, { gender: 'male', name: 'x' });
  raw.story.phase = 'play';
  raw.player.xp = xpForLevel(2);
  raw.staff.units = [
    { uid: 'u3', type: 'farmhand', level: 3, xp: 47, trait: 'lazy', assigned: { regionId: 'vn-1', zone: 'farm' } },
    { uid: 'u1', type: 'farmhand', level: 2, xp: 5, assigned: { regionId: 'vn-1', zone: 'farm' } },
    { uid: 'u10', type: 'farmhand', level: 1, assigned: { regionId: 'vn-1', zone: 'farm' } },
    { uid: 'u4', type: 'barista', level: 1, assigned: { regionId: 'vn-1', zone: 'shop' } },
    { uid: 'u5', type: 'brewBot', parts: { battery: 1, charger: 2, motor: 1 }, assigned: null },
  ];
  const n = normalizeSave(JSON.parse(JSON.stringify(raw)), 1);
  const by = id => n.staff.units.find(u => u.uid === id);
  assert.deepEqual(by('u3').stats, { speed: 3, smart: 3, accuracy: 3, stamina: 3 });
  assert.equal(by('u3').xp, 47 % SKILL.xpPerPoint); assert.equal(by('u3').points, 0); assert.equal(by('u3').level, undefined);
  assert.equal(E.unitLevel(by('u3')), 9);
  assert.deepEqual([by('u1').active, by('u3').active, by('u10').active], [true, true, false], 'first `level` units in uid order');
  assert.equal(by('u4').active, true, 'the café zone has its own slots');
  assert.equal(by('u5').active, false, 'unassigned: never active');
  assert.deepEqual(by('u5').parts, { battery: 2, motor: 1, cooler: 0, frame: 0 });
  assert.deepEqual([by('u1').energy, by('u1').fullness, by('u1').morale], [100, 100, 80]);
  assert.deepEqual(by('u1').tasks, []);
  assert.deepEqual(by('u1').book, { jobs: 0, earned: 0, spent: 0, mistakes: 0, since: 1 });
  assert.deepEqual(n.staff.ledger, []); assert.deepEqual(n.staff.journal, []); assert.equal(n.staff.poach, null);
  // Round trip: a normalized save normalizes to itself
  const again = normalizeSave(JSON.parse(JSON.stringify(n)), 1);
  assert.deepEqual(again.staff, n.staff);
  // A live save with every new field survives
  const h = team(3);
  const w = hire(h, 'farmhand');
  h.must('staff/stop', { uid: w });
  h.state.staff.poach = { uid: w, zone: 'farm', until: h.now + 1000, fee: 50 };
  const live = normalizeSave(JSON.parse(JSON.stringify(h.state)), h.now);
  assert.deepEqual(live.staff, h.state.staff);
});

test('tasks: workers get 1 task (2 from smart 3), [] = auto; robots keep setTask', () => {
  const h = team(5);
  const id = hire(h, 'barista');
  assert.equal(h.act('staff/setTasks', { uid: id, tasks: ['harvest'] }).error, 'unknown', 'café worker, farm task');
  assert.equal(h.act('staff/setTasks', { uid: id, tasks: ['brew', 'deliver'] }).error, 'tooMany');
  h.must('staff/setTasks', { uid: id, tasks: ['brew', 'brew'] });
  assert.deepEqual(unit(h, id).tasks, ['brew'], 'deduped');
  assert.equal(h.act('staff/setTasks', { uid: id, tasks: ['brew'] }).noop, true);
  unit(h, id).stats.smart = 3;
  h.must('staff/setTasks', { uid: id, tasks: ['brew', 'deliver'] });
  assert.deepEqual(D.unitTasks(unit(h, id)), ['brew', 'deliver']);
  h.must('staff/setTask', { uid: id, task: 'auto' }); // old path for a worker = setTasks([])
  assert.deepEqual(unit(h, id).tasks, []);
  const bot = hire(h, 'brewBot');
  h.must('staff/setTask', { uid: bot, task: 'brew' });
  assert.deepEqual(D.unitTasks(unit(h, bot)), ['brew']);
  assert.equal(h.act('staff/setTasks', { uid: bot, tasks: ['brew'] }).error, 'unknown');
});

test('rivals: visit picks the low-morale best worker, refuses when happy, keep / let go / resolve', () => {
  const h = team(5);
  const [a, b, c] = [hire(h, 'farmhand'), hire(h, 'farmhand'), hire(h, 'farmhand')];
  assert.equal(h.act('rival/visit', { zone: 'farm', roll: 0.9 }).noop, true, 'roll ≥ chance: nobody comes');
  assert.equal(h.act('rival/visit', { zone: 'farm', roll: 0 }).noop, true, 'everyone happy, no rare worker: no target');
  unit(h, a).morale = 40; unit(h, b).morale = 30; unit(h, b).stats.speed = 3;
  const r = h.must('rival/visit', { zone: 'farm', roll: 0.1 });
  const ev = r.events.find(e => e.type === 'poachStarted');
  assert.equal(ev.uid, b, 'the highest-level unhappy worker');
  assert.equal(ev.rival, RIVAL.names.farm);
  assert.deepEqual(h.state.staff.poach, { uid: b, zone: 'farm', until: h.now + RIVAL.keepSeconds * 1000, fee: RIVAL.keepFeePerLevel * 3 });
  assert.equal(h.act('rival/visit', { zone: 'farm', roll: 0 }).noop, true, 'one poach at a time');
  // keep: pay the fee, +20 morale
  const coins = h.state.player.coins;
  assert.equal(h.act('staff/keep', { uid: a }).error, 'unknown');
  h.must('staff/keep', { uid: b });
  assert.equal(h.state.player.coins, coins - RIVAL.keepFeePerLevel * 3);
  assert.equal(unit(h, b).morale, 50); assert.equal(h.state.staff.poach, null);
  assert.equal(h.state.staff.journal[0].type, 'kept');
  // let go: unit removed, 30 % of its price back
  h.must('rival/visit', { zone: 'farm', roll: 0 });
  assert.equal(h.state.staff.poach.uid, a);
  const c2 = h.state.player.coins;
  h.must('staff/letGo', { uid: a });
  assert.equal(unit(h, a), null);
  assert.equal(h.state.player.coins, c2 + Math.round(RIVAL.letGoRefund * STAFF.farmhand.cost));
  // resolve: time up → the worker leaves, nothing back
  unit(h, c).morale = 10;
  h.must('rival/visit', { zone: 'farm', roll: 0 });
  assert.equal(h.act('rival/resolve').noop, true, 'not yet');
  h.tick(RIVAL.keepSeconds * 1000 + 1);
  const res = h.must('rival/resolve');
  assert.equal(res.events.find(e => e.type === 'staffLeft').reason, 'poached');
  assert.equal(unit(h, c), null);
  // refuse: a happy rare worker says no
  unit(h, b).perk = 'swift'; unit(h, b).morale = 90;
  const ref = h.must('rival/visit', { zone: 'farm', roll: 0 });
  assert.ok(ref.events.some(e => e.type === 'poachRefused' && e.uid === b));
  assert.equal(h.state.staff.poach, null);
  assert.equal(h.state.staff.journal[0].type, 'poachRefused');
});

test('rare applicants: drawn from the seed with a perk and a dearer price; goldHands / swift / charming effects', () => {
  let seed = 0, rare = null;
  for (; seed < 5000 && !rare; seed++) rare = applicantsFor('shop', seed).find(a => a.perk === 'swift');
  assert.ok(rare, 'some seed draws a swift applicant');
  assert.ok(RARE.perks.includes(rare.perk));
  assert.equal(rare.stats.speed, RARE.swiftSpeed);
  const plain = applicantsFor('shop', seed - 1).find(a => !a.perk);
  if (plain) assert.equal(plain.cost % 5, 0);
  const count = Array.from({ length: 2000 }, (_, i) => applicantsFor('farm', i)).flat().filter(a => a.perk).length;
  assert.ok(count > 300 && count < 900, `≈10 % rare (${count} / 6000)`);
  const h = team(5);
  h.state.staff.pool.shop.seed = seed - 1;
  const idx = D.applicants(h.state, 'shop').findIndex(a => a.perk === 'swift');
  h.must('staff/recruit', { zone: 'shop', index: idx });
  const u = h.state.staff.units[0];
  assert.equal(u.perk, 'swift'); assert.equal(u.stats.speed, 3); assert.equal(u.paid, rare.cost);
  // goldHands: 2★ even at accuracy 1
  assert.equal(D.unitStars({ ...u, perk: 'goldHands' }), 2);
  // charming: +10 % on the cups it serves, booked as its earnings
  u.perk = 'charming';
  h.state.inventory.beans = 10;
  h.region().shop.orders.push({ id: 7, drink: 'espresso', stage: 'brewing', brewStart: h.now - 1e5, brewMs: 1000, stars: 1 });
  const r = h.must('shop/serve', { orderId: 7, uid: u.uid });
  const price = Math.round(D.starPrice(h.state, 'espresso', 1) * (1 + RARE.charmingBonus));
  assert.equal(r.events.find(e => e.type === 'served').coins, price);
  assert.equal(D.unitOf(h.state, u.uid).book.earned, price);
});

test('fire / sell: workers refund 30 % of the hire price, robots 50 % + 50 % of their parts; tickets refund nothing', () => {
  const h = team(5);
  const w = hire(h, 'farmhand');
  const bot = hire(h, 'brewBot');
  h.must('staff/upgradePart', { uid: bot, part: 'motor' });
  const parts = E.partCost('brewBot', 0);
  let c = h.state.player.coins;
  const r = h.must('staff/fire', { uid: w });
  assert.equal(h.state.player.coins, c + Math.round(FIRE.worker * STAFF.farmhand.cost));
  assert.equal(r.events.find(e => e.type === 'staffLeft').reason, 'fired');
  c = h.state.player.coins;
  h.must('staff/fire', { uid: bot });
  assert.equal(h.state.player.coins, c + Math.round(FIRE.robot * STAFF.brewBot.cost + FIRE.robotParts * parts));
  assert.equal(h.state.staff.units.length, 0);
  h.state.rewards.tickets = 1;
  const free = hire(h, 'farmhand');
  assert.equal(unit(h, free).paid, 0);
  c = h.state.player.coins;
  h.must('staff/fire', { uid: free });
  assert.equal(h.state.player.coins, c);
  assert.equal(h.act('staff/fire', { uid: free }).error, 'unknown');
});

test('books, ledger, journal: harvest / serve with uid earn, mistakes counted; ledger per minute, last 30; journal max 30', () => {
  const h = team(5);
  const fw = hire(h, 'farmhand'), bw = hire(h, 'barista');
  const plot = D.ownedPlots(h.state)[0].id;
  h.must('farm/plant', { plotId: plot, crooked: true, uid: fw });
  h.tick(D.plotGrowMs(h.state, h.region().plots[plot]));
  const r = h.must('farm/harvest', { plotId: plot, uid: fw, unripe: true });
  const beans = r.events.find(e => e.type === 'harvested').beans;
  assert.equal(unit(h, fw).book.earned, beans * BEANS.sellPrice);
  assert.equal(unit(h, fw).book.mistakes, 2, 'crooked + unripe');
  h.region().shop.orders.push({ id: 9, drink: 'espresso', stage: 'brewing', brewStart: h.now, brewMs: 1000, stars: 1 });
  h.must('shop/spill', { orderId: 9, uid: bw });
  h.must('staff/mistake', { uid: bw, kind: 'wrongTable' });
  assert.equal(unit(h, bw).book.mistakes, 2);
  // Without uid nothing changes (the player's own work)
  h.must('farm/plant', { plotId: plot });
  h.tick(D.plotGrowMs(h.state, h.region().plots[plot]));
  h.must('farm/harvest', { plotId: plot });
  assert.equal(unit(h, fw).book.earned, beans * BEANS.sellPrice);
  assert.equal(D.ledgerWindow(h.state, h.now).earned, beans * BEANS.sellPrice);
  // Ledger: one row per minute, last 30 kept
  for (let i = 0; i < 40; i++) { h.tick(60000); h.must('staff/stop', { uid: fw }); h.must('staff/resume', { uid: fw }); }
  assert.equal(h.state.staff.ledger.length, E.BOOKS.ledgerKeep);
  assert.equal(h.state.staff.ledger.at(-1).min, Math.floor(h.now / 60000));
  assert.equal(D.ledgerWindow(h.state, h.now, 10).spent, 10 * E.unitFee(unit(h, fw)));
  assert.equal(h.state.staff.journal.length, E.BOOKS.journalKeep);
  assert.equal(h.state.staff.journal[0].type, 'slacked', 'newest first');
});

test('mvp: the worker who earned most since the last call; everyone +10 morale', () => {
  const h = team(5);
  const a = hire(h, 'barista'), b = hire(h, 'barista');
  assert.equal(h.act('staff/mvp').noop, true, 'nobody earned anything');
  unit(h, a).book.earned = 30; unit(h, b).book.earned = 50;
  const r = h.must('staff/mvp');
  assert.deepEqual(r.events.find(e => e.type === 'mvp'), { type: 'mvp', uid: b, name: null, earned: 50 });
  assert.equal(unit(h, a).morale, 90); assert.equal(unit(h, b).morale, 90);
  unit(h, a).book.earned = 70; // +40 since the last MVP vs b's +0
  assert.equal(h.must('staff/mvp').events[0].uid, a);
});

test('rival / staff actions pause during the Lv10 incident and need play', () => {
  const h = team(5);
  h.state.story.phase = 'gate';
  assert.equal(h.act('rival/visit', { zone: 'farm', roll: 0 }).error, 'notPlaying');
  h.state.story.phase = 'expiry';
  assert.equal(h.act('staff/upkeep').error, 'paused');
});
