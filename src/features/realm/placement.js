// Placement preview: translucent ghost + footprint tiles (green = derive.placementError is null, red otherwise),
// snapping with derive.snapPosition. Café: valid-zone tint on owned café lots. Farm: buildings go on FREE GRASS (not
// fields / roads / gate plaza): a faint tint over the farm grass and the ghost starts at the nearest valid spot near
// the player (spiral search). Confirm dispatches build/place|build/move.
import * as THREE from 'three';
import { BUILDINGS, CELL } from '../../core/config/economy.js';
import { PARCELS, TUTORIAL_BUILD, BOUNDS, areaOfParcel } from '../../core/config/layout.js';
import { region as regionOf, placementError, snapPosition, footprint } from '../../core/derive.js';
import { t, hasKey } from '../../i18n/index.js';
import { makeLabel } from './util.js';

const ZONE_KINDS = { farm: ['build'], shop: ['shop'], any: ['build', 'shop'] };
const GREEN = new THREE.Color(0x58d06a), RED = new THREE.Color(0xe5533f);

export function createPlacement({ scene, prefabs }) {
  const group = new THREE.Group();
  group.name = 'realm-placement';
  group.visible = false;
  scene.add(group);

  const tileGeo = new THREE.PlaneGeometry(CELL - .14, CELL - .14).rotateX(-Math.PI / 2);
  const tileMat = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: .55, depthWrite: false });
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, 4);
  tiles.count = 0;
  tiles.raycast = () => {};
  tiles.renderOrder = 5;
  group.add(tiles);
  const zoneMat = new THREE.MeshBasicMaterial({ color: 0x8af59a, transparent: true, opacity: .22, depthWrite: false });
  const zones = [];
  const ghostMats = new Map(); // original material → translucent clone
  // Short hint under the ghost: "Drag to move · tap ✓ to build", or why it cannot stand here.
  const hint = makeLabel('', { bg: '#fff8e8', fg: '#5a3a1c', border: '#c99a5e', height: .55, onTop: true });
  hint.sprite.visible = false;
  group.add(hint.sprite);
  let ghost = null;
  let info = null; // { type, uid, x, z, rot, valid, error }
  let getState = () => null;
  const m4 = new THREE.Matrix4();

  function ghostOf(type) {
    const g = prefabs[type].clone();
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
    info.valid = info.error === null;
    ghost.position.set(info.x, 0, info.z);
    ghost.rotation.y = -info.rot * Math.PI / 2;
    // One tile per footprint cell.
    const fp = footprint(info.type, info.x, info.z, info.rot);
    let n = 0;
    for (let x = fp[0] + CELL / 2; x < fp[2]; x += CELL) for (let z = fp[1] + CELL / 2; z < fp[3]; z += CELL) {
      if (n >= 4) break;
      m4.makeTranslation(x, .05, z);
      tiles.setMatrixAt(n++, m4);
    }
    tiles.count = n;
    tiles.instanceMatrix.needsUpdate = true;
    tileMat.color.copy(info.valid ? GREEN : RED);
    const why = info.valid ? t('realm.place.hint') : info.noRoom ? t(info.noRoom) : hasKey(`err.${info.error}`) ? t(`err.${info.error}`) : '';
    hint.set(why);
    hint.sprite.visible = !!why;
    hint.sprite.position.set(info.x, .35, fp[3] + .7);
  }

  // area: 'farm' | 'cafe' — the view the preview runs in; the start spot is an owned parcel of that area.
  // Nearest valid spot to (x, z): 1 m spiral rings up to 24 m.
  function nearestValid(state, type, x, z) {
    for (let r = 0; r <= 24; r++) {
      const n = Math.max(1, r * 8);
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const p = snapPosition(type, x + Math.cos(a) * r, z + Math.sin(a) * r, 0);
        if (placementError(state, type, p.x, p.z, 0) === null) return { ...p, rot: 0 };
      }
    }
    return null;
  }
  function initialPosition(state, type, uid, area, near) {
    const r = regionOf(state);
    const b = uid ? r?.buildings.find(v => v.uid === uid) : null;
    if (b) return { x: b.x, z: b.z, rot: b.rot || 0 };
    if (area === 'farm') return nearestValid(state, type, near?.x ?? 9, near?.z ?? 10) || { x: near?.x ?? 9, z: near?.z ?? 10, rot: 0, noRoom: 'realm.place.noRoomFarm' };
    // Café: the nearest valid spot from the tutorial spot (beside the counters) / the player; none → red at that spot.
    const from = TUTORIAL_BUILD[type] || TUTORIAL_BUILD.roaster;
    const found = (near && nearestValid(state, type, near.x, near.z)) || nearestValid(state, type, from.x, from.z);
    if (found) return TUTORIAL_BUILD[type] && placementError(state, type, from.x, from.z, 0) === null ? { ...from, rot: 0 } : found;
    return { ...from, rot: 0, noRoom: 'realm.place.noRoom' };
  }

  function clearZones() { for (const z of zones) { z.geometry.dispose(); z.removeFromParent(); } zones.length = 0; }

  return {
    get info() { return info; },
    start(type, { uid = null, area = 'farm', near = null } = {}, stateGetter) {
      this.cancel();
      if (!BUILDINGS[type] || !prefabs[type]) return null;
      getState = stateGetter;
      const state = getState();
      const p = initialPosition(state, type, uid, area, near);
      info = { type, uid, x: p.x, z: p.z, rot: p.rot, valid: false, error: null, noRoom: p.noRoom || null };
      ghost = ghostOf(type);
      group.add(ghost);
      // Farm: free grass is the valid zone (a faint tint over the farm; fields / roads draw on top of it).
      if (area === 'farm') {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX - 2, BOUNDS.maxZ - BOUNDS.minZ - 2).rotateX(-Math.PI / 2), zoneMat);
        mesh.position.set((BOUNDS.minX + BOUNDS.maxX) / 2, .008, (BOUNDS.minZ + BOUNDS.maxZ) / 2);
        mesh.raycast = () => {};
        group.add(mesh);
        zones.push(mesh);
      }
      // Café: tint the owned lots where this building may stand.
      const kinds = area === 'farm' ? [] : ZONE_KINDS[BUILDINGS[type].zone] || ['shop'];
      for (const id of regionOf(state)?.parcels || []) {
        const pr = PARCELS[id];
        if (!pr || !kinds.includes(pr.kind) || areaOfParcel(id) !== area) continue;
        const [x0, z0, x1, z1] = pr.rect;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), zoneMat);
        mesh.position.set((x0 + x1) / 2, .03, (z0 + z1) / 2);
        mesh.raycast = () => {};
        group.add(mesh);
        zones.push(mesh);
      }
      group.visible = true;
      refresh();
      return info;
    },
    moveTo(x, z) { if (!info) return; info.x = x; info.z = z; info.noRoom = null; refresh(); },
    rotate() { if (!info) return; info.rot = (info.rot + 1) % 4; refresh(); },
    refresh,
    /** Dispatches the placement; ends the preview on success. */
    confirm(dispatch) {
      if (!info) return { ok: false, error: 'unknown' };
      refresh();
      const { type, uid, x, z, rot } = info;
      const result = uid ? dispatch('build/move', { uid, x, z, rot }) : dispatch('build/place', { type, x, z, rot });
      if (result.ok) this.cancel();
      return result;
    },
    cancel() {
      if (ghost) { ghost.removeFromParent(); ghost = null; }
      for (const m of ghostMats.values()) m.dispose();
      ghostMats.clear();
      clearZones();
      tiles.count = 0;
      hint.sprite.visible = false;
      group.visible = false;
      info = null;
    },
    update(time) {
      if (!info) return;
      const a = .45 + .1 * Math.sin(time * 4); // translucent ghost (~45 %) with a slight pulse
      for (const m of ghostMats.values()) m.opacity = a;
      tileMat.opacity = a + .1;
    },
    dispose() { this.cancel(); hint.dispose(); tileGeo.dispose(); tileMat.dispose(); zoneMat.dispose(); tiles.dispose(); group.removeFromParent(); },
  };
}
