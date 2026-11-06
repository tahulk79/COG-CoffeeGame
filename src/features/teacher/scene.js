// Teacher scene: a calm heavenly plaza at golden hour. The player stands before the Teacher ("Thầy"), who floats gently
// with a halo; behind the player stands the World Gate. Cinematic camera only — no walking input.
// API: createTeacherScene({ character }) → { scene, camera, update(dt, time), resize(w, h), setShot(name), openGate() → Promise, skipGate(), dispose() }
import * as THREE from 'three';
import { loadModel } from '../../shared/three/models.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { createPlayerMotion } from '../../characters/motion.js';

const TEACHER = new THREE.Vector3(0, 0, 4.4);
const PLAYER = new THREE.Vector3(0, .05, 8);
const GATE = new THREE.Vector3(0, 0, 13);
const TEACHER_HEIGHT = 2;
// Camera shots: [position, look-at]. Portrait screens get a wider lens in resize().
const SHOTS = {
  wide: [[6.5, 5, 16], [0, 1.4, 6]],
  talk: [[2.8, 2.1, 11.4], [0, 1.6, 5]],
  claim: [[1.5, 2.1, 8.4], [0, 1.9, 4.4]],
  gate: [[-3.4, 2.6, 6.2], [0, 2.4, 13]],
};

// Vertical sky gradient as a cheap screen-space background.
function skyTexture() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 4, height: 256 });
  const g = canvas.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#9fd2ee'); grad.addColorStop(.45, '#ffe7c2'); grad.addColorStop(.75, '#ffd7a8'); grad.addColorStop(1, '#fff3dc');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
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

  // World Gate behind the player: GLB frame + two hinged leaves (fallback: golden arch), light sheet that brightens on open.
  const gate = new THREE.Group(); gate.position.copy(GATE); gate.rotation.y = Math.PI; scene.add(gate);
  const gold = own(new THREE.MeshStandardMaterial({ color: '#e2c27a', roughness: .5, metalness: .1 }));
  if (frame) gate.add(frame);
  else { const arch = new THREE.Mesh(own(new THREE.TorusGeometry(1.9, .2, 10, 32, Math.PI)), gold); arch.position.y = 3.2; gate.add(arch); for (const x of [-1.9, 1.9]) { const post = new THREE.Mesh(own(new THREE.BoxGeometry(.35, 3.2, .35)), gold); post.position.set(x, 1.6, 0); gate.add(post); } }
  const hinges = [-1, 1].map(side => {
    const hinge = new THREE.Group(); hinge.position.x = side * 1.65; gate.add(hinge);
    const leaf = side === -1 ? leftLeaf : rightLeaf;
    if (leaf) hinge.add(leaf);
    else { const door = new THREE.Mesh(own(new THREE.BoxGeometry(1.65, 3, .12)), gold); door.position.set(-side * .825, 1.5, 0); hinge.add(door); }
    return { hinge, side };
  });
  const lightMaterial = own(new THREE.MeshBasicMaterial({ color: '#fff4c4', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  const sheet = new THREE.Mesh(own(new THREE.PlaneGeometry(3.3, 3.2)), lightMaterial); sheet.position.set(0, 1.6, .05); gate.add(sheet);
  const gateLight = new THREE.PointLight('#fff0b8', 0, 14, 1.6); gateLight.position.set(0, 2, -1); gate.add(gateLight);
  gate.traverse(o => { if (o.isMesh && o !== sheet) o.castShadow = true; });

  // Camera follows the current shot with exponential easing.
  const current = { pos: new THREE.Vector3(...SHOTS.wide[0]), look: new THREE.Vector3(...SHOTS.wide[1]) };
  const goal = { pos: current.pos.clone(), look: current.look.clone() };
  let shot = 'wide', portrait = false;
  function setShot(name) {
    const [pos, look] = SHOTS[name] || SHOTS.talk; shot = name;
    goal.pos.set(...pos); goal.look.set(...look);
    if (portrait) goal.pos.sub(goal.look).multiplyScalar(1.25).add(goal.look); // step back a little on tall screens
  }

  // Gate opening: leaves swing open, light floods out, the player walks into the light.
  let opening = null; // { t, resolve }
  const OPEN_SECONDS = 3.2;
  function openGate() {
    setShot('gate');
    return new Promise(resolve => { opening = { t: 0, resolve }; });
  }
  function skipGate() { if (opening) opening.t = OPEN_SECONDS; }

  let elapsed = 0;
  function update(dt, time = elapsed) {
    elapsed += dt;
    const ease = 1 - Math.exp(-dt * 2.2);
    current.pos.lerp(goal.pos, ease); current.look.lerp(goal.look, ease);
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
    if (opening) {
      opening.t += dt;
      const k = THREE.MathUtils.smoothstep(opening.t, 0, 1.6);
      for (const { hinge, side } of hinges) hinge.rotation.y = side * k * 1.6;
      lightMaterial.opacity = k * .9; gateLight.intensity = k * 30;
      const walk = THREE.MathUtils.smoothstep(opening.t, .9, OPEN_SECONDS);
      if (walk > 0) {
        character.rotation.y = 0;
        character.position.z = THREE.MathUtils.lerp(PLAYER.z, GATE.z - .3, walk);
        motion.update('walk', opening.t, 1);
      }
      if (opening.t >= OPEN_SECONDS) { const done = opening.resolve; opening = null; done(); }
    } else motion.update('rest', time);
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
    scene, camera, update, resize, setShot, openGate, skipGate,
    dispose() {
      opening = null;
      motion.dispose();
      disposeScene(scene);
      for (const item of owned) item.dispose?.();
      sky.dispose(); sun.shadow.dispose?.();
    },
  };
}
