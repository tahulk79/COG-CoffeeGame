// Gedeo farm staff looks (scripts/blender/gedeo_characters.py / gedeo_robots.py): the realm's staff logic stays as it is
// (paths, jobs, the createPerson leg swing that tells "walking"); these only swap the visible body and pick the clip.
//  · worker: skinned 17-bone rig, clips idle / walk / carry / harvest / water / prune / plant / rake / inspect
//  · robot: part-animated machine, clips idle / drive / work
// Models are cached per file and shared (keep flags), so a worker leaving never frees the GPU copy others still use.
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { gltfLoader } from '../shared/three/models.js';
import { tuneGedeoMaterials } from '../shared/three/gedeo-vegetation.js';

const cache = new Map();
function load(file) {
  if (!cache.has(file)) cache.set(file, gltfLoader.loadAsync(`${import.meta.env.BASE_URL}models/gedeo/${file}.glb`).then(g => {
    tuneGedeoMaterials(g.scene);
    g.scene.traverse(o => {
      if (o.geometry) o.geometry.userData.keep = true;
      for (const m of o.material ? [o.material].flat() : []) { m.userData.keep = true; for (const v of Object.values(m)) if (v?.isTexture) v.userData.keep = true; }
    });
    return g;
  }).catch(error => { console.warn(`Gedeo staff model ${file} not loaded, keeping the stand-in.`, error); return null; }));
  return cache.get(file);
}

// Building a skinned copy is the slow part: with a big team, one per frame instead of all in the loading frame.
const dressQueue = [];
let pumping = false;
function pump() {
  dressQueue.shift()?.();
  if (dressQueue.length) requestAnimationFrame(pump); else pumping = false;
}
function enqueue(fn) {
  dressQueue.push(fn);
  if (!pumping) { pumping = true; requestAnimationFrame(pump); }
}

// Farm job → clip. Anything else (collect, idle…) plays idle; walking always plays walk.
const JOB_CLIP = { harvest: 'harvest', plant: 'plant', water: 'water', prune: 'prune', process: 'rake', haul: 'carry', inspect: 'inspect', execute: 'plant' };

function mixerOf(model, clips) {
  const mixer = new THREE.AnimationMixer(model);
  let cur = null, name = '';
  return {
    mixer,
    play(next) {
      if (!clips[next]) next = 'idle'; // villagers only know idle / walk
      if (next === name || !clips[next]) return;
      const a = mixer.clipAction(clips[next]); a.reset().play();
      if (cur) cur.crossFadeTo(a, .25, false);
      cur = a; name = next;
    },
  };
}

/** A loose copy of a Gedeo prop (null when it fails to load). */
export const gedeoProp = file => load(file).then(g => (g ? clone(g.scene) : null));

/** Dress a createPerson body as a Gedeo worker. jobOf() → the unit's current job type (or null). */
export function dressGedeoWorker(person, file, jobOf) {
  const blocks = [...person.children];
  load(file).then(g => enqueue(() => {
    if (!g || person.userData.dressed) return;
    const model = clone(g.scene);
    for (const child of blocks) child.visible = false;
    person.add(model); person.userData.dressed = true;
    const clips = Object.fromEntries(g.animations.map(a => [a.name, a]));
    const anim = mixerOf(model, clips); anim.play('idle');
    let skin = null; model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } skin ??= o.isSkinnedMesh ? o : null; });
    let last = performance.now(), lastStride = 0, frames = 0;
    // Animate only while drawn: off-screen workers cost nothing, far ones update every 2nd / 4th frame (staff.js lodRound).
    (skin || model).onBeforeRender = () => {
      if (++frames % (person.userData.animEvery || 1)) return;
      const now = performance.now(), dt = Math.min(.3, (now - last) / 1000); last = now;
      const stride = person.userData.legs?.[0]?.rotation.x ?? 0, walking = Math.abs(stride - lastStride) > 1e-4; lastStride = stride;
      anim.play(walking ? 'walk' : person.userData.seated ? 'idle' : JOB_CLIP[jobOf()] || 'idle');
      anim.mixer.update(dt);
    };
  }));
}

/** Swap a procedural hover robot for a Gedeo farm robot. hide: the stand-in meshes; stateOf() → 'drive' | 'work' | 'idle'. */
export function dressGedeoRobot(root, file, hide, stateOf) {
  load(file).then(g => enqueue(() => {
    if (!g || root.userData.dressed) return;
    const model = clone(g.scene); model.scale.setScalar(.85);
    for (const m of hide) m.visible = false;
    root.add(model); root.userData.dressed = true;
    const clips = Object.fromEntries(g.animations.map(a => [a.name, a]));
    const anim = mixerOf(model, clips); anim.play('idle');
    let first = null; model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; first ??= o; } });
    let last = performance.now(), frames = 0;
    first.onBeforeRender = () => {
      if (++frames % (root.userData.animEvery || 1)) return;
      const now = performance.now(), dt = Math.min(.3, (now - last) / 1000); last = now;
      anim.play(stateOf()); anim.mixer.update(dt);
    };
  }));
}
