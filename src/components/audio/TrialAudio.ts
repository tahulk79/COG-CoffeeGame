import type Phaser from 'phaser';
import type { TrialView } from '../../gameplay/story/TrialService';
import { SynthAudio } from './SynthAudio';

/**
 * Chapter-2 road sound, synthesised with Web Audio: a slow harp-like loop, a
 * bell for a good reply, a "toẹt" for a wrong one, a boing for a silly one, a
 * soft run as a cloud wall melts, ticks while the rebirth wheel spins and a
 * fanfare when the door opens. The Web Audio frame (mute, unlock, voices) is `SynthAudio`.
 */
export class TrialAudio extends SynthAudio {
  private timer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private seen = new Set<string>();
  private readonly music: GainNode | null = null;

  constructor(scene: Phaser.Scene) {
    // Measured: the street (chapter 1) sits near -25 dBFS RMS, the island's music was near -31: this lifts it to meet the street.
    super(scene, 2.8);
    if (!this.ctx || !this.out) return;
    this.music = this.ctx.createGain();
    // The music comes in over a few seconds (it used to start at full level the moment the chapter loaded).
    const now = this.ctx.currentTime;
    this.music.gain.setValueAtTime(0, now);
    this.music.gain.linearRampToValueAtTime(.28, now + 3.5);
    this.music.connect(this.out);
    this.startAir(now);
    this.nextNote = this.ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  private air: { src: AudioBufferSourceNode; lfo: OscillatorNode } | null = null;

  /**
   * The sky's breath under the harp. It begins as the street's rumble (same noise, same filter, same level) and, over several
   * seconds, thins into a soft wind: the one sound carries the player from chapter 1 into chapter 2. It also fills the silences
   * between notes, which sat 40 dB down while the street never went below -29.
   */
  private startAir(now: number): void {
    const noise = this.loopedNoise('lowpass', 380, .7), ctx = this.ctx;
    if (!noise || !ctx) return;
    // Up from nearly nothing to the street's level over a second (the street was still fading out behind the loading screen), then thinning.
    noise.gain.gain.setValueAtTime(.002, now);
    noise.gain.gain.exponentialRampToValueAtTime(.05, now + 1.2);
    noise.gain.gain.exponentialRampToValueAtTime(.02, now + 8);
    noise.flt.frequency.setValueAtTime(380, now);
    noise.flt.frequency.exponentialRampToValueAtTime(900, now + 8);
    // A slow swell, like gusts.
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = .07; depth.gain.value = 160;
    lfo.connect(depth).connect(noise.flt.detune);
    lfo.start(now);
    this.air = { src: noise.src, lfo };
  }

  protected override onVisibility(): void {
    if (this.ctx) this.nextNote = this.ctx.currentTime + .1;
  }

  sync(v: TrialView | null, paused = false): void {
    if (!this.gate(paused) || !v) return;
    // Consume cues even while silent, so unmuting never plays an old reward or missed ticks.
    const id = (e: TrialView['events'][number]) => `${e.at}:${e.kind}:${e.station ?? ''}`;
    const fresh = v.events.filter((e) => !this.seen.has(id(e)));
    this.seen = new Set(v.events.map(id));
    if (this.silent) return;
    for (const e of fresh) {
      if (e.kind === 'right') [1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, 1.1, 'sine', 0.16, i * 0.07));
      else if (e.kind === 'wrong') this.glide(320, 90, 0.45, 'sawtooth', 0.12);
      else if (e.kind === 'funny') { this.glide(260, 620, 0.18, 'square', 0.07); this.glide(620, 300, 0.22, 'square', 0.06, 0.18); }
      else if (e.kind === 'clear') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.12, 0.2 + i * 0.05));
      else if (e.kind === 'lesson') [783.99, 1174.66].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.1, 0.6 + i * 0.12));
      else if (e.kind === 'tick') this.tone(1760, 0.05, 'square', 0.05);
      else if (e.kind === 'land') [523.25, 659.25, 783.99, 1046.5].forEach((f) => this.tone(f, 1.4, 'triangle', 0.13));
      else if (e.kind === 'open') [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, 1.6, 'sine', 0.14, i * 0.1));
    }
  }

  /** Gentle arpeggio over a slow chord change. */
  private schedule(): void {
    const ctx = this.ctx!;
    if (this.silent) { this.nextNote = ctx.currentTime + .1; return; }
    this.nextNote = Math.max(this.nextNote, ctx.currentTime);
    const CHORDS = [[0, 4, 7, 12], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]];
    const root = 261.63;
    while (this.nextNote < ctx.currentTime + 0.2) {
      const dur = 0.32;
      const chord = CHORDS[Math.floor(this.step / 8) % CHORDS.length]!;
      const semi = chord[this.step % 4]! + (this.step % 8 >= 4 ? 12 : 0);
      const at = this.nextNote - ctx.currentTime;
      this.tone(root * 2 ** (semi / 12), 1.2, 'triangle', 0.09, at, this.music!);
      if (this.step % 8 === 0) this.tone(root * 2 ** ((chord[0]! - 12) / 12), 2.4, 'sine', 0.12, at, this.music!);
      this.nextNote += dur;
      this.step++;
    }
  }

  override destroy(): void {
    super.destroy();
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    for (const node of [this.air?.src, this.air?.lfo]) { try { node?.stop(); } catch { /* already stopped */ } node?.disconnect(); }
    this.air = null;
    this.music?.disconnect();
  }
}
