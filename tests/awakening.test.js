import test from 'node:test';
import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const R = await import('../src/features/awakening/rules.js');
const { createFarm } = await import('../src/features/farm/model.js');
const M = await import('../src/state/memory.js');
const { saveFarm } = await import('../src/state/progress.js');
M.env.readOnly = () => false;

// ---------- fake data ----------
const ctx = (o = {}) => ({ workDayMs: 360000, harvests: [], batches: [], floorDays: [], shifts: [], plots: [], mastery: {}, entries: () => [], ...o });
const hv = (id, o) => ({ id, at: 1, day: 1, cropId: 'robusta', by: 'player', grams: 100, quality: 80, fertilized: false, pruned: false, value: 1, ...o });
const sh = (id, o) => ({ id, at: 1, cups: 5, revenue: 100, costs: 20, wages: 10, beans: 0, left: 0, avgWait: 5, tier: 1, meanPrice: 1, crew: 1, menu: 3, milk: 'milk-dalat', water: 'tap', staffN: 0, tiredN: 0, staffStars: 0, staffSecs: 0, ...o });
const bt = (id, o) => ({ id, machine: 'roaster', at: 1, day: 1, cropId: 'robusta', quality: 80, delayMs: 0, ...o });
const en = (id, o = {}) => ({ id, kind: 'game', recipeId: 'v60', method: 'v60', createdAt: 1, taste: { liking: 3, acidity: 3 }, simulated: { score: 80 }, actual: {}, insight: {}, memory: '', ...o });
const q = id => R.questionById(id);
const detect = (id, c) => q(id).detect(c);

// ---------- helpers for the farm model ----------
const T0 = Date.now(), fresh = () => createFarm(null, 'capital', () => {}, T0);
const withAwakening = patch => { const s = fresh().progress; patch(s.awakening, s); return createFarm(s, null, () => {}, T0); };
const capture = farm => { const log = []; farm.onEvent((type, props) => log.push([type, props])); return log; };
const spin = () => { const t = Date.now(); while (Date.now() === t); }; // entries use the real clock; guarantee a later createdAt
const reset = () => { store.clear(); M.env.readOnly = () => false; };
const brew = (recipeId, actual, taste = { liking: 3, acidity: 3 }) => { const e = M.addGameDraft({ recipeId, simulated: { score: 80, quality: 80, stars: 2, modelVersion: 1 }, actual }); M.updateEntry(e.id, { taste }); return e.id; };
const V = (o = {}) => ({ grind: 2, tempC: 92, doseG: 15, waterG: 250, ...o });

// ---------- hard rules ----------
test('empty state: every action yields nothing', () => {
  reset();
  const farm = fresh(), before = farm.progress, log = capture(farm);
  assert.ok(farm.act('awakening', 'check', null, T0).ok);
  for (const q of R.QUESTIONS) assert.equal(farm.act('awakening', 'decode', { questionId: q.id, choice: 'a' }, T0).ok, false, q.id);
  assert.equal(farm.act('awakening', 'hypothesis', { variable: 'grind', direction: 'up', attribute: 'acidity' }, T0).ok, false);
  assert.equal(farm.act('awakening', 'nope', null, T0).ok, false);
  const a = farm.progress.awakening;
  assert.deepEqual([a.fragments, a.messages, a.applied, a.keys], [[], [], [], []]);
  assert.ok(Object.values(a.questions).every(s => s.state === 'open'));
  assert.equal(log.filter(e => e[0] === 'discovery_saved').length, 0);
  assert.equal(farm.progress.coins, before.coins); assert.equal(farm.progress.xp, before.xp);
  // pure level too
  const A = R.emptyAwakening();
  for (const act of ['check', 'decode', 'hypothesis']) R.awaken(A, ctx({ entries: () => null }), act, { questionId: 'ripe', choice: 'a' }, 5);
  assert.deepEqual([A.fragments, A.keys], [[], []]);
});

test('migration: save without awakening gets the 6 heaven questions open and keeps everything else', () => {
  reset();
  const s = fresh().progress; s.coins = 777; s.seeds.robusta = 9; delete s.awakening; delete s.cafe.shiftLog; delete s.cafe.paid;
  const farm = createFarm(s, null, () => {}, T0), p = farm.progress;
  assert.equal(p.coins, 777); assert.equal(p.seeds.robusta, 9);
  assert.deepEqual(Object.keys(p.awakening.questions), ['ripe', 'water', 'recipe', 'adjust', 'costs', 'customer']);
  assert.ok(Object.values(p.awakening.questions).every(x => x.state === 'open'));
  assert.deepEqual(p.cafe.shiftLog, []);
  assert.equal(p.awakening.version, 1);
  // garbage never throws
  for (const junk of [null, 5, 'x', [], { questions: 3, keys: 'k', fragments: [null, { type: 'zzz' }] }]) assert.equal(R.normalizeAwakening(junk).keys.length, 0);
});

