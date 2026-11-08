// Staff assigned to the current region actually WORK (founder: "check the robots and workers — they don't work").
// Workers are rigged GLBs (dressPerson, walk anim from the block legs' swing); robots are procedural hover bots.
// Levels & robots (docs/design/staff-upgrades.md): a worker's level sets its speed, slack chance and which smart rules
// it uses (SMART_RULES: urgent / twoCups / chain in the café, ripeFirst / playerCrop / quick on the farm); finished jobs
// are batched into staff/workDone (XP). A robot does ONE task (unit.task, or 'auto': the task with the most work
// waiting, re-picked every ROBOT_AUTO.autoSeconds while idle), takes no café post (it idles at its task's spot),
// never chains, always takes the first in line, and its motor / battery parts set its speed and work time per charge.
// Mistakes (MISTAKES, workers only, rolled per job by level × trait): spill (cup drops → shop/spill, rebrew), wrong
// table (a detour to another table first), unripe (farm/harvest unripe: 1 bean less), crooked (farm/plant crooked:
// grows slower) — each with a line in the worker's voice (realm.staff.oops.<kind>.<trait>).
// Lead / manager-rank workers wear a gold armband (GM.look.armband) on the left upper arm (management-rules §6).
// Over the head: ⬆️ (tappable → hooks.onStaffTap) when a worker can be trained; an idle robot shows its task icon
// (🔄 ring in auto mode). Robot hardware shows on the body: battery pack on the back, motor ring, charger antenna tip.
// Passive bonuses (derive) still apply; on top of that every unit runs a small job loop:
//  · farm  (farmhand, sproutBot): harvest a READY owned plot (nearest, unclaimed) → replant it with the player's
//    selected crop (or the best affordable unlocked crop) if seeds are affordable; else plant an EMPTY owned plot;
//    else wander near the fields. Never harvests when the storehouse is full.
//  · café  (barista, brewBot) — the decisions are pure, in staff-brain.js (see its header; unit-tested):
//      posts each sync (1 → all-rounder, 2 → cashier + barista, 3+ → + runners; brewBot prefers barista); a unit does
//      its post's jobs first, then any job whose owner is busy. deliver = carry a READY cup (workers take a second
//      ready cup whose seat is ≤ 4 m from the first, nearest-first; robots carry 1); order = take the queue head at the
//      order pad (only with a free seat and beans — else ☕❌ "Hết hạt!" once and wait); brew at the brew pad.
//      Chaining: order → brew right away (all-rounder); a brew of ≤ 2.5 s → wait at the pad and deliver it; after a
//      job the next search is immediate. Urgent customer (≤ 30 % seat patience) → walk 25 % faster.
//      Idle café units stand at their post facing the counter (cashier: order pad, barista: brew pad, all-rounder:
//      brew pad while something brews else order pad, runners: pickup side) with micro-idles (glance, wipe); only
//      after ~2.5 s without work they stroll around (≤ 5 m, often several stops) before heading back. A unit standing on a pad reserves it: others use
//      the spot beside it (the player near a pad counts too). Farm units keep roaming as before.
//      Separation never pushes into a blocked cell (canStand, else a nav check); two units meeting head-on in a
//      lane: the lower uid steps aside 0.6 m.
// Every action is checked with the derive helpers first and dispatched straight to the store (no error toasts); the
// usual store events drive the rewards / VFX. Claims (plots, orders, counter stations) stop units — and the player's
// cup pickup — from racing for the same thing; a job whose target changed meanwhile is dropped silently.
// Logic runs for both areas whatever the view (only the current area is drawn); it pauses outside phase 'play'.
// Breaks (core STAFF_BREAKS): a working worker sometimes slacks (rolled per minute of work → staff/stop, phone in hand,
// 📱/😂/💤), a robot's battery runs out after batteryMinutes of work (staff/stop: slumps, red eye, blinking 🔋). A
// stopped unit does nothing and releases its claims; a big "🪙 fee" bubble over its head (constant screen size,
// tappable, like the unit itself → target { kind: 'staff', uid }) lets the player pay staff/resume.
// Staff manager (docs/design/staff-manager.md §9): only WORKING units (on shift, not blocked: D.unitWorking) run jobs.
// Bench units are hidden from the scene (shown only in the staff manager); their rest spot is where they reappear.
// Every unit batches its work / rest seconds (robots: + finished jobs) into staff/vitals (~5 s, TICKS); a robot rolls
// D.jamChance per finished job → staff/jam. Team timers: clock/tick every CLOCK.tickSeconds (played clock), staff/upkeep every 60 s, rival/visit every RIVAL.everyMinutes
// per zone (a rival's offer is an inbox task, expired by clock/tick), loan/tick every CLOCK.loanTickSeconds, staff/mvp every BOOKS.mvpMinutes — all only while playing.
// States (staff-brain poseOf): hungry / tired work slower (VITALS mul); sitting at 0 energy and at lunch; sulking stands
// still turned away; overheat smokes with a red body; jam jitters (3 taps on its body = knock). Blocking states with a
// paid fix (D.quickFix) carry the 🪙 bubble; the realm's tap maps it to the right staff/care kind. Worker tasks (u.tasks)
// restrict the job types a worker takes on both areas.
import * as THREE from 'three';
import { STAFF, CROP_ORDER, DRINKS, STAFF_BREAKS, ROBOT_TASKS, ROBOT_AUTO, unitSpeed, batteryMinutes, slackMul, hasRule, robotTask, mistakeChance, partTier, isHardDrink, BEANS, TEND, jamChance, energyMax, RIVAL, BOOKS, CAREER, GM, craftSpeed, rankOf, gearWalk, gearJob, hasSoftware, SOFTWARE, STAFF_SIM, CLOCK } from '../../core/config/economy.js';
import { PARCELS, FIXED } from '../../core/config/layout.js';
import { assignedUnits, ownedPlots, plotState, cropUnlocked, seedCost, capacity, stored, plotOf, tileAt, seatCount, seatsUsed, brewSlots, seatPatienceRatio, beanBuyQuote, plotGrowMs, canBrew, region as regionOf, unitState, unitBlocked, unitWorking, stateSpeedMul, quickFix, upgradableStats, buildingsOf, footprint, zoneLeaders, nudgeDue, needs, careError, chaosSlackMul, gmOf, gmThinkSeconds, workerPoach, planCropFor } from '../../core/derive.js';
import { assignPosts, pickShopJob, orderBlock, waitsForBrew, secondCup, nearestFirst, urgencyK, facing, yieldsTo, isReady, POST_JOBS, autoTask, ROBOT_POST, allows, ctxTakes, TICKS, vitalsInterval, vitalsNoop, timerDue, poseOf, stateIconKey, showsFix, knockStep, KNOCK } from './staff-brain.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { makeCanvasSprite, drawEmoji, dampK, FONT } from './util.js';
import { t, hasKey } from '../../i18n/index.js';
import { FOV } from './camera.js';
import { standSpot } from './seats.js';

const F1 = PARCELS.F1.rect;
// Idle spots per zone (index = slot).
const IDLE = {
  // One helper per level, so the team can grow past 3: idle spots wrap into a small grid.
  farm: i => ({ x: F1[2] + .9 + Math.floor(i / 3) * 1.3, z: F1[1] + 1.2 + (i % 3) * 1.7 }),
  shop: i => ({ x: FIXED.brewCounter.x + 3.6 + (i % 4) * 1.2, z: FIXED.brewCounter.z + 3 + Math.floor(i / 4) * 1.3 }), // counter lane, east of the brew pad
};
const SPEED = STAFF_SIM.speed; // m/s per kind (core config)
const WORK = STAFF_SIM.work;   // seconds per job by unit type (core config)
const ICON = { harvest: '🌾', plant: '🌱', brew: '☕', order: '🧾', deliver: '🚶', phone: '📱', giggle: '😂', zzz: '💤', battery: '🔋', charged: '⚡', noBeans: '☕❌', water: '💧', growing: '⏳', storageFull: '📦', noSeeds: '💸', noPlots: '🏞️',
  tired: '😮‍💨', hungry: '🍔', sulking: '😤', lunch: '🍽️', overheat: '🔥', jam: '⚙️', bench: '🪑' };
// Staff manager poses (§9).
const SIT_Y = -.32;            // m: body lowered when sitting (lunch, exhausted)
const FACE_AWAY = Math.PI;     // sulking: back to the camera (the view looks north)
const SMOKE_EVERY = .35;       // s between smoke puffs of an overheated robot
const RING_SECONDS = 3;        // focusUnit highlight ring
// Café posts: idle micro-behaviour and pad etiquette.
const FACE_COUNTER = Math.PI;  // counters face south: a unit in the lane looks north (-z) at them
// User 2026-11-07: idle staff walk around ("chạy lung tung") instead of standing still at their post.
const STROLL_AFTER = 2.5;      // s without work before a stroll
const STROLL_R = 5;            // m, max stroll distance from the post spot
const STROLL_CHAIN = .65;      // chance to stroll on to another spot instead of walking back to the post
const PAD_SIDE = .85;          // m, spot beside a pad another unit (or the player) stands on
const PAD_HOLD = .55;          // m, a still unit this close to a pad holds it
const SIDE_STEP = .6, SIDE_T = .35; // lane step-aside: distance (m) over time (s)
const NO_BEANS_LINE = 'realm.staff.noBeans';
const FEE_PX = 58; // break bubble height on screen (CSS px) — same family as the ▲ / ! world badges
const FEE_W = 256, FEE_H = 176; // canvas of the break bubble

