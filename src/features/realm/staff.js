// Staff assigned to the current region actually WORK (founder: "check the robots and workers — they don't work").
// Workers are rigged GLBs (dressPerson, walk anim from the block legs' swing); robots are procedural hover bots.
// Passive bonuses (derive) still apply; on top of that every unit runs a small job loop:
//  · farm  (farmhand, sproutBot): harvest a READY owned plot (nearest, unclaimed) → replant it with the player's
//    selected crop (or the best affordable unlocked crop) if seeds are affordable; else plant an EMPTY owned plot;
//    else wander near the fields. Never harvests when the storehouse is full.
//  · café  barista: 1 carry a READY cup the player is not carrying to its seated customer (cup in hand) → serve;
//                   2 take a waiting order at the order pad; 3 brew a taken order at the brew pad.
//          brewBot: 2 and 3 only, faster.
// Every action is checked with the derive helpers first and dispatched straight to the store (no error toasts); the
// usual store events drive the rewards / VFX. Claims (plots, orders, counter stations) stop units — and the player's
// cup pickup — from racing for the same thing; a job whose target changed meanwhile is dropped silently.
// Logic runs for both areas whatever the view (only the current area is drawn); it pauses outside phase 'play'.
// Breaks (core STAFF_BREAKS): a working worker sometimes slacks (rolled per minute of work → staff/stop, phone in hand,
// 📱/😂/💤), a robot's battery runs out after batteryMinutes of work (staff/stop: slumps, red eye, blinking 🔋). A
// stopped unit does nothing and releases its claims; a big "🪙 fee" bubble over its head (constant screen size,
// tappable, like the unit itself → target { kind: 'staff', uid }) lets the player pay staff/resume.
import * as THREE from 'three';
import { STAFF, STAFF_SLOTS, CROP_ORDER, DRINKS, STAFF_BREAKS } from '../../core/config/economy.js';
import { PARCELS, FIXED, plotById } from '../../core/config/layout.js';
import { assignedUnits, ownedPlots, plotState, cropUnlocked, seedCost, capacity, seatCount, seatsUsed, brewSlots, seatPatienceRatio, region as regionOf } from '../../core/derive.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { makeCanvasSprite, drawEmoji, dampK, FONT } from './util.js';
import { t } from '../../i18n/index.js';
import { FOV } from './camera.js';
import { standSpot } from './seats.js';

const F1 = PARCELS.F1.rect;
// Idle spots per zone (index = slot).
const IDLE = {
  farm: i => ({ x: F1[2] + .9, z: F1[1] + 1.2 + i * 1.7 }),
  shop: i => ({ x: FIXED.brewCounter.x + 3.6 + i * 1.2, z: FIXED.brewCounter.z + 3 }), // counter lane, east of the brew pad
};
const SPEED = { worker: 2.6, robot: 3.2 };
const WORK = { farmhand: 1.2, sproutBot: .8, barista: .7, brewBot: .4 };
const ICON = { harvest: '🌾', plant: '🌱', brew: '☕', order: '🧾', deliver: '🚶', phone: '📱', giggle: '😂', zzz: '💤', battery: '🔋', charged: '⚡' };
const FEE_PX = 58; // break bubble height on screen (CSS px) — same family as the ▲ / ! world badges
const FEE_W = 256, FEE_H = 176; // canvas of the break bubble

