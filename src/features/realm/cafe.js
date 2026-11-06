// Café customers. Store orders are the source of truth: each order has one walker (createPerson + dressPerson).
//  · waiting        → queue slot at the Order Counter (patience ring in the bubble)
//  · taken/brewing  → walks to a free seat (seats.js: terrace stools + Tables chairs) and SITS (person.userData.seated);
//                     the bubble shows the drink + its state (⏳ being made / ☕ ready, bouncing)
//  · served         → the cup appears on the table at the seat, coins fly up, the customer stands up and leaves
// The core guarantees a free seat for every taken order (shop/takeOrder fails with 'noSeat' otherwise).
// The realm owns spawning (timer = derive.arrivalMs) and patience (SHOP.patienceSeconds → shop/customerLeft).
import * as THREE from 'three';
import { DRINKS, SHOP } from '../../core/config/economy.js';
import { CUSTOMER, CAFE_ROADS } from '../../core/config/layout.js';
import { region as regionOf, arrivalMs, queueCap } from '../../core/derive.js';
import { currentStep } from '../../core/tutorial.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { makeCanvasSprite, drawEmoji, dampK } from './util.js';
import { seatSpots } from './seats.js';

const SPEED = 2.4;
const STREET_Z = (CAFE_ROADS.cafeFront.rect[1] + CAFE_ROADS.cafeFront.rect[3]) / 2; // customers leave along the street
const SHIRTS = ['#e0794f', '#4f8fd0', '#6aa85a', '#c45a8a', '#e3b13e', '#7a6bc4'];
// The guest GLB textures are pale beige/olive, so every guest read as the same grey figure. Once dressed, each walker
// gets its own material clone tinted with a pastel (per look) and brightened a little; the texture stays shared.
const TINTS = ['#ffc9b0', '#bcd6ff', '#c8efb4', '#ffc4df', '#ffe49a', '#d6c8ff', '#a8ece4', '#ffd6a0'].map(h => new THREE.Color(h).multiplyScalar(1.12));
const RING_STEPS = 48; // bubble redraws only when the patience ring moves a step
const BUBBLE_Y = 2.55, BUBBLE_SEATED_Y = 2.15;
const CUP_MS = 6000;   // served cup stays on the table this long

// status: '' (queue, with patience ring) | 'wait' (⏳ being made) | 'ready' (☕ ready, green ring)
function drawBubble(g, size, icon = '☕', ring = -1, mood = '', status = '') {
  const c = size / 2;
  g.fillStyle = 'rgba(60,35,15,.22)';
  g.beginPath(); g.arc(c, c - 6, c * .62, 0, Math.PI * 2); g.fill();
  g.fillStyle = status === 'ready' ? '#eaffdf' : '#fffaf0';
  g.beginPath(); g.arc(c, c - 10, c * .6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(c - 12, c + c * .45); g.lineTo(c, c + c * .78); g.lineTo(c + 12, c + c * .45); g.fill();
  if (ring >= 0 || status === 'ready') {
    g.lineWidth = 10; g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,.08)';
    g.beginPath(); g.arc(c, c - 10, c * .6 - 4, 0, Math.PI * 2); g.stroke();
    const k = status === 'ready' ? 1 : ring;
    g.strokeStyle = status === 'ready' || k > .5 ? '#5bbf5a' : k > .25 ? '#f0b53a' : '#e0543f';
    g.beginPath(); g.arc(c, c - 10, c * .6 - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.stroke();
  }
  drawEmoji(g, mood || icon, c, c - 8, size * .36);
  if (status && !mood) { // state chip at the top-right of the bubble
    const x = c + c * .48, y = c - c * .62;
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, size * .15, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3; g.strokeStyle = status === 'ready' ? '#3fa13f' : '#c99a5e'; g.stroke();
    drawEmoji(g, status === 'ready' ? '☕' : '⏳', x, y + 1, size * .17);
  }
}

export function createCafe({ scene, vfx, dispatch, templates = {} }) {
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
    const bubble = makeCanvasSprite(128, drawBubble, { scale: .95 });
    bubble.sprite.position.y = BUBBLE_Y;
    person.add(bubble.sprite);
    group.add(person);
    return { id: order.id, person, bubble, icon: DRINKS[order.drink]?.icon || '☕', stage: '', ringStep: -1, status: null, path: [], phase: Math.random() * 6, faceYaw: Math.PI, leftSent: false, mood: '', tint: TINTS[look % TINTS.length], tinted: false, seat: null };
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
  function setPath(w, tx, tz, toSeat) {
    const p = w.person.position;
    w.path.length = 0;
    stand(w);
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
    w.path.push({ x: p.x, z: STREET_Z }, { x: CUSTOMER.exit.x, z: STREET_Z }, { x: CUSTOMER.exit.x, z: CUSTOMER.exit.z });
    w.bubble.redraw(w.icon, -1, w.mood || '');
    w.bubble.sprite.visible = !!w.mood;
    leaving.add(w);
  }
  function drop(w) {
    leaving.delete(w);
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
  function onLeft(orderId) {
    const w = walkers.get(orderId);
    if (w) { w.mood = '💢'; vfx.burst('puff', w.person.position); }
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
      if (o.stage === 'waiting') {
        const ring = Math.max(0, 1 - (now - o.at) / patienceMs);
        const s = Math.ceil(ring * RING_STEPS);
        if (s !== w.ringStep || w.status !== '') { w.ringStep = s; w.status = ''; w.bubble.redraw(w.icon, ring); }
        if (ring <= 0 && playing && !w.leftSent) { w.leftSent = true; dispatch('shop/customerLeft', { orderId: o.id }); }
        continue;
      }
      const ready = o.stage === 'brewing' && now - o.brewStart >= o.brewMs;
      const status = ready ? 'ready' : 'wait';
      if (w.status !== status) { w.status = status; w.bubble.redraw(w.icon, -1, '', status); }
      // Ready drinks make the bubble bounce to draw attention.
      const base = w.person.userData.seated ? BUBBLE_SEATED_Y : BUBBLE_Y;
      w.bubble.sprite.position.y = base + (ready ? Math.abs(Math.sin(time * 5)) * .25 : 0);
    }
    for (const w of leaving) {
      if (step(w, dt, w.mood === '💢' ? SPEED * .7 : SPEED)) drop(w);
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
