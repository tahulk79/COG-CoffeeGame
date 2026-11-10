// Mountain coffee farm dressing (founder 2026-11-08): the Blender village / water / harvest / people / animal sets placed
// around the 4 terraced tiers, outside the plantable lots so they never block planting or building:
//   · south entrance: farm gate arch, dirt road, a mountain stream with a log bridge, market stalls, trader, truck, tiller
//   · west village (tier 1): stilt house, wooden house, wood kitchen, nursery beds, drying yard + pulper, sacks, pond,
//     banana / avocado / durian, chickens, children, elders, beehive
//   · along the tiers: pepper vines (tier 2), bamboo windbreaks (tier 3), goats grazing, harvest corner, the hilltop cistern
//     and channel above the highland, mist on the far hills, a name sign per tier
// Everything stands on layout.farmGroundY. Models are authored with their front to Blender −Y = three +z (south, towards
// the camera); "faces" below are three.js yaw. Animated people / animals tick themselves while drawn (onBeforeRender).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { farmGroundY, TIER_EDGES, ESTATES, ESTATE_ORDER } from '../../core/config/layout.js';
import { GEDEO_MODELS, createPlant, createPlantInstances, tuneGedeoMaterials } from '../../shared/three/gedeo-vegetation.js';
import { gltfLoader } from '../../shared/three/models.js';
import { getQuality } from '../../shared/vfx/index.js';

