import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/events';
import type { Rng } from '../../core/Rng';
import { StateMachine } from '../../core/StateMachine';
import { Actor } from '../../entities/Actor';
import type { NavigationService } from '../../systems/navigation/NavigationService';
import { sameTile, tileCenter, type TilePos, type WorldPos } from '../../utils/tile';
import type { WorldModel } from '../world/WorldModel';
import type { TransactionService } from '../../systems/economy/TransactionService';
import type { Drink } from './BrewingService';
import type { GameState, PaymentRecord } from '../state/GameState';
import type { Order, OrderService, ServiceType } from './OrderService';

/** What a served customer pays and how they rate it. M5: base reward; M6 plugs in quality ratings. */
export interface ServiceOutcome {
  /** Total the customer leaves (price after rating, tip included). */
  coins: number;
  exp: number;
  tip?: number;
}
export type RatingPolicy = (order: Order, drink: Drink, customer: Customer) => ServiceOutcome;

/** Optional links to progression/reputation (all default to neutral). */
export interface CafeHooks {
  /** > 1 = customers arrive more often (good reputation). */
  trafficFactor?: () => number;
  /** Customers only order recipes the player has unlocked. */
  isRecipeUnlocked?: (recipeId: string) => boolean;
  /** A customer left unhappy without being served. */
  onCustomerFailed?: (reason: string) => void;
}
export const baseRewardPolicy: RatingPolicy = (order) => ({ coins: order.reward.coins, exp: order.reward.exp });

export type CustomerState =
  | 'SPAWNING'
  | 'ENTERING'
  | 'QUEUING'
  | 'WALKING_TO_COUNTER'
  | 'ORDERING'
  | 'WAITING'
  | 'RECEIVING_DRINK'
  | 'CONSUMING'
  | 'PAYING'
  | 'LEAVING';

/**
 * SPAWNING → ENTERING → WALKING_TO_COUNTER / QUEUING → ORDERING → WAITING → RECEIVING_DRINK
 *   → CONSUMING (dine-in only) → PAYING → LEAVING.
 * Every state can fall back to LEAVING until the drink is in hand (cancelled order, lost patience,
 * full café, blocked path). Takeaway customers skip CONSUMING.
 */
export const CUSTOMER_TRANSITIONS: Readonly<Record<CustomerState, readonly CustomerState[]>> = {
  SPAWNING: ['ENTERING', 'LEAVING'],
  ENTERING: ['QUEUING', 'WALKING_TO_COUNTER', 'LEAVING'],
  QUEUING: ['WALKING_TO_COUNTER', 'LEAVING'],
  WALKING_TO_COUNTER: ['ORDERING', 'LEAVING'],
  ORDERING: ['WAITING', 'LEAVING'],
  WAITING: ['RECEIVING_DRINK', 'LEAVING'],
  RECEIVING_DRINK: ['CONSUMING', 'PAYING'],
  CONSUMING: ['PAYING'],
  PAYING: ['LEAVING'],
  LEAVING: [],
};

/** Seat life cycle (per chair): AVAILABLE → RESERVED → OCCUPIED → DIRTY → CLEANING → AVAILABLE. */
export type SeatState = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'DIRTY' | 'CLEANING';

export interface ArchetypeDef {
  label: string;
  weight: number;
  speedTilesPerSec: number;
  orderPatienceMs: number;
  drinkPatienceMs: number;
  preferences: Record<string, number>;
  /** Share of this archetype's customers who take their drink away (default `service.takeawayShare`). */
  takeawayShare?: number;
}

export interface CustomerConfig {
  spawn: { firstDelayMs: number; minIntervalMs: number; maxIntervalMs: number; maxConcurrent: number };
  behaviour: {
    retryPathMs: number;
    giveUpBlockedMs: number;
    stuckCheckMs: number;
    maxRepaths: number;
    /** Dine-in customers drink at the seat this long. */
    consumingMs: number;
    /** Rating + payment moment. */
    payingMs: number;
    orderingMs: number;
    receivingMs: number;
  };
  service: { takeawayShare: number };
  /** `collect`: money is left on the seat / pickup point until collected; `auto`: credited at once. */
  payment: { mode: 'collect' | 'auto'; collectMs: number };
  cleaning: { durationMs: number };
  archetypes: Record<string, ArchetypeDef>;
}

interface Spot {
  key: string;
  kind: 'seat' | 'stand' | 'pickup';
  objectId: string;
  tile: TilePos;
}

