import Phaser from 'phaser';
import { floorDepth, worldToScreen } from '../../utils/iso';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import type { WorldModel } from '../../gameplay/world/WorldModel';
import { H5_ASSETS, addTerrainTile } from './h5Assets';
import { STORY_ASSETS } from './storyAssets';
import { dur, MOTION } from '../../ui/theme/tokens';

export const STONE_COLORS: Record<string, number> = { stone_sight: 0xb0e579, stone_hearing: 0x80d8ff, stone_touch: 0xdba1ff };
const p=(x:number,y:number)=>worldToScreen({x,y});
const diamond=(g:Phaser.GameObjects.Graphics,x:number,y:number,color:number,inset=.04)=>{
  const a=[p(x+inset,y+inset),p(x+1-inset,y+inset),p(x+1-inset,y+1-inset),p(x+inset,y+1-inset)];
  g.fillStyle(color).fillPoints(a.map(q=>new Phaser.Math.Vector2(q.x,q.y)),true);
};
export function drawForestEnvironment(scene:Phaser.Scene):void {
  const g=scene.add.graphics().setDepth(floorDepth+.02);
  for(let y=-3;y<18;y++) for(let x=-4;x<25;x++) {
    const n=((x*41+y*73)%11+11)%11;
    if(!scene.textures.exists(H5_ASSETS.terrain.key))diamond(g,x,y,[0x24433b,0x294b3d,0x315041,0x2c493e][n%4]!,0);
    if(y===6&&x>0&&x<19) {
      const bridge=[4,5,9,10,15,16].includes(x);
      diamond(g,x,y,bridge?0x9b794f:0x2a6b73,0);
      const q=p(x+.5,y+.5);
      if(bridge)g.lineStyle(2,0x62462d,.6).lineBetween(q.x-24,q.y-12,q.x+24,q.y+12);
    } else if(x>0&&x<19&&y>0&&y<13 && (Math.abs(x-9.5)<1.6 || y>=2&&y<=4 || y>=8&&y<=9 || x>=2&&x<=4&&y<9 || x>=15&&x<=17&&y<12)) {
      if(scene.textures.exists(H5_ASSETS.terrain.key))addTerrainTile(scene,x,y,12+n%2,floorDepth+.03);
      else diamond(g,x,y,n%3===0?0x8a8c71:0x777e65,.016);
      for(let j=0;j<3;j++) { const q=p(x+.15+j*.24,y+.86); g.fillStyle(j%2?0x577d46:0x719151,.6).fillEllipse(q.x,q.y,14,6); }
      if(n%4===0) {const q=p(x+.85,y+.2);g.fillStyle(0xe7dda7).fillCircle(q.x,q.y,2).fillCircle(q.x+5,q.y+2,2);}
    }
  }
  if(scene.textures.exists(STORY_ASSETS.trees.key)) for(let y=-14;y<30;y+=3) for(let x=-17;x<36;x+=3) {
    if(x>0&&x<20&&y>0&&y<14) continue;
    const q=p(x,y); scene.add.image(q.x,q.y,STORY_ASSETS.trees.key).setOrigin(.5,.88).setDisplaySize(340,195).setDepth(x+y-.5).setTint(y<0?0x7e9fa2:0xb9c4a4);
  }
  for(const [x,y] of [[2,2],[17.8,2],[3,8],[10,5.5],[16,11.5]]) {
    const q=p(x!,y!); const glow=scene.add.graphics().setDepth(floorDepth+.5);
    glow.fillStyle(0xf6d383,.09).fillEllipse(q.x,q.y,150,70);
    const lamp=scene.add.graphics().setDepth(x!+y!);
    lamp.fillStyle(0x4b4538).fillRoundedRect(q.x-3,q.y-57,6,57,2).fillRect(q.x-11,q.y-65,22,7);
    lamp.fillStyle(0xffdfa0).fillRoundedRect(q.x-8,q.y-59,16,19,3);
  }
  if(scene.textures.exists(H5_ASSETS.extra.key)) for(const x of [4.5,9.5,15.5]) { const q=p(x,6.5); scene.add.image(q.x,q.y,H5_ASSETS.extra.key,'12').setOrigin(.5,.7).setDisplaySize(210,150).setDepth(x+5.7); }
  const ruins=scene.add.graphics().setDepth(0);
  for(let x=1;x<19;x+=2){const q=p(x,.4);ruins.fillStyle(0x75816d).fillRoundedRect(q.x-24,q.y-35,48,35,5).fillStyle(0x4d724c,.8).fillEllipse(q.x,q.y-34,45,9);}
}

