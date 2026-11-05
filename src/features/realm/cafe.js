// Café customers. Store orders are the source of truth: each order has one walker (createPerson + dressPerson) whose
// target follows the order stage (waiting → queue slot, taken/brewing → pickup). The realm owns spawning
// (timer = derive.arrivalMs) and patience (SHOP.patienceSeconds → shop/customerLeft).
import * as THREE from 'three';
import { DRINKS, SHOP } from '../../core/config/economy.js';
import { CUSTOMER } from '../../core/config/layout.js';
import { region as regionOf, arrivalMs, queueCap } from '../../core/derive.js';
import { currentStep } from '../../core/tutorial.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { makeCanvasSprite, drawEmoji, dampK } from './util.js';

const SPEED = 2.4;
const SHIRTS = ['#e0794f', '#4f8fd0', '#6aa85a', '#c45a8a', '#e3b13e', '#7a6bc4'];
// The guest GLB textures are pale beige/olive, so every guest read as the same grey figure. Once dressed, each walker
// gets its own material clone tinted with a pastel (per look) and brightened a little; the texture stays shared.
const TINTS = ['#ffc9b0', '#bcd6ff', '#c8efb4', '#ffc4df', '#ffe49a', '#d6c8ff', '#a8ece4', '#ffd6a0'].map(h => new THREE.Color(h).multiplyScalar(1.12));
const PICKUP_DX = [0, .9, -.9];
const RING_STEPS = 48; // bubble redraws only when the patience ring moves a step

