// Placement preview: translucent ghost + footprint tiles (green = derive.placementError is null, red otherwise),
// valid-zone tint on owned build/shop parcels, snapping with derive.snapPosition. Confirm dispatches build/place|build/move.
import * as THREE from 'three';
import { BUILDINGS, CELL } from '../../core/config/economy.js';
import { PARCELS, TUTORIAL_BUILD, rectCenter } from '../../core/config/layout.js';
import { region as regionOf, placementError, snapPosition, footprint } from '../../core/derive.js';

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
  }

  function initialPosition(state, type, uid) {
    const r = regionOf(state);
    const b = uid ? r?.buildings.find(v => v.uid === uid) : null;
    if (b) return { x: b.x, z: b.z, rot: b.rot || 0 };
    if (TUTORIAL_BUILD[type]) return { ...TUTORIAL_BUILD[type], rot: 0 };
    const kinds = ZONE_KINDS[BUILDINGS[type].zone] || [];
    const owned = r?.parcels || [];
    const parcel = Object.values(PARCELS).find(p => kinds.includes(p.kind) && owned.includes(p.id));
    return parcel ? { ...rectCenter(parcel.rect), rot: 0 } : { x: 9, z: -5, rot: 0 };
  }

  function clearZones() { for (const z of zones) { z.geometry.dispose(); z.removeFromParent(); } zones.length = 0; }

  return {
    get info() { return info; },
    start(type, { uid = null } = {}, stateGetter) {
      this.cancel();
      if (!BUILDINGS[type] || !prefabs[type]) return null;
      getState = stateGetter;
      const state = getState();
      const p = initialPosition(state, type, uid);
      info = { type, uid, x: p.x, z: p.z, rot: p.rot, valid: false, error: null };
      ghost = ghostOf(type);
      group.add(ghost);
      // Tint the parcels where this building may stand.
      const kinds = ZONE_KINDS[BUILDINGS[type].zone] || [];
      for (const id of regionOf(state)?.parcels || []) {
        const pr = PARCELS[id];
        if (!pr || !kinds.includes(pr.kind)) continue;
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
    moveTo(x, z) { if (!info) return; info.x = x; info.z = z; refresh(); },
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
      group.visible = false;
      info = null;
    },
    update(time) {
      if (!info) return;
      const a = .45 + .15 * Math.sin(time * 5);
      for (const m of ghostMats.values()) m.opacity = a + .15;
      tileMat.opacity = a + .1;
    },
    dispose() { this.cancel(); tileGeo.dispose(); tileMat.dispose(); zoneMat.dispose(); tiles.dispose(); group.removeFromParent(); },
  };
}
