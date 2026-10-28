import Phaser from 'phaser';
import { Panel } from './Panel';
import { isShown, setShown } from './panelVisibility';
import { createIcon } from '../theme/assetRegistry';
import { COLORS, css, dur, FONT, MOTION, RADIUS } from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface GameButtonOptions {
  variant?: ButtonVariant;
  /** Logical icon key from the asset registry. */
  icon?: string;
  /** Fixed size; otherwise it fits the label. */
  w?: number;
  h?: number;
  fontSize?: number;
  /** Icon only (label kept for the accessible name / tooltip). */
  iconOnly?: boolean;
  /** Icon above the label (toolbar tiles). */
  stack?: boolean;
}

const FILL: Record<ButtonVariant, { bg: number; border: number; text: number }> = {
  primary: { bg: COLORS.caramel, border: COLORS.coffeeBrown, text: COLORS.espresso },
  secondary: { bg: COLORS.cream, border: COLORS.caramel, text: COLORS.coffeeBrown },
  danger: { bg: COLORS.error, border: COLORS.coffeeBrown, text: COLORS.cream },
  ghost: { bg: COLORS.espressoSoft, border: COLORS.coffeeBrown, text: COLORS.cream },
};

/**
 * Rounded game button with a press animation. `text` is the container to add,
 * move or hide (kept under that name for the older panels and the test bridge).
 */
