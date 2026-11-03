import { CROPS,MACHINES,plotCare } from './content.js';
import { contractPrice,formatMass } from './rules.js';

export function farmBlockers(p,level,storageCapacity,now) {
  const items=[],trees=p.plots.filter(t=>t.unlocked),empty=trees.filter(t=>t.stage==='empty').length;
  if(empty&&!CROPS.some(c=>c.level<=level&&p.seeds[c.id]>0))items.push({id:'seeds',text:`${empty} ô trống · Đã hết cây giống`,action:'seed-shop',label:'Mua giống'});
  for(const crop of CROPS){const needed=p.orders.some(o=>o.status==='open'&&o.cropId===crop.id)||p.order?.accepted&&p.order.cropId===crop.id;
    if(needed&&!trees.some(t=>t.stage!=='empty'&&t.cropId===crop.id)&&!p.seeds[crop.id])items.push({id:`crop-${crop.id}`,text:`Đơn cần ${crop.short} · Chưa có cây/giống`,action:'seed-shop',label:'Mua giống'});
  }
  if(!p.fertilizer&&trees.some(t=>plotCare(t).canFeed))items.push({id:'fertilizer',text:'Cây tới đợt bón · Hết phân',action:'seed-shop',label:'Mua phân'});
  if(trees.some(t=>plotCare(t).needsWater)&&p.reservoir<1)items.push({id:'water',text:'Thiếu nước dự trữ · Chờ giếng hồi',action:'well-go',label:'Đến giếng'});
  const stock=p.lots.reduce((sum,l)=>sum+l.grams,0),outputs=MACHINES.flatMap(m=>[p.machines[m.id].batch,...p.machines[m.id].extraBatches].filter(j=>j&&j.readyAt<=now));
  if(stock>=storageCapacity||outputs.some(j=>stock+j.outputGrams>storageCapacity))items.push({id:'storage',text:outputs.length?`Kho còn ${formatMass(Math.max(0,storageCapacity-stock))} · Mẻ cần ${formatMass(Math.min(...outputs.map(j=>j.outputGrams)))}`:`Kho đầy ${formatMass(stock)} / ${formatMass(storageCapacity)}`,action:'bag',label:'Mở kho'});
  for(const w of p.workers.filter(w=>w.farmId==='farm-0')){
    if(!w.enabled)items.push({id:`paused-${w.id}`,text:`${w.name} đang tạm dừng`,action:'workers',label:'Nhân viên'});
    else if(w.shiftUntil<=now)items.push({id:`wage-${w.id}`,text:`${w.name} hết hợp đồng · Gia hạn ${contractPrice(w)} xu`,action:'workers',label:'Gia hạn'});
    else if(w.jobs.plant===false&&empty)items.push({id:`plant-${w.id}`,text:`${w.name} đang tắt Trồng cây`,action:'workers',label:'Thiết lập'});
  }
  const active=p.orders.filter(o=>o.source!=='shop'&&o.status==='open');
  for(const order of active){
    const crop=CROPS.find(c=>c.id===order.cropId),ready=p.stock.roasted[order.cropId]>=order.grams;
    const team=p.workers.filter(w=>order.workers.includes(w.id)&&w.farmId==='farm-0');
    if(ready)items.push({id:`send-${order.id}`,text:`Đủ ${formatMass(order.grams)} ${crop.short} rang · Chưa chuyển về quán${p.coins<2?' · Thiếu cước 2 xu':''}`,action:`order-go:${order.id}`,label:'Chuyển hàng'});
    else if(!team.length)items.push({id:`assign-${order.id}`,text:`Đơn ${formatMass(order.grams)} ${crop.short} · Chưa có nhân viên phụ trách`,action:`order-go:${order.id}`,label:'Giao nhân viên'});
    else if(team.every(w=>!Object.values(w.jobs||{}).some(Boolean)))items.push({id:`permissions-${order.id}`,text:`Đơn ${crop.short} · Nhân viên đã tắt mọi nhóm việc`,action:'workers',label:'Bật nhóm việc'});
    if(order.deadline-now<60000)items.push({id:`deadline-${order.id}`,text:`Đơn ${crop.short} sắp hết hạn · Còn ${Math.max(0,Math.ceil((order.deadline-now)/1000))} giây`,action:`order-go:${order.id}`,label:'Ưu tiên đơn'});
  }
  for(const machine of MACHINES){
    const state=p.machines[machine.id],batches=[state.batch,...state.extraBatches].filter(Boolean);
    if(batches.some(j=>j.readyAt<=now))items.push({id:`collect-${machine.id}`,text:`${machine.name} · Có mẻ hoàn thành chưa lấy`,action:`station-collect:${machine.id}`,label:'Đến lấy hàng'});
    if(machine.id==='dryer'&&batches.some(j=>!j.turned&&now>=(j.startedAt+j.readyAt)/2&&now<j.readyAt))items.push({id:'turn-dryer',text:'Mẻ phơi cần đảo để giữ chất lượng',action:'station-go:dryer',label:'Đến đảo phơi'});
  }
  for(const [key,label,predicate]of [['water-care','Cây cần tưới',t=>plotCare(t).needsWater],['weed-care','Cây cần làm cỏ',t=>plotCare(t).needsWeeding]]){
    const count=trees.filter(predicate).length;if(count)items.push({id:key,text:`${label} · ${count} ô`,action:'farm-tools',label:'Mở công cụ'});
  }
  if(empty&&CROPS.some(c=>c.level<=level&&p.seeds[c.id]>0))items.push({id:'empty-plots',text:`${empty} ô trống chưa trồng`,action:'farm-tools',label:'Trồng cây'});
  const cafeStock=p.cafe.lots.reduce((sum,l)=>sum+l.grams,0),incoming=p.cafe.shipments.reduce((sum,t)=>sum+t.lots.reduce((n,l)=>n+l.grams,0),0);
  if(cafeStock+incoming>=storageCapacity)items.push({id:'cafe-storage',text:'Kho quán đầy hoặc đã kín chỗ cho hàng đang chuyển',action:'cafe-play',label:'Vào quán'});
  if(p.cafe.open&&!Object.values(p.cafe.stock.roasted).some(n=>n>0)&&!incoming)items.push({id:'cafe-empty',text:'Quán đang mở nhưng hết cà phê rang',action:'order-board',label:'Tiếp hàng'});
  if(p.dailyTasks.some(t=>!t.claimed&&t.done>=t.goal))items.push({id:'daily-reward',text:'Nhiệm vụ cá nhân đã xong · Chưa nhận thưởng',action:'daily',label:'Nhận thưởng'});
  if(p.fish.count&&p.fish.fedUntil<=now)items.push({id:'fish-feed',text:'Cá chưa được cho ăn',action:'pond',label:'Đến ao cá'});
  return items;
}
