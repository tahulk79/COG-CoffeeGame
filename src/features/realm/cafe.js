// Café customers. Store orders are the source of truth: each order has one walker (createPerson + dressPerson).
//  · waiting        → queue slot at the Order Counter; bubble = "💬" (no drink until ordered) + patience bar (green → yellow → red,
//                     blinking + shaking in the last 20 %). No numbers.
//  · taken/brewing  → walks to a free seat (seats.js: terrace stools + Tables chairs) and SITS (person.userData.seated);
//                     bubble = drink + a brew bar that fills up, then a big ☕ (bouncing) when the cup is ready
//                     + under it the SEAT patience bar (SHOP.seatPatienceSeconds, green → yellow → red, blinks in
//                     the last 20 %). Out of patience → shop/customerLeft: they stand up, swear ("💢 #@!%"), stomp off.
//  · served         → the player carries the cup over (realm index.js); the cup lands on the table, coins fly up,
//                     the customer stands up and leaves
// Seated customers have an invisible pick box (target { kind: 'customer', orderId }) so the player can tap them.
// The core guarantees a free seat for every taken order (shop/takeOrder fails with 'noSeat' otherwise).
// The realm owns spawning (timer = derive.arrivalMs) and patience (SHOP.patienceSeconds → shop/customerLeft).
import * as THREE from 'three';
import { DRINKS, SHOP } from '../../core/config/economy.js';
import { CUSTOMER, CAFE_ROADS } from '../../core/config/layout.js';
import { region as regionOf, arrivalMs, queueCap, seatPatienceRatio } from '../../core/derive.js';
import { currentStep } from '../../core/tutorial.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { makeCanvasSprite, makeLabel, drawEmoji, dampK } from './util.js';
import { sfx } from '../../shared/audio/index.js';
import { seatSpots } from './seats.js';

const SPEED = 2.4;
const STREET_Z = (CAFE_ROADS.cafeFront.rect[1] + CAFE_ROADS.cafeFront.rect[3]) / 2; // customers leave along the street
const SHIRTS = ['#e0794f', '#4f8fd0', '#6aa85a', '#c45a8a', '#e3b13e', '#7a6bc4'];
// The guest GLB textures are pale beige/olive, so every guest read as the same grey figure. Once dressed, each walker
// gets its own material clone tinted with a pastel (per look) and brightened a little; the texture stays shared.
const TINTS = ['#ffc9b0', '#bcd6ff', '#c8efb4', '#ffc4df', '#ffe49a', '#d6c8ff', '#a8ece4', '#ffd6a0'].map(h => new THREE.Color(h).multiplyScalar(1.12));
const BAR_STEPS = 40; // bubble redraws only when a bar moves a step
const LOW = .2;        // last 20 % of patience: blink + shake
const BUBBLE_Y = 2.55, BUBBLE_SEATED_Y = 2.15;
const CUP_MS = 6000;   // served cup stays on the table this long

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

