// Object notices AT the object (founder: "đối tượng nào có tương tác hoặc nâng cấp phải hiện thông báo ngay tại đối
// tượng đó"). World-space pin badges, constant screen size (sizeAttenuation off), drawn on top, bouncing gently.
// Tapping a badge = tapping its object (pickers() returns them first, each carries userData.target).
// Kinds: up (green ▲, upgrade affordable now — bounces), upMuted (grey ▲, upgrade exists but needs more coins — still),
// order (!), noSeat (🪑 full), brew (+), serve (☕ on the counter, or over the customer while carrying their cup),
// harvest (sickle over a field with ripe plots), buy (+ on an affordable for-sale sign). Upgrades are ONLY reached
// through the ▲: an interaction badge that also has an upgrade gets a small tappable ▲ beside it (item.up = 'ok' |
// 'muted', item.upTarget). Pooled sprites, one material per kind (textures drawn once).
import * as THREE from 'three';
import { drawEmoji } from './util.js';
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
};

function drawPin(g, size, kind) {
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
  } else if (kind === 'order') {
    g.font = `900 ${Math.round(r * 1.6)}px "Baloo 2", "Nunito", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 5; g.strokeText('!', c, cy + 3); g.fillText('!', c, cy + 3);
  } else if (kind === 'brew' || kind === 'buy') {
    const a = r * .6, b = r * .2;
    g.beginPath(); g.rect(c - a, cy - b, a * 2, b * 2); g.rect(c - b, cy - a, b * 2, a * 2);
    g.lineWidth = 3; g.stroke(); g.fill();
    g.fillRect(c - a + 2, cy - b + 2, a * 2 - 4, b * 2 - 4);
  } else if (kind === 'serve') drawEmoji(g, '☕', c, cy + 2, r * 1.15);
  else if (kind === 'noSeat') {
    drawEmoji(g, '🪑', c, cy + 2, r * 1.05);
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(c - r * .6, cy + r * .6); g.lineTo(c + r * .6, cy - r * .6); g.stroke();
  } else if (kind === 'harvest') {
    g.save(); g.translate(c - size * .5 * .72, cy - size * .5 * .72); g.scale(.72, .72); drawSickle(g, size); g.restore();
  }
}

export function createBadges({ scene, camera }) {
  const group = new THREE.Group();
  group.name = 'realm-badges';
  scene.add(group);
  const mats = {};
  for (const kind of Object.keys(STYLE)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    drawPin(canvas.getContext('2d'), 128, kind);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    mats[kind] = new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false });
  }
  const pool = [];      // { sprite, small, phase }
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
    group.add(sprite, small);
    return (pool[i] = { sprite, small, phase: i * 1.7 });
  }

  /** items: [{ key, kind, x, y, z, target, up }] — rewrites the pool only when the set changes. */
  function set(items) {
    const next = items.map(it => `${it.key}:${it.kind}:${it.up || 0}:${it.x.toFixed(1)},${it.y.toFixed(1)},${it.z.toFixed(1)}`).join('|');
    if (next === sig) return;
    sig = next;
    used = items.length;
    items.forEach((it, i) => {
      const s = slot(i);
      s.sprite.material = mats[it.kind];
      s.sprite.position.set(it.x, it.y, it.z);
      s.sprite.userData.target = it.target;
      s.sprite.visible = true;
      s.still = it.kind === 'upMuted';
      s.small.visible = !!it.up && it.kind !== 'up' && it.kind !== 'upMuted';
      s.small.material = it.up === 'ok' ? mats.up : mats.upMuted;
      s.small.userData.target = s.small.visible ? it.upTarget : null;
      s.small.position.copy(s.sprite.position);
    });
    for (let i = used; i < pool.length; i++) { pool[i].sprite.visible = false; pool[i].small.visible = false; pool[i].sprite.userData.target = null; }
  }

  return {
    group,
    set,
    clear() { set([]); },
    /** Viewport height (CSS px) → sprite scale so the badge is PX tall whatever the camera distance. */
    resize(h) {
      const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, h);
      scale = PX * k; smallScale = SMALL_PX * k;
      for (const s of pool) { s.sprite.scale.set(scale, scale, 1); s.small.scale.set(smallScale, smallScale, 1); }
    },
    update(time) {
      for (let i = 0; i < used; i++) {
        const s = pool[i];
        if (s.sprite.scale.x !== scale) { s.sprite.scale.set(scale, scale, 1); s.small.scale.set(smallScale, smallScale, 1); }
        // Bounce in screen space (sprite center), so it is the same on every zoom level.
        // Muted (not affordable) ▲ stays still; everything else bounces.
        s.sprite.center.y = s.still ? 0 : -Math.abs(Math.sin(time * 3.2 + s.phase)) * .22;
        s.small.center.y = s.sprite.center.y * scale / smallScale - .9; // rides along with its interaction badge
      }
    },
    /** Visible badge sprites (for raycasting before the objects themselves). */
    *pickers() { for (let i = 0; i < used; i++) if (pool[i].sprite.visible) yield pool[i].sprite; },
    /** Small ▲ beside interaction badges (checked before the big ones: they overlap). */
    *smallPickers() { for (let i = 0; i < used; i++) if (pool[i].small.visible) yield pool[i].small; },
    setVisible(v) { group.visible = !!v; },
    get visible() { return group.visible; },
    dispose() {
      for (const s of pool) { s.sprite.removeFromParent(); s.small.removeFromParent(); }
      for (const m of Object.values(mats)) { m.map.dispose(); m.dispose(); }
      group.removeFromParent();
    },
  };
}
