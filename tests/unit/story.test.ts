import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { CONTENT } from '../../src/data/content';
import { FakeClock } from '../../src/core/Clock';
import { MemoryStorage, SaveService } from '../../src/gameplay/state/SaveService';

function incident() { const sim=new GameSimulation(structuredClone(CONTENT.maps.incident!),CONTENT,{clock:new FakeClock(),rngSeed:7}); sim.startRun(); return sim; }
/** Ticks until chapter 1 is over (the player just stands there: the hazards come). */
function dieIdle(sim:GameSimulation) { for(let i=0;i<6000&&sim.story.chapterId==='S03';i++) sim.tick(50); }

describe('incident survival run',()=>{
  it('starts at once with no dialogue to click through, and the hero is steered directly',()=>{
    const sim=incident(); const start={...sim.player.pos};
    expect(sim.story.view().dialog).toBeNull();
    expect(sim.story.view().run?.running).toBe(true);
    sim.steer(1,0); sim.tick(500);
    expect(sim.player.pos.x).toBeGreaterThan(start.x+1);
    sim.steer(0,0);
  });
  it('never walks through walls when steered into them',()=>{
    const sim=incident();
    sim.steer(-1,0); for(let i=0;i<20;i++) sim.tick(50);
    expect(sim.world.grid.isWalkable(sim.player.tile)).toBe(true);
    expect(sim.player.pos.x).toBeGreaterThanOrEqual(1.25);
  });
  it('telegraphs hazards first; a touch holds the hero while the death plays, then goes straight on to chapter 2',()=>{
    const sim=incident();
    sim.tick(3000);
    const hz=sim.story.view().run!.hazards;
    expect(hz.length).toBeGreaterThan(0);
    expect(hz[0]!.phase).toBe('warn');
    for(let i=0;i<6000&&!sim.story.view().run?.death;i++) sim.tick(50);
    const at={...sim.player.pos};
    sim.steer(1,0); sim.clickTile({x:10,y:7}); sim.tick(300);
    expect(sim.player.pos).toEqual(at);
    expect(sim.story.view().dialog).toBeNull();
    dieIdle(sim);
    expect(sim.story.chapterId).toBe('S04');
  });
  it('reloads mid-run straight into a fresh run',()=>{
    const sim=incident(); sim.tick(1000);
    const storage=new MemoryStorage(), saves=new SaveService(storage);
    saves.save(sim.captureState(),sim.clock.now());
    const loaded=saves.load(sim.clock.now());
    if(loaded.status!=='ok') throw new Error('save failed');
    const again=new GameSimulation(structuredClone(CONTENT.maps.incident!),CONTENT,{state:loaded.state,clock:sim.clock});
    expect(again.story.view()).toMatchObject({dialog:null,run:{running:true,paused:true}});
    again.tick(2000);
    expect(again.story.view().run?.aliveMs).toBe(0);
  });
  it('street props are harmless: just a line',()=>{
    const sim=incident();
    expect(sim.story.visit('bubble_tea').ok).toBe(true);
    expect(sim.story.view().aside).toContain('trà sữa');
    expect(sim.story.canVisit('bubble_tea').ok).toBe(false);
  });
});
