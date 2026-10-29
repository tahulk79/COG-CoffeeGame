import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import type { WorldRenderer } from '../render/WorldRenderer';

export class StoryPresenter {
  constructor(private readonly renderer:Pick<WorldRenderer,'setObjectVisual'>) {}
  sync(s:SimulationSnapshot):void {
    const story=s.story;
    // Chapter 1: the stalls (their name shows near the hero; a tick once their talk was heard).
    if(story.active&&story.chapter==='S03') { for(const p of story.stalls) this.renderer.setObjectVisual(p.id,{variant:p.id,caption:`${p.name}${p.visited?' ✓':''}`}); return; }
    if(!story.active||story.chapter!=='S04')return;
    // Chapter 2 (road of rebirth): the door at the end opens once the door keeper has had her say.
    this.renderer.setObjectVisual('portal',{variant:story.portalOpen?'open':'closed',caption:story.portalOpen?'Cánh cửa trùng sinh · Đã mở':'Cánh cửa trùng sinh'});
  }
}
