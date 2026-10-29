import Phaser from 'phaser';
import type { StreetView } from '../../gameplay/story/StreetService';
import type { HazardKind, RunView } from '../../gameplay/story/RunService';

/**
 * Chapter-1 run sound, synthesised with Web Audio (no files): a cue for every
 * telegraph and impact, a death sting, and a cheerful loop that speeds up as
 * the run gets harder. Follows Phaser's global mute (`scene.sound.mute`).
 */
const OUT_GAIN = 2.2;

export class RunAudio {
  private readonly ctx: AudioContext | null;
  private readonly out: GainNode | null = null;
  private readonly music: GainNode | null = null;
  private readonly limiter: DynamicsCompressorNode | null = null;
  private readonly seen = new Map<number, string>();
  private dying = false;
  private timer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private bpm = 112;
  private paused = false;
  private readonly voices = new Set<OscillatorNode | AudioBufferSourceNode>();
  private lastFoot = 0;
  private lastStreet = 0;
  private lastSiren = 0;
  private carried = false;
  private loaded = false;
  private portal = false;
  private wheel = false;
  private boom = false;
  private readonly visibility = () => {
    if (document.hidden) { this.stopVoices(); this.out?.gain.setValueAtTime(0, this.ctx!.currentTime); }
    if (this.ctx) this.nextNote = this.ctx.currentTime + .1;
  };
  /**
   * Browsers only start audio from a user gesture. Phaser waits for a `mousedown`
   * on the page, but its own pointer handling suppresses that event, so a tap
   * never unlocked sound: resume the context on any pointer / key / touch ourselves.
   */
  private readonly resume = () => { if (this.ctx && !document.hidden && this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined); };

