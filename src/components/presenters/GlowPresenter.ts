import type { RecipeTable } from '../../gameplay/cafe/OrderService';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { stationOf } from '../../gameplay/world/types';
import type { WorldModel } from '../../gameplay/world/WorldModel';
import { COLORS } from '../../ui/theme/tokens';
import type { WorldRenderer } from '../render/WorldRenderer';

/**
 * Outlines what the player should look at next: the café station for the next
 * brewing step, the counter when someone waits to order, the seat of the
 * customer your drink is for, and farm plots that are ready, thirsty or ready
 * for seeds. Everything is derived from the real snapshot.
 */
export class GlowPresenter {
  constructor(
    private readonly renderer: Pick<WorldRenderer, 'setGlows' | 'setIndicators' | 'setObjectVisual'>,
    private readonly world: WorldModel,
    private readonly recipes: RecipeTable,
  ) {}

  private byType(type: string): string | undefined {
    return this.world.allObjects().find((o) => o.type === type || stationOf(o) === type)?.id;
  }

  sync(s: SimulationSnapshot): void {
    const glows: Record<string, number> = {};
    const cafe = s.cafe;
    if (cafe) {
      if (cafe.heldDrink) {
        const c = cafe.customers.find((x) => x.orderId === cafe.heldDrink!.orderId);
        if (c?.spot) glows[c.spot] = COLORS.gold;
      } else if (cafe.brew) {
        const step = cafe.brew.current;
        if (step && !cafe.brew.armed) {
          const id = this.byType(step.station);
          if (id) glows[id] = COLORS.gold;
        }
      } else if (cafe.nextToBrew !== null) {
        const order = cafe.orders.find((o) => o.id === cafe.nextToBrew);
        const first = order ? (this.recipes[order.recipeId] as unknown as { steps?: Array<{ station: string }> })?.steps?.[0] : undefined;
        const id = first ? this.byType(first.station) : undefined;
        if (id) glows[id] = COLORS.gold;
      }
      if (cafe.customers.some((c) => c.state === 'ORDERING' && c.orderStatus === 'CREATED')) {
        const id = this.byType('order_counter');
        if (id) glows[id] = COLORS.leaf;
      }
    }
    for (const p of s.farm.plots) {
      if (p.locked) continue;
      if (p.phase === 'READY') glows[p.id] = COLORS.gold;
      else if (p.needsWater && s.farm.can.water > 0) glows[p.id] = COLORS.water;
      else if (p.phase === 'PREPARED' && s.farm.seedToPlant) glows[p.id] = COLORS.leaf;
    }
    this.renderer.setGlows(glows);
    // World indicators: money waiting to be collected and seats that need cleaning (real game state).
    const items: Array<{ id: string; objectId: string; icon: string }> = [];
    for (const p of cafe?.payments ?? []) items.push({ id: `pay:${p.id}`, objectId: p.objectId, icon: 'coin' });
    for (const st of cafe?.seats ?? []) if (st.state === 'DIRTY' || st.state === 'CLEANING') items.push({ id: `dirty:${st.objectId}`, objectId: st.objectId, icon: 'broom' });
    this.renderer.setIndicators(items);
    for (const table of s.tables) this.renderer.setObjectVisual(table.id, { variant: `tableLevel${table.level}`, caption: `${table.label} · Cấp ${table.level}` });
    // Brewing progress above the machine each session is using (player or employee).
    const busy = new Map((cafe?.brewSessions ?? []).filter((b) => b.stationObjectId).map((b) => [b.stationObjectId!, b.progress]));
    for (const o of this.world.allObjects()) {
      if (!['grinder', 'cafe_espresso', 'milk_station'].includes(stationOf(o))) continue;
      const p = busy.get(o.id);
      this.renderer.setObjectVisual(o.id, p === undefined ? { variant: 'default' } : { variant: 'default', progress: Math.max(0.05, p) });
    }
  }
}
