import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarm } from '../src/features/farm/model.js';
import { PLOTS,FIELDS,MACHINES,QUESTS,plotCare } from '../src/features/farm/content.js';
import { activeJobs,jobGroupOf,groupLimit,ASSETS,workerLevel,workerWage,SEASON_MS,WORK_DAY_MS,DAY_MS,contractPrice,assetMaxLevel,supplierPrice,SUPPLIER_PRICE } from '../src/features/farm/rules.js';
import { productionNeed } from '../src/features/farm/orders.js';
import { editDragSelection } from '../src/features/farm/tools.js';
import { findRoute } from '../src/shared/game/navigation.js';
import { slackChance,slackReason,tiredFactor,rollSlack } from '../src/shared/game/morale.js';
import { pickAutoErrand } from '../src/features/farm/autoplay.js';
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
test('hiring is capped at three farm workers and wages rise with level',()=>{
 // Shift hiring: hires go straight to the farm (no reserve bench); day wage D = 30 + 10 × (level − 1), one work day per payment, stacking.
 const farm=rich();for(const id of ['an','binh','dung'])assert.equal(farm.act('workers','hire',id,AT).ok,true);
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
 // Fish → coins at 8 each, queued farm-grinder input → roasted beans, reserve workers fill the 3 slots, asset levels clamp to 20.
 const saved=rich().progress,coins=saved.coins;
 saved.fish={count:5,readyAt:AT,fedUntil:AT};
 saved.machines.grinder={batch:{id:'g1',cropId:'robusta',quantity:2,inputGrams:168,outputGrams:168,startedAt:AT,readyAt:AT+10000,quality:80},extraBatches:[]};
 saved.workers=['an','binh','chi'].map((id,i)=>({id,name:id,xp:0,energy:40,restUntil:AT+9000,farmId:i<1?'farm-0':null,jobs:{},cargo:[],enabled:true,autoPay:true,shiftUntil:0}));
 saved.deploymentVersion=1;saved.upgrades.dryer=55;
 const roasted=saved.stock.roasted.robusta,farm=createFarm(saved,null,()=>{},AT),p=farm.progress;
 assert.equal(p.workers.length,3,'three slots: nobody is dropped');assert.ok(p.workers.every(w=>w.farmId==='farm-0'&&w.energy===100&&w.restUntil===0));
 assert.equal(p.coins,coins+5*8,'fish sold, no fee refunded');
 assert.equal(p.stock.roasted.robusta,roasted+168);assert.equal(p.upgrades.dryer,20);assert.equal(p.machines.grinder,undefined);
});

