// The manager in the world — Tổng quản lý (docs/design/management-rules.md §6, phase P4).
//  · Look: createPerson block figure (no manager GLB exists, so it is not dressed): white shirt + sleeves, royal-purple
//    vest (GM.look.color, his colour only), flat cap, clipboard in the left hand; height ×GM.look.heightMul; gender
//    from the hired candidate. The arms / legs are re-hung on shoulder / hip pivots so the poses below can swing them.
//  · Idle spot: a small desk (bàn điều hành) by the gate of his zone (layout GM_DESK; farm = the gate plaza, café =
//    east edge of the café block) with a crate beside it. He stands behind the desk facing the camera.
//  · Every manager job (store event gmActed) he walks (GM.look.walkSpeed) to the unit / field / lot / building it was
//    for, points (GM.look.pointSec), and walks back. A target in the other area, or farther than GM.look.maxWalkM,
//    gets a point from the desk instead.
//  · While a task of his is open: phone pose + a 📋 countdown bubble (played clock, smoothed between the realm's
//    clock ticks) with a violet rim; a pulsing red ring under his feet when any task has < GM.look.ringLifeShare of its
//    life left. Chờ lệnh: a yawn every GM.look.yawnEverySec. Expiry: facepalm. Approved: thumbs-up. Loyalty <
//    GM.look.sadLoyalty: 😒. Strike: the desk is empty, he sits on the crate with 🪧. Chaos (the manager was poached,
//    nobody runs the team): the empty desk with 🪧 over the crate.
//  · Speech (short, respectful Vietnamese to the boss; realm.gm.* in v3-realm.js) through the realm's speech bubbles
//    with tone 'manager' (violet rim). Chatter is gated to one line per GM.look.lineGapSec; requests / expiries /
//    strike always speak. Only while his zone is on screen.
//  · Tap on him (pick box, target { kind: 'manager' }) → the realm's hooks.onManagerTap (the HUD opens the inbox).
// Per frame: no allocations (scratch vectors, damped pivot angles); the derived numbers (open tasks, time left, flags)
// are re-read 4× a second; the two canvas sprites are redrawn only when their text / emoji changes.
import * as THREE from 'three';
import { GM, CLOCK, TASKS } from '../../core/config/economy.js';
import { GM_DESK, areaAt, farmGroundY } from '../../core/config/layout.js';
import { ownedPlots } from '../../core/derive.js';
import { dressGedeoWorker } from '../../characters/gedeo-worker.js';
import { gmOf, gmZone, gmRequests, gmWaiting, gmStrike, chaosOf, playedMs } from '../../core/derive.js';
import { createPerson } from '../../characters/player.js';
import { makeCanvasSprite, drawEmoji, dampK, FONT } from './util.js';
import { t } from '../../i18n/index.js';