// Break bubble in the HUD card style: cream paper panel, warm brown border, small tail to the head, soft shadow.
// Left: status icon in a circle (📱 + 😴 for a slacking worker, red 🔋 for a robot). Right: gold coin chip + fee.
// Under: "Wake up" / "Recharge". Not enough coins → muted chip with a small 🔒.
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// One look per fix: status icon (+ a small badge), circle colours and the label key under the coin chip.
const BUBBLE = {
  phone: { icon: '📱', badge: '😴', fill: '#e6f1ff', ring: '#6aa3c8', label: 'realm.staff.wake' },
  battery: { icon: '🔋', fill: '#ffe1dc', ring: '#e5533f', label: 'realm.staff.recharge', cell: true },
  tend: { icon: '💧', fill: '#dff3ff', ring: '#6aa3c8', label: 'realm.staff.tend' },
  overheat: { icon: '🔥', fill: '#ffe1dc', ring: '#e5533f', label: 'realm.staff.cool' },
  jam: { icon: '⚙️', badge: '❗', fill: '#ece6da', ring: '#8f8678', label: 'realm.staff.repair' },
  tired: { icon: '😮‍💨', badge: '☕', fill: '#fff1dc', ring: '#c99a5e', label: 'realm.staff.coffee' },
  hungry: { icon: '🍔', fill: '#fff1dc', ring: '#c99a5e', label: 'realm.staff.food' },
  sulking: { icon: '😤', badge: '🎁', fill: '#ffe9e6', ring: '#d9785f', label: 'realm.staff.bonus' },
};
function drawBreak(g, W, H, kind = 'phone', fee = 0, ok = true, label = '') {
  const b = BUBBLE[kind] || BUBBLE.phone;
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
  g.fillStyle = b.fill; g.fill();
  g.lineWidth = 4; g.strokeStyle = b.ring; g.stroke();
  drawEmoji(g, b.icon, cx, cy + 2, 40);
  if (b.cell) { g.fillStyle = '#e5533f'; g.fillRect(cx - 14, cy - 3, 9, 9); } // empty-cell red accent
  else if (b.badge) drawEmoji(g, b.badge, cx + 24, cy - 24, 22);
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

function drawStatus(g, size, icon = '', auto = false) {
  if (!icon) return;
  const c = size / 2;
  g.fillStyle = 'rgba(60,35,15,.22)'; g.beginPath(); g.arc(c, c + 3, c * .7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c, c * .7, 0, Math.PI * 2); g.fill();
  g.lineWidth = auto ? 7 : 4; g.strokeStyle = icon === ICON.noBeans ? '#e5533f' : auto ? '#3f8fe0' : '#6aa84f'; g.stroke();
  if (auto) drawEmoji(g, '🔄', c + size * .27, c - size * .27, size * .22);
  if (icon === ICON.noBeans) { drawEmoji(g, '☕', c, c + 2, size * .44); drawEmoji(g, '❌', c + size * .22, c + size * .2, size * .26); return; }
  drawEmoji(g, icon, c, c + 2, size * .46);
}

// "Ready to train" badge: gold circle with ⬆️.
function drawUp(g, size) {
  const c = size / 2;
  g.fillStyle = 'rgba(60,35,15,.25)'; g.beginPath(); g.arc(c, c + 3, c * .72, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd25a'; g.beginPath(); g.arc(c, c, c * .72, 0, Math.PI * 2); g.fill();
  g.lineWidth = 5; g.strokeStyle = '#fff6d0'; g.stroke();
  drawEmoji(g, '⬆️', c, c + 2, size * .5);
}

/**
 * opts: { scene, store, vfx, templates, pads: { order:{x,z}, brew:{x,z} }, getActiveCrop(), getCarrying(),
 *         getSeat(orderId) → seat spot | null, getQueued() → order id at the queue head | null,
 *         navigate(sx, sz, tx, tz) → waypoints, canStand(zone 'farm'|'shop', x, z), isPaused(),
 *         optional: say(obj3d, text, opts) (speech.say), getPlayerPos() → {x,z} | null, isWalkable(zone, x, z) }
 */
// Fallback cup (no GLB): one shared geometry / material for every worker's cups (kept: disposeScene skips them).
let cupGeo = null, cupMat = null;
const fallbackCupGeo = () => { if (!cupGeo) { cupGeo = new THREE.CylinderGeometry(.08, .065, .16, 10).translate(0, .08, 0); cupGeo.userData.keep = true; } return cupGeo; };
const fallbackCupMat = () => { if (!cupMat) { cupMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e6 }); cupMat.userData.keep = true; } return cupMat; };

