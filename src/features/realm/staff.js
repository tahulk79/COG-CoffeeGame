// Staff assigned to the current region: workers (rigged GLB via dressPerson) and procedural robots with a hover bob.
// Farm staff stand beside F1 (farm area), shop staff behind the café counters (café area). Max 3 per zone (STAFF_SLOTS).
import * as THREE from 'three';
import { STAFF, STAFF_SLOTS } from '../../core/config/economy.js';
import { PARCELS, FIXED } from '../../core/config/layout.js';
import { assignedUnits } from '../../core/derive.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';

const F1 = PARCELS.F1.rect;
// Standing spots per zone (index = slot) and facing yaw.
const SPOTS = {
  farm: { yaw: -Math.PI / 2, at: i => ({ x: F1[2] + .9, z: F1[1] + 1.2 + i * 1.7 }) },
  shop: { yaw: 0, at: i => ({ x: FIXED.orderCounter.x + i * 2.5, z: FIXED.orderCounter.z - 1.9 }) },
};

export function createStaff({ scene }) {
  const group = new THREE.Group();
  group.name = 'realm-staff';
  scene.add(group);
  // Farm staff live in the farm area, shop staff in the café area: one child group each, toggled by setView.
  const zones = { farm: new THREE.Group(), shop: new THREE.Group() };
  group.add(zones.farm, zones.shop);
  // Shared robot parts.
  const geo = {
    body: new THREE.SphereGeometry(.42, 18, 14),
    head: new THREE.SphereGeometry(.32, 18, 14),
    eye: new THREE.SphereGeometry(.09, 10, 8),
    antenna: new THREE.CylinderGeometry(.025, .025, .32, 6),
    tip: new THREE.SphereGeometry(.07, 10, 8),
    shadow: new THREE.CircleGeometry(.45, 20).rotateX(-Math.PI / 2),
  };
  const mat = {
    sproutBot: new THREE.MeshStandardMaterial({ color: 0x9fd88a, roughness: .45, metalness: .1 }),
    brewBot: new THREE.MeshStandardMaterial({ color: 0xf2b880, roughness: .45, metalness: .1 }),
    face: new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: .4 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x6ff0ff }),
    tip: new THREE.MeshBasicMaterial({ color: 0xffd25a }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .18, depthWrite: false }),
  };
  const units = new Map(); // uid → { root, body, kind, phase }

  function makeRobot(type) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    const torso = new THREE.Mesh(geo.body, mat[type] || mat.sproutBot); torso.scale.set(1, 1.1, 1); torso.position.y = .5;
    const head = new THREE.Mesh(geo.head, mat.face); head.position.y = 1.1;
    const eye = new THREE.Mesh(geo.eye, mat.eye); eye.position.set(0, 1.12, .28); eye.scale.set(1.4, 1, .6);
    const antenna = new THREE.Mesh(geo.antenna, mat.face); antenna.position.y = 1.5;
    const tip = new THREE.Mesh(geo.tip, mat.tip); tip.position.y = 1.68;
    for (const m of [torso, head]) { m.castShadow = true; m.receiveShadow = true; }
    body.add(torso, head, eye, antenna, tip);
    const shadow = new THREE.Mesh(geo.shadow, mat.shadow); shadow.position.y = .03;
    root.add(body, shadow);
    return { root, body };
  }

  function sync(state) {
    const seen = new Set();
    for (const zone of ['farm', 'shop']) {
      const list = state.world.currentRegion ? assignedUnits(state, state.world.currentRegion, zone).slice(0, STAFF_SLOTS[zone]) : [];
      list.forEach((u, i) => {
        const def = STAFF[u.type];
        if (!def) return;
        seen.add(u.uid);
        let e = units.get(u.uid);
        if (!e) {
          if (def.kind === 'robot') e = { ...makeRobot(u.type), kind: 'robot' };
          else {
            const person = createPerson(zone === 'farm' ? '#6f9a4a' : '#8a5a3a', { gender: i % 2 ? 'female' : 'male' });
            if (def.model) dressPerson(person, def.model);
            e = { root: person, body: person, kind: 'worker' };
          }
          e.phase = Math.random() * 6;
          units.set(u.uid, e);
        }
        if (e.root.parent !== zones[zone]) zones[zone].add(e.root);
        const spot = SPOTS[zone].at(i);
        e.root.position.set(spot.x, 0, spot.z);
        e.root.rotation.y = SPOTS[zone].yaw;
      });
    }
    for (const [uid, e] of units) if (!seen.has(uid)) remove(uid, e);
  }
  function remove(uid, e) {
    e.root.removeFromParent();
    if (e.kind === 'worker') disposeScene(e.root); // person blocks own their geometry; robot parts are shared
    units.delete(uid);
  }

  function update(dt, time) {
    for (const e of units.values()) {
      if (e.kind !== 'robot') continue;
      e.body.position.y = .25 + Math.sin(time * 2.4 + e.phase) * .08;
      e.body.rotation.y = Math.sin(time * .8 + e.phase) * .35;
    }
  }

  return {
    group, sync, update,
    setView(v) { zones.farm.visible = v === 'farm'; zones.shop.visible = v === 'cafe'; },
    clear() { for (const [uid, e] of [...units]) remove(uid, e); },
    dispose() {
      this.clear();
      Object.values(geo).forEach(g => g.dispose());
      Object.values(mat).forEach(m => m.dispose());
      group.removeFromParent();
    },
  };
}
