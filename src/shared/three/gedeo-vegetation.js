import * as THREE from 'three';
import { gltfLoader } from './models.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Gedeo models (scripts/blender/gedeo_heroes.py + gedeo_buildings.py → public/models/gedeo/<file>-lod<n>.glb, meshopt + WebP).
// One root per GLB with one mesh per material, so a copy costs 2–6 draw calls and all copies share geometry + materials.
// lods: [lod index, camera distance where it starts]. Nearest level first.
export const GEDEO_MODELS = {
  // vegetation
  coffee: { file: 'coffea-arabica-mature', lods: [[0, 0], [1, 8], [2, 22]] },
  coffeeYoung: { file: 'coffea-arabica-young', lods: [[0, 0], [1, 8], [2, 22]] },
  coffeeSeedling: { file: 'coffea-arabica-seedling', lods: [[0, 0], [1, 10]] },
  albizia: { file: 'albizia-schimperiana', lods: [[0, 0], [1, 40], [2, 80], [3, 140]] },
  cordia: { file: 'cordia-africana', lods: [[0, 0], [1, 30], [2, 60], [3, 110]] },
  enset: { file: 'ensete-ventricosum', lods: [[0, 0], [1, 35]] },
  // buildings & props
  tukul: { file: 'tukul-farmhouse', lods: [[0, 0], [1, 60]] },
  warehouse: { file: 'coffee-warehouse', lods: [[0, 0]] },
  dryingBed: { file: 'drying-bed', lods: [[0, 0], [1, 30]] },
  waterTank: { file: 'water-tank', lods: [[0, 0]] },
  shelter: { file: 'worker-shelter', lods: [[0, 0]] },
  sacks: { file: 'coffee-sacks', lods: [[0, 0]] },
  // processing, terraces, nature, props (gedeo_environment.py — single file, no LOD suffix)
  wetMill: { file: 'wet-mill', single: true }, compost: { file: 'compost-house', single: true },
  terraceWall: { file: 'terrace-wall', single: true }, fence: { file: 'fence', single: true }, fenceGate: { file: 'fence-gate', single: true },
  rocks: { file: 'rocks', single: true }, grass: { file: 'grass-clump', single: true }, shrub: { file: 'shrub', single: true },
  rock: { file: 'rock', single: true }, stump: { file: 'stump', single: true }, daisyClump: { file: 'daisy-clump', single: true },
  lampPost: { file: 'lamp-post', single: true }, gatePlaza: { file: 'gate-plaza', single: true }, tierWall: { file: 'tier-wall', single: true }, stonePond: { file: 'stone-pond', single: true }, dirtRamp: { file: 'dirt-ramp', single: true }, stoneSteps: { file: 'stone-steps', single: true },
  terrainNorth: { file: 'terrain-north', single: true }, terrainEast: { file: 'terrain-east', single: true },
  terrainWest: { file: 'terrain-west', single: true }, terrainSouth: { file: 'terrain-south', single: true }, roasteryShed: { file: 'roastery-shed', single: true }, packingShed: { file: 'packing-shed', single: true },
  dirtPath: { file: 'dirt-path', single: true }, props: { file: 'farm-props', single: true },
};

// Animated actors (gedeo_characters.py / gedeo_robots.py). Workers share one 17-bone rig with clips
// idle, walk, carry, harvest, water, prune, plant, rake, inspect; robots have idle, drive, work.
export const GEDEO_ACTORS = {
  pickerF: { file: 'worker-picker-f', job: 'harvest' }, pickerM: { file: 'worker-picker-m', job: 'harvest' },
  waterer: { file: 'worker-waterer-m', job: 'water' }, pruner: { file: 'worker-pruner-m', job: 'prune' },
  planter: { file: 'worker-planter-f', job: 'plant' }, hauler: { file: 'worker-hauler-m', job: 'carry' },
  processor: { file: 'worker-processor-f', job: 'rake' }, supervisor: { file: 'worker-supervisor-m', job: 'inspect' },
  harvestBot: { file: 'robot-harvest', job: 'work' }, waterBot: { file: 'robot-water', job: 'work' }, pruneBot: { file: 'robot-prune', job: 'work' },
  plantBot: { file: 'robot-plant', job: 'work' }, droneBot: { file: 'robot-drone', job: 'work' }, haulBot: { file: 'robot-haul', job: 'drive' },
};
export const GEDEO_PLANTS = GEDEO_MODELS; // back-compat name

