import { t, formatNumber } from '../../i18n/index.js';
import { regionType } from '../world-map/content.js';
// All durations are compressed game time, not instructions for real cultivation.
export const DAY_MS = 60000;
export const SEASON_MS = DAY_MS * 6;
export const MAX_LEVEL = 999;
export const OFFLINE_MS = 8 * 3600000;
// One café opening; café staff are paid per shift so a closed café wastes no paid time.
export const CAFE_SHIFT_MS = 240000;
// Fertilizer must repay itself (+11% yield, +5 quality); outside beans cost more than farm beans so the café still needs the farm.
export const FERTILIZER_PRICE = 1;
export const SUPPLIER_PRICE = 75;
// Café-only regions have no farm beans, so the supplier sells cheaper there (EC-3: keeps Phin đen/Nâu đá above break-even).
export const SUPPLIER_PRICE_CAFE_ONLY = 45;
export const supplierPrice = region => regionType(region) === 'cafe' ? SUPPLIER_PRICE_CAFE_ONLY : SUPPLIER_PRICE;
// Market price per work day (6 minutes) falls linearly from 100% to a 30% floor once 70% of MARKET_DAILY base coins are sold, so surplus beans pay more per gram at the café.
// Kept as is 04/11/2026 (GDD 10.3, 10.5): the market stays the main income; lowering it only slows progress, the café is capped by guest pace.
// Integrated over the work day's sold base value: one big sale and many small ones earn the same.
export const MARKET_DAILY = 1200;
export const ORDERS_PER_DAY = 2; // shop orders per work day, stops order-farming
// F-41 (04/11/2026): fertilizer trades quality for yield, pruning the reverse; no care = x1.0.
export const careYield = (fertilized, pruned) => (fertilized ? 1.15 : 1) * (pruned ? .9 : 1);
export const careQuality = (fertilized, pruned) => (fertilized ? -6 : 0) + (pruned ? 10 : 0);
export const marketQualityFactor = q => .3 + .8 * q / 100;
// Shop order: 1.2x base, 1.6x when the delivered lots average quality >= 85. `reward` stays the 1.2x price fixed at creation.
export const ORDER_HIGH_QUALITY = 85;
export const orderPay = (order, quality) => quality >= ORDER_HIGH_QUALITY ? Math.round(order.reward * 4 / 3) : order.reward;
// F-43 (04/11/2026): [yield x, quality +, growth-time x] per region and crop. Cafe-only regions are absent (no farm).
export const REGION_CROP = {
  vn: { robusta: [1.10, 0, 1], arabica: [.95, 3, 1], liberica: [1, 0, 1] },
  br: { robusta: [1.05, -3, 1], arabica: [1.10, 0, 1], liberica: [.85, -5, 1.1] },
  co: { robusta: [.80, -8, 1.1], arabica: [1, 8, 1.1], liberica: [.80, -8, 1.1] },
  ke: { robusta: [.80, -8, 1.1], arabica: [.95, 10, 1.1], liberica: [.80, -8, 1.1] },
  id: { robusta: [1.05, 0, 1], arabica: [.95, 2, 1], liberica: [1.10, 3, .95] }
};
export const regionCrop = (region, cropId) => { const [y, q, g] = REGION_CROP[region]?.[cropId] || [1, 0, 1]; return { yield: y, quality: q, growth: g }; };
export const regionFit = (region, cropId) => { const r = regionCrop(region, cropId); return r.yield >= 1.05 || r.quality >= 5 ? 'good' : r.yield <= .9 ? 'poor' : 'neutral'; };
export const RELIEF_GRAMS = 300; // free beans for a bankrupt café-only region
const marketCurve = x => x <= .7 * MARKET_DAILY ? x - x * x / (2 * MARKET_DAILY) : .455 * MARKET_DAILY + .3 * (x - .7 * MARKET_DAILY);
export const marketValue = (soldToday, base) => marketCurve(soldToday + base) - marketCurve(soldToday);
export const ASSETS = [
  {id:'soil',name:t('farmRules.asset.soil.name'),icon:'🌱',category:'farm',base:90,benefit:t('farmRules.asset.soil.benefit'),baseValue:100,unit:t('farmRules.asset.soil.unit')},
  {id:'fence',name:t('farmRules.asset.fence.name'),icon:'🪵',category:'farm',base:80,benefit:t('farmRules.asset.fence.benefit'),baseValue:100,unit:t('farmRules.asset.fence.unit')},
  {id:'pond',name:t('farmRules.asset.pond.name'),icon:'🌊',category:'water',base:100,benefit:t('farmRules.asset.pond.benefit'),baseValue:60,unit:t('farmRules.asset.pond.unit')},
  {id:'well',name:t('farmRules.asset.well.name'),icon:'💧',category:'water',base:60,benefit:t('farmRules.asset.well.benefit'),baseValue:6,unit:t('farmRules.asset.well.unit')},
  {id:'tools',name:t('farmRules.asset.tools.name'),icon:'⛏️',category:'farm',base:75,benefit:t('farmRules.asset.tools.benefit'),baseValue:4,unit:t('farmRules.asset.tools.unit'),decreases:true},
  {id:'dryer',name:t('farmRules.asset.dryer.name'),icon:'☀️',category:'processing',base:100,benefit:t('farmRules.asset.dryer.benefit'),baseValue:18000,unit:t('farmRules.asset.dryer.unit')},
  {id:'roaster',name:t('farmRules.asset.roaster.name'),icon:'🔥',category:'processing',base:160,benefit:t('farmRules.asset.roaster.benefit'),baseValue:1000,unit:t('farmRules.asset.roaster.unit')},
  {id:'storage',name:t('farmRules.asset.storage.name'),icon:'🎒',category:'logistics',base:90,benefit:t('farmRules.asset.storage.benefit'),baseValue:60000,unit:t('farmRules.asset.storage.unit')},
  {id:'delivery',name:t('farmRules.asset.delivery.name'),icon:'🛒',category:'logistics',base:100,benefit:t('farmRules.asset.delivery.benefit'),baseValue:1000,unit:t('farmRules.asset.delivery.unit')},
  {id:'cafe',name:t('farmRules.asset.cafe.name'),icon:'🏪',category:'cafe',maxLevel:10,base:140,benefit:t('farmRules.asset.cafe.benefit'),baseValue:3,unit:t('farmRules.asset.cafe.unit')},
];
export const assetById = id => ASSETS.find(asset=>asset.id===id);
// Assets stop at level 20 (café equipment at 10): every level stays reachable in normal play (cut from 999 on 03/11/2026).
export const ASSET_MAX_LEVEL = 20;
export const assetMaxLevel = asset => asset?.maxLevel || ASSET_MAX_LEVEL;
export const efficiency = level => 1 + .07 * (Math.min(level, ASSET_MAX_LEVEL) - 1); // ×2.33 speed at 20
export const capacityScale = level => 1 + .18 * (Math.min(level, ASSET_MAX_LEVEL) - 1); // ×4.42 capacity at 20
export const upgradePrice = (id,level) => { const base = assetById(id)?.base || 100; return Math.ceil(level < 10 ? base * 1.42 ** (level - 1) : base * 1.42 ** 9 * (1 + .15 * (level - 10)) ** 2); };
// Farm level needed to reach an asset level: 1:1.
export const upgradeRequirement = next => next;
// Visual tiers: each has its own asset slot `farm/<id>/tier-<n>` so art can be swapped per tier.
export const ASSET_TIERS = [{min:1,name:t('farmRules.tier.basic')},{min:10,name:t('farmRules.tier.improved')},{min:20,name:t('farmRules.tier.pro')}];
export const assetTier = level => ASSET_TIERS.reduce((tier,t,i) => level >= t.min ? i + 1 : tier, 1);
export function assetValue(asset,level) {
  if(asset.id==='well')return level<=10?6+4*(level-1):42+(level-10);
  if(asset.id==='cafe')return Math.min(10,3+Math.round((level-1)*7/9)); // café room has 10 table spots
  return asset.decreases ? Math.round(10*asset.baseValue/efficiency(level))/10 : Math.round(asset.baseValue*capacityScale(level));
}
export const phaseOf = plot => plot.stage==='empty' ? t('farmRules.phase.empty') : plot.stage==='ready' ? t('farmRules.phase.ready') : !plot.mature ? t('farmRules.phase.seedling') : plot.growthMs/SEASON_MS<.17 ? t('farmRules.phase.recovery') : plot.growthMs/SEASON_MS<.25 ? t('farmRules.phase.flowering') : plot.growthMs/SEASON_MS<.75 ? t('farmRules.phase.fruiting') : t('farmRules.phase.ripening');
export const formatCoins = coins => formatNumber(coins,{maximumFractionDigits:2});
export const formatMass = (grams,digits=2) => grams>=1000 ? `${formatNumber(grams/1000,{maximumFractionDigits:digits})} kg` : `${Math.round(grams)} g`;
export const WORKER_CANDIDATES = [
  {id:'an',name:'An',color:'#759561',stats:{speed:65,intelligence:65,strength:55,dexterity:65,constitution:50},fee:150},
  {id:'binh',name:'Bình',color:'#bf8c58',stats:{speed:55,intelligence:55,strength:75,dexterity:50,constitution:65},fee:150},
  {id:'chi',name:'Chi',color:'#789ba5',stats:{speed:55,intelligence:80,strength:40,dexterity:75,constitution:50},fee:180},
];
WORKER_CANDIDATES.push(
  {id:'dung',name:'Dũng',color:'#6e8c96',stats:{speed:70,intelligence:45,strength:75,dexterity:45,constitution:65},fee:160},
  {id:'ha',name:'Hà',color:'#ad8768',stats:{speed:60,intelligence:75,strength:40,dexterity:80,constitution:45},fee:180},
  {id:'linh',name:'Linh',color:'#a5859a',stats:{speed:75,intelligence:65,strength:45,dexterity:60,constitution:55},fee:170},
  {id:'minh',name:'Minh',color:'#8b9c65',stats:{speed:50,intelligence:65,strength:65,dexterity:50,constitution:70},fee:160},
  {id:'nam',name:'Nam',color:'#b29357',stats:{speed:60,intelligence:60,strength:60,dexterity:60,constitution:60},fee:150},
  // Robots share the three farm slots, never level, and do exactly ONE chore each (crew-autoplay.md 2).
  ...[1,2,3].map(n=>({id:`robo-n${n}`,name:t('farmRules.worker.robotName')+(n>1?` ${n}`:''),kind:'robot',color:'#8d9aa3',stats:{speed:70,intelligence:60,strength:60,dexterity:70,constitution:60},fee:0,wage:15,jobs:['water','weed','processing','delivery']})),
);
for(const candidate of WORKER_CANDIDATES)candidate.bio=t(`farmRules.bio.${candidate.kind==='robot'?'robo-n1':candidate.id}`);
// Staff sign prepaid contracts. One work day equals one crop season (6 minutes of play).
export const WORK_DAY_MS = SEASON_MS;
export const CONTRACT_PLANS = [{id:'day',name:t('farmRules.plan.day'),days:1,price:1},{id:'week',name:t('farmRules.plan.week'),days:7,price:6},{id:'month',name:t('farmRules.plan.month'),days:28,price:21}];
// Robot wage is fixed by the candidate list (not the save) and never scales with level.
export const workerWage = worker => { const robot = WORKER_CANDIDATES.find(c=>c.id===worker.id&&c.kind==='robot'); return robot ? robot.wage : 30+10*(workerLevel(worker.xp)-1); };
// Prepaid robot packs (farm robot only): discount per pack size n.
export const ROBOT_PACKS = {1:0,5:.1,10:.25};
export const packPrice = (wage,n) => Math.ceil(wage*n*(1-ROBOT_PACKS[n]));
// Staff incidents for both scenes (robot-staff.md 4). grace = first shifts with no incident; minRep = café reputation floor.
export const INCIDENTS = {phone:.12,sick:.04,rude:.05,kCafe:.12,kFarm:.07,floor:.4,manager:.5,grace:2,minRep:30,phoneMs:40000};
// p(type) = p0 × max(F, 1 − k(L − 1)) × M; rude only for cashier/waiter, M only for phone/rude with an on-shift manager.
export function incidentOdds(level,k,manager=false,rude=false) {
  const f=Math.max(INCIDENTS.floor,1-k*(level-1)),m=manager?INCIDENTS.manager:1;
  return {phone:INCIDENTS.phone*f*m,sick:INCIDENTS.sick*f,rude:rude?INCIDENTS.rude*f*m:0};
}
// Shift hiring (03/11/2026): one plan, one work day (6 min) per payment, auto-renewed while the worker is at the farm.
export const contractPlan = () => CONTRACT_PLANS[0];
export const contractPrice = worker => workerWage(worker)*contractPlan(worker).price;
export const contractLeft = ms => ms<=0?t('farmRules.contract.expired'):ms>=WORK_DAY_MS?t('farmRules.contract.daysLeft',{days:Math.floor(ms/WORK_DAY_MS),minutes:Math.floor(ms%WORK_DAY_MS/60000)}):t('farmRules.contract.minutesLeft',{minutes:Math.ceil(ms/60000)});
export const workerLevel = xp => Math.min(10,1+Math.floor(Math.sqrt(xp/100)));
export const workerStat = (worker,key) => Math.min(100,worker.stats[key]+2*(workerLevel(worker.xp)-1));
// Farm slots and job limits (crew-autoplay.md 2): 3 shared slots, any mix; a robot does exactly one job,
// a person one job group (care · processing · delivery), two from level 4, all three from level 7 (đa nhiệm).
export const FARM_SLOTS = 3;
// Auto mode: 3 free runs of 10 minutes (≈ 30 minutes in all); time only counts while Auto is playing.
export const AUTOPLAY = { runs: 3, runMs: 10 * 60000 };
export const CARE_JOBS = ['plant','water','fertilize','weed','prune','harvest'];
export const JOB_GROUPS = ['care','processing','delivery'];
export const jobGroupOf = job => CARE_JOBS.includes(job) ? 'care' : job;
export const groupLimit = w => w.kind==='robot' ? 1 : workerLevel(w.xp)>=7 ? 3 : workerLevel(w.xp)>=4 ? 2 : 1;
export const nextGroupLevel = w => workerLevel(w.xp)>=7 ? null : workerLevel(w.xp)>=4 ? 7 : 4;
// Jobs the worker actually does: robot = its first enabled job; person = enabled jobs inside the first `groupLimit` enabled groups.
export function activeJobs(w) {
  const on = WORKER_JOBS.map(([id])=>id).filter(id=>w.jobs?.[id]!==false);
  if (w.kind==='robot') return new Set(on.slice(0,1));
  const groups = JOB_GROUPS.filter(g=>on.some(id=>jobGroupOf(id)===g)).slice(0,groupLimit(w));
  return new Set(on.filter(id=>groups.includes(jobGroupOf(id))));
}
export const WORKER_JOBS=[['plant','🌱'],['water','💧'],['fertilize','🪴'],['weed','🌿'],['prune','✂️'],['harvest','🧺'],['processing','⚙️'],['delivery','🛒']].map(([id,icon])=>[id,icon,t(`farmRules.job.${id}`)]);
export const ACTION_LABELS = Object.fromEntries(['construct','dismantle','plant','water','weed','fertilize','harvest','refill','collect','start','turn','prune','deposit','ship','shipOrder','feedFish'].map(id=>[id,t(`farmRules.action.${id}`)]));

