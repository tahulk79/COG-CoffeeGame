// Street venues scenery (docs/design/cafe-street.md §3.4): the 3 unlockable shops on the café street, each a 2-floor
// tube house ("nhà ống") on its VENUE_LOTS lot with its own Vietnamese look:
//  · tea  "BÁNH & TRÀ ĐẠO": cream plaster + dark wood posts, red-brown tiled eave and front roof, red lanterns,
//    lattice windows, jars of tea on shelves, bonsai, low wooden tables + wooden stools with red cushions on a bamboo mat
//  · lemon "TRÀ CHANH": yellow house, yellow/green striped awning with a bulb string, drinks fridge, a blue ice cooler
//    and sacks of sunflower seeds, tiny red/blue plastic stools + low plastic tables (seed shells on the ground 🌻)
//  · bar  "BAR": dark brick facade, purple/blue neon (sign, frame, windows), back bar of bottles, beer taps, barrels,
//    chrome stools + barrel tables, string lights from the canopy to two poles over the seats
// Layout per lot (all from VENUE_LOTS): house body z BACK_Z … FRONT_Z (open shopfront facing the street), vendor strip
// FRONT_Z … the counter (VENUE_LOTS[id].vendor stands there), counter 2.6 × 1 m at lot.counter (top ≈ 1.05 m), lot floor
// up to the lot front (queue area), stools + tables on the north sidewalk at lot.seats (seat top ≈ .42 m, tables between
// the two rows, customers face them: venueSeatSpots).
// States (state.world.regions[cur].street.open, derive.venueOpen):
//  · locked: metal roller shutter down (with stuck-on ads), counter under a blue tarp, a "CHƯA MỞ" chalkboard leaning on
//    it (t('realm.venue.closedBoard')), stools stacked + chained, lights off, the whole house tinted dim
//  · open: shutter rolled up, interior goods, counter props, stools + tables, warm unlit "glow" lights, bright sign
// Both states are prebuilt (merged per venue: base / open / locked / glow) and only toggled when the open set changes;
// the sign + chalkboard canvases are redrawn only when their text (language) changes.
// blockers (constant, for nav + avatar): the house + vendor strip (z ≤ COUNTER line), the counter + its flank props,
// and the small decor posts on the sidewalk. Pick box per lot (shopfront + counter) → { kind: 'venue', venue }.
// API: createVenueScene({ scene, templates }) → { group, blockers, sync(state), setView(v), pickers(), lockAnchor(id),
// dispose() }; venueSeatSpots(id) → [{ key, venue, x, z, yaw, cup: {x, y, z}, row }].
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VENUE_LOTS } from '../../core/config/layout.js';
import { venueOpen } from '../../core/derive.js';
import { t } from '../../i18n/index.js';
import { mulberry32, paint, drawEmoji, FONT } from './util.js';

const IDS = ['tea', 'lemon', 'bar'];
const BACK_Z = 92.4;          // house back (same depth as the city's north row)
const FRONT_Z = 103.6;        // shopfront line: the vendor (lot.vendor z 104.7) stands between it and the counter
const LINE_Z = 105.4;         // counter line: everything north of it is out of bounds for customers
const OH = 2.5;               // shopfront opening height (shutter)
const SEAT_TOP = .42;         // stool top (NPC sitting pose drops the model .3)
export const VENUE_TABLE_TOP = { tea: .46, lemon: .52, bar: .76 };
const DIM = 0x8a8a98;         // locked tint (multiplies vertex colors)
const own = id => (typeof id === 'string' && Object.hasOwn(VENUE_LOTS, id) ? VENUE_LOTS[id] : null);
const tableZ = lot => (Math.min(...lot.seats.map(s => s.z)) + Math.max(...lot.seats.map(s => s.z))) / 2;

const STYLE = {
  tea: { H: 6.6, wall: '#efdcb8', inside: '#3b2618', floor: '#cdb995', sign: { w: 6.6, h: 1.25, frame: '#5e3a22' }, glow: .55, stack: ['#7a4a2a'] },
  lemon: { H: 6.0, wall: '#ffe58a', inside: '#4a3a26', floor: '#e9e0c8', sign: { w: 6.8, h: 1.3, frame: '#3f8a35' }, glow: .45, stack: ['#2f6fd6', '#d8342c'] },
  bar: { H: 6.8, wall: '#2b2a33', inside: '#15141c', floor: '#45404d', sign: { w: 5.2, h: 1.7, frame: '#1a1822' }, glow: 1.15, stack: ['#1a1a1e'] },
};

// ---------- seats (for street.js: where customers sit, face, and where their cup goes) ----------
const seatCache = {};
/** Seat spots of venue `id` (constant, cached: do not mutate). Row 0 faces south, row 1 north, both face the table. */
export function venueSeatSpots(id) {
  const lot = own(id);
  if (!lot) return [];
  if (seatCache[id]) return seatCache[id];
  const tz = tableZ(lot), top = VENUE_TABLE_TOP[id] ?? .5;
  return (seatCache[id] = lot.seats.map((s, i) => ({
    key: `${id}:${i}`, venue: id, x: s.x, z: s.z, row: s.row ?? (s.z < tz ? 0 : 1),
    yaw: Math.atan2(0, tz - s.z), cup: { x: s.x, y: top + .02, z: tz + (s.z < tz ? -.2 : .2) },
  })));
}