test('saveFarm mirrors awakening to the top level like victories', () => {
  reset();
  const farm = withAwakening(a => { a.messages.push('exchange'); });
  assert.ok(saveFarm(farm.progress));
  assert.deepEqual(JSON.parse(store.get('godbean-progress')).awakening.messages, ['exchange']);
});

// ---------- detection per question ----------
test('detect: Origin questions', () => {
  let d = detect('ripe', ctx({ harvests: [hv('a', { quality: 85 }), hv('b', { by: 'staff', quality: 70 })] }));
  assert.ok(d.ready); assert.deepEqual(d.facts, { a: 85, b: 70, tag: 'robusta' });
  assert.ok(R.isCorrect(q('ripe'), d.facts, 'a')); assert.ok(!R.isCorrect(q('ripe'), d.facts, 'b')); assert.ok(!R.isCorrect(q('ripe'), d.facts, 'zzz'));
  assert.ok(!detect('ripe', ctx({ harvests: [hv('a'), hv('b', { by: 'staff', day: 2 })] })).ready); // different work day
  assert.ok(!detect('ripe', ctx({ harvests: [hv('a'), hv('b', { by: 'staff', cropId: 'arabica' })] })).ready);
  d = detect('water', ctx({ plots: [{ id: 'p1', cropId: 'robusta', water: 95, ratio: .5 }, { id: 'p2', cropId: 'robusta', water: 10, ratio: .2 }] }));
  assert.ok(d.ready); assert.equal(d.facts.a, 50); assert.equal(d.facts.b, 20); assert.ok(R.isCorrect(q('water'), d.facts, 'a'));
  assert.ok(!detect('water', ctx({ plots: [{ id: 'p1', cropId: 'robusta', water: 95, ratio: .5 }] })).ready);
  d = detect('yield', ctx({ harvests: [hv('a', { fertilized: true, value: 10 }), hv('b', { pruned: true, value: 7 })] }));
  assert.ok(d.ready); assert.equal(d.facts.a, 10); assert.ok(R.isCorrect(q('yield'), d.facts, 'a'));
  assert.ok(!detect('yield', ctx({ harvests: [hv('a', { fertilized: true, pruned: true }), hv('b', { pruned: true })] })).ready); // both-care field is not "only"
});

test('detect: Extraction recipe question needs two same-recipe tasted cups with the same settings', () => {
  const a = en('a', { actual: V(), simulated: { score: 80 } }), b = en('b', { actual: V({ doseG: 15.4 }), simulated: { score: 82 } });
  const d = detect('recipe', ctx({ entries: () => [a, b] }));
  assert.ok(d.ready); assert.equal(d.facts.a, 80); assert.ok(R.isCorrect(q('recipe'), d.facts, 'same'));
  assert.ok(!detect('recipe', ctx({ entries: () => [a, en('c', { actual: V({ grind: 3 }) })] })).ready);
  assert.ok(!detect('recipe', ctx({ entries: () => [a, en('c', { recipeId: 'espresso' })] })).ready);
  assert.ok(!detect('recipe', ctx({ entries: () => null })).ready);
});

test('detect: Exchange questions', () => {
  let d = detect('costs', ctx({ shifts: [sh('s1', { revenue: 200, costs: 20, wages: 100 }), sh('s2', { revenue: 100, costs: 5, wages: 5 })] }));
  assert.ok(d.ready); assert.equal(d.facts.pa, 80); assert.equal(d.facts.pb, 90); assert.ok(R.isCorrect(q('costs'), d.facts, 'wages')); assert.ok(!R.isCorrect(q('costs'), d.facts, 'beans'));
  assert.ok(!detect('costs', ctx({ shifts: [sh('s1', { revenue: 200 }), sh('s2', { revenue: 100 })] })).ready); // higher revenue also higher profit
  d = detect('floor', ctx({ floorDays: [{ id: 'day-1', at: 1, first: 1, last: .3 }] }));
  assert.ok(d.ready); assert.equal(d.facts.b, 30); assert.ok(R.isCorrect(q('floor'), d.facts, 'a'));
  d = detect('price', ctx({ shifts: [sh('s1', { meanPrice: 1.2, revenue: 150 }), sh('s2', { revenue: 100 })] }));
  assert.ok(d.ready); assert.ok(R.isCorrect(q('price'), d.facts, 'a'));
  assert.ok(!detect('price', ctx({ shifts: [sh('s1', { meanPrice: 1.05 }), sh('s2')] })).ready);
});

