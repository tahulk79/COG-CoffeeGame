import type Phaser from 'phaser';
import { t } from '../../core/i18n';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { GameProgressBar } from '../components/GameProgressBar';
import type { HudFrame } from '../layout/HudLayout';
import { createIcon } from '../theme/assetRegistry';
import { COLORS, css, FONT } from '../theme/tokens';
import { pulse } from '../theme/anim';
import { Panel } from '../components/Panel';

/** Top-left: avatar, level, EXP progress and a small reputation indicator. */
export class PlayerProfileHUD {
  readonly root: Phaser.GameObjects.Container;
  private readonly bg: Panel;
  private readonly level: Phaser.GameObjects.Text;
  private readonly expText: Phaser.GameObjects.Text;
  private readonly bar: GameProgressBar;
  private readonly stars: Phaser.GameObjects.Container[] = [];
  private readonly avatar: Phaser.GameObjects.Container;
  private mode: HudFrame['mode'] = 'wide';
  private width = 232;
  private height = 62;
  private lastStars = -1;
  private lastExp = -1;

  constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(1000);
    this.bg = new Panel(scene);
    this.avatar = createIcon(scene, 'avatar', 44);
    this.level = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.md}px`, color: css(COLORS.cream), fontStyle: 'bold' }).setResolution(2);
    this.expText = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim) }).setResolution(2).setOrigin(1, 0);
    this.bar = new GameProgressBar(scene, 0, 0, { w: 100, h: 9, fill: COLORS.leaf });
    for (let i = 0; i < 5; i++) {
      const s = createIcon(scene, 'star', 11);
      this.stars.push(s);
    }
    this.root.add([this.bg.object, this.avatar, this.level, this.bar.object, this.expText, ...this.stars]);
  }

  layout(f: HudFrame): void {
    this.mode = f.mode;
    this.width = f.mode === 'wide' ? 232 : 176;
    this.height = f.mode === 'wide' ? 62 : 48;
    this.root.setPosition(f.safe.left + f.margin, f.safe.top + f.margin);
    this.bg.set(this.width, this.height);
    const ax = this.height / 2;
    this.avatar.setPosition(ax, this.height / 2).setScale(this.height / 62);
    const x0 = this.height + 4;
    const barW = this.width - x0 - 10;
    this.level.setPosition(x0, this.mode === 'wide' ? 8 : 5);
    this.bar.setPosition(x0, this.mode === 'wide' ? 32 : 28);
    this.bar.setWidth(barW);
    this.expText.setPosition(this.width - 10, this.mode === 'wide' ? 10 : 7);
    this.stars.forEach((s, i) => {
      s.setPosition(x0 + 6 + i * 13, 48).setVisible(this.mode === 'wide');
    });
    this.lastStars = -1;
  }

  update(s: SimulationSnapshot, dtMs: number): void {
    const p = s.progression;
    const need = Math.max(1, p.nextLevelExp - p.levelStartExp);
    const have = p.exp - p.levelStartExp;
    const lv = t('hud.levelShort', { level: p.level });
    if (this.level.text !== lv) this.level.setText(lv);
    const exp = `${have}/${need}`;
    if (this.expText.text !== exp) this.expText.setText(exp);
    // EXP gained: the bar flashes gold briefly, then returns to green.
    if (this.lastExp >= 0 && p.exp > this.lastExp) {
      this.bar.setFill(COLORS.gold);
      this.scene.time.delayedCall(450, () => this.bar.setFill(COLORS.leaf));
      pulse(this.scene, this.avatar, 1.12);
    }
    this.lastExp = p.exp;
    this.bar.setValue(have / need);
    this.bar.tick(dtMs);
    const rep = Math.round(s.reputation.value);
    if (rep !== this.lastStars) {
      this.lastStars = rep;
      this.stars.forEach((st, i) => st.setAlpha(i < rep ? 1 : 0.28));
    }
  }

  destroy(): void {
    this.root.destroy();
  }
}
