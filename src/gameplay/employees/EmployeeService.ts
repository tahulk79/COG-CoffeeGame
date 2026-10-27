import type { Clock } from '../../core/Clock';
import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import { Actor, type ActorState, type Facing } from '../../entities/Actor';
import type { TransactionService } from '../../systems/economy/TransactionService';
import { InteractionService, type InteractionConfig } from '../../systems/interaction/InteractionService';
import type { NavigationService } from '../../systems/navigation/NavigationService';
import { tileCenter, type TilePos, type WorldPos } from '../../utils/tile';
import type { ActionRegistry } from '../actions/ActionRegistry';
import type { BrewingService } from '../cafe/BrewingService';
import type { CafeService } from '../cafe/CafeService';
import type { FarmService } from '../farm/FarmService';
import type { EmployeeState, GameState } from '../state/GameState';
import { stationOf } from '../world/types';
import type { WorldModel } from '../world/WorldModel';

export interface EmployeeRoleConfig {
  label: string;
  /** The employee only works while the player is on this map. */
  map: string;
  hireCost: number;
  /** Coins per payroll period. */
  wage: number;
  payrollMs: number;
  unlockLevel: number;
  speedTilesPerSec: number;
  /** Wait before looking for work again after finding none / a failed attempt. */
  retryMs: number;
  /** Barista: timing-step accuracy 0–1 (a human hits ~1 with practice). */
  skill?: number;
  /** Barista: finished drinks go to the pickup pool for a server instead of into their hands. */
  stash?: boolean;
  /** One-line description of what the role does (shown in the staff panel). */
  duty?: string;
  /** Cashier: also collects customers' pending payments (configurable). */
  collectsPayments?: boolean;
}

export interface EmployeeConfig {
  maxPerRole: number;
  roles: Record<string, EmployeeRoleConfig>;
}

export type EmployeeResult = { ok: true } | { ok: false; reason: string };

export interface EmployeeView {
  id: string;
  role: string;
  label: string;
  name: string;
  pos: WorldPos;
  tile: TilePos;
  state: ActorState;
  facing: Facing;
  /** 'working' while a task is under way, 'idle' with nothing to do, 'unpaid' when the wage is overdue. */
  status: 'working' | 'idle' | 'unpaid';
  /** Action label of the current task, or null. */
  task: string | null;
  progress: number | null;
  heldDrink: string | null;
}

export interface EmployeeView2 {
  hired: EmployeeView[];
  /** Hireable roles on this map. */
  roles: Array<{ role: string; label: string; cost: number; wage: number; unlockLevel: number; count: number; max: number }>;
}

interface Runtime {
  actor: Actor;
  interaction: InteractionService;
  retryAt: number;
}

/** A task = "use this action on this object". Employees run them through the same InteractionService as the player. */
interface Task {
  objectId: string;
  actionId: string;
}

type Policy = (rt: Runtime, role: EmployeeRoleConfig) => Task | null;

const NAMES = ['An', 'Bình', 'Cúc', 'Dũng', 'Giang', 'Hà', 'Khoa', 'Lan'];

/**
 * Employees (M8). Each hired employee on the current map is an Actor with its
 * own InteractionService, so walking, approach rules, WORKING progress and
 * action validation are exactly the player's. A per-role policy only decides
 * *what to request next*; handlers still check the rules and perform the
 * work through the normal services (and the TransactionService).
 *
 * Hiring costs coins once; wages are charged each payroll period against the
 * real clock. An unpaid employee stops working until the wage can be paid.
 */
export class EmployeeService {
  private readonly runtimes = new Map<string, Runtime>();
  private readonly policies: Record<string, Policy>;

  constructor(
    private readonly state: GameState,
    private readonly world: WorldModel,
    private readonly nav: NavigationService,
    private readonly actions: ActionRegistry,
    private readonly bus: EventBus<GameEvents>,
    private readonly tx: TransactionService,
    private readonly clock: Clock,
    private readonly farm: FarmService,
    private readonly cafe: CafeService | null,
    private readonly brewing: BrewingService,
    readonly config: EmployeeConfig,
    private readonly mapId: string,
    private readonly bodyRadius: number,
    private readonly interactionConfig: InteractionConfig,
    private readonly simNow: () => number,
    private readonly playerLevel: () => number,
    private readonly spawnTile: TilePos,
    /** Skills (M10) lower wages; 1 = full wage. */
    private readonly wageFactor: () => number = () => 1,
    /** Upgrades make baristas work faster (1 = base pace). */
    private readonly paceFactor: () => number = () => 1,
  ) {
    this.policies = { farmWorker: (rt) => this.farmTask(rt), cashier: (rt, role) => this.cashierTask(rt, role), cleaner: (rt) => this.cleanerTask(rt), barista: (rt, role) => this.baristaTask(rt, role), server: (rt) => this.serverTask(rt) };
    for (const e of state.employees.list) if (this.roleOn(e.role)) this.spawn(e);
    // A refused or failed task (unreachable, requirements changed): wait before trying again.
    bus.on('interaction:failed', ({ actorId }) => {
      const rt = this.runtimes.get(actorId);
      const e = state.employees.list.find((x) => x.id === actorId);
      if (rt && e) rt.retryAt = this.simNow() + this.config.roles[e.role]!.retryMs;
    });
  }

