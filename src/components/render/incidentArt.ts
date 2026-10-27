import Phaser from 'phaser';
import { dur, MOTION } from '../../ui/theme/tokens';
import { H5_ASSETS, addTerrainTile } from './h5Assets';
import { STORY_ASSETS } from './storyAssets';
import { actorDepth, floorDepth, worldToScreen } from '../../utils/iso';
import type { Footprint } from '../../utils/tile';
import type { ActorView, ActorViewState, FloorTileView } from './WorldRenderer';

const point = (x: number, y: number, z = 0) => { const p = worldToScreen({ x, y }); return new Phaser.Math.Vector2(p.x, p.y - z); };
function face(g: Phaser.GameObjects.Graphics, coords: number[][], color: number, alpha = 1): void {
  g.fillStyle(color, alpha).fillPoints(coords.map(([x, y, z]) => point(x!, y!, z)), true);
}
function block(g: Phaser.GameObjects.Graphics, f: Footprint, z: number, h: number, color: number): void {
  const { x, y, w, h: d } = f;
  face(g, [[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]], color);
  face(g, [[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]], Phaser.Display.Color.ValueToColor(color).darken(22).color);
  face(g, [[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]], Phaser.Display.Color.ValueToColor(color).lighten(12).color);
}

/** Original code-drawn street art; coordinates and collisions remain owned by the map. */
export function drawIncidentObject(g: Phaser.GameObjects.Graphics, type: string, f: Footprint, rescued: boolean): boolean {
  const c = point(f.x + f.w / 2, f.y + f.h / 2);
  if (type === 'kitten') {
    if (rescued) return true;
    g.fillStyle(0x071721, .35).fillEllipse(c.x, c.y, 46, 19);
    g.lineStyle(7, 0xdba767).beginPath().moveTo(c.x + 8, c.y - 10).lineTo(c.x + 25, c.y - 18).lineTo(c.x + 24, c.y - 31).strokePath();
    g.fillStyle(0xecc796).fillEllipse(c.x, c.y - 15, 27, 29).fillCircle(c.x - 3, c.y - 35, 18);
    g.fillTriangle(c.x-19,c.y-44,c.x-16,c.y-63,c.x-4,c.y-48).fillTriangle(c.x+4,c.y-48,c.x+16,c.y-61,c.x+14,c.y-42);
    g.fillStyle(0xc77e76).fillTriangle(c.x-16,c.y-45,c.x-14,c.y-56,c.x-8,c.y-47).fillTriangle(c.x+6,c.y-47,c.x+13,c.y-55,c.x+12,c.y-44);
    g.fillStyle(0x293744).fillCircle(c.x-10,c.y-36,2.7).fillCircle(c.x+4,c.y-36,2.7);
    g.fillStyle(0xd28b83).fillTriangle(c.x-5,c.y-30,c.x,c.y-30,c.x-2,c.y-27);
    g.lineStyle(1,0xffedd1).lineBetween(c.x-12,c.y-28,c.x-27,c.y-31).lineBetween(c.x+7,c.y-28,c.x+23,c.y-30);
    return true;
  }
  if (type === 'car') {
    g.fillStyle(0x0a1722,.35).fillEllipse(c.x,c.y+2,140,46);
    block(g,{...f,x:f.x+.08,y:f.y+.08,w:f.w-.16,h:f.h-.16},12,27,0x387f94);
    block(g,{x:f.x+.5,y:f.y+.12,w:f.w*.5,h:f.h-.24},39,26,0x28576d);
    face(g,[[f.x+.52,f.y+.08,41],[f.x+1.35,f.y+.08,41],[f.x+1.35,f.y+.08,60],[f.x+.52,f.y+.08,60]],0xa3c8d2);
    face(g,[[f.x+.52,f.y+f.h-.1,41],[f.x+1.35,f.y+f.h-.1,41],[f.x+1.35,f.y+f.h-.1,60],[f.x+.52,f.y+f.h-.1,60]],0x9ec4d1);
    for (const x of [f.x+.35,f.x+f.w-.35]) { const p=point(x,f.y+f.h,14); g.fillStyle(0x12202c).fillEllipse(p.x,p.y,18,24).fillStyle(0x82959c).fillCircle(p.x,p.y,5); }
    const light=point(f.x+f.w,f.y+.3,27); g.fillStyle(0xffe3a3).fillEllipse(light.x,light.y,8,10);
    return true;
  }
  if (type === 'barrier') {
    for (const x of [f.x+.18,f.x+f.w-.25]) block(g,{x,y:f.y+.3,w:.12,h:.4},0,32,0x525c68);
    block(g,{...f,y:f.y+.35,h:.22},18,22,0xe59249);
    for (let i=0;i<4;i++) {
      const x=f.x+.1+i*.45;
      face(g,[[x,f.y+.59,21],[x+.22,f.y+.59,21],[x+.4,f.y+.59,39],[x+.18,f.y+.59,39]],0xffe8be);
    }
    return true;
  }
  return false;
}

