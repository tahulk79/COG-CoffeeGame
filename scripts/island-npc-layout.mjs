// Picks the keepers' places on the chapter-2 island from the painted background, and draws a debug frame.
// Usage: node scripts/island-npc-layout.mjs [--write]      (needs ImageMagick `magick`)
//   1. every walkable cell is scored by how much of it (and of its 8 neighbours) is bare floor in the picture
//      (lanterns, trees, rails, stairs and carved ornaments score low);
//   2. each keeper has a region (where the story wants him); inside it the cell that keeps the biggest distance
//      from the others, the hero's start and the door keeper wins, as long as it is clear floor;
//   3. a debug SVG (scores as a heat map, chosen cells, the minimum-distance circles) is written next to the output.
// `--write` stores the result in src/data/config/trials.json.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MAP = JSON.parse(readFileSync(`${ROOT}src/data/maps/afterlife.json`, 'utf8'));
const TRIALS_PATH = `${ROOT}src/data/config/trials.json`;
const TRIALS = JSON.parse(readFileSync(TRIALS_PATH, 'utf8'));
const IMG = `${ROOT}art-src/slice/chapter2/reference-ui/island-scene-v1.png`;
const W = 1774, H = 887;

// island picture <-> world (same maths as src/data/islandLayout.ts and utils/iso.ts)
const worldToImage = (x, y) => [((x - y) * 64 + 1774) / 2, ((x + y) * 32 - 320) / 2];

const dir = mkdtempSync(join(tmpdir(), 'island-'));
execFileSync('magick', [IMG, '-depth', '8', `rgb:${dir}/island.rgb`]);
const px = readFileSync(`${dir}/island.rgb`);
const pixel = (x, y) => { const i = (Math.max(0, Math.min(H - 1, Math.round(y))) * W + Math.max(0, Math.min(W - 1, Math.round(x)))) * 3; return [px[i], px[i + 1], px[i + 2]]; };

// Palette of "bare floor": colours sampled at spots known to be open paving (start plaza, right plaza, arch landing, top lane).
const refs = [[18.5, 19.5], [33.5, 17.5], [14.5, 22.3], [14.5, 9], [34.5, 18.5], [19.5, 15.5]].map(([x, y]) => pixel(...worldToImage(x, y)));
const isFloor = (c) => refs.some((r) => Math.hypot(c[0] - r[0], c[1] - r[1], c[2] - r[2]) < 34);
const walk = (x, y) => MAP.terrain[y]?.[x] === '.';

/** Share of bare floor inside the cell's diamond. */
function cellScore(x, y) {
  const [cx, cy] = worldToImage(x + 0.5, y + 0.5);
  let n = 0, t = 0;
  for (let dy = -12; dy <= 12; dy += 3) for (let dx = -24; dx <= 24; dx += 4) {
    if (Math.abs(dx) / 24 + Math.abs(dy) / 12 > 1) continue;
    t++;
    if (isFloor(pixel(cx + dx, cy + dy))) n++;
  }
  return n / t;
}

const score = new Map(), clear = new Map();
for (let y = 0; y < MAP.terrain.length; y++) for (let x = 0; x < MAP.terrain[y].length; x++) if (walk(x, y)) score.set(`${x},${y}`, cellScore(x, y));
for (const key of score.keys()) {
  const [x, y] = key.split(',').map(Number);
  let sum = 0, n = 0, min = 1, edge = false;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (!walk(x + a, y + b)) { edge = true; continue; }
    const s = score.get(`${x + a},${y + b}`) ?? cellScore(x + a, y + b);
    sum += s; n++; min = Math.min(min, s);
  }
  clear.set(key, { mean: sum / n, min, edge });
}

