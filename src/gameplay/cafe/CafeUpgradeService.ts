import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import type { TransactionService } from '../../systems/economy/TransactionService';
import type { Footprint } from '../../utils/tile';
import type { WorldModel } from '../world/WorldModel';
import type { GameState } from '../state/GameState';

export interface UpgradeDef {
  label: string;
  desc: string;
  effect: 'brewTime' | 'cleanTime' | 'capacity' | 'traffic' | 'section';
  perLevel: number;
  levels: Array<{ cost: number; requiresLevel: number }>;
  /** `section` upgrades: extra decorating area that opens at level 1. */
  area?: Footprint[];
}

export interface CafeUpgradeConfig {
  upgrades: Record<string, UpgradeDef>;
}

export interface UpgradeView {
  id: string;
  label: string;
  desc: string;
  level: number;
  max: number;
  /** Cost of the next level (null at max). */
  cost: number | null;
  requiresLevel: number | null;
  canBuy: boolean;
  /** Why it cannot be bought now ('', or an i18n key suffix). */
  reason: '' | 'maxed' | 'levelTooLow' | 'insufficientCoins';
}

export interface TableUpgradeView { id: string; label: string; level: number; max: number; cost: number | null; canBuy: boolean; reason: string; comfort: number; decor: number; }
export const TABLE_TYPES = new Set(['cafe_table', 'cafe_table_long', 'table_2']);
const TABLE_PRICES = [150, 400, 900];

export type UpgradeResult = { ok: true } | { ok: false; reason: string };

/** Extra decorating areas opened by `section` upgrades (read before the upgrade service exists, when the furniture layout loads). */
export function sectionAreas(cafe: GameState['cafe'], config: CafeUpgradeConfig): Footprint[] {
  return Object.entries(config.upgrades).flatMap(([id, u]) => (u.effect === 'section' && (cafe.upgrades[id] ?? 0) > 0 ? u.area ?? [] : []));
}

/**
 * Café expansion (H): permanent upgrades that change real gameplay numbers — how long machines
 * and cleaning take, how many customers fit, how often they come — and open the back room as new
 * decorating area. Levels are saved in `state.cafe.upgrades`; each purchase is one transaction
 * with an idempotency key (`upgrade:<id>:<level>`).
 */
export class CafeUpgradeService {
  constructor(
    private readonly state: GameState,
    readonly config: CafeUpgradeConfig,
    private readonly tx: TransactionService,
    private readonly bus: EventBus<GameEvents>,
    private readonly playerLevel: () => number,
  ) {}

  level(id: string): number {
    return this.state.cafe.upgrades[id] ?? 0;
  }

  /** Multiplier on an action's duration (1 = base). Floors at 40%. */
  factor(id: string): number {
    const u = this.config.upgrades[id];
    return u ? Math.max(0.4, 1 - u.perLevel * this.level(id)) : 1;
  }

  /** Extra customers allowed in the café at once. */
  capacityBonus(): number {
    return Object.entries(this.config.upgrades).reduce((n, [id, u]) => (u.effect === 'capacity' ? n + u.perLevel * this.level(id) : n), 0);
  }

  /** Multiplier on customer arrival rate. */
  trafficFactor(): number {
    return Object.entries(this.config.upgrades).reduce((f, [id, u]) => (u.effect === 'traffic' ? f + u.perLevel * this.level(id) : f), 1);
  }

  extraArea(): Footprint[] {
    return sectionAreas(this.state.cafe, this.config);
  }

  canBuy(id: string): UpgradeResult {
    const u = this.config.upgrades[id];
    if (!u) return { ok: false, reason: 'unknownUpgrade' };
    const next = u.levels[this.level(id)];
    if (!next) return { ok: false, reason: 'maxed' };
    if (this.playerLevel() < next.requiresLevel) return { ok: false, reason: 'levelTooLow' };
    const check = this.tx.check({ reason: `upgrade:${id}`, coins: -next.cost });
    return check.ok ? { ok: true } : { ok: false, reason: check.error };
  }

  buy(id: string): UpgradeResult {
    const can = this.canBuy(id);
    if (!can.ok) return can;
    const u = this.config.upgrades[id]!;
    const lv = this.level(id) + 1;
    const res = this.tx.execute({ reason: `upgrade:${id}:${lv}`, coins: -u.levels[lv - 1]!.cost, key: `upgrade:${id}:${lv}` });
    if (!res.ok) return { ok: false, reason: res.error };
    this.state.cafe.upgrades[id] = lv;
    this.bus.emit('cafe:upgraded', { id, level: lv });
    return { ok: true };
  }

  tables(world: WorldModel): TableUpgradeView[] {
    return world.allObjects().filter((o) => TABLE_TYPES.has(o.type)).map((o, i) => {
      const bought = this.state.cafe.upgrades[`table:${o.id}`] ?? 0;
      const cost = TABLE_PRICES[bought] ?? null;
      const reason = cost === null ? 'maxed' : this.playerLevel() < 1 + bought * 2 ? 'levelTooLow' : this.tx.coins < cost ? 'insufficientCoins' : '';
      return { id: o.id, label: `Bàn ${i + 1}`, level: bought + 1, max: 4, cost, canBuy: !reason, reason, comfort: bought * 2, decor: bought };
    });
  }

  buyTable(world: WorldModel, id: string): UpgradeResult {
    const table = this.tables(world).find((t) => t.id === id);
    if (!table) return { ok: false, reason: 'unknownTable' };
    if (!table.canBuy) return { ok: false, reason: table.reason };
    const paid = this.tx.execute({ reason: `upgrade:table:${id}:${table.level + 1}`, coins: -table.cost!, key: `upgrade:table:${id}:${table.level + 1}` });
    if (!paid.ok) return { ok: false, reason: paid.error };
    this.state.cafe.upgrades[`table:${id}`] = table.level;
    this.bus.emit('cafe:upgraded', { id, level: table.level + 1 });
    return { ok: true };
  }

  view(): UpgradeView[] {
    return Object.entries(this.config.upgrades).map(([id, u]) => {
      const level = this.level(id);
      const next = u.levels[level];
      const can = this.canBuy(id);
      return {
        id,
        label: u.label,
        desc: u.desc,
        level,
        max: u.levels.length,
        cost: next?.cost ?? null,
        requiresLevel: next?.requiresLevel ?? null,
        canBuy: can.ok,
        reason: can.ok ? '' : can.reason === 'maxed' ? 'maxed' : can.reason === 'levelTooLow' ? 'levelTooLow' : 'insufficientCoins',
      };
    });
  }
}
