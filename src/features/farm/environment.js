import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FIELDS, MACHINES, FARM_BOUNDS } from './content.js';
import { ASSET_TIERS, assetTier } from './rules.js';

// Solid groups (fences): draw one merged mesh per color, but keep the original meshes as colliders with an invisible
// material (same trick as tree trunks) so walking and pathfinding see exactly the same obstacles.
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
function bakeSolid(group) {
  const byMaterial = new Map();
  for (const o of group.children) if (o.isMesh && o.material !== HIDDEN) (byMaterial.get(o.material) || byMaterial.set(o.material, []).get(o.material)).push(o);
  for (const [material, parts] of byMaterial) {
    if (parts.length < 2) continue;
    const geometries = parts.map(o => { o.updateMatrix(); return o.geometry.clone().applyMatrix4(o.matrix); });
    const visual = new THREE.Mesh(mergeGeometries(geometries), material);
    visual.castShadow = true; visual.receiveShadow = true; visual.userData.nonSolid = true;
    for (const g of geometries) g.dispose();
    for (const o of parts) { o.material = HIDDEN; o.castShadow = o.receiveShadow = false; }
    group.add(visual);
  }
}
// Bake several static meshes sharing one material into a single mesh under `parent` (same transform space).
function mergeMeshes(parent, parts) {
  parts = parts.filter(o => o.isMesh);
  if (parts.length < 2) return;
  const geometries = parts.map(o => { o.updateMatrix(); return o.geometry.clone().applyMatrix4(o.matrix); });
  const merged = new THREE.Mesh(mergeGeometries(geometries), parts[0].material);
  merged.castShadow = parts[0].castShadow; merged.receiveShadow = parts[0].receiveShadow; merged.userData = { ...parts[0].userData };
  for (const o of parts) parent.remove(o);
  for (const g of geometries) g.dispose();
  parent.add(merged);
}

function roundedSoil() {
  const shape = new THREE.Shape(), edge = .64, corner = .12;
  shape.moveTo(-edge+corner,-edge); shape.lineTo(edge-corner,-edge);
  shape.quadraticCurveTo(edge,-edge,edge,-edge+corner); shape.lineTo(edge,edge-corner);
  shape.quadraticCurveTo(edge,edge,edge-corner,edge); shape.lineTo(-edge+corner,edge);
  shape.quadraticCurveTo(-edge,edge,-edge,edge-corner); shape.lineTo(-edge,-edge+corner);
  shape.quadraticCurveTo(-edge,-edge,-edge+corner,-edge);
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:true,bevelSize:.025,bevelThickness:.015,bevelSegments:2,steps:1,curveSegments:4});
  geometry.rotateX(-Math.PI/2); return geometry;
}

