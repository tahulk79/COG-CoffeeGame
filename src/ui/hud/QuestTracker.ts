import Phaser from 'phaser';
import { t } from '../../core/i18n';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import type { GoalView, Reward } from '../../gameplay/meta/MetaService';
import { GameButton } from '../components/GameButton';
import { GameProgressBar } from '../components/GameProgressBar';
import type { HudFrame } from '../layout/HudLayout';
import { createIcon } from '../theme/assetRegistry';
import { COLORS, css, FONT } from '../theme/tokens';
import { pulse } from '../theme/anim';
import { setShown } from '../components/panelVisibility';
import { Panel } from '../components/Panel';

const rewardText = (r: Reward): string => [r.coins ? `${r.coins}đ` : '', r.exp ? `${r.exp} EXP` : '', ...(r.items ?? []).map((i) => `${i.qty}×`)].filter(Boolean).join(' + ');

/**
 * Left side: ONE active mission (the one you can claim, else the next unfinished
 * one). Click the card to expand details. Hidden during the story, whose own
 * objective box is shown instead.
 */
export class QuestTracker {
  readonly root: Phaser.GameObjects.Container;
  private readonly bg: Panel;
  private readonly header: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private readonly count: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;
  private readonly bar: GameProgressBar;
  private readonly claim: GameButton;
  private expanded = false;
  private width = 232;
  private x = 0;
  private y = 0;
  private mode: HudFrame['mode'] = 'wide';
  private currentId = '';
  private lastHeight = 0;
  private claimable = false;
  private readonly clip: Phaser.GameObjects.Container;
  private readonly gift: Phaser.GameObjects.Container;
  private drawnClaimable = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly claimQuest: (id: string) => { ok: true } | { ok: false; reason: string },
  ) {
    this.root = scene.add.container(0, 0).setDepth(1000);
    this.bg = new Panel(scene, {}, 232, 80).swallowClicks();
    this.bg.object.on('pointerdown', () => {
      this.expanded = !this.expanded;
      this.render();
    });
    this.header = scene.add.text(0, 0, t('mission.title'), { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.gold), fontStyle: 'bold' }).setResolution(2);
    this.label = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.sm}px`, color: css(COLORS.cream), wordWrap: { width: 200 } }).setResolution(2);
    this.count = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim) }).setOrigin(1, 0).setResolution(2);
    this.detail = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim), wordWrap: { width: 200 } }).setResolution(2);
    this.bar = new GameProgressBar(scene, 0, 0, { w: 200, h: 8, fill: COLORS.gold });
    this.claim = new GameButton(scene, 0, 0, t('meta.claim'), () => this.currentId && this.claimQuest(this.currentId), 'mission.claim', { fontSize: FONT.size.xs, h: 22 });
    this.clip = createIcon(scene, 'clipboard', 22);
    this.gift = createIcon(scene, 'gift', 32);
    this.root.add([this.bg.object, this.clip, this.gift, this.header, this.label, this.count, this.bar.object, this.detail, this.claim.text]);
  }

  layout(f: HudFrame, topOffset: number): void {
    this.mode = f.mode;
    this.width = f.mode === 'wide' ? 232 : 176;
    this.x = f.safe.left + f.margin;
    this.y = f.safe.top + f.margin + topOffset;
    this.root.setPosition(this.x, this.y);
    this.label.setWordWrapWidth(this.width - 24);
    this.detail.setWordWrapWidth(this.width - 24);
    this.lastHeight = 0;
    this.render();
  }

  private pick(s: SimulationSnapshot): { current: GoalView | null; upcoming: GoalView[] } {
    const counters = new Set(s.cafe ? ['served', 'fiveStar', 'placed', 'hired', 'brewed', 'level'] : ['harvest', 'sold', 'hired', 'level']);
    const open = s.meta.quests.filter((q) => !q.claimed && !q.locked && counters.has(q.counter));
    const current = open.find((q) => q.done) ?? open[0] ?? null;
    return { current, upcoming: open.filter((q) => q !== current).slice(0, 2) };
  }

  private snap: SimulationSnapshot | null = null;

  update(s: SimulationSnapshot, dtMs: number): void {
    this.snap = s;
    setShown(this.root, !s.story.active);
    if (s.story.active) return;
    this.render();
    this.bar.tick(dtMs);
  }

  private render(): void {
    const s = this.snap;
    if (!s || s.story.active) return;
    const { current, upcoming } = this.pick(s);
    const pad = 10;
    this.currentId = current?.id ?? '';
    this.claimable = !!current?.done;
    const label = current ? current.label : t('mission.none');
    if (this.label.text !== label) this.label.setText(label);
    this.header.setPosition(36, 8);
    this.clip.setPosition(22, 16);
    this.label.setPosition(pad, 28);
    let y = 28 + this.label.height + 6;
    const showBar = !!current;
    this.bar.setVisible(showBar).setPosition(pad, y);
    this.bar.setWidth(this.width - pad * 2 - 40);
    this.gift.setPosition(this.width - 28, y + 3).setAlpha(this.claimable ? 1 : 0.55).setVisible(!!current);
    if (current) this.bar.setValue(current.progress / current.target);
    this.count.setPosition(this.width - pad, 7).setText(current ? `${current.progress}/${current.target}` : '');
    if (showBar) y += 14;
    const showClaim = this.claimable;
    this.claim.setVisible(showClaim).setEnabled(showClaim);
    if (showClaim) {
      this.claim.text.setPosition(pad, y + 2);
      y += 28;
    }
    const detail = this.expanded && current ? [`${t('mission.reward')}: ${rewardText(current.reward)}`, ...upcoming.map((u) => `· ${u.label}`)].join('\n') : '';
    this.detail.setVisible(!!detail).setText(detail).setPosition(pad, y);
    if (detail) y += this.detail.height + 4;
    const h = Math.ceil(y + 6);
    if (h !== this.lastHeight || this.claimable !== this.drawnClaimable) {
      this.lastHeight = h;
      this.drawnClaimable = this.claimable;
      this.bg.set(this.width, h, { border: this.claimable ? COLORS.gold : COLORS.caramel });
      if (this.claimable) pulse(this.scene, this.root, 1.04);
    }
  }

  /** Bottom edge in HUD coordinates, to stack panels below this one. */
  get bottom(): number {
    return this.y + this.lastHeight;
  }

  destroy(): void {
    this.root.destroy();
  }
}
