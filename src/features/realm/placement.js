// Placement preview: translucent ghost + footprint tiles (green = derive.placementError is null, red otherwise),
// snapping with derive.snapPosition. Placeables = buildings, decor and crop fields ('field', D.defOf). Unified land
// (Farm World 2.0): every owned lot of the current area is tinted — green where its terrain allows the type's use
// (layout.lotAllows(lot, D.useOf(type))), faint red where it does not. The ghost starts at the nearest valid spot near
// the player, else inside an owned lot that allows the use (meadow first). Confirm dispatches build/place|build/move.
import * as THREE from 'three';
import { BUILDINGS, FIELD, CELL } from '../../core/config/economy.js';
import { PARCELS, TUTORIAL_BUILD, areaOfParcel, rectCenter, lotAllows, farmGroundY, tierZoneAt } from '../../core/config/layout.js';
import { region as regionOf, placementError, placementWarning, snapPosition, footprint, defOf, useOf, buildCost } from '../../core/derive.js';
import { t, hasKey } from '../../i18n/index.js';
import { makeLabel } from './util.js';
import { makePrefab } from './buildings.js';
import { loadModel } from '../../shared/three/models.js';
import { plantScale } from './plots.js';

const GREEN = new THREE.Color(0x58d06a), RED = new THREE.Color(0xe5533f);
const TILE = 1; // footprint tiles: 1 m squares
// Enough 1 m tiles for the largest footprint of any placeable (never fewer than 128; no silent cap).
const TILE_CAP = Math.max(128, ...[...Object.values(BUILDINGS), FIELD].map(d => Math.ceil(d.size[0] * CELL / TILE) * Math.ceil(d.size[1] * CELL / TILE)));

