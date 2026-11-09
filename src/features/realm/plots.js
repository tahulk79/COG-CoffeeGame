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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLOT_SIZE, PARCELS, tierZoneAt, climateOfLot, farmGroundY } from '../../core/config/layout.js';
import { CROPS, gardenStyleOf } from '../../core/config/economy.js';
import { region as regionOf, plotGrowMs, ownedPlots, climateFit } from '../../core/derive.js';
import { damp, easeOutBack } from './util.js';
import { loadPlant } from '../../shared/three/gedeo-vegetation.js';
import { farmMaterial } from '../../shared/three/farm-textures.js';
import { getQuality, onQuality } from '../../shared/vfx/index.js';

// Gedeo models for the garden layers (scripts/blender/gedeo_heroes.py): instanced copies of a real plant's LOD, placed
// with the same matrices as the procedural stand-ins, which hide once the model is loaded (they stay as the fallback).
function gedeoInst(group, key, lod, cap, fallback = []) {
  const meshes = [], store = new Float32Array(cap * 16), tmp = new THREE.Matrix4();
  let count = 0, ready = false;
  const flush = () => {
    for (const im of meshes) {
      for (let i = 0; i < count; i++) im.setMatrixAt(i, tmp.fromArray(store, i * 16).multiply(im.userData.local));
      im.count = count; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    }
  };
  loadPlant(key).then(t => {
    const tpl = t[lod]; tpl.updateMatrixWorld(true);
    tpl.traverse(o => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, cap);
      im.userData.local = o.matrixWorld.clone(); im.castShadow = im.receiveShadow = true; im.raycast = () => {}; im.count = 0;
      meshes.push(im); group.add(im);
    });
    ready = true; for (const m of fallback) m.visible = false; flush();
  }, e => console.warn(`Gedeo ${key} not loaded, keeping the procedural stand-in.`, e));
  return { set(i, m) { if (i < cap) m.toArray(store, i * 16); }, commit(n) { count = Math.min(n, cap); if (ready) flush(); } };
}

