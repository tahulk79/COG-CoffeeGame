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
// Over the head: ⬆️ (tappable → hooks.onStaffTap) when a worker can be trained; an idle robot shows its task icon
// (🔄 ring in auto mode). Robot hardware shows on the body: battery pack on the back, motor ring, charger antenna tip.
// Passive bonuses (derive) still apply; on top of that every unit runs a small job loop:
//  · farm (docs/design/farm-crew.md): one trade per unit (STAFF.jobs / ROBOT_TASKS): harvest a ready plot, plant an empty
//    one, water (from the well; robots carry a tank), prune / trim, spray (drone), run a processing station, haul goods
//    to sell. Nothing for its trade → wanders near the fields and shows why.
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
import { STAFF, CROPS, CROP_ORDER, DRINKS, STAFF_BREAKS, ROBOT_TASKS, ROBOT_AUTO, unitSpeed, batteryMinutes, slackMul, hasRule, robotTask, mistakeChance, partTier, isHardDrink, BEANS, BUILDINGS, CREW, FUNNY, goofFee, funnyRoll, gmCalmMul, goofRoll, goofHold, knows, isHardCrop, jamChance, energyMax, RIVAL, BOOKS, GM, craftSpeed, gearWalk, gearJob, hasSoftware, SOFTWARE, STAFF_SIM, CLOCK } from '../../core/config/economy.js';
import { PARCELS, FIXED, FARM_WELL, farmGroundY, farmRouteDist, tierIndexAt } from '../../core/config/layout.js';
import { FARM_MANAGER, AUTO } from '../../core/config/economy.js';
import { getQuality } from '../../shared/vfx/index.js';
import { managerCropFor } from '../../core/farm-manager.js';
import { fmOf, easyCropFor, pickCropFor, harvestUrgency, assignedUnits, ownedPlots, plotState as readPlotState, cropUnlocked, seedCost, capacity, stored, plotOf, farmOccupied, seatCount, seatsUsed, brewSlots, seatPatienceRatio, beanBuyQuote, plotGrowMs, canBrew, region as regionOf, unitState, unitBlocked, unitWorking, stateSpeedMul, quickFix, upgradableStats, buildingsOf, footprint, needs, careError, chaosSlackMul, gmOf, gmThinkSeconds, workerPoach, planCropFor, recipeOf, orderSpot, prodError, collectError, treeOld, pruneCost, dripCovers, haulCapacity, pileCount, cargoCount, storeBuildings, bucketPlots } from '../../core/derive.js';
import { assignPosts, pickShopJob, orderBlock, waitsForBrew, secondCup, nearestFirst, urgencyK, facing, yieldsTo, isReady, POST_JOBS, autoTask, ROBOT_POST, allows, ctxTakes, TICKS, vitalsInterval, vitalsNoop, timerDue, poseOf, stateIconKey, showsFix, knockStep, KNOCK } from './staff-brain.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { dressGedeoWorker, dressGedeoRobot, gedeoProp } from '../../characters/gedeo-worker.js';
import { createPlant } from '../../shared/three/gedeo-vegetation.js';
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
const ICON = { harvest: '🌾', plant: '🌱', brew: '☕', order: '🧾', deliver: '🚶', phone: '📱', giggle: '😂', zzz: '💤', battery: '🔋', charged: '⚡', noBeans: '☕❌', water: '💧', prune: '✂️', spray: '🛸', process: '🫘', haul: '📦', noBatch: '🫘', cantDo: '❓', goofPlay: '🎮', goofLost: '🤷', botLost: '📡', botDock: '🔌', noPile: '🧺', noStore: '🏚️', noWell: '🚱', growing: '⏳', storageFull: '📦', noSeeds: '💸', noPlots: '🏞️',
  tired: '😮‍💨', hungry: '🍔', sulking: '😤', lunch: '🍽️', overheat: '🔥', jam: '⚙️', bench: '🪑' };
for (const [id] of [...FUNNY.worker, ...FUNNY.robot]) ICON[`f_${id}`] = '❗';
for (const job of ['openField', 'expand', 'build']) ICON[`x_${job}`] = '🛠️';
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

