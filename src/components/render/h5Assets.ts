import type Phaser from 'phaser';
export const H5_ASSETS = {
  terrain: { key: 'h5.terrain', url: '/assets/h5/terrain.png' },
  extra: { key: 'h5.extra', url: '/assets/h5/extra.png' },
  panel: { key: 'h5.panel', url: '/assets/h5/panel.png' },
  button: { key: 'h5.button', url: '/assets/h5/button.png' },
  icons: { key: 'h5.icons', url: '/assets/h5/icons.png' },
  cafe: { key: 'h5.cafe', url: '/assets/h5/cafe.png' },
  farm: { key: 'h5.farm', url: '/assets/h5/farm.png' },
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
  for (const name of ['icons', 'cafe', 'farm', 'hero', 'extra', 'terrain'] as const) {
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
const CAFE: Record<string, number> = { espresso_machine: 0, cafe_espresso: 0, espresso_pro: 0, grinder: 1, grinder_pro: 1, milk_station: 2, milk_station_pro: 2, counter: 3, order_counter: 3, table_2: 4, cafe_table: 4, cafe_table_long: 5, chair: 6, armchair: 7, supply_shelf: 8, shelf: 8, bookshelf: 9, plant: 10, floor_lamp: 11, pickup_point: 13, standing_spot: 13, travel_sign: 14, sign: 14, wall_post: 15 };
const FARM: Record<string, number> = { well: 4, seed_stall: 5, farmhouse: 6, tree: 7, drying_rack: 8, roaster: 9, market_stall: 10, crate: 11 };
export function worldSprite(type: string, variant: string): { key: string; frame: string } | null {
  if (type === 'farm_plot') {
    const frame = variant === 'ready' ? 12 : variant === 'thirsty' ? 13 : variant.startsWith('growing_') ? (Number(variant.slice(-1)) < 2 ? 1 : 2) : variant === 'prepared' ? 3 : 0;
    return { key: H5_ASSETS.farm.key, frame: String(frame) };
  }
  const extra:Record<string,number>={kitten:4,car:5,barrier:6,ancient_pillar:7,master:11,hidden_cherry:1};
  if(extra[type]!==undefined)return {key:H5_ASSETS.extra.key,frame:String(extra[type])};
  if (CAFE[type] !== undefined) return { key: H5_ASSETS.cafe.key, frame: String(CAFE[type]) };
  if (FARM[type] !== undefined) return { key: H5_ASSETS.farm.key, frame: String(FARM[type]) };
  return null;
}
let plotCenterY: number | null = null;
/**
 * Where the soil diamond's centre sits in a plot frame (0–1 of its height). Props are drawn with their base at 88%,
 * but a flat plot's centre is higher up, so anchoring the image at 88% floats it above its tile.
 */
export function plotAnchorY(scene: Phaser.Scene): number {
  if (plotCenterY !== null) return plotCenterY;
  plotCenterY = 0.88;
  const key = H5_ASSETS.farm.key;
  if (!scene.textures.exists(key)) return plotCenterY;
  const f = scene.textures.get(key).get('0');
  let top = f.height, bottom = 0;
  for (let y = 0; y < f.height; y += 2) for (let x = 0; x < f.width; x += 4) if ((scene.textures.getPixelAlpha(x, y, key, '0') ?? 0) > 32) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  if (bottom > top) plotCenterY = (top + bottom) / 2 / f.height;
  return plotCenterY;
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
