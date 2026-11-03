import test from 'node:test';
import assert from 'node:assert/strict';
import { avoidanceStep } from '../src/shared/game/collision.js';

const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const open=()=>true;

test('a worker already overlapping the player can move out instead of freezing',()=>{
  const player={x:0,z:0},worker={x:.3,z:0};
  for(let i=0;i<30&&gap(worker,player)<.96;i++){
    const before=gap(worker,player),next=avoidanceStep(worker,player,[player],.06,open);
    assert.ok(next);assert.ok(gap(next,player)>before);Object.assign(worker,next);
  }
  assert.ok(gap(worker,player)>=.96);
});

test('workers at exactly the same position separate without teleporting',()=>{
  const other={x:0,z:0},worker={x:0,z:0};
  for(let i=0;i<40&&gap(worker,other)<.96;i++){
    const next=avoidanceStep(worker,other,[other],.06,open);
    assert.ok(next);assert.ok(gap(next,worker)<=.060001);Object.assign(worker,next);
  }
  assert.ok(gap(worker,other)>=.96);
});

test('a blocked sidestep finds another free direction and never enters a wall',()=>{
  const worker={x:.5,z:0},other={x:0,z:0},stand=(x,z)=>z>=0&&x<=.51;
  const next=avoidanceStep(worker,other,[other],.06,stand);
  assert.ok(next);assert.ok(stand(next.x,next.z));assert.ok(gap(next,other)>gap(worker,other));
});

test('avoidance respects a third person and returns no move when fully enclosed',()=>{
  const worker={x:1,z:0},other={x:0,z:0},third={x:1.05,z:.98};
  const next=avoidanceStep(worker,other,[other,third],.06,open);
  assert.ok(next);assert.ok(gap(next,third)>=.96);
  assert.equal(avoidanceStep(worker,other,[other],.06,()=>false),null);
});

test('two approaching workers pass each other and reach their destinations',()=>{
  const workers=[{x:-1,z:0},{x:1,z:0}],targets=[{x:2,z:0},{x:-2,z:0}];
  for(let frame=0;frame<600;frame++){
    workers.forEach((worker,i)=>{
      const target=targets[i],other=workers[1-i],distance=gap(worker,target);
      if(distance<.05)return;
      const step=Math.min(distance,.04),next={x:worker.x+(target.x-worker.x)/distance*step,z:worker.z+(target.z-worker.z)/distance*step};
      if(gap(next,other)>=.85)Object.assign(worker,next);
      else if(i===1){const escape=avoidanceStep(worker,other,[other],.04,open);if(escape)Object.assign(worker,escape);}
    });
    assert.ok(gap(...workers)>=.85);
  }
  workers.forEach((worker,i)=>assert.ok(gap(worker,targets[i])<.05));
});

test('the crew update loop escapes an overlapping player and resumes its walking state',async()=>{
  const {createFarm}=await import('../src/features/farm/model.js');
  const {createFarmCrew}=await import('../src/features/farm/crew.js');
  const THREE=await import('three');
  const previousDocument=globalThis.document;
  // Canvas drawing is irrelevant to movement; keep the real crew and farm logic.
  globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{},set:()=>true})})};
  let crew;
  try{
    const at=Date.now(),farm=createFarm(null,'capital',()=>{},at);
    farm.act('workers','hire','an',at);farm.act('workers','startWork','an',at);
    const scene=new THREE.Scene(),player={position:new THREE.Vector3(-1.8,.05,-6)};
    const world={scene,prepareNavigation(){},setWorkerTargets(){},canStand:()=>true,
      getInteraction:()=>({position:[3,-6]}),
      *createWorkerRoute(){return [{x:3,z:-6}];},
      atInteraction:(_id,position)=>Math.hypot(position.x-3,position.z+6)<.15};
    crew=createFarmCrew(farm,world,player);
    crew.update(.02,at);
    const actor=scene.children.find(group=>group.userData.workerId==='an');
    assert.ok(actor);const start=actor.position.clone();
    for(let frame=1;frame<=100;frame++)crew.update(.02,at+frame*20);
    assert.ok(actor.position.distanceTo(start)>.9,'worker must physically move away from the player');
    assert.ok(Math.hypot(actor.position.x-player.position.x,actor.position.z-player.position.z)>=.85);
    assert.match(farm.progress.workers[0].state,/^Đi /,'walking must replace the stale avoidance message');
  }finally{crew?.dispose();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});
