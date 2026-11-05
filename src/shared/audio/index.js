// Engine âm thanh dùng chung (spec: docs/design/godbean-gdd.md §12.2).
// Bus music/ambience/sfx/ui → master → loa. AudioContext chỉ tạo ở lần chạm đầu tiên; không có Web Audio thì mọi hàm là no-op.
import { SOUNDS } from './sounds.js';

const AC = globalThis.AudioContext;
const BUSES = ['music', 'ambience', 'sfx', 'ui'];
const MAX_VOICES = 24;
const CROSSFADE_MS = 1500;
const BASE = `${import.meta.env.BASE_URL}audio/`;
const EXT = globalThis.Audio && new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';
const NOOP_LOOP = { set() {}, stop() {} };

const levels = { master: 1, music: 1, ambience: 1, sfx: 1, ui: 1 };
const bus = {};
const active = new Set();
const byId = new Map();
const lastAt = new Map();
const buffers = new Map(); // id → Promise (đang tải) | AudioBuffer | null (lỗi → dùng synth)
const channels = { music: { id: null, voice: null }, ambience: { id: null, voice: null } };
let ctx = null;
let master = null;
let muted = false;
let noiseBuffer = null;

// --- Mở khoá, ẩn tab, tiếng UI tự gắn ---

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'];
function unlock() {
  if (!AC) return removeUnlock();
  if (!ctx) {
    ctx = new AC();
    master = new GainNode(ctx, { gain: muted ? 0 : levels.master });
    master.connect(ctx.destination);
    for (const name of BUSES) (bus[name] = new GainNode(ctx, { gain: levels[name] })).connect(master);
    for (const name of Object.keys(channels)) crossfade(name);
  }
  ctx.resume().then(() => { if (ctx.state === 'running') removeUnlock(); }, () => {});
}
function removeUnlock() {
  for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true);
}
for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true);

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {});
});

// Capture để vẫn nghe được khi handler của màn chặn lan truyền.
document.addEventListener('click', (event) => {
  const el = event.target.closest?.('button, .ui-close, [data-sfx]');
  if (!el) return;
  const id = el.dataset.sfx ?? (el.matches('.ui-close') ? 'ui.close' : el.matches('button') ? 'ui.click' : null);
  if (id && id !== 'none') sfx(id);
}, true);

// --- Tiếng (voice): gain riêng (+ panner nếu có `at`) → bus ---

function voice(id, entry, at, volume = 1, rate = 1) {
  const out = new GainNode(ctx, { gain: entry.volume * volume });
  const v = {
    id, out, rate, nodes: [out], sources: [], pending: 0, handle: {}, dead: false, ended: false,
    noise: getNoise(),
    time: () => ctx.currentTime,
    node(Type, options) {
      const node = new Type(ctx, options);
      v.nodes.push(node);
      return node;
    },
    src(node, start, stop = null, offset) {
      v.sources.push(node);
      v.pending += 1;
      node.onended = () => { v.pending -= 1; if (!v.pending) v.end(); };
      offset == null ? node.start(start) : node.start(start, offset);
      if (stop != null) node.stop(stop);
    },
    kill(fadeMs) {
      if (v.dead) return;
      v.dead = true;
      forget(v);
      v.handle.stop?.();
      const t = ctx.currentTime;
      const end = t + fadeMs / 1000;
      v.out.gain.cancelScheduledValues(t);
      v.out.gain.setValueAtTime(v.out.gain.value, t);
      v.out.gain.linearRampToValueAtTime(0, end);
      for (const node of v.sources) try { node.stop(end); } catch { /* đã dừng */ }
      if (!v.sources.length) v.end();
    },
    end() {
      if (v.ended) return;
      v.ended = v.dead = true;
      v.handle.stop?.();
      for (const node of v.nodes) node.disconnect();
      active.delete(v);
      forget(v);
    },
  };
  let tail = out;
  if (at) {
    tail = v.node(PannerNode, {
      panningModel: 'equalpower', distanceModel: 'linear', refDistance: 6, maxDistance: 30,
      positionX: at.x, positionY: at.y ?? 0, positionZ: at.z,
    });
    out.connect(tail);
  }
  tail.connect(bus[entry.bus]);
  active.add(v);
  byId.set(id, [...(byId.get(id) ?? []), v]);
  return v;
}

function forget(v) {
  const list = byId.get(v.id);
  if (list) byId.set(v.id, list.filter((item) => item !== v));
}

