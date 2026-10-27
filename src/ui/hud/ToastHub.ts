import type Phaser from 'phaser';
import type { HudFrame } from '../layout/HudLayout';
import { createIcon } from '../theme/assetRegistry';
import { COLORS, css, DEPTH, dur, FONT, MOTION } from '../theme/tokens';
import { Panel } from '../components/Panel';

export interface ToastData {
  icon: string;
  title: string;
  text?: string;
  tone?: 'gold' | 'leaf' | 'caramel';
}

interface Slot {
  root: Phaser.GameObjects.Container;
  bg: Panel;
  icon: Phaser.GameObjects.Container | null;
  iconKey: string;
  title: Phaser.GameObjects.Text;
  text: Phaser.GameObjects.Text;
  busy: boolean;
}

const W = 280;
const H = 52;
const SLOTS = 3;
const SHOW_MS = 2800;

/** Short notifications (level up, unlocks, quests, upgrades). Pooled slots, queued, never stacked beyond three. */
export class ToastHub {
  private readonly slots: Slot[] = [];
  private readonly queue: ToastData[] = [];
  private baseY = 0;
  private baseX = 0;

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < SLOTS; i++) {
      const root = scene.add.container(0, 0).setDepth(DEPTH.toast).setVisible(false);
      const bg = new Panel(scene);
      const title = scene.add.text(48, 8, '', { fontFamily: FONT.family, fontSize: `${FONT.size.sm}px`, color: css(COLORS.gold), fontStyle: 'bold' }).setResolution(2);
      const text = scene.add.text(48, 27, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.cream), wordWrap: { width: W - 58 } }).setResolution(2);
      root.add([bg.object, title, text]);
      this.slots.push({ root, bg, icon: null, iconKey: '', title, text, busy: false });
    }
  }

  layout(f: HudFrame, bottomY: number): void {
    this.baseX = Math.round((f.w - W) / 2);
    this.baseY = bottomY - H;
    this.slots.forEach((s, i) => s.root.setPosition(this.baseX, this.baseY - i * (H + 6)));
  }

  push(t: ToastData): void {
    this.queue.push(t);
    this.pump();
  }

  private pump(): void {
    while (this.queue.length) {
      const slot = this.slots.find((s) => !s.busy);
      if (!slot) return;
      this.show(slot, this.queue.shift()!);
    }
  }

  private show(slot: Slot, t: ToastData): void {
    slot.busy = true;
    slot.bg.set(W, H, { border: t.tone === 'leaf' ? COLORS.leaf : t.tone === 'caramel' ? COLORS.caramel : COLORS.gold, fill: COLORS.espresso, alpha: 0.96, radius: 14 });
    if (slot.iconKey !== t.icon) {
      slot.icon?.destroy();
      slot.icon = createIcon(this.scene, t.icon, 28).setPosition(26, H / 2);
      slot.root.add(slot.icon);
      slot.iconKey = t.icon;
    }
    slot.title.setText(t.title);
    slot.text.setText(t.text ?? '').setVisible(!!t.text);
    slot.title.setY(t.text ? 8 : 16);
    slot.root.setVisible(true).setAlpha(0);
    const rise = dur(MOTION.base) === 0 ? 0 : 12;
    const y = slot.root.y;
    slot.root.setY(y + rise);
    this.scene.tweens.add({ targets: slot.root, alpha: 1, y, duration: dur(MOTION.base) || 1, ease: 'Quad.easeOut' });
    this.scene.time.delayedCall(SHOW_MS, () => {
      this.scene.tweens.add({
        targets: slot.root,
        alpha: 0,
        duration: dur(MOTION.fast) || 1,
        onComplete: () => {
          slot.root.setVisible(false);
          slot.busy = false;
          this.pump();
        },
      });
    });
  }

  destroy(): void {
    for (const s of this.slots) s.root.destroy();
    this.queue.length = 0;
  }
}
