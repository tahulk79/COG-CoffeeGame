// Livestock that simply live on the farm once bought (chicken, rooster, cow, goat, dog): no build step, they wander
// around the spot they were bought at. The animal is drawn on the building entity itself (its root moves, so the tap
// pick box follows); the static prefab of that entity is hidden. Clips: idle / walk / peck | graze | wag.
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { BUILDINGS } from '../../core/config/economy.js';
import { farmGroundY } from '../../core/config/layout.js';
import { gltfLoader } from '../../shared/three/models.js';
import { tuneGedeoMaterials } from '../../shared/three/gedeo-vegetation.js';

const cache = new Map();
function load(model) {
  if (!cache.has(model)) cache.set(model, gltfLoader.loadAsync(`${import.meta.env.BASE_URL}models/${model}`).then(g => {
    tuneGedeoMaterials(g.scene);
    g.scene.traverse(o => {
      if (o.geometry) o.geometry.userData.keep = true;
      for (const m of o.material ? [o.material].flat() : []) { m.userData.keep = true; for (const v of Object.values(m)) if (v?.isTexture) v.userData.keep = true; }
    });
    return g;
  }).catch(() => null));
  return cache.get(model);
}
const SPEED = { chickenCoop: 1.1, rooster: 1.2, goat: 1.5, cow: 1, farmDog: 2.4 };
const RANGE = { chickenCoop: 8, rooster: 8, goat: 10, cow: 10, farmDog: 14 };
const rnd = (a, b) => a + Math.random() * (b - a);

export function createAnimals({ getEntity, isWalkable }) {
  const agents = new Map(); // uid → agent

  function spawn(b) {
    const def = BUILDINGS[b.type];
    const a = { uid: b.uid, type: b.type, level: b.level || 1, x: b.x, z: b.z, hx: b.x, hz: b.z, tx: b.x, tz: b.z, mode: 'idle', timer: rnd(.5, 3), yaw: rnd(0, 6.28), model: null, mixer: null, clips: null, cur: null, name: '' };
    agents.set(b.uid, a);
    load(def.model).then(g => {
      const e = getEntity(b.uid);
      if (!g || !e || agents.get(b.uid) !== a) return;
      a.model = clone(g.scene); a.model.scale.setScalar(def.trueScale || 1);
      a.model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.raycast = () => {}; } });
      e.model.visible = false; // the static stand-in
      e.root.add(a.model);
      a.clips = Object.fromEntries(g.animations.map(c => [c.name, c]));
      a.mixer = new THREE.AnimationMixer(a.model);
      play(a, 'idle');
      a.mixer.update(rnd(0, 2)); // not all in step
    });
  }
  function play(a, name) {
    if (a.name === name || !a.clips) return;
    const clip = a.clips[name] || a.clips.idle; if (!clip) return;
    const next = a.mixer.clipAction(clip); next.reset().play();
    if (a.cur) a.cur.crossFadeTo(next, .3, false);
    a.cur = next; a.name = name;
  }
  const idleClip = a => a.type === 'farmDog' ? 'wag' : a.type === 'chickenCoop' || a.type === 'rooster' ? 'peck' : 'graze';

  function think(a) {
    if (Math.random() < .12) { a.mode = 'idle'; a.timer = rnd(.8, 2.5); play(a, Math.random() < .6 ? idleClip(a) : 'idle'); return; }
    const R = RANGE[a.type] || 5;
    for (let i = 0; i < 8; i++) {
      const ang = rnd(0, 6.28), r = rnd(1, R), x = a.hx + Math.cos(ang) * r, z = a.hz + Math.sin(ang) * r;
      if (isWalkable(x, z)) { a.tx = x; a.tz = z; a.mode = 'walk'; play(a, 'walk'); return; }
    }
    a.mode = 'idle'; a.timer = rnd(1, 3); play(a, 'idle');
  }

  return {
    /** Spawns / drops animals to match the region's buildings. */
    sync(list) {
      const seen = new Set();
      for (const b of list) {
        if (!BUILDINGS[b.type]?.animal) continue;
        seen.add(b.uid);
        const ag = agents.get(b.uid); if (ag) ag.level = b.level || 1;
        if (!agents.has(b.uid)) spawn(b);
      }
      for (const uid of [...agents.keys()]) if (!seen.has(uid)) agents.delete(uid);
    },
    update(dt) {
      for (const a of agents.values()) {
        const e = getEntity(a.uid);
        if (!e || !a.model) continue;
        if (a.mode === 'walk') {
          const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), step = (SPEED[a.type] || .6) * dt;
          if (d < .15) { a.mode = 'idle'; a.timer = rnd(.6, 2.5); play(a, Math.random() < .6 ? idleClip(a) : 'idle'); }
          else {
            const nx = a.x + dx / d * Math.min(step, d), nz = a.z + dz / d * Math.min(step, d);
            if (isWalkable(nx, nz)) { a.x = nx; a.z = nz; a.yaw = Math.atan2(dx, dz); } else { a.mode = 'idle'; a.timer = rnd(1, 3); play(a, 'idle'); }
          }
        } else if ((a.timer -= dt) <= 0) think(a);
        const sc = (BUILDINGS[a.type].trueScale || 1) * (BUILDINGS[a.type].effect?.size?.[Math.min(a.level, 5) - 1] || 1);
        if (Math.abs(a.model.scale.x - sc) > 1e-3) a.model.scale.setScalar(sc); // upgrades make the animal bigger
        e.root.position.set(a.x, farmGroundY(a.x, a.z), a.z);
        e.root.rotation.y = 0;
        let dy = a.yaw - a.model.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        a.model.rotation.y += dy * Math.min(1, dt * 8);
        if (e.root.parent?.visible !== false) a.mixer.update(dt);
      }
    },
    posOf: uid => { const a = agents.get(uid); return a && a.model ? { x: a.x, z: a.z, type: a.type } : null; },
    clear() { agents.clear(); },
  };
}
