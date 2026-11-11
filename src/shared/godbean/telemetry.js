// Tester telemetry → godbean server logs (client.js). What it sends, so performance and friction can be tuned from real play:
//   device        once: cores, memory, screen, dpr, GPU, browser, save phase / level
//   perf_boot     once: navigation timings (ttfb, DOM ready, load) and the first screen
//   perf_load     each screen load: screen, ms (from the loading screen to the first frame)
//   perf_minute   every 60 s on screen: fps, frame-time p50/p95/max, % of janky frames, long tasks, draw calls,
//                 triangles, geometries/textures, JS heap, quality + resolution, level, counted player actions
//   perf_quality  each automatic or manual quality change
//   gpu_lost      WebGL context lost / restored
//   action_refused  a player action the game refused (error code), counted per minute — shows where players get stuck
//   level_up, expiry, login_*, plus every analytics track() event (wire.js forwards them)
//   js_error / console_error  with the last 20 actions as breadcrumbs (client.js)
// Nothing typed by the player is sent; names in the save are not sent.
import { log, crumb, startLogging, setLogEnabled, flush } from './client.js';

let started = false;
let getScreen = () => '';
let getLevel = () => 0;
let getQualityInfo = () => ({});
let rendererRef = null;

// --- frame stats over the current minute ---
const FRAME_BINS = 120; // 1 ms bins up to 120 ms (more lands in the last one)
let bins = new Uint32Array(FRAME_BINS), frames = 0, frameSum = 0, frameMax = 0, janky = 0, hitches = 0;
let longTasks = 0, longTaskMs = 0, longTaskMax = 0;
let minuteStart = 0;
let actions = new Map(), refused = new Map();

// Timer-driven actions: not the player's doing, kept out of breadcrumbs and counts.
const BACKGROUND = /tick|spawnCustomer|customerLeft|venueSale|review|story\/seen|dev\//;

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
function percentile(p) {
  if (!frames) return 0;
  const want = frames * p;
  let seen = 0;
  for (let i = 0; i < FRAME_BINS; i++) { seen += bins[i]; if (seen >= want) return i + 1; }
  return FRAME_BINS;
}
function topOf(map, n = 15) {
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n));
}

function sendMinute(reason = 'minute') {
  const now = performance.now(), span = (now - minuteStart) / 1000;
  minuteStart = now;
  if (frames >= 30) {
    const info = rendererRef?.info;
    const mem = performance.memory;
    log('perf_minute', {
      screen: getScreen(), reason, span_s: round(span, 0), level: getLevel(),
      fps: round(frames / Math.max(1e-3, frameSum / 1000)), frame_p50: percentile(.5), frame_p95: percentile(.95), frame_max: round(frameMax, 0),
      jank_pct: round(janky / frames * 100), hitches, frames,
      long_tasks: longTasks, long_task_ms: round(longTaskMs, 0), long_task_max: round(longTaskMax, 0),
      draw_calls: info?.render.calls ?? null, triangles: info?.render.triangles ?? null,
      geometries: info?.memory.geometries ?? null, textures: info?.memory.textures ?? null, programs: info?.programs?.length ?? null,
      heap_mb: mem ? round(mem.usedJSHeapSize / 1048576, 0) : null,
      ...getQualityInfo(),
      actions: topOf(actions),
    }, frameSum / frames > 50 ? 'warn' : 'info');
  }
  if (refused.size) log('action_refused', { screen: getScreen(), level: getLevel(), counts: topOf(refused, 20) }, 'warn');
  bins = new Uint32Array(FRAME_BINS); frames = frameSum = frameMax = janky = hitches = 0;
  longTasks = longTaskMs = longTaskMax = 0;
  actions = new Map(); refused = new Map();
}

/** Call from the render loop with the real time since the last drawn frame (ms). Idle-capped frames should not be passed. */
export function noteFrame(ms) {
  if (!started || !(ms > 0)) return;
  if (ms > 250) { hitches++; return; } // the page was paused / throttled, not a slow device
  frames++; frameSum += ms; if (ms > frameMax) frameMax = ms;
  if (ms > 33.4) janky++;
  bins[Math.min(FRAME_BINS - 1, Math.floor(ms))]++;
}

