/**
 * Realm — the 3D world of Farm & Café V3 (contract: docs/design/v3-architecture.md § Realm API).
 *
 * Renders the current region of the save (layout.js + store.state), turns taps/drags into store actions and owns
 * the café customer spawning. A region has two areas in the same scene — the farm (BOUNDS) and the café (CAFE_BOUNDS,
 * far south) — and the realm shows one at a time: `realm.view` ('farm' | 'cafe'), switched with `setView(view)` (short
 * fade, player + camera move to AREAS[view].spawn). Customers keep simulating in either view; they render in the café. Store orders/plots/buildings are the source of truth: visuals are diffed by id on every
 * store change (subscribe), and only time-based visuals (growth, brewing, patience) are evaluated per frame.
 * Sub-modules: world (ground/roads/fields/gate; café city via city.js), plots, buildings, cafe (customers: queue →
 * seat → served), seats, staff, avatar, camera (CameraController), placement (ghost preview), markers (tutorial arrow,
 * selection, drag cursor), badges (object notices: ▲ upgrade, ! order, + brew, ☕ serve, sickle, + for sale),
 * cinematics, input (gesture recognizer). Every action dispatched here is reported through hooks.onResult.
 */
import * as THREE from 'three';
import { BUILDINGS, CROPS, CROP_ORDER, DRINKS } from '../../core/config/economy.js';
import { PARCELS, GATE, FIXED, PLOT_SIZE, CUSTOMER, CAFE_SEATS, AREAS, BOUNDS, CAFE_BOUNDS, RESERVED, plotById, plotsOf, parcelAt, areaAt, areaOfParcel, rectCenter } from '../../core/config/layout.js';
import { region as regionOf, footprint, upgradeError, parcelError, seatCount, seatsUsed, brewSlots, seatPatienceRatio, ownedPlots, capacity, cropUnlocked, seedCost, cafeStaffed } from '../../core/derive.js';
import { loadModel } from '../../shared/three/models.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { createVfx, flyTo, popNumber } from '../../shared/vfx/index.js';
import { sfx } from '../../shared/audio/index.js';
import { createCameraController } from './camera.js';
import { createWorld, parcelSignPoint } from './world.js';
import { createPlots } from './plots.js';
import { createBuildings, makePrefab } from './buildings.js';
import { createCafe } from './cafe.js';
import { createStaff } from './staff.js';
import { createAvatar } from './avatar.js';
import { createPlacement } from './placement.js';
import { createMarkers } from './markers.js';
import { createCinematics } from './cinematics.js';
import { createBadges } from './badges.js';
import { createPads } from './pads.js';
import { setTableInfo, standSpot } from './seats.js';
import { createNav, navObstacles, rectArea } from './nav.js';
import { createInput } from './input.js';
import { groundPoint, unionRect, fmtTimer, clamp } from './util.js';

const SKY = 0xb4e2f7; // fog uses the same color so the horizon melts into the sky
const TREE_PARTS = { tree: 'farm/coffee-tree.glb#tree', fruitGreen: 'farm/coffee-tree.glb#fruit_green', fruitRipe: 'farm/coffee-tree.glb#fruit_ripe' };
const GATE_PARTS = { gateFrame: 'heaven/portal.glb#portal_frame', gateLeft: 'heaven/portal.glb#portal_left_leaf', gateRight: 'heaven/portal.glb#portal_right_leaf' };
const EXTRA_MODELS = ['cafe/espresso-machine.glb#machine', 'cafe/table.glb#chairs_pair', 'cafe/props.glb#cup'];
const FADE_OUT = .2, FADE_IN = .32; // view switch fade (seconds)
const BADGE_Y = 1.05; // object-notice anchor above a building's top
// The seated customer closest to running out of patience comes first (brew / pick up / serve).
const mostUrgent = (orders, test, now) => { let best = null, bp = -1; for (const o of orders) if (test(o)) { const p = seatPatienceRatio(o, now); if (p > bp) { bp = p; best = o; } } return best; };
const KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
const COUNTER_RECT = unionRect(
  unionRect(footprint('orderCounter', FIXED.orderCounter.x, FIXED.orderCounter.z), footprint('brewCounter', FIXED.brewCounter.x, FIXED.brewCounter.z)),
  [CUSTOMER.queue.x - 1, CUSTOMER.queue.z, CUSTOMER.pickup.x + 1, CUSTOMER.pickup.z + 1],
);
// The café loop on one screen: counters, queue and the terrace seats where served customers sit.
const FIRST_SEATS = CAFE_SEATS.slice(0, 6); // the starter terrace seats (middle of the terrace)
const CAFE_LOOP_RECT = unionRect(COUNTER_RECT, [Math.min(...FIRST_SEATS.map(p => p.x)) - .8, Math.min(...FIRST_SEATS.map(p => p.z)) - .8, Math.max(...FIRST_SEATS.map(p => p.x)) + .8, Math.max(...FIRST_SEATS.map(p => p.z)) + .8]);
// Action pads in the counter lane, in front of each counter (stand on one → its action fires; see autoNear).
const PADS = {
  order: { x: FIXED.orderCounter.x + 1.4, z: 107.5, color: '#ff8a2a' },  // beside the queue head, in front of the counter
  brew: { x: FIXED.brewCounter.x, z: 107.5, color: '#2f9e8f' },
};
const NEAR_PAD = 1.4; // generous: walking across the pad is enough

/**
 * @param {{ renderer: THREE.WebGLRenderer, store: object, gender: 'male'|'female', hooks?: { onSelect?, onResult?, onWalkToGate? } }} opts
 */
