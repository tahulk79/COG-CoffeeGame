// Café customers. Store orders are the source of truth: each order has one walker (createPerson + dressPerson).
//  · waiting        → 2-line queue at the Order Counter (layout cafeQueueSlot: slot 0 = head at the counter, then two
//                     columns behind it); walkers re-path smoothly (straight step, no grid path) when the line shifts and
//                     face the counter (north). Bubble = "💬" (no drink until ordered) + patience bar (green → yellow →
//                     red, blinking + shaking in the last 20 %). No numbers.
//  · taken/brewing  → walks to a free seat (seats.js: terrace stools + Tables chairs) and SITS (person.userData.seated);
//                     bubble = drink + a brew bar that fills up, then a big ☕ (bouncing) when the cup is ready
//                     + under it the SEAT patience bar (SHOP.seatPatienceSeconds, green → yellow → red, blinks in
//                     the last 20 %). Out of patience → shop/customerLeft: they stand up, swear ("💢 #@!%"), stomp off.
//  · served         → the player carries the cup over (realm index.js); the cup lands on the table, coins fly up,
//                     the customer stands up and leaves
// Seated customers have an invisible pick box (target { kind: 'customer', orderId }) so the player can tap them.
// The core guarantees a free seat for every taken order (shop/takeOrder fails with 'noSeat' otherwise).
// The realm owns spawning (timer = derive.arrivalMs, already ÷ the café rating factor) and patience
// (SHOP.patienceSeconds → shop/customerLeft). New walkers come in from the alley or a street end (STREET_ENDS) and hurry
// while still far away (so a long walk does not eat their queue patience); leavers go out by the alley or, sometimes,
// the nearest street end.
//
// Street incidents (docs/design/cafe-street.md §3.2). cafe.js only offers primitives; realm/incidents.js decides.
//  · onSpawnBlocked(look)  hook: the spawn timer fired but the queue is full (crowd balk chance).
//  · onArrived(orderId)    hook: a NEW walker reached its queue slot for the first time (fights / cuts).
//  · Free walkers (the `leaving` set) = leavers + transient balkers (no order, never queued, never in queuedOrder).
//    Modes: 'balk' (walking to the tail of the line, then(walker) on arrival), 'away' (walking to a target, onArrive on
//    arrival; no onArrive = an exit → disposed on arrival), 'stand' (idle; after a few seconds they exit on their own,
//    so a director that forgets a walker never leaks it). onArrive returning true = handed off (e.g. street.adopt made
//    its own copy) → disposed now; release(walker) instead hands the Object3D itself over (caller disposes it).
//  · claimLeave(orderId, plan) marks a waiting walker before the director dispatches shop/customerLeft; when sync sees
//    the order vanish, the walker follows the plan ({ target, mood, label, speed, onArrive }) instead of the default
//    exit. A claim expires after CLAIM_TTL s (failed dispatch) and is dropped when the order is served.
//  · cut(id) — that walker stands beside the head (CUT spot, left of the head so the order pad stays free); it is NOT
//    queued (queuedOrder skips it) and the line keeps its slots. uncut(id) → back to its normal slot (the tail).
//  · fight(a, b, onDone) — both walk to their midpoint shouting, are hidden while speech.fightCloud plays, reappear
//    dazed (💫) a little apart; onDone(a, b, { aborted }) is called exactly once (aborted = an order vanished first) —
//    the caller decides who leaves. No patience timeout while fighting.
//  · Leave moods by reason (onLeft): patience/angry 💢, crowd 😩, switch 🙄, closed 💢 + swear label, fight 💫, bar 🍺.
import * as THREE from 'three';
import { DRINKS, SHOP, INCIDENTS } from '../../core/config/economy.js';
import { CUSTOMER, CAFE_ROADS, CAFE_QUEUE, cafeQueueSlot, STREET_ENDS } from '../../core/config/layout.js';
import { region as regionOf, arrivalMs, queueCap, seatPatienceRatio } from '../../core/derive.js';
import { currentStep } from '../../core/tutorial.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { makeCanvasSprite, makeLabel, drawEmoji, dampK } from './util.js';
import { sfx } from '../../shared/audio/index.js';
import { seatSpots } from './seats.js';
import { sayKey } from './speech.js';
import { t } from '../../i18n/index.js';
import { drinkIcon } from '../../ui/local-menu.js';

