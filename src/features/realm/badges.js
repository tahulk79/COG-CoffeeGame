// Object notices AT the object (founder: "đối tượng nào có tương tác hoặc nâng cấp phải hiện thông báo ngay tại đối
// tượng đó"). World-space pin badges, constant screen size (sizeAttenuation off), drawn on top, bouncing gently.
// Tapping a badge = tapping its object (pickers() returns them first, each carries userData.target).
// Kinds: up (green ▲, upgrade affordable now — bounces), upMuted (grey ▲, upgrade exists but needs more coins — still),
// order (!), noSeat (🪑 full), brew (+), serve (☕ on the counter, or over the customer while carrying their cup),
// harvest (sickle over a field with ripe plots), buy (+ on an affordable for-sale sign), lock (🔒 over a locked street
// shop, still) / lockReady (! — that shop can be opened right now, bounces). Upgrades are ONLY reached
// through the ▲: an interaction badge that also has an upgrade gets a small tappable ▲ beside it (item.up = 'ok' |
// 'muted', item.upTarget). Pooled sprites, one material per kind (textures drawn once).
// Farm World 2.0 producers: collect (bright pin with the finished good's icon, item.icon — bounces; one material per
// icon, cached) and produce (smaller blue ▶ pin: idle, a batch can be started).
// item.chip (short text, e.g. "🪙 400" / "Cấp 6") draws a small price chip under the pin (same constant screen size);
// chip materials are cached per text (a handful of prices) and freed on dispose.
import * as THREE from 'three';
import { farmGroundY } from '../../core/config/layout.js';
import { drawEmoji, measureCoinText, fillCoinText } from './util.js';
import { drawSickle } from './markers.js';

const PX = 46, SMALL_PX = 26; // on-screen size in CSS px (portrait phone)
const STYLE = {
  up: { fill: '#3fb84a', edge: '#1f7a2a' },
  upMuted: { fill: '#a9a59c', edge: '#77736b' },
  order: { fill: '#ff8a2a', edge: '#b4521a' },
  noSeat: { fill: '#e5533f', edge: '#9a2a1d' },
  brew: { fill: '#2f9e8f', edge: '#1b665c' },
  serve: { fill: '#3fb84a', edge: '#1f7a2a' },
  harvest: { fill: '#ffd23a', edge: '#b88a12' },
  buy: { fill: '#ffc93a', edge: '#b88a12' },
  lock: { fill: '#6d7a8c', edge: '#3f4957' },
  lockReady: { fill: '#ff8a2a', edge: '#b4521a' },
  collect: { fill: '#ffd23a', edge: '#b88a12' },
  produce: { fill: '#3b8fe0', edge: '#1d5c9e' },
};
const SMALL_KINDS = { produce: .78 }; // kind → pin size factor
const CHIP_W = 192, CHIP_H = 64, CHIP_K = CHIP_W / CHIP_H; // chip canvas (px) and aspect

