import test from 'node:test';
import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const R = await import('../src/features/awakening/rules.js');
const V = await import('../src/features/awakening/view.js');
const { default: locales } = await import('../src/i18n/locales/awakening.js');

test('sortQuestions: ready first, locked last, stable inside a state', () => {
  const A = R.emptyAwakening(); A.questions.costs.state = 'ready'; A.questions.ripe.state = 'solved';
  const ids = V.sortQuestions(R.viewQuestions(A)).map(q => q.id);
  assert.equal(ids[0], 'costs'); assert.equal(ids.at(-1), 'roast-age'); assert.ok(ids.indexOf('ripe') > ids.indexOf('water'));
  assert.equal(V.uiState(R.viewQuestions(A).find(q => q.id === 'region')), 'locked');
});

test('attentionIds: ready questions, and adjust while trying before a hypothesis', () => {
  const A = R.emptyAwakening(); assert.deepEqual(V.attentionIds(R.viewQuestions(A), A), []);
  A.questions.costs.state = 'ready'; A.questions.adjust.state = 'trying';
  assert.deepEqual(V.attentionIds(R.viewQuestions(A), A).sort(), ['adjust', 'costs']);
  A.firstKey.step = 3; assert.deepEqual(V.attentionIds(R.viewQuestions(A), A), ['costs']);
});

test('fragmentRows: six rows type -> Key with pips capped at 3', () => {
  const A = R.emptyAwakening(); A.fragments = ['extraction', 'extraction', 'origin'].map((type, i) => ({ id: `f${i}`, type, questionId: 'x' }));
  A.messages = ['extraction']; A.keys = [{ id: 'curiosity', at: 1 }];
  const rows = V.fragmentRows(A), ex = rows.find(r => r.type === 'extraction');
  assert.equal(rows.length, 6); assert.deepEqual([ex.key, ex.count, ex.message, ex.hasKey, ex.dimension], ['curiosity', 2, true, true, 'universe']);
  assert.equal(rows.find(r => r.type === 'reflection').key, 'connection');
  assert.equal(V.pips(2), '●●○'); assert.equal(V.pips(0), '○○○');
});

test('firstKeyView: steps 1-7, hypothesis only at step 2, decode only when ready at step 4', () => {
  const A = R.emptyAwakening(), at = s => { A.firstKey.step = s; return V.firstKeyView(A); };
  assert.deepEqual(at(0).done, Array(7).fill(false)); assert.equal(at(0).current, 1);
  assert.ok(at(2).canHypothesis && at(2).current === 3 && !at(3).canHypothesis);
  A.questions.adjust.state = 'ready'; assert.ok(at(4).canDecode); A.questions.adjust.state = 'trying'; assert.ok(!at(4).canDecode);
  const v6 = at(6); assert.deepEqual(v6.done, [true, true, true, true, true, false, false]); assert.ok(v6.applyPending);
  assert.ok(at(7).finished && at(7).done.every(Boolean) && at(7).current === 8);
});

test('isFirstPair: only the first two V60 cups, either order', () => {
  const A = R.emptyAwakening(); A.firstKey.entries = ['a', 'b'];
  assert.ok(V.isFirstPair(A, [{ id: 'b' }, { id: 'a' }])); assert.ok(!V.isFirstPair(A, [{ id: 'a' }, { id: 'c' }])); assert.ok(!V.isFirstPair(A, [{ id: 'a' }, { id: 'a' }]));
});

test('evidenceLines splits on " | "', () => assert.deepEqual(V.evidenceLines('x {a} | y {b}'), ['x {a}', 'y {b}']));

test('i18n: EN and VI have the same keys, every question has title/hint/options, lore and apply for 6 types', () => {
  assert.deepEqual(Object.keys(locales.en).sort(), Object.keys(locales.vi).sort());
  for (const q of R.QUESTIONS) {
    const need = ['title', 'hint', ...(q.available ? [] : ['reason']), ...(q.id === 'fav' ? [] : q.optionIds)];
    for (const k of need) assert.ok(locales.en[`awakening.q.${q.id}.${k}`], `${q.id}.${k}`);
    if (q.available && !q.special) assert.ok(locales.en[`awakening.q.${q.id}.evidence`], `${q.id}.evidence`);
  }
  for (const k of ['crew', 'menu', 'milk', 'water']) assert.ok(locales.vi[`awakening.q.customer.${k}`]);
  for (const k of ['aroma', 'acidity', 'sweetness', 'bitterness', 'body', 'aftertaste']) assert.ok(locales.vi[`awakening.q.fav.${k}`]);
  for (const type of R.FRAGMENT_TYPES) for (const g of ['type', 'lore', 'apply']) assert.ok(locales.vi[`awakening.${g}.${type}`] && locales.en[`awakening.${g}.${type}`]);
  for (const key of Object.values(R.KEY_OF)) assert.ok(locales.en[`awakening.key.${key}`]);
  for (const l of Object.entries(locales.en).filter(([k]) => k.startsWith('awakening.lore.') && !['flag', 'label'].includes(k.slice(15)))) assert.ok(l[1].split(/[.!?]\s/).length <= 2, l[0]);
});
