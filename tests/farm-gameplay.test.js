import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarm } from '../src/features/farm/model.js';
import { PLOTS,FIELDS,MACHINES,plotCare } from '../src/features/farm/content.js';
import { ASSETS,workerLevel,workerWage,SEASON_MS } from '../src/features/farm/rules.js';
import { productionNeed } from '../src/features/farm/orders.js';
import { editDragSelection } from '../src/features/farm/tools.js';
import { findRoute } from '../src/shared/game/navigation.js';
const AT=100000;
const fresh=()=>createFarm(null,'capital',()=>{},AT);
function withLots(lots){const saved=fresh().progress;saved.lots=lots.map((lot,i)=>({id:`fixture-${i}`,quality:80,createdAt:AT,origin:'fixture',...lot}));return createFarm(saved,null,()=>{},AT);}
const finish=search=>{let result;do{result=search.next();}while(!result.done);return result.value;};

test('land opens twelve cells once and requires adjacency',()=>{
 const farm=fresh();assert.equal(FIELDS.length,4);assert.equal(PLOTS.length,48);
 assert.equal(farm.act('field-3','expand',null,AT).ok,false);
 assert.equal(farm.act('field-1','expand',null,AT).ok,true);
 assert.equal(farm.progress.plots.filter(p=>p.unlocked).length,24);
 const wallet=farm.progress.coins;assert.equal(farm.act('field-1','expand',null,AT).ok,false);assert.equal(farm.progress.coins,wallet);
});
test('one seed per empty cell and no water consumed on a healthy plant',()=>{
 const farm=fresh(),id=PLOTS[8].id,seeds=farm.progress.seeds.robusta;
 assert.equal(farm.act(id,'plant','robusta',AT).ok,true);
 assert.equal(farm.act(id,'plant','robusta',AT).ok,false);
 assert.equal(farm.progress.seeds.robusta,seeds-1);
 const water=farm.progress.water;assert.equal(plotCare(farm.progress.plots[8]).needsWater,false);
 assert.equal(farm.act(id,'water',null,AT).ok,false);assert.equal(farm.progress.water,water);
 assert.equal(farm.act(id,'clear',null,AT).ok,true);assert.equal(farm.progress.seeds.robusta,seeds-1);
});
test('dry plants pause, feeding is phase guarded and picking preserves perennial trees',()=>{
 const saved=fresh().progress,p=saved.plots[0];p.stage='growing';p.growthMs=SEASON_MS*.4;p.water=0;p.weeds=0;saved.fertilizer=2;
 const dry=createFarm(saved,null,()=>{},AT),before=dry.progress.plots[0].growthMs;
 dry.tick(AT+1000);assert.equal(dry.progress.plots[0].growthMs,before);
 assert.equal(dry.act(p.id,'fertilize',null,AT+1000).ok,false);
 assert.equal(dry.act(p.id,'water',null,AT+1000).ok,true);
 assert.equal(dry.act(p.id,'fertilize',null,AT+1000).ok,true);
 assert.equal(dry.act(p.id,'fertilize',null,AT+1000).ok,false);
 const farm=fresh();assert.equal(farm.act(PLOTS[0].id,'harvest',null,AT).ok,true);
 assert.equal(farm.progress.plots[0].mature,true);assert.notEqual(farm.progress.plots[0].stage,'empty');
});
test('reservations protect the final seed from a second actor',()=>{
 const saved=fresh().progress;saved.seeds.robusta=1;const farm=createFarm(saved,null,()=>{},AT);
 assert.equal(farm.reserve(PLOTS[8].id,'plant','an','robusta'),true);
 assert.equal(farm.reserve(PLOTS[9].id,'plant','binh','robusta'),false);
 assert.equal(farm.act(PLOTS[9].id,'plant','robusta',AT).ok,false);
 assert.equal(farm.act(PLOTS[8].id,'plant','robusta',AT,'an').ok,true);
 farm.release('an');assert.equal(farm.progress.seeds.robusta,0);
});
test('machine capacity splits work into a real queue and only finished output can be collected',()=>{
 const farm=withLots([{product:'cherries',cropId:'robusta',grams:36000}]);
 assert.equal(farm.act('dryer','start',{cropId:'robusta',quantity:60},AT).ok,true);
 const state=farm.progress.machines.dryer,first=state.batch,second=state.extraBatches[0];
 assert.ok(second.startedAt>=first.readyAt);assert.equal(first.inputGrams,18000);
 assert.equal(farm.act('dryer','collect',null,first.readyAt-1).ok,false);
 assert.equal(farm.act('dryer','collect',null,first.readyAt).ok,true);
 assert.equal(farm.progress.stock.dried.robusta,3000);
 assert.equal(farm.act('dryer','collect',null,first.readyAt).ok,false);
});
test('canceling queued work returns its exact input once',()=>{
 const farm=withLots([{product:'cherries',cropId:'robusta',grams:36000}]);farm.act('dryer','start',{cropId:'robusta',quantity:60},AT);
 const waiting=farm.progress.machines.dryer.extraBatches[0];
 assert.equal(farm.act('dryer','cancel',waiting.id,AT).ok,true);assert.equal(farm.progress.stock.cherries.robusta,18000);
 assert.equal(farm.act('dryer','cancel',waiting.id,AT).ok,false);assert.equal(farm.progress.stock.cherries.robusta,18000);
});
test('orders transfer goods exactly once without creating revenue',()=>{
 const farm=withLots([{product:'roasted',cropId:'robusta',grams:900}]),order=farm.progress.orders.find(o=>o.cropId==='robusta');
 const coins=farm.progress.coins;
 assert.equal(farm.act('orders','shipOrder',order.id,AT).ok,true);
 assert.equal(farm.act('orders','shipOrder',order.id,AT).ok,false);
 assert.equal(farm.progress.coins,coins-2);assert.equal(farm.progress.stock.roasted.robusta,900-order.grams);
 const arrival=farm.progress.cafe.shipments[0].readyAt;farm.tick(arrival);
 assert.equal(farm.progress.cafe.stock.roasted.robusta,order.grams);
 const restored=createFarm(farm.progress,null,()=>{},arrival);restored.tick(arrival+1);
 assert.equal(restored.progress.cafe.stock.roasted.robusta,order.grams);
 assert.equal(restored.progress.orders.find(o=>o.id===order.id).status,'delivered');
});
test('multiple hires are retained but a farm deploys only two; wages rise with level',()=>{
 const farm=fresh();for(const id of ['an','binh','chi'])assert.equal(farm.act('workers','hire',id,AT).ok,true);
 assert.equal(farm.progress.workers.length,3);assert.equal(farm.progress.workers.filter(w=>w.farmId==='farm-0').length,2);
 assert.equal(farm.act('workers','deploy','chi',AT).ok,false);
 assert.equal(farm.act('workers','deploy','an',AT).ok,true);assert.equal(farm.act('workers','deploy','chi',AT).ok,true);
 const w=farm.progress.workers.find(w=>w.id==='chi');assert.equal(workerWage(w),8);
 assert.equal(farm.act('workers','train','chi',AT).ok,true);
 const trained=farm.progress.workers.find(w=>w.id==='chi');assert.equal(workerLevel(trained.xp),2);assert.equal(workerWage(trained),12);
 const coins=farm.progress.coins;assert.equal(farm.act('workers','shift','chi',AT).ok,true);assert.equal(farm.progress.coins,coins-12);
 assert.equal(farm.act('workers','shift','chi',AT).ok,false);
});
test('permissions and daily tasks persist, daily reward cannot be claimed twice',()=>{
 const farm=fresh();farm.act('workers','hire','an',AT);
 farm.act('workers','permission',{id:'an',job:'water'},AT);assert.equal(farm.progress.workers[0].jobs.water,false);
 const saved=farm.progress,task=saved.dailyTasks[0];task.done=task.goal;
 const restored=createFarm(saved,null,()=>{},AT);
 assert.equal(restored.act('daily','claim',{taskId:task.id},AT).ok,true);
 assert.equal(restored.act('daily','claim',{taskId:task.id},AT).ok,false);
 assert.equal(restored.progress.workers[0].jobs.water,false);
});
test('every asset has an enforced level ten cap',()=>{
 const saved=fresh().progress;saved.xp=10000;const farm=createFarm(saved,null,()=>{},AT);
 for(const asset of ASSETS){for(let i=1;i<10;i++)assert.equal(farm.act(asset.id,'upgrade',null,AT).ok,true,asset.id);assert.equal(farm.progress.upgrades[asset.id],10);const coins=farm.progress.coins;assert.equal(farm.act(asset.id,'upgrade',null,AT).ok,false);assert.equal(farm.progress.coins,coins);}
});
test('production planning accounts for held machine outputs, not just loose stock',()=>{
 const farm=withLots([{product:'dried',cropId:'robusta',grams:300}]);farm.act('roaster','start',{cropId:'robusta',quantity:3},AT);
 assert.deepEqual(productionNeed(farm.progress,'robusta',252),{roasted:0,green:0,cherries:0});
});
test('legacy inventory, seeds and unfinished hulling survive migration once',()=>{
 const old={version:2,debugFundsGranted:true,coins:123,seeds:{robusta:5},stock:{cherries:{robusta:7},green:{robusta:2}},machines:{huller:{batch:{cropId:'robusta',quantity:1,startedAt:AT,readyAt:AT+1000}}},plots:[]};
 const farm=createFarm(old,null,()=>{},AT);assert.equal(farm.progress.coins,123);assert.equal(farm.progress.seeds.robusta,5);
 assert.equal(farm.progress.stock.cherries.robusta,700);assert.equal(farm.progress.stock.dried.robusta,300);
 const restored=createFarm(farm.progress,null,()=>{},AT);assert.equal(restored.progress.stock.dried.robusta,300);
});
test('drag can retract, cannot duplicate cells and stops at available quantity',()=>{
 assert.deepEqual(editDragSelection(['a','b','c','d'],'c',4),['a','b','c']);
 assert.deepEqual(editDragSelection(['a'],'a',4),['a']);assert.deepEqual(editDragSelection(['a','b'],'c',2),['a','b']);assert.deepEqual(editDragSelection(['a'],'b',0),[]);
});
test('routes honor obstacles and finish at a reachable interaction point',()=>{
 const bounds={minX:-3,maxX:3,minZ:-3,maxZ:3},stand=(x,z)=>x>=-3&&x<=3&&z>=-3&&z<=3&&Math.abs(x)>.4;
 const route=finish(findRoute({x:-2,z:0},{x:2,z:0},stand,bounds,{points:[{x:2,z:0},{x:-1.5,z:2}],radius:.35}));
 assert.ok(route.length);assert.ok(route.every(p=>p.x<-.4));assert.ok(Math.hypot(route.at(-1).x+1.5,route.at(-1).z-2)<=.35);
});

