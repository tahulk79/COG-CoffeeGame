import { FARM_BOUNDS,FIELDS,INTERACTIONS } from './content.js';
export const DECORATIONS=[
  {id:'flowers',name:'Bồn hoa',icon:'🌸',price:25,description:'Một góc hoa nhỏ cho farm, không tăng sản lượng.'},
  {id:'lamp',name:'Đèn vườn',icon:'🏮',price:40,description:'Đèn vàng ấm để trang trí lối vườn.'},
  {id:'sign',name:'Biển tên',icon:'🪧',price:30,description:'Đặt biển với tên riêng cho góc vườn của bạn.'}
];
const paths=[[-2,-9,-2,1],[-11.5,.1,8,.1],[-15,-8.4,-4,-8.4],[-4,-8.4,8,-8.1],[3.2,-8.1,3.2,.1],[8.5,-8.1,8.5,.1],[-4,-8.1,-4,-.4]];
export function decorationError(items,value){
  if(!DECORATIONS.some(item=>item.id===value.type)||![value.x,value.z,value.rotation].every(Number.isFinite))return 'Vị trí trang trí không hợp lệ.';
  const {x,z}=value,b=FARM_BOUNDS;
  if(x<b.minX+1||x>b.maxX-1||z<b.minZ+1||z>b.maxZ-1)return 'Đặt trong khu đất của nông trại.';
  if(FIELDS.some(f=>Math.abs(x-f.center[0])<f.footprint.halfWidth+1&&Math.abs(z-f.center[1])<f.footprint.halfDepth+1))return 'Không đặt lên ruộng hoặc cổng ruộng.';
  if(INTERACTIONS.filter(item=>!['plot','field','shop','market'].includes(item.kind)).some(item=>Math.hypot(x-item.position[0],z-item.position[1])<3.5))return 'Cần chừa khoảng trống quanh công trình.';
  for(const [ax,az,bx,bz]of paths){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-ax-t*dx,z-az-t*dz)<1.15)return 'Không đặt trên đường đi.';}
  if(items.some(item=>Math.hypot(x-item.x,z-item.z)<1.3))return 'Đồ trang trí đang quá gần nhau.';
  if(items.length>=100)return 'Farm đã có 100 món trang trí.';
  return null;
}