test('detect: Connection questions', () => {
  let d = detect('customer', ctx({ shifts: [sh('s1', { left: 3 }), sh('s2', { left: 1, crew: 2 })] }));
  assert.ok(d.ready); assert.equal(d.facts.changed, 'crew'); assert.equal(R.optionsOf(q('customer'), d.facts).length, 3);
  assert.ok(R.isCorrect(q('customer'), d.facts, 'crew')); assert.ok(!R.isCorrect(q('customer'), d.facts, 'milk'));
  assert.ok(!detect('customer', ctx({ shifts: [sh('s1', { left: 3 }), sh('s2', { left: 1, crew: 2, menu: 5 })] })).ready); // two changes
  assert.ok(!detect('customer', ctx({ shifts: [sh('s1', { left: 1 }), sh('s2', { left: 0, crew: 2 })] })).ready);
  d = detect('wait', ctx({ shifts: [sh('s1', { avgWait: 30, left: 4 }), sh('s2', { avgWait: 10, left: 1 })] }));
  assert.ok(d.ready); assert.equal(d.facts.a, 4); assert.ok(R.isCorrect(q('wait'), d.facts, 'a'));
  assert.ok(!detect('wait', ctx({ shifts: [sh('s1', { avgWait: 20 }), sh('s2', { avgWait: 10 })] })).ready); // gap < 15 s
});

test('detect: tired staff question compares staff cup stars of a rested and a tired shift', () => {
  const rested = (id, o = {}) => sh(id, { staffN: 4, tiredN: 0, staffStars: 2, staffSecs: 20, ...o }), tired = (id, o = {}) => sh(id, { staffN: 4, tiredN: 3, staffStars: 1.25, staffSecs: 27.5, ...o });
  let d = detect('tired', ctx({ shifts: [tired('t1'), rested('r1')] })); // order in the log does not matter
  assert.ok(d.ready); assert.deepEqual(d.evidence.sort(), ['r1', 't1']);
  assert.deepEqual([d.facts.a, d.facts.b, d.facts.sa, d.facts.sb, d.facts.tn], [2, 1.25, 20, 27.5, 3]);
  assert.equal(R.optionsOf(q('tired'), d.facts).length, 3);
  assert.ok(R.isCorrect(q('tired'), d.facts, 'a')); assert.ok(!R.isCorrect(q('tired'), d.facts, 'b')); assert.ok(!R.isCorrect(q('tired'), d.facts, 'same'));
  d = detect('tired', ctx({ shifts: [rested('r1'), tired('t1', { staffStars: 2 })] }));
  assert.ok(R.isCorrect(q('tired'), d.facts, 'same')); // stars equal -> the honest answer is "same"
  assert.ok(!detect('tired', ctx({ shifts: [rested('r1'), rested('r2')] })).ready); // no tired shift
  assert.ok(!detect('tired', ctx({ shifts: [tired('t1'), tired('t2')] })).ready); // no rested shift
  assert.ok(!detect('tired', ctx({ shifts: [rested('r1'), tired('t1', { tiredN: 1 })] })).ready); // 1 tired cup is not a tired shift
  assert.ok(!detect('tired', ctx({ shifts: [rested('r1', { staffN: 2 }), tired('t1')] })).ready); // too few staff cups
  assert.ok(!detect('tired', ctx({ shifts: [sh('x1'), sh('x2')] })).ready); // old log rows (no staff data)
  assert.ok(q('tired').available);
});

