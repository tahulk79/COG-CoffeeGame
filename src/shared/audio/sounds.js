// Sổ âm: id → { bus, synth, file?, volume, maxInstances = 4, cooldownMs = 40, spatial?, vary? }.
// synth(v, t, { param }) dựng node qua v.node(...), phát nguồn qua v.src(...), nối vào v.out; ≤ 6 node mỗi tiếng.
// Loop trả về { set({ rate, param }, t), stop() }. Thêm `file: 'cafe/door'` (không đuôi, gốc public/audio/) để thay bằng âm thật.
// vary = độ lệch cao độ ngẫu nhiên (vd. 0.04 = ±4%) cho tiếng lặp lại; bỏ trống với tiếng có cao độ âm nhạc.

const N = { G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093, E7: 2637, G7: 3136 };

// Bao âm: lên nhanh, tắt dần theo hàm mũ. pulses > 1 thì lặp bao trong dur (rung biên độ, tick, búa).
function envelope(param, t, dur, peak, attack, pulses = 1) {
  const step = dur / pulses;
  for (let i = 0; i < pulses; i += 1) {
    const s = t + i * step;
    param.setValueAtTime(0.0001, s);
    param.linearRampToValueAtTime(peak, s + Math.min(attack, step / 3));
    param.exponentialRampToValueAtTime(0.0001, s + step);
  }
}

// Dao động đơn: osc (+ lọc thấp) → gain → out. 2–3 node.
function tone(v, t, { type = 'sine', f, f1 = f, dur, peak = 1, attack = 0.005, lp, pulses }) {
  const osc = v.node(OscillatorNode, { type, frequency: f * v.rate });
  if (f1 !== f) osc.frequency.exponentialRampToValueAtTime(f1 * v.rate, t + dur);
  const gain = v.node(GainNode, { gain: 0 });
  envelope(gain.gain, t, dur, peak, attack, pulses);
  (lp ? osc.connect(v.node(BiquadFilterNode, { type: 'lowpass', frequency: lp })) : osc).connect(gain).connect(v.out);
  v.src(osc, t, t + dur + 0.02);
  return osc;
}

// Nhiễu trắng → lọc (có thể quét f → f1) → gain → out. 3 node.
function noise(v, t, { type = 'lowpass', f, f1 = f, q = 1, dur, peak = 1, attack = 0.005, pulses }) {
  const src = v.node(AudioBufferSourceNode, { buffer: v.noise, loop: true });
  const filter = v.node(BiquadFilterNode, { type, frequency: f, Q: q });
  if (f1 !== f) filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const gain = v.node(GainNode, { gain: 0 });
  envelope(gain.gain, t, dur, peak, attack, pulses);
  src.connect(filter).connect(gain).connect(v.out);
  v.src(src, t, t + dur + 0.02, Math.random() * 1.5);
  return filter;
}

// Chuỗi chuông trên một osc + một gain (2 node), đổi tần số khi gain đã tắt nên không lách cách.
function bells(v, t, freqs, step, { type = 'sine', decay = 0.3, peak = 1 } = {}) {
  const osc = v.node(OscillatorNode, { type, frequency: freqs[0] * v.rate });
  const gain = v.node(GainNode, { gain: 0 });
  freqs.forEach((f, i) => {
    const s = t + i * step;
    const last = i === freqs.length - 1;
    osc.frequency.setValueAtTime(f * v.rate, s);
    gain.gain.setValueAtTime(0.0001, s);
    gain.gain.linearRampToValueAtTime(peak, s + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, last ? s + decay : s + Math.min(decay, step) - 0.002);
  });
  osc.connect(gain).connect(v.out);
  const end = t + (freqs.length - 1) * step + decay + 0.02;
  v.src(osc, t, end);
  return end;
}

// Nhiễu chạy liên tục cho loop: src → lọc → gain → out. Không đặt stop; engine dừng khi stop().
function noiseLoop(v, t, { type, f, q = 1, peak = 1 }) {
  const src = v.node(AudioBufferSourceNode, { buffer: v.noise, loop: true });
  const filter = v.node(BiquadFilterNode, { type, frequency: f, Q: q });
  const gain = v.node(GainNode, { gain: 0 });
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.06);
  src.connect(filter).connect(gain).connect(v.out);
  v.src(src, t, null, Math.random() * 1.5);
  return { filter, gain };
}

