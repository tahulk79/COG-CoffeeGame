import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const U = await import('../src/features/awakening/unlocks.js');
const F = await import('../src/features/farm/rules.js');
const { default: locales } = await import('../src/i18n/locales/awakening.js');

test('hasKey gates on awakening.keys only', () => {
  assert.equal(U.hasKey(null, 'nature'), false); assert.equal(U.hasKey({}, 'nature'), false);
  const p = { awakening: { keys: [{ id: 'nature', at: 1 }] } };
  assert.equal(U.hasKey(p, 'nature'), true); assert.equal(U.hasKey(p, 'balance'), false);
});

test('regionNumbers formats the F-43 table', () => {
  assert.deepEqual(U.regionNumbers('co', 'arabica'), { yield: '×1', quality: '+8', growth: '×1.1' });
  assert.deepEqual(U.regionNumbers('br', 'liberica'), { yield: '×0.85', quality: '−5', growth: '×1.1' });
  assert.deepEqual(U.regionNumbers('zz', 'arabica'), { yield: '×1', quality: '+0', growth: '×1' });
});

test('lastBatches: one machine, newest first, capped at 10', () => {
  const list = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, machine: i % 2 ? 'dryer' : 'roaster', quality: i }));
  const out = U.lastBatches(list, 'dryer'); assert.equal(out.length, 10); assert.equal(out[0].id, 'b19'); assert.ok(out.every(b => b.machine === 'dryer'));
  assert.equal(U.lastBatches(list, 'dryer', 99).length, 10); assert.deepEqual(U.lastBatches(undefined, 'dryer'), []);
});

test('tasteHint is deterministic and covers the three hints', () => {
  const colors = ['#aa785c', '#6f8fb0', '#b0667a', '#7e9a5c', '#c09a4f', '#8d74a8', '#5f9d95', '#c27a52'];
  for (const c of colors) { assert.equal(U.tasteHint(c), U.tasteHint(c)); assert.ok(U.TASTE_HINTS.includes(U.tasteHint(c))); }
  assert.ok(new Set(colors.map(U.tasteHint)).size >= 2);
});

test('shiftProfit and recipeRows', () => {
  assert.equal(U.shiftProfit({ revenue: 100, costs: 20, wages: 30.5, beans: 9.25 }), 40.25);
  assert.equal(U.shiftProfit({}), 0);
  assert.deepEqual(U.recipeRows({ a: { cups: 1, revenue: 2 }, b: { cups: 3, revenue: 7.5 } }), [{ id: 'b', cups: 3, revenue: 7.5 }, { id: 'a', cups: 1, revenue: 2 }]);
  assert.deepEqual(U.recipeRows(undefined), []);
});

test('experimentDiff counts only variables filled on both sides', () => {
  const base = { actual: { doseG: 18, waterG: 300 }, bean: { name: 'Ke' }, equipment: { grinder: '' } };
  assert.deepEqual(U.experimentDiff(base, { actual: { doseG: '18', waterG: '300' }, bean: { name: 'ke ' }, equipment: { grinder: 'X' } }), []);
  assert.deepEqual(U.experimentDiff(base, { actual: { doseG: '20', waterG: '320' }, bean: { name: 'Ke' } }).sort(), ['actual.doseG', 'actual.waterG']);
});

test('coffeeDna ignores missing values and uses liking >= 4', () => {
  const e = (liking, taste, extra = {}) => ({ kind: 'game', recipeId: 'v60', bean: { name: 'Ke' }, taste: { aroma: 0, acidity: 0, sweetness: 0, bitterness: 0, body: 0, aftertaste: 0, liking, ...taste }, ...extra });
  const d = U.coffeeDna([e(5, { acidity: 4 }), e(4, { acidity: 2, body: 3 }), e(2, { acidity: 5 }), { kind: 'real', taste: null }]);
  assert.equal(d.n, 3); assert.equal(d.nLiked, 2);
  assert.equal(d.liked.acidity, 3); assert.equal(d.all.acidity, 3.67); assert.equal(d.liked.body, 3); assert.equal(d.liked.aroma, null);
  assert.equal(d.topMethod, 'v60'); assert.equal(d.topBean, 'Ke');
  assert.deepEqual(U.coffeeDna([]).liked.aroma, null);
});

test('keys do not change economy rules', () => {
  const run = () => [F.careYield(true, false), F.careQuality(true, true), F.marketQualityFactor(80), F.marketValue(300, 100), F.orderPay({ reward: 30 }, 90), F.regionCrop('ke', 'arabica'), F.regionFit('co', 'robusta'), F.supplierPrice('vn')];
  const without = run(); const keys = { awakening: { keys: ['nature', 'transformation', 'curiosity', 'empathy', 'balance', 'connection'].map(id => ({ id, at: 1 })) } };
  assert.ok(U.hasKey(keys, 'balance')); assert.deepEqual(run(), without);
  for (const f of ['src/features/farm/rules.js', 'src/features/farm/model.js', 'src/features/cafe/recipes.js']) assert.ok(!/hasKey|awakening\/unlocks/.test(readFileSync(f, 'utf8')), f);
});

test('locale: every unlock string exists in EN and VI', () => {
  for (const k of ['curiosity', 'nature', 'transformation', 'empathy', 'balance', 'connection']) for (const l of ['en', 'vi']) assert.ok(locales[l][`awakening.unlock.${k}`], `${l} ${k}`);
});
