// CameraController: isometric-style perspective rig around a ground target, handled like Hay Day: the camera belongs to
// the player. It never jumps on taps / selections, keeps the player's zoom, pans with momentum, zooms around the fingers.
// Modes:
//  · free        — the default: the camera stays where the player left it (pan / pinch / glides).
//  · exploration — follows the avatar with a small dead zone whenever the player walks (tap to walk, keys, counters,
//                  gate), on view entry and in auto play. A pan or a pinch on a spot hands the camera back (free).
//  · cinematic   — pose written directly by cinematics.js, restored smoothly afterwards.
// One distance: baseDist() × zoom. Pinch / wheel change `zoom`; an explicit frame (focusRect) sets it once; automatic
// moves (glideTo / ensureVisible) only slide the look target and never touch the zoom.
// Zoom range: ZOOM_MIN … zoomMax (per area, setZoomMax): the café street is long, so its overview may pull further out.
// focusRect({ maxZoom }) caps one frame's zoom (a street shop is framed close enough to operate, even on a phone).
import * as THREE from 'three';
import { BOUNDS } from '../../core/config/layout.js';
import { DEG, clamp, dampK } from './util.js';

export const FOV = 38;
export const PITCH = 52 * DEG;
export const YAW = -45 * DEG; // founder: view turned 90° left (camera south-west of the target)
const ZOOM_MIN = .45, ZOOM_MAX = 2.4; // ZOOM_MAX = default zoomMax (farm: far enough to see the coffee hills)
const OVERVIEW_ZOOM = 3, OVERVIEW_MAX = 3.4; // land / expand mode: a portrait phone sees much more of the farm
const FOCUS_FILL = .9;      // explicit frames fill ~90% of the shorter screen side
const ZOOM_IN = .62;        // founder: closer default view than the original rig
const DEAD_ZONE = .06;      // follow: the avatar may wander this fraction of the view height before the camera moves (small: stays close)
const TAP_ZONE = .26;       // tap-to-walk follow: the camera moves only when the avatar nears the screen edge (taps back and
                            // forth inside the view never make it brake / reverse = no stop-and-go)
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
  let zoomMax = ZOOM_MAX;
  let aspect = 1, viewH = 800;
  let focusKey = null;
  let modeBeforeCinematic = 'exploration';
  let bounds = BOUNDS; // current area (farm / café), see setBounds
  // Screen bands (CSS px) covered by the HUD: the bottom action card / the top bar. ensureVisible keeps targets out of
  // them and glides them to the middle of the free band. 0 = today's behaviour (margins only).
  const safe = { top: 0, bottom: 0 };
  let overview = null; // { zoom, zoomMax } saved by setOverview(true), restored by setOverview(false)
  const vel = new THREE.Vector2();   // momentum (world units / s) after a flick
  let lastPanAt = 0;
  let held = false;                  // a finger is on the screen
  // Extra dead-zone radius when a follow starts: the avatar's current offset from the view centre, eased away over
  // ~1.5 s. Without it, tap-to-walk after a pan made the camera lurch onto the avatar in a few frames (a jerk).
  let slack = 0;
  let zone = DEAD_ZONE;              // dead zone of the current follow (DEAD_ZONE keys / auto, TAP_ZONE tap-to-walk)
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
    get zoomMax() { return zoomMax; },
    /** Farthest zoom of the current area (default ZOOM_MAX); the current zoom is pulled in when it is past it. */
    setZoomMax(v) {
      const max = clamp(Number.isFinite(v) ? v : ZOOM_MAX, 1, 4);
      if (overview) { overview.zoomMax = max; overview.zoom = Math.min(overview.zoom, max); return; } // applied on exit
      zoomMax = max;
      if (zoom > zoomMax) { zoom = zoomMax; goal.dist = distNow(); }
    },
    /**
     * Overview zoom (land / expand mode): raises the zoom limit and eases out to OVERVIEW_ZOOM (or `zoom`); off restores
     * the limit and the player's previous zoom. The look target is kept (no jump), only the distance eases.
     */
    setOverview(on, { zoom: z = OVERVIEW_ZOOM } = {}) {
      if (on) {
        if (!overview) overview = { zoom, zoomMax };
        zoomMax = Math.max(overview.zoomMax, OVERVIEW_MAX);
        zoom = clamp(z, ZOOM_MIN, zoomMax);
      } else if (overview) {
        zoomMax = overview.zoomMax;
        zoom = clamp(overview.zoom, ZOOM_MIN, zoomMax);
        overview = null;
      } else return;
      stopMomentum();
      goal.dist = distNow();
      focusKey = null;
    },
    get overview() { return !!overview; },
    /** HUD-covered screen bands in CSS px ({ top, bottom }); missing / invalid values keep the current ones. */
    setSafeInsets({ top = safe.top, bottom = safe.bottom } = {}) {
      safe.top = Math.max(0, Number(top) || 0);
      safe.bottom = Math.max(0, Number(bottom) || 0);
    },
    get safeInsets() { return { ...safe }; },
    get moving() { return vel.lengthSq() > 0; },

    setFollow(vec) { follow = vec; },
    /** Area the look target is clamped to (layout AREAS[view].bounds). */
    setBounds(b) { bounds = b || BOUNDS; clampTarget(goal.target); },
    snapTo(vec) { stopMomentum(); goal.target.copy(vec); clampTarget(goal.target); cur.target.copy(goal.target); cur.dist = goal.dist = distNow(); apply(); },

    /** Follow the avatar (dead zone). Used for keyboard walking, entering an area and auto play. */
    explore({ tap = false } = {}) {
      zone = tap ? TAP_ZONE : DEAD_ZONE;
      if (mode === 'cinematic') { modeBeforeCinematic = 'exploration'; return; }
      if (mode !== 'exploration' && follow) slack = Math.hypot(follow.x - goal.target.x, follow.z - goal.target.z);
      mode = 'exploration'; focusKey = null;
    },
    /** Stop following: the camera stays where it is. */
    hold() { if (mode !== 'cinematic') mode = 'free'; },

    /**
     * Explicit frame (entering the café, starting a placement): centre `rect` [x0,z0,x1,z1] and set the zoom so it fills
     * ~FOCUS_FILL of the shorter screen side. Same `key` as the current frame → no change. Never used for taps.
     */
    focusRect(rect, { key = null, zoom: z = 1, force = false, maxZoom = Infinity } = {}) {
      if (!force && key && key === focusKey) return false;
      const w = rect[2] - rect[0], d = rect[3] - rect[1];
      const extent = Math.max(6, (w + d) / Math.SQRT2);
      const span = 2 * tanHalf() * Math.min(aspect, 1);
      const dist = clamp(extent / (FOCUS_FILL * span) / z, 10, 75);
      zoom = clamp(dist / baseDist(), ZOOM_MIN, Math.max(ZOOM_MIN, Math.min(zoomMax, maxZoom)));
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

    /**
     * Smoothly slide the look target to (x, z). Keeps the player's zoom. { safe: true } lands the point in the middle of
     * the screen band the HUD leaves free (setSafeInsets) instead of the exact centre.
     */
    glideTo(x, z, { safe: useSafe = false } = {}) {
      stopMomentum();
      goal.target.set(x, 0, z);
      if (useSafe && (safe.bottom || safe.top)) {
        // NDC shift that centres the point in the free band; target moved towards the camera = the point shows higher.
        const shift = (safe.bottom - safe.top) / viewH; // half of the NDC offset (2 px / viewH) = screen fraction
        const h = 2 * distNow() * tanHalf();
        goal.target.add(towardCamera(YAW, tmp).multiplyScalar(shift * h / Math.sin(PITCH)));
      }
      clampTarget(goal.target);
      focusKey = null;
      if (mode === 'cinematic') modeBeforeCinematic = 'free'; else mode = 'free';
    },
    /**
     * Spotlight (auto focus on a problem): remember the view, slide to (x, z) and zoom in by `zoomIn` (smoothly, the
     * update loop eases the distance). Returns the remembered view for restore().
     */
    peek(x, z, { zoomIn = .6 } = {}) {
      const saved = { target: goal.target.clone(), zoom, mode: mode === 'cinematic' ? modeBeforeCinematic : mode };
      zoom = clamp(Math.min(zoom, 1) * zoomIn, ZOOM_MIN, zoomMax);
      api.glideTo(x, z, { safe: true });
      return saved;
    },
    /** Back to a view remembered by peek() (smooth). */
    restore(saved) {
      if (!saved || mode === 'cinematic') return;
      zoom = clamp(saved.zoom, ZOOM_MIN, zoomMax);
      goal.target.copy(saved.target);
      clampTarget(goal.target);
      stopMomentum();
      mode = saved.mode === 'exploration' ? 'exploration' : 'free';
    },
    /**
     * Is the ground point (x, z) inside the view, with `margin` (0…1 of the half-screen) kept clear at the edges?
     * Uses the camera's current pose.
     */
    sees(x, z, margin = .15, lift = 1, { insets = false } = {}) {
      tmp.set(x, lift, z).project(camera);
      const top = insets ? 2 * safe.top / viewH : 0, bottom = insets ? 2 * safe.bottom / viewH : 0;
      return tmp.z < 1 && Math.abs(tmp.x) <= 1 - margin && tmp.y <= 1 - top - margin * 1.6 && tmp.y >= -1 + bottom + margin * 1.8;
    },
    /**
     * Glide to (x, z) only when it is off-screen, hidden near an edge or under the HUD bands (setSafeInsets).
     * Returns true when the camera moves. Never touches the zoom.
     */
    ensureVisible(x, z, margin = .15) {
      if (api.sees(x, z, margin, 1, { insets: true })) return false;
      api.glideTo(x, z, { safe: true });
      return true;
    },

    /**
     * A finger touched the screen: momentum stops right away, and an unfinished glide (selection / tutorial focus) stops
     * where the view is now. Otherwise the first pan stroke would snap the view to the glide's end (a visible jerk).
     */
    grab() {
      held = true; stopMomentum();
      if (mode === 'free') goal.target.copy(cur.target);
    },
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
      const next = clamp(zoom * factor, ZOOM_MIN, zoomMax);
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
          const dx = follow.x - goal.target.x, dz = follow.z - goal.target.z, d = Math.hypot(dx, dz);
          // The start-of-follow slack shrinks with the avatar walking in (camera stays still) and melts slowly otherwise.
          slack = Math.min(slack, d) * Math.exp(-1.2 * dt);
          const box = zone * 2 * cur.dist * tanHalf() + slack;
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