function getNoise() {
  if (!noiseBuffer) {
    noiseBuffer = new AudioBuffer({ length: ctx.sampleRate * 2, sampleRate: ctx.sampleRate });
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Có file thì phát buffer (tải lười); đang tải hoặc lỗi thì phát synth.
function start(id, entry, { at, volume, rate = 1, param = 0 }, looping) {
  const v = voice(id, entry, at, volume, rate);
  const buffer = readyBuffer(id, entry);
  const t = ctx.currentTime;
  if (buffer) {
    const node = v.node(AudioBufferSourceNode, { buffer, loop: looping, playbackRate: rate });
    node.connect(v.out);
    v.src(node, t);
    v.handle = { set: ({ rate: r }, at2) => { if (r != null) node.playbackRate.setTargetAtTime(r, at2, 0.05); } };
  } else if (entry.synth) {
    v.handle = entry.synth(v, t, { param }) ?? {};
  }
  if (!v.sources.length) v.end();
  return v;
}

function admit(id, entry) {
  if (!ctx || ctx.state !== 'running') return false; // chưa mở khoá hoặc tab ẩn: bỏ, không xếp hàng
  if (!entry) {
    console.warn(`[audio] Không có id âm "${id}"`);
    return false;
  }
  const now = performance.now();
  if (now - (lastAt.get(id) ?? -Infinity) < (entry.cooldownMs ?? 40) || active.size >= MAX_VOICES) return false;
  lastAt.set(id, now);
  const list = byId.get(id) ?? [];
  if (list.length >= (entry.maxInstances ?? 4)) list[0].kill(20);
  return true;
}

// --- Tải file ---

function loadFile(id, entry) {
  if (!buffers.has(id)) {
    const request = fetch(`${BASE}${entry.file}.${EXT}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(id, buffer);
        return buffer;
      }, (error) => {
        console.warn(`[audio] Không tải được "${id}", dùng âm tổng hợp`, error);
        buffers.set(id, null);
        return null;
      });
    buffers.set(id, request);
  }
  return Promise.resolve(buffers.get(id));
}

function readyBuffer(id, entry) {
  if (!entry.file) return null;
  if (!buffers.has(id)) loadFile(id, entry);
  const buffer = buffers.get(id);
  return buffer instanceof AudioBuffer ? buffer : null;
}

// Nhạc/nền chỉ phát khi có file; chuyển dần CROSSFADE_MS.
function crossfade(name) {
  const channel = channels[name];
  channel.voice?.kill(CROSSFADE_MS);
  channel.voice = null;
  const id = channel.id;
  const entry = SOUNDS[id];
  if (!ctx || !entry?.file) return;
  loadFile(id, entry).then((buffer) => {
    if (!buffer || channel.id !== id || channel.voice) return;
    const v = start(id, entry, {}, true);
    const t = ctx.currentTime;
    v.out.gain.setValueAtTime(0, t);
    v.out.gain.linearRampToValueAtTime(entry.volume, t + CROSSFADE_MS / 1000);
    channel.voice = v;
  });
}

function setChannel(name, id) {
  if (channels[name].id === id) return;
  channels[name].id = id;
  crossfade(name);
}

// --- API ---

export function sfx(id, { at, volume = 1, rate = 1 } = {}) {
  const entry = SOUNDS[id];
  if (!admit(id, entry)) return;
  if (entry.vary) {
    rate *= 1 + (Math.random() * 2 - 1) * entry.vary;
    volume *= 1 - Math.random() * 0.15;
  }
  start(id, entry, { at, volume, rate }, false);
}

export function loop(id, { at, volume = 1, rate = 1, param = 0 } = {}) {
  const entry = SOUNDS[id];
  if (!admit(id, entry)) return NOOP_LOOP;
  const v = start(id, entry, { at, volume, rate, param }, true);
  return {
    set({ volume: nextVolume, rate: nextRate, param: nextParam } = {}) {
      if (v.dead) return;
      const t = ctx.currentTime;
      if (nextVolume != null) v.out.gain.setTargetAtTime(entry.volume * nextVolume, t, 0.03);
      v.handle.set?.({ rate: nextRate, param: nextParam }, t);
    },
    stop(fadeMs = 120) { v.kill(fadeMs); },
  };
}

// Vị trí nghe ở nhân vật, hướng theo góc quay ngang của camera.
export function setListener(position, camera) {
  if (!ctx || !position) return;
  const listener = ctx.listener;
  const e = camera?.matrixWorld?.elements;
  let fx = 0;
  let fz = -1;
  if (e) {
    const length = Math.hypot(e[8], e[10]) || 1;
    fx = -e[8] / length;
    fz = -e[10] / length;
  }
  if (listener.positionX) {
    listener.positionX.value = position.x;
    listener.positionY.value = position.y;
    listener.positionZ.value = position.z;
    listener.forwardX.value = fx;
    listener.forwardY.value = 0;
    listener.forwardZ.value = fz;
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  } else {
    listener.setPosition(position.x, position.y, position.z);
    listener.setOrientation(fx, 0, fz, 0, 1, 0);
  }
}

export function setVolume(name, value) {
  if (!(name in levels)) return;
  levels[name] = Math.min(1, Math.max(0, Number(value) || 0));
  if (!ctx) return;
  if (name === 'master') {
    if (!muted) master.gain.setTargetAtTime(levels.master, ctx.currentTime, 0.02);
  } else {
    bus[name].gain.setTargetAtTime(levels[name], ctx.currentTime, 0.02);
  }
}

export function setMuted(value) {
  muted = Boolean(value);
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : levels.master, ctx.currentTime, 0.015); // ~50 ms
}

export function playMusic(id) { setChannel('music', id ?? null); }
export function playAmbience(id) { setChannel('ambience', id ?? null); }

export function hasContent(name) {
  return Object.values(SOUNDS).some((entry) => entry.bus === name && (entry.synth || entry.file));
}
