import * as THREE from 'three';
import { REGIONS, TYPE_ICON, TYPE_COLOR } from './content.js';
import { project } from './geo.js';
import { buildTerrain, DEEP } from './terrain.js';
import { questsFor } from '../farm/content.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { sfx } from '../../shared/audio/index.js';
import { t } from '../../i18n/index.js';

// Bản đồ thế giới (docs/screens/02b-world-map/README.md): sa bàn 3D nằm ngang với địa hình liền mạch (terrain.js): bờ biển
// thoải, đồng bằng, núi theo dãy thật, tuyết ở đỉnh và hai cực; mặt nước trong thấy đáy nông màu ngọc; nắng đổ bóng thật.
// Kéo để trượt, chụm/lăn để phóng. Mỗi nơi có viền quốc gia vàng mờ trên địa hình + nhãn tên nhỏ. Chạm vào trong viền: khối
// hình quốc gia trồi lên khỏi mặt đất (lò xo nảy), đổ bóng xuống; thẻ chỉ ghi địa lý (địa hình, khí hậu, độ cao…), không lộ
// trồng/quán. Chốt (onPick, đã lưu): bay cao hơn, mặt khối + cờ đổi màu loại, cây/tách nảy ra, thẻ kết quả + nhiệm vụ riêng.
const BOUNDS = { minX: -13, maxX: 14, minZ: -8, maxZ: 5 };
const ZOOM = { min: 6, max: 22 };
const WATER = .02;
const DEPTH = .22; // bề dày khối quốc gia
const NEUTRAL_FLAG = '#f3e7c9', HIGHLIGHT = '#ffd25e';

