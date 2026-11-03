import * as THREE from 'three';
import { loadPlayer } from '../../characters/load-player.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { loadModel } from '../../shared/three/models.js';

export async function createSelection(gender, onSelect = () => {}, onProgress) {
  const fractions = [0, 0];
  const [male, female] = await Promise.all(['male.glb', 'girl.glb'].map(async (filename, index) => {
    const model = await loadPlayer(filename, progress => {
      if (progress.total > 0) {
        fractions[index] = progress.loaded / progress.total;
        onProgress?.({ loaded: fractions[0] + fractions[1], total: 2 });
      }
    });
    fractions[index] = 1;
    onProgress?.({ loaded: fractions[0] + fractions[1], total: 2 });
    return model;
  }));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#edf5e7');
  scene.fog = new THREE.Fog('#edf5e7', 8, 20);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 40);
  camera.position.set(0, 1.55, 5.7); camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight('#f5f8ff', '#c3cfbc', 1.8));
  const light = new THREE.DirectionalLight('#fff4e4', 2.2); light.position.set(-3, 4, 5); scene.add(light);
  const fill = new THREE.DirectionalLight('#e5efff', .9); fill.position.set(4, 2, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight('#dcf5ef', 2.6); rim.position.set(1, 3, -3); scene.add(rim);
  const softCanvas = document.createElement('canvas'); softCanvas.width = softCanvas.height = 128;
  const ctx = softCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.35, 'rgba(255,255,255,.65)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const softTexture = new THREE.CanvasTexture(softCanvas);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture, color: '#fffdf1', transparent: true, opacity: .85, depthWrite: false, toneMapped: false }));
  halo.position.set(0, 1.35, -2); halo.scale.set(6, 5, 1); scene.add(halo);
  const dustGeometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 70; i++) positions.push(Math.sin(i * 12.3) * 4, (i % 17) * .25, Math.cos(i * 7.1) * 3 - 2);
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ map: softTexture, color: '#c7a05b', size: .055, transparent: true, opacity: .65, depthWrite: false }));
  scene.add(dust);
  // Hiên gỗ nông trại làm sân khấu; thiếu file thì giữ nền trơn như cũ.
  const stage = await loadModel('selection/stage.glb');
  if (stage) { stage.traverse(o => { if (o.isMesh) o.receiveShadow = true; }); scene.add(stage); }
  const characters = [
    male,
    female,
  ];
  characters.forEach(character => scene.add(character));
  const shadows = characters.map(() => {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTexture, color: '#425244', transparent: true, opacity: .24, depthWrite: false, toneMapped: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .012; scene.add(shadow); return shadow;
  });
  let position = gender === 'female' ? 1 : 0;
  let target = position;
  let spacing = 2.2;
  let dragging = false;
  let dragOrigin = position;
  let lastTime = null;
  const rotations = [0, 0];
  const desiredRotations = [0, 0];
  let rotationOrigin = 0;
  let rotatingIndex = target;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function select(value) {
    const next = value === 'female' ? 1 : 0;
    target = next;
    dragging = false;
    onSelect(value);
  }
  function beginDrag() {
    dragging = true; dragOrigin = position;
    rotatingIndex = target; rotationOrigin = desiredRotations[rotatingIndex];
  }
  function drag(delta) {
    const next = dragOrigin - delta;
    position = next < 0 ? -Math.min(.14, -next * .2) : next > 1 ? 1 + Math.min(.14, (next - 1) * .2) : next;
  }
  function rotate(delta) {
    dragging = false;
    desiredRotations[rotatingIndex] = rotationOrigin + delta * .018;
  }
  function endDrag(cancelled = false) {
    if (!dragging) return;
    dragging = false;
    if (!cancelled) {
      const distance = position - dragOrigin;
      target = Math.abs(distance) > .16 ? (distance > 0 ? 1 : 0) : Math.round(dragOrigin);
      onSelect(target === 1 ? 'female' : 'male');
    }
  }
  function update(time) {
    const dt = lastTime === null ? 0 : Math.min(time - lastTime, .1);
    lastTime = time;
    if (!dragging) {
      position = reduced ? target : THREE.MathUtils.lerp(position, target, 1 - Math.exp(-13 * dt));
      if (Math.abs(position - target) < .0001) position = target;
    }
    characters.forEach((character, index) => {
      const distance = index - position;
      const focus = 1 - Math.min(1, Math.abs(distance));
      character.position.x = distance * spacing;
      character.position.z = -.5 * (1 - focus);
      character.position.y = 0;
      character.scale.setScalar(.68 + focus * .32);
      rotations[index] = reduced ? desiredRotations[index] : THREE.MathUtils.lerp(rotations[index], desiredRotations[index], 1 - Math.exp(-20 * dt));
      character.rotation.y = rotations[index] + distance * -.25;
      shadows[index].position.x = character.position.x;
      shadows[index].position.z = character.position.z;
      shadows[index].scale.set(1.25 * character.scale.x, .8 * character.scale.x, 1);
      shadows[index].material.opacity = .14 + focus * .1;
    });
    halo.material.opacity = reduced ? .85 : .83 + Math.sin(time * .7) * .04;
    dust.rotation.y = reduced ? 0 : time * .025;
    dust.position.y = reduced ? 0 : Math.sin(time * .3) * .12;
  }
  const raycaster = new THREE.Raycaster();
  const pointerPosition = new THREE.Vector2();
  function pick(x, y, bounds) {
    pointerPosition.set((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1);
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointerPosition, camera);
    const hit = raycaster.intersectObjects(characters, true)[0];
    if (!hit) return;
    let object = hit.object;
    while (object.parent && !characters.includes(object)) object = object.parent;
    const index = characters.indexOf(object);
    if (index >= 0) select(index === 1 ? 'female' : 'male');
  }
  function resize(width, height) {
    camera.aspect = width / height;
    camera.fov = width < 700 ? 48 : 46;
    spacing = Math.min(2.4, Math.max(.75, Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 5.7 * camera.aspect - .4));
    // Nâng nhân vật lên trên bảng tạo nhân vật ở đáy màn.
    camera.setViewOffset(width, height, 0, height * (width < 700 ? .17 : .24), width, height);
    camera.updateProjectionMatrix();
  }
  function takePlayer() {
    const selected = characters[target];
    scene.remove(selected);
    selected.position.set(0, 0, 0); selected.rotation.set(0, 0, 0); selected.scale.setScalar(1);
    selected.updateMatrixWorld(true);
    return selected;
  }
  update(0);
  return { scene, camera, takePlayer, select, pick, beginDrag, drag, rotate, endDrag, update, resize, dispose: () => disposeScene(scene) };
}