test('detect: Transformation questions', () => {
  let d = detect('roast-quality', ctx({ batches: [bt('b1', { quality: 90 }), bt('b2', { quality: 70 })] }));
  assert.ok(d.ready); assert.equal(d.facts.a, 90); assert.ok(R.isCorrect(q('roast-quality'), d.facts, 'a'));
  assert.ok(!detect('roast-quality', ctx({ batches: [bt('b1', { quality: 85 }), bt('b2', { quality: 80 })] })).ready); // gap < 10
  d = detect('dry-wait', ctx({ batches: [bt('d1', { machine: 'dryer' }), bt('d2', { machine: 'dryer', delayMs: 400000 })] }));
  assert.ok(d.ready); assert.ok(R.isCorrect(q('dry-wait'), d.facts, 'same'));
  assert.ok(!detect('dry-wait', ctx({ batches: [bt('d1', { machine: 'dryer' }), bt('d2', { machine: 'dryer', delayMs: 60000 })] })).ready);
  d = detect('variety', ctx({ batches: [bt('b1'), bt('b2', { cropId: 'arabica', quality: 85 })] }));
  assert.ok(d.ready); assert.equal(d.facts.tag, 'arabica'); assert.ok(R.isCorrect(q('variety'), d.facts, 'b'));
});

test('detect: Reflection questions are completion-only', () => {
  const five = [1, 2, 3, 4, 5].map(i => en(`e${i}`, { taste: { liking: i, aroma: i, body: 5 - i, sweetness: 2 } }));
  let d = detect('fav', ctx({ entries: () => five }));
  assert.ok(d.ready); assert.deepEqual(d.evidence, ['e5', 'e4']); assert.equal(R.optionsOf(q('fav'), d.facts).length, 3);
  for (const o of R.optionsOf(q('fav'), d.facts)) assert.ok(R.isCorrect(q('fav'), d.facts, o.id));
  assert.ok(!R.isCorrect(q('fav'), d.facts, 'nonsense'));
  assert.ok(!detect('fav', ctx({ entries: () => five.slice(0, 4) })).ready);
  d = detect('real-vs-game', ctx({ entries: () => [en('g'), en('r', { kind: 'real', method: 'v60', recipeId: 'custom' })] }));
  assert.ok(d.ready); assert.deepEqual(d.evidence, ['r', 'g']); assert.ok(R.isCorrect(q('real-vs-game'), d.facts, 'b'));
  assert.ok(!detect('real-vs-game', ctx({ entries: () => [en('g'), en('r', { kind: 'real', method: 'phin' })] })).ready);
  const mem = ['m1', 'm2', 'm3'].map(id => en(id, { memory: 'x' }));
  d = detect('memory-text', ctx({ entries: () => mem }));
  assert.ok(d.ready); assert.deepEqual(d.evidence, ['m1', 'm2', 'm3']); assert.ok(R.isCorrect(q('memory-text'), d.facts, 'unsure'));
  assert.ok(!detect('memory-text', ctx({ entries: () => mem.slice(0, 2) })).ready);
  assert.ok(!JSON.stringify(d.facts).includes('x"'), 'memory text is never copied into facts');
});

test('unavailable questions never become ready and say why', () => {
  const none = R.QUESTIONS.filter(x => !x.available);
  assert.deepEqual(none.map(x => x.id).sort(), ['region', 'roast-age']);
  for (const x of none) { assert.ok(x.reason); assert.equal(x.detect(ctx({ harvests: [hv('a')], shifts: [sh('s')], batches: [bt('b')] })).ready, false); }
});

// ---------- decode + retry gating ----------
test('wrong answer: back to trying, new evidence required, nothing granted; right answer: fragment + 20 XP + event', () => {
  reset();
  const farm = withAwakening(a => { a.samples.harvests.push(hv('l1', { at: 5, quality: 85 }), hv('l2', { at: 5, by: 'staff', quality: 70 })); });
  const log = capture(farm), xp0 = farm.progress.xp, coins0 = farm.progress.coins;
  farm.act('awakening', 'check', null, T0 + 10);
  assert.equal(farm.progress.awakening.questions.ripe.state, 'ready');
  assert.ok(log.some(e => e[0] === 'question_ready' && e[1].id === 'ripe'));
  const wrong = farm.act('awakening', 'decode', { questionId: 'ripe', choice: 'b' }, T0 + 20);
  assert.ok(wrong.ok); assert.equal(wrong.correct, false);
  let a = farm.progress.awakening;
  assert.equal(a.questions.ripe.state, 'trying'); assert.equal(a.fragments.length, 0); assert.equal(farm.progress.xp, xp0);
  farm.act('awakening', 'check', null, T0 + 30); // same data -> still locked
  assert.equal(farm.progress.awakening.questions.ripe.state, 'trying');
  assert.equal(farm.act('awakening', 'decode', { questionId: 'ripe', choice: 'a' }, T0 + 31).ok, false);
  // new evidence (a newer pair of lots) unlocks the retry
  farm.peek().awakening.samples.harvests.push(hv('l3', { at: 40, day: 2, quality: 90 }), hv('l4', { at: 40, day: 2, by: 'staff', quality: 60 }));
  farm.act('awakening', 'check', null, T0 + 50);
  assert.equal(farm.progress.awakening.questions.ripe.state, 'ready');
  const right = farm.act('awakening', 'decode', { questionId: 'ripe', choice: 'a' }, T0 + 60);
  assert.ok(right.ok && right.correct); assert.equal(right.xp, 20);
  a = farm.progress.awakening;
  assert.equal(a.questions.ripe.state, 'solved'); assert.deepEqual(a.fragments.map(f => f.type), ['origin']);
  assert.equal(farm.progress.xp, xp0 + 20); assert.equal(farm.progress.coins, coins0);
  assert.deepEqual(log.filter(e => e[0] === 'discovery_saved').map(e => e[1]), [{ type: 'origin', what: 'fragment' }]);
});

