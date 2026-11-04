import * as THREE from 'three';
import { loadPlayer } from '../../characters/load-player.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { loadModel } from '../../shared/three/models.js';

const FRAME_HEIGHT = 2.9; // bệ + nhân vật ~1.8m + khoảng thở rộng để người không chiếm hết khung
const PEDESTAL = .12;
const STAGE_Z = 2.2; // đứng lên phía trước hiên để hàng rào lùi xa sau lưng (sàn kéo tới z≈6)

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
  scene.fog = new THREE.Fog('#edf5e7', 8, 20); // sương sữa phủ dần từ hàng rào ra xa; khoảng cách đặt lại theo camera trong resize
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 120);
  camera.position.set(0, 1.55, 5.7); camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight('#f5f8ff', '#c3cfbc', 1.8));
  const light = new THREE.DirectionalLight('#fff4e4', 2.2); light.position.set(-3, 6, STAGE_Z + 5); light.target.position.set(0, 0, STAGE_Z); scene.add(light, light.target);
  // Bóng đổ thật lên bệ và sàn để nhân vật bám đất, không như dán lên nền.
  light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -.0005; light.shadow.normalBias = .02;
  Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 1, far: 20 });
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
  // Quầng sương sáng sau lưng nhân vật như bản gốc, làm nền mờ dịu quanh người.
  const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture, color: '#fffdf1', transparent: true, opacity: .85, depthWrite: false, toneMapped: false }));
  haze.position.set(0, 1.35, STAGE_Z - 2); haze.scale.set(6, 5, 1); scene.add(haze);
  const dustGeometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 70; i++) positions.push(Math.sin(i * 12.3) * 4, (i % 17) * .25, Math.cos(i * 7.1) * 3 - 2);
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ map: softTexture, color: '#c7a05b', size: .055, transparent: true, opacity: .65, depthWrite: false }));
  scene.add(dust);
  // Hiên gỗ nông trại làm sân khấu; thiếu file thì giữ nền trơn như cũ.
  // Nền đồi cà phê dựng lại trong Blender (assets-src/blender/build_selection_backdrop.py) thay cho đồi low-poly stage_farm.
  const [stage, backdrop] = await Promise.all([loadModel('selection/stage.glb'), loadModel('selection/backdrop.glb')]);
  if (backdrop) {
    // Nền chỉ làm phông: giảm độ rực và pha sương sữa để nhân vật nổi lên; lấy màu đất gần làm mặt đất phủ hai bên hiên.
    const mist = new THREE.Color('#edf5e7'), hsl = {}, color = new THREE.Color(), ground = new THREE.Color(0, 0, 0);
    let groundSamples = 0;
    backdrop.traverse(o => {
      const colors = o.geometry?.attributes.color;
      if (!colors) return;
      const positions = o.geometry.attributes.position;
      for (let i = 0; i < colors.count; i++) {
        color.fromBufferAttribute(colors, i).getHSL(hsl);
        color.setHSL(hsl.h, hsl.s * .55, hsl.l).lerp(mist, .3);
        colors.setXYZ(i, color.r, color.g, color.b);
        if (positions.getZ(i) > -6 && positions.getY(i) < .2) { ground.add(color); groundSamples++; }
      }
      colors.needsUpdate = true;
    });
    scene.add(backdrop);
    // Mặt đất rộng dưới cả cảnh để hai bên hiên không lộ khoảng trắng.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: groundSamples ? ground.multiplyScalar(1 / groundSamples) : mist, roughness: .9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.32; floor.receiveShadow = true; scene.add(floor);
  }
  if (stage) {
    stage.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    const farm = stage.getObjectByName('stage_farm');
    if (farm && backdrop) farm.visible = false;
    // Camera đứng ngoài mép sàn (z≈6.2) nên nhân bản dải ván z 0.2→6.2 ra phía trước, lệch đúng 6m (bội số bước ván 0.6m).
    stage.updateMatrixWorld(true);
    const deck = stage.getObjectByName('stage_proc');
    if (deck) {
      const source = deck.geometry.index ? deck.geometry.toNonIndexed() : deck.geometry;
      const plank = (i) => { const y = source.attributes.position.getY(i), z = source.attributes.position.getZ(i); return y > -.16 && y < .01 && z > .15 && z < 6.25; };
      const keep = [];
      for (let i = 0; i < source.attributes.position.count; i += 3) if (plank(i) && plank(i + 1) && plank(i + 2)) keep.push(i, i + 1, i + 2);
      const extension = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(source.attributes)) {
        const array = new attribute.array.constructor(keep.length * attribute.itemSize);
        keep.forEach((v, k) => { for (let c = 0; c < attribute.itemSize; c++) array[k * attribute.itemSize + c] = attribute.array[v * attribute.itemSize + c]; });
        extension.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
      }
      if (source !== deck.geometry) source.dispose();
      extension.translate(0, 0, 6);
      const front = new THREE.Mesh(extension, deck.material); front.receiveShadow = true;
      front.applyMatrix4(deck.matrixWorld); stage.add(front);
    }
    scene.add(stage);
  }
  const characters = [
    male,
    female,
  ];
  characters.forEach(character => { character.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(character); });
  // Focus reads through light, not size (05 §2): the other character keeps its height and steps into shade.
  const tints = characters.map(character => { const list = []; character.traverse(o => { if (o.isMesh) for (const m of [o.material].flat()) if (m.color && !list.some(t => t.m === m)) list.push({ m, base: m.color.clone() }); }); return list; });
  const shade = (index, k) => { for (const { m, base } of tints[index]) m.color.copy(base).multiplyScalar(k); };
  const shadows = characters.map(() => {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTexture, color: '#425244', transparent: true, opacity: .24, depthWrite: false, toneMapped: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = PEDESTAL + .012; scene.add(shadow); return shadow;
  });
  // Bệ đứng: người được chọn có viền vàng phát sáng và cột sáng mờ dần lên trên, người kia chỉ còn bệ gỗ trơn.
  // Vòm sáng sau lưng người được chọn như ảnh mẫu: lòng vàng trong mờ nhạt, viền vàng rõ; vẽ màu thật + blend thường để không chói trắng.
  const beamCanvas = document.createElement('canvas'); beamCanvas.width = 128; beamCanvas.height = 256;
  const beamCtx = beamCanvas.getContext('2d');
  const arch = () => { beamCtx.beginPath(); beamCtx.moveTo(10, 256); beamCtx.lineTo(10, 64); beamCtx.arc(64, 64, 54, Math.PI, 0); beamCtx.lineTo(118, 256); };
  const beamGradient = beamCtx.createLinearGradient(0, 0, 0, 256);
  beamGradient.addColorStop(0, 'rgba(255,226,140,.06)'); beamGradient.addColorStop(1, 'rgba(255,214,110,.3)');
  arch(); beamCtx.fillStyle = beamGradient; beamCtx.fill();
  beamCtx.shadowColor = 'rgba(255,200,80,.8)'; beamCtx.shadowBlur = 6; beamCtx.lineWidth = 3; beamCtx.strokeStyle = 'rgba(240,184,64,.95)'; arch(); beamCtx.stroke();
  const beamTexture = new THREE.CanvasTexture(beamCanvas);
  const plainTop = new THREE.Color('#d8c6a8'), goldTop = new THREE.Color('#f3d27a');
  const pedestals = characters.map(() => {
    const base = new THREE.Group();
    const top = new THREE.MeshStandardMaterial({ color: plainTop.clone(), roughness: .7, emissive: '#ffcf5a', emissiveIntensity: 0 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(.62, .68, PEDESTAL, 48), [new THREE.MeshStandardMaterial({ color: '#b89a74', roughness: .8 }), top, top]);
    plinth.position.y = PEDESTAL / 2; plinth.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.64, .03, 12, 64), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = PEDESTAL;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: softTexture, color: '#ffd76a', transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = PEDESTAL + .005;
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.24 * 128 / 108, 2.4), new THREE.MeshBasicMaterial({ map: beamTexture, transparent: true, depthWrite: false, toneMapped: false }));
    // Đặt ở tâm bệ, vòm (108/128 bề ngang canvas) rộng đúng đường kính mặt bệ để hai chân vòm chạm mép bệ.
    beam.position.set(0, PEDESTAL + 1.2, 0);
    base.add(plinth, ring, halo, beam); scene.add(base);
    return { base, top, ring, halo, beam };
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
      character.position.z = STAGE_Z - .5 * (1 - focus);
      character.position.y = PEDESTAL;
      character.scale.setScalar(.92 + focus * .08); shade(index, .55 + focus * .45);
      rotations[index] = reduced ? desiredRotations[index] : THREE.MathUtils.lerp(rotations[index], desiredRotations[index], 1 - Math.exp(-20 * dt));
      character.rotation.y = rotations[index] + distance * -.25;
      shadows[index].position.x = character.position.x;
      shadows[index].position.z = character.position.z;
      shadows[index].scale.set(1.25 * character.scale.x, .8 * character.scale.x, 1);
      shadows[index].material.opacity = .14 + focus * .1;
      const pedestal = pedestals[index], glow = focus * focus;
      pedestal.base.position.set(character.position.x, 0, character.position.z); pedestal.base.scale.setScalar(character.scale.x);
      pedestal.top.color.lerpColors(plainTop, goldTop, glow); pedestal.top.emissiveIntensity = glow * .35;
      const pulse = reduced ? 1 : .85 + Math.sin(time * 2.4) * .15;
      pedestal.ring.material.opacity = glow * pulse; pedestal.halo.material.opacity = glow * .3 * pulse; pedestal.beam.material.opacity = glow;
      pedestal.ring.visible = pedestal.halo.visible = pedestal.beam.visible = glow > .01;
    });
    haze.material.opacity = reduced ? .85 : .83 + Math.sin(time * .7) * .04;
    dust.rotation.y = reduced ? 0 : time * .025;
    dust.position.y = reduced ? 0 : Math.sin(time * .3) * .12;
  }
  // Toạ độ màn hình của người đang chọn để HTML đặt mũi tên (ngang thắt lưng) và dấu tích (mép trước bệ).
  const anchorPoint = new THREE.Vector3();
  function anchor(width, height) {
    const character = characters[target], x = character.position.x, z = character.position.z;
    const project = (px, py, pz) => { anchorPoint.set(px, py, pz).project(camera); return [(anchorPoint.x + 1) / 2 * width, (1 - anchorPoint.y) / 2 * height]; };
    const [fx, fy] = project(x, PEDESTAL + 1, z), [side] = project(x + .78, PEDESTAL + 1, z), [, fb] = project(x, 0, z + .66);
    return { fx, fy, fw: side - fx, fb };
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
    camera.fov = width < 700 ? 40 : 30; // ống kính hẹp: nền bị nén lại phía sau, sàn gỗ không chiếm nửa màn
    const phoneLandscape = height < 500 && width > height;
    // Khung nhân vật = từ mép trên tới mép trên bảng tạo nhân vật; bảng còn ẩn (chưa đo được) thì ước 300px.
    const card = document.getElementById('player-form')?.getBoundingClientRect();
    const bottom = phoneLandscape ? height - 48 : card?.height ? card.top - 64 : height - 344; // chừa tab Nam/Nữ nhô lên trên bảng + dấu tích dưới bệ
    const top = height * .06, room = Math.max(bottom - top, height * .4);
    // Bề ngang dành cho nhân vật: xoay ngang thì chỉ phần bên trái bảng (bảng ở bên phải).
    const free = phoneLandscape ? (card?.width ? card.left : width * .6) : width;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Lùi camera vừa đủ để nhân vật (kèm khoảng thở) lấp đúng khoảng trống đó; camera ngang tầm ngực để sàn không phình ra.
    const distance = FRAME_HEIGHT * height / (room * 2 * tanHalf);
    camera.position.set(0, FRAME_HEIGHT / 2, STAGE_Z + distance); camera.lookAt(0, FRAME_HEIGHT / 2, STAGE_Z);
    scene.fog.near = STAGE_Z + distance + 2.3; scene.fog.far = STAGE_Z + distance + (backdrop ? 45 : 14.3); // sương bắt đầu quanh hàng rào; nền mới nhạt dần tới núi xa z≈-48
    // Tối thiểu 1.4 để hai bệ (bán kính ~.62) không chồng nhau và mũi tên không đè người bên cạnh; màn hẹp thì người kia ló một nửa ở mép.
    spacing = THREE.MathUtils.clamp(tanHalf * distance * free / height - .4, 1.4, 2.4);
    // Dời tâm khung lên giữa khoảng trống; xoay ngang thì dời nhân vật vào giữa phần bên trái bảng.
    camera.setViewOffset(width, height, (width - free) / 2, height / 2 - (top + room / 2), width, height);
    camera.updateProjectionMatrix();
  }
  function takePlayer() {
    const selected = characters[target];
    characters.forEach((_, index) => shade(index, 1)); // the chosen model goes on into the game at full brightness
    scene.remove(selected);
    selected.position.set(0, 0, 0); selected.rotation.set(0, 0, 0); selected.scale.setScalar(1);
    selected.updateMatrixWorld(true);
    return selected;
  }
  update(0);
  return { scene, camera, takePlayer, select, anchor, pick, beginDrag, drag, rotate, endDrag, update, resize, dispose: () => disposeScene(scene) };
}
