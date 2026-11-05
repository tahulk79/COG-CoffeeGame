// Buildings of the current region: one normalized prefab per type (GLB scaled to its footprint), cloned per building.
// Level badge, build rise + dust, upgrade bounce + sparkle, brew counter steam / ready cups, roaster chimney smoke.
import * as THREE from 'three';
import { BUILDINGS, CELL } from '../../core/config/economy.js';
import { region as regionOf } from '../../core/derive.js';
import { t } from '../../i18n/index.js';
import { makeLabel, normalizeModel, placeholderBox, easeOutBack } from './util.js';

const COUNTER_TOP = 1.02; // raw GLB height of the pickup counter's work surface (machine and cups sit on it)
const MAX_SCALE = { orderCounter: 1.15, brewCounter: 1.15 };
const RISE = .7;

/** Builds the normalized prefab for a building type from loaded GLB templates (path → Object3D|null). */
export function makePrefab(type, templates) {
  const def = BUILDINGS[type];
  const w = def.size[0] * CELL, d = def.size[1] * CELL;
  const raw = new THREE.Group();
  const base = templates[def.model];
  if (base) raw.add(base.clone());
  else raw.add(placeholderBox(w * .8, 1.6, d * .8));
  const marks = {};
  if (type === 'brewCounter') {
    const machine = templates['cafe/espresso-machine.glb#machine'];
    if (machine) { const m = machine.clone(); m.position.set(0, COUNTER_TOP, -.18); raw.add(m); }
    marks.steam = new THREE.Vector3(.3, COUNTER_TOP + .95, -.1);
    marks.cup = new THREE.Vector3(0, COUNTER_TOP + .09, .3);
  }
  if (type === 'tables' && templates['cafe/table.glb#chairs_pair']) raw.add(templates['cafe/table.glb#chairs_pair'].clone());
  const prefab = normalizeModel(raw, w, d, { fill: .92, maxScale: MAX_SCALE[type] ?? 1.4 });
  const s = prefab.userData.scale;
  const inner = prefab.children[0];
  // Marker points converted into prefab space (plain objects so Object3D.clone keeps them).
  const toPrefab = v => ({ x: v.x * s + inner.position.x, y: v.y * s + inner.position.y, z: v.z * s + inner.position.z });
  if (marks.steam) prefab.userData.steam = toPrefab(marks.steam);
  if (marks.cup) prefab.userData.cup = toPrefab(marks.cup);
  if (type === 'roaster') {
    prefab.updateMatrixWorld(true);
    const top = prefab.getObjectByName('chimney_top');
    if (top) { const v = top.getWorldPosition(new THREE.Vector3()); prefab.userData.chimney = { x: v.x, y: v.y, z: v.z }; }
    else prefab.userData.chimney = { x: w * .3, y: prefab.userData.height, z: d * .3 };
  }
  return prefab;
}

