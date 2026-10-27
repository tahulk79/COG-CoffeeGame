import type Phaser from 'phaser';
import { t } from '../../core/i18n';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import type { ItemTable } from '../../systems/economy/TransactionService';
import { GameButton } from '../components/GameButton';
import { GameModal } from '../components/GameModal';
import { ItemCard } from '../components/ItemCard';
import { TabBar } from '../components/TabBar';
import { itemIconKey } from '../theme/assetRegistry';
import { fadeIn } from '../theme/anim';
import { COLORS, css, FONT } from '../theme/tokens';

export interface InventoryCommands {
  sell(itemId: string, qty: number): { ok: true; coins: number } | { ok: false; reason: string };
  isSellable(itemId: string): boolean;
}

const CARD = 76;
const CARD_H = 92;
const GAP = 8;
const HIDDEN_CATEGORIES = new Set(['debug']);

/**
 * Inventory: category tabs, a paged item grid with quantity badges and a
 * detail strip with sell actions. Reads the shared inventory from the
 * snapshot; sells through the market command (which enforces "be at the market").
 */
export class InventoryModal {
  readonly modal: GameModal;
  readonly buttons = new Map<string, GameButton>();
  private readonly tabs: TabBar;
  private readonly cards: ItemCard[] = [];
  private readonly cardLayer: Phaser.GameObjects.Container;
  private readonly pager: GameButton[];
  private readonly detailTitle: Phaser.GameObjects.Text;
  private readonly detailBody: Phaser.GameObjects.Text;
  private readonly sell1: GameButton;
  private readonly sellAll: GameButton;
  private readonly message: Phaser.GameObjects.Text;
  private readonly empty: Phaser.GameObjects.Text;
  private selected: string | null = null;
  private page = 0;
  private cols = 4;
  private rows = 3;
  private wide = false;
  private ids: string[] = [];
  private lastSnap: SimulationSnapshot | null = null;
  private sig = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly commands: InventoryCommands,
    private readonly items: ItemTable,
    onClosed?: () => void,
  ) {
    this.modal = new GameModal(scene, t('inv.title'), 580, 470, 'inventory', onClosed);
    const categories = [...new Set(Object.values(items).map((i) => i.category))].filter((c) => !HIDDEN_CATEGORIES.has(c));
    this.tabs = new TabBar(scene, 'inv', [{ id: 'all', label: t('inv.cat.all') }, ...categories.map((c) => ({ id: c, label: t(`inv.cat.${c}`) }))], () => {
      this.page = 0;
      this.sig = '';
      fadeIn(scene, this.cardLayer);
    });
    this.cardLayer = scene.add.container(0, 0);
    this.modal.body.add([this.tabs.root, this.cardLayer]);
    for (const [id, b] of this.tabs.buttons) this.buttons.set(`inv.tab.${id}`, b);
    for (let i = 0; i < 24; i++) {
      const c = new ItemCard(scene, CARD, CARD_H).setOnClick(() => {
        this.selected = this.ids[this.page * this.cols * this.rows + i] ?? null;
        this.message.setText('');
        this.sig = '';
      });
      this.cards.push(c);
      this.cardLayer.add(c.root);
    }
    const mk = (label: string, name: string, fn: () => void) => {
      const b = new GameButton(scene, 0, 0, label, fn, name, { fontSize: FONT.size.xs, h: 26 });
      this.modal.body.add(b.text);
      this.buttons.set(name, b);
      return b;
    };
    this.pager = [mk('◂', 'inv.prev', () => this.turn(-1)), mk('▸', 'inv.next', () => this.turn(1))];
    this.detailTitle = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.md}px`, color: css(COLORS.gold), fontStyle: 'bold', wordWrap: { width: 200 } }).setResolution(2);
    this.detailBody = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.cream), wordWrap: { width: 200 } }).setResolution(2);
    this.message = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim), wordWrap: { width: 200 } }).setResolution(2);
    this.empty = scene.add.text(0, 0, t('inv.empty'), { fontFamily: FONT.family, fontSize: `${FONT.size.sm}px`, color: css(COLORS.creamDim) }).setResolution(2);
    this.sell1 = mk(t('inv.sell1'), 'inv.sell1', () => this.doSell(1));
    this.sellAll = mk(t('inv.sellAll'), 'inv.sellAll', () => this.doSell('all'));
    this.modal.body.add([this.detailTitle, this.detailBody, this.message, this.empty]);
    for (const b of this.modal.buttons) this.buttons.set(b.name, b);
    this.modal.onLayout((w, h) => this.relayout(w, h));
    scene.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.modal.isOpen && this.turn(dy > 0 ? 1 : -1));
  }

  private turn(d: number): void {
    const pages = Math.max(1, Math.ceil(this.ids.length / (this.cols * this.rows)));
    this.page = Math.max(0, Math.min(pages - 1, this.page + d));
    this.sig = '';
  }

  private doSell(qty: number | 'all'): void {
    const id = this.selected;
    if (!id) return;
    const owned = this.lastSnap?.economy.inventory[id]?.qty ?? 0;
    const n = qty === 'all' ? owned : qty;
    const r = this.commands.sell(id, n);
    this.message.setColor(r.ok ? css(COLORS.leaf) : css(COLORS.error));
    this.message.setText(r.ok ? t('hud.sold', { n, item: this.items[id]!.label, coins: r.coins }) : t(`feedback.fail.${r.reason}`));
  }

  /** Re-flow for the available body size: grid left + detail right when wide, detail below when narrow. */
  private relayout(w: number, h: number): void {
    this.wide = w >= 500;
    const tabsH = this.tabs.layout(w) + 8;
    const detailW = this.wide ? 190 : 0;
    const gridW = w - detailW - (this.wide ? 12 : 0);
    const detailH = this.wide ? 0 : 92;
    this.cols = Math.max(2, Math.floor((gridW + GAP) / (CARD + GAP)));
    this.rows = Math.max(1, Math.floor((h - tabsH - detailH - 34 + GAP) / (CARD_H + GAP)));
    this.cards.forEach((c, i) => {
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      c.setPosition(col * (CARD + GAP), tabsH + row * (CARD_H + GAP));
    });
    const gridBottom = tabsH + this.rows * (CARD_H + GAP);
    this.pager[0]!.text.setPosition(0, gridBottom);
    this.pager[1]!.text.setPosition(40, gridBottom);
    const dx = this.wide ? w - detailW : 0;
    const dy = this.wide ? tabsH : gridBottom + 32;
    const dw = this.wide ? detailW : w;
    this.detailTitle.setPosition(dx, dy).setWordWrapWidth(dw);
    this.detailBody.setPosition(dx, dy + 22).setWordWrapWidth(dw);
    this.sell1.text.setPosition(dx, this.wide ? dy + 150 : dy + 44);
    this.sellAll.text.setPosition(dx + this.sell1.width + 6, this.wide ? dy + 150 : dy + 44);
    this.message.setPosition(dx, this.wide ? dy + 182 : dy + 72).setWordWrapWidth(dw);
    this.empty.setPosition(0, tabsH + 6);
    this.sig = '';
  }

  update(s: SimulationSnapshot): void {
    if (!this.modal.isOpen) return;
    this.lastSnap = s;
    const cat = this.tabs.current;
    const owned = Object.entries(s.economy.inventory).filter(([id]) => cat === 'all' ? true : this.items[id]?.category === cat);
    const sig = `${cat}|${this.page}|${this.selected}|${s.shop}|${owned.map(([id, st]) => `${id}:${st.qty}:${Math.round(st.quality)}`).join(',')}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.ids = owned.map(([id]) => id);
    if (this.selected && !this.ids.includes(this.selected)) this.selected = null;
    const per = this.cols * this.rows;
    const pages = Math.max(1, Math.ceil(this.ids.length / per));
    if (this.page >= pages) this.page = pages - 1;
    this.cards.forEach((c, i) => {
      const id = i < per ? this.ids[this.page * per + i] : undefined;
      if (!id) return void c.setVisible(false);
      const st = s.economy.inventory[id]!;
      c.setVisible(true).set({ icon: itemIconKey(this.items[id]!.category), label: this.items[id]!.label, badge: `x${st.qty}`, sub: `Q${Math.round(st.quality)}`, selected: id === this.selected });
    });
    this.empty.setVisible(this.ids.length === 0);
    this.pager[0]!.setEnabled(this.page > 0).setVisible(pages > 1);
    this.pager[1]!.setEnabled(this.page < pages - 1).setVisible(pages > 1);

    const id = this.selected;
    const st = id ? s.economy.inventory[id] : undefined;
    this.detailTitle.setText(id ? this.items[id]!.label : t('inv.pick'));
    this.detailBody.setText(id && st ? `${t(`inv.cat.${this.items[id]!.category}`)}\n${t('inv.qty', { n: st.qty })} · ${t('inv.quality', { q: Math.round(st.quality) })}` : '');
    const sellable = !!id && this.commands.isSellable(id);
    const atMarket = s.shop === 'market';
    this.sell1.setVisible(sellable).setEnabled(sellable && atMarket);
    this.sellAll.setVisible(sellable).setEnabled(sellable && atMarket);
    if (id && !sellable) this.message.setColor(css(COLORS.creamDim)).setText(t('inv.notSellable'));
    else if (id && !atMarket) this.message.setColor(css(COLORS.creamDim)).setText(t('inv.goMarket'));
    else if (!id) this.message.setText('');
  }

  destroy(): void {
    this.modal.destroy();
  }
}