export interface Customer {
  readonly id: string;
  readonly archetype: string;
  readonly def: ArchetypeDef;
  readonly actor: Actor;
  readonly fsm: StateMachine<CustomerState>;
  readonly recipeId: string;
  /** Changes only when the café is full (dine-in → takeaway). */
  service: ServiceType;
  orderId: number | null;
  spot: Spot | null;
  target: TilePos | null;
  needsPlan: boolean;
  queueWaitMs: number;
  drinkWaitMs: number;
  stateMs: number;
  blockedMs: number;
  retryInMs: number;
  stuckMs: number;
  stuckFrom: WorldPos;
  repaths: number;
  leaveReason: string | null;
  satisfaction: number | null;
  gone: boolean;
  /** Spawned inside the café (not at the street door), so it skips the walk to the door. */
  startedInside: boolean;
  /** The drink handed over (from RECEIVING on). */
  drink: Drink | null;
  outcome: ServiceOutcome | null;
}

export interface CustomerView {
  id: string;
  archetype: string;
  state: CustomerState;
  pos: WorldPos;
  tile: TilePos;
  facing: Actor['facing'];
  recipeId: string;
  service: ServiceType;
  orderId: number | null;
  orderStatus: Order['status'] | null;
  /** Remaining patience for the current phase, 0–1 (null when not waiting). */
  patience: number | null;
  spot: string | null;
}

export type CafeResult = { ok: true } | { ok: false; reason: string; applicable?: boolean };

const FAILURES = new Set(['impatient', 'timeout', 'queueFull', 'blocked', 'noSeat', 'noPickup']);
/** Departures that hurt reputation (a blocked path is a map problem, not service). */
const UNHAPPY = new Set(['impatient', 'timeout', 'queueFull']);

/**
 * Café floor simulation: spawns customers on a schedule, walks them in from
 * the street (never teleports), manages the order queue, seat/standing-spot
 * reservations, patience and departure. Customers are transient (not saved).
 */
export class CafeService {
  private readonly customers = new Map<string, Customer>();

  hasCustomer(id: string): boolean {
    return this.customers.has(id);
  }
  private readonly queue: string[] = [];
  private readonly reserved = new Map<string, string>(); // spot key → customer id
  /** Rebuilt when furniture changes (refreshSpots). */
  private spots: Spot[];
  private nextSpawnAt: number;
  private nextId = 1;
  open = true;
  /** Who is cleaning which seat right now (object id → actor id). Exclusive: one cleaner per seat. */
  private readonly cleaning = new Map<string, string>();
  /** Capacity upgrade: customers allowed in the café at once (set by CafeUpgradeService). */
  maxConcurrentBonus: () => number = () => 0;

  readonly spawnTile: TilePos;
  readonly exitTile: TilePos;
  readonly doorTile: TilePos;
  readonly orderPoint: TilePos;
  readonly queueTiles: TilePos[];

  constructor(
    private readonly world: WorldModel,
    private readonly nav: NavigationService,
    readonly orders: OrderService,
    readonly config: CustomerConfig,
    private readonly bus: EventBus<GameEvents>,
    private readonly rng: Rng,
    private readonly now: () => number,
    private readonly bodyRadius: number,
    private readonly tx: TransactionService,
    private readonly rate: RatingPolicy = baseRewardPolicy,
    private readonly hooks: CafeHooks = {},
    /** Persistent café data: pending payments and dirty seats live here so a reload keeps them. */
    private readonly store: GameState['cafe'] = { ratings: [], feedback: [], stats: { served: 0, failed: 0 }, payments: [], nextPaymentId: 1, dirtySeats: [], upgrades: {} },
    private readonly clock: () => number = () => Date.now(),
    private readonly paymentMode: () => 'collect' | 'auto' = () => config.payment.mode,
  ) {
    const one = (name: string): TilePos => {
      const m = world.markers(name)[0];
      if (!m) throw new Error(`café map needs a "${name}" marker`);
      return m;
    };
    this.spawnTile = one('spawn');
    this.exitTile = one('exit');
    this.doorTile = one('door');
    this.orderPoint = one('orderPoint');
    this.queueTiles = world.markers('queue');
    this.spots = this.collectSpots();
    this.pruneDirty();
    this.nextSpawnAt = now() + config.spawn.firstDelayMs;
    // Cleaning is a real interaction: it only counts while the cleaner is actually working.
    bus.on('interaction:started', (e) => {
      if (e.actionId === 'clean_seat' && this.seatStatus(e.objectId) === 'DIRTY') {
        this.cleaning.set(e.objectId, e.actorId);
        bus.emit('cafe:seatCleaning', { objectId: e.objectId, actorId: e.actorId });
      }
    });
    const stop = (e: { objectId: string; actorId: string }): void => {
      if (this.cleaning.get(e.objectId) === e.actorId) this.cleaning.delete(e.objectId);
    };
    bus.on('interaction:cancelled', stop);
    bus.on('interaction:failed', stop);
  }

