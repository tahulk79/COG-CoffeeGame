import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/data/content';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { FakeClock } from '../../src/core/Clock';
import { planRescue } from '../../src/gameplay/story/rescueRouting';

function street() {
  const content = structuredClone(CONTENT);
  const ch = content.story.chapters.S03!;
  ch.run!.unlockSec = {};
  ch.street!.bikes = 0;
  ch.street!.walkers = 0;
  ch.street!.rescue!.wheelOffChance = 0;
  const sim = new GameSimulation(structuredClone(content.maps.incident!), content, { clock: new FakeClock(), rngSeed: 16 });
  sim.startRun();
  return sim;
}

describe('rescue routing', () => {
  it('finds a parking place and a walking route for every walkable tile, including the courtyard', () => {
    const sim = street(), cfg = CONTENT.story.chapters.S03!.street!;
    let checked = 0;
    for (let y = 0; y < sim.world.height; y++) for (let x = 0; x < sim.world.width; x++) {
      if (!sim.world.grid.isWalkable({ x, y })) continue;
      const hero = { x: x + 0.5, y: y + 0.5 };
      const route = planRescue(sim.world.grid, hero, cfg.bikeLanes, cfg.ambulanceAccess);
      expect(route, `no parking at ${x},${y}`).not.toBeNull();
      expect(sim.nav.planTo(route!.door, [{ x, y }]), `no walking path at ${x},${y}`).not.toBeNull();
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('uses the opposite street entrance when the preferred approach is blocked', () => {
    const sim = street(), cfg = CONTENT.story.chapters.S03!.street!;
    sim.world.grid.addBlocker({ x: 10, y: 8, w: 1, h: 3 });
    const route = planRescue(sim.world.grid, { x: 14, y: 9.5 }, cfg.bikeLanes, cfg.ambulanceAccess);
    expect(route?.dir).toBe(-1);
    expect(route!.approach[0]!.x).toBeGreaterThan(route!.park.x);
    expect(route!.park.x).toBeGreaterThan(10);
  });

  it('parks beside either barrier rather than selecting the distant alley', () => {
    const sim = street(), cfg = CONTENT.story.chapters.S03!.street!;
    for (const hero of [{ x: 1.5, y: 9.5 }, { x: 46.5, y: 9.5 }, { x: 45.8, y: 7.5 }]) {
      const route = planRescue(sim.world.grid, hero, cfg.bikeLanes, cfg.ambulanceAccess)!;
      expect(Math.hypot(route.park.x - hero.x, route.park.y - hero.y)).toBeLessThan(4);
      expect(route.park.y).toBe(route.lane);
      expect((hero.x - route.park.x) * route.dir).toBeGreaterThan(0);
    }
  });

  it('drives up the alley, reaches the courtyard corners, carries back to the van, and exits by the road', () => {
    for (const pos of [{ x: 19.2, y: 1.2 }, { x: 25.7, y: 1.2 }, { x: 21.1, y: 2.9 }, { x: 23.8, y: 4.8 }]) {
      const sim = street(); sim.player.pos = { ...pos }; sim.run!.crash('durian', 'Ối…', 2000);
      let carried = false, loaded = false, inAlley = false, bonked = false;
      for (let i = 0; i < 1200 && sim.story.chapterId === 'S03'; i++) {
        sim.tick(50);
        const view = sim.street!.view(), van = view.npcs.find(n => n.look === 'ambulance');
        inAlley ||= !!van && van.y < 5 && van.axis === 'y';
        carried ||= view.carried; loaded ||= view.heroHidden; bonked ||= !!view.bonk;
        if (view.heroHidden) expect(bonked).toBe(true);
        for (const n of view.npcs.filter(n => n.look === 'medic')) expect(sim.world.grid.isWalkable({ x: Math.floor(n.x), y: Math.floor(n.y) })).toBe(true);
      }
      expect({ carried, loaded, inAlley, bonked, chapter: sim.story.chapterId }, JSON.stringify(pos)).toEqual({ carried: true, loaded: true, inAlley: pos.y < 3.5, bonked: true, chapter: 'S04' });
    }
  });
  it('completes rescue from every walkable tile without a timed disappearance', () => {
    const template = street();
    let checked = 0;
    for (let y = 0; y < template.world.height; y++) for (let x = 0; x < template.world.width; x++) {
      if (!template.world.grid.isWalkable({ x, y })) continue;
      const sim = street(); sim.player.pos = { x: x + 0.5, y: y + 0.5 }; sim.run!.crash('durian', 'Ối…', 2000);
      let bonked = false;
      for (let i = 0; i < 1000 && sim.story.chapterId === 'S03'; i++) {
        sim.tick(50);
        const v = sim.street!.view();
        bonked ||= !!v.bonk;
        if (v.heroHidden) expect(bonked, `hidden before loading at ${x},${y}`).toBe(true);
      }
      expect(sim.story.chapterId, `stuck at ${x},${y}: ${JSON.stringify(sim.street!['rescue'])}`).toBe('S04');
      checked++;
    }
    expect(checked).toBeGreaterThan(500);
  }, 120000);

});