/** Nav blockers of all venue lots (constant world rects [x0, z0, x1, z1]). */
function venueBlockers() {
  const out = [];
  for (const id of IDS) {
    const lot = VENUE_LOTS[id], [x0, , x1] = lot.rect, cx = lot.cx, c = lot.counter, tz = tableZ(lot);
    out.push([x0, BACK_Z, x1, LINE_Z]);                            // house + vendor strip
    out.push([cx - 3.1, LINE_Z, cx + 3.1, c.z + .55]);            // counter (2.6 m) + flank props
    if (id === 'bar') for (const s of [-1, 1]) out.push([cx + s * 3.9 - .15, tz + 1.6, cx + s * 3.9 + .15, tz + 1.9]); // light poles
    else for (const s of [-1, 1]) out.push([cx + s * 3.7 - .3, tz - .3, cx + s * 3.7 + .3, tz + .3]);              // end pots
  }
  return out;
}

// ---------- geometry helpers ----------
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const ball = (r, ws = 10, hs = 7) => new THREE.SphereGeometry(r, ws, hs);
const ring = (r, tube) => new THREE.TorusGeometry(r, tube, 4, 12).rotateX(Math.PI / 2);
const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);
/** Thin box from a to b (local coords). */
function segment(ax, ay, az, bx, by, bz, r = .02) {
  _d.set(bx - ax, by - ay, bz - az);
  const g = box(r, r, _d.length() || .001);
  g.applyQuaternion(_q.setFromUnitVectors(_z, _d.normalize()));
  return g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
}

/** Part lists of one venue; adders take local x (relative to the lot centre) and world y / z. */
function kit(cx) {
  const lists = { base: [], open: [], locked: [], glow: [] };
  const put = list => (g, color, x = 0, y = 0, z = 0) => { list.push(paint(g.translate(cx + x, y, z), color)); };
  const k = { cx, lists, base: put(lists.base), open: put(lists.open), shut: put(lists.locked), glow: put(lists.glow) };
  k.lit = (make, on, off, x, y, z) => { k.glow(make(), on, x, y, z); k.shut(make(), off, x, y, z); }; // light: on when open
  return k;
}

function fitFont(g, text, maxW, px, min = 12) {
  g.font = FONT.replace('{size}', String(px));
  while (px > min && g.measureText(text).width > maxW) { px -= 2; g.font = FONT.replace('{size}', String(px)); }
  return px;
}
function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Shop sign canvas (one per venue, redrawn on language change). */
function drawSign(g, W, H, id, text) {
  g.save();
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (id === 'tea') {
    g.fillStyle = '#8e2219'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#f2c27a'; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16);
    g.lineWidth = 2; g.strokeRect(16, 16, W - 32, H - 32);
    g.fillStyle = '#f2c27a';
    for (const [x, y] of [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]]) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
    const px = fitFont(g, text, W - 70, Math.round(H * .58));
    g.fillStyle = '#3a0d08'; g.fillText(text, W / 2 + 3, H / 2 + px * .08 + 3);
    g.fillStyle = '#ffe2a0'; g.fillText(text, W / 2, H / 2 + px * .08);
  } else if (id === 'lemon') {
    g.fillStyle = '#ffe14d'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, W, H * .18);
    g.strokeStyle = '#3f8a35'; g.lineWidth = 8; g.strokeRect(5, 5, W - 10, H - 10);
    const e = H * .52, px = fitFont(g, text, W - e * 2.6, Math.round(H * .56));
    g.lineJoin = 'round'; g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeText(text, W / 2, H / 2 + px * .08);
    g.fillStyle = '#2f7d2a'; g.fillText(text, W / 2, H / 2 + px * .08);
    drawEmoji(g, '🍋', e * .95, H / 2 + 2, e);
    drawEmoji(g, '🌻', W - e * .95, H / 2 + 2, e);
  } else {
    g.fillStyle = '#120f1c'; g.fillRect(0, 0, W, H);
    g.shadowColor = '#59d0ff'; g.shadowBlur = 16;
    g.strokeStyle = '#8fe3ff'; g.lineWidth = 5; roundRectPath(g, 14, 14, W - 28, H - 28, 22); g.stroke();
    const px = fitFont(g, text, W - 90, Math.round(H * .66));
    g.lineJoin = 'round';
    g.shadowColor = '#c86bff'; g.shadowBlur = 30; g.strokeStyle = '#e6b8ff'; g.lineWidth = 8;
    g.strokeText(text, W / 2, H / 2 + px * .06);
    g.shadowBlur = 12; g.fillStyle = '#fff4ff'; g.fillText(text, W / 2, H / 2 + px * .06);
  }
  g.restore();
}
/** "CHƯA MỞ" chalkboard (shared by the 3 locked venues). */
function drawClosed(g, W, H, text) {
  g.save();
  g.fillStyle = '#33362f'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 18; i++) g.fillRect((i * 53) % W, (i * 31) % H, 40, 3);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const px = fitFont(g, text, W - 36, Math.round(H * .4));
  g.fillStyle = '#f4f1e6'; g.fillText(text, W / 2, H * .46 + px * .06);
  g.strokeStyle = '#ff6b5a'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath();
  for (let x = 30; x <= W - 30; x += 8) g.lineTo(x, H * .78 + Math.sin(x * .15) * 4);
  g.stroke();
  g.restore();
}
function canvasTexture(W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, g: canvas.getContext('2d'), tex };
}