function drawBubble(g, size, icon = '☕', ring = -1, mood = '') {
  const c = size / 2;
  g.fillStyle = 'rgba(60,35,15,.22)';
  g.beginPath(); g.arc(c, c - 6, c * .62, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fffaf0';
  g.beginPath(); g.arc(c, c - 10, c * .6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(c - 12, c + c * .45); g.lineTo(c, c + c * .78); g.lineTo(c + 12, c + c * .45); g.fill();
  if (ring >= 0) {
    g.lineWidth = 10; g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,.08)';
    g.beginPath(); g.arc(c, c - 10, c * .6 - 4, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = ring > .5 ? '#5bbf5a' : ring > .25 ? '#f0b53a' : '#e0543f';
    g.beginPath(); g.arc(c, c - 10, c * .6 - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring); g.stroke();
  }
  drawEmoji(g, mood || icon, c, c - 8, size * .36);
}

export function createCafe({ scene, vfx, dispatch }) {
  const group = new THREE.Group();
  group.name = 'realm-customers';
  scene.add(group);
  const walkers = new Map(); // orderId → walker
  const leaving = new Set();
  let spawnClock = 0;
  let synced = false;
  const patienceMs = SHOP.patienceSeconds * 1000;

  function makeWalker(order, x, z) {
    const look = Math.abs(order.look | 0);
    const female = look % 2 === 1;
    const person = createPerson(SHIRTS[look % SHIRTS.length], { gender: female ? 'female' : 'male' });
    dressPerson(person, female ? 'cafe/guest-f.glb' : 'cafe/guest-m.glb');
    person.position.set(x, 0, z);
    const bubble = makeCanvasSprite(128, drawBubble, { scale: .95 });
    bubble.sprite.position.y = 2.55;
    person.add(bubble.sprite);
    group.add(person);
    return { id: order.id, person, bubble, icon: DRINKS[order.drink]?.icon || '☕', stage: '', ringStep: -1, path: [], phase: Math.random() * 6, faceYaw: Math.PI, leftSent: false, mood: '', bounce: 0, tint: TINTS[look % TINTS.length], tinted: false };
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

  function setPath(w, tx, tz) {
    const p = w.person.position;
    w.path.length = 0;
    // Walk along the road (x = spawn lane) then across, unless already near the target row.
    if (Math.abs(p.x - tx) > 1 && Math.abs(p.z - tz) > .8) w.path.push({ x: CUSTOMER.spawn.x, z: tz });
    w.path.push({ x: tx, z: tz });
  }

  function slotOf(order, waitIndex, pickIndex) {
    if (order.stage === 'waiting') return { x: CUSTOMER.queue.x + waitIndex * CUSTOMER.queue.dx, z: CUSTOMER.queue.z + waitIndex * CUSTOMER.queue.dz };
    return { x: CUSTOMER.pickup.x + PICKUP_DX[pickIndex % 3], z: CUSTOMER.pickup.z + Math.floor(pickIndex / 3) * .9 };
  }

  /** instant: place walkers directly at their slots (first sync / region change / reload). */
  function sync(state, instant = false) {
    const orders = regionOf(state)?.shop.orders || [];
    const seen = new Set();
    let wi = 0, pi = 0;
    for (const o of orders) {
      seen.add(o.id);
      const slot = slotOf(o, wi, pi);
      if (o.stage === 'waiting') wi++; else pi++;
      let w = walkers.get(o.id);
      if (!w) {
        const from = instant || !synced ? slot : CUSTOMER.spawn;
        w = makeWalker(o, from.x, from.z);
        walkers.set(o.id, w);
      }
      if (w.stage !== o.stage || w.slotX !== slot.x || w.slotZ !== slot.z) {
        w.stage = o.stage; w.slotX = slot.x; w.slotZ = slot.z; w.ringStep = -1;
        setPath(w, slot.x, slot.z);
      }
    }
    for (const [id, w] of walkers) if (!seen.has(id)) leave(w, instant);
    synced = true;
  }

  function leave(w, instant) {
    walkers.delete(w.id);
    if (instant) { drop(w); return; }
    w.stage = 'leaving';
    w.path.length = 0;
    w.path.push({ x: CUSTOMER.exit.x, z: w.person.position.z }, { x: CUSTOMER.exit.x, z: CUSTOMER.exit.z });
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

  // Called before the store sync removes the order, so the walker leaves with the right mood.
  function onServed(orderId) {
    const w = walkers.get(orderId);
    if (!w) return null;
    w.mood = '😊';
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

  // Per frame: movement, patience ring, patience timeout, spawn timer, tutorial customer.
  function update(dt, time, state, now, playing) {
    const r = regionOf(state);
    const orders = r?.shop.orders || [];
    let waiting = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const w = walkers.get(o.id);
      if (o.stage === 'waiting') waiting++;
      if (!w) continue;
      const arrived = step(w, dt, SPEED);
      turn(w, arrived ? Math.PI : w.faceYaw, dt); // face the counters (north) once in place
      if (o.stage === 'waiting') {
        const ring = Math.max(0, 1 - (now - o.at) / patienceMs);
        const s = Math.ceil(ring * RING_STEPS);
        if (s !== w.ringStep) { w.ringStep = s; w.bubble.redraw(w.icon, ring); }
        if (ring <= 0 && playing && !w.leftSent) { w.leftSent = true; dispatch('shop/customerLeft', { orderId: o.id }); }
      } else if (w.ringStep !== -2) {
        w.ringStep = -2;
        w.bubble.redraw(w.icon, -1);
      }
      // Ready drinks make the bubble bounce to draw attention.
      const ready = o.stage === 'brewing' && now - o.brewStart >= o.brewMs;
      w.bubble.sprite.position.y = 2.55 + (ready ? Math.abs(Math.sin(time * 5)) * .25 : 0);
    }
    for (const w of leaving) {
      if (step(w, dt, w.mood === '💢' ? SPEED * .7 : SPEED)) drop(w);
      else turn(w, w.faceYaw, dt);
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
    reset() { synced = false; for (const w of [...walkers.values()]) { walkers.delete(w.id); drop(w); } for (const w of [...leaving]) drop(w); },
    dispose() { this.reset(); group.removeFromParent(); },
  };
}