const N = Math.PI / 2;
// [file, x, z, yaw, scale?]
// founder 2026-11-08: the map starts as wild land — no village, market, vehicles, people, gate or planted trees. Only the
// nature pieces below are placed; the rest of PROPS / ACTORS stays listed for later unlocks (WILD_START filters them).
const SIGN_SCALE = 1.6; // the dark tier name signs: big, and tappable (opens that tier's modal)
const WILD_KEEP = new Set(['wooden-bridge', 'stream', 'mist-bank', 'tier-sign']);
const WILD_START = true;
const PROPS = [
  // south entrance
  ['farm-gate-sign', 0, 31, 0], ['lantern-string', 0, 35.5, 0], ['flag-pole', -4.4, 26.5, .3], ['flag-pole', 4.4, 26.5, -.3],
  ['market-stall', -9, 28.5, .35], ['market-stall', 9.5, 29, -.35], ['motorbike-sacks', 3.4, 33.5, -.5], ['sack-stack', -12.5, 30.5, .2],
  ['farm-truck', 5.5, 50, -.25], ['power-tiller-cart', -5.5, 47, .5], ['wooden-bridge', 0, 41, 0],
  // west village (tier 1)
  ['stilt-house', -53, 21, N], ['wooden-house', -54, 6, N], ['wood-kitchen', -46, 28.5, N], ['nursery-bed', -43.5, 15, 0], ['nursery-bed', -43.5, 18.5, 0],
  ['drip-line', -43.5, 21.5, 0], ['drying-yard', -48, 35, 0], ['pulper-machine', -42, 34, -N], ['drying-rack-covered', -40.5, 28, N],
  ['sack-stack', -53, 33.5, .4], ['stone-pond', -38, 46, .2], ['banana', -58, 14, .3], ['banana', -57, 29, 1.4], ['banana', -48.5, 11.5, 2],
  ['avocado', -61, 22, .5], ['durian', -61, 3, 1.1], ['winnow-tray', -45.5, 32, .4], ['back-basket', -44.5, 31.2, -.6],
  // along the tiers
  ['pepper-vine', -33, -6], ['pepper-vine', -33, -10.5], ['pepper-vine', -33, -15], ['pepper-vine', 33, -7], ['pepper-vine', 33, -12],
  ['bamboo-clump', 39, -28, .4], ['bamboo-clump', 40, -40, 1.7], ['bamboo-clump', -40, -45, 2.3], ['avocado', 37, -2, .9], ['durian', -39, -30, .2],
  ['harvest-tarp', 31.6, -15.5, .1], ['wheelbarrow', 30.8, -10, -1.2], ['back-basket', 30.4, -13, .5], ['winnow-tray', -31, -12.5, .2],
  ['hill-cistern', -22, -81, 0], ['irrigation-channel', -16, -79], ['irrigation-channel', -12, -79], ['irrigation-channel', -8, -79], ['irrigation-channel', -4, -79],
];
// animated: [file, x, z, yaw, clip]
const ACTORS = [
  ['coffee-buyer', -7.6, 30.4, 2.6, 'inspect'], ['villager-child-f', -47, 25, .8, 'play'], ['villager-child-m', -45, 23.5, -2.2, 'play'],
  ['villager-elder-m', -50, 26.5, N, 'sit'], ['villager-elder-f', -51.5, 28, 1.2, 'rest'], ['dog', 2.4, 28.6, -.6, 'wag'],
  ['chicken', -49, 19, .3, 'peck'], ['chicken', -50.5, 17.5, 2.1, 'peck'], ['chicken', -47.5, 21, -1, 'walk'], ['chicken-rooster', -48.6, 16.5, 1.2, 'idle'],
  ['goat', 36, -9, .4, 'graze'], ['goat', 38.5, -13, 2.4, 'graze'], ['goat', 35.5, -16, -1.1, 'idle'], ['cow', 46, 22, -.8, 'graze'], ['cow', -36, 40, 1.9, 'graze'],
];
// the stream runs east–west across the lowland south of the plaza (6 m tiles), the dirt road south through the gate
const STREAM = Array.from({ length: 13 }, (_, i) => ['stream', -36 + i * 6, 41, 0, [1, 1, 1]]);
const ROAD = Array.from({ length: 8 }, (_, i) => ['dirt-path', 0, 26.5 + i * 4, N, [1, 1, 1.5]]);
// Greenery of a fresh farm, placed as in the game design. It is only dressing: never tappable, never in the way, and a piece steps aside
// as soon as a field or building stands on its spot. [file, x, z, yaw, scale]
const START_PROPS = [
  ['cordia-africana-lod1', 1.9, 9.2, 4.6, 0.34],
  ['compost-house', 7.0, 15.1, 3.4, 0.6],
  ['albizia-schimperiana-lod1', 6.3, 19.2, 3.8, 0.3],
  ['ensete-ventricosum-lod1', -2.4, 12.9, 0.9, 0.42],
  ['water-tank-lod0', -7.3, 17.9, 3.4, 1],
  ['daisy-clump', -4.3, 15.3, 4.4, 3],
  ['daisy-clump', 1.9, 23.7, 2.0, 3],
  ['daisy-clump', -10.1, 21.8, 1.1, 3],
  ['daisy-clump', -3.3, 28.6, 3.5, 3],
  ['shrub', -0.2, 25.7, 3.0, 1.6],
  ['wheelbarrow', -5.4, 29.9, 2.1, 1.3],
  ['daisy-clump', -9.4, 26.8, 4.8, 3],
  ['daisy-clump', -9.2, 30.3, 4.4, 3],
  ['cordia-africana-lod1', -12.1, 29.3, 2.5, 0.34],
  ['daisy-clump', -11.7, 24.8, 4.9, 3],
  ['daisy-clump', -0.2, 14.2, 2.6, 3],
  ['daisy-clump', 2.9, 19.0, 2.4, 3],
  ['lamp-post', -8.5, 19.8, 5.5, 0.8],
];
const START_ACTORS = [['chicken', -2.2, 26.1, 3.0, 'peck'], ['chicken', -7.7, 20.8, 0.6, 'walk']];
const START_CLEAR = 4.2; // metres kept free around every field and building
const SIGN_KEY = 'godbean-sign-pos';
const savedSigns = () => { try { return JSON.parse(localStorage.getItem(SIGN_KEY) || '{}') || {}; } catch { return {}; } };
const TIER_NAMES = ['Tầng 1 · Đồng bằng', 'Tầng 2 · Đồi thấp', 'Tầng 3 · Sườn đồi', 'Tầng 4 · Cao nguyên'];

const actorCache = new Map();
function loadActor(file) {
  if (!actorCache.has(file)) actorCache.set(file, gltfLoader.loadAsync(`${import.meta.env.BASE_URL}models/gedeo/${file}.glb`).then(g => { tuneGedeoMaterials(g.scene); return g; }));
  return actorCache.get(file);
}
// register every file used here as a single-model key (createPlant caches templates and clones them)
const keyOf = file => { const k = `dress:${file}`; GEDEO_MODELS[k] ??= { file, single: true }; return k; };