  constructor(private readonly scene: Phaser.Scene) {
    const sm = scene.sound;
    this.ctx = sm instanceof Phaser.Sound.WebAudioSoundManager ? sm.context : null;
    if (!this.ctx) return;
    // Loud enough for laptop and phone speakers (measured: the first mix sat near -37 dB RMS and
    // read as silence); a compressor keeps the peaks from clipping when several cues overlap.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 6;
    this.limiter.connect((sm as Phaser.Sound.WebAudioSoundManager).destination);
    this.out = this.ctx.createGain();
    this.out.gain.value = OUT_GAIN;
    this.out.connect(this.limiter);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.32;
    this.music.connect(this.out);
    document.addEventListener('visibilitychange', this.visibility);
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) window.addEventListener(ev, this.resume, { capture: true });
  }

  /** Called every frame with the run's view: plays what changed. */
  sync(run: RunView | null, street: StreetView | null = null, moving = false, paused = false): void {
    if (!this.ctx || !this.out) return;
    if (paused && !this.paused) this.stopVoices();
    this.paused = paused;
    this.out.gain.value = this.scene.sound.mute || paused || document.hidden ? 0 : OUT_GAIN;
    if (!run) return;
    if (street && !paused && !document.hidden) {
      const now = street.elapsedMs;
      if (moving && !run.hit && !run.down && now - this.lastFoot > 330) {
        this.lastFoot = now; this.noise(.035, .035, 'lowpass', 650, 300);
      }
      if (now - this.lastStreet > 6500) {
        this.lastStreet = now;
        this.noise(1.4, .025, 'lowpass', 450, 220);
        this.glide(180, 95, 1.1, 'triangle', .02);
      }
      const van = street.npcs.find(n => n.look === 'ambulance');
      if (van?.moving && now - this.lastSiren > 1500) {
        this.lastSiren = now;
        this.glide(620, 860, .45, 'sine', .07);
        this.glide(860, 620, .45, 'sine', .07, .45);
      }
      if (street.carried && !this.carried) this.tone(330, .12, 'triangle', .09);
      if (street.heroHidden && !this.loaded) this.thud();
      if (street.wheel && !this.wheel) this.glide(450, 180, .5, 'triangle', .08);
      if (street.boom && !this.boom) this.thud();
      if (street.portal && !this.portal) [330, 440, 660].forEach((f, i) => this.tone(f, .8, 'sine', .07, i * .12));
      this.carried = street.carried; this.loaded = street.heroHidden;
      this.wheel = !!street.wheel; this.boom = !!street.boom; this.portal = !!street.portal;
    }
    // Music starts as soon as the street is on screen, before the first move. If the browser holds
    // sound back until a gesture, the context resumes on the first key / tap (see `resume`).
    if (run.running && this.timer === null) this.startMusic();
    this.bpm = 112 + Math.min(1, run.aliveMs / 90000) * 44;
    if (run.paused || paused || document.hidden) return;
    for (const h of run.hazards) {
      const prev = this.seen.get(h.id);
      if (prev === h.phase) continue;
      this.seen.set(h.id, h.phase);
      if (h.phase === 'warn') this.warn(h.kind);
      else if (h.phase === 'active' && prev === 'warn') this.activate(h.kind);
    }
    if (this.seen.size > 64) for (const id of [...this.seen.keys()].slice(0, 32)) this.seen.delete(id);
    // A knock-out: the gag's own sound, then "wah wah wah".
    const ko = run.hit?.kind;
    if (ko && !this.dying) {
      this.dying = true;
      this.stopMusic();
      this.die(ko);
    } else if (!run.hit && !run.down && run.running) this.dying = false;
  }

  private warn(k: HazardKind): void {
    switch (k) {
      case 'cat': return this.glide(700, 1150, 0.18, 'sine', 0.22, 600);
      case 'dog': this.bark(0); return this.bark(0.22);
      case 'sinkhole': return this.noise(0.5, 0.3, 'lowpass', 900, 300);
      case 'durian': return this.glide(1300, 420, 0.95, 'sine', 0.12);
      case 'motorbike': this.tone(520, 0.12, 'square', 0.1); return this.tone(520, 0.12, 'square', 0.1, 0.18);
      case 'pigeons': for (let i = 0; i < 6; i++) this.noise(0.05, 0.12, 'bandpass', 2200, 2200, i * 0.07); return;
      case 'banana': return this.glide(500, 760, 0.08, 'triangle', 0.08);
      case 'water':
      case 'laundry': return this.glide(1100, 500, 0.6, 'sine', 0.1);
      case 'shuttlecock': return this.tone(880, 0.06, 'triangle', 0.12);
      case 'slipper': return this.noise(0.15, 0.2, 'bandpass', 1500, 900);
      // Clucking: three short squawks.
      case 'chickens': for (let i = 0; i < 3; i++) this.glide(700, 1100, 0.07, 'square', 0.06, i * 0.12); return;
    }
  }

  private activate(k: HazardKind): void {
    if (k === 'sinkhole') { this.noise(0.35, 0.4, 'lowpass', 600, 120); this.glide(90, 45, 0.4, 'sine', 0.35); }
    if (k === 'durian') this.thud();
    if (k === 'dog') this.bark(0);
    if (k === 'motorbike') this.glide(110, 170, 1.2, 'sawtooth', 0.06);
  }

  private die(k: HazardKind): void {
    if (k === 'sinkhole') this.glide(900, 70, 1.2, 'sine', 0.3);
    else if (k === 'pigeons' || k === 'motorbike') this.glide(300, 1200, 0.9, 'triangle', 0.22);
    else if (k === 'banana') { this.glide(300, 900, 0.3, 'sine', 0.2); this.thud(0.5); }
    else if (k === 'cat') {
      // Hiss, then scratch, scratch, scratch.
      this.noise(0.35, 0.3, 'highpass', 3000, 5000);
      for (let i = 0; i < 4; i++) this.noise(0.07, 0.35, 'bandpass', 2600, 1400, 0.3 + i * 0.26);
    } else if (k === 'dog') {
      // Growl and chomp.
      this.glide(95, 80, 0.5, 'sawtooth', 0.18);
      for (let i = 0; i < 3; i++) { this.bark(0.4 + i * 0.3); this.noise(0.05, 0.4, 'lowpass', 1200, 400, 0.45 + i * 0.3); }
    } else this.thud();
    // "Wah wah wah wahhh."
    [392, 370, 349, 330].forEach((f, i) => this.glide(f, i === 3 ? f * 0.8 : f, i === 3 ? 0.7 : 0.24, 'sawtooth', 0.09, 0.9 + i * 0.27));
  }

  // ── music ───────────────────────────────────────────────────────────────

  private startMusic(): void {
    if (!this.ctx) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private stopMusic(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** A sunny pentatonic loop: bass on the beat, a bouncy melody, hats on the offbeat. */
  private schedule(): void {
    const ctx = this.ctx!;
    if (this.paused || document.hidden || this.scene.sound.mute || ctx.state !== 'running') { this.nextNote = ctx.currentTime + .1; return; }
    this.nextNote = Math.max(this.nextNote, ctx.currentTime);
    const MEL = [0, 2, 4, 7, 9, 7, 4, 2, 4, 7, 9, 12, 9, 7, 4, -1];
    const BASS = [0, 0, 7, 7, 5, 5, 7, 4];
    const root = 262;
    const f = (semi: number) => root * 2 ** (semi / 12);
    while (this.nextNote < ctx.currentTime + 0.15) {
      const dur = 60 / this.bpm / 2;
      const s = this.step % 16;
      const at = this.nextNote - ctx.currentTime;
      if (MEL[s]! >= 0) this.tone(f(MEL[s]!), dur * 0.8, 'triangle', 0.5, at, this.music!);
      // Triangle bass: its overtones reach small speakers, a pure low sine does not.
      if (s % 2 === 0) this.tone(f(BASS[(s / 2) % 8]! - 12), dur * 1.6, 'triangle', 0.6, at, this.music!);
      else this.noise(0.03, 0.18, 'highpass', 6000, 6000, at, this.music!);
      this.nextNote += dur;
      this.step++;
    }
  }

  // ── synth helpers ───────────────────────────────────────────────────────

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, dest: AudioNode = this.out!): void {
    this.glide(freq, freq, dur, type, vol, delay, dest);
  }

  private glide(from: number, to: number, dur: number, type: OscillatorType, vol: number, delay = 0, dest: AudioNode = this.out!): void {
    const ctx = this.ctx;
    if (!ctx || this.paused || document.hidden || this.scene.sound.mute || ctx.state !== 'running') return;
    const t = ctx.currentTime + Math.max(0, delay);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    this.voices.add(o);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); };
  }

  private noise(dur: number, vol: number, kind: BiquadFilterType, from: number, to: number, delay = 0, dest: AudioNode = this.out!): void {
    const ctx = this.ctx;
    if (!ctx || this.paused || document.hidden || this.scene.sound.mute || ctx.state !== 'running') return;
    const t = ctx.currentTime + Math.max(0, delay);
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf;
    flt.type = kind;
    flt.frequency.setValueAtTime(from, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(dest);
    this.voices.add(src);
    src.start(t);
    src.onended = () => { this.voices.delete(src); src.disconnect(); flt.disconnect(); g.disconnect(); };
  }

  private bark(delay: number): void {
    this.glide(420, 200, 0.12, 'square', 0.16, delay);
    this.noise(0.1, 0.18, 'bandpass', 900, 500, delay);
  }

  private thud(delay = 0): void {
    this.glide(140, 45, 0.3, 'sine', 0.5, delay);
    this.noise(0.12, 0.25, 'lowpass', 500, 100, delay);
  }

  private stopVoices(): void {
    for (const voice of this.voices) { try { voice.stop(); } catch { /* already ended */ } }
    this.voices.clear();
  }

  destroy(): void {
    document.removeEventListener('visibilitychange', this.visibility);
    this.stopVoices();
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) window.removeEventListener(ev, this.resume, { capture: true });
    this.stopMusic();
    this.music?.disconnect();
    this.out?.disconnect();
    this.limiter?.disconnect();
  }
}