// ---------- shared pieces ----------
function lantern(k, x, y, z) {
  k.base(cyl(.012, .012, .3, 4), '#3a2a1a', x, y + .36, z);
  k.lit(() => ball(.22).scale(1, .85, 1), '#ff5a3c', '#8e2a20', x, y, z);
  for (const dy of [-.19, .19]) k.base(cyl(.13, .13, .05), '#f2c230', x, y + dy, z);
  k.base(cyl(.03, .01, .22, 4), '#f2c230', x, y - .32, z);
}
function counter(k, z, body, top, trim) {
  k.open(box(2.6, .98, 1), body, 0, .49, z);
  k.open(box(2.3, .7, .03), trim, 0, .5, z + .51);
  k.open(box(2.75, .07, 1.1), top, 0, 1.015, z);
}
function bonsai(add, x, z, stand = true) {
  const y = stand ? .36 : 0;
  if (stand) add(box(.7, .36, .5), '#5e3a22', x, .18, z);
  add(box(.8, .28, .55), '#3f5f7a', x, y + .14, z);
  add(box(.84, .05, .59), '#2f4a62', x, y + .3, z);
  add(cyl(.06, .09, .5, 6).rotateZ(.5), '#6b4a2e', x - .08, y + .52, z);
  add(cyl(.04, .06, .45, 6).rotateZ(-.7), '#6b4a2e', x + .1, y + .86, z);
  add(ball(.32, 8, 6).scale(1, .4, 1), '#4f8a35', x - .26, y + .76, z);
  add(ball(.28, 8, 6).scale(1, .42, 1), '#5fae46', x + .26, y + 1.06, z + .05);
  add(ball(.22, 8, 6).scale(1, .45, 1), '#4f8a35', x, y + 1.26, z - .05);
}
function sunflower(add, x, z) {
  add(box(.42, .36, .42), '#c8643c', x, .18, z);
  add(box(.44, .04, .44), '#a8502e', x, .37, z);
  add(cyl(.025, .03, 1.1, 5), '#4f8a35', x, .9, z);
  add(box(.32, .02, .14).rotateZ(.4), '#5aab35', x + .14, .8, z);
  add(box(.3, .02, .13).rotateZ(-.4), '#5aab35', x - .13, 1.05, z);
  add(cyl(.26, .26, .05, 12).rotateX(1.2), '#f7d23e', x, 1.5, z + .04);
  add(cyl(.13, .13, .06, 10).rotateX(1.2), '#5a4030', x, 1.5, z + .07);
}
function barrel(add, x, z, s = 1) {
  add(cyl(.33 * s, .33 * s, .8 * s, 12), '#8a5a35', x, .4 * s, z);
  add(cyl(.36 * s, .36 * s, .3 * s, 12), '#94643d', x, .4 * s, z); // belly
  for (const y of [.12, .68]) add(cyl(.345 * s, .345 * s, .05 * s, 12), '#3a3a3e', x, y * s, z);
  add(cyl(.3 * s, .3 * s, .02, 12), '#6b4428', x, .805 * s, z);
}
function beer(add, x, y, z) {
  add(cyl(.065, .055, .2, 8), '#f2b736', x, y + .1, z);
  add(cyl(.066, .066, .04, 8), '#fffbe8', x, y + .22, z);
}
/** Rolled-down metal shutter + stuck-on ads (locked). */
function shutter(k, ow, rnd) {
  const f = FRONT_Z;
  k.shut(box(ow + .12, OH, .05), '#a9b0b6', 0, OH / 2, f + .08);
  for (let y = .16; y < OH - .05; y += .2) k.shut(box(ow + .1, .035, .04), '#8b9298', 0, y, f + .12);
  k.shut(box(.6, .05, .07), '#5d6168', 0, .12, f + .14);
  k.shut(box(.13, .16, .06), '#d9b24a', 0, .26, f + .15);                          // padlock
  for (let i = 0; i < 4; i++) {                                                       // "khoan cắt bê tông" stickers
    const x = (rnd() - .5) * (ow - 1.5), y = .7 + rnd() * 1.3;
    k.shut(box(.34, .22, .01), i % 2 ? '#ffffff' : '#ffe066', x, y, f + .145);
    k.shut(box(.26, .03, .012), '#d8342c', x, y + .04, f + .15);
  }
}
/** Locked counter under a blue tarp + the chalkboard frame leaning on it (the text is a separate textured plane). */
function tarp(k, z) {
  k.shut(box(2.72, 1.02, 1.1), '#2f6fd6', 0, .51, z);
  k.shut(box(2.76, .04, 1.14), '#2558b8', 0, .8, z);
  for (const x of [-.9, .9]) k.shut(box(.04, 1.05, 1.15), '#d9c08a', x, .5, z);     // ropes
  k.shut(box(1.4, .85, .05).rotateX(-.25), '#6b4a2e', 0, .62, z + .7);
  for (const x of [-.6, .6]) k.shut(box(.05, .24, .05), '#6b4a2e', x, .12, z + .8);
}
/** Stools stacked + chained in the middle of the seating area (locked). */
function stack(k, z, colors) {
  for (let i = 0; i < 5; i++) k.shut(cyl(.2, .23, .3, 8), colors[i % colors.length], 0, .15 + i * .12, z);
  k.shut(cyl(.21, .21, .04, 8), colors[4 % colors.length], 0, .8, z);
  k.shut(ring(.26, .025), '#5d6168', 0, .45, z);
  k.shut(box(.1, .12, .05), '#d9b24a', 0, .36, z + .27);
}
/** Stools at lot.seats + one table per column (open). */
function seating(k, id, stool, table) {
  const lot = VENUE_LOTS[id], tz = tableZ(lot);
  venueSeatSpots(id).forEach((s, i) => stool(k.open, s.x - k.cx, s.z, i));
  [...new Set(lot.seats.map(s => s.x))].forEach((x, j) => table(k.open, x - k.cx, tz, j));
}

