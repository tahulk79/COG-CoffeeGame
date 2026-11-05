import { CROPS,MACHINES,plotCare } from './content.js';
import { contractPrice,formatMass } from './rules.js';
import { t as tr } from '../../i18n/index.js';

// `tools`: the ⛏️ strip is open (field 2+); before that, plot items walk to the first matching tree, where a tap does the job.
export function farmBlockers(p,level,storageCapacity,now,tools=true) {
  const items=[],trees=p.plots.filter(t=>t.unlocked),empty=trees.filter(t=>t.stage==='empty').length;
  if(empty&&!CROPS.some(c=>c.level<=level&&p.seeds[c.id]>0))items.push({id:'seeds',text:tr('farm.blocker.noSeeds',{n:empty}),action:'seed-shop',label:tr('farm.blocker.shop')});
  for(const crop of CROPS){const needed=p.orders.some(o=>o.status==='open'&&o.cropId===crop.id)||p.order?.accepted&&p.order.cropId===crop.id;
    if(needed&&!trees.some(t=>t.stage!=='empty'&&t.cropId===crop.id)&&!p.seeds[crop.id])items.push({id:`crop-${crop.id}`,text:tr('farm.blocker.cropMissing',{crop:crop.short}),action:'seed-shop',label:tr('farm.blocker.shop')});
  }
  if(!p.fertilizer&&trees.some(t=>plotCare(t).canFeed))items.push({id:'fertilizer',text:tr('farm.blocker.noFertilizer'),action:'seed-shop',label:tr('farm.blocker.buyFertilizer')});
  if(trees.some(t=>plotCare(t).needsWater)&&p.reservoir<1)items.push({id:'water',text:tr('farm.blocker.noWater'),action:'well-go',label:tr('farm.blocker.goWell')});
  const stock=p.lots.reduce((sum,l)=>sum+l.grams,0),outputs=MACHINES.flatMap(m=>[p.machines[m.id].batch,...p.machines[m.id].extraBatches].filter(j=>j&&j.readyAt<=now));
  if(stock>=storageCapacity||outputs.some(j=>stock+j.outputGrams>storageCapacity))items.push({id:'storage',urgent:true,text:outputs.length?tr('farm.blocker.storageLow',{left:formatMass(Math.max(0,storageCapacity-stock)),need:formatMass(Math.min(...outputs.map(j=>j.outputGrams)))}):tr('farm.blocker.storageFull',{stock:formatMass(stock),cap:formatMass(storageCapacity)}),action:'bag',label:tr('farm.blocker.openStorage')});
  for(const w of p.workers.filter(w=>w.farmId==='farm-0')){
    if(!w.enabled)items.push({id:`paused-${w.id}`,text:tr('farm.blocker.workerPaused',{name:w.name}),action:'workers',label:tr('farm.blocker.staff')});
    else if(w.shiftUntil<=now)items.push({id:`wage-${w.id}`,urgent:true,text:tr(w.kind==='robot'?'farm.blocker.robotExpired':'farm.blocker.contractExpired',{name:w.name,price:contractPrice(w)}),action:'workers',label:tr('farm.blocker.renew')});
    else if(w.jobs.plant===false&&empty)items.push({id:`plant-${w.id}`,text:tr('farm.blocker.plantOff',{name:w.name}),action:'workers',label:tr('farm.blocker.setup')});
  }
  if(p.robotGift?.state==='ready')items.push({id:'robot-gift',text:tr('farm.blocker.robotGift'),action:'cafe-play',label:tr('farm.blocker.goCafe')});
  const active=p.orders.filter(o=>o.source!=='shop'&&o.status==='open');
  for(const order of active){
    const crop=CROPS.find(c=>c.id===order.cropId),ready=p.stock.roasted[order.cropId]>=order.grams;
    const team=p.workers.filter(w=>order.workers.includes(w.id)&&w.farmId==='farm-0');
    if(ready)items.push({id:`send-${order.id}`,text:tr('farm.blocker.orderReady',{mass:formatMass(order.grams),crop:crop.short})+(p.coins<2?tr('farm.blocker.noFreight'):''),action:`order-go:${order.id}`,label:tr('farm.blocker.ship')});
    else if(!team.length&&p.workers.some(w=>w.farmId==='farm-0'))items.push({id:`assign-${order.id}`,text:tr('farm.blocker.orderNoStaff',{mass:formatMass(order.grams),crop:crop.short}),action:`order-go:${order.id}`,label:tr('farm.blocker.assignStaff')});
    else if(team.every(w=>!Object.values(w.jobs||{}).some(Boolean)))items.push({id:`permissions-${order.id}`,text:tr('farm.blocker.orderJobsOff',{crop:crop.short}),action:'workers',label:tr('farm.blocker.enableJobs')});
    if(order.deadline-now<60000)items.push({id:`deadline-${order.id}`,text:tr('farm.blocker.orderDeadline',{crop:crop.short,n:Math.max(0,Math.ceil((order.deadline-now)/1000))}),action:`order-go:${order.id}`,label:tr('farm.blocker.prioritize')});
  }
  for(const machine of MACHINES){
    const state=p.machines[machine.id],batches=[state.batch,...state.extraBatches].filter(Boolean);
    if(batches.some(j=>j.readyAt<=now))items.push({id:`collect-${machine.id}`,text:tr('farm.blocker.batchReady',{machine:machine.name}),action:`station-collect:${machine.id}`,label:tr('farm.blocker.collect')});
    if(machine.id==='dryer'&&batches.some(j=>!j.turned&&now>=(j.startedAt+j.readyAt)/2&&now<j.readyAt))items.push({id:'turn-dryer',text:tr('farm.blocker.turnDryer'),action:'station-go:dryer',label:tr('farm.blocker.goTurn')});
  }
  for(const [key,label,predicate]of [['water-care',tr('farm.blocker.needWater'),t=>plotCare(t).needsWater],['weed-care',tr('farm.blocker.needWeed'),t=>plotCare(t).needsWeeding]]){
    const matching=trees.filter(predicate);if(matching.length)items.push({id:key,text:tr('farm.blocker.careCount',{label,n:matching.length}),action:tools?'farm-tools':`station-go:${matching[0].id}`,label:tools?tr('farm.blocker.openTools'):tr('farm.blocker.goTree')});
  }
  // Before the ⛏️ strip, empty plots are the newcomer's own pace, not a blocker (onboarding-flow 3.3: 6 HUD parts at start).
  if(tools&&empty&&CROPS.some(c=>c.level<=level&&p.seeds[c.id]>0))items.push({id:'empty-plots',text:tr('farm.blocker.emptyPlots',{n:empty}),action:'farm-tools',label:tr('farm.blocker.plant')});
  const cafeStock=p.cafe.lots.reduce((sum,l)=>sum+l.grams,0),incoming=p.cafe.shipments.reduce((sum,t)=>sum+t.lots.reduce((n,l)=>n+l.grams,0),0);
  if(cafeStock+incoming>=storageCapacity)items.push({id:'cafe-storage',text:tr('farm.blocker.cafeStorage'),action:'cafe-play',label:tr('farm.blocker.goCafe')});
  if(p.cafe.open&&!Object.values(p.cafe.stock.roasted).some(n=>n>0)&&!incoming)items.push({id:'cafe-empty',text:tr('farm.blocker.cafeEmpty'),action:'order-board',label:tr('farm.blocker.restock')});
  return items;
}
