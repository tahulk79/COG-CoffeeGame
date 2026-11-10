// Static-ish world from layout.js, split in two areas that are never on screen together (setView toggles them):
//  · farm (BOUNDS) — ground (country tint + large-scale vertex-color variation), soft-edged dirt roads
//    (only the OPEN roads; closed roads next to them show as a faint trail), the lots of layout v4. Farm World
//    2.0: owned land reads as ONE natural farm — meadow lots (old field / build lots) show the plain ground (fields draw
//    their own soil beds, no tilled rectangles, no field fences); special terrain keeps its scenery (pasture = fenced
//    meadow, pond = water, orchard = fruit trees, garden / hill = lawn). Not owned: overgrown with bushes / rocks /
//    tall grass + a for-sale sign. setLandMode: 'build' = faint 1 m grid over owned land, 'expand' = for-sale lots
//    tinted + every sign shown. Gate lanterns + flower pots and the World Gate on a cobblestone plaza.
//  · café (CAFE_BOUNDS, far south) — a small Vietnamese city street (city.js): tube houses, asphalt street + alley,
//    sidewalks, trees, lamps, scooters, the terrace seats; the café lots S / C2 / C3 (owned: terracotta floor, for
//    sale: vacant lot + sign).
// Each area gets its own instanced decor. Rebuilt only on store changes (sync), never per frame except the gate glow.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOUNDS, CAFE_BOUNDS, ROADS, ROAD_ORDER, PARCELS, GATE, RESERVED, rectCenter, inRect, areaOfParcel, rectsTouch, lotAllows, terrainOfLot, climateOfLot, estateOfLot, farmGroundY, hillLift, FARM_TIERS, TIER_EDGES, TIER_CUTS, WALL_FRONT, tierEdgeZ, WALL_T, RAMP, SPINE_HALF } from '../../core/config/layout.js';
import { COUNTRIES, parseRegionId } from '../../core/config/world.js';
import { region as regionOf, openRoads, frontierParcels, useOf, footprint } from '../../core/derive.js';
import { t, formatNumber } from '../../i18n/index.js';
import { makeLabel, mulberry32, normalizeModel, paint, valueNoise, tone, freezeStatic } from './util.js';
import { buildCity } from './city.js';
import { createBackdrop } from './backdrop.js';
import { createScenery } from './scenery.js';
import { createMapFence } from './map-fence.js';
import { createMountainDressing } from './mountain-dressing.js';
import { gardenStyleOf } from '../../core/config/economy.js';
import { loadPlant, createPlant, createPlantInstances } from '../../shared/three/gedeo-vegetation.js';
import { farmTex, farmMaterial, blendSoil } from '../../shared/three/farm-textures.js';
import { getQuality } from '../../shared/vfx/index.js';
import { disposeInstances } from '../../shared/three/dispose-scene.js';
import { createInstanceCull } from './instance-cull.js';

const ROAD_COLOR = 0xe6a462;
const WHITE = new THREE.Color(1, 1, 1); // warm orange-tan dirt
const ROAD_FADE_OUT = .35, ROAD_FADE_IN = .45; // soft road shoulders (m outside / inside the rect)
const PLAZA_R = GATE.radius + 1.4;
const SHOP_RECT = PARCELS.S.rect;
const PARCEL_IDS = { farm: Object.keys(PARCELS).filter(id => areaOfParcel(id) === 'farm'), cafe: Object.keys(PARCELS).filter(id => areaOfParcel(id) === 'cafe') };

function noiseTexture(base, spread, size = 128, dots = 6) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  const rnd = mulberry32(base);
  for (let i = 0; i < size * dots; i++) {
    const v = Math.round(255 - rnd() * spread);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
// Grass detail: short light/dark blade strokes on white (tinted by the material color).
function grassTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, size, size);
  const rnd = mulberry32(11);
  g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const v = Math.round(rnd() < .5 ? 205 + rnd() * 30 : 248 + rnd() * 7);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.lineWidth = 1 + rnd() * 1.2;
    const x = rnd() * size, y = rnd() * size, a = -Math.PI / 2 + (rnd() - .5) * .9, l = 2 + rnd() * 4;
    for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