export function drawIncidentEnvironment(scene: Phaser.Scene, floor: FloorTileView[]): void {
  const surround = scene.add.graphics().setDepth(floorDepth - .8);
  for (let y=-4;y<18;y++) for (let x=-8;x<29;x++) {
    const road = y >= 3 && y <= 5;
    const sidewalk = y >= 1 && y <= 8;
    const n = ((x*17+y*31)%7+7)%7;
    if(scene.textures.exists(H5_ASSETS.terrain.key)&&sidewalk)addTerrainTile(scene,x,y,road?4+n%4:8+n%4,floorDepth-.7);
    else face(surround,[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],road ? 0x293c49 : sidewalk ? [0x425665,0x465967,0x3d5260][n%3]! : [0x142e32,0x173336,0x193139][n%3]!);
    if (sidewalk && !road) {
      const a=point(x+.06,y+.05), b=point(x+.96,y+.05);
      surround.lineStyle(1,0x91a8a7,.08).lineBetween(a.x,a.y,b.x,b.y);
    }
  }
  if(scene.textures.exists(STORY_ASSETS.trees.key)) {
    for(let y=-16;y<27;y+=2.9) for(let x=-19;x<38;x+=3.1) {
      if(x>-.5&&x<21&&y>-.7&&y<10.4) continue;
      const p=point(x,y);
      scene.add.image(p.x,p.y,STORY_ASSETS.trees.key).setOrigin(.5,.88).setDisplaySize(330,190).setDepth(x+y-1).setTint(y<0?0x718c9d:0x9eabb0);
    }
  }
  const road = scene.add.graphics().setDepth(floorDepth + .1);
  for (const t of floor) {
    const {x,y}=t.tile;
    if (t.kind === 'street' && y === 4 && x % 3 === 1) face(road,[[x+.15,y+.47],[x+.95,y+.47],[x+.95,y+.54],[x+.15,y+.54]],0xded3a4,.7);
    if ((x*13+y*7)%17 === 0 && t.walkable) {
      const p=point(x+.5,y+.5); road.fillStyle(0xbed8e1,.12).fillEllipse(p.x,p.y,65,16).lineStyle(1,0xd0e5eb,.18).strokeEllipse(p.x,p.y,49,10);
    }
  }
  for (let x=15;x<17;x+=.4) face(road,[[x,3.1],[x+.2,3.1],[x+.2,5.9],[x,5.9]],0xd9d7c3,.45);
  for (let i=-3;i<9;i++) {
    const x=1+i*3.6;
    const p=point(x+1.7,.3);
    if(scene.textures.exists(STORY_ASSETS.facade.key)) {
      scene.add.image(p.x,p.y+15,STORY_ASSETS.facade.key).setOrigin(.5,.97).setFlipX(true).setDisplaySize(430,430).setDepth(x+.7).setTint(i%3===1?0xbbcbd0:0xffffff);
    }
  }
  // Benches and planter boxes stay outside the playable lane.
  for(const x of [1.5,6.7,12.7,18.5]) {
    const g=scene.add.graphics().setDepth(x+1.4);
    block(g,{x,y:.8,w:.9,h:.36},0,18,0x5b6655);
    const p=point(x+.45,.98,19);
    g.fillStyle(0x477258).fillEllipse(p.x,p.y-12,56,30).fillStyle(0x71936a,.8).fillCircle(p.x-12,p.y-22,12).fillCircle(p.x+12,p.y-23,14);
  }
  for (const [x,y] of [[2,1.6],[8,1.6],[14,1.6],[18,7.7],[6,7.7]]) {
    const p=point(x!,y!);
    const glow=scene.add.graphics().setDepth(floorDepth+.2);
    for(let k=0;k<12;k++) glow.fillStyle(k%3?0xe9bb71:0x5f94b0,.06).fillEllipse(p.x+Math.sin(k*8)*10,p.y+18+k*7,42-k*2,3);
    glow.fillStyle(0xffd58c,.045).fillEllipse(p.x,p.y,180,65).fillStyle(0xffdb9d,.07).fillEllipse(p.x,p.y,100,36);
    const lamp=scene.add.graphics().setDepth(x!+y!);
    lamp.fillStyle(0x263d4b).fillEllipse(p.x,p.y,25,12).fillRoundedRect(p.x-3,p.y-115,6,115,3).fillRoundedRect(p.x-12,p.y-123,24,9,3);
    lamp.fillStyle(0xffdf9c).fillRoundedRect(p.x-9,p.y-119,18,18,4);
  }
}

