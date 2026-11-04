import { FARM_BOUNDS,FIELDS,INTERACTIONS } from './content.js';
import { t as tr } from '../../i18n/index.js';
export const DECORATIONS=[
  {id:'flowers',name:tr('farm.decor.flowers.name'),icon:'🌸',price:25,description:tr('farm.decor.flowers.desc')},
  {id:'lamp',name:tr('farm.decor.lamp.name'),icon:'🏮',price:40,description:tr('farm.decor.lamp.desc')},
  {id:'sign',name:tr('farm.decor.sign.name'),icon:'🪧',price:30,description:tr('farm.decor.sign.desc')}
];
const paths=[[-2,-9,-2,1],[-11.5,.1,8,.1],[-15,-8.4,-4,-8.4],[-4,-8.4,8,-8.1],[3.2,-8.1,3.2,.1],[8.5,-8.1,8.5,.1],[-4,-8.1,-4,-.4]];
export function decorationError(items,value){
  if(!DECORATIONS.some(item=>item.id===value.type)||![value.x,value.z,value.rotation].every(Number.isFinite))return tr('farm.decor.err.invalid');
  const {x,z}=value,b=FARM_BOUNDS;
  if(x<b.minX+1||x>b.maxX-1||z<b.minZ+1||z>b.maxZ-1)return tr('farm.decor.err.bounds');
  if(FIELDS.some(f=>Math.abs(x-f.center[0])<f.footprint.halfWidth+1&&Math.abs(z-f.center[1])<f.footprint.halfDepth+1))return tr('farm.decor.err.field');
  if(INTERACTIONS.filter(item=>!['plot','field','shop','market'].includes(item.kind)).some(item=>Math.hypot(x-item.position[0],z-item.position[1])<3.5))return tr('farm.decor.err.building');
  for(const [ax,az,bx,bz]of paths){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-ax-t*dx,z-az-t*dz)<1.15)return tr('farm.decor.err.path');}
  if(items.some(item=>Math.hypot(x-item.x,z-item.z)<1.3))return tr('farm.decor.err.tooClose');
  if(items.length>=100)return tr('farm.decor.err.limit');
  return null;
}
