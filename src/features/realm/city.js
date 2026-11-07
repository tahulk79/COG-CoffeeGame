// Café area scenery: a small Vietnamese city street, simple and readable (founder: "phong cảnh thành phố Việt Nam,
// hướng tới đơn giản, dễ chơi"). Everything static is merged into a few meshes (vertex colors, one material):
//  · rows of narrow tube houses ("nhà ống", 2–4 floors): open shopfront, striped awning, shop sign, balconies with
//    railings and potted plants, red lanterns, AC units, water tanks; a lighter, taller skyline row behind for depth
//  · the café's own house (Godbean) behind the starter block S, lantern string + brand awning
//  · asphalt street (CAFE_ROADS.cafeFront) + alley (cafeStreet) with lane dashes, a zebra crossing and curbs
//  · sidewalks with street trees, lamp posts, power poles + wires, parked scooters
//  · the street is 4 shops long (docs/design/cafe-street.md): tea house · café block (C3 · alley · S · C2) · lemon
//    tea · bar. The 3 venue lots (VENUE_LOTS) are left EMPTY here (venues-scene.js draws their houses, shutters,
//    counters and stools, and their nav blockers); the north row skips their x span. The other gaps between the shop
//    lots get a deep street-front tube house (front on the sidewalk, z ≈ 113.6), and past the outer lots the street
//    wall continues with street-front houses into the fog (STREET_X)
//  (the terrace seating in front of the café is the upgradable 'terrace' building, drawn by buildings.js)
//  · shop sign texts: one canvas atlas, all boards in one mesh
// Returns { blockers (house rects the player cannot enter), dispose() }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAFE_ROADS, CAFE_BOUNDS, PARCELS, FIXED, VENUE_LOTS } from '../../core/config/layout.js';
import { BUILDINGS, CELL } from '../../core/config/economy.js';
import { mulberry32, paint, FONT } from './util.js';

const STREET = CAFE_ROADS.cafeFront.rect;   // [-46, 118.5, 62, 121.5]
const ALLEY = CAFE_ROADS.cafeStreet.rect;   // [-9.5, 94, -6.5, 130]
const STREET_X = [-70, 80];                  // the street runs on past the playable area (CAFE_BOUNDS) into the fog
const LITE_X = [CAFE_BOUNDS.minX, CAFE_BOUNDS.maxX]; // houses centred outside: fewer small parts (fog, edge of view)
const ALLEY_Z = [80, 144];
// Street rows sit just outside the café lots (S / C2 / C3 share z 100–114) and the terrace (FIXED.terrace).
const LOTS = ['S', 'C2', 'C3'].map(id => PARCELS[id].rect);
const LOT_Z0 = Math.min(...LOTS.map(r => r[1])), LOT_Z1 = Math.max(...LOTS.map(r => r[3]));
// Venue lots (tea / lemon / bar): their whole x span, from the back row to the lot front, belongs to venues-scene.js.
const VENUE_RECTS = Object.values(VENUE_LOTS).map(v => v.rect);
// All 6 shop lots west → east (C3 · S · C2 + the venues): the gaps between them get street-front houses.
const SHOP_LOTS = [...LOTS, ...VENUE_RECTS].sort((a, b) => a[0] - b[0]);
const SHOPS_X0 = SHOP_LOTS[0][0], SHOPS_X1 = SHOP_LOTS[SHOP_LOTS.length - 1][2];
const TERRACE_HALF_W = BUILDINGS.terrace.size[0] * CELL / 2;
const TERRACE_X = [FIXED.terrace.x - TERRACE_HALF_W, FIXED.terrace.x + TERRACE_HALF_W];
const FLOOR_H = 2.8;
const WALLS = ['#f6d36b', '#9fd8c4', '#f4a7a1', '#a9cdef', '#fbe7c6', '#f2b36d', '#c9e59a', '#e9c2e6', '#ffe08a', '#bfe3f2'];
const TRIM = ['#ffffff', '#fff4e0', '#5c8f6a', '#3f6f9f', '#b5523a'];
const AWNINGS = [['#e8673c', '#fff4e0'], ['#2f9e8f', '#f4f1e6'], ['#3f6fd0', '#ffffff'], ['#d8342c', '#ffd34d'], ['#5aab35', '#ffffff']];
const SIGN_TEXTS = ['PHỞ BÒ', 'BÁNH MÌ', 'TẠP HÓA', 'TIỆM HOA', 'NƯỚC MÍA', 'CƠM TẤM', 'SỬA XE', 'TRÀ SỮA', 'BÚN CHẢ', 'HỦ TIẾU'];
const SIGN_COLORS = ['#d8342c', '#f2a516', '#2f6fd6', '#2f9e8f', '#5aab35', '#c2416f', '#6a4fc4', '#e8673c', '#b5523a', '#1f7f6a'];
const SCOOTERS = ['#d8342c', '#2f6fd6', '#f4f1e6', '#f2c230', '#2a2a2e', '#5aab35', '#c2416f'];