test('3 Fragments of a type -> Message -> apply -> Key (Exchange)', () => {
  const A = R.emptyAwakening();
  const c = ctx({ shifts: [sh('s1', { revenue: 200, costs: 20, wages: 100, avgWait: 5 }), sh('s2', { revenue: 100, costs: 5, wages: 5 })], floorDays: [{ id: 'day-1', at: 1, first: 1, last: .3 }] });
  c.shifts.push(sh('s3', { meanPrice: 1.2, revenue: 150, costs: 5, wages: 5 }));
  assert.ok(R.awaken(A, c, 'check', null, 10).events.some(e => e.name === 'question_ready'));
  let ev = [];
  for (const [id, choice] of [['costs', 'wages'], ['floor', 'a'], ['price', 'a']]) {
    assert.equal(A.messages.length, 0);
    const r = R.awaken(A, c, 'decode', { questionId: id, choice }, 20); assert.ok(r.correct, id); ev.push(...r.events);
  }
  assert.deepEqual(A.messages, ['exchange']); assert.equal(A.fragments.length, 3);
  assert.ok(ev.some(e => e.props.what === 'message'));
  assert.deepEqual(A.keys, []); // understanding alone is not enough
  c.shifts.push(sh('s4', { at: 15, revenue: 100, costs: 10, wages: 5 })); // profitable, but before the Message
  R.awaken(A, c, 'check', null, 21); assert.deepEqual(A.keys, []);
  c.shifts.push(sh('s5', { at: 30, revenue: 100, costs: 10, wages: 5 })); // after the Message, profit > 0
  const r = R.awaken(A, c, 'check', null, 31);
  assert.deepEqual(A.keys.map(k => k.id), ['balance']); assert.deepEqual(A.applied, ['exchange']);
  assert.deepEqual(r.events.filter(e => e.props.what === 'key').map(e => e.props.type), ['balance']);
});

// ---------- First Sixth Key ----------
function unlockedFarm() { reset(); return withAwakening(a => { a.questions.recipe = { state: 'solved', since: 1, evidence: [] }; }); }
const fk = farm => farm.progress.awakening.firstKey;

test('First Sixth Key: locked until recipe is solved or V60 reaches 2 stars', () => {
  reset();
  const farm = fresh(); brew('v60', V());
  farm.act('awakening', 'check', null, T0 + 1);
  assert.equal(fk(farm).step, 0); assert.equal(farm.progress.awakening.questions.adjust.state, 'open');
  const s = fresh().progress; s.cafe.mastery.v60 = { best: 72, made: 1 };
  const f2 = createFarm(s, null, () => {}, T0); f2.act('awakening', 'check', null, T0 + 1);
  assert.equal(f2.progress.awakening.questions.adjust.state, 'trying'); assert.equal(fk(f2).step, 1); // the cup already tasted counts
});

