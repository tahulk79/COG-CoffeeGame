import test from 'node:test';
import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { createFarm } = await import('../src/features/farm/model.js');
const { wireFarm } = await import('../src/shared/analytics/wire.js');
const { addRealEntry, env } = await import('../src/state/memory.js');
env.readOnly = () => false;
const AT = 100000, fresh = () => createFarm(null, 'capital', () => {}, AT);
const record = farm => { const log = []; const off = farm.onEvent((t, p) => log.push([t, p])); return { log, off }; };

test('onEvent: unsubscribe stops events, a throwing listener does not break others or the game', () => {
  const farm = fresh(), quiet = console.error; console.error = () => {};
  farm.onEvent(() => { throw new Error('boom'); });
  const { log, off } = record(farm);
  const sell = () => farm.act('cafe', 'sell', { recipeId: 'phin-den', quality: 100, stars: 3, wait: 0 }, AT);
  assert.ok(sell().ok); // first cup, listener threw but act still succeeds
  const n = log.length; assert.ok(n >= 1);
  off(); sell(); console.error = quiet;
  assert.equal(log.length, n);
});

test('field_bought is emitted once per purchase, not on failure', () => {
  const s = fresh().progress; s.coins = 5000;
  const farm = createFarm(s, null, () => {}, AT), { log } = record(farm);
  assert.ok(farm.act('field-1', 'expand', null, AT).ok);
  assert.equal(farm.act('field-1', 'expand', null, AT).ok, false);
  const bought = log.filter(e => e[0] === 'field_bought');
  assert.equal(bought.length, 1); assert.equal(bought[0][1].index, 1);
});

test('tutorial_completed only when served goes 0 -> 1', () => {
  const farm = fresh(), { log } = record(farm);
  for (let i = 0; i < 3; i++) farm.act('cafe', 'sell', { recipeId: 'phin-den', quality: 100, stars: 3, wait: 0 }, AT);
  const t = log.filter(e => e[0] === 'tutorial_completed');
  assert.equal(t.length, 1); assert.equal(t[0][1].step, 'first_cup');
});

test('shift_ended carries the reported counts', () => {
  const farm = fresh(), { log } = record(farm);
  farm.act('cafe', 'shift', { served: 6, goal: 5, avg: 3, lost: 2, revenue: 40, costs: 7 }, AT);
  const e = log.find(e => e[0] === 'shift_ended')[1];
  assert.deepEqual([e.cups, e.tier, e.left, e.revenue, e.costs], [6, 1, 2, 40, 7]);
});

test('workday_ended only on live ticks, not offline catch-up', () => {
  const farm = fresh(), { log } = record(farm);
  farm.tick(AT + 6 * 60000 + 1000 - 30000); farm.tick(AT + 6 * 60000 + 1000); // ~live, crossing the work day
  assert.equal(log.filter(e => e[0] === 'workday_ended').length === 1, true);
  const before = log.length; farm.tick(AT + 10 * 6 * 60000 + 500000); // huge gap = offline
  assert.equal(log.length, before);
});

test('wireFarm is idempotent, maps events, and detach unsubscribes', () => {
  const farm = fresh(), calls = [];
  const d1 = wireFarm(farm, (e, p) => calls.push(e)), d2 = wireFarm(farm, () => calls.push('dup'));
  assert.equal(d1, d2);
  farm.act('cafe', 'sell', { recipeId: 'phin-den', quality: 100, stars: 3, wait: 0 }, AT);
  assert.ok(calls.includes('tutorial_completed') && !calls.includes('dup'));
  const n = calls.length; d1(); farm.act('cafe', 'shift', { served: 1, goal: 1, avg: 3 }, AT);
  assert.equal(calls.length, n);
});

test('memory events call farm.act("memory","xp") with kind / insight', () => {
  const farm = fresh(), acts = [], act = farm.act;
  farm.act = (...a) => { acts.push(a); return act(...a); };
  const off = wireFarm(farm, () => {});
  addRealEntry({ recipeId: 'v60', taste: { acidity: 3 }, insight: { observation: 'a', hypothesis: 'b', nextChange: 'c' } });
  off();
  assert.deepEqual(acts.filter(a => a[0] === 'memory').map(a => a.slice(0, 3)), [['memory', 'xp', { kind: 'real' }], ['memory', 'xp', { insight: true }]]);
});
