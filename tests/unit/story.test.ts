import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { CONTENT } from '../../src/data/content';
import { FakeClock } from '../../src/core/Clock';
import { MemoryStorage, SaveService } from '../../src/gameplay/state/SaveService';
import { runUntil } from './helpers';

function incident() { return new GameSimulation(structuredClone(CONTENT.maps.incident!),CONTENT,{clock:new FakeClock()}); }
function begin(sim:GameSimulation) { while(sim.story.view().dialog) sim.story.advanceDialog(); }

describe('incident story interactions',()=>{
  it('waits for dialogue before moving, then physically reaches and rescues the kitten once',()=>{
    const sim=incident(); const start=sim.player.tile;
    sim.clickObject('kitten'); sim.tick(1000);
    expect(sim.player.tile).toEqual(start);
    expect(sim.story.view().timeLeftSec).toBe(45);
    begin(sim);
    sim.clickObject('kitten');
    expect(runUntil(sim,()=>!!sim.state.story.flags.rescued)).toBe(true);
    expect(sim.player.tile).not.toEqual(start);
    const cat=sim.world.getObject('kitten')!;
    expect(sim.nav.isWithinReach(sim.player.tile,{footprint:cat.footprint,radius:1})).toBe(true);
    expect(sim.story.rescue().ok).toBe(false);
    expect(sim.story.view().dialog).not.toBeNull();
    begin(sim); sim.tick(1001);
    expect(sim.story.chapterId).toBe('S04');
  });
  it('retries from the checkpoint without losing inventory or opening an invisible dialog',()=>{
    const sim=incident(); begin(sim);
    const items=structuredClone(sim.state.economy.inventory);
    sim.clickTile({x:4,y:7}); sim.tick(1000);
    sim.tick(CONTENT.story.chapters.S03!.timeLimitMs!);
    expect(sim.player.tile).toEqual(sim.map.playerStart);
    expect(sim.state.economy.inventory).toEqual(items);
    expect(sim.story.view().locked).toBe(false);
    expect(sim.story.view().timeLeftSec).toBeGreaterThan(43);
    sim.clickObject('kitten');
    expect(runUntil(sim,()=>!!sim.state.story.flags.rescued)).toBe(true);
  });
  it('restores the rescue outro after saving so the chapter cannot get stuck',()=>{
    const sim=incident(); begin(sim); sim.clickObject('kitten');
    expect(runUntil(sim,()=>!!sim.state.story.flags.rescued)).toBe(true);
    const again=new GameSimulation(structuredClone(CONTENT.maps.incident!),CONTENT,{state:structuredClone(sim.captureState()),clock:sim.clock});
    expect(again.story.view().dialog).not.toBeNull();
    begin(again);
    expect(again.story.chapterId).toBe('S04');
  });
  it('reloads an introduced chapter with the rescue still reachable',()=>{
    const sim=incident(); begin(sim);
    const storage=new MemoryStorage(), saves=new SaveService(storage);
    saves.save(sim.captureState(),sim.clock.now());
    const loaded=saves.load(sim.clock.now());
    if(loaded.status!=='ok') throw new Error('save failed');
    const again=new GameSimulation(structuredClone(CONTENT.maps.incident!),CONTENT,{state:loaded.state,clock:sim.clock});
    expect(again.story.view().dialog).toBeNull();
    again.clickObject('kitten');
    expect(runUntil(again,()=>!!again.state.story.flags.rescued)).toBe(true);
  });
});
