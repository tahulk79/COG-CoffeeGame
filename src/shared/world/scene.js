import * as THREE from 'three';
import { createPerson } from '../../characters/player.js';
import { createPlayerMotion } from '../../characters/motion.js';
import { disposeScene } from '../three/dispose-scene.js';
import { findRoute } from '../game/navigation.js';
import { canOccupy, slideMove } from '../game/collision.js';

export function createAdventureScene(character, { interactions: inputInteractions, theme = 'heaven', mapBounds = null, buildActor = null, buildEnvironment = null }) {
  const NPCS = inputInteractions.map(item => ({ ...item, position: [...item.position] }));
  const farming = theme === 'farm';
  const portalPosition = NPCS.find(npc => npc.id === 'portal')?.position || [0, 10];
  const halfWidth = farming ? 26 : 21;
  const farZ = farming ? -24 : -20;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(farming ? '#dcebd4' : '#ecf1e6');
  scene.fog = farming ? null : new THREE.Fog('#ecf1e6',30,65);
  // Parallel projection keeps distant trees as legible as nearby trees.
  const camera = farming ? new THREE.OrthographicCamera(-6.8,6.8,6.8,-6.8,.1,90) : new THREE.PerspectiveCamera(43,1,.1,90);
  scene.add(new THREE.HemisphereLight('#fff8e3', '#94ac99', 2.8));
  const sun = new THREE.DirectionalLight('#fff1d0', 2.4); sun.position.set(-8, 18, 9); scene.add(sun);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18 }); sun.shadow.normalBias = .04;
  const materials = new Map();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const radius = .42;
  const colliders = [];
  const colliderBuckets = new Map();
  let recoverPosition = false,collidersDirty=false;
  const assetSlots = new Map();
  const retiredAssets = new THREE.Group(); retiredAssets.name = 'retired-assets'; retiredAssets.visible = false; scene.add(retiredAssets);
  function assetSlot(group, id) {
    group.name = `asset:${id}`; group.userData.assetSlot = id; assetSlots.set(id, group); return group;
  }
  function mesh(geometry, color, x, y, z, sx, sy, sz, parent = scene) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85 }));
    const object = new THREE.Mesh(geometry, materials.get(color));
    object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const box = (...args) => mesh(cube, ...args);
  function label(text, color = '#355342', width = 3.4) {
    const iconOnly = width === .65, groundMark = text === '+';
    const canvas = document.createElement('canvas'); canvas.width = iconOnly ? 128 : 640; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!groundMark) {
      // Màn 2: cùng khung giấy da + viền gỗ với HUD (--ui-paper / --ui-paper-edge).
      const paper = ctx.createLinearGradient(0, 0, 0, 128); paper.addColorStop(0, '#fffbed'); paper.addColorStop(1, '#fff0d5');
      ctx.fillStyle = farming ? '#fffaf0' : paper; ctx.beginPath(); ctx.roundRect(4, 6, canvas.width - 8, 114, iconOnly ? 40 : 57); ctx.fill();
      ctx.strokeStyle = farming ? color : '#d5b780'; ctx.lineWidth = farming ? 5 : 7; ctx.stroke();
    }
    ctx.fillStyle = groundMark ? '#f6d981' : farming ? color : '#694427'; ctx.font = iconOnly ? '72px system-ui' : farming ? 'bold 54px system-ui' : '800 46px "Baloo 2", system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, 66, canvas.width - 12);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(width, iconOnly ? width : width / (farming ? 4 : 5), 1); return sprite;
  }
  const groundTile = box(farming ? '#94ac76' : '#e7d9b8', 0, -.42, farming ? -1 : -3, halfWidth * 2, .8, farming ? 46 : 38);
  if(farming&&mapBounds){groundTile.position.set((mapBounds.minX+mapBounds.maxX)/2,-.42,(mapBounds.minZ+mapBounds.maxZ)/2);groundTile.scale.set(mapBounds.maxX-mapBounds.minX,.8,mapBounds.maxZ-mapBounds.minZ);}
  if (!farming) {
    box('#f4ecd7', 0, .01, -3, 4, .04, 36);
    box('#f4ecd7', 0, .015, -1, 34, .04, 3);
    for (const side of [-1, 1]) for (let z = farZ; z <= 14; z += 4) {
      mesh(sphere, '#fff9e9', side * halfWidth, -.3, z, 2, .6, 2.4);
      box('#d9c79c', side * (halfWidth - 1.2), .2, z, .3, .4, .3);
    }
    // Nền mây/đảo bay quanh quảng trường: chỉ để nhìn, không chặn đường.
    const surroundings = assetSlot(new THREE.Group(), `${theme}/surroundings`); surroundings.userData.nonSolid = true; scene.add(surroundings);
    const hall = label('BỘ PHẬN TRÙNG SINH · NHỚ LẤY SỐ', '#8f7951', 7);
    hall.position.set(0, 5.5, farZ); scene.add(hall);
  }
  const environment = buildEnvironment?.({ scene, box, mesh, sphere, cube, assetSlot });
  const actors = new Map();
  for (const npc of NPCS.filter(item => item.id !== 'portal')) {
    if (!farming) {
      const dx = npc.position[0], dz = npc.position[1] + 3;
      const distance = Math.hypot(dx, dz);
      const pathLength = Math.max(0, distance - 2.4);
      const path = box('#f4ecd7', dx / distance * pathLength / 2, .025, -3 + dz / distance * pathLength / 2, 2.4, .025, pathLength);
      path.rotation.y = Math.atan2(dx, dz);
      mesh(new THREE.CylinderGeometry(2.5, 2.5, .06, 32), '#e6d9b9', npc.position[0], .025, npc.position[1], 1, 1, 1);
    }
    const group = new THREE.Group(); group.position.set(npc.position[0], .05, npc.position[1]);
    group.rotation.y = npc.facing || 0;
    group.name = `${theme}:${npc.id}`; scene.add(group);
    const visual = new THREE.Group(); group.add(visual);
    if (npc.kind !== 'plot') assetSlot(visual, `${theme}/${npc.id}`);
    group.userData.interactId = npc.id; group.visible = npc.initialVisible !== false;
    let crop = null;
    let actorHooks = {};
    if (buildActor) { actorHooks = buildActor({ npc, visual, box, mesh, sphere, cube, assetSlot }) || {}; crop = actorHooks.crop || null; }
    else if (npc.kind === 'plot') {
      const bed = assetSlot(new THREE.Group(), `${theme}/${npc.id}/bed`); visual.add(bed);
      box('#806447', 0, .13, 0, 2.1, .25, 2.1, bed);
      crop = assetSlot(new THREE.Group(), `${theme}/${npc.id}/crop`); visual.add(crop);
      box('#6e6540', 0, .7, 0, .12, 1.3, .12, crop);
      for (const side of [-1, 1]) mesh(sphere, '#527e45', side * .35, 1, 0, .55, .35, .5, crop);
      const fruit = new THREE.Group(); fruit.name = 'fruit_ripe'; crop.add(fruit);
      for (const x of [-.3, 0, .3]) mesh(sphere, '#b56244', x, 1.1, .32, .12, .14, .12, fruit);
    } else if (npc.kind === 'roaster' || npc.kind === 'market') {
      box('#ad9270', 0, .65, 0, 2, 1.2, 1.5, visual);
      mesh(npc.kind === 'roaster' ? new THREE.CylinderGeometry(.5, .5, .8, 12) : cube, npc.color, 0, 1.5, 0, .8, .7, .8, visual);
    } else if (npc.id === 'reaper') {
      mesh(new THREE.ConeGeometry(.6, 1.7, 10), npc.color, 0, .9, 0, 1, 1, 1, visual);
      mesh(sphere, npc.color, 0, 1.85, 0, .43, .5, .4, visual);
      mesh(sphere, '#172b2f', 0, 1.86, .27, .3, .32, .16, visual);
      for (const x of [-.11, .11]) mesh(sphere, '#b9eed4', x, 1.9, .4, .035, .045, .02, visual);
      box('#967b57', .7, 1.3, 0, .07, 2.6, .07, visual);
      const blade = mesh(new THREE.TorusGeometry(.65, .07, 6, 16, Math.PI * .8), '#ccdcd4', .15, 2.5, 0, 1, .6, 1, visual); blade.rotation.z = .2;
    } else {
      const person = createPerson(npc.color); visual.add(person);
      box('#e6d3aa', 0, .6, .85, 2.1, .15, .8, visual);
      for (const x of [-.8, .8]) box('#b5a27e', x, .28, .85, .12, .55, .5, visual);
      box('#fffaf0', .35, .72, .85, .65, .08, .45, visual);
      if (npc.id === 'growing') {
        box('#967154', -.55, .85, .85, .5, .3, .5, visual);
        mesh(sphere, '#64884f', -.55, 1.18, .85, .4, .4, .35, visual);
        for (const x of [-.7, -.45]) mesh(sphere, '#b86548', x, 1.2, 1.1, .07, .09, .07, visual);
      } else if (npc.id === 'brewing') {
        box('#a4b6ac', -.5, 1, .8, .55, .6, .4, visual);
        mesh(new THREE.CylinderGeometry(.17, .13, .25, 12), '#fff3dc', .6, .88, .95, 1, 1, 1, visual);
      } else if (npc.id === 'business') {
        box('#62806c', -.45, .78, .85, .65, .12, .5, visual);
        for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(.1, .1, .06, 10), '#d2af65', .5, .79 + i * .06, 1, 1, 1, 1, visual);
      } else if (npc.id === 'clerk') {
        for (let i = 0; i < 4; i++) box(i % 2 ? '#d7b78b' : '#ece4c8', -.55, .8 + i * .1, .85, .65, .08, .5, visual);
        box('#9e6451', .5, .9, .85, .2, .3, .2, visual);
      }
    }
    const name = label(npc.name, farming ? '#4a3520' : npc.color, farming ? 2.6 : 3.4);
    if(farming && !['plot','field'].includes(npc.kind)) {
      const plate=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.65),new THREE.MeshBasicMaterial({map:name.material.map,transparent:true,depthWrite:false,depthTest:false}));
      plate.rotation.x=-Math.PI/2;plate.position.set(0,.04,npc.kind==='well' ? 1.35 : npc.kind==='dryer' ? 1.8 : 2.2);plate.renderOrder=5;plate.userData.nonSolid=true;group.add(plate);
      name.material.map=null;name.material.dispose();
    } else {name.position.set(0,farming ? .24 : 2.8,0);group.add(name);}
    const ring = new THREE.Mesh((farming && (npc.kind === 'plot' || npc.input) ? new THREE.RingGeometry(.92, 1, 4, 1, Math.PI/4) : new THREE.RingGeometry(.72, .85, 32)), new THREE.MeshBasicMaterial({ color: npc.color, side: THREE.DoubleSide, transparent: true, opacity: .3 }));
    if(farming && npc.input)ring.scale.set(npc.kind==='dryer' ? 2.3 : 2.7,npc.kind==='dryer' ? 1.8 : 2.3,1);
    ring.userData.nonSolid = true; ring.userData.noPick = true; ring.rotation.x = -Math.PI / 2; ring.position.y = .02; group.add(ring);
    let status = null;
    if (farming) {
      const anchor = new THREE.Group(); anchor.name = `status:${npc.id}`; anchor.userData.nonSolid = true;
      anchor.position.y = npc.kind === 'plot' ? 2.15 : npc.kind === 'field' ? 1.75 : npc.kind === 'dryer' ? 2.4 : 4.45;
      group.add(anchor);
      const sign = label(' ', npc.color, npc.kind === 'plot' ? .65 : 2.3); anchor.add(sign);
      const floorIcon = new THREE.Mesh(new THREE.PlaneGeometry(.72, .72), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      floorIcon.rotation.x = -Math.PI / 2; floorIcon.visible = false; anchor.add(floorIcon);
      const bag = box('#d6bc86', 0, .55, 0, .36, .42, .28, anchor);
      box('#7d8b60', 0, .58, .16, .2, .06, .02, bag);
      const bar = box('#819d70', 0, -.28, 0, 1.6, .045, .03, anchor);
      const badgeCanvas = document.createElement('canvas'); badgeCanvas.width = 192; badgeCanvas.height = 192;
      const badgeTexture = new THREE.CanvasTexture(badgeCanvas); badgeTexture.colorSpace = THREE.SRGBColorSpace;
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({map:badgeTexture,transparent:true,depthWrite:false}));
      badge.scale.set(1.1,1.1,1); badge.visible = false; anchor.add(badge);
      anchor.visible = false; status = { anchor, sign, floorIcon, bag, bar, badge, badgeCanvas, badgeTexture, badgeKey:'', processing:false, jobs:[], text: null, ready: false };
    }
    if (farming && ['plot','field'].includes(npc.kind)) name.visible = false;
    actors.set(npc.id, { group, ring, crop, status, ...actorHooks });
  }
  const portal = new THREE.Group(); portal.position.set(portalPosition[0], 0, portalPosition[1]); scene.add(portal);
  portal.userData.interactId = 'portal'; portal.visible = !farming;
  const portalFrame = assetSlot(new THREE.Group(), `${theme}/portal/frame`); portal.add(portalFrame);
  for (const x of [-1.8, 1.8]) box('#d9bd7b', x, 1.6, 0, .3, 3.2, .35, portalFrame);
  const portalDoors = new THREE.Group(); portalDoors.name = 'portal-doors'; portal.add(portalDoors);
  const leaves = [-1, 1].map(side => {
    const hinge = assetSlot(new THREE.Group(), `${theme}/portal/${side === -1 ? 'left' : 'right'}-leaf`); hinge.position.x = side * 1.65; portalDoors.add(hinge);
    box('#d2b16d', -side * .825, 1.5, 0, 1.65, 3, .12, hinge);
    for (const y of [.25, 2.75]) box('#f0ddb1', -side * .825, y, -.09, 1.5, .12, .08, hinge);
    mesh(sphere, '#f7e8c5', -side * 1.45, 1.45, -.13, .08, .08, .08, hinge);
    return hinge;
  });
  if (!farming) for (const side of [-1, 1]) {
    box('#d8c8a4', side * (halfWidth + 1.9) / 2, .6, portalPosition[1], halfWidth - 1.9, 1.2, .4);
  }
  mesh(new THREE.TorusGeometry(1.8, .16, 8, 32, Math.PI), '#d9bd7b', 0, 3.15, 0, 1, 1, 1, portalFrame);
  const portalMaterial = new THREE.MeshBasicMaterial({ color: '#d4c9a5', transparent: true, opacity: .25, side: THREE.DoubleSide, depthWrite: false });
  const portalLight = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.6), portalMaterial); portalLight.position.y = 1.8; portal.add(portalLight);
  const portalName = label('CỔNG TRÙNG SINH', '#8f7951', 3.4); portalName.position.set(0, 5.9, 0); portal.add(portalName);
  const marker = new THREE.Group(); scene.add(marker);
  const markerRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.22, 40), new THREE.MeshBasicMaterial({ color: '#bc984c', side: THREE.DoubleSide, transparent: true, opacity: .7 }));
  markerRing.rotation.x = -Math.PI / 2; markerRing.position.y = .08; marker.add(markerRing);
  const markerArrow = mesh(new THREE.ConeGeometry(.18, .4, 4), '#bc984c', 0, 3.5, 0, 1, 1, 1, marker); markerArrow.rotation.z = Math.PI;
  character.name = 'heaven-player'; character.position.set(0, .05, 7); character.rotation.set(0, Math.PI, 0); character.scale.setScalar(1); scene.add(character);
  const motion = createPlayerMotion(character);
  const selectedPlots=new Set(),workerTargets=new Set();
  let walkTime = 0, walkWeight = 0, targetId = 'reaper', focused = null, unlocked = farming, returning = false, doorOpen = 0;
  const cameraOffset = new THREE.Vector3(farming ? 10 : 0, farming ? 15 : 12, farming ? 12 : 11);
  const cameraTarget = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const focusPosition = new THREE.Vector3();
  let freshCamera = true, manualCamera = null;
  const speed = 4;
  const frontLimit = portalPosition[1] - .72;
  const worldBounds = farming ? { ...(mapBounds || { minX: -20, maxX: 11, minZ: -19, maxZ: 4 }) } : { minX: -19, maxX: 19, minZ: -20, maxZ: frontLimit };
  const returnBounds = { ...worldBounds, maxZ: portalPosition[1] + .9 };
  function rebuildColliders() {
    colliders.length = 0; colliderBuckets.clear(); recoverPosition=true;
    scene.updateMatrixWorld(true);
    scene.traverse(object => {
      if (!object.isMesh || object === portalLight) return;
      for (let parent = object; parent; parent = parent.parent) if (parent === character || parent === marker || parent === portalDoors || parent.userData.nonSolid || !parent.visible) return;
      const box = new THREE.Box3().setFromObject(object);
      // Floor surfaces and objects above the player's head do not block walking.
      if (box.max.y <= .15 || box.min.y >= 2.1) return;
      colliders.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
    });
    // Broad phase: only nearby solids participate in each walking/pathfinding query.
    const padding=radius+.2;
    for (const obstacle of colliders) {
      for(let x=Math.floor((obstacle.minX-padding)/2);x<=Math.floor((obstacle.maxX+padding)/2);x++) {
        for(let z=Math.floor((obstacle.minZ-padding)/2);z<=Math.floor((obstacle.maxZ+padding)/2);z++) {
          const key=`${x}:${z}`;
          if(!colliderBuckets.has(key)) colliderBuckets.set(key,[]);
          colliderBuckets.get(key).push(obstacle);
        }
      }
    }
  }
  rebuildColliders();
  let route = [], arrivalNpc = null, portalIntent = false;
  let pendingRoute = null, routeIntent = null;
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.03);
  const clickMarker = new THREE.Mesh(new THREE.RingGeometry(.25, .34, 24), new THREE.MeshBasicMaterial({ color: '#658c71', side: THREE.DoubleSide, transparent: true, opacity: .85 }));
  clickMarker.rotation.x = -Math.PI / 2; clickMarker.position.y = .07; clickMarker.visible = false; scene.add(clickMarker);
  function stopMovement() { route = []; arrivalNpc = null; pendingRoute = null; routeIntent = null; portalIntent = false; clickMarker.visible = false; }
  function approachPoints(npc) {
    return npc?.approachOffsets?.map(([x,z])=>({x:npc.position[0]+x,z:npc.position[1]+z}));
  }
  function atInteraction(npc,x=character.position.x,z=character.position.z) {
    const points=approachPoints(npc);
    return points?.length ? points.some(point=>Math.hypot(x-point.x,z-point.z)<=.65) : Math.hypot(x-npc.position[0],z-npc.position[1]) < (npc.interactDistance || 2.6);
  }
  function requestRoute(target, npcId, retries = 0) {
    if (farming) manualCamera = null;
    stopMovement();
    portalIntent = !farming && target.z >= frontLimit && Math.abs(target.x - portalPosition[0]) < 1.1;
    const npc = NPCS.find(item => item.id === npcId);
    const points = approachPoints(npc);
    const interaction = points?.length ? {points,radius:.35} : npc ? {x:npc.position[0],z:npc.position[1],radius:(npc.interactDistance || 2.6)-.2} : null;
    routeIntent = {target:{...target},npcId,retries};
    pendingRoute = { search: findRoute({ x: character.position.x, z: character.position.z }, target, canStand, worldBounds, interaction), npcId };
    return true;
  }
  function moveToNpc(id) {
    const npc = NPCS.find(item => item.id === id);
    if (!npc) return false;
    if (farming) manualCamera = null;
    const dx = character.position.x - npc.position[0], dz = character.position.z - npc.position[1];
    const distance = Math.hypot(dx, dz);
    if (atInteraction(npc)) { stopMovement(); arrivalNpc = id; return true; }
    return requestRoute({ x: npc.position[0] + dx / distance * (npc.approachDistance || 2.3), z: npc.position[1] + dz / distance * (npc.approachDistance || 2.3) }, id);
  }
  // `pad` adds clearance; buckets are padded by .2 so pads up to ~.14 still see neighbouring solids.
  function canStand(x, z, pad = 0) {
    // Keep the entire avatar inside the fence, including the former front opening.
    if (farming && (x < worldBounds.minX+1.15 || x > worldBounds.maxX-1.15 || z < worldBounds.minZ+1.15 || z > worldBounds.maxZ-1.15)) return false;

    if (!unlocked && Math.hypot(x - portalPosition[0], z - portalPosition[1]) < 1.2 + radius) return false;
    const crossing = !farming && returning && unlocked && doorOpen >= .999;
    if (!farming && z > frontLimit && (!crossing || Math.abs(x - portalPosition[0]) > .9)) return false;
    return canOccupy(x, z, colliderBuckets.get(`${Math.floor(x/2)}:${Math.floor(z/2)}`) || [], radius + .06 + pad, crossing ? returnBounds : worldBounds);
  }
  function nearest() {
    let result = null, distance = Infinity;
    for (const npc of NPCS) {
      if (actors.has(npc.id) && (!actors.get(npc.id).group.visible || actors.get(npc.id).group.userData.lockedField)) continue;
      const d = Math.hypot(character.position.x - npc.position[0], character.position.z - npc.position[1]);
      if (d < Math.min(distance, npc.interactDistance || 2.6) && atInteraction(npc)) { result = npc; distance = d; }
    }
    return result;
  }
  function drawPlantBadge(status, progress) {
    const info = status.plantProgress; progress = Math.max(0,Math.min(1,progress));
    const seconds = Math.max(0,Math.ceil(info.remaining-(performance.now()-info.at)/1000*(info.rate ? 1 : 0)));
    const key = `plant:${status.icon}:${status.ready}:${info.paused}:${Math.floor(progress*200)}:${seconds}`;
    if (key === status.badgeKey) return; status.badgeKey = key;
    const ctx = status.badgeCanvas.getContext('2d'); ctx.clearRect(0,0,192,192);
    ctx.shadowColor = status.ready ? '#ffe478' : '#30462680'; ctx.shadowBlur = status.ready ? 12 : 4;
    ctx.font='70px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff2c5';ctx.fillText(status.icon,96,62);
    ctx.shadowBlur=0;ctx.beginPath();ctx.roundRect(24,118,144,19,9);ctx.fillStyle='#3c4e37';ctx.fill();
    ctx.beginPath();ctx.roundRect(27,121,Math.max(6,138*progress),13,6);ctx.fillStyle=status.ready ? '#f4cf61' : info.paused ? '#d7a65c' : '#8fc56c';ctx.fill();
    ctx.font='bold 30px system-ui';ctx.fillStyle='#fff9dc';ctx.shadowColor='#304626';ctx.shadowBlur=3;
    const action = status.ready ? 'Hái' : {'💧':'Tưới','🌿':'Làm cỏ','🪴':'Bón phân'}[status.icon];
    ctx.fillText(action || (info.paused ? 'Chờ chăm' : `${seconds}s`),96,159);ctx.shadowBlur=0;
    status.badgeTexture.needsUpdate=true;
  }
  function drawProcessingBadge(status, progress, ready) {
    progress=Math.max(0,Math.min(1,progress));
    const seconds=Math.max(0,Math.ceil(((status.readyAt || Date.now())-Date.now())/1000));
    const key=`work:${status.icon}:${ready}:${Math.floor(progress*200)}:${seconds}:${status.units}:${status.queueCount}`;
    if(key===status.badgeKey)return;status.badgeKey=key;
    const ctx=status.badgeCanvas.getContext('2d');ctx.clearRect(0,0,192,192);
    ctx.shadowColor=ready ? '#ffe46a' : '#40312477';ctx.shadowBlur=ready ? 12 : 4;
    ctx.font='68px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff4c8';ctx.fillText(ready ? '🧺' : status.icon,96,59);
    ctx.shadowBlur=0;ctx.beginPath();ctx.roundRect(24,113,144,19,9);ctx.fillStyle='#4e4835';ctx.fill();
    ctx.beginPath();ctx.roundRect(27,116,Math.max(6,138*progress),13,6);ctx.fillStyle=ready ? '#f2cb58' : '#8cba64';ctx.fill();
    ctx.font='bold 25px system-ui';ctx.fillStyle='#fff5d6';ctx.shadowColor='#493322';ctx.shadowBlur=3;
    ctx.fillText(ready ? 'Nhận' : `${seconds}s`,96,153);
    ctx.font='bold 21px system-ui';ctx.fillText(status.summary?(ready?`${status.units} mẻ xong`:status.queueCount?`${status.queueCount} mẻ chờ`:'Đang chế biến'):`${status.units || 1} mẻ${!ready && status.icon==='🔄' ? ' · Đảo' : ''}`,96,179);ctx.shadowBlur=0;
    status.badgeTexture.needsUpdate=true;
  }
  function update(dt, time, input, blocked) {
    if(collidersDirty){collidersDirty=false;rebuildColliders();}
    if(recoverPosition) {
      recoverPosition=false;
      if(!canStand(character.position.x,character.position.z)) {
        let found=null;
        for(let distance=.15;distance<=4 && !found;distance+=.15) {
          for(let i=0;i<32;i++) {
            const angle=i*Math.PI/16,x=character.position.x+Math.cos(angle)*distance,z=character.position.z+Math.sin(angle)*distance;
            if(canStand(x,z)){found={x,z};break;}
          }
        }
        if(found){character.position.x=found.x;character.position.z=found.z;stopMovement();}
      }
    }
    let arrivedNpc = null;
    let navigationFailed = false;
    const shouldOpen = !farming && unlocked && Math.hypot(character.position.x - portalPosition[0], character.position.z - portalPosition[1]) < 4.8;
    doorOpen = THREE.MathUtils.clamp(doorOpen + (shouldOpen ? 1 : -1) * dt * 1.2, 0, 1);
    leaves[0].rotation.y = -doorOpen * Math.PI * .52;
    leaves[1].rotation.y = doorOpen * Math.PI * .52;
    if (pendingRoute && !blocked) {
      // Share the render thread: never run the entire search inside a click handler.
      const deadline = performance.now() + 2;
      do {
        const result = pendingRoute.search.next();
        if (result.done) {
          route = result.value; arrivalNpc = route.length ? pendingRoute.npcId : null;
          pendingRoute = null; navigationFailed = !route.length;
          if (route.length) {
            const last = route.at(-1);
            clickMarker.position.set(last.x, .07, last.z); clickMarker.visible = true;
          }
          break;
        }
      } while (performance.now() < deadline);
    }
    const analog = Math.min(1, Math.hypot(input.x, input.z));
    if (analog > 0) stopMovement();
    while (route.length && Math.hypot(route[0].x - character.position.x, route[0].z - character.position.z) < .06) route.shift();
    if (!route.length && arrivalNpc && !blocked) { arrivedNpc = arrivalNpc; arrivalNpc = null; clickMarker.visible = false; }
    const waypoint = route[0];
    if (returning) direction.set(portalPosition[0] - character.position.x, 0, portalPosition[1] + .7 - character.position.z);
    else if (waypoint) direction.set(waypoint.x - character.position.x, 0, waypoint.z - character.position.z);
    else direction.set(input.x, 0, input.z);
    if (returning && direction.lengthSq() < .01) direction.set(0, 0, 0);
    if (returning && doorOpen < .999) direction.set(0, 0, 0);
    const moving = !blocked && direction.lengthSq() > 0;
    if (moving) {
      if (farming) manualCamera = null;
      const distance = returning || waypoint ? Math.min(direction.length(), speed * dt) : speed * dt * analog;
      direction.normalize().multiplyScalar(distance);
      const beforeX = character.position.x, beforeZ = character.position.z;
      slideMove(character.position, direction.x, direction.z, canStand);
      if (waypoint && distance > .00001 && Math.hypot(character.position.x-beforeX,character.position.z-beforeZ) < .00001) {
        const intent=routeIntent;
        if (intent && intent.retries<2) requestRoute(intent.target,intent.npcId,intent.retries+1);
        else stopMovement();
      }
      const facing = Math.atan2(direction.x, direction.z);
      character.rotation.y += Math.atan2(Math.sin(facing - character.rotation.y), Math.cos(facing - character.rotation.y)) * (1 - Math.exp(-16 * dt));
    }
    walkWeight = THREE.MathUtils.lerp(walkWeight, moving ? 1 : 0, 1 - Math.exp(-12 * dt));
    if (walkWeight > .001) walkTime += dt * 1.7;
    motion.update('walk', walkTime, walkWeight);
    const focusNpc = NPCS.find(npc => npc.id === focused);
    cameraTarget.copy(character.position);
    if (focusNpc && !farming) cameraTarget.lerp(focusPosition.set(focusNpc.position[0], .1, focusNpc.position[1]), .35);
    if (farming && manualCamera) cameraTarget.copy(manualCamera);
    desiredCamera.copy(cameraTarget).add(cameraOffset);
    const cameraBlend = freshCamera ? 1 : 1 - Math.exp(-5 * dt);
    camera.position.lerp(desiredCamera, cameraBlend);
    cameraLook.lerp(focusPosition.set(cameraTarget.x, .9, cameraTarget.z - 1), cameraBlend);
    freshCamera = false;
    camera.lookAt(cameraLook);
    const destination = NPCS.find(npc => npc.id === targetId);
    marker.visible = Boolean(destination) && !blocked;
    marker.userData.interactId = targetId;
    if (destination) marker.position.set(destination.position[0], 0, destination.position[1]);
    markerArrow.position.y = 3.4 + Math.sin(time * 2) * .15;
    for (const [id, actor] of actors) {
      actor.ring.material.opacity = farming ? (id === focused || selectedPlots.has(id) || workerTargets.has(id) ? 1 : 0) : id === targetId ? .6 : .2;
      if (farming) { actor.ring.material.color.set(workerTargets.has(id)&&id!==focused&&!selectedPlots.has(id)?'#84cce4':'#ffd35a'); actor.ring.position.y = id.startsWith('plot-') ? .12 : .23; }
      if (id === 'reaper') actor.group.position.y = .08 + Math.sin(time * 1.8) * .05;
      if (actor.status?.plantProgress) {
        const status=actor.status,info=status.plantProgress;
        drawPlantBadge(status,info.ratio+(performance.now()-info.at)/1000*info.rate);
      }
      if (actor.status?.processing) {
        for (const status of actor.status.jobs.length ? actor.status.jobs : [actor.status]) {
          const now = Date.now(), done = now >= status.readyAt;
          status.badge.userData.statusAction=done ? 'collect' : status.icon==='🔄' ? 'turn' : 'select';
          drawProcessingBadge(status,(now-status.startedAt)/Math.max(1,status.readyAt-status.startedAt),done);
          const size = done ? 1.25+Math.sin(time*3)*.035 : 1.25; status.badge.scale.set(size,size,1);
        }
      }
      if (actor.status?.ready) actor.status.bag.position.y = .55 + Math.sin(time * 3) * .08;
      actor.update?.(dt, time);
    }
    portalMaterial.color.set(unlocked ? '#9ddac4' : '#d4c9a5');
    portalMaterial.opacity = unlocked ? .5 + Math.sin(time * 2) * .12 : .2;
    scene.updateMatrixWorld(true);
    character.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
    if (!route.length && !pendingRoute) clickMarker.visible = false;
    const enteredPortal = !farming && !blocked && unlocked && doorOpen >= .999 && character.position.z > portalPosition[1] - 1 && Math.abs(character.position.x - portalPosition[0]) < 1.1 && (input.z > 0 || portalIntent);
    const passedPortal = returning && doorOpen >= .999 && character.position.z >= portalPosition[1] + .6;
    const reached = arrivedNpc ? NPCS.find(npc => npc.id === arrivedNpc) : null;
    const reachedInRange = reached && Math.hypot(character.position.x - reached.position[0], character.position.z - reached.position[1]) < (reached.interactDistance || 2.6);
    return { nearest: reachedInRange ? reached : nearest(), arrivedNpc: reachedInRange ? arrivedNpc : null, navigationFailed, enteredPortal, passedPortal };
  }
  function reset(phase) {
    const clerk = NPCS.find(npc => npc.id === 'clerk');
    const byClerk = !farming && clerk && ['review', 'gift', 'return'].includes(phase);
    const angle = clerk?.facing || 0;
    character.position.set(byClerk ? clerk.position[0] + Math.sin(angle) * 2.5 : 0, .05, byClerk ? clerk.position[1] + Math.cos(angle) * 2.5 : 7);
    if (farming) character.position.set(-3, .05, -.5);
    character.rotation.y = byClerk ? angle + Math.PI : Math.PI;
    freshCamera = true; walkWeight = 0; doorOpen = 0; focused = null; returning = false; stopMovement();
  }
  return {
    scene, camera, update, reset, stopMovement, moveToNpc,
    moveToPoint(x,z){return requestRoute({x,z},null);},
    canStand,
    invalidateNavigation(){collidersDirty=true;},
    prepareNavigation(){if(collidersDirty){collidersDirty=false;rebuildColliders();}},
    createWorkerRoute(start,id,avoid=()=>true) {
      const npc=NPCS.find(n=>n.id===id);if(!npc)return null;
      const points=approachPoints(npc),interaction=points?.length ? {points,radius:.4} : {x:npc.position[0],z:npc.position[1],radius:(npc.interactDistance || 2.6)-.3};
      // Plan with 4 cm extra clearance so a walker stepping between the planner's 10 cm samples never clips a corner
      // (more would shrink tree lanes below the 0.35 m nav grid). Near the start normal clearance is accepted.
      // Grid sim of 2000 chained trips: 180 stuck without pad/slide, 0 with pad .04 + crew slideMove.
      return findRoute(start,{x:npc.position[0],z:npc.position[1]},(x,z)=>(canStand(x,z,.04)||Math.hypot(x-start.x,z-start.z)<.5&&canStand(x,z))&&avoid(x,z),worldBounds,interaction);
    },
    atInteraction(id,position){const npc=NPCS.find(n=>n.id===id);return Boolean(npc&&atInteraction(npc,position.x,position.z));},
    setFarmUpgrades(upgrades) {environment?.setUpgrades?.(upgrades);for(const [id,actor]of actors)actor.setUpgrade?.(upgrades[id]||1);},
    moveToScreen(clientX, clientY, rect, onSelect = null) {
      if (!rect.width || !rect.height) return false;
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2), camera);
      const target = new THREE.Vector3();
      let npcId = null, fromPlot = false, pickedAction = null;
      // Resolve the actual soil footprint before raised foliage or overlapping UI sprites.
      if (farming) {
        const soils = [...actors.values()].filter(actor=>actor.group.visible && actor.pickSurface).map(actor=>actor.pickSurface);
        const soilHit = raycaster.intersectObjects(soils,false)[0];
        if (soilHit) {
          let object = soilHit.object;
          while(object && !object.userData.interactId) object=object.parent;
          if(object) { fromPlot=true; npcId=object.userData.lockedField || object.userData.interactId; }
        }
      }
      if (!npcId) {
        const targets = [...actors.values()].filter(actor => actor.group.visible).map(actor => actor.group);
        if (portal.visible) targets.push(portal);
        if (!farming && marker.visible) targets.push(marker);
        const hit = raycaster.intersectObjects(targets, true).find(hit => {
          for (let object = hit.object; object; object = object.parent) if (!object.visible || object.userData.noPick) return false;
          return true;
        });
        if (hit) {
          let object = hit.object;
          while (object && !object.userData.interactId) {if(object.userData.statusAction)pickedAction=object.userData.statusAction;object = object.parent;}
          npcId = object?.userData.lockedField || object?.userData.interactId || null;
        }
      }
      if (farming) focused = npcId;
      if (npcId && onSelect?.(npcId, {fromPlot,action:pickedAction})) return true;
      if (npcId) return moveToNpc(npcId);
      if (!raycaster.ray.intersectPlane(ground, target)) return false;
      // Heaven NPCs stand on a ground disc; a tap on that disc means "talk", not "walk here".
      const standing = !farming && NPCS.find(npc => npc.id !== 'portal' && Math.hypot(target.x - npc.position[0], target.z - npc.position[1]) < 1.8);
      if (standing) return moveToNpc(standing.id);
      return requestRoute({ x: target.x, z: target.z }, null);
    },
    screenPoint(id,rect) {
      const npc=NPCS.find(item=>item.id===id);if(!npc)return null;
      const point=new THREE.Vector3(npc.position[0],1,npc.position[1]).project(camera);
      return {x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2};
    },
    pickPlotAtScreen(clientX,clientY,rect) {
      if(!farming || !rect.width || !rect.height)return null;
      scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
      raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);
      const surfaces=[...actors.values()].filter(actor=>actor.group.visible && actor.pickSurface).map(actor=>actor.pickSurface);
      const hit=raycaster.intersectObjects(surfaces,false)[0];if(!hit)return null;
      let object=hit.object;while(object && !object.userData.interactId)object=object.parent;
      return object?.userData.lockedField ? null : object?.userData.interactId || null;
    },
    getInteraction(id) { return NPCS.find(item => item.id === id); },
    setFarmLayout(ownedFields, availableFields, bounds) {
      if (!farming) return;
      let changed = Object.keys(bounds).some(key => worldBounds[key] !== bounds[key]);
      Object.assign(worldBounds, bounds);
      groundTile.position.set((bounds.minX + bounds.maxX) / 2, -.42, (bounds.minZ + bounds.maxZ) / 2);
      groundTile.scale.set(bounds.maxX - bounds.minX, .8, bounds.maxZ - bounds.minZ);
      for (const npc of NPCS) {
        const actor = actors.get(npc.id);
        if (!actor) continue;
        if (npc.kind === 'plot') {
          const locked = !ownedFields.includes(npc.fieldId);
          if (actor.group.userData.nonSolid !== locked) changed = true;
          actor.group.userData.nonSolid = locked;
          actor.group.userData.lockedField = locked ? npc.fieldId : null;
          const visible = true;
          if (actor.group.visible !== visible) { actor.group.visible = visible; changed = true; }
        } else if (npc.kind === 'field') {
          const marker = availableFields.find(item => item.id === npc.id);
          const visible = Boolean(marker);
          if (actor.group.visible !== visible) { actor.group.visible = visible; changed = true; }
          if (marker && (npc.position[0] !== marker.position[0] || npc.position[1] !== marker.position[1])) {
            npc.position = [...marker.position]; actor.group.position.set(npc.position[0], .05, npc.position[1]); changed = true;
          }
        }
      }
      environment?.setFields(ownedFields);
      if (changed) { stopMovement(); rebuildColliders(); }
    },
    setActorState(id, value) {
      const actor = actors.get(id);
      if (!actor) return;
      actor.setState?.(value);
      const shape = `${value.unlocked}:${value.stage==='empty'}:${value.mature}`;
      if (actor.shape !== shape) { actor.shape = shape;collidersDirty=true; }
    },
    setObjectStatus(id, { text, ready = false, progress = null, icon = null, startedAt = null, readyAt = null, plant = null, units = 0, jobs = null }) {
      const status = actors.get(id)?.status;
      if (!status) return;
      if (plant) {
        status.processing=false;status.plantProgress={...plant,ratio:progress,at:performance.now()};status.icon=text;status.ready=ready;
        status.anchor.visible=true;status.anchor.position.y=1.4;status.sign.visible=false;status.floorIcon.visible=false;status.bag.visible=false;status.bar.visible=false;
        status.badge.visible=true;status.badge.scale.set(1,1,1);drawPlantBadge(status,progress);return;
      }
      status.plantProgress=null;
      if (jobs) {
        while (status.jobs.length > jobs.length) {
          const item=status.jobs.pop(); item.badge.removeFromParent(); item.badgeTexture.dispose(); item.badge.material.dispose();
        }
        jobs.forEach((job,index) => {
          let item=status.jobs[index];
          if (!item) {
            const badgeCanvas=document.createElement('canvas'); badgeCanvas.width=192; badgeCanvas.height=192;
            const badgeTexture=new THREE.CanvasTexture(badgeCanvas); badgeTexture.colorSpace=THREE.SRGBColorSpace;
            const badge=new THREE.Sprite(new THREE.SpriteMaterial({map:badgeTexture,transparent:true,depthWrite:false}));
            status.anchor.add(badge); item={badge,badgeCanvas,badgeTexture,badgeKey:''}; status.jobs.push(item);
          }
          Object.assign(item,job);
          const done=Date.now()>=job.readyAt;
          item.badge.userData.statusAction=done ? 'collect' : job.icon==='🔄' ? 'turn' : 'select';
          // Offset along the camera's horizontal axis to keep every batch side by side.
          item.badge.position.setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar((index-(jobs.length-1)/2)*1.3);
          item.badge.scale.set(1.25,1.25,1);
          drawProcessingBadge(item,(Date.now()-job.startedAt)/Math.max(1,job.readyAt-job.startedAt),done);
        });
        status.processing=jobs.length>0; status.ready=false; status.anchor.visible=status.processing;
        status.anchor.position.y=id==='dryer' ? 2.85 : 3.75;
        status.badge.visible=false;status.sign.visible=false;status.floorIcon.visible=false;status.bag.visible=false;status.bar.visible=false;
        return;
      }
      if (icon) {
        status.processing = Boolean(text); status.icon = icon; status.startedAt = startedAt; status.readyAt = readyAt;
        status.ready = ready; status.units=units; status.anchor.visible = status.processing;status.badge.userData.statusAction=ready ? 'collect' : icon==='🔄' ? 'turn' : 'select';
        status.anchor.position.y = id === 'dryer' ? 2.85 : 3.75;
        status.badge.visible = status.processing; status.sign.visible = false; status.bag.visible = false; status.bar.visible = false;
        drawProcessingBadge(status,progress || 0,ready);
        return;
      }
      status.badge.visible=false;
      status.anchor.visible = Boolean(text);
      if (farming && id.startsWith('plot-')) {
        const onGround = text === '+' || text === '🔒';
        status.sign.visible = Boolean(text) && !onGround; status.floorIcon.visible = onGround;
        status.anchor.position.y = onGround ? .12 : 1.35;
        status.anchor.visible = Boolean(text); status.bag.visible = false;
      }
      status.ready = ready; status.bag.visible = ready && !id.startsWith('plot-');
      status.bar.visible = progress !== null;
      status.bar.scale.x = Math.max(.001, Math.min(1, progress || 0)) * 1.6;
      if (status.text !== text) {
        const next = label(text || ' ', ready ? '#8b6e34' : '#536e54', id.startsWith('plot-') ? .65 : 2.3);
        status.sign.material.map?.dispose(); status.sign.material.map = next.material.map;
        status.floorIcon.material.map = next.material.map; status.floorIcon.material.needsUpdate = true;
        next.material.map = null; next.material.dispose(); status.text = text;
      }
    },
        setPlot(id, state, mature = false) {
      const actor = actors.get(id);
      if (!actor?.crop) return;
      actor.crop.visible = state !== 'empty';
      actor.crop.traverse(object => { if (object.name === 'fruit_ripe') object.visible = state === 'ready'; if (object.name === 'fruit_green') object.visible = state === 'growing'; });
      actor.crop.scale.setScalar(mature ? 1 : state === 'planted' ? .35 : state === 'growing' ? .65 : 1);
      actor.ring.material.color.set(state === 'ready' ? '#c28943' : '#70946c');
    },
    replaceAsset(id, model) {
      const slot = assetSlots.get(id);
      if (!slot || !model?.isObject3D || model === slot || model.parent === slot) return false;
      stopMovement();
      for (const child of [...slot.children]) retiredAssets.add(child);
      model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
      slot.add(model); rebuildColliders(); return true;
    },
    getAssetSlots() { return [...assetSlots.keys()]; },
    panCamera(fromX, fromY, toX, toY, rect) {
      if (!farming || !rect.width || !rect.height) return;
      camera.updateMatrixWorld(true);
      const from = new THREE.Vector3(), to = new THREE.Vector3();
      raycaster.setFromCamera(new THREE.Vector2((fromX-rect.left)/rect.width*2-1, 1-(fromY-rect.top)/rect.height*2), camera);
      if (!raycaster.ray.intersectPlane(ground, from)) return;
      raycaster.setFromCamera(new THREE.Vector2((toX-rect.left)/rect.width*2-1, 1-(toY-rect.top)/rect.height*2), camera);
      if (!raycaster.ray.intersectPlane(ground, to)) return;
      if (!manualCamera) manualCamera = cameraTarget.clone();
      manualCamera.x = THREE.MathUtils.clamp(manualCamera.x + from.x-to.x, worldBounds.minX, worldBounds.maxX);
      manualCamera.z = THREE.MathUtils.clamp(manualCamera.z + from.z-to.z, worldBounds.minZ, worldBounds.maxZ);
    },
    zoomView(delta) {
      if (!farming) return;
      camera.zoom = THREE.MathUtils.clamp(camera.zoom+delta,.8,1.65); camera.updateProjectionMatrix();
    },
    freezeCamera() { if(farming) manualCamera=camera.position.clone().sub(cameraOffset); },
    resetCamera() { manualCamera = null; },
    setTarget(id) { targetId = id; },
    setWorkerTargets(ids){workerTargets.clear();for(const id of ids)workerTargets.add(id);},
    setPlotSelection(ids) {selectedPlots.clear();for(const id of ids)selectedPlots.add(id);},
    removePlotSelection(id) {selectedPlots.delete(id);},
    setFocus(id) { focused = id; },
    setUnlocked(value) { unlocked = value; },
    setReturning(value) { returning = value; },
    resize(width, height) {
      const aspect = width/Math.max(1,height);
      if (farming) {
        const half = width < 700 ? 7.5 : 6.8;
        camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
      } else { camera.aspect=aspect;camera.fov=width < 700 ? 55 : 43; }
      camera.updateProjectionMatrix();
    },
    dispose() { motion.dispose(); disposeScene(scene); sun.shadow.dispose(); },
  };
}
