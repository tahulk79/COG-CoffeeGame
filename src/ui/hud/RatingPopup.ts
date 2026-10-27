import type Phaser from 'phaser';
import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { t } from '../../core/i18n';
import type { HudFrame } from '../layout/HudLayout';
import { createIcon } from '../theme/assetRegistry';
import { COLORS, css, DEPTH, dur, FONT, MOTION } from '../theme/tokens';
import { Panel } from '../components/Panel';

interface Entry {
  customer: string;
  drink: string;
  stars: number;
  comments: string[];
  coins: number;
  tip: number;
  exp: number;
  repFrom: number;
  repTo: number | null;
}

const W = 300;
const H = 132;
const SHOW_MS = 3600;

/**
 * Customer rating popup: reaction, stars revealed one by one, short comments,
 * the coins and EXP that were actually paid, and the reputation change. Every
 * value comes from the `cafe:rated` / `cafe:paid` / `cafe:reputationChanged`
 * events of the real RatingSystem; nothing is generated here.
 */
export class RatingPopup {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Panel;
  private readonly reaction: Phaser.GameObjects.Text;
  private readonly who: Phaser.GameObjects.Text;
  private readonly comment: Phaser.GameObjects.Text;
  private readonly reward: Phaser.GameObjects.Text;
  private readonly rep: Phaser.GameObjects.Text;
  private readonly stars: Array<{ full: Phaser.GameObjects.Container; empty: Phaser.GameObjects.Container }> = [];
  private readonly queue: Entry[] = [];
  private readonly offs: Array<() => void> = [];
  private current: Entry | null = null;
  private lastRep = 3;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  /** The reputation event can arrive just before or just after the rating event of the same moment. */
  private recentRep: { value: number; at: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    bus: EventBus<GameEvents>,
    private readonly customerLabel: (id: string) => string,
    private readonly recipeLabel: (id: string) => string,
    recipeOfOrder: (orderId: number) => string | undefined,
  ) {
    this.root = scene.add.container(0, 0).setDepth(DEPTH.toast).setVisible(false);
    this.bg = new Panel(scene, { border: COLORS.gold, radius: 16 }, W, H);
    this.reaction = scene.add.text(W / 2, 10, '', { fontFamily: FONT.family, fontSize: `${FONT.size.lg}px`, color: css(COLORS.gold), fontStyle: 'bold' }).setOrigin(0.5, 0).setResolution(2);
    this.who = scene.add.text(W / 2, 34, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim) }).setOrigin(0.5, 0).setResolution(2);
    this.comment = scene.add.text(W / 2, 82, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.cream), align: 'center', wordWrap: { width: W - 24 } }).setOrigin(0.5, 0).setResolution(2);
    this.reward = scene.add.text(12, H - 24, '', { fontFamily: FONT.family, fontSize: `${FONT.size.sm}px`, color: css(COLORS.gold), fontStyle: 'bold' }).setResolution(2);
    this.rep = scene.add.text(W - 12, H - 24, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim) }).setOrigin(1, 0).setResolution(2);
    this.root.add([this.bg.object, this.reaction, this.who, this.comment, this.reward, this.rep]);
    for (let i = 0; i < 5; i++) {
      const full = createIcon(scene, 'star', 22).setPosition(W / 2 + (i - 2) * 30, 62);
      const empty = createIcon(scene, 'starEmpty', 22).setPosition(W / 2 + (i - 2) * 30, 62);
      this.root.add([empty, full]);
      this.stars.push({ full, empty });
    }

    const pending = new Map<number, Entry>();
    this.offs.push(
      bus.on('cafe:rated', (e) => {
        const entry: Entry = {
          customer: this.customerLabel(e.customerId),
          drink: this.recipeLabel(recipeOfOrder(e.orderId) ?? ''),
          stars: e.stars,
          comments: e.feedback.map((k) => t(`rating.${k}`)),
          coins: e.coins,
          tip: e.tip,
          exp: 0,
          repFrom: this.lastRep,
          repTo: null,
        };
        if (this.recentRep && performance.now() - this.recentRep.at < 300) entry.repTo = this.recentRep.value;
        pending.set(e.orderId, entry);
        this.enqueue(entry);
      }),
      bus.on('cafe:reputationChanged', (e) => {
        this.recentRep = { value: e.reputation, at: performance.now() };
        const last = [...pending.values()].at(-1);
        if (last && last.repTo === null) last.repTo = e.reputation;
        this.refreshText();
      }),
      bus.on('cafe:paid', (e) => {
        const entry = pending.get(e.orderId);
        if (entry) {
          entry.exp = e.exp;
          pending.delete(e.orderId);
          this.refreshText();
        }
      }),
    );
  }

  /** Called every frame with the real reputation so the "before" value is known. */
  observe(reputation: number): void {
    this.lastRep = reputation;
  }

  layout(f: HudFrame): void {
    this.root.setPosition(Math.round((f.w - W) / 2), f.mode === 'compact' && f.portrait ? f.safe.top + 156 : f.safe.top + f.margin + 4);
  }

  private enqueue(e: Entry): void {
    this.queue.push(e);
    if (!this.current) this.next();
  }

  private next(): void {
    const e = this.queue.shift();
    if (!e) {
      this.current = null;
      return;
    }
    this.current = e;
    this.refreshText();
    this.root.setVisible(true).setAlpha(0);
    const ease = dur(MOTION.base) > 0;
    const y = this.root.y;
    this.root.setY(y - (ease ? 10 : 0));
    this.scene.tweens.add({ targets: this.root, alpha: 1, y, duration: dur(MOTION.base) || 1, ease: 'Quad.easeOut' });
    // Reveal the earned stars one by one; the rest stay empty.
    this.stars.forEach((s, i) => {
      s.full.setVisible(i < e.stars).setScale(ease ? 0 : 1);
      s.empty.setVisible(true);
      if (i < e.stars && ease) this.scene.tweens.add({ targets: s.full, scale: 1, delay: 160 + i * 110, duration: MOTION.base, ease: 'Back.easeOut' });
    });
    this.hideTimer?.remove();
    this.hideTimer = this.scene.time.delayedCall(SHOW_MS + (this.queue.length ? 0 : 0), () => this.hide());
  }

  private hide(): void {
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: dur(MOTION.fast) || 1,
      onComplete: () => {
        this.root.setVisible(false);
        this.next();
      },
    });
  }

  private refreshText(): void {
    const e = this.current;
    if (!e) return;
    const word = ['', 'rate.1', 'rate.2', 'rate.3', 'rate.4', 'rate.5'][e.stars]!;
    this.reaction.setText(t(word));
    this.who.setText(`${e.customer} · ${e.drink}`);
    this.comment.setText(e.comments.slice(0, 2).join(' · '));
    this.reward.setText(`${t('reward.coins', { n: e.coins + e.tip })}${e.tip > 0 ? ` (${t('rating.tip', { n: e.tip })})` : ''}   ${e.exp > 0 ? t('reward.exp', { n: e.exp }) : ''}`);
    this.rep.setText(e.repTo === null ? '' : t('rating.rep', { from: e.repFrom.toFixed(1), to: e.repTo.toFixed(1), arrow: e.repTo > e.repFrom + 0.005 ? '▲' : e.repTo < e.repFrom - 0.005 ? '▼' : '•' }));
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.hideTimer?.remove();
    this.root.destroy();
  }
}
