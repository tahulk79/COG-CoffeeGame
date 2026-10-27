import type Phaser from 'phaser';
import { COLORS, dur, MOTION } from '../theme/tokens';
import { Panel } from './Panel';

export interface ProgressBarOptions {
  w: number;
  h?: number;
  fill?: number;
  track?: number;
  /** Smooth the fill towards new values (skipped for reduced motion). */
  animate?: boolean;
}

/** Rounded progress bar. `value` is 0–1. */
export class GameProgressBar {
  /** Container holding the track and the fill; add this to your layout. */
  readonly object: Phaser.GameObjects.Container;
  private readonly track: Panel;
  private readonly fillBar: Panel;
  private shown = 0;
  private target = 0;
  private fill: number;
  private readonly h: number;
  private w: number;
  private readonly trackColor: number;
  private readonly animate: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    o: ProgressBarOptions,
  ) {
    this.w = o.w;
    this.h = o.h ?? 10;
    this.fill = o.fill ?? COLORS.leaf;
    this.trackColor = o.track ?? COLORS.coffeeBrown;
    this.animate = o.animate ?? true;
    const r = Math.floor(this.h / 2);
    this.track = new Panel(scene, { fill: this.trackColor, alpha: 0.85, radius: r, borderWidth: 0 }, this.w, this.h, 16, 4);
    this.fillBar = new Panel(scene, { fill: this.fill, alpha: 1, radius: r, borderWidth: 0 }, this.h, this.h, 16, 4);
    this.object = scene.add.container(x, y, [this.track.object, this.fillBar.object]);
    this.draw();
  }

  setPosition(x: number, y: number): this {
    this.object.setPosition(x, y);
    return this;
  }

  setWidth(w: number): this {
    if (w !== this.w) {
      this.w = w;
      this.draw();
    }
    return this;
  }

  setFill(color: number): this {
    if (color !== this.fill) {
      this.fill = color;
      this.draw();
    }
    return this;
  }

  setValue(v: number): this {
    const t = Math.max(0, Math.min(1, v));
    if (t === this.target) return this;
    this.target = t;
    if (!this.animate || dur(MOTION.base) === 0) this.shown = t;
    this.draw();
    return this;
  }

  /** Advance the smoothing; call from the owner's update with the frame delta. */
  tick(dtMs: number): void {
    if (this.shown === this.target) return;
    const step = dtMs / MOTION.base;
    this.shown = this.shown < this.target ? Math.min(this.target, this.shown + step) : Math.max(this.target, this.shown - step);
    this.draw();
  }

  setVisible(on: boolean): this {
    this.object.setVisible(on);
    return this;
  }

  private draw(): void {
    const r = Math.floor(this.h / 2);
    this.track.set(this.w, this.h);
    const fw = Math.max(0, this.w * this.shown);
    this.fillBar.object.setVisible(fw > 0);
    if (fw > 0) this.fillBar.set(Math.max(this.h, fw), this.h, { fill: this.fill, alpha: 1, radius: r, borderWidth: 0 });
  }
}
