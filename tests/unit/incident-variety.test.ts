import { expect, it } from 'vitest';
import { CONTENT } from '../../src/data/content';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { FakeClock } from '../../src/core/Clock';
import type { GameState } from '../../src/gameplay/state/GameState';
import type { HazardKind } from '../../src/gameplay/story/RunService';

function replay(seed: number, state?: GameState) {
  if (state) state.story = { chapter: 'S03', flags: {} };
  const sim = new GameSimulation(structuredClone(CONTENT.maps.incident!), CONTENT, { clock: new FakeClock(), rngSeed: seed, state });
  sim.startRun();
  sim.player.pos = { x: 22.5, y: 6.5 };
  return sim;
}

it('all 11 primary gags are eligible early and saved exposure favours unseen gags on replay', () => {
  const kinds = Object.keys(CONTENT.story.chapters.S03!.run!.unlockSec) as HazardKind[];
  let state: GameState | undefined;
  const shown = new Set<string>();
  for (let round = 1; round <= 40; round++) {
    const sim = replay(round, state), run = sim.run!;
    const kind = run['deal']();
    expect(kind).not.toBeNull();
    const counts = kinds.map(k => sim.state.counters[`incident:seen:${k}`] ?? 0);
    expect(sim.state.counters[`incident:seen:${kind}`] ?? 0).toBe(Math.min(...counts));
    run['add'](kind!);
    if (run.view().hazards.some(h => h.kind === kind)) shown.add(kind!);
    state = structuredClone(sim.captureState());
    if (shown.size === kinds.length) break;
  }
  expect(shown.size).toBe(11);
});

it('dodging the delivery bike can release the twelfth gag, chickens', () => {
  const sim = replay(16), run = sim.run!;
  sim.player.pos = { x: 14, y: 11.5 };
  run['add']('motorbike', { x: 12, y: 9.5, warnMs: 1 });
  const bike = run['hazards'][0]!;
  bike.dx = 1; bike.dy = 0;
  let chickens = false;
  for (let i = 0; i < 30; i++) { run.tick(50, 4.6); chickens ||= run.view().hazards.some(h => h.kind === 'chickens'); }
  expect(chickens).toBe(true);
  expect(sim.state.counters['incident:seen:chickens']).toBe(1);
});
