// Dev-only performance profiler (docs/performance/PERFORMANCE-TEST-PLAN.md). Nothing imports this file, so it is not in the
// production bundle and the game's code is untouched: it hooks three's prototypes and browser APIs from the outside.
//
// Load it on the dev server, in the DevTools console:   const p = (await import('/src/dev/perf-profiler.js')).default;
//   p.start('camera idle');  ...play...;  console.table(p.stop());    // or await p.run('camera idle', 20000)
//   p.census()  scene graph + resource counts     p.gpuAvailable()  whether real GPU timing exists on this machine
//   await p.ab('shadows off', () => { r.shadowMap.autoUpdate = false; }, () => { r.shadowMap.autoUpdate = true; })  alternating A/B, medians
// Measured: frame intervals, rAF callback time, update vs render submit time, renderer.info, long tasks, JS heap, mixer /
// raycast / matrix / localStorage / store.dispatch time. GPU ms comes from EXT_disjoint_timer_query_webgl2 and is null when
// the extension is missing. GPU memory is an ESTIMATE from texture and buffer sizes: browsers do not expose the real value.
import * as THREE from 'three';

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);
const avg = list => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0);
const round = (v, d = 2) => (v == null || Number.isNaN(v) ? null : +v.toFixed(d));

const hooks = { mixerMs: 0, mixerCalls: 0, skeletonCalls: 0, rayMs: 0, rayCalls: 0, matrixMs: 0, saveMs: 0, saveCalls: 0, saveBytes: 0, dispatchMs: 0, dispatchCalls: 0, mutations: 0, shadowPasses: 0, shadowMs: 0, uploadBytes: 0 };
let session = null, renderer = null, gl = null, timerExt = null;
const queries = { pool: [], pending: [], active: null, results: [] };
let frame = null; // the rAF callback in progress
let installed = false;
const longTaskSupported = !!window.PerformanceObserver?.supportedEntryTypes?.includes('longtask');

