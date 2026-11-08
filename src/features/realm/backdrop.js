// Farm backdrop: a ring of low-poly hills melting into the fog beyond the playable land, so a low camera sees a horizon
// (reference shots: mountains behind the plantation). Procedural; an optional strip texture at
// public/assets/farm/env/mountains-<country>.png (docs/design/farm-ui-bigupdate.md §3.B) is drawn behind the hills.
import * as THREE from 'three';
import { BOUNDS } from '../../core/config/layout.js';
import { mulberry32, tone } from './util.js';
import { farmTex } from '../../shared/three/farm-textures.js';

const CX = (BOUNDS.minX + BOUNDS.maxX) / 2, CZ = (BOUNDS.minZ + BOUNDS.maxZ) / 2;
const RX = 104, RZ = 116;

export function createBackdrop({ parent }) {
  const group = new THREE.Group();
  group.name = 'realm-backdrop';
  parent.add(group);
  // Realistic pass: smooth, grass-textured hills (the far ring hazes into the fog), no faceted low-poly look.
  const geo = new THREE.IcosahedronGeometry(1, 5);
  const hillTex = farmTex('grass').clone(); hillTex.repeat.set(10, 10); hillTex.needsUpdate = true;
  const far = new THREE.MeshLambertMaterial({ color: 0x9fb4ac, map: hillTex });
  const near = new THREE.MeshLambertMaterial({ color: 0xb8c4a2, map: hillTex });
  const rnd = mulberry32(77);
  const ring = (mat, rx, rz, n, size, height, y) => {
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rnd() - .5) * .2, k = .94 + rnd() * .12, w = size * (.7 + rnd() * .8);
      p.set(CX + Math.cos(a) * rx * k, y, CZ + Math.sin(a) * rz * k);
      s.set(w, height * (.6 + rnd() * .8), w * (.8 + rnd() * .4));
      m.compose(p, q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6.28), s);
      mesh.setMatrixAt(i, m);
    }
    mesh.frustumCulled = false; mesh.raycast = () => {};
    group.add(mesh);
    return mesh;
  };
  ring(far, RX + 40, RZ + 40, 20, 40, 36, -4);
  ring(near, RX + 6, RZ + 6, 30, 20, 9, -2);
  return {
    group,
    /** Tints the hills from the country palette. */
    sync(pal) {
      tone(near.color, pal.ground, -.02, .1, -.08); near.color.lerp(new THREE.Color(1, 1, 1), .6); // the grass texture carries the colour
      far.color.copy(near.color).lerp(new THREE.Color(0x9fc3d6), .55);
    },
    dispose() { geo.dispose(); far.dispose(); near.dispose(); group.removeFromParent(); },
  };
}