  private roleOn(role: string): EmployeeRoleConfig | undefined {
    const r = this.config.roles[role];
    return r && r.map === this.mapId ? r : undefined;
  }

  // ── hiring ──────────────────────────────────────────────────────────────

  canHire(role: string): EmployeeResult {
    const r = this.roleOn(role);
    if (!r) return { ok: false, reason: 'noSuchRole' };
    if (this.playerLevel() < r.unlockLevel) return { ok: false, reason: 'levelTooLow' };
    if (this.state.employees.list.filter((e) => e.role === role).length >= this.config.maxPerRole) return { ok: false, reason: 'teamFull' };
    const check = this.tx.check({ reason: `hire:${role}`, coins: -r.hireCost });
    return check.ok ? { ok: true } : { ok: false, reason: check.error };
  }

  hire(role: string): EmployeeResult {
    const c = this.canHire(role);
    if (!c.ok) return c;
    const r = this.config.roles[role]!;
    const id = `emp_${this.state.employees.nextId}`;
    const res = this.tx.execute({ reason: `hire:${role}`, coins: -r.hireCost, key: `hire:${id}` });
    if (!res.ok) return { ok: false, reason: res.error };
    const now = this.clock.now();
    const e: EmployeeState = { id, role, name: NAMES[(this.state.employees.nextId - 1) % NAMES.length]!, hiredAt: now, nextPayAt: now + r.payrollMs, unpaid: false };
    this.state.employees.nextId += 1;
    this.state.employees.list.push(e);
    this.spawn(e);
    this.bus.emit('employee:hired', { employeeId: id, role });
    return { ok: true };
  }

  /** Dismiss an employee. The hiring fee is not refunded. */
  fire(id: string): EmployeeResult {
    const i = this.state.employees.list.findIndex((e) => e.id === id);
    if (i < 0) return { ok: false, reason: 'unknownEmployee' };
    const [e] = this.state.employees.list.splice(i, 1);
    this.runtimes.get(id)?.interaction.cancelAll('superseded', false);
    this.brewing.unregisterActor(id);
    this.runtimes.delete(id);
    this.bus.emit('employee:fired', { employeeId: id, role: e!.role });
    return { ok: true };
  }

  private spawn(e: EmployeeState): void {
    const role = this.config.roles[e.role]!;
    const actor = new Actor(e.id, tileCenter(this.spawnTile), { speedTilesPerSec: role.speedTilesPerSec, bodyRadius: this.bodyRadius }, this.simNow);
    actor.fsm.onTransition((from, to) => this.bus.emit('actor:stateChanged', { actorId: actor.id, from, to }));
    const interaction = new InteractionService(actor, this.world, this.nav, this.actions, this.bus, { ...this.interactionConfig, maxQueuedInteractions: 1 });
    if (role.map === this.mapId && this.cafe) this.brewing.registerActor(actor, role.stash === true);
    this.runtimes.set(e.id, { actor, interaction, retryAt: 0 });
  }

  // ── simulation ──────────────────────────────────────────────────────────

  tick(dtMs: number): void {
    const wallNow = this.clock.now();
    for (const e of this.state.employees.list) {
      const rt = this.runtimes.get(e.id);
      if (!rt) continue;
      this.payroll(e, wallNow);
      rt.interaction.tick(dtMs);
      if (e.unpaid) continue;
      const snap = rt.interaction.snapshot();
      if (snap.current || snap.queue.length > 0) continue;
      if (this.simNow() < rt.retryAt) continue;
      const task = this.policies[e.role]?.(rt, this.config.roles[e.role]!) ?? null;
      const ok = task ? rt.interaction.request(task.objectId, task.actionId) !== null : false;
      // Nothing to do (or the request was refused): look again shortly instead of every tick.
      if (!ok) rt.retryAt = this.simNow() + this.config.roles[e.role]!.retryMs * (e.role === 'barista' ? this.paceFactor() : 1);
    }
  }