const inside = ([lon, lat], ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

export function createWorldMap({ onPick, onChoose, onClose, chosen = null }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cdebf5');
  scene.fog = new THREE.Fog('#cdebf5', 24, 46);
  const camera = new THREE.PerspectiveCamera(40, 1, .3, 120);
  scene.add(new THREE.HemisphereLight('#f4fbff', '#5f7a6a', 1.35));
  // Nắng chiếu xiên đổ bóng núi và bóng đảo nổi; vùng bóng đi theo camera để giữ nét khi phóng gần.
  const sun = new THREE.DirectionalLight('#fff1d6', 2.6); sun.position.set(-6, 10, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 }); sun.shadow.bias = -.0008; sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);

  const terrain = buildTerrain(); scene.add(terrain.mesh);
  // Đáy biển sâu trải rộng ngoài tấm địa hình, cùng màu đáy sâu để không lộ mép hình chữ nhật.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 70), new THREE.MeshStandardMaterial({ color: DEEP, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.41; floor.receiveShadow = true; scene.add(floor);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshStandardMaterial({ color: '#3d9fd3', roughness: .18, metalness: .05, transparent: true, opacity: .72, depthWrite: false }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = WATER; ocean.receiveShadow = true; ocean.renderOrder = 1; scene.add(ocean);

  // Khối hình quốc gia + cờ của từng nơi. Lúc nghỉ khối ẩn dưới đất, chỉ có viền vàng mờ trên địa hình báo chạm được.
  const pole = new THREE.MeshStandardMaterial({ color: '#6b4a2c' }), leaf = new THREE.MeshStandardMaterial({ color: '#2f6e34', flatShading: true });
  const cupMaterial = new THREE.MeshStandardMaterial({ color: '#fbf6ec' }), coffee = new THREE.MeshStandardMaterial({ color: '#5a3520' });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: '#9a7650', roughness: .95 });
  const regions = REGIONS.map(region => {
    const [x, z] = project(region.lon, region.lat), ground = Math.max(WATER, terrain.heightAt(region.lon, region.lat));
    const anchor = new THREE.Group(), tile = new THREE.Group(), lift = new THREE.Group(), landmarks = new THREE.Group();
    anchor.position.set(x, 0, z);
    // Đỉnh cao nhất trong viền (lấy mẫu lưới) để khối trồi lên không bị núi xuyên qua.
    const lons = region.outline.map(p => p[0]), lats = region.outline.map(p => p[1]);
    let top = ground;
    for (let lo = Math.min(...lons); lo <= Math.max(...lons); lo += .5) for (let la = Math.min(...lats); la <= Math.max(...lats); la += .5) if (inside([lo, la], region.outline)) top = Math.max(top, terrain.heightAt(lo, la));
    // Shape nằm trong mặt XY (y = −z) rồi xoay nằm ngang: bề dày đùn thành chiều cao.
    const shape = new THREE.Shape(region.outline.map(([lon, lat]) => { const [px, pz] = project(lon, lat); return new THREE.Vector2(px - x, -(pz - z)); }));
    const slab = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: .03, bevelSize: .025, bevelSegments: 2 });
    slab.rotateX(-Math.PI / 2);
    const flag = new THREE.MeshStandardMaterial({ color: NEUTRAL_FLAG, flatShading: true });
    const tileTop = new THREE.MeshStandardMaterial({ color: '#86b85f', roughness: .9, emissive: HIGHLIGHT, emissiveIntensity: 0 });
    const block = new THREE.Mesh(slab, [tileTop, sideMaterial]); block.castShadow = block.receiveShadow = true;
    // Viền quốc gia phủ theo địa hình (chia nhỏ từng cạnh để bám núi/đồi).
    const border = [];
    region.outline.forEach(([lon, lat], i) => {
      const [lon2, lat2] = region.outline[(i + 1) % region.outline.length], steps = Math.max(1, Math.ceil(Math.hypot(lon2 - lon, lat2 - lat) / 1.5));
      for (let k = 0; k < steps; k++) {
        const lo = lon + (lon2 - lon) * k / steps, la = lat + (lat2 - lat) * k / steps, [px, pz] = project(lo, la);
        border.push(new THREE.Vector3(px - x, Math.max(WATER, terrain.heightAt(lo, la)) + .03, pz - z));
      }
    });
    const outline = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(border, true), border.length * 2, .035, 4, true), new THREE.MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, opacity: .5, depthWrite: false }));
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .85, 6), pole); stick.position.y = .45; stick.castShadow = true;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(.4, .25, .02), flag); banner.position.set(.21, .75, 0); banner.castShadow = true;
    lift.position.y = DEPTH + .03; lift.add(stick, banner, landmarks); landmarks.visible = false; landmarks.scale.setScalar(.01);
    if (region.type !== 'cafe') {
      const tree = new THREE.Group(), trunk = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, .18, 5), pole), crown = new THREE.Mesh(new THREE.ConeGeometry(.15, .38, 6), leaf);
      trunk.position.y = .09; crown.position.y = .36; tree.add(trunk, crown); tree.position.set(-.28, 0, .18); tree.traverse(o => { o.castShadow = true; }); landmarks.add(tree);
    }
    if (region.type !== 'farm') {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(.13, .1, .18, 12), cupMaterial), cupTop = new THREE.Mesh(new THREE.CircleGeometry(.12, 12), coffee);
      cupTop.rotation.x = -Math.PI / 2; cupTop.position.y = .091; cup.add(cupTop); cup.position.set(region.type === 'both' ? .28 : -.26, .09, .22); cup.castShadow = true; landmarks.add(cup);
    }
    tile.add(block, lift); tile.visible = false;
    const rest = top - DEPTH - .03; // mặt khối ngang đỉnh cao nhất khi vừa trồi
    tile.position.y = rest;
    anchor.add(outline, tile); scene.add(anchor);
    anchor.traverse(object => { object.userData.region = region.id; });
    return { region, x, z, ground, rest, anchor, tile, lift, tileTop, outline, flag, landmarks, rise: 0, speed: 0 };
  });

  // DOM: tiêu đề, nút đóng, nhãn từng nơi (bấm được), thẻ chọn ở đáy. Chỉ các nút nhận chạm.
  const events = new AbortController(), signal = events.signal;
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const root = el('section'); root.id = 'world-map'; root.setAttribute('aria-label', t('world.label'));
  const header = el('header', 'world-map__header'); header.append(el('h2', 'world-map__title', t('world.title')));
  const close = el('button', 'ui-close world-map__close', '×'); close.type = 'button'; close.setAttribute('aria-label', t('world.close')); close.title = t('world.close');
  const pins = el('div', 'world-map__pins'), card = el('div', 'world-map__card'); card.setAttribute('role', 'status');
  root.append(pins, header, close, card); document.body.append(root); document.body.classList.add('world-map-open');
  const pinFor = new Map(regions.map(entry => {
    const pin = el('button', 'world-map__pin'); pin.type = 'button';
    pin.append(el('span', 'world-map__icon', '🚩'), el('span', 'world-map__pin-name', entry.region.name));
    pin.addEventListener('click', () => select(entry.region.id), { signal });
    pins.append(pin); return [entry, pin];
  }));

  let selected = null, confirming = false, revealed = null, popTime = 0;
  const view = { x: 2, z: -1.5, distance: 20 }, goal = { ...view }, velocity = { x: 0, z: 0 };
  const clampView = target => { target.x = THREE.MathUtils.clamp(target.x, BOUNDS.minX, BOUNDS.maxX); target.z = THREE.MathUtils.clamp(target.z, BOUNDS.minZ, BOUNDS.maxZ); };
  const button = (label, style, run) => { const b = el('button', `ui-btn ${style}`, label); b.type = 'button'; b.addEventListener('click', run, { signal }); return b; };
  function renderCard() {
    card.replaceChildren();
    const region = REGIONS.find(item => item.id === (revealed || selected));
    card.dataset.type = revealed ? region.type : '';
    card.classList.toggle('is-revealed', Boolean(revealed));
    if (!region) { card.append(el('p', 'world-map__hint', `👆 ${t('world.hint')}`)); return; }
    const name = el('div', 'world-map__name'); name.append(el('strong', '', revealed ? t('world.reveal.title', { name: region.name }) : region.name), el('small', '', region.place));
    const head = el('div', 'world-map__head'); head.append(name);
    const actions = el('div', 'world-map__actions');
    if (!revealed) {
      // Chưa chốt: chỉ tên, nơi chốn và một câu gợi không khí — không lộ có nông trại hay quán.
      // Chưa chốt: chỉ địa lý (địa hình, khí hậu, nhiệt độ, mưa, độ cao) — không lộ trồng được gì hay có quán.
      const facts = el('ul', 'world-map__features world-map__facts');
      if (!confirming) for (const fact of region.facts) { const item = el('li', 'is-info'); item.append(el('span', 'world-map__mark', fact.icon), el('span', '', `${t(`world.fact.${fact.key}`)}: `), el('b', '', fact.value)); facts.append(item); }
      card.append(head, el('p', 'world-map__note', confirming ? t('world.confirm', { name: region.name }) : region.teaser), facts, actions);
      if (confirming) actions.append(button(t('world.confirmBack'), 'ui-btn--plain', () => { confirming = false; renderCard(); }), button(t('world.confirmGo'), 'ui-btn--go ui-btn--lg', () => reveal(region.id)));
      else actions.append(button(t('world.choose'), 'ui-btn--go ui-btn--lg', () => { confirming = true; renderCard(); }));
      actions.lastElementChild.focus({ preventScroll: true });
      return;
    }
    const badge = el('span', `world-map__chip is-${region.type}`); badge.append(el('span', 'world-map__icon', TYPE_ICON[region.type]), el('span', '', t(`world.type.${region.type}`)));
    head.append(badge);
    // Làm được gì, bán gì, mua gì: đọc là biết nơi chỉ trồng hay chỉ quán.
    const features = el('ul', 'world-map__features');
    const line = (cls, mark, text) => { const item = el('li', cls); item.append(el('span', 'world-map__mark', mark), el('span', '', text)); features.append(item); };
    line(region.type !== 'cafe' ? 'is-on' : 'is-off', region.type !== 'cafe' ? '✓' : '✕', t(`world.feature.farm.${region.type !== 'cafe' ? 'on' : 'off'}`));
    line(region.type !== 'farm' ? 'is-on' : 'is-off', region.type !== 'farm' ? '✓' : '✕', t(`world.feature.cafe.${region.type !== 'farm' ? 'on' : 'off'}`));
    line('is-info', '💰', t(`world.sell.${region.type}`));
    line('is-info', '🛒', t(`world.buy.${region.type}`));
    const crops = el('p', 'world-map__crops'); crops.append(el('b', '', `${t('world.crops')}: `), document.createTextNode(region.crops));
    const quests = el('ol', 'world-map__quests');
    for (const quest of questsFor(region.id).slice(-2)) { const item = el('li'); item.append(el('span', '', quest.title), el('b', '', `+${quest.coins}`)); quests.append(item); }
    card.append(head, features, crops, el('p', 'world-map__note', region.note), el('h3', 'world-map__subtitle', `🎯 ${t('world.quests')}`), quests, el('p', 'world-map__balance', t(`world.balance.${region.type}`)), actions);
    actions.append(button(t('world.reveal.start'), 'ui-btn--go ui-btn--lg', () => onChoose(region.id)));
    actions.lastElementChild.focus({ preventScroll: true });
  }
  function focusOn(entry, distance) { goal.x = entry.x; goal.z = entry.z + 1.6; goal.distance = Math.min(goal.distance, distance); clampView(goal); velocity.x = velocity.z = 0; }
  function select(id) {
    if (revealed || selected === id) return;
    selected = id; confirming = false;
    const entry = regions.find(item => item.region.id === id); entry.speed += 5; // cú bật đầu cho lò xo
    focusOn(entry, 15);
    sfx('ui.open');
    for (const [item, pin] of pinFor) pin.classList.toggle('is-selected', item.region.id === id);
    renderCard();
  }
  // Chốt nơi: lưu (onPick), đóng đường lui, lộ loại nơi bằng hoạt cảnh rồi hiện thẻ kết quả.
  function reveal(id, silent = false) {
    if (revealed) return;
    if (!silent) onPick(id);
    selected = revealed = id; confirming = false; popTime = 0;
    const entry = regions.find(item => item.region.id === id), color = TYPE_COLOR[entry.region.type];
    entry.flag.color.set(color); entry.tileTop.color.set(color).lerp(new THREE.Color('#ffffff'), .25); entry.tileTop.emissive.set(color); entry.outline.material.color.set(color); entry.landmarks.visible = true;
    entry.speed += 9;
    for (const [item, pin] of pinFor) { pin.classList.toggle('is-selected', item === entry); pin.classList.toggle('is-revealed', item === entry); pin.disabled = item !== entry; if (item === entry) { pin.dataset.type = entry.region.type; pin.firstElementChild.textContent = TYPE_ICON[entry.region.type]; } }
    root.classList.add('is-revealed'); close.hidden = true;
    focusOn(entry, 12);
    if (!silent) sfx('ui.buy');
    renderCard();
  }

  // Kéo một ngón: bản đồ bám đúng ngón tay (không trễ), thả nhanh thì trôi theo quán tính. Hai ngón: chụm để phóng. Chạm không kéo: chọn nơi.
  const pointers = new Map(), raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pinch = 0, moved = false, lastMove = 0;
  const unitsPerPixel = () => 2 * view.distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('#game canvas')) return;
    event.target.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    if (pointers.size === 1) moved = false;
    velocity.x = velocity.z = 0; goal.x = view.x; goal.z = view.z;
  }, { capture: true, signal });
  document.addEventListener('pointermove', event => {
    const point = pointers.get(event.pointerId); if (!point) return;
    event.preventDefault();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], before = Math.hypot(a.x - b.x, a.y - b.y);
      point.x = event.clientX; point.y = event.clientY;
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch && after) goal.distance = THREE.MathUtils.clamp(goal.distance * before / after, ZOOM.min, ZOOM.max);
      pinch = after; moved = true; return;
    }
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    point.x = event.clientX; point.y = event.clientY;
    if (!moved && Math.hypot(event.clientX - point.startX, event.clientY - point.startY) < 8) return;
    moved = true;
    // Camera nghiêng ~55°: một pixel dọc màn hình ứng với nhiều đất hơn theo z.
    const scale = unitsPerPixel(), now = performance.now(), dt = Math.max(16, now - lastMove) / 1000; lastMove = now;
    const mx = -dx * scale, mz = -dy * scale * 1.25;
    view.x = goal.x = THREE.MathUtils.clamp(view.x + mx, BOUNDS.minX, BOUNDS.maxX);
    view.z = goal.z = THREE.MathUtils.clamp(view.z + mz, BOUNDS.minZ, BOUNDS.maxZ);
    velocity.x = velocity.x * .6 + mx / dt * .4; velocity.z = velocity.z * .6 + mz / dt * .4;
  }, { capture: true, passive: false, signal });
  const release = event => {
    if (!pointers.has(event.pointerId)) return;
    const wasTap = !moved && pointers.size === 1;
    pointers.delete(event.pointerId); pinch = 0;
    if (pointers.size || performance.now() - lastMove > 80) velocity.x = velocity.z = 0; // giữ yên rồi mới thả: không trôi
    if (!wasTap || event.type !== 'pointerup' || revealed) return;
    const rect = event.target.getBoundingClientRect();
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([...regions.map(entry => entry.anchor), terrain.mesh], true)[0];
    if (!hit) return;
    if (hit.object.userData.region) { select(hit.object.userData.region); return; }
    // Chạm vào trong viền quốc gia; nước nhỏ (Kenya, Ý) thì chạm gần (≤ 0,8 đơn vị) cũng được.
    const point = [hit.point.x * 12, -hit.point.z * 9], within = regions.find(entry => inside(point, entry.region.outline));
    if (within) { select(within.region.id); return; }
    const near = regions.map(entry => ({ entry, distance: Math.hypot(hit.point.x - entry.x, hit.point.z - entry.z) })).sort((a, b) => a.distance - b.distance)[0];
    if (near.distance < .8) select(near.entry.region.id);
  };
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, release, { capture: true, signal });
  document.addEventListener('wheel', event => {
    if (!event.target.closest('#game canvas')) return;
    event.preventDefault(); goal.distance = THREE.MathUtils.clamp(goal.distance * (event.deltaY > 0 ? 1.1 : .9), ZOOM.min, ZOOM.max);
  }, { passive: false, signal });
  close.addEventListener('click', () => onClose(), { signal });
  const held = new Set();
  const KEYS = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };

  if (REGIONS.some(region => region.id === chosen)) reveal(chosen, true); else renderCard();
  const anchor = new THREE.Vector3();
  return {
    scene, camera,
    resize(width, height) { camera.aspect = width / height; camera.fov = width < height ? 55 : 40; camera.updateProjectionMatrix(); },
    update(dt) {
      for (const code of held) { goal.x += KEYS[code][0] * dt * 9; goal.z += KEYS[code][1] * dt * 9; }
      if (!pointers.size && (velocity.x || velocity.z)) {
        goal.x += velocity.x * dt; goal.z += velocity.z * dt; clampView(goal); view.x = goal.x; view.z = goal.z;
        const decay = Math.exp(-dt * 4); velocity.x *= decay; velocity.z *= decay;
        if (Math.hypot(velocity.x, velocity.z) < .05) velocity.x = velocity.z = 0;
      }
      clampView(goal);
      const ease = 1 - Math.exp(-dt * 7);
      if (!pointers.size) { view.x += (goal.x - view.x) * ease; view.z += (goal.z - view.z) * ease; }
      view.distance += (goal.distance - view.distance) * ease;
      camera.position.set(view.x, view.distance * .82, view.z + view.distance * .58); camera.lookAt(view.x, 0, view.z - 1);
      sun.position.set(view.x - 6, 10, view.z + 5); sun.target.position.set(view.x, 0, view.z - 1);
      const time = performance.now() / 1000, step = Math.min(dt, 1 / 30);
      popTime += dt;
      for (const entry of regions) {
        // Lò xo tắt dần: bật vượt đích rồi nảy về, nhìn như cả quốc gia bị nhấc lên khỏi lục địa.
        const target = entry.region.id === revealed ? DEPTH + 1.1 : entry.region.id === selected ? DEPTH + .65 : 0;
        entry.speed += ((target - entry.rise) * 90 - entry.speed * 11) * step;
        entry.rise = Math.max(0, entry.rise + entry.speed * step);
        entry.tile.visible = entry.rise > .01;
        const hover = target ? Math.sin(time * 2.2) * .04 : 0;
        entry.tile.position.y = entry.rest + entry.rise + hover;
        entry.tile.rotation.z = entry.speed * .01; entry.tile.rotation.x = -entry.speed * .007; // lắc nhẹ khi đang bật
        const lifted = Math.min(1, entry.rise / .8);
        entry.tileTop.emissiveIntensity = lifted * (.25 + Math.sin(time * 4) * .08);
        entry.outline.material.opacity = target ? .95 : .4 + Math.sin(time * 2 + entry.x) * .12;
        if (entry.landmarks.visible && popTime < .5) { const grow = Math.min(1, popTime * 2.5); entry.landmarks.scale.setScalar(Math.max(.01, grow + Math.sin(grow * Math.PI) * .25)); } // nảy lên rồi về đúng cỡ
      }
      // Nhãn: làm tròn pixel để không rung khi bản đồ trượt.
      for (const [entry, pin] of pinFor) {
        anchor.set(entry.x, (entry.tile.visible ? entry.tile.position.y + DEPTH + 1.05 : entry.ground + .25), entry.z).project(camera);
        const visible = anchor.z < 1 && Math.abs(anchor.x) < 1.15 && Math.abs(anchor.y) < 1.15;
        if (pin.hidden === visible) pin.hidden = !visible;
        if (visible) pin.style.transform = `translate3d(${Math.round((anchor.x + 1) / 2 * innerWidth)}px, ${Math.round((1 - anchor.y) / 2 * innerHeight)}px, 0) translate(-50%, -100%)`;
      }
    },
    handleKeyDown(event) {
      if (event.target.closest('input, textarea, select')) return;
      if (event.code === 'Escape') { event.preventDefault(); if (revealed) return; if (confirming) { confirming = false; renderCard(); } else onClose(); return; }
      if (KEYS[event.code]) { event.preventDefault(); held.add(event.code); }
    },
    handleKeyUp(event) { held.delete(event.code); },
    clearInput() { held.clear(); pointers.clear(); velocity.x = velocity.z = 0; },
    dispose() { events.abort(); root.remove(); document.body.classList.remove('world-map-open'); disposeScene(scene); },
  };
}
