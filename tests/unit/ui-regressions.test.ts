import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/data/content';
import { GameSimulation } from '../../src/gameplay/GameSimulation';

describe('story presentation', () => {
  it('keeps story presentation active during chapter travel so menus cannot flash', () => {
    const sim = new GameSimulation(structuredClone(CONTENT.maps.incident!), CONTENT);
    while (sim.story.view().dialog) sim.story.advanceDialog();
    sim.story.rescue();
    while (sim.story.view().dialog) sim.story.advanceDialog();
    expect(sim.story.view()).toMatchObject({ active: true, locked: true, chapter: 'S04' });
  });
});
