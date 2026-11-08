// Farm minimap (reference shot: square map under the top-left HUD). North is up. Owned lots green, lots for sale pale,
// open roads tan, the gate plaza, buildings and the player as a white dot. View only (tap does nothing yet).
import { BOUNDS, PARCELS, ROADS, GATE } from '../../core/config/layout.js';
import { region, roadOpen } from '../../core/derive.js';
import { h } from './dom.js';

const SIZE = 96, PAD = 4;

export function createMinimap(ctx) {
  const canvas = h('canvas', { width: SIZE * 2, height: SIZE * 2, attrs: { 'aria-hidden': 'true' } });
  const el = h('div', { class: 'hud-minimap', attrs: { role: 'img', 'aria-label': 'Map' } }, canvas);
  const g = canvas.getContext('2d');
  g.scale(2, 2);
  let acc = 0, state = null, sig = '';
  const w = BOUNDS.maxX - BOUNDS.minX, d = BOUNDS.maxZ - BOUNDS.minZ;
  const k = Math.min((SIZE - PAD * 2) / w, (SIZE - PAD * 2) / d);
  const ox = (SIZE - w * k) / 2, oy = (SIZE - d * k) / 2;
  const X = x => ox + (x - BOUNDS.minX) * k, Y = z => oy + (z - BOUNDS.minZ) * k;
  const rect = r => g.fillRect(X(r[0]), Y(r[1]), (r[2] - r[0]) * k, (r[3] - r[1]) * k);

  function draw() {
    const s = state, r = s && region(s);
    g.clearRect(0, 0, SIZE, SIZE);
    g.fillStyle = '#9ccf6a'; g.fillRect(0, 0, SIZE, SIZE);
    if (!r) return;
    const owned = new Set(r.parcels || []);
    for (const p of Object.values(PARCELS)) {
      if (p.rect[1] > BOUNDS.maxZ) continue;
      g.fillStyle = owned.has(p.id) ? '#5faa3c' : '#cfe8a8';
      rect(p.rect);
    }
    g.fillStyle = '#e6b070';
    for (const road of Object.values(ROADS)) if (roadOpen(s, road.id)) rect(road.rect);
    g.fillStyle = '#b98f5c'; g.beginPath(); g.arc(X(GATE.x), Y(GATE.z), GATE.radius * k + 1, 0, 7); g.fill();
    g.fillStyle = '#7a4a2a';
    for (const b of r.buildings || []) g.fillRect(X(b.x) - 1.5, Y(b.z) - 1.5, 3, 3);
    const p = ctx.realm?.avatarPosition;
    if (p) {
      g.fillStyle = '#fff'; g.strokeStyle = '#d4452d'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(X(p.x), Y(p.z), 3, 0, 7); g.fill(); g.stroke();
    }
  }
  return {
    el,
    render(s) { state = s; sig = ''; acc = 1; },
    update(dt) {
      acc += dt;
      if (acc < .25 || !el.getClientRects().length) return;
      acc = 0;
      const p = ctx.realm?.avatarPosition;
      const next = `${p ? Math.round(p.x * 2) + ',' + Math.round(p.z * 2) : '-'}|${state?.rev}`;
      if (next === sig) return;
      sig = next;
      draw();
    },
    dispose() {},
  };
}