// Placeholder assemblies keep their gameplay roots and asset slots when art is replaced.
export function buildFarmActor({ npc, visual, box, mesh, sphere, cube, assetSlot }) {
  if (npc.kind === 'field') {
    assetSlot(visual, `farm/${npc.id}/sign`);
    box('#8f7956', 0, .5, 0, .12, 1, .12, visual);
    box('#d1b982', 0, .9, 0, 1.2, .6, .1, visual);
    return {};
  }
  if (npc.kind === 'plot') {
    const bed = assetSlot(new THREE.Group(), `farm/${npc.id}/bed`); visual.add(bed); bed.userData.nonSolid = true;
    const soil = mesh(roundedSoil(), '#865b37', 0, .035, 0, 1, 1, 1, bed);
    const drySoil = { material: soil.material };
    const wetSoil = box('#59412c', 0, 0, 0, .01, .01, .01, bed); wetSoil.visible = false;
    const lockedSoil = box('#84935f', 0, 0, 0, .01, .01, .01, bed); lockedSoil.visible = false;
    const furrows = new THREE.Group(); bed.add(furrows);
    for (const z of [-.42,-.14,.14,.42]) box('#a57b4b', 0, .106, z, 1.07, .018, .045, furrows);
    // Wrapper giữ tỉ lệ lớn/hoa; chỉ slot con `art` được thay model nên hoa vẫn còn sau khi gắn GLB.
    const crop = new THREE.Group(); visual.add(crop);
    const art = assetSlot(new THREE.Group(), `farm/${npc.id}/crop`); crop.add(art);
    box('#766043', 0, .65, 0, .1, 1.2, .1, art);
    for (const [x,y,z] of [[-.2,.65,0],[.2,.85,0],[-.12,1.1,.12],[.15,1.3,-.1]]) {
      const leaves = mesh(sphere, '#4f7c43', x, y, z, .35, .26, .35, art); leaves.userData.nonSolid = true;
    }
    for (const name of ['fruit_green', 'fruit_ripe']) {
      const fruits = new THREE.Group(); fruits.name = name; fruits.userData.nonSolid = true; art.add(fruits);
      for (const x of [-.22,0,.22]) mesh(sphere, name === 'fruit_ripe' ? '#b75a3a' : '#7e9c49', x, 1.1, .23, .09, .11, .09, fruits);
    }
    const flowers=new THREE.Group();flowers.name='blossoms';flowers.userData.nonSolid=true;crop.add(flowers);for(const x of [-.23,0,.23])mesh(sphere,'#fff5dd',x,1.06,.26,.065,.065,.065,flowers);
    const weeds = new THREE.Group(); weeds.name = 'weeds'; weeds.userData.nonSolid = true; visual.add(weeds);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const grass = box('#748744', Math.cos(angle) * .53, .18, Math.sin(angle) * .53, .055, .28, .055, weeds); grass.rotation.z = i % 2 ? .35 : -.35;
    }
    // Mobile: tiny or flat parts (soil, furrows, fruit, flowers, weeds) need no shadow pass; trunk and leaves still cast.
    for (const group of [bed, flowers, weeds, ...art.children.filter(o => o.name.startsWith('fruit_'))]) group.traverse(o => { o.castShadow = false; });
    // Mobile draw calls: 48 plots × ~28 meshes was ~730 calls/frame. Same-color parts of one plot become one mesh; groups keep their names/visibility.
    for (const group of [furrows, weeds, flowers, ...art.children.filter(o => o.name.startsWith('fruit_'))]) mergeMeshes(group, group.children);
    mergeMeshes(art, art.children.filter(o => o.isMesh && o.userData.nonSolid));
    return {
      crop, pickSurface: soil,
      setState(plot) {
        furrows.visible = plot.unlocked;
        crop.visible = plot.unlocked && plot.stage !== 'empty'; weeds.visible = plot.unlocked && plot.weeds >= 15;
        weeds.scale.y = .5 + plot.weeds / 100;flowers.visible=plot.mature&&plot.stage!=='ready'&&(plot.growthRatio||0)>=.17&&(plot.growthRatio||0)<.25;
        crop.scale.setScalar(plot.mature ? .65 : plot.stage === 'planted' ? .22 : .22 + Math.min(1, plot.growthRatio || 0) * .43);
        crop.traverse(object => { if (object.name === 'fruit_ripe') object.visible = plot.stage === 'ready'; if (object.name === 'fruit_green') object.visible = plot.stage === 'growing' && (plot.growthRatio || 0) > .65; });
        soil.material = plot.unlocked ? (plot.water >= 30 ? wetSoil.material : drySoil.material) : lockedSoil.material;
      },
    };
  }
  if(npc.kind==='pond'){
    visual.userData.nonSolid=true;
    box('#659fa6',0,.17,0,3.8,.015,2,visual).userData.nonSolid=true;
    const fish=new THREE.Group();fish.userData.nonSolid=true;visual.add(fish);
    for(const x of [-.7,.7])mesh(sphere,'#d9b36c',x,.18,.15,.18,.04,.07,fish);
    return {setState(state){fish.visible=state.fish>0;}};
  }
  if(npc.kind==='council')return buildCouncilGate({npc,visual,box,mesh,sphere,assetSlot});
  if(BUILDING_KINDS.includes(npc.kind))return buildFarmBuilding({npc,visual,box,mesh,sphere,assetSlot});
  assetSlot(visual, `farm/${npc.id}`);
  const color = npc.color;
  const rank=assetSlot(new THREE.Group(),`farm/${npc.id}/upgrade-markers`);rank.userData.nonSolid=true;visual.add(rank);
  const badges=[];for(let i=0;i<ASSET_TIERS.length;i++){const marker=box(['#d0ad68','#b6c0b9','#f0ce62','#9fc3d9','#e6a1c0'][i],-.3+i*.15,.2,npc.kind==='well'?1:1.6,.1,.1,.1,rank);badges.push(marker);}
  // Tier 1 is the current placeholder; tiers 2+ start as copies with pennants. Replace `farm/<id>/tier-<n>` with real art later.
  const base=assetSlot(new THREE.Group(),`farm/${npc.id}/tier-1`);visual.add(base);
  if (npc.kind === 'well') {
    mesh(new THREE.SphereGeometry(1, 12, 8), '#91a8a2', 0, .3, 0, .9, .35, .9, base);
    for (const x of [-.8,.8]) box('#9b805b', x, 1.3, 0, .12, 2.4, .12, base);
    box('#b7a071', 0, 2.4, 0, 2, .2, 1.2, base);
    box('#cad5c3', .2, 1.1, .4, .35, .4, .35, base);
  } else if (npc.kind === 'dryer') {
    for (const x of [-1.45,1.45]) for (const z of [-1,1]) box('#8c704c',x,1.1,z,.09,2.2,.09,base);
    box('#ecd4a0',0,2.2,0,3.2,.12,2.4,base);
    box('#ad9264', 0, .55, 0, 2.8, .2, 2, base);
    for (const x of [-1.2,1.2]) for (const z of [-.8,.8]) box('#8f7959', x, .25, z, .1, .5, .1, base);
    const beans = new THREE.Group(); beans.name = 'beans'; beans.userData.nonSolid = true; base.add(beans); // cùng tên nhóm với GLB, ẩn khi giàn trống
    for (let i = 0; i < 24; i++) mesh(sphere, '#ac7550', -1.1 + (i % 6) * .42, .72, -.65 + Math.floor(i / 6) * .42, .1, .08, .1, beans);
  } else {
    box('#d4c6a6', 0, 1.2, -.15, 3.4, 2.4, 2.8, base);
    const roof = mesh(new THREE.ConeGeometry(2.65, 1.1, 4), color, 0, 2.95, -.15, 1, 1, .9, base); roof.rotation.y = Math.PI / 4;
    box('#6a6554', 0, .8, 1.29, .95, 1.6, .08, base);
    for (const x of [-1.05, 1.05]) {
      box('#879b8b', x, 1.45, 1.3, .6, .65, .05, base);
      box('#e5d5aa', x, 1.45, 1.35, .035, .65, .04, base);
    }
    if (npc.kind === 'roaster') {
      box('#756b58', .95, 3.2, -.5, .4, 1.4, .4, base);
      box('#c0925e', -.75, .4, 1.55, .65, .65, .4, base);
    } else {
      const wheel = mesh(new THREE.TorusGeometry(.4, .08, 6, 16), '#85937a', 1.1, 1.5, 1.36, 1, 1, 1, base);
      box('#c9ac76', -.8, .3, 1.6, .6, .5, .5, base);
    }
  }
  const tiers=[base];
  for(let n=2;n<=ASSET_TIERS.length;n++){
    const group=assetSlot(base.clone(),`farm/${npc.id}/tier-${n}`);group.visible=false;visual.add(group);
    const accent=['#3f9d55','#e2a312','#2f7fc1','#c4462a'][n-2];
    box('#6b4f32',1.7,2.2,1.3,.08,4.4,.08,group).userData.nonSolid=true;
    for(let f=0;f<n-1;f++)box(accent,2.02,4.15-f*.36,1.3,.6,.3,.04,group).userData.nonSolid=true;
    tiers.push(group);
  }
  function setUpgrade(level){const tier=assetTier(level);tiers.forEach((group,i)=>{group.visible=i===tier-1;});badges.forEach((b,i)=>{b.visible=i<tier;});}
  return {setUpgrade, setState(state){if('filled' in state)visual.traverse(object=>{if(object.name==='beans')object.visible=state.filled;});}};
}

