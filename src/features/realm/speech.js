// Street speech: talk bubbles over walkers, review stars, and the cartoon fight cloud (docs/design/cafe-street.md §3.1).
//  · say(obj, text, opts) — a rounded bubble with a tail that FOLLOWS `obj` (world position + y) every frame: pops in
//    (easeOutBack), holds `ms`, fades out. Tones: normal (cream), angry (red, white text), happy (light green), review
//    (cream with a gold border and a ⭐ row). Text wraps to 2 lines max (font shrinks if it still does not fit), panel
//    width follows the text. `text` may also be an i18n key (anything t() knows, e.g. sayKey(...)).
//  · Rate gate: street-wide, one non-priority line every INCIDENTS.lineGapSeconds; priority ≥ 2 (actionable: the
//    player should react) always passes. Never two bubbles on one object: a new line replaces the old one (unless the
//    old one has a higher priority and is still showing → the new one is skipped). say() returns false when skipped.
//  · Pool: at most MAX live bubbles; each slot owns one fixed-size canvas + texture + material + sprite (fixed size =
//    no texture re-creation). Full pool → the oldest lowest-priority bubble is recycled (only if its priority ≤ new).
//  · Readability: sizeAttenuation stays on (bubbles sit in the world), but the scale grows with the camera distance
//    (×1 … ×1.55) so lines stay readable at the street overview. Drawn on top (depthTest off, high renderOrder).
//  · If the target leaves the scene (walker disposed, order vanished) the bubble stops following and fades out.
//  · fightCloud(x, z, { seconds }) — spinning, wobbling dust cloud (one big puff sprite + 3 orbiting puffs) with
//    💥 ⭐ 💢 🦶 ✊ 💫 popping around it; drifts a little. Resolves `done` after `seconds`, then fades out and frees
//    itself. Puff + emoji textures are drawn once and shared; each cloud owns only its two materials.
//  · clear() drops every bubble and cloud (pending `done` promises resolve, so callers never hang); dispose() also
//    frees the shared textures.
import * as THREE from 'three';
import { FONT, drawEmoji, easeOutBack, clamp } from './util.js';
import { INCIDENTS, SAY_VARIANTS } from '../../core/config/economy.js';
import { t, hasKey } from '../../i18n/index.js';

const MAX = 8;                 // live bubbles
const CW = 640, CH = 232;      // bubble canvas (px); panel drawn centered, transparent around it
const H = 1.42;                // world height of the whole canvas at near zoom
const PAD = 30, MAX_TEXT_W = CW - 2 * PAD - 24;
const POP = .2, FADE = .32;    // s
const REF_DIST = 22, MAX_GROW = 1.55;
const ORDER = 32;              // bubbles above badges / labels
const LINE_GAP = INCIDENTS?.lineGapSeconds ?? 3.5;
const FIGHT_SECONDS = INCIDENTS?.fightSeconds ?? 2.6;

const TONES = {
  normal: { bg: '#fff8ea', fg: '#4a2f1c', edge: '#c99a5e' },
  angry: { bg: '#e5482f', fg: '#ffffff', edge: '#ffffff' },
  happy: { bg: '#dff5c8', fg: '#2c4a17', edge: '#6fb84a' },
  review: { bg: '#fff8ea', fg: '#4a2f1c', edge: '#e6a817' },
};
const ANGRY = new Set(['crowd', 'closed', 'cut', 'fight', 'slow', 'patience', 'noSeat', 'toBar']);
const HAPPY = new Set(['happy', 'tea', 'lemon', 'drunk', 'bar', 'cutSorry']);
/** Bubble tone for a speech situation (see SAY_VARIANTS). */
export const toneFor = situation => (ANGRY.has(situation) ? 'angry' : HAPPY.has(situation) ? 'happy' : 'normal');

/** i18n key of a random variant: realm.say.<situation>.<1..N>. `roll` in [0, 1). */
export const sayKey = (situation, roll) => {
  const n = SAY_VARIANTS?.[situation] || 3;
  return `realm.say.${situation}.${1 + Math.min(n - 1, Math.floor(clamp(roll, 0, .999999) * n))}`;
};

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Greedy word wrap into ≤ 2 lines; returns null when it does not fit at this font size.
function wrap(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return [text];
  const words = text.split(/\s+/);
  let a = '';
  for (let i = 0; i < words.length; i++) {
    const next = a ? `${a} ${words[i]}` : words[i];
    if (g.measureText(next).width > maxW && a) {
      const b = words.slice(i).join(' ');
      return g.measureText(b).width <= maxW ? [a, b] : null;
    }
    a = next;
  }
  return null; // a single word longer than the line
}

