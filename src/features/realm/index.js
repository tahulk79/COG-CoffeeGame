/**
 * Realm — the 3D world of Farm & Café V3 (contract: docs/design/v3-architecture.md § Realm API).
 *
 * Renders the current region of the save (layout.js + store.state), turns taps/drags into store actions and owns
 * the café customer spawning. A region has two areas in the same scene — the farm (BOUNDS) and the café (CAFE_BOUNDS,
 * far south) — and the realm shows one at a time: `realm.view` ('farm' | 'cafe'), switched with `setView(view)` (short
 * fade, player + camera move to AREAS[view].spawn). Customers keep simulating in either view; they render in the café. Store orders/plots/buildings are the source of truth: visuals are diffed by id on every
 * store change (subscribe), and only time-based visuals (growth, brewing, patience) are evaluated per frame.
 * Sub-modules: world (ground/roads/parcels/scenery/gate), plots, buildings, cafe (customers), staff, avatar,
 * camera (CameraController), placement (ghost preview), markers (tutorial arrow, selection, drag cursor),
 * cinematics, input (gesture recognizer). Every action dispatched here is reported through hooks.onResult.
 */
import * as THREE from 'three';
import { BUILDINGS, CROPS } from '../../core/config/economy.js';
import { PARCELS, ROADS, GATE, FIXED, PLOT_SIZE, CUSTOMER, AREAS, plotById, parcelAt, inRect, areaAt, areaOfParcel } from '../../core/config/layout.js';
import { region as regionOf, footprint } from '../../core/derive.js';
import { loadModel } from '../../shared/three/models.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { createVfx, flyTo, popNumber } from '../../shared/vfx/index.js';
import { sfx } from '../../shared/audio/index.js';
import { createCameraController } from './camera.js';
import { createWorld, roadSignPoint, parcelSignPoint, isRoadOpen } from './world.js';
import { createPlots } from './plots.js';
import { createBuildings, makePrefab } from './buildings.js';
import { createCafe } from './cafe.js';
import { createStaff } from './staff.js';
import { createAvatar } from './avatar.js';
import { createPlacement } from './placement.js';
import { createMarkers } from './markers.js';
import { createCinematics } from './cinematics.js';
import { createInput } from './input.js';
import { groundPoint, unionRect, fmtTimer, clamp } from './util.js';

