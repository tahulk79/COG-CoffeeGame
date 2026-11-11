// Every Blender asset of the Gedeo farm on one screen (/asset-lineup.html), for the founder's "is anything missing?" check.
// One row per category, one cell per model: each model is scaled to fit its cell (a 0.3 m seedling and a 15 m shade tree
// both readable), and its label gives the real height. Workers and robots play their work clip.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { gltfLoader } from '../shared/three/models.js';
import { tuneGedeoMaterials } from '../shared/three/gedeo-vegetation.js';

const G = 'models/gedeo/', F = 'models/farm/';
// [file, label, part filter (hide meshes whose name matches), clip]
const ROWS = [
  ['☕ Cà phê: cây con · cây tơ · trưởng thành (ra hoa · quả chín)', [
    [`${G}coffea-arabica-seedling-lod0`, 'Arabica · cây con'], [`${G}coffea-arabica-young-lod0`, 'Arabica · cây tơ'],
    [`${G}coffea-arabica-mature-lod0`, 'Arabica · ra hoa', /cherries/], [`${G}coffea-arabica-mature-lod0`, 'Arabica · quả chín', /flowers|green/],
  ]],
  ['🌳 Cây che bóng & thiên nhiên', [
    [`${G}albizia-schimperiana-lod0`, 'Albizia (che bóng)'], [`${G}cordia-africana-lod0`, 'Cordia (che bóng)'], [`${G}ensete-ventricosum-lod0`, 'Enset (chuối giả)'],
    [`${G}shrub`, 'Bụi cây'], [`${G}grass`, 'Cỏ'], [`${G}grass-clump`, 'Bụi cỏ'], [`${G}daisy-clump`, 'Hoa dại'],
    [`${G}rock`, 'Đá'], [`${G}rocks`, 'Cụm đá'], [`${G}stump`, 'Gốc cây'],
  ]],
  ['🏠 Nhà & xưởng', [
    [`${G}tukul-farmhouse-lod0`, 'Nhà tukul'], [`${G}coffee-warehouse-lod0`, 'Kho cà phê'], [`${G}drying-bed-lod0`, 'Giàn phơi'],
    [`${G}wet-mill`, 'Trạm sơ chế ướt'], [`${G}roastery-shed`, 'Xưởng rang'], [`${G}packing-shed`, 'Xưởng đóng gói'],
    [`${G}compost-house`, 'Nhà ủ phân'], [`${G}water-tank-lod0`, 'Bồn nước'], [`${G}worker-shelter-lod0`, 'Lán nhân công'],
    [`${G}coffee-sacks-lod0`, 'Bao cà phê'], [`${G}farm-props`, 'Đồ nghề'], [`${G}lamp-post`, 'Cột đèn'],
  ]],
  ['⛰️ Địa hình & đường', [
    [`${G}tier-wall`, 'Tường tầng núi (mới)'], [`${G}terrace-wall`, 'Tường bậc thang'], [`${F}landscape-parts`, 'Luống · vòng gốc · bờ'],
    [`${G}dirt-path`, 'Đường đất'], [`${G}fence`, 'Hàng rào'], [`${G}fence-gate`, 'Cổng rào'], [`${G}gate-plaza`, 'Sân cổng'],
  ]],
  ['🍌 Vườn: ươm cây & trồng xen', [
    [`${G}nursery-bed`, 'Vườn ươm'], [`${G}banana`, 'Chuối'], [`${G}avocado`, 'Bơ'], [`${G}durian`, 'Sầu riêng'],
    [`${G}pepper-vine`, 'Hồ tiêu'], [`${G}bamboo-clump`, 'Tre chắn gió'],
  ]],
  ['💧 Nước & địa hình núi', [
    [`${G}irrigation-channel`, 'Mương nước'], [`${G}drip-line`, 'Tưới nhỏ giọt'], [`${G}hill-cistern`, 'Bể chứa trên đồi'],
    [`${G}stream`, 'Suối'], [`${G}wooden-bridge`, 'Cầu gỗ'], [`${G}stone-pond`, 'Ao bờ đá'], [`${G}stone-steps`, 'Bậc đá'],
    [`${G}dirt-ramp`, 'Dốc đường đất'], [`${G}mist-bank`, 'Sương mù'],
  ]],
  ['🧺 Thu hoạch, chở & sơ chế', [
    [`${G}back-basket`, 'Gùi'], [`${G}winnow-tray`, 'Nia & thúng'], [`${G}harvest-tarp`, 'Bạt hứng quả'], [`${G}wheelbarrow`, 'Xe rùa'],
    [`${G}motorbike-sacks`, 'Xe máy chở bao'], [`${G}farm-truck`, 'Xe tải nhỏ'], [`${G}power-tiller-cart`, 'Xe công nông'],
    [`${G}pulper-machine`, 'Máy xát vỏ'], [`${G}drying-yard`, 'Sân phơi'], [`${G}drying-rack-covered`, 'Giàn phơi mái che'], [`${G}sack-stack`, 'Kho bao'],
  ]],
  ['🏡 Làng: nhà, bếp, chợ, biển', [
    [`${G}stilt-house`, 'Nhà sàn'], [`${G}wooden-house`, 'Nhà gỗ'], [`${G}wood-kitchen`, 'Bếp củi'], [`${G}market-stall`, 'Sạp chợ phiên'],
    [`${G}farm-gate-sign`, 'Cổng nông trại'], [`${G}tier-sign`, 'Biển tên tầng'], [`${G}lantern-string`, 'Đèn lồng'], [`${G}flag-pole`, 'Cờ'],
  ]],
  ['👨‍👩‍👧 Dân làng & vật nuôi', [
    [`${G}villager-child-f`, 'Bé gái', null, 'play'], [`${G}villager-child-m`, 'Bé trai', null, 'play'], [`${G}villager-elder-f`, 'Bà', null, 'idle'],
    [`${G}villager-elder-m`, 'Ông', null, 'walk'], [`${G}coffee-buyer`, 'Thương lái', null, 'inspect'],
    [`${G}chicken`, 'Gà mái', null, 'peck'], [`${G}chicken-rooster`, 'Gà trống', null, 'idle'], [`${G}goat`, 'Dê', null, 'graze'],
    [`${G}cow`, 'Bò', null, 'graze'], [`${G}dog`, 'Chó', null, 'idle'], [`${G}beehive`, 'Tổ ong', null, 'idle'],
  ]],
  ['🧑‍🌾 Nhân công', [
    [`${G}worker-picker-f`, 'Hái quả (nữ)', null, 'harvest'], [`${G}worker-picker-m`, 'Hái quả (nam)', null, 'carry'],
    [`${G}worker-planter-f`, 'Trồng cây', null, 'plant'], [`${G}worker-waterer-m`, 'Tưới nước', null, 'water'],
    [`${G}worker-pruner-m`, 'Tỉa cành', null, 'prune'], [`${G}worker-hauler-m`, 'Khuân vác', null, 'carry'],
    [`${G}worker-processor-f`, 'Sơ chế', null, 'rake'], [`${G}worker-supervisor-m`, 'Quản lý', null, 'inspect'],
  ]],
  ['🤖 Robot', [
    [`${G}robot-harvest`, 'Robot hái', null, 'work'], [`${G}robot-plant`, 'Robot trồng', null, 'work'], [`${G}robot-water`, 'Robot tưới', null, 'work'],
    [`${G}robot-prune`, 'Robot tỉa', null, 'work'], [`${G}robot-drone`, 'Drone phun', null, 'work'], [`${G}robot-haul`, 'Robot chở', null, 'drive'],
  ]],
];

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const labels = new CSS2DRenderer(); labels.setSize(innerWidth, innerHeight);
Object.assign(labels.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
document.body.append(labels.domElement);

const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc9dbe8);
scene.add(new THREE.HemisphereLight(0xdcebff, 0x6b4a32, 1.2));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4); sun.position.set(-20, 40, 30); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 150 }); sun.shadow.normalBias = .02;
scene.add(sun);

