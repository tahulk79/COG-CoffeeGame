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
 *
 * Café street (docs/design/cafe-street.md §3.6–3.7): the café view is a street of 4 shops (SHOP_ORDER: tea · café ·
 * lemon · bar). venues-scene (shopfronts; its blockers join the café nav), street (venue customers + vendors), speech
 * (talk bubbles, reviews, fight cloud) and incidents (the director: balks, switches, cuts, fights, reviews) are wired
 * here. Camera: realm.focusShop(id | null) frames one shop (or the whole street), realm.focusedShop follows the camera
 * (a pinch out past the shop / a pan onto another shop updates it), hooks.onShopFocus(id) tells the HUD strip.
 * Café taps after the usual pickers: a waiting venue customer → street.serveTap; a venue lot / the café block that is
 * not the focused shop → zoom there (consumed, no walk); a locked venue (lot or its 🔒 badge) → zoom + the venue card
 * (hooks.onSelect({ kind: 'venue', venue })). The café tutorial is never intercepted.
 */
import * as THREE from 'three';
import { BUILDINGS, CROPS, CROP_ORDER, DRINKS, GOODS, VENUES, VENUE_ORDER } from '../../core/config/economy.js';
import { PARCELS, ROADS, inRect, GATE, FIXED, CUSTOMER, CAFE_SEATS, AREAS, BOUNDS, CAFE_BOUNDS, RESERVED, VENUE_LOTS, SHOP_FRAMES, STREET_FRAME, SHOP_ORDER, shopAt, parcelAt, areaAt, areaOfParcel } from '../../core/config/layout.js';
import { region as regionOf, footprint, upgradeError, parcelError, seatCount, seatsUsed, brewSlots, seatPatienceRatio, ownedPlots, plotOf, capacity, stored, cropUnlocked, seedCost, canPlay, cafeStaffed, regionGame, venueOpen, venueError, farmViewBounds, roadOpen, defOf, tileAt, jobState, prodError, collectError, sellAllQuote, unitOf, unitState, unitBlocked, quickFix } from '../../core/derive.js';
import { currentStep } from '../../core/tutorial.js';
import { t as tr } from '../../i18n/index.js';
import { loadModel } from '../../shared/three/models.js';
import { disposeScene, keepOnGPU } from '../../shared/three/dispose-scene.js';
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
import { createMarkers, FRAME_LAND } from './markers.js';
import { createCinematics } from './cinematics.js';
import { createBadges } from './badges.js';
import { createPads } from './pads.js';
import { setTableInfo, standSpot } from './seats.js';
import { createNav, navObstacles, rectArea } from './nav.js';
import { createInput } from './input.js';
import { createSpeech } from './speech.js';
import { createVenueScene } from './venues-scene.js';
import { createStreet } from './street.js';
import { createIncidents } from './incidents.js';
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
// Café street camera (zoom = × the base distance; camera.js): the café view may pull out further (the street overview);
// a venue is framed close enough to operate; past OVERVIEW_ZOOM the camera shows the street (focusedShop = null).
const CAFE_ZOOM_MAX = 2.5, VENUE_ZOOM = 1.6, OVERVIEW_ZOOM = 2.15;
const SHOP_PAD = 6; // m: the camera target may leave the focused shop's frame by this much before it counts as "left"
const FIELD_HALF = 1.5; // m: half of a field's 3 × 3 m footprint (walk-beside distance, land card frame)
const LAND_HALF = 1.5;  // m: half of the land-card highlight (a field-sized 3 × 3 m square around the tapped tile)
// First output good of a production batch / recipe (its icon flies to the storage pill, shows on the collect badge).
const firstGood = out => (out && Object.keys(out).find(g => GOODS[g])) || null;
const sumOut = out => Object.values(out || {}).reduce((n, v) => n + (Number(v) || 0), 0);