  // ── queries ─────────────────────────────────────────────────────────────

  get count(): number {
    return this.customers.size;
  }

  customer(id: string): Customer | undefined {
    return this.customers.get(id);
  }

  queueOrder(): readonly string[] {
    return this.queue;
  }

  /** Seats and standing spots a dine-in customer could still be given (dirty seats do not count). */
  freeSpots(): number {
    return this.spots.filter((sp) => sp.kind !== 'pickup' && this.isFree(sp)).length;
  }

  freePickups(): number {
    return this.spots.filter((sp) => sp.kind === 'pickup' && this.isFree(sp)).length;
  }

  private isFree(sp: Spot): boolean {
    return !this.reserved.has(sp.key) && !this.store.dirtySeats.includes(sp.objectId);
  }

  /** State of one seat (or standing / pickup spot): AVAILABLE, RESERVED, OCCUPIED, DIRTY or CLEANING. */
  seatStatus(objectId: string): SeatState {
    if (this.cleaning.has(objectId)) return 'CLEANING';
    if (this.store.dirtySeats.includes(objectId)) return 'DIRTY';
    const sp = this.spots.find((x) => x.objectId === objectId);
    const owner = sp ? this.reserved.get(sp.key) : undefined;
    if (!owner) return 'AVAILABLE';
    const c = this.customers.get(owner);
    // RESERVED while the customer is on their way; OCCUPIED once they stand / sit there.
    return c && !c.target && !c.fsm.is('ENTERING', 'QUEUING', 'WALKING_TO_COUNTER', 'ORDERING') ? 'OCCUPIED' : 'RESERVED';
  }

  /** Per-seat states for the HUD and the world indicators. */
  seatStates(): Array<{ objectId: string; kind: Spot['kind']; state: SeatState }> {
    return this.spots.map((sp) => ({ objectId: sp.objectId, kind: sp.kind, state: this.seatStatus(sp.objectId) }));
  }

  dirtySeatIds(): string[] {
    return this.store.dirtySeats.filter((id) => this.spots.some((sp) => sp.objectId === id && !this.cleaning.has(id)));
  }

  private pruneDirty(): void {
    // Furniture that no longer exists cannot stay dirty.
    this.store.dirtySeats = this.store.dirtySeats.filter((id) => this.spots.some((sp) => sp.objectId === id));
  }

  /** The customer at the order point waiting for the player to take their order. */
  customerAtCounter(): Customer | undefined {
    const id = this.queue[0];
    const c = id ? this.customers.get(id) : undefined;
    if (!c || !c.fsm.is('ORDERING') || c.orderId === null) return undefined;
    const o = this.orders.get(c.orderId);
    return o?.status === 'CREATED' ? c : undefined;
  }

  views(): CustomerView[] {
    return [...this.customers.values()].map((c) => {
      const order = c.orderId !== null ? this.orders.get(c.orderId) : undefined;
      const s = c.fsm.state;
      const patience = ['QUEUING', 'WALKING_TO_COUNTER', 'ORDERING'].includes(s)
        ? 1 - c.queueWaitMs / c.def.orderPatienceMs
        : s === 'WAITING'
          ? 1 - c.drinkWaitMs / c.def.drinkPatienceMs
          : null;
      return {
        id: c.id,
        archetype: c.archetype,
        state: s,
        pos: { ...c.actor.pos },
        tile: c.actor.tile,
        facing: c.actor.facing,
        recipeId: c.recipeId,
        service: c.service,
        orderId: c.orderId,
        orderStatus: order?.status ?? null,
        patience: patience === null ? null : Math.max(0, Math.min(1, patience)),
        spot: c.spot?.key ?? null,
      };
    });
  }

  // ── player commands ─────────────────────────────────────────────────────

