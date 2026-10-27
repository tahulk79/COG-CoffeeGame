import Phaser from 'phaser';
import { t } from '../core/i18n';
import type { BrewingConfig, BrewStep } from '../gameplay/cafe/BrewingService';
import type { RecipeTable } from '../gameplay/cafe/OrderService';
import type { SimulationSnapshot } from '../gameplay/GameSimulation';
import type { ItemTable } from '../systems/economy/TransactionService';
import { PANEL_W } from './FarmHud';
import { GameProgressBar } from './components/GameProgressBar';
import { COLORS } from './theme/tokens';
import { Button } from './widgets/Button';
import { CSS, TEXT } from './theme/textStyles';
import { Panel } from './components/Panel';
import { setShown } from './components/panelVisibility';

type Result = { ok: true } | { ok: false; reason: string };

/** The only commands the café panel may issue. */
export interface CafeUiCommands {
  chooseBean(itemId: string): Result;
  chooseAddition(additionId: string): Result;
  press(): Result;
  cancelBrew(): Result;
  buySupply(itemId: string, qty: number): Result;
}

const BAR_W = PANEL_W - 20;
const HEIGHT = 306;
const STEP_Y = 100;
const BAR_Y = 122;
const BTN_Y = 150;
const SUP_Y = 226;


/**
 * Contextual brewing panel (bottom right): only shown while a drink is being
 * made, a finished drink is in hand, or at the supply shelf. Orders, coins,
 * level and ratings live in the main HUD; world actions (counter, stations,
 * serving) happen by clicking the world. This panel only issues CafeUiCommands.
 */