// ---------- the three shops ----------
function teaHouse(k, lot, w, rnd) {
  const f = FRONT_Z, ow = w - 1.4, H = STYLE.tea.H, cz = lot.counter.z, tz = tableZ(lot);
  const pick = list => list[Math.floor(rnd() * list.length)];
  for (const s of [-1, 1]) k.base(box(.36, 2.9, .36), '#5e3a22', s * (ow / 2 + .2), 1.45, f + .18);
  // tiled eave over the shopfront (ends ≈ 1.2 m out: the vendor stays visible from the street camera)
  const n = Math.round((w + .4) / .42), tw = (w + .4) / n;
  for (let i = 0; i < n; i++) k.base(box(tw - .03, .1, 1.4).translate(0, 0, .7).rotateX(.33), i % 2 ? '#a8462e' : '#94402a', -(w + .4) / 2 + tw * (i + .5), 3.15, f);
  for (const s of [-1, 1]) k.base(new THREE.ConeGeometry(.1, .45, 5).rotateZ(-s * .9), '#94402a', s * (w / 2 + .3), 2.85, f + 1.3);
  for (const x of [-4.4, -1.8, 1.8, 4.4]) lantern(k, x, 2.2, f + 1.0);
  // upper floor: wooden lattice windows beside the sign
  for (const s of [-1, 1]) {
    const x = s * 4.9;
    k.base(box(2, 1.6, .06), '#8a5a35', x, 4.5, f + .03);
    for (let j = 1; j < 4; j++) k.base(box(.05, 1.6, .08), '#5e3a22', x - 1 + j * .5, 4.5, f + .05);
    for (let j = 1; j < 3; j++) k.base(box(2, .05, .08), '#5e3a22', x, 3.7 + j * .533, f + .05);
    k.base(box(2.2, .12, .16), '#5e3a22', x, 3.65, f + .08);
  }
  // front tiled roof (mái ngói) with ridge + upturned ends
  const L = 3.8, a = Math.atan2(1.5, 3.5);
  k.base(box(w + .5, .14, L).translate(0, 0, L / 2).rotateX(a), '#a8462e', 0, H + 1.4, f - 3.2);
  for (let i = 0; i < Math.round((w + .5) / .5); i++) k.base(box(.08, .08, L).translate(0, 0, L / 2).rotateX(a), '#8e3a26', -(w + .5) / 2 + .5 * (i + .5), H + 1.48, f - 3.2);
  k.base(box(w + .8, .22, .3), '#8e3a26', 0, H + 1.5, f - 3.2);
  for (const s of [-1, 1]) k.base(new THREE.ConeGeometry(.12, .6, 5).rotateZ(-s * .7), '#8e3a26', s * (w / 2 + .55), H + 1.75, f - 3.2);
  k.base(box(w - .2, .7, 1.6), '#e2cfa8', 0, H + .35, f - 2.4);
  // interior (open): shelves of tea jars, calligraphy scrolls, warm light
  for (const y of [.95, 1.7]) {
    k.open(box(ow - 1.6, .06, .36), '#8a5a35', 0, y, f + .2);
    for (let x = -ow / 2 + 1.1; x < ow / 2 - 1; x += .55) k.open(cyl(.12, .14, .3), pick(['#3f6f4a', '#c8643c', '#e9d9b8', '#dfe8f2', '#5e3a22']), x, y + .18, f + .2);
  }
  for (const s of [-1, 1]) {
    k.open(box(.6, 1.4, .03), '#f4ecd8', s * 5.4, 1.4, f + .05);
    k.open(box(.08, .9, .035), '#2a2a2a', s * 5.4, 1.45, f + .06);
  }
  k.lit(() => box(ow - .4, .06, .06), '#ffd9a0', '#5a4a3a', 0, 2.4, f + .12);
  // counter: teapot, cups, a plate of mooncakes
  counter(k, cz, '#7a4a2a', '#4a2c18', '#5e3a22');
  k.open(ball(.16, 10, 8).scale(1, .8, 1), '#3f6f4a', -.6, 1.18, cz);
  k.open(cyl(.03, .04, .22, 6).rotateZ(-.9), '#3f6f4a', -.4, 1.2, cz);
  k.open(cyl(.06, .08, .05), '#3f6f4a', -.6, 1.31, cz);
  for (let i = 0; i < 3; i++) k.open(cyl(.05, .04, .07), '#f4ecd8', -.1 + i * .18, 1.085, cz + .2);
  k.open(cyl(.22, .22, .025, 12), '#f4ecd8', .7, 1.065, cz - .05);
  for (const [dx, dz] of [[-.08, -.08], [.1, -.06], [0, .1]]) k.open(cyl(.08, .08, .06), '#c88a3c', .7 + dx, 1.11, cz - .05 + dz);
  // flanks + seating
  for (const s of [-1, 1]) bonsai(k.base, s * 2.55, cz - .05);
  k.base(box(7.4, .02, 3.6), '#d8c08a', 0, .012, tz);
  for (let i = 0; i <= 10; i++) k.base(box(7.4, .022, .035), '#c2a86e', 0, .013, tz - 1.7 + i * .34);
  for (const s of [-1, 1]) bonsai(k.base, s * 3.7, tz, false);
  seating(k, 'tea', (add, x, z) => {
    add(cyl(.17, .2, SEAT_TOP - .08, 8), '#7a4a2a', x, (SEAT_TOP - .08) / 2, z);
    add(cyl(.22, .22, .08, 10), '#c2302a', x, SEAT_TOP - .04, z);
  }, (add, x, z) => {
    const top = VENUE_TABLE_TOP.tea;
    add(box(.72, .05, .72), '#5e3a22', x, top - .025, z);
    for (const [dx, dz] of [[-.28, -.28], [.28, -.28], [-.28, .28], [.28, .28]]) add(box(.06, top - .05, .06), '#4a2c18', x + dx, (top - .05) / 2, z + dz);
    add(ball(.08, 8, 6).scale(1, .8, 1), '#3f6f4a', x, top + .06, z);
  });
  stack(k, tz, STYLE.tea.stack);
}