function drawPin(g, size, kind, icon) {
  const { fill, edge } = STYLE[kind];
  const c = size / 2, r = size * .36, cy = size * .4;
  g.fillStyle = 'rgba(40,25,10,.28)';
  g.beginPath(); g.arc(c, cy + 4, r + 3, 0, Math.PI * 2); g.fill();
  // pin: circle + pointer
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(c, cy, r + 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(c - r * .45, cy + r * .8); g.lineTo(c, size * .97); g.lineTo(c + r * .45, cy + r * .8); g.fill();
  g.fillStyle = fill;
  g.beginPath(); g.arc(c, cy, r, 0, Math.PI * 2); g.fill();
  g.lineWidth = 4; g.strokeStyle = edge; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.28)';
  g.beginPath(); g.ellipse(c - r * .25, cy - r * .45, r * .5, r * .25, -.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.strokeStyle = edge; g.lineJoin = 'round';
  if (kind === 'up' || kind === 'upMuted') {
    g.beginPath(); g.moveTo(c, cy - r * .62); g.lineTo(c + r * .58, cy + r * .12); g.lineTo(c + r * .22, cy + r * .12);
    g.lineTo(c + r * .22, cy + r * .58); g.lineTo(c - r * .22, cy + r * .58); g.lineTo(c - r * .22, cy + r * .12); g.lineTo(c - r * .58, cy + r * .12);
    g.closePath(); g.lineWidth = 3; g.stroke(); g.fill();
  } else if (kind === 'order' || kind === 'lockReady') {
    g.font = `900 ${Math.round(r * 1.6)}px "Baloo 2", "Nunito", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 5; g.strokeText('!', c, cy + 3); g.fillText('!', c, cy + 3);
  } else if (kind === 'brew' || kind === 'buy') {
    const a = r * .6, b = r * .2;
    g.beginPath(); g.rect(c - a, cy - b, a * 2, b * 2); g.rect(c - b, cy - a, b * 2, a * 2);
    g.lineWidth = 3; g.stroke(); g.fill();
    g.fillRect(c - a + 2, cy - b + 2, a * 2 - 4, b * 2 - 4);
  } else if (kind === 'serve') drawEmoji(g, '☕', c, cy + 2, r * 1.15);
  else if (kind === 'lock') drawEmoji(g, '🔒', c, cy + 2, r * 1.1);
  else if (kind === 'noSeat') {
    drawEmoji(g, '🪑', c, cy + 2, r * 1.05);
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(c - r * .6, cy + r * .6); g.lineTo(c + r * .6, cy - r * .6); g.stroke();
  } else if (kind === 'collect') drawEmoji(g, icon || '✔️', c, cy + 2, r * 1.15);
  else if (kind === 'produce') {
    g.beginPath(); g.moveTo(c - r * .38, cy - r * .55); g.lineTo(c + r * .58, cy); g.lineTo(c - r * .38, cy + r * .55); g.closePath();
    g.lineWidth = 4; g.stroke(); g.fill();
  } else if (kind === 'harvest') {
    g.save(); g.translate(c - size * .5 * .72, cy - size * .5 * .72); g.scale(.72, .72); drawSickle(g, size); g.restore();
  }
}

// Price chip: cream pill with dark text (shrinks to fit).
function pill(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function drawChip(g, text) {
  const w = CHIP_W, h = CHIP_H, r = (h - 12) / 2;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(40,25,10,.28)';
  pill(g, 6, 8, w - 12, h - 12, r); g.fill();
  g.fillStyle = '#fff8ea'; g.strokeStyle = '#b88a12'; g.lineWidth = 4;
  pill(g, 6, 4, w - 12, h - 12, r); g.fill(); g.stroke();
  let px = 34;
  const font = () => `900 ${px}px "Baloo 2", "Nunito", system-ui, sans-serif`;
  g.font = font();
  while (px > 18 && measureCoinText(g, text, px) > w - 36) { px -= 2; g.font = font(); }
  g.fillStyle = '#4a2f1c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fillCoinText(g, text, w / 2, h / 2 - 1, px);
}

export function createBadges({ scene, camera }) {
  const group = new THREE.Group();
  group.name = 'realm-badges';
  scene.add(group);
  const pinMat = (kind, icon) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    drawPin(canvas.getContext('2d'), 128, kind, icon);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false });
  };
  const mats = {};
  for (const kind of Object.keys(STYLE)) if (kind !== 'collect') mats[kind] = pinMat(kind);
  const collectMats = new Map(); // good icon → SpriteMaterial (a handful of goods)
  const matOf = it => {
    if (it.kind !== 'collect') return mats[it.kind] || mats.brew;
    const icon = String(it.icon || '');
    let m = collectMats.get(icon);
    if (!m) collectMats.set(icon, m = pinMat('collect', icon));
    return m;
  };
  const chipMats = new Map(); // text → SpriteMaterial
  function chipMat(text) {
    let m = chipMats.get(text);
    if (m) return m;
    const canvas = document.createElement('canvas');
    canvas.width = CHIP_W; canvas.height = CHIP_H;
    drawChip(canvas.getContext('2d'), text);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false });
    chipMats.set(text, m);
    return m;
  }
  const pool = [];      // { sprite, small, chip, phase }
  const ndc = new THREE.Vector3();
  const EDGE = .04, EDGE_TOP = .22; // NDC margins (the top HUD covers the upper ~11 % of a portrait screen)
  // The HUD's right rail (⚙ · Vay · 🌍 · ⬆ · 🧭 · 🤖) covers the right edge down to its bottom: a pin slid in from the right
  // edge must stop left of it, or it hides under the round buttons (the storehouse 🫘 pin peeking behind "Vay").
  // Read from the DOM twice a second (NDC: { left, bottom } of the rail, null when there is none).
  let rail = null, railT = 0;
  function readRail() {
    const el = typeof document !== 'undefined' && document.querySelector('#hud-root .hud-top-right');
    const r = el && el.getClientRects().length ? el.getBoundingClientRect() : null;
    rail = r && r.width > 0 ? { left: r.left / innerWidth * 2 - 1 - .02, bottom: 1 - r.bottom / innerHeight * 2 - .02 } : null;
  }
  let used = 0;
  let scale = .05, smallScale = .03;
  let sig = '';

  function slot(i) {
    if (pool[i]) return pool[i];
    const sprite = new THREE.Sprite(mats.up);
    sprite.geometry.userData.keep = true;
    sprite.center.set(.5, 0);
    sprite.renderOrder = 40;
    const small = new THREE.Sprite(mats.up);
    small.geometry.userData.keep = true;
    small.center.set(-.35, -.9);
    small.renderOrder = 41;
    const chip = new THREE.Sprite(mats.up);
    chip.geometry.userData.keep = true;
    chip.center.set(.5, 1.05);
    chip.renderOrder = 41;
    chip.visible = false;
    group.add(sprite, small, chip);
    return (pool[i] = { sprite, small, chip, phase: i * 1.7, k: 1 });
  }

  /** items: [{ key, kind, x, y, z, target, up, chip, icon }] (icon: collect only) — rewrites the pool only when the set changes. */
  function set(items) {
    const next = items.map(it => `${it.key}:${it.kind}:${it.icon || ''}:${it.up || 0}:${it.chip || ''}:${it.x.toFixed(1)},${it.y.toFixed(1)},${it.z.toFixed(1)}`).join('|');
    if (next === sig) return;
    sig = next;
    used = items.length;
    items.forEach((it, i) => {
      const s = slot(i);
      s.sprite.material = matOf(it);
      s.k = SMALL_KINDS[it.kind] || 1;
      s.sprite.position.set(it.x, it.y + farmGroundY(it.x, it.z), it.z); // y is above the land; the land climbs the tiers
      s.sprite.userData.target = it.target;
      s.sprite.visible = true;
      s.still = it.kind === 'upMuted' || it.kind === 'lock';
      s.small.visible = !!it.up && it.kind !== 'up' && it.kind !== 'upMuted';
      s.small.material = it.up === 'ok' ? mats.up : mats.upMuted;
      s.small.userData.target = s.small.visible ? it.upTarget : null;
      s.small.position.copy(s.sprite.position);
      s.chip.visible = !!it.chip;
      if (it.chip) { s.chip.material = chipMat(String(it.chip)); s.chip.position.copy(s.sprite.position); s.chip.userData.target = it.target; }
      else s.chip.userData.target = null;
    });
    for (let i = used; i < pool.length; i++) { pool[i].sprite.visible = false; pool[i].small.visible = false; pool[i].chip.visible = false; pool[i].sprite.userData.target = null; pool[i].chip.userData.target = null; }
  }

  return {
    group,
    set,
    /** Every kind this module can draw (realm/index.js only sends a kind it supports). */
    kinds: Object.keys(STYLE),
    supports: kind => Object.prototype.hasOwnProperty.call(STYLE, kind),
    clear() { set([]); },
    /** Viewport height (CSS px) → sprite scale so the badge is PX tall whatever the camera distance. */
    resize(h) {
      const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, h);
      scale = PX * k; smallScale = SMALL_PX * k;
      for (const s of pool) { s.sprite.scale.set(scale * s.k, scale * s.k, 1); s.small.scale.set(smallScale, smallScale, 1); s.chip.scale.set(smallScale * CHIP_K, smallScale, 1); }
    },
    update(time) {
      const P = camera.projectionMatrix.elements, wN = scale * P[0], hN = scale * P[5]; // badge size in NDC
      if ((railT -= 1) <= 0) { railT = 30; readRail(); }
      for (let i = 0; i < used; i++) {
        const s = pool[i];
        if (s.sprite.scale.x !== scale * s.k) { s.sprite.scale.set(scale * s.k, scale * s.k, 1); s.small.scale.set(smallScale, smallScale, 1); s.chip.scale.set(smallScale * CHIP_K, smallScale, 1); }
        // Bounce in screen space (sprite center), so it is the same on every zoom level.
        // Muted (not affordable) ▲ stays still; everything else bounces.
        let cy = s.still ? 0 : -Math.abs(Math.sin(time * 3.2 + s.phase)) * .22;
        // Keep the whole pin (and its small ▲) inside the viewport margins: slide it in from the edges.
        ndc.copy(s.sprite.position).project(camera);
        let cx = .5;
        let maxX = 1 - wN * (s.small.visible ? 1.3 : .5) - EDGE;
        const minX = -1 + wN * .5 + EDGE, maxY = 1 - hN * 1.25 - EDGE_TOP;
        if (rail && ndc.y + hN * 1.25 > rail.bottom) maxX = Math.min(maxX, rail.left - wN * (s.small.visible ? 1.3 : .5)); // beside the rail
        if (ndc.z < 1) {
          if (ndc.x > maxX) cx += (ndc.x - maxX) / wN; else if (ndc.x < minX) cx -= (minX - ndc.x) / wN;
          if (ndc.y > maxY) cy += (ndc.y - maxY) / hN;
        }
        s.sprite.center.set(cx, cy);
        const k = scale / smallScale;
        s.small.center.set(-.35 + (cx - .5) * k, cy * k - .9); // rides along with its interaction badge
        if (s.chip.visible) s.chip.center.set(.5 + (cx - .5) * k / CHIP_K, 1.05 + cy * k); // price chip under the pin
      }
    },
    /** Visible badge sprites (for raycasting before the objects themselves). */
    *pickers() { for (let i = 0; i < used; i++) { if (pool[i].sprite.visible) yield pool[i].sprite; if (pool[i].chip.visible) yield pool[i].chip; } },
    /** Small ▲ beside interaction badges (checked before the big ones: they overlap). */
    *smallPickers() { for (let i = 0; i < used; i++) if (pool[i].small.visible) yield pool[i].small; },
    setVisible(v) { group.visible = !!v; },
    get visible() { return group.visible; },
    dispose() {
      for (const s of pool) { s.sprite.removeFromParent(); s.small.removeFromParent(); s.chip.removeFromParent(); }
      for (const m of Object.values(mats)) { m.map.dispose(); m.dispose(); }
      for (const m of chipMats.values()) { m.map.dispose(); m.dispose(); }
      for (const m of collectMats.values()) { m.map.dispose(); m.dispose(); }
      collectMats.clear();
      chipMats.clear();
      group.removeFromParent();
    },
  };
}
