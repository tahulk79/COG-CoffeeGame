// Draws only the part of the map near the view. Forest, scrub, rocks and tier walls are whole-map InstancedMeshes: one bounding
// sphere each, so a single tree on screen used to send every tree of the map to the GPU. Here each set keeps its full list on the
// CPU and its GPU list holds only the instances near the camera. Still one draw call per set (no chunking).
// A set opts in with mesh.userData.cullable = true; whoever rewrites its instances later sets mesh.userData.cullDirty = true.
import * as THREE from 'three';

const MOVE = 3, TURN = .9995;      // the lists are rebuilt only after the camera moved this far (m) or turned this much (dot)
const SLACK = MOVE + 1;            // ...so every instance is padded by that movement
const RESCAN_MS = 2000;            // models load in the background: look for new sets now and then

export function createInstanceCull(root) {
  const sets = [], known = new Set();
  const frustum = new THREE.Frustum(), viewProj = new THREE.Matrix4(), m = new THREE.Matrix4(), c = new THREE.Vector3();
  const lastPos = new THREE.Vector3(), lastDir = new THREE.Vector3(), dir = new THREE.Vector3();
  let nextScan = 0, stale = true, lastAspect = 0, lastFov = 0, lastMax = 0;

  function snapshot(set) {
    const { mesh } = set, n = mesh.count, g = mesh.geometry;
    mesh.userData.cullDirty = false;
    g.boundingSphere || g.computeBoundingSphere();
    mesh.computeBoundingSphere(); // of the whole set, while the GPU list is still complete
    mesh.updateWorldMatrix(true, false);
    set.n = n;
    set.src = mesh.instanceMatrix.array.slice(0, n * 16);
    set.col = mesh.instanceColor ? mesh.instanceColor.array.slice(0, n * 3) : null;
    set.bounds = new Float32Array(n * 4);
    set.on = new Uint8Array(n).fill(1); // matches the complete list just read
    for (let i = 0; i < n; i++) {
      m.fromArray(set.src, i * 16).premultiply(mesh.matrixWorld);
      c.copy(g.boundingSphere.center).applyMatrix4(m);
      const r = g.boundingSphere.radius * m.getMaxScaleOnAxis();
      set.bounds[i * 4] = c.x; set.bounds[i * 4 + 1] = c.y; set.bounds[i * 4 + 2] = c.z;
      set.bounds[i * 4 + 3] = r + SLACK;
    }
    stale = true;
  }

  function cullSet(set, camera, maxDepth) {
    const { mesh, n, src, col, bounds, on } = set, planes = frustum.planes;
    let changed = false;
    for (let i = 0; i < n; i++) {
      const x = bounds[i * 4], y = bounds[i * 4 + 1], z = bounds[i * 4 + 2], pad = bounds[i * 4 + 3];
      let v = (x - camera.position.x) * dir.x + (y - camera.position.y) * dir.y + (z - camera.position.z) * dir.z < maxDepth + pad ? 1 : 0; // beyond the fog: invisible anyway
      for (let p = 0; p < 6 && v; p++) { const pl = planes[p]; if (pl.normal.x * x + pl.normal.y * y + pl.normal.z * z + pl.constant < -pad) v = 0; }
      if (v !== on[i]) { on[i] = v; changed = true; }
    }
    if (!changed) return false;
    const a = mesh.instanceMatrix.array, ac = mesh.instanceColor?.array;
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      for (let e = 0, s = i * 16, d = k * 16; e < 16; e++) a[d + e] = src[s + e];
      if (col && ac) { ac[k * 3] = col[i * 3]; ac[k * 3 + 1] = col[i * 3 + 1]; ac[k * 3 + 2] = col[i * 3 + 2]; }
      k++;
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    if (ac) mesh.instanceColor.needsUpdate = true;
    return true;
  }

  /** Call once per frame after the camera moved. maxDepth = depth where the fog is total. True when a GPU list changed. */
  return function update(camera, maxDepth = Infinity, force = false) {
    const now = performance.now();
    if (now >= nextScan) {
      nextScan = now + RESCAN_MS;
      root.traverse(o => { if (o.isInstancedMesh && o.userData.cullable && !known.has(o)) { known.add(o); sets.push({ mesh: o }); o.userData.cullDirty = true; } });
    }
    for (let i = 0; i < sets.length; i++) if (sets[i].mesh.userData.cullDirty) snapshot(sets[i]);
    camera.updateMatrixWorld();
    camera.getWorldDirection(dir);
    if (!force && !stale && camera.aspect === lastAspect && camera.fov === lastFov && Math.abs(maxDepth - lastMax) < MOVE && lastPos.distanceToSquared(camera.position) < MOVE * MOVE && lastDir.dot(dir) > TURN) return false;
    stale = false; lastAspect = camera.aspect; lastFov = camera.fov; lastMax = maxDepth;
    lastPos.copy(camera.position); lastDir.copy(dir);
    frustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let any = false;
    for (let i = 0; i < sets.length; i++) if (cullSet(sets[i], camera, maxDepth)) any = true;
    return any;
  };
}
