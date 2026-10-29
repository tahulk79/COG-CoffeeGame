import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import type { WorldModel } from '../../gameplay/world/WorldModel';
import type { WorldRenderer } from '../render/WorldRenderer';

export type StoneVisualState = 'IDLE' | 'PLAYER_NEARBY' | 'ACTIVATING' | 'ACTIVATED';
export function stoneVisualState(active:boolean,near:boolean,interacting:boolean):StoneVisualState {
  return active ? 'ACTIVATED' : interacting ? 'ACTIVATING' : near ? 'PLAYER_NEARBY' : 'IDLE';
}
export class StoryPresenter {
  constructor(private readonly renderer:Pick<WorldRenderer,'setObjectVisual'>,private readonly world:WorldModel,private readonly stoneIds:readonly string[]) {}
  sync(s:SimulationSnapshot):void {
    const story=s.story;
    // Chapter 1: the stalls (their name shows near the hero; a tick once their talk was heard).
    if(story.active&&story.chapter==='S03') { for(const p of story.stalls) this.renderer.setObjectVisual(p.id,{variant:p.id,caption:`${p.name}${p.visited?' ✓':''}`}); return; }
    if(!story.active||story.chapter!=='S04')return;
    // Chapter 2 (cloud garden): stones are dim until their sparks are caught; walking into the open door goes on.
    const names:Record<string,string>={stone_sight:'Hương thơm',stone_hearing:'Vị giác',stone_touch:'Cảm xúc'};
    for(const id of this.stoneIds){
      if(!this.world.getObject(id))continue;
      this.renderer.setObjectVisual(id,{variant:story.stones[id]?'ACTIVATED':'IDLE',caption:`${names[id]}${story.stones[id]?' ✓':''}`});
    }
    this.renderer.setObjectVisual('portal',{variant:story.portalOpen?'open':'closed',caption:story.portalOpen?'Cổng thiên đàng · Đã mở':'Cổng thiên đàng'});
    this.renderer.setObjectVisual('hidden_cherry',{variant:story.cherryTaken?'taken':'idle',caption:story.cherryTaken?'Đã nhặt':'Quả cà phê ký ức'});
  }
}