// Mature coffee carries every crop state in one model; a state = which optional parts are shown.
const COFFEE_PARTS = ['coffee_flowers', 'coffee_cherries_green', 'coffee_cherries_ripe'];
export const COFFEE_STATES = {
  mature: [], flowering: ['coffee_flowers'], green: ['coffee_cherries_green'], ripe: ['coffee_cherries_ripe'], harvested: [],
};
// Drying bed: one cherry layer at a time.
const BED_PARTS = ['drying_bed_cherries_fresh', 'drying_bed_cherries_drying', 'drying_bed_cherries_dry'];
export const BED_STATES = { empty: [], fresh: [BED_PARTS[0]], drying: [BED_PARTS[1]], dry: [BED_PARTS[2]] };
const OPTIONAL = new Set([...COFFEE_PARTS, ...BED_PARTS]);

const cache = new Map();
function loadScene(url) {
  if (!cache.has(url)) cache.set(url, gltfLoader.loadAsync(url).then(g => tuneMaterials(g.scene)));
  return cache.get(url);
}

/** Apply the Gedeo material fixes (alpha-test cards, crown-normal foliage, shadows) to any loaded Gedeo GLB. */
export function tuneGedeoMaterials(root) { return root ? tuneMaterials(root) : root; }

// Mobile VRAM: every Gedeo GLB embeds its own copy of shared textures (each LOD file, every building with thatch…).
// Textures are named after their Blender image (T_cordia_foliage, N_thatch…): the first one loaded is kept, later
// copies are swapped for it and freed, so a texture is uploaded to the GPU once however many files use it.
const sharedTex = new Map();
const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
function dedupeTextures(m) {
  for (const slot of TEX_SLOTS) {
    const t = m[slot];
    if (!t?.isTexture || !t.name) continue;
    const kept = sharedTex.get(t.name);
    if (!kept) { t.userData.keep = true; sharedTex.set(t.name, t); continue; }
    if (kept !== t) { m[slot] = kept; t.dispose(); t.image?.close?.(); }
  }
}

function tuneMaterials(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const mm of [o.material].flat()) if (mm) dedupeTextures(mm);
    o.name = o.name.replace(/(\.|_)?\d{3}$/, ''); // Blender export may suffix duplicates ('coffee_bark002')
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material;
    if (m.alphaTest > 0) { m.alphaTest = .5; m.transparent = false; }
    m.envMapIntensity = .6;
    if (m.side === THREE.DoubleSide && m.name.match(/leaf|foliage|leaves/) && !m.userData.crownNormals) foliageShading(m);
  });
  return root;
}

// Leaves carry baked "crown" normals (away from the canopy centre, see gedeo_heroes.py). Three flips normals on
// back faces of double-sided materials, which turns half the cards black; keep the baked normal on both faces and
// add a little light transmission so sunlit leaves glow instead of reading as flat paper.
const WIND = { value: 0 };
/** Advance the wind clock shared by every leaf material (called once per frame). */
export function tickWind(t) { WIND.value = t; }

function foliageShading(m) {
  m.userData.crownNormals = true;
  m.onBeforeCompile = shader => {
    // Wind: leaves sway more with height; each plant has its own phase from its position.
    shader.uniforms.uWind = WIND;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec2 windAt = instanceMatrix[3].xz;
#else
  vec2 windAt = modelMatrix[3].xz;
#endif
  float windH = clamp(position.y * .45, 0.0, 1.0);
  transformed.x += windH * .04 * (sin(uWind * 1.3 + windAt.x * .7 + windAt.y * .5 + position.x * 1.7) + .5 * sin(uWind * 2.9 + windAt.y + position.z * 2.3));
  transformed.z += windH * .025 * sin(uWind * 1.7 + windAt.x + position.y * 2.1);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace(/normal\s*\*=\s*faceDirection;/g, ''))
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n  reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.18;');
  };
  m.customProgramCacheKey = () => 'gedeo-foliage';
}

const base = `${import.meta.env.BASE_URL}models/gedeo/`;
const url = (key, lod) => GEDEO_MODELS[key].single ? `${base}${GEDEO_MODELS[key].file}.glb` : `${base}${GEDEO_MODELS[key].file}-lod${lod}.glb`;
const lodsOf = key => GEDEO_MODELS[key].lods ?? [[0, 0]];

