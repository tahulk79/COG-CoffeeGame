import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/data/content';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { createNewGameState } from '../../src/gameplay/state/GameState';
import { MemoryStorage, SaveService } from '../../src/gameplay/state/SaveService';
import { createSession } from '../../src/core/session';
import { hasClearance } from '../../src/systems/navigation/smoothing';
import { RUN_BODY_RADIUS, type HazardKind } from '../../src/gameplay/story/RunService';

function game(seed = 1) {
  return new GameSimulation(structuredClone(CONTENT.maps.incident!), CONTENT, { rngSeed: seed });
}
function until(g: GameSimulation, predicate: () => boolean, maxMs = 180000) {
  for (let ms = 0; ms < maxMs && !predicate(); ms += 32) g.tick(32);
  expect(predicate(), JSON.stringify(g.snapshot().story.street)).toBe(true);
}
describe('Chapter 1 acceptance', () => {
  it('waits for input, moves with steering, and releases movement', () => {
    const g = game(), initial = { ...g.player.pos };
    g.tick(1000);
    expect(g.player.pos).toEqual(initial);
    expect(g.run!.view().hazards).toHaveLength(0);
    g.steer(1, 0); g.tick(120); g.steer(0, 0);
    expect(g.player.pos.x).toBeGreaterThan(initial.x);
    const stopped = { ...g.player.pos }; g.tick(120);
    expect(g.player.pos).toEqual(stopped);
  });
  it('keeps steering inside terrain', () => {
    const g = game(); g.run!.reviewing = true;
    g.player.pos = { x: 30.5, y: 5.5 }; g.steer(0, -1);
    for (let n = 0; n < 90; n++) {
      g.tick(16);
      expect(hasClearance(g.world.grid, g.player.pos, g.player.pos, RUN_BODY_RADIUS)).toBe(true);
    }
    expect(g.player.pos.y).toBeGreaterThanOrEqual(5.25);
  });
  it('tap paths cross the south sidewalk', () => {
    const g = game(); g.run!.reviewing = true;
    g.player.pos = { x: 24.5, y: 13.5 }; g.clickTile({ x: 22, y: 13 });
    until(g, () => Math.hypot(g.player.pos.x - 22.5, g.player.pos.y - 13.5) < .1, 12000);
  });
  it('tap paths reach the alley through walkable terrain', () => {
    const g = game(); g.run!.reviewing = true;
    g.clickTile({ x: 22, y: 2 });
    until(g, () => Math.hypot(g.player.pos.x - 22.5, g.player.pos.y - 2.5) < .1, 15000);
  });
  it.each(Object.keys(CONTENT.story.chapters.S03!.hazards!) as HazardKind[])('rescues after %s and carries the cause to chapter 2', (kind) => {
    const g = game(); let travel = 0, carried = false, hidden = false, portal = false;
    g.bus.on('world:travelRequested', () => travel++);
    g.run!.crash(kind, 'Acceptance KO', 1000);
    until(g, () => {
      const v = g.street!.view(); carried ||= v.carried; hidden ||= v.heroHidden; portal ||= !!v.portal;
      return travel > 0;
    });
    expect({ carried, hidden, portal, travel }).toEqual({ carried: true, hidden: true, portal: true, travel: 1 });
    expect(g.state.story.chapter).toBe('S04');
    expect(g.state.story.scenario).toBe(kind);
    g.prepareTravel('afterlife');
    const storage = new MemoryStorage(), saves = new SaveService(storage);
    expect(saves.save(g.state, 1000)).toBe(true);
    const resumed = createSession({ persistent: true, storage, content: CONTENT });
    expect(resumed.sim.map.id).toBe('afterlife');
    expect(resumed.sim.trial).not.toBeNull();
    expect(resumed.sim.state.story.scenario).toBe(kind);
  });
  // The alley, its mouth, the far corners and a spot whose seed once froze the van behind a standing onlooker.
  it.each([{ x: 22.5, y: 2.5 }, { x: 24.5, y: 2.5 }, { x: 20.5, y: 1.5 }, { x: 22.5, y: 4.5 }, { x: 2.5, y: 14.5 }, { x: 30.5, y: 13.5 }, { x: 45.5, y: 6.5 }])('rescue cannot deadlock at %j', (pos) => {
    for (const seed of [1, 3, 7]) {
      const g = game(seed); g.player.pos = { ...pos };
      g.run!.crash('banana', 'Acceptance KO', 1000);
      until(g, () => g.state.story.chapter === 'S04');
    }
  });
  it('a fresh replay resets chapter flags and preserves lifetime counters', () => {
    const storage = new MemoryStorage(), state = createNewGameState({ now: 0, map: 'afterlife' });
    state.story.chapter = 'S04'; state.story.flags.rescued = true; state.counters['incident:seen:banana'] = 3;
    new SaveService(storage).save(state, 0);
    const s = createSession({ persistent: true, storage, content: CONTENT, restartStory: true });
    expect(s.sim.map.id).toBe('incident'); expect(s.sim.story.chapterId).toBe('S03');
    expect(s.sim.run!.paused).toBe(true); expect(s.sim.state.counters['incident:seen:banana']).toBe(3);
    expect(s.sim.state.story.flags.rescued).not.toBe(true);
  });
});
