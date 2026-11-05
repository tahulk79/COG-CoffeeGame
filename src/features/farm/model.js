import { DECORATIONS,decorationError,relocateDecorations } from './decorations.js';
import { CROPS,FIELDS,PLOTS,MACHINES,PRODUCTS,questsFor,CARE,TUTORIAL_IDS,HUD_UNLOCKS,plotCare,cropById,productById,levelFor } from './content.js';
import { EXPERTS } from '../heaven/content.js';
import { answerText } from '../heaven/journey.js';
import { AUTO_BREW_COST,resolveUses,ingredientBonus,MILKS,WATERS,DEFAULT_PREFS,OWN_CUP,GREEDY_P,clampPrice,priceOf,tipFactor,SHIFT_TIERS,SUPPLIES,GEAR,MAX_CREW,STAFF_MAX,TABLE_LEVELS,MAX_TABLES,staffWage,trainCost,roleOf,candidateById,recipeById,missingFor,gearBonus } from '../cafe/recipes.js';
import { MARKET_DAILY,AUTOPLAY,FARM_SLOTS,activeJobs,jobGroupOf,groupLimit,nextGroupLevel,JOB_GROUPS,CARE_JOBS,DAY_MS,SEASON_MS,OFFLINE_MS,CAFE_SHIFT_MS,FERTILIZER_PRICE,supplierPrice,ORDERS_PER_DAY,RELIEF_GRAMS,careYield,careQuality,marketQualityFactor,orderPay,regionCrop,ASSETS,assetMaxLevel,upgradeRequirement,capacityScale,efficiency,upgradePrice,assetValue,WORKER_CANDIDATES,workerLevel,workerStat,WORKER_JOBS,workerWage,formatMass,WORK_DAY_MS,contractPlan,contractPrice,marketValue,ROBOT_PACKS,packPrice,INCIDENTS,incidentOdds } from './rules.js';
import { MARKET_XP_CAP,MEMORY_XP_CAP,MEMORY_XP,DECODE_XP,MASTERY_XP,DISCOVERY_KEYS,tiersFor,economicStatus,emptyVictories } from './progression.js';
import { normalizeAwakening,awaken,cleanList,SHIFT_SCHEMA } from '../awakening/rules.js';
import { list as memoryList } from '../../state/memory.js';
import { t } from '../../i18n/index.js';
import { DEV_START_COINS } from '../../state/storage-keys.js';
import { regionId,regionType } from '../world-map/content.js';
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
// Hội đồng so le (05/11/2026, F-45, đề xuất Q1): thứ tự xếp hàng chuyên gia khi nhiều người cùng có mặt.
const EXPERT_IDS=EXPERTS.map(e=>e.id);
export const LESSON_PERKS=Object.fromEntries(EXPERTS.flatMap(e=>e.questions.map(q=>[q.id,q.perk])));
const tutorialId=id=>TUTORIAL_IDS.includes(id)||typeof id==='string'&&/^unlock-[a-z-]+$/.test(id);
// Robots vs people (robot-staff.md, contracts.md 6). Robot traits always come from the candidate lists, never the save.
// Turning on a job group the person does not do yet must stay within groupLimit (crew-autoplay.md 2).
const overLimit=(w,group)=>{const groups=new Set([...activeJobs(w)].map(jobGroupOf));if(groups.has(group)||groups.size<groupLimit(w))return null;const next=nextGroupLevel(w);return t('crew.err.groupLimit',{n:groupLimit(w),level:workerLevel(w.xp),next:next||'—'});};
const isRobot=w=>WORKER_CANDIDATES.find(c=>c.id===w?.id)?.kind==='robot';
const canDo=(w,job)=>{const jobs=WORKER_CANDIDATES.find(c=>c.id===w.id)?.jobs;return !jobs||jobs.includes(job);};
const idOf=choice=>choice&&typeof choice==='object'?choice.id:choice;
const incidentOf=(i,types)=>i&&typeof i==='object'&&Number.isFinite(i.for)?{for:integer(i.for),type:types.includes(i.type)?i.type:'none',due:Math.max(0,finite(i.due)),done:i.done===true}:null;
// One roll per paid shift; due = ms left in the shift when it fires (sick fires as soon as the paid shift starts).
function rollIncident(count,length,odds){const u=Math.random(),type=u<odds.sick?'sick':u<odds.sick+odds.phone?'phone':u<odds.sick+odds.phone+odds.rude?'rude':'none';return {for:count,type,due:type==='sick'?length:Math.round(length*(.2+.6*Math.random())),done:type==='none'};}
const sickNow=(w,at)=>w.incident?.type==='sick'&&w.incident.done&&w.restUntil>at;
const GIFT_RECIPES=['phin-den','nau-da'],GIFT_CUPS=10;

