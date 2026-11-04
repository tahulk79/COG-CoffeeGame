import * as THREE from 'three';
import { createWorkActivity } from './activity.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { DECORATIONS,decorationError } from './decorations.js';
import { loadModel } from '../../shared/three/models.js';
import { t } from '../../i18n/index.js';
// Hình Blender (decor.glb#decor_<id>); chưa tải xong hoặc lỗi thì dựng khối tạm như cũ.
const ART={};
const artReady=Promise.all(DECORATIONS.map(({id})=>loadModel(`farm/decor.glb#decor_${id}`).then(m=>{if(m)ART[id]=m;})));
function model(item){
  const group=new THREE.Group();group.userData.nonSolid=item.state==='construction';group.userData.noPick=true;
  function box(color,x,y,z,w,h,d){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.85}));mesh.position.set(x,y,z);group.add(mesh);return mesh;}
  const art=ART[item.type]?.clone();
  // Vật liệu riêng mỗi món: bóng mờ lúc đặt và trạng thái đang xây đổi màu/độ trong theo từng món.
  if(art){art.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.castShadow=n.receiveShadow=true;}});group.add(art);}
  else if(item.type==='flowers'){
    box('#bc9463',0,.14,0,1,.28,.8);box('#745638',0,.29,0,.9,.05,.7);
    for(const [i,x,z]of [[0,-.28,-.18],[1,.25,-.18],[2,-.2,.2],[3,.24,.2]]){
      box('#779754',x,.42,z,.045,.28,.045);
      for(let p=0;p<5;p++){const flower=new THREE.Mesh(new THREE.SphereGeometry(.09,7,5),new THREE.MeshStandardMaterial({color:['#e9a0ac','#f2d878','#c7afe1','#f5b38c'][i]}));flower.position.set(x+Math.cos(p*1.256)*.1,.58,z+Math.sin(p*1.256)*.1);group.add(flower);}
      box('#f8e5a0',x,.61,z,.09,.06,.09);
    }
  }else if(item.type==='lamp'){
    box('#8d7652',0,.08,0,.42,.16,.42);box('#70543a',0,.78,0,.1,1.4,.1);box('#725335',0,1.55,0,.5,.12,.5);
    const glow=box('#ffe49c',0,1.36,0,.3,.3,.3);glow.material.emissive.set('#ffd77b');glow.material.emissiveIntensity=.8;box('#725335',0,1.15,0,.4,.08,.4);
  }else{
    box('#82603c',0,.5,0,.1,1,.1);box('#bc935e',0,1.05,0,1.1,.6,.12);
  }
  if(item.type==='sign'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#2e2416';ctx.fillRect(0,0,512,256);ctx.fillStyle='#fffbe6';ctx.font='900 80px "Baloo 2",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(item.text||t('farm.decor.signDefault'),256,132,480);
    // Nền tối chữ trắng to cho đọc được từ góc camera xa; sRGB để màu không bị nhạt.
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Mesh(new THREE.PlaneGeometry(.99,.48),new THREE.MeshBasicMaterial({map}));label.position.set(0,1.05,.066);group.add(label);
  }
  if(item.state==='construction'){
    group.traverse(node=>{if(node.isMesh){node.material.transparent=true;node.material.opacity=.25;}});
    for(const x of [-.65,.65])for(const z of [-.55,.55])box('#ba925d',x,.48,z,.07,.96,.07);
    for(const z of [-.55,.55])box('#d9b97f',0,.9,z,1.4,.08,.08);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle='#3b2a1c';ctx.fillRect(0,0,256,80);ctx.fillStyle='#fff6dc';ctx.font='bold 21px sans-serif';ctx.textAlign='center';ctx.fillText(t('farm.decor.building',{pct:Math.floor(item.buildMs/item.buildDuration*100)}),128,31);ctx.fillStyle='#d9c9a6';ctx.fillRect(16,48,224,13);ctx.fillStyle='#91b963';ctx.fillRect(16,48,224*item.buildMs/item.buildDuration,13);
    const material=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthWrite:false}),badge=new THREE.Sprite(material);badge.position.y=2;badge.scale.set(1.8,.56,1);group.add(badge);
  }
  group.position.set(item.x,.04,item.z);group.rotation.y=item.rotation;return group;
}
export function createDecorationBuilder({world,farm,player,ui,signal,defaultName,feedback=()=>{}}){
  const fx=(mode,result,item)=>feedback('decor',{mode,ok:result.ok,at:{x:item.x,y:.4,z:item.z}});
  const placed=new Map(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3();
  let draft=null,ghost=null,valid=false,positionChosen=false,task=null;const activity=createWorkActivity(player,t('farm.you'));
  const panel=document.createElement('section');panel.id='farm-build-placement';panel.hidden=true;
  const name=document.createElement('strong'),hint=document.createElement('small'),input=document.createElement('input'),buttons=document.createElement('div');input.maxLength=24;input.setAttribute('aria-label',t('farm.decor.signLabel'));input.placeholder=t('farm.decor.signPlaceholder');
  const rotate=document.createElement('button'),confirm=document.createElement('button'),cancel=document.createElement('button');for(const button of [rotate,confirm,cancel])button.type='button';rotate.textContent=t('farm.decor.rotate');confirm.textContent=t('farm.decor.placeHere');cancel.textContent=t('farm.cancel');buttons.append(rotate,confirm,cancel);panel.append(name,hint,input,buttons);document.body.append(panel);
  function error(value=draft){if(!value)return t('farm.decor.err.pickFirst');const reason=decorationError(farm.progress.decorations,value);if(reason)return reason;world.prepareNavigation();if(!world.canStand(value.x,value.z))return t('farm.decor.err.blocked');if(Math.hypot(value.x-player.position.x,value.z-player.position.z)<1)return t('farm.decor.err.player');return null;}
  function update(){if(!draft)return;const reason=error();valid=!reason;hint.textContent=positionChosen?(reason||t('farm.decor.hintChosen')):t('farm.decor.hintPick');confirm.disabled=!positionChosen||!valid;ghost.position.set(draft.x,.04,draft.z);ghost.rotation.y=draft.rotation;ghost.traverse(node=>{if(node.isMesh){node.material.transparent=true;node.material.opacity=.55;node.material.color.set(valid?'#a8d578':'#e18a72');}});}
  function clear(){draft=null;positionChosen=false;panel.hidden=true;if(ghost){ghost.removeFromParent();disposeScene(ghost);ghost=null;}}
  function sync(){
    const items=farm.progress.decorations;let solidsChanged=false;
    for(const [id,group]of placed)if(!items.some(item=>item.id===id)){solidsChanged=solidsChanged||!group.userData.nonSolid;group.removeFromParent();disposeScene(group);placed.delete(id);}
    for(const item of items){const version=`${item.state}:${item.buildMs}`,old=placed.get(item.id);if(old?.userData.version===version)continue;if(old){solidsChanged=solidsChanged||!old.userData.nonSolid;old.removeFromParent();disposeScene(old);}const group=model(item);group.userData.version=version;group.userData.decorationId=item.id;world.scene.add(group);placed.set(item.id,group);solidsChanged=solidsChanged||!group.userData.nonSolid;}
    if(solidsChanged)world.invalidateNavigation();
  }
  artReady.then(()=>{if(signal?.aborted)return;for(const group of placed.values())group.userData.version='';sync();});
  function stopTask(){if(task)world.stopMovement();task=null;activity.update(null);for(const arm of player.userData.arms||[])arm.rotation.x=0;}
  function beginTask(id,mode){
    stopTask();const item=farm.progress.decorations.find(item=>item.id===id);if(!item)return;
    world.prepareNavigation();const spots=[];for(let i=0;i<12;i++){const angle=i*Math.PI/6,x=item.x+Math.cos(angle)*1.5,z=item.z+Math.sin(angle)*1.5;if(world.canStand(x,z))spots.push({x,z});}
    spots.sort((a,b)=>Math.hypot(a.x-player.position.x,a.z-player.position.z)-Math.hypot(b.x-player.position.x,b.z-player.position.z));
    if(!spots.length){ui.notice(t('farm.decor.noPath'),false);return;}
    task={id,mode,phase:'walk',target:spots[0],elapsed:0,pending:0};world.moveToPoint(task.target.x,task.target.z);ui.notice(mode==='build'?t('farm.decor.walkBuild'):t('farm.decor.walkDemolish'));
  }
  function tick(dt,failed,paused){
    if(!task||paused)return;
    const item=farm.progress.decorations.find(item=>item.id===task.id);if(!item){stopTask();return;}
    if(task.phase==='walk'){if(failed){stopTask();ui.notice(t('farm.decor.routeFailed'),false);return;}if(Math.hypot(player.position.x-task.target.x,player.position.z-task.target.z)>.15)return;task.phase='work';world.stopMovement();}
    if(Math.hypot(player.position.x-item.x,player.position.z-item.z)>1.8){stopTask();return;}
    const step=Math.min(dt,.1)*1000;task.elapsed+=step;task.pending+=step;
    const ratio=task.mode==='build'?Math.min(1,(item.buildMs+task.pending)/item.buildDuration):Math.min(1,task.elapsed/3500);
    player.rotation.y=Math.atan2(item.x-player.position.x,item.z-player.position.z);activity.update(task.mode==='build'?'construct':'dismantle',ratio,performance.now()/1000);
    for(const [i,arm]of (player.userData.arms||[]).entries())arm.rotation.x=-.6+Math.sin(task.elapsed*.015+i)*.4;
    if(task.mode==='build'&&(task.pending>=500||ratio>=1)){
      const result=farm.act('decorations','construct',{id:item.id,ms:Math.min(1000,task.pending)});task.pending=0;sync();if(!result.ok){stopTask();ui.notice(result.message,false);fx('built',result,item);}else if(farm.progress.decorations.find(value=>value.id===item.id)?.state==='complete'){stopTask();ui.notice(t('farm.decor.built'));fx('built',result,item);}
    }else if(task.mode==='demolish'&&ratio>=1){const result=farm.act('decorations','demolish',{id:item.id});stopTask();sync();ui.notice(result.message,result.ok);fx('demolish',result,item);}
  }
  function pick(event,canvas){
    const rect=canvas.getBoundingClientRect();world.scene.updateMatrixWorld(true);world.camera.updateMatrixWorld(true);ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),world.camera);
    const hit=ray.intersectObjects(world.scene.children,true).find(hit=>{if(!hit.object.isMesh)return false;let decor=false;for(let node=hit.object;node;node=node.parent){if(!node.visible)return false;decor=decor||Boolean(node.userData.decorationId);if(node.userData.noPick&&!node.userData.decorationId)return false;}return decor||!hit.object.userData.nonSolid;});
    if(!hit)return false;let node=hit.object;while(node&&!node.userData.decorationId)node=node.parent;if(!node)return false;
    const item=farm.progress.decorations.find(item=>item.id===node.userData.decorationId),spec=DECORATIONS.find(spec=>spec.id===item?.type);if(!item||!spec)return false;
    stopTask();ui.decorationDetails(item,spec,()=>beginTask(item.id,'build'),()=>beginTask(item.id,'demolish'));return true;
  }
  function start(type){clear();const spec=DECORATIONS.find(item=>item.id===type);if(!spec)return;world.stopMovement();draft={type,x:Math.round(player.position.x+2),z:Math.round(player.position.z),rotation:0,text:defaultName.slice(0,24)};input.value=draft.text;input.hidden=type!=='sign';name.textContent=t('farm.decor.panelName',{icon:spec.icon,name:spec.name,price:spec.price});ghost=model(draft);ghost.userData.nonSolid=true;world.scene.add(ghost);panel.hidden=false;update();}
  function locate(event,canvas){
    if(!draft||document.querySelector('dialog[open]'))return;
    const clicked=event.type==='click';if(positionChosen&&!clicked)return;
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    world.camera.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),world.camera);
    if(ray.ray.intersectPlane(plane,point)){draft.x=Math.round(point.x*2)/2;draft.z=Math.round(point.z*2)/2;if(clicked)positionChosen=true;update();}
  }

  rotate.addEventListener('click',()=>{if(draft){draft.rotation=(draft.rotation+Math.PI/2)%(Math.PI*2);update();}},{signal});cancel.addEventListener('click',clear,{signal});input.addEventListener('input',()=>{if(draft){draft.text=input.value.trim().slice(0,24);ghost.removeFromParent();disposeScene(ghost);ghost=model(draft);ghost.userData.nonSolid=true;world.scene.add(ghost);update();}},{signal});
  confirm.addEventListener('click',()=>{if(!draft||!positionChosen||error())return;const saved={...draft,text:input.value.trim().slice(0,24)},spec=DECORATIONS.find(item=>item.id===saved.type);ui.confirmTrade(t('farm.decor.confirmTitle'),t('farm.decor.confirmBody',{name:spec.name+(saved.type==='sign'?` “${saved.text||t('farm.decor.signDefault')}”`:''),price:spec.price}),()=>{const reason=error(saved);if(reason){ui.notice(reason,false);return;}const result=farm.act('decorations','place',saved);ui.notice(result.message,result.ok);fx('place',result,saved);if(result.ok){clear();sync();const item=farm.progress.decorations.at(-1);beginTask(item.id,'build');}},spec.icon,'build');},{signal});
  return {tick,pick,stopTask,get busy(){return Boolean(task);},get working(){return task?.phase==='work';},get active(){return Boolean(draft);},start,clear,sync,locate,key(event){if(!draft||document.querySelector('dialog[open]'))return false;if(event.code==='Escape')clear();else if(event.code==='KeyR')rotate.click();else return false;event.preventDefault();return true;},dispose(){stopTask();activity.dispose();clear();panel.remove();for(const group of placed.values()){group.removeFromParent();disposeScene(group);}placed.clear();}};
}
