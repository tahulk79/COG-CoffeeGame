// Farm plots (Farm World 2.0: fields are placeables saved in region.fields, read through D.ownedPlots): one instanced
// soil bed per field + a coffee tree per planted field. Trees are instanced too: one InstancedMesh per mesh part of the
// tree / green-fruit / ripe-fruit templates (part matrices baked once), so every tree on the farm costs the same few
// draw calls. Each tree owns one instance slot in every part mesh; hidden fruit = zero-scale instance. Growth is
// computed per frame from cached plantedAt/growMs (no allocation, no derive calls) and a tree's matrices are only
// rewritten when its scale / bob / fruit / position changed.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PLOT_SIZE } from '../../core/config/layout.js';
import { region as regionOf, plotGrowMs, ownedPlots } from '../../core/derive.js';
import { damp, easeOutBack } from './util.js';

const SCALE_MIN = .22, SCALE_MAX = .65;
const SOIL_DRY = new THREE.Color(0x9b6a43), SOIL_WET = new THREE.Color(0x6e4529), SOIL_GLOW = new THREE.Color(0xe2b47a);
const POP_TIME = .35;
const BED_CAP = 256, TREE_CAP = 64;
const BED_HALF = PLOT_SIZE / 2;
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const KIND_TREE = 0, KIND_GREEN = 1, KIND_RIPE = 2;

// Mesh parts of a template with their matrix relative to the template's parent (= what a clone added to a group at
// the tree position would render: the template's own transform included).
function templateParts(root, kind) {
  const out = [];
  if (!root) return out;
  root.updateMatrixWorld(true);
  const inv = root.parent ? root.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) out.push({ kind, geometry: o.geometry, material: o.material, local: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), mesh: null }); });
  return out;
}

