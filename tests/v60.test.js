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
    // F-47: chưa có cafe-intro thì ca tập tự mở trong update(), không mở bằng tay.
    for (let i = 0; i < 2000 && !svc.customers.some(c => c.recipeId); i++) { clock += 500; svc.update(.5, clock); svc.autoRegister(); }
    assert.equal(svc.customers.find(c => c.recipeId)?.recipeId, 'v60');
  } finally { Date.now = realNow; }
});

// F-47 (Q7): ca tập tự mở khi đủ chè, 1 khách V60 đứng sẵn, khoá Mở/Đóng, kết thúc ngay ở ly đầu.
test('practice shift opens itself with one V60 guest at the register and ends at the first sale', () => {
  let clock = AT; const realNow = Date.now; Date.now = () => clock;
  try {
    const farm = createFarm(null, 'capital', () => {}, clock); farm.setCafeActive(true);
    const reports = [], svc = createCafeService(farm, { notice: () => {}, reward: () => {}, onShiftEnd: r => reports.push(r) });
    assert.equal(svc.training, true); assert.equal(svc.trainingValve, false);
    assert.equal(farm.peek().cafe.open, false);
    svc.update(.1, clock);
    assert.equal(farm.peek().cafe.open, true);
    assert.equal(svc.shift.training, true); assert.equal(svc.shift.endsAt, Infinity);
    assert.equal(svc.customers.length, 1); assert.equal(svc.customers[0].phase, 'queue'); assert.equal(svc.customers[0].path.length, 0);
    assert.equal(svc.toggleOpen().ok, false); // không đóng được giữa ca tập
    assert.equal(svc.autoRegister(false), false); // Auto ca tập không nhận order thay người chơi
    assert.equal(svc.customers[0].recipeId, null);
    assert.equal(svc.autoRegister(), true);
    const guest = svc.customers[0]; assert.equal(guest.recipeId, 'v60');
    for (let i = 0; i < 200 && !['seated', 'pickup'].includes(guest.phase); i++) { clock += 500; svc.update(.5, clock); }
    assert.equal(svc.customers.filter(c => !['drinking', 'leaving'].includes(c.phase)).length, 1); // chỉ 1 khách chưa phục vụ
    svc.addDrink({ recipeId: 'v60', quality: 80, stars: 2, memory: false });
    if (guest.seat) svc.arriveTable(guest.seat.table); else svc.arriveRegister();
    clock += 100; svc.update(.1, clock);
    assert.equal(reports.length, 1); assert.equal(reports[0].training, true);
    assert.equal(farm.peek().cafe.open, false);
    assert.ok(farm.peek().tutorial.seen.includes('cafe-intro'));
    assert.equal(farm.peek().cafe.shiftLog.length, 0); // ca tập không ghi sổ ca, không có mốc
    assert.equal(svc.training, false);
    assert.equal(svc.toggleOpen().ok, true); // «Mở ca mới» mở ca thường
    assert.equal(svc.shift.training, false);
  } finally { Date.now = realNow; }
});

// Van an toàn: save cũ / nơi chỉ quán hết chè thì 🚪 bỏ ca tập, mở ca thường, quán không kẹt.
test('practice shift does not open without roasted arabica; 🚪 then opens a regular shift', () => {
  {
    const base = fresh().progress; // service không phân loại nơi: cùng đường cho nơi 'both' và nơi chỉ quán
    base.cafe.lots = base.cafe.lots.filter(l => l.cropId !== 'arabica');
    const farm = createFarm(base, null, () => {}, AT); farm.setCafeActive(true);
    const svc = createCafeService(farm, { notice: () => {}, reward: () => {} });
    assert.equal(svc.trainingBeans(), false); assert.equal(svc.trainingValve, true);
    svc.update(.1, AT);
    assert.equal(farm.peek().cafe.open, false); assert.equal(svc.shift, null);
    assert.equal(svc.toggleOpen().ok, true);
    assert.ok(farm.peek().tutorial.seen.includes('cafe-intro'));
    assert.equal(svc.training, false); assert.equal(svc.shift.training, false);
  }
});

// F-47 (Q8): 'v60-guided' là id hướng dẫn hợp lệ; save có V60 ★★ coi như đã xem ly làm mẫu.
test('v60-guided is a tutorial id and old saves with V60 best ≥ 70 skip the guided cup', () => {
  const farm = fresh();
  assert.equal(farm.act('tutorial', 'seen', 'v60-guided').ok, true);
  const base = fresh().progress; base.cafe.mastery.v60 = { best: 75, made: 2 };
  assert.ok(createFarm(base, null, () => {}, AT).progress.tutorial.seen.includes('v60-guided'));
  const low = fresh().progress; low.cafe.mastery.v60 = { best: 60, made: 1 };
  assert.equal(createFarm(low, null, () => {}, AT).progress.tutorial.seen.includes('v60-guided'), false);
});

test('V60 main and final pours are scale totals (cumulative), bloom is not (QA 04/11)', () => {
  const steps = recipeById('v60').steps.filter(s => s.type === 'pour' && s.unit === 'g');
  const [dose, bloom, main, final] = steps;
  assert.ok(!dose.cumulative && !bloom.cumulative);
  assert.equal(main.cumulative, true); assert.equal(final.cumulative, true);
  assert.ok(main.target[0] > bloom.target[1] && final.target[0] > main.target[1]);
});