export function buildFarmEnvironment({ scene, box, mesh, sphere, assetSlot }) {
  // Short, bounded paths tie the working areas together without extending beyond the farm.
  const paths = assetSlot(new THREE.Group(), 'farm/paths'); paths.userData.nonSolid = true; scene.add(paths);
  function pavedRun(x1,z1,x2,z2,width=1.25) {
    const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz),steps=Math.ceil(length/.85);
    const strip=box('#b3a482',(x1+x2)/2,.005,(z1+z2)/2,width,.025,length+.25,paths); strip.rotation.y=Math.atan2(dx,dz);
    for(let i=0;i<steps;i++) {
      const t=(i+.5)/steps;
      for(const side of [-1,1]) {
        const x=x1+dx*t+dz/length*side*width*.23,z=z1+dz*t-dx/length*side*width*.23;
        const tile=box(i%2 ? '#ded0ad' : '#d0c09b',x,.025,z,width*.43,.025,length/steps-.08,paths); tile.rotation.y=Math.atan2(dx,dz);
      }
    }
  }
  pavedRun(-2,-9,-2,1);
  pavedRun(-11.5,.1,8,.1);
  pavedRun(-15,-8.4,-4,-8.4);
  pavedRun(-4,-8.4,8,-8.1);
  pavedRun(3.2,-8.1,3.2,.1);
  pavedRun(8.5,-8.1,8.5,.1,1);
  pavedRun(-4,-8.1,-4,-.4,1);
  for (const station of MACHINES) box('#b8ac8c',station.position[0],.005,station.position[1]+.35,4.3,.025,3.8,paths);
  const pond = assetSlot(new THREE.Group(), 'farm/pond'); pond.position.set(0,0,-15.5); scene.add(pond);
  box('#84795b',0,.06,0,4.4,.12,2.6,pond);
  box('#659fa6',0,.13,0,4,.025,2.2,pond);
  const glints = new THREE.Group(); glints.userData.nonSolid = true; pond.add(glints);
  for (const [x,z] of [[-.9,-.4],[.7,.3],[-.2,.6]]) box('#b0d5ce',x,.15,z,.5,.01,.035,glints);
  // Continuous low banks stop walking into the water; the well is outside the fence.
  for (const z of [-1.35,1.35]) box('#a08c65',0,.23,z,4.6,.42,.14,pond);
  for (const x of [-2.3,2.3]) box('#a08c65',x,.23,0,.14,.42,2.8,pond);
  for (const z of [-1.5,1.5]) {
    for (const x of [-2.45,0,2.45]) box('#8a6843',x,.45,z,.12,.9,.12,pond);
    for (const y of [.35,.65]) box('#b28e5e',0,y,z,4.9,.08,.08,pond);
  }
  for (const x of [-2.45,2.45]) for (const y of [.35,.65]) box('#b28e5e',x,y,0,.08,.08,3,pond);
  // Cảnh nền ngoài rào (đồi, rừng, núi): chỉ để nhìn, không chặn đường.
  const surroundings = assetSlot(new THREE.Group(), 'farm/surroundings'); surroundings.userData.nonSolid = true; scene.add(surroundings);
  const boundary = assetSlot(new THREE.Group(), 'farm/boundary'); scene.add(boundary);
  const fenceRun = (x1,z1,x2,z2) => {
    const length = Math.hypot(x2-x1,z2-z1), spans = Math.ceil(length/2);
    for (let i=0;i<=spans;i++) box('#927049',x1+(x2-x1)*i/spans,.4,z1+(z2-z1)*i/spans,.1,.8,.1,boundary);
    for (const y of [.3,.6]) {
      const rail = box('#b49363',(x1+x2)/2,y,(z1+z2)/2,.07,.07,length,boundary);
      rail.rotation.y = Math.atan2(x2-x1,z2-z1);
    }
  };
  const left = FARM_BOUNDS.minX+.6, right = FARM_BOUNDS.maxX-.6;
  const back = FARM_BOUNDS.minZ+.6, front = FARM_BOUNDS.maxZ-.6;
  fenceRun(left,back,right,back); fenceRun(left,back,left,front); fenceRun(right,back,right,front);
  fenceRun(left,front,right,front);
  bakeSolid(boundary);
  const grounds = new Map();
  for (const field of FIELDS) {
    const group = assetSlot(new THREE.Group(), `farm/${field.id}/terrain`); group.position.set(field.center[0], 0, field.center[1]); group.visible = false; scene.add(group);
    box('#94ac76', 0, -.015, 0, field.footprint.halfWidth*2, .025, field.footprint.halfDepth*2, group);
    const fence = assetSlot(new THREE.Group(),`farm/${field.id}/fence`); group.add(fence);
    function rail(x1,z1,x2,z2) {
      const length=Math.hypot(x2-x1,z2-z1), count=Math.ceil(length/1.6);
      for(let i=0;i<=count;i++) box('#977346',x1+(x2-x1)*i/count,.28,z1+(z2-z1)*i/count,.065,.56,.065,fence);
      for(const y of [.22,.42]){const beam=box('#bc9763',(x1+x2)/2,y,(z1+z2)/2,.045,.045,length,fence);beam.rotation.y=Math.atan2(x2-x1,z2-z1);}
    }
    // Openings on all four sides preserve access to the inner planting lanes.
    const halfX=field.footprint.halfWidth+.4,halfZ=field.footprint.halfDepth+.4,gate=1.1;
    for(const z of [-halfZ,halfZ]) {rail(-halfX,z,-gate,z);rail(gate,z,halfX,z);}
    for(const x of [-halfX,halfX]) {rail(x,-halfZ,x,-gate);rail(x,gate,x,halfZ);}
    bakeSolid(fence);
    const gates=assetSlot(new THREE.Group(),`farm/${field.id}/gates`);fence.add(gates);
    for(const z of [-halfZ,halfZ]) box('#aa8554',0,.28,z,gate*2,.48,.07,gates);
    for(const x of [-halfX,halfX]) box('#aa8554',x,.28,0,.07,.48,gate*2,gates);


    grounds.set(field.id, {group,gates});
  }
  const upgradeDecor=new Map();
  for(const id of ['soil','fence','pond','well']){
    const group=assetSlot(new THREE.Group(),`farm/upgrades/${id}`);group.userData.nonSolid=true;scene.add(group);
    const markers=[];
    const anchors={house:[-1.5,-6],soil:[-7.4,-3.1],fence:[-18.5,2.8],pond:[0,-15.5],well:[-16.8,-8.4],tools:[-2,-6],storage:[-1,-6],delivery:[-.4,-6]};const [x,z]=anchors[id];
    for(let i=0;i<3;i++)markers.push(box(['#d2a96c','#bccac0','#f2ce65'][i],x+i*.18,.13,z,.12,.12,.12,group));upgradeDecor.set(id,markers);
  }
  return {setUpgrades(upgrades){for(const [id,markers]of upgradeDecor)markers.forEach((m,i)=>{m.visible=assetTier(upgrades[id])>=i+2;});}, setFields(ids) { for (const [id, {group,gates}] of grounds) { group.visible = true; group.userData.nonSolid = false; gates.visible = !ids.includes(id); } } };

}

