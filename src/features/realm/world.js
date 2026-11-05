// Static-ish world from layout.js, split in two areas that are never on screen together (setView toggles them):
//  · farm (BOUNDS): ground (country tint + large-scale vertex-color variation), soft-edged dirt roads with border stones
//    (open) / overgrown + barrier + price (closed), farm + build parcels (tilled earth, outlined build lots, wild meadow
//    + for-sale sign), merged fences, gate lanterns + flower pots and the World Gate on a cobblestone plaza.
//  · café (CAFE_BOUNDS, far south): its own ground, the café street + front road (CAFE_ROADS) customers walk in on,
//    a stone terrace with the café house backdrop, the café block S (terracotta floor) and the C2 expansion lot,
//    planters, lamps, umbrella tables, a little fountain garden.
// Each area gets instanced grass tufts / flowers / pebbles and border scenery. Rebuilt only on store changes (sync),
// never per frame except the gate glow pulse.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOUNDS, CAFE_BOUNDS, CAFE_ROADS, ROADS, ROAD_ORDER, PARCELS, GATE, RESERVED, FIXED, rectCenter, inRect, areaOfParcel } from '../../core/config/layout.js';
import { COUNTRIES, parseRegionId } from '../../core/config/world.js';
import { region as regionOf } from '../../core/derive.js';
import { t, formatNumber } from '../../i18n/index.js';
import { makeLabel, mulberry32, normalizeModel, paint, valueNoise, tone } from './util.js';

const ROAD_COLOR = 0xe6a462; // warm orange-tan dirt
const OVERGROWN = 0x5f8f3f;
const MAIN_NS = ROADS.mainNS.rect;
const ROAD_FADE_OUT = .35, ROAD_FADE_IN = .45; // soft road shoulders (m outside / inside the rect)
const PLAZA_R = GATE.radius + 1.4;
const SHOP_RECT = PARCELS.S.rect;
const CAFE_ROAD_LIST = Object.values(CAFE_ROADS);
// Café layout (decor only, outside every parcel): house backdrop behind the counters, stone terrace around the lots.
const CAFE_HOUSE = [-5.5, 96.4, 6.5, 100.8];
const CAFE_TERRACE = [-6.5, 101, 22.5, 116];
const FOUNTAIN = { x: -15.5, z: 107.5, r: 2.1 };
const UMBRELLAS = [[10, 114], [14.5, 114], [19, 114], [21.2, 104.2], [21.2, 108.8]];
const LAMPS = [[-11, 100], [-11, 110], [-17, 115.4], [-4.5, 115.4], [7, 115.4], [16.8, 115.4], [23, 101.5]];
const PARCEL_IDS = { farm: Object.keys(PARCELS).filter(id => areaOfParcel(id) === 'farm'), cafe: Object.keys(PARCELS).filter(id => areaOfParcel(id) === 'cafe') };

function noiseTexture(base, spread, size = 128, dots = 6) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  const rnd = mulberry32(base);
  for (let i = 0; i < size * dots; i++) {
    const v = Math.round(255 - rnd() * spread);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
// Grass detail: short light/dark blade strokes on white (tinted by the material color).
function grassTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, size, size);
  const rnd = mulberry32(11);
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const v = Math.round(rnd() < .5 ? 205 + rnd() * 30 : 248 + rnd() * 7);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.lineWidth = 1 + rnd() * 1.2;
    const x = rnd() * size, y = rnd() * size, a = -Math.PI / 2 + (rnd() - .5) * .9, l = 2 + rnd() * 4;
    for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
