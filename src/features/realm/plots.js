// Farm plots (Farm World 2.0: fields are placeables saved in region.fields, read through D.ownedPlots). Coffee is a
// perennial tree planted in rows (docs/design/coffee-varieties.md §2b): each field is one planting row (luống) of 2–3 trees,
// fields in the same lot and row are joined by a mulched row strip, upland / highland rows stand on raised terraces
// (tầng bậc thang: an earth bench with a stone retaining wall, each row higher than the one south of it) and
// upland / highland rows get a shade tree (cây che bóng) at their end. A grown tree stays after a harvest: it flowers,
// sets green cherries and ripens again each season. Trees are instanced too: one InstancedMesh per mesh part of the
// tree / green-fruit / ripe-fruit templates (part matrices baked once), so every tree on the farm costs the same few
// draw calls. Each tree of a row owns one instance slot in every part mesh; hidden fruit = zero-scale instance. Growth is
// computed per frame from cached plantedAt/growMs (no allocation, no derive calls) and a tree's matrices are only
// rewritten when its scale / bob / fruit / position changed.
import * as THREE from 'three';
import { PLOT_SIZE, PARCELS, climateOfLot } from '../../core/config/layout.js';
import { CROPS } from '../../core/config/economy.js';
import { region as regionOf, plotGrowMs, ownedPlots, climateFit } from '../../core/derive.js';
import { damp, easeOutBack } from './util.js';

const SCALE_MIN = .22, SCALE_MAX = .65;
const FLOWER = new THREE.Color(2.2, 2.2, 2.1); // ripe-cherry part tinted white = the flowering stage (colour × GLB red)
const BANK = new THREE.Color(0x8a5a3a), MULCH = new THREE.Color(0x6e5233), TERRACE = new THREE.Color(0x9a8f7c), SHADE_LEAF = new THREE.Color(0x3f7a34), SHADE_TRUNK = new THREE.Color(0x6b4a2e);
const SOIL_DRY = new THREE.Color(0x9b6a43), SOIL_WET = new THREE.Color(0x6e4529), SOIL_GLOW = new THREE.Color(0xe2b47a);
// Soil per growing zone (docs/design/coffee-varieties.md): lowland alluvial brown, upland red basalt (đất đỏ bazan),
// highland dark humus, wetland grey-brown mud. Planted beds are the same colour, darker (watered).
const ZONE_SOIL = { lowland: SOIL_DRY, upland: new THREE.Color(0xa8553a), highland: new THREE.Color(0x6f5038), wetland: new THREE.Color(0x76695a) };
const zoneSoil = (zone, wet) => (wet ? ZONE_SOIL[zone].clone().multiplyScalar(.7) : ZONE_SOIL[zone]) || SOIL_DRY;
const FIT_GLOW = { good: new THREE.Color(0x8fd16a), ok: SOIL_GLOW, bad: new THREE.Color(0xf0c34a) }; // seed in hand: fits / neutral / penalised
// Variety looks (instanced, so: scale + tint per tree). w = width, h = height; leaf / ripe tints multiply the GLB colours.
// Arabica: low, small glossy dark leaves. Robusta: medium, the GLB as is. Liberica: tall tree, big leathery leaves, dark red fruit.
const LOOK = {
  robusta: { w: 1, h: 1, leaf: new THREE.Color(1, 1, 1), ripe: new THREE.Color(1, 1, 1) },
  arabica: { w: .82, h: .72, leaf: new THREE.Color(.78, .92, .74), ripe: new THREE.Color(1, .85, .85) },
  liberica: { w: 1.3, h: 1.85, leaf: new THREE.Color(.82, .9, .68), ripe: new THREE.Color(.7, .45, .45) },
};
const lookOf = crop => LOOK[crop] || LOOK.robusta;
// A field is a block of the row (luống): two staggered layers of n trees along x (`gap` m apart, the back layer offset
// by half a gap, `dz` m in front / behind the field's centre), each tree at `k` × the single-tree scale, big enough
// that the canopies overlap layer over layer like a real plantation. Arabica is planted densest, Liberica sparsest.
const ROW = { robusta: { n: 4, gap: .82, dz: .55, k: 1.9 }, arabica: { n: 5, gap: .66, dz: .5, k: 1.75 }, liberica: { n: 3, gap: 1.1, dz: .6, k: 1.65 } };
const rowOf = crop => ROW[crop] || ROW.robusta;
// Terraces (tầng ruộng bậc thang): each row of a lot stands on an earth bench, the rows stepping up to the north
// (rank 0 = the southmost row). Height per step by zone; the walkway in front of a bench (where the farmer stands to
// pick, z + 1.25) stays at ground level, so nobody walks into a bench.
const TERRACE_STEP = { upland: .22, highland: .45 }, BENCH_DEPTH = 2.5; // 2 field rows 3 m apart → a ~0.5 m path between benches
const WHITE = new THREE.Color(1, 1, 1);
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