function lemonShop(k, lot, w, rnd) {
  const f = FRONT_Z, ow = w - 1.2, H = STYLE.lemon.H, cz = lot.counter.z, tz = tableZ(lot);
  const pick = list => list[Math.floor(rnd() * list.length)];
  for (const s of [-1, 1]) k.base(box(.4, 2.8, .3), '#fff7e0', s * (ow / 2 + .2), 1.4, f + .15);
  // striped awning, scalloped edge, bulb string
  const n = Math.max(8, Math.round((w + .2) / .6)), sw = (w + .2) / n, ez = f + 1.5 * Math.cos(.32);
  for (let i = 0; i < n; i++) {
    const c = i % 2 ? '#7cc242' : '#f7d23e', x = -(w + .2) / 2 + sw * (i + .5);
    k.base(box(sw, .05, 1.5).translate(0, 0, .75).rotateX(.32), c, x, 2.95, f);
    k.base(box(sw - .04, .22, .03), c, x, 2.37, ez + .02);
  }
  k.base(box(w, .015, .015), '#2a2a2e', 0, 2.24, ez + .05);
  for (let x = -w / 2 + .6; x < w / 2 - .4; x += .9) k.lit(() => ball(.06, 8, 6), '#fff2b8', '#8a8578', x, 2.17, ez + .05);
  // upper floor: windows with green shutters + flower boxes; roof parapet, water tank, a sunflower pot
  for (const s of [-1, 1]) {
    const x = s * 4.6;
    k.base(box(1.2, 1.5, .06), '#9fd3e8', x, 4.5, f + .03);
    for (const d of [-.9, .9]) k.base(box(.55, 1.5, .06), '#5aab35', x + d, 4.5, f + .06);
    k.base(box(1.4, .22, .3), '#b5794a', x, 3.68, f + .18);
    for (let j = 0; j < 4; j++) k.base(ball(.11, 6, 5), pick(['#ff8a3c', '#ffe066', '#ff6f8f', '#5fae46']), x - .5 + j * .33, 3.86, f + .18);
  }
  k.base(box(w, .4, .16), '#5aab35', 0, H + .2, f - .08);
  k.base(cyl(.45, .45, 1.2, 10).rotateZ(Math.PI / 2), '#cfd6dc', -3, H + .7, f - 3);
  k.base(box(1.1, .2, .6), '#8a8f94', -3, H + .1, f - 3);
  sunflower((g, c, x, y, z) => k.base(g, c, x, y + H, z), 3.6, f - .8); // on the roof
  // interior (open): drinks fridge, shelves of snack bags, light strip
  k.open(box(1.1, 2.0, .6), '#e9eef2', -4.3, 1.0, f + .32);
  k.open(box(.9, 1.6, .02), '#bfe6f2', -4.3, 1.1, f + .63);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) k.open(cyl(.05, .05, .26, 6), pick(['#f2c230', '#5aab35', '#d8342c', '#ff8a3c']), -4.6 + c * .2, .55 + r * .5, f + .66);
  for (const y of [.8, 1.5]) {
    k.open(box(4, .05, .35), '#f4f1e6', 2.6, y, f + .2);
    for (let j = 0; j < 9; j++) k.open(box(.24, .3, .12), pick(['#d8342c', '#f2c230', '#2f6fd6', '#5aab35', '#ff8a3c']), .9 + j * .42, y + .17, f + .2);
  }
  k.lit(() => box(ow - .4, .06, .06), '#fff6d6', '#5a5448', 0, 2.42, f + .12);
  // counter: green with lemon slices, a jar of lemons, cup stack, two lemon teas
  counter(k, cz, '#7cc242', '#f4f1e6', '#5aab35');
  for (const x of [-.8, 0, .8]) {
    k.open(cyl(.2, .2, .03, 12).rotateX(Math.PI / 2), '#f7d23e', x, .55, cz + .53);
    k.open(cyl(.15, .15, .035, 12).rotateX(Math.PI / 2), '#fff7c8', x, .55, cz + .535);
  }
  k.open(cyl(.2, .2, .36, 10), '#d6eef2', -.75, 1.23, cz);
  for (const [dx, dz] of [[-.07, 0], [.07, .04], [0, -.07]]) k.open(ball(.08, 8, 6), '#f7d23e', -.75 + dx, 1.45, cz + dz);
  k.open(cyl(.07, .06, .3), '#ffffff', .2, 1.2, cz - .15);
  for (const x of [.55, .8]) {
    k.open(cyl(.07, .06, .2), '#f2b736', x, 1.15, cz + .15);
    k.open(box(.015, .16, .015), '#d8342c', x + .02, 1.3, cz + .15);
  }
  // flanks: blue ice cooler, sacks of sunflower seeds
  k.base(box(.9, .6, .6), '#2f6fd6', -2.55, .3, cz - .05);
  k.base(box(.94, .08, .64), '#ffffff', -2.55, .64, cz - .05);
  k.base(cyl(.3, .34, .6, 8), '#d9c08a', 2.35, .3, cz - .05);
  k.base(cyl(.28, .28, .04, 8), '#3a2a1a', 2.35, .61, cz - .05);
  k.base(cyl(.22, .26, .44, 8), '#e6cf9a', 2.95, .22, cz + .1);
  k.base(cyl(.2, .2, .04, 8), '#3a2a1a', 2.95, .45, cz + .1);
  // seating: plastic stools + tables, seed shells on the ground, sunflower pots at both ends
  for (const s of [-1, 1]) sunflower(k.base, s * 3.7, tz);
  const COLORS = ['#2f6fd6', '#d8342c'];
  seating(k, 'lemon', (add, x, z, i) => {
    const c = COLORS[(i + (z > tz ? 1 : 0)) % 2];
    add(cyl(.18, .22, SEAT_TOP - .04, 8), c, x, (SEAT_TOP - .04) / 2, z);
    add(cyl(.2, .2, .04, 10), c, x, SEAT_TOP - .02, z);
  }, (add, x, z, j) => {
    const c = COLORS[(j + 1) % 2], top = VENUE_TABLE_TOP.lemon;
    add(box(.6, .05, .6), c, x, top - .025, z);
    for (const [dx, dz] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]]) add(box(.05, top - .05, .05), c, x + dx, (top - .05) / 2, z + dz);
    add(cyl(.12, .12, .02, 10), '#f4f1e6', x + .17, top + .01, z);
    add(cyl(.09, .06, .04, 8), '#5a4030', x + .17, top + .04, z);
    for (let s = 0; s < 9; s++) add(box(.05, .01, .03), '#3a2a1a', x + (rnd() - .5) * 1.3, .006, z + (rnd() - .5) * 2.4);
  });
  stack(k, tz, STYLE.lemon.stack);
}