  /**
   * The spot this customer would be given now: an available seat, else a standing spot (dine-in),
   * or a free pickup point (takeaway). A dine-in customer with no seat or standing spot left takes
   * their drink away instead, if a pickup point is free ("full café" fallback).
   */
  private pickSpot(c: Customer): { spot: Spot; convert: boolean } | null {
    const free = (kind: Spot['kind']) => this.spots.find((sp) => sp.kind === kind && this.isFree(sp));
    if (c.service === 'takeaway') {
      const p = free('pickup');
      return p ? { spot: p, convert: false } : null;
    }
    const seat = free('seat') ?? free('stand');
    if (seat) return { spot: seat, convert: false };
    const p = free('pickup');
    return p ? { spot: p, convert: true } : null;
  }

  canTakeOrder(): CafeResult {
    const c = this.customerAtCounter();
    if (!c) return { ok: false, reason: 'noCustomer' };
    if (!this.pickSpot(c)) return { ok: false, reason: c.service === 'takeaway' ? 'noPickup' : 'noSeat' };
    return { ok: true };
  }

  /** Accept the order of the customer at the counter; they go to their reserved seat (dine-in) or pickup point (takeaway). */
  takeOrder(): CafeResult {
    const can = this.canTakeOrder();
    if (!can.ok) return can;
    const c = this.customerAtCounter()!;
    const pick = this.pickSpot(c)!;
    const r = this.orders.transition(c.orderId!, 'ACCEPTED');
    if (!r.ok) return { ok: false, reason: r.reason };
    if (pick.convert) {
      this.bus.emit('customer:serviceChanged', { customerId: c.id, from: c.service, to: 'takeaway', reason: 'fullCafe' });
      c.service = 'takeaway';
      const o = this.orders.get(c.orderId!);
      if (o) o.service = 'takeaway';
    }
    this.removeFromQueue(c.id);
    this.reserved.set(pick.spot.key, c.id);
    c.spot = pick.spot;
    this.setState(c, 'WAITING');
    this.setTarget(c, pick.spot.tile);
    return { ok: true };
  }

  /** Customer who reserved the seat / standing spot object, if any. */
  customerAtSpot(objectId: string): Customer | undefined {
    const spot = this.spots.find((s) => s.objectId === objectId);
    const id = spot ? this.reserved.get(spot.key) : undefined;
    return id ? this.customers.get(id) : undefined;
  }

  /** Spot object where this drink's customer is seated and waiting (so it can be served right now), or null. */
  serveSpotFor(drink: Drink): string | null {
    for (const c of this.customers.values()) {
      if (c.orderId === drink.orderId && c.spot && this.canServe(c.spot.objectId, drink).ok) return c.spot.objectId;
    }
    return null;
  }

  /** Validate handing a drink to whoever sits at this spot. */
  canServe(objectId: string, drink: Drink | undefined): CafeResult {
    if (!drink) return { ok: false, reason: 'noDrink' };
    const c = this.customerAtSpot(objectId);
    if (!c) return { ok: false, reason: 'noCustomerHere' };
    if (c.orderId !== drink.orderId) return { ok: false, reason: 'wrongCustomer' };
    if (!c.fsm.is('WAITING')) return { ok: false, reason: 'notWaiting' };
    if (c.target) return { ok: false, reason: 'notSeatedYet' };
    if (this.orders.get(drink.orderId)?.status !== 'READY') return { ok: false, reason: 'orderNotReady' };
    return { ok: true };
  }

  /** The customer takes the drink: order SERVED, then they taste, rate and pay. */
  receive(objectId: string, drink: Drink): CafeResult {
    const can = this.canServe(objectId, drink);
    if (!can.ok) return can;
    const c = this.customerAtSpot(objectId)!;
    const r = this.orders.transition(drink.orderId, 'SERVED');
    if (!r.ok) return { ok: false, reason: r.reason };
    c.drink = drink;
    this.setState(c, 'RECEIVING_DRINK');
    return { ok: true };
  }

