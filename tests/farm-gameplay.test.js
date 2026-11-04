import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarm } from '../src/features/farm/model.js';
import { PLOTS,FIELDS,MACHINES,QUESTS,plotCare } from '../src/features/farm/content.js';
import { ASSETS,workerLevel,workerWage,SEASON_MS,WORK_DAY_MS,contractPrice,assetMaxLevel } from '../src/features/farm/rules.js';
import { productionNeed } from '../src/features/farm/orders.js';
import { editDragSelection } from '../src/features/farm/tools.js';
import { findRoute } from '../src/shared/game/navigation.js';
const AT=100000;
const fresh=()=>createFarm(null,'capital',()=>{},AT);
function withLots(lots){const saved=fresh().progress;saved.lots=lots.map((lot,i)=>({id:`fixture-${i}`,quality:80,createdAt:AT,origin:'fixture',...lot}));return createFarm(saved,null,()=>{},AT);}
// Rich save: hiring three people costs 480 xu, more than a new farm owns.
const rich=()=>{const saved=fresh().progress;saved.coins=5000;return createFarm(saved,null,()=>{},AT);};
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
 // Café orders now come from the café (or a deployed worker), not for free at start.
 // Tutorial quests already claimed so the one-time "ship beans" reward does not count as delivery revenue.
 const saved=withLots([{product:'roasted',cropId:'robusta',grams:900}]).progress;saved.claimed=QUESTS.map(q=>q.id);
 const farm=createFarm(saved,null,()=>{},AT);assert.equal(farm.act('cafe','order','robusta',AT).ok,true);
 const order=farm.progress.orders.find(o=>o.cropId==='robusta'&&o.source==='cafe');
 const coins=farm.progress.coins,cafeBefore=farm.progress.cafe.stock.roasted.robusta; // new saves start with a 600 g café starter lot
 assert.equal(farm.act('orders','shipOrder',order.id,AT).ok,true);
 assert.equal(farm.act('orders','shipOrder',order.id,AT).ok,false);
 assert.equal(farm.progress.coins,coins-2);assert.equal(farm.progress.stock.roasted.robusta,900-order.grams);
 const arrival=farm.progress.cafe.shipments[0].readyAt;farm.tick(arrival);
 assert.equal(farm.progress.cafe.stock.roasted.robusta,cafeBefore+order.grams);
 const restored=createFarm(farm.progress,null,()=>{},arrival);restored.tick(arrival+1);
 assert.equal(restored.progress.cafe.stock.roasted.robusta,cafeBefore+order.grams);
 assert.equal(restored.progress.orders.find(o=>o.id===order.id).status,'delivered');
});
test('hiring is capped at two farm workers and wages rise with level',()=>{
 // Shift hiring: hires go straight to the farm (no reserve bench); day wage D = 30 + 10 × (level − 1), one work day per payment, stacking.
 const farm=rich();for(const id of ['an','binh'])assert.equal(farm.act('workers','hire',id,AT).ok,true);
 assert.equal(farm.act('workers','hire','chi',AT).ok,false);assert.ok(farm.progress.workers.every(w=>w.farmId==='farm-0'));
 assert.equal(farm.act('workers','deploy','an',AT).ok,false,'cannot move a worker to a reserve bench');
 assert.equal(farm.act('workers','dismiss','an',AT).ok,true);assert.equal(farm.act('workers','hire','chi',AT).ok,true);
 const w=farm.progress.workers.find(w=>w.id==='chi');assert.equal(workerWage(w),30);
 assert.equal(farm.act('workers','train','chi',AT).ok,true);
 const trained=farm.progress.workers.find(w=>w.id==='chi');assert.equal(workerLevel(trained.xp),2);assert.equal(workerWage(trained),40);
 const coins=farm.progress.coins,price=contractPrice(trained);assert.equal(price,40);
 assert.equal(farm.act('workers','shift','chi',AT).ok,true);assert.equal(farm.progress.coins,coins-price);
 const until=farm.progress.workers.find(w=>w.id==='chi').shiftUntil;
 assert.equal(farm.act('workers','shift','chi',AT).ok,true);assert.equal(farm.progress.workers.find(w=>w.id==='chi').shiftUntil,until+WORK_DAY_MS);
});
test('worker permissions persist across a reload',()=>{
 const farm=fresh();farm.act('workers','hire','an',AT);
 farm.act('workers','permission',{id:'an',job:'water'},AT);assert.equal(farm.progress.workers[0].jobs.water,false);
 const restored=createFarm(farm.progress,null,()=>{},AT);
 assert.equal(restored.progress.workers[0].jobs.water,false);assert.deepEqual(restored.progress.dailyTasks,[]);
});
test('every asset respects its level cap and farm-level requirement',()=>{
 // Assets go to level 999 (café equipment stops at 10 seats); level N ≤ 10 needs farm level N.
 const saved=fresh().progress;saved.xp=100000;saved.coins=1e9;const farm=createFarm(saved,null,()=>{},AT);
 for(const asset of ASSETS){for(let i=1;i<10;i++)assert.equal(farm.act(asset.id,'upgrade',null,AT).ok,true,asset.id);assert.equal(farm.progress.upgrades[asset.id],10);}
 const cafeCoins=farm.progress.coins;assert.equal(farm.act('cafe','upgrade',null,AT).ok,false);assert.equal(farm.progress.coins,cafeCoins);assert.equal(assetMaxLevel(ASSETS.find(a=>a.id==='cafe')),10);
 assert.equal(farm.act('dryer','upgrade',null,AT).ok,true);assert.equal(farm.progress.upgrades.dryer,11);
 const poor=fresh();assert.equal(poor.act('dryer','upgrade',null,AT).ok,false,'level 2 needs farm level 2');
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

test('start-work pays one contract and starts useful autonomous work without a separate order',()=>{
 const farm=rich();farm.act('workers','hire','an',AT);const before=farm.progress.coins,price=contractPrice(farm.progress.workers[0]);
 assert.equal(farm.act('workers','startWork','an',AT).ok,true);
 let worker=farm.progress.workers[0];assert.equal(worker.farmId,'farm-0');assert.equal(worker.workMode,'auto');assert.equal(worker.enabled,true);assert.ok(worker.shiftUntil>AT);assert.equal(farm.progress.coins,before-price);
 assert.equal(farm.act('workers','startWork','an',AT).ok,true);assert.equal(farm.progress.coins,before-price,'a running contract is not charged again');
});
test('assign-and-start pays and assigns the whole team atomically',()=>{
 const farm=rich();farm.act('workers','hire','an',AT);farm.act('workers','hire','binh',AT);farm.act('workers','deploy','an',AT);farm.act('workers','deploy','binh',AT);
 farm.act('cafe','order','robusta',AT);const order=farm.progress.orders.find(o=>o.source==='cafe'),saved=farm.progress;saved.coins=15;
 const poor=createFarm(saved,null,()=>{},AT);
 assert.equal(poor.act('orders','startCrew',order.id,AT).ok,false);assert.equal(poor.progress.coins,15);assert.deepEqual(poor.progress.orders.find(o=>o.id===order.id).workers,[]);
 assert.equal(farm.act('orders','startCrew',order.id,AT).ok,true);assert.deepEqual(farm.progress.orders.find(o=>o.id===order.id).workers,['an','binh']);assert.ok(farm.progress.workers.every(w=>w.shiftUntil>AT&&w.enabled));
});

test('hired staff default to continuous work and never tire',()=>{
 const farm=rich();farm.act('workers','hire','an',AT);let worker=farm.progress.workers[0];
 assert.equal(worker.workMode,'auto');assert.equal(worker.autoPay,true);assert.equal(worker.farmId,'farm-0');
 const saved=farm.progress;saved.workers[0].energy=15;saved.workers[0].restUntil=AT+60000;
 const restored=createFarm(saved,null,()=>{},AT);worker=restored.progress.workers[0];
 assert.equal(worker.energy,100);assert.equal(worker.restUntil,0);assert.equal(restored.act('workers','overtime','an',AT).ok,false);
});

test('wages are paid per work day, stack from the expiry, and service time accrues',()=>{
 const farm=rich();farm.act('workers','hire','an',AT);const before=farm.progress.coins,price=contractPrice(farm.progress.workers[0]);
 assert.equal(farm.act('workers','shift','an',AT).ok,true);assert.equal(farm.progress.workers[0].shiftUntil,AT+WORK_DAY_MS);
 assert.equal(farm.act('workers','shift','an',AT+1000).ok,true);assert.equal(farm.progress.workers[0].shiftUntil,AT+2*WORK_DAY_MS);
 assert.equal(farm.progress.coins,before-2*price);farm.employmentTick('an',.1);assert.equal(farm.progress.workers[0].serviceMs,100);
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

test('saves from before the 03/11 cuts load without losing value',()=>{
 // Fish → coins at 8 each, queued farm-grinder input → roasted beans, reserve workers → hire fee back, asset levels clamp to 20.
 const saved=rich().progress,coins=saved.coins;
 saved.fish={count:5,readyAt:AT,fedUntil:AT};
 saved.machines.grinder={batch:{id:'g1',cropId:'robusta',quantity:2,inputGrams:168,outputGrams:168,startedAt:AT,readyAt:AT+10000,quality:80},extraBatches:[]};
 saved.workers=['an','binh','chi'].map((id,i)=>({id,name:id,xp:0,energy:40,restUntil:AT+9000,farmId:i<1?'farm-0':null,jobs:{},cargo:[],enabled:true,autoPay:true,shiftUntil:0}));
 saved.deploymentVersion=1;saved.upgrades.dryer=55;
 const roasted=saved.stock.roasted.robusta,farm=createFarm(saved,null,()=>{},AT),p=farm.progress;
 assert.equal(p.workers.length,2);assert.ok(p.workers.every(w=>w.farmId==='farm-0'&&w.energy===100&&w.restUntil===0));
 assert.equal(p.coins,coins+5*8+180,'fish sold + chi fee refunded');
 assert.equal(p.stock.roasted.robusta,roasted+168);assert.equal(p.upgrades.dryer,20);assert.equal(p.machines.grinder,undefined);
});