test('crew slots: three hires cover care, processing and delivery; robots do one job; people multitask by level',()=>{
 const farm=rich();
 for(const id of ['an','robo-n1','robo-n2'])assert.equal(farm.act('workers','hire',{id,pack:1},AT).ok,true);
 const [an,r1,r2]=farm.progress.workers;
 assert.deepEqual([...activeJobs(an)].map(jobGroupOf).filter((g,i,a)=>a.indexOf(g)===i),['care']);
 assert.equal(activeJobs(r1).size,1);assert.equal(activeJobs(r2).size,1);assert.notEqual([...activeJobs(r1)][0],[...activeJobs(r2)][0]);
 // Level 1 person: a second area is refused; robot: turning a job on turns the other off.
 assert.equal(farm.act('workers','permission',{id:'an',job:'processing'},AT).ok,false);
 assert.equal(farm.act('workers','permission',{id:'robo-n1',job:'weed'},AT).ok,true);
 assert.deepEqual([...activeJobs(farm.progress.workers[1])],['weed']);
 assert.equal(groupLimit({kind:'human',xp:0}),1);assert.equal(groupLimit({kind:'human',xp:900}),2);assert.equal(groupLimit({kind:'human',xp:3600}),3);
});
test('morale: slack odds stay in [0, 0.6] and tired people work slower',()=>{
 assert.equal(slackChance(100,'diligent',false),.02);assert.ok(Math.abs(slackChance(0,'lazy',true)-.6)<1e-9);
 assert.equal(slackReason(20,true),'tired');assert.equal(slackReason(80,true),'dislike');assert.equal(slackReason(80,false),'lazy');
 assert.equal(tiredFactor(100),1);assert.ok(Math.abs(tiredFactor(0)-1.4)<1e-9);
 assert.equal(rollSlack(100,'normal',false,()=>.99),null);assert.deepEqual(rollSlack(10,'normal',false,()=>0),{reason:'tired',ms:10000});
});
test('auto errands: ship a ready café order first, buy seeds only when plots are empty and none are left',()=>{
 const p=JSON.parse(JSON.stringify(rich().progress));
 p.orders=[{id:'o1',source:'cafe',status:'open',cropId:'robusta',grams:252,workers:[]}];p.stock.roasted.robusta=300;p.coins=50;
 assert.equal(pickAutoErrand(p,{regionKind:'both',level:1})?.action,'shipOrder');
 p.orders=[];p.order={...p.order,product:'cherries',quantity:1e9};p.cafe.stock.roasted={robusta:0};
 assert.equal(pickAutoErrand(p,{regionKind:'both',level:1})?.action,'ship','café low on beans: send roasted beans');
 assert.equal(pickAutoErrand(p,{regionKind:'farm',level:1})?.action,'sell','farm-only region sells instead');
 p.stock.roasted.robusta=0;for(const c of Object.keys(p.seeds))p.seeds[c]=0;p.plots.forEach((t,i)=>{if(i<3){t.unlocked=true;t.stage='empty';}});
 const buy=pickAutoErrand(p,{regionKind:'both',level:1});
 assert.equal(buy?.action,'buySeed');assert.ok(buy.choice.quantity>=1&&buy.choice.quantity<=3);
 p.coins=20;assert.equal(pickAutoErrand(p,{regionKind:'both',level:1}),null,'keeps 20 coins in hand');
});
test('auto errands keep roasted beans for open orders and send only the spare 100 g+',()=>{
 const p=JSON.parse(JSON.stringify(rich().progress));p.coins=50;p.order={...p.order,product:'cherries',quantity:1e9};p.cafe.stock.roasted={robusta:0};
 p.orders=[{id:'o1',source:'cafe',status:'open',cropId:'robusta',grams:252,workers:[]}];p.stock.roasted.robusta=300;
 assert.equal(pickAutoErrand(p,{regionKind:'both',level:1})?.action,'shipOrder');
 p.stock.roasted.robusta=251;assert.equal(pickAutoErrand(p,{regionKind:'both',level:1}),null,'251 g < 252 g order: keep all');
 p.stock.roasted.robusta=400;const ship=pickAutoErrand(p,{regionKind:'both',level:1});assert.equal(ship.action,'shipOrder');
 p.stock.roasted.robusta=1150;p.orders[0].grams=1000;const skipOrder={regionKind:'farm',level:1,skip:k=>k==='shipOrder'};
 assert.deepEqual(pickAutoErrand(p,skipOrder).choice,{item:'roasted:robusta',grams:150},'only the 150 g above the 1000 g order is sold');
 assert.equal(pickAutoErrand(p,{...skipOrder,regionKind:'both'}).choice.grams,150);
 p.stock.roasted.robusta=1050;assert.equal(pickAutoErrand(p,skipOrder),null,'50 g spare is below 100 g');
});
test('ship with grams ships only that part',()=>{
 const farm=withLots([{product:'roasted',cropId:'robusta',grams:500,target:'farm'}]);
 const r=farm.act('cafe','ship',{cropId:'robusta',grams:150},AT);assert.equal(r.ok,true,r.message);assert.equal(farm.peek().stock.roasted.robusta,350);
});
test('old saves: a level-1 person with every job on keeps only one job area, a robot only one job',()=>{
 const saved=rich().progress;
 saved.workers=[{id:'an',name:'An',xp:0,farmId:'farm-0',jobs:{},cargo:[],enabled:true,autoPay:true,shiftUntil:0},{id:'robo-n1',name:'Robot',xp:0,farmId:'farm-0',jobs:{},cargo:[],enabled:true,autoPay:true,shiftUntil:0}];
 const [an,robot]=createFarm(saved,null,()=>{},AT).progress.workers;
 assert.deepEqual(Object.entries(an.jobs).filter(([,on])=>on).map(([id])=>jobGroupOf(id)).filter((g,i,a)=>a.indexOf(g)===i),['care']);
 assert.equal(Object.values(robot.jobs).filter(Boolean).length,1);
});

