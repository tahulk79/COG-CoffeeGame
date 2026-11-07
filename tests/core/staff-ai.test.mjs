// Café staff decisions (src/features/realm/staff-brain.js, docs/design/cafe-street.md §4): posts, job picking per
// post, the order rule (seat + beans), chaining, two cups, urgency and lane etiquette. Pure: no three.js, no store.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignPosts, pickShopJob, orderBlock, jobsFor, waitsForBrew, secondCup, nearestFirst, urgencyK, facing, yieldsTo,
  uidCompare, CHAIN_WAIT_MS, URGENT_SPEED,
} from '../../src/features/realm/staff-brain.js';

const NOW = 100000;
const ready = (id, extra = {}) => ({ id, drink: 'espresso', stage: 'brewing', brewStart: NOW - 5000, brewMs: 3000, ...extra });
const ctxOf = (over = {}) => {
  const claims = new Set(over.claims || []);
  return {
    post: 'allRounder', orders: [], now: NOW, carrying: null, queued: null, seatsFree: 4, brewSlots: 1, beans: 10,
    canBuyBeans: false, claimed: k => claims.has(k), hasSeat: () => true, seatOf: () => ({ x: 0, z: 0 }),
    need: () => 1, patience: o => o.p || 0, ownerIdle: () => false, ...over,
  };
};

test('posts: 1 all-rounder, 2 cashier + barista, 3+ runners; stable by uid; brewBot prefers barista', () => {
  assert.deepEqual([...assignPosts([{ uid: 's1', type: 'barista' }])], [['s1', 'allRounder']]);
  const two = assignPosts([{ uid: 's9', type: 'barista' }, { uid: 's10', type: 'barista' }]);
  assert.equal(two.get('s9'), 'cashier');
  assert.equal(two.get('s10'), 'barista');
  const bot = assignPosts([{ uid: 's1', type: 'brewBot' }, { uid: 's2', type: 'barista' }]);
  assert.equal(bot.get('s1'), 'barista');
  assert.equal(bot.get('s2'), 'cashier');
  const four = assignPosts([{ uid: 's4', type: 'barista' }, { uid: 's2', type: 'barista' }, { uid: 's3', type: 'brewBot' }, { uid: 's1', type: 'barista' }]);
  assert.equal(four.get('s3'), 'barista');
  assert.equal(four.get('s1'), 'cashier');
  assert.equal(four.get('s2'), 'runner');
  assert.equal(four.get('s4'), 'runner');
  // a unit on a break gets no post; the others re-spread
  const brk = assignPosts([{ uid: 's1', type: 'barista', stopped: { kind: 'phone' } }, { uid: 's2', type: 'barista' }]);
  assert.equal(brk.get('s1'), undefined);
  assert.equal(brk.get('s2'), 'allRounder');
  assert.equal(assignPosts([]).size, 0);
  assert.equal(assignPosts(null).size, 0);
  assert.ok(uidCompare('s2', 's10') < 0);
});

test('jobsFor: own jobs first, then the rest', () => {
  assert.deepEqual(jobsFor('cashier'), ['order', 'deliver', 'brew']);
  assert.deepEqual(jobsFor('barista'), ['brew', 'deliver', 'order']);
  assert.deepEqual(jobsFor('runner'), ['deliver', 'brew', 'order']);
  assert.deepEqual(jobsFor('allRounder'), ['deliver', 'brew', 'order']);
});

test('pickShopJob: most urgent ready cup, skipping claimed / carried / seatless ones', () => {
  const orders = [ready(1, { p: .2 }), ready(2, { p: .9 }), ready(3, { p: .95 }), ready(4, { p: .99 })];
  const ctx = ctxOf({ orders, carrying: 4, claims: ['order:3'] });
  assert.deepEqual(pickShopJob(ctx), { type: 'deliver', orderId: 2 });
  assert.equal(pickShopJob(ctxOf({ orders: [ready(1)], hasSeat: () => false, queued: null })), null);
  // not ready yet → nothing to deliver
  assert.equal(pickShopJob(ctxOf({ orders: [ready(1, { brewStart: NOW - 100 })], brewSlots: 1 })), null);
});