// Cổng Hội đồng (05/11/2026, F-45, đề xuất Q1 R6 + vá): khung cổng + 3 bệ; bóng chuyên gia hiện khi người đó có mặt,
// quả cầu sáng nhấp nhô khi có người đang chờ ('Mới'). Lần đầu hiện thì trồi lên từ mặt đất. Khối tạm, thay asset ở slot farm/council.
const EXPERT_COLORS={growing:'#70946c',brewing:'#b28b53',business:'#788ba6'};
function buildCouncilGate({visual,box,mesh,sphere,assetSlot}){
  const art=assetSlot(new THREE.Group(),'farm/council');visual.add(art);
  for(const x of [-1.5,1.5]){box('#cdbb8f',x,1.5,0,.34,3,.34,art);box('#a8946a',x,.12,0,.6,.24,.6,art);}
  box('#d9bd7b',0,3.12,0,3.7,.28,.52,art).userData.nonSolid=true;
  box('#efe0b8',0,3.4,0,1.3,.3,.2,art).userData.nonSolid=true;
  const step=box('#e2d3ae',0,.06,.2,2.5,.12,1,art);step.userData.nonSolid=true;
  // Bệ và bóng chuyên gia: không chặn lối (nonSolid), một ConeGeometry dùng chung cho ba bóng.
  const cone=new THREE.ConeGeometry(.28,.8,10),figures={},checks={};
  [['growing',-.85],['brewing',0],['business',.85]].forEach(([id,x])=>{
    box('#c7b58c',x,.22,.25,.5,.2,.5,art).userData.nonSolid=true;
    const figure=new THREE.Group();figure.userData.nonSolid=true;figure.position.set(x,.32,.25);art.add(figure);
    mesh(cone,EXPERT_COLORS[id],0,.4,0,1,1,1,figure);mesh(sphere,EXPERT_COLORS[id],0,.92,0,.22,.24,.22,figure);
    figure.visible=false;figures[id]=figure;
    // ✓ của chuyên gia (Q1 R13): hạt vàng trên đầu bóng khi đủ câu của người đó trong met.
    const check=mesh(sphere,'#ffd34d',0,1.32,0,.11,.11,.11,figure);check.visible=false;checks[id]=check;
  });
  const beacon=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color:'#ffe17a'}));beacon.scale.setScalar(.26);beacon.position.set(0,2.45,0);beacon.userData.nonSolid=true;beacon.visible=false;art.add(beacon);
  let rise=1;
  return {
    // present: id chuyên gia đã có mặt; done: đủ câu trong met (✓); waiting: có người đang chờ (chấm Mới); raise: chạy hiệu ứng dựng cổng một lần.
    setState({present=[],done=[],waiting=false,raise=false}){for(const [id,f] of Object.entries(figures)){f.visible=present.includes(id);checks[id].visible=done.includes(id);}beacon.visible=waiting;if(raise)rise=0;},
    update(dt,time){
      if(rise<1){rise=Math.min(1,rise+dt/1.2);art.position.y=-3.6*(1-rise)**3;}
      if(beacon.visible)beacon.position.y=2.45+Math.sin(time*3)*.12;
    },
  };
}

