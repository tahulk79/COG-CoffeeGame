import * as THREE from 'three';
import { createPerson } from '../../characters/player.js';
import { createPlayerMotion } from '../../characters/motion.js';
import { disposeScene } from '../three/dispose-scene.js';
import { findRoute } from '../game/navigation.js';
import { canOccupy, slideMove } from '../game/collision.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fillRich } from '../../ui/icons.js';
import { t } from '../../i18n/index.js';

export function createAdventureScene(character, { interactions: inputInteractions, theme = 'heaven', mapBounds = null, buildActor = null, buildEnvironment = null, lighting = {}, portraitView = { focus: [-6.4, -.5], zoom: .9, dolly: 1 } }) {
  const NPCS = inputInteractions.map(item => ({ ...item, position: [...item.position] }));
  const farming = theme === 'farm';
  const portalPosition = NPCS.find(npc => npc.id === 'portal')?.position || [0, 10];
  const halfWidth = farming ? 26 : 21;
  const farZ = farming ? -24 : -20;
  const scene = new THREE.Scene();
  // Per-scene light (docs/shared/art-direction.md §4); defaults are the old shared values so heaven/café stay as they were.
  const light = { sky: '#fff8e3', ground: '#94ac99', ambient: 2.8, sun: '#fff1d0', sunIntensity: 2.4, background: farming ? '#dcebd4' : '#ecf1e6', ...lighting };
  scene.background = new THREE.Color(light.background);
  scene.fog = new THREE.Fog(light.background, farming ? 38 : 30, farming ? 80 : 65); // far edge fades into the sky, as in heaven
  // Every scene uses heaven's follow camera (perspective, behind and above the player): deeper, roomier view.
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 120);
  scene.add(new THREE.HemisphereLight(light.sky, light.ground, light.ambient));
  const sun = new THREE.DirectionalLight(light.sun, light.sunIntensity); sun.position.set(-8, 18, 9); scene.add(sun);
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
  // Heaven floor: soft drifting cloud, no tile grid or lines (seeded so it looks the same every visit).
  function cloudFloor() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    let seed = 7; const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    ctx.fillStyle = '#e6d6b2'; ctx.fillRect(0, 0, 1024, 1024);
    const blob = (x, y, r, color) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    blob(512, 600, 520, 'rgba(255,246,222,.45)'); // warm glow round the central plaza
    for (let i = 0; i < 90; i++) blob(rand() * 1024, rand() * 1024, 50 + rand() * 150, `rgba(255,255,255,${(.5 + rand() * .45).toFixed(2)})`);
    for (let i = 0; i < 25; i++) blob(rand() * 1024, rand() * 1024, 60 + rand() * 120, 'rgba(226,206,160,.22)');
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  // Heaven plaza drawn from the NPC positions so it always lines up: centre disc, one ring walkway through every
  // dais, a straight spoke from the centre to each god, and a spoke south to the portal crossing the ring.
  function plazaFloor() {
    const center = [0, -3], radius = 11, walk = 1.6, edge = .12;
    const parts = { walk: [], disc: [], gold: [], pool: [] };
    const flat = (geometry, x, y, z) => geometry.rotateX(-Math.PI / 2).translate(x, y, z);
    const ring = (list, inner, outer, y, [x, z] = center) => list.push(flat(new THREE.RingGeometry(inner, outer, 96), x, y, z));
    const disc = (list, r, y, [x, z] = center) => list.push(flat(new THREE.CircleGeometry(r, 96), x, y, z));
    const strip = (list, dir, from, to, width, y, offset = 0) => {
      const geometry = new THREE.PlaneGeometry(width, to - from).rotateX(-Math.PI / 2).rotateY(Math.atan2(dir[0], dir[1]));
      const mid = (from + to) / 2;
      list.push(geometry.translate(center[0] + dir[0] * mid + dir[1] * offset, y, center[1] + dir[1] * mid - dir[0] * offset));
    };
    const spoke = (dir, from, to, y) => {
      strip(parts.walk, dir, from, to, walk, y);
      for (const side of [-1, 1]) strip(parts.gold, dir, from, to, edge, y + .004, side * (walk - edge) / 2);
    };
    ring(parts.walk, radius - walk / 2, radius + walk / 2, .012);
    for (const side of [-1, 1]) ring(parts.gold, radius + side * (walk - edge) / 2 - edge / 2, radius + side * (walk - edge) / 2 + edge / 2, .02);
    for (const npc of NPCS) {
      const dx = npc.position[0] - center[0], dz = npc.position[1] - center[1], distance = Math.hypot(dx, dz), dir = [dx / distance, dz / distance];
      if (npc.id === 'portal') { spoke(dir, 2.9, radius + walk / 2, .024); spoke(dir, radius + walk / 2, distance - .4, .012); continue; }
      if (npc.noDais) continue; // đứng trên sân, không bệ/lối riêng (02-mini)
      spoke(dir, 2.9, distance - 2.6, .012);
      disc(parts.disc, 2.5, .028, npc.position); ring(parts.gold, 2.5, 2.7, .034, npc.position);
    }
    disc(parts.disc, 2.9, .028); ring(parts.gold, 2.75, 2.95, .034);
    disc(parts.pool, 1.4, .04); ring(parts.gold, 1.4, 1.52, .042);
    const colors = { walk: '#f7efdc', disc: '#ecdcb8', gold: '#d6b56c', pool: '#d3e6df' };
    const group = new THREE.Group(); group.userData.nonSolid = true;
    for (const [key, list] of Object.entries(parts)) {
      const floor = new THREE.Mesh(mergeGeometries(list), new THREE.MeshStandardMaterial({ color: colors[key], roughness: .9 }));
      floor.receiveShadow = true; floor.userData.noPick = true; group.add(floor);
      for (const geometry of list) geometry.dispose();
    }
    return group;
  }
  // Low-poly cloud banks round the floor's edge so the map fades into sky instead of ending on a hard line.
  function cloudBank() {
    const puffs = [];
    let seed = 11; const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const minX = -halfWidth, maxX = halfWidth, minZ = farZ - 2, maxZ = 16;
    for (const row of [0, 1]) {
      const pad = 1.4 + row * 3, step = 2.4 + row;
      for (let x = minX - pad; x <= maxX + pad; x += step) puffs.push([x, minZ - pad], [x, maxZ + pad]);
      for (let z = minZ - pad; z <= maxZ + pad; z += step) puffs.push([minX - pad, z], [maxX + pad, z]);
    }
    const bank = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 1, flatShading: true }), puffs.length);
    const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3(), position = new THREE.Vector3();
    puffs.forEach(([x, z], index) => {
      const size = 2.2 + rand() * 1.8;
      position.set(x + (rand() - .5), -.4 + rand() * .5, z + (rand() - .5));
      quaternion.setFromEuler(euler.set(0, rand() * Math.PI, 0)); scale.set(size, size * (.45 + rand() * .25), size);
      bank.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    });
    bank.userData.nonSolid = true; bank.userData.noPick = true;
    return bank;
  }
  function label(text, color = '#355342', width = 3.4) {
    const iconOnly = width === .65, groundMark = text === '+';
    const canvas = document.createElement('canvas'); canvas.width = iconOnly ? 128 : 640; canvas.height = 128;
    let ctx = canvas.getContext('2d');
    // Every text label is the dark nameplate (--ui-nameplate-*): reads on grass, wood floors and the pale plaza alike.
    const plate = !iconOnly && !groundMark;
    const size = iconOnly ? 72 : 64;
    if (plate) { // the plate hugs its text so every label has the same type size, long or short
      ctx.font = `800 ${size}px "Baloo 2", system-ui`;
      canvas.width = Math.min(1024, Math.ceil(ctx.measureText(text).width + 88)); ctx = canvas.getContext('2d');
    }
    if (!groundMark) {
      ctx.fillStyle = plate ? '#3b2a1cd9' : '#fffaf0'; ctx.beginPath(); ctx.roundRect(4, 6, canvas.width - 8, 114, iconOnly ? 40 : 57); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = plate ? 6 : 5; ctx.stroke();
    }
    ctx.fillStyle = groundMark ? '#f6d981' : plate ? '#fff6dc' : '#3f2c17'; ctx.font = iconOnly ? `${size}px system-ui` : `800 ${size}px "Baloo 2", system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fillRich(ctx, text, canvas.width / 2, 66, size, canvas.width - 24, plate);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(plate ? width / 5 * canvas.width / 128 : width, iconOnly ? width : width / 5, 1); return sprite;
  }
  // Labels keep a steady on-screen size whatever the distance or zoom.
  const screenLabels = [];
  function keepOnScreen(object, pixels = 26) {
    object.userData.baseScale = object.scale.clone(); object.userData.labelPx = pixels;
    if (object.isSprite) object.material.sizeAttenuation = false;
    screenLabels.push(object); return object;
  }
  // A fixed-size nameplate half outside the view reads as a cut word, so show it only when it fits.
  const labelPoint = new THREE.Vector3();
  // The farm quest card is HTML over the canvas: labels whose centre falls behind it are hidden too (UX-A1). Rects re-read ~4x/s, not per frame.
  let hudRects = [], hudReadAt = 0;
  function readHudRects() {
    const now = performance.now(); if (!farming || now - hudReadAt < 250) return; hudReadAt = now;
    hudRects = [...document.querySelectorAll('#farm-hud .quest-tracker')].filter(e => getComputedStyle(e).opacity !== '0').map(e => e.getBoundingClientRect());
  }
  function hideCutLabels() {
    camera.updateMatrixWorld(); readHudRects();
    for (const object of screenLabels) {
      labelPoint.setFromMatrixPosition(object.matrixWorld).project(camera);
      const half = object.userData.labelPx * object.scale.x / object.scale.y / viewWidth; // half width in NDC
      const px = (labelPoint.x + 1) / 2 * viewWidth, py = (1 - labelPoint.y) / 2 * viewHeight, hw = half * viewWidth;
      const covered = hudRects.some(r => px + hw > r.left && px - hw < r.right && py > r.top && py < r.bottom);
      object.material.visible = !covered && labelPoint.z < 1 && Math.abs(labelPoint.x) + half < 1 && Math.abs(labelPoint.y) < .97; // material flag: object.visible belongs to the status logic
    }
  }
  let viewHeight = 1, viewWidth = 1;
  function fitLabel(object) {
    const base = object.userData.baseScale, h = 2 * object.userData.labelPx / (viewHeight * camera.projectionMatrix.elements[5]);
    object.scale.set(h * base.x / base.y, h, 1);
  }
  function fitLabels() { for (const object of screenLabels) fitLabel(object); }

  const groundTile = box(farming ? '#94ac76' : '#e7d9b8', 0, -.42, farming ? -1 : -3, halfWidth * 2, .8, farming ? 46 : 38);
  if (!farming) groundTile.material = new THREE.MeshStandardMaterial({ map: cloudFloor(), roughness: 1 });
  if(farming&&mapBounds){groundTile.position.set((mapBounds.minX+mapBounds.maxX)/2,-.42,(mapBounds.minZ+mapBounds.maxZ)/2);groundTile.scale.set(mapBounds.maxX-mapBounds.minX,.8,mapBounds.maxZ-mapBounds.minZ);}
  // Sân, lối, đĩa đứng, gò mây, cột, tường cổng: một slot để thay hình mà giữ khối tạm làm vùng cản (dressSlot).
  const plaza = farming ? null : assetSlot(new THREE.Group(), `${theme}/plaza`);
  if (!farming) {
    scene.add(plaza, plazaFloor(), cloudBank());
    box('#f4ecd7', 0, .01, -3, 4, .04, 36, plaza);
    box('#f4ecd7', 0, .015, -1, 34, .04, 3, plaza);
    for (const side of [-1, 1]) for (let z = farZ; z <= 14; z += 4) {
      mesh(sphere, '#fff9e9', side * halfWidth, -.3, z, 2, .6, 2.4, plaza);
      box('#d9c79c', side * (halfWidth - 1.2), .2, z, .3, .4, .3, plaza);
    }
    // Nền mây/đảo bay quanh quảng trường: chỉ để nhìn, không chặn đường.
    const surroundings = assetSlot(new THREE.Group(), `${theme}/surroundings`); surroundings.userData.nonSolid = true; scene.add(surroundings);
    const hall = label(t('shared.heaven.hallSign'), '#8f7951', 7);
    hall.position.set(0, 5.5, farZ); scene.add(keepOnScreen(hall, 22));
  }
  const environment = buildEnvironment?.({ scene, box, mesh, sphere, cube, assetSlot });
  const actors = new Map();
  for (const npc of NPCS.filter(item => item.id !== 'portal')) {
    if (!farming && !npc.noDais) {
      const dx = npc.position[0], dz = npc.position[1] + 3;
      const distance = Math.hypot(dx, dz);
      const pathLength = Math.max(0, distance - 2.4);
      const path = box('#f4ecd7', dx / distance * pathLength / 2, .025, -3 + dz / distance * pathLength / 2, 2.4, .025, pathLength, plaza);
      path.rotation.y = Math.atan2(dx, dz);
      mesh(new THREE.CylinderGeometry(2.5, 2.5, .06, 32), '#e6d9b9', npc.position[0], .025, npc.position[1], 1, 1, 1, plaza);
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
    const overhead = npc.kind === 'well' ? 2.6 : npc.kind === 'dryer' ? 3.1 : npc.kind === 'field' ? 1.9
      : ['register','pickup','kiosk','bar','pantry','board','table','expansion','exit'].includes(npc.kind) ? 2.3 : 3.7;
    let namePlate = null;
    const name = label(npc.name, farming ? '#4a3520' : npc.color, farming ? 2.6 : 3.4);
    // Farm/café: centred over the object, text level and facing the player — same plate as heaven's gate.
    if (farming && !['plot','field'].includes(npc.kind)) { name.position.set(0, overhead, 0); name.material.depthTest = false; name.renderOrder = 5; namePlate = name; }
    else name.position.set(0, farming ? .24 : 2.8, 0);
    group.add(keepOnScreen(name));
    const ring = new THREE.Mesh((farming && (npc.kind === 'plot' || npc.input) ? new THREE.RingGeometry(.92, 1, 4, 1, Math.PI/4) : new THREE.RingGeometry(.72, .85, 32)), new THREE.MeshBasicMaterial({ color: npc.color, side: THREE.DoubleSide, transparent: true, opacity: .3 }));
    if(farming && npc.input)ring.scale.set(npc.kind==='dryer' ? 2.3 : 2.7,npc.kind==='dryer' ? 1.8 : 2.3,1);
    ring.userData.nonSolid = true; ring.userData.noPick = true; ring.rotation.x = -Math.PI / 2; ring.position.y = .02; group.add(ring);
    let status = null;
    if (farming) {
      const anchor = new THREE.Group(); anchor.name = `status:${npc.id}`; anchor.userData.nonSolid = true;
      anchor.position.y = npc.kind === 'plot' ? 2.15 : npc.kind === 'field' ? 1.75 : npc.kind === 'dryer' ? 2.4 : 4.45;
      group.add(anchor);
      const sign = label(' ', npc.color, npc.kind === 'plot' ? .65 : 2.6);
      if (npc.kind === 'plot') anchor.add(sign); // plot badges sit too close together to grow
      else { // "Thu ngân", "Ô trống…", field price: same overhead plate, standing in for the name while it has something to say
        sign.position.set(0, overhead, 0); sign.material.depthTest = false; sign.renderOrder = 5; sign.visible = false; group.add(keepOnScreen(sign));
      }
      const floorIcon = new THREE.Mesh(new THREE.PlaneGeometry(.72, .72), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      floorIcon.rotation.x = -Math.PI / 2; floorIcon.visible = false; anchor.add(floorIcon);
      const bag = box('#d6bc86', 0, .55, 0, .36, .42, .28, anchor);
      box('#7d8b60', 0, .58, .16, .2, .06, .02, bag);
      const bar = box('#819d70', 0, -.28, 0, 1.6, .045, .03, anchor);
      const badgeCanvas = document.createElement('canvas'); badgeCanvas.width = 192; badgeCanvas.height = 192;
      const badgeTexture = new THREE.CanvasTexture(badgeCanvas); badgeTexture.colorSpace = THREE.SRGBColorSpace;
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({map:badgeTexture,transparent:true,depthWrite:false}));
      badge.scale.set(1.4,1.4,1); badge.visible = false; anchor.add(badge); // bigger so the time/action text reads on a phone
      anchor.visible = false; status = { anchor, sign, namePlate, floorIcon, bag, bar, badge, badgeCanvas, badgeTexture, badgeKey:'', processing:false, jobs:[], text: null, ready: false };
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
    box('#d8c8a4', side * (halfWidth + 1.9) / 2, .6, portalPosition[1], halfWidth - 1.9, 1.2, .4, plaza);
  }
  mesh(new THREE.TorusGeometry(1.8, .16, 8, 32, Math.PI), '#d9bd7b', 0, 3.15, 0, 1, 1, 1, portalFrame);
  const portalMaterial = new THREE.MeshBasicMaterial({ color: '#d4c9a5', transparent: true, opacity: .25, side: THREE.DoubleSide, depthWrite: false });
  const portalLight = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.6), portalMaterial); portalLight.position.y = 1.8; portal.add(portalLight);
  const portalName = label(t('shared.heaven.portalSign'), '#8f7951', 3.4); portalName.position.set(0, 5.9, 0); portal.add(keepOnScreen(portalName, 30));
  const marker = new THREE.Group(); scene.add(marker);
  const markerRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.22, 40), new THREE.MeshBasicMaterial({ color: '#bc984c', side: THREE.DoubleSide, transparent: true, opacity: .7 }));
  markerRing.rotation.x = -Math.PI / 2; markerRing.position.y = .08; marker.add(markerRing);
  // Quest arrow (slot `<theme>/quest-arrow`, placeholder cone): floats over the interaction set by setTarget/setQuestArrow.
  const markerArrow = assetSlot(new THREE.Group(), `${theme}/quest-arrow`); markerArrow.position.y = 3.5; marker.add(markerArrow);
  mesh(new THREE.ConeGeometry(.18, .4, 4), '#bc984c', 0, 0, 0, farming ? 2 : 1, farming ? 2 : 1, farming ? 2 : 1, markerArrow).rotation.z = Math.PI;
  character.name = 'heaven-player'; character.position.set(0, .05, 7); character.rotation.set(0, Math.PI, 0); character.scale.setScalar(1); scene.add(character);
  const motion = createPlayerMotion(character);
  const selectedPlots=new Set(),workerTargets=new Set(),queuedPlots=new Set(),queueBadges=[]; // queueBadges[n-1] = nhãn số n, tạo lười rồi dùng lại (Q5 R12)
  let queueKey = '';
  let walkTime = 0, walkWeight = 0, targetId = 'reaper', focused = null, unlocked = farming, returning = false, doorOpen = 0;
  const baseOffset = new THREE.Vector3(0, farming ? 12.5 : 12, farming ? 11.5 : 11), cameraOffset = baseOffset.clone();
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
  // Asset swaps only mark colliders dirty; the next read rebuilds once (PF-4: was one full-scene walk per slot).
  function syncColliders() { if (collidersDirty) { collidersDirty = false; rebuildColliders(); } }
  let route = [], arrivalNpc = null, portalIntent = false, faceYaw = null; // faceYaw: where to turn once standing at an interaction
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
    manualCamera = null;
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
    manualCamera = null;
    const dx = character.position.x - npc.position[0], dz = character.position.z - npc.position[1];
    const distance = Math.hypot(dx, dz);
    if (atInteraction(npc)) { stopMovement(); arrivalNpc = id; return true; }
    return requestRoute({ x: npc.position[0] + dx / distance * (npc.approachDistance || 2.3), z: npc.position[1] + dz / distance * (npc.approachDistance || 2.3) }, id);
  }
  // `pad` adds clearance; buckets are padded by .2 so pads up to ~.14 still see neighbouring solids.
  function canStand(x, z, pad = 0) {
    syncColliders(); // the only collider reader; crew/cafe callers skip prepareNavigation
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
    // Above a minute show whole minutes so 48 plot badges redraw (canvas + texture upload) rarely, not every second.
    const timeLabel = seconds > 60 ? t('shared.badge.minutes', { n: Math.ceil(seconds / 60) }) : `${seconds}s`;
    const key = `plant:${status.icon}:${status.ready}:${info.paused}:${Math.floor(progress*40)}:${timeLabel}`;
    if (key === status.badgeKey) return; status.badgeKey = key;
    const ctx = status.badgeCanvas.getContext('2d'); ctx.clearRect(0,0,192,192);
    ctx.shadowColor = status.ready ? '#ffe478' : '#30462680'; ctx.shadowBlur = status.ready ? 12 : 4;
    ctx.font='70px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff2c5';fillRich(ctx,status.icon,96,62,70);
    ctx.shadowBlur=0;ctx.beginPath();ctx.roundRect(24,118,144,19,9);ctx.fillStyle='#3c4e37';ctx.fill();
    ctx.beginPath();ctx.roundRect(27,121,Math.max(6,138*progress),13,6);ctx.fillStyle=status.ready ? '#f4cf61' : info.paused ? '#d7a65c' : '#8fc56c';ctx.fill();
    // Readable on phones: large bold label with a dark outline instead of a faint shadow.
    ctx.font='900 40px system-ui';ctx.lineJoin='round';ctx.lineWidth=8;ctx.strokeStyle='#2e2416';ctx.fillStyle='#fffbe6';
    // Ready plots already show the basket icon, so no "Hái" text under the bar.
    const action = {'💧':t('shared.badge.water'),'🌿':t('shared.badge.weed'),'🪴':t('shared.badge.fertilize')}[status.icon], text = status.ready ? '' : action || (info.paused ? t('shared.badge.waitCare') : timeLabel);
    if (text) { ctx.strokeText(text,96,164);ctx.fillText(text,96,164); }
    status.badgeTexture.needsUpdate=true;
  }
  function drawProcessingBadge(status, progress, ready) {
    progress=Math.max(0,Math.min(1,progress));
    const seconds=Math.max(0,Math.ceil(((status.readyAt || Date.now())-Date.now())/1000));
    const key=`work:${status.icon}:${ready}:${Math.floor(progress*200)}:${seconds}:${status.units}:${status.queueCount}`;
    if(key===status.badgeKey)return;status.badgeKey=key;
    const ctx=status.badgeCanvas.getContext('2d');ctx.clearRect(0,0,192,192);
    ctx.shadowColor=ready ? '#ffe46a' : '#40312477';ctx.shadowBlur=ready ? 12 : 4;
    ctx.font='68px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff4c8';fillRich(ctx,ready ? '🧺' : status.icon,96,59,68);
    ctx.shadowBlur=0;ctx.beginPath();ctx.roundRect(24,113,144,19,9);ctx.fillStyle='#4e4835';ctx.fill();
    ctx.beginPath();ctx.roundRect(27,116,Math.max(6,138*progress),13,6);ctx.fillStyle=ready ? '#f2cb58' : '#8cba64';ctx.fill();
    ctx.font='900 32px system-ui';ctx.lineJoin='round';ctx.lineWidth=7;ctx.strokeStyle='#2e2416';ctx.fillStyle='#fffbe6';
    const head=ready ? t('shared.badge.collect') : `${seconds}s`;ctx.strokeText(head,96,152);ctx.fillText(head,96,152);
    ctx.font='800 22px system-ui';ctx.lineWidth=5;const sub=(status.summary?(ready?t('shared.badge.batchesDone',{n:status.units}):status.queueCount?t('shared.badge.batchesQueued',{n:status.queueCount}):t('shared.badge.processing')):`${t('shared.badge.batches',{n:status.units || 1})}${!ready && status.icon==='🔄' ? t('shared.badge.turnSuffix') : ''}`);ctx.strokeText(sub,96,180);ctx.fillText(sub,96,180);
    status.badgeTexture.needsUpdate=true;
  }
  function update(dt, time, input, blocked) {
    syncColliders();
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
    if (!route.length && arrivalNpc && !blocked) {
      arrivedNpc = arrivalNpc; arrivalNpc = null; clickMarker.visible = false;
      // Turn to the thing being used (counters use an explicit faceYaw toward customers) instead of keeping the last step's heading.
      const npc = NPCS.find(item => item.id === arrivedNpc), dx = npc ? npc.position[0] - character.position.x : 0, dz = npc ? npc.position[1] - character.position.z : 0;
      faceYaw = npc?.faceYaw ?? (Math.hypot(dx, dz) > .05 ? Math.atan2(dx, dz) : null);
    }
    const waypoint = route[0];
    if (returning) direction.set(portalPosition[0] - character.position.x, 0, portalPosition[1] + .7 - character.position.z);
    else if (waypoint) direction.set(waypoint.x - character.position.x, 0, waypoint.z - character.position.z);
    else direction.set(input.x, 0, input.z);
    if (returning && direction.lengthSq() < .01) direction.set(0, 0, 0);
    if (returning && doorOpen < .999) direction.set(0, 0, 0);
    const moving = !blocked && direction.lengthSq() > 0;
    if (moving) {
      manualCamera = null;
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
      if (!arrivedNpc) faceYaw = null;
    } else if (faceYaw !== null) {
      character.rotation.y += Math.atan2(Math.sin(faceYaw - character.rotation.y), Math.cos(faceYaw - character.rotation.y)) * (1 - Math.exp(-12 * dt));
    }
    walkWeight = THREE.MathUtils.lerp(walkWeight, moving ? 1 : 0, 1 - Math.exp(-12 * dt));
    if (walkWeight > .001) walkTime += dt * 1.7;
    motion.update('walk', walkTime, walkWeight);
    const focusNpc = NPCS.find(npc => npc.id === focused);
    cameraTarget.copy(character.position);
    if (focusNpc && !farming && !manualCamera) cameraTarget.lerp(focusPosition.set(focusNpc.position[0], .1, focusNpc.position[1]), .35);
    if (manualCamera) cameraTarget.copy(manualCamera);
    desiredCamera.copy(cameraTarget).add(cameraOffset);
    const cameraBlend = freshCamera ? 1 : 1 - Math.exp(-5 * dt);
    camera.position.lerp(desiredCamera, cameraBlend);
    cameraLook.lerp(focusPosition.set(cameraTarget.x, .9, cameraTarget.z - 1), cameraBlend);
    freshCamera = false;
    camera.lookAt(cameraLook);
    hideCutLabels();
    const destination = NPCS.find(npc => npc.id === targetId);
    marker.visible = Boolean(destination) && !blocked;
    marker.userData.interactId = targetId;
    if (destination) marker.position.set(destination.position[0], 0, destination.position[1]);
    markerArrow.position.y = 3.4 + Math.sin(time * Math.PI * 2) * .15; // 1 Hz bob
    for (const [id, actor] of actors) {
      actor.ring.material.opacity = farming ? (id === focused || selectedPlots.has(id) || workerTargets.has(id) ? 1 : queuedPlots.has(id) ? .55 : 0) : id === targetId ? .6 : .2;
      actor.ring.visible = actor.ring.material.opacity > 0; // an opacity-0 mesh still costs a draw call
      if (farming) { actor.ring.material.color.set(id!==focused&&!selectedPlots.has(id)?(workerTargets.has(id)?'#84cce4':queuedPlots.has(id)?'#fff0b8':'#ffd35a'):'#ffd35a'); actor.ring.position.y = id.startsWith('plot-') ? .12 : .23; }
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
          const size = done ? 1.5+Math.sin(time*3)*.04 : 1.5; status.badge.scale.set(size,size,1);
        }
      }
      if (actor.status?.ready) actor.status.bag.position.y = .55 + Math.sin(time * 3) * .08;
      actor.update?.(dt, time);
    }
    portalMaterial.color.set(unlocked ? '#9ddac4' : '#d4c9a5');
    portalMaterial.opacity = unlocked ? .5 + Math.sin(time * 2) * .12 : .2;
    scene.updateMatrixWorld();
    if (!route.length && !pendingRoute) clickMarker.visible = false;
    const enteredPortal = !farming && !blocked && unlocked && doorOpen >= .999 && character.position.z > portalPosition[1] - 1 && Math.abs(character.position.x - portalPosition[0]) < 1.1 && (input.z > 0 || portalIntent);
    const passedPortal = returning && doorOpen >= .999 && character.position.z >= portalPosition[1] + .6;
    const reached = arrivedNpc ? NPCS.find(npc => npc.id === arrivedNpc) : null;
    const reachedInRange = reached && Math.hypot(character.position.x - reached.position[0], character.position.z - reached.position[1]) < (reached.interactDistance || 2.6);
    return { nearest: reachedInRange ? reached : nearest(), arrivedNpc: reachedInRange ? arrivedNpc : null, navigationFailed, enteredPortal, passedPortal, routing: route.length > 0 || pendingRoute !== null || arrivalNpc !== null };
  }
  function reset(phase) {
    const clerk = NPCS.find(npc => npc.id === 'clerk');
    const byClerk = !farming && clerk && ['review', 'gift', 'return'].includes(phase);
    const angle = clerk?.facing || 0;
    character.position.set(byClerk ? clerk.position[0] + Math.sin(angle) * 2.5 : 0, .05, byClerk ? clerk.position[1] + Math.cos(angle) * 2.5 : 7);
    if (farming) character.position.set(-3, .05, -.5);
    character.rotation.y = byClerk ? angle + Math.PI : Math.PI;
    freshCamera = true; walkWeight = 0; doorOpen = 0; focused = null; returning = false; stopMovement();
    // Portrait phone: open on the field's centre so field-0 is not clipped; walking clears manualCamera (UX-A4). Window size: resize() may not have run yet.
    if (farming && innerWidth < innerHeight * .6) { camera.zoom = portraitView.zoom; camera.updateProjectionMatrix(); fitLabels(); manualCamera = new THREE.Vector3(portraitView.focus[0], 0, portraitView.focus[1]); }
  }
  return {
    scene, camera, update, reset, stopMovement, moveToNpc,
    moveToPoint(x,z){return requestRoute({x,z},null);},
    canStand,
    invalidateNavigation(){collidersDirty=true;},
    prepareNavigation(){syncColliders();},
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
    // pickOnly: only report the tapped object to onSelect, never walk (used while Auto drives the character).
    moveToScreen(clientX, clientY, rect, onSelect = null, pickOnly = false) {
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
      if (farming && !pickOnly) focused = npcId; // pickOnly (Auto): không bật vòng chọn
      if (npcId && onSelect?.(npcId, {fromPlot,action:pickedAction})) return true;
      if (pickOnly) return false;
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
      if (changed) { stopMovement(); collidersDirty = true; }
    },
    // Ẩn/hiện một vật chạm được (Cổng Hội đồng F-45): vật ẩn không chặn đường, không chạm được, không gợi ý.
    setActorVisible(id, visible) {
      const actor = actors.get(id);
      if (!actor || actor.group.visible === visible) return false;
      actor.group.visible = visible; collidersDirty = true; return true;
    },
    // Lia camera tới một vật (lối tắt Sổ tay → Hội đồng); đi bộ hay kéo camera thì camera lại theo nhân vật.
    focusOn(id) { const npc = NPCS.find(item => item.id === id); if (npc) manualCamera = new THREE.Vector3(npc.position[0], 0, npc.position[1]); },
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
      // Undo only what the status sign did (the café hides some name plates itself), then a text status below may take the spot again.
      if (status.plateHidden) { status.namePlate.visible = true; status.plateHidden = false; }
      const hidePlate = () => { if (status.namePlate?.visible) { status.namePlate.visible = false; status.plateHidden = true; } }; // one overhead label at a time
      if (status.namePlate) status.sign.visible = false;
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
        status.processing=jobs.length>0; status.ready=false; status.anchor.visible=status.processing;if(status.processing)hidePlate();
        status.anchor.position.y=id==='dryer' ? 2.85 : 3.75;
        status.badge.visible=false;status.sign.visible=false;status.floorIcon.visible=false;status.bag.visible=false;status.bar.visible=false;
        return;
      }
      if (icon) {
        status.processing = Boolean(text); status.icon = icon; status.startedAt = startedAt; status.readyAt = readyAt; if (status.processing) hidePlate();
        status.ready = ready; status.units=units; status.anchor.visible = status.processing;status.badge.userData.statusAction=ready ? 'collect' : icon==='🔄' ? 'turn' : 'select';
        status.anchor.position.y = id === 'dryer' ? 2.85 : 3.75;
        status.badge.visible = status.processing; status.sign.visible = false; status.bag.visible = false; status.bar.visible = false;
        drawProcessingBadge(status,progress || 0,ready);
        return;
      }
      status.badge.visible=false;
      status.anchor.visible = Boolean(text);
      if (!id.startsWith('plot-')) { status.sign.visible = Boolean(text && String(text).trim()); if (status.sign.visible) hidePlate(); } // one plate per object: status replaces the name
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
        const base = status.sign.userData.baseScale; if (base) { base.copy(next.scale); fitLabel(status.sign); } // new text, new plate width
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
      slot.add(model); collidersDirty = true; return true;
    },
    getAssetSlots() { return [...assetSlots.keys()]; },
    panCamera(fromX, fromY, toX, toY, rect) {
      if (!rect.width || !rect.height) return;
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
      camera.zoom = THREE.MathUtils.clamp(camera.zoom+delta,.8,1.65); camera.updateProjectionMatrix(); fitLabels();
    },
    // Q5 R13: cuộn camera khi kéo công cụ chạm mép màn. (sx,sy) ∈ [-1,1] theo màn hình (sy>0 = xuống), speed = đơn vị/giây; kẹp trong worldBounds như panCamera.
    scrollCamera(sx, sy, speed, dt) {
      if (!farming || (!sx && !sy)) return;
      if (!manualCamera) manualCamera = cameraTarget.clone();
      const step = speed * dt / camera.zoom;
      manualCamera.x = THREE.MathUtils.clamp(manualCamera.x + sx * step, worldBounds.minX, worldBounds.maxX);
      manualCamera.z = THREE.MathUtils.clamp(manualCamera.z + sy * step, worldBounds.minZ, worldBounds.maxZ);
    },
    freezeCamera() { manualCamera=camera.position.clone().sub(cameraOffset); },
    resetCamera() { manualCamera = null; },
    setTarget(id) { targetId = id; },
    setQuestArrow(id) { targetId = id ?? null; }, // same marker as setTarget; null hides it
    setWorkerTargets(ids){workerTargets.clear();for(const id of ids)workerTargets.add(id);},
    setPlotSelection(ids) {selectedPlots.clear();for(const id of ids)selectedPlots.add(id);},
    removePlotSelection(id) {selectedPlots.delete(id);},
    // Q5 R12: hàng đợi việc theo thứ tự (phần tử đầu = ô kế tiếp). Sáng nhạt + số 1..n; gọi lại với danh sách cũ thì bỏ qua.
    setPlotQueue(ids) {
      const key = ids.join('|'); if (key === queueKey) return; queueKey = key;
      queuedPlots.clear(); for (const id of ids) queuedPlots.add(id);
      ids.forEach((id, index) => {
        const actor = actors.get(id); if (!actor) return;
        let badge = queueBadges[index];
        if (!badge) {
          badge = label(String(index + 1), '#d6b56c', .65); badge.material.depthTest = false; badge.renderOrder = 6; badge.userData.nonSolid = true; badge.userData.noPick = true;
          scene.add(keepOnScreen(badge, 22)); fitLabel(badge); queueBadges[index] = badge;
        }
        badge.position.set(actor.group.position.x, 1.1, actor.group.position.z); badge.visible = true;
      });
      for (let index = ids.length; index < queueBadges.length; index++) queueBadges[index].visible = false;
    },
    setFocus(id) { focused = id; },
    // Quay mặt về một vật tại chỗ, không đi bộ (Hội đồng F-45, CT-3); bước đi kế tiếp tự bỏ hướng này.
    faceTo(id) { const npc = NPCS.find(item => item.id === id); if (!npc) return; const dx = npc.position[0] - character.position.x, dz = npc.position[1] - character.position.z; if (Math.hypot(dx, dz) > .05) faceYaw = Math.atan2(dx, dz); },
    setUnlocked(value) { unlocked = value; },
    setReturning(value) { returning = value; },
    resize(width, height) {
      const aspect = width/Math.max(1,height);
      camera.aspect = aspect; camera.fov = width < 700 ? 55 : 43;
      // Tall phone: pull the camera back so a wide room (café counters) still fits across the narrow screen.
      cameraOffset.copy(baseOffset).multiplyScalar(aspect < .75 ? portraitView.dolly : 1);
      camera.updateProjectionMatrix();
      viewHeight = height; viewWidth = width; fitLabels();
    },
    dispose() { motion.dispose(); disposeScene(scene); sun.shadow.dispose(); },
  };
}
