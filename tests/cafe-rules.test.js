import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, FRESH_MS, freshFor, quickScore, stars, STAR_CAP, recipeById, resolveUses, ingredientBonus } from '../src/features/cafe/recipes.js';

test('quick brew: new drink ★★, best hand score carries over, ★★★ only after 90 by hand',()=>{
 assert.equal(quickScore(0),40);assert.equal(stars(quickScore(0)),1);assert.equal(quickScore(55),55);assert.equal(stars(quickScore(72)),2);
 assert.equal(quickScore(84),84);assert.equal(quickScore(97),90);assert.equal(stars(quickScore(97)),3);
 assert.equal(STAR_CAP.player,3);assert.equal(STAR_CAP.staff,2);assert.equal(STAR_CAP.robot,1);
});
test('cup freshness: iced drinks keep 90 s, hot drinks 60 s',()=>{
 const iced=RECIPES.find(r=>r.uses.ice),hot=RECIPES.find(r=>!r.uses.ice);
 assert.equal(freshFor(iced.id),FRESH_MS.iced);assert.equal(freshFor(hot.id),FRESH_MS.hot);assert.equal(freshFor('nope'),FRESH_MS.hot);
});
test('milk and water brands: the Pantry choice decides what a cup takes and its quality points',()=>{
 const latte=recipeById('latte'),matcha=recipeById('matcha');
 const cafe={prefs:{milk:'milk-meiji',water:'lavie'},supplies:{'milk-meiji':1000,'milk-dalat':1000,lavie:1500}};
 assert.deepEqual(resolveUses(latte.uses,cafe),{cup:1,'milk-meiji':200,lavie:40});
 assert.equal(ingredientBonus(latte,cafe),4+2);
 // Chosen milk ran out → the other brand; Lavie ran out → free tap water (−3).
 const short={prefs:{milk:'milk-meiji',water:'lavie'},supplies:{'milk-meiji':0,'milk-dalat':1000,lavie:0}};
 assert.deepEqual(resolveUses(latte.uses,short),{cup:1,'milk-dalat':200});
 assert.equal(ingredientBonus(latte,short),2-3);
 assert.equal(ingredientBonus(matcha,short),-3,'matcha has water, no milk');
 assert.equal(matcha.beans,0);assert.ok(recipeById('dirty')&&recipeById('matcha-latte'));
});

test('shift goal: +3 per hand; avg counts only own cups; no own cups = cups only (T1-T5)',async()=>{
 const{shiftGoal,shiftAvg,shiftMissed}=await import('../src/features/cafe/service.js');
 assert.equal(shiftGoal(3,3),16);
 assert.equal(shiftAvg({own:0,ownStars:0}),null);assert.equal(shiftAvg({own:5,ownStars:10}),2);
 assert.equal(shiftMissed({served:16,goal:16,own:5,ownStars:10},2),false);   // 5 own ★2 + 11 staff
 assert.equal(shiftMissed({served:23,goal:16,own:3,ownStars:3},1),true);     // own ★1 fails despite staff volume
 assert.equal(shiftMissed({served:16,goal:16,own:0,ownStars:0},null),false); // staff only, reaches bronze
 assert.equal(shiftMissed({served:11,goal:16,own:0,ownStars:0},null),true);
});
test('closing by hand sends waiting guests home calmly, same as the clock (D4)',async()=>{
 let clock=1_700_000_000_000;const realNow=Date.now;Date.now=()=>clock;
 try{
  const{createFarm}=await import('../src/features/farm/model.js');
  const{createCafeService}=await import('../src/features/cafe/service.js');
  const base=createFarm(null,'capital',()=>{},clock).progress;
  base.tutorial.seen.push('cafe-intro');base.stats.served=5;base.coins=1000;
  const farm=createFarm(base,null,()=>{},clock);farm.setCafeActive(true);
  let report=null;const svc=createCafeService(farm,{notice:()=>{},reward:()=>{},onShiftEnd:r=>{report=r;}});
  svc.toggleOpen();
  for(let i=0;i<4000&&svc.customers.filter(c=>!['drinking','leaving'].includes(c.phase)).length<3;i++){clock+=500;svc.update(.5,clock);farm.tick(clock);}
  const waiting=svc.customers.filter(c=>!['drinking','leaving'].includes(c.phase));
  assert.ok(waiting.length>=3);
  const rep0=farm.peek().cafe.reputation,lost0=farm.peek().cafe.lost;
  svc.toggleOpen();
  assert.equal(report.unserved,waiting.length);
  assert.ok(waiting.every(c=>c.phase==='leaving'&&c.mood==='👋'));
  assert.equal(farm.peek().cafe.lost,lost0);
  assert.equal(farm.peek().cafe.reputation,rep0+(report.rep||0));
  assert.equal(svc.abandon(),0);
 }finally{Date.now=realNow;}
});

