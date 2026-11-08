// Tall farm fence all round the map edge (the 4 sides, founder 2026-11-08) with CLOSED gates where the roads leave it.
// Purely visual: no raycast, no collision.
import * as THREE from 'three';
import { farmGroundY, BOUNDS, TIER_EDGES, TIER_CUTS, WALL_T, tierEdgeZ, ESTATE_ORDER } from '../../core/config/layout.js';
import { estateOwned } from '../../core/derive.js';

const POST_H = 2.1, RAIL_YS = [.55, 1.15, 1.75], STEP = 2.2, INSET = -1.5; // post spacing; negative = the fence stands this far OUTSIDE the map edge
const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: .95, flatShading: true });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x5e3b20, roughness: .95, flatShading: true });
const iron = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: .6, metalness: .6 });

export function createMapFence({ parent }) {
  const group = new THREE.Group();
  group.name = 'map-fence';
  parent.add(group);
  const postGeo = new THREE.BoxGeometry(.2, POST_H, .2).translate(0, POST_H / 2 - .1, 0);
  const railGeo = new THREE.BoxGeometry(1, .12, .08); // stretched per span
  const gateGeos = [];
  let built = false;
  let live = [];

  function clear() {
    for (const o of live) { o.removeFromParent(); o.traverse?.(c => { if (c.isInstancedMesh) c.dispose(); }); }
    live = [];
    for (const g of gateGeos.splice(0)) g.dispose();
  }

  function closedGate(x, z, width, yaw) {
    const g = new THREE.Group();
    g.position.set(x, farmGroundY(x, z), z);
    const half = width / 2, leaf = (cx) => {
      const lw = half - .08;
      const l = new THREE.Group(); l.position.x = cx;
      const frame = (geo, m, px, py) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, 0); o.castShadow = true; o.raycast = () => {}; gateGeos.push(geo); l.add(o); };
      frame(new THREE.BoxGeometry(lw, .14, .1), wood, 0, .5); frame(new THREE.BoxGeometry(lw, .14, .1), wood, 0, 1.7);
      frame(new THREE.BoxGeometry(.14, 1.4, .1), wood, -lw / 2 + .07, 1.1); frame(new THREE.BoxGeometry(.14, 1.4, .1), wood, lw / 2 - .07, 1.1);
      const brace = new THREE.BoxGeometry(Math.hypot(lw, 1.2), .12, .08);
      const b = new THREE.Mesh(brace, darkWood); b.position.set(0, 1.1, 0); b.rotation.z = Math.atan2(1.2, lw) * (cx < 0 ? 1 : -1); b.raycast = () => {}; gateGeos.push(brace); l.add(b);
      return l;
    };
    g.add(leaf(-half / 2), leaf(half / 2));
    for (const sx of [-half, half]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.3, POST_H + .5, .3).translate(0, (POST_H + .5) / 2 - .1, 0), darkWood); p.position.x = sx; p.castShadow = true; p.raycast = () => {}; gateGeos.push(p.geometry); g.add(p); }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(.22, .26, .1), iron); lock.position.set(0, 1.05, .08); lock.raycast = () => {}; gateGeos.push(lock.geometry); g.add(lock);
    g.rotation.y = yaw;
    return g;
  }

  const GATE_W = 3.6;
  // The 4 sides as [x0, z0, x1, z1]; gates (closed) where the roads leave the map: south (the farm road), north (the
  // spine), west and east (the main road).
  const x0 = BOUNDS.minX + INSET, x1 = BOUNDS.maxX - INSET, z0 = BOUNDS.minZ + INSET, z1 = BOUNDS.maxZ - INSET;
  const SIDES = [[x0, z1, x1, z1, 'S'], [x1, z1, x1, z0, 'E'], [x1, z0, x0, z0, 'N'], [x0, z0, x0, z1, 'W']];
  const GATES = [{ x: 0, z: z1, yaw: 0 }, { x: 0, z: z0, yaw: 0 }, { x: x0, z: 0, yaw: Math.PI / 2 }, { x: x1, z: 0, yaw: Math.PI / 2 }];
  const nearGate = (x, z) => GATES.some(g => Math.hypot(x - g.x, z - g.z) < GATE_W / 2 + .5);

  function build() {
    clear();
    const posts = [], rails = [];
    for (const [ax, az, bx, bz] of SIDES) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / STEP)), yaw = -Math.atan2(bz - az, bx - ax);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        if (!nearGate(x, z)) posts.push([x, farmGroundY(x, z), z]);
        if (i < n) {
          const t2 = (i + .5) / n, mx = ax + (bx - ax) * t2, mz = az + (bz - az) * t2;
          if (nearGate(mx, mz)) continue;
          const y = farmGroundY(mx, mz);
          for (const ry of RAIL_YS) rails.push({ x: mx, y: y + ry, z: mz, len: len / n, yaw });
        }
      }
    }
    for (const g of GATES) {
      const gate = closedGate(g.x, g.z, GATE_W, g.yaw); group.add(gate); live.push(gate);
      const dx = Math.cos(g.yaw), dz = -Math.sin(g.yaw);
      for (const side of [-1, 1]) { const px = g.x + dx * side * (GATE_W / 2 + .1), pz = g.z + dz * side * (GATE_W / 2 + .1); posts.push([px, farmGroundY(px, pz), pz]); }
    }
    const pm = new THREE.InstancedMesh(postGeo, wood, Math.max(1, posts.length));
    const m = new THREE.Matrix4();
    posts.forEach((p, i) => pm.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])));
    pm.count = posts.length; pm.castShadow = true; pm.raycast = () => {}; pm.frustumCulled = false;
    const rm = new THREE.InstancedMesh(railGeo, wood, Math.max(1, rails.length));
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    rails.forEach((r, i) => { q.setFromAxisAngle(up, r.yaw); s.set(r.len, 1, 1); p.set(r.x, r.y, r.z); rm.setMatrixAt(i, m.compose(p, q, s)); });
    rm.count = rails.length; rm.castShadow = true; rm.raycast = () => {}; rm.frustumCulled = false;
    group.add(pm, rm); live.push(pm, rm);
  }

  // The first tier you have not bought: a fence along the top of its wall with CLOSED gates where the ramp and the two
  // stair flights climb it (founder 2026-11-08: "chưa đi được lên tầng thì rào đóng cửa lại"). Bought → it goes away.
  const tierGroup = new THREE.Group(); tierGroup.name = 'tier-closed-fence'; group.add(tierGroup);
  let tierKey = '', tierLive = [];
  function buildTier(edge) {
    for (const o of tierLive) { o.removeFromParent(); o.traverse?.(c => { if (c.isInstancedMesh) c.dispose(); }); }
    tierLive = [];
    if (!edge) return;
    const lineZ = x => tierEdgeZ(edge, x) - WALL_T - .35;
    const posts = [], rails = [], open = x => TIER_CUTS.some(c => Math.abs(x - c.x) < c.half + .6);
    for (let x = BOUNDS.minX + 1; x <= BOUNDS.maxX - 1 + 1e-6; x += STEP) {
      if (open(x)) continue;
      const z = lineZ(x), x2 = x + STEP, z2 = lineZ(x2);
      posts.push([x, farmGroundY(x, z), z]);
      if (x2 <= BOUNDS.maxX - 1 + 1e-6 && !open(x2)) {
        const y = (farmGroundY(x, z) + farmGroundY(x2, z2)) / 2, len = Math.hypot(x2 - x, z2 - z), yaw = -Math.atan2(z2 - z, x2 - x);
        for (const ry of RAIL_YS) rails.push({ x: (x + x2) / 2, y: y + ry, z: (z + z2) / 2, len, yaw });
      }
    }
    for (const c of TIER_CUTS) {
      const z = lineZ(c.x), gate = closedGate(c.x, z, c.half * 2 + .6, 0); tierGroup.add(gate); tierLive.push(gate);
      for (const side of [-1, 1]) { const px = c.x + side * (c.half + .7); posts.push([px, farmGroundY(px, z), lineZ(px)]); }
    }
    const pm = new THREE.InstancedMesh(postGeo, wood, Math.max(1, posts.length)), mm = new THREE.Matrix4();
    posts.forEach((p, i) => pm.setMatrixAt(i, mm.makeTranslation(p[0], p[1], p[2])));
    pm.count = posts.length; pm.castShadow = true; pm.raycast = () => {}; pm.frustumCulled = false;
    const rm = new THREE.InstancedMesh(railGeo, wood, Math.max(1, rails.length)), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    rails.forEach((r, i) => { q.setFromAxisAngle(up, r.yaw); s.set(r.len, 1, 1); p.set(r.x, r.y, r.z); rm.setMatrixAt(i, mm.compose(p, q, s)); });
    rm.count = rails.length; rm.castShadow = true; rm.raycast = () => {}; rm.frustumCulled = false;
    tierGroup.add(pm, rm); tierLive.push(pm, rm);
  }
  return {
    group,
    sync(state) {
      if (!built) { built = true; build(); }
      const i = state ? ESTATE_ORDER.findIndex((id, k) => k > 0 && !estateOwned(state, id)) : -1;
      const key = String(i);
      if (key !== tierKey) { tierKey = key; buildTier(i > 0 ? TIER_EDGES[i - 1] : null); }
    },
    dispose() { clear(); buildTier(null); postGeo.dispose(); railGeo.dispose(); group.removeFromParent(); },
  };
}