export class GameButton {
  /** The object callers position, add to containers, show or hide. */
  readonly text: Phaser.GameObjects.Container;
  private readonly visual: Phaser.GameObjects.Container;
  private readonly shadow: Panel;
  private readonly bg: Panel;
  private readonly lift: Panel;
  private readonly label: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Container | null = null;
  private readonly opts: GameButtonOptions;
  private enabled = true;
  private selected = false;
  private hovered = false;
  private w = 0;
  private h = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    private onClick: () => void,
    public name: string,
    opts: GameButtonOptions = {},
  ) {
    this.opts = { ...opts };
    this.text = scene.add.container(x, y);
    this.visual = scene.add.container(0, 0);
    this.shadow = new Panel(scene, { fill: COLORS.shadow, alpha: 0.28, radius: RADIUS.md, borderWidth: 0 }, 40, 26);
    this.bg = new Panel(scene, { radius: RADIUS.md });
    this.lift = new Panel(scene, { fill: COLORS.white, alpha: 0.12, radius: RADIUS.md, borderWidth: 0 });
    this.lift.object.setVisible(false);
    this.label = scene.add
      .text(0, 0, label, { fontFamily: FONT.family, fontSize: `${opts.fontSize ?? FONT.size.sm}px`, color: css(FILL[opts.variant ?? 'primary'].text), fontStyle: 'bold' })
      .setOrigin(0.5)
      .setResolution(2);
    this.visual.add([this.shadow.object, this.bg.object, this.lift.object, this.label]);
    if (opts.icon) {
      this.icon = createIcon(scene, opts.icon, (opts.fontSize ?? FONT.size.sm) + 7);
      this.visual.add(this.icon);
    }
    this.text.add(this.visual);
    this.layout();
    this.text.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.w, this.h), Phaser.Geom.Rectangle.Contains);
    if (this.text.input) this.text.input.cursor = 'pointer';

    this.text.on('pointerdown', () => {
      if (!this.enabled || !isShown(this.text)) return;
      this.press();
      this.onClick();
    });
    this.text.on('pointerover', () => {
      this.hovered = true;
      this.redraw();
    });
    this.text.on('pointerout', () => {
      this.hovered = false;
      this.redraw();
    });
  }

  private layout(): void {
    const o = this.opts;
    const pad = 12;
    this.label.setVisible(!o.iconOnly);
    if (o.stack && !o.iconOnly && this.icon) {
      // Toolbar tile: big icon on top, name underneath.
      const fs = o.fontSize ?? FONT.size.sm;
      this.h = o.h ?? Math.round(fs * 4.4);
      this.w = o.w ?? Math.max(this.h + 14, Math.ceil(this.label.width + 20));
      this.visual.setPosition(this.w / 2, this.h / 2);
      this.icon.setPosition(0, -this.h * 0.2).setScale(1.45);
      this.label.setPosition(0, this.h * 0.27);
    } else {
      const iconW = this.icon ? (o.fontSize ?? FONT.size.sm) + 7 + 6 : 0;
      const textW = o.iconOnly ? 0 : this.label.width;
      this.h = o.h ?? Math.round((o.fontSize ?? FONT.size.sm) * 2.1);
      this.w = o.w ?? Math.max(this.h, Math.ceil(textW + iconW + pad * 2));
      this.visual.setPosition(this.w / 2, this.h / 2);
      const left = -(textW + iconW) / 2;
      this.icon?.setScale(1).setPosition(left + iconW / 2 - 3, 0);
      this.label.setPosition(left + iconW + textW / 2, 0);
    }
    this.redraw();
    if (this.text.input) (this.text.input.hitArea as Phaser.Geom.Rectangle).setSize(this.w, this.h);
  }

  private redraw(): void {
    const f = FILL[this.opts.variant ?? 'primary'];
    const bg = !this.enabled ? COLORS.disabled : this.selected ? COLORS.gold : f.bg;
    this.shadow.set(this.w, this.h);
    this.shadow.object.setPosition(-this.w / 2 + 1, -this.h / 2 + 3);
    this.bg.set(this.w, this.h, { fill: bg, alpha: 1, border: f.border, radius: RADIUS.md });
    this.bg.object.setPosition(-this.w / 2, -this.h / 2);
    this.lift.set(this.w, this.h);
    this.lift.object.setPosition(-this.w / 2, -this.h / 2).setVisible(this.hovered && this.enabled);
    this.bg.object.setAlpha(this.enabled ? 1 : 0.7).setTint(!this.enabled ? 0xa8a69e : this.opts.variant === 'danger' ? 0xffb3a5 : 0xffffff);
    this.label.setColor(css(this.enabled ? f.text : COLORS.espressoSoft));
    this.icon?.setAlpha(this.enabled ? 1 : 0.55);
  }

  private press(): void {
    if (dur(MOTION.fast) === 0) return;
    this.scene.tweens.killTweensOf(this.visual);
    this.visual.setScale(1);
    this.scene.tweens.add({ targets: this.visual, scale: 0.93, duration: MOTION.fast / 2, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Switch between icon + label and a square icon-only button (compact layouts). */
  setIconOnly(on: boolean, size = 40): this {
    if (!!this.opts.iconOnly === on) return this;
    this.opts.iconOnly = on;
    if (on) {
      this.opts.w = size;
      this.opts.h = size;
    } else if (!this.opts.stack) {
      delete this.opts.w;
      delete this.opts.h;
    } else {
      delete this.opts.w;
      delete this.opts.h;
    }
    this.layout();
    return this;
  }

  /** Fixed width (equal-width toolbar tiles). */
  setWidth(w: number): this {
    if (this.opts.w !== w) {
      this.opts.w = w;
      this.layout();
    }
    return this;
  }

  /** Reuse a pooled button for another action. */
  rebind(name: string, onClick: () => void): this {
    this.name = name;
    this.onClick = onClick;
    return this;
  }

  setLabel(label: string): this {
    if (this.label.text !== label) {
      this.label.setText(label);
      this.layout();
    }
    return this;
  }

  setEnabled(on: boolean): this {
    if (on === this.enabled) return this;
    this.enabled = on;
    this.redraw();
    return this;
  }

  setSelected(on: boolean): this {
    if (on === this.selected) return this;
    this.selected = on;
    this.redraw();
    return this;
  }

  setVisible(on: boolean): this {
    setShown(this.text, on);
    return this;
  }

  get isEnabled(): boolean {
    return this.enabled && isShown(this.text);
  }

  /** Centre of the button in HUD (screen) coordinates; used by the test bridge. */
  center(): { x: number; y: number } {
    const m = this.text.getWorldTransformMatrix();
    return { x: m.tx + m.a * this.w / 2 + m.c * this.h / 2, y: m.ty + m.b * this.w / 2 + m.d * this.h / 2 };
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }
}
