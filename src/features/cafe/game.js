import * as THREE from 'three';
import { createAdventureScene } from '../../shared/world/scene.js';
import { createPerson } from '../../characters/player.js';
import { createMovementInput } from '../../ui/movement.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { attachModels, dressSlot, gltfLoader, loadModel as loadArt } from '../../shared/three/models.js';
import { dressPerson } from '../../characters/npc.js';
import { findRoute } from '../../shared/game/navigation.js';
import { GEAR, RECIPES, SUPPLIES, STAFF_ROLES, recipeById, recipeShort, missingFor, resolveUses } from './recipes.js';
import { CROPS } from '../farm/content.js';
import { BAR_X, COUNTER_Z, KIOSKS, LANE_Z, PICKUP_X, REGISTERS, STATIONS, TABLES, createCafeService } from './service.js';
import { createCafeUI } from './ui.js';
import { mountGridDebug, mountIncidentDebug } from './debug.js';
import { bindCafeFeedback, feedback } from './feedback.js';
import { createVfx } from '../../shared/vfx/index.js';
import { setListener } from '../../shared/audio/index.js';
import { isSettingsOpen } from '../../ui/settings.js';
import { fillRich } from '../../ui/icons.js';
import { buildStreet } from './street.js';
import { t } from '../../i18n/index.js';

