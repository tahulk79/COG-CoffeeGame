import * as THREE from 'three';

// Mức chất lượng (round-1-foundation §3.2). Lưu/đọc do settings đảm nhận; ở đây chỉ giữ giá trị trong lượt.
const QUALITY = {
  low: { pixelRatio: 1, shadows: false, particles: 120, burst: .4, emitter: 0, shake: false, pulse: false, outline: false, chips: 4 },
  medium: { pixelRatio: 1.5, shadows: true, particles: 400, burst: .7, emitter: .5, shake: true, pulse: true, outline: false, chips: 6 },
  high: { pixelRatio: 2, shadows: true, particles: 800, burst: 1, emitter: 1, shake: true, pulse: true, outline: true, chips: 8 }
};
let quality = 'high';
// Touch screens are small and pay for every shaded pixel in heat, so no tier goes past 1.5 there.
const IS_PHONE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const PHONE_MAX_RATIO = 1.5, RATIO_STEP = .25;
let ratioCeiling = Infinity; // set by the resolution ladder, this session only; survives an automatic tier drop so the buffer never jumps back up
const qualityListeners = new Set();
const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reducedMotion = () => !!motionQuery?.matches;

export function getQuality() { return quality; }
export function setQuality(level) {
  if (!QUALITY[level] || level === quality) return;
  quality = level;
  for (const fn of qualityListeners) fn(level);
}
export function onQuality(fn) { qualityListeners.add(fn); return () => qualityListeners.delete(fn); }
const maxRatio = () => Math.min(window.devicePixelRatio || 1, QUALITY[quality].pixelRatio, IS_PHONE ? PHONE_MAX_RATIO : Infinity);
const minRatio = () => Math.min(maxRatio(), quality === 'low' ? .75 : 1); // only Low may render under one buffer pixel per CSS pixel
const currentRatio = () => Math.max(minRatio(), Math.min(maxRatio(), ratioCeiling));
function fitPixelRatio(renderer) {
  const ratio = currentRatio();
  if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
}
/** Resolution ladder: moves the render scale `rungs` steps (negative = coarser). False when it is already at that end. */
export function stepResolution(renderer, rungs) {
  const from = currentRatio(), to = Math.max(minRatio(), Math.min(maxRatio(), from + rungs * RATIO_STEP));
  if (to === from) return false;
  ratioCeiling = to >= maxRatio() ? Infinity : to;
  fitPixelRatio(renderer);
  return true;
}
/** The player picked a level: the tier's own resolution applies again. */
export function resetResolution() { ratioCeiling = Infinity; }
export function applyRendererQuality(renderer, ...scenes) {
  const q = QUALITY[quality];
  document.documentElement.dataset.quality = quality; // CSS: Low stops the HUD's endless animations
  fitPixelRatio(renderer);
  if (renderer.shadowMap.enabled === q.shadows) return;
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.needsUpdate = true;
  // Bật/tắt bóng đổi chương trình shader: biên dịch lại một lần (chấp nhận khựng).
  for (const scene of scenes) scene?.traverse(object => {
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) material.needsUpdate = true;
  });
}

