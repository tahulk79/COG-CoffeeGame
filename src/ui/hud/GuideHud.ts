import Phaser from 'phaser';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { nextGuide } from '../../gameplay/guide/guide';
import { Panel } from '../components/Panel';
import { setShown } from '../components/panelVisibility';
import type { HudFrame } from '../layout/HudLayout';
import { COLORS, css, FONT } from '../theme/tokens';

/** Top-centre "what to do next" card shown after the story, so the player is never left without a goal. */
export class GuideHud {
  readonly root: Phaser.GameObjects.Container;
  private readonly bg: Panel;
  private readonly title: Phaser.GameObjects.Text;
  private readonly text: Phaser.GameObjects.Text;
  private frame: HudFrame | null = null;
  private key = '';

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(1000);
    this.bg = new Panel(scene, {}, 300, 52);
    this.title = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.gold), fontStyle: 'bold' }).setOrigin(0.5, 0).setResolution(2);
    this.text = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.sm}px`, color: css(COLORS.cream), align: 'center' }).setOrigin(0.5, 0).setResolution(2);
    this.root.add([this.bg.object, this.title, this.text]);
    setShown(this.root, false);
  }

  layout(f: HudFrame): void {
    this.frame = f;
    this.key = '';
  }

  update(s: SimulationSnapshot): void {
    const f = this.frame;
    const g = f && !s.decor?.active ? nextGuide(s) : null;
    setShown(this.root, !!g);
    if (!f || !g) return;
    const key = `${g.title}|${g.text}|${f.w}|${f.mode}`;
    if (key === this.key) return;
    this.key = key;
    const compact = f.mode === 'compact';
    const w = compact ? f.w - f.margin * 2 : Math.max(300, Math.min(520, f.w - 420));
    this.title.setText(g.title).setWordWrapWidth(w - 24);
    this.text.setText(g.text).setWordWrapWidth(w - 24);
    this.title.setPosition(w / 2, 6);
    this.text.setPosition(w / 2, 8 + this.title.height + 2);
    const h = Math.ceil(this.text.y + this.text.height + 8);
    this.bg.set(w, h);
    this.root.setPosition((f.w - w) / 2, f.safe.top + (compact ? 62 : f.margin));
  }

  destroy(): void {
    this.root.destroy();
  }
}
