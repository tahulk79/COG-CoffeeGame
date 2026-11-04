import { DECORATIONS } from './decorations.js';
import { t as tr } from '../../i18n/index.js';
import { loading, showLoading, hideLoading } from '../../ui/loading.js';
import { createDecorationBuilder } from './decoration-builder.js';
import { farmBlockers } from './blockers.js';
import { createMovementInput } from '../../ui/movement.js';
import { loadPlayer, playerModel } from '../../characters/load-player.js';
import { createAdventureScene } from '../../shared/world/scene.js';
import { mountJoystick } from '../../ui/joystick.js';
import { readProgress, saveFarm } from '../../state/progress.js';
import { createWorkActivity } from './activity.js';
import { orderSteps } from './orders.js';
import { createFarmCrew, onPhone } from './crew.js';
import { createCafeGame } from '../cafe/game.js';
import { activeJobs,groupLimit,nextGroupLevel,CARE_JOBS,FARM_SLOTS,ASSETS,assetValue,upgradePrice,formatMass,formatCoins,phaseOf,WORKER_CANDIDATES,workerLevel,workerStat,efficiency,WORKER_JOBS,SEASON_MS,workerWage,DAY_MS,WORK_DAY_MS,assetMaxLevel,upgradeRequirement,assetTier,ASSET_TIERS,contractPlan,contractPrice,contractLeft,FERTILIZER_PRICE,SUPPLIER_PRICE,ROBOT_PACKS,packPrice } from './rules.js';
import { createFarm, LESSON_PERKS } from './model.js';
import { askLesson } from '../../ui/lesson-prompt.js';
import { usesTouch } from '../../ui/dialogue.js';
import { toolCapacity, acceptsTool } from './tools.js';
import { createFarmUI } from './ui.js';
import { pickAutoTask, pickAutoErrand } from './autoplay.js';
import { mountAutoHud } from '../../ui/autoplay-hud.js';
import { createFarmFeedback } from './feedback.js';
import { createVfx } from '../../shared/vfx/index.js';
import { setListener } from '../../shared/audio/index.js';
import { isSettingsOpen, openSettings } from '../../ui/settings.js';
import { buildFarmActor, buildFarmEnvironment } from './environment.js';
import { loadFarmModels, attachFarmModels } from './assets.js';
import { attachModels } from '../../shared/three/models.js';
import { INTERACTIONS, PLOTS, FIELDS, CROPS, PRODUCTS, MACHINES, cropById, productById, plotCare, FARM_BOUNDS, HUD_UNLOCKS } from './content.js';
import { regionType } from '../world-map/content.js';
const $ = id => document.getElementById(id);

