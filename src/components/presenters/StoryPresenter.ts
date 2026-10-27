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
    if(story.active&&story.chapter==='S03') { this.renderer.setObjectVisual('kitten',{variant:story.rescued?'rescued':'idle',caption:story.rescued?'Mèo đã an toàn':'Chú mèo con'}); return; }
    // The teacher walks out and comes back in as the customer who orders (so there is only ever one of him).
    if(story.active&&story.chapter==='S05') { this.renderer.setObjectVisual('master',story.introDone?{variant:'away'}:{variant:'default'}); return; }
    if(!story.active||story.chapter!=='S04')return;
    const names:Record<string,string>={stone_sight:'Hương thơm',stone_hearing:'Vị giác',stone_touch:'Cảm xúc'};
    for(const id of this.stoneIds){
      const o=this.world.getObject(id);if(!o)continue;
      const near=Math.hypot(s.player.pos.x-o.footprint.x-.5,s.player.pos.y-o.footprint.y-.5)<3;
      const current=s.interaction.current;
      const work=current?.objectId===id&&current.phase==='work';
      const state=stoneVisualState(!!story.stones[id],near,work);
      this.renderer.setObjectVisual(id,{variant:state,caption:`${names[id]}${story.stones[id]?' ✓':work?' · Đang kích hoạt…':''}`,progress:work?current!.progress:null});
    }
    this.renderer.setObjectVisual('portal',{variant:story.portalOpen?'open':'closed',caption:story.portalOpen?'Cổng đã mở · Chạm để bước vào':'Cánh cổng · Cần 3 viên đá'});
    this.renderer.setObjectVisual('hidden_cherry',{variant:story.cherryTaken?'taken':'idle',caption:story.cherryTaken?'Ký ức đã tìm thấy':'Quả cà phê ký ức'});
  }
}
