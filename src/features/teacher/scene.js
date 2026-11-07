// Scene 2: a calm heavenly plaza at golden hour. The player stands before the Deity, who floats gently with a halo.
// The Deity gives the God Bean; the player sniffs it and it dissolves into their mind (then the app shows the splash).
// Cinematic camera only — no walking input. The closed World Gate stays behind the player as scenery.
// API: createTeacherScene({ character }) → { scene, camera, update(dt, time), resize(w, h), setShot(name),
//   showBean(), giveBean() → Promise, sniff() → Promise, dissolve() → Promise, finish(), dispose() }
import * as THREE from 'three';
import { loadModel } from '../../shared/three/models.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { createPlayerMotion } from '../../characters/motion.js';

const TEACHER = new THREE.Vector3(0, 0, 4.4);
const PLAYER = new THREE.Vector3(0, .05, 8);
const GATE = new THREE.Vector3(0, 0, 13);
// The bean's path: above the Deity's hands → in front of the player's chest → at the nose → into the forehead.
const BEAN_GIFT = new THREE.Vector3(0, 1.45, 5.05);
const BEAN_HELD = new THREE.Vector3(.08, 1.12, 7.62);
const BEAN_NOSE = new THREE.Vector3(0, 1.45, 7.72);
const BEAN_SIZE = .042; // ~12 cm long: big enough to read on a phone, small enough to sit in the fingers
const FINGER_OFFSET = new THREE.Vector3(0, .08, -.07);
const BEAN_MIND = new THREE.Vector3(0, 1.66, 7.9);
const TEACHER_HEIGHT = 2;
// Camera shots: [position, look-at]. Portrait screens get a wider lens in resize().
const SHOTS = {
  wide: [[6.5, 5, 16], [0, 1.4, 6]],
  talk: [[2.8, 2.1, 11.4], [0, 1.6, 5]],
  claim: [[1.5, 2.1, 8.4], [0, 1.9, 4.4]],
  hero: [[1.5, 1.85, 5.7], [0, 1.45, 8]],    // over the Deity's shoulder onto the player
  face: [[.75, 1.6, 6.75], [0, 1.48, 7.9]],  // close-up: the player sniffs the bean
};
const ease = k => k * k * (3 - 2 * k);
const span = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);

// Vertical sky gradient as a cheap screen-space background.
function skyTexture() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 4, height: 256 });
  const g = canvas.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#9fd2ee'); grad.addColorStop(.45, '#ffe7c2'); grad.addColorStop(.75, '#ffd7a8'); grad.addColorStop(1, '#fff3dc');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
// Soft round glow sprite (bean aura, dust).
function glowTexture() {
  const S = 64, canvas = Object.assign(document.createElement('canvas'), { width: S, height: S });
  const g = canvas.getContext('2d'), grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, '#ffffffff'); grad.addColorStop(.25, '#fff1b8cc'); grad.addColorStop(.6, '#ffc85a44'); grad.addColorStop(1, '#ffc85a00');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Normalize a GLB to a target height and stand it on y = 0, centred on x/z.
function normalize(model, height) {
  const inner = new THREE.Group(); inner.add(model);
  const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? height / size.y : 1;
  inner.scale.setScalar(scale);
  inner.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  return inner;
}