// Sign atlas: one row per text (canvas 512 × 64·n), mapped onto flat boards.
function signAtlas() {
  const rowH = 64, canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = rowH * SIGN_TEXTS.length;
  const g = canvas.getContext('2d');
  SIGN_TEXTS.forEach((text, i) => {
    const y = i * rowH;
    g.fillStyle = SIGN_COLORS[i]; g.fillRect(0, y, 512, rowH);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y, 512, 6);
    g.strokeStyle = '#fff6dc'; g.lineWidth = 5; g.strokeRect(5, y + 5, 502, rowH - 10);
    g.fillStyle = '#fffbe8'; g.font = FONT.replace('{size}', '40'); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, y + rowH / 2 + 2);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, rows: SIGN_TEXTS.length };
}

/**
 * @param {THREE.Group} target  café area group
 * @param {(x: any) => any} keep  registers disposables
 * @param {{ props: THREE.Material }} mats  shared vertex-color material
 */
export function buildCity(target, keep, mats) {
  const rnd = mulberry32(8421);
  const pick = list => list[Math.floor(rnd() * list.length)];
  const parts = [];          // world-space colored parts (one merged mesh)
  const signParts = [];      // sign board planes (textured)
  const blockers = [];
  const atlas = signAtlas();
  keep(atlas.tex);
  let signIndex = 0;

  // ---- local-frame builder: a house is built facing +z around the origin, then turned/moved into place ----
  function frame(rotY, tx, tz) {
    const local = [];
    const add = (g, color, x, y, z) => local.push(paint(g.translate(x, y, z), color));
    const flush = () => { for (const g of local) parts.push(g.rotateY(rotY).translate(tx, 0, tz)); local.length = 0; };
    const sign = (w, h, x, y, z) => {
      const row = signIndex++ % atlas.rows;
      const g = new THREE.PlaneGeometry(w, h).translate(x, y, z);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (row + 1 - uv.getY(i)) / atlas.rows);
      signParts.push(g.rotateY(rotY).translate(tx, 0, tz));
    };
    return { add, flush, sign };
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  function lantern(add, x, y, z, s = 1) {
    add(new THREE.CylinderGeometry(.015, .015, .25 * s, 4), '#3a2a1a', x, y + .3 * s, z);
    add(new THREE.SphereGeometry(.22 * s, 10, 7).scale(1, .85, 1), '#d8342c', x, y, z);
    add(new THREE.CylinderGeometry(.13 * s, .13 * s, .05 * s, 8), '#f2c230', x, y + .19 * s, z);
    add(new THREE.CylinderGeometry(.13 * s, .13 * s, .05 * s, 8), '#f2c230', x, y - .19 * s, z);
    add(new THREE.CylinderGeometry(.03 * s, .01 * s, .22 * s, 4), '#f2c230', x, y - .32 * s, z);
  }
  function pots(add, w, y, z, n) {
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + .45 + (w - .9) * (n === 1 ? .5 : i / (n - 1));
      add(box(.3, .26, .3), pick(['#c8643c', '#b5794a', '#e0d6c4']), x, y + .13, z);
      add(new THREE.IcosahedronGeometry(.26 + rnd() * .08, 0).scale(1, .8 + rnd() * .5, 1), pick(['#4f9e3a', '#5fae46', '#3f8a35']), x, y + .42, z);
      if (rnd() < .5) add(new THREE.IcosahedronGeometry(.07, 0), pick(['#ff6f8f', '#ffe066', '#ffffff', '#ff8a3c']), x + .08, y + .6, z + .1);
    }
  }

  /**
   * Tube house ("nhà ống"). rect = world footprint [x0, z0, x1, z1]; face: side of the front ('s' | 'n' | 'e' | 'w').
   * opts: floors, wall, shop (sign on the ground floor), lanterns, tank, lite (no shelf goods / lanterns / laundry,
   * solid balcony railing, ≤ 1 pot: default for houses outside the playable x range, keeps the merged mesh small).
   */
  function tubeHouse(rect, face, opts = {}) {
    const [x0, z0, x1, z1] = rect;
    const along = face === 's' || face === 'n';
    const w = along ? x1 - x0 : z1 - z0, d = along ? z1 - z0 : x1 - x0;
    const rotY = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[face];
    const { add, flush, sign } = frame(rotY, (x0 + x1) / 2, (z0 + z1) / 2);
    const floors = opts.floors ?? 2 + Math.floor(rnd() * 3);
    const wall = opts.wall || pick(WALLS), trim = pick(TRIM);
    const H = floors * FLOOR_H + .25, f = d / 2;
    const lite = opts.lite ?? ((x0 + x1) / 2 < LITE_X[0] || (x0 + x1) / 2 > LITE_X[1]);
    blockers.push([x0, z0, x1, z1]);
    add(box(w - .04, H, d), wall, 0, H / 2, 0);
    // ground floor: open shopfront (dark interior + goods shelves), half-raised shutter, awning, shop sign
    add(box(w - .5, 2.25, .06), '#4a3426', 0, 1.13, f + .005);
    add(box(w - .5, .5, .08), '#b9c0c6', 0, 2.05, f + .02);
    for (let k = 0; k < 2; k++) add(box(w - .9, .06, .3), '#8a6a4a', 0, .55 + k * .55, f - .1);
    if (!lite) for (let k = 0; k < Math.floor(w / .55); k++) add(box(.22, .28, .18), pick(['#e8673c', '#f2c230', '#5aab35', '#2f6fd6', '#ffffff', '#c2416f']), -w / 2 + .6 + k * .55, .78 + (k % 2) * .55, f - .08);
    const [a1, a2] = pick(AWNINGS);
    const n = Math.max(4, Math.round(w / .5)), sw = (w + .1) / n;
    for (let i = 0; i < n; i++) add(box(sw, .05, 1.15).translate(0, 0, .575).rotateX(.36), i % 2 ? a2 : a1, -w / 2 - .05 + sw * (i + .5), 2.62, f);
    if (opts.shop !== false) {
      add(box(w - .3, .72, .1), '#fff4e0', 0, 3.12, f + .05);
      sign(w - .44, .58, 0, 3.12, f + .105);
    }
    // upper floors: window/door, balcony slab, railing, plants, AC unit
    for (let fl = 1; fl < floors; fl++) {
      const y = fl * FLOOR_H;
      add(box(w * .56, 1.75, .06), pick(['#6aa3c8', '#7fb6d8', '#3f7f5f', '#8a5a35']), 0, y + 1.15, f + .005);
      add(box(w * .56 + .16, .1, .1), trim, 0, y + 2.08, f + .02);
      add(box(w - .1, .12, .75), '#d9d2c5', 0, y + .06, f + .37);
      add(box(w - .1, .05, .05), trim, 0, y + .62, f + .72);
      if (lite) add(box(w - .1, .45, .03), trim, 0, y + .35, f + .72);
      else for (let k = 0; k <= Math.floor((w - .2) / .3); k++) add(box(.035, .5, .035), trim, -w / 2 + .1 + k * .3, y + .37, f + .72);
      if (rnd() < .8) pots(add, w, y + .12, f + .45, lite ? 1 : 1 + Math.floor(rnd() * 3));
      if (rnd() < .5) add(box(.7, .45, .28), '#eef1f3', w / 2 - .6, y + 2.3, f + .15);
      if (!lite && rnd() < .35) { // laundry line
        add(box(w - .5, .02, .02), '#ffffff', 0, y + 1.9, f + .65);
        for (let k = 0; k < 3; k++) add(box(.35, .45, .02), pick(['#ff8fb8', '#ffffff', '#6aa3c8', '#ffe066']), -w / 4 + k * w / 4, y + 1.62, f + .65);
      }
    }
    if (opts.lanterns ?? (!lite && rnd() < .45)) for (const x of [-w / 3, w / 3]) lantern(add, x, 1.95, f + 1.2);
    // roof: parapet, sometimes a tiled front slope, stainless water tank
    add(box(w, .35, .12), trim, 0, H + .17, f - .06);
    if (rnd() < .3) add(box(w + .1, .1, 1.4).translate(0, 0, -.7).rotateX(.45), '#b5523a', 0, H + .2, f);
    if (opts.tank ?? rnd() < .6) {
      add(new THREE.CylinderGeometry(.42, .42, 1.1, 10).rotateZ(Math.PI / 2), '#cfd6dc', (rnd() - .5) * (w - 1.2), H + .65, -d / 4);
      add(box(.9, .2, .5), '#8a8f94', 0, H + .1, -d / 4);
    }
    flush();
  }

  // Lighter, taller blocks behind the street rows (skyline / depth). Simple boxes with window strips.
  function skyline(rect, face) {
    const [x0, z0, x1, z1] = rect;
    const along = face === 's' || face === 'n';
    const w = along ? x1 - x0 : z1 - z0, d = along ? z1 - z0 : x1 - x0;
    const rotY = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[face];
    const { add, flush } = frame(rotY, (x0 + x1) / 2, (z0 + z1) / 2);
    const floors = 4 + Math.floor(rnd() * 4), H = floors * FLOOR_H;
    add(box(w - .1, H, d), pick(['#e9e4da', '#dfe7ea', '#f1e2d0', '#e3e8d8', '#efe0e6']), 0, H / 2, 0);
    for (let fl = 1; fl < floors; fl++) add(box(w * .7, 1.1, .05), '#9cb8cc', 0, fl * FLOOR_H + 1.2, d / 2 + .01);
    flush();
  }

  // Fills [a, b] with houses of random width along x (north / south rows) or z (west / east rows).
  function row(a, b, place, minW = 3.4, maxW = 4.8) {
    let p = a;
    while (b - p > minW - .01) {
      let w = minW + rnd() * (maxW - minW);
      if (b - p - w < minW) w = b - p;
      place(p, p + w);
      p += w;
    }
  }

  // Like row(), but narrow spans (≥ 2.4 m) still get one slim house ("nhà siêu mỏng"); smaller ones stay empty.
  const fill = (a, b, place) => { if (b - a >= 2.4) row(a, b, place, Math.min(3.4, b - a)); };
  // Free sub-spans of [a, b] after cutting out the [x0, x1] intervals of `cuts`.
  function spans(a, b, cuts) {
    const out = [];
    let p = a;
    for (const [c0, c1] of [...cuts].sort((u, v) => u[0] - v[0])) {
      if (c0 > p) out.push([p, Math.min(c0, b)]);
      p = Math.max(p, c1);
      if (p >= b) break;
    }
    if (p < b) out.push([p, b]);
    return out;
  }

  // ---------- street rows ----------
  const NORTH_FRONT = LOT_Z0 - .4, SOUTH_FRONT = STREET[3] + 2.6, DEPTH = 7.2, STREET_FRONT = LOT_Z1 - .4;
  const S = PARCELS.S.rect;
  const CAFE_HOUSE = [S[0] - .2, NORTH_FRONT - DEPTH, S[2] + .2, NORTH_FRONT];
  // north row behind the lots: everything but the alley + café house and the venue lots (venues-scene.js)
  const northCuts = [[ALLEY[0] - .3, CAFE_HOUSE[2]], ...VENUE_RECTS.map(r => [r[0], r[2]])];
  for (const [a, b] of spans(STREET_X[0], STREET_X[1], northCuts)) fill(a, b, (p, q) => tubeHouse([p, NORTH_FRONT - DEPTH, q, NORTH_FRONT], 's'));
  // gaps between neighbouring shop lots (never the alley): one deep house fronting the sidewalk
  // (inset .8 m next to a café parcel so its player-built edge stays reachable; venue walls may touch it)
  for (let i = 0; i + 1 < SHOP_LOTS.length; i++) {
    const inset = VENUE_RECTS.includes(SHOP_LOTS[i]) && VENUE_RECTS.includes(SHOP_LOTS[i + 1]) ? .15 : .8;
    const a = SHOP_LOTS[i][2] + inset, b = SHOP_LOTS[i + 1][0] - inset;
    if (b - a < 2.2 || (a < ALLEY[2] && b > ALLEY[0])) continue;
    tubeHouse([a, NORTH_FRONT, b, STREET_FRONT], 's', { floors: 2 + Math.floor(rnd() * 2) });
  }
  // past the outer shops the street wall comes forward to the sidewalk and runs on into the fog
  fill(STREET_X[0], SHOPS_X0 - .4, (a, b) => tubeHouse([a, STREET_FRONT - DEPTH, b, STREET_FRONT], 's'));
  fill(SHOPS_X1 + .4, STREET_X[1], (a, b) => tubeHouse([a, STREET_FRONT - DEPTH, b, STREET_FRONT], 's'));
  row(STREET_X[0], ALLEY[0] - 1, (a, b) => tubeHouse([a, SOUTH_FRONT, b, SOUTH_FRONT + DEPTH], 'n', { floors: 1 + Math.floor(rnd() * 2) }));
  row(ALLEY[2] + 1, STREET_X[1], (a, b) => tubeHouse([a, SOUTH_FRONT, b, SOUTH_FRONT + DEPTH], 'n', { floors: 1 + Math.floor(rnd() * 2) }));
  const NB = NORTH_FRONT - DEPTH - 1.2, SB = SOUTH_FRONT + DEPTH + 1.2;
  row(STREET_X[0] - 8, ALLEY[0] - 1.5, (a, b) => skyline([a, NB - 9.6, b, NB], 's'), 5, 8);
  row(ALLEY[2] + 1.5, STREET_X[1] + 8, (a, b) => skyline([a, NB - 9.6, b, NB], 's'), 5, 8);
  row(STREET_X[0] - 8, ALLEY[0] - 3, (a, b) => skyline([a, SB, b, SB + 8.4], 'n'), 5, 8);
  row(ALLEY[2] + 3, STREET_X[1] + 8, (a, b) => skyline([a, SB, b, SB + 8.4], 'n'), 5, 8);

  // ---------- the café's own house (Godbean): 2 floors, brand awning, lantern string, open front ----------
  {
    const [x0, z0, x1, z1] = CAFE_HOUSE, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, f = z1;
    const { add, flush } = frame(0, 0, 0);
    blockers.push(CAFE_HOUSE);
    add(box(w, 6, d), '#fff1d6', cx, 3, cz);
    add(box(w - .6, 2.5, .06), '#6b4630', cx, 1.3, f + .005);                     // open front, warm interior
    for (let k = 0; k < 3; k++) add(box(w - 1.4, .07, .35), '#a8743f', cx, .7 + k * .55, f - .12);
    for (let k = 0; k < 14; k++) add(box(.2, .26, .2), pick(['#7a4a2a', '#c8643c', '#f4f1e6', '#5aab35']), x0 + 1 + k * .75, .9 + (k % 3) * .55, f - .1);
    const n = 16, sw = (w + .3) / n;
    for (let i = 0; i < n; i++) add(box(sw, .06, 1.4).translate(0, 0, .7).rotateX(.36), i % 2 ? '#fff4e0' : '#e8673c', x0 - .15 + sw * (i + .5), 2.95, f);
    add(box(w + .2, .14, .9), '#d9d2c5', cx, 3.25, f + .35);                       // balcony
    for (let k = 0; k <= 40; k++) add(box(.04, .55, .04), '#7a4a2a', x0 + .1 + k * (w - .2) / 40, 3.6, f + .78);
    add(box(w - .1, .06, .06), '#7a4a2a', cx, 3.9, f + .78);
    pots(add, w - 1, 3.32, f + .45, 6);
    for (const x of [cx - 3.6, cx, cx + 3.6]) add(box(1.7, 1.6, .06), '#7fb6d8', x, 4.4, f + .005);
    add(box(w + .2, .4, .2), '#a8743f', cx, 6.1, f - .05);
    add(new THREE.CylinderGeometry(.5, .5, 1.2, 10).rotateZ(Math.PI / 2), '#cfd6dc', cx + 3.5, 6.75, cz - 1);
    for (let i = 0; i < 7; i++) lantern(add, x0 + 1 + i * (w - 2) / 6, 2.05, f + 1.45, 1.1); // lantern string along the awning edge
    add(box(w - 1, .02, .02), '#3a2a1a', cx, 2.42, f + 1.45);
    flush();
  }

  // ---------- asphalt street + alley, curbs, lane dashes, zebra crossing ----------
  {
    const asphalt = [];
    const flat = (x0, z0, x1, z1, y) => asphalt.push(paint(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), '#62646b'));
    flat(STREET_X[0], STREET[1], STREET_X[1], STREET[3], .02);
    flat(ALLEY[0], ALLEY_Z[0], ALLEY[2], STREET[1], .021);
    flat(ALLEY[0], STREET[3], ALLEY[2], ALLEY_Z[1], .021);
    const { add, flush } = frame(0, 0, 0);
    const mid = (STREET[1] + STREET[3]) / 2;
    for (let x = STREET_X[0] + 1; x < STREET_X[1] - 1; x += 3) if (x + 1.6 < ALLEY[0] - .4 || x > ALLEY[2] + .4) add(box(1.6, .02, .12), '#f4f1e6', x + .8, .035, mid);
    for (let k = 0; k < 6; k++) add(box(ALLEY[2] - ALLEY[0] - .5, .02, .32), '#f4f1e6', (ALLEY[0] + ALLEY[2]) / 2, .036, STREET[1] + .35 + k * .5);
    const curb = (x0, z0, x1, z1) => add(box(Math.max(.16, x1 - x0), .14, Math.max(.16, z1 - z0)), '#b9b4aa', (x0 + x1) / 2, .07, (z0 + z1) / 2);
    curb(STREET_X[0], STREET[1] - .08, ALLEY[0], STREET[1] + .08); curb(ALLEY[2], STREET[1] - .08, STREET_X[1], STREET[1] + .08);
    curb(STREET_X[0], STREET[3] - .08, ALLEY[0], STREET[3] + .08); curb(ALLEY[2], STREET[3] - .08, STREET_X[1], STREET[3] + .08);
    for (const x of [ALLEY[0], ALLEY[2]]) { curb(x - .08, ALLEY_Z[0], x + .08, LOT_Z0 - .2); curb(x - .08, STREET[3], x + .08, ALLEY_Z[1]); }
    flush();
    const mesh = new THREE.Mesh(keep(mergeGeometries(asphalt)), keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 })));
    asphalt.forEach(g => g.dispose());
    mesh.receiveShadow = true; mesh.raycast = () => {}; mesh.renderOrder = -1;
    target.add(mesh);
  }

  // ---------- sidewalk furniture: trees, lamps, power poles + wires, scooters ----------
  {
    const { add, flush } = frame(0, 0, 0);
    const SOUTH_WALK = (STREET[3] + SOUTH_FRONT) / 2, NORTH_WALK = STREET[1] - .7;
    const solid = (x, z, h) => blockers.push([x - h, z - h, x + h, z + h]); // small props block walking (nav + player)
    const tree = (x, z, s = 1) => {
      solid(x, z, .3);
      add(box(1, .06, 1), '#6b5a48', x, .03, z);
      add(new THREE.CylinderGeometry(.13 * s, .18 * s, 2.4 * s, 6), '#7a5a3c', x, 1.2 * s, z);
      for (let k = 0; k < 3; k++) add(new THREE.IcosahedronGeometry((.9 + rnd() * .3) * s, 0), pick(['#4f9e3a', '#5fae46', '#3f8a35', '#6cbf4a']), x + (rnd() - .5) * .9 * s, (2.6 + rnd() * .6) * s, z + (rnd() - .5) * .9 * s);
    };
    for (const x of [-64, -57, -50, -41, -34, -27, -20, -13.5, -2.5, 4.5, 11.5, 17.5, 25, 32, 38, 49, 55, 65, 71]) tree(x, SOUTH_WALK - .2, .95 + rnd() * .2);
    for (const x of [-16.5, 19.5, -55, 68]) tree(x, NORTH_WALK - .6, .9); // north sidewalk, clear of the terrace + venue stools
    const lamp = (x, z, dir) => {
      solid(x, z, .15);
      add(new THREE.CylinderGeometry(.07, .1, 4.6, 6), '#5d6168', x, 2.3, z);
      add(box(.08, .08, 1.1), '#5d6168', x, 4.55, z + dir * .5);
      add(box(.34, .14, .5), '#5d6168', x, 4.5, z + dir * 1.05);
      add(box(.28, .05, .42), '#fff2b8', x, 4.42, z + dir * 1.05);
    };
    for (const x of [-62, -48, -37, -21.8, -4.8, 8, 20.2, 35, 52, 68]) lamp(x, STREET[3] + .45, -1);
    // north side: between the shops only (never over a venue's stools, VENUE_LOTS[*].seats)
    for (const x of [-43, -23.4, -12.5, TERRACE_X[1] + 2.2, 23.5, 42.5, 59.5]) lamp(x, STREET[1] - .35, 1);
    // Power poles along the south sidewalk with three wires and a sagging cable bundle.
    const poles = [-60, -45, -30, -16, -1, 14, 29, 44, 59, 74];
    for (const x of poles) {
      solid(x, SOUTH_WALK + .55, .2);
      add(new THREE.CylinderGeometry(.12, .18, 7, 4), '#a9a59c', x, 3.5, SOUTH_WALK + .55);
      add(box(1.5, .1, .1), '#8a867d', x, 6.6, SOUTH_WALK + .55);
      add(box(.3, .45, .25), '#5d6168', x, 5.2, SOUTH_WALK + .45);
    }
    for (let i = 0; i + 1 < poles.length; i++) {
      const a = poles[i], b = poles[i + 1], len = b - a;
      for (const dz of [-.6, 0, .6]) add(box(len, .025, .025), '#2a2a2e', (a + b) / 2, 6.68, SOUTH_WALK + .55 + dz);
      for (let k = 0; k < 6; k++) { // bundle sags in the middle
        const t0 = k / 6, t1 = (k + 1) / 6, sag = t => 5.9 - Math.sin(t * Math.PI) * .45;
        add(box(len / 6 + .05, .06, .06), '#1f1f22', a + len * (t0 + t1) / 2, (sag(t0) + sag(t1)) / 2, SOUTH_WALK + .55);
      }
    }
    const scooter = (x, z, rot, color) => {
      solid(x, z, .45);
      const s = frame(rot, x, z);
      for (const zz of [-.58, .6]) s.add(new THREE.CylinderGeometry(.24, .24, .1, 10).rotateZ(Math.PI / 2), '#26262a', 0, .24, zz);
      s.add(box(.3, .3, .95), color, 0, .42, -.05);
      s.add(box(.34, .12, .62), '#2a2a2e', 0, .66, -.2);
      s.add(box(.38, .66, .12), color, 0, .72, .48);
      s.add(box(.12, .12, .5), color, 0, .3, .25);
      s.add(box(.62, .05, .05), '#26262a', 0, 1.08, .55);
      s.add(box(.14, .1, .06), '#fff2b8', 0, .95, .56);
      s.add(box(.26, .16, .3), '#d9d2c5', 0, .42, -.62);
      s.flush();
    };
    const parked = [[-39, -.45], [-37.8, -.45], [-32.2, -.4], [-25.6, -.45], [-24.4, -.45], [-23.2, -.45], [-18.5, -.4], [-17.3, -.4], [1.2, -.45], [2.4, -.45], [12.7, -.4], [22.6, -.4], [23.8, -.4], [33.5, -.4], [34.7, -.4], [47, -.45], [61.5, -.4], [62.7, -.4]];
    for (const [x, rot] of parked) scooter(x, SOUTH_WALK + .2, Math.PI + rot, pick(SCOOTERS));
    for (const x of [-19.6, -18.4, -14.4, 13.4, 14.6, 16.6, -25.2, 26.4, 27.6, 64]) scooter(x, NORTH_WALK - .4, .4, pick(SCOOTERS));
    flush();
  }

  // ---------- a menu board on the sidewalk beside the terrace ----------
  {
    const { add, flush } = frame(0, 0, 0);
    const mx = TERRACE_X[1] + .9, mz = STREET[1] - .9;
    blockers.push([mx - .4, mz - .1, mx + .4, mz + .1]);
    add(box(.06, 1.1, .06), '#5e3f26', mx, .55, mz - .04);
    add(box(.7, .9, .06), '#3a3a36', mx, 1.05, mz);
    add(box(.6, .06, .07), '#f4f1e6', mx, 1.2, mz + .04);
    add(box(.5, .06, .07), '#f2c230', mx, 1.0, mz + .04);
    flush();
  }

  // ---------- merge ----------
  const mesh = new THREE.Mesh(keep(mergeGeometries(parts)), mats.props);
  parts.forEach(g => g.dispose());
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.raycast = () => {};
  mesh.name = 'city';
  target.add(mesh);
  const signs = new THREE.Mesh(keep(mergeGeometries(signParts)), keep(new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: .7, emissive: 0xffffff, emissiveMap: atlas.tex, emissiveIntensity: .25 })));
  signParts.forEach(g => g.dispose());
  signs.raycast = () => {};
  target.add(signs);

  return { blockers, cafeHouse: CAFE_HOUSE };
}