const loads = new Map();
/** Marks the start of a screen load; endLoad(screen) sends perf_load with the time in between. */
export function beginLoad(screen) { loads.set(screen, performance.now()); }
export function endLoad(screen, extra = {}) {
  const t0 = loads.get(screen);
  if (t0 === undefined) return;
  loads.delete(screen);
  const ms = Math.round(performance.now() - t0);
  log('perf_load', { screen, ms, ...extra, ...getQualityInfo() }, ms > 15000 ? 'warn' : 'info');
}

function gpuName(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).slice(0, 120);
  } catch { return ''; }
}

/** Wraps store.dispatch: player actions become breadcrumbs + counts, refused ones are counted by error code. */
function instrumentStore(store) {
  const dispatch = store.dispatch;
  store.dispatch = (type, payload, opts) => {
    const result = dispatch(type, payload, opts);
    if (!BACKGROUND.test(type)) {
      crumb(result?.ok ? type : `${type} ✗${result?.error ?? ''}`);
      actions.set(type, (actions.get(type) || 0) + 1);
      if (result && !result.ok && result.error !== 'paused') {
        const key = `${type}:${result.error ?? '?'}`;
        refused.set(key, (refused.get(key) || 0) + 1);
      }
    }
    return result;
  };
  store.subscribe((state, events) => {
    for (const e of events || []) {
      if (e.type === 'levelUp') log('level_up', { from: e.from, to: e.to, region: state.world?.currentRegion ?? null, play_min: round(performance.now() / 60000) });
      else if (e.type === 'expiryTriggered') log('expiry_triggered', { region: e.regionId ?? null });
    }
  });
}

/**
 * Once at boot. renderer: THREE.WebGLRenderer; store: the game store; screen(): current screen name;
 * quality(): { quality, pixel_ratio }; level(): player level; enabled: settings.analytics.
 */
export function startTelemetry({ renderer, store, screen, quality, level, enabled = true, extra = {} }) {
  if (started) return;
  started = true;
  setLogEnabled(enabled);
  getScreen = screen; getQualityInfo = quality; rendererRef = renderer;
  getLevel = level;
  startLogging({ screen });
  instrumentStore(store);
  minuteStart = performance.now();

  // console.error from caught failures (e.g. '[incidents]', model loads) would otherwise never reach us.
  const original = console.error.bind(console);
  let consoleSent = 0;
  console.error = (...args) => {
    original(...args);
    if (consoleSent >= 30) return; // a loop of errors: the first 30 tell the story
    if (args.some(a => typeof a === 'string' && a.includes('[GSI_LOGGER]'))) return; // Google sign-in's own noise (origin checks), not ours
    consoleSent++;
    const err = args.find(a => a instanceof Error);
    const msg = args.map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' ');
    log('console_error', { msg: msg.slice(0, 500), stack: String(err?.stack ?? '').slice(0, 2000), screen: screen(), breadcrumbs: [] }, 'error');
  };

  const conn = navigator.connection;
  log('device', {
    cores: navigator.hardwareConcurrency ?? null, mem_gb: navigator.deviceMemory ?? null,
    screen_w: globalThis.screen?.width, screen_h: globalThis.screen?.height, dpr: devicePixelRatio,
    view_w: innerWidth, view_h: innerHeight, gpu: gpuName(renderer), ua: navigator.userAgent.slice(0, 200),
    lang: navigator.language, net: conn?.effectiveType ?? null, save_data: conn?.saveData ?? null,
    max_texture: renderer.capabilities?.maxTextureSize ?? null, ...extra,
  });
  // Navigation timings are final only after the load event.
  const boot = () => setTimeout(() => {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    if (nav) log('perf_boot', { ttfb: Math.round(nav.responseStart), dom_ready: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), transfer_kb: Math.round((nav.transferSize || 0) / 1024) });
  });
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot, { once: true });

  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) { longTasks++; longTaskMs += e.duration; if (e.duration > longTaskMax) longTaskMax = e.duration; }
    }).observe({ type: 'longtask', buffered: true });
  } catch { /* Safari / Firefox: no long-task API */ }

  renderer.domElement.addEventListener('webglcontextlost', () => log('gpu_lost', { screen: screen(), ...quality() }, 'error'));
  renderer.domElement.addEventListener('webglcontextrestored', () => log('gpu_restored', { screen: screen() }, 'warn'));

  setInterval(() => { if (document.visibilityState === 'visible') sendMinute(); }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { sendMinute('hidden'); flush({ keepalive: true }); } else minuteStart = performance.now();
  });
}

export function setTelemetryEnabled(on) { setLogEnabled(on); }
export { log, crumb };