// Bảng màu ấm/đất/xanh lá dịu (docs/asset-pipeline.md). size theo đơn vị thế giới.
const KINDS = {
  soil: { color: 0x7a5232, shape: 'dot', count: 14, life: .6, speed: 1.8, up: 2.6, gravity: -9, size: .14 },
  water: { color: 0x86bcd8, shape: 'drop', count: 12, life: .5, speed: 1.1, up: 1.2, gravity: -9, size: .12 },
  leaf: { color: 0x8fae6b, shape: 'leaf', count: 8, life: 1, speed: 1.4, up: 1.8, gravity: -2.2, size: .2, drag: 2 },
  granule: { color: 0x6b4428, shape: 'dot', count: 14, life: .6, speed: 1.4, up: 2.2, gravity: -8, size: .1 },
  cherry: { color: 0xc4473a, shape: 'dot', count: 10, life: .7, speed: 1.5, up: 2.6, gravity: -8, size: .16 },
  dust: { color: 0xb89b74, shape: 'smoke', atlas: true, count: 8, life: 1.6, speed: .8, up: .35, gravity: .2, size: .8, grow: .9, drag: 1.5, alpha: .55, spin: .6, wind: .3 },
  steam: { color: 0xf0ece4, shape: 'smoke', atlas: true, count: 6, life: 2, speed: .2, up: .8, gravity: .45, size: .55, grow: 1.1, drag: 1, alpha: .5, spin: .6, wind: .45 },
  smoke: { color: 0x7a746b, shape: 'smoke', atlas: true, count: 6, life: 3.8, speed: .16, up: 1.05, gravity: .1, size: 1, grow: 1.5, drag: .5, alpha: .6, spin: .4, wind: .6 },
  spark: { color: 0xffb25e, shape: 'streak', streak: true, count: 4, life: .35, speed: 3, up: 3.2, gravity: -14, size: .07, additive: true },
  chip: { color: 0x9a7548, shape: 'leaf', count: 4, life: .65, speed: 2, up: 3, gravity: -11, size: .13, spin: 9 },
  splash: { color: 0xc3e2ec, shape: 'streak', streak: true, count: 10, life: .45, speed: 1.4, up: 2.5, gravity: -11, size: .09 },
  mist: { color: 0xe3eff3, shape: 'smoke', atlas: true, count: 5, life: 1, speed: .5, up: .25, gravity: .05, size: .6, grow: 1, drag: 2, alpha: .4, spin: .6 }
  ,step: { color: 0xb49a78, shape: 'smoke', atlas: true, count: 1, life: .8, speed: .2, up: .25, gravity: .05, size: .32, grow: .9, drag: 2.5, alpha: .34, spin: .5 },
  mote: { color: 0xfff2c4, shape: 'soft', count: 1, life: 6, speed: .14, up: .05, gravity: .015, size: .07, additive: true, alpha: .75, wind: .25, sway: .25 },
  fallLeaf: { color: 0x83994a, shape: 'leaf', count: 1, life: 8, speed: .35, up: -1, gravity: 0, size: .17, alpha: .95, spin: 2.4, wind: .55, sway: 1.1 },
  sparkle: { color: 0xffe39a, shape: 'star', count: 10, life: .7, speed: 1.3, up: 1.1, gravity: 0, size: .22, drag: 2.5, additive: true },
  coin: { color: 0xf2c14e, shape: 'coin', count: 8, life: .8, speed: 1.6, up: 3, gravity: -7, size: .2 },
  puff: { color: 0xc4473a, shape: 'soft', count: 8, life: .5, speed: 1.1, up: .4, gravity: .3, size: .28, grow: 1.2, drag: 3 },
  heart: { color: 0xe57a8a, shape: 'heart', count: 5, life: 1, speed: .5, up: 1, gravity: .8, size: .24, drag: 1 }
};
const ATLAS_GRID = 8;
const POOL = 320; // mỗi loại; tổng số hạt sống còn bị chặn theo mức chất lượng

