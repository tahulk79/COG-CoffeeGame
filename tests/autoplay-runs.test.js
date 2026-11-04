// Auto 3 suất x 10 phút (audit 04/11, QA-6; crew-autoplay.md mục 5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarm } from '../src/features/farm/model.js';
import { AUTOPLAY } from '../src/features/farm/rules.js';
const AT = 100000, fresh = () => createFarm(null, 'capital', () => {}, AT);
const load = autoplay => { const s = fresh().progress; s.autoplay = autoplay; return createFarm(s, null, () => {}, AT).progress.autoplay; };

test('AUTOPLAY is 3 runs of 10 minutes', () => assert.deepEqual(AUTOPLAY, { runs: 3, runMs: 600000 }));
test('start spends a run and loads leftMs; spend drains; restarting mid-run is free; out of runs fails', () => {
  const farm = fresh(), a = farm.progress.autoplay;
  assert.deepEqual({ ...a }, { runs: 3, leftMs: 0 });
  assert.equal(farm.act('autoplay', 'start', null, AT).ok, true);
  assert.deepEqual({ ...farm.progress.autoplay }, { runs: 2, leftMs: 600000 });
  farm.act('autoplay', 'spend', 15000, AT); assert.equal(farm.progress.autoplay.leftMs, 585000);
  farm.act('autoplay', 'spend', 1e9, AT); assert.equal(farm.progress.autoplay.leftMs, 585000 - 60000, 'one spend is capped at 60 s');
  assert.equal(farm.act('autoplay', 'start', null, AT).ok, true); assert.equal(farm.progress.autoplay.runs, 2, 'time left: no new run');
  for (let i = 0; i < 10; i++) farm.act('autoplay', 'spend', 60000, AT);
  assert.equal(farm.progress.autoplay.leftMs, 0);
  for (const runs of [1, 0]) { assert.equal(farm.act('autoplay', 'start', null, AT).ok, true); assert.equal(farm.progress.autoplay.runs, runs); farm.peek().autoplay.leftMs = 0; }
  farm.peek().autoplay.runs = 0;
  assert.equal(farm.act('autoplay', 'start', null, AT).ok, false);
  assert.equal(farm.act('autoplay', 'bogus', null, AT).ok, false);
});
test('loading a save clamps runs and leftMs', () => {
  assert.deepEqual({ ...load({ runs: 99, leftMs: 9e9 }) }, { runs: 3, leftMs: 600000 });
  assert.deepEqual({ ...load({ runs: -5, leftMs: -1 }) }, { runs: 0, leftMs: 0 });
  assert.deepEqual({ ...load({ runs: 1.9, leftMs: 'x' }) }, { runs: 1, leftMs: 0 });
  assert.equal(load(undefined).runs, 3);
});
