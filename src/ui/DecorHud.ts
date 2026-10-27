import Phaser from 'phaser';
import { t } from '../core/i18n';
import type { DecorResult, FurnitureConfig } from '../gameplay/decor/FurnitureService';
import type { SimulationSnapshot } from '../gameplay/GameSimulation';
import type { ItemTable } from '../systems/economy/TransactionService';
import { GameButton } from './components/GameButton';
import { ItemCard } from './components/ItemCard';
import { setShown } from './components/panelVisibility';
import { TabBar } from './components/TabBar';
import type { HudFrame } from './layout/HudLayout';
import { itemIconKey } from './theme/assetRegistry';
import { COLORS, css, DEPTH, FONT } from './theme/tokens';
import { fadeIn } from './theme/anim';
import { Panel } from './components/Panel';

/** The only commands the decorate panel may issue. */
export interface DecorUiCommands {
  enter(): DecorResult;
  exit(): void;
  buy(type: string): DecorResult;
  select(type: string): DecorResult;
  rotate(): DecorResult;
  storeSelected(): DecorResult;
  clearSelection(): void;
  confirm(): DecorResult;
}

const CELL_W = 148;
const CARD_H = 66;
const CELL_H = CARD_H + 30;
const PANEL_W = 330;

/**
 * Decorate panel: furniture category tabs, cards (price, owned count, comfort /
 * decor bonus) with Buy and Place buttons, the live placement check, and
 * Rotate / Confirm / Cancel / Store / Done. Placement itself still happens in
 * the world (click a floor tile or use Confirm on the highlighted ghost); this
 * panel only issues DecorUiCommands.
 */