export class CafeHud {
  readonly buttons = new Map<string, Button>();
  private readonly root: Phaser.GameObjects.Container;
  private readonly background: Panel;
  private viewportW = 0;
  private viewportH = 0;
  private readonly brewInfo: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly ingredients: Phaser.GameObjects.Text;
  private readonly stepBar: GameProgressBar;
  private readonly additionDefs: BrewingConfig['additions'];
  private readonly message: Phaser.GameObjects.Text;
  private readonly press: Button;
  private readonly cancel: Button;
  private readonly supplyTitle: Phaser.GameObjects.Text;
  private readonly beanButtons = new Map<string, Button>();
  private readonly additionButtons = new Map<string, Button>();
  private readonly supplyButtons: Button[] = [];
  private bottomInset = 12;
  private rightInset = 10;
  private forcedHidden = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly commands: CafeUiCommands,
    private readonly recipes: RecipeTable,
    private readonly items: ItemTable,
    brewing: BrewingConfig,
  ) {
    this.root = scene.add.container(0, 0).setDepth(1050).setVisible(false);
    this.background = new Panel(scene, { alpha: .97 }, PANEL_W, HEIGHT).swallowClicks();
    this.root.add(this.background.object);
    const add = (y: number, str: string, style: Phaser.Types.GameObjects.Text.TextStyle = TEXT) => {
      const o = scene.add.text(10, y, str, style);
      this.root.add(o);
      return o;
    };
    add(8, t('brew.title'), { ...TEXT, fontSize: '16px', color: CSS.gold, fontStyle: 'bold' });
    this.brewInfo = add(30, '', { ...TEXT, fontSize: '12px', wordWrap: { width: PANEL_W - 20 } });
    this.additionDefs = brewing.additions;
    this.ingredients = add(80, '', { ...TEXT, fontSize: '12px', wordWrap: { width: PANEL_W - 20 } });
    this.stepBar = new GameProgressBar(scene, 10, STEP_Y, { w: BAR_W, h: 8, fill: COLORS.leaf });
    this.root.add(this.stepBar.object);
    this.bar = scene.add.graphics();
    this.root.add(this.bar);
    const beans = Object.entries(items).filter(([, d]) => d.category === 'roasted');
    beans.forEach(([id, d], i) => {
      this.beanButtons.set(id, this.button(10 + i * 106, BTN_Y, d.label.replace('Hạt rang ', ''), () => this.report(commands.chooseBean(id)), `brew.bean.${id}`));
    });
    Object.entries(brewing.additions).forEach(([id, a], i) => {
      this.additionButtons.set(id, this.button(10 + i * 106, BTN_Y, a.label, () => this.report(commands.chooseAddition(id)), `brew.add.${id}`));
    });
    this.press = this.button(10, BTN_Y, t('brew.press'), () => this.report(commands.press()), 'brew.press');
    this.cancel = this.button(PANEL_W - 100, BTN_Y + 36, t('brew.cancel'), () => this.report(commands.cancelBrew()), 'brew.cancel');
    // Supplies (only while standing at the shelf).
    this.supplyTitle = add(SUP_Y - 22, t('brew.supplies'), { ...TEXT, fontSize: '12px', color: CSS.creamDim });
    Object.entries(brewing.supplies).forEach(([id, price], i) => {
      const label = items[id]?.label ?? id;
      this.supplyButtons.push(this.button(10, SUP_Y + i * 30, t('supply.buy', { item: label, n: 1, price }), () => this.report(commands.buySupply(id, 1)), `supply.1.${id}`));
      this.supplyButtons.push(this.button(200, SUP_Y + i * 30, `x5 (${price * 5})`, () => this.report(commands.buySupply(id, 5)), `supply.5.${id}`));
    });
    this.message = add(HEIGHT - 24, '', { ...TEXT, fontSize: '12px', color: CSS.leaf });
  }

  private button(x: number, y: number, label: string, onClick: () => void, name: string): Button {
    const b = new Button(this.scene, x, y, label, onClick, name);
    this.root.add(b.text);
    this.buttons.set(name, b);
    return b;
  }

  /** Bottom-right placement, set by the HUD layout (insets keep it off the toolbar and safe areas). */
  place(w: number, h: number, right: number, bottom: number): void {
    this.viewportW = w; this.viewportH = h;
    this.rightInset = right;
    this.bottomInset = bottom;
    this.root.setPosition(w - PANEL_W - right, h - HEIGHT - bottom);
  }

  private report(r: Result): void {
    this.message.setColor(r.ok ? CSS.leaf : CSS.error);
    this.message.setText(r.ok ? '' : t(`feedback.fail.${r.reason}`));
  }

  /** Space bar = stop the needle. */
  pressShortcut(): void {
    if (this.press.isEnabled && this.root.visible) this.report(this.commands.press());
  }

  update(s: SimulationSnapshot): void {
    const cafe = s.cafe;
    if (!cafe) return;
    const atShelf = s.shop === 'supplies';
    const relevant = !!cafe.brew || !!cafe.heldDrink || atShelf;
    const height = cafe.heldDrink && !cafe.brew && !atShelf ? 104 : HEIGHT;
    this.background.set(PANEL_W, height);
    this.root.setPosition(this.viewportW-PANEL_W-this.rightInset, this.viewportH-height-this.bottomInset);
    setShown(this.root, relevant && !this.forcedHidden);
    this.updateBrew(s);
    this.supplyTitle.setVisible(atShelf);
    for (const b of this.supplyButtons) b.setVisible(atShelf);
  }

  /** "✓ 1× Hạt rang  ✗ 1× Sữa (thiếu)" for a recipe, plus whether anything is short. */
  private ingredientLine(recipeId: string, s: SimulationSnapshot): { text: string; short: boolean } {
    const r = this.recipes[recipeId] as unknown as { ingredients: Array<{ itemId?: string; category?: string; utility?: string; qty: number }> } | undefined;
    if (!r) return { text: '', short: false };
    const inv = s.economy.inventory;
    let short = false;
    const parts = r.ingredients.map((g) => {
      const have = g.utility ? Infinity : g.itemId ? inv[g.itemId]?.qty ?? 0 : Object.entries(inv).filter(([id]) => this.items[id]?.category === g.category).reduce((a, [, st]) => a + st.qty, 0);
      const ok = have >= g.qty;
      if (!ok) short = true;
      const name = g.utility ? t(`recipes.utility.${g.utility}`) : g.itemId ? this.items[g.itemId]?.label ?? g.itemId : t(`inv.cat.${g.category}`);
      return `${ok ? '✓' : '✗'} ${g.qty}× ${name}${ok ? '' : ` (${t('brew.short')})`}`;
    });
    return { text: `${t('brew.needs')}: ${parts.join('  ')}`, short };
  }

  private updateBrew(s: SimulationSnapshot): void {
    const cafe = s.cafe!;
    const brew = cafe.brew;
    for (const b of [...this.beanButtons.values(), ...this.additionButtons.values(), this.press, this.cancel]) b.setVisible(false);
    this.bar.clear();

    this.stepBar.setVisible(!!brew);
    this.ingredients.setVisible(!!brew);
    if (cafe.heldDrink) {
      const d = cafe.heldDrink;
      set(this.brewInfo, `${t('brew.done')}\n${t('brew.holding', { drink: this.recipes[d.recipeId]?.label ?? d.recipeId, q: d.quality, order: d.orderId })}`);
      return;
    }
    if (!brew) {
      set(this.brewInfo, t('brew.idle'));
      return;
    }
    const ing = this.ingredientLine(brew.recipeId, s);
    set(this.ingredients, ing.text);
    this.ingredients.setColor(ing.short ? CSS.error : CSS.creamDim);
    this.stepBar.setValue(brew.steps.length ? brew.stepIndex / brew.steps.length : 0);
    this.stepBar.tick(16);
    const step = brew.current;
    const progress = brew.steps.map((st, i) => (i < brew.stepIndex ? '✓' : i === brew.stepIndex ? '▶' : '·') + t(`brew.step.${st.id}`) + (brew.scores[st.id] !== undefined ? ` ${Math.round(brew.scores[st.id]! * 100)}%` : '')).join(' ');
    const where = step ? t(`brew.station.${step.station}`) : '';
    const hint = !step ? '' : !brew.armed ? t('brew.goTo', { station: where }) : t(`brew.do.${step.kind}`);
    set(this.brewInfo, `#${brew.orderId} ${this.recipes[brew.recipeId]?.label ?? brew.recipeId}\n${progress}\n${hint}`);
    this.cancel.setVisible(true);
    if (!step || !brew.armed) return;

    if (step.kind === 'choose_bean') {
      const owned = s.economy.inventory;
      for (const [id, b] of this.beanButtons) b.setVisible(true).setEnabled((owned[id]?.qty ?? 0) > 0);
    } else if (step.kind === 'choose_addition') {
      for (const [id, b] of this.additionButtons) {
        const item = this.additionDefs[id]?.itemId;
        b.setVisible(true).setEnabled(!item || (s.economy.inventory[item]?.qty ?? 0) > 0);
      }
    } else {
      this.drawNeedle(step, brew.needle ?? 0);
      this.press.setVisible(true).setEnabled(true);
    }
  }

  private drawNeedle(step: Extract<BrewStep, { kind: 'timing' }>, needle: number): void {
    const y = BAR_Y;
    this.bar.fillStyle(0x3a2a20, 1).fillRoundedRect(10, y, BAR_W, 16, 8);
    const lo = Math.max(0, step.target - step.tolerance);
    const hi = Math.min(1, step.target + step.tolerance);
    this.bar.fillStyle(0x6fa86c, 1).fillRoundedRect(10 + lo * BAR_W, y, Math.max(6, (hi - lo) * BAR_W), 16, 8);
    this.bar.fillStyle(0xfff1d8, 1).fillRoundedRect(10 + needle * BAR_W - 3, y - 4, 6, 24, 3);
  }

  /** Hidden while the decorate panel is open. */
  setVisible(on: boolean): void {
    this.forcedHidden = !on;
    if (!on) setShown(this.root, false);
  }

  destroy(): void {
    this.root.destroy();
  }
}

const set = (o: Phaser.GameObjects.Text, str: string) => {
  if (o.text !== str) o.setText(str);
};