  /**
   * Rate the drink and leave the customer's money behind as a PENDING payment on the seat / pickup
   * point (or credit it at once in `auto` mode). The order completes here; the money is credited
   * exactly once, later, by `collectPayment` (idempotency key `payment:<id>`).
   */
  private settle(c: Customer): void {
    const order = c.orderId !== null ? this.orders.get(c.orderId) : undefined;
    if (!order || !c.drink || order.status !== 'SERVED') return;
    const outcome = this.rate(order, c.drink, c);
    c.outcome = outcome;
    this.orders.transition(order.id, 'COMPLETED');
    const objectId = c.spot?.objectId ?? '';
    const pay: PaymentRecord = {
      id: this.store.nextPaymentId++,
      orderId: order.id,
      customerId: c.id,
      recipeId: order.recipeId,
      objectId,
      coins: outcome.coins,
      tip: outcome.tip ?? 0,
      exp: outcome.exp,
      createdAt: this.clock(),
      status: 'PENDING',
    };
    this.store.payments.push(pay);
    this.orders.patch(order.id, { paymentId: pay.id, paymentStatus: 'PENDING' });
    this.bus.emit('cafe:paymentCreated', { paymentId: pay.id, orderId: order.id, objectId, coins: pay.coins });
    if (this.paymentMode() === 'auto') this.credit(pay);
  }

  // ── payments ────────────────────────────────────────────────────────────

  pendingPayments(): PaymentRecord[] {
    return this.store.payments.filter((p) => p.status === 'PENDING');
  }

  /** Pending payments waiting on this seat / pickup point, oldest first. */
  paymentsAt(objectId: string): PaymentRecord[] {
    return this.pendingPayments().filter((p) => p.objectId === objectId);
  }

  canCollect(objectId: string): CafeResult {
    return this.paymentsAt(objectId).length > 0 ? { ok: true } : { ok: false, reason: 'noPayment', applicable: false };
  }

  /** Credit one pending payment at this object. Safe against repeated calls, reloads and double clicks. */
  collectPayment(objectId: string): CafeResult {
    const pay = this.paymentsAt(objectId)[0];
    if (!pay) return { ok: false, reason: 'noPayment' };
    return this.credit(pay);
  }

  /** The single place money from a payment enters the economy. */
  private credit(pay: PaymentRecord): CafeResult {
    if (pay.status === 'COLLECTED') return { ok: false, reason: 'alreadyCollected' };
    const res = this.tx.execute({ reason: `order:${pay.orderId}:${pay.recipeId}`, coins: pay.coins, exp: pay.exp, key: `payment:${pay.id}` });
    if (!res.ok && res.error !== 'duplicate') return { ok: false, reason: res.error };
    // 'duplicate' means the credit already happened (e.g. a save that lost the flag): just mark it collected.
    pay.status = 'COLLECTED';
    pay.collectedAt = this.clock();
    this.orders.patch(pay.orderId, { paymentStatus: 'COLLECTED' });
    // Keep the log short; collected records are only history (the credit key lives in the economy).
    const collected = this.store.payments.filter((p) => p.status === 'COLLECTED');
    if (collected.length > 40) this.store.payments = this.store.payments.filter((p) => p.status === 'PENDING' || collected.slice(-40).includes(p));
    if (res.ok) {
      this.bus.emit('cafe:paid', { orderId: pay.orderId, coins: pay.coins, exp: pay.exp });
      this.bus.emit('cafe:paymentCollected', { paymentId: pay.id, orderId: pay.orderId, objectId: pay.objectId, coins: pay.coins, exp: pay.exp });
    }
    return { ok: true };
  }

  // ── cleaning ────────────────────────────────────────────────────────────

  canClean(objectId: string, actorId: string): CafeResult {
    const st = this.seatStatus(objectId);
    if (st === 'CLEANING' && this.cleaning.get(objectId) !== actorId) return { ok: false, reason: 'beingCleaned' };
    if (st !== 'DIRTY' && st !== 'CLEANING') return { ok: false, reason: 'notDirty', applicable: false };
    return { ok: true };
  }

  /** Cleaning finished: the seat is available again. */
  finishCleaning(objectId: string, actorId: string): CafeResult {
    const can = this.canClean(objectId, actorId);
    if (!can.ok) return can;
    this.store.dirtySeats = this.store.dirtySeats.filter((id) => id !== objectId);
    this.cleaning.delete(objectId);
    this.bus.emit('cafe:seatCleaned', { objectId, actorId });
    return { ok: true };
  }

  private markDirty(objectId: string): void {
    if (!this.store.dirtySeats.includes(objectId)) this.store.dirtySeats.push(objectId);
    this.bus.emit('cafe:seatDirty', { objectId });
  }

  // ── simulation ──────────────────────────────────────────────────────────