export function createPlacement({ scene, prefabs, bedGhost = null }) {
  const group = new THREE.Group();
  group.name = 'realm-placement';
  group.visible = false;
  scene.add(group);

  // The footprint is ONE round patch (founder 2026-11-08): a green / red disc over a disc of bare earth, stretched to the
  // footprint (an ellipse for long things like the drying rack), so you can see where it will stand.
  const tileGeo = new THREE.RingGeometry(.93, 1, 64).rotateX(-Math.PI / 2); // one thin ring, shared look with the selection / alert rings
  const earth = { visible: false, position: { set() {} }, scale: { set() {} }, material: { dispose() {} } }; // (the extra earth disc is gone: one ring only)
  const tileMat = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: .55, depthWrite: false });
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, TILE_CAP);
  tiles.count = 0;
  tiles.raycast = () => {};
  tiles.renderOrder = 5;
  group.add(tiles);
  // Lot tints: one shared unit plane scaled per lot, two shared materials, pooled meshes (nothing allocated per start
  // once the pool has grown to the number of owned lots).
  const zoneGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const zoneOk = new THREE.MeshBasicMaterial({ color: 0x8af59a, transparent: true, opacity: .22, depthWrite: false });
  const zoneNo = new THREE.MeshBasicMaterial({ color: 0xe5533f, transparent: true, opacity: .1, depthWrite: false });
  const zones = []; // pooled meshes
  let fieldPrefab = null; // ghost source for 'field' when the realm has no prefabs.field (made once, freed on dispose)
  const prefabFor = type => prefabs[type] || (type === 'field' ? (fieldPrefab ||= makePrefab('field')) : null);
  const ghostMats = new Map(); // original material → translucent clone
  // Short hint under the ghost: "Drag to move · tap ✓ to build", or why it cannot stand here.
  const hint = makeLabel('', { bg: '#fff8e8', fg: '#5a3a1c', border: '#c99a5e', height: .55, onTop: true });
  hint.sprite.visible = false;
  group.add(hint.sprite);
  let ghost = null;
  // A building's frame: a thin rounded rectangle hugging the model's REAL extent with the same padding on all four sides (the
  // model is centred in it). Plants keep the small round ring; real-size trees use the footprint ring.
  let ringRect = null;
  const RING_PAD = .4;
  const rr = (s, x, z, r) => { s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r); s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z); s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z); };
  function rectRingGeo(hx, hz, r = .4) {
    const shape = new THREE.Shape(); rr(shape, hx + .06, hz + .06, r);
    const hole = new THREE.Path(); rr(hole, hx, hz, Math.max(.05, r - .06)); shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  }
  // What a plant is sown on: the real bed (soil mound + worn red earth, plots.makeBedGhost) shown faded, so the preview is the
  // field as it will look. Its materials join ghostMats, which fades them with the pulse and frees them on cancel.
  let bed = null;
  function setBed(on) {
    if (bed) { for (const m of bed.mats) { ghostMats.delete(m); m.dispose(); } bed.group.removeFromParent(); bed = null; }
    if (!on || !bedGhost) return;
    bed = bedGhost('lowland');
    group.add(bed.group);
    for (const m of bed.mats) ghostMats.set(m, m);
  }
  function measureRing(type) {
    ringRect?.geo.dispose(); ringRect = null;
    setBed(type === 'field');
    if (type === 'field') { // a plant: a rounded frame round its faded bed (it shows whether the spot is free)
      ringRect = { hx: .84, hz: .7, ox: 0, oz: 0, geo: rectRingGeo(.84, .7, .32) };
      return;
    }
    if (!ghost) return;
    ghost.position.set(0, 0, 0); ghost.rotation.set(0, 0, 0); ghost.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(ghost);
    if (!Number.isFinite(b.min.x)) return;
    const cap = defOf(type)?.trueScale ? 2.2 : Infinity; // big crowns (trees): the frame stays a sane size
    const hx = Math.min(cap, (b.max.x - b.min.x) / 2) + RING_PAD, hz = Math.min(cap, (b.max.z - b.min.z) / 2) + RING_PAD;
    ringRect = { hx, hz, ox: (b.max.x + b.min.x) / 2, oz: (b.max.z + b.min.z) / 2, geo: rectRingGeo(hx, hz) };
  }
  // The plant being sown / moved: its real model, translucent, following the ring (a seedling, a young tree or a full tree).
  let plantGhost = null, plantSpec = null, plantToken = 0;
  const PLANT_FILE = { arabica: 'gedeo', robusta: 'gedeo', liberica: 'liberica' };
  function setPlantGhost(spec) {
    plantToken++;
    if (plantGhost) { plantGhost.removeFromParent(); plantGhost = null; }
    plantSpec = spec || null;
    if (!spec) return;
    const token = plantToken, sp = PLANT_FILE[spec.crop] ? spec.crop : 'arabica';
    const path = spec.stage === 'seedling' ? 'farm/coffee-stages-gedeo.glb#seedling' : spec.stage === 'young' ? 'farm/coffee-stages-gedeo.glb#young' : `farm/coffee-tree-${PLANT_FILE[sp]}.glb#tree`;
    loadModel(path).then(m => {
      if (!m || token !== plantToken || !info) return;
      // size the translucent plant by its real height (the raw model's units vary): seedling .6 m, young 1.4 m, tree ~2.6 m
      const { w, h } = plantScale(spec.crop, spec.stage), box0 = new THREE.Box3().setFromObject(m), h0 = box0.max.y - box0.min.y || 1;
      const want = spec.stage === 'seedling' ? .6 : spec.stage === 'young' ? 1.4 : 2.6 * (h / Math.max(.01, w) || 1) * .45;
      const k = Math.min(want / h0, 6);
      m.scale.multiplyScalar(k);
      m.traverse(o => { if (!o.isMesh) return; o.castShadow = false; o.raycast = () => {}; o.material = [o.material].flat().map(mat => { const c = mat.clone(); c.transparent = true; c.opacity = .65; c.depthWrite = false; ghostMats.set(c, c); return c; }); if (o.material.length === 1) o.material = o.material[0]; });
      plantGhost = new THREE.Group(); plantGhost.add(m); group.add(plantGhost);
      plantGhost.position.set(info.x, farmGroundY(info.x, info.z), info.z);
    });
  }
  let info = null; // { type, uid, x, z, rot, valid, error }
  let getState = () => null;
  const m4 = new THREE.Matrix4();

  function ghostOf(type) {
    const g = prefabFor(type).clone();
    g.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.raycast = () => {};
      o.material = [o.material].flat().map(mat => {
        if (!ghostMats.has(mat)) {
          const c = mat.clone();
          c.transparent = true; c.opacity = .6; c.depthWrite = false;
          ghostMats.set(mat, c);
        }
        return ghostMats.get(mat);
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    return g;
  }

  function refresh() {
    if (!info) return;
    const state = getState();
    const pos = snapPosition(info.type, info.x, info.z, info.rot);
    info.x = pos.x; info.z = pos.z;
    info.error = state ? placementError(state, info.type, info.x, info.z, info.rot, info.uid) : 'unknown';
    info.warn = state && !info.error ? placementWarning(state, info.type, info.x, info.z, info.rot) : null;
    info.valid = info.error === null;
    // On fields: how many fields sit under the ghost (a 4×4 m building needs several 3×3 m fields cleared).
    info.fieldsUnder = 0;
    if (info.error === 'onField' && state) {
      const q = footprint(info.type, info.x, info.z, info.rot);
      for (const f of regionOf(state)?.fields || []) {
        if (f.id === info.uid) continue;
        const r = footprint('field', f.x, f.z);
        if (r[0] < q[2] - 1e-6 && r[2] > q[0] + 1e-6 && r[1] < q[3] - 1e-6 && r[3] > q[1] + 1e-6) info.fieldsUnder++;
      }
    }
    ghost.position.set(info.x, farmGroundY(info.x, info.z), info.z);
    ghost.rotation.y = -info.rot * Math.PI / 2;
    const fp = footprint(info.type, info.x, info.z, info.rot);
    const cx = (fp[0] + fp[2]) / 2, cz = (fp[1] + fp[3]) / 2, one = info.type === 'field'; // a plant uses the plain small ring
    const rx = one ? .47 : (fp[2] - fp[0]) / 2, rz = one ? .47 : (fp[3] - fp[1]) / 2;
    const gy = farmGroundY(cx, cz);
    if (ringRect) { tiles.geometry = ringRect.geo; m4.compose(new THREE.Vector3(info.x + ringRect.ox, farmGroundY(info.x, info.z) + .06, info.z + ringRect.oz), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); }
    else { tiles.geometry = tileGeo; m4.compose(new THREE.Vector3(cx, gy + .06, cz), new THREE.Quaternion(), new THREE.Vector3(rx * 1.02, 1, rz * 1.02)); }
    if (bed) { bed.setZone(tierZoneAt(info.x, info.z)); bed.group.position.set(info.x, farmGroundY(info.x, info.z) + .01, info.z); }
    tiles.setMatrixAt(0, m4);
    tiles.count = 1;
    tiles.instanceMatrix.needsUpdate = true;
    tiles.computeBoundingSphere(); // three computes it lazily only once: keep it on the ghost or the disc gets culled
    earth.position.set(cx, gy + .045, cz); earth.scale.set(rx * 1.18, 1, rz * 1.18); earth.visible = true;
    ghost.visible = info.type !== 'field'; // a plant shows its own translucent tree (plantGhost), not the old bed
    if (plantGhost) plantGhost.position.set(info.x, farmGroundY(info.x, info.z), info.z);
    tileMat.color.copy(info.valid ? GREEN : RED);
    const why = info.valid ? t('realm.place.hint') : info.noRoom ? t(info.noRoom) : hasKey(`err.${info.error}`) ? t(`err.${info.error}`) : '';
    hint.set(why);
    hint.sprite.visible = false; // the HUD's ✓ ↻ ✕ buttons + reason follow the ghost now (hud/placement.js)
    hint.sprite.position.set(info.x, .35 + farmGroundY(info.x, info.z), fp[3] + .7);
  }

  // area: 'farm' | 'cafe' — the view the preview runs in; the start spot is an owned parcel of that area.
  // Nearest valid spot to (x, z): 1 m spiral rings up to 24 m.
  function nearestValid(state, type, x, z, max = 24) {
    for (let r = 0; r <= max; r++) {
      const n = Math.max(1, r * 8);
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const p = snapPosition(type, x + Math.cos(a) * r, z + Math.sin(a) * r, 0);
        if (placementError(state, type, p.x, p.z, 0) === null) return { ...p, rot: 0 };
      }
    }
    return null;
  }
  // First valid spot of one lot in raster order starting from the lot corner nearest `from` (0.5 m steps).
  function packedSpot(state, type, lot, from) {
    const [x0, z0, x1, z1] = lot.rect;
    const fp = footprint(type, 0, 0, 0), hw = (fp[2] - fp[0]) / 2, hd = (fp[3] - fp[1]) / 2;
    const xs = [], zs = [];
    for (let x = x0 + hw; x <= x1 - hw + 1e-6; x += .5) xs.push(x);
    for (let z = z0 + hd; z <= z1 - hd + 1e-6; z += .5) zs.push(z);
    if (Math.abs(from.x - x0) > Math.abs(from.x - x1)) xs.reverse();
    if (Math.abs(from.z - z0) > Math.abs(from.z - z1)) zs.reverse();
    for (const z of zs) for (const x of xs) {
      const p = snapPosition(type, x, z, 0);
      if (placementError(state, type, p.x, p.z, 0) === null) return { ...p, rot: 0 };
    }
    return null;
  }
  function initialPosition(state, type, uid, area, near) {
    const r = regionOf(state);
    if (uid && type === 'field') {
      const f = (r?.fields || []).find(v => v.id === uid);
      if (f) return { x: f.x, z: f.z, rot: 0 };
    }
    const b = uid ? r?.buildings.find(v => v.uid === uid) : null;
    if (b) return { x: b.x, z: b.z, rot: b.rot || 0 };
    if (area === 'farm') {
      // A free spot right where the player is / tapped (4 m), else the owned lots that allow the use, nearest first,
      // each scanned from its corner nearest the player so buildings pack against an edge (dropping one in the middle of
      // the 8 × 8 m yard left no room for a field). Nothing free anywhere → the red ghost stays where the player is.
      const use = useOf(type);
      const from = near || { x: 0, z: 18 };
      const d2 = lot => { const c = rectCenter(lot.rect); return (c.x - from.x) ** 2 + (c.z - from.z) ** 2; };
      const lots = (r?.parcels || []).map(id => PARCELS[id])
        .filter(p => p && areaOfParcel(p.id) === 'farm' && lotAllows(p.id, use))
        .sort((a, b) => d2(a) - d2(b));
      const near0 = near && nearestValid(state, type, near.x, near.z, 4);
      if (near0) return near0;
      for (const lot of lots) { const found = packedSpot(state, type, lot, from); if (found) return found; }
      const at = near ? snapPosition(type, near.x, near.z, 0) : lots[0] ? rectCenter(lots[0].rect) : { x: 16, z: 15.5 };
      return { x: at.x, z: at.z, rot: 0, noRoom: 'realm.place.noRoomFarm' };
    }
    // Café: the nearest valid spot from the tutorial spot (beside the counters) / the player; none → red at that spot.
    const from = TUTORIAL_BUILD[type] || TUTORIAL_BUILD.roaster;
    const found = (near && nearestValid(state, type, near.x, near.z)) || nearestValid(state, type, from.x, from.z);
    if (found) return TUTORIAL_BUILD[type] && placementError(state, type, from.x, from.z, 0) === null ? { ...from, rot: 0 } : found;
    return { ...from, rot: 0, noRoom: 'realm.place.noRoom' };
  }

  function clearZones() { for (const z of zones) z.visible = false; }
  // Tint every owned lot of `area`: green where the type's use is allowed, faint red where it is not.
  function showZones(state, type, area) {
    const use = useOf(type);
    let n = 0;
    for (const id of regionOf(state)?.parcels || []) {
      const pr = PARCELS[id];
      if (!pr || areaOfParcel(id) !== area) continue;
      let mesh = zones[n];
      if (!mesh) {
        mesh = zones[n] = new THREE.Mesh(zoneGeo, zoneOk);
        mesh.raycast = () => {};
        group.add(mesh);
      }
      n++;
      const [x0, z0, x1, z1] = pr.rect;
      mesh.material = lotAllows(id, use) ? zoneOk : zoneNo;
      mesh.scale.set(x1 - x0, 1, z1 - z0);
      mesh.position.set((x0 + x1) / 2, .03 + farmGroundY((x0 + x1) / 2, (z0 + z1) / 2), (z0 + z1) / 2);
      mesh.visible = true;
    }
    for (let i = n; i < zones.length; i++) zones[i].visible = false;
  }

  return {
    /** { type, uid, x, z, rot, valid, error, noRoom, cost } — cost = D.buildCost for a new placement, 0 for a move. */
    get info() { return info; },
    /** type: a building type or 'field'. Moving: uid = the building uid, or the field id for a field. */
    start(type, { uid = null, area = 'farm', near = null } = {}, stateGetter) {
      this.cancel();
      if (!defOf(type) || !prefabFor(type)) return null;
      getState = stateGetter;
      const state = getState();
      const p = initialPosition(state, type, uid, area, near);
      const cost = uid ? 0 : state ? buildCost(state, type) : 0;
      info = { type, uid, x: p.x, z: p.z, rot: type === 'field' ? 0 : p.rot, valid: false, error: null, noRoom: p.noRoom || null, cost };
      ghost = ghostOf(type);
      group.add(ghost);
      measureRing(type);
      // no lot zones any more: you can build anywhere on your land
      group.visible = true;
      refresh();
      return info;
    },
    moveTo(x, z) { if (!info) return; info.x = x; info.z = z; info.noRoom = null; refresh(); },
    rotate() { if (!info || info.type === 'field') return; info.rot = (info.rot + 1) % 4; refresh(); }, // fields never rotate
    refresh,
    setPlantGhost,
    /** Dispatches the placement; ends the preview on success. */
    confirm(dispatch) {
      if (!info) return { ok: false, error: 'unknown' };
      refresh();
      const { type, uid, x, z } = info;
      const rot = type === 'field' ? 0 : info.rot;
      const result = uid ? dispatch('build/move', { uid, x, z, rot }) : dispatch('build/place', { type, x, z, rot });
      if (result.ok) this.cancel();
      return result;
    },
    cancel() {
      setBed(false);
      if (ghost) { ghost.removeFromParent(); ghost = null; }
      for (const m of ghostMats.values()) m.dispose();
      ghostMats.clear();
      clearZones();
      tiles.count = 0; earth.visible = false; ringRect?.geo.dispose(); ringRect = null;
      setPlantGhost(null);
      hint.sprite.visible = false;
      group.visible = false;
      info = null;
    },
    update(time) {
      if (!info) return;
      const a = .7 + .08 * Math.sin(time * 4); // translucent ghost (~70 %, easier to read) with a slight pulse
      for (const m of ghostMats.values()) m.opacity = a;
      tileMat.opacity = a + .1;
    },
    dispose() {
      this.cancel();
      hint.dispose(); tileGeo.dispose(); tileMat.dispose(); tiles.dispose(); earth.material.dispose();
      for (const z of zones) z.removeFromParent();
      zones.length = 0;
      zoneGeo.dispose(); zoneOk.dispose(); zoneNo.dispose();
      fieldPrefab?.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); // its material is the shared propMaterial
      fieldPrefab = null;
      group.removeFromParent();
    },
  };
}
