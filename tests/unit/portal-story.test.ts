import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { CONTENT } from '../../src/data/content';
import { createNewGameState } from '../../src/gameplay/state/GameState';
import { FakeClock } from '../../src/core/Clock';
import { runUntil } from './helpers';
import { stoneVisualState } from '../../src/components/presenters/StoryPresenter';
function portal() {
  const clock=new FakeClock();
  const state=createNewGameState({now:clock.now(),startingCoins:200,startingItems:{},wateringCanCapacity:4,map:'portal'});
  state.story={chapter:'S04',flags:{introDone:true}};
  return new GameSimulation(structuredClone(CONTENT.maps.portal!),CONTENT,{state,clock});
}
describe('magical portal gameplay',()=>{
  it('derives the four distinct stone states with activation taking priority',()=>{
    expect(stoneVisualState(false,false,false)).toBe('IDLE');
    expect(stoneVisualState(false,true,false)).toBe('PLAYER_NEARBY');
    expect(stoneVisualState(false,true,true)).toBe('ACTIVATING');
    expect(stoneVisualState(true,true,true)).toBe('ACTIVATED');
  });
  it('reaches all stones across the bridges, activates each once, then physically enters the portal',()=>{
    let sim=portal();
    expect(sim.story.canEnterPortal()).toMatchObject({ok:false,reason:'portalClosed'});
    for(const [i,id]of CONTENT.story.stones.entries()) {
      sim.clickObject(id);
      expect(runUntil(sim,()=>!!sim.state.story.flags[id],30000),id).toBe(true);
      expect(sim.story.activate(id)).toMatchObject({ok:false,reason:'alreadyActive'});
      expect(Object.values(sim.snapshot().story.stones).filter(Boolean)).toHaveLength(i+1);
      if(i===0)sim=new GameSimulation(structuredClone(CONTENT.maps.portal!),CONTENT,{state:structuredClone(sim.captureState()),clock:sim.clock});
    }
    expect(sim.story.chapterId).toBe('S04');
    expect(sim.story.portalOpen).toBe(true);
    const start=sim.player.tile;
    sim.clickObject('portal');
    // No outro to click through: walking up to the open door goes straight on to chapter 3.
    expect(runUntil(sim,()=>sim.story.chapterId==='S05',30000)).toBe(true);
    expect(sim.player.tile).not.toEqual(start);
    expect(sim.story.view().dialog).toBeNull();
    expect(sim.story.view().locked).toBe(true);
  });
  it('keeps the optional memory discovery as a real one-time inventory reward',()=>{
    const sim=portal();sim.clickObject('hidden_cherry');
    expect(runUntil(sim,()=>sim.story.view().cherryTaken,30000)).toBe(true);
    expect(sim.tx.count(CONTENT.story.cherryReward.itemId)).toBe(CONTENT.story.cherryReward.qty);
    expect(sim.story.pickCherry().ok).toBe(false);
  });
  it('cloud garden: catching a stone\'s three sparks wakes it, all three open the door, walking into it goes on',()=>{
    const sim=portal();
    expect(sim.garden).not.toBeNull();
    expect(sim.story.view().dialog).toBeNull();
    sim.tick(16);
    expect(sim.story.view().garden?.say).toBeTruthy();
    for(const id of CONTENT.story.stones) {
      // Stand on each spark of this stone in turn.
      for(let k=0;k<3;k++) {
        const s=sim.story.view().garden!.sparks.find((x)=>x.stone===id&&!x.caught)!;
        sim.player.pos={x:s.x,y:s.y}; sim.tick(16);
      }
      expect(sim.state.story.flags[id],id).toBe(true);
    }
    expect(sim.story.portalOpen).toBe(true);
    const door=sim.world.getObject('portal')!.footprint;
    sim.player.pos={x:door.x+1,y:door.y+2.6}; sim.tick(16);
    expect(sim.story.chapterId).toBe('S05');
  });
});