  tick(dtMs: number): void {
    const t = this.now();
    if (this.open && t >= this.nextSpawnAt) {
      if (this.customers.size < this.config.spawn.maxConcurrent + this.maxConcurrentBonus()) this.spawn();
      const s = this.config.spawn;
      // Reputation (M6) and decor (M7) both bring customers more often.
      this.nextSpawnAt = t + this.rng.range(s.minIntervalMs, s.maxIntervalMs) / Math.max(0.1, (this.hooks.trafficFactor?.() ?? 1) * this.decorBonuses().trafficFactor);
    }
    for (const c of [...this.customers.values()]) this.update(c, dtMs);
    for (const [id, c] of this.customers) if (c.gone) this.customers.delete(id);
  }

  /** Spawn now (also used by tests and the debug bridge). `recipeId` forces the order (tests/debug). */
  spawn(archetype?: string, recipeId?: string, service?: ServiceType, at?: TilePos): Customer {
    const archetypes = this.config.archetypes;
    const key = archetype && archetypes[archetype] ? archetype : this.rng.weighted(Object.fromEntries(Object.entries(archetypes).map(([k, a]) => [k, a.weight])));
    const def = archetypes[key]!;
    const unlocked = (rid: string) => !!this.orders.recipes[rid] && (this.hooks.isRecipeUnlocked?.(rid) ?? true);
    let recipes = Object.fromEntries(Object.entries(def.preferences).filter(([rid]) => unlocked(rid)));
    // Nothing they like is on the menu yet: they order something that is.
    if (Object.keys(recipes).length === 0) recipes = Object.fromEntries(Object.keys(this.orders.recipes).filter(unlocked).map((rid) => [rid, 1]));
    const chosen = recipeId && this.orders.recipes[recipeId] ? recipeId : this.rng.weighted(recipes);
    const share = def.takeawayShare ?? this.config.service.takeawayShare;
    // Forced spawns (tests, debug, the story master) are dine-in unless told otherwise; natural arrivals roll the dice.
    const kind: ServiceType = service ?? (archetype || recipeId ? 'dineIn' : this.rng.next() < share ? 'takeaway' : 'dineIn');
    const id = `c${this.nextId++}`;
    const now = this.now;
    const actor = new Actor(id, tileCenter(at ?? this.spawnTile), { speedTilesPerSec: def.speedTilesPerSec, bodyRadius: this.bodyRadius }, now);
    const c: Customer = {
      id,
      archetype: key,
      def: this.withDecorPatience(def),
      actor,
      fsm: new StateMachine<CustomerState>(`customer:${id}`, 'SPAWNING', CUSTOMER_TRANSITIONS, now),
      recipeId: chosen,
      service: kind,
      orderId: null,
      spot: null,
      target: null,
      needsPlan: false,
      queueWaitMs: 0,
      drinkWaitMs: 0,
      stateMs: 0,
      blockedMs: 0,
      retryInMs: 0,
      stuckMs: 0,
      stuckFrom: { ...actor.pos },
      repaths: 0,
      leaveReason: null,
      satisfaction: null,
      gone: false,
      startedInside: !!at,
      drink: null,
      outcome: null,
    };
    c.fsm.onTransition((from, to) => this.bus.emit('customer:stateChanged', { customerId: id, from, to }));
    this.customers.set(id, c);
    this.bus.emit('customer:spawned', { customerId: id, archetype: key, service: kind });
    return c;
  }

