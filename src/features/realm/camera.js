// CameraController: isometric-style perspective rig around a ground target, handled like Hay Day: the camera belongs to
// the player. It never jumps on taps / selections, keeps the player's zoom, pans with momentum, zooms around the fingers.
// Modes:
//  · free        — the default: the camera stays where the player left it (pan / pinch / glides).
//  · exploration — follows the avatar with a small dead zone whenever the player walks (tap to walk, keys, counters,
//                  gate), on view entry and in auto play. A pan or a pinch on a spot hands the camera back (free).
//  · cinematic   — pose written directly by cinematics.js, restored smoothly afterwards.
// One distance: baseDist() × zoom. Pinch / wheel change `zoom`; an explicit frame (focusRect) sets it once; automatic
// moves (glideTo / ensureVisible) only slide the look target and never touch the zoom.
import * as THREE from 'three';
import { BOUNDS } from '../../core/config/layout.js';
import { DEG, clamp, dampK } from './util.js';

export const FOV = 38;
export const PITCH = 52 * DEG;
export const YAW = -45 * DEG; // founder: view turned 90° left (camera south-west of the target)
const ZOOM_MIN = .45, ZOOM_MAX = 1.9;
const FOCUS_FILL = .9;      // explicit frames fill ~90% of the shorter screen side
const ZOOM_IN = .62;        // founder: closer default view than the original rig
const DEAD_ZONE = .06;      // follow: the avatar may wander this fraction of the view height before the camera moves (small: stays close)
const FRICTION = 5.5;       // momentum decay per second after a flick
const MIN_FLICK = 2.5;      // world units / s below which a release does not glide

