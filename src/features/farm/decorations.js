import { BUILDINGS,FARM_BOUNDS,FIELDS,INTERACTIONS } from './content.js';
import { regionType } from '../world-map/content.js';
import { t as tr } from '../../i18n/index.js';
export const DECORATIONS=[
  {id:'flowers',name:tr('farm.decor.flowers.name'),icon:'🌸',price:25,description:tr('farm.decor.flowers.desc')},
  {id:'lamp',name:tr('farm.decor.lamp.name'),icon:'🏮',price:40,description:tr('farm.decor.lamp.desc')},
  {id:'sign',name:tr('farm.decor.sign.name'),icon:'🪧',price:30,description:tr('farm.decor.sign.desc')}
];
// Vùng cấm xây 3,5 m quanh mọi trạm/công trình (CT-14, 05/11/2026 F-48): Sạp, Cửa quán, Bảng đơn, Nhà thợ nay nằm trong rào
// nên không còn miễn kind 'shop'/'market'; công trình còn ẩn vẫn giữ chỗ để lúc dựng lên không đè đồ trang trí.
// Cửa quán/Bảng đơn chỉ dựng ở nơi 'both' (CT-13): nơi khác không giữ chỗ cho chúng. Không truyền region thì giữ chỗ hết.
const SOLIDS=INTERACTIONS.filter(item=>!['plot','field'].includes(item.kind)),BOTH_ONLY=BUILDINGS.filter(b=>b.both).map(b=>b.id);
export const nearBuilding=(x,z,region)=>{const all=region===undefined||regionType(region)==='both';return SOLIDS.some(item=>(all||!BOTH_ONLY.includes(item.id))&&Math.hypot(x-item.position[0],z-item.position[1])<3.5);};
const paths=[[-2,-9,-2,1],[-11.5,.1,8,.1],[-15,-8.4,-4,-8.4],[-4,-8.4,8,-8.1],[3.2,-8.1,3.2,.1],[8.5,-8.1,8.5,.1],[-4,-8.1,-4,-.4]];
export function decorationError(items,value,region){
  if(!DECORATIONS.some(item=>item.id===value.type)||![value.x,value.z,value.rotation].every(Number.isFinite))return tr('farm.decor.err.invalid');
  const {x,z}=value,b=FARM_BOUNDS;
  if(x<b.minX+1||x>b.maxX-1||z<b.minZ+1||z>b.maxZ-1)return tr('farm.decor.err.bounds');
  if(FIELDS.some(f=>Math.abs(x-f.center[0])<f.footprint.halfWidth+1&&Math.abs(z-f.center[1])<f.footprint.halfDepth+1))return tr('farm.decor.err.field');
  if(nearBuilding(x,z,region))return tr('farm.decor.err.building');
  for(const [ax,az,bx,bz]of paths){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-ax-t*dx,z-az-t*dz)<1.15)return tr('farm.decor.err.path');}
  if(items.some(item=>Math.hypot(x-item.x,z-item.z)<1.3))return tr('farm.decor.err.tooClose');
  if(items.length>=100)return tr('farm.decor.err.limit');
  return null;
}
// Save cũ (CT-14): đồ trang trí trong vùng cấm xây tự dời tới chỗ hợp lệ gần nhất (vòng xoắn 0,5 m), giữ id/kiểu/chữ/trạng thái.
// Game chưa có kho đồ trang trí nên không còn chỗ thì trả món về `returned` (model hoàn đủ giá), không bao giờ để đè công trình.
export function relocateDecorations(items,region){
  const placed=[],returned=[];
  items.forEach((item,index)=>{
    if(!nearBuilding(item.x,item.z,region)){placed.push(item);return;}
    const others=[...placed,...items.slice(index+1)];
    let spot=null;
    for(let ring=1;ring<=40&&!spot;ring++)for(let i=0;i<ring*8&&!spot;i++){
      const angle=i/(ring*8)*Math.PI*2,x=Math.round((item.x+Math.cos(angle)*ring*.5)*100)/100,z=Math.round((item.z+Math.sin(angle)*ring*.5)*100)/100;
      if(!decorationError(others,{...item,x,z},region))spot={x,z};
    }
    if(spot)placed.push({...item,...spot});else returned.push(item);
  });
  return {items:placed,returned};
}