test('Auto pha (demo) cups never raise mastery, hand cups do',()=>{
 const farm=fresh(),best=()=>farm.progress.cafe.mastery['phin-den']?.best||0,before=best();
 assert.equal(farm.act('cafe','brew',{recipeId:'phin-den',cropId:'robusta',score:80,demo:true},AT).ok,true);assert.equal(best(),before);
 assert.equal(farm.act('cafe','brew',{recipeId:'phin-den',cropId:'robusta',score:75},AT).ok,true);assert.equal(best(),Math.max(before,75));
});
// Regression (audit 04/11, EC-2): a comment once swallowed the per-cup reputation update.
test('each sold cup moves café reputation by (stars − 1) × 0.6',()=>{
 const farm=fresh(),rep=()=>farm.progress.cafe.reputation,start=rep();
 assert.equal(farm.act('cafe','sell',{recipeId:'phin-den',quality:80,stars:3,wait:0},AT).ok,true);assert.ok(Math.abs(rep()-(start+1.2))<1e-9);
 assert.equal(farm.act('cafe','sell',{recipeId:'phin-den',quality:20,stars:0,wait:1},AT).ok,true);assert.ok(Math.abs(rep()-(start+.6))<1e-9);
});

test('a heaven gift the region cannot use becomes the capital purse',()=>{
 const coins=(gift,region)=>createFarm(null,gift,()=>{},AT,[],region).progress.coins;
 assert.equal(coins('seeds','it'),coins('capital','it'));
 assert.equal(coins('tools','ke'),coins('capital','ke'));
 assert.ok(coins('seeds','vn')<coins('capital','vn'));
 const farm=createFarm(null,'seeds',()=>{},AT,[],'it');assert.ok(farm.progress.ledger.some(l=>l.type==='gift'&&l.amount===150),'swap goes through the ledger');
});

test('shop orders cap at 2 per work day and reopen next day',()=>{
 const farm=fresh();farm.peek().stock[farm.peek().order.product][farm.peek().order.cropId]=9999;
 for(let i=0;i<2;i++){const r=farm.act('market','order',null,AT);assert.equal(r.ok,true,r.message);farm.peek().stock[farm.peek().order.product][farm.peek().order.cropId]=9999;}
 const coins=farm.peek().coins,r3=farm.act('market','order',null,AT);assert.equal(r3.ok,false);assert.equal(farm.peek().coins,coins);
 farm.peek().stock[farm.peek().order.product][farm.peek().order.cropId]=9999;const r4=farm.act('market','order',null,AT+WORK_DAY_MS);assert.equal(r4.ok,true,r4.message);
});
test('coins above 1e12 survive loading',()=>{const saved=fresh().progress;saved.coins=9999999999999;assert.equal(createFarm(saved,null,()=>{},AT).progress.coins,9999999999999);});
test('relief beans: café-only, broke, empty, once per work day',()=>{
 const mk=(region,coins)=>{const s=fresh().progress;s.region=region;s.coins=coins;s.cafe.lots=[];return createFarm(s,null,()=>{},AT);};
 const farm=mk('it',10);assert.equal(farm.reliefReady(AT),true);
 const r=farm.act('cafe','relief',null,AT);assert.equal(r.ok,true,r.message);
 assert.equal(farm.peek().cafe.lots.filter(l=>l.origin==='relief').reduce((s,l)=>s+l.grams,0),300);assert.equal(farm.peek().coins,10);
 farm.peek().cafe.lots=[];assert.equal(farm.act('cafe','relief',null,AT).ok,false);
 assert.equal(mk('vn',10).act('cafe','relief',null,AT).ok,false);assert.equal(mk('it',75).act('cafe','relief',null,AT).ok,false);
});
test('worker role rejects unknown values',()=>{
 const farm=rich();farm.act('workers','hire','an',AT);const w=farm.progress.workers[0];
 assert.equal(farm.act('workers','role',{id:w.id,role:'boss'},AT).ok,false);
});