test('pickShopJob: post order, owner-idle hand-off, nobody idles while work waits', () => {
  const orders = [{ id: 7, drink: 'espresso', stage: 'taken' }];
  // cashier with a queue → order first
  assert.equal(pickShopJob(ctxOf({ post: 'cashier', orders, queued: 9 })).type, 'order');
  // cashier with no queue: brew is not its job; the barista is idle → leave it
  assert.equal(pickShopJob(ctxOf({ post: 'cashier', orders, ownerIdle: t => t === 'brew' })), null);
  // … but if the barista is busy, the cashier brews
  assert.deepEqual(pickShopJob(ctxOf({ post: 'cashier', orders })), { type: 'brew', orderId: 7 });
  // barista prefers brew over the queue
  assert.equal(pickShopJob(ctxOf({ post: 'barista', orders, queued: 9 })).type, 'brew');
  // station claimed by someone else → next job
  assert.equal(pickShopJob(ctxOf({ post: 'barista', orders, queued: 9, claims: ['station:brew'] })).type, 'order');
  // brew slots full → no brew
  const full = [...orders, { id: 8, stage: 'brewing', brewStart: NOW, brewMs: 9000 }];
  assert.equal(pickShopJob(ctxOf({ post: 'barista', orders: full })), null);
  // not enough beans for the drink
  assert.equal(pickShopJob(ctxOf({ post: 'barista', orders, beans: 1, need: () => 2 })), null);
});

test('orderBlock: seat and beans rule', () => {
  assert.equal(orderBlock(ctxOf({ queued: null })), 'noQueue');
  assert.equal(orderBlock(ctxOf({ queued: 1, seatsFree: 0 })), 'noSeat');
  assert.equal(orderBlock(ctxOf({ queued: 1, beans: 0 })), 'noBeans');
  assert.equal(orderBlock(ctxOf({ queued: 1, beans: 0, canBuyBeans: true })), null);
  assert.equal(orderBlock(ctxOf({ queued: 1, beans: 0, orders: [{ id: 2, stage: 'brewing', brewStart: NOW, brewMs: 1 }] })), 'noBeans'); // brewing frees no beans
  // beans already promised to taken orders do not count
  assert.equal(orderBlock(ctxOf({ queued: 1, beans: 1, orders: [{ id: 2, drink: 'x', stage: 'taken' }] })), 'noBeans');
  assert.equal(orderBlock(ctxOf({ queued: 1, beans: 2, orders: [{ id: 2, drink: 'x', stage: 'taken' }] })), null);
  // a blocked order is never picked
  assert.equal(pickShopJob(ctxOf({ queued: 1, beans: 0 })), null);
  assert.equal(pickShopJob(ctxOf({ queued: 1, seatsFree: 0 })), null);
});

test('chaining: wait for a quick brew only on posts that deliver', () => {
  assert.equal(waitsForBrew('allRounder', CHAIN_WAIT_MS), true);
  assert.equal(waitsForBrew('barista', 1200), true);
  assert.equal(waitsForBrew('allRounder', CHAIN_WAIT_MS + 1), false);
  assert.equal(waitsForBrew('cashier', 1000), false);
  assert.equal(waitsForBrew('allRounder', NaN), false);
});

test('two cups: second ready cup within 4 m of the first seat, nearest stop first', () => {
  const seats = { 1: { x: 0, z: 0 }, 2: { x: 3, z: 0 }, 3: { x: 10, z: 0 } };
  const orders = [ready(1), ready(2, { p: .1 }), ready(3, { p: .9 })];
  const ctx = ctxOf({ orders, seatOf: id => seats[id] });
  assert.equal(secondCup(ctx, 1, seats[1])?.id, 2); // 3 is more urgent but too far
  assert.equal(secondCup(ctxOf({ orders, seatOf: id => seats[id], claims: ['order:2'] }), 1, seats[1]), null);
  assert.equal(secondCup(ctx, 1, null), null);
  const stops = nearestFirst({ x: 0, z: 0 }, [{ id: 'far', x: 5, z: 0 }, { id: 'near', x: 1, z: 0 }]);
  assert.deepEqual(stops.map(s => s.id), ['near', 'far']);
});

