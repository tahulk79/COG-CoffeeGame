import Phaser from 'phaser';
import { createIcon } from '../theme/assetRegistry';
import { COLORS, css, FONT, MOTION, RADIUS, dur } from '../theme/tokens';
import { Panel } from './Panel';
import { isShown } from './panelVisibility';

export interface ItemCardData {
  /** Logical icon key from the asset registry. */
  icon: string;
  label: string;
  /** Quantity badge (top-right), e.g. "x12". */
  badge?: string;
  /** Small line under the label (price, quality…). */
  sub?: string;
  locked?: boolean;
  selected?: boolean;
  /** Dim the card (nothing owned, unavailable). */
  dim?: boolean;
}

/** Reusable item / furniture / recipe tile: icon, name, quantity badge, selection ring. */
export class ItemCard {
  readonly root: Phaser.GameObjects.Container;
  private readonly bg: Panel;
  private readonly label: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Container | null = null;
  private iconKey = '';
  private key = '';
  private data: ItemCardData | null = null;
  private onClick: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private w: number,
    private h: number,
  ) {
    this.root = scene.add.container(0, 0);
    this.bg = new Panel(scene, { fill: COLORS.espressoSoft, alpha: 1, border: COLORS.coffeeBrown, radius: RADIUS.md }, w, h);
    this.label = scene.add.text(w / 2, h - 28, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.cream), align: 'center', wordWrap: { width: w - 8 } }).setOrigin(0.5, 0).setResolution(2);
    this.sub = scene.add.text(w / 2, h - 14, '', { fontFamily: FONT.family, fontSize: '10px', color: css(COLORS.creamDim) }).setOrigin(0.5, 0).setResolution(2);
    this.badge = scene.add.text(w - 6, 4, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.gold), fontStyle: 'bold' }).setOrigin(1, 0).setResolution(2);
    this.root.add([this.bg.object, this.label, this.sub, this.badge]);
    this.root.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    if (this.root.input) this.root.input.cursor = 'pointer';
    this.root.on('pointerdown', () => {
      if (isShown(this.root)) {
        this.press();
        this.onClick?.();
      }
    });
  }

  setSize(w: number, h: number): this {
    this.w = w;
    this.h = h;
    this.label.setPosition(w / 2, h - 28).setWordWrapWidth(w - 8);
    this.sub.setPosition(w / 2, h - 14);
    this.badge.setPosition(w - 6, 4);
    (this.root.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(w, h);
    this.key = '';
    if (this.data) this.set(this.data);
    return this;
  }

  setOnClick(fn: (() => void) | null): this {
    this.onClick = fn;
    return this;
  }

  /** Update the card; redraws only when something visible changed. */
  set(d: ItemCardData): this {
    this.data = d;
    const key = JSON.stringify(d);
    if (key === this.key) return this;
    this.key = key;
    this.bg.set(this.w, this.h, { fill: d.selected ? COLORS.coffeeBrown : COLORS.espressoSoft, alpha: 1, border: d.selected ? COLORS.gold : COLORS.coffeeBrown, radius: RADIUS.md, borderWidth: d.selected ? 3 : 2 });
    const iconKey = d.locked ? 'lock' : d.icon;
    if (iconKey !== this.iconKey) {
      this.icon?.destroy();
      this.icon = createIcon(this.scene, iconKey, Math.min(this.w - 20, this.h - 52, 34));
      this.root.add(this.icon);
      this.iconKey = iconKey;
    }
    this.label.setText(d.label).setAlpha(d.dim ? 0.6 : 1);
    this.sub.setText(d.sub ?? '').setPosition(this.w / 2, this.h - 15);
    // Name sits above the sub line however many lines it wraps to; the icon centres in what is left.
    const labelTop = this.h - 16 - this.label.height;
    this.label.setPosition(this.w / 2, labelTop);
    this.icon!.setPosition(this.w / 2, Math.max(16, (labelTop + 6) / 2)).setAlpha(d.dim || d.locked ? 0.45 : 1);
    this.badge.setText(d.badge ?? '');
    return this;
  }

  private press(): void {
    if (dur(MOTION.fast) === 0) return;
    this.scene.tweens.killTweensOf(this.root);
    this.root.setScale(1);
    this.scene.tweens.add({ targets: this.root, scale: 0.96, duration: MOTION.fast / 2, yoyo: true });
  }

  setPosition(x: number, y: number): this {
    this.root.setPosition(x, y);
    return this;
  }

  setVisible(on: boolean): this {
    this.root.setVisible(on);
    return this;
  }

  destroy(): void {
    this.root.destroy();
  }
}
