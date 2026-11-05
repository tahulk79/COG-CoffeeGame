// Buildings of the current region: one normalized prefab per type (GLB scaled to fill its footprint), cloned per building.
// Small models (storehouse stall, kiosk) stand on a wooden deck that fills the footprint; the café counters get a
// colored sign board (+ striped awning on the order counter) with a world-space label so new players can tell them apart.
// Level badge, build rise + dust, upgrade bounce + sparkle, brew counter steam / ready cups, roaster chimney smoke.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS, CELL } from '../../core/config/economy.js';
import { region as regionOf } from '../../core/derive.js';
import { areaAt } from '../../core/config/layout.js';
import { t, hasKey } from '../../i18n/index.js';
import { makeLabel, normalizeModel, placeholderBox, easeOutBack, paint, mulberry32 } from './util.js';

const COUNTER_TOP = 1.02; // raw GLB height of the pickup counter's work surface (machine and cups sit on it)
const FIT = { fill: .9, maxScale: 2, maxHeight: 3.6 }; // buildings fill ~90% of the footprint (larger side), aspect kept
const DECOR_FIT = { fill: .92, maxScale: 1.4 };
const DECK_H = .14;
const DECK_COVERAGE = .55; // models covering less of their footprint than this stand on a deck
const RISE = .7;
// Café counter signs. Label text: realm.sign.* when the locale has it, else the building name.
const SIGNS = {
  orderCounter: { accent: '#e8673c', icon: '🧾', key: 'realm.sign.order', fallback: 'building.orderCounter', awning: true },
  brewCounter: { accent: '#2f9e8f', icon: '☕', key: 'realm.sign.brew', fallback: 'building.brewCounter', awning: false },
};

let propMat = null; // shared vertex-colored material for decks / sacks / signs (disposed with the scene, re-uploads on reuse)
const propMaterial = () => (propMat ||= new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .88, flatShading: true }));

// Plank deck filling the footprint; `front` (z, prefab space) onwards gets sacks + crates for the storehouse.
function deckGeometry(w, d, type, front) {
  const parts = [];
  const add = (g, color, x, y, z) => parts.push(paint(g.translate(x, y, z), color));
  add(new THREE.BoxGeometry(w * .97, DECK_H * .6, d * .97), '#8a5f3a', 0, DECK_H * .3, 0);
  const n = Math.max(4, Math.round(d / .5)), pw = d * .95 / n;
  for (let i = 0; i < n; i++) add(new THREE.BoxGeometry(w * .95, DECK_H * .45, pw - .04), i % 2 ? '#c99b66' : '#b98b58', 0, DECK_H * .78, -d * .475 + pw * (i + .5));
  if (type === 'silo' && d / 2 - front > .6) {
    const rnd = mulberry32(9);
    const z = (front + d / 2) / 2;
    for (const x of [-w * .32, -w * .12, w * .3]) {
      const sx = x + (rnd() - .5) * .2;
      add(new THREE.IcosahedronGeometry(.34, 1).scale(1, .82, .85), '#dcc08f', sx, DECK_H + .27, z + (rnd() - .5) * .2);
      add(new THREE.CylinderGeometry(.08, .12, .12, 6), '#a07850', sx, DECK_H + .58, z);
    }
    add(new THREE.BoxGeometry(.62, .55, .62), '#b07a43', w * .1, DECK_H + .275, z + .05);
    add(new THREE.BoxGeometry(.66, .08, .66), '#7a5230', w * .1, DECK_H + .42, z + .05);
    add(new THREE.IcosahedronGeometry(.16, 0), '#c23b2b', w * .1 - .12, DECK_H + .62, z);
    add(new THREE.IcosahedronGeometry(.16, 0), '#7a3b1e', w * .1 + .12, DECK_H + .62, z + .1);
  }
  const g = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return g;
}

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
  const prefab = normalizeModel(raw, w, d, def.decor ? DECOR_FIT : FIT);
  const s = prefab.userData.scale;
  const inner = prefab.children[0];
  // Deck under small models: lifts the model, pushes it to the back half when there is room for props in front.
  if (!def.decor) {
    const box = new THREE.Box3().setFromObject(inner);
    const mw = box.max.x - box.min.x, md = box.max.z - box.min.z;
    if (mw * md < w * d * DECK_COVERAGE) {
      const back = type === 'silo' ? Math.max(0, (d * .95 - md) / 2 - .05) : 0;
      inner.position.y += DECK_H;
      inner.position.z -= back;
      const deck = new THREE.Mesh(deckGeometry(w, d, type, box.max.z - back), propMaterial());
      deck.castShadow = true; deck.receiveShadow = true;
      deck.name = 'deck';
      prefab.add(deck);
      prefab.userData.height += DECK_H;
    }
  }
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

