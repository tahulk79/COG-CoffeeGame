import Phaser from 'phaser';
import type { ManagedPanel } from '../layout/ModalManager';
import type { HudFrame } from '../layout/HudLayout';
import { COLORS, css, DEPTH, dur, FONT, LIGHT, MOTION, RADIUS } from '../theme/tokens';
import { GameButton } from './GameButton';
import { setShown } from './panelVisibility';
import { Panel } from './Panel';

/** `dark`: the café's wooden panel (inventory, recipes…). `light`: the cream paper card of chapter 1. */
export type ModalTheme = 'dark' | 'light';

/**
 * Centred modal: dimmed backdrop (swallows clicks, click outside closes), a
 * panel with title + close button, open/close animation. The panel is sized to
 * the viewport (never larger than `maxW × maxH`, respecting safe areas), and
 * content is told the body size through `onLayout` so it can re-flow instead of
 * shrinking. Body content lives in `body` (0,0 = under the header).
 */
export class GameModal implements ManagedPanel {
  readonly root: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Container;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly bg: Panel;
  private readonly shadowPanel: Panel | null;
  private readonly swallow: Phaser.GameObjects.Rectangle;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly closeBtn: GameButton;
  private readonly headerH: number;
  private readonly closeSize: number;
  private opened = false;
  private w: number;
  private h: number;
  private layouts: Array<(bodyW: number, bodyH: number) => void> = [];
  private closing = false;

  constructor(
    private readonly scene: Phaser.Scene,
    title: string,
    private readonly maxW: number,
    private readonly maxH: number,
    readonly id: string,
    private readonly onClosed?: () => void,
    theme: ModalTheme = 'dark',
  ) {
    const light = theme === 'light';
    this.headerH = light ? 58 : 46;
    this.closeSize = light ? 44 : 30;
    this.w = maxW;
    this.h = maxH;
    this.root = scene.add.container(0, 0).setDepth(DEPTH.modal);
    this.dim = (light ? scene.add.rectangle(0, 0, 10, 10, LIGHT.backdrop, LIGHT.backdropAlpha) : scene.add.rectangle(0, 0, 10, 10, COLORS.shadow, 0.55)).setOrigin(0, 0).setInteractive();
    this.dim.on('pointerdown', () => this.close());
    this.panel = scene.add.container(0, 0);
    this.bg = new Panel(scene, light ? { fill: LIGHT.panel, alpha: 1, border: LIGHT.border, radius: RADIUS.lg, borderWidth: 3 } : { alpha: 0.98 }, maxW, maxH);
    // The paper card sits on a soft shadow, like the cards of chapter 1.
    this.shadowPanel = light ? new Panel(scene, { fill: LIGHT.shadow, alpha: 0.18, radius: RADIUS.lg, borderWidth: 0 }, maxW, maxH) : null;
    this.shadowPanel?.object.setPosition(0, 6);
    this.swallow = scene.add.rectangle(0, 0, maxW, maxH, 0, 0).setOrigin(0, 0).setInteractive();
    this.body = scene.add.container(14, this.headerH);
    this.heading = scene.add.text(16, 10, title, { fontFamily: FONT.family, fontSize: `${light ? FONT.size.xl : FONT.size.lg}px`, color: css(light ? LIGHT.text : COLORS.gold), fontStyle: 'bold' }).setResolution(2);
    this.closeBtn = new GameButton(scene, maxW - this.closeSize - 8, 7, '✕', () => this.close(), `${id}.close`, { variant: light ? 'secondary' : 'ghost', w: this.closeSize, h: this.closeSize, fontSize: FONT.size.md });
    this.panel.add([...(this.shadowPanel ? [this.shadowPanel.object] : []), this.bg.object, this.swallow, this.heading, this.body, this.closeBtn.text]);
    this.root.add([this.dim, this.panel]);
    setShown(this.root, false);
  }

  get buttons(): GameButton[] {
    return [this.closeBtn];
  }

  /** Register a content re-layout callback (called on every viewport change and when opened). */
  onLayout(fn: (bodyW: number, bodyH: number) => void): void {
    this.layouts.push(fn);
    fn(this.bodyW, this.bodyH);
  }

  get bodyW(): number {
    return this.w - 28;
  }

  get bodyH(): number {
    return this.h - this.headerH - 12;
  }

  layout(f: HudFrame): void {
    const insetX = f.safe.left + f.safe.right + 16;
    const insetY = f.safe.top + f.safe.bottom + 16;
    this.w = Math.min(this.maxW, f.w - insetX);
    this.h = Math.min(this.maxH, f.h - insetY);
    this.dim.setSize(f.w, f.h);
    this.panel.setPosition(Math.round((f.w - this.w) / 2), Math.round((f.h - this.h) / 2 + (f.safe.top - f.safe.bottom) / 2));
    this.bg.set(this.w, this.h);
    this.shadowPanel?.set(this.w, this.h);
    this.swallow.setSize(this.w, this.h);
    (this.swallow.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(this.w, this.h);
    this.closeBtn.text.setPosition(this.w - this.closeSize - 8, 7);
    for (const fn of this.layouts) fn(this.bodyW, this.bodyH);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.closing = false;
    this.scene.tweens.killTweensOf(this.panel);
    setShown(this.root, true);
    this.setBlocking(true);
    if (dur(MOTION.base) > 0) {
      this.panel.setAlpha(0).setScale(0.94);
      this.scene.tweens.add({ targets: this.panel, alpha: 1, scale: 1, duration: MOTION.base, ease: 'Quad.easeOut' });
      this.dim.setAlpha(0);
      this.scene.tweens.add({ targets: this.dim, alpha: 1, duration: MOTION.base });
    } else this.panel.setAlpha(1).setScale(1);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.closing = true;
    // Stop taking clicks right away; the panel only fades out afterwards.
    this.setBlocking(false);
    this.scene.tweens.killTweensOf(this.panel);
    if (dur(MOTION.fast) === 0) return this.finishClose();
    // Short exit animation.
    this.scene.tweens.add({ targets: this.panel, alpha: 0, scale: 0.96, duration: MOTION.fast, ease: 'Quad.easeIn', onComplete: () => this.finishClose() });
  }

  private setBlocking(on: boolean): void {
    for (const o of [this.dim, this.swallow]) if (o.input) o.input.enabled = on;
  }

  private finishClose(): void {
    if (!this.closing) return; // re-opened during the exit animation
    this.closing = false;
    setShown(this.root, false);
    this.onClosed?.();
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.panel);
    this.root.destroy();
  }
}
