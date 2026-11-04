import * as THREE from 'three';
import { createPlayerMotion } from '../../characters/motion.js';
import { getCharacterBounds } from '../../characters/bounds.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { LANDING_TIME, LANDING_PAUSE } from './timeline.js';
import { approachOffsetX } from './collision.js';
import { gripStretcher, crouchMedic } from './rescue.js';
import { t } from '../../i18n/index.js';

const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const phase = (t, start, end) => clamp((t - start) / (end - start), 0, 1);
const smooth = (t, a, b) => { const p = phase(t, a, b); return p * p * (3 - 2 * p); };

export function createIntro(profile, selectedPlayer) {
  const scene = new THREE.Scene();
  const streetColor = new THREE.Color('#e4eed9');
  const skyColor = new THREE.Color('#f5f4ed');
  scene.background = streetColor.clone();
  scene.fog = new THREE.Fog(streetColor, 35, 90);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 160);
  const materials = new Map();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);
  const textures = [];
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .9 }));
    return materials.get(color);
  }
  function mesh(parent, geometry, color, x, y, z, sx, sy, sz) {
    const object = new THREE.Mesh(geometry, material(color));
    object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const box = (parent, color, x, y, z, w, h, d) => mesh(parent, boxGeometry, color, x, y, z, w, h, d);
  const ball = (parent, color, x, y, z, w, h, d) => mesh(parent, sphereGeometry, color, x, y, z, w, h, d);
  function sign(parent, text, x, y, z, width, color = '#f2db9f', ink = '#29483c') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = ink; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 67, 480);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const mat = new THREE.MeshBasicMaterial({ map: texture });
    const item = new THREE.Mesh(boxGeometry, mat); item.scale.set(width, width / 4, .06); item.position.set(x, y, z); parent.add(item);
    return item;
  }
  // Slots are fixed wrappers: animation and gameplay anchors stay outside the replaceable art.
  const assetSlots = new Map();
  const retiredAssets = new THREE.Group(); retiredAssets.name = 'retired-assets'; retiredAssets.visible = false; scene.add(retiredAssets);
  function assetSlot(parent, id, x = 0, y = 0, z = 0) {
    const group = new THREE.Group(); group.name = `asset:${id}`; group.userData.assetSlot = id;
    group.position.set(x, y, z); parent.add(group); assetSlots.set(id, group); return group;
  }
  scene.add(new THREE.HemisphereLight('#fff3d9', '#658675', 2.5));
  const sun = new THREE.DirectionalLight('#ffe1a1', 3); sun.position.set(-8, 18, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -23, right: 23, top: 20, bottom: -20 }); sun.shadow.normalBias = .04; scene.add(sun);
  const street = new THREE.Group(); scene.add(street);
  const road = assetSlot(street, 'intro/street/road');
  const shops = assetSlot(street, 'intro/street/shops');
  const trees = assetSlot(street, 'intro/street/trees');
  box(road, '#a2b49a', 0, -.45, 0, 80, .6, 45);
  box(road, '#8e9d8c', 0, -.08, 6, 80, .12, 10);
  box(road, '#c3b99e', 0, .1, -.4, 80, .35, 4.8);
  for (let x = -30; x < 34; x += 3) box(road, '#eee0b7', x, .01, 7, 1.4, .025, .13);
  for (let x = -25; x < 30; x += 1.25) {
    box(road, '#dfd4b6', x, .29, 1.9, 1.1, .1, .24);
  }
  const palette = ['#d7bb7d', '#91a48a', '#ba8f71', '#e3cc99', '#6b9185', '#c7aa86', '#d2bb82'];
  for (let i = 0; i < 11; i++) {
    const x = (i - 5) * 5.2; const height = 6 + (i % 3) * 1.3;
    box(shops, palette[i % palette.length], x, height / 2, -6, 4.9, height, 5);
    box(shops, '#6e5544', x, height + .12, -6, 5.3, .3, 5.4);
    box(shops, '#435d4e', x, 1.6, -3.44, 3.5, 2.7, .12);
    for (let floor = 0; floor < 2; floor++) for (const dx of [-1.3, 1.3]) {
      const y = 4.1 + floor * 2.1;
      if (y > height - .5) continue;
      box(shops, '#334f46', x + dx, y, -3.43, .95, 1.4, .12);
      box(shops, '#d4cfad', x + dx, y, -3.32, .08, 1.4, .12);
      box(shops, '#647463', x + dx, y - .7, -3, 1.3, .12, .8);
      box(shops, '#324c40', x + dx, y - .35, -2.65, 1.3, .07, .07);
    }
    const awning = box(shops, i % 2 ? '#bd7156' : '#d2bb86', x, 2.9, -2.8, 4.5, .16, 1.6); awning.rotation.x = .16;
    for (let j = 0; j < 7; j++) box(shops, i % 2 ? '#e7d5aa' : '#577d68', x - 1.8 + j * .6, 2.87, -2.78, .28, .18, 1.62).rotation.x = .16;
    sign(shops, [t('intro.sign.cafe'), t('intro.sign.grocery'), t('intro.sign.bunCha'), t('intro.sign.oldHanoi')][i % 4], x, 3.05, -1.94, 3.7);
    box(shops, '#c09b6a', x, .8, -2.5, 1.4, .12, .8);
    for (const dx of [-.9, .9]) box(shops, '#a14f3c', x + dx, .38, -1.8, .45, .6, .45);
  }
  for (const x of [-13, -3, 12, 24]) {
    mesh(trees, cylinderGeometry, '#655943', x, 2.3, -.8, .15, 4.6, .15);
    for (let i = 0; i < 5; i++) ball(trees, ['#5b7b52', '#6f8e60', '#7d975f'][i % 3], x + Math.cos(i * 2) * .8, 4.8 + (i % 2) * .6, -.8 + Math.sin(i * 2), 1.5, 1.3, 1.5);
    box(trees, '#9a8b6d', x, .35, -.8, 1.1, .7, 1.1);
  }
  const person = (color, medical = false) => createPerson(color, { medical });
  const hero = selectedPlayer; hero.name = 'intro-player'; street.add(hero);
  hero.visible = true; hero.updateMatrixWorld(true);
  // Gameplay needs fresh material state after shader warmup in the selection scene.
  const previewMaterials = new Set();
  hero.traverse(object => {
    if (!object.isMesh) return;
    const copy = source => { previewMaterials.add(source); return source.clone(); };
    object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
  });
  previewMaterials.forEach(source => source.dispose());
  const heroMotion = createPlayerMotion(hero);
  const motions = [heroMotion];
  heroMotion.update('fall', 1.05);
  hero.rotation.y = Math.PI / 2;
  hero.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
  hero.updateMatrixWorld(true);
  const fallenHeight = .28 - getCharacterBounds(hero, new THREE.Box3()).min.y;
  hero.rotation.set(0, 0, 0); heroMotion.update('rest', 0);
  // Post pivots at its foot; the board slot pivots at its centre so the hit wobble stays in the wrapper.
  const warning = new THREE.Group(); warning.name = 'intro-warning'; street.add(warning);
  const warningPost = assetSlot(warning, 'intro/warning-sign/post', 3, 0, -2.2);
  box(warningPost, '#526557', 0, 1.55, 0, .12, 3.1, .12);
  box(warningPost, '#526557', 0, 2.65, .75, .12, .12, 1.6);
  const warningBoard = assetSlot(warning, 'intro/warning-sign/board', 3, 1.85, -.73);
  sign(warningBoard, t('intro.sign.mindHead'), 0, 0, 0, 1.9, '#f0ca76', '#7b3a2c');
  const warningParts = [warningPost, warningBoard];
  const warningBounds = warningParts.map(() => new THREE.Box3());
  const heroBounds = new THREE.Box3();
  hero.position.set(3, .3, -.8); hero.rotation.y = Math.PI / 2;
  heroMotion.update('fall', 0);
  getCharacterBounds(hero, heroBounds);
  warningParts.forEach((part, i) => warningBounds[i].setFromObject(part, true));
  const contactX = 3 + approachOffsetX(heroBounds, warningBounds);
  hero.position.set(0, 0, 0); hero.rotation.set(0, 0, 0); heroMotion.update('rest', 0);
  // Capture the actual collision-resolved fall once; rescue and soul share this anchor.
  heroMotion.update('fall', 1.05);
  hero.position.set(contactX - .2, fallenHeight, -.8);
  hero.rotation.set(0, Math.PI / 2, 0);
  hero.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
  getCharacterBounds(hero, heroBounds);
  hero.position.x += approachOffsetX(heroBounds, warningBounds);
  getCharacterBounds(hero, heroBounds);
  const fallenPosition = hero.position.clone();
  const fallenRotation = hero.quaternion.clone();
  const fallenCenter = heroBounds.getCenter(new THREE.Vector3());
  const bodyCenterOffset = fallenCenter.clone().sub(fallenPosition);
  const pickupZ = fallenCenter.z + 1.05;
  const liftHeight = 1.155 - heroBounds.min.y;
  const ambulanceX = fallenCenter.x + 3.1;
  hero.position.set(0, 0, 0); hero.rotation.set(0, 0, 0); heroMotion.update('rest', 0);
  const bicycle = new THREE.Group(); street.add(bicycle);
  const bike = assetSlot(bicycle, 'intro/bicycle');
  const wheelGeometry = new THREE.TorusGeometry(.43, .055, 6, 16);
  for (const x of [-.7, .7]) {
    mesh(bike, wheelGeometry, '#35463c', x, .48, 0, 1, 1, 1);
    box(bike, '#bbc5ae', x, .48, 0, .78, .035, .035);
    box(bike, '#bbc5ae', x, .48, 0, .035, .78, .035);
  }
  function frameTube(ax, ay, bx, by) {
    const tube = box(bike, '#9e5944', (ax + bx) / 2, (ay + by) / 2, 0, .07, Math.hypot(bx - ax, by - ay), .07);
    tube.rotation.z = -Math.atan2(bx - ax, by - ay);
  }
  for (const [ax, ay, bx, by] of [[-.7,.48,-.25,1.1],[-.25,1.1,.1,.48],[.1,.48,-.7,.48],[-.25,1.1,.55,1.1],[.55,1.1,.1,.48],[.55,1.1,.7,.48],[.55,1.1,.5,1.35]]) frameTube(ax, ay, bx, by);
  box(bike, '#35463c', -.25, 1.15, 0, .4, .09, .22);
  box(bike, '#35463c', .5, 1.35, 0, .08, .07, .6);
  const cyclist = person('#799ca0'); cyclist.scale.setScalar(.8); cyclist.position.set(-.2, .55, 0); cyclist.rotation.y = Math.PI / 2; bike.add(cyclist);
  const impact = new THREE.Group(); street.add(impact);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7;
    const ray = box(impact, '#ffe3a0', Math.cos(angle) * .48, Math.sin(angle) * .48, 0, .08, .3, .06);
    ray.rotation.z = angle - Math.PI / 2;
  }

  const vehicle = new THREE.Group(); vehicle.name = 'intro-ambulance'; street.add(vehicle);
  const van = assetSlot(vehicle, 'intro/ambulance');
  box(van, '#edeadd', 0, 1.25, 0, 4.1, 2.2, 1.9); box(van, '#e7e4d5', 2.35, .95, 0, 1.2, 1.5, 1.9);
  box(van, '#7daca9', 2.35, 1.62, .96, .8, .6, .03); box(van, '#7daca9', 2.97, 1.6, 0, .03, .65, 1.65);
  box(van, '#bf5e4b', 0, .9, .97, 4, .19, .025);
  box(van, '#c66250', -.6, 1.65, .98, .64, .2, .03); box(van, '#c66250', -.6, 1.65, .98, .2, .64, .03);
  const siren = box(van, '#db624a', 1.1, 2.48, 0, .8, .22, .55);
  for (const x of [-1.25, 1.85]) for (const z of [-.95, .95]) {
    const wheel = mesh(van, cylinderGeometry, '#303d36', x, .42, z, .43, .24, .43); wheel.rotation.x = Math.PI / 2;
  }
  sign(van, t('intro.sign.ambulance'), -.2, 2.13, .99, 1.8, '#edeadd', '#a94f42');
  const medics = [person('#f1eadb', true), person('#f1eadb', true)];
  medics.forEach((m, i) => { m.name = `intro-medic-${i}`; street.add(m); dressPerson(m, i ? 'intro/medic-f.glb' : 'intro/medic-m.glb'); });
  // Medics grip local (±1.2, .9, ±.31); a replacement bed keeps its handles there.
  const stretcher = new THREE.Group(); stretcher.name = 'intro-stretcher'; street.add(stretcher);
  const bed = assetSlot(stretcher, 'intro/stretcher');
  box(bed, '#638c84', 0, .78, 0, 2.1, .15, .75);
  for (const x of [-.8, .8]) for (const z of [-.25, .25]) box(bed, '#9da99e', x, .42, z, .07, .7, .07);
  for (const x of [-1.1, 1.1]) for (const z of [-.31, .31]) box(bed, '#9da99e', x, .9, z, .5, .07, .07);
  const soul = clone(hero);
  const soulMotion = createPlayerMotion(soul, heroMotion.restPose); motions.push(soulMotion);
  scene.add(soul);
  const soulMaterials = [];
  soul.traverse(object => {
    if (!object.isMesh) return;
    const ghostMaterial = source => {
      const ghost = source.clone(); ghost.color?.set('#c7f1e8');
      ghost.emissive?.set('#80c5bb'); ghost.emissiveIntensity = .45;
      ghost.transparent = true; ghost.opacity = 0; ghost.depthWrite = false;
      soulMaterials.push(ghost);
      return ghost;
    };
    object.material = Array.isArray(object.material) ? object.material.map(ghostMaterial) : ghostMaterial(object.material);
    object.castShadow = false;
  });
  // Root moves and turns; the chain hangs from root-local (-1.05, 1.3, 0), outside the art slot.
  const reaper = new THREE.Group(); scene.add(reaper);
  const reaperArt = assetSlot(reaper, 'intro/reaper');
  mesh(reaperArt, new THREE.ConeGeometry(.65, 1.8, 12), '#283437', 0, .95, 0, 1, 1, 1);
  ball(reaperArt, '#283437', 0, 1.95, 0, .48, .55, .4);
  ball(reaperArt, '#101c24', 0, 1.96, .28, .33, .36, .15);
  for (const x of [-.13, .13]) ball(reaperArt, '#a7ffe1', x, 2, .41, .045, .05, .025);
  const pullingArm = box(reaperArt, '#283437', -.65, 1.3, 0, .9, .22, .25);
  pullingArm.rotation.z = -.25;
  box(reaperArt, '#967b57', .65, 1.4, 0, .08, 2.8, .08);
  const blade = mesh(reaperArt, new THREE.TorusGeometry(.7, .085, 6, 18, Math.PI * .8), '#ccdcd4', .1, 2.5, 0, 1, .55, 1);
  blade.rotation.z = .2;
  const chainGeometry = new THREE.BufferGeometry();
  const chainPositions = new Float32Array(18);
  chainGeometry.setAttribute('position', new THREE.BufferAttribute(chainPositions, 3));
  const chain = new THREE.Line(chainGeometry, new THREE.LineBasicMaterial({ color: '#a0eedc' }));
  chain.frustumCulled = false; scene.add(chain);
  const heaven = new THREE.Group(); scene.add(heaven);
  // Walkable path top sits at the slot origin (y = 14.78); the soul lands and walks on it.
  const path = assetSlot(heaven, 'intro/heaven/path', 0, 14.78, 0);
  for (let i = 0; i < 32; i++) {
    const angle = i * 2.4; const r = 5 + (i % 7) * 2.6;
    ball(path, '#f4f1e4', Math.cos(angle) * r, -2.08 + (i % 4) * .3, Math.sin(angle) * r, 3.2, .65, 2.8);
  }
  box(path, '#ecdfbf', 0, -.18, -12, 7, .35, 22);
  const gate = new THREE.Group(); gate.position.z = -9; heaven.add(gate);
  const gateFrame = assetSlot(gate, 'intro/heaven/gate/frame', 0, 14.8, -7.5);
  for (const x of [-2.7, 2.7]) {
    box(gateFrame, '#e1c58b', x, 2.2, 0, .45, 5, .5);
    box(gateFrame, '#f6e7bc', x, .1, 0, .8, .4, .8);
    ball(gateFrame, '#fff3cd', x, 4.8, 0, .4, .4, .4);
  }
  const archGeometry = new THREE.TorusGeometry(2.7, .16, 8, 40, Math.PI);
  mesh(gateFrame, archGeometry, '#e1c58b', 0, 4.5, 0, 1, 1, 1);
  // Hinges own the opening rotation; each leaf slot pivots at its hinge and extends towards the centre.
  const doors = [-1, 1].map(side => {
    const hinge = new THREE.Group(); hinge.position.set(side * 2.5, 14.8, -7.5); gate.add(hinge);
    const leaf = assetSlot(hinge, `intro/heaven/gate/${side < 0 ? 'left' : 'right'}-leaf`);
    const center = -side * 1.25;
    for (const y of [.15, 2.2, 4.5]) box(leaf, '#e6ce96', center, y, 0, 2.5, .12, .14);
    for (let i = 0; i <= 6; i++) {
      const x = -side * i * 2.5 / 6;
      box(leaf, '#e6ce96', x, 2.3, 0, .065, 4.5, .08);
      ball(leaf, '#fff0be', x, 4.65, 0, .09, .17, .09);
    }
    ball(leaf, '#f8df9c', -side * 2.3, 2.2, .15, .12, .12, .12);
    return hinge;
  });
  // Soft cloud billboards share one procedural texture and drift at different depths.
  const cloudCanvas = document.createElement('canvas'); cloudCanvas.width = cloudCanvas.height = 128;
  const cloudContext = cloudCanvas.getContext('2d');
  const gradient = cloudContext.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(.45, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  cloudContext.fillStyle = gradient; cloudContext.fillRect(0, 0, 128, 128);
  const cloudTexture = new THREE.CanvasTexture(cloudCanvas); textures.push(cloudTexture);
  const mist = new THREE.Group(); heaven.add(mist);
  const clouds = [];
  for (let i = 0; i < 54; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, opacity: .25, depthWrite: false, fog: false });
    const cloud = new THREE.Sprite(mat);
    const side = i % 2 ? 1 : -1;
    cloud.position.set(side * (10 + i % 8), 12.5 + i % 4 * .45, 12 - i * .55);
    cloud.scale.set(5 + i % 3, 2 + i % 2, 1);
    cloud.userData.baseX = cloud.position.x; cloud.userData.baseY = cloud.position.y;
    mist.add(cloud); clouds.push(cloud);
  }
  const soulContact = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .8), new THREE.MeshBasicMaterial({ map: cloudTexture, color: '#9bbfae', transparent: true, opacity: 0, depthWrite: false }));
  soulContact.rotation.x = -Math.PI / 2; soulContact.position.y = 14.79; scene.add(soulContact);
  const soulDustPositions = new Float32Array(48 * 3);
  const soulDustGeometry = new THREE.BufferGeometry();
  soulDustGeometry.setAttribute('position', new THREE.BufferAttribute(soulDustPositions, 3));
  const soulDustMaterial = new THREE.PointsMaterial({ map: cloudTexture, color: '#d4fff3', size: .15, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const soulDust = new THREE.Points(soulDustGeometry, soulDustMaterial); scene.add(soulDust);
  const glow = new THREE.PointLight('#fff2cf', 35, 24, 2); glow.position.set(0, 18, -19); heaven.add(glow);
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: '#fffdf5', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), whiteMaterial);
  veil.position.z = -.2; veil.renderOrder = 1000; veil.frustumCulled = false;
  camera.add(veil); scene.add(camera);
  const cameraFrom = new THREE.Vector3();
  const streetFocus = new THREE.Vector3();
  const fallRotation = new THREE.Quaternion();
  const fallAxis = new THREE.Vector3(0, 0, 1);
  const cameraTo = new THREE.Vector3(0, 18, 6);
  const target = new THREE.Vector3();
  const heavenFocus = new THREE.Vector3(0, 17.3, -27);
  const soulOrigin = fallenPosition.clone().add(new THREE.Vector3(0, liftHeight, pickupZ - fallenPosition.z));
  const lyingRotation = fallenRotation;
  const soulCenter = new THREE.Vector3();
  const chainHand = new THREE.Vector3();
  const reaperOffset = new THREE.Vector3();
  const uprightChest = new THREE.Vector3(0, 1.1, 0);
  const uprightRotation = new THREE.Quaternion();
  function walk(person, amount) {
    person.userData.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(amount * 7 + i * Math.PI) * .5; });
    person.userData.arms.forEach((arm, i) => { arm.rotation.x = -Math.sin(amount * 7 + i * Math.PI) * .35; });
  }
  function update(time, preview = false, visualTime = time) {
    const seconds = preview ? 0 : time;
    const standingOnPath = seconds >= LANDING_TIME && seconds < LANDING_TIME + LANDING_PAUSE;
    // Only walking waits after landing; the camera, clouds and flight keep moving.
    const journeyTime = seconds - clamp(seconds - LANDING_TIME, 0, LANDING_PAUSE);
    const flight = smooth(seconds, 9.8, 16);
    const ascend = flight;
    scene.background.copy(streetColor).lerp(skyColor, ascend); scene.fog.color.copy(scene.background);
    scene.fog.near = mix(35, 18, ascend); scene.fog.far = mix(90, 65, ascend);
    street.visible = ascend < .98; heaven.visible = seconds > 8;
    const dodge = smooth(seconds, 2, 2.75);
    const turnBack = smooth(seconds, 2.6, 3);
    const faceForward = smooth(seconds, 3.05, 3.35);
    const fall = smooth(seconds, 3.65, 4.45);
    hero.position.set(mix(-4.5, contactX, phase(seconds, 0, 3.4)) - fall * .2, mix(.3, fallenHeight, fall), mix(.65, -.8, dodge));
    hero.rotation.set(0, mix(Math.PI / 2, -Math.PI / 2, turnBack * (1 - faceForward)), 0);
    hero.quaternion.premultiply(fallRotation.setFromAxisAngle(fallAxis, fall * Math.PI / 2));
    hero.visible = seconds < 13.5;
    heroMotion.update(seconds < 3.4 ? 'walk' : 'fall', seconds < 3.4 ? seconds * 1.5 : seconds - 3.4);
    bicycle.position.set(mix(-15, 19, phase(seconds, 0, 5.5)), .3, .65);
    bicycle.visible = seconds < 5.5;
    warningBoard.rotation.z = Math.sin((seconds - 3.4) * 18) * .13 * (1 - smooth(seconds, 3.4, 5));
    if (seconds < 3.4) warningBoard.rotation.z = 0;
    // Per-vertex skinned bounds cost ~60% of an intro frame on phones: only measure while the result is used
    // (from 4.45 s the fallen pose overwrites the position; the impact flash ends at 3.75 s).
    if (seconds < 4.45) {
      warningParts.forEach((part, i) => warningBounds[i].setFromObject(part, true));
      // A metre short of the contact point no limb reaches the sign, so the offset would be 0.
      if (hero.position.x > contactX - 1) {
        getCharacterBounds(hero, heroBounds);
        hero.position.x += approachOffsetX(heroBounds, warningBounds);
      }
      impact.position.set(warningBounds[1].min.x, 1.9, -.55);
    }
    impact.visible = seconds >= 3.4 && seconds < 3.75;
    impact.scale.setScalar(1 + phase(seconds, 3.4, 3.75) * .5);
    const approach = smooth(seconds, 6.4, 7.7);
    const pickup = smooth(seconds, 7.9, 8.5);
    const transfer = smooth(seconds, 8.5, 9.2);
    const carry = smooth(seconds, 10.8, 13.5);
    const carryX = (ambulanceX - 2.7 - fallenCenter.x) * carry;
    const carryZ = (4.8 - pickupZ) * carry;
    vehicle.visible = seconds >= 5;
    vehicle.position.set(mix(-25, ambulanceX, smooth(seconds, 5, 6.4)), .12, 4.8);
    siren.material = material(Math.floor(seconds * 7) % 2 ? '#f57450' : '#83c8d0');
    stretcher.visible = seconds >= 6.4 && seconds < 13.5;
    stretcher.position.set(
      mix(ambulanceX - 2.7, fallenCenter.x, approach) + carryX,
      .3,
      mix(3.5, pickupZ, approach) + carryZ,
    );
    if (seconds >= 4.45) {
      hero.position.copy(fallenPosition);
      hero.quaternion.copy(fallenRotation);
      hero.position.y += liftHeight * pickup;
      hero.position.z += (pickupZ - fallenPosition.z) * transfer + carryZ;
      hero.position.x += carryX;
    }
    const supportWeight = smooth(seconds, 7.4, 7.9) * (1 - smooth(seconds, 9.2, 9.5));
    if (supportWeight > 0) getCharacterBounds(hero, heroBounds); // the medics read the body only while supporting it
    medics.forEach((m, i) => {
      const side = i === 0 ? -1 : 1;
      m.visible = seconds >= 6.4 && seconds < 13.5;
      const center = heroBounds.getCenter(new THREE.Vector3());
      m.position.set(mix(stretcher.position.x, center.x, supportWeight) + side * mix(1.65, 1.2, supportWeight), .3, mix(stretcher.position.z, center.z, supportWeight));
      m.rotation.y = -side * Math.PI / 2;
      const moving = (seconds < 7.7 || seconds > 10.8) ? 1 : 0;
      walk(m, moving ? seconds : 0);
      m.rotation.z = 0;
      crouchMedic(m, smooth(seconds, 7.2, 7.8) * (1 - pickup));
      gripStretcher(m, stretcher, side, heroBounds, supportWeight);
    });
    // Separate from the body, straighten while rising, then plant the feet on the path.
    const lift = smooth(seconds, 9.8, 13);
    const driftToGate = smooth(seconds, 13, 14.5);
    const landing = smooth(seconds, 13.7, 14.5);
    const heavenWalk = phase(journeyTime, LANDING_TIME, 21);
    soul.position.set(
      mix(soulOrigin.x, 0, driftToGate),
      mix(mix(soulOrigin.y, 15.2, lift), 14.8, landing),
      mix(soulOrigin.z, -2, driftToGate) - heavenWalk * 18,
    );
    soul.quaternion.copy(lyingRotation).slerp(uprightRotation, smooth(seconds, 10, 12));
    soul.rotation.y += Math.PI * smooth(seconds, 12.5, 14.5);
    soul.scale.setScalar(1);
    const opacity = smooth(seconds, 9.4, 10) * mix(.55, .9, landing);
    soulMaterials.forEach(material => { material.opacity = opacity; });
    soulMotion.update(seconds < 10 ? 'fall' : standingOnPath ? 'rest' : 'walk', seconds < 10 ? 1.05 : Math.max(0, journeyTime - LANDING_TIME) * 1.7, landing);
    soul.visible = seconds >= 9.4 && journeyTime < 21.8;
    reaper.visible = seconds >= 8.8 && journeyTime < 21.8;
    chain.visible = seconds >= 9.4 && journeyTime < 21.8;
    const lead = smooth(seconds, 9.5, 12);
    reaperOffset.set(mix(1.6, 1.4, landing), mix(0, .7, lead) * (1 - landing), mix(1.2, -1.5, lead));
    reaper.position.copy(soul.position).add(reaperOffset);
    reaper.position.y += Math.sin(visualTime * 2) * .04;
    reaper.rotation.y = mix(-Math.PI / 2, Math.PI, lead);
    reaper.rotation.z = -.08 * Math.sin(lead * Math.PI);
    pullingArm.rotation.z = mix(-.25, -.65, smooth(seconds, 9.2, 10.5));
    reaper.updateMatrixWorld(true);
    chainHand.set(-1.05, 1.3, 0).applyMatrix4(reaper.matrixWorld);
    soulCenter.copy(bodyCenterOffset).lerp(uprightChest, smooth(seconds, 10, 12)).add(soul.position);
    for (let i = 0; i < 6; i++) {
      const p = i / 5;
      chainPositions[i * 3] = mix(soulCenter.x, chainHand.x, p);
      chainPositions[i * 3 + 1] = mix(soulCenter.y, chainHand.y, p) - Math.sin(p * Math.PI) * mix(.35, .06, lead);
      chainPositions[i * 3 + 2] = mix(soulCenter.z, chainHand.z, p);
    }
    chainGeometry.attributes.position.needsUpdate = true;
    soulContact.position.x = soul.position.x; soulContact.position.z = soul.position.z;
    soulContact.material.opacity = .25 * landing * (1 - smooth(journeyTime, 20.5, 21.8));
    soulDust.visible = seconds >= 9 && seconds < 12;
    soulDustMaterial.opacity = .75 * (1 - smooth(seconds, 10.5, 12));
    for (let i = 0; i < 48; i++) {
      const age = Math.max(0, seconds - 9 - i * .018);
      const angle = i * 2.4;
      const spread = .12 + age * .2;
      soulDustPositions[i * 3] = soulOrigin.x + bodyCenterOffset.x + Math.cos(angle) * spread;
      soulDustPositions[i * 3 + 1] = soulOrigin.y + bodyCenterOffset.y + age * 1.2;
      soulDustPositions[i * 3 + 2] = soulOrigin.z + Math.sin(angle) * spread;
    }
    soulDustGeometry.attributes.position.needsUpdate = true;
    doors[0].rotation.y = -smooth(journeyTime, 17.7, 18.7) * Math.PI * .48;
    doors[1].rotation.y = smooth(journeyTime, 17.7, 18.7) * Math.PI * .48;
    for (let i = 0; i < clouds.length; i++) {
      const cloud = clouds[i];
      cloud.position.x = cloud.userData.baseX + Math.sin(seconds * .25 + i) * .6;
      cloud.position.y = cloud.userData.baseY + Math.sin(seconds * .35 + i * 2) * .3;
    }
    whiteMaterial.opacity = smooth(journeyTime, 20.5, 22);
    const rescueView = smooth(seconds, 4.3, 6.5);
    streetFocus.set(mix(hero.position.x, fallenCenter.x, rescueView), mix(1.3, 1.8, smooth(seconds, 9.4, 10.5)), mix(hero.position.z, pickupZ, rescueView));
    cameraFrom.set(streetFocus.x + 7, mix(5.8, 8, rescueView), streetFocus.z + mix(10, 14, rescueView));
    camera.position.copy(cameraFrom).lerp(cameraTo, ascend);
    camera.position.z = mix(camera.position.z, -20, smooth(journeyTime, 19.5, 21.8));
    target.copy(streetFocus).lerp(heavenFocus, ascend);
    camera.lookAt(target);
    scene.updateMatrixWorld(true);
  }
  function resize(width, height) {
    const aspect = width / height;
    camera.aspect = aspect;
    // Mobile-first: hold ~40° of horizontal view on narrow screens; cap the vertical FOV to limit distortion.
    camera.fov = clamp(2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) / aspect)), 38, 70);
    // Portrait and short landscape phones: lift the action above the dialogue box.
    if (aspect < 1 || height <= 450) camera.setViewOffset(width, height, 0, height * (aspect < 1 ? .12 : .15), width, height); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function dispose() {
    motions.forEach(motion => motion.dispose());
    disposeScene(scene);
    materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); sun.shadow.dispose();
  }
  update(0, true);
  function replaceAsset(id, model) {
    const slot = assetSlots.get(id);
    if (!slot || !model?.isObject3D || model === slot || model.parent === slot) return false;
    for (const child of [...slot.children]) retiredAssets.add(child);
    model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    slot.add(model); return true;
  }
  return { scene, camera, update, resize, dispose, replaceAsset, getAssetSlots: () => [...assetSlots.keys()] };
}
