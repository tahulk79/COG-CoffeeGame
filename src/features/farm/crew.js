import { avoidanceStep,slideMove } from '../../shared/game/collision.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { createWorkActivity } from './activity.js';
import { choosePlantCrop,jobAgeBonus } from './worker-planner.js';
import { productionNeed } from './orders.js';
import * as THREE from 'three';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { MACHINES,CROPS,PLOTS,FIELDS,plotCare } from './content.js';
import { t as tr } from '../../i18n/index.js';
import { rollSlack,traitOf,dislikeOf,tiredFactor,drain,regen,MORALE } from '../../shared/game/morale.js';
import { activeJobs,jobGroupOf,JOB_GROUPS,ACTION_LABELS,workerStat,workerLevel,efficiency,SEASON_MS,workerWage,workerIdleReason } from './rules.js';

const productionOrders=p=>p.orders.filter(o=>o.source!=='shop');
const PLOT_IDS=new Set(PLOTS.map(plot=>plot.id));
// Phone incident in effect (the 4 s job cooldowns also use waitUntil, so check the reason too).
export const onPhone=(w,at)=>w.incident?.type==='phone'&&w.waitUntil>at&&w.waitReason?.startsWith('📱');
// Split tree work so workers never tend neighbouring trees: one field each when there are enough fields,
// otherwise the fields' 4 columns are cut into contiguous strips (one field, two workers → columns 1–2 | 3–4).
// Only workers able to work right now count, so a partner covers the whole farm while the other rests or is off contract.
// A robot owns a strip too, but score() lets people into it for the jobs the robot cannot do.
function plotZones(p,at){
  const team=p.workers.filter(w=>w.farmId==='farm-0'&&w.enabled&&w.shiftUntil>at&&w.restUntil<=at).map(w=>w.id).sort(),zones=new Map();
  if(team.length<2)return zones;
  const fields=p.fields.filter(id=>FIELDS.some(f=>f.id===id));team.forEach(id=>zones.set(id,new Set()));
  PLOTS.forEach((plot,index)=>{
    const field=fields.indexOf(plot.fieldId);if(field<0)return;
    const owner=fields.length>=team.length?field%team.length:Math.floor((field*4+index%12%4)*team.length/(fields.length*4));
    zones.get(team[owner]).add(plot.id);
  });
  return zones;
}
// Placeholder for slot `farm/robot` (scene-assets.md): box body, screen face, back water tank, wheel blocks as `legs`, status light on top.
function createRobot(){
  const group=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1);
  const box=(color,x,y,z,w,h,d)=>{const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.5}));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;group.add(mesh);return mesh;};
  box('#e8e2d4',0,.95,0,.6,.7,.45);box('#6c8885',0,1.42,0,.5,.3,.36);box('#8df0a8',0,1.42,.185,.42,.2,.02);box('#6c8885',0,1,-.3,.3,.45,.16);
  for(const x of [-.38,.38])box('#6c8885',x,1,0,.12,.5,.14);
  group.userData.legs=[-.17,.17].map(x=>box('#6c8885',x,.3,0,.2,.6,.3));
  const light=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshBasicMaterial({color:'#8df0a8'}));light.position.y=1.65;light.userData.nonSolid=true;group.add(light);group.userData.light=light;
  return group;
}
// Workers use the same action command and colliders as the player. Jobs are claimed before travel.
// onIncident(worker, result): a rolled incident just took effect (result.type 'phone' | 'sick', result.message).
export function createFarmCrew(farm,world,player,onReward=()=>{},onIncident=()=>{}) {
  const actors=new Map(),cooldowns=new Map(),waitingSince=new Map(),renewRetry=new Map();let dispatchAt=0,lastRevision=-1,dispatchProgress=null,freeStorage=0,playerTargets=new Set(),zones=new Map(),collectReserve=0;
  const positionOf=id=>world.getInteraction(id)?.position;
  const jobGroup=t=>['start','collect','turn'].includes(t.action)?'processing':['ship','shipOrder'].includes(t.action)?'delivery':t.action;
  const key=t=>`${t.id}:${t.action}`;
  // Robot = one job, person = its active groups (rules.js activeJobs); refilling water always serves the watering job.
  const canWork=(w,t)=>t.action==='refill'||activeJobs(w).has(jobGroup(t));
  // Ease toward the heading like the player does; snapping each frame made blocked workers spin.
  function turn(actor,angle,dt){const r=actor.group.rotation;r.y+=Math.atan2(Math.sin(angle-r.y),Math.cos(angle-r.y))*(1-Math.exp(-10*dt));}
  function stepAside(actor,dt,awayFrom,playerAway){
    const origin=actor.group.position,blockers=[...actors.values()].filter(other=>other!==actor).map(other=>other.group.position);
    if(!playerAway)blockers.push(player.position);
    const next=avoidanceStep(origin,awayFrom,blockers,Math.min(.09,dt*2),(x,z)=>world.canStand(x,z),actor.side||1);
    if(!next)return false;
    // Keep dodging to the same side until the path clears instead of flipping left/right every frame.
    const cross=(origin.x-awayFrom.x)*(next.z-origin.z)-(origin.z-awayFrom.z)*(next.x-origin.x);if(Math.abs(cross)>1e-6)actor.side=Math.sign(cross);
    turn(actor,Math.atan2(next.x-origin.x,next.z-origin.z),dt);origin.x=next.x;origin.z=next.z;
    actor.walk+=dt*8;for(const [i,leg]of actor.group.userData.legs.entries())leg.rotation.x=Math.sin(actor.walk+i*Math.PI)*.3;
    return true;
  }

  function release(actor){farm.release(actor.id);actor.task=null;actor.route=[];actor.search=null;actor.elapsed=0;actor.replans=0;actor.activity?.update(null);actor.group.rotation.z=0;for(const leg of actor.group.userData.legs||[])leg.rotation.x=0;}
  function tasks(p,at){
    const result=[];
    for(const tree of p.plots.filter(t=>t.unlocked)){
      const care=plotCare(tree);
      if(care.empty)result.push({id:tree.id,action:'plant',priority:3});
      if(care.ready)result.push({id:tree.id,action:'harvest',priority:5});
      if(care.needsWater)result.push({id:tree.id,action:'water',priority:4+4*Math.min(1,Math.max(0,(35-tree.water)/20))});
      if(care.needsWeeding)result.push({id:tree.id,action:'weed',priority:2+3*Math.min(1,Math.max(0,(tree.weeds-30)/45))});
      if(care.canFeed&&p.fertilizer)result.push({id:tree.id,action:'fertilize',priority:3});
      if(tree.mature&&tree.stage!=='ready'&&tree.growthMs<SEASON_MS*.17&&!tree.pruned)result.push({id:tree.id,action:'prune',priority:1});
    }
    for(const m of MACHINES){
      const state=p.machines[m.id],jobs=[...(state.batch?[state.batch]:[]),...state.extraBatches];
      if(jobs.some(j=>j.readyAt<=at))result.push({id:m.id,action:'collect',priority:6});
      if(m.id==='dryer'&&jobs.some(j=>!j.turned&&at>=(j.startedAt+j.readyAt)/2&&at<j.readyAt))result.push({id:m.id,action:'turn',priority:4});
      // Grind at the café; farm workers preserve whole roasted beans for delivery.
      // Count only unfinished batches: finished ones waiting for storage space must not block the start that frees that space.
      if(m.id!=='grinder'&&jobs.filter(j=>j.readyAt>at).length<3)for(const c of CROPS){
        const n=Math.floor(p.stock[m.input][c.id]/m.inputCount);
        if(n)result.push({id:m.id,action:'start',choice:{cropId:c.id,quantity:Math.min(n,Math.floor(m.capacity/m.inputCount))},priority:m.id==='dryer'?5:3});
      }
    }
    for(const order of productionOrders(p))if(order.status==='open'&&order.deliveryRequested&&p.stock.roasted[order.cropId]>=order.grams)result.push({id:'roaster',action:'shipOrder',choice:order.id,priority:5});
    for(const task of result)if(!waitingSince.has(key(task)))waitingSince.set(key(task),at);
    return result.filter(t=>!playerTargets.has(t.id)&&(cooldowns.get(key(t))||0)<at&&!farm.claimed(t.id,t.action));
  }
  function assignment(w,t,p){
    const orders=productionOrders(p).filter(o=>o.status==='open'&&o.workers.includes(w.id));
    const cropId=t.choice?.cropId||p.plots.find(tree=>tree.id===t.id)?.cropId;
    const targets=Object.fromEntries(CROPS.map(c=>[c.id,orders.filter(o=>o.cropId===c.id).reduce((sum,o)=>sum+o.grams,0)]));
    const needed=orders.filter(o=>p.stock.roasted[o.cropId]<targets[o.cropId]);
    if(t.action==='shipOrder')return orders.some(o=>o.id===t.choice);
    if(t.action==='feedFish')return false;
    const d=p.directives||{};
    if(t.action==='fertilize'&&d.fertilize===false)return false;
    if(t.action==='plant'&&d.plant)return true;
    if(d.care&&['water','weed','fertilize','prune','harvest'].includes(t.action))return true;
    if(d.process){
      if(t.action==='collect'||t.action==='turn'||t.action==='start'&&t.id==='dryer')return true;
      if(t.action==='start'&&t.id==='roaster')return roastTarget(p,cropId)>0;
    }
    if(!orders.length)return false;
    if(t.action==='collect'){const state=p.machines[t.id];return [state.batch,...state.extraBatches].filter(Boolean).some(j=>needed.some(o=>o.cropId===j.cropId));}
    if(t.action==='turn'){const state=p.machines[t.id];return [state.batch,...state.extraBatches].filter(Boolean).some(j=>needed.some(o=>o.cropId===j.cropId));}
    if(t.action==='plant')return needed.some(o=>!p.plots.some(tree=>tree.unlocked&&tree.stage!=='empty'&&tree.cropId===o.cropId));
    const matching=orders.filter(o=>o.cropId===cropId),target=matching.reduce((sum,o)=>sum+o.grams,0),need=productionNeed(p,cropId||'robusta',target);
    if(t.action==='start'&&t.id==='roaster')return target>0&&need.roasted>0;
    if(t.action==='start'&&t.id==='dryer')return target>0&&need.green>0;
    if(t.action==='harvest')return target>0&&need.cherries>0;
    return needed.some(o=>o.cropId===cropId);
  }
  // Roast for open orders plus the café's shortfall; surplus stays as clean beans, which keep longer.
  function roastTarget(p,cropId){
    const orders=productionOrders(p).filter(o=>o.status==='open'&&o.cropId===cropId).reduce((sum,o)=>sum+o.grams,0);
    return productionNeed(p,cropId,orders+(farm.demand?.needed||0)).roasted;
  }
  const plantingCrop=(w,p)=>{
    const requested=productionOrders(p).filter(o=>o.status==='open'&&o.workers.includes(w.id)&&p.stock.roasted[o.cropId]<o.grams);
    const standing=p.directives?.plant&&p.directives.plantCrop;
    if(!requested.length&&standing)return p.seeds[standing]>0?standing:null;
    const seeds=Object.fromEntries(CROPS.map(c=>[c.id,requested.some(o=>o.cropId===c.id)?p.seeds[c.id]:0]));
    return choosePlantCrop(w,{...p,seeds},farm.level,requested);
  };
  function score(actor,w,t){
    const p=dispatchProgress;
    if(t.action==='harvest'&&p.plots.find(tree=>tree.id===t.id).readyYield+collectReserve>freeStorage)return -Infinity;
    if(t.action==='collect'){const state=p.machines[t.id];if(![state.batch,...state.extraBatches].filter(Boolean).some(j=>j.readyAt<=Date.now()&&j.outputGrams<=freeStorage))return -Infinity;}
    if(!canWork(w,t)||!assignment(w,t,p))return -Infinity;
    // Zones only bind jobs the owner can do: a robot's strip stays open to people for harvest/plant/fertilize/prune.
    if(PLOT_IDS.has(t.id)&&zones.get(w.id)?.has(t.id)===false&&(()=>{const owner=p.workers.find(o=>zones.get(o.id)?.has(t.id));return !owner||canWork(owner,t);})())return -Infinity;
    const order=productionOrders(p).find(o=>o.status==='open'&&o.workers.includes(w.id)&&p.stock.roasted[o.cropId]<o.grams);
    const cropId=t.action==='plant'?plantingCrop(w,p):null;
    if(t.action==='plant'&&(!p.seeds[cropId]||CROPS.find(c=>c.id===cropId)?.level>farm.level))return -Infinity;
    const pos=positionOf(t.id);if(!pos)return -Infinity;
    const distance=Math.hypot(pos[0]-actor.group.position.x,pos[1]-actor.group.position.z),eta=distance/(2.5*(.75+.5*workerStat(w,'speed')/100));
    const roleMatch=w.role==='auto'||(w.role==='care')===PLOTS.some(p=>p.id===t.id);
    const skill=['harvest','start','turn'].includes(t.action)?workerStat(w,'dexterity'):workerStat(w,'intelligence');
    const crop=t.action==='plant'?cropId:t.choice?.cropId||p.plots.find(tree=>tree.id===t.id)?.cropId,assigned=productionOrders(p).some(o=>o.status==='open'&&o.workers.includes(w.id)&&o.cropId===crop&&p.stock.roasted[crop]<o.grams);
    return t.priority*10+(freeStorage<farm.storageCapacity*.15&&t.action==='start'?25:0)+jobAgeBonus(waitingSince.get(key(t))||Date.now(),Date.now())+(assigned?15:0)+(roleMatch?2:0)+skill/100-eta*1.2+(distance<1?8:0);
  }
  function assign(actor,w,t,at){
    if(t.action==='plant')t={...t,choice:plantingCrop(w,dispatchProgress)};
    if(t.action==='water'&&!w.water)t={id:'well',action:'refill',priority:6};
    if(t.action==='start'){
      const matching=productionOrders(dispatchProgress).filter(o=>o.status==='open'&&o.workers.includes(w.id)&&o.cropId===t.choice.cropId),need=productionNeed(dispatchProgress,t.choice.cropId,matching.reduce((sum,o)=>sum+o.grams,0));
      const standing=dispatchProgress.directives?.process,limit=t.id==='dryer'?(standing?Infinity:Math.ceil(need.green/100)):Math.ceil(Math.max(need.roasted,standing?roastTarget(dispatchProgress,t.choice.cropId):0)/84);
      t={...t,choice:{...t.choice,quantity:Math.min(t.choice.quantity,limit)}};
      if(!t.choice.quantity)return;
    }
    // People may slack before starting (crew-autoplay.md 4): tired, lazy, or the job is the one they dislike. Robots never do.
    if(!actor.robot){
      const group=jobGroupOf(jobGroup(t)),slack=rollSlack(actor.energy,traitOf(w.id),dislikeOf(w.id,JOB_GROUPS)===group);
      if(slack){actor.slackUntil=at+slack.ms;actor.slack=slack.reason;farm.workerUpdate(w.id,{state:tr(`crew.slack.${slack.reason}`)});return;}
    }
    if(!farm.reserve(t.id,t.action,w.id,t.choice))return;
    actor.task=t;actor.elapsed=0;actor.route=[];// People move, so routes only avoid static colliders; meetings are resolved locally while walking.
    actor.search=world.createWorkerRoute(actor.group.position,t.id);
    if(!actor.search){release(actor);return;}
    farm.workerUpdate(w.id,{state:tr('farm.crew.heading',{action:ACTION_LABELS[t.action]?.toLowerCase()||tr('farm.crew.work')})});
  }
  function dispatch(p,at){
    // Keep room for the smallest finished batch so harvesting never starves collection.
    const readyOutputs=MACHINES.flatMap(m=>[p.machines[m.id].batch,...p.machines[m.id].extraBatches].filter(j=>j&&j.readyAt<=at).map(j=>j.outputGrams));collectReserve=readyOutputs.length?Math.min(...readyOutputs):0;
    dispatchProgress=p;zones=plotZones(p,at);freeStorage=Math.max(0,farm.storageCapacity-p.lots.reduce((sum,l)=>sum+l.grams,0));
    const idle=[...actors.values()].filter(a=>!a.task).map(a=>({a,w:p.workers.find(w=>w.id===a.id)})).filter(({a,w})=>w?.enabled&&at>=w.restUntil&&!onPhone(w,at)&&!((a.slackUntil||0)>at));
    const available=tasks(p,at);
    // Enumerate every assignment of up to 3 idle workers (each top 6 + "nothing"), no two on the same target, best total wins.
    let best=[],bestScore=-Infinity;
    const ranked=idle.map(({a,w})=>{
      const byTarget=new Map();for(const t of available){const value=score(a,w,t);if(!Number.isFinite(value))continue;if(!byTarget.has(t.id)||byTarget.get(t.id).value<value)byTarget.set(t.id,{task:t,value});}
      return [...byTarget.values()].sort((a,b)=>b.value-a.value).slice(0,6);
    });
    const pick=(i,used,sum,chosen)=>{
      if(i===ranked.length){if(sum>bestScore){bestScore=sum;best=chosen.slice();}return;}
      chosen.push(undefined);pick(i+1,used,sum,chosen);chosen.pop();
      for(const option of ranked[i])if(!used.has(option.task.id)){used.add(option.task.id);chosen.push(option.task);pick(i+1,used,sum+option.value,chosen);chosen.pop();used.delete(option.task.id);}
    };
    if(idle.length===1)best=[ranked[0][0]?.task];else pick(0,new Set(),0,[]);
    idle.forEach(({a,w},index)=>{
      const task=best[index];if(!task||!Number.isFinite(score(a,w,task))){farm.workerUpdate(w.id,{state:workerIdleReason(w,p,at)});return;}
      if(w.shiftUntil<=at){farm.workerUpdate(w.id,{state:workerIdleReason(w,p,at)});return;}
      assign(a,w,task,at);
    });
  }
  const selectionParts=[];let selectionMaterial=null;
  function selectWorker(id){
    for(const part of selectionParts)part.removeFromParent();selectionParts.length=0;selectionMaterial?.dispose();selectionMaterial=null;
    const actor=actors.get(id);if(!actor)return;
    const meshes=[];actor.group.traverse(node=>{if(!node.isMesh||node.userData.nonSolid||node.userData.noPick)return;for(let parent=node;parent&&parent!==actor.group;parent=parent.parent)if(!parent.visible||parent.userData.noPick||parent.userData.nonSolid)return;meshes.push(node);});
    selectionMaterial=new THREE.MeshBasicMaterial({color:'#ffe18a',side:THREE.BackSide,depthWrite:false});
    for(const mesh of meshes){const outline=new THREE.Mesh(mesh.geometry,selectionMaterial);outline.scale.setScalar(1.08);outline.userData.noPick=true;outline.userData.nonSolid=true;mesh.add(outline);selectionParts.push(outline);}
  }
  const raycaster=new THREE.Raycaster();
  return {
    select:selectWorker,
    position:id=>actors.get(id)?.group.position||null,
    pickAtScreen(x,y,rect){
      world.scene.updateMatrixWorld(true);world.camera.updateMatrixWorld(true);
      raycaster.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),world.camera);
      const hits=raycaster.intersectObjects(world.scene.children,true).filter(hit=>{
        if(!hit.object.isMesh)return false;
        for(let node=hit.object;node;node=node.parent)if(!node.visible||node.userData.noPick||node!==hit.object&&node.isSprite)return false;
        if(hit.object.userData.nonSolid)return false;
        return true;
      });
      const hit=hits[0];if(!hit)return null;
      let node=hit.object,bonus=false;while(node&&!node.userData.workerId){bonus=bonus||node.userData.bonus===true;node=node.parent;}return node?{id:node.userData.workerId,bonus}:null;
    },
    getAssetSlots(){return [...actors.values()].map(a=>a.robot?'farm/robot':`farm/worker/${a.id}`);},
    replaceAsset(id,model){const actor=id==='farm/robot'?[...actors.values()].find(a=>a.robot):actors.get(id.replace('farm/worker/',''));if(!actor||!model?.isObject3D)return false;for(const child of actor.group.children)child.visible=false;if(actor.light)actor.light.visible=true;actor.group.add(model);return true;},
    update(dt,at,playerBusy=null,playerAway=false){
      world.prepareNavigation();
      playerTargets=new Set(Array.isArray(playerBusy)?playerBusy:[playerBusy?.id].filter(Boolean));
      let p=farm.peek();
      for(const [id,actor]of actors)if(!p.workers.some(w=>w.id===id&&w.farmId==='farm-0')){release(actor);actor.activity.dispose();actor.group.removeFromParent();disposeScene(actor.group);actors.delete(id);}
      for(const w of p.workers.filter(w=>w.farmId==='farm-0')){
        if(!actors.has(w.id)){
          const robot=w.kind==='robot',group=robot?createRobot():createPerson(w.color);if(!robot)dressPerson(group,'farm/worker.glb');group.userData.nonSolid=true;group.userData.workerId=w.id;group.name=`farm-worker:${w.id}`;group.userData.assetSlot=robot?'farm/robot':`farm/worker/${w.id}`;
          group.position.set(-2+actors.size*2,.05,-6);world.scene.add(group);actors.set(w.id,{id:w.id,robot,light:group.userData.light,group,activity:createWorkActivity(group,w.name),energy:100,slackUntil:0,slack:null,task:null,route:[],search:null,elapsed:0,walk:0,blocked:0,replans:0});
        }
        farm.employmentTick(w.id,dt);
        // Fire this shift's rolled incident when due; the model cancels it while the player is at the café or once the moment has passed.
        if(w.incident&&!w.incident.done&&w.shiftUntil-at<=w.incident.due){const fired=farm.act('workers','incident',w.id,at);if(fired.ok&&fired.applied)onIncident(w,fired);}
        // A worker left inside a collider (new trunk, layout change) can't step or plan out; nudge to the nearest free spot.
        {const pos=actors.get(w.id)?.group.position;if(pos&&!world.canStand(pos.x,pos.z))outer:for(let r=.2;r<=1.6;r+=.2)for(let i=0;i<16;i++){const x=pos.x+Math.cos(i*Math.PI/8)*r,z=pos.z+Math.sin(i*Math.PI/8)*r;if(world.canStand(x,z)){pos.x=x;pos.z=z;break outer;}}}
        // Auto-renew in the last 30 s (or right after expiry); a failed renewal retries every 10 s, never every frame.
        if(w.enabled&&w.autoPay&&w.shiftUntil-at<30000&&(renewRetry.get(w.id)||0)<=at){const renewed=farm.act('workers','shift',w.id,at);if(!renewed.ok)renewRetry.set(w.id,at+10000);}
        const a=actors.get(w.id);
        // Robot status light: red = stopped/out of pack, yellow = idle or waiting, green = working.
        a.light?.material.color.set(!w.enabled||w.shiftUntil<=at?'#a94d31':a.task?'#8df0a8':'#ffe18a');
        if(a.task&&a.task.action!=='refill'){
          const tree=p.plots.find(t=>t.id===a.task.id),care=tree?plotCare(tree):null;
          const obsolete=care&&(a.task.action==='plant'&&!care.empty||a.task.action==='harvest'&&!care.ready||a.task.action==='water'&&!care.needsWater||a.task.action==='weed'&&!care.needsWeeding||a.task.action==='fertilize'&&!care.canFeed||a.task.action==='prune'&&tree.pruned);
          const machine=p.machines[a.task.id],batchJobs=machine?[machine.batch,...machine.extraBatches].filter(Boolean):[],staleMachine=machine&&(a.task.action==='collect'&&!batchJobs.some(j=>j.readyAt<=at)||a.task.action==='turn'&&!batchJobs.some(j=>!j.turned&&at>=(j.startedAt+j.readyAt)/2&&at<j.readyAt)||a.task.action==='start'&&p.stock[MACHINES.find(m=>m.id===a.task.id).input][a.task.choice.cropId]<MACHINES.find(m=>m.id===a.task.id).inputCount*a.task.choice.quantity);
          if(obsolete||staleMachine){release(a);dispatchAt=0;farm.workerUpdate(w.id,{state:tr('farm.crew.ownerDone')});}
        }a.activity.setBonus(null);if(!a.task||a.search||a.route.length)a.activity.status(w.state||tr('farm.crew.preparing'),0);
        if(a.task&&playerTargets.has(a.task.id)){release(a);farm.workerUpdate(w.id,{state:tr('farm.crew.yield')});continue;}
        if(a.task&&!canWork(w,a.task)){release(a);}
        if(!w.enabled){if(a.task)release(a);farm.workerUpdate(w.id,{state:tr('farm.crew.paused')});continue;}
        // Shift hiring (03/11/2026): workers no longer tire, rest or need a coin boost.
        if(w.shiftUntil<=at){if(a.task)release(a);farm.workerUpdate(w.id,{state:workerIdleReason(w,p,at)});continue;}
        // Sick or on the phone: stand still and drop the claimed job (phone ends on «Nhắc» or after 40 s).
        const phone=onPhone(w,at);
        if(phone||w.restUntil>at){if(a.task)release(a);farm.workerUpdate(w.id,{state:phone?w.waitReason:workerIdleReason(w,p,at)});continue;}
        // A break: stand still with the excuse in the bubble; a tired break restores energy when it ends.
        if(!a.task&&a.slackUntil>at){a.energy=regen(a.energy,dt);farm.workerUpdate(w.id,{state:tr(`crew.slack.${a.slack}`)});continue;}
        if(!a.task&&a.slack){if(a.slack==='tired')a.energy=Math.min(100,a.energy+MORALE.breakEnergy);a.slack=null;}
        if(!a.task)a.energy=regen(a.energy,dt);
        if(!a.task){const approaching=[...actors.values()].find(other=>other!==a&&other.task&&Math.hypot(other.group.position.x-a.group.position.x,other.group.position.z-a.group.position.z)<1.65);if(approaching)stepAside(a,dt,approaching.group.position,playerAway);farm.workerUpdate(w.id,{state:workerIdleReason(w,p,at)});continue;}
        if(a.search){
          const deadline=performance.now()+.7;
          do{const result=a.search.next();if(result.done){a.route=result.value;a.search=null;if(!a.route.length&&!world.atInteraction(a.task.id,a.group.position)){cooldowns.set(key(a.task),at+4000);farm.workerUpdate(w.id,{waitReason:tr('farm.crew.noPath'),waitUntil:at+4000});release(a);}break;}}while(performance.now()<deadline);
          continue;
        }
        while(a.route.length&&Math.hypot(a.route[0].x-a.group.position.x,a.route[0].z-a.group.position.z)<.05)a.route.shift();
        const next=a.route[0];
        if(next){
          const dx=next.x-a.group.position.x,dz=next.z-a.group.position.z,distance=Math.hypot(dx,dz),step=Math.min(distance,dt*2.5*(.75+.5*workerStat(w,'speed')/100)*1);
          const x=a.group.position.x+dx/distance*step,z=a.group.position.z+dz/distance*step;
          const ghost=(a.ghostUntil||0)>at,occupied=!ghost&&((!playerAway&&Math.hypot(player.position.x-x,player.position.z-z)<.85)||[...actors.values()].some(other=>other!==a&&Math.hypot(other.group.position.x-x,other.group.position.z-z)<.85));
          // A step clipping a corner slides along it (same as the player) instead of counting as blocked.
          let tx=x,tz=z;if(!occupied&&!world.canStand(x,z)){const probe={x:a.group.position.x,z:a.group.position.z};slideMove(probe,x-probe.x,z-probe.z,world.canStand);if(Math.hypot(probe.x-a.group.position.x,probe.z-a.group.position.z)>.002){tx=probe.x;tz=probe.z;}}
          if(!occupied&&world.canStand(tx,tz)){farm.workerUpdate(w.id,{state:tr('farm.crew.heading',{action:ACTION_LABELS[a.task.action]?.toLowerCase()||tr('farm.crew.work')})});a.group.position.x=tx;a.group.position.z=tz;turn(a,Math.atan2(dx,dz),dt);a.walk+=dt*8;a.blocked=0;a.replans=0;a.side=0;for(const [i,leg]of a.group.userData.legs.entries())leg.rotation.x=Math.sin(a.walk+i*Math.PI)*.3;}
          else{
            a.blocked+=dt;
            const other=[...actors.values()].find(other=>other!==a&&Math.hypot(other.group.position.x-x,other.group.position.z-z)<1.05);
            let moved=false;
            if(other){
              if(!other.task)moved=stepAside(other,dt,a.group.position,playerAway);
              else if(a.id>other.id||a.blocked>.6)moved=stepAside(a,dt,other.group.position,playerAway);
            }else if(!playerAway&&Math.hypot(player.position.x-x,player.position.z-z)<1.05)moved=stepAside(a,dt,player.position,playerAway);
            const byPerson=Boolean(other)||!playerAway&&Math.hypot(player.position.x-x,player.position.z-z)<1.05;
            farm.workerUpdate(w.id,{state:moved?tr('farm.crew.avoiding'):byPerson?tr('farm.crew.waitClear'):tr('farm.crew.reroute')});
            // Side-stepping resets `blocked`, so a person standing on the target spot could loop forever; this timer survives side-steps.
            a.personWait=byPerson?(a.personWait||0)+dt:0;if(a.personWait>1.5){a.personWait=0;a.ghostUntil=at+1500;}
            if(a.blocked>.8){
              a.blocked=0;
              // People: a one-tile lane has no detour, so pass through them briefly (never walls).
              if(byPerson)a.ghostUntil=at+1200;
              // Static obstacle (trunk, fence): replan from here; give the job up after 3 failed replans.
              else if(++a.replans>3){cooldowns.set(key(a.task),at+4000);farm.workerUpdate(w.id,{waitReason:tr('farm.crew.blocked'),waitUntil:at+4000});release(a);}
              else{a.route=[];a.search=world.createWorkerRoute(a.group.position.clone(),a.task.id);}
            }
          }
          continue;
        }
        if(!world.atInteraction(a.task.id,a.group.position)){cooldowns.set(key(a.task),at+4000);farm.workerUpdate(w.id,{waitReason:tr('farm.crew.noPath'),waitUntil:at+4000});release(a);continue;}
        const duration=farm.workDuration(a.task.action,w)/(.7+.35*workerStat(w,'speed')/100+.25*workerStat(w,'dexterity')/100)*(a.robot?1:tiredFactor(a.energy));
        a.elapsed+=dt;a.activity.update(a.task.action,a.elapsed/duration,at/1000,0);farm.workerUpdate(w.id,{state:`${ACTION_LABELS[a.task.action]} · ${Math.min(100,Math.round(a.elapsed/duration*100))}%`});
        a.group.rotation.z=Math.sin(a.elapsed*5)*.025;
        if(a.elapsed>=duration){
          const before=farm.progress;
          const result=farm.act(a.task.action==='shipOrder'?'orders':a.task.action==='ship'?'cafe':a.task.id,a.task.action,a.task.choice,at,w.id);
          if(result.ok){waitingSince.delete(key(a.task));onReward(before,farm.progress,a.task);dispatchAt=0;}
          if(result.ok){farm.workerUpdate(w.id,{xp:w.xp+5});if(!a.robot)a.energy=drain(a.energy,traitOf(w.id));}
          else{cooldowns.set(key(a.task),at+4000);farm.workerUpdate(w.id,{waitReason:result.message,waitUntil:at+4000,state:result.message});}
          a.group.rotation.z=0;release(a);
        }
      }
      world.setWorkerTargets([...actors.values()].filter(a=>a.task).map(a=>a.task.id));
      if(at-dispatchAt>=650||p.workRevision!==lastRevision){dispatchAt=at;p=farm.progress;lastRevision=p.workRevision;dispatch(p,at);}
    },
    dispose(){selectWorker(null);for(const a of actors.values()){a.activity.dispose();farm.release(a.id);world.scene.remove(a.group);const geometries=new Set(),materials=new Set();a.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}actors.clear();},
  };
}