// Break bubble in the HUD card style: cream paper panel, warm brown border, small tail to the head, soft shadow.
// Left: status icon in a circle (📱 + 😴 for a slacking worker, red 🔋 for a robot). Right: gold coin chip + fee.
// Under: "Wake up" / "Recharge". Not enough coins → muted chip with a small 🔒.
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawBreak(g, W, H, kind = 'phone', fee = 0, ok = true, label = '') {
  g.clearRect(0, 0, W, H);
  const px = 10, py = 8, pw = W - 20, ph = H - 44, tail = 18;
  // shadow, panel, tail
  g.fillStyle = 'rgba(74,47,24,.25)'; rr(g, px, py + 5, pw, ph, 26); g.fill();
  g.beginPath(); g.moveTo(W / 2 - tail, py + ph - 2); g.lineTo(W / 2, py + ph + tail + 4); g.lineTo(W / 2 + tail, py + ph - 2); g.closePath();
  g.fillStyle = '#fff8e8'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#c99a5e'; g.stroke();
  rr(g, px, py, pw, ph, 26); g.fillStyle = '#fff8e8'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#c99a5e'; g.stroke();
  g.fillStyle = '#fff8e8'; g.fillRect(W / 2 - tail + 4, py + ph - 6, tail * 2 - 8, 6); // join tail and panel
  // status icon circle
  const cx = px + 52, cy = py + ph * .42, r = 34;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = kind === 'battery' ? '#ffe1dc' : '#e6f1ff'; g.fill();
  g.lineWidth = 4; g.strokeStyle = kind === 'battery' ? '#e5533f' : '#6aa3c8'; g.stroke();
  drawEmoji(g, kind === 'battery' ? '🔋' : '📱', cx, cy + 2, 40);
  if (kind === 'battery') { g.fillStyle = '#e5533f'; g.fillRect(cx - 14, cy - 3, 9, 9); } // empty-cell red accent
  else drawEmoji(g, '😴', cx + 24, cy - 24, 22);
  // gold coin chip + fee
  const chipX = px + 100, chipY = cy - 26, chipW = pw - 108, chipH = 52;
  rr(g, chipX, chipY, chipW, chipH, 26);
  g.fillStyle = ok ? '#fff1c4' : '#ece6da'; g.fill(); g.lineWidth = 4; g.strokeStyle = ok ? '#e0a83a' : '#b9ad97'; g.stroke();
  const coinX = chipX + 28, coinR = 18;
  const grad = g.createRadialGradient(coinX - 6, cy - 8, 2, coinX, cy, coinR);
  if (ok) { grad.addColorStop(0, '#fff6b8'); grad.addColorStop(.35, '#ffd34d'); grad.addColorStop(1, '#e9a521'); }
  else { grad.addColorStop(0, '#f2f0ea'); grad.addColorStop(.4, '#cfc8b8'); grad.addColorStop(1, '#a9a092'); }
  g.beginPath(); g.arc(coinX, cy, coinR, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
  g.lineWidth = 3; g.strokeStyle = ok ? '#c98a17' : '#8f8678'; g.stroke();
  g.font = FONT.replace('{size}', '34'); g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = ok ? '#6b3f12' : '#8f8678';
  g.fillText(String(fee), coinX + coinR + 8, cy + 2);
  if (!ok) drawEmoji(g, '🔒', chipX + chipW - 18, chipY + 6, 20);
  // label
  if (label) { g.font = FONT.replace('{size}', '26'); g.textAlign = 'center'; g.fillStyle = '#7a4a2a'; g.fillText(label, W / 2 + 4, py + ph - 22); }
}
const THINK = .35;
// The seated customer closest to running out of patience is served / brewed for first.
const mostUrgent = (orders, test, now) => { let best = null, bp = -1; for (const o of orders) if (test(o)) { const p = seatPatienceRatio(o, now); if (p > bp) { bp = p; best = o; } } return best; };
const THINK_ = 0; // seconds between job searches for an idle unit

function drawStatus(g, size, icon = '') {
  if (!icon) return;
  const c = size / 2;
  g.fillStyle = 'rgba(60,35,15,.22)'; g.beginPath(); g.arc(c, c + 3, c * .7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c, c * .7, 0, Math.PI * 2); g.fill();
  g.lineWidth = 4; g.strokeStyle = '#6aa84f'; g.stroke();
  drawEmoji(g, icon, c, c + 2, size * .46);
}

/**
 * opts: { scene, store, vfx, templates, pads: { order:{x,z}, brew:{x,z} }, getActiveCrop(), getCarrying(),
 *         getSeat(orderId) → seat spot | null, navigate(sx, sz, tx, tz) → waypoints, isPaused() }
 */
export function createStaff({ scene, store, vfx, templates = {}, pads, navigate = null, getActiveCrop = () => null, getCarrying = () => null, getSeat = () => null, getQueued = () => null, canStand = () => true, isPaused = () => false }) {
  const group = new THREE.Group();
  group.name = 'realm-staff';
  scene.add(group);
  // Farm staff live in the farm area, shop staff in the café area: one child group each, toggled by setView.
  const zones = { farm: new THREE.Group(), shop: new THREE.Group() };
  group.add(zones.farm, zones.shop);
  // Shared robot parts.
  const geo = {
    body: new THREE.SphereGeometry(.42, 18, 14),
    head: new THREE.SphereGeometry(.32, 18, 14),
    eye: new THREE.SphereGeometry(.09, 10, 8),
    antenna: new THREE.CylinderGeometry(.025, .025, .32, 6),
    tip: new THREE.SphereGeometry(.07, 10, 8),
    shadow: new THREE.CircleGeometry(.45, 20).rotateX(-Math.PI / 2),
  };
  const mat = {
    sproutBot: new THREE.MeshStandardMaterial({ color: 0x9fd88a, roughness: .45, metalness: .1 }),
    brewBot: new THREE.MeshStandardMaterial({ color: 0xf2b880, roughness: .45, metalness: .1 }),
    face: new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: .4 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x6ff0ff }),
    tip: new THREE.MeshBasicMaterial({ color: 0xffd25a }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .18, depthWrite: false }),
  };
  const pickGeo = new THREE.BoxGeometry(.9, 1.9, .9).translate(0, .95, 0);
  const pickMat = new THREE.MeshBasicMaterial();
  const phoneGeo = new THREE.BoxGeometry(.09, .16, .02);
  const phoneMat = new THREE.MeshStandardMaterial({ color: 0x1d2330, emissive: 0x3a7bd5, emissiveIntensity: .6 });
  for (const x of [pickGeo, pickMat, phoneGeo, phoneMat]) x.userData.keep = true; // shared: disposeScene(worker) must skip them
  const units = new Map();   // uid → unit
  const claims = new Map();  // claim key ('plot:F1-1' | 'order:7' | 'station:brew') → uid
  const cupTemplate = templates['cafe/props.glb#cup'] || null;

  function makeRobot(type) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    const torso = new THREE.Mesh(geo.body, mat[type] || mat.sproutBot); torso.scale.set(1, 1.1, 1); torso.position.y = .5;
    const head = new THREE.Mesh(geo.head, mat.face); head.position.y = 1.1;
    const eyeMat = mat.eye.clone(); // per robot: turns red when the battery is empty
    const eye = new THREE.Mesh(geo.eye, eyeMat); eye.position.set(0, 1.12, .28); eye.scale.set(1.4, 1, .6);
    const antenna = new THREE.Mesh(geo.antenna, mat.face); antenna.position.y = 1.5;
    const tip = new THREE.Mesh(geo.tip, mat.tip); tip.position.y = 1.68;
    for (const m of [torso, head]) { m.castShadow = true; m.receiveShadow = true; }
    body.add(torso, head, eye, antenna, tip);
    const shadow = new THREE.Mesh(geo.shadow, mat.shadow); shadow.position.y = .03;
    root.add(body, shadow);
    return { root, body, eyeMat };
  }
  function makeCup() {
    const g = new THREE.Group();
    const cup = cupTemplate ? cupTemplate.clone() : new THREE.Mesh(new THREE.CylinderGeometry(.08, .065, .16, 10).translate(0, .08, 0), new THREE.MeshStandardMaterial({ color: 0xf4f1e6 }));
    if (cupTemplate) cup.scale.setScalar(1.8);
    g.add(cup);
    g.traverse(o => { o.raycast = () => {}; });
    g.visible = false;
    return g;
  }

  function sync(state) {
    const seen = new Set();
    for (const zone of ['farm', 'shop']) {
      const list = state.world.currentRegion ? assignedUnits(state, state.world.currentRegion, zone).slice(0, STAFF_SLOTS[zone]) : [];
      list.forEach((u, i) => {
        const def = STAFF[u.type];
        if (!def) return;
        seen.add(u.uid);
        let e = units.get(u.uid);
        if (!e) {
          if (def.kind === 'robot') e = { ...makeRobot(u.type), kind: 'robot' };
          else {
            const person = createPerson(zone === 'farm' ? '#6f9a4a' : '#8a5a3a', { gender: i % 2 ? 'female' : 'male' });
            if (def.model) dressPerson(person, def.model);
            e = { root: person, body: person, kind: 'worker' };
          }
          Object.assign(e, { uid: u.uid, type: u.type, zone, slot: i, phase: Math.random() * 6, job: null, think: Math.random() * THINK, walk: 0, status: '', yaw: 0, path: null, tgtX: NaN, tgtZ: NaN, watch: 0, watchX: 0, watchZ: 0, repaths: 0 });
          const idle = IDLE[zone](i);
          e.root.position.set(idle.x, 0, idle.z);
          e.label = makeCanvasSprite(96, drawStatus, { scale: .7 });
          e.label.sprite.position.y = e.kind === 'robot' ? 2.25 : 2.35;
          e.label.sprite.visible = false;
          e.root.add(e.label.sprite);
          e.cup = makeCup();
          e.cup.position.set(.12, e.kind === 'robot' ? 1.05 : 1.02, .38);
          e.root.add(e.cup);
          // Break visuals + tap targets: phone (workers), invisible pick box, "🪙 fee" bubble (constant screen size).
          e.phone = new THREE.Mesh(phoneGeo, phoneMat);
          e.phone.position.set(.05, 1.25, .32); e.phone.rotation.x = -.6; e.phone.visible = false; e.phone.raycast = () => {};
          e.root.add(e.phone);
          e.pick = new THREE.Mesh(pickGeo, pickMat);
          e.pick.visible = false;
          e.pick.userData.target = { kind: 'staff', uid: u.uid };
          e.root.add(e.pick);
          e.fee = makeBreakBubble(u.uid);
          e.fee.sprite.position.y = e.kind === 'robot' ? 2.15 : 2.3;
          e.root.add(e.fee.sprite);
          e.workT = 0;
          units.set(u.uid, e);
        }
        const wasStopped = !!e.stopped;
        e.stopped = u.stopped || null;
        if (e.stopped && !wasStopped) { endJob(e); e.moving = false; e.wander = null; e.feeSig = ''; }
        if (!e.stopped && wasStopped) resumed(e);
        e.slot = i;
        if (e.root.parent !== zones[zone]) zones[zone].add(e.root);
      });
    }
    for (const [uid, e] of units) if (!seen.has(uid)) remove(uid, e);
  }
  function remove(uid, e) {
    release(e);
    e.label.dispose();
    e.fee.dispose();
    e.eyeMat?.dispose();
    e.root.removeFromParent();
    if (e.kind === 'worker') disposeScene(e.root); // person blocks own their geometry; robot parts are shared
    units.delete(uid);
  }

  // ---------- claims ----------
  const claimed = key => claims.has(key);
  function claim(e, key) { claims.set(key, e.uid); (e.claims ||= []).push(key); }
  function release(e) { for (const k of e.claims || []) if (claims.get(k) === e.uid) claims.delete(k); e.claims = []; }
  function endJob(e) { release(e); e.job = null; e.cup.visible = false; setStatus(e, ''); }
  function setStatus(e, s) {
    if (e.status === s) return;
    e.status = s;
    e.label.redraw(ICON[s] || '');
    e.label.sprite.visible = !!ICON[s];
  }

  // ---------- movement: grid paths (nav.js) ----------
  /**
   * Walks the unit to (tx, tz) along a grid path (nav.js). The path is planned when the target changes; stuck
   * (< 0.1 m in 0.8 s) → repath; after 3 repaths → nudge onto the next waypoint, so a unit is never stuck forever.
   * Returns true on arrival (the last waypoint is the nearest reachable spot when the target is blocked).
   */
  function moveTo(e, tx, tz, dt) {
    const p = e.root.position;
    if (e.tgtX !== tx || e.tgtZ !== tz || !e.path) plan(e, tx, tz);
    const wp = e.path[0];
    if (!wp) { e.moving = false; return true; }
    const dx = wp.x - p.x, dz = wp.z - p.z, dist = Math.hypot(dx, dz);
    if (dist < (e.path.length > 1 ? .2 : .1)) { e.path.shift(); e.moving = e.path.length > 0; return !e.path.length; }
    const step = Math.min(dist, SPEED[e.kind] * (e.type === 'brewBot' ? 1.15 : 1) * (e.speedK || 1) * dt);
    p.x += dx / dist * step; p.z += dz / dist * step;
    e.moving = true;
    e.yaw = Math.atan2(dx, dz);
    if ((e.watch += dt) > .8) {
      const moved = Math.hypot(p.x - e.watchX, p.z - e.watchZ);
      e.watch = 0; e.watchX = p.x; e.watchZ = p.z;
      if (moved < .1) {
        if (++e.repaths <= 3) plan(e, tx, tz, true);
        else { const n = e.path.shift(); if (n) { p.x = n.x; p.z = n.z; } e.repaths = 0; }
      }
    }
    return false;
  }
  function plan(e, tx, tz, keepCount = false) {
    const p = e.root.position;
    e.tgtX = tx; e.tgtZ = tz;
    e.path = navigate ? navigate(p.x, p.z, tx, tz) : [{ x: tx, z: tz }];
    if (!e.path.length) e.path = [];
    e.watch = 0; e.watchX = p.x; e.watchZ = p.z;
    if (!keepCount) e.repaths = 0;
  }
  // Light separation: units never stand on each other (a small push, never a block).
  function separate(list) {
    for (let i = 0; i < list.length; i++) for (let k = i + 1; k < list.length; k++) {
      const a = list[i].root.position, b = list[k].root.position;
      if (list[i].zone !== list[k].zone) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0 && d < .6) { const push = (.6 - d) * .25 / d; a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push; }
    }
  }

  // ---------- job selection ----------
  const near = (e, list) => {
    const p = e.root.position;
    let best = null, bd = Infinity;
    for (const it of list) { const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < bd) { bd = d; best = it; } }
    return best;
  };
  function cropFor(state) {
    const active = getActiveCrop();
    if (active && cropUnlocked(state, active) && seedCost(state, active) <= state.player.coins) return active;
    for (let i = CROP_ORDER.length - 1; i >= 0; i--) {
      const id = CROP_ORDER[i];
      if (cropUnlocked(state, id) && seedCost(state, id) <= state.player.coins) return id;
    }
    return null;
  }
  // Stand beside the bed (south edge) so the unit does not stand inside the tree.
  const plotSpot = plot => ({ x: plot.x, z: plot.z + 1.25 });

  function farmJob(e, state, now) {
    const plots = ownedPlots(state);
    const r = regionOf(state);
    const roomForBeans = state.inventory.beans < capacity(state);
    if (roomForBeans) {
      const ready = plots.filter(p => !claimed(`plot:${p.id}`) && r.plots[p.id] && plotState(state, p.id, now).stage === 'ready');
      const p = near(e, ready);
      if (p) return { type: 'harvest', plotId: p.id, ...plotSpot(p) };
    }
    if (cropFor(state)) {
      const empty = plots.filter(p => !claimed(`plot:${p.id}`) && !r.plots[p.id]);
      const p = near(e, empty);
      if (p) return { type: 'plant', plotId: p.id, ...plotSpot(p) };
    }
    return null;
  }
  function shopJob(e, state, now) {
    if (regionOf(state)?.shop.pausedAt) return null; // café paused while the player is on the farm
    const orders = regionOf(state)?.shop.orders || [];
    const carrying = getCarrying();
    if (e.type === 'barista') {
      const ready = mostUrgent(orders, o => o.stage === 'brewing' && now - o.brewStart >= o.brewMs && o.id !== carrying && !claimed(`order:${o.id}`) && getSeat(o.id), now);
      if (ready) return { type: 'deliver', orderId: ready.id, step: 'pickup', ...pads.brew };
    }
    if (!claimed('station:order') && getQueued() != null && seatsUsed(state) < seatCount(state)) return { type: 'order', station: 'order', ...pads.order };
    const brewing = orders.filter(o => o.stage === 'brewing').length;
    const taken = mostUrgent(orders, o => o.stage === 'taken', now);
    if (!claimed('station:brew') && taken && brewing < brewSlots(state) && state.inventory.beans >= (DRINKS[taken.drink]?.beans || 1)) return { type: 'brew', station: 'brew', ...pads.brew };
    return null;
  }
  function startJob(e, job) {
    e.speedK = 1;
    e.job = { ...job, work: 0, arrived: false };
    if (job.plotId) claim(e, `plot:${job.plotId}`);
    if (job.orderId != null) claim(e, `order:${job.orderId}`);
    if (job.station) claim(e, `station:${job.station}`);
    setStatus(e, job.type);
  }

  // ---------- doing the work (checked first, dispatched straight to the store: no toasts) ----------
  const act = (type, payload) => store.dispatch(type, payload);
  function finish(e, state, now) {
    const j = e.job;
    const r = regionOf(state);
    if (j.type === 'harvest') {
      if (r?.plots[j.plotId] && plotState(state, j.plotId, now).stage === 'ready' && state.inventory.beans < capacity(state)) {
        if (act('farm/harvest', { plotId: j.plotId }).ok) {
          const s = store.state, crop = cropFor(s);
          if (crop && !regionOf(s)?.plots[j.plotId]) { e.job = { type: 'plant', plotId: j.plotId, x: j.x, z: j.z, work: 0, arrived: true }; setStatus(e, 'plant'); return; }
        }
      }
    } else if (j.type === 'plant') {
      const crop = cropFor(state);
      if (crop && r && !r.plots[j.plotId] && r.parcels.includes(plotById(j.plotId)?.parcel)) act('farm/plant', { plotId: j.plotId, crop });
    } else if (j.type === 'order') {
      const queued = getQueued();
      if (queued != null && seatsUsed(state) < seatCount(state)) act('shop/takeOrder', { orderId: queued });
    } else if (j.type === 'brew') {
      const orders = r?.shop.orders || [];
      const taken = mostUrgent(orders, o => o.stage === 'taken', now);
      if (taken && orders.filter(o => o.stage === 'brewing').length < brewSlots(state) && state.inventory.beans >= (DRINKS[taken.drink]?.beans || 1)) act('shop/brew', { orderId: taken.id });
    } else if (j.type === 'deliver') {
      const o = r?.shop.orders.find(x => x.id === j.orderId);
      const ok = o && o.stage === 'brewing' && now - o.brewStart >= o.brewMs && getCarrying() !== o.id;
      if (j.step === 'pickup') {
        const seat = ok && getSeat(o.id);
        if (seat) {
          const stand = standSpot(seat);
          Object.assign(j, { step: 'carry', x: stand.x, z: stand.z, work: 0, arrived: false });
          e.cup.visible = true;
          return;
        }
      } else if (ok) act('shop/serve', { orderId: o.id });
    }
    endJob(e);
  }

  // Fee bubble height for sizeAttenuation=false sprites: constant on screen whatever the zoom.
  function feeHeight() { return FEE_PX * 2 * Math.tan(FOV * Math.PI / 360) / Math.max(400, globalThis.innerHeight || 800); }
  // Constant-screen-size canvas sprite (like the world badges), bottom-anchored on the head, tappable.
  function makeBreakBubble(uid) {
    const canvas = document.createElement('canvas');
    canvas.width = FEE_W; canvas.height = FEE_H;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false });
    const sprite = new THREE.Sprite(material);
    sprite.geometry.userData.keep = true;
    sprite.center.set(.5, 0);
    sprite.renderOrder = 42;
    const h = feeHeight();
    sprite.scale.set(h * FEE_W / FEE_H, h, 1);
    sprite.userData.target = { kind: 'staff', uid };
    sprite.visible = false;
    return {
      sprite,
      draw(kind, fee, ok) { drawBreak(canvas.getContext('2d'), FEE_W, FEE_H, kind, fee, ok, t(kind === 'battery' ? 'realm.staff.recharge' : 'realm.staff.wake')); map.needsUpdate = true; },
      dispose() { sprite.removeFromParent(); map.dispose(); material.dispose(); },
    };
  }
  // Back to work after staff/resume: phone pocketed / recharge flash.
  function resumed(e) {
    e.workT = 0;
    e.phone.visible = false;
    e.fee.sprite.visible = false;
    e.root.rotation.x = 0;
    if (e.eyeMat) e.eyeMat.color.set(0x6ff0ff);
    e.flash = 1.1;
    setStatus(e, e.kind === 'robot' ? 'charged' : '');
    vfx?.burst('sparkle', e.root.position, { count: 12 });
    vfx?.burst('coin', e.root.position);
  }
  // A unit on a break: no job; worker looks at the phone, robot slumps with a red blinking eye.
  function onBreak(e, time) {
    const b = e.stopped;
    e.moving = false;
    e.fee.sprite.visible = true;
    const ok = store.state.player.coins >= b.fee, sig = `${b.kind}|${b.fee}|${ok}`;
    if (sig !== e.feeSig) { e.feeSig = sig; e.fee.draw(b.kind, b.fee, ok); }
    e.fee.sprite.center.y = -Math.abs(Math.sin(time * 3.2 + e.phase)) * .12; // gentle bounce in screen space
    if (b.kind === 'battery' || e.kind === 'robot') {
      e.body.position.y = .04;
      e.body.rotation.x = .38;
      const on = Math.sin(time * 6) > 0;
      e.eyeMat?.color.set(on ? 0xff3b30 : 0x3a0d0b);
      setStatus(e, 'battery');
      e.label.sprite.material.opacity = on ? 1 : .35;
    } else {
      e.phone.visible = true;
      e.root.rotation.x = .1; // head down over the phone
      const cycle = (time + e.phase) % 6;
      setStatus(e, cycle < 4 ? 'phone' : cycle < 5 ? 'giggle' : 'zzz');
    }
  }

  // Idle: roam naturally — pick a free walkable spot nearby in the unit's zone (realm canStand: café floor / terrace
  // edges, field paths; never fields, counters, queue, seat stand spots or the player's pads), stroll there at a
  // relaxed pace, pause 1–3 s looking around, repeat. No "go back to the home spot".
  function wander(e, dt, time) {
    const w = e.wander;
    if (w && !w.reached) {
      e.speedK = .55;
      if (moveTo(e, w.x, w.z, dt)) { w.reached = true; w.pause = 1 + Math.random() * 2; e.moving = false; w.look = e.yaw; }
      return;
    }
    if (w && (w.pause -= dt) > 0) { e.moving = false; e.yaw = w.look + Math.sin(time * 1.3 + e.phase) * .6; return; } // look around
    const p = e.root.position;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (!canStand(e.zone, x, z) || claimed(`spot:${Math.round(x)},${Math.round(z)}`)) continue;
      e.wander = { x, z, reached: false };
      return;
    }
    // Nowhere nice nearby (e.g. just after a job in a tight corner): drift back towards the zone's area.
    const home = IDLE[e.zone](e.slot);
    e.wander = { x: home.x + (Math.random() - .5) * 4, z: home.z + (Math.random() - .5) * 4, reached: false };
  }

  // Per frame. state = store.state, now = Date.now(); time = realm clock.
  function update(dt, time, state, now) {
    const paused = isPaused() || state.story.phase !== 'play' || !state.world.currentRegion;
    for (const e of units.values()) {
      if (e.stopped) { onBreak(e, time); continue; }
      if (e.label.sprite.material.opacity !== 1) e.label.sprite.material.opacity = 1;
      if (e.flash > 0 && (e.flash -= dt) <= 0) setStatus(e, '');
      // Visuals: robot bob, worker leg swing while moving (dressPerson reads it for the walk anim).
      if (e.kind === 'robot') {
        e.body.rotation.x *= 1 - dampK(6, dt);
        e.body.position.y = .25 + Math.sin(time * 2.4 + e.phase) * .08;
        if (!e.moving) e.body.rotation.y = Math.sin(time * .8 + e.phase) * .35; else e.body.rotation.y *= 1 - dampK(8, dt);
      } else {
        const legs = e.root.userData.legs;
        if (legs && e.moving) { e.walk += dt * 9; legs[0].rotation.x = Math.sin(e.walk) * .6; legs[1].rotation.x = -Math.sin(e.walk) * .6; }
      }
      if (e.label.sprite.visible) e.label.sprite.position.y = (e.kind === 'robot' ? 2.25 : 2.35) + Math.abs(Math.sin(time * 3 + e.phase)) * .08;
      let d = e.yaw - e.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      e.root.rotation.y += d * dampK(10, dt);
      if (paused) { e.moving = false; continue; }
      // Breaks happen only while really working (a job in progress).
      if (e.job) {
        const brk = STAFF_BREAKS[e.kind];
        if (e.kind === 'robot') { if ((e.workT += dt) >= brk.batteryMinutes * 60) { e.workT = 0; act('staff/stop', { uid: e.uid }); continue; } }
        else if (Math.random() < brk.slackChancePerMinute * dt / 60) { act('staff/stop', { uid: e.uid }); continue; }
      }
      // Keep the cup visible only while delivering; drop a delivery the player took over.
      if (e.job?.type === 'deliver' && e.job.orderId === getCarrying()) endJob(e);
      if (!e.job) {
        e.think -= dt;
        if (e.think <= 0) {
          e.think = THINK;
          const job = e.zone === 'farm' ? farmJob(e, state, now) : shopJob(e, state, now);
          if (job) { e.wander = null; e.speedK = 1; startJob(e, job); } // a job interrupts the stroll right away
        }
        if (!e.job) { wander(e, dt, time); setStatus(e, ''); continue; }
      }
      const j = e.job;
      if (!j.arrived) { if (moveTo(e, j.x, j.z, dt)) j.arrived = true; continue; }
      e.moving = false;
      if (j.work === 0 && j.type !== 'deliver') vfx?.burst(j.type === 'harvest' || j.type === 'plant' ? 'leaf' : 'steam', e.root.position, { count: 4 });
      j.work += dt;
      if (j.work >= (j.type === 'deliver' ? .25 : WORK[e.type] || 1)) finish(e, store.state, Date.now());
    }
    if (!paused && units.size > 1) { sepList.length = 0; for (const e of units.values()) sepList.push(e); separate(sepList); }
  }
  const sepList = [];

  return {
    group, sync, update,
    /** True when a staff member is bringing this order's cup (the player must not pick it up too). */
    isClaimed: orderId => claims.has(`order:${orderId}`),
    /** What a unit is doing now: 'harvest' | 'plant' | 'brew' | 'order' | 'deliver' | 'phone' | 'battery' | '' (idle). */
    statusOf: uid => { const e = units.get(uid); return e?.stopped ? e.stopped.kind : e?.flash > 0 ? '' : e?.status || ''; },
    /** Tap targets of units on a break (their fee bubble first, then the body). */
    *pickers() { for (const e of units.values()) if (e.stopped && e.root.parent?.visible) { yield e.fee.sprite; yield e.pick; } },
    setView(v) { zones.farm.visible = v === 'farm'; zones.shop.visible = v === 'cafe'; },
    clear() { for (const [uid, e] of [...units]) remove(uid, e); claims.clear(); },
    dispose() {
      this.clear();
      Object.values(geo).forEach(g => g.dispose());
      pickGeo.dispose(); pickMat.dispose(); phoneGeo.dispose(); phoneMat.dispose();
      Object.values(mat).forEach(m => m.dispose());
      group.removeFromParent();
    },
  };
}