// Café floor: 1 m terracotta tiles (4×4 per texture), slightly varied, with light grout. One texture repeat = 4 m.
function tileTexture() {
  const size = 256, n = 4, s = size / n;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#c47c55'; g.fillRect(0, 0, size, size); // grout slightly darker than the tiles (no bright grid)
  const rnd = mulberry32(5);
  const tones = ['#e0956a', '#d98b5f', '#e6a074', '#d4855a', '#e39a6c'];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = tones[Math.floor(rnd() * tones.length)];
    g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
    g.fillStyle = 'rgba(255,240,215,.16)'; g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, 4); // top highlight
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(110,55,30,${.05 + rnd() * .08})`; g.fillRect(x * s + 6 + rnd() * (s - 14), y * s + 6 + rnd() * (s - 14), 2, 2); }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(.5, .5); // overlay UVs are world meters / 2
  return tex;
}
// Café terrace: cream / sand flagstones in a running bond with soft grout. One texture repeat = 4 m.
function stoneTexture() {
  const size = 256, rows = 4, h = size / rows;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#c9b597'; g.fillRect(0, 0, size, size);
  const rnd = mulberry32(17);
  const tones = ['#efe2c8', '#e8d8ba', '#f3e8d2', '#e2d0ae', '#eadcc0'];
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? h * .75 : 0;
    for (let x = -1; x < 3; x++) {
      const x0 = x * h * 1.5 + off;
      g.fillStyle = tones[Math.floor(rnd() * tones.length)];
      for (const ox of [0, -size, size]) g.fillRect(x0 + ox + 2, y * h + 2, h * 1.5 - 4, h - 4);
    }
  }
  for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(120,95,60,${.04 + rnd() * .06})`; g.fillRect(rnd() * size, rnd() * size, 2, 2); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.repeat.set(.5, .5);
  return tex;
}
// ---- mountain tiers (layout farmGroundY): every ground-hugging sheet is a grid draped on the terrain ----
// Grid lines from a to b about `step` apart, plus the lines where the tier banks / spine ramps bend the ground (so a bank
// keeps its shape instead of smearing over a whole grid cell).
const TIER_Z = TIER_EDGES.flatMap(e => [e.z, e.zE].filter(v => v != null).flatMap(z => [z + 1.5, z + 1.15, z + .85, z + .55, z + .25, z, z - .2, z - 2.1, z - 4.2, z - RAMP * .5, z - RAMP]));
const TIER_X = [-.01, .01, ...TIER_CUTS.flatMap(c => [c.x - c.half - .5, c.x - c.half, c.x + c.half, c.x + c.half + .5])];
function gridLines(a, b, step, specials = []) {
  const n = Math.max(1, Math.round((b - a) / step)), out = [];
  for (let i = 0; i <= n; i++) out.push(a + (b - a) * i / n);
  for (const v of specials) if (v > a + .05 && v < b - .05) out.push(v);
  return [...new Set(out.map(v => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
}
/** Draped grid over rect: positions on the terrain + y, normals from the surface, UVs in world units / uvScale. */
function drapedGrid(rect, y, uvScale = 2, step = 2.5) {
  const xs = gridLines(rect[0], rect[2], step, TIER_X), zs = gridLines(rect[1], rect[3], step, TIER_Z);
  const nx = xs.length, pos = new Float32Array(nx * zs.length * 3), uv = new Float32Array(nx * zs.length * 2), idx = [];
  zs.forEach((z, j) => xs.forEach((x, i) => { const k = j * nx + i, h = farmGroundY(x, z); pos.set([x, h + y, z], k * 3); uv.set([(x - rect[0]) / uvScale, (rect[3] - z + h) / uvScale], k * 2); })); // v climbs with height: no stretch up the tier faces
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b2 = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b2, b2, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
// Ground-plane rectangle (lot overlays): draped on the tiers; UVs in world units / uvScale so shared repeat textures line up.
function rectGeometry(rect, y, uvScale = 2) {
  return drapedGrid(rect, y, uvScale, 2.5);
}
// Ground with large-scale brightness (lush / sunlit patches) and warm/cool hue variation baked in vertex colors.
// Worn red earth beside the tracks (real farm ground): 1 on the track edge, fading to grass ~1.4 m out (0.9 m for the
// footpaths, which are drawn 1.6 m wide). Rects match the drawn road widths (roadMeshGeometry).
// The side roads stop a little short of the map edge (founder 2026-11-08): east / west ends pulled back by SIDE_BACK m.
const SIDE_BACK = 3, SPINE_GAP = 2.4;
const NO_DRAW = new Set(['mainEW', 'mainEW_W', 'mainEW_E', 'gateRoad']); // the wide east-west road across the middle is not drawn (founder 2026-11-08)
const isMainRoad = id => /^(spine\d|gateRoad|mainEW)/.test(id);
// The rect a road is really DRAWN with: footpath lanes are 1.6 m wide, east / west ends stop short of the map edge, and a
// footpath stops SPINE_GAP m before the spine (it comes near, never touches or crosses it — founder 2026-11-08).
function drawnRect(id) {
  const q = ROADS[id].rect, alongX = q[2] - q[0] >= q[3] - q[1], main = isMainRoad(id);
  const atBank = !main && alongX && TIER_EDGES.some(e => e.z === q[1] || e.zE === q[1]); // a lane under a tier bank keeps to the side away from it
  const o = main ? [...q] : atBank ? [q[0], q[1] + WALL_FRONT + .1, q[2], q[3]] : alongX ? [q[0], (q[1] + q[3]) / 2 - .8, q[2], (q[1] + q[3]) / 2 + .8] : [(q[0] + q[2]) / 2 - .8, q[1], (q[0] + q[2]) / 2 + .8, q[3]];
  if (alongX) {
    if (o[0] <= -27.9) o[0] += SIDE_BACK;
    if (o[2] >= 27.9) o[2] -= SIDE_BACK;
    if (!main) { if (Math.abs(o[2] + 1.5) < .1) o[2] -= SPINE_GAP; if (Math.abs(o[0] - 1.5) < .1) o[0] += SPINE_GAP; }
  }
  return o;
}
// How much bare earth a spot of ground shows: the steep part of a tier bank (ragged, grass holds on in patches) and the two
// footpaths that climb the banks at x ±15.
const clamp01 = v => Math.max(0, Math.min(1, v));
function bankSoil(x, z) {
  const sz = Math.abs(farmGroundY(x, z + .3) - farmGroundY(x, z - .3)), sx = Math.abs(farmGroundY(x + .3, z) - farmGroundY(x - .3, z));
  const steep = clamp01((Math.max(sx, sz) / .6 - .8) / 1.4), patch = clamp01((valueNoise(x / 2.6, z / 2.6 + 11, 11) - .22) * 2.4);
  const path = TIER_CUTS.some(c => c.kind === 'steps' && Math.abs(x - c.x) < c.half + .55 && TIER_EDGES.some(e => z < tierEdgeZ(e, c.x) + WALL_FRONT && z > tierEdgeZ(e, c.x) - c.len - .1)); // (with the sides of the cutting)
  return Math.max(steep * (.3 + .6 * patch), path ? .9 : 0);
}
const VERGE_RECTS = Object.keys(ROADS).filter(id => !NO_DRAW.has(id)).map(id => ({ r: drawnRect(id), w: 1.0 }));
function vergeSoil(x, z) {
  let best = 0;
  for (const { r, w } of VERGE_RECTS) {
    const dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - z, 0, z - r[3]), d = Math.hypot(dx, dz);
    if (d < w) best = Math.max(best, 1 - d / w);
  }
  return best * .8;
}
function groundGeometry(rect, bounds = BOUNDS) {
  const geo = drapedGrid(rect, 0, 4, 1.25); // 1.25 m grid: the tiers, walls, ramps and the worn track verges (layout farmGroundY)
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3), soilW = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = pos.getY(i), alt = clamp01(h / FARM_TIERS.highland); // how far up the mountain this spot is
    uv.setXY(i, x / 4, (h - z) / 4); // v climbs with height: the banks are not stretched
    const n = valueNoise(x / 15, z / 15, 1) * .65 + valueNoise(x / 6, z / 6, 2) * .35;
    const warm = (valueNoise(x / 11 + 40, z / 11, 3) - .5) * 2;
    // Slightly deeper green outside the playable area (forest floor) so the map reads as a clearing.
    const out = Math.max(bounds.minX - x, x - bounds.maxX, bounds.minZ - z, z - bounds.maxZ, 0);
    const b = (.9 + n * .2) * (1 - Math.min(.14, out * .012));
    // Coffee country by altitude (coffee-varieties.md §3): the farm climbs north — lowland stays sunny green, the upland
    // shows red basalt soil through the grass (đất đỏ bazan), the highland is a deep cool green. Smooth bands in z.
    const band = (z0, z1) => Math.max(0, Math.min(1, (z0 - z) / (z0 - z1)));
    const up = band(1, -9) * (1 - band(-27, -37)), high = band(-27, -37);
    // upland: patches where the grass is thin and the red basalt shows (noise-shaped, strongest mid-band)
    const patch = Math.max(0, Math.min(1, (valueNoise(x / 4.5 + 9, z / 4.5, 5) - .38) * 3.2));
    const soil = up * (.35 + .65 * patch);
    // Realistic pass: textures carry the colour; vertex colours only shade (sunlit / lush patches, cooler highland),
    // and `soil` blends the red-earth texture in (upland patches, worn ground outside the farm, a little everywhere).
    const worn = Math.max(0, Math.min(1, (valueNoise(x / 7 + 3, z / 7, 7) - .62) * 2.5));
    soilW[i] = Math.min(1, Math.max(Math.min(.3, out * .015), vergeSoil(x, z), bankSoil(x, z))) + 0 * (soil + worn); // red earth: worn verges along the tracks (fields add their own ring, plots.js)
    colors[i * 3] = b * (1 + .04 * warm) * (1 - .05 * high) * (1 - .2 * alt); // the higher, the deeper and cooler the green
    colors[i * 3 + 1] = b * (1 + .01 * warm) * (1 - .06 * alt);
    colors[i * 3 + 2] = b * (1 - .06 * warm) * (1 - .02 * high) * (1 + .02 * alt);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('soil', new THREE.BufferAttribute(soilW, 1));
  return geo;
}
// Road rectangle with soft shoulders: alpha (RGBA vertex color) fades to 0 outside the long sides and at map-edge
// ends; inner ends (junctions) stay hard so crossings are seamless. UVs in world meters so all roads share the dirt.
// ends: optional { lo, hi } — fade the road's start / end along its length (dead ends); default: fade at map edges.
// Dead ends of a track break up into grains of dirt and grass instead of fading in a smooth gradient: the vertex
// attribute `endf` (0 at the end … 1 inside) is compared with a cheap hash noise in the fragment shader.
function speckleEnds(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float endf;\nvarying float vEndF;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEndF = endf;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vEndF;\nfloat h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\nfloat vnz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 g = gl_FragCoord.xy * 0.0; // (unused: the grain is in world space through the map uv)
        float n = vnz(vMapUv * 13.0) * 0.6 + vnz(vMapUv * 29.0 + 7.3) * 0.4; // smooth blobby grains, no square pixels
        diffuseColor.a *= smoothstep(0.0, 0.3, vEndF * 1.2 - n * (1.0 - vEndF) * 0.95);
      }`);
  };
  return material;
}
function roadGeometry(rect, y, bounds = BOUNDS, fadeEnds = false, ends = null) {
  const alongX = rect[2] - rect[0] >= rect[3] - rect[1];
  const atEdgeX = v => fadeEnds || v <= bounds.minX + .01 || v >= bounds.maxX - .01;
  const atEdgeZ = v => fadeEnds || v <= bounds.minZ + .01 || v >= bounds.maxZ - .01;
  const fade = { x0: !alongX || atEdgeX(rect[0]), x1: !alongX || atEdgeX(rect[2]), z0: alongX || atEdgeZ(rect[1]), z1: alongX || atEdgeZ(rect[3]) };
  if (ends) { if (alongX) { fade.x0 = ends.lo; fade.x1 = ends.hi; } else { fade.z0 = ends.lo; fade.z1 = ends.hi; } }
  // Four lines across each axis: outer edge (alpha 0 when faded), inner edge, inner edge, outer edge.
  const lines = (a, b, fa, fb) => [
    [a - (fa ? ROAD_FADE_OUT : 0), fa ? 0 : 1],
    [a + (fa ? ROAD_FADE_IN : 0), 1],
    [b - (fb ? ROAD_FADE_IN : 0), 1],
    [b + (fb ? ROAD_FADE_OUT : 0), fb ? 0 : 1],
  ];
  // the long axis gets a line every ~1 m (+ the wall / ramp lines) so the road follows the spine ramps up the tiers
  const fill = (ls, specials) => { const out = [ls[0], ls[1]]; for (const v of gridLines(ls[1][0], ls[2][0], 1, specials).slice(1, -1)) out.push([v, 1]); out.push(ls[2], ls[3]); return out; };
  let xs = lines(rect[0], rect[2], fade.x0, fade.x1), zs = lines(rect[1], rect[3], fade.z0, fade.z1);
  if (alongX) xs = fill(xs, TIER_X); else zs = fill(zs, TIER_Z);
  const nx = xs.length, pos = [], col = [], uv = [], idx = [], endf = [];
  const END_L = 3.2; // metres over which a dead end dissolves into the grass
  // natural track edges (founder 2026-11-08: "đường đi giống đời thật"): the edge lines wander ±0.45 m along the road
  // (independent per side, so the width breathes too); the long axis stays straight for navigation.
  const cross = alongX ? zs.length : xs.length;
  zs.forEach(([z, az], j) => xs.forEach(([x, ax], i) => {
    const ci = alongX ? j : i, t = alongX ? x : z;
    const edge = ci === 0 || ci === cross - 1 ? 1 : ci === 1 || ci === cross - 2 ? .7 : 0;
    // the wander is keyed by world position (side + the edge line's own coordinate), not by this segment: road segments that
    // abut (the three parts of the main road, the spine pieces) then share the same edge, so no seam shows at the joints
    const lo = ci <= 1, base = alongX ? (lo ? rect[1] : rect[3]) : (lo ? rect[0] : rect[2]);
    const wob = (valueNoise(t * .33 + (lo ? 7.3 : 14.6), base * .37 + (lo ? 3.1 : 6.2), 9) - .5) * .9 * edge;
    const px = alongX ? x : x + wob, pz = alongX ? z + wob : z;
    pos.push(px, farmGroundY(px, pz) + y, pz); uv.push(x / 3.5, -z / 3.5); col.push(1, 1, 1, Math.min(ax, az)); // UV from the un-wobbled grid: where two roads overlap their dirt textures line up exactly
    // 0 at a dead end → 1 a few metres in: the road dissolves into speckles there (the shader below), like a worn track
    const along = alongX ? x : z, a0 = alongX ? rect[0] : rect[1], a1 = alongX ? rect[2] : rect[3], f0 = alongX ? fade.x0 : fade.z0, f1 = alongX ? fade.x1 : fade.z1;
    endf.push(Math.min(f0 ? Math.max(0, Math.min(1, (along - a0) / END_L)) : 1, f1 ? Math.max(0, Math.min(1, (a1 - along) / END_L)) : 1));
  }));
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setAttribute('endf', new THREE.Float32BufferAttribute(endf, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
// Farm roads no longer cross a main north-south road (farm-map layout): each road is one segment.
function roadSegments(road) { return [road.rect]; }
export function parcelSignPoint(parcelId) {
  const c = rectCenter(PARCELS[parcelId].rect);
  return { x: c.x, z: c.z };
}

export function regionPalette(state) {
  const id = state.world.currentRegion || (state.world.startCountry ? `${state.world.startCountry}-1` : 'vn-1');
  return COUNTRIES[parseRegionId(id)?.countryId || 'vn'].palette;
}
// Owned parcels; before a region is entered the starter layout is shown.
export function ownedParcels(state) {
  return regionOf(state)?.parcels || Object.values(PARCELS).filter(p => p.starter).map(p => p.id);
}

// Free grass for scattered decor. Farm: not on roads, parcels or the gate plaza.
function isFreeGrass(x, z) {
  for (const id of ROAD_ORDER) if (inRect(x, z, ROADS[id].rect, .6)) return false;
  for (const p of Object.values(PARCELS)) if (inRect(x, z, p.rect, .8)) return false;
  return Math.hypot(x - GATE.x, z - GATE.z) >= PLAZA_R + 1.2;
}

/**
 * InstancedMesh with a static range plus groups that are switched on/off on sync (wild meadow per parcel, border
 * stones per road). Instance data is precomputed once; `show(keys)` rewrites only when the key set changes.
 */
function dynamicInstances(geometry, material, statics, groups) {
  const cap = statics.length + Object.values(groups).reduce((n, l) => n + l.length, 0);
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, cap));
  mesh.raycast = () => {};
  mesh.userData.cullable = true;
  let key = null;
  const mirrors = []; let last = [[], null, ''];
  // skip(it) → true leaves that instance out (e.g. an orchard tree under a field); skipKey = its signature.
  const write = (list, i, skip) => { for (const it of list) { if (skip && skip(it)) continue; mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, it.c); i++; } return i; };
  function show(keys, skip = null, skipKey = '') {
    last = [keys, skip, skipKey]; for (const m of mirrors) m.show(keys, skip, skipKey);
    const k = `${keys.join(',')}#${skipKey}`;
    if (k === key) return;
    key = k;
    let i = write(statics, 0);
    for (const id of keys) i = write(groups[id] || [], i, skip);
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.userData.cullDirty = true;
  }
  show([]);
  return { mesh, show, statics, groups, mirrors, get last() { return last; } };
}