function layout(g, text) {
  for (let px = 46; px >= 26; px -= 4) {
    g.font = FONT.replace('{size}', px);
    const lines = wrap(g, text, MAX_TEXT_W);
    if (lines) return { px, lines };
  }
  // Last resort: hard cut on the smallest font.
  g.font = FONT.replace('{size}', 26);
  let s = text;
  while (s.length > 1 && g.measureText(`${s}…`).width > MAX_TEXT_W) s = s.slice(0, -1);
  return { px: 26, lines: [`${s}…`] };
}

function drawStars(g, cx, cy, stars, px) {
  const step = px * 1.05, x0 = cx - step * 2;
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = i < stars ? 1 : .28;
    drawEmoji(g, '⭐', x0 + i * step, cy, px);
  }
  g.globalAlpha = 1;
}

// Draws the whole bubble on the slot canvas. Panel is horizontally centered; the tail tip touches the bottom edge so
// the sprite's center (.5, 0) sits exactly on the anchor point.
function drawBubble(g, text, tone, stars) {
  g.clearRect(0, 0, CW, CH);
  const c = TONES[tone] || TONES.normal;
  const review = tone === 'review';
  const { px, lines } = layout(g, text);
  const lh = px * 1.12, starH = review ? 50 : 0;
  let tw = 0;
  for (const l of lines) tw = Math.max(tw, g.measureText(l).width);
  if (review) tw = Math.max(tw, 5 * 44);
  const w = Math.min(CW - 12, Math.ceil(tw + PAD * 2)), tail = 26;
  const h = Math.min(CH - tail - 10, Math.ceil(lines.length * lh + starH + 30));
  const x = (CW - w) / 2, y = CH - tail - h - 6;
  // shadow
  g.fillStyle = 'rgba(60,35,15,.25)'; roundRect(g, x, y + 6, w, h, 30); g.fill();
  // panel + tail as one path so the border flows around the tail
  g.beginPath();
  const r = 30, cx = CW / 2;
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.lineTo(cx + 18, y + h); g.lineTo(cx + 2, CH - 4); g.lineTo(cx - 14, y + h);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  g.fillStyle = c.bg; g.fill();
  g.lineWidth = review ? 7 : 5; g.strokeStyle = c.edge; g.lineJoin = 'round'; g.stroke();
  if (review) drawStars(g, cx, y + 15 + starH / 2 - 4, stars, 40);
  g.font = FONT.replace('{size}', px);
  g.fillStyle = c.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ty = y + 15 + starH + lh / 2;
  for (let i = 0; i < lines.length; i++) g.fillText(lines[i], cx, ty + i * lh);
}

