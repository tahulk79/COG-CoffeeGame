// Café street: the 3 venue shops (lemon tea · tea house · bar), simulated (docs/design/cafe-street.md §3.3).
// Venue customers are realm-only and transient (never saved); core only keeps unlocks, sales and ratings.
//  · Open venue → a built-in vendor NPC stands behind the counter (VENUE_LOTS[id].vendor; cafe/staff.glb tinted per
//    venue) and turns to the head customer. Locked venue → no vendor, no spawns (the shutter is venues-scene.js).
//  · Walk-ins: one every venueArrivalMs (rating included) × 0.6–1.4 jitter, from the nearest street end / the alley
//    (sometimes another one), into the queue (venueQueueSlot: head at the counter, then 2 lines). At most MAX_LIVE
//    customers per venue (queue + stools; people walking away do not count) and lot.queue.max in the queue.
//  · Queue bubble: the venue icon (what they want) + a patience bar (VENUES[id].patienceSeconds; blinks + shakes in
//    the last 20 %; drains at 60 % while every stool is taken — they can see why). At INCIDENTS.switchAt → the
//    director hook `street.onWaitingLow(venue, cid, walker)` fires once. Out of patience → grumbles (`patience` line),
//    2★ review 40 %, stomps off to the nearest street end; `street.onLeft(venue, cid, 'patience')`.
//  · Vendor serves the head every serveSeconds while it stands at the counter AND a stool is free (else the head
//    waits and the line grows): bob + steam while working → dispatch `shop/venueSale {venue, item}` (weighted roll,
//    the cheapest item ×2), coins burst from the vendor, the item pops into the customer's bubble, they walk to the
//    stool (seat spots from venues-scene.js), sit (person.userData.seated) for VENUES[id].stay s with flavour
//    (tea: bow 🙇 → 🍵 · lemon: 🌻 + chatting with neighbours · bar: 🍺 clink 🍻, sometimes 🎤 karaoke), then leave
//    via the nearest street end; bar guests are drunk (INCIDENTS.drunkChance): zig-zag wobble + "Hic!".
//    Served: `street.onServed(venue, cid, waitedRatio)`; 30 % (rate-limited per venue) a review (5★ < 40 % waited,
//    4★ < 75 %, else 3★) via shop/review + speech.review; else sometimes a `happy` line.
//  · Player tap on a waiting customer (serveTap) serves instantly (no vendor time) with a sparkle — still needs a free
//    stool, otherwise the customer says `noSeat`.
//  · Paused café (region.shop.pausedAt) → the whole street is frozen. Timers (patience, serving, stays, spawns) only run
//    while playing in an active region; walking always finishes.
//  · All time is the street's own clock (s, advanced by dt), so pausing / reloading never makes patience jump.
import * as THREE from 'three';
import { VENUES, VENUE_ITEMS, INCIDENTS, VENUE_ORDER } from '../../core/config/economy.js';
import { VENUE_LOTS, venueQueueSlot, STREET_ENDS, CUSTOMER } from '../../core/config/layout.js';
import { region as regionOf, venueOpen, venueArrivalMs } from '../../core/derive.js';
import { createPerson } from '../../characters/player.js';
import { dressPerson } from '../../characters/npc.js';
import { disposeScene } from '../../shared/three/dispose-scene.js';
import { makeCanvasSprite, drawEmoji, dampK } from './util.js';
import { sfx } from '../../shared/audio/index.js';
import { sayKey, toneFor } from './speech.js';
import * as venuesScene from './venues-scene.js'; // namespace import: a missing venueSeatSpots falls back to the lot seats

const IDS = VENUE_ORDER.filter(id => VENUE_LOTS[id] && VENUES[id]);
const SPEED = 2.4;
const MAX_LIVE = 10;
const SERVE_VAR = [.7, 1.8];  // × serveSeconds per cup
const BREAK_CHANCE = .3, BREAK_S = [3, 8]; // vendor restock / chat break after a cup (s)
const GROUP_CHANCE = .25;    // a walk-in is a group of 2–3
const BAR_STEPS = 40, LOW = .2;
const BUBBLE_Y = 2.55, BUBBLE_SEATED_Y = 2.15;
const TABLE_Z = 116.2;           // stools face the low tables between the 2 rows
const MOOD_S = 2.4;              // seated mood emoji shows this long, then hides
const REVIEW_GAP = 8;            // s between happy reviews per venue
const SHIRTS = ['#e0794f', '#4f8fd0', '#6aa85a', '#c45a8a', '#e3b13e', '#7a6bc4'];
const TINTS = ['#ffc9b0', '#bcd6ff', '#c8efb4', '#ffc4df', '#ffe49a', '#d6c8ff', '#a8ece4', '#ffd6a0'].map(h => new THREE.Color(h).multiplyScalar(1.12));
const VENDOR_TINT = { tea: '#f4c79c', lemon: '#e4f58e', bar: '#c9b2ff' };
const VENDOR_SHIRT = { tea: '#a8452f', lemon: '#e3c22e', bar: '#5b3fa8' };
const BOW = .32;                 // tea bow lean (rad)