// heavenMet: questionId đã trả lời (đúng hay sai) ở thiên đàng cũ, để suy ra `lessons.met` (F-45).
export function createFarm(saved,startingGift,onSave,now=Date.now(),heavenLessons=[],startingRegion,heavenMet=[]) {
  // Nơi trùng sinh: save có sẵn giữ nơi của nó (save cũ thiếu → Việt Nam); save mới lấy nơi chọn trên bản đồ.
  const region=regionId(saved?saved.region:startingRegion),QUESTS=questsFor(region);
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
  // F-45: met = câu đã gặp chuyên gia (Hội đồng hoặc thiên đàng cũ). Save thiếu trường suy ra từ câu đã trả lời ở thiên đàng;
  // câu đã thuộc hoặc đã trả lời sai ở farm cũng là đã gặp. arrived = chuyên gia đã có mặt ở Hội đồng (mốc đã qua, không mất).
  lessons.met=lessonIds([...(Array.isArray(savedLessons.met)?savedLessons.met:[]),...(Array.isArray(heavenMet)?heavenMet:[]),...lessons.learned,...Object.keys(lessons.asked)]);
  lessons.arrived=Array.isArray(savedLessons.arrived)?EXPERT_IDS.filter(id=>savedLessons.arrived.includes(id)):[];
  const decor=relocateDecorations(objects(saved?.decorations).filter(item=>DECORATIONS.some(spec=>spec.id===item.type)&&[item.x,item.z,item.rotation].every(Number.isFinite)).slice(0,100).map(item=>({...item,text:String(item.text||'').slice(0,24),state:item.state==='construction'?'construction':'complete',buildMs:Math.max(0,Number(item.buildMs)||0),buildDuration:Math.max(1000,Number(item.buildDuration)||5000)})),region);
  const progress={
    region,
    lessons,tutorial:{seen:Array.isArray(saved?.tutorial?.seen)?saved.tutorial.seen.filter((id,i,list)=>tutorialId(id)&&list.indexOf(id)===i).slice(0,100):[]},
    decorations:decor.items, // CT-14: đồ cũ trong vùng cấm xây của công trình mới tự dời
    staffRoutineVersion:1,workRevision:integer(saved?.workRevision),version:3,timingVersion:3,deploymentVersion:1,gift:saved?.gift||startingGift||null,fields:owned,archivedLand:clone(saved?.archivedLand||{fields:[],plots:[]}),
    coins:saved?Math.round(clamp(finite(saved.coins,200),0,5e13)*100)/100:(DEV_START_COINS??200),giftApplied:saved?.giftApplied===true,xp:integer(saved?.xp),upgrades,
    seeds:Object.fromEntries(CROPS.map(c=>[c.id,integer(legacy||modern?saved.seeds?.[c.id]:c.id==='robusta'?(saved?.version===1?integer(saved.seeds):6):0)])),
    fertilizer:valid?integer(saved.fertilizer):6,water:valid?Math.min(integer(saved.water),6+4*(upgrades.well-1)+2*lessons.learned.includes('water')):6+2*lessons.learned.includes('water'),canLevel:upgrades.well,
    legacyBackup:modern?(saved.legacyBackup||null):valid?clone(saved):null,
    stock,lots:modern?clone(objects(saved.lots)):[],sequence:integer(saved?.sequence),
    stats:Object.fromEntries(['harvested','watered','weeded','dried','roasted','ground','sold','beansSold','expanded','orders','delivered','served'].map(k=>[k,integer(saved?.stats?.[k])])),
    claimed:Array.isArray(saved?.claimed)?saved.claimed.filter(id=>QUESTS.some(q=>q.id===id)):[],
    orderIndex:integer(saved?.orderIndex),order:null,lastAt:Math.min(now,finite(saved?.lastAt,now)),epoch:finite(saved?.epoch,now),
    reservoir:modern?clamp(finite(saved.reservoir,60),0,10000):60,durability:modern?clamp(finite(saved.durability,100),0,100):100,
    rejectedCandidates:Array.isArray(saved?.rejectedCandidates)?saved.rejectedCandidates.filter(id=>WORKER_CANDIDATES.some(w=>w.id===id&&w.kind!=='robot')):[],
    // restUntil survives a reload only while the worker is on a fired sick incident (otherwise reload would cure them after shiftUntil moved).
    workers:modern?objects(saved.workers).filter(w=>WORKER_CANDIDATES.some(c=>c.id===w.id)).map((w,index)=>{const c=WORKER_CANDIDATES.find(c=>c.id===w.id),incident=incidentOf(w.incident,['none','phone','sick']);return {...clone(w),name:c.name,bio:c.bio,kind:c.kind||'human',incident,stats:clone(c.stats),farmId:saved.deploymentVersion===1?(w.farmId==='farm-0'?'farm-0':null):index<2?'farm-0':null,xp:c.kind==='robot'?0:integer(w.xp),enabled:w.enabled!==false,energy:100,restUntil:incident?.type==='sick'&&incident.done?finite(w.restUntil):0,role:['auto','care','processing'].includes(w.role)?w.role:'auto'};}):[],
    cafe:modern&&saved.cafe&&typeof saved.cafe==='object'&&!Array.isArray(saved.cafe)?clone(saved.cafe):{stock:emptyStock(),lots:[],shipments:[],open:false,reputation:50,served:0,lost:0,revenue:0,costs:0,autoSupply:true,reserve:false,reliefDay:-1},
    today:saved?.today?clone(saved.today):{day:0,harvested:0,processed:0,revenue:0},
    market:{day:finite(saved?.market?.day,-1),sold:Math.max(0,finite(saved?.market?.sold)),orders:Math.max(0,integer(saved?.market?.orders)),xp:clamp(integer(saved?.market?.xp),0,MARKET_XP_CAP)},
    memoryXp:{day:finite(saved?.memoryXp?.day,-1),xp:clamp(integer(saved?.memoryXp?.xp),0,MEMORY_XP_CAP)},
    victories:{economic:Number.isFinite(saved?.victories?.economic)?saved.victories.economic:null,discovery:Number.isFinite(saved?.victories?.discovery)?saved.victories.discovery:null},
    awakening:normalizeAwakening(saved?.awakening), // F-35 decode-awaken.md 7; mirrored to top level by saveFarm
    orders:modern?clone(objects(saved.orders)):[],dailyTasks:[],lastOrderDay:modern?integer(saved.lastOrderDay):0,lastTaskCycle:modern?integer(saved.lastTaskCycle):0,contractVersion:1,
    // Farm-wide standing orders for staff; work no longer depends on a café order existing.
    // Auto mode (crew-autoplay.md 5): free runs left and time left in the current run; only ticks while Auto plays.
    autoplay:{runs:clamp(integer(saved?.autoplay?.runs??AUTOPLAY.runs),0,AUTOPLAY.runs),leftMs:clamp(finite(saved?.autoplay?.leftMs),0,AUTOPLAY.runMs)},
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
  // CT-14: món không còn chỗ dời (chưa có kho đồ trang trí) thì hoàn đủ giá, không mất của.
  if(decor.returned.length)progress.coins=Math.round((progress.coins+decor.returned.reduce((sum,item)=>sum+DECORATIONS.find(spec=>spec.id===item.type).price,0))*100)/100;
  if(modern&&!saved.timingVersion)for(const m of MACHINES){const state=progress.machines[m.id],jobs=jobsOf(state);let cursor=now;for(const j of jobs){if(j.readyAt<=now)continue;const ratio=j.startedAt<=now?clamp((now-j.startedAt)/Math.max(1,j.readyAt-j.startedAt),0,1):0,duration=m.duration/efficiency(state.level);j.startedAt=cursor-ratio*duration;j.readyAt=j.startedAt+duration;cursor=j.readyAt;}putJobs(state,jobs);}
  progress.cafe.shipments=objects(progress.cafe.shipments).filter(t=>Array.isArray(t.lots)&&Number.isFinite(t.readyAt));
  {
    // Customers live in the cafe scene session; only stock, gear, staff and mastery persist.
    const cafe=progress.cafe;delete cafe.customers;delete cafe.brew;delete cafe.extraBrews;delete cafe.nextCustomerAt;
    cafe.reputation=clamp(finite(cafe.reputation,50),10,100);
    // F-35: last 10 shifts (decode-awaken.md 7) + cumulative wages/beans paid; marks = totals at the last logged shift.
    cafe.shiftLog=cleanList(cafe.shiftLog,SHIFT_SCHEMA,10).map(s=>({...s,meanPrice:s.meanPrice||1}));
    {const pd=cafe.paid&&typeof cafe.paid==='object'?cafe.paid:{},pos=v=>Math.max(0,finite(v));cafe.paid={wages:pos(pd.wages),beans:pos(pd.beans),markW:Math.min(pos(pd.markW),pos(pd.wages)),markB:Math.min(pos(pd.markB),pos(pd.beans))};}
    // F-42: unknown recipes dropped, p clamped and rounded (exploit guard); p=1 is not stored.
    cafe.prices=Object.fromEntries(Object.entries(cafe.prices&&typeof cafe.prices==='object'&&!Array.isArray(cafe.prices)?cafe.prices:{}).filter(([id])=>recipeById(id)).map(([id,p])=>[id,clampPrice(p)]).filter(([,p])=>p!==1));
    cafe.supplies=Object.fromEntries(SUPPLIES.map(s=>[s.id,integer(cafe.supplies?cafe.supplies[s.id]:s.start,1e7)]));
    // Pantry choice of milk brand and brew water (04-cafe/rules.md "Sữa và nước").
    cafe.prefs={milk:MILKS.includes(cafe.prefs?.milk)?cafe.prefs.milk:DEFAULT_PREFS.milk,water:WATERS.includes(cafe.prefs?.water)?cafe.prefs.water:DEFAULT_PREFS.water};
    cafe.gear=Object.fromEntries(GEAR.map(g=>[g.id,clamp(integer(cafe.gear?.[g.id]??g.start),g.start,g.prices.length)]));
    // Crew is a list of hired candidates (max 10); older saves stored one person per role.
    const legacyCrew=Object.entries(cafe.staff||{}).map(([role,s])=>({...s,id:{cashier:'mai',waiter:'tuan',barista:'khoa'}[role]}));
    // Draft saves (before round 2) stored the gift barista as robo-pha and the gift waiter as robo-b* with gift:true.
    const renamed=m=>m?.id==='robo-pha'?{...m,id:'gift-pha',gift:true}:m?.gift===true&&/^robo-b/.test(m.id)?{...m,id:'gift-bung'}:m;
    let hired=0; // gift members do not count toward MAX_CREW
    cafe.crew=(Array.isArray(cafe.crew)?cafe.crew:legacyCrew).map(renamed).filter((m,i,list)=>candidateById(m?.id)&&list.findIndex(o=>o.id===m.id)===i&&(m.gift===true||++hired<=MAX_CREW)).map(m=>({id:m.id,level:clamp(integer(m.level),1,STAFF_MAX),paidUntil:finite(m.paidUntil),shifts:integer(m.shifts),incident:incidentOf(m.incident,['none','phone','sick','rude']),rest:clamp(finite(m.rest),0,CAFE_SHIFT_MS),gift:m.gift===true}));
    delete cafe.staff;
    cafe.tables=Array.from({length:MAX_TABLES},(_,i)=>clamp(integer(cafe.tables?.[i]),1,TABLE_LEVELS.length));
    cafe.mastery=Object.fromEntries(Object.entries(cafe.mastery||{}).filter(([id])=>recipeById(id)).map(([id,m])=>[id,{best:clamp(finite(m?.best),0,100),made:integer(m?.made),tiers:tiersFor(clamp(finite(m?.best),0,100))}]));
    // One-time robot trial gift. Unknown state → done (never granted twice); a ready/active gift with no gift crew left is over.
    const g=saved?.robotGift,tallyOf=(t,robot)=>({cups:integer(t?.cups),stars:Math.max(0,finite(t?.stars)),paid:Math.max(0,finite(t?.paid)),cost:Math.max(0,finite(t?.cost)),...(robot?{walked:integer(t?.walked)}:{})});
    progress.robotGift=g&&typeof g==='object'?{state:['locked','ready','active','done'].includes(g.state)?g.state:'done',cups:clamp(integer(g.cups),0,GIFT_CUPS),walkRep:clamp(finite(g.walkRep),0,2),reported:g.reported===true,tally:g.state!=='locked'||g.tally&&typeof g.tally==='object'?{you:tallyOf(g.tally?.you),robot:tallyOf(g.tally?.robot,true)}:null}:{state:'locked',cups:0,walkRep:0,reported:false,tally:null};
    if(['ready','active'].includes(progress.robotGift.state)&&!cafe.crew.some(m=>m.gift))progress.robotGift.state='done';
  }
  // Three shared slots; saved job switches are trimmed to what the worker can do at its level (crew-autoplay.md 2).
  let deployed=0;for(const worker of progress.workers){if(worker.farmId==='farm-0'&&++deployed>FARM_SLOTS)worker.farmId=null;if(saved.staffRoutineVersion!==1){worker.autoPay=true;worker.workMode='auto';}if(saved.contractVersion!==1&&finite(worker.shiftUntil)>now)worker.shiftUntil=now+WORK_DAY_MS;worker.contractPlan=contractPlan(worker).id;worker.autoPay=worker.autoPay===true;worker.workMode=worker.workMode==='auto'?'auto':'assigned';worker.jobs=Object.fromEntries(WORKER_JOBS.map(([id])=>[id,worker.jobs?.[id]!==false&&canDo(worker,id)]));{const keep=activeJobs({...worker,kind:isRobot(worker)?'robot':'human'});for(const key of Object.keys(worker.jobs))worker.jobs[key]=keep.has(key);}worker.preferredCrop=cropById(worker.preferredCrop)?.id||'robusta';worker.cargo=Array.isArray(worker.cargo)?worker.cargo:[];worker.water=integer(worker.water,42);worker.shiftUntil=finite(worker.shiftUntil);worker.restUntil=finite(worker.restUntil);worker.health=clamp(finite(worker.health,100),20,100);}
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
    log(t('farmRules.log.giftTrial'),at);return true;
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
  if(!(modern&&saved.cafe)){add('roasted','robusta',600,70,now,'cafe','starter');add('roasted','arabica',300,70,now,'cafe','starter');} // F-40: arabica for the first V60 (filters come from SUPPLIES start)
  // Shift hiring has no reserve bench: fill the three farm slots (robots count, several allowed), refund the hire fee of anyone left over.
  for(const w of progress.workers)if(w.farmId!=='farm-0'&&progress.workers.filter(x=>x.farmId==='farm-0').length<FARM_SLOTS)w.farmId='farm-0';
  for(const w of progress.workers.filter(x=>x.farmId!=='farm-0')){money(WORKER_CANDIDATES.find(c=>c.id===w.id)?.fee||0,'refund',now,w.name);log(t('farmRules.log.benchRemoved',{name:w.name}),now);}
  progress.workers=progress.workers.filter(w=>w.farmId==='farm-0');
  // Cut systems (03/11/2026): fish are sold once at the old price; queued farm-grinder batches give back their roasted beans.
  if(integer(saved?.fish?.count)>0){money(integer(saved.fish.count)*8,'sale',now,t('farmRules.ledger.fishSold'));log(t('farmRules.log.fishSold',{n:integer(saved.fish.count)}),now);}
  for(const j of jobsOf({batch:saved?.machines?.grinder?.batch||null,extraBatches:saved?.machines?.grinder?.extraBatches||[]}))if(cropById(j.cropId)&&integer(j.inputGrams)>0)add('roasted',j.cropId,integer(j.inputGrams),finite(j.quality,80),now,'farm','grinder-refund');
  // The heaven gift is granted exactly once, including saves that stored it before gifts had an effect.
  if(progress.gift&&!progress.giftApplied){
    let gift;const gifts={seeds:()=>{progress.seeds.robusta+=6;progress.fertilizer+=6;return t('farmRules.gift.seeds');},tools:()=>{progress.upgrades.cafe=Math.max(2,progress.upgrades.cafe);return t('farmRules.gift.tools');},capital:()=>{money(150,'gift',now,t('farmRules.gift.capital'));return t('farmRules.gift.capital');}};
    // The gift is picked before the region type is known (audit 04/11): one the region cannot use becomes the capital purse.
    const type=regionType(region),kind=(progress.gift==='seeds'&&type==='cafe')||(progress.gift==='tools'&&type==='farm')?'capital':progress.gift;
    gift=gifts[kind];
    // Túi hạt giống ở nơi chỉ quán có câu riêng (05/11/2026, F-44, Q2 R2); quà cũ khác vẫn dùng câu đổi chung.
    if(gift){const text=gift();log(kind===progress.gift?t('farmRules.log.heavenGift',{gift:text}):progress.gift==='seeds'?t('farmRules.log.giftSeedsCafe'):t('farmRules.log.giftSwapped',{gift:t(`farmRules.gift.${progress.gift}`)}),now);}
    progress.giftApplied=true;
  }
  // One-time lesson rewards, guarded by `granted` so reloads and replayed chapters never pay twice.
  function grantLessons(at,source='heaven'){
    const fresh=progress.lessons.learned.filter(id=>!progress.lessons.granted.includes(id));if(!fresh.length)return;
    const cafe=progress.cafe;
    for(const id of fresh){
      if(id==='costs')money(30,'quest',at,t('farmRules.ledger.costsTip'));
      if(id==='customer')cafe.reputation=Math.min(100,cafe.reputation+3);
      if(id==='recipe')for(const r of ['phin-den','nau-da']){const m=cafe.mastery[r]||(cafe.mastery[r]={best:0,made:0});m.best=Math.max(m.best,40);}
      progress.lessons.granted.push(id);
    }
    log(t(source==='council'?'farmRules.log.councilTips':'farmRules.log.heavenTips',{names:fresh.map(id=>LESSON_PERKS[id].name).join(', ')}),at);
  }
  // Old saves without tutorial flags: mark hints the player has clearly outgrown (contracts.md 5, step 4).
  if(!Array.isArray(saved?.tutorial?.seen)&&saved){
    const seen=progress.tutorial.seen,mark=(id,when)=>{if(when&&!seen.includes(id))seen.push(id);};
    mark('controls',progress.claimed.includes('roast'));mark('quest-guide',progress.claimed.includes('roast'));
    mark('cafe-intro',progress.stats.served>0);mark('bench-intro',Object.keys(progress.cafe.mastery).length>0);
    mark('tools',progress.claimed.includes('expand')||owned.length>=2||levelFor(progress.xp)>=3);
  }
  // F-46: save mới ghi dấu farm-intro-new; save có sẵn thiếu dấu (trước F-46, đã có farm) hoặc nơi chỉ có quán coi như xong farm-intro (contracts.md 5).
  if(!saved)progress.tutorial.seen.push('farm-intro-new');
  if(!progress.tutorial.seen.includes('farm-intro')&&(regionType(region)==='cafe'||saved&&!progress.tutorial.seen.includes('farm-intro-new')))progress.tutorial.seen.push('farm-intro');
  // F-47 (Q8): save có V60 ★★ (best ≥ 70) coi như đã xem ly làm mẫu 'v60-guided' (contracts.md 5).
  if(!progress.tutorial.seen.includes('v60-guided')&&(progress.cafe.mastery?.v60?.best||0)>=70)progress.tutorial.seen.push('v60-guided');
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
  const reliefReady=at=>regionType(progress.region)==='cafe'&&progress.coins<supplierPrice(progress.region)&&progress.cafe.lots.filter(l=>l.product==='roasted').reduce((s,l)=>s+l.grams,0)<10&&progress.cafe.reliefDay!==workDay(at);
  // A lesson can be re-asked if met (F-45: never a question the player has not met an expert for), not learned,
  // not answered wrong this work day, and no re-ask was answered yet this work day.
  function askable(id,at){const L=progress.lessons,day=workDay(at);return QUESTION_IDS.includes(id)&&L.met.includes(id)&&!L.learned.includes(id)&&L.asked[id]!==day&&(L.askedDay===day?L.askedCount:0)<1;}
  // F-45 (đề xuất Q1 R5 + vá): mốc có mặt của chuyên gia, chỉ dùng số đã có trong save. Thương Hội do ca thường (act 'shift')
  // hoặc ngày công đầu sau lần bán đầu (nơi chỉ trồng) đánh dấu riêng. Không điều kiện cấp.
  function councilArrive(id){const A=progress.lessons.arrived;if(A.includes(id))return;A.push(id);A.sort((a,b)=>EXPERT_IDS.indexOf(a)-EXPERT_IDS.indexOf(b));emit('council_arrived',{expert:id});}
  function councilCheck(){
    const s=progress.stats,type=regionType(progress.region);
    if(progress.tutorial.seen.includes('farm-intro')&&(s.harvested>0||type==='cafe'&&s.served>0))councilArrive('growing');
    if(type==='farm'?s.sold>0:s.served>0)councilArrive('brewing');
  }
  // Chuyên gia đang chờ ở Hội đồng: người đầu hàng (Nông → Pha Chế → Thương Hội) còn câu chưa gặp, kèm các câu đó.
  function councilWaiting(){const L=progress.lessons,expert=EXPERTS.find(e=>L.arrived.includes(e.id)&&e.questions.some(q=>!L.met.includes(q.id)));return expert?{expert,questions:expert.questions.filter(q=>!L.met.includes(q.id))}:null;}
  const reservoirCapacity=()=>Math.round(60*capacityScale(progress.upgrades.pond));
  const level=()=>levelFor(progress.xp);
  const claims=new Map(),resources=new Map();
  let lastSave=now,lastTick=progress.lastAt,cafeActive=false;
  // Event emitter (analytics/UI hooks, not saved). A bad listener never breaks the game.
  const listeners=new Set();
  function emit(type,props={}){for(const fn of [...listeners])try{fn(type,props);}catch(e){console.error('farm event listener',e);}}
  let lastDay=workDay(lastTick);
  // F-45: chuyên gia có mặt theo dữ liệu đã có lúc nạp (chưa có listener nên không phát sự kiện). Save trước F-45 thiếu `arrived`:
  // Thương Hội có mặt khi sổ ca có ≥ 2 ca (ca đầu có thể là ca tập), nơi chỉ trồng khi đã bán.
  councilCheck();
  if(saved&&!Array.isArray(savedLessons.arrived)&&(regionType(region)==='farm'?progress.stats.sold>0:progress.cafe.shiftLog.length>=2))councilArrive('business');
  // Victories are checked on every save and never taken back; `keys` (Sixth Keys) comes from the awakening system, which does not exist yet.
  function checkVictories(at,keys=0){const v=progress.victories;if(!v.economic&&economicStatus(progress).met){v.economic=at;emit('victory_reached',{type:'economic'});}if(!v.discovery&&keys>=DISCOVERY_KEYS){v.discovery=at;emit('victory_reached',{type:'discovery'});}}
  function masteryXp(m){m.tiers||=[];for(const star of tiersFor(m.best))if(!m.tiers.includes(star)){m.tiers.push(star);progress.xp+=MASTERY_XP[star];}}
  function commit(at=Date.now()){councilCheck();checkVictories(at,progress.awakening.keys.length);lastSave=at;onSave(clone(progress));}
  function makeOrder(at=lastTick){const c=CROPS.filter(c=>c.level<=level())[progress.orderIndex%CROPS.filter(c=>c.level<=level()).length];return {id:`shop-${progress.orderIndex}`,deadline:at+DAY_MS*8,accepted:false,workers:[],cropId:c.id,product:'roasted',quantity:200,reward:Math.round(200*.07*c.priceScale*1.2),xp:14};}
  progress.order=modern&&productById(saved?.order?.product)&&cropById(saved?.order?.cropId)?clone(saved.order):makeOrder();
  if(!progress.order.deadline)progress.order.deadline=now+DAY_MS*8;
  function rewards(){const earned=[];for(const q of QUESTS)if(!progress.claimed.includes(q.id)&&progress.stats[q.stat]>=q.count){progress.claimed.push(q.id);emit('challenge_completed',{quest:q.id});money(q.coins,'quest',lastTick,q.title);progress.xp+=q.xp;earned.push(q.title);}return earned;}
  function weatherAt(at){const day=Math.max(0,Math.floor((at-progress.epoch)/DAY_MS));return {day:day+1,raining:day%7===3||day%7===4};}
  function refreshDaily(at){
    const day=weatherAt(at).day;if(progress.today.day!==day)progress.today={day,harvested:0,processed:0,revenue:0};
    // Market prices recover once per work day (6 minutes) so selling every minute earns nothing extra.
    if(progress.market.day!==workDay(at))progress.market={day:workDay(at),sold:0,orders:0,xp:0};
    if(day===progress.lastOrderDay)return;
    // Cafe orders are staff work: only raise them once a main worker can take them, at most 2 open at a time.
    const available=CROPS.filter(c=>c.level<=level()),active=progress.orders.filter(o=>['open','transit'].includes(o.status)).length;
    if(regionType(region)==='both'&&progress.workers.some(w=>w.farmId==='farm-0'))for(let i=0;i<2-active;i++)progress.orders.push({id:nextId('order'),day,cropId:available[(day-1+i)%available.length].id,grams:i?168:252,status:'open',workers:[],deadline:at+DAY_MS*8,createdAt:at});
    progress.orders=progress.orders.filter(o=>o.status!=='delivered'||day-o.day<7).slice(-30);
    progress.lastOrderDay=day;
  }
  // Clock went backwards (device clock fixed or save from a faster clock): move every absolute time by d (<0) so timers keep their remaining duration.
  function shiftTimes(d){
    const bump=(o,keys)=>{for(const k of keys)if(o[k]>0)o[k]+=d;};
    progress.epoch+=d;
    for(const m of MACHINES)for(const j of jobsOf(progress.machines[m.id]))bump(j,['startedAt','readyAt']);
    for(const t of progress.cafe.shipments)bump(t,['startedAt','readyAt']);
    for(const o of progress.orders)bump(o,['deadline','createdAt']);bump(progress.order,['deadline']);
    for(const w of progress.workers)bump(w,['shiftUntil','restUntil','waitUntil','hiredAt']);
    for(const s of progress.cafe.crew)bump(s,['paidUntil']);
    for(const l of progress.lots)bump(l,['createdAt']);
  }
  // Seconds of rain in [a,b] by the day cycle in weatherAt (a long absence can span a dry and a rainy day).
  function rainSeconds(a,b){let ms=0;for(let x=a;x<b;){const d=Math.max(0,Math.floor((x-progress.epoch)/DAY_MS)),end=Math.min(b,progress.epoch+(d+1)*DAY_MS);if(d%7===3||d%7===4)ms+=end-x;x=end;}return ms/1000;}
  function advance(at){
    if(lastTick-at>60000){shiftTimes(at-lastTick);lastTick=progress.lastAt=at;}
    at=Math.max(lastTick,at);if(at===lastTick)return false;
    const elapsed=at-lastTick,from=Math.max(lastTick,at-OFFLINE_MS),seconds=(at-from)/1000;
    const marketHit=progress.market.sold>=.7*MARKET_DAILY; // read before refreshDaily resets the finished day
    refreshDaily(at);
    for(const order of progress.orders){if(!order.deadline)order.deadline=at+DAY_MS*8;if(order.status==='open'&&at>order.deadline){order.status='expired';log(t('farmRules.log.cafeOrderExpired'),at);}}
    if(progress.order?.accepted&&at>progress.order.deadline){progress.orders.push({...progress.order,grams:progress.order.quantity,status:'expired',source:'shop',day:weatherAt(at).day,workers:progress.order.workers||[]});log(t('farmRules.log.shopOrderExpired'),at);progress.orderIndex++;progress.order=makeOrder(at);}

    const rainSec=rainSeconds(from,at),rain=rainSec*.28;
    progress.reservoir=Math.min(reservoirCapacity(),progress.reservoir+seconds*(.06+.025*(progress.upgrades.well-1))+rain);
    progress.durability=Math.max(0,progress.durability-seconds*.0001/efficiency(progress.upgrades.fence));
    for(const p of progress.plots){
      if(!p.unlocked||p.stage==='empty')continue;
      const crop=cropById(p.cropId),ratio=p.growthMs/(p.mature?crop.regrowMs:crop.growMs),dry=p.mature&&ratio>=.17&&ratio<.23;
      const loss=CARE.waterPerSecond/efficiency(progress.upgrades.soil),waterEnd=clamp(p.water+rain-seconds*loss,0,100),weedsEnd=clamp(p.weeds+seconds*CARE.weedsPerSecond,0,100);
      const activeWater=dry?seconds:Math.min(seconds,rainSec+clamp((p.water-CARE.waterStopsGrowth)/loss,0,seconds-rainSec));
      const activeWeeds=clamp((CARE.weedsStopGrowth-p.weeds)/CARE.weedsPerSecond,0,seconds);
      const active=Math.min(activeWater,activeWeeds),stress=seconds-active;
      p.health=clamp(p.health-stress*.0008+active*.0003-(progress.durability<25?seconds*.0002:0),20,100);
      if(p.stage!=='ready'){
        p.growthMs+=active*1000*(.65+.35*p.health/100)/regionCrop(progress.region,p.cropId).growth;
        const total=p.mature?crop.regrowMs:crop.growMs;
        if(p.growthMs>=total){
          if(!p.mature){p.mature=true;p.growthMs=0;p.stage='growing';}
          else{p.growthMs=total;p.stage='ready';const rc=regionCrop(progress.region,p.cropId),yieldScale=(.7+.3*p.health/100)*careYield(p.fertilized,p.pruned)*rc.yield;const totalFruit=Math.round(crop.yield*yieldScale);p.readyYield=totalFruit;p.remainingFruit=0;p.secondPick=0;p.quality=clamp(55+p.health*.25+careQuality(p.fertilized,p.pruned)+rc.quality,0,100);}
        }else p.stage='growing';
      }
      p.water=waterEnd;p.weeds=weedsEnd;p.lastAt=at;
    }
    // Old fresh fruit loses value, not all inventory. Handle elapsed time once per lot.
    for(const lot of progress.lots)if(lot.product==='cherries'&&at-lot.createdAt>DAY_MS)lot.quality=Math.max(20,lot.quality-seconds*.003);
    for(const trip of progress.cafe.shipments.filter(t=>t.readyAt<=at)){for(const l of trip.lots)add(l.product,l.cropId,l.grams,l.quality,trip.readyAt,'cafe',l.origin);log(t('farmRules.log.cafeReceived',{grams:trip.lots.reduce((sum,l)=>sum+l.grams,0)}),trip.readyAt);const order=progress.orders.find(o=>o.id===trip.orderId);if(order){order.status='delivered';const onTime=trip.readyAt<=order.deadline;order.rating=onTime?5:3;progress.reputation=clamp(progress.reputation+(onTime?2:-1),0,100);log(t('farmRules.log.orderRated',{stars:order.rating,rep:progress.reputation}),trip.readyAt);}}
    progress.cafe.shipments=progress.cafe.shipments.filter(t=>t.readyAt>at);
    // Staff only work while the game runs, so a gap (closed game, hidden tab) pauses paid contract time instead of burning it.
    // Sick leave pauses with the contract, so a worker away for hours is still sick for the same time left.
    if(elapsed>60000)for(const w of progress.workers){if(w.shiftUntil>lastTick)w.shiftUntil+=elapsed;if(w.restUntil>lastTick)w.restUntil+=elapsed;}
    // Café staff only work while the café runs and is open: their paid shift pauses otherwise (and across gaps).
    // Sick café staff (rest > 0) count down only while open, and their paid time pauses meanwhile.
    if(!(cafeActive&&progress.cafe.open)||elapsed>60000){for(const s of progress.cafe.crew)if(s.paidUntil>lastTick)s.paidUntil+=elapsed;}
    else for(const s of progress.cafe.crew)if(s.rest>0){const d=Math.min(s.rest,elapsed);s.rest-=d;if(s.paidUntil>lastTick)s.paidUntil+=d;}
    // Cafe staff renew their shift wage only while the player runs the open cafe; unpaid staff idle. Gift robots never renew.
    if(cafeActive&&progress.cafe.open)for(const s of progress.cafe.crew){if(s.gift)continue;const person=candidateById(s.id),wage=staffWage(roleOf(s.id),s.level,person);if(s.paidUntil<=at&&progress.coins>=wage){money(-wage,'wage',at,person.person);progress.cafe.paid.wages+=wage;s.paidUntil=at+CAFE_SHIFT_MS;cafeShiftPaid(s,at);}}
    // Gift robots leave when their one shift ends; the gift is active from the first open café and done when they are gone.
    const gift=progress.robotGift;if(progress.cafe.crew.some(s=>s.gift&&s.paidUntil<=at))progress.cafe.crew=progress.cafe.crew.filter(s=>!s.gift||s.paidUntil>at);
    if(['ready','active'].includes(gift.state)&&!progress.cafe.crew.some(s=>s.gift))gift.state='done';
    else if(gift.state==='ready'&&cafeActive&&progress.cafe.open)gift.state='active';
    lastTick=at;progress.lastAt=at;
    // Live ticks only: a gap over 60 s is offline catch-up and must not emit.
    {const day=workDay(at);if(day>lastDay){lastDay=day;if(regionType(progress.region)==='farm'&&progress.lessons.arrived.includes('brewing'))councilArrive('business');if(elapsed<=60000)emit('workday_ended',{level:level(),coins_bucket:Math.round(progress.coins/100)*100,market_floor_hit:marketHit});}}
    if(elapsed>60000)progress.offline={seconds:Math.floor(Math.min(elapsed,OFFLINE_MS)/1000),message:t('farmRules.offline')};
    return true;
  }
  function adjacent(id){const f=FIELDS.find(f=>f.id===id);return f&&FIELDS.some(n=>owned.includes(n.id)&&Math.abs(n.row-f.row)+Math.abs(n.col-f.col)===1);}
  function demand(){const cups=18+2*(progress.upgrades.cafe-1),grams=Math.ceil(cups*18*1.2),incoming=progress.cafe.shipments.reduce((s,t)=>s+t.lots.filter(l=>l.product==='roasted').reduce((a,l)=>a+l.grams,0),0),stored=Object.values(progress.cafe.stock.roasted).reduce((s,n)=>s+n,0);return {cups,grams,stored,incoming,needed:Math.max(0,grams-stored-incoming)};}
  for(const worker of progress.workers){for(const l of worker.cargo||[])if(productById(l.product)&&cropById(l.cropId)&&l.grams>0)add(l.product,l.cropId,l.grams,finite(l.quality,80),now,'farm',l.origin);worker.cargo=[];}
  // Resting (sick) workers are skipped; the error only comes when nobody is left. Returns the team that actually started.
  function startTeam(all,at){
    if(!all.length)return {error:t('farmRules.err.noStaffReady')};
    const team=all.filter(w=>!(w.restUntil>at)),resting=all.find(w=>w.restUntil>at);if(!team.length)return {error:t('farmRules.err.resting',{name:resting.name,seconds:Math.ceil((resting.restUntil-at)/1000)})};
    const cost=team.reduce((sum,w)=>sum+(w.shiftUntil>at?0:contractPrice(w)),0);
    if(progress.coins<cost)return {error:t('farmRules.err.teamContract',{cost})};
    for(const w of team){if(w.shiftUntil<=at)signContract(w,at);w.enabled=true;w.state=t('farmRules.state.accepted');}
    return {cost,team};
  }
  function saleQuote(product,cropId,grams){
    const item=productById(product),crop=cropById(cropId);
    if(!item||!crop||!Number.isSafeInteger(grams)||grams<1||grams>progress.stock[product][cropId])return {ok:false,message:t('farmRules.err.badSaleGrams')};
    if(product==='roasted'&&progress.cafe.reserve&&Object.values(progress.stock.roasted).reduce((sum,n)=>sum+n,0)-grams<demand().needed)return {ok:false,message:t('farmRules.err.roastedReserved')};
    let left=grams,weighted=0;
    for(const lot of progress.lots.filter(l=>l.product===product&&l.cropId===cropId).sort((a,b)=>a.createdAt-b.createdAt)){const amount=Math.min(left,lot.grams);weighted+=amount*lot.quality;left-=amount;if(!left)break;}
    if(left)return {ok:false,message:t('farmRules.err.notEnoughStock')};
    const base=grams*item.price*crop.priceScale*marketQualityFactor(weighted/grams),value=Math.round(marketValue(progress.market.sold,base)*100)/100;
    // discounted: the market already bought enough this work day to cut this sale by 5%+ (drives the UI note).
    return {ok:true,value,base,full:Math.round(base*100)/100,discounted:value<base*.95};
  }
  // F-35 samples: compact player-made data the Decode questions read (decode-awaken.md 4). Never copied text, never used by the economy.
  const sample=(list,item,cap)=>{list.push(item);if(list.length>cap)list.splice(0,list.length-cap);};
  const memoryEntries=()=>memoryList({drafts:false}).reverse(); // oldest first
  const awakenCtx=(memory=false)=>({workDayMs:WORK_DAY_MS,...progress.awakening.samples,shifts:progress.cafe.shiftLog,mastery:progress.cafe.mastery,
    plots:progress.plots.filter(p=>p.unlocked&&['planted','growing'].includes(p.stage)).map(p=>{const c=cropById(p.cropId);return {id:p.id,cropId:p.cropId,water:p.water,ratio:Math.min(1,p.growthMs/(p.mature?c.regrowMs:c.growMs))};}),
    entries:memory?memoryEntries:()=>null});
  function awakenRun(action,choice,at,memory){const r=awaken(progress.awakening,awakenCtx(memory),action,choice,at);for(const e of r.events)emit(e.name,e.props);return r;}
  const api={
    saleQuote,
    get progress(){return clone(progress);},
    // Live state for per-frame readers (crew loop, plot checks): read only, never mutate; use act/workerUpdate to change it.
    peek(){return progress;},reliefReady(at=Date.now()){return reliefReady(at);},get level(){return level();},get waterCapacity(){return waterCapacity();},get quest(){return QUESTS.find(q=>!progress.claimed.includes(q.id))||null;},
    get demand(){return demand();},get weather(){return weatherAt(lastTick);},get storageCapacity(){return storageCapacity();},
    setCafeActive(value){cafeActive=value;},
    // Not saved. fn(type, props); returns unsubscribe. Types: field_bought, workday_ended, victory_reached, challenge_completed, auto_started, shift_ended, tutorial_completed, council_arrived, council_answered.
    onEvent(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    // Lesson the UI may re-ask now among `ids` (in order), as {expert, question} from heaven/content.js, or null.
    pendingLesson(ids=QUESTION_IDS){const id=[].concat(ids).find(id=>askable(id,lastTick));return id?lessonOf(id):null;},
    // F-45: chuyên gia đang chờ ở Hội đồng {expert, questions} (chỉ câu chưa gặp) hoặc null; lượt gặp chỉ 1 chuyên gia.
    get council(){return councilWaiting();},
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
    act(id,action,choice,at=Date.now(),owner='player',via='hand'){ // via: nguồn hành động của nhân vật chính, 'hand' | 'auto' (F-44…F-48 L1; chỉ dùng cho mẫu Decode)
      at=Math.max(lastTick,finite(at,Date.now()));advance(at);const fail=message=>({ok:false,message});let message='',collected=false,extra={};
      const claimant=api.claimed(id,action);if(claimant&&claimant!==owner)return fail(t('farmRules.err.staffBusy'));
      const resourceKey=action==='plant'?`seed:${choice}`:action==='fertilize'?'fertilizer':null;
      if(resourceKey){const held=[...resources.entries()].filter(([who,r])=>who!==owner&&r.key===resourceKey).reduce((sum,[,r])=>sum+r.amount,0),available=action==='plant'?progress.seeds[choice]||0:progress.fertilizer;if(available-held<1)return fail(t('farmRules.err.suppliesHeld'));}
      const p=progress.plots.find(p=>p.id===id),m=MACHINES.find(m=>m.id===id),field=FIELDS.find(f=>f.id===id);
      if(id==='decorations'){
        if(action==='construct'||action==='demolish'){
          const item=progress.decorations.find(item=>item.id===choice?.id);if(!item)return fail(t('farmRules.err.decorGone'));
          if(action==='demolish'){progress.decorations=progress.decorations.filter(value=>value.id!==item.id);message=t('farmRules.msg.decorDemolished');}
          else{if(item.state==='complete')return fail(t('farmRules.err.decorBuilt'));const ms=choice.ms;if(!Number.isFinite(ms)||ms<=0||ms>1000)return fail(t('farmRules.err.badBuildTime'));item.buildMs=Math.min(item.buildDuration,item.buildMs+ms);if(item.buildMs>=item.buildDuration)item.state='complete';message=item.state==='complete'?t('farmRules.msg.decorComplete'):t('farmRules.msg.decorBuilding');}
        }else{
        if(action!=='place'||!choice||typeof choice!=='object')return fail(t('farmRules.err.decorPick'));
        const reason=decorationError(progress.decorations,choice,progress.region);if(reason)return fail(reason);
        const spec=DECORATIONS.find(item=>item.id===choice.type);if(progress.coins<spec.price)return fail(t('farmRules.err.decorCoins',{n:spec.price-progress.coins,name:spec.name}));
        money(-spec.price,'decoration',at,spec.name);progress.decorations.push({id:nextId('decor'),type:spec.id,x:choice.x,z:choice.z,rotation:choice.rotation,text:String(choice.text||'').trim().slice(0,24),state:'construction',buildMs:0,buildDuration:spec.id==='lamp'?6000:5000});message=t('farmRules.msg.decorPlaced',{name:spec.name});
        }
      }else if(id==='orders'){
        const order=progress.orders.find(o=>o.id===(typeof choice==='object'?choice?.orderId:choice));
        if(!order||order.status!=='open')return fail(t('farmRules.err.orderClosed'));
        if(action==='startCrew'){const result=startTeam(progress.workers.filter(w=>w.farmId==='farm-0'),at);if(result.error)return fail(result.error);order.workers=result.team.map(w=>w.id);message=t('farmRules.msg.orderAssigned',{names:result.team.map(w=>w.name).join(', '),cost:result.cost});}else if(action==='requestDelivery'){if(progress.stock.roasted[order.cropId]<order.grams||!order.workers.some(id=>progress.workers.some(w=>w.id===id&&w.farmId==='farm-0'&&activeJobs(w).has('delivery'))))return fail(t('farmRules.err.needStockAndCourier'));order.deliveryRequested=true;message=t('farmRules.msg.deliveryAssigned');}else if(action==='assign'){
          const w=progress.workers.find(w=>w.id===choice.workerId);if(!w||w.farmId!=='farm-0')return fail(t('farmRules.err.deployFirst'));
          if(!order.workers.includes(w.id)){const started=startTeam([w],at);if(started.error)return fail(started.error);}
          order.workers=order.workers.includes(w.id)?order.workers.filter(id=>id!==w.id):[...order.workers,w.id];message=t('farmRules.msg.orderStaffUpdated');
        }else if(action==='shipOrder'){
          if(progress.stock.roasted[order.cropId]<order.grams)return fail(t('farmRules.err.orderNotEnoughRoasted'));if(progress.coins<2)return fail(t('farmRules.err.freight'));
          const incoming=progress.cafe.shipments.reduce((s,t)=>s+t.lots.reduce((n,l)=>n+l.grams,0),0),stored=progress.cafe.lots.reduce((s,l)=>s+l.grams,0);
          if(incoming+stored+order.grams>storageCapacity())return fail(t('farmRules.err.cafeStorageFull'));
          const lots=take('roasted',order.cropId,order.grams);money(-2,'delivery',at,t('farmRules.ledger.shipToCafe'));progress.cafe.shipments.push({id:nextId('trip'),orderId:order.id,lots,startedAt:at,readyAt:at+10000/efficiency(progress.upgrades.delivery)});order.status='transit';progress.stats.delivered+=order.grams;message=t('farmRules.msg.orderShipped');
        }else return fail(t('farmRules.err.noOrderAction'));
      }else if(action==='upgrade'){
        const asset=ASSETS.find(a=>a.id===id);if(!asset)return fail(t('farmRules.err.noUpgrade'));
        const lv=progress.upgrades[id],price=upgradePrice(id,lv);
        if(lv>=assetMaxLevel(asset))return fail(t('farmRules.err.maxLevel',{name:asset.name,max:assetMaxLevel(asset)}));
        if(level()<upgradeRequirement(lv+1))return fail(t('farmRules.err.needFarmLevel',{n:upgradeRequirement(lv+1)}));
        if(progress.coins<price)return fail(t('farmRules.err.shortCoins',{n:Math.ceil(price-progress.coins)}));
        money(-price,'upgrade',at,asset.name);progress.upgrades[id]++;progress.canLevel=progress.upgrades.well;
        if(progress.machines[id])progress.machines[id].level=progress.upgrades[id];
        message=t('farmRules.msg.upgraded',{name:asset.name,level:lv+1,benefit:asset.benefit});
      }else if(id==='workers'){
        if(action==='rejectCandidate'){
          const candidate=WORKER_CANDIDATES.find(w=>w.id===choice);
          if(!candidate||candidate.kind==='robot'||progress.workers.some(w=>w.id===choice))return fail(t('farmRules.err.candidateGone'));
          if(!progress.rejectedCandidates.includes(choice))progress.rejectedCandidates.push(choice);
          message=t('farmRules.msg.rejected',{name:candidate.name});
        }else if(action==='hire'){
          // Two shared slots (robots count), at most one robot. Robots skip the hire fee and prepay a pack instead; `pack` is ignored for people.
          const hireId=idOf(choice),candidate=WORKER_CANDIDATES.find(w=>w.id===hireId),robot=candidate?.kind==='robot',pack=robot?Number(choice?.pack??1):1;
          if(!candidate||progress.rejectedCandidates.includes(hireId)||progress.workers.some(w=>w.id===hireId))return fail(t('farmRules.err.candidateGone'));
          if(progress.workers.length>=FARM_SLOTS)return fail(t(robot?'farmRules.err.fullRobot':'farmRules.err.fullHire'));
          if(!Object.hasOwn(ROBOT_PACKS,pack))return fail(t('farmRules.err.packChoice'));
          const price=robot?packPrice(candidate.wage,pack):candidate.fee;
          if(progress.coins<price)return fail(robot?t('farmRules.err.shortCoins',{n:Math.ceil(price-progress.coins)}):t('farmRules.err.hireCoins'));
          if(!robot)money(-candidate.fee,'hire',at,candidate.name);
          const worker={...clone(candidate),kind:robot?'robot':'human',incident:null,xp:0,energy:100,health:100,cargo:[],jobs:Object.fromEntries(WORKER_JOBS.map(([id])=>[id,canDo(candidate,id)])),preferredCrop:'robusta',workMode:'auto',farmId:'farm-0',autoPay:true,role:'auto',enabled:true,hiredAt:at,serviceMs:0,paidDays:0,shiftUntil:0,restUntil:0,state:t('farmRules.state.waiting')};
          // Start on the job the team lacks (robot: one job; person: one group) so three hires cover care, processing and delivery.
          const covered=new Set(progress.workers.flatMap(o=>[...activeJobs(o)].map(jobGroupOf)));
          if(robot){const job=candidate.jobs.find(j=>!covered.has(jobGroupOf(j)))||'water';for(const key of Object.keys(worker.jobs))worker.jobs[key]=key===job;}
          else{const group=JOB_GROUPS.find(g=>!covered.has(g))||'care';for(const key of Object.keys(worker.jobs))worker.jobs[key]=jobGroupOf(key)===group;}
          progress.workers.push(worker);if(robot)signContract(worker,at,pack);
          message=robot?t('farmRules.msg.robotJoined',{name:candidate.name,pack,price}):t('farmRules.msg.joined',{name:candidate.name});
        }else{
          const w=progress.workers.find(w=>w.id===choice?.id||w.id===choice);if(!w)return fail(t('farmRules.err.notHired'));
          if(action==='dismiss'){
            // Ending a contract early frees the slot; prepaid days are not refunded.
            claims.forEach((who,key)=>{if(who===w.id)claims.delete(key);});resources.delete(w.id);
            for(const order of progress.orders)order.workers=order.workers.filter(id=>id!==w.id);
            for(const task of progress.dailyTasks)task.workers=task.workers.filter(id=>id!==w.id);
            progress.workers=progress.workers.filter(person=>person.id!==w.id);
            if(!isRobot(w)&&!progress.rejectedCandidates.includes(w.id))progress.rejectedCandidates.push(w.id);
            message=t('farmRules.msg.dismissed',{name:w.name});
          }else if(action==='moveStaff'){
            if(!choice.deploy)return fail(t('farmRules.err.noBench'));
            const replacement=choice.replaceId?progress.workers.find(person=>person.id===choice.replaceId):null;
            if(choice.replaceId&&(!replacement||replacement.farmId!=='farm-0'||replacement.id===w.id))return fail(t('farmRules.err.slotChanged'));
            if(choice.deploy&&w.farmId==='farm-0')return fail(t('farmRules.err.alreadyMain'));
            if(choice.deploy&&!replacement&&progress.workers.filter(person=>person.farmId==='farm-0').length>=FARM_SLOTS)return fail(t('farmRules.err.mainFull'));
            const removed=choice.deploy?replacement:w;
            if(removed){removed.farmId=null;removed.state=t('farmRules.state.bench');claims.forEach((who,key)=>{if(who===removed.id)claims.delete(key);});resources.delete(removed.id);}
            if(choice.deploy){w.farmId='farm-0';w.state=t('farmRules.state.awaitingYou');}
            if(replacement)for(const order of progress.orders.filter(order=>order.status==='open'))order.workers=order.workers.map(id=>id===replacement.id?w.id:id).filter((id,index,ids)=>ids.indexOf(id)===index);
            message=choice.deploy?(replacement?t('farmRules.msg.replaced',{name:w.name,old:replacement.name}):t('farmRules.msg.joinedMain',{name:w.name})):t('farmRules.msg.toBench',{name:w.name});
          }
          else if(action==='startWork'){
            if(!w.farmId&&progress.workers.filter(person=>person.farmId==='farm-0').length>=FARM_SLOTS)return fail(t('farmRules.err.farmFullSwap'));
            const result=startTeam([w],at);if(result.error)return fail(result.error);w.farmId='farm-0';
            const hasAssigned=progress.orders.some(o=>o.status==='open'&&o.workers.includes(w.id));
            if(!hasAssigned)w.workMode='auto';message=t('farmRules.msg.startedWork',{name:w.name,cost:result.cost});
          }else if(action==='deploy'){
            if(w.farmId==='farm-0')return fail(t('farmRules.err.alreadyWorking'));
            else{if(progress.workers.filter(w=>w.farmId==='farm-0').length>=FARM_SLOTS)return fail(t('farmRules.err.farmFullBench'));w.farmId='farm-0';w.state=t('farmRules.state.awaitingYou');}
            message=w.farmId?t('farmRules.msg.deployed'):t('farmRules.msg.benched');
          }else if(action==='autoPay'){w.autoPay=!w.autoPay;message=w.autoPay?t('farmRules.msg.autoPayOn'):t('farmRules.msg.autoPayOff');}
          else if(action==='toggle'){w.enabled=!w.enabled;message=w.enabled?t('farmRules.msg.resumed'):t('farmRules.msg.paused');}
          else if(action==='mode'){w.workMode=w.workMode==='auto'?'assigned':'auto';message=w.workMode==='assigned'?t('farmRules.msg.modeAssigned'):t('farmRules.msg.modeAuto');}
          else if(action==='permissionGroup'){
            if(choice.group!=='care')return fail(t('farmRules.err.badGroup'));
            const keys=CARE_JOBS.filter(key=>canDo(w,key)),enabled=!keys.every(key=>w.jobs[key]);
            if(enabled){const blocked=overLimit(w,'care');if(blocked)return fail(blocked);}
            for(const key of keys)w.jobs[key]=enabled;
            message=t(enabled?'farmRules.msg.careOn':'farmRules.msg.careOff');
          }
          else if(action==='permission'){if(!WORKER_JOBS.some(([key])=>key===choice.job))return fail(t('farmRules.err.badGroup'));if(!canDo(w,choice.job))return fail(t('farmRules.err.robotCant'));
            // Robot: switching a job on switches its other job off (one job only). Person: no new group beyond the level limit.
            if(!w.jobs[choice.job]){if(isRobot(w))for(const key of Object.keys(w.jobs))w.jobs[key]=false;else{const blocked=overLimit(w,jobGroupOf(choice.job));if(blocked)return fail(blocked);}}
            w.jobs[choice.job]=!w.jobs[choice.job];message=t(w.jobs[choice.job]?'farmRules.msg.jobOn':'farmRules.msg.jobOff');}
          else if(action==='seed'){if(!cropById(choice.cropId)||cropById(choice.cropId).level>level())return fail(t('farmRules.err.cropLocked'));w.preferredCrop=choice.cropId;w.preferredCropExplicit=true;message=t('farmRules.msg.seedChosen');}
          else if(action==='role'){if(!['auto','care','processing'].includes(choice?.role))return fail(t('farmRules.err.badGroup'));w.role=choice.role;message=t('farmRules.msg.roleChanged');}
          else if(action==='train'){
            if(isRobot(w))return fail(t('farmRules.err.robotNoTrain'));
            if(workerLevel(w.xp)>=10)return fail(t('farmRules.err.workerMax'));const fee=40*workerLevel(w.xp);if(progress.coins<fee)return fail(t('farmRules.err.trainCoins'));
            money(-fee,'training',at,w.name);w.xp=100*workerLevel(w.xp)**2;message=t('farmRules.msg.levelUp',{name:w.name,level:workerLevel(w.xp)});
          }else if(action==='shift'){
            // Allowed while sick: pays and extends shiftUntil, sickness stays. Robots may buy a pack; auto-renew sends no pack (= 1 day).
            const pack=isRobot(w)?Number(choice?.pack??1):1;if(!Object.hasOwn(ROBOT_PACKS,pack))return fail(t('farmRules.err.packChoice'));
            const plan=contractPlan(w),price=shiftPrice(w,pack);if(progress.coins<price)return fail(isRobot(w)?t('farmRules.err.shortCoins',{n:Math.ceil(price-progress.coins)}):t('farmRules.err.contractCoins',{price,plan:plan.name.toLowerCase(),name:w.name}));
            signContract(w,at,pack);message=isRobot(w)?t('farmRules.msg.robotPack',{name:w.name,pack,price}):t('farmRules.msg.contractSigned',{name:w.name,plan:plan.name.toLowerCase(),price,days:plan.days});
          }else if(action==='incident'){
            // Fires this shift's rolled incident; exemptions are checked now (staff count may have changed since the roll). Always marks done.
            const i=w.incident;if(!i||i.done)return fail(t('farmRules.err.noIncident'));const left=w.shiftUntil-at;if(left>i.due)return fail(t('farmRules.err.notYet'));
            const holdsOrder=progress.orders.some(o=>o.status==='open'&&o.workers.includes(w.id));
            // Late by > 10 s = the moment passed while the farm loop was not running (player away): cancel, never postpone.
            const applied=['phone','sick'].includes(i.type)&&!isRobot(w)&&i.for>INCIDENTS.grace&&!cafeActive&&i.due-left<=10000&&progress.cafe.reputation>=INCIDENTS.minRep&&!(i.type==='sick'&&progress.workers.length===1&&holdsOrder);
            i.done=true;
            if(applied&&i.type==='phone'){w.waitUntil=at+INCIDENTS.phoneMs;w.waitReason=t('farmRules.state.phone');}
            if(applied&&i.type==='sick'){w.restUntil=at+WORK_DAY_MS;w.shiftUntil+=WORK_DAY_MS;log(t('farmRules.log.sick',{name:w.name}),at);}
            extra={type:i.type,applied};message=!applied?'':i.type==='sick'?t('farmRules.msg.sick',{name:w.name}):t('farmRules.msg.phone',{name:w.name});
          }else if(action==='remind'){
            if(w.incident?.type!=='phone'||!(w.waitUntil>at))return fail(t('farmRules.err.working',{name:w.name}));
            w.waitUntil=0;w.waitReason='';message=t('farmRules.msg.phoneAway',{name:w.name});
          }else if(action==='contractPlan'){
            const plans=['day','week','month'];w.contractPlan=plans[(plans.indexOf(contractPlan(w).id)+1)%plans.length];message=t('farmRules.msg.planChanged',{name:w.name,plan:contractPlan(w).name,price:contractPrice(w)});
          }else return fail(t('farmRules.err.noAction'));
        }
      }else if(id==='cafe'){
        const cafe=progress.cafe;
        if(action==='toggle'){cafe.open=!cafe.open;message=cafe.open?t('farmRules.msg.cafeOpen'):t('farmRules.msg.cafeClosed');}
        else if(action==='prices'){
          // F-42: only while closed; choice = { recipeId, p }.
          if(cafe.open)return fail(t('farmRules.err.pricesOpen'));
          const r=recipeById(choice?.recipeId);if(!r)return fail(t('farmRules.err.unknownRecipe'));
          const p=clampPrice(choice.p);if(p===1)delete cafe.prices[r.id];else cafe.prices[r.id]=p;message=t('farmRules.msg.priceSet',{name:r.name,p:p.toFixed(2)});
        }
        else if(action==='reserve'){cafe.reserve=!cafe.reserve;message=cafe.reserve?t('farmRules.msg.reserveOn'):t('farmRules.msg.reserveOff');}
        else if(action==='ship'){
          const crop=cropById(choice?.cropId||choice);if(!crop)return fail(t('farmRules.err.pickRoasted'));
          const grams=Math.min(progress.stock.roasted[crop.id],Math.floor(choice?.grams)||Infinity,Math.round(1000*capacityScale(progress.upgrades.delivery)));
          if(!grams)return fail(t('farmRules.err.noRoasted'));
          const cafeMass=cafe.lots.reduce((s,l)=>s+l.grams,0)+cafe.shipments.reduce((s,t)=>s+t.lots.reduce((n,l)=>n+l.grams,0),0);
          if(cafeMass+grams>storageCapacity())return fail(t('farmRules.err.cafeNoRoom'));
          if(progress.coins<2)return fail(t('farmRules.err.freight'));
          const lots=take('roasted',crop.id,grams);money(-2,'delivery',at,t('farmRules.ledger.freight'));cafe.shipments.push({id:nextId('trip'),lots,startedAt:at,readyAt:at+10000/efficiency(progress.upgrades.delivery)});progress.stats.delivered+=grams;message=t('farmRules.msg.shipping',{grams});
        }else if(action==='supply'){
          const grams=500,price=supplierPrice(progress.region);if(progress.coins<price)return fail(t('farmRules.err.supplyCoins',{price}));
          if(cafe.lots.reduce((s,l)=>s+l.grams,0)+grams>storageCapacity())return fail(t('farmRules.err.cafeFull'));
          money(-price,'supplier',at,t('farmRules.ledger.supplier'));cafe.paid.beans+=price;add('roasted','robusta',grams,65,at,'cafe','supplier');message=t('farmRules.msg.supplied');
        }else if(action==='relief'){
          // Rescue for a café-only region with no beans and no money to restock; once per work day.
          if(!reliefReady(at))return fail(t(cafe.reliefDay===workDay(at)?'farmRules.err.reliefUsed':'farmRules.err.reliefNotNeeded',{price:supplierPrice(progress.region)}));
          if(cafe.lots.reduce((s,l)=>s+l.grams,0)+RELIEF_GRAMS>storageCapacity())return fail(t('farmRules.err.cafeFull'));
          add('roasted','robusta',RELIEF_GRAMS,65,at,'cafe','relief');cafe.reliefDay=workDay(at);message=t('farmRules.msg.relief');
        }else if(action==='brew'){
          const g=progress.robotGift,robot=choice?.robot==='gift',recipe=recipeById(choice?.recipeId);
          // The gift robot brews only from 'gift' beans (robusta) with its fixed mistakes: score 50, double condensed milk.
          const crop=robot?cropById('robusta'):cropById(choice?.cropId);if(!recipe||!crop)return fail(t('farmRules.err.pickRecipeBean'));
          const uses=resolveUses(robot&&recipe.uses.condensed?{...recipe.uses,condensed:recipe.uses.condensed*2}:recipe.uses,cafe);const brandBonus=ingredientBonus(recipe,cafe); // before the supplies are taken, so the brand matches what goes in
          if(robot){
            if(!cafe.crew.some(m=>m.id==='gift-pha'&&m.paidUntil>at)||g.cups>=GIFT_CUPS||!GIFT_RECIPES.includes(recipe.id))return fail(t('farmRules.err.robotRecipe'));
            // Check everything before taking anything.
            const lacking=[...(cafe.lots.filter(l=>l.origin==='gift'&&l.product==='roasted'&&l.cropId===crop.id).reduce((s,l)=>s+l.grams,0)<recipe.beans?[t('farmRules.msg.trialBeans',{grams:recipe.beans})]:[]),...Object.entries(uses).filter(([id,n])=>(cafe.supplies[id]||0)<n).map(([id])=>SUPPLIES.find(s=>s.id===id)?.name.toLowerCase()||id)];
            if(lacking.length)return fail(t('farmRules.err.missing',{list:lacking.join(', ')}));
          }else{const missing=missingFor(recipe,cafe,crop.id);if(missing.length)return fail(t('farmRules.err.missing',{list:missing.join(', ')}));}
          const score=robot?50:clamp(finite(choice.score),0,100),lots=take('roasted',crop.id,recipe.beans,'cafe',robot?'gift':null);
          for(const [supply,amount]of Object.entries(uses))cafe.supplies[supply]-=amount;
          // Auto pha (demo) và ⚡ Pha nhanh (quick) cups sell but never raise mastery, so 2 coins cannot unlock ★★ Pha nhanh (chốt 04/11).
          if(!choice.staff&&!robot){const m=cafe.mastery[recipe.id]||(cafe.mastery[recipe.id]={best:0,made:0});if(!choice.demo&&!choice.quick){m.best=Math.max(m.best,score);masteryXp(m);}m.made++;}
          if(robot){g.cups++;g.tally.robot.cost+=cupCost(recipe,crop,uses);}else if(g.state==='active'&&!choice.staff)g.tally.you.cost+=cupCost(recipe,crop,uses);
          // Matcha uses no beans: its 25% "ingredient" share is a fixed 80 instead of a bean lot, and no bean-fit penalty.
          const beanFit=!recipe.beans||crop.id===recipe.bean?0:-5,base=recipe.beans?qualityOf(lots):80;
          extra={quality:Math.round(clamp(score*.75+base*.25+gearBonus(recipe,cafe.gear)+beanFit+brandBonus,0,100))};message=t('farmRules.msg.brewed',{name:recipe.name});
        }else if(action==='sell'){
          const recipe=recipeById(choice?.recipeId);if(!recipe)return fail(t('farmRules.err.unknownRecipe'));
          const g=progress.robotGift,robot=choice.robot===true,tally=g.state==='active'?g.tally:null;
          // A robot cup: 25% of customers refuse it (no pay, lost reason 'robot'); otherwise it pays without stars/combo/extras and never counts as the player's serve.
          if(robot&&Math.random()<.25){loseCustomer('robot');if(tally){tally.robot.cups++;tally.robot.walked++;}extra={walked:true,reason:'robot'};message=t('farmRules.msg.robotRefused');}
          else{
          const quality=clamp(finite(choice.quality),0,100),stars=clamp(integer(choice.stars),0,3),wait=clamp(finite(choice.wait),0,1),combo=robot?0:clamp(integer(choice.combo),0,5);
          const comfort=Number.isInteger(choice.table)&&choice.table>=0&&choice.table<MAX_TABLES?TABLE_LEVELS[cafe.tables[choice.table]-1].tip:0;
          const p=priceOf(cafe.prices,recipe.id),price=Math.round(recipe.price*p*(.6+.4*quality/100)*(choice.cold?.7:1)*(choice.special&&!robot?1.3:1)*(cafe.gear.roastery?1.1:1)*(!robot&&!choice.staff?OWN_CUP:1)*100)/100,tip=Math.round(tipFactor(p)*recipe.price*(robot?(1-wait)*.1:Math.max(0,stars-1)*.15+(1-wait)*.1+combo*.04+(choice.memory?.2:0)+comfort+clamp(finite(choice.charm),0,.1))*100)/100;
          money(price+tip,'cafe-sale',at,recipe.name);cafe.revenue+=price+tip;cafe.served++;if(!robot){if(!choice.staff&&++progress.stats.served===1)emit('tutorial_completed',{step:'first_cup',ms_since_start:Math.max(0,Math.round(at-progress.epoch))});progress.xp+=1+stars;}cafe.reputation=clamp(cafe.reputation+(stars-1)*.6-(stars===0&&p>=GREEDY_P-1e-9?.3:0),10,100); // F-42 overpriced flop; quests count only your own cups (GDD 9.2)
          if(tally&&(robot||!choice.staff)){const t=robot?tally.robot:tally.you;t.cups++;t.stars+=stars;t.paid+=price+tip;}
          extra={price,tip};message=t('farmRules.msg.sold',{name:recipe.name,price,tip});
          }
        }else if(action==='lost'){
          loseCustomer(choice);message=choice==='rude'?t('farmRules.msg.lostRude'):t('farmRules.msg.lost');
        }else if(action==='giftReport'){
          progress.robotGift.reported=true;
        }else if(action==='incident'){
          // Fires a café member's rolled incident (service calls it when paidUntil − now ≤ due). skip: the shift's one rude incident is used up.
          const m=cafe.crew.find(m=>m.id===choice?.id),i=m?.incident;if(!i||i.done)return fail(t('farmRules.err.noIncident'));if(m.paidUntil-at>i.due)return fail(t('farmRules.err.notYet'));
          const giftOn=cafe.crew.some(s=>s.gift&&s.paidUntil>at&&!s.rest);
          const applied=i.type!=='none'&&!choice.skip&&candidateById(m.id).kind!=='robot'&&i.for>INCIDENTS.grace&&cafeActive&&cafe.open&&!giftOn&&cafe.reputation>=INCIDENTS.minRep;
          i.done=true;if(applied&&i.type==='sick')m.rest=CAFE_SHIFT_MS;
          extra={type:i.type,applied};
        }else if(action==='autoBrew'){
          if(progress.coins<AUTO_BREW_COST)return fail(t('farmRules.err.missingCoins',{n:Math.round((AUTO_BREW_COST-progress.coins)*100)/100}));
          money(-AUTO_BREW_COST,'cafe-cost',at,t('crew.autobrew.ledger'));cafe.costs+=AUTO_BREW_COST;message=t('crew.autobrew.paid',{cost:AUTO_BREW_COST});
        }else if(action==='prefs'){
          if(choice?.milk!==undefined){if(!MILKS.includes(choice.milk))return fail(t('farmRules.err.noSupply'));cafe.prefs.milk=choice.milk;}
          if(choice?.water!==undefined){if(!WATERS.includes(choice.water))return fail(t('farmRules.err.noSupply'));cafe.prefs.water=choice.water;}
          message=t('crew.prefs.saved');
        }else if(action==='buy'){
          const supply=SUPPLIES.find(s=>s.id===choice);if(!supply)return fail(t('farmRules.err.noSupply'));if(progress.coins<supply.price)return fail(t('farmRules.err.missingCoins',{n:Math.round((supply.price-progress.coins)*100)/100}));
          money(-supply.price,'cafe-cost',at,supply.name);cafe.costs+=supply.price;cafe.supplies[supply.id]+=supply.pack;message=t('farmRules.msg.bought',{name:supply.name,pack:supply.packLabel});
        }else if(action==='gear'){
          const gear=GEAR.find(g=>g.id===choice);if(!gear)return fail(t('farmRules.err.noGear'));const lv=cafe.gear[gear.id];if(lv>=gear.prices.length)return fail(t('farmRules.err.atMax'));
          const price=gear.prices[lv];if(progress.coins<price)return fail(t('farmRules.err.missingCoins',{n:Math.round((price-progress.coins)*100)/100}));
          money(-price,'upgrade',at,gear.name);cafe.gear[gear.id]++;message=t('farmRules.msg.levelUp',{name:gear.name,level:cafe.gear[gear.id]});
        }else if(action==='hire'){
          // Hiring a new person, or paying a new day for someone whose shift ended.
          // Robots hire per shift like people (no packs: a `pack` field is ignored), only once the farm Staff button is open. Gift robots are never for hire.
          const hireId=idOf(choice),person=candidateById(hireId),role=roleOf(hireId);if(!person)return fail(t('farmRules.err.noCandidate'));
          if(person.giftOnly)return fail(t('farmRules.err.giftOnly'));
          if(person.kind==='robot'&&!workersOpen())return fail(t('farmRules.err.openStaffFirst'));
          const member=cafe.crew.find(m=>m.id===person.id);if(member?.paidUntil>at)return fail(t('farmRules.err.onShift',{name:person.person}));
          const crew=cafe.crew.filter(m=>!m.gift); // gift robots do not take crew or role slots
          if(!member&&crew.length>=MAX_CREW)return fail(t('farmRules.err.crewMax',{n:MAX_CREW}));
          if(!member&&crew.filter(m=>roleOf(m.id).id===role.id).length>=role.max)return fail(t('farmRules.err.roleFull',{n:role.max,role:role.name.toLowerCase()}));
          const wage=staffWage(role,member?.level||1,person);if(progress.coins<wage)return fail(t('farmRules.err.firstWage',{wage}));
          money(-wage,'wage',at,person.person);cafe.paid.wages+=wage;const target=member||{id:person.id,level:1,paidUntil:0,shifts:0,incident:null,rest:0,gift:false};if(!member)cafe.crew.push(target);
          target.paidUntil=at+CAFE_SHIFT_MS;cafeShiftPaid(target,at);message=t('farmRules.msg.cafeHired',{name:person.person,role:role.name,wage});
        }else if(action==='train'){
          const member=cafe.crew.find(m=>m.id===choice);if(!member)return fail(t('farmRules.err.hireBeforeTrain'));if(member.gift||candidateById(member.id).kind==='robot')return fail(t('farmRules.err.robotNoTrain'));if(member.level>=STAFF_MAX)return fail(t('farmRules.err.atMax'));
          const cost=trainCost(member.level);if(progress.coins<cost)return fail(t('farmRules.err.missingCoins',{n:Math.round((cost-progress.coins)*100)/100}));
          money(-cost,'training',at,candidateById(member.id).person);member.level++;message=t('farmRules.msg.levelUp',{name:candidateById(member.id).person,level:member.level});
        }else if(action==='shift'){
          // End-of-shift reward; the scene reports its counts, bounded so a tampered report cannot mint coins.
          // Three tiers from the bronze goal (docs/screens/04-cafe/rules.md §4); the model derives the tier itself from the clamped counts.
          const served=clamp(integer(choice?.served),0,200),goal=clamp(integer(choice?.goal),1,200),good=finite(choice?.avg)>=2;
          const tier=!good?0:served>=Math.ceil(goal*SHIFT_TIERS[2])?3:served>=Math.ceil(goal*SHIFT_TIERS[1])?2:served>=goal?1:0;
          const bonus=Math.min(300,served*[0,3,4,5][tier]),rep=tier||(served<Math.ceil(goal/2)?-1:0);
          if(bonus)money(bonus,'cafe-sale',at,t('farmRules.ledger.shiftBonus'));cafe.reputation=clamp(cafe.reputation+rep,10,100);
          const medal=tier?t(`farmRules.msg.medal.${tier}`):'';
          {const pd=cafe.paid;sample(cafe.shiftLog,{id:nextId('shift'),at,cups:served,revenue:integer(choice?.revenue,1e9),costs:integer(choice?.costs,1e9),wages:Math.round((pd.wages-pd.markW)*100)/100,beans:Math.round((pd.beans-pd.markB)*100)/100,left:clamp(integer(choice?.lost),0,200),avgWait:clamp(finite(choice?.avgWait),0,600),tier,meanPrice:clamp(finite(choice?.meanPrice,1),.8,1.3),crew:cafe.crew.filter(m=>!m.gift&&m.paidUntil>at).length,menu:clamp(integer(choice?.menu),0,50),milk:cafe.prefs.milk,water:cafe.prefs.water,staffN:clamp(integer(choice?.staffN),0,200),tiredN:clamp(integer(choice?.tiredN),0,200),staffStars:clamp(finite(choice?.staffStars),0,3),staffSecs:clamp(finite(choice?.staffSecs),0,600)},10);pd.markW=pd.wages;pd.markB=pd.beans;}
          // F-45: ca thường đầu tiên (không phải ca tập, choice.learning) là mốc có mặt của Thần Thương Hội.
          const learning=choice?.learning===true;if(!learning&&regionType(progress.region)!=='farm')councilArrive('business');
          extra={bonus,met:tier>0,tier,rep};emit('shift_ended',{learning,cups:served,tier,left:clamp(integer(choice?.lost),0,200),revenue:integer(choice?.revenue,1e9),costs:integer(choice?.costs,1e9)});message=tier?t('farmRules.msg.shiftMet',{medal,bonus,rep}):t(rep?'farmRules.msg.shiftMissedRep':'farmRules.msg.shiftMissed');
        }else if(action==='table'){
          const i=integer(choice),indoor=assetValue(ASSETS.find(a=>a.id==='cafe'),progress.upgrades.cafe);
          // Indoor tables open with the café upgrade; the two garden tables (10, 11) with Sân vườn.
          if(!Number.isInteger(choice)||i<0||i>=MAX_TABLES||(i<10?i>=indoor:!cafe.gear.terrace))return fail(t('farmRules.err.tableLocked'));
          const lv=cafe.tables[i];if(lv>=TABLE_LEVELS.length)return fail(t('farmRules.err.tableMax'));const price=TABLE_LEVELS[lv].price;
          if(progress.coins<price)return fail(t('farmRules.err.missingCoins',{n:Math.round((price-progress.coins)*100)/100}));
          money(-price,'upgrade',at,t('farmRules.ledger.table',{n:i+1}));cafe.tables[i]++;message=t('farmRules.msg.tableUp',{n:i+1,name:TABLE_LEVELS[cafe.tables[i]-1].name});
        }else if(action==='fire'){
          if(!cafe.crew.some(m=>m.id===choice))return fail(t('farmRules.err.notHiredPerson'));if(cafe.crew.some(m=>m.id===choice&&m.gift))return fail(t('farmRules.err.giftLeaves'));cafe.crew=cafe.crew.filter(m=>m.id!==choice);message=t('farmRules.msg.quit',{name:candidateById(choice).person});
        }else if(action==='order'){
          const crop=cropById(choice);if(!crop||crop.level>level())return fail(t('farmRules.err.cropNotFarm'));
          if(progress.orders.filter(o=>o.source!=='shop'&&['open','transit'].includes(o.status)).length>=4)return fail(t('farmRules.err.farmOrdersFull'));
          progress.orders.push({id:nextId('order'),day:weatherAt(at).day,cropId:crop.id,grams:252,status:'open',workers:[],deadline:at+DAY_MS*8,createdAt:at,source:'cafe'});message=t('farmRules.msg.orderSent',{crop:crop.short});
        }else return fail(t('farmRules.err.noCafeAction'));
      }else if(id==='lessons'){
        const lesson=lessonOf(choice?.questionId),L=progress.lessons;
        if(!['answer','defer','council'].includes(action)||!lesson)return fail(t('farmRules.err.noQuestion'));
        const {expert,question}=lesson;if(L.learned.includes(question.id))return fail(t('farmRules.err.knownTip'));
        if(action==='council'){
          // F-45 lượt đầu ở Hội đồng: không đọc/ghi askedDay/askedCount (không ăn suất hỏi lại trong ngày); sai thì vào hỏi lại như cũ.
          if(L.met.includes(question.id))return fail(t('farmRules.err.metTip'));
          if(!L.arrived.includes(expert.id))return fail(t('farmRules.err.councilAbsent'));
          if(!question.options.some(o=>o.id===choice.optionId))return fail(t('farmRules.err.pickAnswer'));
          const correct=choice.optionId===question.correct,perk=LESSON_PERKS[question.id];L.met.push(question.id);
          if(correct){L.learned.push(question.id);grantLessons(at,'council');extra={correct,explanation:answerText(question,true),perk:{id:question.id,...perk}};message=t('farmRules.msg.newTip',{name:perk.name,effect:perk.effect});}
          else{L.asked[question.id]=workDay(at);extra={correct,explanation:answerText(question,false)};message=t('farmRules.msg.tipMissed');}
          emit('council_answered',{expert:expert.id,questionId:question.id,correct});
        }else{
        if(!L.met.includes(question.id))return fail(t('farmRules.err.notMet'));
        if(!askable(question.id,at))return fail(t('farmRules.err.reviewedToday'));
        if(action==='defer'){if(L.askedDay!==workDay(at)){L.askedDay=workDay(at);L.askedCount=0;}L.askedCount++;} // defer: counts as asked today, no result, no reward
        else{
        if(!question.options.some(o=>o.id===choice.optionId))return fail(t('farmRules.err.pickAnswer'));
        const correct=choice.optionId===question.correct,day=workDay(at),perk=LESSON_PERKS[question.id];
        if(L.askedDay!==day){L.askedDay=day;L.askedCount=0;}L.askedCount++;
        if(correct){L.learned.push(question.id);grantLessons(at);extra={correct,explanation:answerText(question,true),perk:{id:question.id,...perk}};message=t('farmRules.msg.newTip',{name:perk.name,effect:perk.effect});}
        else{L.asked[question.id]=day;extra={correct,explanation:answerText(question,false)};message=t('farmRules.msg.tipMissed');}}}
      }else if(id==='autoplay'){
        const a=progress.autoplay;
        if(action==='start'){if(a.leftMs<=0){if(a.runs<=0)return fail(t('crew.auto.none'));a.runs--;a.leftMs=AUTOPLAY.runMs;}message=t('crew.auto.started',{min:Math.ceil(a.leftMs/60000),runs:a.runs});emit('auto_started',{runs_left:a.runs});}
        else if(action==='spend')a.leftMs=Math.max(0,a.leftMs-clamp(finite(choice),0,60000));
        else return fail(t('crew.auto.none'));
      }else if(id==='memory'&&action==='xp'){
        // Quick Taste +3 (game cup) / +5 (real cup), +5 more for a full Insight; 30 XP per work day (coffee-memory.md).
        const day=workDay(at),m=progress.memoryXp;if(m.day!==day){m.day=day;m.xp=0;}
        const want=(MEMORY_XP[choice?.kind]||0)+(choice?.insight?MEMORY_XP.insight:0),gain=Math.max(0,Math.min(want,MEMORY_XP_CAP-m.xp));
        m.xp+=gain;progress.xp+=gain;extra={xp:gain};
      }else if(id==='awakening'){
        // F-35 (decode-awaken.md): check | decode {questionId, choice} | hypothesis {variable, direction, attribute}. Never touches coins or stock.
        // A no-op check must not bump workRevision/save: the UI re-checks whenever the revision moves, so that looped every 3 s (perf QA 05/11).
        const before=action==='check'?JSON.stringify(progress.awakening):null;
        const r=awakenRun(action,choice,at,true);if(!r.ok)return {ok:false,message:'',...r};
        if(before!==null&&before===JSON.stringify(progress.awakening))return {ok:true,message:'',changed:false};
        if(r.xp)api.act('decode','xp',null,at);extra={correct:r.correct,xp:r.xp?DECODE_XP:0};
      }else if(id==='decode'&&action==='xp'){
        progress.xp+=DECODE_XP;extra={xp:DECODE_XP};
      }else if(id==='victory'&&action==='discovery'){
        checkVictories(at,integer(choice,99));
      }else if(id==='tutorial'){
        if(action!=='seen'||!tutorialId(choice))return fail(t('farmRules.err.noTutorial'));
        if(!progress.tutorial.seen.includes(choice))progress.tutorial.seen.push(choice);
      }else if(id==='fence'&&action==='repair'){
        if(progress.coins<5)return fail(t('farmRules.err.repairCoins'));money(-5,'maintenance',at,t('farmRules.asset.fence.name'));progress.durability=100;message=t('farmRules.msg.fenceRepaired');
      }else if(field){
        if(action!=='expand'||owned.includes(id)||!adjacent(id))return fail(t('farmRules.err.adjacentFirst'));if(progress.coins<field.price)return fail(t('farmRules.err.needCoins',{n:field.price}));
        money(-field.price,'land',at,field.name);owned.push(id);for(const tree of progress.plots)tree.unlocked=owned.includes(PLOTS.find(c=>c.id===tree.id).fieldId);progress.stats.expanded++;emit('field_bought',{index:FIELDS.indexOf(field),level:level()});message=t('farmRules.msg.fieldOpened',{name:field.name});
      }else if(p){
        if(!p.unlocked)return fail(t('farmRules.err.fieldLocked'));const care=plotCare(p);
        if(action==='plant'){
          const crop=cropById(choice);if(!crop||p.stage!=='empty'||crop.level>level()||!progress.seeds[crop.id])return fail(t('farmRules.err.needPlotSeed'));
          progress.seeds[crop.id]--;Object.assign(p,{cropId:crop.id,stage:'planted',mature:false,growthMs:0,water:50,weeds:0,fertilized:false,readyYield:0,remainingFruit:0,secondPick:0,quality:80,health:100,pruned:false});message=t('farmRules.msg.planted');
        }else if(action==='clear'){
          if(p.stage==='empty')return fail(t('farmRules.err.plotEmpty'));Object.assign(p,{stage:'empty',mature:false,growthMs:0,readyYield:0,remainingFruit:0,secondPick:0,fertilized:false});message=t('farmRules.msg.cleared');
        }else if(action==='water'){
          if(!care.needsWater)return fail(t('farmRules.err.noWaterNeed'));
          const w=progress.workers.find(w=>w.id===owner);if(w){if(!w.water)return fail(t('farmRules.err.workerNeedsWater'));w.water--;}else{if(!progress.water)return fail(t('farmRules.err.canEmpty'));progress.water--;}
          p.water=70;if(owner==='player')progress.stats.watered++;message=t('farmRules.msg.watered');
        }else if(action==='weed'){
          if(!care.needsWeeding)return fail(t('farmRules.err.noWeedNeed'));p.weeds=0;if(owner==='player')progress.stats.weeded++;message=t('farmRules.msg.weeded');
        }else if(action==='fertilize'){
          if(!care.canFeed||!progress.fertilizer)return fail(t('farmRules.err.cantFeed'));progress.fertilizer--;p.fertilized=true;message=t('farmRules.msg.fed');
        }else if(action==='prune'){
          if(!p.mature||p.stage==='ready'||p.growthMs/cropById(p.cropId).regrowMs>.17||p.pruned)return fail(t('farmRules.err.pruneOnce'));p.pruned=true;message=t('farmRules.msg.pruned');
        }else if(action==='harvest'){
          if(!care.ready)return fail(t('farmRules.err.notRipe'));if(usedStorage()+p.readyYield>storageCapacity())return fail(t('farmRules.err.harvestStorage',{left:storageCapacity()-usedStorage(),need:p.readyYield}));
          const amount=p.readyYield;
          add('cherries',p.cropId,amount,owner==='player'&&progress.lessons.learned.includes('ripe')?p.quality+5:p.quality,at,'farm',p.id); // add() caps at 100
          {const lot=progress.lots.at(-1);sample(progress.awakening.samples.harvests,{id:lot.id,at,day:workDay(at),cropId:p.cropId,by:via==='auto'?'auto':owner==='player'?'player':'staff',grams:amount,quality:lot.quality,fertilized:p.fertilized,pruned:p.pruned,value:Math.round(amount*productById('cherries').price*cropById(p.cropId).priceScale*marketQualityFactor(lot.quality)*100)/100},20);}
          if(owner==='player')progress.stats.harvested++;progress.today.harvested+=amount;progress.xp+=6;
          Object.assign(p,{stage:'growing',growthMs:0,readyYield:0,remainingFruit:0,secondPick:0,fertilized:false,pruned:false,season:p.season+1});
          collected=true;message=t('farmRules.msg.harvested',{grams:amount});
        }else return fail(t('farmRules.err.noJob'));
      }else if(m){
        const state=progress.machines[id],lv=progress.upgrades[id],jobs=jobsOf(state);
        if(action==='start'){
          const crop=cropById(typeof choice==='object'?choice?.cropId:choice);if(!crop)return fail(t('farmRules.err.pickCoffee'));
          const available=Math.floor(progress.stock[m.input][crop.id]/m.inputCount),asked=typeof choice==='object'?integer(choice.quantity):available;
          if(!asked||asked>available)return fail(t('farmRules.err.noInput',{n:m.inputCount}));
          if(jobs.length>=48)return fail(t('farmRules.err.queueFull'));
          const perBatch=Math.max(1,Math.floor(m.capacity*capacityScale(lv)/m.inputCount));
          // Queue what fits in the 48-batch line instead of refusing the whole request (large stocks used to block processing forever).
          const requested=Math.min(asked,(48-jobs.length)*perBatch);
          const inputLots=take(m.input,crop.id,requested*m.inputCount),quality=qualityOf(inputLots);
          let left=requested,startAt=Math.max(at,...jobs.map(j=>j.readyAt)),duration=Math.round(m.duration/efficiency(lv));
          while(left){const n=Math.min(left,perBatch);jobs.push({id:nextId('batch'),cropId:crop.id,quantity:n,inputGrams:n*m.inputCount,outputGrams:n*m.outputCount,quality,origin:inputLots.map(l=>l.id).join(','),startedAt:startAt,readyAt:startAt+duration,turned:false});left-=n;startAt+=duration;}
          putJobs(state,jobs);message=requested<asked?t('farmRules.msg.queuedPartial',{done:requested,asked}):t('farmRules.msg.queued');
        }else if(action==='collect'){
          const ready=jobs.filter(j=>j.readyAt<=at&&(!choice||j.id===choice));if(!ready.length)return fail(t('farmRules.err.batchNotReady'));
          let space=storageCapacity()-usedStorage();const done=[];
          for(const job of ready){if(job.outputGrams<=space){done.push(job);space-=job.outputGrams;}}
          if(!done.length){const required=Math.min(...ready.map(j=>j.outputGrams));return fail(t('farmRules.err.collectStorage',{used:formatMass(usedStorage()),cap:formatMass(storageCapacity()),free:formatMass(Math.max(0,space)),need:formatMass(required),short:formatMass(Math.max(0,required-space))}));}
          const mass=done.reduce((sum,j)=>sum+j.outputGrams,0);
          for(const j of done){add(m.output,j.cropId,j.outputGrams,j.quality,at,'farm',j.origin||id);sample(progress.awakening.samples.batches,{id:j.id,machine:id,at,day:workDay(at),cropId:j.cropId,quality:j.quality,delayMs:Math.max(0,at-j.readyAt)},20);}
          if(owner==='player')progress.stats[m.output]+=mass;progress.today.processed+=mass;progress.xp+=4*done.length;putJobs(state,jobs.filter(j=>!done.includes(j)));message=t('farmRules.msg.collected',{n:done.length,mass:formatMass(mass),product:productById(m.output).name.toLowerCase(),left:ready.length-done.length});collected=true;
        }else if(action==='turn'&&id==='dryer'){
          const j=jobs.find(j=>!j.turned&&at>=(j.startedAt+j.readyAt)/2&&at<j.readyAt);if(!j)return fail(t('farmRules.err.notTurnTime'));j.turned=true;j.quality=Math.min(100,j.quality+2);message=t('farmRules.msg.turned');
        }else if(action==='cancel'){
          const j=jobs.find(j=>j.id===choice&&j.startedAt>at);if(!j)return fail(t('farmRules.err.cancelQueued'));add(m.input,j.cropId,j.inputGrams,j.quality,at,'farm','returned');const rest=jobs.filter(job=>job!==j);let cursor=Math.max(at,...rest.filter(job=>job.startedAt<=at).map(job=>job.readyAt));for(const job of rest.filter(job=>job.startedAt>at).sort((a,b)=>a.startedAt-b.startedAt)){const dur=job.readyAt-job.startedAt;job.startedAt=cursor;job.readyAt=cursor+dur;cursor=job.readyAt;}putJobs(state,rest); // close the gap left by the cancelled batch
          message=t('farmRules.msg.cancelled');
        }else return fail(t('farmRules.err.noAction'));
      }else if(id==='directives'){
        const d=progress.directives,names=Object.fromEntries(['care','plant','process','fertilize'].map(k=>[k,t(`farmRules.directive.${k}`)]));
        if(action==='toggle'&&names[choice]){d[choice]=!d[choice];message=t('farmRules.msg.directive',{name:names[choice],state:t(d[choice]?'farmRules.msg.on':'farmRules.msg.off')});}
        else if(action==='crop'){const allowed=CROPS.filter(c=>c.level<=level()),next=allowed[(allowed.findIndex(c=>c.id===d.plantCrop)+1)%allowed.length];d.plantCrop=next.id;message=t('farmRules.msg.directiveCrop',{name:next.name});}
        else return fail(t('farmRules.err.noDirective'));
      }else if(id==='well'&&action==='refill'){
        const w=progress.workers.find(w=>w.id===owner),current=w?.water||(!w?progress.water:0),needed=waterCapacity()-current,amount=Math.min(needed,Math.floor(progress.reservoir));
        if(amount<1)return fail(t('farmRules.err.wellEmpty'));progress.reservoir-=amount;if(w)w.water=current+amount;else progress.water=current+amount;message=t('farmRules.msg.refilled',{n:amount});
      }else if(id==='seed-shop'){
        const quantity=typeof choice==='object'&&choice!==null?choice.quantity:1;
        if(!Number.isInteger(quantity)||quantity<1||quantity>99)return fail(t('farmRules.err.qty'));
        if(action==='buySeed'){
          const c=cropById(typeof choice==='object'?choice.cropId:choice);
          if(!c||c.level>level()||progress.coins<c.seedPrice*quantity)return fail(t('farmRules.err.seedCoins'));
          money(-c.seedPrice*quantity,'seedling',at,c.name);progress.seeds[c.id]+=quantity;message=t('farmRules.msg.seedBought',{n:quantity,crop:c.short});
        }else if(action==='fertilizer'){
          if(progress.coins<FERTILIZER_PRICE*quantity)return fail(t('farmRules.err.coins'));
          money(-FERTILIZER_PRICE*quantity,'fertilizer',at,t('farmRules.ledger.fertilizer'));progress.fertilizer+=quantity;message=t('farmRules.msg.fertBought',{n:quantity});
        }else return fail(t('farmRules.err.noItem'));
      }else if(id==='market'){
        if(action==='acceptOrder'){
          if(!progress.order.accepted){progress.order.accepted=true;progress.order.deadline=at+8*DAY_MS;}
          progress.order.workers=[];message=t('farmRules.msg.marketAccepted');
        }else if(action==='order'){
          if(progress.market.orders>=ORDERS_PER_DAY)return fail(t('farmRules.err.orderCap'));const o=progress.order;if(choice&&choice!==o.id)return fail(t('farmRules.err.orderChanged'));if(progress.stock[o.product][o.cropId]<o.quantity)return fail(t('farmRules.err.notEnoughGoods'));
          if(o.product==='roasted'&&progress.cafe.reserve&&Object.values(progress.stock.roasted).reduce((s,n)=>s+n,0)-o.quantity<demand().needed)return fail(t('farmRules.err.reservedForCafe'));
          progress.orders.push({...o,grams:o.quantity,status:'delivered',source:'shop',rating:5,day:weatherAt(at).day,workers:o.workers||[]});const taken=take(o.product,o.cropId,o.quantity),pay=orderPay(o,qualityOf(taken||[]));money(pay,'order',at,t('farmRules.ledger.buyOrder'));progress.stats.sold+=o.quantity;if(o.product!=='cherries')progress.stats.beansSold+=o.quantity;progress.stats.orders++;progress.market.orders++;log(t('farmRules.log.shopOnTime'),at);progress.xp+=o.xp;progress.orderIndex++;progress.order=makeOrder(at);message=t('farmRules.msg.orderDelivered');
        }else if(action==='sell'){
          const [product,cropId]=String(typeof choice==='object'?choice.item:choice).split(':'),item=productById(product);
          const grams=typeof choice==='object'?choice.grams:progress.stock[product]?.[cropId]||0;
          const quote=saleQuote(product,cropId,grams);
          if(!quote.ok)return fail(quote.message);
          // XP follows coins earned so splitting a sale into 1 g clicks gains nothing.
          take(product,cropId,grams);money(quote.value,'sale',at,item.name);progress.market.sold+=quote.base;progress.stats.sold+=grams;{const S=progress.awakening.samples,d=workDay(at),ratio=quote.full?quote.value/quote.full:1;if(!S.market||S.market.day!==d)S.market={day:d,first:ratio,last:ratio,floor:false};else S.market.last=ratio;if(progress.market.sold>=.7*MARKET_DAILY){S.market.floor=true;const row={id:`day-${d}`,at,first:S.market.first,last:S.market.last},i=S.floorDays.findIndex(x=>x.id===row.id);if(i<0)sample(S.floorDays,row,6);else S.floorDays[i]=row;}}if(product!=='cherries')progress.stats.beansSold+=grams;{const gain=Math.min(Math.floor(quote.value/2),MARKET_XP_CAP-progress.market.xp);progress.market.xp+=gain;progress.xp+=gain;}message=t('farmRules.msg.sale',{grams,value:quote.value});
        }else return fail(t('farmRules.err.noTrade'));
      }else return fail(t('farmRules.err.noSpot'));
      if(id!=='autoplay'&&!['permission','mode','role','seed','autoPay','reserve','toggle','prices','crop','brew','sell','lost','buy','shift','answer','seen','incident','remind','giftReport','xp','discovery','decode','hypothesis','check'].includes(action)){const person=progress.workers.find(w=>w.id===owner);log(`${person?person.name:t('farmRules.log.you')}: ${message}`,at);}
      if(action==='harvest'||action==='collect'||(id==='cafe'&&action==='shift')||(id==='market'&&action==='sell'))awakenRun('check',null,at,false); // memory-free pass; Memory events re-check via wireFarm
      progress.workRevision++;const earned=rewards();grantGift(at);commit(at);return {ok:true,message,collected,quests:earned,...extra};
    },
  };
  // Gift after the load-time advance so offline time is not added to the gift shift.
  if(finite(saved?.lastAt,now)>now)shiftTimes(now-saved.lastAt);
  refreshDaily(now);advance(now);grantGift(now);commit(now);return api;
}
// Migration ids are independent from new lot ids and need no persisted counter.
let savedSequence=0;