// ---- fight cloud art (shared, drawn once) ----
function drawPuffCluster(g, s, puffs) {
  g.clearRect(0, 0, s, s);
  for (const pass of [0, 1]) {
    for (const [px, py, pr] of puffs) {
      g.beginPath(); g.arc(px * s, py * s, pr * s + (pass ? 0 : 5), 0, Math.PI * 2);
      g.fillStyle = pass ? '#f4f1ea' : '#8c857a'; g.fill();
    }
  }
  // soft shading + a few speed curls
  for (const [px, py, pr] of puffs) {
    g.beginPath(); g.arc(px * s + pr * s * .25, py * s + pr * s * .3, pr * s * .55, 0, Math.PI * 2);
    g.fillStyle = 'rgba(190,182,170,.45)'; g.fill();
  }
  g.strokeStyle = '#8c857a'; g.lineWidth = 4; g.lineCap = 'round';
  for (const [a, b, r] of [[.3, .38, .1], [.62, .5, .09], [.45, .66, .08]]) {
    g.beginPath(); g.arc(a * s, b * s, r * s, .4, 2.6); g.stroke();
  }
}
const BIG_PUFFS = [[.5, .5, .24], [.3, .45, .17], [.7, .44, .18], [.4, .68, .16], [.63, .68, .17], [.5, .3, .16], [.22, .62, .12], [.8, .62, .12]];
const SMALL_PUFFS = [[.5, .5, .32], [.3, .55, .2], [.7, .55, .2]];
const FIGHT_EMOJI = ['💥', '⭐', '💢', '🦶', '✊', '💫'];
const EMO_N = 5;

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSpeech({ scene, camera }) {
  const slots = [];     // pooled bubble slots
  const clouds = [];
  let clock = 0, lastLine = -Infinity;
  const tmp = new THREE.Vector3();

  function makeSlot() {
    const canvas = document.createElement('canvas');
    canvas.width = CW; canvas.height = CH;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 2;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const sprite = new THREE.Sprite(material);
    sprite.geometry.userData.keep = true; // shared Sprite geometry
    sprite.raycast = () => {};
    sprite.center.set(.5, 0);
    sprite.renderOrder = ORDER;
    sprite.visible = false;
    sprite.frustumCulled = false;
    scene.add(sprite);
    return { canvas, g: canvas.getContext('2d'), texture, material, sprite, target: null, live: false, follow: false,
      age: 0, life: 0, priority: 0, y: 2.9, born: 0 };
  }

  const attached = obj => { let o = obj; while (o.parent) o = o.parent; return o === scene; };

  function release(s) {
    s.live = false; s.target = null; s.sprite.visible = false; s.material.opacity = 0;
  }

  function pickSlot(obj, priority) {
    // same target → replace
    for (const s of slots) {
      if (s.live && s.target === obj) return s.priority > priority && s.age < s.life ? null : s;
    }
    for (const s of slots) if (!s.live) return s;
    if (slots.length < MAX) { const s = makeSlot(); slots.push(s); return s; }
    let best = null;
    for (const s of slots) {
      if (s.priority > priority) continue;
      if (!best || s.priority < best.priority || (s.priority === best.priority && s.born < best.born)) best = s;
    }
    return best;
  }

  function show(obj, text, tone, priority, ms, y, stars) {
    if (!obj || !obj.isObject3D) return false;
    if (priority < 2 && clock - lastLine < LINE_GAP) return false;
    const s = pickSlot(obj, priority);
    if (!s) return false;
    let str = String(text ?? '');
    if (str.startsWith('realm.') && hasKey(str)) str = String(t(str));
    if (!str && tone !== 'review') return false;
    drawBubble(s.g, str, tone, stars);
    s.texture.needsUpdate = true;
    Object.assign(s, { target: obj, live: true, follow: true, age: 0, life: Math.max(.6, ms / 1000), priority, y, born: clock });
    s.sprite.visible = true;
    s.material.opacity = 0;
    place(s);
    if (priority < 2) lastLine = clock;
    else lastLine = Math.max(lastLine, clock - LINE_GAP * .5); // actionable lines still push the chatter back a bit
    return true;
  }

  function place(s) {
    if (s.follow && s.target) {
      if (!attached(s.target)) { s.follow = false; s.age = Math.max(s.age, s.life); } // gone → fade out where it was
      else { s.target.getWorldPosition(tmp); s.sprite.position.set(tmp.x, tmp.y + s.y, tmp.z); }
    }
  }

  function say(obj3d, text, { ms = 2600, tone = 'normal', priority = 0, y = 2.9 } = {}) {
    return show(obj3d, text, TONES[tone] ? tone : 'normal', priority, ms, y, 0);
  }

  function review(obj3d, stars, text) {
    return show(obj3d, text, 'review', 1, 3200, 3.0, clamp(Math.round(stars) || 0, 0, 5));
  }

  // ---- fight cloud ----
  let bigTex = null, smallTex = null;
  const emoMats = [];
  function ensureArt() {
    if (bigTex) return;
    bigTex = canvasTexture(256, (g, s) => drawPuffCluster(g, s, BIG_PUFFS));
    smallTex = canvasTexture(128, (g, s) => drawPuffCluster(g, s, SMALL_PUFFS));
    for (const e of FIGHT_EMOJI) {
      const map = canvasTexture(96, (g, s) => drawEmoji(g, e, s / 2, s / 2 + 4, 72));
      emoMats.push(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false }));
    }
  }
  const spr = (mat, order) => {
    const s = new THREE.Sprite(mat);
    s.geometry.userData.keep = true; s.raycast = () => {}; s.renderOrder = order; s.frustumCulled = false;
    return s;
  };

  function fightCloud(x, z, { seconds = FIGHT_SECONDS } = {}) {
    ensureArt();
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const bigMat = new THREE.SpriteMaterial({ map: bigTex, transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const smallMat = new THREE.SpriteMaterial({ map: smallTex, transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const big = spr(bigMat, ORDER - 3);
    big.position.y = 1.1;
    group.add(big);
    const small = [];
    for (let i = 0; i < 3; i++) { const s = spr(smallMat, ORDER - 2); group.add(s); small.push(s); }
    const emos = [];
    for (let i = 0; i < EMO_N; i++) {
      const s = spr(emoMats[i % emoMats.length], ORDER - 1);
      s.visible = false; group.add(s);
      emos.push({ s, t: -i * .17, dur: .45 }); // staggered first pops
    }
    scene.add(group);
    let resolve;
    const done = new Promise(r => { resolve = r; });
    const c = { group, big, small, emos, bigMat, smallMat, age: 0, seconds: Math.max(.3, seconds), x, z,
      seed: Math.random() * 10, resolve, resolved: false };
    clouds.push(c);
    return { done, x, z };
  }

  function popEmoji(e) {
    e.s.material = emoMats[(Math.random() * emoMats.length) | 0];
    const a = Math.random() * Math.PI * 2, r = .9 + Math.random() * .6;
    e.s.position.set(Math.cos(a) * r, .9 + Math.random() * 1.3, Math.sin(a) * r * .6);
    e.dur = .35 + Math.random() * .25;
    e.size = .55 + Math.random() * .35;
    e.t = 0;
    e.s.visible = true;
  }

  function finishCloud(c) {
    if (!c.resolved) { c.resolved = true; c.resolve(); }
  }
  function freeCloud(c) {
    finishCloud(c);
    c.group.removeFromParent();
    c.bigMat.dispose(); c.smallMat.dispose();
  }

  function updateCloud(c, dt) {
    c.age += dt;
    const a = c.age, end = c.seconds;
    if (a >= end) finishCloud(c);
    const fadeIn = clamp(a / .18, 0, 1), fadeOut = a > end ? clamp(1 - (a - end) / FADE, 0, 1) : 1;
    const op = Math.min(fadeIn, fadeOut);
    c.bigMat.opacity = op; c.smallMat.opacity = op;
    const k = c.seed + a;
    // drift + jitter
    c.group.position.set(c.x + Math.sin(k * 1.7) * .35 + Math.sin(k * 23) * .05, 0, c.z + Math.cos(k * 1.3) * .25 + Math.cos(k * 19) * .05);
    const grow = easeOutBack(clamp(a / .3, 0, 1)) * (a > end ? 1 + (a - end) * .8 : 1);
    const wob = 1 + Math.sin(k * 11) * .06;
    c.big.scale.set(2.6 * grow * wob, 2.3 * grow * (2 - wob), 1);
    c.big.position.y = 1.1 + Math.abs(Math.sin(k * 9)) * .12;
    c.bigMat.rotation = Math.sin(k * 3) * .25 + a * 1.4;
    c.smallMat.rotation = -a * 3;
    for (let i = 0; i < c.small.length; i++) {
      const ang = a * 4.5 + i * 2.094 + c.seed;
      const s = c.small[i];
      s.position.set(Math.cos(ang) * 1.05, 1.0 + Math.sin(ang * 1.3) * .35, Math.sin(ang) * .6);
      const ss = (.9 + Math.sin(k * 13 + i) * .15) * grow;
      s.scale.set(ss, ss, 1);
    }
    for (const e of c.emos) {
      e.t += dt;
      if (e.t < 0) continue;
      if (a > end) { e.s.visible = false; continue; }
      if (e.t >= e.dur || !e.s.visible) { popEmoji(e); continue; }
      const p = e.t / e.dur;
      const sc = (p < .4 ? easeOutBack(p / .4) : 1 - (p - .4) / .6 * .9) * e.size;
      e.s.scale.set(sc, sc, 1);
    }
    return a < end + FADE;
  }

  function update(dt) {
    dt = Math.min(dt || 0, .1);
    clock += dt;
    for (const s of slots) {
      if (!s.live) continue;
      s.age += dt;
      place(s);
      const out = s.age - s.life;
      if (out >= FADE) { release(s); continue; }
      const pop = easeOutBack(clamp(s.age / POP, 0, 1));
      s.material.opacity = out > 0 ? 1 - out / FADE : clamp(s.age / (POP * .6), 0, 1);
      const d = camera ? camera.position.distanceTo(s.sprite.position) : REF_DIST;
      const grow = clamp(d / REF_DIST, 1, MAX_GROW) * (out > 0 ? 1 + out * .25 : 1);
      const hh = H * grow * Math.max(.05, pop);
      s.sprite.scale.set(hh * CW / CH, hh, 1);
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
      if (!updateCloud(clouds[i], dt)) { freeCloud(clouds[i]); clouds.splice(i, 1); }
    }
  }

  function clear() {
    for (const s of slots) release(s);
    for (const c of clouds) freeCloud(c);
    clouds.length = 0;
    lastLine = -Infinity;
  }

  function dispose() {
    clear();
    for (const s of slots) { s.sprite.removeFromParent(); s.texture.dispose(); s.material.dispose(); }
    slots.length = 0;
    if (bigTex) {
      bigTex.dispose(); smallTex.dispose();
      for (const m of emoMats) { m.map.dispose(); m.dispose(); }
      emoMats.length = 0; bigTex = smallTex = null;
    }
  }

  return { say, review, fightCloud, update, clear, dispose };
}