export function createPlots({ scene, templates, vfx }) {
  const group = new THREE.Group();
  group.name = 'realm-plots';
  scene.add(group);
  const m4 = new THREE.Matrix4(), base = new THREE.Matrix4();
  const pos = new THREE.Vector3(), scl = new THREE.Vector3(), quat = new THREE.Quaternion(), col = new THREE.Color(), fx = new THREE.Vector3();

  // ---------- soil beds (capacity grows 2× on demand) ----------
  const bedGeo = new RoundedBoxGeometry(PLOT_SIZE, .26, PLOT_SIZE, 2, .1); // 2.4 m bed, same as bedRect / the contract
  const bedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  let beds = null, bedCap = 0;
  function ensureBeds(n) {
    if (beds && n <= bedCap) return;
    let cap = Math.max(BED_CAP, bedCap);
    while (cap < n) cap *= 2;
    if (beds) { beds.removeFromParent(); beds.dispose(); }
    bedCap = cap;
    beds = new THREE.InstancedMesh(bedGeo, bedMat, cap);
    beds.setColorAt(0, SOIL_DRY); // creates instanceColor
    beds.count = 0;
    beds.receiveShadow = true;
    beds.castShadow = true;
    beds.raycast = () => {};
    group.add(beds);
  }
  ensureBeds(0);

  // Invisible pick boxes per owned plot (catch taps on the trees too).
  const pickGeo = new THREE.BoxGeometry(PLOT_SIZE, 1.6, PLOT_SIZE).translate(0, .8, 0);
  const pickMat = new THREE.MeshBasicMaterial();
  const pickers = new Map(); // plotId → mesh
  const plotList = []; // owned plots in D.ownedPlots order (for tutorial targets / first())
  let bedIndex = new Map(); // plotId → bed instance index (= index in plotList)

  // ---------- instanced trees ----------
  let fallback = null; // procedural cone when the tree GLB is missing
  let treeTpl = templateParts(templates.tree, KIND_TREE);
  if (!treeTpl.length) {
    fallback = { geometry: new THREE.ConeGeometry(.6, 1.4, 7).translate(0, .7, 0), material: new THREE.MeshStandardMaterial({ color: 0x4f8a3a }) };
    treeTpl = [{ kind: KIND_TREE, geometry: fallback.geometry, material: fallback.material, local: new THREE.Matrix4(), mesh: null }];
  }
  const parts = [...treeTpl, ...templateParts(templates.fruitGreen, KIND_GREEN), ...templateParts(templates.fruitRipe, KIND_RIPE)];
  let treeCap = 0, slotHigh = 0, treesDirty = false;
  const freeSlots = [];
  function growTrees(cap) {
    for (const part of parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const arr = mesh.instanceMatrix.array;
      for (let i = treeCap; i < cap; i++) ZERO.toArray(arr, i * 16);
      if (part.mesh) { arr.set(part.mesh.instanceMatrix.array.subarray(0, treeCap * 16)); part.mesh.removeFromParent(); part.mesh.dispose(); }
      mesh.count = slotHigh;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.frustumCulled = false; // instances move every frame; a handful of draw calls, no per-frame bounds
      mesh.raycast = () => {};
      group.add(mesh);
      part.mesh = mesh;
    }
    treeCap = cap;
    treesDirty = true;
  }
  growTrees(TREE_CAP);
  function allocSlot() {
    if (freeSlots.length) return freeSlots.pop();
    if (slotHigh >= treeCap) growTrees(treeCap * 2);
    const i = slotHigh++;
    for (const part of parts) part.mesh.count = slotHigh;
    return i;
  }
  function freeSlot(i) {
    if (i < 0) return;
    for (const part of parts) part.mesh.setMatrixAt(i, ZERO);
    freeSlots.push(i);
    treesDirty = true;
  }
  // Writes one tree's matrices (only when something visible changed since the last write).
  const hidden = new Set(); // field ids hidden while their ghost is being moved (setHidden)
  function writeTree(e, sx, sy, green, ripe) {
    if (e.wx === sx && e.wy === sy && e.wg === green && e.wr === ripe && !e.moved) return;
    e.wx = sx; e.wy = sy; e.wg = green; e.wr = ripe; e.moved = false;
    if (hidden.has(e.id)) { for (const part of parts) part.mesh.setMatrixAt(e.slot, ZERO); treesDirty = true; return; }
    base.compose(pos.set(e.x, .2, e.z), quat.setFromAxisAngle(UP, e.rot), scl.set(sx, sy, sx));
    for (const part of parts) {
      const show = part.kind === KIND_TREE || (part.kind === KIND_GREEN ? green : ripe);
      part.mesh.setMatrixAt(e.slot, show ? m4.multiplyMatrices(base, part.local) : ZERO);
    }
    treesDirty = true;
  }

  const entities = new Map(); // plotId → entity (planted)
  const live = []; // entities as an array (per-frame loop without iterators)
  const dying = [];
  const treeRot = (x, z) => (x * 7 + z * 13) % 6.28;
  const setPos = (e, x, z) => { e.x = x; e.z = z; e.rot = treeRot(x, z); e.pos.set(x, .2, z); e.moved = true; };

  function dropEntity(e) {
    freeSlot(e.slot);
    e.slot = -1;
  }

  function sync(state) {
    const r = regionOf(state);
    const plots = r?.plots || {};
    const list = ownedPlots(state);
    // Beds + pickers for every field of the region.
    ensureBeds(list.length);
    plotList.length = 0;
    bedIndex = new Map();
    for (let i = 0; i < list.length; i++) {
      const plot = list[i];
      plotList.push(plot);
      bedIndex.set(plot.id, i);
      beds.setMatrixAt(i, hidden.has(plot.id) ? ZERO : m4.makeTranslation(plot.x, .1, plot.z));
      beds.setColorAt(i, plots[plot.id] ? SOIL_WET : SOIL_DRY);
      let pick = pickers.get(plot.id);
      if (!pick) {
        pick = new THREE.Mesh(pickGeo, pickMat);
        pick.visible = false;
        pick.userData.target = { kind: 'plot', id: plot.id };
        group.add(pick);
        pickers.set(plot.id, pick);
      }
      if (pick.position.x !== plot.x || pick.position.z !== plot.z || !pick.userData.placed) {
        pick.position.set(plot.x, 0, plot.z);
        pick.userData.placed = true;
        pick.updateMatrixWorld(true);
      }
    }
    beds.count = list.length;
    beds.instanceMatrix.needsUpdate = true;
    if (beds.instanceColor) beds.instanceColor.needsUpdate = true;
    beds.computeBoundingSphere();
    for (const [id, pick] of pickers) if (!bedIndex.has(id)) { pick.removeFromParent(); pickers.delete(id); }

    // Trees: drop the ones whose field / crop is gone or replanted, move the ones whose field moved.
    for (const [id, e] of entities) {
      const p = plots[id];
      const bi = bedIndex.get(id);
      if (!p || bi == null || p.plantedAt !== e.plantedAt || p.crop !== e.crop) { dropEntity(e); entities.delete(id); continue; }
      const plot = plotList[bi];
      e.plot = plot;
      if (plot.x !== e.x || plot.z !== e.z) setPos(e, plot.x, plot.z);
    }
    for (const id in plots) {
      const p = plots[id];
      const bi = bedIndex.get(id);
      if (bi == null) continue;
      const plot = plotList[bi];
      let e = entities.get(id);
      if (!e) {
        e = { id, plot, crop: p.crop, plantedAt: p.plantedAt, total: 1, scale: 0, born: -1, ready: false, nextSparkle: Math.random() * 2,
          slot: allocSlot(), x: 0, z: 0, rot: 0, pos: new THREE.Vector3(), wx: -1, wy: -1, wg: null, wr: null, moved: true, green: false, ripe: false };
        setPos(e, plot.x, plot.z);
        writeTree(e, .001, .001, false, false);
        entities.set(id, e);
      }
      e.total = plotGrowMs(state, p, id);
    }
    live.length = 0;
    for (const e of entities.values()) live.push(e);
    if (highlight) paintBeds(lastTime);
  }

  /** 'empty' | 'planted' | 'growing' | 'ready' (same thresholds as derive.plotState). */
  function stage(id, now) {
    const e = entities.get(id);
    if (!e) return 'empty';
    const ratio = (now - e.plantedAt) / e.total;
    return ratio >= 1 ? 'ready' : ratio < .08 ? 'planted' : 'growing';
  }
  const remainingMs = (id, now) => { const e = entities.get(id); return e ? Math.max(0, e.total - (now - e.plantedAt)) : 0; };

  function onPlanted(id, time) {
    const e = entities.get(id);
    if (!e) return;
    e.born = time;
    vfx.burst('soil', e.pos);
  }
  // Harvest: the tree pops (grows a bit, then shrinks away) while cherries burst out.
  function onHarvested(id, time) {
    const e = entities.get(id);
    if (!e) return;
    entities.delete(id);
    const li = live.indexOf(e);
    if (li >= 0) live.splice(li, 1);
    e.dieAt = time;
    e.dieScale = e.wx > 0 ? e.wx : e.scale;
    dying.push(e);
    vfx.burst('cherry', e.pos);
    vfx.burst('leaf', e.pos);
  }

  // ---------- planting mode: empty beds pulse softly (instance colours only) ----------
  let highlight = false, lastTime = 0;
  function paintBeds(time) {
    const k = .5 + .5 * Math.sin(time * 3.2);
    col.lerpColors(SOIL_DRY, SOIL_GLOW, .2 + .5 * k);
    for (let i = 0; i < plotList.length; i++) beds.setColorAt(i, entities.has(plotList[i].id) ? SOIL_WET : col);
    if (beds.instanceColor) beds.instanceColor.needsUpdate = true;
  }
  function setHighlight(on) {
    on = !!on;
    if (on === highlight) return;
    highlight = on;
    if (on) { paintBeds(lastTime); return; }
    for (let i = 0; i < plotList.length; i++) beds.setColorAt(i, entities.has(plotList[i].id) ? SOIL_WET : SOIL_DRY);
    if (beds.instanceColor) beds.instanceColor.needsUpdate = true;
  }

  // Written scales are quantized (1/200) so writeTree's equality check really skips settled trees.
  const q = v => Math.round(v * 200) / 200;
  function update(dt, time, now) {
    lastTime = time;
    const vis = group.visible; // café view: keep the clocks running but skip matrix writes, uploads and sparkles
    for (let i = 0; i < live.length; i++) {
      const e = live[i];
      const ratio = Math.min(1, (now - e.plantedAt) / e.total);
      const ready = ratio >= 1;
      const goal = ratio < .08 ? SCALE_MIN : SCALE_MIN + (SCALE_MAX - SCALE_MIN) * ratio;
      if (e.born >= 0 && time - e.born < .45) e.scale = SCALE_MIN * easeOutBack((time - e.born) / .45);
      else e.scale = e.scale < .01 ? goal : damp(e.scale, goal, 4, dt);
      const bob = ready ? 1 + .04 * Math.sin(time * 3 + e.x) : 1;
      e.green = !ready && ratio > .45;
      e.ripe = ready;
      if (vis) writeTree(e, q(e.scale), q(e.scale * bob), e.green, e.ripe);
      if (ready !== e.ready) {
        e.ready = ready;
        if (ready && vis) vfx.burst('sparkle', e.pos, { count: 6 });
      }
      if (vis && ready && (e.nextSparkle -= dt) <= 0) {
        e.nextSparkle = 1.6 + Math.random() * 1.6;
        vfx.burst('sparkle', fx.set(e.x, 1.1, e.z), { count: 2 });
      }
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const e = dying[i];
      const k = (time - e.dieAt) / POP_TIME;
      if (k >= 1) { dropEntity(e); dying.splice(i, 1); continue; }
      const s = Math.max(.001, k < .35 ? e.dieScale * (1 + .5 * k / .35) : e.dieScale * 1.175 * (1 - (k - .35) / .65));
      if (vis) writeTree(e, s, s, e.green, e.ripe);
    }
    if (treesDirty) { treesDirty = false; for (const part of parts) part.mesh.instanceMatrix.needsUpdate = true; }
    if (highlight && group.visible) paintBeds(time);
  }

  /** Hide / show one field (bed + tree) while it is being moved; its picker is left alone (placement owns taps). */
  function setHidden(id, on) {
    on = !!on;
    if (on === hidden.has(id)) return;
    if (on) hidden.add(id); else hidden.delete(id);
    const i = bedIndex.get(id);
    if (i != null) {
      const p = plotList[i];
      beds.setMatrixAt(i, on ? ZERO : m4.makeTranslation(p.x, .1, p.z));
      beds.instanceMatrix.needsUpdate = true;
      beds.computeBoundingSphere(); // a moved bed must not be culled by a sphere computed while it was hidden
    }
    const e = entities.get(id) || dying.find(d => d.id === id);
    if (e && e.slot >= 0) { e.moved = true; writeTree(e, e.wx, e.wy, e.wg, e.wr); }
  }

  function first(want, now) {
    for (const plot of plotList) {
      const st = stage(plot.id, now);
      if (want === 'empty' ? st === 'empty' : want === 'planted' ? st !== 'empty' : want === 'ready' ? st === 'ready' : true) return plot;
    }
    return null;
  }

  function clear() {
    hidden.clear();
    for (const e of entities.values()) dropEntity(e);
    entities.clear();
    for (const e of dying) dropEntity(e);
    dying.length = 0;
    live.length = 0;
    freeSlots.length = 0;
    slotHigh = 0;
    for (const part of parts) part.mesh.count = 0;
    treesDirty = true;
  }

  return {
    group, sync, update, stage, remainingMs, onPlanted, onHarvested, first, clear, setHighlight, setHidden,
    pickers: () => pickers.values(),
    isOwned: id => bedIndex.has(id),
    /** [x0, z0, x1, z1] of a field's 2.4 m soil bed, null when the field is not in the current region. */
    bedRect(id) {
      const i = bedIndex.get(id);
      if (i == null) return null;
      const p = plotList[i];
      return [p.x - BED_HALF, p.z - BED_HALF, p.x + BED_HALF, p.z + BED_HALF];
    },
    dispose() {
      clear();
      for (const part of parts) { part.mesh.removeFromParent(); part.mesh.dispose(); } // template geometry / materials are shared (GLB cache)
      if (fallback) { fallback.geometry.dispose(); fallback.material.dispose(); }
      beds.dispose();
      bedGeo.dispose(); bedMat.dispose(); pickGeo.dispose(); pickMat.dispose();
      group.removeFromParent();
    },
  };
}