// Công trình pha 1 (05/11/2026, F-48, đề xuất Q10 CT-1/CT-10): khối tạm thể hiện chức năng, trạng thái và điểm tương tác,
// mặt trước quay +z về camera. Cửa quán: mặt tiền + mái hiên + thảm cửa (chỗ đứng), đèn sáng khi quán mở. Bảng đơn: tờ đơn
// = số đơn chờ (tối đa 4), dấu xanh khi có đơn giao được. Sạp: quầy + bao hạt, cờ đỏ khi hết giống mà còn ô trống. Nhà thợ:
// mái nhọn, ghế trước cửa có bóng thợ đang nghỉ (chưa điều/tạm dừng). Lần đầu hiện thì trồi lên. Thay asset ở slot farm/<id>/art.
const BUILDING_KINDS=['cafe-entrance','order-board','shop','crew-house'];
function buildFarmBuilding({npc,visual,box,mesh,sphere,assetSlot}){
  const art=assetSlot(new THREE.Group(),`farm/${npc.id}/art`);visual.add(art);
  const flat=object=>{object.userData.nonSolid=true;object.castShadow=false;return object;};
  const figure=(x,z,color)=>{const g=new THREE.Group();g.userData.nonSolid=true;g.position.set(x,0,z);art.add(g);box(color,0,.55,0,.34,.5,.26,g);mesh(sphere,'#e8c39a',0,.95,0,.17,.17,.17,g);g.visible=false;return g;};
  let height=2.8,apply=()=>{};
  if(npc.kind==='cafe-entrance'){
    box('#efe2c4',0,1,-.1,2.2,2,1,art);box('#8d5a3b',0,2.12,-.1,2.4,.24,1.2,art);
    flat(box('#5b3b28',0,.72,.42,.72,1.42,.06,art));
    for(let i=0;i<4;i++)flat(box(i%2?'#f4ead6':'#c0583e',-.75+i*.5,1.62,.6,.5,.1,.42,art));
    flat(box('#6b4630',0,2.62,0,.62,.52,.1,art));flat(box('#f4ead6',-.04,2.6,.06,.3,.26,.04,art));flat(box('#f4ead6',.16,2.62,.06,.08,.14,.04,art)); // biển ly
    flat(box('#a5714a',0,.03,1.15,1.1,.04,.6,art)); // thảm cửa = chỗ đứng để vào quán
    const lamp=flat(mesh(sphere,'#ffd56a',.55,1.3,.5,.1,.1,.1,art));
    apply=s=>{if('open' in s)lamp.visible=s.open;};
  }else if(npc.kind==='order-board'){
    height=2.3;
    for(const x of [-.62,.62])box('#7d6243',x,.95,0,.1,1.9,.1,art);
    box('#b88d58',0,1.3,0,1.4,.9,.08,art);flat(box('#8d5a3b',0,1.9,0,1.6,.12,.3,art));
    const notes=[[-.4,1.45],[0,1.45],[.4,1.45],[-.2,1.1]].map(([x,y])=>{const n=flat(box('#f6eed8',x,y,.05,.3,.3,.02,art));n.visible=false;return n;});
    const check=flat(box('#5f9a52',.4,1.08,.06,.26,.26,.03,art));check.visible=false;
    apply=s=>{if('notes' in s)notes.forEach((n,i)=>{n.visible=i<s.notes;});if('ready' in s)check.visible=s.ready;};
  }else if(npc.kind==='shop'){
    box('#b18d60',0,.5,0,2.2,1,.9,art);flat(box('#e8d7a8',0,.6,.46,1.6,.3,.03,art)); // mặt quầy = chỗ mua
    for(const x of [-1.05,1.05])for(const z of [-.4,.4])box('#877455',x,1.45,z,.08,.9,.08,art);
    for(let i=0;i<4;i++)flat(box(i%2?'#f1e3bd':npc.color,-.825+i*.55,1.95,0,.55,.1,1.1,art));
    for(const [x,c] of [[-.6,'#d6bc86'],[0,'#c7ad74'],[.6,'#d6bc86']]){flat(box(c,x,1.2,0,.42,.4,.36,art));flat(box('#7d8b60',x,1.42,0,.18,.06,.18,art));}
    const flag=flat(box('#c4462a',1.05,2.35,.4,.3,.2,.03,art));flag.visible=false;
    apply=s=>{if('need' in s)flag.visible=s.need;};
  }else{
    height=3.2;
    box('#d9c7a2',0,.9,-.15,2,1.8,1.1,art);
    const roof=mesh(new THREE.ConeGeometry(1.6,1,4),npc.color,0,2.3,-.15,1,1,.75,art);roof.rotation.y=Math.PI/4;roof.userData.nonSolid=true; // mái chìa rộng: không chặn lối, thân nhà là collider
    flat(box('#6a5442',0,.65,.42,.6,1.3,.06,art));
    flat(box('#a98a5c',0,.28,.75,1.6,.12,.36,art)); // ghế nghỉ trước cửa
    flat(box('#8f7959',.95,.9,.5,.06,1.6,.06,art));flat(box('#9aa0a0',.95,1.62,.5,.32,.08,.06,art)); // cuốc dựng tường
    const resting=[figure(-.45,.75,'#4f7c43'),figure(.35,.75,'#788ba6')];
    apply=s=>{if('resting' in s)resting.forEach((f,i)=>{f.visible=i<s.resting;});};
  }
  let rise=1;
  return {
    setState(s){apply(s);if(s.raise)rise=0;},
    update(dt){if(rise<1){rise=Math.min(1,rise+dt/1.2);art.position.y=-height*(1-rise)**3;}},
  };
}