function drawTexture(shape) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.translate(32, 32);
  if (shape === 'soft') {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(-32, -32, 64, 64);
  } else if (shape === 'smoke') {
    // A puff built from overlapping blobs: lighter on top, darker underneath, so it reads as a volume in sunlight.
    canvas.width = canvas.height = 128; const c2 = canvas.getContext('2d'); c2.translate(64, 64);
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), .7) * 36, x = Math.cos(a) * d, y = Math.sin(a) * d, r = 12 + Math.random() * 16;
      const v = Math.round(182 - y * 1.7), blob = c2.createRadialGradient(x, y, 0, x, y, r);
      blob.addColorStop(0, `rgba(${v},${v},${v},.3)`); blob.addColorStop(1, `rgba(${v},${v},${v},0)`);
      c2.fillStyle = blob; c2.fillRect(-64, -64, 128, 128);
    }
  } else if (shape === 'streak') {
    const grad = g.createLinearGradient(0, -28, 0, 28); grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(.7, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,.6)');
    g.fillStyle = grad; g.beginPath(); g.ellipse(0, 0, 5, 28, 0, 0, Math.PI * 2); g.fill();
  } else if (shape === 'drop') {
    g.beginPath(); g.moveTo(0, -26); g.bezierCurveTo(16, -4, 18, 20, 0, 24); g.bezierCurveTo(-18, 20, -16, -4, 0, -26); g.fill();
  } else if (shape === 'leaf') {
    g.rotate(.6); g.beginPath(); g.ellipse(0, 0, 12, 26, 0, 0, Math.PI * 2); g.fill();
  } else if (shape === 'star') {
    g.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 28, a = i * Math.PI / 4; g.lineTo(Math.sin(a) * r, -Math.cos(a) * r); }
    g.fill();
  } else if (shape === 'coin') {
    g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.fill();
    g.globalAlpha = .55; g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke();
  } else if (shape === 'heart') {
    g.beginPath(); g.moveTo(0, 24); g.bezierCurveTo(-34, 0, -16, -28, 0, -10); g.bezierCurveTo(16, -28, 34, 0, 0, 24); g.fill();
  } else {
    g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const VERTEX = `
attribute float size; attribute float alpha; attribute vec3 tint; attribute float spin; attribute float frame;
uniform float halfHeight; varying float vAlpha; varying vec3 vTint; varying float vSpin; varying float vFrame;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = projectionMatrix[2][3] == -1.0 ? -mv.z : 1.0; // phối cảnh chia theo độ sâu, trực giao thì không
  gl_PointSize = size * projectionMatrix[1][1] * halfHeight / depth;
  vAlpha = alpha; vTint = tint; vSpin = spin; vFrame = frame;
}`;
const FRAGMENT = `
uniform sampler2D map; uniform float grid; varying float vAlpha; varying vec3 vTint; varying float vSpin; varying float vFrame;
vec4 cellTex(vec2 uv, float f) { vec2 cell = vec2(mod(f, grid), floor(f / grid)); return texture2D(map, (cell + clamp(uv, .004, .996)) / grid); }
void main() {
  vec2 c = gl_PointCoord - .5; float cs = cos(vSpin), sn = sin(vSpin);
  vec2 uv = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) + .5; vec4 t;
  if (grid > 1.5) { float f0 = floor(vFrame); t = mix(cellTex(uv, f0), cellTex(uv, f0 + 1.), vFrame - f0); t.a *= smoothstep(.5, .36, length(c)); }   // flipbook: blends two frames so a slow puff stays smooth
  else t = texture2D(map, uv);
  float a = t.a * vAlpha; if (a < .02) discard;
  gl_FragColor = vec4(vTint * t.rgb, a);
}`;

export function createVfx({ scene }) { // camera trong spec chưa cần: kích thước hạt lấy từ projectionMatrix
  const pools = {}, emitters = new Set(), pulses = new Map(), outlines = [], shellMaterials = new Map();
  const bufferSize = new THREE.Vector2(), tmpColor = new THREE.Color();
  let live = 0;

  for (const [kind, def] of Object.entries(KINDS)) {
    const geometry = new THREE.BufferGeometry();
    const attr = (name, n) => { const a = new THREE.BufferAttribute(new Float32Array(POOL * n), n); a.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute(name, a); return a; };
    const position = attr('position', 3), tint = attr('tint', 3), size = attr('size', 1), alpha = attr('alpha', 1), spin = attr('spin', 1), frame = attr('frame', 1);
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: drawTexture(def.shape) }, halfHeight: { value: 400 }, grid: { value: 1 } },
      vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false,
      blending: def.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false; points.visible = false; points.renderOrder = 10;
    points.onBeforeRender = renderer => { material.uniforms.halfHeight.value = renderer.getDrawingBufferSize(bufferSize).y / 2; };
    scene.add(points);
    pools[kind] = { def, points, geometry, material, position, tint, size, alpha, spin, frame, n: 0, spinRate: new Float32Array(POOL),
      velocity: new Float32Array(POOL * 3), age: new Float32Array(POOL), life: new Float32Array(POOL), base: new Float32Array(POOL) };
  }

  // Real smoke (scripts/blender/vfx_flipbook.py): 8 × 8 frames. Until it arrives, or if it fails, the drawn puff is used.
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/farm/vfx/smoke-atlas.webp`, atlas => {
    atlas.flipY = false; atlas.colorSpace = THREE.SRGBColorSpace; atlas.generateMipmaps = false; atlas.minFilter = THREE.LinearFilter; atlas.needsUpdate = true;
    for (const p of Object.values(pools)) if (p.def.atlas) { p.material.uniforms.map.value.dispose(); p.material.uniforms.map.value = atlas; p.material.uniforms.grid.value = ATLAS_GRID; }
  });

  function spawn(kind, pos, color, burstMode, spread = .15) {
    const p = pools[kind], d = p.def;
    if (p.n >= POOL || live >= QUALITY[quality].particles) return false;
    const i = p.n++, i3 = i * 3; live++;
    const angle = Math.random() * Math.PI * 2, speed = d.speed * (burstMode ? .4 + Math.random() * .6 : .3 + Math.random() * .4);
    p.position.array[i3] = pos.x + (Math.random() - .5) * spread;
    p.position.array[i3 + 1] = pos.y + Math.random() * .08;
    p.position.array[i3 + 2] = pos.z + (Math.random() - .5) * spread;
    p.velocity[i3] = Math.cos(angle) * speed;
    p.velocity[i3 + 1] = d.up * (.6 + Math.random() * .4);
    p.velocity[i3 + 2] = Math.sin(angle) * speed;
    p.age[i] = 0; p.life[i] = d.life * (.75 + Math.random() * .5); p.base[i] = d.size * (.7 + Math.random() * .6);
    tmpColor.set(color ?? d.color).multiplyScalar(.9 + Math.random() * .2);
    p.tint.array[i3] = tmpColor.r; p.tint.array[i3 + 1] = tmpColor.g; p.tint.array[i3 + 2] = tmpColor.b;
    p.size.array[i] = p.base[i]; p.alpha.array[i] = 0;
    p.spin.array[i] = Math.random() * Math.PI * 2; p.spinRate[i] = (d.spin || 0) * (Math.random() - .5) * 2; p.frame.array[i] = 0;
    return true;
  }

  function burst(kind, pos, { count, color } = {}) {
    if (!pools[kind] || !pos) return;
    const n = Math.max(1, Math.round((count ?? KINDS[kind].count) * QUALITY[quality].burst * (reducedMotion() ? .5 : 1)));
    for (let i = 0; i < n && spawn(kind, pos, color, true); i++);
  }

  function emitter(kind, pos, { rate = 8, duration = Infinity, spread = .15 } = {}) {
    const state = { kind, pos: { x: pos.x, y: pos.y, z: pos.z }, rate, remaining: duration, carry: 0, spread };
    if (pools[kind]) emitters.add(state);
    return {
      move(next) { state.pos.x = next.x; state.pos.y = next.y; state.pos.z = next.z; },
      stop() { emitters.delete(state); }
    };
  }

  function pulse(object, { scale = 1.08, ms = 400 } = {}) {
    if (!object || !QUALITY[quality].pulse) return;
    const current = pulses.get(object);
    if (current) { current.t = 0; current.ms = ms; current.scale = scale; return; }
    pulses.set(object, { base: object.scale.clone(), t: 0, ms, scale });
  }

  function shellMaterial(color) {
    const key = new THREE.Color(color).getHex();
    if (!shellMaterials.has(key)) shellMaterials.set(key, new THREE.MeshBasicMaterial({ color: key, side: THREE.BackSide, depthWrite: false }));
    return shellMaterials.get(key);
  }
  function outline(object, { color = 0xffe08a } = {}) {
    const handle = { remove() {} };
    if (!object || !QUALITY[quality].outline) return handle;
    const material = shellMaterial(color), shells = [];
    // shortcut: vỏ phóng quanh gốc mesh nên lệch với mesh có gốc không ở tâm và bỏ qua SkinnedMesh; đổi sang OutlinePass khi có hậu kỳ.
    object.traverse(child => {
      if (!child.isMesh || child.isSkinnedMesh || child.userData.vfxShell) return;
      const shell = new THREE.Mesh(child.geometry, material);
      shell.userData.vfxShell = true; shell.scale.setScalar(1.04); shell.raycast = () => {};
      shells.push([child, shell]);
    });
    for (const [child, shell] of shells) child.add(shell);
    const entry = { shells };
    handle.remove = () => {
      const index = outlines.indexOf(entry); if (index < 0) return;
      outlines.splice(index, 1);
      for (const [, shell] of shells) shell.removeFromParent();
    };
    entry.remove = handle.remove;
    outlines.push(entry);
    while (outlines.length > 2) outlines[0].remove();
    return handle;
  }

  const offQuality = onQuality(() => {
    const q = QUALITY[quality];
    if (!q.outline) while (outlines.length) outlines[0].remove();
    if (!q.pulse) { for (const [object, p] of pulses) object.scale.copy(p.base); pulses.clear(); }
  });

  function update(dt) {
    if (!(dt > 0)) return;
    const emitScale = QUALITY[quality].emitter * (reducedMotion() ? .5 : 1);
    for (const e of emitters) {
      if (emitScale) { e.carry += e.rate * emitScale * dt; while (e.carry >= 1) { e.carry--; spawn(e.kind, e.pos, null, false, e.spread); } }
      e.remaining -= dt; if (e.remaining <= 0) emitters.delete(e);
    }
    for (const kind in pools) {
      const p = pools[kind], d = p.def;
      if (!p.n && !p.points.visible) continue;
      const pos = p.position.array, tint = p.tint.array, size = p.size.array, alpha = p.alpha.array, v = p.velocity;
      const drag = d.drag ? Math.max(0, 1 - d.drag * dt) : 1;
      for (let i = 0; i < p.n; i++) {
        p.age[i] += dt;
        if (p.age[i] >= p.life[i]) {
          // Đổi chỗ với hạt cuối để vùng sống luôn liền mạch [0, n).
          const last = --p.n, i3 = i * 3, l3 = last * 3; live--;
          for (let k = 0; k < 3; k++) { pos[i3 + k] = pos[l3 + k]; v[i3 + k] = v[l3 + k]; tint[i3 + k] = tint[l3 + k]; }
          p.age[i] = p.age[last]; p.life[i] = p.life[last]; p.base[i] = p.base[last]; p.spin.array[i] = p.spin.array[last]; p.spinRate[i] = p.spinRate[last]; p.frame.array[i] = p.frame.array[last];
          i--; continue;
        }
        const i3 = i * 3, t = p.age[i] / p.life[i];
        v[i3] *= drag; v[i3 + 2] *= drag; v[i3 + 1] = v[i3 + 1] * drag + d.gravity * dt;
        if (d.wind) v[i3] += d.wind * dt;
        if (d.sway) pos[i3 + 2] += Math.sin(p.age[i] * 2.3 + i) * d.sway * dt;
        p.spin.array[i] = d.streak ? Math.atan2(v[i3], v[i3 + 1]) : p.spin.array[i] + p.spinRate[i] * dt;   // streaks point along their flight
        if (d.atlas) p.frame.array[i] = t * (ATLAS_GRID * ATLAS_GRID - 1.01);
        pos[i3] += v[i3] * dt; pos[i3 + 1] += v[i3 + 1] * dt; pos[i3 + 2] += v[i3 + 2] * dt;
        size[i] = p.base[i] * (1 + (d.grow || 0) * t);
        alpha[i] = Math.min(1, t * 10, d.shape === 'smoke' ? Math.pow(1 - t, 1.4) * 1.6 : (1 - t) * 2.5) * (d.alpha ?? 1);
      }
      p.geometry.setDrawRange(0, p.n); p.points.visible = p.n > 0;
      if (p.n) for (const a of [p.position, p.tint, p.size, p.alpha, p.spin, p.frame]) { a.clearUpdateRanges?.(); a.addUpdateRange?.(0, p.n * a.itemSize); a.needsUpdate = true; }
    }
    for (const [object, p] of pulses) {
      p.t += dt * 1000;
      const k = p.t >= p.ms ? 1 : 1 + (p.scale - 1) * Math.sin(Math.PI * p.t / p.ms);
      object.scale.copy(p.base).multiplyScalar(k);
      if (p.t >= p.ms) pulses.delete(object);
    }
  }

  function dispose() {
    offQuality(); emitters.clear();
    for (const [object, p] of pulses) object.scale.copy(p.base);
    pulses.clear();
    while (outlines.length) outlines[0].remove();
    for (const material of shellMaterials.values()) material.dispose();
    shellMaterials.clear();
    for (const p of Object.values(pools)) { p.points.removeFromParent(); p.geometry.dispose(); if (!p.def.atlas) p.material.uniforms.map.value.dispose(); p.material.dispose(); }
    live = 0;
  }

  return { burst, emitter, pulse, outline, update, dispose };
}

// --- DOM: chip bay và số nổi (chuyển từ flyReward/transient của farm/ui.js) ---
const chips = new Set();
function chip(text, point) {
  const el = document.createElement('span');
  el.className = 'vfx-chip farm-reward-flight'; el.setAttribute('aria-hidden', 'true');
  el.textContent = text; el.style.left = `${point.x}px`; el.style.top = `${point.y}px`;
  document.body.append(el); chips.add(el);
  return el;
}
function release(el) { el.remove(); chips.delete(el); }

// amount/format (tuỳ chọn) cho phép cộng dồn khi vượt giới hạn chip, ví dụ "🪙 +12" thành "🪙 +20".
export function flyTo(from, targetEl, { icon = '', text = '', amount, format = String } = {}) {
  const label = `${icon}${icon && text ? ' ' : ''}${text}`;
  if (chips.size >= QUALITY[quality].chips && typeof amount === 'number') {
    for (const el of chips) {
      if (el._fly?.target !== targetEl || el._fly.icon !== icon || typeof el._fly.amount !== 'number') continue;
      el._fly.amount += amount;
      el.textContent = `${icon}${icon ? ' ' : ''}+${format(el._fly.amount)}`;
      return;
    }
  }
  const start = from || { x: innerWidth / 2, y: innerHeight / 2 };
  const rect = targetEl?.isConnected ? targetEl.getBoundingClientRect() : null;
  const destination = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: start.x, y: start.y - 120 };
  const el = chip(label, start);
  el._fly = { target: targetEl, icon, amount };
  const dx = destination.x - start.x, dy = destination.y - start.y;
  const animation = el.animate([
    { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' },
    { offset: .15, opacity: 1, transform: 'translate(-50%,-120%) scale(1.1)' },
    { offset: .55, opacity: 1, transform: `translate(calc(-50% + ${dx * .4}px),calc(-50% + ${Math.min(-65, dy * .6)}px)) scale(.95)` },
    { opacity: .1, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.35)` }
  ], { duration: reducedMotion() ? 500 : 850, easing: 'cubic-bezier(.25,.65,.35,1)' });
  animation.onfinish = animation.oncancel = () => {
    release(el);
    if (rect && targetEl.isConnected && !reducedMotion()) targetEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.13)' }, { transform: 'scale(1)' }], { duration: 230 });
  };
}

export function popNumber(text, at, tone = 'good') {
  const el = chip(text, at || { x: innerWidth / 2, y: innerHeight / 2 });
  el.dataset.tone = tone;
  const rise = reducedMotion() ? '-110%' : '-160%';
  const animation = el.animate([{ opacity: 1, transform: 'translate(-50%,-90%)' }, { opacity: 0, transform: `translate(-50%,${rise})` }], { duration: 650, easing: 'ease-out' });
  animation.onfinish = animation.oncancel = () => release(el);
}

const shaking = new WeakMap();
export function shake(strength = 1, target = '#game canvas') {
  if (!QUALITY[quality].shake || reducedMotion()) return;
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  const a = Math.min(6, 4 * Math.max(0, strength));
  shaking.get(el)?.cancel();
  shaking.set(el, el.animate([
    { transform: 'translate(0,0)' }, { transform: `translate(${a}px,${-a * .5}px)` }, { transform: `translate(${-a * .8}px,${a * .4}px)` },
    { transform: `translate(${a * .5}px,${a * .3}px)` }, { transform: 'translate(0,0)' }
  ], { duration: Math.min(300, 160 + 80 * strength), easing: 'ease-out' }));
}