export async function createRealm({ renderer, store, gender, hooks = {} }) {
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  scene.name = 'realm';
  const camera = new THREE.PerspectiveCamera(38, 1, .5, 400);
  scene.add(camera); // the cinematic flash plane is parented to the camera
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 60, 160);

  // ---------- lights: soft sky/ground hemisphere + one warm shadow-casting key light that follows the camera target ----------
  // (renderer tone mapping / exposure are owned by the app; the brighter look comes from light intensity only)
  const hemi = new THREE.HemisphereLight(0xdcefff, 0x9c8a55, 1.75);
  const sun = new THREE.DirectionalLight(0xffe3b8, 2.85);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .03;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  scene.add(hemi, sun, sun.target);
  let shadowHalf = 0;
  const SUN_OFFSET = new THREE.Vector3(-14, 28, 12);

  // ---------- assets ----------
  const paths = [...new Set([...Object.values(BUILDINGS).map(b => b.model), ...EXTRA_MODELS, ...Object.values(TREE_PARTS), ...Object.values(GATE_PARTS)])].filter(Boolean); // procedural buildings (terrace) have no model
  const [loaded, avatar] = await Promise.all([
    Promise.all(paths.map(p => loadModel(p).catch(() => null))),
    createAvatar({ scene, gender }),
  ]);
  const templates = Object.fromEntries(paths.map((p, i) => [p, loaded[i]]));
  for (const [k, p] of Object.entries({ ...TREE_PARTS, ...GATE_PARTS })) templates[k] = templates[p];
  const prefabs = Object.fromEntries(Object.keys(BUILDINGS).map(type => [type, makePrefab(type, templates)]));
  setTableInfo(prefabs.tables?.userData.tableInfo); // customers sit on the Tables prefab's real chairs

  // ---------- sub-modules ----------
  const vfx = createVfx({ scene });
  const cam = createCameraController(camera);
  const world = createWorld({ scene, templates });
  const plots = createPlots({ scene, templates, vfx });
  const buildings = createBuildings({ scene, prefabs, templates, vfx });
  // Grid pathfinding, one navigator per area (nav.js): shared by the player's walks, staff and customers.
  // Agent radius .45 m keeps paths clear of the avatar's own collision margin.
  const navs = { farm: createNav(BOUNDS, { radius: .45 }), cafe: createNav(CAFE_BOUNDS, { radius: .45 }) };
  const navigate = (sx, sz, tx, tz, opts) => navs[areaAt(tx, tz)].path(sx, sz, tx, tz, opts);
  let navKey = '';
  avatar.setNavigator(navigate);
  // Staff work for real (staff.js): they read the player's crop / carried cup and dispatch straight to the store.
  const staff = createStaff({
    scene, store, vfx, templates, pads: PADS, navigate,
    getActiveCrop: () => activeCrop,
    getCarrying: () => carry?.orderId ?? null,
    getSeat: id => cafe.walker(id)?.seat || null,
    getQueued: () => cafe.queuedOrder(store.state),
    canStand: (zone, x, z) => canStand(zone, x, z),
    isPaused: () => inputLocked || !!cinematics.active || disposed,
  });
  const placement = createPlacement({ scene, prefabs });
  const markers = createMarkers({ scene });
  const cafe = createCafe({ scene, vfx, dispatch, templates, navigate });
  const badges = createBadges({ scene, camera });
  const pads = createPads({ scene, points: PADS });
  const cinematics = createCinematics({
    cam, camera, vfx, getPlayer: () => avatar.position,
    env: { fog: scene.fog, background: scene.background, hemi, sun, tintMaterials: () => Object.values(world.mats).filter(m => m?.color) },
  });
  cam.setFollow(avatar.position);
  cam.snapTo(avatar.position);

  // View switch fade: a full-screen plane on the camera (same trick as the cinematic flash).
  const fadeMat = new THREE.MeshBasicMaterial({ color: 0xfff4e0, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const fade = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), fadeMat);
  fade.position.z = -.8;
  fade.renderOrder = 1000;
  fade.visible = false;
  fade.raycast = () => {};
  camera.add(fade);

  // ---------- state ----------
  let inputLocked = false;
  let activeCrop = 'robusta';
  let selection = null;
  let outline = null;
  let tutorialTarget = null;
  let regionId = undefined;
  let clock = 0;
  let needArrive = true;
  let gateWalk = false;
  let disposed = false;
  let timerSeconds = -1;
  let view = 'farm';        // area on screen: 'farm' | 'cafe'
  let viewApplied = false;  // visibility is applied on the first frame, so compileAsync sees both areas' materials
  let switching = null;     // { to, t, phase: 'out'|'in', promise, resolve } while the fade runs
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const arrowPos = new THREE.Vector3();
  const drag = { mode: null, visited: new Set(), stopped: false, ghostX: 0, ghostZ: 0, startX: 0, startZ: 0 };
  let canvasRect = canvas.getBoundingClientRect();

  // The game being played decides the area shown on load / region change ('farm' until the player picks one).
  const modeView = state => (state.mode === 'cafe' ? 'cafe' : 'farm');
  // Farm and café are separate games: the café only runs while it is on screen, or while café staff / robots are
  // working there (then it keeps serving without the player). Otherwise it is paused on the farm. The chosen game
  // follows the view so a reload opens where the player was. Checked every frame, dispatches only on change.
  function syncArea(state) {
    if (switching || state.story.phase !== 'play') return;
    const r = regionOf(state);
    if (!r) return;
    const paused = !!r.shop.pausedAt;
    const run = view === 'cafe' || cafeStaffed(state);
    if (run && paused) store.dispatch('shop/resume');
    else if (!run && !paused) store.dispatch('shop/pause');
    if (state.mode && state.mode !== view) store.dispatch('play/setMode', { mode: view });
  }

  function dispatch(type, payload) {
    const result = store.dispatch(type, payload);
    hooks.onResult?.(type, result);
    return result;
  }

  // ---------- store sync ----------
  function syncAll(state, instant = false) {
    const id = state.world.currentRegion || null;
    if (id !== regionId) {
      if (regionId !== undefined) { setCarry(null); plots.clear(); buildings.clear(); cafe.reset(); staff.clear(); placement.cancel(); setSelection(null); needArrive = !!id; cancelSwitch(); swapView(modeView(state)); }
      regionId = id;
      instant = true;
      avatar.teleport(avatar.position.x, avatar.position.z);
    }
    world.sync(state);
    plots.sync(state);
    buildings.sync(state);
    cafe.sync(state, instant);
    staff.sync(state);
    // Building footprints block the player (slightly shrunk so doorways feel forgiving).
    // (walkable buildings — the terrace — never block the player)
    const solidBuildings = (regionOf(state)?.buildings || []).filter(b => BUILDINGS[b.type] && !BUILDINGS[b.type].walkable);
    const blockRects = navObstacles(world.blockers, solidBuildings);
    avatar.setBlockers(blockRects);
    // Navigation grids: rebuilt only when the buildings change (built / moved / region entered).
    const key = `${id}|${solidBuildings.map(b => `${b.uid}:${b.x},${b.z},${b.rot}`).join(';')}`;
    if (key !== navKey) {
      navKey = key;
      for (const area of ['farm', 'cafe']) navs[area].rebuild(blockRects.filter(r => rectArea(r) === area));
    }
    if (selection?.kind === 'building' && !buildings.get(selection.uid)) setSelection(null);
    if (placement.info) placement.refresh();
  }

  const unsubscribe = store.subscribe((state, events, type) => {
    if (type === 'reset' || type === 'reload') { regionId = regionId === undefined ? undefined : '__reset__'; }
    // Before the sync: effects that need the old visuals (tree pop, customer mood).
    for (const ev of events) {
      if (ev.type === 'harvested') {
        plots.onHarvested(ev.plotId, clock);
        const plot = plotById(ev.plotId);
        sfx('farm.harvest');
        if (plot) reward({ x: plot.x, y: 1, z: plot.z }, 'hud-beans', '🫘', ev.beans);
      } else if (ev.type === 'served') {
        if (auto.on) { say('auto.coins', { n: ev.coins }); auto.wait = Math.max(auto.wait, .7); }
        const at = cafe.onServed(ev.orderId);
        sfx('cafe.serve'); sfx('coin.gain');
        reward(at ? { x: at.x, y: 2, z: at.z } : { x: CUSTOMER.pickup.x, y: 2, z: CUSTOMER.pickup.z }, 'hud-coins', '🪙', ev.coins);
      } else if (ev.type === 'customerLeft') {
        if (ev.angry && carry?.orderId === ev.orderId) setCarry(null); // the cup in hand is no longer wanted
        cafe.onLeft(ev.orderId, !!ev.angry);
      }
    }
    syncAll(state);
    badgeClock = 1; // refresh object notices right away
    for (const ev of events) {
      if (ev.type === 'planted') { plots.onPlanted(ev.plotId, clock); sfx('farm.plant'); }
      else if (ev.type === 'built') { buildings.onBuilt(ev.uid, clock); sfx('farm.build'); }
      else if (ev.type === 'moved') { const e = buildings.get(ev.uid); if (e) vfx.burst('dust', e.root.position); sfx('farm.build'); }
      else if (ev.type === 'upgraded') { buildings.onUpgraded(ev.uid); sfx('farm.build'); }
      else if (ev.type === 'orderTaken') { sfx('cafe.order'); const w = cafe.walker(ev.orderId); if (w) vfx.burst('sparkle', v3.set(w.person.position.x, 2.4, w.person.position.z), { count: 8 }); }
      else if (ev.type === 'brewStarted') sfx('cafe.cup');
      else if (ev.type === 'parcelBought') { const c = parcelSignPoint(ev.parcelId); vfx.burst('sparkle', v3.set(c.x, 1, c.z), { count: 20 }); vfx.burst('leaf', v3); }
      else if (ev.type === 'hired' || ev.type === 'assigned') vfx.burst('sparkle', avatar.position, { count: 10 });
      else if (ev.type === 'regionEntered') { cancelSwitch(); swapView(modeView(state)); if (view === 'farm') avatar.teleport(GATE.x, GATE.z - 4); needArrive = true; }
    }
  });

  // Coins / beans fly from the world position to the HUD counter (popNumber when the HUD element is missing).
  function reward(pos, elementId, icon, amount) {
    if (areaAt(pos.x, pos.z) !== view || switching) return; // off-screen area: the HUD counter still updates
    const sp = project(v3.set(pos.x, pos.y, pos.z));
    if (!sp) return;
    const el = document.getElementById(elementId);
    if (el) flyTo(sp, el, { icon, amount, text: `+${amount}` });
    else popNumber(`${icon} +${amount}`, sp, 'good');
  }

  function project(vec) {
    vec.project(camera);
    if (vec.z > 1 || vec.z < -1) return null;
    return { x: canvasRect.left + (vec.x + 1) / 2 * canvasRect.width, y: canvasRect.top + (1 - vec.y) / 2 * canvasRect.height };
  }

  // ---------- targets ----------
  function buildingOf(t) { return t.uid ? buildings.get(t.uid) : buildings.byType(t.type); }
  function resolvePlot(t, now) {
    if (t.id) return plotById(t.id);
    return plots.first(t.want || 'empty', now);
  }
  // Which area a target lives in ('farm' | 'cafe'), null when unknown.
  function areaOf(t) {
    if (!t) return null;
    if (t.kind === 'plot' || t.kind === 'field' || t.kind === 'gate') return 'farm';
    if (t.kind === 'customer') return 'cafe';
    if (t.kind === 'parcel') return PARCELS[t.id] ? areaOfParcel(t.id) : null;
    if (t.kind === 'building') {
      const e = buildingOf(t);
      if (e && Number.isFinite(e.x)) return areaAt(e.x, e.z);
      const zone = BUILDINGS[t.type]?.zone;
      return zone === 'shop' ? 'cafe' : zone === 'farm' ? 'farm' : null;
    }
    return null;
  }
  // Camera focus rect + key (taps inside the same key keep the camera still).
  function focusInfo(t) {
    if (!t) return null;
    if (t.kind === 'plot') { const p = resolvePlot(t, Date.now()); return p ? { rect: PARCELS[p.parcel].rect, key: `parcel:${p.parcel}` } : null; }
    if (t.kind === 'building') {
      const e = buildingOf(t);
      const type = e?.type || t.type;
      if (type === 'orderCounter' || type === 'brewCounter') return { rect: CAFE_LOOP_RECT, key: 'counters' };
      if (!e) return null;
      const r = footprint(e.type, e.x, e.z, e.rot);
      return { rect: [r[0] - 2, r[1] - 2, r[2] + 2, r[3] + 2], key: `b:${e.uid}` };
    }
    if (t.kind === 'parcel' && PARCELS[t.id]) return { rect: PARCELS[t.id].rect, key: `parcel:${t.id}` };
    if (t.kind === 'customer') return { rect: CAFE_LOOP_RECT, key: 'counters' };
    if (t.kind === 'gate') return { rect: [GATE.x - 4, GATE.z - 5, GATE.x + 4, GATE.z + 2], key: 'gate' };
    return null;
  }
  // Highlight rect drawn on the ground for the selection.
  function frameRect(t) {
    if (t.kind === 'plot') { const p = plotById(t.id); return p ? [p.x - PLOT_SIZE / 2, p.z - PLOT_SIZE / 2, p.x + PLOT_SIZE / 2, p.z + PLOT_SIZE / 2] : null; }
    if (t.kind === 'building') { const e = buildingOf(t); return e ? footprint(e.type, e.x, e.z, e.rot) : null; }
    if (t.kind === 'parcel') return PARCELS[t.id]?.rect || null;
    if (t.kind === 'gate') return [GATE.x - GATE.radius, GATE.z - 1, GATE.x + GATE.radius, GATE.z + 1];
    return null;
  }
  // World point above a target (arrow, screenPoint). Writes into `out`; returns false when it has no 3D position.
  function targetPoint(t, out, now) {
    if (!t || switching || areaOf(t) !== view) return false; // targets of the other area are not on screen
    if (t.kind === 'plot') { const p = resolvePlot(t, now); if (!p) return false; out.set(p.x, 1.3, p.z); return true; }
    if (t.kind === 'building') { const e = buildingOf(t); if (!e) return false; out.set(e.x, e.height + (t.upgrade ? BADGE_Y : 1.1), e.z); return true; }
    if (t.kind === 'customer') { const w = cafe.walker(t.orderId); if (!w) return false; out.set(w.person.position.x, 2.9, w.person.position.z); return true; }
    if (t.kind === 'parcel' && PARCELS[t.id]) { const c = parcelSignPoint(t.id); out.set(c.x, 2.7, c.z); return true; }
    if (t.kind === 'gate') { out.set(GATE.x, 6.4, GATE.z); return true; }
    return false;
  }

  function setSelection(t, { notify = true } = {}) {
    outline?.remove(); outline = null;
    selection = t || null;
    timerSeconds = -1;
    markers.setTimer(null);
    if (!t) {
      markers.setFrame(null);
      if (cam.mode !== 'cinematic') cam.explore();
    } else {
      markers.setFrame(frameRect(t));
      if (t.kind === 'building') { const e = buildingOf(t); if (e) outline = vfx.outline(e.model); }
      const f = focusInfo(t);
      if (f) cam.focusRect(f.rect, { key: f.key });
    }
    if (notify) hooks.onSelect?.(selection);
  }

  // ---------- taps & drags ----------
  function rayFrom(p) {
    canvasRect = canvas.getBoundingClientRect();
    ndc.set((p.x - canvasRect.left) / canvasRect.width * 2 - 1, -((p.y - canvasRect.top) / canvasRect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  function pick(includeBuildings = true) {
    const farm = view === 'farm';
    // Object notices are on top of everything: a tap on a badge is a tap on its object.
    if (includeBuildings && badges.visible) {
      for (const set of [badges.smallPickers(), badges.pickers()]) { // small ▲ first: it overlaps its interaction badge
        const hits = raycaster.intersectObjects([...set], false);
        if (hits.length && hits[0].object.userData.target) return hits[0].object.userData.target;
      }
    }
    // Staff on a break (both areas): tap their coin bubble or body to pay and get them working again.
    if (includeBuildings) {
      const hits = raycaster.intersectObjects([...staff.pickers()], false);
      if (hits.length) return hits[0].object.userData.target;
    }
    // Seated customers (café): tap to deliver their cup.
    if (includeBuildings && !farm) {
      const hits = raycaster.intersectObjects([...cafe.pickers()], false);
      if (hits.length) return hits[0].object.userData.target;
    }
    const list = farm ? [...plots.pickers()] : []; // plots + gate: farm only; buildings: current area only
    if (includeBuildings) { list.push(...buildings.pickers()); if (farm) list.push(world.gatePicker); }
    const hits = raycaster.intersectObjects(list, false);
    return hits.length ? hits[0].object.userData.target : null;
  }
  const locked = () => inputLocked || disposed || !!cinematics.active || !!switching;

  function tapPlot(id) {
    const now = Date.now();
    const stage = plots.stage(id, now);
    setSelection({ kind: 'plot', id });
    if (stage === 'empty') dispatch('farm/plant', { plotId: id, crop: activeCrop });
    else if (stage === 'ready') dispatch('farm/harvest', { plotId: id });
  }
  // Body taps. The two counters only ACT (no card): order counter → take the order; brewing counter → pick up a ready
  // cup and carry it to its customer, else brew the next taken order, else resume a delivery, else a hint toast.
  // Upgrades are reached only through the ▲ badge (target.upgrade). Other buildings open their info card.
  function tapBuilding(t) {
    if (t.upgrade || (t.type !== 'orderCounter' && t.type !== 'brewCounter')) { setSelection(t); return; }
    const orders = regionOf(store.state)?.shop.orders || [];
    if (selection) setSelection(null);
    cam.focusRect(CAFE_LOOP_RECT, { key: 'counters' });
    // Act right away AND walk the player to the counter's pad (the pad then keeps working by proximity). The shared
    // cooldown stops the pad from firing the same action again on arrival.
    const padId = t.type === 'orderCounter' ? 'order' : 'brew';
    const acted = r => { if (r?.ok) { nearCooldown = 1; pads.pop(padId, clock); } };
    const goPad = () => { if (carry) carry.walking = false; gateWalk = false; avatar.walkTo(PADS[padId].x, PADS[padId].z); };
    if (t.type === 'orderCounter') {
      // Only a customer standing at the counter can order (the ones still walking in come next).
      const queued = cafe.queuedOrder(store.state);
      if (queued != null || !orders.some(o => o.stage === 'waiting')) acted(dispatch('shop/takeOrder', queued != null ? { orderId: queued } : {})); // none → "No customer yet" / no seat → toast
      goPad(); return;
    }
    const now = Date.now();
    const ready = !carry && mostUrgent(orders, o => o.stage === 'brewing' && now - o.brewStart >= o.brewMs && !staff.isClaimed(o.id), now);
    if (ready) { nearCooldown = 1; pads.pop('brew', clock); pickUp(ready.id); return; } // pickUp walks to the customer
    const next = mostUrgent(orders, o => o.stage === 'taken', now);
    if (next) { acted(dispatch('shop/brew', { orderId: next.id })); goPad(); return; } // out of beans / busy → toast
    if (carry) { deliver(); return; }
    goPad();
    if (orders.some(o => o.stage === 'brewing')) return; // still brewing: the bubbles show the progress
    dispatch('shop/brew', {}); // → "Take an order first"
  }

  // ---------- carrying a cup to a seated customer ----------
  // carry = { orderId, walking } (walking: auto-walking a grid path to the customer). The order stays 'brewing' (ready) in the save until shop/serve, so a
  // reload or an interrupted walk never loses it: the cup simply goes back on the counter / stays in hand.
  let carry = null;
  const handCup = (() => {
    const t = templates['cafe/props.glb#cup'];
    const g = new THREE.Group();
    const cup = t ? t.clone() : new THREE.Mesh(new THREE.CylinderGeometry(.08, .065, .16, 10).translate(0, .08, 0), new THREE.MeshStandardMaterial({ color: 0xf4f1e6 }));
    if (t) cup.scale.setScalar(1.8);
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .03, 14), new THREE.MeshStandardMaterial({ color: 0x8a5a35, roughness: .8 }));
    g.add(tray, cup);
    cup.position.y = .015;
    g.position.set(.12, 1.02, .38);
    g.visible = false;
    g.traverse(o => { o.raycast = () => {}; });
    avatar.root.add(g);
    return g;
  })();
  function setCarry(next) { carry = next; handCup.visible = !!carry; }
  function pickUp(orderId) {
    setCarry({ orderId, walking: false });
    sfx('cafe.cup');
    deliver();
  }
  // Route: counter lane → queue lane (always free of buildings) → sidewalk → the free side of the seat.
  // Walks (grid path, nav.js) to the stand spot beside the customer's seat; updateCarry serves on arrival.
  function deliver() {
    const w = carry && cafe.walker(carry.orderId);
    if (!w?.seat) { if (carry) carry.walking = false; return; }
    const stand = standSpot(w.seat);
    carry.walking = true;
    gateWalk = false;
    avatar.walkTo(stand.x, stand.z);
  }
  function updateCarry(orders) {
    if (!carry) return;
    if (!orders.some(o => o.id === carry.orderId && o.stage === 'brewing')) { setCarry(null); return; } // served / gone
    if (!carry.walking || avatar.moving) return;
    carry.walking = false;
    const w = cafe.walker(carry.orderId);
    if (w && Math.hypot(w.person.position.x - avatar.position.x, w.person.position.z - avatar.position.z) < 2.6) {
      dispatch('shop/serve', { orderId: carry.orderId });
    }
  }
  // ---------- proximity auto-actions (walk close = confirm) ----------
  // Walking near a counter/customer does the job without a tap: order counter → take the order, brewing counter →
  // pick up a ready cup (then it is carried to its customer) or start brewing a taken order, customer → serve the cup
  // you carry. Only dispatched when it will succeed, so walking around never spams error toasts.
  const NEAR_CUSTOMER = 1.8;
  let nearTimer = 0, nearCooldown = 0;
  const distTo = (x, z) => Math.hypot(avatar.position.x - x, avatar.position.z - z);
  function autoNear(dt, state, orders, now) {
    nearCooldown = Math.max(0, nearCooldown - dt);
    nearTimer += dt;
    if (nearTimer < .2 || nearCooldown > 0) return;
    nearTimer = 0;
    if (auto.on || view !== 'cafe' || state.story.phase !== 'play' || inputLocked || switching || placement.info || cinematics.active) return;
    const done = () => { nearCooldown = .6; };
    // Carrying: serve as soon as the player reaches that customer.
    if (carry) {
      const w = cafe.walker(carry.orderId);
      if (w?.seat && distTo(w.person.position.x, w.person.position.z) < NEAR_CUSTOMER) {
        dispatch('shop/serve', { orderId: carry.orderId }); done(); return;
      }
    }
    // Standing on (or walking across) a pad fires its counter's action — only when it will succeed.
    const queued = cafe.queuedOrder(state);
    if (distTo(PADS.order.x, PADS.order.z) < NEAR_PAD && queued != null && seatsUsed(state) < seatCount(state)) {
      dispatch('shop/takeOrder', { orderId: queued }); pads.pop('order', clock); done(); return;
    }
    if (distTo(PADS.brew.x, PADS.brew.z) < NEAR_PAD) {
      const ready = !carry && mostUrgent(orders, o => o.stage === 'brewing' && now - o.brewStart >= o.brewMs && !staff.isClaimed(o.id), now);
      if (ready) { pads.pop('brew', clock); pickUp(ready.id); done(); return; }
      const taken = mostUrgent(orders, o => o.stage === 'taken', now);
      const brewing = orders.filter(o => o.stage === 'brewing').length;
      if (taken && brewing < brewSlots(state) && state.inventory.beans >= (DRINKS[taken.drink]?.beans || 1)) {
        dispatch('shop/brew', { orderId: taken.id }); pads.pop('brew', clock); done();
      }
    }
  }

  function tapCustomer(t) {
    if (selection) setSelection(null);
    if (carry) { deliver(); return; }
    // Forgiving: tapping a customer whose cup is ready picks it up and brings it over.
    const now = Date.now();
    const o = regionOf(store.state)?.shop.orders.find(x => x.id === t.orderId);
    if (o?.stage === 'brewing' && now - o.brewStart >= o.brewMs) pickUp(o.id);
  }

  // Where an idle staff member may stroll: walkable, inside its zone, off the fields / queue / seats / player pads.
  function canStand(zone, x, z) {
    const area = zone === 'farm' ? 'farm' : 'cafe';
    const b = AREAS[area].bounds;
    if (x < b.minX + 1 || x > b.maxX - 1 || z < b.minZ + 1 || z > b.maxZ - 1 || navs[area].blockedAt(x, z)) return false;
    if (area === 'farm') {
      for (const p of Object.values(PARCELS)) if (p.kind === 'farm' && x > p.rect[0] - .5 && x < p.rect[2] + .5 && z > p.rect[1] - .5 && z < p.rect[3] + .5) return false;
      return Math.hypot(x - GATE.x, z - GATE.z) > GATE.radius + 2;
    }
    const r = regionOf(store.state);
    const terrace = r?.buildings.find(bd => bd.type === 'terrace');
    const tr = terrace ? footprint('terrace', terrace.x, terrace.z, terrace.rot) : null;
    const onFloor = (r?.parcels || []).some(id => PARCELS[id]?.kind === 'shop' && x > PARCELS[id].rect[0] + .4 && x < PARCELS[id].rect[2] - .4 && z > PARCELS[id].rect[1] + .4 && z < PARCELS[id].rect[3] - .4);
    const onTerraceEdge = tr && x > tr[0] - .6 && x < tr[2] + .6 && (Math.abs(z - tr[1]) < .6 || Math.abs(z - tr[3]) < .6);
    if (!onFloor && !onTerraceEdge) return false;
    for (const p of Object.values(PADS)) if (Math.hypot(x - p.x, z - p.z) < 2) return false;
    for (const lane of RESERVED) if (lane.id === 'queueLane' && x > lane.rect[0] - .3 && x < lane.rect[2] + .3 && z > lane.rect[1] - .3 && z < lane.rect[3] + .3) return false;
    for (const seat of cafe.seats) { const st = standSpot(seat); if (Math.hypot(x - st.x, z - st.z) < .9 || Math.hypot(x - seat.x, z - seat.z) < .9) return false; }
    return true;
  }

  // ---------- auto play (state.autoplay.active): the game plays itself, right where you are ----------
  // Works in the CURRENT view from the first frame: café → take order / brew / carry & serve (else stand ready at the
  // order pad); farm → harvest / plant. The player may switch view; the autopilot follows. It switches view itself
  // only after > 3 s with nothing to do here (announced in the caption). Same functions / pathfinding as the player,
  // ~0.35 s beat between actions. Captions say what it is doing now: { key, params } (HUD translates).
  // Never buys anything: only seeds (affordable), harvests, café orders / brewing / serving.
  const BEAT = .35, IDLE_SWITCH = 3, IDLE_CAPTION = 2;
  const auto = { on: false, phase: 'pause', wait: 0, timer: 0, step: null, caption: null, target: null, idleT: 0 };
  const autoNearest = list => { let best = null, bd = Infinity; for (const p of list) { const d = Math.hypot(p.x - avatar.position.x, p.z - avatar.position.z); if (d < bd) { bd = d; best = p; } } return best; };
  function autoCrop(state) {
    if (cropUnlocked(state, activeCrop) && seedCost(state, activeCrop) <= state.player.coins) return activeCrop;
    for (let i = CROP_ORDER.length - 1; i >= 0; i--) if (cropUnlocked(state, CROP_ORDER[i]) && seedCost(state, CROP_ORDER[i]) <= state.player.coins) return CROP_ORDER[i];
    return null;
  }
  const say = (key, params = null, target = null) => { auto.caption = key ? { key, params } : null; auto.target = target; };
  function autoGo(x, z, key, params, target, act) {
    say(key, params, target); auto.step = act; auto.timer = 0; auto.phase = 'walk'; auto.idleT = 0;
    avatar.walkTo(x, z);
  }
  // Nothing to do right now: keep checking every beat; caption only after a short while; switch area after a longer one.
  function autoIdle(dt, waitKey, switchTo, switchKey) {
    auto.idleT += dt;
    auto.phase = 'pause'; auto.wait = BEAT;
    if (switchTo && auto.idleT > IDLE_SWITCH) { say(switchKey); auto.idleT = 0; auto.wait = 1; setView(switchTo); return; }
    say(auto.idleT > IDLE_CAPTION ? waitKey : null);
  }
  function autoDecide(state, now, dt) {
    const r = regionOf(state);
    if (!r) return;
    const orders = r.shop.orders, beans = state.inventory.beans;
    if (view === 'farm') {
      const mine = ownedPlots(state);
      const room = beans < capacity(state);
      const ready = room && autoNearest(mine.filter(p => plots.stage(p.id, now) === 'ready'));
      if (ready) return autoGo(ready.x, ready.z + 1.25, 'auto.harvest', { id: ready.id }, { kind: 'plot', id: ready.id }, () => {
        const s = store.state;
        if (plots.stage(ready.id, Date.now()) === 'ready' && s.inventory.beans < capacity(s)) dispatch('farm/harvest', { plotId: ready.id });
      });
      const crop = autoCrop(state);
      const empty = crop && autoNearest(mine.filter(p => plots.stage(p.id, now) === 'empty'));
      if (empty) return autoGo(empty.x, empty.z + 1.25, 'auto.plant', { crop }, { kind: 'plot', id: empty.id }, () => {
        const c = autoCrop(store.state);
        if (c && plots.stage(empty.id, Date.now()) === 'empty') dispatch('farm/plant', { plotId: empty.id, crop: c });
      });
      // Farm game: the storehouse is full → sell the beans there (never leaves for the café on its own).
      if (!room && beans > 0) return autoGo(FIXED.silo.x, FIXED.silo.z + 2.4, 'auto.sell', { n: Math.floor(beans) }, { kind: 'building', type: 'silo' }, () => {
        if (store.state.inventory.beans > 0) dispatch('farm/sellBeans');
      });
      return autoIdle(dt, 'auto.waitGrow', null, 'auto.goCafe');
    }
    // café
    if (carry) { say('auto.serve', null, { kind: 'customer', orderId: carry.orderId }); deliver(); auto.step = null; auto.timer = 0; auto.phase = 'walk'; auto.idleT = 0; return; }
    const ready = mostUrgent(orders, o => o.stage === 'brewing' && now - o.brewStart >= o.brewMs && !staff.isClaimed(o.id), now);
    if (ready) return autoGo(PADS.brew.x, PADS.brew.z, 'auto.pickup', { drink: ready.drink }, { kind: 'building', type: 'brewCounter' }, () => {
      const o = regionOf(store.state)?.shop.orders.find(x => x.id === ready.id);
      if (!carry && o?.stage === 'brewing' && Date.now() - o.brewStart >= o.brewMs && !staff.isClaimed(o.id)) { pads.pop('brew', clock); pickUp(o.id); auto.phase = 'pause'; auto.wait = 0; }
    });
    const brewing = orders.filter(o => o.stage === 'brewing').length;
    const taken = mostUrgent(orders, o => o.stage === 'taken', now);
    if (taken && brewing < brewSlots(state) && beans >= (DRINKS[taken.drink]?.beans || 1)) return autoGo(PADS.brew.x, PADS.brew.z, 'auto.brew', { drink: taken.drink }, { kind: 'building', type: 'brewCounter' }, () => {
      const s = store.state, o = regionOf(s)?.shop.orders.find(x => x.id === taken.id);
      if (o?.stage === 'taken' && s.inventory.beans >= (DRINKS[o.drink]?.beans || 1)) { pads.pop('brew', clock); dispatch('shop/brew', { orderId: o.id }); }
    });
    if (cafe.queuedOrder(state) != null && seatsUsed(state) < seatCount(state)) return autoGo(PADS.order.x, PADS.order.z, 'auto.takeOrder', null, { kind: 'building', type: 'orderCounter' }, () => {
      const s = store.state, q = cafe.queuedOrder(s);
      if (q != null && seatsUsed(s) < seatCount(s)) { pads.pop('order', clock); dispatch('shop/takeOrder', { orderId: q }); }
    });
    // Nothing to do: stand ready at the order pad (customers walking in / cups brewing).
    if (distTo(PADS.order.x, PADS.order.z) > .6 && !avatar.moving) avatar.walkTo(PADS.order.x, PADS.order.z);
    if (brewing) { const o = orders.find(x => x.stage === 'brewing'); say('auto.brewing', { drink: o.drink }, { kind: 'building', type: 'brewCounter' }); auto.phase = 'pause'; auto.wait = BEAT; auto.idleT = 0; return; }
    // Café game: stays in the café (out of beans → the caption says so; buying is the player's call).
    const stuckBeans = taken && beans < (DRINKS[taken.drink]?.beans || 1);
    return autoIdle(dt, stuckBeans ? 'auto.needBeans' : 'auto.waitCustomer', null, 'auto.goFarm');
  }
  function updateAuto(dt, state, now) {
    const a = state.autoplay?.active;
    const on = !!a && now < a.endsAt && state.story.phase === 'play' && !!state.world.currentRegion;
    if (on !== auto.on) {
      auto.on = on;
      avatar.stop();
      if (carry) carry.walking = false;
      Object.assign(auto, { phase: 'pause', wait: 0, step: null, caption: null, target: null, idleT: 0 }); // act on the very next frame
      if (on) { placement.cancel(); setSelection(null); input.cancel(); endDrag(); keys.clear(); avatar.setKeyDir(0, 0); cam.explore(); }
    }
    if (!on || cinematics.active || inputLocked) return;
    if (switching) { avatar.stop(); auto.phase = 'pause'; auto.wait = .1; auto.step = null; return; } // view changed: re-decide there
    if (auto.phase === 'walk') {
      auto.timer += dt;
      if ((avatar.moving || carry?.walking) && auto.timer < 12) return;
      auto.step?.(); auto.step = null;
      auto.phase = 'pause'; auto.wait = BEAT;
      return;
    }
    if ((auto.wait -= dt) > 0) return;
    autoDecide(state, now, BEAT);
  }

  function onTap(p) {
    if (locked() || auto.on) return; // auto play: the player watches (camera pan / zoom only)
    rayFrom(p);
    if (placement.info) {
      if (groundPoint(raycaster, hit)) { placement.moveTo(hit.x, hit.z); focusPlacement(); }
      return;
    }
    const target = pick();
    if (target?.kind === 'plot') return tapPlot(target.id);
    if (target?.kind === 'building') return tapBuilding(target);
    if (target?.kind === 'customer') return tapCustomer(target);
    if (target?.kind === 'staff') { dispatch('staff/resume', { uid: target.uid }); return; } // not enough coins → toast
    if (target?.kind === 'field') return harvestField(target.id);
    if (target?.kind === 'parcel') return setSelection(target);
    if (target?.kind === 'gate') {
      setSelection({ kind: 'gate' });
      gateWalk = true;
      avatar.walkTo(GATE.x, GATE.z - GATE.radius, () => { if (gateWalk) { gateWalk = false; hooks.onWalkToGate?.(); } });
      return;
    }
    if (!groundPoint(raycaster, hit)) return;
    const parcel = parcelAt(hit.x, hit.z);
    if (parcel && areaOfParcel(parcel.id) === view && world.parcelState(parcel.id) !== 'owned') return setSelection({ kind: 'parcel', id: parcel.id });
    setSelection(null);
    gateWalk = false;
    if (carry) carry.walking = false; // the cup stays in hand; tap the customer / counter to resume
    avatar.walkTo(hit.x, hit.z);
    vfx.burst('dust', hit, { count: 4 });
  }

  // Sickle badge over a field: harvest every ripe plot in it (stops at the first refusal, e.g. storehouse full).
  function harvestField(parcelId) {
    const now = Date.now();
    const ready = plotsOf(parcelId).filter(p => plots.stage(p.id, now) === 'ready');
    if (!ready.length) return;
    setSelection({ kind: 'plot', id: ready[0].id });
    for (const p of ready) if (!dispatch('farm/harvest', { plotId: p.id }).ok) break;
  }

  // ---------- object notices (badges) ----------
  let badgeClock = 1;
  const badgeItems = [];
  function refreshBadges(state, now) {
    badgeItems.length = 0;
    const r = regionOf(state);
    const show = r && state.story.phase === 'play' && !placement.info && !cinematics.active && !switching && !inputLocked;
    badges.setVisible(!!show);
    if (!show) { badges.clear(); return; }
    const orders = r.shop.orders;
    let waiting = 0, taken = null, brewing = 0, ready = 0;
    for (const o of orders) {
      if (o.stage === 'waiting') waiting++;
      else if (o.stage === 'taken') taken ||= o;
      else if (o.stage === 'brewing') { if (now - o.brewStart >= o.brewMs) ready++; else brewing++; }
    }
    for (const b of r.buildings) {
      const def = BUILDINGS[b.type];
      if (!def || areaAt(b.x, b.z) !== view) continue;
      const e = buildings.get(b.uid);
      if (!e || !e.root.visible) continue;
      // ▲ whenever an upgrade exists within the Round cap: 'ok' (affordable, green) or 'muted' (needs coins, grey).
      const err = def.decor ? 'maxLevel' : upgradeError(state, b);
      const up = err === null ? 'ok' : err === 'coins' ? 'muted' : null;
      let kind = null;
      if (b.type === 'orderCounter' && waiting && cafe.queuedOrder(state) != null) kind = seatsUsed(state) < seatCount(state) ? 'order' : 'noSeat';
      else if (b.type === 'brewCounter') {
        if (ready && !carry) kind = 'serve'; // while carrying, the counter's next job is brewing
        if (!kind && taken && brewing + ready < brewSlots(state) && state.inventory.beans >= (DRINKS[taken.drink]?.beans || 1)) kind = 'brew';
      }
      if (!kind && !up) continue;
      const target = { kind: 'building', uid: b.uid, type: b.type }, upTarget = { ...target, upgrade: true };
      badgeItems.push({ key: b.uid, kind: kind || (up === 'ok' ? 'up' : 'upMuted'), up: kind ? up : null, upTarget, x: b.x, y: e.height + BADGE_Y, z: b.z, target: kind ? target : upTarget });
    }
    // Carrying a cup: ☕ over the customer it belongs to (tap = deliver).
    if (carry && view === 'cafe') {
      const w = cafe.walker(carry.orderId);
      if (w) badgeItems.push({ key: `c${carry.orderId}`, kind: 'serve', x: w.person.position.x, y: 2.9, z: w.person.position.z, target: { kind: 'customer', orderId: carry.orderId } });
    }
    for (const p of Object.values(PARCELS)) {
      if (areaOfParcel(p.id) !== view) continue;
      if (r.parcels.includes(p.id)) {
        if (p.kind !== 'farm') continue;
        if (plotsOf(p.id).some(pl => plots.stage(pl.id, now) === 'ready')) {
          const c = rectCenter(p.rect);
          badgeItems.push({ key: p.id, kind: 'harvest', x: c.x, y: 1.7, z: c.z, target: { kind: 'field', id: p.id } });
        }
      } else if (!parcelError(state, p.id)) {
        const c = parcelSignPoint(p.id);
        badgeItems.push({ key: p.id, kind: 'buy', x: c.x, y: 2.75, z: c.z, target: { kind: 'parcel', id: p.id } });
      }
    }
    badges.set(badgeItems);
  }

  function dragPlot(id) {
    if (drag.stopped || drag.visited.has(id)) return;
    drag.visited.add(id);
    const stage = plots.stage(id, Date.now());
    let result = null;
    if (drag.mode === 'plant' && stage === 'empty') result = dispatch('farm/plant', { plotId: id, crop: activeCrop });
    else if (drag.mode === 'harvest' && stage === 'ready') result = dispatch('farm/harvest', { plotId: id });
    if (result && !result.ok) drag.stopped = true; // one toast per drag (coins, storageFull…)
  }

  const input = createInput(canvas, {
    tap: onTap,
    dragStart(start, p) {
      if (locked()) return;
      if (auto.on) { drag.mode = 'pan'; return; }
      rayFrom(start);
      if (placement.info) {
        drag.mode = 'place';
        drag.ghostX = placement.info.x; drag.ghostZ = placement.info.z;
        if (groundPoint(raycaster, hit)) { drag.startX = hit.x; drag.startZ = hit.z; }
        return;
      }
      const target = pick(false);
      if (target?.kind === 'plot') {
        drag.mode = plots.stage(target.id, Date.now()) === 'empty' ? 'plant' : 'harvest';
        drag.visited.clear(); drag.stopped = false;
        setSelection({ kind: 'plot', id: target.id });
        dragPlot(target.id);
      } else drag.mode = 'pan';
    },
    dragMove(p, dx, dy) {
      if (locked()) return;
      if (drag.mode === 'pan') { cam.pan(dx, dy); return; }
      rayFrom(p);
      if (drag.mode === 'place') {
        if (groundPoint(raycaster, hit)) placement.moveTo(drag.ghostX + hit.x - drag.startX, drag.ghostZ + hit.z - drag.startZ);
        return;
      }
      if (drag.mode === 'plant' || drag.mode === 'harvest') {
        if (groundPoint(raycaster, hit)) markers.setCursor(drag.mode, hit);
        const target = pick(false);
        if (target?.kind === 'plot') dragPlot(target.id);
      }
    },
    dragEnd() { if (drag.mode === 'place') focusPlacement(); endDrag(); },
    cancel: endDrag,
    zoom(f) { if (!locked()) cam.zoomBy(f); },
  }, locked);
  function endDrag() { drag.mode = null; drag.visited.clear(); markers.setCursor(null); }

  function focusPlacement() {
    const info = placement.info;
    const parcel = info && parcelAt(info.x, info.z);
    if (parcel && areaOfParcel(parcel.id) === 'cafe') cam.focusRect(parcel.rect, { key: `parcel:${parcel.id}` });
    else if (info) { const r = footprint(info.type, info.x, info.z, info.rot); cam.focusRect([r[0] - 4, r[1] - 4, r[2] + 4, r[3] + 4], { key: `place:${Math.round(info.x / 6)},${Math.round(info.z / 6)}` }); }
  }

  // ---------- views (farm / café) ----------
  function applyView() {
    viewApplied = true;
    world.setView(view);
    buildings.setView(view);
    staff.setView(view);
    plots.group.visible = view === 'farm';
    cafe.group.visible = view === 'cafe';
    pads.setVisible(view === 'cafe');
  }
  // Immediate switch: clears selection / placement / drags, moves the player to the area's spawn, snaps the camera.
  function swapView(v) {
    const changed = v !== view;
    view = v;
    const area = AREAS[v];
    if (changed) {
      if (placement.info?.uid) buildings.setHidden(placement.info.uid, false);
      placement.cancel();
      if (selection) setSelection(null);
      gateWalk = false;
      if (carry) carry.walking = false; // the cup stays in hand across the switch
      input.cancel(); endDrag();
      avatar.teleport(area.spawn.x, area.spawn.z, Math.PI);
    }
    avatar.setBounds(area.bounds);
    cam.setBounds(area.bounds);
    if (changed) { cam.explore(); cam.snapTo(avatar.position); }
    // Opening the café frames both counters (Area Focus) so the player sees where to work right away.
    if (changed && v === 'cafe') cam.focusRect(CAFE_LOOP_RECT, { key: 'counters', force: true });
    if (viewApplied) applyView();
  }
  function setView(v, { instant = false } = {}) {
    if (!AREAS[v] || disposed) return Promise.resolve(view);
    if (switching) return switching.to === v ? switching.promise : switching.promise.then(() => setView(v, { instant }));
    if (v === view) return Promise.resolve(view);
    if (instant) { swapView(v); return Promise.resolve(view); }
    // Selection / placement end right away (the HUD hides the action bar), the swap happens under the fade.
    if (placement.info?.uid) buildings.setHidden(placement.info.uid, false);
    placement.cancel();
    if (selection) setSelection(null);
    gateWalk = false;
    realm.clearInput();
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    switching = { to: v, t: 0, phase: 'out', promise, resolve };
    fade.visible = true;
    return promise;
  }
  function cancelSwitch() {
    if (!switching) return;
    const sw = switching;
    switching = null;
    fade.visible = false;
    sw.resolve(view);
  }
  function updateSwitch(dt) {
    const sw = switching;
    if (!sw) return;
    sw.t += dt;
    if (sw.phase === 'out') {
      fadeMat.opacity = Math.min(1, sw.t / FADE_OUT);
      if (sw.t >= FADE_OUT) { swapView(sw.to); sw.phase = 'in'; sw.t = 0; }
      return;
    }
    fadeMat.opacity = Math.max(0, 1 - sw.t / FADE_IN);
    if (sw.t >= FADE_IN) { fade.visible = false; switching = null; sw.resolve(view); }
  }

  // ---------- keyboard ----------
  function updateKeyDir() {
    let f = 0, r = 0;
    for (const k of keys) { const d = KEYS[k]; if (d === 'f') f++; else if (d === 'b') f--; else if (d === 'r') r++; else if (d === 'l') r--; }
    const yaw = cam.cur.yaw, s = Math.sin(yaw), c = Math.cos(yaw);
    // forward = away from the camera; right = screen right on the ground.
    avatar.setKeyDir(-s * f + c * r, -c * f - s * r);
    if (f || r) { gateWalk = false; if (carry) carry.walking = false; if (selection) setSelection(null); else if (cam.mode === 'free') cam.explore(); }
  }

  // ---------- frame ----------
  function update(dt, time) {
    if (disposed) return;
    dt = Math.min(dt || 0, .1);
    clock = time ?? clock + dt;
    if (!viewApplied) applyView();
    updateSwitch(dt);
    const state = store.state;
    const now = Date.now();
    // Arrival swoop once per region (load / region change). Never interrupts another cinematic (e.g. the expiry one
    // started right after a reload in the 'expiry' phase) and only plays during normal play.
    if (needArrive && state.world.currentRegion && !cinematics.active) {
      needArrive = false;
      if (state.story.phase === 'play') cinematics.play('arrive');
    }
    syncArea(state);
    avatar.update(dt, clock);
    const orders = regionOf(state)?.shop.orders || [];
    plots.update(dt, clock, now);
    updateCarry(orders);
    updateAuto(dt, state, now);
    autoNear(dt, state, orders, now);
    buildings.update(dt, clock, orders, now, id => id === carry?.orderId || staff.isClaimed(id));
    cafe.update(dt, clock, state, now, state.story.phase === 'play');
    staff.update(dt, clock, state, now);
    world.update(clock);
    placement.update(clock);
    // Tutorial arrow + selected plot timer.
    // (no 3D arrow over a ▲ badge target: the tap hand points at the badge itself)
    if (tutorialTarget && !tutorialTarget.upgrade && targetPoint(tutorialTarget, arrowPos, now)) markers.setArrow(arrowPos); else markers.setArrow(null);
    if (selection?.kind === 'plot') {
      const st = plots.stage(selection.id, now);
      const secs = st === 'planted' || st === 'growing' ? Math.ceil(plots.remainingMs(selection.id, now) / 1000) : -1;
      if (secs !== timerSeconds) {
        timerSeconds = secs;
        const p = plotById(selection.id);
        markers.setTimer(secs >= 0 && p ? fmtTimer(secs * 1000) : null, p);
      }
    }
    markers.update(clock);
    badgeClock += dt;
    if (badgeClock >= .25) { badgeClock = 0; refreshBadges(state, now); }
    badges.update(clock);
    if (view === 'cafe') {
      let waiting = false, ready = false, brewable = false, brewing = 0;
      for (const o of orders) {
        if (o.stage === 'waiting') waiting = true;
        else if (o.stage === 'taken' && state.inventory.beans >= (DRINKS[o.drink]?.beans || 1)) brewable = true;
        else if (o.stage === 'brewing') { brewing++; if (now - o.brewStart >= o.brewMs) ready = true; }
      }
      pads.update(clock, { order: waiting && seatsUsed(state) < seatCount(state) && cafe.queuedOrder(state) != null, brew: (ready && !carry) || (brewable && brewing < brewSlots(state)) });
    }
    cinematics.update(dt);
    cam.update(dt);
    // Sun + shadow frustum follow the camera target; fog scales with the camera distance.
    const target = cam.cur.target;
    sun.position.copy(target).add(SUN_OFFSET);
    sun.target.position.copy(target);
    const half = clamp(Math.round(cam.cur.dist * .6), 16, 40);
    if (half !== shadowHalf) {
      shadowHalf = half;
      const sc = sun.shadow.camera;
      sc.left = sc.bottom = -half; sc.right = sc.top = half;
      sc.updateProjectionMatrix();
    }
    scene.fog.near = cam.cur.dist * 1.7;
    scene.fog.far = cam.cur.dist * 3.6 + 45;
    vfx.update(dt);
  }

  const realm = {
    scene, camera,
    update,
    resize(w, h) { cam.resize(w, h); canvasRect = canvas.getBoundingClientRect(); badges.resize(canvasRect.height || h); },
    handleKeyDown(e) {
      if (locked() || auto.on || e.repeat || !KEYS[e.code] || e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
      keys.add(e.code); updateKeyDir();
    },
    handleKeyUp(e) { if (keys.delete(e.code)) updateKeyDir(); },
    clearInput() { keys.clear(); avatar.setKeyDir(0, 0); input.cancel(); endDrag(); },
    setInputLocked(v) { inputLocked = !!v; if (inputLocked) { gateWalk = false; realm.clearInput(); } }, // a pending gate walk must not reopen the atlas later
    get inputLocked() { return inputLocked; },

    /** Current area on screen: 'farm' | 'cafe'. */
    get view() { return switching ? switching.to : view; },
    get switching() { return !!switching; },
    /** Switches the shown area ('farm' | 'cafe'): fade, player + camera to AREAS[view].spawn. Resolves with the view. */
    setView,
    /** Area of a target descriptor ('farm' | 'cafe' | null). */
    areaOf,
    /** Selects a target; a target in the other area switches the view first (returns a Promise then). */
    select(t) {
      const area = areaOf(t);
      if (t && area && (area !== view || switching)) return setView(area).then(() => setSelection(t));
      setSelection(t || null);
      return undefined;
    },
    get selection() { return selection; },
    /** Focuses a target; a target in the other area switches the view first. Returns a Promise. */
    focus(t, { zoom = 1 } = {}) {
      const area = areaOf(t);
      if (area && (area !== view || switching)) return setView(area).then(() => realm.focus(t, { zoom }));
      const f = focusInfo(t);
      if (f) cam.focusRect(f.rect, { key: f.key, zoom, force: true });
      return Promise.resolve();
    },
    resetCamera() { cam.zoomBy(1 / cam.zoom); cam.explore(); },
    cinematic(name) { return cinematics.play(name); },

    setActiveCrop(cropId) { if (CROPS[cropId]) activeCrop = cropId; },
    get activeCrop() { return activeCrop; },

    /**
     * Starts the placement preview. Shop-zone buildings run in the café view, farm-zone ones in the farm view (the view
     * switches first and a Promise of the info is returned then); 'any' decor stays in the current view.
     */
    startPlacement(type, { uid = null } = {}) {
      const zone = BUILDINGS[type]?.zone;
      // Farm buildings (dryer) go on the farm's free grass, café buildings in the café; decorations stay in the view.
      const area = uid ? areaOf({ kind: 'building', uid, type }) || view : zone === 'farm' ? 'farm' : zone === 'shop' ? 'cafe' : realm.view;
      if (area !== view || switching) return setView(area).then(() => realm.startPlacement(type, { uid }));
      if (placement.info?.uid) buildings.setHidden(placement.info.uid, false);
      // Start near the player (the camera follows them): the placement searches the nearest valid spot from there.
      const info = placement.start(type, { uid, area: view, near: { x: avatar.position.x, z: avatar.position.z } }, () => store.state);
      if (!info) return null;
      if (uid) buildings.setHidden(uid, true);
      setSelection(null, { notify: false });
      focusPlacement();
      return info;
    },
    rotatePlacement() { placement.rotate(); },
    confirmPlacement() {
      const uid = placement.info?.uid;
      const result = placement.confirm(dispatch);
      if (result.ok && uid) buildings.setHidden(uid, false);
      return result;
    },
    cancelPlacement() {
      const uid = placement.info?.uid;
      if (uid) buildings.setHidden(uid, false);
      placement.cancel();
    },
    get placement() { return placement.info; },

    setTutorialTarget(t) { tutorialTarget = t || null; },
    /** Order id of the cup the player is carrying (null when empty-handed). */
    get carrying() { return carry?.orderId ?? null; },
    /** Auto play: { on, caption (i18n key), target (descriptor the HUD hand points at) }. */
    get autoStatus() { return auto; },
    /** What a staff unit is doing now ('harvest' | 'plant' | 'brew' | 'order' | 'deliver' | ''). */
    staffStatus: uid => staff.statusOf(uid),
    /** Object notices currently shown in the view: [{ key, kind, up, target }] (read only; refreshed ~4×/s). */
    get notices() { return badgeItems; },
    /** Screen point above a target (CSS px); visible:false for targets of the other area or during a view switch. */
    screenPoint(t) {
      if (!targetPoint(t, v3, Date.now())) return { x: 0, y: 0, visible: false };
      v3.project(camera);
      const visible = v3.z > -1 && v3.z < 1 && Math.abs(v3.x) <= 1 && Math.abs(v3.y) <= 1;
      // ▲ badge: point at the middle of the pin (it stands on the anchor, ~46 px tall).
      const lift = t.kind === 'building' && t.upgrade ? 26 : 0;
      return { x: canvasRect.left + (v3.x + 1) / 2 * canvasRect.width, y: canvasRect.top + (1 - v3.y) / 2 * canvasRect.height - lift, visible };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      input.dispose();
      outline?.remove();
      cinematics.dispose();
      cancelSwitch();
      fade.removeFromParent(); fade.geometry.dispose(); fadeMat.dispose();
      placement.dispose();
      markers.dispose();
      badges.dispose();
      pads.dispose();
      cafe.dispose();
      staff.dispose();
      buildings.dispose();
      plots.dispose();
      world.dispose();
      avatar.dispose();
      vfx.dispose();
      disposeScene(scene);
      scene.clear();
      if (import.meta.env.DEV && window.__realm === realm) delete window.__realm;
    },
  };

  syncAll(store.state, true);
  if (modeView(store.state) !== view) swapView(modeView(store.state));
  if (import.meta.env.DEV) window.__realm = realm;
  return realm;
}
