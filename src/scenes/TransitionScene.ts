import Phaser from 'phaser';
import { bakeTexture } from '../ui/theme/bake';
import { t } from '../core/i18n';
import { COLORS, dur, FONT, css, LIGHT } from '../ui/theme/tokens';

export const TRANSITION_SCENE = 'TransitionScene';

export type TransitionStyle = 'doors' | 'light';

const INK = COLORS.ink;
/** The light strip along the seam where the two doors meet. */
const SEAM = 0xffe9a8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Where things go on a door of this size (each door is half the screen). Everything is laid out in
 * pixels for the real size, so nothing stretches: wide PC screens get wide doors, phones tall ones.
 * The middle band holds the name plate and the loading bar; the handles hang just below it.
 */
function doorLayout(W: number, H: number) {
  const u = Math.min(W, H / 2);
  const frame = clamp(W * 0.06, 10, 30);
  // Tall enough for the paper plate (kicker, title, bar) with the handles hanging below it.
  const band = clamp(H * 0.28, 160, 240);
  const cy = H * 0.5;
  const cloudR = clamp(u * 0.09, 16, 44);
  const mx = frame + clamp(W * 0.08, 10, 60);
  const pw = Math.max(40, W - mx - clamp(W * 0.12, 18, 70));
  return {
    u, frame, band, cy, cloudR, mx, pw,
    top: { y: frame + H * 0.04, h: cy - band / 2 - frame - H * 0.04 },
    bottom: { y: cy + band / 2, h: H - cloudR * 1.4 - frame - (cy + band / 2) - H * 0.02 },
    handle: { x: W - clamp(W * 0.13, 22, 70), y: cy + band / 2, r: clamp(u * 0.07, 12, 32) },
    line: clamp(u * 0.012, 3, 6),
  };
}

/** Page load: the doors start shut, show progress until `ready`, then `start` the world (which opens them). */
export interface BootGate {
  ready: Promise<unknown>;
  start: () => void;
}

/**
 * Story transition drawn above every other scene, so it survives the world
 * scene restarting for the new map: two heavenly doors close over the screen
 * (`close`), the next map loads behind them, then they swing open on it in a
 * burst of light (`open`). On page load the same doors are the loading screen
 * (`boot`). Door art is baked once into a texture.
 */
export class TransitionScene extends Phaser.Scene {
  private left!: Phaser.GameObjects.Image;
  private right!: Phaser.GameObjects.Image;
  private light!: Phaser.GameObjects.Graphics;
  /** The name plate on the doors: a paper card (like chapter 1's cards) with a coral kicker, the title and, while loading, the bar. */
  private plate!: Phaser.GameObjects.Container;
  private plateG!: Phaser.GameObjects.Graphics;
  private kicker!: Phaser.GameObjects.Text;
  private label!: Phaser.GameObjects.Text;
  private showBar = false;
  private barBox = { x: 0, y: 0, w: 0, h: 0 };
  /** Doors are shut and waiting for the new map. */
  closed = false;

  private pending: { ms: number; label: string; style?: TransitionStyle } | null = null;
  /** How the current transition looks: the doors, or a burst of white light (the magic circle). */
  private style: TransitionStyle = 'doors';
  private boot: BootGate | null = null;
  private bar!: Phaser.GameObjects.Graphics;
  private progress = 0;

  constructor() {
    super(TRANSITION_SCENE);
  }

  /** Launched with `{ close: { ms, label } }`: the doors start closing as soon as the scene exists; `{ boot }`: loading screen. */
  init(data: { close?: { ms: number; label: string; style?: TransitionStyle }; boot?: BootGate }): void {
    this.pending = data.close ?? null;
    this.boot = data.boot ?? null;
    this.closed = !!this.pending || !!this.boot;
  }

  private doorKey = '';

