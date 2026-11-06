// Headless economy simulation (scripts/economy-sim.mjs) as a regression guard for the V3 pacing in docs/design/v3-gdd.md §6.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSim } from '../../scripts/economy-sim.mjs';
import { ROUNDS, EXPIRY_LEVEL } from '../../src/core/config/economy.js';
import { apply } from '../../src/core/game.js';

const MINUTES = 70;
const sim = runSim(MINUTES);
const at = ms => (ms - sim.start) / 60000;
const events = type => sim.log.filter(([, e]) => e.type === type);

test(`economy sim: Level ${EXPIRY_LEVEL} is reached between 10 and 35 simulated minutes`, () => {
  const lvl10 = sim.log.find(([, e]) => e.type === 'levelUp' && e.to >= EXPIRY_LEVEL);
  assert.ok(lvl10, 'never reached Level 10');
  const min = at(lvl10[0]);
  assert.ok(min >= 10 && min <= 35, `Level 10 at ${min.toFixed(1)} min`);
});

test('economy sim: expiry executes once and play continues in a new region', () => {
  const triggered = events('expiryTriggered'), expired = events('regionExpired');
  assert.equal(triggered.length, 1);
  assert.equal(expired.length, 1);
  const oldRegion = expired[0][1].regionId;
  const entered = events('regionEntered').filter(([t]) => t >= expired[0][0]);
  assert.ok(entered.length >= 1, 'no region entered after the reset');
  assert.notEqual(entered[0][1].regionId, oldRegion);
  const s = sim.state;
  assert.equal(s.story.phase, 'play');
  assert.equal(s.story.level10Done, true);
  assert.equal(s.world.regions[oldRegion].status, 'expired');
  assert.notEqual(s.world.currentRegion, oldRegion);
  // Play really continued: things were served after the reset.
  const resetMinute = Math.ceil(at(expired[0][0]));
  const after = sim.perMinute.filter(r => r.minute > resetMinute);
  assert.ok(after.at(-1).served > sim.perMinute.find(r => r.minute === resetMinute).served);
});

test('economy sim: income after the reset never stalls at 0 for more than 2 consecutive minutes (no softlock)', () => {
  const resetMinute = Math.floor(at(events('regionExpired')[0][0]));
  let streak = 0, worst = 0;
  for (const row of sim.perMinute.filter(r => r.minute > resetMinute)) {
    streak = row.earnedThisMinute > 0 ? 0 : streak + 1;
    worst = Math.max(worst, streak);
  }
  assert.ok(worst <= 2, `income was 0 for ${worst} consecutive minutes after the reset`);
  // The whole run, too.
  assert.ok(sim.perMinute.length >= MINUTES - 1);
});

test(`economy sim: Round 2 is unlocked within ${MINUTES} min and its cost is charged exactly once`, () => {
  const unlocks = events('roundUnlocked').filter(([, e]) => e.round === 2);
  assert.equal(unlocks.length, 1, 'Round 2 not unlocked exactly once');
  assert.ok(at(unlocks[0][0]) <= MINUTES);
  assert.equal(unlocks[0][1].cost, ROUNDS[2].cost);
  assert.ok(sim.state.player.round >= 2);
  // Coins moved by round/unlock equal the Round costs actually unlocked (never charged twice).
  const charged = events('roundUnlocked').reduce((sum, [, e]) => sum + e.cost, 0);
  assert.equal(sim.coinDelta['round/unlock'], -charged);
  // Replaying the same transaction later is a no-op.
  const replay = apply(sim.state, { type: 'round/unlock', payload: { round: 2 }, txId: 'r2' }, { now: sim.end });
  assert.ok(replay.ok && (replay.duplicate || replay.noop));
  assert.equal(replay.state.player.coins, sim.state.player.coins);
});

test('economy sim: coins never go negative', () => {
  assert.ok(sim.minCoins >= 0, `min coins ${sim.minCoins}`);
  assert.ok(sim.perMinute.every(r => r.coins >= 0));
  assert.ok(Number.isFinite(sim.state.player.coins) && sim.state.player.coins >= 0);
});