const CELL = 3.4, ROW = 5.4, FIT = 2.8;
const width = Math.max(...ROWS.map(r => r[1].length)) * CELL;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(width + 8, ROWS.length * ROW + 6), new THREE.MeshStandardMaterial({ color: 0x8a6a4c, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.z = (ROWS.length - 1) * ROW / 2; ground.receiveShadow = true; scene.add(ground);
const label = (html, cls, pos, row = -1) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; const o = new CSS2DObject(d); o.position.copy(pos); o.userData.row = row; scene.add(o); return o; };

const cache = new Map();
const load = f => { if (!cache.has(f)) cache.set(f, gltfLoader.loadAsync(`${import.meta.env.BASE_URL}${f}.glb`)); return cache.get(f); };
const mixers = [];
let done = 0, total = ROWS.reduce((a, r) => a + r[1].length, 0), failed = [];
const status = document.getElementById('status');

ROWS.forEach(([title, items], ri) => {
  const z = ri * ROW;
  label(title, 'row', new THREE.Vector3(-width / 2 - .6, 0, z), ri).center.set(1, .5);
  items.forEach(async ([file, name, hide, clip], ci) => {
    const x = -width / 2 + CELL * (ci + .5);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(CELL * .46, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a5a40, roughness: 1 }));
    pad.position.set(x, .005, z); pad.receiveShadow = true; pad.userData.row = ri; scene.add(pad);
    try {
      const g = await load(file);
      const model = (clip ? (await import('three/addons/utils/SkeletonUtils.js')).clone(g.scene) : g.scene.clone(true));
      tuneGedeoMaterials(model);
      // leaf cards are alpha-tested: seen from far their mipmapped alpha falls under the 0.5 cut and the crown vanishes
      model.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (hide && hide.test(o.name)) o.visible = false; for (const m of [o.material].flat()) if (m.alphaTest > 0) { m.alphaTest = .12; m.alphaToCoverage = true; } } });
      const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
      const k = Math.min(FIT / Math.max(size.y, Math.max(size.x, size.z) * .62, .01), ri === 0 || ri === 4 ? 20 : 2.2); // fit by height; small props grow at most ×2.2
      const holder = new THREE.Group(); holder.add(model);
      model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      holder.scale.setScalar(k); holder.position.set(x, 0, z); holder.rotation.y = -.5; holder.userData.row = ri; scene.add(holder);
      if (clip && g.animations.length) {
        const mixer = new THREE.AnimationMixer(model), a = g.animations.find(c => c.name === clip) || g.animations[0];
        mixer.clipAction(a).play(); mixers.push(mixer);
      }
      label(`${name}<small>${size.y >= 1 ? size.y.toFixed(1) + ' m' : Math.round(size.y * 100) + ' cm'}${k < .99 || k > 1.01 ? ` · ×${k < 1 ? k.toFixed(2) : k.toFixed(1)}` : ''}</small>`, 'lbl', new THREE.Vector3(x, 0, z + CELL * .5), ri);
    } catch (e) {
      failed.push(name); console.warn('lineup: not loaded', file, e);
      label(`⚠️ ${name}<small>thiếu file</small>`, 'lbl', new THREE.Vector3(x, 0, z + CELL * .5), ri);
    }
    done++; status.textContent = `${done}/${total} mẫu${failed.length ? ` · thiếu: ${failed.join(', ')}` : ''}`;
  });
});

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, .1, 500);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
function frame() {
  const depth = ROWS.length * ROW, aspect = innerWidth / innerHeight;
  const fitW = (width + 13) / 2 / Math.tan(THREE.MathUtils.degToRad(32) / 2) / aspect, fitH = (depth + 4) / 2 / Math.tan(THREE.MathUtils.degToRad(32) / 2);
  const d = Math.max(fitW, fitH) * .98, c = new THREE.Vector3(0, 0, (ROWS.length - 1) * ROW / 2);
  c.x = -4.5; c.z -= .6; camera.position.set(c.x, d * .62, c.z + d * .78); controls.target.copy(c); camera.lookAt(c);
}
frame();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); labels.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); frame(); });
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => { const dt = clock.getDelta(); for (const m of mixers) m.update(dt); controls.update(); renderer.render(scene, camera); labels.render(scene, camera); });
// close-up of one row (QA screenshots): row i framed edge to edge
function show(i) { for (const o of scene.children) if (o.userData.row != null && o.userData.row >= 0) o.visible = i == null || o.userData.row === i; }
function row(i) {
  show(i);
  const n = ROWS[i][1].length, w = n * CELL, z = i * ROW, aspect = innerWidth / innerHeight;
  const d = (w + .5) / 2 / Math.tan(THREE.MathUtils.degToRad(16)) / aspect * 1.08, cx = -width / 2 + w / 2;
  camera.position.set(cx, 1.2 + d * .42, z + d * .78); controls.target.set(cx, .2, z - .6); camera.lookAt(controls.target);
}
const all = () => { show(null); frame(); };
window.__lineup = { camera, controls, scene, frame, row, all };