test('urgency and lanes', () => {
  assert.equal(urgencyK(.75), URGENT_SPEED);
  assert.equal(urgencyK(.5), 1);
  // A walks +z, B walks -z towards it → facing; side by side → not
  assert.equal(facing(0, 0, 0, 0, 1, Math.PI), true);
  assert.equal(facing(0, 0, 0, 0, 1, 0), false);
  assert.equal(facing(0, 0, 0, 0, 3, Math.PI), false);
  assert.equal(facing(0, 0, 0, 0, 0, Math.PI), false);
  assert.equal(yieldsTo('s3', 's12'), 's3');
  assert.equal(yieldsTo('s12', 's3'), 's3');
});

test('levels & robots: low-level workers take the first in line, robots only their one task, auto picks the busiest', async () => {
  const { autoTask, ROBOT_POST } = await import('../../src/features/realm/staff-brain.js');
  const orders = [ready(1, { p: .1 }), ready(2, { p: .9 })];
  assert.equal(pickShopJob(ctxOf({ orders })).orderId, 2, 'urgent rule: closest to leaving first');
  assert.equal(pickShopJob(ctxOf({ orders, urgent: false })).orderId, 1, 'without it: first in line');
  // A robot set to "order" never carries a ready cup, even when that is the only work
  assert.equal(pickShopJob(ctxOf({ orders, only: 'order' })), null);
  assert.equal(pickShopJob(ctxOf({ orders, only: 'deliver' })).type, 'deliver');
  assert.equal(autoTask(['order', 'brew', 'deliver'], { order: 1, brew: 3, deliver: 2 }, 'order'), 'brew');
  assert.equal(autoTask(['plant', 'harvest'], { plant: 2, harvest: 2 }, 'harvest'), 'harvest', 'ties keep the current task');
  assert.equal(ROBOT_POST.brew, 'barista');
});

test('hard drinks: a unit that may not make them leaves them for the player', () => {
  const orders = [{ id: 1, drink: 'latte', stage: 'taken', p: .9 }, { id: 2, drink: 'espresso', stage: 'taken', p: .1 }];
  const isHard = d => d === 'latte';
  assert.equal(pickShopJob(ctxOf({ orders, post: 'barista', isHard })).orderId, 1);
  assert.equal(pickShopJob(ctxOf({ orders, post: 'barista', isHard, canHard: false })).orderId, 2);
  assert.equal(pickShopJob(ctxOf({ orders: orders.slice(0, 1), only: 'brew', isHard, canHard: false })), null);
});

// ---------- staff manager realm rules (docs/design/staff-manager.md §6, §9) ----------
test('worker tasks: onlyAny restricts café jobs; posts follow tasks', async () => {
  const { allows, ctxTakes } = await import('../../src/features/realm/staff-brain.js');
  assert.equal(allows([], 'brew'), true);
  assert.equal(allows(null, 'brew'), true);
  assert.equal(allows(['order'], 'brew'), false);
  const orders = [ready(1), { id: 2, drink: 'espresso', stage: 'taken' }];
  // an all-rounder set to brew only never carries the ready cup
  assert.deepEqual(pickShopJob(ctxOf({ orders, brewSlots: 2, onlyAny: ['brew'] })), { type: 'brew', orderId: 2 });
  assert.equal(pickShopJob(ctxOf({ orders: [ready(1)], onlyAny: ['brew'] })), null);
  // a cashier whose task is deliver: deliver is its own job then (no hand-off to an idle runner)
  assert.equal(pickShopJob(ctxOf({ post: 'cashier', orders, onlyAny: ['deliver'], ownerIdle: () => true })).type, 'deliver');
  // a barista with brew + deliver still hands an order to the idle cashier and is never offered it
  assert.equal(pickShopJob(ctxOf({ post: 'barista', orders: [], queued: 5, onlyAny: ['brew', 'deliver'] })), null);
  assert.equal(ctxTakes({ only: 'order' }, 'order'), true);
  assert.equal(ctxTakes({ onlyAny: ['brew'], post: 'cashier' }, 'order'), false);
  assert.equal(ctxTakes({ post: 'cashier' }, 'order'), true);
  assert.equal(ctxTakes({ post: 'runner' }, 'order'), false);
  // posts: the worker allowed to take orders is the cashier, the brewer the barista; benched units get none
  const p = assignPosts([{ uid: 's1', type: 'barista', tasks: ['brew'] }, { uid: 's2', type: 'barista', tasks: ['order'] }, { uid: 's3', type: 'barista', active: false }]);
  assert.equal(p.get('s2'), 'cashier');
  assert.equal(p.get('s1'), 'barista');
  assert.equal(p.get('s3'), undefined);
});