test('start-work pays one shift and starts useful autonomous work without a separate order',()=>{
 const farm=fresh();farm.act('workers','hire','an',AT);const before=farm.progress.coins;
 assert.equal(farm.act('workers','startWork','an',AT).ok,true);
 let worker=farm.progress.workers[0];assert.equal(worker.workMode,'auto');assert.equal(worker.enabled,true);assert.ok(worker.shiftUntil>AT);assert.equal(farm.progress.coins,before-8);
 assert.equal(farm.act('workers','startWork','an',AT).ok,true);assert.equal(farm.progress.coins,before-8);
});
test('assign-and-start pays and assigns the whole team atomically',()=>{
 const farm=fresh();farm.act('workers','hire','an',AT);farm.act('workers','hire','binh',AT);
 const order=farm.progress.orders[0],saved=farm.progress;saved.coins=15;
 const poor=createFarm(saved,null,()=>{},AT);
 assert.equal(poor.act('orders','startCrew',order.id,AT).ok,false);assert.equal(poor.progress.coins,15);assert.deepEqual(poor.progress.orders[0].workers,[]);
 assert.equal(farm.act('orders','startCrew',order.id,AT).ok,true);assert.deepEqual(farm.progress.orders[0].workers,['an','binh']);assert.ok(farm.progress.workers.every(w=>w.shiftUntil>AT&&w.enabled));
});