  create(): void {
    // A relaunched scene has new door images: they need the door texture again even at the same size.
    this.doorKey = '';
    this.light = this.add.graphics();
    this.left = this.add.image(0, 0, '__WHITE').setOrigin(0, 0);
    this.right = this.add.image(0, 0, '__WHITE').setOrigin(1, 0).setFlipX(true);
    this.plateG = this.add.graphics();
    this.kicker = this.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: '13px', fontStyle: '800', color: css(COLORS.coral), resolution: 2 }).setOrigin(0.5, 0);
    this.label = this.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: '30px', fontStyle: '800', color: css(LIGHT.text), align: 'center', resolution: 2 }).setOrigin(0.5, 0);
    this.plate = this.add.container(0, 0, [this.plateG, this.kicker, this.label]);
    this.bar = this.add.graphics();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fit, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fit, this));
    this.fit();
    this.setDoors(0);
    this.plate.setAlpha(0);
    if (this.pending) this.close(this.pending.ms, this.pending.label, this.pending.style);
    this.pending = null;
    if (this.boot) this.runBoot(this.boot);
  }

  /** Loading screen: shut doors, "Đang mở cổng…" and a bar that fills while the game gets ready. */
  private runBoot(gate: BootGate): void {
    this.setDoors(1);
    this.showBar = true;
    this.setTitle(t('transition.loading'), 'COG-CoffeeGame');
    this.plate.setAlpha(1);
    const started = this.time.now;
    let ready = false;
    void gate.ready.then(() => {
      ready = true;
      // The game font may have just arrived: redraw the label with it.
      this.label.setFontFamily(FONT.family);
      this.layoutPlate();
    });
    const tick = () => {
      // Creeps towards 90% while waiting, then completes; never shorter than a glance.
      this.progress += ((ready ? 1 : 0.9) - this.progress) * 0.08;
      this.drawBar(this.progress);
      if (ready && this.time.now - started > 900 && this.progress > 0.98) {
        this.events.off(Phaser.Scenes.Events.UPDATE, tick);
        this.drawBar(1);
        this.boot = null;
        gate.start();
      }
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, tick);
  }

  private drawBar(p: number): void {
    const g = this.bar.clear();
    if (p <= 0 || !this.showBar) return;
    const { x, y, w, h } = this.barBox;
    g.fillStyle(LIGHT.plate).fillRoundedRect(x, y, w, h, h / 2);
    g.fillStyle(COLORS.coral).fillRoundedRect(x, y, Math.max(h, w * Math.min(1, p)), h, h / 2);
    g.lineStyle(3, INK).strokeRoundedRect(x, y, w, h, h / 2);
  }

  /** "Chương 2 · Vườn mây" shows as a coral "CHƯƠNG 2" over the title "Vườn mây"; a title without "·" has no kicker. */
  private setTitle(text: string, kicker?: string): void {
    const [head, ...rest] = text.split(' · ');
    this.kicker.setText(kicker ?? (rest.length ? head!.toUpperCase() : ''));
    this.label.setText(kicker !== undefined || !rest.length ? text : rest.join(' · '));
    this.layoutPlate();
  }

  /** Sizes the paper card to its text (and the bar while loading) and centres it on the doors' seam. */
  private layoutPlate(): void {
    const { width: w, height: h } = this.scale;
    if (w < 1 || h < 1) return;
    this.label.setFontSize(Math.round(clamp(w / 14, 20, 40))).setWordWrapWidth(Math.max(160, w - 96));
    this.kicker.setFontSize(Math.round(clamp(w / 46, 12, 17)));
    const hasKick = this.kicker.text.length > 0, barW = Math.min(360, w * 0.62), barH = clamp(h * 0.022, 12, 16);
    const pw = Math.min(w - 24, Math.max(this.label.width + 56, this.showBar ? barW + 48 : 0, 220));
    const ph = 14 + (hasKick ? this.kicker.height + 2 : 0) + this.label.height + (this.showBar ? 14 + barH : 0) + 16;
    const cy = h * 0.5, top = -ph / 2;
    this.plate.setPosition(w / 2, cy);
    this.kicker.setVisible(hasKick).setPosition(0, top + 12);
    this.label.setPosition(0, top + 12 + (hasKick ? this.kicker.height + 2 : 0));
    this.plateG.clear().fillStyle(LIGHT.shadow, 0.18).fillRoundedRect(-pw / 2, top + 6, pw, ph, 18).fillStyle(LIGHT.panel, 1).fillRoundedRect(-pw / 2, top, pw, ph, 18).lineStyle(3.5, LIGHT.border, 1).strokeRoundedRect(-pw / 2, top, pw, ph, 18);
    this.barBox = { x: w / 2 - barW / 2, y: cy + top + ph - 16 - barH, w: barW, h: barH };
    if (this.progress > 0) this.drawBar(this.progress);
  }

  /** Door art is drawn for the current screen size (re-drawn on resize / rotation), never stretched. */
  private fit(): void {
    const { width: w, height: h } = this.scale;
    // A page opened in a hidden tab or pane has no size yet: draw once it gets one (RESIZE calls back).
    if (w < 1 || h < 1) return;
    const W = Math.ceil(w / 2) + 1, H = Math.ceil(h);
    const key = `transition:door:${W}x${H}`;
    if (key !== this.doorKey) {
      const old = this.doorKey;
      bakeTexture(this, key, W, H, (g) => drawDoor(g, W, H));
      this.left.setTexture(key);
      this.right.setTexture(key);
      this.doorKey = key;
      if (old && this.textures.exists(old)) this.textures.remove(old);
    }
    this.left.setPosition(0, 0);
    this.right.setPosition(w, 0);
    this.layoutPlate();
    this.setDoors(this.doorT);
  }

  private doorT = 0;

  /** 0 = wide open (doors folded against the edges), 1 = shut. The scale is the swing seen edge-on. */
  private setDoors(t: number): void {
    this.doorT = t;
    this.left.setScale(Math.max(0.001, t), 1).setVisible(t > 0.001);
    this.right.setScale(Math.max(0.001, t), 1).setVisible(t > 0.001);
    // Shading: a door turned away from you is darker.
    const shade = Math.round(150 + 105 * t);
    const tint = (shade << 16) | (shade << 8) | Math.round(shade * 0.92);
    this.left.setTint(tint);
    this.right.setTint(tint);
  }

  /** Light pouring through the gap between the doors (0–1). */
  private drawLight(k: number): void {
    const { width: w, height: h } = this.scale;
    const g = this.light.clear();
    if (k <= 0) return;
    g.fillStyle(0xfff6d8, 0.95 * k).fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + this.time.now / 2000;
      const r = Math.max(w, h);
      g.fillStyle(COLORS.sun, 0.25 * k).fillTriangle(w / 2, h / 2, w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, w / 2 + Math.cos(a + 0.12) * r, h / 2 + Math.sin(a + 0.12) * r);
    }
    for (let i = 5; i > 0; i--) g.fillStyle(COLORS.white, 0.12 * k).fillCircle(w / 2, h / 2, (i / 5) * Math.min(w, h) * 0.45);
  }

  /** Doors swing shut over the screen; `label` (the next chapter) appears on them. */
  close(ms: number, label = '', style: TransitionStyle = 'doors'): void {
    this.scene.bringToTop();
    this.closed = true;
    this.style = style;
    this.showBar = false;
    this.setTitle(label);
    this.plate.setAlpha(0);
    this.bar.clear().setAlpha(1);
    this.drawLight(0);
    const s = { t: 0 };
    const time = dur(ms) || 1;
    if (style === 'light') {
      // The magic circle's flash fills the screen; the chapter name shows on the light.
      this.setDoors(0);
      this.tweens.add({
        targets: s, t: 1, duration: time, ease: 'Cubic.easeIn',
        onUpdate: () => this.drawLight(s.t),
        onComplete: () => { if (label) this.tweens.add({ targets: this.plate, alpha: 1, duration: dur(200) || 1 }); },
      });
      this.chime();
      return;
    }
    this.tweens.add({
      targets: s, t: 1, duration: time, ease: 'Cubic.easeIn',
      onUpdate: () => this.setDoors(s.t),
      onComplete: () => {
        this.cameras.main.shake(dur(160), 0.006);
        if (label) this.tweens.add({ targets: this.plate, alpha: 1, duration: dur(200) || 1 });
        this.thud();
      },
    });
    this.creak(time / 1000);
  }

  /** On the new map: the doors swing open in a burst of light, then the scene stops. */
  open(): void {
    if (!this.closed) return;
    this.closed = false;
    this.scene.bringToTop();
    const s = { t: 1, k: 1 };
    if (this.style === 'light') {
      // The light fades away on the new world.
      this.tweens.add({ targets: [this.plate, this.bar], alpha: 0, duration: dur(250) || 1, delay: dur(350) });
      this.tweens.add({
        targets: s, k: 0, duration: dur(1200) || 1, delay: dur(450), ease: 'Cubic.easeOut',
        onUpdate: () => this.drawLight(s.k),
        onComplete: () => { this.drawLight(0); this.style = 'doors'; this.scene.stop(); },
      });
      return;
    }
    this.drawLight(0);
    this.tweens.add({ targets: [this.plate, this.bar], alpha: 0, duration: dur(250) || 1, delay: dur(350) });
    this.tweens.add({
      targets: s, t: 0, duration: dur(1100) || 1, delay: dur(450), ease: 'Cubic.easeInOut',
      onStart: () => this.chime(),
      onUpdate: () => {
        this.setDoors(s.t);
        // The light is brightest as the gap first opens, then gives way to the new world.
        this.drawLight(Math.sin(Math.min(1, (1 - s.t) * 1.6) * Math.PI) * 0.9);
      },
      onComplete: () => {
        this.drawLight(0);
        this.scene.stop();
      },
    });
  }

  // ── sound (Web Audio, follows the global mute) ─────────────────────────

  private ctx(): AudioContext | null {
    const sm = this.sound;
    return sm instanceof Phaser.Sound.WebAudioSoundManager && !sm.mute ? sm.context : null;
  }

  private note(freq: number, to: number, start: number, len: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctx();
    if (!ctx) return;
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(to, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + len + 0.02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  /** Old hinges. */
  private creak(len: number): void {
    for (let i = 0; i < 3; i++) this.note(140 + i * 25, 210 + i * 30, i * len * 0.28, len * 0.3, 'sawtooth', 0.05);
  }

  private thud(): void {
    this.note(110, 40, 0, 0.35, 'sine', 0.5);
  }

  /** Heavenly chime as the doors open. */
  private chime(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.note(f, f, i * 0.09, 1.2, 'sine', 0.12));
  }
}