export function createStaff({ scene, store, vfx, templates = {}, pads, navigate = null, getActiveCrop = () => null, getCarrying = () => null, getSeat = () => null, getQueued = () => null, canStand = () => true, isPaused = () => false, say = null, getPlayerPos = () => null, isWalkable = null }) {
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
    pack: new THREE.BoxGeometry(.3, .34, .14),
    ring: new THREE.TorusGeometry(.44, .05, 8, 28).rotateX(Math.PI / 2),
  };
  const mat = {
    sproutBot: new THREE.MeshStandardMaterial({ color: 0x9fd88a, roughness: .45, metalness: .1 }),
    brewBot: new THREE.MeshStandardMaterial({ color: 0xf2b880, roughness: .45, metalness: .1 }),
    face: new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: .4 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x6ff0ff }),
    tip: new THREE.MeshBasicMaterial({ color: 0xffd25a }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .18, depthWrite: false }),
  };
  // Hardware tiers 1..3 (index 0 unused): battery pack, motor ring, charger tip colors.
  const TIER_COLORS = [0, 0x7fbf5a, 0x3fa0e0, 0xf0b429];
  const tierMat = TIER_COLORS.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .35, metalness: .3, emissive: c, emissiveIntensity: .25 }));
  const pickGeo = new THREE.BoxGeometry(.9, 1.9, .9).translate(0, .95, 0);
  const pickMat = new THREE.MeshBasicMaterial();
  const phoneGeo = new THREE.BoxGeometry(.09, .16, .02);
  const phoneMat = new THREE.MeshStandardMaterial({ color: 0x1d2330, emissive: 0x3a7bd5, emissiveIntensity: .6 });
  for (const x of [pickGeo, pickMat, phoneGeo, phoneMat]) x.userData.keep = true; // shared: disposeScene(worker) must skip them
  // focusUnit: one shared highlight ring, re-parented under the focused unit for RING_SECONDS.
  const hiGeo = new THREE.RingGeometry(.55, .78, 32).rotateX(-Math.PI / 2);
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: .9, depthWrite: false });
  const hiRing = new THREE.Mesh(hiGeo, hiMat);
  hiRing.position.y = .06; hiRing.renderOrder = 5; hiRing.visible = false; hiRing.raycast = () => {};
  let hiT = 0;
  const smokeAt = new THREE.Vector3();
  const units = new Map();   // uid → unit
  const claims = new Map();  // claim key ('plot:F1-1' | 'order:7' | 'station:brew') → uid
  const cupTemplate = templates['cafe/props.glb#cup'] || null;

  function makeRobot(type) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    const torsoMat = (mat[type] || mat.sproutBot).clone(); // per robot: glows red while overheated
    const torso = new THREE.Mesh(geo.body, torsoMat); torso.scale.set(1, 1.1, 1); torso.position.y = .5;
    const head = new THREE.Mesh(geo.head, mat.face); head.position.y = 1.1;
    const eyeMat = mat.eye.clone(); // per robot: turns red when the battery is empty
    const eye = new THREE.Mesh(geo.eye, eyeMat); eye.position.set(0, 1.12, .28); eye.scale.set(1.4, 1, .6);
    const antenna = new THREE.Mesh(geo.antenna, mat.face); antenna.position.y = 1.5;
    const tip = new THREE.Mesh(geo.tip, mat.tip); tip.position.y = 1.68;
    for (const m of [torso, head]) { m.castShadow = true; m.receiveShadow = true; }
    const pack = new THREE.Mesh(geo.pack, tierMat[1]); pack.position.set(0, .55, -.42); pack.visible = false;
    const ring = new THREE.Mesh(geo.ring, tierMat[1]); ring.position.y = .14; ring.visible = false;
    body.add(torso, head, eye, antenna, tip, pack, ring);
    const shadow = new THREE.Mesh(geo.shadow, mat.shadow); shadow.position.y = .03;
    root.add(body, shadow);
    return { root, body, eyeMat, torsoMat, parts: { pack, ring, tip, antenna } };
  }
  function makeCup() {
    const g = new THREE.Group();
    const cup = cupTemplate ? cupTemplate.clone() : new THREE.Mesh(fallbackCupGeo(), fallbackCupMat());
    if (cupTemplate) cup.scale.setScalar(1.8);
    g.add(cup);
    g.traverse(o => { o.raycast = () => {}; });
    g.visible = false;
    return g;
  }

  function sync(state) {
    const seen = new Set();
    const now = Date.now();
    for (const zone of ['farm', 'shop']) {
      const list = state.world.currentRegion ? assignedUnits(state, state.world.currentRegion, zone) : [];
      // Posts go to the café workers working now (bench / blocked ones get none, the others re-spread).
      const posts = zone === 'shop' ? assignPosts(list.filter(u => STAFF[u.type]?.kind === 'worker' && unitWorking(u, now))) : null;
      let runner = 0, benchN = 0;
      list.forEach((u, i) => {
        const def = STAFF[u.type];
        if (!def) return;
        seen.add(u.uid);
        let e = units.get(u.uid);
        if (!e) {
          if (def.kind === 'robot') e = { ...makeRobot(u.type), kind: 'robot' };
          else {
            const person = createPerson(zone === 'farm' ? '#6f9a4a' : '#8a5a3a', { gender: u.gender === 'male' || u.gender === 'female' ? u.gender : i % 2 ? 'female' : 'male' });
            const blocks = [...person.children]; // createPerson's own meshes: the only GPU resources this worker owns
            if (def.model) dressPerson(person, def.model);
            e = { root: person, body: person, kind: 'worker', blocks };
          }
          Object.assign(e, { uid: u.uid, type: u.type, trait: u.trait || null, zone, slot: i, phase: Math.random() * 6, job: null, think: Math.random() * THINK, walk: 0, status: '', yaw: 0, path: null, tgtX: NaN, tgtZ: NaN, watch: 0, watchX: 0, watchZ: 0, repaths: 0 });
          const idle = zone === 'farm' ? freeFarmSpot(state, IDLE.farm(i)) : IDLE[zone](i);
          e.root.position.set(idle.x, 0, idle.z);
          e.label = makeCanvasSprite(96, drawStatus, { scale: .7 });
          e.label.sprite.position.y = e.kind === 'robot' ? 2.25 : 2.35;
          e.label.sprite.visible = false;
          e.root.add(e.label.sprite);
          e.cup = makeCup();
          e.cup.position.set(.12, e.kind === 'robot' ? 1.05 : 1.02, .38);
          e.root.add(e.cup);
          e.cup2 = makeCup(); // workers carry two cups (other hand)
          e.cup2.position.set(-.16, 1.02, .36);
          e.root.add(e.cup2);
          Object.assign(e, { post: null, runnerIdx: 0, home: { x: idle.x, z: idle.z }, idleT: 0, stroll: null, atPad: null, block: null, sideT: 0, sideX: 0, sideZ: 0, sideCool: 0 });
          // Staff manager: state (applyState), vitals batch (staggered start), bench spot, knock taps, smoke clock.
          Object.assign(e, { st: 'ok', pose: 'work', bench: false, blocked: false, working: undefined, stateK: 1, fix: null, stIcon: '', stT: 0,
            vT: Math.random() * TICKS.vitalsSeconds, vWork: 0, vRest: 0, vJobs: 0, dueKey: null, benchSpot: { x: idle.x, z: idle.z }, benchIdx: 0,
            knockN: 0, knockAt: 0, jolt: 0, smokeT: 0 });
          // Break visuals + tap targets: phone (workers), invisible pick box, "🪙 fee" bubble (constant screen size).
          e.phone = new THREE.Mesh(phoneGeo, phoneMat);
          e.phone.position.set(.05, 1.25, .32); e.phone.rotation.x = -.6; e.phone.visible = false; e.phone.raycast = () => {};
          e.root.add(e.phone);
          e.pick = new THREE.Mesh(pickGeo, pickMat);
          e.pick.visible = false;
          e.pick.userData.target = { kind: 'staff', uid: u.uid, body: true }; // body taps: knocking a jammed robot
          e.root.add(e.pick);
          e.fee = makeBreakBubble(u.uid);
          e.fee.sprite.position.y = e.kind === 'robot' ? 2.15 : 2.3;
          e.root.add(e.fee.sprite);
          e.workT = 0;
          if (e.kind === 'worker') {
            e.up = makeCanvasSprite(96, drawUp, { scale: .75 });
            e.up.sprite.position.y = 2.95;
            e.up.sprite.visible = false;
            e.up.sprite.userData.target = { kind: 'staffUp', uid: u.uid };
            e.up.sprite.raycast = THREE.Sprite.prototype.raycast; // tappable (canvas sprites are not by default)
            e.root.add(e.up.sprite);
          }
          units.set(u.uid, e);
        }
        e.u = u;
        if (e.kind === 'robot') showParts(e);
        else armband(e, u);
        // ⬆️ over a worker with a skill point to spend on a stat it can afford now (statError: points, coins, caps).
        if (e.kind === 'worker') e.canTrain = (u.points || 0) > 0 && upgradableStats(state, u).length > 0;
        applyState(e, now);
        e.benchIdx = e.bench ? benchN++ : 0;
        if (e.bench) benchSpot(state, zone, e.benchIdx, e.benchSpot);
        e.slot = i;
        e.post = e.kind === 'robot' ? (zone === 'shop' ? ROBOT_POST[taskOf(e)] || 'runner' : null) : posts?.get(u.uid) || null;
        e.runnerIdx = e.post === 'runner' ? runner++ : 0;
        if (e.root.parent !== zones[zone]) zones[zone].add(e.root);
      });
    }
    for (const [uid, e] of units) if (!seen.has(uid)) remove(uid, e);
  }
  // Gold armband (management-rules §6, GM.look.armband) on the left upper arm of a lead / manager-rank worker. Before the
  // GLB is on it sits on the block arm; once dressed it moves onto the rig's LeftArm bone (sized back to metres there).
  const bandGeo = new THREE.CylinderGeometry(.085, .085, .09, 14, 1, true);
  const bandMat = new THREE.MeshStandardMaterial({ color: GM.look.armband, roughness: .35, metalness: .4, side: THREE.DoubleSide });
  const bandUp = new THREE.Vector3(0, 1, 0), bandDir = new THREE.Vector3(), bandScale = new THREE.Vector3();
  function armband(e, u) {
    const want = GM.look.armbandRanks.includes(rankOf(u));
    if (!want) { if (e.band) { e.band.removeFromParent(); e.band = null; } return; }
    const person = e.root;
    if (!e.band) {
      e.band = new THREE.Mesh(bandGeo, bandMat); e.band.raycast = () => {}; e.band.userData.onBlock = true;
      e.band.position.set(.4, 1.24, 0); e.band.scale.set(1.25, 1, 1.4); person.add(e.band); // block arms[1] = left
    }
    if (e.band.userData.onBlock && !e.band.userData.noBone && person.userData.dressed) {
      let bone = null;
      person.traverse(o => { if (!bone && o.isBone && /LeftArm$/.test(o.name)) bone = o; });
      const child = bone?.children.find(c => c.isBone);
      if (!bone || !child) { e.band.userData.noBone = true; return; } // a rig without the bone keeps it where the block arm was
      e.band.userData.onBlock = false;
      bone.add(e.band);
      bone.updateWorldMatrix(true, false); bone.getWorldScale(bandScale);
      const k = 1 / Math.max(1e-6, bandScale.x);
      bandDir.copy(child.position);
      e.band.position.copy(bandDir).multiplyScalar(.35);
      e.band.quaternion.setFromUnitVectors(bandUp, bandDir.normalize());
      e.band.scale.setScalar(k);
    }
  }
  function remove(uid, e) {
    release(e);
    e.band?.removeFromParent(); e.band = null;
    if (hiRing.parent === e.root) { e.root.remove(hiRing); hiRing.visible = false; }
    e.torsoMat?.dispose();
    e.label.dispose();
    e.up?.dispose();
    e.fee.dispose();
    e.eyeMat?.dispose();
    e.root.removeFromParent();
    if (e.kind === 'worker') disposeWorker(e); // robot parts are shared
    units.delete(uid);
  }
  // Per-unit GPU resources only. The dressed GLB is a SkeletonUtils clone that shares geometry / materials / textures
  // with the cached farm/worker.glb (and the cups share cafe/props.glb): disposing those would force a texture
  // re-upload + shader recompile for every other worker (hitch). Its skeleton (bone texture) is per clone.
  function disposeWorker(e) {
    const person = e.root;
    person.userData.dressed = true; // a GLB still loading must not dress a removed worker
    const geos = new Set(), mats = new Set();
    for (const b of e.blocks || []) b.traverse(o => {
      if (o.geometry && !o.geometry.userData.keep) geos.add(o.geometry);
      for (const m of o.material ? [o.material].flat() : []) if (!m.userData.keep) mats.add(m);
    });
    geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
    person.traverse(o => { if (o.isSkinnedMesh) o.skeleton?.dispose(); });
  }
  // Farm World 2.0: fields / buildings can stand anywhere on owned land, so a farm idle spot is checked against the
  // tile grid (no field or building footprint under it); else the nearest free standable spot on rings around it.
  const farmFree = (state, x, z) => !tileAt(state, x, z)?.occupant;
  function freeFarmSpot(state, spot) {
    if (farmFree(state, spot.x, spot.z) && canStand('farm', spot.x, spot.z)) return spot;
    for (let r = .75; r <= 8; r += .75) {
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6, x = spot.x + Math.cos(a) * r, z = spot.z + Math.sin(a) * r;
        if (farmFree(state, x, z) && canStand('farm', x, z)) return { x, z };
      }
    }
    return spot;
  }

  // ---------- claims ----------
  const claimed = key => claims.has(key);
  function claim(e, key) { claims.set(key, e.uid); (e.claims ||= []).push(key); }
  function release(e) { for (const k of e.claims || []) if (claims.get(k) === e.uid) claims.delete(k); e.claims = []; }
  function releaseKey(e, key) {
    if (claims.get(key) === e.uid) claims.delete(key);
    const i = e.claims ? e.claims.indexOf(key) : -1;
    if (i >= 0) e.claims.splice(i, 1);
  }
  function endJob(e) { release(e); e.job = null; e.cup.visible = false; e.cup2.visible = false; setStatus(e, ''); }
  function setStatus(e, s) {
    // A state that is not "ok" (tired, hungry, sulking, lunch, bench…) wins over the job icon: the player sees why.
    // An idle robot keeps its task icon up (auto mode: blue ring), so the player sees what it is set to.
    const shown = (!e.stopped && e.stIcon) || s;
    const idleTask = e.kind === 'robot' && !shown ? taskOf(e) : null;
    const key = idleTask ? `task:${idleTask}:${robotTask(e.u) === 'auto'}` : shown;
    if (e.status === s && e.labelKey === key) return;
    e.status = s; e.labelKey = key;
    const icon = ICON[shown] || (idleTask ? ICON[idleTask] : '');
    e.label.redraw(icon, !!idleTask && robotTask(e.u) === 'auto');
    e.label.sprite.visible = !!icon;
  }
  function showParts(e) {
    const P = e.parts; if (!P) return;
    const b = partTier(e.u, 'battery'), m = partTier(e.u, 'motor'), c = partTier(e.u, 'cooler'), f = partTier(e.u, 'frame');
    P.pack.visible = b > 0; if (b) { P.pack.material = tierMat[b]; P.pack.scale.set(1, .8 + b * .2, 1); }
    P.ring.visible = m > 0; if (m) P.ring.material = tierMat[m];
    P.tip.material = c ? tierMat[c] : mat.tip;          // cooler: antenna tip
    P.antenna.material = f ? tierMat[f] : mat.face;     // frame: antenna mast
  }

  // ---------- staff manager: state, pose, vitals (docs/design/staff-manager.md §3, §4, §9) ----------
  // Re-reads the unit's state (store values + time: lunch / overheat end) and reacts to changes: a unit that stops
  // working drops its job and claims; a stop ends with the resume flash; poses reset when it works again.
  function applyState(e, now) {
    const u = e.u, wasStopped = e.stopped, wasWorking = e.working;
    e.st = unitState(u, now);
    e.blocked = unitBlocked(u, now);
    e.bench = u.active === false;
    e.working = !e.bench && !e.blocked;
    e.stateK = e.blocked ? 1 : stateSpeedMul(u, now);
    e.pose = poseOf(e.st, e.bench, e.blocked, u.energy ?? 100);
    e.fix = showsFix(e.pose, true) ? quickFix(u, now) : null;
    e.stopped = e.pose === 'stop' ? u.stopped || { kind: e.st, fee: e.fix?.cost || 0 } : null;
    const icon = e.pose === 'stop' ? '' : stateIconKey(e.st, e.bench);
    // Bench units are not drawn (user rule 2026-11-07): they only show in the staff manager (Dự bị); back on shift they
    // reappear at their rest spot and walk to work. Hidden units are skipped by separation and tap targets too.
    e.root.visible = e.pose !== 'bench';
    if (e.stopped && !wasStopped) { endJob(e); e.moving = false; e.wander = null; e.feeSig = ''; }
    if (!e.stopped && wasStopped) resumed(e, wasStopped, now);
    if (wasWorking && !e.working) { endJob(e); e.stroll = null; e.path = null; e.feeSig = ''; if (!e.stopped) e.wander = null; }
    if (e.working && wasWorking === false) { e.fee.sprite.visible = false; e.feeSig = ''; }
    if (icon !== e.stIcon) { e.stIcon = icon; if (!e.stopped) setStatus(e, e.status); }
  }
  // Rest spot of the n-th bench unit (written into `out`): farm → a small grid beside the storehouse; café → along
  // the terrace edge (both checked with canStand), else the old idle spots.
  function benchSpot(state, zone, n, out) {
    if (zone === 'farm') {
      const silo = buildingsOf(state, 'silo')[0] || FIXED.silo;
      const sp = freeFarmSpot(state, { x: silo.x + 3.4 + (n % 3) * 1.1, z: silo.z - 1 + Math.floor(n / 3) * 1.1 });
      out.x = sp.x; out.z = sp.z;
      return out;
    }
    const tb = regionOf(state)?.buildings.find(b => b.type === 'terrace');
    if (tb) {
      const tr = footprint('terrace', tb.x, tb.z, tb.rot);
      for (const z of [tr[3] + .3, tr[1] - .3]) {
        const x = tr[2] - .6 - n * 1.05;
        if (x > tr[0] - .5 && canStand('shop', x, z)) { out.x = x; out.z = z; return out; }
      }
    }
    const sp = IDLE.shop(n + 4);
    out.x = sp.x; out.z = sp.z;
    return out;
  }
  // Seconds of work (a job in progress while working) / rest, batched into staff/vitals. A lunch / overheat timer
  // that ran out sends a batch at once (it clears it in the save); a batch that would change nothing is skipped.
  function tickUnit(e, dt, now, interval) {
    if (e.job && e.working) e.vWork += dt; else e.vRest += dt;
    if ((e.stT -= dt) <= 0) {
      e.stT = TICKS.stateSeconds;
      if (timerDue(e.u, now)) {
        const key = e.u.breakUntil ?? e.u.stopped?.until;
        if (e.dueKey !== key) { e.dueKey = key; flushVitals(e, true); }
      }
      applyState(e, now);
    }
    if ((e.vT += dt) >= interval) flushVitals(e, false);
  }
  const vitalsView = { robot: false, energy: 100, max: 100, morale: 100, funny: false, heat: 0 };
  // A batch that would change no vital is held back (no store churn) but its seconds are kept: the profile counts time
  // on shift, so held seconds go out with the next real batch, or on their own once SKIP_FLUSH seconds pile up.
  const SKIP_FLUSH = 30;
  function flushVitals(e, force) {
    let w = e.vWork, r = e.vRest;
    const n = e.vJobs;
    e.vT = 0; e.vWork = 0; e.vRest = 0; e.vJobs = 0;
    const u = e.u;
    if (!u) return;
    vitalsView.robot = e.kind === 'robot'; vitalsView.energy = u.energy ?? 100; vitalsView.max = energyMax(u);
    vitalsView.morale = u.morale ?? 0; vitalsView.funny = u.trait === 'funny'; vitalsView.heat = u.heat || 0;
    if (!force && vitalsNoop(vitalsView, w, n) && (e.heldS || 0) + w + r < SKIP_FLUSH) { e.heldS = (e.heldS || 0) + w + r; return; }
    r += e.heldS || 0; e.heldS = 0;
    act('staff/vitals', { uid: e.uid, work: Math.round(w * 10) / 10, rest: Math.round(r * 10) / 10, jobs: n });
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
    const step = Math.min(dist, SPEED[e.kind] * (e.type === 'brewBot' ? STAFF_SIM.brewBotWalkMul : 1) * unitSpeed(e.u) * gearWalk(e.u) * (e.speedK || 1) * (e.stateK || 1) * dt); // gearWalk: boots // stateK: tired ×0.6, hungry ×0.7
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
  // A spot a push / step-aside may move a unit to: an idle-legal spot (canStand), else a free nav cell. The nav check
  // is the realm's isWalkable when given, else a straight-line navigate() probe: a free target comes back as the last
  // waypoint as is, a blocked one snaps elsewhere (counters, walls, houses).
  function standable(e, x, z) {
    if (canStand(e.zone, x, z)) return true;
    if (isWalkable) return !!isWalkable(e.zone, x, z);
    if (!navigate) return false;
    const p = e.root.position;
    const path = navigate(p.x, p.z, x, z);
    const last = path && path[path.length - 1];
    return !!last && Math.abs(last.x - x) < 1e-3 && Math.abs(last.z - z) < 1e-3;
  }
  function tryPush(e, ox, oz) {
    const p = e.root.position, x = p.x + ox, z = p.z + oz;
    if (!standable(e, x, z)) return false;
    p.x = x; p.z = z;
    return true;
  }
  // Light separation: units never stand on each other (a small push, never a block, never into a blocked cell).
  // Two units walking head-on in a lane: the lower uid steps aside SIDE_STEP m (to its right, else its left).
  function separate(list) {
    for (let i = 0; i < list.length; i++) for (let k = i + 1; k < list.length; k++) {
      const A = list[i], B = list[k];
      if (A.zone !== B.zone || (A.stopped && B.stopped)) continue;
      const a = A.root.position, b = B.root.position;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0 && d < .6) { // a unit on a break stays put: the other one takes the whole push
        const push = (.6 - d) * .25 / d;
        if (!A.stopped) tryPush(A, -dx * push * (B.stopped ? 2 : 1), -dz * push * (B.stopped ? 2 : 1));
        if (!B.stopped) tryPush(B, dx * push * (A.stopped ? 2 : 1), dz * push * (A.stopped ? 2 : 1));
      }
      if (A.moving && B.moving && facing(a.x, a.z, A.yaw, b.x, b.z, B.yaw)) {
        const s = yieldsTo(A.uid, B.uid) === A.uid ? A : B;
        if (s.sideT > 0 || s.sideCool > 0) continue;
        const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw); // right of the heading
        const sign = standable(s, s.root.position.x + rx * SIDE_STEP, s.root.position.z + rz * SIDE_STEP) ? 1
          : standable(s, s.root.position.x - rx * SIDE_STEP, s.root.position.z - rz * SIDE_STEP) ? -1 : 0;
        if (!sign) { s.sideCool = 1; continue; }
        s.sideX = rx * sign; s.sideZ = rz * sign; s.sideT = SIDE_T; s.sideCool = 2;
      }
    }
  }

  // ---------- job selection ----------
  const near = (e, list) => {
    const p = e.root.position;
    let best = null, bd = Infinity;
    for (const it of list) { const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < bd) { bd = d; best = it; } }
    return best;
  };
  // A robot's task now: its set task, or the one its auto mode picked. Workers: null (they do everything).
  function taskOf(e) {
    if (e.kind !== 'robot') return null;
    const t = robotTask(e.u);
    return t === 'auto' ? (e.autoTask || ROBOT_TASKS[e.type]?.[0] || null) : t;
  }
  const rule = (e, name) => e.kind === 'worker' && hasRule(e.u, name);
  // Job types this unit takes (§6): a robot its one task, a worker its tasks (none = everything).
  const takes = (e, type) => (e.kind === 'robot' ? (taskOf(e) || type) === type : allows(e.u?.tasks, type));
  // Crop to plant: the manager's day plan for that field's lot (when one runs it, management-rules §3.4), else the
  // player's pick (robots, and workers from the 'playerCrop' level), else the best affordable one.
  function cropFor(state, e = null, plotId = null) {
    const planned = plotId ? planCropFor(state, plotId) : null;
    if (planned && seedCost(state, planned) <= state.player.coins) return planned;
    const active = e && e.kind === 'worker' && !rule(e, 'playerCrop') ? null : getActiveCrop();
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
    const roomForBeans = stored(state) < capacity(state); // all goods share the storehouse
    const canHarvest = takes(e, 'harvest'), canPlant = takes(e, 'plant');
    // Why it has nothing to do (shown over its head and in the Staff report): set below when no job is found.
    e.reason = null; e.reasonMs = 0;
    if (!plots.length) { e.reason = 'noPlots'; return null; }
    if (roomForBeans && canHarvest) {
      const ready = plots.filter(p => !claimed(`plot:${p.id}`) && r.plots[p.id] && plotState(state, p.id, now).stage === 'ready');
      // 'ripeFirst' (worker level): the plot ready the longest first (it would drop its fruit); else the nearest.
      const p = rule(e, 'ripeFirst') ? oldestReady(state, r, ready, now) : near(e, ready);
      if (p) return { type: 'harvest', plotId: p.id, ...plotSpot(p) };
    }
    if (canPlant && cropFor(state, e)) {
      const empty = plots.filter(p => !claimed(`plot:${p.id}`) && !r.plots[p.id]);
      const p = near(e, empty);
      if (p) return { type: 'plant', plotId: p.id, ...plotSpot(p) };
    }
    // Paid tending (staff/tend): water the growing plots, nearest first.
    if (e.kind === 'worker' && e.u?.water > 0 && takes(e, 'water')) {
      const growing = plots.filter(p => !claimed(`plot:${p.id}`) && r.plots[p.id] && !r.plots[p.id].watered && plotState(state, p.id, now).stage !== 'ready');
      const p = near(e, growing);
      if (p) return { type: 'water', plotId: p.id, ...plotSpot(p) };
    }
    let ready = 0, empty = 0, soonest = Infinity;
    for (const p of plots) {
      const pl = r.plots[p.id];
      if (!pl) { empty++; continue; }
      const st = plotState(state, p.id, now);
      if (st.stage === 'ready') ready++; else soonest = Math.min(soonest, st.remainingMs);
    }
    e.reason = ready && !roomForBeans && canHarvest ? 'storageFull'
      : empty && canPlant && !cropFor(state, e) ? 'noSeeds'
      : canPlant && !canHarvest && !empty ? 'fieldsFull'
      : 'growing';
    e.reasonMs = soonest === Infinity ? 0 : soonest;
    return null;
  }
  function oldestReady(state, r, list, now) {
    let best = null, bo = -Infinity;
    for (const p of list) { const pl = r.plots[p.id], over = now - pl.plantedAt - plotGrowMs(state, pl, p.id); if (over > bo) { bo = over; best = p; } }
    return best;
  }
  // Auto mode: how much work waits for each of a robot's tasks.
  function taskCounts(e, state, now) {
    const r = regionOf(state), c = {};
    if (!r) return c;
    if (e.zone === 'farm') {
      const plots = ownedPlots(state);
      c.harvest = stored(state) < capacity(state) ? plots.filter(p => r.plots[p.id] && plotState(state, p.id, now).stage === 'ready').length : 0;
      c.plant = cropFor(state, e) ? plots.filter(p => !r.plots[p.id]).length : 0;
    } else {
      const os = r.shop.orders || [];
      c.deliver = os.filter(o => isReady(o, now) && getSeat(o.id)).length;
      c.brew = os.filter(o => o.stage === 'taken').length;
      c.order = getQueued() != null && seatsUsed(state) < seatCount(state) ? 1 : 0;
    }
    return c;
  }
  // ---------- café: one reusable decision context for staff-brain (no per-search allocation of closures) ----------
  let ctxSelf = null, ctxNow = 0;
  const shopCtx = {
    post: null, orders: [], now: 0, carrying: null, queued: null, seatsFree: 0, brewSlots: 1, beans: 0, canBuyBeans: false,
    claimed: key => claims.has(key) && claims.get(key) !== ctxSelf?.uid,
    isHard: isHardDrink,
    hasSeat: id => !!getSeat(id),
    seatOf: id => getSeat(id),
    need: drink => DRINKS[drink]?.beans || 1,
    patience: o => (o.stage === 'taken' || o.stage === 'brewing' ? seatPatienceRatio(o, ctxNow) : 0),
    // Another working, jobless café unit whose post owns this job type will take it within a think tick.
    ownerIdle: type => { for (const u of units.values()) if (u !== ctxSelf && u.zone === 'shop' && u.working && !u.job && (u.kind === 'robot' ? taskOf(u) === type : u.post && POST_JOBS[u.post].includes(type) && allows(u.u?.tasks, type))) return true; return false; },
  };
  function fillCtx(e, state, now) {
    const r = regionOf(state);
    ctxSelf = e; ctxNow = now;
    shopCtx.post = e.post || 'allRounder';
    shopCtx.only = taskOf(e);                                  // robots: one task
    shopCtx.onlyAny = e.kind === 'worker' && e.u?.tasks?.length ? e.u.tasks : null; // workers: their tasks (§6)
    shopCtx.urgent = e.kind === 'worker' && rule(e, 'urgent');  // robots + low-level workers: first in line
    shopCtx.canHard = canBrew(e.u, 'latte');   // hard drinks: Lv5 workers only (the player always)
    shopCtx.orders = r?.shop.orders || [];
    shopCtx.now = now;
    shopCtx.carrying = getCarrying();
    shopCtx.queued = getQueued();
    shopCtx.seatsFree = seatCount(state) - seatsUsed(state);
    shopCtx.brewSlots = brewSlots(state);
    shopCtx.beans = state.inventory.beans;
    const q = shopCtx.queued != null ? beanBuyQuote(state, 1) : null; // only needed for the order rule
    shopCtx.canBuyBeans = !!q && !q.error && !q.free;
    return shopCtx;
  }
  let noBeansSaid = false; // "Hết hạt!" once per dry spell, team-wide
  function shopJob(e, state, now) {
    if (regionOf(state)?.shop.pausedAt) { e.block = null; e.reason = 'paused'; return null; } // café paused while the player is on the farm
    const ctx = fillCtx(e, state, now);
    const job = pickShopJob(ctx);
    if (!job) { restock(e, state, ctx); hardLine(e, state, ctx); }
    // The dry-spell flag follows the queue state, not this unit's job (another unit's job must not re-arm the line);
    // 'noQueue' (next customer still walking up) keeps it too.
    const ob = orderBlock(ctx);
    if (ob !== 'noBeans' && ob !== 'noQueue') noBeansSaid = false;
    const block = job ? null : ob;
    e.reason = job ? null : regionOf(state)?.shop.pausedAt ? 'paused' : ctx.canHard === false && ctx.orders.some(o => o.stage === 'taken' && isHardDrink(o.drink)) ? 'hard' : ob === 'noQueue' ? 'noCustomers' : ob || 'noWork';
    // ☕❌ on the unit that would take the order (cashier / all-rounder); the others just wait at their posts.
    e.block = block === 'noBeans' && ctxTakes(ctx, 'order') ? 'noBeans' : null;
    if (e.block && !noBeansSaid && say && say(e.root, hasKey(NO_BEANS_LINE) ? NO_BEANS_LINE : 'Hết hạt rồi! ☕❌', { tone: 'angry', priority: 2 })) noBeansSaid = true; // only once actually shown
    ctxSelf = null;
    return job;
  }
  // Pads: a still unit on a pad holds it (and the player standing near one): others use the spot beside it.
  function padHeld(e, key) {
    for (const u of units.values()) if (u !== e && u.zone === 'shop' && u.atPad === key) return true;
    const pl = getPlayerPos(), P = pads[key];
    return !!pl && Math.hypot(pl.x - P.x, pl.z - P.z) < .8;
  }
  function padSpot(e, key, out = {}) {
    const P = pads[key];
    out.x = padHeld(e, key) ? P.x + PAD_SIDE : P.x; out.z = P.z;
    return out;
  }
  function startJob(e, job) {
    e.speedK = 1;
    e.waitT = 0;
    e.idleT = 0; e.stroll = null;
    if (e.zone === 'shop') {
      const station = job.type === 'deliver' ? null : job.type;
      const spot = padSpot(e, job.type === 'order' ? 'order' : 'brew');
      e.job = { type: job.type, orderId: job.orderId ?? null, station, step: job.type === 'deliver' ? 'pickup' : null, cups: null, x: spot.x, z: spot.z, work: 0, arrived: false };
      if (job.type === 'deliver') claim(e, `order:${job.orderId}`);
      if (station) claim(e, `station:${station}`);
      setStatus(e, job.type);
      return;
    }
    e.job = { ...job, work: 0, arrived: false };
    if (job.plotId) claim(e, `plot:${job.plotId}`);
    if (job.orderId != null) claim(e, `order:${job.orderId}`);
    if (job.station) claim(e, `station:${job.station}`);
    setStatus(e, job.type);
  }
  const findOrder = (state, id) => { const os = regionOf(state)?.shop.orders; if (!os || id == null) return null; for (const o of os) if (o.id === id) return o; return null; };
  // A cup still worth carrying: its order is ready, not in the player's hand, and its customer still sits there.
  const cupValid = (state, id, now) => { const o = findOrder(state, id); return isReady(o, now) && getCarrying() !== id && !!getSeat(id); };

  // ---------- doing the work (checked first, dispatched straight to the store: no toasts) ----------
  const act = (type, payload) => store.dispatch(type, payload);
  // Mistakes (workers only): roll per job; the line is said in the worker's voice (trait), at most once per 8 s.
  const oops = (e, kind) => Math.random() < mistakeChance(e.u, kind);
  function oopsLine(e, kind) {
    const now = performance.now();
    if (say && !(now - (e.oopsAt || 0) < 8000)) {
      e.oopsAt = now;
      const trait = e.u?.trait || 'diligent', key = `realm.staff.oops.${kind}.${trait}`;
      say(e.root, hasKey(key) ? key : `realm.staff.oops.${kind}.diligent`, { priority: 1, tone: trait === 'funny' ? 'happy' : 'normal' });
    }
    return true;
  }
  // Lv5 café worker ('restock'): the next taken cup lacks beans → buy a pack (as the player would), team-wide every 8 s.
  let restockAt = 0;
  function restock(e, state, ctx) {
    if (!rule(e, 'restock') || performance.now() - restockAt < 8000) return;
    const taken = mostUrgent(ctx.orders, o => o.stage === 'taken', ctx.now);
    if (!taken || state.inventory.beans >= (DRINKS[taken.drink]?.beans || 1)) return;
    const q = beanBuyQuote(state, BEANS.buyPack);
    if (q.error || q.free) return;
    restockAt = performance.now();
    if (act('shop/buyBeans', { roll: Math.random() }).ok && say) say(e.root, 'realm.staff.restock', { tone: 'happy', priority: 1 });
  }
  // A hard drink waits and this unit may not brew it: say so (robots report, workers in their voice), every 20 s.
  function hardLine(e, state, ctx) {
    if (!say || ctx.canHard !== false || !ctxTakes(ctx, 'brew')) return;
    if (!ctx.orders.some(o => o.stage === 'taken' && isHardDrink(o.drink))) return;
    const now = performance.now();
    if (now - (e.hardAt || 0) < 20000) return;
    e.hardAt = now;
    say(e.root, e.kind === 'robot' ? 'realm.staff.hardRobot' : 'realm.staff.hardWorker', { priority: 2 });
  }
  // Lv5 farm worker ('twoPlots'): also harvests a ready plot next to the one just harvested, in the same trip.
  function secondPlot(e, firstId) {
    const s = store.state, r = regionOf(s), first = plotOf(s, firstId), now = Date.now();
    if (!r || !first || stored(s) >= capacity(s)) return;
    let best = null, bd = 3.5;
    for (const p of ownedPlots(s)) {
      if (p.id === firstId || claimed(`plot:${p.id}`) || !r.plots[p.id] || plotState(s, p.id, now).stage !== 'ready') continue;
      const d = Math.hypot(p.x - first.x, p.z - first.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best && act('farm/harvest', { plotId: best.id, uid: e.uid, unripe: oops(e, 'unripe') }).ok) {
      vfx?.burst('leaf', { x: best.x, y: .5, z: best.z }, { count: 6 });
      workDone(e);
    }
  }
  // Another seated customer's stand spot (≥ 2 m from the real first stop), for the wrong-table detour.
  function wrongSpot(cups) {
    const first = cups[0], ids = new Set(cups.map(c => c.id));
    for (const o of regionOf(store.state)?.shop.orders || []) {
      if (ids.has(o.id)) continue;
      const seat = getSeat(o.id);
      if (!seat) continue;
      const sp = standSpot(seat);
      if (Math.hypot(sp.x - first.x, sp.z - first.z) >= 2) return sp;
    }
    return null;
  }
  // Finished jobs are batched into staff/workDone (3 at a time, or flushed after a quiet while in update): worker XP,
  // and every unit's book counts the jobs. A robot also counts the job for its wear (vitals) and may jam on it.
  function workDone(e) {
    if (e.job?.type && e.xpN && e.xpTask && e.xpTask !== e.job.type) flushXp(e); // one job type per batch (history row)
    e.xpTask = e.job?.type || e.xpTask || null;
    e.xpN = (e.xpN || 0) + 1; e.xpT = 0;
    if (e.kind === 'robot') { e.vJobs++; if (Math.random() < jamChance(e.u)) act('staff/jam', { uid: e.uid }); }
    if (e.xpN >= 3) flushXp(e);
  }
  function flushXp(e) { if (!e.xpN) return; const n = e.xpN; e.xpN = 0; act('staff/workDone', { uid: e.uid, n, task: e.xpTask || null }); }
  function finish(e, state, now) {
    const j = e.job;
    const r = regionOf(state);
    if (j.type === 'harvest') {
      if (r?.plots[j.plotId] && plotState(state, j.plotId, now).stage === 'ready' && stored(state) < capacity(state)) {
        const unripe = oops(e, 'unripe');
        if (act('farm/harvest', { plotId: j.plotId, unripe, uid: e.uid }).ok) {
          if (rule(e, 'twoPlots')) secondPlot(e, j.plotId);
          if (unripe) oopsLine(e, 'unripe');
          const s = store.state, crop = e.kind === 'worker' && takes(e, 'plant') ? cropFor(s, e, j.plotId) : null; // a robot only harvests; a worker replants only when planting is its task too
          workDone(e);
          if (crop && !regionOf(s)?.plots[j.plotId]) { e.job = { type: 'plant', plotId: j.plotId, x: j.x, z: j.z, work: 0, arrived: true }; setStatus(e, 'plant'); return; }
        }
      }
    } else if (j.type === 'plant') {
      const crop = cropFor(state, e, j.plotId);
      if (crop && r && !r.plots[j.plotId] && plotOf(state, j.plotId) && act('farm/plant', { plotId: j.plotId, crop, uid: e.uid, crooked: oops(e, 'crooked') && oopsLine(e, 'crooked') }).ok) workDone(e);
      e.think = e.kind === 'robot' || rule(e, 'quick') ? 0 : 1.2; // slow-witted workers stand a moment before the next job
    } else if (j.type === 'water') {
      if (act('farm/water', { plotId: j.plotId, uid: e.uid }).ok) { vfx?.burst('sparkle', { x: j.x, y: .6, z: j.z - 1.2 }, { count: 8 }); workDone(e); }
      e.think = 0;
    } else if (j.type === 'order') {
      const queued = getQueued();
      if (queued != null && seatsUsed(state) < seatCount(state) && act('shop/takeOrder', { orderId: queued, uid: e.uid }).ok) workDone(e);
      e.think = 0; // chain: the all-rounder's next pick is brewing what it just took
    } else if (j.type === 'brew') {
      const orders = r?.shop.orders || [];
      const taken = mostUrgent(orders, o => o.stage === 'taken' && canBrew(e.u, o.drink), now);
      if (taken && orders.filter(o => o.stage === 'brewing').length < brewSlots(state) && state.inventory.beans >= (DRINKS[taken.drink]?.beans || 1)
        && act('shop/brew', { orderId: taken.id, uid: e.uid }).ok) {
        workDone(e);
        // Chain: a quick brew → stay at the pad and carry it (the cup is claimed, so nobody else / the player takes it).
        const o = findOrder(store.state, taken.id);
        if (o && rule(e, 'chain') && waitsForBrew(e.post || 'allRounder', o.brewMs) && !claims.has(`order:${o.id}`) && getSeat(o.id)) {
          releaseKey(e, 'station:brew');
          claim(e, `order:${o.id}`);
          Object.assign(j, { type: 'deliver', step: 'wait', orderId: o.id, station: null, cups: null, work: 0, arrived: true });
          setStatus(e, 'brew');
          return;
        }
      }
      e.think = 0;
    } else if (j.type === 'deliver') {
      if (j.step === 'pickup') {
        const seat = cupValid(state, j.orderId, now) && getSeat(j.orderId);
        if (seat) {
          const p = e.root.position;
          const first = standSpot(seat);
          const cups = j.cups || (j.cups = []);
          cups.length = 0;
          cups.push({ id: j.orderId, x: first.x, z: first.z });
          // Two cups (workers only): a second ready cup whose customer sits within 4 m of the first one.
          if (rule(e, 'twoCups')) {
            const ctx = fillCtx(e, state, now);
            const o2 = secondCup(ctx, j.orderId, seat);
            ctxSelf = null;
            const seat2 = o2 && getSeat(o2.id);
            if (seat2 && !claims.has(`order:${o2.id}`)) { claim(e, `order:${o2.id}`); const s2 = standSpot(seat2); cups.push({ id: o2.id, x: s2.x, z: s2.z }); }
          }
          nearestFirst(p, cups);
          // Mistake: heads for the wrong table first (another seated customer's spot), then the right one.
          if (oops(e, 'wrongTable')) { const w = wrongSpot(cups); if (w) cups.unshift({ id: null, fake: true, x: w.x, z: w.z }); }
          Object.assign(j, { step: 'carry', orderId: cups[0].id, x: cups[0].x, z: cups[0].z, work: 0, arrived: false });
          e.cup.visible = true; e.cup2.visible = cups.filter(c => !c.fake).length > 1;
          setStatus(e, 'deliver');
          return;
        }
      } else if (j.step === 'carry' && j.cups?.length) {
        const c = j.cups.shift();
        if (c.fake) { oopsLine(e, 'wrongTable'); act('staff/mistake', { uid: e.uid, kind: 'wrongTable' }); if (nextCup(e, store.state, Date.now())) return; endJob(e); e.think = 0; return; }
        // Mistake: the cup drops right at the table → the order goes back to brewing (beans of one cup lost).
        if (cupValid(state, c.id, now) && oops(e, 'spill')) { if (act('shop/spill', { orderId: c.id, uid: e.uid }).ok) { oopsLine(e, 'spill'); vfx?.burst('steam', e.root.position, { count: 6 }); } }
        else if (cupValid(state, c.id, now) && act('shop/serve', { orderId: c.id, uid: e.uid }).ok) workDone(e); // uid: the cup's coins go into its book
        releaseKey(e, `order:${c.id}`);
        if (nextCup(e, store.state, Date.now())) return;
      }
      e.think = 0; // back to the post / next job at once (via the order pad if someone is queued: posts decide)
    }
    endJob(e);
  }
  // Carry: drop cups whose order vanished / the player took; aim at the next stop. False when nothing is left.
  function nextCup(e, state, now) {
    const j = e.job, cups = j?.cups;
    if (!cups) return false;
    while (cups.length && !cups[0].fake && !cupValid(state, cups[0].id, now)) releaseKey(e, `order:${cups.shift().id}`);
    if (cups.length && cups[0].fake && !cups.some(c => !c.fake)) cups.length = 0; // real cups gone: no detour
    if (!cups.length) return false;
    const c = cups[0];
    if (j.orderId !== c.id || j.x !== c.x || j.z !== c.z) Object.assign(j, { orderId: c.id, x: c.x, z: c.z, work: 0, arrived: false });
    e.cup.visible = true; e.cup2.visible = cups.filter(c => !c.fake).length > 1;
    return true;
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
      draw(kind, fee, ok) { drawBreak(canvas.getContext('2d'), FEE_W, FEE_H, kind, fee, ok, t((BUBBLE[kind] || BUBBLE.phone).label)); map.needsUpdate = true; },
      dispose() { sprite.removeFromParent(); map.dispose(); material.dispose(); },
    };
  }
  // Back to work after a stop (paid fix, knock, or an overheat that cooled down by itself: no coin burst then).
  function resumed(e, prev = null, now = Date.now()) {
    e.workT = 0;
    e.phone.visible = false;
    e.fee.sprite.visible = false;
    e.root.rotation.x = 0;
    if (e.kind === 'robot') { e.body.position.x = 0; e.body.rotation.z = 0; } // a worker's body is its root: never move it
    if (e.eyeMat) e.eyeMat.color.set(0x6ff0ff);
    if (e.torsoMat) { e.torsoMat.emissive.setHex(0x000000); e.torsoMat.emissiveIntensity = 1; }
    e.flash = 1.1;
    e.knockN = 0;
    setStatus(e, e.kind === 'robot' ? 'charged' : '');
    vfx?.burst('sparkle', e.root.position, { count: 12 });
    const selfCooled = prev?.kind === 'overheat' && Number.isFinite(prev.until) && now >= prev.until;
    if (!selfCooled && prev?.kind !== 'jam') vfx?.burst('coin', e.root.position);
  }
  // The 🪙 bubble with the paid fix (e.fix, else the stop's fee) over a unit that cannot work.
  function fixBubble(e, time, kind) {
    const fee = e.fix ? e.fix.cost : e.stopped?.fee || 0;
    e.fee.sprite.visible = true;
    const ok = store.state.player.coins >= fee, sig = `${kind}|${fee}|${ok}`;
    if (sig !== e.feeSig) { e.feeSig = sig; e.fee.draw(kind, fee, ok); }
    e.fee.sprite.center.y = -Math.abs(Math.sin(time * 3.2 + e.phase)) * .12; // gentle bounce in screen space
  }
  // A unit on a break: no job; worker looks at the phone; a robot slumps (battery: red blinking eye), smokes with a red
  // body (overheat) or jitters in place (jam; a knock jolts it harder).
  function onBreak(e, time, dt = 0) {
    const b = e.stopped;
    e.moving = false;
    e.tendOffer = false;
    fixBubble(e, time, b.kind);
    if (e.kind === 'robot' && (b.kind === 'overheat' || b.kind === 'jam')) {
      e.body.rotation.x *= 1 - dampK(6, dt || .016);
      e.body.position.y = .2;
      if (b.kind === 'overheat') {
        e.torsoMat?.emissive.setHex(0xff2a10);
        if (e.torsoMat) e.torsoMat.emissiveIntensity = .35 + Math.abs(Math.sin(time * 4)) * .35;
        if (dt && (e.smokeT -= dt) <= 0) { e.smokeT = SMOKE_EVERY; vfx?.burst('steam', smokeAt.set(e.root.position.x, 1.7, e.root.position.z), { count: 2, color: 0x5d5a57 }); }
      } else {
        if (e.jolt > 0) e.jolt -= dt;
        e.body.position.x = Math.sin(time * 47 + e.phase) * (e.jolt > 0 ? .09 : .025);
        e.body.rotation.z = Math.sin(time * 31) * (e.jolt > 0 ? .12 : .03);
      }
      setStatus(e, b.kind);
    } else if (b.kind === 'battery' || e.kind === 'robot') {
      e.body.position.y = .04;
      e.body.rotation.x = .38;
      const on = Math.sin(time * 6) > 0;
      e.eyeMat?.color.set(on ? 0xff3b30 : 0x3a0d0b);
      setStatus(e, 'battery');
      e.label.sprite.material.opacity = on ? 1 : .35;
    } else {
      e.phone.visible = true;
      e.root.rotation.x = .1; // head down over the phone
      // On the farm a slacker wanders around with the phone (the 🪙 bubble follows): "đi lung tung".
      if (e.zone === 'farm' && dt) { wander(e, dt, time); e.speedK = .4; }
      const cycle = (time + e.phase) % 6;
      setStatus(e, cycle < 4 ? 'phone' : cycle < 5 ? 'giggle' : 'zzz');
    }
  }

  // Idle: roam naturally — pick a free walkable spot nearby in the unit's zone (realm canStand: café floor / terrace
  // edges, field paths; never fields, counters, queue, seat stand spots or the player's pads), stroll there at a
  // relaxed pace, pause 1–3 s looking around, repeat. No "go back to the home spot".
  function wander(e, dt, time) {
    const w = e.wander;
    if (w && !w.reached && e.zone === 'farm' && !farmFree(store.state, w.x, w.z)) e.wander = null; // a field / building was placed there
    else if (w && !w.reached) {
      e.speedK = .55;
      if (moveTo(e, w.x, w.z, dt)) { w.reached = true; w.pause = .6 + Math.random() * 1.2; e.moving = false; w.look = e.yaw; }
      return;
    }
    if (w && (w.pause -= dt) > 0) { e.moving = false; e.yaw = w.look + Math.sin(time * 1.3 + e.phase) * .6; return; } // look around
    const p = e.root.position;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (!canStand(e.zone, x, z) || (e.zone === 'farm' && !farmFree(store.state, x, z)) || claimed(`spot:${Math.round(x)},${Math.round(z)}`)) continue;
      e.wander = { x, z, reached: false };
      return;
    }
    // Nowhere nice nearby (e.g. just after a job in a tight corner): drift back towards the zone's area.
    const home = IDLE[e.zone](e.slot);
    const drift = { x: home.x + (Math.random() - .5) * 4, z: home.z + (Math.random() - .5) * 4 };
    const spot = e.zone === 'farm' ? freeFarmSpot(store.state, drift) : drift;
    e.wander = { x: spot.x, z: spot.z, reached: false };
  }

  // ---------- café posts: idle at the post, micro-idles, pad holding, urgency ----------
  // Post spot (written into e.home, no allocation): cashier → order pad, barista → brew pad, all-rounder → brew pad
  // while something is taken / brewing else the order pad, runners → a small row on the pickup side of the brew pad.
  function postSpot(e, state) {
    const h = e.home;
    if (e.post === 'runner') {
      const k = e.runnerIdx;
      h.x = pads.brew.x + 1.7 + (k % 3) * .9; h.z = pads.brew.z + .25 + Math.floor(k / 3) * .9;
      return h;
    }
    let key = e.post === 'barista' ? 'brew' : 'order';
    if (e.post !== 'cashier' && e.post !== 'barista') {
      for (const o of regionOf(state)?.shop.orders || []) if (o.stage === 'taken' || o.stage === 'brewing') { key = 'brew'; break; }
    }
    return padSpot(e, key, h);
  }
  function idleAtPost(e, dt, time, state) {
    e.idleT += dt;
    const s = e.stroll;
    if (s) {
      if (!s.reached) {
        e.speedK = .55;
        if (moveTo(e, s.x, s.z, dt)) { s.reached = true; s.pause = .6 + Math.random() * 1.2; s.look = e.yaw; e.moving = false; }
        return;
      }
      if ((s.pause -= dt) > 0) { e.moving = false; e.yaw = s.look + Math.sin(time * 1.3 + e.phase) * .6; return; }
      e.stroll = null; e.idleT = Math.random() < STROLL_CHAIN ? STROLL_AFTER + 1 : 0; // stroll on, or walk back to the post
    }
    const h = postSpot(e, state);
    if (e.idleT > STROLL_AFTER) {
      e.idleT = 0;
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * (STROLL_R - 1.2);
        const x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r;
        if (canStand(e.zone, x, z)) { e.stroll = { x, z, reached: false, pause: 0, look: 0 }; return; }
      }
    }
    e.speedK = .85;
    const p = e.root.position;
    if (e.path && !e.path.length && Math.hypot(p.x - h.x, p.z - h.z) > .35) e.path = null; // pushed off the spot: walk back
    if (!moveTo(e, h.x, h.z, dt)) return;
    e.moving = false;
    // Micro-idle facing the counter: a slow glance most of the time, now and then a look over the shoulder or a quick
    // "wipe the counter" wiggle.
    const c = (time + e.phase * 1.7) % 9;
    e.yaw = FACE_COUNTER + (c < 1.4 ? Math.sin(c * 2.2) * 1.1 : c > 6 && c < 7.2 ? Math.sin(time * 11) * .14 : Math.sin(time * .6 + e.phase) * .2);
  }
  // Which pad this unit holds now (a still unit on it).
  function trackPad(e) {
    e.atPad = null;
    if (e.zone !== 'shop' || e.moving) return;
    const p = e.root.position;
    if (Math.hypot(p.x - pads.order.x, p.z - pads.order.z) < PAD_HOLD) e.atPad = 'order';
    else if (Math.hypot(p.x - pads.brew.x, p.z - pads.brew.z) < PAD_HOLD) e.atPad = 'brew';
  }
  // Farm worker with every field growing: a 🪙 "water" bubble (tap → staff/tend: it waters TEND.plots plots).
  function tendBubble(e) {
    const on = e.kind === 'worker' && e.reason === 'growing' && !(e.u?.water > 0);
    if (on !== !!e.tendOffer) { e.tendOffer = on; e.feeSig = ''; }
    e.fee.sprite.visible = on;
    if (!on) return;
    const ok = store.state.player.coins >= TEND.fee, sig = `tend|${ok}`;
    if (sig !== e.feeSig) { e.feeSig = sig; e.fee.draw('tend', TEND.fee, ok); }
  }
  // Robot without a job: auto mode re-picks its task every ROBOT_AUTO.autoSeconds (says so when it switches); a fixed
  // task with nothing to do → a report-style line now and then, so the player sees the setting is off.
  function robotIdle(e, dt, state, now) {
    if (robotTask(e.u) === 'auto') {
      if ((e.autoT = (e.autoT ?? 0) - dt) > 0) return;
      e.autoT = ROBOT_AUTO.autoSeconds;
      const tasks = ROBOT_TASKS[e.type] || [];
      const next = autoTask(tasks, taskCounts(e, state, now), e.autoTask);
      if (e.autoTask && next !== e.autoTask && say) say(e.root, t('realm.staff.robotSwitch', { task: t(`hud.staff.task.${next}`) }), { priority: 1 });
      e.autoTask = next;
      if (e.zone === 'shop') e.post = ROBOT_POST[next] || 'runner';
      return;
    }
    if ((e.waitT = (e.waitT || 0) + dt) < 25) return;
    e.waitT = 0;
    const task = taskOf(e);
    if (say && !(taskCounts(e, state, now)[task] > 0)) say(e.root, t('realm.staff.robotWait', { task: t(`hud.staff.task.${task}`) }), { priority: 1 });
  }
  // 25 % faster when the job's customer is down to ≤ 30 % seat patience.
  function jobUrgency(state, j, now) {
    const o = findOrder(state, j.orderId);
    return o && (o.stage === 'taken' || o.stage === 'brewing') ? urgencyK(seatPatienceRatio(o, now)) : 1;
  }

  // Off shift or blocked (not stopped): bench units walk to their rest spot and idle there; a blocked unit stays put
  // (sits at lunch / exhausted, sulks turned away, else just stands) under its 🪙 fix bubble.
  function offShift(e, dt, time) {
    if (e.pose === 'bench') {
      e.fee.sprite.visible = false;
      const b = e.benchSpot;
      e.speedK = .7;
      if (!moveTo(e, b.x, b.z, dt)) return;
      e.moving = false;
      e.yaw = FACE_COUNTER + Math.PI + Math.sin(time * .45 + e.phase) * .5; // looks out over the farm / street
      return;
    }
    e.moving = false;
    if (e.pose === 'sulk') e.yaw = FACE_AWAY + Math.sin(time * .7 + e.phase) * .12;
    if (e.fix) fixBubble(e, time, e.st); else e.fee.sprite.visible = false;
  }
  // Worker sitting (lunch, exhausted): body low, legs forward; back up when it stands again.
  function sitPose(e, dt) {
    if (e.kind !== 'worker') return;
    const sit = e.pose === 'sit', p = e.root.position, goal = sit ? SIT_Y : 0;
    if (p.y !== goal) p.y = Math.abs(p.y - goal) < .005 ? goal : p.y + (goal - p.y) * dampK(8, dt || .016);
    const legs = e.root.userData.legs;
    if (legs && sit !== !!e.sitting) { legs[0].rotation.x = legs[1].rotation.x = sit ? -1.3 : 0; }
    e.sitting = sit;
  }

  // Team timers (seconds of play): bench upkeep, rival visits per zone, MVP; rival/resolve once the poach time is up.
  const timers = { upkeep: 0, rival: { farm: 0, shop: 0 }, mvp: 0, resolved: null, started: false, boss: 0, gmThink: 0, gmPay: 0, gmRival: 0, clock: 0, loan: 0 };
  const workersIn = { farm: 0, shop: 0 };
  const ZONES = ['farm', 'shop'];
  function teamTimers(dt, state, now) {
    // Played clock (management-rules §4.1): only time the game really runs in front moves it (this loop stops when the
    // tab is hidden / the game is paused). Tenure, loan terms and the income series run on it.
    // Tenure, loan terms, the income series and the inbox (task deadlines, reminders, penalties) run on it.
    if ((timers.clock += dt) >= CLOCK.tickSeconds) { const ms = Math.round(timers.clock * 1000); timers.clock = 0; act('clock/tick', { ms }); }
    if ((timers.loan += dt) >= CLOCK.loanTickSeconds) { timers.loan = 0; if (state.loans?.length) act('loan/tick', {}); }
    gmTimers(dt, state);
    if (!units.size) return;
    // The first call only starts the reducer's clock (once per session, so a failed call cannot repeat every frame).
    if ((timers.upkeep += dt) >= TICKS.upkeepSeconds || (!state.staff.upkeepAt && !timers.started)) { timers.upkeep = 0; timers.started = true; act('staff/upkeep', {}); }
    for (const zone of ZONES) {
      if (!workersIn[zone]) { timers.rival[zone] = 0; continue; }
      if ((timers.rival[zone] += dt) < RIVAL.everyMinutes * 60) continue;
      timers.rival[zone] = 0;
      if (!workerPoach(state)) act('rival/visit', { zone, roll: Math.random() });
    }
    // a rival's offer that ran out is resolved by the inbox (clock/tick expires the poach task on played time)
    if ((timers.mvp += dt) >= BOOKS.mvpMinutes * 60) { timers.mvp = 0; act('staff/mvp', {}); }
    if ((timers.boss += dt) >= CAREER.manager.careEverySeconds) { timers.boss = 0; leaderRound(now); softwareRound(now); }
  }
  // General manager (docs/design/general-manager.md): thinks every gmThinkSeconds (by skill), paid about every minute,
  // a rival may come for it every GM.poach.everyMinutes. Runs whether or not any staff is drawn.
  function gmTimers(dt, state) {
    const gm = gmOf(state);
    if (!gm) { timers.gmThink = timers.gmPay = timers.gmRival = 0; return; }
    if ((timers.gmThink += dt) >= gmThinkSeconds(gm)) { timers.gmThink = 0; act('gm/think', { roll: Math.random() }); }
    if ((timers.gmPay += dt) >= 60 || !state.gm.payAt) { timers.gmPay = 0; act('gm/payroll', {}); }
    if ((timers.gmRival += dt) >= GM.poach.everyMinutes * 60) { timers.gmRival = 0; act('gm/rivalVisit', { roll: Math.random() }); }
    // a rival's offer that ran out is resolved by the inbox (clock/tick)
  }
  // Robot software packs (step 4): autoCharge pays the recharge itself when the battery is empty (your coins);
  // autoUnjam knocks itself free once jammed for SOFTWARE.packs.autoUnjam.seconds.
  function softwareRound(now) {
    for (const e of units.values()) {
      const u = e.u;
      if (!u || e.kind !== 'robot' || !u.stopped) continue;
      if (u.stopped.kind === 'battery' && hasSoftware(u, 'autoCharge') && !careError(store.state, u, 'recharge', now)) act('staff/care', { uid: u.uid, kind: 'recharge', by: u.uid });
      else if (u.stopped.kind === 'jam' && hasSoftware(u, 'autoUnjam') && now - (u.stopped.at || now) >= SOFTWARE.packs.autoUnjam.seconds * 1000) act('staff/care', { uid: u.uid, kind: 'knock', by: u.uid });
    }
  }
  // Career effects (docs/design/staff-profile.md step 3): a working lead / manager sends phone slackers back (free) after
  // CAREER.lead.nudgeSeconds; a manager buys coffee / food for tired / hungry workers of its zone (your coins).
  function leaderRound(now) {
    for (const zone of ZONES) {
      const bosses = zoneLeaders(store.state, zone, now);
      if (!bosses.length) continue;
      const manager = bosses.find(b => rankOf(b) === 'manager');
      for (const e of units.values()) {
        const u = e.u;
        if (!u || e.zone !== zone || e.kind !== 'worker' || bosses.some(b => b.uid === u.uid)) continue;
        if (nudgeDue(store.state, u, now)) { act('staff/nudge', { uid: u.uid }); continue; }
        if (!manager || !u.active || u.stopped) continue;
        const need = needs(u);
        const kind = need.hungry ? 'food' : need.tired ? 'coffee' : null;
        if (kind && !careError(store.state, u, kind, now)) act('staff/care', { uid: u.uid, kind, by: manager.uid });
      }
    }
  }

  // Worker leg swing while moving (dressPerson reads the stride for the walk animation; a stride that stops changing = idle).
  function swingLegs(e, dt) {
    const legs = e.root.userData.legs;
    if (legs && e.moving && !e.sitting) { e.walk += dt * 9 * (e.speedK || 1); legs[0].rotation.x = Math.sin(e.walk) * .6; legs[1].rotation.x = -Math.sin(e.walk) * .6; }
  }
  // Smoothly turns the body towards e.yaw (the heading set by moveTo / looking around).
  function turnToYaw(e, dt) {
    let d = e.yaw - e.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    e.root.rotation.y += d * dampK(10, dt);
  }

  // Per frame. state = store.state, now = Date.now(); time = realm clock.
  function update(dt, time, state, now) {
    const paused = isPaused() || state.story.phase !== 'play' || !state.world.currentRegion;
    const interval = vitalsInterval(units.size);
    workersIn.farm = workersIn.shop = 0;
    if (hiRing.visible) {
      if ((hiT -= dt) <= 0) { hiRing.visible = false; hiRing.removeFromParent(); }
      else { const k = 1 + Math.sin(time * 6) * .08; hiRing.scale.set(k, 1, k); hiMat.opacity = Math.min(1, hiT) * .9; hiRing.position.y = .06 - (hiRing.parent?.position.y || 0); } // stays on the ground under a sitting worker
    }
    for (const e of units.values()) {
      if (e.kind === 'worker') workersIn[e.zone]++;
      if (!paused) tickUnit(e, dt, now, interval);
      sitPose(e, dt);
      // A phone slacker on the farm still wanders: it must walk (legs) and face where it goes like everyone else,
      // or it slides sideways in its idle pose.
      if (e.stopped) { onBreak(e, time, paused ? 0 : dt); if (e.kind === 'worker') swingLegs(e, dt); turnToYaw(e, dt); trackPad(e); continue; }
      if (e.label.sprite.material.opacity !== 1) e.label.sprite.material.opacity = 1;
      if (e.flash > 0 && (e.flash -= dt) <= 0) setStatus(e, '');
      // Visuals: robot bob, worker leg swing while moving (dressPerson reads it for the walk anim).
      if (e.kind === 'robot') {
        e.body.rotation.x *= 1 - dampK(6, dt);
        e.body.position.y = .25 + Math.sin(time * 2.4 + e.phase) * .08;
        if (!e.moving) e.body.rotation.y = Math.sin(time * .8 + e.phase) * .35; else e.body.rotation.y *= 1 - dampK(8, dt);
      } else swingLegs(e, dt);
      if (e.up) { e.up.sprite.visible = !!e.canTrain && !e.stopped; if (e.up.sprite.visible) e.up.sprite.position.y = 2.95 + Math.abs(Math.sin(time * 3.4 + e.phase)) * .12; }
      if (e.label.sprite.visible) e.label.sprite.position.y = (e.kind === 'robot' ? 2.25 : 2.35) + Math.abs(Math.sin(time * 3 + e.phase)) * .08;
      turnToYaw(e, dt);
      if (paused) { e.moving = false; continue; }
      if (!e.working) { offShift(e, dt, time); trackPad(e); continue; }
      // Breaks happen only while really working (a job in progress).
      if (e.job) {
        const brk = STAFF_BREAKS[e.kind];
        if (e.kind === 'robot') { if ((e.workT += dt) >= batteryMinutes(e.u) * 60) { e.workT = 0; act('staff/stop', { uid: e.uid }); continue; } }
        else if (Math.random() < brk.slackChancePerMinute * slackMul(e.u) * chaosSlackMul(state, e.zone) * dt / 60) { act('staff/stop', { uid: e.uid }); continue; } // chaos: slack ×2
      }
      if (e.sideCool > 0) e.sideCool -= dt;
      // Lane step-aside (set by separate): a short sidestep, the job / path resumes after it.
      if (e.sideT > 0) { e.sideT -= dt; tryPush(e, e.sideX * SIDE_STEP / SIDE_T * dt, e.sideZ * SIDE_STEP / SIDE_T * dt); e.moving = true; continue; }
      // Player first: a cup the player took over is dropped silently (cups whose customer left too).
      if (e.job?.type === 'deliver') {
        const j = e.job;
        if (j.step === 'carry') { if (!nextCup(e, state, now)) { endJob(e); e.think = 0; } }
        else if (j.orderId === getCarrying() || !findOrder(state, j.orderId)) { endJob(e); e.think = 0; }
      }
      // Farm World 2.0: the job's field was removed or moved (build/remove, build/move) → drop it quietly and re-plan,
      // never walk to the old spot or act on a field that is gone.
      if (e.job?.plotId && e.zone === 'farm') {
        const pl = plotOf(state, e.job.plotId);
        const sp = pl && plotSpot(pl);
        if (!sp || Math.abs(sp.x - e.job.x) > 1e-6 || Math.abs(sp.z - e.job.z) > 1e-6) { endJob(e); e.path = null; e.think = 0; }
      }
      if (e.xpN && (e.xpT = (e.xpT || 0) + dt) > 15) flushXp(e);
      if (e.kind === 'robot' && !e.job) robotIdle(e, dt, state, now);
      if (!e.job) {
        e.think -= dt;
        if (e.think <= 0) {
          e.think = THINK;
          const job = e.zone === 'farm' ? farmJob(e, state, now) : shopJob(e, state, now);
          if (job) { e.wander = null; e.speedK = 1; if (e.tendOffer) { e.tendOffer = false; e.fee.sprite.visible = false; } startJob(e, job); } // a job interrupts the stroll right away
        }
        if (!e.job) {
          if (e.zone === 'farm') { wander(e, dt, time); setStatus(e, e.kind === 'worker' ? e.reason || '' : ''); tendBubble(e); }
          else { idleAtPost(e, dt, time, state); setStatus(e, e.block || ''); }
          trackPad(e);
          continue;
        }
      }
      const j = e.job;
      if (!j.arrived) {
        e.speedK = e.zone === 'shop' && rule(e, 'urgent') ? jobUrgency(state, j, now) : 1;
        if (moveTo(e, j.x, j.z, dt)) j.arrived = true;
        trackPad(e);
        continue;
      }
      e.moving = false;
      trackPad(e);
      if (e.zone === 'shop' && (j.type !== 'deliver' || j.step !== 'carry')) e.yaw = FACE_COUNTER; // work faces the counter
      // Chained brew: wait at the pad until the cup is ready, then pick it up.
      if (j.type === 'deliver' && j.step === 'wait') {
        const o = findOrder(state, j.orderId);
        if (!o || o.stage !== 'brewing') { endJob(e); e.think = 0; continue; }
        if (!isReady(o, now)) continue;
        j.step = 'pickup'; j.work = 0;
      }
      if (j.work === 0 && j.type !== 'deliver') vfx?.burst(j.type === 'harvest' || j.type === 'plant' ? 'leaf' : 'steam', e.root.position, { count: 4 });
      j.work += dt;
      if (j.work >= (j.type === 'deliver' ? STAFF_SIM.deliverSeconds : WORK[e.type] || 1) / (unitSpeed(e.u) * craftSpeed(e.u, j.type) * gearJob(e.u, j.type) * (e.stateK || 1))) finish(e, store.state, Date.now()); // craft: practiced jobs go faster
    }
    if (!paused && units.size > 1) { sepList.length = 0; for (const e of units.values()) if (e.root.visible) sepList.push(e); separate(sepList); }
    if (!paused) teamTimers(dt, state, now);
  }
  const sepList = [];

  return {
    group, sync, update,
    /** True when a staff member is bringing this order's cup (the player must not pick it up too). */
    isClaimed: orderId => claims.has(`order:${orderId}`),
    /** What a unit is doing now: 'harvest' | 'plant' | 'brew' | 'order' | 'deliver' | 'noBeans' | 'phone' | 'battery' | '' (idle). */
    statusOf: uid => { const e = units.get(uid); return e?.stopped ? e.stopped.kind : e?.flash > 0 ? '' : e?.status || ''; },
    /**
     * What a unit does and why (Staff report / manager modal): { job, reason, ms, task, tasks, post, zone, state, pose,
     * working, bench, fix: { kind, cost } | null, energy, fullness, morale, heat, wear, battery } — job = current job type or null.
     */
    infoOf: uid => {
      const e = units.get(uid);
      if (!e) return null;
      const u = e.u || {};
      return {
        job: e.job?.type || null, reason: e.job ? null : e.reason || null, ms: e.reasonMs || 0,
        task: e.kind === 'robot' ? taskOf(e) : null, tasks: e.kind === 'worker' ? u.tasks || [] : null, post: e.post || null, zone: e.zone,
        state: e.st, pose: e.pose, working: !!e.working, bench: !!e.bench, fix: e.fix ? { kind: e.fix.kind, cost: e.fix.cost } : null,
        energy: u.energy ?? null, fullness: u.fullness ?? null, morale: u.morale ?? null, heat: u.heat ?? null, wear: u.wear ?? null,
        // Robot charge left (%): the battery timer lives here in the realm (workT), not in the save.
        battery: e.kind === 'robot' ? (u.stopped?.kind === 'battery' ? 0 : Math.max(0, Math.round(100 * (1 - (e.workT || 0) / (batteryMinutes(u) * 60))))) : null,
      };
    },
    /** Tap targets: units that cannot work with a fix (their fee bubble first, then the body), tend / ⬆️ bubbles. */
    *pickers() {
      for (const e of units.values()) {
        if (!e.root.parent?.visible || !e.root.visible) continue;
        if (e.stopped || (e.fix && !e.working && e.pose !== 'bench')) { yield e.fee.sprite; yield e.pick; } else { if (e.tendOffer) yield e.fee.sprite; if (e.up?.sprite.visible) yield e.up.sprite; }
      }
    },
    /** One tap on a jammed robot's body: true on the KNOCK.taps-th tap in a row (the realm then sends staff/care knock). */
    knock(uid) {
      const e = units.get(uid);
      if (!e || e.kind !== 'robot' || e.stopped?.kind !== 'jam') return false;
      const now = performance.now();
      e.knockN = knockStep(e.knockN, e.knockAt, now); e.knockAt = now;
      e.jolt = .3;
      vfx?.burst('dust', e.root.position, { count: 4 });
      if (e.knockN < KNOCK.taps) return false;
      e.knockN = 0;
      return true;
    },
    /** Live world position of a unit drawn by the realm (the manager walks to it), or null. */
    posOf: uid => units.get(uid)?.root.position || null,
    /** Zone ('farm' | 'shop') of a unit shown by the realm, or null. */
    zoneOf: uid => units.get(uid)?.zone || null,
    /** What the profile photo frames: a unit drawn in the area on screen (dressed worker or robot) + its face height. */
    portraitOf(uid) {
      const e = units.get(uid);
      if (!e || !e.root.visible || !zones[e.zone]?.visible) return null;
      if (e.kind === 'worker' && !e.body.userData.dressed) return null;
      return { root: e.root, head: e.kind === 'robot' ? 1.12 : 1.5, kind: e.kind };
    },
    /** Puts the highlight ring under a unit for RING_SECONDS; returns its position (live vector) or null. */
    highlight(uid) {
      const e = units.get(uid);
      if (!e) return null;
      e.root.add(hiRing);
      hiRing.visible = true; hiT = RING_SECONDS;
      return e.root.position;
    },
    /** Store events the realm passes on: a rival's line over the target, a refusal, the MVP cheer. */
    onEvent(ev) {
      const e = ev?.uid != null ? units.get(ev.uid) : null;
      if (!e) return;
      if (ev.type === 'mvp') { vfx?.burst('sparkle', e.root.position, { count: 14 }); say?.(e.root, 'realm.staff.mvp', { tone: 'happy', priority: 2 }); return; }
      if (!say) return;
      const rival = ev.rival || RIVAL.names[e.zone] || '';
      if (ev.type === 'poachStarted') say(e.root, t(`realm.staff.rival.${e.zone}`, { rival }), { tone: 'angry', priority: 3, ms: 4200 });
      else if (ev.type === 'poachRefused') say(e.root, t('realm.staff.rivalRefused', { rival }), { tone: 'happy', priority: 3, ms: 3600 });
    },
    setView(v) { zones.farm.visible = v === 'farm'; zones.shop.visible = v === 'cafe'; },
    /** Café post of a unit: 'allRounder' | 'cashier' | 'barista' | 'runner' | null (farm unit, on a break, unknown). */
    postOf: uid => units.get(uid)?.post || null,
    clear() {
      for (const [uid, e] of [...units]) remove(uid, e);
      claims.clear(); noBeansSaid = false;
      Object.assign(timers, { upkeep: 0, mvp: 0, resolved: null, started: false }); timers.rival.farm = timers.rival.shop = 0;
    },
    dispose() {
      this.clear();
      Object.values(geo).forEach(g => g.dispose());
      pickGeo.dispose(); pickMat.dispose(); phoneGeo.dispose(); phoneMat.dispose(); bandGeo.dispose(); bandMat.dispose();
      Object.values(mat).forEach(m => m.dispose());
      tierMat.forEach(m => m.dispose());
      hiGeo.dispose(); hiMat.dispose();
      group.removeFromParent();
    },
  };
}
