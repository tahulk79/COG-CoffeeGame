// Café action pads ("like other games"): glowing rounded-square floor pads in the counter lane, in front of the Order
// counter and the Brewing counter. Standing on a pad triggers that counter's action (realm index.js autoNear); when it
// fires the pad pops with a quick radial fill. A pad glows brighter while its action is available.
import * as THREE from 'three';

const SIZE = 1.5;          // pad side (m)
const POP_S = .45;         // pop animation length

function padTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = 26, x = 10, y = 10, w = 108;
  const path = () => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + w, r); g.arcTo(x + w, y + w, x, y + w, r); g.arcTo(x, y + w, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 70);
  grad.addColorStop(0, `${color}55`); grad.addColorStop(1, `${color}bb`);
  path(); g.fillStyle = grad; g.fill();
  g.lineWidth = 7; g.strokeStyle = '#ffffff'; path(); g.stroke();
  g.lineWidth = 3; g.strokeStyle = color; g.setLineDash([10, 8]);
  g.beginPath(); g.arc(64, 64, 30, 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** points: { order: {x, z, color}, brew: {x, z, color} } */
export function createPads({ scene, points }) {
  const group = new THREE.Group();
  group.name = 'realm-pads';
  scene.add(group);
  const plane = new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(.62, .74, 40).rotateX(-Math.PI / 2);
  const fillGeo = new THREE.CircleGeometry(.7, 40).rotateX(-Math.PI / 2);
  const pads = {};
  for (const [id, p] of Object.entries(points)) {
    const mat = new THREE.MeshBasicMaterial({ map: padTexture(p.color), transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(plane, mat);
    mesh.position.set(p.x, .05, p.z);
    mesh.renderOrder = 2;
    const ringMat = new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: .6, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(p.x, .06, p.z);
    ring.renderOrder = 3;
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.set(p.x, .07, p.z);
    fill.renderOrder = 4;
    fill.visible = false;
    for (const m of [mesh, ring, fill]) { m.raycast = () => {}; group.add(m); }
    pads[id] = { mesh, mat, ring, ringMat, fill, fillMat, pop: -1 };
  }

  return {
    group,
    /** Quick radial fill + pop when the pad's action fires. */
    pop(id, time) { const p = pads[id]; if (p) { p.pop = time; p.fill.visible = true; } },
    /** active: { order: bool, brew: bool } — the pad's action is available right now. */
    update(time, active = {}) {
      if (!group.visible) return;
      for (const [id, p] of Object.entries(pads)) {
        const on = !!active[id];
        const pulse = (Math.sin(time * 4 + (id === 'brew' ? 1.3 : 0)) + 1) / 2;
        p.mat.opacity = on ? .85 + .15 * pulse : .45;
        const k = 1 + pulse * (on ? .45 : .2);
        p.ring.scale.set(k, 1, k);
        p.ringMat.opacity = (on ? .75 : .3) * (1 - pulse * .8);
        if (p.pop >= 0) {
          const t = (time - p.pop) / POP_S;
          if (t >= 1) { p.pop = -1; p.fill.visible = false; p.mesh.scale.set(1, 1, 1); }
          else {
            p.fill.scale.set(.2 + t, 1, .2 + t);
            p.fillMat.opacity = .85 * (1 - t);
            const b = 1 + Math.sin(t * Math.PI) * .18;
            p.mesh.scale.set(b, 1, b);
          }
        }
      }
    },
    setVisible(v) { group.visible = !!v; },
    dispose() {
      for (const p of Object.values(pads)) { p.mat.map.dispose(); p.mat.dispose(); p.ringMat.dispose(); p.fillMat.dispose(); }
      plane.dispose(); ringGeo.dispose(); fillGeo.dispose();
      group.removeFromParent();
    },
  };
}