test('a device clock that runs back keeps timers, day and weather (BG-B1)',()=>{
 const T=AT+30*DAY_MS,saved=fresh().progress;saved.lots=[{id:'f0',product:'cherries',cropId:'robusta',grams:36000,quality:80,createdAt:AT,origin:'fixture'}];
 const ahead=createFarm(saved,null,()=>{},T);assert.equal(ahead.act('dryer','start',{cropId:'robusta',quantity:60},T).ok,true);
 const job=ahead.progress.machines.dryer.batch,span=job.readyAt-T,day=ahead.weather.day;
 const back=createFarm(ahead.progress,null,()=>{},AT),b=back.progress.machines.dryer.batch;
 assert.equal(b.readyAt-AT,span);assert.equal(b.startedAt,AT);assert.equal(back.weather.day,day);assert.equal(back.progress.lastAt,AT);
 ahead.tick(T+1000);ahead.tick(T-5*DAY_MS);assert.equal(ahead.progress.machines.dryer.batch.readyAt-ahead.progress.lastAt,span-1000,'in-session rollback shifts too');
});
test('offline rain counts only the seconds it really rained (BG-B6)',()=>{
 const gain=end=>{const s=fresh().progress;s.reservoir=0;s.lastAt=end-30000;const f=createFarm(s,null,()=>{},end-30000);f.tick(end);return f.progress.reservoir;};
 const dry=gain(AT+3*DAY_MS),half=gain(AT+3*DAY_MS+15000),wet=gain(AT+3*DAY_MS+30000);
 assert.ok(dry<half&&half<wet);assert.ok(Math.abs((half-dry)*2-(wet-dry))<1e-6);
});
test('canceling a queued batch closes the gap behind it (BG-B7)',()=>{
 const farm=withLots([{product:'cherries',cropId:'robusta',grams:72000}]);farm.act('dryer','start',{cropId:'robusta',quantity:120},AT);
 const st=farm.progress.machines.dryer;assert.ok(st.extraBatches.length>=2);const [mid,last]=st.extraBatches,dur=last.readyAt-last.startedAt;
 assert.equal(farm.act('dryer','cancel',mid.id,AT).ok,true);
 const run=farm.progress.machines.dryer.batch,next=farm.progress.machines.dryer.extraBatches[0];
 assert.equal(next.id,last.id);assert.equal(next.startedAt,run.readyAt);assert.equal(next.readyAt,run.readyAt+dur);
});
test('deferring a lesson counts as asked today without result (GP-B2)',()=>{
 const farm=fresh(),q=farm.pendingLesson().question.id,coins=farm.progress.coins;
 assert.equal(farm.act('lessons','defer',{questionId:q},AT).ok,true);const L=farm.progress.lessons;
 assert.equal(L.asked[q],undefined);assert.equal(L.learned.includes(q),false);assert.equal(farm.progress.coins,coins);assert.equal(L.askedCount,1);
 assert.equal(farm.act('lessons','defer',{questionId:q},AT).ok,false);
});

test('supplier price is cheaper in café-only regions and the supply action charges it (EC-3)',()=>{
 assert.equal(supplierPrice('it'),45);assert.equal(supplierPrice('vn'),SUPPLIER_PRICE);
 const f=createFarm({...fresh().progress,region:'it'},null,()=>{},AT),c0=f.progress.coins;
 assert.equal(f.act('cafe','supply',null,AT).ok,true);assert.equal(c0-f.progress.coins,45);
});
