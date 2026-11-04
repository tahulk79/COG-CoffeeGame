import { DECORATIONS,decorationError } from './decorations.js';
import { CROPS,FIELDS,PLOTS,MACHINES,PRODUCTS,QUESTS,CARE,TUTORIAL_IDS,HUD_UNLOCKS,plotCare,cropById,productById,levelFor } from './content.js';
import { EXPERTS } from '../heaven/content.js';
import { answerText } from '../heaven/journey.js';
import { OWN_CUP,SHIFT_TIERS,SUPPLIES,GEAR,MAX_CREW,STAFF_MAX,TABLE_LEVELS,MAX_TABLES,staffWage,trainCost,roleOf,candidateById,recipeById,missingFor,gearBonus } from '../cafe/recipes.js';
import { DAY_MS,SEASON_MS,OFFLINE_MS,CAFE_SHIFT_MS,FERTILIZER_PRICE,SUPPLIER_PRICE,ASSETS,assetMaxLevel,upgradeRequirement,capacityScale,efficiency,upgradePrice,assetValue,WORKER_CANDIDATES,workerLevel,workerStat,WORKER_JOBS,workerWage,formatMass,WORK_DAY_MS,contractPlan,contractPrice,marketValue,ROBOT_PACKS,packPrice,INCIDENTS,incidentOdds } from './rules.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const integer=(n,max=1e12)=>Math.floor(clamp(finite(n),0,max));
const clone=value=>structuredClone(value);
// Saved arrays may hold null/number junk from a damaged save; keep only object entries.
const objects=list=>Array.isArray(list)?list.filter(x=>x&&typeof x==='object'):[];
const emptyStock=()=>Object.fromEntries(PRODUCTS.map(p=>[p.id,Object.fromEntries(CROPS.map(c=>[c.id,0]))]));
const jobsOf=state=>[...(state.batch?[state.batch]:[]),...state.extraBatches];
const putJobs=(state,jobs)=>{jobs.sort((a,b)=>a.readyAt-b.readyAt);state.batch=jobs[0]||null;state.extraBatches=jobs.slice(1);};
// Heaven lessons: one perk per heaven question (onboarding-flow.md 3.1/4.1). Questions and answers come only from heaven/content.js.
const QUESTION_IDS=EXPERTS.flatMap(e=>e.questions.map(q=>q.id));
const lessonIds=list=>Array.isArray(list)?QUESTION_IDS.filter(id=>list.includes(id)):[];
const lessonOf=id=>{const expert=EXPERTS.find(e=>e.questions.some(q=>q.id===id));return expert?{expert,question:expert.questions.find(q=>q.id===id)}:null;};
export const LESSON_PERKS=Object.fromEntries(EXPERTS.flatMap(e=>e.questions.map(q=>[q.id,q.perk])));
const tutorialId=id=>TUTORIAL_IDS.includes(id)||typeof id==='string'&&/^unlock-[a-z-]+$/.test(id);
// Robots vs people (robot-staff.md, contracts.md 6). Robot traits always come from the candidate lists, never the save.
const isRobot=w=>WORKER_CANDIDATES.find(c=>c.id===w?.id)?.kind==='robot';
const canDo=(w,job)=>{const jobs=WORKER_CANDIDATES.find(c=>c.id===w.id)?.jobs;return !jobs||jobs.includes(job);};
const idOf=choice=>choice&&typeof choice==='object'?choice.id:choice;
const incidentOf=(i,types)=>i&&typeof i==='object'&&Number.isFinite(i.for)?{for:integer(i.for),type:types.includes(i.type)?i.type:'none',due:Math.max(0,finite(i.due)),done:i.done===true}:null;
// One roll per paid shift; due = ms left in the shift when it fires (sick fires as soon as the paid shift starts).
function rollIncident(count,length,odds){const u=Math.random(),type=u<odds.sick?'sick':u<odds.sick+odds.phone?'phone':u<odds.sick+odds.phone+odds.rude?'rude':'none';return {for:count,type,due:type==='sick'?length:Math.round(length*(.2+.6*Math.random())),done:type==='none'};}
const sickNow=(w,at)=>w.incident?.type==='sick'&&w.incident.done&&w.restUntil>at;
const GIFT_RECIPES=['phin-den','nau-da'],GIFT_CUPS=10;