  private update(c: Customer, dt: number): void {
    c.stateMs += dt;
    const s = c.fsm.state;
    if (s === 'QUEUING' || s === 'WALKING_TO_COUNTER' || s === 'ORDERING') {
      c.queueWaitMs += dt;
      if (c.queueWaitMs > c.def.orderPatienceMs) return this.leave(c, 'impatient');
    } else if (s === 'WAITING') {
      c.drinkWaitMs += dt;
      if (c.drinkWaitMs > c.def.drinkPatienceMs) return this.leave(c, 'timeout');
    }

    const move = this.move(c, dt);
    if (move === 'blocked') return this.onBlocked(c);

    switch (c.fsm.state) {
      case 'SPAWNING':
        this.setState(c, 'ENTERING');
        // Spawned inside the café (the story master): no walk to the street door first.
        if (c.startedInside) this.joinQueue(c);
        else this.setTarget(c, this.doorTile);
        break;
      case 'ENTERING':
        if (move === 'arrived') this.joinQueue(c);
        break;
      case 'QUEUING': {
        const idx = this.queue.indexOf(c.id);
        if (idx === 0) {
          this.setState(c, 'WALKING_TO_COUNTER');
          this.setTarget(c, this.orderPoint);
        } else {
          const want = this.queueTiles[idx - 1]!;
          if (!c.target && !sameTile(c.actor.tile, want)) this.setTarget(c, want);
          else if (c.target && !sameTile(c.target, want)) this.setTarget(c, want);
        }
        break;
      }
      case 'WALKING_TO_COUNTER':
        if (move === 'arrived') {
          this.setState(c, 'ORDERING');
          const r = this.orders.create(c.id, c.recipeId, c.def.drinkPatienceMs, c.service);
          if (r.ok) c.orderId = r.order.id;
          c.actor.faceTowards({ x: this.orderPoint.x + 0.5, y: this.orderPoint.y - 0.5 });
        }
        break;
      case 'RECEIVING_DRINK':
        // Dine-in customers sit and drink; takeaway customers go straight to paying.
        if (c.stateMs >= this.config.behaviour.receivingMs) this.setState(c, c.service === 'dineIn' && c.spot?.kind === 'seat' ? 'CONSUMING' : 'PAYING');
        break;
      case 'CONSUMING':
        if (c.stateMs >= this.config.behaviour.consumingMs) this.setState(c, 'PAYING');
        break;
      case 'PAYING':
        if (c.stateMs >= this.config.behaviour.payingMs) {
          this.settle(c);
          this.leave(c, 'served');
        }
        break;
      case 'LEAVING':
        if (move === 'arrived' || (!c.target && sameTile(c.actor.tile, this.exitTile))) c.gone = true;
        break;
      default:
        break;
    }
  }

  private joinQueue(c: Customer): void {
    if (this.queue.length >= 1 + this.queueTiles.length) return this.leave(c, 'queueFull');
    this.queue.push(c.id);
    if (this.queue.length === 1) {
      this.setState(c, 'WALKING_TO_COUNTER');
      this.setTarget(c, this.orderPoint);
    } else {
      this.setState(c, 'QUEUING');
      this.setTarget(c, this.queueTiles[this.queue.length - 2]!);
    }
  }

  private removeFromQueue(id: string): void {
    const i = this.queue.indexOf(id);
    if (i >= 0) this.queue.splice(i, 1);
  }

  private leave(c: Customer, reason: string): void {
    if (c.fsm.is('LEAVING')) return;
    if (c.orderId !== null) {
      const o = this.orders.get(c.orderId);
      if (o && o.status === 'CREATED') this.orders.transition(o.id, 'CANCELLED', reason);
      else if (o && ['ACCEPTED', 'PREPARING', 'READY'].includes(o.status)) this.orders.transition(o.id, 'FAILED', reason);
    }
    this.removeFromQueue(c.id);
    if (c.spot) {
      this.reserved.delete(c.spot.key);
      // A dine-in customer who actually sat and drank leaves the seat dirty; it is unusable until cleaned.
      if (c.spot.kind === 'seat' && c.drink && c.fsm.is('RECEIVING_DRINK', 'CONSUMING', 'PAYING')) this.markDirty(c.spot.objectId);
      c.spot = null;
    }
    c.leaveReason = reason;
    c.satisfaction = this.satisfaction(c, reason);
    if (UNHAPPY.has(reason)) this.hooks.onCustomerFailed?.(reason);
    this.setState(c, 'LEAVING');
    this.setTarget(c, this.exitTile);
    this.bus.emit('customer:left', { customerId: c.id, reason, satisfaction: c.satisfaction });
  }

  /** Placeholder until M6 ratings: 100 minus waiting penalties; failures score low. */
  private satisfaction(c: Customer, reason: string): number {
    if (FAILURES.has(reason)) return 10;
    const q = Math.min(1, c.queueWaitMs / c.def.orderPatienceMs);
    const d = Math.min(1, c.drinkWaitMs / c.def.drinkPatienceMs);
    return Math.round(Math.max(0, 100 - 40 * q - 40 * d));
  }

  private onBlocked(c: Customer): void {
    if (!c.fsm.is('LEAVING')) return this.leave(c, 'blocked');
    // Can't even reach the exit: remove rather than leave an NPC stuck forever.
    c.gone = true;
    this.bus.emit('customer:removed', { customerId: c.id, reason: 'stuck' });
  }

