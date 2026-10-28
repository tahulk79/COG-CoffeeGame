import type Phaser from 'phaser';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { GameButton } from '../components/GameButton';
import { TOP_ROW, type HudFrame } from '../layout/HudLayout';
import { drawGear } from '../theme/glyphs';
import { createIcon } from '../theme/assetRegistry';
import { COLORS, css, FONT } from '../theme/tokens';
import { Panel } from '../components/Panel';

/** Top-right: coins (real balance only) and the settings button. */
export class CurrencyHUD {
  readonly root: Phaser.GameObjects.Container;
  readonly settings: GameButton;
  private readonly bg: Panel;
  private readonly coins: Phaser.GameObjects.Text;
  private readonly coinIcon: Phaser.GameObjects.Container;
  private shown = -1;
  private lastFrame: HudFrame | null = null;
  private chipW = 120;
  /** Panel top-right corner in HUD coordinates (other HUD parts hang below it). */
  private bottomY = 0;

  constructor(
    scene: Phaser.Scene,
    openSettings: () => void,
  ) {
    this.root = scene.add.container(0, 0).setDepth(1000);
    this.bg = new Panel(scene);
    this.coinIcon = createIcon(scene, 'coin', 24);
    this.coins = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.lg}px`, color: css(COLORS.gold), fontStyle: 'bold' }).setOrigin(0, 0.5).setResolution(2);
    // A round gear button, the same height as the sound button on the other side.
    this.settings = new GameButton(scene, 0, 0, '', openSettings, 'settings.open', { variant: 'secondary', w: TOP_ROW.size, h: TOP_ROW.size }).setGlyph((g) => drawGear(g, COLORS.coffeeBrown, COLORS.cream, 12));
    this.root.add([this.bg.object, this.coinIcon, this.coins, this.settings.text]);
  }

  layout(f: HudFrame): void {
    this.lastFrame = f;
    const base = f.mode === 'wide' ? 130 : 108;
    // The chip grows with the number (millions fit).
    this.chipW = Math.max(base, Math.ceil(this.coins.width) + 52);
    const total = this.chipW + 8 + TOP_ROW.size;
    this.root.setPosition(f.w - f.safe.right - TOP_ROW.inset - total, f.safe.top + TOP_ROW.inset);
    this.bg.set(this.chipW, TOP_ROW.size, { radius: TOP_ROW.size / 2 });
    this.coinIcon.setPosition(20, TOP_ROW.size / 2);
    this.coins.setPosition(38, TOP_ROW.size / 2);
    this.settings.text.setPosition(this.chipW + 8, 0);
    this.bottomY = f.safe.top + TOP_ROW.inset + TOP_ROW.size;
  }

  /** Y just below this HUD part, for stacking things under it. */
  get bottom(): number {
    return this.bottomY;
  }

  update(s: SimulationSnapshot): void {
    // Story chapters: no economy yet, only the settings button stays.
    const story = s.story.active;
    this.bg.object.setVisible(!story);
    this.coins.setVisible(!story);
    if (s.economy.coins !== this.shown) {
      this.shown = s.economy.coins;
      const compact = this.lastFrame?.mode === 'compact' && this.shown >= 1_000_000;
      this.coins.setText(compact ? `${(this.shown / (this.shown >= 1_000_000_000 ? 1_000_000_000 : 1_000_000)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${this.shown >= 1_000_000_000 ? 'tỷ' : 'tr'}` : this.shown.toLocaleString('vi-VN'));
      if (this.lastFrame) this.layout(this.lastFrame);
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}
