import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAdventureScene } from '../../shared/world/scene.js';
import { createPerson } from '../../characters/player.js';
import { createMovementInput } from '../../ui/movement.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { attachModels } from '../../shared/three/models.js';
import { dressPerson } from '../../characters/npc.js';
import { findRoute } from '../../shared/game/navigation.js';
import { RECIPES, SUPPLIES, STAFF_ROLES, recipeById } from './recipes.js';
import { BAR_X, COUNTER_Z, KIOSKS, LANE_Z, PICKUP_X, REGISTERS, STATIONS, TABLES, createCafeService } from './service.js';
import { createCafeUI } from './ui.js';
import { mountGridDebug } from './debug.js';
import { bindCafeFeedback, feedback } from './feedback.js';
import { createVfx } from '../../shared/vfx/index.js';
import { setListener } from '../../shared/audio/index.js';
import { isSettingsOpen } from '../../ui/settings.js';

// Separate playable world; the farm model owns inventory and transit so changing maps cannot copy goods.
export function createCafeGame({ farm, ui, onMenu, onExit, profile, character }) {
  const bounds = { minX: -16, maxX: 16, minZ: -14, maxZ: 10 };
  const REGISTER_X = (REGISTERS[0] + REGISTERS[1]) / 2, KIOSK_X = (KIOSKS[0] + KIOSKS[1]) / 2, back = LANE_Z - COUNTER_Z;
  // The player works counters from the staff lane behind them, like real staff.
  // interactDistance must cover every approach point plus the 0.65 arrival slack, or arrival never registers.
  const interactions = [
    { id: 'bar', name: 'Quầy pha chế', kind: 'bar', position: [BAR_X, COUNTER_Z], interactDistance: 3.8, approachOffsets: STATIONS.map(x => [x - BAR_X, back]), color: '#a67a48' },
    { id: 'register', name: 'Thu ngân', kind: 'register', position: [REGISTER_X, COUNTER_Z], interactDistance: 3, approachOffsets: REGISTERS.map(x => [x - REGISTER_X, back]), color: '#b88a4c' },
    { id: 'pickup', name: 'Quầy nhận đồ', kind: 'pickup', position: [PICKUP_X, COUNTER_Z], interactDistance: 2.4, approachOffsets: [[0, back]], color: '#8a7a55' },
    { id: 'kiosk', name: 'Kiosk tự order', kind: 'kiosk', position: [KIOSK_X, -6.6], interactDistance: 2.2, approachOffsets: [[0, 1.2]], color: '#6f8fb0' },
    { id: 'pantry', name: 'Kho nguyên liệu', kind: 'pantry', position: [-14.95, -10.5], interactDistance: 2, approachOffsets: [[1.35, 0]], color: '#8c7a55' },
    { id: 'board', name: 'Sổ công thức', kind: 'board', position: [3, 5], interactDistance: 2, approachOffsets: [[0, 1.3]], color: '#54776a' },
    ...TABLES.map(([x, z], i) => ({ id: `table-${i}`, name: `Bàn ${i + 1}`, kind: 'table', position: [x, z], interactDistance: 2.3, approachOffsets: [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]], color: '#af8c58' })),
    // Reserved floor for later upgrades; the sign explains what will open there.
    { id: 'terrace', name: 'Sân vườn', kind: 'expansion', position: [-9, 6], interactDistance: 2.2, approachOffsets: [[1.4, 0]], color: '#7e9a5c' },
    { id: 'roastery', name: 'Góc rang tại quán', kind: 'expansion', position: [12.8, -5.6], interactDistance: 2.5, approachOffsets: [[-1.6, 0]], color: '#a87b54' },
    { id: 'exit', name: 'Về nông trại', kind: 'exit', position: [12.5, 7.5], interactDistance: 1.7, color: '#6e9262' },
  ];
  const cylinder = (top, bottom, height) => new THREE.CylinderGeometry(top, bottom, height, 14);
  function canvasPlane(width, height, draw, parent, x, y, z) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.round(512 * height / width);
    draw(canvas.getContext('2d'), canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    plane.position.set(x, y, z); plane.userData.nonSolid = true; parent.add(plane); return plane;
  }
  function buildEnvironment({ scene, box, mesh, sphere, assetSlot }) {
    const room = assetSlot(new THREE.Group(), 'cafe/room'); scene.add(room);
    const flat = node => { node.userData.nonSolid = true; return node; };
    const sign = (w, h, bg, fg, lines, x, y, z, rotY = 0) => { const plane = canvasPlane(w, h, (ctx, cw, ch) => { ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = fg; ctx.textAlign = 'center'; lines.forEach(([text, size], i) => { ctx.font = `bold ${size}px system-ui`; ctx.fillText(text, cw / 2, (i + 1) * ch / (lines.length + 1) + size / 3); }); }, room, x, y, z); plane.rotation.y = rotY; return plane; };
    // Indoor hall z∈[-13.2,2.6]; terrace in front up to z=9.8; open towards the camera.
    box('#9e7b54', 0, -.05, -5.3, 31, .1, 15.8, room);
    for (let x = -15; x <= 15; x++) flat(box(x % 2 ? '#c2a174' : '#b8966a', x, .015, -5.3, .95, .035, 15.6, room));
    box('#b9b29f', 0, -.05, 6.2, 31, .1, 7.2, room);
    for (let x = -15; x <= 15; x += 2) for (let z = 3.3; z <= 9.3; z += 1.5) flat(box((x / 2 + Math.round(z)) % 2 ? '#cfc8b4' : '#c3bba5', x, .015, z, 1.9, .03, 1.4, room));
    box('#e8d9b1', 0, 1.8, -13.3, 31.2, 3.6, .2, room); box('#e8d9b1', -15.6, 1.8, -5.3, .2, 3.6, 16, room);
    box('#8a6a45', 0, .25, -13.18, 31, .5, .06, room); box('#8a6a45', -15.48, .25, -5.3, .06, .5, 16, room);
    sign(6, 1.2, '#54776a', '#fff2c9', [['CÀ PHÊ NÔNG TRẠI', 62]], BAR_X, 3.1, -13.18);
    // Menu boards above the bar, like a real counter.
    for (const [i, x] of [BAR_X - 2.4, BAR_X + 2.4].entries()) sign(2.6, 1.3, '#2f3d36', '#f6eed6', [[i ? 'MÁY & SỮA' : 'PHIN VIỆT', 34], ...RECIPES.filter(r => (r.gear.espresso || r.gear.v60 ? 1 : 0) === i).slice(0, 5).map(r => [`${r.name}  ${r.price}`, 22])], x, 2.35, -13.17);
    // Bean shelf sits above head height so the staff lane behind the counter stays clear.
    box('#7d5c3c', BAR_X, 2.3, -13.1, 8, .06, .3, room);
    for (let i = 0; i < 13; i++) mesh(cylinder(.12, .12, .3), ['#d8c7a0', '#6b4325', '#f3e2b8'][i % 3], BAR_X - 3.6 + i * .6, 2.48, -13.05, 1, 1, 1, room);
    // Pendant lamps sit above head height so they never block walking.
    for (const x of [...STATIONS, ...REGISTERS, PICKUP_X]) { flat(box('#3a3a38', x, 3.3, COUNTER_Z, .02, .7, .02, room)); flat(mesh(new THREE.ConeGeometry(.28, .3, 14, 1, true), '#2f3d36', x, 2.85, COUNTER_Z, 1, 1, 1, room)); flat(mesh(sphere, '#ffe9a8', x, 2.75, COUNTER_Z, .1, .1, .1, room)); }
    for (const [x, z] of TABLES.filter(([, z]) => z < 2)) { flat(box('#3a3a38', x, 3.3, z, .02, .6, .02, room)); flat(mesh(new THREE.ConeGeometry(.32, .28, 14, 1, true), '#b07a45', x, 2.9, z, 1, 1, 1, room)); }
    // Pastry case next to the register.
    box('#7d5c3c', 9.4, .5, COUNTER_Z, 2, 1, .9, room);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, .6, .8), new THREE.MeshStandardMaterial({ color: '#dff2f5', transparent: true, opacity: .35 })); glass.position.set(9.4, 1.32, COUNTER_Z); room.add(glass);
    for (let i = 0; i < 6; i++) mesh(cylinder(.14, .14, .14), ['#e8b77a', '#a0522d', '#f4d7d9', '#f0e0a8'][i % 4], 8.75 + (i % 3) * .65, 1.1 + Math.floor(i / 3) * .25, COUNTER_Z, 1, 1, 1, room);
    sign(1.6, .4, '#fff2c9', '#6b4a2b', [['Bánh ngọt · sắp bán', 40]], 9.4, 1.85, COUNTER_Z + .48);
    // Self-service station: napkins, straws, sugar and a bin.
    box('#9b7044', 10.4, .5, -1.2, .8, 1, 1.6, room); box('#ede0bd', 10.4, 1.02, -1.2, .9, .05, 1.7, room);
    mesh(cylinder(.1, .1, .25), '#f4f1ea', 10.4, 1.17, -1.8, 1, 1, 1, room); mesh(cylinder(.07, .07, .3), '#d7473b', 10.4, 1.2, -1.3, 1, 1, 1, room); mesh(cylinder(.09, .09, .16), '#fff', 10.4, 1.13, -.7, 1, 1, 1, room);
    mesh(cylinder(.25, .22, .7), '#5b6b66', 10.4, .35, .1, 1, 1, 1, room);
    sign(1.4, .35, '#fffaf0', '#6b4a2b', [['Tự phục vụ', 40]], 10.4, 1.6, -2.02);
    // Lounge corner with sofas, coffee table, rug, floor lamp and books.
    flat(box('#b8604a', -12.6, .02, .1, 4, .02, 3, room));
    box('#6f8b74', -14.6, .3, .1, .8, .6, 2.4, room); box('#6f8b74', -14.95, .75, .1, .2, .7, 2.4, room);
    box('#6f8b74', -12.4, .3, 1.55, 2.4, .6, .7, room);
    box('#8a643f', -12.6, .35, .1, 1.2, .08, .7, room); mesh(cylinder(.05, .05, .35), '#6e5240', -12.6, .17, .1, 1, 1, 1, room);
    mesh(cylinder(.04, .04, 1.6), '#3a3a38', -14.7, .8, -1.5, 1, 1, 1, room); flat(mesh(new THREE.ConeGeometry(.25, .3, 12, 1, true), '#f2d79a', -14.7, 1.7, -1.5, 1, 1, 1, room));
    box('#7d5c3c', -15.3, 1.2, 2, .4, 2.4, 1.2, room);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) box(['#b0667a', '#6f8fb0', '#c09a4f', '#7e9a5c'][(i + j) % 4], -15.15, .45 + i * .55, 1.55 + j * .22, .25, .38, .14, room);
    // Restroom door, wall art, clock, wifi and windows on the walls.
    box('#8a643f', -15.48, 1.1, -6.2, .06, 2.2, 1.1, room); sign(.6, .35, '#fffaf0', '#3a3a38', [['WC', 70]], -15.44, 2.45, -6.2, Math.PI / 2);
    for (const z of [-3.2, -.4]) { box('#789b91', -15.48, 2, z, .08, 1.6, 2, room); box('#d5e8d3', -15.42, 2, z, .05, 1.35, 1.75, room); }
    for (const [x, c] of [[-11, '#c27a52'], [-9.4, '#6f8fb0'], [11, '#7e9a5c']]) { box('#6e5240', x, 2.2, -13.18, 1.1, .8, .04, room); flat(box(c, x, 2.2, -13.15, .9, .6, .02, room)); }
    flat(mesh(cylinder(.3, .3, .04), '#fffaf0', 3.4, 2.7, -13.16, 1, 1, 1, room)).rotation.x = Math.PI / 2;
    sign(1.6, .4, '#2f3d36', '#bfe39b', [['Wifi: caphenongtrai', 34]], 3.4, 1.9, -13.17);
    for (const x of [-12.5, 12.5]) { box('#789b91', x, 2.1, -13.18, 2.6, 1.6, .08, room); box('#d5e8d3', x, 2.1, -13.12, 2.35, 1.35, .05, room); }
    // Bean sacks beside the pantry show where beans from the farm arrive.
    for (const [x, z] of [[-14.6, -8.6], [-14, -8.4]]) mesh(sphere, '#b08a52', x, .35, z, .35, .4, .3, room);
    // Planters split hall and terrace; the gap at x≈0 is the entrance customers use.
    for (const [x, w] of [[-8.4, 14.2], [8.4, 14.2]]) { box('#8a6a45', x, .3, 2.6, w, .6, .5, room); for (let i = 0; i < w; i += 1.4) mesh(sphere, '#6f9a58', x - w / 2 + .6 + i, .75, 2.6, .45, .35, .3, room); }
    for (const x of [-1.25, 1.25]) box('#8a6a45', x, 1.3, 2.6, .2, 2.6, .2, room);
    sign(2.4, .5, '#6b4a2b', '#fff2c9', [['MỜI VÀO', 60]], 0, 2.5, 2.72);
    flat(box('#c8a36a', 0, .02, 3.5, 2.2, .03, .9, room));
    // Terrace street details: bike rack, lamp posts.
    for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(.3, .03, 6, 16, Math.PI), '#7a7f7d', 6 + i * .5, 0, 8.5, 1, 1, 1, room);
    for (const x of [-4, 4, 9]) { mesh(cylinder(.06, .08, 3), '#3a3a38', x, 1.5, 9.4, 1, 1, 1, room); flat(mesh(sphere, '#ffe9a8', x, 3.05, 9.4, .18, .18, .18, room)); }
    for (const [x, z] of [[14.8, -12.8], [-14.8, 2.1], [14.8, 2.1], [-14.8, 9.2], [14.8, 9.2], [11.6, -12.6]]) { mesh(cylinder(.32, .25, .55), '#a8714c', x, .27, z, 1, 1, 1, room); mesh(sphere, '#5f8a4f', x, .9, z, .48, .58, .48, room); }
    // Queue ropes keep the waiting line clear of the seating area.
    for (let z = -8.4; z <= -3.5; z += 1.2) { mesh(cylinder(.05, .05, .9), '#c9a45c', 2.1, .45, z, 1, 1, 1, room); mesh(sphere, '#c9a45c', 2.1, .93, z, .08, .08, .08, room); }
    flat(box('#9b3b33', 2.1, .8, -5.95, .04, .05, 4.9, room));
    // Staff-only lane marking behind the counter.
    flat(box('#a98a5e', -1, .02, LANE_Z, 26, .02, .9, room));
    // Expansion plots: outlined floor so the space reads as "for later", not empty.
    for (const [x, z, w, d] of [[-9, 6.3, 10, 5.4], [12.8, -5.6, 4, 5]]) {
      flat(box('#d9c79c', x, .03, z, w, .02, d, room));
      for (const [ox, oz, sw, sd] of [[0, -d / 2, w, .06], [0, d / 2, w, .06], [-w / 2, 0, .06, d], [w / 2, 0, .06, d]]) flat(box('#b08a52', x + ox, .05, z + oz, sw, .03, sd, room));
    }
    return {};
  }
  function buildActor({ npc, visual, box, mesh, sphere, assetSlot }) {
    assetSlot(visual, `cafe/${npc.id}`);
    // An empty slot shows a dashed outline and a "for sale" plate so players see where the upgrade goes.
    const slotOutline = (parent, w, d) => { const g = new THREE.Group(); parent.add(g); for (const [x, z, sw, sd] of [[0, -d / 2, w, .05], [0, d / 2, w, .05], [-w / 2, 0, .05, d], [w / 2, 0, .05, d]]) box('#b08a52', x, .04, z, sw, .02, sd, g).userData.nonSolid = true; g.userData.nonSolid = true; return g; };
    if (npc.kind === 'bar') {
      box('#9b7044', 0, .55, 0, 8, 1.1, 1, visual); box('#ede0bd', 0, 1.13, 0, 8.2, .08, 1.15, visual);
      // One brewing station per slot: drip mat, kettle and phin set; extra stations appear with upgrades.
      const stations = STATIONS.map(x => {
        const g = new THREE.Group(); g.position.x = x - BAR_X; visual.add(g);
        box('#3a3a38', 0, 1.18, 0, 1.1, .02, .6, g);
        mesh(cylinder(.12, .14, .26), '#c5c9c4', -.35, 1.32, -.1, 1, 1, 1, g);
        for (let i = 0; i < 2; i++) mesh(cylinder(.08, .07, .14), '#d8dbd6', .15 + i * .22, 1.28, -.05, 1, 1, 1, g);
        box('#4f5a58', .45, 1.42, -.25, .28, .45, .28, g);
        return g;
      });
      const parts = {};
      parts.espresso = assetSlot(new THREE.Group(), 'cafe/espresso-machine'); visual.add(parts.espresso);
      box('#6c8885', STATIONS[1] - BAR_X, 1.55, -.25, 1.1, .75, .5, parts.espresso); box('#d1d6c5', STATIONS[1] - BAR_X, 1.62, .02, .9, .25, .05, parts.espresso);
      parts.steamer = new THREE.Group(); visual.add(parts.steamer); mesh(cylinder(.1, .12, .22), '#d7dcdc', STATIONS[1] - BAR_X + .7, 1.28, .15, 1, 1, 1, parts.steamer);
      parts.mixer = new THREE.Group(); visual.add(parts.mixer); box('#e6d2b8', STATIONS[0] - BAR_X - .9, 1.35, -.2, .3, .38, .3, parts.mixer);
      parts.v60 = new THREE.Group(); visual.add(parts.v60); mesh(new THREE.ConeGeometry(.16, .22, 14), '#f4f1ea', STATIONS[2] - BAR_X + .8, 1.42, 0, 1, -1, 1, parts.v60);
      parts.autoEspresso = new THREE.Group(); visual.add(parts.autoEspresso);
      box('#2f3d36', 3.35, 1.6, -.2, .7, .9, .5, parts.autoEspresso); box('#8df0a8', 3.35, 1.75, .06, .45, .25, .02, parts.autoEspresso);
      // The pass: finished cups wait at the right end of the bar for a waiter or the player.
      box('#6e5240', 3.6, 1.2, .3, .7, .05, .4, visual);
      const cups = [0, 1, 2, 3, 4, 5].map(i => { const cup = mesh(cylinder(.08, .06, .18), '#fffaf0', 3.35 + (i % 3) * .2, 1.32, .2 + Math.floor(i / 3) * .2, 1, 1, 1, visual); cup.userData.nonSolid = true; return cup; });
      return { setState({ gear, shelf }) {
        stations.forEach((g, i) => { g.visible = i <= (gear.station || 0); });
        for (const [id, part] of Object.entries(parts)) part.visible = gear[id] > 0;
        cups.forEach((cup, i) => { cup.visible = i < shelf; });
      } };
    }
    if (npc.kind === 'register') {
      const counters = REGISTERS.map((x, i) => {
        const g = assetSlot(new THREE.Group(), `cafe/register/counter-${i}`); g.position.x = x - REGISTER_X; visual.add(g);
        box('#9b7044', 0, .55, 0, 2.4, 1.1, 1, g); box('#ede0bd', 0, 1.13, 0, 2.6, .08, 1.15, g);
        box('#3f4a47', .45, 1.35, -.1, .55, .35, .45, g); box('#9fd0b6', .45, 1.55, .1, .4, .18, .04, g);
        mesh(cylinder(.12, .12, .25), '#cfe6ea', -.6, 1.3, .2, 1, 1, 1, g);
        return g;
      });
      const empty = slotOutline(visual, 2.4, 1); empty.position.x = REGISTERS[1] - REGISTER_X;
      return { setState({ gear }) { counters[1].visible = gear.register2 > 0; empty.visible = !counters[1].visible; } };
    }
    if (npc.kind === 'pickup') {
      const counter = assetSlot(new THREE.Group(), 'cafe/pickup/counter'); visual.add(counter);
      box('#9b7044', 0, .55, 0, 2.4, 1.1, 1, counter); box('#ede0bd', 0, 1.13, 0, 2.6, .08, 1.15, counter);
      box('#2f3d36', 0, 1.75, -.3, 1.2, .6, .06, counter); box('#bfe39b', 0, 1.75, -.26, 1, .45, .02, counter);
      const empty = slotOutline(visual, 2.4, 1);
      return { setState({ gear }) { counter.visible = gear.pickup > 0; empty.visible = !counter.visible; } };
    }
    if (npc.kind === 'kiosk') {
      const kiosks = KIOSKS.map((x, i) => {
        const g = assetSlot(new THREE.Group(), `cafe/kiosk/unit-${i}`); g.position.x = x - KIOSK_X; visual.add(g);
        box('#3a3a38', 0, .55, 0, .5, 1.1, .4, g); box('#2f3d36', 0, 1.35, .05, .6, .6, .12, g); box('#bfe1f5', 0, 1.36, .12, .5, .48, .02, g);
        return g;
      });
      const empty = slotOutline(visual, 2.4, 1);
      return { setState({ gear }) { kiosks.forEach((g, i) => { g.visible = i < (gear.kiosk || 0); }); empty.visible = !(gear.kiosk > 0); } };
    }
    if (npc.kind === 'pantry') {
      box('#7d5c3c', 0, 1, 0, .7, 2, 1.8, visual);
      const goods = new THREE.Group(); visual.add(goods);
      for (const y of [.55, 1.15, 1.75]) box('#c39b6a', .37, y - .2, 0, .02, .04, 1.7, goods);
      for (let i = 0; i < 4; i++) { box('#f6f3ea', .2, .55, -.6 + i * .4, .25, .38, .22, goods); mesh(cylinder(.1, .1, .22), '#e9c45c', .2, 1.08, -.6 + i * .4, 1, 1, 1, goods); mesh(sphere, '#8a6a45', .2, 1.7, -.6 + i * .4, .17, .2, .17, goods); }
      return {};
    }
    if (npc.kind === 'expansion') {
      box('#7d5c3c', 0, .7, 0, .1, 1.4, .1, visual); box('#efe0bd', 0, 1.35, 0, 1.2, .6, .06, visual);
      for (let i = 0; i < 2; i++) box('#c9a45c', .6 - i * 1.2, .2, .5, .5, .4, .4, visual);
      return {};
    }
    if (npc.kind === 'board') {
      // A-frame chalkboard at the entrance: tap it to open the recipe book.
      box('#6e5240', 0, .6, 0, .95, 1.2, .1, visual);
      canvasPlane(.85, 1.05, (ctx, w, h) => {
        ctx.fillStyle = '#2f3d36'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f6eed6'; ctx.textAlign = 'center';
        ctx.font = 'bold 56px system-ui'; ctx.fillText('THỰC ĐƠN', w / 2, 70); ctx.font = '30px system-ui';
        RECIPES.slice(0, 10).forEach((r, i) => ctx.fillText(`${r.name} ${r.price}`, w / 2, 125 + i * 52));
      }, visual, 0, .62, .06);
      return {};
    }
    if (npc.kind === 'exit') { box('#77905f', 0, .025, 0, 1.5, .03, .7, visual).userData.nonSolid = true; return {}; }
    // Table by level: 2 wooden chairs → 4 chairs → cushions + lamp → sofas + flowers; cups left behind until cleaned.
    const open = new THREE.Group(), locked = new THREE.Group(), wood = new THREE.Group(), sofa = new THREE.Group(), extra = new THREE.Group(), cushions = new THREE.Group(), lamp = new THREE.Group(), flowers = new THREE.Group();
    // Table top and wooden chairs are sub-slots so a model replaces only them; upgrade props stay placeholders.
    const top = assetSlot(new THREE.Group(), `cafe/${npc.id}/table`), pair = assetSlot(new THREE.Group(), `cafe/${npc.id}/chairs-pair`);
    assetSlot(extra, `cafe/${npc.id}/chairs-extra`);
    visual.add(open, locked); open.add(top, wood, sofa, lamp, flowers); wood.add(pair, extra);
    mesh(cylinder(.6, .6, .07), '#b88a56', 0, .76, 0, 1, 1, 1, top); mesh(cylinder(.07, .14, .72), '#6e5240', 0, .37, 0, 1, 1, 1, top);
    const slots = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    slots.forEach(([sx, sz], i) => {
      const parent = i < 2 ? pair : extra, rot = sz ? -Math.PI / 2 : 0;
      const chair = new THREE.Group(); chair.position.set(sx * .85, 0, sz * .85); chair.rotation.y = rot; parent.add(chair);
      const back = sx || sz;
      box('#8a643f', 0, .44, 0, .42, .07, .42, chair); box('#8a643f', back * .19, .72, 0, .06, .5, .42, chair); box('#6e5240', 0, .21, 0, .07, .42, .07, chair);
      const pad = box('#c95f4a', 0, .5, 0, .36, .05, .36, cushions); pad.position.set(sx * .85, .5, sz * .85);
      // Sofas keep the same footprint as chairs (≈1.1 m from the table centre) so upgrades never close a walkway.
      const couch = new THREE.Group(); couch.position.set(sx * .85, 0, sz * .85); couch.rotation.y = rot; sofa.add(couch);
      box('#7a3b2e', 0, .3, 0, .44, .36, .7, couch); box('#7a3b2e', back * .19, .62, 0, .1, .5, .7, couch);
    });
    open.add(cushions);
    mesh(cylinder(.05, .07, .25), '#3a3a38', .25, .92, -.2, 1, 1, 1, lamp); mesh(sphere, '#ffe9a8', .25, 1.1, -.2, .09, .09, .09, lamp);
    mesh(cylinder(.05, .06, .2), '#dfe9ee', -.2, .9, .2, 1, 1, 1, flowers); mesh(sphere, '#e46f8a', -.2, 1.05, .2, .1, .08, .1, flowers);
    const cups = slots.map(([sx, sz]) => { const cup = mesh(cylinder(.06, .05, .12), '#f4efe4', sx * .32, .86, sz * .32, 1, 1, 1, open); cup.userData.nonSolid = true; return cup; });
    for (let i = 0; i < 3; i++) box('#8a643f', 0, .1 + i * .12, 0, .5, .07, .5, locked);
    box('#bfae8a', 0, .03, 0, 1.6, .02, .9, locked).userData.nonSolid = true;
    return { setState({ unlocked, level = 1, dirty = [] }) {
      open.visible = unlocked; locked.visible = !unlocked;
      wood.visible = level < 4; sofa.visible = level >= 4; extra.visible = level >= 2; cushions.visible = level === 3;
      lamp.visible = level >= 3; flowers.visible = level >= 4;
      cups.forEach((cup, i) => { cup.visible = Boolean(dirty[i]); });
    } };
  }

  // Nhân vật người chơi đã chọn (GLB rig); chỉ dùng khối tạm nếu tải thất bại.
  const player = character || createPerson('#6d8658', { gender: profile?.gender === 'male' ? 'male' : 'female' });
  const world = createAdventureScene(player, { theme: 'farm', mapBounds: bounds, interactions, buildActor, buildEnvironment });
  // Flat floor name plates draw over walkers; the cafe uses status signs instead except for the bar.
  for (const item of interactions.filter(item => item.id !== 'bar')) for (const child of world.scene.getObjectByName(`farm:${item.id}`).children) if (child.renderOrder === 5) child.visible = false;
  // The scene's small round focus ring hides under long counters, so the cafe draws its own footprint glow instead.
  for (const item of interactions) for (const child of world.scene.getObjectByName(`farm:${item.id}`).children) if (child.geometry?.type === 'RingGeometry') child.visible = false;
  // Real models swap in once loaded (one load, cloned per table); a failed load keeps the placeholder blocks.
  let disposed = false;
  const loadModel = file => new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/cafe/${file}`);
  loadModel('espresso-machine.glb').then(({ scene: machine }) => {
    if (disposed) return disposeScene(machine);
    // Pivot is bottom centre; sits on the counter top (y 1.17) and stays inside its depth so the staff lane is not narrowed.
    // Group head and portafilter face the barista in the staff lane (−Z), back to the guests.
    machine.position.set(STATIONS[1] - BAR_X, 1.17, -.18); machine.rotation.y = Math.PI;
    world.replaceAsset('cafe/espresso-machine', machine);
  }).catch(error => console.warn('Cafe: không tải được espresso-machine.glb, giữ khối tạm.', error));
  loadModel('table.glb').then(({ scene: source }) => {
    if (disposed) return disposeScene(source);
    TABLES.forEach((_, i) => {
      const set = source.clone(); set.updateMatrixWorld(true);
      for (const [node, slot] of [['table', 'table'], ['chairs_pair', 'chairs-pair'], ['chairs_extra', 'chairs-extra']]) {
        const part = set.getObjectByName(node);
        if (!part) { if (!i) console.warn(`Cafe: table.glb thiếu node ${node}, giữ khối tạm.`); continue; }
        // Keep the node's placement relative to the model root once it moves into its slot.
        part.matrixWorld.decompose(part.position, part.quaternion, part.scale);
        world.replaceAsset(`cafe/table-${i}/${slot}`, part);
      }
    });
  }).catch(error => console.warn('Cafe: không tải được table.glb, giữ khối tạm.', error));
  attachModels({ replaceAsset: (id, model) => !disposed && world.replaceAsset(id, model) }, {
    'cafe/register/counter-0': 'cafe/register-counter.glb', 'cafe/register/counter-1': 'cafe/register-counter.glb',
    'cafe/pickup/counter': 'cafe/pickup-counter.glb',
    'cafe/kiosk/unit-0': 'cafe/kiosk.glb', 'cafe/kiosk/unit-1': 'cafe/kiosk.glb',
  });
  const FOOTPRINT = { bar: [8.6, 1.7], register: [5.8, 1.7], pickup: [2.9, 1.7], kiosk: [3, 1.5], pantry: [1.4, 2.4], board: [1.5, 1], table: [3.1, 3.1], expansion: [2.2, 2.2], exit: [1.9, 1.1] };
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 256;
  const glowCtx = glowCanvas.getContext('2d');
  glowCtx.fillStyle = '#ffe17a55'; glowCtx.beginPath(); glowCtx.roundRect(22, 22, 212, 212, 44); glowCtx.fill();
  glowCtx.shadowColor = '#ffb800'; glowCtx.shadowBlur = 24; glowCtx.strokeStyle = '#ffe680'; glowCtx.lineWidth = 16; glowCtx.stroke(); glowCtx.stroke();
  const glowTexture = new THREE.CanvasTexture(glowCanvas); glowTexture.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.renderOrder = 6; glow.visible = false; glow.userData.nonSolid = true; world.scene.add(glow);
  let glowStaff = null, glowUntil = 0;
  function select(id) {
    glowStaff = null; glowUntil = 0;
    const item = id && interactions.find(entry => entry.id === id);
    glow.visible = Boolean(item);
    if (!item) return;
    const [w, d] = FOOTPRINT[item.kind] || [2, 2];
    // Extra margin keeps the glow visible around the object's base instead of hidden under it.
    glow.scale.set(w + 1.1, d + 1.1, 1); glow.position.set(item.position[0], .06, item.position[1]);
  }
  // Glows opened with a modal stay while it is open and fade shortly after it closes.
  function selectStaff(id) { select(null); glowStaff = id; glow.visible = true; glow.scale.set(1.4, 1.4, 1); glowUntil = performance.now() + 1200; }
  const keyboard = createMovementInput(), events = new AbortController();
  let touch = { x: 0, z: 0 }, lastHud = 0, lastActors = 0, tableKey = '';
  const projected = new THREE.Vector3();
  const screenAt = pos => {
    const rect = document.querySelector('#game canvas').getBoundingClientRect();
    projected.set(pos.x, 1.6, pos.z).project(world.camera);
    return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 };
  };
  // NPCs share the player's navigation grid so they walk around counters, tables and future upgrades.
  const route = (from, to) => {
    const search = findRoute(from, to, world.canStand, bounds);
    let step; do step = search.next(); while (!step.done);
    return step.value.length ? step.value : [to];
  };
  const vfx = createVfx({ scene: world.scene });
  bindCafeFeedback({ vfx, screenAt, player, object: id => world.scene.getObjectByName(`farm:${id}`) });
  let cafeUi = null;
  const service = createCafeService(farm, {
    notice: (text, ok = true) => ui.notice(text, ok), reward: (pos, amount) => ui.flyReward('coins', amount, screenAt(pos)), route,
    onShiftEnd: report => cafeUi?.showShiftReport(report), fx: feedback,
  });
  cafeUi = createCafeUI({ farm, service, profile, fx: feedback, notice: (text, ok = true) => ui.notice(text, ok), onExit, onOrders: () => onMenu('orders'), onWalkTable: table => world.moveToNpc(`table-${table}`) });
  document.body.classList.add('cafe-active');

  const handCup = new THREE.Mesh(new THREE.CylinderGeometry(.09, .07, .2, 12), new THREE.MeshStandardMaterial({ color: '#fffaf0' }));
  handCup.position.set(.42, 1.0, .22); handCup.visible = false; player.add(handCup);
  function makeNpc(color, model) {
    const group = new THREE.Group(), person = createPerson(color); person.scale.setScalar(.88); group.add(person);
    dressPerson(person, model);
    group.userData.nonSolid = true; world.scene.add(group);
    const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(.95, .63, 1); sprite.position.y = 2.25; group.add(sprite);
    return { group, person, canvas, texture, sprite, key: '', walk: 0 };
  }
  // Bubble = icon plus an optional bar: guests show patience (green → red), staff show work progress (blue).
  function drawBubble(npc, icon, ratio, work = false) {
    const key = `${icon}:${ratio === null ? '' : Math.ceil(ratio * 16)}:${work}`;
    if (npc.key === key) return; npc.key = key;
    const ctx = npc.canvas.getContext('2d'); ctx.clearRect(0, 0, 192, 128);
    npc.sprite.visible = Boolean(icon);
    if (!icon) return;
    ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = work ? '#4f7fa8' : '#8b6e34'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(8, 6, 176, 96, 24); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(84, 100); ctx.lineTo(96, 122); ctx.lineTo(108, 100); ctx.fill();
    ctx.font = '54px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3c2a1a'; ctx.fillText(icon, 96, ratio === null ? 56 : 44);
    if (ratio !== null) {
      ctx.fillStyle = '#d9cdb4'; ctx.fillRect(28, 78, 136, 12);
      ctx.fillStyle = work ? '#5a9bd4' : ratio > .5 ? '#7fb35d' : ratio > .25 ? '#e0b44c' : '#d0573f'; ctx.fillRect(28, 78, 136 * Math.max(0, Math.min(1, ratio)), 12);
    }
    npc.texture.needsUpdate = true;
  }
  function animate(npc, pos, facing, dt, seated = false) {
    const moved = Math.hypot(pos.x - npc.group.position.x, pos.z - npc.group.position.z) > .001;
    npc.group.position.set(pos.x, seated ? -.18 : .05, pos.z); npc.group.rotation.y = facing;
    npc.walk = moved ? npc.walk + dt * 9 : 0;
    const [left, right] = npc.person.userData.legs; npc.person.userData.seated = seated;
    left.rotation.x = Math.sin(npc.walk) * .5; right.rotation.x = -Math.sin(npc.walk) * .5;
  }
  const guests = new Map(), staff = new Map();
  const JOB_ICON = { order: '🧾', clean: '🧽', deliver: '🛎️' };
  function syncNpcs(dt) {
    const seen = new Set();
    for (const c of service.customers) {
      seen.add(c.id);
      let npc = guests.get(c.id);
      if (!npc) { npc = makeNpc(c.color, [...String(c.id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 2 ? 'cafe/guest-f.glb' : 'cafe/guest-m.glb'); npc.group.position.set(c.pos.x, .05, c.pos.z); guests.set(c.id, npc); }
      animate(npc, c.pos, c.facing, dt, ['seated', 'drinking'].includes(c.phase));
      const ordered = ['toSeat', 'seated', 'toPickup', 'pickup'].includes(c.phase), waitingInLine = c.phase === 'queue' && !c.path.length;
      const icon = c.mood || (ordered ? recipeById(c.recipeId).icon : c.phase === 'kiosk' ? '🖥️' : waitingInLine ? '🧾' : '');
      drawBubble(npc, icon, ordered || waitingInLine ? c.patience / c.patienceMax : c.phase === 'kiosk' && !c.path.length ? 1 - c.timer / 4 : null, c.phase === 'kiosk');
    }
    for (const [id, npc] of guests) if (!seen.has(id)) { world.scene.remove(npc.group); disposeScene(npc.group); guests.delete(id); }
    const hired = new Set();
    for (const a of service.agents) {
      hired.add(a.id);
      let npc = staff.get(a.id);
      if (!npc) {
        npc = makeNpc(STAFF_ROLES.find(r => r.id === a.role).color, 'cafe/staff.glb'); npc.group.userData.staffId = a.id;
        const cup = handCup.clone(); cup.visible = false; npc.person.add(cup); npc.cup = cup; staff.set(a.id, npc);
      }
      animate(npc, a.pos, a.facing ?? Math.PI, dt);
      if (glowStaff === a.id) glow.position.set(a.pos.x, .06, a.pos.z);
      npc.cup.visible = Boolean(a.carry);
      const job = a.job, working = job && a.timerMax;
      const icon = !a.active ? '💤' : job ? (job.type === 'brew' ? recipeById(job.recipeId).icon : job.type === 'deliver' && a.carry ? recipeById(a.carry.recipeId).icon : JOB_ICON[job.type]) : a.blocked ? '❓' : a.role === 'manager' ? '📋' : '';
      drawBubble(npc, icon, working ? a.timer / a.timerMax : null, true);
    }
    for (const [id, npc] of staff) if (!hired.has(id)) { world.scene.remove(npc.group); disposeScene(npc.group); staff.delete(id); }
    // A cup just picked up or brewed steams for a moment and the steam follows the player's hand.
    const held = Boolean(service.hand);
    if (held && !handCup.visible) handSteam = vfx.emitter('steam', handCup.getWorldPosition(cupPos), { rate: 5, duration: 2 });
    if (held) handSteam?.move(handCup.getWorldPosition(cupPos));
    handCup.visible = held;
  }
  let handSteam = null;
  const cupPos = new THREE.Vector3();
  function syncActors() {
    const cafe = service.snap.cafe, tables = service.tableCount(), now = Date.now();
    // Chairs and sofas change the table's footprint, so walking colliders must follow upgrades.
    const shape = `${cafe.tables.join()}|${Object.values(cafe.gear).join()}`;
    if (shape !== tableKey) { tableKey = shape; world.invalidateNavigation(); }
    for (const id of ['bar', 'register', 'pickup', 'kiosk']) world.setActorState(id, { gear: cafe.gear, shelf: service.shelf.length });
    for (let i = 0; i < TABLES.length; i++) {
      const dirty = [0, 1, 2, 3].map(slot => service.dirty.has(`${i}:${slot}`));
      world.setActorState(`table-${i}`, { unlocked: i < tables, level: cafe.tables[i], dirty });
      world.setObjectStatus(`table-${i}`, { text: i < tables && dirty.some(Boolean) ? '🧽 Cần dọn' : '' });
    }
    // Every drink being brewed shows its own countdown badge above the bar.
    const jobs = service.agents.filter(a => a.job?.type === 'brew' && a.timerMax).map(a => ({ icon: recipeById(a.job.recipeId).icon, units: 1, startedAt: now - a.timer * 1000, readyAt: now + (a.timerMax - a.timer) * 1000 }));
    if (service.autoJob) jobs.push({ icon: '🤖', units: 1, startedAt: service.autoJob.startedAt, readyAt: service.autoJob.readyAt });
    world.setObjectStatus('bar', { jobs });
    const front = service.customers.some(c => c.phase === 'queue' && !c.path.length);
    world.setObjectStatus('register', { text: front ? '🧾 Có khách gọi món' : '🧾 Thu ngân' });
    world.setObjectStatus('pickup', { text: cafe.gear.pickup ? '📺 Quầy nhận đồ' : '＋ Ô trống: quầy nhận đồ' });
    world.setObjectStatus('kiosk', { text: cafe.gear.kiosk ? '🖥️ Kiosk tự order' : '＋ Ô trống: kiosk' });
    const low = SUPPLIES.some(s => ['cup', 'condensed', 'milk', 'ice'].includes(s.id) && cafe.supplies[s.id] < s.pack / 5);
    world.setObjectStatus('pantry', { text: low ? '⚠️ Kho sắp hết' : '🧺 Kho' });
    world.setObjectStatus('board', { text: '📖 Công thức' }); world.setObjectStatus('exit', { text: '🌱 Nông trại' });
    world.setObjectStatus('terrace', { text: '🔒 Sân vườn · mở rộng sau' }); world.setObjectStatus('roastery', { text: '🔒 Góc rang · mở rộng sau' });
  }
  function interact(id) {
    glowUntil = performance.now() + 1200;
    if (id === 'exit') { onExit(); return; }
    if (id === 'register') service.arriveRegister();
    else if (id === 'pickup') service.arrivePickup();
    else if (id === 'kiosk') cafeUi.openUpgrades('auto');
    else if (id === 'bar') { if (!service.arriveBar()) cafeUi.openBench(); }
    else if (id === 'pantry') cafeUi.openPantry();
    else if (id === 'board') cafeUi.openBook();
    else if (id.startsWith('table-')) service.arriveTable(Number(id.slice(6)));
    else if (id === 'terrace' || id === 'roastery') ui.notice(`${interactions.find(item => item.id === id).name}: khu dành cho bản mở rộng sau.`);
    cafeUi.refreshHud();
  }
  const blocked = () => ui.modalOpen || cafeUi.open || isSettingsOpen();
  let drag = null, suppress = 0;
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#game canvas') || blocked() || e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false }; }, { signal: events.signal });
  document.addEventListener('pointermove', e => { if (!drag) return; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true; if (drag.moved) { const rect = document.querySelector('#game canvas').getBoundingClientRect(); world.panCamera(drag.lastX, drag.lastY, e.clientX, e.clientY, rect); drag.lastX = e.clientX; drag.lastY = e.clientY; } }, { signal: events.signal });
  document.addEventListener('pointerup', () => { if (drag?.moved) suppress = performance.now() + 350; drag = null; }, { signal: events.signal });
  // Đổi tab/rời cửa sổ khi đang kéo: pointerup rơi vào chỗ khác, nên bỏ kéo để camera không trôi theo chuột.
  for (const [target, type] of [[document, 'pointercancel'], [window, 'blur'], [document, 'visibilitychange']]) target.addEventListener(type, () => { drag = null; }, { signal: events.signal });
  const picker = new THREE.Raycaster();
  // Staff are not world interactions, so they are picked here before the scene handles the click.
  function pickStaff(x, y, rect) {
    const groups = [...staff.values()].map(npc => npc.group);
    if (!groups.length) return null;
    picker.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), world.camera);
    for (let o = picker.intersectObjects(groups, true)[0]?.object; o; o = o.parent) if (o.userData.staffId) return o.userData.staffId;
    return null;
  }
  document.addEventListener('click', e => {
    const canvas = e.target.closest('#game canvas'); if (!canvas || blocked() || performance.now() < suppress) return;
    const rect = canvas.getBoundingClientRect(), id = pickStaff(e.clientX, e.clientY, rect);
    if (id) { selectStaff(id); cafeUi.openStaff(id); return; }
    select(null);
    // Tapping a table or chair opens its card; with a cup in hand it walks over to serve instead.
    world.moveToScreen(e.clientX, e.clientY, rect, target => {
      select(target);
      if (!target.startsWith('table-') || service.hand) return false;
      glowUntil = performance.now() + 1200; cafeUi.openTable(Number(target.slice(6))); return true;
    });
  }, { signal: events.signal });
  // Same wheel zoom as the farm map.
  document.addEventListener('wheel', e => {
    if (!e.target.closest('#game canvas') || blocked() || e.ctrlKey) return;
    e.preventDefault(); world.zoomView(e.deltaY < 0 ? .1 : -.1);
  }, { passive: false, signal: events.signal });
  // Layout debugging: open the game with ?debug=grid to see walkable cells and audited routes (G redraws).
  let gridDebug = null;
  farm.setCafeActive(true);
  // Start behind the counter area so the bar, register and queue are all in view.
  world.reset('farm'); world.zoomView(-.2); player.position.set(-1.5, .05, -9); service.refresh(); syncActors();
  if (new URLSearchParams(location.search).get('debug') === 'grid') { world.prepareNavigation(); gridDebug = mountGridDebug(world, bounds, interactions); }
  return {
    scene: world.scene, camera: world.camera, resize: world.resize,
    setTouch(value) { touch = value; if (value.x || value.z) world.stopMovement(); },
    clearInput() { keyboard.clear(); touch = { x: 0, z: 0 }; world.stopMovement(); },
    update(dt, time) {
      const result = world.update(dt, time, keyboard.combine(touch), blocked());
      if (result.arrivedNpc) interact(result.arrivedNpc);
      // Pulse the selection glow; fade it out a moment after the player reaches the object.
      if (glow.visible) {
        glow.material.opacity = .6 + .4 * Math.sin(time * 6);
        if (glowUntil && cafeUi.open) glowUntil = performance.now() + 1200;
        else if (glowUntil && performance.now() > glowUntil) select(null);
      }
      service.update(dt, Date.now()); syncNpcs(dt);
      if (time - lastHud > .25) { lastHud = time; cafeUi.refreshHud(); }
      if (time - lastActors > .5) { lastActors = time; service.refresh(); syncActors(); cafeUi.tick(); }
      setListener(player.position, world.camera); vfx.update(dt);
    },
    handleKeyDown(e) { if (cafeUi.open || isSettingsOpen()) return; if (e.code === 'Escape') { onExit(); return; } if (keyboard.down(e)) world.stopMovement(); },
    handleKeyUp: e => keyboard.up(e),
    dispose() {
      disposed = true; gridDebug?.dispose(); farm.setCafeActive(false); events.abort(); cafeUi.dispose(); document.body.classList.remove('cafe-active');
      bindCafeFeedback(null); vfx.dispose(); world.dispose();
    },
    replaceAsset: world.replaceAsset, getAssetSlots: world.getAssetSlots,
  };
}