export function createCameraController(camera) {
  camera.fov = FOV;
  camera.near = .5;
  camera.far = 400;
  const cur = { target: new THREE.Vector3(0, 0, 14), dist: 30, yaw: YAW, pitch: PITCH };
  const goal = { target: new THREE.Vector3(0, 0, 14), dist: 30, yaw: YAW, pitch: PITCH };
  let mode = 'exploration';
  let follow = null;
  let zoom = 1;
  let aspect = 1, viewH = 800;
  let focusKey = null;
  let modeBeforeCinematic = 'exploration';
  let bounds = BOUNDS; // current area (farm / café), see setBounds
  const vel = new THREE.Vector2();   // momentum (world units / s) after a flick
  let lastPanAt = 0;
  let held = false;                  // a finger is on the screen
  const tmp = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();

  const tanHalf = () => Math.tan(FOV * DEG / 2);
  // Portrait screens see less width, so the base distance grows as the aspect shrinks.
  const baseDist = () => (aspect < 1 ? Math.max(26, 19.5 / Math.max(aspect, .4)) : 26) * ZOOM_IN;
  const distNow = () => baseDist() * zoom;

  function clampTarget(v) {
    v.x = clamp(v.x, bounds.minX + 4, bounds.maxX - 4);
    v.z = clamp(v.z, bounds.minZ + 4, bounds.maxZ - 2);
    v.y = 0;
    return v;
  }
  // Horizontal unit vector from the target towards the camera.
  const towardCamera = (yaw, out) => out.set(Math.sin(yaw), 0, Math.cos(yaw));

  function apply() {
    const cp = Math.cos(cur.pitch);
    camera.position.set(
      cur.target.x + Math.sin(cur.yaw) * cp * cur.dist,
      cur.target.y + Math.sin(cur.pitch) * cur.dist,
      cur.target.z + Math.cos(cur.yaw) * cp * cur.dist,
    );
    camera.lookAt(cur.target);
    camera.updateMatrixWorld();
  }
  // Ground point under a normalized screen point (-1…1) with the camera as it is now.
  function groundAt(nx, ny, out) {
    ndc.set(nx, ny);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(ground, out);
  }
  function stopMomentum() { vel.set(0, 0); }

  const api = {
    cur, goal,
    get mode() { return mode; },
    get focusKey() { return focusKey; },
    get zoom() { return zoom; },
    get moving() { return vel.lengthSq() > 0; },

    setFollow(vec) { follow = vec; },
    /** Area the look target is clamped to (layout AREAS[view].bounds). */
    setBounds(b) { bounds = b || BOUNDS; clampTarget(goal.target); },
    snapTo(vec) { stopMomentum(); goal.target.copy(vec); clampTarget(goal.target); cur.target.copy(goal.target); cur.dist = goal.dist = distNow(); apply(); },

    /** Follow the avatar (dead zone). Used for keyboard walking, entering an area and auto play. */
    explore() {
      if (mode === 'cinematic') { modeBeforeCinematic = 'exploration'; return; }
      mode = 'exploration'; focusKey = null;
    },
    /** Stop following: the camera stays where it is. */
    hold() { if (mode !== 'cinematic') mode = 'free'; },

    /**
     * Explicit frame (entering the café, starting a placement): centre `rect` [x0,z0,x1,z1] and set the zoom so it fills
     * ~FOCUS_FILL of the shorter screen side. Same `key` as the current frame → no change. Never used for taps.
     */
    focusRect(rect, { key = null, zoom: z = 1, force = false } = {}) {
      if (!force && key && key === focusKey) return false;
      const w = rect[2] - rect[0], d = rect[3] - rect[1];
      const extent = Math.max(6, (w + d) / Math.SQRT2);
      const span = 2 * tanHalf() * Math.min(aspect, 1);
      const dist = clamp(extent / (FOCUS_FILL * span) / z, 10, 75);
      zoom = clamp(dist / baseDist(), ZOOM_MIN, ZOOM_MAX);
      const h = 2 * dist * tanHalf();
      const margin = (aspect < 1 ? -.04 : .04) * h / Math.sin(PITCH);
      towardCamera(YAW, tmp).multiplyScalar(margin);
      goal.target.set((rect[0] + rect[2]) / 2, 0, (rect[1] + rect[3]) / 2).add(tmp);
      clampTarget(goal.target);
      stopMomentum();
      focusKey = key;
      if (mode === 'cinematic') modeBeforeCinematic = 'free'; else mode = 'free';
      return true;
    },

    /** Smoothly slide the look target to (x, z). Keeps the player's zoom. */
    glideTo(x, z) {
      stopMomentum();
      goal.target.set(x, 0, z); clampTarget(goal.target);
      focusKey = null;
      if (mode === 'cinematic') modeBeforeCinematic = 'free'; else mode = 'free';
    },
    /**
     * Is the ground point (x, z) inside the view, with `margin` (0…1 of the half-screen) kept clear at the edges?
     * Uses the camera's current pose.
     */
    sees(x, z, margin = .15, lift = 1) {
      tmp.set(x, lift, z).project(camera);
      return tmp.z < 1 && Math.abs(tmp.x) <= 1 - margin && tmp.y <= 1 - margin * 1.6 && tmp.y >= -1 + margin * 1.8;
    },
    /** Glide to (x, z) only when it is off-screen or hidden near an edge. Returns true when the camera moves. */
    ensureVisible(x, z, margin = .15) {
      if (api.sees(x, z, margin)) return false;
      api.glideTo(x, z);
      return true;
    },

    /** A finger touched the screen: momentum stops right away. */
    grab() { held = true; stopMomentum(); },
    /** Drag-pan in screen pixels. The view follows the finger 1:1 (no lag). */
    pan(dx, dy) {
      if (mode === 'cinematic') return;
      const wpp = (2 * cur.dist * tanHalf()) / viewH;
      const sy = Math.sin(cur.yaw), cy = Math.cos(cur.yaw), sp = Math.sin(cur.pitch);
      // screen right on ground = (cos, 0, -sin); screen up on ground = -(sin, 0, cos) / sin(pitch)
      const mx = -dx * wpp * cy - dy * wpp * sy / sp;
      const mz = dx * wpp * sy - dy * wpp * cy / sp;
      const before = tmp.copy(goal.target);
      const bx = before.x, bz = before.z;
      goal.target.x += mx; goal.target.z += mz;
      clampTarget(goal.target);
      cur.target.copy(goal.target);
      // Momentum: velocity of the last strokes (smoothed), in world units per second.
      const now = performance.now(), dt = Math.max(1, now - lastPanAt) / 1000;
      lastPanAt = now;
      const k = Math.min(1, dt * 12);
      vel.x += ((goal.target.x - bx) / Math.max(dt, 1 / 120) - vel.x) * k;
      vel.y += ((goal.target.z - bz) / Math.max(dt, 1 / 120) - vel.y) * k;
      focusKey = null;
      if (mode !== 'free') mode = 'free';
    },
    /** Finger lifted after a pan: glide on with the momentum (only after a real flick). */
    release() {
      held = false;
      if (performance.now() - lastPanAt > 90 || vel.length() < MIN_FLICK) stopMomentum();
      else vel.clampLength(0, 60);
    },
    /** Drop any momentum (edge scrolling while placing must not glide on afterwards). */
    stopGlide() { stopMomentum(); },
    /** Finger lifted without a pan. */
    letGo() { held = false; },
    get held() { return held; },

    /**
     * Zoom by `factor` (> 1 = further). With a screen anchor (normalized -1…1), the ground point under it stays under
     * the fingers / cursor, like Hay Day's pinch.
     */
    zoomBy(factor, anchor = null) {
      if (mode === 'cinematic') return;
      const next = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX);
      if (next === zoom) return;
      stopMomentum();
      const before = anchor && groundAt(anchor.x, anchor.y, new THREE.Vector3());
      zoom = next;
      cur.dist = goal.dist = distNow();
      apply();
      if (before) {
        const after = groundAt(anchor.x, anchor.y, new THREE.Vector3());
        if (after) {
          goal.target.x += before.x - after.x; goal.target.z += before.z - after.z;
          clampTarget(goal.target);
          cur.target.copy(goal.target);
          apply();
        }
      }
      focusKey = null;
      if (mode === 'exploration' && anchor) mode = 'free'; // zooming on a spot stops the follow
    },

    resize(w, h) {
      aspect = w / Math.max(1, h);
      viewH = Math.max(1, h);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },

    beginCinematic() {
      if (mode !== 'cinematic') modeBeforeCinematic = mode;
      stopMomentum();
      mode = 'cinematic';
    },
    endCinematic() {
      if (mode === 'cinematic') mode = modeBeforeCinematic;
    },
    /** Pose the camera would rest at right now (for cinematics to return to). */
    restPose(out) {
      const m = mode === 'cinematic' ? modeBeforeCinematic : mode;
      out.target.copy(m === 'exploration' && follow ? follow : goal.target); clampTarget(out.target);
      out.dist = distNow();
      out.yaw = YAW; out.pitch = PITCH;
      return out;
    },

    update(dt) {
      if (mode !== 'cinematic') {
        // Dead-zone follow: move only as far as needed to keep the avatar inside the calm central box.
        if (mode === 'exploration' && follow) {
          const box = DEAD_ZONE * 2 * cur.dist * tanHalf();
          const dx = follow.x - goal.target.x, dz = follow.z - goal.target.z, d = Math.hypot(dx, dz);
          if (d > box) { goal.target.x += dx * (1 - box / d); goal.target.z += dz * (1 - box / d); }
          clampTarget(goal.target);
        }
        // Momentum glide after a flick (free mode, no finger down).
        if (!held && vel.lengthSq() > 0) {
          goal.target.x += vel.x * dt; goal.target.z += vel.y * dt;
          const before = goal.target.clone();
          clampTarget(goal.target);
          if (before.x !== goal.target.x) vel.x = 0;
          if (before.z !== goal.target.z) vel.y = 0;
          cur.target.copy(goal.target);
          vel.multiplyScalar(Math.exp(-FRICTION * dt));
          if (vel.length() < .3) stopMomentum();
        }
        goal.dist = distNow();
        goal.yaw = YAW; goal.pitch = PITCH;
        const k = dampK(5, dt);
        cur.target.lerp(goal.target, k);
        cur.dist += (goal.dist - cur.dist) * k;
        cur.yaw += (goal.yaw - cur.yaw) * k;
        cur.pitch += (goal.pitch - cur.pitch) * k;
      }
      apply();
    },
  };
  return api;
}