// Warm highland sun over cool sky fill, ~3:1 key:fill so beds, trees and roofs get readable shadows (03 §4).
const FARM_LIGHT = { sky: '#d9e7f2', ground: '#7d8a5a', ambient: 1.1, sun: '#ffe2b0', sunIntensity: 4.2 };
export async function createFarmGame(profile, startingGift, persistence = { read: () => readProgress().farm, save: saveFarm }, heavenLessons = [], renderer = null, startingRegion) {
  const models = loadFarmModels(); // tải song song với nhân vật
  const character = await loadPlayer(playerModel(profile.gender));
  const world = createAdventureScene(character, { interactions: INTERACTIONS, theme: 'farm', mapBounds: FARM_BOUNDS, buildActor: buildFarmActor, buildEnvironment: buildFarmEnvironment, lighting: FARM_LIGHT });
  attachFarmModels(world, await models);
  // Cảnh nền không đổ bóng; chỉ mặt đất (farm_land) nhận bóng: đỡ tốn shadow pass trên mobile.
  await attachModels({ replaceAsset: (id, model) => { const ok = world.replaceAsset(id, model); model.traverse(o => { o.castShadow = false; if (o.isMesh && o.name !== 'farm_land') o.receiveShadow = false; }); return ok; } }, { 'farm/surroundings': 'farm/surroundings.glb' });
  const keyboard = createMovementInput(), events = new AbortController();
  const vfx = createVfx({ scene: world.scene }), feedback = createFarmFeedback({ vfx, world, character });
  let seenReady = null, seenTrips = null; // null = lần refresh đầu chỉ ghi nhận, không phát
  let cafeGame=null,decorationBuilder=null;
  let processingFeedback=null;
  let ui, touch = { x: 0, z: 0 }, nearest = null, menu = null, work = null, pendingPlant = null, lastRefresh = -1, storageNotice = false, interactName = 0, canvasRect = null, promptPoint = null;
  let workQueue = [], pendingTool = null, pendingStationAction = null, nearFarm = false, toolsOpen = false;
  let tool = 'auto', selectedSeed = 'robusta', activeEntries = [], toolEntries = [];
  // Onboarding (onboarding-flow 3.1, 3.3, 3.5, 3.6): unlocked HUD parts (null until the load-time pass), open re-ask dialogue, quest arrow window, controls hint.
  let unlocked = null, lessonClose = null, arrowUntil = 0, coach = null, rainAskDay = null;
  const saved = persistence.read();
  const farm = createFarm(saved, startingGift, value => {
    if (!persistence.save(value) && !storageNotice) { storageNotice = true; ui?.notice(tr('farm.game.saveFailed'), false); }
  }, undefined, heavenLessons, startingRegion);
  // Loại nơi trùng sinh (02b-world-map): 'farm' không có quán, 'cafe' mở thẳng vào quán và không về được nông trại.
  const regionKind = regionType(farm.peek().region);
  let freshLessons = farm.peek().lessons.granted.length - (saved?.lessons?.granted?.length || 0);
  const seen = id => farm.peek().tutorial.seen.includes(id);
  const markSeen = id => { if (!seen(id)) farm.act('tutorial', 'seen', id); };
  // Until the ship quest is claimed, quick sales leave the 252 g roasted it needs (playtest: selling during `sell` stalled `ship`).
  const shipCrop = p => p.orders.find(o => o.status === 'open' && o.source !== 'shop')?.cropId || 'robusta';
  const keepForCafe = (p, product, cropId) => regionKind === 'both' && product === 'roasted' && !p.claimed.includes('ship') && cropId === shipCrop(p) ? 252 : 0;
  const playerActivity=createWorkActivity(character);
  const crew=createFarmCrew(farm,world,character,(before,after,task)=>{
    if(!ui)return;const canvas=$('game').querySelector('canvas'),origin=cafeGame?null:world.screenPoint(task.id,canvas.getBoundingClientRect());
    if(['harvest','collect'].includes(task.action)){const grams=PRODUCTS.reduce((sum,product)=>sum+CROPS.reduce((total,crop)=>total+Math.max(0,after.stock[product.id][crop.id]-before.stock[product.id][crop.id]),0),0);ui.flyReward('stock',grams,origin);}
    if(!cafeGame)feedback('crew',{task,before,after});
  },(w,result)=>{
    // Toast action (3rd notice arg, drawn by farm/ui.js): sick with a free slot and no robot → «Thuê robot thay»; phone → «Nhắc».
    const cover=result.type==='sick'&&canHireRobotCover();
    ui?.notice(result.message,false,cover?{label:tr('farm.game.hireRobotCover'),action:'hire-robot-cover'}:result.type==='phone'?{label:tr('farm.game.remind'),action:`remind-worker:${w.id}`}:null);
  });
  // ?debug=incident (robot-staff.md 14): force this shift's incident due now (exemptions still apply) / read its odds. Farm worker id or café crew id.
  if(new URLSearchParams(location.search).get('debug')==='incident'){
    const scope=id=>farm.peek().workers.some(w=>w.id===id)?'farm':'cafe';
    window.__forceIncident=(id,type)=>farm.debugIncident(scope(id),id,type);window.__incidentOdds=id=>farm.incidentOdds(scope(id),id);
  }
  const resetJoystick = mountJoystick($('heaven-joystick'), $('heaven-joystick-knob'), value => {
    if(cafeGame){cafeGame.setTouch(value);return;}
    touch = value; if (value.x || value.z) { world.resetCamera(); world.stopMovement(); cancelWork(); }
  }, events.signal);
  // ---- Auto mode (docs/shared/crew-autoplay.md 5): Auto plays the owner, the hand shows what it taps; any touch hands control back ----
  let auto=false,autoSpent=0,autoWait=0,autoTarget=null,autoHudAt=0;
  const autoHud=mountAutoHud({onToggle:()=>auto?stopAuto():startAuto()});
  function autoStatus(){const a=farm.peek().autoplay;autoHud.status({on:auto,runs:a.runs,leftMs:Math.max(0,a.leftMs-autoSpent)});}
  function startAuto(){const r=farm.act('autoplay','start');ui.notice(r.message,r.ok);if(!r.ok)return;auto=true;autoSpent=0;autoWait=0;autoTarget=null;autoErrand=null;autoIdle=0;autoStatus();}
  function stopAuto(message=null){
    if(!auto)return;auto=false;if(autoSpent)farm.act('autoplay','spend',autoSpent);autoSpent=0;autoTarget=null;autoStatus();
    if(message)ui.notice(message,true);
  }
  // Only steering the character takes control back (map/3D tap, joystick); HUD, shop and menus leave Auto running (crew-autoplay.md 5).
  document.addEventListener('pointerdown',event=>{if(auto&&event.isTrusted&&event.target.closest?.('#game canvas, #heaven-joystick'))stopAuto(tr('crew.auto.manual'));},{capture:true,signal:events.signal});
  const MOVE_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
  // Layers, first match wins (crew-autoplay.md 5): quiz/popup → staff incident → field job → errand → go to the café.
  let autoErrand=null,autoIdle=0;const autoSkip=new Map();
  // A job or errand that just failed (storage full, no room at the café…) rests 15 s, so Auto tries something else.
  const skipped=key=>(autoSkip.get(key)||0)>Date.now();
  const autoClaimed=(id,action)=>{const who=farm.claimed(id,action);return skipped(`${id}:${action}`)||Boolean(who&&who!=='player');};
  const nextFieldJob=()=>pickAutoTask(farm.peek(),{level:farm.level,claimed:autoClaimed,position:character.position,positionOf:id=>world.getInteraction(id)?.position});
  const nextErrand=()=>pickAutoErrand(farm.peek(),{regionKind,level:farm.level,skip:key=>skipped(`errand:${key}`)});
  const cafeOpenable=()=>regionKind!=='farm'&&Boolean(unlocked?.has('cafe-play'));
  function screenOf(pos,rect){if(!pos)return null;const point=character.position.clone().copy(pos);point.y+=1.6;point.project(world.camera);return {x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2};}
  function autoTick(dt){
    if(!auto){if((autoHudAt-=dt)<=0){autoHudAt=1;autoStatus();}return;}
    autoSpent+=dt*1000;if(autoSpent>=5000){farm.act('autoplay','spend',autoSpent);autoSpent=0;}
    if(farm.peek().autoplay.leftMs-autoSpent<=0){stopAuto(tr('crew.auto.done',{n:farm.peek().autoplay.runs}));return;}
    if((autoHudAt-=dt)<=0){autoHudAt=.25;autoStatus();}
    if(autoHud.quiz())return;
    if(enteringCafe){autoHud.show(null,tr('crew.auto.toCafe'));return;} // the café scene is loading: plan nothing on the farm
    if(cafeGame){cafeGame.autoStep(autoHud,dt,{farmWork:()=>Boolean(nextFieldJob()||nextErrand()),goFarm:regionKind==='cafe'?null:exitCafe});return;}
    const rect=canvasRect||=$('game').querySelector('canvas').getBoundingClientRect(),now=Date.now(),p=farm.peek();
    if(isSettingsOpen()||decorationBuilder?.active){autoHud.show(null,tr('crew.auto.waitModal'));return;}
    if(lessonClose){autoHud.show(null,tr('crew.auto.waitModal'));return;}
    // A worker on the phone: tap them («Nhắc») like the player would.
    const phone=p.workers.find(w=>onPhone(w,now));
    if(phone){autoHud.show(screenOf(crew.position(phone.id),rect),tr('crew.auto.remind',{name:phone.name}));if(!autoErrand||autoErrand.remind!==phone.id)autoErrand={remind:phone.id,at:now+1200};if(now>=autoErrand.at){autoErrand=null;noticeResult(farm.act('workers','remind',phone.id));refresh(now);}return;}
    // The player's own window (shop, staff, orders…) stays open: Auto keeps working behind it, the hand hides.
    const behind=ui.modalOpen;
    if(work||pendingTool||pendingPlant||pendingStationAction||workQueue.length){if(autoTarget)autoHud.show(behind?null:world.screenPoint(autoTarget.id,rect),tr(`crew.auto.do.${autoTarget.action}`));return;}
    // An errand in progress: the hand stays on its HUD button for a moment, then Auto does it.
    if(autoErrand?.task){
      const button=autoErrand.task.button==='seed-shop'?$('farm-shop-toggle'):document.querySelector(`[data-shortcut="${autoErrand.task.button}"]`);
      autoHud.show(button&&!behind&&!button.closest('[hidden]')?autoHud.at(button):null,tr(`crew.auto.errand.${autoErrand.task.key}`));
      if(now<autoErrand.at)return;
      const {id,action,choice,key}=autoErrand.task;autoErrand=null;const r=farm.act(id,action,choice);noticeResult(r);if(!r.ok)autoSkip.set(`errand:${key}`,now+15000);refresh(now);autoWait=.6;return;
    }
    if((autoWait-=dt)>0)return;autoWait=.4;
    // The owner never takes a job a worker holds (claims), and workers yield what the owner heads for (playerTargets).
    autoTarget=nextFieldJob();
    if(autoTarget){
      autoIdle=0;const task=autoTarget;
      if(near(task.id)){if(!begin(task.id,task.action,task.choice)){autoSkip.set(`${task.id}:${task.action}`,now+5000);autoTarget=null;}}
      else{pendingTool=task;world.moveToNpc(task.id);world.setFocus(task.id);}
      autoHud.show(behind?null:world.screenPoint(task.id,rect),tr(`crew.auto.do.${task.action}`));return;
    }
    const errand=nextErrand();
    if(errand){autoIdle=0;autoErrand={task:errand,at:now+1400};return;}
    // Nothing left on the farm: go sell coffee (both-region saves, once the café button is open).
    autoIdle+=.4;
    if(cafeOpenable()&&autoIdle>=2&&!behind){autoIdle=0;autoHud.show(autoHud.at(document.querySelector('[data-shortcut="cafe-play"]')),tr('crew.auto.toCafe'));void enterCafe();return;}
    autoHud.show(null,tr(cafeOpenable()?'crew.auto.toCafe':'crew.auto.farmIdle'));
  }
  function clearInput() { cafeGame?.clearInput(); keyboard.clear(); touch = { x: 0, z: 0 }; resetJoystick(); world.stopMovement(); }
  function cancelWork() {
    if (menu?.kind === 'plant') { menu = null; ui?.closeSeedStrip(); }
    farm.release('player');workQueue=[];pendingTool=null;pendingStationAction=null;world.setPlotSelection([]);
    pendingPlant = null; work = null; playerActivity.update(null); world.setFocus(null); }
  function closeMenu() { crew.select(null);toolsOpen = false; menu = null; ui.closeModal(); world.setFocus(null); clearInput(); }
  function closeUserMenu(){tool='auto';cancelWork();closeMenu();refresh(Date.now());}
  function near(id) {
    const target = world.getInteraction(id);
    return target && Math.hypot(character.position.x - target.position[0], character.position.z - target.position[1]) <= target.interactDistance;
  }
  function openMenu(id, kind) {
    clearInput(); cancelWork(); toolsOpen = false; menu = { id, kind }; world.setFocus(id); renderMenu();
    if (kind === 'plant' && !near(id)) world.moveToNpc(id);
  }
  function begin(id, action, choice) {
    if (!near(id)) return false;
    if(!farm.reserve(id,action,'player',choice)){ui.notice(tr('farm.game.reserved'),false);return false;}
    if(!(auto&&ui.modalOpen)){closeMenu(); clearInput();}
    work = { id, action, choice, elapsed: 0, duration: farm.workDuration(action) };
    world.setFocus(id);return true;
  }
  function nextQueuedWork() {
    while(workQueue.length) {
      const task=workQueue.shift(),p=farm.progress,plot=p.plots.find(item=>item.id===task.id);
      if(!plot?.unlocked){world.removePlotSelection(task.id);continue;}
      if(!acceptsTool(plot,task.action,task.choice,farm.level) || toolCapacity(p,task.action,task.choice)<1){world.removePlotSelection(task.id);continue;}
      if(near(task.id)){if(!begin(task.id,task.action,task.choice)){world.removePlotSelection(task.id);continue;}}
      else {pendingTool=task;world.moveToNpc(task.id);world.setFocus(task.id);}
      return;
    }
    tool='auto';
  }
  function applyAction(id,action,choice) {
    const before=farm.progress,levelBefore=farm.level,result=farm.act(id,action,choice);farm.release('player');
    const after=result.ok?farm.progress:before;
    feedback('action',{id,action,result,before,after,levelUp:farm.level>levelBefore});
    if(result.ok&&coach){coach.acted=true;if(coach.moved)endCoach();}
    if(result.ok){
      // Milestones lead the message so they are not lost behind the routine action text.
      if(result.quests?.length)result.message=tr('farm.game.questDone',{quests:result.quests.join('”, “'),message:result.message});
      if(farm.level>levelBefore)result.message=tr('farm.game.levelUp',{level:farm.level,message:result.message});
      const canvas=$('game').querySelector('canvas');
      const origin=ui.modalOpen || cafeGame ? null : world.screenPoint(id,canvas.getBoundingClientRect());
      if(after.coins>before.coins)ui.flyReward('coins',after.coins-before.coins,origin);
      if(['harvest','collect'].includes(action)){
        const gained=PRODUCTS.reduce((total,product)=>total+CROPS.reduce((sum,crop)=>sum+Math.max(0,after.stock[product.id][crop.id]-before.stock[product.id][crop.id]),0),0);
        ui.flyReward('stock',gained,origin);
      }
    }
    return result;
  }
  function noticeResult(result) {
    ui.notice(result.message, result.ok);
  }
  function makeToolEntries(p) {
    const tools=unlocked?.has('tools');
    const entries=CROPS.filter(crop=>p.seeds[crop.id]>0).map(crop=>({id:`plant:${crop.id}`,label:crop.name,detail:tools?tr('farm.tool.seedDrag'):tr('farm.tool.seedTap'),action:'plant',choice:crop.id,cropId:crop.id,quantity:p.seeds[crop.id],shortName:crop.short,color:crop.color,icon:'🌱',enabled:crop.level<=farm.level,noDrag:!tools}));
    if(!entries.length)entries.push({id:'buy-seeds',label:tr('farm.tool.shop'),icon:'🏪',action:'open-shop',enabled:true});
    if(!tools)return entries; // before field 2 a tap on a tree already does the job it needs, so the strip only picks seeds

    entries.push({id:'drag-water',label:tr('farm.tool.water'),detail:tr('farm.tool.waterDetail',{water:p.water,cap:farm.waterCapacity}),action:'water',quantity:p.water,shortName:tr('farm.tool.waterShort'),color:'#65a8c4',icon:'💧',enabled:p.water>0});
    entries.push({id:'drag-fertilizer',label:tr('farm.tool.fertilize'),detail:tr('farm.tool.fertilizeDetail'),action:'fertilize',quantity:p.fertilizer,shortName:tr('farm.tool.fertilize'),color:'#8a9653',icon:'🪴',enabled:p.fertilizer>0});
    for(const [action,label,icon]of [['weed',tr('farm.tool.weed'),'🌿'],['prune',tr('farm.tool.prune'),'✂️'],['harvest',tr('farm.tool.harvest'),'🧺']])entries.push({id:`drag-${action}`,label,detail:tr('farm.tool.dragDetail'),action,shortName:label,icon,enabled:true});
    entries.push({id:'clear-plant',label:tr('farm.tool.clear'),detail:tr('farm.tool.clearDetail'),action:'clear',shortName:tr('farm.tool.clearShort'),icon:'⛏️',enabled:true});
    return entries;
  }
  function openDetail(detail){
    const parent=menu?{...menu,initialFilter:ui.currentFilter()}:null;
    menu={...detail,returnMenu:parent};renderMenu();
  }
  function backFromDetail(){
    crew.select(null);
    menu=menu?.returnMenu||{kind:'workers',id:null,remote:true};renderMenu();
  }
  function choose(entryId,confirmed=false) {
    if (!menu) {
      const entry=toolEntries.find(item=>item.id===entryId);if(!entry || entry.enabled===false)return;
      if(entry.action==='open-shop'){menu={id:'seed-shop',kind:'station',remote:true};renderMenu();return;}
      tool=entry.action;if(entry.cropId)selectedSeed=entry.cropId;refresh(Date.now());return;
    }
    const entry = activeEntries.find(item => item.id === entryId);
    if (!entry || entry.enabled === false) return;
    if(!confirmed&&entry.action==='upgrade'){ui.confirmTrade(tr('farm.trade.upgradeTitle'),tr('farm.trade.upgradeEntry',{label:entry.label,detail:entry.detail,badge:entry.badge}),()=>choose(entryId,true),null,'upgrade');return;} // spend only after confirming
    if(!confirmed&&['sell','order','shop-order','buySeed','fertilizer'].includes(entry.action)){
      const p=farm.progress;
      if(entry.action==='shop-order'){
        const order=p.order,ready=p.stock[order.product][order.cropId]-keepForCafe(p,order.product,order.cropId)>=order.quantity;
        ui.confirmTrade(ready?tr('farm.trade.sellTitle'):tr('farm.trade.acceptTitle'),tr(ready?'farm.trade.sellOrder':'farm.trade.acceptOrder',{mass:formatMass(order.quantity),crop:cropById(order.cropId).short,reward:order.reward}),()=>choose(entryId,true),null,ready?'sell':'accept');return;
      }
      if(entry.action==='sell'){
        const [product,cropId]=entry.choice.split(':'),grams=p.stock[product][cropId],quote=farm.saleQuote(product,cropId,grams);
        if(!quote.ok){ui.notice(quote.message,false);return;}
        ui.confirmTrade(tr('farm.trade.sellTitle'),tr('farm.trade.sellItem',{mass:formatMass(grams),label:entry.label,value:formatCoins(quote.value)})+(quote.discounted?tr('farm.trade.discountShort',{full:formatCoins(quote.full)}):''),()=>choose(entryId,true),null,'sell');return;
      }
      ui.confirmTrade(tr('farm.trade.dealTitle'),tr('farm.trade.dealBody',{label:entry.label,badge:entry.badge}),()=>choose(entryId,true),null,'sell');return;
    }

    if (menu.kind === 'bag') {
      if (entry.action === 'sell') { noticeResult(applyAction('market','sell',entry.choice)); refresh(Date.now()); }
      else if (entry.cropId) { selectedSeed = entry.cropId; tool = 'plant'; closeMenu(); }
      return;
    }
    if(entry.action==='decor-place'){closeMenu();cancelWork();decorationBuilder.start(entry.choice);return;}
    if(entry.action==='edit-assignment'){menu.editAssignment=!menu.editAssignment;renderMenu();return;}
    if(entry.action==='shop-order'){const p=farm.progress,o=p.order;noticeResult(applyAction('market',p.stock[o.product][o.cropId]-keepForCafe(p,o.product,o.cropId)>=o.quantity?'order':'acceptOrder',entry.choice));refresh(Date.now());return;}
    if(entry.action==='pay-staff-now'){
      const now=Date.now(),due=farm.progress.workers.filter(w=>w.farmId==='farm-0'&&w.shiftUntil<=now),cost=due.reduce((sum,w)=>sum+contractPrice(w),0);
      if(farm.progress.coins<cost){ui.notice(tr('farm.game.renewNeed',{cost}),false);return;}
      let paid=0;const reasons=[];
      for(const worker of due){const result=applyAction('workers','shift',worker.id);if(result.ok)paid++;else reasons.push(result.message);}
      ui.notice(tr('farm.game.renewed',{n:paid})+(reasons.length?' · '+reasons.join(' · '):''),paid>0);refresh(Date.now());return;
    }
    if(entry.action==='ship-all'){
      const candidates=farm.progress.orders.filter(order=>order.source!=='shop'&&order.status==='open'&&farm.progress.stock.roasted[order.cropId]>=order.grams).sort((a,b)=>a.deadline-b.deadline);
      let sent=0;const reasons=new Set();
      for(const order of candidates){
        const result=applyAction('orders','shipOrder',order.id);
        if(result.ok)sent++;else reasons.add(result.message);
      }
      ui.notice(tr('farm.game.shippedAll',{sent,total:candidates.length,fee:sent*2})+(reasons.size?' · '+[...reasons].join(' · '):''),sent>0);
      refresh(Date.now());return;
    }
    if(entry.action==='quick-order'){
      const p=farm.progress,order=p.orders.find(o=>o.id===entry.choice);if(!order)return;
      if(order.status==='open'&&p.stock.roasted[order.cropId]>=order.grams){noticeResult(applyAction('orders','shipOrder',order.id));refresh(Date.now());return;}
      openDetail({kind:'order-detail',id:'orders',orderId:order.id,remote:true});return;
    }
    if(entry.action==='advanced-worker'){menu.advanced=!menu.advanced;renderMenu();return;}
    if(entry.action==='worker-profile'){openDetail({kind:'worker-detail',id:null,workerId:entry.choice,remote:true});return;}
    if(entry.action==='dismiss-worker'){const w=farm.peek().workers.find(x=>x.id===entry.choice);ui.confirmTrade(tr('farm.trade.dismissTitle'),tr('farm.trade.dismissBody',{name:w?.name||tr('farm.game.workerFallback')}),()=>{noticeResult(applyAction('workers','dismiss',entry.choice));menu={kind:'workers',id:null,remote:true};renderMenu();},null,'sell');return;}
    if(entry.action==='order-profile'){openDetail({kind:'order-detail',id:'orders',orderId:entry.choice,remote:true});return;}
    if(entry.action==='order-back'){if(menu.returnMenu){backFromDetail();return;}menu={kind:'jobs',id:null,initialFilter:'pending',remote:true};renderMenu();return;}
    if(entry.action==='reject-worker'){
      const result=applyAction('workers','rejectCandidate',entry.choice);noticeResult(result);
      if(result.ok)menu={kind:'workers',id:null,initialFilter:'hire',remote:true};
      refresh(Date.now());return;
    }
    if(entry.action==='worker-back'){if(menu.kind==='worker-detail'&&menu.returnMenu){backFromDetail();return;}menu={kind:'workers',id:null,remote:true};renderMenu();return;}
    if (entry.action === 'open-shop') { menu = {id:'seed-shop',kind:'station',remote:true}; renderMenu(); return; }
    if (['clear','water','fertilize','weed','prune','harvest'].includes(entry.action) && menu.kind==='plant') { tool=entry.action;closeMenu();refresh(Date.now());return; }
    if (entry.action === 'plant') {
      const id = menu.id; selectedSeed = entry.cropId;
      if (near(id)) begin(id, 'plant', entry.choice);
      else {
        closeMenu(); pendingPlant = {id, cropId:entry.choice};
        world.moveToNpc(id); world.setFocus(id);
      }
      return;
    }
    if (!menu.remote && !near(menu.id)) { closeMenu(); return; }
    if (entry.cropId) selectedSeed = entry.cropId;
    const { id } = menu;
    if(entry.action==='collect'&&MACHINES.some(machine=>machine.id===id)){noticeResult(applyAction(id,'collect',entry.choice));refresh(Date.now());return;}
    if (['plant','water','weed','fertilize','collect','turn','refill','harvest','prune'].includes(entry.action)) begin(id, entry.action, entry.choice);
    else {
      const result = applyAction(entry.targetId || id, entry.action, entry.choice); noticeResult(result);
      if (result.ok && ['expand','start'].includes(entry.action)) closeMenu();
      refresh(Date.now());
    }
  }
  function renderMenu() {
    if (!menu || menu.kind==='help') return;
    const used=menu.id==='seed-shop'?'seed-shop':{jobs:'order-board',upgrades:'upgrades',workers:'workers',build:'build'}[menu.kind];if(used)markSeen(`unlock-${used}-used`);
    const now = Date.now(), p = farm.progress;
    let title = '', subtitle = '', icon = '❧', entries = [], footer = '';
    const entry = (id, label, detail, action, choice, enabled = true, badge = tr('farm.menu.choose'), entryIcon = '◇') => ({ id, label, detail, action, choice, enabled, badge, icon: entryIcon });
    const plot = p.plots.find(item => item.id === menu.id);
    const machine = MACHINES.find(item => item.id === menu.id);
    const field = FIELDS.find(item=>item.id===menu.id);
    if(menu.kind==='build'){
      title=tr('farm.menu.build.title');icon='🏡';subtitle=tr('farm.menu.build.subtitle');footer=tr('farm.menu.build.footer');
      entries=DECORATIONS.map(item=>({...entry(item.id,item.name,item.description,'decor-place',item.id,p.coins>=item.price,tr('farm.menu.build.place',{price:item.price}),item.icon),category:'decor'}));
    }else if(menu.kind==='jobs'){
      title=tr('farm.menu.jobs.title');icon='📦';subtitle=tr('farm.menu.jobs.subtitle');
      footer=tr('farm.menu.jobs.footer');
      const remaining=deadline=>{const seconds=Math.max(0,Math.ceil((deadline-now)/1000));return seconds>=60?tr('farm.time.minutes',{n:Math.ceil(seconds/60)}):tr('farm.time.seconds',{n:seconds});};
      for(const order of p.orders.filter(o=>o.source!=='shop'&&!['delivered','expired'].includes(o.status)).sort((a,b)=>a.deadline-b.deadline)){
        const stock=p.stock.roasted[order.cropId],ready=stock>=order.grams,transit=order.status==='transit';
        const trip=p.cafe.shipments.find(item=>item.orderId===order.id);
        const startedAt=trip?.startedAt??((trip?.readyAt??now)-10000/efficiency(p.upgrades.delivery));
        const deliveryProgress=trip?Math.max(0,Math.min(1,(now-startedAt)/Math.max(1,trip.readyAt-startedAt))):0;
        const timeLeft=Math.max(0,Math.min(1,(order.deadline-now)/Math.max(1,order.deadline-(order.createdAt??order.deadline-DAY_MS*8))));
        entries.push({...entry(`board:${order.id}`,tr('farm.order.roastedLabel',{mass:formatMass(order.grams),crop:cropById(order.cropId).short}),transit?tr('farm.order.arrivesIn',{time:remaining(trip?.readyAt??now)}):tr('farm.order.stockNeed',{stock:formatMass(stock),need:formatMass(order.grams)}),'quick-order',order.id,!transit,transit?tr('farm.order.inTransit'):ready?tr('farm.order.shipToCafe'):order.workers.length?tr('farm.order.changeStaff'):p.workers.length?tr('farm.order.assignStaff'):tr('farm.order.viewProgress'),transit?'🚚':'☕'),category:transit?'transit':ready?'ready':'pending',progress:transit?deliveryProgress:undefined,status:transit?tr('farm.order.shippedPct',{pct:Math.floor(deliveryProgress*100)}):ready?tr('farm.order.readyNow'):tr('farm.order.short',{crew:order.workers.map(id=>p.workers.find(w=>w.id===id)?.name).filter(Boolean).join(', ')||tr('farm.order.noStaff'),missing:formatMass(Math.max(0,order.grams-stock))}),ready:!transit&&ready,timerRatio:transit?undefined:timeLeft,timerLabel:transit?undefined:tr('farm.order.expires',{time:remaining(order.deadline),pct:Math.ceil(timeLeft*100)}),urgent:!transit&&timeLeft<=.25});
      }
      const readyCount=entries.filter(item=>item.category==='ready').length;
      if(readyCount)entries.unshift({...entry('ship-all',tr('farm.order.shipAll'),tr('farm.order.shipAllDetail',{n:readyCount}),'ship-all',null,true,tr('farm.order.shipAllBtn'),'🚚'),category:'ready'});
    }else if(menu.kind==='orders'){
      // One list, no tabs: the café only needs to receive beans. Ready orders first (one tap ships), then in transit, in progress, last few received.
      title=tr('farm.menu.orders.title');icon='📜';subtitle=tr('farm.menu.orders.subtitle');
      const rank=o=>o.status==='open'?(p.stock.roasted[o.cropId]>=o.grams?0:2):o.status==='transit'?1:3;
      const shown=[...p.orders].filter(o=>o.status!=='expired'&&o.source!=='shop').sort((a,b)=>rank(a)-rank(b)||b.day-a.day).filter((o,i,list)=>rank(o)<3||list.slice(0,i).filter(x=>rank(x)===3).length<3);
      if(!shown.length)entries.push({...entry('orders-empty',tr('farm.menu.orders.empty'),tr('farm.menu.orders.emptyDetail'),'info',null,false,'','📭'),readOnly:true});
      for(const order of shown){
        const enough=p.stock.roasted[order.cropId]>=order.grams,trip=p.cafe.shipments.find(t=>t.orderId===order.id),left=trip?Math.max(0,Math.ceil((trip.readyAt-now)/1000)):0;
        const crew=order.workers.map(id=>p.workers.find(w=>w.id===id)?.name).filter(Boolean).join(', ');
        const detail=order.status==='delivered'?tr('farm.order.dayReceived',{day:order.day}):order.status==='transit'?tr('farm.order.onTheWay',{n:left}):enough?tr('farm.order.farmEnough',{mass:formatMass(order.grams)}):tr('farm.order.farmHas',{have:formatMass(p.stock.roasted[order.cropId]),need:formatMass(order.grams),crew:crew||tr('farm.order.noStaff')});
        const button=order.status==='delivered'?tr('farm.order.received'):order.status==='transit'?tr('farm.order.delivering'):enough?tr('farm.order.shipToCafe'):tr('farm.order.viewProgress');
        entries.push(entry(order.id,`${cropById(order.cropId).short} · ${formatMass(order.grams)}`,detail,'quick-order',order.id,order.status==='open',button,'🫘'));
      }
    }else if(menu.kind==='order-detail'){
      const order=p.orders.find(o=>o.id===menu.orderId);if(!order){closeMenu();return;}
      title=tr('farm.order.detailTitle',{crop:cropById(order.cropId).short,mass:formatMass(order.grams)});icon='📜';subtitle=tr('farm.order.detailSubtitle',{day:order.day,status:order.status==='open'?tr('farm.order.preparing'):order.status==='transit'?tr('farm.order.shipping'):tr('farm.order.cafeReceived')});
      // Sick workers are skipped (model startTeam), so they add no wage here.
      const team=p.workers.filter(w=>w.farmId==='farm-0'),teamCost=team.filter(w=>w.restUntil<=now).reduce((sum,w)=>sum+(w.shiftUntil>now?0:contractPrice(w)),0);
      entries.push({...entry('start-order-team',tr('farm.order.teamStart'),tr('farm.order.teamStartDetail'),'startCrew',order.id,order.status==='open'&&team.length>0,teamCost?tr('farm.order.assignCost',{cost:teamCost}):tr('farm.order.assignNow'),'▶️'),targetId:'orders'});
      entries.push({...entry('deliver-order',tr('farm.order.ship'),tr('farm.order.shipDetail'),'shipOrder',order.id,order.status==='open'&&p.stock.roasted[order.cropId]>=order.grams&&p.coins>=2,tr('farm.order.shipToCafe'),'🛒'),targetId:'orders'});
      entries.push({...entry('worker-deliver',tr('farm.order.workerDeliver'),tr('farm.order.workerDeliverDetail'),'requestDelivery',order.id,order.status==='open'&&p.stock.roasted[order.cropId]>=order.grams&&order.workers.length>0,tr('farm.order.workerDeliverBtn'),'👩‍🌾'),targetId:'orders'});
      for(const w of p.workers.filter(w=>w.farmId==='farm-0'))entries.push({...entry(`assign:${w.id}`,w.name,tr('farm.worker.levelState',{level:workerLevel(w.xp),state:w.state||tr('farm.worker.idle')}),'assign',{orderId:order.id,workerId:w.id},order.status==='open',order.workers.includes(w.id)?tr('farm.order.unassign'):tr('farm.order.assignCost',{cost:w.shiftUntil>now?0:contractPrice(w)}),'👩‍🌾'),targetId:'orders'});
      if(!p.workers.some(w=>w.farmId==='farm-0'))entries.push(entry('hire-for-order',tr('farm.order.hireStaff'),'','worker-back',null,true,tr('farm.order.openTeam'),'👩‍🌾'));
    }else if (menu.kind === 'workers') {
      title=tr('farm.menu.workers.title');icon='👩‍🌾';subtitle=tr('farm.menu.workers.subtitle',{n:p.workers.length});footer='';
      for(const candidate of WORKER_CANDIDATES){
        const w=p.workers.find(w=>w.id===candidate.id);
        if(w){
          const deployed=w.farmId==='farm-0',unpaid=w.shiftUntil<=now;
          const state=!w.enabled?tr('farm.worker.paused'):unpaid?tr('farm.worker.awaitingPay'):tr('farm.worker.working');
          entries.push({...entry(`profile:${w.id}`,w.name,deployed?(unpaid?tr('farm.worker.contractEnded',{price:contractPrice(w),plan:contractPlan(w).name.toLowerCase()}):w.state||tr('farm.worker.ready')):tr('farm.worker.notDeployed'),'worker-profile',w.id,true,deployed?tr('farm.worker.manage'):tr('farm.worker.deploy'),w.kind==='robot'?'🤖':'👩‍🌾'),category:'local',staffKind:w.kind||'human',level:workerLevel(w.xp),staffState:state,staffDeployed:deployed,staffUnpaid:unpaid,staffWage:contractPrice(w)});
        // One card for the next free robot: robots are identical, each hire picks its own single job.
        }else if(candidate.kind==='robot'&&candidate===WORKER_CANDIDATES.find(c=>c.kind==='robot'&&!p.workers.some(x=>x.id===c.id)))entries.push({...entry(`hire:${candidate.id}`,candidate.name,tr('farm.worker.robotCard'),'worker-profile',candidate.id,true,tr('farm.worker.packFrom',{price:packPrice(candidate.wage,1)}),'🤖'),category:'robot',staffKind:'robot'});
        else if(!p.rejectedCandidates.includes(candidate.id))entries.push({...entry(`hire:${candidate.id}`,candidate.name,tr('farm.worker.candidateCard'),'worker-profile',candidate.id,true,tr('farm.worker.profileFee',{fee:candidate.fee}),'🧑‍🌾'),category:'hire',staffKind:'human'});
      }
      entries.sort((a,b)=>Number(Boolean(b.staffDeployed))-Number(Boolean(a.staffDeployed)));
      const due=p.workers.filter(w=>w.farmId==='farm-0'&&w.shiftUntil<=now),cost=due.reduce((sum,w)=>sum+contractPrice(w),0);
      if(due.length)entries.unshift({...entry('pay-staff-now',tr('farm.worker.dueCount',{n:due.length}),tr('farm.worker.dueDetail',{list:due.map(w=>`${w.name} (${contractPlan(w).name.toLowerCase()})`).join(', '),cost}),'pay-staff-now',null,p.coins>=cost,p.coins>=cost?tr('farm.worker.renewCost',{cost}):tr('farm.short.coins',{n:formatCoins(cost-p.coins)}),'🪙'),category:'local',staffAlert:true});
      // Former "Quản lý" button, now the "Chỉ thị" tab (onboarding-flow 3.3): what deployed workers do on their own.
      const d=p.directives,crop=cropById(d.plantCrop);
      const toggle=(key,label,detail,glyph)=>({...entry(`directive-${key}`,label,detail,'toggle',key,true,'',glyph),targetId:'directives',switchValue:d[key],category:'directives'});
      entries.push(
        toggle('care',tr('farm.directive.care'),tr('farm.directive.careDetail'),'🌱'),
        toggle('plant',tr('farm.directive.plant'),tr('farm.directive.plantDetail',{crop:crop.name,n:p.seeds[crop.id]}),'🪴'),
        {...entry('directive-crop',tr('farm.directive.crop',{crop:crop.short}),tr('farm.directive.cropDetail'),'crop',null,true,tr('farm.directive.change'),'🔁'),targetId:'directives',category:'directives'},
        toggle('fertilize',tr('farm.directive.fertilize'),tr('farm.directive.fertilizeDetail',{n:p.fertilizer}),'🧪'),
        toggle('process',tr('farm.directive.process'),tr('farm.directive.processDetail'),'⚙️'),
        {...entry('directive-note',tr('farm.directive.note'),tr('farm.directive.noteDetail'),null,null,true,'','ℹ️'),category:'directives',readOnly:true},
      );
    } else if(menu.kind==='worker-detail') {
      const candidate=WORKER_CANDIDATES.find(w=>w.id===menu.workerId),w=p.workers.find(w=>w.id===menu.workerId);
      if(!candidate){closeMenu();return;}
      const robot=candidate.kind==='robot';
      title=w?.name||candidate.name;icon=robot?'🤖':'👩‍🌾';footer='';subtitle=w?tr('farm.worker.subtitle',{role:robot?tr('farm.worker.roleRobot'):tr('farm.worker.roleHuman'),state:w.state||tr('farm.worker.idle')}):robot?tr('farm.worker.robotSubtitle'):tr('farm.worker.candidateSubtitle');
      // Robot packs (robot-staff.md 3): prepaid 1/5/10 work days, no hire fee. Hired robot: buy more days from the same list.
      const packs=(action,id)=>Object.keys(ROBOT_PACKS).map(Number).map(n=>{const price=packPrice(candidate.wage,n),lock=action==='hire'&&p.workers.length>=FARM_SLOTS?tr('farm.worker.slotsFull'):p.coins<price?tr('farm.short.coins',{n:formatCoins(price-p.coins)}):null;
        return {...entry(`${action}-pack-${n}`,tr('farm.worker.pack',{n}),tr('farm.worker.packDetail',{min:n*6,rate:Math.round(price/n*10)/10})+(ROBOT_PACKS[n]?tr('farm.worker.packDiscount',{pct:ROBOT_PACKS[n]*100}):''),action,{id,pack:n},!lock,lock||tr('farm.coins',{n:price}),'🤖'),targetId:'workers',category:'training',lockReason:lock};});
      if(!w&&robot)entries.push(...packs('hire',candidate.id));
      if(w&&robot)entries.push(...packs('shift',w.id));
      if(w&&onPhone(w,now))entries.push({...entry('remind-worker',tr('farm.worker.remindTitle'),w.waitReason,'remind',w.id,true,tr('farm.game.remind'),'📱'),targetId:'workers',category:'settings'});
      if(!w&&!robot)entries.push({...entry('hire-worker',tr('farm.worker.hire'),tr('farm.worker.hireDetail',{wage:workerWage({...candidate,xp:0})}),'hire',candidate.id,p.coins>=candidate.fee&&p.workers.length<FARM_SLOTS,tr('farm.worker.hireFee',{fee:candidate.fee}),'🤝'),targetId:'workers'});
      if(!w&&!robot)entries.push(entry('reject-worker',tr('farm.worker.reject'),'', 'reject-worker',candidate.id,true,tr('farm.worker.rejectBtn'),'×'));
      else if(w){
        const lv=workerLevel(w.xp),wage=workerWage(w);
        const working=w.enabled&&w.farmId==='farm-0'&&w.shiftUntil>now&&w.restUntil<=now;
        entries.push({...entry('work-switch',tr('farm.worker.workSwitch'),working?tr('farm.worker.workOn'):w.shiftUntil>now?tr('farm.worker.workResume'):tr('farm.worker.workExpired',{price:contractPrice(w)}),working?'toggle':'startWork',w.id,working||w.farmId==='farm-0'&&w.restUntil<=now,working?tr('farm.on'):tr('farm.off'),'👩‍🌾'),targetId:'workers',category:'settings',switchValue:working});
        const plan=contractPlan(w),price=contractPrice(w);
        entries.push({...entry('auto-pay',tr('farm.worker.autoPay'),tr('farm.worker.autoPayDetail',{price}),'autoPay',w.id,true,w.autoPay?tr('farm.isOn'):tr('farm.isOff'),'🧾'),targetId:'workers'});
        entries.push({...entry('dismiss-worker',tr('farm.trade.dismissTitle'),tr('farm.worker.dismissDetail'),'dismiss-worker',w.id,true,tr('farm.worker.dismissBtn'),'👋'),targetId:'workers',category:'settings'});
        if(!robot)entries.push({...entry('train-worker',lv===10?tr('farm.worker.maxLevel'):tr('farm.worker.trainTo',{level:lv+1}),lv===10?tr('farm.worker.trainDone'):tr('farm.worker.trainDetail'),'train',w.id,lv<10&&p.coins>=40*lv,lv===10?tr('farm.max'):tr('farm.coins',{n:40*lv}),'📚'),targetId:'workers'});
      }
      if(w){
        entries=entries.filter(item=>item.id!=='pay-worker');
        entries=entries.map(item=>({...item,switchValue:item.switchValue??(item.action==='autoPay'?w.autoPay:item.action==='mode'?w.workMode==='auto':undefined),category:item.category||(['train-worker'].includes(item.id)?'training':['toggle-worker'].includes(item.id)?'work':'settings')}));
        // Switches show what the worker really does (activeJobs): a robot picks ONE job, a person as many groups as its level allows.
        const doing=activeJobs(w),limit=groupLimit(w),next=nextGroupLevel(w);
        entries.push({...entry('job-limit',robot?tr('crew.limit.robot'):tr('crew.limit.person',{n:limit}),robot?tr('crew.limit.robotDetail'):next?tr('crew.limit.next',{level:next,n:limit+1}):tr('crew.limit.multi'),null,null,false,'','🧩'),category:'settings',readOnly:true});
        if(robot)for(const [job,icon]of [['water','💧'],['weed','🌿']])entries.push({...entry(`permission:${job}`,tr(`farmRules.job.${job}`),tr('crew.limit.robotPick'),'permission',{id:w.id,job},true,'',icon),targetId:'workers',category:'settings',switchValue:doing.has(job)});
        else entries.push({...entry('permission-care',tr('farm.perm.care'),tr('farm.perm.careDetail'),'permissionGroup',{id:w.id,group:'care'},true,'','🌱'),targetId:'workers',category:'settings',switchValue:CARE_JOBS.some(key=>doing.has(key))});
        if(robot)entries.push({...entry('permission-locked',tr('farm.perm.locked'),tr('farm.perm.lockedDetail'),null,null,false,'🔒','🔒'),category:'settings',readOnly:true,lockReason:tr('farm.perm.lockedReason')});
        for(const [job,label,detail,icon]of [['processing',tr('farm.perm.processing'),tr('farm.perm.processingDetail'),'⚙️'],['delivery',tr('farm.perm.delivery'),tr('farm.perm.deliveryDetail'),'🚚']])entries.push({...entry(`permission:${job}`,label,detail,'permission',{id:w.id,job},true,'',icon),targetId:'workers',category:'settings',switchValue:doing.has(job)});

      }
    } else if (menu.id === 'cafe') {
      title=tr('farm.menu.cafe.title');icon='☕';const d=farm.demand,c=p.cafe;
      subtitle=tr('farm.menu.cafe.subtitle',{cups:d.cups,need:formatMass(d.grams),incoming:formatMass(d.incoming)});
      entries.push(entry('view-cafe-orders',tr('farm.menu.cafe.orders'),tr('farm.menu.cafe.ordersDetail'),'order-back',null,true,tr('farm.menu.cafe.openOrders'),'📜'));
      entries.push({...entry('reserve',tr('farm.menu.cafe.reserve'),tr('farm.menu.cafe.reserveDetail',{need:formatMass(d.needed)}),'reserve',null,true,c.reserve?tr('farm.menu.cafe.reserveOn'):tr('farm.menu.cafe.reserveOff'),'🔒'),targetId:'cafe'});
      for(const crop of CROPS){
        const available=p.stock.roasted[crop.id],stored=c.stock.roasted[crop.id];
        if(stored)entries.push(entry(`cafe-stock:${crop.id}`,`${crop.short} · ${formatMass(stored)}`,tr('farm.menu.cafe.stockDetail'),null,null,false,tr('farm.menu.cafe.inStock'),'🫘'));
      }
      entries.push({...entry('supplier',tr('farm.menu.cafe.supplier'),tr('farm.menu.cafe.supplierDetail'),'supply',null,p.coins>=SUPPLIER_PRICE,tr('farm.coins',{n:SUPPLIER_PRICE}),'📦'),targetId:'cafe'});
      if(cafeGame)entries.push({...entry('open-cafe',c.open?tr('farm.menu.cafe.close'):tr('farm.menu.cafe.open'),tr('farm.menu.cafe.served',{n:c.served,rep:Math.round(c.reputation)}),'toggle',null,true,c.open?tr('farm.menu.cafe.closeBtn'):tr('farm.menu.cafe.openBtn'),'🚪'),targetId:'cafe'});
      for(const trip of c.shipments)entries.push(entry(trip.id,tr('farm.menu.cafe.trip'),`${formatMass(trip.lots.reduce((sum,l)=>sum+l.grams,0))} · ${Math.max(0,Math.ceil((trip.readyAt-now)/1000))}s`,null,null,false,tr('farm.order.delivering'),'🛒'));
    } else if (menu.id === 'pond') {
      title=tr('farm.menu.pond.title');icon='💧';subtitle=tr('farm.menu.pond.subtitle',{n:Math.floor(p.reservoir)});entries=[];
    } else if (menu.kind === 'upgrades') {
      title=tr('farm.menu.upgrades.title');icon='🔧';subtitle=tr('farm.menu.upgrades.subtitle');
      for(const asset of ASSETS){
        const lv=p.upgrades[asset.id],price=upgradePrice(asset.id,lv),max=lv>=assetMaxLevel(asset),reason=max?tr('farm.upgrade.maxLevel'):farm.level<upgradeRequirement(lv+1)?tr('farm.upgrade.needLevel',{level:upgradeRequirement(lv+1)}):p.coins<price?tr('farm.short.coins',{n:Math.ceil(price-p.coins)}):null;
        entries.push({...entry(`upgrade:${asset.id}`,asset.name,`${ASSET_TIERS[assetTier(lv)-1].name} · ${asset.benefit} · ${assetValue(asset,lv)}${max?'':` → ${assetValue(asset,lv+1)}`} ${asset.unit}`,'upgrade',null,!reason,max?tr('farm.max'):tr('farm.coins',{n:price}),asset.icon),targetId:asset.id,category:asset.category,level:lv,lockReason:reason,priced:!max});
      }
      entries.push({...entry('repair-fence',tr('farm.upgrade.fence'),tr('farm.upgrade.fenceDetail',{pct:Math.round(p.durability)}),'repair',null,p.coins>=5,tr('farm.coins',{n:5}),'🪵'),targetId:'fence',category:'farm',priced:true});
    } else if (menu.kind === 'bag') {
      title = tr('farm.menu.bag.title'); subtitle = tr('farm.menu.bag.subtitle'); icon = '▣';
      entries = CROPS.filter(crop=>p.seeds[crop.id]>0).map(crop => ({...entry(`seed:${crop.id}`,crop.name,crop.description,null,null,true,tr('farm.menu.bag.viewSeed'),'🌱'),cropId:crop.id,category:'seeds',quantity:p.seeds[crop.id]}));
      for (const product of PRODUCTS) for (const crop of CROPS) {
        const quantity=p.stock[product.id][crop.id],price=Math.round(product.price*crop.priceScale*100*100)/100;
        if(quantity) entries.push({...entry(`${product.id}:${crop.id}`,`${product.name} · ${crop.short}`,tr('farm.menu.bag.have',{mass:formatMass(quantity),price}),'sell',`${product.id}:${crop.id}`,true,tr('farm.menu.bag.sell',{mass:formatMass(quantity)}),product.icon),category:'products',quantity:formatMass(quantity),bagSale:{owned:quantity,keep:keepForCafe(p,product.id,crop.id)}});
      }
      if(p.fertilizer) entries.push({...entry('bag-fertilizer',tr('farm.menu.bag.fertilizer'),tr('farm.menu.bag.fertilizerDetail'),null,null,false,tr('farm.menu.bag.useAtTree'),'🪴'),category:'supplies',quantity:p.fertilizer});
    } else if (field && menu.kind==='expand') {
      title=tr('farm.expand.title',{field:field.name.toLowerCase()});icon='🔓';subtitle=tr('farm.expand.subtitle',{price:field.price});
      entries=[entry('confirm-expand',tr('farm.expand.confirm'),tr('farm.expand.balance',{n:formatCoins(Math.max(0,p.coins-field.price))}),'expand',null,p.coins>=field.price && farm.canExpand(field.id),tr('farm.coins',{n:field.price}),'🔓')];
    } else if (plot && menu.kind === 'plant') {
      title = tr('farm.plot.chooseTitle'); subtitle = tr('farm.plot.chooseSubtitle',{plot:PLOTS.find(item => item.id === plot.id).name});
      entries = makeToolEntries(p);
    } else if (plot) {
      title = `${PLOTS.find(item => item.id === plot.id).name} · ${cropById(plot.cropId).short}`; icon = '❧';
      subtitle = tr('farm.plot.subtitle',{water:Math.round(plot.water),state:plot.stage === 'ready' ? tr('farm.plot.ripe') : tr('farm.plot.growing')});
      entries = [
        entry('harvest',tr('farm.tool.harvest'),tr('farm.plot.harvestDetail',{mass:formatMass(plot.readyYield||0)}), 'harvest', null, plot.stage === 'ready', tr('farm.plot.harvestBtn'), '🧺'),
        entry('water',tr('farm.tool.water'),tr('farm.plot.waterDetail',{water:p.water,cap:farm.waterCapacity}), 'water', null, plotCare(plot).needsWater && p.water > 0, tr('farm.plot.waterBtn'), '◒'),
        entry('weed',tr('farm.tool.weed'),tr('farm.plot.weedDetail'), 'weed', null, plotCare(plot).needsWeeding, tr('farm.plot.weedBtn'), '⌁'),
        entry('feed',tr('farm.tool.fertilize'),tr('farm.plot.feedDetail'), 'fertilize', null, p.fertilizer > 0 && plotCare(plot).canFeed, tr('farm.plot.feedBtn'), '✚'),
      ];
    } else if (menu.id === 'seed-shop') {
      title = tr('farm.tool.shop'); subtitle = tr('farm.shop.subtitle'); icon = '❧';
      entries = CROPS.map(crop => entry(`buy:${crop.id}`, crop.name, crop.description, 'buySeed', crop.id, crop.level <= farm.level && p.coins >= crop.seedPrice, crop.level > farm.level ? tr('farm.shop.level',{level:crop.level}) : tr('farm.coins',{n:crop.seedPrice}), '❧'));
      entries.push(entry('fertilizer',tr('farm.shop.fertilizer'),tr('farm.shop.fertilizerDetail'), 'fertilizer', null, p.coins >= FERTILIZER_PRICE, tr('farm.coins',{n:FERTILIZER_PRICE}), '✚'));
      const shop=p.order,shopKeep=keepForCafe(p,shop.product,shop.cropId),ready=p.stock[shop.product][shop.cropId]-shopKeep>=shop.quantity;
      entries.push({...entry('shop-order',tr('farm.shop.fixedOrder',{mass:formatMass(shop.quantity),crop:cropById(shop.cropId).short}),tr('farm.shop.fixedDetail',{reward:shop.reward,stock:formatMass(p.stock[shop.product][shop.cropId])})+(shopKeep?tr('farm.shop.keep',{mass:formatMass(shopKeep)}):''),'shop-order',shop.id,true,ready?tr('farm.shop.sellReward',{reward:shop.reward}):shop.accepted?tr('farm.shop.awaiting'):tr('farm.trade.acceptTitle'),'🪙'),category:'trade',saleFixed:true});
      for(const product of PRODUCTS)for(const crop of CROPS){const quantity=p.stock[product.id][crop.id];if(quantity)entries.push({...entry(`shop-sell:${product.id}:${crop.id}`,`${product.name} · ${crop.short}`,tr('farm.shop.have',{mass:formatMass(quantity)}),'sell',`${product.id}:${crop.id}`,true,tr('farm.shop.chooseAmount'),product.icon),targetId:'market',category:'trade',sale:{owned:quantity,keep:keepForCafe(p,product.id,crop.id)}});}
    } else if (menu.id === 'well') {
      title = tr('farm.well.title'); icon = '◒'; subtitle = tr('farm.well.subtitle',{water:p.water,cap:farm.waterCapacity,reserve:Math.floor(p.reservoir)});
      entries = [entry('refill',tr('farm.well.refill'),tr('farm.well.refillDetail'), 'refill', null, p.water < farm.waterCapacity, tr('farm.well.free'), '◒')];
    } else if (machine) {
      title=machine.name;icon=machine.icon;subtitle=tr('farm.station.subtitle');
      const jobs=[p.machines[machine.id].batch,...p.machines[machine.id].extraBatches].filter(Boolean),perBatch=Math.max(1,Math.floor(assetValue(ASSETS.find(a=>a.id===machine.id),p.upgrades[machine.id])/machine.inputCount));
      for(const crop of CROPS){
        const available=Math.floor(p.stock[machine.input][crop.id]/machine.inputCount);
        entries.push({...entry(`process:${crop.id}`,tr('farm.station.coffee',{crop:crop.short}),tr('farm.station.stock',{mass:formatMass(p.stock[machine.input][crop.id]),product:productById(machine.input).name.toLowerCase()}),'start',{cropId:crop.id,quantity:1},available>0,tr('farm.station.start'),machine.icon),category:'prepare',processing:{maximum:Math.min(available,perBatch*(48-jobs.length)),input:machine.inputCount,output:machine.outputCount,perBatch,inputName:productById(machine.input).name,outputName:productById(machine.output).name}});
      }
      const ready=jobs.filter(j=>j.readyAt<=now);
      if(!jobs.length)entries.push({...entry('empty-queue',tr('farm.station.empty'),tr('farm.station.emptyDetail'),null,null,true,'','📦'),category:'queue',readOnly:true,emptyState:true});
      if(machine.id==='dryer'&&jobs.some(job=>!job.turned&&now>=(job.startedAt+job.readyAt)/2&&now<job.readyAt))entries.push({...entry('turn-drying',tr('farm.station.turn'),tr('farm.station.turnDetail'),'turn',null,true,tr('farm.station.turnBtn'),'☀️'),category:'queue'});

      const stage=job=>job.startedAt>now?0:job.readyAt>now?1:2;
      for(const job of [...jobs].sort((a,b)=>stage(a)-stage(b)||a.startedAt-b.startedAt)){
        const waiting=job.startedAt>now,done=job.readyAt<=now;
        entries.push({...entry(`batch:${job.id}`,`${cropById(job.cropId).short} · ${formatMass(job.inputGrams)} → ${formatMass(job.outputGrams)}`,done?tr('farm.batch.done'):waiting?tr('farm.batch.startsIn',{n:Math.ceil((job.startedAt-now)/1000)}):tr('farm.batch.running',{pct:Math.floor(Math.max(0,Math.min(1,(now-job.startedAt)/(job.readyAt-job.startedAt)))*100),n:Math.ceil((job.readyAt-now)/1000)}),waiting?'cancel':done?'collect':null,job.id,waiting||done,waiting?tr('farm.batch.cancel'):done?tr('farm.batch.collect'):tr('farm.batch.working'),machine.icon),category:'queue',readOnly:!waiting&&!done,collectOne:done,batchProgress:done?1:waiting?0:Math.max(0,Math.min(1,(now-job.startedAt)/(job.readyAt-job.startedAt))),progress:done?1:waiting?0:Math.max(0,Math.min(1,(now-job.startedAt)/(job.readyAt-job.startedAt))),batchState:done?tr('farm.batch.stateDone'):waiting?tr('farm.batch.stateWaiting'):tr('farm.batch.stateRunning')});
      }
      if(ready.length)entries.unshift({...entry('collect-ready',tr('farm.batch.collectN',{n:ready.length}),tr('farm.batch.collectDetail',{mass:formatMass(ready.reduce((sum,j)=>sum+j.outputGrams,0))}),'collect',null,true,tr('farm.batch.collectAll'),'📦'),category:'queue'});
    } else if (menu.id === 'market') {
      title = tr('farm.market.title'); icon = '₫'; const order = p.order;
      subtitle = tr('farm.market.subtitle');
      entries.push(entry('order', tr('farm.market.order',{mass:formatMass(order.quantity),product:productById(order.product).name.toLowerCase(),crop:cropById(order.cropId).short}), tr('farm.market.orderDetail',{have:p.stock[order.product][order.cropId],need:order.quantity}), 'order', null, p.stock[order.product][order.cropId] >= order.quantity, tr('farm.market.reward',{n:order.reward}), '▤'));
      for (const product of [...PRODUCTS].reverse()) for (const crop of CROPS) {
        const quantity = p.stock[product.id][crop.id];
        if (quantity) entries.push({ ...entry(`sell:${product.id}:${crop.id}`, `${product.name} · ${crop.short}`, tr('farm.market.have',{mass:formatMass(quantity)}), 'sell', `${product.id}:${crop.id}`, true, tr('farm.shop.chooseAmount'), product.icon), sale: { owned: quantity } });
      }
    }
    if(menu.kind==='order-detail'){
      const order=p.orders.find(o=>o.id===menu.orderId),ready=p.stock.roasted[order.cropId]>=order.grams;
      entries=entries.filter(item=>item.id==='order-back'||order.status==='open'&&item.enabled&&(
        ready?item.id==='deliver-order':item.action==='assign'));

    }
    if (plot && menu.kind === 'care') entries = entries.filter(item => item.enabled);
    activeEntries = entries;
    if (menu.kind === 'plant') { ui.seedStrip({title:tr('farm.strip.seeds'), entries, selected:tool==='water' ? 'drag-water' : tool==='fertilize' ? 'drag-fertilizer' : tool==='clear' ? 'clear-plant' : ['weed','prune','harvest'].includes(tool)?`drag-${tool}`:`plant:${selectedSeed}`}); return; }
    ui.closeSeedStrip();
    const filters = machine?[['prepare',tr('farm.tab.prepare')],['queue',tr('farm.tab.queue')]]:menu.kind==='jobs'?([['pending',tr('farm.tab.pending')],['ready',tr('farm.tab.ready')],['transit',tr('farm.order.inTransit')]]):menu.kind==='worker-detail'&&p.workers.some(w=>w.id===menu.workerId)?[['training',p.workers.find(w=>w.id===menu.workerId).kind==='robot'?tr('farm.tab.packs'):tr('farm.tab.training')],['settings',tr('farm.blocker.setup')]]:menu.kind==='workers' ? [['local',tr('farm.tab.local',{n:p.workers.length})],['hire',tr('farm.tab.people',{n:WORKER_CANDIDATES.filter(c=>c.kind!=='robot'&&!p.workers.some(w=>w.id===c.id)&&!p.rejectedCandidates.includes(c.id)).length})],['robot',tr('farm.tab.robots',{n:WORKER_CANDIDATES.filter(c=>c.kind==='robot'&&!p.workers.some(w=>w.id===c.id)).length})],['directives',tr('farm.tab.directives')]] : menu.kind === 'upgrades' ? [['all',tr('farm.tab.all')],['farm',tr('farm.tab.farm')],['water',tr('farm.tab.water')],['processing',tr('farm.tab.processing')],['logistics',tr('farm.tab.logistics')],['cafe',tr('farm.tab.cafe')]] : menu.id === 'seed-shop' ? [['seeds',tr('farm.tab.seedlings')],['supplies',tr('farm.tab.supplies')],['trade',tr('farm.tab.market')]] : [];
    if (menu.id === 'seed-shop') entries = entries.map(item => ({...item, category:item.category|| (item.id === 'fertilizer' ? 'supplies' : 'seeds')}));
    if(menu.id==='seed-shop')entries=entries.map(item=>['buySeed','fertilizer'].includes(item.action)?{...item,purchase:{owned:item.action==='buySeed'?p.seeds[item.choice]:p.fertilizer,unitPrice:item.action==='buySeed'?cropById(item.choice).seedPrice:FERTILIZER_PRICE,coins:p.coins,locked:item.action==='buySeed'&&cropById(item.choice).level>farm.level}}:item);
    activeEntries = entries;
    const stationAsset=ASSETS.find(asset=>asset.id===(machine?.id||(menu.kind==='bag'?'storage':['well','pond','cafe'].includes(menu.id)?menu.id:null)));
    let station=null;
    if(stationAsset){const lv=p.upgrades[stationAsset.id],price=upgradePrice(stationAsset.id,lv),maxLv=assetMaxLevel(stationAsset);station={max:maxLv,tier:ASSET_TIERS[assetTier(lv)-1].name,feedback:processingFeedback?.id===stationAsset.id&&processingFeedback.until>now?processingFeedback.text:null,id:stationAsset.id,level:lv,current:assetValue(stationAsset,lv),next:lv<maxLv?assetValue(stationAsset,lv+1):null,unit:stationAsset.unit,benefit:stationAsset.benefit,price,lock:lv>=maxLv?tr('farm.upgrade.reachedMax'):farm.level<upgradeRequirement(lv+1)?tr('farm.upgrade.needLevel',{level:upgradeRequirement(lv+1)}):p.coins<price?tr('farm.short.coins',{n:Math.ceil(price-p.coins)}):null};}
    ui.modal({ title, subtitle, icon, entries, footer, filters, station, roster:menu.kind==='workers', back:['worker-detail','order-detail'].includes(menu.kind), kind: ['worker-detail','order-detail','daily-detail'].includes(menu.kind)?'worker':menu.kind === 'plant' ? 'plant' : ['jobs','orders','daily'].includes(menu.kind)?'jobs':plot ? 'context' : menu.kind === 'expand' ? 'confirm' : menu.kind === 'bag' ? 'bag' : ['upgrades','workers'].includes(menu.kind) ? 'upgrades' : menu.id === 'seed-shop' ? 'store' : 'shop' });
    if(menu.initialFilter){ui.selectFilter(menu.initialFilter);delete menu.initialFilter;}
    if(menu.kind==='worker-detail')ui.workerProfile(p.workers.find(w=>w.id===menu.workerId)||WORKER_CANDIDATES.find(w=>w.id===menu.workerId),{orders:p.orders,dailyTasks:[]});
    if(menu.kind==='order-detail'){
      const order=p.orders.find(o=>o.id===menu.orderId),trip=p.cafe.shipments.find(t=>t.orderId===order.id);
      const start=trip?.startedAt??((trip?.readyAt??now)-10000/efficiency(p.upgrades.delivery));
      const progress=trip?Math.max(0,Math.min(1,(now-start)/Math.max(1,trip.readyAt-start))):order.status==='delivered'?1:null;
      ui.orderProgress(orderSteps(order,p),{status:order.status,progress,seconds:trip?Math.max(0,Math.ceil((trip.readyAt-now)/1000)):0,crew:order.workers.map(id=>p.workers.find(w=>w.id===id)?.name).filter(Boolean).join(', '),ready:p.stock.roasted[order.cropId]>=order.grams});
    }
  }
  function buyField(id) {
    const field=FIELDS.find(item=>item.id===id),p=farm.progress;
    if(!field || p.fields.includes(id))return;
    if(!farm.canExpand(id)){ui.notice(tr('farm.expand.needAdjacent'),false);return;}
    if(p.coins<field.price){ui.notice(tr('farm.expand.needCoins',{price:field.price,short:formatCoins(field.price-p.coins)}),false);return;}
    openMenu(id,'expand');
  }
  function interact() {
    if (!nearest || work || ui.modalOpen) return;
    const id = nearest.id, p = farm.progress;
    if (nearest.kind === 'field') { buyField(id); return; }
    const plot = p.plots.find(item => item.id === id);
    if (plot) {
      if (!plot.unlocked) { ui.notice(tr('farm.expand.tapLock')); return; }
      if (plot.stage === 'empty') { openMenu(id, 'plant'); return; }
      const care = plotCare(plot);
      if (care.ready) begin(id, 'harvest');
      else if (care.needsWater) {
        if (p.water > 0) begin(id, 'water');
        else ui.notice(tr('farm.notice.canEmpty'), false);
      }
      else if (care.needsWeeding) begin(id, 'weed');
      else if (care.canFeed && p.fertilizer > 0) begin(id, 'fertilize');
      else if(plot.mature && !plot.pruned && plot.growthMs<SEASON_MS*.17)begin(id,'prune');
      else ui.notice(tr('farm.notice.waterLater',{phase:phaseOf(plot),n:Math.max(1,Math.ceil(care.waterInSeconds/60))}));
      return;
    }
    const machine = MACHINES.find(item => item.id === id);
    if(machine){openMenu(id,'machine');return;}
    if (id === 'well') {
      if (p.water < farm.waterCapacity) begin(id, 'refill');
      else {ui.notice(tr('farm.notice.canFull'));offerLesson(['water']);}
      return;
    }
    openMenu(id, 'station');
  }
  const avatar=document.querySelector('.farm-avatar');if(avatar)avatar.firstChild.replaceWith(profile.gender==='male'?'👨‍🌾':'👩‍🌾'); // firstChild may already be the icon svg
  ui = createFarmUI({
    upgradeStation(id){const asset=ASSETS.find(a=>a.id===id),lv=farm.peek().upgrades[id];ui.confirmTrade(tr('farm.trade.upgradeTitle'),tr('farm.trade.upgradeStation',{name:asset?.name||id,level:lv+1,price:formatCoins(upgradePrice(id,lv))}),()=>{noticeResult(applyAction(id,'upgrade',null));refresh(Date.now());},null,'upgrade');},
    process(entryId,quantity){const item=activeEntries.find(entry=>entry.id===entryId);if(!item?.processing||!menu||!Number.isInteger(quantity)||quantity<1||quantity>99)return;if(!menu.remote&&!near(menu.id))return;const id=menu.id,result=applyAction(id,'start',{...item.choice,quantity});noticeResult(result);processingFeedback={id,text:result.ok?tr('farm.station.started'):result.message,until:Date.now()+6000};refresh(Date.now());},
    back:backFromDetail,
    saleQuote(entryId,grams){const item=activeEntries.find(entry=>entry.id===entryId);if(!item?.sale&&!item?.bagSale)return {ok:false,message:tr('farm.trade.itemChanged')};const [product,cropId]=item.choice.split(':');return farm.saleQuote(product,cropId,grams);},
    sell(entryId,grams){const item=activeEntries.find(entry=>entry.id===entryId);if(!item?.sale&&!item?.bagSale)return;const [product,cropId]=item.choice.split(':'),quote=farm.saleQuote(product,cropId,grams);if(!quote.ok){ui.notice(quote.message,false);return;}ui.confirmTrade(tr('farm.trade.sellTitle'),tr('farm.trade.sellItem',{mass:formatMass(grams),label:item.label,value:formatCoins(quote.value)})+(quote.discounted?tr('farm.trade.discountLong',{full:formatCoins(quote.full)}):''),()=>{noticeResult(applyAction('market','sell',{item:item.choice,grams}));refresh(Date.now());},item.icon,'sell');},
    purchase(entryId,quantity){
      const item=activeEntries.find(entry=>entry.id===entryId);
      if(!item||!item.purchase)return;
      ui.confirmTrade(tr('farm.trade.buyTitle'),tr('farm.trade.buyBody',{n:quantity,label:item.label,total:formatCoins(item.purchase.unitPrice*quantity)}),()=>{noticeResult(applyAction('seed-shop',item.action,{cropId:item.choice,quantity}));refresh(Date.now());},item.icon,'buy');
    },
    staffMove(choice){const result=applyAction('workers','moveStaff',choice);noticeResult(result);refresh(Date.now());return result;},
    // Incident buttons (robot-staff.md 4). Also reachable as shortcut('remind-worker:<id>') / shortcut('hire-robot-cover').
    remindWorker,hireRobotCover,
    // Show «Nhắc» only while this returns true; show «Thuê robot thay» only while canHireRobotCover() is true.
    isOnPhone:id=>{const w=farm.peek().workers.find(x=>x.id===id);return Boolean(w&&onPhone(w,Date.now()));},canHireRobotCover,
    tools() { if(toolsOpen){closeUserMenu();return;}toolsOpen=true;tool='auto';refresh(Date.now()); },
    tool(id) { cancelWork(); tool = id; refresh(Date.now()); },
    bag() { if(lessonClose)return; clearInput(); cancelWork(); menu = { kind: 'bag', id: null }; renderMenu(); },
    shortcut(id) {
      if(lessonClose)return;
      if(id.startsWith('lesson:')){ui.closeModal(true);closeUserMenu();const shown=offerLesson([id.slice(7)],true);if(!shown)ui.notice(shown===false?tr('farm.lesson.busy'):tr('farm.lesson.doneToday'),false);return;}
      decorationBuilder?.stopTask();decorationBuilder?.clear();
      if(id==='build'){if(cafeGame){ui.notice(tr('farm.notice.decorFarmOnly'),false);return;}clearInput();cancelWork();menu={kind:'build',id:null,remote:true};renderMenu();return;}
      if(id.startsWith('dismiss-worker:')){noticeResult(applyAction('workers','dismiss',id.slice(15)));refresh(Date.now());return;}
      if(id.startsWith('pay-worker:')){noticeResult(applyAction('workers','shift',id.slice(11)));refresh(Date.now());return;}
      if(id.startsWith('remind-worker:')){remindWorker(id.slice(14));return;}
      if(id==='hire-robot-cover'){hireRobotCover();return;}
      if(id.startsWith('reject-candidate:')){noticeResult(applyAction('workers','rejectCandidate',id.slice(17)));refresh(Date.now());return;}
      if(id==='farm-tools'){clearInput();cancelWork();menu=null;ui.closeModal();toolsOpen=true;tool='auto';refresh(Date.now());return;}
      if(id.startsWith('order-go:')){clearInput();cancelWork();menu={kind:'order-detail',id:'orders',orderId:id.slice(9),remote:true};renderMenu();return;}
      if(id.startsWith('station-go:')){closeUserMenu();const target=id.slice(11);world.moveToNpc(target);world.setFocus(target);return;}
      if(id.startsWith('station-collect:')){closeUserMenu();const target=id.slice(16);if(near(target)){noticeResult(applyAction(target,'collect',null));refresh(Date.now());return;}pendingStationAction={id:target,action:'collect'};world.moveToNpc(target);world.setFocus(target);return;}
      if(id==='bag'){clearInput();cancelWork();menu={kind:'bag',id:null};renderMenu();return;}
      if(id==='well-go'){closeUserMenu();world.moveToNpc('well');world.setFocus('well');return;}
      if(id==='cafe-play'){enterCafe();return;}
      if(id==='workers'){clearInput();cancelWork();menu={id:null,kind:'workers',remote:true};renderMenu();return;}
      if(id==='pond'){clearInput();cancelWork();menu={id:'pond',kind:'station',remote:true};renderMenu();return;}
      if(id==='order-board'){openOrderBoard();return;}
      if(id==='delivery'){clearInput();cancelWork();menu={id:'orders',kind:'orders',remote:true};renderMenu();return;}
      // Đóng hẳn modal farm (im tiếng vì nút đã kêu ui.open) rồi mới mở hộp chung: không lồng hai modal.
      if(id==='game-settings'){ui.closeModal(true);closeUserMenu();openSettings();return;}
      if(id==='settings'){clearInput();cancelWork();menu={kind:'help',id:null};ui.closeSeedStrip();ui.showSettings();return;}
      if(id==='help'){clearInput();cancelWork();menu={kind:'help',id:null};ui.closeSeedStrip();ui.showGuide(notebook());return;}
      if (id === 'center') { world.resetCamera(); return; }
      if (id === 'zoom-in' || id === 'zoom-out') { world.zoomView(id === 'zoom-in' ? .15 : -.15); return; }
      clearInput(); cancelWork(); menu = {id: id === 'upgrades' ? null : id, kind: id === 'upgrades' ? id : 'station', remote:true}; renderMenu();
    },
    dragStart() {
      clearInput();workQueue=[];pendingTool=null;pendingPlant=null;work=null;world.setPlotSelection([]);world.setFocus(null);world.freezeCamera();
    },
    dragSelection(ids) {world.setPlotSelection(ids);},
    dragCancel() {world.setPlotSelection([]);world.setFocus(null);},
    dragLimit(action,cropId) {return toolCapacity(farm.progress,action,cropId);},
    previewDrop(x,y,action,cropId) {
      const canvas=$('game').querySelector('canvas');
      const id=world.pickPlotAtScreen(x,y,canvas.getBoundingClientRect()),p=farm.progress;
      const valid=acceptsTool(p.plots.find(item=>item.id===id),action,cropId,farm.level);
      return valid ? id : null;
    },
    dropTool(action,cropId,ids) {
      markSeen('tools');clearInput();cancelWork();menu=null;ui.closeModal();
      const p=farm.progress,limit=toolCapacity(p,action,cropId);
      workQueue=[...new Set(ids)].filter(id=>acceptsTool(p.plots.find(item=>item.id===id),action,cropId,farm.level)).slice(0,limit).map(id=>({id,action,choice:cropId}));
      if(!workQueue.length){ui.notice(tr('farm.notice.noTargets'),false);return;}
      world.setPlotSelection(workQueue.map(task=>task.id));nextQueuedWork();
    },
    choose, close: closeUserMenu,
  });
  function refresh(now) {
    const p = farm.progress;
    const availableFields = FIELDS.filter(field => !p.fields.includes(field.id)).map(field => ({ id: field.id, position: [...field.position] }));
    const bounds = FARM_BOUNDS;
    world.setFarmLayout(p.fields, availableFields, bounds);world.setFarmUpgrades(p.upgrades);
    // HUD parts open as the player reaches them; whatever is already open at load is marked seen without a toast.
    const opened=new Set(HUD_UNLOCKS.filter(u=>u.when(p,farm.level)).map(u=>u.id)),fresh=[...opened].filter(id=>!seen(`unlock-${id}`));
    // `unlock-<id>` = toast shown; `unlock-<id>-used` = feature used by any path, which clears its "Mới" dot.
    for(const id of fresh){farm.act('tutorial','seen',`unlock-${id}`);if(!unlocked)markSeen(`unlock-${id}-used`);}
    ui.unlocks(opened,unlocked?HUD_UNLOCKS.filter(u=>fresh.includes(u.id)):[],new Set([...opened].filter(id=>!seen(`unlock-${id}-used`))));unlocked=opened;
    if(p.claimed.includes('roast'))markSeen('quest-guide');
    ui.blockers(farmBlockers(p,farm.level,farm.storageCapacity,now,opened.has('tools')));ui.journal(p.journal||[],p.workers,0);
    ui.operationHud({today:p.today,weather:farm.weather,workers:p.workers,demand:farm.demand,storage:p.lots.reduce((n,l)=>n+l.grams,0),capacity:farm.storageCapacity});
    ui.hud({ ...p, playerName: profile.name, level: farm.level, water: p.water, capacity: farm.waterCapacity, tool, quest: goal(), seedName: cropById(selectedSeed).short });
    for (const plot of p.plots) {
      if (!plot.unlocked) {
        world.setActorState(plot.id, plot);
        world.setObjectStatus(plot.id, { text: '' });
        continue;
      }
      const crop = cropById(plot.cropId), total = plot.mature ? crop.regrowMs : crop.growMs;
      const ratio = plot.stage === 'ready' ? 1 : Math.min(1, plot.growthMs / total);
      world.setActorState(plot.id, { ...plot, growthRatio: ratio });
      const care = plotCare(plot);
      const text = care.empty ? '+' : care.ready ? '🧺' : care.needsWater ? '💧' : care.needsWeeding ? '🌿' : care.canFeed && p.fertilizer > 0 ? '🪴' : '🌱';
      world.setObjectStatus(plot.id, { text, ready: care.ready, progress: care.empty ? null : ratio, plant: care.empty ? null : { paused:care.paused, rate:care.paused || care.ready ? 0 : (.65+.35*plot.health/100)*1000/total, remaining:care.remainingSeconds } });
    }
    for (const field of availableFields) world.setObjectStatus(field.id, { text: `🔒 🪙 ${FIELDS.find(item => item.id === field.id).price}` });
    const readyNow=new Set(),tripsNow=new Set(p.cafe.shipments.map(trip=>trip.id));
    if(seenTrips&&[...seenTrips].some(trip=>!tripsNow.has(trip)))feedback('arrive');
    seenTrips=tripsNow;
    for (const machine of MACHINES) {
      const batch = p.machines[machine.id].batch;
      const jobs=[...(batch ? [batch] : []),...p.machines[machine.id].extraBatches];
      const finished=jobs.filter(job=>job.readyAt<=now),running=jobs.find(job=>job.startedAt<=now&&job.readyAt>now),waiting=jobs.filter(job=>job.startedAt>now).length;
      for(const job of finished)readyNow.add(job.id);
      if(seenReady&&!cafeGame&&finished.some(job=>!seenReady.has(job.id)))feedback('ready',{id:machine.id});
      if(machine.id==='roaster')feedback('roasting',{on:Boolean(running)});
      if(machine.id==='dryer')world.setActorState('dryer',{filled:jobs.length>0});
      const selected=finished[0]||running;
      world.setObjectStatus(machine.id,{text:'',jobs:selected?[{
        ...selected,units:finished.length||1,queueCount:waiting,summary:true,
        icon:machine.id==='dryer'&&!selected.turned&&now>=(selected.startedAt+selected.readyAt)/2&&now<selected.readyAt?'🔄':{dryer:'☀️',roaster:'🔥',grinder:'☕'}[machine.id]
      }]:[]});
    }
    seenReady=readyNow;
    world.setObjectStatus('well', { text: '' });
    world.setActorState('pond',{fish:0,level:p.upgrades.pond});
    
    world.setObjectStatus('seed-shop', { text: '' });
    world.setObjectStatus('market', { text: '' });
    // Quest guide: blinking card + 3D arrow until the first card tap (or the roast quest), then 6 s after each tap.
    // Quests done through a HUD button (shop, orders, café) highlight that button instead of the 3D arrow.
    const guiding=Boolean(farm.quest)&&!seen('quest-guide'),target=guiding||Date.now()<arrowUntil?questTarget():null,hudTarget=HUD_TARGETS.includes(target)?target:null;
    world.setQuestArrow(hudTarget?null:target);ui.guide(guiding,hudTarget);
    if (menu) renderMenu();
    else if(toolsOpen && nearFarm && !work && !pendingTool && !pendingStationAction) {toolEntries=makeToolEntries(p);ui.seedStrip({title:tr('farm.strip.tools'),hint:seen('tools')?null:tr('farm.strip.toolsHint'),entries:toolEntries,selected:tool==='plant' ? `plant:${selectedSeed}` : tool==='water' ? 'drag-water' : tool==='clear' ? 'clear-plant' : tool==='fertilize' ? 'drag-fertilizer' : ['weed','prune','harvest'].includes(tool)?`drag-${tool}`:null});}
    else ui.closeSeedStrip();
  }
  // A drag changes only the camera; the following synthetic click must not move the player.
  let drag = null, suppressClickUntil = 0;
  const pointerOptions = { capture:true, signal:events.signal };
  document.addEventListener('pointerdown', event => {
    const canvas = event.target.closest('#game canvas');
    if (cafeGame || lessonClose || decorationBuilder?.active || !canvas || ui.modalOpen || event.button !== 0 || !event.isPrimary) return;
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY, lastX:event.clientX, lastY:event.clientY, moved:false, canvas};
    canvas.setPointerCapture(event.pointerId);
  }, pointerOptions);
  document.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX-drag.x,event.clientY-drag.y) < 8) return;
    drag.moved = true; event.preventDefault();
    world.panCamera(drag.lastX,drag.lastY,event.clientX,event.clientY,drag.canvas.getBoundingClientRect());
    drag.lastX = event.clientX; drag.lastY = event.clientY;
  }, {...pointerOptions, passive:false});
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) suppressClickUntil = performance.now()+400;
    if (drag.canvas.hasPointerCapture(event.pointerId)) drag.canvas.releasePointerCapture(event.pointerId);
    drag = null;
  }
  document.addEventListener('pointermove',event=>{const canvas=event.target.closest('#game canvas');if(canvas&&decorationBuilder?.active)decorationBuilder.locate(event,canvas);},{signal:events.signal});
  document.addEventListener('wheel',event => {
    if (cafeGame || !event.target.closest('#game canvas') || ui.modalOpen || event.ctrlKey) return;
    event.preventDefault(); world.zoomView(event.deltaY < 0 ? .1 : -.1);
  },{passive:false,signal:events.signal});
  document.addEventListener('pointerup',endDrag,pointerOptions);
  document.addEventListener('pointercancel',endDrag,pointerOptions);
  document.addEventListener('lostpointercapture',endDrag,pointerOptions);
  // Đổi tab khi đang kéo thì pointerup không về: bỏ kéo luôn.
  for(const [target,type] of [[window,'blur'],[document,'visibilitychange']])target.addEventListener(type,()=>{if(drag?.canvas.hasPointerCapture(drag.id))drag.canvas.releasePointerCapture(drag.id);drag=null;},{signal:events.signal});
  $('heaven-interact').addEventListener('click', interact, { signal: events.signal });
  // After the tutorial quests the card keeps naming the next useful job (same ids as QUESTS), so a tap is never a dead end.
  function freeGoal(){
    const p=farm.peek(),trees=p.plots.filter(t=>t.unlocked),count=test=>trees.filter(t=>test(plotCare(t))).length;
    const ready=count(c=>c.ready);if(ready)return{id:'harvest',title:tr('farm.goal.harvest'),detail:tr('farm.goal.harvestDetail',{n:ready})};
    const thirsty=count(c=>c.needsWater);if(thirsty)return{id:'water',title:tr('farm.goal.water'),detail:tr('farm.goal.waterDetail',{n:thirsty})};
    const weedy=count(c=>c.needsWeeding);if(weedy)return{id:'weed',title:tr('farm.goal.weed'),detail:tr('farm.goal.weedDetail',{n:weedy})};
    const station=MACHINES.find(m=>{const s=p.machines[m.id];return s&&[s.batch,...(s.extraBatches||[])].some(j=>j&&j.readyAt<=Date.now());});
    if(station)return{id:'collect',target:station.id,title:tr('farm.goal.collect',{station:station.name}),detail:tr('farm.goal.collectDetail')};
    const empty=count(c=>c.empty);if(empty)return{id:'plant',title:tr('farm.goal.plant'),detail:tr('farm.goal.plantDetail',{n:empty})};
    const field=FIELDS.find(f=>farm.canExpand(f.id));if(field)return{id:'expand',title:tr('farm.goal.expand',{field:field.name}),detail:tr('farm.goal.expandDetail',{price:field.price})};
    return regionKind==='farm'?{id:'sell',title:tr('world.goal.sell'),detail:tr('world.goal.sellDetail')}:{id:'serve',title:tr('farm.goal.serve'),detail:tr('farm.goal.serveDetail')};
  }
  function goal(){return farm.quest||freeGoal();}
  // Where the current quest happens: a world interaction id, a HUD shortcut id (HUD_TARGETS), or null when nothing to do yet.
  // Shared by the card tap (guideQuest) and the quest arrow so both always point at the same place.
  const HUD_TARGETS=['seed-shop','cafe-play','order-board'];
  // Nhiệm vụ riêng theo nơi (REGION_QUESTS) dẫn đường như nhiệm vụ gốc cùng chỉ số.
  const STAT_QUEST={sold:'sell',served:'serve',harvested:'harvest',dried:'dry',roasted:'roast',delivered:'ship',expanded:'expand'};
  const questKind=quest=>quest.id.includes('-')?STAT_QUEST[quest.stat]||quest.id:quest.id;
  function questTarget(){
    const quest=goal(),p=farm.peek();if(!quest)return null;
    const kind=questKind(quest);
    if(kind==='sell')return 'seed-shop';
    if(kind==='serve')return 'cafe-play';
    if(kind==='ship'){const crop=p.orders.find(o=>o.status==='open'&&o.source!=='shop')?.cropId||'robusta';return p.stock.roasted[crop]>=252?'order-board':p.stock.dried[crop]>=100?'roaster':'dryer';}
    const plot=test=>p.plots.find(t=>t.unlocked&&t.stage!=='empty'&&test(plotCare(t)))?.id;
    return {harvest:plot(c=>c.ready),dry:'dryer',roast:'roaster',water:p.water?plot(c=>c.needsWater):'well',weed:plot(c=>c.needsWeeding),plant:p.plots.find(t=>t.unlocked&&t.stage==='empty')?.id,collect:quest.target,expand:(FIELDS.find(f=>!p.fields.includes(f.id)&&farm.canExpand(f.id))||FIELDS.find(f=>!p.fields.includes(f.id)))?.id}[kind]||null;
  }
  // Tapping the goal card walks to what the quest needs (arrival runs interact()), so a newcomer never hunts across the map.
  function guideQuest(){
    const quest=goal(),p=farm.peek();if(!quest||cafeGame||ui.modalOpen||lessonClose)return;
    const target=questTarget();
    if(target==='seed-shop'){clearInput();cancelWork();menu={id:'seed-shop',kind:'station',remote:true,initialFilter:'trade'};renderMenu();return;}
    if(target==='cafe-play'){void enterCafe();return;}
    if(questKind(quest)==='ship'){
      // Not enough beans → go roast; otherwise «Đơn hàng» (which creates the 252 g order) where «Chuyển về quán · 2 xu» ships it.
      const crop=shipCrop(p);
      if(target!=='order-board'){closeUserMenu();world.moveToNpc(target);world.setFocus(target);ui.notice(tr('farm.goal.shipNeed',{crop:cropById(crop).short,have:formatMass(p.stock.roasted[crop])}),false);return;}
      openOrderBoard();return;
    }
    if(!target){
      // Say how long until the trees need it and what to do meanwhile, instead of a dead end.
      const trees=p.plots.filter(t=>t.unlocked&&t.stage!=='empty').map(plotCare),wait=quest.id==='water'?Math.min(...trees.map(c=>c.waterInSeconds)):null,empty=p.plots.filter(t=>t.unlocked&&t.stage==='empty').length;
      ui.notice((quest.id==='water'&&Number.isFinite(wait)?tr('farm.goal.notThirsty',{n:Math.max(1,Math.ceil(wait/60))}):tr('farm.goal.noTree'))+' '+tr(empty?'farm.goal.meanwhilePlant':'farm.goal.meanwhile',{n:empty}),false);return;}
    closeUserMenu();
    // A finished batch waiting at the station is collected on arrival instead of reopening its menu.
    const state=p.machines[target],done=state&&[state.batch,...state.extraBatches].some(j=>j&&j.readyAt<=Date.now());
    if(done){if(near(target)){noticeResult(applyAction(target,'collect',null));refresh(Date.now());return;}pendingStationAction={id:target,action:'collect'};}
    world.moveToNpc(target);world.setFocus(target);
  }
  function remindWorker(id){noticeResult(applyAction('workers','remind',id));refresh(Date.now());}
  // «Thuê robot thay» only when a robot can be hired right now: no robot yet and a free slot (2 workers incl. a sick one = full).
  function canHireRobotCover(){return farm.peek().workers.length<FARM_SLOTS;}
  function hireRobotCover(){if(cafeGame||lessonClose)return;clearInput();cancelWork();menu={id:null,kind:'workers',remote:true,initialFilter:'robot'};renderMenu();}
  // «Đơn hàng» from the menu button or the quest card: during the ship quest, order 252 g from the café if none is open.
  function openOrderBoard(){
    const p=farm.peek(),ship=farm.quest?.id==='ship',crop=shipCrop(p);
    if(ship&&!p.orders.some(o=>o.status==='open'&&o.source!=='shop'))noticeResult(applyAction('cafe','order',crop));
    clearInput();cancelWork();menu={id:null,kind:'jobs',remote:true,initialFilter:ship?(p.stock.roasted[crop]>=252?'ready':'pending'):null};renderMenu();
  }
  const questCard=document.querySelector('#farm-hud .quest-tracker'); // heaven HUD has its own .quest-tracker earlier in the DOM
  // First tap ends the blinking guide for good; every tap shows the arrow for 6 s.
  function tapQuestCard(){if(lessonClose)return;markSeen('quest-guide');arrowUntil=Date.now()+6000;guideQuest();refresh(Date.now());}
  if(questCard){questCard.setAttribute('role','button');questCard.tabIndex=0;questCard.title=tr('farm.goal.cardTitle');
    questCard.addEventListener('click',tapQuestCard,{signal:events.signal});
    questCard.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();tapQuestCard();}},{signal:events.signal});}
  // Re-ask a missed heaven lesson (onboarding-flow 3.1) only at a calm moment; returns false when deferred, null when nothing is askable, true when shown.
  // Never queued: a deferred cue simply waits for the next trigger.
  function offerLesson(ids,manual=false){
    if(lessonClose||(coach&&!manual)||cafeGame||ui.modalOpen||isSettingsOpen()||work||workQueue.length||pendingTool||pendingPlant||pendingStationAction||decorationBuilder?.active||decorationBuilder?.working)return false;
    const lesson=farm.pendingLesson(ids);if(!lesson)return null;
    closeUserMenu();$('heaven-controls').hidden=true;$('farm-notice').hidden=true; // toast would cover the first answer on phones
    lessonClose=askLesson({...lesson,
      onAnswer:optionId=>{const result=farm.act('lessons','answer',{questionId:lesson.question.id,optionId});if(!result.ok){ui.notice(result.message,false);return null;}if(result.correct)ui.notice(result.message);refresh(Date.now());return result;},
      // Any close (incl. «Để sau») spends today's rain cue, so the rain check does not reopen the box a tick later.
      onClose:()=>{lessonClose=null;rainAskDay=farm.weather.day;$('heaven-controls').hidden=ui.modalOpen;clearInput();}});
    return true;
  }
  // Heaven notebook rows for the Guide: learned, or when the next re-ask is possible.
  function notebook(){
    const p=farm.peek(),left=Math.ceil((WORK_DAY_MS-Math.max(0,Date.now()-p.epoch)%WORK_DAY_MS)/60000);
    return Object.entries(LESSON_PERKS).map(([id,perk])=>{const learned=p.lessons.learned.includes(id);return {id,name:perk.name,effect:perk.effect,learned,wait:learned||farm.pendingLesson([id])?0:left};});
  }
  // First-visit controls hint (flag `controls`): ends after moving and doing one job, after 15 s, or on ×.
  function startCoach(){
    // 15 s of rendered farm time (dt is capped per frame), so load stalls and hidden tabs do not eat it.
    coach={start:character.position.clone(),moved:false,acted:false,left:15};
    document.body.classList.add('farm-coach-pending');
    ui.coach(usesTouch()?tr('farm.coach.touch'):tr('farm.coach.mouse'),endCoach);
  }
  function endCoach(){if(!coach)return;coach=null;document.body.classList.remove('farm-coach-pending');ui.coach(null);markSeen('controls');}
  document.addEventListener('click', event => {
    const canvas = event.target.closest('#game canvas');
    if (cafeGame || lessonClose || !canvas || performance.now() < suppressClickUntil) return;
    if(decorationBuilder?.active){decorationBuilder.locate(event,canvas);return;}
    if (ui.modalOpen) {
      if (menu?.kind !== 'care') return;
      closeMenu();
    }
    if(decorationBuilder?.pick(event,canvas)){clearInput();cancelWork();return;}
    decorationBuilder?.stopTask();
    const workerPick=crew.pickAtScreen(event.clientX,event.clientY,canvas.getBoundingClientRect()),workerId=workerPick?.id;
    if(workerId){clearInput();cancelWork();crew.select(workerId);const w=farm.peek().workers.find(x=>x.id===workerId);menu={kind:'worker-detail',id:null,workerId,remote:true,initialFilter:w&&onPhone(w,Date.now())?'settings':undefined};renderMenu();return;}
    cancelWork(); world.moveToScreen(event.clientX, event.clientY, canvas.getBoundingClientRect(), (id, picked) => {
      if (FIELDS.some(field => field.id === id)) {world.moveToNpc(id);world.setFocus(id);return true;}
      if(MACHINES.some(machine=>machine.id===id)){if(picked?.action==='collect'&&near(id)){noticeResult(applyAction(id,'collect',null));refresh(Date.now());return true;}pendingStationAction={id,action:picked?.action || 'select'};world.moveToNpc(id);world.setFocus(id);return true;}
      const plot = farm.progress.plots.find(item => item.id === id);
      if(plot?.unlocked && ['plant','water','clear','fertilize','weed','prune','harvest'].includes(tool) && (!acceptsTool(plot,tool,selectedSeed,farm.level) || toolCapacity(farm.progress,tool,selectedSeed)<1)){
        ui.rejectDrop(event.clientX,event.clientY,{plant:'🌱',water:'💧',clear:'⛏️',fertilize:'🪴',weed:'🌿',prune:'✂️',harvest:'🧺'}[tool]);return true;
      }
      if(plot?.unlocked && ['plant','water','clear','fertilize','weed','prune','harvest'].includes(tool) && acceptsTool(plot,tool,selectedSeed,farm.level)){
        ui.closeSeedStrip();workQueue=[{id,action:tool,choice:selectedSeed}];nextQueuedWork();return true;
      }
      if (!plot?.unlocked || plot.stage !== 'empty') return false;
      openMenu(id, 'plant'); return true;
    });
  }, { capture: true, signal: events.signal });
  $('heaven-controls').hidden = false;
  // Lần đầu cần màn loading để tải model quán; các lần sau model đã nằm trong cache nên vào thẳng như khi về farm.
  // Quán dựng một lần (lần đầu có màn loading vì model tải sau khi scene có, tránh lộ khối tạm), sau đó giữ như farm:
  // rời quán chỉ tạm dừng (leave: khách, ca bán đứng yên), vào lại chơi tiếp (enter) nên không dựng lại cảnh.
  let enteringCafe=false,cafeKept=null;
  async function enterCafe(){
    if(cafeGame||enteringCafe)return;enteringCafe=true;markSeen('unlock-cafe-play-used');endCoach();
    // Quán có scene riêng nên cần bản nhân vật riêng; tải lại cùng GLB đã chọn (trình duyệt đã cache file).
    // The cover always lifts (finally): a failed café build returns to the farm with a notice instead of a blank screen.
    try{
      const leaveFarm=()=>{decorationBuilder?.stopTask();decorationBuilder?.clear();closeMenu();cancelWork();farm.flush();ui.closeSeedStrip();ui.toolsPrompt(false,{x:0,y:0});};
      if(cafeKept){leaveFarm();cafeKept.enter();cafeGame=cafeKept;}
      else{
        showLoading(30,tr('farm.loading.openCafe'));
        const cafeCharacter=await loadPlayer(playerModel(profile.gender)).catch(error=>{console.warn('Không tải được nhân vật cho quán, dùng khối tạm.',error);return null;});
        loading(60,tr('farm.loading.buildCafe'));leaveFarm();
        cafeGame=cafeKept=createCafeGame({farm,ui,profile,character:cafeCharacter,onExit:regionKind==='cafe'?null:exitCafe,onMenu:id=>{menu={id,kind:id==='orders'?'orders':'station',remote:true};renderMenu();}});
        // Lift the cover once the art is in (at most 4 s on a slow network: placeholders still work).
        loading(85,tr('farm.loading.furniture'));
        await Promise.race([cafeGame.ready,new Promise(r=>setTimeout(r,4000))]);
        // Compile café shaders off the main thread like other scenes (app/game.js), so the first frame does not stall.
        await renderer?.compileAsync(cafeGame.scene,cafeGame.camera);
      }
      cafeGame.resize(innerWidth,innerHeight);$('game').setAttribute('aria-label',tr('farm.aria.cafe'));document.title=tr('farm.docTitle.cafe');
    }catch(error){console.error('Không mở được quán.',error);cafeKept?.dispose();cafeGame=cafeKept=null;ui.notice(tr('farm.notice.cafeFailed'),false);}
    finally{enteringCafe=false;hideLoading();}
  }
  function exitCafe(){if(!cafeGame)return;closeMenu();cafeGame.leave();cafeGame=null;clearInput();world.resetCamera();refresh(Date.now());$('game').setAttribute('aria-label',tr('farm.aria.farm'));document.title=tr('farm.docTitle.farm');}
  decorationBuilder=createDecorationBuilder({world,farm,player:character,ui,signal:events.signal,defaultName:tr('farm.decor.defaultName',{name:profile.name}),feedback});decorationBuilder.sync();
  world.reset('farm'); refresh(Date.now());
  return {
    get scene(){return cafeGame?.scene||world.scene;},get camera(){return cafeGame?.camera||world.camera;},resize(w,h){canvasRect=null;world.resize(w,h);cafeGame?.resize(w,h);},clearInput,
    update(dt, time) {
      // Back from a hidden tab or sleep: let the model credit the gap before crew logic renews contracts.
      if(Date.now()-farm.peek().lastAt>60000)farm.tick(Date.now());
      // The farm world is hidden behind the café: keep workers moving, tick the model at 2 Hz, skip farm HUD/badge refresh.
      autoTick(dt);
      if(cafeGame){crew.update(dt,Date.now(),null,true);cafeGame.update(dt,time);if(time-lastRefresh>=.5){lastRefresh=time;farm.tick(Date.now());ui.coins(farm.peek().coins);if(menu)renderMenu();}ui.update();return;}
      crew.update(dt,Date.now(),[work?.id,pendingTool?.id,pendingPlant?.id,...workQueue.map(t=>t.id)].filter(Boolean));
      const result = world.update(dt, time, keyboard.combine(touch), (ui.modalOpen&&!auto) || Boolean(lessonClose) || Boolean(work) || Boolean(decorationBuilder?.active)||Boolean(decorationBuilder?.working)); nearest = result.nearest;decorationBuilder?.tick(dt,result.navigationFailed,ui.modalOpen);
      if(coach){if(!coach.moved&&character.position.distanceTo(coach.start)>1)coach.moved=true;coach.left-=dt;if((coach.moved&&coach.acted)||coach.left<=0)endCoach();}
      if(result.navigationFailed && pendingTool){if(auto)autoSkip.set(`${pendingTool.id}:${pendingTool.action}`,Date.now()+15000);world.removePlotSelection(pendingTool.id);pendingTool=null;nextQueuedWork();}
      if(result.navigationFailed&&pendingStationAction){pendingStationAction=null;world.setFocus(null);ui.notice(tr('farm.notice.stationUnreachable'),false);}
      const owned = farm.peek().fields;
      if (nearest?.kind === 'plot' && !owned.includes(nearest.fieldId)) nearest = null;
      const wasNearFarm = nearFarm;
      nearFarm = PLOTS.some(plot => owned.includes(plot.fieldId) && Math.hypot(character.position.x-plot.position[0],character.position.z-plot.position[1]) <= plot.interactDistance+1.5);
      if (!nearFarm){toolsOpen=false;if(!work&&!pendingTool&&!pendingPlant&&!workQueue.length)tool='auto';}
      if (nearFarm !== wasNearFarm) refresh(Date.now());
      if (result.arrivedNpc && !work && (!ui.modalOpen||auto)) {
        nearest = world.getInteraction(result.arrivedNpc);
        if(pendingStationAction?.id===result.arrivedNpc){const intent=pendingStationAction;pendingStationAction=null;if(intent.action==='collect'){noticeResult(applyAction(intent.id,'collect',null));refresh(Date.now());}else if(intent.action==='turn')begin(intent.id,'turn');else openMenu(intent.id,'machine');}
        else if(pendingTool?.id===result.arrivedNpc){const task=pendingTool;pendingTool=null;if(!begin(task.id,task.action,task.choice)){if(auto)autoSkip.set(`${task.id}:${task.action}`,Date.now()+5000);world.removePlotSelection(task.id);nextQueuedWork();}}
        else if (pendingPlant?.id === result.arrivedNpc) {
          const planting = pendingPlant; pendingPlant = null; begin(planting.id, 'plant', planting.cropId);
        } else if (!(auto&&ui.modalOpen) && !(menu?.kind === 'plant' && menu.id === result.arrivedNpc)) interact();
      }
      playerActivity.update(work?.action||null,work?work.elapsed/work.duration:0,time);
      if (work) {
        work.elapsed += dt; 
        if (work.elapsed >= work.duration) {
          const task = work; work = null;playerActivity.update(null);
          const done = near(task.id) ? applyAction(task.id, task.action, task.choice) : null;
          if (done) noticeResult(done);
          if (auto && done && !done.ok) autoSkip.set(`${task.id}:${task.action}`, Date.now() + 15000);
          world.removePlotSelection(task.id);world.setFocus(null); refresh(Date.now());nextQueuedWork();
          // Re-ask cues (onboarding-flow 3.1): right after a hand harvest, or when the player walks to the well.
          if (done?.ok && task.action === 'harvest') offerLesson(['ripe']);
          if (done?.ok && task.action === 'refill') offerLesson(['water']);
        }
      }
      if (nearest?.name !== interactName) { interactName = nearest?.name; $('heaven-interact').hidden = true; if (nearest) { $('heaven-interact-name').textContent = nearest.name; $('heaven-interact').setAttribute('aria-label', tr('farm.aria.interact',{name:nearest.name})); } }
      if (time-lastRefresh >= .5) {
        lastRefresh = time; farm.tick(Date.now()); refresh(Date.now());
        const weather = farm.weather; // first calm moment on a rainy work day: the "water" lesson
        if (weather.raining && rainAskDay !== weather.day && offerLesson(['water']) !== false) rainAskDay = weather.day;
      }
      const rect = canvasRect ||= $('game').querySelector('canvas').getBoundingClientRect();
      const point = (promptPoint ||= character.position.clone()).copy(character.position); point.y += 2.5; point.project(world.camera);
      ui.toolsPrompt(unlocked?.has('tools') && nearFarm && !lessonClose && !decorationBuilder?.busy && !decorationBuilder?.active && !menu && !toolsOpen && !work && !pendingTool && !pendingPlant && !pendingStationAction && point.z >= -1 && point.z <= 1, {
        x:rect.left+(point.x+1)*rect.width/2, y:rect.top+(1-point.y)*rect.height/2,
      });
      ui.update();
      setListener(character.position, world.camera); vfx.update(dt);
    },
    handleKeyDown(event) {
      if(auto&&event.isTrusted&&MOVE_KEYS.has(event.code)&&!event.target.closest?.('input, textarea, select'))stopAuto(tr('crew.auto.manual'));
      if (event.target.closest('input, textarea, select') || lessonClose) return; // the re-ask dialogue handles its own keys
      if(decorationBuilder?.active&&!ui.modalOpen){decorationBuilder.key(event);return;}
      if (ui.handleModalKey(event)) return;
      if(cafeGame){cafeGame.handleKeyDown(event);return;}
      if (event.code === 'Escape' && (menu?.kind==='plant'||toolsOpen||tool!=='auto'||work||pendingTool||pendingPlant)) { event.preventDefault(); closeUserMenu(); return; }
      if (keyboard.down(event)) { decorationBuilder?.stopTask(); world.resetCamera(); world.stopMovement(); cancelWork(); return; }
      if (!event.repeat && event.code === 'KeyE') { event.preventDefault(); interact(); }
    },
    handleKeyUp: event => cafeGame ? cafeGame.handleKeyUp(event) : keyboard.up(event), nextDialogue() {},
    replaceAsset(id,asset){if(id.startsWith('farm/worker/')||id==='farm/robot')return crew.replaceAsset(id,asset);return id.startsWith('cafe/')?cafeGame?.replaceAsset(id,asset):world.replaceAsset(id,asset);},getAssetSlots(){return [...world.getAssetSlots(),...crew.getAssetSlots(),...(cafeGame?.getAssetSlots()||[])];},
    activate() {
      ui.activate(); refresh(Date.now());
      if (regionKind === 'cafe') { void enterCafe(); return; } // chỉ có quán: nông trại chỉ giữ dữ liệu, không chơi
      const learned = farm.peek().lessons.learned.length;
      ui.notice(freshLessons > 0 ? tr('farm.notice.lessonsActive',{n:learned}) : tr(usesTouch()?'farm.notice.welcomeTouch':'farm.notice.welcomeClick',{name:profile.name}));
      freshLessons = 0;
      if (!coach && !seen('controls')) startCoach();
    },
    dispose() { stopAuto(); autoHud.dispose(); delete window.__forceIncident; delete window.__incidentOdds; lessonClose?.();document.body.classList.remove('farm-coach-pending'); cafeKept?.dispose();decorationBuilder?.dispose();vfx.dispose();crew.dispose();playerActivity.dispose();farm.flush(); clearInput(); events.abort(); ui.dispose(); world.dispose(); $('heaven-controls').hidden = true; },
  };
}