const SCALE_MIN = .22, SCALE_MAX = .65;
const FLOWER = new THREE.Color(2.2, 2.2, 2.1); // ripe-cherry part tinted white = the flowering stage (colour × GLB red)
const BANK = new THREE.Color(0x8a5a3a), MULCH = new THREE.Color(0x6e5233), TERRACE = new THREE.Color(0x9a8f7c), SHADE_LEAF = new THREE.Color(0x3f7a34), SHADE_TRUNK = new THREE.Color(0x6b4a2e);
const SOIL_DRY = new THREE.Color(0x9b6a43), SOIL_WET = new THREE.Color(0x6e4529), SOIL_GLOW = new THREE.Color(0xe2b47a);
// Soil per growing zone (docs/design/coffee-varieties.md): lowland alluvial brown, upland red basalt (đất đỏ bazan),
// highland dark humus, wetland grey-brown mud. Planted beds are the same colour, darker (watered).
const ZONE_SOIL = { lowland: SOIL_DRY, upland: new THREE.Color(0xa8553a), slope: new THREE.Color(0x8a5236), highland: new THREE.Color(0x6f5038) };
const zoneSoil = (zone, wet) => (wet ? ZONE_SOIL[zone].clone().multiplyScalar(.7) : ZONE_SOIL[zone]) || SOIL_DRY;
const FIT_GLOW = { good: new THREE.Color(0x8fd16a), ok: SOIL_GLOW, bad: new THREE.Color(0xf0c34a) }; // seed in hand: fits / neutral / penalised
// Variety looks (instanced, so: scale + tint per tree). w = width, h = height; leaf / ripe tints multiply the GLB colours.
// Arabica: low, small glossy dark leaves. Robusta: medium, the GLB as is. Liberica: tall tree, big leathery leaves, dark red fruit.
const LOOK = {
  // each variety has its own Blender model at true relative size now, so w / h only fine-tune (same scale for all)
  robusta: { w: .82, h: .72, leaf: new THREE.Color(1, 1, 1), ripe: new THREE.Color(1, 1, 1) },
  arabica: { w: .82, h: .72, leaf: new THREE.Color(.78, .92, .74), ripe: new THREE.Color(1, .85, .85) },
  liberica: { w: .86, h: .8, leaf: new THREE.Color(.9, .95, .85), ripe: new THREE.Color(.8, .55, .5) },
};
const lookOf = crop => LOOK[crop] || LOOK.robusta;
// A field is a block of the row (luống): two staggered layers of n trees along x (`gap` m apart, the back layer offset
// by half a gap, `dz` m in front / behind the field's centre), each tree at `k` × the single-tree scale, big enough
// that the canopies overlap layer over layer like a real plantation. Arabica is planted densest, Liberica sparsest.
// Farm big-update: k ×1.25 so the tiers read from the lower 38° camera (reference: tall, overlapping canopies).
// One tree per plant now (free planting, founder 2026-11-08): no rows, trees of different sizes mix side by side.
const ROW = { robusta: { n: 1, gap: 0, dz: 0, k: 2.0 }, arabica: { n: 1, gap: 0, dz: 0, k: 1.8 }, liberica: { n: 1, gap: 0, dz: 0, k: 1.8 } };
const rowOf = crop => ROW[crop] || ROW.robusta;
/** Scale a plant is drawn at in the farm (stage 'seedling' | 'young' | 'tree'): the placement ghost uses it to match. */
export function plantScale(crop, stage) {
  const L = lookOf(crop), k = stage === 'seedling' ? 2.6 * .6 : stage === 'young' ? 1.4 * .8 : rowOf(crop).k;
  const w = stage === 'tree' ? L.w * k : k * L.w, hh = stage === 'tree' ? L.h * k : k * L.h;
  return { w, h: hh };
}
// Terraces (tầng ruộng bậc thang): each row of a lot stands on an earth bench, the rows stepping up to the north
// (rank 0 = the southmost row). Height per step by zone; the walkway in front of a bench (where the farmer stands to
// pick, z + 1.25) stays at ground level, so nobody walks into a bench.
// Row terraces are gone (founder 2026-11-08: plant anywhere, no rows): height comes from the land itself, the 4 mountain
// tiers (layout farmGroundY). TERRACE_STEP stays empty so no per-row benches are raised.
const TERRACE_STEP = {}, BENCH_DEPTH = 2.5;
const WHITE = new THREE.Color(1, 1, 1);
// Garden layers by country (docs/design/farm-ui-bigupdate.md §6; Ethiopian coffee agroforestry: tall native shade trees
// over fruit trees over coffee + enset): forest = full garden-forest, shade = banana at row ends + upland shade trees
// (Vietnam, India, Colombia…), sun = open sun plantation (Brazil). Gameplay numbers: config GARDEN.
const gardenStyle = gardenStyleOf; // config/economy.js GARDEN (the same style drives grow time / yield / quality)
const ENSET = new THREE.Color(0x6aa83f), BANANA = new THREE.Color(0x8cc04e), CANOPY = new THREE.Color(0x4e7f34), FRUIT = new THREE.Color(0x2f6b2c);
const POP_TIME = .35;
const BED_CAP = 256, TREE_CAP = 64;
const BED_HALF = .5; // one tree = a 1 m square (plants may stand 1 m apart)
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const KIND_TREE = 0, KIND_GREEN = 1, KIND_RIPE = 2, KIND_RING = 3, KIND_SEED = 4, KIND_YOUNG = 5;
// First crop of a new planting (coffee-varieties §2b): nursery seedling → young plant → the mature tree. Real-metre models
// (gedeo_heroes.py export_game_stages); STAGE_AT = growth ratio where the next form takes over, STAGE_SIZE = scale at that form's end.
const STAGE_AT = [.3, .62], STAGE_SIZE = { [KIND_SEED]: 2.6, [KIND_YOUNG]: 1.4 }; // RING = the mulched earth ring round each trunk (vòng đất gốc)

