// Scripted camera moves. Each cinematic writes the camera pose directly (camera mode 'cinematic'), then hands control
// back to the controller, which damps to its rest pose. play(name) → Promise resolved when the camera is restored.
import * as THREE from 'three';
import { shake } from '../../shared/vfx/index.js';
import { DEG, easeInOut, easeOutCubic } from './util.js';

const DURATION = { arrive: 2.2, expiry: 3.2, round: 2.6, country: 2.6, rebirth: 1.8 };
const GREY = new THREE.Color(0x77787a);

export function createCinematics({ cam, camera, vfx, env, getPlayer }) {
  const rest = { target: new THREE.Vector3(), dist: 30, yaw: 0, pitch: 0 };
  const start = { target: new THREE.Vector3(), dist: 30, yaw: 0, pitch: 0 };
  const tmp = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  let active = null; // { name, t, dur, resolve, saved }

  // Full-screen white flash attached to the camera (camera is added to the scene by the realm).
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), flashMat);
  flash.position.z = -1;
  flash.renderOrder = 999;
  flash.visible = false;
  flash.raycast = () => {};
  camera.add(flash);

  function saveEnv() {
    return {
      fog: env.fog.color.clone(), bg: env.background.clone(), hemi: env.hemi.intensity, sun: env.sun.intensity,
      mats: env.tintMaterials().map(m => [m, m.color.clone()]),
    };
  }
  function applyEnv(saved, k) {
    env.fog.color.copy(saved.fog).lerp(GREY, k * .7).multiplyScalar(1 - k * .3);
    env.background.copy(saved.bg).lerp(GREY, k * .7).multiplyScalar(1 - k * .3);
    env.hemi.intensity = saved.hemi * (1 - k * .45);
    env.sun.intensity = saved.sun * (1 - k * .5);
    for (const [m, c] of saved.mats) {
      const l = c.r * .3 + c.g * .59 + c.b * .11;
      m.color.copy(c).lerp(tmpColor.setRGB(l, l, l), k * .75);
    }
  }

  function finish() {
    if (!active) return;
    const a = active;
    active = null;
    if (a.saved) applyEnv(a.saved, 0);
    flash.visible = false;
    cam.endCinematic();
    a.resolve();
  }

  function play(name) {
    if (!DURATION[name]) return Promise.resolve();
    finish();
    cam.beginCinematic();
    cam.restPose(rest);
    start.target.copy(cam.cur.target); start.dist = cam.cur.dist; start.yaw = cam.cur.yaw; start.pitch = cam.cur.pitch;
    return new Promise(resolve => {
      active = { name, t: 0, dur: DURATION[name], resolve, saved: name === 'expiry' ? saveEnv() : null, rain: 0, shakes: 0 };
      if (name === 'rebirth') { flash.visible = true; flashMat.opacity = 1; vfx.burst('sparkle', getPlayer(), { count: 24 }); }
      if (name === 'arrive') {
        // Start high above, rotated, then swoop in.
        start.target.copy(rest.target); start.dist = rest.dist * 2.6; start.pitch = 78 * DEG; start.yaw = rest.yaw + 70 * DEG;
      }
    });
  }

  function update(dt) {
    if (!active) return;
    const a = active;
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    const cur = cam.cur;
    cam.restPose(rest); // the rest pose may move (player walking); blend towards the live one
    if (a.name === 'arrive') {
      const e = easeInOut(k);
      cur.target.lerpVectors(start.target, rest.target, e);
      cur.dist = start.dist + (rest.dist - start.dist) * e;
      cur.pitch = start.pitch + (rest.pitch - start.pitch) * e;
      cur.yaw = start.yaw + (rest.yaw - start.yaw) * easeOutCubic(k);
    } else if (a.name === 'expiry') {
      // Slow pull-back while the world drains of colour, with a few gentle shakes.
      const pull = easeOutCubic(Math.min(1, k / .8));
      const back = k > .85 ? easeInOut((k - .85) / .15) : 0;
      cur.target.copy(start.target);
      cur.dist = start.dist * (1 + .7 * pull * (1 - back));
      cur.pitch = start.pitch + 10 * DEG * pull * (1 - back);
      cur.yaw = start.yaw;
      applyEnv(a.saved, Math.min(1, k / .4) * (1 - back));
      const due = Math.floor(k * 4);
      if (due > a.shakes && due < 4) { a.shakes = due; shake(.6); }
    } else if (a.name === 'round' || a.name === 'country') {
      // Orbit out and back while golden sparkles rain around the target.
      const s = Math.sin(Math.PI * easeInOut(k));
      cur.target.copy(start.target);
      cur.yaw = start.yaw + s * 100 * DEG;
      cur.dist = start.dist * (1 + .3 * s);
      cur.pitch = start.pitch + s * 6 * DEG;
      a.rain += dt;
      while (a.rain > .06) {
        a.rain -= .06;
        tmp.set(start.target.x + (Math.random() - .5) * 18, 7 + Math.random() * 3, start.target.z + (Math.random() - .5) * 18);
        vfx.burst('sparkle', tmp, { count: 3, color: 0xffd34d });
      }
    } else if (a.name === 'rebirth') {
      flashMat.opacity = Math.max(0, 1 - k / .6);
      const s = Math.sin(Math.PI * k);
      cur.target.copy(start.target);
      cur.dist = start.dist * (1 - .2 * s);
      cur.yaw = start.yaw; cur.pitch = start.pitch;
      if (a.t - dt < a.dur * .45 && a.t >= a.dur * .45) vfx.burst('sparkle', getPlayer(), { count: 18, color: 0xffffff });
    }
    if (k >= 1) finish();
  }

  return {
    play, update,
    get active() { return active?.name || null; },
    dispose() { finish(); flash.removeFromParent(); flash.geometry.dispose(); flashMat.dispose(); },
  };
}
