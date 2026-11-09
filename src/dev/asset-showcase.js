// Gedeo hero-asset QA scene (/asset-showcase.html): the four hero plants at real scale under one Gedeo highland light rig,
// plus an instanced coffee block under the shade trees. Camera presets for front / side / three-quarter QA shots and a
// live stats readout (FPS, draw calls, triangles, GPU objects, JS heap). window.__showcase drives it from automation.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createPlant, createPlantInstances, createActor, GEDEO_MODELS, GEDEO_ACTORS } from '../shared/three/gedeo-vegetation.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const SKY = new THREE.Color(0xb9cfe0);
scene.background = SKY; scene.fog = new THREE.Fog(SKY, 45, 140);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .1, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .495;

// Gedeo highland light: warm low-ish sun, cool sky fill, red-earth bounce.
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x7a4a2c, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.position.set(28, 36, 18); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 140 });
scene.add(sun, sun.target);

// Red-brown Gedeo soil with grass patches and leaf litter (canvas texture, tiled).
function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#7a4630'; g.fillRect(0, 0, 512, 512);
  const rnd = mulberry(7);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 1 + rnd() * 5, t = rnd();
    g.fillStyle = t < .45 ? `rgba(${90 + rnd() * 40},${48 + rnd() * 20},${30 + rnd() * 12},.55)`
      : t < .8 ? `rgba(${70 + rnd() * 40},${95 + rnd() * 50},${35 + rnd() * 20},.5)` : `rgba(${120 + rnd() * 40},${90 + rnd() * 30},${50},.5)`;
    g.beginPath(); g.ellipse(x, y, r, r * (.4 + rnd() * .6), rnd() * 3, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(40, 40);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: .97 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// Hero layout (metres, real scale). Blender (x, y) → three (x, -y).
const HEROES = {
  coffee: { pos: [0, 0, 0], focus: [0, 1, 0], dist: 4.2 },
  enset: { pos: [4.5, 0, -1], focus: [4.5, 3.2, -1], dist: 12 },
  cordia: { pos: [-10, 0, -7], focus: [-10, 5, -7], dist: 22 },
  albizia: { pos: [15, 0, -12], focus: [15, 7.5, -12], dist: 30 },
};
const loaded = {};
const place = async (key, pos, rotY = 0, state) => { const o = await createPlant(key, { state }); o.position.set(...pos); o.rotation.y = rotY; scene.add(o); return o; };
await Promise.all(Object.entries(HEROES).map(async ([k, h]) => { loaded[k] = await place(k, h.pos, .4, k === 'coffee' ? 'ripe' : undefined); }));

// Coffee crop stages in a row (x = -6 … 6, z = 2.5): seedling → young → mature → flowering → green → ripe → harvested.
const STAGES = [['coffeeSeedling'], ['coffeeYoung'], ['coffee', 'mature'], ['coffee', 'flowering'], ['coffee', 'green'], ['coffee', 'ripe'], ['coffee', 'harvested']];
await Promise.all(STAGES.map(([k, st], i) => place(k, [-6 + i * 2, 0, 2.5], .3, st)));

// Homestead (z < -16): tukul, coffee store, water tank, worker shelter, three drying beds (fresh / drying / dry), sacks.
const HOME = { tukul: [[-6, 0, -20], .2], warehouse: [[6, 0, -21], -.15], waterTank: [[-.5, 0, -16.5], 0], shelter: [[-14, 0, -18], .5], sacks: [[2.2, 0, -16.8], .3] };
await Promise.all(Object.entries(HOME).map(([k, [p, r]]) => place(k, p, r)));
await Promise.all(['fresh', 'drying', 'dry'].map((st, i) => place('dryingBed', [-2 + i * 1.9, 0, -11], Math.PI / 2, st)));

// Instanced coffee block (LOD1) in rows under the shade, slight jitter — 1 draw call per material for the whole block.
const rnd = mulberry(3), rows = [];
for (let r = 0; r < 6; r++) for (let i = 0; i < 12; i++) {
  const st = rnd(); // mixed crop like a real block: mostly ripe, some green / still flowering
  rows.push({ position: new THREE.Vector3(-14 + i * 1.9 + rnd() * .3, 0, 6 + r * 2.1 + rnd() * .3), rotationY: rnd() * 6.28, scale: .85 + rnd() * .3,
    state: st < .65 ? 'ripe' : st < .9 ? 'green' : 'flowering' });
}
scene.add(await createPlantInstances('coffee', rows, { lod: 2 }));
// Enset rows around a homestead edge (instanced LOD1).
const ensets = Array.from({ length: 7 }, (_, i) => ({ position: new THREE.Vector3(10 + i * 3.2, 0, 6 + (i % 2) * 1.5), rotationY: i * 1.7, scale: .8 + (i % 3) * .12 }));
scene.add(await createPlantInstances('enset', ensets, { lod: 1 }));

// Workers (x 32…46, z = -2) and robots (x 32…48, z = -9), each playing its job clip, facing the camera side (+z).
const mixers = [];
const WORKERS = ['pickerF', 'pickerM', 'waterer', 'pruner', 'planter', 'hauler', 'processor', 'supervisor'];
const ROBOTS = ['harvestBot', 'waterBot', 'pruneBot', 'plantBot', 'droneBot', 'haulBot'];
await Promise.all([...WORKERS.map((k, i) => [k, [32 + i * 2, 0, -2]]), ...ROBOTS.map((k, i) => [k, [32 + i * 3.2, 0, -9]])].map(async ([k, p]) => {
  const a = await createActor(k); a.object.position.set(...p); scene.add(a.object); mixers.push(a);
}));
window.__actors = mixers;

// Processing, compost, terraces, fences, path, nature, props.
const ENV = [['wetMill', [16, 0, -20], -.3], ['compost', [-22, 0, -19], .4], ['props', [-12, 0, -13], .2],
  ...[-14, -10, -6, -2, 2, 6].map(x => ['terraceWall', [x, 0, 4.6], 0]),
  ...[-12, -9, -6, -3, 3, 6, 9, 12].map(x => ['fence', [x, 0, -26], 0]), ['fenceGate', [0, 0, -26], 0],
  ['rocks', [-19, 0, 2], .5], ['shrub', [-17, 0, -6], 0], ['shrub', [13, 0, -4], 1], ['shrub', [-20, 0, -10], 2],
  ...[-6, -2, 2].map(z => ['dirtPath', [-9, 0, z * 1 - 6], Math.PI / 2])];
await Promise.all(ENV.map(([k, p, r]) => place(k, p, r)));
const grnd = mulberry(9);
await Promise.all(Array.from({ length: 40 }, () => place('grass', [(grnd() - .5) * 50, 0, -28 + grnd() * 36], grnd() * 6)));

// Camera presets for QA shots.
const views = {
  overview: () => look([2, 3.5, -2], [-14, 12, 30]),
  ...Object.fromEntries(Object.entries(HEROES).flatMap(([k, h]) => [
    [`${k}-front`, () => look(h.focus, [h.focus[0], h.focus[1] * .7 + .3, h.focus[2] + h.dist])],
    [`${k}-side`, () => look(h.focus, [h.focus[0] + h.dist, h.focus[1] * .7 + .3, h.focus[2]])],
    [`${k}-3q`, () => look(h.focus, [h.focus[0] + h.dist * .72, h.focus[1] + h.dist * .32, h.focus[2] + h.dist * .72])],
  ])),
  stages: () => look([0, .7, 2.5], [1, 2.4, -4.5]),
  homestead: () => look([-2, 2, -17], [10, 11, 0]),
  'tukul-3q': () => look([-6, 2.6, -20], [1, 4.5, -12]),
  'warehouse-3q': () => look([6, 2, -21], [12, 4.5, -13]),
  beds: () => look([0, 1, -11], [3, 3.5, -5.5]),
  field: () => look([-4, .8, 10], [6, 6, 22]),
  'game-cam': () => look([0, 0, 0], [0, 16, 20]),
  workers: () => look([39, .9, -2], [39, 1.7, 5.2]),
  robots: () => look([40, .6, -9], [40, 4.6, 1.5]),
  processing: () => look([15, 1.3, -20], [20, 5.5, -13]),
  terraces: () => look([-6, .6, 4.6], [-2, 3, 11]),
  farm: () => look([-2, 0, -8], [26, 24, 26]),
};
function look(target, eye) { controls.target.set(...target); camera.position.set(...eye); controls.update(); }

const hud = document.getElementById('hud');
for (const name of ['farm', 'workers', 'robots', 'processing', 'terraces', 'game-cam', 'stages', 'field', 'homestead', 'tukul-3q', 'warehouse-3q', 'beds', 'albizia-3q', 'cordia-3q', 'enset-3q']) {
  const b = document.createElement('button'); b.textContent = name;
  b.onclick = () => { views[name](); hud.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  hud.append(b);
}
views.farm();

// Stats.
const statsEl = document.getElementById('stats');
let frames = 0, last = performance.now(), fps = 0;
function stats() {
  const i = renderer.info;
  return { fps, calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05); for (const a of mixers) a.mixer.update(dt);
  controls.update(); renderer.render(scene, camera);
  frames++; const now = performance.now();
  if (now - last > 500) {
    fps = Math.round(frames * 1000 / (now - last)); frames = 0; last = now;
    const s = stats();
    statsEl.textContent = `fps ${s.fps}  calls ${s.calls}  tris ${(s.triangles / 1000).toFixed(1)}k\ngeo ${s.geometries}  tex ${s.textures}${s.heapMB ? `  heap ${s.heapMB}MB` : ''}`;
  }
});
window.__showcase = { setView: n => views[n]?.(), views: Object.keys(views), stats, models: Object.keys(GEDEO_MODELS), ready: true };
