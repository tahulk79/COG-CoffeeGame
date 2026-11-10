// Buildings of the current region: one normalized prefab per type (GLB scaled to fill its footprint), cloned per building.
// Small models (storehouse stall, kiosk) stand on a wooden deck that fills the footprint; the café counters get a
// colored sign board (+ striped awning on the order counter) with a world-space label so new players can tell them apart.
// Level badge, build rise + dust, upgrade bounce + sparkle, brew counter steam / ready cups, roaster chimney smoke.
// Farm World 2.0: model-less farm buildings (warehouse, packer) are procedural vertex-coloured meshes; producers
// (BUILDINGS[].recipe: dryer, roastery, packer) show their saved batch (b.job): a working animation + a thin progress
// bar while it runs, one celebratory bounce when it becomes ready. makePrefab('field') = the placement ghost of a bed.
// Fields are not buildings (region.fields): they never appear here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BUILDINGS, CELL } from '../../core/config/economy.js';
import { region as regionOf } from '../../core/derive.js';
import { areaAt, CAFE_SEATS, FIXED, PLOT_SIZE, farmGroundY } from '../../core/config/layout.js';
import { terraceSeats, TERRACE_TABLE_TOP, TERRACE_TABLE_Z } from './seats.js';
import { t, hasKey } from '../../i18n/index.js';
import { makeLabel, normalizeModel, placeholderBox, easeOutBack, paint, mulberry32, freezeStatic } from './util.js';
import { farmTex } from '../../shared/three/farm-textures.js';

const COUNTER_TOP = 1.02; // raw GLB height of the pickup counter's work surface (machine and cups sit on it)
const FIT = { fill: .9, maxScale: 2, maxHeight: 3.6 }; // buildings fill ~90% of the footprint (larger side), aspect kept
const DECOR_FIT = { fill: .92, maxScale: 1.4 };
const DECK_H = .14;
const DECK_COVERAGE = 0; // no wooden deck under any building any more (founder 2026-11-08): the model stands on the ground
const RISE = .55;
// Effects while a machine runs: [particle kind, per second, spread in metres].
const PROD_FX = { wetMill: [['splash', 5, 1.4], ['mist', 2, 1.2]], dryer: [['steam', 4, 5]] };
const BAR_W = 1.5, BAR_H = .26, BAR_FILL_W = BAR_W * .92, BAR_FILL_H = BAR_H * .62; // production bar (world m)
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
  if ((type === 'silo' || type === 'warehouse') && d / 2 - front > .6) {
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

// ---------- terrace (procedural, walkable): a tiled sidewalk deck; stools + low tables depend on the level ----------
const TERRACE_COLORS = ['#2f6fd6', '#d8342c'];
function terraceDeckGeometry(w, d) {
  const parts = [];
  const add = (g, color, x, y, z) => parts.push(paint(g.translate(x, y, z), color));
  add(new THREE.BoxGeometry(w, .04, d), '#d7cbb5', 0, .02, 0);
  const n = Math.round(w / 1), m = Math.round(d / 1);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if ((i + j) % 2) add(new THREE.BoxGeometry(w / n - .06, .012, d / m - .06), '#e6dcc8', -w / 2 + w / n * (i + .5), .046, -d / 2 + d / m * (j + .5));
  const g = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return g;
}
// Stools of the first `active` CAFE_SEATS (+ their column tables) and dim discs where the next level adds stools.
// Coordinates are local to the terrace building (centered on FIXED.terrace).
function terraceSeatsGeometry(active, next) {
  const parts = [];
  const add = (g, color, x, y, z) => parts.push(paint(g.translate(x - FIXED.terrace.x, y, z - FIXED.terrace.z), color));
  const columns = new Map();
  CAFE_SEATS.forEach((s, i) => {
    if (i >= next) return;
    const key = s.x.toFixed(2);
    if (i < active) {
      const c = TERRACE_COLORS[i % 2];
      add(new THREE.CylinderGeometry(.18, .22, .36, 8), c, s.x, .18, s.z);
      add(new THREE.CylinderGeometry(.2, .2, .04, 10), c, s.x, .38, s.z);
      columns.set(key, s.x);
    } else add(new THREE.CylinderGeometry(.22, .22, .02, 12), '#b9ad97', s.x, .06, s.z); // "more seats with the next upgrade"
  });
  let k = 0;
  for (const x of columns.values()) {
    const c = TERRACE_COLORS[k++ % 2], top = TERRACE_TABLE_TOP, z = TERRACE_TABLE_Z;
    add(new THREE.BoxGeometry(.62, .05, .62), c, x, top, z);
    for (const [dx, dz] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]]) add(new THREE.BoxGeometry(.05, top, .05), c, x + dx, top / 2, z + dz);
    add(new THREE.CylinderGeometry(.05, .05, .12, 8), '#f4f1e6', x + .14, top + .08, z - .1);
  }
  if (!parts.length) return new THREE.BufferGeometry();
  const g = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return g;
}