export function createPlots({ scene, templates, vfx, getActiveCrop = () => null }) {
  const group = new THREE.Group();
  group.name = 'realm-plots';
  scene.add(group);
  const m4 = new THREE.Matrix4(), base = new THREE.Matrix4();
  const pos = new THREE.Vector3(), scl = new THREE.Vector3(), quat = new THREE.Quaternion(), col = new THREE.Color(), fx = new THREE.Vector3();

  // ---------- soil beds (capacity grows 2× on demand) ----------
  // the planting row (luống): a low mounded strip of soil along x; taps still use the 2.4 m picker / bedRect
  const bedGeo = new THREE.BoxGeometry(3.34, .06, 2.3); // full column width: neighbouring fields join into one row
  { const ps = bedGeo.attributes.position; for (let i = 0; i < ps.count; i++) if (ps.getY(i) > 0) ps.setZ(i, ps.getZ(i) * .75); bedGeo.computeVertexNormals(); } // sloped sides
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

  // ---------- rows: mulch strips, terrace edges, shade trees (rebuilt on sync; a few instances per lot) ----------
  const ROW_CAP = 128;
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const rowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const strips = new THREE.InstancedMesh(unitBox, rowMat, ROW_CAP), edges = new THREE.InstancedMesh(unitBox, rowMat, ROW_CAP), benches = new THREE.InstancedMesh(unitBox, rowMat, ROW_CAP);
  const trunkGeo = new THREE.CylinderGeometry(.12, .16, 2.4, 6).translate(0, 1.2, 0), crownGeo = new THREE.SphereGeometry(1.25, 10, 8).scale(1, .55, 1).translate(0, 2.7, 0);
  const shadeTrunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: SHADE_TRUNK, roughness: 1 }), ROW_CAP);
  const shadeCrowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: SHADE_LEAF, roughness: .9 }), ROW_CAP);
  for (const m of [strips, edges, benches, shadeTrunks, shadeCrowns]) { m.count = 0; m.raycast = () => {}; m.receiveShadow = true; group.add(m); }
  shadeTrunks.castShadow = shadeCrowns.castShadow = edges.castShadow = benches.castShadow = true;
  strips.setColorAt(0, MULCH); edges.setColorAt(0, TERRACE); benches.setColorAt(0, BANK);
  const inLot = (lot, x, z, pad) => { const r = PARCELS[lot]?.rect; return !!r && x >= r[0] + pad && x <= r[2] - pad && z >= r[1] + pad && z <= r[3] - pad; };
  const rowKey = p => `${p.parcel}|${Math.round(p.z * 2) / 2}`;
  // Terrace height of every field (by its row's rank in its lot); fields not in a lot stay on the ground.
  const terraceOf = new Map();
  function computeTerraces(list) {
    terraceOf.clear();
    const lotRows = new Map(); // lot → sorted row zs
    for (const p of list) if (p.parcel) { const zs = lotRows.get(p.parcel) || lotRows.set(p.parcel, new Set()).get(p.parcel); zs.add(Math.round(p.z * 2) / 2); }
    for (const p of list) {
      const step = p.parcel ? TERRACE_STEP[p.zone || climateOfLot(p.parcel)] : 0;
      if (!step) continue;
      const zs = [...lotRows.get(p.parcel)].sort((a, b) => b - a); // south (larger z) first
      terraceOf.set(p.id, (zs.indexOf(Math.round(p.z * 2) / 2) + 1) * step);
    }
  }
  const hOf = id => terraceOf.get(id) || 0;
  function layRows(list) {
    const rows = new Map(); // lot|z → fields of one row
    for (const p of list) { if (!p.parcel || hidden.has(p.id)) continue; const k = rowKey(p); (rows.get(k) || rows.set(k, []).get(k)).push(p); }
    let ns = 0, ne = 0, nb = 0, nt = 0;
    for (const fs of rows.values()) {
      const z = fs[0].z, H = hOf(fs[0].id);
      const x0 = Math.min(...fs.map(f => f.x)) - 1.67, x1 = Math.max(...fs.map(f => f.x)) + 1.67, cx = (x0 + x1) / 2, len = x1 - x0;
      if (fs.length > 1 && ns < ROW_CAP) { strips.setMatrixAt(ns, m4.compose(pos.set(cx, H + .02, z), quat.identity(), scl.set(len, .03, 2.3))); strips.setColorAt(ns++, MULCH); }
      if (H > 0 && nb < ROW_CAP) {
        // the bench (earth) and its retaining wall (stone) on the downhill, south face
        benches.setMatrixAt(nb, m4.compose(pos.set(cx, H / 2, z), quat.identity(), scl.set(len + .2, H, BENCH_DEPTH))); benches.setColorAt(nb++, BANK);
        if (ne < ROW_CAP) { edges.setMatrixAt(ne, m4.compose(pos.set(cx, (H + .06) / 2, z + BENCH_DEPTH / 2 + .02), quat.identity(), scl.set(len + .3, H + .06, .16))); edges.setColorAt(ne++, TERRACE); }
      }
    }
    // upland / highland (Arabica country): shade trees (cây che bóng) standing between a lot's rows, tall above the coffee
    const lots = new Map();
    for (const fs of rows.values()) (lots.get(fs[0].parcel) || lots.set(fs[0].parcel, []).get(fs[0].parcel)).push(...fs);
    for (const [lot, fs] of lots) {
      const zone = fs[0].zone || climateOfLot(lot);
      if ((zone !== 'upland' && zone !== 'highland') || fs.length < 3) continue;
      const zs = [...new Set(fs.map(f => Math.round(f.z * 2) / 2))].sort((a, b) => a - b), cz = zs.length > 1 ? (zs[0] + zs[1]) / 2 : zs[0] - 1.4;
      const xs = fs.map(f => f.x), cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      for (const sx of [cx - 2.6, cx + 2.6]) {
        if (nt >= ROW_CAP || !inLot(lot, sx, cz, .2)) continue;
        const k = .9 + ((Math.abs(Math.round(sx * 7 + cz * 3)) % 5) / 20);
        m4.compose(pos.set(sx, 0, cz), quat.identity(), scl.set(k, k * 1.15, k));
        shadeTrunks.setMatrixAt(nt, m4); shadeCrowns.setMatrixAt(nt++, m4);
      }
    }
    strips.count = ns; edges.count = ne; benches.count = nb; shadeTrunks.count = shadeCrowns.count = nt;
    for (const m of [strips, edges, benches, shadeTrunks, shadeCrowns]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
  }

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
      mesh.setColorAt(0, WHITE); // creates instanceColor (variety tints)
      for (let i = 1; i < cap; i++) mesh.setColorAt(i, WHITE);
      if (part.mesh) {
        arr.set(part.mesh.instanceMatrix.array.subarray(0, treeCap * 16));
        if (part.mesh.instanceColor) mesh.instanceColor.array.set(part.mesh.instanceColor.array.subarray(0, treeCap * 3));
        part.mesh.removeFromParent(); part.mesh.dispose();
      }
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
  function tintSlot(i, crop) {
    const L = lookOf(crop);
    for (const part of parts) { part.mesh.setColorAt(i, part.kind === KIND_TREE ? L.leaf : part.kind === KIND_RIPE ? L.ripe : WHITE); part.mesh.instanceColor.needsUpdate = true; }
  }
  function tintRipe(i, c) {
    for (const part of parts) if (part.kind === KIND_RIPE) { part.mesh.setColorAt(i, c); part.mesh.instanceColor.needsUpdate = true; }
  }
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
    if (hidden.has(e.id)) { for (const i of e.slots) for (const part of parts) part.mesh.setMatrixAt(i, ZERO); treesDirty = true; return; }
    const L = lookOf(e.crop), R = rowOf(e.crop);
    e.slots.forEach((slot, i) => {
      const layer = i < R.n ? 0 : 1, col = i % R.n; // front layer (south), then the back layer, staggered
      const dx = (col - (R.n - 1) / 2) * R.gap + (layer ? R.gap / 2 - R.gap / 4 : -R.gap / 4), dz = layer ? -R.dz : R.dz;
      const v = 1 + ((i * 37 + Math.round(e.x * 3)) % 7 - 3) * .03; // a little size variety, so the canopy is uneven
      base.compose(pos.set(e.x + dx, .2 + e.h, e.z + dz), quat.setFromAxisAngle(UP, e.rot + i * 1.9), scl.set(sx * L.w * R.k * v, sy * L.h * R.k * v, sx * L.w * R.k * v));
      for (const part of parts) {
        const show = part.kind === KIND_TREE || (part.kind === KIND_GREEN ? green : ripe);
        part.mesh.setMatrixAt(slot, show ? m4.multiplyMatrices(base, part.local) : ZERO);
      }
    });
    treesDirty = true;
  }

  const entities = new Map(); // plotId → entity (planted)
  const live = []; // entities as an array (per-frame loop without iterators)
  const dying = [];
  const treeRot = (x, z) => (x * 7 + z * 13) % 6.28;
  const setPos = (e, x, z) => { e.x = x; e.z = z; e.rot = treeRot(x, z); e.pos.set(x, .2 + (e.h || 0), z); e.moved = true; };

  function dropEntity(e) {
    for (const i of e.slots) freeSlot(i);
    e.slots = [];
  }

  function sync(state) {
    const r = regionOf(state);
    const plots = r?.plots || {};
    const list = ownedPlots(state);
    computeTerraces(list); // before the beds: they stand on their row's terrace
    // Beds + pickers for every field of the region.
    ensureBeds(list.length);
    plotList.length = 0;
    bedIndex = new Map();
    for (let i = 0; i < list.length; i++) {
      const plot = list[i];
      plotList.push(plot);
      bedIndex.set(plot.id, i);
      beds.setMatrixAt(i, hidden.has(plot.id) ? ZERO : m4.makeTranslation(plot.x, .03 + hOf(plot.id), plot.z));
      plot.zone ||= climateOfLot(plot.parcel);
      beds.setColorAt(i, zoneSoil(plot.zone, !!plots[plot.id]));
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
      // a tree lives until it is uprooted (no plot) or replaced (another crop / planting); a harvest keeps it
      if (!p || bi == null || (p.born ?? p.plantedAt) !== e.born || p.crop !== e.crop) {
        entities.delete(id);
        if (!p && bi != null && e.slots.length) { e.dieAt = lastTime; e.dieScale = e.wx > 0 ? e.wx : e.scale; dying.push(e); vfx.burst('leaf', e.pos); } // uprooted: it pops away
        else dropEntity(e);
        continue;
      }
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
        e = { id, plot, crop: p.crop, born: p.born ?? p.plantedAt, plantedAt: p.plantedAt, age: 0, total: 1, scale: 0, popAt: -1, flower: false, ready: false, nextSparkle: Math.random() * 2,
          slots: Array.from({ length: rowOf(p.crop).n * 2 }, () => allocSlot()), x: 0, z: 0, rot: 0, pos: new THREE.Vector3(), wx: -1, wy: -1, wg: null, wr: null, moved: true, green: false, ripe: false };
        setPos(e, plot.x, plot.z);
        for (const i of e.slots) tintSlot(i, p.crop);
        writeTree(e, .001, .001, false, false);
        entities.set(id, e);
      }
      e.total = plotGrowMs(state, p, id);
      const h = hOf(id);
      if (h !== e.h) { e.h = h; setPos(e, e.x, e.z); } // a field moved onto / off a terrace
      e.plantedAt = p.plantedAt; // the season's start (moves on each harvest)
      e.age = p.n | 0;
      e.wave = !!p.wave;
    }
    live.length = 0;
    for (const e of entities.values()) live.push(e);
    layRows(list);
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
    e.popAt = time;
    vfx.burst('soil', e.pos);
  }
  // Harvest: the tree stays (perennial); cherries burst out and the tree gives a little shake.
  function onHarvested(id, time) {
    const e = entities.get(id);
    if (!e) return;
    e.shakeAt = time;
    vfx.burst('cherry', e.pos);
    vfx.burst('leaf', e.pos, { count: 3 });
  }

  // ---------- planting mode: empty beds pulse softly (instance colours only) ----------
  let highlight = false, lastTime = 0;
  function paintBeds(time) {
    const k = .5 + .5 * Math.sin(time * 3.2), crop = getActiveCrop();
    for (let i = 0; i < plotList.length; i++) {
      const pl = plotList[i];
      if (entities.has(pl.id)) { beds.setColorAt(i, zoneSoil(pl.zone, true)); continue; }
      // Holding a seed: the bed glows green where the variety fits its zone, amber where it is penalised.
      col.lerpColors(zoneSoil(pl.zone, false), FIT_GLOW[crop && CROPS[crop] ? climateFit(crop, pl.zone) : 'ok'], .2 + .5 * k);
      beds.setColorAt(i, col);
    }
    if (beds.instanceColor) beds.instanceColor.needsUpdate = true;
  }
  function setHighlight(on) {
    on = !!on;
    if (on === highlight) return;
    highlight = on;
    if (on) { paintBeds(lastTime); return; }
    for (let i = 0; i < plotList.length; i++) beds.setColorAt(i, zoneSoil(plotList[i].zone, entities.has(plotList[i].id)));
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
      const ready = ratio >= 1, grown = e.age > 0 || e.wave;
      // a sapling grows to full size over its first crop; a grown tree keeps its size, only its fruit changes
      const goal = grown ? SCALE_MAX : ratio < .08 ? SCALE_MIN : SCALE_MIN + (SCALE_MAX - SCALE_MIN) * ratio;
      if (e.popAt >= 0 && time - e.popAt < .45) e.scale = SCALE_MIN * easeOutBack((time - e.popAt) / .45);
      else e.scale = e.scale < .01 ? goal : damp(e.scale, goal, 4, dt);
      const shake = e.shakeAt >= 0 && time - e.shakeAt < .4 ? 1 + .06 * Math.sin((time - e.shakeAt) * 40) * (1 - (time - e.shakeAt) / .4) : 1;
      const bob = (ready ? 1 + .04 * Math.sin(time * 3 + e.x) : 1) * shake;
      // season: rest → white flowers → green cherries → ripe (a sapling flowers late in its first crop)
      const fl0 = grown ? .12 : .5, gr0 = grown ? .42 : .72;
      const flower = !ready && !e.wave && ratio > fl0 && ratio <= gr0;
      if (flower !== e.flower) { e.flower = flower; for (const i of e.slots) tintRipe(i, flower ? FLOWER : lookOf(e.crop).ripe); }
      e.green = !ready && ratio > gr0;
      e.ripe = ready || flower;
      if (vis) writeTree(e, q(e.scale), q(e.scale * bob), e.green, e.ripe);
      if (ready !== e.ready) {
        e.ready = ready;
        if (ready && vis) vfx.burst('sparkle', e.pos, { count: 6 });
      }
      if (vis && ready && (e.nextSparkle -= dt) <= 0) {
        e.nextSparkle = 1.6 + Math.random() * 1.6;
        // Arabica past its ripe window drops cherries (beans are being lost): a falling cherry instead of a sparkle.
        const drop = CROPS[e.crop]?.drop, falling = drop && now - e.plantedAt - e.total > drop.after * 1000;
        vfx.burst(falling ? 'cherry' : 'sparkle', fx.set(e.x, 1.1, e.z), { count: falling ? 1 : 2 });
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
      beds.setMatrixAt(i, on ? ZERO : m4.makeTranslation(p.x, .03 + hOf(p.id), p.z));
      beds.instanceMatrix.needsUpdate = true;
      beds.computeBoundingSphere(); // a moved bed must not be culled by a sphere computed while it was hidden
    }
    const e = entities.get(id) || dying.find(d => d.id === id);
    if (e && e.slots.length) { e.moved = true; writeTree(e, e.wx, e.wy, e.wg, e.wr); }
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
    strips.count = edges.count = benches.count = shadeTrunks.count = shadeCrowns.count = 0;
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
      for (const m of [strips, edges, benches, shadeTrunks, shadeCrowns]) { m.removeFromParent(); m.dispose(); }
      unitBox.dispose(); rowMat.dispose(); trunkGeo.dispose(); crownGeo.dispose(); shadeTrunks.material.dispose(); shadeCrowns.material.dispose();
      group.removeFromParent();
    },
  };
}