  private payroll(e: EmployeeState, wallNow: number): void {
    const r = this.config.roles[e.role]!;
    while (wallNow >= e.nextPayAt) {
      const res = this.tx.execute({ reason: `wage:${e.role}`, coins: -Math.round(r.wage * this.wageFactor()), key: `wage:${e.id}:${e.nextPayAt}` });
      if (!res.ok) {
        if (!e.unpaid) this.bus.emit('employee:unpaid', { employeeId: e.id });
        e.unpaid = true;
        return;
      }
      e.unpaid = false;
      e.nextPayAt += r.payrollMs;
      this.bus.emit('employee:paid', { employeeId: e.id, coins: r.wage });
    }
    // Paid up: an employee who was unpaid works again.
    e.unpaid = false;
  }

  /** The walkable grid changed (furniture): employees re-plan like the player. */
  onNavChanged(): void {
    for (const rt of this.runtimes.values()) rt.interaction.onNavChanged();
  }

  onObjectRemoved(objectId: string): void {
    for (const rt of this.runtimes.values()) rt.interaction.onObjectRemoved(objectId);
  }

  actorTiles(): TilePos[] {
    return [...this.runtimes.values()].map((rt) => rt.actor.tile);
  }

  // ── policies ────────────────────────────────────────────────────────────

  /** Objects another employee is already heading for, so two workers don't pick the same plot. */
  private claimed(except: Runtime): Set<string> {
    const out = new Set<string>();
    for (const rt of this.runtimes.values()) {
      if (rt === except) continue;
      const cur = rt.interaction.snapshot().current;
      if (cur) out.add(cur.objectId);
    }
    return out;
  }

  /**
   * Farm worker priority: harvest ripe crops → water thirsty ones (refilling
   * the can at the well when it is empty) → plant prepared soil → prepare
   * empty soil (only when seeds are available). Nearest plot first.
   */
  private farmTask(rt: Runtime): Task | null {
    const taken = this.claimed(rt);
    const here = rt.actor.tile;
    const dist = (id: string): number => {
      const o = this.world.getObject(id);
      return o ? Math.max(Math.abs(o.footprint.x - here.x), Math.abs(o.footprint.y - here.y)) : Infinity;
    };
    const plots = this.farm.allPlotViews().filter((p) => !p.locked && !taken.has(p.id));
    const nearest = (ids: string[]): string | null => ids.sort((a, b) => dist(a) - dist(b))[0] ?? null;
    const pick = (action: string, can: (id: string) => boolean): Task | null => {
      const id = nearest(plots.map((p) => p.id).filter(can));
      return id ? { objectId: id, actionId: action } : null;
    };

    const harvest = pick('harvest', (id) => this.farm.canHarvest(id).ok);
    if (harvest) return harvest;

    const thirsty = plots.filter((p) => p.needsWater).map((p) => p.id);
    if (thirsty.length > 0) {
      if (this.farm.canWater > 0) {
        const t = pick('water', (id) => this.farm.canWaterPlot(id).ok);
        if (t) return t;
      } else if (this.farm.canRefill().ok) {
        const well = this.world.allObjects().find((o) => o.type === 'well' && !taken.has(o.id));
        if (well) return { objectId: well.id, actionId: 'refill' };
      }
    }

    const plant = pick('plant', (id) => this.farm.canPlant(id).ok);
    if (plant) return plant;
    return this.farm.seedToPlant() ? pick('prepare', (id) => this.farm.canPrepare(id).ok) : null;
  }

  /**
   * Cashier: take the order of the customer waiting at the counter (needs a free seat / pickup point,
   * like the player); with `collectsPayments`, otherwise collect the coins customers left behind.
   */
  private cashierTask(rt: Runtime, role: EmployeeRoleConfig): Task | null {
    const taken = this.claimed(rt);
    const counter = this.world.allObjects().find((o) => o.type === 'order_counter');
    if (this.cafe?.canTakeOrder().ok && counter && !taken.has(counter.id)) return { objectId: counter.id, actionId: 'take_order' };
    if (role.collectsPayments && this.cafe) {
      const next = this.nearest(rt, this.cafe.pendingPayments().map((p) => p.objectId).filter((id) => !taken.has(id)));
      if (next) return { objectId: next, actionId: 'collect_payment' };
    }
    return null;
  }