const rand = (a, b) => a + Math.random() * (b - a);

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const barColor = k => (k > .5 ? '#4cc24a' : k > LOW ? '#f2b53a' : '#e5482f');
// Same look as the café bubbles (cafe.js): mode 'patience' = icon + time-left bar, 'mood' = emoji only.
function drawBubble(g, size, icon = '💬', mode = 'mood', k = 1) {
  const c = size / 2;
  const x = 10, y = 6, w = size - 20, h = size * .66;
  g.fillStyle = 'rgba(60,35,15,.22)'; roundRect(g, x, y + 4, w, h, 22); g.fill();
  g.fillStyle = '#fffaf0'; roundRect(g, x, y, w, h, 22); g.fill();
  g.beginPath(); g.moveTo(c - 12, y + h - 1); g.lineTo(c, size * .86); g.lineTo(c + 12, y + h - 1); g.fill();
  if (mode === 'mood') { drawEmoji(g, icon, c, y + h / 2 + 2, size * .44); return; }
  drawEmoji(g, icon, c, y + h * .36, size * .3);
  const bx = x + 12, bw = w - 24, by = y + h * .68, bh = 13;
  g.fillStyle = 'rgba(70,45,25,.18)'; roundRect(g, bx, by, bw, bh, bh / 2); g.fill();
  const kk = Math.max(0, Math.min(1, k));
  if (kk > .01) { g.fillStyle = barColor(kk); roundRect(g, bx, by, Math.max(bh, bw * kk), bh, bh / 2); g.fill(); }
  g.lineWidth = 2.5; g.strokeStyle = 'rgba(70,45,25,.35)'; roundRect(g, bx, by, bw, bh, bh / 2); g.stroke();
}

const pickGeo = new THREE.BoxGeometry(.9, 1.9, .9).translate(0, .95, 0);
pickGeo.userData.keep = true;
const pickMat = new THREE.MeshBasicMaterial();
pickMat.userData.keep = true;
const cupGeo = new THREE.CylinderGeometry(.07, .06, .14, 10).translate(0, .07, 0);
cupGeo.userData.keep = true;
const cupMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e6 });
cupMat.userData.keep = true;

// Seat spots of a venue: venues-scene.js knows the real stools; fallback = lot seats facing the tables (z 116.2).
function seatsOf(id) {
  let list = null;
  try { list = venuesScene.venueSeatSpots?.(id); } catch { list = null; }
  if (Array.isArray(list) && list.length) return list;
  return VENUE_LOTS[id].seats.map(s => ({ x: s.x, z: s.z, row: s.row, yaw: s.z < TABLE_Z ? 0 : Math.PI, cup: { x: s.x, y: .5, z: s.z < TABLE_Z ? s.z + .55 : s.z - .55 } }));
}