const SPEED = 2.4;
const RUSH = 1.7, RUSH_DIST = 10; // new walkers far from their slot walk faster (long street-end entries)
const STREET_Z = (CAFE_ROADS.cafeFront.rect[1] + CAFE_ROADS.cafeFront.rect[3]) / 2; // customers leave along the street
const SHIRTS = ['#e0794f', '#4f8fd0', '#6aa85a', '#c45a8a', '#e3b13e', '#7a6bc4'];
// The guest GLB textures are pale beige/olive, so every guest read as the same grey figure. Once dressed, each walker
// gets its own material clone tinted with a pastel (per look) and brightened a little; the texture stays shared.
const TINTS = ['#ffc9b0', '#bcd6ff', '#c8efb4', '#ffc4df', '#ffe49a', '#d6c8ff', '#a8ece4', '#ffd6a0'].map(h => new THREE.Color(h).multiplyScalar(1.12));
const BAR_STEPS = 40; // bubble redraws only when a bar moves a step
const LOW = .2;        // last 20 % of patience: blink + shake
const BUBBLE_Y = 2.55, BUBBLE_SEATED_Y = 2.15;
const CUP_MS = 6000;   // served cup stays on the table this long
const HEAD = CAFE_QUEUE.head;
const cutSpot = i => ({ x: HEAD.x - 1.1 - i * .75, z: HEAD.z + .2 }); // beside the head, west side (order pad is east)
const MOODS = { patience: '💢', crowd: '😩', switch: '🙄', closed: '💢', fight: '💫', bar: '🍺' };
const SWEAR = '💢 #@!%';
const CLAIM_TTL = 2;      // s: a claim the core never acted on is forgotten
const STAND_MAX = 6;      // s: an idle free walker nobody re-routes exits on its own
const BALK_STAND = 3;     // s: a balker stares at the line this long if the director does nothing
const MAX_BALK = 5;       // transient balkers alive at once
const FIGHT_WALK_MAX = 3.5, DAZE = 3;
const FIGHT_S = INCIDENTS?.fightSeconds ?? 2.6;
// Entry weights for new walkers: alley (CUSTOMER.spawn) / west street end / east street end.
const ENTRY_ROLLS = [.8, .9]; // alley 80 %, each street end 10 % (an end walk eats ~40 % of the core's queue patience)

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// Patience color: green → yellow → red.
const barColor = k => (k > .5 ? '#4cc24a' : k > LOW ? '#f2b53a' : '#e5482f');

// mode: 'patience' (bar = time left) | 'brew' (bar fills while brewing) | 'ready' (big ☕) | 'mood' (emoji only)
function drawBubble(g, size, icon = '☕', mode = 'patience', k = 1, p = -1) {
  const c = size / 2;
  const x = 10, y = 6, w = size - 20, h = size * .66;
  g.fillStyle = 'rgba(60,35,15,.22)'; roundRect(g, x, y + 4, w, h, 22); g.fill();
  g.fillStyle = mode === 'ready' ? '#eaffdf' : '#fffaf0'; roundRect(g, x, y, w, h, 22); g.fill();
  g.beginPath(); g.moveTo(c - 12, y + h - 1); g.lineTo(c, size * .86); g.lineTo(c + 12, y + h - 1); g.fill();
  if (mode === 'mood') { drawEmoji(g, icon, c, y + h / 2 + 2, size * .44); return; }
  const bx = x + 12, bw = w - 24;
  const bar = (by, bh, kk, color) => {
    g.fillStyle = 'rgba(70,45,25,.18)'; roundRect(g, bx, by, bw, bh, bh / 2); g.fill();
    kk = Math.max(0, Math.min(1, kk));
    if (kk > .01) { g.fillStyle = color; roundRect(g, bx, by, Math.max(bh, bw * kk), bh, bh / 2); g.fill(); }
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(70,45,25,.35)'; roundRect(g, bx, by, bw, bh, bh / 2); g.stroke();
  };
  const seated = p >= 0;
  if (mode === 'ready') {
    g.lineWidth = 5; g.strokeStyle = '#4cc24a'; roundRect(g, x + 2, y + 2, w - 4, h - 4, 20); g.stroke();
    drawEmoji(g, '☕', c, y + h * (seated ? .38 : .5) + 2, size * (seated ? .34 : .44));
  } else {
    drawEmoji(g, icon, c, y + h * (seated ? .27 : .36), size * (seated ? .24 : .3));
    // patience (queue) or brew progress (seated) bar under the drink
    if (mode === 'brew') bar(y + h * .5, 10, k, '#38a8c8');
    else bar(y + h * .68, 13, k, barColor(k));
  }
  if (seated) bar(y + h * .74, 11, p, barColor(p)); // seated: how long they will still wait
}

const pickGeo = new THREE.BoxGeometry(.9, 1.9, .9).translate(0, .95, 0);
pickGeo.userData.keep = true;
const pickMat = new THREE.MeshBasicMaterial();
pickMat.userData.keep = true;

const safe = (fn, ...args) => { try { return fn(...args); } catch (e) { console.error('[cafe]', e); return undefined; } };

