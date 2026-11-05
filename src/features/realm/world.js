// Static-ish world from layout.js: ground (country tint), roads (open dirt / closed overgrown + barrier + price),
// parcels (tilled earth, paved grid or meadow + for-sale sign), merged fences, instanced border scenery and the World Gate.
// Rebuilt only on store changes (sync), never per frame except the gate glow pulse.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOUNDS, ROADS, ROAD_ORDER, PARCELS, GATE, rectCenter } from '../../core/config/layout.js';
import { COUNTRIES, parseRegionId } from '../../core/config/world.js';
import { region as regionOf } from '../../core/derive.js';
import { t, formatNumber } from '../../i18n/index.js';
import { makeLabel, mulberry32, normalizeModel } from './util.js';

const ROAD_COLOR = 0xd2a066;
const OVERGROWN = 0x5f8f3f;
const MAIN_NS = ROADS.mainNS.rect;

function noiseTexture(base, spread, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  const rnd = mulberry32(base);
  for (let i = 0; i < size * 6; i++) {
    const v = Math.round(255 - rnd() * spread);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function gridTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(150,120,80,.45)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 61, 61);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
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

export function createWorld({ scene, templates }) {
  const group = new THREE.Group();
  group.name = 'realm-world';
  scene.add(group);
  const disposables = [];
  const keep = x => (disposables.push(x), x);

  // ---------- materials (shared) ----------
  const grassTex = keep(noiseTexture(11, 40)); grassTex.repeat.set(1, 1);
  const dirtTex = keep(noiseTexture(23, 55));
  const grid = keep(gridTexture());
  const mats = {
    ground: keep(new THREE.MeshStandardMaterial({ color: 0x7fae5a, map: grassTex, roughness: 1 })),
    road: keep(new THREE.MeshStandardMaterial({ color: ROAD_COLOR, map: dirtTex, roughness: 1 })),
    overgrown: keep(new THREE.MeshStandardMaterial({ color: OVERGROWN, map: grassTex, roughness: 1 })),
    tilled: keep(new THREE.MeshStandardMaterial({ color: 0xa77b4f, map: dirtTex, roughness: 1 })),
    paved: keep(new THREE.MeshStandardMaterial({ color: 0xead8ad, map: grid, roughness: .95 })),
    meadow: keep(new THREE.MeshStandardMaterial({ color: 0x8dbb5e, map: grassTex, roughness: 1 })),
    lockedMeadow: keep(new THREE.MeshStandardMaterial({ color: 0x6f8f55, map: grassTex, roughness: 1 })),
    wood: keep(new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: .9 })),
    woodDark: keep(new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: .9 })),
    stripe: null,
    plaza: keep(new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: .9 })),
  };
  {
    const c = document.createElement('canvas'); c.width = 64; c.height = 16;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f6f1e6' : '#d9573f'; g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + 8, 0); g.lineTo(i * 8, 16); g.lineTo(i * 8 - 8, 16); g.fill(); }
    const tex = keep(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace;
    mats.stripe = keep(new THREE.MeshStandardMaterial({ map: tex, roughness: .8 }));
  }

  // ---------- ground ----------
  const ground = new THREE.Mesh(rectGeometry([BOUNDS.minX - 60, BOUNDS.minZ - 60, BOUNDS.maxX + 60, BOUNDS.maxZ + 60], 0, 6), mats.ground);
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  // Gate plaza disc.
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(GATE.radius + 1.6, 40).rotateX(-Math.PI / 2), mats.plaza);
  plaza.position.set(GATE.x, .025, GATE.z);
  plaza.receiveShadow = true;
  group.add(plaza);

  // ---------- shared small geometries ----------
  const geo = {
    post: keep(new THREE.BoxGeometry(.14, 1.1, .14).translate(0, .55, 0)),
    board: keep(new THREE.BoxGeometry(1.3, .62, .08)),
    barrierPost: keep(new THREE.BoxGeometry(.16, .9, .16).translate(0, .45, 0)),
    plank: keep(new THREE.BoxGeometry(1, .24, .08)),
    bush: keep(new THREE.IcosahedronGeometry(.7, 0)),
  };

  // ---------- roads ----------
  const roads = {};
  for (const id of ROAD_ORDER) {
    const road = ROADS[id];
    const segs = roadSegments(road);
    const openGeo = keep(mergeGeometries(segs.map(r => rectGeometry(r, .02))));
    const open = new THREE.Mesh(openGeo, mats.road);
    open.receiveShadow = true;
    group.add(open);
    const closed = new THREE.Group();
    if (!road.open) {
      const over = new THREE.Mesh(keep(mergeGeometries(segs.map(r => rectGeometry(r, .02)))), mats.overgrown);
      over.receiveShadow = true;
      closed.add(over);
      // Bushes scattered along the overgrown road.
      const rnd = mulberry32(id.length * 97);
      const total = segs.reduce((n, r) => n + Math.round((r[2] - r[0]) / 2.2), 0);
      const bushes = new THREE.InstancedMesh(geo.bush, mats.overgrown, total);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      let i = 0;
      for (const r of segs) for (let x = r[0] + 1.2; x < r[2] - .6 && i < total; x += 2.2) {
        const k = .5 + rnd() * .6;
        m.compose(p.set(x + (rnd() - .5), .25 * k, r[1] + (r[3] - r[1]) * rnd()), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6), s.set(k, k * .8, k));
        bushes.setMatrixAt(i++, m);
      }
      bushes.count = i;
      bushes.castShadow = true;
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
      group.add(closed);
    }
    roads[id] = { open, closed };
  }

  // ---------- parcels ----------
  const parcels = {};
  for (const p of Object.values(PARCELS)) {
    const overlay = new THREE.Mesh(keep(rectGeometry(p.rect, .012, 2)), mats.meadow);
    overlay.receiveShadow = true;
    group.add(overlay);
    const sign = new THREE.Group();
    const c = parcelSignPoint(p.id);
    sign.position.set(c.x, 0, c.z);
    const post = new THREE.Mesh(geo.post, mats.woodDark); post.castShadow = true;
    const board = new THREE.Mesh(geo.board, mats.wood); board.position.y = 1.05; board.castShadow = true;
    sign.add(post, board);
    const label = makeLabel('', { height: .8 });
    label.sprite.position.y = 2.05;
    sign.add(label.sprite);
    group.add(sign);
    parcels[p.id] = { overlay, sign, label, state: null };
  }

  // ---------- fences (merged, rebuilt when farm ownership changes) ----------
  const fence = new THREE.Mesh(new THREE.BufferGeometry(), mats.wood);
  fence.castShadow = true; fence.receiveShadow = true;
  group.add(fence);
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

  // ---------- border scenery (instanced) ----------
  {
    const rnd = mulberry32(42);
    const inner = [BOUNDS.minX - .5, BOUNDS.minZ - .5, BOUNDS.maxX + .5, BOUNDS.maxZ + .5];
    const outer = [BOUNDS.minX - 22, BOUNDS.minZ - 20, BOUNDS.maxX + 22, BOUNDS.maxZ + 22];
    // Empty grass corners inside the map also get a few trees.
    const pockets = [[18, 15, 29, 25], [-29, 19, -6, 25.5], [-29, -21.5, -3, -19], [3, -21.5, 29, -19.5]];
    const samples = (n, inPocket) => {
      const out = [];
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
    const trees = [...samples(170, false), ...samples(22, true)];
    const bushes = [...samples(90, false), ...samples(20, true)];
    const rocks = samples(50, false);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const inst = (geometry, material, list, place, color) => {
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((it, i) => {
        place(it, p, s);
        m.compose(p, q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.r), s);
        mesh.setMatrixAt(i, m);
        if (color) mesh.setColorAt(i, color(it, col));
      });
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.raycast = () => {};
      group.add(mesh);
      return mesh;
    };
    const trunkGeo = keep(new THREE.CylinderGeometry(.16, .24, 1.2, 6).translate(0, .6, 0));
    const crownGeo = keep(new THREE.DodecahedronGeometry(1.1, 0).translate(0, 2.1, 0));
    const coneGeo = keep(new THREE.ConeGeometry(1, 2.6, 7).translate(0, 2.4, 0));
    const rockGeo = keep(new THREE.DodecahedronGeometry(.55, 0));
    const white = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true }));
    const trunkMat = keep(new THREE.MeshStandardMaterial({ color: 0x8a5a35, roughness: 1 }));
    inst(trunkGeo, trunkMat, trees, (it, pp, ss) => { pp.set(it.x, 0, it.z); ss.setScalar(it.s); });
    const round = trees.filter(it => it.c < .6), pine = trees.filter(it => it.c >= .6);
    inst(crownGeo, white, round, (it, pp, ss) => { pp.set(it.x, 0, it.z); ss.setScalar(it.s); }, (it, c) => c.setHSL(.27 + it.c * .08, .5, .38 + it.c * .1));
    inst(coneGeo, white, pine, (it, pp, ss) => { pp.set(it.x, 0, it.z); ss.setScalar(it.s); }, (it, c) => c.setHSL(.33, .45, .27 + (it.c - .6) * .2));
    inst(geo.bush, white, bushes, (it, pp, ss) => { pp.set(it.x, .3 * it.s, it.z); ss.set(it.s, it.s * .75, it.s); }, (it, c) => c.setHSL(.25 + it.c * .1, .55, .36 + it.c * .08));
    inst(rockGeo, white, rocks, (it, pp, ss) => { pp.set(it.x, .15, it.z); ss.set(it.s, it.s * .6, it.s * .9); }, (it, c) => c.setHSL(.08, .08, .55 + it.c * .15));
  }

  // ---------- World Gate ----------
  const gate = new THREE.Group();
  gate.position.set(GATE.x, 0, GATE.z);
  group.add(gate);
  {
    const frame = templates.gateFrame, left = templates.gateLeft, right = templates.gateRight;
    if (frame) {
      const parts = new THREE.Group();
      parts.add(frame.clone());
      if (left) parts.add(left.clone());
      if (right) parts.add(right.clone());
      const norm = normalizeModel(parts, GATE.radius * 2, 1.6, { fill: 1, maxScale: 1.2 });
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
  group.add(gatePicker);

  // ---------- sync from the save ----------
  let paletteKey = null;
  function sync(state) {
    const pal = regionPalette(state);
    if (paletteKey !== pal) {
      paletteKey = pal;
      mats.ground.color.setHex(pal.ground);
      mats.meadow.color.setHex(pal.ground).offsetHSL(0, .02, .06);
      mats.lockedMeadow.color.setHex(pal.ground).offsetHSL(0, -.12, -.06);
      mats.overgrown.color.setHex(pal.ground).offsetHSL(.01, .05, -.1);
    }
    const owned = ownedParcels(state);
    const round = state.player.round;
    for (const p of Object.values(PARCELS)) {
      const e = parcels[p.id];
      const isOwned = owned.includes(p.id);
      const roadClosed = p.road && !isRoadOpen(state, p.road);
      const st = isOwned ? 'owned' : round < p.round ? 'round' : roadClosed ? 'road' : 'sale';
      if (e.state !== st) {
        e.state = st;
        e.overlay.material = st === 'owned' ? (p.kind === 'farm' ? mats.tilled : mats.paved) : st === 'sale' ? mats.meadow : mats.lockedMeadow;
        e.sign.visible = st !== 'owned';
      }
      if (st === 'sale') e.label.set(t('realm.forSale', { price: formatNumber(p.cost) }));
      else if (st === 'round') e.label.set(t('realm.roundLocked', { n: p.round }));
      else if (st === 'road') e.label.set(t('realm.needsRoad'));
    }
    for (const id of ROAD_ORDER) {
      const road = ROADS[id], e = roads[id];
      const open = isRoadOpen(state, id);
      e.open.visible = open;
      e.closed.visible = !open;
      const label = e.closed.userData.label;
      if (!open && label) label.set(round < road.round ? t('realm.roundLocked', { n: road.round }) : t('realm.openRoad', { price: formatNumber(road.cost) }));
    }
    rebuildFences(owned);
  }

  function update(time) {
    const glow = gate.userData.glow;
    if (glow) glow.material.opacity = .55 + .25 * Math.sin(time * 2);
  }

  return {
    group, mats, gate, gatePicker, sync, update,
    parcelState: id => parcels[id]?.state || null,
    dispose() {
      for (const e of Object.values(parcels)) e.label.dispose();
      for (const e of Object.values(roads)) e.closed.userData.label?.dispose();
      fence.geometry.dispose();
      for (const d of disposables) d.dispose?.();
      group.removeFromParent();
    },
  };
}
