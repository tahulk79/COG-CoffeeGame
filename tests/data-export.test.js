import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { PROGRESS_KEY, PLAYER_KEY, MEMORY_KEY } = await import('../src/state/storage-keys.js');
const P = await import('../src/state/progress.js');

test('export payload shape and file name', () => {
  store.clear();
  P.saveFarm({ coins: 5 }); P.savePlayer({ gender: 'male', name: 'A' });
  store.set(MEMORY_KEY, '{"version":1,"entries":[]}');
  const now = new Date('2026-11-04T10:00:00Z'), e = P.buildExport(now);
  assert.equal(e.format, 'godbean-export'); assert.equal(e.version, 1);
  assert.equal(e.exportedAt, now.toISOString());
  assert.equal(e.progress.farm.coins, 5); assert.equal(e.player.name, 'A'); assert.deepEqual(e.memory.entries, []);
  assert.equal(P.exportFileName(now), 'godbean-save-20261104.json');
  store.delete(MEMORY_KEY); assert.equal(P.buildExport().memory, null);
});

test('import validation rejects bad files and writes nothing', () => {
  store.clear(); store.set(PROGRESS_KEY, '{"version":1,"farm":{"coins":1}}');
  for (const bad of ['nope', '{}', '{"format":"x","version":1,"progress":{}}', '{"format":"godbean-export","version":2,"progress":{"version":1}}', '{"format":"godbean-export","version":1,"progress":[]}'])
    assert.equal(P.parseExport(bad), null);
  assert.equal(P.applyImport({ format: 'x' }), false);
  assert.equal(JSON.parse(store.get(PROGRESS_KEY)).farm.coins, 1);
});

test('valid import overwrites, keeps backup and settings', () => {
  store.clear(); store.set(PROGRESS_KEY, '{"version":1,"farm":{"coins":1},"settings":{"muted":true}}');
  const data = P.parseExport(JSON.stringify({ format: 'godbean-export', version: 1, progress: { version: 1, farm: { coins: 9 } }, player: { gender: 'female', name: 'B' }, memory: null }));
  assert.ok(P.applyImport(data));
  assert.equal(JSON.parse(store.get(PROGRESS_KEY)).farm.coins, 9);
  assert.equal(JSON.parse(store.get(PROGRESS_KEY)).settings.muted, true);
  assert.equal(JSON.parse(store.get(`${PROGRESS_KEY}-backup`)).farm.coins, 1);
  assert.equal(JSON.parse(store.get(PLAYER_KEY)).name, 'B');
});

test('deleteMemory removes only memory; reset keeps memory unless asked', () => {
  store.clear(); store.set(PROGRESS_KEY, '{"version":1}'); store.set(MEMORY_KEY, '{"version":1}');
  assert.ok(P.deleteMemory());
  assert.equal(store.has(MEMORY_KEY), false); assert.equal(store.has(PROGRESS_KEY), true);
  store.set(MEMORY_KEY, '{"version":1}');
  P.resetProgress(); assert.equal(store.has(MEMORY_KEY), true);
  P.resetProgress(true); assert.equal(store.has(MEMORY_KEY), false);
});
