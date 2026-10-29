import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { CONTENT } from '../../src/data/content';
import { FakeClock } from '../../src/core/Clock';
import { MemoryStorage, SaveService } from '../../src/gameplay/state/SaveService';

/** Chapter 1 started; `gags: false` keeps the street calm (for tests of talking). */
function incident(gags=true) {
  const content=structuredClone(CONTENT); if(!gags) content.story.chapters.S03!.run!.unlockSec={};
  const sim=new GameSimulation(structuredClone(CONTENT.maps.incident!),content,{clock:new FakeClock(),rngSeed:7}); sim.startRun(); return sim;
}
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
  it('is one stroll with the gags in it: the whole street open, a calm few seconds, then the first gag',()=>{
    const sim=incident(); sim.steer(1,0); sim.tick(50);
    expect(sim.story.view().run).toMatchObject({phase:'chaos',fenceX:null});
    expect(sim.story.view().street!.gates.map((g)=>g.id)).toEqual(['west','east']);
    expect(sim.world.grid.isWalkable({x:34,y:12})).toBe(true);
    sim.steer(0,0);
    for(let i=0;i<90;i++) sim.tick(50);
    expect(sim.story.view().run!.hazards).toEqual([]);
    for(let i=0;i<120&&!sim.story.view().run!.hazards.length;i++) sim.tick(50);
    expect(sim.story.view().run!.hazards.length).toBeGreaterThan(0);
  });
  it('telegraphs gags first; one touch knocks the hero out, they lie down with a last line, then chapter 2',()=>{
    const sim=incident(); sim.steer(1,0); sim.tick(50); sim.steer(0,0);
    // The first gag comes after a calm few seconds, and only as a warning.
    for(let i=0;i<200&&!sim.story.view().run!.hazards.length;i++) sim.tick(50);
    const hz=sim.story.view().run!.hazards;
    expect(hz.length).toBeGreaterThan(0);
    expect(hz[0]!.phase).toBe('warn');
    for(let i=0;i<6000&&!sim.story.view().run?.hit;i++) sim.tick(50);
    expect(sim.story.view().run?.phase).toBe('faint');
    const at={...sim.player.pos};
    sim.steer(1,0); sim.clickTile({x:10,y:7}); sim.tick(300);
    expect(sim.player.pos).toEqual(at);
    for(let i=0;i<200&&!sim.story.view().run?.down;i++) sim.tick(50);
    expect(sim.story.view().run?.say).toBeTruthy();
    dieIdle(sim);
    expect(sim.story.chapterId).toBe('S04');
  });
  it('once down, the crowd gathers, the ambulance carries the hero off into a magic circle, then chapter 2',()=>{
    const sim=incident(); sim.steer(1,0); sim.tick(50); sim.steer(0,0);
    sim.player.pos={x:14,y:9.5};
    sim.run!.crash('motorbike','Ối…',2000);
    let carried=false, hidden=false, portal=false, bonk=false;
    for(let i=0;i<600&&sim.story.chapterId==='S03';i++){
      sim.tick(50);
      const st=sim.story.view().street;
      carried||=!!st?.carried; hidden||=!!st?.heroHidden; portal||=!!st?.portal; bonk||=!!st?.bonk;
    }
    expect([carried,bonk,hidden,portal]).toEqual([true,true,true,true]);
    expect(sim.story.chapterId).toBe('S04');
  });
  it('does not force a knock-out after the former survival time limit',()=>{
    const sim=incident(false); sim.steer(1,0); sim.tick(50); sim.steer(0,0);
    sim.player.pos={x:22.5,y:7.5};
    for(let i=0;i<2600;i++) sim.tick(50);
    expect(sim.story.chapterId).toBe('S03');
    expect(sim.story.view().run).toMatchObject({running:true,phase:'chaos',hit:null,down:null});
    expect(sim.story.view().run!.aliveMs).toBeGreaterThan(120_000);
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
  it('a stall talks on its own when the hero walks up, waits for a reply, then counts as visited',()=>{
    const sim=incident(false); sim.steer(1,0); sim.tick(50); sim.steer(0,0);
    sim.player.pos={x:3,y:6.6};
    sim.tick(50);
    expect(sim.story.view().street?.talking).toBe('tra_da');
    for(let i=0;i<400&&!sim.story.view().street?.choices;i++) sim.tick(50);
    expect(sim.story.view().street?.choices).toHaveLength(2);
    expect(sim.story.chooseReply(0).ok).toBe(true);
    expect(sim.story.view().street?.heroSay).toBe('Cho cháu cốc trà đá');
    for(let i=0;i<400&&sim.story.view().street?.talking;i++) sim.tick(50);
    expect(sim.story.canVisit('tra_da').ok).toBe(false);
    expect(sim.story.view().stalls.find((s)=>s.id==='tra_da')?.visited).toBe(true);
  });
  it('walking away cuts a talk short: it is not counted and plays again next time',()=>{
    const sim=incident(false); sim.steer(1,0); sim.tick(50); sim.steer(0,0);
    sim.player.pos={x:3,y:6.6}; sim.tick(50);
    expect(sim.story.view().street?.talking).toBe('tra_da');
    sim.player.pos={x:3,y:12}; sim.tick(50);
    expect(sim.story.view().street?.talking).toBeNull();
    expect(sim.story.canVisit('tra_da').ok).toBe(true);
  });
});