// ---------- procedural farm buildings (no GLB): merged boxes/cylinders, vertex colours, shared propMaterial ----------
const merged = parts => { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g; };
// Small red barn (warehouse): stone apron, plank body with white corner trim, gable roof, double doors with white X
// braces, hayloft window, a hay bale by the door. Front = +z. Returns { geometry, height }.
function warehouseGeometry(w, d) {
  const parts = [];
  const add = (g, color, x, y, z) => parts.push(paint(g.translate(x, y, z), color));
  const W = w * .74, D = d * .66, H = 1.6, y0 = .12, z0 = -d * .06, top = y0 + H, zf = z0 + D / 2;
  add(new THREE.BoxGeometry(w * .9, y0, d * .86), '#a39886', 0, y0 / 2, 0);
  add(new THREE.BoxGeometry(W, H, D), '#c0392b', 0, y0 + H / 2, z0);
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(.05, H * .96, .03), '#a93226', -W * .4 + i * W * .2, y0 + H / 2, zf + .01); // plank seams
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(.13, H, .13), '#f4ede0', sx * W / 2, y0 + H / 2, z0 + sz * D / 2);
  add(new THREE.BoxGeometry(W + .1, .12, D + .1), '#f4ede0', 0, top - .02, z0);
  // Gable: a triangular prism (3-sided cylinder lying along z), apex up.
  const r = W / Math.sqrt(3), gH = .95, k = gH / (1.5 * r);
  add(new THREE.CylinderGeometry(r, r, D, 3).rotateX(-Math.PI / 2).scale(1, k, 1), '#c0392b', 0, top + k * r / 2, z0);
  const a = Math.atan2(gH, W / 2), L = Math.hypot(W / 2, gH) + .32;
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(L, .12, D + .42).rotateZ(-sx * a), '#5b3a2a', sx * W / 4, top + gH / 2 + .08, z0);
  add(new THREE.BoxGeometry(.2, .14, D + .46), '#4a2f22', 0, top + gH + .12, z0);
  // Double doors + white X braces, hayloft window above.
  const dh = H * .78, dw = W * .25, dy = y0 + dh / 2;
  add(new THREE.BoxGeometry(dw * 2 + .14, dh + .1, .05), '#f4ede0', 0, dy + .02, zf + .02);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(dw - .04, dh - .04, .06), '#8e2a1f', sx * dw / 2, dy, zf + .04);
    const da = Math.atan2(dh - .1, dw - .1), dl = Math.hypot(dw - .1, dh - .1);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(dl, .07, .03).rotateZ(s * da), '#f4ede0', sx * dw / 2, dy, zf + .08);
  }
  add(new THREE.BoxGeometry(.52, .42, .05), '#f4ede0', 0, top + gH * .36, zf + .02);
  add(new THREE.BoxGeometry(.38, .3, .06), '#3b2a20', 0, top + gH * .36, zf + .03);
  add(new THREE.CylinderGeometry(.27, .27, .62, 8).rotateZ(Math.PI / 2), '#e3c25a', W * .36, y0 + .27, zf + .4);
  add(new THREE.CylinderGeometry(.275, .275, .05, 8).rotateZ(Math.PI / 2), '#c9a43f', W * .36, y0 + .27, zf + .4);
  return { geometry: merged(parts), height: top + gH + .2 };
}
// Packing shed (packer): plank floor, wooden shed at the back with a dark doorway and a sloped roof, a striped awning
// on posts over a packing table, sacks stacked on the left and paper bags (red band) on the right. Front = +z.
function packerGeometry(w, d) {
  const parts = [];
  const add = (g, color, x, y, z) => parts.push(paint(g.translate(x, y, z), color));
  const y0 = .1, Wb = w * .8, Db = d * .46, Hb = 1.65, zb = -d * .23, zf = zb + Db / 2;
  add(new THREE.BoxGeometry(w * .95, y0 * .6, d * .95), '#8a5f3a', 0, y0 * .3, 0);
  const n = 7, pw = d * .93 / n;
  for (let i = 0; i < n; i++) add(new THREE.BoxGeometry(w * .93, y0 * .45, pw - .04), i % 2 ? '#c99b66' : '#b98b58', 0, y0 * .78, -d * .465 + pw * (i + .5));
  add(new THREE.BoxGeometry(Wb, Hb, Db), '#b98b58', 0, y0 + Hb / 2, zb);
  for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(.04, Hb * .96, .03), '#8f6a42', -Wb * .45 + i * Wb * .15, y0 + Hb / 2, zf + .01);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.14, Hb, .14), '#6e4a2c', sx * Wb / 2, y0 + Hb / 2, zf);
  add(new THREE.BoxGeometry(Wb * .42, Hb * .68, .05), '#3b2a1e', -Wb * .14, y0 + Hb * .34, zf + .03);
  add(new THREE.BoxGeometry(Wb + .34, .12, Db + .22).rotateX(.14), '#6e4a2c', 0, y0 + Hb + .12, zb + .06);
  // Awning (cream / orange stripes) sloping forward from the shed front, on two posts.
  const sn = 8, sw = (Wb + .1) / sn, depth = 1.05, tilt = .34, ay = y0 + Hb - .08;
  for (let i = 0; i < sn; i++) add(new THREE.BoxGeometry(sw, .05, depth).translate(0, 0, depth / 2).rotateX(tilt), i % 2 ? '#fff4e0' : '#e8673c', -(Wb + .1) / 2 + sw * (i + .5), ay, zf + .02);
  const pz = zf + Math.cos(tilt) * depth - .06, ph = ay - Math.sin(tilt) * depth - y0;
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.09, ph, .09), '#6e4a2c', sx * (Wb / 2 - .05), y0 + ph / 2, pz);
  // Packing table under the awning with two bags on it.
  add(new THREE.BoxGeometry(Wb * .4, .07, .5), '#a07850', Wb * .12, y0 + .72, zf + .42);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(.06, .7, .06), '#6e4a2c', Wb * .12 + dx * Wb * .18, y0 + .35, zf + .42 + dz * .2);
  // Sacks (left) and paper bags (right) stacked in front.
  const sack = (x, y, z) => { add(new THREE.IcosahedronGeometry(.3, 1).scale(1, .8, .85), '#dcc08f', x, y, z); add(new THREE.CylinderGeometry(.07, .1, .1, 6), '#a07850', x, y + .27, z); };
  sack(-w * .3, y0 + .24, zf + .55); sack(-w * .15, y0 + .24, zf + .7); sack(-w * .23, y0 + .66, zf + .62);
  const bag = (x, y, z) => { add(new THREE.BoxGeometry(.3, .4, .22), '#c9a46a', x, y + .2, z); add(new THREE.BoxGeometry(.31, .08, .23), '#c23b2b', x, y + .24, z); add(new THREE.BoxGeometry(.3, .05, .1), '#a9884f', x, y + .42, z); };
  bag(w * .26, y0, zf + 1.25); bag(w * .36, y0, zf + 1.25); bag(w * .31, y0 + .45, zf + 1.25);
  bag(Wb * .06, y0 + .76, zf + .42); bag(Wb * .2, y0 + .76, zf + .42);
  return { geometry: merged(parts), height: y0 + Hb + .32 };
}
const PROCEDURAL = { warehouse: warehouseGeometry, packer: packerGeometry };
// Soil bed + tiny sprout: the placement ghost of a new / moved field (same bed size as plots.js).
function fieldGeometry() {
  const parts = [];
  const add = (g, color, x, y, z) => parts.push(paint(g.translate(x, y, z), color));
  const b = PLOT_SIZE;
  add(new RoundedBoxGeometry(b, .26, b, 2, .1), '#8b5e3c', 0, .13, 0);
  for (const z of [-.6, 0, .6]) add(new THREE.BoxGeometry(b * .86, .03, .14), '#6e4529', 0, .265, z);
  add(new THREE.CylinderGeometry(.025, .035, .26, 5), '#5c8a3a', 0, .39, 0);
  for (const sx of [-1, 1]) add(new THREE.IcosahedronGeometry(.1, 0).scale(1.5, .45, .8).rotateZ(sx * .35), '#6fbf4a', sx * .11, .52, 0);
  return merged(parts);
}