  /** Cleaner: walk to the nearest dirty seat nobody is cleaning and clean it. */
  private cleanerTask(rt: Runtime): Task | null {
    if (!this.cafe) return null;
    const taken = this.claimed(rt);
    const next = this.nearest(rt, this.cafe.dirtySeatIds().filter((id) => !taken.has(id)));
    return next ? { objectId: next, actionId: 'clean_seat' } : null;
  }

  private nearest(rt: Runtime, ids: string[]): string | null {
    const here = rt.actor.tile;
    const d = (id: string): number => {
      const o = this.world.getObject(id);
      return o ? Math.hypot(o.footprint.x - here.x, o.footprint.y - here.y) : Infinity;
    };
    return [...ids].sort((a, b) => d(a) - d(b))[0] ?? null;
  }

  /**
   * Barista: brew the oldest accepted order at the stations, one step per
   * `retryMs`. Starts only when the order can be finished (a bean and the
   * recipe's milk are in stock). The drink goes to the pickup pool.
   */
  private baristaTask(rt: Runtime, role: EmployeeRoleConfig): Task | null {
    const actor = rt.actor;
    if (this.brewing.hasSession(actor)) {
      if (this.brewing.isArmed(actor)) {
        const r = this.brewing.autoStep(actor, role.skill ?? 0.7);
        if (r.ok || r.reason !== 'notAtStation') return null;
      }
    } else {
      // Claim the order first so a second barista cannot walk to the same drink.
      const orderId = this.brewing.nextOrderToBrew(actor.id);
      if (orderId === null || !this.brewing.canAutoBrew(orderId)) return null;
      this.brewing.reserveNext(actor.id);
    }
    const type = this.brewing.nextStationFor(actor);
    if (!type) return null;
    // Several machines of one type: the nearest one nobody else is using; all busy → wait.
    const taken = this.claimed(rt);
    const here = rt.actor.tile;
    const station = this.world
      .allObjects()
      .filter((o) => stationOf(o) === type && !taken.has(o.id))
      .sort((a, b) => Math.hypot(a.footprint.x - here.x, a.footprint.y - here.y) - Math.hypot(b.footprint.x - here.x, b.footprint.y - here.y))[0];
    return station ? { objectId: station.id, actionId: 'brew_step' } : null;
  }

  /** Server: carry the oldest pooled drink to its seated customer. */
  private serverTask(rt: Runtime): Task | null {
    const held = this.brewing.heldDrink(rt.actor);
    if (held) {
      const spot = this.cafe?.serveSpotFor(held);
      return spot ? { objectId: spot, actionId: 'serve' } : null;
    }
    const next = this.brewing.pooledDrink();
    if (!next || !this.cafe?.serveSpotFor(next)) return null;
    const counter = this.world.allObjects().find((o) => o.type === 'order_counter');
    return counter && !this.claimed(rt).has(counter.id) ? { objectId: counter.id, actionId: 'pickup' } : null;
  }

  // ── views ───────────────────────────────────────────────────────────────

  views(): EmployeeView[] {
    const out: EmployeeView[] = [];
    for (const e of this.state.employees.list) {
      const rt = this.runtimes.get(e.id);
      if (!rt) continue;
      const cur = rt.interaction.snapshot().current;
      const role = this.config.roles[e.role]!;
      out.push({
        id: e.id,
        role: e.role,
        label: role.label,
        name: e.name,
        pos: { ...rt.actor.pos },
        tile: rt.actor.tile,
        state: rt.actor.state,
        facing: rt.actor.facing,
        status: e.unpaid ? 'unpaid' : cur ? 'working' : 'idle',
        task: cur?.actionId ?? null,
        progress: cur?.phase === 'work' ? cur.progress : null,
        heldDrink: this.brewing.heldDrink(rt.actor)?.recipeId ?? null,
      });
    }
    return out;
  }

  /** Roles that can be hired on this map, with how many are already on the team. */
  rolesView(): EmployeeView2['roles'] {
    return Object.entries(this.config.roles)
      .filter(([, r]) => r.map === this.mapId)
      .map(([role, r]) => ({ role, label: r.label, cost: r.hireCost, wage: r.wage, unlockLevel: r.unlockLevel, count: this.state.employees.list.filter((e) => e.role === role).length, max: this.config.maxPerRole }));
  }

  get available(): boolean {
    return this.rolesView().length > 0;
  }
}
