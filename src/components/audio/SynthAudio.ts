import Phaser from 'phaser';

/**
 * The Web Audio frame every chapter's synthesised sound shares (no files): an output gain into a
 * compressor (loud enough for laptop and phone speakers, no clipping when cues overlap), unlocking on the
 * first gesture, silence while muted / the tab is hidden / the settings are open, and the synth voices
 * (tone, glide, noise). A chapter's audio extends it with its own music and cues.
 */
export abstract class SynthAudio {
  protected readonly ctx: AudioContext | null;
  protected readonly out: GainNode | null = null;
  private readonly limiter: DynamicsCompressorNode | null = null;
  protected paused = false;
  private wasSilent = true;
  private readonly voices = new Set<OscillatorNode | AudioBufferSourceNode>();
  private readonly visibility = () => {
    if (document.hidden) { this.stopVoices(); this.out?.gain.setValueAtTime(0, this.ctx!.currentTime); }
    this.onVisibility();
  };
  /**
   * Browsers only start audio from a user gesture. Phaser waits for a `mousedown`
   * on the page, but its own pointer handling suppresses that event, so a tap
   * never unlocked sound: resume the context on any pointer / key / touch ourselves.
   */
  private readonly resume = () => { if (this.ctx && !document.hidden && this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined); };

  constructor(protected readonly scene: Phaser.Scene, private readonly outGain: number) {
    const sm = scene.sound;
    this.ctx = sm instanceof Phaser.Sound.WebAudioSoundManager ? sm.context : null;
    if (!this.ctx) return;
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -14;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 6;
    this.limiter.connect((sm as Phaser.Sound.WebAudioSoundManager).destination);
    this.out = this.ctx.createGain();
    this.out.gain.value = outGain;
    this.out.connect(this.limiter);
    document.addEventListener('visibilitychange', this.visibility);
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) window.addEventListener(ev, this.resume, { capture: true });
  }

  /** The tab was hidden or shown again (music loops reschedule here). */
  protected onVisibility(): void {}

  /** Call first thing every frame: applies mute / pause (`paused`: the settings are open). False when there is no audio. */
  protected gate(paused: boolean): boolean {
    if (!this.ctx || !this.out) return false;
    this.paused = paused;
    const silent = this.silent;
    if (silent && !this.wasSilent) this.stopVoices();
    this.wasSilent = silent;
    this.out.gain.setValueAtTime(silent ? 0 : this.outGain, this.ctx.currentTime);
    return true;
  }

  /** Nothing should sound now (no audio, paused, hidden, muted or not unlocked yet). */
  protected get silent(): boolean {
    return !this.ctx || this.paused || document.hidden || this.scene.sound.mute || this.ctx.state !== 'running';
  }

  protected tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, dest: AudioNode = this.out!): void {
    this.glide(freq, freq, dur, type, vol, delay, dest);
  }

  protected glide(from: number, to: number, dur: number, type: OscillatorType, vol: number, delay = 0, dest: AudioNode = this.out!): void {
    const ctx = this.ctx;
    if (!ctx || this.silent) return;
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

  protected noise(dur: number, vol: number, kind: BiquadFilterType, from: number, to: number, delay = 0, dest: AudioNode = this.out!): void {
    const ctx = this.ctx;
    if (!ctx || this.silent) return;
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

  protected stopVoices(): void {
    for (const voice of this.voices) { try { voice.stop(); } catch { /* already ended */ } }
    this.voices.clear();
  }

  destroy(): void {
    document.removeEventListener('visibilitychange', this.visibility);
    this.stopVoices();
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) window.removeEventListener(ev, this.resume, { capture: true });
    this.out?.disconnect();
    this.limiter?.disconnect();
  }
}