test('carried cups: closing wastes them (BG-B5), resume() shifts their age, releaseJob keeps no stock after close',async()=>{
 const realNow=Date.now;let clock=1_700_000_000_000;Date.now=()=>clock;
 try{
  const{createFarm}=await import('../src/features/farm/model.js'),{createCafeService}=await import('../src/features/cafe/service.js');
  const base=createFarm(null,'capital',()=>{},clock).progress;base.tutorial.seen.push('cafe-intro');base.stats.served=5;base.coins=1000;
  const farm=createFarm(base,null,()=>{},clock);farm.setCafeActive(true);
  const svc=createCafeService(farm,{notice:()=>{},reward:()=>{}});
  const step=(sec,dt=.05,stop=()=>false)=>{for(let t=0;t<sec&&!stop();t+=dt){clock+=dt*1000;svc.update(dt,clock);}farm.tick(clock);};
  svc.toggleOpen();assert.equal(farm.act('cafe','hire','tuan').ok,true);svc.refresh();
  for(let i=0;i<600&&!svc.customers.some(c=>c.phase==='seated');i++){step(.5);svc.autoRegister();}
  const guest=svc.customers.find(c=>c.phase==='seated');
  svc.addDrink({recipeId:guest.recipeId,quality:80,stars:2,memory:false});svc.dropHand();
  const waiter=()=>svc.agents.find(a=>a.role==='waiter');
  step(30,.05,()=>Boolean(waiter()?.carry));
  const cup=waiter().carry;assert.ok(cup,'waiter carries a cup');
  const age=clock-cup.madeAt;svc.resume(60000);assert.equal(clock-cup.madeAt,age-60000);
  svc.toggleOpen();
  assert.equal(waiter().carry,null);assert.equal(svc.shelf.length,0);
 }finally{Date.now=realNow;}
});

test('serving a cup that completes a quest leads the toast with the quest (GP-A2)',async()=>{
 const realNow=Date.now;let clock=1_700_000_000_000;Date.now=()=>clock;
 try{
  const{createFarm}=await import('../src/features/farm/model.js'),{createCafeService}=await import('../src/features/cafe/service.js');
  const base=createFarm(null,'capital',()=>{},clock).progress;base.tutorial.seen.push('cafe-intro');base.coins=1000;
  const farm=createFarm(base,null,()=>{},clock);farm.setCafeActive(true);
  const msgs=[],svc=createCafeService(farm,{notice:m=>msgs.push(m),reward:()=>{}});
  svc.toggleOpen();
  for(let i=0;i<600&&!svc.customers.some(c=>c.phase==='seated');i++){clock+=500;svc.update(.5,clock);svc.autoRegister();}
  const guest=svc.customers.find(c=>c.phase==='seated');assert.ok(guest);
  svc.addDrink({recipeId:guest.recipeId,quality:80,stars:2,memory:false});svc.arriveTable(guest.seat.table);
  assert.ok(msgs.some(m=>m.startsWith('🎯')&&m.includes('Table 1:')),msgs.join(' | '));
 }finally{Date.now=realNow;}
});

// Auto cleans first when every free seat is dirty and guests are queueing (walk-out collapse at a maxed café, 04/11).
test('hasCleanSeat is false once every open seat is dirty',async()=>{
 const{createFarm}=await import('../src/features/farm/model.js'),{createCafeService}=await import('../src/features/cafe/service.js');
 const farm=createFarm(null,'capital',()=>{},1_700_000_000_000);const svc=createCafeService(farm,{notice:()=>{},reward:()=>{}});
 assert.equal(svc.hasCleanSeat(),true);
 for(let table=0;table<12;table++)for(let slot=0;slot<6;slot++)svc.dirty.add(`${table}:${slot}`);
 assert.equal(svc.hasCleanSeat(),false);
});

test('NEW-2: guest pace follows real brewing force',async()=>{
 const{shiftGoal,arrivalGap,brewForce}=await import('../src/features/cafe/service.js');
 const near=(a,b)=>assert.ok(Math.abs(a-b)<.01,`${a} != ${b}`);
 near(arrivalGap(0,0,50,3,0),20.2);near(arrivalGap(.6,.4,53,12,2),12);near(arrivalGap(3,1,53,12,2),3.636);
 for(const H of[0,.5,1,2,3,4])for(const C of[0,.3,.7,1])for(const rep of[10,50,100])for(const t of[3,8,12])for(const k of[0,1,2]){
  const g=arrivalGap(H,C,rep,t,k);
  assert.ok(g>=3&&g<=24&&g>=20*(1-C)-1e-9&&g>=20/(1+1.5*H)-1e-9);
  assert.ok(arrivalGap(H,C,rep,t+1,k)<=g+1e-9&&arrivalGap(H,C,rep,t,k+1)<=g+1e-9&&arrivalGap(H,C,rep+5,t,k)<=g+1e-9&&arrivalGap(H+.5,C,rep,t,k)<=g+1e-9);
 }
 const menu=['phin-den','nau-da','espresso','americano','a','b','c','d','e','f'],m={'phin-den':{best:2},'nau-da':{best:2}};
 assert.equal(brewForce([{mastery:3}],m,menu,1,false).H,0);
 near(brewForce([{mastery:2}],m,menu,1,false).H,.2);
 near(brewForce([{only:'phin-den'}],{},menu,1,false).H,.1);
 assert.equal(brewForce([],{},['phin-den'],1,true).H,0);
 near(brewForce([],{},menu,1,true).H,.2);
 near(brewForce([{mastery:2},{mastery:2}],m,menu,1,false).H,.2);
 assert.equal(shiftGoal(3,.6),9);assert.ok(Number.isInteger(shiftGoal(2,1/3)));
});