// Café floor: 1 m terracotta tiles (4×4 per texture), slightly varied, with light grout. One texture repeat = 4 m.
function tileTexture() {
  const size = 256, n = 4, s = size / n;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#c47c55'; g.fillRect(0, 0, size, size); // grout slightly darker than the tiles (no bright grid)
  const rnd = mulberry32(5);
  const tones = ['#e0956a', '#d98b5f', '#e6a074', '#d4855a', '#e39a6c'];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = tones[Math.floor(rnd() * tones.length)];
    g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
    g.fillStyle = 'rgba(255,240,215,.16)'; g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, 4); // top highlight
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(110,55,30,${.05 + rnd() * .08})`; g.fillRect(x * s + 6 + rnd() * (s - 14), y * s + 6 + rnd() * (s - 14), 2, 2); }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(.5, .5); // overlay UVs are world meters / 2
  return tex;
}
// Café terrace: cream / sand flagstones in a running bond with soft grout. One texture repeat = 4 m.
function stoneTexture() {
  const size = 256, rows = 4, h = size / rows;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#c9b597'; g.fillRect(0, 0, size, size);
  const rnd = mulberry32(17);
  const tones = ['#efe2c8', '#e8d8ba', '#f3e8d2', '#e2d0ae', '#eadcc0'];
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? h * .75 : 0;
    for (let x = -1; x < 3; x++) {
      const x0 = x * h * 1.5 + off;
      g.fillStyle = tones[Math.floor(rnd() * tones.length)];
      for (const ox of [0, -size, size]) g.fillRect(x0 + ox + 2, y * h + 2, h * 1.5 - 4, h - 4);
    }
  }
  for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(120,95,60,${.04 + rnd() * .06})`; g.fillRect(rnd() * size, rnd() * size, 2, 2); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(.5, .5);
  return tex;
}
// Flat ground-plane rectangle; UVs in world units / uvScale so shared repeat textures line up.
function rectGeometry(rect, y, uvScale = 2) {
  const w = rect[2] - rect[0], d = rect[3] - rect[1];
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  geo.translate((rect[0] + rect[2]) / 2, y, (rect[1] + rect[3]) / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / uvScale, uv.getY(i) * d / uvScale);
  return geo;
}
// Ground with large-scale brightness (lush / sunlit patches) and warm/cool hue variation baked in vertex colors.
function groundGeometry(rect, bounds = BOUNDS) {
  const w = rect[2] - rect[0], d = rect[3] - rect[1];
  const geo = new THREE.PlaneGeometry(w, d, Math.round(w / 2.5), Math.round(d / 2.5));
  geo.rotateX(-Math.PI / 2);
  geo.translate((rect[0] + rect[2]) / 2, 0, (rect[1] + rect[3]) / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    uv.setXY(i, x / 6, -z / 6);
    const n = valueNoise(x / 15, z / 15, 1) * .65 + valueNoise(x / 6, z / 6, 2) * .35;
    const warm = (valueNoise(x / 11 + 40, z / 11, 3) - .5) * 2;
    // Slightly deeper green outside the playable area (forest floor) so the map reads as a clearing.
    const out = Math.max(bounds.minX - x, x - bounds.maxX, bounds.minZ - z, z - bounds.maxZ, 0);
    const b = (.9 + n * .2) * (1 - Math.min(.14, out * .012));
    colors[i * 3] = b * (1 + .07 * warm);
    colors[i * 3 + 1] = b * (1 + .02 * warm);
    colors[i * 3 + 2] = b * (1 - .14 * warm);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}
// Road rectangle with soft shoulders: alpha (RGBA vertex color) fades to 0 outside the long sides and at map-edge
// ends; inner ends (junctions) stay hard so crossings are seamless. UVs in world meters so all roads share the dirt.
function roadGeometry(rect, y, bounds = BOUNDS, fadeEnds = false) {
  const alongX = rect[2] - rect[0] >= rect[3] - rect[1];
  const atEdgeX = v => fadeEnds || v <= bounds.minX + .01 || v >= bounds.maxX - .01;
  const atEdgeZ = v => fadeEnds || v <= bounds.minZ + .01 || v >= bounds.maxZ - .01;
  const fade = { x0: !alongX || atEdgeX(rect[0]), x1: !alongX || atEdgeX(rect[2]), z0: alongX || atEdgeZ(rect[1]), z1: alongX || atEdgeZ(rect[3]) };
  // Four lines across each axis: outer edge (alpha 0 when faded), inner edge, inner edge, outer edge.
  const lines = (a, b, fa, fb) => [
    [a - (fa ? ROAD_FADE_OUT : 0), fa ? 0 : 1],
    [a + (fa ? ROAD_FADE_IN : 0), 1],
    [b - (fb ? ROAD_FADE_IN : 0), 1],
    [b + (fb ? ROAD_FADE_OUT : 0), fb ? 0 : 1],
  ];
  const xs = lines(rect[0], rect[2], fade.x0, fade.x1), zs = lines(rect[1], rect[3], fade.z0, fade.z1);
  const pos = [], col = [], uv = [], idx = [];
  for (const [z, az] of zs) for (const [x, ax] of xs) { pos.push(x, y, z); uv.push(x / 2, -z / 2); col.push(1, 1, 1, Math.min(ax, az)); }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const a = j * 4 + i, b = a + 1, c = a + 4, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  return geo;
}
// Side roads must not paint over the main north-south road where they cross it.
function roadSegments(road) {
  const r = road.rect;
  if (road.id === 'mainNS' || road.id === 'mainEW') return [r];
  if (r[0] < MAIN_NS[0] && r[2] > MAIN_NS[2]) return [[r[0], r[1], MAIN_NS[0], r[3]], [MAIN_NS[2], r[1], r[2], r[3]]];
  return [r];
}
// Where the barrier/sign of a closed road stands: next to the main road.
export function roadSignPoint(roadId) {
  const r = ROADS[roadId].rect;
  const x = r[2] <= MAIN_NS[0] + .01 ? r[2] - 1 : r[0] < MAIN_NS[0] && r[2] > MAIN_NS[2] ? MAIN_NS[0] - 1 : r[0] + 1;
  return { x, z: (r[1] + r[3]) / 2 };
}
export function parcelSignPoint(parcelId) {
  const c = rectCenter(PARCELS[parcelId].rect);
  return { x: c.x, z: c.z };
}

export function regionPalette(state) {
  const id = state.world.currentRegion || (state.world.startCountry ? `${state.world.startCountry}-1` : 'vn-1');
  return COUNTRIES[parseRegionId(id)?.countryId || 'vn'].palette;
}
// Owned parcels/roads; before a region is entered the starter layout is shown.
export function ownedParcels(state) {
  return regionOf(state)?.parcels || Object.values(PARCELS).filter(p => p.starter).map(p => p.id);
}
export function isRoadOpen(state, roadId) {
  return !!(ROADS[roadId].open || regionOf(state)?.roads.includes(roadId));
}

// Free grass for scattered decor. Farm: not on roads, parcels or the gate plaza.
function isFreeGrass(x, z) {
  for (const id of ROAD_ORDER) if (inRect(x, z, ROADS[id].rect, .6)) return false;
  for (const p of Object.values(PARCELS)) if (inRect(x, z, p.rect, .8)) return false;
  return Math.hypot(x - GATE.x, z - GATE.z) >= PLAZA_R + 1.2;
}
// Café: not on the street / front road, the terrace, the house or the fountain.
function isFreeCafeGrass(x, z) {
  for (const r of CAFE_ROAD_LIST) if (inRect(x, z, r.rect, .6)) return false;
  for (const id of PARCEL_IDS.cafe) if (inRect(x, z, PARCELS[id].rect, .8)) return false;
  if (inRect(x, z, CAFE_TERRACE, .5) || inRect(x, z, CAFE_HOUSE, 1)) return false;
  return Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) >= FOUNTAIN.r + 1.6;
}

/**
 * InstancedMesh with a static range plus groups that are switched on/off on sync (wild meadow per parcel, border
 * stones per road). Instance data is precomputed once; `show(keys)` rewrites only when the key set changes.
 */
function dynamicInstances(geometry, material, statics, groups) {
  const cap = statics.length + Object.values(groups).reduce((n, l) => n + l.length, 0);
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, cap));
  mesh.raycast = () => {};
  let key = null;
  const write = (list, i) => { for (const it of list) { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); i++; } return i; };
  function show(keys) {
    const k = keys.join(',');
    if (k === key) return;
    key = k;
    let i = write(statics, 0);
    for (const id of keys) i = write(groups[id] || [], i);
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  show([]);
  return { mesh, show };
}

/** Sets UVs of a flat (XZ) geometry to world meters / scale, so shared repeat textures line up across meshes. */
function worldUV(geo, scale = 2) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / scale, -pos.getZ(i) / scale);
  return geo;
}