test('states: pose, head icon and fix bubble per unit state', async () => {
  const { poseOf, stateIconKey, showsFix } = await import('../../src/features/realm/staff-brain.js');
  for (const st of ['phone', 'battery', 'overheat', 'jam']) assert.equal(poseOf(st, true, true), 'stop', st);
  assert.equal(poseOf('ok', true, false), 'bench');
  assert.equal(poseOf('sulking', true, true), 'bench', 'bench wins over sulking');
  assert.equal(poseOf('lunch', false, true), 'sit');
  assert.equal(poseOf('sulking', false, true), 'sulk');
  assert.equal(poseOf('tired', false, true, 0), 'sit', 'exhausted: sits down');
  assert.equal(poseOf('hungry', false, true, 50), 'stand', 'starving: stands still');
  assert.equal(poseOf('tired', false, false, 10), 'work', 'tired but not empty: works slower');
  assert.equal(poseOf('ok', false, false), 'work');
  assert.equal(stateIconKey('ok', false), '');
  assert.equal(stateIconKey('ok', true), 'bench');
  assert.equal(stateIconKey('jam', true), 'jam');
  assert.equal(stateIconKey('hungry', false), 'hungry');
  assert.equal(showsFix('stop', true), true);
  assert.equal(showsFix('sit', true), true);
  assert.equal(showsFix('work', true), false);
  assert.equal(showsFix('bench', true), false);
  assert.equal(showsFix('sit', false), false, 'lunch: no paid fix');
});

test('vitals batching: interval grows with the team, no-op batches skipped, expired timers flush', async () => {
  const { vitalsInterval, vitalsNoop, timerDue, TICKS } = await import('../../src/features/realm/staff-brain.js');
  assert.equal(vitalsInterval(1), TICKS.vitalsSeconds);
  assert.equal(vitalsInterval(10), TICKS.vitalsSeconds);
  assert.equal(vitalsInterval(40), 40 / TICKS.maxDispatchPerSecond);
  assert.ok(vitalsInterval(200) <= 120, 'inside the reducer clamp');
  assert.equal(vitalsNoop({ robot: false, energy: 100, max: 100, morale: 50 }, 0), true);
  assert.equal(vitalsNoop({ robot: false, energy: 100, max: 100, morale: 50 }, 2), false, 'work drains');
  assert.equal(vitalsNoop({ robot: false, energy: 80, max: 100 }, 0), false, 'rest restores');
  assert.equal(vitalsNoop({ robot: false, energy: 100, max: 100, morale: 50, funny: true }, 0), false, 'funny regains morale');
  assert.equal(vitalsNoop({ robot: true, heat: 0 }, 0, 0), true);
  assert.equal(vitalsNoop({ robot: true, heat: 10 }, 0, 0), false, 'cools down');
  assert.equal(vitalsNoop({ robot: true, heat: 0 }, 0, 1), false, 'jobs wear it');
  assert.equal(timerDue({ breakUntil: 100 }, 99), false);
  assert.equal(timerDue({ breakUntil: 100 }, 100), true);
  assert.equal(timerDue({ stopped: { kind: 'overheat', until: 50 } }, 60), true);
  assert.equal(timerDue({ stopped: { kind: 'jam' } }, 60), false);
  assert.equal(timerDue(null, 60), false);
});

test('knocking a jammed robot: taps in a row count, a pause starts over', async () => {
  const { knockStep, KNOCK } = await import('../../src/features/realm/staff-brain.js');
  let n = 0, at = -Infinity;
  for (const now of [1000, 1500, 2000]) { n = knockStep(n, at, now); at = now; }
  assert.equal(n, KNOCK.taps);
  assert.equal(knockStep(2, 0, KNOCK.gapMs + 1), 1);
});
