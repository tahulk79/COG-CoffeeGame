import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { PROGRESS_KEY: KEY } = await import('../src/state/storage-keys.js');
const P = await import('../src/state/progress.js');

test('fresh save round-trips and creates no -corrupt', () => {
  store.clear();
  assert.deepEqual(P.readProgress(), {});
  P.saveRegion('r1');
  assert.equal(P.readProgress().startingRegion, 'r1');
  assert.equal(store.has(`${KEY}-corrupt`), false);
});

for (const [name, raw] of [['version mismatch', '{"version":2,"farm":{"coins":5}}'], ['broken JSON', '{"version":1,']]) {
  test(`${name}: raw kept in -corrupt, saveRegion does not lose it, second corrupt does not overwrite`, () => {
    store.clear(); store.set(KEY, raw);
    P.saveRegion('r2');
    assert.equal(store.get(`${KEY}-corrupt`), raw);
    assert.equal(P.readProgress().startingRegion, 'r2');
    store.set(KEY, 'garbage'); P.readProgress();
    assert.equal(store.get(`${KEY}-corrupt`), raw);
  });
}

test('huge coins survive saveFarm/readProgress', () => {
  store.clear();
  P.saveFarm({ coins: 9999999999999 });
  assert.equal(P.readProgress().farm.coins, 9999999999999);
});

// resetProgress locks further saves for the module lifetime, so it must stay last.
test('resetProgress keeps settings and writes backup', () => {
  store.clear();
  P.saveSettings({ master: 0.3 });
  const before = store.get(KEY);
  assert.equal(P.resetProgress(), true);
  assert.equal(store.get(`${KEY}-backup`), before);
  assert.equal(JSON.parse(store.get(KEY)).settings.master, 0.3);
});

test('storage event from another tab makes saves no-ops (readOnly)', () => {
  store.clear();
  let handler, hits = 0;
  globalThis.addEventListener = (type, fn) => { if (type === 'storage') handler = fn; };
  P.watchOtherTabs(() => hits++);
  handler({ key: 'other', newValue: 'x' });
  assert.equal(P.isReadOnly(), false);
  handler({ key: KEY, newValue: '{"version":1}' }); handler({ key: KEY, newValue: '{"version":1}' });
  assert.equal(P.isReadOnly(), true); assert.equal(hits, 1);
  assert.equal(P.saveFarm({ coins: 1 }), true);
  assert.equal(store.has(KEY), false);
});
