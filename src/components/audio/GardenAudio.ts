import Phaser from 'phaser';
import type { GardenView } from '../../gameplay/story/GardenService';

/** Each stone's notes (pentatonic, so every catch sounds right with the music). */
const STONE_NOTE: Record<string, number> = { stone_sight: 523.25, stone_hearing: 659.25, stone_touch: 783.99 };

/**
 * Chapter-2 garden sound, synthesised with Web Audio: a slow harp-like loop,
 * a note for every spark caught (rising as a stone fills), a chord when a
 * stone wakes and a fanfare when the heaven door opens. Follows the global mute;
 * resumes the audio context on the first gesture, like the run's audio.
 */
export class GardenAudio {
  private readonly ctx: AudioContext | null;
  private readonly out: GainNode | null = null;
  private timer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private seen = 0;
  private readonly resume = () => { if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume(); };

  constructor(private readonly scene: Phaser.Scene) {
    const sm = scene.sound;
    this.ctx = sm instanceof Phaser.Sound.WebAudioSoundManager ? sm.context : null;
    if (!this.ctx) return;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.ratio.value = 6;
    limiter.connect(this.ctx.destination);
    this.out = this.ctx.createGain();
    this.out.connect(limiter);
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) window.addEventListener(ev, this.resume, { capture: true });
    this.nextNote = this.ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  sync(v: GardenView | null): void {
    if (!this.ctx || !this.out) return;
    this.out.gain.value = this.scene.sound.mute ? 0 : 2;
    if (!v) return;
    // Events are kept ~1.5 s; play each one once (they only ever grow at the end).
    const fresh = v.events.filter((e) => e.at > this.seen);
    for (const e of fresh) {
      const base = STONE_NOTE[e.stone ?? ''] ?? 659.25;
      if (e.kind === 'spark') {
        const caught = v.sparks.filter((s) => s.stone === e.stone && s.caught).length;
        this.note(base * 2 ** (caught * 2 / 12), 0.5, 'triangle', 0.22);
        this.note(base * 2, 0.25, 'sine', 0.08, 0.05);
      } else if (e.kind === 'stone') {
        [1, 1.26, 1.5, 2].forEach((m, i) => this.note(base * m, 1.4, 'triangle', 0.16, i * 0.06));
      } else if (e.kind === 'open') {
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => this.note(f, 1.6, 'sine', 0.14, i * 0.1));
      }
    }
    if (fresh.length) this.seen = Math.max(...fresh.map((e) => e.at));
  }

  /** Gentle arpeggio over a slow chord change. */
  private schedule(): void {
    const ctx = this.ctx!;
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
    if (!ctx || !this.out) return;
    const t = ctx.currentTime + Math.max(0, delay);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + len + 0.02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  destroy(): void {
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) window.removeEventListener(ev, this.resume, { capture: true });
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.out?.disconnect();
  }
}
