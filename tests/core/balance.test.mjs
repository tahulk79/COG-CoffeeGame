// Balance rules of 2026-11-09: priced extra beds, half-price stamina, the Level-10 incident back on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../../src/core/game.js';
import { createSave } from '../../src/core/state.js';
import * as D from '../../src/core/derive.js';
import { FIELD, fieldExtraCost, statCostOf, SKILL, EXPIRY_ENABLED, EXPIRY_LEVEL, xpForLevel } from '../../src/core/config/economy.js';
import { PARCELS, areaOfParcel } from '../../src/core/config/layout.js';

const T0 = 1_800_000_000_000;
function farm() {
  const g = { now: T0, s: createSave(T0, { gender: 'female', name: 'T' }) };
  g.act = (type, payload = {}) => { const r = apply(g.s, { type, payload }, { now: g.now, dev: true }); if (r.ok && !r.noop) g.s = r.state; return r; };
  g.act('story/introDone'); g.act('story/teacherDone');
  g.act('world/unlockRegion', { regionId: 'vn-1' }); g.act('world/enterRegion', { regionId: 'vn-1' }); g.act('play/chooseGame', { game: 'farm' });
  g.place = () => {
    for (const id of D.region(g.s).parcels) {
      if (areaOfParcel(id) !== 'farm') continue;
      const [x0, z0, x1, z1] = PARCELS[id].rect;
      for (let z = z0; z <= z1; z += .5) for (let x = x0; x <= x1; x += .5) { const q = D.snapPosition('field', x, z, 0); if (D.placementError(g.s, 'field', q.x, q.z, 0) === null) return g.act('build/place', { type: 'field', ...q }); }
    }
    return { ok: false, error: 'noSpot' };
  };
  return g;
}

test('fields: the tilled rows are free, a bed beyond them costs the escalating clearing price', () => {
  const g = farm();
  g.s.player.coins = 100_000;
  const free = D.fieldAllowance(g.s);
  for (let i = 0; i < free; i++) { assert.equal(D.buildCost(g.s, 'field'), 0, `row ${i} free`); assert.equal(g.place().ok, true); }
  assert.equal(D.buildCost(g.s, 'field'), fieldExtraCost(0));
  const c0 = g.s.player.coins;
  assert.equal(g.place().ok, true);
  assert.equal(c0 - g.s.player.coins, fieldExtraCost(0));
  assert.equal(D.buildCost(g.s, 'field'), fieldExtraCost(1));
  assert.ok(fieldExtraCost(30) > fieldExtraCost(10) && fieldExtraCost(10) > fieldExtraCost(0), 'the price climbs');
  assert.equal(fieldExtraCost(0), FIELD.extraBase);
});

test('fields: no coins for an extra bed → coins error, nothing placed', () => {
  const g = farm();
  g.s.player.coins = 100_000;
  for (let i = D.fieldAllowance(g.s); i > 0; i--) g.place();
  g.s.player.coins = 0;
  const n = D.fieldsOf(g.s).length;
  assert.equal(g.place().error, 'coins');
  assert.equal(D.fieldsOf(g.s).length, n);
});

test('staff: a stamina step costs half a step of the other stats', () => {
  const u = { type: 'picker' };
  assert.equal(statCostOf(u, 1, 'stamina').coins, statCostOf(u, 1, 'speed').coins * SKILL.staminaCostMul);
  assert.equal(statCostOf(u, 2, 'stamina').coins, statCostOf(u, 2).coins * SKILL.staminaCostMul);
});

test('Level 10: the incident is on — reaching it ends the region and pauses the farm', () => {
  assert.equal(EXPIRY_ENABLED, true);
  const g = farm();
  g.s.player.xp = xpForLevel(EXPIRY_LEVEL) - 1; // one XP short: placing a bed (+XP) reaches level 10
  g.s.player.coins = 1000;
  const r = g.place();
  assert.equal(r.ok, true);
  assert.ok(r.events.some(e => e.type === 'expiryTriggered'));
  assert.equal(g.s.story.phase, 'expiry');
  assert.equal(g.act('farm/plant', { plotId: D.ownedPlots(g.s)[0].id, crop: 'robusta' }).error, 'paused');
  assert.equal(g.act('expiry/execute').ok, true);
  assert.equal(g.s.player.xp, 0, 'full restart');
});
