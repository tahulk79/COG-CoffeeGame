import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, GEAR, SCORE_MODEL_VERSION, recipeById, lockReason } from '../src/features/cafe/recipes.js';
import { createFarm } from '../src/features/farm/model.js';
import { createCafeService } from '../src/features/cafe/service.js';

const AT = 1_700_000_000_000, fresh = () => createFarm(null, 'capital', () => {}, AT);

test('V60 is available on a new save without buying gear; old saves keep or gain level 1', () => {
  const p = fresh().progress, v60 = recipeById('v60');
  assert.equal(p.cafe.gear.v60, 1);
  assert.equal(lockReason(v60, p.cafe), '');
  assert.deepEqual(GEAR.find(g => g.id === 'v60').prices, [0, 60, 120]);
  const old = fresh().progress; old.cafe.gear.v60 = 0;
  assert.equal(createFarm(old, null, () => {}, AT).progress.cafe.gear.v60, 1);
  old.cafe.gear.v60 = 2;
  assert.equal(createFarm(old, null, () => {}, AT).progress.cafe.gear.v60, 2);
});

test('V60 steps: temperature, bloom, main pour, final pour and total time', () => {
  const s = recipeById('v60').steps;
  assert.equal(s.length, 9);
  const pours = s.filter(x => x.type === 'pour');
  assert.deepEqual(pours.map(x => [x.unit, ...x.target]), [['g', 14, 16], ['°C', 92, 94], ['g', 25, 40], ['g', 140, 160], ['g', 235, 265]]);
  const time = s.at(-1);
  assert.equal(time.type, 'pick');
  assert.equal(time.options.filter(o => o.ok === 1).length, 1);
  assert.equal(time.options.length, 3);
});

test('cup scoring is deterministic and carries the model version', () => {
  assert.equal(SCORE_MODEL_VERSION, 1);
  const p = fresh();
  const brew = () => p.act('cafe', 'brew', { recipeId: 'v60', cropId: 'arabica', score: 88, demo: false });
  const a = brew(), b = brew();
  assert.equal(a.ok, true);
  assert.equal(a.quality, b.quality);
});

test('starter stock: arabica 300 g and 40 filters on a new save only', () => {
  const p = fresh().progress;
  assert.equal(p.cafe.stock.roasted.arabica, 300);
  assert.equal(p.cafe.stock.roasted.robusta, 600);
  assert.equal(p.cafe.supplies.filter, 40);
  const again = createFarm(p, null, () => {}, AT).progress;
  assert.equal(again.cafe.stock.roasted.arabica, 300);
  const old = fresh().progress; old.cafe.stock.roasted.arabica = 0; old.cafe.lots = old.cafe.lots.filter(l => l.cropId !== 'arabica'); old.cafe.supplies.filter = 0;
  const reloaded = createFarm(old, null, () => {}, AT).progress;
  assert.equal(reloaded.cafe.stock.roasted.arabica, 0);
  assert.equal(reloaded.cafe.supplies.filter, 0);
});

test('the first order of a save that never sold a cup is V60', () => {
  let clock = AT; const realNow = Date.now; Date.now = () => clock;
  try {
    const farm = createFarm(null, 'capital', () => {}, clock); farm.setCafeActive(true);
    const svc = createCafeService(farm, { notice: () => {}, reward: () => {} });
    svc.toggleOpen();
    for (let i = 0; i < 2000 && !svc.customers.some(c => c.recipeId); i++) { clock += 500; svc.update(.5, clock); svc.autoRegister(); }
    assert.equal(svc.customers.find(c => c.recipeId)?.recipeId, 'v60');
  } finally { Date.now = realNow; }
});

test('V60 main and final pours are scale totals (cumulative), bloom is not (QA 04/11)', () => {
  const steps = recipeById('v60').steps.filter(s => s.type === 'pour' && s.unit === 'g');
  const [dose, bloom, main, final] = steps;
  assert.ok(!dose.cumulative && !bloom.cumulative);
  assert.equal(main.cumulative, true); assert.equal(final.cumulative, true);
  assert.ok(main.target[0] > bloom.target[1] && final.target[0] > main.target[1]);
});
