import { describe, expect, it } from 'vitest';
import { islandCamera } from '../../src/data/islandLayout';
import { CONTENT } from '../../src/data/content';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { createNewGameState } from '../../src/gameplay/state/GameState';
import { hasClearance } from '../../src/systems/navigation/smoothing';
import { RUN_BODY_RADIUS } from '../../src/gameplay/story/RunService';
import { worldToTile } from '../../src/utils/tile';

function game(seed = 1) {
  const state = createNewGameState({ now: 0, map: 'afterlife' });
  state.story.chapter = 'S04';
  return new GameSimulation(structuredClone(CONTENT.maps.afterlife!), CONTENT, { state, rngSeed: seed });
}
function drain(g: GameSimulation) {
  for (let n = 0; n < 50 && g.trial!.view().say; n++) {
    const v = g.trial!.view();
    if (v.choices) g.story.chooseReply(0);
    else g.story.advanceDialog();
    g.tick(16);
  }
}
function walk(g: GameSimulation, x: number, y: number) {
  g.clickTile(worldToTile({ x, y }));
  for (let n = 0; n < 1800; n++) {
    g.tick(16);
    expect(hasClearance(g.world.grid, g.player.pos, g.player.pos, RUN_BODY_RADIUS)).toBe(true);
    if (g.trial!.busy) return;
    if (g.snapshot().player.waypoints.length === 0) break;
  }
  throw new Error(`Cannot reach ${x},${y} from ${JSON.stringify(g.player.pos)}`);
}
describe('Chapter 2 island', () => {
  it.each([1, 7, 23])('walks all five stations and travels (seed %i)', (seed) => {
    const g = game(seed);
    expect(g.trial).not.toBeNull();
    drain(g);
    for (const station of CONTENT.trials.stations) {
      walk(g, station.x, station.y);
      drain(g);
      expect(g.state.story.flags[`station:${station.id}`]).toBe(true);
    }
    expect(g.trial!.view().lessons).toHaveLength(5);
    expect(g.trial!.canEnterDoor).toBe(false);
    walk(g, CONTENT.trials.gate.x, CONTENT.trials.gate.y);
    drain(g);
    expect(g.trial!.view().phase).toBe('spin');
    for (let n = 0; n < 600; n++) g.tick(16);
    expect(g.trial!.canEnterDoor).toBe(true);
    expect(g.story.chapterId).toBe('S05');
  });
  it('keeps portrait views following the hero and wide monitors in overview', () => {
    expect(islandCamera(390, 844).overview).toBe(false);
    expect(islandCamera(1024, 1366).overview).toBe(false);
    expect(islandCamera(1440, 810).overview).toBe(true);
    expect(islandCamera(2560, 720).zoom * 1774).toBeLessThan(720 * 1.16);
  });
  it('keeps an expired question available and commits only after an explicit answer', () => {
    const g = game(); drain(g);
    const st = CONTENT.trials.stations[0]!;
    walk(g, st.x, st.y);
    g.story.advanceDialog(); g.tick(16);
    expect(g.trial!.view().choices).not.toBeNull();
    const question = g.trial!.view().say!.text;
    g.tick(90000);
    expect(g.trial!.view().timeLeftMs).toBe(0);
    expect(g.trial!.view().choices).toHaveLength(3);
    expect(g.trial!.view().say!.text).toBe(question);
    g.story.advanceDialog();
    expect(g.trial!.view().choices).toHaveLength(3);
    expect(g.trial!.view().lessons).toHaveLength(0);
    drain(g);
    expect(g.trial!.view().lessons).toHaveLength(1);
    expect(g.trial!.view().karma).toBeGreaterThanOrEqual(CONTENT.trials.karma.min);
    expect(g.story.chooseReply(0).ok).toBe(false);
    g.tick(1000);
    expect(g.trial!.view().lessons).toHaveLength(1);
  });
  it('does not trigger a distant NPC or allow walking into the surrounding clouds', () => {
    const g = game(); drain(g);
    const s = CONTENT.trials.stations[0]!;
    g.player.pos.x = s.x; g.player.pos.y = s.y + 4;
    g.tick(16);
    expect(g.trial!.busy).toBe(false);
    expect(g.trial!.canMove(g.player.pos, { x: 0, y: 0 })).toBe(false);
    expect(g.trial!.canEnterDoor).toBe(false);
    const last = CONTENT.trials.stations[4]!;
    g.player.pos.x = last.x; g.player.pos.y = last.y;
    g.tick(16);
    expect(g.trial!.busy).toBe(false);
    expect(g.trial!.canMove(g.player.pos, g.player.pos)).toBe(true);
    g.player.pos.x = s.x; g.player.pos.y = s.y;
    g.tick(16);
    expect(g.trial!.busy).toBe(true);
  });
});