const THINK = .35;
// The seated customer closest to running out of patience is served / brewed for first.
const mostUrgent = (orders, test, now) => { let best = null, bp = -1; for (const o of orders) if (test(o)) { const p = seatPatienceRatio(o, now); if (p > bp) { bp = p; best = o; } } return best; };
const THINK_ = 0; // seconds between job searches for an idle unit
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// What a unit is doing, as one short word over its head. Problems are red, waiting is grey, work is plain.
const TAG_TONE = { bad: { bg: '#d9503c', fg: '#fff' }, wait: { bg: '#6d6253', fg: '#fff' }, work: { bg: '#fff8e8', fg: '#4a2f1c' } };
const TAG_BAD = new Set(['phone', 'giggle', 'zzz', 'battery', 'overheat', 'jam', 'sulking', 'tired', 'hungry', 'noBeans', 'storageFull', 'noSeeds', 'cantDo', 'noWell', 'noStore', 'goofPlay', 'goofLost', 'botLost', 'botDock']);
const TAG_WAIT = new Set(['growing', 'noBatch', 'noPile', 'noPlots', 'lunch', 'bench']);
const tagTone = key => (TAG_BAD.has(key) || key.startsWith('f_') ? 'bad' : TAG_WAIT.has(key) ? 'wait' : 'work');
// The pill is at most 54 texels tall: a band of the old 384 square at the same texels per metre (same sharpness, ¼ the memory).
// The margin keeps the pill's soft mip levels off the clamped edge.
const TAG_W = 384, TAG_H = 96;
function drawTag(g, size, text = '', tone = 'work', fee = null) {
  if (!text) return;
  const H = 54, c = TAG_TONE[tone] || TAG_TONE.work, hasFee = fee != null, D = 34;
  g.font = FONT.replace('{size}', 36); g.textBaseline = 'middle'; g.textAlign = 'left';
  const textW = g.measureText(text).width, num = hasFee ? String(fee) : '', numW = hasFee ? g.measureText(num).width : 0, coinW = hasFee ? D + numW + 20 : 0, W = textW + 34 + (hasFee ? coinW + 6 : 0);
  const k = Math.min(1, (size - 6) / W); // a long line shrinks to fit, the coins stay readable
  g.save(); g.translate(size / 2, g.canvas.height / 2); g.scale(k, k);
  const x = -W / 2, y = -H / 2;
  rr(g, x, y, W, H, H / 2); g.fillStyle = c.bg; g.fill();
  g.fillStyle = c.fg; g.fillText(text, x + 17, 2);
  if (hasFee) { // a real gold coin, drawn: the coin emoji is grey on some systems
    const cx = x + W - coinW - 5, r = D / 2, mx = cx + 8 + r;
    rr(g, cx, y + 4, coinW, H - 8, (H - 8) / 2); g.fillStyle = '#fff1c4'; g.fill();
    const grad = g.createRadialGradient(mx - 5, -6, 2, mx, 0, r);
    grad.addColorStop(0, '#fff6b8'); grad.addColorStop(.4, '#ffd34d'); grad.addColorStop(1, '#e9a521');
    g.beginPath(); g.arc(mx, 0, r, 0, Math.PI * 2); g.fillStyle = grad; g.fill(); g.lineWidth = 3; g.strokeStyle = '#b9781a'; g.stroke();
    g.fillStyle = '#4a2f1c'; g.fillText(num, mx + r + 4, 2);
  }
  g.restore();
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

// A plot's state is read many times per search by every idle unit: one read per plot per quarter second is plenty.
let plotMemo = { at: 0, region: null, m: new Map() };
function plotState(state, id, now) {
  const r = state.world.currentRegion;
  if (now - plotMemo.at > 250 || plotMemo.region !== r) plotMemo = { at: now, region: r, m: new Map() };
  let v = plotMemo.m.get(id);
  if (!v) { v = readPlotState(state, id, now); plotMemo.m.set(id, v); }
  return v;
}
export function createStaff({ scene, store, vfx, templates = {}, pads, navigate = null, getFocus = () => null, getActiveCrop = () => null, getCarrying = () => null, getSeat = () => null, getQueued = () => null, canStand = () => true, isPaused = () => false, say = null, getPlayerPos = () => null, getManagerPos = () => null, isWalkable = null, autoOnFoot = () => false }) {
  const group = new THREE.Group();
  group.name = 'realm-staff';
  scene.add(group);
  // Farm staff live in the farm area, shop staff in the café area: one child group each, toggled by setView.
  const zones = { farm: new THREE.Group(), shop: new THREE.Group() };
  group.add(zones.farm, zones.shop);
  // The farm well (giếng nước, layout FARM_WELL): stone ring, dark water, two posts, a small roof, crank and rope with a
  // bucket. Waterers fill a bucket here before watering (water job step fetch, bucketPlots per trip).
  const well = (() => {
    const g = new THREE.Group(); g.name = 'farm-well';
    const stone = new THREE.MeshStandardMaterial({ color: 0xa9a196, roughness: .9 }), stoneDark = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: .95 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: .8 }), roof = new THREE.MeshStandardMaterial({ color: 0xb4532f, roughness: .7 });
    const water = new THREE.MeshStandardMaterial({ color: 0x2e7fb8, roughness: .2, metalness: .1 }), rope = new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: .9 });
    const add = (geo, m, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = true; o.receiveShadow = true; o.raycast = () => {}; g.add(o); return o; };
    add(new THREE.CylinderGeometry(.62, .68, .62, 18, 1, true), stone, 0, .31, 0);
    add(new THREE.TorusGeometry(.62, .09, 8, 22), stoneDark, 0, .64, 0, Math.PI / 2);
    add(new THREE.CircleGeometry(.56, 18), water, 0, .42, 0, -Math.PI / 2);
    for (const x of [-.58, .58]) add(new THREE.BoxGeometry(.1, 1.15, .1), wood, x, 1.1, 0);
    add(new THREE.CylinderGeometry(.05, .05, 1.26, 8), wood, 0, 1.45, 0, 0, Math.PI / 2);       // crank axle
    add(new THREE.CylinderGeometry(.012, .012, .62, 4), rope, 0, 1.13, 0);                      // rope
    add(new THREE.CylinderGeometry(.11, .085, .17, 10), wood, 0, .78, 0);                       // hanging bucket
    const r1 = add(new THREE.BoxGeometry(1.5, .06, .62), roof, 0, 1.86, .24, -.62), r2 = add(new THREE.BoxGeometry(1.5, .06, .62), roof, 0, 1.86, -.24, .62);
    r1.rotation.set(-.62, 0, 0); r2.rotation.set(.62, 0, 0);
    g.position.set(FARM_WELL.x, farmGroundY(FARM_WELL.x, FARM_WELL.z), FARM_WELL.z);
    g.visible = false; // no ready-made well on a new farm (founder 2026-11-08): you build your own; workers still use this spot for water
    zones.farm.add(g);
    // Realistic pass: the Gedeo water point (galvanised tank on a stone plinth, tap, jerrycans) replaces the cartoon well.
    createPlant('waterTank').then(o => { for (const c of [...g.children]) c.visible = false; o.scale.setScalar(.6); o.traverse(c => { c.raycast = () => {}; }); g.add(o); }).catch(() => {});
    return g;
  })();
  // A worker's bucket while watering (shared geometry / material; kept by disposeScene).
  const bucketGeo = new THREE.CylinderGeometry(.13, .1, .2, 10).translate(0, -.1, 0), bucketMat = new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: .8 });
  bucketGeo.userData.keep = true; bucketMat.userData.keep = true;
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
    harvestBot: new THREE.MeshStandardMaterial({ color: 0x9fd88a, roughness: .45, metalness: .1 }),
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
  const tagHitMat = new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false });
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
    const torsoMat = (mat[type] || mat.harvestBot).clone(); // per robot: glows red while overheated
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
    return { root, body, eyeMat, torsoMat, parts: { pack, ring, tip, antenna }, shadow };
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
          if (def.kind === 'robot') {
            e = { ...makeRobot(u.type), kind: 'robot' };
            // Farm robots: the Gedeo machine of its one function, animated drive / work / idle.
            if (zone === 'farm') {
              const uid = u.uid, b = e.body.children;
              dressGedeoRobot(e.root, def.file, [...b.filter(m => m !== e.parts.pack && m !== e.parts.ring), e.shadow], () => {
                const me = units.get(uid); return me?.moving ? 'drive' : me?.job ? 'work' : 'idle';
              }, STAFF_SIM.farmWalkMul);
            }
          } else {
            const gender = u.gender === 'male' || u.gender === 'female' ? u.gender : i % 2 ? 'female' : 'male';
            const person = createPerson(zone === 'farm' ? '#6f9a4a' : '#8a5a3a', { gender });
            const blocks = [...person.children]; // createPerson's own meshes: the only GPU resources this worker owns
            const uid = u.uid;
            if (zone === 'farm') dressGedeoWorker(person, def.looks[gender] || Object.values(def.looks)[0], () => units.get(uid)?.job?.type || null, STAFF_SIM.farmWalkMul); // Gedeo farm worker, clip by job
            else if (def.model) dressPerson(person, def.model);
            e = { root: person, body: person, kind: 'worker', blocks };
          }
          Object.assign(e, { uid: u.uid, type: u.type, trait: u.trait || null, zone, slot: i, phase: Math.random() * 6, job: null, think: Math.random() * THINK, walk: 0, status: '', yaw: 0, path: null, tgtX: NaN, tgtZ: NaN, watch: 0, watchX: 0, watchZ: 0, repaths: 0 });
          const idle = zone === 'farm' ? freeFarmSpot(state, IDLE.farm(i)) : IDLE[zone](i);
          e.root.position.set(idle.x, 0, idle.z);
          e.label = makeCanvasSprite(TAG_W, drawTag, { scale: 2.25, height: TAG_H });
          // the tag's tap area: only the pill, not the whole canvas square
          e.tagHit = new THREE.Sprite(tagHitMat); e.tagHit.geometry.userData.keep = true; e.tagHit.scale.set(3.4, 1, 1); e.tagHit.visible = false;
          e.tagHit.position.y = e.kind === 'robot' ? 2.25 : 2.35; e.tagHit.userData.target = { kind: 'staffFix', uid: u.uid };
          e.root.add(e.tagHit);
          e.label.sprite.position.y = e.kind === 'robot' ? 2.25 : 2.35;
          e.label.sprite.visible = false;
          e.root.add(e.label.sprite);
          e.cup = makeCup();
          e.cup.position.set(.12, e.kind === 'robot' ? 1.05 : 1.02, .38);
          e.root.add(e.cup);
          e.cup2 = makeCup(); // workers carry two cups (other hand)
          e.cup2.position.set(-.16, 1.02, .36);
          e.root.add(e.cup2);
          if (def.kind !== 'robot' && !def.looks) { e.bucket = new THREE.Mesh(bucketGeo, bucketMat); e.bucket.position.set(.28, .9, .12); e.bucket.visible = false; e.bucket.raycast = () => {}; e.root.add(e.bucket); }
          e.water = 0; // plants left in the bucket
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
          e.workT = 0;
          units.set(u.uid, e);
        }
        e.u = u;
        if (e.kind === 'robot') showParts(e);
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
    syncPiles(state);
  }
  // Picked cherries waiting on a field for a hauler: a small sack stack at the field's corner.
  const piles = new Map();
  function syncPiles(state) {
    const r = regionOf(state), want = new Set();
    for (const p of r ? ownedPlots(state) : []) {
      if (!pileCount(r.plots[p.id])) continue;
      want.add(p.id);
      if (piles.has(p.id)) continue;
      const g = new THREE.Group(), x = p.x + 1.05, z = p.z + 1.05;
      g.position.set(x, farmGroundY(x, z), z);
      piles.set(p.id, g); zones.farm.add(g);
      gedeoProp('sack-stack').then(m => { if (!m || piles.get(p.id) !== g) return; m.scale.setScalar(.42); m.traverse(c => { c.raycast = () => {}; }); g.add(m); });
    }
    for (const [id, g] of piles) if (!want.has(id)) { zones.farm.remove(g); piles.delete(id); }
  }
  function remove(uid, e) {
    release(e);
    if (hiRing.parent === e.root) { e.root.remove(hiRing); hiRing.visible = false; }
    e.torsoMat?.dispose();
    e.label.dispose();
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
  const farmFree = (state, x, z) => !farmOccupied(state, x, z);
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
  // A spot a unit could not reach is left alone for a moment, so nobody walks into the same dead end again.
  const avoid = new Map();
  const claimed = key => claims.has(key) || (avoid.get(key) || 0) > Date.now();
  function claim(e, key) { claims.set(key, e.uid); (e.claims ||= []).push(key); }
  function release(e) { for (const k of e.claims || []) if (claims.get(k) === e.uid) claims.delete(k); e.claims = []; }
  function releaseKey(e, key) {
    if (claims.get(key) === e.uid) claims.delete(key);
    const i = e.claims ? e.claims.indexOf(key) : -1;
    if (i >= 0) e.claims.splice(i, 1);
  }
  function endJob(e) { release(e); e.job = null; e.cup.visible = false; e.cup2.visible = false; if (e.bucket) e.bucket.visible = e.water > 0; setStatus(e, ''); }
  function setStatus(e, s) {
    // A state that is not "ok" (tired, hungry, sulking, lunch, bench…) wins over the job icon: the player sees why.
    // An idle robot keeps its task icon up (auto mode: blue ring), so the player sees what it is set to.
    const shown = (!e.stopped && e.stIcon) || s;
    // A problem coins can fix shows its price next to the words, and the tag can be tapped.
    const fix = e.job?.type === 'goof' ? { cost: goofFee(e.u, store.state.gm?.unit) } : shown && e.u ? quickFix(e.u, Date.now()) : null;
    const fee = fix ? fix.cost : null;
    e.feeTag = fee != null;
    const tagSize = e.feeTag ? 3.1 : 2.25; // a tag you can pay is bigger and easier to tap
    e.label.sprite.scale.set(tagSize, tagSize * TAG_H / TAG_W, 1);
    if (e.status === s && e.labelShown === shown && e.labelFee === fee) return; // asked every frame by idle units
    e.status = s; e.labelShown = shown; e.labelFee = fee;
    const tagKey = ICON[shown] ? shown : '';
    e.label.sprite.visible = !!tagKey;
    if (!tagKey) return; // hidden: the old words can stay on the canvas, the same job often comes straight back
    const text = t(`realm.staff.tag.${tagKey}`), tone = tagTone(tagKey), drawn = `${text}|${tone}|${fee}`;
    if (e.label.drawn === drawn) return; // jobs change more often than the words: no redraw, no texture upload
    e.label.drawn = drawn;
    e.label.redraw(text, tone, fee);
  }
  // Parts go to level 10 on the farm but there are three looks: 1-3, 4-6, 7 and up.
  const tierLook = t => (t >= 7 ? 3 : t >= 4 ? 2 : Math.max(1, Math.min(3, t)));
  function showParts(e) {
    const P = e.parts; if (!P) return;
    const b = partTier(e.u, 'battery'), m = partTier(e.u, 'motor'), c = partTier(e.u, 'cooler'), f = partTier(e.u, 'frame');
    P.pack.visible = b > 0; if (b) { P.pack.material = tierMat[tierLook(b)]; P.pack.scale.set(1, .8 + tierLook(b) * .2, 1); }
    P.ring.visible = m > 0; if (m) P.ring.material = tierMat[tierLook(m)];
    P.tip.material = c ? tierMat[tierLook(c)] : mat.tip;          // cooler: antenna tip
    P.antenna.material = f ? tierMat[tierLook(f)] : mat.face;     // frame: antenna mast
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
    e.root.visible = e.pose !== 'bench' && !e.culled;
    if (e.stopped && !wasStopped) { endJob(e); e.moving = false; e.wander = null; }
    if (!e.stopped && wasStopped) resumed(e, wasStopped, now);
    if (wasWorking && !e.working) { endJob(e); e.stroll = null; e.path = null; if (!e.stopped) e.wander = null; }
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
    const step = Math.min(dist, SPEED[e.kind] * (e.zone === 'farm' ? STAFF_SIM.farmWalkMul : 1) * (e.type === 'brewBot' ? STAFF_SIM.brewBotWalkMul : 1) * unitSpeed(e.u) * gearWalk(e.u) * (e.speedK || 1) * (e.stateK || 1) * dt); // gearWalk: boots // stateK: tired ×0.6, hungry ×0.7
    const way = e.zone === 'farm' ? steer(e, dx / dist, dz / dist) : null;
    p.x += (way ? way.x : dx / dist) * step; p.z += (way ? way.z : dz / dist) * step;
    e.moving = true;
    e.yaw = way ? Math.atan2(way.x, way.z) : Math.atan2(dx, dz);
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
  // Dodging (farm): anyone within AVOID_R ahead bends the heading away from them, the player too; both turn to their own
  // right, so two people meeting head-on pass each other. Null = keep the path's heading; never steers into a blocked cell.
  const AVOID_R = 1.5, steerOut = { x: 0, z: 0 };
  // Every walker runs this against everyone, every frame: shared state instead of a closure per call.
  let feelX = 0, feelZ = 0, feelAx = 0, feelAz = 0, feelSide = 0;
  function feel(ox, oz) {
    const dx = ox - feelX, dz = oz - feelZ, q = dx * dx + dz * dz;
    if (q < 1e-4 || q > AVOID_R * AVOID_R) return;
    const d = Math.sqrt(q), ahead = (dx * feelAx + dz * feelAz) / d;
    if (ahead < .3) return;
    const cross = feelAx * dz - feelAz * dx; // which side it is on: turn the other way (dead ahead: to the right)
    feelSide += (cross < -.05 ? -1 : 1) * (1 - d / AVOID_R) * ahead;
  }
  function steer(e, ax, az) {
    const p = e.root.position;
    feelX = p.x; feelZ = p.z; feelAx = ax; feelAz = az; feelSide = 0;
    for (const o of units.values()) if (o !== e && o.zone === 'farm' && o.root.visible) feel(o.root.position.x, o.root.position.z);
    const me = getPlayerPos(), boss = getManagerPos();
    if (me) feel(me.x, me.z);
    if (boss) feel(boss.x, boss.z);
    if (!feelSide) return null;
    const k = Math.max(-1.6, Math.min(1.6, feelSide * 2.2)), nx = ax + az * k, nz = az - ax * k, len = Math.hypot(nx, nz);
    steerOut.x = nx / len; steerOut.z = nz / len;
    return standable(e, p.x + steerOut.x * .45, p.z + steerOut.z * .45) ? steerOut : null;
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
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.sqrt(dx * dx + dz * dz);
      const room = A.zone === 'farm' && (A.kind === 'robot' || B.kind === 'robot') ? 1.1 : .6; // robots are wider
      if (d > 0 && d < room) { // a unit on a break stays put: the other one takes the whole push
        const push = (room - d) * .25 / d;
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
  // Nearest by real walking distance (over several tiers: through the ramps / stairs); on the farm a spot others are
  // already working at costs extra, so the team spreads over the fields and the tiers instead of bunching up.
  const CROWD_R = 3, CROWD_COST = 5, TIER_AWAY = 40;
  // Its own tier first: the work of the tier it is responsible for, anywhere else only when that tier has none (farm-crew.md §11).
  const homeFirst = (e, list) => {
    const t = store.state.gm?.tiers?.[e.uid];
    if (t == null) return list;
    const mine = list.filter(q => tierIndexAt(q.x, q.z) === t);
    return mine.length ? mine : list;
  };
  // Field work is strictly the unit's own tier (founder 2026-11-09: the tiers stay balanced); only a tier with no fields sets it free.
  const homeOnly = (e, list) => {
    const t = store.state.gm?.tiers?.[e.uid];
    if (t == null || !ownedPlots(store.state).some(q => tierIndexAt(q.x, q.z) === t)) return list;
    return list.filter(q => tierIndexAt(q.x, q.z) === t);
  };
  const busyNow = [];
  const near = (e, list, ageOf = null) => {
    const p = e.root.position, farm = e.zone === 'farm', homeTier = store.state.gm?.tiers?.[e.uid];
    const busy = busyNow; // reused: near() never nests
    busy.length = 0;
    if (farm) for (const o of units.values()) if (o.zone === 'farm' && o.job) busy.push(o);
    let best = null, bd = Infinity;
    for (const it of list) {
      let d = farm ? farmRouteDist(p.x, p.z, it.x, it.z) : Math.hypot(it.x - p.x, it.z - p.z);
      if (farm) for (const o of busy) if (o !== e && Math.hypot(o.job.x - it.x, o.job.z - it.z) < CROWD_R) d += CROWD_COST;
      if (farm && homeTier != null && tierIndexAt(it.x, it.z) !== homeTier) d += TIER_AWAY; // the manager's post for it: other tiers only when it has nothing at home
      if (ageOf) d -= Math.min(FARM_MANAGER.ageCapM, Math.max(0, ageOf(it))); // what has waited longest moves up, so far fields are never starved
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  };
  // A robot's task now: its set task, or the one its auto mode picked. Workers: null (they do everything).
  function taskOf(e) {
    if (e.kind !== 'robot') return null;
    const t = robotTask(e.u);
    return t === 'auto' ? (e.autoTask || ROBOT_TASKS[e.type]?.[0] || null) : t;
  }
  const rule = (e, name) => e.kind === 'worker' && hasRule(e.u, name);
  // Job types this unit takes: a robot its one task, a farm worker its trade, a café worker its tasks (none = everything).
  const takes = (e, type) => (e.kind === 'robot' ? (taskOf(e) || type) === type : STAFF[e.type]?.jobs ? STAFF[e.type].jobs.includes(type) : allows(e.u?.tasks, type));
  // Crop to plant: the manager's day plan for that field's lot (when one runs it, management-rules §3.4), else the
  // player's pick (robots, and workers from the 'playerCrop' level), else the best affordable one.
  function cropFor(state, e = null, plotId = null) {
    const planned = plotId ? (state.gm?.unit && fmOf(state).auto ? managerCropFor(state, plotId) : planCropFor(state, plotId)) : null; // his pick for this terrace
    const active = e && e.kind === 'worker' && !rule(e, 'playerCrop') ? null : getActiveCrop();
    const crop = planned && seedCost(state, planned) <= state.player.coins ? planned : pickCropFor(state, plotId, active); // else the best for the field's growing zone
    if (!crop || !e || !isHardCrop(crop) || knows(e.u, 'hardCrop')) return crop;
    return easyCropFor(state, plotId, isHardCrop) || crop; // not learned yet: plant what it can (suited to this terrace first) instead of standing idle
  }
  // Stand beside the bed (south edge) so the unit does not stand inside the tree.
  const PLOT_SIDE = 1.25;
  const plotSpot = plot => ({ x: plot.x, z: plot.z + PLOT_SIDE });

  function farmJob(e, state, now) {
    const plots = ownedPlots(state);
    const r = regionOf(state);
    const roomForBeans = stored(state) < capacity(state); // all goods share the storehouse
    const canHarvest = takes(e, 'harvest'), canPlant = takes(e, 'plant');
    let cantDo = false; // work is waiting that this unit has not learned yet
    const canCrop = crop => { const ok = !isHardCrop(crop) || knows(e.u, 'hardCrop'); if (!ok) cantDo = true; return ok; };
    // Why it has nothing to do (shown over its head and in the Staff report): set below when no job is found.
    e.reason = null; e.reasonMs = 0;
    // An order from the manager comes before the trade's routine.
    const toPlant = plots.filter(p => !r.plots[p.id]).length; // a planter plants what is open before opening more
    const orders = (state.gm?.orders || []).filter(o => takes(e, o.job) && !claimed(`station:${o.id}`) && !(o.job === 'openField' && toPlant >= 4)).map(o => ({ o, ...orderSpot(o) })).filter(x => Number.isFinite(x.x));
    const next = orders.length ? near(e, orders) : null;
    if (next) { const at = freeFarmSpot(state, { x: next.x, z: next.z + 1.4 }); return { type: 'execute', oid: next.o.id, station: next.o.id, icon: `x_${next.o.job}`, hold: 2.5, x: at.x, z: at.z }; }
    // Trades that do not work on the fields.
    if (takes(e, 'process')) { const job = processJob(e, state, r, now); if (!job) e.reason = 'noBatch'; return job; }
    if (takes(e, 'haul')) return haulJob(e, state, r, plots);
    if (!plots.length) { e.reason = 'noPlots'; return null; }
    if (roomForBeans && canHarvest) {
      const ready = homeOnly(e, plots.filter(p => !claimed(`plot:${p.id}`) && r.plots[p.id] && plotState(state, p.id, now).stage === 'ready' && canCrop(r.plots[p.id].crop)));
      // 'ripeFirst' (worker level): the most urgent first (Arabica drops its cherries, then Liberica's first pick, then
      // the longest ready); else the nearest Arabica when one is ripe, else the nearest.
      const arabica = ready.filter(p => CROPS[r.plots[p.id].crop]?.drop);
      const p = rule(e, 'ripeFirst') ? mostUrgent(state, ready, now) : near(e, arabica.length ? arabica : ready, q => harvestUrgency(state, q.id, now));
      if (p) return { type: 'harvest', plotId: p.id, ...plotSpot(p) };
    }
    if (canPlant && cropFor(state, e)) {
      const empty = homeOnly(e, plots.filter(p => !claimed(`plot:${p.id}`) && !r.plots[p.id]));
      const p = near(e, empty.filter(q => canCrop(cropFor(state, e, q.id))));
      if (p) return { type: 'plant', plotId: p.id, ...plotSpot(p) };
    }
    // Waterer / RainBot: growing plots no drip line reaches, nearest first.
    if (takes(e, 'water')) {
      const growing = homeOnly(e, plots.filter(p => !claimed(`plot:${p.id}`) && r.plots[p.id] && !r.plots[p.id].watered && !dripCovers(state, p.id) && plotState(state, p.id, now).stage !== 'ready'));
      // 'driestFirst' (smart): the plant with the longest wait left gains most from water; else the nearest.
      const p = rule(e, 'driestFirst') ? growing.reduce((best, q) => (!best || plotState(state, q.id, now).remainingMs > plotState(state, best.id, now).remainingMs ? q : best), null) : near(e, growing, q => (now - r.plots[q.id].plantedAt) / 60000);
      // empty bucket → the well first (step 'fetch'), then the plant (finish() turns the job into the pour)
      if (p) {
        if (e.water > 0) return { type: 'water', plotId: p.id, ...plotSpot(p) };
        const src = waterSource(e, state, p); // an empty bucket goes to the best water point first (finish() turns the job into the pour)
        if (!src) { e.reason = 'noWell'; return null; }
        return { type: 'water', step: 'fetch', plotId: p.id, x: src.x, z: src.z };
      }
    }
    // Pruner / TrimBot: cut back the old trees first, else a light pruning once per season.
    if (takes(e, 'prune')) {
      const growing = homeOnly(e, plots.filter(p => !claimed(`plot:${p.id}`) && r.plots[p.id] && plotState(state, p.id, now).stage !== 'ready'));
      const old = growing.filter(p => treeOld(r.plots[p.id]) && pruneCost(r.plots[p.id].crop) <= state.player.coins && (knows(e.u, 'oldTree') || !(cantDo = true)));
      const p = near(e, old.length ? old : growing.filter(q => !r.plots[q.id].trimmed && !treeOld(r.plots[q.id])));
      if (p) return { type: 'prune', old: old.length > 0, plotId: p.id, ...plotSpot(p) };
    }
    // Drone: leaf spray once per season.
    if (takes(e, 'spray') && state.player.coins >= CREW.sprayFee) {
      const p = near(e, homeOnly(e, plots.filter(q => !claimed(`plot:${q.id}`) && r.plots[q.id] && !r.plots[q.id].sprayed && plotState(state, q.id, now).stage !== 'ready')));
      if (p) return { type: 'spray', plotId: p.id, ...plotSpot(p) };
    }
    if (cantDo) { e.reason = 'cantDo'; return null; }
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
  // Where a unit stands to use a placed machine or station.
  const machineSpot = (state, b) => freeFarmSpot(state, { x: b.x, z: b.z + Math.max(...BUILDINGS[b.type].size) / 2 + .8 });
  // Water point for this trip: of the built water tanks, the one with the shortest unit → tank → plant walk.
  function waterSource(e, state, plot) {
    const p = e.root.position;
    let best = null, bd = Infinity;
    for (const b of buildingsOf(state, 'well')) { const d = farmRouteDist(p.x, p.z, b.x, b.z) + farmRouteDist(b.x, b.z, plot.x, plot.z); if (d < bd) { bd = d; best = b; } }
    return best ? machineSpot(state, best) : null;
  }
  // Hauler: load piles from the fields (nearest, or the biggest from 'biggestFirst'), pick up more close by while it has
  // room, then carry everything to the nearest storehouse. Each step is its own job, so a reload simply carries on.
  function haulJob(e, state, r, plots) {
    const stores = storeBuildings(state);
    if (!stores.length) { e.reason = 'noStore'; return null; }
    const me = state.staff.units.find(u => u.uid === e.uid), load = cargoCount(me), p0 = e.root.position;
    let piles = plots.filter(p => !claimed(`plot:${p.id}`) && pileCount(r.plots[p.id]) > 0);
    const chains = e.kind === 'robot' ? partTier(e.u, 'battery') >= 1 : rule(e, 'chainPiles');
    if (load > 0) {
      if (chains && load < haulCapacity(me)) piles = piles.filter(p => Math.hypot(p.x - p0.x, p.z - p0.z) <= CREW.haulChainM); else piles = [];
      if (!piles.length) {
        if (stored(state) >= capacity(state)) { e.reason = 'storageFull'; return null; }
        const spot = machineSpot(state, near(e, stores));
        return { type: 'haul', step: 'drop', x: spot.x, z: spot.z };
      }
    }
    if (!piles.length) { e.reason = 'noPile'; return null; }
    piles = homeFirst(e, piles);
    const p = rule(e, 'biggestFirst') ? piles.reduce((a, b) => (pileCount(r.plots[b.id]) > pileCount(r.plots[a.id]) ? b : a)) : near(e, piles);
    return { type: 'haul', step: 'load', plotId: p.id, ...plotSpot(p) };
  }
  // Low stats (farm-crew.md §7): instead of the job it was about to start, the unit goes off somewhere.
  const GOOF_ICON = { worker: { play: 'goofPlay', lost: 'goofLost' }, robot: { lost: 'botLost', dock: 'botDock' } };
  function maybeGoof(e, state, job) {
    const incident = funnyRoll(e.u, Math.random(), Math.random(), gmCalmMul(state.gm?.unit));
    if (incident) { act('staff/funny', { uid: e.uid, incident: incident.id }); return null; }
    const kind = goofRoll(e.u, Math.random());
    if (!kind) return job;
    const p = e.root.position;
    let spot = kind === 'dock' ? e.home : null;
    if (!spot) { // play: far off, any tier; lost: another field not far away
      const far = kind === 'play' ? [10, 60] : [4, 14];
      const list = [...ownedPlots(state).map(q => plotSpot(q)), ...buildingsOf(state, 'well'), ...storeBuildings(state)].filter(q => { const d = farmRouteDist(p.x, p.z, q.x, q.z); return d >= far[0] && d <= far[1]; });
      if (!list.length) return job;
      const q = list[Math.floor(Math.random() * list.length)];
      spot = freeFarmSpot(state, { x: q.x + (Math.random() - .5) * 2, z: q.z + 1.5 });
    }
    if (say && Math.random() < .35) say(e.root, t(`realm.staff.goof.${kind}`), { priority: 1 });
    return { type: 'goof', icon: GOOF_ICON[e.kind][kind], hold: goofHold(e.u, kind), x: spot.x, z: spot.z };
  }
  // Processor: collect a finished batch first, else start one at the nearest free station.
  function processJob(e, state, r, now) {
    const free = (r.buildings || []).filter(b => recipeOf(b) && !claimed(`station:${b.uid}`) && (b.type !== 'wetMill' || knows(e.u, 'wetMill')));
    const done = free.filter(b => b.job && !collectError(state, b, now));
    const b = near(e, done.length ? done : free.filter(x => !x.job && !prodError(state, x)));
    if (!b) return null;
    const spot = machineSpot(state, b);
    return { type: 'process', step: b.job ? 'collect' : 'start', building: b.uid, station: b.uid, x: spot.x, z: spot.z };
  }
  function mostUrgent(state, list, now) {
    let best = null, bu = -Infinity;
    for (const p of list) { const u = harvestUrgency(state, p.id, now); if (u > bu) { bu = u; best = p; } }
    return best;
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
  // Where a unit is in its work cycle, for the manager panel (one job at a time: e.job). Derived, never stored.
  function phaseOf(e) {
    if (e.bench) return 'UNAVAILABLE';
    if (e.blocked) return ['battery', 'overheat', 'lunch'].includes(e.st) ? 'RECOVERING' : 'BLOCKED';
    const j = e.job;
    if (j) return j.type === 'water' && j.step === 'fetch' ? 'REFILLING_WATER' : j.arrived ? 'WORKING' : 'MOVING';
    if (e.reason === 'noWell') return 'WAITING_FOR_WATER';
    if (e.stuckAt && Date.now() - e.stuckAt < 3000) return 'BLOCKED';
    return ['storageFull', 'noStore', 'noSeeds', 'noBatch'].includes(e.reason) ? 'WAITING_FOR_RESOURCE' : 'IDLE';
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
    setStatus(e, job.icon || job.type);
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
    } else if (j.type === 'water' && j.step === 'fetch') {
      // bucket filled at the well: carry it to the plant (the plot stays claimed)
      e.water = bucketPlots(e.u); // + its watering can
      vfx?.burst('sparkle', { x: j.x, y: .7, z: j.z }, { count: 6 });
      const plot = plotOf(state, j.plotId);
      if (plot && regionOf(state)?.plots[j.plotId]) {
        const sp = plotSpot(plot);
        Object.assign(j, { step: 'pour', x: sp.x, z: sp.z, work: 0, arrived: false, walkT: 0, anchor: null });
        if (e.bucket) e.bucket.visible = true;
        return;
      }
    } else if (j.type === 'water') {
      if (act('farm/water', { plotId: j.plotId, uid: e.uid }).ok) { workDone(e); e.water = Math.max(0, (e.water || 0) - 1); }
      e.think = 0;
    } else if (j.type === 'prune') {
      if (act(j.old ? 'farm/prune' : 'farm/trim', { plotId: j.plotId, uid: e.uid }).ok) workDone(e);
      e.think = 0;
    } else if (j.type === 'spray') {
      if (act('farm/spray', { plotId: j.plotId, uid: e.uid }).ok) workDone(e);
      e.think = 0;
    } else if (j.type === 'process') {
      if (act(j.step === 'collect' ? 'prod/collect' : 'prod/start', { uid: j.building, by: e.uid }).ok) workDone(e);
      e.think = 0;
    } else if (j.type === 'execute') {
      if (act('gm/execute', { id: j.oid, uid: e.uid }).ok) workDone(e);
      e.think = 0;
    } else if (j.type === 'haul') {
      if (j.step === 'load') act('farm/pickUp', { plotId: j.plotId, uid: e.uid });
      else if (stored(state) < capacity(state) && act('farm/deposit', { uid: e.uid, drop: oops(e, 'drop') }).ok) workDone(e);
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
  // Constant-screen-size canvas sprite (like the world badges), bottom-anchored on the head, tappable.
  // Back to work after a stop (paid fix, knock, or an overheat that cooled down by itself: no coin burst then).
  function resumed(e, prev = null, now = Date.now()) {
    e.workT = 0;
    e.phone.visible = false;
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
  // A unit on a break: no job; worker looks at the phone; a robot slumps (battery: red blinking eye), smokes with a red
  // body (overheat) or jitters in place (jam; a knock jolts it harder).
  function onBreak(e, time, dt = 0) {
    const b = e.stopped;
    e.moving = false;
    if (b.kind === 'funny') { // up to something: tag over the head, wandering (flirting: over to someone), robots rattle
      setStatus(e, `f_${b.id}`);
      if (e.kind === 'robot') { e.body.position.x = Math.sin(time * 23 + e.phase) * .05; e.body.rotation.z = Math.sin(time * 11) * .08; return; }
      e.phone.visible = b.id === 'phone';
      if (dt) {
        if (b.id === 'flirt' && !e.wander) { for (const o of units.values()) if (o !== e && o.zone === e.zone && o.kind === 'worker') { e.wander = { x: o.root.position.x + .9, z: o.root.position.z, reached: false }; break; } }
        if (b.id !== 'nap') { wander(e, dt, time); e.speedK = .55; }
      }
      return;
    }
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
      setStatus(e, 'phone');
    }
  }

  // Idle: roam naturally — pick a free walkable spot nearby in the unit's zone (realm canStand: café floor / terrace
  // edges, field paths; never fields, counters, queue, seat stand spots or the player's pads), stroll there at a
  // relaxed pace, pause 1–3 s looking around, repeat. No "go back to the home spot".
  function wander(e, dt, time) {
    const w = e.wander;
    if (w && !w.reached && e.zone === 'farm' && !farmFree(store.state, w.x, w.z)) e.wander = null; // a field / building was placed there
    else if (w && !w.reached) {
      e.speedK = w.go ? 1 : .55; // going back to its own tier: at a normal walk
      if (moveTo(e, w.x, w.z, dt)) { w.reached = true; w.pause = .6 + Math.random() * 1.2; e.moving = false; w.look = e.yaw; }
      return;
    }
    if (w && (w.pause -= dt) > 0) { e.moving = false; e.yaw = w.look + Math.sin(time * 1.3 + e.phase) * .6; return; } // look around
    const p = e.root.position, myTier = e.zone === 'farm' ? store.state.gm?.tiers?.[e.uid] : null;
    if (myTier != null && tierIndexAt(p.x, p.z) !== myTier) { // with nothing to do it waits on its own tier, not where it happens to be
      const list = ownedPlots(store.state).filter(q => tierIndexAt(q.x, q.z) === myTier);
      if (list.length) {
        const q = list[(e.slot | 0) % list.length], spot = freeFarmSpot(store.state, { x: q.x + (Math.random() - .5) * 2, z: q.z + 1.6 });
        e.wander = { x: spot.x, z: spot.z, reached: false, go: true };
        return;
      }
    }
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (myTier != null && tierIndexAt(x, z) !== myTier) continue;
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
      const b = e.benchSpot;
      e.speedK = .7;
      if (!moveTo(e, b.x, b.z, dt)) return;
      e.moving = false;
      e.yaw = FACE_COUNTER + Math.PI + Math.sin(time * .45 + e.phase) * .5; // looks out over the farm / street
      return;
    }
    e.moving = false;
    if (e.pose === 'sulk') e.yaw = FACE_AWAY + Math.sin(time * .7 + e.phase) * .12;
  }
  // Worker sitting (lunch, exhausted): body low, legs forward; back up when it stands again.
  function sitPose(e, dt) {
    if (e.kind !== 'worker') return;
    const sit = e.pose === 'sit', goal = sit ? SIT_Y : 0, y = e.sitY || 0;
    if (y !== goal) e.sitY = Math.abs(y - goal) < .005 ? goal : y + (goal - y) * dampK(8, dt || .016); // an offset: the ground height is added below
    const legs = e.root.userData.legs;
    if (legs && sit !== !!e.sitting) { legs[0].rotation.x = legs[1].rotation.x = sit ? -1.3 : 0; }
    e.sitting = sit;
  }

  // Team timers (seconds of play): bench upkeep, rival visits per zone, MVP; rival/resolve once the poach time is up.
  const timers = { upkeep: 0, rival: { farm: 0, shop: 0 }, mvp: 0, resolved: null, started: false, boss: 0, gmThink: 0, gmPay: 0, gmRival: 0, clock: 0, loan: 0, auto: 0 };
  const workersIn = { farm: 0, shop: 0 };
  const ZONES = ['farm', 'shop'];
  // Timers of the same period land on one frame (2 s Auto + hands, 5 s clock, every 60 s nearly all). They keep their pace
  // (reset when due), but their actions run one per frame, in order.
  const dueActs = [];
  const later = fn => { dueActs.push(fn); };
  function teamTimers(dt, state, now) {
    // Played clock (management-rules §4.1): only time the game really runs in front moves it (this loop stops when the
    // tab is hidden / the game is paused). Tenure, loan terms and the income series run on it.
    // Tenure, loan terms, the income series and the inbox (task deadlines, reminders, penalties) run on it.
    if ((timers.clock += dt) >= CLOCK.tickSeconds) { const ms = Math.round(timers.clock * 1000); timers.clock = 0; later(() => act('clock/tick', { ms })); }
    if ((timers.loan += dt) >= CLOCK.loanTickSeconds) { timers.loan = 0; if (state.loans?.length) later(() => act('loan/tick', {})); }
    gmTimers(dt, state);
    // Auto nông trại: a round every AUTO.everySec of played time while a run is on (the player keeps playing).
    if (state.autoplay?.active) { if ((timers.auto += dt) >= AUTO.everySec) { const ms = Math.round(timers.auto * 1000); timers.auto = 0; later(() => act('auto/tick', { ms, roll: Math.random(), skip: autoOnFoot() ? ownedPlots(store.state).map(p => p.id) : [...claims.keys()].filter(k => k.startsWith('plot:')).map(k => k.slice(5)) })); } } // farmer on foot: this round only counts the time and sells, he does the jobs himself
    else timers.auto = 0;
    if (!units.size) return;
    // The first call only starts the reducer's clock (once per session, so a failed call cannot repeat every frame).
    if ((timers.upkeep += dt) >= TICKS.upkeepSeconds || (!state.staff.upkeepAt && !timers.started)) { timers.upkeep = 0; timers.started = true; later(() => act('staff/upkeep', {})); }
    for (const zone of ZONES) {
      if (!workersIn[zone]) { timers.rival[zone] = 0; continue; }
      if ((timers.rival[zone] += dt) < RIVAL.everyMinutes * 60) continue;
      timers.rival[zone] = 0;
      if (!workerPoach(state)) later(() => act('rival/visit', { zone, roll: Math.random() }));
    }
    // a rival's offer that ran out is resolved by the inbox (clock/tick expires the poach task on played time)
    if ((timers.mvp += dt) >= BOOKS.mvpMinutes * 60) { timers.mvp = 0; later(() => act('staff/mvp', {})); }
    if ((timers.boss += dt) >= 5) { timers.boss = 0; softwareRound(now); }
  }
  // General manager (docs/design/general-manager.md): thinks every gmThinkSeconds (by skill), paid about every minute,
  // a rival may come for it every GM.poach.everyMinutes. Runs whether or not any staff is drawn.
  function gmTimers(dt, state) {
    const gm = gmOf(state);
    if (!gm) { timers.gmThink = timers.gmPay = timers.gmRival = 0; return; }
    if ((timers.gmThink += dt) >= gmThinkSeconds(gm)) { timers.gmThink = 0; later(() => act('gm/think', { roll: Math.random() })); }
    if (gm.isAuto) { timers.gmHands = timers.gmPay = timers.gmRival = 0; return; } // field work is auto/tick; no salary, no rival
    if ((timers.gmHands = (timers.gmHands || 0) + dt) >= FARM_MANAGER.hands.everySec) { timers.gmHands = 0; if (fmOf(state).auto) later(() => act('gm/hands', { skip: [...claims.keys()].filter(k => k.startsWith('plot:')).map(k => k.slice(5)) })); }
    if ((timers.gmPay += dt) >= 60 || !state.gm.payAt) { timers.gmPay = 0; if (state.gm.payAt) later(() => act('gm/payroll', {})); else act('gm/payroll', {}); } // the first one starts the clock: right now, or it would be queued every frame
    if ((timers.gmRival += dt) >= GM.poach.everyMinutes * 60) { timers.gmRival = 0; later(() => act('gm/rivalVisit', { roll: Math.random() })); }
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

  // A big team stays smooth: the farm units nearest the camera get shadows and full-rate animation, the farthest are not drawn.
  // Only the visuals change: every unit keeps working wherever it is.
  let lodT = 0;
  function lodRound() {
    const f = getFocus(), L = getQuality() === 'low' ? FARM_MANAGER.lod.low : FARM_MANAGER.lod;
    if (!f) return;
    const list = [...units.values()].filter(e => e.zone === 'farm').map(e => ({ e, d: Math.hypot(e.root.position.x - f.x, e.root.position.z - f.z) })).sort((a, b) => a.d - b.d);
    list.forEach(({ e }, i) => {
      const culled = i >= L.drawn;
      e.root.userData.animEvery = i < L.fullAnim ? 1 : i < L.halfAnim ? 2 : 4;
      if (!e.shadowOff) { e.shadowOff = true; e.root.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = false; }); if (e.shadow) e.shadow.visible = false; } // the farm crew has no shadow (founder 2026-11-10); the dressed model is set up the same way
      if (e.culled !== culled) { e.culled = culled; e.root.visible = e.pose !== 'bench' && !culled; }
    });
  }
  // Per frame. state = store.state, now = Date.now(); time = realm clock.
  function update(dt, time, state, now) {
    const paused = isPaused() || state.story.phase !== 'play' || !state.world.currentRegion;
    const interval = vitalsInterval(units.size);
    if ((lodT -= dt) <= 0) { lodT = FARM_MANAGER.lod.everySec; lodRound(); }
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
      if (e.label.sprite.visible) e.label.sprite.position.y = (e.kind === 'robot' ? 2.25 : 2.35) + Math.abs(Math.sin(time * 3 + e.phase)) * .08;
      turnToYaw(e, dt);
      if (paused) { e.moving = false; continue; }
      if (!e.working) { offShift(e, dt, time); trackPad(e); continue; }
      // Breaks happen only while really working (a job in progress).
      if (e.job) {
        const brk = STAFF_BREAKS[e.kind];
        if (e.kind === 'robot') { if ((e.workT += dt) >= batteryMinutes(e.u) * 60) { e.workT = 0; act('staff/stop', { uid: e.uid }); continue; } }
        else if (e.zone !== 'farm' && Math.random() < brk.slackChancePerMinute * slackMul(e.u) * chaosSlackMul(state, e.zone) * dt / 60) { act('staff/stop', { uid: e.uid }); continue; } // chaos: slack ×2
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
      if (e.job?.plotId && e.zone === 'farm') { // (a 'fetch' step walks to the well, not to the field: only check the field exists)
        const pl = plotOf(state, e.job.plotId);
        if (!pl || (e.job.step !== 'fetch' && (Math.abs(pl.x - e.job.x) > 1e-6 || Math.abs(pl.z + PLOT_SIDE - e.job.z) > 1e-6))) { endJob(e); e.path = null; e.think = 0; }
      }
      if (e.xpN && (e.xpT = (e.xpT || 0) + dt) > 15) flushXp(e);
      if (e.kind === 'robot' && !e.job) robotIdle(e, dt, state, now);
      if (!e.job) {
        e.think -= dt;
        if (e.think <= 0) {
          e.think = THINK;
          const found = e.zone === 'farm' ? farmJob(e, state, now) : shopJob(e, state, now);
          const job = found && e.zone === 'farm' ? maybeGoof(e, state, found) : found;
          if (job) { e.wander = null; e.speedK = 1; startJob(e, job); } // a job interrupts the stroll right away
          else if (e.zone === 'farm') e.think = FARM_MANAGER.idleThink + Math.random() * .5; // nothing to do: look again a bit later, not 3× a second
        }
        if (!e.job) {
          if (e.zone === 'farm') { wander(e, dt, time); setStatus(e, e.reason || ''); }
          else { idleAtPost(e, dt, time, state); setStatus(e, e.block || ''); }
          trackPad(e);
          continue;
        }
      }
      const j = e.job;
      if (!j.arrived) {
        e.speedK = e.zone === 'shop' && rule(e, 'urgent') ? jobUrgency(state, j, now) : 1;
        if (moveTo(e, j.x, j.z, dt)) j.arrived = true;
        else if (e.zone === 'farm') { // stuck = not moving, however long the walk is: upper terraces are a long way off
          const at = e.root.position;
          if (!j.anchor || Math.hypot(at.x - j.anchor.x, at.z - j.anchor.z) > 1.5) { j.anchor = { x: at.x, z: at.z }; j.walkT = 0; }
          else if ((j.walkT = (j.walkT || 0) + dt) > FARM_MANAGER.stuckSeconds) {
            if (j.type === 'execute') j.arrived = true; // a manager's order is done from as close as it can get (never stalls a purchase)
            else {
              const until = Date.now() + FARM_MANAGER.avoidSeconds * 1000;
              for (const k of e.claims || []) avoid.set(k, until);
              if (avoid.size > 64) for (const [k, t] of avoid) if (t <= Date.now()) avoid.delete(k);
              endJob(e); e.path = null; e.think = 0; e.stuckAt = Date.now();
              continue;
            }
          }
        }
        trackPad(e);
        continue;
      }
      e.moving = false;
      trackPad(e);
      if (e.zone === 'farm' && j.plotId && j.step !== 'fetch' && j.type !== 'goof') { const f = plotOf(state, j.plotId), at = e.root.position; if (f) e.yaw = Math.atan2(f.x - at.x, f.z - at.z); } // faces the plant it works on
      if (e.zone === 'shop' && (j.type !== 'deliver' || j.step !== 'carry')) e.yaw = FACE_COUNTER; // work faces the counter
      // Chained brew: wait at the pad until the cup is ready, then pick it up.
      if (j.type === 'deliver' && j.step === 'wait') {
        const o = findOrder(state, j.orderId);
        if (!o || o.stage !== 'brewing') { endJob(e); e.think = 0; continue; }
        if (!isReady(o, now)) continue;
        j.step = 'pickup'; j.work = 0;
      }
      if (j.work === 0 && j.type !== 'deliver' && j.type !== 'goof') vfx?.burst(j.type === 'harvest' || j.type === 'plant' ? 'leaf' : 'steam', e.root.position, { count: 4 });
      j.work += dt;
      if (j.hold ? j.work >= j.hold : j.work >= (j.type === 'deliver' ? STAFF_SIM.deliverSeconds : WORK[e.type] || 1) / (unitSpeed(e.u) * craftSpeed(e.u, j.type) * gearJob(e.u, j.type) * (e.stateK || 1))) finish(e, store.state, Date.now()); // craft: practiced jobs go faster
    }
    if (!paused && units.size > 1) { sepList.length = 0; for (const e of units.values()) if (e.root.visible) sepList.push(e); separate(sepList); }
    // everyone stands on the mountain tiers (eased, so crossing a tier wall looks like taking the steps)
    for (const e of units.values()) { const p = e.root.position, gy = farmGroundY(p.x, p.z) + (e.sitY || 0); p.y = Math.abs(gy - p.y) > 4 ? gy : p.y + (gy - p.y) * Math.min(1, dt * 10); }
    if (!paused) { teamTimers(dt, state, now); if (dueActs.length) dueActs.shift()(); }
  }
  const sepList = [];

  return {
    group, sync, update,
    /** True when a staff member is bringing this order's cup (the player must not pick it up too). */
    isClaimed: orderId => claims.has(`order:${orderId}`),
    /** True when a crew member is on this field. */
    plotClaimed: plotId => claims.has(`plot:${plotId}`),
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
        phase: phaseOf(e),
        task: e.kind === 'robot' ? taskOf(e) : null, tasks: e.kind === 'worker' ? u.tasks || [] : null, post: e.post || null, zone: e.zone,
        state: e.st, pose: e.pose, working: !!e.working, bench: !!e.bench, fix: e.fix ? { kind: e.fix.kind, cost: e.fix.cost } : null,
        energy: u.energy ?? null, fullness: u.fullness ?? null, morale: u.morale ?? null, heat: u.heat ?? null, wear: u.wear ?? null,
        // Robot charge left (%): the battery timer lives here in the realm (workT), not in the save.
        battery: e.kind === 'robot' ? (u.stopped?.kind === 'battery' ? 0 : Math.max(0, Math.round(100 * (1 - (e.workT || 0) / (batteryMinutes(u) * 60))))) : null,
      };
    },
    /** A wandering unit called back for coins. Null when this unit is not wandering (its fix is a care action). */
    recall(uid) {
      const e = units.get(uid);
      if (e?.job?.type !== 'goof') return null;
      const r = act('staff/recall', { uid });
      if (r.ok) { endJob(e); e.path = null; e.think = 0; }
      return r;
    },
    /** Where the farm crew stands (the manager walks around them). */
    *farmPositions() { for (const e of units.values()) if (e.zone === 'farm' && e.root.visible) yield e.root.position; },
    /** Tap targets: the ⬆️ bubble first, then every unit's body (a tap opens its profile card). */
    *pickers() {
      for (const e of units.values()) {
        if (!e.root.parent?.visible || !e.root.visible) continue;
        if (e.feeTag) yield e.tagHit; // the priced tag first: tapping it pays
        yield e.pick;
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
      return { root: e.root, head: e.kind === 'robot' ? 1.12 : 1.15, kind: e.kind }; // the height of the face (chibi workers: a big head, low down)
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
      tagHitMat.dispose(); pickGeo.dispose(); pickMat.dispose(); phoneGeo.dispose(); phoneMat.dispose();
      Object.values(mat).forEach(m => m.dispose());
      tierMat.forEach(m => m.dispose());
      hiGeo.dispose(); hiMat.dispose();
      bucketGeo.dispose(); bucketMat.dispose();
      well.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); well.removeFromParent();
      group.removeFromParent();
    },
  };
}