  private setState(c: Customer, s: CustomerState): void {
    c.fsm.transition(s);
    c.stateMs = 0;
  }

  private setTarget(c: Customer, tile: TilePos): void {
    c.target = { ...tile };
    c.needsPlan = true;
    c.retryInMs = 0;
    c.blockedMs = 0;
    c.repaths = 0;
    c.stuckMs = 0;
    c.stuckFrom = { ...c.actor.pos };
  }

  /** Walk towards c.target. Never moves faster than the customer's speed (no teleporting). */
  private move(c: Customer, dt: number): 'idle' | 'moving' | 'arrived' | 'blocked' {
    if (!c.target) return 'idle';
    const b = this.config.behaviour;
    if (c.needsPlan) {
      c.retryInMs -= dt;
      if (c.retryInMs > 0) {
        c.blockedMs += dt;
        return c.blockedMs > b.giveUpBlockedMs ? 'blocked' : 'moving';
      }
      const plan = this.nav.planTo(c.actor.pos, [c.target]);
      if (!plan) {
        c.blockedMs += dt;
        c.retryInMs = b.retryPathMs;
        return c.blockedMs > b.giveUpBlockedMs ? 'blocked' : 'moving';
      }
      c.actor.setWaypoints(plan.waypoints);
      c.needsPlan = false;
      c.blockedMs = 0;
    }
    const arrived = c.actor.stepMovement(dt);
    if (arrived) {
      c.target = null;
      return 'arrived';
    }
    c.stuckMs += dt;
    if (c.stuckMs >= b.stuckCheckMs) {
      const moved = Math.hypot(c.actor.pos.x - c.stuckFrom.x, c.actor.pos.y - c.stuckFrom.y);
      c.stuckMs = 0;
      c.stuckFrom = { ...c.actor.pos };
      if (moved < 0.05) {
        c.repaths++;
        if (c.repaths > b.maxRepaths) return 'blocked';
        c.needsPlan = true;
      }
    }
    return 'moving';
  }

  // ── furniture (M7) ──────────────────────────────────────────────────────

  private decorBonuses: () => { patienceFactor: number; trafficFactor: number } = () => ({ patienceFactor: 1, trafficFactor: 1 });

  /** Furniture bonuses: comfort makes new customers more patient, decor brings them more often. */
  setDecorBonuses(fn: () => { patienceFactor: number; trafficFactor: number }): void {
    this.decorBonuses = fn;
  }

  /** Seats (anything customers are served on) first, then standing spots. Reserved spots are never dropped. */
  private collectSpots(): Spot[] {
    const serveSpots = this.world.allObjects().filter((o) => o.def.interaction?.actions.some((a) => a.handler === 'cafe.serve'));
    const spot = (o: (typeof serveSpots)[number], kind: Spot['kind']): Spot => ({ key: `${kind}:${o.id}`, kind, objectId: o.id, tile: { x: o.footprint.x, y: o.footprint.y } });
    const isSeat = (o: (typeof serveSpots)[number]) => o.type !== 'standing_spot' && o.type !== 'pickup_point';
    const spots = [
      ...serveSpots.filter(isSeat).map((o) => spot(o, 'seat')),
      ...serveSpots.filter((o) => o.type === 'standing_spot').map((o) => spot(o, 'stand')),
      ...serveSpots.filter((o) => o.type === 'pickup_point').map((o) => spot(o, 'pickup')),
    ];
    for (const c of this.customers.values()) if (c.spot && !spots.some((s) => s.key === c.spot!.key)) spots.push(c.spot);
    return spots;
  }

  /** Furniture changed: new seats become available, stored ones disappear. */
  refreshSpots(): void {
    this.spots = this.collectSpots();
    this.pruneDirty();
  }

  isSpotReserved(objectId: string): boolean {
    return this.spots.some((s) => s.objectId === objectId && this.reserved.has(s.key));
  }

  /** The walkable grid changed: everyone still walking plans a new path from where they stand. */
  onNavChanged(): void {
    for (const c of this.customers.values()) {
      if (!c.target) continue;
      c.needsPlan = true;
      c.retryInMs = 0;
    }
  }

  private withDecorPatience(def: ArchetypeDef): ArchetypeDef {
    const f = this.decorBonuses().patienceFactor;
    return f === 1 ? def : { ...def, orderPatienceMs: Math.round(def.orderPatienceMs * f), drinkPatienceMs: Math.round(def.drinkPatienceMs * f) };
  }
}