/** Builds the normalized prefab for a building type from loaded GLB templates (path → Object3D|null). 'field' → the
 *  soil-bed ghost (placement only). Model-less farm buildings (warehouse, packer) → procedural meshes. */
export function makePrefab(type, templates = {}) {
  if (type === 'field') {
    const prefab = new THREE.Group();
    const bed = new THREE.Mesh(fieldGeometry(), propMaterial());
    bed.receiveShadow = true;
    bed.name = 'field';
    prefab.add(bed);
    prefab.userData.height = .6;
    prefab.userData.scale = 1;
    return prefab;
  }
  const def = BUILDINGS[type];
  if (!def) return null;
  if (!def.model && PROCEDURAL[type]) {
    const { geometry, height } = PROCEDURAL[type](def.size[0] * CELL, def.size[1] * CELL);
    const prefab = new THREE.Group();
    const inner = new THREE.Group(); // children[0]: the part production animations move (as with normalizeModel)
    const mesh = new THREE.Mesh(geometry, propMaterial());
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = type;
    inner.add(mesh);
    prefab.add(inner);
    prefab.userData.height = height;
    prefab.userData.scale = 1;
    return prefab;
  }
  if (type === 'terrace') {
    const prefab = new THREE.Group();
    const deck = new THREE.Mesh(terraceDeckGeometry(def.size[0] * CELL, def.size[1] * CELL), propMaterial());
    deck.receiveShadow = true;
    deck.name = 'deck';
    prefab.add(deck);
    prefab.userData.height = .5;
    prefab.userData.scale = 1;
    return prefab;
  }
  // Real-size models (shade trees, enset): keep the authored metres instead of fitting the footprint.
  if (def.trueScale && templates[def.model]) {
    const prefab = new THREE.Group(), inner = new THREE.Group();
    inner.add(templates[def.model].clone()); inner.scale.setScalar(typeof def.trueScale === 'number' ? def.trueScale : 1); prefab.add(inner);
    prefab.userData.height = Math.min(4, new THREE.Box3().setFromObject(inner).max.y); // badge anchor stays low
    prefab.userData.scale = 1;
    return prefab;
  }
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
  // Tables: customers sit on its two chairs (seats.js reads the measured chair offset + table height).
  if (type === 'tables') prefab.userData.tableInfo = { dx: .85 * s, top: .8 * s };
  // Deck under small models: lifts the model, pushes it to the back half when there is room for props in front.
  if (!def.decor && type !== 'tables') {
    const box = new THREE.Box3().setFromObject(inner);
    const mw = box.max.x - box.min.x, md = box.max.z - box.min.z;
    if (mw * md < w * d * DECK_COVERAGE) {
      const back = (type === 'silo' || type === 'warehouse') ? Math.max(0, (d * .95 - md) / 2 - .05) : 0;
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
  if (type === 'roaster' || type === 'roastery') {
    prefab.updateMatrixWorld(true);
    const top = prefab.getObjectByName('chimney_top');
    const v = top ? top.getWorldPosition(new THREE.Vector3()) : { x: w * .3, y: prefab.userData.height, z: d * .3 };
    // Café roaster: always smoking (chimney). Farm roastery: smokes only while a batch is roasting (smoke).
    prefab.userData[type === 'roaster' ? 'chimney' : 'smoke'] = { x: v.x, y: v.y, z: v.z };
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
  // Production progress bar (producers only): two sprites sharing two materials (track + fill) for every building.
  let barMats = null;
  function barMaterials() {
    if (barMats) return barMats;
    const mat = draw => {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 24;
      draw(canvas.getContext('2d'));
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      return new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false });
    };
    const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    barMats = {
      track: mat(g => { g.fillStyle = '#fff4e0'; rr(g, 1, 1, 126, 22, 11); g.fill(); g.fillStyle = '#5a3a1c'; rr(g, 4, 4, 120, 16, 8); g.fill(); }),
      fill: mat(g => { const gr = g.createLinearGradient(0, 0, 0, 24); gr.addColorStop(0, '#8ef07a'); gr.addColorStop(1, '#3fb84a'); g.fillStyle = gr; g.fillRect(0, 0, 128, 24); }),
    };
    return barMats;
  }
  function barSprite(material, w, h, order) {
    const sprite = new THREE.Sprite(material);
    sprite.geometry.userData.keep = true; // Sprite geometry is shared by every sprite in three.js
    sprite.raycast = () => {};
    sprite.scale.set(w, h, 1);
    sprite.renderOrder = order;
    sprite.visible = false;
    return sprite;
  }

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
    // No floating "Lv N" label (land-ui-simplify §4): the level lives in the building card's title.
    if (def.recipe) {
      // Producer: animate children[0] (the model wrapper's inner group) so the rise (model.position) and the upgrade
      // pulse (model.scale) keep working. Phase from the uid so duplicates do not move in lockstep.
      const anim = model.children[0] || model;
      let phase = 0;
      for (let i = 0; i < b.uid.length; i++) phase = (phase * 31 + b.uid.charCodeAt(i)) % 997;
      const mats = barMaterials();
      e.prod = {
        stage: null, job: null, anim, phase: phase / 997 * Math.PI * 2,
        basePos: anim.position.clone(), baseScale: anim.scale.clone(),
        track: barSprite(mats.track, BAR_W, BAR_H, 22), fill: barSprite(mats.fill, BAR_FILL_W, BAR_FILL_H, 23),
        smokeAt: model.userData.smoke || null, smokePos: new THREE.Vector3(), smoke: null,
      };
      e.prod.track.position.y = e.prod.fill.position.y = height + .5; // below the badge anchor (height + 1.05), so a ▲ never covers it
      root.add(e.prod.track, e.prod.fill);
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
    // root (place), model (rise, pulse) and children[0] (production) move; the parts below that wrapper never do
    freezeStatic(pick, ...(model.children[0]?.children ?? []));
    return e;
  }

  function place(e, b) {
    if (e.x === b.x && e.z === b.z && e.rot === b.rot) return;
    e.x = b.x; e.z = b.z; e.rot = b.rot;
    const area = areaAt(b.x, b.z);
    if (area !== e.area) { e.area = area; areas[area].add(e.root); }
    e.root.position.set(b.x, farmGroundY(b.x, b.z), b.z); // on its mountain tier
    e.root.rotation.y = -(b.rot % 4) * Math.PI / 2;
    e.root.updateMatrixWorld(true);
    const c = e.model.userData.chimney;
    if (c) {
      e.root.localToWorld(tmp.set(c.x, c.y, c.z));
      if (e.emitter) e.emitter.move(tmp); else e.emitter = vfx.emitter('smoke', tmp, { rate: 2.5 });
    }
    if (e.steam) { e.steam.stop(); e.steam = null; }
    const p = e.prod;
    if (p?.smokeAt) { e.root.localToWorld(p.smokePos.set(p.smokeAt.x, p.smokeAt.y, p.smokeAt.z)); p.smoke?.move(p.smokePos); }
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
      if (e.prod) e.prod.job = b.job || null; // saved batch: update() reads its stage every frame
      if (e.level !== b.level) {
        e.level = b.level;
        e.badge?.set(t('realm.level', { level: b.level }));
        if (b.type === 'terrace') setTerraceLevel(e, b.level);
      }
    }
    for (const [uid, e] of entities) if (!seen.has(uid)) remove(uid, e);
  }
  function setTerraceLevel(e, level) {
    const g = terraceSeatsGeometry(terraceSeats(level), terraceSeats(level + 1));
    if (!e.seats) {
      e.seats = new THREE.Mesh(g, propMaterial());
      e.seats.castShadow = true; e.seats.receiveShadow = true; e.seats.raycast = () => {};
      e.model.add(e.seats);
    } else { e.seats.geometry.dispose(); e.seats.geometry = g; }
  }
  function remove(uid, e) {
    e.seats?.geometry.dispose();
    e.prod?.fx?.forEach(x => x.stop());
    e.emitter?.stop(); e.steam?.stop(); e.prod?.smoke?.stop();
    e.badge?.dispose();
    e.sign?.dispose();
    e.pick.geometry.dispose();
    e.root.removeFromParent();
    entities.delete(uid);
  }

  // A new building lands with one soft bounce: it costs no new materials or shaders, so it can never hitch.
  function onBuilt(uid, time) {
    const e = entities.get(uid);
    if (!e) return;
    e.rise = time;
    e.riseBase = e.model.scale.clone();
    e.model.scale.set(e.riseBase.x * 1.12, e.riseBase.y * .05, e.riseBase.z * 1.12);
    e.model.updateMatrix(); e.model.updateMatrixWorld(true);
    vfx.burst('dust', e.root.position, { count: 10 });
  }
  function onUpgraded(uid) {
    const e = entities.get(uid);
    if (!e) return;
    vfx.pulse(e.model, { scale: 1.15, ms: 500 });
    tmp.copy(e.root.position); tmp.y = e.height * .7;
    vfx.burst('sparkle', tmp, { count: 14 });
  }

  // orders: current region orders (store objects, read only). now: Date.now(). isCarried(orderId): the cup is in the
  // player's or a barista's hand (no longer shown on the counter).
  // Production feedback of one producer from its saved job (same stages as derive.jobState, computed inline so the
  // frame loop allocates nothing): working → animation + progress bar (+ roastery smoke); working → ready → one bounce.
  function updateProd(e, p, time, now) {
    const j = p.job;
    const stage = !j ? 'idle' : now >= j.at + j.ms ? 'ready' : 'working';
    if (stage !== p.stage) {
      const was = p.stage;
      p.stage = stage;
      p.track.visible = p.fill.visible = stage === 'working';
      if (stage !== 'working') { p.anim.position.copy(p.basePos); p.anim.scale.copy(p.baseScale); }
      if (was === 'working' && stage === 'ready') {
        vfx.pulse(e.model, { scale: 1.15, ms: 500 });
        tmp.copy(e.root.position); tmp.y = e.height * .8;
        vfx.burst('sparkle', tmp, { count: 10 });
      }
    }
    const shown = !view || e.area === view;
    const wantSmoke = stage === 'working' && shown && !!p.smokeAt && e.root.visible;
    if (wantSmoke && !p.smoke) p.smoke = vfx.emitter('smoke', p.smokePos, { rate: 1.6 });
    else if (!wantSmoke && p.smoke) { p.smoke.stop(); p.smoke = null; }
    const fx = PROD_FX[e.type], wantFx = stage === 'working' && shown && e.root.visible;
    if (fx && wantFx && !p.fx) { tmp.copy(e.root.position); tmp.y += e.height * .55; p.fx = fx.map(([kind, rate, spread]) => vfx.emitter(kind, tmp, { rate, spread })); }
    else if (!wantFx && p.fx) { p.fx.forEach(x => x.stop()); p.fx = null; }
    if (stage !== 'working' || !shown) return;
    const ratio = Math.min(1, Math.max(.03, j.ms > 0 ? (now - j.at) / j.ms : 1));
    p.fill.scale.x = BAR_FILL_W * ratio;
    p.fill.center.x = .5 / ratio; // left edge stays on the track's left edge (screen space)
    const a = p.anim, bp = p.basePos, bs = p.baseScale, ph = time + p.phase;
    if (e.type === 'packer') { // small bounce + squash
      const k = Math.abs(Math.sin(ph * 4.2));
      a.position.y = bp.y + .07 * k;
      a.scale.set(bs.x * (1 + .025 * (1 - k)), bs.y * (1 - .035 * (1 - k)), bs.z * (1 + .025 * (1 - k)));
    } else if (e.type === 'roastery') { // the drum rumbles a little while the chimney smokes
      a.position.x = bp.x + .012 * Math.sin(ph * 23);
      a.position.z = bp.z + .01 * Math.sin(ph * 19 + 1);
    } else { // dryer (and any other producer): gentle bob + shimmer
      a.position.y = bp.y + .03 * (1 + Math.sin(ph * 3.4));
      a.scale.y = bs.y * (1 + .015 * Math.sin(ph * 9));
    }
  }

  function update(dt, time, orders, now, isCarried = () => false) {
    for (const e of entities.values()) {
      if (e.rise >= 0) {
        const k = (time - e.rise) / RISE, b = e.riseBase;
        if (k >= 1) {
          e.rise = -1; e.model.scale.copy(b);
          vfx.burst('sparkle', tmp.copy(e.root.position).setY(e.root.position.y + e.height + .3), { count: 8 });
        } else {
          const y = Math.max(.05, easeOutBack(k)), wide = 1 + (1 - y) * .35; // squashed wide while low, stretching up past its height, then settling
          e.model.scale.set(b.x * wide, b.y * y, b.z * wide);
        }
        e.model.updateMatrix(); e.model.updateMatrixWorld(true);
      }
      if (e.prod) { updateProd(e, e.prod, time, now); continue; }
      if (e.type !== 'brewCounter') continue;
      let brewing = 0, ready = 0;
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        if (o.stage !== 'brewing') continue;
        if (now - o.brewStart >= o.brewMs) { if (!isCarried(o.id)) ready++; } else brewing++;
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
    pickers: function* () { for (const e of entities.values()) if (e.root.visible && (!view || e.area === view) && !BUILDINGS[e.type].walkable) yield e.pick; },
    /** Shows only the buildings of one area ('farm' | 'cafe'). */
    setView(v) { view = v; areas.farm.visible = v === 'farm'; areas.cafe.visible = v === 'cafe'; },
    setHidden(uid, hidden) {
      const e = entities.get(uid);
      if (!e) return;
      e.root.visible = !hidden;
      // The chimney dust lives outside root: stop it while hidden (a move), restart it at the chimney when shown again.
      if (hidden) { e.emitter?.stop(); e.emitter = null; return; }
      const c = e.model.userData.chimney;
      if (c) {
        e.root.updateMatrixWorld(true);
        e.root.localToWorld(tmp.set(c.x, c.y, c.z));
        if (e.emitter) e.emitter.move(tmp); else e.emitter = vfx.emitter('dust', tmp, { rate: 2.5 });
      }
    },
    clear() { for (const [uid, e] of [...entities]) remove(uid, e); },
    dispose() {
      this.clear();
      pickMat.dispose();
      if (barMats) { for (const m of Object.values(barMats)) { m.map.dispose(); m.dispose(); } barMats = null; }
      for (const sg of Object.values(signs)) sg.geometry.dispose();
      group.removeFromParent();
    },
  };
}
