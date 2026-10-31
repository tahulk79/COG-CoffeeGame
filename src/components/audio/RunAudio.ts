import type Phaser from 'phaser';
import type { StreetView } from '../../gameplay/story/StreetService';
import type { HazardKind, RunView } from '../../gameplay/story/RunService';
import { SynthAudio } from './SynthAudio';

/**
 * Chapter-1 run sound, synthesised with Web Audio (no files): a cue for every
 * telegraph and impact, a death sting, and a cheerful loop that speeds up as
 * the run gets harder. The Web Audio frame (mute, unlock, voices) is `SynthAudio`.
 */
const OUT_GAIN = 2.2;

export class RunAudio extends SynthAudio {
  private readonly music: GainNode | null = null;
  private readonly seen = new Map<number, string>();
  private dying = false;
  private timer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private bpm = 112;
  private lastFoot = 0;
  private lastStreet = 0;
  private lastSiren = 0;
  private carried = false;
  private down = false;
  private loaded = false;
  private portal = false;
  private wheel = false;
  private boom = false;
  /** Street ambience: a looping bed of traffic noise whose level follows the vehicles near the hero, birds, and who is sounding a horn. */
  private bed: { sources: AudioBufferSourceNode[]; low: GainNode; hiss: GainNode } | null = null;
  private nextBird = 4000;
  private readonly honking = new Set<string>();
  constructor(scene: Phaser.Scene) {
    // Loud enough for laptop and phone speakers (measured: the first mix sat near -37 dB RMS and read as silence).
    super(scene, OUT_GAIN);
    if (!this.ctx || !this.out) return;
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.18;
    this.music.connect(this.out);
  }

  protected override onVisibility(): void {
    if (this.ctx) this.nextNote = this.ctx.currentTime + .1;
  }