export function createWorld({ scene, templates }) {
  const group = new THREE.Group();
  group.name = 'realm-world';
  scene.add(group);
  // The two areas of a region. Only the current view's group is visible (realm.setView → world.setView).
  const areas = { farm: new THREE.Group(), cafe: new THREE.Group() };
  areas.farm.name = 'realm-world-farm'; areas.cafe.name = 'realm-world-cafe';
  group.add(areas.farm, areas.cafe);
  const farm = areas.farm, cafe = areas.cafe;
  const disposables = [];
  const keep = x => (disposables.push(x), x);
  const labels = [];

  // ---------- materials (shared) ----------
  const grassTex = keep(grassTexture());
  const dirtTex = keep(noiseTexture(23, 60, 128, 8));
  const tileTex = keep(tileTexture());
  const stoneTex = keep(stoneTexture());
  const mats = {
    ground: keep(new THREE.MeshStandardMaterial({ color: 0x7fae5a, map: grassTex, roughness: 1, vertexColors: true })),
    road: keep(new THREE.MeshStandardMaterial({ color: ROAD_COLOR, map: dirtTex, roughness: 1, vertexColors: true, transparent: true, depthWrite: false })),
    overgrown: keep(new THREE.MeshStandardMaterial({ color: OVERGROWN, map: grassTex, roughness: 1 })),
    tilled: keep(new THREE.MeshStandardMaterial({ color: 0xb07e4c, map: dirtTex, roughness: 1 })),
    paved: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileTex, roughness: .85 })),
    terrace: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, map: stoneTex, roughness: .92 })),
    buildGround: keep(new THREE.MeshStandardMaterial({ color: 0x8dbb5e, map: grassTex, roughness: 1 })),
    meadow: keep(new THREE.MeshStandardMaterial({ color: 0x8dbb5e, map: grassTex, roughness: 1 })),
    lockedMeadow: keep(new THREE.MeshStandardMaterial({ color: 0x6f8f55, map: grassTex, roughness: 1 })),
    wood: keep(new THREE.MeshStandardMaterial({ color: 0xb07a43, roughness: .9 })),
    woodDark: keep(new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: .9 })),
    stripe: null,
    plaza: keep(new THREE.MeshStandardMaterial({ color: 0xb8916a, map: dirtTex, roughness: 1 })),
    tuft: keep(new THREE.MeshStandardMaterial({ color: 0x7cc04f, roughness: 1, vertexColors: true })),
    flower: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 })),
    rock: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, flatShading: true })),
    props: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, vertexColors: true, flatShading: true })),
    outline: keep(new THREE.MeshBasicMaterial({ color: 0xfff7e0, transparent: true, opacity: .55, depthWrite: false })),
  };
  {
    const c = document.createElement('canvas'); c.width = 64; c.height = 16;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f6f1e6' : '#d9573f'; g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + 8, 0); g.lineTo(i * 8, 16); g.lineTo(i * 8 - 8, 16); g.fill(); }
    const tex = keep(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace;
    mats.stripe = keep(new THREE.MeshStandardMaterial({ map: tex, roughness: .8 }));
  }

  // ---------- ground (one per area; the café one darkens outside CAFE_BOUNDS) ----------
  for (const [target, b, name] of [[farm, BOUNDS, 'ground'], [cafe, CAFE_BOUNDS, 'cafe-ground']]) {
    const ground = new THREE.Mesh(keep(groundGeometry([b.minX - 60, b.minZ - 55, b.maxX + 60, b.maxZ + 60], b)), mats.ground);
    ground.receiveShadow = true;
    ground.name = name;
    target.add(ground);
  }

  // ---------- shared small geometries ----------
  const geo = {
    barrierPost: keep(new THREE.BoxGeometry(.16, .9, .16).translate(0, .45, 0)),
    plank: keep(new THREE.BoxGeometry(1, .24, .08)),
    bush: keep(new THREE.IcosahedronGeometry(.7, 0)),
    rock: keep(new THREE.DodecahedronGeometry(.5, 0)),
    sign: keep(signGeometry()),
  };

  // ---------- gate plaza: sandy mortar disc + instanced cobblestones with a raised stone border ----------
  const plaza = new THREE.Mesh(keep(new THREE.CircleGeometry(PLAZA_R + .25, 40).rotateX(-Math.PI / 2)), mats.plaza);
  plaza.position.set(GATE.x, .03, GATE.z);
  plaza.receiveShadow = true;
  farm.add(plaza);
  {
    const rnd = mulberry32(77);
    const cobbleGeo = keep(new THREE.CylinderGeometry(.21, .23, .09, 6).translate(0, .045, 0));
    const stones = [];
    for (let r = .4; r < PLAZA_R - .2; r += .44) {
      const n = Math.max(5, Math.floor(Math.PI * 2 * r / .44));
      const off = rnd() * 6;
      for (let i = 0; i < n; i++) stones.push({ r, a: off + i / n * Math.PI * 2, s: .82 + rnd() * .22, h: 1, c: rnd(), border: false });
    }
    const nb = Math.floor(Math.PI * 2 * PLAZA_R / .52);
    for (let i = 0; i < nb; i++) stones.push({ r: PLAZA_R, a: i / nb * Math.PI * 2, s: 1.25 + rnd() * .2, h: 2.4, c: rnd(), border: true });
    const mesh = keep(new THREE.InstancedMesh(cobbleGeo, mats.rock, stones.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    stones.forEach((it, i) => {
      p.set(GATE.x + Math.cos(it.a) * it.r, .02, GATE.z + Math.sin(it.a) * it.r);
      m.compose(p, q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.a + it.c), s.set(it.s, it.h, it.s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, it.border ? col.setHSL(.075, .22, .5 + it.c * .1, THREE.SRGBColorSpace) : col.setHSL(.075 + it.c * .03, .3 + it.c * .12, .66 + it.c * .1, THREE.SRGBColorSpace));
    });
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    farm.add(mesh);
  }

  // ---------- farm roads ----------
  const roads = {};
  for (const id of ROAD_ORDER) {
    const road = ROADS[id];
    const segs = roadSegments(road);
    const openGeo = keep(mergeGeometries(segs.map(r => roadGeometry(r, .02))));
    const open = new THREE.Mesh(openGeo, mats.road);
    open.receiveShadow = true;
    open.renderOrder = -1; // ground decals: draw before other transparent things (labels, vfx)
    farm.add(open);
    const closed = new THREE.Group();
    if (!road.open) {
      const over = new THREE.Mesh(keep(mergeGeometries(segs.map(r => rectGeometry(r, .02)))), mats.overgrown);
      over.receiveShadow = true;
      closed.add(over);
      // Bushes scattered along the overgrown road.
      const rnd = mulberry32(id.length * 97);
      const total = segs.reduce((n, r) => n + Math.round((r[2] - r[0]) / 2.2), 0);
      const bushes = keep(new THREE.InstancedMesh(geo.bush, mats.overgrown, total));
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      let i = 0;
      for (const r of segs) for (let x = r[0] + 1.2; x < r[2] - .6 && i < total; x += 2.2) {
        const k = .5 + rnd() * .6;
        m.compose(p.set(x + (rnd() - .5), .25 * k, r[1] + (r[3] - r[1]) * rnd()), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6), s.set(k, k * .8, k));
        bushes.setMatrixAt(i++, m);
      }
      bushes.count = i;
      bushes.castShadow = true;
      bushes.raycast = () => {};
      closed.add(bushes);
      // Barrier + price sign next to the main road.
      const sp = roadSignPoint(id);
      const barrier = new THREE.Group();
      barrier.position.set(sp.x, 0, sp.z);
      barrier.rotation.y = Math.PI / 2;
      const span = road.rect[3] - road.rect[1];
      for (const side of [-1, 1]) { const post = new THREE.Mesh(geo.barrierPost, mats.woodDark); post.position.x = side * span / 2; post.castShadow = true; barrier.add(post); }
      const plank = new THREE.Mesh(geo.plank, mats.stripe); plank.scale.x = span + .3; plank.position.y = .72; plank.castShadow = true;
      barrier.add(plank);
      closed.add(barrier);
      const label = makeLabel('', { bg: '#fff3d6', height: .75 });
      label.sprite.position.set(sp.x, 1.9, sp.z);
      closed.add(label.sprite);
      closed.userData.label = label;
      farm.add(closed);
    }
    roads[id] = { open, closed };
  }

  // ---------- café street + front road (always open, cosmetic) and the stone terrace ----------
  {
    const street = new THREE.Mesh(keep(mergeGeometries(CAFE_ROAD_LIST.map(r => roadGeometry(r.rect, .02, CAFE_BOUNDS, true)))), mats.road);
    street.receiveShadow = true;
    street.renderOrder = -1;
    cafe.add(street);
    const path = [-12.6, FOUNTAIN.z - .8, -9.5, FOUNTAIN.z + .8]; // garden path from the street to the fountain
    const parts = [
      worldUV(rectGeometry(CAFE_TERRACE, .006)),
      worldUV(rectGeometry(path, .006)),
      worldUV(new THREE.CircleGeometry(FOUNTAIN.r + 1.3, 32).rotateX(-Math.PI / 2).translate(FOUNTAIN.x, .006, FOUNTAIN.z)),
    ];
    const terrace = new THREE.Mesh(keep(mergeGeometries(parts.map(g => (g.index ? g.toNonIndexed() : g)))), mats.terrace);
    parts.forEach(g => g.dispose());
    terrace.receiveShadow = true;
    cafe.add(terrace);
  }

  // ---------- parcels (overlay + for-sale sign, in their own area) ----------
  const parcels = {};
  for (const p of Object.values(PARCELS)) {
    const target = areas[areaOfParcel(p.id)];
    const overlay = new THREE.Mesh(keep(rectGeometry(p.rect, .012, 2)), mats.meadow);
    overlay.receiveShadow = true;
    target.add(overlay);
    const c = parcelSignPoint(p.id);
    const sign = new THREE.Mesh(geo.sign, mats.props);
    sign.position.set(c.x, 0, c.z);
    sign.castShadow = true;
    sign.raycast = () => {};
    const label = makeLabel('', { bg: '#fff6e2', border: '#a8743f', height: .8 });
    label.sprite.position.y = 2.15;
    sign.add(label.sprite);
    target.add(sign);
    parcels[p.id] = { overlay, sign, label, state: null };
  }

  // ---------- fences (merged, rebuilt when farm ownership changes) ----------
  const fence = new THREE.Mesh(new THREE.BufferGeometry(), mats.wood);
  fence.castShadow = true; fence.receiveShadow = true;
  farm.add(fence);
  let fenceKey = '';
  function rebuildFences(owned) {
    const farms = owned.filter(id => PARCELS[id]?.kind === 'farm').sort();
    const key = farms.join(',');
    if (key === fenceKey) return;
    fenceKey = key;
    const parts = [];
    const post = new THREE.BoxGeometry(.16, .7, .16), rail = new THREE.BoxGeometry(1, .09, .07);
    const addPost = (x, z) => parts.push(post.clone().translate(x, .35, z));
    const addRail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (const y of [.28, .55]) {
        const g = rail.clone().scale(len, 1, 1);
        if (z0 !== z1) g.rotateY(Math.PI / 2);
        parts.push(g.translate((x0 + x1) / 2, y, (z0 + z1) / 2));
      }
    };
    for (const id of farms) {
      const [x0, z0, x1, z1] = PARCELS[id].rect;
      const a = x0 - .35, b = x1 + .35, c = z0 - .35, d = z1 + .35;
      const mid = (c + d) / 2, gap = 1.3; // opening on the east side, facing the road
      const run = (xa, za, xb, zb) => {
        const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 1.6));
        for (let i = 0; i <= n; i++) addPost(xa + (xb - xa) * i / n, za + (zb - za) * i / n);
        addRail(xa, za, xb, zb);
      };
      run(a, c, b, c); run(a, d, b, d); run(a, c, a, d);
      run(b, c, b, mid - gap); run(b, mid + gap, b, d);
    }
    post.dispose(); rail.dispose();
    fence.geometry.dispose();
    fence.geometry = parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry();
    parts.forEach(g => g.dispose());
  }

  // ---------- owned empty build lots: subtle light outline (merged, rebuilt on ownership change) ----------
  const outline = new THREE.Mesh(new THREE.BufferGeometry(), mats.outline);
  outline.raycast = () => {};
  outline.renderOrder = -1;
  farm.add(outline);
  let outlineKey = '';
  function rebuildOutline(owned) {
    const lots = owned.filter(id => PARCELS[id]?.kind === 'build').sort();
    const key = lots.join(',');
    if (key === outlineKey) return;
    outlineKey = key;
    const parts = [];
    const strip = (x0, z0, x1, z1) => parts.push(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, .035, (z0 + z1) / 2));
    const w = .14, inset = .12;
    for (const id of lots) {
      const [x0, z0, x1, z1] = PARCELS[id].rect;
      const a = x0 + inset, b = x1 - inset, c = z0 + inset, d = z1 - inset;
      strip(a, c, b, c + w); strip(a, d - w, b, d); strip(a, c + w, a + w, d - w); strip(b - w, c + w, b, d - w);
    }
    outline.geometry.dispose();
    outline.geometry = parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry();
    parts.forEach(g => g.dispose());
  }

  // ---------- scattered grass tufts / flowers / pebbles + wild meadow per parcel + road border stones (per area) ----------
  const blades = [];
  for (let i = 0; i < 3; i++) blades.push(new THREE.ConeGeometry(.075, .5, 3, 1).translate(0, .25, 0).rotateZ((i - 1) * .42).rotateY(i * 2.1));
  const tuftGeo = keep(mergeGeometries(blades)); // three tapered blades, darker at the base (vertex color gradient)
  blades.forEach(g => g.dispose());
  {
    const pos = tuftGeo.attributes.position, colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const k = .62 + Math.min(1, pos.getY(i) / .5) * .5; colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = k; }
    tuftGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const flowerGeo = keep(new THREE.IcosahedronGeometry(.11, 0).scale(1, .6, 1));
  const FLOWER_COLORS = ['#ffffff', '#ffe066', '#ff9ec4', '#c9a6ff', '#ff8a5c', '#fff4c2'].map(h => new THREE.Color(h));

  /**
   * cfg: { seed, bounds, clumps, pebbles, isFree(x,z), parcelIds, roads: [{id, open, segs}], skipStone(x,z) }
   * Closed roads' border stones and unowned parcels' wild meadow are dynamic groups switched on in sync.
   */
  function scatter(target, cfg) {
    const rnd = mulberry32(cfg.seed);
    const up = THREE.Object3D.DEFAULT_UP;
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const item = (x, y, z, sx, sy, sz, rot, color) => ({ m: new THREE.Matrix4().compose(p.set(x, y, z), q.setFromAxisAngle(up, rot), s.set(sx, sy, sz)), c: color });
    const tuftColor = () => new THREE.Color().setRGB(.85 + rnd() * .3, .9 + rnd() * .22, .8 + rnd() * .25);
    const wildColor = () => new THREE.Color().setRGB(1.05 + rnd() * .2, 1.02 + rnd() * .15, .72 + rnd() * .2);
    const tufts = [], flowers = [], rocks = [];
    const wildTufts = {}, wildFlowers = {}, borderStones = {};
    const b = cfg.bounds;
    const area = [b.minX - 8, b.minZ - 8, b.maxX + 8, b.maxZ + 8];
    const free = cfg.isFree;
    // Clumps on free grass (inside the area and a margin around it).
    for (let clumps = 0, tries = 0; clumps < cfg.clumps && tries < cfg.clumps * 22; tries++) {
      const cx = area[0] + rnd() * (area[2] - area[0]), cz = area[1] + rnd() * (area[3] - area[1]);
      if (!free(cx, cz)) continue;
      clumps++;
      const n = 2 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const x = cx + (rnd() - .5) * 1.6, z = cz + (rnd() - .5) * 1.6;
        if (!free(x, z)) continue;
        const k = .7 + rnd() * .6;
        tufts.push(item(x, 0, z, k, k * (.8 + rnd() * .5), k, rnd() * 6.28, tuftColor()));
      }
      if (rnd() < .55) {
        const nf = 1 + Math.floor(rnd() * 3), fc = FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)];
        for (let i = 0; i < nf; i++) {
          const x = cx + (rnd() - .5) * 1.4, z = cz + (rnd() - .5) * 1.4;
          if (!free(x, z)) continue;
          const k = .8 + rnd() * .5;
          flowers.push(item(x, .26 + rnd() * .14, z, k, k, k, rnd() * 6.28, fc));
        }
      }
    }
    for (let i = 0, tries = 0; i < cfg.pebbles && tries < cfg.pebbles * 27; tries++) {
      const x = area[0] + rnd() * (area[2] - area[0]), z = area[1] + rnd() * (area[3] - area[1]);
      if (!free(x, z)) continue;
      i++;
      const k = .18 + rnd() * .22;
      rocks.push(item(x, .03, z, k, k * .6, k * .9, rnd() * 6.28, new THREE.Color().setHSL(.08, .08, .62 + rnd() * .2, THREE.SRGBColorSpace)));
    }
    // Wild meadow on parcels that are not owned: taller, yellower tufts and a few flowers, clear of the sign.
    for (const id of cfg.parcelIds) {
      const [x0, z0, x1, z1] = PARCELS[id].rect;
      const sp = parcelSignPoint(id);
      const ok = (x, z) => Math.hypot(x - sp.x, z - sp.z) > 1.5;
      const tl = wildTufts[id] = [], fl = wildFlowers[id] = [];
      const n = Math.round((x1 - x0) * (z1 - z0) / 3.2);
      for (let i = 0; i < n; i++) {
        const x = x0 + .4 + rnd() * (x1 - x0 - .8), z = z0 + .4 + rnd() * (z1 - z0 - .8);
        if (!ok(x, z)) continue;
        const k = .9 + rnd() * .35;
        tl.push(item(x, 0, z, k, k * (1.2 + rnd() * .5), k, rnd() * 6.28, wildColor()));
      }
      for (let i = 0; i < 6; i++) {
        const x = x0 + .5 + rnd() * (x1 - x0 - 1), z = z0 + .5 + rnd() * (z1 - z0 - 1);
        if (!ok(x, z)) continue;
        fl.push(item(x, .45 + rnd() * .2, z, 1, 1, 1, rnd() * 6.28, FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)]));
      }
    }
    // Border stones along both long sides of every road segment (skipped at junctions and where cfg.skipStone says).
    for (const road of cfg.roads) {
      const list = road.open ? rocks : (borderStones[road.id] = []);
      for (const r of road.segs) {
        const alongX = r[2] - r[0] >= r[3] - r[1];
        const [a0, a1] = alongX ? [r[0], r[2]] : [r[1], r[3]];
        const sides = alongX ? [r[1] - .22, r[3] + .22] : [r[0] - .22, r[2] + .22];
        for (const side of sides) for (let v = a0 + .5; v < a1 - .3; v += 1.1 + rnd() * .8) {
          const off = (rnd() - .5) * .18;
          const x = alongX ? v : side + off, z = alongX ? side + off : v;
          if (cfg.roads.some(o => o !== road && o.segs.some(sr => inRect(x, z, sr, .5)))) continue;
          if (cfg.skipStone(x, z) || x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
          const k = .26 + rnd() * .16;
          list.push(item(x, .04, z, k, k * .7, k * .9, rnd() * 6.28, new THREE.Color().setHSL(.07, .1 + rnd() * .08, .66 + rnd() * .16, THREE.SRGBColorSpace)));
        }
      }
    }
    const out = {
      tufts: dynamicInstances(tuftGeo, mats.tuft, tufts, wildTufts),
      flowers: dynamicInstances(flowerGeo, mats.flower, flowers, wildFlowers),
      rocks: dynamicInstances(geo.rock, mats.rock, rocks, borderStones),
    };
    for (const d of Object.values(out)) { d.mesh.receiveShadow = true; keep(d.mesh); target.add(d.mesh); }
    return out;
  }
  const decor = {
    farm: scatter(farm, {
      seed: 2024, bounds: BOUNDS, clumps: 230, pebbles: 110, isFree: isFreeGrass, parcelIds: PARCEL_IDS.farm,
      roads: ROAD_ORDER.map(id => ({ id, open: ROADS[id].open, segs: roadSegments(ROADS[id]) })),
      skipStone: (x, z) => Math.hypot(x - GATE.x, z - GATE.z) < PLAZA_R + .6,
    }),
    cafe: scatter(cafe, {
      seed: 4048, bounds: CAFE_BOUNDS, clumps: 120, pebbles: 55, isFree: isFreeCafeGrass, parcelIds: PARCEL_IDS.cafe,
      roads: CAFE_ROAD_LIST.map(r => ({ id: r.id, open: true, segs: [r.rect] })),
      skipStone: (x, z) => inRect(x, z, CAFE_TERRACE, .3),
    }),
  };

  // ---------- merged static props (one draw per area) ----------
  const propMesh = (target, parts) => {
    const merged = keep(mergeGeometries(parts));
    parts.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, mats.props);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.raycast = () => {};
    target.add(mesh);
    return mesh;
  };
  const FLOWERS = ['#ff8fb8', '#ffe066', '#ffffff', '#ff7a59', '#c9a6ff'];
  const propKit = (parts, seed) => {
    const rnd = mulberry32(seed);
    const add = (g, color, x, y, z, ry = 0) => { if (ry) g.rotateY(ry); parts.push(paint(g.translate(x, y, z), color)); };
    const bloom = (x, y, z, spread, n) => { for (let i = 0; i < n; i++) add(new THREE.IcosahedronGeometry(.1 + rnd() * .04, 0), FLOWERS[Math.floor(rnd() * FLOWERS.length)], x + (rnd() - .5) * spread, y + rnd() * .12, z + (rnd() - .5) * spread); };
    const lantern = (x, z, h = 1.9) => {
      add(new THREE.BoxGeometry(.42, .22, .42), '#9a948a', x, .11, z);
      add(new THREE.BoxGeometry(.14, h, .14), '#5e3f26', x, .22 + h / 2, z);
      add(new THREE.BoxGeometry(.38, .42, .38), '#ffe9a6', x, h + .38, z);
      add(new THREE.BoxGeometry(.46, .06, .46), '#5e3f26', x, h + .17, z);
      add(new THREE.ConeGeometry(.36, .3, 4), '#5e3f26', x, h + .74, z, Math.PI / 4);
    };
    return { rnd, add, bloom, lantern };
  };
  // Farm: two gate lanterns north of the plaza and two flower pots south of it.
  {
    const parts = [];
    const { add, bloom, lantern } = propKit(parts, 31);
    for (const side of [-1, 1]) {
      lantern(GATE.x + side * (PLAZA_R + .5), GATE.z - 2.2);
      const px = GATE.x + side * (PLAZA_R + .6), pz = GATE.z + 1.6;
      add(new THREE.CylinderGeometry(.34, .25, .5, 8), '#c8643c', px, .25, pz);
      add(new THREE.CylinderGeometry(.37, .37, .08, 8), '#a94f2f', px, .5, pz);
      add(new THREE.IcosahedronGeometry(.36, 0).scale(1, .75, 1), '#5fae46', px, .72, pz);
      bloom(px, .92, pz, .45, 5);
    }
    propMesh(farm, parts);
  }
  // Café: house backdrop, deck curb + boardwalk lanes, planters, lamps, umbrella tables, fountain garden.
  {
    const parts = [];
    const { rnd, add, bloom, lantern } = propKit(parts, 57);
    // House behind the counters (decor only, blocks the player).
    const [hx0, hz0, hx1, hz1] = CAFE_HOUSE, hw = hx1 - hx0, hd = hz1 - hz0, hx = (hx0 + hx1) / 2, hz = (hz0 + hz1) / 2, front = hz1;
    add(new THREE.BoxGeometry(hw + .3, .25, hd + .3), '#a89580', hx, .125, hz);
    add(new THREE.BoxGeometry(hw, 3, hd), '#fff1d6', hx, 1.75, hz);
    add(new THREE.BoxGeometry(hw + .1, .22, hd + .1), '#a8743f', hx, 3.3, hz);
    add(new THREE.CylinderGeometry(2.9, 2.9, hw + .8, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, .45, 1), '#c4553a', hx, 4.06, hz);
    add(new THREE.BoxGeometry(.7, 1.3, .7), '#9a6a48', hx + 3.6, 4.3, hz - .6);
    add(new THREE.BoxGeometry(1.3, 2.15, .12), '#7a5230', hx + .8, 1.32, front + .02);
    add(new THREE.BoxGeometry(.12, .12, .1), '#f4c44f', hx + 1.25, 1.3, front + .1);
    for (const wx of [hx - 3.4, hx + 4.3]) {
      add(new THREE.BoxGeometry(2, 1.35, .1), '#ffffff', wx, 1.95, front + .02);
      add(new THREE.BoxGeometry(1.76, 1.12, .12), '#ffe7a6', wx, 1.95, front + .03);
      add(new THREE.BoxGeometry(.08, 1.12, .14), '#ffffff', wx, 1.95, front + .04);
      add(new THREE.BoxGeometry(2.2, .12, .4), '#ffffff', wx, 1.22, front + .18);
      add(new THREE.BoxGeometry(1.9, .22, .3), '#6aa84f', wx, 1.38, front + .2);
      bloom(wx, 1.52, front + .2, 1.5, 6);
    }
    // Striped awning over the front.
    const stripes = 12, sw = (hw + .4) / stripes;
    for (let i = 0; i < stripes; i++) {
      const x = hx0 - .2 + sw * (i + .5);
      const g = new THREE.BoxGeometry(sw, .06, 1.3).rotateX(.38);
      add(g, i % 2 ? '#fff4e0' : '#e8673c', x, 2.98, front + .62);
      add(new THREE.BoxGeometry(sw, .26, .05), i % 2 ? '#fff4e0' : '#e8673c', x, 2.62, front + 1.24);
    }
    // Low wooden curb around the café block, open on the west side where customers enter from the street.
    const [sx0, sz0, sx1, sz1] = SHOP_RECT;
    const cl = RESERVED.find(r => r.id === 'counterLane')?.rect, ql = RESERVED.find(r => r.id === 'queueLane')?.rect;
    const curb = (x0, z0, x1, z1) => add(new THREE.BoxGeometry(Math.max(.18, x1 - x0), .14, Math.max(.18, z1 - z0)), '#a8743f', (x0 + x1) / 2, .07, (z0 + z1) / 2);
    curb(sx0 - .1, sz0 - .1, sx1 + .1, sz0 - .1);
    curb(sx1 + .1, sz0 - .1, sx1 + .1, sz1 + .1);
    curb(sx0 - .1, sz1 + .1, sx1 + .1, sz1 + .1);
    curb(sx0 - .1, sz0 - .1, sx0 - .1, cl ? cl[1] : sz0 + 4);
    // Wooden boardwalk over the reserved customer lanes (queue → order counter → pickup), plus the entry from the street.
    const lane = (x0, z0, x1, z1, alongX) => {
      const span = alongX ? z1 - z0 : x1 - x0, n = Math.floor(span / .36), pw = span / n;
      for (let i = 0; i < n; i++) {
        const c = (alongX ? z0 : x0) + pw * (i + .5), color = i % 2 ? '#c99b66' : '#bb8d5a';
        if (alongX) add(new THREE.BoxGeometry(x1 - x0, .04, pw - .05), color, (x0 + x1) / 2, .03, c);
        else add(new THREE.BoxGeometry(pw - .05, .04, z1 - z0), color, c, .03, (z0 + z1) / 2);
      }
    };
    if (cl) lane(Math.max(cl[0], sx0) + .15, cl[1] + .25, Math.min(cl[2], sx1) - .15, cl[3] - .1, true);
    if (cl && ql) lane(Math.max(ql[0], sx0) + .15, cl[3] - .1, ql[2] - .1, Math.min(ql[3], sz1) - .2, false);
    // Planters between the block and the expansion lot, and along the front road.
    const planter = (x, z) => {
      add(new THREE.BoxGeometry(.9, .46, .9), '#b5794a', x, .23, z);
      add(new THREE.BoxGeometry(1, .1, 1), '#8a5a35', x, .5, z);
      add(new THREE.BoxGeometry(.78, .05, .78), '#6b4a2e', x, .53, z);
      add(new THREE.IcosahedronGeometry(.42, 0).scale(1, .8, 1), '#5fae46', x, .82, z);
      bloom(x, 1.02, z, .5, 4);
    };
    const C2 = PARCELS.C2.rect;
    for (const [x, z] of [[(sx1 + C2[0]) / 2, sz0 + 1], [(sx1 + C2[0]) / 2, (sz0 + sz1) / 2], [(sx1 + C2[0]) / 2, sz1 - .8], [1.2, 115.2], [4.2, 115.2], [-5.6, 101.4], [hx1 + .9, 101.3]]) planter(x, z);
    for (const [x, z] of LAMPS) lantern(x, z, 2.3);
    // Umbrella tables on the terrace.
    const CANOPY = ['#e8673c', '#2f9e8f', '#f4b63c'];
    UMBRELLAS.forEach(([x, z], i) => {
      add(new THREE.CylinderGeometry(.05, .05, 2.3, 6), '#7a5230', x, 1.15, z);
      add(new THREE.ConeGeometry(1.45, .55, 8), CANOPY[i % CANOPY.length], x, 2.45, z);
      add(new THREE.CylinderGeometry(.08, .08, .2, 6), '#7a5230', x, 2.8, z);
      add(new THREE.CylinderGeometry(.58, .58, .07, 14), '#fff7ea', x, .78, z);
      add(new THREE.CylinderGeometry(.09, .14, .74, 6), '#7a5230', x, .37, z);
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * Math.PI * 2 + i;
        add(new THREE.CylinderGeometry(.22, .2, .44, 8), '#a8743f', x + Math.cos(a) * .95, .22, z + Math.sin(a) * .95);
        add(new THREE.CylinderGeometry(.24, .24, .06, 8), '#e8d7b8', x + Math.cos(a) * .95, .47, z + Math.sin(a) * .95);
      }
    });
    // Fountain garden west of the street: basin, water, bowl; benches and flower beds around it.
    const { x: fx, z: fz, r: fr } = FOUNTAIN;
    add(new THREE.CylinderGeometry(fr, fr + .12, .52, 20), '#d8cbb4', fx, .26, fz);
    add(new THREE.CylinderGeometry(fr - .2, fr - .2, .05, 20), '#7fcde6', fx, .48, fz);
    add(new THREE.CylinderGeometry(.28, .36, 1.2, 10), '#d8cbb4', fx, .6, fz);
    add(new THREE.CylinderGeometry(.8, .5, .2, 14), '#d8cbb4', fx, 1.25, fz);
    add(new THREE.CylinderGeometry(.66, .66, .04, 14), '#9adcf0', fx, 1.35, fz);
    add(new THREE.IcosahedronGeometry(.18, 0), '#c8f0ff', fx, 1.55, fz);
    const bench = (x, z, ry) => {
      const g = [];
      const local = (geo, color, lx, ly, lz) => g.push([geo.translate(lx, ly, lz), color]);
      local(new THREE.BoxGeometry(1.7, .09, .5), '#b07a43', 0, .46, 0);
      local(new THREE.BoxGeometry(1.7, .4, .08), '#b07a43', 0, .78, -.24);
      for (const lx of [-.7, .7]) local(new THREE.BoxGeometry(.1, .46, .44), '#5e3f26', lx, .23, 0);
      for (const [gg, color] of g) add(gg.rotateY(ry), color, x, 0, z);
    };
    bench(fx, fz - fr - 1.7, 0); bench(fx, fz + fr + 1.7, Math.PI); bench(fx - fr - 1.7, fz, Math.PI / 2);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + .3, rr = fr + 3.1 + rnd() * .5;
      const x = fx + Math.cos(a) * rr, z = fz + Math.sin(a) * rr;
      if (x > -10.4 || Math.abs(Math.sin(a)) > .93 || Math.abs(Math.cos(a)) > .93) continue; // keep the path + benches clear
      add(new THREE.IcosahedronGeometry(.5, 0).scale(1, .7, 1), '#5fae46', x, .3, z);
      bloom(x, .55, z, .6, 5);
    }
    propMesh(cafe, parts);
  }
  // Café sign over the door.
  {
    const sign = makeLabel(t('realm.cafeSign'), { bg: '#7a4a2a', fg: '#fff4e0', border: '#f2c27a', height: 1 });
    sign.sprite.position.set((CAFE_HOUSE[0] + CAFE_HOUSE[2]) / 2, 4.9, CAFE_HOUSE[3] + .3);
    cafe.add(sign.sprite);
    labels.push(sign);
  }

  // ---------- border scenery (instanced, per area) ----------
  const SRGB = THREE.SRGBColorSpace;
  const trunkGeo = keep(new THREE.CylinderGeometry(.16, .24, 1.2, 6).translate(0, .6, 0));
  const crownGeo = keep(new THREE.DodecahedronGeometry(1.1, 0).translate(0, 2.1, 0));
  const coneGeo = keep(new THREE.ConeGeometry(1, 2.6, 7).translate(0, 2.4, 0));
  const white = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true }));
  const trunkMat = keep(new THREE.MeshStandardMaterial({ color: 0x8a5a35, roughness: 1 }));
  function border(target, b, { seed, pockets, trees, bushes, rocks, margin }) {
    const rnd = mulberry32(seed);
    const inner = [b.minX - .5, b.minZ - .5, b.maxX + .5, b.maxZ + .5];
    const outer = [b.minX - margin[0], b.minZ - margin[1], b.maxX + margin[0], b.maxZ + margin[2]];
    const samples = (n, inPocket) => {
      const out = [];
      if (inPocket && !pockets.length) return out;
      for (let tries = 0; out.length < n && tries < n * 30; tries++) {
        let x, z;
        if (inPocket) {
          const r = pockets[Math.floor(rnd() * pockets.length)];
          x = r[0] + rnd() * (r[2] - r[0]); z = r[1] + rnd() * (r[3] - r[1]);
        } else {
          x = outer[0] + rnd() * (outer[2] - outer[0]); z = outer[1] + rnd() * (outer[3] - outer[1]);
          if (x > inner[0] && x < inner[2] && z > inner[1] && z < inner[3]) continue;
        }
        if (out.some(p => Math.hypot(p.x - x, p.z - z) < 2.2)) continue;
        out.push({ x, z, s: .7 + rnd() * .7, r: rnd() * 6, c: rnd() });
      }
      return out;
    };
    const treeList = [...samples(trees[0], false), ...samples(trees[1], true)];
    const bushList = [...samples(bushes[0], false), ...samples(bushes[1], true)];
    const rockList = samples(rocks, false);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const inst = (geometry, material, list, place, color) => {
      const mesh = keep(new THREE.InstancedMesh(geometry, material, Math.max(1, list.length)));
      mesh.count = list.length;
      list.forEach((it, i) => {
        place(it, p, s);
        m.compose(p, q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.r), s);
        mesh.setMatrixAt(i, m);
        if (color) mesh.setColorAt(i, color(it, col));
      });
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.raycast = () => {};
      target.add(mesh);
      return mesh;
    };
    inst(trunkGeo, trunkMat, treeList, (it, pp, ss) => { pp.set(it.x, 0, it.z); ss.setScalar(it.s); });
    const round = treeList.filter(it => it.c < .6), pine = treeList.filter(it => it.c >= .6);
    inst(crownGeo, white, round, (it, pp, ss) => { pp.set(it.x, 0, it.z); ss.setScalar(it.s); }, (it, c) => c.setHSL(.25 + it.c * .08, .58, .42 + it.c * .1, SRGB));
    inst(coneGeo, white, pine, (it, pp, ss) => { pp.set(it.x, 0, it.z); ss.setScalar(it.s); }, (it, c) => c.setHSL(.34, .5, .3 + (it.c - .6) * .2, SRGB));
    inst(geo.bush, white, bushList, (it, pp, ss) => { pp.set(it.x, .3 * it.s, it.z); ss.set(it.s, it.s * .75, it.s); }, (it, c) => c.setHSL(.24 + it.c * .1, .6, .4 + it.c * .08, SRGB));
    inst(geo.rock, white, rockList, (it, pp, ss) => { pp.set(it.x, .15, it.z); ss.set(it.s * 1.1, it.s * .66, it.s); }, (it, c) => c.setHSL(.08, .08, .6 + it.c * .15, SRGB));
  }
  // Farm: empty grass corners inside the map also get a few trees.
  border(farm, BOUNDS, { seed: 42, margin: [22, 20, 22], trees: [170, 22], bushes: [90, 20], rocks: 50,
    pockets: [[18, 15, 29, 25], [-29, 19, -6, 25.5], [-29, -21.5, -3, -19], [3, -21.5, 29, -19.5]] });
  // Café: a green ring around the plaza, trees in the corners away from the street.
  border(cafe, CAFE_BOUNDS, { seed: 43, margin: [22, 18, 20], trees: [130, 18], bushes: [70, 16], rocks: 30,
    pockets: [[-21.5, 120.5, -11.5, 127.5], [-4.5, 121, 23.5, 127.5], [9, 94.3, 23.5, 100], [-21.5, 94.3, -12.5, 99.2]] });

  // ---------- World Gate (farm) ----------
  const gate = new THREE.Group();
  gate.position.set(GATE.x, 0, GATE.z);
  farm.add(gate);
  {
    const frame = templates.gateFrame, left = templates.gateLeft, right = templates.gateRight;
    if (frame) {
      const parts = new THREE.Group();
      parts.add(frame.clone());
      if (left) parts.add(left.clone());
      if (right) parts.add(right.clone());
      const norm = normalizeModel(parts, GATE.radius * 2, 1.6, { fill: 1, maxScale: 1.2 });
      norm.position.y = .06; // stands on the cobbles
      gate.add(norm);
    }
    // Soft glow between the pillars.
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,248,214,1)'); grad.addColorStop(.5, 'rgba(255,226,150,.55)'); grad.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const tex = keep(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace;
    const glowMat = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const glow = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.6, 4.4)), glowMat);
    glow.position.y = 2.1;
    glow.raycast = () => {};
    gate.add(glow);
    gate.userData.glow = glow;
  }
  const gatePicker = new THREE.Mesh(keep(new THREE.BoxGeometry(GATE.radius * 2, 5.5, 2).translate(0, 2.75, 0)), keep(new THREE.MeshBasicMaterial()));
  gatePicker.visible = false;
  gatePicker.position.copy(gate.position);
  gatePicker.userData.target = { kind: 'gate' };
  farm.add(gatePicker);

  // ---------- sync from the save ----------
  let paletteKey = null;
  const activeWild = [], activeRoads = [];
  function sync(state) {
    const pal = regionPalette(state);
    if (paletteKey !== pal) {
      paletteKey = pal;
      // Country tint, pushed brighter / more saturated for a cheerful read under ACES tone mapping.
      tone(mats.ground.color, pal.ground, 0, .24, .02);
      tone(mats.tuft.color, pal.ground, .01, .3, .04);
      tone(mats.buildGround.color, pal.ground, 0, .22, .08);
      tone(mats.meadow.color, pal.ground, .015, .2, .12);
      tone(mats.lockedMeadow.color, pal.ground, 0, .12, -.03);
      tone(mats.overgrown.color, pal.ground, .01, .18, -.1);
    }
    const owned = ownedParcels(state);
    const round = state.player.round;
    activeWild.length = 0;
    for (const p of Object.values(PARCELS)) {
      const e = parcels[p.id];
      const isOwned = owned.includes(p.id);
      const roadClosed = p.road && !isRoadOpen(state, p.road);
      const st = isOwned ? 'owned' : round < p.round ? 'round' : roadClosed ? 'road' : 'sale';
      if (e.state !== st) {
        e.state = st;
        e.overlay.material = st === 'owned' ? (p.kind === 'farm' ? mats.tilled : p.kind === 'shop' ? mats.paved : mats.buildGround) : st === 'sale' ? mats.meadow : mats.lockedMeadow;
        e.sign.visible = st !== 'owned';
      }
      if (st !== 'owned') activeWild.push(p.id);
      if (st === 'sale') e.label.set(t('realm.forSale', { price: formatNumber(p.cost) }));
      else if (st === 'round') e.label.set(t('realm.roundLocked', { n: p.round }));
      else if (st === 'road') e.label.set(t('realm.needsRoad'));
    }
    for (const d of Object.values(decor)) { d.tufts.show(activeWild); d.flowers.show(activeWild); }
    activeRoads.length = 0;
    for (const id of ROAD_ORDER) {
      const road = ROADS[id], e = roads[id];
      const open = isRoadOpen(state, id);
      e.open.visible = open;
      e.closed.visible = !open;
      if (open && !road.open) activeRoads.push(id);
      const label = e.closed.userData.label;
      if (!open && label) label.set(round < road.round ? t('realm.roundLocked', { n: road.round }) : t('realm.openRoad', { price: formatNumber(road.cost) }));
    }
    decor.farm.rocks.show(activeRoads);
    rebuildFences(owned);
    rebuildOutline(owned);
  }

  function update(time) {
    const glow = gate.userData.glow;
    if (glow && farm.visible) glow.material.opacity = .55 + .25 * Math.sin(time * 2);
  }

  return {
    group, areas, mats, gate, gatePicker, sync, update,
    /** Static decor the player cannot walk through (café house, fountain). */
    blockers: [CAFE_HOUSE, [FOUNTAIN.x - FOUNTAIN.r, FOUNTAIN.z - FOUNTAIN.r, FOUNTAIN.x + FOUNTAIN.r, FOUNTAIN.z + FOUNTAIN.r]],
    /** Shows only one area: 'farm' | 'cafe' (null → both, used while shaders compile). */
    setView(v) { farm.visible = !v || v === 'farm'; cafe.visible = !v || v === 'cafe'; },
    parcelState: id => parcels[id]?.state || null,
    dispose() {
      for (const e of Object.values(parcels)) e.label.dispose();
      for (const e of Object.values(roads)) e.closed.userData.label?.dispose();
      for (const l of labels) l.dispose();
      fence.geometry.dispose();
      outline.geometry.dispose();
      for (const d of disposables) d.dispose?.();
      group.removeFromParent();
    },
  };
}

// For-sale sign: two posts, a framed light-wood board and a small red roof (vertex colors, one shared geometry).
function signGeometry() {
  const parts = [];
  const add = (g, color, x, y, z) => parts.push(paint(g.translate(x, y, z), color));
  for (const x of [-.62, .62]) add(new THREE.BoxGeometry(.13, 1.45, .13), '#6e4a2c', x, .72, 0);
  add(new THREE.BoxGeometry(1.62, .78, .08), '#7a5230', 0, 1.08, -.01);
  add(new THREE.BoxGeometry(1.48, .64, .1), '#e9c48d', 0, 1.08, 0);
  add(new THREE.BoxGeometry(1.8, .08, .34), '#c4523a', 0, 1.52, 0);
  const merged = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  return merged;
}