const L = GM.look;
const COLOR = L.color;
const SHIRT = '#f6f3ec';
const CAP = '#4e2c80';
const AREA = { farm: 'farm', shop: 'cafe' };
const ARM = { rest: [0, 0], hold: [-.95, -.12], phone: [-1.3, .25], point: [-1.55, 0], thumbs: [-1.15, .35], facepalm: [-2.55, .55], stretch: [-2.95, 0], cross: [-1.2, .75] };
const SIT_Y = -.33;
const REFRESH = .25; // s between reads of the derived numbers

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// 📋 countdown pill: violet rim, red rim when urgent.
function makePill() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 112;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.geometry.userData.keep = true;
  sprite.raycast = () => {};
  sprite.renderOrder = 30;
  sprite.scale.set(1.5, .66, 1);
  sprite.center.set(.5, 0);
  let cur = '';
  function set(text, urgent) {
    const key = `${text}|${urgent ? 1 : 0}`;
    if (key === cur) return;
    cur = key;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, 256, 112);
    g.fillStyle = 'rgba(40,20,60,.25)'; rr(g, 10, 16, 236, 80, 40); g.fill();
    g.fillStyle = '#fbf7ff'; rr(g, 10, 8, 236, 80, 40); g.fill();
    g.lineWidth = 7; g.strokeStyle = urgent ? '#e5482f' : COLOR; g.stroke();
    g.beginPath(); g.moveTo(116, 88); g.lineTo(128, 106); g.lineTo(140, 88); g.closePath(); g.fillStyle = urgent ? '#e5482f' : COLOR; g.fill();
    drawEmoji(g, '📋', 58, 50, 46);
    // 'mm:ss ·n' must end inside the rim (x 246 − padding): shrink the font to fit instead of clipping the count
    const room = 232 - 92;
    g.font = FONT.replace('{size}', '50');
    const w = g.measureText(text).width, size = w > room ? Math.max(28, Math.floor(50 * room / w)) : 50;
    g.font = FONT.replace('{size}', String(size)); g.fillStyle = urgent ? '#c4302b' : '#3f2466'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(text, 92, 51, room);
    texture.needsUpdate = true;
  }
  return { sprite, set, dispose() { sprite.removeFromParent(); texture.dispose(); material.dispose(); } };
}
// World heights over the manager (see headY): the pill's top (bottom-anchored at 2.45, .66 tall, its body ends at canvas
// row 8 of 112, + its bob), half the emote circle, the emote with no pill, the head with nothing above it, and a gap.
const HEAD = { pillTop: 3.12, emoteHalf: .27, emoteLow: 2.6, bare: 2.7, gap: .05 };
function drawEmote(g, size, emoji = '') {
  if (!emoji) return;
  const c = size / 2;
  g.fillStyle = 'rgba(40,20,60,.22)'; g.beginPath(); g.arc(c, c + 4, c * .72, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c, c * .72, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.strokeStyle = COLOR; g.stroke();
  drawEmoji(g, emoji, c, c + 3, size * .48);
}

export function createManager({ scene, say = null, navigate = null, isPaused = () => false, getPlayerPos = () => null, getCrew = () => [], isWalkable = null }) {
  const group = new THREE.Group();
  group.name = 'realm-manager';
  scene.add(group);
  const zones = { farm: new THREE.Group(), shop: new THREE.Group() };
  group.add(zones.farm, zones.shop);
  // Shared art: one unit box / ball, a few materials.
  const box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(1, 12, 8);
  const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
  const mat = { vest: M(COLOR), cap: M(CAP), wood: M('#9a6a40'), woodDark: M('#6e4627'), paper: M('#fbf7ec'), metal: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: .35, metalness: .6 }),
    crate: M('#b98a4e'), phone: new THREE.MeshStandardMaterial({ color: 0x1d2330, emissive: 0x3a7bd5, emissiveIntensity: .6 }), plate: M(COLOR) };
  const ringGeo = new THREE.RingGeometry(.58, .82, 32).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xe5482f, transparent: true, opacity: .85, depthWrite: false });
  const shadowGeo = new THREE.CircleGeometry(.42, 20).rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .18, depthWrite: false });
  const pickGeo = new THREE.BoxGeometry(1, 2.1, 1).translate(0, 1.05, 0);
  const pickMat = new THREE.MeshBasicMaterial();
  const part = (parent, m, x, y, z, w, h, d, geo = box) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(w, h, d); o.castShadow = true; o.receiveShadow = true; o.raycast = () => {}; parent.add(o); return o; };

  // Desk + crate per zone (fixed, built once).
  const desks = {};
  for (const zone of ['farm', 'shop']) {
    const d = GM_DESK[zone], root = new THREE.Group();
    root.position.set(d.x, 0, d.z);
    part(root, mat.wood, 0, .76, 0, 1.4, .08, .7);              // top
    part(root, mat.woodDark, 0, .4, .3, 1.36, .66, .06);         // modesty panel (camera side)
    for (const x of [-.64, .64]) part(root, mat.woodDark, x, .38, -.28, .07, .76, .07);
    part(root, mat.plate, 0, .5, .335, .62, .16, .02);           // violet name plate
    part(root, mat.paper, -.35, .82, -.05, .34, .04, .26);       // paper stack
    part(root, mat.cap, .42, .84, -.12, .08, .12, .08);          // pen cup
    const crate = new THREE.Group(); crate.position.set(1.25, 0, d.dz * .2);
    part(crate, mat.crate, 0, .23, 0, .58, .46, .5);
    for (const y of [.1, .36]) part(crate, mat.woodDark, 0, y, .255, .6, .05, .02);
    root.add(crate);
    const sign = makeCanvasSprite(128, drawEmote, { scale: .8 });
    sign.redraw('🪧');
    sign.sprite.position.set(1.25, 1.35, 0); sign.sprite.visible = false;
    root.add(sign.sprite);
    root.visible = false;
    zones[zone].add(root);
    desks[zone] = { root, sign, stand: { x: d.x, z: d.z + d.dz }, crate: { x: d.x + 1.25, z: d.z + d.dz * .2 } };
  }

  // The figure (built per hired manager: gender / name can change).
  let fig = null;
  function buildFigure(gender) {
    const person = createPerson(SHIRT, { gender });
    const own = new Set(); person.traverse(o => { if (o.isMesh) { own.add(o.geometry); own.add(o.material); } });
    const { legs, arms } = person.userData;
    const hands = person.children.filter(m => m.isMesh && Math.abs(m.position.y - .65) < 1e-6 && Math.abs(Math.abs(m.position.x) - .4) < 1e-6);
    const arm = arms.map(a => {
      const p = new THREE.Group(); p.position.set(a.position.x, 1.36, 0); person.add(p);
      a.position.set(0, 1.03 - 1.36, 0); p.add(a);
      const hand = hands.find(m => Math.sign(m.position.x) === Math.sign(p.position.x));
      if (hand) { hand.position.set(0, .65 - 1.36, 0); p.add(hand); }
      return p;
    });
    const leg = legs.map(l => { const p = new THREE.Group(); p.position.set(l.position.x, .8, 0); person.add(p); l.position.set(0, .43 - .8, 0); p.add(l); return p; });
    const female = gender === 'female';
    part(person, mat.vest, 0, 1.13, 0, female ? .54 : .61, .52, .39);   // vest over the white shirt
    part(person, mat.metal, 0, 1.24, .2, .03, .03, .01); part(person, mat.metal, 0, 1.1, .2, .03, .03, .01); // buttons
    part(person, mat.cap, 0, 1.97, .01, .29, .085, .3, ball);           // flat cap
    part(person, mat.cap, 0, 1.935, .23, .3, .03, .15);                  // brim
    const clip = new THREE.Group(); clip.position.set(0, -.62, .13); arm[1].add(clip);
    part(clip, mat.woodDark, 0, 0, 0, .26, .34, .025);
    part(clip, mat.paper, 0, -.01, .015, .22, .28, .01);
    part(clip, mat.metal, 0, .15, .02, .1, .04, .02);
    const phone = part(arm[0], mat.phone, 0, -.72, .08, .09, .16, .02); phone.visible = false;
    person.userData.legs = leg; // the rig's walk clip reads the swing of these
    dressGedeoWorker(person, 'worker-supervisor-m', () => 'inspect');
    const root = new THREE.Group(); root.add(person); person.scale.setScalar(L.heightMul);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.y = .03; shadow.raycast = () => {}; root.add(shadow);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.y = .05; ring.renderOrder = 5; ring.visible = false; ring.raycast = () => {}; root.add(ring);
    const pick = new THREE.Mesh(pickGeo, pickMat); pick.visible = false; pick.userData.target = { kind: 'manager' }; root.add(pick);
    const pill = makePill(); pill.sprite.position.y = 2.45; pill.sprite.visible = false; root.add(pill.sprite);
    const emote = makeCanvasSprite(128, drawEmote, { scale: .72 }); emote.sprite.position.y = 2.6; emote.sprite.visible = false; emote.sprite.renderOrder = 31; root.add(emote.sprite);
    return { root, person, own, arm, leg, phone, ring, pick, pill, emote, emoji: '', pillSig: -1, walk: 0, yaw: 0, sitK: 0,
      patrolT: 1, a0x: 0, a0z: 0, a1x: ARM.hold[0], a1z: -ARM.hold[1], mode: 'desk', path: null, back: false, pointT: 0, pointYaw: 0, emoteT: 0, emoteKind: '', yawnT: 0 };
  }
  function freeFigure() {
    if (!fig) return;
    fig.root.removeFromParent();
    fig.pill.dispose(); fig.emote.dispose();
    for (const r of fig.own) r.dispose();
    fig = null;
  }

  let zone = null, view = 'farm', key = '', refreshT = 0, lineAt = -Infinity, clock = 0, ringPulse = 0;
  let playedSeen = -1, localMs = 0;
  const info = { has: false, open: 0, leftMs: 0, urgent: false, waiting: false, strike: false, sad: false, chaos: false };
  const visibleNow = () => !!zone && AREA[zone] === view;

  function read(state) {
    const gm = gmOf(state);
    info.has = !!gm; info.chaos = !!chaosOf(state);
    if (!gm) { info.open = 0; info.urgent = info.waiting = info.strike = info.sad = false; return; }
    const P = playedMs(state);
    if (P !== playedSeen) { playedSeen = P; localMs = 0; }
    const tasks = gmRequests(state);
    let left = Infinity, urgent = false;
    for (const tk of tasks) {
      const l = tk.untilPlayed - P, life = Math.max(1, tk.untilPlayed - tk.atPlayed);
      if (l < left) left = l;
      if (l < life * L.ringLifeShare) urgent = true;
    }
    info.open = tasks.length; info.leftMs = Number.isFinite(left) ? left : 0; info.urgent = urgent;
    info.waiting = gmWaiting(state); info.strike = !!gmStrike(state); info.sad = (gm.loyalty ?? 100) < L.sadLoyalty;
  }

  function sync(state) {
    const gm = gmOf(state), z = state.world?.currentRegion ? gmZone(state) : null;
    zone = z;
    for (const k of ['farm', 'shop']) desks[k].root.visible = k === 'shop' && k === z && (!!gm || !!chaosOf(state)); // on the farm he has no desk: he walks the fields
    const want = gm && z ? `${gm.uid}:${gm.name}:${gm.gender}` : '';
    if (want !== key) {
      key = want;
      freeFigure();
      if (want) { fig = buildFigure(gm.gender === 'female' ? 'female' : 'male'); zones[z].add(fig.root); home(); }
    } else if (fig && fig.root.parent !== zones[z]) { zones[z].add(fig.root); home(); }
    read(state);
  }
  function home() {
    if (!fig || !zone) return;
    const s = desks[zone].stand;
    fig.root.position.set(s.x, 0, s.z); fig.yaw = 0; fig.root.rotation.y = 0; fig.mode = 'desk'; fig.path = null;
  }

  function line(text, { priority = 0, ms = L.lineMs } = {}) {
    if (!fig || !say || !visibleNow()) return false;
    if (priority < 2 && clock - lineAt < L.lineGapSec) return false;
    if (say(fig.root, text, { tone: 'manager', priority, ms, y: headY().say })) { lineAt = clock; return true; }
    return false;
  }
  // Over his head, stacked bottom-up so nothing covers anything: the 📋 pill (when a request is open), the emote (😒 / 👍 /
  // 🥱 / 🪧), then his speech bubble's tail.
  function headY() {
    const pill = info.open > 0, emo = !!fig?.emoji;
    const emoteY = pill ? HEAD.pillTop + HEAD.emoteHalf + HEAD.gap : HEAD.emoteLow;
    const top = emo ? emoteY + HEAD.emoteHalf : pill ? HEAD.pillTop : HEAD.bare;
    return { emote: emoteY, say: top + HEAD.gap };
  }
  function emote(kind) {
    if (!fig) return;
    fig.emoteKind = kind; fig.emoteT = L.emoteSec[kind] || 1.2;
  }
  // Walk to a world point near the target (stop short of it), point, walk back. Out of reach → point from the desk.
  function goTo(x, z) {
    if (!fig || !zone || fig.mode === 'strike' || info.strike) return;
    const p0 = fig.root.position, onFarm = zone === 'farm', s = onFarm ? { x: p0.x, z: p0.z } : desks[zone].stand, far = Math.hypot(x - s.x, z - s.z);
    fig.pointYaw = Math.atan2(x - fig.root.position.x, z - fig.root.position.z);
    if (areaAt(x, z) !== AREA[zone] || (!onFarm && far > L.maxWalkM) || isPaused()) { fig.mode = 'point'; fig.pointT = L.pointSec; fig.back = false; return; }
    const dx = x - s.x, dz = z - s.z, k = far > 1.2 ? (far - 1.1) / far : 0;
    const tx = s.x + dx * k, tz = s.z + dz * k;
    const p = fig.root.position;
    fig.path = navigate ? navigate(p.x, p.z, tx, tz) : [{ x: tx, z: tz }];
    if (!fig.path?.length) fig.path = [{ x: tx, z: tz }];
    fig.mode = 'walk'; fig.back = false; fig.tx = x; fig.tz = z;
  }
  function walkBack() {
    if (zone === 'farm') { fig.mode = 'desk'; fig.yaw = 0; return; } // no desk to go back to: the next round starts from here
    const s = desks[zone].stand, p = fig.root.position;
    fig.path = navigate ? navigate(p.x, p.z, s.x, s.z) : [{ x: s.x, z: s.z }];
    if (!fig.path?.length) fig.path = [{ x: s.x, z: s.z }];
    fig.mode = 'walk'; fig.back = true;
  }
  // Rounds: every few seconds he walks over to another field, on any tier.
  function patrol(state) {
    const list = ownedPlots(state), p = fig.root.position;
    fig.patrolT = 2 + Math.random() * 3;
    // a bare farm has no fields yet: he walks the land he is about to work
    const q = list.length ? list[Math.floor(Math.random() * list.length)] : { x: (Math.random() - .5) * 40, z: 2 + Math.random() * 14 }, tx = q.x, tz = q.z + 1.6;
    fig.path = navigate ? navigate(p.x, p.z, tx, tz) : [{ x: tx, z: tz }];
    if (fig.path?.length) { fig.mode = 'walk'; fig.back = true; }
  }
  // Same dodge as the crew (staff.js steer): anyone within 1.5 m ahead bends his heading away.
  const dodgeOut = { x: 0, z: 0 };
  function dodge(p, ax, az) {
    let side = 0;
    const feel = o => {
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
      if (d < .01 || d > 1.5) return;
      const ahead = (dx * ax + dz * az) / d;
      if (ahead < .3) return;
      side += ((ax * dz - az * dx) < -.05 ? -1 : 1) * (1 - d / 1.5) * ahead;
    };
    if (zone === 'farm') { for (const o of getCrew()) feel(o); const me = getPlayerPos(); if (me) feel(me); }
    dodgeOut.x = ax; dodgeOut.z = az;
    if (!side) return dodgeOut;
    const k = Math.max(-1.6, Math.min(1.6, side * 2.2)), nx = ax + az * k, nz = az - ax * k, len = Math.hypot(nx, nz);
    if (!isWalkable || isWalkable(p.x + nx / len * .45, p.z + nz / len * .45)) { dodgeOut.x = nx / len; dodgeOut.z = nz / len; }
    return dodgeOut;
  }
  function step(dt) { // follow fig.path; true when there
    const p = fig.root.position, wp = fig.path?.[0];
    if (!wp) return true;
    const dx = wp.x - p.x, dz = wp.z - p.z, dist = Math.hypot(dx, dz);
    if (dist < .12) { fig.path.shift(); return !fig.path.length; }
    const way = dodge(p, dx / dist, dz / dist), len = Math.min(dist, L.walkSpeed * dt);
    p.x += way.x * len; p.z += way.z * len; fig.yaw = Math.atan2(way.x, way.z);
    return false;
  }

  const mins = ms => Math.max(1, Math.ceil(ms / 60000));
  /** Store events (after the sync). locate(ev) → { x, z } of what a job was for, or null. reasonText(reason) → words. */
  function onEvent(ev, { locate = () => null, reasonText = () => '' } = {}) {
    if (!fig || !ev) return;
    switch (ev.type) {
      case 'gmActed': {
        const at = locate(ev);
        if (at) goTo(at.x, at.z);
        if (!ev.approved) line(t('realm.gm.did', { what: reasonText(ev.reason) }));
        break;
      }
      case 'gmHands': if (fig.mode === 'desk') { const at = locate(ev); if (at) goTo(at.x, at.z); } break; // he goes where his hands are
      case 'gmRequest': line(t('realm.gm.ask', { what: reasonText(ev.reason), min: mins((TASKS.life[ev.kind] ?? TASKS.life.staffGrowth) * 60000) }), { priority: 2, ms: L.requestMs }); break;
      case 'taskRemind': if (ev.by === 'g1') line(t(ev.last ? 'realm.gm.remindLast' : 'realm.gm.remind', { min: mins(ev.leftMs), what: reasonText(ev.reason) }), { priority: ev.last ? 2 : 1, ms: L.requestMs }); break;
      case 'taskAnswered':
        if (ev.kind === 'poach') break;
        if (ev.answer === 'denied') line(t('realm.gm.denied'), { priority: 1 });
        else if (ev.ok !== false) { emote('thumbsUp'); line(t('realm.gm.thanks'), { priority: 1 }); }
        break;
      case 'taskExpired': if (ev.name) { emote('facepalm'); line(t('realm.gm.expired', { what: reasonText(ev.reason) }), { priority: 2 }); } break;
      case 'gmLater': line(t('realm.gm.later'), { priority: 1 }); break;
      case 'gmWaiting': fig.yawnT = 0; line(t('realm.gm.waiting'), { priority: 2 }); break;
      case 'gmStrike': line(t('realm.gm.strike'), { priority: 3, ms: L.requestMs }); break;
      case 'gmStrikeOver': case 'gmApologised': emote('thumbsUp'); line(t('realm.gm.back'), { priority: 2 }); break;
      case 'tasksWaiting': line(t('realm.gm.welcome', { n: ev.n }), { priority: 2, ms: L.requestMs }); break;
      case 'gmHired': line(t('realm.gm.hello', { name: ev.name }), { priority: 2 }); break;
      default: break;
    }
  }

  const damp = (cur, goal, k) => cur + (goal - cur) * k;
  function update(dt, time, state) {
    clock += dt;
    const paused = isPaused() || state.story?.phase !== 'play';
    if ((refreshT -= dt) <= 0) { refreshT = REFRESH; read(state); }
    for (const k of ['farm', 'shop']) {
      const d = desks[k];
      if (d.root.visible) d.sign.sprite.visible = !info.has && info.chaos;
    }
    if (!fig) return;
    if (!paused && info.open) localMs = Math.min(localMs + dt * 1000, CLOCK.tickSeconds * 1000);
    // mode switches the derived state forces
    if (info.strike && fig.mode !== 'strike') { const c = desks[zone].crate; fig.root.position.set(c.x, 0, c.z); fig.path = null; fig.mode = 'strike'; fig.yaw = -.35; }
    else if (!info.strike && fig.mode === 'strike') home();
    let moving = false;
    if (!paused) {
      if (fig.mode === 'walk') {
        moving = true;
        if (step(dt)) {
          if (fig.back) { fig.mode = 'desk'; fig.yaw = 0; moving = false; }
          else { fig.mode = 'point'; fig.pointT = L.pointSec; fig.back = true; fig.pointYaw = Math.atan2(fig.tx - fig.root.position.x, fig.tz - fig.root.position.z); moving = false; }
        }
      } else if (fig.mode === 'point') {
        fig.yaw = fig.pointYaw;
        if ((fig.pointT -= dt) <= 0) { if (fig.back) walkBack(); else { fig.mode = 'desk'; fig.yaw = 0; } }
      }
      if (zone === 'farm' && fig.mode === 'desk' && !info.strike && (fig.patrolT -= dt) <= 0) patrol(state);
      if (fig.mode === 'desk' && info.waiting && (fig.yawnT -= dt) <= 0) { fig.yawnT = L.yawnEverySec; emote('yawn'); }
    }
    // pose goals
    const sitting = fig.mode === 'strike';
    let r = ARM.rest, l = ARM.hold;
    if (sitting) { r = ARM.cross; l = ARM.cross; }
    else if (fig.mode === 'point') r = ARM.point;
    else if (fig.emoteT > 0 && fig.emoteKind === 'facepalm') r = ARM.facepalm;
    else if (fig.emoteT > 0 && fig.emoteKind === 'thumbsUp') r = ARM.thumbs;
    else if (fig.emoteT > 0 && fig.emoteKind === 'yawn') { r = ARM.stretch; l = ARM.stretch; }
    else if (!moving && info.open) r = ARM.phone;
    if (fig.emoteT > 0) fig.emoteT -= dt;
    const k = dampK(10, dt);
    fig.a0x = damp(fig.a0x, r[0], k); fig.a0z = damp(fig.a0z, r[1], k);   // [x, inward]: the right arm (x −) turns in with +z,
    fig.a1x = damp(fig.a1x, l[0], k); fig.a1z = damp(fig.a1z, -l[1], k);  // the left arm (x +) with −z
    if (moving) fig.walk += dt * 9;
    if (moving && r === ARM.rest) fig.a0x = Math.sin(fig.walk) * .45; // the free arm swings while walking
    fig.arm[0].rotation.set(fig.a0x, 0, fig.a0z); fig.arm[1].rotation.set(fig.a1x, 0, fig.a1z);
    fig.phone.visible = r === ARM.phone;
    // legs: walk swing, or bent forward on the crate
    fig.sitK = damp(fig.sitK, sitting ? 1 : 0, k);
    const swing = moving ? Math.sin(fig.walk) * .6 : 0;
    fig.leg[0].rotation.x = swing * (1 - fig.sitK) - 1.45 * fig.sitK; fig.leg[1].rotation.x = -swing * (1 - fig.sitK) - 1.45 * fig.sitK;
    fig.person.position.y = SIT_Y * fig.sitK + (moving ? Math.abs(Math.sin(fig.walk)) * .04 : 0);
    if (zone === 'farm') { const p = fig.root.position; p.y += (farmGroundY(p.x, p.z) - p.y) * Math.min(1, dt * 10); } // up and down the tiers
    let d = fig.yaw - fig.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    fig.root.rotation.y += d * dampK(10, dt);
    // red ring (urgent), countdown pill, emote
    fig.ring.visible = info.urgent && !sitting;
    if (fig.ring.visible) { ringPulse += dt; const s = 1 + Math.sin(ringPulse * 6) * .1; fig.ring.scale.set(s, 1, s); ringMat.opacity = .6 + Math.sin(ringPulse * 6) * .25; }
    fig.pill.sprite.visible = info.open > 0;
    if (info.open) {
      const sec = Math.ceil(Math.max(0, info.leftMs - localMs) / 1000), sig = sec * 64 + info.open * 2 + (info.urgent ? 1 : 0);
      if (sig !== fig.pillSig) { fig.pillSig = sig; fig.pill.set(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}${info.open > 1 ? ` ·${info.open}` : ''}`, info.urgent); } // text only when it changes
      fig.pill.sprite.position.y = 2.45 + fig.person.position.y + Math.abs(Math.sin(time * 3)) * .05;
    }
    const want = sitting ? '🪧' : fig.emoteT > 0 ? EMOJI[fig.emoteKind] || '' : info.sad ? '😒' : '';
    if (want !== fig.emoji) { fig.emoji = want; if (want) fig.emote.redraw(want); fig.emote.sprite.visible = !!want; }
    if (want) fig.emote.sprite.position.y = headY().emote + fig.person.position.y;
  }
  const EMOJI = { facepalm: '🤦', thumbsUp: '👍', yawn: '🥱' };

  return {
    group, sync, update, onEvent,
    /** Tap target (his pick box) while he is drawn. */
    *pickers() { if (fig && zones[zone]?.visible && fig.root.parent) yield fig.pick; },
    /** Live position of the manager (for the camera), or null. */
    positionOf: () => (fig && visibleNow() ? fig.root.position : null),
    setView(v) { view = v; zones.farm.visible = v === 'farm'; zones.shop.visible = v === 'cafe'; },
    clear() { freeFigure(); key = ''; for (const k of ['farm', 'shop']) desks[k].root.visible = false; },
    dispose() {
      freeFigure();
      for (const k of ['farm', 'shop']) desks[k].sign.dispose();
      box.dispose(); ball.dispose(); ringGeo.dispose(); ringMat.dispose(); shadowGeo.dispose(); shadowMat.dispose(); pickGeo.dispose(); pickMat.dispose();
      Object.values(mat).forEach(m => m.dispose());
      group.removeFromParent();
    },
  };
}