  /** Called every frame with the run's view: plays what changed. */
  sync(run: RunView | null, street: StreetView | null = null, moving = false, paused = false, hero: { x: number; y: number } | null = null): void {
    if (!this.gate(paused)) return;
    if (!run) return;
    if (street && !paused && !document.hidden) {
      const now = street.elapsedMs;
      if (moving && !run.hit && !run.down && now - this.lastFoot > 330) {
        this.lastFoot = now; this.noise(.035, .035, 'lowpass', 650, 300);
      }
      if (hero) this.ambience(street, hero, now);
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
      // BÙM: the hero is knocked down on the street (a bike's crunch, a thud, a squeal of tyres).
      if (street.heroDown && !this.down) { this.thud(); this.noise(.3, .3, 'bandpass', 1800, 500); this.glide(900, 300, .25, 'sawtooth', .08); }
      this.down = street.heroDown;
      if (street.carried && !this.carried) this.tone(330, .12, 'triangle', .09);
      if (street.heroHidden && !this.loaded) this.thud();
      if (street.wheel && !this.wheel) this.glide(450, 180, .5, 'triangle', .08);
      if (street.boom && !this.boom) this.thud();
      if (street.portal && !this.portal) [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, .8, 'sine', .07, i * .12));
      this.carried = street.carried; this.loaded = street.heroHidden;
      this.wheel = !!street.wheel; this.boom = !!street.boom; this.portal = !!street.portal;
    }
    // Music starts as soon as the street is on screen, before the first move. If the browser holds
    // sound back until a gesture, the context resumes on the first key / tap (see `resume`).
    // No background music: only the street's own sounds.
    this.bpm = 84;
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
    else if (k === 'pigeons' || k === 'motorbike') { if (k === 'motorbike') this.thud(); this.glide(300, 1200, 0.9, 'triangle', 0.22); }
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
    // A gentle music-box lullaby in a major pentatonic: a few soft plucked notes with rests, high and short (no drones).
    const MEL = [0, -1, 4, -1, 7, -1, 4, -1, 9, -1, 7, -1, 4, -1, 2, -1, 0, -1, 4, -1, 7, -1, 9, -1, 12, -1, 9, -1, 7, -1, -1, -1];
    const root = 392;
    const f = (semi: number) => root * 2 ** (semi / 12);
    while (this.nextNote < ctx.currentTime + 0.15) {
      const dur = 60 / this.bpm / 2;
      const s = this.step % MEL.length;
      const at = this.nextNote - ctx.currentTime;
      if (MEL[s]! >= 0) { this.tone(f(MEL[s]!), dur * 3, 'sine', 0.45, at, this.music!); this.tone(f(MEL[s]!) * 2, dur * 1.2, 'sine', 0.08, at, this.music!); }
      if (s % 16 === 0) this.tone(f(0) / 2, dur * 8, 'sine', 0.25, at, this.music!);
      this.nextNote += dur;
      this.step++;
    }
  }

  // ── cues ────────────────────────────────────────────────────────────────

  private bark(delay: number): void {
    this.glide(420, 200, 0.12, 'square', 0.16, delay);
    this.noise(0.1, 0.18, 'bandpass', 900, 500, delay);
  }

  private thud(delay = 0): void {
    this.glide(140, 45, 0.3, 'sine', 0.5, delay);
    this.noise(0.12, 0.25, 'lowpass', 500, 100, delay);
  }

  /** The low rumble of traffic, and the hiss of tyres above it. */
  private startBed(): void {
    if (this.bed) return;
    const low = this.loopedNoise('lowpass', 380, .7), hiss = this.loopedNoise('bandpass', 1800, .7);
    if (low && hiss) this.bed = { sources: [low.src, hiss.src], low: low.gain, hiss: hiss.gain };
  }

  /** Called every frame while the street is on screen: the bed, now and then a bird, and horns that fade with distance. */
  private ambience(street: StreetView, hero: { x: number; y: number }, now: number): void {
    if (this.silent) return;
    this.startBed();
    const t = this.ctx!.currentTime;
    let near = 0;
    for (const n of street.npcs) {
      if (!n.bike || n.look === 'ambulance' || n.scale < .5) continue;
      const dist = Math.hypot(n.x - hero.x, n.y - hero.y);
      if (dist < 18) near++;
      // A horn once, as the vehicle starts speaking; quieter the further it is.
      if (n.say && !this.honking.has(n.id)) {
        this.honking.add(n.id);
        const level = Math.max(0, 1 - dist / 16);
        if (level > .05) this.horn(n.look === 'bike' ? 'bike' : 'car', level);
      }
    }
    for (const id of this.honking) if (!street.npcs.some(n => n.id === id && n.say)) this.honking.delete(id);
    if (this.bed) {
      // The street fades out as the magic circle opens: chapter 2's sky takes its rumble over (see TrialAudio).
      const load = Math.min(near, 8), open = street.portal ? 0 : 1;
      this.bed.low.gain.setTargetAtTime((.05 + .007 * load) * open, t, street.portal ? 2.4 : .6);
      this.bed.hiss.gain.setTargetAtTime((.004 + .0025 * load) * open, t, street.portal ? 2.4 : .6);
    }
    if (now > this.nextBird) {
      this.nextBird = now + 5000 + Math.random() * 9000;
      const chirps = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 900;
      for (let i = 0; i < chirps; i++) this.glide(base, base + 900 + Math.random() * 500, .09, 'sine', .01, i * .13);
    }
  }

  private horn(kind: 'bike' | 'car', level: number): void {
    if (kind === 'bike') { this.tone(520, .1, 'square', .012 * level); this.tone(520, .1, 'square', .012 * level, .16); }
    else { this.tone(400, .3, 'sawtooth', .014 * level); this.tone(500, .3, 'sawtooth', .014 * level); }
  }

  override destroy(): void {
    for (const src of this.bed?.sources ?? []) { try { src.stop(); } catch { /* already stopped */ } src.disconnect(); }
    this.bed = null;
    super.destroy();
    this.stopMusic();
    this.music?.disconnect();
  }
}
