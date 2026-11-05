// CameraController: isometric-style perspective rig around a ground target.
// Modes: exploration (follow the player), free (user panned), focus (Area Focus on a rect, Interaction keeps it while
// tapping inside the same area), cinematic (pose written directly by cinematics.js, restored smoothly afterwards).
import * as THREE from 'three';
import { BOUNDS } from '../../core/config/layout.js';
import { DEG, clamp, dampK } from './util.js';

export const FOV = 38;
export const PITCH = 52 * DEG;
export const YAW = 45 * DEG;
const ZOOM_MIN = .5, ZOOM_MAX = 1.8;
const FOCUS_FILL = .6;

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
  let focusKey = null, focusDist = 30;
  let modeBeforeCinematic = 'exploration';
  const tmp = new THREE.Vector3();

  const tanHalf = () => Math.tan(FOV * DEG / 2);
  // Portrait screens see less width, so the base distance grows as the aspect shrinks.
  const baseDist = () => (aspect < 1 ? Math.max(26, 19.5 / Math.max(aspect, .4)) : 26);

  function clampTarget(v) {
    v.x = clamp(v.x, BOUNDS.minX + 4, BOUNDS.maxX - 4);
    v.z = clamp(v.z, BOUNDS.minZ + 4, BOUNDS.maxZ - 2);
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
  }

  return {
    cur, goal,
    get mode() { return mode; },
    get focusKey() { return focusKey; },
    get zoom() { return zoom; },

    setFollow(vec) { follow = vec; },
    snapTo(vec) { goal.target.copy(vec); clampTarget(goal.target); cur.target.copy(goal.target); cur.dist = goal.dist = baseDist() * zoom; apply(); },

    explore() {
      if (mode === 'cinematic') { modeBeforeCinematic = 'exploration'; return; }
      mode = 'exploration'; focusKey = null;
    },

    /**
     * Area Focus: center `rect` [x0,z0,x1,z1] and zoom so it fills ~60% of the shorter screen side,
     * keeping a bottom margin for the action bar. Same `key` as the current focus → no camera change (Interaction mode).
     */
    focusRect(rect, { key = null, zoom: z = 1, force = false } = {}) {
      if (!force && key && key === focusKey && (mode === 'focus' || mode === 'interaction')) { mode = 'interaction'; return false; }
      const w = rect[2] - rect[0], d = rect[3] - rect[1];
      const extent = Math.max(6, (w + d) / Math.SQRT2);
      const span = 2 * tanHalf() * Math.min(aspect, 1);
      focusDist = clamp(extent / (FOCUS_FILL * span) / z, 10, 75);
      const h = 2 * focusDist * tanHalf();
      // Shift the look target towards the camera so the area sits above the bottom action bar.
      const margin = (aspect < 1 ? -.04 : .04) * h / Math.sin(PITCH);
      towardCamera(YAW, tmp).multiplyScalar(margin);
      goal.target.set((rect[0] + rect[2]) / 2, 0, (rect[1] + rect[3]) / 2).add(tmp);
      clampTarget(goal.target);
      goal.yaw = YAW; goal.pitch = PITCH;
      zoom = 1;
      focusKey = key;
      if (mode === 'cinematic') modeBeforeCinematic = 'focus'; else mode = 'focus';
      return true;
    },

    /** Drag-pan in screen pixels. The view follows the finger 1:1 (no lag). */
    pan(dx, dy) {
      if (mode === 'cinematic') return;
      const wpp = (2 * cur.dist * tanHalf()) / viewH;
      const sy = Math.sin(cur.yaw), cy = Math.cos(cur.yaw), sp = Math.sin(cur.pitch);
      // screen right on ground = (cos, 0, -sin); screen up on ground = -(sin, 0, cos) / sin(pitch)
      const mx = -dx * wpp * cy - dy * wpp * sy / sp;
      const mz = dx * wpp * sy - dy * wpp * cy / sp;
      goal.target.x += mx; goal.target.z += mz;
      clampTarget(goal.target);
      cur.target.copy(goal.target);
      if (mode === 'exploration') mode = 'free'; // focus keeps its zoom while panning
    },

    zoomBy(factor) {
      if (mode === 'cinematic') return;
      zoom = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX);
    },

    resize(w, h) {
      aspect = w / Math.max(1, h);
      viewH = Math.max(1, h);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },

    beginCinematic() {
      if (mode !== 'cinematic') modeBeforeCinematic = mode;
      mode = 'cinematic';
    },
    endCinematic() {
      if (mode === 'cinematic') mode = modeBeforeCinematic;
    },
    /** Pose the camera would rest at right now (for cinematics to return to). */
    restPose(out) {
      const m = mode === 'cinematic' ? modeBeforeCinematic : mode;
      out.target.copy(m === 'exploration' && follow ? follow : goal.target); clampTarget(out.target);
      out.dist = (m === 'focus' || m === 'interaction' ? focusDist : baseDist()) * zoom;
      out.yaw = YAW; out.pitch = PITCH;
      return out;
    },

    update(dt) {
      if (mode !== 'cinematic') {
        if (mode === 'exploration' && follow) { goal.target.copy(follow); clampTarget(goal.target); }
        goal.dist = (mode === 'focus' || mode === 'interaction' ? focusDist : baseDist()) * zoom;
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
}