// Where each keeper belongs (cell boxes), in story order. `gate` and `start` are fixed.
const REGIONS = {
  st1: { x: [17, 24], y: [14, 21] },   // the plaza, first thing the hero meets
  st2: { x: [30, 37], y: [15, 20] },   // the right plaza, down the stairs
  st3: { x: [14, 22], y: [14, 21] },   // the plaza again, away from st1
  st4: { x: [13, 17], y: [20, 23] },   // the landing in front of the arch
  st5: { x: [13, 16], y: [10, 14] },   // the upper lane, before the door keeper
};
const FIXED = { start: [18.5, 19.5], gate: [TRIALS.gate.x, TRIALS.gate.y] };
const MIN_CLEAR = 0.8;       // average floor share of the cell and its neighbours
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const candidates = {};
for (const [id, r] of Object.entries(REGIONS)) {
  candidates[id] = [...score.keys()].map((k) => k.split(',').map(Number)).filter(([x, y]) => x >= r.x[0] && x <= r.x[1] && y >= r.y[0] && y <= r.y[1])
    .map(([x, y]) => ({ at: [x + 0.5, y + 0.5], c: clear.get(`${x},${y}`) }))
    .filter(({ c }) => !c.edge && c.mean >= MIN_CLEAR && c.min >= 0.4);
  if (!candidates[id].length) {
    // the region has no clean floor (e.g. the carved right plaza): take its best cells instead
    candidates[id] = [...score.keys()].map((k) => k.split(',').map(Number)).filter(([x, y]) => x >= r.x[0] && x <= r.x[1] && y >= r.y[0] && y <= r.y[1])
      .map(([x, y]) => ({ at: [x + 0.5, y + 0.5], c: clear.get(`${x},${y}`) })).filter(({ c }) => !c.edge)
      .sort((a, b) => b.c.mean - a.c.mean).slice(0, 12);
  }
}

// The hero walks start -> st1 -> ... -> st5 -> gate; nobody may stand on a leg that is not his own.
const ORDER = ['start', 'st1', 'st2', 'st3', 'st4', 'st5', 'gate'];
const MIN_GAP = 4.0;         // tiles between two keepers (and the hero's start), when the island has the room
const ROUTE_ROOM = 1.8;      // tiles between a keeper and a leg he is not part of
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** Shortest walk between two points over walkable cells (8-way Dijkstra); returns the cell centres on the way. */
function route(a, b) {
  const key = (x, y) => `${x},${y}`, start = [Math.floor(a[0]), Math.floor(a[1])], goal = [Math.floor(b[0]), Math.floor(b[1])];
  const best = new Map([[key(...start), 0]]), prev = new Map(), todo = [[0, start]];
  while (todo.length) {
    todo.sort((p, q) => p[0] - q[0]);
    const [d, [x, y]] = todo.shift();
    if (x === goal[0] && y === goal[1]) break;
    if (d > (best.get(key(x, y)) ?? Infinity)) continue;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy;
      if (!walk(nx, ny) || (dx && dy && (!walk(x + dx, y) || !walk(x, y + dy)))) continue;
      const nd = d + Math.hypot(dx, dy);
      if (nd < (best.get(key(nx, ny)) ?? Infinity)) { best.set(key(nx, ny), nd); prev.set(key(nx, ny), [x, y]); todo.push([nd, [nx, ny]]); }
    }
  }
  const cells = [];
  for (let c = goal; c; c = prev.get(key(...c))) cells.push([c[0] + 0.5, c[1] + 0.5]);
  return cells;
}
const place = (id) => (id === 'start' || id === 'gate' ? FIXED[id] : pick[id]);
/** Distance from `at` to the walking legs that do not touch keeper `id`. */
function routeGap(id, at) {
  let gap = Infinity;
  for (let i = 0; i + 1 < ORDER.length; i++) {
    if (ORDER[i] === id || ORDER[i + 1] === id) continue;
    for (const cell of route(place(ORDER[i]), place(ORDER[i + 1]))) gap = Math.min(gap, dist(at, cell));
  }
  return gap;
}