export function createCafe({ scene, vfx, dispatch, templates = {}, navigate = null, speech = null, onSpawnBlocked = null, onArrived = null }) {
  let hooks = { onSpawnBlocked, onArrived }; // setHooks() later: the director is created after the café
  const group = new THREE.Group();
  group.name = 'realm-customers';
  scene.add(group);
  const walkers = new Map(); // orderId → walker (orders still in the store)
  const leaving = new Set(); // free walkers: leavers + transient balkers
  const seatOf = new Map();  // orderId → seat index (seats.js order)
  const claims = new Map();  // orderId → { plan, at }
  const fights = [];         // { a, b, idA, idB, mx, mz, dx, dz, t, phase, sayB, onDone }
  const arrivals = [];       // order ids that reached their slot this frame (reused)
  const doneQueue = [];      // fights whose onDone is still to be called (from update)
  let spots = [];
  const cups = [];           // served cups on tables: { obj, until }
  const cupTemplate = templates['cafe/props.glb#cup'] || null;
  let spawnClock = 0;
  let synced = false;
  let clockNow = 0;
  let tick = 0;              // own seconds clock (claims expire even while the café is paused)
  let cur = null;            // last state seen by sync / update
  let balkSeq = 0;
  const patienceMs = SHOP.patienceSeconds * 1000;

  function makeWalker(id, look, icon, x, z) {
    look = Math.abs(look | 0);
    const female = look % 2 === 1;
    const person = createPerson(SHIRTS[look % SHIRTS.length], { gender: female ? 'female' : 'male' });
    dressPerson(person, female ? 'cafe/guest-f.glb' : 'cafe/guest-m.glb');
    person.position.set(x, 0, z);
    const bubble = makeCanvasSprite(128, drawBubble, { scale: 1.05 });
    bubble.sprite.position.y = BUBBLE_Y;
    person.add(bubble.sprite);
    const pick = new THREE.Mesh(pickGeo, pickMat);
    pick.visible = false;
    pick.userData.target = { kind: 'customer', orderId: id };
    person.add(pick);
    group.add(person);
    return { id, look, person, bubble, pick, icon, stage: '', ringStep: -1, status: null, path: [], phase: Math.random() * 6,
      faceYaw: Math.PI, leftSent: false, mood: '', tint: TINTS[look % TINTS.length], tinted: false, seat: null,
      slotX: NaN, slotZ: NaN, qi: -1, arrived: false, arrivedAt: 0, rush: false, cut: false, fight: null, dazed: 0,
      mode: '', onArrive: null, then: null, standT: 0, speedK: 1, transient: false, dropped: false };
  }

  // dressPerson loads asynchronously: tint on the first frame the rig is attached (textured meshes only).
  function tint(w) {
    w.tinted = true;
    w.person.traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.map) return;
      const m = o.material.clone();
      m.userData = {}; // the shared source is marked keep; this clone is per walker and disposed with it (texture stays kept)
      m.color.copy(w.tint);
      o.material = m;
    });
  }

  function stand(w) { w.person.userData.seated = false; w.bubble.sprite.position.y = BUBBLE_Y; }
  const inLine = (x, z) => x > -5.8 && x < -1.6 && z > 106.6 && z < 117.5;

  // Queue: grid path (nav.js) around counters, buildings and houses; seats inside a Tables footprint are reached
  // exactly. Small shifts inside the queue lane are a straight step (the line moves up smoothly, no grid zig-zag).
  function setPath(w, tx, tz, toSeat) {
    const p = w.person.position;
    w.path.length = 0;
    stand(w);
    if (!toSeat && inLine(p.x, p.z) && inLine(tx, tz) && Math.hypot(p.x - tx, p.z - tz) < 2.6) { w.path.push({ x: tx, z: tz }); return; }
    const list = navigate ? navigate(p.x, p.z, tx, tz, { exact: true }) : null;
    if (list?.length) { for (const q of list) w.path.push(q); return; }
    if (!toSeat && Math.abs(p.x - tx) > 1 && Math.abs(p.z - tz) > .8) {
      if (p.z > 117 && Math.abs(p.x - CUSTOMER.spawn.x) > 1) w.path.push({ x: CUSTOMER.spawn.x, z: p.z }); // along the street first
      w.path.push({ x: CUSTOMER.spawn.x, z: tz });
    }
    w.path.push({ x: tx, z: tz });
  }
  // Free walkers: any target on the street (exits, street ends, venue lots).
  function routeTo(w, tx, tz, exact) {
    const p = w.person.position;
    w.path.length = 0;
    const list = navigate ? navigate(p.x, p.z, tx, tz, exact ? { exact: true } : undefined) : null;
    if (list?.length) { for (const q of list) w.path.push(q); return; }
    if (Math.abs(p.z - STREET_Z) > .5) w.path.push({ x: p.x, z: STREET_Z });
    if (Math.abs(p.x - tx) > .5) w.path.push({ x: tx, z: STREET_Z });
    w.path.push({ x: tx, z: tz });
  }

  /** Nearest walk-in entry to x: the alley or a street end. Returns a new {x, z}. */
  function entryFor(x) {
    let best = CUSTOMER.spawn, d = Math.abs((+x || 0) - best.x);
    for (const e of [STREET_ENDS.west, STREET_ENDS.east]) { const k = Math.abs((+x || 0) - e.x); if (k < d) { d = k; best = e; } }
    return { x: best.x, z: best.z };
  }
  function pickEntry() {
    const r = Math.random();
    const e = r < ENTRY_ROLLS[0] ? CUSTOMER.spawn : r < ENTRY_ROLLS[1] ? STREET_ENDS.west : STREET_ENDS.east;
    return { x: e.x, z: e.z };
  }
  // Default way out: mostly the alley, sometimes the nearest street end (variety on the street).
  function exitPoint(w) {
    if (Math.random() < .35) {
      const x = w.person.position.x;
      const e = Math.abs(x - STREET_ENDS.west.x) <= Math.abs(x - STREET_ENDS.east.x) ? STREET_ENDS.west : STREET_ENDS.east;
      return { x: e.x, z: e.z };
    }
    return { x: CUSTOMER.exit.x, z: CUSTOMER.exit.z };
  }

  // Keeps every taken/brewing order on its own seat (stable while seated; new orders get the lowest free seat).
  function assignSeats(orders) {
    const want = new Set();
    for (const o of orders) if (o.stage === 'taken' || o.stage === 'brewing') want.add(o.id);
    for (const [id, i] of seatOf) if (!want.has(id) || i >= spots.length) seatOf.delete(id);
    const taken = new Set(seatOf.values());
    for (const o of orders) {
      if (!want.has(o.id) || seatOf.has(o.id)) continue;
      let i = 0;
      while (taken.has(i)) i++;
      seatOf.set(o.id, i); // the core never takes an order without a free seat; past the list = stand near the last one
      taken.add(i);
    }
  }

  /** instant: place walkers directly at their slots (first sync / region change / reload). */
  function sync(state, instant = false) {
    cur = state;
    const orders = regionOf(state)?.shop.orders || [];
    spots = seatSpots(state);
    assignSeats(orders);
    const seen = new Set();
    let wi = 0, ci = 0;
    for (const o of orders) {
      seen.add(o.id);
      const seated = o.stage !== 'waiting';
      let w = walkers.get(o.id);
      if (w && seated) { w.cut = false; if (w.fight) endFight(w.fight, true); }
      const seat = seated ? spots[Math.min(seatOf.get(o.id) ?? 0, spots.length - 1)] : null;
      // Cutters stand beside the head and keep no line slot; fighters keep theirs (they usually leave right after).
      const slot = seated ? seat : w?.cut ? cutSpot(ci++) : cafeQueueSlot(wi);
      if (!seated && !w?.cut) { if (w) w.qi = wi; wi++; }
      if (!w) {
        const placed = instant || !synced;
        // Café tutorial: always the alley (a street-end walk would leave the framed counter empty for ~18 s).
        const from = placed ? slot : currentStep(state, 'cafe') ? { x: CUSTOMER.spawn.x, z: CUSTOMER.spawn.z } : pickEntry();
        w = makeWalker(o.id, o.look, drinkIcon(state.world.currentRegion, o.drink, o.item), from.x, from.z); // the country's local drink
        w.qi = seated ? -1 : wi - 1;
        walkers.set(o.id, w);
        if (placed) { w.stage = o.stage; w.arrived = true; w.arrivedAt = o.at ?? clockNow; } // reload: no walk, no arrival hook
        else w.rush = from.x !== CUSTOMER.spawn.x || from.z !== CUSTOMER.spawn.z; // street end: hurry while far
      }
      if (seated) w.qi = -1;
      if (w.stage !== o.stage || w.slotX !== slot.x || w.slotZ !== slot.z) {
        const wasSeated = w.stage === 'taken' || w.stage === 'brewing';
        if (w.stage === 'waiting' && o.stage === 'taken') w.pop = .45; // the drink pops into the bubble once ordered
        w.stage = o.stage; w.slotX = slot.x; w.slotZ = slot.z; w.ringStep = -1; w.seat = seat;
        if (w.fight) continue; // fighters stay at the fight spot; finishing the fight walks them back
        // taken → brewing keeps the customer seated; anything else walks to the new slot.
        if (!(wasSeated && seated && w.person.userData.seated && Math.hypot(w.person.position.x - slot.x, w.person.position.z - slot.z) < .05)) setPath(w, slot.x, slot.z, seated);
      }
    }
    for (const [id, w] of walkers) if (!seen.has(id)) leave(w, instant);
    synced = true;
  }
  const resync = () => { if (cur) sync(cur); };

  function leave(w, instant) {
    walkers.delete(w.id);
    seatOf.delete(w.id);
    const claim = claims.get(w.id);
    claims.delete(w.id);
    if (w.fight) endFight(w.fight, true, instant);
    w.cut = false; w.dazed = 0; w.person.visible = true;
    if (instant) { drop(w); return; }
    w.stage = 'leaving';
    stand(w);
    const plan = claim?.plan;
    if (plan) {
      if (plan.mood) w.mood = plan.mood;
      if (plan.label) swear(w, plan.label === true ? SWEAR : String(plan.label), 0);
    }
    const to = plan?.target && Number.isFinite(plan.target.x) && Number.isFinite(plan.target.z) ? plan.target : null;
    away(w, to || exitPoint(w), to ? plan.onArrive || null : null, plan?.speed, !!to);
    leaving.add(w);
  }
  // Sends a free walker to (x, z); onArrive(w) on arrival, or disposal when there is none (an exit).
  function away(w, target, onArrive, speed, exact) {
    w.mode = 'away';
    w.onArrive = typeof onArrive === 'function' ? onArrive : null;
    w.speedK = Number.isFinite(speed) && speed > 0 ? speed : w.angry ? 1.45 : w.mood === '💢' ? .7 : 1;
    stand(w);
    routeTo(w, target.x, target.z, exact);
    showMood(w);
  }
  function showMood(w) {
    const s = w.bubble.sprite;
    w.status = 'mood'; w.ringStep = -1;
    if (w.mood) w.bubble.redraw(w.mood, 'mood');
    s.visible = !!w.mood;
    s.material.opacity = 1; s.center.x = .5; s.scale.set(1.05, 1.05, 1); w.pop = 0;
  }
  function swear(w, text = SWEAR, shake = .7) {
    w.swear?.dispose();
    w.swear = makeLabel(text, { bg: '#e5482f', fg: '#ffffff', border: '#ffffff', height: .62, onTop: true });
    w.swear.sprite.position.set(.15, 3.05, 0);
    w.person.add(w.swear.sprite);
    if (shake > 0) w.shake = Math.max(w.shake || 0, shake);
  }
  function drop(w) {
    if (w.dropped) return;
    w.dropped = true;
    leaving.delete(w);
    w.onArrive = w.then = null;
    w.swear?.dispose();
    w.bubble.dispose();
    w.person.removeFromParent();
    disposeScene(w.person);
  }

  function placeCup(at) {
    if (!at) return;
    let obj;
    if (cupTemplate) { obj = cupTemplate.clone(); obj.scale.setScalar(1.6); }
    else obj = new THREE.Mesh(new THREE.CylinderGeometry(.07, .06, .14, 10).translate(0, .07, 0), new THREE.MeshStandardMaterial({ color: 0xf4f1e6 }));
    obj.position.set(at.x, at.y, at.z);
    obj.traverse(o => { o.raycast = () => {}; });
    group.add(obj);
    vfx.burst('steam', obj.position, { count: 4 });
    cups.push({ obj, until: clockNow + CUP_MS, owned: !cupTemplate });
  }
  function removeCup(i) {
    const c = cups[i];
    c.obj.removeFromParent();
    if (c.owned) { c.obj.geometry.dispose(); c.obj.material.dispose(); }
    cups.splice(i, 1);
  }

  // Called before the store sync removes the order, so the walker leaves with the right mood and the cup lands on the table.
  function onServed(orderId) {
    const w = walkers.get(orderId);
    claims.delete(orderId);
    if (!w) return null;
    w.mood = '😊';
    placeCup(w.seat?.cup);
    vfx.burst('coin', w.person.position);
    vfx.burst('heart', w.person.position);
    return w.person.position;
  }
  // angry: a seated customer ran out of patience — red swear bubble, shake, red puff, stomps off fast.
  // reason (customerLeft event): sets the leave mood; 'closed' also gets the swear label.
  function onLeft(orderId, angry = false, reason = 'patience') {
    const w = walkers.get(orderId);
    if (!w) return;
    w.mood = (Object.hasOwn(MOODS, reason) && MOODS[reason]) || '💢';
    if (reason !== 'fight') vfx.burst('puff', w.person.position, angry ? { color: 0xe5533f, count: 10 } : undefined);
    if (reason === 'closed' && !angry) swear(w, SWEAR, 0);
    if (!angry) return;
    w.angry = true;
    sfx('cafe.angry');
    swear(w, SWEAR, .7);
  }

  function step(w, dt, speed) {
    if (!w.tinted && w.person.userData.dressed) tint(w);
    const p = w.person.position;
    const legs = w.person.userData.legs;
    if (!w.path.length) return true;
    const target = w.path[0];
    const dx = target.x - p.x, dz = target.z - p.z, dist = Math.hypot(dx, dz);
    const move = speed * dt;
    if (dist <= move) { p.x = target.x; p.z = target.z; w.path.shift(); }
    else { p.x += dx / dist * move; p.z += dz / dist * move; w.faceYaw = Math.atan2(dx, dz); }
    // dressPerson detects walking from the hidden block legs' swing.
    w.phase += dt * 9;
    if (legs) { legs[0].rotation.x = Math.sin(w.phase) * .6; legs[1].rotation.x = -Math.sin(w.phase) * .6; }
    return !w.path.length;
  }
  function turn(w, yaw, dt) {
    let d = yaw - w.person.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    w.person.rotation.y += d * dampK(10, dt);
  }

  // ── fights ────────────────────────────────────────────────────────────────────────────────────────────────────
  // aborted: an order vanished / got seated mid-fight → both shown again, the other walks back, onDone({aborted}).
  // onDone is queued and fired from update (never inside sync: a dispatch there would re-enter sync mid-loop);
  // silent (region change / reset) drops it.
  function endFight(f, aborted, silent = false) {
    const i = fights.indexOf(f);
    if (i < 0) return;
    fights.splice(i, 1);
    if (!aborted) { // reappear a little apart, dizzy
      f.a.person.position.set(f.mx - f.dx * .6, 0, f.mz - f.dz * .6);
      f.b.person.position.set(f.mx + f.dx * .6, 0, f.mz + f.dz * .6);
      vfx.burst('dust', { x: f.mx, y: .3, z: f.mz }, { count: 6 });
    }
    for (const w of [f.a, f.b]) {
      w.fight = null; w.person.visible = true;
      if (!aborted) { w.dazed = DAZE; w.status = null; }
      if (walkers.get(w.id) === w && w.stage === 'waiting') setPath(w, w.slotX, w.slotZ, false);
    }
    if (f.onDone && !silent) doneQueue.push(f);
    else f.onDone = null;
  }
  function updateFights(dt) {
    if (doneQueue.length) {
      const n = doneQueue.length; // callbacks may queue more: those wait for the next frame
      for (let i = 0; i < n; i++) {
        const f = doneQueue[i], cb = f.onDone;
        f.onDone = null;
        if (cb) safe(cb, f.idA, f.idB, { aborted: !f.finished });
      }
      doneQueue.splice(0, n);
    }
    if (!fights.length) return;
    for (const f of fights.slice()) { // callbacks may end other fights (snapshot; skip the ended ones)
      if (!fights.includes(f)) continue;
      f.t += dt;
      if (f.phase === 'walk') {
        if (f.sayB > 0 && (f.sayB -= dt) <= 0) speech?.say(f.b.person, t(sayKey('fight', Math.random())), { tone: 'angry', priority: 2 });
        if ((!f.a.path.length && !f.b.path.length) || f.t > FIGHT_WALK_MAX) {
          f.phase = 'cloud'; f.t = 0;
          f.a.person.visible = f.b.person.visible = false;
          speech?.fightCloud(f.mx, f.mz, { seconds: FIGHT_S });
          vfx.burst('dust', { x: f.mx, y: .3, z: f.mz }, { count: 10 });
          sfx('cafe.angry');
        }
      } else if (f.t >= FIGHT_S) {
        f.finished = true;
        endFight(f, false);
        const cb = f.onDone; f.onDone = null; // finished in update: call right away (dazed walkers visible this frame)
        const k = doneQueue.indexOf(f);
        if (k >= 0) doneQueue.splice(k, 1);
        if (cb) safe(cb, f.idA, f.idB, { aborted: false });
      }
    }
  }

  // Per frame: movement, sitting, bubbles, patience timeout, spawn timer, tutorial customer, served cups, incidents.
  function update(dt, time, state, now, playing) {
    // `cur` is set only by sync(): `state` may be the frame-start snapshot, older than a dispatch made this frame.
    tick += dt;
    if (claims.size) for (const [id, c] of claims) if (tick - c.at > CLAIM_TTL) claims.delete(id);
    const r = regionOf(state);
    // Paused café (player on the farm): the clock stands still at the pause moment, nothing times out or arrives.
    if (r?.shop.pausedAt) { now = Math.min(now, r.shop.pausedAt); playing = false; }
    clockNow = now;
    const orders = r?.shop.orders || [];
    arrivals.length = 0;
    let waiting = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const w = walkers.get(o.id);
      if (o.stage === 'waiting') waiting++;
      if (!w) continue;
      const far = o.stage === 'waiting' && w.rush && !w.arrived && Math.hypot(w.person.position.x - w.slotX, w.person.position.z - w.slotZ) > RUSH_DIST;
      const arrived = step(w, dt, w.fight ? SPEED * 1.3 : far ? SPEED * RUSH : SPEED);
      const atSeat = arrived && !!w.seat && o.stage !== 'waiting';
      if (atSeat && !w.person.userData.seated) { w.person.userData.seated = true; w.bubble.sprite.position.y = BUBBLE_SEATED_Y; }
      turn(w, atSeat ? w.seat.yaw : arrived && !w.fight ? Math.PI : w.faceYaw, dt); // queue: face the counters (north)
      const sprite = w.bubble.sprite;
      if (o.stage === 'waiting') {
        if (arrived && !w.arrived && !w.fight && !w.cut) { w.arrived = true; w.arrivedAt = now; arrivals.push(o.id); }
        const left = Math.max(0, 1 - (now - o.at) / patienceMs);
        if (w.dazed > 0) { // after a fight: 💫 instead of the patience bar for a moment
          w.dazed = Math.max(0, w.dazed - dt);
          if (w.status !== 'daze') { w.status = 'daze'; w.ringStep = -1; w.bubble.redraw('💫', 'mood'); }
          sprite.material.opacity = 1;
          sprite.center.x = .5 + Math.sin(time * 7 + w.phase) * .05;
        } else {
          const s = Math.ceil(left * BAR_STEPS);
          // Not ordered yet: no drink shown, just "💬" (wants to order) + the patience bar.
          if (s !== w.ringStep || w.status !== 'patience') { w.ringStep = s; w.status = 'patience'; w.bubble.redraw('💬', 'patience', left); }
          // About to run out: blink + shake so the player sees who to serve first.
          const low = left <= LOW;
          sprite.material.opacity = low ? .55 + .45 * Math.abs(Math.sin(time * 9)) : 1;
          sprite.center.x = low ? .5 + Math.sin(time * 38 + w.phase) * .035 : .5;
        }
        if (left <= 0 && playing && !w.leftSent && !w.fight) { w.leftSent = true; dispatch('shop/customerLeft', { orderId: o.id }); }
        continue;
      }
      const ready = o.stage === 'brewing' && now - o.brewStart >= o.brewMs;
      const k = o.stage === 'brewing' ? Math.min(1, (now - o.brewStart) / o.brewMs) : 0;
      // Seat patience: counts from takenAt; out of time (even with a ready cup) → they leave angry.
      const pLeft = 1 - seatPatienceRatio(o, now);
      const status = ready ? 'ready' : 'brew', s = (ready ? 1000 : Math.floor(k * BAR_STEPS) * 100) + Math.ceil(pLeft * BAR_STEPS);
      if (w.status !== status || w.ringStep !== s) { w.status = status; w.ringStep = s; w.bubble.redraw(w.icon, status, k, pLeft); }
      const low = pLeft <= LOW && w.person.userData.seated;
      sprite.material.opacity = low ? .55 + .45 * Math.abs(Math.sin(time * 9)) : 1;
      sprite.center.x = low ? .5 + Math.sin(time * 38 + w.phase) * .035 : .5;
      if (pLeft <= 0 && playing && !w.leftSent) { w.leftSent = true; dispatch('shop/customerLeft', { orderId: o.id }); }
      // Ready drinks make the bubble bounce to draw attention.
      const base = w.person.userData.seated ? BUBBLE_SEATED_Y : BUBBLE_Y;
      sprite.position.y = base + (ready ? Math.abs(Math.sin(time * 5)) * .25 : 0);
      if (w.pop > 0) { // order just taken: the bubble pops with the drink
        w.pop = Math.max(0, w.pop - dt);
        const k = 1.05 * (1 + Math.sin((1 - w.pop / .45) * Math.PI) * .45);
        sprite.scale.set(k, k, 1);
        if (!w.pop) sprite.scale.set(1.05, 1.05, 1);
      }
    }
    updateFights(dt);
    for (const w of leaving) {
      // Angry customers shake on the spot for a moment, then stomp off quickly.
      if (w.shake > 0) {
        w.shake -= dt;
        w.person.position.x += Math.sin(time * 60) * .025;
        if (w.swear) w.swear.sprite.position.y = 3.05 + Math.abs(Math.sin(time * 14)) * .12;
        continue;
      }
      if (w.mode === 'stand') {
        turn(w, w.faceYaw, dt);
        if ((w.standT -= dt) <= 0) away(w, exitPoint(w), null);
        continue;
      }
      if (!step(w, dt, SPEED * w.speedK)) { turn(w, w.faceYaw, dt); continue; }
      if (w.mode === 'balk') { // reached the tail of the line: stare at it, the director decides
        w.mode = 'stand'; w.standT = BALK_STAND; w.faceYaw = Math.PI;
        const cb = w.then; w.then = null;
        if (cb && safe(cb, w) === true) drop(w);
      } else if (w.onArrive) {
        const cb = w.onArrive; w.onArrive = null;
        w.mode = 'stand'; w.standT = STAND_MAX;
        if (safe(cb, w) === true) drop(w);
      } else drop(w);
    }
    for (const id of arrivals) if (hooks.onArrived && walkers.has(id)) safe(hooks.onArrived, id);
    for (let i = cups.length - 1; i >= 0; i--) {
      const c = cups[i], left = c.until - now;
      if (left <= 0) removeCup(i);
      else if (left < 400) c.obj.scale.setScalar((cupTemplate ? 1.6 : 1) * left / 400);
    }
    if (!playing || !r || r.status !== 'active') return;
    // Tutorial needs a customer right now.
    spawnClock += dt * 1000;
    const tutorialNeedsCustomer = waiting === 0 && spawnClock > 400 && currentStep(state, 'cafe')?.step.id === 'takeOrder';
    if (tutorialNeedsCustomer || spawnClock >= arrivalMs(state)) {
      spawnClock = 0;
      const look = Math.floor(Math.random() * 1000);
      if (waiting < queueCap(state)) dispatch('shop/spawnCustomer', { roll: Math.random(), look });
      else if (hooks.onSpawnBlocked && !tutorialNeedsCustomer) safe(hooks.onSpawnBlocked, look);
    }
  }

  // ── incident API helpers ────────────────────────────────────────────────────────────────────────────────────────
  function freeById(id) { for (const w of leaving) if (w.id === id) return w; return null; }
  const isFree = w => !!w && !w.dropped && leaving.has(w);
  const pt = p => (p && Number.isFinite(+p.x) && Number.isFinite(+p.z) ? { x: +p.x, z: +p.z } : null);
  const waitingOrder = id => { const w = walkers.get(id); return w && w.stage === 'waiting' ? w : null; };

  function claimLeave(orderId, plan = {}) {
    if (!waitingOrder(orderId)) return false;
    const p = plan && typeof plan === 'object' ? plan : {};
    claims.set(orderId, { plan: { ...p, target: pt(p.target) }, at: tick });
    return true;
  }

  const api = {
    group, sync, update, onServed, onLeft,
    /** Late-bind { onSpawnBlocked(look), onArrived(orderId) } (only the given keys change). */
    setHooks(h = {}) { hooks = { ...hooks, ...h }; },
    walker: id => walkers.get(id) || null,
    /** Any walker by id: order walkers (also while leaving) and transient balkers ('b<n>'). */
    walkerById: id => walkers.get(id) || freeById(id),
    /**
     * Order id of the first waiting customer who is standing in the queue at the Order Counter (null while everyone
     * is still walking in). Orders are only taken from customers who reached the counter — otherwise a customer
     * would go straight from the street to a seat without ever queueing. Cutters / fighters / hidden are not queued.
     */
    queuedOrder(state) {
      for (const o of regionOf(state)?.shop.orders || []) {
        if (o.stage !== 'waiting') continue;
        const w = walkers.get(o.id);
        if (!w || w.cut || w.fight || !w.person.visible) continue;
        if (!w.path.length && Math.hypot(w.person.position.x - w.slotX, w.person.position.z - w.slotZ) < .3) return o.id;
      }
      return null;
    },
    /** Pick boxes of seated customers (tap a customer to deliver their cup). */
    *pickers() { for (const w of walkers.values()) if (w.person.userData.seated) yield w.pick; },
    /** Seat spots of the current region (for badges / debugging). */
    get seats() { return spots; },

    /**
     * Snapshot for the director: waiting orders in line order. slot = line index (-1 = cutting), patience 0..1 left,
     * arrivedAt = store time the walker first reached the line (0 = still walking in).
     */
    info() {
      const r = cur ? regionOf(cur) : null;
      const orders = r?.shop.orders || [];
      const waiting = [];
      let seated = 0;
      for (const o of orders) {
        if (o.stage !== 'waiting') { seated++; continue; }
        const w = walkers.get(o.id) || null;
        waiting.push({ id: o.id, walker: w, slot: w ? (w.cut ? -1 : w.qi) : -1,
          patience: Math.max(0, Math.min(1, 1 - (clockNow - o.at) / patienceMs)),
          arrivedAt: w?.arrived ? w.arrivedAt : 0, cut: !!w?.cut, fighting: !!w?.fight });
      }
      return { waiting, cap: cur ? queueCap(cur) : 0, seated };
    },
    /**
     * Crowd balk: a transient walker (no order) walks from an entry to the tail of the line, stops and calls
     * then(walker). Returns the walker, or null when too many balkers are around.
     */
    balk(look, then) {
      let n = 0;
      for (const w of leaving) if (w.transient) n++;
      if (n >= MAX_BALK) return null;
      const from = pickEntry();
      const w = makeWalker('b' + (++balkSeq), Number.isFinite(+look) ? +look : Math.floor(Math.random() * 1000), '☕', from.x, from.z);
      w.transient = true; w.stage = 'leaving'; w.mode = 'balk'; w.then = typeof then === 'function' ? then : null;
      w.pick.userData.target = null; w.bubble.sprite.visible = false;
      let line = 0;
      for (const v of walkers.values()) if (v.stage === 'waiting' && !v.cut) line++;
      const tail = cafeQueueSlot(line + 1);
      const tx = tail.x + (Math.random() - .5) * .5, tz = Math.min(117, tail.z + .5);
      routeTo(w, tx, tz, true);
      leaving.add(w);
      return w;
    },
    /**
     * Mark a waiting walker so that, when its order disappears (the director dispatches shop/customerLeft right after),
     * it follows plan { target:{x,z}, mood, label (true | text), speed (×), onArrive(walker) } instead of the default
     * exit. Returns false when there is no such waiting walker.
     */
    claimLeave,
    unclaim(orderId) { return claims.delete(orderId); },
    /**
     * Send a waiting order's walker to `target` once its order is gone. Before shop/customerLeft = claimLeave; after it
     * (the walker is already heading out) = re-route now. onArrive(walker) on arrival.
     */
    divert(orderId, target, { mood, speed, onArrive, label } = {}) {
      if (walkers.has(orderId)) return claimLeave(orderId, { target, mood, speed, onArrive, label });
      const w = freeById(orderId);
      const to = pt(target);
      if (!w || !to) return false;
      if (mood) w.mood = mood;
      if (label) swear(w, label === true ? SWEAR : String(label), 0);
      away(w, to, onArrive, speed, true);
      return true;
    },
    /** That waiting walker steps out of line to stand beside the head (not queued). */
    cut(orderId) {
      const w = waitingOrder(orderId);
      if (!w || w.cut || w.fight) return false;
      w.cut = true; resync();
      return true;
    },
    /** Back into the line (its normal slot, usually the tail). */
    uncut(orderId) {
      const w = walkers.get(orderId);
      if (!w || !w.cut) return false;
      w.cut = false; resync();
      return true;
    },
    /** Fight between two waiting walkers (see the header). false when it cannot start (onDone is then never called). */
    fight(idA, idB, onDone) {
      const a = waitingOrder(idA), b = waitingOrder(idB);
      if (!a || !b || a === b || a.fight || b.fight) return false;
      const pa = a.person.position, pb = b.person.position;
      let dx = pb.x - pa.x, dz = pb.z - pa.z;
      const d = Math.hypot(dx, dz);
      if (d < .01) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      const f = { a, b, idA, idB, mx: (pa.x + pb.x) / 2, mz: (pa.z + pb.z) / 2, dx, dz, t: 0, phase: 'walk', sayB: .7,
        onDone: typeof onDone === 'function' ? onDone : null };
      a.fight = b.fight = f;
      a.cut = b.cut = false; a.dazed = b.dazed = 0;
      for (const [w, s] of [[a, -1], [b, 1]]) {
        const tx = f.mx + dx * .35 * s, tz = f.mz + dz * .35 * s;
        w.path.length = 0; stand(w);
        if (Math.hypot(w.person.position.x - tx, w.person.position.z - tz) < 3 || !navigate) w.path.push({ x: tx, z: tz });
        else setPath(w, tx, tz, false);
      }
      fights.push(f);
      speech?.say(a.person, t(sayKey('fight', Math.random())), { tone: 'angry', priority: 2 });
      return true;
    },
    /** Nearest walk-in entry (alley or street end) to x. */
    entryFor,
    /** Free walker → walk to point (default: a way out) and disappear there. */
    exitTo(w, point) {
      if (!isFree(w)) return false;
      w.then = null;
      away(w, pt(point) || exitPoint(w), null);
      return true;
    },
    /** Free walker (leaver / balker) → walk to target, then onArrive(walker); return true from it to dispose the walker. */
    sendAway(w, target, onArrive, { mood, speed } = {}) {
      const to = pt(target);
      if (!isFree(w) || !to) return false;
      w.then = null;
      if (mood) w.mood = mood;
      away(w, to, onArrive, speed, true);
      return true;
    },
    /** Free walker: show a leave mood (and optionally the red swear label: true or a text). */
    mood(w, emoji, label) {
      if (!w || w.dropped) return false;
      w.mood = emoji || '';
      if (label) swear(w, label === true ? SWEAR : String(label), 0);
      if (isFree(w)) showMood(w);
      return true;
    },
    /** Hand a free walker's Object3D over (e.g. to street.js): removed here, NOT disposed — the caller owns it. */
    release(w) {
      if (!isFree(w)) return null;
      w.dropped = true;
      leaving.delete(w);
      w.onArrive = w.then = null;
      w.swear?.dispose(); w.swear = null;
      w.bubble.sprite.removeFromParent(); w.bubble.dispose();
      w.pick.removeFromParent();
      w.person.removeFromParent();
      return { person: w.person, look: w.look, x: w.person.position.x, z: w.person.position.z };
    },

    reset() {
      synced = false; seatOf.clear(); claims.clear();
      for (const f of [...fights]) endFight(f, true, true);
      doneQueue.length = 0;
      for (const w of [...walkers.values()]) { walkers.delete(w.id); drop(w); }
      for (const w of [...leaving]) drop(w);
      for (let i = cups.length - 1; i >= 0; i--) removeCup(i);
    },
    dispose() { api.reset(); group.removeFromParent(); },
  };
  return api;
}