export function createFarm(saved,startingGift,onSave,now=Date.now(),heavenLessons=[]) {
  const modern=saved?.version===3,legacy=saved?.version===2,valid=modern||legacy||saved?.version===1;
  const owned=Array.isArray(saved?.fields)?saved.fields.filter(id=>FIELDS.some(f=>f.id===id)):['field-0'];
  if(!owned.includes('field-0'))owned.unshift('field-0');
  const stock=emptyStock();
  for(const p of PRODUCTS)for(const c of CROPS)stock[p.id][c.id]=integer(saved?.stock?.[p.id]?.[c.id])*(modern?1:100);
  if(saved?.version===1){stock.cherries.robusta=integer(saved.cherries)*100;stock.roasted.robusta=integer(saved.beans)*100;}
  // Previously removed hulling stock stays usable as clean beans; never discard owned inventory.
  if(legacy)for(const c of CROPS)stock.dried[c.id]+=(integer(saved.stock?.green?.[c.id])+jobsOf({batch:saved.machines?.huller?.batch||null,extraBatches:objects(saved.machines?.huller?.extraBatches)}).filter(j=>j.cropId===c.id).reduce((sum,j)=>sum+integer(j.quantity),0))*100;
  const upgrades=Object.fromEntries(ASSETS.map(a=>[a.id,clamp(integer(modern?saved.upgrades?.[a.id]:a.id==='well'?saved?.canLevel:saved?.machines?.[a.id]?.level),1,assetMaxLevel(a))]));
  // Missing/corrupt lessons start empty; correct heaven answers are merged on every load (a replayed chapter only adds).
  const savedLessons=saved?.lessons&&typeof saved.lessons==='object'?saved.lessons:{};
  const lessons={
    learned:lessonIds([...(Array.isArray(savedLessons.learned)?savedLessons.learned:[]),...(Array.isArray(heavenLessons)?heavenLessons:[])]),
    granted:lessonIds(savedLessons.granted),
    asked:Object.fromEntries(QUESTION_IDS.filter(id=>Number.isSafeInteger(savedLessons.asked?.[id])).map(id=>[id,savedLessons.asked[id]])),
    askedDay:Number.isSafeInteger(savedLessons.askedDay)?savedLessons.askedDay:-1,askedCount:integer(savedLessons.askedCount,99),
  };
  const progress={
    lessons,tutorial:{seen:Array.isArray(saved?.tutorial?.seen)?saved.tutorial.seen.filter((id,i,list)=>tutorialId(id)&&list.indexOf(id)===i).slice(0,100):[]},
    decorations:objects(saved?.decorations).filter(item=>DECORATIONS.some(spec=>spec.id===item.type)&&[item.x,item.z,item.rotation].every(Number.isFinite)).slice(0,100).map(item=>({...item,text:String(item.text||'').slice(0,24),state:item.state==='construction'?'construction':'complete',buildMs:Math.max(0,Number(item.buildMs)||0),buildDuration:Math.max(1000,Number(item.buildDuration)||5000)})),
    staffRoutineVersion:1,workRevision:integer(saved?.workRevision),version:3,timingVersion:3,deploymentVersion:1,gift:saved?.gift||startingGift||null,fields:owned,archivedLand:clone(saved?.archivedLand||{fields:[],plots:[]}),
    coins:saved?Math.round(clamp(finite(saved.coins,200),0,1e12)*100)/100:200,giftApplied:saved?.giftApplied===true,xp:integer(saved?.xp),upgrades,
    seeds:Object.fromEntries(CROPS.map(c=>[c.id,integer(legacy||modern?saved.seeds?.[c.id]:c.id==='robusta'?(saved?.version===1?integer(saved.seeds):6):0)])),
    fertilizer:valid?integer(saved.fertilizer):6,water:valid?Math.min(integer(saved.water),6+4*(upgrades.well-1)+2*lessons.learned.includes('water')):6+2*lessons.learned.includes('water'),canLevel:upgrades.well,
    legacyBackup:modern?(saved.legacyBackup||null):valid?clone(saved):null,
    stock,lots:modern?clone(objects(saved.lots)):[],sequence:integer(saved?.sequence),
    stats:Object.fromEntries(['harvested','watered','weeded','dried','roasted','ground','sold','expanded','orders','delivered','served'].map(k=>[k,integer(saved?.stats?.[k])])),
    claimed:Array.isArray(saved?.claimed)?saved.claimed.filter(id=>QUESTS.some(q=>q.id===id)):[],
    orderIndex:integer(saved?.orderIndex),order:null,lastAt:Math.min(now,finite(saved?.lastAt,now)),epoch:finite(saved?.epoch,now),
    reservoir:modern?clamp(finite(saved.reservoir,60),0,10000):60,durability:modern?clamp(finite(saved.durability,100),0,100):100,
    rejectedCandidates:Array.isArray(saved?.rejectedCandidates)?saved.rejectedCandidates.filter(id=>WORKER_CANDIDATES.some(w=>w.id===id&&w.kind!=='robot')):[],
    // restUntil survives a reload only while the worker is on a fired sick incident (otherwise reload would cure them after shiftUntil moved).
    workers:modern?objects(saved.workers).filter(w=>WORKER_CANDIDATES.some(c=>c.id===w.id)).map((w,index)=>{const c=WORKER_CANDIDATES.find(c=>c.id===w.id),incident=incidentOf(w.incident,['none','phone','sick']);return {...clone(w),kind:c.kind||'human',incident,stats:clone(c.stats),farmId:saved.deploymentVersion===1?(w.farmId==='farm-0'?'farm-0':null):index<2?'farm-0':null,xp:c.kind==='robot'?0:integer(w.xp),enabled:w.enabled!==false,energy:100,restUntil:incident?.type==='sick'&&incident.done?finite(w.restUntil):0,role:['auto','care','processing'].includes(w.role)?w.role:'auto'};}):[],
    cafe:modern&&saved.cafe&&typeof saved.cafe==='object'&&!Array.isArray(saved.cafe)?clone(saved.cafe):{stock:emptyStock(),lots:[],shipments:[],open:false,reputation:50,served:0,lost:0,revenue:0,costs:0,autoSupply:true,reserve:false},
    today:saved?.today?clone(saved.today):{day:0,harvested:0,processed:0,revenue:0},
    market:{day:finite(saved?.market?.day,-1),sold:Math.max(0,finite(saved?.market?.sold))},
    orders:modern?clone(objects(saved.orders)):[],dailyTasks:[],lastOrderDay:modern?integer(saved.lastOrderDay):0,lastTaskCycle:modern?integer(saved.lastTaskCycle):0,contractVersion:1,
    // Farm-wide standing orders for staff; work no longer depends on a café order existing.
    directives:{care:saved?.directives?.care!==false,plant:saved?.directives?.plant!==false,plantCrop:cropById(saved?.directives?.plantCrop)?.id||'robusta',process:saved?.directives?.process!==false,fertilize:saved?.directives?.fertilize!==false},
    journal:clone(objects(saved?.journal)).slice(-60),reputation:clamp(finite(saved?.reputation,50),0,100),
    ledger:modern?objects(saved.ledger).slice(-60):[],offline:null,
    plots:PLOTS.map((config,index)=>{
      const src=objects(saved?.plots).find(p=>p.id===config.id)||null;
      const stage=['empty','planted','growing','ready'].includes(src?.stage||src?.state)?(src.stage||src.state):!valid&&index<8?(index<4?'ready':'growing'):'empty';
      const crop=cropById(src?.cropId)||CROPS[0],mature=src?.mature===true||stage==='ready'||(!valid&&index<8);
      const oldTotal=mature?45000:60000;
      return {id:config.id,unlocked:owned.includes(config.fieldId),cropId:crop.id,stage,mature,
        growthMs:modern?clamp(finite(src?.growthMs)*(saved.timingVersion===3?1:saved.timingVersion===2?(mature?2:1):(mature?crop.regrowMs:crop.growMs)/8640000),0,mature?crop.regrowMs:crop.growMs):src?clamp(finite(src.growthMs)/oldTotal,0,1)*(mature?crop.regrowMs:crop.growMs):stage==='growing'?SEASON_MS*.8:0,
        water:src?clamp(finite(src.water,65),0,100):65,weeds:clamp(finite(src?.weeds),0,100),fertilized:src?.fertilized===true,
        readyYield:stage==='ready'?(modern?integer(src?.readyYield)||crop.yield:crop.yield):0,
        remainingFruit:modern?integer(src?.remainingFruit):0,secondPick:modern?integer(src?.secondPick):0,quality:clamp(finite(src?.quality,80),0,100),health:clamp(finite(src?.health,100),20,100),
        pruned:modern?src?.pruned===true:false,season:integer(src?.season),lastAt:now};
    }),
    machines:Object.fromEntries(MACHINES.map(m=>{
      const src=saved?.machines?.[m.id];
      const jobs=src?jobsOf({batch:src.batch||null,extraBatches:objects(src.extraBatches)}).filter(j=>cropById(j.cropId)&&j.readyAt>0).map(j=>({...clone(j),id:j.id||`legacy-${m.id}-${++savedSequence}`,quantity:integer(j.quantity),outputGrams:modern?integer(j.outputGrams):integer(j.quantity)*100,startedAt:finite(j.startedAt,now),readyAt:finite(j.readyAt,now),quality:clamp(finite(j.quality,80),0,100)})):[];
      const state={level:upgrades[m.id],batch:null,extraBatches:[]};putJobs(state,jobs);return[m.id,state];
    })),
  };
  if(modern&&!saved.timingVersion)for(const m of MACHINES){const state=progress.machines[m.id],jobs=jobsOf(state);let cursor=now;for(const j of jobs){if(j.readyAt<=now)continue;const ratio=j.startedAt<=now?clamp((now-j.startedAt)/Math.max(1,j.readyAt-j.startedAt),0,1):0,duration=m.duration/efficiency(state.level);j.startedAt=cursor-ratio*duration;j.readyAt=j.startedAt+duration;cursor=j.readyAt;}putJobs(state,jobs);}
  progress.cafe.shipments=objects(progress.cafe.shipments).filter(t=>Array.isArray(t.lots)&&Number.isFinite(t.readyAt));
  {
    // Customers live in the cafe scene session; only stock, gear, staff and mastery persist.
    const cafe=progress.cafe;delete cafe.customers;delete cafe.brew;delete cafe.extraBrews;delete cafe.nextCustomerAt;
    cafe.reputation=clamp(finite(cafe.reputation,50),10,100);
    cafe.supplies=Object.fromEntries(SUPPLIES.map(s=>[s.id,integer(cafe.supplies?cafe.supplies[s.id]:s.start,1e7)]));
    cafe.gear=Object.fromEntries(GEAR.map(g=>[g.id,clamp(integer(cafe.gear?.[g.id]??g.start),g.start,g.prices.length)]));
    // Crew is a list of hired candidates (max 10); older saves stored one person per role.
    const legacyCrew=Object.entries(cafe.staff||{}).map(([role,s])=>({...s,id:{cashier:'mai',waiter:'tuan',barista:'khoa'}[role]}));
    // Draft saves (before round 2) stored the gift barista as robo-pha and the gift waiter as robo-b* with gift:true.
    const renamed=m=>m?.id==='robo-pha'?{...m,id:'gift-pha',gift:true}:m?.gift===true&&/^robo-b/.test(m.id)?{...m,id:'gift-bung'}:m;
    let hired=0; // gift members do not count toward MAX_CREW
    cafe.crew=(Array.isArray(cafe.crew)?cafe.crew:legacyCrew).map(renamed).filter((m,i,list)=>candidateById(m?.id)&&list.findIndex(o=>o.id===m.id)===i&&(m.gift===true||++hired<=MAX_CREW)).map(m=>({id:m.id,level:clamp(integer(m.level),1,STAFF_MAX),paidUntil:finite(m.paidUntil),shifts:integer(m.shifts),incident:incidentOf(m.incident,['none','phone','sick','rude']),rest:clamp(finite(m.rest),0,CAFE_SHIFT_MS),gift:m.gift===true}));
    delete cafe.staff;
    cafe.tables=Array.from({length:MAX_TABLES},(_,i)=>clamp(integer(cafe.tables?.[i]),1,TABLE_LEVELS.length));
    cafe.mastery=Object.fromEntries(Object.entries(cafe.mastery||{}).filter(([id])=>recipeById(id)).map(([id,m])=>[id,{best:clamp(finite(m?.best),0,100),made:integer(m?.made)}]));
    // One-time robot trial gift. Unknown state → done (never granted twice); a ready/active gift with no gift crew left is over.
    const g=saved?.robotGift,tallyOf=(t,robot)=>({cups:integer(t?.cups),stars:Math.max(0,finite(t?.stars)),paid:Math.max(0,finite(t?.paid)),cost:Math.max(0,finite(t?.cost)),...(robot?{walked:integer(t?.walked)}:{})});
    progress.robotGift=g&&typeof g==='object'?{state:['locked','ready','active','done'].includes(g.state)?g.state:'done',cups:clamp(integer(g.cups),0,GIFT_CUPS),walkRep:clamp(finite(g.walkRep),0,2),reported:g.reported===true,tally:g.state!=='locked'||g.tally&&typeof g.tally==='object'?{you:tallyOf(g.tally?.you),robot:tallyOf(g.tally?.robot,true)}:null}:{state:'locked',cups:0,walkRep:0,reported:false,tally:null};
    if(['ready','active'].includes(progress.robotGift.state)&&!cafe.crew.some(m=>m.gift))progress.robotGift.state='done';
  }
  // Farm keeps at most one robot (first in saved order); prepaid packs are not refunded, robot fee is 0.
  const extraRobots=progress.workers.filter(w=>w.kind==='robot').slice(1);progress.workers=progress.workers.filter(w=>!extraRobots.includes(w));
  let deployed=0;for(const worker of progress.workers){if(worker.farmId==='farm-0'&&++deployed>2)worker.farmId=null;if(saved.staffRoutineVersion!==1){worker.autoPay=true;worker.workMode='auto';}if(saved.contractVersion!==1&&finite(worker.shiftUntil)>now)worker.shiftUntil=now+WORK_DAY_MS;worker.contractPlan=contractPlan(worker).id;worker.autoPay=worker.autoPay===true;worker.workMode=worker.workMode==='auto'?'auto':'assigned';worker.jobs=Object.fromEntries(WORKER_JOBS.map(([id])=>[id,worker.jobs?.[id]!==false&&canDo(worker,id)]));worker.preferredCrop=cropById(worker.preferredCrop)?.id||'robusta';worker.cargo=Array.isArray(worker.cargo)?worker.cargo:[];worker.water=integer(worker.water,42);worker.shiftUntil=finite(worker.shiftUntil);worker.restUntil=finite(worker.restUntil);worker.health=clamp(finite(worker.health,100),20,100);}
  // Prepaid contract: extends from now or from the current end, whichever is later.
  // Robots buy prepaid packs (1/5/10 work days); people pay one day and roll that day's incident. A sick worker stays sick.
  const shiftPrice=(w,pack=1)=>isRobot(w)?packPrice(workerWage(w),pack):contractPrice(w);
  function signContract(w,at,pack=1){
    const robot=isRobot(w),days=robot?pack:contractPlan(w).days;money(-shiftPrice(w,pack),'wage',at,w.name);w.shiftUntil=Math.max(w.shiftUntil,at)+days*WORK_DAY_MS;w.paidDays=(w.paidDays||0)+days;
    if(sickNow(w,at))return;w.restUntil=0;if(!robot)w.incident=rollIncident(w.paidDays,WORK_DAY_MS,incidentOdds(workerLevel(w.xp),INCIDENTS.kFarm));
  }
  // A café member paid a new shift: count it and roll its incident (people only; rude only for cashier/waiter, halved by an on-shift manager).
  function cafeShiftPaid(s,at){
    s.shifts++;if(candidateById(s.id).kind==='robot')return;
    const role=roleOf(s.id).id,manager=progress.cafe.crew.some(m=>m!==s&&roleOf(m.id)?.id==='manager'&&m.paidUntil>at&&!m.rest);
    s.incident=rollIncident(s.shifts,CAFE_SHIFT_MS,incidentOdds(s.level,INCIDENTS.kCafe,manager,['cashier','waiter'].includes(role)));
  }
  const workersOpen=()=>HUD_UNLOCKS.find(u=>u.id==='workers').when(progress,levelFor(progress.xp));
  // Robot trial gift (robot-staff.md 5): once, as soon as the Staff button opens. State is written before any goods so it can never pay twice.
  // Waits until the café candidate list has the gift robots (cafe/recipes.js).
  function grantGift(at){
    const g=progress.robotGift,cafe=progress.cafe;if(g.state!=='locked'||!candidateById('gift-pha')||!workersOpen())return false;
    g.state='ready';g.tally={you:{cups:0,stars:0,paid:0,cost:0},robot:{cups:0,stars:0,paid:0,cost:0,walked:0}};
    const member=id=>({id,level:1,paidUntil:at+CAFE_SHIFT_MS,shifts:1,incident:null,rest:0,gift:true});
    cafe.crew.push(member('gift-pha'));
    const waiter=roleOf('gift-bung');if(waiter&&cafe.crew.filter(m=>!m.gift&&roleOf(m.id)?.id===waiter.id).length<waiter.max)cafe.crew.push(member('gift-bung'));
    add('roasted','robusta',200,70,at,'cafe','gift'); // ignores storage capacity on purpose; the next delivery waits instead
    cafe.supplies.cup+=GIFT_CUPS;cafe.supplies.condensed+=50*GIFT_CUPS;cafe.supplies.ice+=150*GIFT_CUPS;
    log('🎁 Tặng 1 ca robot pha + robot bưng ở quán · Vào quán, Mở cửa',at);return true;
  }
  // Coins a brewed cup cost in beans (base market price) and supplies (pack price), for the trial report.
  const cupCost=(recipe,crop,uses)=>recipe.beans*productById('roasted').price*crop.priceScale+Object.entries(uses).reduce((s,[id,n])=>{const x=SUPPLIES.find(x=>x.id===id);return s+(x?n*x.price/x.pack:0);},0);
  // Lost customer: angry/rude −2 reputation, robot cup refused −0.5 (capped at −2 per gift via walkRep), anything else −1. Combo is the scene's business.
  function loseCustomer(reason){
    const cafe=progress.cafe,g=progress.robotGift;let rep=['angry','rude'].includes(reason)?2:1;
    if(reason==='robot'){rep=Math.min(.5,2-g.walkRep);g.walkRep+=rep;}
    cafe.lost++;cafe.reputation=clamp(cafe.reputation-rep,10,100);
  }
  function log(text,at){progress.journal.push({id:nextId('event'),text,at});progress.journal=progress.journal.slice(-60);}
  function record(type,amount,at,detail){progress.ledger.push({type,amount,at,detail});progress.ledger=progress.ledger.slice(-60);}
  function money(amount,type,at,detail){progress.coins=Math.round((progress.coins+amount)*100)/100;if(amount>0&&['sale','order','cafe-sale'].includes(type))progress.today.revenue+=amount;record(type,amount,at,detail);}
  const nextId=prefix=>`${prefix}-${++progress.sequence}`;
  if(!modern){for(const p of PRODUCTS)for(const c of CROPS)if(stock[p.id][c.id])progress.lots.push({id:nextId('lot'),product:p.id,cropId:c.id,grams:stock[p.id][c.id],quality:80,createdAt:now,origin:'opening'});}
  // Aggregate stock is a view of lots. Reconcile old/corrupt saves without duplicating goods.
  function rebuildStock(location='farm'){
    const target=location==='farm'?progress:progress.cafe;target.stock=emptyStock();
    target.lots=objects(target.lots).filter(l=>productById(l.product)&&cropById(l.cropId)&&Number.isSafeInteger(l.grams)&&l.grams>0);
    for(const l of target.lots)target.stock[l.product][l.cropId]+=l.grams;
  }
  if(modern){rebuildStock();rebuildStock('cafe');}
  // A new cafe starts with a little roasted coffee so the first order can be brewed before the farm delivers.
  if(!(modern&&saved.cafe))add('roasted','robusta',600,70,now,'cafe','starter');
  // Shift hiring has no reserve bench: fill the two farm slots, refund the hire fee of anyone left over.
  for(const w of progress.workers)if(w.farmId!=='farm-0'&&progress.workers.filter(x=>x.farmId==='farm-0').length<2)w.farmId='farm-0';
  for(const w of progress.workers.filter(x=>x.farmId!=='farm-0')){money(WORKER_CANDIDATES.find(c=>c.id===w.id)?.fee||0,'refund',now,w.name);log(`${w.name} rời đội dự bị (đã bỏ) · hoàn phí tuyển`,now);}
  progress.workers=progress.workers.filter(w=>w.farmId==='farm-0');
  if(extraRobots.length)log('Farm chỉ giữ 1 robot · robot dư đã rời đội (gói trả trước không hoàn)',now);
  // Cut systems (03/11/2026): fish are sold once at the old price; queued farm-grinder batches give back their roasted beans.
  if(integer(saved?.fish?.count)>0){money(integer(saved.fish.count)*8,'sale',now,'Ao cá đã bỏ · bán cá');log(`Ao cá không còn nuôi cá · đã bán ${integer(saved.fish.count)} cá`,now);}
  for(const j of jobsOf({batch:saved?.machines?.grinder?.batch||null,extraBatches:saved?.machines?.grinder?.extraBatches||[]}))if(cropById(j.cropId)&&integer(j.inputGrams)>0)add('roasted',j.cropId,integer(j.inputGrams),finite(j.quality,80),now,'farm','grinder-refund');
  // The heaven gift is granted exactly once, including saves that stored it before gifts had an effect.
  if(progress.gift&&!progress.giftApplied){
    const gift={seeds:()=>{progress.seeds.robusta+=6;progress.fertilizer+=6;return '6 hạt vối và 6 phân bón';},tools:()=>{progress.upgrades.cafe=Math.max(2,progress.upgrades.cafe);return 'thiết bị quán cấp 2';},capital:()=>{progress.coins+=150;return '150 xu';}}[progress.gift];
    if(gift)log(`Quà từ thiên đàng: ${gift()}.`,now);
    progress.giftApplied=true;
  }
  // One-time lesson rewards, guarded by `granted` so reloads and replayed chapters never pay twice.
  function grantLessons(at){
    const fresh=progress.lessons.learned.filter(id=>!progress.lessons.granted.includes(id));if(!fresh.length)return;
    const cafe=progress.cafe;
    for(const id of fresh){
      if(id==='costs')money(30,'quest',at,'Mẹo thiên đàng: Sổ thu chi');
      if(id==='customer')cafe.reputation=Math.min(100,cafe.reputation+3);
      if(id==='recipe')for(const r of ['phin-den','nau-da']){const m=cafe.mastery[r]||(cafe.mastery[r]={best:0,made:0});m.best=Math.max(m.best,40);}
      progress.lessons.granted.push(id);
    }
    log(`Mẹo từ thiên đàng: ${fresh.map(id=>LESSON_PERKS[id].name).join(', ')}.`,at);
  }
  // Old saves without tutorial flags: mark hints the player has clearly outgrown (contracts.md 5, step 4).
  if(!Array.isArray(saved?.tutorial?.seen)&&saved){
    const seen=progress.tutorial.seen,mark=(id,when)=>{if(when&&!seen.includes(id))seen.push(id);};
    mark('controls',progress.claimed.includes('roast'));mark('quest-guide',progress.claimed.includes('roast'));
    mark('cafe-intro',progress.stats.served>0);mark('bench-intro',Object.keys(progress.cafe.mastery).length>0);
    mark('tools',progress.claimed.includes('expand')||owned.length>=2||levelFor(progress.xp)>=3);
  }
  grantLessons(now); // after the tutorial check: the recipe perk creates mastery entries
  function add(product,cropId,grams,quality,at,location='farm',origin='farm'){
    const target=location==='farm'?progress:progress.cafe;
    target.lots.push({id:nextId('lot'),product,cropId,grams:integer(grams),quality:clamp(quality,0,100),createdAt:at,origin});target.stock[product][cropId]+=integer(grams);
  }
  // Oldest first, gift beans last; `only` restricts to one origin (the gift robot brews only from 'gift' lots).
  function take(product,cropId,grams,location='farm',only=null){
    const target=location==='farm'?progress:progress.cafe,pool=target.lots.filter(l=>l.product===product&&l.cropId===cropId&&(!only||l.origin===only));
    if(pool.reduce((s,l)=>s+l.grams,0)<grams)return null;
    const taken=[];let left=grams;
    for(const lot of pool.sort((a,b)=>(a.origin==='gift')-(b.origin==='gift')||a.createdAt-b.createdAt)){
      const n=Math.min(left,lot.grams);if(!n)break;
      taken.push({...lot,id:nextId('transfer'),grams:n});lot.grams-=n;left-=n;
    }
    if(left)return null;
    target.stock[product][cropId]-=grams;target.lots=target.lots.filter(l=>l.grams>0);return taken;
  }
  const qualityOf=lots=>lots.reduce((s,l)=>s+l.grams*l.quality,0)/Math.max(1,lots.reduce((s,l)=>s+l.grams,0));
  const usedStorage=()=>progress.lots.reduce((s,l)=>s+l.grams,0);
  const storageCapacity=()=>assetValue(ASSETS.find(a=>a.id==='storage'),progress.upgrades.storage);
  const waterCapacity=()=>6+4*(progress.upgrades.well-1)+2*progress.lessons.learned.includes('water');
  const workDay=at=>Math.floor(Math.max(0,at-progress.epoch)/WORK_DAY_MS);
  // A lesson can be re-asked if not learned, not answered wrong this work day, and no re-ask was answered yet this work day.
  function askable(id,at){const L=progress.lessons,day=workDay(at);return QUESTION_IDS.includes(id)&&!L.learned.includes(id)&&L.asked[id]!==day&&(L.askedDay===day?L.askedCount:0)<1;}
  const reservoirCapacity=()=>Math.round(60*capacityScale(progress.upgrades.pond));
  const level=()=>levelFor(progress.xp);
  const claims=new Map(),resources=new Map();
  let lastSave=now,lastTick=progress.lastAt,cafeActive=false;
  function commit(at=Date.now()){lastSave=at;onSave(clone(progress));}
  function makeOrder(at=lastTick){const c=CROPS.filter(c=>c.level<=level())[progress.orderIndex%CROPS.filter(c=>c.level<=level()).length];return {id:`shop-${progress.orderIndex}`,deadline:at+DAY_MS*8,accepted:false,workers:[],cropId:c.id,product:'roasted',quantity:200,reward:Math.round(200*.07*c.priceScale*1.2),xp:14};}
  progress.order=modern&&productById(saved?.order?.product)&&cropById(saved?.order?.cropId)?clone(saved.order):makeOrder();
  if(!progress.order.deadline)progress.order.deadline=now+DAY_MS*8;
  function rewards(){const earned=[];for(const q of QUESTS)if(!progress.claimed.includes(q.id)&&progress.stats[q.stat]>=q.count){progress.claimed.push(q.id);money(q.coins,'quest',lastTick,q.title);progress.xp+=q.xp;earned.push(q.title);}return earned;}
  function weatherAt(at){const day=Math.max(0,Math.floor((at-progress.epoch)/DAY_MS));return {day:day+1,raining:day%7===3||day%7===4};}
  function refreshDaily(at){
    const day=weatherAt(at).day;if(progress.today.day!==day)progress.today={day,harvested:0,processed:0,revenue:0};
    // Market prices recover once per work day (6 minutes) so selling every minute earns nothing extra.
    if(progress.market.day!==workDay(at))progress.market={day:workDay(at),sold:0};
    if(day===progress.lastOrderDay)return;
    // Cafe orders are staff work: only raise them once a main worker can take them, at most 2 open at a time.
    const available=CROPS.filter(c=>c.level<=level()),active=progress.orders.filter(o=>['open','transit'].includes(o.status)).length;
    if(progress.workers.some(w=>w.farmId==='farm-0'))for(let i=0;i<2-active;i++)progress.orders.push({id:nextId('order'),day,cropId:available[(day-1+i)%available.length].id,grams:i?168:252,status:'open',workers:[],deadline:at+DAY_MS*8,createdAt:at});
    progress.orders=progress.orders.filter(o=>o.status!=='delivered'||day-o.day<7).slice(-30);
    progress.lastOrderDay=day;
  }
  function advance(at){
    at=Math.max(lastTick,at);if(at===lastTick)return false;
    const elapsed=at-lastTick,from=Math.max(lastTick,at-OFFLINE_MS),seconds=(at-from)/1000;
    refreshDaily(at);
    for(const order of progress.orders){if(!order.deadline)order.deadline=at+DAY_MS*8;if(order.status==='open'&&at>order.deadline){order.status='expired';log('Đơn quán quá hạn',at);}}
    if(progress.order?.accepted&&at>progress.order.deadline){progress.orders.push({...progress.order,grams:progress.order.quantity,status:'expired',source:'shop',day:weatherAt(at).day,workers:progress.order.workers||[]});log('Đơn shop quá hạn',at);progress.orderIndex++;progress.order=makeOrder(at);}

    const weather=weatherAt(at),rain=weather.raining?seconds*.28:0;
    progress.reservoir=Math.min(reservoirCapacity(),progress.reservoir+seconds*(.06+.025*(progress.upgrades.well-1))+rain);
    progress.durability=Math.max(0,progress.durability-seconds*.0001/efficiency(progress.upgrades.fence));
    for(const p of progress.plots){
      if(!p.unlocked||p.stage==='empty')continue;
      const crop=cropById(p.cropId),ratio=p.growthMs/(p.mature?crop.regrowMs:crop.growMs),dry=p.mature&&ratio>=.17&&ratio<.23;
      const loss=CARE.waterPerSecond/efficiency(progress.upgrades.soil),waterEnd=clamp(p.water+rain-seconds*loss,0,100),weedsEnd=clamp(p.weeds+seconds*CARE.weedsPerSecond,0,100);
      const activeWater=dry||weather.raining?seconds:clamp((p.water-CARE.waterStopsGrowth)/loss,0,seconds);
      const activeWeeds=clamp((CARE.weedsStopGrowth-p.weeds)/CARE.weedsPerSecond,0,seconds);
      const active=Math.min(activeWater,activeWeeds),stress=seconds-active;
      p.health=clamp(p.health-stress*.0008+active*.0003-(progress.durability<25?seconds*.0002:0),20,100);
      if(p.stage!=='ready'){
        p.growthMs+=active*1000*(.65+.35*p.health/100);
        const total=p.mature?crop.regrowMs:crop.growMs;
        if(p.growthMs>=total){
          if(!p.mature){p.mature=true;p.growthMs=0;p.stage='growing';}
          else{p.growthMs=total;p.stage='ready';const yieldScale=(.7+.3*p.health/100)*(p.fertilized?1.1:.9)*(p.pruned?1:.95);const totalFruit=Math.round(crop.yield*yieldScale);p.readyYield=totalFruit;p.remainingFruit=0;p.secondPick=0;p.quality=clamp(55+p.health*.25+Number(p.fertilized)*5+Number(p.pruned)*5,0,100);}
        }else p.stage='growing';
      }
      p.water=waterEnd;p.weeds=weedsEnd;p.lastAt=at;
    }
    // Old fresh fruit loses value, not all inventory. Handle elapsed time once per lot.
    for(const lot of progress.lots)if(lot.product==='cherries'&&at-lot.createdAt>DAY_MS)lot.quality=Math.max(20,lot.quality-seconds*.003);
    for(const trip of progress.cafe.shipments.filter(t=>t.readyAt<=at)){for(const l of trip.lots)add(l.product,l.cropId,l.grams,l.quality,trip.readyAt,'cafe',l.origin);log(`Quán đã nhận ${trip.lots.reduce((sum,l)=>sum+l.grams,0)} g cà phê · Hoàn tất vận chuyển`,trip.readyAt);const order=progress.orders.find(o=>o.id===trip.orderId);if(order){order.status='delivered';const onTime=trip.readyAt<=order.deadline;order.rating=onTime?5:3;progress.reputation=clamp(progress.reputation+(onTime?2:-1),0,100);log(`Quán nhận đơn · ${order.rating} sao · Uy tín ${progress.reputation}`,trip.readyAt);}}
    progress.cafe.shipments=progress.cafe.shipments.filter(t=>t.readyAt>at);
    // Staff only work while the game runs, so a gap (closed game, hidden tab) pauses paid contract time instead of burning it.
    // Sick leave pauses with the contract, so a worker away for hours is still sick for the same time left.
    if(elapsed>60000)for(const w of progress.workers){if(w.shiftUntil>lastTick)w.shiftUntil+=elapsed;if(w.restUntil>lastTick)w.restUntil+=elapsed;}
    // Café staff only work while the café runs and is open: their paid shift pauses otherwise (and across gaps).
    // Sick café staff (rest > 0) count down only while open, and their paid time pauses meanwhile.
    if(!(cafeActive&&progress.cafe.open)||elapsed>60000){for(const s of progress.cafe.crew)if(s.paidUntil>lastTick)s.paidUntil+=elapsed;}
    else for(const s of progress.cafe.crew)if(s.rest>0){const d=Math.min(s.rest,elapsed);s.rest-=d;if(s.paidUntil>lastTick)s.paidUntil+=d;}
    // Cafe staff renew their shift wage only while the player runs the open cafe; unpaid staff idle. Gift robots never renew.
    if(cafeActive&&progress.cafe.open)for(const s of progress.cafe.crew){if(s.gift)continue;const person=candidateById(s.id),wage=staffWage(roleOf(s.id),s.level,person);if(s.paidUntil<=at&&progress.coins>=wage){money(-wage,'wage',at,person.person);s.paidUntil=at+CAFE_SHIFT_MS;cafeShiftPaid(s,at);}}
    // Gift robots leave when their one shift ends; the gift is active from the first open café and done when they are gone.
    const gift=progress.robotGift;if(progress.cafe.crew.some(s=>s.gift&&s.paidUntil<=at))progress.cafe.crew=progress.cafe.crew.filter(s=>!s.gift||s.paidUntil>at);
    if(['ready','active'].includes(gift.state)&&!progress.cafe.crew.some(s=>s.gift))gift.state='done';
    else if(gift.state==='ready'&&cafeActive&&progress.cafe.open)gift.state='active';
    lastTick=at;progress.lastAt=at;
    if(elapsed>60000)progress.offline={seconds:Math.floor(Math.min(elapsed,OFFLINE_MS)/1000),message:'Cây, mẻ đã xếp và chuyến giao tiếp tục; hợp đồng nhân viên tạm dừng khi bạn vắng mặt, quán không tự bán.'};
    return true;
  }
  function adjacent(id){const f=FIELDS.find(f=>f.id===id);return f&&FIELDS.some(n=>owned.includes(n.id)&&Math.abs(n.row-f.row)+Math.abs(n.col-f.col)===1);}
  function demand(){const cups=18+2*(progress.upgrades.cafe-1),grams=Math.ceil(cups*18*1.2),incoming=progress.cafe.shipments.reduce((s,t)=>s+t.lots.filter(l=>l.product==='roasted').reduce((a,l)=>a+l.grams,0),0),stored=Object.values(progress.cafe.stock.roasted).reduce((s,n)=>s+n,0);return {cups,grams,stored,incoming,needed:Math.max(0,grams-stored-incoming)};}
  for(const worker of progress.workers){for(const l of worker.cargo||[])if(productById(l.product)&&cropById(l.cropId)&&l.grams>0)add(l.product,l.cropId,l.grams,finite(l.quality,80),now,'farm',l.origin);worker.cargo=[];}
  // Resting (sick) workers are skipped; the error only comes when nobody is left. Returns the team that actually started.
  function startTeam(all,at){
    if(!all.length)return {error:'Chưa có nhân viên sẵn sàng · Bố trí người hoặc bấm icon xu trên người đang nghỉ.'};
    const team=all.filter(w=>!(w.restUntil>at)),resting=all.find(w=>w.restUntil>at);if(!team.length)return {error:`${resting.name} đang nghỉ ${Math.ceil((resting.restUntil-at)/1000)}s.`};
    const cost=team.reduce((sum,w)=>sum+(w.shiftUntil>at?0:contractPrice(w)),0);
    if(progress.coins<cost)return {error:`Cần ${cost} xu ký hợp đồng cho đội trước khi bắt đầu.`};
    for(const w of team){if(w.shiftUntil<=at)signContract(w,at);w.enabled=true;w.state='Đã nhận việc · Chuẩn bị di chuyển';}
    return {cost,team};
  }
  function saleQuote(product,cropId,grams){
    const item=productById(product),crop=cropById(cropId);
    if(!item||!crop||!Number.isSafeInteger(grams)||grams<1||grams>progress.stock[product][cropId])return {ok:false,message:'Số gram bán không hợp lệ.'};
    if(product==='roasted'&&progress.cafe.reserve&&Object.values(progress.stock.roasted).reduce((sum,n)=>sum+n,0)-grams<demand().needed)return {ok:false,message:'Hạt rang đang được giữ cho quán.'};
    let left=grams,weighted=0;
    for(const lot of progress.lots.filter(l=>l.product===product&&l.cropId===cropId).sort((a,b)=>a.createdAt-b.createdAt)){const amount=Math.min(left,lot.grams);weighted+=amount*lot.quality;left-=amount;if(!left)break;}
    if(left)return {ok:false,message:'Kho không đủ hàng.'};
    const base=grams*item.price*crop.priceScale*(.7+.3*weighted/grams/100),value=Math.round(marketValue(progress.market.sold,base)*100)/100;
    // discounted: the market already bought enough this work day to cut this sale by 5%+ (drives the UI note).
    return {ok:true,value,base,full:Math.round(base*100)/100,discounted:value<base*.95};
  }
  const api={
    saleQuote,
    get progress(){return clone(progress);},
    // Live state for per-frame readers (crew loop, plot checks): read only, never mutate; use act/workerUpdate to change it.
    peek(){return progress;},get level(){return level();},get waterCapacity(){return waterCapacity();},get quest(){return QUESTS.find(q=>!progress.claimed.includes(q.id))||null;},
    get demand(){return demand();},get weather(){return weatherAt(lastTick);},get storageCapacity(){return storageCapacity();},
    setCafeActive(value){cafeActive=value;},
    // Lesson the UI may re-ask now among `ids` (in order), as {expert, question} from heaven/content.js, or null.
    pendingLesson(ids=QUESTION_IDS){const id=[].concat(ids).find(id=>askable(id,lastTick));return id?lessonOf(id):null;},
    canExpand(id){return !owned.includes(id)&&Boolean(adjacent(id));},
    tick(at){advance(at);if(at-lastSave>=5000)commit(at);return true;},flush(at=Date.now()){advance(at);commit(at);},
    reserve(id,action,owner,choice=null){
      const key=`${id}:${action}`;if(claims.has(key)&&claims.get(key)!==owner)return false;
      const needs=action==='plant'?{key:`seed:${choice}`,amount:1,available:progress.seeds[choice]||0}:action==='fertilize'?{key:'fertilizer',amount:1,available:progress.fertilizer}:null;
      if(needs){const held=[...resources.entries()].filter(([who,r])=>who!==owner&&r.key===needs.key).reduce((s,[,r])=>s+r.amount,0);if(needs.available-held<needs.amount)return false;resources.set(owner,needs);}
      claims.set(key,owner);return true;
    },
    release(owner){for(const [key,value]of claims)if(value===owner)claims.delete(key);resources.delete(owner);},
    claimed(id,action){return claims.get(`${id}:${action}`)||null;},
    employmentTick(id,dt){const w=progress.workers.find(w=>w.id===id);if(w&&w.enabled&&w.farmId==='farm-0'&&w.shiftUntil>lastTick)w.serviceMs=(w.serviceMs||0)+Math.max(0,Math.min(dt,.1))*1000;},
    // Robots never gain xp (fixed stats, level 1).
    workerUpdate(id,changes){const w=progress.workers.find(w=>w.id===id);if(!w)return;const {xp,...rest}=changes;Object.assign(w,isRobot(w)?rest:changes);},
    // Debug only (`?debug=incident`, robot-staff.md 14): force this shift's incident to fire now; exemptions still apply when it fires.
    debugIncident(scope,id,type,at=Date.now()){
      const s=scope==='cafe'?progress.cafe.crew.find(m=>m.id===id):progress.workers.find(w=>w.id===id);if(!s||!['phone','sick','rude'].includes(type))return false;
      s.incident={for:scope==='cafe'?s.shifts:s.paidDays||0,type,due:Math.max(0,(scope==='cafe'?s.paidUntil:s.shiftUntil)-at),done:false};return true;
    },
    // Odds this person would roll now: { phone, sick, rude } (robots 0).
    incidentOdds(scope,id,at=Date.now()){
      if(scope==='cafe'){const s=progress.cafe.crew.find(m=>m.id===id);if(!s||candidateById(id).kind==='robot')return {phone:0,sick:0,rude:0};const manager=progress.cafe.crew.some(m=>m!==s&&roleOf(m.id)?.id==='manager'&&m.paidUntil>at&&!m.rest);return incidentOdds(s.level,INCIDENTS.kCafe,manager,['cashier','waiter'].includes(roleOf(id).id));}
      const w=progress.workers.find(w=>w.id===id);return !w||isRobot(w)?{phone:0,sick:0,rude:0}:incidentOdds(workerLevel(w.xp),INCIDENTS.kFarm);
    },
    workDuration(action,worker=null){const base={water:1.8,weed:2.2,fertilize:1.8,harvest:2.5,refill:1.5,collect:1.5,start:1.5,turn:1.8,prune:2.5,ship:2,plant:2.2,clear:2.5}[action]||4;return base/efficiency(worker?workerLevel(worker.xp):progress.upgrades.tools);},
    act(id,action,choice,at=Date.now(),owner='player'){
      at=Math.max(lastTick,finite(at,Date.now()));advance(at);const fail=message=>({ok:false,message});let message='',collected=false,extra={};
      const claimant=api.claimed(id,action);if(claimant&&claimant!==owner)return fail('Nhân viên đang thực hiện việc này.');
      const resourceKey=action==='plant'?`seed:${choice}`:action==='fertilize'?'fertilizer':null;
      if(resourceKey){const held=[...resources.entries()].filter(([who,r])=>who!==owner&&r.key===resourceKey).reduce((sum,[,r])=>sum+r.amount,0),available=action==='plant'?progress.seeds[choice]||0:progress.fertilizer;if(available-held<1)return fail('Vật tư đã được giữ cho việc khác.');}
      const p=progress.plots.find(p=>p.id===id),m=MACHINES.find(m=>m.id===id),field=FIELDS.find(f=>f.id===id);
      if(id==='decorations'){
        if(action==='construct'||action==='demolish'){
          const item=progress.decorations.find(item=>item.id===choice?.id);if(!item)return fail('Đồ trang trí không còn ở đây.');
          if(action==='demolish'){progress.decorations=progress.decorations.filter(value=>value.id!==item.id);message='Đã phá dỡ trang trí. Không hoàn lại xu.';}
          else{if(item.state==='complete')return fail('Đồ trang trí đã xây xong.');const ms=choice.ms;if(!Number.isFinite(ms)||ms<=0||ms>1000)return fail('Thời gian thi công không hợp lệ.');item.buildMs=Math.min(item.buildDuration,item.buildMs+ms);if(item.buildMs>=item.buildDuration)item.state='complete';message=item.state==='complete'?'Đã xây xong trang trí.':'Đang thi công.';}
        }else{
        if(action!=='place'||!choice||typeof choice!=='object')return fail('Chọn món trang trí và vị trí trước.');
        const reason=decorationError(progress.decorations,choice);if(reason)return fail(reason);
        const spec=DECORATIONS.find(item=>item.id===choice.type);if(progress.coins<spec.price)return fail(`Thiếu ${spec.price-progress.coins} xu để đặt ${spec.name}.`);
        money(-spec.price,'decoration',at,spec.name);progress.decorations.push({id:nextId('decor'),type:spec.id,x:choice.x,z:choice.z,rotation:choice.rotation,text:String(choice.text||'').trim().slice(0,24),state:'construction',buildMs:0,buildDuration:spec.id==='lamp'?6000:5000});message=`Đã đặt nền ${spec.name}. Nhân vật sẽ tới thi công.`;
        }
      }else if(id==='orders'){
        const order=progress.orders.find(o=>o.id===(typeof choice==='object'?choice?.orderId:choice));
        if(!order||order.status!=='open')return fail('Đơn đã giao hoặc đang vận chuyển.');
        if(action==='startCrew'){const result=startTeam(progress.workers.filter(w=>w.farmId==='farm-0'),at);if(result.error)return fail(result.error);order.workers=result.team.map(w=>w.id);message=`Đã giao đơn cho ${result.team.map(w=>w.name).join(', ')}${result.cost?` · Lương ${result.cost} xu`:''}.`;}else if(action==='requestDelivery'){if(progress.stock.roasted[order.cropId]<order.grams||!order.workers.some(id=>progress.workers.some(w=>w.id===id&&w.farmId==='farm-0'&&w.jobs.delivery)))return fail('Cần đủ hàng và có nhân viên phụ trách giao.');order.deliveryRequested=true;message='Đã giao việc vận chuyển cho nhân viên.';}else if(action==='assign'){
          const w=progress.workers.find(w=>w.id===choice.workerId);if(!w||w.farmId!=='farm-0')return fail('Bố trí nhân viên vào nông trại trước.');
          if(!order.workers.includes(w.id)){const started=startTeam([w],at);if(started.error)return fail(started.error);}
          order.workers=order.workers.includes(w.id)?order.workers.filter(id=>id!==w.id):[...order.workers,w.id];message='Đã cập nhật nhân viên phụ trách đơn.';
        }else if(action==='shipOrder'){
          if(progress.stock.roasted[order.cropId]<order.grams)return fail('Chưa đủ hạt rang cho đơn.');if(progress.coins<2)return fail('Cần 2 xu cước giao.');
          const incoming=progress.cafe.shipments.reduce((s,t)=>s+t.lots.reduce((n,l)=>n+l.grams,0),0),stored=progress.cafe.lots.reduce((s,l)=>s+l.grams,0);
          if(incoming+stored+order.grams>storageCapacity())return fail('Kho quán đầy, cần phục vụ bớt.');
          const lots=take('roasted',order.cropId,order.grams);money(-2,'delivery',at,'Chuyển về quán');progress.cafe.shipments.push({id:nextId('trip'),orderId:order.id,lots,startedAt:at,readyAt:at+10000/efficiency(progress.upgrades.delivery)});order.status='transit';progress.stats.delivered+=order.grams;message='Đã chuyển về quán đúng số lượng của đơn. Hàng đang trên đường.';
        }else return fail('Không có thao tác đơn hàng.');
      }else if(action==='upgrade'){
        const asset=ASSETS.find(a=>a.id===id);if(!asset)return fail('Không có hạng mục nâng cấp.');
        const lv=progress.upgrades[id],price=upgradePrice(id,lv);
        if(lv>=assetMaxLevel(asset))return fail(`${asset.name} đã đạt cấp tối đa ${assetMaxLevel(asset)}.`);
        if(level()<upgradeRequirement(lv+1))return fail(`Cần nông trại cấp ${upgradeRequirement(lv+1)}.`);
        if(progress.coins<price)return fail(`Còn thiếu ${Math.ceil(price-progress.coins)} xu.`);
        money(-price,'upgrade',at,asset.name);progress.upgrades[id]++;progress.canLevel=progress.upgrades.well;
        if(progress.machines[id])progress.machines[id].level=progress.upgrades[id];
        message=`${asset.name} cấp ${lv+1} · ${asset.benefit}.`;
      }else if(id==='workers'){
        if(action==='rejectCandidate'){
          const candidate=WORKER_CANDIDATES.find(w=>w.id===choice);
          if(!candidate||candidate.kind==='robot'||progress.workers.some(w=>w.id===choice))return fail('Ứng viên không còn trong danh sách tuyển dụng.');
          if(!progress.rejectedCandidates.includes(choice))progress.rejectedCandidates.push(choice);
          message=`Đã từ chối ứng viên ${candidate.name}.`;
        }else if(action==='hire'){
          // Two shared slots (robots count), at most one robot. Robots skip the hire fee and prepay a pack instead; `pack` is ignored for people.
          const hireId=idOf(choice),candidate=WORKER_CANDIDATES.find(w=>w.id===hireId),robot=candidate?.kind==='robot',pack=robot?Number(choice?.pack??1):1;
          if(!candidate||progress.rejectedCandidates.includes(hireId)||progress.workers.some(w=>w.id===hireId))return fail('Ứng viên không còn trong danh sách tuyển dụng.');
          if(progress.workers.length>=2)return fail(robot?'Đã đủ 2 thợ. Cho một người nghỉ trước khi thuê robot.':'Farm đã đủ 2 thợ. Cho một người nghỉ việc trước khi thuê.');
          if(robot&&progress.workers.some(isRobot))return fail('Farm chỉ thuê được 1 robot.');
          if(!Object.hasOwn(ROBOT_PACKS,pack))return fail('Chọn gói 1, 5 hoặc 10 ngày công.');
          const price=robot?packPrice(candidate.wage,pack):candidate.fee;
          if(progress.coins<price)return fail(robot?`Còn thiếu ${Math.ceil(price-progress.coins)} xu.`:'Chưa đủ xu tuyển nhân viên.');
          if(!robot)money(-candidate.fee,'hire',at,candidate.name);
          const worker={...clone(candidate),kind:robot?'robot':'human',incident:null,xp:0,energy:100,health:100,cargo:[],jobs:Object.fromEntries(WORKER_JOBS.map(([id])=>[id,canDo(candidate,id)])),preferredCrop:'robusta',workMode:'auto',farmId:'farm-0',autoPay:true,role:'auto',enabled:true,hiredAt:at,serviceMs:0,paidDays:0,shiftUntil:0,restUntil:0,state:'Chờ phân việc'};
          progress.workers.push(worker);if(robot)signContract(worker,at,pack);
          message=robot?`${candidate.name} đã vào trang trại · gói ${pack} ngày công ${price} xu.`:`${candidate.name} đã vào trang trại.`;
        }else{
          const w=progress.workers.find(w=>w.id===choice?.id||w.id===choice);if(!w)return fail('Chưa thuê nhân viên này.');
          if(action==='dismiss'){
            // Ending a contract early frees the slot; prepaid days are not refunded.
            claims.forEach((who,key)=>{if(who===w.id)claims.delete(key);});resources.delete(w.id);
            for(const order of progress.orders)order.workers=order.workers.filter(id=>id!==w.id);
            for(const task of progress.dailyTasks)task.workers=task.workers.filter(id=>id!==w.id);
            progress.workers=progress.workers.filter(person=>person.id!==w.id);
            if(!isRobot(w)&&!progress.rejectedCandidates.includes(w.id))progress.rejectedCandidates.push(w.id);
            message=`Đã xóa ${w.name} khỏi đội ngũ.`;
          }else if(action==='moveStaff'){
            if(!choice.deploy)return fail('Không còn đội dự bị · muốn thôi thì bấm Cho nghỉ việc.');
            const replacement=choice.replaceId?progress.workers.find(person=>person.id===choice.replaceId):null;
            if(choice.replaceId&&(!replacement||replacement.farmId!=='farm-0'||replacement.id===w.id))return fail('Vị trí thợ chính đã thay đổi.');
            if(choice.deploy&&w.farmId==='farm-0')return fail('Nhân viên đã là thợ chính.');
            if(choice.deploy&&!replacement&&progress.workers.filter(person=>person.farmId==='farm-0').length>=2)return fail('Đã đủ 2 thợ chính. Kéo vào người muốn thay.');
            const removed=choice.deploy?replacement:w;
            if(removed){removed.farmId=null;removed.state='Dự bị';claims.forEach((who,key)=>{if(who===removed.id)claims.delete(key);});resources.delete(removed.id);}
            if(choice.deploy){w.farmId='farm-0';w.state='Chờ bạn giao việc';}
            if(replacement)for(const order of progress.orders.filter(order=>order.status==='open'))order.workers=order.workers.map(id=>id===replacement.id?w.id:id).filter((id,index,ids)=>ids.indexOf(id)===index);
            message=choice.deploy?(replacement?`${w.name} thay ${replacement.name} làm thợ chính.`:`${w.name} đã vào đội thợ chính.`):`${w.name} chuyển về dự bị.`;
          }
          else if(action==='startWork'){
            if(!w.farmId&&progress.workers.filter(person=>person.farmId==='farm-0').length>=2)return fail('Farm đã đủ hai người; đổi bố trí trước.');
            const result=startTeam([w],at);if(result.error)return fail(result.error);w.farmId='farm-0';
            const hasAssigned=progress.orders.some(o=>o.status==='open'&&o.workers.includes(w.id));
            if(!hasAssigned)w.workMode='auto';message=`${w.name} bắt đầu làm${result.cost?` · Đã trả ${result.cost} xu/ca`:''}.`;
          }else if(action==='deploy'){
            if(w.farmId==='farm-0')return fail('Thợ đang làm ở farm · muốn thôi thì bấm Cho nghỉ việc.');
            else{if(progress.workers.filter(w=>w.farmId==='farm-0').length>=2)return fail('Nông trại đủ 2 người. Cho một người về đội dự bị trước.');w.farmId='farm-0';w.state='Chờ bạn giao việc';}
            message=w.farmId?'Đã bố trí vào nông trại.':'Đã chuyển về đội dự bị.';
          }else if(action==='autoPay'){w.autoPay=!w.autoPay;message=w.autoPay?'Tự gia hạn khi hợp đồng sắp hết.':'Hết hạn hợp đồng sẽ dừng việc, chờ bạn gia hạn.';}
          else if(action==='toggle'){w.enabled=!w.enabled;message=w.enabled?'Đã tiếp tục ca.':'Tạm dừng sau thao tác hiện tại.';}
          else if(action==='mode'){w.workMode=w.workMode==='auto'?'assigned':'auto';message=w.workMode==='assigned'?'Chỉ làm đơn và nhiệm vụ bạn giao.':'Tự chăm và chế biến theo nhu cầu.';}
          else if(action==='permissionGroup'){
            if(choice.group!=='care')return fail('Nhóm việc không hợp lệ.');
            const keys=['plant','water','fertilize','weed','prune','harvest'].filter(key=>canDo(w,key)),enabled=!keys.every(key=>w.jobs[key]);
            for(const key of keys)w.jobs[key]=enabled;
            message=`Đã ${enabled?'bật':'tắt'} chăm cây và thu hoạch.`;
          }
          else if(action==='permission'){if(!WORKER_JOBS.some(([key])=>key===choice.job))return fail('Nhóm việc không hợp lệ.');if(!canDo(w,choice.job))return fail('Robot không làm việc này.');w.jobs[choice.job]=!w.jobs[choice.job];message=`Đã ${w.jobs[choice.job]?'bật':'tắt'} nhóm việc.`;}
          else if(action==='seed'){if(!cropById(choice.cropId)||cropById(choice.cropId).level>level())return fail('Chưa mở giống này.');w.preferredCrop=choice.cropId;w.preferredCropExplicit=true;message='Đã chọn giống nhân viên sẽ trồng.';}
          else if(action==='role'){w.role=choice.role;message='Đã đổi ưu tiên công việc.';}
          else if(action==='train'){
            if(isRobot(w))return fail('Robot không đào tạo được.');
            if(workerLevel(w.xp)>=10)return fail('Nhân viên đã đạt cấp 10.');const fee=40*workerLevel(w.xp);if(progress.coins<fee)return fail('Chưa đủ xu đào tạo.');
            money(-fee,'training',at,w.name);w.xp=100*workerLevel(w.xp)**2;message=`${w.name} lên cấp ${workerLevel(w.xp)}.`;
          }else if(action==='shift'){
            // Allowed while sick: pays and extends shiftUntil, sickness stays. Robots may buy a pack; auto-renew sends no pack (= 1 day).
            const pack=isRobot(w)?Number(choice?.pack??1):1;if(!Object.hasOwn(ROBOT_PACKS,pack))return fail('Chọn gói 1, 5 hoặc 10 ngày công.');
            const plan=contractPlan(w),price=shiftPrice(w,pack);if(progress.coins<price)return fail(isRobot(w)?`Còn thiếu ${Math.ceil(price-progress.coins)} xu.`:`Cần ${price} xu ký hợp đồng ${plan.name.toLowerCase()} cho ${w.name}.`);
            signContract(w,at,pack);message=isRobot(w)?`${w.name}: gói ${pack} ngày công · ${price} xu.`:`${w.name}: hợp đồng ${plan.name.toLowerCase()} · ${price} xu · thêm ${plan.days} ngày làm việc.`;
          }else if(action==='incident'){
            // Fires this shift's rolled incident; exemptions are checked now (staff count may have changed since the roll). Always marks done.
            const i=w.incident;if(!i||i.done)return fail('Không có sự cố.');const left=w.shiftUntil-at;if(left>i.due)return fail('Chưa tới lúc.');
            const holdsOrder=progress.orders.some(o=>o.status==='open'&&o.workers.includes(w.id));
            // Late by > 10 s = the moment passed while the farm loop was not running (player away): cancel, never postpone.
            const applied=['phone','sick'].includes(i.type)&&!isRobot(w)&&i.for>INCIDENTS.grace&&!cafeActive&&i.due-left<=10000&&progress.cafe.reputation>=INCIDENTS.minRep&&!(i.type==='sick'&&progress.workers.length===1&&holdsOrder);
            i.done=true;
            if(applied&&i.type==='phone'){w.waitUntil=at+INCIDENTS.phoneMs;w.waitReason='📱 Mải chơi điện thoại · Chạm để nhắc';}
            if(applied&&i.type==='sick'){w.restUntil=at+WORK_DAY_MS;w.shiftUntil+=WORK_DAY_MS;log(`${w.name} nghỉ ốm ngày công này, không tính lương.`,at);}
            extra={type:i.type,applied};message=!applied?'':i.type==='sick'?`🤒 ${w.name} nghỉ ốm ngày công này, không tính lương.`:`📱 ${w.name} đang mải chơi điện thoại · Chạm để nhắc.`;
          }else if(action==='remind'){
            if(w.incident?.type!=='phone'||!(w.waitUntil>at))return fail(`${w.name} đang làm việc.`);
            w.waitUntil=0;w.waitReason='';message=`${w.name} cất điện thoại, làm việc tiếp.`;
          }else if(action==='contractPlan'){
            const plans=['day','week','month'];w.contractPlan=plans[(plans.indexOf(contractPlan(w).id)+1)%plans.length];message=`Gói hợp đồng của ${w.name}: ${contractPlan(w).name} · ${contractPrice(w)} xu.`;
          }else return fail('Không có thao tác này.');
        }
      }else if(id==='cafe'){
        const cafe=progress.cafe;
        if(action==='toggle'){cafe.open=!cafe.open;message=cafe.open?'Quán mở cửa. Ra quầy thu ngân nhận order.':'Quán đã đóng cửa.';}
        else if(action==='reserve'){cafe.reserve=!cafe.reserve;message=cafe.reserve?'Giữ hạt theo dự báo quán.':'Cho phép bán cả phần dự trữ.';}
        else if(action==='ship'){
          const crop=cropById(choice);if(!crop)return fail('Chọn loại hạt rang.');
          const grams=Math.min(progress.stock.roasted[crop.id],Math.round(1000*capacityScale(progress.upgrades.delivery)));
          if(!grams)return fail('Farm chưa có hạt rang.');
          const cafeMass=cafe.lots.reduce((s,l)=>s+l.grams,0)+cafe.shipments.reduce((s,t)=>s+t.lots.reduce((n,l)=>n+l.grams,0),0);
          if(cafeMass+grams>storageCapacity())return fail('Kho quán không đủ chỗ; phục vụ bớt trước khi giao.');
          if(progress.coins<2)return fail('Cần 2 xu cước giao.');
          const lots=take('roasted',crop.id,grams);money(-2,'delivery',at,'Cước chuyển hạt');cafe.shipments.push({id:nextId('trip'),lots,startedAt:at,readyAt:at+10000/efficiency(progress.upgrades.delivery)});progress.stats.delivered+=grams;message=`Đang giao ${grams} g; hàng không còn trong kho farm.`;
        }else if(action==='supply'){
          const grams=500,price=SUPPLIER_PRICE;if(progress.coins<price)return fail(`Cần ${price} xu nhập 500 g hạt rang.`);
          if(cafe.lots.reduce((s,l)=>s+l.grams,0)+grams>storageCapacity())return fail('Kho quán đầy.');
          money(-price,'supplier',at,'Nhập hạt dự phòng');add('roasted','robusta',grams,65,at,'cafe','supplier');message='Đã nhập 500 g hạt rang dự phòng cho quán.';
        }else if(action==='brew'){
          const g=progress.robotGift,robot=choice?.robot==='gift',recipe=recipeById(choice?.recipeId);
          // The gift robot brews only from 'gift' beans (robusta) with its fixed mistakes: score 50, double condensed milk.
          const crop=robot?cropById('robusta'):cropById(choice?.cropId);if(!recipe||!crop)return fail('Chọn món và loại hạt.');
          const uses=robot&&recipe.uses.condensed?{...recipe.uses,condensed:recipe.uses.condensed*2}:recipe.uses;
          if(robot){
            if(!cafe.crew.some(m=>m.id==='gift-pha'&&m.paidUntil>at)||g.cups>=GIFT_CUPS||!GIFT_RECIPES.includes(recipe.id))return fail('Robot pha không nhận món này.');
            // Check everything before taking anything.
            const lacking=[...(cafe.lots.filter(l=>l.origin==='gift'&&l.product==='roasted'&&l.cropId===crop.id).reduce((s,l)=>s+l.grams,0)<recipe.beans?[`${recipe.beans} g hạt gói thử`]:[]),...Object.entries(uses).filter(([id,n])=>(cafe.supplies[id]||0)<n).map(([id])=>SUPPLIES.find(s=>s.id===id)?.name.toLowerCase()||id)];
            if(lacking.length)return fail(`Thiếu ${lacking.join(', ')}.`);
          }else{const missing=missingFor(recipe,cafe,crop.id);if(missing.length)return fail(`Thiếu ${missing.join(', ')}.`);}
          const score=robot?50:clamp(finite(choice.score),0,100),lots=take('roasted',crop.id,recipe.beans,'cafe',robot?'gift':null);
          for(const [supply,amount]of Object.entries(uses))cafe.supplies[supply]-=amount;
          if(!choice.staff&&!robot){const m=cafe.mastery[recipe.id]||(cafe.mastery[recipe.id]={best:0,made:0});m.best=Math.max(m.best,score);m.made++;}
          if(robot){g.cups++;g.tally.robot.cost+=cupCost(recipe,crop,uses);}else if(g.state==='active'&&!choice.staff)g.tally.you.cost+=cupCost(recipe,crop,uses);
          const beanFit=crop.id===recipe.bean?0:-5;
          extra={quality:Math.round(clamp(score*.75+qualityOf(lots)*.25+gearBonus(recipe,cafe.gear)+beanFit,0,100))};message=`Đã pha ${recipe.name}.`;
        }else if(action==='sell'){
          const recipe=recipeById(choice?.recipeId);if(!recipe)return fail('Không rõ món.');
          const g=progress.robotGift,robot=choice.robot===true,tally=g.state==='active'?g.tally:null;
          // A robot cup: 25% of customers refuse it (no pay, lost reason 'robot'); otherwise it pays without stars/combo/extras and never counts as the player's serve.
          if(robot&&Math.random()<.25){loseCustomer('robot');if(tally){tally.robot.cups++;tally.robot.walked++;}extra={walked:true,reason:'robot'};message='Khách chê ly robot · bỏ về';}
          else{
          const quality=clamp(finite(choice.quality),0,100),stars=clamp(integer(choice.stars),0,3),wait=clamp(finite(choice.wait),0,1),combo=robot?0:clamp(integer(choice.combo),0,5);
          const comfort=Number.isInteger(choice.table)&&choice.table>=0&&choice.table<MAX_TABLES?TABLE_LEVELS[cafe.tables[choice.table]-1].tip:0;
          const price=Math.round(recipe.price*(.6+.4*quality/100)*(choice.special&&!robot?1.3:1)*(cafe.gear.roastery?1.1:1)*(!robot&&!choice.staff?OWN_CUP:1)*100)/100,tip=Math.round(recipe.price*(robot?(1-wait)*.1:Math.max(0,stars-1)*.15+(1-wait)*.1+combo*.04+(choice.memory?.2:0)+comfort+clamp(finite(choice.charm),0,.1))*100)/100;
          money(price+tip,'cafe-sale',at,recipe.name);cafe.revenue+=price+tip;cafe.served++;if(!robot){progress.stats.served++;progress.xp+=1+stars;}cafe.reputation=clamp(cafe.reputation+(stars-1)*.6,10,100);
          if(tally&&(robot||!choice.staff)){const t=robot?tally.robot:tally.you;t.cups++;t.stars+=stars;t.paid+=price+tip;}
          extra={price,tip};message=`${recipe.name} · ${price} xu${tip?` + tip ${tip}`:''}`;
          }
        }else if(action==='lost'){
          loseCustomer(choice);message=choice==='rude'?'Khách bỏ về vì bị lỡ lời · Uy tín −2':'Khách đã bỏ về.';
        }else if(action==='giftReport'){
          progress.robotGift.reported=true;
        }else if(action==='incident'){
          // Fires a café member's rolled incident (service calls it when paidUntil − now ≤ due). skip: the shift's one rude incident is used up.
          const m=cafe.crew.find(m=>m.id===choice?.id),i=m?.incident;if(!i||i.done)return fail('Không có sự cố.');if(m.paidUntil-at>i.due)return fail('Chưa tới lúc.');
          const giftOn=cafe.crew.some(s=>s.gift&&s.paidUntil>at&&!s.rest);
          const applied=i.type!=='none'&&!choice.skip&&candidateById(m.id).kind!=='robot'&&i.for>INCIDENTS.grace&&cafeActive&&cafe.open&&!giftOn&&cafe.reputation>=INCIDENTS.minRep;
          i.done=true;if(applied&&i.type==='sick')m.rest=CAFE_SHIFT_MS;
          extra={type:i.type,applied};
        }else if(action==='buy'){
          const supply=SUPPLIES.find(s=>s.id===choice);if(!supply)return fail('Không có nguyên liệu này.');if(progress.coins<supply.price)return fail(`Thiếu ${Math.round((supply.price-progress.coins)*100)/100} xu.`);
          money(-supply.price,'cafe-cost',at,supply.name);cafe.costs+=supply.price;cafe.supplies[supply.id]+=supply.pack;message=`Đã nhập ${supply.name} · ${supply.packLabel}.`;
        }else if(action==='gear'){
          const gear=GEAR.find(g=>g.id===choice);if(!gear)return fail('Không có thiết bị này.');const lv=cafe.gear[gear.id];if(lv>=gear.prices.length)return fail('Đã đạt cấp tối đa.');
          const price=gear.prices[lv];if(progress.coins<price)return fail(`Thiếu ${Math.round((price-progress.coins)*100)/100} xu.`);
          money(-price,'upgrade',at,gear.name);cafe.gear[gear.id]++;message=`${gear.name} lên cấp ${cafe.gear[gear.id]}.`;
        }else if(action==='hire'){
          // Hiring a new person, or paying a new day for someone whose shift ended.
          // Robots hire per shift like people (no packs: a `pack` field is ignored), only once the farm Staff button is open. Gift robots are never for hire.
          const hireId=idOf(choice),person=candidateById(hireId),role=roleOf(hireId);if(!person)return fail('Không có ứng viên này.');
          if(person.giftOnly)return fail('Robot này chỉ có trong gói thử.');
          if(person.kind==='robot'&&!workersOpen())return fail('Mở Nhân viên ở farm trước.');
          const member=cafe.crew.find(m=>m.id===person.id);if(member?.paidUntil>at)return fail(`${person.person} đang trong ca.`);
          const crew=cafe.crew.filter(m=>!m.gift); // gift robots do not take crew or role slots
          if(!member&&crew.length>=MAX_CREW)return fail(`Quán tối đa ${MAX_CREW} nhân viên.`);
          if(!member&&crew.filter(m=>roleOf(m.id).id===role.id).length>=role.max)return fail(`Đã đủ ${role.max} ${role.name.toLowerCase()}.`);
          const wage=staffWage(role,member?.level||1,person);if(progress.coins<wage)return fail(`Cần ${wage} xu trả lương ca đầu.`);
          money(-wage,'wage',at,person.person);const target=member||{id:person.id,level:1,paidUntil:0,shifts:0,incident:null,rest:0,gift:false};if(!member)cafe.crew.push(target);
          target.paidUntil=at+CAFE_SHIFT_MS;cafeShiftPaid(target,at);message=`${person.person} (${role.name}) đã vào ca · ${wage} xu/ca.`;
        }else if(action==='train'){
          const member=cafe.crew.find(m=>m.id===choice);if(!member)return fail('Thuê nhân viên trước khi đào tạo.');if(member.gift||candidateById(member.id).kind==='robot')return fail('Robot không đào tạo được.');if(member.level>=STAFF_MAX)return fail('Đã đạt cấp tối đa.');
          const cost=trainCost(member.level);if(progress.coins<cost)return fail(`Thiếu ${Math.round((cost-progress.coins)*100)/100} xu.`);
          money(-cost,'training',at,candidateById(member.id).person);member.level++;message=`${candidateById(member.id).person} lên cấp ${member.level}.`;
        }else if(action==='shift'){
          // End-of-shift reward; the scene reports its counts, bounded so a tampered report cannot mint coins.
          // Three tiers from the bronze goal (cafe-fun-review P1); the model derives the tier itself from the clamped counts.
          const served=clamp(integer(choice?.served),0,200),goal=clamp(integer(choice?.goal),1,200),good=finite(choice?.avg)>=2;
          const tier=!good?0:served>=Math.ceil(goal*SHIFT_TIERS[2])?3:served>=Math.ceil(goal*SHIFT_TIERS[1])?2:served>=goal?1:0;
          const bonus=Math.min(300,served*[0,3,4,5][tier]),rep=tier||(served<Math.ceil(goal/2)?-1:0);
          if(bonus)money(bonus,'cafe-sale',at,'Thưởng ca');cafe.reputation=clamp(cafe.reputation+rep,10,100);
          const medal=['','Đồng','Bạc','Vàng'][tier];
          extra={bonus,met:tier>0,tier,rep};message=tier?`Đạt mốc ${medal} · thưởng ${bonus} xu · Uy tín +${rep}`:`Chưa đạt mốc Đồng${rep?' · Uy tín −1':' · không trừ uy tín'}`;
        }else if(action==='table'){
          const i=integer(choice),indoor=assetValue(ASSETS.find(a=>a.id==='cafe'),progress.upgrades.cafe);
          // Indoor tables open with the café upgrade; the two garden tables (10, 11) with Sân vườn.
          if(!Number.isInteger(choice)||i<0||i>=MAX_TABLES||(i<10?i>=indoor:!cafe.gear.terrace))return fail('Bàn chưa mở.');
          const lv=cafe.tables[i];if(lv>=TABLE_LEVELS.length)return fail('Bàn đã tối đa.');const price=TABLE_LEVELS[lv].price;
          if(progress.coins<price)return fail(`Thiếu ${Math.round((price-progress.coins)*100)/100} xu.`);
          money(-price,'upgrade',at,`Bàn ${i+1}`);cafe.tables[i]++;message=`Bàn ${i+1}: ${TABLE_LEVELS[cafe.tables[i]-1].name}.`;
        }else if(action==='fire'){
          if(!cafe.crew.some(m=>m.id===choice))return fail('Chưa thuê người này.');if(cafe.crew.some(m=>m.id===choice&&m.gift))return fail('Robot gói thử tự rời quán khi hết ca.');cafe.crew=cafe.crew.filter(m=>m.id!==choice);message=`${candidateById(choice).person} đã nghỉ việc.`;
        }else if(action==='order'){
          const crop=cropById(choice);if(!crop||crop.level>level())return fail('Giống này chưa mở ở nông trại.');
          if(progress.orders.filter(o=>o.source!=='shop'&&['open','transit'].includes(o.status)).length>=4)return fail('Nông trại đang có 4 đơn; chờ giao bớt.');
          progress.orders.push({id:nextId('order'),day:weatherAt(at).day,cropId:crop.id,grams:252,status:'open',workers:[],deadline:at+DAY_MS*8,createdAt:at,source:'cafe'});message=`Đã gửi đơn 252 g hạt rang ${crop.short} sang nông trại.`;
        }else return fail('Không có thao tác quán này.');
      }else if(id==='lessons'){
        const lesson=lessonOf(choice?.questionId),L=progress.lessons;
        if(action!=='answer'||!lesson)return fail('Không có câu hỏi này.');
        const {question}=lesson;if(L.learned.includes(question.id))return fail('Bạn đã thuộc mẹo này.');
        if(!askable(question.id,at))return fail('Hôm nay đã ôn rồi · quay lại ngày công sau.');
        if(!question.options.some(o=>o.id===choice.optionId))return fail('Chọn một đáp án.');
        const correct=choice.optionId===question.correct,day=workDay(at),perk=LESSON_PERKS[question.id];
        if(L.askedDay!==day){L.askedDay=day;L.askedCount=0;}L.askedCount++;
        if(correct){L.learned.push(question.id);grantLessons(at);extra={correct,explanation:answerText(question,true),perk:{id:question.id,...perk}};message=`🎓 Mẹo mới: ${perk.name} · ${perk.effect}`;}
        else{L.asked[question.id]=day;extra={correct,explanation:answerText(question,false)};message='Chưa nhận mẹo · sẽ được hỏi lại ngày công sau.';}
      }else if(id==='tutorial'){
        if(action!=='seen'||!tutorialId(choice))return fail('Không có hướng dẫn này.');
        if(!progress.tutorial.seen.includes(choice))progress.tutorial.seen.push(choice);
      }else if(id==='fence'&&action==='repair'){
        if(progress.coins<5)return fail('Cần 5 xu bảo trì.');money(-5,'maintenance',at,'Hàng rào');progress.durability=100;message='Đã bảo trì hàng rào.';
      }else if(field){
        if(action!=='expand'||owned.includes(id)||!adjacent(id))return fail('Mở ruộng liền kề trước.');if(progress.coins<field.price)return fail(`Cần ${field.price} xu.`);
        money(-field.price,'land',at,field.name);owned.push(id);for(const tree of progress.plots)tree.unlocked=owned.includes(PLOTS.find(c=>c.id===tree.id).fieldId);progress.stats.expanded++;progress.xp+=10;message=`Đã mở ${field.name}: 12 ô.`;
      }else if(p){
        if(!p.unlocked)return fail('Ruộng chưa được mở.');const care=plotCare(p);
        if(action==='plant'){
          const crop=cropById(choice);if(!crop||p.stage!=='empty'||crop.level>level()||!progress.seeds[crop.id])return fail('Cần ô trống và cây giống phù hợp.');
          progress.seeds[crop.id]--;Object.assign(p,{cropId:crop.id,stage:'planted',mature:false,growthMs:0,water:50,weeds:0,fertilized:false,readyYield:0,remainingFruit:0,secondPick:0,quality:80,health:100,pruned:false});message='Đã trồng cây giống. Cây kiến thiết trước khi cho vụ đầu.';
        }else if(action==='clear'){
          if(p.stage==='empty')return fail('Ô đã trống.');Object.assign(p,{stage:'empty',mature:false,growthMs:0,readyYield:0,remainingFruit:0,secondPick:0,fertilized:false});message='Đã cuốc bỏ cây; không hoàn cây giống.';
        }else if(action==='water'){
          if(!care.needsWater)return fail('Cây chưa cần tưới.');
          const w=progress.workers.find(w=>w.id===owner);if(w){if(!w.water)return fail('Nhân viên cần lấy nước.');w.water--;}else{if(!progress.water)return fail('Bình hết nước; tới giếng.');progress.water--;}
          p.water=70;if(owner==='player')progress.stats.watered++;message='Đã tưới vừa đủ cho cây.';
        }else if(action==='weed'){
          if(!care.needsWeeding)return fail('Chưa cần làm cỏ.');p.weeds=0;if(owner==='player')progress.stats.weeded++;message='Đã làm cỏ.';
        }else if(action==='fertilize'){
          if(!care.canFeed||!progress.fertilizer)return fail('Cây chưa đúng giai đoạn bón hoặc thiếu phân.');progress.fertilizer--;p.fertilized=true;message='Đã bón đủ liều vụ này.';
        }else if(action==='prune'){
          if(!p.mature||p.stage==='ready'||p.growthMs/cropById(p.cropId).regrowMs>.17||p.pruned)return fail('Chỉ tỉa một lần trong đợt phục hồi.');p.pruned=true;message='Đã tỉa cành phục hồi tán.';
        }else if(action==='harvest'){
          if(!care.ready)return fail('Quả chưa chín.');if(usedStorage()+p.readyYield>storageCapacity())return fail(`Kho còn ${storageCapacity()-usedStorage()} g, đợt hái cần ${p.readyYield} g. Bán, chế biến hoặc nâng kho trước.`);
          const amount=p.readyYield;
          add('cherries',p.cropId,amount,owner==='player'&&progress.lessons.learned.includes('ripe')?p.quality+5:p.quality,at,'farm',p.id); // add() caps at 100
          if(owner==='player')progress.stats.harvested++;progress.today.harvested+=amount;progress.xp+=6;
          Object.assign(p,{stage:'growing',growthMs:0,readyYield:0,remainingFruit:0,secondPick:0,fertilized:false,pruned:false,season:p.season+1});
          collected=true;message=`Đã hái ${amount} g quả chín; cây tiếp tục sống.`;
        }else return fail('Không có việc này.');
      }else if(m){
        const state=progress.machines[id],lv=progress.upgrades[id],jobs=jobsOf(state);
        if(action==='start'){
          const crop=cropById(typeof choice==='object'?choice?.cropId:choice);if(!crop)return fail('Chọn loại cà phê.');
          const available=Math.floor(progress.stock[m.input][crop.id]/m.inputCount),asked=typeof choice==='object'?integer(choice.quantity):available;
          if(!asked||asked>available)return fail(`Thiếu nguyên liệu; mỗi đơn vị cần ${m.inputCount} g.`);
          if(jobs.length>=48)return fail('Hàng chờ đã đầy, chờ hoặc nhận thành phẩm.');
          const perBatch=Math.max(1,Math.floor(m.capacity*capacityScale(lv)/m.inputCount));
          // Queue what fits in the 48-batch line instead of refusing the whole request (large stocks used to block processing forever).
          const requested=Math.min(asked,(48-jobs.length)*perBatch);
          const inputLots=take(m.input,crop.id,requested*m.inputCount),quality=qualityOf(inputLots);
          let left=requested,startAt=Math.max(at,...jobs.map(j=>j.readyAt)),duration=Math.round(m.duration/efficiency(lv));
          while(left){const n=Math.min(left,perBatch);jobs.push({id:nextId('batch'),cropId:crop.id,quantity:n,inputGrams:n*m.inputCount,outputGrams:n*m.outputCount,quality,origin:inputLots.map(l=>l.id).join(','),startedAt:startAt,readyAt:startAt+duration,turned:false});left-=n;startAt+=duration;}
          putJobs(state,jobs);message=requested<asked?`Đã xếp ${requested}/${asked} phần; hàng chờ đủ 48 mẻ, phần còn lại giữ trong kho.`:'Đã giữ nguyên liệu và xếp mẻ theo công suất trạm.';
        }else if(action==='collect'){
          const ready=jobs.filter(j=>j.readyAt<=at&&(!choice||j.id===choice));if(!ready.length)return fail('Mẻ này chưa hoàn tất hoặc đã được nhận.');
          let space=storageCapacity()-usedStorage();const done=[];
          for(const job of ready){if(job.outputGrams<=space){done.push(job);space-=job.outputGrams;}}
          if(!done.length){const required=Math.min(...ready.map(j=>j.outputGrams));return fail(`Kho đang chứa ${formatMass(usedStorage())} / ${formatMass(storageCapacity())}, chỉ còn trống ${formatMass(Math.max(0,space))}. Mẻ nhỏ nhất cần ${formatMass(required)}: thiếu ${formatMass(Math.max(0,required-space))} chỗ. Hãy bán bớt hàng, chuyển cà phê về quán hoặc nâng cấp kho. Thành phẩm vẫn được giữ tại trạm.`);}
          const mass=done.reduce((sum,j)=>sum+j.outputGrams,0);
          for(const j of done)add(m.output,j.cropId,j.outputGrams,j.quality,at,'farm',j.origin||id);
          if(owner==='player')progress.stats[m.output]+=mass;progress.today.processed+=mass;progress.xp+=4*done.length;putJobs(state,jobs.filter(j=>!done.includes(j)));message=`Đã nhận ${done.length} mẻ · ${formatMass(mass)} ${productById(m.output).name.toLowerCase()} vào kho.${done.length<ready.length?` Còn ${ready.length-done.length} mẻ chờ tại trạm vì kho chưa đủ chỗ.`:''}`;collected=true;
        }else if(action==='turn'&&id==='dryer'){
          const j=jobs.find(j=>!j.turned&&at>=(j.startedAt+j.readyAt)/2&&at<j.readyAt);if(!j)return fail('Chưa đến lúc đảo.');j.turned=true;j.quality=Math.min(100,j.quality+2);message='Đã đảo đều mẻ phơi; chất lượng đồng đều hơn.';
        }else if(action==='cancel'){
          const j=jobs.find(j=>j.id===choice&&j.startedAt>at);if(!j)return fail('Chỉ hủy mẻ chưa chạy.');add(m.input,j.cropId,j.inputGrams,j.quality,at,'farm','returned');putJobs(state,jobs.filter(job=>job!==j));message='Đã hủy mẻ chờ và trả nguyên liệu.';
        }else return fail('Không có thao tác này.');
      }else if(id==='directives'){
        const d=progress.directives,names={care:'Tự chăm vườn',plant:'Trồng lấp ô trống',process:'Tự chế biến',fertilize:'Dùng phân bón'};
        if(action==='toggle'&&names[choice]){d[choice]=!d[choice];message=`${names[choice]}: ${d[choice]?'bật':'tắt'}.`;}
        else if(action==='crop'){const allowed=CROPS.filter(c=>c.level<=level()),next=allowed[(allowed.findIndex(c=>c.id===d.plantCrop)+1)%allowed.length];d.plantCrop=next.id;message=`Giống trồng lấp ô: ${next.name}.`;}
        else return fail('Không có chỉ thị này.');
      }else if(id==='well'&&action==='refill'){
        const w=progress.workers.find(w=>w.id===owner),current=w?.water||(!w?progress.water:0),needed=waterCapacity()-current,amount=Math.min(needed,Math.floor(progress.reservoir));
        if(amount<1)return fail('Bình đã đầy hoặc cần chờ nước hồi; ao có cá giữ lại 15 nước.');progress.reservoir-=amount;if(w)w.water=current+amount;else progress.water=current+amount;message=`Đã lấy ${amount} lượt nước.`;
      }else if(id==='seed-shop'){
        const quantity=typeof choice==='object'&&choice!==null?choice.quantity:1;
        if(!Number.isInteger(quantity)||quantity<1||quantity>99)return fail('Số lượng mua phải từ 1 đến 99.');
        if(action==='buySeed'){
          const c=cropById(typeof choice==='object'?choice.cropId:choice);
          if(!c||c.level>level()||progress.coins<c.seedPrice*quantity)return fail('Thiếu xu hoặc chưa mở giống.');
          money(-c.seedPrice*quantity,'seedling',at,c.name);progress.seeds[c.id]+=quantity;message=`+${quantity} cây giống ${c.short}.`;
        }else if(action==='fertilizer'){
          if(progress.coins<FERTILIZER_PRICE*quantity)return fail('Chưa đủ xu.');
          money(-FERTILIZER_PRICE*quantity,'fertilizer',at,'Phân');progress.fertilizer+=quantity;message=`+${quantity} túi phân.`;
        }else return fail('Không có mặt hàng này.');
      }else if(id==='market'){
        if(action==='acceptOrder'){
          if(!progress.order.accepted){progress.order.accepted=true;progress.order.deadline=at+8*DAY_MS;}
          progress.order.workers=[];message='Đã nhận đơn bán ở Chợ. Bạn tự chuẩn bị đủ hàng rồi quay lại bán lấy xu.';
        }else if(action==='order'){
          const o=progress.order;if(choice&&choice!==o.id)return fail('Đơn đã thay đổi, mở lại danh sách.');if(progress.stock[o.product][o.cropId]<o.quantity)return fail('Chưa đủ hàng.');
          if(o.product==='roasted'&&progress.cafe.reserve&&Object.values(progress.stock.roasted).reduce((s,n)=>s+n,0)-o.quantity<demand().needed)return fail('Phần hạt này đang giữ cho quán; có thể tắt giữ hàng tại quán.');
          progress.orders.push({...o,grams:o.quantity,status:'delivered',source:'shop',rating:5,day:weatherAt(at).day,workers:o.workers||[]});take(o.product,o.cropId,o.quantity);money(o.reward,'order',at,'Đơn thu mua');progress.stats.sold+=o.quantity;progress.stats.orders++;log('Giao đơn shop đúng hạn',at);progress.xp+=o.xp;progress.orderIndex++;progress.order=makeOrder(at);message='Đã giao đơn thu mua.';
        }else if(action==='sell'){
          const [product,cropId]=String(typeof choice==='object'?choice.item:choice).split(':'),item=productById(product);
          const grams=typeof choice==='object'?choice.grams:progress.stock[product]?.[cropId]||0;
          const quote=saleQuote(product,cropId,grams);
          if(!quote.ok)return fail(quote.message);
          // XP follows coins earned so splitting a sale into 1 g clicks gains nothing.
          take(product,cropId,grams);money(quote.value,'sale',at,item.name);progress.market.sold+=quote.base;progress.stats.sold+=grams;progress.xp+=Math.floor(quote.value/2);message=`Bán ${grams} g · +${quote.value} xu.`;
        }else return fail('Không có giao dịch.');
      }else return fail('Không có điểm tương tác.');
      if(!['permission','mode','role','seed','autoPay','reserve','toggle','crop','brew','sell','lost','buy','shift','answer','seen','incident','remind','giftReport'].includes(action)){const person=progress.workers.find(w=>w.id===owner);log(`${person?person.name:'Bạn'}: ${message}`,at);}
      progress.workRevision++;const earned=rewards();grantGift(at);commit(at);return {ok:true,message,collected,quests:earned,...extra};
    },
  };
  // Gift after the load-time advance so offline time is not added to the gift shift.
  refreshDaily(now);advance(now);grantGift(now);commit(now);return api;
}
// Migration ids are independent from new lot ids and need no persisted counter.
let savedSequence=0;