export function createBuildings({ scene, prefabs, templates, vfx }) {
  const group = new THREE.Group();
  group.name = 'realm-buildings';
  scene.add(group);
  const pickMat = new THREE.MeshBasicMaterial();
  const entities = new Map(); // uid → entity
  const cupTemplate = templates['cafe/props.glb#cup'];
  const tmp = new THREE.Vector3();

  function create(b) {
    const def = BUILDINGS[b.type];
    const prefab = prefabs[b.type];
    const root = new THREE.Group();
    const model = prefab.clone();
    root.add(model);
    const height = prefab.userData.height || 2;
    const fw = def.size[0] * CELL, fd = def.size[1] * CELL;
    const pick = new THREE.Mesh(new THREE.BoxGeometry(fw, Math.max(1.2, height), fd).translate(0, Math.max(1.2, height) / 2, 0), pickMat);
    pick.visible = false;
    root.add(pick);
    const e = { uid: b.uid, type: b.type, level: 0, x: NaN, z: NaN, rot: -1, root, model, pick, height, badge: null, rise: -1, emitter: null, steam: null, cups: [] };
    pick.userData.target = { kind: 'building', uid: b.uid, type: b.type };
    if (!def.decor) {
      e.badge = makeLabel('', { bg: '#ffe9a8', border: '#d39a2a', height: .62 });
      e.badge.sprite.position.y = height + .55;
      root.add(e.badge.sprite);
    }
    if (b.type === 'brewCounter' && cupTemplate) {
      for (let i = 0; i < 3; i++) {
        const cup = cupTemplate.clone();
        cup.scale.setScalar(1.6);
        const c = prefab.userData.cup;
        cup.position.set(c.x + (i - 1) * .45, c.y + .14, c.z);
        cup.visible = false;
        model.add(cup);
        e.cups.push(cup);
      }
    }
    group.add(root);
    return e;
  }

  function place(e, b) {
    if (e.x === b.x && e.z === b.z && e.rot === b.rot) return;
    e.x = b.x; e.z = b.z; e.rot = b.rot;
    e.root.position.set(b.x, 0, b.z);
    e.root.rotation.y = -(b.rot % 4) * Math.PI / 2;
    e.root.updateMatrixWorld(true);
    const c = e.model.userData.chimney;
    if (c) {
      e.root.localToWorld(tmp.set(c.x, c.y, c.z));
      if (e.emitter) e.emitter.move(tmp); else e.emitter = vfx.emitter('dust', tmp, { rate: 2.5 });
    }
    if (e.steam) { e.steam.stop(); e.steam = null; }
  }

  function sync(state) {
    const list = regionOf(state)?.buildings || [];
    const seen = new Set();
    for (const b of list) {
      if (!BUILDINGS[b.type]) continue;
      seen.add(b.uid);
      let e = entities.get(b.uid);
      if (!e) { e = create(b); entities.set(b.uid, e); }
      place(e, b);
      if (e.level !== b.level) { e.level = b.level; e.badge?.set(t('realm.level', { level: b.level })); }
    }
    for (const [uid, e] of entities) if (!seen.has(uid)) remove(uid, e);
  }
  function remove(uid, e) {
    e.emitter?.stop(); e.steam?.stop();
    e.badge?.dispose();
    e.pick.geometry.dispose();
    e.root.removeFromParent();
    entities.delete(uid);
  }

  function onBuilt(uid, time) {
    const e = entities.get(uid);
    if (!e) return;
    e.rise = time;
    e.model.position.y = -e.height;
    vfx.burst('dust', e.root.position, { count: 14 });
  }
  function onUpgraded(uid) {
    const e = entities.get(uid);
    if (!e) return;
    vfx.pulse(e.model, { scale: 1.15, ms: 500 });
    tmp.copy(e.root.position); tmp.y = e.height * .7;
    vfx.burst('sparkle', tmp, { count: 14 });
  }

  // orders: current region orders (store objects, read only). now: Date.now().
  function update(dt, time, orders, now) {
    for (const e of entities.values()) {
      if (e.rise >= 0) {
        const k = (time - e.rise) / RISE;
        if (k >= 1) { e.rise = -1; e.model.position.y = 0; }
        else e.model.position.y = -e.height * (1 - easeOutBack(k));
      }
      if (e.type !== 'brewCounter') continue;
      let brewing = 0, ready = 0;
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        if (o.stage !== 'brewing') continue;
        if (now - o.brewStart >= o.brewMs) ready++; else brewing++;
      }
      for (let i = 0; i < e.cups.length; i++) e.cups[i].visible = i < ready;
      if (brewing && !e.steam) {
        const s = e.model.userData.steam;
        e.steam = vfx.emitter('steam', e.root.localToWorld(tmp.set(s.x, s.y, s.z)), { rate: 7 });
      } else if (!brewing && e.steam) { e.steam.stop(); e.steam = null; }
    }
  }

  return {
    group, sync, update, onBuilt, onUpgraded,
    get: uid => entities.get(uid) || null,
    byType: type => { for (const e of entities.values()) if (e.type === type) return e; return null; },
    pickers: function* () { for (const e of entities.values()) if (e.root.visible) yield e.pick; },
    setHidden(uid, hidden) { const e = entities.get(uid); if (e) e.root.visible = !hidden; },
    clear() { for (const [uid, e] of [...entities]) remove(uid, e); },
    dispose() { this.clear(); pickMat.dispose(); group.removeFromParent(); },
  };
}
