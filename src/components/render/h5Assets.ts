import type Phaser from 'phaser';
export const H5_ASSETS = {
  terrain: { key: 'h5.terrain', url: '/assets/h5/terrain.png' },
  extra: { key: 'h5.extra', url: '/assets/h5/extra.png' },
  panel: { key: 'h5.panel', url: '/assets/h5/panel.png' },
  button: { key: 'h5.button', url: '/assets/h5/button.png' },
  icons: { key: 'h5.icons', url: '/assets/h5/icons.png' },
  portrait: { key: 'h5.portrait', url: '/assets/h5/portrait.png' },
  hero: { key: 'h5.hero', url: '/assets/h5/hero.png' },
} as const;
/**
 * Texture keys whose PNG is actually in public/assets. Empty while the art is
 * being regenerated: the game draws code placeholders. Add a key when its file lands.
 */
export const ART_READY: ReadonlySet<string> = new Set<string>([]);
const TERRAIN_BOUNDS: Record<string,{x:number;y:number;w:number;h:number}> = {};

/** Cell geometry is independent of the generated image's pixel resolution. */
export function registerH5Frames(scene: Phaser.Scene): void {
  for (const name of ['icons', 'hero', 'extra', 'terrain'] as const) {
    const key = H5_ASSETS[name].key;
    if (!scene.textures.exists(key)) continue;
    const texture = scene.textures.get(key), source = texture.getSourceImage() as HTMLImageElement;
    const w = Math.floor(source.width / 4), h = Math.floor(source.height / 4);
    for (let i = 0; i < 16; i++) if (!texture.has(String(i))) texture.add(String(i), 0, i % 4 * w, Math.floor(i / 4) * h, w, h);
    if(name==='terrain'&&!TERRAIN_BOUNDS['0']) {
      const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      for(let i=0;i<16;i++) {
        const ox=i%4*w,oy=Math.floor(i/4)*h;let left=w,right=0,top=h,bottom=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[((oy+y)*canvas.width+ox+x)*4+3]!>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
        TERRAIN_BOUNDS[String(i)]={x:left,y:top,w:right-left+1,h:bottom-top+1};
      }
    }

  }
}
export function worldSprite(type: string, _variant: string): { key: string; frame: string } | null {
  const extra: Record<string, number> = { kitten: 4, car: 5, barrier: 6, ancient_pillar: 7, hidden_cherry: 1 };
  return extra[type] !== undefined ? { key: H5_ASSETS.extra.key, frame: String(extra[type]) } : null;
}
export const HERO_FACINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function terrainFrame(kind:string,x:number,y:number):number|null {
  const variant=((x*7+y*11)%4+4)%4;
  return kind==='floor'?variant:kind==='street'?4+variant:kind==='sidewalk'?8+variant:kind==='forest_path'?12+variant%2:kind==='grass'?14:null;
}
export function addTerrainTile(scene:Phaser.Scene,x:number,y:number,frame:number,depth:number):void {
  if(!scene.textures.exists(H5_ASSETS.terrain.key))return;
  const f=scene.textures.get(H5_ASSETS.terrain.key).get(String(frame)),b=TERRAIN_BOUNDS[String(frame)]??{x:0,y:f.height*.25,w:f.width,h:f.height*.5};
  scene.add.image((x-y)*64,(x+y+1)*32,H5_ASSETS.terrain.key,String(frame)).setOrigin((b.x+b.w/2)/f.width,(b.y+b.h/2)/f.height).setDisplaySize(128*f.width/b.w,64*f.height/b.h).setDepth(depth);
}
export function terrainRepeat(scene:Phaser.Scene,frame:number):string|null {
  if(!scene.textures.exists(H5_ASSETS.terrain.key))return null;
  const key=`h5.terrain-repeat:${frame}`;
  if(!scene.textures.exists(key)){
    const tex=scene.textures.get(H5_ASSETS.terrain.key),f=tex.get(String(frame));
    const source=tex.getSourceImage() as HTMLImageElement, canvas=scene.textures.createCanvas(key,128,64)!;
    canvas.context.fillStyle=frame<4?'#9c714c':frame<8?'#243b4a':'#334b36';canvas.context.fillRect(0,0,128,64);
    const b=TERRAIN_BOUNDS[String(frame)]??{x:0,y:f.height*.25,w:f.width,h:f.height*.5};
    for(const[cx,cy]of [[64,32],[0,0],[128,0],[0,64],[128,64]])canvas.context.drawImage(source,f.cutX+b.x,f.cutY+b.y,b.w,b.h,cx!-64,cy!-32,128,64);
    canvas.refresh();
  }
  return key;
}
