import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarm } from '../src/features/farm/model.js';
import { clampPrice, tipFactor, meanPrice, arrivalFactor } from '../src/features/cafe/recipes.js';
import { arrivalGap } from '../src/features/cafe/service.js';
const AT = 100000, fresh = () => createFarm(null, 'capital', () => {}, AT);
const sell = (farm, extra = {}) => farm.act('cafe', 'sell', { recipeId: 'phin-den', quality: 100, stars: 3, wait: 0, ...extra }, AT);
const setP = (farm, p) => farm.act('cafe', 'prices', { recipeId: 'phin-den', p }, AT);

test('F-42: p is clamped to 0.8–1.3 and rounded to 0.05 on set and on load', () => {
  assert.equal(clampPrice(5), 1.3); assert.equal(clampPrice(0), .8); assert.equal(clampPrice(1.07), 1.05); assert.equal(clampPrice(NaN), 1);
  const farm = fresh(); assert.ok(setP(farm, 9).ok); assert.equal(farm.progress.cafe.prices['phin-den'], 1.3);
  const saved = farm.progress; saved.cafe.prices = { 'phin-den': 0.1, nope: 1.2, latte: 'x' };
  assert.deepEqual(createFarm(saved, null, () => {}, AT).progress.cafe.prices, { 'phin-den': .8 });
  delete saved.cafe.prices; assert.deepEqual(createFarm(saved, null, () => {}, AT).progress.cafe.prices, {});
});
test('F-42: prices cannot change while the café is open', () => {
  const farm = fresh(); farm.act('cafe', 'toggle', null, AT); assert.equal(farm.progress.cafe.open, true);
  assert.equal(setP(farm, 1.2).ok, false); assert.equal(farm.progress.cafe.prices['phin-den'], undefined);
});
test('F-42: cup price is × p, tip drops for p > 1, robot and staff cups use the same p', () => {
  const farm = fresh(), base = sell(farm, { wait: .5, stars: 3 });
  setP(farm, 1.3); const dear = sell(farm, { wait: .5, stars: 3 });
  assert.ok(Math.abs(dear.price - base.price * 1.3) < .02);
  assert.ok(Math.abs(dear.tip - base.tip * .4) < .02, 'tip keeps its base, × 40%');
  assert.ok(Math.abs(tipFactor(1.3) - .4) < 1e-9); assert.equal(tipFactor(1.5), 0); assert.equal(tipFactor(.9), 1);
  const staff = sell(farm, { staff: true }), own = sell(farm); assert.ok(Math.abs(own.price - staff.price * 2) < .02);
  setP(farm, .8); assert.ok(sell(farm, { staff: true }).price < staff.price);
});
test('F-42: guest gap scales with p̄^1.5 weighted by order odds', () => {
  assert.ok(Math.abs(arrivalFactor(1.3) - 1.482) < .001);
  assert.equal(meanPrice({ a: 1.3 }, ['a', 'b']), 1.15);
  assert.equal(meanPrice({ a: 1.3 }, ['a', 'b'], { a: 3 }), (3 * 1.3 + 1) / 4);
  assert.ok(arrivalGap(0, 0, 50, 2, 0) > 3);
});
test('F-42: only a ★0 cup at p ≥ 1.2 costs an extra 0.3 reputation', () => {
  const farm = fresh(), rep = () => farm.progress.cafe.reputation, flop = () => { const r = rep(); sell(farm, { stars: 0 }); return rep() - r; };
  assert.ok(Math.abs(flop() + .6) < 1e-9); setP(farm, 1.15); assert.ok(Math.abs(flop() + .6) < 1e-9);
  setP(farm, 1.2); assert.ok(Math.abs(flop() + .9) < 1e-9);
  const r = rep(); sell(farm, { stars: 1 }); assert.ok(Math.abs(rep() - r) < 1e-9);
});