export function createStreet({ scene, vfx, dispatch, navigate = null, speech = null, templates = {} }) {
  const group = new THREE.Group();
  group.name = 'realm-street';
  scene.add(group);
  const cupTemplate = templates['cafe/props.glb#cup'] || null;
  const V = {};
  for (const id of IDS) V[id] = makeVenue(id);
  const leaving = new Set();
  let nextCid = 1;
  let clk = 0;            // street clock (s): advances only while not paused
  let regionKey;
  const tmp = new THREE.Vector3();

  function makeVenue(id) {
    const lot = VENUE_LOTS[id];
    return { id, lot, def: VENUES[id], open: false, vendor: null, seats: [], seatBy: [], queue: [], all: new Map(),
      spawnClock: 0, spawnAt: 0, serveT: 0, serveNeed: 0, breakT: 0, steamT: 0, idleT: rand(14, 26), happyAt: -Infinity, dirty: false,
      vendorPos: new THREE.Vector3(lot.vendor.x, 1.6, lot.vendor.z), counterPos: new THREE.Vector3(lot.counter.x, 1.15, lot.counter.z) };
  }

  // ---------- people ----------
  function tint(o3d, color) {
    o3d.traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.map) return;
      const m = o.material.clone();
      m.userData = {}; // per-walker clone, disposed with it (the shared texture stays kept)
      m.color.copy(color);
      o.material = m;
    });
  }

  function makePerson(look, file, shirt) {
    const female = look % 2 === 1;
    const person = createPerson(shirt, { gender: female ? 'female' : 'male' });
    dressPerson(person, file || (female ? 'cafe/guest-f.glb' : 'cafe/guest-m.glb'));
    return person;
  }

  function makeCustomer(v, x, z, look, tintColor) {
    look = Math.abs(look | 0);
    const person = makePerson(look, null, SHIRTS[look % SHIRTS.length]);
    person.position.set(x, 0, z);
    const bubble = makeCanvasSprite(128, drawBubble, { scale: 1.05 });
    bubble.sprite.position.y = BUBBLE_Y;
    person.add(bubble.sprite);
    const cid = nextCid++;
    const pick = new THREE.Mesh(pickGeo, pickMat);
    pick.visible = false;
    pick.userData.target = { kind: 'venueCustomer', venue: v.id, cid };
    person.add(pick);
    group.add(person);
    const c = {
      cid, venue: v.id, look, person, bubble, pick, path: [], phase: Math.random() * 6, faceYaw: Math.PI,
      tint: tintColor?.isColor ? tintColor : TINTS[look % TINTS.length], tinted: false,
      stage: 'queue', slotX: NaN, slotZ: NaN, waited: 0, arrivedAt: clk * 1000, patienceMs: v.def.patienceSeconds * 1000,
      lowSent: false, status: '', ringStep: -1, mood: '', moodUntil: 0, pop: 0, icon: v.def.icon, item: null,
      seat: -1, spot: null, seated: false, stayLeft: 0, flavorT: 0, bow: 0, cup: null, sayHappy: false,
      drunk: false, angry: false, shake: 0, wobX: 0, wobZ: 0, divert: null, lookYaw: null,
    };
    v.all.set(cid, c);
    return c;
  }

  function setPath(c, tx, tz) {
    const p = c.person.position;
    c.path.length = 0;
    const list = navigate ? navigate(p.x, p.z, tx, tz, { exact: true }) : null;
    if (list?.length) { for (const q of list) c.path.push(q); return; }
    // fallback: out to the street, along it, then in
    if (Math.abs(p.x - tx) > 1.5) { c.path.push({ x: p.x, z: 120 }, { x: tx, z: 120 }); }
    c.path.push({ x: tx, z: tz });
  }

  function stand(c) {
    c.seated = false; c.person.userData.seated = false;
    c.bubble.sprite.position.y = BUBBLE_Y;
  }

  function showMood(c, icon, s = MOOD_S) {
    c.mood = icon; c.moodUntil = clk + s; c.status = ''; c.pop = .45;
  }

  function nearestEnd(x) {
    return Math.abs(x - STREET_ENDS.west.x) <= Math.abs(x - STREET_ENDS.east.x) ? STREET_ENDS.west : STREET_ENDS.east;
  }

  function entryFor(v) {
    const ends = [STREET_ENDS.west, STREET_ENDS.east, CUSTOMER.spawn];
    const h = v.lot.queue.head;
    let best = ends[0];
    for (const e of ends) if (Math.hypot(e.x - h.x, e.z - h.z) < Math.hypot(best.x - h.x, best.z - h.z)) best = e;
    if (Math.random() < .65) return best;
    const others = ends.filter(e => e !== best);
    return others[(Math.random() * others.length) | 0];
  }

  function live(v) { return v.all.size; } // leaving customers are removed from v.all
  const queueCap = v => Math.max(0, Math.min(v.lot.queue.max, MAX_LIVE));

  // ---------- queue ----------
  function reslot(v) {
    v.dirty = false;
    for (let i = 0; i < v.queue.length; i++) {
      const c = v.queue[i];
      const s = venueQueueSlot(v.id, i);
      if (!s || (c.slotX === s.x && c.slotZ === s.z)) continue;
      c.slotX = s.x; c.slotZ = s.z; c.ringStep = -1;
      setPath(c, s.x, s.z);
    }
  }

  function unqueue(v, c) {
    const i = v.queue.indexOf(c);
    if (i >= 0) { v.queue.splice(i, 1); v.dirty = true; if (i === 0) v.serveT = 0; }
  }

  function freeSeat(v) {
    for (let i = 0; i < v.seats.length; i++) if (!v.seatBy[i]) return i;
    return -1;
  }

  function rollItem(v) {
    const items = (v.def.items || []).filter(i => VENUE_ITEMS[i]).sort((a, b) => VENUE_ITEMS[a].price - VENUE_ITEMS[b].price);
    if (!items.length) return null;
    const total = items.length + 1; // cheapest weighs 2
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) { r -= i === 0 ? 2 : 1; if (r < 0) return items[i]; }
    return items[items.length - 1];
  }

  function starsFor(ratio) { return ratio < .4 ? 5 : ratio < .75 ? 4 : 3; }

  // Vendor (or the player's tap) hands the item over: sale → stool.
  function serve(v, c, tap) {
    if (!v.open || c.stage !== 'queue') return false;
    const seat = freeSeat(v);
    if (seat < 0) return false;
    const item = rollItem(v);
    if (!item) return false;
    const res = dispatch('shop/venueSale', { venue: v.id, item });
    if (!res?.ok) return false;
    if (!v.all.has(c.cid) || c.stage !== 'queue') return false; // a sync inside dispatch removed it
    unqueue(v, c);
    v.seatBy[seat] = c;
    c.seat = seat; c.spot = v.seats[seat]; c.stage = 'seat'; c.item = item;
    c.icon = VENUE_ITEMS[item].icon;
    showMood(c, c.icon, 99);
    c.bubble.sprite.material.opacity = 1; c.bubble.sprite.center.x = .5;
    vfx?.burst('coin', v.vendor ? v.vendorPos : c.person.position);
    if (tap) { tmp.copy(c.person.position); tmp.y = 1.6; vfx?.burst('sparkle', tmp, { count: 10 }); }
    sfx('coin.gain');
    setPath(c, c.spot.x, c.spot.z);
    const ratio = Math.min(1, c.waited / c.patienceMs);
    if (Math.random() < .3 && clk - v.happyAt >= REVIEW_GAP) {
      v.happyAt = clk;
      const stars = starsFor(ratio);
      dispatch('shop/review', { venue: v.id, stars, reason: 'served' });
      speech?.review?.(c.person, stars, sayKey('happy', Math.random()));
    } else c.sayHappy = Math.random() < INCIDENTS.happyLineChance;
    api.onServed?.(v.id, c.cid, ratio);
    return true;
  }

  // Leaves the venue (queue or stool) towards the nearest street end (or `to`, then calls onArrive).
  function leave(c, { mood = '', angry = false, to = null, onArrive = null } = {}) {
    const v = V[c.venue];
    if (!v || !v.all.has(c.cid)) return false;
    v.all.delete(c.cid);
    unqueue(v, c);
    if (c.seat >= 0 && v.seatBy[c.seat] === c) v.seatBy[c.seat] = null;
    removeCup(c);
    c.seat = -1; c.spot = null;
    c.stage = 'leave';
    c.person.rotation.x = 0;
    stand(c);
    c.angry = angry; c.shake = angry ? .6 : 0;
    c.divert = to ? { to, onArrive } : null;
    c.mood = mood; c.moodUntil = clk + (mood ? 3 : 0); c.status = '';
    c.bubble.sprite.material.opacity = 1; c.bubble.sprite.center.x = .5;
    const end = to || nearestEnd(c.person.position.x);
    setPath(c, end.x, end.z);
    leaving.add(c);
    return true;
  }

  function drop(c) {
    leaving.delete(c);
    const v = V[c.venue];
    if (v?.all.get(c.cid) === c) {
      v.all.delete(c.cid); unqueue(v, c);
      if (c.seat >= 0 && v.seatBy[c.seat] === c) v.seatBy[c.seat] = null;
    }
    removeCup(c);
    c.bubble.dispose();
    c.person.removeFromParent();
    disposeScene(c.person);
    c.stage = 'gone';
  }

  function placeCup(c) {
    const at = c.spot?.cup;
    if (!at || c.cup) return;
    let obj;
    if (cupTemplate) { obj = cupTemplate.clone(); obj.scale.setScalar(1.6); }
    else obj = new THREE.Mesh(cupGeo, cupMat);
    obj.position.set(at.x, at.y ?? .5, at.z);
    obj.traverse(o => { o.raycast = () => {}; });
    group.add(obj);
    c.cup = obj;
  }
  function removeCup(c) { if (c.cup) { c.cup.removeFromParent(); c.cup = null; } }

  // ---------- vendor ----------
  function makeVendor(v) {
    const lot = v.lot;
    const person = makePerson(v.id === 'lemon' ? 1 : 0, 'cafe/staff.glb', VENDOR_SHIRT[v.id] || '#ffffff');
    person.position.set(lot.vendor.x, 0, lot.vendor.z);
    person.rotation.y = 0; // faces the street (south, +z)
    group.add(person);
    v.vendor = { person, tinted: false, tint: new THREE.Color(VENDOR_TINT[v.id] || '#ffffff') };
  }
  function dropVendor(v) {
    if (!v.vendor) return;
    v.vendor.person.removeFromParent();
    disposeScene(v.vendor.person);
    v.vendor = null;
  }

  function openVenue(v) {
    v.open = true;
    v.seats = seatsOf(v.id);
    v.seatBy = v.seats.map(() => null);
    v.spawnClock = 0;
    v.spawnAt = rand(1500, 3500); // first guest soon after opening / entering
    v.serveT = 0; v.serveNeed = 0; v.breakT = 0;
    makeVendor(v);
  }
  function closeVenue(v) {
    v.open = false;
    for (const c of [...v.all.values()]) drop(c);
    v.queue.length = 0;
    dropVendor(v);
  }

  // ---------- movement ----------
  function step(c, dt, speed) {
    if (!c.tinted && c.person.userData.dressed) { c.tinted = true; tint(c.person, c.tint); }
    const p = c.person.position;
    if (!c.path.length) return true;
    const target = c.path[0];
    const dx = target.x - p.x, dz = target.z - p.z, dist = Math.hypot(dx, dz);
    const move = speed * dt;
    if (dist <= move) { p.x = target.x; p.z = target.z; c.path.shift(); }
    else { p.x += dx / dist * move; p.z += dz / dist * move; c.faceYaw = Math.atan2(dx, dz); }
    c.phase += dt * 9;
    const legs = c.person.userData.legs;
    if (legs) { legs[0].rotation.x = Math.sin(c.phase) * .6; legs[1].rotation.x = -Math.sin(c.phase) * .6; }
    return !c.path.length;
  }
  function turn(o3d, yaw, dt, k = 10) {
    let d = yaw - o3d.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    o3d.rotation.y += d * dampK(k, dt);
  }

  function bubbleMood(c, time) {
    const s = c.bubble.sprite;
    const show = !!c.mood && clk < c.moodUntil;
    s.visible = show;
    if (!show) return;
    if (c.status !== 'mood:' + c.mood) { c.status = 'mood:' + c.mood; c.bubble.redraw(c.mood, 'mood'); }
    s.material.opacity = 1; s.center.x = .5;
  }
  function popBubble(c, dt) {
    if (!(c.pop > 0)) return;
    c.pop = Math.max(0, c.pop - dt);
    const k = 1.05 * (1 + Math.sin((1 - c.pop / .45) * Math.PI) * .4);
    c.bubble.sprite.scale.set(k, k, 1);
    if (!c.pop) c.bubble.sprite.scale.set(1.05, 1.05, 1);
  }

  // ---------- seated flavour ----------
  function neighbour(v, c) {
    const a = c.spot;
    if (!a) return null;
    let best = null, bd = 1.9;
    for (const o of v.seatBy) {
      if (!o || o === c || !o.seated || !o.spot) continue;
      const d = Math.hypot(o.spot.x - a.x, o.spot.z - a.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  function sitDown(v, c) {
    c.seated = true; c.person.userData.seated = true;
    c.bubble.sprite.position.y = BUBBLE_SEATED_Y;
    const [a, b] = v.def.stay || [6, 10];
    c.stayLeft = rand(a, b);
    c.flavorT = rand(2.5, 4.5);
    placeCup(c);
    if (c.cup) { tmp.copy(c.cup.position); tmp.y += .2; vfx?.burst('steam', tmp, { count: 3 }); }
    if (v.id === 'tea') { c.bow = 1.2; showMood(c, '🙇', 1.3); }
    else if (v.id === 'lemon') showMood(c, '🌻');
    else showMood(c, '🍺');
    if (c.sayHappy) { c.sayHappy = false; speech?.say?.(c.person, sayKey('happy', Math.random()), { tone: 'happy', y: 2.6 }); }
  }

  function flavour(v, c) {
    c.flavorT = rand(3, 6);
    const n = neighbour(v, c);
    if (v.id === 'tea') {
      showMood(c, Math.random() < .5 ? '🍵' : '🥮');
      if (Math.random() < .35) speech?.say?.(c.person, sayKey('tea', Math.random()), { tone: toneFor('tea'), y: 2.6 });
    } else if (v.id === 'lemon') {
      if (n) {
        // chatting: face each other a little, alternating bubbles
        c.lookYaw = Math.atan2(n.person.position.x - c.person.position.x, n.person.position.z - c.person.position.z);
        showMood(c, Math.random() < .5 ? '💬' : '😂');
        if (Math.random() < .4) speech?.say?.(c.person, sayKey('lemon', Math.random()), { tone: toneFor('lemon'), y: 2.6 });
      } else showMood(c, '🌻');
    } else if (v.id === 'bar') {
      if (n && Math.random() < .6) {
        showMood(c, '🍻'); showMood(n, '🍻');
        tmp.set((c.person.position.x + n.person.position.x) / 2, 1.3, (c.person.position.z + n.person.position.z) / 2);
        vfx?.burst('sparkle', tmp, { count: 6 });
        sfx('cafe.cup');
        if (Math.random() < .3) speech?.say?.(c.person, sayKey('drunk', Math.random()), { tone: toneFor('drunk'), y: 2.6 });
      } else if (Math.random() < .25) {
        showMood(c, '🎤', 3);
        speech?.say?.(c.person, sayKey('bar', Math.random()), { tone: toneFor('bar'), y: 2.6 });
      } else showMood(c, '🍺');
    }
  }

  function finishStay(v, c) {
    const drunk = v.id === 'bar' && Math.random() < INCIDENTS.drunkChance;
    leave(c, { mood: drunk ? '🥴' : '😊' });
    c.drunk = drunk;
    if (drunk) speech?.say?.(c.person, sayKey('drunk', Math.random()), { tone: toneFor('drunk') });
  }

  function patienceLeave(v, c) {
    const angryLine = sayKey('patience', Math.random());
    if (Math.random() < .4) {
      dispatch('shop/review', { venue: v.id, stars: 2, reason: 'patience' });
      speech?.review?.(c.person, 2, angryLine);
    } else speech?.say?.(c.person, angryLine, { tone: 'angry', priority: 1 });
    const cid = c.cid;
    leave(c, { mood: '💢', angry: true });
    vfx?.burst('puff', c.person.position, { color: 0xe5533f, count: 8 });
    api.onLeft?.(v.id, cid, 'patience');
  }

  // ---------- per frame ----------
  function update(dt, time, state, now, playing) {
    const r = state ? regionOf(state) : null;
    if (r?.shop?.pausedAt) return; // café paused (player on the farm): the whole street stands still
    dt = Math.min(dt, .1);
    clk += dt;
    const ticking = !!playing && r?.status === 'active';
    for (const id of IDS) updateVenue(V[id], dt, time, state, ticking);
    for (const c of leaving) updateLeaving(c, dt, time);
  }

  function updateVenue(v, dt, time, state, ticking) {
    if (!v.open) return;
    if (v.dirty) reslot(v);
    const head = v.queue[0] || null;
    const atCounter = !!head && !head.path.length && Math.hypot(head.person.position.x - head.slotX, head.person.position.z - head.slotZ) < .3;
    const seat = freeSeat(v);
    const full = seat < 0;
    let working = false;
    // Vendor downtime so lines can actually build (switch / patience incidents): each cup takes serveSeconds ×0.7–1.8,
    // and after a cup the vendor sometimes takes a short restock / chat break.
    if (ticking && v.breakT > 0) v.breakT -= dt;
    else if (ticking && atCounter && !full) {
      working = true;
      if (!(v.serveNeed > 0)) v.serveNeed = v.def.serveSeconds * rand(SERVE_VAR[0], SERVE_VAR[1]);
      v.serveT += dt;
      v.steamT -= dt;
      if (v.steamT <= 0) { v.steamT = .8; vfx?.burst(v.id === 'bar' ? 'sparkle' : 'steam', v.counterPos, { count: 3 }); }
      if (v.serveT >= v.serveNeed) {
        v.serveT = 0; v.serveNeed = 0;
        serve(v, head, false);
        if (Math.random() < BREAK_CHANCE) v.breakT = rand(BREAK_S[0], BREAK_S[1]);
      }
    } else if (!atCounter) v.serveT = 0;

    // vendor: faces the head customer (or the street), bobs while working
    const vd = v.vendor;
    if (vd) {
      if (!vd.tinted && vd.person.userData.dressed) { vd.tinted = true; tint(vd.person, vd.tint); }
      const hp = head?.person.position;
      const yaw = hp ? Math.atan2(hp.x - v.lot.vendor.x, hp.z - v.lot.vendor.z) : 0;
      turn(vd.person, yaw, dt, 6);
      vd.person.position.y = working ? Math.abs(Math.sin(time * 9)) * .06 : 0;
      vd.person.rotation.x = working ? Math.sin(time * 9) * .05 : 0;
      if (ticking && !v.queue.length) {
        v.idleT -= dt;
        if (v.idleT <= 0) { v.idleT = rand(18, 30); if (Math.random() < .5) speech?.say?.(vd.person, sayKey('vendorIdle', Math.random()), { y: 2.7 }); }
      }
    }

    // walk-ins
    if (ticking) {
      v.spawnClock += dt * 1000;
      if (v.spawnClock >= v.spawnAt) {
        v.spawnClock = 0;
        v.spawnAt = Math.max(800, (venueArrivalMs(state, v.id) || v.def.arrivalSeconds * 1000) * rand(.6, 1.4));
        // Sometimes a small group walks in together (2–3), so a line forms now and then.
        const group = Math.random() < GROUP_CHANCE ? 2 + (Math.random() < .4 ? 1 : 0) : 1;
        for (let g = 0; g < group && v.queue.length < queueCap(v) && live(v) < MAX_LIVE; g++) {
          const from = entryFor(v);
          const c = makeCustomer(v, from.x - Math.sign(from.x || 1) * g * .8, from.z, Math.floor(Math.random() * 1000));
          v.queue.push(c); v.dirty = true;
        }
      }
    }
    if (v.dirty) reslot(v);

    for (const c of v.all.values()) {
      if (c.stage === 'queue') updateQueued(v, c, dt, time, ticking, full);
      else if (c.stage === 'seat') updateSeated(v, c, dt, time, ticking);
    }
  }

  function updateQueued(v, c, dt, time, ticking, full) {
    const arrived = step(c, dt, SPEED);
    turn(c.person, arrived ? Math.PI : c.faceYaw, dt); // queue: face the counter (north)
    if (ticking) c.waited += dt * 1000 * (full ? .6 : 1);
    const left = Math.max(0, 1 - c.waited / c.patienceMs);
    const sprite = c.bubble.sprite;
    if (c.mood && clk < c.moodUntil) bubbleMood(c, time); // adopted: shows its mood a moment first
    else {
      sprite.visible = true;
      const s = Math.ceil(left * BAR_STEPS);
      if (s !== c.ringStep || c.status !== 'patience') { c.ringStep = s; c.status = 'patience'; c.bubble.redraw(c.icon, 'patience', left); }
      const low = left <= LOW;
      sprite.material.opacity = low ? .55 + .45 * Math.abs(Math.sin(time * 9)) : 1;
      sprite.center.x = low ? .5 + Math.sin(time * 38 + c.phase) * .035 : .5;
    }
    popBubble(c, dt);
    if (!ticking) return;
    if (left <= INCIDENTS.switchAt && !c.lowSent) {
      c.lowSent = true;
      api.onWaitingLow?.(v.id, c.cid, c);
      if (c.stage !== 'queue') return; // the director moved it
    }
    if (left <= 0) patienceLeave(v, c);
  }

  function updateSeated(v, c, dt, time, ticking) {
    const spot = c.spot;
    const arrived = step(c, dt, SPEED);
    if (arrived && spot && !c.seated) sitDown(v, c);
    const yaw = c.seated ? (c.lookYaw ?? spot?.yaw ?? 0) : c.faceYaw;
    turn(c.person, yaw, dt);
    if (c.bow > 0) { // tea ceremony bow
      c.bow = Math.max(0, c.bow - dt);
      c.person.rotation.x = Math.sin((1 - c.bow / 1.2) * Math.PI) * BOW;
      if (!c.bow) { c.person.rotation.x = 0; showMood(c, '🍵'); }
    }
    bubbleMood(c, time);
    popBubble(c, dt);
    if (!c.seated || !ticking) return;
    c.flavorT -= dt;
    if (c.flavorT <= 0) { c.lookYaw = null; flavour(v, c); }
    c.stayLeft -= dt;
    if (c.stayLeft <= 0) finishStay(v, c);
  }

  function updateLeaving(c, dt, time) {
    const p = c.person.position;
    p.x -= c.wobX; p.z -= c.wobZ; c.wobX = c.wobZ = 0;
    if (c.shake > 0) { c.shake -= dt; p.x += Math.sin(time * 60) * .02; bubbleMood(c, time); return; }
    const speed = c.angry ? SPEED * 1.4 : c.drunk ? SPEED * .6 : SPEED;
    const done = step(c, dt, speed);
    turn(c.person, c.faceYaw, dt);
    if (c.drunk) { // zig-zag: sideways offset across the walking direction + sway
      const w = Math.sin(time * 3.2 + c.phase * .1) * .45;
      c.wobX = Math.cos(c.faceYaw) * w; c.wobZ = -Math.sin(c.faceYaw) * w;
      p.x += c.wobX; p.z += c.wobZ;
      c.person.rotation.z = Math.sin(time * 3.2) * .12;
    }
    bubbleMood(c, time);
    popBubble(c, dt);
    if (!done) return;
    if (c.divert) {
      const { onArrive } = c.divert;
      c.divert = null;
      let taken = false;
      try { taken = onArrive?.(c) === true; } catch (e) { console.warn(e); }
      if (taken) { drop(c); return; }
      const end = nearestEnd(p.x);
      if (Math.hypot(p.x - end.x, p.z - end.z) > .5) { setPath(c, end.x, end.z); return; }
    }
    drop(c);
  }

  // ---------- store sync ----------
  function sync(state) {
    const key = state?.world?.currentRegion ?? null;
    if (key !== regionKey) { clear(); regionKey = key; }
    const r = state ? regionOf(state) : null;
    for (const id of IDS) {
      const v = V[id];
      const open = !!r && venueOpen(state, id);
      if (open && !v.open) openVenue(v);
      else if (!open && v.open) closeVenue(v);
    }
  }

  function clear() {
    for (const id of IDS) {
      const v = V[id];
      for (const c of [...v.all.values()]) drop(c);
      v.queue.length = 0;
      dropVendor(v);
      v.open = false; v.seatBy = []; v.serveT = 0; v.spawnClock = 0;
    }
    for (const c of [...leaving]) drop(c);
    regionKey = undefined;
  }

  const findC = (venue, cid) => (typeof venue === 'string' && Object.hasOwn(V, venue) ? V[venue].all.get(cid) || null : null);

  const api = {
    group, sync, update, clear,
    /** Director hooks (set by incidents.js): onWaitingLow(venue, cid, walker), onLeft(venue, cid, reason), onServed(venue, cid, waitedRatio). */
    onWaitingLow: null, onLeft: null, onServed: null,
    /**
     * A customer from elsewhere (café walker / {x, z, look}) joins `venueId`'s queue as a NEW walker at that spot
     * (the caller drops its own walker when this returns true). false = locked / unknown / full.
     */
    adopt(from, venueId, { mood = '' } = {}) {
      const v = typeof venueId === 'string' && Object.hasOwn(V, venueId) ? V[venueId] : null;
      if (!v || !v.open || v.queue.length >= queueCap(v) || live(v) >= MAX_LIVE) return false;
      const pos = from?.person?.position || from;
      const x = Number.isFinite(pos?.x) ? pos.x : STREET_ENDS.west.x, z = Number.isFinite(pos?.z) ? pos.z : STREET_ENDS.west.z;
      const look = Number.isFinite(from?.look) ? from.look : Math.floor(Math.random() * 1000);
      const c = makeCustomer(v, x, z, look, from?.tint);
      if (from?.person) c.person.rotation.y = from.person.rotation.y;
      if (mood) showMood(c, mood, 1.6);
      v.queue.push(c); v.dirty = true;
      reslot(v);
      return true;
    },
    info(venueId) {
      const v = typeof venueId === 'string' && Object.hasOwn(V, venueId) ? V[venueId] : null;
      if (!v) return { waiting: [], cap: 0, seated: 0, open: false };
      const waiting = v.queue.map((c, slot) => ({ id: c.cid, cid: c.cid, walker: c, person: c.person, slot,
        patience: Math.max(0, 1 - c.waited / c.patienceMs), arrivedAt: c.arrivedAt }));
      let seated = 0;
      for (const c of v.seatBy) if (c) seated++;
      return { waiting, cap: queueCap(v), seated, seats: v.seats.length, open: v.open };
    },
    /** Player tapped a waiting venue customer: instant serve (needs a free stool, else they say noSeat). true = handled. */
    serveTap(target) {
      if (target?.kind !== 'venueCustomer') return false;
      const v = V[target.venue], c = findC(target.venue, target.cid);
      if (!v || !c || c.stage !== 'queue') return false;
      if (freeSeat(v) < 0) { speech?.say?.(c.person, sayKey('noSeat', Math.random()), { tone: toneFor('noSeat'), priority: 2 }); return true; }
      serve(v, c, true);
      return true;
    },
    /** Pick boxes of waiting venue customers (target { kind: 'venueCustomer', venue, cid }). */
    *pickers() { for (const id of IDS) for (const c of V[id].queue) yield c.pick; },
    vendor(venueId) { return (typeof venueId === 'string' && Object.hasOwn(V, venueId) && V[venueId].vendor?.person) || null; },
    walker(venueId, cid) { return findC(venueId, cid); },
    /** Director: a waiting/seated customer leaves now (no review, no onLeft). */
    dismiss(venueId, cid, { mood = '', angry = false } = {}) { const c = findC(venueId, cid); return !!c && leave(c, { mood, angry }); },
    /** Director: walks to `to` {x,z}, then onArrive(walker) — return true to take it over (it is dropped), else it walks off. */
    divert(venueId, cid, to, { mood = '', onArrive = null } = {}) {
      const c = findC(venueId, cid);
      if (!c || !Number.isFinite(to?.x) || !Number.isFinite(to?.z)) return false;
      return leave(c, { mood, to: { x: to.x, z: to.z }, onArrive });
    },
    dispose() { clear(); group.removeFromParent(); },
  };
  return api;
}
