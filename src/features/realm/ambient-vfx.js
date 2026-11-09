import * as THREE from 'three';
import { getQuality } from '../../shared/vfx/index.js';
import { tickWind } from '../../shared/three/gedeo-vegetation.js';

// Life in the air around the camera on the farm (docs/design/ground-pass.md): drifting pollen, falling leaves, a passing
// shower with a dimmer sun, and water that flows. Scenery only: the shower does not water crops.
const SHOWER_GAP = [420, 720], SHOWER_LEN = 45, FADE = 6; // seconds
const RAIN_DROPS = { high: 700, medium: 320, low: 0 };
const BOX = { x: 56, y: 26, z: 56 };

function rainLines(count) {
  const n = count * 2, position = new Float32Array(n * 3), seed = new Float32Array(n), end = new Float32Array(n);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * BOX.x, y = Math.random() * BOX.y, z = Math.random() * BOX.z, s = .8 + Math.random() * .5;
    for (const k of [0, 1]) { position.set([x, y, z], (i * 2 + k) * 3); seed[i * 2 + k] = s; end[i * 2 + k] = k; }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geometry.setAttribute('end', new THREE.BufferAttribute(end, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, centre: { value: new THREE.Vector3() }, fade: { value: 0 }, box: { value: new THREE.Vector3(BOX.x, BOX.y, BOX.z) } },
    vertexShader: `attribute float seed; attribute float end; uniform float time; uniform vec3 centre; uniform vec3 box; varying float vA;
      void main() {
        vec3 p = position; p.y -= time * 24.0 * seed; p.x += time * 1.6 * seed;
        p = mod(p - centre, box) - box * .5 + centre;   // the box of rain stays round the camera, the drops do not jump
        p.y += box.y * .5;
        p.y += end * .62; p.x -= end * .04;
        vA = 1.0 - end * .75;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform float fade; varying float vA; void main() { gl_FragColor = vec4(.86, .91, .97, vA * .34 * fade); }`,
    transparent: true, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false; lines.renderOrder = 12; lines.visible = false;
  return lines;
}

export function createAmbient({ scene, farm, vfx, sun, hemi, getTarget, isFarm, getWalkers }) {
  const STEP = .75, NEAR = 34, lastStep = new WeakMap();
  let stepClock = 0;
  const baseSun = sun.intensity, baseHemi = hemi.intensity;
  const pos = new THREE.Vector3();
  const motes = vfx.emitter('mote', pos, { rate: 7, spread: 26 });
  const leaves = vfx.emitter('fallLeaf', pos, { rate: 1.1, spread: 30 });
  const count = RAIN_DROPS[getQuality()] ?? 0;
  const rain = count ? rainLines(count) : null;
  if (rain) scene.add(rain);

  let nextShower = SHOWER_GAP[0] * .5, showerEnd = -1, clock = 0, carry = 0;
  let scan = 0, scanLeft = 40; const waters = new Set();

  function findWater() {                                    // the stream loads late: look for its material for a while
    farm.traverse(o => {
      const m = o.isMesh && o.material;
      if (m && m.name === 'gw_water') for (const t of [m.map, m.normalMap]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; waters.add(t); }
    });
  }

  function update(dt) {
    clock += dt; tickWind(clock);
    stepClock += dt;
    if (stepClock > .1 && isFarm() && getQuality() !== 'low') {        // a little dust at each stride
      stepClock = 0;
      const c = getTarget();
      for (const p of getWalkers()) {
        const l = lastStep.get(p);
        if (!l) { lastStep.set(p, p.clone()); continue; }
        if ((p.x - l.x) ** 2 + (p.z - l.z) ** 2 < STEP * STEP) continue;
        l.copy(p);
        if ((p.x - c.x) ** 2 + (p.z - c.z) ** 2 < NEAR * NEAR) vfx.burst('step', { x: p.x, y: p.y + .06, z: p.z }, { count: 1 });
      }
    }
    const target = getTarget(), on = isFarm();
    pos.set(target.x, target.y + 7, target.z);
    motes.move(on ? pos : { x: 0, y: -999, z: 0 });
    pos.y = target.y + 13;
    leaves.move(on ? pos : { x: 0, y: -999, z: 0 });

    if (clock >= scan && scanLeft > 0) { scan = clock + 3; scanLeft--; findWater(); }
    for (const t of waters) t.offset.x -= dt * .14;

    if (clock >= nextShower && showerEnd < 0) showerEnd = clock + SHOWER_LEN;
    let wet = 0;
    if (showerEnd > 0) {
      const left = showerEnd - clock;
      wet = Math.max(0, Math.min(1, Math.min(left, SHOWER_LEN - left) / FADE));
      if (left <= 0) { showerEnd = -1; nextShower = clock + SHOWER_GAP[0] + Math.random() * (SHOWER_GAP[1] - SHOWER_GAP[0]); }
    }
    sun.intensity = baseSun * (1 - .34 * wet);
    hemi.intensity = baseHemi * (1 - .1 * wet);
    if (rain) {
      rain.visible = on && wet > 0;
      rain.material.uniforms.time.value = clock % 1000;
      rain.material.uniforms.fade.value = wet;
      rain.material.uniforms.centre.value.set(target.x, target.y, target.z);
      if (rain.visible) {
        carry += dt * 14 * wet;
        for (; carry >= 1; carry--) vfx.burst('splash', { x: target.x + (Math.random() - .5) * 34, y: target.y + .1, z: target.z + (Math.random() - .5) * 34 }, { count: 1 });
      }
    }
  }

  function dispose() {
    motes.stop(); leaves.stop();
    if (rain) { rain.removeFromParent(); rain.geometry.dispose(); rain.material.dispose(); }
  }
  return { update, dispose };
}