const sparkle = (v, t, peak = 0.25) => bells(v, t, [N.C7, N.E7, N.G7], 0.05, { type: 'triangle', decay: 0.25, peak });

const sound = (bus, volume, synth, extra = {}) => ({ bus, volume, synth, ...extra });
const ui = (volume, synth) => sound('ui', volume, synth);
const sfx = (volume, synth, extra) => sound('sfx', volume, synth, extra);
const pending = (bus) => ({ bus, volume: 1 }); // nhạc/nền: chờ file thật (hàng đợi ở docs/asset-pipeline.md)

export const SOUNDS = {
  // UI
  'ui.click': ui(0.13, (v, t) => { tone(v, t, { type: 'triangle', f: 900, f1: 600, dur: 0.04 }); }),
  'ui.open': ui(0.22, (v, t) => {
    noise(v, t, { type: 'bandpass', f: 2000, q: 1.2, dur: 0.08, peak: 0.5 });
    tone(v, t, { f: 520, f1: 780, dur: 0.12, attack: 0.01 });
  }),
  'ui.close': ui(0.22, (v, t) => {
    noise(v, t, { type: 'bandpass', f: 2000, q: 1.2, dur: 0.08, peak: 0.5 });
    tone(v, t, { f: 780, f1: 520, dur: 0.12, attack: 0.01 });
  }),
  'ui.tab': ui(0.14, (v, t) => { tone(v, t, { type: 'triangle', f: 1200, dur: 0.025, attack: 0.002 }); }),
  'ui.deny': ui(0.2, (v, t) => { tone(v, t, { type: 'square', f: 220, f1: 180, dur: 0.12, lp: 900 }); }),
  'ui.buy': ui(0.22, (v, t) => { bells(v, t, [1320, 1760], 0.07, { decay: 0.25 }); }),

  // Xu và thưởng
  'coin.gain': sfx(0.22, (v, t) => { bells(v, t, [N.E6, N.G6, N.C7], 0.05, { decay: 0.22 }); }),
  'coin.spend': sfx(0.25, (v, t) => { bells(v, t, [622], 0, { type: 'triangle', decay: 0.3 }); }),
  'reward.quest': sfx(0.28, (v, t) => {
    bells(v, t, [N.C5, N.E5, N.G5, N.C6], 0.09, { decay: 0.5 });
    sparkle(v, t + 0.3);
  }),
  'reward.levelup': sfx(0.3, (v, t) => {
    bells(v, t, [N.C5, N.E5, N.G5, N.C6, N.E5, N.G5, N.C6, N.E6], 0.1, { decay: 0.9 });
    sparkle(v, t + 0.75, 0.3);
  }, { cooldownMs: 400 }),

  // Farm
  'farm.plant': sfx(0.5, (v, t) => {
    noise(v, t, { f: 400, dur: 0.12 });
    tone(v, t, { f: 140, f1: 90, dur: 0.12, peak: 0.6 });
  }, { vary: 0.06 }),
  'farm.water': sfx(0.35, (v, t) => { noise(v, t, { type: 'bandpass', f: 1500, f1: 500, q: 1.5, dur: 0.3, attack: 0.03 }); }, { vary: 0.05 }),
  'farm.fertilize': sfx(0.3, (v, t) => { noise(v, t, { type: 'highpass', f: 2500, dur: 0.2, pulses: 6, attack: 0.002 }); }, { vary: 0.05 }),
  'farm.weed': sfx(0.25, (v, t) => { noise(v, t, { type: 'highpass', f: 3000, dur: 0.25, pulses: 7 }); }, { vary: 0.05 }),
  'farm.prune': sfx(0.3, (v, t) => { noise(v, t, { type: 'bandpass', f: 3000, q: 3, dur: 0.14, pulses: 2, attack: 0.001 }); }, { vary: 0.05 }),
  'farm.clear': sfx(0.6, (v, t) => {
    tone(v, t, { f: 90, f1: 50, dur: 0.25 });
    noise(v, t, { f: 300, dur: 0.2, peak: 0.7 });
  }, { vary: 0.05 }),
  'farm.harvest': sfx(0.35, (v, t) => {
    tone(v, t, { f: 400, f1: 900, dur: 0.05, peak: 0.7 });
    bells(v, t + 0.04, [N.C5, N.E5, N.G5], 0.06, { decay: 0.25 });
  }),
  'farm.refill': sfx(0.3, (v, t) => { noise(v, t, { type: 'bandpass', f: 400, f1: 1500, q: 1.5, dur: 0.5, attack: 0.08 }); }, { vary: 0.04 }),
  'farm.process': sfx(0.28, (v, t) => { tone(v, t, { type: 'sawtooth', f: 80, f1: 120, dur: 0.4, lp: 500, attack: 0.05 }); }),
  'farm.turn': sfx(0.3, (v, t) => { noise(v, t, { f: 2000, f1: 600, dur: 0.3, attack: 0.04 }); }, { vary: 0.05 }),
  'farm.ready': sfx(0.3, (v, t) => { bells(v, t, [N.G6, N.G6], 0.18, { decay: 0.4 }); }, { spatial: true, cooldownMs: 200 }),
  'farm.collect': sfx(0.4, (v, t) => {
    noise(v, t, { f: 250, dur: 0.15 });
    bells(v, t + 0.08, [N.G5, N.C6], 0.08, { decay: 0.25, peak: 0.7 });
  }),
  'farm.build': sfx(0.45, (v, t) => {
    noise(v, t, { type: 'bandpass', f: 1200, q: 2, dur: 0.45, pulses: 3, attack: 0.001 });
    bells(v, t + 0.5, [N.C6], 0, { decay: 0.5, peak: 0.6 });
  }),
  'farm.ship': sfx(0.4, (v, t) => { noise(v, t, { f: 250, dur: 0.4, attack: 0.08 }); }, { vary: 0.05 }),
  'farm.arrive': sfx(0.25, (v, t) => { bells(v, t, [1760, 1760], 0.12, { type: 'triangle', decay: 0.3 }); }),

  // Quán
  'cafe.door': sfx(0.3, (v, t) => { bells(v, t, [N.E6, N.C6], 0.2, { decay: 0.6 }); }, { spatial: true, cooldownMs: 150 }),
  'cafe.order': sfx(0.12, (v, t) => { tone(v, t, { type: 'square', f: 2000, dur: 0.18, pulses: 3, lp: 4000, attack: 0.002 }); }, { spatial: true }),
  'cafe.cup': sfx(0.2, (v, t) => {
    tone(v, t, { f: 2400, dur: 0.15, attack: 0.001 });
    tone(v, t, { f: 3100, dur: 0.1, attack: 0.001, peak: 0.6 });
  }, { vary: 0.03 }),
  'cafe.serve': sfx(0.25, (v, t) => {
    tone(v, t, { f: 150, f1: 90, dur: 0.06 });
    tone(v, t + 0.05, { f: 2400, dur: 0.15, attack: 0.001, peak: 0.7 });
    tone(v, t + 0.05, { f: 3100, dur: 0.1, attack: 0.001, peak: 0.4 });
  }),
  'cafe.angry': sfx(0.3, (v, t) => { tone(v, t, { type: 'sawtooth', f: 150, f1: 110, dur: 0.25, lp: 600 }); }, { spatial: true }),
  'cafe.clean': sfx(0.12, (v, t) => {
    tone(v, t, { f: 1800, f1: 2400, dur: 0.12, attack: 0.02 });
    tone(v, t + 0.16, { f: 1800, f1: 2400, dur: 0.12, attack: 0.02 });
  }, { spatial: true }),
  'cafe.call': sfx(0.28, (v, t) => { bells(v, t, [N.E5, N.C5], 0.3, { decay: 0.7 }); }, { cooldownMs: 300 }),
  'cafe.shift-good': sfx(0.3, (v, t) => { bells(v, t, [N.C5, N.E5, N.G5, N.C6, N.E6], 0.1, { decay: 0.6 }); }),
  'cafe.shift-bad': sfx(0.3, (v, t) => { bells(v, t, [N.G4, 311], 0.25, { type: 'triangle', decay: 0.5 }); }),

  // Quầy pha
  'bench.grind': sfx(0.22, (v, t) => { tone(v, t, { type: 'sawtooth', f: 180, dur: 0.6, lp: 900, pulses: 12, attack: 0.01 }); }, { vary: 0.04 }),
  'bench.pour': sfx(0.3, (v, t, { param = 0 }) => {
    const { filter } = noiseLoop(v, t, { type: 'bandpass', f: 600 + 1200 * param, q: 2 });
    return { set: ({ param: p }, at) => { if (p != null) filter.frequency.setTargetAtTime(600 + 1200 * clamp(p), at, 0.05); } };
  }),
  'bench.steam': sfx(0.3, (v, t, { param = 0 }) => {
    const { filter, gain } = noiseLoop(v, t, { type: 'highpass', f: 2000 + 3000 * param, peak: 0.3 + 0.7 * param });
    return {
      set: ({ param: p }, at) => {
        if (p == null) return;
        filter.frequency.setTargetAtTime(2000 + 3000 * clamp(p), at, 0.08);
        gain.gain.setTargetAtTime(0.3 + 0.7 * clamp(p), at, 0.08);
      },
    };
  }),
  'bench.whisk': sfx(0.25, (v, t) => {
    const { gain } = noiseLoop(v, t, { type: 'bandpass', f: 1500, q: 1.5, peak: 0.5 });
    const lfo = v.node(OscillatorNode, { frequency: 8 });
    lfo.connect(v.node(GainNode, { gain: 0.45 })).connect(gain.gain);
    v.src(lfo, t, null);
  }),
  'bench.extract': sfx(0.3, (v, t) => {
    const hum = v.node(OscillatorNode, { type: 'sawtooth', frequency: 50 });
    hum.connect(v.node(BiquadFilterNode, { type: 'lowpass', frequency: 220 })).connect(v.out);
    v.src(hum, t, null);
    noiseLoop(v, t, { type: 'bandpass', f: 2500, q: 1.5, peak: 0.35 });
  }),
  'bench.scoop': sfx(0.22, (v, t) => { noise(v, t, { type: 'bandpass', f: 3000, q: 1.5, dur: 0.15, pulses: 5, attack: 0.002 }); }, { vary: 0.06, cooldownMs: 100 }),
  'bench.band': sfx(0.18, (v, t) => { tone(v, t, { f: 1600, dur: 0.07 }); }, { cooldownMs: 150 }),
  'bench.over': sfx(0.4, (v, t) => { tone(v, t, { f: 160, f1: 80, dur: 0.15 }); }, { cooldownMs: 150 }),
  'bench.good': sfx(0.28, (v, t) => { bells(v, t, [N.G5, N.C6], 0.08, { decay: 0.25 }); }),
  'bench.bad': sfx(0.32, (v, t) => { tone(v, t, { type: 'triangle', f: 140, f1: 120, dur: 0.25, lp: 400 }); }),
  'bench.wait': sfx(0.2, (v, t) => {
    const osc = v.node(OscillatorNode, { frequency: 1100 });
    const gain = v.node(GainNode, { gain: 0 });
    osc.connect(gain).connect(v.out);
    v.src(osc, t, null);
    const drop = () => {
      const s = v.time();
      const f = 900 + Math.random() * 400;
      osc.frequency.setValueAtTime(f, s);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, s + 0.08);
      envelope(gain.gain, s, 0.1, 1, 0.003);
    };
    drop();
    const timer = setInterval(drop, 300);
    return { stop: () => clearInterval(timer) };
  }),
  'bench.star': sfx(0.3, (v, t) => { bells(v, t, [N.C6], 0, { decay: 0.45 }); sparkle(v, t + 0.05, 0.15); }, { cooldownMs: 0, maxInstances: 6 }),

  // Nhạc và nền: chưa có file nên không phát (hasContent = false).
  'music.farm': pending('music'),
  'music.cafe': pending('music'),
  'amb.farm': pending('ambience'),
  'amb.rain': pending('ambience'),
  'amb.cafe': pending('ambience'),
};

function clamp(value) { return Math.min(1, Math.max(0, value)); }