function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#d9b98a'; g.fillRect(0, 0, 512, 192);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(120,80,40,${.05 + Math.random() * .08})`; g.beginPath(); g.moveTo(0, Math.random() * 192); g.bezierCurveTo(170, Math.random() * 192, 340, Math.random() * 192, 512, Math.random() * 192); g.stroke(); }
  g.fillStyle = '#4a2c14'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 54px system-ui, sans-serif'; g.fillText(text, 256, 100, 480);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function labelSign(obj, text) {
  obj.traverse(o => { if (o.isMesh && o.name.includes('sign_face')) { o.material = o.material.clone(); o.material.map = signTexture(text); o.material.color.set(0xffffff); o.material.needsUpdate = true; } });
}

/** Builds the dressing into `parent` (the farm area group). Returns { group, ready, dispose }. */
export function createMountainDressing({ parent, farmName = 'GODBEAN · Gedeo Coffee' }) {
  const group = new THREE.Group(); group.name = 'mountain-dressing'; parent.add(group);
  const q = getQuality(), rich = q !== 'low';
  const place = (o, x, z, yaw = 0, scale = 1) => {
    o.position.set(x, farmGroundY(x, z), z); o.rotation.y = yaw;
    if (Array.isArray(scale)) o.scale.set(...scale); else o.scale.setScalar(scale);
    o.traverse(c => { c.raycast = () => {}; if (c.isMesh && x * x + z * z > 3600) c.castShadow = false; }); // far props: no shadow pass
    group.add(o); return o;
  };
  // A model placed many times (stream tiles, cliffs) is one instanced set per material instead of one draw per part per copy.
  // Far copies still skip the shadow pass, so they form a set of their own. World culling (instance-cull.js) keeps per-copy culling.
  const placeCopies = (file, copies) => [copies.filter(c => c.position.x ** 2 + c.position.z ** 2 <= 3600), copies.filter(c => c.position.x ** 2 + c.position.z ** 2 > 3600)]
    .map((list, far) => (list.length ? createPlantInstances(keyOf(file), list, { lod: 0, shadows: !far }).then(g => { g.traverse(o => { o.raycast = () => {}; }); group.add(g); }).catch(() => null) : null));
  const pickers = [], signObjs = {};
  const placed = [...PROPS, ...STREAM, ...ROAD].filter(([file]) => !WILD_START || WILD_KEEP.has(file));
  const copiesOf = {};
  for (const p of placed) (copiesOf[p[0]] ||= []).push(p);
  const repeated = file => copiesOf[file].length >= 3 && file !== 'farm-gate-sign'; // (the gate sign gets its own label)
  const props = placed.filter(([file]) => !repeated(file));
  // a name sign at the foot of each tier, beside the spine ramp (tier 1 by the plaza)
  const signs = [[4.4, 19, 0]]; // a little off the ramp: the signs are bigger now
  for (const e of TIER_EDGES) signs.push([4.4, Math.max(e.z, e.zE ?? e.z) + 2.2, 0]);

  const jobs = [
    ...props.map(([file, x, z, yaw = 0, s = 1]) => createPlant(keyOf(file)).then(o => { place(o, x, z, yaw, s); if (file === 'farm-gate-sign') labelSign(o, farmName); }).catch(() => null)),
    ...signs.map(([x0, z0, yaw], i) => createPlant(keyOf('tier-sign')).then(o => {
      const saved = savedSigns()[ESTATES[ESTATE_ORDER[i]].seed], x = saved?.x ?? x0, z = saved?.z ?? z0; // where the player last put it
      place(o, x, z, yaw, SIGN_SCALE); labelSign(o, TIER_NAMES[i]); signObjs[ESTATES[ESTATE_ORDER[i]].seed] = o;
      const pick = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.y = 1.6; pick.userData.target = { kind: 'parcel', id: ESTATES[ESTATE_ORDER[i]].seed, sign: true, x, z }; o.add(pick); pickers.push(pick);
    }).catch(() => null)),
    ...Object.keys(copiesOf).filter(repeated).flatMap(file => placeCopies(file, copiesOf[file].map(([, x, z, yaw = 0, s = 1]) => ({ position: new THREE.Vector3(x, farmGroundY(x, z), z), rotationY: yaw, scale: s })))),
  ];
  if (rich) {
    for (const [x, z, s] of [[0, -125, 2.4], [-75, -60, 1.8], [75, -45, 1.8], [-60, -105, 1.5], [55, -100, 1.6]]) {
      jobs.push(createPlant(keyOf('mist-bank')).then(o => { place(o, x, z, (x + z) * .01, s); o.position.y += 14 + Math.abs(z) * .08; o.traverse(c => { if (c.isMesh) c.castShadow = c.receiveShadow = false; }); }).catch(() => null));
    }
    for (const [file, x, z, yaw, clip] of WILD_START ? [] : ACTORS) {
      jobs.push(loadActor(file).then(g => {
        const model = cloneSkinned(g.scene); place(model, x, z, yaw);
        const mixer = new THREE.AnimationMixer(model), a = g.animations.find(c => c.name === clip) || g.animations[0];
        if (a) mixer.clipAction(a).play();
        mixer.update(Math.random() * 3); // out of step with each other
        let last = performance.now(), first = null;
        model.traverse(o => { if (o.isMesh) { o.castShadow = true; first ??= o; } });
        if (first) first.onBeforeRender = () => { const now = performance.now(); mixer.update(Math.min(.1, (now - last) / 1000)); last = now; };
      }).catch(e => console.warn('dressing actor not loaded', file, e)));
    }
  }
  // The dressing of a fresh farm (see START_PROPS). syncStart() hides what a field or building now stands on.
  const startPieces = [];
  let startOwned = [];
  let previewSpot = null;
  const applyStart = piece => { piece.o.visible = !startOwned.some(p => Math.hypot(p.x - piece.x, p.z - piece.z) < START_CLEAR) && !(previewSpot && Math.hypot(previewSpot.x - piece.x, previewSpot.z - piece.z) < previewSpot.r); };
  const addStart = (o, x, z) => { const piece = { o, x, z }; startPieces.push(piece); applyStart(piece); };
  if (rich) {
    for (const [file, x, z, yaw, s] of START_PROPS) jobs.push(createPlant(keyOf(file)).then(o => { place(o, x, z, yaw, s); addStart(o, x, z); }).catch(() => null));
    for (const [file, x, z, yaw, clip] of START_ACTORS) jobs.push(loadActor(file).then(g => {
      const model = cloneSkinned(g.scene); place(model, x, z, yaw, 2.2); addStart(model, x, z);
      const mixer = new THREE.AnimationMixer(model), a = g.animations.find(c => c.name === clip) || g.animations[0];
      if (a) mixer.clipAction(a).play();
      mixer.update(Math.random() * 3);
      let last = performance.now(), first = null;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; first ??= o; } });
      if (first) first.onBeforeRender = () => { const now = performance.now(); mixer.update(Math.min(.1, (now - last) / 1000)); last = now; };
    }).catch(() => null));
  }
  /** The ghost of a piece being placed: greenery under it steps aside (r = 0: none). */
  function previewStart(x, z, r) {
    previewSpot = r > 0 ? { x, z, r } : null;
    for (const piece of startPieces) applyStart(piece);
  }
  function syncStart(region) {
    startOwned = [...(region?.fields || []), ...(region?.buildings || [])];
    for (const piece of startPieces) applyStart(piece);
  }
  const ready = Promise.all(jobs);
  /** Moves a tier signboard (by its seed lot id) to (x, z) and remembers the place. */
  function moveSign(seed, x, z) {
    const o = signObjs[seed]; if (!o) return false;
    o.position.set(x, farmGroundY(x, z), z); o.updateMatrix(); // frozen with the rest of the farm (world.js)
    const t = pickers.find(p => p.userData.target.id === seed)?.userData.target; if (t) { t.x = x; t.z = z; }
    try { const all = savedSigns(); all[seed] = { x, z }; localStorage.setItem(SIGN_KEY, JSON.stringify(all)); } catch { /* ignore */ }
    return true;
  }
  const hideSign = (seed, b) => { if (signObjs[seed]) signObjs[seed].visible = !b; };
  function dispose() {
    group.traverse(o => { if (o.isMesh && o.material?.map?.isCanvasTexture) { o.material.map.dispose(); o.material.dispose(); } }); // the labelled signs' own clones
    for (const p of pickers) { p.geometry.dispose(); p.material.dispose(); }
    group.removeFromParent();
  }
  return { group, ready, pickers: () => pickers, moveSign, hideSign, syncStart, previewStart, dispose };
}
