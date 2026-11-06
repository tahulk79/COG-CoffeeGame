// Player avatar: rigged GLB (loadPlayer) + walk/rest motion. Tap-to-walk / auto-walks follow a grid path (nav.js via
// setNavigator) with stuck detection: < 0.1 m progress in 0.8 s → repath; after 3 repaths → nudge to the next waypoint.
// WASD/arrows (camera-relative) move directly, sliding along building footprints.
import * as THREE from 'three';
import { loadPlayer, playerModel } from '../../characters/load-player.js';
import { createPlayerMotion } from '../../characters/motion.js';
import { createPerson } from '../../characters/player.js';
import { BOUNDS, PLAYER_SPAWN } from '../../core/config/layout.js';
import { clamp, dampK } from './util.js';

const SPEED = 5.2;
const RADIUS = .4;

export async function createAvatar({ scene, gender }) {
  let character = null;
  try { character = await loadPlayer(playerModel(gender)); } catch (error) { console.warn('Player model failed, using blocks.', error); }
  const root = new THREE.Group();
  root.name = 'realm-player';
  const body = character || createPerson(gender === 'male' ? '#3f7fc4' : '#d0637a', { gender });
  root.add(body);
  root.position.set(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);
  root.rotation.y = Math.PI;
  scene.add(root);
  const motion = character ? createPlayerMotion(character) : null;

  let goal = null; // {x, z} final walk target
  let onArrive = null;
  let navigate = null;          // (sx, sz, tx, tz) → [{x, z}] waypoints
  const path = [];              // remaining waypoints (last = goal)
  let watch = 0, watchX = 0, watchZ = 0, repaths = 0;
  let walkTime = 0, weight = 0, stuck = 0;
  let blockers = []; // footprint rects [x0,z0,x1,z1]
  let bounds = BOUNDS; // current area (farm / café)
  const keyDir = new THREE.Vector2();
  let yawGoal = Math.PI;

  const blocked = (x, z) => {
    for (let i = 0; i < blockers.length; i++) {
      const r = blockers[i];
      if (x > r[0] - RADIUS && x < r[2] + RADIUS && z > r[1] - RADIUS && z < r[3] + RADIUS) return true;
    }
    return false;
  };
  // Tries the full step, then each axis alone so the player slides along walls.
  function tryMove(dx, dz) {
    const p = root.position;
    const nx = clamp(p.x + dx, bounds.minX, bounds.maxX), nz = clamp(p.z + dz, bounds.minZ, bounds.maxZ);
    if (!blocked(nx, nz)) { p.x = nx; p.z = nz; return true; }
    if (dx && !blocked(nx, p.z)) { p.x = nx; return true; }
    if (dz && !blocked(p.x, nz)) { p.z = nz; return true; }
    return false;
  }

  // (Re)plans the waypoints to (x, z). The last waypoint becomes the goal (nearest reachable spot when blocked).
  function plan(x, z) {
    path.length = 0;
    const list = navigate ? navigate(root.position.x, root.position.z, x, z) : null;
    if (list?.length) { for (const p of list) path.push(p); goal = path[path.length - 1]; } else path.push(goal);
  }

  function update(dt, time) {
    let mx = 0, mz = 0;
    if (keyDir.lengthSq() > 0) {
      goal = null; onArrive = null; path.length = 0;
      mx = keyDir.x * SPEED * dt; mz = keyDir.y * SPEED * dt;
    } else if (goal) {
      const wp = path[0] || goal;
      const dx = wp.x - root.position.x, dz = wp.z - root.position.z, dist = Math.hypot(dx, dz);
      const step = SPEED * dt;
      if (dist < (path.length > 1 ? .2 : .05)) {
        path.shift();
        if (!path.length) { goal = null; const fn = onArrive; onArrive = null; fn?.(); }
      } else {
        const k = Math.min(1, step / dist);
        mx = dx * k; mz = dz * k;
      }
      // Stuck detection: repath, then (last resort) nudge onto the next waypoint so the walk always finishes.
      if (goal && (watch += dt) > .8) {
        const moved = Math.hypot(root.position.x - watchX, root.position.z - watchZ);
        watch = 0; watchX = root.position.x; watchZ = root.position.z;
        if (moved < .1) {
          if (++repaths <= 3) plan(goal.x, goal.z);
          else if (path.length) { const n = path.shift(); root.position.x = n.x; root.position.z = n.z; repaths = 0; if (!path.length) { goal = null; const fn = onArrive; onArrive = null; fn?.(); } }
        }
      }
    }
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const before = root.position.x + root.position.z;
      const ok = tryMove(mx, mz);
      yawGoal = Math.atan2(mx, mz);
      // Without a navigator: give up on a tap target we cannot reach (e.g. inside a building).
      if (!navigate && goal && (!ok || Math.abs(root.position.x + root.position.z - before) < 1e-4)) { if ((stuck += dt) > .35) { goal = null; onArrive = null; path.length = 0; } }
      else stuck = 0;
    }
    let d = yawGoal - root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    root.rotation.y += d * dampK(12, dt);
    weight += ((moving ? 1 : 0) - weight) * dampK(10, dt);
    if (moving) walkTime += dt;
    if (motion) motion.update(weight > .02 ? 'walk' : 'rest', walkTime, weight);
    else if (body.userData.legs) { const s = Math.sin(walkTime * 9) * .6 * weight; body.userData.legs[0].rotation.x = s; body.userData.legs[1].rotation.x = -s; }
  }

  return {
    root,
    position: root.position,
    get moving() { return !!goal || keyDir.lengthSq() > 0; },
    walkTo(x, z, arrive = null) {
      goal = { x: clamp(x, bounds.minX, bounds.maxX), z: clamp(z, bounds.minZ, bounds.maxZ) };
      onArrive = arrive; stuck = 0; repaths = 0; watch = 0; watchX = root.position.x; watchZ = root.position.z;
      plan(goal.x, goal.z);
    },
    /** fn(sx, sz, tx, tz) → waypoints; null → straight lines. */
    setNavigator(fn) { navigate = fn; },
    stop() { goal = null; onArrive = null; path.length = 0; keyDir.set(0, 0); },
    setKeyDir(x, z) { keyDir.set(x, z); if (keyDir.lengthSq() > 1) keyDir.normalize(); },
    setBlockers(list) { blockers = list; },
    setBounds(b) { bounds = b || BOUNDS; },
    teleport(x, z, yaw = null) { root.position.set(x, 0, z); goal = null; onArrive = null; path.length = 0; if (yaw !== null) root.rotation.y = yawGoal = yaw; },
    update,
    dispose() { motion?.dispose(); root.removeFromParent(); },
  };
}