export class DecorHud {
  readonly buttons = new Map<string, GameButton>();
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Panel;
  private readonly stats: Phaser.GameObjects.Text;
  private readonly tabs: TabBar;
  private readonly cells = new Map<string, { card: ItemCard; buy: GameButton; place: GameButton }>();
  private readonly selection: Phaser.GameObjects.Text;
  private readonly preview: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly pager: GameButton[];
  private readonly rotate: GameButton;
  private readonly confirm: GameButton;
  private readonly store: GameButton;
  private readonly deselect: GameButton;
  private readonly done: GameButton;
  private frame: HudFrame | null = null;
  private page = 0;
  private perPage = 4;
  private cols = 2;
  private panelW = PANEL_W;
  private panelH = 560;
  private x = 0;
  private y = 0;
  private sig = '';
  private heightSig = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly commands: DecorUiCommands,
    private readonly furniture: FurnitureConfig,
    private readonly items: ItemTable,
  ) {
    this.root = scene.add.container(0, 0).setDepth(DEPTH.contextual);
    this.bg = new Panel(scene, { alpha: 0.96 }, 10, 10).swallowClicks();
    this.root.add(this.bg.object);
    const text = (size: number, color: number, bold = false) => ({ fontFamily: FONT.family, fontSize: `${size}px`, color: css(color), ...(bold ? { fontStyle: 'bold' } : {}) });
    this.root.add(scene.add.text(12, 8, t('decor.title'), text(FONT.size.md, COLORS.gold, true)).setResolution(2));
    this.stats = scene.add.text(12, 30, '', { ...text(FONT.size.xs, COLORS.creamDim), lineSpacing: 2 }).setResolution(2);
    this.root.add(this.stats);
    const cats = [...new Set(Object.values(furniture.catalog).map((f) => f.category ?? 'decor'))];
    this.tabs = new TabBar(scene, 'decor', [{ id: 'all', label: t('inv.cat.all') }, ...cats.map((c) => ({ id: c, label: t(`decor.cat.${c}`) }))], () => {
      this.page = 0;
      this.sig = '';
      for (const c of this.cells.values()) fadeIn(scene, c.card.root);
    });
    this.root.add(this.tabs.root);
    for (const [id, b] of this.tabs.buttons) this.buttons.set(`decor.tab.${id}`, b);

    for (const type of Object.keys(furniture.catalog)) {
      const card = new ItemCard(scene, CELL_W, CARD_H);
      const buy = this.button(t('decor.buy'), () => this.report(commands.buy(type)), `decor.buy.${type}`);
      const place = this.button('', () => this.report(commands.select(type)), `decor.place.${type}`);
      this.root.add(card.root);
      this.cells.set(type, { card, buy, place });
    }
    this.pager = [this.button('◂', () => this.turn(-1), 'decor.prev'), this.button('▸', () => this.turn(1), 'decor.next')];
    this.selection = scene.add.text(12, 0, '', { ...text(FONT.size.xs, COLORS.cream), wordWrap: { width: PANEL_W - 24 } }).setResolution(2);
    this.preview = scene.add.text(12, 0, '', { ...text(FONT.size.xs, COLORS.leaf), wordWrap: { width: PANEL_W - 24 } }).setResolution(2);
    this.message = scene.add.text(12, 0, '', { ...text(FONT.size.xs, COLORS.error), wordWrap: { width: PANEL_W - 24 } }).setResolution(2);
    this.root.add([this.selection, this.preview, this.message]);
    this.rotate = this.button(t('decor.rotate'), () => this.report(commands.rotate()), 'decor.rotate');
    this.confirm = this.button(t('decor.confirm'), () => this.report(commands.confirm()), 'decor.confirm', 'primary');
    this.store = this.button(t('decor.store'), () => this.report(commands.storeSelected()), 'decor.store');
    this.deselect = this.button(t('decor.deselect'), () => commands.clearSelection(), 'decor.deselect', 'ghost');
    this.done = this.button(t('decor.done'), () => commands.exit(), 'decor.exit', 'primary');
    setShown(this.root, false);
  }

  private button(label: string, onClick: () => void, name: string, variant: 'primary' | 'secondary' | 'ghost' = 'secondary'): GameButton {
    const b = new GameButton(this.scene, 0, 0, label, onClick, name, { fontSize: FONT.size.xs, h: 24, variant });
    this.root.add(b.text);
    this.buttons.set(name, b);
    return b;
  }

  private turn(d: number): void {
    this.page += d;
    this.sig = '';
  }

  /** Placement against the HUD frame: a right-hand panel on wide screens, a bottom sheet on phones. */
  place(f: HudFrame, topOffset: number): void {
    this.frame = f;
    const compact = f.mode === 'compact';
    this.panelW = compact ? Math.min(f.w - 2 * f.margin, 460) : PANEL_W;
    this.cols = Math.max(1, Math.floor((this.panelW - 12) / (CELL_W + 8)));
    const room = f.h - f.safe.top - f.safe.bottom - topOffset - (compact ? 70 : f.margin * 2);
    this.panelH = Math.max(260, Math.min(room, compact ? 360 : 600));
    this.x = compact ? Math.round((f.w - this.panelW) / 2) : f.w - f.safe.right - f.margin - this.panelW;
    this.y = compact ? f.h - f.safe.bottom - this.panelH - 66 : f.safe.top + topOffset;
    this.root.setPosition(this.x, this.y);
    const tabsH = this.tabs.layout(this.panelW - 24);
    this.tabs.root.setPosition(12, compact ? 30 : 62);
    this.stats.setVisible(!compact).setWordWrapWidth(this.panelW - 24);
    const gridTop = (compact ? 30 : 62) + tabsH + 6;
    const footer = 108;
    this.perPage = Math.max(this.cols, Math.floor((this.panelH - gridTop - footer) / CELL_H) * this.cols);
    this.gridTop = gridTop;
    this.drawBg();
    this.sig = '';
  }

  private gridTop = 100;

  private drawBg(): void {
    this.bg.set(this.panelW, this.panelH);
  }

  /** Toolbar → decorate mode. */
  requestEnter(): void {
    this.report(this.commands.enter());
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  private report(r: DecorResult): void {
    this.message.setText(r.ok ? '' : t(`decor.fail.${r.reason}`));
  }

  update(s: SimulationSnapshot): void {
    const d = s.decor;
    const active = d?.active ?? false;
    setShown(this.root, active);
    if (!d || !active) {
      this.message.setText('');
      return;
    }
    const b = d.bonuses;
    const pct = (f: number) => Math.round((f - 1) * 100);
    const stats = `${t('decor.scores', { comfort: b.comfort, decor: b.decor, spots: b.spots })}\n${t('decor.effects', { patience: pct(b.patienceFactor), traffic: pct(b.trafficFactor) })}`;
    if (this.stats.text !== stats) this.stats.setText(stats);

    const cat = this.tabs.current;
    const types = Object.keys(this.furniture.catalog).filter((ty) => cat === 'all' || (this.furniture.catalog[ty]!.category ?? 'decor') === cat);
    const pages = Math.max(1, Math.ceil(types.length / this.perPage));
    if (this.page >= pages) this.page = pages - 1;
    const sig = `${cat}|${this.page}|${this.panelW}|${s.economy.coins}|${s.progression.level}|${types.map((ty) => d.owned[ty] ?? 0).join(',')}|${d.selection ? `${d.selection.kind}:${d.selection.type}` : ''}`;
    if (sig !== this.sig) {
      this.sig = sig;
      const shown = new Set(types.slice(this.page * this.perPage, (this.page + 1) * this.perPage));
      let slot = 0;
      for (const [type, cell] of this.cells) {
        const vis = shown.has(type);
        cell.card.setVisible(vis);
        cell.buy.setVisible(vis);
        cell.place.setVisible(vis);
        if (!vis) continue;
        const f = this.furniture.catalog[type]!;
        const locked = s.progression.level < f.unlockLevel;
        const owned = d.owned[type] ?? 0;
        const col = slot % this.cols;
        const row = Math.floor(slot / this.cols);
        slot++;
        const cx = 12 + col * (CELL_W + 8);
        const cy = this.gridTop + row * CELL_H;
        const bonus = [f.comfort ? `+${f.comfort}♥` : '', f.decor ? `+${f.decor}✿` : ''].filter(Boolean).join(' ');
        cell.card.setPosition(cx, cy).set({ icon: itemIconKey('furniture'), label: this.items[f.itemId]?.label ?? type, badge: owned > 0 ? `x${owned}` : '', sub: locked ? t('decor.locked', { n: f.unlockLevel }) : `${f.price}đ ${bonus}`, locked, selected: d.selection?.kind === 'place' && d.selection.type === type });
        cell.buy.text.setPosition(cx, cy + CARD_H + 4);
        cell.place.text.setPosition(cx + cell.buy.width + 6, cy + CARD_H + 4);
        cell.buy.setEnabled(!locked && s.economy.coins >= f.price);
        cell.place.setLabel(t('decor.place', { n: owned })).setEnabled(owned > 0).setSelected(d.selection?.kind === 'place' && d.selection.type === type);
      }
      this.pager[0]!.setVisible(pages > 1).setEnabled(this.page > 0);
      this.pager[1]!.setVisible(pages > 1).setEnabled(this.page < pages - 1);
    }

    // Footer: selection, live placement check and the action buttons.
    const fy = this.panelH - 104;
    const sel = d.selection;
    const label = (type: string) => this.items[this.furniture.catalog[type]?.itemId ?? '']?.label ?? type;
    const selText = !sel ? t('decor.none') : t(sel.kind === 'place' ? 'decor.placing' : 'decor.moving', { item: label(sel.type), dir: sel.rotation + 1 });
    if (this.selection.text !== selText) this.selection.setText(selText);
    this.selection.setPosition(12, fy);
    this.pager[0]!.text.setPosition(this.panelW - 82, fy - 2);
    this.pager[1]!.text.setPosition(this.panelW - 42, fy - 2);
    const p = d.preview;
    this.preview.setColor(css(p?.valid ? COLORS.leaf : COLORS.error));
    const pv = !sel ? '' : !p ? t('decor.pointAt') : p.valid ? t('decor.ok') : t(`decor.fail.${p.reason}`);
    if (this.preview.text !== pv) this.preview.setText(pv);
    this.preview.setPosition(12, fy + 18);
    this.message.setPosition(12, fy + 32);
    const by = fy + 50;
    this.rotate.setVisible(!!sel).text.setPosition(12, by);
    this.confirm.setVisible(!!sel).setEnabled(!!p?.valid).text.setPosition(12 + this.rotate.width + 6, by);
    this.deselect.setVisible(!!sel).text.setPosition(12 + this.rotate.width + this.confirm.width + 12, by);
    this.store.setVisible(sel?.kind === 'move').text.setPosition(12, by + 28);
    this.done.text.setPosition(this.panelW - this.done.width - 12, by + 28);
    void this.heightSig;
  }

  destroy(): void {
    this.root.destroy();
  }
}