test('hired staff default to continuous work and fatigue bonus charges once',()=>{
 const farm=fresh();farm.act('workers','hire','an',AT);let worker=farm.progress.workers[0];
 assert.equal(worker.workMode,'auto');assert.equal(worker.autoPay,true);
 const saved=farm.progress;saved.workers[0].energy=15;saved.workers[0].restUntil=AT+60000;
 const tired=createFarm(saved,null,()=>{},AT),coins=tired.progress.coins;
 assert.equal(tired.act('workers','overtime','an',AT).ok,true);
 worker=tired.progress.workers[0];assert.equal(worker.energy,75);assert.equal(worker.restUntil,0);assert.equal(tired.progress.coins,coins-4);
 assert.equal(tired.act('workers','overtime','an',AT).ok,false);
});

test('daily payroll does not charge twice before the paid day expires',()=>{
 const farm=fresh();farm.act('workers','hire','an',AT);const before=farm.progress.coins;
 farm.act('workers','shift','an',AT);assert.equal(farm.progress.workers[0].shiftUntil,AT+60000);
 assert.equal(farm.act('workers','shift','an',AT+59999).ok,false);
 assert.equal(farm.progress.coins,before-8);farm.employmentTick('an',.1);assert.equal(farm.progress.workers[0].serviceMs,100);
});
test('accepted shop order expires once and its replacement is only an offer',()=>{
 const farm=fresh();farm.act('workers','hire','an',AT);farm.act('market','acceptOrder',null,AT);
 const deadline=farm.progress.order.deadline;farm.tick(deadline+1);const rep=farm.progress.reputation;
 assert.equal(farm.progress.order.accepted,false);assert.ok(farm.progress.orders.some(o=>o.source==='shop'&&o.status==='expired'));
 farm.tick(deadline+2);assert.equal(farm.progress.reputation,rep);
});