export function createCafe({ scene, vfx, dispatch, templates = {}, navigate = null }) {
  const group = new THREE.Group();
  group.name = 'realm-customers';
  scene.add(group);
  const walkers = new Map(); // orderId → walker
  const leaving = new Set();
  const seatOf = new Map();  // orderId → seat index (seats.js order)
  let spots = [];
  const cups = [];           // served cups on tables: { obj, until }
  const cupTemplate = templates['cafe/props.glb#cup'] || null;
  let spawnClock = 0;
  let synced = false;
  let clockNow = 0;
  const patienceMs = SHOP.patienceSeconds * 1000;

  function makeWalker(order, x, z) {
    const look = Math.abs(order.look | 0);
    const female = look % 2 === 1;
    const person = createPerson(SHIRTS[look % SHIRTS.length], { gender: female ? 'female' : 'male' });
    dressPerson(person, female ? 'cafe/guest-f.glb' : 'cafe/guest-m.glb');
    person.position.set(x, 0, z);
    const bubble = makeCanvasSprite(128, drawBubble, { scale: 1.05 });
    bubble.sprite.position.y = BUBBLE_Y;
    person.add(bubble.sprite);
    const pick = new THREE.Mesh(pickGeo, pickMat);
    pick.visible = false;
    pick.userData.target = { kind: 'customer', orderId: order.id };
    person.add(pick);
    group.add(person);
    return { id: order.id, person, bubble, pick, icon: DRINKS[order.drink]?.icon || '☕', stage: '', ringStep: -1, status: null, path: [], phase: Math.random() * 6, faceYaw: Math.PI, leftSent: false, mood: '', tint: TINTS[look % TINTS.length], tinted: false, seat: null };
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

  // Queue: up the alley (spawn lane), then across to the queue slot. Seat: straight to the chair.
  // Grid path (nav.js) around counters, buildings and houses; seats inside a Tables footprint are reached exactly.
  function setPath(w, tx, tz, toSeat) {
    const p = w.person.position;
    w.path.length = 0;
    stand(w);
    const list = navigate ? navigate(p.x, p.z, tx, tz, { exact: true }) : null;
    if (list?.length) { for (const q of list) w.path.push(q); return; }
    if (!toSeat && Math.abs(p.x - tx) > 1 && Math.abs(p.z - tz) > .8) w.path.push({ x: CUSTOMER.spawn.x, z: tz });
    w.path.push({ x: tx, z: tz });
  }

  function queueSlot(i) { return { x: CUSTOMER.queue.x + i * CUSTOMER.queue.dx, z: CUSTOMER.queue.z + i * CUSTOMER.queue.dz }; }

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
    const orders = regionOf(state)?.shop.orders || [];
    spots = seatSpots(state);
    assignSeats(orders);
    const seen = new Set();
    let wi = 0;
    for (const o of orders) {
      seen.add(o.id);
      const seated = o.stage !== 'waiting';
      const seat = seated ? spots[Math.min(seatOf.get(o.id) ?? 0, spots.length - 1)] : null;
      const slot = seated ? seat : queueSlot(wi++);
      let w = walkers.get(o.id);
      if (!w) {
        const from = instant || !synced ? slot : CUSTOMER.spawn;
        w = makeWalker(o, from.x, from.z);
        walkers.set(o.id, w);
        if (from === slot) w.stage = o.stage; // placed directly (reload): no walk
      }
      if (w.stage !== o.stage || w.slotX !== slot.x || w.slotZ !== slot.z) {
        const wasSeated = w.stage === 'taken' || w.stage === 'brewing';
        if (w.stage === 'waiting' && o.stage === 'taken') w.pop = .45; // the drink pops into the bubble once ordered
        w.stage = o.stage; w.slotX = slot.x; w.slotZ = slot.z; w.ringStep = -1; w.seat = seat;
        // taken → brewing keeps the customer seated; anything else walks to the new slot.
        if (!(wasSeated && seated && w.person.userData.seated && Math.hypot(w.person.position.x - slot.x, w.person.position.z - slot.z) < .05)) setPath(w, slot.x, slot.z, seated);
      }
    }
    for (const [id, w] of walkers) if (!seen.has(id)) leave(w, instant);
    synced = true;
  }

  function leave(w, instant) {
    walkers.delete(w.id);
    seatOf.delete(w.id);
    if (instant) { drop(w); return; }
    w.stage = 'leaving';
    stand(w);
    w.path.length = 0;
    const p = w.person.position;
    // Out to the street, along it to the alley, then away (same way they came).
    const list = navigate ? navigate(p.x, p.z, CUSTOMER.exit.x, CUSTOMER.exit.z) : null;
    if (list?.length) for (const q of list) w.path.push(q);
    else w.path.push({ x: p.x, z: STREET_Z }, { x: CUSTOMER.exit.x, z: CUSTOMER.exit.z });
    w.bubble.redraw(w.mood || w.icon, 'mood');
    w.bubble.sprite.visible = !!w.mood;
    w.bubble.sprite.material.opacity = 1; w.bubble.sprite.center.x = .5;
    leaving.add(w);
  }
  function drop(w) {
    leaving.delete(w);
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
    if (!w) return null;
    w.mood = '😊';
    placeCup(w.seat?.cup);
    vfx.burst('coin', w.person.position);
    vfx.burst('heart', w.person.position);
    return w.person.position;
  }
  // angry: a seated customer ran out of patience — red swear bubble, shake, red puff, stomps off fast.
  function onLeft(orderId, angry = false) {
    const w = walkers.get(orderId);
    if (!w) return;
    w.mood = '💢';
    vfx.burst('puff', w.person.position, angry ? { color: 0xe5533f, count: 10 } : undefined);
    if (!angry) return;
    w.angry = true;
    w.shake = .7;
    sfx('cafe.angry');
    w.swear = makeLabel('💢 #@!%', { bg: '#e5482f', fg: '#ffffff', border: '#ffffff', height: .62, onTop: true });
    w.swear.sprite.position.set(.15, 3.05, 0);
    w.person.add(w.swear.sprite);
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

  // Per frame: movement, sitting, bubbles, patience timeout, spawn timer, tutorial customer, served cups.
  function update(dt, time, state, now, playing) {
    clockNow = now;
    const r = regionOf(state);
    const orders = r?.shop.orders || [];
    let waiting = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const w = walkers.get(o.id);
      if (o.stage === 'waiting') waiting++;
      if (!w) continue;
      const arrived = step(w, dt, SPEED);
      const atSeat = arrived && !!w.seat && o.stage !== 'waiting';
      if (atSeat && !w.person.userData.seated) { w.person.userData.seated = true; w.bubble.sprite.position.y = BUBBLE_SEATED_Y; }
      turn(w, atSeat ? w.seat.yaw : arrived ? Math.PI : w.faceYaw, dt); // queue: face the counters (north)
      const sprite = w.bubble.sprite;
      if (o.stage === 'waiting') {
        const left = Math.max(0, 1 - (now - o.at) / patienceMs);
        const s = Math.ceil(left * BAR_STEPS);
        // Not ordered yet: no drink shown, just "💬" (wants to order) + the patience bar.
        if (s !== w.ringStep || w.status !== 'patience') { w.ringStep = s; w.status = 'patience'; w.bubble.redraw('💬', 'patience', left); }
        // About to run out: blink + shake so the player sees who to serve first.
        const low = left <= LOW;
        sprite.material.opacity = low ? .55 + .45 * Math.abs(Math.sin(time * 9)) : 1;
        sprite.center.x = low ? .5 + Math.sin(time * 38 + w.phase) * .035 : .5;
        if (left <= 0 && playing && !w.leftSent) { w.leftSent = true; dispatch('shop/customerLeft', { orderId: o.id }); }
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
    for (const w of leaving) {
      // Angry customers shake on the spot for a moment, then stomp off quickly.
      if (w.shake > 0) {
        w.shake -= dt;
        w.person.position.x += Math.sin(time * 60) * .025;
        if (w.swear) w.swear.sprite.position.y = 3.05 + Math.abs(Math.sin(time * 14)) * .12;
        continue;
      }
      if (step(w, dt, w.angry ? SPEED * 1.45 : w.mood === '💢' ? SPEED * .7 : SPEED)) drop(w);
      else turn(w, w.faceYaw, dt);
    }
    for (let i = cups.length - 1; i >= 0; i--) {
      const c = cups[i], left = c.until - now;
      if (left <= 0) removeCup(i);
      else if (left < 400) c.obj.scale.setScalar((cupTemplate ? 1.6 : 1) * left / 400);
    }
    if (!playing || !r || r.status !== 'active') return;
    // Tutorial needs a customer right now.
    spawnClock += dt * 1000;
    const tutorialNeedsCustomer = waiting === 0 && spawnClock > 400 && currentStep(state)?.step.id === 'takeOrder';
    if (tutorialNeedsCustomer || spawnClock >= arrivalMs(state)) {
      spawnClock = 0;
      if (waiting < queueCap(state)) spawn();
    }
  }
  function spawn() {
    dispatch('shop/spawnCustomer', { roll: Math.random(), look: Math.floor(Math.random() * 1000) });
  }

  return {
    group, sync, update, onServed, onLeft,
    walker: id => walkers.get(id) || null,
    /**
     * Order id of the first waiting customer who is standing in the queue at the Order Counter (null while everyone
     * is still walking in). Orders are only taken from customers who reached the counter — otherwise a customer
     * would go straight from the street to a seat without ever queueing.
     */
    queuedOrder(state) {
      for (const o of regionOf(state)?.shop.orders || []) {
        if (o.stage !== 'waiting') continue;
        const w = walkers.get(o.id);
        if (w && !w.path.length && Math.hypot(w.person.position.x - w.slotX, w.person.position.z - w.slotZ) < .3) return o.id;
      }
      return null;
    },
    /** Pick boxes of seated customers (tap a customer to deliver their cup). */
    *pickers() { for (const w of walkers.values()) if (w.person.userData.seated) yield w.pick; },
    /** Seat spots of the current region (for badges / debugging). */
    get seats() { return spots; },
    reset() {
      synced = false; seatOf.clear();
      for (const w of [...walkers.values()]) { walkers.delete(w.id); drop(w); }
      for (const w of [...leaving]) drop(w);
      for (let i = cups.length - 1; i >= 0; i--) removeCup(i);
    },
    dispose() { this.reset(); group.removeFromParent(); },
  };
}
