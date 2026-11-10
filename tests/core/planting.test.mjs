// Planting many at once: wide strokes and the Fill button cost exactly what planting one by one costs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../../src/core/game.js';
import { createSave } from '../../src/core/state.js';
import * as D from '../../src/core/derive.js';
import { PLANT_ROW } from '../../src/core/config/economy.js';

const T0 = 1_800_000_000_000;
function farm(coins = 50000) {
  const g = { now: T0, s: createSave(T0, { gender: 'female', name: 'T' }) };
  g.act = (type, payload = {}) => { const r = apply(g.s, { type, payload }, { now: g.now, dev: true }); if (r.ok && !r.noop) g.s = r.state; return r; };
  g.act('story/introDone'); g.act('story/teacherDone');
  g.act('world/unlockRegion', { regionId: 'vn-1' }); g.act('world/enterRegion', { regionId: 'vn-1' }); g.act('play/chooseGame', { game: 'farm' });
  g.act('dev/grant', { coins });
  return g;
}
const fields = g => D.region(g.s).fields.length;

test('rowPlan: three rows side by side, each spot apart, middle row first', () => {
  const g = farm(), one = D.rowPlan(g.s, 'robusta', 0, 8, 6, 8, 1), three = D.rowPlan(g.s, 'robusta', 0, 8, 6, 8, 3);
  assert.equal(three.rows, 3);
  assert.equal(three.spots.length, one.spots.length * 3);
  assert.deepEqual(three.spots.slice(0, one.spots.length).map(p => [p.x, p.z]), one.spots.map(p => [p.x, p.z]));
  assert.equal(new Set(three.spots.map(p => `${p.x},${p.z}`)).size, three.spots.length);
});

test('rowPlan: never more than maxSpots, rows clamped', () => {
  const g = farm(), p = D.rowPlan(g.s, 'robusta', -20, 8, 25, 8, 99);
  assert.equal(p.rows, PLANT_ROW.maxRows);
  assert.ok(p.spots.length <= PLANT_ROW.maxSpots);
});

test('farm/plantRow rows: plants what the plan promises and charges its cost', () => {
  const g = farm(), plan = D.rowPlan(g.s, 'robusta', 0, 8, 6, 8, 3), before = g.s.player.coins, n0 = fields(g);
  const r = g.act('farm/plantRow', { x0: 0, z0: 8, x1: 6, z1: 8, crop: 'robusta', rows: 3 });
  assert.equal(r.ok, true);
  assert.equal(fields(g) - n0, plan.n);
  assert.ok(Math.abs(before - g.s.player.coins - plan.cost) < 1e-6);
});

test('farm/plantFill: nearest free spots, and a second press keeps growing the block', () => {
  const g = farm(), n0 = fields(g);
  assert.equal(g.act('farm/plantFill', { x: 0, z: 8, crop: 'robusta' }).ok, true);
  const first = fields(g) - n0;
  assert.ok(first > 0 && first <= PLANT_ROW.fillTrees);
  assert.equal(g.act('farm/plantFill', { x: 0, z: 8, crop: 'robusta' }).ok, true);
  assert.ok(fields(g) - n0 > first);
});

test('farm/plantFill: stops at the coins, never goes negative', () => {
  const g = farm(0);
  g.s.player.coins = 40;
  g.act('farm/plantFill', { x: 0, z: 8, crop: 'robusta' });
  assert.ok(g.s.player.coins >= 0);
  assert.equal(g.act('farm/plantFill', { x: NaN, z: 8, crop: 'robusta' }).ok, false);
});

test('farm/harvestAll: picks every ripe tree, gives the same beans as picking by hand, leaves growing ones', () => {
  const g = farm();
  g.act('farm/plantFill', { x: 0, z: 8, crop: 'robusta', max: 6 });
  const planted = D.ownedPlots(g.s).length;
  assert.equal(g.act('farm/harvestAll').ok, false); // nothing ripe yet
  g.act('dev/ripen', {});
  g.s = { ...g.s }; g.now += 1000;
  const r = g.act('farm/harvestAll');
  assert.equal(r.ok, true);
  assert.equal(r.events.filter(e => e.type === 'harvested').length, planted);
  assert.ok(D.stored(g.s) > 0);
  assert.equal(D.ownedPlots(g.s).filter(p => D.plotState(g.s, p.id, g.now).stage === 'ready').length, 0);
});

test('farm/harvestAll: a full storehouse stops the round and says so', () => {
  const g = farm();
  g.act('farm/plantFill', { x: 0, z: 8, crop: 'robusta', max: 24 });
  g.act('dev/ripen', {});
  g.act('dev/grant', { beans: Math.max(0, D.capacity(g.s) - D.stored(g.s) - 2) });
  const r = g.act('farm/harvestAll');
  assert.equal(r.ok, true);
  const done = r.events.find(e => e.type === 'harvestedAll');
  assert.equal(done.full, true);
  assert.ok(done.n < D.ownedPlots(g.s).length);
});
