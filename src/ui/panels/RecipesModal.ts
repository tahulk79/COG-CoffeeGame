import { t } from '../../core/i18n';
import type { RecipeTable } from '../../gameplay/cafe/OrderService';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import type { ItemTable } from '../../systems/economy/TransactionService';
import { PagedListModal, type RowData } from '../components/PagedListModal';

interface RecipeLike {
  label: string;
  basePrice: number;
  expReward: number;
  ingredients: Array<{ itemId?: string; category?: string; utility?: string; qty: number }>;
}

/** Recipe book: every recipe with price, EXP, ingredients vs. your stock, and the level that unlocks it. */
export class RecipesModal extends PagedListModal {
  constructor(
    scene: Phaser.Scene,
    private readonly recipes: RecipeTable,
    private readonly items: ItemTable,
    private readonly unlockLevel: Record<string, number>,
    onClosed?: () => void,
  ) {
    super(scene, t('recipes.title'), 'recipes', 560, 440, onClosed);
  }

  private have(s: SimulationSnapshot, g: RecipeLike['ingredients'][number]): number {
    const inv = s.economy.inventory;
    if (g.utility) return Infinity;
    if (g.itemId) return inv[g.itemId]?.qty ?? 0;
    return Object.entries(inv).filter(([id]) => this.items[id]?.category === g.category).reduce((a, [, st]) => a + st.qty, 0);
  }

  protected rowsFor(s: SimulationSnapshot): RowData[] {
    return Object.entries(this.recipes).map(([id, r0]) => {
      const r = r0 as unknown as RecipeLike;
      const need = this.unlockLevel[id] ?? 1;
      const locked = s.progression.level < need;
      const ing = r.ingredients.map((g) => {
        const name = g.utility ? t(`recipes.utility.${g.utility}`) : g.itemId ? this.items[g.itemId]?.label ?? g.itemId : t(`inv.cat.${g.category}`);
        const ok = this.have(s, g) >= g.qty;
        return `${ok ? '✓' : '✗'} ${g.qty}× ${name}`;
      });
      const short = r.ingredients.some((g) => this.have(s, g) < g.qty);
      return {
        key: `${id}|${locked}|${ing.join(',')}`,
        icon: locked ? 'lock' : 'cup',
        title: `${r.label}  ·  ${r.basePrice} xu  ·  ${r.expReward} EXP`,
        lines: [ing.join('   ')],
        status: locked ? t('recipes.locked', { n: need }) : short ? t('recipes.short') : t('recipes.ready'),
        statusTone: locked ? 'bad' : short ? 'warn' : 'ok',
        dim: locked,
      };
    });
  }

  protected override footer(s: SimulationSnapshot): string {
    const next = Object.entries(this.unlockLevel).filter(([, l]) => l > s.progression.level).sort((a, b) => a[1] - b[1])[0];
    return next ? t('recipes.next', { recipe: this.recipes[next[0]]?.label ?? next[0], n: next[1] }) : t('recipes.all');
  }
}
