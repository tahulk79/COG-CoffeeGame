import Phaser from 'phaser';
import { setShown } from '../components/panelVisibility';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { GameButton } from '../components/GameButton';
import type { HudFrame } from '../layout/HudLayout';
import { COLORS, css, FONT } from '../theme/tokens';
import { Panel } from '../components/Panel';

export interface ToolbarItem {
  /** Button name (also the key tests use to find it). */
  name: string;
  icon: string;
  label: (s: SimulationSnapshot) => string;
  /** `ok: false` shows the button locked, with the reason as a tooltip; `hide` removes it until it matters (keeps the bar short). */
  available: (s: SimulationSnapshot) => { ok: true } | { ok: false; reason: string; hide?: boolean };
  onClick: () => void;
  /** Highlighted while the panel it opens is shown. */
  isOn?: () => boolean;
}

/** Bottom-centre navigation. Every button opens an existing feature; unavailable ones are clearly locked. */
export class BottomToolbar {
  readonly root: Phaser.GameObjects.Container;
  readonly buttons = new Map<string, GameButton>();
  private readonly bg: Panel;
  private readonly tip: Phaser.GameObjects.Text;
  private readonly items: ToolbarItem[];
  private readonly btns: GameButton[] = [];
  private frame: HudFrame | null = null;
  private lastSig = '';
  private reasons: string[] = [];
  private barW = 0;
  private barH = 0;
  private topY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    items: ToolbarItem[],
  ) {
    this.items = items;
    this.root = scene.add.container(0, 0).setDepth(1000);
    this.bg = new Panel(scene);
    this.tip = scene.add.text(0, -26, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.cream), backgroundColor: css(COLORS.espresso), padding: { x: 8, y: 4 } }).setOrigin(0.5, 0).setVisible(false).setResolution(2);
    this.root.add(this.bg.object);
    items.forEach((it, i) => {
      const b = new GameButton(scene, 0, 0, '', it.onClick, it.name, { icon: it.icon, variant: 'ghost', fontSize: FONT.size.sm, stack: true });
      b.text.on('pointerover', () => this.showTip(i));
      b.text.on('pointerout', () => this.tip.setVisible(false));
      this.btns.push(b);
      this.buttons.set(it.name, b);
      this.root.add(b.text);
    });
    this.root.add(this.tip);
    setShown(this.root, false);
  }

  private showTip(i: number): void {
    const why = this.reasons[i];
    if (!why) return;
    this.tip.setText(why).setVisible(true).setPosition(this.btns[i]!.text.x + this.btns[i]!.width / 2, -28);
  }

  layout(f: HudFrame): void {
    this.frame = f;
    this.lastSig = '';
  }

  update(s: SimulationSnapshot): void {
    const f = this.frame;
    if (!f) return;
    const businessMap = s.map === 'cafe' || s.map === 'farm' || s.map === 'master' || /__(cafe|farm)$/.test(s.map);
    const visible = businessMap && !s.story.locked;
    setShown(this.root, visible);
    if (!visible) return;
    const compact = f.mode === 'compact';
    let sig = compact ? 'c' : 'w';
    this.reasons = [];
    this.items.forEach((it, i) => {
      const b = this.btns[i]!;
      const a = it.available(s);
      const hidden = !a.ok && !!a.hide;
      b.setEnabled(a.ok).setSelected(!!it.isOn?.() && a.ok);
      setShown(b.text, !hidden);
      this.reasons[i] = a.ok ? '' : a.reason;
      const label = it.label(s);
      sig += `|${label}${hidden ? '-' : ''}`;
      b.setIconOnly(compact);
      if (!compact) b.setLabel(label);
    });
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    // Re-flow: icon-only squares on small screens, icon + label otherwise.
    const gap = compact ? 6 : 8;
    const pad = 10;
    let x = pad;
    const shown = this.btns.filter((b) => b.text.visible);
    shown.forEach((b) => {
      const cell = compact ? 40 : b.width;
      b.text.setPosition(x, pad);
      x += cell + gap;
    });
    this.barW = x - gap + pad;
    this.barH = (compact ? 40 : (this.btns[0]?.height ?? 30)) + pad * 2;
    // Equal-width tiles on wide screens, like a real game tab bar.
    if (!compact) {
      const wMax = Math.max(...shown.map((b) => b.width));
      let xx = pad;
      shown.forEach((b) => {
        b.setWidth(wMax);
        b.text.setPosition(xx, pad);
        xx += wMax + gap;
      });
      this.barW = xx - gap + pad;
    }
    this.bg.set(this.barW, this.barH, { radius: 18 });
    this.root.setPosition((f.w - this.barW) / 2, f.h - f.safe.bottom - f.margin - this.barH);
    this.topY = this.root.y;
  }

  /** Top edge of the toolbar in HUD coordinates. */
  get top(): number {
    return this.topY || (this.frame ? this.frame.h - this.frame.margin - 60 : 0);
  }

  destroy(): void {
    this.root.destroy();
  }
}