test('First Sixth Key happy path -> 3 Extraction Fragments -> Message -> apply in another recipe -> Key of Curiosity', () => {
  const farm = unlockedFarm(), log = capture(farm);
  const A = brew('v60', V()); spin(); const B = brew('v60', V({ doseG: 15.4 })); // within tolerance = same
  farm.act('awakening', 'check', null, T0 + 1);
  assert.equal(fk(farm).step, 2); assert.deepEqual(fk(farm).entries, [A, B]);
  const hyp = { variable: 'grind', direction: 'up', attribute: 'acidity' };
  assert.equal(farm.act('awakening', 'hypothesis', { ...hyp, variable: 'everything' }, T0 + 2).ok, false);
  assert.equal(farm.act('awakening', 'hypothesis', hyp, T0 + 2).reason, 'noHypothesisText'); // player has not written it yet
  M.updateEntry(B, { insight: { hypothesis: 'xay min hon thi chua hon' } });
  assert.ok(farm.act('awakening', 'hypothesis', hyp, T0 + 3).ok); assert.equal(fk(farm).step, 3);
  assert.equal(farm.act('awakening', 'hypothesis', hyp, T0 + 3).ok, false); // already set
  // a cup brewed before the hypothesis cannot count as C
  spin(); const C = brew('v60', V({ grind: 3 }), { liking: 4, acidity: 5 });
  farm.act('awakening', 'check', null, T0 + 4);
  assert.equal(fk(farm).step, 4); assert.deepEqual(fk(farm).entries, [A, B, C]); assert.equal(farm.progress.awakening.questions.adjust.state, 'ready');
  // inconsistent answers do not move anything and can be retried
  for (const choice of ['false', 'insufficient', 'maybe']) { const r = farm.act('awakening', 'decode', { questionId: 'adjust', choice }, T0 + 5); assert.equal(r.ok, false, choice); }
  const bad = farm.act('awakening', 'decode', { questionId: 'adjust', choice: 'false' }, T0 + 5);
  assert.equal(bad.reason, 'inconsistent'); assert.deepEqual([bad.reminder.b, bad.reminder.c, bad.reminder.delta], [3, 5, 2]);
  assert.equal(farm.progress.awakening.fragments.length, 0);
  const xp0 = farm.progress.xp, coins0 = farm.progress.coins;
  const now = Date.now();
  const ok = farm.act('awakening', 'decode', { questionId: 'adjust', choice: 'true' }, now);
  assert.ok(ok.ok && ok.correct);
  let a = farm.progress.awakening;
  assert.deepEqual(a.fragments.map(f => f.type), ['extraction', 'extraction', 'extraction']);
  assert.deepEqual(a.messages, ['extraction']); assert.equal(fk(farm).step, 6); assert.equal(a.questions.adjust.state, 'solved');
  assert.equal(farm.progress.xp, xp0 + 20); assert.equal(farm.progress.coins, coins0);
  assert.deepEqual(a.keys, []);
  // apply: another recipe, same variable (grind) changed alone
  spin(); const X1 = brew('phin-den', V({ grind: 1 }));
  farm.act('awakening', 'check', null, now + 1); assert.deepEqual(farm.progress.awakening.keys, []);
  spin(); brew('phin-den', V({ grind: 1, waterG: 120, tempC: 70 })); // changed 2 other things, grind kept -> not "the same variable"
  farm.act('awakening', 'check', null, now + 2); assert.deepEqual(farm.progress.awakening.keys, []);
  spin(); brew('phin-den', V({ grind: 3, waterG: 120, tempC: 70 })); // only grind moved versus the previous phin cup
  farm.act('awakening', 'check', null, now + 3);
  a = farm.progress.awakening;
  assert.deepEqual(a.keys.map(k => k.id), ['curiosity']); assert.deepEqual(a.applied, ['extraction']); assert.equal(fk(farm).step, 7);
  assert.deepEqual(log.filter(e => e[0] === 'discovery_saved').map(e => e[1].what), ['fragment', 'fragment', 'fragment', 'message', 'key']);
  assert.equal(farm.progress.coins, coins0); // keys never touch the economy
  assert.ok(X1);
});

test('First Sixth Key: C that changes two variables (or none) is rejected', () => {
  const farm = unlockedFarm();
  const A = brew('v60', V()); spin(); const B = brew('v60', V());
  farm.act('awakening', 'check', null, T0 + 1);
  M.updateEntry(A, { insight: { hypothesis: 'h' } });
  assert.ok(farm.act('awakening', 'hypothesis', { variable: 'grind', direction: 'down', attribute: 'bitterness' }, T0 + 2).ok);
  spin(); const two = brew('v60', V({ grind: 3, tempC: 80 }));
  spin(); const none = brew('v60', V());
  farm.act('awakening', 'check', null, T0 + 3);
  assert.equal(fk(farm).step, 3); assert.equal(fk(farm).entries.length, 2);
  assert.deepEqual(fk(farm).rejected.map(r => [r.id, r.vars.length]), [[two, 2], [none, 0]]);
  assert.equal(farm.act('awakening', 'decode', { questionId: 'adjust', choice: 'true' }, T0 + 4).ok, false);
  spin(); const good = brew('v60', V({ grind: 1 }), { liking: 3, acidity: 3, bitterness: 2 });
  farm.act('awakening', 'check', null, T0 + 5);
  assert.equal(fk(farm).step, 4); assert.equal(fk(farm).entries[2], good); assert.deepEqual(fk(farm).rejected, []);
  assert.ok(B);
});