function barShop(k, lot, w, rnd) {
  const f = FRONT_Z, ow = w - 1.4, H = STYLE.bar.H, cz = lot.counter.z, tz = tableZ(lot);
  const pick = list => list[Math.floor(rnd() * list.length)];
  for (let y = 3.1; y < H - .1; y += .32) k.base(box(w - .1, .04, .02), '#3a3540', 0, y, f + .01);
  for (const s of [-1, 1]) {
    k.base(box(.4, 2.9, .3), '#1f1e26', s * (ow / 2 + .2), 1.45, f + .15);
    k.lit(() => box(.07, 2.5, .07), '#b45cff', '#3e3448', s * (ow / 2 + .42), 1.35, f + .32);
  }
  // flat canopy with a blue neon edge
  k.base(box(w, .12, 1.3), '#1f1e26', 0, 2.9, f + .65);
  k.lit(() => box(w - .2, .05, .05), '#59d0ff', '#2e3a44', 0, 2.8, f + 1.27);
  // upper floor: purple glowing windows with blinds, AC unit, parapet neon
  for (const s of [-1, 1]) {
    const x = s * 4.9;
    k.base(box(2.1, 1.7, .08), '#1a1822', x, 4.6, f + .03);
    k.lit(() => box(1.8, 1.4, .02), '#7a4bd6', '#2a2633', x, 4.6, f + .08);
    for (let j = 0; j < 4; j++) k.base(box(1.8, .03, .03), '#1a1822', x, 4.1 + j * .3, f + .1);
  }
  k.base(box(.8, .5, .3), '#cfd3d8', 5.4, 3.35, f + .15);
  k.base(box(w, .35, .14), '#1f1e26', 0, H + .17, f - .07);
  k.lit(() => box(w - .2, .05, .05), '#59d0ff', '#2e3a44', 0, H + .36, f + .02);
  // interior (open): back bar of bottles with glowing shelf edges
  for (const y of [1.2, 1.75]) {
    k.open(box(ow - 2, .05, .3), '#3a2418', 0, y, f + .18);
    for (let x = -ow / 2 + 1.2; x < ow / 2 - 1.1; x += .32) k.open(cyl(.045, .05, .3, 6), pick(['#4fae5a', '#c88a3c', '#d8342c', '#e9eef2', '#59d0ff']), x, y + .17, f + .18);
    k.lit(() => box(ow - 2, .03, .03), '#59d0ff', '#2e3a44', 0, y - .04, f + .34);
  }
  // decor high stools against the facade (inside the blocked strip)
  for (const s of [-1, 1]) {
    const x = s * 4.6, z = f + .9;
    k.base(cyl(.18, .18, .03, 10), '#c9ccd2', x, .015, z);
    k.base(cyl(.03, .03, .76, 6), '#c9ccd2', x, .38, z);
    k.base(ring(.14, .015), '#c9ccd2', x, .3, z);
    k.base(cyl(.2, .2, .07, 10), '#b0303a', x, .79, z);
  }
  // counter: dark wood, copper top, beer taps, two beers
  counter(k, cz, '#3a2418', '#c07a3a', '#2a1a10');
  for (let i = 0; i < 11; i++) k.open(box(.06, .7, .04), '#2a1a10', -1.1 + i * .22, .5, cz + .52);
  k.open(box(.9, .03, .18), '#8a8f94', -.25, 1.065, cz - .15);
  for (let i = 0; i < 3; i++) {
    const x = -.5 + i * .25;
    k.open(cyl(.03, .03, .35, 6), '#d9b24a', x, 1.22, cz - .25);
    k.open(box(.05, .18, .05), ['#1a1a1a', '#d8342c', '#2f6fd6'][i], x, 1.48, cz - .25);
  }
  beer(k.open, .6, 1.05, cz + .1);
  beer(k.open, .85, 1.05, cz - .05);
  // flanks: barrels (a keg on top of one, two empty glasses on the other)
  barrel(k.base, -2.6, cz - .05);
  k.base(cyl(.2, .2, .4, 10), '#c9ccd2', -2.6, 1.0, cz - .05);
  barrel(k.base, 2.6, cz - .05);
  beer(k.base, 2.5, .81, cz - .1);
  // string lights: canopy edge → two poles behind the seats (straight + crossed strands)
  const py = 3.15, pz = tz + 1.75, cy = 2.85, czn = f + 1.3;
  for (const s of [-1, 1]) {
    k.base(cyl(.05, .07, py + .05, 6), '#1f1e26', s * 3.9, (py + .05) / 2, pz);
    k.base(cyl(.22, .22, .05, 10), '#1f1e26', s * 3.9, .025, pz);
  }
  const strands = [[-3.9, 3.9], [3.9, -3.9], [-3.9, -3.9], [3.9, 3.9]].map(([a, b]) => [a, cy, czn, b, py, pz]);
  strands.push([-3.9, py, pz, 3.9, py, pz]);
  for (const [ax, ay, az, bx, by, bz] of strands) {
    const N = 10, sag = .45;
    let px = ax, pyy = ay, pzz = az;
    for (let i = 1; i <= N; i++) {
      const u = i / N, x = ax + (bx - ax) * u, y = ay + (by - ay) * u - Math.sin(u * Math.PI) * sag, z = az + (bz - az) * u;
      k.base(segment(px, pyy, pzz, x, y, z, .018), '#1a1a1e');
      if (i < N) k.lit(() => ball(.055, 6, 5), i % 3 ? '#ffd36b' : '#ff7ad9', '#6a6458', x, y - .06, z);
      px = x; pyy = y; pzz = z;
    }
  }
  // seating: chrome stools (red / black seats) + barrel tables with a beer bucket
  seating(k, 'bar', (add, x, z, i) => {
    add(cyl(.18, .18, .03, 10), '#c9ccd2', x, .015, z);
    add(cyl(.03, .03, SEAT_TOP - .07, 6), '#c9ccd2', x, (SEAT_TOP - .07) / 2, z);
    add(ring(.13, .014), '#c9ccd2', x, .2, z);
    add(cyl(.2, .2, .07, 10), i % 2 ? '#1a1a1e' : '#b0303a', x, SEAT_TOP - .035, z);
  }, (add, x, z) => {
    const top = VENUE_TABLE_TOP.bar;
    barrel(add, x, z, .9);
    add(cyl(.34, .34, .04, 12), '#6b4428', x, top - .02, z);
    add(cyl(.11, .09, .16, 8), '#c9ccd2', x + .18, top + .08, z);
    for (const d of [-.03, .03]) add(cyl(.02, .025, .16, 5), '#4fae5a', x + .18 + d, top + .2, z + d);
  });
  stack(k, tz, STYLE.bar.stack);
}
const BUILD = { tea: teaHouse, lemon: lemonShop, bar: barShop };