test('planting selection falls back from exhausted preferred seeds and covers other varieties',async()=>{
 const {choosePlantCrop,jobAgeBonus}=await import('../src/features/farm/worker-planner.js');
 const p=fresh().progress;p.seeds={robusta:0,arabica:2,liberica:1};
 const w={id:'an',workMode:'auto',preferredCrop:'robusta',preferredCropExplicit:true};
 assert.equal(choosePlantCrop(w,p,2),'arabica');
 p.seeds.arabica=0;assert.equal(choosePlantCrop(w,p,2),null);assert.equal(choosePlantCrop(w,p,3),'liberica');
 assert.equal(jobAgeBonus(1000,41000),36);assert.equal(jobAgeBonus(1000,500),0);
});
test('empty purchased land without seedlings gives an actionable blocker',async()=>{
 const {farmBlockers}=await import('../src/features/farm/blockers.js');
 const farm=fresh(),p=farm.progress;p.seeds={robusta:0,arabica:0,liberica:0};
 const blockers=farmBlockers(p,1,farm.storageCapacity,AT);
 assert.ok(blockers.some(b=>b.id==='seeds'&&b.action==='seed-shop'));
});

test('a harvest takes the whole ripe yield and returns to recovery without an immediate second pick',()=>{
 const farm=fresh();farm.act('workers','hire','chi',AT);const yieldGrams=farm.progress.plots[0].readyYield;
 assert.equal(farm.act(PLOTS[0].id,'harvest',null,AT,'chi').ok,true);
 assert.equal(farm.progress.stock.cherries.robusta,yieldGrams);
 const tree=farm.progress.plots[0];assert.equal(tree.stage,'growing');assert.equal(tree.growthMs,0);assert.equal(tree.secondPick,0);assert.equal(tree.remainingFruit,0);
 farm.tick(AT+1000);assert.notEqual(farm.progress.plots[0].stage,'ready');
});
test('collect receives only completed batches that fit, leaving the others at the station',()=>{
 const seed=withLots([{product:'cherries',cropId:'robusta',grams:59000}]).progress;
 seed.machines.dryer.batch={id:'small',cropId:'robusta',quantity:5,outputGrams:500,quality:80,startedAt:AT-30000,readyAt:AT};
 seed.machines.dryer.extraBatches=[{id:'large',cropId:'robusta',quantity:10,outputGrams:1000,quality:80,startedAt:AT-30000,readyAt:AT}];
 const farm=createFarm(seed,null,()=>{},AT);assert.equal(farm.act('dryer','collect',null,AT).ok,true);
 assert.equal(farm.progress.stock.dried.robusta,500);assert.equal(farm.progress.machines.dryer.batch.id,'large');
});