// Counter sign (prefab space, front = +z): two posts at the back edge, an accent board above the model and, for the
// order counter, a striped awning sloping forward under the board. Returns { geometry, boardY, top }.
function counterSignGeometry(type, modelH, fw, fd) {
  const cfg = SIGNS[type];
  const parts = [];
  const add = (g, color, x, y, z) => parts.push(paint(g.translate(x, y, z), color));
  const boardY = Math.max(modelH, 2.4) + .75, backZ = -fd / 2 + .14, bw = fw * .84;
  for (const x of [-bw / 2 + .1, bw / 2 - .1]) add(new THREE.BoxGeometry(.13, boardY + .3, .13), '#6e4a2c', x, (boardY + .3) / 2, backZ - .06);
  add(new THREE.BoxGeometry(bw + .14, .86, .08), '#fff4e0', 0, boardY, backZ - .02);
  add(new THREE.BoxGeometry(bw, .74, .1), cfg.accent, 0, boardY, backZ);
  add(new THREE.BoxGeometry(bw + .3, .08, .3), '#6e4a2c', 0, boardY + .47, backZ);
  if (cfg.awning) {
    const n = 8, sw = (bw + .2) / n, depth = 1.05, tilt = .38;
    for (let i = 0; i < n; i++) {
      const g = new THREE.BoxGeometry(sw, .05, depth).translate(0, 0, depth / 2).rotateX(tilt);
      add(g, i % 2 ? '#fff4e0' : cfg.accent, -(bw + .2) / 2 + sw * (i + .5), boardY - .52, backZ + .02);
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return { geometry, boardY, top: boardY + .9, labelZ: backZ + .3 }; // top keeps the level badge clear of the label
}

export function createBuildings({ scene, prefabs, templates, vfx }) {
  const group = new THREE.Group();
  group.name = 'realm-buildings';
  scene.add(group);
  // One child group per area (farm / café): only the current view's group is visible and pickable.
  const areas = { farm: new THREE.Group(), cafe: new THREE.Group() };
  areas.farm.name = 'realm-buildings-farm'; areas.cafe.name = 'realm-buildings-cafe';
  group.add(areas.farm, areas.cafe);
  let view = null; // null → every area visible/pickable (before the realm applies its first view)
  const pickMat = new THREE.MeshBasicMaterial();
  const signs = {}; // type → counter sign geometry (shared by every building of that type)
  const entities = new Map(); // uid → entity
  const cupTemplate = templates['cafe/props.glb#cup'];
  const tmp = new THREE.Vector3();

  function create(b) {
    const def = BUILDINGS[b.type];
    const prefab = prefabs[b.type];
    const root = new THREE.Group();
    const model = prefab.clone();
    root.add(model);
    let height = prefab.userData.height || 2;
    const fw = def.size[0] * CELL, fd = def.size[1] * CELL;
    let sign = null;
    if (SIGNS[b.type]) {
      const cfg = SIGNS[b.type];
      const sg = signs[b.type] ||= counterSignGeometry(b.type, height, fw, fd);
      const board = new THREE.Mesh(sg.geometry, propMaterial());
      board.castShadow = true;
      board.raycast = () => {};
      model.add(board);
      sign = makeLabel(`${cfg.icon} ${t(hasKey(cfg.key) ? cfg.key : cfg.fallback)}`, { bg: cfg.accent, fg: '#ffffff', border: '#fff4e0', height: .6, onTop: true });
      sign.sprite.position.set(0, sg.boardY, sg.labelZ);
      model.add(sign.sprite);
      height = sg.top;
    }
    const pick = new THREE.Mesh(new THREE.BoxGeometry(fw, Math.max(1.2, height), fd).translate(0, Math.max(1.2, height) / 2, 0), pickMat);
    pick.visible = false;
    root.add(pick);
    const e = { uid: b.uid, type: b.type, area: null, level: 0, x: NaN, z: NaN, rot: -1, root, model, pick, height, badge: null, sign, rise: -1, emitter: null, steam: null, cups: [] };
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
    return e;
  }

  function place(e, b) {
    if (e.x === b.x && e.z === b.z && e.rot === b.rot) return;
    e.x = b.x; e.z = b.z; e.rot = b.rot;
    const area = areaAt(b.x, b.z);
    if (area !== e.area) { e.area = area; areas[area].add(e.root); }
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
    e.sign?.dispose();
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
    pickers: function* () { for (const e of entities.values()) if (e.root.visible && (!view || e.area === view)) yield e.pick; },
    /** Shows only the buildings of one area ('farm' | 'cafe'). */
    setView(v) { view = v; areas.farm.visible = v === 'farm'; areas.cafe.visible = v === 'cafe'; },
    setHidden(uid, hidden) { const e = entities.get(uid); if (e) e.root.visible = !hidden; },
    clear() { for (const [uid, e] of [...entities]) remove(uid, e); },
    dispose() {
      this.clear();
      pickMat.dispose();
      for (const sg of Object.values(signs)) sg.geometry.dispose();
      group.removeFromParent();
    },
  };
}