/**
 * @param {{ scene: THREE.Scene, templates?: Record<string, THREE.Object3D|null> }} opts  templates unused (all procedural)
 */
export function createVenueScene({ scene }) {
  const group = new THREE.Group();
  group.name = 'realm-venues';
  scene.add(group);
  const disposables = [];
  const keep = x => (disposables.push(x), x);
  const openMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, vertexColors: true, flatShading: true }));
  const lockMat = keep(new THREE.MeshStandardMaterial({ color: DIM, roughness: .9, vertexColors: true, flatShading: true }));
  const glowMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }));
  const pickMat = keep(new THREE.MeshBasicMaterial({ visible: false }));
  const closed = canvasTexture(256, 144);
  keep(closed.tex);
  const closedMat = keep(new THREE.MeshStandardMaterial({ map: closed.tex, roughness: .95, emissive: 0xffffff, emissiveMap: closed.tex, emissiveIntensity: .12 }));
  let closedText = null;
  const blockers = venueBlockers();

  function meshOf(list, mat, shadow) {
    if (!list.length) return null;
    const geo = keep(mergeGeometries(list));
    list.forEach(g => g.dispose());
    list.length = 0;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    m.raycast = () => {};
    return m;
  }

  const venues = {};
  for (const id of IDS) {
    const lot = VENUE_LOTS[id], st = STYLE[id], [x0, , x1, z1] = lot.rect, w = x1 - x0, cx = lot.cx;
    const rnd = mulberry32(5150 + IDS.indexOf(id) * 97);
    const k = kit(cx);
    const ow = w - (id === 'lemon' ? 1.2 : 1.4);
    // common shell: house body, open shopfront recess, shutter roll box, parapet, lot floor, sign backing
    k.base(box(w - .1, st.H, FRONT_Z - BACK_Z), st.wall, 0, st.H / 2, (BACK_Z + FRONT_Z) / 2);
    k.base(box(ow, OH, .04), st.inside, 0, OH / 2, FRONT_Z + .02);
    k.base(box(ow + .3, .3, .32), '#7d848a', 0, OH + .15, FRONT_Z + .17);
    k.base(box(w - .2, .03, z1 - FRONT_Z), st.floor, 0, .015, (FRONT_Z + z1) / 2);
    k.base(box(st.sign.w + .3, st.sign.h + .25, .14), st.sign.frame, 0, lot.sign.y, FRONT_Z + .07);
    shutter(k, ow, rnd);
    tarp(k, lot.counter.z);
    BUILD[id](k, lot, w, rnd);

    const root = new THREE.Group();
    root.name = `venue-${id}`;
    const baseMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, vertexColors: true, flatShading: true }));
    const base = meshOf(k.lists.base, baseMat, true);
    const openGroup = new THREE.Group(), lockGroup = new THREE.Group();
    const openMesh = meshOf(k.lists.open, openMat, true), glowMesh = meshOf(k.lists.glow, glowMat, false);
    const lockMesh = meshOf(k.lists.locked, lockMat, true);
    for (const m of [openMesh, glowMesh]) if (m) openGroup.add(m);
    if (lockMesh) lockGroup.add(lockMesh);
    // chalkboard text on the board leaning on the tarp (same tilt)
    const a = .25, board = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.24, .7).rotateX(-a).translate(cx, .62 + .03 * Math.sin(a), lot.counter.z + .7 + .03 * Math.cos(a))), closedMat);
    board.raycast = () => {};
    lockGroup.add(board);
    // sign (own canvas, redrawn on language change)
    const sW = 512, sH = Math.round(512 * st.sign.h / st.sign.w), sign = canvasTexture(sW, sH);
    keep(sign.tex);
    const signMat = keep(new THREE.MeshStandardMaterial({ map: sign.tex, roughness: .7, emissive: 0xffffff, emissiveMap: sign.tex, emissiveIntensity: st.glow }));
    const signMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(st.sign.w, st.sign.h).translate(cx, lot.sign.y, FRONT_Z + .145)), signMat);
    signMesh.raycast = () => {};
    // pick box: shopfront + counter (taps on the queue area in front stay ground taps)
    const pz0 = FRONT_Z - .5, pz1 = lot.counter.z + 1;
    const pick = new THREE.Mesh(keep(new THREE.BoxGeometry(w - .4, 5.6, pz1 - pz0).translate(cx, 2.8, (pz0 + pz1) / 2)), pickMat);
    pick.visible = false;
    pick.userData.target = { kind: 'venue', venue: id };
    if (base) root.add(base);
    root.add(openGroup, lockGroup, signMesh, pick);
    group.add(root);
    venues[id] = { id, lot, st, root, baseMat, signMat, sign, sW, sH, openGroup, lockGroup, pick, open: null, text: null };
    apply(venues[id], false);
  }

  function apply(v, open) {
    v.open = open;
    v.openGroup.visible = open;
    v.lockGroup.visible = !open;
    v.baseMat.color.setHex(open ? 0xffffff : DIM);
    v.signMat.color.setHex(open ? 0xffffff : 0x9a9aa6);
    v.signMat.emissiveIntensity = open ? v.st.glow : .04;
  }
  function redrawTexts() {
    for (const v of Object.values(venues)) {
      const text = t(`realm.venueSign.${v.id}`);
      if (text === v.text) continue;
      v.text = text;
      drawSign(v.sign.g, v.sW, v.sH, v.id, text);
      v.sign.tex.needsUpdate = true;
    }
    const ct = t('realm.venue.closedBoard');
    if (ct !== closedText) {
      closedText = ct;
      drawClosed(closed.g, 256, 144, ct);
      closed.tex.needsUpdate = true;
    }
  }
  redrawTexts();

  return {
    group,
    blockers,
    /** Shows each venue open / locked (only touches what changed) and refreshes sign texts on a language change. */
    sync(state) {
      for (const id of IDS) {
        const open = !!state?.world && venueOpen(state, id);
        if (venues[id].open !== open) apply(venues[id], open);
      }
      redrawTexts();
    },
    setView(view) { group.visible = view === 'cafe'; },
    /** Invisible pick boxes (one per venue lot), target { kind: 'venue', venue }. */
    *pickers() { if (group.visible) for (const id of IDS) yield venues[id].pick; },
    /** World point for the lock badge / price chip of venue `id` (above the "CHƯA MỞ" board), or null. */
    lockAnchor(id) {
      const lot = own(id);
      return lot ? { x: lot.cx, y: 2.3, z: lot.counter.z + .6 } : null;
    },
    dispose() {
      group.removeFromParent();
      for (const d of disposables) d.dispose?.();
      disposables.length = 0;
    },
  };
}
