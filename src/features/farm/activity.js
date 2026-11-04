import * as THREE from 'three';
import { ACTION_LABELS } from './rules.js';
// Shared world feedback for the player and employees; it stays outside asset geometry/collision.
export function createWorkActivity(parent,personName='') {
  const root=new THREE.Group();root.userData.nonSolid=true;root.userData.noPick=true;parent.add(root);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});
  const badge=new THREE.Sprite(material);badge.position.y=2.75;badge.scale.set(1.8,.9,1);root.add(badge);
  const tool=new THREE.Group();tool.position.set(.5,.85,.2);root.add(tool);
  const geometries=[],materials=[],parts=new Map();
  function part(name,color,geometry,scale,position){const m=new THREE.MeshStandardMaterial({color,roughness:.8}),object=new THREE.Mesh(geometry,m);object.scale.set(...scale);object.position.set(...position);object.userData.nonSolid=true;tool.add(object);geometries.push(geometry);materials.push(m);if(!parts.has(name))parts.set(name,[]);parts.get(name).push(object);}
  part('water','#64a7c5',new THREE.CylinderGeometry(.13,.16,.25,10),[1,1,1],[0,0,0]);part('water','#64a7c5',new THREE.BoxGeometry(1,1,1),[.3,.05,.05],[.15,.05,0]);
  part('plant','#6b9b47',new THREE.SphereGeometry(1,8,6),[.13,.06,.09],[0,.12,0]);part('plant','#8b6b41',new THREE.BoxGeometry(1,1,1),[.04,.25,.04],[0,0,0]);
  for(const name of ['weed','prune','clear','construct','dismantle']){part(name,'#987044',new THREE.BoxGeometry(1,1,1),[.04,.65,.04],[0,0,0]);part(name,'#8caaa2',new THREE.BoxGeometry(1,1,1),[.24,.08,.12],[.08,.29,0]);}
  for(const name of ['harvest','collect','start','turn','shipOrder','fertilize','feedFish'])part(name,name==='fertilize'?'#93a75a':'#b58c55',new THREE.CylinderGeometry(.18,.12,.25,8),[1,1,1],[0,0,0]);
  const bonusCanvas=document.createElement('canvas');bonusCanvas.width=256;bonusCanvas.height=96;
  const bonusTexture=new THREE.CanvasTexture(bonusCanvas);bonusTexture.colorSpace=THREE.SRGBColorSpace;
  const bonusMaterial=new THREE.SpriteMaterial({map:bonusTexture,transparent:true,depthWrite:false});
  const bonus=new THREE.Sprite(bonusMaterial);bonus.position.y=3.5;bonus.scale.set(1.65,.62,1);bonus.userData.bonus=true;bonus.userData.nonSolid=true;bonus.visible=false;parent.add(bonus);let bonusPrice=null;
  let lastKey='';root.visible=false;
  // Worker plates use the shared dark nameplate colours (--ui-nameplate-bg / -ink) like every world label.
  return {
    setBonus(price){
      bonus.visible=price!==null;if(price===null||price===bonusPrice)return;bonusPrice=price;
      const ctx=bonusCanvas.getContext('2d');ctx.clearRect(0,0,256,96);ctx.fillStyle='#3b2a1cd9';ctx.strokeStyle='#d9a944';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(4,4,248,85,30);ctx.fill();ctx.stroke();ctx.fillStyle='#69411f';ctx.font='bold 32px system-ui';ctx.textAlign='center';ctx.fillStyle='#f7ca46';ctx.strokeStyle='#b9801d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(35,47,18,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#98611b';ctx.font='bold 24px Georgia';ctx.fillText('₫',35,55);ctx.fillStyle='#fff6dc';ctx.font='bold 29px system-ui';ctx.fillText(`${price} · Làm tiếp`,148,58,188);bonusTexture.needsUpdate=true;
    },
    status(text,fatigue=0){
      root.visible=true;tool.visible=false;const value=Math.round(fatigue),key=`status:${text}:${value}`;if(key===lastKey)return;lastKey=key;
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,128);ctx.fillStyle='#3b2a1cd9';ctx.beginPath();ctx.roundRect(3,3,250,120,18);ctx.fill();ctx.textAlign='center';ctx.fillStyle=value>=80?'#a94d31':'#634627';// Workers no longer tire: name + current job only, larger and darker for phones.
      ctx.fillStyle='#fff6dc';ctx.font='900 28px system-ui';ctx.fillText(personName,128,36,235);ctx.font='bold 22px system-ui';const short=text.split('→');ctx.fillText(short[0],128,72,235);if(short[1])ctx.fillText('→ '+short[1],128,100,235);texture.needsUpdate=true;
    },
    update(action,progress=0,time=0,fatigue=0){
      root.visible=Boolean(action);if(!action)return;tool.visible=true;
      for(const [name,objects]of parts)for(const o of objects)o.visible=name===action;
      tool.rotation.z=Math.sin(time*6)*.3;tool.rotation.x=action==='water'?-.5:Math.sin(time*5)*.15;
      const ratio=Math.max(0,Math.min(1,progress)),key=`${action}:${Math.round(ratio*50)}:${Math.round(fatigue)}`;
      if(key===lastKey)return;lastKey=key;
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,128);ctx.fillStyle='#3b2a1cd9';ctx.strokeStyle='#a78048';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(5,8,246,103,20);ctx.fill();ctx.stroke();ctx.fillStyle='#fff6dc';ctx.font='bold 26px system-ui';ctx.textAlign='center';ctx.fillText(ACTION_LABELS[action]||'Làm việc',128,48);if(personName){ctx.font='18px system-ui';ctx.fillText(personName,128,105,235);}ctx.fillStyle='#695139';ctx.beginPath();ctx.roundRect(25,68,206,17,8);ctx.fill();ctx.fillStyle='#8fbd59';ctx.beginPath();ctx.roundRect(28,71,Math.max(5,200*ratio),11,5);ctx.fill();texture.needsUpdate=true;
    },
    dispose(){bonus.removeFromParent();bonusTexture.dispose();bonusMaterial.dispose();root.removeFromParent();texture.dispose();material.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());},
  };
}