// Mesh parts of a template with their matrix relative to the template's parent (= what a clone added to a group at
// the tree position would render: the template's own transform included).
// Fruit reads at a glance (founder 2026-11-08): every berry (a connected island of triangles) is scaled about ITS OWN
// centre, so the berries grow in place instead of drifting off the tree.
export const FRUIT_K = { [KIND_RIPE]: 2.6, [KIND_GREEN]: 1.7 };
const bigCache = new WeakMap();
export function bigBerries(geo, k) {
  if (bigCache.has(geo)) return bigCache.get(geo);
  const g = geo.clone(), pos = g.attributes.position, n = pos.count, idx = g.index;
  const par = Array.from({ length: n }, (_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  const key = i => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  const seen = new Map(); // vertices sharing a position are one point (unindexed meshes)
  for (let i = 0; i < n; i++) { const kk = key(i); if (seen.has(kk)) par[find(i)] = find(seen.get(kk)); else seen.set(kk, i); }
  const tri = idx ? idx.count : n;
  for (let t = 0; t + 2 < tri; t += 3) { const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2; par[find(b)] = find(a); par[find(c)] = find(a); }
  const sum = new Map();
  for (let i = 0; i < n; i++) { const r = find(i), e = sum.get(r) || { x: 0, y: 0, z: 0, c: 0 }; e.x += pos.getX(i); e.y += pos.getY(i); e.z += pos.getZ(i); e.c++; sum.set(r, e); }
  for (let i = 0; i < n; i++) { const e = sum.get(find(i)), cx = e.x / e.c, cy = e.y / e.c, cz = e.z / e.c; pos.setXYZ(i, cx + (pos.getX(i) - cx) * k, cy + (pos.getY(i) - cy) * k, cz + (pos.getZ(i) - cz) * k); }
  pos.needsUpdate = true; g.computeBoundingSphere(); g.computeBoundingBox();
  bigCache.set(geo, g);
  return g;
}
function templateParts(root, kind) {
  const out = [];
  if (!root) return out;
  root.updateMatrixWorld(true);
  const inv = root.parent ? root.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  root.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) out.push({ kind, geometry: FRUIT_K[kind] ? bigBerries(o.geometry, FRUIT_K[kind]) : o.geometry, material: o.material, local: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), mesh: null }); });
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
  // Blender pieces (scripts/blender/gedeo_landscape.py → farm/landscape-parts.glb): mounded row, mulch basin, dry-stone
  // wall and earth bench modules. The box fallbacks only stand in when the GLB is missing.
  const partGeo = (key, fallback) => { const g = templates[key]?.geometry; return g ? g.clone().applyMatrix4(templates[key].matrix) : fallback(); };
  const bedGeo = partGeo('plantingRow', () => { // full column width: neighbouring fields join into one row
    const g = new THREE.BoxGeometry(3.34, .06, 2.3).translate(0, -.03, 0);
    const ps = g.attributes.position; for (let i = 0; i < ps.count; i++) if (ps.getY(i) > 0) ps.setZ(i, ps.getZ(i) * .75);
    g.computeVertexNormals(); return g;
  });
  const earthDiscGeo = new THREE.CircleGeometry(.72, 40).rotateX(-Math.PI / 2).translate(0, .02, 0);
  const earthDiscMat = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    grd.addColorStop(0, 'rgba(165,78,44,.95)'); grd.addColorStop(.62, 'rgba(150,66,38,.85)'); grd.addColorStop(1, 'rgba(140,60,34,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  })();
  const bedMat = farmMaterial('soil', { roughness: 1, normalScale: 1.1 });
  // Worn red earth round every field (real coffee ground: the soil between and around the rows is trodden bare). One
  // soft, ragged-edged decal per field, under the bed; follows the beds' matrices (syncHalos).
  const haloMat = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), img = g.createImageData(128, 128);
    const n = (x, y) => Math.sin(x * .31 + Math.sin(y * .17) * 3) * .5 + Math.sin(y * .23 + Math.sin(x * .13) * 2.4) * .5;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const dx = Math.abs(x - 63.5) / 63.5, dy = Math.abs(y - 63.5) / 63.5, d = Math.max(Math.pow(dx, 4) + Math.pow(dy, 4), 0) ** .25; // squircle
      const a = Math.max(0, Math.min(1, (1 - d) * 4.2 + n(x, y) * .55 + (Math.random() - .5) * .25));
      const k = (y * 128 + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = a * 235;
    }
    g.putImageData(img, 0, 0);
    const alpha = new THREE.CanvasTexture(c);
    const m = farmMaterial('soil', { roughness: 1, normalScale: .9, color: 0xd8b8a0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.alphaMap = alpha; return m;
  })();
  const haloGeo = new THREE.PlaneGeometry(4.9, 3.9).rotateX(-Math.PI / 2).translate(0, -.006, 0);
  let halos = null;
  function syncHalos() {
    if (!beds) return;
    if (!halos || halos.instanceMatrix.count !== beds.instanceMatrix.count) {
      if (halos) { halos.removeFromParent(); halos.dispose(); }
      halos = new THREE.InstancedMesh(haloGeo, haloMat, beds.instanceMatrix.count);
      halos.receiveShadow = true; halos.raycast = () => {}; halos.renderOrder = -1; group.add(halos);
    }
    halos.instanceMatrix.array.set(beds.instanceMatrix.array);
    halos.count = beds.count; halos.instanceMatrix.needsUpdate = true;
  }
  let beds = null, bedCap = 0;
  function ensureBeds(n) {
    if (beds && n <= bedCap) return;
    let cap = Math.max(BED_CAP, bedCap);
    while (cap < n) cap *= 2;
    if (beds) { beds.removeFromParent(); beds.dispose(); }
    bedCap = cap;
    beds = new THREE.InstancedMesh(bedGeo, bedMat, cap); // a dark soil patch with a worn red-earth halo under every plant; they overlap when planted close
    beds.setColorAt(0, SOIL_DRY); // creates instanceColor
    beds.count = 0;
    beds.receiveShadow = true;
    beds.castShadow = false;
    beds.raycast = () => {};
    group.add(beds);
  }
  ensureBeds(0);

  // ---------- rows: mulch strips, terrace edges, shade trees (rebuilt on sync; a few instances per lot) ----------
  const ROW_CAP = 128, SEG_CAP = 768; // walls / benches / mulch strips are laid in short modules (no stretched stones)
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const rowMat = farmMaterial('soil', { roughness: 1 }), wallMat = farmMaterial('stone', { roughness: .9, normalScale: 1.4 });
  const wallGeo = partGeo('wallUnit', () => unitBox.clone()), bankGeo = partGeo('bankUnit', () => unitBox.clone()).rotateY(Math.PI); // bench lip faces south (downhill)
  const strips = new THREE.InstancedMesh(bedGeo, rowMat, SEG_CAP), edges = new THREE.InstancedMesh(wallGeo, wallMat, SEG_CAP), benches = new THREE.InstancedMesh(bankGeo, rowMat, SEG_CAP);
  const trunkGeo = new THREE.CylinderGeometry(.12, .16, 2.4, 6).translate(0, 1.2, 0), crownGeo = new THREE.SphereGeometry(1.25, 10, 8).scale(1, .55, 1).translate(0, 2.7, 0);
  const shadeTrunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: SHADE_TRUNK, roughness: 1 }), ROW_CAP);
  const shadeCrowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: SHADE_LEAF, roughness: .9 }), ROW_CAP);
  for (const m of [strips, edges, benches, shadeTrunks, shadeCrowns]) { m.count = 0; m.raycast = () => {}; m.receiveShadow = true; group.add(m); }
  shadeTrunks.castShadow = shadeCrowns.castShadow = edges.castShadow = benches.castShadow = true;
  // Garden layers: enset / banana clumps (one merged fan of paddle leaves + pseudo-stem per instance), tall umbrella shade
  // trees (Albizia / Cordia), mid fruit trees (avocado / mango).
  const ensetGeo = (() => {
    const parts = [new THREE.CylinderGeometry(.16, .22, 1.1, 6).translate(0, .55, 0)];
    for (let k = 0; k < 7; k++) {
      const g = new THREE.PlaneGeometry(.42, 1.9, 1, 3).translate(0, .95, 0);
      const ps = g.attributes.position; for (let i = 0; i < ps.count; i++) { const y = ps.getY(i); ps.setZ(i, -.1 * y * y); }
      g.rotateX(-.45 - (k % 2) * .3).rotateY(k / 7 * Math.PI * 2).translate(0, .9, 0);
      parts.push(g);
    }
    for (const g of parts) { g.deleteAttribute('uv'); if (!g.index) continue; }
    const merged = mergeGeometries(parts.map(g => g.toNonIndexed()));
    merged.computeVertexNormals(); parts.forEach(g => g.dispose());
    return merged;
  })();
  const ensets = new THREE.InstancedMesh(ensetGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, side: THREE.DoubleSide }), ROW_CAP);
  const tallTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14, .24, 1, 6).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: SHADE_TRUNK, roughness: 1 }), ROW_CAP);
  const tallCrowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1).scale(1, .3, 1), new THREE.MeshStandardMaterial({ color: CANOPY, roughness: .9, flatShading: true }), ROW_CAP);
  const fruitTrees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1).scale(1, .85, 1).translate(0, 2.4, 0), new THREE.MeshStandardMaterial({ color: FRUIT, roughness: .9, flatShading: true }), ROW_CAP);
  const fruitTrunks = new THREE.InstancedMesh(trunkGeo, shadeTrunks.material, ROW_CAP);
  for (const m of [ensets, tallTrunks, tallCrowns, fruitTrees, fruitTrunks]) { m.count = 0; m.raycast = () => {}; m.castShadow = m.receiveShadow = true; group.add(m); }
  ensets.setColorAt(0, ENSET);
  const gm = new THREE.Matrix4(), gq = new THREE.Quaternion(), gs = new THREE.Vector3();
  const gEnset = gedeoInst(group, 'enset', 1, ROW_CAP, [ensets]);
  const gShade = gedeoInst(group, 'cordia', 1, ROW_CAP, [shadeTrunks, shadeCrowns]);
  const gTall = gedeoInst(group, 'albizia', 1, ROW_CAP, [tallTrunks, tallCrowns]);
  const gFruit = gedeoInst(group, 'cordia', 1, ROW_CAP, [fruitTrees, fruitTrunks]);
  let style = 'shade';
  strips.setColorAt(0, MULCH); edges.setColorAt(0, TERRACE); benches.setColorAt(0, BANK);
  const inLot = (lot, x, z, pad) => { const r = PARCELS[lot]?.rect; return !!r && x >= r[0] + pad && x <= r[2] - pad && z >= r[1] + pad && z <= r[3] - pad; };
  const rowKey = p => `${p.parcel}|${Math.round(p.z * 2) / 2}`;
  // Terrace height of every field (by its row's rank in its lot); fields not in a lot stay on the ground.
  const terraceOf = new Map(), groundOf = new Map();
  function computeTerraces(list) {
    terraceOf.clear(); groundOf.clear();
    for (const p of list) groundOf.set(p.id, farmGroundY(p.x, p.z)); // the tier the field stands on
    const lotRows = new Map(); // lot → sorted row zs
    for (const p of list) if (p.parcel) { const zs = lotRows.get(p.parcel) || lotRows.set(p.parcel, new Set()).get(p.parcel); zs.add(Math.round(p.z * 2) / 2); }
    for (const p of list) {
      const step = p.parcel ? TERRACE_STEP[p.zone || climateOfLot(p.parcel)] : 0;
      if (!step) continue;
      const zs = [...lotRows.get(p.parcel)].sort((a, b) => b - a); // south (larger z) first
      terraceOf.set(p.id, (zs.indexOf(Math.round(p.z * 2) / 2) + 1) * step);
    }
  }
  const tOf = id => terraceOf.get(id) || 0;                       // raised bench height above the land (none now)
  const hOf = id => tOf(id) + (groundOf.get(id) || 0);              // absolute height a field's soil sits at
  function layRows(list) {
    const rows = new Map(); // lot|z → fields of one row
    for (const p of list) { if (!p.parcel || hidden.has(p.id)) continue; const k = rowKey(p); (rows.get(k) || rows.set(k, []).get(k)).push(p); }
    let ns = 0, ne = 0, nb = 0, nt = 0;
    for (const fs of rows.values()) {
      const z = fs[0].z, H = hOf(fs[0].id), T = tOf(fs[0].id), G = H - T;
      const x0 = Math.min(...fs.map(f => f.x)) - 1.67, x1 = Math.max(...fs.map(f => f.x)) + 1.67, cx = (x0 + x1) / 2, len = x1 - x0;
      // modules along the row: the mulched strip in planting-row lengths, the bench and its dry-stone wall in ~1.2 m pieces
      const seg = (L, w) => { const n = Math.max(1, Math.round(L / w)); return { n, w: L / n }; };
      if (fs.length > 1) {
        const { n, w } = seg(len, 3.34);
        for (let k = 0; k < n && ns < SEG_CAP; k++) { strips.setMatrixAt(ns, m4.compose(pos.set(x0 + w * (k + .5), H - .01, z), quat.identity(), scl.set(w / 3.34, .4, 1))); strips.setColorAt(ns++, MULCH); }
      }
      if (T > 0) {
        // the bench (earth) and its retaining wall (stone) on the downhill, south face
        const b = seg(len + .2, 1.6), wl = seg(len + .3, 1.2);
        for (let k = 0; k < b.n && nb < SEG_CAP; k++) { benches.setMatrixAt(nb, m4.compose(pos.set(x0 - .1 + b.w * (k + .5), G + T / 2, z), quat.identity(), scl.set(b.w, T, BENCH_DEPTH))); benches.setColorAt(nb++, BANK); }
        for (let k = 0; k < wl.n && ne < SEG_CAP; k++) { edges.setMatrixAt(ne, m4.compose(pos.set(x0 - .15 + wl.w * (k + .5), G + (T + .06) / 2, z + BENCH_DEPTH / 2 + .02), quat.setFromAxisAngle(UP, (k % 2) * Math.PI), scl.set(wl.w, T + .06, .3))); edges.setColorAt(ne++, TERRACE); }
      }
    }
    // upland / highland (Arabica country): shade trees (cây che bóng) standing between a lot's rows, tall above the coffee
    const lots = new Map();
    for (const fs of rows.values()) (lots.get(fs[0].parcel) || lots.set(fs[0].parcel, []).get(fs[0].parcel)).push(...fs);
    for (const [lot, fs] of lots) {
      const zone = fs[0].zone || climateOfLot(lot);
      if (style === 'sun' || (zone !== 'upland' && zone !== 'highland') || fs.length < 3) continue;
      const zs = [...new Set(fs.map(f => Math.round(f.z * 2) / 2))].sort((a, b) => a - b), cz = zs.length > 1 ? (zs[0] + zs[1]) / 2 : zs[0] - 1.4;
      const xs = fs.map(f => f.x), cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      for (const sx of [cx - 2.6, cx + 2.6]) {
        if (nt >= ROW_CAP || !inLot(lot, sx, cz, .2)) continue;
        const k = .9 + ((Math.abs(Math.round(sx * 7 + cz * 3)) % 5) / 20);
        m4.compose(pos.set(sx, farmGroundY(sx, cz), cz), quat.identity(), scl.set(k, k * 1.15, k));
        gShade.set(nt, gm.compose(pos, gq.setFromAxisAngle(UP, sx * 1.7), gs.setScalar(k * .3))); // small: never hides the rows
        shadeTrunks.setMatrixAt(nt, m4); shadeCrowns.setMatrixAt(nt++, m4);
      }
    }
    // ---- garden layers (by country style) ----
    let nx = 0, nl = 0, nf = 0;
    const hash = (a, b) => (Math.abs(Math.round(a * 13 + b * 7)) % 97) / 97;
    if (style !== 'sun') {
      let ri = 0;
      for (const fs of rows.values()) {
        const z = fs[0].z, lot = fs[0].parcel, H = hOf(fs[0].id);
        const x0 = Math.min(...fs.map(f => f.x)) - 1.67, x1 = Math.max(...fs.map(f => f.x)) + 1.67;
        ri++;
        if (style === 'shade' && ri % 2) continue; // shade gardens: a banana at every other row end
        // interplanted in the path north of the row (rows fill their lot edge to edge, so the clumps stand inside it)
        const ez = z - 1.5;
        for (const ex of [x0 + .9, x1 - .9]) {
          if (nx >= ROW_CAP || !inLot(lot, ex, ez, .1)) continue;
          const k = .85 + hash(ex, z) * .5;
          ensets.setMatrixAt(nx, m4.compose(pos.set(ex, H, ez), quat.setFromAxisAngle(UP, hash(z, ex) * 6.28), scl.set(k, k * (style === 'forest' ? 1.3 : 1), k)));
          gEnset.set(nx, gm.compose(pos, quat, gs.setScalar(k * (style === 'forest' ? .4 : .34))));
          ensets.setColorAt(nx++, style === 'forest' ? ENSET : BANANA);
        }
      }
    }
    if (style === 'forest') {
      // tall native shade trees between the rows of every lot with ≥ 2 fields, fruit trees on the lot's corners
      for (const [lot, fs] of lots) {
        const zs = [...new Set(fs.map(f => Math.round(f.z * 2) / 2))].sort((a, b) => a - b);
        const xs = fs.map(f => f.x), cx = (Math.min(...xs) + Math.max(...xs)) / 2;
        const gaps = zs.length > 1 ? zs.slice(1).map((z, i) => (z + zs[i]) / 2) : [zs[0] - 1.5];
        for (const gz of gaps) for (const sx of [cx - 3.3, cx + 3.3]) {
          if (nl >= ROW_CAP || !inLot(lot, sx, gz, .2)) continue;
          const h = 7 + hash(sx, gz) * 4, w = 3.2 + hash(gz, sx) * 1.4;
          const lr = PARCELS[lot]?.rect, ex = lr ? (sx < cx ? lr[0] + .3 : lr[2] - .3) : sx; // trunk on the lot edge: the canopy shades the row ends, not the camera
          gTall.set(nl, gm.compose(pos.set(ex, farmGroundY(ex, gz), gz), gq.setFromAxisAngle(UP, hash(sx, sx) * 6), gs.setScalar(h / 26)));
          const gy = farmGroundY(sx, gz);
          tallTrunks.setMatrixAt(nl, m4.compose(pos.set(sx, gy, gz), quat.identity(), scl.set(1, h, 1)));
          tallCrowns.setMatrixAt(nl++, m4.compose(pos.set(sx, gy + h, gz), quat.setFromAxisAngle(UP, hash(sx, sx) * 6), scl.set(w, w, w)));
        }
        const r = PARCELS[lot]?.rect;
        if (!r) continue;
        for (const [fx, fz] of [[r[0] + .8, r[1] + .8], [r[2] - .8, r[3] - .8]]) {
          if (nf >= ROW_CAP || fs.some(f => Math.abs(f.x - fx) < 2 && Math.abs(f.z - fz) < 1.4)) continue; // not on a bed
          const k = .8 + hash(fx, fz) * .4;
          m4.compose(pos.set(fx, farmGroundY(fx, fz), fz), quat.identity(), scl.set(k, k, k));
          gFruit.set(nf, gm.compose(pos, gq.setFromAxisAngle(UP, fx * 2.3), gs.setScalar(k * .42)));
          fruitTrunks.setMatrixAt(nf, m4); fruitTrees.setMatrixAt(nf++, m4);
        }
      }
    }
    nl = 0; // in-lot tall shade trees hid the rows from the game camera: shade is player-placed now (BUILDINGS.shadeTree, +1★ to Arabica)
    nx = nf = nt = 0; // founder 2026-11-08: no auto-planted banana / enset / fruit / shade trees — only what the player plants
    ensets.count = nx; tallTrunks.count = tallCrowns.count = nl; fruitTrees.count = fruitTrunks.count = nf;
    gEnset.commit(nx); gTall.commit(nl); gFruit.commit(nf);
    for (const m of [ensets, tallTrunks, tallCrowns, fruitTrees, fruitTrunks]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
    strips.count = 0; edges.count = ne; benches.count = nb; shadeTrunks.count = shadeCrowns.count = nt; gShade.commit(nt);
    for (const m of [strips, edges, benches, shadeTrunks, shadeCrowns]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
  }

  // Invisible pick boxes per owned plot (catch taps on the trees too).
  const pickGeo = new THREE.BoxGeometry(BED_HALF * 2, 1.6, BED_HALF * 2).translate(0, .8, 0);
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
  const ringPart = { kind: KIND_RING, geometry: partGeo('mulchBasin', () => new THREE.RingGeometry(.12, .95, 20).rotateX(-Math.PI / 2)).translate(0, .1, 0), material: farmMaterial('soil', { color: 0x8a6a52, roughness: 1, transparent: true, opacity: .85, depthWrite: false }), local: new THREE.Matrix4(), mesh: null }; // mulched earth ring (đất mùn), soft-edged
  // Mature trees per variety (gedeo_heroes.py export_game_tree --species): arabica compact, robusta a wide umbrella,
  // liberica a tall tree. A variety without its own model falls back to the arabica one.
  const tag = (list, species) => list.map(p => Object.assign(p, { species }));
  const parts = [...tag(treeTpl, 'arabica'), ringPart, ...tag(templateParts(templates.fruitGreen, KIND_GREEN), 'arabica'), ...tag(templateParts(templates.fruitRipe, KIND_RIPE), 'arabica'),
    ...templateParts(templates.seedling, KIND_SEED), ...templateParts(templates.young, KIND_YOUNG)];
  const speciesOwn = new Set(['arabica']);
  for (const sp of ['robusta', 'liberica']) {
    const own = templateParts(templates[`tree_${sp}`], KIND_TREE);
    if (!own.length) continue;
    speciesOwn.add(sp);
    parts.push(...tag(own, sp), ...tag(templateParts(templates[`fruitGreen_${sp}`], KIND_GREEN), sp), ...tag(templateParts(templates[`fruitRipe_${sp}`], KIND_RIPE), sp));
  }
  const speciesOf = crop => (speciesOwn.has(crop) ? crop : 'arabica');
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
      // shadows from the foliage only: cherries / flowers and the thin trunk add triangles but no visible shade
      part.shadow = part.kind !== KIND_RING && part.kind !== KIND_GREEN && part.kind !== KIND_RIPE && !/bark/i.test(part.material?.name || '');
      mesh.castShadow = part.shadow && getQuality() === 'high'; mesh.receiveShadow = true; // medium: the bushes skip the shadow pass
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
    for (const part of parts) { part.mesh.setColorAt(i, part.kind === KIND_TREE || part.kind === KIND_SEED || part.kind === KIND_YOUNG ? L.leaf : part.kind === KIND_RIPE ? L.ripe : WHITE); part.mesh.instanceColor.needsUpdate = true; }
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
  // stage: KIND_SEED | KIND_YOUNG (first crop, k = 0…1 through that stage) | KIND_TREE (mature, sx/sy as before).
  function writeTree(e, sx, sy, green, ripe, stage = KIND_TREE, k = 1) {
    if (e.wx === sx && e.wy === sy && e.wg === green && e.wr === ripe && e.ws === stage && e.wk === k && !e.moved) return;
    e.wx = sx; e.wy = sy; e.wg = green; e.wr = ripe; e.ws = stage; e.wk = k; e.moved = false;
    if (hidden.has(e.id)) { for (const i of e.slots) for (const part of parts) part.mesh.setMatrixAt(i, ZERO); treesDirty = true; return; }
    const L = lookOf(e.crop), R = rowOf(e.crop), sp = speciesOf(e.crop);
    e.slots.forEach((slot, i) => {
      const layer = i < R.n ? 0 : 1, col = i % R.n; // front layer (south), then the back layer, staggered
      const dx = (col - (R.n - 1) / 2) * R.gap + (layer ? R.gap / 2 - R.gap / 4 : -R.gap / 4), dz = layer ? -R.dz : R.dz;
      const v = 1 + ((i * 37 + Math.round(e.x * 3)) % 7 - 3) * .03; // a little size variety, so the canopy is uneven
      quat.setFromAxisAngle(UP, e.rot + i * 1.9);
      if (stage !== KIND_TREE) {
        const s = STAGE_SIZE[stage] * (.6 + .4 * k) * v * (sy / Math.max(sx, 1e-3)); // sy/sx = the pop / shake bob
        base.compose(pos.set(e.x + dx, .2 + e.h, e.z + dz), quat, scl.set(s * L.w, s * L.h, s * L.w));
      } else base.compose(pos.set(e.x + dx, .2 + e.h, e.z + dz), quat, scl.set(sx * L.w * R.k * v, sy * L.h * R.k * v, sx * L.w * R.k * v));
      for (const part of parts) {
        const show = part.kind === KIND_RING || (stage === KIND_TREE ? part.species === sp && (part.kind === KIND_TREE || (part.kind === KIND_GREEN ? green : part.kind === KIND_RIPE && ripe)) : part.kind === stage);
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
    style = gardenStyle(String(state.world?.currentRegion || '').slice(0, 2));
    computeTerraces(list); // before the beds: they stand on their row's terrace
    // Beds + pickers for every field of the region.
    ensureBeds(list.length);
    plotList.length = 0;
    bedIndex = new Map();
    for (let i = 0; i < list.length; i++) {
      const plot = list[i];
      plotList.push(plot);
      bedIndex.set(plot.id, i);
      beds.setMatrixAt(i, hidden.has(plot.id) ? ZERO : m4.compose(pos.set(plot.x, .01 + hOf(plot.id), plot.z), quat.identity(), scl.set(.34, 1, .34)));
      plot.zone ||= tierZoneAt(plot.x, plot.z);
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
        pick.position.set(plot.x, hOf(plot.id), plot.z);
        pick.userData.placed = true;
        pick.updateMatrixWorld(true);
      }
    }
    beds.count = list.length;
    queueMicrotask(syncHalos);
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
          slots: Array.from({ length: rowOf(p.crop).n }, () => allocSlot()), x: 0, z: 0, rot: 0, pos: new THREE.Vector3(), wx: -1, wy: -1, wg: null, wr: null, moved: true, green: false, ripe: false };
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
  onQuality(level => { for (const part of parts) if (part.mesh) part.mesh.castShadow = !!part.shadow && level === 'high'; });
  function update(dt, time, now) {
    lastTime = time;
    const vis = group.visible; // café view: keep the clocks running but skip matrix writes, uploads and sparkles
    let seeds = 0, youngs = 0, greens = 0, ripes = 0; // stage / fruit meshes draw only while some tree shows them (they cover every slot)
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
      // first crop: seedling → young → mature (the mature model takes over at STAGE_AT[1] and grows on as before)
      const stage = grown || ratio >= STAGE_AT[1] ? KIND_TREE : ratio < STAGE_AT[0] ? KIND_SEED : KIND_YOUNG;
      const sk = stage === KIND_SEED ? ratio / STAGE_AT[0] : stage === KIND_YOUNG ? (ratio - STAGE_AT[0]) / (STAGE_AT[1] - STAGE_AT[0]) : 1;
      if (stage === KIND_SEED) seeds++; else if (stage === KIND_YOUNG) youngs++; else { if (e.green) greens++; if (e.ripe) ripes++; }
      if (vis) writeTree(e, q(e.scale), q(e.scale * bob), e.green && stage === KIND_TREE, e.ripe && stage === KIND_TREE, stage, q(sk));
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
      if (vis) writeTree(e, s, s, e.green, e.ripe, e.ws ?? KIND_TREE, e.wk ?? 1);
    }
    const used = { [KIND_SEED]: seeds, [KIND_YOUNG]: youngs, [KIND_GREEN]: greens, [KIND_RIPE]: ripes };
    for (const part of parts) if (part.mesh && part.kind in used) part.mesh.visible = used[part.kind] > 0;
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
      beds.setMatrixAt(i, on ? ZERO : m4.makeTranslation(p.x, .01 + hOf(p.id), p.z)); queueMicrotask(syncHalos);
      beds.instanceMatrix.needsUpdate = true;
      beds.computeBoundingSphere(); // a moved bed must not be culled by a sphere computed while it was hidden
    }
    const e = entities.get(id) || dying.find(d => d.id === id);
    if (e && e.slots.length) { e.moved = true; writeTree(e, e.wx, e.wy, e.wg, e.wr, e.ws ?? KIND_TREE, e.wk ?? 1); }
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
    /**
     * The planting preview's bed: the very same soil mound and worn red-earth halo a planted field gets (same geometry, scale
     * and materials), as one translucent group at the origin. `mats` = its own material clones (the caller fades and frees
     * them); setZone(zone) tints the soil like that growing zone's.
     */
    makeBedGhost(zone = 'lowland') {
      const soil = bedMat.clone(), halo = haloMat.clone(), mats = [soil, halo];
      for (const m of mats) { m.transparent = true; m.depthWrite = false; }
      const bed = new THREE.Mesh(bedGeo, soil), ring = new THREE.Mesh(haloGeo, halo), g = new THREE.Group();
      for (const o of [bed, ring]) { o.scale.set(.34, 1, .34); o.raycast = () => {}; o.castShadow = false; g.add(o); }
      ring.renderOrder = -1;
      const setZone = z => soil.color.copy(zoneSoil(z, false));
      setZone(zone);
      return { group: g, mats, setZone };
    },
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
      bedGeo.dispose(); bedMat.dispose(); earthDiscGeo.dispose(); earthDiscMat.map?.dispose(); earthDiscMat.dispose(); pickGeo.dispose(); pickMat.dispose();
      for (const m of [strips, edges, benches, shadeTrunks, shadeCrowns]) { m.removeFromParent(); m.dispose(); }
      unitBox.dispose(); rowMat.dispose(); trunkGeo.dispose(); crownGeo.dispose(); shadeTrunks.material.dispose(); shadeCrowns.material.dispose();
      group.removeFromParent();
    },
  };
}