export async function createTeacherScene({ character }) {
  const scene = new THREE.Scene();
  const sky = skyTexture();
  scene.background = sky;
  scene.fog = new THREE.Fog('#ffe9cc', 26, 80);
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 220);
  scene.add(new THREE.HemisphereLight('#fff6e4', '#d9c49a', 1.6));
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.2);
  sun.position.set(-6, 12, 14); sun.target.position.set(0, 0, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 }); sun.shadow.bias = -.0006;
  scene.add(sun, sun.target);

  const owned = []; // geometries/materials created here (disposeScene also frees what is still in the scene)
  const own = item => { owned.push(item); return item; };

  // Ground: plaza GLB (or a soft cream disc if it fails to load) + surrounding sky islands.
  const [plaza, surroundings, clerk, frame, leftLeaf, rightLeaf] = await Promise.all([
    loadModel('heaven/plaza.glb'), loadModel('heaven/surroundings.glb'), loadModel('heaven/clerk.glb'),
    loadModel('heaven/portal.glb#portal_frame'), loadModel('heaven/portal.glb#portal_left_leaf'), loadModel('heaven/portal.glb#portal_right_leaf'),
  ]);
  if (plaza) { plaza.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } }); scene.add(plaza); }
  else {
    const disc = new THREE.Mesh(own(new THREE.CylinderGeometry(14, 14, .3, 48)), own(new THREE.MeshStandardMaterial({ color: '#f6ecd4', roughness: .9 })));
    disc.position.set(0, -.15, 6); disc.receiveShadow = true; scene.add(disc);
  }
  if (surroundings) { surroundings.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = false; }); scene.add(surroundings); }

  // Soft clouds drifting around the plaza.
  const cloudMaterial = own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: .92 }));
  const puff = own(new THREE.SphereGeometry(1, 12, 8));
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group(), angle = i / 9 * Math.PI * 2, radius = 22 + (i % 3) * 6;
    for (let k = 0; k < 4; k++) { const ball = new THREE.Mesh(puff, cloudMaterial); ball.position.set(k * 1.6 - 2.4, Math.sin(k * 2) * .4, (k % 2) * .8); ball.scale.setScalar(1.3 + (k % 2) * .6); cloud.add(ball); }
    cloud.position.set(Math.cos(angle) * radius, -1.5 + (i % 4), 6 + Math.sin(angle) * radius);
    cloud.userData = { angle, radius, speed: .01 + (i % 3) * .004 };
    scene.add(cloud); clouds.push(cloud);
  }

  // Gentle golden motes rising around the plaza.
  const MOTES = 140;
  const moteGeometry = own(new THREE.BufferGeometry());
  const motePositions = new Float32Array(MOTES * 3), moteSeeds = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    motePositions.set([(Math.random() - .5) * 18, Math.random() * 6, 6 + (Math.random() - .5) * 18], i * 3); moteSeeds[i] = Math.random() * 10;
  }
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeometry, own(new THREE.PointsMaterial({ color: '#ffe08a', size: .09, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending })));
  scene.add(motes);

  // The Teacher: clerk GLB normalized to ~2 m (fallback: a robed figure from primitives), halo + glow.
  const teacher = new THREE.Group(); teacher.position.copy(TEACHER); scene.add(teacher);
  const body = new THREE.Group(); teacher.add(body);
  if (clerk) { clerk.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); body.add(normalize(clerk, TEACHER_HEIGHT)); }
  else {
    const robe = new THREE.Mesh(own(new THREE.ConeGeometry(.55, 1.6, 16)), own(new THREE.MeshStandardMaterial({ color: '#f4efe2' })));
    robe.position.y = .8; robe.castShadow = true;
    const head = new THREE.Mesh(own(new THREE.SphereGeometry(.24, 16, 12)), own(new THREE.MeshStandardMaterial({ color: '#f1c9a0' })));
    head.position.y = 1.78; body.add(robe, head);
  }
  const haloMaterial = own(new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: .95 }));
  const halo = new THREE.Mesh(own(new THREE.TorusGeometry(.32, .045, 10, 40)), haloMaterial);
  halo.rotation.x = Math.PI / 2; halo.position.y = TEACHER_HEIGHT + .3; body.add(halo);
  const glow = new THREE.PointLight('#ffd98a', 6, 6, 2); glow.position.set(0, TEACHER_HEIGHT + .2, .6); body.add(glow);

  // Player: the loaded character, facing the Teacher (−z), resting pose.
  character.position.copy(PLAYER); character.rotation.set(0, Math.PI, 0); scene.add(character);
  const motion = createPlayerMotion(character);

  // World Gate behind the player (closed, scenery only): GLB frame + two leaves (fallback: golden arch).
  const gate = new THREE.Group(); gate.position.copy(GATE); gate.rotation.y = Math.PI; scene.add(gate);
  const gold = own(new THREE.MeshStandardMaterial({ color: '#e2c27a', roughness: .5, metalness: .1 }));
  if (frame) gate.add(frame);
  else { const arch = new THREE.Mesh(own(new THREE.TorusGeometry(1.9, .2, 10, 32, Math.PI)), gold); arch.position.y = 3.2; gate.add(arch); for (const x of [-1.9, 1.9]) { const post = new THREE.Mesh(own(new THREE.BoxGeometry(.35, 3.2, .35)), gold); post.position.set(x, 1.6, 0); gate.add(post); } }
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.x = side * 1.65; gate.add(hinge);
    const leaf = side === -1 ? leftLeaf : rightLeaf;
    if (leaf) hinge.add(leaf);
    else { const door = new THREE.Mesh(own(new THREE.BoxGeometry(1.65, 3, .12)), gold); door.position.set(-side * .825, 1.5, 0); hinge.add(door); }
  }
  gate.traverse(o => { if (o.isMesh) o.castShadow = true; });

  // The God Bean: a glossy coffee bean (two halves + the centre crease) with a warm aura. Hidden until showBean().
  const bean = new THREE.Group(); bean.visible = false; scene.add(bean);
  const beanCore = new THREE.Group(); beanCore.scale.setScalar(BEAN_SIZE); bean.add(beanCore);
  const beanMaterial = own(new THREE.MeshStandardMaterial({ color: '#7a4424', roughness: .35, metalness: .05, emissive: '#ff9a3c', emissiveIntensity: .25 }));
  const beanBody = new THREE.Mesh(own(new THREE.SphereGeometry(1, 24, 16)), beanMaterial); beanBody.scale.set(1, .7, 1.4); beanCore.add(beanBody);
  const crease = new THREE.Mesh(own(new THREE.CapsuleGeometry(.08, 1.9, 4, 8)), own(new THREE.MeshStandardMaterial({ color: '#3a1d0e', roughness: .6 })));
  crease.rotation.x = Math.PI / 2; crease.scale.set(1, 1, .45); crease.position.y = .64; beanCore.add(crease);
  const glowMap = own(glowTexture());
  const auraMaterial = own(new THREE.SpriteMaterial({ map: glowMap, color: '#ffd98a', transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const aura = new THREE.Sprite(auraMaterial); aura.scale.setScalar(.32); bean.add(aura);
  const beanLight = new THREE.PointLight('#ffcf7a', 0, 3, 2); bean.add(beanLight);

  // Golden dust that streams from the bean into the player's forehead when it dissolves.
  const DUST = 90;
  const dustGeometry = own(new THREE.BufferGeometry());
  const dustPositions = new Float32Array(DUST * 3), dustSeeds = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST * 3; i++) dustSeeds[i] = Math.random();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = own(new THREE.PointsMaterial({ map: glowMap, color: '#ffe39a', size: .045, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const dust = new THREE.Points(dustGeometry, dustMaterial); dust.frustumCulled = false; scene.add(dust);

  // Player bones used for the sniff pose (added on top of the rest pose each frame).
  const findBone = re => { let found = null; character.traverse(o => { if (!found && o.isBone && re.test(o.name)) found = o; }); return found; };
  const bones = { head: findBone(/head$/i), neck: findBone(/neck$/i), arm: findBone(/rightarm$/i), fore: findBone(/rightforearm$/i) };
  const hand = findBone(/righthand$/i);
  // Where the bean sits while sniffed: just in front of the raised fingers (fallback: a fixed point under the nose).
  const atFingers = target => { if (!hand) return target.copy(BEAN_NOSE); hand.getWorldPosition(target); return target.add(FINGER_OFFSET); };
  const fingers = new THREE.Vector3(), dissolveFrom = new THREE.Vector3();
  // Each bend starts from the bone's own rest rotation (captured once), so offsets never pile up frame after frame.
  const base = new Map(Object.values(bones).filter(Boolean).map(bone => [bone, bone.quaternion.clone()]));
  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const bend = (bone, x, y, z) => { if (bone) bone.quaternion.copy(base.get(bone)).multiply(tmpQ.setFromEuler(tmpE.set(x, y, z))); };
  const SNIFF = { arm: [-1.15, 0, .75], fore: [0, 0, 2.05], neck: [.12, 0, 0], head: [.18, 0, 0] };
  let pose = 0; // 0 = rest, 1 = hand raised to the nose, head bowed

  // Camera follows the current shot with exponential easing.
  const current = { pos: new THREE.Vector3(...SHOTS.wide[0]), look: new THREE.Vector3(...SHOTS.wide[1]) };
  const goal = { pos: current.pos.clone(), look: current.look.clone() };
  let shot = 'wide', portrait = false;
  function setShot(name) {
    const [pos, look] = SHOTS[name] || SHOTS.talk; shot = name;
    goal.pos.set(...pos); goal.look.set(...look);
    if (portrait) goal.pos.sub(goal.look).multiplyScalar(1.25).add(goal.look); // step back a little on tall screens
  }

  // Bean cinematic: one timeline at a time ({ kind, t, length, resolve }); finish() jumps every step to its end.
  let beat = null, beanState = 'hidden';
  const run = (kind, length) => new Promise(resolve => { beat = { kind, t: 0, length, resolve }; });
  const endBeat = () => { if (!beat) return; const done = beat.resolve; beat = null; done(); };
  function showBean() { bean.visible = true; bean.position.copy(BEAN_GIFT); beanState = 'appear'; return run('appear', 1); }
  let giving = null; // the hand-over may still be flying when the player taps on: sniff() waits for it
  function giveBean() { beanState = 'give'; giving = run('give', 1.6); return giving; }
  async function sniff() { if (giving) await giving; giving = null; setShot('face'); beanState = 'sniff'; return run('sniff', 2.6); }
  function dissolve() { dissolveFrom.copy(bean.position); beanState = 'dissolve'; return run('dissolve', 1.8); }
  function finish() { endBeat(); bean.visible = false; dustMaterial.opacity = 0; pose = 0; beanState = 'gone'; }

  let elapsed = 0;
  function update(dt, time = elapsed) {
    elapsed += dt;
    const follow = 1 - Math.exp(-dt * 2.2);
    current.pos.lerp(goal.pos, follow); current.look.lerp(goal.look, follow);
    camera.position.copy(current.pos); camera.lookAt(current.look);
    // Teacher idle bob + halo shimmer.
    body.position.y = .12 + Math.sin(time * 1.6) * .06;
    halo.rotation.z = time * .6; haloMaterial.opacity = .75 + Math.sin(time * 3) * .2;
    glow.intensity = 5 + Math.sin(time * 2) * 1.5;
    for (const cloud of clouds) { const d = cloud.userData; d.angle += d.speed * dt; cloud.position.x = Math.cos(d.angle) * d.radius; cloud.position.z = 6 + Math.sin(d.angle) * d.radius; }
    const p = moteGeometry.attributes.position;
    for (let i = 0; i < MOTES; i++) {
      let y = p.getY(i) + dt * (.25 + (moteSeeds[i] % 1) * .3);
      if (y > 6) y = 0;
      p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(time + moteSeeds[i]) * dt * .1);
    }
    p.needsUpdate = true;
    // Bean timelines.
    const spin = time * 1.4;
    beanCore.rotation.set(.35, spin, .2);
    if (beat) beat.t += dt;
    const k = beat ? span(beat.t, 0, beat.length) : 1;
    if (beanState === 'appear') {
      beanCore.scale.setScalar(BEAN_SIZE * ease(k)); aura.scale.setScalar(.32 * ease(k)); beanLight.intensity = 1.5 * k;
      bean.position.set(BEAN_GIFT.x, BEAN_GIFT.y + Math.sin(time * 2) * .04, BEAN_GIFT.z);
    } else if (beanState === 'give') {
      const e = ease(k);
      bean.position.lerpVectors(BEAN_GIFT, BEAN_HELD, e); bean.position.y += Math.sin(e * Math.PI) * .35 + Math.sin(time * 2) * .02;
      pose = 0;
    } else if (beanState === 'held') {
      bean.position.set(BEAN_HELD.x, BEAN_HELD.y + Math.sin(time * 2) * .02, BEAN_HELD.z);
    } else if (beanState === 'sniff') {
      const lift = ease(span(beat?.t ?? 9, 0, 1));
      pose = lift;
      bean.position.lerpVectors(BEAN_HELD, atFingers(fingers), lift);
      // Inhale: the bean glows brighter and the aura breathes.
      const inhale = span(beat?.t ?? 9, 1.1, 2.6);
      beanMaterial.emissiveIntensity = .25 + inhale * 1.2; beanLight.intensity = 1.5 + inhale * 1.5;
      aura.scale.setScalar(.26 + inhale * .12 + Math.sin(time * 6) * .02 * inhale);
    } else if (beanState === 'dissolve') {
      pose = 1 - ease(span(beat?.t ?? 9, 1, 1.8));
      const shrink = 1 - ease(span(k, 0, .7));
      beanCore.scale.setScalar(BEAN_SIZE * shrink); aura.scale.setScalar(.38 * (.4 + shrink * .6)); beanLight.intensity = 3 * shrink + .5;
      bean.position.lerpVectors(dissolveFrom, BEAN_MIND, ease(k));
      dustMaterial.opacity = Math.sin(Math.min(1, k * 1.3) * Math.PI) * .95;
      const p = dustGeometry.attributes.position;
      for (let i = 0; i < DUST; i++) {
        // Each mote spirals from around the bean into the forehead, staggered.
        const s0 = dustSeeds[i * 3], s1 = dustSeeds[i * 3 + 1], s2 = dustSeeds[i * 3 + 2];
        const m = ease(span(k, s0 * .45, s0 * .45 + .55)), r = (1 - m) * (.08 + s1 * .2), a = s2 * Math.PI * 2 + m * 5;
        p.setXYZ(i, THREE.MathUtils.lerp(dissolveFrom.x, BEAN_MIND.x, m) + Math.cos(a) * r, THREE.MathUtils.lerp(dissolveFrom.y, BEAN_MIND.y, m) + Math.sin(a) * r, THREE.MathUtils.lerp(dissolveFrom.z, BEAN_MIND.z, m) + Math.sin(a * .7) * r * .5);
      }
      p.needsUpdate = true;
      if (k >= 1) bean.visible = false;
    }
    if (beat && beat.t >= beat.length) {
      if (beanState === 'give') beanState = 'held';
      endBeat();
    }
    motion.update('rest', time);
    // Raise the right hand to the nose, bow the head a little towards it (pose 0 puts every bone back at rest).
    for (const [key, [x, y, z]] of Object.entries(SNIFF)) bend(bones[key], x * pose, y * pose, z * pose);
  }
  function resize(width, height) {
    camera.aspect = width / height;
    portrait = width < height;
    camera.fov = portrait ? 58 : 42;
    camera.updateProjectionMatrix();
    setShot(shot);
  }
  setShot('wide');
  update(0, 0);
  return {
    scene, camera, update, resize, setShot, showBean, giveBean, sniff, dissolve, finish,
    dispose() {
      beat = null;
      motion.dispose();
      disposeScene(scene);
      for (const item of owned) item.dispose?.();
      sky.dispose(); sun.shadow.dispose?.();
    },
  };
}