export class ForestEffects {
  private readonly light:Phaser.GameObjects.Graphics;
  private readonly magic:Phaser.GameObjects.Graphics;
  private lastCount=-1;
  private openedAt=-10000;
  constructor(private readonly scene:Phaser.Scene,private readonly world:WorldModel) {
    this.light=scene.add.graphics().setDepth(floorDepth+.6);
    this.magic=scene.add.graphics().setDepth(100000);
  }
  sync(s:SimulationSnapshot):void {
    const count=Object.values(s.story.stones).filter(Boolean).length;
    const moving=dur(MOTION.slow)>0, time=moving?this.scene.time.now*.001:0;
    if(this.lastCount>=0&&count>this.lastCount) {
      if(count===3) this.openedAt=this.scene.time.now;
      this.chime(count);
    }
    this.lastCount=count;
    const ground=this.light.clear(),g=this.magic.clear();
    for(const[id,color]of Object.entries(STONE_COLORS)) {
      const o=this.world.getObject(id); if(!o)continue;
      const q=p(o.footprint.x+.5,o.footprint.y+.5), active=s.story.stones[id];
      const near=Math.hypot(s.player.pos.x-o.footprint.x-.5,s.player.pos.y-o.footprint.y-.5)<3;
      const work=s.interaction.current?.objectId===id;
      const a=active ? .32 : near || work ? .23 : .1;
      ground.fillStyle(color,a).fillEllipse(q.x,q.y,110,48);
      g.lineStyle(active?3:1,color,active ? .8 : .25).strokeEllipse(q.x,q.y,92,40);
      for(let i=0;i<(moving?8:3);i++) {
        const angle=time*.65+i*Math.PI/4, r=active?44:28;
        g.fillStyle(color,active ? .8 : .35).fillCircle(q.x+Math.cos(angle)*r,q.y-35-Math.sin(angle)*13-((time*12+i*9)%65),active?2:1.5);
      }
    }
    const portal=this.world.getObject('portal')!;
    const q=p(portal.footprint.x+1,portal.footprint.y+1), open=s.story.portalOpen;
    ground.fillStyle(0xffd77b,open ? .2 : .04).fillEllipse(q.x,q.y,250,100);
    g.fillStyle(open?0xdb9d42:0x3a6874,open ? .16 : .12).fillEllipse(q.x,q.y-147,105,140);
    for(let k=0;k<(moving?4:2);k++) {
      g.lineStyle(open?3:1,open?0xffdc8b:0x7999a2,open ? .65 : .3);
      g.beginPath();
      for(let i=0;i<=50;i++){const t=i/50*Math.PI*4+time*(open?1:.25)+k*1.4;const r=(i/50)*49;const x=q.x+Math.cos(t)*r,y=q.y-147+Math.sin(t)*r*1.25;if(i===0)g.moveTo(x,y);else g.lineTo(x,y);}
      g.strokePath();
    }
    const wave=(this.scene.time.now-this.openedAt)/1400;
    if(moving&&wave>=0&&wave<1)g.lineStyle(5,0xffdf9b,1-wave).strokeEllipse(q.x,q.y,80+wave*450,40+wave*200);
    if(moving) {
      const view=this.scene.cameras.main.worldView;
      for(let i=0;i<24;i++){const x=view.x+((i*171+time*8)%view.width),y=view.y+((i*89+Math.sin(time+i)*9)%view.height);g.fillStyle(i%3?0xe9d48b:0x8fdbe3,.35).fillEllipse(x,y,3,5);}
    }
    // Water uses a fixed set of strokes and ripples; never allocates particle objects.
    const river=sceneRiver(this.world);
    for(const tile of river) {
      const v=p(tile.x+.5,tile.y+.5);
      for(let i=0;i<3;i++)g.lineStyle(1,0x8ed3d3,.23).lineBetween(v.x-30+i*17+Math.sin(time*2+i)*4,v.y+i*3,v.x-15+i*17,v.y+i*3-3);
    }
    for(const x of [0,19]){const v=p(x,6.5);for(let i=0;i<5;i++){const drop=(time*30+i*13)%52;g.lineStyle(2,0x9ce0d9,.35).lineBetween(v.x+i*4,v.y+drop,v.x+i*4,v.y+drop+13);}}
  }
  private chime(count:number):void {
    const sound=this.scene.sound;
    if(!(sound instanceof Phaser.Sound.WebAudioSoundManager)||sound.mute)return;
    const ctx=sound.context,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';osc.frequency.value=[440,587,784,1046][count]!;
    gain.gain.setValueAtTime(.025,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.5);
    osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.5);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
}
const sceneRiver=(world:WorldModel)=>Array.from({length:18},(_,i)=>({x:i+1,y:6})).filter(t=>world.terrainKind(t)==='stream');