/** Load every LOD of a model (cached). Resolves { [lod]: templateScene } — clone, don't mutate. */
export function loadPlant(key) {
  const lods = lodsOf(key).map(([l]) => l);
  return Promise.all(lods.map(l => loadScene(url(key, l)))).then(scenes => Object.fromEntries(lods.map((l, i) => [l, scenes[i]])));
}

/** Show only the optional parts listed in `shown` (crop / bed state); everything else stays as authored. */
export function setParts(object, shown = []) {
  const on = new Set(shown);
  object.traverse(o => { if (o.isMesh && OPTIONAL.has(o.name)) o.visible = on.has(o.name); });
  return object;
}

/** A single placed model with distance LOD. Clones share geometry/materials with the cached template. */
export async function createPlant(key, { state } = {}) {
  const tpls = await loadPlant(key);
  const lod = new THREE.LOD(); lod.name = `gedeo-${key}`;
  for (const [l, dist] of lodsOf(key)) lod.addLevel(tpls[l].clone(), dist);
  if (state) setParts(lod, COFFEE_STATES[state] ?? BED_STATES[state] ?? []);
  return lod;
}
export const createModel = createPlant;

/**
 * Many copies of one model as InstancedMeshes (one per material mesh) — fields of coffee, enset rows, bed lines.
 * transforms: [{ position, rotationY, scale, state }]. state picks the optional parts per copy (hidden part = zero-scale
 * instance, so a whole field of mixed flowering / green / ripe trees stays one draw call per part).
 * Returns a Group; group.userData.setTransform(i, t) updates one copy.
 */
export async function createPlantInstances(key, transforms, { lod = 1, shadows = true } = {}) {
  const tpl = (await loadPlant(key))[lod];
  const group = new THREE.Group(); group.name = `gedeo-${key}-instances`;
  const meshes = [];
  tpl.updateMatrixWorld(true);
  tpl.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, transforms.length);
    im.name = o.name; im.castShadow = shadows; im.receiveShadow = true; im.userData.local = o.matrixWorld.clone(); im.userData.cullable = true;
    meshes.push(im); group.add(im);
  });
  const m = new THREE.Matrix4(), w = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const setTransform = (i, t) => {
    q.setFromAxisAngle(Y, t.rotationY ?? 0); if (Array.isArray(t.scale)) s.set(...t.scale); else s.setScalar(t.scale ?? 1); m.compose(t.position, q, s);
    const shown = new Set(COFFEE_STATES[t.state] ?? BED_STATES[t.state] ?? []);
    for (const im of meshes) {
      im.setMatrixAt(i, OPTIONAL.has(im.name) && !shown.has(im.name) ? ZERO : w.multiplyMatrices(m, im.userData.local));
      im.instanceMatrix.needsUpdate = true;
      im.userData.cullDirty = true;
    }
  };
  transforms.forEach((t, i) => setTransform(i, t));
  for (const im of meshes) im.computeBoundingSphere();
  group.userData.setTransform = setTransform;
  return group;
}

const actorCache = new Map();
/**
 * An animated worker / robot. Returns { object, mixer, play(clip, fade), clips }. Call mixer.update(dt) every frame.
 * Skinned workers are cloned with SkeletonUtils so every copy has its own skeleton but shares geometry + materials.
 */
export async function createActor(key, clip = GEDEO_ACTORS[key].job) {
  const file = `${base}${GEDEO_ACTORS[key].file}.glb`;
  if (!actorCache.has(file)) actorCache.set(file, gltfLoader.loadAsync(file).then(g => { tuneMaterials(g.scene); return g; }));
  const gltf = await actorCache.get(file);
  const object = SkeletonUtils.clone(gltf.scene); object.name = `gedeo-${key}`;
  object.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = !o.isSkinnedMesh; } });
  const mixer = new THREE.AnimationMixer(object);
  const clips = Object.fromEntries(gltf.animations.map(a => [a.name, a]));
  let current = null;
  const play = (name, fade = .25) => {
    const c = clips[name]; if (!c) return null;
    const next = mixer.clipAction(c); next.reset().play();
    if (current && current !== next) current.crossFadeTo(next, fade, false);
    current = next; return next;
  };
  play(clip, 0);
  return { object, mixer, play, clips: Object.keys(clips) };
}

/** Drop GPU resources of all cached templates (call when leaving every scene that uses them). */
export function releasePlants() {
  for (const p of cache.values()) p.then(root => root.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const v of Object.values(o.material)) if (v?.isTexture) v.dispose();
    o.material.dispose();
  }));
  cache.clear();
}