const SKY = 0xb4e2f7; // fog uses the same color so the horizon melts into the sky
const TREE_PARTS = { tree: 'farm/coffee-tree.glb#tree', fruitGreen: 'farm/coffee-tree.glb#fruit_green', fruitRipe: 'farm/coffee-tree.glb#fruit_ripe' };
const GATE_PARTS = { gateFrame: 'heaven/portal.glb#portal_frame', gateLeft: 'heaven/portal.glb#portal_left_leaf', gateRight: 'heaven/portal.glb#portal_right_leaf' };
const EXTRA_MODELS = ['cafe/espresso-machine.glb#machine', 'cafe/table.glb#chairs_pair', 'cafe/props.glb#cup'];
const FADE_OUT = .2, FADE_IN = .32; // view switch fade (seconds)
const KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
const COUNTER_RECT = unionRect(
  unionRect(footprint('orderCounter', FIXED.orderCounter.x, FIXED.orderCounter.z), footprint('brewCounter', FIXED.brewCounter.x, FIXED.brewCounter.z)),
  [CUSTOMER.queue.x - 1, CUSTOMER.queue.z, CUSTOMER.pickup.x + 1, CUSTOMER.pickup.z + 1],
);

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
  const paths = [...new Set([...Object.values(BUILDINGS).map(b => b.model), ...EXTRA_MODELS, ...Object.values(TREE_PARTS), ...Object.values(GATE_PARTS)])];
  const [loaded, avatar] = await Promise.all([
    Promise.all(paths.map(p => loadModel(p).catch(() => null))),
    createAvatar({ scene, gender }),
  ]);
  const templates = Object.fromEntries(paths.map((p, i) => [p, loaded[i]]));
  for (const [k, p] of Object.entries({ ...TREE_PARTS, ...GATE_PARTS })) templates[k] = templates[p];
  const prefabs = Object.fromEntries(Object.keys(BUILDINGS).map(type => [type, makePrefab(type, templates)]));

  // ---------- sub-modules ----------
  const vfx = createVfx({ scene });
  const cam = createCameraController(camera);
  const world = createWorld({ scene, templates });
  const plots = createPlots({ scene, templates, vfx });
  const buildings = createBuildings({ scene, prefabs, templates, vfx });
  const staff = createStaff({ scene });
  const placement = createPlacement({ scene, prefabs });
  const markers = createMarkers({ scene });
  const cafe = createCafe({ scene, vfx, dispatch });
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

  function dispatch(type, payload) {
    const result = store.dispatch(type, payload);
    hooks.onResult?.(type, result);
    return result;
  }

  // ---------- store sync ----------
  function syncAll(state, instant = false) {
    const id = state.world.currentRegion || null;
    if (id !== regionId) {
      if (regionId !== undefined) { plots.clear(); buildings.clear(); cafe.reset(); staff.clear(); placement.cancel(); setSelection(null); needArrive = !!id; cancelSwitch(); swapView('farm'); }
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
    avatar.setBlockers([...world.blockers, ...(regionOf(state)?.buildings || []).filter(b => BUILDINGS[b.type]).map(b => {
      const r = footprint(b.type, b.x, b.z, b.rot);
      return [r[0] + .15, r[1] + .15, r[2] - .15, r[3] - .15];
    })]);
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
        const at = cafe.onServed(ev.orderId);
        sfx('cafe.serve'); sfx('coin.gain');
        reward(at ? { x: at.x, y: 2, z: at.z } : { x: CUSTOMER.pickup.x, y: 2, z: CUSTOMER.pickup.z }, 'hud-coins', '🪙', ev.coins);
      } else if (ev.type === 'customerLeft') cafe.onLeft(ev.orderId);
    }
    syncAll(state);
    for (const ev of events) {
      if (ev.type === 'planted') { plots.onPlanted(ev.plotId, clock); sfx('farm.plant'); }
      else if (ev.type === 'built') { buildings.onBuilt(ev.uid, clock); sfx('farm.build'); }
      else if (ev.type === 'moved') { const e = buildings.get(ev.uid); if (e) vfx.burst('dust', e.root.position); sfx('farm.build'); }
      else if (ev.type === 'upgraded') { buildings.onUpgraded(ev.uid); sfx('farm.build'); }
      else if (ev.type === 'orderTaken') sfx('cafe.order');
      else if (ev.type === 'brewStarted') sfx('cafe.cup');
      else if (ev.type === 'parcelBought') { const c = parcelSignPoint(ev.parcelId); vfx.burst('sparkle', v3.set(c.x, 1, c.z), { count: 20 }); vfx.burst('leaf', v3); }
      else if (ev.type === 'roadOpened') { const c = roadSignPoint(ev.roadId); vfx.burst('dust', v3.set(c.x, .3, c.z), { count: 16 }); }
      else if (ev.type === 'hired' || ev.type === 'assigned') vfx.burst('sparkle', avatar.position, { count: 10 });
      else if (ev.type === 'regionEntered') { cancelSwitch(); swapView('farm'); avatar.teleport(GATE.x, GATE.z - 4); needArrive = true; }
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
    if (t.kind === 'plot' || t.kind === 'road' || t.kind === 'gate') return 'farm';
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
      if (type === 'orderCounter' || type === 'brewCounter') return { rect: COUNTER_RECT, key: 'counters' };
      if (!e) return null;
      const r = footprint(e.type, e.x, e.z, e.rot);
      return { rect: [r[0] - 2, r[1] - 2, r[2] + 2, r[3] + 2], key: `b:${e.uid}` };
    }
    if (t.kind === 'parcel' && PARCELS[t.id]) return { rect: PARCELS[t.id].rect, key: `parcel:${t.id}` };
    if (t.kind === 'road' && ROADS[t.id]) { const c = roadSignPoint(t.id); return { rect: [c.x - 6, c.z - 4, c.x + 4, c.z + 4], key: `road:${t.id}` }; }
    if (t.kind === 'gate') return { rect: [GATE.x - 4, GATE.z - 5, GATE.x + 4, GATE.z + 2], key: 'gate' };
    return null;
  }
  // Highlight rect drawn on the ground for the selection.
  function frameRect(t) {
    if (t.kind === 'plot') { const p = plotById(t.id); return p ? [p.x - PLOT_SIZE / 2, p.z - PLOT_SIZE / 2, p.x + PLOT_SIZE / 2, p.z + PLOT_SIZE / 2] : null; }
    if (t.kind === 'building') { const e = buildingOf(t); return e ? footprint(e.type, e.x, e.z, e.rot) : null; }
    if (t.kind === 'parcel') return PARCELS[t.id]?.rect || null;
    if (t.kind === 'road') return ROADS[t.id]?.rect || null;
    if (t.kind === 'gate') return [GATE.x - GATE.radius, GATE.z - 1, GATE.x + GATE.radius, GATE.z + 1];
    return null;
  }
  // World point above a target (arrow, screenPoint). Writes into `out`; returns false when it has no 3D position.
  function targetPoint(t, out, now) {
    if (!t || switching || areaOf(t) !== view) return false; // targets of the other area are not on screen
    if (t.kind === 'plot') { const p = resolvePlot(t, now); if (!p) return false; out.set(p.x, 1.3, p.z); return true; }
    if (t.kind === 'building') { const e = buildingOf(t); if (!e) return false; out.set(e.x, e.height + 1.1, e.z); return true; }
    if (t.kind === 'parcel' && PARCELS[t.id]) { const c = parcelSignPoint(t.id); out.set(c.x, 2.7, c.z); return true; }
    if (t.kind === 'road' && ROADS[t.id]) { const c = roadSignPoint(t.id); out.set(c.x, 2.5, c.z); return true; }
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
  function tapBuilding(t) {
    const state = store.state, now = Date.now();
    const orders = regionOf(state)?.shop.orders || [];
    setSelection(t);
    if (t.type === 'orderCounter' && orders.some(o => o.stage === 'waiting')) dispatch('shop/takeOrder', {});
    else if (t.type === 'brewCounter') {
      if (orders.some(o => o.stage === 'brewing' && now - o.brewStart >= o.brewMs)) dispatch('shop/serve', {});
      else if (orders.some(o => o.stage === 'taken')) dispatch('shop/brew', {});
    }
  }

  function onTap(p) {
    if (locked()) return;
    rayFrom(p);
    if (placement.info) {
      if (groundPoint(raycaster, hit)) { placement.moveTo(hit.x, hit.z); focusPlacement(); }
      return;
    }
    const target = pick();
    if (target?.kind === 'plot') return tapPlot(target.id);
    if (target?.kind === 'building') return tapBuilding(target);
    if (target?.kind === 'gate') {
      setSelection({ kind: 'gate' });
      gateWalk = true;
      avatar.walkTo(GATE.x, GATE.z - GATE.radius, () => { if (gateWalk) { gateWalk = false; hooks.onWalkToGate?.(); } });
      return;
    }
    if (!groundPoint(raycaster, hit)) return;
    const state = store.state;
    const parcel = parcelAt(hit.x, hit.z);
    if (parcel && world.parcelState(parcel.id) !== 'owned') return setSelection({ kind: 'parcel', id: parcel.id });
    if (view === 'farm') for (const road of Object.values(ROADS)) {
      if (!road.open && inRect(hit.x, hit.z, road.rect) && !isRoadOpen(state, road.id) && !inRect(hit.x, hit.z, ROADS.mainNS.rect)) return setSelection({ kind: 'road', id: road.id });
    }
    setSelection(null);
    gateWalk = false;
    avatar.walkTo(hit.x, hit.z);
    vfx.burst('dust', hit, { count: 4 });
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
    if (parcel) cam.focusRect(parcel.rect, { key: `parcel:${parcel.id}` });
  }

  // ---------- views (farm / café) ----------
  function applyView() {
    viewApplied = true;
    world.setView(view);
    buildings.setView(view);
    staff.setView(view);
    plots.group.visible = view === 'farm';
    cafe.group.visible = view === 'cafe';
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
      input.cancel(); endDrag();
      avatar.teleport(area.spawn.x, area.spawn.z, Math.PI);
    }
    avatar.setBounds(area.bounds);
    cam.setBounds(area.bounds);
    if (changed) { cam.explore(); cam.snapTo(avatar.position); }
    // Opening the café frames both counters (Area Focus) so the player sees where to work right away.
    if (changed && v === 'cafe') cam.focusRect(COUNTER_RECT, { key: 'counters', force: true });
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
    if (f || r) { gateWalk = false; if (selection) setSelection(null); else if (cam.mode === 'free') cam.explore(); }
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
    avatar.update(dt, clock);
    const orders = regionOf(state)?.shop.orders || [];
    plots.update(dt, clock, now);
    buildings.update(dt, clock, orders, now);
    cafe.update(dt, clock, state, now, state.story.phase === 'play');
    staff.update(dt, clock);
    world.update(clock);
    placement.update(clock);
    // Tutorial arrow + selected plot timer.
    if (tutorialTarget && targetPoint(tutorialTarget, arrowPos, now)) markers.setArrow(arrowPos); else markers.setArrow(null);
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
    resize(w, h) { cam.resize(w, h); canvasRect = canvas.getBoundingClientRect(); },
    handleKeyDown(e) {
      if (locked() || e.repeat || !KEYS[e.code] || e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
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
      const area = uid ? areaOf({ kind: 'building', uid, type }) || view : zone === 'shop' ? 'cafe' : zone === 'farm' ? 'farm' : realm.view;
      if (area !== view || switching) return setView(area).then(() => realm.startPlacement(type, { uid }));
      if (placement.info?.uid) buildings.setHidden(placement.info.uid, false);
      const info = placement.start(type, { uid, area: view }, () => store.state);
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
    /** Screen point above a target (CSS px); visible:false for targets of the other area or during a view switch. */
    screenPoint(t) {
      if (!targetPoint(t, v3, Date.now())) return { x: 0, y: 0, visible: false };
      v3.project(camera);
      const visible = v3.z > -1 && v3.z < 1 && Math.abs(v3.x) <= 1 && Math.abs(v3.y) <= 1;
      return { x: canvasRect.left + (v3.x + 1) / 2 * canvasRect.width, y: canvasRect.top + (1 - v3.y) / 2 * canvasRect.height, visible };
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
  if (import.meta.env.DEV) window.__realm = realm;
  return realm;
}