function installOnce() {
  if (installed) return; installed = true;

  // three's WebGLAnimation calls self.requestAnimationFrame on every tick, so wrapping it sees the game loop without touching it.
  const nativeRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => nativeRaf(now => {
    const outer = frame === null;
    if (outer) frame = { start: performance.now(), now, renders: 0, updateMs: 0, renderMs: 0, calls: 0, tris: 0, beforeAt: 0 };
    try { callback(now); } finally { if (outer) { endFrame(frame); frame = null; } }
  });

  // Scene.onBeforeRender runs after updateMatrixWorld and before culling + the shadow pass; onAfterRender runs at the end of render().
  THREE.Scene.prototype.onBeforeRender = function (r) {
    if (!session || !frame || !isMain(r)) return;
    frame.beforeAt = performance.now();
    frame.updateMs += frame.beforeAt - frame.start;
    beginQuery();
  };
  THREE.Scene.prototype.onAfterRender = function (r) {
    if (!session || !frame || !frame.beforeAt || !isMain(r)) return;
    endQuery();
    frame.renderMs += performance.now() - frame.beforeAt;
    frame.renders++;
    frame.calls += r.info.render.calls; frame.tris += r.info.render.triangles;
    frame.beforeAt = 0;
  };
  // Keep a handle on the renderer the first time a frame renders.
  const before = THREE.Scene.prototype.onBeforeRender;
  THREE.Scene.prototype.onBeforeRender = function (r, scene, camera) {
    if (!renderer && r.domElement.isConnected && r.domElement.closest('#game')) adopt(r);
    if (isMain(r)) { window.__perfScene = scene; window.__perfCamera = camera; }
    before.call(this, r, scene, camera);
  };

  const mixerUpdate = THREE.AnimationMixer.prototype.update;
  THREE.AnimationMixer.prototype.update = function (dt) { const t = performance.now(); const out = mixerUpdate.call(this, dt); hooks.mixerMs += performance.now() - t; hooks.mixerCalls++; return out; };
  const skeletonUpdate = THREE.Skeleton.prototype.update;
  THREE.Skeleton.prototype.update = function () { hooks.skeletonCalls++; return skeletonUpdate.call(this); };
  for (const name of ['intersectObject', 'intersectObjects']) {
    const original = THREE.Raycaster.prototype[name];
    THREE.Raycaster.prototype[name] = function (...args) { const t = performance.now(); const out = original.apply(this, args); hooks.rayMs += performance.now() - t; hooks.rayCalls++; return out; };
  }
  const matrix = THREE.Object3D.prototype.updateMatrixWorld;
  THREE.Scene.prototype.updateMatrixWorld = function (force) { const t = performance.now(); matrix.call(this, force); hooks.matrixMs += performance.now() - t; };

  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) { const t = performance.now(); setItem.call(this, key, value); hooks.saveMs += performance.now() - t; hooks.saveCalls++; hooks.saveBytes += String(value).length; };

  const store = window.__godbeanStore; // only on ?profile=test|max
  if (store) { const dispatch = store.dispatch; store.dispatch = (...args) => { const t = performance.now(); const out = dispatch(...args); hooks.dispatchMs += performance.now() - t; hooks.dispatchCalls++; return out; }; }

  const bufferSubData = WebGL2RenderingContext.prototype.bufferSubData;
  WebGL2RenderingContext.prototype.bufferSubData = function (...args) { if (session && this === gl) hooks.uploadBytes += args[4] ? args[4] * (args[2]?.BYTES_PER_ELEMENT || 1) : args[2]?.byteLength || 0; return bufferSubData.apply(this, args); };

  new MutationObserver(list => { hooks.mutations += list.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  if (longTaskSupported) new PerformanceObserver(list => {
    if (session) for (const entry of list.getEntries()) session.longTasks.push(round(entry.duration, 0));
  }).observe({ entryTypes: ['longtask'] });
}

function isMain(r) { return !renderer || r === renderer; }
function adopt(r) {
  renderer = r; gl = r.getContext();
  timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  window.__perfRenderer = r;
  // Counts depth passes that really run: three returns early from shadowMap.render when autoUpdate and needsUpdate are both off.
  const shadow = r.shadowMap, renderShadow = shadow.render;
  shadow.render = function (...args) {
    if (!session || !shadow.enabled || !(shadow.autoUpdate || shadow.needsUpdate)) return renderShadow.apply(this, args);
    const t = performance.now(); const out = renderShadow.apply(this, args); hooks.shadowMs += performance.now() - t; hooks.shadowPasses++; return out;
  };
}

function beginQuery() {
  if (!timerExt || queries.active) return;
  queries.active = queries.pool.pop() || gl.createQuery();
  gl.beginQuery(timerExt.TIME_ELAPSED_EXT, queries.active);
}
function endQuery() {
  if (!timerExt || !queries.active) return;
  gl.endQuery(timerExt.TIME_ELAPSED_EXT);
  queries.pending.push(queries.active); queries.active = null;
}
function pollQueries() {
  if (!timerExt) return;
  if (gl.getParameter(timerExt.GPU_DISJOINT_EXT)) { queries.pool.push(...queries.pending.splice(0)); return; } // timings across a disjoint event are invalid
  while (queries.pending.length && gl.getQueryParameter(queries.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
    const query = queries.pending.shift();
    const ns = gl.getQueryParameter(query, gl.QUERY_RESULT);
    if (session) session.gpu.push(ns / 1e6);
    queries.pool.push(query);
  }
}

function endFrame(f) {
  if (!session) return;
  session.rafNows.add(f.now);
  pollQueries();
  if (!f.renders) return; // another rAF callback, or a gated frame: not a rendered frame
  const end = performance.now();
  if (session.lastNow != null) session.intervals.push(f.now - session.lastNow);
  session.lastNow = f.now;
  session.cb.push(end - f.start); session.update.push(f.updateMs); session.render.push(f.renderMs);
  session.renders.push(f.renders); session.calls.push(f.calls); session.tris.push(f.tris);
}

function resources() {
  const info = renderer?.info;
  return info ? { geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? null } : {};
}
function heapMB() { return performance.memory ? round(performance.memory.usedJSHeapSize / 1048576, 1) : null; }

export function start(label = 'run') {
  installOnce();
  for (const key of Object.keys(hooks)) hooks[key] = 0;
  queries.pool.push(...queries.pending.splice(0)); // results from the previous run must not count here
  session = { rafNows: new Set(), label, t0: performance.now(), lastNow: null, intervals: [], cb: [], update: [], render: [], renders: [], calls: [], tris: [], gpu: [], longTasks: [], heap0: heapMB(), res0: resources() };
}

export function stop() {
  if (!session) return null;
  const s = session; session = null;
  const seconds = (performance.now() - s.t0) / 1000;
  const frames = s.intervals.length;
  const sorted = [...s.intervals].sort((a, b) => a - b);
  const worst1 = sorted.slice(Math.floor(sorted.length * .99));
  const perSec = v => round(v / seconds, 1), perFrame = v => round(v / Math.max(1, s.cb.length), 3);
  const cbSorted = [...s.cb].sort((a, b) => a - b), gpuSorted = [...s.gpu].sort((a, b) => a - b);
  return {
    label: s.label, seconds: round(seconds, 1), frames,
    fpsAvg: round(frames / (s.intervals.reduce((a, b) => a + b, 0) / 1000), 1),
    fps1pctLow: round(1000 / (avg(worst1) || 1), 1),
    frameMs: { avg: round(avg(s.intervals)), p50: round(pct(sorted, .5)), p95: round(pct(sorted, .95)), p99: round(pct(sorted, .99)), max: round(sorted.at(-1) ?? 0) },
    mainThreadMs: { avgCallback: round(avg(s.cb)), p95Callback: round(pct(cbSorted, .95)), update: round(avg(s.update)), renderSubmit: round(avg(s.render)), rafBusyPct: round(s.cb.reduce((a, b) => a + b, 0) / (seconds * 10), 1) },
    gpuMs: gpuSorted.length ? { source: 'EXT_disjoint_timer_query_webgl2', samples: gpuSorted.length, avg: round(avg(gpuSorted)), p95: round(pct(gpuSorted, .95)) } : { source: timerExt ? 'no valid samples' : 'unavailable' },
    rafPerSec: round(s.rafNows.size / seconds, 1),
    renderCallsPerRaf: round(s.renders.reduce((a, b) => a + b, 0) / Math.max(1, s.rafNows.size), 2),
    drawCalls: Math.round(avg(s.calls)), triangles: Math.round(avg(s.tris)),
    perFrameMs: { mixers: perFrame(hooks.mixerMs), raycast: perFrame(hooks.rayMs), matrixWorld: perFrame(hooks.matrixMs) },
    counts: { mixerUpdatesPerSec: perSec(hooks.mixerCalls), skeletonUpdatesPerSec: perSec(hooks.skeletonCalls), raycastsPerSec: perSec(hooks.rayCalls), domMutationsPerSec: perSec(hooks.mutations), shadowPassesPerSec: perSec(hooks.shadowPasses), shadowMsPerPass: hooks.shadowPasses ? round(hooks.shadowMs / hooks.shadowPasses) : 0, uploadBytesPerSec: perSec(hooks.uploadBytes) },
    save: { writesPerSec: perSec(hooks.saveCalls), msPerWrite: hooks.saveCalls ? round(hooks.saveMs / hooks.saveCalls) : 0, bytesPerSec: perSec(hooks.saveBytes) },
    dispatch: { perSec: perSec(hooks.dispatchCalls), msEach: hooks.dispatchCalls ? round(hooks.dispatchMs / hooks.dispatchCalls, 3) : 0 },
    longTasks: longTaskSupported ? { count: s.longTasks.length, totalMs: s.longTasks.reduce((a, b) => a + b, 0), max: Math.max(0, ...s.longTasks) } : { source: 'unavailable' },
    heapMB: { start: s.heap0, end: heapMB() },
    resources: { start: s.res0, end: resources() },
  };
}

export async function run(label, ms = 20000) { start(label); await new Promise(resolve => setTimeout(resolve, ms)); return stop(); }

/** Alternates baseline and variant so machine drift cancels out. on/off change the state under test. Returns medians as [baseline, variant]. */
export async function ab(label, on, off, rounds = 3, ms = 4000) {
  const wait = t => new Promise(resolve => setTimeout(resolve, t));
  const pick = s => ({ gpu: s.gpuMs.avg ?? null, cb: s.mainThreadMs.avgCallback, update: s.mainThreadMs.update, submit: s.mainThreadMs.renderSubmit, fps: s.fpsAvg, tris: s.triangles, calls: s.drawCalls });
  const base = [], test = [];
  for (let i = 0; i < rounds; i++) {
    await wait(900); base.push(pick(await run(`${label} baseline`, ms)));
    on(); await wait(900); test.push(pick(await run(label, ms))); off();
  }
  const median = (list, key) => { const v = list.map(x => x[key]).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  return Object.fromEntries(['gpu', 'cb', 'update', 'submit', 'fps', 'tris', 'calls'].map(key => [key, [median(base, key), median(test, key)]]));
}

/** Scene graph and resource census. estGpuTextureMB and estGpuBufferMB are estimates from dimensions, not measured GPU memory. */
export function census(scene = window.__perfScene) {
  if (!scene) return null;
  const c = { nodes: 0, meshes: 0, visibleMeshes: 0, instanced: 0, instances: 0, instancedVisibleTris: 0, skinned: 0, skeletonsBones: 0, points: 0, lines: 0, sprites: 0, shadowCasters: 0, shadowCasterTris: 0, transparentMeshes: 0, trisVisible: 0 };
  const geos = new Set(), mats = new Set(), texs = new Set(), geoUsers = new Map(), shaders = new Map();
  const skeletons = new Set();
  const trisOf = g => (g.index ? g.index.count : g.attributes.position?.count || 0) / 3;
  const effective = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  scene.traverse(o => {
    c.nodes++;
    if (o.isPoints) c.points++; if (o.isLine) c.lines++; if (o.isSprite) c.sprites++;
    if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
    if (o.geometry) { geos.add(o.geometry); geoUsers.set(o.geometry, (geoUsers.get(o.geometry) || 0) + 1); }
    for (const m of [o.material].flat().filter(Boolean)) {
      mats.add(m); shaders.set(m.type, (shaders.get(m.type) || 0) + 1);
      for (const v of Object.values(m)) if (v?.isTexture) texs.add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) texs.add(u.value);
    }
    if (!o.isMesh) return;
    c.meshes++;
    const vis = effective(o), tris = o.geometry ? trisOf(o.geometry) : 0, count = o.isInstancedMesh ? o.count : 1;
    if (o.isInstancedMesh) { c.instanced++; c.instances += o.count; if (vis) c.instancedVisibleTris += tris * count; }
    if (o.isSkinnedMesh) { c.skinned++; if (o.skeleton) skeletons.add(o.skeleton); }
    if (vis) {
      c.visibleMeshes++; c.trisVisible += tris * count;
      if (o.castShadow) { c.shadowCasters++; c.shadowCasterTris += tris * count; }
      if ([o.material].flat().some(m => m?.transparent)) c.transparentMeshes++;
    }
  });
  for (const s of skeletons) c.skeletonsBones += s.bones.length;
  let texBytes = 0; const big = [];
  for (const t of texs) {
    const w = t.image?.width || 0, h = t.image?.height || 0, bytes = w * h * 4 * (t.generateMipmaps === false ? 1 : 1.333);
    texBytes += bytes; if (Math.max(w, h) >= 1024) big.push(`${w}x${h}`);
  }
  let bufBytes = 0;
  for (const g of geos) { for (const a of Object.values(g.attributes)) bufBytes += a.array?.byteLength || 0; bufBytes += g.index?.array?.byteLength || 0; }
  const lights = []; scene.traverse(o => { if (o.isLight) lights.push({ type: o.type, shadow: !!o.castShadow, map: o.castShadow ? `${o.shadow.mapSize.x}x${o.shadow.mapSize.y}` : null, autoUpdate: o.castShadow ? o.shadow.autoUpdate : null, visible: effective(o) }); });
  const fog = scene.fog ? { type: scene.fog.type, near: scene.fog.near, far: scene.fog.far, density: scene.fog.density } : null;
  const camera = window.__perfCamera, r = renderer;
  return {
    ...c, uniqueGeometries: geos.size, uniqueMaterials: mats.size, uniqueTextures: texs.size, materialTypes: Object.fromEntries(shaders),
    largeTextures: big.length, largeTextureSizes: big, topSharedGeometries: [...geoUsers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([g, users]) => ({ name: g.name || null, users, tris: Math.round(trisOf(g)) })), estGpuTextureMB: round(texBytes / 1048576, 1), estGpuBufferMB: round(bufBytes / 1048576, 1),
    lights, fog, camera: camera ? { near: camera.near, far: camera.far, fov: camera.fov } : null,
    renderer: r ? { pixelRatio: r.getPixelRatio(), drawingBuffer: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`, samples: gl.getParameter(gl.SAMPLES), shadowsEnabled: r.shadowMap.enabled, shadowAutoUpdate: r.shadowMap.autoUpdate, shadowType: r.shadowMap.type, info: resources() } : null,
  };
}

export function gpuAvailable() {
  const r = renderer; if (!r) return { error: 'no frame rendered yet: call start() and wait a moment' };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return { vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : null, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, timerQuery: !!timerExt, webgl2: gl instanceof WebGL2RenderingContext, heapApi: !!performance.memory, longTaskApi: !!window.PerformanceObserver?.supportedEntryTypes?.includes('longtask') };
}

installOnce();
const api = { start, stop, run, ab, census, gpuAvailable };
window.__perf = api;
export default api;
