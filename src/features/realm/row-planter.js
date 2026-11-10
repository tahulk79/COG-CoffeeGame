// The row being drawn while planting (one pooled set of meshes, no allocation per move): a strip of soil along the line, a disc
// under every spot (green = it will be planted, red = it will not) and a small sprout on the green ones. plan = derive.rowPlan.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLANT_ROW } from '../../core/config/economy.js';
import { farmGroundY } from '../../core/config/layout.js';
import { paint } from './util.js';

const OK = new THREE.Color(0x58d06a), NO = new THREE.Color(0xe5533f);

export function createRowPlanter({ scene }) {
  const group = new THREE.Group();
  group.name = 'realm-row-planter';
  group.visible = false;
  scene.add(group);
  const cap = PLANT_ROW.maxSpots;
  const stripGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x8a5a36, transparent: true, opacity: .42, depthWrite: false });
  const strip = new THREE.Mesh(stripGeo, stripMat);
  const discGeo = new THREE.CircleGeometry(.62, 20).rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .62, depthWrite: false });
  const discs = new THREE.InstancedMesh(discGeo, discMat, cap);
  const parts = [paint(new THREE.CylinderGeometry(.035, .05, .5, 6).translate(0, .25, 0), '#5c8a3a')];
  for (const a of [0, 2.1, 4.2]) parts.push(paint(new THREE.IcosahedronGeometry(.17, 0).scale(1.5, .45, .8).translate(.2, 0, 0).rotateY(a).translate(0, .5, 0), '#6fbf4a'));
  const sproutGeo = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  const sproutMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .85 });
  const sprouts = new THREE.InstancedMesh(sproutGeo, sproutMat, cap);
  for (const o of [strip, discs, sprouts]) { o.frustumCulled = false; o.raycast = () => {}; o.renderOrder = 5; group.add(o); }
  discs.count = sprouts.count = 0;
  const m4 = new THREE.Matrix4();

  function clear() { group.visible = false; discs.count = sprouts.count = 0; }
  function set(plan) {
    const spots = plan?.spots || [];
    if (!spots.length) { clear(); return; }
    let n = 0;
    for (let i = 0; i < spots.length && i < cap; i++) {
      const p = spots[i], y = farmGroundY(p.x, p.z);
      discs.setMatrixAt(i, m4.makeTranslation(p.x, y + .07, p.z));
      discs.setColorAt(i, p.error ? NO : OK);
      if (!p.error) sprouts.setMatrixAt(n++, m4.makeTranslation(p.x, y + .04, p.z));
    }
    discs.count = Math.min(cap, spots.length); sprouts.count = n;
    discs.instanceMatrix.needsUpdate = sprouts.instanceMatrix.needsUpdate = true;
    if (discs.instanceColor) discs.instanceColor.needsUpdate = true;
    const rows = plan.rows || 1, a = spots[0], b = spots[Math.max(0, (plan.count || spots.length) - 1)], len = Math.hypot(b.x - a.x, b.z - a.z);
    strip.position.set((a.x + b.x) / 2, farmGroundY(a.x, a.z) + .05, (a.z + b.z) / 2);
    strip.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    strip.scale.set(len + 1.5, 1, 1.5 * rows);
    group.visible = true;
  }
  return {
    set, clear,
    dispose() { clear(); stripGeo.dispose(); stripMat.dispose(); discGeo.dispose(); discMat.dispose(); discs.dispose(); sproutGeo.dispose(); sproutMat.dispose(); sprouts.dispose(); group.removeFromParent(); },
  };
}