export function workerIdleReason(worker,progress,at) {
  if(worker.farmId!=='farm-0')return t('farmRules.idle.bench');
  if(!worker.enabled)return t('farmRules.idle.paused');
  if(worker.restUntil>at)return t(worker.incident?.type==='sick'?'farmRules.idle.sick':'farmRules.idle.resting',{seconds:Math.ceil((worker.restUntil-at)/1000)});
  if(worker.shiftUntil<=at)return worker.kind==='robot'?t('farmRules.idle.packEnded',{price:contractPrice(worker)}):t('farmRules.idle.contractEnded',{plan:contractPlan(worker).name.toLowerCase(),price:contractPrice(worker)});
  const assigned=progress.orders.some(o=>o.status==='open'&&o.workers.includes(worker.id));
  const d=progress.directives||{};
  if(!assigned&&!d.care&&!d.plant&&!d.process)return t('farmRules.idle.noOrders');
  if(!Object.values(worker.jobs||{}).some(Boolean))return t('farmRules.idle.allJobsOff');
  if(worker.waitUntil>at&&worker.waitReason)return worker.waitReason;
  const trees=progress.plots.filter(t=>t.unlocked&&t.stage!=='empty');
  const orders=progress.orders.filter(o=>o.status==='open'&&o.workers.includes(worker.id));
  if(orders.length&&orders.every(o=>progress.stock.roasted[o.cropId]>=o.grams))return t('farmRules.idle.orderReady');
  const missing=orders.find(o=>!trees.some(t=>t.cropId===o.cropId)&&!progress.seeds[o.cropId]);
  if(missing)return t('farmRules.idle.noSeedlings');
  if(trees.some(t=>t.water<35)&&!worker.water&&progress.reservoir<1)return t('farmRules.idle.noWater');
  const batches=Object.values(progress.machines).flatMap(m=>[m.batch,...m.extraBatches].filter(Boolean));
  if(batches.length){const next=Math.min(...batches.map(b=>b.readyAt));if(next<=at){
      const used=progress.lots.reduce((sum,l)=>sum+l.grams,0),free=assetValue(assetById('storage'),progress.upgrades.storage)-used,smallest=Math.min(...batches.filter(b=>b.readyAt<=at).map(b=>b.outputGrams));
      if(smallest>free)return t('farmRules.idle.storageFull',{free:formatMass(Math.max(0,free)),need:formatMass(smallest)});
      if(!activeJobs(worker).has('processing'))return t('farmRules.idle.processingOff');
      if(progress.directives?.process===false)return t('farmRules.idle.directiveOff');
      return t('farmRules.idle.batchQueue');
    }
    return t('farmRules.idle.batchWait',{seconds:Math.ceil((next-at)/1000)});}
  if(worker.kind==='robot'&&orders.some(o=>progress.stock.roasted[o.cropId]<o.grams&&!progress.stock.cherries[o.cropId]&&!progress.stock.dried[o.cropId]))return t('farmRules.idle.robotHarvest');
  if(d.plant&&progress.plots.some(t=>t.unlocked&&t.stage==='empty')&&!progress.seeds[d.plantCrop])return t('farmRules.idle.noDirectiveSeeds');
  if(progress.plots.some(t=>t.unlocked&&t.stage==='empty')&&!Object.values(progress.seeds).some(n=>n>0))return t('farmRules.idle.outOfSeedlings');
  if(trees.length)return trees.some(t=>t.stage==='ready')?t('farmRules.idle.ripeLeft'):t('farmRules.idle.fine');
  return t('farmRules.idle.noTrees');
}