/** Sets UVs of a flat (XZ) geometry to world meters / scale, so shared repeat textures line up across meshes. */
function worldUV(geo, scale = 2) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / scale, -pos.getZ(i) / scale);
  return geo;
}

export function createWorld({ scene, templates }) {
  const group = new THREE.Group();
  group.name = 'realm-world';
  scene.add(group);
  // The two areas of a region. Only the current view's group is visible (realm.setView → world.setView).
  const areas = { farm: new THREE.Group(), cafe: new THREE.Group() };
  areas.farm.name = 'realm-world-farm'; areas.cafe.name = 'realm-world-cafe';
  group.add(areas.farm, areas.cafe);
  const farm = areas.farm, cafe = areas.cafe;
  const backdrop = createBackdrop({ parent: farm });
  const scenery = createScenery({ parent: farm });
  const tierFence = createMapFence({ parent: farm }); // tall farm fence round the whole map + closed gates
  const disposables = [];
  const keep = x => (disposables.push(x), x);
  const labels = [];

  // ---------- materials (shared) ----------
  const grassTex = keep(grassTexture());
  const dirtTex = keep(noiseTexture(23, 60, 128, 8));
  const tileTex = keep(tileTexture());
  const stoneTex = keep(stoneTexture());
  const mats = {
    // Farm ground: realistic texture sets (public/assets/farm/env, farm-textures.js). Café keeps its city materials.
    ground: keep(blendSoil(farmMaterial('grass', { roughness: 1, vertexColors: true, normalScale: .9 }))),
    road: keep(speckleEnds(farmMaterial('road', { roughness: 1, vertexColors: true, transparent: true, depthWrite: false, normalScale: 1 }))),
    tilled: keep(farmMaterial('soil')),
    paved: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileTex, roughness: .85 })),
    pavement: keep(new THREE.MeshStandardMaterial({ color: 0xe2dccf, map: stoneTex, roughness: .92 })),
    vacant: keep(new THREE.MeshStandardMaterial({ color: 0xb59a74, map: dirtTex, roughness: 1 })),
    meadow: keep(farmMaterial('grass', { color: 0xf2f6ea })),
    pasture: keep(farmMaterial('grass', { color: 0xfff6dc })),
    gravel: keep(farmMaterial('road')),
    water: keep(new THREE.MeshStandardMaterial({ color: 0x3d5f5a, roughness: .08, metalness: .1 })),
    thicket: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, flatShading: true })),
    wood: keep(new THREE.MeshStandardMaterial({ color: 0xb07a43, roughness: .9 })),
    plaza: keep(farmMaterial('road', { color: 0xe8ddd0 })),
    tuft: keep(new THREE.MeshStandardMaterial({ color: 0x7cc04f, roughness: 1, vertexColors: true })),
    flower: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 })),
    rock: keep(farmMaterial('stone', { roughness: .9, normalScale: 1.2 })),
    props: keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85, vertexColors: true, flatShading: true })),
  };

  // ---------- ground: farm grass (country tint), café pavement (city sidewalks) ----------
  {
    const b = BOUNDS;
    // The play ground covers the farm + a 30 m apron; the Blender hill country (terrain-*.glb) starts under its edge.
    const ground = new THREE.Mesh(keep(groundGeometry([b.minX - 30, b.minZ - 30, b.maxX + 30, b.maxZ + 30], b)), mats.ground);
    ground.receiveShadow = true;
    ground.name = 'ground';
    farm.add(ground);
    const c = CAFE_BOUNDS;
    const pavement = new THREE.Mesh(keep(worldUV(rectGeometry([c.minX - 70, c.minZ - 40, c.maxX + 70, c.maxZ + 40], 0, 2))), mats.pavement);
    pavement.receiveShadow = true;
    pavement.name = 'cafe-ground';
    cafe.add(pavement);
  }

  let proceduralHills = null;
  // ---------- coffee hills around the farm (scenery only, outside BOUNDS): rows of coffee on the slopes, misty ----------
  // Low-poly mounds north and on both sides, higher to the north (the highland), each with dark-green row stripes so
  // the horizon reads as a coffee plantation, not a forest. One instanced draw call for the hills, one for the rows.
  {
    const rnd = mulberry32(404), b = BOUNDS;
    const hillGeo = keep(new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2));
    const hillTex = farmTex('grass').clone(); hillTex.repeat.set(14, 5); hillTex.needsUpdate = true;
    const hillMat = keep(new THREE.MeshStandardMaterial({ color: 0xc8d0b4, map: hillTex, roughness: 1 }));
    const rowGeo = keep(new THREE.TorusGeometry(1, .018, 4, 40, Math.PI).rotateX(-Math.PI / 2));
    const rowMat = keep(new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 1 }));
    const hills = [];
    // north (the highland's backdrop) and east (the camera looks north-east), close enough to show at full zoom-out
    for (let i = 0; i < 9; i++) hills.push({ x: b.minX - 16 + i * (b.maxX - b.minX + 32) / 8 + (rnd() - .5) * 6, z: b.minZ - 30 - rnd() * 14, r: 20 + rnd() * 10, h: 10 + rnd() * 8 });
    for (let i = 0; i < 6; i++) hills.push({ x: b.maxX + 20 + rnd() * 8, z: b.minZ + 4 + i * (b.maxZ - b.minZ) / 5.5, r: 14 + rnd() * 6, h: 6 + rnd() * 4 + 6 * (1 - i / 5) });
    for (let i = 0; i < 4; i++) hills.push({ x: b.minX - 22 - rnd() * 6, z: b.minZ + 2 + i * 16, r: 14 + rnd() * 6, h: 8 + rnd() * 6 });
    const hillMesh = keep(new THREE.InstancedMesh(hillGeo, hillMat, hills.length));
    const rows = [];
    hills.forEach(hl => { for (let k = 1; k <= 5; k++) rows.push({ ...hl, k }); });
    const rowMesh = keep(new THREE.InstancedMesh(rowGeo, rowMat, rows.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    hills.forEach((hl, i) => {
      hillMesh.setMatrixAt(i, m.compose(p.set(hl.x, -1, hl.z), q.identity(), s.set(hl.r, hl.h, hl.r * .8)));
      hillMesh.setColorAt(i, col.setHSL(.22 + rnd() * .05, .18, .62 + rnd() * .08, THREE.SRGBColorSpace));
    });
    // contour rows: the hill's ring at height fraction k/6, facing the farm (half torus turned toward +z)
    rows.forEach((rw, i) => {
      const f = rw.k / 6, rr = Math.cos(Math.asin(f)) * 1.002;
      const face = Math.atan2(0 - rw.x, 0 - rw.z) - Math.PI / 2;
      rowMesh.setMatrixAt(i, m.compose(p.set(rw.x, -1 + f * rw.h + .05, rw.z), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, face), s.set(rw.r * rr, 1, rw.r * .8 * rr)));
    });
    // the contour rows read as dark scratches at the phone's camera distance: only the hills are drawn
    rowMesh.count = 0;
    for (const mesh of [hillMesh]) { mesh.raycast = () => {}; mesh.receiveShadow = true; farm.add(mesh); }
    proceduralHills = hillMesh;
  }

  // ---------- shared small geometries ----------
  const geo = {
    bush: keep(new THREE.IcosahedronGeometry(.7, 0)),
    wildTrunk: keep(new THREE.CylinderGeometry(.13, .2, 2.6, 6).translate(0, 1.3, 0)),
    wildCrown: keep(new THREE.IcosahedronGeometry(1.15, 0).scale(1, 1.25, 1).translate(0, 3.1, 0)),
    stump: keep(new THREE.CylinderGeometry(.22, .27, .32, 7).translate(0, .16, 0)),
    rock: keep(new THREE.DodecahedronGeometry(.5, 0)),
    sign: keep(signGeometry()),
  };

  // ---------- gate plaza: sandy mortar disc + instanced cobblestones with a raised stone border ----------
  let plazaCobbles = null, dressing = null;
  const plaza = new THREE.Mesh(keep(new THREE.CircleGeometry(PLAZA_R + .25, 40).rotateX(-Math.PI / 2)), mats.plaza);
  plaza.position.set(GATE.x, .03, GATE.z);
  plaza.receiveShadow = true;
  farm.add(plaza);
  {
    const rnd = mulberry32(77);
    const cobbleGeo = keep(new THREE.CylinderGeometry(.21, .23, .09, 6).translate(0, .045, 0));
    const stones = [];
    for (let r = .4; r < PLAZA_R - .2; r += .44) {
      const n = Math.max(5, Math.floor(Math.PI * 2 * r / .44));
      const off = rnd() * 6;
      for (let i = 0; i < n; i++) stones.push({ r, a: off + i / n * Math.PI * 2, s: .82 + rnd() * .22, h: 1, c: rnd(), border: false });
    }
    const nb = Math.floor(Math.PI * 2 * PLAZA_R / .52);
    for (let i = 0; i < nb; i++) stones.push({ r: PLAZA_R, a: i / nb * Math.PI * 2, s: 1.25 + rnd() * .2, h: 2.4, c: rnd(), border: true });
    const mesh = plazaCobbles = keep(new THREE.InstancedMesh(cobbleGeo, keep(farmMaterial('road', { color: 0xf4ece2, roughness: .85, normalScale: 1.2 })), stones.length)); // pale laid stones
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    stones.forEach((it, i) => {
      p.set(GATE.x + Math.cos(it.a) * it.r, .02, GATE.z + Math.sin(it.a) * it.r);
      m.compose(p, q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.a + it.c), s.set(it.s, it.h, it.s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, it.border ? col.setHSL(.075, .22, .5 + it.c * .1, THREE.SRGBColorSpace) : col.setHSL(.075 + it.c * .03, .3 + it.c * .12, .66 + it.c * .1, THREE.SRGBColorSpace));
    });
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    farm.add(mesh);
  }

  // ---------- farm roads: open roads in full, closed roads next to them as a faint trail (rebuilt on sync) ----------
  const trailMat = keep(mats.road.clone()); trailMat.opacity = .38;
  const roadMesh = new THREE.Mesh(new THREE.BufferGeometry(), mats.road);
  const trailMesh = new THREE.Mesh(new THREE.BufferGeometry(), trailMat);
  for (const m of [roadMesh, trailMesh]) { m.receiveShadow = true; m.renderOrder = -1; m.raycast = () => {}; farm.add(m); } // ground decals first
  trailMesh.visible = false; // no faint 'future road' strips over land not bought yet
  // the farm access track: from the farmyard south across the stream bridge to the map edge (scenery, not a lot road)
  // (the access track south of the farm is not drawn any more, founder 2026-11-08)
  let roadKey = '';
  // A road end fades out unless another road of the same set continues from it (dead ends look soft, junctions hard).
  function roadMeshGeometry(ids, all) {
    ids = ids.filter(id => !NO_DRAW.has(id)); all = all.filter(id => !NO_DRAW.has(id));
    if (!ids.length) return new THREE.BufferGeometry();
    const parts = ids.map(id => {
      const r = drawnRect(id), alongX = r[2] - r[0] >= r[3] - r[1];
      const lo = alongX ? [r[0], r[1], r[0], r[3]] : [r[0], r[1], r[2], r[1]], hi = alongX ? [r[2], r[1], r[2], r[3]] : [r[0], r[3], r[2], r[3]];
      // a hard end only where another drawn road really continues from it (dead ends dissolve into speckles)
      const joined = edge => all.some(o => o !== id && rectsTouch(edge, drawnRect(o)));
      return roadGeometry(r, .02, BOUNDS, false, { lo: !joined(lo), hi: !joined(hi) });
    });
    const merged = mergeGeometries(parts);
    parts.forEach(g => g.dispose());
    return merged;
  }
  function rebuildRoads(open, trail) {
    const key = `${open.join(',')}|${trail.join(',')}`;
    if (key === roadKey) return;
    roadKey = key;
    roadMesh.geometry.dispose(); roadMesh.geometry = roadMeshGeometry(open, open);
    trailMesh.geometry.dispose(); trailMesh.geometry = roadMeshGeometry(trail, [...open, ...trail]);
  }

  // ---------- café city (street, houses, sidewalk furniture, terrace seats) ----------
  const city = buildCity(cafe, keep, mats);
  const CAFE_HOUSE = city.cafeHouse;

  // ---------- parcels (overlay + for-sale sign, in their own area) ----------
  const parcels = {};
  for (const p of Object.values(PARCELS)) {
    const target = areas[areaOfParcel(p.id)];
    const overlay = new THREE.Mesh(keep(rectGeometry(p.rect, .012, 4)), mats.meadow);
    overlay.receiveShadow = true;
    target.add(overlay);
    const c = parcelSignPoint(p.id);
    const sign = new THREE.Mesh(geo.sign, mats.props);
    sign.position.set(c.x, farmGroundY(c.x, c.z), c.z);
    sign.castShadow = true;
    sign.raycast = () => {};
    const label = makeLabel('', { bg: '#fff6e2', border: '#a8743f', height: .8 });
    label.sprite.position.y = 2.15;
    sign.add(label.sprite);
    target.add(sign);
    parcels[p.id] = { overlay, sign, label, state: null };
  }

  // ---------- fences (merged, rebuilt when farm ownership changes) ----------
  // Pasture fence: round eucalyptus posts and rails (weathered grey-brown, soil-grain normal)
  const fence = new THREE.Mesh(new THREE.BufferGeometry(), keep(farmMaterial('soil', { color: 0xb3a089, roughness: .9, normalScale: 1.5 })));
  fence.castShadow = true; fence.receiveShadow = true;
  farm.add(fence);
  let fenceKey = '';
  function rebuildFences(owned) {
    const farms = []; // founder 2026-11-08: bought land is plantable anywhere — no fenced pasture squares
    const key = farms.join(',');
    if (key === fenceKey) return;
    fenceKey = key;
    const parts = [];
    const post = new THREE.CylinderGeometry(.065, .08, .95, 7), rail = new THREE.CylinderGeometry(.035, .035, 1, 6).rotateZ(Math.PI / 2);
    const addPost = (x, z) => parts.push(post.clone().rotateZ((Math.sin(x * 7 + z) * .04)).translate(x, .45 + farmGroundY(x, z), z));
    const addRail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (const y of [.35, .72]) {
        const g = rail.clone().scale(len, 1, 1);
        if (z0 !== z1) g.rotateY(Math.PI / 2);
        parts.push(g.translate((x0 + x1) / 2, y + farmGroundY((x0 + x1) / 2, (z0 + z1) / 2), (z0 + z1) / 2));
      }
    };
    for (const id of farms) {
      const [x0, z0, x1, z1] = PARCELS[id].rect;
      const a = x0 + .3, b = x1 - .3, c = z0 + .3, d = z1 - .3; // inset: roads run flush against the lots now
      const mid = (c + d) / 2, gap = 1.3; // opening on the east side, facing the road
      const run = (xa, za, xb, zb) => {
        const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / 1.6));
        for (let i = 0; i <= n; i++) addPost(xa + (xb - xa) * i / n, za + (zb - za) * i / n);
        addRail(xa, za, xb, zb);
      };
      run(a, c, b, c); run(a, d, b, d); run(a, c, a, d);
      run(b, c, b, mid - gap); run(b, mid + gap, b, d);
    }
    post.dispose(); rail.dispose();
    fence.geometry.dispose();
    fence.geometry = parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry();
    parts.forEach(g => g.dispose());
  }

  // ---------- scattered grass tufts / flowers / pebbles + wild meadow per parcel + road border stones (per area) ----------
  const blades = [];
  for (let i = 0; i < 3; i++) blades.push(new THREE.ConeGeometry(.075, .5, 3, 1).translate(0, .25, 0).rotateZ((i - 1) * .42).rotateY(i * 2.1));
  const tuftGeo = keep(mergeGeometries(blades)); // three tapered blades, darker at the base (vertex color gradient)
  blades.forEach(g => g.dispose());
  {
    const pos = tuftGeo.attributes.position, colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const k = .62 + Math.min(1, pos.getY(i) / .5) * .5; colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = k; }
    tuftGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const flowerGeo = keep(new THREE.IcosahedronGeometry(.11, 0).scale(1, .6, 1));
  const FLOWER_COLORS = ['#ffffff', '#ffe066', '#ff9ec4', '#c9a6ff', '#ff8a5c', '#fff4c2'].map(h => new THREE.Color(h));

  /**
   * cfg: { seed, bounds, clumps, pebbles, isFree(x,z), parcelIds, roads: [{id, open, segs}], skipStone(x,z) }
   * Closed roads' border stones and unowned parcels' wild meadow are dynamic groups switched on in sync.
   */
  function scatter(target, cfg) {
    const rnd = mulberry32(cfg.seed);
    const up = THREE.Object3D.DEFAULT_UP;
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const item = (x, y, z, sx, sy, sz, rot, color) => ({ m: new THREE.Matrix4().compose(p.set(x, y + farmGroundY(x, z), z), q.setFromAxisAngle(up, rot), s.set(sx, sy, sz)), c: color });
    const tuftColor = () => new THREE.Color().setRGB(.85 + rnd() * .3, .9 + rnd() * .22, .8 + rnd() * .25);
    const wildColor = () => new THREE.Color().setRGB(1.05 + rnd() * .2, 1.02 + rnd() * .15, .72 + rnd() * .2);
    const tufts = [], flowers = [], rocks = [];
    const wildTufts = {}, wildFlowers = {}, borderStones = {}, thickets = {}, wildTrunks = {}, wildCrowns = {}, stumps = {};
    const b = cfg.bounds;
    const area = [b.minX - 8, b.minZ - 8, b.maxX + 8, b.maxZ + 8];
    const free = cfg.isFree;
    // Clumps on free grass (inside the area and a margin around it).
    for (let clumps = 0, tries = 0; clumps < cfg.clumps && tries < cfg.clumps * 22; tries++) {
      const cx = area[0] + rnd() * (area[2] - area[0]), cz = area[1] + rnd() * (area[3] - area[1]);
      if (!free(cx, cz)) continue;
      clumps++;
      const n = 2 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const x = cx + (rnd() - .5) * 1.6, z = cz + (rnd() - .5) * 1.6;
        if (!free(x, z)) continue;
        const k = .7 + rnd() * .6;
        tufts.push(item(x, 0, z, k, k * (.8 + rnd() * .5), k, rnd() * 6.28, tuftColor()));
      }
      if (rnd() < .55) {
        const nf = 1 + Math.floor(rnd() * 3), fc = FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)];
        for (let i = 0; i < nf; i++) {
          const x = cx + (rnd() - .5) * 1.4, z = cz + (rnd() - .5) * 1.4;
          if (!free(x, z)) continue;
          const k = .8 + rnd() * .5;
          flowers.push(item(x, .26 + rnd() * .14, z, k, k, k, rnd() * 6.28, fc));
        }
      }
    }
    for (let i = 0, tries = 0; i < cfg.pebbles && tries < cfg.pebbles * 27; tries++) {
      const x = area[0] + rnd() * (area[2] - area[0]), z = area[1] + rnd() * (area[3] - area[1]);
      if (!free(x, z)) continue;
      i++;
      const k = .18 + rnd() * .22;
      rocks.push(item(x, .03, z, k, k * .6, k * .9, rnd() * 6.28, new THREE.Color().setHSL(.08, .08, .62 + rnd() * .2, THREE.SRGBColorSpace)));
    }
    // Wild meadow on parcels that are not owned: taller, yellower tufts and a few flowers, clear of the sign.
    for (const id of cfg.parcelIds) {
      const [x0, z0, x1, z1] = PARCELS[id].rect;
      const sp = parcelSignPoint(id);
      const ok = (x, z) => Math.hypot(x - sp.x, z - sp.z) > 1.5;
      const tl = wildTufts[id] = [], fl = wildFlowers[id] = [];
      const n = Math.round((x1 - x0) * (z1 - z0) / 3.2);
      for (let i = 0; i < n; i++) {
        const x = x0 + .4 + rnd() * (x1 - x0 - .8), z = z0 + .4 + rnd() * (z1 - z0 - .8);
        if (!ok(x, z)) continue;
        const k = .9 + rnd() * .35;
        tl.push(item(x, 0, z, k, k * (1.2 + rnd() * .5), k, rnd() * 6.28, wildColor()));
      }
      for (let i = 0; i < 6; i++) {
        const x = x0 + .5 + rnd() * (x1 - x0 - 1), z = z0 + .5 + rnd() * (z1 - z0 - 1);
        if (!ok(x, z)) continue;
        fl.push(item(x, .45 + rnd() * .2, z, 1, 1, 1, rnd() * 6.28, FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)]));
      }
      // Overgrown land (farm lots not bought yet): thick bushes and a few rocks, clear of the sign.
      if (cfg.overgrow) {
        const bl = thickets[id] = [], rl = borderStones[id] = [];
        // Wild forest still to be cleared (khai hoang): a few tall trees and cut stumps among the scrub
        const tl2 = wildTrunks[id] = [], cl2 = wildCrowns[id] = [], sl = stumps[id] = [];
        // founder 2026-11-08: the land starts wild but tree-less — trees only come from planting (scrub, rocks, stumps stay)
        const nt = 0;
        for (let i = 0, tries = 0; i < nt && tries < 30; tries++) {
          const x = x0 + 1.2 + rnd() * (x1 - x0 - 2.4), z = z0 + 1.2 + rnd() * (z1 - z0 - 2.4);
          if (!ok(x, z) || Math.hypot(x - sp.x, z - sp.z) < 2.6) continue;
          const k = .8 + rnd() * .5, rot = rnd() * 6.28;
          tl2.push(item(x, 0, z, k, k * (1 + rnd() * .3), k, rot, new THREE.Color().setHSL(.07, .35, .3 + rnd() * .08, THREE.SRGBColorSpace)));
          cl2.push(item(x, 0, z, k, k * (1 + rnd() * .3), k, rot, new THREE.Color().setHSL(.27 + rnd() * .06, .42, .26 + rnd() * .1, THREE.SRGBColorSpace)));
          i++;
        }
        for (let i = 0; i < 3; i++) {
          const x = x0 + .8 + rnd() * (x1 - x0 - 1.6), z = z0 + .8 + rnd() * (z1 - z0 - 1.6);
          if (!ok(x, z)) continue;
          const k = .8 + rnd() * .5;
          sl.push(item(x, 0, z, k, k * (.7 + rnd() * .6), k, rnd() * 6.28, new THREE.Color().setHSL(.08, .3, .52 + rnd() * .1, THREE.SRGBColorSpace)));
        }
        const nb = Math.round((x1 - x0) * (z1 - z0) / 10);
        for (let i = 0; i < nb; i++) {
          const x = x0 + .6 + rnd() * (x1 - x0 - 1.2), z = z0 + .6 + rnd() * (z1 - z0 - 1.2);
          if (!ok(x, z)) continue;
          const k = .65 + rnd() * .75;
          bl.push(item(x, .28 * k, z, k * (1 + rnd() * .4), k * (.7 + rnd() * .4), k, rnd() * 6.28, new THREE.Color().setHSL(.23 + rnd() * .1, .55, .3 + rnd() * .12, THREE.SRGBColorSpace)));
        }
        for (let i = 0, nr = Math.round(nb / 4); i < nr; i++) {
          const x = x0 + .6 + rnd() * (x1 - x0 - 1.2), z = z0 + .6 + rnd() * (z1 - z0 - 1.2);
          if (!ok(x, z)) continue;
          const k = .5 + rnd() * .6;
          rl.push(item(x, .15 * k, z, k * 1.2, k * .7, k, rnd() * 6.28, new THREE.Color().setHSL(.08, .07, .55 + rnd() * .15, THREE.SRGBColorSpace)));
        }
      }
    }
    // Border stones along both long sides of every road segment (skipped at junctions and where cfg.skipStone says).
    for (const road of cfg.roads) {
      const list = road.open ? rocks : (borderStones[road.id] = []);
      for (const r of road.segs) {
        const alongX = r[2] - r[0] >= r[3] - r[1];
        const [a0, a1] = alongX ? [r[0], r[2]] : [r[1], r[3]];
        const sides = alongX ? [r[1] - .22, r[3] + .22] : [r[0] - .22, r[2] + .22];
        for (const side of sides) for (let v = a0 + .5; v < a1 - .3; v += 1.1 + rnd() * .8) {
          const off = (rnd() - .5) * .18;
          const x = alongX ? v : side + off, z = alongX ? side + off : v;
          if (cfg.roads.some(o => o !== road && o.segs.some(sr => inRect(x, z, sr, .5)))) continue;
          if (cfg.skipStone(x, z) || x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
          const k = .26 + rnd() * .16;
          list.push(item(x, .04, z, k, k * .7, k * .9, rnd() * 6.28, new THREE.Color().setHSL(.07, .1 + rnd() * .08, .66 + rnd() * .16, THREE.SRGBColorSpace)));
        }
      }
    }
    const out = {
      tufts: dynamicInstances(tuftGeo, mats.tuft, tufts, wildTufts),
      flowers: dynamicInstances(flowerGeo, mats.flower, flowers, wildFlowers),
      rocks: dynamicInstances(geo.rock, mats.rock, rocks, borderStones),
      thickets: dynamicInstances(geo.bush, mats.thicket, [], thickets),
      wildTrunks: dynamicInstances(geo.wildTrunk, mats.thicket, [], wildTrunks),
      wildCrowns: dynamicInstances(geo.wildCrown, mats.thicket, [], wildCrowns),
      stumps: dynamicInstances(geo.stump, mats.thicket, [], stumps),
    };
    for (const d of Object.values(out)) { d.mesh.receiveShadow = true; keep(d.mesh); target.add(d.mesh); }
    Object.defineProperty(out, 'wildItems', { value: wildTrunks });
    Object.defineProperty(out, 'thicketItems', { value: thickets }); // tree spots of the overgrown lots (the Gedeo forest reuses them); not enumerable
    return out;
  }
  const decor = {
    farm: scatter(farm, {
      seed: 2024, bounds: BOUNDS, clumps: 480, pebbles: 0, isFree: isFreeGrass, parcelIds: PARCEL_IDS.farm, overgrow: true,
      roads: [], skipStone: () => true, // founder 2026-11-10: no stones along the roads
    }),
    // Café: no grass on city pavement, only weeds on the vacant lots that are still for sale.
    cafe: scatter(cafe, {
      seed: 4048, bounds: CAFE_BOUNDS, clumps: 0, pebbles: 0, isFree: () => false, parcelIds: PARCEL_IDS.cafe,
      roads: [], skipStone: () => true,
    }),
  };

  let plazaProps = null;
  // ---------- merged static props (one draw per area) ----------
  const propMesh = (target, parts) => {
    const merged = keep(mergeGeometries(parts));
    parts.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, mats.props);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.raycast = () => {};
    target.add(mesh);
    return mesh;
  };
  const FLOWERS = ['#ff8fb8', '#ffe066', '#ffffff', '#ff7a59', '#c9a6ff'];
  const propKit = (parts, seed) => {
    const rnd = mulberry32(seed);
    const add = (g, color, x, y, z, ry = 0) => { if (ry) g.rotateY(ry); parts.push(paint(g.translate(x, y, z), color)); };
    const bloom = (x, y, z, spread, n) => { for (let i = 0; i < n; i++) add(new THREE.IcosahedronGeometry(.1 + rnd() * .04, 0), FLOWERS[Math.floor(rnd() * FLOWERS.length)], x + (rnd() - .5) * spread, y + rnd() * .12, z + (rnd() - .5) * spread); };
    const lantern = (x, z, h = 1.9) => {
      add(new THREE.BoxGeometry(.42, .22, .42), '#9a948a', x, .11, z);
      add(new THREE.BoxGeometry(.14, h, .14), '#5e3f26', x, .22 + h / 2, z);
      add(new THREE.BoxGeometry(.38, .42, .38), '#ffe9a6', x, h + .38, z);
      add(new THREE.BoxGeometry(.46, .06, .46), '#5e3f26', x, h + .17, z);
      add(new THREE.ConeGeometry(.36, .3, 4), '#5e3f26', x, h + .74, z, Math.PI / 4);
    };
    return { rnd, add, bloom, lantern };
  };
  // Farm: two gate lanterns north of the plaza and two flower pots south of it.
  {
    const parts = [];
    const { add, bloom, lantern } = propKit(parts, 31);
    for (const side of [-1, 1]) {
      lantern(GATE.x + side * (PLAZA_R + .5), GATE.z - 2.2);
      const px = GATE.x + side * (PLAZA_R + .6), pz = GATE.z + 1.6;
      add(new THREE.CylinderGeometry(.34, .25, .5, 8), '#c8643c', px, .25, pz);
      add(new THREE.CylinderGeometry(.37, .37, .08, 8), '#a94f2f', px, .5, pz);
      add(new THREE.IcosahedronGeometry(.36, 0).scale(1, .75, 1), '#5fae46', px, .72, pz);
      bloom(px, .92, pz, .45, 5);
    }
    plazaProps = propMesh(farm, parts);
  }
  // Café block S: low wooden curb (open on the west side where customers come in), boardwalk over the customer lanes,
  // planters between the block and the C2 lot.
  {
    const parts = [];
    const { add, bloom } = propKit(parts, 57);
    const [sx0, sz0, sx1, sz1] = SHOP_RECT;
    const cl = RESERVED.find(r => r.id === 'counterLane')?.rect, ql = RESERVED.find(r => r.id === 'queueLane')?.rect;
    const curb = (x0, z0, x1, z1) => add(new THREE.BoxGeometry(Math.max(.18, x1 - x0), .14, Math.max(.18, z1 - z0)), '#a8743f', (x0 + x1) / 2, .07, (z0 + z1) / 2);
    curb(sx1 + .1, sz0 - .1, sx1 + .1, sz1 + .1);
    curb(sx0 - .1, sz1 + .1, ql ? ql[0] : sx0, sz1 + .1);
    curb(ql ? ql[2] + .3 : sx0, sz1 + .1, sx1 + .1, sz1 + .1);
    curb(sx0 - .1, sz0 - .1, sx0 - .1, cl ? cl[1] : sz0 + 4);
    const lane = (x0, z0, x1, z1, alongX) => {
      const span = alongX ? z1 - z0 : x1 - x0, n = Math.floor(span / .36), pw = span / n;
      for (let i = 0; i < n; i++) {
        const c = (alongX ? z0 : x0) + pw * (i + .5), color = i % 2 ? '#c99b66' : '#bb8d5a';
        if (alongX) add(new THREE.BoxGeometry(x1 - x0, .04, pw - .05), color, (x0 + x1) / 2, .03, c);
        else add(new THREE.BoxGeometry(pw - .05, .04, z1 - z0), color, c, .03, (z0 + z1) / 2);
      }
    };
    if (cl) lane(Math.max(cl[0], sx0) + .15, cl[1] + .25, Math.min(cl[2], sx1) - .15, cl[3] - .1, true);
    if (cl && ql) lane(Math.max(ql[0], sx0) + .15, cl[3] - .1, ql[2] - .1, Math.min(ql[3], sz1) - .2, false);
    const planter = (x, z) => {
      add(new THREE.BoxGeometry(.9, .46, .9), '#b5794a', x, .23, z);
      add(new THREE.BoxGeometry(1, .1, 1), '#8a5a35', x, .5, z);
      add(new THREE.BoxGeometry(.78, .05, .78), '#6b4a2e', x, .53, z);
      add(new THREE.IcosahedronGeometry(.42, 0).scale(1, .8, 1), '#5fae46', x, .82, z);
      bloom(x, 1.02, z, .5, 4);
    };
    const C2 = PARCELS.C2.rect;
    for (const [x, z] of [[(sx1 + C2[0]) / 2, sz0 + 1], [(sx1 + C2[0]) / 2, (sz0 + sz1) / 2], [(sx1 + C2[0]) / 2, sz1 - .8]]) planter(x, z);
    propMesh(cafe, parts);
  }
  // Café sign over the door.
  {
    const sign = makeLabel(t('realm.cafeSign'), { bg: '#7a4a2a', fg: '#fff4e0', border: '#f2c27a', height: 1.1 });
    sign.sprite.position.set((CAFE_HOUSE[0] + CAFE_HOUSE[2]) / 2, 6.9, CAFE_HOUSE[3] + .2);
    cafe.add(sign.sprite);
    labels.push(sign);
  }

  // ---------- border scenery (instanced, per area) ----------
  const SRGB = THREE.SRGBColorSpace;
  const trunkGeo = keep(new THREE.CylinderGeometry(.16, .24, 1.2, 6).translate(0, .6, 0));
  const crownGeo = keep(new THREE.DodecahedronGeometry(1.1, 0).translate(0, 2.1, 0));
  const coneGeo = keep(new THREE.ConeGeometry(1, 2.6, 7).translate(0, 2.4, 0));
  const white = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true }));
  const trunkMat = keep(new THREE.MeshStandardMaterial({ color: 0x8a5a35, roughness: 1 }));
  function border(target, b, { seed, pockets, trees, bushes, rocks, margin }) {
    const rnd = mulberry32(seed);
    const inner = [b.minX - .5, b.minZ - .5, b.maxX + .5, b.maxZ + .5];
    const outer = [b.minX - margin[0], b.minZ - margin[1], b.maxX + margin[0], b.maxZ + margin[2]];
    const samples = (n, inPocket) => {
      const out = [];
      if (inPocket && !pockets.length) return out;
      for (let tries = 0; out.length < n && tries < n * 30; tries++) {
        let x, z;
        if (inPocket) {
          const r = pockets[Math.floor(rnd() * pockets.length)];
          x = r[0] + rnd() * (r[2] - r[0]); z = r[1] + rnd() * (r[3] - r[1]);
        } else {
          x = outer[0] + rnd() * (outer[2] - outer[0]); z = outer[1] + rnd() * (outer[3] - outer[1]);
          if (x > inner[0] && x < inner[2] && z > inner[1] && z < inner[3]) continue;
        }
        if (out.some(p => Math.hypot(p.x - x, p.z - z) < 2.2)) continue;
        out.push({ x, z, s: .7 + rnd() * .7, r: rnd() * 6, c: rnd() });
      }
      return out;
    };
    const treeList = [...samples(trees[0], false), ...samples(trees[1], true)];
    const bushList = [...samples(bushes[0], false), ...samples(bushes[1], true)];
    const rockList = samples(rocks, false);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const inst = (geometry, material, list, place, color) => {
      const mesh = keep(new THREE.InstancedMesh(geometry, material, Math.max(1, list.length)));
      mesh.count = list.length;
      list.forEach((it, i) => {
        place(it, p, s); p.y += farmGroundY(p.x, p.z); // on the mountain tier
        m.compose(p, q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.r), s);
        mesh.setMatrixAt(i, m);
        if (color) mesh.setColorAt(i, color(it, col));
      });
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.raycast = () => {};
      mesh.userData.cullable = true;
      target.add(mesh);
      return mesh;
    };
    const procTrees = [inst(trunkGeo, trunkMat, treeList, (it, pp, ss) => { pp.set(it.x, 0, it.z); ss.setScalar(it.s); })];
    const round = treeList.filter(it => it.c < .6), pine = treeList.filter(it => it.c >= .6);
    procTrees.push(inst(crownGeo, white, round, (it, pp, ss) => { pp.set(it.x, 0, it.z); ss.setScalar(it.s); }, (it, c) => c.setHSL(.25 + it.c * .08, .58, .42 + it.c * .1, SRGB)));
    procTrees.push(inst(coneGeo, white, pine, (it, pp, ss) => { pp.set(it.x, 0, it.z); ss.setScalar(it.s); }, (it, c) => c.setHSL(.34, .5, .3 + (it.c - .6) * .2, SRGB)));
    const bushMesh = inst(geo.bush, white, bushList, (it, pp, ss) => { pp.set(it.x, .3 * it.s, it.z); ss.set(it.s, it.s * .75, it.s); }, (it, c) => c.setHSL(.24 + it.c * .1, .6, .4 + it.c * .08, SRGB));
    const rockMesh = inst(geo.rock, white, rockList, (it, pp, ss) => { pp.set(it.x, .15, it.z); ss.set(it.s * 1.1, it.s * .66, it.s); }, (it, c) => c.setHSL(.08, .08, .6 + it.c * .15, SRGB));
    return { round, pine, procTrees, bushList, rockList, bushMesh, rockMesh };
  }
  // Farm: empty grass corners inside the map also get a few trees.
  const farmBorder = border(farm, BOUNDS, { seed: 42, margin: [22, 20, 22], trees: [300, 16], bushes: [150, 14], rocks: 80,
    pockets: [] }); // (no trees in the empty corners inside the map: the farm starts bare, founder 2026-11-08)

  // ---------- Gedeo garden-forest (Ethiopia & co.): the border forest and the overgrown lots use the real shade trees ----------
  // (Cordia / Albizia far LOD2, instanced). Loaded on the first garden-forest country; the low-poly trees stay the fallback.
  const gedeoForest = { on: false, group: new THREE.Group(), wild: null, loading: null, wildKeys: [] };
  gedeoForest.group.name = 'gedeo-forest'; gedeoForest.group.visible = false; farm.add(gedeoForest.group);
  function loadGedeoForest() {
    if (gedeoForest.loading) return gedeoForest.loading;
    // near sides (west / south, the camera's side) and the pockets inside the map stay low so they never hide the farm
    const near = it => it.x < BOUNDS.minX || it.z > BOUNDS.maxZ - 8;
    // Mobile: the border forest is far LOD3 without shadows; medium keeps every 2nd tree, low every 3rd (fog hides the gaps).
    const keepEvery = { high: 1, medium: 2, low: 3 }[getQuality()] || 1;
    const T = (list, k) => list.filter((it, i) => near(it) || i % keepEvery === 0).map(it => ({ position: new THREE.Vector3(it.x, farmGroundY(it.x, it.z), it.z), rotationY: it.r, scale: it.s * k * (near(it) ? .55 : 1) }));
    gedeoForest.loading = Promise.all([
      createPlantInstances('cordia', T(farmBorder.round, .42), { lod: 3, shadows: false }),
      createPlantInstances('albizia', T(farmBorder.pine, .36), { lod: 3, shadows: false }),
      loadPlant('cordia'), loadPlant('shrub'),
    ]).then(([a, b, t, sh]) => {
      for (const g of [a, b]) { g.traverse(o => { o.raycast = () => {}; }); gedeoForest.group.add(g); }
      const tpl = t[3]; tpl.updateMatrixWorld(true); // overgrown lots: far LOD3 (mobile), still casting shadows
      const S = new THREE.Matrix4().makeScale(.3, .3, .3), white = new THREE.Color(1, 1, 1), parts = [];
      tpl.traverse(o => { if (o.isMesh) parts.push(o); });
      gedeoForest.wild = parts.map(o => {
        const lists = Object.fromEntries(Object.entries(decor.farm.wildItems).map(([id, l]) => [id, l.map(it => ({ m: it.m.clone().multiply(S).multiply(o.matrixWorld), c: white }))]));
        const d = dynamicInstances(o.geometry, o.material, [], lists);
        d.mesh.castShadow = d.mesh.receiveShadow = true; gedeoForest.group.add(d.mesh);
        d.show(gedeoForest.wildKeys); return d;
      });
      // scrub on overgrown land: the Gedeo understory shrub, standing on the ground (the blob was lifted by .28 k)
      const shTpl = sh[0]; shTpl.updateMatrixWorld(true);
      const dp = new THREE.Vector3(), dq = new THREE.Quaternion(), ds = new THREE.Vector3(), shParts = [];
      shTpl.traverse(o => { if (o.isMesh) shParts.push(o); });
      for (const o of shParts) {
        const lists = Object.fromEntries(Object.entries(decor.farm.thicketItems).map(([id, l]) => [id, l.map(it => {
          it.m.decompose(dp, dq, ds); dp.y = farmGroundY(dp.x, dp.z);
          return { m: new THREE.Matrix4().compose(dp, dq, ds.setScalar(ds.x * .8)).multiply(o.matrixWorld), c: white };
        })]));
        const d = dynamicInstances(o.geometry, o.material, [], lists);
        d.mesh.castShadow = false; d.mesh.receiveShadow = true; gedeoForest.group.add(d.mesh);
        d.show(gedeoForest.wildKeys); gedeoForest.wild.push(d);
      }
      freezeStatic(gedeoForest.group);
    }).catch(e => console.warn('Gedeo forest not loaded, keeping the low-poly trees.', e));
    return gedeoForest.loading;
  }
  // ---------- realistic land pass: every procedural prop on the farm gets its Gedeo model ----------
  const MP = new THREE.Vector3(), MQ = new THREE.Quaternion(), MS = new THREE.Vector3();
  const onGround = k => m => { m.decompose(MP, MQ, MS); MP.y = farmGroundY(MP.x, MP.z); return m.compose(MP, MQ, MS.setScalar(MS.x * k)); };
  function mirrorGedeo(d, key, place, lod = 0, shadows = false) {
    return loadPlant(key).then(t => {
      const tpl = t[lod]; tpl.updateMatrixWorld(true);
      const parts = [], white = new THREE.Color(1, 1, 1);
      tpl.traverse(o => { if (o.isMesh) parts.push(o); });
      for (const o of parts) {
        const conv = l => l.map(it => ({ ...it, m: place(it.m.clone()).multiply(o.matrixWorld), c: white }));
        const md = dynamicInstances(o.geometry, o.material, conv(d.statics), Object.fromEntries(Object.entries(d.groups).map(([k, l]) => [k, conv(l)])));
        md.mesh.castShadow = shadows; md.mesh.receiveShadow = true; d.mesh.parent?.add(md.mesh);
        md.show(...d.last); d.mirrors.push(md);
      }
      d.mesh.visible = false;
    }).catch(e => console.warn(`Gedeo ${key} not loaded, keeping the stand-in.`, e));
  }
  let landLoading = null;
  function loadLand() {
    if (landLoading) return landLoading;
    const f = decor.farm, T = (list, k, y = 0) => list.map(it => ({ position: new THREE.Vector3(it.x, y + farmGroundY(it.x, it.z), it.z), rotationY: it.r, scale: it.s * k }));
    landLoading = Promise.all([
      mirrorGedeo(f.tufts, 'grass', onGround(1.1)),
      mirrorGedeo(f.flowers, 'daisyClump', onGround(.6)),
      mirrorGedeo(f.rocks, 'rock', onGround(.6)),
      mirrorGedeo(f.stumps, 'stump', onGround(.95)),
      mirrorGedeo(orchard.parts.trunks, 'cordia', onGround(.32), 2, true).then(() => { orchard.parts.crowns.mesh.visible = false; orchard.parts.fruits.mesh.visible = false; }),
      createPlantInstances('shrub', T(farmBorder.bushList, 1.1), { lod: 0, shadows: false }).then(g => { g.traverse(o => { o.raycast = () => {}; }); farm.add(g); farmBorder.bushMesh.visible = false; }),
      createPlantInstances('rock', T(farmBorder.rockList, .7), { lod: 0, shadows: false }).then(g => { g.traverse(o => { o.raycast = () => {}; }); farm.add(g); farmBorder.rockMesh.visible = false; }),
      // the pond lot (PD1): a natural stone-edged pond (Blender stone-pond.glb) instead of a blue rectangle
      createPlant('stonePond').then(o => { const r = PARCELS.PD1.rect, x = (r[0] + r[2]) / 2, z = (r[1] + r[3]) / 2; o.position.set(x, farmGroundY(x, z), z); o.scale.set(1.3, 1, 1.45); o.traverse(c => { c.raycast = () => {}; }); farm.add(o); }),
      // where the gate stood: only wild daisies now (no lamps, no planted enset — founder 2026-11-08)
      ...[-1, 1].map(side => createPlant('daisyClump').then(o => { o.position.set(GATE.x + side * (PLAZA_R + 1.3), 0, GATE.z + 1.1); farm.add(o); })),
      // gate plaza: Blender flagstones + border stones replace the disc and the cylinder cobbles
      // no gate on the map any more (founder 2026-11-08): no plaza either — the gate ground is plain land
      Promise.resolve().then(() => { plaza.visible = false; if (plazaCobbles) plazaCobbles.visible = false; }),
      loadHills(),
    ]).then(() => {
      if (plazaProps) plazaProps.visible = false;
      // the village / stream / people dressing is built DURING the loading screen too (founder 2026-11-08): when the farm
      // appears everything is already there, nothing streams in and hitches afterwards
      dressing ??= createMountainDressing({ parent: farm });
      return dressing.ready;
    }).then(() => freezeStatic(farm)); // the models above are in place now
    return landLoading;
  }
  // Slope forest: each Blender tree spot seeds a small clump (3 trees, jittered on the terrain grid's height), half the
  // spots albizia (odd = cordia). Trees per spot follow quality: high 2, medium 1, low none (bare hills; fog hides them in the play camera).
  function slopeTrees(meta, odd, k) {
    const per = { high: 2, medium: 1, low: 0 }[getQuality()] ?? 1, out = [];
    const hAt = (x, z) => {
      const i = Math.max(0, Math.min(meta.nx, Math.round((x - meta.x0) / meta.step))), j = Math.max(0, Math.min(meta.nz, Math.round((z - meta.z0) / meta.step)));
      return meta.heights[i]?.[j] ?? null; // heights[x index][z index]
    };
    meta.trees.forEach(([x, y, z, s], n) => {
      if (n % 2 !== odd) return;
      for (let c = 0; c < per; c++) {
        const a = n * 2.39 + c * 2.1, r = c ? 5 + (n * 7 + c * 3) % 6 : 0;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, py = c ? hAt(px, pz) ?? y : y;
        out.push({ position: new THREE.Vector3(px, py - .3 + hillLift(px, pz), pz), rotationY: a, scale: s * k * (c ? .75 : 1) });
      }
    });
    return out;
  }
  // The hills follow the tiers: every point of a chunk (the mesh sits at the world origin) goes up with the land next to it.
  function liftHills(mesh) {
    const g = mesh.geometry, p = g.attributes.position;
    if (g.userData.lifted) return;
    g.userData.lifted = true;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + hillLift(p.getX(i), p.getZ(i)));
    p.needsUpdate = true;
    g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  }
  // Hill country (gedeo_landscape.py): 4 terrain chunks round the farm + shade trees on the slopes from terrain-meta.json.
  // Replaces the sphere hills and the icosahedron mountain ring (kept as the fallback if a file is missing).
  function loadHills() {
    const base = `${import.meta.env.BASE_URL}models/gedeo/`;
    return fetch(`${base}terrain-meta.json`).then(r => r.json()).then(meta => Promise.all([
      ...meta.chunks.map(k => createPlant(`terrain${k[0].toUpperCase()}${k.slice(1)}`).then(o => { o.traverse(c => { c.raycast = () => {}; if (c.isMesh) { c.castShadow = false; c.receiveShadow = true; liftHills(c); } }); farm.add(o); })),
      createPlantInstances('albizia', slopeTrees(meta, 0, .95), { lod: 3, shadows: false }).then(g => farm.add(g)),
      createPlantInstances('cordia', slopeTrees(meta, 1, 1.05), { lod: 3, shadows: false }).then(g => farm.add(g)),
    ])).then(() => { if (proceduralHills) proceduralHills.visible = false; backdrop.group.visible = false; })
      .catch(e => console.warn('Hill country not loaded, keeping the procedural hills.', e));
  }

  function applyForest() {
    const on = gedeoForest.on && gedeoForest.group.children.length > 0;
    gedeoForest.group.visible = on;
    for (const m of farmBorder.procTrees) m.visible = !on;
    decor.farm.wildTrunks.mesh.visible = decor.farm.wildCrowns.mesh.visible = decor.farm.thickets.mesh.visible = !on;
  }

  // ---------- orchard trees (shown on owned orchard lots) ----------
  const orchard = (() => {
    const rnd = mulberry32(99);
    const trunks = {}, crowns = {}, fruits = {};
    // tx/tz: the tree the instance belongs to (a field or building over that tree hides the whole tree).
    let tx = 0, tz = 0;
    const m = (x, y, z, sx, sy, sz, color) => ({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, y + farmGroundY(x, z), z), new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6), new THREE.Vector3(sx, sy, sz)), c: color, tx, tz });
    for (const p of Object.values(PARCELS).filter(q => q.kind === 'orchard')) {
      const [x0, z0, x1, z1] = p.rect;
      const tl = trunks[p.id] = [], cl = crowns[p.id] = [], fl = fruits[p.id] = [];
      for (let x = x0 + 2; x <= x1 - 1.5; x += 3.2) for (let z = z0 + 2; z <= z1 - 1.5; z += 3.2) {
        const k = .8 + rnd() * .25;
        tx = x; tz = z;
        tl.push(m(x, 0, z, k, k, k, new THREE.Color(0xffffff)));
        cl.push(m(x, 0, z, k, k * .9, k, new THREE.Color().setHSL(.27 + rnd() * .05, .55, .36 + rnd() * .08, SRGB)));
        for (let i = 0; i < 5; i++) fl.push(m(x + (rnd() - .5) * 1.6 * k, 1.7 + rnd() * .9, z + (rnd() - .5) * 1.6 * k, 1.1, 1.1, 1.1, new THREE.Color(rnd() < .5 ? 0xe5533d : 0xffb43a)));
      }
    }
    const parts = { trunks: dynamicInstances(trunkGeo, trunkMat, [], trunks), crowns: dynamicInstances(crownGeo, white, [], crowns), fruits: dynamicInstances(flowerGeo, mats.flower, [], fruits) };
    for (const d of Object.values(parts)) { d.mesh.castShadow = true; d.mesh.receiveShadow = true; keep(d.mesh); farm.add(d.mesh); }
    // Orchard trees stay as scenery, but a field / building placed on an orchard lot takes their spot: trees whose
    // trunk is inside (or within a crown radius of) a footprint are left out.
    const CROWN = .9;
    return {
      parts,
      show(ids, state) {
        ids = []; // founder 2026-11-08: no ready-made orchard — trees only from planting (orchard lots are plain land)
        const r = ids.length && state ? regionOf(state) : null;
        const rects = [];
        if (r) {
          const lots = ids.map(id => PARCELS[id].rect), add = q => { if (lots.some(l => rectsTouch(l, q))) rects.push(q); };
          for (const f of r.fields || []) add(footprint('field', f.x, f.z));
          for (const b of r.buildings || []) add(footprint(b.type, b.x, b.z, b.rot || 0));
        }
        const hit = it => { for (const q of rects) if (it.tx > q[0] - CROWN && it.tx < q[2] + CROWN && it.tz > q[1] - CROWN && it.tz < q[3] + CROWN) return true; return false; };
        const sk = rects.map(q => q.join(':')).join(';');
        for (const d of Object.values(parts)) d.show(ids, rects.length ? hit : null, sk);
      },
    };
  })();

  // ---------- World Gate (farm) ----------
  // founder 2026-11-08: no gate on the map — the world map opens from the HUD 🌍 icon. Kept built (hidden) for the story
  // cinematics that may still reference it.
  const gate = new THREE.Group();
  gate.position.set(GATE.x, 0, GATE.z);
  gate.visible = false;
  farm.add(gate);
  {
    const frame = templates.gateFrame, left = templates.gateLeft, right = templates.gateRight;
    if (frame) {
      const parts = new THREE.Group();
      parts.add(frame.clone());
      if (left) parts.add(left.clone());
      if (right) parts.add(right.clone());
      const norm = normalizeModel(parts, GATE.radius * 2, 1.6, { fill: 1, maxScale: 1.2 });
      norm.position.y = .06; // stands on the cobbles
      gate.add(norm);
    }
    // Soft glow between the pillars.
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,248,214,1)'); grad.addColorStop(.5, 'rgba(255,226,150,.55)'); grad.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const tex = keep(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace;
    const glowMat = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const glow = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.6, 4.4)), glowMat);
    glow.position.y = 2.1;
    glow.raycast = () => {};
    gate.add(glow);
    gate.userData.glow = glow;
  }
  const gatePicker = new THREE.Mesh(keep(new THREE.BoxGeometry(GATE.radius * 2, 5.5, 2).translate(0, 2.75, 0)), keep(new THREE.MeshBasicMaterial()));
  gatePicker.visible = false;
  gatePicker.position.copy(gate.position);
  gatePicker.userData.target = { kind: 'gate' };
  gatePicker.raycast = () => {}; // not tappable: no gate on the map

  loadLand(); // after the orchard (its trunks get the Gedeo mirror)

  // ---------- sync from the save ----------
  let paletteKey = null;
  const activeWild = [];
  function sync(state) {
    const pal = regionPalette(state);
    if (paletteKey !== pal) {
      paletteKey = pal;
      // Country tint, pushed brighter / more saturated for a cheerful read under ACES tone mapping.
      tone(mats.ground.color, pal.ground, 0, .24, .02); mats.ground.color.lerp(WHITE, .78);
      tone(mats.tuft.color, pal.ground, .01, .3, .04);
      tone(mats.meadow.color, pal.ground, .015, .2, .12); mats.meadow.color.lerp(WHITE, .8);
      backdrop.sync(pal);
      const countryId = parseRegionId(state.world.currentRegion || '')?.countryId || 'vn';
      scenery.sync(countryId);
      gedeoForest.on = true; // realistic land everywhere (Gedeo shade trees, shrubs, rocks, grass); species by country later
      loadGedeoForest().then(applyForest);
      applyForest();
    }
    tierFence.sync(state);
    const owned = ownedParcels(state);
    activeWild.length = 0;
    // Farm: roads open with the land; a lot is owned, for sale (frontier: touches an open road → sign + price) or
    // wild (overgrown, no sign). Café lots: owned or for sale.
    const inRegion = !!regionOf(state);
    const open = inRegion ? openRoads(state) : ROAD_ORDER.filter(id => ROADS[id].open);
    const frontier = new Set(inRegion ? frontierParcels(state) : []);
    const trail = ROAD_ORDER.filter(id => !open.includes(id) && open.some(o => rectsTouch(ROADS[o].rect, ROADS[id].rect)));
    rebuildRoads(open, trail);
    // Owned land by terrain (Farm World 2.0): meadow = no overlay (the plain farm ground, one continuous farm).
    const OWNED_MAT = { meadow: null, garden: mats.pasture, hill: mats.pasture, pasture: mats.pasture, pond: null, orchard: mats.meadow, shop: mats.paved }; // pond: a natural Blender pond, not a blue square
    const wildFarm = [], orchards = [];
    for (const p of Object.values(PARCELS)) {
      const e = parcels[p.id];
      const farmLot = areaOfParcel(p.id) === 'farm';
      const st = owned.includes(p.id) ? 'owned' : !farmLot || frontier.has(p.id) ? 'sale' : 'wild';
      if (e.state !== st) {
        e.state = st;
        const terrain = terrainOfLot(p.id);
        // Farm game-feel pass: land not owned yet is plain grass (no pale squares = no grid-map look); only café lots keep the vacant overlay.
        const mat = st === 'owned' ? (Object.hasOwn(OWNED_MAT, terrain) ? OWNED_MAT[terrain] : mats.meadow) : farmLot ? null : mats.vacant;
        e.overlay.visible = !!mat;
        if (mat) e.overlay.material = mat;
        e.overlay.position.y = st === 'owned' && terrain === 'pond' ? .01 : 0;
        e.overlay.updateMatrix(); // frozen (freezeStatic)
      }
      e.sign.visible = signShown(p.id, st); // farm: price signs only in expand mode (the "+" badge near the farmer shows the next lot)
      if (st !== 'owned') { activeWild.push(p.id); if (farmLot) wildFarm.push(p.id); }
      const est = estateOfLot(p.id);
      if (st === 'sale' || (est && est.seed === p.id && st !== 'owned')) e.label.set(est ? t('estate.sign', { icon: est.icon, name: t(`estate.${est.id}`), price: formatNumber(est.cost) }) : t('realm.forSale', { price: formatNumber(p.cost) }));
      else if (est && est.seed === p.id) e.label.set(`${est.icon} ${t(`estate.${est.id}`)} ✅`); // an owned tier keeps its sign: tap it for the tier info
      if (st === 'owned' && p.kind === 'orchard') orchards.push(p.id);
    }
    for (const d of Object.values(decor)) { d.tufts.show(activeWild); d.flowers.show(activeWild); }
    decor.farm.thickets.show(wildFarm);
    decor.farm.wildTrunks.show(wildFarm); decor.farm.wildCrowns.show(wildFarm); decor.farm.stumps.show(wildFarm);
    gedeoForest.wildKeys = wildFarm; gedeoForest.wild?.forEach(d => d.show(wildFarm));
    decor.farm.rocks.show([...open, ...wildFarm]); // border stones of open roads + rocks on overgrown land
    orchard.show([], state); // (orchard lots grow no ready-made trees either: you plant them)
    rebuildFences(owned);
    dressing?.syncStart?.(state.world?.regions?.[state.world?.currentRegion]);
    lastState = state;
    if (land.mode) applyLand(state); // ownership changed while building / expanding: rebuilt only when the key changes
  }

  // ---------- land modes: 'build' = faint 1 m grid over owned land, 'expand' = for-sale lots tinted ----------
  // One draw call each, geometry rebuilt only when setLandMode / ownership changes (never per frame).
  const gridMat = keep(new THREE.LineBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: .3, depthWrite: false }));
  const saleMat = keep(new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: .3, depthWrite: false }));
  const gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), gridMat);
  const saleTint = new THREE.Mesh(new THREE.BufferGeometry(), saleMat);
  for (const m of [gridLines, saleTint]) { m.visible = false; m.raycast = () => {}; m.renderOrder = 1; m.frustumCulled = false; farm.add(m); }
  const land = { mode: null, type: null, key: '' };
  // Estates: one sign per estate (on its seed lot), always up — the whole next estate is the land for sale.
  // the farm's lot signs (the small light-wood price boards) are gone (founder 2026-11-08); café lots keep theirs while for sale
  const signShown = (id, st) => areaOfParcel(id) !== 'farm' && st === 'sale';
  let lastState = null;
  // Owned farm lots the grid covers: lots that allow `type`'s use, else lots that take fields or buildings.
  function gridLots(state, type) {
    const use = type ? useOf(type) : null;
    return ownedParcels(state).filter(id => PARCELS[id] && areaOfParcel(id) === 'farm' && (use ? lotAllows(id, use) : lotAllows(id, 'field') || lotAllows(id, 'building'))).sort();
  }
  const saleLots = state => PARCEL_IDS.farm.filter(id => parcels[id].state === 'sale' && !ownedParcels(state).includes(id));
  function applyLand(state) {
    const mode = land.mode;
    const ids = !state || !mode ? [] : mode === 'build' ? gridLots(state, land.type) : saleLots(state);
    const key = `${mode}|${land.type}|${ids.join(',')}`;
    if (key === land.key) return;
    land.key = key;
    gridLines.geometry.dispose(); gridLines.geometry = new THREE.BufferGeometry();
    saleTint.geometry.dispose(); saleTint.geometry = new THREE.BufferGeometry();
    gridLines.visible = saleTint.visible = false;
    if (!ids.length) return;
    if (mode === 'build') {
      const pts = [], y = .035;
      for (const id of ids) {
        const [x0, z0, x1, z1] = PARCELS[id].rect;
        for (let x = x0; x <= x1 + 1e-6; x += 1) pts.push(x, y, z0, x, y, z1);
        for (let z = z0; z <= z1 + 1e-6; z += 1) pts.push(x0, y, z, x1, y, z);
      }
      gridLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      gridLines.visible = true;
    } else {
      const parts = ids.map(id => { const r = PARCELS[id].rect; return rectGeometry([r[0] + .1, r[1] + .1, r[2] - .1, r[3] - .1], .05, 2); });
      saleTint.geometry = mergeGeometries(parts);
      parts.forEach(g => g.dispose());
      saleTint.visible = true;
    }
  }
  /** mode: null | 'build' | 'expand'; opts: { state, type } (type = the placeable being placed, optional). */
  function setLandMode(mode, { state, type } = {}) {
    land.mode = mode === 'build' || mode === 'expand' ? mode : null;
    land.type = land.mode === 'build' ? type || null : null;
    for (const id of Object.keys(parcels)) parcels[id].sign.visible = signShown(id, parcels[id].state);
    applyLand(state || lastState);
  }

  function update(time) {
    const glow = gate.userData.glow;
    if (glow && farm.visible) glow.material.opacity = .55 + .25 * Math.sin(time * 2);
  }

  freezeStatic(group); // only world-owned decor lives under this group; the café's half gets no later pass

  return {
    group, areas, mats, gate, gatePicker, cull: createInstanceCull(group), previewDressing: (x, z, r) => dressing?.previewStart?.(x, z, r), tierPickers: () => dressing?.pickers?.() || [], moveTierSign: (seed, x, z) => dressing?.moveSign?.(seed, x, z) || false, hideTierSign: (seed, b) => dressing?.hideSign?.(seed, b), sync, update,
    /** Static decor the player cannot walk through (the city's houses). */
    blockers: city.blockers,
    /** Shows only one area: 'farm' | 'cafe' (null → both, used while shaders compile). */
    setView(v) { farm.visible = !v || v === 'farm'; cafe.visible = !v || v === 'cafe'; },
    parcelState: id => parcels[id]?.state || null,
    setLandMode,
    /** Resolves when every model of the farm (land, forest, tier works, hills, scenery, dressing) is in the scene. */
    whenLoaded: () => Promise.all([landLoading, gedeoForest.loading, scenery.loading?.()].filter(Boolean)).catch(() => {}),
    dispose() {
      backdrop.dispose(); scenery.dispose(); tierFence.dispose();
      for (const e of Object.values(parcels)) e.label.dispose();
      for (const l of labels) l.dispose();
      fence.geometry.dispose(); roadMesh.geometry.dispose(); trailMesh.geometry.dispose();
      gridLines.geometry.dispose(); saleTint.geometry.dispose();
      for (const d of disposables) d.dispose?.();
      dressing?.dispose();
      disposeInstances(group); // the realm's final disposeScene no longer sees this group
      group.removeFromParent();
    },
  };
}

// For-sale sign: two posts, a framed light-wood board and a small red roof (vertex colors, one shared geometry).
function signGeometry() {
  const parts = [];
  const add = (g, color, x, y, z) => parts.push(paint(g.translate(x, y, z), color));
  for (const x of [-.62, .62]) add(new THREE.BoxGeometry(.13, 1.45, .13), '#6e4a2c', x, .72, 0);
  add(new THREE.BoxGeometry(1.62, .78, .08), '#7a5230', 0, 1.08, -.01);
  add(new THREE.BoxGeometry(1.48, .64, .1), '#e9c48d', 0, 1.08, 0);
  add(new THREE.BoxGeometry(1.8, .08, .34), '#c4523a', 0, 1.52, 0);
  const merged = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  return merged;
}