/**
 * @param {{ renderer: THREE.WebGLRenderer, store: object, gender: 'male'|'female', hooks?: { onSelect?, onResult?, onWalkToGate?, onStaffTap? } }} opts
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
  // Light-space axes (perpendicular to the sun direction): the shadow box is snapped to whole shadow-map texels along
  // them, so shadows stay still while the camera pans / follows (otherwise every edge shimmers = "flicker").
  const SUN_RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_OFFSET).normalize();
  const SUN_UP = new THREE.Vector3().crossVectors(SUN_OFFSET, SUN_RIGHT).normalize();
  const sunAt = new THREE.Vector3();

  // ---------- assets ----------
  const paths = [...new Set([...Object.values(BUILDINGS).map(b => b.model), ...EXTRA_MODELS, ...Object.values(TREE_PARTS), ...Object.values(GATE_PARTS)])].filter(Boolean); // procedural buildings (terrace) have no model
  const [loaded, avatar] = await Promise.all([
    Promise.all(paths.map(p => loadModel(p).catch(() => null))),
    createAvatar({ scene, gender }),
  ]);
  const templates = Object.fromEntries(paths.map((p, i) => [p, loaded[i]]));
  for (const [k, p] of Object.entries({ ...TREE_PARTS, ...GATE_PARTS })) templates[k] = templates[p];
  keepOnGPU(templates['cafe/props.glb#cup']); // shared by staff / café / street / hand cups: disposing a worker must not free it
  const prefabs = Object.fromEntries(Object.keys(BUILDINGS).map(type => [type, makePrefab(type, templates)]));
  setTableInfo(prefabs.tables?.userData.tableInfo); // customers sit on the Tables prefab's real chairs

  // ---------- sub-modules ----------
  const vfx = createVfx({ scene });
  const cam = createCameraController(camera);
  const speech = createSpeech({ scene, camera }); // street talk bubbles, reviews, fight cloud (café view)
  // What the café / street / staff / director use: talk only while the café is on screen (a staffed café keeps running
  // from the farm view, but its bubbles must not float over the farm). Same API as speech.js.
  const onCafe = () => view === 'cafe' && !switching && !disposed;
  const talk = {
    say: (o, text, opts) => onCafe() && speech.say(o, text, opts),
    review: (o, stars, text) => onCafe() && speech.review(o, stars, text),
    fightCloud: (x, z, opts) => (onCafe() ? speech.fightCloud(x, z, opts) : { done: Promise.resolve(), x, z }),
  };
  const world = createWorld({ scene, templates });
  const venues = createVenueScene({ scene, templates }); // the 3 street shops (shopfronts, counters, stools)
  const staticBlockers = [...world.blockers, ...venues.blockers]; // city houses + venue shops (constant)
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
    say: (o, text, opts) => talk.say(o, text, opts),
    getPlayerPos: () => avatar.position,
    isWalkable: (zone, x, z) => !navs[zone === 'farm' ? 'farm' : 'cafe'].blockedAt(x, z),
  });
  const placement = createPlacement({ scene, prefabs });
  const markers = createMarkers({ scene, camera });
  const cafe = createCafe({ scene, vfx, dispatch, templates, navigate, speech: talk });
  const street = createStreet({ scene, vfx, dispatch, navigate, speech: talk, templates });
  // The director reacts to café / street moments (hooks are queued and handled on its own update).
  const incidents = createIncidents({ cafe, street, speech: talk, dispatch, getState: () => store.state });
  cafe.setHooks({ onSpawnBlocked: incidents.onCafeSpawnBlocked, onArrived: incidents.onCustomerArrived });
  street.onWaitingLow = incidents.onVenueWaitingLow;
  street.onLeft = incidents.onVenueLeft;
  street.onServed = incidents.onVenueServed;
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
  let lastInputAt = 0;      // performance.now() of the last touch / zoom (the tutorial waits for a calm moment)
  let view = 'farm';        // area on screen: 'farm' | 'cafe'
  let viewApplied = false;  // visibility is applied on the first frame, so compileAsync sees both areas' materials
  let switching = null;     // { to, t, phase: 'out'|'in', promise, resolve } while the fade runs
  let focusedShop = null;   // café street: shop the camera frames (SHOP_ORDER id) or null (street overview / farm)
  let focusClock = 0;
  let prevState = store.state; // the state before the current store change (served orders are gone from the new one)
  const keys = new Set();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const arrowPos = new THREE.Vector3();
  const drag = { mode: null, visited: new Set(), stopped: false, ghostX: 0, ghostZ: 0, startX: 0, startZ: 0 };
  let canvasRect = canvas.getBoundingClientRect();

  // Two games (farm / café): each region is played as ONE game (core derive.canPlay), picked on its first entry.
  // The game on screen is state.mode; the other game's area cannot be shown.
  const modeView = state => (state.mode === 'cafe' ? 'cafe' : 'farm');
  const openArea = (state, area) => !regionGame(state) || canPlay(state, area);
  // The café runs while it is on screen, or while café staff / robots work there; otherwise it is paused (no customers,
  // nothing times out). The game on screen follows the view. Checked every frame, dispatches only on change.
  function syncArea(state) {
    if (switching || state.story.phase !== 'play') return;
    const r = regionOf(state);
    if (!r) return;
    if (!openArea(state, view)) { swapView(modeView(state)); return; }
    const paused = !!r.shop.pausedAt;
    const run = view === 'cafe' || (canPlay(state, 'cafe') && cafeStaffed(state));
    if (run && paused) store.dispatch('shop/resume');
    else if (!run && !paused) store.dispatch('shop/pause');
    if (regionGame(state) && state.mode !== view) store.dispatch('play/setMode', { mode: view });
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
      if (regionId !== undefined) { setCarry(null); plots.clear(); buildings.clear(); cafe.reset(); street.clear(); incidents.clear(); speech.clear(); staff.clear(); leaveModes(); setSelection(null); needArrive = !!id; cancelSwitch(); swapView(modeView(state)); }
      regionId = id;
      instant = true;
      avatar.teleport(avatar.position.x, avatar.position.z);
    }
    world.sync(state);
    plots.sync(state);
    buildings.sync(state);
    cafe.sync(state, instant);
    venues.sync(state);
    street.sync(state);
    staff.sync(state);
    // Building footprints block the player (slightly shrunk so doorways feel forgiving).
    // (walkable buildings — the terrace — never block the player)
    const solidBuildings = (regionOf(state)?.buildings || []).filter(b => BUILDINGS[b.type] && !BUILDINGS[b.type].walkable);
    // The whole farm map is walkable: land not bought yet is only overgrown scenery, never a wall.
    const ownedLots = regionOf(state)?.parcels || [];
    const blockRects = navObstacles(staticBlockers, solidBuildings);
    avatar.setBlockers(blockRects);
    // The farm view (camera + player bounds) grows with the land: owned lots + open roads + the frontier.
    if (view === 'farm') { const fb = farmViewBounds(state); avatar.setBounds(fb); cam.setBounds(fb); }
    // Navigation grids: rebuilt only when the buildings or the owned land change (built / moved / bought / entered).
    const key = `${id}|${ownedLots.join(',')}|${solidBuildings.map(b => `${b.uid}:${b.x},${b.z},${b.rot}`).join(';')}`;
    if (key !== navKey) {
      navKey = key;
      for (const area of ['farm', 'cafe']) navs[area].rebuild(blockRects.filter(r => rectArea(r) === area));
    }
    if (selection?.kind === 'building' && !buildings.get(selection.uid)) setSelection(null);
    if (selection?.kind === 'plot' && !plotOf(state, selection.id)) setSelection(null); // field removed / moved away
    if (selection?.kind === 'land' && (view !== 'farm' || tileAt(state, selection.x, selection.z)?.occupant)) setSelection(null); // built on
    if (selection?.kind === 'venue' && view !== 'cafe') setSelection(null);
    if (placement.info) placement.refresh();
  }

  const unsubscribe = store.subscribe((state, events, type) => {
    if (type === 'reset' || type === 'reload') { regionId = regionId === undefined ? undefined : '__reset__'; }
    // Before the sync: effects that need the old visuals (tree pop, customer mood, where a removed object stood).
    let removedAt = null;
    for (const ev of events) {
      if (ev.type === 'removed') {
        const f = ev.field ? plotOf(prevState, ev.uid) : null, e = f ? null : buildings.get(ev.uid);
        if (f || e) (removedAt ||= new Map()).set(ev.uid, f ? { x: f.x, z: f.z } : { x: e.x, z: e.z });
      } else if (ev.type === 'harvested') {
        plots.onHarvested(ev.plotId, clock);
        const plot = plotOf(state, ev.plotId);
        sfx('farm.harvest');
        if (plot) { reward({ x: plot.x, y: 1, z: plot.z }, 'hud-beans', '🫘', ev.beans); starPop({ x: plot.x, y: 1.6, z: plot.z }, ev.stars); }
      } else if (ev.type === 'served') {
        if (auto.on) { say('auto.coins', { n: ev.coins }); auto.wait = Math.max(auto.wait, .7); }
        // Seat patience used when served (the order is already gone from the new state): 0 = served right away.
        const was = regionOf(prevState)?.shop.orders.find(o => o.id === ev.orderId);
        incidents.onServed(ev.orderId, was ? seatPatienceRatio(was, Math.min(Date.now(), regionOf(prevState)?.shop.pausedAt || Infinity)) : .5);
        const at = cafe.onServed(ev.orderId);
        sfx('cafe.serve'); sfx('coin.gain');
        reward(at ? { x: at.x, y: 2, z: at.z } : { x: CUSTOMER.pickup.x, y: 2, z: CUSTOMER.pickup.z }, 'hud-coins', '🪙', ev.coins);
        starPop(at ? { x: at.x, y: 2.6, z: at.z } : { x: CUSTOMER.pickup.x, y: 2.6, z: CUSTOMER.pickup.z }, ev.stars);
      } else if (ev.type === 'customerLeft') {
        if (carry?.orderId === ev.orderId) setCarry(null); // the cup in hand is no longer wanted
        incidents.onLeft(ev.orderId, !!ev.angry, ev.reason);
        cafe.onLeft(ev.orderId, !!ev.angry, ev.reason);
      }
    }
    syncAll(state);
    badgeClock = 1; // refresh object notices right away
    for (const ev of events) {
      if (ev.type === 'poachStarted' || ev.type === 'poachRefused' || ev.type === 'mvp') staff.onEvent(ev); // rival line / MVP cheer over the unit
      if (ev.type === 'planted') { plots.onPlanted(ev.plotId, clock); sfx('farm.plant'); }
      else if (ev.type === 'built') { buildings.onBuilt(ev.uid, clock); sfx('farm.build'); }
      else if (ev.type === 'moved') {
        const e = buildings.get(ev.uid), f = e ? null : plotOf(state, ev.uid);
        if (e) vfx.burst('dust', e.root.position); else if (f) vfx.burst('soil', v3.set(f.x, .2, f.z), { count: 12 });
        sfx(f ? 'farm.plant' : 'farm.build');
      }
      else if (ev.type === 'fieldPlaced') { // a new bed is tilled: soil burst like planting
        const f = plotOf(state, ev.plotId);
        if (f && view === 'farm') { vfx.burst('soil', v3.set(f.x, .2, f.z), { count: 18 }); vfx.burst('dust', v3.set(f.x, .1, f.z), { count: 5 }); }
        sfx('farm.plant');
      }
      else if (ev.type === 'removed') {
        const at = removedAt?.get(ev.uid);
        if (at && areaAt(at.x, at.z) === view) vfx.burst('dust', v3.set(at.x, .2, at.z), { count: 12 });
        sfx('farm.build');
      }
      else if (ev.type === 'prodStarted') {
        const e = buildings.get(ev.uid);
        if (e && areaAt(e.x, e.z) === view) { vfx.burst('sparkle', v3.set(e.x, e.height + .4, e.z), { count: 8 }); vfx.burst('steam', v3.set(e.x, e.height, e.z), { count: 4 }); }
        sfx('farm.build');
      }
      else if (ev.type === 'prodCollected') {
        const e = buildings.get(ev.uid), good = firstGood(ev.out);
        if (e && good) reward({ x: e.x, y: e.height + .5, z: e.z }, 'hud-beans', GOODS[good].icon, sumOut(ev.out));
        if (e && areaAt(e.x, e.z) === view) vfx.burst('sparkle', v3.set(e.x, e.height + .4, e.z), { count: 10 });
        sfx('farm.harvest');
      }
      else if (ev.type === 'goodsSold' && ev.coins > 0) { // coins fly from the storehouse (else the player) to the coin pill
        const silo = regionOf(state)?.buildings.find(b => b.type === 'silo');
        const at = silo && areaAt(silo.x, silo.z) === view ? silo : avatar.position;
        reward({ x: at.x, y: 2, z: at.z }, 'hud-coins', '🪙', ev.coins);
      }
      else if (ev.type === 'upgraded') { buildings.onUpgraded(ev.uid); sfx('farm.build'); }
      else if (ev.type === 'orderTaken') { sfx('cafe.order'); const w = cafe.walker(ev.orderId); if (w) vfx.burst('sparkle', v3.set(w.person.position.x, 2.4, w.person.position.z), { count: 8 }); }
      else if (ev.type === 'brewStarted') sfx('cafe.cup');
      else if (ev.type === 'parcelBought') {
        const c = parcelSignPoint(ev.parcelId); vfx.burst('sparkle', v3.set(c.x, 1, c.z), { count: 20 }); vfx.burst('leaf', v3);
        // Founder rule (farm-map.md): after buying land the camera glides to the new lot (zoom kept).
        if (areaOfParcel(ev.parcelId) === 'farm' && view === 'farm') cam.glideTo(c.x, c.z);
        if (landMode) world.setLandMode?.(landMode, { state }); // the expand overlay redraws the lots for sale
      }
      else if (ev.type === 'hired' || ev.type === 'assigned') vfx.burst('sparkle', avatar.position, { count: 10 });
      else if (ev.type === 'regionEntered') { cancelSwitch(); swapView(modeView(state)); if (view === 'farm') avatar.teleport(GATE.x, GATE.z - 4); needArrive = true; }
      else if (ev.type === 'venueOpened') celebrateVenue(ev.venue);
    }
    prevState = state;
  });

  // A street shop just opened: confetti over its shopfront and the camera frames it.
  function celebrateVenue(id) {
    const lot = Object.hasOwn(VENUE_LOTS, id) ? VENUE_LOTS[id] : null;
    if (!lot) return;
    if (view === 'cafe' && !switching) {
      for (const [color, y] of [[0xff5a5a, 3.2], [0xffd23a, 3.6], [0x4fc3f7, 3.4], [0x7bd36a, 3.8]]) vfx.burst('sparkle', v3.set(lot.cx + (Math.random() - .5) * 4, y, lot.counter.z - .4), { count: 14, color });
      vfx.burst('coin', v3.set(lot.cx, 2.4, lot.counter.z + .6), { count: 10 });
      vfx.burst('dust', v3.set(lot.cx, .3, lot.counter.z + 1.2), { count: 8 });
    }
    focusShop(id);
  }

  // Coins / beans fly from the world position to the HUD counter (popNumber when the HUD element is missing).
  function reward(pos, elementId, icon, amount) {
    if (areaAt(pos.x, pos.z) !== view || switching) return; // off-screen area: the HUD counter still updates
    const sp = project(v3.set(pos.x, pos.y, pos.z));
    if (!sp) return;
    const el = document.getElementById(elementId);
    if (el) flyTo(sp, el, { icon, amount, text: `+${amount}` });
    else popNumber(`${icon} +${amount}`, sp, 'good');
  }

  // Quality ★ over a sale / harvest (2★ and 3★ only: 1★ is the plain default).
  function starPop(pos, stars) {
    if (!(stars >= 2) || areaAt(pos.x, pos.z) !== view || switching) return;
    const sp = project(v3.set(pos.x, pos.y, pos.z));
    if (sp) popNumber('⭐'.repeat(stars), sp, 'good');
  }

  function project(vec) {
    vec.project(camera);
    if (vec.z > 1 || vec.z < -1) return null;
    return { x: canvasRect.left + (vec.x + 1) / 2 * canvasRect.width, y: canvasRect.top + (1 - vec.y) / 2 * canvasRect.height };
  }

  // ---------- targets ----------
  function buildingOf(t) { return t.uid ? buildings.get(t.uid) : buildings.byType(t.type); }
  function resolvePlot(t, now) {
    if (t.id) return plotOf(store.state, t.id);
    return plots.first(t.want || 'empty', now);
  }
  // Which area a target lives in ('farm' | 'cafe'), null when unknown.
  function areaOf(t) {
    if (!t) return null;
    if (t.kind === 'plot' || t.kind === 'field' || t.kind === 'gate' || t.kind === 'land') return 'farm';
    if (t.kind === 'customer' || t.kind === 'venueCustomer') return 'cafe';
    if (t.kind === 'venue') return Object.hasOwn(VENUE_LOTS, t.venue) ? 'cafe' : null;
    if (t.kind === 'parcel') return PARCELS[t.id] ? areaOfParcel(t.id) : null;
    if (t.kind === 'building') {
      const e = buildingOf(t);
      if (e && Number.isFinite(e.x)) return areaAt(e.x, e.z);
      const zone = BUILDINGS[t.type]?.zone;
      return zone === 'shop' ? 'cafe' : zone === 'farm' ? 'farm' : null;
    }
    return null;
  }
  // Highlight rect drawn on the ground for the selection.
  function frameRect(t) {
    if (t.kind === 'plot') { const p = plotOf(store.state, t.id); return p ? footprint('field', p.x, p.z) : null; }
    if (t.kind === 'land') return Number.isFinite(t.x) && Number.isFinite(t.z) ? [t.x - LAND_HALF, t.z - LAND_HALF, t.x + LAND_HALF, t.z + LAND_HALF] : null;
    if (t.kind === 'building') { const e = buildingOf(t); return e ? footprint(e.type, e.x, e.z, e.rot) : null; }
    if (t.kind === 'parcel') return PARCELS[t.id]?.rect || null;
    if (t.kind === 'gate') return [GATE.x - GATE.radius, GATE.z - 1, GATE.x + GATE.radius, GATE.z + 1];
    if (t.kind === 'venue') { const lot = Object.hasOwn(VENUE_LOTS, t.venue) ? VENUE_LOTS[t.venue] : null; return lot ? [lot.rect[0], lot.counter.z - 1.2, lot.rect[2], lot.rect[3]] : null; }
    return null;
  }
  // World point above a target (arrow, screenPoint). Writes into `out`; returns false when it has no 3D position.
  function targetPoint(t, out, now) {
    if (!t || switching || areaOf(t) !== view) return false; // targets of the other area are not on screen
    if (t.kind === 'plot') { const p = resolvePlot(t, now); if (!p) return false; out.set(p.x, 1.3, p.z); return true; }
    if (t.kind === 'land') { if (!Number.isFinite(t.x) || !Number.isFinite(t.z)) return false; out.set(t.x, .8, t.z); return true; }
    if (t.kind === 'building') { const e = buildingOf(t); if (!e) return false; out.set(e.x, e.height + (t.upgrade ? BADGE_Y : 1.1), e.z); return true; }
    if (t.kind === 'customer') { const w = cafe.walker(t.orderId); if (!w) return false; out.set(w.person.position.x, 2.9, w.person.position.z); return true; }
    if (t.kind === 'parcel' && PARCELS[t.id]) { const c = parcelSignPoint(t.id); out.set(c.x, 2.7, c.z); return true; }
    if (t.kind === 'gate') { out.set(GATE.x, 6.4, GATE.z); return true; }
    if (t.kind === 'venue') { const a = venues.lockAnchor(t.venue); if (!a) return false; out.set(a.x, a.y + 1, a.z); return true; }
    if (t.kind === 'venueCustomer') { const c = street.walker(t.venue, t.cid); if (!c) return false; out.set(c.person.position.x, 2.9, c.person.position.z); return true; }
    return false;
  }

  function setSelection(t, { notify = true, glide = true } = {}) {
    outline?.remove(); outline = null;
    selection = t || null;
    timerSeconds = -1;
    markers.setTimer(null);
    if (!t) {
      markers.setFrame(null); // Hay Day rule: deselecting never moves the camera
    } else {
      markers.setFrame(frameRect(t), t.kind === 'land' ? { color: FRAME_LAND } : undefined);
      if (t.kind === 'building') { const e = buildingOf(t); if (e) outline = vfx.outline(e.model); }
      // The target was tapped (so it is on screen) or picked from the HUD: glide only when it is off-screen.
      // Never while a finger is down (swipe planting): the ground must not slide under the finger.
      if (glide && !cam.held && targetPoint(t, v3, Date.now())) cam.ensureVisible(v3.x, v3.z, .12);
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

  // Tap on a plot / parcel: the player runs over and stops at its edge on their side. The camera follows only when the
  // player is on screen (otherwise it stays on what was tapped and the player walks into view) — no separate glide,
  // which used to fight the follow and jerk the view.
  function walkBeside(x, z, half) {
    const p = avatar.position, dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
    if (d < half + .6) return; // already there
    const k = (half + .5) / d;
    gateWalk = false;
    if (carry) carry.walking = false;
    if (cam.sees(p.x, p.z, .05)) cam.explore({ tap: true });
    avatar.walkTo(x + dx * k, z + dz * k);
  }
  function tapPlot(id) {
    const now = Date.now();
    const stage = plots.stage(id, now);
    setSelection({ kind: 'plot', id }, { glide: false });
    const pl = plotOf(store.state, id); if (pl) walkBeside(pl.x, pl.z, FIELD_HALF);
    if (stage === 'empty') dispatch('farm/plant', { plotId: id, crop: activeCrop });
    else if (stage === 'ready') dispatch('farm/harvest', { plotId: id });
  }
  // Body taps. The two counters only ACT (no card): order counter → take the order; brewing counter → pick up a ready
  // cup and carry it to its customer, else brew the next taken order, else resume a delivery, else a hint toast.
  // Upgrades are reached only through the ▲ badge (target.upgrade). Other buildings open their info card.
  // Farm World 2.0: a production building whose batch is READY collects it at once (one tap, like the counters) and is
  // selected (its card shows the next batch); any other body tap just selects it.
  function tapBuilding(t) {
    if (!t.upgrade && t.uid && defOf(t.type)?.recipe) {
      const b = regionOf(store.state)?.buildings.find(x => x.uid === t.uid);
      if (b && jobState(b, Date.now()).stage === 'ready') dispatch('prod/collect', { uid: b.uid }); // storage full → toast
      setSelection(t);
      return;
    }
    if (t.upgrade || (t.type !== 'orderCounter' && t.type !== 'brewCounter')) { setSelection(t); return; }
    const orders = regionOf(store.state)?.shop.orders || [];
    if (selection) setSelection(null);
    // Act right away AND walk the player to the counter's pad (the pad then keeps working by proximity). The shared
    // cooldown stops the pad from firing the same action again on arrival.
    const padId = t.type === 'orderCounter' ? 'order' : 'brew';
    const acted = r => { if (r?.ok) { nearCooldown = 1; pads.pop(padId, clock); } };
    const goPad = () => { if (carry) carry.walking = false; gateWalk = false; cam.explore(); avatar.walkTo(PADS[padId].x, PADS[padId].z); };
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
    cam.explore(); // the camera follows the player while they walk (founder)
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
  const BADGE_NEAR = 9; // m: upgrade ▲ and buy-land "+" badges show only within this range of the farmer
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
  const STAND_PROBES = [[0, 0], [.5, 0], [-.5, 0], [0, .5], [0, -.5]];
  function canStand(zone, x, z) {
    const area = zone === 'farm' ? 'farm' : 'cafe';
    const b = area === 'farm' ? farmViewBounds(store.state) : AREAS[area].bounds; // farm: only the land opened so far
    if (x < b.minX + 1 || x > b.maxX - 1 || z < b.minZ + 1 || z > b.maxZ - 1 || navs[area].blockedAt(x, z)) return false;
    if (area === 'farm') {
      for (const rd of Object.values(ROADS)) if (inRect(x, z, rd.rect, .3) && !roadOpen(store.state, rd.id)) return false; // closed trails
      // Never idle on a field (or a building) footprint, nor within .5 m of one (fields stay walkable for walks).
      for (const [ox, oz] of STAND_PROBES) if (tileAt(store.state, x + ox, z + oz)?.occupant) return false;
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
      const room = stored(state) < capacity(state);
      const ready = room && autoNearest(mine.filter(p => plots.stage(p.id, now) === 'ready'));
      if (ready) return autoGo(ready.x, ready.z + 1.25, 'auto.harvest', { id: ready.id }, { kind: 'plot', id: ready.id }, () => {
        const s = store.state;
        if (plots.stage(ready.id, Date.now()) === 'ready' && stored(s) < capacity(s)) dispatch('farm/harvest', { plotId: ready.id });
      });
      // Finished production batches: collect them (never starts a batch, never builds or buys).
      const done = room && autoNearest(r.buildings.filter(b => b.job && areaAt(b.x, b.z) === 'farm' && collectError(state, b, now) === null));
      if (done) {
        const fp = footprint(done.type, done.x, done.z, done.rot);
        return autoGo(done.x, fp[3] + .8, 'auto.collect', { building: done.type }, { kind: 'building', uid: done.uid, type: done.type }, () => {
          const s = store.state, b = regionOf(s)?.buildings.find(x => x.uid === done.uid);
          if (b && collectError(s, b, Date.now()) === null) dispatch('prod/collect', { uid: b.uid });
        });
      }
      const crop = autoCrop(state);
      const empty = crop && autoNearest(mine.filter(p => plots.stage(p.id, now) === 'empty'));
      if (empty) return autoGo(empty.x, empty.z + 1.25, 'auto.plant', { crop }, { kind: 'plot', id: empty.id }, () => {
        const c = autoCrop(store.state);
        if (c && plots.stage(empty.id, Date.now()) === 'empty') dispatch('farm/plant', { plotId: empty.id, crop: c });
      });
      // Farm game: the storehouse is full → sell the beans there (never leaves for the café on its own).
      const quote = room ? null : sellAllQuote(state); // every good counts toward the cap, not only raw beans
      if (quote && quote.coins > 0) return autoGo(FIXED.silo.x, FIXED.silo.z + 2.4, 'auto.sell', { n: Math.floor(quote.amount) }, { kind: 'building', type: 'silo' }, () => {
        if (sellAllQuote(store.state).coins > 0) dispatch('farm/sellAll');
      });
      return autoIdle(dt, 'auto.waitGrow', null, 'auto.goCafe');
    }
    // café
    if (carry) { say('auto.serve', null, { kind: 'customer', orderId: carry.orderId }); deliver(); auto.step = null; auto.timer = 0; auto.phase = 'walk'; auto.idleT = 0; return; }
    const ready = mostUrgent(orders, o => o.stage === 'brewing' && now - o.brewStart >= o.brewMs && !staff.isClaimed(o.id), now);
    if (ready) return autoGo(PADS.brew.x, PADS.brew.z, 'auto.pickup', { drink: ready.drink, item: ready.item }, { kind: 'building', type: 'brewCounter' }, () => {
      const o = regionOf(store.state)?.shop.orders.find(x => x.id === ready.id);
      if (!carry && o?.stage === 'brewing' && Date.now() - o.brewStart >= o.brewMs && !staff.isClaimed(o.id)) { pads.pop('brew', clock); pickUp(o.id); auto.phase = 'pause'; auto.wait = 0; }
    });
    const brewing = orders.filter(o => o.stage === 'brewing').length;
    const taken = mostUrgent(orders, o => o.stage === 'taken', now);
    if (taken && brewing < brewSlots(state) && beans >= (DRINKS[taken.drink]?.beans || 1)) return autoGo(PADS.brew.x, PADS.brew.z, 'auto.brew', { drink: taken.drink, item: taken.item }, { kind: 'building', type: 'brewCounter' }, () => {
      const s = store.state, o = regionOf(s)?.shop.orders.find(x => x.id === taken.id);
      if (o?.stage === 'taken' && s.inventory.beans >= (DRINKS[o.drink]?.beans || 1)) { pads.pop('brew', clock); dispatch('shop/brew', { orderId: o.id }); }
    });
    if (cafe.queuedOrder(state) != null && seatsUsed(state) < seatCount(state)) return autoGo(PADS.order.x, PADS.order.z, 'auto.takeOrder', null, { kind: 'building', type: 'orderCounter' }, () => {
      const s = store.state, q = cafe.queuedOrder(s);
      if (q != null && seatsUsed(s) < seatCount(s)) { pads.pop('order', clock); dispatch('shop/takeOrder', { orderId: q }); }
    });
    // Nothing to do: stand ready at the order pad (customers walking in / cups brewing).
    if (distTo(PADS.order.x, PADS.order.z) > .6 && !avatar.moving) avatar.walkTo(PADS.order.x, PADS.order.z);
    if (brewing) { const o = orders.find(x => x.stage === 'brewing'); say('auto.brewing', { drink: o.drink, item: o.item }, { kind: 'building', type: 'brewCounter' }); auto.phase = 'pause'; auto.wait = BEAT; auto.idleT = 0; return; }
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
      if (on) { leaveModes(); setSelection(null); input.cancel(); endDrag(); keys.clear(); avatar.setKeyDir(0, 0); cam.explore(); }
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
      if (groundPoint(raycaster, hit)) placement.moveTo(hit.x, hit.z);
      return;
    }
    const target = pick();
    if (target?.kind === 'plot') return tapPlot(target.id);
    if (target?.kind === 'building') return tapBuilding(target);
    if (target?.kind === 'customer') return tapCustomer(target);
    if (target?.kind === 'staff') return tapStaff(target);
    if (target?.kind === 'staffUp') { hooks.onStaffTap?.(target.uid); return; } // ⬆️ ready to train → the HUD opens its card
    if (target?.kind === 'field') return harvestField(target.id);
    if (target?.kind === 'parcel') return tapParcel(target.id);
    if (target?.kind === 'gate') {
      setSelection({ kind: 'gate' });
      gateWalk = true;
      cam.explore({ tap: true });
      avatar.walkTo(GATE.x, GATE.z - GATE.radius, () => { if (gateWalk) { gateWalk = false; hooks.onWalkToGate?.(); } });
      return;
    }
    if (target?.kind === 'venue') return tapVenue(target.venue); // 🔒 / ! badge over a locked shop
    const cafeView = view === 'cafe';
    if (cafeView && !target) {
      // A waiting venue customer: the player serves them on the spot (or they say there is no free stool).
      const ch = raycaster.intersectObjects([...street.pickers()], false);
      if (ch.length && street.serveTap(ch[0].object.userData.target)) { if (selection) setSelection(null); return; }
      if (!tutorialActive()) {
        const vh = raycaster.intersectObjects([...venues.pickers()], false);
        const vt = vh.length ? vh[0].object.userData.target : null;
        if (vt?.kind === 'venue') return tapVenue(vt.venue);
      }
    }
    if (!groundPoint(raycaster, hit)) return;
    // A tap on another shop of the street (venue lot / the café block) zooms there first (no walk).
    let stayFramed = false;
    if (cafeView && !tutorialActive()) {
      const shop = shopAt(hit.x, hit.z);
      if (shop && shop !== focusedShop) { setSelection(null); focusShop(shop); return; } // unconditional: the HUD may show a strip-opened venue card
      // Walking into the framed shop from outside it: keep the frame (exploring would follow the far avatar back).
      if (shop && shop === focusedShop) {
        const f = SHOP_FRAMES[shop], p = avatar.position;
        stayFramed = p.x < f[0] - SHOP_PAD || p.x > f[2] + SHOP_PAD || p.z < f[1] - SHOP_PAD || p.z > f[3] + SHOP_PAD;
      }
    }
    const parcel = parcelAt(hit.x, hit.z);
    if (parcel && areaOfParcel(parcel.id) === view && world.parcelState(parcel.id) !== 'owned') return tapParcel(parcel.id);
    // Empty OWNED farm land: the player still walks there, and the HUD gets a small land card (field / build here).
    const tile = view === 'farm' ? tileAt(store.state, hit.x, hit.z) : null;
    const land = tile?.owned && !tile.occupant && tile.terrain !== 'road' && tile.terrain !== 'plaza' && tile.lot;
    if (land) setSelection({ kind: 'land', x: tile.x, z: tile.z, lot: tile.lot }, { glide: false });
    else setSelection(null);
    gateWalk = false;
    if (carry) carry.walking = false; // the cup stays in hand; tap the customer / counter to resume
    if (!stayFramed) cam.explore({ tap: true }); // walking: the camera follows the player (dead zone), a pan stops it again
    avatar.walkTo(hit.x, hit.z);
    vfx.burst('dust', hit, { count: 4 });
  }

  function tapParcel(id) {
    setSelection({ kind: 'parcel', id }, { glide: false });
    const c = parcelSignPoint(id);
    walkBeside(c.x, c.z, .8); // stop in front of its price sign
  }

  // Staff tap (staff-manager.md §9): a jammed robot's body counts knocks (the 3rd → free staff/care knock); a unit that
  // cannot work → its paid fix (D.quickFix: bonusSmall for the phone, recharge, cool, repair, coffee, food, bonus);
  // an idle farm worker's 🪙 water bubble → staff/tend. Not enough coins → the usual error toast (hooks.onResult).
  function tapStaff(target) {
    const s = store.state, u = unitOf(s, target.uid), now = Date.now();
    if (!u) return;
    if (target.body && unitState(u, now) === 'jam') { if (staff.knock(u.uid)) dispatch('staff/care', { uid: u.uid, kind: 'knock' }); return; }
    const fix = unitBlocked(u, now) ? quickFix(u, now) : null;
    if (fix) { dispatch('staff/care', { uid: u.uid, kind: fix.kind }); return; }
    if (u.stopped) { dispatch('staff/resume', { uid: u.uid }); return; } // older stop kinds
    if (!target.body) dispatch('staff/tend', { uid: u.uid });
  }

  // ---------- café street: shops, camera focus ----------
  // The café tutorial owns every café tap (nothing is intercepted while it runs).
  const tutorialActive = () => !!tutorialTarget || !!currentStep(store.state, 'cafe');
  // Venue lot / badge tap: a locked shop (or the focused open one) shows its card; another shop zooms there too.
  function tapVenue(id) {
    if (!Object.hasOwn(VENUE_LOTS, id) || view !== 'cafe') return;
    if (!venueOpen(store.state, id) || focusedShop === id) setSelection({ kind: 'venue', venue: id });
    else setSelection(null); // unconditional: a venue card opened from the shop strip lives only in the HUD
    if (focusedShop !== id) focusShop(id); // after the selection: its ensureVisible must not win over the frame
  }
  function setFocused(id) {
    if (id === focusedShop) return;
    focusedShop = id;
    hooks.onShopFocus?.(id);
  }
  // Camera frame of a shop (café = its counters + first seats, as when entering the café) or the street overview.
  function frameShop(id) {
    if (id === 'cafe') cam.focusRect(CAFE_LOOP_RECT, { key: 'shop:cafe', force: true, maxZoom: 1.9 });
    else if (id) cam.focusRect(SHOP_FRAMES[id], { key: `shop:${id}`, force: true, maxZoom: VENUE_ZOOM });
    else cam.focusRect(STREET_FRAME, { key: 'street', force: true });
    setFocused(id || null);
  }
  /** Frames shop `id` (SHOP_ORDER) or the whole street (null); switches to the café view first. Resolves with the focus. */
  function focusShop(id = null) {
    if (disposed || (id != null && !SHOP_ORDER.includes(id))) return Promise.resolve(focusedShop);
    if (view !== 'cafe' || switching) {
      if (!openArea(store.state, 'cafe')) return Promise.resolve(focusedShop);
      return setView('cafe').then(v => (v === 'cafe' && !switching ? focusShop(id) : focusedShop));
    }
    frameShop(id);
    return Promise.resolve(focusedShop);
  }
  // focusedShop follows the camera: pinched out past OVERVIEW_ZOOM → the street (null); otherwise the shop under the
  // look target, or null once the target left the focused shop's frame (+ SHOP_PAD). Checked 5×/s.
  function updateFocus(dt) {
    if (view !== 'cafe' || switching || cam.mode === 'cinematic') return;
    if ((focusClock += dt) < .2) return;
    focusClock = 0;
    const g = cam.goal.target;
    let next = focusedShop;
    if (cam.zoom >= OVERVIEW_ZOOM) next = null;
    else {
      const at = shopAt(g.x, g.z);
      if (at) next = at;
      else if (focusedShop) {
        const f = SHOP_FRAMES[focusedShop];
        if (g.x < f[0] - SHOP_PAD || g.x > f[2] + SHOP_PAD || g.z < f[1] - SHOP_PAD || g.z > f[3] + SHOP_PAD) next = null;
      }
    }
    setFocused(next);
  }

  // Sickle badge over a field: harvest every ripe plot in it (stops at the first refusal, e.g. storehouse full).
  function harvestField(parcelId) {
    const now = Date.now();
    const ready = ownedPlots(store.state).filter(p => p.parcel === parcelId && plots.stage(p.id, now) === 'ready');
    if (!ready.length) return;
    setSelection({ kind: 'plot', id: ready[0].id });
    for (const p of ready) if (!dispatch('farm/harvest', { plotId: p.id }).ok) break;
  }

  // ---------- object notices (badges) ----------
  let badgeClock = 1;
  const isTutorialTarget = (kind, id) => tutorialTarget?.kind === kind && (tutorialTarget.uid ?? tutorialTarget.id) === id;
  const badgeItems = [];
  // New pin kinds ('collect' / 'produce') are used only once badges.js says it can draw them (supports(kind) or kinds[]).
  const badgeKind = kind => (typeof badges.supports === 'function' ? !!badges.supports(kind) : Array.isArray(badges.kinds) ? badges.kinds.includes(kind) : false);
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
      let kind = null, icon = null;
      // Production (Farm World 2.0): a ready batch → collect (always shown); idle and able to start → produce (near).
      if (def.recipe) {
        const js = jobState(b, now);
        if (js.stage === 'ready') { kind = 'collect'; icon = GOODS[firstGood(js.out)]?.icon || null; }
        else if (js.stage === 'idle' && prodError(state, b) === null) kind = 'produce';
        if (kind && !badgeKind(kind)) kind = null; // badges.js without that pin yet: keep the ▲ only
      }
      if (b.type === 'orderCounter' && waiting && cafe.queuedOrder(state) != null) kind = seatsUsed(state) < seatCount(state) ? 'order' : 'noSeat';
      else if (b.type === 'brewCounter') {
        if (ready && !carry) kind = 'serve'; // while carrying, the counter's next job is brewing
        if (!kind && taken && brewing + ready < brewSlots(state) && state.inventory.beans >= (DRINKS[taken.drink]?.beans || 1)) kind = 'brew';
      }
      if (!kind && !up) continue;
      // Upgrade-only ▲ (and 'produce') shows when the farmer walks up to it (or the tutorial points at it); interaction
      // badges always. The SELECTED building shows its ▲ at any distance (upgrades are reached only through the ▲).
      const selected = selection?.kind === 'building' && selection.uid === b.uid;
      if ((!kind || kind === 'produce') && !selected && !isTutorialTarget('building', b.uid) && distTo(b.x, b.z) > BADGE_NEAR) continue;
      const target = { kind: 'building', uid: b.uid, type: b.type }, upTarget = { ...target, upgrade: true };
      badgeItems.push({ key: b.uid, kind: kind || (up === 'ok' ? 'up' : 'upMuted'), up: kind ? up : null, upTarget, x: b.x, y: e.height + BADGE_Y, z: b.z, target: kind ? target : upTarget, icon });
    }
    // Carrying a cup: ☕ over the customer it belongs to (tap = deliver).
    if (carry && view === 'cafe') {
      const w = cafe.walker(carry.orderId);
      if (w) badgeItems.push({ key: `c${carry.orderId}`, kind: 'serve', x: w.person.position.x, y: 2.9, z: w.person.position.z, target: { kind: 'customer', orderId: carry.orderId } });
    }
    // Sickle per lot: over the middle of that lot's ripe fields (fields stand anywhere on owned land now).
    const ripe = new Map(); // lot id → { x, z, n }
    if (view === 'farm') {
      for (const pl of ownedPlots(state)) {
        if (!pl.parcel || plots.stage(pl.id, now) !== 'ready') continue;
        const m = ripe.get(pl.parcel) || { x: 0, z: 0, n: 0 };
        m.x += pl.x; m.z += pl.z; m.n++;
        ripe.set(pl.parcel, m);
      }
    }
    for (const p of Object.values(PARCELS)) {
      if (areaOfParcel(p.id) !== view) continue;
      if (r.parcels.includes(p.id)) {
        const m = ripe.get(p.id);
        if (m) badgeItems.push({ key: p.id, kind: 'harvest', x: m.x / m.n, y: 1.7, z: m.z / m.n, target: { kind: 'field', id: p.id } });
      } else if (!parcelError(state, p.id)) {
        // "+" only on for-sale signs the farmer is standing near (not a field of + all over the map).
        const c = parcelSignPoint(p.id);
        if (!isTutorialTarget('parcel', p.id) && distTo(c.x, c.z) > BADGE_NEAR) continue;
        badgeItems.push({ key: p.id, kind: 'buy', x: c.x, y: 2.75, z: c.z, target: { kind: 'parcel', id: p.id } });
      }
    }
    // Locked street shops (café view, not during the café tutorial): 🔒 + price chip; "!" once it can be opened now.
    if (view === 'cafe' && !tutorialActive()) {
      for (const id of VENUE_ORDER) {
        if (!Object.hasOwn(VENUE_LOTS, id) || venueOpen(state, id)) continue;
        const a = venues.lockAnchor(id), err = venueError(state, id);
        if (!a || err === 'unknown' || err === 'owned') continue;
        const chip = err === 'level' ? tr('hud.levelN', { level: VENUES[id].level }) : `🪙 ${VENUES[id].cost}`;
        badgeItems.push({ key: `v:${id}`, kind: err === null ? 'lockReady' : 'lock', x: a.x, y: a.y, z: a.z, chip, target: { kind: 'venue', venue: id } });
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
    down() { cam.grab(); lastInputAt = performance.now(); },
    up() { cam.letGo(); lastInputAt = performance.now(); },
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
        setSelection({ kind: 'plot', id: target.id }, { glide: false });
        dragPlot(target.id);
      } else drag.mode = 'pan';
    },
    dragMove(p, dx, dy) {
      if (locked()) return;
      if (drag.mode === 'pan') { cam.pan(dx, dy); return; }
      rayFrom(p);
      if (drag.mode === 'place') {
        drag.px = p.x; drag.py = p.y;
        if (groundPoint(raycaster, hit)) placement.moveTo(drag.ghostX + hit.x - drag.startX, drag.ghostZ + hit.z - drag.startZ);
        return;
      }
      if (drag.mode === 'plant' || drag.mode === 'harvest') {
        if (groundPoint(raycaster, hit)) markers.setCursor(drag.mode, hit);
        const target = pick(false);
        if (target?.kind === 'plot') dragPlot(target.id);
      }
    },
    dragEnd() { if (drag.mode === 'pan') cam.release(); endDrag(); },
    cancel: endDrag,
    zoom(f, at) {
      if (locked()) return;
      lastInputAt = performance.now();
      canvasRect = canvas.getBoundingClientRect();
      const anchor = at ? { x: (at.x - canvasRect.left) / canvasRect.width * 2 - 1, y: -((at.y - canvasRect.top) / canvasRect.height) * 2 + 1 } : null;
      cam.zoomBy(f, anchor);
    },
  }, locked);
  function endDrag() { drag.mode = null; drag.visited.clear(); markers.setCursor(null); }
  // Dragging a building near a screen edge scrolls the view that way (Hay Day), the ghost stays under the finger.
  const EDGE = 48, EDGE_SPEED = 520; // px from the edge, px/s at the very edge
  function edgeScroll(dt) {
    if (drag.mode !== 'place' || !placement.info || drag.px == null) return;
    const w = canvasRect.width, h = canvasRect.height, x = drag.px - canvasRect.left, y = drag.py - canvasRect.top;
    const push = (d) => (d < EDGE ? (1 - d / EDGE) : 0);
    const sx = push(w - x) - push(x), sy = push(h - y) - push(y);
    if (!sx && !sy) return;
    // pan(dx, dy) moves the world with the finger; scrolling towards an edge = the world moves the other way.
    cam.pan(-sx * EDGE_SPEED * dt, -sy * EDGE_SPEED * dt);
    cam.stopGlide();
    rayFrom({ x: drag.px, y: drag.py });
    if (groundPoint(raycaster, hit)) placement.moveTo(drag.ghostX + hit.x - drag.startX, drag.ghostZ + hit.z - drag.startZ);
  }

  // Placement start: keep the player's zoom, slide only if the ghost would be off-screen.
  function focusPlacement() {
    const info = placement.info;
    if (info) cam.ensureVisible(info.x, info.z, .2);
  }

  // ---------- modes: placement ghost ('build' land overlay) + land mode ('expand' = buy-land overview) ----------
  let landMode = null; // null | 'expand'
  // A field / building being moved is hidden while its ghost is dragged (plots.setHidden is optional: plots.js owns it).
  function setMovingHidden(type, uid, hidden) {
    if (!uid) return;
    if (type === 'field') plots.setHidden?.(uid, hidden); else buildings.setHidden(uid, hidden);
  }
  function endPlacement() {
    const info = placement.info;
    if (!info) return false;
    setMovingHidden(info.type, info.uid, false);
    placement.cancel();
    return true;
  }
  function setLandMode(mode) {
    const next = mode === 'expand' && view === 'farm' && !switching && !disposed ? 'expand' : null;
    if (next) endPlacement();
    if (next === landMode) { if (next) world.setLandMode?.(next, { state: store.state }); return landMode; }
    landMode = next;
    if (next) { if (selection) setSelection(null); cam.setOverview(true); } else cam.setOverview(false);
    world.setLandMode?.(landMode, { state: store.state });
    return landMode;
  }
  // Every mode off (view swap, atlas, cinematics, auto play, region change, cancelPlacement).
  function leaveModes() {
    const was = endPlacement();
    if (landMode) setLandMode(null);
    else if (was) world.setLandMode?.(null, { state: store.state });
  }

  // ---------- views (farm / café) ----------
  function applyView() {
    viewApplied = true;
    world.setView(view);
    buildings.setView(view);
    staff.setView(view);
    plots.group.visible = view === 'farm';
    cafe.group.visible = view === 'cafe';
    venues.setView(view);
    street.group.visible = view === 'cafe';
    pads.setVisible(view === 'cafe');
  }
  // Immediate switch: clears selection / placement / drags, moves the player to the area's spawn, snaps the camera.
  function swapView(v) {
    const changed = v !== view;
    view = v;
    const area = AREAS[v];
    leaveModes(); // placement ghost + land mode end on every view swap (restores the overview zoom first)
    if (changed) {
      if (selection) setSelection(null);
      gateWalk = false;
      if (carry) carry.walking = false; // the cup stays in hand across the switch
      input.cancel(); endDrag();
      avatar.teleport(area.spawn.x, area.spawn.z, Math.PI);
    }
    const bounds = v === 'farm' ? farmViewBounds(store.state) : area.bounds; // farm: only the land opened so far
    avatar.setBounds(bounds);
    cam.setBounds(bounds);
    cam.setZoomMax(v === 'cafe' ? CAFE_ZOOM_MAX : undefined); // the café street overview may pull out further
    if (changed) { cam.explore(); cam.snapTo(avatar.position); speech.clear(); }
    // Opening the café frames both counters (Area Focus, = the 'cafe' shop) so the player sees where to work right away.
    if (changed && v === 'cafe') frameShop('cafe');
    if (v !== 'cafe') setFocused(null);
    if (viewApplied) applyView();
  }
  function setView(v, { instant = false } = {}) {
    if (!AREAS[v] || disposed) return Promise.resolve(view);
    if (!openArea(store.state, v)) return Promise.resolve(view); // not this region's game
    if (switching) return switching.to === v ? switching.promise : switching.promise.then(() => setView(v, { instant }));
    if (v === view) return Promise.resolve(view);
    if (instant) { swapView(v); return Promise.resolve(view); }
    // Selection / placement / land mode end right away (the HUD hides the action bar), the swap happens under the fade.
    leaveModes();
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
    if (f || r) { gateWalk = false; if (carry) carry.walking = false; if (selection) setSelection(null); cam.explore(); } // keys: close follow again
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
    const playing = state.story.phase === 'play';
    cafe.update(dt, clock, state, now, playing);
    street.update(dt, clock, state, now, playing);
    incidents.update(dt, clock, state, now, playing);
    speech.update(dt, clock);
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
        const p = plotOf(state, selection.id);
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
    edgeScroll(dt);
    cinematics.update(dt);
    cam.update(dt);
    updateFocus(dt);
    // Sun + shadow frustum follow the camera target; fog scales with the camera distance.
    const target = cam.cur.target;
    // Box size changes in steps of 4 m only (zooming must not resize it every frame either).
    const half = clamp(Math.round(cam.cur.dist * .6 / 4) * 4, 16, 40);
    if (half !== shadowHalf) {
      shadowHalf = half;
      const sc = sun.shadow.camera;
      sc.left = sc.bottom = -half; sc.right = sc.top = half;
      sc.updateProjectionMatrix();
    }
    const texel = 2 * shadowHalf / sun.shadow.mapSize.x;
    const a = target.dot(SUN_RIGHT), b = target.dot(SUN_UP);
    sunAt.copy(target).addScaledVector(SUN_RIGHT, Math.round(a / texel) * texel - a).addScaledVector(SUN_UP, Math.round(b / texel) * texel - b);
    sun.position.copy(sunAt).add(SUN_OFFSET);
    sun.target.position.copy(sunAt);
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
    setInputLocked(v) { inputLocked = !!v; if (inputLocked) { gateWalk = false; realm.clearInput(); leaveModes(); } }, // a pending gate walk must not reopen the atlas later; the atlas / expiry end every mode
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
      if (t && area && !openArea(store.state, area)) return undefined; // not this region's game
      if (t && area && (area !== view || switching)) return setView(area).then(() => setSelection(t));
      setSelection(t || null);
      return undefined;
    },
    get selection() { return selection; },
    /** Focuses a target; a target in the other area switches the view first. Returns a Promise. */
    focus(t, { force = false } = {}) {
      const area = areaOf(t);
      if (area && !openArea(store.state, area)) return Promise.resolve();
      if (area && (area !== view || switching)) return setView(area).then(() => realm.focus(t, { force }));
      // Hay Day rule: keep the player's zoom, only slide the view (and only when the target is not already in view).
      if (targetPoint(t, v3, Date.now())) { if (force) cam.glideTo(v3.x, v3.z, { safe: true }); else cam.ensureVisible(v3.x, v3.z, .15); } // both keep it clear of the HUD bands
      return Promise.resolve();
    },
    /** True while a finger is down or within `ms` of the last touch / zoom (automatic camera moves wait for calm). */
    busy(ms = 1500) { return cam.held || performance.now() - lastInputAt < ms; },
    resetCamera() { cam.zoomBy(1 / cam.zoom); cam.explore(); },
    /** Café street: frame shop `id` ('tea' | 'cafe' | 'lemon' | 'bar') or the whole street (null). Returns a Promise. */
    focusShop,
    /** Shop the camera frames in the café view (null = street overview, or the farm view). */
    get focusedShop() { return focusedShop; },
    cinematic(name) { leaveModes(); return cinematics.play(name); },

    setActiveCrop(cropId) { if (CROPS[cropId]) activeCrop = cropId; },
    get activeCrop() { return activeCrop; },

    /**
     * Starts the placement preview of `type` (a building, decor or 'field'). Shop-zone buildings run in the café view,
     * farm-zone ones and fields in the farm view (the view switches first and a Promise of the info is returned then);
     * 'any' decor stays in the current view. uid = move that building / field (startPlacement('field', { uid: fieldId })).
     * near = { x, z } start point instead of the player (e.g. the land card's "Field here"). Leaves land mode.
     */
    startPlacement(type, { uid = null, near = null } = {}) {
      const def = defOf(type);
      if (!def) return null;
      // Farm buildings go on the farm's land, café buildings in the café; decorations stay in the view.
      const area = type === 'field' ? 'farm' : uid ? areaOf({ kind: 'building', uid, type }) || view : def.zone === 'farm' ? 'farm' : def.zone === 'shop' ? 'cafe' : realm.view;
      if (!openArea(store.state, area)) return null; // e.g. a café building in a farm region
      if (area !== view || switching) return setView(area).then(() => realm.startPlacement(type, { uid, near }));
      if (landMode) setLandMode(null);
      endPlacement();
      // Start near the player (the camera follows them) or the given spot: the placement searches the nearest valid spot.
      const from = near && Number.isFinite(near.x) && Number.isFinite(near.z) ? { x: near.x, z: near.z } : { x: avatar.position.x, z: avatar.position.z };
      const info = placement.start(type, { uid, area: view, near: from }, () => store.state);
      if (!info) { world.setLandMode?.(null, { state: store.state }); return null; }
      setMovingHidden(type, uid, true);
      setSelection(null, { notify: false });
      world.setLandMode?.('build', { state: store.state, type });
      focusPlacement();
      return info;
    },
    rotatePlacement() { placement.rotate(); },
    confirmPlacement() {
      const { uid = null, type = null } = placement.info || {};
      const result = placement.confirm(dispatch);
      if (result.ok) { setMovingHidden(type, uid, false); world.setLandMode?.(null, { state: store.state }); }
      return result;
    },
    /** Ends the placement preview AND land mode. */
    cancelPlacement() { leaveModes(); },
    get placement() { return placement.info; },
    /** Land mode: null | 'expand' (buy-land overview: world overlay + a far overview zoom, restored on exit). Farm only. */
    setLandMode(mode) { return setLandMode(mode); },
    get landMode() { return landMode; },
    /** Highlights the beds that can be planted (plots.js). */
    setPlantHighlight(on) { plots.setHighlight?.(!!on); },
    /** Screen bands (CSS px) the HUD covers ({ top, bottom }): selections / focus keep their target out of them. */
    setSafeInsets(insets) { cam.setSafeInsets(insets || {}); },
    /**
     * Screen point (CSS px) just under the placement ghost's footprint: { x, y, top, visible }. x = ghost centre, y = the
     * lowest footprint corner on screen, top = the highest point of the ghost (for when there is no room below).
     * The HUD keeps the ✓ ↻ ✕ buttons there, so they follow the building while it is dragged.
     */
    placementPoint() {
      const info = placement.info;
      if (!info || switching) return null;
      const fp = footprint(info.type, info.x, info.z, info.rot);
      const toScreen = (x, y, z) => { v3.set(x, y, z).project(camera); return { x: canvasRect.left + (v3.x + 1) / 2 * canvasRect.width, y: canvasRect.top + (1 - v3.y) / 2 * canvasRect.height, z: v3.z }; };
      const c = toScreen(info.x, 0, info.z);
      let bottom = -Infinity;
      for (const [x, z] of [[fp[0], fp[1]], [fp[2], fp[1]], [fp[0], fp[3]], [fp[2], fp[3]]]) bottom = Math.max(bottom, toScreen(x, 0, z).y);
      const top = toScreen(info.x, info.type === 'field' ? 1 : defOf(info.type)?.size?.[0] > 1 ? 3.2 : 2, info.z).y;
      return { x: c.x, y: bottom, top, visible: c.z > -1 && c.z < 1 };
    },

    setTutorialTarget(t) { tutorialTarget = t || null; },
    /** Order id of the cup the player is carrying (null when empty-handed). */
    get carrying() { return carry?.orderId ?? null; },
    /** The avatar's live position (THREE.Vector3; read x / z, do not mutate). */
    get avatarPosition() { return avatar.position; },
    /** Auto play: { on, caption (i18n key), target (descriptor the HUD hand points at) }. */
    get autoStatus() { return auto; },
    /** What a staff unit is doing now ('harvest' | 'plant' | 'brew' | 'order' | 'deliver' | ''). */
    staffStatus: uid => staff.statusOf(uid),
    /** Unit details for the HUD: job, reason, task(s), post, state, pose, working / bench, paid fix, vitals (staff.infoOf). */
    staffInfo: uid => staff.infoOf(uid),
    /**
     * "📍 Xem ở đâu": glides the camera to a unit of the area on screen and rings it for 3 s. False when the unit is not
     * shown here (other area, other region, during a view switch): the view is never switched for it.
     */
    focusUnit(uid) {
      const zone = staff.zoneOf(uid);
      if (!zone || switching || disposed || (zone === 'farm') !== (view === 'farm')) return false;
      const p = staff.highlight(uid);
      if (!p) return false;
      cam.glideTo(p.x, p.z, { safe: true });
      return true;
    },
    /** Café post of a staff unit ('allRounder' | 'cashier' | 'barista' | 'runner' | null). */
    staffPost: uid => staff.postOf?.(uid) ?? null,
    /** Object notices currently shown in the view: [{ key, kind, up, target }] (read only; refreshed ~4×/s). */
    get notices() { return badgeItems; },
    /** Screen point above a target (CSS px); visible:false for targets of the other area or during a view switch. */
    screenPoint(t) {
      if (!targetPoint(t, v3, Date.now())) return { x: 0, y: 0, visible: false };
      v3.project(camera);
      const visible = v3.z > -1 && v3.z < 1 && Math.abs(v3.x) <= 1 && Math.abs(v3.y) <= 1;
      // ▲ badge: point at the middle of the pin (it stands on the anchor, ~46 px tall).
      const lift = t.kind === 'building' && t.upgrade ? 26 : 0;
      return { x: canvasRect.left + (v3.x + 1) / 2 * canvasRect.width, y: canvasRect.top + (1 - v3.y) / 2 * canvasRect.height - lift, visible, valid: v3.z < 1 };
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
      incidents.clear();
      street.dispose();
      cafe.dispose();
      venues.dispose();
      speech.dispose();
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
