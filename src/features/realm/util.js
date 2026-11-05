// Small shared helpers for the realm: canvas labels, damping, model normalization, ground picking.
import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const FONT = '800 {size}px "Baloo 2", "Nunito", system-ui, sans-serif';

// Frame-rate independent exponential smoothing factor.
export const dampK = (lambda, dt) => 1 - Math.exp(-lambda * dt);
export const damp = (current, goal, lambda, dt) => current + (goal - current) * dampK(lambda, dt);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const easeInOut = t => (t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
export const easeOutCubic = t => 1 - (1 - t) ** 3;

// Deterministic PRNG so scenery looks identical on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/**
 * World-space text pill drawn on a canvas sprite. `set(text)` redraws only when the text changes.
 * height: world height of the pill in meters.
 */
export function makeLabel(text = '', { bg = '#fff8ea', fg = '#4a2f1c', border = '#c99a5e', height = .7, onTop = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.height = 96;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: !onTop });
  const sprite = new THREE.Sprite(material);
  sprite.geometry.userData.keep = true; // Sprite geometry is shared by every sprite in three.js
  sprite.raycast = () => {};
  if (onTop) sprite.renderOrder = 20;
  let current = null;
  function set(next) {
    next = String(next ?? '');
    if (next === current) return;
    current = next;
    const g = canvas.getContext('2d');
    const font = FONT.replace('{size}', '54');
    g.font = font;
    const w = Math.max(96, Math.ceil(g.measureText(next).width) + 56);
    if (canvas.width !== w) canvas.width = w; else g.clearRect(0, 0, canvas.width, canvas.height);
    g.font = font;
    g.fillStyle = 'rgba(60,35,15,.25)'; roundRect(g, 4, 10, w - 8, 82, 38); g.fill();
    g.fillStyle = bg; roundRect(g, 4, 4, w - 8, 82, 38); g.fill();
    g.lineWidth = 5; g.strokeStyle = border; g.stroke();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(next, w / 2, 47);
    texture.needsUpdate = true;
    sprite.scale.set(height * w / canvas.height, height, 1);
  }
  set(text);
  return {
    sprite, set,
    dispose() { sprite.removeFromParent(); texture.dispose(); material.dispose(); },
  };
}

/** Square canvas sprite with a custom draw function (icons, bubbles, cursors). */
export function makeCanvasSprite(size, draw, { scale = 1, onTop = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: !onTop });
  const sprite = new THREE.Sprite(material);
  sprite.geometry.userData.keep = true;
  sprite.raycast = () => {};
  sprite.scale.set(scale, scale, 1);
  if (onTop) sprite.renderOrder = 21;
  const redraw = (...args) => { const g = canvas.getContext('2d'); g.clearRect(0, 0, size, size); draw(g, size, ...args); texture.needsUpdate = true; };
  redraw();
  return { sprite, redraw, dispose() { sprite.removeFromParent(); texture.dispose(); material.dispose(); } };
}

export function drawEmoji(g, emoji, x, y, px) {
  g.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, x, y);
}

const box = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();
/**
 * Wraps `model` in a group scaled so its XZ bounds fit `w`×`d` meters (times `fill`), centered on the origin,
 * standing on y=0. Returns the wrapper with userData.height (world height after scaling).
 */
export function normalizeModel(model, w, d, { fill = .9, maxScale = 1.4, minScale = .2 } = {}) {
  const wrapper = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(model);
  wrapper.add(inner);
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  box.getSize(size); box.getCenter(center);
  const s = clamp(Math.min((w * fill) / Math.max(size.x, 1e-3), (d * fill) / Math.max(size.z, 1e-3)), minScale, maxScale);
  inner.scale.setScalar(s);
  inner.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  wrapper.userData.height = size.y * s;
  wrapper.userData.scale = s;
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return wrapper;
}

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
/** Intersects a raycaster with the ground plane y=0. Returns `out` or null. */
export function groundPoint(raycaster, out) {
  return raycaster.ray.intersectPlane(plane, out);
}

/** Fallback block when a GLB fails to load: keeps the game playable. */
export function placeholderBox(w, h, d, color = 0xc9a77a) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .85 }));
  mesh.position.y = h / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  const g = new THREE.Group(); g.add(mesh); return g;
}

export const rectSize = r => ({ w: r[2] - r[0], d: r[3] - r[1] });
export const unionRect = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
export const fmtTimer = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