// Separate playable world; the farm model owns inventory and transit so changing maps cannot copy goods.
// Warm indoor fill with a softer key than the farm, so the room reads as a lamp-lit café, not an open field (03 §4).
const CAFE_LIGHT = { sky: '#f6e7cc', ground: '#7a5a3a', ambient: 1.5, sun: '#ffe2b0', sunIntensity: 3.2, background: '#e9dcc4' };
export function createCafeGame({ farm, ui, awakening = null, onMenu, onExit, profile, character }) {
  const bounds = { minX: -16, maxX: 16, minZ: -14, maxZ: 10 };
  const REGISTER_X = (REGISTERS[0] + REGISTERS[1]) / 2, KIOSK_X = (KIOSKS[0] + KIOSKS[1]) / 2, back = LANE_Z - COUNTER_Z;
  // The player works counters from the staff lane behind them, like real staff.
  // interactDistance must cover every approach point plus the 0.65 arrival slack, or arrival never registers.
  const interactions = [
    { id: 'bar', name: t('cafe.spot.bar'), kind: 'bar', position: [BAR_X, COUNTER_Z], faceYaw: 0, interactDistance: 3.8, approachOffsets: STATIONS.map(x => [x - BAR_X, back]), color: '#a67a48' },
    { id: 'register', name: t('cafe.spot.register'), kind: 'register', position: [REGISTER_X, COUNTER_Z], faceYaw: 0, interactDistance: 3, approachOffsets: REGISTERS.map(x => [x - REGISTER_X, back]), color: '#b88a4c' },
    { id: 'pickup', name: t('cafe.spot.pickup'), kind: 'pickup', position: [PICKUP_X, COUNTER_Z], faceYaw: 0, interactDistance: 2.4, approachOffsets: [[0, back]], color: '#8a7a55' },
    { id: 'notebook', name: t('cafe.spot.notebook'), kind: 'notebook', position: [-2.2, COUNTER_Z], faceYaw: 0, interactDistance: 2.4, approachOffsets: [[0, back]], color: '#7b5a3c' },
    { id: 'kiosk', name: t('cafe.spot.kiosk'), kind: 'kiosk', position: [KIOSK_X, -6.6], interactDistance: 2.2, approachOffsets: [[0, 1.2]], color: '#6f8fb0' },
    { id: 'pantry', name: t('cafe.spot.pantry'), kind: 'pantry', position: [-14.95, -10.5], interactDistance: 2, approachOffsets: [[1.35, 0]], color: '#8c7a55' },
    { id: 'board', name: t('cafe.spot.board'), kind: 'board', position: [3, 5], interactDistance: 2, approachOffsets: [[0, 1.3]], color: '#54776a' },
    ...TABLES.map(([x, z], i) => ({ id: `table-${i}`, name: t('cafe.table.name', { n: i + 1 }), kind: 'table', position: [x, z], interactDistance: 2.3, approachOffsets: [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]], color: '#af8c58' })),
    // Reserved floor for later upgrades; the sign explains what will open there.
    { id: 'terrace', name: t('cafe.spot.terrace'), kind: 'expansion', position: [-9, 6], interactDistance: 2.2, approachOffsets: [[1.4, 0]], color: '#7e9a5c' },
    { id: 'roastery', name: t('cafe.spot.roastery'), kind: 'expansion', position: [12.8, -5.6], interactDistance: 2.5, approachOffsets: [[-1.6, 0]], color: '#a87b54' },
    { id: 'door', name: t('cafe.spot.door'), kind: 'door', position: [0, 2.6], interactDistance: 2.2, approachOffsets: [[0, 1.4], [0, -1.4]], color: '#6b4a2b' },
  ];
  const PLANTS = [[14.8, -12.8], [-14.8, 2.1], [14.8, 2.1], [-14.8, 9.2], [14.8, 9.2], [11.6, -12.6]];
  const cylinder = (top, bottom, height) => new THREE.CylinderGeometry(top, bottom, height, 14);
  function canvasPlane(width, height, draw, parent, x, y, z) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.round(512 * height / width);
    draw(canvas.getContext('2d'), canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    plane.position.set(x, y, z); plane.userData.nonSolid = true; parent.add(plane); return plane;
  }
  let entranceState = null;
  // Light oak planks (0.5 m wide, staggered seams), tiled in world metres via the floor's own UVs.
  function oakFloor() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d'), tones = ['#dcc39b', '#d4b990', '#e0c9a3', '#d8be95'];
    for (let row = 0; row < 8; row++) {
      const y = row * 64, shift = (row % 2) * 256 + (row % 3) * 64;
      const [a, b] = [shift % 512, (shift + 256) % 512].sort((p, q) => p - q);
      ctx.fillStyle = tones[row % 4]; ctx.fillRect(0, y, 512, 64);
      ctx.fillStyle = tones[(row + 2) % 4]; ctx.fillRect(a, y, b - a, 64);
      ctx.fillStyle = '#b99f78'; ctx.fillRect(0, y, 512, 2); ctx.fillRect(a, y, 2, 64); ctx.fillRect(b, y, 2, 64);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
    return texture;
  }
  function buildEnvironment({ scene, box, mesh, sphere, assetSlot }) {
    const room = assetSlot(new THREE.Group(), 'cafe/room'); scene.add(room);
    // Phố, vườn, nhà hàng xóm ngoài bản đồ: chỉ để nhìn, không chặn đường.
    const surroundings = assetSlot(new THREE.Group(), 'cafe/surroundings'); surroundings.userData.nonSolid = true; scene.add(surroundings, buildStreet());
    const flat = node => { node.userData.nonSolid = true; return node; };
    const sign = (w, h, bg, fg, lines, x, y, z, rotY = 0) => { const plane = canvasPlane(w, h, (ctx, cw, ch) => { ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = fg; ctx.textAlign = 'center'; lines.forEach(([text, size], i) => { ctx.font = `800 ${size}px "Baloo 2", system-ui`; ctx.fillText(text, cw / 2, (i + 1) * ch / (lines.length + 1) + size / 3); }); }, room, x, y, z); plane.rotation.y = rotY; return plane; };
    // Indoor hall z∈[-13.2,2.6]; terrace in front up to z=9.8; open towards the camera.
    box('#9e7b54', 0, -.05, -5.3, 31, .1, 15.8, room);
    for (let x = -15; x <= 15; x++) flat(box(x % 2 ? '#c2a174' : '#b8966a', x, .015, -5.3, .95, .035, 15.6, room));
    box('#b9b29f', 0, -.05, 6.2, 31, .1, 7.2, room);
    for (let x = -15; x <= 15; x += 2) for (let z = 3.3; z <= 9.3; z += 1.5) flat(box((x / 2 + Math.round(z)) % 2 ? '#cfc8b4' : '#c3bba5', x, .015, z, 1.9, .03, 1.4, room));
    box('#e8d9b1', 0, 1.8, -13.3, 31.2, 3.6, .2, room); box('#e8d9b1', -15.6, 1.8, -5.3, .2, 3.6, 16, room);
    box('#8a6a45', 0, .25, -13.18, 31, .5, .06, room); box('#8a6a45', -15.48, .25, -5.3, .06, .5, 16, room);
    // Bean shelf sits above head height so the staff lane behind the counter stays clear.
    box('#7d5c3c', BAR_X, 2.3, -13.1, 8, .06, .3, room);
    for (let i = 0; i < 13; i++) mesh(cylinder(.12, .12, .3), ['#d8c7a0', '#6b4325', '#f3e2b8'][i % 3], BAR_X - 3.6 + i * .6, 2.48, -13.05, 1, 1, 1, room);
    // Pendant lamps sit above head height so they never block walking.
    for (const x of [...STATIONS, ...REGISTERS, PICKUP_X]) { flat(box('#3a3a38', x, 3.3, COUNTER_Z, .02, .7, .02, room)); flat(mesh(new THREE.ConeGeometry(.28, .3, 14, 1, true), '#2f3d36', x, 2.85, COUNTER_Z, 1, 1, 1, room)); flat(mesh(sphere, '#ffe9a8', x, 2.75, COUNTER_Z, .1, .1, .1, room)); }
    // Pastry case next to the register.
    box('#7d5c3c', 9.4, .5, COUNTER_Z, 2, 1, .9, room);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, .6, .8), new THREE.MeshStandardMaterial({ color: '#dff2f5', transparent: true, opacity: .35 })); glass.position.set(9.4, 1.32, COUNTER_Z); room.add(glass);
    for (let i = 0; i < 6; i++) mesh(cylinder(.14, .14, .14), ['#e8b77a', '#a0522d', '#f4d7d9', '#f0e0a8'][i % 4], 8.75 + (i % 3) * .65, 1.1 + Math.floor(i / 3) * .25, COUNTER_Z, 1, 1, 1, room);
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
    // Gap is 3.8 m (planter ends at |x| = 1.9; room.glb was trimmed to match) so two people pass side by side.
    for (const [x, w] of [[-8.7, 13.6], [8.7, 13.6]]) { box('#8a6a45', x, .3, 2.6, w, .6, .5, room); for (let i = 0; i < w; i += 1.4) mesh(sphere, '#6f9a58', x - w / 2 + .6 + i, .75, 2.6, .45, .35, .3, room); }
    flat(box('#c8a36a', 0, .02, 3.5, 3.2, .03, .9, room));
    // Terrace street details: bike rack, lamp posts.
    for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(.3, .03, 6, 16, Math.PI), '#7a7f7d', 6 + i * .5, 0, 8.5, 1, 1, 1, room);
    for (const x of [-4, 4, 9]) { mesh(cylinder(.06, .08, 3), '#3a3a38', x, 1.5, 9.4, 1, 1, 1, room); flat(mesh(sphere, '#ffe9a8', x, 3.05, 9.4, .18, .18, .18, room)); }
    for (const [x, z] of PLANTS) { mesh(cylinder(.32, .25, .55), '#a8714c', x, .27, z, 1, 1, 1, room); mesh(sphere, '#5f8a4f', x, .9, z, .48, .58, .48, room); }
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
    // Back wall right of the brick: limewash with a soft mottle and panel seams instead of one flat colour; brass wall
    // sconces (no ceiling, so nothing hangs); a plank shelf with coffee bags, jars and trailing plants.
    const decor = new THREE.Group(); decor.userData.nonSolid = true; scene.add(decor);
    const limewash = (() => {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#efe2c4'; ctx.fillRect(0, 0, 1024, 256);
      let seed = 5; const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      for (let i = 0; i < 220; i++) { const r = 10 + rand() * 50, x = rand() * 1024, y = rand() * 256, g = ctx.createRadialGradient(x, y, 0, x, y, r); const c = rand() < .5 ? '255,250,236' : '196,170,128'; g.addColorStop(0, `rgba(${c},.18)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
      ctx.fillStyle = 'rgba(150,120,80,.18)'; for (let x = 128; x < 1024; x += 128) ctx.fillRect(x, 0, 2, 256); // panel seams
      ctx.fillStyle = 'rgba(120,90,60,.35)'; ctx.fillRect(0, 0, 1024, 6); // cornice shadow
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
    })();
    const plaster = new THREE.Mesh(new THREE.PlaneGeometry(16.3, 2.55), new THREE.MeshStandardMaterial({ map: limewash, roughness: .95 }));
    plaster.position.set(7.25, 2.32, -13.185); plaster.receiveShadow = true; decor.add(plaster);
    box('#7a5636', 7.25, 3.62, -13.15, 16.3, .1, .12, decor).userData.nonSolid = true; // cornice
    for (const x of [1.4, 5.6, 9.2, 14.2]) {
      box('#b08a4a', x, 2.62, -13.14, .06, .3, .1, decor).userData.nonSolid = true;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(.13, .2, .26, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#f3d79a', emissive: '#ffcf7a', emissiveIntensity: .9, side: THREE.DoubleSide }));
      shade.position.set(x, 2.85, -13.02); decor.add(shade);
    }
    box('#8a643f', 7.4, 1.95, -13.05, 3.4, .07, .32, decor).userData.nonSolid = true;
    for (const [i, x] of [6, 6.5, 7, 7.5].entries()) mesh(cylinder(.1, .1, .26), ['#d8c7a0', '#6b4325', '#f3e2b8', '#b07a45'][i], x, 2.12, -13.02, 1, 1, 1, decor).userData.nonSolid = true;
    for (const x of [8.2, 8.75]) mesh(sphere, '#a0784c', x, 2.15, -13.0, .2, .2, .14, decor).userData.nonSolid = true; // coffee bags
    mesh(cylinder(.14, .11, .2), '#a8714c', 9, 2.08, -13.02, 1, 1, 1, decor).userData.nonSolid = true;
    for (let i = 0; i < 5; i++) mesh(sphere, '#5f8a4f', 9 + (i % 2 ? .12 : -.08), 1.95 - i * .2, -12.98, .14, .16, .1, decor).userData.nonSolid = true; // trailing vine
    return {};
  }
  function buildActor({ npc, visual, box, mesh, sphere, assetSlot }) {
    assetSlot(visual, `cafe/${npc.id}`);
    // An empty slot shows a dashed outline and a "for sale" plate so players see where the upgrade goes.
    const slotOutline = (parent, w, d) => { const g = new THREE.Group(); parent.add(g); for (const [x, z, sw, sd] of [[0, -d / 2, w, .05], [0, d / 2, w, .05], [-w / 2, 0, .05, d], [w / 2, 0, .05, d]]) box('#b08a52', x, .04, z, sw, .02, sd, g).userData.nonSolid = true; g.userData.nonSolid = true; return g; };
    // Plate tilted toward the camera over an empty slot: "＋ icon name" so the player sees which upgrade fits there.
    const slotPlate = (parent, id, w, y = .35) => { const gear = GEAR.find(g => g.id === id), plate = canvasPlane(w, w * .3, (ctx, cw, ch) => {
      ctx.fillStyle = '#fff6dcee'; ctx.strokeStyle = '#b08a52'; ctx.lineWidth = 8; ctx.setLineDash([22, 14]); ctx.beginPath(); ctx.roundRect(6, 6, cw - 12, ch - 12, 26); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6b4a2b'; ctx.font = `800 ${Math.round(ch * .44)}px "Baloo 2", system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`＋ ${gear.icon} ${gear.name}`, cw / 2, ch / 2 + 2, cw - 40);
    }, parent, 0, y, .2); plate.rotation.x = -.8; parent.userData.statusAction = 'upgrade'; return plate; };
    if (npc.kind === 'bar') {
      const counter = assetSlot(new THREE.Group(), 'cafe/bar/counter'); visual.add(counter);
      box('#9b7044', 0, .55, 0, 8, 1.1, 1, counter); box('#ede0bd', 0, 1.13, 0, 8.2, .08, 1.15, counter);
      // One brewing station per slot: drip mat, kettle and phin set; extra stations appear with upgrades.
      const stations = STATIONS.map((x, i) => {
        const g = assetSlot(new THREE.Group(), `cafe/bar/station-${i}`); g.position.x = x - BAR_X; visual.add(g);
        box('#3a3a38', 0, 1.18, 0, 1.1, .02, .6, g);
        mesh(cylinder(.12, .14, .26), '#c5c9c4', -.35, 1.32, -.1, 1, 1, 1, g);
        for (let i = 0; i < 2; i++) mesh(cylinder(.08, .07, .14), '#d8dbd6', .15 + i * .22, 1.28, -.05, 1, 1, 1, g);
        box('#4f5a58', .45, 1.42, -.25, .28, .45, .28, g);
        return g;
      });
      // Stations 2–3 not bought yet: outline on the counter top plus a plate.
      const stationSlots = STATIONS.map((x, i) => { if (!i) return null; const g = slotOutline(visual, 1.1, .6); g.position.set(x - BAR_X, 1.15, 0); slotPlate(g, 'station', 2.1, .15); return g; });
      const autoSlot = slotOutline(visual, .7, .5); autoSlot.position.set(3.35, 1.15, -.2); slotPlate(autoSlot, 'autoEspresso', 1.8, .8);
      const parts = {};
      parts.espresso = assetSlot(new THREE.Group(), 'cafe/espresso-machine'); visual.add(parts.espresso);
      box('#6c8885', STATIONS[1] - BAR_X, 1.55, -.25, 1.1, .75, .5, parts.espresso); box('#d1d6c5', STATIONS[1] - BAR_X, 1.62, .02, .9, .25, .05, parts.espresso);
      parts.steamer = assetSlot(new THREE.Group(), 'cafe/bar/steamer'); visual.add(parts.steamer); mesh(cylinder(.1, .12, .22), '#d7dcdc', STATIONS[1] - BAR_X + .7, 1.28, .15, 1, 1, 1, parts.steamer);
      parts.mixer = assetSlot(new THREE.Group(), 'cafe/bar/mixer'); visual.add(parts.mixer); box('#e6d2b8', STATIONS[0] - BAR_X - .9, 1.35, -.2, .3, .38, .3, parts.mixer);
      parts.v60 = assetSlot(new THREE.Group(), 'cafe/bar/v60'); visual.add(parts.v60); mesh(new THREE.ConeGeometry(.16, .22, 14), '#f4f1ea', STATIONS[2] - BAR_X + .8, 1.42, 0, 1, -1, 1, parts.v60);
      parts.autoEspresso = assetSlot(new THREE.Group(), 'cafe/bar/autoEspresso'); visual.add(parts.autoEspresso);
      box('#2f3d36', 3.35, 1.6, -.2, .7, .9, .5, parts.autoEspresso); box('#8df0a8', 3.35, 1.75, .06, .45, .25, .02, parts.autoEspresso);
      // The pass: finished cups wait at the right end of the bar for a waiter or the player.
      box('#6e5240', 3.6, 1.2, .3, .7, .05, .4, counter);
      const cups = [0, 1, 2, 3, 4, 5].map(i => { const cup = mesh(cylinder(.08, .06, .18), '#fffaf0', 3.35 + (i % 3) * .2, 1.32, .2 + Math.floor(i / 3) * .2, 1, 1, 1, visual); cup.name = 'cup'; cup.userData.nonSolid = true; return cup; });
      return { setState({ gear, shelf }) {
        stations.forEach((g, i) => { g.visible = i <= (gear.station || 0); stationSlots[i] && (stationSlots[i].visible = !g.visible); });
        for (const [id, part] of Object.entries(parts)) part.visible = gear[id] > 0;
        autoSlot.visible = !(gear.autoEspresso > 0);
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
      const empty = slotOutline(visual, 2.4, 1); empty.position.x = REGISTERS[1] - REGISTER_X; slotPlate(empty, 'register2', 2.4);
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
    if (npc.kind === 'notebook') {
      // Coffee Notebook (coffee-memory.md §3): a small lectern with an open book and a bookmark, between the bar and the register.
      // Every part is nonSolid so walking lanes stay exactly as before; tap it to open the notebook modal.
      box('#7d5c3c', 0, .5, 0, .28, 1, .28, visual).userData.nonSolid = true;
      const tilt = box('#7d5c3c', 0, 1.02, 0, .8, .06, .6, visual); tilt.userData.nonSolid = true;
      box('#f6eed6', 0, 1.07, 0, .7, .05, .5, visual).userData.nonSolid = true;
      box('#b5483a', .2, 1.1, .05, .06, .02, .32, visual).userData.nonSolid = true;
      return {};
    }
    if (npc.kind === 'pantry') {
      box('#7d5c3c', 0, 1, 0, .7, 2, 1.8, visual);
      const goods = new THREE.Group(); visual.add(goods);
      for (const y of [.55, 1.15, 1.75]) box('#c39b6a', .37, y - .2, 0, .02, .04, 1.7, goods);
      for (let i = 0; i < 4; i++) { box('#f6f3ea', .2, .55, -.6 + i * .4, .25, .38, .22, goods); mesh(cylinder(.1, .1, .22), '#e9c45c', .2, 1.08, -.6 + i * .4, 1, 1, 1, goods); mesh(sphere, '#8a6a45', .2, 1.7, -.6 + i * .4, .17, .2, .17, goods); }
      return {};
    }
    if (npc.kind === 'expansion') {
      // For-sale sign until bought; then the garden simply shows its tables, the roastery its drum roaster.
      box('#7d5c3c', 0, .7, 0, .1, 1.4, .1, visual); box('#efe0bd', 0, 1.35, 0, 1.2, .6, .06, visual);
      for (let i = 0; i < 2; i++) box('#c9a45c', .6 - i * 1.2, .2, .5, .5, .4, .4, visual);
      const built = new THREE.Group(); visual.add(built); built.visible = false;
      if (npc.id === 'roastery') {
        box('#4a3a30', 0, .45, 0, 1.3, .9, .9, built); // base
        const drum = mesh(cylinder(.42, .42, 1), '#2f2f2d', 0, 1.2, 0, 1, 1, 1, built); drum.rotation.z = Math.PI / 2;
        mesh(new THREE.ConeGeometry(.3, .45, 12), '#b5893f', .2, 1.85, 0, 1, -1, 1, built); // hopper
        mesh(cylinder(.5, .5, .12), '#6b4325', -.2, .95, .75, 1, 1, 1, built); // cooling tray
        mesh(cylinder(.08, .08, 1.6), '#5b5b58', -.5, 2.2, -.2, 1, 1, 1, built); // chimney
        for (const [x, z] of [[.9, -.6], [.9, .3]]) mesh(sphere, '#b08a52', x, .35, z, .35, .4, .3, built); // bean sacks
      }
      // Everything else in the slot (placeholder sign, its GLB, their colliders) goes once bought.
      return { setState({ unlocked }) { for (const child of visual.children) child.visible = child === built ? unlocked : !unlocked; } };
    }
    if (npc.kind === 'board') {
      // A-frame chalkboard at the entrance: tap it to open the recipe book.
      box('#6e5240', 0, .6, 0, .95, 1.2, .1, visual);
      canvasPlane(.85, 1.05, (ctx, w, h) => {
        ctx.fillStyle = '#2f3d36'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f6eed6'; ctx.textAlign = 'center';
        ctx.font = 'bold 56px system-ui'; ctx.fillText(t('cafe.sign.menu'), w / 2, 70); ctx.font = '30px system-ui';
        RECIPES.slice(0, 10).forEach((r, i) => ctx.fillText(`${r.name} ${r.price}`, w / 2, 125 + i * 52));
      }, visual, 0, .62, .06);
      return {};
    }
    if (npc.kind === 'door') {
      // Entrance (an actor, so a tap on it targets the door): posts, beam, a sign that reads ĐANG MỞ / ĐÓNG CỬA and
      // two glass doors that swing into the hall when a shift opens. Doors never block walking.
      const entrance = visual;
      for (const x of [-2, 2]) box('#5e4128', x, 1.45, 0, .25, 2.9, .3, entrance);
      box('#5e4128', 0, 3, 0, 4.3, .3, .34, entrance).userData.nonSolid = true;
      const signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 112;
      const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
      const signPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.8, .62), new THREE.MeshBasicMaterial({ map: signTexture }));
      signPlane.position.set(0, 3.5, .02); signPlane.userData.nonSolid = true; entrance.add(signPlane);
      const panels = [];
      const leaves = [-1, 1].map(side => {
        const hinge = new THREE.Group(); hinge.position.set(side * 1.87, 0, 0); entrance.add(hinge); // not nonSolid: the panels inside decide
        const leaf = new THREE.Group(); leaf.position.x = -side * .92; hinge.add(leaf);
        const panel = box('#6b4a2b', 0, 1.2, 0, 1.8, 2.4, .07, leaf); panel.userData.nonSolid = true; panels.push(panel);
        const pane = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, .08), new THREE.MeshStandardMaterial({ color: '#cfe6ea', transparent: true, opacity: .45, roughness: .1 }));
        pane.position.set(0, 1.45, 0); pane.userData.nonSolid = true; leaf.add(pane);
        box('#d9b86a', side * .7, 1.1, .07, .06, .3, .06, leaf).userData.nonSolid = true; // handle
        return { hinge, side };
      });
      entranceState = { leaves, panels, angle: 0, open: null, solid: false, draw(open) {
        const ctx = signCanvas.getContext('2d');
        ctx.fillStyle = open ? '#2f5d3a' : '#6b2f2a'; ctx.beginPath(); ctx.roundRect(4, 4, 504, 104, 22); ctx.fill();
        ctx.strokeStyle = '#f2d79a'; ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = '#fff6dc'; ctx.font = '800 58px "Baloo 2", system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(open ? t('cafe.sign.open') : t('cafe.sign.closed'), 256, 60, 470); signTexture.needsUpdate = true;
      } };
      return {};
    }
    // Table by level: 2 wooden chairs → 4 chairs → cushions + lamp → sofas + flowers; cups left behind until cleaned.
    const open = new THREE.Group(), locked = new THREE.Group(), wood = new THREE.Group(), sofa = new THREE.Group(), extra = new THREE.Group(), cushions = new THREE.Group(), lamp = new THREE.Group(), flowers = new THREE.Group();
    // Table top and wooden chairs are sub-slots so a model replaces only them; upgrade props stay placeholders.
    const top = assetSlot(new THREE.Group(), `cafe/${npc.id}/table`), pair = assetSlot(new THREE.Group(), `cafe/${npc.id}/chairs-pair`);
    assetSlot(extra, `cafe/${npc.id}/chairs-extra`);
    visual.add(open, locked); open.add(top, wood, sofa, lamp, flowers); wood.add(pair, extra);
    sofa.name = 'sofa'; cushions.name = 'cushions'; lamp.name = 'lamp'; flowers.name = 'flowers'; locked.name = 'locked'; // để nạp hình Blender
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
    const cups = slots.map(([sx, sz]) => { const cup = mesh(cylinder(.06, .05, .12), '#f4efe4', sx * .32, .86, sz * .32, 1, 1, 1, open); cup.name = 'cup'; cup.userData.nonSolid = true; return cup; });
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
  const world = createAdventureScene(player, { theme: 'farm', mapBounds: bounds, interactions, buildActor, buildEnvironment, lighting: CAFE_LIGHT, portraitView: { focus: [-2, -5.5], zoom: .85, dolly: 1.45 } });
  // Flat floor name plates draw over walkers; the cafe uses status signs instead except for the bar.
  for (const item of interactions.filter(item => item.id !== 'bar')) for (const child of world.scene.getObjectByName(`farm:${item.id}`).children) if (child.renderOrder === 5) child.visible = false;
  // The scene's small round focus ring hides under long counters, so the cafe draws its own footprint glow instead.
  for (const item of interactions) for (const child of world.scene.getObjectByName(`farm:${item.id}`).children) if (child.geometry?.type === 'RingGeometry') child.visible = false;
  // Real models swap in once loaded (one load, cloned per table); a failed load keeps the placeholder blocks.
  let disposed = false;
  const loadModel = file => gltfLoader.loadAsync(`${import.meta.env.BASE_URL}models/cafe/${file}`);
  const espressoReady = loadModel('espresso-machine.glb').then(({ scene: machine }) => {
    if (disposed) return disposeScene(machine);
    // Pivot is bottom centre; sits on the counter top (y 1.17) and stays inside its depth so the staff lane is not narrowed.
    // Group head and portafilter face the barista in the staff lane (−Z), back to the guests.
    machine.position.set(STATIONS[1] - BAR_X, 1.17, -.18); machine.rotation.y = Math.PI;
    world.replaceAsset('cafe/espresso-machine', machine);
  }).catch(error => console.warn('Cafe: không tải được espresso-machine.glb, giữ khối tạm.', error));
  const tablesReady = loadModel('table.glb').then(({ scene: source }) => {
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
  const partsReady = attachModels({ replaceAsset: (id, model) => !disposed && world.replaceAsset(id, model) }, {
    'cafe/register/counter-0': 'cafe/register-counter.glb', 'cafe/register/counter-1': 'cafe/register-counter.glb',
    'cafe/pickup/counter': 'cafe/pickup-counter.glb',
    'cafe/kiosk/unit-0': 'cafe/kiosk.glb', 'cafe/kiosk/unit-1': 'cafe/kiosk.glb',
  });
  // Hình Blender (màu đỉnh, 1 vật liệu/file): chỉ đổi hình, khối tạm giữ làm vùng cản nên lối đi/điểm đứng không đổi.
  const artReady = Promise.all(['room', 'surroundings', 'fixtures', 'props', 'plant', 'pastry-case'].map(file => loadArt(`cafe/${file}.glb`))).then(([room, surroundings, fixtures, props, plant, pastry]) => {
    if (disposed) return;
    const slot = id => world.scene.getObjectByName(`asset:${id}`), part = name => fixtures?.getObjectByName(name)?.clone() ?? null;
    const at = (model, x, y, z) => { model?.position.set(x, y, z); return model; };
    if (room) {
      // Cây chậu và tủ bánh (Meshy; biển in sẵn trên nóc tủ đã cắt khỏi GLB) đặt cùng phòng; vùng cản vẫn là chậu/đế tủ/kính của khối tạm.
      const art = new THREE.Group(); art.add(room);
      if (pastry) art.add(at(pastry, 9.4, 0, COUNTER_Z));
      if (plant) PLANTS.forEach(([x, z], i) => { const copy = at(plant.clone(), x, 0, z); copy.rotation.y = i * 1.3; art.add(copy); });
      dressSlot(slot('cafe/room'), art, true);
      // The Meshy wood floor was busy and the same hue as the tables: a light, even oak reads calmer under them.
      // One continuous plane: the model's floor is strips over a dark base that showed through as stripes.
      room.getObjectByName('cafe_floor')?.removeFromParent();
      const oak = oakFloor(); oak.repeat.set(31 / 4, 15.8 / 4);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(31, 15.8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: oak, roughness: .85 }));
      floor.position.set(0, .014, -5.3); floor.receiveShadow = true; floor.userData.nonSolid = true; art.add(floor);
    }
    dressSlot(slot('cafe/surroundings'), surroundings);
    // The Meshy street (stretched shophouses) and old scenery give way to the code-built town; only the land stays.
    for (const name of ['cafe_meshy', 'cafe_scenery']) { const old = surroundings?.getObjectByName(name); if (old) { old.removeFromParent(); disposeScene(old); } }
    dressSlot(slot('cafe/bar/counter'), part('bar_counter'), true);
    STATIONS.forEach((_, i) => dressSlot(slot(`cafe/bar/station-${i}`), part('bar_station')));
    dressSlot(slot('cafe/bar/steamer'), at(part('bar_steamer'), STATIONS[1] - BAR_X + .7, 1.17, .15));
    dressSlot(slot('cafe/bar/mixer'), at(part('bar_mixer'), STATIONS[0] - BAR_X - .9, 1.17, -.2));
    dressSlot(slot('cafe/bar/v60'), at(part('bar_v60'), STATIONS[2] - BAR_X + .8, 1.17, 0));
    dressSlot(slot('cafe/bar/autoEspresso'), at(part('bar_auto'), 3.35, 1.17, -.2));
    for (const [id, name] of [['pantry', 'pantry'], ['board', 'board'], ['terrace', 'expansion'], ['roastery', 'expansion']]) dressSlot(slot(`cafe/${id}`), part(name), true);
    TABLES.forEach((_, i) => {
      const table = world.scene.getObjectByName(`farm:table-${i}`);
      // Ghế 1 và 3 tựa ở +X local (xem `slots` trong buildActor), sofa mẫu tựa ở −X nên xoay nửa vòng.
      table.getObjectByName('sofa').children.forEach((couch, k) => { const model = part('table_sofa'); if (model && k % 2) model.rotation.y = Math.PI; dressSlot(couch, model, true); });
      dressSlot(table.getObjectByName('lamp'), at(part('table_lamp'), .25, .795, -.2));
      dressSlot(table.getObjectByName('flowers'), at(part('table_flowers'), -.2, .795, .2));
      dressSlot(table.getObjectByName('locked'), part('table_locked'), true);
      const cushion = props?.getObjectByName('cushion')?.geometry;
      if (cushion) for (const pad of table.getObjectByName('cushions').children) pad.geometry = cushion;
    });
    // Ly: đổi geometry + vật liệu màu đỉnh (ly kem, cà phê), giữ vị trí và logic ẩn hiện; cỡ theo chiều cao khối cũ.
    const cup = props?.getObjectByName('cup');
    if (cup) world.scene.traverse(o => { if (o.name === 'cup' && o.isMesh) { o.scale.setScalar((o.geometry.parameters?.height || .18) / .18); o.geometry = cup.geometry; o.material = cup.material; } });
  });
  const FOOTPRINT = { bar: [8.6, 1.7], register: [5.8, 1.7], pickup: [2.9, 1.7], kiosk: [3, 1.5], pantry: [1.4, 2.4], board: [1.5, 1], notebook: [1.1, 1], table: [3.1, 3.1], expansion: [2.2, 2.2], door: [4.2, .8], exit: [1.9, 1.1] };
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
  const keyboard = createMovementInput();
  let events = null;
  let touch = { x: 0, z: 0 }, lastHud = 0, lastActors = 0, tableKey = '', escAt = 0;
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
  // Cảnh 3D (model, NPC, đèn) và ca bán (service: khách, ly đang pha, nhân viên) sống suốt ván như farm.
  // Rời quán chỉ tạm dừng: gỡ HUD/input; vào lại dời mốc giờ của ca rồi chơi tiếp đúng chỗ cũ.
  let cafeUi = null, active = false, leftAt = 0;
  const service = createCafeService(farm, {
    notice: (text, ok = true) => ui.notice(text, ok), reward: (pos, amount) => ui.flyReward('coins', amount, screenAt(pos)), route,
    canStand: (x, z) => world.canStand(x, z),
    onShiftEnd: report => cafeUi?.showShiftReport(report), fx: feedback,
    onIncident: info => cafeUi?.showIncident?.(info),
  });
  function openSession() {
    active = true; events = new AbortController();
    bindCafeFeedback({ vfx, screenAt, player, object: id => world.scene.getObjectByName(`farm:${id}`) });
    cafeUi = createCafeUI({ farm, service, awakening, profile, fx: feedback, screenAt, notice: (text, ok = true) => ui.notice(text, ok), onExit, onOrders: () => onMenu('orders'), onWalkTable: table => world.moveToNpc(`table-${table}`), onWalk: id => world.moveToNpc(id),onGuide: id => world.setQuestArrow(id) });
    document.body.classList.add('cafe-active');
    listen(); farm.setCafeActive(true); keyboard.clear(); touch = { x: 0, z: 0 };
    if (leftAt) service.resume(Date.now() - leftAt);
    // First visit: arrive on the terrace facing the door; it is entered through it once open.
    else { world.reset('farm'); player.position.set(0, .05, 5.4); }
    service.refresh(); syncActors();
    if (new URLSearchParams(location.search).get('debug') === 'grid') { world.prepareNavigation(); gridDebug = mountGridDebug(world, bounds, interactions); }
    incidentDebug = new URLSearchParams(location.search).get('debug') === 'incident' ? mountIncidentDebug(farm) : null;
  }
  function closeSession() {
    if (!active) return;
    active = false; leftAt = Date.now(); drag = null;
    gridDebug?.dispose(); incidentDebug?.dispose(); gridDebug = incidentDebug = null;
    farm.setCafeActive(false); events.abort(); cafeUi.dispose(); document.body.classList.remove('cafe-active');
    bindCafeFeedback(null); world.stopMovement();
  }

  const handCup = new THREE.Mesh(new THREE.CylinderGeometry(.09, .07, .2, 12), new THREE.MeshStandardMaterial({ color: '#fffaf0' }));
  handCup.position.set(.42, 1.0, .22); handCup.name = 'cup'; handCup.visible = false; player.add(handCup);
  // Café robots: placeholder blocks in an asset slot (docs/scene-assets.md "Robot nhân viên"); a GLB only swaps the look.
  // Wheels stand in for legs so animate() spins them while it moves.
  const ROBOT_ART = { waiter: ['cafe/robot-waiter', 'robot_waiter', 1.6], cleaner: ['cafe/robot-cleaner', 'robot_cleaner', 1.3], barista: ['cafe/robot-barista', 'robot_barista', 1.6] };
  const robotMaterials = new Map(), robotMat = color => robotMaterials.get(color) || robotMaterials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .6 })).get(color);
  function makeRobot(role) {
    const [slot, node, height] = ROBOT_ART[role], body = new THREE.Group();
    body.name = `asset:${slot}`; body.userData.assetSlot = slot;
    const part = (geometry, color, x, y, z) => { const m = new THREE.Mesh(geometry, robotMat(color)); m.position.set(x, y, z); m.castShadow = true; body.add(m); return m; };
    const wheels = [-.18, .18].map(x => part(new THREE.CylinderGeometry(.12, .12, .08, 12).rotateZ(Math.PI / 2), '#6c8885', x, .12, 0));
    part(role === 'cleaner' ? new THREE.BoxGeometry(.6, .7, .5) : new THREE.CylinderGeometry(.25, .25, height - .75, 14), '#e8e2d4', 0, .22 + (height - .75) / 2, 0);
    part(new THREE.BoxGeometry(.42, .3, .32), '#e8e2d4', 0, height - .17, 0);
    part(new THREE.BoxGeometry(.34, .16, .02), '#8df0a8', 0, height - .17, .17);
    if (role === 'waiter') part(new THREE.BoxGeometry(.32, .03, .32), '#6c8885', .42, .9, .22);
    body.userData.legs = wheels;
    loadArt(`cafe/robots.glb#${node}`).then(model => { if (!disposed) dressSlot(body, model, true); });
    return body;
  }
  function makeNpc(color, model, robotRole = null) {
    const group = new THREE.Group(), person = robotRole ? makeRobot(robotRole) : createPerson(color); group.add(person);
    if (!robotRole) { person.scale.setScalar(1); dressPerson(person, model); } // same height as the player so guests read at a glance
    group.userData.nonSolid = true; world.scene.add(group);
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(1.86, .93, 1); sprite.position.y = robotRole ? ROBOT_ART[robotRole][2] + .7 : 2.6; group.add(sprite);
    return { group, person, canvas, texture, sprite, key: '', walk: 0 };
  }
  // Bubble = icon plus an optional bar: guests show patience (green → red), staff show work progress (blue).
  // Bubble = icon (+ the drink's name for orders, since several drinks share an icon) plus an optional bar:
  // guests show patience (green → red), staff show work progress (blue).
  function drawBubble(npc, icon, ratio, work = false, name = '') {
    const key = `${icon}:${name}:${ratio === null ? '' : Math.ceil(ratio * 16)}:${work}`;
    if (npc.key === key) return; npc.key = key;
    const ctx = npc.canvas.getContext('2d'); ctx.clearRect(0, 0, 256, 128);
    npc.sprite.visible = Boolean(icon);
    if (!icon) return;
    const w = name ? 240 : 150, x0 = 128 - w / 2, mid = ratio === null ? 54 : 44;
    ctx.fillStyle = '#3b2a1cd9'; ctx.strokeStyle = work ? '#4f7fa8' : '#8b6e34'; /* same dark nameplate as the world labels */ ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(x0, 6, w, 96, 24); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(116, 100); ctx.lineTo(128, 122); ctx.lineTo(140, 100); ctx.fill();
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff6dc';
    if (name) {
      ctx.textAlign = 'center'; fillRich(ctx, icon, x0 + 38, mid, 44, Infinity, true);
      ctx.textAlign = 'left'; ctx.font = '800 34px "Baloo 2", system-ui'; ctx.fillText(name, x0 + 68, mid + 2, w - 82);
    } else { ctx.font = '54px system-ui'; ctx.textAlign = 'center'; fillRich(ctx, icon, 128, mid, 54, Infinity, true); }
    if (ratio !== null) {
      ctx.fillStyle = '#d9cdb4'; ctx.fillRect(x0 + 20, 78, w - 40, 12);
      ctx.fillStyle = work ? '#5a9bd4' : ratio > .5 ? '#7fb35d' : ratio > .25 ? '#e0b44c' : '#d0573f'; ctx.fillRect(x0 + 20, 78, (w - 40) * Math.max(0, Math.min(1, ratio)), 12);
    }
    npc.texture.needsUpdate = true;
  }
  function animate(npc, pos, facing, dt, seated = false) {
    const moved = Math.hypot(pos.x - npc.group.position.x, pos.z - npc.group.position.z) > .001;
    npc.group.position.set(pos.x, seated ? -.18 : pos.z > 10.2 ? .13 : .05, pos.z); npc.group.rotation.y = facing; // the sidewalk sits 8 cm higher
    npc.walk = moved ? npc.walk + dt * 9 : 0;
    const [left, right] = npc.person.userData.legs; npc.person.userData.seated = seated;
    left.rotation.x = Math.sin(npc.walk) * .5; right.rotation.x = -Math.sin(npc.walk) * .5;
  }
  // Passers-by on both sidewalks keep the street alive; scenery only, never customers.
  const passers = [[-26, 11.65, 1], [9, 20.3, -1], [24, 20.7, -1], [-4, 11.75, 1], [15, 11.6, -1]].map(([x, z, dir], i) => {
    const npc = makeNpc(['#6f8fb0', '#b0667a', '#7e9a5c', '#c09a4f', '#8d74a8'][i], i % 2 ? 'cafe/guest-f.glb' : 'cafe/guest-m.glb');
    drawBubble(npc, '', null); return { npc, pos: { x, z }, dir, speed: 1.2 + i * .12 };
  });
  function walkPassers(dt) {
    for (const p of passers) {
      p.pos.x += p.dir * p.speed * dt;
      if (Math.abs(p.pos.x) > 32) p.pos.x = -p.dir * 32;
      animate(p.npc, p.pos, p.dir * Math.PI / 2, dt);
    }
  }
  const guests = new Map(), staff = new Map();
  const JOB_ICON = { order: '🧾', clean: '🧽', deliver: '🛎️' };
  // Staff breaks (crew-autoplay.md 4): tired, lazy while healthy, does not want this job.
  const SLACK_ICON = { tired: '😮‍💨', lazy: '🥱', dislike: '🙅' };
  function syncNpcs(dt) {
    const seen = new Set();
    for (const c of service.customers) {
      seen.add(c.id);
      let npc = guests.get(c.id);
      if (!npc) { npc = makeNpc(c.color, [...String(c.id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 2 ? 'cafe/guest-f.glb' : 'cafe/guest-m.glb'); npc.group.position.set(c.pos.x, .05, c.pos.z); guests.set(c.id, npc); }
      animate(npc, c.pos, c.facing, dt, ['seated', 'drinking'].includes(c.phase));
      const ordered = ['toSeat', 'seated', 'toPickup', 'pickup'].includes(c.phase), waitingInLine = c.phase === 'queue' && !c.path.length;
      const icon = c.mood || (ordered ? recipeById(c.recipeId).icon : c.phase === 'kiosk' ? '🖥️' : waitingInLine ? '🧾' : '');
      drawBubble(npc, icon, ordered || waitingInLine ? c.patience / c.patienceMax : c.phase === 'kiosk' && !c.path.length ? 1 - c.timer / 4 : null, c.phase === 'kiosk', ordered && !c.mood ? recipeShort(c.recipeId) : waitingInLine && !c.mood ? t('cafe.bubble.order') : '');
    }
    for (const [id, npc] of guests) if (!seen.has(id)) { world.scene.remove(npc.group); disposeScene(npc.group); guests.delete(id); }
    const hired = new Set();
    for (const a of service.agents) {
      hired.add(a.id);
      let npc = staff.get(a.id);
      if (!npc) {
        npc = makeNpc(STAFF_ROLES.find(r => r.id === a.role).color, 'cafe/staff.glb', a.robot ? a.role : null); npc.group.userData.staffId = a.id;
        // nonSolid: a robot GLB swap (dressSlot) must not turn the cup into an invisible collider; visibility is set every frame.
        const cup = handCup.clone(); cup.visible = false; cup.userData.nonSolid = true; if (a.role === 'cleaner' && a.robot) cup.position.set(.4, .85, .22);
        npc.person.add(cup); npc.cup = cup; staff.set(a.id, npc);
      }
      animate(npc, a.pos, a.facing ?? Math.PI, dt);
      // The trial robot barista walks out of the staff door once its cups are made.
      npc.group.visible = !(a.left && !a.path.length);
      if (glowStaff === a.id) glow.position.set(a.pos.x, .06, a.pos.z);
      npc.cup.visible = Boolean(a.carry);
      const job = a.job, working = job && a.timerMax, incident = a.rude ? '😤' : a.phoneUntil > Date.now() && a.active ? '📱' : a.sick ? '🤒' : !job && a.slackUntil > Date.now() ? SLACK_ICON[a.slack] : '';
      const icon = incident || (!a.active ? '💤' : job ? (job.type === 'brew' ? recipeById(job.recipeId).icon : job.type === 'deliver' && a.carry ? recipeById(a.carry.recipeId).icon : JOB_ICON[job.type]) : a.blocked ? '❓' : a.role === 'manager' ? '📋' : '');
      drawBubble(npc, icon, a.rude ? (a.rude.until - Date.now()) / 3000 : working ? a.timer / a.timerMax : null, !a.rude);
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
    const cafe = service.snap.cafe, now = Date.now();
    if (entranceState && entranceState.open !== cafe.open) { entranceState.open = cafe.open; entranceState.draw(cafe.open); }
    // Chairs and sofas change the table's footprint, so walking colliders must follow upgrades.
    const shape = `${cafe.tables.join()}|${Object.values(cafe.gear).join()}`;
    if (shape !== tableKey) { tableKey = shape; world.invalidateNavigation(); }
    for (const id of ['bar', 'register', 'pickup', 'kiosk']) world.setActorState(id, { gear: cafe.gear, shelf: service.shelf.length });
    for (let i = 0; i < TABLES.length; i++) {
      const dirty = [0, 1, 2, 3].map(slot => service.dirty.has(`${i}:${slot}`));
      world.setActorState(`table-${i}`, { unlocked: service.isOpen(i), level: cafe.tables[i], dirty });
      world.setObjectStatus(`table-${i}`, { text: service.isOpen(i) && dirty.some(Boolean) ? t('cafe.status.clean') : '' });
    }
    // Every drink being brewed shows its own countdown badge above the bar.
    const jobs = service.agents.filter(a => a.job?.type === 'brew' && a.timerMax).map(a => ({ icon: recipeById(a.job.recipeId).icon, units: 1, startedAt: now - a.timer * 1000, readyAt: now + (a.timerMax - a.timer) * 1000 }));
    if (service.autoJob) jobs.push({ icon: '🤖', units: 1, startedAt: service.autoJob.startedAt, readyAt: service.autoJob.readyAt });
    world.setObjectStatus('bar', { jobs });
    const front = service.customers.some(c => c.phase === 'queue' && !c.path.length);
    world.setObjectStatus('register', { text: front ? t('cafe.status.ordering') : t('cafe.status.register') });
    world.setObjectStatus('pickup', { text: cafe.gear.pickup ? t('cafe.status.pickup') : t('cafe.status.pickupEmpty') });
    world.setObjectStatus('kiosk', { text: cafe.gear.kiosk ? t('cafe.status.kiosk') : t('cafe.status.kioskEmpty') });
    const low = SUPPLIES.some(s => ['cup', 'condensed', cafe.prefs?.milk, 'ice'].includes(s.id) && cafe.supplies[s.id] < s.pack / 5);
    world.setObjectStatus('pantry', { text: low ? t('cafe.status.pantryLow') : t('cafe.status.pantry') });
    world.setObjectStatus('board', { text: t('cafe.status.book') });
    world.setObjectStatus('notebook', { text: t('cafe.status.notebook') });
    for (const id of ['terrace', 'roastery']) {
      const gear = GEAR.find(g => g.id === id), owned = cafe.gear[id] > 0;
      world.setActorState(id, { unlocked: owned });
      world.setObjectStatus(id, { text: owned ? (id === 'roastery' ? t('cafe.status.roastery') : '') : t('cafe.status.locked', { name: gear.name, price: t('cafe.coins', { n: gear.prices[0] }) }) });
    }
  }
  function interact(id) {
    glowUntil = performance.now() + 1200;
    if (id === 'door') { const r = service.toggleOpen(); ui.notice(r.message, r.ok); cafeUi.refreshHud(); return; }
    if (id === 'register') service.arriveRegister();
    else if (id === 'pickup') { if (service.snap.cafe.gear.pickup) service.arrivePickup(); else cafeUi.openUpgrades('auto'); }
    else if (id === 'kiosk') cafeUi.openUpgrades('auto');
    else if (id === 'bar') { if (!service.arriveBar()) cafeUi.openBench(); }
    else if (id === 'pantry') cafeUi.openPantry();
    else if (id === 'board') cafeUi.openBook();
    else if (id === 'notebook') cafeUi.openMemory();
    else if (id.startsWith('table-')) service.arriveTable(Number(id.slice(6)));
    else if (id === 'terrace' || id === 'roastery') {
      // Walk to the sign first; with enough coins the «Mở rộng» tab is the confirmation, otherwise say how much is missing.
      const gear = GEAR.find(g => g.id === id), coins = service.refresh().coins;
      if (service.snap.cafe.gear[id]) ui.notice(id === 'roastery' ? t('cafe.notice.roastery') : t('cafe.notice.terrace'));
      else if (coins < gear.prices[0]) ui.notice(t('cafe.notice.short', { name: gear.name, price: gear.prices[0], missing: Math.ceil(gear.prices[0] - coins) }), false);
      else cafeUi.openUpgrades('expand');
    }
    cafeUi.refreshHud();
  }
  // Auto is live when the farm called autoStep this frame or the last; then a window the player opened does not freeze the character.
  let autoLive = 0;
  const autoOn = () => performance.now() - autoLive < 300;
  const playerWindow = () => ui.modalOpen || (cafeUi.open && !['bench', 'shift'].includes(cafeUi.view));
  const blocked = () => isSettingsOpen() || (autoOn() ? cafeUi.open && cafeUi.view === 'bench' : ui.modalOpen || cafeUi.open);
  // ---- Auto mode (docs/shared/crew-autoplay.md 5): plays the owner through the real controls, never a job staff already hold ----
  let autoGoal = null, autoWait = 0, noBrewUntil = 0, autoIncident = null, autoDoing = null, autoErrandAt = 0;
  const spot = id => { const item = interactions.find(entry => entry.id === id); return item && screenAt({ x: item.position[0], z: item.position[1] }); };
  const wanting = recipeId => service.customers.find(c => c.recipeId === recipeId && ['seated', 'toSeat', 'pickup', 'toPickup'].includes(c.phase));
  // Errands that need no walking (crew-autoplay.md 5): buy a missing supply for a waiting order, call beans from the farm.
  function autoErrand() {
    const cafe = service.snap.cafe, now = Date.now(), coins = farm.peek().coins;
    if (now < autoErrandAt) return null;
    for (const tk of service.tickets().filter(tk => !tk.covered)) {
      const short = Object.entries(resolveUses(tk.recipe.uses, cafe)).map(([id, amount]) => SUPPLIES.find(x => x.id === id) && (cafe.supplies[id] || 0) < amount ? SUPPLIES.find(x => x.id === id) : null).find(Boolean);
      if (short && coins >= short.price + 5) return { scope: 'cafe', action: 'buy', choice: short.id, spot: 'pantry', text: t('crew.auto.cafe.buy', { name: short.name }) };
    }
    const beans = Object.values(cafe.stock.roasted).reduce((sum, n) => sum + n, 0), farmBeans = CROPS.find(c => (farm.peek().stock.roasted[c.id] || 0) >= 100);
    if (beans < 120 && farmBeans && !cafe.shipments.length && coins >= 2) return { scope: 'cafe', action: 'ship', choice: farmBeans.id, spot: null, text: t('crew.auto.cafe.callBeans') };
    return null;
  }
  function autoPick(ctx, behind = false) {
    const cafe = service.snap.cafe, now = Date.now();
    // Shift over and the farm needs hands: walk back to the farm instead of opening a new shift.
    if (!cafe.open && !service.shift && ctx.goFarm && ctx.farmWork()) return { id: 'farm', text: t('crew.auto.cafe.toFarm') };
    if (!cafe.open && !service.shift) return { id: 'door', text: t('crew.auto.cafe.open') };
    if (service.hand) {
      const c = wanting(service.hand.recipeId);
      if (c?.seat) return { id: `table-${c.seat.table}`, text: t('crew.auto.cafe.serve', { n: c.seat.table + 1 }) };
      return c ? { id: cafe.gear.pickup ? 'pickup' : 'register', text: t('crew.auto.cafe.takeaway') } : { id: 'bar', text: t('crew.auto.cafe.shelve') };
    }
    if (service.shelf.some(d => !service.isClaimed(`drink:${d.id}`) && wanting(d.recipeId))) return { id: 'bar', text: t('crew.auto.cafe.pickup') };
    if (service.queueLength() && !service.staffOn('cashier')) return { id: 'register', text: t('crew.auto.cafe.order') };
    // No clean seat left while guests queue: clean first, or they are sent to take-away and walk out angry (maxed café, 04/11).
    const dirtyTable = () => [...new Set([...service.dirty].map(k => Number(k.split(':')[0])))].find(n => !service.isClaimed(`clean:${n}`));
    const blocked = service.queueLength() && !service.hasCleanSeat() ? dirtyTable() : undefined;
    if (blocked !== undefined) return { id: `table-${blocked}`, text: t('crew.auto.cafe.clean', { n: blocked + 1 }) };
    const ticket = !behind && now >= noBrewUntil && service.tickets().find(tk => !tk.covered && CROPS.some(c => !missingFor(tk.recipe, cafe, c.id).length));
    if (ticket) return { id: 'bar', text: t('crew.auto.cafe.brew', { drink: ticket.recipe.name }) };
    const table = dirtyTable();
    if (table !== undefined) return { id: `table-${table}`, text: t('crew.auto.cafe.clean', { n: table + 1 }) };
    return cafe.open ? { id: 'register', text: t('crew.auto.cafe.wait') } : null;
  }
  // Show the hand on a control for ~1 s, then tap it, so the player sees where to press.
  const autoPress = (hud, element, text, delay = 1100) => hud.tap(element, text, delay);
  // The bench (Auto): tap ⚡ Pha nhanh, wait, carry the cup. Auto never plays the hand steps (04-cafe/gameplay.md "Pha nhanh").
  function autoBench(hud) {
    const root = document.getElementById('cafe-dialog');
    if (!root?.open) { hud.show(null, t('crew.auto.waitModal')); return; }
    // Only the end-of-shift report is closed by Auto; any other window is the player's and stays.
    if (cafeUi.view === 'shift') { autoPress(hud, root.querySelector('.cafe-close'), t('crew.auto.closeModal'), 1500); return; }
    const done = root.querySelector('.cafe-result .cafe-primary');
    if (done) { autoPress(hud, done, t('crew.auto.bench.carry'), 1200); return; }
    // Missing ingredients: back off 20 s. The drink picker (every order already covered): just close, nothing to brew.
    if (root.querySelector('.cafe-warning')) { noBrewUntil = Date.now() + 20000; autoPress(hud, root.querySelector('.cafe-close'), t('crew.auto.bench.lacking'), 1500); return; }
    const quick = root.querySelector('.cafe-quick');
    if (quick) { autoPress(hud, quick, t('crew.auto.bench.quick'), 900); return; }
    if (root.querySelector('.cafe-result progress')) { hud.show(null, t('crew.auto.bench.wait')); return; }
    autoPress(hud, root.querySelector('.cafe-close'), t('crew.auto.closeModal'), 1200);
  }
  function autoStep(hud, dt, ctx = {}) {
    autoLive = performance.now();
    if (isSettingsOpen()) { hud.show(null, t('crew.auto.waitModal')); return; }
    const behind = playerWindow(); // the player's window stays open; Auto works behind it with the hand hidden
    const show = (point, text) => hud.show(behind ? null : point, text);
    // Staff incidents: stop a rude remark at once, wake a phone user (tap the person = «Nhắc»).
    const incident = service.incidents.filter(i => i.type !== 'sick').sort((a, b) => (a.type === 'rude' ? 0 : 1) - (b.type === 'rude' ? 0 : 1))[0];
    if (incident) {
      show(screenAt(incident.pos), t(incident.type === 'rude' ? 'crew.auto.cafe.rude' : 'crew.auto.remind', { name: incident.name }));
      if (autoIncident?.id !== incident.id) autoIncident = { id: incident.id, at: performance.now() + (incident.type === 'rude' ? 600 : 1200) };
      if (performance.now() >= autoIncident.at) { autoIncident = null; selectStaff(incident.id); service.remind(incident.id); cafeUi.refreshHud(); }
      return;
    }
    if (cafeUi.open && !behind) { autoBench(hud); return; }
    if (autoDoing) {
      show(autoDoing.spot ? spot(autoDoing.spot) : null, autoDoing.text);
      if (performance.now() < autoDoing.at) return;
      const job = autoDoing; autoDoing = null; autoErrandAt = Date.now() + 1500;
      const r = farm.act(job.scope, job.action, job.choice); ui.notice(r.message, r.ok); if (!r.ok) autoErrandAt = Date.now() + 15000; cafeUi.refreshHud(); return;
    }
    if (autoGoal && performance.now() < autoGoal.until) { show(spot(autoGoal.id), autoGoal.text); return; }
    autoGoal = null;
    if ((autoWait -= dt) > 0) return; autoWait = .5;
    const errand = autoErrand();
    if (errand) { autoDoing = { ...errand, at: performance.now() + 1400 }; return; }
    const pick = autoPick(ctx, behind);
    if (pick?.id === 'farm') { if (behind) return; hud.show(null, pick.text); ctx.goFarm(); return; }
    if (!pick) { hud.show(null, t('crew.auto.cafeIdle')); return; }
    show(spot(pick.id), pick.text);
    if (pick.id === 'register' && nearRegister()) return; // standing there already takes orders / hands out take-away cups
    autoGoal = { ...pick, until: performance.now() + 15000 };
    select(pick.id); world.moveToNpc(pick.id);
  }
  let registerTick = 0;
  // Anywhere behind the register (within 1.6 m of a cashier spot) counts: no need to hit the exact tile or tap the till.
  const nearRegister = () => REGISTERS.some(x => Math.hypot(player.position.x - x, player.position.z - LANE_Z) < 1.6);
  let drag = null, suppress = 0;
  function listen() {
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#game canvas') || blocked() || e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false }; }, { signal: events.signal });
  document.addEventListener('pointermove', e => { if (!drag) return; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true; if (drag.moved) { const rect = document.querySelector('#game canvas').getBoundingClientRect(); world.panCamera(drag.lastX, drag.lastY, e.clientX, e.clientY, rect); drag.lastX = e.clientX; drag.lastY = e.clientY; } }, { signal: events.signal });
  document.addEventListener('pointerup', () => { if (drag?.moved) suppress = performance.now() + 350; drag = null; }, { signal: events.signal });
  // Đổi tab/rời cửa sổ khi đang kéo: pointerup rơi vào chỗ khác, nên bỏ kéo để camera không trôi theo chuột.
  for (const [target, type] of [[document, 'pointercancel'], [window, 'blur'], [document, 'visibilitychange']]) target.addEventListener(type, () => { drag = null; }, { signal: events.signal });
  // A hidden tab freezes the model but not Date.now(): shift clock and cup age would run on, so shift them by the hidden gap on return.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt) { service.resume(Date.now() - hiddenAt); hiddenAt = 0; } }, { signal: events.signal });
  document.addEventListener('click', e => {
    const canvas = e.target.closest('#game canvas'); if (!canvas || blocked() || performance.now() < suppress) return;
    const rect = canvas.getBoundingClientRect(), id = pickStaff(e.clientX, e.clientY, rect);
    // Tapping a person on their phone or about to be rude handles the incident instead of opening the staff sheet.
    if (id) { selectStaff(id); if (!service.remind(id)) cafeUi.openStaff(id); return; }
    select(null);
    // Tapping a table or chair opens its card; with a cup in hand it walks over to serve instead.
    world.moveToScreen(e.clientX, e.clientY, rect, (target, { action } = {}) => {
      select(target);
      if (action === 'upgrade') { glowUntil = performance.now() + 1200; cafeUi.openUpgrades('auto'); return true; } // tapped an empty slot plate
      if (!target.startsWith('table-') || service.hand) return false;
      glowUntil = performance.now() + 1200; cafeUi.openTable(Number(target.slice(6))); return true;
    });
  }, { signal: events.signal });
  // Same wheel zoom as the farm map.
  document.addEventListener('wheel', e => {
    if (!e.target.closest('#game canvas') || blocked() || e.ctrlKey) return;
    e.preventDefault(); world.zoomView(e.deltaY < 0 ? .1 : -.1);
  }, { passive: false, signal: events.signal });
  }
  const picker = new THREE.Raycaster();
  // Staff are not world interactions, so they are picked here before the scene handles the click.
  function pickStaff(x, y, rect) {
    const groups = [...staff.values()].map(npc => npc.group);
    if (!groups.length) return null;
    picker.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), world.camera);
    for (let o = picker.intersectObjects(groups, true)[0]?.object; o; o = o.parent) if (o.userData.staffId) return o.userData.staffId;
    return null;
  }
  // Layout debugging: open the game with ?debug=grid to see walkable cells and audited routes (G redraws).
  let gridDebug = null, incidentDebug = null;
  openSession();
  return {
    scene: world.scene, camera: world.camera, resize: world.resize,
    // Settles once every scene model has swapped in (or failed), so the farm can hold a fade over the placeholders.
    ready: Promise.allSettled([espressoReady, tablesReady, partsReady, artReady]),
    setTouch(value) { touch = value; if (value.x || value.z) world.stopMovement(); },
    autoStep,
    clearInput() { keyboard.clear(); touch = { x: 0, z: 0 }; world.stopMovement(); },
    update(dt, time) {
      const result = world.update(dt, time, keyboard.combine(touch), blocked());
      if (result.arrivedNpc) { autoGoal = null; if (autoOn() && playerWindow() && result.arrivedNpc === 'bar') service.arriveBar(); else interact(result.arrivedNpc); }
      // Auto-serve at the register while the player stands there idle (twice a second).
      if (!blocked() && !touch.x && !touch.z && nearRegister() && (registerTick -= dt) <= 0) { registerTick = .5; if (service.autoRegister()) cafeUi.refreshHud(); }
      // Pulse the selection glow; fade it out a moment after the player reaches the object.
      if (glow.visible) {
        glow.material.opacity = .6 + .4 * Math.sin(time * 6);
        if (glowUntil && cafeUi.open) glowUntil = performance.now() + 1200;
        else if (glowUntil && performance.now() > glowUntil) select(null);
      }
      if (entranceState) {
        // Doors swing in over ~0.5 s when the shift opens and close again after it.
        // Closed: the door blocks anyone coming in from outside; from inside it swings open as you reach it (way out).
        const inside = player.position.z < 2.6, nearDoor = inside && Math.abs(player.position.x) < 2.2 && player.position.z > .4;
        const solid = !entranceState.open && !inside;
        if (solid !== entranceState.solid) { entranceState.solid = solid; for (const panel of entranceState.panels) panel.userData.nonSolid = !solid; world.invalidateNavigation(); }
        entranceState.angle += ((entranceState.open || nearDoor ? 1 : 0) - entranceState.angle) * (1 - Math.exp(-6 * dt));
        for (const { hinge, side } of entranceState.leaves) hinge.rotation.y = -side * Math.PI / 2 * entranceState.angle;
      }
      service.update(dt, Date.now(), player.position); syncNpcs(dt); walkPassers(dt);
      if (time - lastHud > .25) { lastHud = time; cafeUi.refreshHud(); }
      if (time - lastActors > .5) { lastActors = time; service.refresh(); syncActors(); cafeUi.tick(); }
      setListener(player.position, world.camera); vfx.update(dt);
    },
    // Esc twice within 2.5 s leaves (audit 04/11): one stray Esc on desktop no longer throws you out of the shift.
    handleKeyDown(e) { if (cafeUi.open || isSettingsOpen()) return; if (e.code === 'Escape') { if (onExit && !e.repeat) { if (performance.now() - escAt < 2500) { escAt = 0; onExit(); } else { escAt = performance.now(); ui.notice(t('cafe.notice.escAgain')); } } return; } if (keyboard.down(e)) world.stopMovement(); },
    handleKeyUp: e => keyboard.up(e),
    // Rời quán: tạm dừng, giữ cảnh và ca bán để lần sau vào lại ngay (enter) như khi về farm.
    leave: closeSession,
    enter: openSession,
    // Rời hẳn ván (đổi màn): khách đang chờ bỏ về như luật cũ.
    dispose() {
      const abandoned = service.abandon();
      closeSession(); disposed = true; vfx.dispose(); world.dispose();
      return abandoned;
    },
    replaceAsset: world.replaceAsset, getAssetSlots: world.getAssetSlots,
  };
}
