import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { MEMORY_KEY } = await import('../src/state/storage-keys.js');
const M = await import('../src/state/memory.js');
const sim = v => ({ score: 80, quality: 80, stars: 2, modelVersion: v });
const cup = (extra = {}) => ({ recipeId: 'v60', simulated: sim(1), ...extra });
const reset = () => { store.clear(); M.env.readOnly = () => false; };

test('defaults and schema', () => {
  reset();
  assert.deepEqual(M.list(), []);
  const d = M.addGameDraft(cup());
  const raw = JSON.parse(store.get(MEMORY_KEY));
  assert.equal(raw.version, 1); assert.deepEqual(raw.setup, {}); assert.equal(raw.entries[0].id, d.id);
  assert.equal(d.kind, 'game'); assert.equal(d.schemaVersion, 1); assert.equal(M.get(d.id).simulated.modelVersion, 1);
});

test('draft cap 30 drops oldest drafts only; tasted entries survive', () => {
  reset();
  const keep = M.addGameDraft(cup()); M.updateEntry(keep.id, { taste: { aroma: 3 } });
  const first = M.addGameDraft(cup());
  for (let i = 0; i < 35; i++) M.addGameDraft(cup());
  assert.equal(M.draftCount(), 30);
  assert.equal(M.get(keep.id).taste.aroma, 3);
  assert.equal(M.get(first.id), null);
});

test('500 cap blocks new entries but never deletes', () => {
  reset();
  const entries = Array.from({ length: 500 }, (_, i) => ({ id: `e${i}`, kind: 'real', taste: { aroma: 1 }, insight: {}, createdAt: i }));
  store.set(MEMORY_KEY, JSON.stringify({ version: 1, entries, setup: {} }));
  assert.equal(M.addRealEntry({ taste: { aroma: 2 } }).reason, 'full');
  const d = M.addGameDraft(cup()); assert.ok(d); // drafts count separately
  assert.equal(M.updateEntry(d.id, { taste: { aroma: 2 } }).reason, 'full');
  assert.equal(JSON.parse(store.get(MEMORY_KEY)).entries.length, 501);
});

test('updateEntry cannot change simulated or identity', () => {
  reset();
  const d = M.addGameDraft(cup());
  const r = M.updateEntry(d.id, { simulated: sim(9), id: 'x', kind: 'real', createdAt: 1, notes: 'n'.repeat(900) });
  assert.deepEqual(r.entry.simulated, sim(1)); assert.equal(r.entry.id, d.id); assert.equal(r.entry.kind, 'game');
  assert.equal(r.entry.createdAt, d.createdAt); assert.equal(r.entry.notes.length, 500);
});

test('compare: changed vars, warnMulti, model version', () => {
  reset();
  const a = M.addRealEntry({ method: 'v60', actual: { doseG: 15, tempC: 92 }, bean: { name: 'X' } }).entry;
  const b = M.addRealEntry({ method: 'v60', actual: { doseG: 15, tempC: 92 }, bean: { name: 'x' } }).entry;
  let c = M.compare(a, b); assert.equal(c.changedVars.length, 0); assert.equal(c.warnMulti, false);
  const d = M.addRealEntry({ method: 'v60', actual: { doseG: 18, tempC: 92 } }).entry;
  c = M.compare(a, d); assert.deepEqual(c.changedVars.map(v => v.key), ['actual.doseG']); assert.equal(c.warnMulti, false); assert.equal(c.candidate, 'actual.doseG');
  const e = M.addRealEntry({ method: 'v60', actual: { doseG: 18, tempC: 85 } }).entry;
  assert.equal(M.compare(a, e).warnMulti, true);
  const g1 = M.addGameDraft(cup()), g2 = M.addGameDraft(cup({ simulated: sim(2) })), g3 = M.addGameDraft(cup());
  assert.equal(M.compare(g1, g3).sameModel, true); assert.deepEqual(M.compare(g1, g3).simulated, [80, 80]);
  assert.equal(M.compare(g1, g2).sameModel, false); assert.equal(M.compare(g1, g2).simulated, null);
});

test('events carry no private text', () => {
  reset(); const seen = []; const off = M.onMemoryEvent(e => seen.push(e));
  const r = M.addRealEntry({ taste: { aroma: 2 }, notes: 'secret' }); off();
  assert.deepEqual(seen.map(e => e.type), ['taste_submitted', 'memory_saved']);
  assert.ok(!JSON.stringify(seen).includes('secret')); assert.ok(r.ok);
});

test('read-only blocks writes; corrupt data is kept as a copy', () => {
  reset(); M.env.readOnly = () => true;
  assert.equal(M.addGameDraft(cup()), null); assert.equal(M.addRealEntry({}).reason, 'readonly'); assert.equal(store.has(MEMORY_KEY), false);
  reset(); store.set(MEMORY_KEY, '{"version":7,"entries":[]}');
  assert.deepEqual(M.list(), []); assert.equal(store.get(`${MEMORY_KEY}-corrupt`), '{"version":7,"entries":[]}');
});

test('first-save notice fires once, only after a non-draft save', () => {
  reset(); M.addGameDraft(cup()); assert.equal(M.takeFirstSaveNotice(), false);
  M.addRealEntry({ taste: { aroma: 1 } }); assert.equal(M.takeFirstSaveNotice(), true); assert.equal(M.takeFirstSaveNotice(), false);
});

test('insight completed after taste lock-in emits insight_saved once (QA 04/11)', () => {
  reset();
  const events = []; const off = M.onMemoryEvent(e => events.push(e.type));
  const d = M.addGameDraft(cup());
  M.updateEntry(d.id, { taste: { aroma: 3 } });
  M.updateEntry(d.id, { insight: { observation: 'a', hypothesis: 'b' } });
  M.updateEntry(d.id, { insight: { nextChange: 'c' } });
  M.updateEntry(d.id, { insight: { nextChange: 'd' } });
  off();
  assert.deepEqual(events.filter(t => t !== 'taste_submitted'), ['memory_saved', 'insight_saved']);
});

test('my kit: saved, trimmed, capped, junk dropped, survives a corrupt setup.kit', () => {
  reset();
  assert.equal(M.getKit(), null);
  assert.equal(M.setKit({ equipment: { grinder: '  Comandante ', kettle: 5, bogus: 'x', cup: 'y'.repeat(200) }, ingredients: { brand: 'Fellow', tds: '120' } }), true);
  assert.deepEqual(Object.keys(M.getKit().equipment).sort(), ['cup', 'grinder', 'kettle']);
  assert.equal(M.getKit().equipment.grinder, 'Comandante');
  assert.equal(M.getKit().equipment.cup.length, M.MAX_KIT_TEXT);
  assert.deepEqual(M.getKit().ingredients, { brand: 'Fellow' });
  const raw = JSON.parse(store.get(MEMORY_KEY)); raw.setup.kit = 'junk'; store.set(MEMORY_KEY, JSON.stringify(raw));
  assert.equal(M.getKit(), null);
  M.setKit({ equipment: { grinder: 'A' } }); M.setKit({}); assert.equal(M.getKit(), null);
});