test('First Sixth Key: "insufficient" is the only consistent answer when the attribute did not move', () => {
  const farm = unlockedFarm();
  brew('v60', V()); spin(); const B = brew('v60', V());
  farm.act('awakening', 'check', null, T0 + 1); M.updateEntry(B, { insight: { hypothesis: 'h' } });
  farm.act('awakening', 'hypothesis', { variable: 'tempC', direction: 'up', attribute: 'acidity' }, T0 + 2);
  spin(); brew('v60', V({ tempC: 80 }), { liking: 3, acidity: 3 });
  farm.act('awakening', 'check', null, T0 + 3); assert.equal(fk(farm).step, 4);
  assert.equal(farm.act('awakening', 'decode', { questionId: 'adjust', choice: 'true' }, T0 + 4).reason, 'inconsistent');
  assert.ok(farm.act('awakening', 'decode', { questionId: 'adjust', choice: 'insufficient' }, T0 + 5).ok);
});

// ---------- victory, economy, shift log ----------
test('6 Sixth Keys -> Discovery Victory (and no coins/stock change)', () => {
  reset();
  const ALL = Object.keys(R.KEY_OF);
  const s = fresh().progress, aw = s.awakening;
  aw.messages = [...ALL]; aw.messageAt = Object.fromEntries(ALL.map(t => [t, 1]));
  aw.applied = ALL.filter(t => t !== 'exchange'); aw.keys = aw.applied.map(t => ({ id: R.KEY_OF[t], at: 2 }));
  s.cafe.shiftLog = [sh('s1', { at: 50 })];
  const farm = createFarm(s, null, () => {}, T0), log = capture(farm);
  assert.equal(farm.progress.victories.discovery, null); assert.equal(farm.progress.awakening.keys.length, 5);
  const before = farm.progress;
  farm.act('awakening', 'check', null, T0 + 1);
  const after = farm.progress;
  assert.equal(after.awakening.keys.length, 6);
  assert.ok(after.victories.discovery > 0);
  assert.deepEqual(log.filter(e => e[0] === 'victory_reached').map(e => e[1].type), ['discovery']);
  for (const k of ['coins', 'stock', 'seeds', 'fertilizer', 'prices', 'upgrades']) assert.deepEqual(after[k], before[k], k);
  assert.deepEqual(after.cafe.prices, before.cafe.prices); assert.deepEqual(after.cafe.supplies, before.cafe.supplies);
});

test('shiftLog keeps the last 10 shifts with wages since the previous shift', () => {
  reset();
  const farm = fresh(), report = (i, extra = {}) => farm.act('cafe', 'shift', { served: 4, goal: 3, avg: 2.5, lost: i % 3, revenue: 100 + i, costs: 7, avgWait: 12.5, meanPrice: 1.1, menu: 4, ...extra }, T0 + i);
  assert.ok(farm.act('cafe', 'hire', 'mai', T0).ok); // pays a first wage before shift 0
  for (let i = 0; i < 12; i++) assert.ok(report(i).ok);
  const log = farm.progress.cafe.shiftLog;
  assert.equal(log.length, 10);
  assert.deepEqual(log.map(s => s.revenue), [102, 103, 104, 105, 106, 107, 108, 109, 110, 111]);
  assert.ok(log[0].wages === 0 && log[0].costs === 7 && log[0].cups === 4 && log[0].avgWait === 12.5 && log[0].meanPrice === 1.1 && log[0].menu === 4);
  assert.ok(new Set(log.map(s => s.id)).size === 10);
  // wages are attributed to the first shift after they were paid
  const f2 = fresh(); f2.act('cafe', 'hire', 'mai', T0); f2.act('cafe', 'shift', { served: 4, goal: 3, avg: 2.5 }, T0 + 1); f2.act('cafe', 'shift', { served: 4, goal: 3, avg: 2.5 }, T0 + 2);
  const [w1, w2] = f2.progress.cafe.shiftLog; assert.ok(w1.wages > 0); assert.equal(w2.wages, 0);
  // reload keeps the log and clamps garbage
  const s = f2.progress; s.cafe.shiftLog.push('junk', { id: 5, cups: 'x', meanPrice: 99 });
  const f3 = createFarm(s, null, () => {}, T0 + 3).progress.cafe.shiftLog;
  assert.equal(f3.length, 3); assert.equal(f3[2].cups, 0);
});

