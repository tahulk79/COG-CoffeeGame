// Icons drawn from the REAL models (founder 2026-11-08: the build cards must show the actual well / trees, not stand-in
// emoji): each building's GLB is rendered once into a small transparent PNG (shared offscreen renderer), cached by model.
import * as THREE from 'three';
import { loadModel } from '../../shared/three/models.js';

const cache = new Map();
let gl = null;
function init() {
  if (gl) return gl;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(160, 160, false); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, .1, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9b8a6a, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(4, 8, 5); scene.add(sun);
  return (gl = { renderer, scene, camera });
}

/** Promise of a data-URL PNG for `def.model`, or null when it has no model / fails to load. */
export function modelIcon(def, scale = def?.trueScale) {
  if (!def?.model) return Promise.resolve(null);
  const key = def.model;
  if (!cache.has(key)) {
    cache.set(key, loadModel(key).then(m => {
      if (!m) return null;
      const { renderer, scene, camera } = init();
      if (typeof scale === 'number') m.scale.multiplyScalar(scale);
      scene.add(m); m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const r = Math.max(sz.x, sz.y, sz.z) / 2 || 1, d = r / Math.tan(THREE.MathUtils.degToRad(14)) * 1.18;
      camera.position.set(c.x + Math.sin(.65) * d * .93, c.y + d * .42, c.z + Math.cos(.65) * d * .93); camera.lookAt(c);
      camera.near = d / 50; camera.far = d * 6; camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(m);
      return url;
    }).catch(() => null));
  }
  return cache.get(key);
}
