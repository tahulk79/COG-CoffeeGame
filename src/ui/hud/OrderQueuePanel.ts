import Phaser from 'phaser';
import { t } from '../../core/i18n';
import type { CustomerView } from '../../gameplay/cafe/CafeService';
import type { Order, RecipeTable } from '../../gameplay/cafe/OrderService';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { GameProgressBar } from '../components/GameProgressBar';
import { Panel } from '../components/Panel';
import { setShown } from '../components/panelVisibility';
import type { HudFrame } from '../layout/HudLayout';
import { createIcon } from '../theme/assetRegistry';
import { COLORS, css, FONT } from '../theme/tokens';

const CARD_W = 262;
const CARD_H = 66;
const GAP = 8;
const HEAD_H = 34;
const MAX_CARDS = 4;

interface Card {
  root: Phaser.GameObjects.Container;
  bg: Panel;
  name: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  bag: Phaser.GameObjects.Container;
  bar: GameProgressBar;
  highlighted: boolean | null;
}

/**
 * Right side (café only): "Đơn hàng n/m" with one cream card per real open order: customer
 * portrait, number + drink, status, drink icon, patience bar with a timer. The order you can act on
 * is outlined in gold. Reads only the OrderSystem state from the snapshot.
 */
export class OrderQueuePanel {
  readonly root: Phaser.GameObjects.Container;
  private readonly frame: Panel;
  private readonly head: Phaser.GameObjects.Text;
  private readonly count: Phaser.GameObjects.Text;
  private readonly cards: Card[] = [];
  private readonly more: Phaser.GameObjects.Text;
  private mode: HudFrame['mode'] = 'wide';
  private upward = false;
  private expanded = false;
  private x = 0;
  private y = 0;
  private lastH = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly recipes: RecipeTable,
    private readonly archetypeLabel: (id: string) => string,
    private readonly capacity: number,
  ) {
    this.root = scene.add.container(0, 0).setDepth(1000);
    this.frame = new Panel(scene, {}, CARD_W + 16, 100);
    this.head = scene.add.text(14, 7, t('orders.title'), { fontFamily: FONT.family, fontSize: `${FONT.size.lg}px`, color: css(COLORS.cream), fontStyle: 'bold' }).setResolution(2);
    this.count = scene.add.text(CARD_W + 2, 10, '', { fontFamily: FONT.family, fontSize: `${FONT.size.sm}px`, color: css(COLORS.creamDim), fontStyle: 'bold' }).setOrigin(1, 0).setResolution(2);
    this.root.add([this.frame.object, this.head, this.count]);
    for (let i = 0; i < MAX_CARDS; i++) {
      const root = scene.add.container(8, HEAD_H + i * (CARD_H + GAP));
      const bg = new Panel(scene, { fill: COLORS.cream, alpha: 1, border: COLORS.caramel, radius: 14 }, CARD_W, CARD_H);
      const avatar = createIcon(scene, 'customer', 40).setPosition(30, CARD_H / 2 - 2);
      const name = scene.add.text(60, 8, '', { fontFamily: FONT.family, fontSize: `${FONT.size.md}px`, color: css(COLORS.espresso), fontStyle: 'bold' }).setResolution(2);
      const sub = scene.add.text(60, 30, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.coffeeBrown) }).setResolution(2);
      const cup = createIcon(scene, 'cupDark', 30).setPosition(CARD_W - 30, 22);
      const timer = createIcon(scene, 'timer', 22).setPosition(CARD_W - 24, CARD_H - 16);
      const bag = createIcon(scene, 'bag', 20).setPosition(CARD_W - 62, 22);
      const bar = new GameProgressBar(scene, 60, CARD_H - 21, { w: CARD_W - 60 - 50, h: 9, fill: COLORS.leaf, track: COLORS.creamDim });
      root.add([bg.object, avatar, name, sub, cup, bag, timer, bar.object]);
      root.setInteractive(new Phaser.Geom.Rectangle(0, 0, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
      // On phones the list is collapsed to the current order; tapping the card expands it.
      root.on('pointerdown', () => this.mode === 'compact' && (this.expanded = !this.expanded));
      this.root.add(root);
      this.cards.push({ root, bg, name, sub, bag, bar, highlighted: null });
    }
    this.more = scene.add.text(CARD_W / 2 + 8, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim) }).setOrigin(0.5, 0).setResolution(2);
    this.root.add(this.more);
  }

  layout(f: HudFrame, topOffset: number): void {
    this.mode = f.mode;
    this.upward = f.mode === 'compact' && f.portrait;
    if (this.upward) {
      // Phone portrait: the order you act on sits above the toolbar, in thumb reach.
      this.x = Math.round((f.w - CARD_W) / 2) - 8;
      this.y = f.h - f.safe.bottom - f.margin - 62 - 6 - CARD_H;
    } else {
      this.x = f.w - f.safe.right - f.margin - CARD_W - 16;
      this.y = f.safe.top + f.margin + topOffset;
    }
    this.root.setPosition(this.x, this.y);
  }

  /** The order the player can act on now: the one being brewed, a finished drink waiting to be served, a fresh order at the counter, else the next to brew. */
  private actionable(s: SimulationSnapshot): number | null {
    const cafe = s.cafe!;
    if (cafe.brew) return cafe.brew.orderId;
    if (cafe.heldDrink) return cafe.heldDrink.orderId;
    const ready = cafe.orders.find((o) => o.status === 'READY');
    if (ready) return ready.id;
    const atCounter = cafe.orders.find((o) => o.status === 'CREATED');
    if (atCounter) return atCounter.id;
    return cafe.nextToBrew;
  }

  update(s: SimulationSnapshot, dtMs: number): void {
    const cafe = s.cafe;
    setShown(this.root, !!cafe && !s.story.active && !s.decor?.active);
    if (!cafe || s.story.active) return;
    const act = this.actionable(s);
    const orders: Order[] = [...cafe.orders].sort((a, b) => (a.id === act ? -1 : b.id === act ? 1 : a.id - b.id));
    const limit = this.mode === 'compact' && !this.expanded ? 1 : MAX_CARDS;
    const shown = Math.min(orders.length, limit);
    const full = !this.upward;
    this.head.setVisible(full);
    this.count.setVisible(full).setText(`${orders.length}/${this.capacity}`);
    this.frame.object.setVisible(full);
    const h = HEAD_H + Math.max(1, shown) * (CARD_H + GAP) + 2;
    if (full && h !== this.lastH) {
      this.lastH = h;
      this.frame.set(CARD_W + 16, h);
    }
    this.cards.forEach((card, i) => {
      const o = orders[i];
      const show = !!o && i < limit;
      card.root.setVisible(show);
      card.root.setPosition(this.upward ? 8 : 8, this.upward ? -i * (CARD_H + GAP) : HEAD_H + i * (CARD_H + GAP));
      if (!show || !o) return;
      const c: CustomerView | undefined = cafe.customers.find((x) => x.id === o.customerId);
      const hi = o.id === act;
      if (card.highlighted !== hi) {
        card.highlighted = hi;
        card.bg.set(CARD_W, CARD_H, { fill: COLORS.cream, alpha: 1, border: hi ? COLORS.gold : COLORS.caramel, radius: 14, borderWidth: hi ? 4 : 2 });
      }
      const drink = this.recipes[o.recipeId]?.label ?? o.recipeId;
      const title = `#${o.id} ${drink}`;
      if (card.name.text !== title) card.name.setText(title);
      card.bag.setVisible(o.service === 'takeaway');
      const who = `${c ? this.archetypeLabel(c.archetype) : ''} · ${t(o.service === 'takeaway' ? 'service.takeaway' : 'service.dineIn')} · ${t(`order.${o.status}`)}`;
      if (card.sub.text !== who) card.sub.setText(who);
      const patience = c?.patience ?? 1;
      card.bar.setValue(patience).setFill(patience > 0.5 ? COLORS.leaf : patience > 0.25 ? COLORS.gold : COLORS.error);
      card.bar.tick(dtMs);
    });
    const hidden = orders.length - shown;
    this.more.setVisible(hidden > 0 || orders.length === 0).setText(orders.length === 0 ? t('orders.none') : t('orders.more', { n: hidden }));
    this.more.setColor(css(this.upward ? COLORS.cream : COLORS.creamDim));
    const moreY = this.upward ? (orders.length === 0 ? 16 : -shown * (CARD_H + GAP) + 20) : HEAD_H + Math.max(1, shown) * (CARD_H + GAP) - (orders.length === 0 ? CARD_H - 8 : 0);
    this.more.setY(moreY);
  }

  /** Bottom edge in HUD coordinates. */
  get bottom(): number {
    return this.y + this.lastH;
  }

  destroy(): void {
    this.root.destroy();
  }
}