test('harvest and market sales feed the Decode samples (player data only)', () => {
  reset();
  const farm = fresh(), S = () => farm.progress.awakening.samples;
  farm.peek().stock.roasted.robusta = 90000; farm.peek().lots.push({ id: 'lot-x', product: 'roasted', cropId: 'robusta', grams: 90000, quality: 80, createdAt: T0, origin: 'test' });
  const sell = (g, at) => farm.act('market', 'sell', { item: 'roasted:robusta', grams: g }, at);
  assert.ok(sell(100, T0 + 1).ok);
  assert.equal(S().market.first, S().market.last); assert.deepEqual(S().floorDays, []);
  for (let i = 0; i < 40 && !S().floorDays.length; i++) sell(1000, T0 + 2 + i);
  assert.equal(S().floorDays.length, 1);
  assert.ok(S().floorDays[0].last < S().floorDays[0].first);
  assert.ok(farm.progress.awakening.questions.floor.state === 'ready');
});

test('shiftLog stores staff cup stats (staffN, tiredN, staffStars, staffSecs), clamped; old rows read as 0', () => {
  reset();
  const farm = fresh(), report = (i, extra = {}) => farm.act('cafe', 'shift', { served: 4, goal: 3, avg: 2.5, ...extra }, T0 + i);
  assert.ok(report(1).ok); assert.ok(report(2, { staffN: 4, tiredN: 2, staffStars: 1.5, staffSecs: 30.25 }).ok); assert.ok(report(3, { staffN: 999, tiredN: -5, staffStars: 99, staffSecs: 'x' }).ok);
  const [a, b, c] = farm.progress.cafe.shiftLog;
  assert.deepEqual([a.staffN, a.tiredN, a.staffStars, a.staffSecs], [0, 0, 0, 0]);
  assert.deepEqual([b.staffN, b.tiredN, b.staffStars, b.staffSecs], [4, 2, 1.5, 30.25]);
  assert.deepEqual([c.staffN, c.tiredN, c.staffStars, c.staffSecs], [200, 0, 3, 0]);
  const old = farm.progress; delete old.cafe.shiftLog[1].staffN; delete old.cafe.shiftLog[1].staffSecs; // save written before this change
  assert.deepEqual([createFarm(old, null, () => {}, T0 + 4).progress.cafe.shiftLog[1].staffN], [0]);
});

test('tired question: reported shifts make it ready through the model, a right answer gives a Connection Fragment', () => {
  reset();
  const farm = fresh(), log = capture(farm), rep = (i, extra) => farm.act('cafe', 'shift', { served: 4, goal: 3, avg: 2.5, ...extra }, T0 + i);
  rep(1, { staffN: 5, tiredN: 0, staffStars: 2, staffSecs: 20 }); rep(2, { staffN: 5, tiredN: 3, staffStars: 1, staffSecs: 28 });
  assert.ok(farm.act('awakening', 'check', null, T0 + 3).ok);
  assert.equal(farm.progress.awakening.questions.tired.state, 'ready');
  assert.ok(log.some(e => e[0] === 'question_ready' && e[1].id === 'tired'));
  assert.equal(farm.act('awakening', 'decode', { questionId: 'tired', choice: 'a' }, T0 + 4).correct, true);
  assert.deepEqual(farm.progress.awakening.fragments.map(f => f.type), ['connection']);
});

test('a check that changes nothing does not bump workRevision or save (no 3 s re-check loop)', () => {
  reset(); let saves = 0; const farm = createFarm(null, 'capital', () => { saves++; }, T0);
  farm.act('awakening', 'check', null, T0);
  const rev = farm.peek().workRevision, s0 = saves, r = farm.act('awakening', 'check', null, T0 + 1);
  assert.equal(r.ok, true); assert.equal(farm.peek().workRevision, rev); assert.equal(saves, s0);
});
