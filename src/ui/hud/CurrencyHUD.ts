import type Phaser from 'phaser';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { GameButton } from '../components/GameButton';
import type { HudFrame } from '../layout/HudLayout';
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
    this.settings = new GameButton(scene, 0, 0, 'Cài đặt', openSettings, 'settings.open', { icon: 'gear', iconOnly: true, variant: 'ghost', w: 34, h: 34 });
    this.root.add([this.bg.object, this.coinIcon, this.coins, this.settings.text]);
  }

  layout(f: HudFrame): void {
    this.lastFrame = f;
    const base = f.mode === 'wide' ? 130 : 108;
    // The chip grows with the number (millions fit).
    this.chipW = Math.max(base, Math.ceil(this.coins.width) + 52);
    const total = this.chipW + 8 + 34;
    this.root.setPosition(f.w - f.safe.right - f.margin - total, f.safe.top + f.margin);
    this.bg.set(this.chipW, 34, { radius: 17 });
    this.coinIcon.setPosition(18, 17);
    this.coins.setPosition(36, 17);
    this.settings.text.setPosition(this.chipW + 8, 0);
    this.bottomY = f.safe.top + f.margin + 34;
  }

  /** Y just below this HUD part, for stacking things under it. */
  get bottom(): number {
    return this.bottomY;
  }

  update(s: SimulationSnapshot): void {
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