export class IncidentActorView implements ActorView {
  depth=0;
  private readonly g: Phaser.GameObjects.Graphics;
  constructor(private readonly scene: Phaser.Scene) { this.g=scene.add.graphics(); }
  update(s: ActorViewState): void {
    const p=worldToScreen(s.pos); this.depth=actorDepth(s.pos);
    const bob=s.state==='MOVING'?Math.sin(this.scene.time.now/85)*2:0;
    const g=this.g.clear().setPosition(p.x,p.y).setDepth(this.depth);
    g.fillStyle(0x091b26,.35).fillEllipse(0,0,32,14);
    g.fillStyle(0x203348).fillRoundedRect(-11,-18,8,19,3).fillRoundedRect(3,-18,8,19,3);
    g.fillStyle(0xe7ad4a).fillRoundedRect(-16,-44+bob,32,31,9);
    g.fillStyle(0xf1c6a2).fillCircle(0,-51+bob,12).fillCircle(-19,-28+bob,5).fillCircle(19,-28+bob,5);
    g.fillStyle(0x352b32).fillEllipse(0,-59+bob,25,12).fillRoundedRect(-12,-59+bob,5,15,2);
    g.fillStyle(0x253744).fillCircle(5,-51+bob,2);
    if (s.progress!==null) g.fillStyle(0x183340).fillRoundedRect(-24,-80,48,7,3).fillStyle(0xffd98c).fillRoundedRect(-23,-79,46*s.progress,5,2);
  }
  hitTest(x:number,y:number):boolean { const p=this.g; return x>=p.x-22&&x<=p.x+22&&y>=p.y-70&&y<=p.y+5; }
  destroy():void { this.g.destroy(); }
}

export function addIncidentRain(scene: Phaser.Scene): void {
  const rain=scene.add.graphics().setDepth(100000);
  const update=() => {
    if (dur(MOTION.slow) === 0) { rain.clear(); return; }
    const c=scene.cameras.main, r=c.worldView;
    rain.clear().lineStyle(1/c.zoom,0xc4dfec,.22);
    const time=scene.time.now*.35;
    for(let i=0;i<14;i++) {
      const phase=((time*.006+i*.27)%1);
      const x=r.x+((i*223.7)%r.width), y=r.y+((i*147.3)%r.height);
      rain.lineStyle(1/c.zoom,0xc2d8dd,(1-phase)*.17).strokeEllipse(x,y,phase*19/c.zoom,phase*6/c.zoom);
    }
    rain.lineStyle(1/c.zoom,0xc4dfec,.22);
    for(let i=0;i<90;i++) {
      const x=r.x+((i*137.3-time*.2)%r.width+r.width)%r.width;
      const y=r.y+((i*79.7+time)%r.height);
      rain.lineBetween(x,y,x-5/c.zoom,y+13/c.zoom);
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE,update);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>scene.events.off(Phaser.Scenes.Events.UPDATE,update));
}