// Coordinate ascent: move one keeper at a time to the candidate that maximises the smallest distance to everybody else.
const ids = Object.keys(REGIONS);
const pick = Object.fromEntries(ids.map((id) => [id, candidates[id][0]?.at]));
const others = (id) => [...ids.filter((o) => o !== id).map((o) => pick[o]), FIXED.start, FIXED.gate];
for (let round = 0; round < 8; round++) {
  for (const id of ids) {
    let best = null, bestValue = -Infinity;
    const roomy = candidates[id].filter((cand) => Math.min(...others(id).map((o) => dist(cand.at, o))) >= MIN_GAP && routeGap(id, cand.at) >= ROUTE_ROOM);
    for (const cand of roomy.length ? roomy : candidates[id]) {
      const gap = Math.min(...others(id).map((o) => dist(cand.at, o)));
      const onRoute = routeGap(id, cand.at) < ROUTE_ROOM;
      const value = Math.min(gap, 7) + cand.c.mean * 2 + cand.c.min - (onRoute ? 20 : 0);      // off every other leg, then spread, then clean floor
      if (value > bestValue) { bestValue = value; best = cand; }
    }
    pick[id] = best.at;
  }
}

const rows = ids.map((id) => ({ id, x: pick[id][0], y: pick[id][1], routeGap: routeGap(id, pick[id]), nearest: Math.min(...others(id).map((o) => dist(pick[id], o))), clear: clear.get(`${Math.floor(pick[id][0])},${Math.floor(pick[id][1])}`).mean }));
console.log('keeper  x     y     nearest  off-route  floor');
for (const r of rows) console.log(`${r.id.padEnd(6)} ${r.x.toFixed(1).padStart(5)} ${r.y.toFixed(1).padStart(5)} ${r.nearest.toFixed(1).padStart(7)} ${r.routeGap.toFixed(1).padStart(9)} ${(r.clear * 100).toFixed(0).padStart(6)}%`);

// Debug frame: heat map of the floor score, the walkable grid, the chosen cells and 2.5-tile "elbow room" circles.
const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><image href="file://${IMG}" width="${W}" height="${H}"/>`];
for (const [key, s] of score) {
  const [x, y] = key.split(',').map(Number);
  const pts = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, b]) => worldToImage(a, b).map((v) => v.toFixed(0)).join(',')).join(' ');
  const c = clear.get(key), good = !c.edge && c.mean >= MIN_CLEAR && c.min >= 0.4;
  out.push(`<polygon points="${pts}" fill="${good ? '#38d26b' : s > 0.5 ? '#f2c94c' : '#e5533d'}" fill-opacity="0.28" stroke="#fff" stroke-opacity="0.35" stroke-width="0.8"/>`);
}
const marks = [...rows.map((r) => [r.id, r.x, r.y, '#00e0ff']), ['gate', ...FIXED.gate, '#ff7bd5'], ['start', ...FIXED.start, '#ffffff']];
for (const [name, x, y, color] of marks) {
  const [ix, iy] = worldToImage(x, y);
  out.push(`<ellipse cx="${ix.toFixed(0)}" cy="${iy.toFixed(0)}" rx="${(2.5 * 32).toFixed(0)}" ry="${(2.5 * 16).toFixed(0)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6 4"/>`);
  out.push(`<circle cx="${ix.toFixed(0)}" cy="${iy.toFixed(0)}" r="7" fill="${color}" stroke="#000" stroke-width="2"/><text x="${(ix + 10).toFixed(0)}" y="${(iy - 8).toFixed(0)}" font-size="22" font-weight="bold" fill="${color}" stroke="#000" stroke-width="4" paint-order="stroke">${name}</text>`);
}
out.push('</svg>');
const debugPath = `${ROOT}docs/art/chapter2/island-npc-layout-debug.svg`;
writeFileSync(debugPath, out.join('\n'));
console.log(`debug frame: ${debugPath} (green = clear floor, yellow = busy, red = blocked by props; dashed ellipse = 2.5 tiles of elbow room)`);

if (process.argv.includes('--write')) {
  for (const r of rows) {
    const st = TRIALS.stations.find((s) => s.id === r.id);
    st.x = +r.x.toFixed(2); st.y = +r.y.toFixed(2);
  }
  writeFileSync(TRIALS_PATH, JSON.stringify(TRIALS, null, 2) + '\n');
  console.log('trials.json updated');
}
