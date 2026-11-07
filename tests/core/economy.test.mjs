// Headless economy simulation (scripts/economy-sim.mjs) as a regression guard for the V3 pacing in docs/design/v3-gdd.md §6.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSim } from '../../scripts/economy-sim.mjs';
import { EXPIRY_LEVEL } from '../../src/core/config/economy.js';
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


test('economy sim: coins never go negative', () => {
  assert.ok(sim.minCoins >= 0, `min coins ${sim.minCoins}`);
  assert.ok(sim.perMinute.every(r => r.coins >= 0));
  assert.ok(Number.isFinite(sim.state.player.coins) && sim.state.player.coins >= 0);
});

// ---- Farm World 2.0: the approved one-game-per-region play, farm only (FARM-ECONOMY-BALANCE.md §5) ----
const FARM_MIN = 45;
const farm = runSim(FARM_MIN, { game: 'farm' });
const raw = runSim(FARM_MIN, { game: 'farm', process: false });
const lvl10At = r => { const e = r.log.find(([, ev]) => ev.type === 'levelUp' && ev.to >= EXPIRY_LEVEL); return e ? (e[0] - r.start) / 60000 : Infinity; };
const perMin = (r, from, to) => { const a = r.perMinute.find(x => x.minute === from), b = r.perMinute.find(x => x.minute === to); return (b.earned - a.earned) / (to - from); };

test('economy sim (farm only): Level 10 between 10 and 35 minutes, with and without processing', () => {
  for (const r of [farm, raw]) { const m = lvl10At(r); assert.ok(m >= 10 && m <= 35, `Level 10 at ${m.toFixed(1)} min (process=${r.process})`); }
});

test('economy sim (farm only): the production chain is built and pays more per minute once it runs', () => {
  for (const t of ['dryer', 'roastery']) assert.ok(farm.log.some(([, e]) => e.type === 'built' && e.building === t), `${t} never built`);
  assert.ok((farm.state.stats.produced || 0) > 50, `only ${farm.state.stats.produced} batches`);
  assert.ok(farm.income.dried > 0 && farm.income.roasted > 0, JSON.stringify(farm.income));
  // Second region, chain rebuilt: income per minute beats selling every bean raw.
  const a = perMin(farm, 35, FARM_MIN), b = perMin(raw, 35, FARM_MIN);
  assert.ok(a > b * 1.05, `with processing ${a.toFixed(0)}/min vs raw ${b.toFixed(0)}/min`);
});

test('economy sim (farm only): coins never negative, no café actions, no stall after the reset', () => {
  for (const r of [farm, raw]) {
    assert.ok(r.minCoins >= 0);
    assert.ok(!Object.keys(r.counts).some(t => t.startsWith('shop/')), 'a farm region ran café actions');
    let streak = 0, worst = 0;
    for (const row of r.perMinute) { streak = row.earnedThisMinute > 0 ? 0 : streak + 1; worst = Math.max(worst, streak); }
    assert.ok(worst <= 2, `income 0 for ${worst} minutes`);
  }
});
