import Phaser from 'phaser';
import type { TrialView } from '../../gameplay/story/TrialService';

/**
 * Chapter-2 road sound, synthesised with Web Audio: a slow harp-like loop, a
 * bell for a good reply, a "toẹt" for a wrong one, a boing for a silly one, a
 * soft run as a cloud wall melts, ticks while the rebirth wheel spins and a
 * fanfare when the door opens. Follows the global mute; resumes the audio
 * context on the first gesture, like the run's audio.
 */
export class TrialAudio {
  private readonly ctx: AudioContext | null;
  private readonly out: GainNode | null = null;
  private timer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private seen = 0;
  private paused = false;
  private readonly voices = new Set<OscillatorNode>();
  private readonly limiter: DynamicsCompressorNode | null = null;
  private readonly resume = () => { if (this.ctx && !document.hidden && this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined); };

  constructor(private readonly scene: Phaser.Scene) {
    const sm = scene.sound;
    this.ctx = sm instanceof Phaser.Sound.WebAudioSoundManager ? sm.context : null;
    if (!this.ctx) return;
    const limiter = this.limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.ratio.value = 6;
    limiter.connect((sm as Phaser.Sound.WebAudioSoundManager).destination);
    this.out = this.ctx.createGain();
    this.out.connect(limiter);
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) window.addEventListener(ev, this.resume, { capture: true });
    this.nextNote = this.ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  sync(v: TrialView | null, paused = false): void {
    if (!this.ctx || !this.out) return;
    if ((paused || document.hidden) && !this.paused) this.stopVoices();
    this.paused = paused || document.hidden;
    this.out.gain.value = this.scene.sound.mute || document.hidden || paused ? 0 : 2;
    if (!v) return;
    // Events are kept ~1.5 s; play each one once (they only ever grow at the end).
    const fresh = v.events.filter((e) => e.at > this.seen);
    for (const e of fresh) {
      if (e.kind === 'right') [1046.5, 1318.5, 1568].forEach((f, i) => this.note(f, 1.1, 'sine', 0.16, i * 0.07));
      else if (e.kind === 'wrong') this.slide(320, 90, 0.45, 'sawtooth', 0.12);
      else if (e.kind === 'funny') { this.slide(260, 620, 0.18, 'square', 0.07); this.slide(620, 300, 0.22, 'square', 0.06, 0.18); }
      else if (e.kind === 'clear') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, 0.7, 'triangle', 0.12, 0.2 + i * 0.05));
      else if (e.kind === 'lesson') [783.99, 1174.66].forEach((f, i) => this.note(f, 0.6, 'sine', 0.1, 0.6 + i * 0.12));
      else if (e.kind === 'tick') this.note(1760, 0.05, 'square', 0.05);
      else if (e.kind === 'land') [523.25, 659.25, 783.99, 1046.5].forEach((f) => this.note(f, 1.4, 'triangle', 0.13));
      else if (e.kind === 'open') [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => this.note(f, 1.6, 'sine', 0.14, i * 0.1));
    }
    if (fresh.length) this.seen = Math.max(...fresh.map((e) => e.at));
  }

  /** Gentle arpeggio over a slow chord change. */
  private schedule(): void {
    const ctx = this.ctx!;
    if (this.paused || document.hidden || this.scene.sound.mute || ctx.state !== 'running') { this.nextNote = ctx.currentTime + .1; return; }
    this.nextNote = Math.max(this.nextNote, ctx.currentTime);
    const CHORDS = [[0, 4, 7, 12], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]];
    const root = 261.63;
    while (this.nextNote < ctx.currentTime + 0.2) {
      const dur = 0.32;
      const chord = CHORDS[Math.floor(this.step / 8) % CHORDS.length]!;
      const semi = chord[this.step % 4]! + (this.step % 8 >= 4 ? 12 : 0);
      const at = this.nextNote - ctx.currentTime;
      this.note(root * 2 ** (semi / 12), 1.2, 'triangle', 0.09, at);
      if (this.step % 8 === 0) this.note(root * 2 ** ((chord[0]! - 12) / 12), 2.4, 'sine', 0.12, at);
      this.nextNote += dur;
      this.step++;
    }
  }

  private note(freq: number, len: number, type: OscillatorType, vol: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || this.paused || this.scene.sound.mute || document.hidden || ctx.state !== 'running') return;
    const t = ctx.currentTime + Math.max(0, delay);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(this.out);
    this.voices.add(o);
    o.start(t);
    o.stop(t + len + 0.02);
    o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); };
  }

  /** A pitch glide (the "toẹt" and the boing). */
  private slide(from: number, to: number, len: number, type: OscillatorType, vol: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || this.paused || this.scene.sound.mute || document.hidden || ctx.state !== 'running') return;
    const t = ctx.currentTime + Math.max(0, delay);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(this.out);
    this.voices.add(o);
    o.start(t);
    o.stop(t + len + 0.02);
    o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); };
  }

  private stopVoices(): void {
    for (const voice of this.voices) { try { voice.stop(); } catch { /* already ended */ } }
    this.voices.clear();
  }

  destroy(): void {
    this.stopVoices();
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) window.removeEventListener(ev, this.resume, { capture: true });
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.out?.disconnect();
    this.limiter?.disconnect();
  }
}