/** One heavenly door at its real size (the right one is the same, mirrored): cream and gold, two arched panels, a ring handle. */
function drawDoor(g: Phaser.GameObjects.Graphics, W: number, H: number): void {
  const L = doorLayout(W, H);
  g.fillStyle(COLORS.paper).fillRect(0, 0, W, H);
  // Gold frame on the outer edge, top and bottom; a bright strip along the seam.
  g.fillStyle(COLORS.sun).fillRect(0, 0, L.frame, H).fillRect(0, 0, W, L.frame).fillRect(0, H - L.frame, W, L.frame);
  g.fillStyle(SEAM).fillRect(W - L.frame * 0.6, 0, L.frame * 0.6, H);
  g.lineStyle(L.line, INK).strokeRect(L.line / 2, L.line / 2, W - L.line, H - L.line);
  // Two arched inset panels above and below the name band.
  const panel = (y: number, h: number) => {
    if (h < 30) return;
    const r = Math.min(L.pw / 2, h * 0.45), inset = clamp(L.u * 0.03, 6, 14);
    g.fillStyle(LIGHT.plate).fillRoundedRect(L.mx, y, L.pw, h, { tl: r, tr: r, bl: 14, br: 14 });
    g.lineStyle(L.line, INK).strokeRoundedRect(L.mx, y, L.pw, h, { tl: r, tr: r, bl: 14, br: 14 });
    const ri = Math.max(0, r - inset);
    g.lineStyle(Math.max(2, L.line * 0.6), COLORS.sun).strokeRoundedRect(L.mx + inset, y + inset, L.pw - inset * 2, h - inset * 2, { tl: ri, tr: ri, bl: 8, br: 8 });
  };
  panel(L.top.y, L.top.h);
  panel(L.bottom.y, L.bottom.h);
  // Three stars in the top arch, sized to it.
  const s = clamp(Math.min(L.pw, L.top.h) * 0.08, 7, 24);
  for (const [fx, fy] of [[0.3, 0.45], [0.68, 0.55], [0.48, 0.75]] as const) {
    const x = L.mx + L.pw * fx, y = L.top.y + L.top.h * fy;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.42 : s, a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r)); }
    g.fillStyle(COLORS.sun).fillPoints(pts, true).lineStyle(Math.max(2, L.line * 0.6), INK).strokePoints(pts, true);
  }
  // Cloud trim along the bottom.
  const n = Math.max(3, Math.ceil(W / (L.cloudR * 1.8)));
  for (let i = 0; i <= n; i++) g.fillStyle(COLORS.white).fillCircle((i / n) * W, H - L.cloudR * 0.55, L.cloudR).lineStyle(L.line * 0.8, INK).strokeCircle((i / n) * W, H - L.cloudR * 0.55, L.cloudR);
  g.fillStyle(COLORS.white).fillRect(0, H - L.cloudR * 0.55, W, L.cloudR * 0.55);
  // Ring handle hanging from the bottom of the name band, near the seam.
  const hd = L.handle;
  g.lineStyle(hd.r * 0.36, INK).strokeCircle(hd.x, hd.y, hd.r);
  g.lineStyle(hd.r * 0.2, COLORS.sun).strokeCircle(hd.x, hd.y, hd.r);
  g.fillStyle(COLORS.sun).fillCircle(hd.x, hd.y - hd.r, hd.r * 0.42).lineStyle(Math.max(2, L.line * 0.6), INK).strokeCircle(hd.x, hd.y - hd.r, hd.r * 0.42);
}
